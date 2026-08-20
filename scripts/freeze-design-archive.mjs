#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  chmodSync,
  lstatSync,
  readFileSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

const [command, archiveArg, targetArg] = process.argv.slice(2);
if (!["freeze", "unfreeze"].includes(command) || !archiveArg || !targetArg) {
  console.error("用法:freeze-design-archive.mjs <freeze|unfreeze> <archive-dir> <saydo-dir>");
  process.exit(2);
}

const archiveDir = resolve(archiveArg);
const targetDir = resolve(targetArg);
const expectedArchiveBasename = "voice-coding.archive-20260729";
const expectedTargetBasename = "SayDo";
const expectedArchiveDir = "/Users/wangyixiao/WorkSpace/voice-coding.archive-20260729";
const expectedTargetDir = "/Users/wangyixiao/WorkSpace/SayDo";
const expectedBaseline = "838aeea4385a41ec58318437bb36a7db5ede635f";
const expectedMigrationBranch = "codex/merge-voice-coding-20260729";
const expectedManifestSha256 = "4f195260f116d2e96dcafd3594080079c13e94ecee119f548d91cfb0747d274a";
const manifestFile = join(targetDir, "docs/plan/migration/source-prearchive-manifest.tsv");
const manifestScript = join(targetDir, "scripts/design-archive-manifest.mjs");
const statIfPresent = (path) => {
  try {
    return lstatSync(path);
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  }
};

const declarationMode = 0o644;
const assertRegularText = (path, expected, label) => {
  const stat = statIfPresent(path);
  if (!stat?.isFile()) throw new Error(`${label}不是普通文件:${path}`);
  if (readFileSync(path, "utf8") !== expected) throw new Error(`${label}与预期不符:${path}`);
  if ((stat.mode & 0o7777) !== declarationMode) {
    throw new Error(`${label}mode 与预期不符:${path}`);
  }
};

if (basename(archiveDir) !== expectedArchiveBasename) {
  throw new Error(`拒绝冻结非预期目录:${archiveDir}`);
}
if (
  basename(targetDir) !== expectedTargetBasename ||
  dirname(archiveDir) !== dirname(targetDir)
) {
  throw new Error(`archive 与 SayDo 必须是同一父目录下的精确目标:${archiveDir} / ${targetDir}`);
}
const testRoot = process.env.SAYDO_MIGRATION_TEST_ROOT
  ? resolve(process.env.SAYDO_MIGRATION_TEST_ROOT)
  : undefined;
const productionCoordinates = archiveDir === expectedArchiveDir && targetDir === expectedTargetDir;
const explicitTestCoordinates =
  testRoot !== undefined && dirname(archiveDir) === testRoot && dirname(targetDir) === testRoot;
