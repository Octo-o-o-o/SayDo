import type { Adapter } from "@saydo/contracts";
import type { GatePaths } from "../gateScript.js";

/** 已实现后端的有意子集(contracts adapterSchema 词表单源,09 §6.1;readback B-1 清偿:契约不分叉) */
export type AdapterKind = Extract<Adapter, "cursor" | "claude_code">;

export type Tier1Event =
  | {
      kind: "init";
      session_id?: string;
      model?: string;
      tools?: string[];
      permissionMode?: string;
      apiKeySource?: string;
      claudeCodeVersion?: string;
    }
  | { kind: "observed_model"; observedModel: string }
  | { kind: "tool_started"; tool: string; toolUseId?: string }
  | { kind: "tool_result"; toolUseId?: string; isError?: boolean }
  | { kind: "rate_limit"; status?: string; resetsAt?: number; rateLimitType?: string }
  | {
      kind: "result";
      session_id?: string;
      subtype?: string;
      isError?: boolean;
      numTurns?: number;
      /** claude result 的 total_cost_usd(订阅态是估值;09 §9 meta 必填 total_cost_usd_estimate) */
      totalCostUsd?: number;
      usage?: unknown;
      modelUsage?: unknown;
      permissionDenials?: unknown;
      stopReason?: string;
      terminalReason?: string;
      text?: string;
    }
  | { kind: "ignore" }
  | { kind: "unknown" };

export interface Tier1BuildArgvInput {
  model: string;
  prompt: string;
  resumeKey?: string;
  sessionId?: string;
  settingsJson?: string;
  maxTurns?: number;
}

export interface Tier1Backend {
  readonly adapter: AdapterKind;
  buildArgv(i: Tier1BuildArgvInput): string[];
  provisionHooks(
    cwd: string,
    gate: GatePaths,
    hookTimeoutSec?: number
  ): { extraArgs: string[]; filesWritten: string[] };
  parseLine(line: string): readonly Tier1Event[];
  isTerminalResult(line: string): boolean;
  finishPolicy: "kill_on_result" | "wait_exit_then_kill";
  canaryLeft: "shell_started" | "tool_result";
  explainFailure(
    exit: number | null | undefined,
    stderrTail: string,
    lines?: readonly string[]
  ): { code: string; message: string };
}
