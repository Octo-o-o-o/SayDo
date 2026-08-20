// 阶段 A · saydo daemon 启停命令(07 D17;用法:just daemon <cmd> 或
// pnpm --filter @saydo/daemon daemon <cmd>)。
// 命令:install(写 plist + bootstrap;系统级变更,先过 owner 检查点)/ uninstall / start /
// stop(bootout 本次会话;plist 保留,重登录仍自起——彻底移除用 uninstall)/ restart / status / logs
// / deploy(W2 场次① C2:常驻 daemon 从 ~/.saydo/runtime 独立树跑锁定 SHA——开发树改代码/跑测试
// 不再打断 owner 真人语音会话;批收口后显式 deploy 更新,dogfood 时段不重启,HANDOFF §4 惯例)。

import { execFileSync } from "node:child_process";
import {
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
  writeFileSync
} from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildLaunchdPlist,
  buildPipelinePlist,
  LAUNCHD_LABEL,
  PIPELINE_LAUNCHD_LABEL,
  PLAN_REASON_NO_PIPELINE_DIR,
  pipelinePlistMissingMessage,
  planInstall
} from "./plist.js";
import { isExistingDirectory, resolveUvBin } from "./uvBin.js";
import { ensureManagedWorkspaceRoot, saydoStateRoot, validateStateRoot } from "../projects/workspace.js";

const SAYDO_HOME = saydoStateRoot();
const DAEMON_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", ".."); // src/launchd/ 上两层 = packages/daemon
const DEV_ROOT = resolve(DAEMON_DIR, "..", ".."); // 仓根(开发树)
const RUNTIME_DIR = join(SAYDO_HOME, "runtime"); // 常驻运行树(独立 clone,锁定收口 SHA)
const RELEASES_DIR = join(SAYDO_HOME, "releases");
const PLIST_PATH = join(homedir(), "Library", "LaunchAgents", `${LAUNCHD_LABEL}.plist`);
const PIPELINE_PLIST_PATH = join(homedir(), "Library", "LaunchAgents", `${PIPELINE_LAUNCHD_LABEL}.plist`);

function domainTarget(): string {
  const uid = typeof process.getuid === "function" ? process.getuid() : 501;
  return `gui/${uid}`;
}

function serviceTarget(): string {
  return `${domainTarget()}/${LAUNCHD_LABEL}`;
}

function pipelineServiceTarget(): string {
  return `${domainTarget()}/${PIPELINE_LAUNCHD_LABEL}`;
}

