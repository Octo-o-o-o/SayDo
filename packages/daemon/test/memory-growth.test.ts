// W2 阶段 C(05 §4 提前批 #4;04 §1.2/§1.3;09 §4/§5):
// 会后提炼闭环(suspend -> 机械提名 candidate -> 人批 -> trusted -> M1 -> pack 消费)+
// 奠基生产接线(bootstrap -> 账本 -> 旧代失效 -> m1-notes 投影)+
// generation 失效(重奠基 ⇒ memoryGeneration 合成变 ⇒ packDigest 变,旧 pack 不复现)+
// kill -9 一致性(current.json 唯一真相源;半切换自愈)。

import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { newId } from "@saydo/contracts";
import { openDb, type Db } from "../src/storage/db.js";
import { createSqliteAuditSink } from "../src/storage/dao/misc.js";
import { insertProject } from "../src/storage/dao/projects.js";
import { insertMemoryEvent } from "../src/storage/dao/memory.js";
import { MemoryLedger } from "../src/memory/ledger.js";
import { FoundationBuilder } from "../src/memory/foundation.js";
import { bootstrapProjectFoundation } from "../src/memory/foundationOps.js";
import { approveCandidate, isNominatable, nominateFromSession, projectM1Notes, rejectCandidate } from "../src/memory/growth.js";
import { isMemorySecretLiteralError, MemorySecretLiteralError, memorySecretLiteralReject } from "../src/memory/credentialLiterals.js";
import { compileLivePack, effectiveMemoryGeneration } from "../src/live/pack.js";
import { SessionManager } from "../src/session/manager.js";
import { LiveVoiceSessions } from "../src/live/voiceSessions.js";
import { HotwordStore } from "../src/memory/hotwords.js";
import type { AuditSink } from "../src/obs/audit.js";
import { managedProjectPath } from "../src/projects/workspace.js";

const PRJ = "prj_01GR0W0000000000000000000A";
const OWNER_TEST_ROOT = mkdtempSync(join(process.cwd(), ".saydo-memory-growth-"));

let home: string;
let db: Db;
let audit: AuditSink;
let ledger: MemoryLedger;

function makeRepo(): string {
  const dir = mkdtempSync(join(OWNER_TEST_ROOT, "repo-"));
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "t@t.local"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "t"], { cwd: dir });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "fx", version: "1.0.0", scripts: { test: "true" } }));
  writeFileSync(join(dir, "README.md"), "fixture\n");
  writeFileSync(join(dir, "main.ts"), "export {};\n");
  execFileSync("git", ["add", "-A"], { cwd: dir });
  execFileSync("git", ["commit", "-qm", "init"], { cwd: dir });
  return dir;
}

function seedProject(repo: string): void {
  insertProject(db, {
    id: PRJ,
    title: "生长闭环夹具",
    type: "coding",
    status: "active",
    workspace: { kind: "local_folder", path: repo, managed: false },
    executionModeDefault: "step_confirm",
    createdAt: "2026-07-26T12:00:00.000Z",
    updatedAt: "2026-07-26T12:00:00.000Z"
  });
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "saydo-grow-"));
  db = openDb(join(home, "saydo.db"));
  audit = createSqliteAuditSink(db);
  ledger = new MemoryLedger({ db, audit });
});

afterAll(() => {
  rmSync(OWNER_TEST_ROOT, { recursive: true, force: true });
});

describe("机械提名判定(只提名、人批准;保守窄口)", () => {
  it("决策性陈述入选;问句/指令/过短过长/无标记 不入选", () => {
    expect(isNominatable("这个项目以后都统一用 pnpm 管依赖")).toBe(true);
    expect(isNominatable("接口口径是驼峰,数据库列名蛇形")).toBe(true);
    expect(isNominatable("我们要不要统一用 pnpm 吗?")).toBe(false); // 问句
    expect(isNominatable("帮我去执行 rm -rf dist")).toBe(false); // 指令(isImperative)
    expect(isNominatable("就用它")).toBe(false); // 过短
    expect(isNominatable(`决定${"很".repeat(130)}长`)).toBe(false); // 过长
    expect(isNominatable("今天天气不错聊聊别的什么呢随便说说")).toBe(false); // 无决策标记
  });
});

