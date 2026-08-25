// W2 阶段 B · T2 薄版(05 §4 提前批 #2;IMPL-5 §2-B 红线):
// tailnet 白名单显式枚举(禁通配 fail-closed)/ verifyIdentity 来源标注 / 白名单外 Origin 拒 /
// S3 合并链动作 tailnet 拒 + 话术引导 / ntfy 深链不带 token + 状态词纪律。

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "../src/storage/db.js";
import { createSqliteAuditSink } from "../src/storage/dao/misc.js";
import { seedConsoleFixture } from "../src/api/fixture.js";
import { handleTaskAction } from "../src/api/actions.js";
import { verifyIdentity } from "../src/net/identity.js";
import { parseT2Config } from "../src/net/t2.js";
import { daemonListenAddress, mobileLanApiAllowed, mobileLanEnabled } from "../src/net/mobileLan.js";
import { consoleBaseUrl, renderNtfyMessage } from "../src/callback/ntfy.js";
import type { AuditSink } from "../src/obs/audit.js";

const nullAudit: AuditSink = { record: () => ({ id: "aud_x" }) };
const NOW = "2026-07-26T12:00:00.000Z";
const TOKEN = "tok-test";
const TAILNET = ["mac-mini.tailnet-x.ts.net"];
const ipv4 = (...parts: number[]) => parts.join(".");
const LAN_PEER = ipv4(192, 168, 8, 31);
const LAN_HOST = ipv4(192, 168, 8, 20);
const TEN_HOST = ipv4(10, 0, 0, 2);
const macHome = (user: string, rest = "") => ["", "Users", user].join("/") + rest;

function idv(input: { host?: string; origin?: string; token?: string; tailnetHosts?: readonly string[]; peerAddress?: string }) {
  return verifyIdentity({
    host: input.host,
    origin: input.origin,
    token: input.token ?? TOKEN,
    port: 47100,
    expectedToken: TOKEN,
    peerAddress: input.peerAddress ?? (input.host?.includes("tailnet") ? "100.103.156.96" : "127.0.0.1"),
    ...(input.tailnetHosts ? { tailnetHosts: input.tailnetHosts } : {})
  });
}

describe("parseT2Config(白名单枚举,禁通配 fail-closed)", () => {
  it("合法枚举通过;缺省 listen=127.0.0.1", () => {
    const c = parseT2Config({ tailnet_hosts: ["mac.ts.net", "100.64.0.5"], listen: "0.0.0.0" });
    expect(c).toEqual({ tailnetHosts: ["mac.ts.net", "100.64.0.5"], listen: "0.0.0.0" });
    expect(parseT2Config(undefined)).toEqual({ tailnetHosts: [], listen: "127.0.0.1" });
  });

  it("通配/空串/带 scheme·端口 ⇒ tailnet 面整体不开(不是丢弃单项)", () => {
    for (const bad of ["*", "*.ts.net", "", "http://mac.ts.net", "mac.ts.net:47100"]) {
      const c = parseT2Config({ tailnet_hosts: ["good.ts.net", bad] });
      expect(c.tailnetHosts).toEqual([]);
      expect(c.rejectedReason).toContain("fail-closed");
    }
  });
});

