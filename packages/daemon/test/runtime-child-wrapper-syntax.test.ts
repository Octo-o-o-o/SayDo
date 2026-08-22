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
});
