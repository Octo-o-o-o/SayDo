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
