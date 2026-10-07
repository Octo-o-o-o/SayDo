import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertExactTestRootsGone,
  currentTestRunId,
  exactRootsDir,
  isOwnedTestRoot,
  registerExactTestRoot,
  sweepStaleExactRoots
} from "./exact-test-roots.js";

const DEAD_PID = 4_194_304;

describe("exact-test-roots 先断言后清扫", () => {
  it("预置泄漏路径时 assert 必须 throw，清扫成功也不能把本次改成通过", () => {
    const hostTmp = mkdtempSync(join(tmpdir(), "saydo-exact-host-"));
    const leaked = mkdtempSync(join(hostTmp, "leaked-"));
    writeFileSync(join(leaked, "keep.txt"), "x");
    registerExactTestRoot(leaked, hostTmp);
    expect(existsSync(leaked)).toBe(true);
    expect(() => assertExactTestRootsGone(hostTmp)).toThrow(/测试根未回收/u);
    expect(existsSync(leaked)).toBe(false);
    expect(() => assertExactTestRootsGone(hostTmp)).not.toThrow();
  });

  it("清单损坏时也失败，且不得靠清扫把本次改绿", () => {
    const hostTmp = mkdtempSync(join(tmpdir(), "saydo-exact-host-"));
    const dir = exactRootsDir(hostTmp);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${String(process.pid)}.json`), "{bad");
    expect(() => assertExactTestRootsGone(hostTmp)).toThrow(/测试根未回收/u);
  });

  it("登记的越界路径报错且不被删除", () => {
    const hostTmp = mkdtempSync(join(tmpdir(), "saydo-exact-host-"));
    const foreign = mkdtempSync(join(tmpdir(), "not-saydo-foreign-"));
    registerExactTestRoot(foreign, hostTmp);
    expect(() => assertExactTestRootsGone(hostTmp)).toThrow(/登记越界未清/u);
    expect(existsSync(foreign)).toBe(true);
  });

  it("跨 run 死进程清单:只清登记且验证归属的根", () => {
    const hostTmp = mkdtempSync(join(tmpdir(), "saydo-exact-host-"));
    const staleRun = join(hostTmp, "saydo-exact-roots", "stale-run");
    mkdirSync(staleRun, { recursive: true });
    const owned = mkdtempSync(join(hostTmp, "saydo-stale-"));
    const foreign = mkdtempSync(join(tmpdir(), "not-saydo-foreign-"));
    writeFileSync(join(staleRun, `${String(DEAD_PID)}.json`), JSON.stringify({ runId: "stale-run", paths: [owned, foreign] }));
    const leftovers = sweepStaleExactRoots(hostTmp, hostTmp);
    expect(existsSync(owned)).toBe(false);
    expect(existsSync(foreign)).toBe(true);
    expect(leftovers.some((l) => l.includes("登记越界未清"))).toBe(true);
  });

  it("活 pid 的跨 run 清单不动", () => {
    const hostTmp = mkdtempSync(join(tmpdir(), "saydo-exact-host-"));
    const liveRun = join(hostTmp, "saydo-exact-roots", "live-run");
    mkdirSync(liveRun, { recursive: true });
    const owned = mkdtempSync(join(hostTmp, "saydo-live-other-"));
    writeFileSync(join(liveRun, `${String(process.pid)}.json`), JSON.stringify({ runId: "live-run", paths: [owned] }));
    const leftovers = sweepStaleExactRoots(hostTmp, hostTmp);
    expect(existsSync(owned)).toBe(true);
    expect(leftovers).toEqual([]);
    expect(existsSync(join(liveRun, `${String(process.pid)}.json`))).toBe(true);
  });

  it("本 run 清单带 runId 落盘", () => {
    const hostTmp = mkdtempSync(join(tmpdir(), "saydo-exact-host-"));
    const root = mkdtempSync(join(hostTmp, "saydo-registered-"));
    registerExactTestRoot(root, hostTmp);
    const file = join(exactRootsDir(hostTmp), `${String(process.pid)}.json`);
    const manifest = JSON.parse(readFileSync(file, "utf8")) as { runId?: string; paths?: string[] };
    expect(manifest.runId).toBe(process.env["SAYDO_TEST_RUN_ID"] ?? "unscoped");
    expect(manifest.paths).toContain(root);
  });

  it("归属判定:saydo- 沙盒内可清,沙盒外与前缀外不可清", () => {
    const hostTmp = mkdtempSync(join(tmpdir(), "saydo-exact-host-"));
    const inside = mkdtempSync(join(hostTmp, "anything-"));
    const foreign = mkdtempSync(join(tmpdir(), "not-saydo-foreign-"));
    expect(isOwnedTestRoot(inside, hostTmp, hostTmp)).toBe(true);
    expect(isOwnedTestRoot(foreign, hostTmp, hostTmp)).toBe(false);
    const plainTmp = mkdtempSync(join(tmpdir(), "plaintmp-"));
    const saydoDir = join(plainTmp, "saydo-x");
    mkdirSync(saydoDir);
    expect(isOwnedTestRoot(saydoDir, plainTmp, plainTmp)).toBe(true);
    expect(isOwnedTestRoot(plainTmp, plainTmp, plainTmp)).toBe(false);
  });
});


describe("登记清单不能遗忘同进程的旧根", () => {
  function sandbox() {
    const hostTmp = mkdtempSync(join(tmpdir(), "saydo-exact-register-"));
    const oldRoot = mkdtempSync(join(hostTmp, "old-"));
    const newRoot = mkdtempSync(join(hostTmp, "new-"));
    const file = join(exactRootsDir(hostTmp), `${String(process.pid)}.json`);
    return { hostTmp, oldRoot, newRoot, file, cleanup: () => rmSync(hostTmp, { recursive: true, force: true }) };
  }

  it("首次建立、多次追加及重复登记都保留旧集合；泄漏先失败再清扫", () => {
    const f = sandbox();
    try {
      registerExactTestRoot(f.oldRoot, f.hostTmp);
      registerExactTestRoot(f.newRoot, f.hostTmp);
      registerExactTestRoot(f.oldRoot, f.hostTmp);
      expect(JSON.parse(readFileSync(f.file, "utf8"))).toEqual({
        runId: currentTestRunId(), paths: [f.oldRoot, f.newRoot]
      });
      rmSync(f.newRoot, { recursive: true });
      expect(existsSync(f.oldRoot)).toBe(true);
      expect(() => assertExactTestRootsGone(f.hostTmp)).toThrow(/测试根未回收/u);
      expect(existsSync(f.oldRoot)).toBe(false);
      expect(() => assertExactTestRootsGone(f.hostTmp)).not.toThrow();
    } finally { f.cleanup(); }
  });

  it.each([
    { label: "JSON语法损坏", invalid: () => "{bad" },
    { label: "paths形状损坏", invalid: () => JSON.stringify({ runId: currentTestRunId(), paths: "unknown" }) },
    { label: "paths夹杂非字符串", invalid: (old: string) => JSON.stringify({ runId: currentTestRunId(), paths: [old, 7] }) },
    { label: "run归属不一致", invalid: (old: string) => JSON.stringify({ runId: "another-run", paths: [old] }) }
  ])("$label 时登记必须拒绝且保持原字节", ({ invalid }) => {
    const f = sandbox();
    try {
      registerExactTestRoot(f.oldRoot, f.hostTmp);
      const damaged = Buffer.from(invalid(f.oldRoot));
      writeFileSync(f.file, damaged);
      expect(() => registerExactTestRoot(f.newRoot, f.hostTmp)).toThrow();
      expect(readFileSync(f.file)).toEqual(damaged);
      rmSync(f.newRoot, { recursive: true });
      expect(existsSync(f.oldRoot)).toBe(true);
      expect(() => assertExactTestRootsGone(f.hostTmp)).toThrow(/测试根未回收/u);
    } finally { f.cleanup(); }
  });

  it.each(["array", "object"] as const)("合法legacy %s 登记保留旧根并由原归属门清扫", (shape) => {
    const f = sandbox();
    try {
      mkdirSync(exactRootsDir(f.hostTmp), { recursive: true });
      writeFileSync(f.file, JSON.stringify(shape === "array" ? [f.oldRoot] : { paths: [f.oldRoot] }));
      registerExactTestRoot(f.newRoot, f.hostTmp);
      expect(JSON.parse(readFileSync(f.file, "utf8"))).toEqual({
        runId: currentTestRunId(), paths: [f.oldRoot, f.newRoot]
      });
      rmSync(f.newRoot, { recursive: true });
      expect(() => assertExactTestRootsGone(f.hostTmp)).toThrow(/测试根未回收/u);
      expect(existsSync(f.oldRoot)).toBe(false);
      expect(() => assertExactTestRootsGone(f.hostTmp)).not.toThrow();
    } finally { f.cleanup(); }
  });

  it("实际读取失败不能退回空清单写入；已有目录与哨兵字节保持", () => {
    const f = sandbox();
    try {
      mkdirSync(f.file, { recursive: true });
      const sentinel = join(f.file, "keep.txt");
      writeFileSync(sentinel, "原读失败对象");
      expect(() => registerExactTestRoot(f.newRoot, f.hostTmp)).toThrow(/测试根清单读取失败/u);
      expect(lstatSync(f.file).isDirectory()).toBe(true);
      expect(readFileSync(sentinel, "utf8")).toBe("原读失败对象");
    } finally { f.cleanup(); }
  });

  it.skipIf(process.platform === "win32")("悬空链接并非文件缺失，不得新建链接指向的清单", () => {
    const f = sandbox();
    try {
      mkdirSync(exactRootsDir(f.hostTmp), { recursive: true });
      const absentTarget = join(f.hostTmp, "missing-target.json");
      symlinkSync(absentTarget, f.file);
      expect(() => registerExactTestRoot(f.newRoot, f.hostTmp)).toThrow(/测试根清单读取失败/u);
      expect(lstatSync(f.file).isSymbolicLink()).toBe(true);
      expect(existsSync(absentTarget)).toBe(false);
    } finally { f.cleanup(); }
  });
});
