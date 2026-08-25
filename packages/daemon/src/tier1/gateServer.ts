// Tier1 审批 socket 服务(执行器批;09 §11:gate 脚本回连 daemon 审批 socket)。
// 形态 = unix domain socket(~/.saydo/tier1-gate.sock):不占 TCP 端口、天然本机、
// 不经 47100 也就不与 G1 网络门(capability token/Host/Origin)混流——G1 防的是浏览器跨站,
// 本 socket 的调用方是 hook 子进程(文件系统可达性即本机边界;单 owner 单机威胁模型,05 §4)。
// 决策键 =(runId, seq)每条命令独立(fail-closed 律④);cwd 匹配不到活跃 run ⇒ deny(fail-closed)。

import { createServer, type Server } from "node:http";
import { existsSync, unlinkSync } from "node:fs";
import { z } from "zod";
import { listenGateHttp, projectUntrustedFailureText, readOwnErrnoCode } from "@saydo/platform";

export const GATE_BIND_FAILED = "gate bind failed";
export const GATE_CLOSE_FAILED = "gate close failed";
export const GATE_REQUEST_FAILED = "gate request failed";

interface GateServerTestHooks {
  listenDelayMs?: number;
  forceListenError?: NodeJS.ErrnoException;
  preserveSockFile?: boolean;
}

let gateServerTestHooks: GateServerTestHooks = {};

export function setGateServerTestHooks(hooks: GateServerTestHooks | null): void {
  gateServerTestHooks = hooks ?? {};
}

const legacyGateRequestSchema = z.object({
  command: z.string(),
  cwd: z.string()
});
const commandKindGateRequestSchema = z.object({
  kind: z.literal("command"),
  command: z.string(),
  cwd: z.string()
});
const fileWriteGateRequestSchema = z.object({
  kind: z.literal("file_write"),
  tool: z.string(),
  path: z.string(),
  cwd: z.string()
});
const fileReadGateRequestSchema = z.object({
  kind: z.literal("file_read"),
  path: z.string(),
  cwd: z.string()
});

export type GateWireRequest =
  | z.infer<typeof legacyGateRequestSchema>
  | z.infer<typeof commandKindGateRequestSchema>
  | z.infer<typeof fileWriteGateRequestSchema>
  | z.infer<typeof fileReadGateRequestSchema>;

/** 无 kind 不注入键(cursor 既有 wire `{command,cwd}` 零改动);未知 kind 拒. */
export function parseGateWireRequest(raw: unknown): GateWireRequest {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("gate request must be an object");
  }
  const rec = raw as Record<string, unknown>;
  if ("kind" in rec) {
    const k = rec["kind"];
    if (k === "command") return commandKindGateRequestSchema.parse(raw);
    if (k === "file_write") return fileWriteGateRequestSchema.parse(raw);
    if (k === "file_read") return fileReadGateRequestSchema.parse(raw);
    throw new Error(`unknown gate request kind: ${String(k)}`);
  }
  return legacyGateRequestSchema.parse(raw);
}

export interface GateWireResponse {
  permission: "allow" | "deny" | "no_decision";
  agent_message?: string;
}

export type GateHandler = (req: GateWireRequest) => Promise<GateWireResponse>;

function projectGateBindFailure(err: unknown): Error {
  const code = readOwnErrnoCode(err);
  const out = new Error(code === "EADDRINUSE" || code === "EACCES" ? code : GATE_BIND_FAILED);
  if (code === "EADDRINUSE" || code === "EACCES") {
    Object.defineProperty(out, "code", { value: code });
  }
  return out;
}

/**
 * 起审批 socket 服务(调用方注入 handler = executor 的门决策链)。
 * 只有 listening 成功后才 resolve；异步 error 受控 reject；close/abort 不得留下失联 listener。
 */
export type GateListeningServer = Server & { failed: Promise<Error> };

