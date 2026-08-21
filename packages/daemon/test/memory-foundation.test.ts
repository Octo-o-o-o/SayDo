// 2.3 验收(B3 轻量版):中型仓缺省预算内完成;大仓超限如实降级(partial + 进度话术);
// generation 原子切换(失败保留旧);预热增量 fixture(committed/staged/unstaged/untracked/rename/base 失效)。

import { execFileSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FoundationBuilder,
  renderProgressLine,
  DEFAULT_FOUNDATION_BUDGETS,
  type FoundationFact
} from "../src/memory/foundation.js";

function makeRepo(): { dir: string; git: (args: string[]) => string } {
  const dir = mkdtempSync(join(tmpdir(), "saydo-fnd-"));
  const git = (args: string[]) =>
    execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  git(["init", "-q"]);
  git(["config", "user.email", "t@t"]);
  git(["config", "user.name", "t"]);
  writeFileSync(join(dir, ".gitignore"), ".saydo/\n");
  writeFileSync(join(dir, "README.md"), "# demo\n最小示例仓");
  writeFileSync(join(dir, "AGENTS.md"), "# 约定\n- 全部中文\n- 测试先行");
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "demo", scripts: { test: "vitest run", build: "tsc -b" } })
  );
  writeFileSync(join(dir, "justfile"), "ci:\n\techo ok\n\ndev:\n\techo dev\n");
  mkdirSync(join(dir, "src"));
  writeFileSync(join(dir, "src", "index.ts"), "export const x = 1;\n");
  writeFileSync(join(dir, "src", "util.py"), "x = 1\n");
  git(["add", "-A"]);
  git(["commit", "-q", "-m", "init"]);
  return { dir, git };
}

describe("B3 奠基:中型仓缺省预算内完成", () => {
  it("complete manifest + knowledge 四件 + AGENTS.md 指针 + knowledge git commit + 事实回调", () => {
    const { dir } = makeRepo();
    const facts: FoundationFact[] = [];
    const b = new FoundationBuilder({ workspace: dir, onFact: (f) => facts.push(f) });
    const m = b.bootstrap("2026-07-24T12:00:00.000Z");

    expect(m.status).toBe("complete");
    expect(m.generation).toBe(1);
    expect(m.repoHead).toBeDefined();
    expect(m.inventory.files).toBeGreaterThanOrEqual(6);
    expect(m.inventory.byLanguage["TypeScript"]).toBe(1);
    expect(m.inventory.keyFiles.map((k) => k.path)).toContain("package.json");

    for (const doc of ["core.md", "inventory.md", "build-test-run.md", "conventions.md"]) {
      expect(existsSync(join(dir, ".saydo", "knowledge", "gen-1", doc)), doc).toBe(true);
      expect(existsSync(join(dir, ".saydo", "knowledge", "current", doc)), `current/${doc}`).toBe(true);
      const legacy = join(dir, ".saydo", "knowledge", doc);
      expect(lstatSync(legacy).isSymbolicLink(), `${doc} legacy compatibility link`).toBe(true);
      expect(readlinkSync(legacy).replaceAll("\\", "/")).toBe(`current/${doc}`);
    }
    const buildRun = readFileSync(join(dir, ".saydo", "knowledge", "current", "build-test-run.md"), "utf8");
    const conventions = readFileSync(join(dir, ".saydo", "knowledge", "current", "conventions.md"), "utf8");
    expect(buildRun).toContain("`test`: vitest run");
    expect(buildRun).toContain("`ci`");
    expect(buildRun).toContain("unverified");
    expect(conventions).not.toContain("saydo:knowledge:begin");

    const agentsMd = readFileSync(join(dir, "AGENTS.md"), "utf8");
    expect(agentsMd).toContain("saydo:knowledge:begin");
    expect(agentsMd).toContain("测试先行"); // 原内容保留

    const log = execFileSync("git", ["log", "--oneline"], {
      cwd: join(dir, ".saydo", "knowledge"),
      encoding: "utf8"
    });
    expect(log).toContain("foundation generation 1");

    expect(facts.some((f) => f.claim.includes("语言主体"))).toBe(true);
    expect(renderProgressLine(m)).toContain("底座已建好");
  });

  it("AGENTS.md 指针块幂等:二次奠基只有一个块且 generation 更新", () => {
    const { dir } = makeRepo();
    const b = new FoundationBuilder({ workspace: dir });
    const first = b.bootstrap();
    const second = b.bootstrap();
    const agentsMd = readFileSync(join(dir, "AGENTS.md"), "utf8");
    expect(agentsMd.match(/saydo:knowledge:begin/g)).toHaveLength(1);
    expect(agentsMd).toContain("generation 2");
    expect(b.currentGeneration()).toBe(2);
    const firstAgents = first.inventory.keyFiles.find((entry) => entry.path === "AGENTS.md");
    const secondAgents = second.inventory.keyFiles.find((entry) => entry.path === "AGENTS.md");
    expect(secondAgents).toEqual(firstAgents);
  });

  it("旧版根目录 regular files 在下一次奠基升级为 current compatibility links", () => {
    const { dir } = makeRepo();
    const b = new FoundationBuilder({ workspace: dir });
    b.bootstrap();
    const docs = ["core.md", "inventory.md", "build-test-run.md", "conventions.md"];
    for (const doc of docs) {
      const legacy = join(dir, ".saydo", "knowledge", doc);
      unlinkSync(legacy);
      writeFileSync(legacy, `stale legacy ${doc}\n`);
      expect(lstatSync(legacy).isFile()).toBe(true);
    }

    const m = b.bootstrap();
    expect(m.generation).toBe(2);
    for (const doc of docs) {
      const legacy = join(dir, ".saydo", "knowledge", doc);
      const current = join(dir, ".saydo", "knowledge", "current", doc);
      expect(lstatSync(legacy).isSymbolicLink(), `${doc} upgraded link`).toBe(true);
      expect(readlinkSync(legacy).replaceAll("\\", "/")).toBe(`current/${doc}`);
      expect(readFileSync(legacy)).toStrictEqual(readFileSync(current));
    }
  });
});

