import type { GatePaths } from "../gateScript.js";

export type AdapterKind = "cursor" | "claude_code";

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
      subtype?: string;
      isError?: boolean;
      numTurns?: number;
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
  provisionHooks(cwd: string, gate: GatePaths): { extraArgs: string[]; filesWritten: string[] };
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
