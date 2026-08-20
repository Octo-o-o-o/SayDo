// 4.2 验收:三熔断(活跃墙钟停表/回合/成本)+ S2 打断即作废 + 停靠老化 72h。

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { TaskCard } from "@saydo/contracts";
import { openDb, type Db } from "../src/storage/db.js";
import { CircuitBreakers, parkDeadlineFrom, isParkExpired } from "../src/approvals/circuitBreakers.js";
import { PresentationStore } from "../src/approvals/presentation.js";
import { ageOutParkedTasks } from "../src/approvals/parkAging.js";
import { insertProject } from "../src/storage/dao/projects.js";
import { managedProjectPath } from "../src/projects/workspace.js";
import { insertTask } from "../src/storage/dao/tasks.js";
import type { AuditSink } from "../src/obs/audit.js";

const nullAudit: AuditSink = { record: () => ({ id: "aud_x" }) };

describe("三熔断(04 §5.2)", () => {
  it("活跃墙钟停表:审批停靠期不计时(否则逐步确认必撞墙钟)", () => {
    let t = 0;
    const cb = new CircuitBreakers({ walltimeActiveMin: 10, maxTurns: 999, maxCost: 999 }, () => t);
    cb.resume();
    t = 5 * 60_000; // 跑 5 分钟
    cb.pause(); // 进审批停靠
    t = 60 * 60_000; // 停靠 55 分钟(不计)
    cb.resume();
    t = 60 * 60_000 + 4 * 60_000; // 再跑 4 分钟(累计活跃 9 分钟)
    expect(cb.check()).toBeNull(); // 9 < 10,未触发
    t = 60 * 60_000 + 6 * 60_000; // 再 2 分钟(活跃 11 分钟)
    expect(cb.check()).toBe("walltime");
  });

  it("回合数熔断", () => {
    const cb = new CircuitBreakers({ walltimeActiveMin: 999, maxTurns: 3, maxCost: 999 });
    cb.recordTurn();
    cb.recordTurn();
    expect(cb.check()).toBeNull();
    cb.recordTurn();
    expect(cb.check()).toBe("turns");
  });

  it("成本熔断:仅 api 计费部分(订阅调用记 0 不进 maxCost)", () => {
    const cb = new CircuitBreakers({ walltimeActiveMin: 999, maxTurns: 999, maxCost: 20 });
    cb.recordApiCost(15);
    cb.recordApiCost(0); // 订阅调用
    expect(cb.check()).toBeNull();
    cb.recordApiCost(6);
    expect(cb.check()).toBe("cost");
  });

  it("首因保留(已跳闸幂等)", () => {
    const cb = new CircuitBreakers({ walltimeActiveMin: 999, maxTurns: 1, maxCost: 1 });
    cb.recordTurn();
    cb.recordApiCost(5);
    expect(cb.check()).toBe("turns"); // turns 先于 cost 检查序
    expect(cb.check()).toBe("turns"); // 幂等保留首因
  });
});

describe("S2 打断即作废(09 §14-A8 最小版)", () => {
  const store = new PresentationStore();
  const SID = "ses_01AAAAAAAAAAAAAAAAAAAAAAAA";

  it("正常:present -> 裸肯定可消费", () => {
    store.present(SID, "apr_1", "sent_1");
    expect(store.canConsumeByBareYes(SID, "apr_1").ok).toBe(true);
  });

  it("barge_in 后失效:裸肯定不可消费,必须重播", () => {
    store.present(SID, "apr_2", "sent_2");
    store.invalidateOnBargeIn(SID, "2026-07-25T00:00:00.000Z");
    const r = store.canConsumeByBareYes(SID, "apr_2");
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("barge-in");
    // 重播后恢复
    store.replay(SID, "apr_2", "sent_2b");
    expect(store.canConsumeByBareYes(SID, "apr_2").ok).toBe(true);
  });

  it("无 presentation 或 receipt 不匹配:裸肯定不消费旧 pending", () => {
    const fresh = new PresentationStore();
    expect(fresh.canConsumeByBareYes(SID, "apr_x").ok).toBe(false);
    fresh.present(SID, "apr_3", "sent_3");
    expect(fresh.canConsumeByBareYes(SID, "apr_other").ok).toBe(false);
  });
});

