#!/usr/bin/env node
// 一键安装脚本自测:官网托管的 install.sh / install-core.ps1 必须钉住同一个 available Release 的
// (Windows 形态 2026-09-15 起拆两层:install.ps1 = 纯 ASCII 无 BOM 引导,供 irm | iex;
//  install-core.ps1 = 带 UTF-8 BOM 的实际安装逻辑,由引导下载后以 -File 运行。PS 5.1 的 irm 会把
//  BOM 留成 U+FEFF,iex 直接解析必败;无 BOM 的 UTF-8 用 -File 又按 ANSI 读坏中文——两者只能拆开。)
// tgz 版本与 SHA-256,且该 digest 与仓内 availability 证据(release-verify 的 tarballSha256)全等;
// 两份脚本、_headers 与 README/官网入口共同构成"快速启动"承诺面,任一漂移即红。
// 同时带 mutation 自证:篡改 digest / 版本 / 删除 _headers 条目必须被判红。
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(fileURLToPath(import.meta.url), "../..");
const SITE = "deploy/saydo-octoooo-com";
const SH = `${SITE}/install.sh`;
const PS1 = `${SITE}/install-core.ps1`;
const PS1_BOOT = `${SITE}/install.ps1`;
const HEADERS = `${SITE}/_headers`;
const EVIDENCE_DIR = "e2e/evidence";
const RELEASE_URL = (version) =>
  `https://github.com/Octo-o-o-o/SayDo/releases/download/v${version}/saydo-cli-${version}.tgz`;
const MIRROR_URL = (version) => `https://dl.saydo.octoooo.com/releases/v${version}/saydo-cli-${version}.tgz`;

function read(path) {
  return readFileSync(join(repo, path), "utf8");
}

function pinOf(text, kind) {
  const version = kind === "sh"
    ? /^SAYDO_VERSION="([^"]+)"$/mu.exec(text)?.[1]
    : /^\$SaydoVersion = "([^"]+)"$/mu.exec(text)?.[1];
  const sha = kind === "sh"
    ? /^SAYDO_TGZ_SHA256="([0-9a-f]{64})"$/mu.exec(text)?.[1]
    : /^\$SaydoTgzSha256 = "([0-9a-f]{64})"$/mu.exec(text)?.[1];
  const urlLine = kind === "sh"
    ? /^SAYDO_TGZ_URL="([^"]+)"$/mu.exec(text)?.[1]
    : /^\$SaydoTgzUrl = "([^"]+)"$/mu.exec(text)?.[1];
  return { version, sha, urlLine };
}

