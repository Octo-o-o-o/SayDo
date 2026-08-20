// P0.5-B 启动 capabilities 握手断言(09 §11 [hopper]):bridge 第一调用 hopper capabilities --json,
// 断言 commit == 锁定点 + 能力分级;断言失败 fail-closed 拒 dispatch(不带病对接)。
// settle_event=='runtime' ⇒ 启用 RunSettled 主判据(§6.3 路径二);否则回 baseline.1 过渡兜底合同。

import { z } from "zod";

export const hopperCapabilitiesSchema = z.looseObject({
  schema_version: z.string(),
  package_version: z.string(),
  commit: z.string().min(7),
  event_types: z.array(z.string()),
  task_statuses: z.array(z.string()),
  mutation_commands: z.array(z.string()),
  vault: z.looseObject({ root: z.string(), vault_id: z.string() }),
  capabilities: z.record(z.string(), z.enum(["runtime", "schema_only", "none"]))
});
export type HopperCapabilities = z.infer<typeof hopperCapabilitiesSchema>;

export interface HandshakeExpectation {
  expectedCommit: string;
  /** RunSettled 主判据所需 */
  requireSettleEvent?: boolean;
}

export type CapLevel = "runtime" | "schema_only" | "none";

export type HandshakeResult =
  | { ok: true; caps: HopperCapabilities; settleEventEnabled: boolean; casEnabled: boolean; steerLevel: CapLevel }
  | { ok: false; reason: string };

/** 握手断言(纯函数;调用方喂 capabilities --json 输出) */
export function assertHandshake(rawJson: string, exp: HandshakeExpectation): HandshakeResult {
  let caps: HopperCapabilities;
  try {
    caps = hopperCapabilitiesSchema.parse(JSON.parse(rawJson));
  } catch (err) {
    return { ok: false, reason: `capabilities 输出不可解析(fail-closed): ${String(err).slice(0, 120)}` };
  }
  if (caps.commit !== exp.expectedCommit) {
    return { ok: false, reason: `锁定点漂移:期望 ${exp.expectedCommit.slice(0, 12)},实际 ${caps.commit.slice(0, 12)}——升级须重跑门禁仪式` };
  }
  const settleEventEnabled = caps.capabilities["settle_event"] === "runtime";
  if (exp.requireSettleEvent && !settleEventEnabled) {
    return { ok: false, reason: "settle_event 能力非 runtime,RunSettled 主判据不可用(切 baseline.1 兜底合同或上浮)" };
  }
  // 关键枚举存在性(total mapping 的前提):14 值 task_statuses 必须全在
  const need = ["received", "ready", "draft", "plan_needed", "research", "deferred", "conflict", "blocked", "running", "review", "done", "failed", "rejected", "archived"];
  const missing = need.filter((s) => !caps.task_statuses.includes(s));
  if (missing.length > 0) {
    return { ok: false, reason: `task_statuses 缺 ${missing.join(",")}(total mapping 前提破)` };
  }
  if (!caps.event_types.includes("RunSettled")) {
    return { ok: false, reason: "event_types 缺 RunSettled" };
  }
  return {
    ok: true,
    caps,
    settleEventEnabled,
    casEnabled: caps.capabilities["mutation_expects_cas"] === "runtime",
    // W5a 3.4:steer 能力分级消费(baseline.2 实测 = none;能力升级时握手自动带出新值)
    steerLevel: (caps.capabilities["steer"] as CapLevel | undefined) ?? "none"
  };
}

/**
 * Hopper steer 分级消费裁决(W5a 3.4;03 §5"能力按运行时探测,不按型号假设")。
 * 现实(baseline.2 锁定二进制):steer=none,mutation_commands 无 steer 命令——route=hopper 的
 * steerTask 必须诚实拒绝,不得静默落 task_messages(桥不消费该表,排队即谎报)。
 * 能力出现(runtime)时:握手自动带出新值,本函数自动改判可 steer——但锁定二进制升级本身
 * 须走"重跑门禁仪式"(HANDOFF §4)+ 桥消费升级评估(PLAN-2 W8 挂起轨:每次握手能力变化做
 * 一次消费评估;steer 的出站 op/CLI 形状属 canonical §6.2 面,不在本批杜撰)。
 */
export function hopperSteerSupport(level: CapLevel): { steerable: boolean; phrase: string } {
  if (level === "runtime") {
    return {
      steerable: true,
      phrase: "Hopper 已支持运行中改需求(能力升级已到);桥消费面按升级批接线"
    };
  }
  return {
    steerable: false,
    phrase: "这个任务走的 Hopper 后端不支持运行中改需求——要改就取消这轮重新派,或等它跑完在验收时提修改"
  };
}
