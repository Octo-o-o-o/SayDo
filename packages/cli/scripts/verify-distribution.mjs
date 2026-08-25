import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { createConnection } from "node:net";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, delimiter } from "node:path";
import { fileURLToPath } from "node:url";
import { killOwnedTree, nativeSync, processAlive as nativeProcessAlive, processBirth } from "../../platform/dist/index.mjs";

if (process.platform === "win32") nativeSync();

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "..", "..");
function repoRootHint() {
  return repoRoot;
}
const scratch = mkdtempSync(join(realpathSync(tmpdir()), "saydo-distribution-"));
const installRoot = join(scratch, "install");
const stateRoot = join(scratch, "state");
const otherRoot = join(scratch, "other-state");
const recoveryRoot = join(scratch, "recovery-state");
const npmCache = join(scratch, "npm-cache");
const defaultUserHome = join(scratch, "default-user");
function resolveGitDir() {
  const cmd = process.platform === "win32" ? "where" : "which";
  const r = spawnSync(cmd, ["git"], { encoding: "utf8" });
  const line = (r.stdout ?? "").split(/\r?\n/).map((s) => s.trim()).find(Boolean);
  if (!line) throw new Error("git not found on PATH");
  return dirname(line);
}
const gitDir = resolveGitDir();
const fixtureBin = join(scratch, "fixture-bin");
const winSysRoot = process.env["SystemRoot"] ?? "C:\\Windows";
const nodeOnlyEnv = {
  PATH: [
    fixtureBin,
    dirname(process.execPath),
    gitDir,
    ...(process.platform === "win32" ? [join(winSysRoot, "System32")] : [])
  ].join(delimiter),
  LANG: process.env["LANG"] ?? "C.UTF-8",
  HOME: defaultUserHome,
  ...(process.platform === "win32"
    ? {
        USERPROFILE: defaultUserHome,
        HOMEDRIVE: defaultUserHome.slice(0, 2),
        HOMEPATH: defaultUserHome.slice(2) || "\\",
        PATHEXT: process.env["PATHEXT"] ?? ".COM;.EXE;.BAT;.CMD",
        SystemRoot: winSysRoot,
        windir: process.env["windir"] ?? winSysRoot,
        ComSpec: process.env["ComSpec"] ?? join(winSysRoot, "System32", "cmd.exe"),
        TEMP: scratch,
        TMP: scratch,
        LOCALAPPDATA: join(defaultUserHome, "AppData", "Local"),
        APPDATA: join(defaultUserHome, "AppData", "Roaming")
      }
    : {})
};
const activeChildren = new Set();
const closedChildren = new WeakSet();
const activeServers = new Set();
const openDatabases = new Set();
const observedPids = new Map();
const ownedHomes = new Set();
let resultSummary;

function invariant(value, message) {
  if (!value) throw new Error(message);
}

function jcsSerialize(value) {
  if (value === null) return "null";
  if (typeof value === "boolean") return String(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("JCS: non-finite number not allowed");
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => jcsSerialize(item === undefined ? null : item)).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${jcsSerialize(value[key])}`)
      .join(",")}}`;
  }
  throw new Error(`JCS: unsupported type ${typeof value}`);
}

function jcsDigest(value) {
  return `sha256:${createHash("sha256").update(jcsSerialize(value), "utf8").digest("hex")}`;
}

async function freePort() {
  const server = createServer();
  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const port = server.address().port;
  await new Promise((resolveClose) => server.close(resolveClose));
  return port;
}

async function portAvailable(port) {
  const listening = await new Promise((resolveListening) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    const done = (value) => {
      socket.removeAllListeners();
      socket.destroy();
      resolveListening(value);
    };
    socket.setTimeout(500, () => done(false));
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
  });
  if (listening) return false;
  const server = createServer();
  try {
    await new Promise((resolveListen, rejectListen) => {
      server.once("error", rejectListen);
      server.listen(port, "127.0.0.1", resolveListen);
    });
    await new Promise((resolveClose) => server.close(resolveClose));
    return true;
  } catch (err) {
    if (err?.code === "EADDRINUSE") return false;
    throw err;
  }
}

function resolveNpm() {
  if (process.platform !== "win32") return { file: "npm", prefix: [], options: {} };
  const bundled = join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
  if (existsSync(bundled)) {
    return { file: process.execPath, prefix: [bundled], options: {} };
  }
  throw new Error(`npm-cli.js 未找到:${bundled}`);
}

function packAndInstall() {
  const npm = resolveNpm();
  const raw = execFileSync(
    npm.file,
    [...npm.prefix, "pack", "--ignore-scripts", "--json", "--pack-destination", scratch],
    { cwd: packageRoot, encoding: "utf8", env: { ...process.env, npm_config_cache: npmCache }, ...npm.options }
  );
  const packed = JSON.parse(raw)[0];
  invariant(packed?.filename, "npm pack 未返回 tarball");
  const paths = packed.files.map((file) => file.path);
  const packageDocs = new Set(["LICENSE", "NOTICE", "README.md", "THIRD_PARTY_NOTICES.md", "package.json"]);
  invariant(
    paths.every((path) => packageDocs.has(path) || path.startsWith("dist/")),
    "tarball 含运行产物与包文档之外的文件"
  );
  for (const path of packageDocs) invariant(paths.includes(path), `tarball 缺 ${path}`);
  invariant(paths.includes("dist/runtime/daemon.mjs"), "tarball 缺 daemon artifact");
  invariant(paths.includes("dist/console/index.html"), "tarball 缺 console dist");
  execFileSync(npm.file, [...npm.prefix, "install", "--prefix", installRoot, join(scratch, packed.filename)], {
    cwd: scratch,
    stdio: "inherit",
    env: { ...process.env, npm_config_cache: npmCache },
    ...npm.options
  });
  if (process.platform === "win32") {
    invariant(
      existsSync(join(installRoot, "node_modules", ".bin", "saydo.cmd")),
      "Windows 安装缺 saydo.cmd shim"
    );
  }
  return { filename: packed.filename, entryCount: packed.entryCount };
}

