#!/usr/bin/env node

import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:net";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { hostname, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageUrl = process.argv[2];
const installMode = process.argv[3] ?? "global";
const evidenceFlag = process.argv.indexOf("--evidence");
const evidencePath = evidenceFlag >= 0 ? process.argv[evidenceFlag + 1] : undefined;
const challengeFlag = process.argv.indexOf("--challenge");
const challenge = challengeFlag >= 0 ? process.argv[challengeFlag + 1] : undefined;
if (
  !packageUrl ||
  !/^https:\/\/github\.com\/[^/]+\/[^/]+\/releases\/download\/v[^/]+\/[^/]+\.tgz$/.test(packageUrl) ||
  !["exec", "global"].includes(installMode) ||
  (evidenceFlag >= 0 && (!evidencePath || evidencePath.startsWith("--"))) ||
  (challengeFlag >= 0 && !/^[0-9a-f]{64}$/.test(challenge ?? ""))
) {
  console.error(
    "用法:node scripts/verify-release-url.mjs <GitHub Release 固定 tgz URL> [exec|global] [--evidence <path>] [--challenge <64hex>]"
  );
  process.exit(2);
}
if (Number(process.versions.node.split(".")[0]) !== 22) throw new Error(`需要 Node 22,当前 ${process.version}`);

const scratch = mkdtempSync(join(realpathSync(tmpdir()), "saydo-release-url-"));
const prefix = join(scratch, "global-prefix");
const npmCache = join(scratch, "npm-cache");
const userHome = join(scratch, "user-home");
const saydoHome = join(scratch, "saydo-home");
const verifierSha256 = createHash("sha256").update(readFileSync(fileURLToPath(import.meta.url))).digest("hex");
mkdirSync(userHome, { recursive: true });
let child;
let attachedChild;
let releaseIdentity;

const invariant = (value, message) => {
  if (!value) throw new Error(message);
};

function npmCommand() {
  if (process.platform !== "win32") return { file: "npm", prefix: [] };
  const cli = join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
  if (!existsSync(cli)) throw new Error(`npm-cli.js 未找到:${cli}`);
  return { file: process.execPath, prefix: [cli] };
}

async function fetchBytes(url) {
  let lastError;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: "follow", cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (attempt < 6) await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
  }
  throw lastError;
}

async function verifyPublishedBytes() {
  const parsed = new URL(packageUrl);
  const filename = parsed.pathname.split("/").at(-1);
  const match = /\/releases\/download\/(v([^/]+))\/([^/]+\.tgz)$/.exec(parsed.pathname);
  invariant(match !== null && match[3] === filename, "固定 URL 未包含可解析的 tag/filename");
  const [, tag, version] = match;
  const base = new URL("./", parsed);
  const [tarBytes, checksumBytes, metadataBytes] = await Promise.all([
    fetchBytes(packageUrl),
    fetchBytes(new URL("SHA256SUMS", base)),
    fetchBytes(new URL("release-metadata.json", base))
  ]);
  const digest = createHash("sha256").update(tarBytes).digest("hex");
  const checksum = checksumBytes.toString("utf8");
  const metadata = JSON.parse(metadataBytes.toString("utf8"));
  const localTarball = join(scratch, filename);
  writeFileSync(localTarball, tarBytes);
  const archiveEntries = execFileSync("tar", ["-tzf", localTarball], { encoding: "utf8" })
    .split(/\r?\n/u)
    .filter((entry) => entry !== "" && !entry.endsWith("/"));
  const archivedPackage = JSON.parse(
    execFileSync("tar", ["-xOf", localTarball, "package/package.json"], { encoding: "utf8" })
  );
  invariant(checksum === `${digest}  ${filename}\n`, "线上 SHA256SUMS 与 tgz 字节不一致");
  invariant(
    metadata.schemaVersion === 3 &&
      metadata.package === "@saydo/cli" &&
      metadata.version === version &&
      metadata.tag === tag &&
      metadata.filename === filename &&
      metadata.sha256 === digest &&
      metadata.bytes === tarBytes.length &&
      metadata.npmIntegrity === `sha512-${createHash("sha512").update(tarBytes).digest("base64")}` &&
      Number.isInteger(metadata.entryCount) &&
      metadata.entryCount === archiveEntries.length &&
      metadata.reproducibleBuilds === 2 &&
      /^[0-9a-f]{64}$/.test(metadata.sourceRevision) &&
      typeof metadata.buildId === "string" &&
      metadata.buildId.startsWith(`${version}+${metadata.sourceRevision.slice(0, 12)}.`) &&
      /^\d+\.\d+\.\d+$/.test(metadata.protocolVersion) &&
      archivedPackage.name === "@saydo/cli" &&
      archivedPackage.version === version,
    "线上 release-metadata 与 tgz 身份不一致"
  );
  invariant(createHash("sha256").update(readFileSync(localTarball)).digest("hex") === digest, "落盘 tgz 摘要漂移");
  return metadata;
}

