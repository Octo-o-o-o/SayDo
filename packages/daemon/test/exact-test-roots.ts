// 本轮 worker 唯一 testRoot/tmpRoot exact-set。外层 teardown 在 worker 退出后断言不存在。
// SC-57:清单按 run 隔离,清扫只动本 run 或死进程登记且验证归属的根;
// 损坏清单与越界路径必须报为残留,不能靠删除或未读变 pass。
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, join, relative, resolve, sep } from "node:path";

// $HOME 持久区里只认这些测试自建前缀(与 global-tmp-cleanup.ts 注释同源)。
const HOME_TEST_PREFIXES = [".saydo-anchor-test-", ".saydo-mig14-", ".saydo-live-"];

function hostTmpdir(explicit?: string): string {
  return explicit ?? process.env["SAYDO_HOST_TMPDIR"] ?? realpathSync(tmpdir());
}

export function currentTestRunId(): string {
  return process.env["SAYDO_TEST_RUN_ID"] ?? "unscoped";
}

export function beginExactRootsRun(): string {
  const runId = `${String(process.pid)}-${Date.now().toString(36)}`;
  process.env["SAYDO_TEST_RUN_ID"] = runId;
  return runId;
}

function manifestsBase(hostTmp: string): string {
  return join(hostTmp, "saydo-exact-roots");
}

export function exactRootsDir(hostTmp = hostTmpdir(), runId = currentTestRunId()): string {
  return join(manifestsBase(hostTmp), runId);
}

