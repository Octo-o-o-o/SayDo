// BYOA 安全门必须每次真算:mtime/size 缓存不得挡住 spawn 前身份核验。
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync, type Stats } from "node:fs";
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
const tamperCli = fileURLToPath(new URL("./fixtures/fake-byoa-tamper-cli.mjs", import.meta.url));

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
    // 时间戳锚定整秒:Linux 纳秒 mtime 经 utimesSync(浮点秒) 往返有精度损失,非整秒值恢复后
    // mtimeMs 不再严格相等,"同 mtime/size 替换"反例就构造不出来(缓存判据是全精度 ===)。
    const anchorSec = Math.floor(Date.now() / 1000) - 60;
    utimesSync(bin, anchorSec, anchorSec);
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
      code: "digest_mismatch",
      actualDigest: sha256(bin)
    });
    // 拿不到判定当次的摘要就只能空着;调用方不许事后重读补一个,那已是另一个快照。
    rmSync(bin, { force: true });
    expect(checkBinaryIdentity(bin, identity, familyOf, "claude", { forceRehash: true })).toEqual({
      ok: false,
      code: "unreadable"
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
    // 整秒锚:同上,保证 utimesSync 恢复在 Linux 上也精确命中缓存判据的全精度相等
    const anchorSec = Math.floor(Date.now() / 1000) - 60;
    utimesSync(bin, anchorSec, anchorSec);
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

  // 第一发在退出前把自身按同 mtime/size 换掉:缓存判据看不出差别,只有 spawn 前 forceRehash 拦得住。
  // 注入的哈希实现对"非原始内容"返回哨兵值:审计若不是复用核验当次的结果、而是事后重读文件,
  // 记下的就会是真实摘要而不是哨兵,断言随即红。
  const TAMPERED_DIGEST_SENTINEL = "b".repeat(64);

  async function chatWithSelfSwappingCli(
    content: string,
    networkRetryLimit: 0 | 1,
    options: { throwOnBilling?: boolean } = {}
  ): Promise<{
    result: Awaited<ReturnType<ReturnType<typeof createByoaProvider>["chat"]>>;
    events: AuditEvent[];
    hashes: number;
    billed: Array<{ requests: number }>;
    tamperedExecuted: boolean;
    digest: string;
    before: Stats;
    after: Stats;
    swapped: string;
  }> {
    const dir = mkdtempSync(join(tmpdir(), "saydo-byoa-respawn-"));
    const bin = join(dir, "cli.mjs");
    writeFileSync(bin, readFileSync(tamperCli));
    chmodSync(bin, 0o755);
    // 整秒锚:fixture 的 swapSelf 用 utimesSync(atimeMs/1000, mtimeMs/1000) 恢复时间戳,
    // 只有整秒基值在 Linux 纳秒时间戳下往返无精度损失(缓存判据是全精度 ===)。
    const swapAnchorSec = Math.floor(Date.now() / 1000) - 60;
    utimesSync(bin, swapAnchorSec, swapAnchorSec);
    const digest = sha256(bin);
    const before = statSync(bin);
    let hashes = 0;
    const events: AuditEvent[] = [];
    const billed: Array<{ requests: number }> = [];
    const opts: ByoaProviderOptions = {
      provider: "cursor_cli",
      model: "claude-fable-5",
      expectedFamily: "claude",
      familyOf: familyFromModelName,
      profile: "default",
      audit: {
        record(event) {
          events.push(event);
          return { id: `aud_${events.length}` };
        }
      },
      binaryPath: bin,
      binaryIdentity: { path: bin, digest },
      hashFile: (path: string): string => {
        hashes += 1;
        const actual = sha256(path);
        return actual === digest ? actual : TAMPERED_DIGEST_SENTINEL;
      },
      onSubscriptionInvocation: (invocation) => {
        billed.push({ requests: invocation.requests });
        if (options.throwOnBilling === true) throw new Error("ledger write failed");
      },
      networkRetryLimit,
      wallTimeoutMs: 8_000
    };
    configureRuntimeChildRegistry(dir);
    const result = await createByoaProvider(opts).chat({ messages: [{ role: "user", content }] });
    const after = statSync(bin);
    const swapped = sha256(bin);
    const tamperedExecuted = existsSync(`${bin}.executed`);
    rmSync(dir, { recursive: true, force: true });
    return { result, events, hashes, billed, tamperedExecuted, digest, before, after, swapped };
  }

  function expectBlockedSecondSpawn(run: Awaited<ReturnType<typeof chatWithSelfSwappingCli>>): void {
    expect(run.after.size).toBe(run.before.size);
    expect(run.after.mtimeMs).toBe(run.before.mtimeMs);
    expect(run.swapped).not.toBe(run.digest);
    // 被换上的二进制连进程都没起过:执行痕迹不存在,产物也没下发。
    expect(run.tamperedExecuted).toBe(false);
    expect(JSON.stringify(run.result)).not.toContain("TAMPERED-BINARY-EXECUTED");
    expect(run.result).toMatchObject({ ok: false, code: "binary_identity_mismatch" });
    // 每发各真算一次(hashes 计的是注入的哈希实现被调用的次数)。
    expect(run.hashes).toBe(2);
    // 被拦下的那一发没有起进程:不记 byoa.invocation、不计订阅调用、不进 attempts 口径。
    const invocations = run.events.filter((event) => event.action === "byoa.invocation");
    expect(invocations).toHaveLength(1);
    expect(invocations[0]?.meta).toMatchObject({ attempt: 1, attempts: 1 });
    expect(run.billed).toEqual([{ requests: 1 }]);
    // 审计里的 actualBinaryDigest 必须来自核验当次算出的值,不是事后重读到的另一版。
    const rejected = run.events.filter((event) => event.action === "provider.cli_runtime_rejected");
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({
      meta: {
        provider: "cursor_cli",
        reason: "binary_identity_mismatch",
        registeredBinaryDigest: run.digest,
        actualBinaryDigest: TAMPERED_DIGEST_SENTINEL
      }
    });
  }

  it("同一次 chat 内网络重试:第二次 spawn 前必须重验身份(L-1)", async () => {
    expectBlockedSecondSpawn(await chatWithSelfSwappingCli("ok", 1));
  });

  it("同一次 chat 内 tripwire 强化重试:第二次 spawn 前必须重验身份(L-1)", async () => {
    expectBlockedSecondSpawn(await chatWithSelfSwappingCli("tamper-tripwire", 0));
  });

  it("身份漂移与记账失败同时发生时,下发不可重试的身份失败", async () => {
    const run = await chatWithSelfSwappingCli("tamper-evidence", 1, { throwOnBilling: true });
    expectBlockedSecondSpawn(run);
    // cost_ledger_failed 是 retryable,拿它当处方等于让调用方再去跑一遍已被换掉的二进制。
    expect(run.result).toMatchObject({ ok: false, code: "binary_identity_mismatch", retryable: false });
    const accounting = run.events.filter((event) => event.action === "byoa.subscription_accounting_failed");
    expect(accounting).toHaveLength(1);
    expect(accounting[0]?.meta).toMatchObject({ attempts: 1 });
    // 记账证据必须是真起过进程那一发的,不是被拦下那一发的空结果。
    const invocation = run.events.find((event) => event.action === "byoa.invocation");
    expect(invocation?.refDigest).toBeTruthy();
    expect(accounting[0]?.refDigest).toBe(invocation?.refDigest);
  });
});
