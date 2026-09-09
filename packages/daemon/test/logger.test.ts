import { mkdirSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createLogger } from "../src/obs/logger.js";
import { AuditWriteError, createFileAuditSink } from "../src/obs/audit.js";

describe("logger (E3 JSONL 底座)", () => {
  it("写出可解析的 JSONL 且人读行走 stderr 回调", async () => {
    const dir = mkdtempSync(join(tmpdir(), "saydo-log-"));
    const lines: string[] = [];
    const log = createLogger({
      dir,
      name: "t",
      now: () => new Date("2026-07-24T00:00:00Z"),
      stderrWrite: (l) => lines.push(l)
    });
    log.info("hello", { taskId: "tsk_1" });
    log.child({ runId: "r1" }).warn("careful", {});
    await log.flush();

    const file = join(dir, "t-20260724.jsonl");
    const rows = readFileSync(file, "utf8").trim().split("\n").map((l) => JSON.parse(l));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ level: "info", msg: "hello", taskId: "tsk_1" });
    expect(rows[1]).toMatchObject({ level: "warn", msg: "careful", runId: "r1" });
    expect(lines[0]).toContain('level=info msg="hello"');
    // 人读行禁 pictographic:纯 ASCII + 键值
    expect(lines.join("")).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });
});

describe("audit sink (0.1 文件形态)", () => {
  it("append-only 且带 actor/id/ts", () => {
    const dir = mkdtempSync(join(tmpdir(), "saydo-audit-"));
    const file = join(dir, "audit.jsonl");
    const sink = createFileAuditSink(file, () => new Date("2026-07-24T00:00:00Z"));
    const { id } = sink.record({ actor: "daemon", action: "test.event", refDigest: "sha256:x" });
    expect(id).toMatch(/^aud_/);
    const rows = readFileSync(file, "utf8").trim().split("\n").map((l) => JSON.parse(l));
    expect(rows[0]).toMatchObject({ actor: "daemon", action: "test.event", refDigest: "sha256:x" });
    expect(readdirSync(dir)).toEqual(["audit.jsonl"]);
  });
});

describe("logger 背压隔离(GAP-02 2.8:日志可降级、审计不可)", () => {
  const enospc = () => Object.assign(new Error("no space"), { code: "ENOSPC" });

  it("注入写失败后业务调用不抛,writeFailures 递增、degraded 可见;恢复成功写后 degraded 回落", async () => {
    let fail = true;
    const written: string[] = [];
    const log = createLogger({
      dir: mkdtempSync(join(tmpdir(), "saydo-log-bp-")),
      name: "bp",
      flushOnExit: false,
      stderrWrite: () => {},
      appendImpl: async (_p, data) => {
        if (fail) throw enospc();
        written.push(data);
      }
    });
    expect(() => log.info("a")).not.toThrow();
    expect(() => log.child({ k: 1 }).error("b")).not.toThrow();
    await log.flush();
    const h1 = log.health();
    expect(h1.writeFailures).toBeGreaterThanOrEqual(1);
    expect(h1.degraded).toBe(true);
    expect(h1.lastError).toBe("ENOSPC");
    expect(h1.queued).toBe(0);
    fail = false;
    log.info("c");
    await log.flush();
    expect(log.health().degraded).toBe(false);
    expect(written.join("")).toContain('"msg":"c"');
  });

  it("有界队列:写端阻塞时超出上限的行被丢弃并计数,不无限增长;排空后 overflow 解除", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => {
      release = r;
    });
    let calls = 0;
    const log = createLogger({
      dir: mkdtempSync(join(tmpdir(), "saydo-log-q-")),
      name: "q",
      flushOnExit: false,
      maxQueue: 3,
      stderrWrite: () => {},
      appendImpl: async () => {
        calls += 1;
        if (calls === 1) await gate;
      }
    });
    log.info("first"); // 立即进入 drain,卡在 gate;写完前仍占队列一格
    for (let i = 0; i < 5; i++) log.info(`q${i}`); // first + 2 条排队 = 上限 3,其余 3 条溢出
    const mid = log.health();
    expect(mid.queued).toBe(3);
    expect(mid.dropped).toBe(3);
    expect(mid.degraded).toBe(true);
    release();
    await log.flush();
    const after = log.health();
    expect(after.queued).toBe(0);
    expect(after.dropped).toBe(3);
    expect(after.degraded).toBe(false);
  });

  it("stderr 写失败同样不冒进业务调用栈", () => {
    const log = createLogger({
      dir: mkdtempSync(join(tmpdir(), "saydo-log-se-")),
      name: "se",
      flushOnExit: false,
      stderrWrite: () => {
        throw Object.assign(new Error("broken pipe"), { code: "EPIPE" });
      },
      appendImpl: async () => {}
    });
    expect(() => log.warn("x")).not.toThrow();
  });

  it("审计 sink 写失败仍同步抛 AuditWriteError(不降级、不丢),失败钩子可见 code", () => {
    const dir = mkdtempSync(join(tmpdir(), "saydo-audit-fail-"));
    // 用目录占住审计文件路径 ⇒ appendFileSync EISDIR
    const file = join(dir, "audit.jsonl");
    mkdirSync(file);
    const seen: string[] = [];
    const sink = createFileAuditSink(file, () => new Date("2026-09-09T00:00:00Z"), {
      onWriteFailure: (code) => seen.push(code)
    });
    expect(() => sink.record({ actor: "daemon", action: "test.event" })).toThrow(AuditWriteError);
    expect(seen).toEqual(["EISDIR"]);
  });
});
