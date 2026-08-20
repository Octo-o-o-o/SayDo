// §12-7 Tier1 子集(0.3 验收):真实子进程 kill -9 注入 -> 重启扫描 -> 原 idemKey 重放收敛。
// G2(跨边界事务幂等)的 0.3 基元级证据;完整 Tier1 恢复随 4.x,跨域半边随 P0.5-B。

import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { openDb } from "../src/storage/db.js";
import {
  completeDispatchBinding,
  scanInflightBindings,
  scanInterruptedTier1Runs,
  scanUnconfirmedCommands,
  transitionHopperCommand,
  beginDispatchBinding
} from "../src/storage/dao/dispatch.js";
import { transitionTier1Run } from "../src/storage/dao/tasks.js";

const CHILD = resolve(__dirname, "fixtures/crash-child.ts");
const TSX = resolve(__dirname, "../node_modules/.bin/tsx");

function crashWith(scenario: string): string {
  const dbPath = join(mkdtempSync(join(tmpdir(), "saydo-crash-")), "saydo.db");
  try {
    execFileSync(TSX, [CHILD, dbPath, scenario], { stdio: "pipe" });
    throw new Error("child should have been SIGKILLed");
  } catch (err) {
    // 直接被信号杀:signal=SIGKILL;tsx 内部转发时:status=137(128+9)。两者都算硬杀成功。
    const e = err as { signal?: string | null; status?: number | null };
    const killed = e.signal === "SIGKILL" || e.status === 137;
    expect(killed).toBe(true);
  }
  return dbPath;
}

describe("§12-7 崩溃注入(kill -9)", () => {
  it("dispatch binding:阶段一后崩溃 -> 扫描到 in-flight -> 重放回填收敛;重复 idemKey 拒", () => {
    const dbPath = crashWith("binding");
    const db = openDb(dbPath);

    const inflight = scanInflightBindings(db);
    expect(inflight).toHaveLength(1);
    expect(inflight[0]?.idempotencyKey).toBe("idem-crash-1");
    expect(inflight[0]?.dropOutcome).toBeUndefined();

    // 重放:同 idemKey 的重复 INSERT 被 UNIQUE 拒(不产生第二条 dispatch)
    expect(() =>
      beginDispatchBinding(db, {
        voiceTaskId: "tsk_01JD9WYX0000000000000000ZZ",
        dispatchId: "dsp_01JD9WYX0000000000000000ZY",
        idempotencyKey: "idem-crash-1",
        packageDigest: "sha256:" + "a".repeat(64),
        mode: "step_confirm",
        createdAt: "2026-07-24T00:00:01Z"
      })
    ).toThrow(/UNIQUE/);

    // 重放完成(副作用以原 key 幂等重发后)回填 outcome -> 不再 in-flight
    completeDispatchBinding(db, "tsk_01JD9WYX0000000000000000AA", "created");
    expect(scanInflightBindings(db)).toHaveLength(0);
    // 二次回填拒(已完成)
    expect(() => completeDispatchBinding(db, "tsk_01JD9WYX0000000000000000AA", "created")).toThrow(/already completed/);
  });

  it("hopper command journal:sent 后崩溃 -> 扫描 != confirmed -> confirm 收敛", () => {
    const dbPath = crashWith("command");
    const db = openDb(dbPath);

    const pendingCmds = scanUnconfirmedCommands(db);
    expect(pendingCmds).toHaveLength(1);
    expect(pendingCmds[0]).toMatchObject({ op: "cancel", state: "sent", idemKey: "idem-crash-cmd-1" });

    transitionHopperCommand(db, pendingCmds[0]!.id, "confirmed", "2026-07-24T00:00:02Z");
    expect(scanUnconfirmedCommands(db)).toHaveLength(0);
  });

  it("tier1_runs:running 中崩溃 -> 扫描到中断 run(含恢复钥匙)-> 恢复/降级转移", () => {
    const dbPath = crashWith("tier1");
    const db = openDb(dbPath);

    const interrupted = scanInterruptedTier1Runs(db);
    expect(interrupted).toHaveLength(1);
    // 恢复钥匙三元组(04 §6 / §12-7):(adapter, nativeSessionId, cwd)
    expect(interrupted[0]).toMatchObject({ adapter: "cursor", nativeSessionId: "chat-123", cwd: "/tmp/wt" });

    // 恢复失败的降级路径:settled_failed(4.x 全链;此处验证状态机可收敛)
    transitionTier1Run(db, interrupted[0]!.id, "settled_failed", "2026-07-24T00:00:03Z");
    expect(scanInterruptedTier1Runs(db)).toHaveLength(0);
  });
});
