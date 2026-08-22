import { execFileSync } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { processAlive } from "@saydo/platform";
import { configureRuntimeChildRegistry, execRuntimeChild, signalRuntimeChildTree, spawnRuntimeChild } from "../src/runtimeChildRegistry.js";

const homes = new Set<string>();

afterEach(() => {
  for (const home of homes) rmSync(home, { recursive: true, force: true });
  homes.clear();
});

function home(): string {
  const path = mkdtempSync(join(tmpdir(), "saydo-runtime-child-"));
  homes.add(path);
  configureRuntimeChildRegistry(path);
  return path;
}

function runtimeWrapperChildren(): number[] {
  if (process.platform === "win32") return [];
  try {
    // 只统计本测试 worker 的直接子进程，避免并发 suite 的其它 saydo-child 污染断言。
    const raw = execFileSync("pgrep", ["-P", String(process.pid), "-lf", "saydo-child-"], { encoding: "utf8" });
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => Number(line.split(/\s+/u)[0]))
      .filter((pid) => Number.isInteger(pid) && pid > 1);
  } catch {
    return [];
  }
}

describe("runtime child durable ownership", () => {
  it("registry 根损坏时在 spawn 前拒绝且不遗留 wrapper", async () => {
    const root = home();
    const marker = join(root, "target-started");
    writeFileSync(join(root, "runtime"), "not-a-directory");
    const before = runtimeWrapperChildren();

    expect(() => spawnRuntimeChild(
      process.execPath,
      ["-e", "require('node:fs').writeFileSync(process.argv[1], 'started')", marker],
      { stdin: "ignore", stdout: "ignore", stderr: "ignore" },
      "test"
    )).toThrow();

    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(existsSync(marker)).toBe(false);
    expect(runtimeWrapperChildren()).toEqual(before);
  });

  it("短命 managed command 不把 wrapper 自己的 ps 探针误认作后代", async () => {
    home();
    const startedAt = Date.now();
    await expect(execRuntimeChild(process.platform === "win32" ? "git" : "/usr/bin/git", ["--version"])).resolves.toMatchObject({
      stdout: expect.stringContaining("git version")
    });
    expect(Date.now() - startedAt).toBeLessThan(2000);
  });

  it("durable birth owner 建立前不执行目标进程", async () => {
    const root = home();
    const marker = join(root, "target-started");
    const spawned = spawnRuntimeChild(
      process.execPath,
      [
        "-e",
        "const fs=require('node:fs'),p=require('node:path');const root=process.argv[1],marker=process.argv[2];const name=fs.readdirSync(p.join(root,'runtime','children'))[0];const owner=JSON.parse(fs.readFileSync(p.join(root,'runtime','children',name),'utf8'));fs.writeFileSync(marker,String(owner.processStart))",
        root,
        marker
      ],
      { stdin: "ignore", stdout: "ignore", stderr: "ignore" },
      "test"
    );
    await once(spawned.child, "spawn");
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(existsSync(marker)).toBe(false);

    await spawned.lease.establish();
    await once(spawned.child, "close");
    spawned.lease.release();
    expect(readFileSync(marker, "utf8")).not.toBe("null");
  });

  it("daemon 在 permit 前硬退时 wrapper 收口且目标未执行", async () => {
    const root = home();
    const marker = join(root, "target-started");
    const spawned = spawnRuntimeChild(
      process.execPath,
      ["-e", "require('node:fs').writeFileSync(process.argv[1], 'started')", marker],
      { stdin: "ignore", stdout: "ignore", stderr: "ignore" },
      "test"
    );
    await once(spawned.child, "spawn");
    if (!spawned.child.pid) throw new Error("wrapper 未获得 pid");
    signalRuntimeChildTree(spawned.child.pid, "SIGKILL");
    await once(spawned.child, "close");
    spawned.lease.release();
    expect(existsSync(marker)).toBe(false);
    expect(processAlive(spawned.child.pid)).toBe(false);
  });

  it("目标退出后 wrapper 先回收同组孙进程再退出", async () => {
    const root = home();
    const marker = join(root, "grandchild.pid");
    const spawned = spawnRuntimeChild(
      process.execPath,
      [
        "-e",
        "const {spawn}=require('node:child_process'),fs=require('node:fs');const c=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});fs.writeFileSync(process.argv[1],String(c.pid));c.unref();process.exit(0)",
        marker
      ],
      { stdin: "ignore", stdout: "ignore", stderr: "ignore" },
      "test"
    );
    await once(spawned.child, "spawn");
    await spawned.lease.establish();
    await once(spawned.child, "close");
    spawned.lease.release();
    const grandchildPid = Number(readFileSync(marker, "utf8"));
    expect(() => process.kill(grandchildPid, 0)).toThrow();
    expect(processAlive(spawned.child.pid!)).toBe(false);
  });

  it("后代 argv 伪装 ps 探针片段也不能逃逸收口", async () => {
    const root = home();
    const marker = join(root, "sentinel-grandchild.pid");
    const sentinel = " -ax -o pid= -o pgid= -o command=";
    const spawned = spawnRuntimeChild(
      process.execPath,
      [
        "-e",
        "const {spawn}=require('node:child_process'),fs=require('node:fs');const c=spawn(process.execPath,['-e','setInterval(()=>{},1000)',process.argv[2]],{stdio:'ignore'});fs.writeFileSync(process.argv[1],String(c.pid));c.unref();process.exit(0)",
        marker,
        sentinel
      ],
      { stdin: "ignore", stdout: "ignore", stderr: "ignore" },
      "test"
    );
    await once(spawned.child, "spawn");
    await spawned.lease.establish();
    await once(spawned.child, "close");
    spawned.lease.release();
    const grandchildPid = Number(readFileSync(marker, "utf8"));
    expect(() => process.kill(grandchildPid, 0)).toThrow();
  });

  it("后代 process.title 精确伪装 ps 探针也不能逃逸收口", async () => {
    const root = home();
    const marker = join(root, "title-grandchild.pid");
    const title = "/bin/ps -ax -o pid= -o pgid= -o command=";
    const spawned = spawnRuntimeChild(
      process.execPath,
      [
        "-e",
        "const {spawn}=require('node:child_process'),fs=require('node:fs');const c=spawn(process.execPath,['-e','process.title=process.argv[1];setInterval(()=>{},1000)',process.argv[2]],{stdio:'ignore'});fs.writeFileSync(process.argv[1],String(c.pid));c.unref();process.exit(0)",
        marker,
        title
      ],
      { stdin: "ignore", stdout: "ignore", stderr: "ignore" },
      "test"
    );
    await once(spawned.child, "spawn");
    await spawned.lease.establish();
    await once(spawned.child, "close");
    spawned.lease.release();
    const grandchildPid = Number(readFileSync(marker, "utf8"));
    expect(() => process.kill(grandchildPid, 0)).toThrow();
  });
});
