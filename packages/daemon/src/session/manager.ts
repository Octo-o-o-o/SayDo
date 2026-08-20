// A2 会话管理器(计划 1.3a;modules/a A2):会话生命周期(建立/挂起/重建/超时)+ TranscriptTurn 落盘。
// 铁律(03 §1):会话短命任务长命;挂起是常态出口,重建 = 同 packDigest + turnId 连续。
// G1 语音半边(05 §4 口径):单用户假设显式化 + PTT 窗口外/挂起态音频不产生指令(P0 无声纹,不做软过滤)。

import { appendFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { newId, transcriptTurnSchema, type Session, type TranscriptTurn } from "@saydo/contracts";
import type { Db } from "../storage/db.js";
import { getSession, insertSession } from "../storage/dao/projects.js";
import type { AuditSink } from "../obs/audit.js";

export type SessionState = "learning" | "talking" | "suspended" | "closed";

export interface SessionManagerDeps {
  db: Db;
  audit: AuditSink;
  now?: () => Date;
  /** [privacy].store_transcript(G6 分别同意;缺省 true。false = 转写不落盘,重建上下文如实降级。
   *  live 接线(场次② dogfood 增量)实例化时**必须**传 cfg.privacy.store_transcript——
   *  漏传缺省 true 会静默违 G6(code-review B1 挂账,gate0-checklist G6 行同锚) */
  storeTranscript?: boolean;
}

/**
 * G1 单用户假设(05 §4 P0 口径,显式化):
 * SayDo P0 是单用户本地系统,不做说话人分离/声纹。指令只在"PTT 窗口内且会话处于 talking 态"时被接受;
 * PTT 窗口外、会话 suspended/closed 态的音频一律不产生指令(不造假"软过滤"绿测——真软过滤待 ASR 具说话人标签)。
 */
export interface PttWindow {
  open: boolean;
}

export class SessionManager {
  private readonly db: Db;
  private readonly audit: AuditSink;
  private readonly now: () => Date;
  private readonly storeTranscript: boolean;
  private readonly pttOpen = new Map<string, boolean>(); // sessionId -> PTT 窗口开合
  private readonly lastTurnId = new Map<string, string>(); // sessionId -> 最新 turnId(连续性锚)

  constructor(deps: SessionManagerDeps) {
    this.db = deps.db;
    this.audit = deps.audit;
    this.now = deps.now ?? (() => new Date());
    this.storeTranscript = deps.storeTranscript ?? true;
  }

  create(i: { id?: string; projectId: string; transcriptPath: string; engine?: "cascade" | "s2s"; contextSnapshotDigest?: string }): Session {
    // id 可传入(live 接线:pipeline/console 的 voice sessionId 即 DB session id,一对一免映射表)
    const session: Session = {
      id: i.id ?? newId("ses"),
      projectId: i.projectId,
      projectRevision: 0,
      state: "learning",
      engine: i.engine ?? "cascade",
      transcriptPath: i.transcriptPath,
      ...(i.contextSnapshotDigest ? { contextSnapshotDigest: i.contextSnapshotDigest } : {}),
      startedAt: this.now().toISOString()
    };
    insertSession(this.db, session);
    mkdirSync(dirname(session.transcriptPath), { recursive: true });
    this.audit.record({ actor: "daemon", action: "session.create", meta: { sessionId: session.id, projectId: i.projectId } });
    return session;
  }

  setState(sessionId: string, state: SessionState): void {
    this.db.prepare("UPDATE sessions SET state = ?, ended_at = CASE WHEN ? = 'closed' THEN ? ELSE ended_at END WHERE id = ?").run(
      state,
      state,
      this.now().toISOString(),
      sessionId
    );
    if (state === "suspended" || state === "closed") this.pttOpen.set(sessionId, false);
    this.audit.record({ actor: "daemon", action: `session.${state}`, meta: { sessionId } });
  }

  /** PTT 窗口开合(G1:窗口外音频不产生指令) */
  setPtt(sessionId: string, open: boolean): void {
    this.pttOpen.set(sessionId, open);
  }

  /**
   * G1 判定:该音频/转写是否应产生指令。
   * 仅当会话 talking 态 且 PTT 窗口开 时接受;否则丢弃(不产生指令)。
   */
  shouldAcceptUtterance(sessionId: string): { accept: boolean; reason?: string } {
    const s = getSession(this.db, sessionId);
    if (!s) return { accept: false, reason: "session_not_found" };
    if (s.state !== "talking") return { accept: false, reason: `session_state_${s.state}` };
    if (this.pttOpen.get(sessionId) !== true) return { accept: false, reason: "ptt_window_closed" };
    return { accept: true };
  }

  /** 逐轮转写落盘(sessions/<id>.jsonl 每行一 TranscriptTurn;turnId 是 IntentLedger/溯源锚) */
  appendTurn(sessionId: string, turn: Omit<TranscriptTurn, "turnId" | "ts"> & { turnId?: string; ts?: string }): TranscriptTurn {
    const s = getSession(this.db, sessionId);
    if (!s) throw new Error(`session not found: ${sessionId}`);
    const full: TranscriptTurn = transcriptTurnSchema.parse({
      turnId: turn.turnId ?? newId("ses"),
      ts: turn.ts ?? this.now().toISOString(),
      speaker: turn.speaker,
      text: turn.text,
      ...(turn.origin !== undefined ? { origin: turn.origin } : {}),
      ...(turn.asrConfidence !== undefined ? { asrConfidence: turn.asrConfidence } : {}),
      sentences: turn.sentences,
      engine: turn.engine
    });
    // G6 分别同意:store_transcript=false 时不留存(轮内流程照常,turnId 连续性仍在内存维护;
    // 用户主动弃权即接受 G5 意图链的 utterance 边缺失与重建降级——同意权优先)
    if (this.storeTranscript) {
      // 外力删掉 sessions/ 后仍须自愈:create 时 mkdir 不够,append 写前再确保父目录
      mkdirSync(dirname(s.transcriptPath), { recursive: true });
      appendFileSync(s.transcriptPath, JSON.stringify(full) + "\n");
    }
    this.lastTurnId.set(sessionId, full.turnId);
    return full;
  }

  /** 读回转写(重建会话用;转写零丢失逐轮落盘) */
  readTurns(sessionId: string): TranscriptTurn[] {
    const s = getSession(this.db, sessionId);
    if (!s || !existsSync(s.transcriptPath)) return [];
    return readFileSync(s.transcriptPath, "utf8")
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => transcriptTurnSchema.parse(JSON.parse(l)));
  }

  /**
   * 重建会话(挂起后接通):同 packDigest(校验一致)+ turnId 连续。
   * 返回重建上下文:转写历史 + 最新 turnId + pack 一致性判定(失配需重编译,B1)。
   */
  rebuild(sessionId: string, currentPackDigest?: string): {
    session: Session;
    turns: TranscriptTurn[];
    lastTurnId: string | undefined;
    packConsistent: boolean;
  } {
    const s = getSession(this.db, sessionId);
    if (!s) throw new Error(`session not found: ${sessionId}`);
    const turns = this.readTurns(sessionId);
    const lastTurnId = turns.length > 0 ? turns[turns.length - 1]!.turnId : undefined;
    // packDigest 一致性:重建时若当前 pack 与会话记录的不同 => 需重编译(modules/b B1;不静默用旧 pack)
    const packConsistent = currentPackDigest === undefined || currentPackDigest === s.contextSnapshotDigest;
    this.setState(sessionId, "talking");
    this.audit.record({
      actor: "daemon",
      action: "session.rebuild",
      meta: { sessionId, turns: turns.length, packConsistent }
    });
    return { session: { ...s, state: "talking" }, turns, lastTurnId, packConsistent };
  }
}