function windowsCmdQuote(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function writeWindowsNpmNodeShim(dir, name, source) {
  invariant(/^[a-z][a-z0-9-]*$/u.test(name), `Windows fixture shim 名非法:${name}`);
  writeFileSync(join(dir, `${name}.mjs`), source);
  writeFileSync(
    join(dir, `${name}.cmd`),
    `@ECHO off\r\nGOTO start\r\n:find_dp0\r\nSET dp0=%~dp0\r\nEXIT /b\r\n:start\r\nSETLOCAL\r\nCALL :find_dp0\r\n\r\nIF EXIST "%dp0%\\node.exe" (\r\n  SET "_prog=%dp0%\\node.exe"\r\n) ELSE (\r\n  SET "_prog=node"\r\n)\r\n\r\nendLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & set PATHEXT=%PATHEXT:;.JS;=;% & "%_prog%"  "%dp0%\\${name}.mjs" %*\r\n`
  );
}

/** POSIX 用 `exec <execPath>` 的 node shim；Windows 标准 npm cmd-shim 优先 `%dp0%\\node.exe`。 */
function ensureIsolatedNode(dir) {
  if (process.platform === "win32") {
    const dest = join(dir, "node.exe");
    if (!existsSync(dest)) copyFileSync(process.execPath, dest);
    return;
  }
  const nodeShim = join(dir, "node");
  writeFileSync(nodeShim, `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} "$@"\n`);
  chmodSync(nodeShim, 0o755);
}

function cliInvocation(args) {
  if (process.platform === "win32") {
    const shim = join(installRoot, "node_modules", ".bin", "saydo.cmd");
    const command = `"${[shim, ...args].map(windowsCmdQuote).join(" ")}"`;
    return {
      file: nodeOnlyEnv.ComSpec,
      args: ["/d", "/s", "/c", command],
      options: { windowsVerbatimArguments: true }
    };
  }
  return { file: join(installRoot, "node_modules", ".bin", "saydo"), args };
}

function spawnCli(args, options) {
  const cli = cliInvocation(args);
  return spawn(cli.file, cli.args, { windowsHide: true, ...cli.options, ...options });
}

function trackChild(child) {
  activeChildren.add(child);
  child.once("close", () => {
    closedChildren.add(child);
    activeChildren.delete(child);
  });
  return child;
}

function cliSync(args, env = nodeOnlyEnv) {
  const cli = cliInvocation(args);
  return spawnSync(cli.file, cli.args, {
    cwd: installRoot,
    env,
    encoding: "utf8",
    windowsHide: true,
    ...cli.options
  });
}

function resolvedHome(home) {
  return home === null ? join(defaultUserHome, ".saydo") : home;
}

function cliStopFile(home, pid) {
  return join(home, "runtime", `cli-stop-${String(pid)}`);
}

function requestGracefulStop(child, home, supervisorPid) {
  if (process.platform === "win32") {
    invariant(Number.isInteger(supervisorPid) && supervisorPid > 0, "supervisor pid 缺失,无法写 stop 文件");
    mkdirSync(join(home, "runtime"), { recursive: true });
    writeFileSync(cliStopFile(home, supervisorPid), "cli_sigint\n");
    return;
  }
  child.kill("SIGINT");
}

function supervisorPidFromOutput(output) {
  const line = output.split("\n").find((item) => item.startsWith('{"mode":"'));
  return line ? JSON.parse(line).supervisorPid : undefined;
}

function start(port, home = stateRoot, env = nodeOnlyEnv, explicitPort = true, label = "unnamed") {
  const homeArgs = home === null ? [] : ["--home", home];
  const portArgs = explicitPort ? ["--port", String(port)] : [];
  const actualHome = resolvedHome(home);
  ownedHomes.add(actualHome);
  const child = spawnCli(
    ["up", ...homeArgs, ...portArgs, "--no-open"],
    { cwd: installRoot, env, stdio: ["ignore", "pipe", "pipe"], detached: process.platform !== "win32" }
  );
  trackChild(child);
  let output = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  return new Promise((resolveReady, rejectReady) => {
    const timer = setTimeout(
      () => rejectReady(new Error(`${label}:daemon ready 超时:\n${output.slice(-2000)}`)),
      process.platform === "win32" ? 30_000 : 15_000
    );
    const inspect = (chunk) => {
      for (const line of String(chunk).split("\n")) {
        if (!line.startsWith('{"mode":"owned"')) continue;
        clearTimeout(timer);
        child.stdout.off("data", inspect);
        const ready = JSON.parse(line);
        rememberPid(ready.pid, "daemon");
        resolveReady({ child, ready, output: () => output, home: actualHome });
      }
    };
    child.stdout.on("data", inspect);
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      rejectReady(new Error(`${label}:daemon ready 前退出 code=${code} signal=${signal}:\n${output.slice(-2000)}`));
    });
  });
}

function startContender(port, home) {
  ownedHomes.add(home);
  const child = spawnCli(
    ["up", "--home", home, "--port", String(port), "--no-open"],
    { cwd: installRoot, env: nodeOnlyEnv, stdio: ["ignore", "pipe", "pipe"], detached: process.platform !== "win32" }
  );
  trackChild(child);
  let output = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  const outcome = new Promise((resolveOutcome, rejectOutcome) => {
    const timer = setTimeout(() => rejectOutcome(new Error(`concurrent up 超时:${output.slice(-1200)}`)), 20_000);
    const inspect = () => {
      const line = output.split("\n").find((item) => item.startsWith('{"mode":"'));
      if (!line) return;
      clearTimeout(timer);
      resolveOutcome({ kind: "mode", frame: JSON.parse(line) });
    };
    child.stdout.on("data", inspect);
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      const line = output.split("\n").find((item) => item.startsWith('{"mode":"'));
      if (line) resolveOutcome({ kind: "mode", frame: JSON.parse(line), code, signal });
      else resolveOutcome({ kind: "exit", code, signal, output });
    });
  });
  return { child, home, outcome, output: () => output };
}

async function stopContender(contender) {
  if (contender.child.exitCode !== null || contender.child.signalCode !== null) return;
  await new Promise((resolveWait) => setTimeout(resolveWait, 200));
  if (contender.child.exitCode !== null || contender.child.signalCode !== null) return;
  requestGracefulStop(contender.child, contender.home, supervisorPidFromOutput(contender.output()));
  const ended = await waitForExit(contender.child, 30_000, "concurrent contender");
  invariant(
    ended.code === 0 && ended.signal === null,
    `concurrent contender 非优雅退出 code=${String(ended.code)} signal=${String(ended.signal)}:${contender.output().slice(-1000)}`
  );
}

async function waitForExit(child, timeoutMs, label) {
  if (child.exitCode !== null || child.signalCode !== null) return { code: child.exitCode, signal: child.signalCode };
  return new Promise((resolveExit, rejectExit) => {
    const timer = setTimeout(() => rejectExit(new Error(`${label} 退出超时`)), timeoutMs);
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      resolveExit({ code, signal });
    });
  });
}

async function waitForClose(child, timeoutMs, label) {
  if (closedChildren.has(child)) return;
  await new Promise((resolveClose, rejectClose) => {
    const timer = setTimeout(() => {
      child.off("close", onClose);
      rejectClose(new Error(`${label} close 超时`));
    }, timeoutMs);
    const onClose = () => {
      clearTimeout(timer);
      resolveClose();
    };
    child.once("close", onClose);
  });
}

function closeChildStdio(child) {
  for (const stream of child.stdio ?? []) stream?.destroy?.();
}

