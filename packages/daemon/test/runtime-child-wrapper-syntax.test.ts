// wrapper 经 `node -e` 在独立进程里执行:语法错不会在 typecheck/lint 暴露,
// 只会让每一个受管子进程静默 process_exit。这里用真实 node 做一次语法自检。
import { execFileSync } from "node:child_process";
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
  // 这里把 PATH 清空模拟「没有任何外部命令」,验证 Linux 走 /proc 仍能发现后代。
  it.skipIf(process.platform !== "linux")("PATH 清空(无 pgrep/ps)时仍能发现同组后代", () => {
    const source = runtimeChildWrapperSource();
    const begin = source.indexOf("function otherGroupPids() {");
    const finish = source.indexOf("function signalOthers(signal)");
    expect(begin).toBeGreaterThan(-1);
    expect(finish).toBeGreaterThan(begin);
    const script = `${source.slice(begin, finish)}
const c = require("node:child_process").spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], { stdio: "ignore" });
setTimeout(() => {
  console.log(JSON.stringify({ child: c.pid, found: otherGroupPids() }));
  try { process.kill(c.pid, "SIGKILL"); } catch {}
  process.exit(0);
}, 200);`;
    const out = execFileSync(process.execPath, ["-e", script], {
      encoding: "utf8",
      env: { PATH: "" },
      timeout: 15_000
    });
    const parsed = JSON.parse(out.trim()) as { child: number; found: number[] };
    expect(parsed.found).toContain(parsed.child);
  });
});
