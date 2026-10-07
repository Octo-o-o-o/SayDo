import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { processAnchor, processBirth } from "@saydo/platform";
import { runOwned } from "../src/supervisor.js";

const fixture = fileURLToPath(new URL("./fixtures/owned-daemon-exit.mjs", import.meta.url));
const homes = new Set<string>();
const pids = new Set<number>();
const envKeys = [
  "SAYDO_TEST_SCENARIO",
  "SAYDO_TEST_AGENT_GEN",
  "SAYDO_TEST_RUN_ID",
  "SAYDO_TEST_FOREIGN_HOME",
  "SAYDO_TEST_FOREIGN_GEN",
  "SAYDO_TEST_RELEASE"
] as const;

afterEach(async () => {
  for (const key of envKeys) delete process.env[key];
  // 启动或断言提前失败时也收回 fixture 已登记的子进程。
  for (const home of homes) {
    if (existsSync(join(home, "SAYDO_TEST_AGENT_PID"))) trackAgentPid(home);
  }
  for (const pid of pids) {
    try { process.kill(pid, "SIGKILL"); } catch { /* 已退出 */ }
  }
  try {
    await Promise.all([...pids].map((pid) => expect.poll(() => alive(pid), { timeout: 5_000 }).toBe(false)));
  } finally {
    pids.clear();
    for (const home of homes) rmSync(home, { recursive: true, force: true });
    homes.clear();
  }
});

function tempHome(prefix: string): string {
  const value = mkdtempSync(join(tmpdir(), prefix));
  homes.add(value);
  return value;
}

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  return port;
}

