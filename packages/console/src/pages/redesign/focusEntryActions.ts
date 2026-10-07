// Focus 真实入口:安排打开 TaskModal;期待只带 Focus 进对话草稿;批准与采访核对实体身份。
// 批准/采访消费走同 session 生产确认卡或 turn.text,不对任意卡开放。

import type { TaskModalTarget } from "../../components/TaskModal";
import { confirmCardMatches, type ConfirmCardIdentity } from "../../lib/taskModalView";
import { dispatchCardMatchesPackage, type LiveConfirmCard } from "../../hooks/redesign/focusWorkLookups";
import { projectLiveInterview, type LiveInterviewSpoken } from "../../hooks/redesign/liveInterview";
import type { InterviewAnchorCommit, InterviewRoundLease } from "../../voice/interviewAnchor";
import type { FocusPageAction, FocusPageView } from "./FocusPage";

export type FocusLocateResult =
  | { kind: "open_obligation"; target: TaskModalTarget }
  | { kind: "open_task"; target: TaskModalTarget }
  | { kind: "scroll"; selector: string; label: string }
  | { kind: "missing"; message: string }
  | { kind: "no_locate"; message: string };

export function resolveFocusLocate(
  target: { kind: "obligation" | "task" | "artifact" | "project"; id: string },
  view: FocusPageView | null
): FocusLocateResult {
  if (target.kind === "obligation") {
    const ob =
      view?.rail.obligations.find((o) => o.id === target.id) ?? view?.lookups?.obligations?.[target.id];
    if (!ob) return { kind: "missing", message: "找不到这条安排" };
    return {
      kind: "open_obligation",
      target: {
        kind: "obligation",
        id: ob.id,
        title: ob.title,
        needs: ob.needs ?? null,
        focusId: ob.focusId
      }
    };
  }
  if (target.kind === "task") {
    const t = view?.rail.tasks.find((row) => row.id === target.id) ?? view?.lookups?.tasks?.[target.id];
    if (!t) return { kind: "no_locate", message: "找不到这条任务" };
    return {
      kind: "open_task",
      target: { kind: "task", id: t.id, title: t.title, focusId: t.focusId }
    };
  }
  return {
    kind: "scroll",
    selector: `[data-locate="${target.kind}:${target.id}"]`,
    label: `${target.kind} ${target.id}`
  };
}

export function expectationChatDraft(
  focusTitle: string,
  action: Extract<FocusPageAction, { type: "expect" | "expectation_edit" }>,
  expectation?: { direction?: string; acceptance?: { text: string }[] }
): string {
  const title = focusTitle.trim() || "这件事";
  if (action.type === "expect") {
    return `关于「${title}」:我期待一个新的产物——`;
  }
  switch (action.target.kind) {
    case "direction":
      return `关于「${title}」的方向${expectation?.direction ? `(现在是「${expectation.direction}」)` : ""},我想改成:`;
    case "acceptance": {
      const item =
        action.target.index !== undefined ? expectation?.acceptance?.[action.target.index]?.text : undefined;
      return item
        ? `关于「${title}」的验收「${item}」,我想改成:`
        : `关于「${title}」的验收,我想改成:`;
    }
    case "artifacts":
      return `关于「${title}」的预期产物,我想补充:`;
    case "budget":
      return `关于「${title}」的预算,我想说:`;
  }
}

/**
 * 决策包页卡动作 → 对话草稿(批准/改期待/还要改走的真实面是会话+确认卡;
 * 页卡不直连写口,草稿进锚定后的对话由 daemon 走 Gate 0 确认链)
 */
export function pkgChatDraft(
  action: Extract<FocusPageAction, { type: "pkg" }>["action"],
  outcomePreview?: string,
  payload?: string
): string {
  const what = outcomePreview?.trim() ? `「${outcomePreview.trim()}」` : "这份决策包";
  switch (action) {
    case "approve":
      return `关于${what}:拍板,开始`;
    case "revise":
      return `${what}还要改改:`;
    case "edit_expectation":
      return `关于${what}的期待,我想改成:`;
    case "select_mode":
      return `关于${what},用「${payload ?? "逐步确认"}」的方式跑`;
  }
}

/** 采访页卡选项 → 同 sid turn.text 正文(不是草稿等同答复) */
export function interviewTurnText(question: string | undefined, option: string): string {
  const q = question?.trim();
  return q ? `「${q}」我选:${option}` : option;
}

