// B3 奠基器轻量版(计划 2.3;modules/b B3;04 §1.2 先备后答;参考 research/codex-findings/03 §3.2-3.3)。
// P0 轻量 = 机械管道(确定性 inventory + 关键文件摘录 + knowledge 文档生成),无 LLM 深研
// (深研 = P1 沉思档承载,07 D18 只读例外笼);token 预算在轻量版映射为"读入摘录预算"(estimateTokens),
// P1 接沉思档时语义回归 LLM token。
// 要点:① 预算化(walltime/token 可配,超限产 partial manifest + 如实进度话术,不装读过);
//      ② generation 原子切换(staging 构建 -> 校验 -> 发布 -> current.json tmp+rename;失败保留旧 generation);
//      ③ 预热 git diff 种子(committed/staged/unstaged/untracked 四组;base 失效 -> needsRebuild,不误判"时间倒退=全删");
//      ④ knowledge git 版本化(独立 git 仓,每次奠基 commit);
//      ⑤ AGENTS.md 双向互通(输入侧吸收进 conventions.md;输出侧幂等指针块)。

import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { basename, dirname, isAbsolute, join } from "node:path";
import { textDigest } from "@saydo/contracts";
import { estimateTokens } from "./compiler.js";

export const FOUNDATION_SCHEMA_VERSION = 1;

/** 09 §11 params 缺省:foundation_budget_min=5 / foundation_budget_tokens=200000 */
export const DEFAULT_FOUNDATION_BUDGETS = { walltimeMs: 5 * 60_000, tokens: 200_000 } as const;

/** 关键文件白名单(确定序;存在即读,原文进 knowledge,manifest 只记 digest) */
const KEY_FILES = [
  "README.md",
  "AGENTS.md",
  "CLAUDE.md",
  "package.json",
  "pnpm-workspace.yaml",
  "pyproject.toml",
  "justfile",
  "Justfile",
  "Makefile",
  "Cargo.toml",
  "go.mod"
] as const;

const LANG_BY_EXT: Record<string, string> = {
  ".ts": "TypeScript",
  ".tsx": "TypeScript",
  ".mts": "TypeScript",
  ".js": "JavaScript",
  ".mjs": "JavaScript",
  ".py": "Python",
  ".rs": "Rust",
  ".go": "Go",
  ".md": "Markdown",
  ".json": "JSON",
  ".toml": "TOML",
  ".yaml": "YAML",
  ".yml": "YAML",
  ".sh": "Shell",
  ".html": "HTML",
  ".css": "CSS",
  ".sql": "SQL"
};

/** 每个关键文件的摘录上限(chars;超出截断并标注) */
const EXCERPT_LIMIT = 6_000;
/** 单文件尺寸上限(bytes;超过只记清单不读内容——binary/超大文件排除) */
const FILE_SIZE_LIMIT = 512 * 1024;

function removeLink(path: string): void {
  try {
    if (lstatSync(path).isSymbolicLink()) {
      unlinkSync(path);
      return;
    }
  } catch {
    return;
  }
  rmSync(path, { recursive: true, force: true });
}