function cmdQuote(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function shimPath() {
  return process.platform === "win32" ? join(prefix, "saydo.cmd") : join(prefix, "bin", "saydo");
}

function invocation(args) {
  if (installMode === "exec") {
    const npm = npmCommand();
    return {
      file: npm.file,
      args: [...npm.prefix, "exec", "--yes", `--package=${packageUrl}`, "--", "saydo", ...args]
    };
  }
  const shim = shimPath();
  if (process.platform !== "win32") return { file: shim, args };
  const comSpec = process.env["ComSpec"] ?? join(process.env["SystemRoot"] ?? "C:\\Windows", "System32", "cmd.exe");
  return { file: comSpec, args: ["/d", "/s", "/c", [shim, ...args].map(cmdQuote).join(" ")] };
}

function isolatedEnv() {
  return {
    ...process.env,
    HOME: userHome,
    USERPROFILE: userHome,
    npm_config_cache: npmCache,
    ...(process.platform === "win32"
      ? {
          HOMEDRIVE: userHome.slice(0, 2),
          HOMEPATH: userHome.slice(2) || "\\",
          TEMP: scratch,
          TMP: scratch,
          LOCALAPPDATA: join(userHome, "AppData", "Local"),
          APPDATA: join(userHome, "AppData", "Roaming")
        }
      : {})
  };
}

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve) => server.close(resolve));
  invariant(port > 0, "未取得空闲端口");
  return port;
}

async function installWithRetry() {
  const npm = npmCommand();
  let lastError;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      execFileSync(
        npm.file,
        [...npm.prefix, "install", "--global", "--prefix", prefix, packageUrl],
        { cwd: scratch, env: isolatedEnv(), stdio: ["ignore", "pipe", "pipe"] }
      );
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 6) await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
  }
  throw lastError;
}

