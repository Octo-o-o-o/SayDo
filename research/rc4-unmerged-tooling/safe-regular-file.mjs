#!/usr/bin/env node
// 以 no-follow 打开的同一 fd 读取普通文件,拒绝 symlink/目录/设备,并核对 open 前后 fstat。

import { closeSync, constants, fstatSync, lstatSync, openSync, readSync } from "node:fs";
import { join, resolve } from "node:path";

function assertRegularStat(stat, label) {
  if (stat.isSymbolicLink()) throw new Error(`${label}-symlink`);
  if (stat.isDirectory()) throw new Error(`${label}-directory`);
  if (!stat.isFile()) throw new Error(`${label}-non-regular`);
}

export function readRepoRegularFile(repo, relativePath, options = {}) {
  const parts = String(relativePath)
    .split("/")
    .filter(Boolean);
  if (parts.length === 0) throw new Error("current-file-missing");
  let current = resolve(repo);
  for (let index = 0; index < parts.length; index += 1) {
    current = join(current, parts[index]);
    let stat;
    try {
      stat = lstatSync(current);
    } catch {
      throw new Error("current-file-missing");
    }
    const last = index === parts.length - 1;
    if (stat.isSymbolicLink()) throw new Error("current-file-symlink");
    if (last) assertRegularStat(stat, "current-file");
    else if (!stat.isDirectory()) throw new Error("current-file-non-regular");
  }
  const flags = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0);
  let fd;
  try {
    fd = openSync(current, flags);
  } catch {
    throw new Error("current-file-open");
  }
  try {
    if (typeof options.afterOpen === "function") {
      options.afterOpen(current, fd);
    }
    const before = fstatSync(fd);
    assertRegularStat(before, "current-fd");
    const buf = Buffer.alloc(before.size);
    let offset = 0;
    while (offset < buf.length) {
      const n = readSync(fd, buf, offset, buf.length - offset, offset);
      if (n === 0) break;
      offset += n;
    }
    if (offset !== before.size) throw new Error("current-file-size-drift");
    const after = fstatSync(fd);
    if (
      after.dev !== before.dev ||
      after.ino !== before.ino ||
      after.mode !== before.mode ||
      after.nlink !== before.nlink ||
      after.size !== before.size
    ) {
      throw new Error("current-file-replaced");
    }
    assertRegularStat(after, "current-fd");
    let pathStat;
    try {
      pathStat = lstatSync(current);
    } catch {
      throw new Error("current-file-replaced");
    }
    if (
      pathStat.isSymbolicLink() ||
      !pathStat.isFile() ||
      pathStat.dev !== after.dev ||
      pathStat.ino !== after.ino ||
      pathStat.mode !== after.mode ||
      pathStat.nlink !== after.nlink ||
      pathStat.size !== after.size
    ) {
      throw new Error("current-file-replaced");
    }
    const buffer = buf.subarray(0, offset);
    if (options.detail === true) {
      return { buffer, stat: after, absolute: current };
    }
    return buffer;
  } finally {
    closeSync(fd);
  }
}