export function startGateServer(
  sockPath: string,
  handler: GateHandler,
  options?: { signal?: AbortSignal }
): Promise<GateListeningServer> {
  if (existsSync(sockPath) && !gateServerTestHooks.preserveSockFile) unlinkSync(sockPath);
  const server = createServer((req, res) => {
    if (req.method !== "POST" || (req.url ?? "").split("?")[0] !== "/gate") {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ permission: "deny", agent_message: "unknown gate route (fail-closed)" }));
      return;
    }
    const chunks: Buffer[] = [];
    let bytes = 0;
    req.on("data", (c: Buffer) => {
      bytes += c.length;
      if (bytes > 262_144) {
        // 256KB 上限:hook 请求只有 command+cwd,超限即异常输入
        res.writeHead(413, { "content-type": "application/json" });
        res.end(JSON.stringify({ permission: "deny", agent_message: "gate request too large (fail-closed)" }));
        req.destroy();
        return;
      }
      chunks.push(c); // B3:累积 Buffer 后一次性解码,防 UTF-8 多字节跨 chunk 边界乱码(中文命令误拒)
    });
    req.on("end", () => {
      if (res.writableEnded) return;
      void (async () => {
        try {
          const parsed = parseGateWireRequest(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          const out = await handler(parsed);
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify(out));
        } catch (err) {
          res.writeHead(200, { "content-type": "application/json" });
          res.end(
            JSON.stringify({
              permission: "deny",
              agent_message: `SayDo gate error (fail-closed): ${projectUntrustedFailureText(err, GATE_REQUEST_FAILED)}`
            } satisfies GateWireResponse)
          );
        }
      })();
    });
  });
  return new Promise<GateListeningServer>((resolve, reject) => {
    let settled = false;
    let closed = false;
    let listenTimer: NodeJS.Timeout | undefined;
    let failSettled = false;
    let reportFail!: (err: Error) => void;
    const failed = new Promise<Error>((resolveFail) => {
      reportFail = resolveFail;
    });
    failed.then(() => undefined, () => undefined);
    const listened = server as GateListeningServer;
    Object.defineProperty(listened, "failed", { value: failed, enumerable: false });
    server.on("error", (err) => {
      if (failSettled) return;
      failSettled = true;
      reportFail(projectGateBindFailure(err));
    });
    const finish = (err?: Error): void => {
      if (settled) return;
      settled = true;
      if (listenTimer) clearTimeout(listenTimer);
      server.off("listening", onListening);
      server.off("error", onError);
      options?.signal?.removeEventListener("abort", onAbort);
      if (err) {
        closed = true;
        server.close(() => {
          reject(projectGateBindFailure(err));
        });
        return;
      }
      server.unref();
      resolve(listened);
    };
    const onListening = (): void => {
      if (closed) {
        server.close(() => finish(new Error(GATE_BIND_FAILED)));
        return;
      }
      finish();
    };
    const onError = (err: Error): void => {
      finish(err);
    };
    const onAbort = (): void => {
      closed = true;
      finish(new Error(GATE_BIND_FAILED));
    };
    server.once("listening", onListening);
    server.once("error", onError);
    if (options?.signal?.aborted) {
      onAbort();
      return;
    }
    options?.signal?.addEventListener("abort", onAbort, { once: true });
    const beginListen = (): void => {
      if (settled) return;
      const forced = gateServerTestHooks.forceListenError;
      if (forced) {
        queueMicrotask(() => onError(forced));
        return;
      }
      try {
        server.listen(sockPath);
      } catch (err) {
        finish(projectGateBindFailure(err));
      }
    };
    const delay = gateServerTestHooks.listenDelayMs ?? 0;
    if (delay > 0) listenTimer = setTimeout(beginListen, delay);
    else beginListen();
  });
}

export function closeGateServer(server: Server | null): Promise<void> {
  if (!server) return Promise.resolve();
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (err?: Error): void => {
      if (settled) return;
      settled = true;
      const code = readOwnErrnoCode(err);
      if (err && code !== "ERR_SERVER_NOT_RUNNING") {
        reject(new Error(GATE_CLOSE_FAILED));
        return;
      }
      resolve();
    };
    try {
      server.close((err) => done(err ?? undefined));
    } catch {
      done(new Error(GATE_CLOSE_FAILED));
    }
  });
}

/** POSIX = unix socket; win32 = 环回临时端口 + HMAC */
export async function startTier1Gate(saydoHome: string, sockPath: string, handler: GateHandler): Promise<GateListeningServer> {
  if (process.platform === "win32") {
    const listened = await listenGateHttp(saydoHome, async (json) => handler(parseGateWireRequest(json)));
    return listened.server;
  }
  return startGateServer(sockPath, handler);
}
