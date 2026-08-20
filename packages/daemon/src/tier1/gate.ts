// Tier1 审批门(计划 4.1;G3 审批门完整性 + fail-closed 四律)。
// cursor worktree 内 beforeShellExecution 钩子对每条 shell 命令阻塞回连 daemon,daemon 决策后返回 allow/deny。
// fail-closed 四律(spike 8 实证):
//   ① 只依赖 deny(cursor allow/ask 有 bug,钩子"缺省 deny、批准才非 deny");
//   ② jq 构造 JSON(畸形 fail-open,gate.sh 侧保证,daemon 侧只吐结构化对象);
//   ③ 超时=deny(daemon 决策超时 ⇒ 钩子超时 ⇒ deny);
//   ④ 每条命令独立审批(禁便车:一次 allow 不长期有效)。
// canary:cursor 事件流里出现 shell tool_call 但 daemon 未收到对应门请求 ⇒ 门被绕过 ⇒ 立即 cancel。

import { computeRisk, isRegisteredVerify, type EffectDescriptor, type RiskLevel, type VerifyRegistry } from "../policy/engine.js";

export interface GateRequest {
  taskId: string;
  /** 命令序号(每条命令独立;禁便车) */
  seq: number;
  command: string;
  /** 调用方声明的效果(由适配层从命令语义映射;S0/S1 自动放行,S2 上浮,S3 拒) */
  effect: EffectDescriptor;
}

export type GateDecision =
  | { permission: "allow"; risk: RiskLevel }
  | { permission: "deny"; risk: RiskLevel; reason: string };

/** S2 上浮审批的回调(4.2 C5 接语音逐步确认;返回 true=用户 accept) */
export type StepConfirmFn = (req: GateRequest, risk: RiskLevel) => Promise<boolean>;

export interface GateDeps {
  registry: VerifyRegistry;
  protectedBranches?: readonly string[];
  stepConfirm: StepConfirmFn;
  /** S2 审批超时(ms);超时=deny(fail-closed 律③) */
  approvalTimeoutMs?: number;
}

/**
 * 单命令决策(fail-closed):
 * - S0/S1 自动放行;registered verify 视作 S1;
 * - S2 上浮 stepConfirm(超时/拒 ⇒ deny);
 * - S3 语音绝不放行(04 §5.1)⇒ deny;
 * - 未知/异常 ⇒ deny(律①只认 allow 的反面)。
 */
export async function decideCommand(req: GateRequest, deps: GateDeps): Promise<GateDecision> {
  let risk: RiskLevel;
  try {
    // Phase4 评审 A2:不得用 [] 顶掉 computeRisk 的 ["main","master"] 安全默认——
    // 未配置时透传 undefined,push main/master 恒升 S3(fail-safe 默认)
    risk = computeRisk(
      req.effect,
      deps.protectedBranches !== undefined ? { protectedBranches: deps.protectedBranches } : {}
    ).level;
  } catch {
    return { permission: "deny", risk: "S3", reason: "risk computation failed (fail-closed)" };
  }
  if (risk === "S0" || risk === "S1") return { permission: "allow", risk };
  if (risk === "S3") return { permission: "deny", risk, reason: "S3 never granted by voice (04 §5.1)" };
  // S2:上浮逐步确认(P0 单档),超时/拒 ⇒ deny
  const timeoutMs = deps.approvalTimeoutMs ?? 45_000;
  let approved = false;
  try {
    approved = await Promise.race([
      deps.stepConfirm(req, risk),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs))
    ]);
  } catch {
    approved = false;
  }
  return approved
    ? { permission: "allow", risk }
    : { permission: "deny", risk, reason: "S2 step-confirm denied or timed out (fail-closed)" };
}

/** verify 命令走白名单执行器判定(04 §5.3;registered ⇒ S1 自动放行的前提) */
export function isVerifyCommand(templateRef: string, registry: VerifyRegistry): boolean {
  return isRegisteredVerify(templateRef, registry);
}

/**
 * canary 关联器:每条 shell 命令必须先经门请求(seq 递增),再有 tool_call 事件。
 * 观察到 shell tool_call 但无对应门请求(seq 未登记)⇒ 门被绕过 ⇒ 触发 cancel。
 */
export class GateCanary {
  private readonly gated = new Set<number>();
  private tripped = false;

  /** 门收到请求:登记该 seq(命令即将被门控) */
  recordGateRequest(seq: number): void {
    this.gated.add(seq);
  }

  /**
   * 观察到一次 shell tool_call(适配层从事件流解出);seq 未在门请求集中 ⇒ 绕过 ⇒ 返回 true(须 cancel)。
   * 非 shell 工具(read/glob)不参与(worktree 内读无害,04 §5.1 S0)。
   * Phase4 评审 B3:登记**消费一次即删**——同 seq 第二条 tool_call 视为搭便车,同样 trip
   * (禁便车律④的机械面);顺带解决 Set 无界增长。
   */
  observeShellToolCall(seq: number): boolean {
    if (!this.gated.has(seq)) {
      this.tripped = true;
      return true;
    }
    this.gated.delete(seq); // 一次性核销
    return false;
  }

  hasTripped(): boolean {
    return this.tripped;
  }
}
