// 价值证据轨周报(05 §价值证据轨,owner 2026-07-24 方案 B;场次② 起挂,P0.5 收尾第二锚点)。
// W1.5 增量:北极星② proxy(主动人类分钟)+ 两个手工字段(自报分钟/自发选择率,承载 =
// ~/.saydo/value-manual.jsonl,POST /api/value-report/manual 写入——运行时观测文件,不入 09 DDL 契约面)
// + time-to-dispatch + "W9 触发线读数"固定栏(无数据源的读数落 0 值列位并注明,不编数)。
// 纪律:指标从既有表 SQL 出、零新建设;**建议性、只观察,不作 stop/go 门,不改 canonical 北极星**;
// 小样本不外推;unknown 恒不编数(分母为 0 时该项显示"还没有数据",不显示 0%)。

import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Db } from "../storage/db.js";

export interface ValueReport {
  asOf: string;
  windowDays: number;
  metrics: { name: string; value: string; raw?: Record<string, number> }[];
  /** W9 触发线读数(PLAN-2 W9 表;达线项由设计库会话立项——本栏只报数不裁决) */
  triggerReadings: { name: string; value: string; threshold: string; note?: string }[];
  gapsInInstrumentation: string[];
}

export interface ManualEntry {
  /** 归属日(YYYY-MM-DD;owner 自报) */
  day: string;
  /** 主动人类分钟自报(说+打字+判断+审批+review+返工,05 北极星② 分子的人工部分) */
  minutesSelfReported?: number;
  /** 自发选择率:窗口内"适用机会"总数与实际使用数(05 手工字段②) */
  opportunitiesSeen?: number;
  opportunitiesUsed?: number;
  note?: string;
  recordedAt: string;
}

const MANUAL_FILE = "value-manual.jsonl";

