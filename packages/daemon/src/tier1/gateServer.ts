// Tier1 审批 socket 服务(执行器批;09 §11:gate 脚本回连 daemon 审批 socket)。
// 形态 = unix domain socket(~/.saydo/tier1-gate.sock):不占 TCP 端口、天然本机、
// 不经 47100 也就不与 G1 网络门(capability token/Host/Origin)混流——G1 防的是浏览器跨站,
// 本 socket 的调用方是 hook 子进程(文件系统可达性即本机边界;单 owner 单机威胁模型,05 §4)。
// 决策键 =(runId, seq)每条命令独立(fail-closed 律④);cwd 匹配不到活跃 run ⇒ deny(fail-closed)。

import { createServer, type Server } from "node:http";
import { existsSync, unlinkSync } from "node:fs";
import { z } from "zod";
import { listenGateHttp } from "@saydo/platform";

const gateRequestSchema = z.object({
  cwd: z.string(),
  command: z.string().optional(),
  kind: z.enum(["command", "file_write", "file_read"]).optional()
});
export type GateWireRequest = z.infer<typeof gateRequestSchema>;

export function parseGateWireRequest(json: unknown): GateWireRequest {
  return gateRequestSchema.parse(json);
}

export interface GateWireResponse {
  permission: "allow" | "deny";
  agent_message?: string;
}

export type GateHandler = (req: GateWireRequest) => Promise<GateWireResponse>;

/**
 * 起审批 socket 服务(调用方注入 handler = executor 的门决策链)。
 * 任何解析失败/handler 异常 ⇒ deny(fail-closed);旧 sock 文件启动前清理(崩溃残留)。
 */
export function startGateServer(sockPath: string, handler: GateHandler): Server {
  if (existsSync(sockPath)) unlinkSync(sockPath);
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
          const parsed = gateRequestSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          const out = await handler(parsed);
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify(out));
        } catch (err) {
          res.writeHead(200, { "content-type": "application/json" });
          res.end(
            JSON.stringify({
              permission: "deny",
              agent_message: `SayDo gate error (fail-closed): ${String(err).slice(0, 120)}`
            } satisfies GateWireResponse)
          );
        }
      })();
    });
  });
  server.listen(sockPath);
  server.unref();
  return server;
}

/** POSIX = unix socket; win32 = 环回临时端口 + HMAC */
export async function startTier1Gate(saydoHome: string, sockPath: string, handler: GateHandler): Promise<Server> {
  if (process.platform === "win32") {
    const listened = await listenGateHttp(saydoHome, async (json) => handler(parseGateWireRequest(json)));
    return listened.server;
  }
  return startGateServer(sockPath, handler);
}