function launchctl(args: string[]): { ok: boolean; out: string } {
  try {
    return { ok: true, out: execFileSync("launchctl", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    return { ok: false, out: `${e.stdout ?? ""}${e.stderr ?? ""}${e.message ?? ""}`.trim() };
  }
}

/** bootout 后立即 bootstrap 会撞 launchd 收尾竞态(实测 "Bootstrap failed: 5: Input/output error");
 *  小退避重试(deploy 首跑实测第二次即成) */
function bootstrapWithRetry(plistPath: string, attempts = 4): { ok: boolean; out: string } {
  let last: { ok: boolean; out: string } = { ok: false, out: "" };
  for (let i = 0; i < attempts; i++) {
    last = launchctl(["bootstrap", domainTarget(), plistPath]);
    if (last.ok) return last;
    execFileSync("sleep", [String(2 + i)]);
  }
  return last;
}

function resolveTsxCli(treeRoot?: string): string {
  if (treeRoot) {
    // runtime 树:经 symlink 展开物理路径(pnpm 布局)
    return realpathSync(join(treeRoot, "packages", "daemon", "node_modules", "tsx", "dist", "cli.mjs"));
  }
  // 开发树:经 package.json 解析物理目录再拼 dist/cli.mjs(exports 不暴露 cli 子路径)
  const req = createRequire(join(DAEMON_DIR, "src", "index.ts"));
  return join(dirname(req.resolve("tsx/package.json")), "dist", "cli.mjs");
}

/** 写 plist(treeRoot 缺省 = 开发树;deploy 传 runtime 树,C2 运行时/开发树分离) */
function writePlist(treeRoot?: string): string {
  const daemonDir = treeRoot ? join(treeRoot, "packages", "daemon") : DAEMON_DIR;
  const tsxCli = resolveTsxCli(treeRoot);
  if (!existsSync(tsxCli)) throw new Error(`tsx cli 不存在:${tsxCli}(先在该树 pnpm install)`);
  const logsDir = join(SAYDO_HOME, "logs");
  mkdirSync(logsDir, { recursive: true });
  mkdirSync(dirname(PLIST_PATH), { recursive: true });
  const xml = buildLaunchdPlist({
    nodeBin: process.execPath,
    tsxCli,
    daemonEntry: join(daemonDir, "src", "index.ts"),
    workingDirectory: daemonDir,
    logsDir,
    pathEnv: process.env["PATH"] ?? "/usr/bin:/bin",
    saydoHome: SAYDO_HOME,
    saydoDev: process.env["SAYDO_DEV"]
  });
  writeFileSync(PLIST_PATH, xml);
  return PLIST_PATH;
}

function writePipelinePlist(uvBin: string): string {
  const pipelineDir = join(DEV_ROOT, "pipeline");
  if (!isExistingDirectory(pipelineDir)) throw new Error(PLAN_REASON_NO_PIPELINE_DIR);
  const logsDir = join(SAYDO_HOME, "logs");
  mkdirSync(logsDir, { recursive: true });
  mkdirSync(dirname(PIPELINE_PLIST_PATH), { recursive: true });
  // SAYDO_DAEMON_PORT:daemon plist 不写该键,pipeline 也不写,两边走缺省 47100。
  const xml = buildPipelinePlist({
    uvBin,
    pipelineDir,
    logsDir,
    pathEnv: process.env["PATH"] ?? "/usr/bin:/bin",
    saydoHome: SAYDO_HOME
  });
  const tmp = `${PIPELINE_PLIST_PATH}.${process.pid}.tmp`;
  try {
    writeFileSync(tmp, xml);
    renameSync(tmp, PIPELINE_PLIST_PATH);
  } catch (err) {
    rmSync(tmp, { force: true });
    throw err;
  }
  return PIPELINE_PLIST_PATH;
}

function bindPipelineStateRoot(): void {
  if (!existsSync(PIPELINE_PLIST_PATH)) {
    throw new Error(pipelinePlistMissingMessage(PIPELINE_PLIST_PATH));
  }
  const plistBuddy = "/usr/libexec/PlistBuddy";
  try {
    execFileSync(plistBuddy, [
      "-c",
      `Set :EnvironmentVariables:SAYDO_HOME ${SAYDO_HOME}`,
      PIPELINE_PLIST_PATH
    ]);
    return;
  } catch {
    // 存量 plist 可能只有 PATH，也可能完全没有 EnvironmentVariables。
  }
  try {
    execFileSync(plistBuddy, ["-c", "Add :EnvironmentVariables dict", PIPELINE_PLIST_PATH]);
  } catch {
    // dict 已存在时继续添加叶子键。
  }
  execFileSync(plistBuddy, [
    "-c",
    `Add :EnvironmentVariables:SAYDO_HOME string ${SAYDO_HOME}`,
    PIPELINE_PLIST_PATH
  ]);
}

function isLoaded(): boolean {
  return launchctl(["print", serviceTarget()]).ok;
}

function healthProbe(): Promise<string> {
  const port = Number(process.env["SAYDO_DAEMON_PORT"] ?? 47100);
  return fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(2000) })
    .then((r) => r.json() as Promise<{ ok?: boolean; ts?: string }>)
    .then((j) => (j.ok ? `[ok] /health 应答正常(${j.ts ?? ""})` : "[warn] /health 应答异常"))
    .catch(() => "[warn] /health 不可达(daemon 未在跑或端口不同)");
}

