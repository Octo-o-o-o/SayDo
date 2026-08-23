import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll } from "vitest";

const ROOT = resolve(import.meta.dirname, "../../../..");

// 兜底注册表:测试忘调 stop()/finally 漏分支时,文件级 afterAll 统一回收,
// 防止 daemon(尤其 restart 后 ppid=1 的新进程)残留为孤儿持有测试库。
const activeDaemons = new Set<DaemonProcess>();
afterAll(async () => {
  for (const daemon of [...activeDaemons]) await daemon.stop();
});
const TSX_CLI = resolve(ROOT, "packages/daemon/node_modules/tsx/dist/cli.mjs");
const DAEMON_ENTRY = resolve(ROOT, "packages/daemon/src/index.ts");

export async function reservePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise<void>((resolveClose, reject) => server.close((err) => (err ? reject(err) : resolveClose())));
  if (port === 0) throw new Error("failed to reserve port");
  return port;
}

export interface DaemonProcess {
  child: ChildProcess;
  home: string;
  port: number;
  token: string;
  output: () => string;
  health: () => Promise<{ pid: number; runtimeSha: string; stateRootDigest: string }>;
  api: (path: string, init?: RequestInit) => Promise<Response>;
  waitForRestart: (previousPid: number) => Promise<{ pid: number; runtimeSha: string; stateRootDigest: string }>;
  stop: () => Promise<void>;
}

async function waitForHealth(port: number, predicate: (health: { pid: number }) => boolean = () => true) {
  let lastError: unknown;
  // 全套件并行时 tsx 冷启动会接近文档给出的 10–15 秒；探针窗口覆盖该受支持上界。
  for (let attempt = 0; attempt < 300; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`, {
        keepalive: false,
        headers: { connection: "close" }
      });
      if (response.ok) {
        const health = (await response.json()) as { pid: number; runtimeSha: string; stateRootDigest: string };
        if (predicate(health)) return health;
      }
    } catch (err) {
      lastError = err;
    }
    await new Promise((done) => setTimeout(done, 50));
  }
  throw new Error(`daemon health timeout:${String(lastError ?? "predicate not met")}`);
}

export async function startDaemonProcess(input: {
  home: string;
  port: number;
  env?: Record<string, string | undefined>;
  importBeforeTsx?: string[];
}): Promise<DaemonProcess> {
  let logs = "";
  const args = [
    ...(input.importBeforeTsx ?? []).flatMap((modulePath) => ["--import", pathToFileURL(modulePath).href]),
    TSX_CLI,
    DAEMON_ENTRY
  ];
  const child = spawn(process.execPath, args, {
    cwd: ROOT,
    env: {
      ...process.env,
      SAYDO_MOBILE_LAN: undefined,
      SAYDO_HOME: input.home,
      SAYDO_DAEMON_PORT: String(input.port),
      ...input.env
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  const collect = (chunk: Buffer) => {
    logs = `${logs}${chunk.toString()}`.slice(-100_000);
  };
  child.stdout?.on("data", collect);
  child.stderr?.on("data", collect);
  child.stdout?.on("error", () => undefined);
  child.stderr?.on("error", () => undefined);
  child.on("error", () => undefined);
  try {
    await waitForHealth(input.port);
  } catch (err) {
    child.kill("SIGTERM");
    throw new Error(`${String(err)}\n${logs}`);
  }
  const token = readFileSync(resolve(input.home, ".cap-token"), "utf8").trim();
  const knownPids = new Set<number>([child.pid as number]);
  const health = () => waitForHealth(input.port);
  const api = (path: string, init: RequestInit = {}) =>
    fetch(`http://127.0.0.1:${input.port}${path}`, {
      ...init,
      keepalive: false,
      headers: { "x-saydo-token": token, connection: "close", ...(init.headers ?? {}) }
    });
  const alivePids = () =>
    [...knownPids].filter((pid) => {
      try {
        process.kill(pid, 0);
        return true;
      } catch {
        return false;
      }
    });
  const handle: DaemonProcess = {
    child,
    home: input.home,
    port: input.port,
    token,
    output: () => logs,
    health,
    api,
    async waitForRestart(previousPid) {
      const next = await waitForHealth(input.port, (snapshot) => snapshot.pid !== previousPid);
      knownPids.add(next.pid);
      return next;
    },
    async stop() {
      activeDaemons.delete(handle);
      // 单次探测把当前实际 pid(重启后可能是 knownPids 之外的新进程)补进清单;
      // 不用 waitForHealth 轮询,避免对已退出的 daemon 白等 8 秒。
      try {
        const response = await fetch(`http://127.0.0.1:${input.port}/health`, {
          signal: AbortSignal.timeout(500),
          keepalive: false,
          headers: { connection: "close" }
        });
        if (response.ok) knownPids.add(((await response.json()) as { pid: number }).pid);
      } catch {
        // listener 已停时只清理已知 pid。
      }
      for (const pid of knownPids) {
        try {
          process.kill(pid, "SIGTERM");
        } catch {
          // 已退出。
        }
      }
      child.kill("SIGTERM");
      // 确认真的退出;卡住的进程升级 SIGKILL,避免残留孤儿持有测试库。
      const deadline = Date.now() + 3000;
      while (alivePids().length > 0 && Date.now() < deadline) {
        await new Promise((done) => setTimeout(done, 50));
      }
      for (const pid of alivePids()) {
        try {
          process.kill(pid, "SIGKILL");
        } catch {
          // 已退出。
        }
      }
    }
  };
  activeDaemons.add(handle);
  return handle;
}
