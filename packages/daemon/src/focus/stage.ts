// Focus feature flag 骨架(实施计划 A5)。
// [focus].stage ∈ {0,1,2},缺省 0。
// stage 0 机械定义:Focus 工具不注册、Brain instructions 不变、close 链不挂载、
// 旧 session 路径不变、Focus 表零写入(行为侧)。

import type { SaydoConfig } from "../config/types.js";

export type FocusStage = 0 | 1 | 2;

export function getFocusStage(config: Pick<SaydoConfig, "focus"> | { focus?: { stage?: number } } | null | undefined): FocusStage {
  const raw = config?.focus?.stage;
  if (raw === 1 || raw === 2) return raw;
  return 0;
}

/** stage 0 不注册任何 Focus 工具;stage≥1 才暴露 anchor/收场相关 tool specs */
export function listFocusToolSpecs(stage: FocusStage): ReadonlyArray<{ name: string; description: string }> {
  if (stage === 0) return [];
  return [
    { name: "getFocusStatus", description: "Read Focus status: lifecycle/revision/open obligations. Call before answering what-is-owed questions." },
    { name: "proposeFocusAnchor", description: "Propose binding current session to a Focus (ConfirmationLoop)." },
    { name: "proposeObligation", description: "Propose opening or updating a Focus obligation (ConfirmationLoop)." },
    { name: "proposeObligationResolve", description: "Propose resolving an open obligation (done/abandoned/no_longer_applicable) via ConfirmationLoop. Ledger truth lives here, not in revision narrative." },
    { name: "proposeFocusRevision", description: "Propose settling a new FocusState revision (ConfirmationLoop)." },
    { name: "proposeLaneSplit", description: "Propose splitting Focus work into parallel lanes (ConfirmationLoop)." },
    {
      name: "proposeExpectationAck",
      description:
        "After expectation_adjusted control turn: restate impact and present expectation_ack confirmation card."
    },
    { name: "proposeFocusClose", description: "Propose close settlement checklist for current Focus activation. Only when the user explicitly signals ending the session — completing an anchor/obligation/dispatch is NOT an ending signal." }
  ];
}

/** Hopper binding 生产通路开关;缺省关(dormant 完整写序,fake-hopper 测) */
export function isHopperFocusBindingEnabled(
  config: { focus?: { hopperBindingEnabled?: boolean } } | null | undefined
): boolean {
  return config?.focus?.hopperBindingEnabled === true;
}

/** stage 0 不注入 Focus 相关 Brain instructions */
export function focusBrainInstructionDelta(stage: FocusStage): string {
  if (stage === 0) return "";
  return [
    "Focus tools may propose anchors and close checklists only; never write Focus state directly.",
    "Title match yields candidates only — never silent-pick by recency.",
    "When the user says an obligation is finished, call proposeObligationResolve — narrative revisions do NOT settle the ledger.",
    "A tool result with done:true settles that single action only — it never means the session is over. Never call suspendSession or propose closing unless the user explicitly said they are done (e.g. 先到这里/过会儿再说).",
    "When anchored to a fresh Focus (zero revisions, zero open obligations) and the [当前 Focus] section gives you no background, ask the user for one or two sentences of context BEFORE giving substantive suggestions — never improvise generic advice.",
    "When the session is NOT anchored and the user's topic clearly matches a Focus in [可接续的 Focus], call proposeFocusAnchor with that title to offer continuation (the user need not remember the Focus exists); if unsure, ask one short question instead of guessing."
  ].join("\n");
}

/** stage≥2 才 enforce close settlement 为关闭前置;stage 1 纯建议可跳过零语义写入 */
export function shouldEnforceFocusClose(stage: FocusStage): boolean {
  return stage >= 2;
}

/** stage≥1 才在 close 链上呈现收场清单 */
export function shouldPresentFocusCloseChecklist(stage: FocusStage): boolean {
  return stage >= 1;
}

/** stage 0 下禁止服务层写 Focus 表的门(负向测试用) */
export function assertFocusWriteAllowed(stage: FocusStage): void {
  if (stage === 0) {
    throw new Error("focus_stage0_write_denied: Focus writes are disabled at stage 0");
  }
}
