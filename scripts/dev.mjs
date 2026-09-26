#!/usr/bin/env node
// 跨 OS 三进程入口:先 daemon health,再 pipeline 与 console。
// Windows 只杀本脚本 spawn 的直接子进程,禁止 taskkill /T 与 killOwnedTree。
import { spawn as nodeSpawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_HEALTH_TOTAL_MS = 60_000;
export const DEFAULT_HEALTH_ATTEMPT_MS = 2_000;
export const DEFAULT_HEALTH_INTERVAL_MS = 400;
export const DEFAULT_SHUTDOWN_GRACE_MS = 5_000;
export const DEFAULT_SHUTDOWN_ESCALATE_MS = 2_000;

function resolvePe(name) {
  if (process.platform !== "win32") return { file: name, prefix: [], options: {} };
  const pathext = (process.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";").filter(Boolean);
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    if (!dir) continue;
    for (const suffix of pathext) {
      const candidate = join(dir, `${name}${suffix}`);
      if (!existsSync(candidate)) continue;
      const ext = extname(candidate).toLowerCase();
      if (ext === ".exe" || ext === ".com") {
        return { file: candidate, prefix: [], options: { windowsHide: true } };
      }
    }
  }
  return { file: name, prefix: [], options: { windowsHide: true } };
}

function resolvePnpm() {
  const corepack = join(dirname(process.execPath), "node_modules", "corepack", "dist", "pnpm.js");
  if (existsSync(corepack)) {
    return { file: process.execPath, prefix: [corepack], options: { windowsHide: true } };
  }
  return resolvePe("pnpm");
}

function hasCommand(name) {
  const r = spawnSync(process.platform === "win32" ? "where" : "which", [name], { stdio: "ignore" });
  return r.status === 0;
}

function defaultSleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function createDevController(opts = {}) {
  const spawnImpl = opts.spawn ?? nodeSpawn;
  const fetchImpl = opts.fetch ?? globalThis.fetch.bind(globalThis);
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? defaultSleep;
  const setTimeoutFn = opts.setTimeout ?? setTimeout;
  const clearTimeoutFn = opts.clearTimeout ?? clearTimeout;
  const setIntervalFn = opts.setInterval ?? setInterval;
  const clearIntervalFn = opts.clearInterval ?? clearInterval;
  const healthTotalMs = opts.healthTotalMs ?? DEFAULT_HEALTH_TOTAL_MS;
  const healthAttemptMs = opts.healthAttemptMs ?? DEFAULT_HEALTH_ATTEMPT_MS;
  const healthIntervalMs = opts.healthIntervalMs ?? DEFAULT_HEALTH_INTERVAL_MS;
  const shutdownGraceMs = opts.shutdownGraceMs ?? DEFAULT_SHUTDOWN_GRACE_MS;
  const shutdownEscalateMs = opts.shutdownEscalateMs ?? DEFAULT_SHUTDOWN_ESCALATE_MS;
  const port = opts.port ?? process.env["SAYDO_DAEMON_PORT"] ?? "47100";
  const healthUrl = opts.healthUrl ?? `http://127.0.0.1:${port}/health`;
  const root = opts.root ?? ROOT;
  const writeErr = opts.writeErr ?? ((text) => process.stderr.write(text));
  const resolveCommand = opts.resolveCommand ?? ((command) => (command === "pnpm" ? resolvePnpm() : resolvePe(command)));
  const hasCommandImpl = opts.hasCommand ?? (opts.spawn ? () => true : hasCommand);

  const children = [];
  let shuttingDown = false;
  let exitCode = 0;
  let notifyShutdown = () => undefined;
  const shutdownStarted = new Promise((resolve) => {
    notifyShutdown = resolve;
  });

  function signalDirect(signal) {
    for (const item of children) {
      if (item.settled) continue;
      try {
        item.killed = true;
        item.child.kill(signal);
      } catch {
        // 只处理本控制器仍持有且未 settled 的直接 child
      }
    }
  }

  function shutdown() {
    shuttingDown = true;
    notifyShutdown();
    signalDirect("SIGTERM");
  }

  function allSettled() {
    return children.every((item) => item.settled);
  }

  function pendingSettles() {
    return children.filter((item) => !item.settled).map((item) => item.settledPromise);
  }

  function unexpectedFailure(state) {
    return state.error != null || (state.exitCode != null && state.exitCode !== 0) || state.signal != null;
  }

  function recordChild(command, args, child) {
    let resolveSettled = () => undefined;
    const settledPromise = new Promise((resolve) => {
      resolveSettled = resolve;
    });
    const state = {
      command,
      args,
      child,
      settled: false,
      settledPromise,
      exitCode: null,
      signal: null,
      error: null,
      killed: false
    };
    const finish = (update) => {
      if (state.settled) return;
      state.settled = true;
      Object.assign(state, update);
      if (!shuttingDown) {
        if (unexpectedFailure(state)) {
          writeErr(`[fail] ${command} ${args.join(" ")} exited ${String(state.error ?? state.exitCode ?? state.signal)}\n`);
          exitCode = 1;
        }
        shutdown();
      }
      resolveSettled();
    };
    if (child.exitCode != null || child.signalCode != null) {
      finish({ exitCode: child.exitCode, signal: child.signalCode });
    } else {
      child.once("exit", (code, signal) => finish({ exitCode: code, signal }));
      child.once("error", (err) => finish({ error: err, exitCode: child.exitCode ?? 1, signal: child.signalCode }));
    }
    children.push(state);
    return state;
  }

  function spawnOne(command, args, cwd) {
    if (shuttingDown) return null;
    const resolved = resolveCommand(command);
    let child;
    try {
      child = spawnImpl(resolved.file, [...resolved.prefix, ...args], {
        cwd,
        env: process.env,
        stdio: "inherit",
        ...resolved.options
      });
    } catch (err) {
      writeErr(`[fail] spawn ${command} ${args.join(" ")}: ${String(err)}\n`);
      exitCode = 1;
      shutdown();
      return null;
    }
    if (child == null) {
      writeErr(`[fail] spawn ${command} ${args.join(" ")}: no child\n`);
      exitCode = 1;
      shutdown();
      return null;
    }
    return recordChild(command, args, child);
  }

  async function waitHealth() {
    const deadline = now() + healthTotalMs;
    while (now() < deadline) {
      if (shuttingDown) throw new Error("cancelled");
      const remaining = deadline - now();
      const attemptMs = Math.min(healthAttemptMs, remaining);
      if (attemptMs <= 0) break;
      const ac = new AbortController();
      let timer;
      let cancelPoll;
      try {
        timer = setTimeoutFn(() => ac.abort(), attemptMs);
        cancelPoll = setIntervalFn(() => {
          if (shuttingDown) ac.abort();
        }, 10);
        const fetchPromise = Promise.resolve(fetchImpl(healthUrl, { signal: ac.signal }));
        fetchPromise.catch(() => undefined);
        const timeoutPromise = new Promise((_, reject) => {
          const onAbort = () => {
            reject(Object.assign(new Error(shuttingDown ? "cancelled" : "health-attempt-timeout"), { name: "AbortError" }));
          };
          if (ac.signal.aborted) {
            onAbort();
            return;
          }
          ac.signal.addEventListener("abort", onAbort, { once: true });
        });
        timeoutPromise.catch(() => undefined);
        const res = await Promise.race([fetchPromise, timeoutPromise]);
        if (shuttingDown) throw new Error("cancelled");
        if (res && res.ok) return;
      } catch (err) {
        if (shuttingDown || (err instanceof Error && err.message === "cancelled")) {
          throw new Error("cancelled");
        }
      } finally {
        if (timer != null) clearTimeoutFn(timer);
        if (cancelPoll != null) clearIntervalFn(cancelPoll);
      }
      const sleepMs = Math.min(healthIntervalMs, Math.max(0, deadline - now()));
      const sleepUntil = now() + sleepMs;
      while (now() < sleepUntil) {
        if (shuttingDown) throw new Error("cancelled");
        await sleep(Math.min(20, sleepUntil - now()));
      }
    }
    if (shuttingDown) throw new Error("cancelled");
    throw new Error("daemon /health timeout");
  }

  async function waitUntilSettledOrDeadline(deadline) {
    while (!allSettled()) {
      const remaining = deadline - now();
      if (remaining <= 0) return false;
      const pending = pendingSettles();
      if (pending.length === 0) return true;
      await Promise.race([...pending, sleep(Math.min(20, remaining))]);
    }
    return true;
  }

  async function waitOwned() {
    while (!allSettled()) {
      if (!shuttingDown) {
        const pending = pendingSettles();
        if (pending.length === 0) return;
        await Promise.race([...pending, shutdownStarted]);
        continue;
      }
      if (await waitUntilSettledOrDeadline(now() + shutdownGraceMs)) return;
      signalDirect("SIGKILL");
      if (await waitUntilSettledOrDeadline(now() + shutdownEscalateMs)) return;
      writeErr("[fail] owned child cleanup deadline exceeded\n");
      exitCode = 1;
      return;
    }
  }

  function finalize() {
    if (children.some((item) => !item.settled)) return 1;
    if (exitCode !== 0) return exitCode;
    if (children.some((item) => item.error != null || (item.exitCode != null && item.exitCode !== 0))) return 1;
    return 0;
  }

  async function run() {
    spawnOne("pnpm", ["--filter", "@saydo/daemon", "dev"], root);
    if (shuttingDown) {
      shutdown();
      await waitOwned();
      return finalize();
    }
    try {
      await waitHealth();
    } catch (err) {
      const cancelled = err instanceof Error && err.message === "cancelled";
      if (!cancelled) {
        writeErr(`[fail] ${String(err)}\n`);
        exitCode = 1;
      }
      shutdown();
      await waitOwned();
      return finalize();
    }
    if (shuttingDown) {
      shutdown();
      await waitOwned();
      return finalize();
    }
    if (hasCommandImpl("uv")) {
      spawnOne("uv", ["run", "python", "-m", "saydo_pipeline"], join(root, "pipeline"));
    } else {
      writeErr("[warn] 未找到 uv,跳过语音 pipeline(文本与浏览器系统语音照常;需要云端语音时先安装 uv 再 just dev)\n");
    }
    spawnOne("pnpm", ["--filter", "@saydo/console", "dev"], root);
    if (shuttingDown) shutdown();
    await waitOwned();
    return finalize();
  }

  return {
    run,
    shutdown,
    children,
    get shuttingDown() {
      return shuttingDown;
    }
  };
}

export async function main(opts = {}) {
  const controller = createDevController(opts);
  const onStop = () => controller.shutdown();
  process.on("SIGINT", onStop);
  process.on("SIGTERM", onStop);
  try {
    return await controller.run();
  } finally {
    process.off("SIGINT", onStop);
    process.off("SIGTERM", onStop);
  }
}

function launchedAsMain() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(resolve(entry)).href;
  } catch {
    return false;
  }
}

if (launchedAsMain()) {
  process.exit(await main());
}