function cmdInstall(opts: { withoutPipeline: boolean }): void {
  ensureManagedWorkspaceRoot();
  const pipelinePlistExists = existsSync(PIPELINE_PLIST_PATH);
  const pipelineLoaded = launchctl(["print", pipelineServiceTarget()]).ok;
  const pipelineDirExists = isExistingDirectory(join(DEV_ROOT, "pipeline"));
  const uvBin = !pipelinePlistExists && !opts.withoutPipeline ? resolveUvBin() : null;
  const plan = planInstall({
    pipelinePlistExists,
    pipelineLoaded,
    withoutPipeline: opts.withoutPipeline,
    uvBin,
    pipelineDirExists
  });
  if (plan.exitCode !== 0) {
    console.error(plan.reason ?? "[fail] install 规划失败");
    process.exitCode = 1;
    return;
  }
  if (plan.reason) console.log(plan.reason);
  if (plan.writeUvBin) {
    const pipelinePlist = writePipelinePlist(plan.writeUvBin);
    console.log(`[ok] pipeline plist 已写入 ${pipelinePlist}`);
  }
  const p = writePlist();
  if (plan.bindPipeline) bindPipelineStateRoot();
  console.log(`[ok] plist 已写入 ${p}`);
  if (isLoaded()) {
    // 幂等重装:先卸再装(plist 内容可能已更新)
    launchctl(["bootout", serviceTarget()]);
  }
  const r = bootstrapWithRetry(p);
  if (!r.ok) {
    console.error(`[fail] launchctl bootstrap 失败:${r.out}`);
    process.exitCode = 1;
    return;
  }
  console.log(`[ok] 已装载 ${serviceTarget()}(RunAtLoad 即起;崩溃自启;重登录自起)`);
  if (plan.pipelineAction === "bootstrap") {
    if (launchctl(["print", pipelineServiceTarget()]).ok) {
      launchctl(["bootout", pipelineServiceTarget()]);
    }
    const pipelineResult = bootstrapWithRetry(PIPELINE_PLIST_PATH);
    if (!pipelineResult.ok) {
      console.error(`[fail] pipeline bootstrap 失败:${pipelineResult.out}`);
      console.error("[warn] daemon 已装载,未回滚;可稍后 just daemon install 重试 pipeline");
      process.exitCode = 1;
      return;
    }
    console.log(`[ok] 已装载 ${pipelineServiceTarget()}(RunAtLoad 即起;崩溃自启;重登录自起)`);
    return;
  }
  if (plan.pipelineAction === "reload") {
    launchctl(["bootout", pipelineServiceTarget()]);
    const pipelineResult = bootstrapWithRetry(PIPELINE_PLIST_PATH);
    if (!pipelineResult.ok) {
      console.error(`[fail] pipeline 重载 SAYDO_HOME 失败:${pipelineResult.out}`);
      process.exitCode = 1;
      return;
    }
    console.log("[ok] pipeline 已重载同一 SAYDO_HOME");
  }
}

function cmdUninstall(): void {
  if (isLoaded()) {
    const r = launchctl(["bootout", serviceTarget()]);
    console.log(r.ok ? "[ok] 已停止并卸载服务" : `[warn] bootout:${r.out}`);
  } else {
    console.log("[ok] 服务未装载,无需 bootout");
  }
  if (existsSync(PLIST_PATH)) {
    rmSync(PLIST_PATH);
    console.log(`[ok] 已删除 ${PLIST_PATH}`);
  } else {
    console.log("[ok] plist 不存在,无需删除");
  }
  const pipelineLoaded = launchctl(["print", pipelineServiceTarget()]).ok;
  if (pipelineLoaded) {
    const r = launchctl(["bootout", pipelineServiceTarget()]);
    if (!r.ok) {
      console.error(`[warn] pipeline bootout:${r.out}`);
      process.exitCode = 1;
      return;
    }
    console.log("[ok] 已停止并卸载 pipeline");
  } else {
    console.log("[ok] pipeline 未装载,无需 bootout");
  }
  if (existsSync(PIPELINE_PLIST_PATH)) {
    rmSync(PIPELINE_PLIST_PATH);
    console.log(`[ok] 已删除 ${PIPELINE_PLIST_PATH}`);
  } else {
    console.log("[ok] pipeline plist 不存在,无需删除");
  }
}

