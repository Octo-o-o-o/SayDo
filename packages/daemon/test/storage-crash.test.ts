// §12-7 Tier1 子集(0.3 验收):真实子进程 kill -9 注入 -> 重启读取 -> 恢复钥匙与降级状态持久化。
// 验证真实硬杀后的恢复钥匙持久性及现役 DAO 降级转移；不代表完整执行器恢复验收。

import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { wasHardKilled } from "./helpers/hardKill.js";
import { openDb } from "../src/storage/db.js";
import { getTier1Run, transitionTier1Run } from "../src/storage/dao/tasks.js";

const CHILD = resolve(__dirname, "fixtures/crash-child.ts");
const TSX = resolve(__dirname, "../node_modules/tsx/dist/cli.mjs");

function crashWith(scenario: string): string {
  const dbPath = join(mkdtempSync(join(tmpdir(), "saydo-crash-")), "saydo.db");
  try {
    execFileSync(process.execPath, [TSX, CHILD, dbPath, scenario], { stdio: "pipe" });
    throw new Error("child should have been SIGKILLed");
  } catch (err) {
    expect(wasHardKilled(err)).toBe(true);
  }
  return dbPath;
}

describe("§12-7 崩溃注入(kill -9)", () => {
  it("tier1_runs:running 中崩溃 -> 扫描到中断 run(含恢复钥匙)-> 恢复/降级转移", () => {
    const dbPath = crashWith("tier1");
    const db = openDb(dbPath);

    const interrupted = db.prepare("SELECT id FROM tier1_runs WHERE state = 'running'").all() as { id: string }[];
    expect(interrupted).toHaveLength(1);
    // 恢复钥匙三元组(04 §6 / §12-7):(adapter, nativeSessionId, cwd)
    expect(getTier1Run(db, interrupted[0]!.id)).toMatchObject({ adapter: "cursor", nativeSessionId: "chat-123", cwd: "/tmp/wt" });

    // 恢复失败的降级路径:settled_failed(4.x 全链;此处验证状态机可收敛)
    transitionTier1Run(db, interrupted[0]!.id, "settled_failed", "2026-07-24T00:00:03Z");
    expect(getTier1Run(db, interrupted[0]!.id)?.state).toBe("settled_failed");
  });
});
