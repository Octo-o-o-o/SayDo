import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  parseVerifierOutput,
  physicalReleaseChecks,
  validatePhysicalReleaseEvidence,
  validatePhysicalReleaseRun
} from "./release-physical-evidence.mjs";
import {
  TRACKED_ASSET_MANIFEST_RELATIVE_PATH,
  windowsVerifierClosure
} from "./release-physical-closure.mjs";

const verifierStartup = spawnSync(process.execPath, [fileURLToPath(new URL("./verify-release-url.mjs", import.meta.url))], {
  encoding: "utf8"
});
if (verifierStartup.status !== 2 || !verifierStartup.stderr.includes("用法:node scripts/verify-release-url.mjs")) {
  throw new Error(
    `固定 URL 验证器启动门失败:${JSON.stringify({ status: verifierStartup.status, stderr: verifierStartup.stderr })}`
  );
}
const postReleaseGateSource = readFileSync(fileURLToPath(new URL("./post-release-gate.mjs", import.meta.url)), "utf8");
const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const windowsFiles = windowsVerifierClosure(repoRoot);
if (
  !windowsFiles.includes("scripts/release-asset-manifest.mjs") ||
  !windowsFiles.includes("scripts/release-file-transaction.mjs") ||
  !windowsFiles.includes(TRACKED_ASSET_MANIFEST_RELATIVE_PATH)
) {
  throw new Error("Windows verifier 闭包缺少 helper/data");
}

const expected = {
  key: "macExec",
  path: "e2e/evidence/release-mac-exec.json",
  platform: "darwin",
  installMode: "exec",
  packageUrl: "https://github.com/Octo-o-o-o/SayDo/releases/download/v0.1.0-rc.13/saydo-cli-0.1.0-rc.13.tgz",
  tag: "v0.1.0-rc.13",
  tarballSha256: "a".repeat(64),
  sourceRevision: "b".repeat(64),
  buildId: `0.1.0-rc.13+${"b".repeat(12)}.test`,
  protocolVersion: "1.0.0",
  publishedAt: "2026-08-22T23:59:00.000Z",
  challenge: "d".repeat(64),
  verifierSha256: "e".repeat(64),
  gateRunId: "11111111-1111-4111-8111-111111111111",
  transport: "local_process",
  implementationBoundary: "f".repeat(40),
  releaseTagSha: "1".repeat(40),
  toolFingerprints: {
    "scripts/post-release-gate.mjs": "2".repeat(64),
    "scripts/release-physical-evidence.mjs": "3".repeat(64),
    "scripts/run-release-verifier-windows.ps1": "4".repeat(64),
    "scripts/verify-release-url.mjs": "e".repeat(64)
  }
};
const valid = {
  schemaVersion: 1,
  testedAt: "2026-08-23T00:00:00.000Z",
  ok: true,
  executionSurface: "interactive_host",
  hostFingerprint: "c".repeat(64),
  platform: "darwin",
  arch: "arm64",
  nodeVersion: "v22.18.0",
  challenge: expected.challenge,
  verifierSha256: expected.verifierSha256,
  installMode: "exec",
  packageUrl: expected.packageUrl,
  tag: expected.tag,
  tarballSha256: expected.tarballSha256,
  sourceRevision: expected.sourceRevision,
  buildId: expected.buildId,
  protocolVersion: expected.protocolVersion,
  runtimeIdentity: {
    sourceRevision: expected.sourceRevision,
    buildId: expected.buildId,
    protocolVersion: expected.protocolVersion
  },
  checks: Object.fromEntries(physicalReleaseChecks.map((check) => [check, true]))
};