/** 手工字段写入(POST /api/value-report/manual;追加式 JSONL,坏行读取时跳过) */
export function appendManualEntry(saydoHome: string, entry: Omit<ManualEntry, "recordedAt">, nowIso: string): ManualEntry {
  const day = String(entry.day ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("manual entry day must be YYYY-MM-DD");
  const full: ManualEntry = { ...entry, day, recordedAt: nowIso };
  appendFileSync(join(saydoHome, MANUAL_FILE), JSON.stringify(full) + "\n");
  return full;
}

export function readManualEntries(saydoHome: string, sinceIso: string): ManualEntry[] {
  let text: string;
  try {
    text = readFileSync(join(saydoHome, MANUAL_FILE), "utf8");
  } catch {
    return [];
  }
  const out: ManualEntry[] = [];
  const sinceDay = sinceIso.slice(0, 10);
  for (const line of text.split("\n")) {
    if (line.trim() === "") continue;
    try {
      const e = JSON.parse(line) as ManualEntry;
      if (typeof e.day === "string" && e.day >= sinceDay) out.push(e);
    } catch {
      continue; // 坏行跳过(手填文件,读取面宽容;写入面已校验)
    }
  }
  return out;
}

function pct(n: number, d: number): string {
  return d === 0 ? "还没有数据" : `${((n / d) * 100).toFixed(1)}%(${n}/${d})`;
}

function minutes(ms: number): number {
  return Math.round(ms / 60_000);
}

/** 零成本 SQL 周报(窗口默认 7 天;全部指标可在空库上跑,不炸不编数) */
export function buildValueReport(db: Db, nowIso: string, windowDays = 7, opts: { saydoHome?: string } = {}): ValueReport {
  const since = new Date(Date.parse(nowIso) - windowDays * 86_400_000).toISOString();
  const one = (sql: string, ...args: unknown[]): number =>
    ((db.prepare(sql).get(...args) as Record<string, number> | undefined)?.["c"] as number) ?? 0;

  // 双北极星 proxy ①:verified outcome rate = task_done / eligible dispatch(intent-to-treat:含 failed/cancel/停靠老化)
  const eligible = one("SELECT COUNT(*) AS c FROM tasks WHERE created_at >= ?", since);
  const done = one("SELECT COUNT(*) AS c FROM tasks WHERE created_at >= ? AND status = 'task_done'", since);

  // first-pass acceptance / 返工率(attempt>1)
  const tasksWithRuns = one("SELECT COUNT(DISTINCT task_id) AS c FROM tier1_runs WHERE created_at >= ?", since);
  const reworked = one(
    "SELECT COUNT(*) AS c FROM (SELECT task_id FROM tier1_runs WHERE created_at >= ? GROUP BY task_id HAVING MAX(attempt) > 1)",
    since
  );

  // 包修改率(revision>1)
  const pkgs = one("SELECT COUNT(DISTINCT id) AS c FROM decision_packages WHERE created_at >= ?", since);
  const revised = one(
    "SELECT COUNT(*) AS c FROM (SELECT id FROM decision_packages WHERE created_at >= ? GROUP BY id HAVING MAX(revision) > 1)",
    since
  );

  // readiness shadow 样本 + outcome 分布(false-ready 原始计数,不外推)
  const shadow = one("SELECT COUNT(*) AS c FROM readiness_assessments WHERE created_at >= ?", since);
  const shadowOverturned = one(
    "SELECT COUNT(*) AS c FROM readiness_assessments WHERE created_at >= ? AND outcome = 'overturned'",
    since
  );

  // 回叫接通率(notified -> acked)与 ack->resolve
  const notified = one("SELECT COUNT(*) AS c FROM callback_outbox WHERE created_at >= ? AND notified_at IS NOT NULL", since);
  const acked = one("SELECT COUNT(*) AS c FROM callback_outbox WHERE created_at >= ? AND acked_at IS NOT NULL", since);
  const resolved = one("SELECT COUNT(*) AS c FROM callback_outbox WHERE created_at >= ? AND resolved_at IS NOT NULL", since);

  // time-to-dispatch(05 矩阵):包创建 -> 任务入队,窗口内均值分钟(同 package 关联;无样本不编数)
  const ttd = db
    .prepare(
      `SELECT AVG((julianday(t.created_at) - julianday(p.created_at)) * 1440.0) AS avg_min, COUNT(*) AS c
       FROM tasks t JOIN decision_packages p ON p.id = t.package_id AND p.revision = t.package_rev
       WHERE t.created_at >= ?`
    )
    .get(since) as { avg_min: number | null; c: number };

  // 每 outcome 成本(仅 api 行;订阅只计次数,07 D18)。分币种合计(Hopper 行是 USD,混计即编数)
  const costRows = db
    .prepare("SELECT currency, SUM(amount) AS s FROM cost_entries WHERE ts >= ? AND known = 1 AND source = 'api' GROUP BY currency")
    .all(since) as { currency: string | null; s: number | null }[];
  const apiCostStr =
    costRows.length === 0
      ? "还没有确切数字"
      : costRows.map((r) => `${(r.s ?? 0).toFixed(2)} ${r.currency ?? "?"}`).join(" + ");
  const subCalls = one("SELECT COUNT(*) AS c FROM cost_entries WHERE ts >= ? AND source = 'subscription'", since);

  // S2 次数/任务(审批负担)
  const s2 = one("SELECT COUNT(*) AS c FROM approvals WHERE issued_at >= ? AND risk = 'S2'", since);

  // 误听纠正次数(热词写入,10 #9 -> M0 hotword 事件)
  const corrections = one(
    "SELECT COUNT(*) AS c FROM memory_events WHERE ts >= ? AND op = 'add' AND tier = 'M0' AND claim LIKE '%热词%'",
    since
  );

  // 无派单但经确认沉淀(05 矩阵):trusted 记忆写入 vs 任务创建并列计数(占比待会话<->记忆关联,不编分母)
  const trustedMem = one(
    "SELECT COUNT(*) AS c FROM memory_events WHERE ts >= ? AND op IN ('add','correct') AND trust IN ('user_stated','user_approved')",
    since
  );

  // 会话数 / 车道占比(sessions.lane 埋点;未填=unknown 如实)
  const sessions = one("SELECT COUNT(*) AS c FROM sessions WHERE started_at >= ?", since);
  const lanes = db
    .prepare("SELECT COALESCE(lane,'unknown') AS lane, COUNT(*) AS c FROM sessions WHERE started_at >= ? GROUP BY lane")
    .all(since) as { lane: string; c: number }[];
  const laneStr = lanes.length === 0 ? "还没有数据" : lanes.map((l) => `${l.lane}:${l.c}`).join(" ");

  // ---- 北极星② proxy:主动人类分钟 / verified outcome(05:说+打字+判断+审批+review+返工全进分子)
  // 机器组分:会话时长(ended 会话)+ 审批等待(decided-issued);手工组分:自报分钟(manual 文件)。
  // review 跨度暂无独立时刻源(ready_for_review -> review 决策的时间差需 audit 关联),如实入 gap。
  const sessionMs = db
    .prepare(
      `SELECT SUM((julianday(ended_at) - julianday(started_at)) * 86400000.0) AS s
       FROM sessions WHERE started_at >= ? AND ended_at IS NOT NULL`
    )
    .get(since) as { s: number | null };
  const approvalMs = db
    .prepare(
      `SELECT SUM((julianday(decided_at) - julianday(issued_at)) * 86400000.0) AS s
       FROM approvals WHERE issued_at >= ? AND decided_at IS NOT NULL`
    )
    .get(since) as { s: number | null };
  const manual = opts.saydoHome ? readManualEntries(opts.saydoHome, since) : [];
  const manualMinutes = manual.reduce((a, e) => a + (typeof e.minutesSelfReported === "number" ? e.minutesSelfReported : 0), 0);
  const machineMinutes = minutes((sessionMs.s ?? 0) + (approvalMs.s ?? 0));
  const humanMinutes = machineMinutes + manualMinutes;
  const nsProxy2 =
    done === 0
      ? `还没有 verified outcome(累计人类分钟 ${humanMinutes}:机器侧 ${machineMinutes} + 自报 ${manualMinutes})`
      : `${(humanMinutes / done).toFixed(1)} 分钟/outcome(人类分钟 ${humanMinutes} / done ${done};机器侧 ${machineMinutes} + 自报 ${manualMinutes})`;

  // 手工字段②:自发选择率(适用机会用没用)
  const oppSeen = manual.reduce((a, e) => a + (typeof e.opportunitiesSeen === "number" ? e.opportunitiesSeen : 0), 0);
  const oppUsed = manual.reduce((a, e) => a + (typeof e.opportunitiesUsed === "number" ? e.opportunitiesUsed : 0), 0);

  // ---- W9 触发线读数(累计口径,非窗口;PLAN-2 W9 表——只报数不裁决)
  const shadowTotal = one("SELECT COUNT(*) AS c FROM readiness_assessments");
  const correctionsTotal = one(
    "SELECT COUNT(*) AS c FROM memory_events WHERE op = 'add' AND tier = 'M0' AND claim LIKE '%热词%'"
  );
  const callbackNotifiedTotal = one("SELECT COUNT(*) AS c FROM callback_outbox WHERE notified_at IS NOT NULL");
  const callbackAckedTotal = one("SELECT COUNT(*) AS c FROM callback_outbox WHERE acked_at IS NOT NULL");
  const triggerReadings: ValueReport["triggerReadings"] = [
    {
      name: "readiness shadow 样本(累计)",
      value: String(shadowTotal),
      threshold: ">=200 -> 就绪评估器四维扩展 + false-ready 校准(独立小批)"
    },
    {
      name: "ASR golden 语料计数(纠错事件累计;人工标注条目在 e2e/golden/asr-regression.mjs 仓内资产,另计)",
      value: String(correctionsTotal),
      threshold: "累计 300-500 条 -> 7.6 第二家对比门禁(挂 OpenAI key)"
    },
    {
      name: "回叫撞车数",
      value: "0",
      threshold: "一周 >=2 次 或 并发 >=3 常态 -> W6 黑板显式化+聚合完整版(§6-12)",
      note: "无数据源(撞车 = 多任务同时回叫抢占,需 outbox 并发窗口检测)——0 值列位,埋点随 W6 前置观察"
    },
    {
      name: "检索 miss 数",
      value: "0",
      threshold: "有记录证据 -> 5.7 sqlite-vec(§6-7)",
      note: "无数据源(miss = 用户纠正检索结果的事件,需检索反馈埋点)——0 值列位,不编数"
    },
    {
      name: "回叫接通率(累计;电话形态解锁触发线的数据成分)",
      value: pct(callbackAckedTotal, callbackNotifiedTotal),
      threshold: "场次②/③ dogfood 1-2 周 + 离机缺口体感 + 接通率/离机时段数据 -> 电话 Phase 0 spike(锁定计划 v3)"
    },
    {
      name: "离机时段占比",
      value: "0",
      threshold: "同上(电话形态解锁的数据成分)",
      note: "无数据源(需在机/离机检测,如屏幕活动或推送响应延迟代理)——0 值列位,不编数"
    }
  ];

  const gaps: string[] = [];
  if (sessions > 0 && lanes.every((l) => l.lane === "unknown")) gaps.push("lane 全为 unknown:Quick 直通/采访路径需回填 lane(dogfood 起)");
  if (shadow === 0) gaps.push("readiness shadow 无样本(深评未跑或 outcome 未回填)");
  if (eligible > 0 && notified === 0) gaps.push("有任务但零回叫记录(检查 outbox 接线)");
  if (manual.length === 0) gaps.push("手工字段零登记:POST /api/value-report/manual(day/minutesSelfReported/opportunitiesSeen/opportunitiesUsed)——owner 场次② 起自报");
  gaps.push("北极星② review 跨度组分未计(ready_for_review -> review 决策时刻需 audit 关联,dogfood 期接)");

  return {
    asOf: nowIso,
    windowDays,
    metrics: [
      { name: "verified outcome rate(北极星① proxy,intent-to-treat)", value: pct(done, eligible), raw: { done, eligible } },
      { name: "主动人类分钟/outcome(北极星② proxy;建议性只观察)", value: nsProxy2, raw: { humanMinutes, machineMinutes, manualMinutes, done } },
      { name: "自发选择率(手工字段:适用机会用没用)", value: pct(oppUsed, oppSeen) },
      { name: "first-pass acceptance(首跑无返工)", value: pct(tasksWithRuns - reworked, tasksWithRuns) },
      { name: "返工率(attempt>1)", value: pct(reworked, tasksWithRuns) },
      { name: "包修改率(revision>1)", value: pct(revised, pkgs) },
      { name: "readiness shadow 样本 / overturned(窗口内原始计数,不外推)", value: shadow === 0 ? "还没有数据" : `${shadow} 条 / overturned ${shadowOverturned}` },
      { name: "time-to-dispatch(包创建->任务入队,均值)", value: ttd.c === 0 ? "还没有数据" : `${(ttd.avg_min ?? 0).toFixed(1)} 分钟(n=${ttd.c})` },
      { name: "回叫接通率(notified->acked)", value: pct(acked, notified) },
      { name: "回叫解决率(->resolved)", value: pct(resolved, notified) },
      { name: "api 成本(known 行,分币种)", value: apiCostStr },
      { name: "订阅调用次数", value: String(subCalls) },
      { name: "S2 审批次数(窗口内 / 每任务)", value: eligible === 0 ? String(s2) : `${s2} / ${(s2 / eligible).toFixed(1)} 次每任务` },
      { name: "误听纠正(热词写入)次数", value: String(corrections) },
      { name: "trusted 记忆写入 vs 任务创建(沉淀并列计数;占比待会话关联)", value: `${trustedMem} vs ${eligible}` },
      { name: "会话数 / 车道占比", value: `${sessions} / ${laneStr}` }
    ],
    triggerReadings,
    gapsInInstrumentation: gaps
  };
}

/** markdown 渲染(挂 console/评审用;11 §8 纪律:纯文本,无 emoji) */
export function renderValueReportMd(r: ValueReport): string {
  const lines = [
    `# SayDo 价值证据轨周报(${r.asOf.slice(0, 10)},近 ${r.windowDays} 天)`,
    "",
    "> 建议性证据,不作 stop/go 门;小样本不外推;unknown 不编数(05 §价值证据轨)。",
    "",
    "| 指标 | 值 |",
    "|---|---|",
    ...r.metrics.map((m) => `| ${m.name} | ${m.value} |`),
    "",
    "## W9 触发线读数(只报数不裁决;达线项由设计库会话立项)",
    "",
    "| 读数 | 当前值 | 触发线 |",
    "|---|---|---|",
    ...r.triggerReadings.map((t) => `| ${t.name}${t.note ? `(${t.note})` : ""} | ${t.value} | ${t.threshold} |`),
    "",
    "## 埋点齐备性",
    "",
    ...r.gapsInInstrumentation.map((g) => `- [gap] ${g}`)
  ];
  return lines.join("\n");
}