async function waitForFile(path: string, timeoutMs = 8_000): Promise<void> {
  const started = Date.now();
  while (!existsSync(path)) {
    if (Date.now() - started > timeoutMs) throw new Error(`timeout waiting ${path}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

function trackAgentPid(home: string): number {
  const raw = readFileSync(join(home, "SAYDO_TEST_AGENT_PID"), "utf8").trim();
  const pid = Number(raw);
  if (!Number.isInteger(pid) || pid <= 0) throw new Error("agent pid missing");
  pids.add(pid);
  return pid;
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function startOwned(home: string, extraEnv: Record<string, string>): Promise<{
  pending: Promise<void>;
  port: number;
}> {
  for (const [key, value] of Object.entries(extraEnv)) process.env[key] = value;
  const consoleDist = join(home, "console-dist");
  mkdirSync(consoleDist, { recursive: true });
  const port = await freePort();
  const pending = runOwned({
    home,
    port,
    paths: { daemon: fixture, consoleDist },
    openBrowser: false,
    attachSignals: false
  });
  await waitForFile(join(home, "SAYDO_TEST_READY"));
  return { pending, port };
}

describe("runOwned 生产路径:daemon 退出后按捕获身份 reap", () => {
  it("临时 daemon 退出且 agent 仍活时必须回收", async () => {
    const home = tempHome("saydo-owned-reap-");
    const gen = randomUUID();
    const { pending } = await startOwned(home, {
      SAYDO_TEST_SCENARIO: "reap",
      SAYDO_TEST_AGENT_GEN: gen,
      SAYDO_TEST_RUN_ID: "run_owned_reap"
    });
    const pid = trackAgentPid(home);
    expect(alive(pid)).toBe(true);
    const owner = JSON.parse(readFileSync(join(home, "tier1", "runs", "run_owned_reap", "agent-owner.json"), "utf8"));
    expect(owner.processStart).toBe(processBirth(pid));
    expect(processAnchor(pid)?.pgid).toBe(pid);
    await expect(pending).rejects.toThrow(/owned daemon 意外退出/u);
    await expect.poll(() => alive(pid), { timeout: 5_000 }).toBe(false);
    expect(existsSync(join(home, "tier1", "runs", "run_owned_reap", "agent-owner.json"))).toBe(false);
  }, 20_000);

  it("foreign HOME 上的 agent 不得误杀", async () => {
    const home = tempHome("saydo-owned-home-");
    const foreign = tempHome("saydo-owned-foreign-");
    const gen = randomUUID();
    const foreignGen = randomUUID();
    const { pending } = await startOwned(home, {
      SAYDO_TEST_SCENARIO: "foreign",
      SAYDO_TEST_AGENT_GEN: gen,
      SAYDO_TEST_RUN_ID: "run_owned_reap",
      SAYDO_TEST_FOREIGN_HOME: foreign,
      SAYDO_TEST_FOREIGN_GEN: foreignGen
    });
    const ownPid = trackAgentPid(home);
    const foreignPid = trackAgentPid(foreign);
    await expect(pending).rejects.toThrow(/owned daemon 意外退出/u);
    await expect.poll(() => alive(ownPid), { timeout: 5_000 }).toBe(false);
    expect(alive(foreignPid)).toBe(true);
    expect(existsSync(join(foreign, "tier1", "runs", "run_foreign", "agent-owner.json"))).toBe(true);
  }, 20_000);

  it("CAS successor 覆盖锁后不得 reap", async () => {
    const home = tempHome("saydo-owned-successor-");
    const gen = randomUUID();
    const release = join(home, "SAYDO_TEST_RELEASE");
    const { pending } = await startOwned(home, {
      SAYDO_TEST_SCENARIO: "successor",
      SAYDO_TEST_AGENT_GEN: gen,
      SAYDO_TEST_RUN_ID: "run_owned_reap",
      SAYDO_TEST_RELEASE: release
    });
    const pid = trackAgentPid(home);
    writeFileSync(join(home, ".daemon-supervisor.lock"), JSON.stringify({
      version: 1,
      pid: 424243,
      processStart: "successor-birth",
      instanceId: "successor-instance"
    }));
    writeFileSync(release, "1");
    await expect(pending).rejects.toThrow(/owned daemon 意外退出/u);
    expect(alive(pid)).toBe(true);
    expect(existsSync(join(home, "tier1", "runs", "run_owned_reap", "agent-owner.json"))).toBe(true);
  }, 20_000);

  it("agent PID 复用(错误 birth)不得误杀", async () => {
    const home = tempHome("saydo-owned-reuse-");
    const gen = randomUUID();
    const { pending } = await startOwned(home, {
      SAYDO_TEST_SCENARIO: "wrong-birth",
      SAYDO_TEST_AGENT_GEN: gen,
      SAYDO_TEST_RUN_ID: "run_owned_reap"
    });
    const pid = trackAgentPid(home);
    await expect(pending).rejects.toThrow(/identity mismatch/u);
    expect(alive(pid)).toBe(true);
    expect(existsSync(join(home, "tier1", "runs", "run_owned_reap", "agent-owner.json"))).toBe(true);
  }, 20_000);

  it("birth 正确但实际 pgid 不是 agent PID 时不得误杀", async () => {
    const home = tempHome("saydo-owned-pgid-");
    const { pending } = await startOwned(home, {
      SAYDO_TEST_SCENARIO: "wrong-pgid",
      SAYDO_TEST_AGENT_GEN: randomUUID(),
      SAYDO_TEST_RUN_ID: "run_owned_reap"
    });
    const pid = trackAgentPid(home);
    const ownerPath = join(home, "tier1", "runs", "run_owned_reap", "agent-owner.json");
    const owner = JSON.parse(readFileSync(ownerPath, "utf8"));
    expect(owner.processStart).toBe(processBirth(pid));
    const anchor = processAnchor(pid);
    expect(anchor).not.toBeNull();
    expect(anchor?.pgid).not.toBe(pid);
    await expect(pending).rejects.toThrow(/identity unverified/u);
    expect(alive(pid)).toBe(true);
    expect(existsSync(ownerPath)).toBe(true);
  }, 20_000);
});
