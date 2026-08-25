// wrapper 经 `node -e` 在独立进程里执行:语法错不会在 typecheck/lint 暴露,
// 只会让每一个受管子进程静默 process_exit。这里用真实 node 做一次语法自检。
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { runtimeChildWrapperSource } from "../src/runtimeChildRegistry.js";

describe("RUNTIME_CHILD_WRAPPER 语法自检", () => {
  it("能被真实 node 解析(--check)", () => {
    const source = runtimeChildWrapperSource();
    expect(source.length).toBeGreaterThan(500);
    expect(() =>
      execFileSync(process.execPath, ["--input-type=commonjs", "--check"], {
        input: source,
        encoding: "utf8",
        timeout: 10_000,
        stdio: ["pipe", "pipe", "pipe"]
      })
    ).not.toThrow();
  });

  it("win32 孙进程 stdout/stderr 不 inherit CRT pipe，改为 pipe 转发且 close 用 exit 码", () => {
    const source = runtimeChildWrapperSource();
    expect(source).toMatch(/const inheritOut = process\.platform !== "win32"/u);
    expect(source).toMatch(/stdio: \[stdinEnded \? "ignore" : "pipe", inheritOut \? "inherit" : "pipe", inheritOut \? "inherit" : "pipe"\]/u);
    expect(source).toMatch(/child\.stdout\.pipe\(process\.stdout, \{ end: false \}\)/u);
    expect(source).toMatch(/child\.stderr\.pipe\(process\.stderr, \{ end: false \}\)/u);
    expect(source).toMatch(/child\.once\("close", \(\) => \{\s*wlog\("child-close"\);\s*drainAndExit\(finalCode\);\s*\}\)/u);
    expect(source).toMatch(/else if \(typeof code === "number"\) finalCode = code/u);
    expect(source).not.toMatch(/stdio: \["pipe", "inherit", "inherit"\]/u);
    expect(source).toMatch(/function flushStdioThenExit\(code\)/u);
    expect(source).toMatch(/if \(process\.platform === "win32"\) flushStdioThenExit\(code\)/u);
    expect(source).toMatch(/else process\.exit\(code\)/u);
    expect(source).toMatch(/stream\._handle\.writeQueueSize/u);
    expect(source).not.toMatch(/setTimeout\(finish, 1000\)/u);
    expect(source).toMatch(/child-stdout-data/u);
    expect(source).not.toMatch(/WRAPPER-SELF-TEST/u);
  });

  it("permit：win32 读命名管道，POSIX 用 createReadStream fd3", () => {
    const source = runtimeChildWrapperSource();
    expect(source).toMatch(/if \(process\.platform === "win32"\)/u);
    expect(source).toMatch(/process\.env\.SAYDO_PERMIT_PIPE/u);
    expect(source).toMatch(/openSync\(pipeName, "r"\)/u);
    expect(source).not.toMatch(/readSync\(3,/u);
    expect(source).toMatch(/createReadStream\(null, \{ fd: 3, autoClose: true \}\)/u);
    expect(source).toMatch(/permit\.once\("data"/u);
    expect(source).toMatch(/permit\.once\("end"/u);
  });

  // 最小部署镜像(node:*-slim、distroless 等)常无 procps。wrapper 靠 otherGroupPids()
  // 找同组后代来收口,pgrep/ps 双缺时若退化成空表,agent 的后代就会静默逃逸。
  // 探针必须 detached(真实 wrapper 也是):否则它不是进程组组长,pgrp 匹配自然为空,测不到目标行为。
  // PATH 清空 = 模拟「没有任何外部命令」。
  it.skipIf(process.platform !== "linux")("PATH 清空(无 pgrep/ps)时仍能发现同组后代", async () => {
    const source = runtimeChildWrapperSource();
    const begin = source.indexOf("function otherGroupPids() {");
    const finish = source.indexOf("function signalOthers(signal)");
    expect(begin).toBeGreaterThan(-1);
    expect(finish).toBeGreaterThan(begin);
    const outFile = join(mkdtempSync(join(tmpdir(), "saydo-wrapper-probe-")), "out.json");
    const script = `${source.slice(begin, finish)}
const c = require("node:child_process").spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], { stdio: "ignore" });
setTimeout(() => {
  require("node:fs").writeFileSync(${JSON.stringify(outFile)}, JSON.stringify({ child: c.pid, found: otherGroupPids() }));
  try { process.kill(c.pid, "SIGKILL"); } catch {}
  process.exit(0);
}, 300);`;
    const probe = spawn(process.execPath, ["-e", script], {
      detached: true,
      stdio: "ignore",
      env: { PATH: "" }
    });
    try {
      await once(probe, "close");
      const parsed = JSON.parse(readFileSync(outFile, "utf8")) as { child: number; found: number[] };
      expect(parsed.found).toContain(parsed.child);
    } finally {
      try { process.kill(-(probe.pid as number), "SIGKILL"); } catch { /* 已退出 */ }
      rmSync(dirname(outFile), { recursive: true, force: true });
    }
  });
});