export function checkInstallScripts(input) {
  const errors = [];
  const sh = pinOf(input.sh, "sh");
  const ps = pinOf(input.ps1, "ps1");
  if (!sh.version || !sh.sha) errors.push("install.sh 缺少 SAYDO_VERSION / SAYDO_TGZ_SHA256 钉住值");
  if (!ps.version || !ps.sha) errors.push("install.ps1 缺少 $SaydoVersion / $SaydoTgzSha256 钉住值");
  if (sh.version && ps.version && sh.version !== ps.version) errors.push(`两份脚本版本不一致:${sh.version} != ${ps.version}`);
  if (sh.sha && ps.sha && sh.sha !== ps.sha) errors.push("两份脚本 SHA-256 不一致");
  const version = sh.version ?? ps.version;
  if (version) {
    const expectedUrl = RELEASE_URL(version);
    const shUrl = sh.urlLine?.replace("${SAYDO_VERSION}", version).replace("${SAYDO_VERSION}", version);
    const psUrl = ps.urlLine?.replace("$SaydoVersion", version).replace("$SaydoVersion", version);
    if (shUrl !== expectedUrl) errors.push(`install.sh 下载 URL 不是固定 Release URL:${shUrl}`);
    if (psUrl !== expectedUrl) errors.push(`install.ps1 下载 URL 不是固定 Release URL:${psUrl}`);
    const expectedMirror = MIRROR_URL(version);
    const shMirror = /^SAYDO_TGZ_MIRROR_URL="([^"]+)"$/mu.exec(input.sh)?.[1]?.replaceAll("${SAYDO_VERSION}", version);
    const psMirror = /^\$SaydoTgzMirrorUrl = "([^"]+)"$/mu.exec(input.ps1)?.[1]?.replaceAll("$SaydoVersion", version);
    if (shMirror !== expectedMirror) errors.push(`install.sh 镜像 URL 不是官网镜像固定形态:${shMirror}`);
    if (psMirror !== expectedMirror) errors.push(`install.ps1 镜像 URL 不是官网镜像固定形态:${psMirror}`);
    const evidence = input.availabilityEvidence.find((item) => item.tag === `v${version}`);
    if (!evidence) errors.push(`没有 v${version} 的 availability 证据(e2e/evidence/*-availability.json)`);
    else {
      if (evidence.tarballSha256 !== (sh.sha ?? ps.sha)) errors.push(`脚本钉住的 SHA-256 与 availability 证据 tarballSha256 不一致(v${version})`);
      const states = Array.isArray(evidence.availability) ? evidence.availability.map((item) => item.state) : [];
      if (states.length === 0 || states.some((state) => state !== "available")) errors.push(`v${version} 的 availability 证据不是全部 available`);
    }
  }
  if (!input.ps1.startsWith("﻿")) errors.push("install-core.ps1 必须带 UTF-8 BOM(Windows PowerShell 5.1 以 -File 运行时按 ANSI 读取无 BOM 文件)");
  // 引导脚本:必须能在 PS 5.1 下 irm | iex——无 BOM、纯 ASCII、下载核心并以 -File 执行、不在顶层 exit(会关掉用户交互会话)。
  if (input.ps1Boot.startsWith("﻿")) errors.push("install.ps1 引导脚本不得带 BOM(PS 5.1 的 irm 会把 BOM 留成 U+FEFF 使 iex 解析失败)");
  if (/[^\x00-\x7f]/u.test(input.ps1Boot)) errors.push("install.ps1 引导脚本必须纯 ASCII(irm | iex 形态下无法保证解码)");
  if (!input.ps1Boot.includes("https://saydo.octoooo.com/install-core.ps1")) errors.push("install.ps1 引导脚本缺核心脚本固定 URL");
  if (!input.ps1Boot.includes("-NoProfile -ExecutionPolicy Bypass -File $tmpCore")) errors.push("install.ps1 引导脚本必须以 -File 运行下载的核心脚本");
  if (!input.ps1Boot.includes("$bytes[0] -ne 0xEF -or $bytes[1] -ne 0xBB -or $bytes[2] -ne 0xBF")) errors.push("install.ps1 引导脚本必须校验核心脚本带 BOM");
  if (/^\s*exit\b/mu.test(input.ps1Boot)) errors.push("install.ps1 引导脚本不得在顶层 exit(iex 形态会关闭用户会话)");
  if (/\$MyInvocation/u.test(input.ps1Boot)) errors.push("install.ps1 引导脚本不得依赖 $MyInvocation");
  // 结构不变量:脚本关键语句必须原样存在(Codex 223 B-01..B-07 证明纯钉住检查可被绕过)。
  const SH_INVARIANTS = [
    ["sh 包 digest 校验", '[ "$actual" = "$SAYDO_TGZ_SHA256" ] || fail "SayDo 包校验失败'],
    ["sh 安装的是钉住 tgz", 'install --global --prefix "$PREFIX" --no-fund --no-audit --loglevel=error "$tgz"'],
    ["sh 默认根目录在 HOME 下", 'SAYDO_HOME="${SAYDO_HOME:-$HOME/.saydo}"'],
    ["sh 根目录越出 HOME 需显式放行", 'SAYDO_INSTALL_ALLOW_OUTSIDE_HOME'],
    ["sh 拒绝含 .. 的根目录", 'case "/$SAYDO_HOME/" in */../*) fail'],
    ["sh 用 cd -P/pwd -P 复核 symlink 越出", 'real_existing="$(cd -P -- "$existing" 2>/dev/null && pwd -P)"'],
    ["sh symlink 越出即 fail", 'fail "SAYDO_HOME 解析后不在用户目录之下'],
    ["sh HOME 缺失即 fail", '[ -n "${HOME:-}" ] || fail'],
    ["sh PATH 写入语句", "printf '\\n%s\\n' \"$rc_line\" >> \"$rc_file\""],
    ["sh PATH 标记整行精确匹配", 'grep -Fxq -- "$rc_line" "$rc_file"'],
    ["sh fish 分支", 'fish) append_path_line "$HOME/.config/fish/config.fish"'],
    ["sh fish PATH 写入", 'fish_line="set -gx PATH ${q_bin_fish} \\$PATH # saydo"'],
    ["sh POSIX 单引号引用函数", "posix_sq()"],
    ["sh posix_sq 按字面写单引号", "printf '%s' \"'\\\\''\""],
    ["sh fish 单引号引用函数", "fish_sq()"],
    ["sh fish_sq 按字面写反斜杠", "printf '%s' '\\\\'"],
    ["sh 拒绝换行 HOME", 'reject_unembeddable_path "HOME" "$HOME"'],
    ["sh 拒绝换行 SAYDO_HOME", 'reject_unembeddable_path "SAYDO_HOME" "$SAYDO_HOME"'],
    ["sh 启动器路径经 posix_sq", 'posix_sq "$NODE_BIN"'],
    ["sh Node 下载校验", '[ "$actual" = "$expected" ] || fail "Node 下载校验失败']
  ];
  const PS_INVARIANTS = [
    ["ps1 包 digest 校验", 'if ($actualTgz -ne $SaydoTgzSha256) { Fail "SayDo 包校验失败'],
    ["ps1 安装的是钉住 tgz", 'install --global --prefix $Prefix --no-fund --no-audit --loglevel=error $tgz'],
    ["ps1 默认根目录在 LOCALAPPDATA 下", 'Join-Path $env:LOCALAPPDATA "SayDo"'],
    ["ps1 根目录越出用户目录需显式放行", 'SAYDO_INSTALL_ALLOW_OUTSIDE_HOME'],
    ["ps1 用户目录基准含 USERPROFILE 与 LOCALAPPDATA", '$userBases = @([IO.Path]::GetFullPath($env:USERPROFILE).TrimEnd(\'\\\'), [IO.Path]::GetFullPath($env:LOCALAPPDATA).TrimEnd(\'\\\'))'],
    ["ps1 用户目录约束默认不成立", '$insideUserDir = $false'],
    ["ps1 用户目录前缀比较含目录分隔符边界", '$Root.StartsWith($base + \'\\\', [StringComparison]::OrdinalIgnoreCase)'],
    ["ps1 根目录先 GetFullPath 消解 ..", '$Root = [IO.Path]::GetFullPath($Root)'],
    ["ps1 用户 PATH 前插且保留原值", '[Environment]::SetEnvironmentVariable("Path", (@($BinDir) + $parts) -join ";", "User")'],
    ["ps1 启动器用 %~dp0 相对引用根目录", 'function ConvertTo-LauncherPath'],
    ["ps1 启动器 cli 路径相对启动器目录", "return '%~dp0..\\' + $rel"],
    ["ps1 Node 下载校验", 'if ($actual -ne $expected) { Fail "Node 下载校验失败'],
    ["ps1 Node 版本按 node -v 解析", "if ($v -match '^v(\\d+)\\.') { return [int]$Matches[1] }"],
    ["ps1 Root 拒换行与引号", "$Root -match '[\\r\\n\"]'"],
    ["ps1 启动器相对段拒 cmd 二次展开", "$rel -match '[\\r\\n\"%!]'"],
    ["ps1 根外启动器路径拒 cmd 二次展开", "$p -match '[\\r\\n\"%!]'"]
  ];
  for (const [label, needle] of SH_INVARIANTS) if (!input.sh.includes(needle)) errors.push(`install.sh 缺少关键语句:${label}`);
  for (const [label, needle] of PS_INVARIANTS) if (!input.ps1.includes(needle)) errors.push(`install.ps1 缺少关键语句:${label}`);
  if (/\$MyInvocation/u.test(input.ps1)) errors.push("install.ps1 不得依赖 $MyInvocation(irm | iex 与 -File 两种执行形态必须一致)");
  if (/-Encoding ASCII/u.test(input.ps1)) errors.push("install.ps1 不得用 -Encoding ASCII 写含路径的文件(非 ASCII 用户名会被替换)");
  if (/\r/u.test(input.sh)) errors.push("install.sh 含 CR");
  if (!/^#!\/bin\/sh\n/u.test(input.sh)) errors.push("install.sh 必须以 #!/bin/sh 开头");
  for (const path of ["/install.sh", "/install.ps1", "/install-core.ps1"]) {
    const block = new RegExp(`^${path.replace(".", "\\.")}\\n((?:  .+\\n)+)`, "mu").exec(input.headers);
    if (!block) errors.push(`_headers 缺少 ${path} 段`);
    else if (!/Content-Type: text\/plain; charset=utf-8/u.test(block[1])) errors.push(`_headers ${path} 缺少 text/plain; charset=utf-8`);
  }
  for (const [label, text] of [["README.md", input.readme], ["docs/index.html", input.docsZh], ["en/docs/index.html", input.docsEn], ["index.html", input.indexZh], ["en/index.html", input.indexEn]]) {
    if (!text.includes("https://saydo.octoooo.com/install.sh")) errors.push(`${label} 缺少 install.sh 入口`);
    if (!text.includes("https://saydo.octoooo.com/install.ps1")) errors.push(`${label} 缺少 install.ps1 入口`);
  }
  return errors;
}

