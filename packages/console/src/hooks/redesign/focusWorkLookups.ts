import type { DecisionPackageView, TaskView } from "../../components/redesign/types";
import type { ConfirmCardIdentity } from "../../lib/taskModalView";
import {
  mapDecisionPackageView,
  mapTaskViewFromDetail,
  mapTaskRowToView,
  packageLookupKey,
  type AttentionItemRow,
  type FocusDetailPayload,
  type TaskDetailPayload
} from "./mappers";

export type LiveConfirmCard = ConfirmCardIdentity & { text?: string; sessionId?: string };

export function sessionOwnedByFocus(
  currentSessionId: string | null | undefined,
  sessions: Array<{ id: string }>
): boolean {
  if (!currentSessionId) return false;
  return sessions.some((s) => s.id === currentSessionId);
}

export function buildFocusWorkLookups(input: {
  focusId: string;
  detail: FocusDetailPayload;
  taskDetails: Array<TaskDetailPayload | null>;
  attention: AttentionItemRow[];
  liveCard?: LiveConfirmCard | null;
  sessionOwned: boolean;
}): {
  tasks: TaskView[];
  taskLookup: Record<string, TaskView>;
  packageLookup: Record<string, DecisionPackageView>;
} {
  const taskLookup: Record<string, TaskView> = {};
  const tasks: TaskView[] = [];
  // 绑定读口决定成员；单条详情只补齐同一任务，不把失败或错 id 当成无绑定。
  const detailsById = new Map(input.taskDetails.filter((d) => d?.task).map((d) => [String(d!.task.id ?? ""), d!]));
  const boundIds = new Set((input.detail.tasks ?? []).map((t) => t.id));
  for (const bound of input.detail.tasks ?? []) {
    const detail = detailsById.get(bound.id);
    const view = detail
      ? mapTaskViewFromDetail(detail.task, input.focusId, detail.costs)
      : { ...mapTaskRowToView(bound, input.focusId), detailUnavailable: true };
    tasks.push(view);
    taskLookup[view.id] = view;
  }

  const packageLookup: Record<string, DecisionPackageView> = {};
  const putPkg = (pkg: DecisionPackageView): void => {
    if (!pkg.id) return;
    packageLookup[pkg.id] = pkg;
    packageLookup[packageLookupKey(pkg.id, pkg.revision)] = pkg;
  };

  const focusPackageAuthority = new Map<string, Pick<DecisionPackageView, "status" | "mode">>();
  for (const raw of input.detail.packages ?? []) {
    const view = mapDecisionPackageView(raw);
    putPkg(view);
    // Focus 完整读口重组状态并验证 canonical 正文；同 revision 的补充读口不能丢掉合法模式。
    if (raw.status === view.status) focusPackageAuthority.set(packageLookupKey(view.id, view.revision), { status: view.status, mode: view.mode });
  }
  for (const detail of input.taskDetails) {
    if (detail?.package && boundIds.has(String(detail.task?.id ?? "")) && typeof detail.package === "object") {
      const task = detail.task ?? {};
      const raw = {
        ...detail.package,
        id: String(detail.package["id"] ?? task["package_id"] ?? task["packageId"] ?? ""),
        revision: Number(detail.package["revision"] ?? task["package_rev"] ?? task["packageRev"] ?? 1),
        projectId: String(detail.package["projectId"] ?? task["project_id"] ?? task["projectId"] ?? "")
      };
      const view = mapDecisionPackageView(raw);
      const authority = focusPackageAuthority.get(packageLookupKey(view.id, view.revision));
      if (authority) {
        view.status = authority.status;
        if (authority.mode) view.mode = authority.mode;
      }
      else if (detail.package["status"] !== view.status) continue;
      // 无同 revision 权威状态且 body 不含合法状态时，不新造 proposed 包。
      putPkg(view);
    }
  }

  const card = input.liveCard;
  if (
    input.sessionOwned &&
    card?.kind === "dispatch" &&
    card.packageId &&
    card.revision !== undefined
  ) {
    const existing = packageLookup[packageLookupKey(card.packageId, card.revision)] ?? packageLookup[card.packageId];
    if (!existing) {
      putPkg(
        mapDecisionPackageView(
          { id: card.packageId, revision: card.revision, status: "proposed" },
          { outcomePreview: card.text }
        )
      );
    }
  }
  for (const item of input.attention) {
    if (item.focusId !== input.focusId || item.confirmKind !== "dispatch") continue;
    if (card?.kind === "dispatch" && card.packageId && card.revision !== undefined && item.refId === card.receiptId) {
      if (!packageLookup[card.packageId]) {
        putPkg(
          mapDecisionPackageView(
            { id: card.packageId, revision: card.revision, status: "proposed" },
            { outcomePreview: item.title || card.text }
          )
        );
      }
    }
  }

  return { tasks, taskLookup, packageLookup };
}

export function dispatchCardMatchesPackage(
  card: LiveConfirmCard | null | undefined,
  pkg: { id: string; revision: number } | undefined
): boolean {
  if (!card || !pkg) return false;
  return (
    card.kind === "dispatch" &&
    card.packageId === pkg.id &&
    card.revision === pkg.revision &&
    Boolean(card.receiptId) &&
    Boolean(card.digest)
  );
}
