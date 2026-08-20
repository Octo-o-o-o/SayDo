import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll } from "vitest";

// 测试期把 TMPDIR 重定向进独立 root,fixture 随 afterAll 一并回收(与 daemon 包同款,
// 残留兜底清扫由 daemon 包的 globalSetup 按 saydo- 前缀统一负责)。
const tmpRoot = mkdtempSync(join(realpathSync(tmpdir()), "saydo-cli-vitest-"));
process.env["TMPDIR"] = tmpRoot;

// exit 钩子兜底:测试文件整体 skip 时 afterAll 不执行;rmSync(force) 幂等。
const cleanup = () => {
  rmSync(tmpRoot, { recursive: true, force: true });
};
afterAll(cleanup);
process.on("exit", cleanup);