function loadInput() {
  const availabilityEvidence = readdirSync(join(repo, EVIDENCE_DIR))
    .filter((name) => name.endsWith("-availability.json"))
    .map((name) => JSON.parse(read(`${EVIDENCE_DIR}/${name}`)));
  return {
    sh: read(SH),
    ps1: read(PS1),
    ps1Boot: read(PS1_BOOT),
    headers: read(HEADERS),
    readme: read("README.md"),
    docsZh: read(`${SITE}/docs/index.html`),
    docsEn: read(`${SITE}/en/docs/index.html`),
    indexZh: read(`${SITE}/index.html`),
    indexEn: read(`${SITE}/en/index.html`),
    availabilityEvidence
  };
}

function expectRed(label, mutate) {
  const input = loadInput();
  mutate(input);
  const errors = checkInstallScripts(input);
  if (errors.length === 0) throw new Error(`[fail] mutation 未被判红:${label}`);
}

const input = loadInput();
const errors = checkInstallScripts(input);
if (errors.length > 0) {
  for (const error of errors) process.stderr.write(`[fail] ${error}\n`);
  process.exit(1);
}
const syntax = spawnSync("sh", ["-n", join(repo, SH)], { encoding: "utf8" });
if (syntax.status !== 0) {
  process.stderr.write(`[fail] install.sh 语法检查失败:${syntax.stderr}`);
  process.exit(1);
}
// 动态无写入检查:脚本在任何 mkdir/下载之前就必须以 [fail] 拒绝这两种输入(Codex 223 A-01/A-02)。
function expectShFailBeforeWrite(label, env) {
  const result = spawnSync("sh", [join(repo, SH)], { encoding: "utf8", env });
  const combined = `${result.stdout}${result.stderr}`;
  if (result.status === 0 || !combined.includes("[fail]")) {
    throw new Error(`[fail] install.sh 未按预期以 [fail] 拒绝:${label}(exit=${result.status})\n${combined}`);
  }
}
const cleanEnv = { PATH: process.env.PATH ?? "/usr/bin:/bin" };
expectShFailBeforeWrite("HOME 缺失", { ...cleanEnv });
expectShFailBeforeWrite("SAYDO_HOME 越出 HOME", { ...cleanEnv, HOME: "/nonexistent-home-for-test", SAYDO_HOME: "/var/lib/saydo-test" });
expectShFailBeforeWrite("SAYDO_HOME 用 .. 越出 HOME", { ...cleanEnv, HOME: "/nonexistent-home-for-test", SAYDO_HOME: "/nonexistent-home-for-test/../../var/lib/saydo-test" });
expectShFailBeforeWrite("HOME 自身含 ..", { ...cleanEnv, HOME: "/nonexistent-home-for-test/../x" });
// symlink 越出:在临时 HOME 内放一个指向 HOME 外的 symlink,SAYDO_HOME 指向其下;必须在写入前 [fail],且目标目录不得被创建。
// 分别在带 realpath 与不带 realpath(PATH 只留 /usr/bin)的 PATH 下各跑一次。
{
  const base = mkdtempSync(join(tmpdir(), "saydo-install-selftest-"));
  const fakeHome = join(base, "home");
  const outside = join(base, "outside");
  mkdirSync(fakeHome);
  mkdirSync(outside);
  symlinkSync(outside, join(fakeHome, "escape"));
  for (const pathValue of [process.env.PATH ?? "/usr/bin:/bin", "/usr/bin"]) {
    const result = spawnSync("/bin/sh", [join(repo, SH)], {
      encoding: "utf8",
      env: { PATH: pathValue, HOME: fakeHome, SAYDO_HOME: join(fakeHome, "escape", ".saydo"), SAYDO_INSTALL_NO_MODIFY_PATH: "1" }
    });
    const combined = `${result.stdout}${result.stderr}`;
    if (result.status === 0 || !combined.includes("[fail]") || !combined.includes("symlink")) {
      throw new Error(`[fail] install.sh 未在写入前拒绝 symlink 越出(PATH=${pathValue}, exit=${result.status})\n${combined}`);
    }
    if (existsSync(join(outside, ".saydo"))) throw new Error("[fail] symlink 越出场景仍创建了目标目录");
  }
  rmSync(base, { recursive: true, force: true });
}
expectRed("sh 删除 .. 拒绝", (mutated) => {
  mutated.sh = mutated.sh.replace('case "/$SAYDO_HOME/" in */../*) fail', 'case "/$SAYDO_HOME/" in */never-match/*) fail');
});
expectRed("ps1 用户目录基准只剩 USERPROFILE", (mutated) => {
  mutated.ps1 = mutated.ps1.replace('$userBases = @([IO.Path]::GetFullPath($env:USERPROFILE).TrimEnd(\'\\\'), [IO.Path]::GetFullPath($env:LOCALAPPDATA).TrimEnd(\'\\\'))', '$userBases = @([IO.Path]::GetFullPath($env:USERPROFILE).TrimEnd(\'\\\'))');
});
expectRed("ps1 系统目录绕过用户目录约束", (mutated) => {
  mutated.ps1 = mutated.ps1.replace('$insideUserDir = $false', '$insideUserDir = $true');
});
expectRed("ps1 相邻前缀目录被误认在用户目录内", (mutated) => {
  mutated.ps1 = mutated.ps1.replace('$Root.StartsWith($base + \'\\\', [StringComparison]::OrdinalIgnoreCase)', '$Root.StartsWith($base, [StringComparison]::OrdinalIgnoreCase)');
});
expectRed("sh 删除包 digest 校验", (mutated) => {
  mutated.sh = mutated.sh.replace('[ "$actual" = "$SAYDO_TGZ_SHA256" ] || fail "SayDo 包校验失败', '[ 1 = 1 ] || fail "SayDo 包校验失败');
});
expectRed("ps1 删除包 digest 校验", (mutated) => {
  mutated.ps1 = mutated.ps1.replace('if ($actualTgz -ne $SaydoTgzSha256) { Fail "SayDo 包校验失败', 'if ($false) { Fail "SayDo 包校验失败');
});
expectRed("sh 安装目标改成非钉住包", (mutated) => {
  mutated.sh = mutated.sh.replace('--loglevel=error "$tgz"', '--loglevel=error @saydo/cli@latest');
});
expectRed("sh 默认根目录改到系统位置", (mutated) => {
  mutated.sh = mutated.sh.replace('SAYDO_HOME="${SAYDO_HOME:-$HOME/.saydo}"', 'SAYDO_HOME="${SAYDO_HOME:-/usr/local/share/saydo}"');
});
expectRed("sh PATH 写入语句被抹掉", (mutated) => {
  mutated.sh = mutated.sh.replace("printf '\\n%s\\n' \"$rc_line\" >> \"$rc_file\"", ":");
});
expectRed("sh fish 新终端找不到 saydo", (mutated) => {
  mutated.sh = mutated.sh.replace('fish_line="set -gx PATH ${q_bin_fish} \\$PATH # saydo"', ':');
});
expectRed("sh 删除 posix_sq", (mutated) => {
  mutated.sh = mutated.sh.replace("posix_sq()", "posix_sq_removed()");
});
expectRed("sh 删除换行拒绝", (mutated) => {
  mutated.sh = mutated.sh.replaceAll("reject_unembeddable_path", "skip_embed_check");
});
expectRed("sh 启动器退化为裸插值", (mutated) => {
  mutated.sh = mutated.sh.replace('q_node_bin=$(posix_sq "$NODE_BIN")', 'q_node_bin=\'"\'$NODE_BIN\'"\'');
});
expectRed("ps1 用户 PATH 只写 BinDir", (mutated) => {
  mutated.ps1 = mutated.ps1.replace('(@($BinDir) + $parts) -join ";"', '$BinDir');
});
expectRed("ps1 irm|iex 形态被 MyInvocation 短路", (mutated) => {
  mutated.ps1 = mutated.ps1.replace('$ErrorActionPreference = "Stop"', 'if (-not $MyInvocation.MyCommand.Path) { return }\n$ErrorActionPreference = "Stop"');
});
expectRed("ps1 启动器改回字面路径 + ASCII 写入", (mutated) => {
  mutated.ps1 = mutated.ps1.replace('function ConvertTo-LauncherPath', 'function ConvertTo-LauncherPathX').replace('$launcherEncoding)', '$launcherEncoding); Set-Content -Path $launcher -Encoding ASCII -Value $launcherText');
});
expectRed("ps1 启动器不再拒绝 cmd 二次展开", (mutated) => {
  mutated.ps1 = mutated.ps1.replace('if ($rel -match \'[\\r\\n"%!]\')', 'if ($false)');
});
expectRed("ps1 Root 换行引号拒绝被删", (mutated) => {
  mutated.ps1 = mutated.ps1.replace('if ($Root -match \'[\\r\\n"]\')', 'if ($false)');
});
expectRed("digest 篡改", (mutated) => {
  mutated.sh = mutated.sh.replace(/^SAYDO_TGZ_SHA256="([0-9a-f]{63})([0-9a-f])"$/mu, (_match, head, last) =>
    `SAYDO_TGZ_SHA256="${head}${last === "0" ? "1" : "0"}"`);
});
expectRed("版本漂移", (mutated) => {
  mutated.ps1 = mutated.ps1.replace(/^\$SaydoVersion = "([^"]+)"$/mu, '$SaydoVersion = "0.0.0-rc.0"');
});
expectRed("availability 证据缺失", (mutated) => {
  mutated.availabilityEvidence = [];
});
expectRed("availability 未全部 available", (mutated) => {
  mutated.availabilityEvidence = mutated.availabilityEvidence.map((item) => ({
    ...item,
    availability: [{ path: "README.md", state: "candidate" }]
  }));
});
expectRed("_headers 缺 charset", (mutated) => {
  mutated.headers = mutated.headers.replace("/install.ps1\n  Content-Type: text/plain; charset=utf-8\n", "/install.ps1\n");
});
expectRed("ps1 丢 BOM", (mutated) => {
  mutated.ps1 = mutated.ps1.replace(/^﻿/u, "");
});
expectRed("引导脚本带 BOM", (mutated) => {
  mutated.ps1Boot = `﻿${mutated.ps1Boot}`;
});
expectRed("引导脚本混入非 ASCII", (mutated) => {
  mutated.ps1Boot = mutated.ps1Boot.replace("# SayDo one-command", "# SayDo 一键");
});
expectRed("引导脚本丢核心 URL", (mutated) => {
  mutated.ps1Boot = mutated.ps1Boot.replace("https://saydo.octoooo.com/install-core.ps1", "https://example.com/x.ps1");
});
expectRed("引导脚本顶层 exit", (mutated) => {
  mutated.ps1Boot = `${mutated.ps1Boot}\nexit 1\n`;
});
expectRed("_headers 缺核心脚本段", (mutated) => {
  mutated.headers = mutated.headers.replace("/install-core.ps1\n  Content-Type: text/plain; charset=utf-8\n", "");
});
expectRed("镜像 URL 漂移", (mutated) => {
  mutated.sh = mutated.sh.replace(/^SAYDO_TGZ_MIRROR_URL="[^"]+"$/mu, 'SAYDO_TGZ_MIRROR_URL="https://example.com/x.tgz"');
});
expectRed("README 丢入口", (mutated) => {
  mutated.readme = mutated.readme.replace("https://saydo.octoooo.com/install.sh", "");
});
// 隔离全安装探针(SC-17 回归):桩掉 curl/sha256sum/node/npm,在含空格、单引号、$()、反引号的 HOME 名
// 下真跑 install.sh,验证生成的启动器与 shell 启动文件不触发命令替换且可实际执行。
function writeExec(path, body) {
  writeFileSync(path, body);
  chmodSync(path, 0o755);
}

