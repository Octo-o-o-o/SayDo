// 回叫 sweep(S2):按优先级与 escalation 分级选路。
// L0 = 语音(console peer ∧ TTS 健康 ∧ 不 busy,经 arbitrate);
// L1 = 桌面通知 + ntfy + 邮件(EMAIL-A,可选,与 ntfy 并列;任一投递成功即 notified);L2 电话不做(escalation 上限 1)。
// DND:只推低优先级 ntfy / 邮件各一次并 snooze,不语音不桌面。投递失败绝不写 notified。
// micHeldByMeeting 无数据源,调用方恒传 false。

import { renderTier1BlockedReason, type OutboxTrigger } from "@saydo/contracts";
import type { Db } from "../storage/db.js";
import type { AuditSink } from "../obs/audit.js";
import { redactText } from "../voice/redactor.js";
import { CallbackEngine } from "./engine.js";
import { PRIORITY, reconnectFirstLine, type ArbitrationResult, type PendingCallback } from "./arbitration.js";
import type { NtfyMessage, OutboxRowForNotify } from "./ntfy.js";
import type { EmailMessage } from "./email.js";

export const L0_ACK_WINDOW_MS = 30_000;
export const ESCALATION_CAP = 1;
const SWEEP_LIMIT = 5;

export interface SweepVoice {
  consolePeerForTask(taskId: string): string | null;
  ttsHealthy(): boolean;
  voiceBusy(sessionId: string): boolean;
  say(sessionId: string, text: string, origin: "callback"): Promise<boolean>;
  consoleSay(sessionId: string, text: string): boolean;
}

export interface SweepDeps {
  db: Db;
  engine: CallbackEngine;
  arbitrate: (pending: PendingCallback[], ctx: { voiceBusy: boolean; micHeldByMeeting: boolean }) => ArbitrationResult;
  voice: SweepVoice;
  desktop: { notify: (i: { title: string; body: string }) => Promise<boolean> };
  ntfy: {
    enabled: boolean;
    post: (msg: NtfyMessage) => Promise<boolean>;
    render: (db: Db, entry: OutboxRowForNotify) => NtfyMessage;
  };
  /** EMAIL-A(可选):未注入 = 未配置 */
  email?: {
    enabled: boolean;
    send: (msg: EmailMessage) => Promise<boolean>;
    /** 非四类事件返回 null(不发) */
    render: (db: Db, entry: OutboxRowForNotify) => EmailMessage | null;
    /** 投递成功后落线程锚 */
    recordThread: (entryId: string, messageId: string) => void;
  };
  dnd: {
    inWindow(now: Date): boolean;
    windowEnd(now: Date): string | null;
  };
  log: {
    info(msg: string, fields?: Record<string, unknown>): void;
    warn(msg: string, fields?: Record<string, unknown>): void;
    error(msg: string, fields?: Record<string, unknown>): void;
  };
  audit: AuditSink;
  /** L1 全失败告警去重(entryId);成功即清 */
  l1FailWarned: Set<string>;
  /** B:ack 超时重升级;A 可缺省 */
  escalateAcked?: () => string[];
}

export interface SweepReport {
  voiceSent: number;
  consoleSay: number;
  desktopSent: number;
  ntfySent: number;
  emailSent: number;
  snoozed: number;
  queued: number;
  l1Notified: number;
  alerts: number;
}

interface OutboxRow {
  id: string;
  task_id: string;
  trigger: OutboxTrigger;
  state: string;
  escalation: number;
  created_at: string;
  notified_at: string | null;
  acked_at: string | null;
  settle_json: string;
}

function emptyReport(): SweepReport {
  return {
    voiceSent: 0,
    consoleSay: 0,
    desktopSent: 0,
    ntfySent: 0,
    emailSent: 0,
    snoozed: 0,
    queued: 0,
    l1Notified: 0,
    alerts: 0
  };
}

