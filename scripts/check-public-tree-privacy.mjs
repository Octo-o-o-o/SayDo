#!/usr/bin/env node
// 公开树隐私硬门:扫描 Git blob 或工作树文本,只报告 path / 规则类别 / 计数,不回显命中原文。
import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, readlinkSync, realpathSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { RFC1918_RE, countPatternHits, countPublicPrivacyHits } from "./public-text-redaction.mjs";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const publishScriptPath = join(scriptsDir, "publish-public-snapshot.sh");
const BIN_EXT_RE = /\.(mp3|wav|png|jpg|jpeg|gif|webp|pdf|ico|icns|woff2?|tgz|zip|bin)$/i;

function fail(message, code = 2) {
  process.stderr.write(`[fail] ${sanitizeOutput(message)}\n`);
  process.exit(code);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitizeOutput(value) {
  let out = String(value ?? "");
  const home = homedir();
  if (home && home.length >= 2) out = out.split(home).join("~");
  const account = basename(home);
  if (account && account.length >= 2) {
    out = out.replace(new RegExp(escapeRegExp(account), "gi"), "<account>");
  }
  return out;
}

export function readPublicExcludeExactSet(scriptText = readFileSync(publishScriptPath, "utf8")) {
  const block = /PUBLIC_EXCLUDE=\(\s*([\s\S]*?)\s*\)/.exec(scriptText);
  if (!block) throw new Error("publish-public-snapshot.sh 缺少 PUBLIC_EXCLUDE");
  const items = [];
  for (const line of block[1].split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^'([^']+)'$/.exec(trimmed);
    if (!match) throw new Error("PUBLIC_EXCLUDE 含无法解析的项");
    items.push(match[1]);
  }
  if (items.length === 0) throw new Error("PUBLIC_EXCLUDE 为空");
  return items;
}

export function isExcludedByExactSet(path, excludes) {
  return excludes.some((raw) => {
    const prefix = String(raw).replace(/\/+$/, "");
    return prefix !== "" && (path === prefix || path.startsWith(`${prefix}/`));
  });
}

function git(args, cwd, encoding = "buffer") {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding,
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"]
    });
  } catch (error) {
    const stderr = error?.stderr ? String(error.stderr) : String(error?.message ?? error);
    throw new Error(`git ${args[0]} 失败: ${stderr.trim() || "unknown"}`);
  }
}

function parseArgs(argv) {
  const args = { ref: null, fs: false, probesFile: null, requirePrivateProbes: false, allowMissingProbes: false, repo: null };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--ref") {
      args.ref = argv[++i];
    } else if (token === "--fs") {
      args.fs = true;
    } else if (token === "--probes-file") {
      args.probesFile = argv[++i];
    } else if (token === "--require-private-probes") {
      args.requirePrivateProbes = true;
    } else if (token === "--allow-missing-probes") {
      args.allowMissingProbes = true;
    } else if (token === "--repo") {
      args.repo = argv[++i];
    } else if (token && !token.startsWith("-") && !args.ref && !args.fs) {
      args.ref = token;
    } else {
      throw new Error(
        "用法:node scripts/check-public-tree-privacy.mjs --ref <sha> | --fs [--probes-file <path>] [--require-private-probes]"
      );
    }
  }
  if (Boolean(args.ref) === args.fs) {
    throw new Error("必须且只能指定 --ref <sha> 或 --fs");
  }
  if (args.ref && !/^[0-9a-f]{40}$/i.test(args.ref)) {
    throw new Error("ref 必须是 40 位 SHA");
  }
  return args;
}

function resolveRegularPath(candidate) {
  const parent = realpathSync(dirname(candidate));
  return join(parent, basename(candidate));
}

function loadCanonicalPrivateProbes(repo) {
  const gitCommonDir = git(["rev-parse", "--git-common-dir"], repo, "utf8").trim();
  const canonical = join(gitCommonDir.startsWith("/") ? gitCommonDir : resolve(repo, gitCommonDir), "info", "saydo-private-probes");
  let stat;
  try {
    stat = lstatSync(canonical);
  } catch {
    return { path: canonical, missing: true };
  }
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error("隐私探针锚必须是 Git 私有目录中的常规文件且不可为 symlink");
  }
  return { path: resolveRegularPath(canonical), missing: false };
}

