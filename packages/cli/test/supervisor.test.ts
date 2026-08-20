import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { homeLockAllowsReap } from "../src/supervisor.js";
import { execFileSync } from "node:child_process";

const homes = new Set<string>();

afterEach(() => {
  for (const home of homes) rmSync(home, { recursive: true, force: true });
  homes.clear();
});

function home(): string {
  const value = mkdtempSync(join(tmpdir(), "saydo-supervisor-home-"));
  homes.add(value);
  return value;
}

describe("startup emergency cleanup ownership", () => {
  it("只允许清理本次 child 的 HOME；另一端口的现役 owner 不受影响", () => {
    const root = home();
    let processStart: string;
    try {
      processStart = execFileSync("ps", ["-o", "lstart=", "-p", String(process.pid)], {
        encoding: "utf8"
      }).trim();
    } catch {
      try {
        const raw = execFileSync("pgrep", ["-lf", "node"], { encoding: "utf8" });
        const line = raw
          .split("\n")
          .map((item) => item.trim())
          .find((item) => item === String(process.pid) || item.startsWith(`${String(process.pid)} `));
        processStart = line ? `pgrep1:${line.slice(0, 240)}` : `alive1:${process.pid}`;
      } catch {
        processStart = `alive1:${process.pid}`;
      }
    }
    writeFileSync(join(root, ".daemon-supervisor.lock"), JSON.stringify({
      version: 1,
      pid: process.pid,
      processStart,
      instanceId: "current-instance"
    }));
    expect(homeLockAllowsReap(root, { pid: process.pid, instanceId: "current-instance" })).toBe(true);
    expect(homeLockAllowsReap(root, { pid: process.pid, instanceId: "other-instance" })).toBe(false);
  });

  it("锁损坏或缺失时都 fail-closed", () => {
    const root = home();
    const lock = join(root, ".daemon-supervisor.lock");
    writeFileSync(lock, "invalid");
    expect(homeLockAllowsReap(root, { pid: process.pid, instanceId: "current-instance" })).toBe(false);
    rmSync(lock);
    expect(homeLockAllowsReap(root, { pid: process.pid, instanceId: "current-instance" })).toBe(false);
  });
});
