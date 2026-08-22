import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { hostKind } from "./host.js";
import {
  assignPidToJobWin32,
  closeJobHandleWin32,
  createNamedJobWin32,
  nativeSync,
  processBirthWin32,
  terminateNamedJobWin32,
  type Win32Job
} from "./win32.js";

export interface KillClaim {
  pid: number;
  expectedBirth: string;
  jobName?: string;
}

export interface NamedJob {
  name: string;
  handle: unknown;
}

function posixBirthFromPs(pid: number): string | null {
  try {
    const ps = existsSync("/bin/ps") ? "/bin/ps" : existsSync("/usr/bin/ps") ? "/usr/bin/ps" : "ps";
    const raw = execFileSync(ps, ["-o", "lstart=", "-p", String(pid)], {
      encoding: "utf8",
      timeout: 2_000
    }).trim();
    return raw || null;
  } catch {
    return null;
  }
}

function linuxBirthFromProc(pid: number): string | null {
  try {
    const stat = readFileSync(`/proc/${String(pid)}/stat`, "utf8");
    const close = stat.lastIndexOf(")");
    if (close < 0) return null;
    const rest = stat.slice(close + 2).split(" ");
    const starttime = rest[19];
    if (!starttime) return null;
    return `ticks:${starttime}:${String(pid)}`;
  } catch {
    return null;
  }
}

export function processBirth(pid: number): string | null {
  if (!Number.isInteger(pid) || pid <= 0) return null;
  const kind = hostKind();
  if (kind === "win32") {
    nativeSync();
    return processBirthWin32(pid);
  }
  if (kind === "linux") return linuxBirthFromProc(pid);
  return posixBirthFromPs(pid);
}

export function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ESRCH") return false;
    if ((err as NodeJS.ErrnoException).code === "EPERM") return true;
    throw err;
  }
}

function groupAlive(pid: number): boolean {
  if (hostKind() === "win32") return processAlive(pid);
  try {
    process.kill(-pid, 0);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ESRCH") return false;
    if ((err as NodeJS.ErrnoException).code === "EPERM") return true;
    throw err;
  }
}

export async function killOwnedTree(claim: KillClaim): Promise<void> {
  const { pid, expectedBirth, jobName } = claim;
  if (!expectedBirth) throw new Error("killOwnedTree requires expectedBirth");
  const observed = processBirth(pid);
  if (observed !== null && observed !== expectedBirth) {
    throw new Error("killOwnedTree birth identity mismatch");
  }
  if (hostKind() === "win32") {
    if (!jobName) throw new Error("killOwnedTree on win32 requires jobName");
    nativeSync();
    if (observed === null && processAlive(pid)) {
      throw new Error("killOwnedTree birth identity unavailable while process alive");
    }
    const outcome = terminateNamedJobWin32(jobName);
    if (outcome === "missing") {
      if (processAlive(pid)) throw new Error("killOwnedTree job missing while process alive");
      return;
    }
    const deadline = Date.now() + 5_000;
    while (processAlive(pid) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    if (processAlive(pid)) throw new Error("killOwnedTree job drain timeout");
    return;
  }
  if (observed === null) {
    if (processAlive(pid) || groupAlive(pid)) {
      throw new Error("killOwnedTree birth identity unavailable while process/group alive");
    }
    return;
  }
  try {
    process.kill(-pid, "SIGKILL");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ESRCH") throw err;
  }
  const deadline = Date.now() + 5_000;
  while (groupAlive(pid) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  if (groupAlive(pid)) throw new Error("killOwnedTree process group drain timeout");
}

export function createNamedJob(name: string): NamedJob {
  if (hostKind() !== "win32") throw new Error("createNamedJob is win32-only");
  nativeSync();
  return createNamedJobWin32(name);
}

export function assignPidToJob(job: NamedJob, pid: number): void {
  if (hostKind() !== "win32") throw new Error("assignPidToJob is win32-only");
  assignPidToJobWin32(job as Win32Job, pid);
}

export function closeNamedJob(job: NamedJob): void {
  if (hostKind() !== "win32") return;
  closeJobHandleWin32(job as Win32Job);
}
