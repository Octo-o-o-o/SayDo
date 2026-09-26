// S1/SC45:proposeStart 回传 demoRef(生成可查看);提示送达≠预览已展示;话术门 SCREEN_CLAIM_RE 不放宽。

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
import { BRAIN_INSTRUCTIONS } from "../src/brain/instructions.js";

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

type ProposeStartDemoResult = {
  packageId?: string;
  demoRef?: { artifactId: string; version: number };
  demoPresented?: boolean;
  demoHintDelivered?: boolean;
};

describe("proposeStart Demo 提示与展示证据", () => {
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

  it("有 peer 文字成功仍不得 demoPresented:true,也不给原轮上屏背书", async () => {
    peerOnline = true;
    const did = await draftId();
    const turnId = newId("ses");
    const p = (await registry.dispatch("proposeStart", JSON.stringify({ taskDraftId: did }), {
      sessionId: SES,
      turnId
    })) as ProposeStartDemoResult;
    expect(p.packageId).toBeTruthy();
    expect(p.demoRef).toBeDefined();
    expect(p.demoPresented).toBe(false);
    expect(p.demoHintDelivered).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.sessionId).toBe(SES);
    expect(sent[0]?.turnId).not.toBe(turnId);
    expect(sent[0]?.turnId).toMatch(/^ses_/);
    expect(sent[0]?.text).toContain("决策包小样已生成，可在决策包点看小样：");
    expect(sent[0]?.text).toContain("给报表页加导出按钮");
    expect(sent[0]?.text).not.toContain("已放到屏幕");
    expect(SCREEN_CLAIM_RE.test(sent[0]?.text ?? "")).toBe(false);
    expect(takeScreenCredit(SES, turnId).succeeded).toBe(0);
  });

  it("succeeded=0 ⇒ demoPresented/demoHintDelivered 均为 false", async () => {
    peerOnline = true;
    sendResult = { attempted: 1, succeeded: 0, failed: 1 };
    const did = await draftId();
    const turnId = newId("ses");
    const p = (await registry.dispatch("proposeStart", JSON.stringify({ taskDraftId: did }), {
      sessionId: SES,
      turnId
    })) as ProposeStartDemoResult;
    expect(p.demoRef).toBeDefined();
    expect(p.demoPresented).toBe(false);
    expect(p.demoHintDelivered).toBe(false);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.turnId).not.toBe(turnId);
    expect(takeScreenCredit(SES, turnId).succeeded).toBe(0);
  });

  it("无 peer ⇒ 两字段均 false 且不投递", async () => {
    peerOnline = false;
    const did = await draftId();
    const p = (await registry.dispatch("proposeStart", JSON.stringify({ taskDraftId: did }), {
      sessionId: SES,
      turnId: newId("ses")
    })) as ProposeStartDemoResult;
    expect(p.demoRef).toBeDefined();
    expect(p.demoPresented).toBe(false);
    expect(p.demoHintDelivered).toBe(false);
    expect(sent).toHaveLength(0);
  });

  it("SCREEN_CLAIM_RE 不放宽(本批不加新词)", () => {
    expect(SCREEN_CLAIM_RE.test("我做了个小样放屏幕上了,你可以扫一眼。")).toBe(true);
    expect(SCREEN_CLAIM_RE.test("决策包小样已放到屏幕：给报表页加导出")).toBe(false);
    expect(SCREEN_CLAIM_RE.test("决策包小样已生成，可在决策包点看小样：给报表页加导出")).toBe(false);
    expect(SCREEN_CLAIM_RE.test("决策包里有小样,点看小样就能看。")).toBe(false);
  });

  it("brain 只许实际展示回执宣称已上屏", () => {
    expect(BRAIN_INSTRUCTIONS).toContain("只有 proposeStart 工具结果 demoPresented=true(实际展示回执)时才可说\"放屏幕上了\"");
    expect(BRAIN_INSTRUCTIONS).toContain("demoHintDelivered=true 只表示提示文字送达,不是预览已展示");
    expect(BRAIN_INSTRUCTIONS).toContain("点看小样就能看");
    expect(BRAIN_INSTRUCTIONS).not.toContain("未投递成功不得宣称小样已上屏");
  });
});
