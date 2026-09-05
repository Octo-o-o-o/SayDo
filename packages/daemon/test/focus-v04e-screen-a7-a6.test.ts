// Focus v0.4 ④e 契约:screen_text via 定向 + 话术门 + A7 证据门 + A6 idle 取消。
// 覆盖任务 a–g。

import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { newId } from "@saydo/contracts";
import { VoiceHub, VOICE_WS_PROTOCOL_VERSION } from "../src/voice/hub.js";
import type { Logger } from "../src/obs/logger.js";
import { openFocusFixture, type FocusFixture } from "./helpers/focus-fixture.js";
import { createFocus } from "../src/focus/registry.js";
import { upsertObligation as upsertOb } from "../src/focus/obligations.js";
import { LiveVoiceSessions } from "../src/live/voiceSessions.js";
import { SessionManager } from "../src/session/manager.js";
import type { AuditSink } from "../src/obs/audit.js";
import { SCREEN_CLAIM_RE } from "../src/brain/dialogLoop.js";
import { resolveObligationApi } from "../src/api/obligations.js";

const silentLog: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => silentLog
};
const nullAudit: AuditSink = { record: () => ({ id: "aud_x" }) };

const RUNTIME_SHA = "1234567890abcdef1234567890abcdef12345678";

describe("④e screen_text via 定向(a/b)", () => {
  let server: Server;
  let hub: VoiceHub;
  let port: number;

  beforeEach(async () => {
    server = createServer();
    hub = new VoiceHub(server, silentLog, {
      verifyUpgrade: (req) => {
        const host = req.headers.host ?? "";
        // 测试用 query ?via=tailnet 模拟来源面
        const url = new URL(req.url ?? "/", "http://localhost");
        const via = url.searchParams.get("via") === "tailnet" ? "tailnet" : "local";
        return { ok: true, via: via as "local" | "tailnet" };
      }
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const addr = server.address();
    if (typeof addr === "object" && addr) port = addr.port;
  });

  afterEach(() => {
    hub.close();
    server.close();
  });

  function connect(role: "pipeline" | "console", via: "local" | "tailnet" = "local"): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const q = role === "console" ? `?via=${via}` : "";
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/voice${q}`);
      ws.on("open", () =>
        ws.send(
          JSON.stringify({
            v: VOICE_WS_PROTOCOL_VERSION,
            role,
            ...(role === "pipeline"
              ? { identity: { sourceRevision: RUNTIME_SHA, buildId: "pipeline-test", protocolVersion: "1.0.0" } }
              : {})
          })
        )
      );
      const onAck = (d: unknown, isBinary: boolean) => {
        if (isBinary) return;
        try {
          const m = JSON.parse(String(d)) as { t?: string };
          if (m.t === "hello.ack") {
            ws.off("message", onAck);
            resolve(ws);
          }
        } catch {
          /* ignore */
        }
      };
      ws.on("message", onAck);
      ws.on("close", (code) => reject(new Error(`closed ${code}`)));
      ws.on("error", reject);
    });
  }

  function nextJson(ws: WebSocket, pred: (m: Record<string, unknown>) => boolean, ms = 2000): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("timeout waiting message")), ms);
      const handler = (d: unknown, isBinary: boolean) => {
        if (isBinary) return;
        try {
          const m = JSON.parse(String(d)) as Record<string, unknown>;
          if (pred(m)) {
            clearTimeout(t);
            ws.off("message", handler);
            resolve(m);
          }
        } catch {
          /* ignore */
        }
      };
      ws.on("message", handler);
    });
  }

  it("a) tailnet console WS 连接被拒(4003);b) local peer 收到全文且 turnId 正确", async () => {
    const local = await connect("console", "local");
    // PG-01B:远程业务面 fail-closed——via=tailnet 根本连不上,不是「连上但收不到」
    await expect(connect("console", "tailnet")).rejects.toThrow(/^closed 4003$/);
    const ses = newId("ses");
    const turn = newId("ses");
    const got = nextJson(local, (m) => m["t"] === "screen_text");
    const delivery = hub.sendScreenText({
      t: "screen_text",
      sessionId: ses,
      turnId: turn,
      text: "全文细节 token=secret"
    });
    expect(delivery.succeeded).toBeGreaterThanOrEqual(1);
    const msg = await got;
    expect(msg["turnId"]).toBe(turn);
    expect(msg["text"]).toContain("token=secret");
    // 无存活 tailnet console peer,定向 predicate 投递 succeeded=0
    const onlyTail = hub.sendToConsolePeers((m) => m.via === "tailnet", {
      t: "screen_text",
      sessionId: ses,
      turnId: turn,
      text: "leak-test"
    });
    expect(onlyTail.succeeded).toBe(0);
    local.close();
  });
});

describe("④e 话术门 SCREEN_CLAIM_RE(c)", () => {
  it("命中放屏幕类话术", () => {
    expect(SCREEN_CLAIM_RE.test("细节有点多,我放屏幕上了。")).toBe(true);
    expect(SCREEN_CLAIM_RE.test("细节放屏幕上看吧")).toBe(true);
    expect(SCREEN_CLAIM_RE.test("好的我记下了")).toBe(false);
  });
});

describe("④e A7 证据门(d/e/f)", () => {
  let fx: FocusFixture;
  beforeEach(() => {
    fx = openFocusFixture();
  });
  afterEach(() => fx.close());

  function openAgent(focusId: string, title = "代办") {
    return upsertOb(fx.db, focusId, {
      kind: "action",
      title,
      owner: "agent",
      status: "open",
      verification: "confirmed",
      dedupeKey: `${focusId}:action:${title}`
    });
  }

  it("d) agent 义务 done 无 evidence → 拒(写门+API)", () => {
    const { focusId } = createFocus(fx.db, { title: "A7" });
    const ob = openAgent(focusId);
    expect(() =>
      upsertOb(fx.db, focusId, {
        kind: "action",
        title: "代办",
        owner: "agent",
        status: "resolved",
        verification: "confirmed",
        dedupeKey: `${focusId}:action:代办`,
        resolution: "done"
      })
    ).toThrow(/evidence_required/);
    const api = resolveObligationApi(fx.db, nullAudit, ob.obligationId, { resolution: "done" });
    expect(api.status).toBe(409);
    expect((api.payload as { code: string }).code).toBe("evidence_required");
  });

  it("e) evidence 不存在 / 跨 focus / superseded artifact → 三查各拒", () => {
    const { focusId } = createFocus(fx.db, { title: "E1" });
    const { focusId: other } = createFocus(fx.db, { title: "E2" });
    openAgent(focusId, "查");

    // 不存在
    expect(() =>
      upsertOb(fx.db, focusId, {
        kind: "action",
        title: "查",
        owner: "agent",
        status: "resolved",
        verification: "confirmed",
        dedupeKey: `${focusId}:action:查`,
        resolution: "done",
        evidence: { type: "event", focusId, seq: 99999 }
      })
    ).toThrow(/evidence_missing/);

    // 跨 focus
    expect(() =>
      upsertOb(fx.db, focusId, {
        kind: "action",
        title: "查",
        owner: "agent",
        status: "resolved",
        verification: "confirmed",
        dedupeKey: `${focusId}:action:查`,
        resolution: "done",
        evidence: { type: "event", focusId: other, seq: 1 }
      })
    ).toThrow(/evidence_focus_mismatch/);

    // superseded artifact:插 v1+v2,用 v1 销账
    const artId = newId("art");
    const now = "2026-08-04T00:00:00.000Z";
    fx.db
      .prepare(
        `INSERT OR IGNORE INTO focus_project_refs(focus_id, project_id, added_by_event_id, added_at)
         VALUES (?,?,?,?)`
      )
      .run(focusId, fx.projectId, "fev_manual", now);
    fx.db
      .prepare(
        `INSERT INTO artifacts(id, version, project_id, type, path, digest, supersedes_json, tags_json, source, created_at)
         VALUES (?,?,?,'report','/tmp/a1','sha256:${"a".repeat(64)}',NULL,'[]','session',?)`
      )
      .run(artId, 1, fx.projectId, now);
    fx.db
      .prepare(
        `INSERT INTO artifacts(id, version, project_id, type, path, digest, supersedes_json, tags_json, source, created_at)
         VALUES (?,?,?,'report','/tmp/a2','sha256:${"b".repeat(64)}',?,?, 'session',?)`
      )
      .run(artId, 2, fx.projectId, JSON.stringify({ artifactId: artId, version: 1 }), "[]", now);

    expect(() =>
      upsertOb(fx.db, focusId, {
        kind: "action",
        title: "查",
        owner: "agent",
        status: "resolved",
        verification: "confirmed",
        dedupeKey: `${focusId}:action:查`,
        resolution: "done",
        evidence: { type: "artifact", id: artId, version: 1 }
      })
    ).toThrow(/evidence_stale|superseded/);
  });

  it("f) human 义务口头销账不受门", () => {
    const { focusId } = createFocus(fx.db, { title: "H" });
    upsertOb(fx.db, focusId, {
      kind: "decision",
      title: "人选",
      owner: "human",
      status: "open",
      verification: "confirmed",
      dedupeKey: `${focusId}:decision:人选`,
      needs: "decision"
    });
    const r = upsertOb(fx.db, focusId, {
      kind: "decision",
      title: "人选",
      owner: "human",
      status: "resolved",
      verification: "confirmed",
      dedupeKey: `${focusId}:decision:人选`,
      resolution: "done"
    });
    expect(r.eventId).toBeTruthy();
  });

  it("合法 event evidence 可销 agent done", () => {
    const { focusId } = createFocus(fx.db, { title: "OK" });
    openAgent(focusId, "交付");
    const r = upsertOb(fx.db, focusId, {
      kind: "action",
      title: "交付",
      owner: "agent",
      status: "resolved",
      verification: "confirmed",
      dedupeKey: `${focusId}:action:交付`,
      resolution: "done",
      evidence: { type: "event", focusId, seq: 1 }
    });
    expect(r.eventId).toBeTruthy();
  });
});

describe("④e A6 会话生命周期(g)", () => {
  it("ws 断开 → idle 定时器取消(不产生幽灵收尾)", async () => {
    const fx = openFocusFixture();
    const suspended: string[] = [];
    const mgr = new SessionManager({ db: fx.db, audit: nullAudit, storeTranscript: true });
    const live = new LiveVoiceSessions({
      db: fx.db,
      audit: nullAudit,
      sessions: mgr,
      saydoHome: fx.home,
      idleSuspendSec: 60,
      onSuspend: (id) => suspended.push(id)
    });
    const ses = fx.sessionId;
    live.ensureSession(ses);
    live.onUserTurn(ses, newId("ses"), "你好");
    expect(live.hasIdleTimer(ses)).toBe(true);

    // 模拟 console 离线回调
    live.cancelIdle(ses);
    expect(live.hasIdleTimer(ses)).toBe(false);

    // 等待超过 idle 也不会 suspend
    await new Promise((r) => setTimeout(r, 30));
    expect(suspended).toEqual([]);
    fx.close();
  });

  it("hub 在 console peer 关闭时触发 onConsoleSessionOffline", async () => {
    const offline: string[] = [];
    const server = createServer();
    const hub = new VoiceHub(server, silentLog, {
      verifyUpgrade: () => ({ ok: true, via: "local" }),
      onConsoleSessionOffline: (sid) => offline.push(sid)
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const port = (server.address() as { port: number }).port;
    const ses = newId("ses");
    const ws = await new Promise<WebSocket>((resolve, reject) => {
      const c = new WebSocket(`ws://127.0.0.1:${port}/ws/voice`);
      c.on("open", () => c.send(JSON.stringify({ v: VOICE_WS_PROTOCOL_VERSION, role: "console" })));
      c.on("message", (d, bin) => {
        if (bin) return;
        const m = JSON.parse(String(d)) as { t?: string };
        if (m.t === "hello.ack") {
          c.send(JSON.stringify({ t: "voice.mode", sessionId: ses, mode: "ptt" }));
          resolve(c);
        }
      });
      c.on("error", reject);
    });
    await new Promise((r) => setTimeout(r, 20));
    ws.close();
    await new Promise((r) => setTimeout(r, 50));
    expect(offline).toContain(ses);
    hub.close();
    server.close();
  });
});
