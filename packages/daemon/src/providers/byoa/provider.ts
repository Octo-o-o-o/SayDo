// BYOA LlmProvider:buildCageArgv → runSpawnTurn → parser → consume。
// 每次进程调用都审计;schema 文件与临时 cwd 在 finally 清理;失败、空输出、取消均 fail-closed。

import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { jcsDigest } from "@saydo/contracts";
import type { ChatRequest, ChatResult, LlmProvider } from "../types.js";
import type { AuditSink } from "../../obs/audit.js";
import {
  checkBinaryIdentity,
  sha256File,
  type BinaryIdentityCheckOptions,
  type VerifiedBinaryIdentity
} from "../binaryIdentity.js";
import { allowsVerifiedBinaryDefault, requiresIsolatedHome } from "../../config/cliProviders.js";
import { buildCageArgv, type CageProvider, type CodexReasoning } from "./cage.js";
import { isCliSubscriptionRateLimit } from "./billing.js";
import { explainByoaVoidReason, explainCliProcessFailure } from "./processFailure.js";
import {
  collectSecretEnvValues,
  safetyStopLogLine,
  withTriggerContent
} from "./safetyDiagnostics.js";
import { isolatedHomeEnv, isolatedProviderSecrets, prepareIsolatedHome } from "./isolatedHome.js";
import { parsePlaintextBlock, parseStructuredOutput, parserFor } from "./parsers.js";
import { consumeByoaEvents, type ConsumeResult } from "./consume.js";
import {
  assertByoaShutdownAllowsStopped,
  ByoaBusyError,
  defaultByoaConcurrencyLimiter,
  getByoaLifecycleContamination,
  resetByoaLifecycleForTests,
  runSpawnTurn,
  type ByoaConcurrencyLimiter,
  type SpawnAttemptResult,
  type SpawnTurnResult
} from "./runner.js";

export { assertByoaShutdownAllowsStopped, getByoaLifecycleContamination, resetByoaLifecycleForTests } from "./runner.js";

export function resetByoaProviderForTests(): void {
  byoaDraining = false;
  byoaShutdown = false;
  resetByoaLifecycleForTests();
}

// W5.4-b C1:VerifiedBinaryIdentity 与 verifyBinaryIdentity 提升为共享模块
// providers/binaryIdentity.ts(Tier1 claude 登记核验同源消费);此处 re-export 保持既有导出面。
export type { VerifiedBinaryIdentity } from "../binaryIdentity.js";

export interface ByoaProviderOptions {
  provider: CageProvider;
  model: string;
  expectedFamily: string;
  familyOf: (model: string) => string | null;
  reasoning?: CodexReasoning;
  profile: "default" | "dev";
  audit: AuditSink;
  binaryPath?: string;
  binaryIdentity?: VerifiedBinaryIdentity;
  wallTimeoutMs?: number;
  idleTimeoutMs?: number;
  outputLimitBytes?: number;
  inputLimitBytes?: number;
  killGraceMs?: number;
  networkRetryLimit?: number;
  passEnv?: Record<string, string | undefined>;
  concurrencyLimiter?: ByoaConcurrencyLimiter;
  onSubscriptionInvocation?: (invocation: {
    provider: CageProvider;
    model: string;
    requests: number;
    provenance?: "subscription" | "external_api" | "unknown";
  }) => void;
  costProvenance?: "subscription" | "external_api" | "unknown";
  /** 奠基/调研只读例外(07 D18 唯一例外)。 */
  readonlyFoundationCwd?: string;
  /** 槽位名(dialog/thinking/cheap/evaluator);诊断日志用。 */
  slot?: string;
  /** 可选 warn 日志;缺省不写盘,由 resolver/setup 注入 daemon logger。 */
  log?: { warn(message: string, fields?: Record<string, unknown>): void };
  /** 测试注入哈希实现,断言 spawn 前身份核验每次真算。生产不传。 */
  hashFile?: BinaryIdentityCheckOptions["hashFile"];
}