function runIsolatedInstall({ homeName, shell = "/bin/sh", extraEnv = {} }) {
  const base = mkdtempSync(join(tmpdir(), "saydo-install-full-"));
  const fakeHome = join(base, homeName);
  mkdirSync(fakeHome, { recursive: true });
  const stubBin = join(base, "stub-bin");
  mkdirSync(stubBin);
  const tools = join(fakeHome, ".tools");
  mkdirSync(tools, { recursive: true });
  mkdirSync(join(fakeHome, "lib/node_modules/npm/bin"), { recursive: true });
  writeFileSync(join(fakeHome, "lib/node_modules/npm/bin/npm-cli.js"), "// npm stub\n");
  const sha = pinOf(read(SH), "sh").sha;
  writeExec(
    join(stubBin, "curl"),
    `#!/bin/sh
while [ "$#" -gt 0 ]; do
  if [ "$1" = "-o" ]; then shift; : > "$1"; fi
  shift
done
`
  );
  writeExec(
    join(stubBin, "sha256sum"),
    `#!/bin/sh
printf "${sha}  %s\\n" "$1"
`
  );
  writeExec(
    join(tools, "node"),
    `#!/bin/sh
if [ "$1" = "-p" ]; then printf '22\\n'; exit 0; fi
if [ "$1" = "-v" ]; then printf 'v22.0.0\\n'; exit 0; fi
prefix=""
prev=""
for a in "$@"; do
  if [ "$prev" = "--prefix" ]; then prefix="$a"; fi
  prev="$a"
done
if [ -n "$prefix" ]; then
  dest="$prefix/lib/node_modules/@saydo/cli/dist/cli.mjs"
  mkdir -p "$(dirname "$dest")"
  printf '%s\\n' 'console.log("saydo-stub-ok")' > "$dest"
  exit 0
fi
if [ -f "$1" ]; then
  printf '%s\\n' "$1" > "$SAYDO_LAUNCHER_MARK"
  printf 'saydo-stub-ok\\n'
  exit 0
fi
exit 0
`
  );
  const mark = join(base, "launcher-mark");
  const result = spawnSync("/bin/sh", [join(repo, SH)], {
    encoding: "utf8",
    cwd: base,
    timeout: 20000,
    env: {
      PATH: `${tools}:${stubBin}:/usr/bin:/bin`,
      HOME: fakeHome,
      SHELL: shell,
      SAYDO_LAUNCHER_MARK: mark,
      TMPDIR: base,
      ...extraEnv
    }
  });
  return { base, fakeHome, tools, result, mark, binDir: join(fakeHome, ".saydo/bin") };
}