describe("verifyIdentity tailnet 面(G1 三道门语义不放宽)", () => {
  it("tailnet Host 命中枚举 ⇒ ok + via=tailnet;本机 ⇒ via=local", () => {
    const t = idv({ host: "mac-mini.tailnet-x.ts.net:47100", tailnetHosts: TAILNET });
    expect(t).toMatchObject({ ok: true, via: "tailnet" });
    const spoofedFromLan = idv({
      host: "mac-mini.tailnet-x.ts.net:47100",
      origin: "http://mac-mini.tailnet-x.ts.net:47100",
      tailnetHosts: TAILNET,
      peerAddress: LAN_PEER
    });
    expect(spoofedFromLan).toMatchObject({ ok: false, code: "host_rejected" });
    const l = idv({ host: "127.0.0.1:47100", tailnetHosts: TAILNET });
    expect(l).toMatchObject({ ok: true, via: "local" });
  });

  it("枚举外 Host / 未配置枚举时的 tailnet Host ⇒ host_rejected(白名单外拒,验收断言)", () => {
    expect(idv({ host: "evil.example:47100", tailnetHosts: TAILNET })).toMatchObject({ ok: false, code: "host_rejected" });
    expect(idv({ host: "mac-mini.tailnet-x.ts.net:47100" })).toMatchObject({ ok: false, code: "host_rejected" });
    // 端口不符同拒(host 全串匹配)
    expect(idv({ host: "mac-mini.tailnet-x.ts.net:9999", tailnetHosts: TAILNET })).toMatchObject({ ok: false, code: "host_rejected" });
  });

  it("Origin:tailnet 同源放行;白名单外 Origin 拒(DNS-rebinding 护栏不放宽)", () => {
    const ok = idv({ host: "mac-mini.tailnet-x.ts.net:47100", origin: "http://mac-mini.tailnet-x.ts.net:47100", tailnetHosts: TAILNET });
    expect(ok).toMatchObject({ ok: true, via: "tailnet" });
    const cross = idv({ host: "mac-mini.tailnet-x.ts.net:47100", origin: "http://evil.example", tailnetHosts: TAILNET });
    expect(cross).toMatchObject({ ok: false, code: "origin_rejected" });
    // https origin 也不在白名单(薄版 tailnet 走 http;证书面留原生外壳批)
    const https = idv({ host: "mac-mini.tailnet-x.ts.net:47100", origin: "https://mac-mini.tailnet-x.ts.net:47100", tailnetHosts: TAILNET });
    expect(https).toMatchObject({ ok: false, code: "origin_rejected" });
  });

  it("token 门在 tailnet 面照守(缺 token 拒)", () => {
    expect(idv({ host: "mac-mini.tailnet-x.ts.net:47100", token: "", tailnetHosts: TAILNET })).toMatchObject({
      ok: false,
      code: "token_missing"
    });
  });
});

