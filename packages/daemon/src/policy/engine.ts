// E2 安全策略引擎(计划 3.4;modules/e E2;04 §5.1):effect-based 风险计算——
// 分级由效果计算(effect x 目标 x 数据敏感度 x 下游 x 成本),不按动作名硬编码(03 §2 明令);
// 输入是 effect 描述对象,不是命令字符串正则。
// verify 白名单:只认登记模板(package_script/justfile),Brain 只能选不能拼(04 §5.3)。
// 与 C2 执行点复验共享同一判定函数(单实现防漂移,4.1 消费)。
// EffectGrant 预授权推导(deriveGrants)= P0.5-C(P0 单档逐步确认,preauthorizedEffects 恒空)。

import { effectiveProtectedBranches } from "@saydo/contracts";

export const EFFECT_POLICY_VERSION = "e2/0.1.0";

export type RiskLevel = "S0" | "S1" | "S2" | "S3";

/** effect 描述对象(风险计算输入;由调用方从计划/工具调用语义构造,不做命令字符串解析) */
export interface EffectDescriptor {
  kind:
    | "read"
    | "write_worktree"
    | "run_registered_verify"
    | "install_dependency"
    | "push_branch"
    | "merge_to_protected"
    | "deploy"
    | "spend_money"
    | "delete_data"
    | "send_external";
  /** 分支名/包名/路径(圈内外判定用) */
  target?: string;
  /** 触及 .env/凭据/客户数据(04 §5.1 升级规则:升 S2+) */
  touchesSensitiveData?: boolean;
  /** install 的包带 postinstall 脚本(升 S2 且必须出清单,09 §2 constraints.packages 注) */
  hasPostinstall?: boolean;
  /** push 的分支会触发预览部署(下游触发,升 S3) */
  triggersDeployPreview?: boolean;
  /** 实现备注,不参与 computeRisk(如悬空 symlink) */
  reason?: string;
}

const BASE_RISK: Record<EffectDescriptor["kind"], RiskLevel> = {
  read: "S0",
  write_worktree: "S1",
  run_registered_verify: "S1",
  install_dependency: "S2",
  push_branch: "S2",
  merge_to_protected: "S3",
  deploy: "S3",
  spend_money: "S3",
  delete_data: "S3",
  send_external: "S3"
};

const ORDER: RiskLevel[] = ["S0", "S1", "S2", "S3"];

function maxRisk(a: RiskLevel, b: RiskLevel): RiskLevel {
  return ORDER.indexOf(a) >= ORDER.indexOf(b) ? a : b;
}

export interface RiskContext {
  protectedBranches?: readonly string[];
}

/** 风险计算(04 §5.1:典型缺省 + 效果升级;返回升级原因供审计/话术) */
export function computeRisk(d: EffectDescriptor, ctx?: RiskContext): { level: RiskLevel; escalations: string[] } {
  let level = BASE_RISK[d.kind];
  const escalations: string[] = [];
  if (d.touchesSensitiveData) {
    level = maxRisk(level, "S2");
    escalations.push("touches sensitive data (.env/customer/credential) => >=S2");
  }
  if (d.kind === "install_dependency" && d.hasPostinstall) {
    level = maxRisk(level, "S2");
    escalations.push("dependency has postinstall script => >=S2 (must be listed)");
  }
  if (d.kind === "push_branch") {
    if (d.triggersDeployPreview) {
      level = maxRisk(level, "S3");
      escalations.push("push triggers deploy preview (downstream) => S3");
    }
    // 09 §11 [git].protected 取并集(Codex 14 #3):项目值只能追加,不能顶掉 main/master 安全默认
    const protectedBranches = effectiveProtectedBranches(ctx?.protectedBranches);
    if (d.target !== undefined && protectedBranches.includes(d.target)) {
      level = maxRisk(level, "S3");
      escalations.push(`push to protected branch ${d.target} => S3`);
    }
  }
  return { level, escalations };
}

/** verify 白名单登记(04 §5.3:只认登记模板;形态 "package_script:<name>" / "justfile:<task>") */
export interface VerifyRegistry {
  packageScripts: readonly string[];
  justfileTasks: readonly string[];
}

/**
 * verify 命令判定(单实现,C2 执行点复验共享):Brain 只能"选"登记项,任何拼接串拒。
 * 传入形态必须是登记模板引用(如 "package_script:test"),不接受原始 shell 字符串。
 */
export function isRegisteredVerify(templateRef: string, registry: VerifyRegistry): boolean {
  const [kind, name, ...rest] = templateRef.split(":");
  if (rest.length > 0 || !name || name.trim() !== name) return false;
  if (kind === "package_script") return registry.packageScripts.includes(name);
  if (kind === "justfile") return registry.justfileTasks.includes(name);
  return false;
}
