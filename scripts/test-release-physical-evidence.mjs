import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
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
const windowsWrapperSource = readFileSync(
  fileURLToPath(new URL("./run-release-verifier-windows.ps1", import.meta.url)),
  "utf8"
);
const publicSnapshotSource = readFileSync(
  fileURLToPath(new URL("./publish-public-snapshot.sh", import.meta.url)),
  "utf8"
);
if (
  postReleaseGateSource.includes("--mac-evidence-exec") ||
  postReleaseGateSource.includes("--windows-evidence-exec") ||
  !postReleaseGateSource.includes("拒绝预制输入") ||
  !postReleaseGateSource.includes("StrictHostKeyChecking=yes") ||
  !postReleaseGateSource.includes("toString(\"base64url\")") ||
  !postReleaseGateSource.includes("powershell.exe") ||
  !postReleaseGateSource.includes('"-NoProfile"') ||
  !windowsWrapperSource.includes("ConvertFrom-Json") ||
  !windowsWrapperSource.includes("exit $LASTEXITCODE")
) {
  throw new Error("availability gate 未保持直接实体实跑边界");
}
if (
  !publicSnapshotSource.includes('canonical_private_probes_file="$git_common_dir/info/saydo-private-probes"') ||
  !publicSnapshotSource.includes("resolved_private_probes_file") ||
  !publicSnapshotSource.includes("owner-only")
) {
  throw new Error("公开 tag 隐私探针未固定到 Git 私有目录");
}
const verifierPathContract = /\$request\.verifierPath\s+-cne\s+"([^"]+)"/.exec(windowsWrapperSource)?.[1];
if (verifierPathContract !== "scripts/verify-release-url.mjs") {
  throw new Error(`Windows wrapper 未锁定固定相对 verifier 路径:${String(verifierPathContract)}`);
}
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
  packageUrl: "https://github.com/Octo-o-o-o/SayDo/releases/download/v0.1.0-rc.4/saydo-cli-0.1.0-rc.4.tgz",
  tag: "v0.1.0-rc.4",
  tarballSha256: "a".repeat(64),
  sourceRevision: "b".repeat(64),
  buildId: `0.1.0-rc.4+${"b".repeat(12)}.test`,
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

console.log("[ok] release physical evidence gate self-test");