function cmdStart(): void {
  if (!existsSync(PLIST_PATH)) {
    console.error(`[fail] plist 不存在(${PLIST_PATH});先跑 install(系统级变更,需 owner 检查点)`);
    process.exitCode = 1;
    return;
  }
  if (isLoaded()) {
    const r = launchctl(["kickstart", serviceTarget()]);
    console.log(r.ok ? "[ok] 服务已装载,kickstart 触发启动" : `[warn] kickstart:${r.out}`);
    return;
  }
  const r = bootstrapWithRetry(PLIST_PATH);
  console.log(r.ok ? "[ok] 已装载并启动" : `[fail] bootstrap 失败:${r.out}`);
  if (!r.ok) process.exitCode = 1;
}

function cmdStop(): void {
  if (!isLoaded()) {
    console.log("[ok] 服务未装载(已是停止态)");
  } else {
    const r = launchctl(["bootout", serviceTarget()]);
    console.log(r.ok ? "[ok] 已停止(本次登录会话内不再自启;plist 保留,重登录仍自起——彻底移除用 uninstall)" : `[fail] bootout 失败:${r.out}`);
    if (!r.ok) process.exitCode = 1;
  }
  if (launchctl(["print", pipelineServiceTarget()]).ok) {
    console.log("[warn] pipeline 仍在装载;要停语音管线请 uninstall");
  }
}

function cmdRestart(): void {
  if (!isLoaded()) {
    cmdStart();
    return;
  }
  const r = launchctl(["kickstart", "-k", serviceTarget()]);
  console.log(r.ok ? "[ok] 已重启(kickstart -k)" : `[fail] kickstart 失败:${r.out}`);
  if (!r.ok) process.exitCode = 1;
}

async function cmdStatus(): Promise<void> {
  console.log(`plist:${existsSync(PLIST_PATH) ? PLIST_PATH : "(未安装)"}`);
  const pr = launchctl(["print", serviceTarget()]);
  if (!pr.ok) {
    console.log("launchd:未装载");
  } else {
    const pid = /pid = (\d+)/.exec(pr.out)?.[1];
    const state = /state = (\w+)/.exec(pr.out)?.[1];
    console.log(`launchd:已装载 state=${state ?? "?"} pid=${pid ?? "(未在跑)"}`);
  }
  console.log(`pipeline plist:${existsSync(PIPELINE_PLIST_PATH) ? PIPELINE_PLIST_PATH : "(未安装)"}`);
  const ppr = launchctl(["print", pipelineServiceTarget()]);
  if (!ppr.ok) {
    console.log("pipeline launchd:未装载");
  } else {
    const pid = /pid = (\d+)/.exec(ppr.out)?.[1];
    const state = /state = (\w+)/.exec(ppr.out)?.[1];
    console.log(`pipeline launchd:已装载 state=${state ?? "?"} pid=${pid ?? "(未在跑)"}`);
  }
  console.log(await healthProbe());
}

/**
 * C2 · deploy:常驻 daemon 切到 ~/.saydo/runtime 独立树的锁定 SHA(缺省 = 开发树 HEAD)。
 * 流程:clone/fetch -> detach checkout -> pnpm install --frozen-lockfile -> console build ->
 * plist 指 runtime 树 -> bootstrap/kickstart。会重启 daemon 与 pipeline(打断在场语音会话)——
 * 批收口后、知会 owner 后执行;dogfood 时段不 deploy(HANDOFF §4 惯例)。
 */