async function stop(owned) {
  requestGracefulStop(owned.child, owned.home, owned.ready.supervisorPid);
  const { code, signal } = await waitForExit(owned.child, process.platform === "win32" ? 30_000 : 15_000, `Ctrl+C 停止:\n${owned.output().slice(-2000)}`);
  invariant(code === 0 && signal === null, `CLI 非优雅退出 code=${code} signal=${signal}`);
  const daemonPid = owned.ready.pid;
  try {
    process.kill(daemonPid, 0);
    throw new Error(`daemon 孤儿仍存活:${daemonPid}`);
  } catch (err) {
    if (err?.code !== "ESRCH") throw err;
  }
}

function processAlive(pid) {
  return nativeProcessAlive(pid);
}

function processGroupAlive(pid) {
  if (process.platform === "win32") return processAlive(pid);
  try {
    process.kill(-pid, 0);
    return true;
  } catch (err) {
    if (err?.code === "ESRCH") return false;
    if (err?.code === "EPERM") return true;
    throw err;
  }
}

function processStart(pid) {
  return processBirth(pid);
}

function rememberPid(pid, label) {
  if (!processAlive(pid)) return;
  const start = processStart(pid);
  if (start === null && !processAlive(pid)) return;
  invariant(start !== null, `${label} PID 无 birth identity:${pid}`);
  observedPids.set(pid, { start, label });
}

async function cleanupOwnedRegistry(home, allowKill) {
  const records = [];
  const runsRoot = join(home, "tier1", "runs");
  for (const entry of existsSync(runsRoot) ? readdirSync(runsRoot, { withFileTypes: true }) : []) {
    if (!entry.isDirectory()) continue;
    const path = join(runsRoot, entry.name, "agent-owner.json");
    if (existsSync(path)) records.push(JSON.parse(readFileSync(path, "utf8")));
  }
  const childrenRoot = join(home, "runtime", "children");
  for (const entry of existsSync(childrenRoot) ? readdirSync(childrenRoot, { withFileTypes: true }) : []) {
    if (entry.isFile() && entry.name.endsWith(".json")) {
      records.push(JSON.parse(readFileSync(join(childrenRoot, entry.name), "utf8")));
    }
  }
  for (const record of records) {
    invariant(Number.isInteger(record.pid) && record.pid > 1, "cleanup ownership PID 非法");
    if (!allowKill) {
      throw new Error(`graceful shutdown 遗留 ownership record:${record.pid}`);
    }
    if (!processGroupAlive(record.pid)) continue;
    invariant(typeof record.processStart === "string" && record.processStart !== "", `cleanup ownership pending:${record.pid}`);
    const observedStart = processStart(record.pid);
    if (observedStart === null) {
      invariant(!processAlive(record.pid), `cleanup ownership identity unverified:${record.pid}`);
    } else {
      invariant(observedStart === record.processStart, `cleanup ownership identity mismatch:${record.pid}`);
    }
    try {
      if (process.platform === "win32") {
        if (record.jobName) {
          await killOwnedTree({ pid: record.pid, expectedBirth: record.processStart, jobName: record.jobName });
        } else {
          process.kill(record.pid, "SIGKILL");
        }
      } else {
        process.kill(-record.pid, "SIGKILL");
      }
    } catch (err) { if (err?.code !== "ESRCH") throw err; }
    await waitUntil(() => !processGroupAlive(record.pid), `distribution registry group=${record.pid}`, 8_000);
  }
}

async function waitUntil(check, label, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = check();
      if (value) return value;
    } catch (err) {
      lastError = err;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`${label} 超时${lastError ? `:${String(lastError)}` : ""}`);
}

async function assertPidGone(pid, label) {
  await waitUntil(() => !processAlive(pid), `${label} pid=${pid}`, 8_000);
}

async function attachAndRelease(port, expectedPid) {
  const child = spawnCli(
    ["up", "--home", stateRoot, "--port", String(port), "--no-open"],
    { cwd: installRoot, env: nodeOnlyEnv, stdio: ["ignore", "pipe", "pipe"] }
  );
  trackChild(child);
  let output = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  let attachedSupervisorPid;
  await waitUntil(() => {
    const line = output.split("\n").find((item) => item.startsWith('{"mode":"attached"'));
    if (!line) return false;
    const frame = JSON.parse(line);
    attachedSupervisorPid = frame.supervisorPid;
    return frame.pid === expectedPid;
  }, "attached up ready");
  await new Promise((resolveWait) => setTimeout(resolveWait, 200));
  requestGracefulStop(child, stateRoot, attachedSupervisorPid);
  const ended = await waitForExit(child, process.platform === "win32" ? 15_000 : 5_000, "attached CLI");
  invariant(
    ended.code === 0 && ended.signal === null,
    `attached CLI Ctrl+C 非零退出 code=${String(ended.code)} signal=${String(ended.signal)} output=${output.slice(-500)}`
  );
  invariant(processAlive(expectedPid), "attached CLI 错杀外部 daemon");
}

function prepareTier1Fixture() {
  mkdirSync(fixtureBin, { recursive: true });
  ensureIsolatedNode(fixtureBin);
  if (process.platform === "win32") {
    writeWindowsNpmNodeShim(fixtureBin, "pnpm", "process.exit(0);\n");
  } else {
    const pnpmFixture = join(fixtureBin, "pnpm");
    writeFileSync(pnpmFixture, "#!/bin/sh\nexec node -e 'process.exit(0)'\n");
    chmodSync(pnpmFixture, 0o755);
  }
  const versionDir = join(scratch, "agent", "versions", "1.0.0");
  mkdirSync(versionDir, { recursive: true });
  const agent = join(versionDir, "cursor-agent");
  writeFileSync(
    agent,
    `#!/usr/bin/env node
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
if (process.argv.includes("--version")) { process.stdout.write("1.0.0\\n"); process.exit(0); }
const resumeIdx = process.argv.indexOf("--resume");
const resumed = resumeIdx >= 0;
const resumeId = resumed ? process.argv[resumeIdx + 1] : null;
// B7: fixture 校验精确 resume ID，不得对任意 --resume 都放行。
if (resumed && resumeId !== "chat-d1-distribution") {
  process.stdout.write(JSON.stringify({ type: "result", subtype: "error", result: "bad resume id:" + String(resumeId) }) + "\\n");
  process.exit(1);
}
writeFileSync(join(process.cwd(), resumed ? "agent-resumed.pid" : "agent-parent.pid"), String(process.pid));
process.stdout.write(JSON.stringify({ type: "system", subtype: "init", model: "fable-5-max", session_id: "chat-d1-distribution" }) + "\\n");
if (resumed) {
  process.stdout.write(JSON.stringify({ type: "result", subtype: "success", result: "resumed and settled" }) + "\\n");
  setInterval(() => {}, 1000);
} else {
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });
  writeFileSync(join(process.cwd(), "agent-child.pid"), String(child.pid));
  setInterval(() => {}, 1000);
}
`
  );
  chmodSync(agent, 0o755);
  const repo = join(defaultUserHome, "tier1-repo");
  mkdirSync(join(repo, ".saydo"), { recursive: true });
  writeFileSync(join(repo, "package.json"), JSON.stringify({ scripts: { test: "node -e \"process.exit(0)\"" } }));
  writeFileSync(join(repo, "README.md"), "D1 Tier1 lifecycle fixture\n");
  writeFileSync(
    join(repo, ".saydo", "project.toml"),
    '[[verify.entries]]\nname = "test"\nsource = "package_script"\nref = "test"\n'
  );
  execFileSync("git", ["init", "-q", "--initial-branch=main"], { cwd: repo });
  execFileSync("git", ["config", "user.email", "d1@saydo.local"], { cwd: repo });
  execFileSync("git", ["config", "user.name", "D1"], { cwd: repo });
  execFileSync("git", ["add", "-A"], { cwd: repo });
  execFileSync("git", ["commit", "-qm", "fixture"], { cwd: repo });
  writeFileSync(
    join(stateRoot, "config.toml"),
    `[models]\ndialog="claude-sonnet-5"\nthinking="claude-opus-5"\ncheap="claude-haiku-5"\nevaluator="gpt-5.6-sol"\n[models.dev]\nagent="cursor"\nmodel="fable-5-max"\n[tier1]\ncursor_agent_bin=${JSON.stringify(agent)}\ncursor_agent_pinned_version="1.0.0"\n`
  );
  return { repo };
}

