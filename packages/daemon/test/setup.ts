import fs, { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, vi } from "vitest";
import { nativeSync, setKillOwnedTreeTestHooks, setRestrictOwnerOnlyForTests } from "@saydo/platform";
import { registerExactTestRoot } from "./exact-test-roots.js";

if (process.platform === "win32") {
  nativeSync();
  // 不得把 restrictOwnerOnly mock 成 no-op：Windows 上管理员 token 新建目录的 owner
  // 默认是内置 Administrators，而 restrictOwnerOnlyWin32 的职责之一就是把 owner 改归
  // 当前用户 SID（见其实现注释）。一旦 mock 掉，owner 从未被纠正，随后的
  // assertOwnedByCurrentUser 必然以 "Administrators/SYSTEM owner is not usable" 拒绝，
  // ensureManagedWorkspaceRoot 在 setup 阶段抛错 —— 整个 daemon 测试套在真机上无法加载。
  // 这正是 Windows 单测覆盖长期为零的原因。
}

const hostTmp = realpathSync(tmpdir());
process.env["SAYDO_HOST_TMPDIR"] = hostTmp;
const testRoot = mkdtempSync(join(hostTmp, "saydo-vitest-state-"));
// 测试期把 TMPDIR 重定向到独立 root:全部 mkdtempSync(join(tmpdir(), ...)) fixture
// 随本 worker 的 afterAll 一并回收,不再散落系统临时区(2026-08-12 曾清出 89GB 残留)。
// os.tmpdir() 每次调用动态读 TMPDIR,故对之后加载的所有测试与子进程生效。
// tmpRoot 用顶层短前缀而非嵌套进 testRoot,且保持 /var symlink 形态(不 realpath,
// 与重定向前 tmpdir() 的返回一致):unix socket 路径上限 104 字节(macOS sun_path),
// 多一层嵌套或多 8 字节的 /private 前缀都会让 fixture 内 tier1-gate.sock 超限。
const tmpRoot = mkdtempSync(join(tmpdir(), "saydo-t-"));
registerExactTestRoot(testRoot, hostTmp);
registerExactTestRoot(tmpRoot, hostTmp);
process.env["TMPDIR"] = tmpRoot;
process.env["TEMP"] = tmpRoot;
process.env["TMP"] = tmpRoot;
process.env["SAYDO_HOME"] = join(testRoot, ".saydo");
const { ensureManagedWorkspaceRoot } = await import("../src/projects/workspace.js");
ensureManagedWorkspaceRoot();
const { closeTrackedDatabases } = await import("../src/storage/db.js");
const { resetByoaProviderForTests } = await import("../src/providers/byoa/provider.js");
const { resetRuntimeChildLifecycleForTests, setRuntimeChildTestHooks } = await import("../src/runtimeChildRegistry.js");
const { setRestartPolicyTestHooks } = await import("../src/tier1/restartPolicy.js");
const { setDaemonStartupHooks } = await import("../src/daemonStartupHooks.js");

function rmBestEffort(path: string, opts?: fs.RmOptions): void {
  const options = { recursive: true, force: true, maxRetries: 20, retryDelay: 25, ...opts };
  try {
    rmSync(path, options);
  } catch (err) {
    if (process.platform !== "win32" || (err as NodeJS.ErrnoException).code !== "EBUSY") throw err;
    closeTrackedDatabases();
    rmSync(path, options);
  }
}

if (process.platform === "win32") {
  fs.rmSync = ((path: fs.PathLike, opts?: fs.RmOptions) => {
    rmBestEffort(String(path), opts);
  }) as typeof fs.rmSync;
}

// afterAll 之外再挂 exit 钩子兜底:测试文件整体 skip 时 afterAll 不执行,
// 但 worker 进程退出钩子必跑;rmSync(force) 幂等,双挂无害。
const cleanup = () => {
  closeTrackedDatabases();
  rmBestEffort(testRoot);
  rmBestEffort(tmpRoot);
  setRestrictOwnerOnlyForTests(null);
};
afterAll(cleanup);
afterEach(() => {
  vi.useRealTimers();
  setKillOwnedTreeTestHooks(null);
  setRuntimeChildTestHooks(null);
  setRestartPolicyTestHooks(null);
  setDaemonStartupHooks(null);
  resetByoaProviderForTests();
  try {
    resetRuntimeChildLifecycleForTests();
  } catch {
    // 跨文件不得把上一文件的 leak/contamination 带到下一文件
  }
});
process.on("exit", cleanup);
// tinypool 用 SIGTERM 杀 worker。整文件 skip 时 afterAll 不跑，且 SIGTERM 默认不触发
// 'exit' 钩子，setupFiles 登记的 testRoot/tmpRoot 会残留。SIGTERM 上同步回收，
// 然后摘掉监听并回投信号，恢复默认终止语义；清理抛错也不得吞掉终止。
process.on("SIGTERM", () => {
  try {
    cleanup();
  } finally {
    process.removeAllListeners("SIGTERM");
    process.kill(process.pid, "SIGTERM");
  }
});
