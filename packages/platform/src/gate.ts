import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { restrictOwnerOnly } from "./fs.js";
import { hostKind } from "./host.js";

export const GATE_HMAC_HEADER = "x-saydo-gate";

export interface GateBind {
  host: "127.0.0.1";
  port: number;
}

export function gateDir(saydoHome: string): string {
  return join(saydoHome, "tier1");
}

export function gateBindPath(saydoHome: string): string {
  return join(gateDir(saydoHome), "gate-bind.json");
}

export function gateSecretPath(saydoHome: string): string {
  return join(gateDir(saydoHome), "gate-secret");
}

export function posixGateSockPath(saydoHome: string): string {
  return join(saydoHome, "tier1-gate.sock");
}

export function newGateSecret(): Buffer {
  return randomBytes(32);
}

export function hmacHex(secret: Buffer, body: Buffer): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export function hmacHeaderOk(secret: Buffer, body: Buffer, header: string | undefined): boolean {
  if (!header) return false;
  const expected = hmacHex(secret, body);
  const a = Buffer.from(header, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function writeGateBindAndSecret(saydoHome: string, bind: GateBind, secret: Buffer): void {
  if (hostKind() === "win32" && bind.port === 47100) {
    throw new Error("gate loopback must not reuse G1 port 47100");
  }
  mkdirSync(gateDir(saydoHome), { recursive: true, mode: 0o700 });
  restrictOwnerOnly(gateDir(saydoHome), "dir");
  const bindFile = gateBindPath(saydoHome);
  const secretFile = gateSecretPath(saydoHome);
  writeFileSync(bindFile, `${JSON.stringify(bind)}\n`, { mode: 0o600 });
  restrictOwnerOnly(bindFile, "file");
  writeFileSync(secretFile, secret, { mode: 0o600 });
  restrictOwnerOnly(secretFile, "file");
}

/** 三态:allow / deny / no_decision(claude PreToolUse 无裁决,落回 vendor 权限流;W5.4-b) */
export type GateHttpHandler = (
  json: unknown
) => Promise<{ permission: "allow" | "deny" | "no_decision"; agent_message?: string }>;

export interface GateHttpListen {
  server: Server;
  bind: GateBind;
  secret: Buffer;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function writeGateDeny(res: ServerResponse, message: string, status = 200): void {
  if (res.writableEnded) return;
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify({ permission: "deny", agent_message: message }));
}

/**
 * Windows 生产审批门:绑定 127.0.0.1 临时端口,HMAC 失败一律 deny。
 * 禁止复用 G1 47100。POSIX 生产路径仍走 unix socket,不调用本函数。
 */
export function listenGateHttp(saydoHome: string, handler: GateHttpHandler): Promise<GateHttpListen> {
  const secret = newGateSecret();
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== "POST" || (req.url ?? "").split("?")[0] !== "/gate") {
      writeGateDeny(res, "unknown gate route (fail-closed)", 404);
      return;
    }
    const chunks: Buffer[] = [];
    let bytes = 0;
    req.on("data", (c: Buffer) => {
      bytes += c.length;
      if (bytes > 262_144) {
        writeGateDeny(res, "gate request too large (fail-closed)", 413);
        req.destroy();
      } else {
        chunks.push(c);
      }
    });
    req.on("end", () => {
      if (res.writableEnded) return;
      void (async () => {
        const body = Buffer.concat(chunks);
        if (!hmacHeaderOk(secret, body, headerValue(req.headers[GATE_HMAC_HEADER]))) {
          writeGateDeny(res, "SayDo gate: hmac failed (fail-closed)");
          return;
        }
        let json: unknown;
        try {
          json = JSON.parse(body.toString("utf8"));
        } catch (err) {
          writeGateDeny(res, `SayDo gate error (fail-closed): ${String(err).slice(0, 120)}`);
          return;
        }
        try {
          const out = await handler(json);
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify(out));
        } catch (err) {
          writeGateDeny(res, `SayDo gate error (fail-closed): ${String(err).slice(0, 120)}`);
        }
      })();
    });
  });
  return new Promise((resolve, reject) => {
    const onError = (err: Error): void => {
      server.off("error", onError);
      reject(err);
    };
    server.once("error", onError);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", onError);
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("gate listen address unavailable"));
        return;
      }
      if (addr.port === 47100) {
        server.close();
        reject(new Error("gate loopback must not reuse G1 port 47100"));
        return;
      }
      const bind: GateBind = { host: "127.0.0.1", port: addr.port };
      try {
        writeGateBindAndSecret(saydoHome, bind, secret);
      } catch (err) {
        server.close();
        reject(err);
        return;
      }
      server.unref();
      resolve({ server, bind, secret });
    });
  });
}