function packedDep(name) {
  const hoisted = join(installRoot, "node_modules", name);
  const nested = join(installRoot, "node_modules", "@saydo", "cli", "node_modules", name);
  if (existsSync(hoisted)) return hoisted;
  if (existsSync(nested)) return nested;
  throw new Error(`packed ${name} missing`);
}

function assertPackedNativeAddon(dbPath) {
  const koffiPath = packedDep("koffi");
  const sqlitePath = packedDep("better-sqlite3");
  const script = `const koffi=require(${JSON.stringify(koffiPath)});if(typeof koffi.load!=="function")process.exit(2);const Database=require(${JSON.stringify(sqlitePath)});const db=new Database(${JSON.stringify(dbPath)});db.prepare("select 1 as x").get();db.close();`;
  const r = spawnSync(process.execPath, ["-e", script], { encoding: "utf8", windowsHide: true });
  invariant(r.status === 0, `installed koffi/better-sqlite3 原生闭包未能加载:${r.stderr || r.stdout}`);
}

function openInstalledDb() {
  // 分发校验进程用工作区 addon 开库。Windows 不能在当前进程加载 scratch 里的 .node 再删目录。
  const requireFromWorkspace = createRequire(join(packageRoot, "package.json"));
  const Database = requireFromWorkspace("better-sqlite3");
  const db = new Database(join(stateRoot, "saydo.db"));
  openDatabases.add(db);
  return db;
}

function seedTier1(db, repo) {
  const now = new Date().toISOString();
  const identity = statSync(repo, { bigint: true });
  const projectId = `prj_01${"A".repeat(24)}`;
  const taskId = `tsk_01${"B".repeat(24)}`;
  const packageId = `pkg_01${"C".repeat(24)}`;
  const packageBody = {
    id: packageId,
    revision: 1,
    projectId,
    outcomePreview: "D1 lifecycle settles after restart",
    inScope: ["restart recovery"],
    outOfScope: [],
    assumptions: [],
    acceptance: ["恢复后进入待验收态"],
    plan: [{ seq: 1, step: "恢复既有原生会话", owner: "ai" }],
    cost: { expected: { known: false }, p95: { known: false }, max: 20, currency: "CNY" },
    risks: [],
    mode: "step_confirm",
    preauthorizedEffects: [],
    effectPolicyVersion: "distribution-fixture-v1"
  };
  const packageDigest = jcsDigest(packageBody);
  db.prepare(
    `INSERT INTO projects(id,title,type,status,workspace_json,canonical_workspace_path,workspace_dev,workspace_ino,exec_mode_default,created_at,updated_at)
     VALUES (?,?,'coding','active',?,?,?,?,'step_confirm',?,?)`
  ).run(
    projectId,
    "D1 lifecycle",
    JSON.stringify({ kind: "local_folder", path: repo, managed: false }),
    repo,
    String(identity.dev),
    String(identity.ino),
    now,
    now
  );
  // 恢复验收必须能从 durable DecisionPackage 逐条重建 AcceptanceCheck；
  // fixture 不能只造 task 外键形状而省略生产 dispatch 的决策包正文。
  db.prepare(
    `INSERT INTO decision_packages(id,revision,digest,project_id,body_json,status,created_at)
     VALUES (?,1,?,?,?,'approved',?)`
  ).run(
    packageId,
    packageDigest,
    projectId,
    JSON.stringify(packageBody),
    now
  );
  db.prepare(
    `INSERT INTO tasks(id,project_id,package_id,package_rev,package_digest,title,spec_markdown,route,status,adapter,budget_json,created_at,updated_at)
     VALUES (?,?,?,1,?,?,?,'tier1','queued','cursor',?,?,?)`
  ).run(
    taskId,
    projectId,
    packageId,
    packageDigest,
    "D1 lifecycle task",
    "# D1 lifecycle task",
    JSON.stringify({ walltimeActiveMin: 45, maxTurns: 80, maxCost: 20 }),
    now,
    now
  );
  return { taskId };
}

async function fetchClose(url) {
  return fetch(url, { keepalive: false, headers: { connection: "close" } });
}

async function json(url, init = {}) {
  const headers = { connection: "close", ...(init.headers ?? {}) };
  const response = await fetch(url, { ...init, headers, keepalive: false });
  const body = await response.json();
  return { response, body };
}