export function registerExactTestRoot(path: string, hostTmp = hostTmpdir()): void {
  const dir = exactRootsDir(hostTmp);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${String(process.pid)}.json`);
  let paths: string[] = [];
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as unknown;
    if (parsed !== null && typeof parsed === "object" && Array.isArray((parsed as { paths?: unknown }).paths)) {
      paths = (parsed as { paths: unknown[] }).paths.filter((item): item is string => typeof item === "string");
    }
  } catch {
    paths = [];
  }
  if (!paths.includes(path)) paths.push(path);
  writeFileSync(file, JSON.stringify({ runId: currentTestRunId(), paths }));
}

function resolveExisting(path: string): string {
  try {
    if (existsSync(path)) return realpathSync(path);
  } catch {
    // 目录已不在,只按字面路径约束
  }
  return resolve(path);
}

function firstSegmentUnder(root: string, target: string): string | null {
  const rel = relative(root, target);
  if (rel === "" || rel.startsWith("..")) return null;
  return rel.split(sep)[0] ?? null;
}

// 归属规则:hostTmp 本身是 saydo-* 沙盒时整棵子树属测试;否则 hostTmp 下第一段
// 必须 saydo-*。$HOME 下第一段必须命中登记的测试前缀。仓内 cwd 下只认 .saydo-/
// saydo- 首段(tier1-executor 在 POSIX 的 owner 沙盒就在包目录)。其余一律不属本任务。
export function isOwnedTestRoot(path: string, hostTmp = hostTmpdir(), home = homedir(), cwd = process.cwd()): boolean {
  const target = resolveExisting(path);
  const tmp = resolveExisting(hostTmp);
  const tmpSeg = firstSegmentUnder(tmp, target);
  if (tmpSeg !== null) {
    return basename(tmp).startsWith("saydo-") || tmpSeg.startsWith("saydo-");
  }
  const homeRoot = resolveExisting(home);
  const homeSeg = firstSegmentUnder(homeRoot, target);
  if (homeSeg !== null) {
    return basename(homeRoot).startsWith("saydo-") || HOME_TEST_PREFIXES.some((p) => homeSeg.startsWith(p));
  }
  const cwdRoot = resolveExisting(cwd);
  const cwdSeg = firstSegmentUnder(cwdRoot, target);
  if (cwdSeg !== null) {
    return cwdSeg.startsWith(".saydo-") || cwdSeg.startsWith("saydo-");
  }
  return false;
}

type ManifestRead = { runId: string | null; paths: string[]; corrupt?: string };

function readManifest(file: string): ManifestRead {
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as unknown;
    if (Array.isArray(parsed)) {
      // 旧格式(无 runId):按外 run 处理,只能走死进程+归属验证清扫
      return { runId: null, paths: parsed.filter((item): item is string => typeof item === "string") };
    }
    if (parsed !== null && typeof parsed === "object" && Array.isArray((parsed as { paths?: unknown }).paths)) {
      const obj = parsed as { runId?: unknown; paths: unknown[] };
      return {
        runId: typeof obj.runId === "string" ? obj.runId : null,
        paths: obj.paths.filter((item): item is string => typeof item === "string")
      };
    }
    throw new Error("not manifest");
  } catch (err) {
    return { runId: null, paths: [], corrupt: String(err) };
  }
}

function pidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

function* manifestFiles(dir: string): Generator<{ file: string; pid: number }> {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".json")) continue;
    yield { file: join(dir, name), pid: Number.parseInt(basename(name, ".json"), 10) };
  }
}

// 开跑前清死进程遗留:跨 run 的清单只删登记且验证归属的根;活 pid 的清单不动。
// 返回残留描述(损坏/越界/删不掉),调用方据以判失败,不得静默放过。
export function sweepStaleExactRoots(hostTmp = hostTmpdir(), home = homedir(), cwd = process.cwd()): string[] {
  const base = manifestsBase(hostTmp);
  const leftovers: string[] = [];
  if (!existsSync(base)) return leftovers;
  const current = currentTestRunId();
  const sweepManifest = (file: string, pid: number, isCurrentRun: boolean): boolean => {
    if (!isCurrentRun && pidAlive(pid)) return false;
    const manifest = readManifest(file);
    if (manifest.corrupt !== undefined) {
      leftovers.push(`${file}:清单损坏:${manifest.corrupt}`);
      return false;
    }
    let fileClear = true;
    for (const path of manifest.paths) {
      if (!existsSync(path)) continue;
      if (!isOwnedTestRoot(path, hostTmp, home, cwd)) {
        leftovers.push(`${file}:${path}:登记越界未清`);
        fileClear = false;
        continue;
      }
      try {
        rmSync(path, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
      } catch (err) {
        leftovers.push(`${path}:清扫失败:${String(err)}`);
        fileClear = false;
        continue;
      }
      if (existsSync(path)) {
        leftovers.push(`${path}:清扫后仍存在`);
        fileClear = false;
      }
    }
    if (!fileClear) return false;
    try {
      rmSync(file, { force: true });
      return true;
    } catch (err) {
      leftovers.push(`${file}:清单删除失败:${String(err)}`);
      return false;
    }
  };
  for (const name of readdirSync(base)) {
    const entry = join(base, name);
    let isDir = false;
    try {
      isDir = lstatSync(entry).isDirectory();
    } catch {
      leftovers.push(`${entry}:stat失败`);
      continue;
    }
    if (!isDir) {
      // 旧扁平布局:<base>/<pid>.json 按外 run 清单处理
      if (name.endsWith(".json")) {
        sweepManifest(entry, Number.parseInt(basename(name, ".json"), 10), false);
      }
      continue;
    }
    const isCurrentRun = name === current;
    let clear = true;
    for (const { file, pid } of manifestFiles(entry)) {
      if (!sweepManifest(file, pid, isCurrentRun)) clear = false;
    }
    if (clear) {
      try {
        rmSync(entry, { recursive: true, force: true });
      } catch {
        // 残留空 run 目录不算泄漏
      }
    }
  }
  return leftovers;
}

export function listExactTestRootLeftovers(hostTmp = hostTmpdir()): string[] {
  const dir = exactRootsDir(hostTmp);
  const existing: string[] = [];
  for (const { file } of manifestFiles(dir)) {
    const manifest = readManifest(file);
    if (manifest.corrupt !== undefined) {
      existing.push(`${file}:清单损坏:${manifest.corrupt}`);
      continue;
    }
    for (const path of manifest.paths) {
      if (existsSync(path)) existing.push(path);
    }
  }
  return existing;
}

export function assertExactTestRootsGone(hostTmp = hostTmpdir(), home = homedir(), cwd = process.cwd()): void {
  const dir = exactRootsDir(hostTmp);
  const existing: string[] = [];
  const lists: { file: string; paths: string[] }[] = [];
  for (const { file } of manifestFiles(dir)) {
    const manifest = readManifest(file);
    if (manifest.corrupt !== undefined) {
      existing.push(`${file}:清单损坏:${manifest.corrupt}`);
      lists.push({ file, paths: [] });
      continue;
    }
    lists.push({ file, paths: manifest.paths });
    for (const path of manifest.paths) {
      if (!existsSync(path)) continue;
      if (!isOwnedTestRoot(path, hostTmp, home, cwd)) {
        existing.push(`${path}:登记越界未清`);
      } else {
        existing.push(path);
      }
    }
  }
  const assertError = existing.length > 0 ? new Error(`测试根未回收:${existing.join(";")}`) : null;
  let sweepError: unknown;
  try {
    for (const { file, paths } of lists) {
      for (const path of paths) {
        if (!existsSync(path)) continue;
        if (!isOwnedTestRoot(path, hostTmp, home, cwd)) continue;
        try {
          rmSync(path, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
        } catch (err) {
          sweepError ??= err;
        }
        if (existsSync(path)) sweepError ??= new Error(`测试根清扫失败:${path}`);
      }
      try {
        rmSync(file, { force: true });
      } catch (err) {
        sweepError ??= err;
      }
    }
    try {
      if (existsSync(dir) && readdirSync(dir).length === 0) rmSync(dir, { recursive: true, force: true });
    } catch {
      // 残留空 run 目录不算泄漏
    }
  } catch (err) {
    sweepError ??= err;
  }
  if (assertError) {
    if (sweepError) assertError.cause = sweepError;
    throw assertError;
  }
  if (sweepError) throw sweepError;
}
