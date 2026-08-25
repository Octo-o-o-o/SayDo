#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import {
  closeSync,
  constants as fsConstants,
  fstatSync,
  fsyncSync,
  ftruncateSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
  writeSync
} from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { encodeEvidenceBody, openatSupported, selectAnchoredMethod, viewAnchoredResult } from "./release-openat.mjs";

export const WEEK_AUDIT_WRITE_OUTPUTS = [
  "docs/review/2026-08-22-week-audit-ledger.md",
  "research/week-audit/2026-08-22-ledger.json",
  "research/week-audit/2026-08-22-semantic-review.json",
  "research/week-audit/2026-08-22-bundle-integrity.json",
  "research/week-audit/2026-08-23-publication-manifest.json",
  "research/week-audit/2026-08-23-remediation-ledger.json",
  "docs/review/2026-08-23-remediation-ledger.md"
];

function invariant(value, message) {
  if (!value) throw new Error(message);
}

function wrapFsError(error) {
  return error instanceof Error ? error : new Error(String(error));
}

function existsViaLstat(path, io) {
  try {
    io.lstat(path);
    return true;
  } catch (error) {
    if (readErrorCode(error) === "ENOENT") return false;
    throw error;
  }
}

export const defaultFsIo = {
  exists: (path) => existsViaLstat(path, { lstat: lstatSync }),
  lstat: lstatSync,
  readFile: (path, options) => readFileSync(path, options),
  writeFile: (path, bytes, options) => writeFileSync(path, bytes, options),
  rename: renameSync,
  rm: (path) => rmSync(path, { recursive: true, force: true }),
  mkdir: (path) => mkdirSync(path, { recursive: true }),
  readdir: (path) => readdirSync(path),
  open: openSync,
  fstat: fstatSync,
  ftruncate: ftruncateSync,
  write: writeSync,
  fsync: fsyncSync,
  close: closeSync
};

function isRegularFileStat(stat) {
  try {
    return Boolean(
      stat &&
        typeof stat.isSymbolicLink === "function" &&
        stat.isSymbolicLink() === false &&
        typeof stat.isFile === "function" &&
        stat.isFile() === true &&
        (typeof stat.isFIFO !== "function" || stat.isFIFO() === false) &&
        (typeof stat.isSocket !== "function" || stat.isSocket() === false) &&
        (typeof stat.isDirectory !== "function" || stat.isDirectory() === false) &&
        (typeof stat.isBlockDevice !== "function" || stat.isBlockDevice() === false) &&
        (typeof stat.isCharacterDevice !== "function" || stat.isCharacterDevice() === false)
    );
  } catch {
    return false;
  }
}

function wrapIoError(_error, fallback) {
  return new Error(fallback);
}

export function readErrorCode(error) {
  try {
    if (error === null || error === undefined) return undefined;
    const kind = typeof error;
    if (kind !== "object" && kind !== "function") return undefined;
    let desc;
    try {
      desc = Object.getOwnPropertyDescriptor(error, "code");
    } catch {
      return undefined;
    }
    if (!desc || typeof desc.get === "function" || typeof desc.set === "function" || !Object.prototype.hasOwnProperty.call(desc, "value")) {
      return undefined;
    }
    return desc.value;
  } catch {
    return undefined;
  }
}

export function assertAnchoredParentChain(filePath, io = defaultFsIo) {
  invariant(typeof filePath === "string" && filePath.length > 0, "部署证据路径非法");
  const absolute = resolve(filePath);
  const parent = dirname(absolute);
  invariant(parent !== absolute, "部署证据路径非法");
  const lstat = typeof io?.lstat === "function" ? io.lstat.bind(io) : lstatSync;
  const parts = parent.split(sep).filter(Boolean);
  let start = 0;
  while (start < parts.length) {
    const prefix = `${sep}${parts.slice(0, start + 1).join(sep)}`;
    let stat;
    try {
      stat = lstat(prefix);
    } catch {
      throw new Error("部署证据路径非法");
    }
    if (typeof stat?.isSymbolicLink === "function" && stat.isSymbolicLink()) {
      start += 1;
      continue;
    }
    break;
  }
  for (let index = start; index < parts.length; index += 1) {
    const prefix = `${sep}${parts.slice(0, index + 1).join(sep)}`;
    let stat;
    try {
      stat = lstat(prefix);
    } catch {
      throw new Error("部署证据路径非法");
    }
    if (typeof stat?.isSymbolicLink === "function" && stat.isSymbolicLink()) {
      throw new Error("部署证据路径非法");
    }
    if (typeof stat?.isDirectory !== "function" || stat.isDirectory() !== true) {
      throw new Error("部署证据路径非法");
    }
  }
}