describe("提炼闭环 e2e(suspend -> 提名 -> 人批 -> trusted -> M1 -> pack 消费)", () => {
  it("全链:会话挂起产生候选;批准转 user_approved 进投影与 pack;拒绝退场不复活", () => {
    const repo = makeRepo();
    seedProject(repo);
    // 组装同 index.ts 接线形态:onSuspend 里从对话史提名
    const sessions = new LiveVoiceSessions({
      db,
      audit,
      sessions: new SessionManager({ db, audit, storeTranscript: true }),
      saydoHome: home,
      idleSuspendSec: 0,
      onSuspend: (sessionId) => {
        const srow = db.prepare("SELECT project_id FROM sessions WHERE id=?").get(sessionId) as { project_id: string };
        const userTurns = live.historyOf(sessionId).filter((t) => t.speaker === "user").map((t) => t.text);
        nominateFromSession({ ledger, audit }, { sessionId, projectId: srow.project_id, userTurns });
      }
    });
    const live = sessions;
    const SID = "ses_01GR0WE2E00000000000000001";
    live.ensureSession(SID);
    // 把 draft 项目换绑到夹具项目(ensureSession 开口即建 draft;e2e 用固定项目断言 pack)
    db.prepare("UPDATE sessions SET project_id=? WHERE id=?").run(PRJ, SID);
    live.onUserTurn(SID, "trn_01GR0WT0000000000000000001", "这个项目以后都统一用 pnpm 管依赖");
    live.onUserTurn(SID, "trn_01GR0WT0000000000000000002", "另外接口口径是驼峰,数据库列名蛇形");
    live.onUserTurn(SID, "trn_01GR0WT0000000000000000003", "今天进展怎么样?");
    live.suspend(SID);

    // 提名落账本:两条 candidate(问句不提)
    const cands = ledger.project().filter((m) => m.trust === "candidate" && m.projectId === PRJ);
    expect(cands).toHaveLength(2);
    expect(cands.every((c) => c.tier === "M1" && c.source.kind === "user_utterance")).toBe(true);

    // 候选不进 pack 的 trusted 面(renderPackText 会带 [候选未确认] 标注,编译入选但非 trusted)——
    // 本验收看批准前后 trusted 集变化。按 claim 定位(同毫秒 ULID 随机段排序不定,下标脆)
    const c1 = cands.find((c) => c.claim.includes("pnpm"))!;
    const c2 = cands.find((c) => c.claim.includes("蛇形"))!;
    const approved = approveCandidate({ ledger, audit }, c1.id);
    expect(approved.op).toBe("add");
    rejectCandidate({ ledger, audit }, c2.id);

    const after = ledger.project().filter((m) => m.projectId === PRJ);
    const trusted = after.filter((m) => m.trust === "user_approved");
    expect(trusted).toHaveLength(1);
    expect(trusted[0]!.claim).toBe(c1.claim);
    // 拒绝的退场(forget_soft 不复活);原候选被 supersedes 退场
    expect(after.find((m) => m.id === c2.id)).toBeUndefined();
    expect(after.find((m) => m.id === c1.id)).toBeUndefined();

    // pack 消费:批准的结论进 M1 切片
    const pack = compileLivePack(
      { db, ledger, hotwords: new HotwordStore(ledger) },
      { sessionId: SID, projectId: PRJ, userText: "pnpm 依赖" }
    );
    expect(pack).not.toBeNull();
    expect(pack!.packText).toContain("统一用 pnpm");

    // m1-notes 投影(人可读;trusted only)
    projectM1Notes(ledger, PRJ, repo);
    const notes = readFileSync(join(repo, ".saydo", "knowledge", "m1-notes.md"), "utf8");
    expect(notes).toContain("统一用 pnpm");
    expect(notes).toContain("用户确认");
    expect(notes).not.toContain("蛇形"); // 拒绝的不进投影
    // 重复提名不产生新候选(同 claim 已在投影)
    nominateFromSession({ ledger, audit }, { sessionId: SID, projectId: PRJ, userTurns: [c1.claim] });
    expect(ledger.project().filter((m) => m.trust === "candidate" && m.projectId === PRJ)).toHaveLength(0);
  });

  it("迟到评审 B2 回收:被拒候选不复活——同 claim 再次挂起不重提名(forget_soft 历史入去重集)", () => {
    const claim = "这个项目以后都统一用 pnpm 管依赖";
    const [cand] = nominateFromSession({ ledger, audit }, { sessionId: "ses_01GR0WREJ0000000000000001", projectId: PRJ, userTurns: [claim] });
    expect(cand).toBeDefined();
    rejectCandidate({ ledger, audit }, cand!.id);
    // 会话 resume 后再挂起,同句重扫:不得复活
    const again = nominateFromSession({ ledger, audit }, { sessionId: "ses_01GR0WREJ0000000000000002", projectId: PRJ, userTurns: [claim] });
    expect(again).toHaveLength(0);
  });

  it("迟到评审 C3 回收:去重限项目——他项目同文案不抑制本项目提名", () => {
    const claim = "接口口径是驼峰,数据库列名统一用蛇形";
    const OTHER = "prj_01GR0W0THER00000000000000B";
    insertProject(db, {
      id: OTHER,
      title: "他项目",
      type: "coding",
      status: "active",
      workspace: { kind: "local_folder", path: managedProjectPath(OTHER), managed: true },
      executionModeDefault: "step_confirm",
      createdAt: "2026-07-26T12:00:00.000Z",
      updatedAt: "2026-07-26T12:00:00.000Z"
    });
    ledger.add({ tier: "M1", projectId: OTHER, claim, source: { kind: "user_utterance", ref: "trn_x" } });
    const out = nominateFromSession({ ledger, audit }, { sessionId: "ses_01GR0WXPRJ0000000000000001", projectId: PRJ, userTurns: [claim] });
    expect(out).toHaveLength(1); // 本项目未记录过,照常提名
  });

  it("非 candidate 不可批/拒(fail-closed);上限 5 条/会话", () => {
    const stated = ledger.add({
      tier: "M1",
      projectId: PRJ,
      claim: "用户亲述的事实",
      source: { kind: "user_utterance", ref: "t1" },
      requestedTrust: "user_stated"
    });
    expect(() => approveCandidate({ ledger, audit }, stated.id)).toThrow(/candidate/);
    expect(() => rejectCandidate({ ledger, audit }, stated.id)).toThrow(/candidate/);
    const turns = Array.from({ length: 8 }, (_, i) => `第${i}项决定了就用方案${i}号来处理这个模块`);
    const out = nominateFromSession({ ledger, audit }, { sessionId: "ses_01GR0WX1M00000000000000001", projectId: PRJ, userTurns: turns });
    expect(out).toHaveLength(5);
  });
});

