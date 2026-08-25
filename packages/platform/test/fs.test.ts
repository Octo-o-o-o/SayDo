import { fstatSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { assertRealDirectory, fsIdentity, fsyncDir, fsyncOpenFlagForHost, restrictOwnerOnly, setFsyncSyncImplForTests } from "../src/fs.js";
import { hostKind } from "../src/host.js";
import { nativeSync, win32OwnerTightenAction } from "../src/win32.js";

const roots: string[] = [];
afterEach(() => {
  setFsyncSyncImplForTests(null);
  for (const r of roots) rmSync(r, { recursive: true, force: true });
  roots.length = 0;
});

describe("fsyncDir 平台分支与降级", () => {
  it("Windows 目录与文件都用 r+，POSIX 用 r", () => {
    expect(fsyncOpenFlagForHost("file", "win32")).toBe("r+");
    expect(fsyncOpenFlagForHost("dir", "win32")).toBe("r+");
    expect(fsyncOpenFlagForHost("file", "darwin")).toBe("r");
    expect(fsyncOpenFlagForHost("dir", "linux")).toBe("r");
  });

  it("对本机目录调用不抛", () => {
    const root = mkdtempSync(join(tmpdir(), "saydo-plat-"));
    roots.push(root);
    const result = fsyncDir(root);
    expect(result === "synced" || result === "unsupported").toBe(true);
  });

  it("目录 fsync EPERM/EIO 必须 fail-closed，EINVAL 才是 unsupported", () => {
    const root = mkdtempSync(join(tmpdir(), "saydo-plat-fsync-"));
    roots.push(root);
    setFsyncSyncImplForTests((fd) => {
      const st = fstatSync(fd);
      if (!st.isDirectory()) throw new Error("expected dir fd");
      const err = new Error("eperm") as NodeJS.ErrnoException;
      Object.defineProperty(err, "code", { value: "EPERM" });
      throw err;
    });
    expect(() => fsyncDir(root)).toThrow(/eperm|EPERM/u);
    setFsyncSyncImplForTests((fd) => {
      const st = fstatSync(fd);
      if (!st.isDirectory()) throw new Error("expected dir fd");
      const err = new Error("eio") as NodeJS.ErrnoException;
      Object.defineProperty(err, "code", { value: "EIO" });
      throw err;
    });
    expect(() => fsyncDir(root)).toThrow(/eio|EIO/u);
    setFsyncSyncImplForTests((fd) => {
      const st = fstatSync(fd);
      if (!st.isDirectory()) throw new Error("expected dir fd");
      const err = new Error("einval") as NodeJS.ErrnoException;
      Object.defineProperty(err, "code", { value: "EINVAL" });
      throw err;
    });
    expect(fsyncDir(root)).toBe("unsupported");
  });

  it("目录不存在必须 fail-closed，不得报 unsupported", () => {
    expect(() => fsyncDir(join(tmpdir(), "saydo-missing-dir-fsync-nope"))).toThrow();
  });
});

describe("fsIdentity", () => {
  it("同一路径两次 identity 相等,不同目录不相等", () => {
    const root = mkdtempSync(join(tmpdir(), "saydo-plat-"));
    roots.push(root);
    const a = fsIdentity(root);
    expect(a.path).toBe(root);
    expect(a.dev.length).toBeGreaterThan(0);
    expect(a.ino.length).toBeGreaterThan(0);
    expect(fsIdentity(root)).toEqual(a);
    const other = mkdtempSync(join(tmpdir(), "saydo-plat-"));
    roots.push(other);
    expect(fsIdentity(other).ino).not.toBe(a.ino);
  });
});

describe("restrictOwnerOnly", () => {
  it("写入后当前用户仍可读,不抛", () => {
    if (hostKind() === "win32") nativeSync();
    // assertRealDirectory 要求 lexical === realpath;macOS 的 $TMPDIR 本身经 /var -> /private/var 符号链接。
    const root = mkdtempSync(join(realpathSync(tmpdir()), "saydo-plat-"));
    roots.push(root);
    const f = join(root, "secret");
    writeFileSync(f, "x");
    restrictOwnerOnly(f, "file");
    expect(readFileSync(f, "utf8")).toBe("x");
    expect(assertRealDirectory(root)).toBeDefined();
  });

  it("Win32 owner 收紧只修复 Administrators，SYSTEM 与陌生 SID 保持拒绝", () => {
    const current = "S-1-5-21-1000";
    expect(win32OwnerTightenAction(current, current)).toBe("keep");
    expect(win32OwnerTightenAction("S-1-5-32-544", current)).toBe("reassign_administrators");
    expect(win32OwnerTightenAction("S-1-5-18", current)).toBe("reject_system");
    expect(win32OwnerTightenAction("S-1-5-21-2000", current)).toBe("reject_foreign");
    expect(win32OwnerTightenAction("S-1-5-18", "S-1-5-18")).toBe("reject_system");
    expect(win32OwnerTightenAction("S-1-5-32-544", "S-1-5-18")).toBe("reject_system");
    expect(win32OwnerTightenAction("S-1-5-32-544", "S-1-5-32-544")).toBe("reject_foreign");
  });
});
