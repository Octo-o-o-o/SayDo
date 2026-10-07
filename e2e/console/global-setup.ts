// Playwright 全局装配:独占本轮随机 HOME + 起 daemon(固定端口)+ 构建 console + 种 fixture
// + vite dev server(47120,proxy 指向测试 daemon——接线批任务⑤ vite 路径覆盖),
// token/pid 落 .runtime.json 给各 worker(worker 重启不重复起 daemon)。

import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { networkInterfaces, tmpdir } from "node:os";
import {
  assertPlaywrightPortsAvailable,
  createPlaywrightState,
  stopOwnedPlaywrightChild,
  waitForOwnedPlaywrightDaemon
} from "../../packages/daemon/test/helpers/playwright-isolation.js";

const PORT = 47188;
const FIRST_RUN_PORT = 47189;
const VITE_PORT = 47120;
const ROOT = join(import.meta.dirname, "..", "..");
// 宿主可将测试 HOME 放到任务证据目录，避免不同工作区共用同一份临时状态。
const TEST_STATE_PARENT = process.env.SAYDO_E2E_STATE_PARENT ??
  (process.platform === "darwin" ? "/private/tmp" : process.platform === "linux" ? "/tmp" : tmpdir());
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

export default async function globalSetup(): Promise<() => Promise<void>> {
  // 拒占先于状态目录与 runtime 的任何写入，避免接管其他工作区的已启动服务。
  await assertPlaywrightPortsAvailable([PORT, FIRST_RUN_PORT, VITE_PORT]);
  const state = createPlaywrightState(TEST_STATE_PARENT);
  const HOME = state.home;
  const FIRST_RUN_HOME = state.firstRunHome;
  // 证据保留供审核，与 teardown 回收的状态目录分开；缺省每轮唯一，基准更新须显式指定。
  const evidenceParent = join(ROOT, "e2e", "artifacts", "console-runs");
  let wroteRuntime = false;
  let daemon: ChildProcess | null = null;
  let firstRunDaemon: ChildProcess | null = null;
  let vite: ChildProcess | null = null;
  const stopChildren = async (): Promise<void> => {
    const owned = [vite, firstRunDaemon, daemon];
    const stopped = await Promise.allSettled(owned.map(stopOwnedPlaywrightChild));
    const failures = stopped.flatMap((result, index) => result.status === "rejected"
      ? [{ pid: owned[index]?.pid ?? null, error: String(result.reason) }] : []);
    if (failures.length) {
      writeFileSync(join(state.root, "cleanup-failure.json"), JSON.stringify({
        at: new Date().toISOString(), runRoot: state.root, failures
      }, null, 2));
      throw new Error(`Playwright owned groups not reclaimed; state retained: ${state.root}`);
    }
  };
  try {
    mkdirSync(evidenceParent, { recursive: true });
    const evidenceRoot = mkdtempSync(join(evidenceParent, "run-"));
    const lanAddress = privateLanAddress();
    const daemonLogPath = join(HOME, "daemon-e2e.log");
    execFileSync("pnpm", ["--filter", "@saydo/console", "build"], { cwd: ROOT, stdio: "ignore" });
    const daemonLogFd = openSync(daemonLogPath, "a");
    try {
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
    } finally {
      closeSync(daemonLogFd);
    }
    const token = await waitForOwnedPlaywrightDaemon({
      url: `http://127.0.0.1:${PORT}/health`, home: HOME, port: PORT,
      children: [daemon], what: "daemon", logPath: daemonLogPath
    });
    const seed = await fetch(`http://127.0.0.1:${PORT}/dev/seed-fixture?token=${token}`, { method: "POST" });
    const out = (await seed.json()) as { seeded: boolean; reason?: string };
    if (!out.seeded) throw new Error(`fixture seed failed: ${out.reason ?? "unknown"}`);

    // M1 first-run 验收必须穿过真正 fresh HOME，不能被主 daemon 的人工 fixture 污染资格。
    const firstRunLogPath = join(FIRST_RUN_HOME, "daemon-first-run-e2e.log");
    const firstRunLogFd = openSync(firstRunLogPath, "a");
    try {
      firstRunDaemon = spawn("pnpm", ["--filter", "@saydo/daemon", "start"], {
        cwd: ROOT,
        env: {
          ...process.env,
          SAYDO_HOME: FIRST_RUN_HOME,
          SAYDO_DAEMON_PORT: String(FIRST_RUN_PORT),
          SAYDO_MOBILE_LAN: "1"
        },
        stdio: ["ignore", firstRunLogFd, firstRunLogFd],
        detached: true
      });
    } finally {
      closeSync(firstRunLogFd);
    }
    const firstRunToken = await waitForOwnedPlaywrightDaemon({
      url: `http://127.0.0.1:${FIRST_RUN_PORT}/health`, home: FIRST_RUN_HOME, port: FIRST_RUN_PORT,
      children: [firstRunDaemon], what: "fresh first-run daemon", logPath: firstRunLogPath
    });

    // vite dev(47120):proxy 指向测试 daemon——api.ts 同源化后 dev 路径的真实回归(任务⑤)
    vite = spawn("pnpm", ["--filter", "@saydo/console", "exec", "vite", "--port", String(VITE_PORT), "--strictPort"], {
      cwd: ROOT,
      env: { ...process.env, SAYDO_DAEMON_ORIGIN: `http://127.0.0.1:${PORT}` },
      stdio: "ignore",
      detached: true
    });
    await waitForOwnedPlaywrightDaemon({
      url: `http://127.0.0.1:${VITE_PORT}/health`, home: HOME, port: PORT,
      children: [daemon, vite], what: "vite dev (owned proxy /health)"
    });

    writeFileSync(
      RUNTIME,
      JSON.stringify({
        runRoot: state.root,
        evidenceRoot,
        home: HOME,
        token,
        lanAddress,
        firstRunToken,
        firstRunPort: FIRST_RUN_PORT,
        pid: daemon.pid,
        firstRunPid: firstRunDaemon.pid,
        vitePid: vite.pid
      })
    );
    wroteRuntime = true;
  } catch (err) {
    try { await stopChildren(); }
    catch (cleanupErr) { throw new AggregateError([err, cleanupErr], "Playwright setup failed and owned state retained"); }
    try {
      if (wroteRuntime) rmSync(RUNTIME, { force: true });
      rmSync(state.root, { recursive: true, force: true });
    } catch (cleanupErr) {
      throw new AggregateError([err, cleanupErr], "Playwright setup failed and owned state cleanup failed");
    }
    throw err;
  }
  return async () => {
    await stopChildren();
    try {
      if (wroteRuntime && existsSync(RUNTIME) && JSON.parse(readFileSync(RUNTIME, "utf8")).runRoot === state.root) {
        rmSync(RUNTIME, { force: true });
      }
    } finally {
      rmSync(state.root, { recursive: true, force: true });
    }
  };
}
