import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll } from "vitest";

const testRoot = mkdtempSync(join(realpathSync(tmpdir()), "saydo-vitest-state-"));
// 测试期把 TMPDIR 重定向到独立 root:全部 mkdtempSync(join(tmpdir(), ...)) fixture
// 随本 worker 的 afterAll 一并回收,不再散落系统临时区(2026-08-12 曾清出 89GB 残留)。
// os.tmpdir() 每次调用动态读 TMPDIR,故对之后加载的所有测试与子进程生效。
// tmpRoot 用顶层短前缀而非嵌套进 testRoot,且保持 /var symlink 形态(不 realpath,
// 与重定向前 tmpdir() 的返回一致):unix socket 路径上限 104 字节(macOS sun_path),
// 多一层嵌套或多 8 字节的 /private 前缀都会让 fixture 内 tier1-gate.sock 超限。
const tmpRoot = mkdtempSync(join(tmpdir(), "saydo-t-"));
process.env["TMPDIR"] = tmpRoot;
process.env["SAYDO_HOME"] = join(testRoot, ".saydo");
const { ensureManagedWorkspaceRoot } = await import("../src/projects/workspace.js");
ensureManagedWorkspaceRoot();

// afterAll 之外再挂 exit 钩子兜底:测试文件整体 skip 时 afterAll 不执行,
// 但 worker 进程退出钩子必跑;rmSync(force) 幂等,双挂无害。
const cleanup = () => {
  rmSync(testRoot, { recursive: true, force: true });
  rmSync(tmpRoot, { recursive: true, force: true });
};
afterAll(cleanup);
process.on("exit", cleanup);
