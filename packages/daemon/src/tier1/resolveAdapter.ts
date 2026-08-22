// W5.4-b C1:Tier1 生效 adapter 单源 resolver(方案 §3.9/D2;09 §11 claude_code 承载段)。
// [models.dev].agent 是唯一后端选择键(不新增 [tier1].agent);缺省 cursor——
// 产品缺省切 claude 由 W5.4-c 收口时改模板示例值承载,代码缺省不动(D2:避免半接线期把用户引到未完成后端)。

import type { Adapter } from "@saydo/contracts";
import type { SaydoConfig } from "../config/types.js";

/** 生效 adapter:cfg 缺/dev 段缺 ⇒ cursor(与既有 readDevAdapter 缺省语义恒等) */
export function resolveTier1Adapter(cfg: SaydoConfig | null | undefined): Adapter {
  return cfg?.models?.dev?.agent ?? "cursor";
}

/**
 * F-14 adapter 切换 reap 判定(方案 §3.6 恢复段):恢复时 row.adapter !== 生效 adapter ⇒
 * 按 recover 循环既有 "inconsistent" 口径 reap(executor.ts recover 的
 * `recovered-inconsistent` 结算链)+ 任务 blocked 叫人,不跨后端接续。
 * C1 只落判定纯函数;executor recover 循环接线归 C2。
 */
export type RunAdapterConsistency =
  | { consistent: true }
  | { consistent: false; rowAdapter: string; effectiveAdapter: Adapter };

export function checkRunAdapterConsistency(rowAdapter: string, effectiveAdapter: Adapter): RunAdapterConsistency {
  if (rowAdapter === effectiveAdapter) return { consistent: true };
  return { consistent: false, rowAdapter, effectiveAdapter };
}
