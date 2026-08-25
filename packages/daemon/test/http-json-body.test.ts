import { EventEmitter, once } from "node:events";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { describe, expect, it } from "vitest";
import { readJsonBody } from "../src/httpJsonBody.js";

function fakeReq(): EventEmitter & { destroy: () => void } {
  const req = new EventEmitter() as EventEmitter & { destroy: () => void };
  req.destroy = () => {
    req.emit("close");
  };
  return req;
}

function fakeRes(): ServerResponse & { statusCode: number; body: string } {
  const state = { statusCode: 0, body: "", headersSent: false, writableEnded: false };
  return {
    get headersSent() { return state.headersSent; },
    get writableEnded() { return state.writableEnded; },
    writeHead(status: number) {
      state.statusCode = status;
      state.headersSent = true;
      return this;
    },
    end(payload?: string) {
      state.body = payload ?? "";
      state.writableEnded = true;
      return this;
    },
    get statusCode() { return state.statusCode; },
    get body() { return state.body; }
  } as unknown as ServerResponse & { statusCode: number; body: string };
}

describe("HTTP JSON body parser", () => {
  it("invalid JSON 写一次 400 且不再进入业务", async () => {
    let business = 0;
    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      void readJsonBody(req, res).then((parsed) => {
        if (parsed.status === "failed") return;
        business += 1;
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      });
    });
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("listen failed");
    try {
      const res = await fetch(`http://127.0.0.1:${addr.port}/`, {
        method: "POST",
        body: "{not json"
      });
      expect(res.status).toBe(400);
      const body = await res.json() as { code?: string };
      expect(body.code).toBe("invalid_json");
      expect(business).toBe(0);
    } finally {
      server.close();
      await once(server, "close");
    }
  });

  it("跨 chunk 的多字节 UTF-8 必须拼 Buffer 再解码", async () => {
    const req = fakeReq();
    const res = fakeRes();
    const pending = readJsonBody(req as unknown as IncomingMessage, res, 65_536);
    const payload = Buffer.from('"中"', "utf8");
    req.emit("data", payload.subarray(0, 2));
    req.emit("data", payload.subarray(2));
    req.emit("end");
    const parsed = await pending;
    expect(parsed).toEqual({ status: "handled", value: "中" });
  });

  it("byte limit 按 UTF-8 字节计，JSON \"中中\" 在 limit=6 时 413", async () => {
    const req = fakeReq();
    const res = fakeRes();
    const pending = readJsonBody(req as unknown as IncomingMessage, res, 6);
    const payload = Buffer.from('"中中"', "utf8");
    expect(payload.length).toBe(8);
    req.emit("data", payload.subarray(0, 4));
    req.emit("data", payload.subarray(4));
    req.emit("end");
    const parsed = await pending;
    expect(parsed).toEqual({ status: "failed" });
    expect(res.statusCode).toBe(413);
    expect(JSON.parse(res.body).code).toBe("payload_too_large");
  });
});