/** POSIX:tmp symlink + rename 覆盖。win32 不能 rename 覆盖已存在的目录/junction,必须先拆旧链。 */
function replaceSymlink(linkPath: string, target: string, kind: "dir" | "file"): void {
  const tmp = `${linkPath}.${process.pid}.replacing`;
  rmSync(tmp, { recursive: true, force: true });
  try {
    if (process.platform === "win32") {
      try {
        symlinkSync(target, tmp, kind);
      } catch {
        if (kind !== "dir") throw new Error(`win32 file symlink failed:${linkPath}`);
        const abs = isAbsolute(target) ? target : join(dirname(linkPath), target);
        symlinkSync(abs, tmp, "junction");
      }
      removeLink(linkPath);
      renameSync(tmp, linkPath);
      return;
    }
    symlinkSync(target, tmp);
    renameSync(tmp, linkPath);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
const stripManagedKnowledgeBlock = (text: string) =>
  text
    .replace(
      /\n?<!-- saydo:knowledge:begin -->[\s\S]*?<!-- saydo:knowledge:end -->\n?/g,
      "\n"
    )
    .trimEnd();

export interface FoundationManifest {
  schemaVersion: typeof FOUNDATION_SCHEMA_VERSION;
  status: "complete" | "partial";
  partialReason?: string;
  progress?: { scanned: number; total: number };
  generation: number;
  repoHead?: string;
  treeOid?: string;
  budgets: { walltimeMs: number; tokens: number };
  spent: { walltimeMs: number; tokens: number };
  inventory: {
    files: number;
    byLanguage: Record<string, number>;
    keyFiles: { path: string; digest: string; bytes: number }[];
    skipped: { path: string; reason: string }[];
  };
  createdAt: string;
}

export interface FileChange {
  status: string;
  path: string;
  oldPath?: string;
}

export interface WarmupSeed {
  baseHead?: string;
  currentHead?: string;
  committed: FileChange[];
  staged: FileChange[];
  unstaged: FileChange[];
  untracked: string[];
  needsRebuild?: "not_git" | "no_manifest" | "base_missing" | "base_not_ancestor";
  /** 变更文件名词元(去重字典序):B1 topicTerms / 会话预热种子 */
  seedTerms: string[];
}

export interface FoundationFact {
  claim: string;
  sourceRef: string;
}

export interface FoundationBuilderOptions {
  workspace: string;
  budgets?: { walltimeMs: number; tokens: number };
  clock?: () => number;
  /** 奠基产物入账本回调(B3 -> B2,08 §依赖图;daemon 接线到 ledger.add,classifyTrust 自然分级) */
  onFact?: (fact: FoundationFact) => void;
}

export class FoundationBuilder {
  private readonly workspace: string;
  private readonly saydoDir: string;
  private readonly knowledgeDir: string;
  private readonly foundationDir: string;
  private readonly budgets: { walltimeMs: number; tokens: number };
  private readonly clock: () => number;
  private readonly onFact: ((fact: FoundationFact) => void) | undefined;

  constructor(opts: FoundationBuilderOptions) {
    this.workspace = opts.workspace;
    this.saydoDir = join(opts.workspace, ".saydo");
    this.knowledgeDir = join(this.saydoDir, "knowledge");
    this.foundationDir = join(this.saydoDir, "foundation");
    this.budgets = opts.budgets ?? { ...DEFAULT_FOUNDATION_BUDGETS };
    this.clock = opts.clock ?? (() => Date.now());
    this.onFact = opts.onFact;
  }

  /** 首次奠基(阻塞式,04 §1.2)。staging 构建 -> 校验 -> 原子发布;失败保留旧 generation。 */
  bootstrap(now = new Date().toISOString()): FoundationManifest {
    const t0 = this.clock();
    const generation = this.currentGeneration() + 1;
    const files = this.listFiles();
    const byLanguage: Record<string, number> = {};
    for (const f of files) {
      const ext = f.slice(f.lastIndexOf("."));
      const lang = LANG_BY_EXT[ext];
      if (lang) byLanguage[lang] = (byLanguage[lang] ?? 0) + 1;
    }

    // 预算内读关键文件(确定序;超限如实 partial,不装读过)
    const keyFiles: { path: string; digest: string; bytes: number }[] = [];
    const excerpts = new Map<string, string>();
    const skipped: { path: string; reason: string }[] = [];
    let tokensSpent = 0;
    let scanned = 0;
    let partialReason: string | undefined;
    // realpath 去重(评审 C-2:macOS 大小写不敏感文件系统上 justfile/Justfile 是同一文件,防双清点)
    const seenReal = new Set<string>();
    const present: string[] = [];
    for (const k of KEY_FILES) {
      const abs = join(this.workspace, k);
      if (!existsSync(abs)) continue;
      const real = realpathSync(abs);
      if (seenReal.has(real)) continue;
      seenReal.add(real);
      present.push(k);
    }
    for (const rel of present) {
      if (this.clock() - t0 > this.budgets.walltimeMs) {
        partialReason = "walltime_budget_exhausted";
        break;
      }
      if (tokensSpent >= this.budgets.tokens) {
        partialReason = "token_budget_exhausted";
        break;
      }
      const abs = join(this.workspace, rel);
      const size = statSync(abs).size;
      if (size > FILE_SIZE_LIMIT) {
        skipped.push({ path: rel, reason: "oversized" });
        scanned += 1;
        continue;
      }
      const raw = readFileSync(abs, "utf8");
      // AGENTS/CLAUDE 的 managed pointer 由本 builder 在 publish 后更新，不属于用户输入；
      // manifest 对其规范化，避免每代刚发布就因 generation 指针变化而自漂移。
      const normalized = rel === "AGENTS.md" || rel === "CLAUDE.md" ? stripManagedKnowledgeBlock(raw) : raw;
      const excerpt =
        normalized.length > EXCERPT_LIMIT
          ? `${normalized.slice(0, EXCERPT_LIMIT)}\n\n[截断:原文 ${normalized.length} chars]`
          : normalized;
      tokensSpent += estimateTokens(excerpt);
      keyFiles.push({ path: rel, digest: textDigest(normalized), bytes: Buffer.byteLength(normalized) });
      excerpts.set(rel, excerpt);
      scanned += 1;
    }

    const manifest: FoundationManifest = {
      schemaVersion: FOUNDATION_SCHEMA_VERSION,
      status: partialReason ? "partial" : "complete",
      ...(partialReason ? { partialReason } : {}),
      ...(partialReason ? { progress: { scanned, total: present.length } } : {}),
      generation,
      ...(this.gitHead() !== undefined ? { repoHead: this.gitHead() as string } : {}),
      ...(this.gitTree() !== undefined ? { treeOid: this.gitTree() as string } : {}),
      budgets: { ...this.budgets },
      spent: { walltimeMs: this.clock() - t0, tokens: tokensSpent },
      inventory: { files: files.length, byLanguage, keyFiles, skipped },
      createdAt: now
    };

    // staging 构建 knowledge 文档 -> 校验 -> 发布(原子切换)
    const staging = join(this.foundationDir, `staging-gen-${generation}`);
    rmSync(staging, { recursive: true, force: true });
    mkdirSync(staging, { recursive: true });
    this.writeKnowledgeDocs(staging, manifest, excerpts);
    this.validateStaging(staging);
    this.publish(staging, manifest);
    // 第四轮终验 B2 回修:publish(原子切换)之后的收尾步骤失败不得把"已发布的 generation"
    // 翻转成奠基失败返回(OctoDesk 首奠踩过同族坑)——指针块/事实回调各自降级,不外抛
    try {
      this.writeAgentsPointer(generation);
    } catch {
      // AGENTS.md 写失败(权限/只读仓):底座已发布可用,指针块下次奠基补写
    }
    this.emitFacts(manifest);
    return manifest;
  }

  /** 会话预热(每次,轻):git diff 种子(03 §3.3:committed/staged/unstaged/untracked 四组 + base 失效判定)。 */
  warmup(): WarmupSeed {
    const empty: WarmupSeed = { committed: [], staged: [], unstaged: [], untracked: [], seedTerms: [] };
    const head = this.gitHead();
    if (head === undefined) return { ...empty, needsRebuild: "not_git" };
    const manifest = this.currentManifest();
    if (!manifest) return { ...empty, currentHead: head, needsRebuild: "no_manifest" };
    const base = manifest.repoHead;
    if (base === undefined || !this.gitObjectExists(base)) {
      return { ...empty, currentHead: head, needsRebuild: "base_missing" };
    }
    if (!this.gitIsAncestor(base, head)) {
      // rebase/force-push:不误判"时间倒退=全仓删除"(03 §3.3.2)
      return { ...empty, baseHead: base, currentHead: head, needsRebuild: "base_not_ancestor" };
    }
    const committed = this.gitNameStatus([`${base}..HEAD`]);
    const staged = this.gitNameStatus(["--cached"]);
    const unstaged = this.gitNameStatus([]);
    const untracked = this.gitUntracked();
    const seedTerms = [
      ...new Set(
        [...committed, ...staged, ...unstaged].flatMap((c) => termsOf(c.path)).concat(untracked.flatMap(termsOf))
      )
    ].sort();
    return { baseHead: base, currentHead: head, committed, staged, unstaged, untracked, seedTerms };
  }

  currentGeneration(): number {
    return this.currentPointer()?.generation ?? 0;
  }

  currentManifest(): FoundationManifest | undefined {
    const ptr = this.currentPointer();
    if (!ptr) return undefined;
    const p = join(this.foundationDir, ptr.manifest);
    if (!existsSync(p)) return undefined;
    return JSON.parse(readFileSync(p, "utf8")) as FoundationManifest;
  }

  // ---- 私有:发布与产物 ----

  private currentPointer(): { generation: number; manifest: string } | undefined {
    const p = join(this.foundationDir, "current.json");
    if (!existsSync(p)) return undefined;
    return JSON.parse(readFileSync(p, "utf8")) as { generation: number; manifest: string };
  }

  private writeKnowledgeDocs(staging: string, m: FoundationManifest, excerpts: Map<string, string>): void {
    const langs = Object.entries(m.inventory.byLanguage).sort((a, b) => b[1] - a[1]);
    const langLine = langs.map(([l, n]) => `${l}(${n})`).join(" / ") || "(未识别)";

    const agentsRaw = excerpts.get("AGENTS.md") ?? excerpts.get("CLAUDE.md");
    const agents = agentsRaw ? stripManagedKnowledgeBlock(agentsRaw) : undefined;
    const core = [
      `# 项目知识底座(generation ${m.generation})`,
      "",
      `- 工作区:${this.workspace}`,
      `- 状态:${m.status}${m.partialReason ? `(${m.partialReason};如实:还没读完,按已读部分回答)` : ""}`,
      `- repoHead:${m.repoHead ?? "(非 git 仓)"}`,
      `- 语言主体:${langLine}`,
      "",
      "## 文档指针",
      "",
      "- inventory.md:文件清单与语言分布",
      "- build-test-run.md:构建/测试/运行命令(机械抽取,未运行验证)",
      "- conventions.md:既有 agent 约定吸收(AGENTS.md/CLAUDE.md/.cursor/rules)",
      "",
      "## 最高优先约束(AGENTS.md 首段摘录)",
      "",
      agents ? agents.split("\n").slice(0, 20).join("\n") : "(无 AGENTS.md/CLAUDE.md)"
    ].join("\n");

    const inventory = [
      `# 清单(generation ${m.generation})`,
      "",
      `- 候选快照文件:${m.inventory.files}`,
      `- 语言分布:${langLine}`,
      "",
      "## 关键文件",
      "",
      ...m.inventory.keyFiles.map((k) => `- ${k.path}(${k.bytes}B, ${k.digest.slice(0, 12)})`),
      "",
      "## 跳过清单(如实可见)",
      "",
      ...(m.inventory.skipped.length > 0 ? m.inventory.skipped.map((s) => `- ${s.path}:${s.reason}`) : ["- (无)"])
    ].join("\n");

    const buildRun = [`# 构建/测试/运行(机械抽取;unverified——未运行验证)`, ""];
    const pkgRaw = excerpts.get("package.json");
    if (pkgRaw) {
      try {
        const scripts = (JSON.parse(pkgRaw) as { scripts?: Record<string, string> }).scripts ?? {};
        buildRun.push("## package.json scripts", "");
        for (const [k, v] of Object.entries(scripts)) buildRun.push(`- \`${k}\`: ${v}`);
      } catch {
        buildRun.push("(package.json 解析失败)");
      }
    }
    const just = excerpts.get("justfile") ?? excerpts.get("Justfile");
    if (just) {
      buildRun.push("", "## justfile 任务", "");
      for (const line of just.split("\n")) {
        const t = /^([A-Za-z][\w-]*)\s*:(?!=)/.exec(line);
        if (t) buildRun.push(`- \`${t[1]}\``);
      }
    }

    const conventions = [`# 既有 agent 约定(输入侧互通,04 §1.2)`, ""];
    for (const src of ["AGENTS.md", "CLAUDE.md"]) {
      const ex = excerpts.get(src);
      if (ex) conventions.push(`## ${src}`, "", stripManagedKnowledgeBlock(ex), "");
    }
    const rulesDir = join(this.workspace, ".cursor", "rules");
    if (existsSync(rulesDir)) {
      for (const f of readdirSync(rulesDir).sort()) {
        if (!f.endsWith(".md") && !f.endsWith(".mdc")) continue;
        conventions.push(`## .cursor/rules/${f}`, "", readFileSync(join(rulesDir, f), "utf8").slice(0, 2000), "");
      }
    }

    writeFileSync(join(staging, "core.md"), core);
    writeFileSync(join(staging, "inventory.md"), inventory);
    writeFileSync(join(staging, "build-test-run.md"), buildRun.join("\n"));
    writeFileSync(join(staging, "conventions.md"), conventions.join("\n"));
  }

  /** 完整性校验(03 §3.2.3:core.md 引用存在,无 broken ref);失败抛出 ⇒ 不发布,旧 generation 保留 */
  private validateStaging(staging: string): void {
    const core = readFileSync(join(staging, "core.md"), "utf8");
    for (const doc of ["inventory.md", "build-test-run.md", "conventions.md"]) {
      if (!core.includes(doc)) throw new Error(`foundation staging invalid: core.md missing ref ${doc}`);
      if (!existsSync(join(staging, doc))) throw new Error(`foundation staging invalid: ${doc} not written`);
    }
  }

  /**
   * 原子发布(评审 A-2 回修):knowledge 按 generation 子目录落盘(gen-N/),现役目录永不被
   * 半发布覆盖;切换 = current.json tmp+rename,再原子替换 knowledge/current symlink
   * (消费者固定路径 = knowledge/current/core.md)。任何一步失败:current 指针与旧 gen 目录
   * 内容均未动,"失败保留旧 generation"对指针与文件投影同时成立。
   * 两次 rename 之间(微秒级)崩溃 ⇒ 指针新/symlink 旧,下次发布自愈;current.json 是唯一真相源。
   */
  private publish(staging: string, manifest: FoundationManifest): void {
    const genDir = join(this.knowledgeDir, `gen-${manifest.generation}`);
    rmSync(genDir, { recursive: true, force: true });
    mkdirSync(genDir, { recursive: true });
    for (const f of readdirSync(staging)) copyFileSync(join(staging, f), join(genDir, f));
    const manifestFile = `manifest-gen-${manifest.generation}.json`;
    writeFileSync(join(this.foundationDir, manifestFile), JSON.stringify(manifest, null, 2));
    // 原子切换 1:current.json(真相源)
    const tmp = join(this.foundationDir, "current.json.tmp");
    writeFileSync(tmp, JSON.stringify({ generation: manifest.generation, manifest: manifestFile }));
    renameSync(tmp, join(this.foundationDir, "current.json"));
    // 原子切换 2:knowledge/current symlink(外部消费视图)
    replaceSymlink(join(this.knowledgeDir, "current"), `gen-${manifest.generation}`, "dir");
    // generation 1 曾把四件知识文档直接写在 knowledge/ 根。保留这些旧消费路径，但改为
    // 跟随 current 的兼容 symlink，避免泛路径消费者永远读到首代陈旧内容。
    try {
      this.refreshLegacyKnowledgeLinks();
    } catch {
      // current 是唯一现役消费视图；兼容链接失败不反转已完成的 generation 发布，下次奠基重试。
    }
    rmSync(staging, { recursive: true, force: true });
    // 版本化收尾(不属于切换原子性;失败下次 commit 收编——B2 回修:注释此前这么说但没 catch,
    // git 异常会把已完成的原子发布伪装成失败)
    try {
      this.commitKnowledge(manifest.generation);
    } catch {
      // git 不可用/锁冲突:发布已完成,版本化下次奠基收编
    }
  }

  private refreshLegacyKnowledgeLinks(): void {
    for (const doc of ["core.md", "inventory.md", "build-test-run.md", "conventions.md"]) {
      replaceSymlink(join(this.knowledgeDir, doc), `current/${doc}`, "file");
    }
  }

  /** knowledge git 版本化:独立 git 仓,每次奠基 commit(可回溯;人工编辑回账本走 B2,P0 无 watcher) */
  private commitKnowledge(generation: number): void {
    const gitEnv = { ...process.env };
    delete gitEnv["GIT_INDEX_FILE"];
    const git = (args: string[]) =>
      execFileSync("git", args, {
        cwd: this.knowledgeDir,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        env: gitEnv
      });
    if (!existsSync(join(this.knowledgeDir, ".git"))) {
      git(["init", "-q"]);
      git(["config", "user.email", "saydo@local"]);
      git(["config", "user.name", "saydo"]);
    }
    git(["add", "-A"]);
    const dirty = git(["status", "--porcelain"]).trim();
    if (dirty !== "") git(["commit", "-q", "-m", `foundation generation ${generation}`]);
  }

  /** AGENTS.md 输出侧幂等指针块(04 §1.2 生态互通;marker 存在则替换,不存在则追加)。
   *  W2 阶段 C:加 M1 稳定结论投影行(memory/growth.ts projectM1Notes 维护)。 */
  private writeAgentsPointer(generation: number): void {
    const p = join(this.workspace, "AGENTS.md");
    const begin = "<!-- saydo:knowledge:begin -->";
    const end = "<!-- saydo:knowledge:end -->";
    const block = `${begin}\nSayDo 知识底座:.saydo/knowledge/current/core.md(generation ${generation};由 SayDo 奠基器维护,本块勿手改)\n稳定结论投影:.saydo/knowledge/m1-notes.md(账本重投影,人批准的 M1 结论)\n${end}`;
    if (!existsSync(p)) {
      writeFileSync(p, `${block}\n`);
      return;
    }
    const raw = readFileSync(p, "utf8");
    const next = raw.includes(begin)
      ? raw.replace(new RegExp(`${begin}[\\s\\S]*?${end}`), block)
      : `${raw.trimEnd()}\n\n${block}\n`;
    writeFileSync(p, next);
  }

  /** 奠基产物入账本(机械事实;classifyTrust 在 daemon 接线侧自然分级)。
   *  W2 阶段 C:sourceRef 统一 `foundation@gen-N` 前缀——重奠基时旧代事实按前缀 invalidate
   *  (生长闭环的"失效"半边,04 §1.3),防投影堆积旧代重复事实。 */
  private emitFacts(m: FoundationManifest): void {
    if (!this.onFact) return;
    const langs = Object.entries(m.inventory.byLanguage).sort((a, b) => b[1] - a[1]);
    const top = langs[0];
    if (top) {
      this.onFact({
        claim: `项目语言主体是 ${top[0]}(Git 索引 ${top[1]} 个文件)`,
        sourceRef: `foundation@gen-${m.generation}`
      });
    }
    const pkg = m.inventory.keyFiles.find((k) => k.path === "package.json");
    if (pkg) {
      this.onFact({
        claim: "项目使用 package.json 管理依赖",
        sourceRef: `foundation@gen-${m.generation}:package.json@${pkg.digest.slice(0, 12)}`
      });
    }
  }

  // ---- 私有:git 原语(-z 解析,不按换行 split;03 §3.3.1) ----

  private git(args: string[]): string | undefined {
    try {
      return execFileSync("git", args, { cwd: this.workspace, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    } catch {
      return undefined;
    }
  }

  private gitHead(): string | undefined {
    return this.git(["rev-parse", "HEAD"])?.trim();
  }

  private gitTree(): string | undefined {
    return this.git(["rev-parse", "HEAD^{tree}"])?.trim();
  }

  private gitObjectExists(oid: string): boolean {
    return this.git(["cat-file", "-e", `${oid}^{commit}`]) !== undefined;
  }

  private gitIsAncestor(base: string, head: string): boolean {
    try {
      execFileSync("git", ["merge-base", "--is-ancestor", base, head], { cwd: this.workspace, stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }

  private gitNameStatus(extra: string[]): FileChange[] {
    const out = this.git(["diff", "--name-status", "-z", "-M", ...extra]);
    if (out === undefined || out === "") return [];
    const parts = out.split("\0").filter((s) => s !== "");
    const changes: FileChange[] = [];
    let i = 0;
    while (i < parts.length) {
      const status = parts[i] as string;
      if (status.startsWith("R") || status.startsWith("C")) {
        changes.push({ status, oldPath: parts[i + 1] as string, path: parts[i + 2] as string });
        i += 3;
      } else {
        changes.push({ status, path: parts[i + 1] as string });
        i += 2;
      }
    }
    return changes;
  }

  private gitUntracked(): string[] {
    const out = this.git(["ls-files", "--others", "--exclude-standard", "-z"]);
    if (out === undefined || out === "") return [];
    return out.split("\0").filter((s) => s !== "");
  }

  private listFiles(): string[] {
    const out = this.git(["ls-files", "-z"]);
    if (out !== undefined) return out.split("\0").filter((s) => s !== "").sort();
    // 非 git 仓:一层目录浅扫(奠基仍可用;warmup 会标 not_git)
    const acc: string[] = [];
    const walk = (dir: string, depth: number): void => {
      if (depth > 2) return;
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.name.startsWith(".") || e.name === "node_modules") continue;
        const p = join(dir, e.name);
        if (e.isDirectory()) walk(p, depth + 1);
        else acc.push(p.slice(this.workspace.length + 1));
      }
    };
    walk(this.workspace, 0);
    return acc.sort();
  }
}

/** 超限进度话术(10 风格:如实、可理解;D 域渲染层可替换) */
export function renderProgressLine(m: FoundationManifest): string {
  if (m.status === "complete") return `底座已建好,读了 ${m.inventory.keyFiles.length} 个关键文件。`;
  const p = m.progress ?? { scanned: 0, total: 0 };
  return `底座还没读完:关键文件读了 ${p.scanned}/${p.total},先按已读部分回答,剩下的排后台补读。`;
}

/** 变更路径 -> 词元(basename 去扩展名,按非字母数字切;B1 topicTerms 种子) */
function termsOf(path: string): string[] {
  const name = basename(path).replace(/\.[^.]+$/, "");
  return name.split(/[^A-Za-z0-9\u3400-\u9fff]+/).filter((t) => t.length >= 2);
}
