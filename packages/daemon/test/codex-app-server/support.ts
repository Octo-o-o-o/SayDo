import { PassThrough, Writable } from "node:stream";
import { ByteLineFramer, DEFAULT_FRAME_LIMITS, asBuffer } from "../../src/experimental/codex-app-server/framing.js";
import type { StdioLink } from "../../src/experimental/codex-app-server/link.js";
import { MemoryIntentRecorder } from "../../src/experimental/codex-app-server/intentLog.js";
import { openFixtureSession, type CodexAppServerSession } from "../../src/experimental/codex-app-server/session.js";

export function line(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value)}\n`);
}

export function threadBody(id: string): Record<string, unknown> {
  return {
    id,
    cliVersion: "0.153.3",
    model: null,
    name: null,
    turns: [],
    preview: "",
    ephemeral: true,
    createdAt: 1,
    updatedAt: 1,
    modelProvider: "openai",
    sessionId: "sess",
    source: "appServer",
    status: { type: "idle" },
    cwd: "/tmp/spike",
    projectId: null
  };
}

export function turnBody(id: string, status: string): Record<string, unknown> {
  return {
    id,
    status,
    items: [],
    completedAt: null,
    durationMs: null,
    startedAt: null,
    error: null
  };
}

export function initResult(userAgent = "codex-cli/0.153.3"): Record<string, unknown> {
  return {
    userAgent,
    codexHome: "/tmp/spike-codex-home",
    platformFamily: "unix",
    platformOs: "macos"
  };
}

export interface Pair {
  link: StdioLink;
  stdout: PassThrough;
  frames: Array<Record<string, unknown>>;
  recorder: MemoryIntentRecorder;
}

export function createPair(limits = DEFAULT_FRAME_LIMITS): Pair {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const frames: Array<Record<string, unknown>> = [];
  const framer = new ByteLineFramer(limits);
  stdin.on("data", (chunk: Buffer | string) => {
    const batch = framer.push(asBuffer(chunk));
    for (const message of batch.messages) {
      if (message !== null && typeof message === "object") frames.push(message as Record<string, unknown>);
    }
  });
  return {
    link: { stdin, stdout, stderr, onExit: null, terminate: null },
    stdout,
    frames,
    recorder: new MemoryIntentRecorder()
  };
}

export function openPair(opts: {
  requestTimeoutMs?: number;
  frameLimits?: typeof DEFAULT_FRAME_LIMITS;
  now?: () => number;
} = {}): Pair & { session: CodexAppServerSession } {
  const pair = createPair(opts.frameLimits);
  const session = openFixtureSession({
    link: pair.link,
    recorder: pair.recorder,
    runId: "run-1",
    ...(opts.requestTimeoutMs !== undefined ? { requestTimeoutMs: opts.requestTimeoutMs } : {}),
    ...(opts.frameLimits !== undefined ? { frameLimits: opts.frameLimits } : {}),
    ...(opts.now !== undefined ? { now: opts.now } : {})
  });
  return { ...pair, session };
}

export async function boot(pair: Pair & { session: CodexAppServerSession }, userAgent?: string): Promise<void> {
  const pending = pair.session.initialize();
  const request = pair.frames[0];
  if (!request) throw new Error("missing initialize");
  pair.stdout.write(line({ id: request["id"], result: initResult(userAgent) }));
  const outcome = await pending;
  if (outcome.status !== "acked") throw new Error(outcome.reason);
}

export async function ownThread(pair: Pair & { session: CodexAppServerSession }, threadId = "th-1"): Promise<void> {
  const pending = pair.session.startThread({ taskId: "task-1" });
  const request = pair.frames.at(-1);
  if (!request) throw new Error("missing thread/start");
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

export function requestByMethod(frames: Array<Record<string, unknown>>, method: string): Record<string, unknown> {
  const found = [...frames].reverse().find((frame) => frame["method"] === method);
  if (!found) throw new Error(`missing ${method}`);
  return found;
}

export class Gate extends Writable {
  readonly chunks: Buffer[] = [];
  hold = false;
  private waiters: Array<() => void> = [];

  constructor() {
    super({ highWaterMark: 1 });
  }

  override _write(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    this.chunks.push(Buffer.from(chunk));
    if (this.hold) this.waiters.push(() => callback());
    else callback();
  }

  release(): void {
    this.hold = false;
    const pending = this.waiters.splice(0);
    for (const resume of pending) resume();
  }
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
