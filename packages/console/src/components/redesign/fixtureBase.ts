// fixture 共享构造器:按 HANDOFF §3 形状造 mock(不 import daemon,纯数据)。
import type { FocusView, ObligationView, TaskView, ViewStatus } from "./types";

export const NOW = Date.now();
export const min = (n: number) => new Date(NOW - n * 60000).toISOString();

export function makeTask(partial: Partial<TaskView> & { id: string; viewStatus: ViewStatus }): TaskView {
  return {
    focusId: "foc_demo",
    title: partial.id,
    route: "tier1",
    adapter: "claude_code",
    attempt: 1,
    riskLevel: "S1",
    elapsedMin: 12,
    budget: { walltimeActiveMin: 45, maxTurns: 60, maxCost: 25 },
    spent: { known: true, value: 4.2 },
    lastEvent: "按合同推进中",
    projectTitle: "SayDo-console-build",
    ...partial
  };
}

export const FOCUS_DEMO: FocusView = {
  id: "foc_demo",
  title: "给 SayDo 重做前端",
  lifecycle: "active",
  currentRevision: 14,
  direction: "把 14 页控制台收成「三面一栏」,先出提案 demo 给义骁确认",
  openByOwner: { human: 2, agent: 2, external: 1 },
  projectRefs: ["prj_console"]
};

export function makeObligation(partial: Partial<ObligationView> & { id: string }): ObligationView {
  return {
    focusId: "foc_demo",
    title: partial.id,
    owner: "agent",
    status: "open",
    laneId: "lan_main",
    ...partial
  };
}
