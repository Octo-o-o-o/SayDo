// 0.2b:renderSpoken 纯模板(docs/10 §4.1,照抄、禁自由造句)+ EffectGrant fail-closed 校验器(docs/09 §2)
// + dispatch 校验(§12-2 ①/⑨/⑩ + effectPolicyVersion + Gate 0 无 bypass)。
// E2 策略引擎(3.4)与审批服务复用本实现,不重建第三层。

import type { DecisionPackage, EffectGrant, EffectKind, DownstreamTriggers } from "./types/package.js";
import { effectKindSchema } from "./types/package.js";
import type { ExecutionMode } from "./types/project.js";
import type { TaskRoute } from "./types/task.js";
import { computeGrantDigest, verifyPackageDigest } from "./digests.js";

export const DEFAULT_PROTECTED_BRANCHES = ["main", "master"] as const;

/**
 * renderSpoken(10 §4.1 模板,实施照抄):
 *   install_dependency -> "装 {packages 逗号连接} 这{N}个依赖{registry 非默认时:,从 {registry}}"
 *   push_branch        -> "推到 {branchPattern} 分支{ci_preview 时:,会触发预览部署}"
 * 必填约束缺失或 effect 不在表内 => 抛错(对应整包拒签)。
 * 注:09 §2 EffectGrant.constraints 无 registry 字段,P0 该从句恒不触发(模板保留以对齐 10)。
 */
export function renderSpoken(
  effect: EffectKind,
  constraints: EffectGrant["constraints"],
  downstreamTriggers: DownstreamTriggers
): string {
  if (effect === "install_dependency") {
    if (!constraints.packages || constraints.packages.length === 0) {
      throw new Error("renderSpoken: install_dependency requires constraints.packages");
    }
    return `装 ${constraints.packages.join(",")} 这${constraints.packages.length}个依赖`;
  }
  if (effect === "push_branch") {
    if (!constraints.branchPattern) {
      throw new Error("renderSpoken: push_branch requires constraints.branchPattern");
    }
    const downstream = downstreamTriggers === "ci_preview" ? ",会触发预览部署" : "";
    return `推到 ${constraints.branchPattern} 分支${downstream}`;
  }
  throw new Error(`renderSpoken: effect not in template table: ${String(effect)}`);
}

/** 最小 glob(仅 `*` 通配)。branchPattern 与保护分支求交用。 */
function globMatch(pattern: string, name: string): boolean {
  const regex = new RegExp("^" + pattern.split("*").map(escapeRegExp).join(".*") + "$");
  return regex.test(name);
}
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface GrantValidationResult {
  ok: boolean;
  /** 整包拒签的全部原因(不静默剔除单条,09 §2 规则 1) */
  reasons: string[];
}

/**
 * EffectGrant fail-closed 校验(09 §2 可执行版):
 * 1. 每 effect 必填约束缺任一 => 整包拒签;
 * 2. effect 枚举外 => 整包拒签(原始输入层;zod 已挡,防绕过);
 * 3. spokenForm != renderSpoken(...) => 拒签;
 * 4. protectedBranches = 缺省 ["main","master"] ∪ 项目配置(09 §11 [git].protected **取并集**——
 *    项目值只能追加保护面,不能顶掉安全默认;Codex 14 #3 回修,旧 ?? 替换语义是安全降级);
 * 5. grantDigest 与字段重算不符 => 拒签(防篡改字段留旧 digest)。
 * 另:mode=step_confirm 携带 grants => 拒(09 §2:preauthorizedEffects 仅 direct_to_review;§12-2 反例②)。
 */
export function effectiveProtectedBranches(project?: readonly string[]): readonly string[] {
  return [...new Set([...DEFAULT_PROTECTED_BRANCHES, ...(project ?? [])])];
}