function switchRuntimeToPreparedRelease(targetDir: string, git: (args: string[], cwd?: string) => string): void {
  mkdirSync(RELEASES_DIR, { recursive: true });
  const nextLink = join(SAYDO_HOME, `.runtime-next-${process.pid}`);
  rmSync(nextLink, { force: true });
  symlinkSync(targetDir, nextLink, "dir");
  let legacyDir: string | undefined;
  try {
    if (existsSync(RUNTIME_DIR) && !lstatSync(RUNTIME_DIR).isSymbolicLink()) {
      const currentSha = git(["rev-parse", "HEAD"], RUNTIME_DIR);
      legacyDir = join(RELEASES_DIR, `${currentSha}-legacy-${Date.now()}`);
      renameSync(RUNTIME_DIR, legacyDir);
    }
    renameSync(nextLink, RUNTIME_DIR);
  } catch (error) {
    if (legacyDir && !existsSync(RUNTIME_DIR) && existsSync(legacyDir)) {
      renameSync(legacyDir, RUNTIME_DIR);
    }
    rmSync(nextLink, { force: true });
    throw error;
  }
}

async function waitRuntimeReady(expectedSha: string): Promise<boolean> {
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      const response = await fetch("http://127.0.0.1:47100/readyz", {
        signal: AbortSignal.timeout(1000)
      });
      const ready = (await response.json()) as {
        ok?: boolean;
        daemonRuntimeSha?: string;
        pipelineRuntimeSha?: string;
        asr?: string;
        tts?: string;
      };
      if (
        response.ok &&
        ready.ok === true &&
        ready.daemonRuntimeSha === expectedSha &&
        ready.pipelineRuntimeSha === expectedSha &&
        ready.asr === "ok" &&
        ready.tts === "ok"
      ) {
        return true;
      }
    } catch {
      // 两个 launchd job 启动存在短窗口，继续轮询。
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  return false;
}

