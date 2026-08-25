// 本轮 worker 唯一 testRoot/tmpRoot exact-set。外层 teardown 在 worker 退出后断言不存在。
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function hostTmpdir(explicit?: string): string {
  return explicit ?? process.env["SAYDO_HOST_TMPDIR"] ?? realpathSync(tmpdir());
}

export function exactRootsDir(hostTmp = hostTmpdir()): string {
  return join(hostTmp, "saydo-exact-roots");
}

export function registerExactTestRoot(path: string, hostTmp = hostTmpdir()): void {
  const dir = exactRootsDir(hostTmp);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${String(process.pid)}.json`);
  let paths: string[] = [];
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as unknown;
    if (Array.isArray(parsed)) paths = parsed.filter((item): item is string => typeof item === "string");
  } catch {
    paths = [];
  }
  if (!paths.includes(path)) paths.push(path);
  writeFileSync(file, JSON.stringify(paths));
}

export function listExactTestRootLeftovers(hostTmp = hostTmpdir()): string[] {
  const dir = exactRootsDir(hostTmp);
  if (!existsSync(dir)) return [];
  const existing: string[] = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".json")) continue;
    const file = join(dir, name);
    let paths: string[] = [];
    try {
      const parsed = JSON.parse(readFileSync(file, "utf8")) as unknown;
      if (!Array.isArray(parsed)) throw new Error("not array");
      paths = parsed.filter((item): item is string => typeof item === "string");
    } catch (err) {
      existing.push(`${file}:清单损坏:${String(err)}`);
      continue;
    }
    for (const path of paths) {
      if (existsSync(path)) existing.push(path);
    }
  }
  return existing;
}

export function assertExactTestRootsGone(hostTmp = hostTmpdir()): void {
  const dir = exactRootsDir(hostTmp);
  if (!existsSync(dir)) return;
  const existing: string[] = [];
  const lists: { file: string; paths: string[] }[] = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".json")) continue;
    const file = join(dir, name);
    let paths: string[] = [];
    try {
      const parsed = JSON.parse(readFileSync(file, "utf8")) as unknown;
      if (!Array.isArray(parsed)) throw new Error("not array");
      paths = parsed.filter((item): item is string => typeof item === "string");
    } catch (err) {
      existing.push(`${file}:清单损坏:${String(err)}`);
      lists.push({ file, paths: [] });
      continue;
    }
    lists.push({ file, paths });
    for (const path of paths) {
      if (existsSync(path)) existing.push(path);
    }
  }
  const assertError = existing.length > 0 ? new Error(`测试根未回收:${existing.join(";")}`) : null;
  let sweepError: unknown;
  try {
    for (const { file, paths } of lists) {
      for (const path of paths) {
        if (!existsSync(path)) continue;
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
  } catch (err) {
    sweepError ??= err;
  }
  if (assertError) {
    if (sweepError) assertError.cause = sweepError;
    throw assertError;
  }
  if (sweepError) throw sweepError;
}
