import { isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DecisionPackageCard } from "../../components/redesign/DecisionPackageCard";
import type { DecisionPackageView } from "../../components/redesign/types";
import { decisionPackageFixtures } from "../../components/redesign/DecisionPackageCard.fixture";
import { buildFocusWorkLookups } from "./focusWorkLookups";
import { mapDecisionPackageView } from "./mappers";
import type { FocusDetailPayload } from "./mappers";

const BASE = decisionPackageFixtures[0]!.pkg;
const focusId = "foc_mode";
const taskId = "tsk_mode";

function fromReadPayload(mode: "step_confirm" | "direct_to_review"): DecisionPackageView {
  const raw = { ...BASE, mode };
  const detail = {
    focus: { id: focusId, title: "模式读口", lifecycle: "active", currentRevision: 1, direction: null },
    tasks: [{ id: taskId, title: "绑定任务", status: "queued" }],
    packages: [raw], obligations: [], lanes: [], events: [], repos: [], artifacts: []
  } as FocusDetailPayload;
  const { status: _status, ...body } = raw;
  return buildFocusWorkLookups({
    focusId, detail, taskDetails: [{ task: { id: taskId }, package: body, runs: [] }],
    attention: [], sessionOwned: false
  }).packageLookup[`${raw.id}@${raw.revision}`]!;
}

function findApprove(node: ReactNode): ReactElement<{ disabled?: boolean; onClick?: () => void }> | undefined {
  if (Array.isArray(node)) {
    for (const child of node) { const found = findApprove(child); if (found) return found; }
    return undefined;
  }
  if (!isValidElement<{ children?: ReactNode; disabled?: boolean; onClick?: () => void }>(node)) return undefined;
  if (node.props.children === "拍板,开始") return node;
  return findApprove(node.props.children);
}

describe("决策包真实读口形状到生产卡片的模式边界", () => {
  it.each(["step_confirm", "direct_to_review"] as const)("mapper保留canonical %s，不另造模式", (mode) => {
    expect((mapDecisionPackageView({ ...BASE, mode }) as unknown as { mode?: string }).mode).toBe(mode);
  });

  it("同id/revision的旧direct经lookup仍禁批准，不谎称逐步确认", () => {
    const pkg = fromReadPayload("direct_to_review");
    const html = renderToStaticMarkup(<DecisionPackageCard pkg={pkg} />);
    expect(html).toContain("不能从这里拍板");
    expect(findApprove(DecisionPackageCard({ pkg }))?.props.disabled).toBe(true);
  });

  it("canonical direct不能被UI selectedMode=step覆盖，直接调生产回调也拒绝", () => {
    const pkg = { ...fromReadPayload("direct_to_review"), selectedMode: "step_confirm" as const };
    const actions: string[] = [];
    const button = findApprove(DecisionPackageCard({ pkg, onAction: action => actions.push(action) }));
    expect(button).toBeDefined();
    button!.props.onClick?.();
    expect(actions).toEqual([]);
  });

  it("合法canonical step优先于UI兼容字段，正常批准只发一次", () => {
    const pkg = { ...fromReadPayload("step_confirm"), selectedMode: "direct_to_review" as const };
    const actions: string[] = [];
    const button = findApprove(DecisionPackageCard({ pkg, onAction: action => actions.push(action) }));
    expect(button?.props.disabled).toBe(false);
    button!.props.onClick?.();
    expect(actions).toEqual(["approve"]);
  });

  it("无完整包的旧UI兼容direct仍拒绝，未选模式仍保留每步问你", () => {
    const old = { ...BASE, selectedMode: "direct_to_review" as const };
    const actions: string[] = [];
    const button = findApprove(DecisionPackageCard({ pkg: old, onAction: action => actions.push(action) }));
    expect(button?.props.disabled).toBe(true);
    button!.props.onClick?.();
    expect(actions).toEqual([]);
    expect(findApprove(DecisionPackageCard({ pkg: BASE }))?.props.disabled).toBe(false);
    const html = renderToStaticMarkup(<DecisionPackageCard pkg={BASE} />);
    expect(html).toContain("每步问你");
    expect(html).not.toContain("select_mode");
  });

  it("同revision的任务补充缺模式不抹掉Focus canonical direct，异revision不串模式", () => {
    const raw = { ...BASE, mode: "direct_to_review" };
    const detail = {
      focus: { id: focusId, title: "模式读口", lifecycle: "active", currentRevision: 1, direction: null },
      tasks: [{ id: taskId, title: "绑定任务", status: "queued" }],
      packages: [raw], obligations: [], lanes: [], events: [], repos: [], artifacts: []
    } as FocusDetailPayload;
    const { status: _status, ...body } = BASE;
    const work = buildFocusWorkLookups({ focusId, detail, taskDetails: [{ task: { id: taskId }, package: body, runs: [] }], attention: [], sessionOwned: false });
    expect(work.packageLookup[`${BASE.id}@${BASE.revision}`]?.mode).toBe("direct_to_review");
    const other = buildFocusWorkLookups({ focusId, detail, taskDetails: [{ task: { id: taskId }, package: { ...body, revision: BASE.revision + 1 }, runs: [] }], attention: [], sessionOwned: false });
    expect(other.packageLookup[`${BASE.id}@${BASE.revision + 1}`]).toBeUndefined();
  });
});