function parseProbeLines(text) {
  const probes = [];
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    probes.push(line);
  }
  return probes;
}

function compilePrivateProbe(pattern) {
  try {
    return new RegExp(pattern, "gi");
  } catch {
    throw new Error("隐私探针正则无法编译");
  }
}

function isBinaryBuffer(buffer, path) {
  if (BIN_EXT_RE.test(path)) return true;
  return buffer.includes(0);
}

// 三端配对测试语料必须包含 RFC1918 形态地址(被测对象就是私网地址解析),运行时拼接在
// Kotlin/Swift/ArkTS 三语言上不可行。此处不是放松豁免,而是**收紧为白名单**:这些文件里
// 出现的每一个 RFC1918 值都必须命中下面的显式示例集合(全为网段边界/文档示例值),
// 任何白名单之外的值(包括未来误入的真实内网拓扑)照常拦下——新增语料值必须同步改这里,
// 让变化在 review 中可见。
const PAIRING_CORPUS_RFC1918_FILES = new Set([
  "apps/android/app/src/test/java/com/octoooo/saydo/DesktopProfileTest.kt",
  "apps/harmonyos/entry/src/test/PairingUrl.test.ets",
  "apps/ios/SayDoTests/DesktopProfileTests.swift"
]);
// 白名单值用八位组拼装而非字面量:scanner 自检要求其源码本身 static-clean
// (不得含任何 RFC1918 形态字面量,防 scanner 成为泄漏载体/自击)。
const corpusIp = (...octets) => octets.join(".");
const PAIRING_CORPUS_RFC1918_ALLOWED = new Set([
  corpusIp(10, 0, 0, 1),
  corpusIp(10, 255, 255, 254),
  corpusIp(172, 16, 0, 1),
  corpusIp(172, 31, 255, 1),
  corpusIp(192, 168, 0, 1),
  corpusIp(192, 168, 1, 8)
]);

function corpusDisallowedRfc1918Count(text) {
  const re = new RegExp(RFC1918_RE.source, RFC1918_RE.flags);
  let disallowed = 0;
  for (const match of text.matchAll(re)) {
    if (!PAIRING_CORPUS_RFC1918_ALLOWED.has(match[0])) disallowed += 1;
  }
  return disallowed;
}

function scanBuffer(buffer, path, privateProbes) {
  if (isBinaryBuffer(buffer, path)) return { binary: true, hits: [] };
  const text = buffer.toString("utf8");
  const hits = [];
  const builtIn = countPublicPrivacyHits(text);
  for (const [category, count] of Object.entries(builtIn)) {
    if (category === "rfc1918" && PAIRING_CORPUS_RFC1918_FILES.has(path)) {
      const disallowed = corpusDisallowedRfc1918Count(text);
      if (disallowed > 0) hits.push({ category: "rfc1918-corpus-disallowed", count: disallowed });
      continue;
    }
    hits.push({ category, count });
  }
  privateProbes.forEach((re, index) => {
    const count = countPatternHits(text, re);
    if (count > 0) hits.push({ category: `private-probe-${index + 1}`, count });
  });
  return { binary: false, hits };
}

function listFsPaths(repo) {
  const listed = git(["ls-files", "-z", "--cached", "--others", "--exclude-standard"], repo);
  return listed
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
}

function listRefBlobs(repo, ref) {
  const raw = git(["ls-tree", "-r", "-z", "--full-tree", ref], repo);
  const text = raw.toString("utf8");
  const entries = [];
  for (const line of text.split("\0")) {
    if (!line) continue;
    const tab = line.indexOf("\t");
    if (tab < 0) throw new Error("git ls-tree 行缺少路径");
    const meta = line.slice(0, tab);
    const path = line.slice(tab + 1);
    const parts = meta.split(" ");
    if (parts.length < 3) throw new Error("git ls-tree 元数据非法");
    const [mode, type, object] = parts;
    if (type === "commit") continue;
    if (type !== "blob") throw new Error(`git ls-tree 未知对象类型:${type}`);
    entries.push({ mode, type, object, path });
  }
  return entries;
}

