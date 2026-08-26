// Playwright 全局装配:起一个 daemon(固定 home/端口)+ 构建 console + 种 fixture
// + vite dev server(47120,proxy 指向测试 daemon——接线批任务⑤ vite 路径覆盖),
// token/pid 落 .runtime.json 给各 worker(worker 重启不重复起 daemon)。

import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { networkInterfaces, tmpdir } from "node:os";

const PORT = 47188;
const FIRST_RUN_PORT = 47189;
const VITE_PORT = 47120;
const ROOT = join(import.meta.dirname, "..", "..");
const TEST_STATE_PARENT =
  process.platform === "darwin" ? "/private/tmp" : process.platform === "linux" ? "/tmp" : tmpdir();
const HOME = join(TEST_STATE_PARENT, `saydo-playwright-home-${PORT}`);
const FIRST_RUN_HOME = join(TEST_STATE_PARENT, `saydo-playwright-home-${FIRST_RUN_PORT}`);
const RUNTIME = join(ROOT, "e2e", "console", ".runtime.json");

function privateLanAddress(): string {
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family !== "IPv4" || entry.internal) continue;
      const parts = entry.address.split(".").map(Number);
      if (
        parts[0] === 10 ||
        (parts[0] === 172 && (parts[1] as number) >= 16 && (parts[1] as number) <= 31) ||
        (parts[0] === 192 && parts[1] === 168)
      ) return entry.address;
    }
  }
  throw new Error("M1 Playwright requires an RFC 1918 interface");
}

async function waitOk(url: string, what: string, logPath?: string): Promise<void> {
  let lastError = "";
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
      lastError = `HTTP ${r.status}`;
    } catch (err) {
      lastError = String((err as { message?: unknown })?.message ?? err);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  let tail = "";
  if (logPath && existsSync(logPath)) {
    try {
      tail = `\n--- ${logPath} (tail) ---\n${readFileSync(logPath, "utf8").slice(-4000)}`;
    } catch {
      tail = `\n(日志不可读:${logPath})`;
    }
  }
  throw new Error(`${what} did not become ready: ${url} lastError=${lastError}${tail}`);
}

function killTree(child: ChildProcess): void {
  try {
    if (!child.pid) {
      child.kill();
      return;
    }
    if (process.platform === "win32") child.kill("SIGKILL");
    else process.kill(-child.pid);
  } catch {
    child.kill();
  }
}

export default async function globalSetup(): Promise<() => void> {
  rmSync(HOME, { recursive: true, force: true });
  rmSync(FIRST_RUN_HOME, { recursive: true, force: true });
  mkdirSync(HOME, { recursive: true });
  mkdirSync(FIRST_RUN_HOME, { recursive: true });
  let daemon: ChildProcess | null = null;
  let firstRunDaemon: ChildProcess | null = null;
  let vite: ChildProcess | null = null;
  try {
    const lanAddress = privateLanAddress();
    const daemonLogPath = join(HOME, "daemon-e2e.log");
    const daemonLogFd = openSync(daemonLogPath, "a");
    execFileSync("pnpm", ["--filter", "@saydo/console", "build"], { cwd: ROOT, stdio: "ignore" });
    daemon = spawn("pnpm", ["--filter", "@saydo/daemon", "start"], {
      cwd: ROOT,
      env: {
        ...process.env,
        SAYDO_HOME: HOME,
        SAYDO_DAEMON_PORT: String(PORT),
        SAYDO_MOBILE_LAN: "1",
        VOLC_APP_ID: "e2e",
        VOLC_ACCESS_TOKEN: "e2e"
      },
      // 不得用 stdio:"ignore":daemon 起不来时会一点诊断都不剩,CI 上只会看到
      // 一句 "did not become ready"(2026-08-26 rc.6 实遇)。落到 HOME 下的日志文件,
      // 超时时连同尾部一起抛出。
      stdio: ["ignore", daemonLogFd, daemonLogFd],
      detached: true
    });
    await waitOk(`http://127.0.0.1:${PORT}/health`, "daemon", daemonLogPath);
    const token = readFileSync(join(HOME, ".cap-token"), "utf8").trim();
    const seed = await fetch(`http://127.0.0.1:${PORT}/dev/seed-fixture?token=${token}`, { method: "POST" });
    const out = (await seed.json()) as { seeded: boolean; reason?: string };
    if (!out.seeded) throw new Error(`fixture seed failed: ${out.reason ?? "unknown"}`);

    // M1 first-run 验收必须穿过真正 fresh HOME，不能被主 daemon 的人工 fixture 污染资格。
    firstRunDaemon = spawn("pnpm", ["--filter", "@saydo/daemon", "start"], {
      cwd: ROOT,
      env: {
        ...process.env,
        SAYDO_HOME: FIRST_RUN_HOME,
        SAYDO_DAEMON_PORT: String(FIRST_RUN_PORT),
        SAYDO_MOBILE_LAN: "1"
      },
      stdio: "ignore",
      detached: true
    });
    await waitOk(`http://127.0.0.1:${FIRST_RUN_PORT}/health`, "fresh first-run daemon");
    const firstRunToken = readFileSync(join(FIRST_RUN_HOME, ".cap-token"), "utf8").trim();

    // vite dev(47120):proxy 指向测试 daemon——api.ts 同源化后 dev 路径的真实回归(任务⑤)
    vite = spawn("pnpm", ["--filter", "@saydo/console", "exec", "vite", "--port", String(VITE_PORT), "--strictPort"], {
      cwd: ROOT,
      env: { ...process.env, SAYDO_DAEMON_ORIGIN: `http://127.0.0.1:${PORT}` },
      stdio: "ignore",
      detached: true
    });
    await waitOk(`http://127.0.0.1:${VITE_PORT}/health`, "vite dev (proxy /health)");

    writeFileSync(
      RUNTIME,
      JSON.stringify({
        token,
        lanAddress,
        firstRunToken,
        firstRunPort: FIRST_RUN_PORT,
        pid: daemon.pid,
        firstRunPid: firstRunDaemon.pid,
        vitePid: vite.pid
      })
    );
  } catch (err) {
    if (vite) killTree(vite);
    if (firstRunDaemon) killTree(firstRunDaemon);
    if (daemon) killTree(daemon);
    rmSync(RUNTIME, { force: true });
    rmSync(HOME, { recursive: true, force: true });
    rmSync(FIRST_RUN_HOME, { recursive: true, force: true });
    throw err;
  }
  return () => {
    if (vite) killTree(vite);
    if (firstRunDaemon) killTree(firstRunDaemon);
    if (daemon) killTree(daemon);
    rmSync(RUNTIME, { force: true });
    rmSync(HOME, { recursive: true, force: true });
    rmSync(FIRST_RUN_HOME, { recursive: true, force: true });
  };
}
