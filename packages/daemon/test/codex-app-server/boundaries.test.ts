import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { runHandshake } from "../../src/experimental/codex-app-server/handshake.js";
import { MemoryIntentRecorder } from "../../src/experimental/codex-app-server/intentLog.js";
import { issueExperimentPermit } from "../../src/experimental/codex-app-server/permit.js";
import { userAgentVersions } from "../../src/experimental/codex-app-server/protocol.js";
import { APP_SERVER_ARGV, PINNED_CODEX_CLI_VERSION } from "../../src/experimental/codex-app-server/provenance.js";
import { openFixtureSession, openRealSession, type CodexAppServerSession, type TurnView } from "../../src/experimental/codex-app-server/session.js";
import { DEFAULT_FRAME_LIMITS } from "../../src/experimental/codex-app-server/framing.js";
import {
  Gate,
  boot,
  createPair,
  delay,
  initResult,
  line,
  openPair,
  ownThread,
  requestByMethod,
  threadBody,
  turnBody
} from "./support.js";

const OBSERVED_USER_AGENT = "saydo-codex-as-spike/0.153.3 (Mac OS 27.2.0; arm64) dumb (saydo-codex-as-spike; 0.0.1)";
const GATE2_USER_AGENT = "Codex Desktop/0.153.3 (Mac OS 27.2.0; arm64) dumb (saydo-codex-as-spike; 0.0.1)";

function versionText(version = PINNED_CODEX_CLI_VERSION): { stdout: string; stderr: string } {
  return { stdout: `codex-cli ${version}\n`, stderr: "" };
}

function answeringSpawn(userAgent?: string): {
  spawned: { link: ReturnType<typeof createPair>["link"]; pid: number; cleanup: () => void };
  terminated: () => boolean;
} {
  const pair = createPair();
  let terminated = false;
  pair.link.stdin.on("data", () => {
    const message = pair.frames.at(-1);
    if (!message || message["method"] !== "initialize") return;
    pair.stdout.write(line({ id: message["id"], result: initResult(userAgent) }));
  });
  pair.link.terminate = async () => {
    terminated = true;
    return { sigkill: false, exitCode: 0, signal: null };
  };
  return {
    spawned: { link: pair.link, pid: 4242, cleanup() {} },
    terminated: () => terminated
  };
}

async function activeTurn(pair: ReturnType<typeof openPair>): Promise<TurnView | null> {
  const pending = pair.session.startTurn({ taskId: "task-1", threadId: "th-1", text: "hello" });
  const request = requestByMethod(pair.frames, "turn/start");
  pair.stdout.write(line({ id: request["id"], result: { turn: turnBody("tu-1", "inProgress") } }));
  const outcome = await pending;
  return outcome.value;
}

function gateFrames(gate: Gate): Array<Record<string, unknown>> {
  return Buffer.concat(gate.chunks)
    .toString("utf8")
    .split("\n")
    .filter((item) => item.trim().length > 0)
    .map((item) => JSON.parse(item) as Record<string, unknown>);
}

function turnStartCount(gate: Gate): number {
  return gateFrames(gate).filter((frame) => frame["method"] === "turn/start").length;
}

function settledOrPending<T>(promise: Promise<T>): Promise<T | "pending"> {
  return new Promise((resolve, reject) => {
    let settled = false;
    promise.then(
      (value) => {
        settled = true;
        resolve(value);
      },
      (error: unknown) => {
        settled = true;
        reject(error);
      }
    );
    queueMicrotask(() => {
      if (!settled) resolve("pending");
    });
  });
}

async function ownAnother(pair: ReturnType<typeof openPair>, threadId: string): Promise<void> {
  const pending = pair.session.startThread({ taskId: "task-1" });
  const request = requestByMethod(pair.frames, "thread/start");
  pair.stdout.write(line({
    id: request["id"],
    result: {
      approvalPolicy: "on-request",
      approvalsReviewer: "user",
      cwd: "/tmp/spike",
      model: "fixture-model",
      modelProvider: "openai",
      sandbox: "read-only",
      serviceTier: null,
      thread: threadBody(threadId)
    }
  }));
  const outcome = await pending;
  if (outcome.status !== "acked") throw new Error(outcome.reason);
}

async function bootOnGate(session: CodexAppServerSession, gate: Gate, stdout: PassThrough): Promise<void> {
  const pending = session.initialize();
  const request = gateFrames(gate).find((frame) => frame["method"] === "initialize");
  if (!request) throw new Error("missing initialize");
  stdout.write(line({ id: request["id"], result: initResult() }));
  const outcome = await pending;
  if (outcome.status !== "acked") throw new Error(outcome.reason);
}

async function ownOnGate(session: CodexAppServerSession, gate: Gate, stdout: PassThrough, threadId: string): Promise<void> {
  const pending = session.startThread({ taskId: "task-1" });
  const request = [...gateFrames(gate)].reverse().find((frame) => frame["method"] === "thread/start");
  if (!request) throw new Error("missing thread/start");
  stdout.write(line({
    id: request["id"],
    result: {
      approvalPolicy: "on-request",
      approvalsReviewer: "user",
      cwd: "/tmp/spike",
      model: "named-model",
      modelProvider: "openai",
      sandbox: "read-only",
      serviceTier: null,
      thread: threadBody(threadId)
    }
  }));
  const outcome = await pending;
  if (outcome.status !== "acked") throw new Error(outcome.reason);
}

async function withRealTurns(
  opts: { maxTurns: number; requestTimeoutMs?: number; maxQueued?: number; threads: string[] },
  run: (ctx: { gate: Gate; stdout: PassThrough; session: CodexAppServerSession }) => Promise<void>
): Promise<void> {
  const now = 10_000;
  const issued = issueExperimentPermit({
    enabled: true,
    model: "named-model",
    effectBoundary: "deny-exec-file-permissions",
    maxTurns: opts.maxTurns,
    wallMs: 120_000
  }, now);
  expect(issued.ok).toBe(true);
  if (!issued.ok) return;
  const gate = new Gate();
  const stdout = new PassThrough();
  const frameLimits = { ...DEFAULT_FRAME_LIMITS };
  if (opts.maxQueued !== undefined) frameLimits.maxQueued = opts.maxQueued;
  const dir = mkdtempSync(join(tmpdir(), "saydo-codex-repair3-"));
  const session = openRealSession({
    link: { stdin: gate, stdout, stderr: new PassThrough(), onExit: null, terminate: null },
    intentLogPath: join(dir, "intent.jsonl"),
    runId: "repair3",
    permit: issued.permit,
    now: () => now,
    requestTimeoutMs: opts.requestTimeoutMs ?? 5_000,
    frameLimits
  });
  try {
    await bootOnGate(session, gate, stdout);
    for (const threadId of opts.threads) await ownOnGate(session, gate, stdout, threadId);
    await run({ gate, stdout, session });
  } finally {
    gate.release();
    await session.shutdown();
  }
}

