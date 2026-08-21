import fs, { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll } from "vitest";
import { nativeSync, setRestrictOwnerOnlyForTests } from "@saydo/platform";

if (process.platform === "win32") {
  nativeSync();
  setRestrictOwnerOnlyForTests(() => undefined);
  const ignoreReset = (err: unknown): boolean => {
    const code = (err as NodeJS.ErrnoException | undefined)?.code;
    return code === "ECONNRESET" || code === "EPIPE";
  };
  process.on("uncaughtException", (err) => {
    if (ignoreReset(err)) return;
    throw err;
  });
  process.on("unhandledRejection", (err) => {
    if (ignoreReset(err)) return;
    throw err;
  });
}

const testRoot = mkdtempSync(join(realpathSync(tmpdir()), "saydo-vitest-state-"));
// 测试期把 TMPDIR 重定向到独立 root:全部 mkdtempSync(join(tmpdir(), ...)) fixture
// 随本 worker 的 afterAll 一并回收,不再散落系统临时区(2026-08-12 曾清出 89GB 残留)。
// os.tmpdir() 每次调用动态读 TMPDIR,故对之后加载的所有测试与子进程生效。
// tmpRoot 用顶层短前缀而非嵌套进 testRoot,且保持 /var symlink 形态(不 realpath,
// 与重定向前 tmpdir() 的返回一致):unix socket 路径上限 104 字节(macOS sun_path),
// 多一层嵌套或多 8 字节的 /private 前缀都会让 fixture 内 tier1-gate.sock 超限。
const tmpRoot = mkdtempSync(join(tmpdir(), "saydo-t-"));
process.env["TMPDIR"] = tmpRoot;
process.env["TEMP"] = tmpRoot;
process.env["TMP"] = tmpRoot;
process.env["SAYDO_HOME"] = join(testRoot, ".saydo");
const { ensureManagedWorkspaceRoot } = await import("../src/projects/workspace.js");
ensureManagedWorkspaceRoot();
const { closeTrackedDatabases } = await import("../src/storage/db.js");

function rmBestEffort(path: string, opts?: fs.RmOptions): void {
  const options = { recursive: true, force: true, maxRetries: 20, retryDelay: 25, ...opts };
  try {
    rmSync(path, options);
  } catch (err) {
    if (process.platform !== "win32" || (err as NodeJS.ErrnoException).code !== "EBUSY") throw err;
    closeTrackedDatabases();
    try {
      rmSync(path, options);
    } catch (retryErr) {
      if ((retryErr as NodeJS.ErrnoException).code !== "EBUSY") throw retryErr;
    }
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
process.on("exit", cleanup);
