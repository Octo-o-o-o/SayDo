// 备份连续失败根因的回归锚(2026-08-22):macOS/APFS 的 st_dev 是挂载期标识,
// 重启或挂载顺序变化后同一卷会拿到不同 dev。硬锚 dev 会把「重挂载」误判成「目录被替换」,
// 导致 verifiedProjectWorkspace -> activeWorkspaceSources -> 定时快照备份连续 workspace_identity_changed。
// 现场取证:生产库登记 dev=16777234 / ino=765311,实际 stat 得 dev=16777231 / ino=765311(ino 未变)。
import { afterAll, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { canonicalizeWorkspace, revalidateWorkspaceIdentity, WorkspacePolicyError } from "../src/projects/workspace.js";

// assertAllowedWorkspacePath 要求 workspace 是 owner home 的严格子目录,
// 故建在 home 下的临时目录里(与 backup.test.ts 的既有做法同族),用后清掉。
const created: string[] = [];
function makeWorkspace(): string {
  const root = mkdtempSync(join(homedir(), ".saydo-wsid-"));
  created.push(root);
  const dir = join(root, "proj");
  mkdirSync(dir);
  return dir;
}
afterAll(() => {
  for (const root of created) rmSync(root, { recursive: true, force: true });
});

describe("revalidateWorkspaceIdentity:dev 漂移不算身份变化", () => {
  it("dev 变、path 与 ino 不变 ⇒ 通过,并返回刷新后的 dev", () => {
    const dir = makeWorkspace();
    const real = canonicalizeWorkspace(dir);
    const stale = { ...real, dev: String(BigInt(real.dev) + 3n) }; // 模拟重挂载后 dev 变号
    const out = revalidateWorkspaceIdentity(stale);
    expect(out.path).toBe(real.path);
    expect(out.ino).toBe(real.ino);
    expect(out.dev).toBe(real.dev); // 返回当前值,不是登记的陈旧值
  });

  it("ino 变 ⇒ 仍判 workspace_identity_changed(目录被换掉的真实信号)", () => {
    const dir = makeWorkspace();
    const real = canonicalizeWorkspace(dir);
    const swapped = { ...real, ino: String(BigInt(real.ino) + 1n) };
    expect(() => revalidateWorkspaceIdentity(swapped)).toThrow(WorkspacePolicyError);
    try {
      revalidateWorkspaceIdentity(swapped);
    } catch (err) {
      expect((err as WorkspacePolicyError).code).toBe("workspace_identity_changed");
    }
  });

  it("路径消失 ⇒ workspace_unavailable(不被本改动吞掉)", () => {
    const dir = makeWorkspace();
    const real = canonicalizeWorkspace(dir);
    rmSync(dir, { recursive: true, force: true });
    try {
      revalidateWorkspaceIdentity(real);
      throw new Error("应当抛错");
    } catch (err) {
      expect((err as WorkspacePolicyError).code).toBe("workspace_unavailable");
    }
  });
});
