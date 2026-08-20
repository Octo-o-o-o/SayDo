// C1 requestClose/requestSuspend 门:收场在 session 转态前执行。
// stage 0 = 旧直转路径(本模块不介入);stage>=1 保持 talking 至 settlement 收口后再转态。

import type { Db } from "../storage/db.js";
import type { AuditSink } from "../obs/audit.js";
import { getSession } from "../storage/dao/projects.js";
import {
  getFocusStage,
  shouldEnforceFocusClose,
  shouldPresentFocusCloseChecklist,
  type FocusStage
} from "./stage.js";
import { getActiveActivationForSession } from "./activation.js";
import {
  enumerateCloseSettlement,
  presentCloseSettlement,
  autoLedgerCloseSettlement,
  commitCloseSettlement,
  renderCloseSettlementChecklist,
  type TranscriptLine
} from "./closeSettlement.js";
import { FocusWriteError } from "./writeTx.js";
import { emitFocusEntitySafe, type FocusEntityEmitter } from "./entityFeed.js";

export type CloseGateIntent = "suspend" | "close";

export interface SessionCloseGateDeps {
  db: Db;
  audit: AuditSink;
  stage: FocusStage;
  /** 读本 session 转写为收场枚举输入;store_transcript=false 时返回 [] + storeTranscript:false */
  loadTranscript: (sessionId: string) => { lines: TranscriptLine[]; storeTranscript: boolean };
  /** 收场清单话术出口(语音/测试注入);缺省 no-op */
  presentChecklist?: (sessionId: string, text: string, settlementId: string) => void;
  /** 批 4:收尾 committed 后推 console 实体卡;缺省 no-op */
  emitFocusEntity?: FocusEntityEmitter;
  now?: () => Date;
}

export type CloseGateResult =
  | { kind: "bypass_stage0" }
  | { kind: "no_active_focus" }
  | { kind: "presented"; settlementId: string; checklist: string; sessionStillTalking: true }
  | { kind: "committed"; settlementId: string; sessionState: "suspended" | "closed" }
  | { kind: "conflict"; settlementId: string; reason: string }
  | { kind: "error"; code: string; message: string };

/**
 * requestSuspend:空闲超时/用户挂起入口。
 * - stage 0 或无 active activation → 调用方走旧直转
 * - stage 1 → 枚举+present 留痕后允许调用方转 suspended(零语义挂账)
 * - stage 2(强制)或 idle auto 路径 → auto_ledgered → commit(事务内 session 终态)
 */
export function requestSuspend(deps: SessionCloseGateDeps, sessionId: string, opts?: { idleTimeout?: boolean }): CloseGateResult {
  return guardedCloseGate(deps, sessionId, "suspend", opts?.idleTimeout === true);
}

/** requestClose:用户显式关闭会话;stage 2 强制收场 commit → closed */
export function requestClose(deps: SessionCloseGateDeps, sessionId: string): CloseGateResult {
  return guardedCloseGate(deps, sessionId, "close", false);
}

// 收场门的任何意外异常(如坏行 schema 解析失败)只能降级放行,绝不允许逃逸杀死 daemon
// (E2 dogfood 实测:非法 fixture ID 经 zod 抛错沿空闲定时器路径击穿进程——2026-08-04)
function guardedCloseGate(
  deps: SessionCloseGateDeps,
  sessionId: string,
  intent: CloseGateIntent,
  idleTimeout: boolean
): CloseGateResult {
  try {
    return runCloseGate(deps, sessionId, intent, idleTimeout);
  } catch (err) {
    return { kind: "error", code: "close_gate_internal", message: String(err instanceof Error ? err.message : err) };
  }
}