export function validateGrants(
  grants: readonly EffectGrant[],
  opts: { mode: ExecutionMode; protectedBranches?: readonly string[] }
): GrantValidationResult {
  const reasons: string[] = [];
  const protectedBranches = effectiveProtectedBranches(opts.protectedBranches);

  if (opts.mode === "step_confirm" && grants.length > 0) {
    reasons.push("step_confirm package must not carry preauthorizedEffects");
  }

  grants.forEach((g, i) => {
    const at = `grant[${i}]`;
    if (!effectKindSchema.safeParse(g.effect).success) {
      reasons.push(`${at}: effect not in whitelist: ${String(g.effect)}`);
      return; // 枚举外无从继续校验该条
    }
    if (!g.constraints.environment) {
      reasons.push(`${at}: missing required constraint environment`);
    }
    if (g.effect === "install_dependency" && (!g.constraints.packages || g.constraints.packages.length === 0)) {
      reasons.push(`${at}: install_dependency requires exact packages list`);
    }
    if (g.effect === "push_branch") {
      if (!g.constraints.branchPattern) {
        reasons.push(`${at}: push_branch requires branchPattern`);
      } else {
        const hit = protectedBranches.filter((b) => globMatch(g.constraints.branchPattern as string, b));
        if (hit.length > 0) {
          reasons.push(`${at}: branchPattern intersects protected branches: ${hit.join(",")}`);
        }
      }
    }
    // spokenForm 重渲染校验(renderSpoken 抛错也计入拒签原因)
    try {
      const expected = renderSpoken(g.effect, g.constraints, g.downstreamTriggers);
      if (g.spokenForm !== expected) {
        reasons.push(`${at}: spokenForm differs from renderSpoken output`);
      }
    } catch (err) {
      reasons.push(`${at}: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (g.grantDigest !== computeGrantDigest(g)) {
      reasons.push(`${at}: grantDigest mismatch (recomputed)`);
    }
  });

  return { ok: reasons.length === 0, reasons };
}

export interface Gate0State {
  enabled: boolean;
  bypass: boolean;
}

/** Gate 0 关闭判定:显式配置,代码无 bypass 分支(bypass=true 一律视为未关,防误配) */
export function gate0Closed(g: Gate0State): boolean {
  return g.enabled === true && g.bypass === false;
}

export interface DispatchCheckInput {
  pkg: DecisionPackage;
  requested: {
    packageId: string;
    revision: number;
    digest: string;
    mode: ExecutionMode;
    route: TaskRoute;
  };
  gate0: Gate0State;
  /** E2 当前策略版本(effectPolicyVersion 变 => 旧包拒 dispatch,§12-1) */
  currentEffectPolicyVersion: string;
  protectedBranches?: readonly string[];
  /** 必填(评审 A2:可选即 fail-open——漏传则过期检查被静默跳过) */
  now: string;
}

export type DispatchCheck = { ok: true } | { ok: false; code: string; reasons: string[] };

/**
 * dispatch 前 fail-closed 校验(接入 0.2b 校验器;0.3 DDL CHECK 是第二层,不重建第三层):
 * - Gate 0 未关 => 拒(§12-2 ⑩;无 bypass 分支);
 * - route=hopper 且 grants 非空 => 拒(§12-2 ①,09 §2 路径二红线);
 * - revision/digest 漂移 => 拒(§12-2 ⑨);
 * - effectPolicyVersion 与当前不符 => 拒(需重签,§12-1);
 * - 包状态非 approved / 已过期 => 拒;
 * - mode 与包签署的 mode 不符 => 拒(模式随包签署,04 §5.4);
 * - 包 digest 重算不符 / grants 校验不过 => 拒。
 */
export function validateDispatch(i: DispatchCheckInput): DispatchCheck {
  const reasons: string[] = [];

  if (!gate0Closed(i.gate0)) {
    return { ok: false, code: "gate0_open", reasons: ["Gate 0 not closed: dispatch refused (no bypass path exists)"] };
  }

  if (i.requested.route === "hopper" && i.pkg.preauthorizedEffects.length > 0) {
    reasons.push("route=hopper dispatch must carry empty preauthorizedEffects (P0 no execution-point re-verify)");
  }
  if (i.requested.packageId !== i.pkg.id || i.requested.revision !== i.pkg.revision) {
    reasons.push(`package revision drift: requested ${i.requested.revision}, current ${i.pkg.revision}`);
  }
  if (i.requested.digest !== i.pkg.digest) {
    reasons.push("package digest drift: requested digest differs from current package");
  }
  if (i.pkg.effectPolicyVersion !== i.currentEffectPolicyVersion) {
    reasons.push(
      `effectPolicyVersion changed (package=${i.pkg.effectPolicyVersion}, current=${i.currentEffectPolicyVersion}): re-sign required`
    );
  }
  if (i.pkg.status !== "approved") {
    reasons.push(`package status must be approved, got ${i.pkg.status}`);
  }
  // 时间比较必须解析后比(评审 A2:混合时区形态下字典序与时间序相反);解析失败按 fail-closed 拒。
  // A6:expiresAt 可选(draft 无);approved 包必有(propose 转移写入),缺失 ⇒ fail-closed 拒。
  const nowMs = Date.parse(i.now);
  const expMs = i.pkg.expiresAt !== undefined ? Date.parse(i.pkg.expiresAt) : NaN;
  if (Number.isNaN(nowMs) || Number.isNaN(expMs)) {
    reasons.push("unparseable or missing expiry timestamp (fail-closed)");
  } else if (nowMs > expMs) {
    reasons.push("package expired");
  }
  if (i.requested.mode !== i.pkg.mode) {
    reasons.push(`mode mismatch: package signed mode=${i.pkg.mode}, requested ${i.requested.mode}`);
  }
  const digestErr = verifyPackageDigest(i.pkg);
  if (digestErr) reasons.push(digestErr);

  const grants = validateGrants(i.pkg.preauthorizedEffects, {
    mode: i.pkg.mode,
    ...(i.protectedBranches ? { protectedBranches: i.protectedBranches } : {})
  });
  if (!grants.ok) reasons.push(...grants.reasons);

  return reasons.length === 0 ? { ok: true } : { ok: false, code: "dispatch_rejected", reasons };
}