async function waitForReady(proc, output, mode, timeoutMs = 30_000) {
  const startedAt = Date.now();
  for (;;) {
    const line = output().split("\n").find((item) => item.startsWith(`{"mode":"${mode}"`));
    if (line) return JSON.parse(line);
    if (proc.exitCode !== null || proc.signalCode !== null) {
      throw new Error(`saydo up ${mode} 就绪前退出:${output().slice(-2000)}`);
    }
    if (Date.now() - startedAt > timeoutMs) throw new Error(`saydo up ${mode} 就绪超时:${output().slice(-2000)}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

async function waitForExit(proc, timeoutMs = 30_000) {
  if (proc.exitCode !== null || proc.signalCode !== null) return { code: proc.exitCode, signal: proc.signalCode };
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("saydo up 优雅退出超时")), timeoutMs);
    proc.once("exit", (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal });
    });
  });
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code !== "ESRCH";
  }
}

async function waitGone(pid) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (!alive(pid)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`daemon 孤儿仍存活:${pid}`);
}

function emergencyStop() {
  for (const proc of [attachedChild, child]) {
    if (!proc?.pid || proc.exitCode !== null || proc.signalCode !== null) continue;
    try {
      if (process.platform === "win32") {
        execFileSync("taskkill", ["/PID", String(proc.pid), "/T", "/F"], { stdio: "ignore" });
      } else {
        process.kill(-proc.pid, "SIGKILL");
      }
    } catch {
      proc.kill("SIGKILL");
    }
  }
}

try {
  releaseIdentity = await verifyPublishedBytes();
  if (installMode === "global") {
    await installWithRetry();
    invariant(existsSync(shimPath()), `全局安装缺真实入口:${shimPath()}`);
  }
  const port = await freePort();
  const cli = invocation(["up", "--home", saydoHome, "--port", String(port), "--no-open"]);
  child = spawn(cli.file, cli.args, {
    cwd: scratch,
    env: isolatedEnv(),
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
    windowsHide: true
  });
  let output = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  const ready = await waitForReady(child, () => output, "owned", process.platform === "win32" ? 45_000 : 30_000);
  invariant(Number.isInteger(ready.pid) && ready.pid > 0, "ready 缺 daemon pid");
  invariant(Number.isInteger(ready.supervisorPid) && ready.supervisorPid > 0, "ready 缺 supervisor pid");

  const origin = `http://localhost:${port}`;
  const health = await fetch(`${origin}/health`).then((response) => response.json());
  invariant(health.service === "saydo-daemon", "固定 URL 安装后的 /health 未就绪");
  invariant(
    health.identity?.sourceRevision === releaseIdentity.sourceRevision &&
      health.identity?.buildId === releaseIdentity.buildId &&
      health.identity?.protocolVersion === releaseIdentity.protocolVersion,
    "固定 URL 运行时身份与线上 release-metadata 不一致"
  );
  const index = await fetch(`${origin}/`);
  invariant(index.status === 200 && (await index.text()).includes("<div id=\"root\"></div>"), "固定 URL 安装后的 console 不可用");

  const statusCli = invocation(["status", "--home", saydoHome, "--port", String(port)]);
  const statusRaw = execFileSync(statusCli.file, statusCli.args, {
    cwd: scratch,
    env: isolatedEnv(),
    encoding: "utf8"
  });
  const status = JSON.parse(statusRaw);
  invariant(status.kind === "attached" && status.pid === ready.pid, "真实安装入口 status 未 attach 到同一 daemon");
  invariant(
    status.summary?.version === 1 &&
      Number.isInteger(status.summary.activeWork?.total) &&
      Number.isInteger(status.summary.attention?.orange),
    "status 未通过受保护 desktop summary 合同"
  );

  const attachCli = invocation(["up", "--home", saydoHome, "--port", String(port), "--no-open"]);
  attachedChild = spawn(attachCli.file, attachCli.args, {
    cwd: scratch,
    env: isolatedEnv(),
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
    windowsHide: true
  });
  let attachOutput = "";
  attachedChild.stdout.setEncoding("utf8");
  attachedChild.stderr.setEncoding("utf8");
  attachedChild.stdout.on("data", (chunk) => { attachOutput += chunk; });
  attachedChild.stderr.on("data", (chunk) => { attachOutput += chunk; });
  const attached = await waitForReady(
    attachedChild,
    () => attachOutput,
    "attached",
    process.platform === "win32" ? 45_000 : 30_000
  );
  invariant(attached.pid === ready.pid && attached.supervisorPid !== ready.supervisorPid, "重复 up 未 attach 到既有 daemon");
  if (process.platform === "win32") {
    mkdirSync(join(saydoHome, "runtime"), { recursive: true });
    writeFileSync(join(saydoHome, "runtime", `cli-stop-${attached.supervisorPid}`), "cli_sigint\n");
  } else {
    attachedChild.kill("SIGINT");
  }
  const attachedEnded = await waitForExit(attachedChild, process.platform === "win32" ? 45_000 : 30_000);
  invariant(attachedEnded.code === 0 && attachedEnded.signal === null, "重复 up attach 未优雅退出");
  invariant(alive(ready.pid), "attach 客户端退出误停了 owner daemon");

  if (process.platform === "win32") {
    mkdirSync(join(saydoHome, "runtime"), { recursive: true });
    writeFileSync(join(saydoHome, "runtime", `cli-stop-${ready.supervisorPid}`), "cli_sigint\n");
  } else {
    child.kill("SIGINT");
  }
  const ended = await waitForExit(child, process.platform === "win32" ? 45_000 : 30_000);
  invariant(ended.code === 0 && ended.signal === null, `固定 URL CLI 非优雅退出:${JSON.stringify(ended)}`);
  await waitGone(ready.pid);
  const evidence = {
    schemaVersion: 1,
    testedAt: new Date().toISOString(),
    ok: true,
    executionSurface: process.env["GITHUB_ACTIONS"] === "true" ? "github_actions" : "interactive_host",
    hostFingerprint: createHash("sha256")
      .update(`${process.platform}\0${process.arch}\0${hostname()}`)
      .digest("hex"),
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    challenge,
    verifierSha256,
    installMode,
    packageUrl,
    tag: releaseIdentity.tag,
    tarballSha256: releaseIdentity.sha256,
    sourceRevision: releaseIdentity.sourceRevision,
    buildId: releaseIdentity.buildId,
    protocolVersion: releaseIdentity.protocolVersion,
    runtimeIdentity: health.identity,
    checks: {
      publishedBytes: true,
      releaseMetadata: true,
      runtimeIdentity: true,
      health: true,
      console: true,
      protectedSummary: true,
      attach: true,
      gracefulStop: true,
      noOrphans: true
    }
  };
  if (evidencePath) {
    const absolute = resolve(evidencePath);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, `${JSON.stringify(evidence, null, 2)}\n`);
  }
  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
} finally {
  emergencyStop();
  rmSync(scratch, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
}