describe("奠基生产接线 + generation 失效(IMPL-5 §3-C 验收)", () => {
  it("bootstrap:事实入账本(auto_low_impact)+ m1-notes 投影 + AGENTS.md 指针块含 m1-notes 行", () => {
    const repo = makeRepo();
    seedProject(repo);
    const r = bootstrapProjectFoundation({ db, ledger, audit }, PRJ);
    expect(r.ok).toBe(true);
    expect(r.generation).toBe(1);
    expect(r.factsEmitted).toBeGreaterThan(0);
    const facts = ledger.project().filter((m) => m.projectId === PRJ);
    expect(facts.some((m) => m.claim.includes("语言主体") && m.trust === "auto_low_impact")).toBe(true);
    expect(readFileSync(join(repo, ".saydo", "knowledge", "m1-notes.md"), "utf8")).toContain("机械事实");
    expect(readFileSync(join(repo, "AGENTS.md"), "utf8")).toContain("m1-notes.md");
  });

  it("重奠基:旧代事实 invalidate 不堆积;generation+1 ⇒ effectiveMemoryGeneration 变 ⇒ packDigest 变(同输入)", () => {
    const repo = makeRepo();
    seedProject(repo);
    const sm = new SessionManager({ db, audit, storeTranscript: true });
    sm.create({ id: "ses_01GR0WGEN00000000000000001", projectId: PRJ, transcriptPath: join(home, "s.jsonl") });

    expect(bootstrapProjectFoundation({ db, ledger, audit }, PRJ).generation).toBe(1);
    const gen1 = effectiveMemoryGeneration(db, ledger, PRJ);
    const pack1 = compileLivePack(
      { db, ledger, hotwords: new HotwordStore(ledger), now: () => new Date("2026-07-26T12:00:00.000Z") },
      { sessionId: "ses_01GR0WGEN00000000000000001", projectId: PRJ, userText: "固定输入" }
    );
    // 清 parent 链(排除 parentPackDigest 干扰,单看 memoryGeneration 的失效力)
    db.prepare("UPDATE sessions SET context_digest=NULL WHERE id=?").run("ses_01GR0WGEN00000000000000001");

    const r2 = bootstrapProjectFoundation({ db, ledger, audit }, PRJ);
    expect(r2.generation).toBe(2);
    expect(r2.invalidatedOld).toBeGreaterThan(0);
    // 旧代 gen-1 事实退场,只剩 gen-2(不堆积)
    const gen2Facts = ledger.project().filter((m) => m.projectId === PRJ && m.source.ref.startsWith("foundation@"));
    expect(gen2Facts.every((m) => m.source.ref.startsWith("foundation@gen-2"))).toBe(true);

    expect(effectiveMemoryGeneration(db, ledger, PRJ)).toBe(gen1 + 1);
    const pack2 = compileLivePack(
      { db, ledger, hotwords: new HotwordStore(ledger), now: () => new Date("2026-07-26T12:00:00.000Z") },
      { sessionId: "ses_01GR0WGEN00000000000000001", projectId: PRJ, userText: "固定输入" }
    );
    expect(pack2!.packDigest).not.toBe(pack1!.packDigest); // 旧 pack 失效(签名域 memoryGeneration 变)
    // forget_hard 推进点仍然生效(合成和的另一半):ledger generation 变同样使 digest 变(既有 §12-4 覆盖删除面)
  });

  it("批末终审 B1:奠基代读失败不倒退(last-known 下限;IO 抖动不得使 generation 从 L+F 退到 L)", () => {
    const repo = makeRepo();
    seedProject(repo);
    bootstrapProjectFoundation({ db, ledger, audit }, PRJ);
    const g1 = effectiveMemoryGeneration(db, ledger, PRJ);
    expect(g1).toBeGreaterThanOrEqual(1);
    // 模拟 current.json 损坏(IO 异常态):读失败取 last-known,不静默归零
    writeFileSync(join(repo, ".saydo", "foundation", "current.json"), "{corrupted");
    expect(effectiveMemoryGeneration(db, ledger, PRJ)).toBe(g1);
  });

  it("kill -9 一致性:current.json 是唯一真相源;半切换(指针新/symlink 旧)下次奠基自愈", () => {
    const repo = makeRepo();
    seedProject(repo);
    bootstrapProjectFoundation({ db, ledger, audit }, PRJ);
    const knowledgeDir = join(repo, ".saydo", "knowledge");
    const foundationDir = join(repo, ".saydo", "foundation");
    // 模拟两次 rename 之间崩溃:current.json 已指 gen-2,knowledge/current symlink 仍指 gen-1
    const fakeManifest = `manifest-gen-2.json`;
    writeFileSync(
      join(foundationDir, fakeManifest),
      JSON.stringify({ ...JSON.parse(readFileSync(join(foundationDir, "manifest-gen-1.json"), "utf8")), generation: 2 })
    );
    writeFileSync(join(foundationDir, "current.json"), JSON.stringify({ generation: 2, manifest: fakeManifest }));
    // 此刻:指针(真相源)= 2,symlink(消费视图)= gen-1 —— currentGeneration 以指针为准
    const b = new FoundationBuilder({ workspace: repo });
    expect(b.currentGeneration()).toBe(2);
    expect(effectiveMemoryGeneration(db, ledger, PRJ)).toBe(2);
    // 下次奠基自愈:gen-3 发布后指针与 symlink 一致
    const r3 = bootstrapProjectFoundation({ db, ledger, audit }, PRJ);
    expect(r3.generation).toBe(3);
    expect(b.currentGeneration()).toBe(3);
    expect(readFileSync(join(knowledgeDir, "current", "core.md"), "utf8")).toContain("generation 3");
    // manifest 文件存在且与指针一致(manifest/generation 一致性)
    expect(existsSync(join(foundationDir, "manifest-gen-3.json"))).toBe(true);
  });

  it("奠基发布失败保留旧 generation(staging 校验失败不动指针;工作区缺失 fail-closed)", () => {
    const repo = makeRepo();
    seedProject(repo);
    expect(bootstrapProjectFoundation({ db, ledger, audit }, PRJ).generation).toBe(1);
    // 工作区路径失踪:fail-closed 报错,不动 generation
    rmSync(repo, { recursive: true, force: true });
    const r = bootstrapProjectFoundation({ db, ledger, audit }, PRJ);
    expect(r.ok).toBe(false);
    expect(r.code).toBe("workspace_identity_changed");
  });

  it("非法 projectId 快速失败(invalid_project_id;OctoDesk 首奠实测坑:publish 后 ledger 才炸会翻转已发布 generation)", () => {
    const r = bootstrapProjectFoundation({ db, ledger, audit }, "prj_bad-id");
    expect(r).toMatchObject({ ok: false, code: "invalid_project_id" });
  });

  it("无工作区项目奠基拒(no_workspace);managed 空文件夹可奠基(非 git 浅扫)", () => {
    const managedId = "prj_01GR0WMANAGED000000000000B";
    const managed = managedProjectPath(managedId);
    mkdirSync(managed, { recursive: true });
    writeFileSync(join(managed, "notes.md"), "# 计划\n");
    insertProject(db, {
      id: managedId,
      title: "托管文件夹",
      type: "general",
      status: "active",
      workspace: { kind: "local_folder", path: managed, managed: true },
      executionModeDefault: "step_confirm",
      createdAt: "2026-07-26T12:00:00.000Z",
      updatedAt: "2026-07-26T12:00:00.000Z"
    });
    try {
      const r = bootstrapProjectFoundation({ db, ledger, audit }, managedId);
      expect(r.ok).toBe(true);
    } finally {
      rmSync(managed, { recursive: true, force: true });
    }
  });
});

