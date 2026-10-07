// 09现有readonly响应 -> console生产投影；不改DDL/write/HTTP形状。
import { describe, expect, it, vi } from "vitest";
import { openDb, type Db } from "../src/storage/db.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getCosts } from "../src/api/console.js";
// 测试运行时加载真实console入口，避免将外包源码纳入daemon编译rootDir。
const consoleProjectionPath = new URL("../../console/src/lib/costDisplay.ts", import.meta.url).pathname;
const { projectCostRows } = await import(consoleProjectionPath);
const { authoritativeAllTotals } = await import(new URL("../../console/src/lib/costWindow.ts", import.meta.url).pathname);

function row(db: Db, id: string, amount: number | null, currency: string | null, known = 1, source = "api", meta: unknown = null) {
  db.prepare("INSERT INTO cost_entries(id,ts,project_id,kind,amount,currency,known,source,meta_json) VALUES (?,?,'prj_cost','llm.dialog',?,?,?,?,?)")
    .run(id, new Date(Date.UTC(2026, 9, 4) + Number(id) * 1000).toISOString(), amount, currency, known, source, meta === null ? null : JSON.stringify(meta));
}

describe("完整账本API与窗口console实际投影", () => {
  it("合法API已知零保留两个币种；内部knownCount不进入HTTP shape", () => {
    const db = openDb(":memory:");
    try {
      row(db, "1", 0, "CNY"); row(db, "2", 0, "USD");
      const data = getCosts(db); const p = data.byProject[0]!;
      expect(p.knownByCurrency).toEqual({ CNY: 0, USD: 0 }); expect(p.unknownCount).toBe(0);
      expect(Object.keys(p).sort()).toEqual(["projectId", "projectTitle", "knownByCurrency", "unknownCount", "billing"].sort());
      expect(projectCostRows(data.entries).knownByCurrency).toEqual({ USD: 0, CNY: 0 });
    } finally { db.close(); }
  });
  it("订阅不进API金额；窗口第三态、上游计费和API未知分别保留", () => {
    const db = openDb(":memory:");
    try {
      row(db, "1", 2, "CNY"); row(db, "2", 3, "USD"); row(db, "3", null, null, 0);
      row(db, "4", null, null, 0, "subscription", { provenance: "subscription", requests: 2 });
      row(db, "5", null, null, 0, "subscription", { provenance: "external_api", requests: 1 });
      const data = getCosts(db); const p = data.byProject[0]!;
      expect(p.knownByCurrency).toEqual({ CNY: 2, USD: 3 });
      // 旧字段保兼容，新增billing才区分API未知/真实订阅/上游来源。
      expect(p.unknownCount).toBe(3);
      expect(p.billing).toEqual({ unknownMoneyEntries: 1, subscriptionEntries: 1, subscriptionRequests: 2, upstreamCliEntries: 1 });
      const view = projectCostRows(data.entries);
      expect(view.unknownCount).toBe(1); expect(view.knownByCurrency).toEqual({ USD: 3, CNY: 2 });
      expect(view.billingText).toContain("订阅额度内(已用 2 次)"); expect(view.billingText).toContain("SayDo 不代付");
    } finally { db.close(); }
  });
  it("非法金额/币种不变成已知零；合法未知订阅由meta分流", () => {
    const db = openDb(":memory:");
    try {
      row(db, "1", -1, "CNY"); row(db, "2", null, "CNY"); row(db, "3", 1, "EUR"); row(db, "4", Infinity, "USD");
      row(db, "5", null, null, 0, "subscription", { provenance: "subscription", requests: 0 });
      row(db, "6", null, null, 0, "subscription");
      const data = getCosts(db); expect(data.byProject[0]!.knownByCurrency).toEqual({}); expect(data.byProject[0]!.unknownCount).toBe(6);
      const view = projectCostRows(data.entries); expect(view.knownByCurrency).toEqual({}); expect(view.unknownCount).toBe(4);
      expect(view.billingText).toContain("调用次数不完整"); expect(view.billingText).toContain("SayDo 不代付");
    } finally { db.close(); }
  });
  it("301条完整账本不能由300窗口补全计费来源与N", () => {
    const db = openDb(":memory:");
    try {
      row(db, "0", null, null, 0, "subscription", { provenance: "subscription", requests: 9 });
      for (let i = 1; i <= 300; i++) row(db, String(i), 1, "CNY");
      const data = getCosts(db); expect(data.entriesWindow).toEqual({ limit: 300, returned: 300, total: 301, truncated: true });
      expect(data.byProject[0]!.knownByCurrency).toEqual({ CNY: 300 }); expect(data.byProject[0]!.unknownCount).toBe(1);
      expect(data.entries.some(e => e.id === "0")).toBe(false);
      expect(projectCostRows(data.entries).billingText).toBe("");
      expect(data.byProject[0]).not.toHaveProperty("requests");
      expect(data.byProject[0]!.billing).toEqual({ unknownMoneyEntries: 0, subscriptionEntries: 1, subscriptionRequests: 9, upstreamCliEntries: 0 });
    } finally { db.close(); }
  });
});