describe("M1 移动 LAN 显式开关", () => {
  it("默认关闭;开启后只放行 RFC 1918 Host、同源 Origin 与 token", () => {
    expect(mobileLanEnabled(undefined)).toBe(false);
    expect(daemonListenAddress("127.0.0.1", false)).toBe("127.0.0.1");
    expect(daemonListenAddress("127.0.0.1", true)).toBe("0.0.0.0");

    const base = { token: TOKEN, port: 47100, expectedToken: TOKEN, tailnetHosts: [], peerAddress: LAN_PEER };
    expect(verifyIdentity({ ...base, host: `${LAN_HOST}:47100`, origin: `http://${LAN_HOST}:47100` })).toMatchObject({
      ok: false,
      code: "host_rejected"
    });
    expect(
      verifyIdentity({
        ...base,
        host: `${LAN_HOST}:47100`,
        origin: `http://${LAN_HOST}:47100`,
        mobileLan: true
      })
    ).toMatchObject({ ok: true, via: "mobile_lan" });
    expect(
      verifyIdentity({
        ...base,
        host: "[fd12:3456:789a::20]:47100",
        origin: "http://[fd12:3456:789a::20]:47100",
        mobileLan: true
      })
    ).toMatchObject({ ok: false, code: "host_rejected" });
    expect(
      verifyIdentity({
        ...base,
        host: "8.8.8.8:47100",
        origin: "http://8.8.8.8:47100",
        mobileLan: true
      })
    ).toMatchObject({ ok: false, code: "host_rejected" });
    expect(
      verifyIdentity({
        ...base,
        host: `${TEN_HOST}:47100`,
        origin: undefined,
        mobileLan: true
      })
    ).toMatchObject({ ok: false, code: "origin_rejected" });
    expect(
      verifyIdentity({
        ...base,
        host: `${TEN_HOST}:47100`,
        origin: undefined,
        referer: `http://${TEN_HOST}:47100/#/m`,
        mobileLan: true
      })
    ).toMatchObject({ ok: true, via: "mobile_lan" });
    expect(
      verifyIdentity({
        ...base,
        host: "localhost:47100",
        origin: "http://localhost:47100",
        mobileLan: true
      })
    ).toMatchObject({ ok: false, code: "host_rejected" });
    expect(
      verifyIdentity({
        ...base,
        host: `${TEN_HOST}:47100`,
        origin: "http://evil.example",
        mobileLan: true
      })
    ).toMatchObject({ ok: false, code: "origin_rejected" });
    expect(
      verifyIdentity({
        ...base,
        host: "fc.evil:47100",
        origin: "http://fc.evil:47100",
        mobileLan: true
      })
    ).toMatchObject({ ok: false, code: "host_rejected" });
    expect(
      verifyIdentity({
        ...base,
        host: `${TEN_HOST}:47100`,
        origin: "http://localhost:47100",
        mobileLan: true
      })
    ).toMatchObject({ ok: false, code: "origin_rejected" });
    expect(
      verifyIdentity({
        ...base,
        host: `${TEN_HOST}:47100`,
        origin: "http://mac-mini.tailnet-x.ts.net:47100",
        tailnetHosts: TAILNET,
        mobileLan: true
      })
    ).toMatchObject({ ok: false, code: "origin_rejected" });
  });

  it("HTTP 只开放移动只读投影与 first-run query", () => {
    expect(mobileLanApiAllowed("GET", "/api/attention")).toBe(true);
    expect(mobileLanApiAllowed("GET", "/api/focuses/foc_1")).toBe(true);
    expect(mobileLanApiAllowed("GET", "/api/sessions/recent-transcript")).toBe(true);
    expect(mobileLanApiAllowed("GET", "/api/memory/recent")).toBe(true);
    expect(mobileLanApiAllowed("GET", "/api/projects/prj_1/memory")).toBe(true);
    expect(mobileLanApiAllowed("POST", "/api/setup/first-run/query")).toBe(true);
    expect(mobileLanApiAllowed("POST", "/api/setup/config")).toBe(false);
    expect(mobileLanApiAllowed("POST", "/api/setup/cli-capability/reprobe")).toBe(false);
    expect(mobileLanApiAllowed("GET", "/api/setup/probe")).toBe(false);
    expect(mobileLanApiAllowed("POST", "/api/focuses")).toBe(false);
    expect(mobileLanApiAllowed("GET", "/api/overview")).toBe(false);
    expect(mobileLanApiAllowed("GET", "/api/pairing-info")).toBe(false);
    expect(mobileLanApiAllowed("GET", "/api/artifacts/art_01AAAAAAAAAAAAAAAAAAAAAAAA/versions/1")).toBe(false);
  });
});