function assertNoInjection(base, label) {
  if (existsSync(join(base, "injected"))) {
    throw new Error(`[fail] unexpected marker after ${label}`);
  }
}

function assertInstallUsable({ homeName, shell, rcRel, sourceCmd }) {
  const run = runIsolatedInstall({ homeName, shell });
  try {
    const combined = `${run.result.stdout}${run.result.stderr}`;
    if (run.result.status !== 0) {
      throw new Error(`[fail] install.sh exit=${run.result.status} home=${homeName}\n${combined}`);
    }
    assertNoInjection(run.base, `install ${homeName}`);
    const launcher = join(run.binDir, "saydo");
    if (!existsSync(launcher)) throw new Error(`[fail] missing launcher for ${homeName}`);
    const launcherText = readFileSync(launcher, "utf8");
    if (!/exec '.*' '.*' "\$@"/s.test(launcherText)) {
      throw new Error(`[fail] launcher is not POSIX-single-quoted:\n${launcherText}`);
    }
    const launched = spawnSync("/bin/sh", [launcher, "status"], {
      encoding: "utf8",
      cwd: run.base,
      timeout: 10000,
      env: { PATH: "/usr/bin:/bin", HOME: run.fakeHome, SAYDO_LAUNCHER_MARK: run.mark }
    });
    if (launched.status !== 0) {
      throw new Error(`[fail] launcher exit=${launched.status} home=${homeName}\n${launched.stdout}${launched.stderr}`);
    }
    assertNoInjection(run.base, `launcher ${homeName}`);
    if (!existsSync(run.mark)) throw new Error(`[fail] launcher did not reach stub cli for ${homeName}`);
    const marked = readFileSync(run.mark, "utf8").trim();
    const cli = join(run.fakeHome, ".saydo/toolchain/prefix/lib/node_modules/@saydo/cli/dist/cli.mjs");
    if (marked !== cli || !existsSync(cli)) {
      throw new Error(`[fail] launcher path not usable: marked=${marked} cli=${cli}`);
    }
    const rc = join(run.fakeHome, rcRel);
    if (!existsSync(rc)) throw new Error(`[fail] missing ${rcRel} for ${homeName}`);
    const sourced = spawnSync("/bin/sh", ["-c", sourceCmd], {
      encoding: "utf8",
      cwd: run.base,
      timeout: 10000,
      env: { HOME: run.fakeHome, PATH: "/usr/bin:/bin", SHELL: shell }
    });
    if (sourced.status !== 0) {
      throw new Error(`[fail] source ${rcRel} exit=${sourced.status}\n${sourced.stdout}${sourced.stderr}`);
    }
    assertNoInjection(run.base, `source ${rcRel} ${homeName}`);
    if (!sourced.stdout.includes(run.binDir)) {
      throw new Error(`[fail] sourced PATH missing BIN_DIR for ${homeName}: ${sourced.stdout}`);
    }
  } finally {
    rmSync(run.base, { recursive: true, force: true });
  }
}