export function writeFdFully(io, fd, content) {
  const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content);
  let offset = 0;
  while (offset < bytes.length) {
    let wrote;
    try {
      wrote = io.write(fd, bytes.subarray(offset));
    } catch (error) {
      throw wrapIoError(error, "部署证据写入失败");
    }
    if (typeof wrote !== "number" || !Number.isInteger(wrote) || wrote <= 0 || wrote > bytes.length - offset) {
      throw new Error("部署证据写入失败");
    }
    offset += wrote;
  }
}

export function replaceRegularFileInPlace(path, content, expectedIdentity, io = defaultFsIo) {
  invariant(typeof path === "string" && path.length > 0, "部署证据路径非法");
  if (!openatSupported()) throw new Error("部署证据路径非法");
  const encoded = encodeEvidenceBody(content);
  if (encoded.invalid) throw new Error("部署证据写入失败");
  let persist;
  try {
    persist = selectAnchoredMethod(io, "persist");
  } catch {
    throw new Error("部署证据写入失败");
  }
  let result;
  try {
    result = persist(path, encoded.text, expectedIdentity);
  } catch {
    throw new Error("部署证据写入失败");
  }
  const view = viewAnchoredResult(result, "persist");
  if (view.ok) return;
  if (view.error === "拒绝覆盖非普通文件" || view.error === "既有部署证据不是普通文件") {
    throw new Error("拒绝覆盖非普通文件");
  }
  if (view.error === "部署证据租约已失效") throw new Error("部署证据租约已失效");
  throw new Error("部署证据写入失败");
}

function sameBytes(left, right) {
  if (left === null || right === null) return left === right;
  return Buffer.from(left).equals(Buffer.from(right));
}

function lstatOrMissing(path, io) {
  try {
    return io.lstat(path);
  } catch (error) {
    if (readErrorCode(error) === "ENOENT") return null;
    throw error;
  }
}

export function assertSafeDirMemberName(name) {
  const value = String(name ?? "");
  invariant(
    value.length > 0 &&
      !value.includes("/") &&
      !value.includes("\\") &&
      value !== "." &&
      value !== ".." &&
      !value.includes("..") &&
      !/^[A-Za-z]:/.test(value) &&
      !value.startsWith("/") &&
      !/[\u0000-\u001f]/u.test(value),
    `目录成员名非法:${value}`
  );
  return value;
}

function assertSafeNestedRelative(relative) {
  invariant(typeof relative === "string" && relative.length > 0, "快照相对路径为空");
  invariant(!relative.includes("\\") && !relative.startsWith("/") && !/^[A-Za-z]:/.test(relative), `快照相对路径非法:${relative}`);
  const segments = relative.split("/");
  invariant(
    segments.every((segment) => segment && segment !== "." && segment !== ".." && !/[\u0000-\u001f]/u.test(segment)),
    `快照相对路径含空段或穿越:${relative}`
  );
  return relative;
}

function isPathAncestor(parent, child) {
  const prefix = parent.endsWith(sep) ? parent : `${parent}${sep}`;
  return child === parent || child.startsWith(prefix);
}

export function assertLegalSnapshotPaths(paths) {
  invariant(Array.isArray(paths) && paths.length > 0, "事务快照路径不能为空");
  const unique = [...new Set(paths.map((path) => resolve(path)))];
  for (let index = 0; index < unique.length; index += 1) {
    for (let other = index + 1; other < unique.length; other += 1) {
      invariant(
        !isPathAncestor(unique[index], unique[other]) && !isPathAncestor(unique[other], unique[index]),
        `snapshot 路径重叠:${unique[index]} ${unique[other]}`
      );
    }
  }
  return unique;
}

