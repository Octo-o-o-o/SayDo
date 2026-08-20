// 1.3a 验收:断/重建上下文连续(packDigest 一致 + turnId 连续)+ PTT 窗口外音频丢弃(G1 语音半边)。

import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { newId, type Project } from "@saydo/contracts";
import { openDb, type Db } from "../src/storage/db.js";
import { insertProject } from "../src/storage/dao/projects.js";
import { SessionManager } from "../src/session/manager.js";
import type { AuditSink } from "../src/obs/audit.js";
import { managedProjectPath } from "../src/projects/workspace.js";

const nullAudit: AuditSink = { record: () => ({ id: "aud_x" }) };
const TS = () => new Date("2026-07-24T00:00:00Z");

let db: Db;
let mgr: SessionManager;
let projectId: string;
let base: string;

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), "saydo-ses-"));
  db = openDb(join(base, "saydo.db"));
  const id = newId("prj");
  const p: Project = {
    id,
    title: "t",
    type: "coding",
    status: "active",
    workspace: { kind: "local_folder", path: managedProjectPath(id), managed: true },
    executionModeDefault: "step_confirm",
    createdAt: "2026-07-24T00:00:00Z",
    updatedAt: "2026-07-24T00:00:00Z"
  };
  insertProject(db, p);
  projectId = p.id;
  mgr = new SessionManager({ db, audit: nullAudit, now: TS });
});

describe("A2 会话生命周期 + 转写落盘", () => {
  it("建立 -> 逐轮落盘 -> 读回;转写零丢失", () => {
    const s = mgr.create({ projectId, transcriptPath: join(base, "sessions", "s.jsonl") });
    expect(s.state).toBe("learning");
    mgr.setState(s.id, "talking");
    const t1 = mgr.appendTurn(s.id, {
      speaker: "user",
      text: "帮我加导出功能",
      sentences: [{ sentenceId: "a", text: "帮我加导出功能", heard: true }],
      engine: "cascade"
    });
    const t2 = mgr.appendTurn(s.id, {
      speaker: "ai",
      text: "好的,我看一下",
      sentences: [{ sentenceId: "b", text: "好的,我看一下", heard: true }],
      engine: "cascade"
    });
    const turns = mgr.readTurns(s.id);
    expect(turns.map((t) => t.turnId)).toEqual([t1.turnId, t2.turnId]);
  });

  it("挂起 -> 重建:turnId 连续 + packDigest 一致判定", () => {
    const packDigest = "sha256:" + "a".repeat(64);
    const s = mgr.create({ projectId, transcriptPath: join(base, "sessions", "s2.jsonl"), contextSnapshotDigest: packDigest });
    mgr.setState(s.id, "talking");
    const t1 = mgr.appendTurn(s.id, { speaker: "user", text: "一", sentences: [{ sentenceId: "1", text: "一", heard: true }], engine: "cascade" });
    mgr.setState(s.id, "suspended");

    const rebuilt = mgr.rebuild(s.id, packDigest);
    expect(rebuilt.lastTurnId).toBe(t1.turnId); // turnId 连续
    expect(rebuilt.packConsistent).toBe(true); // pack 一致
    expect(rebuilt.session.state).toBe("talking");

    // pack 失配 => 需重编译(不静默用旧 pack)
    const rebuilt2 = mgr.rebuild(s.id, "sha256:" + "b".repeat(64));
    expect(rebuilt2.packConsistent).toBe(false);
  });

  it("G6 分别同意:store_transcript=false 转写不落盘(轮内照常,读回为空=重建如实降级)", () => {
    const noStore = new SessionManager({ db, audit: nullAudit, now: TS, storeTranscript: false });
    const s = noStore.create({ projectId, transcriptPath: join(base, "sessions", "s-nostore.jsonl") });
    noStore.setState(s.id, "talking");
    const t = noStore.appendTurn(s.id, {
      speaker: "user",
      text: "不要留记录",
      sentences: [{ sentenceId: "n", text: "不要留记录", heard: true }],
      engine: "cascade"
    });
    expect(t.turnId).toBeTruthy(); // 轮内流程照常(turn 对象仍产生)
    expect(noStore.readTurns(s.id)).toEqual([]); // 落盘为空
  });

  it("sessions/ 被外力删除后 appendTurn 自愈重建目录并落盘", () => {
    const sessionsDir = join(base, "sessions");
    const transcriptPath = join(sessionsDir, "s-heal.jsonl");
    const s = mgr.create({ projectId, transcriptPath });
    mgr.setState(s.id, "talking");
    expect(existsSync(sessionsDir)).toBe(true);
    rmSync(sessionsDir, { recursive: true, force: true });
    expect(existsSync(sessionsDir)).toBe(false);

    const t = mgr.appendTurn(s.id, {
      speaker: "user",
      text: "目录没了也要记下",
      sentences: [{ sentenceId: "h", text: "目录没了也要记下", heard: true }],
      engine: "cascade"
    });
    expect(existsSync(transcriptPath)).toBe(true);
    const line = JSON.parse(readFileSync(transcriptPath, "utf8").trim()) as { turnId: string; text: string };
    expect(line.turnId).toBe(t.turnId);
    expect(line.text).toBe("目录没了也要记下");
    expect(mgr.readTurns(s.id)).toHaveLength(1);
  });
});

describe("G1 语音半边(05 §4 P0 口径:PTT 窗口外/挂起态音频不产生指令)", () => {
  it("talking + PTT 开 => 接受;PTT 关 => 丢弃;非 talking => 丢弃", () => {
    const s = mgr.create({ projectId, transcriptPath: join(base, "sessions", "s3.jsonl") });
    mgr.setState(s.id, "talking");

    mgr.setPtt(s.id, false);
    expect(mgr.shouldAcceptUtterance(s.id)).toEqual({ accept: false, reason: "ptt_window_closed" });

    mgr.setPtt(s.id, true);
    expect(mgr.shouldAcceptUtterance(s.id)).toEqual({ accept: true });

    // 挂起态:即使 PTT 曾开,也丢弃(挂起 setState 会关 PTT)
    mgr.setState(s.id, "suspended");
    expect(mgr.shouldAcceptUtterance(s.id).accept).toBe(false);
  });

  it("learning 态(奠基中)音频不产生指令", () => {
    const s = mgr.create({ projectId, transcriptPath: join(base, "sessions", "s4.jsonl") });
    mgr.setPtt(s.id, true);
    expect(mgr.shouldAcceptUtterance(s.id)).toEqual({ accept: false, reason: "session_state_learning" });
  });

  it("未知会话丢弃", () => {
    expect(mgr.shouldAcceptUtterance("ses_01JD9WYX00000000000000000A").accept).toBe(false);
  });
});