validatePhysicalReleaseRun(valid, expected);
for (const [name, mutate] of [
  ["hosted runner", (value) => { value.executionSurface = "github_actions"; }],
  ["platform", (value) => { value.platform = "win32"; }],
  ["node", (value) => { value.nodeVersion = "v21.9.0"; }],
  ["identity", (value) => { value.runtimeIdentity.buildId = "wrong"; }],
  ["challenge", (value) => { value.challenge = "0".repeat(64); }],
  ["verifier", (value) => { value.verifierSha256 = "0".repeat(64); }],
  ["stale", (value) => { value.testedAt = "2026-08-22T23:58:00.000Z"; }],
  ["check", (value) => { delete value.checks.noOrphans; }]
]) {
  const candidate = structuredClone(valid);
  mutate(candidate);
  let rejected = false;
  try {
    validatePhysicalReleaseRun(candidate, expected);
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error(`实体证据反例未拒绝:${name}`);
}

let rawRejected = false;
try {
  validatePhysicalReleaseEvidence(valid, expected);
} catch {
  rawRejected = true;
}
if (!rawRejected) throw new Error("手写原始 JSON 不得被 gate 当成实体证据");

const wrapped = {
  ...valid,
  schemaVersion: 2,
  provenance: {
    gateRunId: expected.gateRunId,
    challenge: expected.challenge,
    transport: expected.transport,
    verifierSha256: expected.verifierSha256,
    implementationBoundary: expected.implementationBoundary,
    releaseTagSha: expected.releaseTagSha,
    toolFingerprints: expected.toolFingerprints
  }
};
validatePhysicalReleaseEvidence(wrapped, expected);
const forgedTransport = structuredClone(wrapped);
forgedTransport.provenance.transport = "pinned_ssh";
let provenanceRejected = false;
try {
  validatePhysicalReleaseEvidence(forgedTransport, expected);
} catch {
  provenanceRejected = true;
}
if (!provenanceRejected) throw new Error("实体证据 transport 漂移未拒绝");

const privateMarker = "fixture-private-output-marker-not-a-real-secret";
const dirtyOutput = `not-json ${privateMarker}`;

function expectedRejectMessage(output, key) {
  const text = typeof output === "string" ? output : "";
  const digest = createHash("sha256").update(text).digest("hex");
  return `固定 URL verifier stdout 不是单一 JSON:${key}:len=${text.length}:bytes=${Buffer.byteLength(text, "utf8")}:sha256=${digest}`;
}

function assertSanitizedReject(label, output, key) {
  let caught;
  try {
    parseVerifierOutput(output, key);
  } catch (error) {
    caught = error;
  }
  if (!caught) throw new Error(`${label}:非 JSON 未拒绝`);
  const message = caught instanceof Error ? caught.message : String(caught);
  if (typeof output === "string" && output.includes(privateMarker) && message.includes(privateMarker)) {
    throw new Error(`${label}:错误含合成私有 marker`);
  }
  if (message.includes("head=") || message.includes("tail=")) throw new Error(`${label}:错误仍含原文片段字段`);
  const expectedMessage = expectedRejectMessage(output, key);
  if (message !== expectedMessage) throw new Error(`${label}:错误摘要不符:${message}`);
  return message;
}

assertSanitizedReject("imported", dirtyOutput, "windowsExec");

const multibyteOutput = `not-json ${privateMarker} 中文`;
if (Buffer.byteLength(multibyteOutput, "utf8") === multibyteOutput.length) {
  throw new Error("UTF8 多字节夹具未形成 len/bytes 差");
}
assertSanitizedReject("utf8-multibyte", multibyteOutput, "windowsExec");

const isolatedSurrogateOutput = `not-json ${privateMarker}\uD800`;
if (Buffer.byteLength(isolatedSurrogateOutput, "utf8") === isolatedSurrogateOutput.length) {
  throw new Error("孤立代理夹具未形成 len/bytes 差");
}
assertSanitizedReject("isolated-surrogate", isolatedSurrogateOutput, "windowsExec");

const parsed = parseVerifierOutput(JSON.stringify(valid), expected.key);
if (JSON.stringify(parsed) !== JSON.stringify(valid)) throw new Error("完整 JSON 被改写或拒绝");
validatePhysicalReleaseRun(parsed, expected);

const incomplete = parseVerifierOutput(JSON.stringify({ schemaVersion: 1, ok: true }), expected.key);
let incompleteRejected = false;
try {
  validatePhysicalReleaseRun(incomplete, expected);
} catch {
  incompleteRejected = true;
}
if (!incompleteRejected) throw new Error("不完整 JSON 不得当作实体证据成功");

// SC-58:runWindowsPhysical 远端 rmdir 必须确认本次创建归属。抽取生产函数原文,
// 替换 SSH/文件系统边界,不连接真实远端。
function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`生产源缺少 ${name}`);
  let depth = 0;
  const begin = source.indexOf("{", start);
  for (let i = begin; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`${name} 函数体不完整`);
}

const runWindowsPhysicalSrc = extractFunction(postReleaseGateSource, "runWindowsPhysical");
function makeRunWindowsPhysical(deps) {
  const names = [
    "repo",
    "windowsRemoteRootName",
    "windowsVerifierClosure",
    "assertClosureFingerprints",
    "hashClosureFiles",
    "mkdtempSync",
    "join",
    "tmpdir",
    "materializeClosure",
    "sshText",
    "execFileSync",
    "sshClientEnv",
    "parseRemoteHashes",
    "createHash",
    "randomUUID",
    "physicalExpected",
    "assertSafeRemoteVerifierPath",
    "WINDOWS_VERIFIER_RELATIVE_PATH",
    "WINDOWS_WRAPPER_RELATIVE_PATH",
    "tag",
    "parseVerifierOutput",
    "validatePhysicalReleaseRun",
    "wrapPhysicalEvidence",
    "rmSync",
    "invariant"
  ];
  return new Function(
    "deps",
    `const {${names.join(",")}} = deps;\n${runWindowsPhysicalSrc}\nreturn runWindowsPhysical;`
  )(deps);
}