function listRegularFiles(root, io, prefix = "") {
  const files = {};
  for (const name of [...io.readdir(root)].sort()) {
    const relative = prefix ? `${prefix}/${name}` : name;
    assertSafeNestedRelative(relative);
    const full = join(root, name);
    const stat = io.lstat(full);
    invariant(!stat.isSymbolicLink(), `快照含 symlink:${full}`);
    if (stat.isDirectory()) {
      Object.assign(files, listRegularFiles(full, io, relative));
      continue;
    }
    invariant(stat.isFile(), `快照含非普通文件:${full}`);
    files[relative] = io.readFile(full);
  }
  return files;
}

export function capturePathSnapshot(paths, io = defaultFsIo) {
  const unique = assertLegalSnapshotPaths(paths);
  return unique.map((path) => {
    const stat = lstatOrMissing(path, io);
    if (!stat) return { path, existed: false, kind: "missing", bytes: null, files: null };
    invariant(!stat.isSymbolicLink(), `拒绝快照 symlink:${path}`);
    if (stat.isDirectory()) {
      return { path, existed: true, kind: "dir", bytes: null, files: listRegularFiles(path, io) };
    }
    invariant(stat.isFile(), `拒绝快照非普通文件:${path}`);
    return { path, existed: true, kind: "file", bytes: io.readFile(path), files: null };
  });
}

function cleanupTemp(temp, io) {
  try {
    io.rm(temp);
  } catch (error) {
    return wrapFsError(error);
  }
  return null;
}

function assertReplaceableFileTarget(path, io) {
  const stat = lstatOrMissing(path, io);
  if (!stat) return;
  invariant(!stat.isSymbolicLink(), `拒绝覆盖 symlink:${path}`);
  invariant(stat.isFile(), `拒绝覆盖非普通文件:${path}`);
}

export function writeFileAtomic(path, content, io = defaultFsIo) {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
  assertReplaceableFileTarget(path, io);
  io.mkdir(dirname(path));
  const temp = join(dirname(path), `.${randomUUID()}.${basename(path)}.tmp`);
  try {
    io.writeFile(temp, buffer, { flag: "wx" });
    assertReplaceableFileTarget(path, io);
    io.rename(temp, path);
  } catch (error) {
    const cleanupError = cleanupTemp(temp, io);
    if (cleanupError) {
      throw new AggregateError([wrapFsError(error), cleanupError], `atomic file write failed; temp cleanup failed:${temp}`);
    }
    throw error;
  }
}

export function writeDirAtomic(path, files, io = defaultFsIo) {
  invariant(Array.isArray(files) && files.length > 0, "原子目录写入需要非空文件集");
  invariant(!existsViaLstat(path, io), `拒绝覆盖已存在路径:${path}`);
  const temp = `${path}.partial-${randomUUID()}`;
  io.mkdir(temp);
  try {
    for (const file of files) {
      const name = assertSafeDirMemberName(file?.name);
      io.writeFile(join(temp, name), Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content), {
        flag: "wx"
      });
    }
    io.rename(temp, path);
  } catch (error) {
    const cleanupError = cleanupTemp(temp, io);
    if (cleanupError) {
      throw new AggregateError([wrapFsError(error), cleanupError], `atomic dir write failed; partial cleanup failed:${temp}`);
    }
    throw error;
  }
}

