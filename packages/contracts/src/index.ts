// @saydo/contracts — docs/09 数据契约的唯一代码载体。
// 其余包只 import 本包,不得重定义 09 已有类型(AGENTS.md 硬规则 5)。

export const CONTRACTS_VERSION = "0.1.0";

// §0 基元
export * from "./ids.js";
export * from "./jcs.js";
export * from "./types/common.js";

// §1-§13 类型
export * from "./types/project.js";
export * from "./types/package.js";
export * from "./types/approval.js";
export * from "./types/memory.js";
export * from "./types/sourceverify.js";
export * from "./types/contextpack.js";
export * from "./types/task.js";
export * from "./types/dispatch.js";
export * from "./types/outbox.js";
export * from "./types/artifact.js";
export * from "./types/pipeline.js";
export * from "./types/modelbinding.js";
export * from "./types/tools.js";
export * from "./types/presentation.js"; // §14-A2/A8 完整形态(P0.5-A)
export * from "./types/hopper.js"; // §7/§6.2/§6.3(P0.5-A A3/A4)
export * from "./types/webauthn.js"; // §3.3 S3 卡(WebauthnCredential/S3Challenge;W4)
export * from "./types/focus.js"; // Focus Contract v0.2.1(批 1/批 2 形状)
export * from "./types/confirmation.js"; // Focus v0.4 ④a confirmation_ledger
export * from "./types/mobile.js"; // M1 移动只读投影与回执词表

// §0.1 digest 生成-校验矩阵
export * from "./digests.js";

// readinessSkeleton 单源(§13/§4;02 §5 类型就绪清单;W4 Codex 21 A3)
export * from "./readiness.js";

// 可分发运行时身份/readiness/supervisor IPC(09 §16)
export * from "./runtime.js";

// 0.2b:renderSpoken + EffectGrant fail-closed + dispatch 校验
export * from "./effects.js";

// 状态机(§3 / §6.1 / §6.3 / §9)
export * from "./statemachines/receipt.js";
export * from "./statemachines/task.js";
export * from "./statemachines/tier1run.js";
export * from "./statemachines/outbox.js";
