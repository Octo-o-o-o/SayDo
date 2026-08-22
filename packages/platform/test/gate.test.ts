import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { request as httpRequest } from "node:http";
import { GATE_HMAC_HEADER, hmacHeaderOk, hmacHex, listenGateHttp, newGateSecret } from "../src/gate.js";
import { setRestrictOwnerOnlyForTests } from "../src/fs.js";

describe("gate HMAC", () => {
  it("匹配通过,篡改拒绝", () => {
    const secret = newGateSecret();
    const body = Buffer.from(`{"cwd":"x","command":"ls"}`, "utf8");
    const hex = hmacHex(secret, body);
    expect(hmacHeaderOk(secret, body, hex)).toBe(true);
    expect(hmacHeaderOk(secret, body, "00".repeat(32))).toBe(false);
    expect(hmacHeaderOk(secret, body, undefined)).toBe(false);
  });
});

describe("listenGateHttp", () => {
  it("HMAC 失败不调用 handler", async () => {
    setRestrictOwnerOnlyForTests(() => undefined);
    const home = mkdtempSync(join(tmpdir(), "saydo-plat-gate-"));
    let called = false;
    try {
      const listened = await listenGateHttp(home, async () => {
        called = true;
        return { permission: "allow" };
      });
      const body = Buffer.from(`{"cwd":"x","command":"ls"}`, "utf8");
      await new Promise<void>((resolve, reject) => {
        const req = httpRequest(
          {
            host: "127.0.0.1",
            port: listened.bind.port,
            path: "/gate",
            method: "POST",
            headers: {
              "content-type": "application/json",
              "content-length": String(body.length),
              [GATE_HMAC_HEADER]: createHmac("sha256", "wrong").update(body).digest("hex")
            }
          },
          (res) => {
            res.resume();
            res.on("end", () => resolve());
          }
        );
        req.on("error", reject);
        req.write(body);
        req.end();
      });
      listened.server.close();
      expect(called).toBe(false);
      expect(listened.bind.port).not.toBe(47100);
    } finally {
      setRestrictOwnerOnlyForTests(null);
      rmSync(home, { recursive: true, force: true });
    }
  });
});
