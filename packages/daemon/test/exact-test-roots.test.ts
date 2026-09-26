import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertExactTestRootsGone,
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
