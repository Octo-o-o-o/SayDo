// 2.3 验收(B3 轻量版):中型仓缺省预算内完成;大仓超限如实降级(partial + 进度话术);
// generation 原子切换(失败保留旧);预热增量 fixture(committed/staged/unstaged/untracked/rename/base 失效)。

import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  symlinkSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  decodeFoundationRulesRelativeSource,
  foundationRulesRelativeSource,
  KNOWLEDGE_PRIVACY_LIMITS,
  classifyRulesReadBound,
  knowledgePrivacySafeHitSchema
} from "@saydo/contracts";
import {
  FoundationBuilder,
  FoundationBuildRestrictedError,
  renderProgressLine,
  DEFAULT_FOUNDATION_BUDGETS,
  type FoundationFact
} from "../src/memory/foundation.js";
import { GitProtectionInsufficientError } from "../src/memory/gitProtection.js";

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

describe("AS-01/AS-02 foundation 扫描与 rules 上限", () => {
  function skToken(): string {
    return ["sk", "-", "E".repeat(16)].join("");
  }

  function stagingNames(dir: string): string[] {
    const foundation = join(dir, ".saydo", "foundation");
    if (!existsSync(foundation)) return [];
    return readdirSync(foundation).filter((name) => name.startsWith("staging-gen-"));
  }

  it("workspace 目录名含 sk- 构造串也不把绝对路径写入 core.md", () => {
    const parent = mkdtempSync(join(tmpdir(), "saydo-ws-"));
    const dir = join(parent, skToken());
    mkdirSync(dir);
    writeFileSync(join(dir, "README.md"), "plain\n");
    writeFileSync(join(dir, "AGENTS.md"), "# 约定\n- 中文\n");
    const b = new FoundationBuilder({ workspace: dir });
    const m = b.bootstrap();
    expect(m.status).toBe("complete");
    const core = readFileSync(join(dir, ".saydo", "knowledge", "current", "core.md"), "utf8");
    expect(core).toContain("工作区:本地项目");
    expect(core).not.toContain(dir);
    expect(core).not.toContain(skToken());
  });

  it("KEY_FILE 含构造 token => 无 staging、无新 manifest、current.json 与旧 generation 不变", () => {
    const { dir } = makeRepo();
    const b = new FoundationBuilder({ workspace: dir });
    const first = b.bootstrap();
    expect(first.generation).toBe(1);
    const currentPath = join(dir, ".saydo", "foundation", "current.json");
    const before = readFileSync(currentPath, "utf8");
    const secret = skToken();
    writeFileSync(join(dir, "AGENTS.md"), `# 约定\n- 密钥 ${secret}\n`);
    expect(() => b.bootstrap()).toThrow(FoundationBuildRestrictedError);
    expect(stagingNames(dir)).toEqual([]);
    expect(existsSync(join(dir, ".saydo", "foundation", "manifest-gen-2.json"))).toBe(false);
    expect(readFileSync(currentPath, "utf8")).toBe(before);
    expect(b.currentGeneration()).toBe(1);
    expect(b.currentManifest()?.status).toBe("complete");
  });

  it("rules 临界通过:1 个小文件 / 16 文件合计 131072B / 单文件 65536B / 32 dirent / 255B 名", () => {
    const cases: Array<() => void> = [
      () => {
        const { dir } = makeRepo();
        mkdirSync(join(dir, ".cursor", "rules"), { recursive: true });
        writeFileSync(join(dir, ".cursor", "rules", "a.md"), "x".repeat(100));
        const b = new FoundationBuilder({ workspace: dir });
        expect(b.bootstrap().status).toBe("complete");
      },
      () => {
        const { dir } = makeRepo();
        const rules = join(dir, ".cursor", "rules");
        mkdirSync(rules, { recursive: true });
        for (let i = 0; i < 16; i += 1) {
          writeFileSync(join(rules, `f${String(i).padStart(2, "0")}.md`), "x".repeat(8192));
        }
        const b = new FoundationBuilder({ workspace: dir });
        expect(b.bootstrap().status).toBe("complete");
      },
      () => {
        const { dir } = makeRepo();
        mkdirSync(join(dir, ".cursor", "rules"), { recursive: true });
        writeFileSync(join(dir, ".cursor", "rules", "big.md"), "x".repeat(65536));
        const b = new FoundationBuilder({ workspace: dir });
        expect(b.bootstrap().status).toBe("complete");
      },
      () => {
        const { dir } = makeRepo();
        const rules = join(dir, ".cursor", "rules");
        mkdirSync(rules, { recursive: true });
        for (let i = 0; i < 16; i += 1) writeFileSync(join(rules, `r${i}.md`), "ok\n");
        for (let i = 0; i < 16; i += 1) writeFileSync(join(rules, `n${i}.txt`), "skip\n");
        const b = new FoundationBuilder({ workspace: dir });
        expect(b.bootstrap().status).toBe("complete");
      },
      () => {
        const { dir } = makeRepo();
        const rules = join(dir, ".cursor", "rules");
        mkdirSync(rules, { recursive: true });
        const name = `${"n".repeat(252)}.md`;
        expect(Buffer.byteLength(name)).toBe(255);
        writeFileSync(join(rules, name), "ok\n");
        const b = new FoundationBuilder({ workspace: dir });
        expect(b.bootstrap().status).toBe("complete");
      },
      () => {
        const { dir } = makeRepo();
        const rules = join(dir, ".cursor", "rules");
        mkdirSync(rules, { recursive: true });
        for (let i = 0; i < 16; i += 1) {
          writeFileSync(join(rules, `${"n".repeat(251)}.${String(i).padStart(2, "0")}x`), "skip\n");
        }
        writeFileSync(join(rules, `${"n".repeat(13)}.md`), "ok\n");
        const b = new FoundationBuilder({ workspace: dir });
        expect(b.bootstrap().status).toBe("complete");
      }
    ];
    for (const run of cases) run();
  });

  it("rules 超界失败且不读超界文件:17 文件 / 65537B / 33 dirent / 256B 名 / 名称缓冲 4097B / 合计 131073B", () => {
    const fail = (setup: (dir: string) => void) => {
      const { dir } = makeRepo();
      setup(dir);
      const b = new FoundationBuilder({ workspace: dir });
      expect(() => b.bootstrap()).toThrow(FoundationBuildRestrictedError);
      expect(stagingNames(dir)).toEqual([]);
      expect(existsSync(join(dir, ".saydo", "foundation", "current.json"))).toBe(false);
    };

    fail((dir) => {
      const rules = join(dir, ".cursor", "rules");
      mkdirSync(rules, { recursive: true });
      for (let i = 0; i < 17; i += 1) writeFileSync(join(rules, `f${String(i).padStart(2, "0")}.md`), "ok\n");
    });
    fail((dir) => {
      mkdirSync(join(dir, ".cursor", "rules"), { recursive: true });
      writeFileSync(join(dir, ".cursor", "rules", "huge.md"), "x".repeat(65537));
    });
    fail((dir) => {
      const rules = join(dir, ".cursor", "rules");
      mkdirSync(rules, { recursive: true });
      for (let i = 0; i < 16; i += 1) writeFileSync(join(rules, `r${i}.md`), "ok\n");
      for (let i = 0; i < 17; i += 1) writeFileSync(join(rules, `n${i}.txt`), "skip\n");
    });
    fail((dir) => {
      const rules = join(dir, ".cursor", "rules");
      mkdirSync(rules, { recursive: true });
      const name = `${"n".repeat(253)}.md`;
      expect(Buffer.byteLength(name)).toBe(256);
      try {
        writeFileSync(join(rules, name), "x");
      } catch (err) {
        expect((err as NodeJS.ErrnoException).code).toBe("ENAMETOOLONG");
        expect(classifyRulesReadBound([{ name, isRulesFile: true, sizeBytes: 1 }]).reason).toBe("over_dirent_name");
        writeFileSync(join(rules, "ok.md"), "x".repeat(65537));
      }
    });
    fail((dir) => {
      const rules = join(dir, ".cursor", "rules");
      mkdirSync(rules, { recursive: true });
      for (let i = 0; i < 16; i += 1) {
        writeFileSync(join(rules, `${"n".repeat(251)}.${String(i).padStart(2, "0")}t`), "skip\n");
      }
      writeFileSync(join(rules, `${"n".repeat(14)}.md`), "ok\n");
    });
    fail((dir) => {
      const rules = join(dir, ".cursor", "rules");
      mkdirSync(rules, { recursive: true });
      for (let i = 0; i < 15; i += 1) writeFileSync(join(rules, `a${String(i).padStart(2, "0")}.md`), "x".repeat(8192));
      writeFileSync(join(rules, "a15.md"), "x".repeat(8193));
    });
  });

  it("rules 名 a\\b.md 与控制字符名的 safeHits 定位串可逆且无反斜杠/控制字符", () => {
    const { dir } = makeRepo();
    const rules = join(dir, ".cursor", "rules");
    mkdirSync(rules, { recursive: true });
    const slashName = ["a", "b.md"].join("\\");
    const controlName = `a${String.fromCharCode(1)}b.md`;
    const secret = skToken();
    writeFileSync(join(rules, slashName), `hit ${secret}\n`);
    writeFileSync(join(rules, controlName), "plain\n");
    const b = new FoundationBuilder({ workspace: dir });
    try {
      b.bootstrap();
      throw new Error("expected restricted");
    } catch (err) {
      expect(err).toBeInstanceOf(FoundationBuildRestrictedError);
      const e = err as FoundationBuildRestrictedError;
      expect(e.safeHits.length).toBeGreaterThan(0);
      for (const hit of e.safeHits) {
        expect(hit.relativeSource.includes("\\")).toBe(false);
        expect(hit.relativeSource.includes(String.fromCharCode(1))).toBe(false);
        const decoded = decodeFoundationRulesRelativeSource(hit.relativeSource);
        if (decoded !== undefined) expect([slashName, controlName, "AGENTS.md"].includes(decoded) || decoded.endsWith(".md")).toBe(true);
      }
      const slashHit = e.safeHits.find((h) => decodeFoundationRulesRelativeSource(h.relativeSource) === slashName);
      expect(slashHit).toBeDefined();
      expect(JSON.stringify(e.safeHits)).not.toContain(secret);
    }
  });

  it("假 git 超时 => query_failed 不发布", { timeout: 25_000 }, () => {
    const { dir } = makeRepo();
    const bin = mkdtempSync(join(tmpdir(), "saydo-slowgit-"));
    writeFileSync(join(bin, "git"), "#!/bin/sh\nsleep 30\nexit 0\n");
    chmodSync(join(bin, "git"), 0o755);
    const prev = process.env["PATH"] ?? "";
    process.env["PATH"] = `${bin}:${prev}`;
    try {
      const b = new FoundationBuilder({ workspace: dir });
      expect(() => b.bootstrap()).toThrow(GitProtectionInsufficientError);
      expect(existsSync(join(dir, ".saydo", "foundation", "current.json"))).toBe(false);
    } finally {
      process.env["PATH"] = prev;
    }
  });

  it("AGENTS.md 源文件行号进入 safeHit,不是组装文档偏移", () => {
    const { dir } = makeRepo();
    const secret = skToken();
    const lines = Array.from({ length: 29 }, (_, i) => `约定行 ${i + 1}`);
    lines.push(`密钥 ${secret}`);
    writeFileSync(join(dir, "AGENTS.md"), `${lines.join("\n")}\n`);
    const b = new FoundationBuilder({ workspace: dir });
    try {
      b.bootstrap();
      throw new Error("expected restricted");
    } catch (err) {
      expect(err).toBeInstanceOf(FoundationBuildRestrictedError);
      const e = err as FoundationBuildRestrictedError;
      const hit = e.safeHits.find((h) => h.relativeSource === "AGENTS.md");
      expect(hit).toBeDefined();
      expect(hit!.line).toBe(30);
      expect(stagingNames(dir)).toEqual([]);
      expect(existsSync(join(dir, ".saydo", "foundation", "current.json"))).toBe(false);
      expect(existsSync(join(dir, ".saydo", "foundation", "manifest-gen-1.json"))).toBe(false);
      expect(JSON.stringify(e.safeHits)).not.toContain(secret);
    }
  });

  it("rules 文件名含 openai_sk 构造串时 safeHit 归属编码来源且无行号", () => {
    const { dir } = makeRepo();
    const b = new FoundationBuilder({ workspace: dir });
    const first = b.bootstrap();
    expect(first.generation).toBe(1);
    const currentPath = join(dir, ".saydo", "foundation", "current.json");
    const before = readFileSync(currentPath, "utf8");
    const body16 = "A".repeat(16);
    const ruleName = ["sk", "-", body16, ".md"].join("");
    const rulesDir = join(dir, ".cursor", "rules");
    mkdirSync(rulesDir, { recursive: true });
    writeFileSync(join(rulesDir, ruleName), "ordinary rules text\n");
    try {
      b.bootstrap();
      throw new Error("expected restricted");
    } catch (err) {
      expect(err).toBeInstanceOf(FoundationBuildRestrictedError);
      const e = err as FoundationBuildRestrictedError;
      expect(e.code).toBe("foundation_build_restricted");
      expect(e.safeHits).toHaveLength(1);
      const hit = e.safeHits[0]!;
      expect(hit.kind).toBe("openai_sk");
      expect(hit).not.toHaveProperty("line");
      expect(hit.relativeSource.startsWith(".cursor/rules/_enc/")).toBe(true);
      expect(decodeFoundationRulesRelativeSource(hit.relativeSource)).toBe(ruleName);
      expect(knowledgePrivacySafeHitSchema.safeParse(hit).success).toBe(true);
      expect(JSON.stringify(e.safeHits)).not.toContain(body16);
      expect(e.message).not.toContain(body16);
      expect(JSON.stringify(e.auditHits)).not.toContain(body16);
      expect(stagingNames(dir)).toEqual([]);
      expect(existsSync(join(dir, ".saydo", "foundation", "manifest-gen-2.json"))).toBe(false);
      expect(readFileSync(currentPath, "utf8")).toBe(before);
      expect(b.currentGeneration()).toBe(1);
    }
  });

  it("rules 文件名凭据与控制字符名正文命中归属各自正确", () => {
    const { dir } = makeRepo();
    const body16 = "A".repeat(16);
    const ruleName = ["sk", "-", body16, ".md"].join("");
    const controlName = `a${String.fromCharCode(1)}b.md`;
    const secret = skToken();
    const rulesDir = join(dir, ".cursor", "rules");
    mkdirSync(rulesDir, { recursive: true });
    writeFileSync(join(rulesDir, ruleName), "ordinary rules text\n");
    writeFileSync(join(rulesDir, controlName), `hit ${secret}\n`);
    const b = new FoundationBuilder({ workspace: dir });
    try {
      b.bootstrap();
      throw new Error("expected restricted");
    } catch (err) {
      expect(err).toBeInstanceOf(FoundationBuildRestrictedError);
      const e = err as FoundationBuildRestrictedError;
      expect(e.code).toBe("foundation_build_restricted");
      const nameHit = e.safeHits.find((h) => decodeFoundationRulesRelativeSource(h.relativeSource) === ruleName);
      const bodyHit = e.safeHits.find((h) => decodeFoundationRulesRelativeSource(h.relativeSource) === controlName);
      expect(nameHit).toBeDefined();
      expect(nameHit!.kind).toBe("openai_sk");
      expect(nameHit).not.toHaveProperty("line");
      expect(nameHit!.relativeSource.startsWith(".cursor/rules/_enc/")).toBe(true);
      expect(knowledgePrivacySafeHitSchema.safeParse(nameHit).success).toBe(true);
      expect(bodyHit).toBeDefined();
      expect(bodyHit!.kind).toBe("openai_sk");
      expect(bodyHit!.line).toBe(1);
      expect(bodyHit!.relativeSource.startsWith(".cursor/rules/_enc/")).toBe(true);
      expect(bodyHit!.relativeSource.includes(String.fromCharCode(1))).toBe(false);
      expect(knowledgePrivacySafeHitSchema.safeParse(bodyHit).success).toBe(true);
      expect(e.safeHits).toHaveLength(2);
      expect(JSON.stringify(e.safeHits)).not.toContain(body16);
      expect(JSON.stringify(e.safeHits)).not.toContain(secret);
      expect(e.message).not.toContain(body16);
      expect(e.message).not.toContain(secret);
      expect(JSON.stringify(e.auditHits)).not.toContain(body16);
      expect(JSON.stringify(e.auditHits)).not.toContain(secret);
      expect(stagingNames(dir)).toEqual([]);
      expect(existsSync(join(dir, ".saydo", "foundation", "current.json"))).toBe(false);
    }
  });

  it("rules 行号为源文件行号且 relativeSource 经 foundationRulesRelativeSource", () => {
    const { dir } = makeRepo();
    const secret = skToken();
    const rulesDir = join(dir, ".cursor", "rules");
    mkdirSync(rulesDir, { recursive: true });
    const ruleLines = Array.from({ length: 4 }, (_, i) => `rule ${i + 1}`);
    ruleLines.push(`hit ${secret}`);
    writeFileSync(join(rulesDir, "x.md"), `${ruleLines.join("\n")}\n`);
    const b = new FoundationBuilder({ workspace: dir });
    try {
      b.bootstrap();
      throw new Error("expected restricted");
    } catch (err) {
      expect(err).toBeInstanceOf(FoundationBuildRestrictedError);
      const e = err as FoundationBuildRestrictedError;
      const loc = foundationRulesRelativeSource("x.md");
      const hit = e.safeHits.find((h) => h.relativeSource === loc);
      expect(hit).toBeDefined();
      expect(hit!.line).toBe(5);
      expect(hit!.relativeSource).toBe(".cursor/rules/x.md");
      expect(stagingNames(dir)).toEqual([]);
      expect(JSON.stringify(e.safeHits)).not.toContain(secret);
    }
  });

  it("package.json scripts 内的 literal 使用原文行号", () => {
    const { dir } = makeRepo();
    const secret = skToken();
    writeFileSync(
      join(dir, "package.json"),
      ["{", '  "name": "demo",', '  "scripts": {', `    "test": "${secret}"`, "  }", "}", ""].join("\n")
    );
    const b = new FoundationBuilder({ workspace: dir });
    try {
      b.bootstrap();
      throw new Error("expected restricted");
    } catch (err) {
      expect(err).toBeInstanceOf(FoundationBuildRestrictedError);
      const e = err as FoundationBuildRestrictedError;
      const hit = e.safeHits.find((h) => h.relativeSource === "package.json");
      expect(hit).toBeDefined();
      expect(hit!.relativeSource).toBe("package.json");
      expect(hit!.line).toBe(4);
      expect(JSON.stringify(e.safeHits)).not.toContain(secret);
      expect(stagingNames(dir)).toEqual([]);
      expect(existsSync(join(dir, ".saydo", "foundation", "manifest-gen-1.json"))).toBe(false);
    }
  });

  it("同一 rules 文件不同行的同一 literal 保留各自行号", () => {
    const { dir } = makeRepo();
    const secret = skToken();
    const rulesDir = join(dir, ".cursor", "rules");
    mkdirSync(rulesDir, { recursive: true });
    writeFileSync(join(rulesDir, "dup.md"), `${secret}\nplain\nplain\nplain\n${secret}\n`);
    const b = new FoundationBuilder({ workspace: dir });
    try {
      b.bootstrap();
      throw new Error("expected restricted");
    } catch (err) {
      expect(err).toBeInstanceOf(FoundationBuildRestrictedError);
      const e = err as FoundationBuildRestrictedError;
      const loc = foundationRulesRelativeSource("dup.md");
      const hits = e.safeHits.filter((h) => h.relativeSource === loc);
      expect(hits.map((h) => h.line).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([1, 5]);
      expect(JSON.stringify(e.safeHits)).not.toContain(secret);
      expect(stagingNames(dir)).toEqual([]);
    }
  });

  it("AGENTS.md 与 rules 同时命中时来源各自正确", () => {
    const { dir } = makeRepo();
    const secret = skToken();
    writeFileSync(join(dir, "AGENTS.md"), `# 约定\n${secret}\n`);
    const rulesDir = join(dir, ".cursor", "rules");
    mkdirSync(rulesDir, { recursive: true });
    writeFileSync(join(rulesDir, "y.md"), `${secret}\n`);
    const b = new FoundationBuilder({ workspace: dir });
    try {
      b.bootstrap();
      throw new Error("expected restricted");
    } catch (err) {
      expect(err).toBeInstanceOf(FoundationBuildRestrictedError);
      const e = err as FoundationBuildRestrictedError;
      const agents = e.safeHits.find((h) => h.relativeSource === "AGENTS.md");
      const rulesHit = e.safeHits.find((h) => h.relativeSource === foundationRulesRelativeSource("y.md"));
      expect(agents).toBeDefined();
      expect(agents!.line).toBe(2);
      expect(rulesHit).toBeDefined();
      expect(rulesHit!.line).toBe(1);
      expect(JSON.stringify(e.safeHits)).not.toContain(secret);
    }
  });

  it("manifest-gen-N.json 为根外 symlink 时不发布、不跟随", () => {
    const { dir } = makeRepo();
    const outsideDir = mkdtempSync(join(tmpdir(), "saydo-mf-out-"));
    const outside = join(outsideDir, "victim.json");
    writeFileSync(outside, "KEEP-MANIFEST\n");
    mkdirSync(join(dir, ".saydo", "foundation"), { recursive: true });
    const leaf = join(dir, ".saydo", "foundation", "manifest-gen-1.json");
    symlinkSync(outside, leaf);
    const b = new FoundationBuilder({ workspace: dir });
    try {
      b.bootstrap();
      throw new Error("expected git protection");
    } catch (err) {
      expect(err).toBeInstanceOf(GitProtectionInsufficientError);
      const e = err as GitProtectionInsufficientError;
      expect(e.gitProtection.status).toBe("outside_root");
      expect(e.gitProtection.relativeTarget).toBe(".saydo/foundation/manifest-gen-1.json");
    }
    expect(readFileSync(outside, "utf8")).toBe("KEEP-MANIFEST\n");
    expect(lstatSync(leaf).isSymbolicLink()).toBe(true);
    expect(existsSync(join(dir, ".saydo", "foundation", "current.json"))).toBe(false);
    expect(stagingNames(dir)).toEqual([]);
  });

  it("Git 子进程计数不超过 16", () => {
    const { dir } = makeRepo();
    const b = new FoundationBuilder({ workspace: dir });
    b.bootstrap();
    expect(b.gitSubprocessCount).toBeGreaterThan(0);
    expect(b.gitSubprocessCount).toBeLessThanOrEqual(KNOWLEDGE_PRIVACY_LIMITS.gitSubprocessMaxPerBoundary);
  });

  it(".saydo/foundation 被常规文件占位 => write_failed 无 staging", () => {
    const { dir } = makeRepo();
    mkdirSync(join(dir, ".saydo"));
    writeFileSync(join(dir, ".saydo", "foundation"), "not-a-dir\n");
    const b = new FoundationBuilder({ workspace: dir });
    try {
      b.bootstrap();
      throw new Error("expected git protection");
    } catch (err) {
      expect(err).toBeInstanceOf(GitProtectionInsufficientError);
      const e = err as GitProtectionInsufficientError;
      expect(e.gitProtection.status).toBe("write_failed");
    }
    expect(existsSync(join(dir, ".saydo", "foundation", "staging-gen-1"))).toBe(false);
  });

  it("已有 generation 后 .saydo/foundation 为 0o555 => write_failed 且 current 不变", () => {
    if (process.getuid?.() === 0) return;
    const { dir } = makeRepo();
    const b = new FoundationBuilder({ workspace: dir });
    expect(b.bootstrap().generation).toBe(1);
    const foundationDir = join(dir, ".saydo", "foundation");
    const before = readFileSync(join(foundationDir, "current.json"), "utf8");
    chmodSync(foundationDir, 0o555);
    try {
      try {
        b.bootstrap();
        throw new Error("expected git protection");
      } catch (err) {
        expect(err).toBeInstanceOf(GitProtectionInsufficientError);
        const e = err as GitProtectionInsufficientError;
        expect(e.gitProtection.status).toBe("write_failed");
      }
      expect(readFileSync(join(foundationDir, "current.json"), "utf8")).toBe(before);
      expect(b.currentGeneration()).toBe(1);
    } finally {
      chmodSync(foundationDir, 0o755);
    }
  });

  it("524288B README 前 100 字符 token 拒写且扫描不超过上限", () => {
    const { dir } = makeRepo();
    const secret = skToken();
    const limit = KNOWLEDGE_PRIVACY_LIMITS.fileSizeLimitBytes;
    const prefix = `hit ${secret}\n`;
    const body = `${prefix}${"x".repeat(limit - prefix.length)}`;
    expect(Buffer.byteLength(body)).toBe(limit);
    writeFileSync(join(dir, "README.md"), body);
    let scanned = 0;
    const b = new FoundationBuilder({ workspace: dir, onScan: (n) => { scanned += n; } });
    try {
      b.bootstrap();
      throw new Error("expected restricted");
    } catch (err) {
      expect(err).toBeInstanceOf(FoundationBuildRestrictedError);
      const e = err as FoundationBuildRestrictedError;
      const hit = e.safeHits.find((h) => h.relativeSource === "README.md");
      expect(hit).toBeDefined();
      expect(hit!.line).toBe(1);
      expect(scanned).toBeLessThanOrEqual(KNOWLEDGE_PRIVACY_LIMITS.maxScanCharsPerFoundationBuild);
      expect(stagingNames(dir)).toEqual([]);
      expect(existsSync(join(dir, ".saydo", "foundation", "current.json"))).toBe(false);
      expect(JSON.stringify(e.safeHits)).not.toContain(secret);
    }
  });

  it("524288B README token 位于第 7000 字符不报且不扫该区域", () => {
    const { dir } = makeRepo();
    const secret = skToken();
    const limit = KNOWLEDGE_PRIVACY_LIMITS.fileSizeLimitBytes;
    const at = 7000;
    const body = `${"x".repeat(at)}${secret}${"x".repeat(limit - at - secret.length)}`;
    expect(Buffer.byteLength(body)).toBe(limit);
    writeFileSync(join(dir, "README.md"), body);
    let scanned = 0;
    const b = new FoundationBuilder({ workspace: dir, onScan: (n) => { scanned += n; } });
    const m = b.bootstrap();
    expect(m.status).toBe("complete");
    expect(scanned).toBeLessThan(body.length);
    expect(scanned).toBeLessThanOrEqual(KNOWLEDGE_PRIVACY_LIMITS.maxScanCharsPerFoundationBuild);
  });
});