describe("B3 奠基:超限如实降级(预算化)", () => {
  it("token 预算耗尽 ⇒ partial + progress + 如实话术", () => {
    const { dir } = makeRepo();
    const b = new FoundationBuilder({ workspace: dir, budgets: { walltimeMs: 60_000, tokens: 1 } });
    const m = b.bootstrap();
    expect(m.status).toBe("partial");
    expect(m.partialReason).toBe("token_budget_exhausted");
    expect(m.progress).toBeDefined();
    const p = m.progress as NonNullable<typeof m.progress>;
    expect(p.scanned).toBeLessThan(p.total);
    expect(renderProgressLine(m)).toContain("还没读完");
    expect(renderProgressLine(m)).toContain("先按已读部分回答");
  });

  it("walltime 预算耗尽 ⇒ partial(注入 clock)", () => {
    const { dir } = makeRepo();
    let calls = 0;
    const b = new FoundationBuilder({
      workspace: dir,
      budgets: { ...DEFAULT_FOUNDATION_BUDGETS },
      clock: () => (calls++ === 0 ? 0 : 10 * 60_000)
    });
    const m = b.bootstrap();
    expect(m.status).toBe("partial");
    expect(m.partialReason).toBe("walltime_budget_exhausted");
  });
});

describe("B3 generation 原子切换", () => {
  it("发布失败 ⇒ 指针与文件投影都保留旧 generation(评审 A-2:不许半发布污染现役)", () => {
    const { dir } = makeRepo();
    const b = new FoundationBuilder({ workspace: dir });
    const m1 = b.bootstrap();
    expect(m1.generation).toBe(1);
    const coreBefore = readFileSync(join(dir, ".saydo", "knowledge", "current", "core.md"), "utf8");
    expect(coreBefore).toContain("generation 1");
    // 注入发布失败:让 gen-2 manifest 写入路径被目录占位(EISDIR),中断于 current.json 切换之前
    mkdirSync(join(dir, ".saydo", "foundation", "manifest-gen-2.json"));
    expect(() => b.bootstrap()).toThrow();
    expect(b.currentGeneration()).toBe(1);
    expect(b.currentManifest()?.generation).toBe(1);
    // 文件投影一致性:current 解析内容与失败前逐字节一致(gen-1 未被触碰)
    const coreAfter = readFileSync(join(dir, ".saydo", "knowledge", "current", "core.md"), "utf8");
    expect(coreAfter).toBe(coreBefore);
  });
});

describe("B3 预热:git diff 种子(四组变化 + rename + base 失效)", () => {
  it("committed/staged/unstaged/untracked 各归各组;seedTerms 含词元", () => {
    const { dir, git } = makeRepo();
    const b = new FoundationBuilder({ workspace: dir });
    b.bootstrap();
    // committed:改 README 并提交
    writeFileSync(join(dir, "README.md"), "# demo v2\n更新说明");
    git(["add", "README.md"]);
    git(["commit", "-q", "-m", "update readme"]);
    // staged:新文件 add 不提交
    writeFileSync(join(dir, "src", "newmod.ts"), "export const y = 2;\n");
    git(["add", "src/newmod.ts"]);
    // unstaged:改已 track 文件
    writeFileSync(join(dir, "src", "index.ts"), "export const x = 42;\n");
    // untracked:新文件不 add
    writeFileSync(join(dir, "notes.md"), "draft\n");

    const w = b.warmup();
    expect(w.needsRebuild).toBeUndefined();
    expect(w.committed.map((c) => c.path)).toContain("README.md");
    expect(w.staged.map((c) => c.path)).toContain("src/newmod.ts");
    expect(w.unstaged.map((c) => c.path)).toContain("src/index.ts");
    expect(w.untracked).toContain("notes.md");
    expect(w.seedTerms).toContain("README");
    expect(w.seedTerms).toContain("newmod");
  });

  it("rename 走 -M 检测(oldPath/path 成对)", () => {
    const { dir, git } = makeRepo();
    const b = new FoundationBuilder({ workspace: dir });
    b.bootstrap();
    git(["mv", "src/util.py", "src/util2.py"]);
    const w = b.warmup();
    const r = w.staged.find((c) => c.status.startsWith("R"));
    expect(r).toBeDefined();
    expect(r?.oldPath).toBe("src/util.py");
    expect(r?.path).toBe("src/util2.py");
  });

  it("base 不再是祖先(amend/rebase)⇒ needsRebuild=base_not_ancestor,不误判全删", () => {
    const { dir, git } = makeRepo();
    const b = new FoundationBuilder({ workspace: dir });
    b.bootstrap();
    git(["commit", "-q", "--amend", "-m", "rewritten"]);
    const w = b.warmup();
    expect(w.needsRebuild).toBe("base_not_ancestor");
    expect(w.committed).toEqual([]);
  });

  it("非 git 目录 ⇒ bootstrap 浅扫仍可用,warmup 标 not_git", () => {
    const dir = mkdtempSync(join(tmpdir(), "saydo-nogit-"));
    writeFileSync(join(dir, "README.md"), "plain folder");
    const b = new FoundationBuilder({ workspace: dir });
    const m = b.bootstrap();
    expect(m.status).toBe("complete");
    expect(m.repoHead).toBeUndefined();
    expect(b.warmup().needsRebuild).toBe("not_git");
  });
});
