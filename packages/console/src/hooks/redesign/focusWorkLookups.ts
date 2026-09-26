import type { DecisionPackageView, TaskView } from "../../components/redesign/types";
import type { ConfirmCardIdentity } from "../../lib/taskModalView";
import {
  mapDecisionPackageView,
  mapTaskViewFromDetail,
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
  for (const detail of input.taskDetails) {
    if (!detail?.task) continue;
    const view = mapTaskViewFromDetail(detail.task, input.focusId);
    if (!view.id) continue;
    tasks.push(view);
    taskLookup[view.id] = view;
  }

  const packageLookup: Record<string, DecisionPackageView> = {};
  const putPkg = (pkg: DecisionPackageView): void => {
    if (!pkg.id) return;
    packageLookup[pkg.id] = pkg;
    packageLookup[packageLookupKey(pkg.id, pkg.revision)] = pkg;
  };

  for (const raw of input.detail.packages ?? []) {
    putPkg(mapDecisionPackageView(raw));
  }
  for (const detail of input.taskDetails) {
    if (detail?.package && typeof detail.package === "object") {
      const task = detail.task ?? {};
      putPkg(
        mapDecisionPackageView({
          ...detail.package,
          id: String(detail.package["id"] ?? task["package_id"] ?? task["packageId"] ?? ""),
          revision: Number(detail.package["revision"] ?? task["package_rev"] ?? task["packageRev"] ?? 1),
          projectId: String(detail.package["projectId"] ?? task["project_id"] ?? task["projectId"] ?? "")
        })
      );
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
