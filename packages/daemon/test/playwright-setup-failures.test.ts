// 真实私有目录与受控fs故障：只检查创建/清理归属，不启动产品或接管既有端口。
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";

const fault = vi.hoisted(() => ({ point: "", cleanup: false, roots: [] as string[], original: new Error("mkdir 注入失败"), cleanupError: new Error("owned root 清理失败") }));
vi.mock("node:fs", async (original) => {
  const fs = await original<typeof import("node:fs")>();
  return { ...fs,
    mkdtempSync: (prefix: string) => {
      if (fault.point === "evidence-root" && prefix.endsWith("/console-runs/run-")) throw fault.original;
      const root = fs.mkdtempSync(prefix);
      if (prefix.includes("saydo-playwright-run-")) fault.roots.push(root);
      return root;
    },
    mkdirSync: (path: string, options?: Parameters<typeof fs.mkdirSync>[1]) => {
      if ((fault.point === "home" && path.endsWith("/main")) ||
          (fault.point === "first-run" && path.endsWith("/first-run")) ||
          (fault.point === "evidence-parent" && path.endsWith("/e2e/artifacts/console-runs"))) throw fault.original;
      return fs.mkdirSync(path, options);
    },
    rmSync: (path: string, options?: Parameters<typeof fs.rmSync>[1]) => {
      if (fault.cleanup && fault.roots.includes(path)) throw fault.cleanupError;
      return fs.rmSync(path, options);
    }
  };
});

import { createPlaywrightState } from "./helpers/playwright-isolation.js";

const realFs = await vi.importActual<typeof import("node:fs")>("node:fs");
const parents = new Set<string>();
const evidenceMarkers = new Set<string>();
afterEach(() => {
  vi.restoreAllMocks(); vi.unstubAllEnvs();
  for (const marker of evidenceMarkers) realFs.rmSync(marker, { force: true });
  evidenceMarkers.clear();
  for (const root of fault.roots) realFs.rmSync(root, { recursive: true, force: true });
  fault.point = ""; fault.cleanup = false; fault.roots.length = 0;
  for (const path of parents) realFs.rmSync(path, { recursive: true, force: true });
  parents.clear();
});
function fixture() {
  const parent = realFs.mkdtempSync(join(tmpdir(), "saydo-pw-setup-fault-")); parents.add(parent);
  const sentinel = join(parent, "neighbor"); realFs.mkdirSync(sentinel); realFs.writeFileSync(join(sentinel, "marker"), "已有证据");
  return { parent, sentinel };
}
function preserved(parent: string, sentinel: string) {
  expect(realFs.existsSync(parent)).toBe(true);
  expect(realFs.readFileSync(join(sentinel, "marker"), "utf8")).toBe("已有证据");
}
async function setup() {
  // 动态真实入口避免daemon编译rootDir把控制台e2e作为生产源；无业务HTTPshape。
  vi.resetModules();
  const path = new URL("../../../e2e/console/global-setup.ts", import.meta.url).pathname;
  return (await import(path)).default as () => Promise<() => Promise<void>>;
}

describe("Playwright创建早期失败回收", () => {
  it.each(["home", "first-run"])("helper %s mkdir失败只回收本轮root", (point) => {
    const { parent, sentinel } = fixture(); fault.point = point;
    expect(() => createPlaywrightState(parent)).toThrow(fault.original);
    expect(fault.roots).toHaveLength(1); expect(realFs.existsSync(fault.roots[0]!)).toBe(false);
    preserved(parent, sentinel);
  });
  it.each(["evidence-parent", "evidence-root"])("真实globalSetup %s失败也回收已创建state", async (point) => {
    const { parent, sentinel } = fixture(); vi.stubEnv("SAYDO_E2E_STATE_PARENT", parent);
    // 在真实evidence父目录放本测试独有sentinel；只删除该精确文件，不接管已有run。
    const evidence = new URL("../../../e2e/artifacts/console-runs/", import.meta.url).pathname;
    realFs.mkdirSync(evidence, { recursive: true });
    const marker = join(evidence, basename(parent) + ".sentinel"); evidenceMarkers.add(marker);
    realFs.writeFileSync(marker, "已有证据不得回收");
    const before = realFs.readdirSync(evidence);
    fault.point = point; const globalSetup = await setup();
    await expect(globalSetup()).rejects.toBe(fault.original);
    expect(fault.roots).toHaveLength(1); expect(realFs.existsSync(fault.roots[0]!)).toBe(false);
    preserved(parent, sentinel);
    expect(realFs.readdirSync(evidence)).toEqual(before);
    expect(realFs.readFileSync(marker, "utf8")).toBe("已有证据不得回收");
  });
  it("helper清理失败同时保留原始故障与清理故障，owned root可定位", () => {
    const { parent, sentinel } = fixture(); fault.point = "first-run"; fault.cleanup = true;
    let failure: unknown; try { createPlaywrightState(parent); } catch (err) { failure = err; }
    expect(failure).toBeInstanceOf(AggregateError);
    expect((failure as AggregateError).errors).toEqual([fault.original, fault.cleanupError]);
    expect(realFs.existsSync(fault.roots[0]!)).toBe(true); preserved(parent, sentinel);
  });
  it("globalSetup清理失败不吞原故障，既有parent/neighbor保全", async () => {
    const { parent, sentinel } = fixture(); vi.stubEnv("SAYDO_E2E_STATE_PARENT", parent);
    fault.point = "evidence-parent"; fault.cleanup = true;
    const globalSetup = await setup(); let failure: unknown; try { await globalSetup(); } catch (err) { failure = err; }
    expect(failure).toBeInstanceOf(AggregateError);
    expect((failure as AggregateError).errors).toEqual([fault.original, fault.cleanupError]);
    expect(realFs.existsSync(fault.roots[0]!)).toBe(true); preserved(parent, sentinel);
  });
  it("正常helper创建两个HOME，回收一轮不影响另一轮", () => {
    const { parent, sentinel } = fixture(); const a = createPlaywrightState(parent); const b = createPlaywrightState(parent);
    expect(realFs.existsSync(a.home)).toBe(true); expect(realFs.existsSync(a.firstRunHome)).toBe(true);
    realFs.rmSync(a.root, { recursive: true }); expect(realFs.existsSync(b.home)).toBe(true); preserved(parent, sentinel);
  });
});
