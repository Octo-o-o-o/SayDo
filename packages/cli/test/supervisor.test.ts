import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { processBirth } from "@saydo/platform";
import { cliStopPath, consumeCliStop, homeLockAllowsReap } from "../src/supervisor.js";

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
    const processStart = processBirth(process.pid);
    if (!processStart) throw new Error("本进程 birth 不可用");
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

describe("cli-stop 文件", () => {
  it("按 pid 分文件,白名单 reason 消费后删除,非法内容忽略", () => {
    const root = home();
    mkdirSync(join(root, "runtime"), { recursive: true });
    const path = cliStopPath(root, 4242);
    expect(path).toBe(join(root, "runtime", "cli-stop-4242"));
    writeFileSync(path, "cli_sigint\n");
    expect(consumeCliStop(root, 4242)).toBe("cli_sigint");
    expect(consumeCliStop(root, 4242)).toBeUndefined();
    writeFileSync(cliStopPath(root, 4242), "taskkill\n");
    expect(consumeCliStop(root, 4242)).toBeUndefined();
  });
});