async function expectMalformedInterrupt(result: unknown): Promise<void> {
  const pair = openPair();
  try {
    await boot(pair);
    await ownThread(pair);
    await ownAnother(pair, "th-2");
    await activeTurn(pair);
    const pending = pair.session.interruptTurn({ taskId: "task-1", threadId: "th-1", turnId: "tu-1" });
    const request = requestByMethod(pair.frames, "turn/interrupt");
    const starts = pair.frames.filter((frame) => frame["method"] === "turn/start").length;
    pair.stdout.write(line({ id: request["id"], result }));
    const outcome = await pending;
    expect(outcome.status).toBe("unknown");
    expect(outcome.reason).toBe("protocol_error");
    const turn = pair.session.snapshot().threads.find((item) => item.threadId === "th-1")?.turn;
    expect(turn?.phase).toBe("unknown");
    expect(turn?.turnId).toBe("tu-1");
    expect(turn?.interruptAcked).toBe(false);
    expect(turn?.interruptConfirmed).toBe(false);
    expect(turn?.terminalStatus).toBeNull();
    const blocked = await pair.session.startTurn({ taskId: "task-1", threadId: "th-2", text: "other" });
    expect(blocked.status).toBe("unsent");
    expect(blocked.reason).toBe("unknown_blocks");
    expect(pair.frames.filter((frame) => frame["method"] === "turn/start")).toHaveLength(starts);
    const same = await pair.session.steerTurn({
      taskId: "task-1",
      threadId: "th-1",
      expectedTurnId: "tu-1",
      text: "again"
    });
    expect(same.reason).toBe("unknown_blocks");
  } finally {
    await pair.session.shutdown();
  }
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function killPid(child: ChildProcess): void {
  if (!child.pid || child.exitCode !== null) return;
  try {
    child.kill("SIGKILL");
  } catch {
    // 进程已经退出
  }
}

type SteerAckKind = "malformed" | "mismatch";
type ChildStop = { sigkill: boolean; exitCode: number | null; signal: NodeJS.Signals | null };

function steerResult(kind: SteerAckKind): unknown {
  return kind === "malformed" ? {} : { turnId: "tu-other" };
}

function steerReason(kind: SteerAckKind): string {
  return kind === "malformed" ? "protocol_error" : "ack_conflict";
}

async function startNamedTurn(pair: ReturnType<typeof openPair>, threadId: string, turnId: string): Promise<void> {
  const pending = pair.session.startTurn({ taskId: "task-1", threadId, text: `go-${turnId}` });
  const request = requestByMethod(pair.frames, "turn/start");
  pair.stdout.write(line({ id: request["id"], result: { turn: turnBody(turnId, "inProgress") } }));
  const outcome = await pending;
  if (outcome.status !== "acked") throw new Error(outcome.reason);
}

async function expectInterruptSent(pair: ReturnType<typeof openPair>, threadId: string, turnId: string): Promise<void> {
  const before = pair.frames.filter((frame) => frame["method"] === "turn/interrupt").length;
  const pending = pair.session.interruptTurn({ taskId: "task-1", threadId, turnId });
  const sent = pair.frames.filter((frame) => frame["method"] === "turn/interrupt");
  expect(sent).toHaveLength(before + 1);
  const request = sent[sent.length - 1];
  if (!request) throw new Error("missing interrupt");
  pair.stdout.write(line({ id: request["id"], result: {} }));
  const outcome = await pending;
  expect(outcome.status).toBe("acked");
  expect(outcome.reason).toBe("interrupt_ack");
  const turn = pair.session.snapshot().threads.find((item) => item.threadId === threadId)?.turn;
  expect(turn?.turnId).toBe(turnId);
  expect(turn?.phase).toBe("interrupt_pending");
  expect(turn?.interruptAcked).toBe(true);
  expect(turn?.interruptConfirmed).toBe(false);
  expect(turn?.upstreamTerminal).toBe(false);
  expect(pair.session.snapshot().unknownBlocks).toBe(0);
}

async function expectStaleSteer(kind: SteerAckKind, mode: "terminal-first" | "new-turn-first" | "other-thread"): Promise<void> {
  const pair = openPair();
  try {
    await boot(pair);
    await ownThread(pair);
    if (mode === "other-thread") await ownAnother(pair, "th-2");
    await activeTurn(pair);
    if (mode === "other-thread") await startNamedTurn(pair, "th-2", "tu-b");
    const steer = pair.session.steerTurn({
      taskId: "task-1",
      threadId: "th-1",
      expectedTurnId: "tu-1",
      text: "nudge"
    });
    pair.stdout.write(line({
      method: "turn/completed",
      params: { threadId: "th-1", turn: turnBody("tu-1", "completed") }
    }));
    if (mode !== "terminal-first") await startNamedTurn(pair, "th-1", "tu-2");
    const request = requestByMethod(pair.frames, "turn/steer");
    pair.stdout.write(line({ id: request["id"], result: steerResult(kind) }));
    const outcome = await steer;
    expect(outcome.status).toBe("unknown");
    expect(outcome.reason).toBe(steerReason(kind));
    expect(pair.session.snapshot().unknownBlocks).toBe(0);
    if (mode === "terminal-first") {
      const turn = pair.session.snapshot().threads.find((item) => item.threadId === "th-1")?.turn;
      expect(turn?.phase).toBe("terminal");
      expect(turn?.turnId).toBe("tu-1");
      expect(turn?.terminalStatus).toBe("completed");
      expect(turn?.upstreamTerminal).toBe(true);
      expect(turn?.interruptAcked).toBe(false);
      const old = await pair.session.interruptTurn({ taskId: "task-1", threadId: "th-1", turnId: "tu-1" });
      expect(old.status).toBe("unsent");
      expect(old.reason).toBe("turn_not_active");
      expect(pair.frames.filter((frame) => frame["method"] === "turn/interrupt")).toHaveLength(0);
      await startNamedTurn(pair, "th-1", "tu-2");
      await expectInterruptSent(pair, "th-1", "tu-2");
      expect(pair.session.snapshot().threads.find((item) => item.threadId === "th-1")?.turn?.turnId).toBe("tu-2");
    }
    if (mode === "new-turn-first") {
      const turn = pair.session.snapshot().threads.find((item) => item.threadId === "th-1")?.turn;
      expect(turn?.turnId).toBe("tu-2");
      expect(turn?.phase).toBe("active");
      expect(turn?.interruptAcked).toBe(false);
      expect(turn?.interruptConfirmed).toBe(false);
      expect(turn?.terminalStatus).toBeNull();
      await expectInterruptSent(pair, "th-1", "tu-2");
      expect(pair.session.snapshot().threads.find((item) => item.threadId === "th-1")?.turn?.turnId).toBe("tu-2");
    }
    if (mode === "other-thread") {
      const first = pair.session.snapshot().threads.find((item) => item.threadId === "th-1")?.turn;
      const second = pair.session.snapshot().threads.find((item) => item.threadId === "th-2")?.turn;
      expect(first?.turnId).toBe("tu-2");
      expect(first?.phase).toBe("active");
      expect(second?.turnId).toBe("tu-b");
      expect(second?.phase).toBe("active");
      await expectInterruptSent(pair, "th-2", "tu-b");
      expect(pair.session.snapshot().threads.find((item) => item.threadId === "th-1")?.turn?.turnId).toBe("tu-2");
      expect(pair.session.snapshot().threads.find((item) => item.threadId === "th-1")?.turn?.phase).toBe("active");
      await expectInterruptSent(pair, "th-1", "tu-2");
    }
  } finally {
    await pair.session.shutdown();
  }
}

type AckOp = "start" | "steer" | "interrupt";
type AckState = "active" | "terminal" | "changed";
type AckKind = "legal" | "malformed" | "conflict";
type AckCell = { op: AckOp; state: AckState; kind: AckKind };

const ACK_OPS: readonly AckOp[] = ["start", "steer", "interrupt"];
const ACK_STATES: readonly AckState[] = ["active", "terminal", "changed"];
const ACK_KINDS: readonly AckKind[] = ["legal", "malformed", "conflict"];

/** interrupt 的合法结果是空 object，schema 里没有 turnId，不能造冲突项。 */
function ackMatrix(): AckCell[] {
  const cells: AckCell[] = [];
  for (const op of ACK_OPS) {
    for (const state of ACK_STATES) {
      for (const kind of ACK_KINDS) {
        if (op === "interrupt" && kind === "conflict") continue;
        cells.push({ op, state, kind });
      }
    }
  }
  return cells;
}

function staleAckMatrix(): AckCell[] {
  return ackMatrix().filter((cell) => cell.state !== "active");
}

function ackResult(op: AckOp, kind: AckKind, boundTurnId: string): unknown {
  if (op === "interrupt") {
    if (kind === "malformed") return null;
    return {};
  }
  if (op === "steer") {
    if (kind === "legal") return { turnId: boundTurnId };
    if (kind === "malformed") return {};
    return { turnId: "tu-other" };
  }
  if (kind === "legal") return { turn: turnBody(boundTurnId, "inProgress") };
  if (kind === "malformed") return {};
  return { turn: turnBody("tu-other", "inProgress") };
}

function callExpect(cell: AckCell): { status: "acked" | "unknown"; reason: string; blocks: boolean } {
  if (cell.kind === "legal" || (cell.op === "start" && cell.kind === "conflict" && cell.state !== "active")) {
    return { status: "acked", reason: cell.op === "interrupt" ? "interrupt_ack" : "ok", blocks: false };
  }
  return {
    status: "unknown",
    reason: cell.kind === "conflict" ? "ack_conflict" : "protocol_error",
    blocks: cell.state === "active"
  };
}

function turnExpect(cell: AckCell): {
  turnId: string;
  phase: string;
  terminalStatus: string | null;
  interruptAcked: boolean;
  interruptConfirmed: boolean;
  upstreamTerminal: boolean;
} {
  if (cell.state === "changed") {
    return {
      turnId: "tu-2",
      phase: "active",
      terminalStatus: null,
      interruptAcked: false,
      interruptConfirmed: false,
      upstreamTerminal: false
    };
  }
  if (cell.state === "terminal") {
    return {
      turnId: "tu-1",
      phase: "terminal",
      terminalStatus: "completed",
      interruptAcked: false,
      interruptConfirmed: false,
      upstreamTerminal: true
    };
  }
  if (cell.op === "interrupt" && cell.kind === "legal") {
    return {
      turnId: "tu-1",
      phase: "interrupt_pending",
      terminalStatus: null,
      interruptAcked: true,
      interruptConfirmed: false,
      upstreamTerminal: false
    };
  }
  if (cell.kind === "legal") {
    return {
      turnId: "tu-1",
      phase: "active",
      terminalStatus: null,
      interruptAcked: false,
      interruptConfirmed: false,
      upstreamTerminal: false
    };
  }
  return {
    turnId: "tu-1",
    phase: "unknown",
    terminalStatus: null,
    interruptAcked: false,
    interruptConfirmed: false,
    upstreamTerminal: false
  };
}

function phaseBeforeAck(cell: AckCell): { turnId: string; phase: string } {
  if (cell.state === "changed") return { turnId: "tu-2", phase: "active" };
  if (cell.state === "terminal") return { turnId: "tu-1", phase: "terminal" };
  if (cell.op === "interrupt") return { turnId: "tu-1", phase: "interrupt_pending" };
  return { turnId: "tu-1", phase: "active" };
}

function completeOriginal(pair: ReturnType<typeof openPair>): void {
  pair.stdout.write(line({
    method: "turn/completed",
    params: { threadId: "th-1", turn: turnBody("tu-1", "completed") }
  }));
}

async function expectAckCell(cell: AckCell, preserveUnknown: boolean): Promise<void> {
  const pair = openPair();
  try {
    await boot(pair);
    await ownThread(pair);
    await ownAnother(pair, "th-2");
    await startNamedTurn(pair, "th-2", "tu-b");
    let pending: Promise<{ status: string; reason: string }>;
    let requestId: unknown;
    if (cell.op === "start") {
      pending = pair.session.startTurn({ taskId: "task-1", threadId: "th-1", text: "hello" });
      requestId = requestByMethod(pair.frames, "turn/start")["id"];
      if (cell.state === "active") {
        pair.stdout.write(line({
          method: "turn/started",
          params: { threadId: "th-1", turn: turnBody("tu-1", "inProgress") }
        }));
      } else {
        completeOriginal(pair);
        if (cell.state === "changed") await startNamedTurn(pair, "th-1", "tu-2");
      }
    } else {
      await startNamedTurn(pair, "th-1", "tu-1");
      if (cell.op === "steer") {
        pending = pair.session.steerTurn({
          taskId: "task-1",
          threadId: "th-1",
          expectedTurnId: "tu-1",
          text: "nudge"
        });
        requestId = requestByMethod(pair.frames, "turn/steer")["id"];
      } else {
        pending = pair.session.interruptTurn({ taskId: "task-1", threadId: "th-1", turnId: "tu-1" });
        requestId = requestByMethod(pair.frames, "turn/interrupt")["id"];
      }
      if (cell.state !== "active") {
        completeOriginal(pair);
        if (cell.state === "changed") await startNamedTurn(pair, "th-1", "tu-2");
      }
    }
    const before = phaseBeforeAck(cell);
    const prepared = pair.session.snapshot().threads.find((item) => item.threadId === "th-1")?.turn;
    expect(prepared?.turnId).toBe(before.turnId);
    expect(prepared?.phase).toBe(before.phase);
    if (preserveUnknown) {
      const extra = pair.session.startThread({ taskId: "task-1" });
      const start = requestByMethod(pair.frames, "thread/start");
      pair.stdout.write(line({ id: start["id"], result: { thread: { name: null } } }));
      const extraOutcome = await extra;
      expect(extraOutcome.status).toBe("unknown");
      expect(pair.session.snapshot().unknownBlocks).toBe(1);
    } else {
      expect(pair.session.snapshot().unknownBlocks).toBe(0);
    }
    pair.stdout.write(line({ id: requestId, result: ackResult(cell.op, cell.kind, "tu-1") }));
    const outcome = await pending;
    const wantedCall = callExpect(cell);
    const wantedTurn = turnExpect(cell);
    expect(outcome.status).toBe(wantedCall.status);
    expect(outcome.reason).toBe(wantedCall.reason);
    const turn = pair.session.snapshot().threads.find((item) => item.threadId === "th-1")?.turn;
    expect(turn?.turnId).toBe(wantedTurn.turnId);
    expect(turn?.phase).toBe(wantedTurn.phase);
    expect(turn?.terminalStatus).toBe(wantedTurn.terminalStatus);
    expect(turn?.interruptAcked).toBe(wantedTurn.interruptAcked);
    expect(turn?.interruptConfirmed).toBe(wantedTurn.interruptConfirmed);
    expect(turn?.upstreamTerminal).toBe(wantedTurn.upstreamTerminal);
    const blocks = preserveUnknown ? 1 : wantedCall.blocks ? 1 : 0;
    expect(pair.session.snapshot().unknownBlocks).toBe(blocks);
    const interruptFrames = pair.frames.filter((frame) => frame["method"] === "turn/interrupt").length;
    if (blocks > 0) {
      const blocked = await pair.session.interruptTurn({ taskId: "task-1", threadId: "th-2", turnId: "tu-b" });
      expect(blocked.status).toBe("unsent");
      expect(blocked.reason).toBe("unknown_blocks");
      expect(pair.frames.filter((frame) => frame["method"] === "turn/interrupt")).toHaveLength(interruptFrames);
    } else {
      await expectInterruptSent(pair, "th-2", "tu-b");
    }
    const again = pair.session.snapshot().threads.find((item) => item.threadId === "th-1")?.turn;
    expect(again?.turnId).toBe(wantedTurn.turnId);
    expect(again?.phase).toBe(wantedTurn.phase);
    expect(again?.interruptAcked).toBe(wantedTurn.interruptAcked);
    expect(again?.terminalStatus).toBe(wantedTurn.terminalStatus);
    const other = pair.session.snapshot().threads.find((item) => item.threadId === "th-2")?.turn;
    expect(other?.turnId).toBe("tu-b");
    expect(other?.phase).toBe(blocks > 0 ? "active" : "interrupt_pending");
  } finally {
    await pair.session.shutdown();
  }
}

async function expectPreservedUnknown(kind: SteerAckKind): Promise<void> {
  const pair = openPair();
  try {
    await boot(pair);
    await ownThread(pair);
    await activeTurn(pair);
    const steer = pair.session.steerTurn({
      taskId: "task-1",
      threadId: "th-1",
      expectedTurnId: "tu-1",
      text: "nudge"
    });
    pair.stdout.write(line({
      method: "turn/completed",
      params: { threadId: "th-1", turn: turnBody("tu-1", "completed") }
    }));
    await startNamedTurn(pair, "th-1", "tu-2");
    const extra = pair.session.startThread({ taskId: "task-1" });
    const start = requestByMethod(pair.frames, "thread/start");
    pair.stdout.write(line({ id: start["id"], result: { thread: { name: null } } }));
    const extraOutcome = await extra;
    expect(extraOutcome.status).toBe("unknown");
    expect(pair.session.snapshot().unknownBlocks).toBe(1);
    const steerFrame = requestByMethod(pair.frames, "turn/steer");
    pair.stdout.write(line({ id: steerFrame["id"], result: steerResult(kind) }));
    const outcome = await steer;
    expect(outcome.status).toBe("unknown");
    expect(outcome.reason).toBe(steerReason(kind));
    expect(pair.session.snapshot().unknownBlocks).toBe(1);
    const turn = pair.session.snapshot().threads.find((item) => item.threadId === "th-1")?.turn;
    expect(turn?.turnId).toBe("tu-2");
    expect(turn?.phase).toBe("active");
    const blocked = await pair.session.interruptTurn({ taskId: "task-1", threadId: "th-1", turnId: "tu-2" });
    expect(blocked.status).toBe("unsent");
    expect(blocked.reason).toBe("unknown_blocks");
    expect(pair.frames.filter((frame) => frame["method"] === "turn/interrupt")).toHaveLength(0);
  } finally {
    await pair.session.shutdown();
  }
}

function spawnSleeper(): ChildProcess {
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000);"], {
    detached: true,
    stdio: "ignore"
  });
  child.unref();
  child.on("error", () => undefined);
  return child;
}

