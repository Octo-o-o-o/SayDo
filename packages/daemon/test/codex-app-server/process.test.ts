import { spawn, type ChildProcess } from "node:child_process";
import { describe, expect, it } from "vitest";
import { terminateOwnedProcess, type KillTarget } from "../../src/experimental/codex-app-server/processControl.js";

function track(child: ChildProcess): KillTarget {
  let exited = child.exitCode !== null;
  let code: number | null = child.exitCode;
  let signal: NodeJS.Signals | null = null;
  const waiters: Array<(result: { code: number | null; signal: NodeJS.Signals | null }) => void> = [];
  child.on("exit", (exitCode, exitSignal) => {
    exited = true;
    code = exitCode;
    signal = exitSignal;
    for (const waiter of waiters.splice(0)) waiter({ code: exitCode, signal: exitSignal });
  });
  return {
    pid: child.pid ?? 0,
    exited: () => exited,
    wait(ms: number) {
      if (exited) return Promise.resolve({ code, signal });
      return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(null), ms);
        waiters.push((result) => {
          clearTimeout(timer);
          resolve(result);
        });
      });
    }
  };
}

describe("codex app-server process ownership", () => {
  it("只向登记的进程组发 TERM,忽略 TERM 时再 KILL,不碰旁路进程", async () => {
    const ignore = spawn(process.execPath, ["-e", "process.on('SIGTERM', () => {}); process.stdout.write('ready\\n'); setInterval(() => {}, 1000);"], {
      detached: true,
      stdio: ["ignore", "pipe", "ignore"]
    });
    await new Promise<void>((resolve, reject) => {
      ignore.once("error", reject);
      ignore.stdout?.once("data", () => resolve());
    });
    const decoy = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000);"], {
      detached: true,
      stdio: "ignore"
    });
    try {
      const result = await terminateOwnedProcess(track(ignore), { termMs: 200, killMs: 1000 });
      expect(result.sigkill).toBe(true);
      expect(ignore.exitCode).toBeNull();
      expect(decoy.exitCode).toBeNull();
      expect(alive(decoy.pid ?? 0)).toBe(true);
    } finally {
      if (decoy.pid) {
        try {
          process.kill(-decoy.pid, "SIGKILL");
        } catch {
          decoy.kill("SIGKILL");
        }
      }
    }
  });

  it("拒绝把当前进程当成拥有的子进程", async () => {
    await expect(terminateOwnedProcess({
      pid: process.pid,
      exited: () => false,
      wait: () => Promise.resolve(null)
    }, { termMs: 50, killMs: 50 })).rejects.toThrow("refuse_kill_unowned");
    expect(alive(process.pid)).toBe(true);
  });
});

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
