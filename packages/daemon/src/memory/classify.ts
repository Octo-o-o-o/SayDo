// auto_low_impact 独立机械判定器(owner 2026-07-24;09 §4 写路径)。
// ⟺ source.kind ∈ {git-tracked repo_file, user_edit} ∧ 内容为事实性陈述(非指令/副作用)。
// repo_file 来源默认带 taint 待复核;含指令词/副作用或第三方来源一律降 candidate。机械规则、不经 Brain。

import type { MemoryEvent, SourceRef, Tier, Trust } from "@saydo/contracts";

// 指令/副作用词(命中即非"事实性陈述",降 candidate)。
// 注:中文字符间无 \b 词边界,中文关键词不加 \b;英文保留 \b。
const IMPERATIVE_PATTERNS: RegExp[] = [
  /\bcurl\b[\s\S]*\|\s*(?:sh|bash|zsh)\b/i, // curl | sh 供应链
  /\bwget\b[\s\S]*\|\s*(?:sh|bash)\b/i,
  /\brm\s+-rf\b/i,
  /\bsudo\b/i,
  /\bnpm\s+(?:i|install|publish)\b/i,
  /\bgit\s+push\b/i,
  /\bpostinstall\b/i,
  /\b(?:deploy|migrate|migration)\b/i,
  /\b(?:drop\s+table|truncate)\b/i,
  /(?:部署|上线|发布|删除|删库|迁移)/, // 中文指令词(无 \b)
  /(?:请|帮我|去|应该|需要你)\s*(?:执行|运行|跑|装|删|改|推)/ // 祈使/指令口吻
];

/** 第三方来源(内容永远不能定义偏好/权限/凭据,04 §1.4) */
const THIRD_PARTY_KINDS: SourceRef["kind"][] = ["web", "agent_output", "import"];

export function isImperative(claim: string): boolean {
  return IMPERATIVE_PATTERNS.some((re) => re.test(claim));
}

export interface ClassifyInput {
  tier: Tier;
  claim: string;
  source: SourceRef;
  /** 用户请求的 trust(remember 工具:user_stated / user_approved) */
  requestedTrust?: Trust;
  /** repo_file 是否 git-tracked(判定器要求 git-tracked;调用方从 git 检出) */
  gitTracked?: boolean;
}

export interface ClassifyResult {
  trust: Trust;
  taint?: string[];
}

export class MemoryPolicyError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message);
  }
}

/**
 * 写路径信任分级 + M0 红线(09 §4)。
 * - 直入 trusted 仅 user_stated 与 auto_low_impact;
 * - auto_low_impact ⟺ source ∈ {git-tracked repo_file, user_edit} ∧ 事实性陈述(repo_file 带 taint);
 * - 指令词/第三方来源 => candidate;
 * - M0 只接受 user_stated / user_approved(否则抛 MemoryPolicyError,红线)。
 */
export function classifyTrust(input: ClassifyInput): ClassifyResult {
  const { tier, claim, source, requestedTrust } = input;

  // 用户亲述/确认:直入 trusted(M0 也允许)
  if (requestedTrust === "user_stated" || requestedTrust === "user_approved") {
    enforceM0(tier, requestedTrust);
    return { trust: requestedTrust };
  }

  // 第三方来源:一律 candidate(M0 直接红线拒)
  if (THIRD_PARTY_KINDS.includes(source.kind)) {
    enforceM0(tier, "third_party"); // M0 拒第三方(抛错)
    return { trust: "candidate" };
  }

  // auto_low_impact 机械判定
  const eligibleSource =
    (source.kind === "repo_file" && input.gitTracked === true) || source.kind === "user_edit";
  if (eligibleSource && !isImperative(claim)) {
    const trust: Trust = "auto_low_impact";
    enforceM0(tier, trust); // auto_low_impact 不满足 M0(M0 只 user_stated/approved)=> 拒
    // repo_file 默认带 taint 待复核
    return source.kind === "repo_file" ? { trust, taint: ["repo_file"] } : { trust };
  }

  // 其余(含指令词、非 git-tracked repo_file、user_utterance 未标 trust 等)=> candidate
  enforceM0(tier, "candidate");
  return { trust: "candidate" };
}

/** M0 红线:M0 只接受 user_stated / user_approved(04 §1.4 安全边界) */
function enforceM0(tier: Tier, trust: Trust): void {
  if (tier === "M0" && trust !== "user_stated" && trust !== "user_approved") {
    throw new MemoryPolicyError(
      `M0 只接受 user_stated/user_approved(第三方/派生内容不得定义偏好/权限/凭据);拒收 trust=${trust}`,
      "m0_rejects_untrusted"
    );
  }
}

/** consolidate P0 拒(09 §4:consolidate=P1) */
export function assertWritable(event: MemoryEvent): void {
  if (event.op === "consolidate") {
    throw new MemoryPolicyError("consolidate 是 P1,P0 写路径拒收", "consolidate_p1");
  }
}
