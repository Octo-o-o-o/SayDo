import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { isAbsolute, join } from "node:path";

interface AgentOwner {
  version: 1;
  runId: string;
  pid: number;
  binary: string;
  processStart: string;
  ownerPid?: number;
  ownerInstanceId?: string;
}

interface RuntimeChildOwner {
  version: 1;
  pid: number;
  kind: string;
  binary: string;
  processStart: string | null;
  ownerPid: number;
  ownerInstanceId?: string;
  commandToken?: string;
}

function groupAlive(pid: number): boolean {
  try {
    process.kill(-pid, 0);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ESRCH") return false;
    if ((err as NodeJS.ErrnoException).code === "EPERM") return true;
    throw err;
  }
}

function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ESRCH") return false;
    if ((err as NodeJS.ErrnoException).code === "EPERM") return true;
    throw err;
  }
}

async function killGroupAndWait(pid: number, timeoutMessage: string): Promise<void> {
  try {
    process.kill(-pid, "SIGKILL");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ESRCH") throw err;
  }
  const deadline = Date.now() + 5_000;
  while (groupAlive(pid)) {
    if (Date.now() >= deadline) throw new Error(timeoutMessage);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

function processStart(pid: number, binary: string, commandToken?: string): string | null {
  if (process.platform === "win32") return null;
  try {
    const options = { encoding: "utf8" as const, timeout: 2_000 };
    const ps = existsSync("/bin/ps") ? "/bin/ps" : existsSync("/usr/bin/ps") ? "/usr/bin/ps" : "ps";
    const fields = execFileSync(
      ps,
      ["-o", "pgid=", "-o", "lstart=", "-o", "command=", "-p", String(pid)],
      options
    ).trim().split(/\s+/u);
    const pgid = Number(fields[0]);
    const started = fields.slice(1, 6).join(" ");
    const command = fields.slice(6).join(" ");
    if (pgid !== pid || !command.includes(binary) || (commandToken && !command.includes(commandToken))) return null;
    return started || null;
  } catch {
    // ps 不可用时回退 pgrep 命令行身份（与 daemon restartPolicy 同源口径）。
    try {
      const base = binary.split("/").pop() ?? binary;
      const pattern = commandToken && commandToken.length >= 8 ? commandToken : base.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
      const raw = execFileSync("pgrep", ["-lf", pattern], { encoding: "utf8", timeout: 2_000 });
      const line = raw
        .split("\n")
        .map((item) => item.trim())
        .find((item) => item === String(pid) || item.startsWith(`${String(pid)} `));
      if (!line) throw new Error("pgrep miss");
      if (!line.includes(base) && !line.includes(binary)) throw new Error("binary miss");
      if (commandToken && !line.includes(commandToken)) throw new Error("token miss");
      return `pgrep1:${line.slice(0, 240)}`;
    } catch {
      if (commandToken && commandToken.length >= 12) {
        try {
          process.kill(pid, 0);
          const base = binary.split("/").pop() ?? binary;
          return `token1:${pid}:${base}:${commandToken}`;
        } catch {
          return null;
        }
      }
      return null;
    }
  }
}

function readLegacyPid(runDir: string): number | null {
  try {
    const pid = Number(readFileSync(join(runDir, "agent.pid"), "utf8").trim());
    return Number.isInteger(pid) && pid > 1 ? pid : null;
  } catch {
    return null;
  }
}

function readOwner(runDir: string, runId: string): AgentOwner | null {
  try {
    const value = JSON.parse(readFileSync(join(runDir, "agent-owner.json"), "utf8")) as Partial<AgentOwner>;
    if (
      value.version !== 1 || value.runId !== runId || !Number.isInteger(value.pid) || (value.pid ?? 0) <= 1 ||
      typeof value.binary !== "string" || !isAbsolute(value.binary) ||
      typeof value.processStart !== "string" || value.processStart === ""
    ) return null;
    return value as AgentOwner;
  } catch {
    return null;
  }
}

/** supervisor 强退兜底：只回收仍能以 birth identity 证明属于本 HOME 的 agent 进程组。 */
export interface OwnedDaemonGeneration {
  pid: number;
  instanceId: string;
}

export async function reapOwnedAgentGroups(
  home: string,
  generation?: OwnedDaemonGeneration
): Promise<number> {
  if (process.platform === "win32") throw new Error("Windows agent process-group reaper 尚未闭环");
  const runsRoot = join(home, "tier1", "runs");
  let reaped = 0;
  const deferredLegacy: { runId: string; pid: number }[] = [];
  for (const entry of existsSync(runsRoot) ? readdirSync(runsRoot, { withFileTypes: true }) : []) {
    if (!entry.isDirectory()) continue;
    const runDir = join(runsRoot, entry.name);
    const owner = readOwner(runDir, entry.name);
    const legacyPid = readLegacyPid(runDir);
    if (!owner) {
      if (legacyPid !== null && groupAlive(legacyPid)) {
        if (!generation) throw new Error(`live agent ownership unverified:${entry.name}`);
        deferredLegacy.push({ runId: entry.name, pid: legacyPid });
      }
      continue;
    }
    if (generation && (owner.ownerPid !== generation.pid || owner.ownerInstanceId !== generation.instanceId)) {
      continue;
    }
    if (legacyPid !== null && legacyPid !== owner.pid) {
      if (groupAlive(legacyPid) || groupAlive(owner.pid)) {
        throw new Error(`agent ownership records disagree:${entry.name}`);
      }
      continue;
    }
    const observedStart = processStart(owner.pid, owner.binary);
    if (observedStart === null) {
      if (processAlive(owner.pid)) throw new Error(`agent ownership identity unverified:${entry.name}`);
      // A4: dead leader 后不得仅凭数值 PGID kill；无法证明成员 birth identity 时 fail-closed。
      if (groupAlive(owner.pid)) {
        throw new Error(`agent process group alive after leader death:${entry.name}`);
      }
      continue;
    }
    if (observedStart !== owner.processStart) {
      throw new Error(`agent ownership identity mismatch:${entry.name}`);
    }
    await killGroupAndWait(owner.pid, `agent process group drain timeout:${entry.name}`);
    reaped += 1;
  }
  const childrenRoot = join(home, "runtime", "children");
  for (const entry of existsSync(childrenRoot) ? readdirSync(childrenRoot, { withFileTypes: true }) : []) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const path = join(childrenRoot, entry.name);
    let owner: RuntimeChildOwner;
    try {
      const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<RuntimeChildOwner>;
      if (
        parsed.version !== 1 || !Number.isInteger(parsed.pid) || (parsed.pid ?? 0) <= 1 ||
        typeof parsed.kind !== "string" || typeof parsed.binary !== "string" ||
        !(typeof parsed.processStart === "string" || parsed.processStart === null) ||
        !Number.isInteger(parsed.ownerPid) ||
        !(parsed.commandToken === undefined || typeof parsed.commandToken === "string")
      ) throw new Error("invalid runtime child owner");
      owner = parsed as RuntimeChildOwner;
    } catch {
      throw new Error(`runtime child ownership record invalid:${entry.name}`);
    }
    if (generation && (owner.ownerPid !== generation.pid || owner.ownerInstanceId !== generation.instanceId)) {
      continue;
    }
    if (!groupAlive(owner.pid)) {
      rmSync(path, { force: true });
      continue;
    }
    if (owner.processStart === null) {
      if (!owner.commandToken || processStart(owner.pid, owner.binary, owner.commandToken) === null) {
        throw new Error(`live runtime child ownership pending:${owner.kind}:${String(owner.pid)}`);
      }
      try {
        process.kill(-owner.pid, "SIGKILL");
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ESRCH") throw err;
      }
      const deadline = Date.now() + 5_000;
      while (groupAlive(owner.pid)) {
        if (Date.now() >= deadline) throw new Error(`pending runtime child drain timeout:${owner.kind}`);
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      rmSync(path, { force: true });
      reaped += 1;
      continue;
    }
    const observedStart = processStart(owner.pid, owner.binary, owner.commandToken);
    if (observedStart === null && !processAlive(owner.pid)) {
      // A4: leader 已死、组仍可能存活时禁止数值 PGID 盲杀。
      if (groupAlive(owner.pid)) {
        throw new Error(`runtime child process group alive after leader death:${owner.kind}:${String(owner.pid)}`);
      }
      rmSync(path, { force: true });
      continue;
    }
    if (observedStart !== owner.processStart) {
      throw new Error(`runtime child ownership identity mismatch:${owner.kind}:${String(owner.pid)}`);
    }
    await killGroupAndWait(owner.pid, `runtime child process group drain timeout:${owner.kind}`);
    rmSync(path, { force: true });
    reaped += 1;
  }
  for (const legacy of deferredLegacy) {
    if (groupAlive(legacy.pid)) throw new Error(`live agent ownership unverified:${legacy.runId}`);
  }
  return reaped;
}