try {
  invariant(Number(process.versions.node.split(".")[0]) === 22, `需要 Node 22,当前 ${process.version}`);
  const packed = packAndInstall();
  mkdirSync(fixtureBin, { recursive: true });
  ensureIsolatedNode(fixtureBin);
  for (const command of ["pnpm", "tsx"]) {
    if (process.platform === "win32") {
      writeFileSync(
        join(fixtureBin, `${command}.cmd`),
        `@echo off\r\necho ${command} must not be used by distribution runtime 1>&2\r\nexit /b 97\r\n`
      );
    } else {
      const sentinel = join(fixtureBin, command);
      writeFileSync(sentinel, `#!/bin/sh\necho '${command} must not be used by distribution runtime' >&2\nexit 97\n`);
      chmodSync(sentinel, 0o755);
    }
  }
  if (process.platform === "win32") {
    writeWindowsNpmNodeShim(
      fixtureBin,
      "codex",
      'if(process.argv.includes("--version")){process.stdout.write("codex-cli 0.0.0-fixture\\n");process.exit(0)}if(process.argv.includes("login")){process.stdout.write("Logged in using ChatGPT\\n");process.exit(0)}process.exit(0)\n'
    );
  } else {
    const codexFixture = join(fixtureBin, "codex");
    writeFileSync(
      codexFixture,
      "#!/bin/sh\nif [ \"$1\" = \"--version\" ]; then echo 'codex-cli 0.0.0-fixture'; exit 0; fi\nif [ \"$1\" = \"login\" ]; then echo 'Logged in using ChatGPT'; exit 0; fi\nexit 0\n"
    );
    chmodSync(codexFixture, 0o755);
  }
  if (process.platform !== "win32") {
    const openFixture = join(fixtureBin, "open");
    writeFileSync(openFixture, "#!/bin/sh\nprintf '%s' \"$1\" > \"$SAYDO_OPEN_MARKER\"\n");
    chmodSync(openFixture, 0o755);
  }
  const openMarker = join(scratch, "open.marker");
  const port = await freePort();
  const owned = await start(port, stateRoot, nodeOnlyEnv, true, "initial");
  const origin = `http://localhost:${port}`;
  const token = readFileSync(join(stateRoot, ".cap-token"), "utf8").trim();
  const health = await json(`${origin}/health`);
  invariant(health.response.ok && health.body.service === "saydo-daemon", "/health 未就绪");
  assertPackedNativeAddon(join(stateRoot, "saydo.db"));
  invariant(
    /^[0-9a-f]{7,64}$/.test(health.body.identity?.sourceRevision ?? "") &&
      typeof health.body.identity?.buildId === "string" && health.body.identity.buildId.length > 0 &&
      /^\d+\.\d+\.\d+$/.test(health.body.identity?.protocolVersion ?? ""),
    "/health 缺 runtime identity 三元组"
  );
  // B7: 独立计算 expected digest/buildId/protocol，不得只检查格式与彼此相等。
  const contractsRuntime = readFileSync(join(packageRoot, "..", "contracts", "src", "runtime.ts"), "utf8");
  const expectedProtocol = /RUNTIME_PROTOCOL_VERSION\s*=\s*"(\d+\.\d+\.\d+)"/.exec(contractsRuntime)?.[1];
  invariant(expectedProtocol, "无法读取 contracts protocolVersion");
  invariant(health.body.identity.protocolVersion === expectedProtocol, "protocolVersion 与 contracts 不符");
  invariant(owned.ready.identity.protocolVersion === expectedProtocol, "ready protocolVersion 与 contracts 不符");
  invariant(health.body.identity.sourceRevision === owned.ready.identity.sourceRevision, "ready/health sourceRevision 不一致");
  invariant(health.body.identity.buildId === owned.ready.identity.buildId, "ready/health buildId 不一致");
  invariant(
    health.body.identity.buildId.includes(health.body.identity.sourceRevision.slice(0, 12)) ||
      health.body.identity.buildId.includes(`.c${health.body.identity.sourceRevision.slice(0, 12)}`),
    "buildId 未绑定 sourceRevision 前缀"
  );
  const daemonBundle = readFileSync(join(installRoot, "node_modules", "@saydo", "cli", "dist", "runtime", "daemon.mjs"), "utf8");
  invariant(!daemonBundle.includes(packageRoot) && !daemonBundle.includes(repoRootHint()), "daemon bundle 含仓库绝对路径");
  invariant(JSON.stringify(owned.ready.identity) === JSON.stringify(health.body.identity), "ready 与 health 身份不一致");
  const readiness = await json(`${origin}/readyz`);
  invariant(
    readiness.response.ok && readiness.body.coreReady === true && readiness.body.voiceReady === false &&
      readiness.body.voice?.reason === "pipeline_absent",
    "pipeline 缺席时 readiness 未正确拆分"
  );
  const index = await fetchClose(`${origin}/`);
  const indexBody = await index.text();
  const assetPaths = [...indexBody.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1]);
  const assetPath = assetPaths[0];
  invariant(index.status === 200 && assetPath, "console index 或 hash asset 引用缺失");
  invariant((await fetchClose(`${origin}${assetPath}`)).status === 200, "console hash asset 非 200");
  const assetBodies = await Promise.all(assetPaths.map(async (path) => (await fetchClose(`${origin}${path}`)).text()));
  invariant(assetBodies.some((body) => body.includes("文本与控制面可用,语音未启用")), "console 未明示文本可用/语音未启用");
  const headers = { "x-saydo-token": token, "content-type": "application/json" };
  const summary = await json(`${origin}/api/desktop/summary`, { headers });
  invariant(summary.response.ok && summary.body.version === 1, "desktop summary v1 受保护探针失败");
  const setupProbe = await json(`${origin}/api/setup/probe`, { headers });
  const setupCodex = setupProbe.body.clis?.find((item) => item.name === "codex");
  invariant(
    setupProbe.response.ok && setupCodex?.found === true,
    `生产首启 probe 未从隔离 PATH 发现 codex fixture:${JSON.stringify(setupCodex ?? setupProbe.body).slice(0, 1200)}`
  );
  const inventory = await json(`${origin}/api/setup/cli-capability`, { headers });
  const inventoryCodex = inventory.body.clis?.find((item) => item.name === "codex");
  invariant(
    inventory.response.ok && inventory.body.ok === true && inventoryCodex?.found === true &&
      inventoryCodex.version?.includes("0.0.0-fixture"),
    `生产 agent inventory 未从隔离 PATH 发现并执行 codex fixture:${JSON.stringify(inventoryCodex ?? inventory.body).slice(0, 1200)}`
  );
  const opened = cliSync(["open", "--home", stateRoot, "--port", String(port)], {
    ...nodeOnlyEnv,
    SAYDO_OPEN_MARKER: openMarker
  });
  invariant(opened.status === 0, `saydo open 失败:${opened.stderr}`);
  await waitUntil(() => existsSync(openMarker), "saydo open 调起 opener");
  invariant(readFileSync(openMarker, "utf8").startsWith(`${origin}/?token=`), "saydo open 未使用同源 console URL");
  const created = await json(`${origin}/api/focuses`, {
    method: "POST",
    headers,
    body: JSON.stringify({ title: "D1 distribution readback" })
  });
  invariant(created.response.ok && created.body.id, "临时 HOME 写账失败");

  const sameHome = cliSync(["status", "--home", stateRoot, "--port", String(port)]);
  invariant(
    sameHome.status === 0 && JSON.parse(sameHome.stdout).kind === "attached" &&
      JSON.stringify(JSON.parse(sameHome.stdout).identity) === JSON.stringify(health.body.identity),
    "同 HOME 未 attach 或 status 身份漂移"
  );
  const envHome = cliSync(["status", "--port", String(port)], { ...nodeOnlyEnv, SAYDO_HOME: stateRoot });
  invariant(envHome.status === 0 && JSON.parse(envHome.stdout).kind === "attached", "SAYDO_HOME 环境变量未生效");
  const explicitWins = cliSync(["status", "--home", stateRoot, "--port", String(port)], {
    ...nodeOnlyEnv,
    SAYDO_HOME: otherRoot
  });
  invariant(explicitWins.status === 0 && JSON.parse(explicitWins.stdout).kind === "attached", "--home 未覆盖 SAYDO_HOME");
  const otherHome = cliSync(["status", "--home", otherRoot, "--port", String(port)]);
  invariant(
    otherHome.status === 2 && JSON.parse(otherHome.stdout).reason === "home_mismatch",
    "不同 HOME 未显式冲突"
  );
  await attachAndRelease(port, owned.ready.pid);
  invariant((await json(`${origin}/health`)).response.ok, "attached CLI 退出后 owned daemon 不再可用");

  const otherPortSameHome = await freePort();
  const sameHomeOtherPort = startContender(otherPortSameHome, stateRoot);
  const sameHomeOtherPortOutcome = await sameHomeOtherPort.outcome;
  invariant(
    sameHomeOtherPortOutcome.kind === "exit" && sameHomeOtherPortOutcome.code !== 0,
    `同 HOME 不同端口未被 instance lock 拒绝:${JSON.stringify(sameHomeOtherPortOutcome)}`
  );
  invariant((await json(`${origin}/health`)).response.ok, "同 HOME 不同端口 loser 误停现有 daemon");

  const unknown = createServer((_req, res) => {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ service: "not-saydo" }));
  });
  activeServers.add(unknown);
  await new Promise((resolveListen, rejectListen) => {
    unknown.once("error", rejectListen);
    unknown.listen(0, "127.0.0.1", resolveListen);
  });
  const unknownPort = unknown.address().port;
  const unknownProbe = cliSync(["status", "--home", stateRoot, "--port", String(unknownPort)]);
  invariant(unknownProbe.status === 2 && JSON.parse(unknownProbe.stdout).reason === "unknown_service", "未知服务未显式冲突");
  invariant(unknown.listening, "ownership probe 错杀未知服务");
  await new Promise((resolveClose) => unknown.close(resolveClose));
  activeServers.delete(unknown);
  await stop(owned);

  const restarted = await start(port, stateRoot, nodeOnlyEnv, true, "restart-readback");
  const restartedHealth = await json(`${origin}/health`);
  invariant(
    JSON.stringify(restarted.ready.identity) === JSON.stringify(health.body.identity) &&
      JSON.stringify(restartedHealth.body.identity) === JSON.stringify(health.body.identity),
    "重启前后 ready/health 身份不一致"
  );
  const readback = await json(`${origin}/api/focuses`, { headers: { "x-saydo-token": token } });
  invariant(
    readback.response.ok && readback.body.some((focus) => focus.id === created.body.id),
    "重启后临时 HOME 数据未读回"
  );
  await stop(restarted);

  const sameRacePort = await freePort();
  const sameRaceHome = join(scratch, "same-home-race");
  const sameRaceA = startContender(sameRacePort, sameRaceHome);
  const sameRaceB = startContender(sameRacePort, sameRaceHome);
  const sameRaceOutcomes = await Promise.all([sameRaceA.outcome, sameRaceB.outcome]);
  invariant(
    sameRaceOutcomes.filter((outcome) => outcome.kind === "mode" && outcome.frame.mode === "owned").length === 1 &&
      sameRaceOutcomes.filter((outcome) => outcome.kind === "mode" && outcome.frame.mode === "attached").length === 1,
    `同 HOME 并发未收敛为 owned+attached:${JSON.stringify(sameRaceOutcomes)}`
  );
  const sameAttached = sameRaceOutcomes[0].frame?.mode === "attached" ? sameRaceA : sameRaceB;
  const sameOwner = sameAttached === sameRaceA ? sameRaceB : sameRaceA;
  await stopContender(sameAttached);
  invariant((await json(`http://localhost:${sameRacePort}/health`)).response.ok, "并发 attached 退出误停 owned daemon");
  await stopContender(sameOwner);

  const differentRacePort = await freePort();
  const differentRaceA = startContender(differentRacePort, join(scratch, "different-home-a"));
  const differentRaceB = startContender(differentRacePort, join(scratch, "different-home-b"));
  const differentOutcomes = await Promise.all([differentRaceA.outcome, differentRaceB.outcome]);
  const differentOwnerIndex = differentOutcomes.findIndex(
    (outcome) => outcome.kind === "mode" && outcome.frame.mode === "owned"
  );
  invariant(differentOwnerIndex >= 0, `不同 HOME 并发没有 owner:${JSON.stringify(differentOutcomes)}`);
  const differentLoserIndex = differentOwnerIndex === 0 ? 1 : 0;
  const differentLoser = differentOutcomes[differentLoserIndex];
  invariant(
    differentLoser.kind === "exit" && differentLoser.code !== 0 && /home_mismatch|port_conflict/.test(differentLoser.output),
    `不同 HOME 并发 loser 未显式冲突:${JSON.stringify(differentLoser)}`
  );
  invariant(
    !existsSync(join(differentLoserIndex === 0 ? differentRaceA.home : differentRaceB.home, "saydo.db")),
    "不同 HOME 端口 loser 在 bind 前错误开库"
  );
  await stopContender(differentOwnerIndex === 0 ? differentRaceA : differentRaceB);

  const defaultPort = await freePort();
  const defaultOwned = await start(defaultPort, null, nodeOnlyEnv, true, "default-home");
  const defaultHome = join(defaultUserHome, ".saydo");
  invariant(existsSync(join(defaultHome, "saydo.db")), "空 SAYDO_HOME 未回退并在 ~/.saydo 建库");
  const defaultToken = readFileSync(join(defaultHome, ".cap-token"), "utf8").trim();
  const defaultCreated = await json(`http://localhost:${defaultPort}/api/focuses`, {
    method: "POST",
    headers: { "x-saydo-token": defaultToken, "content-type": "application/json" },
    body: JSON.stringify({ title: "D1 default home readback" })
  });
  invariant(defaultCreated.response.ok && defaultCreated.body.id, "默认 HOME 写账失败");
  await stop(defaultOwned);
  const defaultRestarted = await start(
    defaultPort,
    null,
    { ...nodeOnlyEnv, SAYDO_HOME: "" },
    true,
    "default-home-restart"
  );
  const defaultReadback = await json(`http://localhost:${defaultPort}/api/focuses`, {
    headers: { "x-saydo-token": defaultToken }
  });
  invariant(
    defaultReadback.response.ok && defaultReadback.body.some((focus) => focus.id === defaultCreated.body.id),
    "默认 ~/.saydo 重启读回失败"
  );
  await stop(defaultRestarted);

  const fixedDefaultHome = join(scratch, "fixed-default-home");
  let fixedDefaultPortEvidence;
  if (await portAvailable(47100)) {
    const fixedDefault = await start(47100, fixedDefaultHome, nodeOnlyEnv, false, "fixed-port-47100");
    invariant(fixedDefault.ready.port === 47100, "裸 saydo up 未使用固定 47100");
    await stop(fixedDefault);
    fixedDefaultPortEvidence = "owned_on_47100";
  } else {
    // B7: 原占用者前后仍存活（端口仍被占用），不只检查 CLI exit 2。
    invariant(!(await portAvailable(47100)), "47100 占用态在探测前已释放");
    const occupied = cliSync(["status", "--home", fixedDefaultHome]);
    invariant(occupied.status === 2, "47100 已占用时裸 status 未显式冲突");
    invariant(!(await portAvailable(47100)), "47100 占用探测后原监听已消失");
    fixedDefaultPortEvidence = "occupied_conflict_preserved";
  }

  mkdirSync(recoveryRoot, { recursive: true });
  writeFileSync(join(recoveryRoot, "config.toml"), "[models\ninvalid=true\n");
  const recoveryPort = await freePort();
  const recoveryOwned = await start(recoveryPort, recoveryRoot, nodeOnlyEnv, true, "recovery-only");
  invariant(
    recoveryOwned.ready.runtimeMode === "recovery_only" && recoveryOwned.ready.readiness.coreReady === false,
    "CLI 未持有或错误宣称 recovery-only core ready"
  );
  invariant((await fetchClose(`http://localhost:${recoveryPort}/`)).status === 200, "recovery-only 自救 console 不可用");
  await stop(recoveryOwned);

  const fixture = prepareTier1Fixture();
  const lifecycle = await start(port, stateRoot, nodeOnlyEnv, true, "tier1-lifecycle");
  const lifecycleDb = openInstalledDb();
  const { taskId } = seedTier1(lifecycleDb, fixture.repo);
  let running;
  try {
    running = await waitUntil(() => {
      const row = lifecycleDb
        .prepare("SELECT id, state, worktree_path FROM tier1_runs WHERE task_id=?")
        .get(taskId);
      return row?.state === "running" &&
        existsSync(join(row.worktree_path, "agent-parent.pid")) &&
        existsSync(join(row.worktree_path, "agent-child.pid"))
        ? row
        : false;
    }, "Tier1 agent 启动", 50_000);
  } catch (err) {
    const task = lifecycleDb.prepare("SELECT status FROM tasks WHERE id=?").get(taskId);
    const audits = lifecycleDb.prepare("SELECT action, meta_json FROM audit_log ORDER BY ts DESC LIMIT 8").all();
    throw new Error(`${String(err)} task=${JSON.stringify(task)} audits=${JSON.stringify(audits)} daemon=${lifecycle.output().slice(-2000)}`);
  }
  const parentPid = Number(readFileSync(join(running.worktree_path, "agent-parent.pid"), "utf8"));
  const childPid = Number(readFileSync(join(running.worktree_path, "agent-child.pid"), "utf8"));
  rememberPid(parentPid, "Tier1 agent");
  rememberPid(childPid, "Tier1 agent child");
  invariant(processAlive(parentPid) && processAlive(childPid), "Tier1 agent/后代未真实运行");
  const activeOtherPort = await freePort();
  const activeLockLoser = startContender(activeOtherPort, stateRoot);
  const activeLockOutcome = await activeLockLoser.outcome;
  invariant(
    activeLockOutcome.kind === "exit" && activeLockOutcome.code !== 0,
    `活跃 Tier1 时同 HOME 不同端口未被拒绝:${JSON.stringify(activeLockOutcome)}`
  );
  invariant(
    processAlive(parentPid) && processAlive(childPid),
    "同 HOME 不同端口 lock loser 误杀现役 Tier1 进程组"
  );
  await stop(lifecycle);
  const suspended = lifecycleDb
    .prepare("SELECT state, restart_pending_at FROM tier1_runs WHERE task_id=?")
    .get(taskId);
  invariant(suspended.state === "running" && suspended.restart_pending_at, "prepareShutdown 未保留 running/restart marker");
  invariant(
    lifecycleDb.prepare("SELECT status FROM tasks WHERE id=?").get(taskId).status === "running",
    "prepareShutdown 把可恢复任务错误结算"
  );
  await assertPidGone(parentPid, "Tier1 agent");
  await assertPidGone(childPid, "Tier1 agent child");
  const lifecycleRestarted = await start(port, stateRoot, nodeOnlyEnv, true, "tier1-lifecycle-restart");
  try {
    await waitUntil(() =>
      lifecycleDb.prepare("SELECT status FROM tasks WHERE id=?").get(taskId)?.status === "ready_for_review",
    "Tier1 restart resume", 50_000);
  } catch (err) {
    const task = lifecycleDb.prepare("SELECT status FROM tasks WHERE id=?").get(taskId);
    const run = lifecycleDb.prepare("SELECT state, restart_pending_at, restart_reason, native_session_id FROM tier1_runs WHERE task_id=?").get(taskId);
    const audits = lifecycleDb.prepare("SELECT action, meta_json FROM audit_log ORDER BY ts DESC LIMIT 12").all();
    throw new Error(`${String(err)} task=${JSON.stringify(task)} run=${JSON.stringify(run)} audits=${JSON.stringify(audits)} daemon=${lifecycleRestarted.output().slice(-2500)}`);
  }
  const resumedRun = lifecycleDb
    .prepare("SELECT id, state, restart_pending_at, restart_reason, native_session_id, settle_proof_json FROM tier1_runs WHERE task_id=?")
    .get(taskId);
  invariant(
    resumedRun.state === "settled_review" && resumedRun.restart_pending_at === null && resumedRun.restart_reason === null,
    "Tier1 恢复后未清 marker/进入验收态"
  );
  // B7: 断言同 run、同 session、COUNT(*)=1。
  invariant(resumedRun.native_session_id === "chat-d1-distribution", "恢复后 native session 不一致");
  invariant(
    lifecycleDb.prepare("SELECT COUNT(*) AS c FROM tier1_runs WHERE task_id=?").get(taskId).c === 1,
    "恢复路径错误新建了额外 run"
  );
  const resumedProof = JSON.parse(resumedRun.settle_proof_json ?? "null");
  invariant(
    JSON.stringify(resumedProof?.acceptanceChecks) ===
      JSON.stringify([{ criterion: "恢复后进入待验收态", status: "unknown", source: "manual" }]),
    `恢复路径未从 canonical DecisionPackage 逐条重建 AcceptanceCheck:${JSON.stringify(resumedProof?.acceptanceChecks)}`
  );
  invariant(
    lifecycleDb.prepare("SELECT COUNT(*) AS c FROM audit_log WHERE action='tier1.restart_resumed'").get().c === 1 &&
      lifecycleDb.prepare("SELECT COUNT(*) AS c FROM audit_log WHERE action='tier1.failed'").get().c === 0,
    "Tier1 重启审计或失败口径不符"
  );
  const resumedPidPath = join(running.worktree_path, "agent-resumed.pid");
  invariant(existsSync(resumedPidPath), "恢复 agent 未留下 PID 证据");
  const resumedPid = Number(readFileSync(resumedPidPath, "utf8"));
  rememberPid(resumedPid, "Tier1 resumed agent");
  await stop(lifecycleRestarted);
  await assertPidGone(resumedPid, "Tier1 resumed agent");
  lifecycleDb.close();
  openDatabases.delete(lifecycleDb);

  resultSummary = {
    ok: true,
    node: process.version,
    tarball: packed,
    identity: health.body.identity,
    staticHttp: { index: index.status, asset: 200 },
    readiness: { coreReady: true, voiceReady: false, reason: "pipeline_absent" },
    recoveryOnly: { heldByCli: true, coreReady: false, staticHttp: 200 },
    homeReadback: { explicit: created.body.id, default: defaultCreated.body.id },
    ownership: {
      sameHome: "attached",
      attachedUpPreserved: true,
      otherHome: "home_mismatch",
      unknownServicePreserved: true,
      concurrentSameHome: "owned+attached",
      sameHomeDifferentPort: "instance_lock_conflict",
      concurrentDifferentHome: "owned+conflict-before-db",
      defaultPort: fixedDefaultPortEvidence,
      port
    },
    cli: {
      open: "same-origin-url",
      installedEntrypoint: process.platform === "win32" ? "saydo.cmd" : "saydo",
      onboardingInventory: "codex_fixture_found"
    },
    lifecycle: { taskId, prepareShutdown: "restart_pending", resumed: "settled_review" },
    // 实测而非固定字符串：逐个复核本轮 rememberPid 记录过的 pid 是否都已退出。
    // 原先这里直接写死 "daemon_agent_and_descendant_exited"，等于在报告里断言了一个
    // 从未验证的结论——未收口的进程会被随后的 cleanup 掩盖，报告照样"通过"。
    // 复用 birth identity 判定，避免 PID 复用把新进程误认成旧的。
    orphanCheck: (() => {
      const survivors = [];
      for (const [pid, info] of observedPids) {
        if (!processAlive(pid)) continue;
        // PID 复用：同号但 birth 不同即非当初那个进程。
        if (processStart(pid) !== info.start) continue;
        survivors.push(`${info.label}:${pid}`);
      }
      invariant(
        survivors.length === 0,
        `收口后仍有存活的受管进程:${survivors.join(",")}`
      );
      return `verified_all_exited(tracked=${observedPids.size})`;
    })()
  };
} finally {
  // B8: 清理单元独立捕获；allSettled 遍历全部资源；仅全员 ESRCH 后删 scratch。
  const cleanupErrors = [];
  const settle = async (label, work) => {
    try {
      await work();
    } catch (err) {
      cleanupErrors.push(new Error(`${label}:${String(err instanceof Error ? err.message : err).slice(0, 200)}`));
    }
  };
  await Promise.allSettled([...activeChildren].map((child) => settle("child", async () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGINT");
      await waitForExit(child, 8_000, "distribution cleanup").catch(async () => {
        if (child.exitCode === null && child.pid) {
          try {
            if (process.platform === "win32") child.kill("SIGKILL");
            else process.kill(-child.pid, "SIGKILL");
          } catch { child.kill("SIGKILL"); }
        }
        await waitForExit(child, 5_000, "distribution cleanup hard kill");
      });
    }
    // exit 早于 stdio close；后代可能继承 wrapper 的管道句柄。确认进程退出后主动关闭本地读端，
    // 再等待 close；Windows 在 close 前仍会锁住 .cmd/.node 所在安装树。
    closeChildStdio(child);
    await waitForClose(child, 8_000, "distribution cleanup");
  })));
  await Promise.allSettled([...activeServers].map((server) => settle("server", async () => {
    server.closeAllConnections?.();
    await new Promise((resolveClose) => server.close(() => resolveClose()));
  })));
  await Promise.allSettled([...openDatabases].map((db) => settle("db", async () => {
    db.close();
  })));
  await Promise.allSettled([...observedPids.entries()].map(([pid, observed]) => settle(`pid:${observed.label}`, async () => {
    if (!processAlive(pid)) return;
    const start = processStart(pid);
    if (start !== observed.start) throw new Error(`${observed.label} PID 已复用,拒绝误杀:${pid}`);
    try { process.kill(pid, "SIGKILL"); } catch (err) {
      if (err?.code !== "ESRCH") throw err;
    }
    await assertPidGone(pid, observed.label);
  })));
  await Promise.allSettled([...ownedHomes].map((home) => settle(`home:${home}`, async () => {
    await cleanupOwnedRegistry(home, resultSummary === undefined);
  })));
  const stillAlive = [...observedPids.keys()].filter((pid) => processAlive(pid));
  const installPrefix = `${installRoot.toLowerCase()}\\`;
  const loadedFromInstall = (process.report.getReport().sharedObjects ?? [])
    .filter((path) => path.toLowerCase().startsWith(installPrefix))
    .map((path) => path.slice(installRoot.length + 1));
  if (loadedFromInstall.length > 0) {
    cleanupErrors.push(new Error(`installed native objects loaded in verifier:${loadedFromInstall.join(",")}`));
  }
  if (stillAlive.length === 0) {
    try {
      // Windows 在进程退出后仍可能短暂持有 .cmd/.node 句柄；只在 PID 全灭后有限重试 EBUSY，
      // 最终仍删不掉则保持红灯，不能把残留安装树当成成功清理。
      rmSync(scratch, { recursive: true, force: true, maxRetries: 30, retryDelay: 100 });
    } catch (err) {
      cleanupErrors.push(new Error(`scratch:${String(err instanceof Error ? err.message : err).slice(0, 200)}`));
    }
  } else {
    cleanupErrors.push(new Error(`refusing to delete scratch; live pids:${stillAlive.join(",")}`));
  }
  if (cleanupErrors.length > 0) {
    throw new AggregateError(cleanupErrors, `distribution cleanup failed (${cleanupErrors.length})`);
  }
}

process.stdout.write(`${JSON.stringify(resultSummary, null, 2)}\n`);