export const DEFAULT_INPUT_LIMIT_BYTES = 256 * 1024;
export const BYOA_NO_TOOL_PROMPT_HEADER = "不要执行任何命令/不要读文件,仅基于给定内容直接输出 JSON";
const BYOA_REINFORCED_NO_TOOL_PROMPT_HEADER =
  `${BYOA_NO_TOOL_PROMPT_HEADER}\n再次强调:不要调用任何工具;检测到命令或工具事件时本次结果会立即作废。`;

function promptBytes(messages: ChatRequest["messages"]): number {
  return Buffer.byteLength(messages.map((message) => `[${message.role}]\n${message.content}`).join("\n\n"));
}

function truncateUtf8(text: string, maxBytes: number): string {
  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (Buffer.byteLength(text.slice(0, mid)) <= maxBytes) low = mid;
    else high = mid - 1;
  }
  const end = low > 0 && /[\uD800-\uDBFF]/.test(text[low - 1]!) ? low - 1 : low;
  return text.slice(0, end);
}

/** B4:历史最先丢，随后只截 Context Pack；instructions 与当前请求仍超限则如实拒绝。 */
export function buildBoundedPrompt(messages: ChatRequest["messages"], limitBytes: number): string | null {
  if (limitBytes <= 0 || messages.length === 0) return null;
  const working = messages.map((message) => ({ ...message }));
  const preserveLeadingSystem = working[0]?.role === "system";
  const minimumMessages = preserveLeadingSystem ? 2 : 1;
  while (promptBytes(working) > limitBytes && working.length > minimumMessages) {
    working.splice(preserveLeadingSystem ? 1 : 0, 1);
  }

  if (promptBytes(working) > limitBytes && working[0]?.role === "system") {
    const marker = "\n\n[Context Pack]\n";
    const split = working[0].content.indexOf(marker);
    if (split >= 0) {
      const instructions = working[0].content.slice(0, split);
      const pack = working[0].content.slice(split + marker.length);
      working[0] = { ...working[0], content: `${instructions}${marker}` };
      const available = limitBytes - promptBytes(working);
      if (available > 0) working[0] = { ...working[0], content: `${instructions}${marker}${truncateUtf8(pack, available)}` };
    }
  }
  if (promptBytes(working) > limitBytes) return null;
  return working.map((message) => `[${message.role}]\n${message.content}`).join("\n\n");
}

function cursorSchemaPrompt(prompt: string, schema: Record<string, unknown>, retry: boolean): string {
  const prefix = retry
    ? "上一轮输出未通过结构化校验。重新回答一次;不得解释、不得使用 Markdown。"
    : "输出必须严格匹配下列 JSON Schema;只输出一个 JSON 值,不得使用 Markdown 或附加文字。";
  return `${prompt}\n\n[structured-output]\n${prefix}\n${JSON.stringify(schema)}`;
}

function isolatedPrompt(prompt: string, reinforced = false): string {
  return `${reinforced ? BYOA_REINFORCED_NO_TOOL_PROMPT_HEADER : BYOA_NO_TOOL_PROMPT_HEADER}\n\n${prompt}`;
}

function failure(code: string, message: string, retryable = false): ChatResult {
  return { ok: false, code, message, retryable };
}

interface InvocationResult {
  turn: SpawnTurnResult;
  consumed: ConsumeResult;
}

const activeByoaControllers = new Set<AbortController>();
const activeByoaSettlements = new Set<Promise<void>>();
let byoaDraining = false;
let byoaShutdown = false;

export function activeByoaInvocationCount(): number {
  return activeByoaControllers.size;
}