function sortByPriority(rows: OutboxRow[]): OutboxRow[] {
  return [...rows].sort((a, b) => {
    const p = (PRIORITY[a.trigger] ?? 99) - (PRIORITY[b.trigger] ?? 99);
    return p !== 0 ? p : a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
  });
}

function loadDue(db: Db, nowIso: string, state: "pending" | "requeued"): OutboxRow[] {
  const rows = db
    .prepare(
      `SELECT id, task_id, trigger, state, escalation, created_at, notified_at, acked_at, settle_json
       FROM callback_outbox
       WHERE state = ? AND (snoozed_until IS NULL OR snoozed_until <= ?)
       ORDER BY created_at`
    )
    .all(state, nowIso) as OutboxRow[];
  return sortByPriority(rows).slice(0, SWEEP_LIMIT);
}

function loadL0Timeouts(db: Db, now: Date): OutboxRow[] {
  const rows = db
    .prepare(
      `SELECT id, task_id, trigger, state, escalation, created_at, notified_at, acked_at, settle_json
       FROM callback_outbox
       WHERE state = 'notified' AND escalation = 0 AND acked_at IS NULL AND notified_at IS NOT NULL`
    )
    .all() as OutboxRow[];
  const cutoff = now.getTime() - L0_ACK_WINDOW_MS;
  return sortByPriority(rows.filter((r) => r.notified_at !== null && Date.parse(r.notified_at) <= cutoff));
}

/** talking 优先,再按 started_at 新到旧。供生产 consolePeerForTask 与单测共用。 */
export function pickConsolePeerForTask(
  rows: { id: string; state: string; started_at: string }[],
  hasPeer: (sessionId: string) => boolean
): string | null {
  const sorted = [...rows].sort((a, b) => {
    const ta = a.state === "talking" ? 0 : 1;
    const tb = b.state === "talking" ? 0 : 1;
    if (ta !== tb) return ta - tb;
    return a.started_at < b.started_at ? 1 : a.started_at > b.started_at ? -1 : 0;
  });
  for (const row of sorted) {
    if (hasPeer(row.id)) return row.id;
  }
  return null;
}

function taskMeta(db: Db, taskId: string): { taskTitle: string; projectTitle: string } {
  const row = db
    .prepare(
      `SELECT t.title AS task_title, p.title AS project_title
       FROM tasks t LEFT JOIN projects p ON p.id = t.project_id
       WHERE t.id = ?`
    )
    .get(taskId) as { task_title: string | null; project_title: string | null } | undefined;
  return {
    taskTitle: row?.task_title ?? taskId,
    projectTitle: row?.project_title ?? "SayDo"
  };
}

function blockedReason(settleJson: string): string | null {
  try {
    const parsed = JSON.parse(settleJson) as { minimalProof?: { exitEvidence?: unknown } };
    return renderTier1BlockedReason(parsed.minimalProof?.exitEvidence);
  } catch {
    return null;
  }
}

function spokenLine(db: Db, row: OutboxRow): string {
  const taskTitle = redactText(taskMeta(db, row.task_id).taskTitle);
  const reason = row.trigger === "blocked" || row.trigger === "failed" ? blockedReason(row.settle_json) : null;
  return reason ? `${taskTitle}:${reason}` : reconnectFirstLine(row.trigger, taskTitle);
}

function nowHmOf(now: Date): string {
  return now.toTimeString().slice(0, 5);
}