describe("S3 合并链动作 tailnet 拒(手机 = 只读 + S2 屏幕面;S3 语义不变)", () => {
  let db: Db;
  const RDY = "tsk_01F1XT0RE0TSKRDY0000000000";

  beforeEach(() => {
    db = openDb(join(mkdtempSync(join(tmpdir(), "saydo-t2-")), "saydo.db"));
    expect(seedConsoleFixture(db).seeded).toBe(true);
  });

  it("tailnet 来源 request-manual-merge / verify-merge ⇒ 403 + 话术引导回受信终端 + 审计", () => {
    // 先 approve 让任务进入待合并(用本机来源)
    expect(handleTaskAction(db, nullAudit, RDY, "review", { verdict: "approve", expectedAttempt: 1 }, NOW).status).toBe(200);
    const events: string[] = [];
    const audit: AuditSink = { record: (e) => (events.push(e.action), { id: "aud_x" }) };
    for (const action of ["request-manual-merge", "verify-merge"]) {
      const r = handleTaskAction(db, audit, RDY, action, {}, NOW, { via: "tailnet" });
      expect(r.status).toBe(403);
      expect(r.payload).toMatchObject({ ok: false, code: "s3_requires_trusted_terminal" });
      expect(String((r.payload as { message: string }).message)).toContain("回到桌面");
    }
    expect(events.filter((a) => a === "t2.s3_action_rejected")).toHaveLength(2);
  });

  it("tailnet 来源 S2 面照常:review 验收 / cancel / retry 不受限(可看可批)", () => {
    const r = handleTaskAction(db, nullAudit, RDY, "review", { verdict: "approve", expectedAttempt: 1 }, NOW, { via: "tailnet" });
    expect(r.status).toBe(200);
  });

  it("本机来源(via=local / 未标注)S3 动作照常走库层(不因新参数回归)", () => {
    expect(handleTaskAction(db, nullAudit, RDY, "review", { verdict: "approve", expectedAttempt: 1 }, NOW).status).toBe(200);
    const r = handleTaskAction(db, nullAudit, RDY, "request-manual-merge", {}, NOW, { via: "local" });
    expect(r.status).toBe(200);
  });
});

describe("迟到评审 A1 回收:语音工具环 S3 门(tailnet console 在连即拒,与 HTTP via 门同一红线)", () => {
  async function dispatchMergeTool(tailnetPresent: boolean): Promise<Record<string, unknown>> {
    const home = mkdtempSync(join(tmpdir(), "saydo-t2v-"));
    const db2 = openDb(join(home, "saydo.db"));
    const audit2 = createSqliteAuditSink(db2);
    const { ToolRegistry } = await import("../src/brain/registry.js");
    const { registerLiveTools } = await import("../src/brain/liveTools.js");
    const { BrainTools } = await import("../src/brain/tools.js");
    const { DecisionPackageFactory } = await import("../src/packages/factory.js");
    const { ArtifactStore } = await import("../src/artifacts/store.js");
    const { MemoryLedger } = await import("../src/memory/ledger.js");
    const { HotwordStore } = await import("../src/memory/hotwords.js");
    const { LiveVoiceSessions } = await import("../src/live/voiceSessions.js");
    const { SessionManager } = await import("../src/session/manager.js");
    const { ConfirmationLoop } = await import("../src/live/confirm.js");
    const ledger = new MemoryLedger({ db: db2, audit: audit2 });
    const reg = new ToolRegistry();
    registerLiveTools(reg, {
      db: db2,
      audit: audit2,
      brainTools: new BrainTools({ db: db2, audit: audit2 }),
      factory: new DecisionPackageFactory({ db: db2, artifacts: new ArtifactStore({ db: db2, saydoDir: home }), audit: audit2, now: () => new Date() }),
      ledger,
      hotwords: new HotwordStore(ledger),
      sessions: new LiveVoiceSessions({ db: db2, audit: audit2, sessions: new SessionManager({ db: db2, audit: audit2, storeTranscript: true }), saydoHome: home, idleSuspendSec: 0 }),
      confirm: new ConfirmationLoop(),
      say: () => true,
      drafter: null,
      gate0: () => ({ enabled: true, bypass: false }),
      devAdapter: () => "cursor",
      taskMaxDefault: () => 20,
      enabledProjectTypes: () => ["coding", "writing"],
      tailnetConsolePresent: () => tailnetPresent
    });
    return (await reg.dispatch(
      "requestManualMerge",
      JSON.stringify({ taskId: "tsk_01T2V0ICEMERGE000000000001" }),
      { sessionId: "ses_01T2V0ICE00000000000000001", turnId: "trn_01T2V0ICE00000000000000001" }
    )) as Record<string, unknown>;
  }

  it("tailnet console 在连 ⇒ 语音 requestManualMerge 拒(s3_requires_trusted_terminal + 话术)", async () => {
    const r = await dispatchMergeTool(true);
    expect(r).toMatchObject({ ok: false, code: "s3_requires_trusted_terminal" });
    expect(String(r["message"])).toContain("回到桌面");
  });

  it("无 tailnet console ⇒ 照常走库层(不因新门误拒本机语音;fixture 无该任务 = 库层错误而非 S3 拒)", async () => {
    const r = await dispatchMergeTool(false);
    expect(String(r["code"] ?? "")).not.toBe("s3_requires_trusted_terminal");
  });
});