async function cmdDeploy(shaArg?: string): Promise<void> {
  ensureManagedWorkspaceRoot();
  if (!existsSync(PIPELINE_PLIST_PATH)) {
    throw new Error(pipelinePlistMissingMessage(PIPELINE_PLIST_PATH));
  }
  const git = (args: string[], cwd = DEV_ROOT): string =>
    execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const sha = shaArg ? git(["rev-parse", shaArg]) : git(["rev-parse", "HEAD"]);
  const releaseDir = join(RELEASES_DIR, sha);
  console.log(`[ok] 目标 SHA:${sha}`);
  mkdirSync(RELEASES_DIR, { recursive: true });
  if (!existsSync(join(releaseDir, ".git"))) {
    execFileSync("git", ["clone", "--no-checkout", DEV_ROOT, releaseDir], { stdio: "inherit" });
  }
  git(["fetch", DEV_ROOT, sha], releaseDir);
  git(["checkout", "--detach", sha], releaseDir);
  console.log("[ok] 独立 release 树已就位,装依赖与构建 console(现役 runtime 尚未切换)");
  execFileSync("pnpm", ["install", "--frozen-lockfile"], { cwd: releaseDir, stdio: "inherit" });
  execFileSync("pnpm", ["--filter", "@saydo/console", "build"], { cwd: releaseDir, stdio: "inherit" });
  const pipelineUv = execFileSync(
    "/usr/libexec/PlistBuddy",
    ["-c", "Print :ProgramArguments:0", PIPELINE_PLIST_PATH],
    { encoding: "utf8" }
  ).trim();
  execFileSync(pipelineUv, ["sync", "--frozen"], {
    cwd: join(releaseDir, "pipeline"),
    stdio: "inherit"
  });
  if (git(["status", "--porcelain=v1"], releaseDir) !== "") {
    throw new Error(`release 树构建后不 clean:${releaseDir}`);
  }
  switchRuntimeToPreparedRelease(releaseDir, git);
  execFileSync("/usr/libexec/PlistBuddy", [
    "-c",
    `Set :WorkingDirectory ${join(RUNTIME_DIR, "pipeline")}`,
    PIPELINE_PLIST_PATH
  ]);
  bindPipelineStateRoot();
  const p = writePlist(RUNTIME_DIR);
  console.log(`[ok] plist 已指向 runtime 树(${p})`);
  if (isLoaded()) {
    launchctl(["bootout", serviceTarget()]);
  }
  const r = bootstrapWithRetry(p);
  if (!r.ok) {
    console.error(`[fail] launchctl bootstrap 失败:${r.out}`);
    process.exitCode = 1;
    return;
  }
  if (launchctl(["print", pipelineServiceTarget()]).ok) {
    launchctl(["bootout", pipelineServiceTarget()]);
  }
  const pipelineBootstrap = bootstrapWithRetry(PIPELINE_PLIST_PATH);
  if (!pipelineBootstrap.ok) {
    console.error(`[fail] pipeline bootstrap 失败:${pipelineBootstrap.out}`);
    process.exitCode = 1;
    return;
  }
  if (!(await waitRuntimeReady(sha))) {
    console.error(`[fail] daemon/pipeline 未在时限内以同一 SHA ready:${sha}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `[ok] 常驻 daemon 与 pipeline 已切到 runtime@${sha.slice(0, 7)}，loaded SHA 与 readyz 已对账`
  );
}

function cmdLogs(): void {
  const logsDir = join(SAYDO_HOME, "logs");
  if (!existsSync(SAYDO_HOME)) {
    console.log(`[warn] 日志目录不存在:${logsDir}`);
    return;
  }
  validateStateRoot(SAYDO_HOME);
  if (!existsSync(logsDir)) {
    console.log(`[warn] 日志目录不存在:${logsDir}`);
    return;
  }
  const files = readdirSync(logsDir)
    .filter((f) => f.endsWith(".log"))
    .map((f) => ({ f, m: statSync(join(logsDir, f)).mtimeMs }))
    .sort((a, b) => b.m - a.m);
  console.log(`日志目录:${logsDir}`);
  const latest = files[0];
  if (!latest) {
    console.log("(无日志文件)");
    return;
  }
  const tail = readFileSync(join(logsDir, latest.f), "utf8").split("\n").filter(Boolean).slice(-20);
  console.log(`最新:${latest.f}(尾 ${tail.length} 行)`);
  for (const line of tail) console.log(line);
}

function printUsage(): void {
  console.log(
    "用法:saydo daemon <install [--without-pipeline]|uninstall|start|stop|restart|status|logs|deploy [sha]>"
  );
  console.log("install 属系统级变更(写 ~/Library/LaunchAgents + launchctl bootstrap),先过 owner 检查点。");
  console.log(
    "install --without-pipeline = 只装 daemon;桌面浏览器云端语音不可用(系统语音与 iPhone 原生语音仍可);已有 pipeline plist 时本旗标不拆除。"
  );
  console.log("deploy = 常驻切 ~/.saydo/runtime 独立树锁定 SHA(会重启 daemon 与 pipeline;dogfood 时段不要跑)。");
}

function parseInstallArgs(args: string[]): { withoutPipeline: boolean } | "usage" {
  let withoutPipeline = false;
  for (const a of args) {
    if (a === "--without-pipeline") withoutPipeline = true;
    else return "usage";
  }
  return { withoutPipeline };
}

const cmd = process.argv[2];
const rest = process.argv.slice(3);
switch (cmd) {
  case "install": {
    const parsed = parseInstallArgs(rest);
    if (parsed === "usage") {
      printUsage();
      process.exitCode = 1;
      break;
    }
    cmdInstall(parsed);
    break;
  }
  case "uninstall":
    cmdUninstall();
    break;
  case "start":
    cmdStart();
    break;
  case "stop":
    cmdStop();
    break;
  case "restart":
    cmdRestart();
    break;
  case "status":
    await cmdStatus();
    break;
  case "logs":
    cmdLogs();
    break;
  case "deploy":
    await cmdDeploy(process.argv[3]);
    break;
  default:
    printUsage();
    process.exitCode = cmd === undefined ? 0 : 1;
}