export async function runCallbackSweep(deps: SweepDeps, now: Date): Promise<SweepReport> {
  const report = emptyReport();
  const nowIso = now.toISOString();
  const nowHm = nowHmOf(now);
  const spoken = new Set<string>();

  if (deps.escalateAcked) deps.escalateAcked();

  // B7:应答窗检查放在每轮开头(相对 15s 节拍最坏约 45s,见 evidence)
  const l0Timeouts = loadL0Timeouts(deps.db, now);

  if (deps.dnd.inWindow(now)) {
    await deliverDnd(deps, now, nowIso, report);
    return report;
  }

  const pending = loadDue(deps.db, nowIso, "pending");
  const requeued = loadDue(deps.db, nowIso, "requeued");

  const voiceReady: { row: OutboxRow; sessionId: string }[] = [];
  const noVoice: OutboxRow[] = [];

  for (const row of pending) {
    const sessionId = deps.voice.consolePeerForTask(row.task_id);
    if (sessionId && deps.voice.ttsHealthy()) {
      voiceReady.push({ row, sessionId });
    } else {
      if (sessionId && !deps.voice.ttsHealthy()) {
        const text = spokenLine(deps.db, row);
        if (deps.voice.consoleSay(sessionId, text)) report.consoleSay += 1;
      }
      noVoice.push(row);
    }
  }

  if (voiceReady.length > 0) {
    // busy 按候选条目各自 session 判:先播第一个空闲 session;busy session 只 queue 该 session 头一条,同 session 其余 L1;其它空闲 session 不因 head busy 被降 L1。
    const speakCandidate = voiceReady.find((v) => !deps.voice.voiceBusy(v.sessionId));
    if (speakCandidate) {
      const result = deps.arbitrate(
        [
          {
            entryId: speakCandidate.row.id,
            trigger: speakCandidate.row.trigger,
            createdAt: speakCandidate.row.created_at
          }
        ],
        { voiceBusy: false, micHeldByMeeting: false }
      );
      if (result.action === "speak") {
        const text = spokenLine(deps.db, speakCandidate.row);
        const ok = await deps.voice.say(speakCandidate.sessionId, text, "callback");
        if (ok) {
          deps.engine.attemptNotify(speakCandidate.row.id, { nowHm, channelReachable: true });
          deps.audit.record({
            actor: "daemon",
            action: "callback.voice_sent",
            meta: { entryId: speakCandidate.row.id, sessionId: speakCandidate.sessionId }
          });
          spoken.add(speakCandidate.row.id);
          report.voiceSent += 1;
          deps.log.info("callback L0 voice sent", {
            entryId: speakCandidate.row.id,
            sessionId: speakCandidate.sessionId
          });
        } else {
          noVoice.push(speakCandidate.row);
        }
      } else if (result.action === "downgrade_notify") {
        noVoice.push(speakCandidate.row);
      }
    }
    const busyHeadQueued = new Set<string>();
    const l1Ids = new Set(noVoice.map((r) => r.id));
    for (const v of voiceReady) {
      if (spoken.has(v.row.id) || l1Ids.has(v.row.id)) continue;
      if (!deps.voice.voiceBusy(v.sessionId)) continue;
      if (!busyHeadQueued.has(v.sessionId)) {
        busyHeadQueued.add(v.sessionId);
        report.queued += 1;
        continue;
      }
      noVoice.push(v.row);
      l1Ids.add(v.row.id);
    }
  }

  const l1Seen = new Set<string>(spoken);
  const l1Queue: OutboxRow[] = [];
  const pushL1 = (row: OutboxRow): void => {
    if (l1Seen.has(row.id)) return;
    l1Seen.add(row.id);
    l1Queue.push(row);
  };
  for (const row of noVoice) pushL1(row);
  for (const row of requeued) pushL1(row);
  for (const row of l0Timeouts) pushL1(row);

  for (const row of l1Queue) {
    await deliverL1(deps, row, nowHm, report);
  }

  return report;
}

/** EMAIL-A:渲染 + 投递一封;成功落线程锚。失败/非四类事件/未配置 ⇒ false */
async function deliverEmail(deps: SweepDeps, row: OutboxRow, report: SweepReport, dnd: boolean): Promise<boolean> {
  if (!deps.email?.enabled) return false;
  const msg = deps.email.render(deps.db, { id: row.id, task_id: row.task_id, trigger: row.trigger, settle_json: row.settle_json });
  if (!msg) return false;
  const toSend: EmailMessage = dnd ? { ...msg, text: `(免打扰时段)${msg.text}` } : msg;
  let ok = false;
  try {
    ok = await deps.email.send(toSend);
  } catch {
    ok = false;
  }
  if (!ok) return false;
  report.emailSent += 1;
  deps.email.recordThread(row.id, msg.messageId);
  return true;
}

