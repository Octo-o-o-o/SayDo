// A7 模式 x 后端支持矩阵(P0.5-A;SoT=04 §5.4 canonical 矩阵,owner 2026-07-23 拍板)。
// Hopper step_confirm=unsupported(首发;显式改走 Tier1 或直达验收,步序循环 P1 再评);
// Hopper 直达验收 = P0.5 主形态(预授权恒空);batch 切档 = cancel-new-run。
// capability 握手照答:bridge 启动断言消费本表 + hopper capabilities --json。

export type ExecBackend = "tier1" | "hopper";
export type ExecMode = "step_confirm" | "direct_to_review";

export interface ModeSupport {
  supported: boolean;
  /** 不支持时的话术要点(10 切档话术按 capability 分支) */
  fallbackPhrase?: string;
  /** 切档语义 */
  switchSemantics: "live" | "cancel_new_run";
}

const MATRIX: Record<ExecBackend, Record<ExecMode, ModeSupport>> = {
  tier1: {
    step_confirm: { supported: true, switchSemantics: "live" },
    direct_to_review: { supported: true, switchSemantics: "live" }
  },
  hopper: {
    step_confirm: {
      supported: false, // 首发 unsupported:步序循环 P1 再评
      fallbackPhrase: "这个后端不支持每步问你——要么转成 Tier1 逐步盯,要么一口气跑到等你验收",
      switchSemantics: "cancel_new_run"
    },
    direct_to_review: { supported: true, switchSemantics: "cancel_new_run" } // P0.5 主形态,预授权恒空
  }
};

export function modeSupport(backend: ExecBackend, mode: ExecMode): ModeSupport {
  return MATRIX[backend][mode];
}

/** dispatch 前断言:不支持的组合 fail-closed 拒派(带话术要点上浮,不静默换档) */
export function assertModeSupported(backend: ExecBackend, mode: ExecMode): { ok: boolean; fallbackPhrase?: string } {
  const s = modeSupport(backend, mode);
  return s.supported ? { ok: true } : { ok: false, ...(s.fallbackPhrase ? { fallbackPhrase: s.fallbackPhrase } : {}) };
}
