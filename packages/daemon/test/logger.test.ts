import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createLogger } from "../src/obs/logger.js";
import { createFileAuditSink } from "../src/obs/audit.js";

describe("logger (E3 JSONL 底座)", () => {
  it("写出可解析的 JSONL 且人读行走 stderr 回调", () => {
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
