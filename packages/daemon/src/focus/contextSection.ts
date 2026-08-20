// F27(2026-08-04 任务3 dogfood):锚定后 Focus 背景注入对话 system——
// 此前 pack 只注入 project 记忆+奠基,Focus 维度零注入,Brain 开局不知道自己知道多少,
// 不摸底就泛谈(不知道"千手"是什么就给渠道建议)。本节让 Brain 每轮看到义务/方向水位;
// fresh Focus(零 revision 零义务)时配合 instructions delta 先摸底。失败恒空段,不断对话链。
// 批 3:session_task_context 有效时注入「[正在处理]」段(合同 §5.4)。

import type { Db } from "../storage/db.js";
import { resolveFocus } from "./registry.js";
import { listOpenObligations } from "./obligations.js";
import { getSessionTaskContext } from "./sessionTaskContext.js";

export function renderFocusContextSection(db: Db, sessionId: string): string {
  try {
    const parts: string[] = [];
    const taskCtx = renderTaskContextSection(db, sessionId);
    if (taskCtx) parts.push(taskCtx);

    const sess = db
      .prepare("SELECT primary_focus_id FROM sessions WHERE id = ?")
      .get(sessionId) as { primary_focus_id: string | null } | undefined;
    const focusId = sess?.primary_focus_id ?? "";
    // 自然接续(2026-08-04 义骁提出"用户不记得 Focus 也能自然接上"):未锚定时列可接续清单——
    // 用户话题对上某个即 proposeFocusAnchor 提议(session_open_suggest 预留位的最小兑现)
    if (!focusId) {
      const list = renderResumableFocusList(db);
      if (list) parts.push(list);
      return parts.join("\n\n");
    }
    const r = resolveFocus(db, focusId);
    if (r.kind !== "found") return parts.join("\n\n");
    const obs = listOpenObligations(db, focusId);
    const state = db
      .prepare(
        "SELECT current_direction, last_reliable_state FROM focus_states WHERE focus_id = ? ORDER BY revision DESC LIMIT 1"
      )
      .get(focusId) as { current_direction: string; last_reliable_state: string } | undefined;
    const lines: string[] = [
      `[当前 Focus]`,
      `「${r.focus.title}」(${r.focus.lifecycle},revision ${r.focus.currentRevision},未结义务 ${obs.length} 笔)`
    ];
    if (state) {
      lines.push(`方向:${state.current_direction.slice(0, 120)}`);
      lines.push(`最近可靠状态:${state.last_reliable_state.slice(0, 120)}`);
    }
    if (obs.length > 0) {
      const top = obs
        .slice(0, 5)
        .map((o) => `- [${o.owner === "human" ? "用户的" : o.owner === "agent" ? "你的" : "外部"}] ${o.title.slice(0, 60)}`)
        .join("\n");
      lines.push(`未结义务(最多列 5):\n${top}`);
    }
    if (r.focus.currentRevision === 0 && obs.length === 0) {
      lines.push("这个 Focus 是全新的(零 revision 零义务):你对它的背景一无所知,先请用户给一两句背景再给实质建议,绝不装懂泛谈。");
    }
    parts.push(lines.join("\n"));
    return parts.join("\n\n");
  } catch {
    return "";
  }
}

/** 合同 §5.4:弹窗打开时注入「[正在处理] {target 摘要}」 */
function renderTaskContextSection(db: Db, sessionId: string): string {
  try {
    const ctx = getSessionTaskContext(db, sessionId);
    if (!ctx) return "";
    if (ctx.refKind === "obligation") {
      const o = db
        .prepare("SELECT title, detail, needs, status, next_step FROM focus_obligations WHERE id = ?")
        .get(ctx.refId) as
        | { title: string; detail: string | null; needs: string | null; status: string; next_step: string | null }
        | undefined;
      if (!o) return "";
      const bits = [
        `义务「${o.title}」`,
        o.needs ? `needs=${o.needs}` : null,
        `status=${o.status}`,
        o.next_step ? `下一步:${o.next_step.slice(0, 80)}` : null,
        o.detail ? o.detail.slice(0, 120) : null
      ].filter(Boolean);
      return `[正在处理] ${bits.join(" · ")}`;
    }
    const t = db.prepare("SELECT title, status FROM tasks WHERE id = ?").get(ctx.refId) as
      | { title: string; status: string }
      | undefined;
    if (!t) return "";
    return `[正在处理] 任务「${t.title}」(status=${t.status})`;
  } catch {
    return "";
  }
}

/** 未锚定会话的可接续 Focus 清单(非终态,按更新时间前 8;方向一行帮 Brain 对话题) */
function renderResumableFocusList(db: Db): string {
  const rows = db
    .prepare(
      `SELECT f.id, f.title, f.lifecycle, f.current_revision,
              (SELECT current_direction FROM focus_states s WHERE s.focus_id = f.id ORDER BY s.revision DESC LIMIT 1) AS direction,
              (SELECT COUNT(*) FROM focus_obligations o WHERE o.focus_id = f.id
                 AND o.status IN ('open','in_progress','waiting','deferred','blocked')) AS open_obs
       FROM focuses f WHERE f.lifecycle NOT IN ('closed','abandoned','archived')
       ORDER BY f.updated_at DESC LIMIT 8`
    )
    .all() as { id: string; title: string; lifecycle: string; current_revision: number; direction: string | null; open_obs: number }[];
  if (rows.length === 0) return "";
  const items = rows
    .map(
      (f) =>
        `- 「${f.title}」(${f.lifecycle},未结义务 ${f.open_obs} 笔${f.direction ? `;方向:${f.direction.slice(0, 60)}` : ""})`
    )
    .join("\n");
  return [
    "[可接续的 Focus]",
    "本会话尚未锚定 Focus。既有 Focus 如下:",
    items,
    "用户的话题明显属于其中某个时(哪怕用户没提 Focus 这个词),调 proposeFocusAnchor(titleQuery)提议接续——经确认环,不改写用户意图;拿不准就先问一句。全新话题不必强行归入。"
  ].join("\n");
}
