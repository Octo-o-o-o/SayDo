// 主题续接期间的免手采集/发送门:Chat 发布 hold,VoiceChannel 在开麦/送帧/asr.final 处执行。
// 无 pending 时 hold=false,普通免手与 PTT 行为不变。
// holdForConfirm 只配对“实际已启动、会出 final”的轮次;空闲免手不得记 daemon hold,
// 也不得先 hold 再切 PTT——免手 _force_finalize 空轮不发 final,残留旗会吞下一轮。

export type VoiceCaptureMode = "ptt" | "hands_free";

export type HandsFreeRoundPhase = "idle" | "open";

export type HandsfreeFinalRoute =
  | { action: "send"; text: string }
  | { action: "hold_as_draft"; text: string }
  | { action: "ignore" };

export type ThemedHoldCapturePlan = {
  stopMic: boolean;
  sendHoldForConfirm: boolean;
  allowImmediatePttSwitch: boolean;
  waitForFinal: boolean;
  resumeMic: boolean;
};

/** 已废弃:不得再用固定毫秒补 done_speaking。保留导出以免旧测试误引用时静默改语义。 */
export const THEMED_HOLD_EMPTY_FINAL_WAIT_MS = 0;

let held = false;
const listeners = new Set<(next: boolean) => void>();

export function isThemedVoiceHeld(): boolean {
  return held;
}

export function setThemedVoiceHold(next: boolean): void {
  if (held === next) return;
  held = next;
  for (const fn of listeners) fn(held);
}

export function subscribeThemedVoiceHold(fn: (next: boolean) => void): () => void {
  listeners.add(fn);
  fn(held);
  return () => {
    listeners.delete(fn);
  };
}

export function resetThemedVoiceHoldForTests(): void {
  held = false;
  listeners.clear();
}

export function nextHandsFreeRoundPhase(
  phase: HandsFreeRoundPhase,
  event: "vad_start" | "vad_end" | "asr_final" | "mode_leave_hf"
): HandsFreeRoundPhase {
  if (event === "mode_leave_hf" || event === "asr_final") return "idle";
  if (event === "vad_start") return "open";
  return phase;
}

export function planThemedHoldCapture(opts: {
  mode: VoiceCaptureMode;
  heldNow: boolean;
  handsFreeRound: HandsFreeRoundPhase;
}): ThemedHoldCapturePlan {
  if (opts.mode !== "hands_free") {
    return {
      stopMic: false,
      sendHoldForConfirm: false,
      allowImmediatePttSwitch: true,
      waitForFinal: false,
      resumeMic: false
    };
  }
  if (!opts.heldNow) {
    return {
      stopMic: false,
      sendHoldForConfirm: false,
      allowImmediatePttSwitch: true,
      waitForFinal: false,
      resumeMic: true
    };
  }
  if (opts.handsFreeRound === "open") {
    return {
      stopMic: true,
      sendHoldForConfirm: false,
      allowImmediatePttSwitch: false,
      waitForFinal: false,
      resumeMic: false
    };
  }
  return {
    stopMic: true,
    sendHoldForConfirm: false,
    allowImmediatePttSwitch: false,
    waitForFinal: false,
    resumeMic: false
  };
}

/** 免手开麦/送帧:主题未接上时不采集,避免 pipeline VAD 自动出 asr.final。 */
export function canHandsfreeCapture(mode: VoiceCaptureMode, themedHold: boolean): boolean {
  if (mode !== "hands_free") return true;
  return !themedHold;
}

/** 主题 hold 期间任何档都不得开麦/送帧;PTT 与免手同一道门。 */
export function canOpenMic(themedHold: boolean): boolean {
  return !themedHold;
}

export function routeHandsfreeAsrFinal(opts: {
  themedHold: boolean;
  text: string;
}): HandsfreeFinalRoute {
  const text = opts.text.trim();
  if (text === "") return { action: "ignore" };
  if (opts.themedHold) return { action: "hold_as_draft", text };
  return { action: "send", text };
}

/**
 * 队空 asr.final:主题 hold 期间无论当前 mode 都留稿,避免切 PTT 后吞迟到免手转写。
 * 无 hold 时 PTT 队空仍丢弃(超时/切模式孤儿);免手无 hold 直发。
 */
export function routeOrphanAsrFinal(opts: {
  mode: VoiceCaptureMode;
  themedHold: boolean;
  text: string;
}): HandsfreeFinalRoute {
  const text = opts.text.trim();
  if (text === "") return { action: "ignore" };
  if (opts.themedHold) return { action: "hold_as_draft", text };
  if (opts.mode === "hands_free") return { action: "send", text };
  return { action: "ignore" };
}

export type ThemedHoldCaptureActions = {
  getMode: () => VoiceCaptureMode;
  getHandsFreeRound: () => HandsFreeRoundPhase;
  stopMic: () => void;
  startMic: () => void;
  sendHoldForConfirm: () => void;
  switchToPtt: () => void;
};

/**
 * hold 升起:只停本地采集。不发 voice.mode、不补 done、不切 PTT。
 * 在录 PTT 的 finalize 由主题屏障 prepare 口处理。
 */
export function applyThemedHoldToCapture(heldNow: boolean, actions: ThemedHoldCaptureActions): ThemedHoldCapturePlan {
  const plan = planThemedHoldCapture({
    mode: actions.getMode(),
    heldNow,
    handsFreeRound: actions.getHandsFreeRound()
  });
  if (plan.stopMic) actions.stopMic();
  if (plan.sendHoldForConfirm) actions.sendHoldForConfirm();
  if (plan.resumeMic && actions.getMode() === "hands_free") actions.startMic();
  return plan;
}

export function bindThemedHoldToCapture(
  actions: ThemedHoldCaptureActions,
  onPlan?: (plan: ThemedHoldCapturePlan) => void
): () => void {
  let prev: boolean | null = null;
  return subscribeThemedVoiceHold((next) => {
    if (prev === null) {
      prev = next;
      if (next) {
        const plan = applyThemedHoldToCapture(true, actions);
        onPlan?.(plan);
      }
      return;
    }
    if (prev === next) return;
    prev = next;
    const plan = applyThemedHoldToCapture(next, actions);
    onPlan?.(plan);
  });
}