async function deliverDnd(deps: SweepDeps, now: Date, nowIso: string, report: SweepReport): Promise<void> {
  const until = deps.dnd.windowEnd(now);
  const due = [...loadDue(deps.db, nowIso, "pending"), ...loadDue(deps.db, nowIso, "requeued")];
  for (const row of due) {
    let sent = false;
    if (deps.ntfy.enabled) {
      const base = deps.ntfy.render(deps.db, {
        id: row.id,
        task_id: row.task_id,
        trigger: row.trigger,
        settle_json: row.settle_json
      });
      const msg: NtfyMessage = { ...base, priority: 2, body: `（免打扰时段）${base.body}` };
      sent = await deps.ntfy.post(msg);
      if (sent) {
        report.ntfySent += 1;
        deps.audit.record({ actor: "daemon", action: "callback.dnd_pushed", meta: { entryId: row.id } });
        deps.log.info("callback DND ntfy pushed", { entryId: row.id });
      }
    }
    const emailSent = await deliverEmail(deps, row, report, true);
    if (emailSent) {
      sent = true;
      deps.audit.record({ actor: "daemon", action: "callback.dnd_pushed", meta: { entryId: row.id, channel: "email" } });
      deps.log.info("callback DND email pushed", { entryId: row.id });
    }
    const anyPushChannel = deps.ntfy.enabled || deps.email?.enabled === true;
    if ((sent || !anyPushChannel) && until) {
      deps.engine.snooze(row.id, until);
      report.snoozed += 1;
    }
  }
}

async function deliverL1(deps: SweepDeps, row: OutboxRow, nowHm: string, report: SweepReport): Promise<void> {
  const msg = deps.ntfy.render(deps.db, {
    id: row.id,
    task_id: row.task_id,
    trigger: row.trigger,
    settle_json: row.settle_json
  });
  const { projectTitle } = taskMeta(deps.db, row.task_id);
  const title = `SayDo · ${redactText(projectTitle)}`;
  let desktopOk = false;
  let ntfyOk = false;
  try {
    desktopOk = await deps.desktop.notify({ title, body: msg.body });
  } catch {
    desktopOk = false;
  }
  if (desktopOk) report.desktopSent += 1;
  if (deps.ntfy.enabled) {
    try {
      ntfyOk = await deps.ntfy.post(msg);
    } catch {
      ntfyOk = false;
    }
    if (ntfyOk) report.ntfySent += 1;
  }
  const emailOk = await deliverEmail(deps, row, report, false);
  if (!desktopOk && !ntfyOk && !emailOk) {
    if (!deps.l1FailWarned.has(row.id)) {
      deps.l1FailWarned.add(row.id);
      deps.log.warn("callback L1 delivery failed; entry stays for retry", { entryId: row.id, state: row.state });
      report.alerts += 1;
    }
    return;
  }
  deps.l1FailWarned.delete(row.id);
  if (row.state === "pending" || row.state === "requeued") {
    const notify =
      row.escalation < ESCALATION_CAP
        ? { nowHm, channelReachable: true, escalationDelta: 1 as const }
        : { nowHm, channelReachable: true };
    deps.engine.attemptNotify(row.id, notify);
  } else if (row.state === "notified" && row.escalation === 0) {
    deps.engine.bumpUnackedToL1(row.id);
  }
  report.l1Notified += 1;
  deps.log.info("callback L1 delivered", {
    entryId: row.id,
    desktop: desktopOk,
    ntfy: ntfyOk,
    email: emailOk,
    state: row.state
  });
}
