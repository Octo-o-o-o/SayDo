// S1:proposeStart 回传 demoRef 并同轮上屏(有 local peer 才投;话术门 SCREEN_CLAIM_RE 不放宽)。

import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { newId, READINESS_CHECKLISTS } from "@saydo/contracts";
import { openDb, type Db } from "../src/storage/db.js";
import { createSqliteAuditSink } from "../src/storage/dao/misc.js";
import { registerLiveTools, resetScreenCredits, takeScreenCredit } from "../src/brain/liveTools.js";
import { ToolRegistry } from "../src/brain/registry.js";
import { BrainTools } from "../src/brain/tools.js";
import { DecisionPackageFactory } from "../src/packages/factory.js";
import { ArtifactStore } from "../src/artifacts/store.js";
import { MemoryLedger } from "../src/memory/ledger.js";
import { HotwordStore } from "../src/memory/hotwords.js";
import { LiveVoiceSessions } from "../src/live/voiceSessions.js";
import { SessionManager } from "../src/session/manager.js";
import { ConfirmationLoop } from "../src/live/confirm.js";
import type { LlmProvider } from "../src/providers/types.js";
import type { VoiceDelivery } from "../src/voice/hub.js";
import { SCREEN_CLAIM_RE } from "../src/brain/dialogLoop.js";

const drafter: LlmProvider = {
  kind: "api",
  model: "fake-drafter",
  async chat() {
    return {
      ok: true,
      text: JSON.stringify({
        outcomePreview: "给报表页加导出按钮并下载 CSV",
        inScope: ["导出按钮"],
        outOfScope: [],
        acceptance: ["点导出下载 CSV"],
        plan: [{ seq: 1, step: "加按钮", owner: "ai" }],
        risks: []
      }),
      requestedModel: "fake-drafter",
      observedModel: "fake-drafter",
      observedModelSource: "stream",
      observedModelExempted: false,
      usage: undefined
    };
  }
};

describe("proposeStart Demo 上屏", () => {
  let db: Db;
  let home: string;
  let registry: ToolRegistry;
  let sessions: LiveVoiceSessions;
  let sent: { sessionId: string; turnId: string; text: string }[];
  let peerOnline: boolean;
  let sendResult: VoiceDelivery;
  const SES = newId("ses");
  const covered = (READINESS_CHECKLISTS.coding ?? []).map((d) => d.key);

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "saydo-ps-demo-"));
    mkdirSync(join(home, "sessions"), { recursive: true });
    db = openDb(join(home, "saydo.db"));
    const audit = createSqliteAuditSink(db);
    const ledger = new MemoryLedger({ db, audit });
    sessions = new LiveVoiceSessions({
      db,
      audit,
      sessions: new SessionManager({ db, audit, storeTranscript: true }),
      saydoHome: home,
      idleSuspendSec: 0
    });
    sent = [];
    peerOnline = false;
    sendResult = { attempted: 1, succeeded: 1, failed: 0 };
    resetScreenCredits();
    registry = new ToolRegistry();
    registerLiveTools(registry, {
      db,
      audit,
      brainTools: new BrainTools({ db, audit }),
      factory: new DecisionPackageFactory({
        db,
        artifacts: new ArtifactStore({ db, saydoDir: home }),
        audit,
        now: () => new Date()
      }),
      ledger,
      hotwords: new HotwordStore(ledger),
      sessions,
      confirm: new ConfirmationLoop(),
      say: () => true,
      drafter,
      gate0: () => ({ enabled: true, bypass: false }),
      devAdapter: () => "cursor",
      taskMaxDefault: () => 20,
      enabledProjectTypes: () => ["coding", "writing"],
      readinessEvidence: () => ({ covered, bindings: [] }),
      hasConsolePeerForSession: () => peerOnline,
      sendScreenText: (sessionId, turnId, text): VoiceDelivery => {
        sent.push({ sessionId, turnId, text });
        return sendResult;
      }
    });
  });

  async function draftId(): Promise<string> {
    sessions.ensureSession(SES);
    db.prepare("UPDATE projects SET type='coding' WHERE id=(SELECT project_id FROM sessions WHERE id=?)").run(SES);
    const ct = (await registry.dispatch("createTask", JSON.stringify({ rawPoints: ["给报表页加导出按钮"] }), {
      sessionId: SES,
      turnId: newId("ses")
    })) as { taskDraftId: string };
    return ct.taskDraftId;
  }

  it("有 peer ⇒ 投递并回 demoPresented:true", async () => {
    peerOnline = true;
    const did = await draftId();
    const turnId = newId("ses");
    const p = (await registry.dispatch("proposeStart", JSON.stringify({ taskDraftId: did }), {
      sessionId: SES,
      turnId
    })) as {
      packageId?: string;
      demoRef?: { artifactId: string; version: number };
      demoPresented?: boolean;
    };
    expect(p.packageId).toBeTruthy();
    expect(p.demoRef).toBeDefined();
    expect(p.demoPresented).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.sessionId).toBe(SES);
    expect(sent[0]?.turnId).not.toBe(turnId);
    expect(sent[0]?.turnId).toMatch(/^ses_/);
    expect(sent[0]?.text).toContain("决策包小样已放到屏幕：");
    expect(sent[0]?.text).toContain("给报表页加导出按钮");
    expect(takeScreenCredit(SES, turnId).succeeded).toBe(1);
  });

  it("succeeded=0 ⇒ demoPresented:false", async () => {
    peerOnline = true;
    sendResult = { attempted: 1, succeeded: 0, failed: 1 };
    const did = await draftId();
    const turnId = newId("ses");
    const p = (await registry.dispatch("proposeStart", JSON.stringify({ taskDraftId: did }), {
      sessionId: SES,
      turnId
    })) as { demoPresented?: boolean };
    expect(p.demoPresented).toBe(false);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.turnId).not.toBe(turnId);
    expect(takeScreenCredit(SES, turnId).succeeded).toBe(0);
  });

  it("无 peer ⇒ demoPresented:false 且不投递", async () => {
    peerOnline = false;
    const did = await draftId();
    const p = (await registry.dispatch("proposeStart", JSON.stringify({ taskDraftId: did }), {
      sessionId: SES,
      turnId: newId("ses")
    })) as { demoRef?: { artifactId: string; version: number }; demoPresented?: boolean };
    expect(p.demoRef).toBeDefined();
    expect(p.demoPresented).toBe(false);
    expect(sent).toHaveLength(0);
  });

  it("SCREEN_CLAIM_RE 不放宽(本批不加新词)", () => {
    expect(SCREEN_CLAIM_RE.test("我做了个小样放屏幕上了,你可以扫一眼。")).toBe(true);
    expect(SCREEN_CLAIM_RE.test("决策包小样已放到屏幕：给报表页加导出")).toBe(false);
  });
});