if (!productionCoordinates && !explicitTestCoordinates) {
  throw new Error(`拒绝非生产坐标；隔离演练必须显式绑定 SAYDO_MIGRATION_TEST_ROOT:${archiveDir}`);
}
if (
  !existsSync(archiveDir) ||
  !existsSync(targetDir) ||
  !lstatSync(archiveDir).isDirectory() ||
  !lstatSync(targetDir).isDirectory()
) {
  throw new Error("archive-dir 与 saydo-dir 必须是普通目录");
}
const git = (...args) =>
  execFileSync("git", args, {
    cwd: targetDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
if (realpathSync(resolve(git("rev-parse", "--show-toplevel"))) !== realpathSync(targetDir)) {
  throw new Error(`SayDo 目标不是 Git 根:${targetDir}`);
}
const head = git("rev-parse", "HEAD");
const branch = git("branch", "--show-current");
if (command === "freeze" && branch !== expectedMigrationBranch) {
  throw new Error(`SayDo 不在迁移专用分支:${branch || "(detached)"}`);
}
if (command === "freeze" && head !== expectedBaseline) {
  throw new Error(`SayDo HEAD 不是迁移基线:${head}`);
}
try {
  git("merge-base", "--is-ancestor", expectedBaseline, "HEAD");
} catch {
  throw new Error(`SayDo HEAD 不包含迁移基线:${expectedBaseline}`);
}
if (!existsSync(manifestFile) || !existsSync(manifestScript)) {
  throw new Error("SayDo 缺少源清单或清单校验脚本");
}
const manifestSha256 = createHash("sha256").update(readFileSync(manifestFile)).digest("hex");
if (manifestSha256 !== expectedManifestSha256) {
  throw new Error(`源清单身份不符:${manifestSha256}`);
}

const frozenAt = "2026-07-29";
const files = [
  {
    name: "AGENTS.md",
    backup: "AGENTS.prearchive.md",
    content:
      "# AGENTS.md — 冻结归档规则\n\n" +
      "> 本目录是 2026-07-29 冻结的只读历史档案，不再是 SayDo 的开发入口或真相源。\n" +
      `> 唯一活动仓:${targetDir}\n` +
      "> 禁止在本目录新增、修改、删除或生成文件;需要开发、查证或回写时请切换到唯一活动仓。\n" +
      "> 本冻结动作不执行 commit 或 push;Git 操作须由 owner 另行授权。\n"
  },
  {
    name: "README.md",
    backup: "README.prearchive.md",
    content:
      "# voice-coding 冻结归档\n\n" +
      `本目录于 ${frozenAt} 冻结，仅保留迁移前原始字节、日志、依赖缓存与历史快照。\n\n` +
      `SayDo 的唯一活动仓是 \`${targetDir}\`。迁移记录见该仓 \`docs/plan/MIGRATION.md\`。\n\n` +
      "原 README 与 AGENTS 分别保存在 `README.prearchive.md`、`AGENTS.prearchive.md`，禁止在本归档继续开发。\n"
  }
];

const states = files.map((file) => {
  const active = join(archiveDir, file.name);
  const backup = join(archiveDir, file.backup);
  const frozenCopy = join(archiveDir, file.name.replace(/\.md$/, ".frozen.md"));
  const activeExists = statIfPresent(active) !== undefined;
  const backupExists = statIfPresent(backup) !== undefined;
  const frozenExists = statIfPresent(frozenCopy) !== undefined;
  if (command === "freeze") {
    if (frozenExists) throw new Error(`检测到解冻中断产物,拒绝反向冻结:${frozenCopy}`);
    if (!backupExists && !activeExists) throw new Error(`缺少待冻结文件:${active}`);
    if (backupExists) {
      if (activeExists) assertRegularText(active, file.content, "冻结声明");
    } else if (activeExists && readFileSync(active, "utf8") === file.content) {
      throw new Error(`冻结原文备份缺失:${backup}`);
    }
  } else {
    if (frozenExists) assertRegularText(frozenCopy, file.content, "冻结声明备份");
    if (backupExists) {
      if (activeExists) assertRegularText(active, file.content, "拒绝覆盖非冻结声明");
      if (activeExists && frozenExists) throw new Error(`冻结声明重复:${active}`);
    } else {
      if (!activeExists) throw new Error(`恢复后的原文缺失:${active}`);
      if (readFileSync(active, "utf8") === file.content) {
        throw new Error(`冻结原文备份缺失:${backup}`);
      }
    }
  }
  return {
    ...file,
    backupName: file.backup,
    frozenName: file.name.replace(/\.md$/, ".frozen.md"),
    active,
    backup,
    frozenCopy,
    activeExists,
    backupExists,
    frozenExists
  };
});

const manifestRecords = new Map(
  readFileSync(manifestFile, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [sha256, bytes, type, fileMode, path] = line.split("\t");
      return [path, { sha256, bytes, type, mode: fileMode }];
    })
);
for (const state of states) {
  if (!state.backupExists) continue;
  const expected = manifestRecords.get(state.name);
  if (!expected) throw new Error(`源清单缺少入口原文:${state.name}`);
  const stat = lstatSync(state.backup);
  if (!stat.isFile()) throw new Error(`冻结原文备份不是普通文件:${state.backup}`);
  const actual = {
    sha256: createHash("sha256").update(readFileSync(state.backup)).digest("hex"),
    bytes: String(stat.size),
    type: "F",
    mode: (stat.mode & 0o7777).toString(8).padStart(4, "0")
  };
  if (
    actual.sha256 !== expected.sha256 ||
    actual.bytes !== expected.bytes ||
    actual.type !== expected.type ||
    actual.mode !== expected.mode
  ) {
    throw new Error(`冻结原文备份与源清单不符:${state.backup}`);
  }
}

const archiveCheck = (allowlist = []) => {
  execFileSync(
    process.execPath,
    [manifestScript, "check", archiveDir, manifestFile, ...allowlist],
    { stdio: "inherit" }
  );
};
const transitionAllowlist = [];
const completedFreezeAllowlist = states.flatMap((state) => [state.name, state.backupName]);
for (const state of states) {
  if (state.backupExists) {
    transitionAllowlist.push(state.name, state.backupName);
  }
  if (command === "unfreeze" && state.frozenExists) {
    transitionAllowlist.push(state.frozenName);
  }
}
archiveCheck(transitionAllowlist);

if (command === "freeze") {
  for (const state of states) {
    if (!state.backupExists) renameSync(state.active, state.backup);
    if (!existsSync(state.active)) {
      writeFileSync(state.active, state.content, { mode: declarationMode });
      chmodSync(state.active, declarationMode);
    }
  }
  archiveCheck(completedFreezeAllowlist);
  console.log(`[ok] archive tombstones active: ${archiveDir}`);
} else {
  for (const state of states) {
    if (!state.backupExists) continue;
    if (existsSync(state.active)) renameSync(state.active, state.frozenCopy);
    renameSync(state.backup, state.active);
  }
  for (const state of states) if (existsSync(state.frozenCopy)) unlinkSync(state.frozenCopy);
  archiveCheck();
  console.log(`[ok] archive originals restored: ${archiveDir}`);
}
