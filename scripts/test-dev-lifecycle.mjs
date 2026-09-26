#!/usr/bin/env node
// dev.mjs 生命周期回归:隔离假子进程 + 注入 health,不碰用户真实端口/服务。
// 不假设 kill() 立刻 exit;默认忽略 SIGTERM,仅在升级 SIGKILL 或显式 exit 时结束。
import { EventEmitter } from "node:events";
import { createDevController, DEFAULT_HEALTH_TOTAL_MS } from "./dev.mjs";

class FakeChild extends EventEmitter {
  constructor(file, args, behavior = {}) {
    super();
    this.file = file;
    this.args = args;
    this.killed = false;
    this.killSignal = null;
    this.killSignals = [];
    this.exitCode = null;
    this.signalCode = null;
    this.pid = 71_000 + FakeChild.nextPid;
    FakeChild.nextPid += 1;
    this.ignoreAll = behavior.ignoreAll === true;
    this.ignoreTerm = this.ignoreAll || behavior.ignoreTerm !== false;
  }

  kill(signal = "SIGTERM") {
    if (this.exitCode != null || this.signalCode != null) return true;
    this.killed = true;
    this.killSignal = signal;
    this.killSignals.push(signal);
    if (this.ignoreAll) return true;
    if (this.ignoreTerm && signal === "SIGTERM") return true;
    queueMicrotask(() => {
      if (this.exitCode != null || this.signalCode != null) return;
      this.signalCode = signal;
      this.emit("exit", null, signal);
    });
    return true;
  }

  exitSoon(code = 0, signal = null) {
    queueMicrotask(() => {
      if (this.exitCode != null || this.signalCode != null) return;
      this.exitCode = code;
      this.signalCode = signal;
      this.emit("exit", code, signal);
    });
  }

  failSoon(err) {
    queueMicrotask(() => {
      this.emit("error", err);
      if (this.exitCode != null || this.signalCode != null) return;
      this.exitCode = 1;
      this.emit("exit", 1, null);
    });
  }
}
FakeChild.nextPid = 1;

function identityResolve(command) {
  return { file: command, prefix: [], options: {} };
}

function makeHarness(overrides = {}) {
  const created = [];
  const { childBehavior, ...ctrlOverrides } = overrides;
  const controller = createDevController({
    resolveCommand: identityResolve,
    writeErr: () => undefined,
    healthUrl: "http://127.0.0.1:9/health",
    healthTotalMs: 80,
    healthAttemptMs: 20,
    healthIntervalMs: 5,
    shutdownGraceMs: 40,
    shutdownEscalateMs: 40,
    spawn(file, args) {
      const behavior = typeof childBehavior === "function" ? childBehavior(file, args) : childBehavior;
      const child = new FakeChild(file, args, behavior);
      created.push(child);
      return child;
    },
    ...ctrlOverrides
  });
  return { controller, created };
}

let pass = 0;
let fail = 0;

function check(cond, label, detail = "") {
  if (cond) {
    process.stdout.write(`[ok] ${label}\n`);
    pass += 1;
  } else {
    process.stdout.write(`[fail] ${label}${detail ? `: ${detail}` : ""}\n`);
    fail += 1;
  }
}

function isDaemon(child) {
  return child.file === "pnpm" && child.args.includes("@saydo/daemon");
}

function isPipeline(child) {
  return child.file === "uv" && child.args.includes("saydo_pipeline");
}

function isConsole(child) {
  return child.file === "pnpm" && child.args.includes("@saydo/console");
}

function noOrphans(created) {
  return created.every((child) => child.exitCode != null || child.signalCode != null || child.killed === true);
}