assertInstallUsable({
  homeName: "home with space",
  shell: "/bin/sh",
  rcRel: ".profile",
  sourceCmd: '. "$HOME/.profile"; printf "%s\\n" "$PATH"'
});
assertInstallUsable({
  homeName: "home's-dir",
  shell: "/bin/sh",
  rcRel: ".profile",
  sourceCmd: '. "$HOME/.profile"; printf "%s\\n" "$PATH"'
});
assertInstallUsable({
  homeName: "home-$(touch injected)",
  shell: "/bin/sh",
  rcRel: ".profile",
  sourceCmd: '. "$HOME/.profile"; printf "%s\\n" "$PATH"'
});
assertInstallUsable({
  homeName: "home-`touch injected`",
  shell: "/bin/sh",
  rcRel: ".profile",
  sourceCmd: '. "$HOME/.profile"; printf "%s\\n" "$PATH"'
});
assertInstallUsable({
  homeName: "home with space",
  shell: "/bin/bash",
  rcRel: ".bashrc",
  sourceCmd: '. "$HOME/.bashrc"; printf "%s\\n" "$PATH"'
});
assertInstallUsable({
  homeName: "home-$(touch injected)",
  shell: "/bin/zsh",
  rcRel: ".zshrc",
  sourceCmd: '. "$HOME/.zshrc"; printf "%s\\n" "$PATH"'
});