/** @deprecated 仅保留给旧草稿路径;采访应答应走 interviewTurnText + sendText */
export function interviewChatDraft(question: string | undefined, option: string): string {
  return interviewTurnText(question, option);
}

export type ConfirmConsumeResult =
  | { kind: "open_confirm"; target: Extract<TaskModalTarget, { kind: "confirmation" }> }
  | { kind: "blocked"; message: string };

export function resolvePkgApprove(opts: {
  packageId: string;
  revision?: number;
  pkg?: { id: string; revision: number; outcomePreview?: string };
  card: LiveConfirmCard | ConfirmCardIdentity | null | undefined;
  sessionOwned: boolean;
  sessionId?: string;
  focusId: string;
}): ConfirmConsumeResult {
  const pkg = opts.pkg ?? (opts.revision !== undefined ? { id: opts.packageId, revision: opts.revision } : undefined);
  if (!opts.sessionOwned || !opts.sessionId) {
    return { kind: "blocked", message: "还没接到这件事的对话,不能批准这张包" };
  }
  if (!opts.card?.receiptId) {
    return { kind: "blocked", message: "没有待批确认卡,不能在页面上批准" };
  }
  if (!dispatchCardMatchesPackage(opts.card, pkg)) {
    return { kind: "blocked", message: "当前确认卡不是这张决策包,不能打开或消费" };
  }
  if (
    !confirmCardMatches(opts.card, opts.card.receiptId, {
      kind: "dispatch",
      packageId: pkg?.id,
      revision: pkg?.revision,
      digest: opts.card.digest
    })
  ) {
    return { kind: "blocked", message: "确认卡身份对不上这张包" };
  }
  return {
    kind: "open_confirm",
    target: {
      kind: "confirmation",
      receiptId: opts.card.receiptId,
      title: ("text" in opts.card && typeof opts.card.text === "string" ? opts.card.text : undefined) ??
        pkg?.outcomePreview ??
        opts.packageId,
      sessionId: opts.sessionId,
      focusId: opts.focusId,
      packageId: opts.card.packageId,
      revision: opts.card.revision,
      digest: opts.card.digest,
      confirmKind: opts.card.kind
    }
  };
}

export function resolveInterviewSend(opts: {
  option: string;
  question?: string;
  sessionOwned: boolean;
  sessionId?: string | null;
  pageFocusId?: string;
  turnId?: string;
  focusId?: string;
  anchorRequestId?: string;
  anchorGeneration?: number;
  committed?: InterviewAnchorCommit | null;
  spoken?: readonly LiveInterviewSpoken[];
  rounds?: readonly InterviewRoundLease[];
}): { kind: "send"; text: string; sessionId: string } | { kind: "blocked"; message: string } {
  if (!opts.sessionOwned || !opts.sessionId) {
    return { kind: "blocked", message: "还没接到当前对话,采访选项不能当草稿发出" };
  }
  const live = projectLiveInterview({
    pageFocusId: opts.pageFocusId ?? "",
    sessionOwned: true,
    sessionId: opts.sessionId,
    spoken: opts.spoken ?? [],
    rounds: opts.rounds ?? [],
    committed: opts.committed ?? null
  });
  const stale =
    !live ||
    !opts.turnId ||
    !opts.focusId ||
    !opts.anchorRequestId ||
    opts.anchorGeneration === undefined ||
    opts.turnId !== live.turnId ||
    opts.focusId !== live.focusId ||
    opts.anchorRequestId !== live.anchorRequestId ||
    opts.anchorGeneration !== live.anchorGeneration ||
    (opts.question ?? "").trim() !== live.question;
  if (stale) return { kind: "blocked", message: "这道采访不属于当前事项,没有发出去" };
  const text = interviewTurnText(live.question, opts.option).trim();
  if (!text) return { kind: "blocked", message: "选项是空的,没有发出去" };
  return { kind: "send", text, sessionId: opts.sessionId };
}

/** Focus 页点击与校验同一入口:对不上当前锚和原 turn 时不调用 sendText。 */
export async function deliverInterviewPick(
  opts: Parameters<typeof resolveInterviewSend>[0],
  sendText: (text: string) => boolean | Promise<boolean>
): Promise<{ kind: "sent"; text: string } | { kind: "blocked" | "failed"; message: string }> {
  const decided = resolveInterviewSend(opts);
  if (decided.kind === "blocked") return decided;
  const ok = await sendText(decided.text);
  if (!ok) return { kind: "failed", message: "采访选项没发出去,内容还在这张卡上" };
  return { kind: "sent", text: decided.text };
}
