// 批 4:会话内「这次聊出来的东西」实体卡发射辅助。
// 只在账本写入成功后调用;发射失败 try/catch 吞掉,绝不反转主链。
// kind 直接人话字符串(前端零映射);color=球权色(orange/blue/green/gray)或 'act'。

import { ulid } from "ulid";

/** 合同/设计 v1 §2/§6:办成事才长卡的七类 kind(人话,前端零映射) */
export type FocusEntityKind =
  | "记下一件事"
  | "办结"
  | "接上"
  | "派活"
  | "收尾"
  | "方向更新"
  | "拆出线";

/** 球权四色 + 通用 act(橙系动作卡,无明确球权时用) */
export type FocusEntityColor = "orange" | "blue" | "green" | "gray" | "act";

export interface FocusEntityBody {
  id: string;
  kind: FocusEntityKind;
  title: string;
  sub: string;
  color: FocusEntityColor;
  at: string;
}

export interface FocusEntityInput {
  kind: FocusEntityKind;
  title: string;
  sub: string;
  color: FocusEntityColor;
  /** 缺省 = 新 ULID 实体 id */
  id?: string;
  at?: string;
}

export type FocusEntityEmitter = (sessionId: string, entity: FocusEntityBody) => void;

/** 义务 owner → 球权色(绿 AI / 蓝你启动 / 灰外部;拍板类用 orange 由调用方传 needs) */
export function colorForOwner(owner: "human" | "agent" | "external", needs?: string | null): FocusEntityColor {
  if (owner === "agent") return "green";
  if (owner === "external") return "gray";
  if (needs === "decision" || needs === "input") return "orange";
  return "blue";
}

export function ownerSub(owner: "human" | "agent" | "external", extra?: string): string {
  const base = owner === "agent" ? "AI 来办" : owner === "external" ? "等外部" : "你来做";
  return extra ? `${base} · ${extra}` : base;
}

export function resolutionSub(resolution: string): string {
  if (resolution === "done") return "办结 · 完成";
  if (resolution === "abandoned") return "办结 · 放弃";
  if (resolution === "no_longer_applicable") return "办结 · 不再需要";
  if (resolution === "superseded") return "办结 · 已替代";
  return `办结 · ${resolution}`;
}

export function buildFocusEntity(input: FocusEntityInput): FocusEntityBody {
  return {
    // 会话内瞬态 id(不进账本);ent_ 前缀不进 contracts Id 词表
    id: input.id ?? `ent_${ulid()}`,
    kind: input.kind,
    title: input.title,
    sub: input.sub,
    color: input.color,
    at: input.at ?? new Date().toISOString()
  };
}

/**
 * 安全发射:构造 entity + 调 emitter;任何异常 log.warn 后吞掉。
 * emitter 缺省(未接线)时 no-op。
 */
export function emitFocusEntitySafe(
  emitter: FocusEntityEmitter | null | undefined,
  log: { warn: (message: string, fields?: Record<string, unknown>) => void } | null | undefined,
  sessionId: string,
  input: FocusEntityInput
): void {
  if (!emitter || !sessionId) return;
  try {
    emitter(sessionId, buildFocusEntity(input));
  } catch (err) {
    try {
      log?.warn("focus.entity emit failed", {
        sessionId,
        kind: input.kind,
        error: String(err instanceof Error ? err.message : err).slice(0, 120)
      });
    } catch {
      // 诊断出口不得反转
    }
  }
}