it("真实SQLite同项目全贡献overflow与坏metadata，既有字段不删", () => {
  const db = openDb(":memory:");
  try {
    for (const [i, amount] of [1, Number.MAX_VALUE, Number.MAX_VALUE, 1].entries()) row(db, String(i), amount, "CNY");
    row(db, "4", 0, "USD"); row(db, "5", null, null, 0, "subscription", { provenance: "subscription", requests: 2 });
    row(db, "6", null, null, 0, "subscription", { provenance: "subscription", requests: 0 });
    row(db, "7", null, null, 0, "subscription", { provenance: "unknown", requests: 9 });
    row(db, "8", null, null, 0, "subscription");
    db.prepare("UPDATE cost_entries SET meta_json='broken' WHERE id='8'").run();
    const data = getCosts(db); expect(data.byProject[0]).toMatchObject({ knownByCurrency: { USD: 0 }, unknownCount: 8,
      billing: { unknownMoneyEntries: 4, subscriptionEntries: 2, subscriptionRequests: null, upstreamCliEntries: 2 } });
    expect(data.entriesWindow.total).toBe(9);
  } finally { db.close(); }
});


it("WAL第二连接在full scan后写入：billing/window/total保持同一真实快照", () => {
  const root = mkdtempSync(join(tmpdir(), "saydo-cost-snapshot-"));
  let db: Db | undefined; let writer: Db | undefined;
  try {
    const path = join(root, "cohort.sqlite"); db = openDb(path); writer = openDb(path);
    row(db, "1", 0, "USD");
    const prepare = db.prepare.bind(db); let injected = false;
    const spy = vi.spyOn(db, "prepare").mockImplementation((sql: string) => {
      if (sql.startsWith("SELECT id, ts") && !injected) {
        expect(db!.inTransaction).toBe(true); injected = true;
        row(writer!, "2", null, null, 0, "subscription", { provenance: "subscription", requests: 9 });
      }
      return prepare(sql);
    });
    const before = getCosts(db); spy.mockRestore();
    expect(injected).toBe(true); expect(before.entriesWindow.total).toBe(1); expect(before.entries).toHaveLength(1);
    expect(before.byProject[0]!.billing).toEqual({ unknownMoneyEntries: 0, subscriptionEntries: 0, subscriptionRequests: null, upstreamCliEntries: 0 });
    const after = getCosts(db); expect(after.entriesWindow.total).toBe(2); expect(after.entries).toHaveLength(2);
    expect(after.byProject[0]!.billing?.subscriptionRequests).toBe(9);
  } finally {
    try { writer?.close(); } finally {
      try { db?.close(); } finally { rmSync(root, { recursive: true, force: true }); }
    }
  }
});

it("全账本413行与真实console聚合，隐藏窗口订阅也参与完整N", () => {
  const db = openDb(":memory:");
  try {
    for (let i = 0; i < 12; i++) row(db, String(i), null, null, 0, "subscription", { provenance: "subscription", requests: 2 });
    for (let i = 12; i < 413; i++) row(db, String(i), 1, "CNY");
    const data = getCosts(db); expect(data.entriesWindow).toEqual({ limit: 300, returned: 300, total: 413, truncated: true });
    expect(data.entries.every(e => e.source === "api")).toBe(true);
    expect(data.byProject[0]!.billing).toEqual({ unknownMoneyEntries: 0, subscriptionEntries: 12, subscriptionRequests: 24, upstreamCliEntries: 0 });
    expect(authoritativeAllTotals(data.byProject)).toMatchObject({ knownByCurrency: { CNY: 401 }, billing: { subscriptionRequests: 24 } });
    expect(projectCostRows(data.entries).billingText).toBe("");
  } finally { db.close(); }
});

it("真实不同project NULL不与字符串碰撞，非法source保API未知；读后账本字节不改", () => {
  const db = openDb(":memory:");
  try {
    row(db, "1", 0, "CNY"); row(db, "2", null, null, 0, "subscription", { provenance: "external_api", requests: 9 });
    db.prepare("UPDATE cost_entries SET project_id=NULL WHERE id='1'").run();
    db.prepare("UPDATE cost_entries SET project_id='(none)' WHERE id='2'").run();
    db.pragma("ignore_check_constraints=ON"); row(db, "3", 3, "USD", 1, "future");
    const before = db.prepare("SELECT * FROM cost_entries ORDER BY id").all(); const data = getCosts(db);
    expect(data.byProject.map(p => p.projectId).sort()).toEqual(["(none)", "prj_cost", null].sort());
    expect(data.byProject.find(p => p.projectId === "prj_cost")!.billing?.unknownMoneyEntries).toBe(1);
    expect(data.byProject.find(p => p.projectId === "(none)")!.billing?.upstreamCliEntries).toBe(1);
    expect(db.prepare("SELECT * FROM cost_entries ORDER BY id").all()).toEqual(before);
  } finally { db.close(); }
});
