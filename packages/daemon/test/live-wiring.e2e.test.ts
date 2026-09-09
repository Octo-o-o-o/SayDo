// 接线批 e2e(HANDOFF §2-9-②/③):live 工具调用环全链——
// 语音派单 -> createTask/proposeStart(function-call)-> issueDispatchReceipt(daemon 播锁定档确认句)
// -> 用户封闭词表确认(daemon 词表环裁决,不经 Brain)-> consume -> 包 approved -> 任务入队;
// 反例:含糊答复复读/二次转屏、barge-in 作废后裸"好"不消费、否定拒单、Gate 0 未关拒 dispatch。
// harness:直接构造 LiveDialog(注入脚本化 provider + 收集 say 输出),与 index.ts 装配同型。
// 口径注(impl-readback 回收批 2,C4):本文件是**库层装配 rig**,不经 VoiceHub/HTTP/index.ts 生产装配段
// ——"e2e"限于工具环全链语义;daemon 装配段的真实驱动由 Playwright(console 写口)与场次①真人覆盖。

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { newId, READINESS_CHECKLISTS, type ProjectType, type ReadinessEvidenceDetail } from "@saydo/contracts";
import { openDb, type Db } from "../src/storage/db.js";
import { createSqliteAuditSink } from "../src/storage/dao/misc.js";
import { confirmBindings, evidenceFor, listCandidates } from "../src/evaluator/readinessBinding.js";
import { assembleOnSessionStart } from "../src/evaluator/readinessGate.js";
// (A1 反例经动态 import 复用 dispatchApprovedPackage,避免顶部未用告警)
import { SessionManager } from "../src/session/manager.js";
import { LiveVoiceSessions } from "../src/live/voiceSessions.js";
import { LiveDialog } from "../src/live/dialog.js";
import { ConfirmationLoop } from "../src/live/confirm.js";
import { ToolRegistry } from "../src/brain/registry.js";
import { registerLiveTools } from "../src/brain/liveTools.js";
import { BrainTools } from "../src/brain/tools.js";
import { DecisionPackageFactory } from "../src/packages/factory.js";
import { ArtifactStore } from "../src/artifacts/store.js";
import { MemoryLedger } from "../src/memory/ledger.js";
import { confirmMemoryProposal } from "../src/memory/m0Confirm.js";
import { HotwordStore } from "../src/memory/hotwords.js";
import { DeepReviewGovernor } from "../src/evaluator/readiness.js";
import { checkStatusWords } from "../src/brain/golden.js";
import { createLogger, type Logger } from "../src/obs/logger.js";
import { LatencyCollector } from "../src/obs/latency.js";
import type { ChatMessage, ChatRequest, ChatResult, LlmProvider } from "../src/providers/types.js";
import { acceptProjectAnchor } from "../src/projects/anchor.js";
import type { AuditSink } from "../src/obs/audit.js";
import { insertProject } from "../src/storage/dao/projects.js";
import { managedProjectPath } from "../src/projects/workspace.js";
import { isProjectAnchorQuestion } from "../src/brain/instructions.js";

const SES = "ses_01W1REE2E00000000000000000";

// anchor 用例必须用真实 $HOME 下的路径(验证 ~/ 缩写还原),统一走本 registry 回收,
// 不得裸调 mkdtempSync(join(homedir(), ...))——那正是 2026-08-12 家目录数千残留的来源。
const homeFixtures = new Set<string>();
function homeFixture(prefix: string): string {
  const path = mkdtempSync(join(process.cwd(), prefix));
  homeFixtures.add(path);
  return path;
}
afterEach(() => {
  for (const path of homeFixtures) rmSync(path, { recursive: true, force: true });
  homeFixtures.clear();
});
const RAC = "prj_01RAC000000000000000000000";
const TURN = (n: number): string => `ses_01W1REE2ETVRN000000000000${String(n).padStart(1, "0")}`;

type ScriptedSuccess = Omit<Extract<ChatResult, { ok: true }>, "requestedModel" | "observedModelSource" | "observedModelExempted">
  & Partial<Pick<Extract<ChatResult, { ok: true }>, "requestedModel" | "observedModelSource" | "observedModelExempted">>;
type ScriptedResult = Exclude<ChatResult, { ok: true }> | ScriptedSuccess;

function withModelEvidence(result: ScriptedResult): ChatResult {
  if (!result.ok) return result;
  return {
    ...result,
    requestedModel: result.requestedModel ?? result.observedModel,
    observedModelSource: result.observedModelSource ?? "stream",
    observedModelExempted: result.observedModelExempted ?? false
  };
}

/** 脚本化 provider:按 chat 调用序返回(可读 messages 里的工具结果做动态参数) */
function scriptedProvider(
  script: (messages: ChatMessage[], call: number, request: ChatRequest) => ScriptedResult
): LlmProvider {
  let call = 0;
  return {
    kind: "api",
    model: "fake-dialog",
    async chat(req) {
      call += 1;
      return withModelEvidence(script(req.messages, call, req));
    }
  };
}

function insertRacProject(r: Rig, title: string): void {
  insertProject(r.db, {
    id: RAC,
    title,
    type: "coding",
    status: "active",
    workspace: { kind: "local_folder", path: managedProjectPath(RAC), managed: true },
    executionModeDefault: "step_confirm",
    createdAt: "2026-07-28T09:00:00.000Z",
    updatedAt: "2026-07-28T09:00:00.000Z"
  });
}

function insertExternalRacProject(r: Rig, title: string, path: string): void {
  insertProject(r.db, {
    id: RAC,
    title,
    type: "writing",
    status: "active",
    workspace: { kind: "local_folder", path, managed: false },
    executionModeDefault: "step_confirm",
    createdAt: "2026-07-28T09:00:00.000Z",
    updatedAt: "2026-07-28T09:00:00.000Z"
  });
}

