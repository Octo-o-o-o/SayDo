// BYOA 事件消费核心(纯逻辑,可充分单测):把解析后的事件流收敛为结果或作废。
// fail-closed 律(09 §11 规则 2/4,复评 A3):
//  - tripwire:出现任一 tool_call 事件 => 作废 + 审计(笼破信号);
//  - 未知事件 / 解析失败 => 作废(cursor 尤其);
//  - observedModel:familyOf 不符或缺失 => 作废;familyFixed 也须经绝对路径+digest 登记才可豁免。

import { jcsDigest } from "@saydo/contracts";
import { sameFamilyCliDowngradeNote } from "../../config/family.js";
import type { ParsedEvent } from "./parsers.js";

export type VoidReason =
  | "tripwire"
  | "parse_error"
  | "unknown_event"
  | "cli_error"
  | "family_mismatch"
  | "observed_model_missing"
  | "incomplete_stream";

export interface ConsumeResult {
  ok: boolean;
  voidReason?: VoidReason;
  text: string;
  requestedModel?: string;
  observedModel?: string;
  observedModelSource: "stream" | "verified_binary_default" | "unknown";
  observedModelExempted: boolean;
  toolCallCount: number;
  /** tripwire 前是否已经出现可消费正文/终态正文；只用于“零消费”安全重试判定。 */
  hadConsumableOutput: boolean;
  /** 引证 digest:对拼接文本算(invocation 记录用) */
  evidenceDigest: string;
  /** requested≠observed 且同族时的人话说明(CLI 自动降级,通常订阅限流) */
  note?: string;
  /** kind=error 的人话;终态失败直透,不走 unknown 重试 */
  errorMessage?: string;
}

export interface ConsumeOptions {
  expectedFamily: string;
  familyOf: (model: string) => string | null;
  requestedModel?: string;
  /** 是否要求 observedModel(cursor_cli/api:严格,缺失即作废) */
  requireObservedModel?: boolean;
  /**
   * 恒定族 provider 封闭枚举标记;单独设置不产生豁免。
   */
  familyFixed?: boolean;
  /** 调用前已按绝对路径+SHA-256 登记复核;familyFixed 豁免的必要条件。 */
  verifiedBinaryDefault?: boolean;
  /** 登记中若有明确默认模型则同时回填;没有时只证明固定家族,不编造模型名。 */
  verifiedBinaryDefaultModel?: string;
  /** 一发一收必须见到供应商成功终态，防 exit=0 的截断流被误收。 */
  requireTerminalResult?: boolean;
}

export function consumeByoaEvents(events: ParsedEvent[], opts: ConsumeOptions): ConsumeResult {
  let text = "";
  let resultText: string | undefined;
  let observedModel: string | undefined;
  let observedModelSource: ConsumeResult["observedModelSource"] = "unknown";
  let observedModelExempted = false;
  let toolCallCount = 0;
  let hadConsumableOutput = false;
  let sawResult = false;
  let voidReason: VoidReason | undefined;
  let errorMessage: string | undefined;

  for (const ev of events) {
    if (ev.observedModel) {
      observedModel = ev.observedModel;
      observedModelSource = "stream";
      const observedFamily = opts.familyOf(ev.observedModel);
      if (opts.expectedFamily !== "unknown" && observedFamily !== opts.expectedFamily) {
        voidReason ??= "family_mismatch";
      }
    }
    switch (ev.kind) {
      case "tool_call":
        if (ev.text) hadConsumableOutput ||= ev.text.trim() !== "";
        toolCallCount++;
        voidReason ??= "tripwire"; // 记录首个作废原因,但继续计数以供审计
        break;
      case "parse_error":
        voidReason ??= "parse_error";
        break;
      case "unknown":
        voidReason ??= "unknown_event";
        break;
      case "observed_model":
        if (ev.text) {
          text += ev.text;
          hadConsumableOutput ||= ev.text.trim() !== "";
        }
        break;
      case "text":
        if (ev.text) {
          text += ev.text;
          hadConsumableOutput ||= ev.text.trim() !== "";
        }
        break;
      case "result":
        sawResult = true;
        if (ev.text !== undefined) {
          resultText = ev.text;
          hadConsumableOutput ||= ev.text.trim() !== "";
        }
        break;
      case "error":
        sawResult = true;
        voidReason ??= "cli_error";
        if (ev.text?.trim()) errorMessage ??= ev.text.trim();
        break;
      case "ignore":
        break;
      default:
        // 穷尽性 fail-closed(评审 B5:未来新增 kind 不得静默当 ok)
        voidReason ??= "unknown_event";
    }
  }

  if (!voidReason && opts.requireTerminalResult === true && !sawResult) {
    voidReason = "incomplete_stream";
  }

  // observedModel 缺失判定:familyFixed 只有登记身份复核通过后才可用二进制默认值。
  if (!voidReason && !observedModel) {
    if (opts.familyFixed && opts.verifiedBinaryDefault) {
      observedModel = opts.verifiedBinaryDefaultModel;
      observedModelSource = "verified_binary_default";
      observedModelExempted = true;
      if (observedModel && opts.familyOf(observedModel) !== opts.expectedFamily) voidReason = "family_mismatch";
    } else if (opts.requireObservedModel !== false) {
      voidReason = "observed_model_missing";
    }
  }

  // 作废时清空 text(评审 B6:防下游误用笼破/未知事件的部分文本)
  const safeText = voidReason ? "" : (resultText ?? text);
  const note =
    !voidReason ? sameFamilyCliDowngradeNote(opts.requestedModel, observedModel) : undefined;
  return {
    ok: voidReason === undefined,
    ...(voidReason ? { voidReason } : {}),
    text: safeText,
    ...(opts.requestedModel ? { requestedModel: opts.requestedModel } : {}),
    ...(observedModel ? { observedModel } : {}),
    observedModelSource,
    observedModelExempted,
    toolCallCount,
    hadConsumableOutput,
    evidenceDigest: jcsDigest({ text: safeText }),
    ...(note ? { note } : {}),
    ...(errorMessage ? { errorMessage } : {})
  };
}