describe("停靠老化 72h(09 §6.1 park_expired)", () => {
  let db: Db;
  const PRJ = "prj_01AAAAAAAAAAAAAAAAAAAAAAAA";

  beforeEach(() => {
    db = openDb(join(mkdtempSync(join(tmpdir(), "saydo-park-")), "saydo.db"));
    insertProject(db, {
      id: PRJ,
      title: "p",
      type: "coding",
      status: "active",
      workspace: { kind: "local_folder", path: managedProjectPath(PRJ), managed: true },
      executionModeDefault: "step_confirm",
      createdAt: "2026-07-20T00:00:00.000Z",
      updatedAt: "2026-07-20T00:00:00.000Z"
    });
  });

  function parkTask(id: string, status: "ready_for_review" | "blocked", parkedAt: string): void {
    const task: TaskCard = {
      id,
      projectId: PRJ,
      packageRef: { packageId: "pkg_01AAAAAAAAAAAAAAAAAAAAAAAA", revision: 1, digest: "sha256:" + "0".repeat(64) },
      title: "t",
      specMarkdown: "s",
      route: "tier1",
      adapter: "cursor",
      status: "confirmed",
      budget: { walltimeActiveMin: 45, maxTurns: 50, maxCost: 20 },
      parkedAt,
      parkedDeadline: parkDeadlineFrom(parkedAt, 72),
      updatedAt: parkedAt
    };
    insertTask(db, task, parkedAt);
    // fixture:直接置停靠态(不测转换合法性,那是 task 状态机的职责)
    db.prepare("UPDATE tasks SET status = ? WHERE id = ?").run(status, id);
  }

  it("到期停靠 ⇒ cancel_requested + park_expired;未到期不动;非停靠态不动", () => {
    parkTask("tsk_01AAAAAAAAAAAAAAAAAAAAAAAA", "ready_for_review", "2026-07-20T00:00:00.000Z"); // deadline 07-23
    parkTask("tsk_01BBBBBBBBBBBBBBBBBBBBBBBB", "blocked", "2026-07-25T00:00:00.000Z"); // deadline 07-28(未到期)

    const r = ageOutParkedTasks(db, nullAudit, "2026-07-24T00:00:00.000Z");
    expect(r.expiredTaskIds).toEqual(["tsk_01AAAAAAAAAAAAAAAAAAAAAAAA"]);
    const t1 = db.prepare("SELECT status, cancel_reason FROM tasks WHERE id=?").get("tsk_01AAAAAAAAAAAAAAAAAAAAAAAA") as {
      status: string;
      cancel_reason: string;
    };
    expect(t1.status).toBe("cancel_requested");
    expect(t1.cancel_reason).toBe("park_expired");
    const t2 = db.prepare("SELECT status FROM tasks WHERE id=?").get("tsk_01BBBBBBBBBBBBBBBBBBBBBBBB") as { status: string };
    expect(t2.status).toBe("blocked"); // 未到期不动

    // 幂等:再扫一次不重复处理(t1 已非停靠态)
    expect(ageOutParkedTasks(db, nullAudit, "2026-07-24T00:00:00.000Z").expiredTaskIds).toEqual([]);
  });

  it("isParkExpired / parkDeadlineFrom(72h)", () => {
    expect(parkDeadlineFrom("2026-07-20T00:00:00.000Z", 72)).toBe("2026-07-23T00:00:00.000Z");
    expect(isParkExpired("2026-07-23T00:00:00.000Z", "2026-07-24T00:00:00.000Z")).toBe(true);
    expect(isParkExpired("2026-07-23T00:00:00.000Z", "2026-07-22T00:00:00.000Z")).toBe(false);
  });
});
