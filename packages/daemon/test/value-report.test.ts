// 价值证据轨周报验收(05 §价值证据轨;场次② 起挂 + P0.5 收尾第二锚点):
// 零成本 SQL 出全部指标;空库不炸不编数(unknown 纪律);埋点齐备性检查如实报 gap。
// W1.5 增量:北极星② proxy + 手工字段(value-manual.jsonl)+ time-to-dispatch + W9 触发线读数栏。

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openDb } from "../src/storage/db.js";
import { seedConsoleFixture } from "../src/api/fixture.js";
import { appendManualEntry, buildValueReport, readManualEntries, renderValueReportMd } from "../src/obs/valueReport.js";

const NOW = "2026-07-25T10:00:00.000Z";

describe("价值证据轨周报", () => {
  it("空库:全指标不炸、分母 0 显示'还没有数据'(禁 0% 假精确),gap 如实", () => {
    const db = openDb(join(mkdtempSync(join(tmpdir(), "saydo-vr0-")), "saydo.db"));
    const r = buildValueReport(db, NOW);
    const star = r.metrics.find((m) => m.name.includes("verified outcome"))!;
    expect(star.value).toBe("还没有数据");
    expect(r.metrics.find((m) => m.name.includes("api 成本"))!.value).toBe("还没有确切数字");
    expect(r.gapsInInstrumentation.some((g) => g.includes("手工字段"))).toBe(true); // 主动分钟如实标机器不可得
    const md = renderValueReportMd(r);
    expect(md).toContain("不作 stop/go 门");
    expect(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(md)).toBe(false); // 11 §8 零 emoji
  });

  it("fixture 库:北极星 proxy/回叫接通率/S2 计数/车道占比出数;lane 全 unknown 报 gap", () => {
    const db = openDb(join(mkdtempSync(join(tmpdir(), "saydo-vr1-")), "saydo.db"));
    seedConsoleFixture(db);
    // 补一条会话(fixture 无 sessions;lane 未填 => unknown 档)
    db.prepare(
      "INSERT INTO sessions(id, project_id, state, engine, transcript_path, started_at, lane) VALUES ('ses_01F1XT0RE0S000000000000000','prj_01F1XT0RE0A000000000000000','closed','cascade','/tmp/t.jsonl',?,NULL)"
    ).run(NOW);
    const r = buildValueReport(db, NOW);
    const star = r.metrics.find((m) => m.name.includes("verified outcome"))!;
    expect(star.raw).toMatchObject({ done: 1, eligible: 6 }); // fixture:6 任务 1 done(intent-to-treat)
    expect(r.metrics.find((m) => m.name.includes("回叫接通率"))!.value).toContain("(0/1)"); // notified 1 未 ack
    expect(r.metrics.find((m) => m.name.includes("S2 审批"))!.value).toContain("2 /"); // fixture S2 两条 + 每任务比率
    expect(r.metrics.find((m) => m.name.includes("车道"))!.value).toContain("unknown:1");
    expect(r.gapsInInstrumentation.some((g) => g.includes("lane 全为 unknown"))).toBe(true);
  });

  it("W1.5 手工字段:写读闭环 + 自报分钟进北极星② + 自发选择率;坏行跳过;非法 day 拒", () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-vr3-"));
    const db = openDb(join(home, "saydo.db"));
    seedConsoleFixture(db);
    expect(() => appendManualEntry(home, { day: "7月25日" }, NOW)).toThrow(/YYYY-MM-DD/);
    appendManualEntry(home, { day: "2026-07-25", minutesSelfReported: 30, opportunitiesSeen: 4, opportunitiesUsed: 3 }, NOW);
    appendManualEntry(home, { day: "2026-07-24", minutesSelfReported: 12 }, NOW);
    writeFileSync(join(home, "value-manual.jsonl"), '{"broken json\n', { flag: "a" }); // 坏行:读取宽容跳过
    const entries = readManualEntries(home, "2026-07-19T00:00:00.000Z");
    expect(entries).toHaveLength(2);
    const r = buildValueReport(db, NOW, 7, { saydoHome: home });
    const ns2 = r.metrics.find((m) => m.name.includes("北极星② proxy"))!;
    expect(ns2.raw).toMatchObject({ manualMinutes: 42, done: 1 }); // fixture 1 done;自报 30+12
    expect(ns2.value).toContain("分钟/outcome");
    expect(r.metrics.find((m) => m.name.includes("自发选择率"))!.value).toContain("(3/4)");
    // 已有登记 => 手工字段 gap 不再报
    expect(r.gapsInInstrumentation.some((g) => g.includes("手工字段零登记"))).toBe(false);
  });

  it("W1.5 触发线读数栏:空库 0 值列位不编数;无数据源读数带 note;md 渲染含固定栏", () => {
    const db = openDb(join(mkdtempSync(join(tmpdir(), "saydo-vr4-")), "saydo.db"));
    const r = buildValueReport(db, NOW);
    expect(r.triggerReadings.length).toBeGreaterThanOrEqual(5);
    const shadow = r.triggerReadings.find((t) => t.name.includes("shadow"))!;
    expect(shadow.value).toBe("0");
    expect(shadow.threshold).toContain("200");
    for (const name of ["回叫撞车", "检索 miss", "离机时段"]) {
      const t = r.triggerReadings.find((x) => x.name.includes(name))!;
      expect(t.value).toBe("0");
      expect(t.note).toContain("无数据源"); // 0 值列位 + 如实注明,不编数
    }
    const md = renderValueReportMd(r);
    expect(md).toContain("W9 触发线读数");
    expect(md).toContain("只报数不裁决");
  });

  it("lane 埋点:CHECK 词表拒非法值;合法值入占比", () => {
    const db = openDb(join(mkdtempSync(join(tmpdir(), "saydo-vr2-")), "saydo.db"));
    seedConsoleFixture(db);
    expect(() =>
      db.prepare("INSERT INTO sessions(id, project_id, state, engine, transcript_path, started_at, lane) VALUES ('ses_01F1XT0RE0S100000000000000','prj_01F1XT0RE0A000000000000000','closed','cascade','/t',?,'turbo')").run(NOW)
    ).toThrow(/CHECK/);
    db.prepare("INSERT INTO sessions(id, project_id, state, engine, transcript_path, started_at, lane) VALUES ('ses_01F1XT0RE0S200000000000000','prj_01F1XT0RE0A000000000000000','closed','cascade','/t',?,'quick')").run(NOW);
    const r = buildValueReport(db, NOW);
    expect(r.metrics.find((m) => m.name.includes("车道"))!.value).toContain("quick:1");
  });
});
