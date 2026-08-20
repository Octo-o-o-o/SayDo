// P0.5-C 直达验收档运行时链(04 §5.4;09 §2/§3):
// - grant 匹配(effect+约束+ttl 复验;⑦ lifecycle scripts 不在授权面/⑧ ttl 过期命中拒);
// - preauthorized 子收据(runtime_effect,decided_via=preauthorized,绑父包 digest,单次消费);
// - 拦截计数:同一意图被拦 >=2 次才叫(approval_request 回叫,10 #22——不叫第一次,防打扰);
// - 念清单话术(10 #12):逐条 spokenForm;>3 项转屏。

import { randomBytes } from "node:crypto";
import { newId, type EffectGrant } from "@saydo/contracts";
import type { Db } from "../storage/db.js";
import type { AuditSink } from "../obs/audit.js";

export interface RuntimeEffectRequest {
  effect: string;
  target: string;
  /** install_dependency:请求安装的包名 */
  packages?: string[];
  /** push_branch:目标分支 */
  branch?: string;
  environment: "worktree" | "local";
  /** install 请求带 lifecycle scripts(postinstall 等)——授权面外(§12-2 ⑦) */
  lifecycleScripts?: boolean;
}

export type GrantMatch = { hit: true; grant: EffectGrant } | { hit: false; reason: string };

function globMatch(pattern: string, name: string): boolean {
  const regex = new RegExp("^" + pattern.split("*").map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$");
  return regex.test(name);
}

/**
 * 运行时 grant 匹配(fail-closed:任何不满足 => miss,不放宽):
 * - effect/environment 同值;install 请求包集 ⊆ 授权包集;branch 命中 branchPattern;
 * - ⑦ lifecycleScripts=true 一律 miss(setup 缺省 --ignore-scripts,确需走 S2 单次收据,05 §4-G4);
 * - ⑧ ttl 复验:grant 签发时刻 + ttlHours 已过 => miss(执行点复验,不吃签发时快照)。
 */
export function matchGrant(
  grants: readonly EffectGrant[],
  req: RuntimeEffectRequest,
  grantIssuedAt: string,
  nowIso: string
): GrantMatch {
  if (req.lifecycleScripts) return { hit: false, reason: "lifecycle scripts 不在预授权面(走 S2 单次收据)" };
  let expiredHit = false;
  for (const g of grants) {
    if (g.effect !== req.effect) continue;
    if (g.constraints.environment !== req.environment) continue;
    if (g.effect === "install_dependency") {
      const allowed = new Set(g.constraints.packages ?? []);
      if (!req.packages || req.packages.length === 0) continue;
      if (!req.packages.every((p) => allowed.has(p))) continue;
    }
    if (g.effect === "push_branch") {
      if (!req.branch || !g.constraints.branchPattern) continue;
      if (!globMatch(g.constraints.branchPattern, req.branch)) continue;
    }
    // ⑧ ttl 执行点复验(评审 B2:过期项 continue 不遮蔽后续有效 grant——同 effect 多条 ttl 不同时误拒)
    const expMs = Date.parse(grantIssuedAt) + g.ttlHours * 3_600_000;
    if (Date.parse(nowIso) > expMs) {
      expiredHit = true;
      continue;
    }
    return { hit: true, grant: g };
  }
  if (expiredHit) return { hit: false, reason: "命中的 grant 已过期(ttl 执行点复验)" };
  return { hit: false, reason: "无匹配 grant(效果/约束不在预授权面)" };
}

/** preauthorized 子收据(09 §3:kind=runtime_effect,必绑父包 digest;签发即消费——每命令独立,单次)。
 *  auth_strength 继承父收据——**事务内查库取值,不接受调用者传入**(Codex 14 #1 回修:旧签名的
 *  parentAuthStrength 参数可被伪造成更强认证;现无父 dispatch 收据即 fail-closed 拒签发)。 */
export function issuePreauthorizedReceipt(
  db: Db,
  audit: AuditSink,
  i: {
    grant: EffectGrant;
    parentPackageDigest: string;
    taskId: string;
    effectText: string;
  },
  nowIso: string
): string {
  const parent = db
    .prepare(
      `SELECT auth_strength FROM approvals
       WHERE kind='dispatch_package' AND ref_digest=? AND outcome='consumed'
       ORDER BY decided_at DESC LIMIT 1`
    )
    .get(i.parentPackageDigest) as { auth_strength: string } | undefined;
  if (!parent) {
    throw new Error(`preauthorized receipt requires consumed parent dispatch receipt for ${i.parentPackageDigest} (fail-closed)`);
  }
  const id = newId("apr");
  db.prepare(
    `INSERT INTO approvals(id, kind, ref_digest, parent_package_digest, effect, grant_digest, task_id, risk, decided_via,
       auth_strength, nonce, outcome, issued_at, expires_at, decided_at, consumed_at)
     VALUES (?, 'runtime_effect', ?, ?, ?, ?, ?, 'S2', 'preauthorized', ?, ?, 'consumed', ?, ?, ?, ?)`
  ).run(
    id,
    i.grant.grantDigest,
    i.parentPackageDigest,
    i.effectText,
    i.grant.grantDigest,
    i.taskId,
    parent.auth_strength, // 继承父收据实测值(不高估不低估)
    randomBytes(12).toString("base64url"),
    nowIso,
    nowIso, // 单次即耗:expires=issued(不留可复用窗口)
    nowIso,
    nowIso
  );
  audit.record({
    actor: "daemon",
    action: "approval.preauthorized_consume",
    meta: { receiptId: id, taskId: i.taskId, grantDigest: i.grant.grantDigest, effect: i.effectText }
  });
  return id;
}

/** 拦截计数器(04 §5.4:同一意图被拦 >=2 次才触发 approval_request 回叫;意图键=effect+target 归一) */
export class InterceptCounter {
  private readonly counts = new Map<string, number>();

  intentKey(req: RuntimeEffectRequest): string {
    return `${req.effect}|${req.target}|${(req.packages ?? []).slice().sort().join(",")}|${req.branch ?? ""}`;
  }

  /** 记一次拦截;返回是否达到叫人阈值(>=2) */
  recordIntercept(req: RuntimeEffectRequest): { count: number; shouldCallback: boolean } {
    const key = this.intentKey(req);
    const n = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, n);
    return { count: n, shouldCallback: n >= 2 };
  }

  reset(req: RuntimeEffectRequest): void {
    this.counts.delete(this.intentKey(req));
  }
}

/** 念清单话术(10 #12):逐条 spokenForm;>3 项转屏(口播纪律) */
export function renderGrantChecklist(grants: readonly EffectGrant[]): { spoken: string; toScreen: boolean } {
  if (grants.length === 0) return { spoken: "这单没有要出圈的事,直接跑到等你验收。", toScreen: false };
  if (grants.length > 3) {
    return { spoken: "清单有点长,放屏幕上了,你扫一眼再确认。", toScreen: true };
  }
  const items = grants.map((g) => g.spokenForm).join(";");
  return { spoken: `选一口气跑完的话,这几件出圈的事先跟你确认:${items}。都可以吗?哪件不行单说哪件。`, toScreen: false };
}