function readBlob(repo, object) {
  return git(["cat-file", "blob", object], repo);
}

function printHits(rows) {
  for (const row of rows) {
    process.stderr.write(`[fail] path=${row.path} category=${row.category} count=${row.count}\n`);
  }
}

function run(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const repo = resolve(args.repo ?? process.cwd());
  const excludes = readPublicExcludeExactSet();
  let privateProbeSource = args.probesFile;
  if (!privateProbeSource && !args.allowMissingProbes) {
    const loaded = loadCanonicalPrivateProbes(repo);
    if (loaded.missing) {
      if (args.requirePrivateProbes || args.ref) {
        throw new Error("缺少 Git 私有隐私探针文件");
      }
    } else {
      privateProbeSource = loaded.path;
    }
  } else if (!privateProbeSource && args.requirePrivateProbes) {
    throw new Error("缺少 Git 私有隐私探针文件");
  }
  const privateProbes = privateProbeSource
    ? parseProbeLines(readFileSync(privateProbeSource, "utf8")).map(compilePrivateProbe)
    : [];
  if (args.requirePrivateProbes && privateProbes.length < 1) {
    throw new Error("公开快照前必须配置至少一条有效隐私探针");
  }

  let scanned = 0;
  let binary = 0;
  let excluded = 0;
  const hitRows = [];

  if (args.ref) {
    const entries = listRefBlobs(repo, args.ref.toLowerCase());
    for (const entry of entries) {
      if (isExcludedByExactSet(entry.path, excludes)) {
        excluded += 1;
        continue;
      }
      const buffer = readBlob(repo, entry.object);
      const result = scanBuffer(buffer, entry.path, privateProbes);
      if (result.binary) {
        binary += 1;
        continue;
      }
      scanned += 1;
      for (const hit of result.hits) hitRows.push({ path: entry.path, ...hit });
    }
  } else {
    const paths = listFsPaths(repo);
    for (const path of paths) {
      if (isExcludedByExactSet(path, excludes)) {
        excluded += 1;
        continue;
      }
      let stat;
      try {
        stat = lstatSync(join(repo, path));
      } catch {
        throw new Error(`无法读取工作树路径:${path}`);
      }
      if (stat.isSymbolicLink()) {
        let target;
        try {
          target = readlinkSync(join(repo, path));
        } catch {
          throw new Error(`无法读取工作树符号链接:${path}`);
        }
        const result = scanBuffer(Buffer.from(String(target)), path, privateProbes);
        scanned += 1;
        for (const hit of result.hits) hitRows.push({ path, ...hit });
        continue;
      }
      if (!stat.isFile()) {
        binary += 1;
        continue;
      }
      let buffer;
      try {
        buffer = readFileSync(join(repo, path));
      } catch {
        throw new Error(`无法读取工作树文件:${path}`);
      }
      const result = scanBuffer(buffer, path, privateProbes);
      if (result.binary) {
        binary += 1;
        continue;
      }
      scanned += 1;
      for (const hit of result.hits) hitRows.push({ path, ...hit });
    }
  }

  if (hitRows.length > 0) {
    printHits(hitRows);
    process.stderr.write(`[fail] public-tree-privacy hits=${hitRows.length} files=${new Set(hitRows.map((row) => row.path)).size} scanned=${scanned} binary=${binary} excluded=${excluded}\n`);
    process.exit(1);
  }
  process.stdout.write(`[ok] public-tree-privacy scanned=${scanned} binary=${binary} excluded=${excluded} hits=0\n`);
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  try {
    run();
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error), 2);
  }
}

export { run, parseProbeLines, compilePrivateProbe };
