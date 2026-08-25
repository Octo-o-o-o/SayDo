import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assertExactTestRootsGone, registerExactTestRoot } from "./exact-test-roots.js";

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
    const dir = join(hostTmp, "saydo-exact-roots");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${String(process.pid)}.json`), "{bad");
    expect(() => assertExactTestRootsGone(hostTmp)).toThrow(/测试根未回收/u);
  });
});
