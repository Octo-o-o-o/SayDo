import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { assertRealDirectory, fsIdentity, restrictOwnerOnly } from "../src/fs.js";
import { hostKind } from "../src/host.js";
import { nativeSync } from "../src/win32.js";

const roots: string[] = [];
afterEach(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
  roots.length = 0;
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
    const root = mkdtempSync(join(tmpdir(), "saydo-plat-"));
    roots.push(root);
    const f = join(root, "secret");
    writeFileSync(f, "x");
    restrictOwnerOnly(f, "file");
    expect(readFileSync(f, "utf8")).toBe("x");
    expect(assertRealDirectory(root)).toBeDefined();
  });
});