describe("ntfy 深链(IMPL-5 §2-B:只带路由,token 绝不进深链)", () => {
  let db: Db;
  const RDY = "tsk_01F1XT0RE0TSKRDY0000000000";

  beforeEach(() => {
    db = openDb(join(mkdtempSync(join(tmpdir(), "saydo-t2n-")), "saydo.db"));
    expect(seedConsoleFixture(db).seeded).toBe(true);
  });

  it("consoleBaseUrl:tailnet 首选枚举主机,未配置回落本机", () => {
    expect(consoleBaseUrl(TAILNET, 47100)).toBe("http://mac-mini.tailnet-x.ts.net:47100");
    expect(consoleBaseUrl([], 47100)).toBe("http://127.0.0.1:47100");
  });

  it("批末终审 A1:通知标题必经 redactor(任务标题自由文本经公网/锁屏——路径/凭据形态不外发)", () => {
    // 运行时拼接构造敏感形态(HANDOFF §0-1:源码不出现完整凭据字面量)
    const fakeKey = ["sk", "test0123456789abcdef0123"].join("-");
    const t0 = "2026-07-26T12:00:00.000Z";
    db.prepare(
      "INSERT INTO tasks(id, project_id, title, spec_markdown, route, status, adapter, budget_json, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)"
    ).run(
      "tsk_01T2NTFYREDACT00000000001",
      String((db.prepare("SELECT project_id FROM tasks LIMIT 1").get() as { project_id: string }).project_id),
      `修 ${macHome("o", "/secret.env")} 里的 ${fakeKey}`,
      "# x",
      "tier1",
      "queued",
      "cursor",
      JSON.stringify({ walltimeActiveMin: 45, maxTurns: 80, maxCost: 20 }),
      t0,
      t0
    );
    const msg = renderNtfyMessage(
      db,
      { id: "ntf_r", task_id: "tsk_01T2NTFYREDACT00000000001", trigger: "ready_for_review" },
      { consoleBase: "http://127.0.0.1:47100" }
    );
    expect(msg.title).not.toContain(fakeKey);
    expect(msg.title).not.toContain(macHome("o", "/secret.env"));
    expect(msg.title).toContain("SayDo");
  });

  it("深链 = 任务详情 hash 路由,不含 token;状态词纪律(等你验收,绝不说完成)", () => {
    const msg = renderNtfyMessage(
      db,
      { id: "ntf_x", task_id: RDY, trigger: "ready_for_review" },
      { consoleBase: consoleBaseUrl(TAILNET, 47100) }
    );
    expect(msg.click).toMatch(/^http:\/\/mac-mini\.tailnet-x\.ts\.net:47100\/#\/p\/prj_[A-Za-z0-9]+\/task\/tsk_/);
    expect(msg.click).not.toContain("token");
    expect(msg.body).toContain("等你验收");
    expect(msg.body).not.toContain("完成");
    expect(msg.title).toContain("SayDo");
    // blocked/failed 高优先级 + 如实话术
    const blocked = renderNtfyMessage(db, { id: "ntf_y", task_id: RDY, trigger: "blocked" }, { consoleBase: "http://127.0.0.1:47100" });
    expect(blocked.priority).toBe(4);
    expect(blocked.body).toContain("需要你处理");
  });
});