function sc58Deps(overrides) {
  const calls = { ssh: [], scp: 0, rmdir: 0 };
  const defaults = {
    repo: "/nonexistent-repo",
    windowsRemoteRootName: () => "saydo-gate-run-test",
    windowsVerifierClosure: () => ["scripts/verify-release-url.mjs"],
    assertClosureFingerprints: () => undefined,
    hashClosureFiles: () => ({}),
    mkdtempSync: (prefix) => `${prefix}owned`,
    join: (...parts) => parts.join("/"),
    tmpdir: () => "/tmp",
    materializeClosure: () => undefined,
    sshText: (_cfg, command) => {
      calls.ssh.push(command);
      if (/rmdir/u.test(command)) calls.rmdir += 1;
      return "";
    },
    execFileSync: () => {
      calls.scp += 1;
      return "";
    },
    sshClientEnv: () => ({}),
    parseRemoteHashes: () => ({}),
    createHash: () => ({ update: () => ({ digest: () => "0".repeat(64) }) }),
    randomUUID: () => "00000000-0000-4000-8000-000000000000",
    physicalExpected: () => ({ packageUrl: "https://example.invalid/pkg.tgz" }),
    assertSafeRemoteVerifierPath: (p) => p,
    WINDOWS_VERIFIER_RELATIVE_PATH: "scripts/verify-release-url.mjs",
    WINDOWS_WRAPPER_RELATIVE_PATH: "scripts/run-release-verifier-windows.ps1",
    tag: "v0.0.0-test",
    parseVerifierOutput: () => ({}),
    validatePhysicalReleaseRun: () => undefined,
    wrapPhysicalEvidence: (raw) => raw,
    rmSync: () => undefined,
    invariant: (value, message) => {
      if (!value) throw new Error(message);
    }
  };
  return { deps: { ...defaults, ...overrides }, calls };
}

const sshConfig = { options: [], host: "example.invalid", node: "node", targetFingerprint: "t", hostKeyFingerprint: "h" };

// 反例 1:本地闭包准备失败 -> 不得发送远端 rmdir
{
  const { deps, calls } = sc58Deps({
    materializeClosure: () => {
      throw new Error("local closure prep failed");
    }
  });
  const run = makeRunWindowsPhysical(deps);
  let threw = false;
  try {
    run({}, { fingerprints: { "scripts/verify-release-url.mjs": "0".repeat(64) } }, [], "run-1", sshConfig);
  } catch {
    threw = true;
  }
  if (!threw) throw new Error("SC-58 本地准备失败未传播错误");
  if (calls.rmdir !== 0) throw new Error(`SC-58 本地准备失败仍发远端 rmdir:${calls.rmdir}`);
}

// 反例 2:远端目录已存在,创建被拒 -> 不得发送远端 rmdir
{
  const { deps, calls } = sc58Deps({
    sshText: (_cfg, command) => {
      calls.ssh.push(command);
      if (/New-Item/u.test(command)) throw new Error("remote root exists");
      if (/rmdir/u.test(command)) calls.rmdir += 1;
      return "";
    }
  });
  const run = makeRunWindowsPhysical(deps);
  let threw = false;
  try {
    run({}, { fingerprints: { "scripts/verify-release-url.mjs": "0".repeat(64) } }, [], "run-2", sshConfig);
  } catch {
    threw = true;
  }
  if (!threw) throw new Error("SC-58 远端已存在未传播错误");
  if (calls.rmdir !== 0) throw new Error(`SC-58 远端已存在仍发远端 rmdir:${calls.rmdir}`);
}

// 正例:本 run 创建成功 -> 收尾仍发送远端 rmdir 一次
{
  const { deps, calls } = sc58Deps({});
  const run = makeRunWindowsPhysical(deps);
  const out = run(
    {},
    { fingerprints: { "scripts/verify-release-url.mjs": "0".repeat(64) } },
    [],
    "run-3",
    sshConfig
  );
  if (!Array.isArray(out)) throw new Error("SC-58 正例未返回 results");
  if (calls.rmdir !== 1) throw new Error(`SC-58 创建成功后应发一次远端 rmdir,实际:${calls.rmdir}`);
}

console.log("[ok] release physical evidence gate self-test");
