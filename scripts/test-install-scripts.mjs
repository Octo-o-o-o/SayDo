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
  // 引导文件编码属性与核心下载入口；PowerShell 执行语义另需实际环境验证。
  if (input.ps1Boot.startsWith("﻿")) errors.push("install.ps1 引导脚本不得带 BOM(PS 5.1 的 irm 会把 BOM 留成 U+FEFF 使 iex 解析失败)");
  if (/[^\x00-\x7f]/u.test(input.ps1Boot)) errors.push("install.ps1 引导脚本必须纯 ASCII(irm | iex 形态下无法保证解码)");
  if (!input.ps1Boot.includes("https://saydo.octoooo.com/install-core.ps1")) errors.push("install.ps1 引导脚本缺核心脚本固定 URL");
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
const packageFixture = "saydo-install-package-fixture\n";

function writeExec(path, body) {
  writeFileSync(path, body);
  chmodSync(path, 0o755);
}

function runIsolatedInstall({ homeName, shell = "/bin/sh", extraEnv = {}, badDigest = false }) {
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
  const observed = Object.fromEntries(
    ["downloads", "hashPaths", "hashContent", "npmCalls", "npmArgs", "npmFiles", "npmContent"].map((key) => [key, join(base, key)])
  );
  writeExec(
    join(stubBin, "curl"),
    `#!/bin/sh
while [ "$#" -gt 0 ]; do
  if [ "$1" = "-o" ]; then
    shift
    printf '%s\\0' "$1" >> "$SAYDO_TEST_DOWNLOADS"
    printf '%s' "$SAYDO_TEST_PACKAGE" > "$1"
  fi
  shift
done
`
  );
  writeExec(
    join(stubBin, "sha256sum"),
    `#!/bin/sh
printf '%s\\0' "$1" >> "$SAYDO_TEST_HASH_PATHS"
cat "$1" > "$SAYDO_TEST_HASH_CONTENT"
printf '%s  %s\\n' "$SAYDO_TEST_DIGEST" "$1"
`
  );
  writeExec(
    join(tools, "node"),
    `#!/bin/sh
if [ "$1" = "-p" ]; then printf '22\\n'; exit 0; fi
if [ "$1" = "-v" ]; then printf 'v22.0.0\\n'; exit 0; fi
case "$1" in */npm-cli.js)
  printf 'call\\n' >> "$SAYDO_TEST_NPM_CALLS"
  printf '%s\\0' "$@" > "$SAYDO_TEST_NPM_ARGS"
  for a in "$@"; do
    if [ "$a" != "$1" ] && [ -f "$a" ]; then
      printf '%s\\0' "$a" >> "$SAYDO_TEST_NPM_FILES"
      cat "$a" > "$SAYDO_TEST_NPM_CONTENT"
    fi
  done
  ;;
esac
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
      SAYDO_TEST_PACKAGE: packageFixture,
      SAYDO_TEST_DIGEST: badDigest ? `${sha[0] === "0" ? "1" : "0"}${sha.slice(1)}` : sha,
      SAYDO_TEST_DOWNLOADS: observed.downloads,
      SAYDO_TEST_HASH_PATHS: observed.hashPaths,
      SAYDO_TEST_HASH_CONTENT: observed.hashContent,
      SAYDO_TEST_NPM_CALLS: observed.npmCalls,
      SAYDO_TEST_NPM_ARGS: observed.npmArgs,
      SAYDO_TEST_NPM_FILES: observed.npmFiles,
      SAYDO_TEST_NPM_CONTENT: observed.npmContent,
      TMPDIR: base,
      ...extraEnv
    }
  });
  return { base, fakeHome, tools, result, mark, observed, binDir: join(fakeHome, ".saydo/bin") };
}

function nulValues(path) {
  return existsSync(path) ? readFileSync(path, "utf8").split("\0").slice(0, -1) : [];
}

function assertPinnedPackage(run) {
  const { observed } = run;
  const tgz = join(run.fakeHome, ".saydo/toolchain", `saydo-cli-${pinOf(read(SH), "sh").version}.tgz`);
  const args = nulValues(observed.npmArgs);
  const packages = [];
  let prefix;
  let positional = false;
  for (let i = 2; i < args.length; i += 1) {
    const arg = args[i];
    if (positional) packages.push(arg);
    else if (arg === "--") positional = true;
    else if (arg === "--prefix") prefix = args[++i];
    else if (arg.startsWith("--prefix=")) prefix = arg.slice("--prefix=".length);
    else if (!arg.startsWith("-")) packages.push(arg);
  }
  if (
    !existsSync(observed.npmCalls) || readFileSync(observed.npmCalls, "utf8") !== "call\n" ||
    resolve(args[0] ?? "") !== join(run.fakeHome, "lib/node_modules/npm/bin/npm-cli.js") || args[1] !== "install" ||
    prefix !== join(run.fakeHome, ".saydo/toolchain/prefix") || packages.length !== 1 || packages[0] !== tgz
  ) {
    throw new Error("[fail] npm 安装调用未唯一绑定固定版本本地 tgz");
  }
  const hashPaths = nulValues(observed.hashPaths);
  if (
    JSON.stringify(nulValues(observed.downloads)) !== JSON.stringify([`${tgz}.part`]) ||
    hashPaths.length === 0 || hashPaths.some((path) => path !== tgz) ||
    JSON.stringify(nulValues(observed.npmFiles)) !== JSON.stringify([tgz]) ||
    [tgz, observed.hashContent, observed.npmContent].some((path) => !existsSync(path) || readFileSync(path, "utf8") !== packageFixture)
  ) {
    throw new Error("[fail] 下载、摘要观察与 npm 消费未绑定同一 tgz 内容");
  }
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
    assertPinnedPackage(run);
    assertNoInjection(run.base, `install ${homeName}`);
    const launcher = join(run.binDir, "saydo");
    if (!existsSync(launcher)) throw new Error(`[fail] missing launcher for ${homeName}`);
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

{
  const run = runIsolatedInstall({ homeName: "bad digest home", badDigest: true });
  try {
    const combined = `${run.result.stdout}${run.result.stderr}`;
    if (run.result.error || run.result.signal || !Number.isInteger(run.result.status) || run.result.status === 0 ||
      !combined.includes("[fail]") || !combined.includes("SayDo 包校验失败")) {
      throw new Error("[fail] 坏摘要未在包校验边界正常拒绝");
    }
    const forbiddenOutputs = [
      run.observed.npmCalls, join(run.binDir, "saydo"),
      join(run.fakeHome, ".saydo/toolchain/prefix/lib/node_modules/@saydo/cli/dist/cli.mjs"),
      ...[".profile", ".bashrc", ".bash_profile", ".zshrc", ".config/fish/config.fish"].map((path) => join(run.fakeHome, path))
    ];
    if (forbiddenOutputs.some((path) => existsSync(path))) {
      throw new Error("[fail] 坏摘要拒绝前仍调用 npm 或生成安装输出");
    }
    if (!existsSync(run.observed.hashContent) || readFileSync(run.observed.hashContent, "utf8") !== packageFixture) {
      throw new Error("[fail] 坏摘要用例没有实际观察下载内容");
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
    assertPinnedPackage(run);
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


process.stdout.write(`[ok] install scripts pinned to v${pinOf(input.sh, "sh").version}; metadata mutations rejected; dynamic no-write and isolated shell-install checks passed\n`);
