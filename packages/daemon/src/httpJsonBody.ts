import type { IncomingMessage, ServerResponse } from "node:http";

export type JsonBodyResult =
  | { status: "handled"; value: unknown }
  | { status: "failed" };

function writeJsonOnce(res: ServerResponse, status: number, body: unknown): void {
  if (res.headersSent || res.writableEnded) return;
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

export type Utf8BodyResult =
  | { status: "handled"; text: string }
  | { status: "failed" };

/** 跨 chunk 按 Buffer 拼接再 UTF-8 解码；上限按字节。413 后不再进入业务。 */
export function readUtf8Body(
  req: IncomingMessage,
  res: ServerResponse,
  limit: number
): Promise<Utf8BodyResult> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = [];
    let received = 0;
    let overflow = false;
    let finished = false;
    const fail = (status: number, payload: unknown): void => {
      if (finished) return;
      finished = true;
      writeJsonOnce(res, status, payload);
      resolveBody({ status: "failed" });
    };
    req.on("data", (chunk: Buffer | string) => {
      if (overflow || finished) return;
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      if (received + buf.length > limit) {
        overflow = true;
        fail(413, { ok: false, code: "payload_too_large", message: `body exceeds ${String(limit)} bytes`, retryable: false });
        req.destroy();
        return;
      }
      received += buf.length;
      chunks.push(buf);
    });
    req.on("end", () => {
      if (overflow || finished) return;
      finished = true;
      resolveBody({ status: "handled", text: Buffer.concat(chunks).toString("utf8") });
    });
    req.on("error", (err) => {
      if (finished) return;
      finished = true;
      reject(err);
    });
  });
}

/** 400/413 后不再进入业务路由；同一请求只写一次响应。 */
export function readJsonBody(
  req: IncomingMessage,
  res: ServerResponse,
  limit = 65_536
): Promise<JsonBodyResult> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = [];
    let received = 0;
    let overflow = false;
    let finished = false;
    const fail = (status: number, payload: unknown): void => {
      if (finished) return;
      finished = true;
      writeJsonOnce(res, status, payload);
      resolveBody({ status: "failed" });
    };
    req.on("data", (chunk: Buffer | string) => {
      if (overflow || finished) return;
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      if (received + buf.length > limit) {
        overflow = true;
        fail(413, { ok: false, code: "payload_too_large", message: `body exceeds ${String(limit)} bytes`, retryable: false });
        req.destroy();
        return;
      }
      received += buf.length;
      chunks.push(buf);
    });
    req.on("end", () => {
      if (overflow || finished) return;
      try {
        const body = Buffer.concat(chunks).toString("utf8");
        const value = body.trim() === "" ? {} : JSON.parse(body) as unknown;
        finished = true;
        resolveBody({ status: "handled", value });
      } catch {
        fail(400, { ok: false, code: "invalid_json", message: "invalid json", retryable: false });
      }
    });
    req.on("error", (err) => {
      if (finished) return;
      finished = true;
      reject(err);
    });
  });
}