/** 固定结构化起草器(proposeStart 的 cheap 档) */
const drafter: LlmProvider = {
  kind: "api",
  model: "fake-drafter",
  async chat() {
    return {
      ok: true,
      text: JSON.stringify({
        outcomePreview: "README 安装一节带 pnpm 说明",
        inScope: ["README 安装小节"],
        outOfScope: ["其他文档"],
        acceptance: ["安装一节出现 pnpm install 示例", "现有 npm 说明保留"],
        plan: [{ seq: 1, step: "改 README 安装小节", owner: "ai" }],
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

function lastToolResult(messages: ChatMessage[]): Record<string, unknown> {
  const toolMsgs = messages.filter((m) => m.role === "tool");
  const last = toolMsgs[toolMsgs.length - 1];
  return last ? (JSON.parse(last.content) as Record<string, unknown>) : {};
}

interface Rig {
  db: Db;
  dialog: LiveDialog;
  spoken: { sentenceId: string; text: string }[];
  confirm: ConfirmationLoop;
  gate0: { enabled: boolean; bypass: boolean };
  /** rig 的 ~/.saydo 等价目录(sessions/ 转写落盘根;W1.8 回读 e2e 用) */
  home: string;
  ledger: MemoryLedger;
  audit: AuditSink;
  sessions: LiveVoiceSessions;
  brainTools: BrainTools;
}

function buildRig(
  provider: LlmProvider,
  opts: {
    drafter?: LlmProvider | null;
    drafterFor?: () => LlmProvider | null;
    readiness?: Parameters<typeof registerLiveTools>[1]["readiness"];
    readinessFor?: Parameters<typeof registerLiveTools>[1]["readinessFor"];
    storeTranscript?: boolean;
    failProposalAudit?: boolean;
    failAnchorSay?: boolean;
    failReplaySay?: boolean;
    throwReplaySay?: boolean;
    ensureProjectAnchorReady?: (sessionId: string) => boolean;
    postCommitDegraded?: boolean;
    throwPostCommitSay?: boolean;
    throwPostCommitWarn?: boolean;
    failProjectQuestionSayCount?: number;
    projectAnchorQuestionUnasked?: boolean;
    thinkingProvider?: LlmProvider;
    onUserMessageAccepted?: (sessionId: string) => void;
    dialogProviderFor?: (sessionId: string, projectId: string | null) => LlmProvider | null;
    onLlmArrived?: (turnId: string, atMs: number, meta: { toolCallsMade: number; control: boolean }) => void;
  } = {}
): Rig {
  const home = mkdtempSync(join(tmpdir(), "saydo-wiring-"));
  const db = openDb(join(home, "saydo.db"));
  const sqliteAudit = createSqliteAuditSink(db);
  const audit: AuditSink = opts.failProposalAudit
    ? {
        record(event) {
          if (event.action === "project.anchor.proposed") throw new Error("audit unavailable");
          return sqliteAudit.record(event);
        }
      }
    : sqliteAudit;
  if (!opts.projectAnchorQuestionUnasked) {
    audit.record({
      actor: "daemon",
      action: "dialog.project_anchor_question_asked",
      meta: { sessionId: SES, seededForTest: true }
    });
  }
  const baseLog = createLogger({ dir: join(home, "logs"), name: "test" });
  const log: Logger = opts.throwPostCommitWarn
    ? {
        ...baseLog,
        warn(message, fields) {
          if (message === "project anchor post-commit speech failed") throw new Error("logger boom");
          baseLog.warn(message, fields);
        }
      }
    : baseLog;
  const sessions = new LiveVoiceSessions({
    db,
    audit,
    sessions: new SessionManager({ db, audit, storeTranscript: opts.storeTranscript ?? true }),
    saydoHome: home,
    idleSuspendSec: 0
  });
  const spoken: { sentenceId: string; text: string }[] = [];
  let projectQuestionFailuresLeft = opts.failProjectQuestionSayCount ?? 0;
  const say = (sessionId: string, sentenceId: string, text: string): boolean => {
    if (opts.failAnchorSay && sentenceId.startsWith("s-anchor-")) return false;
    if (opts.throwPostCommitSay && sentenceId.endsWith("-ok")) throw new Error("post-commit speech boom");
    if (opts.failReplaySay && sentenceId.startsWith("s-confirm-")) return false;
    if (opts.throwReplaySay && sentenceId.startsWith("s-confirm-")) throw new Error("replay enqueue boom");
    if (text.includes("新事情,还是接着哪个项目继续") && projectQuestionFailuresLeft > 0) {
      projectQuestionFailuresLeft -= 1;
      return false;
    }
    spoken.push({ sentenceId, text });
    return true;
  };
  const ledger = new MemoryLedger({ db, audit });
  const hotwords = new HotwordStore(ledger);
  const factory = new DecisionPackageFactory({ db, artifacts: new ArtifactStore({ db, saydoDir: home }), audit, now: () => new Date() });
  const brainTools = new BrainTools({ db, audit, ...(opts.thinkingProvider ? { thinkingProvider: opts.thinkingProvider } : {}) });
  const confirm = new ConfirmationLoop();
  const gate0 = { enabled: true, bypass: false };
  // A3-armed(段3):rig 与生产同构恒 armed——真实 evidenceFor(现役 confirmed 绑定)
  const readinessEvidence = (_sid: string, projectId: string): ReadinessEvidenceDetail =>
    evidenceFor({ db, ledger, foundationGenerationOf: () => 0 }, projectId);
  const registry = new ToolRegistry();
  registerLiveTools(registry, {
    db,
    audit,
    brainTools,
    factory,
    ledger,
    hotwords,
    sessions,
    confirm,
    say: (sid, id, text) => {
      const enqueued = say(sid, id, text);
      if (enqueued) sessions.onAiSentences(sid, [{ sentenceId: id, text }]);
      return enqueued;
    },
    drafter: opts.drafter === undefined ? drafter : opts.drafter,
    ...(opts.drafterFor ? { drafterFor: opts.drafterFor } : {}),
    gate0: () => gate0,
    devAdapter: () => "cursor",
    taskMaxDefault: () => 20,
    enabledProjectTypes: () => ["coding", "writing"],
    readinessEvidence,
    ...(opts.readiness !== undefined ? { readiness: opts.readiness } : {}),
    ...(opts.readinessFor ? { readinessFor: opts.readinessFor } : {})
  });
  const dialog = new LiveDialog({
    db,
    audit,
    sessions,
    dialogProvider: provider,
    ...(opts.dialogProviderFor ? { dialogProviderFor: opts.dialogProviderFor } : {}),
    ...(opts.onUserMessageAccepted ? { onUserMessageAccepted: opts.onUserMessageAccepted } : {}),
    ...(opts.onLlmArrived ? { onLlmArrived: opts.onLlmArrived } : {}),
    say,
    log,
    registry,
    confirm,
    dispatchDeps: {
      db,
      audit,
      gate0: () => gate0,
      devAdapter: () => "cursor",
      enabledProjectTypes: () => ["coding", "writing"],
      readinessEvidence
    },
    readinessConfirm: (input) => confirmBindings({ db, audit, snapshotter: null, foundationGenerationOf: () => 0 }, input),
    memoryConfirm: (input) => confirmMemoryProposal({ db, ledger, audit }, input),
    projectAnchorAccept: (sessionId, candidate) => ({
      event: acceptProjectAnchor({ db, ledger, audit, candidate, sessionId, now: new Date() }),
      ready: opts.ensureProjectAnchorReady?.(sessionId) ?? true,
      ...(opts.postCommitDegraded ? { postCommitDegraded: true } : {})
    }),
    ...(opts.ensureProjectAnchorReady ? { ensureProjectAnchorReady: opts.ensureProjectAnchorReady } : {}),
    readinessAssemble: (sessionId, projectId) => {
      const row = db.prepare("SELECT type FROM projects WHERE id=?").get(projectId) as { type: ProjectType } | undefined;
      if (!row) return;
      assembleOnSessionStart({ db, audit, evidenceProvider: readinessEvidence }, { sessionId, projectId, type: row.type });
    },
    packDeps: { db, ledger, hotwords }
  });
  return { db, dialog, spoken, confirm, gate0, home, ledger, audit, sessions, brainTools };
}

describe("首跑 once marker 的消息接纳边界", () => {
  it("durable user turn 落盘后才通知；closed session 拒收不通知", async () => {
    const accepted: string[] = [];
    const r = buildRig(
      scriptedProvider(() => ({ ok: true, text: "收到。", observedModel: "fake-dialog", usage: undefined })),
      { onUserMessageAccepted: (sessionId) => accepted.push(sessionId) }
    );

    await r.dialog.onAsrFinal(SES, TURN(1), "先记下这件事");
    expect(accepted).toEqual([SES]);
    expect(r.sessions.historyOf(SES)).toContainEqual({ speaker: "user", text: "先记下这件事" });

    r.db.prepare("UPDATE sessions SET state='closed' WHERE id=?").run(SES);
    await expect(r.dialog.onAsrFinal(SES, TURN(2), "这轮不应被接纳")).rejects.toThrow("session_closed_no_rebuild");
    expect(accepted).toEqual([SES]);
  });

  it("动态 resolver 明确返回 null 时不回退构造期旧 provider", async () => {
    let providerCalls = 0;
    const r = buildRig(
      scriptedProvider(() => {
        providerCalls += 1;
        return { ok: true, text: "不应调用", observedModel: "fake-dialog", usage: undefined };
      }),
      { dialogProviderFor: () => null }
    );

    await r.dialog.onAsrFinal(SES, TURN(1), "测试自检红灯后的下一轮");
    expect(providerCalls).toBe(0);
    expect(r.spoken.at(-1)?.text).toContain("对话模型还没配置");
  });
});

describe("项目归属 live 工具闭环", () => {
  it("归属问句结构闸覆盖新旧项目同义表达且不拦普通陈述", () => {
    for (const text of [
      "这是新仓库，还是旧仓库？",
      "另建一个代码库，还是用原先那个？",
      "单独起一份，还是接着现有仓库？",
      "从头建，还是回老库？",
      "沿用旧项目，还是另开一个新工作区？",
      "你要新建仓库还是沿用旧仓库",
      "新建这个项目，还是沿用原先的？",
      "新建这个项目，还是接着之前的？",
      "要么新建项目，要么沿用旧项目？",
      "你要么新建仓库，要么继续之前的？",
      "这是新项目，还是继续这个项目？",
      "另建一个仓库，还是接着这个仓库？",
      "要么这是新项目，要么继续这个项目？",
      "请问新建项目还是沿用旧项目",
      "请问新项目还是旧项目",
      "请问要么新建项目，要么沿用旧项目"
    ]) {
      expect(isProjectAnchorQuestion(text), text).toBe(true);
    }
    for (const text of [
      "这个新需求会延续现有仓库结构。",
      "新项目将沿用已有工程的测试框架。",
      "新旧项目还是要统一规范。",
      "新仓库还是旧仓库都可以。",
      "无论新仓库还是旧仓库，都要统一权限。",
      "这次会新建仓库，还是先说明旧仓库的迁移风险。",
      "新事情还是接着哪个项目继续都可以。",
      "决定新建仓库还是沿用旧仓库之前，先看成本。",
      "应该新建仓库还是沿用旧仓库，取决于成本。",
      "成本够吗？决定新建仓库还是沿用旧仓库之前，先看预算。",
      "你觉得这个方案好吗？新建仓库还是沿用旧仓库都可以。",
      "决定新建仓库还是沿用旧仓库之前，先看成本够不够？",
      "新建仓库还是沿用旧仓库的决定，明天能给我吗？",
      "决定新建仓库还是沿用旧仓库之前，预算够吗？",
      "决定新建仓库还是沿用旧仓库之前，先确认这个？",
      "决定新建仓库还是沿用旧仓库之前，我们还要继续？",
      "要么新建项目，要么沿用旧项目。",
      "你要么新建仓库，要么继续之前的。",
      "要么新建项目，要么沿用旧项目",
      "新建项目还是？沿用旧项目。"
    ]) {
      expect(isProjectAnchorQuestion(text), text).toBe(false);
    }
  });

  it("显式路径由 daemon 先机械路由，Brain 即使会误调 resolveProject 也不会重复索路", async () => {
    const path = homeFixture(".saydo-live-explicit-route-");
    let providerCalls = 0;
    const r = buildRig(
      scriptedProvider(() => {
        providerCalls += 1;
        return {
          ok: true,
          text: "",
          toolCalls: [{ id: "wrong-route", name: "resolveProject", arguments: "{}" }],
          observedModel: "fake-dialog",
          usage: undefined
        };
      })
    );
    insertExternalRacProject(r, "OctoBlog", path);

    await r.dialog.onAsrFinal(SES, TURN(1), `在 ${path} 继续`);

    expect(providerCalls).toBe(0);
    expect(r.spoken.some((s) => s.text.includes("请直接说它的本地路径"))).toBe(false);
    expect(r.spoken[r.spoken.length - 1]?.text).toBe("我找到这个已有项目了,把刚才的对话挂过去,对吗?");
    expect(r.confirm.pending(SES)?.payload).toMatchObject({ branch: "reanchor_existing", targetId: RAC });
  });

  it("否定、比较和任务载荷路径不进入归属候选", async () => {
    const path = homeFixture(".saydo-live-negative-path-");
    // N0(8/6):空候选时归属问句直接跳过——本测试验证问句路径本身,seed 一个其他 active 项目保留问句
    for (const text of [
      `不要挂到 ${path}，先按新事情继续`,
      `比较 ${path} 和新项目，先不要改归属`,
      `给 ${path} 加 RSS 输出`,
      `先给博客加 RSS 输出，路径是 ${path}`,
      `把 RSS feed 接上，路径是 ${path}`,
      `无需采用这个目录，路径是 ${path}`
    ]) {
      let providerCalls = 0;
      const r = buildRig(
        scriptedProvider(() => {
          providerCalls += 1;
          return { ok: true, text: "不改项目归属。", observedModel: "fake-dialog", usage: undefined };
        }),
        { projectAnchorQuestionUnasked: true }
      );
      insertRacProject(r, "既有项目");

      await r.dialog.onAsrFinal(SES, TURN(1), text);

      expect(providerCalls).toBe(0);
      expect(r.confirm.pending(SES)).toBeUndefined();
      expect(r.spoken.map((item) => item.text)).toEqual(["新事情,还是接着哪个项目继续?"]);
    }
  });

  it("新路径缺类型且 Brain 首次误出通用归属问句时，输出闸只询问类型", async () => {
    const path = homeFixture(".saydo-live-explicit-type-");
    const r = buildRig(
      scriptedProvider(() => ({
        ok: true,
        text: "新事情,还是接着哪个项目继续?",
        observedModel: "fake-dialog",
        usage: undefined
      }))
    );

    await r.dialog.onAsrFinal(SES, TURN(1), `在 ${path} 继续`);

    expect(r.spoken).toEqual([
      {
        sentenceId: `${`s-${TURN(1)}-0`}-anchor-type`,
        text: "我已经收到本地路径,但还需要知道这是写作、开发还是其他类型。"
      }
    ]);
    expect(r.confirm.pending(SES)).toBeUndefined();
    expect(r.spoken.some((s) => s.text.includes("新事情,还是接着哪个项目"))).toBe(false);
    expect(r.spoken.some((s) => s.text.includes("请直接说它的本地路径"))).toBe(false);
  });

  it("用户明确路径后 Brain 调无路径参数工具，daemon 确认 accept 才采用 workspace", async () => {
    const path = homeFixture(".saydo-live-anchor-");
    let providerCalls = 0;
    const provider = scriptedProvider((messages, call, request) => {
      providerCalls = call;
      if (call === 1) {
        expect(messages[0]?.role).toBe("system");
        expect(messages[0]?.content).toContain("调用 proposeProjectAnchor");
        expect(messages[messages.length - 1]?.content).toContain(path);
        const spec = request.tools?.find((tool) => tool.name === "proposeProjectAnchor");
        expect(spec).toBeDefined();
        expect((spec?.parameters["properties"] as Record<string, unknown>)["path"]).toBeUndefined();
        return {
            ok: true,
            text: "",
            toolCalls: [{ id: "anchor-1", name: "proposeProjectAnchor", arguments: JSON.stringify({ type: "writing" }) }],
            observedModel: "fake-dialog",
            usage: undefined
          };
      }
      return { ok: true, text: "接着说 RSS 输出的要求。", observedModel: "fake-dialog", usage: undefined };
    });
    const r = buildRig(provider, { projectAnchorQuestionUnasked: true });
    await r.dialog.onAsrFinal(SES, TURN(1), `在${path}`);
    const pending = r.confirm.pending(SES);
    expect(pending?.payload).toMatchObject({ kind: "project_anchor", branch: "adopt_workspace" });
    expect(r.spoken.filter((s) => s.text.includes("对吗"))).toHaveLength(1);
    expect(providerCalls).toBe(1);
    expect(r.spoken.some((s) => s.text.includes("调了工具"))).toBe(false);
    const before = r.db.prepare("SELECT type FROM projects WHERE id=(SELECT project_id FROM sessions WHERE id=?)").get(SES) as {
      type: string;
    };
    expect(before.type).toBe("pending");

    await r.dialog.onAsrFinal(SES, TURN(2), "可以");
    expect(r.confirm.pending(SES)).toBeUndefined();
    const after = r.db
      .prepare(
        `SELECT p.type, p.status, p.workspace_json, s.project_revision
           FROM sessions s JOIN projects p ON p.id=s.project_id WHERE s.id=?`
      )
      .get(SES) as { type: string; status: string; workspace_json: string; project_revision: number };
    expect(after).toMatchObject({ type: "writing", status: "draft", project_revision: 1 });
    expect(JSON.parse(after.workspace_json)).toEqual({ kind: "local_folder", path, managed: false });
    expect(r.spoken.some((s) => s.text.includes("项目归属已经挂上了"))).toBe(true);

    await r.dialog.onAsrFinal(SES, TURN(3), "还要支持 Atom");
    expect(r.confirm.pending(SES)).toBeUndefined();
    expect(providerCalls).toBe(2);
    expect(r.spoken[r.spoken.length - 1]?.text).toContain("接着说 RSS");
    expect(r.spoken.filter((s) => s.text.includes("新事情,还是接着哪个项目"))).toHaveLength(0);
  });

  it("post-commit degraded 口播承认归属已挂上，不会错误声称这轮没改", async () => {
    const path = homeFixture(".saydo-live-anchor-degraded-");
    const r = buildRig(
      scriptedProvider(() => ({
        ok: true,
        text: "",
        toolCalls: [{ id: "anchor-degraded", name: "proposeProjectAnchor", arguments: '{"type":"writing"}' }],
        observedModel: "fake-dialog",
        usage: undefined
      })),
      { postCommitDegraded: true }
    );

    await r.dialog.onAsrFinal(SES, TURN(1), path);
    await r.dialog.onAsrFinal(SES, TURN(2), "可以");

    expect(r.spoken[r.spoken.length - 1]?.text).toContain("项目归属已经挂上了");
    expect(r.spoken[r.spoken.length - 1]?.text).not.toContain("这轮没改");
    expect(
      (
        r.db.prepare("SELECT project_revision FROM sessions WHERE id=?").get(SES) as {
          project_revision: number;
        }
      ).project_revision
    ).toBe(1);
  });

  it("durable accept 后确认口播异常不会回落到“这轮没改”错误域", async () => {
    const path = homeFixture(".saydo-live-anchor-speech-");
    const r = buildRig(
      scriptedProvider(() => ({
        ok: true,
        text: "",
        toolCalls: [{ id: "anchor-speech", name: "proposeProjectAnchor", arguments: '{"type":"writing"}' }],
        observedModel: "fake-dialog",
        usage: undefined
      })),
      { throwPostCommitSay: true }
    );

    await r.dialog.onAsrFinal(SES, TURN(1), path);
    await r.dialog.onAsrFinal(SES, TURN(2), "可以");

    expect(r.spoken.some((s) => s.text.includes("这轮没改"))).toBe(false);
    expect(
      (
        r.db.prepare("SELECT project_revision FROM sessions WHERE id=?").get(SES) as {
          project_revision: number;
        }
      ).project_revision
    ).toBe(1);
  });

  it("durable accept 后 TTS 与 logger 同时异常也不逃出、不回落到未改错误域", async () => {
    const path = homeFixture(".saydo-live-anchor-log-");
    const r = buildRig(
      scriptedProvider(() => ({
        ok: true,
        text: "",
        toolCalls: [{ id: "anchor-log", name: "proposeProjectAnchor", arguments: '{"type":"writing"}' }],
        observedModel: "fake-dialog",
        usage: undefined
      })),
      { throwPostCommitSay: true, throwPostCommitWarn: true }
    );

    await r.dialog.onAsrFinal(SES, TURN(1), path);
    await expect(r.dialog.onAsrFinal(SES, TURN(2), "可以")).resolves.toBeUndefined();
    expect(r.spoken.some((s) => s.text.includes("这轮没改"))).toBe(false);
    expect(
      (
        r.db.prepare("SELECT project_revision FROM sessions WHERE id=?").get(SES) as {
          project_revision: number;
        }
      ).project_revision
    ).toBe(1);
  });

  it("无路径的新会话只询问归属，不形成可由裸肯定消费的候选", async () => {
    const provider = scriptedProvider((messages) => {
      expect(messages[0]?.content).toContain("本场已经问过通用项目归属问题");
      return {
        ok: true,
        text: "这是新任务，还是继续之前的项目？",
        observedModel: "fake-dialog",
        usage: undefined
      };
    });
    const r = buildRig(provider, { projectAnchorQuestionUnasked: true });
    // N0(8/6):空候选跳问句——seed 其他 active 项目保留问句路径
    insertRacProject(r, "既有项目");
    await r.dialog.onAsrFinal(SES, TURN(1), "我想给博客加一个 RSS 输出");
    expect(r.spoken[r.spoken.length - 1]?.text).toBe("新事情,还是接着哪个项目继续?");
    expect(r.confirm.pending(SES)).toBeUndefined();
    const before = r.db
      .prepare("SELECT project_revision FROM sessions WHERE id=?")
      .get(SES) as { project_revision: number };
    await r.dialog.onAsrFinal(SES, TURN(2), "可以");
    const after = r.db
      .prepare("SELECT project_revision FROM sessions WHERE id=?")
      .get(SES) as { project_revision: number };
    expect(after.project_revision).toBe(before.project_revision);
    expect(r.spoken.filter((s) => s.text.includes("新事情,还是接着哪个项目继续"))).toHaveLength(1);
    expect(r.spoken[r.spoken.length - 1]?.text).toBe("我先按新事情继续。要接已有项目,请直接说本地路径。");
    expect(
      (
        r.db
          .prepare("SELECT COUNT(*) AS c FROM audit_log WHERE action='dialog.project_anchor_question_repeat_blocked'")
          .get() as { c: number }
      ).c
    ).toBe(1);
  });

  it("Brain 改写通用归属问句时仍被 durable 输出闸识别并阻断", async () => {
    const r = buildRig(
      scriptedProvider(() => ({
        ok: true,
        text: "这是新需求。还是回到之前那个项目？",
        observedModel: "fake-dialog",
        usage: undefined
      }))
    );

    await r.dialog.onAsrFinal(SES, TURN(1), "继续说 RSS");

    expect(r.spoken.map((item) => item.text)).toEqual([
      "我先按新事情继续。要接已有项目,请直接说本地路径。"
    ]);
    expect(
      (
        r.db
          .prepare("SELECT COUNT(*) AS c FROM audit_log WHERE action='dialog.project_anchor_question_repeat_blocked'")
          .get() as { c: number }
    ).c
    ).toBe(1);
  });

  it("归属问句位于口播截断范围之后时仍按 provider 完整原文阻断", async () => {
    const r = buildRig(
      scriptedProvider(() => ({
        ok: true,
        text: "第一句。第二句。第三句。第四句。第五句。第六句。第七句。另建一个代码库，还是用原先那个？",
        observedModel: "fake-dialog",
        usage: undefined
      }))
    );

    await r.dialog.onAsrFinal(SES, TURN(1), "继续说 RSS");

    expect(r.spoken.map((item) => item.text)).toEqual([
      "我先按新事情继续。要接已有项目,请直接说本地路径。"
    ]);
  });

  it("已锚定会话不再预路由项目名、路径或 Brain 归属问句", async () => {
    let call = 0;
    const r = buildRig(
      scriptedProvider((messages) => {
        call += 1;
        expect(messages[0]?.content).toContain("当前会话已锚定项目");
        if (call === 1) {
          return {
            ok: true,
            text: "要我开个新档，还是沿用老工程？",
            observedModel: "fake-dialog",
            usage: undefined
          };
        }
        if (call === 2) {
          return {
            ok: true,
            text: "",
            toolCalls: [{ id: "anchored-resolve", name: "resolveProject", arguments: "{}" }],
            observedModel: "fake-dialog",
            usage: undefined
          };
        }
        if (call === 4) {
          return {
            ok: true,
            text: "",
            toolCalls: [{ id: "anchored-path", name: "proposeProjectAnchor", arguments: '{"type":"coding"}' }],
            observedModel: "fake-dialog",
            usage: undefined
          };
        }
        return {
          ok: true,
          text: call === 3 ? "项目名按当前需求内容处理。" : "路径按当前需求内容处理。",
          observedModel: "fake-dialog",
          usage: undefined
        };
      })
    );
    insertRacProject(r, "OctoBlog");
    r.sessions.ensureSession(SES);
    r.db.prepare("UPDATE sessions SET project_revision=1 WHERE id=?").run(SES);

    await r.dialog.onAsrFinal(SES, TURN(1), "继续加 RSS");
    await r.dialog.onAsrFinal(SES, TURN(2), "OctoBlog");
    await r.dialog.onAsrFinal(SES, TURN(3), "/tmp/OctoBlog");

    expect(call).toBe(5);
    expect(r.confirm.pending(SES)).toBeUndefined();
    expect(r.spoken.map((item) => item.text)).toEqual([
      "当前对话已经挂在一个项目上了。请继续说这件事。",
      "项目名按当前需求内容处理。",
      "路径按当前需求内容处理。"
    ]);
    expect(r.spoken.some((item) => item.text.includes("请直接说它的本地路径"))).toBe(false);
    expect(r.spoken.some((item) => item.text.includes("新事情,还是接着哪个项目"))).toBe(false);
  });

  it("active 且 revision=0 的会话即使 Brain 误调 resolveProject 也不播索路", async () => {
    let call = 0;
    const r = buildRig(
      scriptedProvider(() => {
        call += 1;
        if (call === 1) {
          return {
            ok: true,
            text: "",
            toolCalls: [{ id: "active-resolve", name: "resolveProject", arguments: "{}" }],
            observedModel: "fake-dialog",
            usage: undefined
          };
        }
        return {
          ok: true,
          text: "继续处理当前项目的需求。",
          observedModel: "fake-dialog",
          usage: undefined
        };
      })
    );
    insertRacProject(r, "OctoBlog");
    const current = r.sessions.ensureSession(SES).session;
    r.db.prepare("UPDATE projects SET status='active' WHERE id=?").run(current.projectId);

    await r.dialog.onAsrFinal(SES, TURN(1), "OctoBlog");

    expect(call).toBe(2);
    expect(r.spoken.map((item) => item.text)).toEqual(["继续处理当前项目的需求。"]);
    expect(r.confirm.pending(SES)).toBeUndefined();
    expect(
      (
        r.db.prepare("SELECT COUNT(*) AS c FROM audit_log WHERE action='project.resolve.guided'").get() as {
          c: number;
        }
      ).c
    ).toBe(0);
  });

  it("通用归属问题首次 TTS enqueue 失败不会永久标为已问，下一轮仍可重试", async () => {
    const r = buildRig(
      scriptedProvider(() => ({
        ok: true,
        text: "咱们重新开个仓库，还是接着原来的？",
        observedModel: "fake-dialog",
        usage: undefined
      })),
      { failProjectQuestionSayCount: 1, projectAnchorQuestionUnasked: true }
    );

    await r.dialog.onAsrFinal(SES, TURN(1), "我想加 RSS");
    expect(r.spoken).toEqual([]);
    expect(r.sessions.hasAskedProjectAnchorQuestion(SES)).toBe(false);

    await r.dialog.onAsrFinal(SES, TURN(2), "继续说");
    expect(r.spoken.map((s) => s.text)).toEqual(["新事情,还是接着哪个项目继续?"]);
    expect(r.sessions.hasAskedProjectAnchorQuestion(SES)).toBe(true);
    const actions = r.db
      .prepare(
        `SELECT action FROM audit_log
          WHERE action LIKE 'dialog.project_anchor_question_%'
          ORDER BY rowid`
      )
      .all() as { action: string }[];
    expect(actions.map((row) => row.action)).toEqual([
      "dialog.project_anchor_question_reserved",
      "dialog.project_anchor_question_enqueue_failed",
      "dialog.project_anchor_question_reserved",
      "dialog.project_anchor_question_asked"
    ]);
  });

  it("只说项目名走 resolveProject 机械引导，隐私关闭且后续裸肯定均零候选零写入", async () => {
    let calls = 0;
    const provider = scriptedProvider((_messages, call) => {
      calls = call;
      return { ok: true, text: "先按新事情继续。", observedModel: "fake-dialog", usage: undefined };
    });
    const r = buildRig(provider, { storeTranscript: false });
    insertRacProject(r, "OctoBlog");

    await r.dialog.onAsrFinal(SES, TURN(1), "在 OctoBlog 上继续");
    expect(calls).toBe(0);
    expect(r.spoken[r.spoken.length - 1]?.text).toBe("我听到你想接着已有项目。请直接说它的本地路径。");
    expect(r.confirm.pending(SES)).toBeUndefined();
    const before = r.db
      .prepare("SELECT project_id, project_revision FROM sessions WHERE id=?")
      .get(SES) as { project_id: string; project_revision: number };
    const transcriptPath = (
      r.db.prepare("SELECT transcript_path FROM sessions WHERE id=?").get(SES) as { transcript_path: string }
    ).transcript_path;
    expect(existsSync(transcriptPath)).toBe(false);

    await r.dialog.onAsrFinal(SES, TURN(2), "好");
    const after = r.db
      .prepare("SELECT project_id, project_revision FROM sessions WHERE id=?")
      .get(SES) as { project_id: string; project_revision: number };
    expect(after).toEqual(before);
    expect(r.confirm.pending(SES)).toBeUndefined();
  });

  it("普通需求即使含唯一项目名且 Brain 误调 resolveProject，也不会被改写成索要路径", async () => {
    let calls = 0;
    const provider = scriptedProvider((_messages, call) => {
      calls = call;
      if (call === 1) {
        return {
          ok: true,
          text: "",
          toolCalls: [{ id: "resolve-demand", name: "resolveProject", arguments: "{}" }],
          observedModel: "fake-dialog",
          usage: undefined
        };
      }
      return { ok: true, text: "收到，先把 RSS 输出需求梳理清楚。", observedModel: "fake-dialog", usage: undefined };
    });
    const r = buildRig(provider);
    insertRacProject(r, "OctoBlog");

    await r.dialog.onAsrFinal(SES, TURN(1), "给 OctoBlog 加一个 RSS 输出");

    expect(calls).toBe(2);
    expect(r.spoken[r.spoken.length - 1]?.text).toBe("收到，先把 RSS 输出需求梳理清楚。");
    expect(r.spoken.some((s) => s.text.includes("请直接说它的本地路径"))).toBe(false);
    expect(
      (
        r.db
          .prepare("SELECT COUNT(*) AS c FROM audit_log WHERE action='project.resolve.guided'")
          .get() as { c: number }
      ).c
    ).toBe(0);
  });

  it("新用户轮先到时旧轮工具调用失效，不从持久化转写回捞路径", async () => {
    const path = homeFixture(".saydo-live-anchor-race-");
    let releaseFirst!: () => void;
    let markStarted!: () => void;
    const firstStarted = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let calls = 0;
    const provider: LlmProvider = {
      kind: "api",
      model: "fake-dialog",
      async chat() {
        calls += 1;
        if (calls === 1) {
          markStarted();
          await firstGate;
          return withModelEvidence({
            ok: true,
            text: "",
            toolCalls: [{ id: "anchor-race", name: "proposeProjectAnchor", arguments: '{"type":"writing"}' }],
            observedModel: "fake-dialog",
            usage: undefined
          });
        }
        return withModelEvidence({ ok: true, text: "新一轮已收到。", observedModel: "fake-dialog", usage: undefined });
      }
    };
    const r = buildRig(provider);
    const oldTurn = r.dialog.onAsrFinal(SES, TURN(1), path);
    await firstStarted;
    await r.dialog.onAsrFinal(SES, TURN(2), "这是新一轮");
    releaseFirst();
    await oldTurn;

    expect(r.confirm.pending(SES)).toBeUndefined();
    const row = r.db
      .prepare("SELECT p.type, s.project_revision FROM sessions s JOIN projects p ON p.id=s.project_id WHERE s.id=?")
      .get(SES) as { type: string; project_revision: number };
    expect(row).toEqual({ type: "pending", project_revision: 0 });
  });

  it("只说项目名的旧异步轮同样失效，不会迟到播路径引导", async () => {
    let releaseFirst!: () => void;
    let markStarted!: () => void;
    const firstStarted = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let calls = 0;
    const provider: LlmProvider = {
      kind: "api",
      model: "fake-dialog",
      async chat() {
        calls += 1;
        if (calls === 1) {
          markStarted();
          await firstGate;
          return withModelEvidence({
            ok: true,
            text: "",
            toolCalls: [{ id: "resolve-race", name: "resolveProject", arguments: "{}" }],
            observedModel: "fake-dialog",
            usage: undefined
          });
        }
        return withModelEvidence({ ok: true, text: "新一轮已收到。", observedModel: "fake-dialog", usage: undefined });
      }
    };
    const r = buildRig(provider, { storeTranscript: false });
    insertRacProject(r, "OctoBlog");
    const oldTurn = r.dialog.onAsrFinal(SES, TURN(1), "这是关于 OctoBlog 的新需求");
    await firstStarted;
    await r.dialog.onAsrFinal(SES, TURN(2), "这是新一轮");
    const spokenAfterNewTurn = [...r.spoken];
    releaseFirst();
    await oldTurn;

    expect(r.spoken).toEqual(spokenAfterNewTurn);
    expect(r.spoken.some((s) => s.text.includes("请直接说它的本地路径"))).toBe(false);
    expect(r.confirm.pending(SES)).toBeUndefined();
    expect(
      (
        r.db.prepare("SELECT project_revision FROM sessions WHERE id=?").get(SES) as {
          project_revision: number;
        }
      ).project_revision
    ).toBe(0);
  });

  it("provider 等待中会话挂起会失效当前轮，释放后零工具零口播零 pending", async () => {
    let release!: () => void;
    let started!: () => void;
    const providerStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const provider: LlmProvider = {
      kind: "api",
      model: "fake-dialog",
      async chat() {
        started();
        await gate;
        return withModelEvidence({
          ok: true,
          text: "",
          toolCalls: [{ id: "resolve-after-suspend", name: "resolveProject", arguments: "{}" }],
          observedModel: "fake-dialog",
          usage: undefined
        });
      }
    };
    const r = buildRig(provider, { storeTranscript: false });
    insertRacProject(r, "OctoBlog");
    const oldTurn = r.dialog.onAsrFinal(SES, TURN(1), "这是关于 OctoBlog 的新需求");
    await providerStarted;

    r.sessions.suspend(SES);
    release();
    await oldTurn;

    expect(r.spoken).toEqual([]);
    expect(r.confirm.pending(SES)).toBeUndefined();
    expect(
      (
        r.db.prepare("SELECT state, project_revision FROM sessions WHERE id=?").get(SES) as {
          state: string;
          project_revision: number;
        }
      )
    ).toEqual({ state: "suspended", project_revision: 0 });
  });

  it("barge-in 在下一条 ASR final 前立即使旧模型轮失效,取消结果零口播零工具", async () => {
    let started!: () => void;
    const providerStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    const provider: LlmProvider = {
      kind: "api",
      model: "fake-dialog",
      async chat(_req, signal) {
        started();
        await new Promise<void>((resolve) => signal?.addEventListener("abort", () => resolve(), { once: true }));
        return { ok: false, code: "cancelled", message: "cancelled", retryable: false };
      }
    };
    const r = buildRig(provider, { storeTranscript: false });
    const oldTurn = r.dialog.onAsrFinal(SES, TURN(1), "给博客加 RSS 输出");
    await providerStarted;

    r.dialog.onBargeIn(SES, "s-interrupted");
    await oldTurn;

    expect(r.spoken).toEqual([]);
    expect(r.brainTools.latestDraft(SES)).toBeUndefined();
    expect(r.confirm.pending(SES)).toBeUndefined();
  });

  it("tool 内部 provider 等待中挂起会失效当前轮，释放后零草稿零审计零口播", async () => {
    let releaseThinking!: () => void;
    let thinkingStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      thinkingStarted = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      releaseThinking = resolve;
    });
    const thinkingProvider: LlmProvider = {
      kind: "api",
      model: "fake-thinking",
      async chat() {
        thinkingStarted();
        await gate;
        return withModelEvidence({
          ok: true,
          text: "我理解要给博客加 RSS 输出。",
          observedModel: "fake-thinking",
          usage: undefined
        });
      }
    };
    const provider = scriptedProvider(() => ({
      ok: true,
      text: "",
      toolCalls: [
        {
          id: "create-after-suspend",
          name: "createTask",
          arguments: JSON.stringify({ rawPoints: ["给博客加 RSS 输出"] })
        }
      ],
      observedModel: "fake-dialog",
      usage: undefined
    }));
    const r = buildRig(provider, { thinkingProvider, storeTranscript: false });
    const oldTurn = r.dialog.onAsrFinal(SES, TURN(1), "给博客加 RSS 输出");
    await started;

    r.sessions.suspend(SES);
    releaseThinking();
    await oldTurn;

    expect(r.brainTools.latestDraft(SES)).toBeUndefined();
    expect(
      (r.db.prepare("SELECT COUNT(*) AS c FROM audit_log WHERE action='tool.createTask'").get() as { c: number }).c
    ).toBe(0);
    expect(r.spoken).toEqual([]);
  });

  it("隐私关闭时当前 heard turn 仍可提案，但不产生转写文件", async () => {
    const path = homeFixture(".saydo-live-anchor-private-");
    const provider = scriptedProvider(() => ({
      ok: true,
      text: "",
      toolCalls: [{ id: "anchor-private", name: "proposeProjectAnchor", arguments: '{"type":"writing"}' }],
      observedModel: "fake-dialog",
      usage: undefined
    }));
    const r = buildRig(provider, { storeTranscript: false });
    await r.dialog.onAsrFinal(SES, TURN(1), path);
    expect(r.confirm.pending(SES)?.payload).toMatchObject({ kind: "project_anchor" });
    expect(r.spoken.filter((s) => s.text.includes("对吗"))).toHaveLength(1);
    const row = r.db.prepare("SELECT transcript_path FROM sessions WHERE id=?").get(SES) as {
      transcript_path: string;
    };
    expect(existsSync(row.transcript_path)).toBe(false);
  });

  it.each([
    ["proposal audit", { failProposalAudit: true }],
    ["TTS enqueue", { failAnchorSay: true }]
  ])("%s 失败不 arm pending，随后裸肯定无项目写入", async (_label, opts) => {
    const path = homeFixture(".saydo-live-anchor-fail-");
    const provider = scriptedProvider((_messages, call) =>
      call === 1
        ? {
            ok: true,
            text: "",
            toolCalls: [{ id: "anchor-fail", name: "proposeProjectAnchor", arguments: '{"type":"writing"}' }],
            observedModel: "fake-dialog",
            usage: undefined
          }
        : { ok: true, text: "这轮没有形成确认。", observedModel: "fake-dialog", usage: undefined }
    );
    const r = buildRig(provider, opts);
    await r.dialog.onAsrFinal(SES, TURN(1), path);
    expect(r.confirm.pending(SES)).toBeUndefined();
    await r.dialog.onAsrFinal(SES, TURN(2), "可以");
    const row = r.db
      .prepare("SELECT p.type, s.project_revision FROM sessions s JOIN projects p ON p.id=s.project_id WHERE s.id=?")
      .get(SES) as { type: string; project_revision: number };
    expect(row).toEqual({ type: "pending", project_revision: 0 });
  });

  it.each([
    ["返回 false", { failReplaySay: true }],
    ["抛异常", { throwReplaySay: true }]
  ])("barge-in 后确认重播 enqueue %s，后续裸肯定仍不改项目归属", async (_label, opts) => {
    const path = homeFixture(".saydo-live-anchor-replay-");
    const provider = scriptedProvider(() => ({
      ok: true,
      text: "",
      toolCalls: [{ id: "anchor-replay", name: "proposeProjectAnchor", arguments: '{"type":"writing"}' }],
      observedModel: "fake-dialog",
      usage: undefined
    }));
    const r = buildRig(provider, opts);
    await r.dialog.onAsrFinal(SES, TURN(1), path);
    const pending = r.confirm.pending(SES);
    expect(pending).toBeDefined();
    r.dialog.onBargeIn(SES, pending!.sentenceId);

    await r.dialog.onAsrFinal(SES, TURN(2), "好");
    await r.dialog.onAsrFinal(SES, TURN(3), "好");

    expect(r.confirm.pending(SES)).toBeDefined();
    expect(r.confirm.presentations.current(SES)?.invalidatedAt).toBe("replay_pending");
    const row = r.db
      .prepare("SELECT p.type, s.project_revision FROM sessions s JOIN projects p ON p.id=s.project_id WHERE s.id=?")
      .get(SES) as { type: string; project_revision: number };
    expect(row).toEqual({ type: "pending", project_revision: 0 });
  });

  it("readiness/Pack durable 双闸未追平时，下一轮不调用 provider/tool", async () => {
    const path = homeFixture(".saydo-live-anchor-rebuild-");
    let providerCalls = 0;
    const provider = scriptedProvider((_messages, call) => {
      providerCalls = call;
      return {
        ok: true,
        text: "",
        toolCalls: [{ id: "anchor-rebuild", name: "proposeProjectAnchor", arguments: '{"type":"writing"}' }],
        observedModel: "fake-dialog",
        usage: undefined
      };
    });
    const r = buildRig(provider, { ensureProjectAnchorReady: () => false });
    await r.dialog.onAsrFinal(SES, TURN(1), path);
    await r.dialog.onAsrFinal(SES, TURN(2), "可以");
    await r.dialog.onAsrFinal(SES, TURN(3), "继续");
    expect(providerCalls).toBe(1);
    expect(r.spoken.some((s) => s.text.includes("上下文还在重建"))).toBe(true);
  });
});

/** 深评组前置(armed 后骨架先过绿才到深评门;04 §2.2 分层):建 coding 项目 + SES 会话 + cover critical */
function armSession(r: Rig): void {
  insertRacProject(r, "深评组");
  r.db
    .prepare(
      `INSERT INTO sessions(id, project_id, state, engine, transcript_path, started_at)
       VALUES (?, 'prj_01RAC000000000000000000000', 'talking', 'cascade', ?, '2026-07-28T09:00:00.000Z')`
    )
    .run(SES, join(r.home, "transcript-deep.jsonl"));
  coverReadiness(r, SES);
}

/**
 * 就绪覆盖 helper(armed 主链前置):走真实链——候选 claim(带 key + user 转写锚)落账本 →
 * listCandidates → confirmBindings 升格(不 mock 表)。缺省只 cover critical(建议态放行语义
 * 一并锻炼:非 critical unknown ⇒ gap_knowledge/gap_requirement 仍可组包,10 #42)。
 */
function coverReadiness(rig: Rig, sessionId: string, opts: { criticalOnly?: boolean } = {}): void {
  const sess = rig.db.prepare("SELECT project_id FROM sessions WHERE id=?").get(sessionId) as { project_id: string } | undefined;
  if (!sess) throw new Error(`no session: ${sessionId}`);
  const projectId = sess.project_id;
  const trow = rig.db.prepare("SELECT type FROM projects WHERE id=?").get(projectId) as { type: ProjectType };
  const checklist = READINESS_CHECKLISTS[trow.type] ?? [];
  const keys = (opts.criticalOnly !== false ? checklist.filter((d) => d.critical) : checklist).map((d) => d.key);
  const turnId = newId("ses");
  for (const key of keys) {
    rig.ledger.add({
      tier: "M2",
      projectId,
      claim: `已采访:${key}`,
      source: { kind: "user_utterance", ref: turnId },
      requestedTrust: "user_stated",
      readinessKey: key
    });
  }
  const candidates = listCandidates({ db: rig.db, ledger: rig.ledger }, projectId, trow.type).filter((c) => keys.includes(c.key));
  confirmBindings(
    { db: rig.db, audit: rig.audit, snapshotter: null, foundationGenerationOf: () => 0 },
    { sessionId, turnId, projectId, receiptId: newId("rrc"), candidates }
  );
}

/** 派单剧本:轮1 创建草稿+组包+播就绪提议;轮2(用户"开始")签发收据 */
function dispatchScript(): (messages: ChatMessage[], call: number) => ScriptedResult {
  let packageId = "";
  let revision = 0;
  return (messages, call) => {
    const meta = { observedModel: "fake-dialog", usage: undefined };
    if (call === 1) {
      return {
        ok: true,
        text: "",
        toolCalls: [
          { id: "c1", name: "createTask", arguments: JSON.stringify({ rawPoints: ["README 安装一节补 pnpm 说明", "验收:出现 pnpm install 示例"] }) }
        ],
        ...meta
      };
    }
    if (call === 2) {
      const r = lastToolResult(messages);
      return {
        ok: true,
        text: "",
        toolCalls: [{ id: "c2", name: "proposeStart", arguments: JSON.stringify({ taskDraftId: r["taskDraftId"] }) }],
        ...meta
      };
    }
    if (call === 3) {
      const r = lastToolResult(messages);
      packageId = String(r["packageId"]);
      revision = Number(r["revision"]);
      return { ok: true, text: "我这边评估过了,可以开始了。做完你会得到:README 安装一节带 pnpm 说明。预计封顶 20 元。", ...meta };
    }
    if (call === 4) {
      // 轮2:用户说"开始吧" -> Brain 签发收据(确认句由 daemon 锁定档播出)
      return {
        ok: true,
        text: "",
        toolCalls: [{ id: "c3", name: "issueDispatchReceipt", arguments: JSON.stringify({ packageId, revision }) }],
        ...meta
      };
    }
    return { ok: true, text: "收到。", ...meta };
  };
}

let rig: Rig;

describe("T18a 运行时槽位热生效", () => {
  it("cheap 不缓存启动时 unarmed,调用时通过 drafterFor 消费最新 provider", async () => {
    let resolutions = 0;
    rig = buildRig(scriptedProvider(dispatchScript()), {
      drafter: null,
      drafterFor: () => {
        resolutions += 1;
        return drafter;
      }
    });
    armSession(rig);

    await rig.dialog.onAsrFinal(SES, TURN(1), "帮我把 README 的安装一节补个 pnpm 说明");

    expect(resolutions).toBeGreaterThan(0);
    expect((rig.db.prepare("SELECT COUNT(*) AS c FROM decision_packages").get() as { c: number }).c).toBe(1);
  });
});

describe("语音派单全链(e2e:派单 -> 确认词表 -> 任务创建)", () => {
  beforeEach(() => {
    rig = buildRig(scriptedProvider(dispatchScript()));
    // RA-closeout(owner 裁决 (a) 案 2026-07-28):pending 首包可出、不可拍板——全链剧本按新产品流程
    // 预先定型会话项目(= "owner 说开始 → promoteProject" 已发生;pending 拍板拒另有专项用例)
    insertRacProject(rig, "全链");
    rig.db
      .prepare(
        `INSERT INTO sessions(id, project_id, state, engine, transcript_path, started_at)
         VALUES (?, 'prj_01RAC000000000000000000000', 'talking', 'cascade', ?, '2026-07-28T09:00:00.000Z')`
      )
      .run(SES, join(rig.home, "transcript-ra.jsonl"));
    // A3-armed(段3):armed 后 propose 需 critical 全 confirmed——主链前置真实覆盖链
    // (候选 claim → confirmBindings 升格;非 critical 留空 = 建议态放行语义一并锻炼,10 #42)
    coverReadiness(rig, SES);
  });

  it("createTask -> proposeStart -> issueDispatchReceipt -> 词表 accept -> consume -> 任务入队(queued)", async () => {
    await rig.dialog.onAsrFinal(SES, TURN(1), "帮我把 README 的安装一节补个 pnpm 说明,要有 pnpm install 示例");
    // 就绪提议已播(#10 形态;状态词零违规)
    expect(rig.spoken.some((s) => s.text.includes("可以开始了"))).toBe(true);

    await rig.dialog.onAsrFinal(SES, TURN(2), "开始吧");
    // daemon 锁定档确认句已播(复述关键参数:成果 + 封顶;10 §2.5 确认文法)
    const confirmSay = rig.spoken.find((s) => s.sentenceId.startsWith("s-confirm-apr_"));
    expect(confirmSay?.text).toContain("README 安装一节带 pnpm 说明");
    expect(confirmSay?.text).toContain("封顶 20 元");
    expect(rig.confirm.pending(SES)).toBeDefined();

    await rig.dialog.onAsrFinal(SES, TURN(3), "可以");
    // 词表环 accept -> consume -> 包 approved -> 任务 queued(状态词纪律:排队,不说执行/完成)
    expect(rig.spoken.some((s) => s.text.includes("排进队列"))).toBe(true);
    for (const s of rig.spoken) expect(checkStatusWords(s.text).ok, `状态词违规: ${s.text}`).toBe(true);

    const task = rig.db.prepare("SELECT status, route, adapter FROM tasks").get() as {
      status: string;
      route: string;
      adapter: string;
    };
    expect(task).toEqual({ status: "queued", route: "tier1", adapter: "cursor" });
    const receipt = rig.db.prepare("SELECT decided_via, outcome, decision, turn_ref FROM approvals").get() as {
      decided_via: string;
      outcome: string;
      decision: string;
      turn_ref: string;
    };
    expect(receipt).toMatchObject({ decided_via: "voice", outcome: "consumed", decision: "accept" });
    expect(rig.confirm.presentations.current(SES)).toBeUndefined();
    expect(receipt.turn_ref).toBe(TURN(2)); // turnRef = 签发那一轮(daemon 自取,不信 Brain 报)
    const pkg = rig.db.prepare("SELECT status FROM decision_packages ORDER BY revision DESC LIMIT 1").get() as { status: string };
    expect(pkg.status).toBe("approved");
    // 审计链:dispatch.voice_confirmed + task.dispatch 都在
    const actions = (rig.db.prepare("SELECT action FROM audit_log").all() as { action: string }[]).map((r) => r.action);
    expect(actions).toContain("dispatch.voice_confirmed");
    expect(actions).toContain("task.dispatch");
    // 转写落盘:三轮 user + AI 轮都在
    const mgr = new SessionManager({ db: rig.db, audit: { record: () => ({ id: "aud_x" }) } });
    const turns = mgr.readTurns(SES);
    expect(turns.filter((t) => t.speaker === "user")).toHaveLength(3);
  });

  it("含糊答复:第一次复读原文,第二次转屏(收据留 pending,不消费)", async () => {
    await rig.dialog.onAsrFinal(SES, TURN(1), "帮我把 README 的安装一节补个 pnpm 说明");
    await rig.dialog.onAsrFinal(SES, TURN(2), "开始吧");
    const prompt = rig.confirm.pending(SES)?.promptText;
    expect(prompt).toBeTruthy();

    // "嗯再说吧" = session-2 现场清单的含糊样例(无肯定/否定词命中 => unmatched;
    // 注意"先看看别的"会因否定词"别"子串命中判 reject——10 §2.5 否定优先,宁误拒,是合同行为)
    await rig.dialog.onAsrFinal(SES, TURN(4), "嗯再说吧");
    // 复读 = 原文重放(10 §3-3)
    expect(rig.spoken[rig.spoken.length - 1]?.text).toBe(prompt);
    expect(rig.confirm.pending(SES)).toBeDefined();

    await rig.dialog.onAsrFinal(SES, TURN(5), "那个什么来着");
    expect(rig.spoken[rig.spoken.length - 1]?.text).toContain("屏幕");
    expect(rig.confirm.pending(SES)).toBeUndefined(); // 转屏后语音侧不再等
    expect(rig.confirm.presentations.current(SES)).toBeUndefined();
    const receipt = rig.db.prepare("SELECT outcome, decision FROM approvals").get() as { outcome: string; decision: string | null };
    expect(receipt).toEqual({ outcome: "pending", decision: null }); // 未消费(按超时档终局)
    const tasks = (rig.db.prepare("SELECT COUNT(*) AS c FROM tasks").get() as { c: number }).c;
    expect(tasks).toBe(0);
  });

  it("barge-in 作废 presentation:随后裸'好'不消费,完整重播后才可确认(A8)", async () => {
    await rig.dialog.onAsrFinal(SES, TURN(1), "帮我把 README 的安装一节补个 pnpm 说明");
    await rig.dialog.onAsrFinal(SES, TURN(2), "开始吧");
    const pendingBefore = rig.confirm.pending(SES);
    expect(pendingBefore).toBeDefined();

    // 确认句播报中被打断
    rig.dialog.onBargeIn(SES, pendingBefore!.sentenceId);
    await rig.dialog.onAsrFinal(SES, TURN(6), "好");
    // 裸"好"未消费:收据仍 pending 无 decision,确认句已完整重播
    const receipt = rig.db.prepare("SELECT outcome, decision FROM approvals").get() as { outcome: string; decision: string | null };
    expect(receipt).toEqual({ outcome: "pending", decision: null });
    expect(rig.spoken[rig.spoken.length - 1]?.text).toBe(pendingBefore!.promptText);
    expect((rig.db.prepare("SELECT COUNT(*) AS c FROM tasks").get() as { c: number }).c).toBe(0);

    // 重播后再说"好" -> 正常消费
    await rig.dialog.onAsrFinal(SES, TURN(7), "好");
    expect((rig.db.prepare("SELECT COUNT(*) AS c FROM tasks").get() as { c: number }).c).toBe(1);
    expect(rig.confirm.presentations.current(SES)).toBeUndefined();
  });

  it("否定答复:收据 rejected,不建任务", async () => {
    await rig.dialog.onAsrFinal(SES, TURN(1), "帮我把 README 的安装一节补个 pnpm 说明");
    await rig.dialog.onAsrFinal(SES, TURN(2), "开始吧");
    await rig.dialog.onAsrFinal(SES, TURN(8), "算了,不要");
    const receipt = rig.db.prepare("SELECT outcome, decision FROM approvals").get() as { outcome: string; decision: string };
    expect(receipt).toEqual({ outcome: "rejected", decision: "reject" });
    expect((rig.db.prepare("SELECT COUNT(*) AS c FROM tasks").get() as { c: number }).c).toBe(0);
    expect(rig.confirm.presentations.current(SES)).toBeUndefined();
  });

  it("Gate 0 未关(bypass=true)拒 dispatch:accept 后播安全门禁话术,无任务行(#16)", async () => {
    rig.gate0.bypass = true;
    await rig.dialog.onAsrFinal(SES, TURN(1), "帮我把 README 的安装一节补个 pnpm 说明");
    await rig.dialog.onAsrFinal(SES, TURN(2), "开始吧");
    await rig.dialog.onAsrFinal(SES, TURN(9), "可以");
    expect(rig.spoken[rig.spoken.length - 1]?.text).toContain("安全门禁");
    expect((rig.db.prepare("SELECT COUNT(*) AS c FROM tasks").get() as { c: number }).c).toBe(0);
    // 收据 decision=accept 但未 consume(dispatch 被 Gate 0 挡;fail-closed)
    const receipt = rig.db.prepare("SELECT outcome, decision FROM approvals").get() as { outcome: string; decision: string };
    expect(receipt).toEqual({ outcome: "pending", decision: "accept" });
  });

  it("B2 回归(impl-readback 回收批 2):收据被 sweep 终局后用户再答'可以'——听到过期话术,不抛异常,不派发", async () => {
    await rig.dialog.onAsrFinal(SES, TURN(1), "帮我把 README 的安装一节补个 pnpm 说明");
    await rig.dialog.onAsrFinal(SES, TURN(2), "开始吧"); // 确认句已播,pending 在内存
    // 模拟 15s sweep 已将未决收据按档终局(sweep 对未决张的落库形态 = timeout_parked,scheduler.ts;
    // 回收批 2 复审 C-4:expired 仅与 decision=accept 成对,未决张用 expired 是状态机不可达组合)
    rig.db.prepare("UPDATE approvals SET outcome='timeout_parked'").run();
    await rig.dialog.onAsrFinal(SES, TURN(9), "可以"); // 旧实现:applyReceiptEvent 抛 terminal,用户零反馈
    expect(rig.spoken[rig.spoken.length - 1]?.text).toContain("过期");
    expect((rig.db.prepare("SELECT COUNT(*) AS c FROM tasks").get() as { c: number }).c).toBe(0); // 不派发
  });

  it("时效复验(code-review A1 反例):悬挂的 accept+pending 收据过期后补发被拒,收据转 expired 终态", async () => {
    // 造悬挂张:Gate 0 拒使 accept+pending 残留(上一用例同型)
    rig.gate0.bypass = true;
    await rig.dialog.onAsrFinal(SES, TURN(1), "帮我把 README 的安装一节补个 pnpm 说明");
    await rig.dialog.onAsrFinal(SES, TURN(2), "开始吧");
    await rig.dialog.onAsrFinal(SES, TURN(9), "可以");
    rig.gate0.bypass = false; // 门禁恢复
    const receipt = rig.db.prepare("SELECT id, ref_digest FROM approvals").get() as { id: string; ref_digest: string };
    const pkg = rig.db.prepare("SELECT id, revision FROM decision_packages ORDER BY revision DESC LIMIT 1").get() as {
      id: string;
      revision: number;
    };
    // 时间前进越过 expiresAt(45s 窗口)-> Brain 补发 confirmAndDispatch 应被拒 + 收据置 expired
    const { dispatchApprovedPackage } = await import("../src/brain/liveTools.js");
    const audit = createSqliteAuditSink(rig.db);
    expect(() =>
      dispatchApprovedPackage(
        {
          db: rig.db,
          audit,
          gate0: () => rig.gate0,
          devAdapter: () => "cursor",
          enabledProjectTypes: () => ["coding", "writing"],
          now: () => new Date(Date.now() + 10 * 60_000) // +10min > 45s 时效
        },
        { packageId: pkg.id, revision: pkg.revision, mode: "step_confirm", receiptId: receipt.id }
      )
    ).toThrow(/expired/);
    const after = rig.db.prepare("SELECT outcome FROM approvals WHERE id=?").get(receipt.id) as { outcome: string };
    expect(after.outcome).toBe("expired"); // 09 §3:expired 的唯一语义;人回来签发新收据
    expect((rig.db.prepare("SELECT COUNT(*) AS c FROM tasks").get() as { c: number }).c).toBe(0);
  });
});

describe("W1.4 深评触发装配(09 §13 分层 + §11 规则 6 调用律;proposeStart fail-closed 门)", () => {
  const mkReadiness = (
    dims: () => { dims: import("@saydo/contracts").Claim[]; verifications: never[] },
    evalText: string,
    home: string,
    calls: { n: number }
  ): NonNullable<Parameters<typeof registerLiveTools>[1]["readiness"]> => ({
    evaluator: {
      kind: "api",
      model: "fake-evaluator",
      async chat() {
        calls.n += 1;
        return withModelEvidence({ ok: true, text: evalText, observedModel: "fake-evaluator", usage: undefined });
      }
    },
    governor: new DeepReviewGovernor({ maxPerSession: 3, cooldownMs: 0 }),
    dims,
    saydoDir: home
  });

  it("critical claim 无证据 ⇒ 深评 gap_critical ⇒ proposeStart 拒(不组包);评估落 deep 行", async () => {
    const calls = { n: 0 };
    const criticalDims = (): { dims: import("@saydo/contracts").Claim[]; verifications: never[] } => ({
      dims: [
        {
          text: "requirement:删除范围涉及生产数据,回滚方案未确认",
          source: { kind: "user_utterance", ref: TURN(1) },
          confidence: "low",
          critical: true,
          state: "unknown"
        }
      ],
      verifications: []
    });
    // 剧本:轮1 createTask;轮2 proposeStart(应被深评门拒);轮3 复述工具错误
    const script = (messages: ChatMessage[], call: number): ScriptedResult => {
      const meta = { observedModel: "fake-dialog", usage: undefined };
      if (call === 1) {
        return {
          ok: true,
          text: "",
          toolCalls: [{ id: "c1", name: "createTask", arguments: JSON.stringify({ rawPoints: ["清理历史数据", "验收:生产表行数只减不增"] }) }],
          ...meta
        };
      }
      if (call === 2) {
        const r = lastToolResult(messages);
        return {
          ok: true,
          text: "",
          toolCalls: [{ id: "c2", name: "proposeStart", arguments: JSON.stringify({ taskDraftId: r["taskDraftId"] }) }],
          ...meta
        };
      }
      const last = lastToolResult(messages);
      return { ok: true, text: `评估未通过:${String(last["code"] ?? "")}`, ...meta };
    };
    const asmDir = mkdtempSync(join(tmpdir(), "saydo-w14-asm-"));
    rig = buildRig(scriptedProvider(script), {
      readiness: mkReadiness(criticalDims, JSON.stringify({ perClaim: [] }), asmDir, calls)
    });
    armSession(rig); // A3-armed:骨架先绿(cover critical)才到深评门(04 §2.2 分层)
    await rig.dialog.onAsrFinal(SES, TURN(1), "帮我清理一下历史数据");
    await rig.dialog.onAsrFinal(SES, TURN(2), "可以开始了吗");

    // 深评真被触发(evaluator 被调)且 fail-closed:critical 无 binding ⇒ unknown ⇒ gap_critical ⇒ 拒。
    // 注:错误码 "readiness_gap_critical"(长 snake_case)被 TTS redactor 按疑似凭据脱敏——语音断言
    // 只认自然语话术,机器可判面走库内副作用(下方 SQL)
    expect(calls.n).toBe(1);
    expect(rig.spoken.some((s) => s.text.includes("评估未通过"))).toBe(true);
    // 不组包(决策包零行);评估可审计重建行落库(layer=deep)
    expect((rig.db.prepare("SELECT COUNT(*) AS c FROM decision_packages").get() as { c: number }).c).toBe(0);
    const asm = rig.db
      .prepare("SELECT layer, verdict, evaluator_model FROM readiness_assessments WHERE layer='deep'")
      .all() as { layer: string; verdict: string; evaluator_model: string }[];
    expect(asm).toHaveLength(1);
    expect(asm[0]).toEqual({ layer: "deep", verdict: "gap_critical", evaluator_model: "fake-evaluator" });
  });

  it("governor 调用律(A1 回修锚):同 digest 重试不重评但**照拒**(缓存 verdict 裁决,重试不是放行)", async () => {
    const calls = { n: 0 };
    const criticalDims = (): { dims: import("@saydo/contracts").Claim[]; verifications: never[] } => ({
      dims: [
        {
          text: "requirement:同一证据指纹",
          source: { kind: "user_utterance", ref: TURN(1) },
          confidence: "low",
          critical: true,
          state: "unknown"
        }
      ],
      verifications: []
    });
    const script = (messages: ChatMessage[], call: number): ScriptedResult => {
      const meta = { observedModel: "fake-dialog", usage: undefined };
      if (call === 1) {
        return {
          ok: true,
          text: "",
          toolCalls: [{ id: "c1", name: "createTask", arguments: JSON.stringify({ rawPoints: ["要点"] }) }],
          ...meta
        };
      }
      // LLM 收到 tool error 后习惯性重试:连发 proposeStart 直到工具环步数上限——
      // 旧实现(A1)第二次 duplicate 拒被当放行会组包;修后每次都以缓存 verdict 照拒
      const r = lastToolResult(messages);
      if (call <= 4) {
        return {
          ok: true,
          text: "",
          toolCalls: [
            { id: `c${call}`, name: "proposeStart", arguments: JSON.stringify({ taskDraftId: r["taskDraftId"] ?? "d?" }) }
          ],
          ...meta
        };
      }
      return { ok: true, text: "评估没过,先补证据。", ...meta };
    };
    const asmDir = mkdtempSync(join(tmpdir(), "saydo-w14-asm2-"));
    rig = buildRig(scriptedProvider(script), { readiness: mkReadiness(criticalDims, JSON.stringify({ perClaim: [] }), asmDir, calls) });
    armSession(rig);
    await rig.dialog.onAsrFinal(SES, TURN(1), "先建个草稿,然后开始");
    expect(calls.n).toBe(1); // 同 digest 重试不再调 evaluator(成本控制仍成立)
    // A1 回归锚:重试后仍零决策包(缓存 gap_critical 照拒——重试即绕过被封死)
    expect((rig.db.prepare("SELECT COUNT(*) AS c FROM decision_packages").get() as { c: number }).c).toBe(0);
  });

  it("governor throttled(cap 耗尽无缓存;A1 回修锚):proposeStart fail-closed 拒,不静默放行", async () => {
    const calls = { n: 0 };
    const criticalDims = (): { dims: import("@saydo/contracts").Claim[]; verifications: never[] } => ({
      dims: [
        {
          text: "requirement:新证据但配额耗尽",
          source: { kind: "user_utterance", ref: TURN(1) },
          confidence: "low",
          critical: true,
          state: "unknown"
        }
      ],
      verifications: []
    });
    const script = (messages: ChatMessage[], call: number): ScriptedResult => {
      const meta = { observedModel: "fake-dialog", usage: undefined };
      if (call === 1) {
        return {
          ok: true,
          text: "",
          toolCalls: [{ id: "c1", name: "createTask", arguments: JSON.stringify({ rawPoints: ["要点"] }) }],
          ...meta
        };
      }
      if (call === 2) {
        const r = lastToolResult(messages);
        return {
          ok: true,
          text: "",
          toolCalls: [{ id: "c2", name: "proposeStart", arguments: JSON.stringify({ taskDraftId: r["taskDraftId"] }) }],
          ...meta
        };
      }
      const last = lastToolResult(messages);
      return { ok: true, text: `深评暂不可用:${String(last["code"] ?? "")}`, ...meta };
    };
    const asmDir = mkdtempSync(join(tmpdir(), "saydo-w14-asm3-"));
    const readiness = mkReadiness(criticalDims, JSON.stringify({ perClaim: [] }), asmDir, calls);
    // cap=0:任何新评估都被上限拒且无缓存 = throttled
    readiness.governor = new DeepReviewGovernor({ maxPerSession: 0, cooldownMs: 0 });
    rig = buildRig(scriptedProvider(script), { readiness });
    armSession(rig);
    await rig.dialog.onAsrFinal(SES, TURN(1), "建草稿并开始");
    expect(calls.n).toBe(0); // evaluator 未被调(cap 拒)
    expect((rig.db.prepare("SELECT COUNT(*) AS c FROM decision_packages").get() as { c: number }).c).toBe(0); // 仍拒组包
    expect(rig.spoken.some((s) => s.text.includes("深评暂不可用"))).toBe(true);
  });
});

describe("M1 走查补齐:rebuilt 会话重新装配(A3-armed 消费点口径,09 §13)", () => {
  it("suspended 会话重呼(rebuilt)⇒ 再落一行 assemble 评估(created/rebuilt 同触发)", async () => {
    const script = (): ScriptedResult => ({ ok: true, text: "在。", observedModel: "fake-dialog", usage: undefined });
    rig = buildRig(scriptedProvider(script));
    insertRacProject(rig, "rebuilt");
    rig.db
      .prepare(
        `INSERT INTO sessions(id, project_id, state, engine, transcript_path, started_at)
         VALUES (?, 'prj_01RAC000000000000000000000', 'suspended', 'cascade', ?, '2026-07-28T09:00:00.000Z')`
      )
      .run(SES, join(rig.home, "transcript-rb.jsonl"));
    // suspended 会话首轮 = rebuild 路径(daemon 重启后重建同构)
    await rig.dialog.onAsrFinal(SES, TURN(1), "接着聊");
    const assembles = (
      rig.db.prepare("SELECT meta_json FROM audit_log WHERE action='readiness.skeleton_assemble'").all() as { meta_json: string }[]
    ).length;
    expect(assembles).toBe(1); // rebuilt 触发装配(修前 = 0:只认 created)
  });
});

describe("W1.8 转写 ref 口径统一(09 §4 ref=裸 turnId;Codex 18 A-2 断裂修复)", () => {
  it("remember 自取 ref=裸 turnId -> 快照器命中转写行产 §4.1 locator -> verify fresh+match(回读闭环)", async () => {
    const rememberScript = (messages: ChatMessage[], call: number): ScriptedResult => {
      void messages;
      const meta = { observedModel: "fake-dialog", usage: undefined };
      if (call === 1) {
        return {
          ok: true,
          text: "",
          toolCalls: [
            {
              id: "m1",
              name: "remember",
              arguments: JSON.stringify({ tier: "M1", claim: "核心论点:导出功能是给财务对账用的", trust: "user_stated" })
            }
          ],
          ...meta
        };
      }
      return { ok: true, text: "这条我记下了。", ...meta };
    };
    rig = buildRig(scriptedProvider(rememberScript));
    await rig.dialog.onAsrFinal(SES, TURN(1), "我说清楚,这个导出功能是给财务对账用的");

    // daemon 自取的 source:ref = 裸 turnId(09 §4),不是 snapshotLocator 形态(旧病灶)
    const mem = rig.db
      .prepare("SELECT source_json FROM memory_events WHERE claim LIKE '%财务对账%'")
      .get() as { source_json: string };
    const source = JSON.parse(mem.source_json) as { kind: "user_utterance"; ref: string };
    expect(source.kind).toBe("user_utterance");
    expect(source.ref).toBe(TURN(1));
    expect(source.ref.startsWith("transcript:")).toBe(false);

    // 回读抽查全链:capture 按裸 turnId 命中 sessions/<sid>.jsonl,产出 §4.1 snapshotLocator
    const { Snapshotter } = await import("../src/evaluator/snapshotter.js");
    const { verifyBinding } = await import("../src/evaluator/verify.js");
    const snap = new Snapshotter({ db: rig.db, saydoDir: rig.home, workspace: rig.home });
    const s = snap.capture(source);
    expect(s.snapshotLocator).toBe(`transcript:${SES}#${TURN(1)}`);
    const v = verifyBinding({ claimDigest: "d", snapshot: s, quote: "给财务对账用" });
    expect(v.integrity).toBe("intact");
    expect(v.freshness).toBe("fresh");
    expect(v.quoteMatch).toBe("match");
  });
});

describe("10 §4-1 结果句式运行时闸(RA-closeout dogfood 修复;golden s1-b2 的生产 gate,Codex 21 B5 最小形态)", () => {
  it("零任务下 Brain 自发结果句式:违规句被拦不播 + 审计留痕;同轮合规句照播(逐句拦不整轮丢)", async () => {
    const gateRig = buildRig(
      scriptedProvider(() => ({
        ok: true,
        text: "执行和检查都跑完了,等你验收。顺便说一句,今天天气不错。",
        observedModel: "fake-dialog",
        usage: undefined
      }))
    );
    // 新会话自动建 pending 草稿项目——零任务语境(不用 beforeEach 预建的定型项目/SES,独立会话)
    const gateSes = newId("ses");
    gateRig.audit.record({
      actor: "daemon",
      action: "dialog.project_anchor_question_asked",
      meta: { sessionId: gateSes, seededForTest: true }
    });
    await gateRig.dialog.onAsrFinal(gateSes, newId("ses"), "进展如何?");
    const said = gateRig.spoken.map((s) => s.text).join(" ");
    expect(said).not.toContain("跑完了");
    expect(said).not.toContain("等你验收");
    expect(said).toContain("天气不错"); // 合规句照播
    const n = (
      gateRig.db.prepare("SELECT COUNT(*) AS c FROM audit_log WHERE action='dialog.result_phrase_blocked'").get() as { c: number }
    ).c;
    expect(n).toBeGreaterThanOrEqual(1);
    // GAP-02 2.3:审计行不含句子原文,只有 sentenceId + textDigest(sha256 hex)
    const rows = gateRig.db
      .prepare("SELECT meta_json FROM audit_log WHERE action='dialog.result_phrase_blocked'")
      .all() as { meta_json: string }[];
    for (const row of rows) {
      expect(row.meta_json).not.toContain("跑完了");
      expect(row.meta_json).not.toContain("等你验收");
      const meta = JSON.parse(row.meta_json) as Record<string, unknown>;
      expect(meta["text"]).toBeUndefined();
      expect(typeof meta["sentenceId"]).toBe("string");
      expect(meta["textDigest"]).toMatch(/^sha256:[0-9a-f]{64}$/);
    }
  });

  it("有活跃任务时结果句式放行(getStatus 转述场景;§4-1 违规判定 = 零任务语境)", async () => {
    const okRig = buildRig(
      scriptedProvider(() => ({
        ok: true,
        text: "执行和检查都跑完了,等你验收。",
        observedModel: "fake-dialog",
        usage: undefined
      }))
    );
    const okSes = newId("ses");
    await okRig.dialog.onAsrFinal(okSes, newId("ses"), "随便聊聊"); // 首轮触发 ensureSession 建 pending 项目
    okRig.spoken.length = 0;
    const prj = (okRig.db.prepare("SELECT project_id AS p FROM sessions WHERE id=?").get(okSes) as { p: string }).p;
    okRig.db.prepare("UPDATE projects SET type='coding' WHERE id=?").run(prj);
    okRig.db
      .prepare(
        `INSERT INTO tasks(id, project_id, title, spec_markdown, route, status, adapter, cwd, budget_json, created_at, updated_at)
         VALUES (?, ?, 't', 's', 'tier1', 'ready_for_review', 'cursor', '/tmp', '{}', datetime('now'), datetime('now'))`
      )
      .run(newId("tsk"), prj);
    await okRig.dialog.onAsrFinal(okSes, newId("ses"), "进展如何?");
    expect(okRig.spoken.map((s) => s.text).join(" ")).toContain("等你验收"); // 有待验收任务 ⇒ 转述放行
  });
});

describe("SD-2 全链:remember(M0) → 机械确认句 → 词表裁决 → memoryConfirm 写账本(2026-09-08)", () => {
  const CLAIM_M0 = "用户偏好:发布前不用再问我";
  const m0Script = (_messages: ChatMessage[], call: number): ScriptedResult => {
    const meta = { observedModel: "fake-dialog", usage: undefined };
    if (call === 1) {
      return {
        ok: true,
        text: "",
        toolCalls: [{ id: "m0", name: "remember", arguments: JSON.stringify({ tier: "M0", claim: CLAIM_M0, trust: "user_stated" }) }],
        ...meta
      };
    }
    return { ok: true, text: "记下了。", ...meta };
  };
  const m0Rows = (r: Rig) =>
    r.db.prepare("SELECT tier, trust, claim, source_json FROM memory_events WHERE op='add' AND tier='M0'").all() as Array<{ tier: string; trust: string; claim: string; source_json: string }>;

  it("封闭肯定 ⇒ 一条 M0(user_approved,来源锚=提议轮)+ 口播“记住了”;确认前账本零 M0、不播“记下了”", async () => {
    rig = buildRig(scriptedProvider(m0Script));
    await rig.dialog.onAsrFinal(SES, TURN(1), "以后发布前不用再问我");
    expect(m0Rows(rig)).toEqual([]);
    expect(rig.spoken.some((s) => s.text.includes("记下了"))).toBe(false);
    expect(rig.spoken.at(-1)?.text).toBe(`有一条关于你的偏好:${CLAIM_M0}。记不记?`);
    expect(rig.confirm.pending(SES)?.payload.kind).toBe("memory");

    await rig.dialog.onAsrFinal(SES, TURN(2), "好");
    const rows = m0Rows(rig);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ tier: "M0", trust: "user_approved", claim: CLAIM_M0 });
    expect(JSON.parse(rows[0]!.source_json)).toEqual({ kind: "user_utterance", ref: TURN(1) });
    expect(rig.spoken.at(-1)?.text).toBe("记住了。");
    expect(rig.confirm.pending(SES)).toBeUndefined();
    const audit = rig.db.prepare("SELECT action FROM audit_log WHERE action IN ('memory.m0_proposed','memory.m0_confirmed') ORDER BY ts").all() as Array<{ action: string }>;
    expect(audit.map((a) => a.action)).toEqual(["memory.m0_proposed", "memory.m0_confirmed"]);
  });

  it("否认 ⇒ 零写入 + “这条不记”", async () => {
    rig = buildRig(scriptedProvider(m0Script));
    await rig.dialog.onAsrFinal(SES, TURN(1), "以后发布前不用再问我");
    await rig.dialog.onAsrFinal(SES, TURN(2), "不要");
    expect(m0Rows(rig)).toEqual([]);
    expect(rig.spoken.at(-1)?.text).toBe("好,这条不记。");
  });
});

describe("GAP-02 2.4 延迟观测真实接线(live/dialog.ts → onLlmArrived → LatencyCollector)", () => {
  it("文本轮:onAsrFinal 后 onLlmArrived 带 {toolCallsMade:0, control:false},collector 以 text origin 记 llm_first_token", async () => {
    const collector = new LatencyCollector();
    const seen: Array<{ turnId: string; meta: { toolCallsMade: number; control: boolean } }> = [];
    const rig = buildRig(
      scriptedProvider(() => ({ ok: true, text: "好的,我在。", observedModel: "fake-dialog", usage: undefined })),
      {
        onLlmArrived: (turnId, atMs, meta) => {
          seen.push({ turnId, meta });
          collector.record(turnId, "llm_first_token", atMs, meta.toolCallsMade > 0 ? "tool" : meta.control ? "control" : undefined);
        }
      }
    );
    const turnId = newId("ses");
    collector.start(turnId, "text", 0);
    await rig.dialog.onAsrFinal(SES, turnId, "在吗");
    expect(seen).toHaveLength(1);
    expect(seen[0]!.turnId).toBe(turnId);
    expect(seen[0]!.meta).toEqual({ toolCallsMade: 0, control: false });
    expect(collector.pendingSize()).toBe(1);
    expect(collector.countsSnapshot().started).toBe(1);
    // 同轮再来一次 llm_first_token(重复)不复活也不重复计
    collector.record(turnId, "llm_first_token", 5);
    expect(collector.countsSnapshot().duplicate).toBe(1);
  });
});
