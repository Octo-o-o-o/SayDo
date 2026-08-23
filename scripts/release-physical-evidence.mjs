export const physicalReleaseChecks = Object.freeze([
  "publishedBytes",
  "releaseMetadata",
  "runtimeIdentity",
  "health",
  "console",
  "protectedSummary",
  "attach",
  "gracefulStop",
  "noOrphans"
]);

const invariant = (value, message) => {
  if (!value) throw new Error(message);
};

function validateCore(evidence, expected) {
  const checkKeys = Object.keys(evidence?.checks ?? {}).sort();
  invariant(evidence.ok === true, `实体主机证据状态异常:${expected.key}`);
  invariant(evidence.executionSurface === "interactive_host", `实体主机证据来自托管 runner:${expected.key}`);
  invariant(
    evidence.platform === expected.platform && evidence.installMode === expected.installMode,
    `实体主机/安装模式不符:${expected.key}`
  );
  invariant(typeof evidence.arch === "string" && evidence.arch !== "", `实体主机 arch 缺失:${expected.key}`);
  invariant(/^v22\./.test(evidence.nodeVersion ?? ""), `实体主机未使用 Node 22:${expected.key}`);
  invariant(/^[0-9a-f]{64}$/.test(evidence.hostFingerprint ?? ""), `实体主机指纹非法:${expected.key}`);
  const testedAt = Date.parse(evidence.testedAt ?? "");
  invariant(!Number.isNaN(testedAt), `实体主机 testedAt 非法:${expected.key}`);
  invariant(testedAt >= Date.parse(expected.publishedAt), `实体主机证据早于 Release:${expected.key}`);
  invariant(testedAt <= Date.now() + 5 * 60_000, `实体主机证据时间超前:${expected.key}`);
  invariant(
    evidence.packageUrl === expected.packageUrl &&
      evidence.tag === expected.tag &&
      evidence.tarballSha256 === expected.tarballSha256 &&
      evidence.sourceRevision === expected.sourceRevision &&
      evidence.buildId === expected.buildId &&
      evidence.protocolVersion === expected.protocolVersion,
    `实体主机证据未绑定同一 immutable Release:${expected.key}`
  );
  invariant(
    evidence.challenge === expected.challenge && evidence.verifierSha256 === expected.verifierSha256,
    `实体主机证据未绑定本次 challenge/verifier:${expected.key}`
  );
  invariant(
    JSON.stringify(checkKeys) === JSON.stringify([...physicalReleaseChecks].sort()) &&
      physicalReleaseChecks.every((check) => evidence.checks[check] === true),
    `实体主机检查集合不完整:${expected.key}`
  );
  invariant(
    evidence.runtimeIdentity?.sourceRevision === expected.sourceRevision &&
      evidence.runtimeIdentity?.buildId === expected.buildId &&
      evidence.runtimeIdentity?.protocolVersion === expected.protocolVersion,
    `实体主机运行时身份不匹配:${expected.key}`
  );
}

export function validatePhysicalReleaseRun(evidence, expected) {
  invariant(evidence?.schemaVersion === 1, `实体主机原始结果 schema 异常:${expected.key}`);
  validateCore(evidence, expected);
  return evidence;
}

export function validatePhysicalReleaseEvidence(evidence, expected) {
  invariant(evidence?.schemaVersion === 2, `实体主机门控证据 schema 异常:${expected.key}`);
  validateCore(evidence, expected);
  invariant(
    evidence.provenance?.gateRunId === expected.gateRunId &&
      evidence.provenance?.challenge === expected.challenge &&
      evidence.provenance?.transport === expected.transport &&
      evidence.provenance?.verifierSha256 === expected.verifierSha256 &&
      evidence.provenance?.implementationBoundary === expected.implementationBoundary &&
      evidence.provenance?.releaseTagSha === expected.releaseTagSha &&
      JSON.stringify(evidence.provenance?.toolFingerprints) === JSON.stringify(expected.toolFingerprints),
    `实体主机证据缺 gate 直连来源:${expected.key}`
  );
  return {
    path: expected.path,
    platform: expected.platform,
    installMode: expected.installMode,
    arch: evidence.arch,
    nodeVersion: evidence.nodeVersion,
    testedAt: evidence.testedAt,
    hostFingerprint: evidence.hostFingerprint,
    checks: evidence.checks,
    provenance: evidence.provenance
  };
}
