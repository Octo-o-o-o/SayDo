// BYOA 安全门必须每次真算:mtime/size 缓存不得挡住 spawn 前身份核验。
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkBinaryIdentity, verifyBinaryIdentity } from "../src/providers/binaryIdentity.js";
import {
  createByoaProvider,
  resetByoaLifecycleForTests,
  resetByoaProviderForTests,
  type ByoaProviderOptions
} from "../src/providers/byoa/provider.js";
import { familyFromModelName } from "../src/config/family.js";
import type { AuditEvent, AuditSink } from "../src/obs/audit.js";
import { chmodSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  configureRuntimeChildRegistry,
  resetRuntimeChildLifecycleForTests
} from "../src/runtimeChildRegistry.js";

const fakeCli = fileURLToPath(new URL("./fixtures/fake-byoa-cli.mjs", import.meta.url));

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

afterEach(() => {
  resetByoaProviderForTests();
  resetByoaLifecycleForTests();
  try {
    resetRuntimeChildLifecycleForTests();
  } catch {
    // 本测污染不得串到下一测
  }
});

describe("BYOA spawn 前身份核验每次真算", () => {
  it("forceRehash 连续两次都调用哈希,同 mtime/size 内容替换 digest_mismatch", () => {
    const dir = mkdtempSync(join(tmpdir(), "saydo-id-"));
    const bin = join(dir, "cli.bin");
    writeFileSync(bin, "AAAA");
    const digest = sha256(bin);
    const identity = { path: bin, digest };
    const familyOf = (): string => "claude";
    let hashes = 0;
    const hashFile = (path: string): string => {
      hashes += 1;
      return sha256(path);
    };
    expect(verifyBinaryIdentity(bin, identity, familyOf, "claude", { forceRehash: true, hashFile })).toBe(identity);
    expect(hashes).toBe(1);
    expect(verifyBinaryIdentity(bin, identity, familyOf, "claude", { forceRehash: true, hashFile })).toBe(identity);
    expect(hashes).toBe(2);
    const before = statSync(bin);
    writeFileSync(bin, "BBBB");
    utimesSync(bin, before.atimeMs / 1000, before.mtimeMs / 1000);
    const restored = statSync(bin);
    expect(restored.size).toBe(before.size);
    expect(restored.mtimeMs).toBe(before.mtimeMs);
    expect(verifyBinaryIdentity(bin, identity, familyOf, "claude", { forceRehash: true, hashFile })).toBeUndefined();
    expect(hashes).toBe(3);
    expect(checkBinaryIdentity(bin, identity, familyOf, "claude", { forceRehash: true })).toMatchObject({
      ok: false,
      code: "digest_mismatch"
    });
    rmSync(dir, { recursive: true, force: true });
  });

  it("BYOA chat 路径连续两次核验都哈希,同 mtime/size 内容替换拒绝", async () => {
    const dir = mkdtempSync(join(tmpdir(), "saydo-byoa-id-"));
    const bin = join(dir, "cli.mjs");
    writeFileSync(bin, readFileSync(fakeCli));
    chmodSync(bin, 0o755);
    const digest = sha256(bin);
    let hashes = 0;
    const hashFile = (path: string): string => {
      hashes += 1;
      return sha256(path);
    };
    const events: AuditEvent[] = [];
    const audit: AuditSink = {
      record(event) {
        events.push(event);
        return { id: `aud_${events.length}` };
      }
    };
    const opts: ByoaProviderOptions = {
      provider: "cursor_cli",
      model: "claude-fable-5",
      expectedFamily: "claude",
      familyOf: familyFromModelName,
      profile: "default",
      audit,
      binaryPath: bin,
      binaryIdentity: { path: bin, digest },
      hashFile,
      networkRetryLimit: 0,
      wallTimeoutMs: 8_000
    };
    configureRuntimeChildRegistry(dir);
    const provider = createByoaProvider(opts);
    await provider.chat({ messages: [{ role: "user", content: "ok" }] });
    expect(hashes).toBe(1);
    resetByoaLifecycleForTests();
    try {
      resetRuntimeChildLifecycleForTests();
    } catch {
      // 上一发若未收口,不得挡住第二次身份核验
    }
    const before = statSync(bin);
    const tampered = Buffer.from(readFileSync(bin));
    tampered[tampered.length - 1] = (tampered[tampered.length - 1] ?? 0) ^ 0xff;
    writeFileSync(bin, tampered);
    utimesSync(bin, before.atimeMs / 1000, before.mtimeMs / 1000);
    const restored = statSync(bin);
    expect(restored.size).toBe(before.size);
    expect(restored.mtimeMs).toBe(before.mtimeMs);
    const second = await provider.chat({ messages: [{ role: "user", content: "ok" }] });
    expect(second).toMatchObject({ ok: false, code: "binary_identity_mismatch" });
    expect(hashes).toBe(2);
    expect(checkBinaryIdentity(bin, { path: bin, digest }, familyFromModelName, "claude", { forceRehash: true })).toMatchObject({
      ok: false,
      code: "digest_mismatch"
    });
    rmSync(dir, { recursive: true, force: true });
  });
});