{
  const fishHome = "home-$(touch injected)";
  const run = runIsolatedInstall({ homeName: fishHome, shell: "/usr/bin/fish" });
  try {
    if (run.result.status !== 0) {
      throw new Error(`[fail] fish install exit=${run.result.status}\n${run.result.stdout}${run.result.stderr}`);
    }
    assertNoInjection(run.base, "fish install");
    const rc = join(run.fakeHome, ".config/fish/config.fish");
    if (!existsSync(rc)) throw new Error("[fail] missing fish config");
    const line = readFileSync(rc, "utf8");
    if (!line.includes("set -gx PATH '") || line.includes('set -gx PATH "')) {
      throw new Error(`[fail] fish config is not single-quoted:\n${line}`);
    }
    const fishBin = spawnSync("/bin/sh", ["-c", "command -v fish"], { encoding: "utf8" });
    if (fishBin.status === 0 && fishBin.stdout.trim()) {
      const sourced = spawnSync(fishBin.stdout.trim(), ["-c", "source $HOME/.config/fish/config.fish; printf '%s\\n' $PATH"], {
        encoding: "utf8",
        cwd: run.base,
        timeout: 10000,
        env: { HOME: run.fakeHome, PATH: "/usr/bin:/bin" }
      });
      if (sourced.status !== 0) {
        throw new Error(`[fail] fish source exit=${sourced.status}\n${sourced.stdout}${sourced.stderr}`);
      }
      assertNoInjection(run.base, "fish source");
      if (!sourced.stdout.includes(run.binDir)) {
        throw new Error(`[fail] fish PATH missing BIN_DIR: ${sourced.stdout}`);
      }
    }
  } finally {
    rmSync(run.base, { recursive: true, force: true });
  }
}

{
  const base = mkdtempSync(join(tmpdir(), "saydo-install-nl-"));
  const fakeHome = join(base, "home\nline");
  mkdirSync(fakeHome);
  const before = spawnSync("/bin/sh", [join(repo, SH)], {
    encoding: "utf8",
    cwd: base,
    timeout: 10000,
    env: { PATH: "/usr/bin:/bin", HOME: fakeHome, SHELL: "/bin/sh" }
  });
  const combined = `${before.stdout}${before.stderr}`;
  if (before.status === 0 || !combined.includes("[fail]") || !combined.includes("换行")) {
    rmSync(base, { recursive: true, force: true });
    throw new Error(`[fail] newline HOME was not rejected (exit=${before.status})\n${combined}`);
  }
  if (existsSync(join(fakeHome, ".saydo"))) {
    rmSync(base, { recursive: true, force: true });
    throw new Error("[fail] newline HOME still wrote .saydo");
  }
  rmSync(base, { recursive: true, force: true });
}

process.stdout.write(`[ok] install scripts pinned to v${pinOf(input.sh, "sh").version}; mutations=31 all red; dynamic no-write checks=6; isolated full-install path cases=7+newline\n`);