async function withBound(ms, label, fn) {
  let timer;
  try {
    await Promise.race([
      fn(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} exceeded ${ms}ms`)), ms);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function testStartupCancel() {
  const started = Date.now();
  const { controller, created } = makeHarness({
    healthTotalMs: DEFAULT_HEALTH_TOTAL_MS,
    healthAttemptMs: 5_000,
    healthIntervalMs: 400,
    async fetch() {
      controller.shutdown();
      return { ok: true };
    }
  });
  const code = await controller.run();
  const elapsed = Date.now() - started;
  check(created.length === 1 && created.every(isDaemon), "startup cancel: only daemon spawned", `n=${String(created.length)}`);
  check(created[0]?.killed === true, "startup cancel: owned daemon killed");
  check(created[0]?.killSignals.includes("SIGTERM") === true, "startup cancel: first signal is SIGTERM");
  check(controller.children.every((item) => item.settled), "startup cancel: completion settled");
  check(!created.some(isPipeline) && !created.some(isConsole), "startup cancel: no later spawn");
  check(elapsed < 2_000, "startup cancel: did not run full 60s", `elapsed=${String(elapsed)}`);
  check(code === 0, "startup cancel: user cancel exit 0", `exit=${String(code)}`);
}

async function testEarlyExit() {
  const created = [];
  const { controller } = makeHarness({
    spawn(file, args) {
      const child = new FakeChild(file, args);
      created.push(child);
      if (isDaemon(child)) child.exitSoon(1);
      return child;
    },
    async fetch() {
      return { ok: true };
    }
  });
  const code = await controller.run();
  check(created.length === 1 && isDaemon(created[0]), "early exit: no later spawn after daemon crash", `n=${String(created.length)}`);
  check(controller.children[0]?.settled === true, "early exit: daemon completion registered");
  check(code === 1, "early exit: fail exit 1", `exit=${String(code)}`);
}

async function testSpawnError() {
  const created = [];
  const { controller } = makeHarness({
    spawn(file, args) {
      const child = new FakeChild(file, args);
      created.push(child);
      child.failSoon(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
      return child;
    },
    async fetch() {
      return { ok: true };
    }
  });
  const code = await controller.run();
  check(created.length === 1, "spawn error: no later children", `n=${String(created.length)}`);
  check(controller.children[0]?.settled === true && controller.children[0]?.error != null, "spawn error: error terminal recorded");
  check(code === 1, "spawn error: fail exit 1", `exit=${String(code)}`);
}

async function testUnresponsiveHealth() {
  const started = Date.now();
  const { controller, created } = makeHarness({
    healthTotalMs: 80,
    healthAttemptMs: 20,
    healthIntervalMs: 5,
    fetch() {
      return new Promise(() => undefined);
    }
  });
  const code = await controller.run();
  const elapsed = Date.now() - started;
  check(created.length === 1 && isDaemon(created[0]), "unresponsive health: only daemon", `n=${String(created.length)}`);
  check(created[0]?.killed === true, "unresponsive health: owned daemon cleaned");
  check(controller.children.every((item) => item.settled), "unresponsive health: settled");
  check(elapsed < 2_000, "unresponsive health: bounded by injected deadline", `elapsed=${String(elapsed)}`);
  check(code === 1, "unresponsive health: timeout exit 1", `exit=${String(code)}`);
}

async function testNormalExit() {
  const created = [];
  const { controller } = makeHarness({
    spawn(file, args) {
      const child = new FakeChild(file, args);
      created.push(child);
      if (created.length === 3) {
        queueMicrotask(() => {
          for (const item of created) item.exitSoon(0);
        });
      }
      return child;
    },
    async fetch() {
      return { ok: true };
    }
  });
  const code = await controller.run();
  check(created.length === 3, "normal exit: three owned children", `n=${String(created.length)}`);
  check(created.some(isDaemon) && created.some(isPipeline) && created.some(isConsole), "normal exit: daemon/pipeline/console");
  check(controller.children.every((item) => item.settled && item.exitCode === 0), "normal exit: all settled 0");
  check(code === 0, "normal exit: exit 0", `exit=${String(code)}`);
}

async function testIgnoredTermEscalates() {
  const started = Date.now();
  const { controller, created } = makeHarness({
    childBehavior: { ignoreTerm: true },
    async fetch() {
      controller.shutdown();
      return { ok: true };
    }
  });
  const code = await controller.run();
  const elapsed = Date.now() - started;
  const daemon = created[0];
  check(created.length === 1 && isDaemon(daemon), "ignored term: only daemon", `n=${String(created.length)}`);
  check(daemon?.killSignals[0] === "SIGTERM" && daemon?.killSignals.includes("SIGKILL"), "ignored term: escalate still-held child", `signals=${JSON.stringify(daemon?.killSignals ?? [])}`);
  check(controller.children.every((item) => item.settled), "ignored term: settled after escalate");
  check(elapsed < 2_000, "ignored term: bounded cleanup", `elapsed=${String(elapsed)}`);
  check(code === 0, "ignored term: user cancel cleanup ok exit 0", `exit=${String(code)}`);
}

async function testIgnoredTermStillAlive() {
  const started = Date.now();
  const { controller, created } = makeHarness({
    childBehavior: { ignoreAll: true },
    async fetch() {
      controller.shutdown();
      return { ok: true };
    }
  });
  const code = await controller.run();
  const elapsed = Date.now() - started;
  check(created.length === 1 && isDaemon(created[0]), "ignore all: only daemon", `n=${String(created.length)}`);
  check(created[0]?.killed === true && created[0]?.killSignals.includes("SIGTERM"), "ignore all: kill(SIGTERM) returned true");
  check(created[0]?.exitCode == null && created[0]?.signalCode == null, "ignore all: child still not exited");
  check(controller.children.some((item) => item.settled === false), "ignore all: do not fake-settle");
  check(elapsed < 2_000, "ignore all: bounded deadline", `elapsed=${String(elapsed)}`);
  check(code !== 0, "ignore all: cleanup failure is non-zero", `exit=${String(code)}`);
}

async function testUnexpectedSignal() {
  const created = [];
  const { controller } = makeHarness({
    spawn(file, args) {
      const child = new FakeChild(file, args);
      created.push(child);
      if (isDaemon(child)) {
        queueMicrotask(() => {
          if (child.exitCode != null || child.signalCode != null) return;
          child.signalCode = "SIGKILL";
          child.emit("exit", null, "SIGKILL");
        });
      }
      return child;
    },
    async fetch() {
      await new Promise((resolve) => setTimeout(resolve, 30));
      return { ok: true };
    }
  });
  const code = await controller.run();
  check(created.length === 1 && isDaemon(created[0]), "signal early: no later spawn after SIGKILL", `n=${String(created.length)}`);
  check(controller.children[0]?.exitCode == null && controller.children[0]?.signal === "SIGKILL", "signal early: null code + signal recorded");
  check(controller.children[0]?.settled === true, "signal early: daemon settled");
  check(code === 1, "signal early: fail exit 1", `exit=${String(code)}`);
}

async function testNormalEarlyExit() {
  const created = [];
  const { controller } = makeHarness({
    spawn(file, args) {
      const child = new FakeChild(file, args);
      created.push(child);
      if (isPipeline(child)) child.exitSoon(0);
      return child;
    },
    async fetch() {
      return { ok: true };
    }
  });
  const code = await controller.run();
  const leftovers = created.filter((child) => child.exitCode == null && child.signalCode == null && child.killed !== true);
  check(created.length === 3, "normal early: three owned children", `n=${String(created.length)}`);
  check(created.some(isDaemon) && created.some(isPipeline) && created.some(isConsole), "normal early: daemon/pipeline/console");
  check(created.find(isPipeline)?.exitCode === 0, "normal early: pipeline exited 0");
  check(created.filter((child) => !isPipeline(child)).every((child) => child.killed === true), "normal early: remaining owned children signaled");
  check(leftovers.length === 0 && noOrphans(created), "normal early: no orphan residents", `leftovers=${String(leftovers.length)}`);
  check(controller.children.every((item) => item.settled), "normal early: all settled after bounded cleanup");
  check(typeof code === "number", "normal early: run returned", `exit=${String(code)}`);
}

async function testSyncFetchThrowCleanup() {
  const started = Date.now();
  const pendingTimeouts = new Set();
  const pendingIntervals = new Set();
  const realSetTimeout = setTimeout;
  const realClearTimeout = clearTimeout;
  const realSetInterval = setInterval;
  const realClearInterval = clearInterval;
  const { controller, created } = makeHarness({
    fetch() {
      throw new Error("sync-health-boom");
    },
    setTimeout(fn, ms, ...args) {
      const id = realSetTimeout((...inner) => {
        pendingTimeouts.delete(id);
        fn(...inner);
      }, ms, ...args);
      pendingTimeouts.add(id);
      return id;
    },
    clearTimeout(id) {
      pendingTimeouts.delete(id);
      return realClearTimeout(id);
    },
    setInterval(fn, ms, ...args) {
      const id = realSetInterval(fn, ms, ...args);
      pendingIntervals.add(id);
      return id;
    },
    clearInterval(id) {
      pendingIntervals.delete(id);
      return realClearInterval(id);
    }
  });
  const code = await controller.run();
  const elapsed = Date.now() - started;
  check(created.length === 1 && isDaemon(created[0]), "sync fetch throw: only daemon", `n=${String(created.length)}`);
  check(pendingTimeouts.size === 0 && pendingIntervals.size === 0, "sync fetch throw: timeout and cancelPoll released", `timeouts=${String(pendingTimeouts.size)} intervals=${String(pendingIntervals.size)}`);
  check(elapsed < 2_000, "sync fetch throw: single total deadline", `elapsed=${String(elapsed)}`);
  check(code === 1, "sync fetch throw: timeout exit 1", `exit=${String(code)}`);
}

async function main() {
  const cases = [
    ["startup cancel", testStartupCancel],
    ["early exit", testEarlyExit],
    ["spawn error", testSpawnError],
    ["unresponsive health", testUnresponsiveHealth],
    ["normal exit", testNormalExit],
    ["ignored term", testIgnoredTermEscalates],
    ["ignore all", testIgnoredTermStillAlive],
    ["signal early", testUnexpectedSignal],
    ["normal early", testNormalEarlyExit],
    ["sync fetch throw", testSyncFetchThrowCleanup]
  ];
  try {
    for (const [label, fn] of cases) {
      await withBound(5_000, label, fn);
    }
  } catch (err) {
    process.stdout.write(`[fail] ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
  process.stdout.write(`dev-lifecycle: pass=${pass} fail=${fail}\n`);
  process.exit(fail === 0 ? 0 : 1);
}

await main();