function restoreOne(entry, io) {
  if (!entry.existed) {
    if (existsViaLstat(entry.path, io)) io.rm(entry.path);
    return;
  }
  if (entry.kind === "file") {
    const current = lstatOrMissing(entry.path, io);
    if (current && !current.isFile()) io.rm(entry.path);
    writeFileAtomic(entry.path, entry.bytes, io);
    return;
  }
  const temp = `${entry.path}.partial-${randomUUID()}`;
  try {
    io.mkdir(temp);
    for (const [relative, bytes] of Object.entries(entry.files ?? {})) {
      assertSafeNestedRelative(relative);
      const full = join(temp, relative);
      io.mkdir(dirname(full));
      io.writeFile(full, bytes, { flag: "wx" });
    }
    if (existsViaLstat(entry.path, io)) io.rm(entry.path);
    io.rename(temp, entry.path);
  } catch (error) {
    const cleanupError = cleanupTemp(temp, io);
    if (cleanupError) {
      throw new AggregateError([wrapFsError(error), cleanupError], `restore dir failed; partial cleanup failed:${temp}`);
    }
    throw error;
  }
}

export function restorePathSnapshot(snapshot, io = defaultFsIo) {
  const failures = [];
  for (const entry of snapshot) {
    try {
      restoreOne(entry, io);
    } catch (error) {
      failures.push(wrapFsError(error));
    }
  }
  return failures;
}

export function assertPathSnapshot(snapshot, io = defaultFsIo) {
  for (const entry of snapshot) {
    const stat = lstatOrMissing(entry.path, io);
    if (!entry.existed) {
      invariant(!stat, `回滚后仍残留事务前不存在的路径:${entry.path}`);
      continue;
    }
    invariant(stat, `回滚后丢失事务前已存在的路径:${entry.path}`);
    invariant(!stat.isSymbolicLink(), `回滚后出现 symlink:${entry.path}`);
    if (entry.kind === "file") {
      invariant(stat.isFile(), `回滚后路径类型漂移:${entry.path}`);
      invariant(sameBytes(io.readFile(entry.path), entry.bytes), `回滚后文件字节不一致:${entry.path}`);
      continue;
    }
    invariant(stat.isDirectory(), `回滚后目录类型漂移:${entry.path}`);
    const actual = listRegularFiles(entry.path, io);
    const expectedNames = Object.keys(entry.files ?? {}).sort();
    const actualNames = Object.keys(actual).sort();
    invariant(
      JSON.stringify(actualNames) === JSON.stringify(expectedNames),
      `回滚后目录成员不一致:${entry.path}:${JSON.stringify({ expectedNames, actualNames })}`
    );
    for (const name of expectedNames) {
      invariant(sameBytes(actual[name], entry.files[name]), `回滚后目录文件字节不一致:${entry.path}/${name}`);
    }
  }
}

export function writeWeekAuditOutputs(files, writeAtomic = writeFileAtomic) {
  invariant(Array.isArray(files) && files.length === WEEK_AUDIT_WRITE_OUTPUTS.length, "week-audit 输出数量必须恰好为 7");
  for (const [path, content] of files) writeAtomic(path, content);
}

export async function runMutationsWithRollback({ snapshotPaths, mutate, preflight, afterPreflight, io = defaultFsIo }) {
  const unique = assertLegalSnapshotPaths(snapshotPaths);
  const snapshot = capturePathSnapshot(unique, io);
  if (preflight) await preflight({ snapshot, io });
  if (afterPreflight) await afterPreflight({ snapshot, io });
  let mutateEntered = false;
  try {
    try {
      assertPathSnapshot(snapshot, io);
    } catch (error) {
      throw new Error(`第一次 mutation 前工作树已偏离 snapshot:${error.message}`);
    }
    mutateEntered = true;
    await mutate({
      writeAtomic: (path, content) => writeFileAtomic(path, content, io),
      writeDirAtomic: (path, files) => writeDirAtomic(path, files, io),
      io,
      snapshot
    });
  } catch (mutationError) {
    if (!mutateEntered) throw mutationError;
    const rollbackErrors = restorePathSnapshot(snapshot, io);
    try {
      assertPathSnapshot(snapshot, io);
    } catch (verifyError) {
      rollbackErrors.push(wrapFsError(verifyError));
    }
    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [wrapFsError(mutationError), ...rollbackErrors],
        `mutation failed; rollback failures=${rollbackErrors.length}`
      );
    }
    throw mutationError;
  }
  return snapshot;
}