describe("AS-01/AS-02 生长闭环隐私闸", () => {
  function secretToken(): string {
    return ["sk", "-", "C".repeat(16)].join("");
  }

  it("nominate 一轮命中不阻断其余轮,审计带 skipped", () => {
    const secret = secretToken();
    const dirty = `这个项目以后都统一用 ${secret}`;
    const clean = "接口口径是驼峰,数据库列名统一用蛇形";
    const out = nominateFromSession(
      { ledger, audit },
      { sessionId: "ses_01GR0WPRIV0000000000000001", projectId: PRJ, userTurns: [dirty, clean] }
    );
    expect(out).toHaveLength(1);
    expect(out[0] && out[0].op === "add" ? out[0].claim : "").toBe(clean);
    expect(ledger.project().some((m) => m.claim.includes(secret))).toBe(false);
    const row = db.prepare("SELECT meta_json FROM audit_log WHERE action=?").get("memory.session_nominated") as
      | { meta_json: string }
      | undefined;
    expect(row).toBeDefined();
    const meta = JSON.parse(row!.meta_json) as { count: number; skipped: number };
    expect(meta.count).toBe(1);
    expect(meta.skipped).toBe(1);
    expect(row!.meta_json).not.toContain(secret);
  });

  it("bootstrap 首次命中 => foundation_first_build_unavailable", () => {
    const repo = makeRepo();
    const secret = secretToken();
    writeFileSync(join(repo, "AGENTS.md"), `# 约定\n- 密钥 ${secret}\n`);
    seedProject(repo);
    const r = bootstrapProjectFoundation({ db, ledger, audit }, PRJ);
    expect(r.ok).toBe(false);
    expect(r.code).toBe("foundation_build_restricted");
    expect(r.failureClass).toBe("foundation_first_build_unavailable");
    expect(r.generation).toBeUndefined();
    expect(existsSync(join(repo, ".saydo", "foundation", "staging-gen-1"))).toBe(false);
    expect(JSON.stringify(r)).not.toContain(secret);
  });

  it("已有 generation 再命中 => foundation_refresh_failed_kept_old 且 currentGeneration 不变", () => {
    const repo = makeRepo();
    seedProject(repo);
    expect(bootstrapProjectFoundation({ db, ledger, audit }, PRJ).generation).toBe(1);
    const secret = secretToken();
    writeFileSync(join(repo, "AGENTS.md"), `# 约定\n- 密钥 ${secret}\n`);
    const before = readFileSync(join(repo, ".saydo", "foundation", "current.json"), "utf8");
    const r = bootstrapProjectFoundation({ db, ledger, audit }, PRJ);
    expect(r.ok).toBe(false);
    expect(r.failureClass).toBe("foundation_refresh_failed_kept_old");
    expect(new FoundationBuilder({ workspace: repo }).currentGeneration()).toBe(1);
    expect(readFileSync(join(repo, ".saydo", "foundation", "current.json"), "utf8")).toBe(before);
  });

  it("保护不足 => git_protection_insufficient", () => {
    const repo = makeRepo();
    mkdirSync(join(repo, ".saydo", "foundation"), { recursive: true });
    writeFileSync(join(repo, ".saydo", "foundation", "core.md"), "tracked\n");
    execFileSync("git", ["add", "-f", ".saydo/foundation/core.md"], { cwd: repo, stdio: "ignore" });
    execFileSync("git", ["commit", "-qm", "track private"], { cwd: repo, stdio: "ignore" });
    seedProject(repo);
    const r = bootstrapProjectFoundation({ db, ledger, audit }, PRJ);
    expect(r.ok).toBe(false);
    expect(r.code).toBe("git_protection_insufficient");
    expect(r.gitProtection?.status).toBe("insufficient");
    expect(existsSync(join(repo, ".saydo", "foundation", "core.md"))).toBe(true);
    expect(new FoundationBuilder({ workspace: repo }).currentGeneration()).toBe(0);
  });

  it("首次构建 .saydo/foundation 被常规文件占位 => write_failed", () => {
    const repo = makeRepo();
    mkdirSync(join(repo, ".saydo"));
    writeFileSync(join(repo, ".saydo", "foundation"), "not-a-dir\n");
    seedProject(repo);
    const r = bootstrapProjectFoundation({ db, ledger, audit }, PRJ);
    expect(r.ok).toBe(false);
    expect(r.code).toBe("git_protection_insufficient");
    expect(r.gitProtection?.status).toBe("write_failed");
    expect(r.failureClass).toBe("foundation_first_build_unavailable");
    expect(existsSync(join(repo, ".saydo", "foundation", "staging-gen-1"))).toBe(false);
  });

  it("已有 generation 后 .saydo/foundation 为 0o555 => kept_old", () => {
    if (process.getuid?.() === 0) return;
    const repo = makeRepo();
    seedProject(repo);
    expect(bootstrapProjectFoundation({ db, ledger, audit }, PRJ).generation).toBe(1);
    const foundationDir = join(repo, ".saydo", "foundation");
    const before = readFileSync(join(foundationDir, "current.json"), "utf8");
    chmodSync(foundationDir, 0o555);
    try {
      const r = bootstrapProjectFoundation({ db, ledger, audit }, PRJ);
      expect(r.ok).toBe(false);
      expect(r.code).toBe("git_protection_insufficient");
      expect(r.gitProtection?.status).toBe("write_failed");
      expect(r.failureClass).toBe("foundation_refresh_failed_kept_old");
      expect(readFileSync(join(foundationDir, "current.json"), "utf8")).toBe(before);
      expect(new FoundationBuilder({ workspace: repo }).currentGeneration()).toBe(1);
    } finally {
      chmodSync(foundationDir, 0o755);
    }
  });

  it("approveCandidate 对含凭据候选抛 memory_secret_literal 且候选不变", () => {
    const secret = secretToken();
    const candidateId = newId("mem");
    insertMemoryEvent(db, {
      id: candidateId,
      ts: "2026-07-26T12:00:00.000Z",
      op: "add",
      tier: "M1",
      projectId: PRJ,
      claim: `以后都统一用 ${secret}`,
      source: { kind: "user_utterance", ref: "t-cand" },
      trust: "candidate"
    });
    expect(() => approveCandidate({ ledger, audit }, candidateId)).toThrow(MemorySecretLiteralError);
    const still = ledger.project().find((m) => m.id === candidateId);
    expect(still?.trust).toBe("candidate");
    expect(still?.claim).toContain(secret);
    try {
      approveCandidate({ ledger, audit }, candidateId);
      throw new Error("expected reject");
    } catch (err) {
      expect(isMemorySecretLiteralError(err)).toBe(true);
      const body = memorySecretLiteralReject(err as MemorySecretLiteralError);
      expect(body).toMatchObject({
        ok: false,
        code: "memory_secret_literal",
        retryable: false,
        failureClass: "memory_item_not_saved"
      });
      expect(body.message).not.toContain(secret);
      expect(JSON.stringify(body)).not.toContain(secret);
    }
  });

  it("projectM1Notes:根外 symlink 不写不改用户文件,审计只记 projectId+status", () => {
    const repo = makeRepo();
    seedProject(repo);
    const outside = mkdtempSync(join(tmpdir(), "saydo-m1-out-"));
    writeFileSync(join(outside, "keep.txt"), "keep\n");
    symlinkSync(outside, join(repo, ".saydo"));
    ledger.add({
      tier: "M1",
      projectId: PRJ,
      claim: "这个项目以后都统一用 pnpm 管依赖",
      source: { kind: "user_utterance", ref: "t-m1" },
      requestedTrust: "user_stated"
    });
    const wrote = projectM1Notes(ledger, PRJ, repo, new Date().toISOString(), { audit });
    expect(wrote).toBe(false);
    expect(existsSync(join(outside, "knowledge", "m1-notes.md"))).toBe(false);
    expect(readFileSync(join(outside, "keep.txt"), "utf8")).toBe("keep\n");
    const row = db.prepare("SELECT meta_json FROM audit_log WHERE action=?").get("memory.m1_notes_skipped") as
      | { meta_json: string }
      | undefined;
    expect(row).toBeDefined();
    expect(JSON.parse(row!.meta_json)).toEqual({ projectId: PRJ, status: "outside_root" });
  });

  it("projectM1Notes:m1-notes.md 已 tracked 时 approve 后不覆盖且记 skipped", () => {
    const repo = makeRepo();
    seedProject(repo);
    const notesDir = join(repo, ".saydo", "knowledge");
    mkdirSync(notesDir, { recursive: true });
    const notesPath = join(notesDir, "m1-notes.md");
    writeFileSync(notesPath, "USER KEEP\n");
    execFileSync("git", ["add", "-f", ".saydo/knowledge/m1-notes.md"], { cwd: repo, stdio: "ignore" });
    execFileSync("git", ["commit", "-qm", "track m1-notes"], { cwd: repo, stdio: "ignore" });
    const [cand] = nominateFromSession(
      { ledger, audit },
      { sessionId: "ses_01GR0WAPPR0000000000000001", projectId: PRJ, userTurns: ["这个项目以后都统一用 pnpm 管依赖"] }
    );
    expect(cand).toBeDefined();
    const ev = approveCandidate({ ledger, audit }, cand!.id);
    const wrote = projectM1Notes(ledger, ev.projectId ?? PRJ, repo, new Date().toISOString(), { audit });
    expect(wrote).toBe(false);
    expect(readFileSync(notesPath, "utf8")).toBe("USER KEEP\n");
    const row = db.prepare("SELECT meta_json FROM audit_log WHERE action=?").get("memory.m1_notes_skipped") as
      | { meta_json: string }
      | undefined;
    expect(row).toBeDefined();
    const meta = JSON.parse(row!.meta_json) as { projectId: string; status: string };
    expect(meta.projectId).toBe(PRJ);
    expect(meta.status).toBe("insufficient");
    expect(Object.keys(meta).sort()).toEqual(["projectId", "status"]);
  });

  it("projectM1Notes:protected/not_git 正常写入;传入 protection 不再查询", () => {
    const repo = makeRepo();
    seedProject(repo);
    ledger.add({
      tier: "M1",
      projectId: PRJ,
      claim: "这个项目以后都统一用 pnpm 管依赖",
      source: { kind: "user_utterance", ref: "t-ok" },
      requestedTrust: "user_stated"
    });
    let reusedCalls = 0;
    const protectedWrite = projectM1Notes(ledger, PRJ, repo, new Date().toISOString(), {
      protection: { status: "protected" },
      audit,
      noteGitCall: () => {
        reusedCalls += 1;
      }
    });
    expect(protectedWrite).toBe(true);
    expect(reusedCalls).toBe(0);
    expect(readFileSync(join(repo, ".saydo", "knowledge", "m1-notes.md"), "utf8")).toContain("统一用 pnpm");

    const nogit = mkdtempSync(join(tmpdir(), "saydo-m1-nogit-"));
    writeFileSync(join(nogit, "README.md"), "x\n");
    let nogitCalls = 0;
    const nogitWrite = projectM1Notes(ledger, PRJ, nogit, new Date().toISOString(), {
      audit,
      noteGitCall: () => {
        nogitCalls += 1;
      }
    });
    expect(nogitWrite).toBe(true);
    expect(nogitCalls).toBeLessThanOrEqual(5);
    expect(existsSync(join(nogit, ".saydo", "knowledge", "m1-notes.md"))).toBe(true);
  });

  it("bootstrap 投影复用已验证保护结果,不再额外触发保护查询", () => {
    const repo = makeRepo();
    seedProject(repo);
    let extra = 0;
    const r = bootstrapProjectFoundation(
      {
        db,
        ledger,
        audit,
        projectM1NotesGit: {
          noteGitCall: () => {
            extra += 1;
          }
        }
      },
      PRJ
    );
    expect(r.ok).toBe(true);
    expect(extra).toBe(0);
    expect(existsSync(join(repo, ".saydo", "knowledge", "m1-notes.md"))).toBe(true);
  });

  it("approve 投影自成边界,保护查询不超过 5 次", () => {
    const repo = makeRepo();
    seedProject(repo);
    const [cand] = nominateFromSession(
      { ledger, audit },
      { sessionId: "ses_01GR0WAPQ0000000000000001", projectId: PRJ, userTurns: ["这个项目以后都统一用 pnpm 管依赖"] }
    );
    const ev = approveCandidate({ ledger, audit }, cand!.id);
    let queries = 0;
    const wrote = projectM1Notes(ledger, ev.projectId ?? PRJ, repo, new Date().toISOString(), {
      audit,
      noteGitCall: () => {
        queries += 1;
      }
    });
    expect(wrote).toBe(true);
    expect(queries).toBeGreaterThan(0);
    expect(queries).toBeLessThanOrEqual(5);
    expect(readFileSync(join(repo, ".saydo", "knowledge", "m1-notes.md"), "utf8")).toContain("统一用 pnpm");
  });

  it("projectM1Notes:未跟踪的根外叶子 symlink,approve 后不跟随且记 outside_root", () => {
    const repo = makeRepo();
    seedProject(repo);
    const outsideDir = mkdtempSync(join(tmpdir(), "saydo-m1-leaf-out-"));
    const outside = join(outsideDir, "victim.md");
    writeFileSync(outside, "OUTSIDE-KEEP\n");
    const notesDir = join(repo, ".saydo", "knowledge");
    mkdirSync(notesDir, { recursive: true });
    const notesPath = join(notesDir, "m1-notes.md");
    symlinkSync(outside, notesPath);
    const [cand] = nominateFromSession(
      { ledger, audit },
      { sessionId: "ses_01GR0WAPX00000000000000001", projectId: PRJ, userTurns: ["这个项目以后都统一用 pnpm 管依赖"] }
    );
    const ev = approveCandidate({ ledger, audit }, cand!.id);
    const wrote = projectM1Notes(ledger, ev.projectId ?? PRJ, repo, new Date().toISOString(), { audit });
    expect(wrote).toBe(false);
    expect(readFileSync(outside, "utf8")).toBe("OUTSIDE-KEEP\n");
    expect(lstatSync(notesPath).isSymbolicLink()).toBe(true);
    const row = db.prepare("SELECT meta_json FROM audit_log WHERE action=?").get("memory.m1_notes_skipped") as
      | { meta_json: string }
      | undefined;
    expect(row).toBeDefined();
    expect(JSON.parse(row!.meta_json)).toEqual({ projectId: ev.projectId ?? PRJ, status: "outside_root" });
  });

  it("projectM1Notes:指向根内 README 的叶子 symlink 不改 README,记 write_failed", () => {
    const repo = makeRepo();
    seedProject(repo);
    const readme = join(repo, "README.md");
    const before = readFileSync(readme, "utf8");
    const notesDir = join(repo, ".saydo", "knowledge");
    mkdirSync(notesDir, { recursive: true });
    const notesPath = join(notesDir, "m1-notes.md");
    symlinkSync(readme, notesPath);
    const [cand] = nominateFromSession(
      { ledger, audit },
      { sessionId: "ses_01GR0WAPX00000000000000002", projectId: PRJ, userTurns: ["这个项目以后都统一用 pnpm 管依赖"] }
    );
    const ev = approveCandidate({ ledger, audit }, cand!.id);
    const wrote = projectM1Notes(ledger, ev.projectId ?? PRJ, repo, new Date().toISOString(), { audit });
    expect(wrote).toBe(false);
    expect(readFileSync(readme, "utf8")).toBe(before);
    expect(lstatSync(notesPath).isSymbolicLink()).toBe(true);
    const row = db.prepare("SELECT meta_json FROM audit_log WHERE action=?").get("memory.m1_notes_skipped") as
      | { meta_json: string }
      | undefined;
    expect(row).toBeDefined();
    const meta = JSON.parse(row!.meta_json) as { projectId: string; status: string };
    expect(meta.projectId).toBe(ev.projectId ?? PRJ);
    expect(meta.status).toBe("write_failed");
    expect(Object.keys(meta).sort()).toEqual(["projectId", "status"]);
  });
});