function flushIo(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

async function waitDead(pid: number, ms: number): Promise<boolean> {
  const deadline = Date.now() + ms;
  while (pid > 1 && alive(pid) && Date.now() < deadline) await delay(20);
  return pid > 1 && !alive(pid);
}

async function stopOwned(child: ChildProcess, termMs: number): Promise<ChildStop> {
  const pid = child.pid ?? 0;
  if (pid > 1 && alive(pid)) {
    try {
      child.kill("SIGTERM");
    } catch {
      // 进程已经退出
    }
  }
  const deadline = Date.now() + termMs;
  while (pid > 1 && alive(pid) && Date.now() < deadline) await delay(20);
  if (pid > 1 && alive(pid)) {
    try {
      child.kill("SIGKILL");
    } catch {
      // 进程已经退出
    }
    return { sigkill: true, exitCode: child.exitCode, signal: "SIGKILL" };
  }
  return { sigkill: false, exitCode: child.exitCode, signal: "SIGTERM" };
}

async function withLiveChild(
  opts: {
    wallMs: number;
    terminate: (ctx: {
      child: ChildProcess;
      decoy: ChildProcess;
      stdout: PassThrough;
      session: () => CodexAppServerSession;
    }) => (input: { termMs: number }) => Promise<ChildStop>;
  },
  run: (ctx: {
    session: CodexAppServerSession;
    stdout: PassThrough;
    child: ChildProcess;
    decoy: ChildProcess;
  }) => Promise<void>
): Promise<void> {
  const issuedAt = Date.now();
  const permit = issueExperimentPermit({
    enabled: true,
    model: "named-model",
    effectBoundary: "deny-exec-file-permissions",
    maxTurns: 1,
    wallMs: opts.wallMs
  }, issuedAt);
  if (!permit.ok) throw new Error(permit.reason);
  const child = spawnSleeper();
  const decoy = spawnSleeper();
  const pair = createPair();
  const dir = mkdtempSync(join(tmpdir(), "saydo-codex-repair4-"));
  let session: CodexAppServerSession | null = null;
  pair.link.terminate = opts.terminate({
    child,
    decoy,
    stdout: pair.stdout,
    session: () => {
      if (!session) throw new Error("session missing");
      return session;
    }
  });
  try {
    session = openRealSession({
      link: pair.link,
      intentLogPath: join(dir, "intent.jsonl"),
      runId: "repair4",
      permit: permit.permit,
      requestTimeoutMs: 20_000,
      now: () => Date.now(),
      termMs: 300
    });
    const armed = { ...pair, session };
    await boot(armed);
    await ownThread(armed);
    await activeTurn(armed);
    expect(session.snapshot().timers).toBe(1);
    await run({ session, stdout: pair.stdout, child, decoy });
  } finally {
    if (session) await session.shutdown();
    killPid(child);
    killPid(decoy);
    rmSync(dir, { recursive: true, force: true });
  }
}

async function expectTransportReaps(trigger: (stdout: PassThrough) => void): Promise<void> {
  let calls = 0;
  let recorded: ChildStop | null = null;
  await withLiveChild({
    wallMs: 120_000,
    terminate: ({ child }) => async () => {
      calls += 1;
      recorded = await stopOwned(child, 300);
      return recorded;
    }
  }, async ({ session, stdout, child, decoy }) => {
    trigger(stdout);
    await flushIo();
    expect(session.snapshot().phase).toBe("closed");
    expect(calls).toBe(1);
    expect(await waitDead(child.pid ?? 0, 1_500)).toBe(true);
    expect(alive(decoy.pid ?? 0)).toBe(true);
    expect(session.snapshot().phase).toBe("closed");
    expect(session.snapshot().timers).toBe(0);
    expect(session.snapshot().pendingClientIds).toEqual([]);
    const shutdown = await Promise.race([
      session.shutdown(),
      delay(1_000).then(() => "hung" as const)
    ]);
    expect(shutdown).not.toBe("hung");
    expect(shutdown).toBe(recorded);
    expect(calls).toBe(1);
    expect(alive(decoy.pid ?? 0)).toBe(true);
  });
}

describe("codex app-server repair boundaries", () => {
  it("pending 达到上限后不再增加未决请求和计时器", async () => {
    const pair = openPair({
      requestTimeoutMs: 5_000,
      frameLimits: { ...DEFAULT_FRAME_LIMITS, maxPending: 2 }
    });
    try {
      await boot(pair);
      await ownThread(pair);
      const first = pair.session.readThread({ taskId: "task-1", threadId: "th-1" });
      const second = pair.session.readThread({ taskId: "task-1", threadId: "th-1" });
      const third = pair.session.readThread({ taskId: "task-1", threadId: "th-1" });
      expect(pair.frames.filter((frame) => frame["method"] === "thread/read")).toHaveLength(2);
      expect(pair.session.snapshot().pendingClientIds).toHaveLength(2);
      expect(pair.session.snapshot().timers).toBeLessThanOrEqual(2);
      const outcome = await Promise.race([third, delay(200).then(() => null)]);
      expect(outcome?.status).toBe("unsent");
      expect(outcome?.reason).toBe("pending_full");
      expect(outcome?.requestId).toBeNull();
      void first;
      void second;
    } finally {
      await pair.session.shutdown();
    }
  });

  it("排队未写出的请求到期后,后续 drain 不再发送这些帧", async () => {
    const gate = new Gate();
    gate.hold = true;
    const stdout = new PassThrough();
    const recorder = new MemoryIntentRecorder();
    const session = openFixtureSession({
      link: { stdin: gate, stdout, stderr: new PassThrough(), onExit: null, terminate: null },
      recorder,
      runId: "backpressure",
      requestTimeoutMs: 40
    });
    try {
      const init = session.initialize();
      const initFrame = JSON.parse(Buffer.concat(gate.chunks).toString("utf8").trim()) as { id?: string };
      stdout.write(line({ id: initFrame.id, result: initResult() }));
      const booted = await init;
      expect(booted.status).toBe("acked");
      const first = session.startThread({ taskId: "task-1" });
      const second = session.startThread({ taskId: "task-2" });
      await delay(160);
      gate.release();
      await delay(30);
      const text = Buffer.concat(gate.chunks).toString("utf8");
      const outcomes = await Promise.race([
        Promise.all([first, second]),
        delay(300).then(() => "pending" as const)
      ]);
      expect(text).not.toContain('"method":"thread/start"');
      expect(text).toContain('"method":"initialized"');
      expect(outcomes).not.toBe("pending");
      if (outcomes !== "pending") {
        expect(outcomes[0]?.status).toBe("unsent");
        expect(outcomes[0]?.reason).toBe("deadline");
        expect(outcomes[1]?.status).toBe("unsent");
        expect(outcomes[1]?.reason).toBe("deadline");
      }
    } finally {
      gate.release();
      await session.shutdown();
    }
  });

  it("旧 steer 超时只绑定原来的轮,新轮保持 active", async () => {
    vi.useFakeTimers();
    try {
      const pair = openPair({ requestTimeoutMs: 1_000 });
      await boot(pair);
      await ownThread(pair);
      await activeTurn(pair);
      const steer = pair.session.steerTurn({
        taskId: "task-1",
        threadId: "th-1",
        expectedTurnId: "tu-1",
        text: "nudge"
      });
      pair.stdout.write(line({
        method: "turn/completed",
        params: { threadId: "th-1", turn: turnBody("tu-1", "completed") }
      }));
      const next = pair.session.startTurn({ taskId: "task-1", threadId: "th-1", text: "next" });
      const request = requestByMethod(pair.frames, "turn/start");
      pair.stdout.write(line({ id: request["id"], result: { turn: turnBody("tu-2", "inProgress") } }));
      const started = await next;
      expect(started.status).toBe("acked");
      await vi.advanceTimersByTimeAsync(1_000);
      const steerOutcome = await steer;
      expect(steerOutcome.status).toBe("unknown");
      expect(pair.frames.some((frame) => frame["method"] === "turn/steer")).toBe(true);
      expect(pair.session.snapshot().threads[0]?.turn?.turnId).toBe("tu-2");
      expect(pair.session.snapshot().threads[0]?.turn?.phase).toBe("active");
      expect(pair.session.snapshot().unknownBlocks).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("同一活动轮上的 steer 超时仍把该轮标成 unknown", async () => {
    vi.useFakeTimers();
    try {
      const pair = openPair({ requestTimeoutMs: 1_000 });
      await boot(pair);
      await ownThread(pair);
      await activeTurn(pair);
      const steer = pair.session.steerTurn({
        taskId: "task-1",
        threadId: "th-1",
        expectedTurnId: "tu-1",
        text: "nudge"
      });
      await vi.advanceTimersByTimeAsync(1_000);
      const outcome = await steer;
      expect(outcome.status).toBe("unknown");
      expect(pair.session.snapshot().threads[0]?.turn?.phase).toBe("unknown");
      const again = await pair.session.startTurn({ taskId: "task-1", threadId: "th-1", text: "later" });
      expect(again.reason).toBe("unknown_blocks");
    } finally {
      vi.useRealTimers();
    }
  });

  it("写出后的畸形 start ACK 保留 unknown 并阻断再次 start", async () => {
    const pair = openPair();
    await boot(pair);
    await ownThread(pair);
    const pending = pair.session.startTurn({ taskId: "task-1", threadId: "th-1", text: "x" });
    const request = requestByMethod(pair.frames, "turn/start");
    pair.stdout.write(line({ id: request["id"], result: { turn: { id: "", status: "nope" } } }));
    const outcome = await pending;
    expect(outcome.status).toBe("unknown");
    expect(pair.session.snapshot().threads[0]?.turn?.phase).toBe("unknown");
    const again = await pair.session.startTurn({ taskId: "task-1", threadId: "th-1", text: "again" });
    expect(again.reason).toBe("unknown_blocks");
    expect(pair.frames.filter((frame) => frame["method"] === "turn/start")).toHaveLength(1);
  });

  it("畸形 steer ACK 与 start 一样是 unknown,不把活动轮留在可继续发送的状态", async () => {
    const pair = openPair();
    await boot(pair);
    await ownThread(pair);
    await activeTurn(pair);
    const pending = pair.session.steerTurn({
      taskId: "task-1",
      threadId: "th-1",
      expectedTurnId: "tu-1",
      text: "nudge"
    });
    const request = requestByMethod(pair.frames, "turn/steer");
    pair.stdout.write(line({ id: request["id"], result: { ok: true } }));
    const outcome = await pending;
    expect(outcome.status).toBe("unknown");
    expect(pair.session.snapshot().threads[0]?.turn?.phase).toBe("unknown");
    const again = await pair.session.steerTurn({
      taskId: "task-1",
      threadId: "th-1",
      expectedTurnId: "tu-1",
      text: "again"
    });
    expect(again.reason).toBe("unknown_blocks");
    expect(pair.frames.filter((frame) => frame["method"] === "turn/steer")).toHaveLength(1);
  });

  it("thread/start 与 resume 的畸形 ACK 也是 unknown,read 的畸形回包不封锁下一次读取", async () => {
    const pair = openPair();
    await boot(pair);
    const started = pair.session.startThread({ taskId: "task-1" });
    const startRequest = requestByMethod(pair.frames, "thread/start");
    pair.stdout.write(line({ id: startRequest["id"], result: { thread: { name: null } } }));
    const startOutcome = await started;
    expect(startOutcome.status).toBe("unknown");
    const blocked = await pair.session.startThread({ taskId: "task-1" });
    expect(blocked.reason).toBe("unknown_blocks");
    expect(pair.frames.filter((frame) => frame["method"] === "thread/start")).toHaveLength(1);

    const owned = openPair();
    await boot(owned);
    await ownThread(owned);
    const resumed = owned.session.resumeThread({ taskId: "task-1", threadId: "th-1" });
    const resumeRequest = requestByMethod(owned.frames, "thread/resume");
    owned.stdout.write(line({ id: resumeRequest["id"], result: { thread: { id: "other" } } }));
    const resumeOutcome = await resumed;
    expect(resumeOutcome.status).toBe("unknown");
    const resumeAgain = await owned.session.resumeThread({ taskId: "task-1", threadId: "th-1" });
    expect(resumeAgain.reason).toBe("unknown_blocks");
    expect(owned.frames.filter((frame) => frame["method"] === "thread/resume")).toHaveLength(1);

    const reading = openPair();
    await boot(reading);
    await ownThread(reading);
    const read = reading.session.readThread({ taskId: "task-1", threadId: "th-1" });
    const readRequest = requestByMethod(reading.frames, "thread/read");
    reading.stdout.write(line({ id: readRequest["id"], result: { missing: true } }));
    const readOutcome = await read;
    expect(readOutcome.status).toBe("rejected");
    expect(reading.session.snapshot().unknownBlocks).toBe(0);
    const readAgain = reading.session.readThread({ taskId: "task-1", threadId: "th-1" });
    expect(reading.frames.filter((frame) => frame["method"] === "thread/read")).toHaveLength(2);
    reading.stdout.end();
    await readAgain;
  });

  it("跨 task 的 read/resume/start/steer/interrupt 都不写出", async () => {
    const pair = openPair({ requestTimeoutMs: 5_000 });
    try {
      await boot(pair);
      await ownThread(pair);
      await activeTurn(pair);
      const before = pair.frames.length;
      const read = pair.session.readThread({ taskId: "task-2", threadId: "th-1" });
      const resume = pair.session.resumeThread({ taskId: "task-2", threadId: "th-1" });
      const start = pair.session.startTurn({ taskId: "task-2", threadId: "th-1", text: "x" });
      const steer = pair.session.steerTurn({
        taskId: "task-2",
        threadId: "th-1",
        expectedTurnId: "tu-1",
        text: "y"
      });
      const interrupt = pair.session.interruptTurn({ taskId: "task-2", threadId: "th-1", turnId: "tu-1" });
      const outcomes = await Promise.race([
        Promise.all([read, resume, start, steer, interrupt]),
        delay(200).then(() => "pending" as const)
      ]);
      expect(outcomes).not.toBe("pending");
      if (outcomes !== "pending") {
        for (const outcome of outcomes) {
          expect(outcome.status).toBe("unsent");
          expect(outcome.reason).toBe("task_mismatch");
        }
      }
      expect(pair.frames).toHaveLength(before);
      expect(pair.session.snapshot().threads[0]?.turn?.phase).toBe("active");
      expect(pair.recorder.records.some((record) => record.taskId === "task-2")).toBe(false);
    } finally {
      await pair.session.shutdown();
    }
  });

  it("userAgent 只取 CLI 版本,OS 和 client 版本不参与", () => {
    expect(userAgentVersions(OBSERVED_USER_AGENT)).toEqual([PINNED_CODEX_CLI_VERSION]);
    expect(userAgentVersions("saydo-codex-as-spike/0.153.3 (Mac OS 99.1.2; arm64) dumb (other-client; 8.8.8)")).toEqual([
      "0.153.3"
    ]);
    expect(userAgentVersions("saydo-codex-as-spike/0.9.0 (Mac OS 27.2.0; arm64) dumb (saydo-codex-as-spike; 0.0.1)")).toEqual([
      "0.9.0"
    ]);
    expect(userAgentVersions("codex-cli")).toEqual([]);
  });

  it("gate-2-1 的 Codex Desktop userAgent 只取最前产品版本", () => {
    expect(userAgentVersions(GATE2_USER_AGENT)).toEqual([PINNED_CODEX_CLI_VERSION]);
    expect(userAgentVersions(GATE2_USER_AGENT)).not.toContain("27.2.0");
    expect(userAgentVersions(GATE2_USER_AGENT)).not.toContain("0.0.1");
    expect(userAgentVersions("Codex Desktop/0.9.0 (Mac OS 0.153.3; arm64) dumb (saydo-codex-as-spike; 0.153.3)")).toEqual([
      "0.9.0"
    ]);
    expect(userAgentVersions("Codex Desktop (Mac OS 0.153.3; arm64) dumb (saydo-codex-as-spike; 0.153.3)")).toEqual([]);
    expect(userAgentVersions("Codex Desktop/0.153.30 (Mac OS 27.2.0; arm64) dumb (client; 0.0.1)")).toEqual(["0.153.30"]);
    expect(userAgentVersions("Codex Desktop/0.153.3.1 (Mac OS 27.2.0; arm64)")).toEqual([]);
    expect(userAgentVersions("Codex Desktop/v0.153.3 (Mac OS 27.2.0; arm64)")).toEqual([]);
    expect(userAgentVersions("Codex Desktop/0.9.0 other/0.153.3 (Mac OS 27.2.0; arm64)")).toEqual(["0.9.0"]);
  });

  it("真实形状的 userAgent 可以握手,CLI 版本不符或无法解析则拒绝", async () => {
    const dir = mkdtempSync(join(tmpdir(), "saydo-codex-ua-"));
    const observed = answeringSpawn(OBSERVED_USER_AGENT);
    const ok = await runHandshake({
      intentLogPath: join(dir, "ok.jsonl"),
      versionImpl: () => versionText(),
      spawnImpl: (spec) => {
        expect(spec.argv).toEqual(APP_SERVER_ARGV);
        return observed.spawned;
      }
    });
    expect(ok.ok).toBe(true);
    expect(ok.reason).toBe("ok");
    expect(observed.terminated()).toBe(true);

    const mismatched = answeringSpawn("saydo-codex-as-spike/0.9.0 (Mac OS 27.2.0; arm64) dumb (saydo-codex-as-spike; 0.0.1)");
    const agent = await runHandshake({
      intentLogPath: join(dir, "bad.jsonl"),
      versionImpl: () => versionText(),
      spawnImpl: () => mismatched.spawned
    });
    expect(agent.ok).toBe(false);
    expect(agent.reason).toBe("user_agent_version_mismatch");
    expect(agent.cliVersionOk).toBe(true);

    const blank = answeringSpawn("codex-cli");
    const unparsed = await runHandshake({
      intentLogPath: join(dir, "blank.jsonl"),
      versionImpl: () => versionText(),
      spawnImpl: () => blank.spawned
    });
    expect(unparsed.ok).toBe(false);
    expect(unparsed.reason).toBe("user_agent_version_mismatch");

    const cli = await runHandshake({
      intentLogPath: join(dir, "cli.jsonl"),
      versionImpl: () => versionText("0.153.4"),
      spawnImpl: () => {
        throw new Error("spawned");
      }
    });
    expect(cli.spawned).toBe(false);
    expect(cli.reason).toBe("version_mismatch");
  });

  it("gate-2-1 含空格的产品名可以握手,缺失或错误版本仍拒绝", async () => {
    const dir = mkdtempSync(join(tmpdir(), "saydo-codex-ua-desktop-"));
    const observed = answeringSpawn(GATE2_USER_AGENT);
    const ok = await runHandshake({
      intentLogPath: join(dir, "ok.jsonl"),
      versionImpl: () => versionText(),
      spawnImpl: (spec) => {
        expect(spec.argv).toEqual(APP_SERVER_ARGV);
        return observed.spawned;
      }
    });
    expect(ok.ok).toBe(true);
    expect(ok.reason).toBe("ok");
    expect(ok.cliVersionOk).toBe(true);
    expect(ok.initializeAcked).toBe(true);
    expect(ok.initializedSent).toBe(true);
    expect(ok.userAgentRedacted).toBe(GATE2_USER_AGENT);
    expect(observed.terminated()).toBe(true);

    const mismatched = answeringSpawn(
      "Codex Desktop/0.9.0 (Mac OS 0.153.3; arm64) dumb (saydo-codex-as-spike; 0.153.3)"
    );
    const agent = await runHandshake({
      intentLogPath: join(dir, "bad.jsonl"),
      versionImpl: () => versionText(),
      spawnImpl: () => mismatched.spawned
    });
    expect(agent.ok).toBe(false);
    expect(agent.reason).toBe("user_agent_version_mismatch");
    expect(agent.cliVersionOk).toBe(true);
    expect(agent.initializeAcked).toBe(true);
    expect(agent.userAgentRedacted).toContain("Codex Desktop/0.9.0");

    const blank = answeringSpawn("Codex Desktop (Mac OS 0.153.3; arm64) dumb (saydo-codex-as-spike; 0.153.3)");
    const unparsed = await runHandshake({
      intentLogPath: join(dir, "blank.jsonl"),
      versionImpl: () => versionText(),
      spawnImpl: () => blank.spawned
    });
    expect(unparsed.ok).toBe(false);
    expect(unparsed.reason).toBe("user_agent_version_mismatch");
    expect(unparsed.spawned).toBe(true);

    const prefixed = answeringSpawn("Codex Desktop/0.153.30 (Mac OS 27.2.0; arm64) dumb (client; 0.0.1)");
    const longer = await runHandshake({
      intentLogPath: join(dir, "longer.jsonl"),
      versionImpl: () => versionText(),
      spawnImpl: () => prefixed.spawned
    });
    expect(longer.ok).toBe(false);
    expect(longer.reason).toBe("user_agent_version_mismatch");

    const dotted = answeringSpawn("Codex Desktop/0.153.3.1 (Mac OS 27.2.0; arm64)");
    const extra = await runHandshake({
      intentLogPath: join(dir, "extra.jsonl"),
      versionImpl: () => versionText(),
      spawnImpl: () => dotted.spawned
    });
    expect(extra.ok).toBe(false);
    expect(extra.reason).toBe("user_agent_version_mismatch");
  });

  it("墙钟到期后关闭活动轮和在途请求,并停掉所属进程", async () => {
    const issuedAt = Date.now();
    const permit = issueExperimentPermit({
      enabled: true,
      model: "named-model",
      effectBoundary: "deny-exec-file-permissions",
      maxTurns: 1,
      wallMs: 1_000
    }, issuedAt);
    expect(permit.ok).toBe(true);
    if (!permit.ok) return;
    const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000);"], {
      detached: true,
      stdio: "ignore"
    });
    const decoy = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000);"], {
      detached: true,
      stdio: "ignore"
    });
    child.on("error", () => undefined);
    decoy.on("error", () => undefined);
    const pair = createPair();
    let terminated = false;
    pair.link.terminate = async (opts) => {
      terminated = true;
      if (child.pid && child.exitCode === null) {
        try {
          child.kill("SIGTERM");
        } catch {
          // 进程已经退出
        }
      }
      const deadline = Date.now() + opts.termMs;
      while (alive(child.pid ?? 0) && Date.now() < deadline) await delay(20);
      if (alive(child.pid ?? 0)) {
        child.kill("SIGKILL");
        return { sigkill: true, exitCode: child.exitCode, signal: "SIGKILL" };
      }
      return { sigkill: false, exitCode: child.exitCode, signal: "SIGTERM" };
    };
    const dir = mkdtempSync(join(tmpdir(), "saydo-codex-wall-"));
    const session = openRealSession({
      link: pair.link,
      intentLogPath: join(dir, "intent.jsonl"),
      runId: "wall",
      permit: permit.permit,
      requestTimeoutMs: 20_000,
      now: () => Date.now(),
      termMs: 300
    });
    const armed = { ...pair, session };
    try {
      await boot(armed);
      await ownThread(armed);
      await activeTurn(armed);
      const hanging = session.readThread({ taskId: "task-1", threadId: "th-1" });
      const settled = await Promise.race([
        hanging.then((value) => ({ kind: "settled" as const, value })),
        delay(3_000).then(() => ({ kind: "still" as const }))
      ]);
      expect(settled.kind).toBe("settled");
      if (settled.kind === "settled") expect(settled.value.status).toBe("unknown");
      expect(session.snapshot().phase).toBe("closed");
      expect(session.snapshot().timers).toBe(0);
      expect(session.snapshot().pendingClientIds).toEqual([]);
      expect(session.snapshot().threads[0]?.turn?.phase).toBe("unknown");
      expect(terminated).toBe(true);
      const deadline = Date.now() + 1_000;
      while (alive(child.pid ?? 0) && Date.now() < deadline) await delay(20);
      expect(alive(child.pid ?? 0)).toBe(false);
      expect(alive(decoy.pid ?? 0)).toBe(true);
    } finally {
      await session.shutdown();
      killPid(child);
      killPid(decoy);
    }
  }, 10_000);

  it("stdout 只发 close 时 pending 会结束,没有挂起", async () => {
    const pair = openPair({ requestTimeoutMs: 10_000 });
    const errors: string[] = [];
    const onUncaught = (error: Error) => {
      errors.push(error.message);
    };
    process.on("uncaughtException", onUncaught);
    try {
      const pending = pair.session.initialize();
      pair.stdout.destroy();
      const outcome = await Promise.race([
        pending,
        delay(400).then(() => ({ status: "pending" as const, reason: "still_pending", requestId: null, value: null }))
      ]);
      expect(outcome.status).toBe("unknown");
      expect(pair.session.snapshot().phase).toBe("closed");
      expect(pair.session.snapshot().timers).toBe(0);
      expect(pair.session.snapshot().pendingClientIds).toEqual([]);
      expect(errors).toEqual([]);
    } finally {
      process.off("uncaughtException", onUncaught);
      await pair.session.shutdown();
    }
  });

  it("B1 背压期间两个 thread 的 turn/start 最多占用 maxTurns=1", async () => {
    await withRealTurns({ maxTurns: 1, threads: ["th-1", "th-2"] }, async ({ gate, session }) => {
      gate.hold = true;
      const read = session.readThread({ taskId: "task-1", threadId: "th-1" });
      const first = session.startTurn({ taskId: "task-1", threadId: "th-1", text: "one" });
      const second = await Promise.race([
        session.startTurn({ taskId: "task-1", threadId: "th-2", text: "two" }),
        delay(200).then(() => "pending" as const)
      ]);
      expect(turnStartCount(gate)).toBe(0);
      expect(session.snapshot().realTurnFrames).toBe(0);
      expect(second).not.toBe("pending");
      if (second === "pending") return;
      expect(second.status).toBe("unsent");
      expect(second.reason).toBe("experiment_budget");
      gate.release();
      await delay(20);
      expect(turnStartCount(gate)).toBe(1);
      expect(session.snapshot().realTurnFrames).toBe(1);
      void read;
      void first;
    });
  });

  it("B1 背压期间三个 thread 的 turn/start 最多占用 maxTurns=2", async () => {
    await withRealTurns({ maxTurns: 2, threads: ["th-1", "th-2", "th-3"] }, async ({ gate, session }) => {
      gate.hold = true;
      const read = session.readThread({ taskId: "task-1", threadId: "th-1" });
      const first = session.startTurn({ taskId: "task-1", threadId: "th-1", text: "one" });
      const second = session.startTurn({ taskId: "task-1", threadId: "th-2", text: "two" });
      const third = await Promise.race([
        session.startTurn({ taskId: "task-1", threadId: "th-3", text: "three" }),
        delay(200).then(() => "pending" as const)
      ]);
      expect(session.snapshot().realTurnFrames).toBe(0);
      expect(third).not.toBe("pending");
      if (third === "pending") return;
      expect(third.reason).toBe("experiment_budget");
      gate.release();
      await delay(20);
      expect(turnStartCount(gate)).toBe(2);
      expect(session.snapshot().realTurnFrames).toBe(2);
      void read;
      void first;
      void second;
    });
  });

  it("B1 取消排队 turn 只退回一次,并发不会超过剩余额度", async () => {
    vi.useFakeTimers();
    try {
      await withRealTurns({
        maxTurns: 2,
        requestTimeoutMs: 200,
        threads: ["th-1", "th-2", "th-3"]
      }, async ({ gate, session }) => {
        gate.hold = true;
        const read = session.readThread({ taskId: "task-1", threadId: "th-1" });
        const first = session.startTurn({ taskId: "task-1", threadId: "th-1", text: "first" });
        await vi.advanceTimersByTimeAsync(120);
        const second = session.startTurn({ taskId: "task-1", threadId: "th-2", text: "second" });
        await vi.advanceTimersByTimeAsync(80);
        const cancelled = await first;
        expect(cancelled.status).toBe("unsent");
        expect(cancelled.reason).toBe("deadline");
        expect(session.snapshot().realTurnFrames).toBe(0);
        expect(turnStartCount(gate)).toBe(0);
        const third = session.startTurn({ taskId: "task-1", threadId: "th-3", text: "third" });
        const fourth = await settledOrPending(session.startTurn({ taskId: "task-1", threadId: "th-1", text: "fourth" }));
        expect(fourth).not.toBe("pending");
        if (fourth === "pending") return;
        expect(fourth.reason).toBe("experiment_budget");
        expect(session.snapshot().realTurnFrames).toBe(0);
        gate.release();
        await vi.advanceTimersByTimeAsync(1);
        expect(turnStartCount(gate)).toBe(2);
        expect(session.snapshot().realTurnFrames).toBe(2);
        void read;
        void second;
        void third;
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("B1 队列满的未写失败退回预占,之后仍只能写到授权次数", async () => {
    await withRealTurns({
      maxTurns: 1,
      maxQueued: 1,
      threads: ["th-1", "th-2"],
      requestTimeoutMs: 5_000
    }, async ({ gate, session }) => {
      gate.hold = true;
      const read1 = session.readThread({ taskId: "task-1", threadId: "th-1" });
      const read2 = session.readThread({ taskId: "task-1", threadId: "th-1" });
      const failed = await session.startTurn({ taskId: "task-1", threadId: "th-1", text: "full" });
      expect(failed.status).toBe("unsent");
      expect(failed.reason).toBe("outbound_full");
      expect(session.snapshot().realTurnFrames).toBe(0);
      expect(turnStartCount(gate)).toBe(0);
      gate.release();
      const first = session.startTurn({ taskId: "task-1", threadId: "th-1", text: "one" });
      const second = await session.startTurn({ taskId: "task-1", threadId: "th-2", text: "two" });
      expect(session.snapshot().realTurnFrames).toBe(1);
      expect(second.reason).toBe("experiment_budget");
      expect(turnStartCount(gate)).toBe(1);
      void read1;
      void read2;
      void first;
    });
  });

  it("B1 已写出的 turn 遇到错误或 unknown 不退回额度", async () => {
    await withRealTurns({ maxTurns: 1, threads: ["th-1"], requestTimeoutMs: 5_000 }, async ({ gate, stdout, session }) => {
      const pending = session.startTurn({ taskId: "task-1", threadId: "th-1", text: "budget-body" });
      const request = [...gateFrames(gate)].reverse().find((frame) => frame["method"] === "turn/start");
      expect(request).toBeTruthy();
      stdout.write(line({ id: request?.["id"], error: { code: -32000, message: "nope" } }));
      const rejected = await pending;
      expect(rejected.status).toBe("rejected");
      expect(session.snapshot().realTurnFrames).toBe(1);
      expect(session.snapshot().threads[0]?.turn).toBeNull();
      const over = await session.startTurn({ taskId: "task-1", threadId: "th-1", text: "more" });
      expect(over.reason).toBe("experiment_budget");
      expect(turnStartCount(gate)).toBe(1);
    });

    await withRealTurns({ maxTurns: 1, threads: ["th-1"], requestTimeoutMs: 40 }, async ({ gate, stdout, session }) => {
      const pending = session.startTurn({ taskId: "task-1", threadId: "th-1", text: "timeout-body" });
      const outcome = await Promise.race([pending, delay(300).then(() => "pending" as const)]);
      expect(outcome).not.toBe("pending");
      if (outcome === "pending") return;
      expect(outcome.status).toBe("unknown");
      expect(session.snapshot().realTurnFrames).toBe(1);
      expect(session.snapshot().threads[0]?.turn?.phase).toBe("unknown");
      stdout.write(line({
        method: "turn/completed",
        params: { threadId: "th-1", turn: turnBody("tu-late", "failed") }
      }));
      expect(session.snapshot().threads[0]?.turn?.phase).toBe("terminal");
      expect(session.snapshot().unknownBlocks).toBe(0);
      const over = await session.startTurn({ taskId: "task-1", threadId: "th-1", text: "more" });
      expect(over.reason).toBe("experiment_budget");
      expect(turnStartCount(gate)).toBe(1);
    });
  });

  it("B2 interrupt 的 null 结果不是 ACK,并阻断其他 thread", async () => {
    await expectMalformedInterrupt(null);
  });

  it("B2 interrupt 的 number 结果不是 ACK,并阻断其他 thread", async () => {
    await expectMalformedInterrupt(1);
  });

  it("B2 interrupt 的 array 结果不是 ACK,并阻断其他 thread", async () => {
    await expectMalformedInterrupt([]);
  });

  it("B2 先终态后畸形 interrupt ACK 不复活终态", async () => {
    const pair = openPair();
    try {
      await boot(pair);
      await ownThread(pair);
      await activeTurn(pair);
      const pending = pair.session.interruptTurn({ taskId: "task-1", threadId: "th-1", turnId: "tu-1" });
      const request = requestByMethod(pair.frames, "turn/interrupt");
      pair.stdout.write(line({
        method: "turn/completed",
        params: { threadId: "th-1", turn: turnBody("tu-1", "interrupted") }
      }));
      const before = pair.session.snapshot().threads[0]?.turn;
      expect(before?.phase).toBe("terminal");
      expect(before?.interruptConfirmed).toBe(true);
      expect(before?.upstreamTerminal).toBe(true);
      pair.stdout.write(line({ id: request["id"], result: null }));
      const outcome = await pending;
      expect(outcome.status).toBe("unknown");
      expect(outcome.reason).toBe("protocol_error");
      const after = pair.session.snapshot().threads[0]?.turn;
      expect(after?.phase).toBe("terminal");
      expect(after?.terminalStatus).toBe("interrupted");
      expect(after?.interruptConfirmed).toBe(true);
      expect(after?.interruptAcked).toBe(false);
      expect(after?.turnId).toBe("tu-1");
      expect(pair.session.snapshot().unknownBlocks).toBe(0);
      const next = pair.session.startTurn({ taskId: "task-1", threadId: "th-1", text: "next" });
      const start = requestByMethod(pair.frames, "turn/start");
      pair.stdout.write(line({ id: start["id"], result: { turn: turnBody("tu-2", "inProgress") } }));
      const started = await next;
      expect(started.status).toBe("acked");
      expect(pair.session.snapshot().threads[0]?.turn?.turnId).toBe("tu-2");
      expect(pair.session.snapshot().threads[0]?.turn?.phase).toBe("active");
      expect(pair.session.snapshot().unknownBlocks).toBe(0);
    } finally {
      await pair.session.shutdown();
    }
  });

  it("B2 迟到畸形 interrupt ACK 不污染新轮", async () => {
    const pair = openPair();
    try {
      await boot(pair);
      await ownThread(pair);
      await activeTurn(pair);
      const pending = pair.session.interruptTurn({ taskId: "task-1", threadId: "th-1", turnId: "tu-1" });
      const request = requestByMethod(pair.frames, "turn/interrupt");
      pair.stdout.write(line({
        method: "turn/completed",
        params: { threadId: "th-1", turn: turnBody("tu-1", "interrupted") }
      }));
      const next = pair.session.startTurn({ taskId: "task-1", threadId: "th-1", text: "next" });
      const start = requestByMethod(pair.frames, "turn/start");
      pair.stdout.write(line({ id: start["id"], result: { turn: turnBody("tu-2", "inProgress") } }));
      const started = await next;
      expect(started.status).toBe("acked");
      pair.stdout.write(line({ id: request["id"], result: ["late"] }));
      const outcome = await pending;
      expect(outcome.status).toBe("unknown");
      expect(outcome.reason).toBe("protocol_error");
      const turn = pair.session.snapshot().threads[0]?.turn;
      expect(turn?.turnId).toBe("tu-2");
      expect(turn?.phase).toBe("active");
      expect(turn?.interruptAcked).toBe(false);
      expect(turn?.interruptConfirmed).toBe(false);
      expect(pair.session.snapshot().unknownBlocks).toBe(0);
      const steer = pair.session.steerTurn({
        taskId: "task-1",
        threadId: "th-1",
        expectedTurnId: "tu-2",
        text: "stay"
      });
      const steerFrame = requestByMethod(pair.frames, "turn/steer");
      pair.stdout.write(line({ id: steerFrame["id"], result: { turnId: "tu-2" } }));
      const steered = await steer;
      expect(steered.status).toBe("acked");
      expect(pair.session.snapshot().threads[0]?.turn?.turnId).toBe("tu-2");
      expect(pair.session.snapshot().threads[0]?.turn?.phase).toBe("active");
    } finally {
      await pair.session.shutdown();
    }
  });

  it("R3-B1 terminal-first 畸形 steer ACK 不阻断新轮 interrupt", async () => {
    await expectStaleSteer("malformed", "terminal-first");
  });

  it("R3-B1 terminal-first 冲突 steer ACK 不阻断新轮 interrupt", async () => {
    await expectStaleSteer("mismatch", "terminal-first");
  });

  it("R3-B1 新轮 first 后畸形 steer ACK 不复活旧轮", async () => {
    await expectStaleSteer("malformed", "new-turn-first");
  });

  it("R3-B1 新轮 first 后冲突 steer ACK 不复活旧轮", async () => {
    await expectStaleSteer("mismatch", "new-turn-first");
  });

  it("R3-B1 其他 thread 不受旧 steer 畸形 ACK 阻断", async () => {
    await expectStaleSteer("malformed", "other-thread");
  });

  it("R3-B1 其他 thread 不受旧 steer 冲突 ACK 阻断", async () => {
    await expectStaleSteer("mismatch", "other-thread");
  });

  it("R3-B1 旧 steer 畸形 ACK 不清除另一条真实 unknown", async () => {
    await expectPreservedUnknown("malformed");
  });

  it("R3-B1 旧 steer 冲突 ACK 不清除另一条真实 unknown", async () => {
    await expectPreservedUnknown("mismatch");
  });

  it("R3-B1 同一未终态轮的冲突 steer ACK 仍阻断", async () => {
    const pair = openPair();
    try {
      await boot(pair);
      await ownThread(pair);
      await activeTurn(pair);
      const pending = pair.session.steerTurn({
        taskId: "task-1",
        threadId: "th-1",
        expectedTurnId: "tu-1",
        text: "nudge"
      });
      const request = requestByMethod(pair.frames, "turn/steer");
      pair.stdout.write(line({ id: request["id"], result: { turnId: "tu-other" } }));
      const outcome = await pending;
      expect(outcome.status).toBe("unknown");
      expect(outcome.reason).toBe("ack_conflict");
      expect(pair.session.snapshot().threads[0]?.turn?.phase).toBe("unknown");
      expect(pair.session.snapshot().threads[0]?.turn?.turnId).toBe("tu-1");
      expect(pair.session.snapshot().unknownBlocks).toBe(1);
      const blocked = await pair.session.interruptTurn({ taskId: "task-1", threadId: "th-1", turnId: "tu-1" });
      expect(blocked.status).toBe("unsent");
      expect(blocked.reason).toBe("unknown_blocks");
      expect(pair.frames.filter((frame) => frame["method"] === "turn/interrupt")).toHaveLength(0);
    } finally {
      await pair.session.shutdown();
    }
  });

  it("R3-B2 stdout EOF 会终止所属进程且不杀旁路", async () => {
    await expectTransportReaps((stdout) => {
      stdout.push(null);
    });
  });

  it("R3-B2 stdout close 会终止所属进程且不杀旁路", async () => {
    await expectTransportReaps((stdout) => {
      stdout.destroy();
    });
  });

  it("R3-B2 stdout error 会终止所属进程且不杀旁路", async () => {
    await expectTransportReaps((stdout) => {
      stdout.destroy(new Error("boom"));
    });
  });

  it("R3-B2 传输关闭的同步递归里 shutdown 不挂起", async () => {
    let calls = 0;
    let recorded: ChildStop | null = null;
    await withLiveChild({
      wallMs: 120_000,
      terminate: ({ child, stdout, session }) => async () => {
        calls += 1;
        stdout.on("error", () => undefined);
        stdout.push(null);
        stdout.destroy(new Error("reenter"));
        const nested = await Promise.race([
          session().shutdown(),
          delay(400).then(() => "hung" as const)
        ]);
        if (nested === "hung") throw new Error("nested shutdown hung");
        recorded = await stopOwned(child, 300);
        return recorded;
      }
    }, async ({ session, stdout, child, decoy }) => {
      stdout.push(null);
      await flushIo();
      expect(session.snapshot().phase).toBe("closed");
      expect(calls).toBe(1);
      expect(await waitDead(child.pid ?? 0, 1_500)).toBe(true);
      const shutdown = await Promise.race([
        session.shutdown(),
        delay(1_000).then(() => "hung" as const)
      ]);
      expect(shutdown).not.toBe("hung");
      expect(shutdown).toBe(recorded);
      expect(calls).toBe(1);
      expect(alive(decoy.pid ?? 0)).toBe(true);
      expect(session.snapshot().timers).toBe(0);
      expect(session.snapshot().phase).toBe("closed");
    });
  });

  it("R3-B2 deadline 与 close、shutdown 共用同一次 terminate", async () => {
    let calls = 0;
    let release = (): void => undefined;
    let releaseStarted = (): void => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      releaseStarted = resolve;
    });
    try {
      await withLiveChild({
        wallMs: 3_000,
        terminate: ({ child }) => async () => {
          calls += 1;
          releaseStarted();
          await gate;
          return stopOwned(child, 300);
        }
      }, async ({ session, stdout, child, decoy }) => {
        try {
          await Promise.race([
            started,
            delay(6_000).then(() => {
              throw new Error("deadline did not terminate");
            })
          ]);
          expect(calls).toBe(1);
          stdout.destroy();
          const shutting = session.shutdown();
          await delay(40);
          expect(calls).toBe(1);
          release();
          const result = await Promise.race([
            shutting,
            delay(2_000).then(() => "hung" as const)
          ]);
          expect(result).not.toBe("hung");
          expect(calls).toBe(1);
          expect(alive(child.pid ?? 0)).toBe(false);
          expect(alive(decoy.pid ?? 0)).toBe(true);
          expect(session.snapshot().timers).toBe(0);
          expect(session.snapshot().phase).toBe("closed");
        } finally {
          release();
        }
      });
    } finally {
      release();
    }
  }, 12_000);

  it("R3-B2 terminate 拒绝时 shutdown 不挂起且不杀旁路", async () => {
    let calls = 0;
    await withLiveChild({
      wallMs: 120_000,
      terminate: () => async () => {
        calls += 1;
        throw new Error("refuse_kill_unowned");
      }
    }, async ({ session, stdout, child, decoy }) => {
      stdout.destroy(new Error("boom"));
      await flushIo();
      expect(session.snapshot().phase).toBe("closed");
      expect(calls).toBe(1);
      const result = await Promise.race([
        session.shutdown(),
        delay(800).then(() => "hung" as const)
      ]);
      expect(result).toBeNull();
      expect(calls).toBe(1);
      expect(alive(child.pid ?? 0)).toBe(true);
      expect(alive(decoy.pid ?? 0)).toBe(true);
      expect(session.snapshot().phase).toBe("closed");
      expect(session.snapshot().timers).toBe(0);
    });
  });

  it("spawn error 不会变成未处理异常", () => {
    const tsx = fileURLToPath(new URL("../../node_modules/tsx/dist/cli.mjs", import.meta.url));
    const source = fileURLToPath(new URL("../../src/experimental/codex-app-server/processControl.ts", import.meta.url));
    const missing = join(tmpdir(), `saydo-codex-missing-${process.pid}`);
    const code = `
      import { spawnAppServer } from ${JSON.stringify(source)};
      try {
        spawnAppServer(${JSON.stringify(missing)});
        process.exit(3);
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("spawn_failed")) process.exit(2);
      }
      setTimeout(() => process.exit(0), 150);
    `;
    const result = spawnSync(process.execPath, [tsx, "--input-type=module", "-e", code], {
      encoding: "utf8",
      timeout: 8_000
    });
    expect(result.status).toBe(0);
    expect(`${result.stderr ?? ""}`).not.toContain("Unhandled");
    expect(`${result.stderr ?? ""}`).not.toContain("spawn_failed");
  });

  it("R4-B1 interrupt 空 object 没有 turnId 冲突项", () => {
    expect(ackMatrix().some((cell) => cell.op === "interrupt" && cell.kind === "conflict")).toBe(false);
    expect(ackMatrix()).toHaveLength(24);
    expect(staleAckMatrix()).toHaveLength(16);
  });

  it.each(ackMatrix())("R4-B1 $op $state $kind", async (cell) => {
    await expectAckCell(cell, false);
  });

  it.each(staleAckMatrix())("R4-B1 已有 unknown 仍阻断 $op $state $kind", async (cell) => {
    await expectAckCell(cell, true);
  });
});