export async function abortAllByoaInvocations(options: { permanent?: boolean } = {}): Promise<{ aborted: number }> {
  byoaDraining = true;
  if (options.permanent === true) byoaShutdown = true;
  const aborted = activeByoaControllers.size;
  try {
    while (activeByoaSettlements.size > 0) {
      const settlements = [...activeByoaSettlements];
      for (const controller of activeByoaControllers) controller.abort();
      await Promise.allSettled(settlements);
    }
  } finally {
    if (!byoaShutdown) byoaDraining = false;
  }
  assertByoaShutdownAllowsStopped();
  return { aborted };
}

export function createByoaProvider(opts: ByoaProviderOptions): LlmProvider {
  const kind = opts.provider;
  const limiter = opts.concurrencyLimiter ?? defaultByoaConcurrencyLimiter;
  return {
    kind,
    model: opts.model,
    async chat(req, signal): Promise<ChatResult> {
      if (getByoaLifecycleContamination()) {
        return failure("process_group_not_reaped", "CLI 进程组未能在时限内收口", false);
      }
      if (byoaDraining || byoaShutdown) return failure("cancelled", "CLI 调用已取消", false);
      let markSettled!: () => void;
      const settlement = new Promise<void>((resolve) => {
        markSettled = resolve;
      });
      const invocationController = new AbortController();
      const onCallerAbort = (): void => invocationController.abort();
      signal?.addEventListener("abort", onCallerAbort, { once: true });
      if (signal?.aborted) invocationController.abort();
      activeByoaControllers.add(invocationController);
      activeByoaSettlements.add(settlement);
      const cleanupController = (): void => {
        signal?.removeEventListener("abort", onCallerAbort);
        activeByoaControllers.delete(invocationController);
        activeByoaSettlements.delete(settlement);
        markSettled();
      };
      let release: (() => void) | undefined;
      try {
        release = await limiter.acquire(opts.provider, invocationController.signal);
      } catch (err) {
        cleanupController();
        if (err instanceof ByoaBusyError) return failure("busy", "CLI 调用队列已满,请稍后再试", true);
        return failure("cancelled", "CLI 调用已取消", false);
      }

      const ownsCwd = opts.readonlyFoundationCwd === undefined;
      let cwd: string | undefined;
      let schemaDir: string | undefined;
      let isolatedHomeDir: string | undefined;
      try {
        cwd = opts.readonlyFoundationCwd ?? mkdtempSync(join(tmpdir(), "saydo-byoa-"));
        const activeCwd = cwd;
        schemaDir =
          req.jsonSchema || opts.provider === "grok_cli"
            ? mkdtempSync(join(tmpdir(), "saydo-byoa-schema-"))
            : undefined;
        const schemaFile =
          schemaDir && req.jsonSchema && opts.provider === "codex_cli"
            ? join(schemaDir, "output-schema.json")
            : undefined;
        const grokPromptFile = schemaDir && opts.provider === "grok_cli" ? join(schemaDir, "prompt.txt") : undefined;
        const isolated =
          requiresIsolatedHome(opts.provider) && cwd ? prepareIsolatedHome(opts.provider) : undefined;
        isolatedHomeDir = isolated?.home;
        // 身份门下沉到每次 spawn 前(L-1):chat 开头只验一次,挡不住重试之间被替换的二进制。
        // 未登记 identity 时 checkBinaryIdentity 在哈希前就返回,不产生额外开销。
        let verifiedIdentity: VerifiedBinaryIdentity | undefined;
        const preSpawnGate = (): "binary_identity_mismatch" | undefined => {
          const identityCheck = checkBinaryIdentity(
            opts.binaryPath,
            opts.binaryIdentity,
            opts.familyOf,
            opts.expectedFamily,
            { forceRehash: true, hashFile: opts.hashFile ?? sha256File }
          );
          // 后一发被拒不得抹掉前一发已核验的身份:那几发的 consume/豁免证据仍归它们自己。
          if (identityCheck.ok) verifiedIdentity = identityCheck.identity;
          if (identityCheck.ok || !opts.binaryIdentity) return undefined;
          // 只认这次核验算出的摘要:事后重读会落到另一个版本上,审计就不再是判定当时的快照。
          // 拿不到(不可读/路径不符/登记摘要格式坏)一律记 null,不把底层路径错误暴露给调用方。
          const actualBinaryDigest: string | null = identityCheck.actualDigest ?? null;
          opts.audit.record({
            actor: "daemon",
            action: "provider.cli_runtime_rejected",
            refDigest: opts.binaryIdentity.digest,
            meta: {
              provider: opts.provider,
              reason: "binary_identity_mismatch",
              binaryPath: opts.binaryIdentity.path,
              registeredBinaryDigest: opts.binaryIdentity.digest,
              actualBinaryDigest
            }
          });
          return "binary_identity_mismatch";
        };
        if (schemaFile && req.jsonSchema) {
          writeFileSync(schemaFile, JSON.stringify(req.jsonSchema), { encoding: "utf8", mode: 0o600 });
        }
        const cageCwdEmptyAtSpawn = readdirSync(activeCwd).length === 0;
        let accountingFailed = false;
        const secretValues = collectSecretEnvValues(process.env, opts.passEnv);

        const configuredRetryLimit = opts.networkRetryLimit ?? 1;
        if (!Number.isInteger(configuredRetryLimit) || configuredRetryLimit < 0 || configuredRetryLimit > 1) {
          throw new Error("networkRetryLimit 只允许 0 或 1");
        }
        const requestRetryLimit = req.retryBudget ?? 1;
        const invoke = async (
          prompt: string,
          networkRetryLimit = Math.min(configuredRetryLimit, requestRetryLimit)
        ): Promise<InvocationResult> => {
          if (grokPromptFile) {
            writeFileSync(grokPromptFile, prompt, { encoding: "utf8", mode: 0o600 });
          }
          const argv = buildCageArgv({
            provider: opts.provider,
            cwd: activeCwd,
            model: opts.model,
            ...(opts.reasoning ? { reasoning: opts.reasoning } : {}),
            ...(opts.binaryPath ? { binaryPath: opts.binaryPath } : {}),
            ...(schemaFile && opts.provider === "codex_cli" ? { outputSchemaFile: schemaFile } : {}),
            ...(req.jsonSchema && (opts.provider === "claude_cli" || opts.provider === "grok_cli")
              ? { outputSchemaJson: JSON.stringify(req.jsonSchema) }
              : {}),
            ...(grokPromptFile ? { promptFile: grokPromptFile } : {}),
            ...(isolated?.policyFile ? { policyFile: isolated.policyFile } : {}),
            ...(isolated?.authType ? { authType: isolated.authType } : {}),
            ...(opts.readonlyFoundationCwd ? { readonlyFoundation: true } : {})
          });
          const argvDigest = jcsDigest({ bin: argv.bin, args: argv.args });
          const parser = parserFor(opts.provider, {
            requireClaudeStructuredOutput: opts.provider === "claude_cli" && req.jsonSchema !== undefined
          });
          const noteSafetyStop = (
            kind: NonNullable<SpawnAttemptResult["safetyStop"]>,
            line: string
          ): NonNullable<SpawnAttemptResult["safetyStop"]> => {
            opts.log?.warn("byoa.safety_stop", {
              provider: opts.provider,
              slot: opts.slot ?? null,
              kind,
              triggerLine: safetyStopLogLine(line, secretValues)
            });
            return kind;
          };
          // grok 正文在 --prompt-file;stdin 写空串避免把 256KB prompt 再塞一遍
          const turn = await runSpawnTurn({
            argv,
            prompt: opts.provider === "grok_cli" ? "" : prompt,
            onStdoutLine: (line) => {
              try {
                const event = parser(line);
                if (
                  event.observedModel &&
                  opts.expectedFamily !== "unknown" &&
                  opts.familyOf(event.observedModel) !== opts.expectedFamily
                ) {
                  return noteSafetyStop("family_mismatch", line);
                }
                if (event.kind === "tool_call") return noteSafetyStop("tripwire", line);
                if (event.kind === "unknown") return noteSafetyStop("unknown_event", line);
                // 新家允许整段纯文本收敛,非 JSON 行不在流中途作废。
                if (event.kind === "parse_error" && !requiresIsolatedHome(opts.provider)) {
                  return noteSafetyStop("parse_error", line);
                }
                return undefined;
              } catch {
                return requiresIsolatedHome(opts.provider) ? undefined : noteSafetyStop("parse_error", line);
              }
            },
            stopNetworkRetry: (result) => isCliSubscriptionRateLimit(opts.provider, result),
            preSpawnGate,
            signal: invocationController.signal,
            ...(opts.wallTimeoutMs !== undefined ? { wallTimeoutMs: opts.wallTimeoutMs } : {}),
            ...(opts.idleTimeoutMs !== undefined ? { idleTimeoutMs: opts.idleTimeoutMs } : {}),
            ...(opts.outputLimitBytes !== undefined ? { outputLimitBytes: opts.outputLimitBytes } : {}),
            ...(opts.killGraceMs !== undefined ? { killGraceMs: opts.killGraceMs } : {}),
            ...(networkRetryLimit !== undefined ? { networkRetryLimit } : {}),
            passEnv: {
              ...(opts.passEnv ?? {}),
              ...(isolated ? isolatedHomeEnv(isolated) : {}),
              ...(isolated ? isolatedProviderSecrets(isolated) : {})
            }
          });
          const consumedAttempts = turn.attemptResults.map((attempt) => {
            const parsed = attempt.lines.map(parser);
            const allNonJson =
              requiresIsolatedHome(opts.provider) &&
              attempt.lines.some((line) => line.trim()) &&
              parsed.every((event) => event.kind === "parse_error" || event.kind === "unknown");
            return consumeByoaEvents(allNonJson ? parsePlaintextBlock(attempt.lines.join("\n")) : parsed, {
              expectedFamily: opts.expectedFamily,
              familyOf: opts.familyOf,
              requestedModel: opts.model,
              familyFixed: allowsVerifiedBinaryDefault(opts.provider),
              ...(verifiedIdentity && allowsVerifiedBinaryDefault(opts.provider)
                ? {
                    verifiedBinaryDefault: true,
                    ...(verifiedIdentity.defaultModel ? { verifiedBinaryDefaultModel: verifiedIdentity.defaultModel } : {})
                  }
                : {}),
              requireObservedModel: true,
              requireTerminalResult: true
            });
          });
          // 被门拦下的那一发没有起进程,不进 attempts 口径、不进计费,证据也不该由它代表。
          const spawnedAttempts = turn.attemptResults.filter((attempt) => !attempt.spawnBlocked).length;
          const lastSpawnedIndex = turn.attemptResults.findLastIndex((attempt) => !attempt.spawnBlocked);
          const consumed = consumedAttempts[lastSpawnedIndex] ?? consumedAttempts.at(-1)!;

          for (const [attemptIndex, attempt] of turn.attemptResults.entries()) {
            if (attempt.spawnBlocked) continue;
            const attemptConsumed = consumedAttempts[attemptIndex]!;
            const unknownEventShapes = attempt.lines.flatMap((line) => {
              const event = parser(line);
              if (event.kind !== "unknown") return [];
              try {
                JSON.parse(line);
                // 不受信 CLI 字段不得原样进入不可变审计;只保留固定类别。
                return ["unknown-json"];
              } catch {
                return ["non-json"];
              }
            });
            const structuredInvalid =
              req.jsonSchema !== undefined &&
              attemptConsumed.ok &&
              attemptConsumed.text.trim() !== "" &&
              !parseStructuredOutput(attemptConsumed.text, req.jsonSchema).ok;
            const rateLimited = isCliSubscriptionRateLimit(opts.provider, attempt);
            const processVoidReason =
              attempt.pipeError
                ? "pipe_failed"
                : (attempt.safetyStop && attempt.safetyStop !== "unknown_event" ? attempt.safetyStop : undefined) ??
                  (rateLimited ? "subscription_rate_limited" : undefined) ??
                  attempt.safetyStop ??
                  (attempt.aborted
                    ? "cancelled"
                    : attempt.timedOut
                      ? `timeout_${attempt.timeoutKind ?? "wall"}`
                      : attempt.outputLimitExceeded
                        ? "output_limit"
                        : attempt.lifecycleError
                          ? "process_group_not_reaped"
                          : attempt.spawnError
                            ? "spawn_failed"
                            : attempt.exitCode !== 0
                              ? "process_exit"
                              : attempt.lines.every((line) => !line.trim()) ||
                                  (attemptConsumed.ok && attemptConsumed.text.trim() === "")
                                ? "empty_output"
                                : structuredInvalid
                                  ? "invalid_structured_output"
                                  : undefined);
            if (attemptConsumed.observedModelExempted && verifiedIdentity) {
              opts.audit.record({
                actor: "daemon",
                action: "provider.observed_model_exemption",
                refDigest: verifiedIdentity.digest,
                meta: {
                  provider: opts.provider,
                  binaryPath: verifiedIdentity.path,
                  binaryDigest: verifiedIdentity.digest,
                  requestedModel: attemptConsumed.requestedModel ?? null,
                  observedModel: attemptConsumed.observedModel ?? null,
                  observedModelSource: attemptConsumed.observedModelSource,
                  observedModelExempted: true,
                  attempt: attemptIndex + 1,
                  attempts: spawnedAttempts
                }
              });
            }
            opts.audit.record({
              actor: "daemon",
              action: "byoa.invocation",
              refDigest: attemptConsumed.evidenceDigest,
              meta: {
                profile: opts.profile,
                configured_provider: opts.provider,
                routed_provider: "unknown",
                argvDigest,
                cwd: activeCwd,
                cageCwdEmptyAtSpawn,
                cage:
                  opts.provider === "claude_cli" ||
                  opts.provider === "grok_cli" ||
                  opts.provider === "gemini_cli" ||
                  opts.provider === "qwen_cli" ||
                  opts.provider === "copilot_cli"
                    ? "tool-deny"
                    : opts.provider === "codex_cli"
                      ? "write-sandbox"
                      : "ask+tripwire",
                requestedModel: attemptConsumed.requestedModel ?? null,
                observedModel: attemptConsumed.observedModel ?? null,
                observedModelSource: attemptConsumed.observedModelSource,
                observedModelExempted: attemptConsumed.observedModelExempted,
                toolCallCount: attemptConsumed.toolCallCount,
                voided: !attemptConsumed.ok || processVoidReason !== undefined,
                voidReason: processVoidReason ?? attemptConsumed.voidReason ?? null,
                timedOut: attempt.timedOut,
                timeoutKind: attempt.timeoutKind ?? null,
                aborted: attempt.aborted,
                outputLimitExceeded: attempt.outputLimitExceeded,
                exitCode: attempt.exitCode,
                attempt: attemptIndex + 1,
                attempts: spawnedAttempts,
                schemaDigest: req.jsonSchema ? jcsDigest(req.jsonSchema) : null,
                unknownEventShapes
              }
            });
          }
          try {
            if (spawnedAttempts > 0) {
              opts.onSubscriptionInvocation?.({
                provider: opts.provider,
                model: opts.model,
                requests: spawnedAttempts,
                ...(opts.costProvenance ? { provenance: opts.costProvenance } : {})
              });
            }
          } catch (err) {
            accountingFailed = true;
            opts.audit.record({
              actor: "daemon",
              action: "byoa.subscription_accounting_failed",
              refDigest: consumed.evidenceDigest,
              meta: { provider: opts.provider, attempts: spawnedAttempts, error: String(err).slice(0, 160) }
            });
          }
          return { turn, consumed };
        };

        const inputLimit = opts.inputLimitBytes ?? DEFAULT_INPUT_LIMIT_BYTES;
        const cursorSchemaReserve =
          req.jsonSchema && opts.provider === "cursor_cli"
            ? Math.max(
                Buffer.byteLength(cursorSchemaPrompt("", req.jsonSchema, false)),
                Buffer.byteLength(cursorSchemaPrompt("", req.jsonSchema, true))
              )
            : 0;
        const safetyHeaderReserve = Math.max(
          Buffer.byteLength(isolatedPrompt("", false)),
          Buffer.byteLength(isolatedPrompt("", true))
        );
        const basePrompt = buildBoundedPrompt(req.messages, inputLimit - cursorSchemaReserve - safetyHeaderReserve);
        if (basePrompt === null) return failure("input_limit", "CLI 输入超过上下文上限,请缩短历史或 Context Pack", false);
        const invocationPrompt = (reinforced: boolean): string => {
          const prompt = isolatedPrompt(basePrompt, reinforced);
          return req.jsonSchema && opts.provider === "cursor_cli"
            ? cursorSchemaPrompt(prompt, req.jsonSchema, false)
            : prompt;
        };
        let safetyRetried = false;
        let invocation = await invoke(invocationPrompt(false));
        let retriesUsed = invocation.turn.attempts - 1;
        const canUseSafetyRetry =
          retriesUsed === 0 && requestRetryLimit > 0 && !accountingFailed && !invocation.turn.pipeError;
        const isUnknownEventVoid = (current: InvocationResult): boolean => {
          if (current.turn.safetyStop === "family_mismatch" || current.consumed.voidReason === "family_mismatch") {
            return false;
          }
          if (current.turn.safetyStop === "tripwire" || current.consumed.voidReason === "tripwire") {
            return false;
          }
          return current.turn.safetyStop === "unknown_event" || current.consumed.voidReason === "unknown_event";
        };
        if (
          canUseSafetyRetry &&
          invocation.turn.safetyStop === "tripwire" &&
          invocation.consumed.voidReason === "tripwire" &&
          !invocation.consumed.hadConsumableOutput
        ) {
          safetyRetried = true;
          invocation = await invoke(invocationPrompt(true), 0);
          retriesUsed += 1;
        } else if (
          canUseSafetyRetry &&
          isUnknownEventVoid(invocation) &&
          !isCliSubscriptionRateLimit(opts.provider, invocation.turn)
        ) {
          invocation = await invoke(invocationPrompt(false), 0);
          retriesUsed += 1;
        }

        const processFailure = (current: InvocationResult): ChatResult | undefined => {
          const triggerLine = current.turn.safetyStopLine;
          const voided = (code: string, message: string): ChatResult =>
            failure(code, withTriggerContent(message, triggerLine, secretValues), false);
          // 身份漂移排在记账失败之前:前者 fail-closed 不可重试,后者 retryable,
          // 让调用方去重试一个已被换掉的二进制是错的处方(记账失败本身仍有独立审计行)。
          if (current.turn.spawnBlocked) {
            return failure("binary_identity_mismatch", "CLI 可执行文件身份与 self-test 登记不一致", false);
          }
          if (accountingFailed) return failure("cost_ledger_failed", "CLI 调用记账失败,结果不下发", true);
          if (current.turn.pipeError) return failure("pipe_failed", "CLI 输出管道失败", false);
          if (current.turn.safetyStop && current.turn.safetyStop !== "unknown_event") {
            return voided(
              `voided_${current.turn.safetyStop}`,
              explainByoaVoidReason(current.turn.safetyStop, "safety_stop", current.consumed.observedModel)
            );
          }
          if (isCliSubscriptionRateLimit(opts.provider, current.turn)) {
            const explained = explainCliProcessFailure(opts.provider, current.turn);
            return failure("subscription_rate_limited", explained.message, true);
          }
          if (current.turn.safetyStop) {
            return voided(
              `voided_${current.turn.safetyStop}`,
              explainByoaVoidReason(current.turn.safetyStop, "safety_stop", current.consumed.observedModel)
            );
          }
          if (current.turn.aborted) return failure("cancelled", "CLI 调用已取消", false);
          if (current.turn.timedOut) {
            return failure("timeout", `CLI ${current.turn.timeoutKind ?? "wall"} 超时`, true);
          }
          if (current.turn.outputLimitExceeded) return failure("output_limit", "CLI 输出超过配置上限", false);
          if (current.turn.lifecycleError) return failure("process_group_not_reaped", "CLI 进程组未能在时限内收口", false);
          if (current.turn.spawnError || current.turn.exitCode === null) return failure("spawn_failed", "CLI 进程未能启动", true);
          if (current.turn.exitCode !== 0) {
            const explained = explainCliProcessFailure(opts.provider, current.turn);
            return failure(explained.code, explained.message, explained.kind === "usage_limit");
          }
          if (current.turn.lines.every((line) => !line.trim())) return failure("empty_output", "CLI 返回了空输出", false);
          if (!current.consumed.ok) {
            if (current.consumed.voidReason === "cli_error") {
              return failure(
                "cli_error",
                current.consumed.errorMessage ??
                  explainByoaVoidReason("cli_error", "consume", current.consumed.observedModel),
                false
              );
            }
            const consumeTrigger =
              triggerLine ??
              current.turn.lines.find((line) => {
                try {
                  const event = parserFor(opts.provider)(line);
                  return event.kind === "unknown" || event.kind === "parse_error";
                } catch {
                  return true;
                }
              });
            return failure(
              `voided_${current.consumed.voidReason}`,
              withTriggerContent(
                explainByoaVoidReason(
                  current.consumed.voidReason ?? "unknown_event",
                  "consume",
                  current.consumed.observedModel
                ),
                consumeTrigger,
                secretValues
              ),
              false
            );
          }
          if (!current.consumed.text.trim()) return failure("empty_output", "CLI 返回了空输出", false);
          return undefined;
        };

        let failed = processFailure(invocation);
        if (failed) return failed;

        if (req.jsonSchema) {
          let structured = parseStructuredOutput(invocation.consumed.text, req.jsonSchema);
          if (!structured.ok && opts.provider === "cursor_cli" && retriesUsed === 0 && requestRetryLimit > 0) {
            invocation = await invoke(cursorSchemaPrompt(isolatedPrompt(basePrompt, safetyRetried), req.jsonSchema, true), 0);
            retriesUsed += 1;
            failed = processFailure(invocation);
            if (failed) return failed;
            structured = parseStructuredOutput(invocation.consumed.text, req.jsonSchema);
          }
          if (!structured.ok) {
            return {
              ok: false,
              code: "invalid_structured_output",
              message: "CLI 输出不符合 JSON schema",
              retryable: false,
              attemptsMade: retriesUsed + 1
            };
          }
        }

        return {
          ok: true,
          text: invocation.consumed.text,
          requestedModel: invocation.consumed.requestedModel,
          observedModel: invocation.consumed.observedModel,
          observedModelSource: invocation.consumed.observedModelSource,
          observedModelExempted: invocation.consumed.observedModelExempted,
          usage: undefined,
          attemptsMade: retriesUsed + 1
        };
      } finally {
        release?.();
        cleanupController();
        if (schemaDir) rmSync(schemaDir, { recursive: true, force: true });
        if (ownsCwd && cwd) rmSync(cwd, { recursive: true, force: true });
        if (isolatedHomeDir) rmSync(isolatedHomeDir, { recursive: true, force: true });
      }
    }
  };
}