function runCloseGate(
  deps: SessionCloseGateDeps,
  sessionId: string,
  intent: CloseGateIntent,
  idleTimeout: boolean
): CloseGateResult {
  const stage = deps.stage;
  if (stage === 0 || !shouldPresentFocusCloseChecklist(stage)) {
    return { kind: "bypass_stage0" };
  }

  const session = getSession(deps.db, sessionId);
  if (!session || session.state !== "talking") {
    return { kind: "error", code: "session_not_talking", message: `session state=${session?.state ?? "missing"}` };
  }

  const activation = getActiveActivationForSession(deps.db, sessionId);
  if (!activation) {
    return { kind: "no_active_focus" };
  }

  const { lines, storeTranscript } = deps.loadTranscript(sessionId);
  try {
    const enumerated = enumerateCloseSettlement(deps.db, {
      sessionId,
      focusId: activation.focusId,
      activationId: activation.id,
      transcriptLines: lines,
      storeTranscript
    });

    const mustAutoCommitForRender = shouldEnforceFocusClose(stage);
    const checklist = renderCloseSettlementChecklist(enumerated.candidates, {
      degradedNoTranscript: enumerated.degradedNoTranscript,
      mode: mustAutoCommitForRender ? "auto" : "ask"
    });
    const presentationId = `focus-close-${enumerated.settlement.id}`;
    presentCloseSettlement(deps.db, enumerated.settlement.id, presentationId);
    deps.presentChecklist?.(sessionId, checklist, enumerated.settlement.id);

    deps.audit.record({
      actor: "daemon",
      action: "focus.close_gate.presented",
      meta: {
        sessionId,
        settlementId: enumerated.settlement.id,
        intent,
        idleTimeout,
        stage,
        candidateCount: enumerated.candidates.length
      }
    });

    // stage 1:纯建议——presented 即操作留痕,调用方随后转 session(零语义挂账;含空闲超时)
    // stage 2:强制收场——auto_ledger → commit(事务内转态);空闲超时同径
    const mustAutoCommit = shouldEnforceFocusClose(stage);
    if (!mustAutoCommit) {
      return {
        kind: "presented",
        settlementId: enumerated.settlement.id,
        checklist,
        sessionStillTalking: true
      };
    }

    autoLedgerCloseSettlement(deps.db, enumerated.settlement.id);
    const terminal: "suspended" | "closed" = intent === "close" ? "closed" : "suspended";
    const committed = commitCloseSettlement(deps.db, enumerated.settlement.id, {
      sessionTerminalState: terminal
    });
    if (!committed.ok) {
      deps.audit.record({
        actor: "daemon",
        action: "focus.close_gate.conflict",
        meta: { sessionId, settlementId: enumerated.settlement.id, reason: committed.reason }
      });
      return { kind: "conflict", settlementId: enumerated.settlement.id, reason: committed.reason };
    }
    deps.audit.record({
      actor: "daemon",
      action: "focus.close_gate.committed",
      meta: { sessionId, settlementId: enumerated.settlement.id, terminal }
    });
    // 批 4:收尾写入成功后长卡(确认完成本身不长卡;本处是 settlement committed 收口)
    {
      const focusRow = deps.db
        .prepare("SELECT title FROM focuses WHERE id = ?")
        .get(activation.focusId) as { title: string } | undefined;
      emitFocusEntitySafe(deps.emitFocusEntity, null, sessionId, {
        kind: "收尾",
        title: focusRow?.title ?? "本场会话",
        sub: terminal === "closed" ? "收尾落账 · 会话已关闭" : "收尾落账 · 会话已挂起",
        color: "act"
      });
    }
    return { kind: "committed", settlementId: enumerated.settlement.id, sessionState: terminal };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = err instanceof FocusWriteError ? err.code : "close_gate_failed";
    deps.audit.record({
      actor: "daemon",
      action: "focus.close_gate.error",
      meta: { sessionId, code, message: message.slice(0, 200) }
    });
    return { kind: "error", code, message };
  }
}

/** 从 config 读 stage 的便捷包装 */
export function focusStageFromConfig(config: { focus?: { stage?: number } } | null | undefined): FocusStage {
  return getFocusStage(config);
}
