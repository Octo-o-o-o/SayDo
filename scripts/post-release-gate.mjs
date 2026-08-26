#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import {
  assertAssetsMatchTrackedManifest,
  assertIdentityMatchesTrackedManifest,
  assertReleaseApiAssetsMatchManifest,
  inspectAssetBytes,
  loadTrackedReleaseAssetManifest
} from "./release-asset-manifest.mjs";
import { applyAvailabilityReplacementsFromSnapshot } from "./release-availability.mjs";
import {
  getPagesProject,
  listPagesDeployments,
  requireCloudflareCredentials
} from "./release-cloudflare-pages.mjs";
import {
  WEEK_AUDIT_WRITE_OUTPUTS,
  runMutationsWithRollback,
  writeFileAtomic
} from "./release-file-transaction.mjs";
import {
  acquireDeployEvidenceLease,
  persistClaimedDeployEvidence,
  runPagesDeployStateMachine
} from "./release-pages-deploy.mjs";
import {
  validatePhysicalReleaseEvidence,
  validatePhysicalReleaseRun
} from "./release-physical-evidence.mjs";
import {
  assertClosureFingerprints,
  assertPhysicalToolFingerprints,
  assertSafeRemoteVerifierPath,
  hashClosureFiles,
  materializeClosure,
  physicalToolClosure,
  WINDOWS_VERIFIER_RELATIVE_PATH,
  WINDOWS_WRAPPER_RELATIVE_PATH,
  windowsRemoteRootName,
  windowsVerifierClosure
} from "./release-physical-closure.mjs";
import {
  collectPushRuns,
  createGhWorkflowRunPageFetcher,
  evaluateTagWorkflowHistory
} from "./release-tag-guard.mjs";

const repo = resolve(import.meta.dirname, "..");
const repository = "Octo-o-o-o/SayDo";
const publicUrl = `https://github.com/${repository}.git`;
const originUrl = "https://github.com/Octo-o-o-o/SayDo-archive.git";
const mode = process.argv[2];
const tag = process.argv[3];
const evidenceFlag = process.argv.indexOf("--evidence");
const evidencePath = evidenceFlag >= 0 ? process.argv[evidenceFlag + 1] : undefined;
const optionValue = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const physicalEvidenceDir = optionValue("--physical-evidence-dir");
const windowsHost = optionValue("--windows-host");
const windowsKnownHosts = optionValue("--windows-known-hosts");
const windowsNode = optionValue("--windows-node");

if (!["--check-candidate", "--verify", "--write-availability", "--deploy"].includes(mode) || tag !== "v0.1.0-rc.12") {
  console.error(
    "用法:node scripts/post-release-gate.mjs <--check-candidate|--verify|--write-availability|--deploy> v0.1.0-rc.12 [--evidence <path>] [--physical-evidence-dir <path> --windows-host <user@literal-ip> --windows-known-hosts <path> --windows-node <absolute-node.exe>]"
  );
  process.exit(2);
}
if (evidenceFlag >= 0 && (!evidencePath || evidencePath.startsWith("--"))) {
  throw new Error("--evidence 缺输出路径");
}
if (mode !== "--check-candidate" && !evidencePath) {
  throw new Error(`${mode} 必须用 --evidence 落盘发布证据`);
}
if (mode === "--write-availability" && (!physicalEvidenceDir || !windowsHost || !windowsKnownHosts || !windowsNode)) {
  throw new Error("--write-availability 必须直接实跑 Mac/Windows；缺少 evidence dir、Windows SSH 锚或绝对 node.exe");
}

const version = tag.slice(1);
const filename = `saydo-cli-${version}.tgz`;
const assetBase = `https://github.com/${repository}/releases/download/${tag}/`;
const expectedAssets = ["SHA256SUMS", "release-metadata.json", filename];
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const invariant = (value, message) => {
  if (!value) throw new Error(message);
};
const execText = (file, args, options = {}) =>
  execFileSync(file, args, {
    cwd: repo,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    ...options
  }).trim();
const ghJson = (args) => JSON.parse(execText("gh", args));
const gitText = (args) => execText("git", args);

const availabilityReplacements = [
  {
    path: "README.md",
    before:
      "普通用户无需克隆源码。下面是 v0.1.0-rc.12 的发布候选固定 URL；仅当\n[GitHub Release 页面](https://github.com/Octo-o-o-o/SayDo/releases/tag/v0.1.0-rc.12)\n已经出现且发布检查全绿后，命令才可用：",
    after:
      "普通用户无需克隆源码。v0.1.0-rc.12 固定 URL 已由不可变\n[GitHub Release](https://github.com/Octo-o-o-o/SayDo/releases/tag/v0.1.0-rc.12)\n及 macOS、Windows、Linux 的一次运行 / 全局安装六项 smoke 验证，可直接使用："
  },
  {
    path: "docs/site/2026-08-20-docs-page-content.fable.md",
    before:
      "**推荐 · 不克隆源码:**下面是 v0.1.0-rc.12 的发布候选固定 URL;仅当 GitHub Release 页面已经出现且发布检查全绿后才可用。尚未发布到 npm registry 或 Homebrew。",
    after:
      "**推荐 · 不克隆源码:**v0.1.0-rc.12 固定 URL 已由不可变 GitHub Release 与 macOS、Windows、Linux 的一次运行 / 全局安装六项 smoke 验证,可直接使用。尚未发布到 npm registry 或 Homebrew。"
  },
  {
    path: "docs/site/2026-08-20-docs-page-content.fable.md",
    before:
      "源码形态已经可运行;v0.1.0-rc.12 固定 URL 仅在 GitHub Release 出现且发布检查全绿后生效。npm registry / Homebrew",
    after:
      "源码形态已经可运行;v0.1.0-rc.12 固定 URL 已由不可变 GitHub Release 与六项跨平台安装 smoke 验证。npm registry / Homebrew"
  },
  {
    path: "docs/site/2026-08-20-homepage-structure-copy.fable.md",
    before:
      "macOS / Windows / Linux 的 daemon 与 Web 控制台源码形态已经可运行;v0.1.0-rc.12 固定 URL 仅在 GitHub Release 出现且发布检查全绿后生效,届时可一条命令启动、无需克隆源码。",
    after:
      "macOS / Windows / Linux 的 daemon 与 Web 控制台源码形态已经可运行;v0.1.0-rc.12 固定 URL 已由不可变 GitHub Release 与六项跨平台安装 smoke 验证,可一条命令启动、无需克隆源码。"
  },
  {
    path: "docs/site/2026-08-20-homepage-structure-copy.fable.md",
    before:
      "The v0.1.0-rc.12 fixed URL becomes active only after the GitHub Release appears and all release checks are green; it then starts with one command and no source checkout.",
    after:
      "The immutable v0.1.0-rc.12 GitHub Release has passed all six fixed-URL installation smokes across macOS, Windows, and Linux; it starts with one command and no source checkout."
  },
  {
    path: "deploy/saydo-octoooo-com/docs/index.html",
    before:
      "<p><strong>推荐 · 不克隆源码:</strong>下面是 v0.1.0-rc.12 的发布候选固定 URL;仅当 GitHub Release 页面已经出现且发布检查全绿后才可用。尚未发布到 npm registry 或 Homebrew。</p>",
    after:
      "<p><strong>推荐 · 不克隆源码:</strong>v0.1.0-rc.12 固定 URL 已由不可变 GitHub Release 与 macOS、Windows、Linux 的一次运行 / 全局安装六项 smoke 验证,可直接使用。尚未发布到 npm registry 或 Homebrew。</p>"
  },
  {
    path: "deploy/saydo-octoooo-com/docs/index.html",
    before:
      "源码形态已经可运行;v0.1.0-rc.12 固定 URL 仅在 GitHub Release 出现且发布检查全绿后生效。npm registry / Homebrew",
    after:
      "源码形态已经可运行;v0.1.0-rc.12 固定 URL 已由不可变 GitHub Release 与六项跨平台安装 smoke 验证。npm registry / Homebrew"
  },
  {
    path: "deploy/saydo-octoooo-com/en/docs/index.html",
    before:
      "<p><strong>Recommended · no source checkout:</strong> this is the candidate fixed URL for v0.1.0-rc.12. Use it only after the GitHub Release page appears and all release checks are green. It is not published to the npm registry or Homebrew yet.</p>",
    after:
      "<p><strong>Recommended · no source checkout:</strong> the immutable v0.1.0-rc.12 GitHub Release has passed one-off and global-install smokes on macOS, Windows, and Linux. It is ready to use and is not published to the npm registry or Homebrew yet.</p>"
  },
  {
    path: "deploy/saydo-octoooo-com/en/docs/index.html",
    before:
      "The source form already runs; the v0.1.0-rc.12 fixed URL becomes active only after the GitHub Release appears and all release checks are green. npm registry / Homebrew",
    after:
      "The source form already runs; the immutable v0.1.0-rc.12 GitHub Release has passed all six cross-platform installation smokes. npm registry / Homebrew"
  },
  {
    path: "deploy/saydo-octoooo-com/index.html",
    before:
      "这是 v0.1.0-rc.12 发布候选固定 URL，仅在 GitHub Release 页面出现且发布检查全绿后可用；语音 pipeline 与系统常驻安装不包含在内。",
    after:
      "v0.1.0-rc.12 固定 URL 已由不可变 GitHub Release 与 macOS、Windows、Linux 的六项安装 smoke 验证，可直接使用；语音 pipeline 与系统常驻安装不包含在内。"
  },
  {
    path: "deploy/saydo-octoooo-com/en/index.html",
    before:
      "This is the candidate fixed URL for v0.1.0-rc.12 and works only after the GitHub Release page appears and all release checks are green; it does not include the voice pipeline or service installation.",
    after:
      "The immutable v0.1.0-rc.12 GitHub Release has passed all six installation smokes across macOS, Windows, and Linux and is ready to use; it does not include the voice pipeline or service installation."
  }
];

function availabilityState(expected) {
  const states = [];
  for (const replacement of availabilityReplacements) {
    const content = readFileSync(resolve(repo, replacement.path), "utf8");
    const beforeCount = content.split(replacement.before).length - 1;
    const afterCount = content.split(replacement.after).length - 1;
    invariant(beforeCount + afterCount === 1, `availability 文案锚异常:${replacement.path}`);
    invariant(expected === "candidate" ? beforeCount === 1 : afterCount === 1, `availability 状态不符:${replacement.path}`);
    states.push({ path: replacement.path, state: beforeCount === 1 ? "candidate" : "available" });
  }
  return states;
}

async function fetchBytes(url) {
  let lastError;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: "follow", cache: "no-store" });
      if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (attempt < 6) await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
  }
  throw lastError;
}

async function verifyRelease() {
  const tagLine = gitText(["ls-remote", publicUrl, `refs/tags/${tag}`]);
  const tagSha = tagLine.split(/\s+/)[0];
  invariant(/^[0-9a-f]{40}$/.test(tagSha), `公开 tag 不存在:${tag}`);

  const release = ghJson([
    "release",
    "view",
    tag,
    "--repo",
    repository,
    "--json",
    "tagName,name,body,isDraft,isPrerelease,isImmutable,assets,url,publishedAt"
  ]);
  invariant(release.tagName === tag && release.isDraft === false && release.isPrerelease === true, "Release 状态不是已发布 prerelease");
  invariant(release.isImmutable === true, "Release 尚未进入 immutable 状态");
  const expectedTitle = `SayDo CLI ${version}`;
  const expectedBody = readFileSync(resolve(repo, `docs/release/${tag}.md`), "utf8").trimEnd();
  invariant(release.name === expectedTitle, `Release 标题 readback 不一致:${release.name ?? ""}`);
  invariant((release.body ?? "").trimEnd() === expectedBody, "Release 正文 readback 与冻结 release notes 不一致");
  const tracked = loadTrackedReleaseAssetManifest(repo, tag);
  const assetNames = release.assets.map((asset) => asset.name).sort();
  invariant(JSON.stringify(assetNames) === JSON.stringify([...expectedAssets].sort()), `Release asset exact-set 异常:${assetNames.join(",")}`);
  assertReleaseApiAssetsMatchManifest(release, tracked);

  const collected = await collectPushRuns(
    createGhWorkflowRunPageFetcher({ repo: repository, workflow: "release.yml", execText })
  );
  const unique = evaluateTagWorkflowHistory({
    ...collected,
    tag,
    requirement: { mode: "exactly-one", headSha: tagSha, requireCompleted: true }
  });
  const run = unique.run;
  const runDetail = ghJson(["api", `repos/${repository}/actions/runs/${run.databaseId}`]);
  invariant(runDetail.run_attempt === 1, `release workflow 曾重跑(run_attempt=${runDetail.run_attempt});该 tag 永久不可用`);
  invariant(String(runDetail.id ?? run.databaseId) === String(run.databaseId), "workflow run id readback 不一致");
  invariant(runDetail.head_sha === tagSha, "workflow run head_sha readback 与公开 tag SHA 不一致");
  const runView = ghJson(["run", "view", String(run.databaseId), "--repo", repository, "--json", "jobs"]);
  const jobs = new Map(runView.jobs.map((job) => [job.name, job.conclusion]));
  const requiredJobs = [
    "validate public snapshot tag",
    "release quality (node and audit)",
    "release quality (python)",
    "release quality (fresh-origin e2e)",
    "release distribution (ubuntu-latest)",
    "release distribution (macos-latest)",
    "release distribution (windows-latest)",
    "publish GitHub prerelease",
    ...["ubuntu-latest", "macos-latest", "windows-latest"].flatMap((os) =>
      ["exec", "global"].map((installMode) => `fixed URL smoke (${os}, ${installMode})`)
    )
  ];
  const missingOrFailed = requiredJobs.filter((name) => jobs.get(name) !== "success");
  invariant(missingOrFailed.length === 0, `发布必需 job 未成功:${missingOrFailed.join(",")}`);

  const [checksum, metadataRaw, tarball] = await Promise.all(
    expectedAssets.map((asset) => fetchBytes(new URL(asset, assetBase)))
  );
  const digest = sha256(tarball);
  const metadata = JSON.parse(metadataRaw.toString("utf8"));
  invariant(checksum.toString("utf8") === `${digest}  ${filename}\n`, "线上 SHA256SUMS 与 tgz 不一致");
  invariant(
    metadata.schemaVersion === 3 &&
      metadata.package === "@saydo/cli" &&
      metadata.version === version &&
      metadata.tag === tag &&
      metadata.filename === filename &&
      metadata.sha256 === digest &&
      metadata.bytes === tarball.length &&
      metadata.reproducibleBuilds === 2 &&
      /^[0-9a-f]{64}$/.test(metadata.sourceRevision),
    "线上 metadata 与 tag/tgz 身份不一致"
  );
  assertIdentityMatchesTrackedManifest(metadata, tracked);
  assertAssetsMatchTrackedManifest(
    expectedAssets.map((name, index) => inspectAssetBytes(name, [checksum, metadataRaw, tarball][index])),
    tracked
  );
  return {
    tag,
    tagSha,
    releaseUrl: release.url,
    publishedAt: release.publishedAt,
    workflowRunId: run.databaseId,
    workflowRunAttempt: runDetail.run_attempt,
    workflowUrl: run.url,
    requiredJobs,
    assets: release.assets.map(({ name, size }) => ({ name, size })),
    tarballSha256: digest,
    sourceRevision: metadata.sourceRevision,
    buildId: metadata.buildId,
    protocolVersion: metadata.protocolVersion
  };
}

function minimalVerifierEnv() {
  const env = {};
  for (const key of ["PATH", "TMPDIR", "LANG", "LC_ALL", "SSL_CERT_FILE", "HTTPS_PROXY", "HTTP_PROXY", "NO_PROXY"]) {
    if (process.env[key]) env[key] = process.env[key];
  }
  return env;
}

function sshClientEnv() {
  const env = {};
  for (const key of ["HOME", "USER", "LOGNAME", "SSH_AUTH_SOCK", "LANG", "LC_ALL"]) {
    if (process.env[key]) env[key] = process.env[key];
  }
  return env;
}

function trustedPhysicalTools(releaseTagSha) {
  invariant(gitText(["branch", "--show-current"]) === "main", "availability 实体门只能从 internal main 执行");
  invariant(
    gitText(["status", "--porcelain=v1", "--untracked-files=all"]) === "",
    "availability 实体门启动前要求完整工作树 clean"
  );
  invariant(gitText(["remote", "get-url", "--push", "public"]) === publicUrl, "public remote 指向异常");
  execFileSync("git", ["fetch", "--no-tags", "public", `+${releaseTagSha}:refs/remotes/public/release-${tag}`], {
    cwd: repo,
    stdio: ["ignore", "ignore", "pipe"]
  });
  const toolPaths = physicalToolClosure(repo);
  try {
    execFileSync("git", ["diff", "--quiet", releaseTagSha, "HEAD", "--", ...toolPaths], {
      cwd: repo,
      stdio: "ignore"
    });
  } catch {
    throw new Error("availability 实体门代码与 immutable release tag 不一致");
  }
  const manifest = JSON.parse(readFileSync(resolve(repo, "research/week-audit/2026-08-23-publication-manifest.json"), "utf8"));
  invariant(
    manifest.schemaVersion === 2 && /^[0-9a-f]{40}$/.test(manifest.implementationBoundary ?? ""),
    "公开发布 manifest 缺稳定实施边界"
  );
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", manifest.implementationBoundary, "HEAD"], {
      cwd: repo,
      stdio: "ignore"
    });
  } catch {
    throw new Error("availability HEAD 不包含已审实施边界");
  }
  const worktreeHashes = hashClosureFiles(repo, toolPaths);
  const tagHashes = Object.fromEntries(
    toolPaths.map((path) => {
      let bytes;
      try {
        bytes = execFileSync("git", ["show", `${releaseTagSha}:${path}`], { cwd: repo, maxBuffer: 32 * 1024 * 1024 });
      } catch {
        throw new Error(`immutable tag 缺实体门闭包:${path}`);
      }
      return [path, sha256(bytes)];
    })
  );
  const fingerprints = assertPhysicalToolFingerprints({
    files: toolPaths,
    worktreeHashes,
    tagHashes,
    publicationEntries: manifest.entries ?? []
  });
  return { implementationBoundary: manifest.implementationBoundary, fingerprints };
}

function parseVerifierOutput(output, key) {
  let evidence;
  try {
    evidence = JSON.parse(output.trim());
  } catch {
    // 附带原文长度与首尾片段:rc.10 实体门在此失败时旧文案连 stdout 是空是脏都看不出,
    // 定位靠翻查 stderr 正文才发现 -File 未命中。
    const head = JSON.stringify(output.slice(0, 200));
    const tail = JSON.stringify(output.slice(-200));
    throw new Error(`固定 URL verifier stdout 不是单一 JSON:${key}:len=${output.length}:head=${head}:tail=${tail}`);
  }
  return evidence;
}

function physicalExpected(releaseEvidence, tools, spec, challenge, path, gateRunId) {
  return {
    key: spec.key,
    path,
    platform: spec.platform,
    installMode: spec.installMode,
    packageUrl: new URL(filename, assetBase).toString(),
    tag,
    tarballSha256: releaseEvidence.tarballSha256,
    sourceRevision: releaseEvidence.sourceRevision,
    buildId: releaseEvidence.buildId,
    protocolVersion: releaseEvidence.protocolVersion,
    publishedAt: releaseEvidence.publishedAt,
    challenge,
    verifierSha256: tools.fingerprints["scripts/verify-release-url.mjs"],
    gateRunId,
    transport: spec.transport,
    implementationBoundary: tools.implementationBoundary,
    releaseTagSha: releaseEvidence.tagSha,
    toolFingerprints: tools.fingerprints
  };
}

function wrapPhysicalEvidence(raw, expected, transportDetails) {
  const evidence = {
    ...raw,
    schemaVersion: 2,
    provenance: {
      gateRunId: expected.gateRunId,
      challenge: expected.challenge,
      transport: expected.transport,
      verifierSha256: expected.verifierSha256,
      implementationBoundary: expected.implementationBoundary,
      releaseTagSha: expected.releaseTagSha,
      toolFingerprints: expected.toolFingerprints,
      ...transportDetails
    }
  };
  validatePhysicalReleaseEvidence(evidence, expected);
  return evidence;
}

function runLocalPhysical(releaseEvidence, tools, spec, gateRunId, challenge) {
  const expected = physicalExpected(releaseEvidence, tools, spec, challenge, spec.path, gateRunId);
  const output = execFileSync(
    process.execPath,
    [resolve(repo, "scripts/verify-release-url.mjs"), expected.packageUrl, spec.installMode, "--challenge", challenge],
    {
      cwd: repo,
      env: minimalVerifierEnv(),
      encoding: "utf8",
      timeout: 20 * 60_000,
      maxBuffer: 8 * 1024 * 1024,
      stdio: ["ignore", "pipe", "inherit"]
    }
  );
  const raw = parseVerifierOutput(output, spec.key);
  validatePhysicalReleaseRun(raw, expected);
  return wrapPhysicalEvidence(raw, expected, { targetFingerprint: sha256(`local\0${raw.hostFingerprint}`) });
}

function pinnedSshConfig() {
  invariant(process.platform === "darwin" && process.env.GITHUB_ACTIONS !== "true", "实体门必须从交互式 Mac 发起");
  invariant(
    typeof physicalEvidenceDir === "string" &&
      /^e2e\/evidence\/[A-Za-z0-9][A-Za-z0-9._/-]*[A-Za-z0-9]$/.test(physicalEvidenceDir) &&
      !physicalEvidenceDir.includes("//") &&
      !physicalEvidenceDir.split("/").includes(".."),
    "实体证据目录必须位于 e2e/evidence 且不可穿越"
  );
  const hostMatch = /^([A-Za-z0-9._-]+)@((?:[0-9]{1,3}\.){3}[0-9]{1,3})$/.exec(windowsHost ?? "");
  invariant(hostMatch, "Windows SSH 目标必须是 user@literal-ip");
  const octets = hostMatch[2].split(".").map(Number);
  invariant(octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255), "Windows literal IP 非法");
  invariant(
    /^[A-Za-z]:[\\/].+\.exe$/i.test(windowsNode ?? "") &&
      !/[\u0000-\u001f]/u.test(windowsNode ?? "") &&
      windowsNode.length <= 260,
    "Windows node 必须是合法绝对 .exe 路径"
  );
  invariant(["/usr/bin/ssh", "/usr/bin/scp", "/usr/bin/ssh-keygen"].every(existsSync), "缺少系统 OpenSSH 工具");
  const requestedKnownHosts = resolve(windowsKnownHosts);
  const requestedStat = lstatSync(requestedKnownHosts);
  invariant(requestedStat.isFile() && !requestedStat.isSymbolicLink(), "known_hosts 必须是常规文件且不可为 symlink");
  const knownHosts = realpathSync(requestedKnownHosts);
  invariant(!knownHosts.startsWith(`${repo}${sep}`), "known_hosts 必须位于仓库外");
  const knownStat = statSync(knownHosts);
  if (typeof process.getuid === "function") invariant(knownStat.uid === process.getuid(), "known_hosts owner 不是当前用户");
  invariant((knownStat.mode & 0o077) === 0, "known_hosts 权限必须收紧为 owner-only");
  const hostKey = execFileSync("/usr/bin/ssh-keygen", ["-F", hostMatch[2], "-f", knownHosts], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  invariant(hostKey.trim() !== "", "known_hosts 未固定 Windows literal IP");
  const options = [
    "-F", "/dev/null",
    "-o", "BatchMode=yes",
    "-o", "StrictHostKeyChecking=yes",
    "-o", `UserKnownHostsFile=${knownHosts}`,
    "-o", "GlobalKnownHostsFile=/dev/null",
    "-o", "IdentitiesOnly=yes",
    "-o", "ClearAllForwardings=yes",
    "-o", "ForwardAgent=no",
    "-o", "PermitLocalCommand=no",
    "-o", "ProxyCommand=none",
    "-o", "ProxyJump=none",
    "-o", "ControlMaster=no",
    "-o", "ControlPath=none",
    "-o", "RequestTTY=no",
    "-o", "PasswordAuthentication=no",
    "-o", "KbdInteractiveAuthentication=no",
    "-o", "NumberOfPasswordPrompts=0",
    "-o", "ConnectTimeout=15",
    "-o", "ConnectionAttempts=1",
    "-o", "LogLevel=ERROR"
  ];
  return {
    host: windowsHost,
    node: windowsNode,
    options,
    targetFingerprint: sha256(`ssh-target\0${windowsHost}`),
    hostKeyFingerprint: sha256(hostKey)
  };
}

function sshText(sshConfig, command, options = {}) {
  return execFileSync("/usr/bin/ssh", [...sshConfig.options, sshConfig.host, command], {
    env: sshClientEnv(),
    encoding: "utf8",
    timeout: options.timeout ?? 60_000,
    maxBuffer: 8 * 1024 * 1024,
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"]
  });
}

function parseRemoteHashes(output) {
  const hashes = {};
  for (const line of output.split(/\r?\n/u).map((item) => item.trim()).filter(Boolean)) {
    const match = /^([A-Za-z0-9./_-]+)=([0-9a-f]{64})$/i.exec(line);
    invariant(match, `远端闭包 digest 行非法:${line}`);
    hashes[match[1].replaceAll("\\", "/")] = match[2].toLowerCase();
  }
  return hashes;
}

function runWindowsPhysical(releaseEvidence, tools, specs, gateRunId, sshConfig) {
  const root = windowsRemoteRootName(gateRunId);
  const files = windowsVerifierClosure(repo);
  const expectedHashes = Object.fromEntries(
    files.map((path) => {
      invariant(tools.fingerprints[path], `Windows 闭包未进入 toolFingerprints:${path}`);
      return [path, tools.fingerprints[path]];
    })
  );
  assertClosureFingerprints(hashClosureFiles(repo, files), expectedHashes, "local windows verifier");
  const stagingParent = mkdtempSync(join(tmpdir(), "saydo-win-verifier-"));
  const staging = join(stagingParent, root);
  let runError;
  let results;
  try {
    materializeClosure(repo, files, staging, { failIfExists: true });
    sshText(
      sshConfig,
      `powershell.exe -NoLogo -NoProfile -NonInteractive -Command "if (Test-Path -LiteralPath '${root}') { throw 'remote root exists' }; New-Item -ItemType Directory -Path '${root}' | Out-Null"`
    );
    execFileSync("/usr/bin/scp", [...sshConfig.options, "-r", `${staging}/.`, `${sshConfig.host}:${root}/`], {
      env: sshClientEnv(),
      timeout: 60_000,
      stdio: ["ignore", "ignore", "inherit"]
    });
    const hashCommand = files
      .map((relative) => {
        const win = relative.replaceAll("/", "\\\\");
        return `Write-Output ('${relative}=' + ((Get-FileHash -Algorithm SHA256 -LiteralPath '${win}').Hash.ToLower()))`;
      })
      .join("; ");
    const remoteHashes = parseRemoteHashes(
      sshText(
        sshConfig,
        `powershell.exe -NoLogo -NoProfile -NonInteractive -Command "Set-Location -LiteralPath '${root}'; ${hashCommand}"`
      )
    );
    assertClosureFingerprints(remoteHashes, expectedHashes, "remote windows verifier");
    results = specs.map((spec) => {
      const challenge = createHash("sha256").update(`${gateRunId}\0${spec.key}\0${randomUUID()}`).digest("hex");
      const expected = physicalExpected(releaseEvidence, tools, spec, challenge, spec.path, gateRunId);
      const verifierPath = assertSafeRemoteVerifierPath(WINDOWS_VERIFIER_RELATIVE_PATH);
      const request = Buffer.from(JSON.stringify({
        schemaVersion: 1,
        tag,
        packageUrl: expected.packageUrl,
        installMode: spec.installMode,
        challenge,
        nodePath: sshConfig.node,
        verifierPath
      }), "utf8").toString("base64url");
      invariant(/^[A-Za-z0-9_-]+$/.test(request), "Windows verifier 请求编码非法");
      const powershell = [
        "powershell.exe",
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        WINDOWS_WRAPPER_RELATIVE_PATH.replaceAll("/", "\\"),
        request
      ];
      // 整段 cd&&powershell 必须包内层引号:Windows sshd(DefaultShell=cmd)会把无引号的
      // 命令串交给外层 cmd 解析,&& 被外层切开后 cd 只作用于瞬时内层 cmd,powershell 在
      // home 下找不到 scripts\...ps1;而 PowerShell -File 目标不存在时退出码为 0,
      // 于是 ssh exit=0 + stdout 空,上层只见「不是单一 JSON」(2026-08-26 rc.10 实体门
      // 两次复现,带引号形态经真机重放实证可用)。此路径 CI 不跑,rc.10 前从未被执行过。
      const remoteCommand = ["cmd.exe", "/d", "/c", `"cd /d ${root} && ${powershell.join(" ")}"`].join(" ");
      const output = sshText(sshConfig, remoteCommand, { timeout: 20 * 60_000, stdio: ["ignore", "pipe", "inherit"] });
      const raw = parseVerifierOutput(output, spec.key);
      validatePhysicalReleaseRun(raw, expected);
      return wrapPhysicalEvidence(raw, expected, {
        targetFingerprint: sshConfig.targetFingerprint,
        sshHostKeyFingerprint: sshConfig.hostKeyFingerprint,
        remoteRoot: root,
        closureFingerprints: expectedHashes
      });
    });
  } catch (error) {
    runError = error;
  } finally {
    let cleanupError;
    try {
      sshText(
        sshConfig,
        `cmd.exe /d /c "if exist ${root} rmdir /s /q ${root} & if exist ${root} exit 8"`,
        { timeout: 30_000 }
      );
    } catch (error) {
      cleanupError = error;
    }
    rmSync(stagingParent, { recursive: true, force: true });
    if (cleanupError) {
      throw runError
        ? new AggregateError([runError, cleanupError], "Windows verifier 运行失败且远端闭包未清理")
        : cleanupError;
    }
  }
  if (runError) throw runError;
  return results;
}

function persistPhysicalEvidence(records, writeDir) {
  const outputDir = resolve(repo, physicalEvidenceDir);
  invariant(!existsSync(outputDir), `实体证据目录已存在,拒绝覆盖:${physicalEvidenceDir}`);
  const files = records.map(({ spec, evidence }) => {
    const filename = spec.path.split("/").at(-1);
    invariant(filename && !filename.includes("..") && !filename.includes("/"), `实体证据文件名非法:${spec.path}`);
    return { name: filename, content: Buffer.from(`${JSON.stringify(evidence, null, 2)}\n`) };
  });
  writeDir(outputDir, files);
}

function verifyPhysicalEvidence(releaseEvidence) {
  const tools = trustedPhysicalTools(releaseEvidence.tagSha);
  const sshConfig = pinnedSshConfig();
  const gateRunId = randomUUID();
  const outputDir = physicalEvidenceDir.replace(/\/$/u, "");
  const specs = [
    { key: "macExec", platform: "darwin", installMode: "exec", transport: "local_process", path: `${outputDir}/mac-exec.json` },
    { key: "macGlobal", platform: "darwin", installMode: "global", transport: "local_process", path: `${outputDir}/mac-global.json` },
    { key: "windowsExec", platform: "win32", installMode: "exec", transport: "pinned_ssh", path: `${outputDir}/windows-exec.json` },
    { key: "windowsGlobal", platform: "win32", installMode: "global", transport: "pinned_ssh", path: `${outputDir}/windows-global.json` }
  ];
  invariant(!existsSync(resolve(repo, outputDir)), `实体证据目录已存在,拒绝预制输入:${outputDir}`);
  const localRecords = specs.slice(0, 2).map((spec) => {
    const challenge = createHash("sha256").update(`${gateRunId}\0${spec.key}\0${randomUUID()}`).digest("hex");
    return { spec, evidence: runLocalPhysical(releaseEvidence, tools, spec, gateRunId, challenge) };
  });
  const windowsRecords = runWindowsPhysical(releaseEvidence, tools, specs.slice(2), gateRunId, sshConfig)
    .map((evidence, index) => ({ spec: specs[index + 2], evidence }));
  const records = [...localRecords, ...windowsRecords];
  const testedAt = records.map(({ evidence }) => Date.parse(evidence.testedAt));
  invariant(Math.max(...testedAt) - Math.min(...testedAt) <= 45 * 60_000, "四项实体复验不在同一短时间窗");
  invariant(records[0].evidence.hostFingerprint === records[1].evidence.hostFingerprint, "Mac exec/global 不是同一主机");
  invariant(records[2].evidence.hostFingerprint === records[3].evidence.hostFingerprint, "Windows exec/global 不是同一 SSH 主机");
  invariant(records[0].evidence.hostFingerprint !== records[2].evidence.hostFingerprint, "Mac/Windows 主机指纹异常相同");
  return records.map(({ spec, evidence }) => ({
    spec,
    evidence,
    validated: validatePhysicalReleaseEvidence(
      evidence,
      physicalExpected(releaseEvidence, tools, spec, evidence.challenge, spec.path, gateRunId)
    )
  }));
}

function availabilitySnapshotPaths() {
  return [
    ...new Set(availabilityReplacements.map((item) => resolve(repo, item.path))),
    resolve(repo, evidencePath),
    resolve(repo, physicalEvidenceDir),
    ...WEEK_AUDIT_WRITE_OUTPUTS.map((path) => resolve(repo, path))
  ];
}

function assertAvailabilityWorkspace(expectedHead) {
  invariant(gitText(["branch", "--show-current"]) === "main", "availability 事务前 branch 不是 main");
  invariant(gitText(["rev-parse", "HEAD"]) === expectedHead, "availability 事务前 HEAD 漂移");
  invariant(
    gitText(["status", "--porcelain=v1", "--untracked-files=all"]) === "",
    "availability 事务前工作树或 index 不干净"
  );
}

function exactPublicMain(releaseTagSha) {
  invariant(gitText(["remote", "get-url", "--push", "public"]) === publicUrl, "public remote 指向异常");
  const remoteLine = gitText(["ls-remote", publicUrl, "refs/heads/main"]);
  const publicMain = remoteLine.split(/\s+/)[0];
  invariant(/^[0-9a-f]{40}$/.test(publicMain), "公开 main 不存在");
  execFileSync("git", ["fetch", "--no-tags", "public", `+${publicMain}:refs/remotes/public/main`], {
    cwd: repo,
    stdio: ["ignore", "inherit", "inherit"]
  });
  const declaredTree = gitText(["show", "-s", "--format=%B", publicMain])
    .split("\n")
    .find((line) => line.startsWith("public-tree: "))
    ?.slice("public-tree: ".length);
  const declaredFilter = gitText(["show", "-s", "--format=%B", publicMain])
    .split("\n")
    .find((line) => line.startsWith("filter-version: "))
    ?.slice("filter-version: ".length);
  invariant(declaredTree === gitText(["rev-parse", `${publicMain}^{tree}`]), "公开 main 的 public-tree 声明不匹配");
  invariant(declaredFilter === "public-exclude-v1", "公开 main 的 filter-version 异常");
  const snapshotSubject = gitText(["show", "-s", "--format=%s", publicMain]);
  const declaredInternal = snapshotSubject.match(/^snapshot: \d{4}-\d{2}-\d{2} from internal ([0-9a-f]{40})$/)?.[1];
  invariant(declaredInternal === gitText(["rev-parse", "HEAD"]), "公开 main 未绑定当前 availability internal SHA");
  const fields = execFileSync("git", ["diff", "--name-status", "-z", "HEAD", publicMain], {
    cwd: repo,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"]
  }).split("\0").filter(Boolean);
  const changes = [];
  for (let index = 0; index < fields.length; ) {
    const status = fields[index++];
    if (/^[RC]/.test(status)) {
      changes.push({ status, from: fields[index++], path: fields[index++] });
    } else {
      changes.push({ status, path: fields[index++] });
    }
  }
  invariant(
    changes.every((change) => change.status === "D" && change.path.startsWith("artifacts/release/copyright/")),
    `公开 main 与 internal HEAD 全树不一致:${JSON.stringify(changes)}`
  );
  const expectedPrivatePaths = gitText([
    "ls-tree",
    "-r",
    "--name-only",
    "HEAD",
    "--",
    "artifacts/release/copyright"
  ]).split("\n").filter(Boolean).sort();
  const publicPrivatePaths = gitText([
    "ls-tree",
    "-r",
    "--name-only",
    publicMain,
    "--",
    "artifacts/release/copyright"
  ]).split("\n").filter(Boolean);
  const deletedPrivatePaths = changes.map((change) => change.path).sort();
  invariant(publicPrivatePaths.length === 0, `公开 main 泄露私有登记路径:${publicPrivatePaths.join(",")}`);
  invariant(
    JSON.stringify(deletedPrivatePaths) === JSON.stringify(expectedPrivatePaths),
    "公开 main 的私有路径删除集不是 internal HEAD 的完整 exact-set"
  );
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", releaseTagSha, publicMain], { cwd: repo, stdio: "ignore" });
  } catch {
    throw new Error("公开 availability main 未继承 immutable release tag 快照");
  }
  for (const path of ["deploy/saydo-octoooo-com", "deploy/link-saydo-octoooo-com"]) {
    try {
      execFileSync("git", ["diff", "--quiet", publicMain, "HEAD", "--", path], { cwd: repo, stdio: "ignore" });
    } catch {
      throw new Error(`部署目录尚未进入公开 main:${path}`);
    }
  }
  return publicMain;
}

function verifyPublicCi(publicMain) {
  const runs = ghJson([
    "run",
    "list",
    "--repo",
    repository,
    "--workflow",
    "ci.yml",
    "--event",
    "push",
    "--branch",
    "main",
    "--limit",
    "50",
    "--json",
    "databaseId,headSha,headBranch,status,conclusion,url"
  ]);
  const run = runs.find((row) => row.headSha === publicMain && row.headBranch === "main");
  invariant(run, `未找到精确绑定 public/main ${publicMain} 的 CI`);
  invariant(run.status === "completed" && run.conclusion === "success", `public/main CI 未全绿:${run.status}/${run.conclusion}`);
  const runView = ghJson(["run", "view", String(run.databaseId), "--repo", repository, "--json", "jobs"]);
  const nodeJob = runView.jobs.find((job) => job.name === "node");
  invariant(nodeJob?.conclusion === "success", "public/main 的 audit bundle 所在 node job 未成功");
  return { workflowRunId: run.databaseId, workflowUrl: run.url, headSha: publicMain, nodeJob: nodeJob.name };
}

function officialPages() {
  return [
    { project: "saydo", host: "saydo.octoooo.com", url: "https://saydo.octoooo.com/", marker: "v0.1.0-rc.12 固定 URL 已由不可变 GitHub Release" },
    { project: "saydo", host: "saydo.octoooo.com", url: "https://saydo.octoooo.com/docs/", marker: "不可变 GitHub Release 与 macOS、Windows、Linux" },
    { project: "saydo", host: "saydo.octoooo.com", url: "https://saydo.octoooo.com/en/", marker: "immutable v0.1.0-rc.12 GitHub Release" },
    { project: "saydo", host: "saydo.octoooo.com", url: "https://saydo.octoooo.com/en/docs/", marker: "immutable v0.1.0-rc.12 GitHub Release" },
    { project: "saydo-link", host: "link.saydo.octoooo.com", url: "https://link.saydo.octoooo.com/", marker: "https://saydo.octoooo.com" }
  ];
}

async function deploySites(releaseEvidence) {
  availabilityState("available");
  invariant(gitText(["branch", "--show-current"]) === "main", "官网部署只能从 internal main 执行");
  invariant(gitText(["status", "--porcelain=v1"]) === "", "官网部署要求完整工作树 clean");
  invariant(gitText(["remote", "get-url", "--push", "origin"]) === originUrl, "origin push URL 指向异常");
  const originMain = gitText(["ls-remote", originUrl, "refs/heads/main"]).split(/\s+/u)[0];
  invariant(/^[0-9a-f]{40}$/.test(originMain), "实时 origin/main 不存在");
  invariant(gitText(["rev-parse", "HEAD"]) === originMain, "部署 HEAD 尚未推送到实时 origin/main");
  const { accountId, apiToken } = requireCloudflareCredentials(process.env);
  const publicMain = exactPublicMain(releaseEvidence.tagSha);
  const publicCi = verifyPublicCi(publicMain);
  const evidenceAbsolute = resolve(repo, evidencePath);
  const lease = acquireDeployEvidenceLease(evidenceAbsolute);
  const sites = [
    {
      directory: "deploy/saydo-octoooo-com",
      project: "saydo",
      previewBranch: `preview-${tag}`,
      productionBranch: "main"
    },
    {
      directory: "deploy/link-saydo-octoooo-com",
      project: "saydo-link",
      previewBranch: `preview-${tag}`,
      productionBranch: "main"
    }
  ];
  return runPagesDeployStateMachine({
    evidenceSeed: { release: releaseEvidence, publicMain, publicCi },
    sites,
    wrangler: async ({ directory, project, branch, commitHash, stage }) =>
      execText("pnpm", [
        "exec",
        "wrangler",
        "pages",
        "deploy",
        directory,
        "--project-name",
        project,
        "--branch",
        branch,
        "--commit-hash",
        commitHash,
        "--commit-message",
        `${stage} ${tag}`,
        "--commit-dirty=false"
      ]),
    listDeployments: async ({ project, environment }) =>
      listPagesDeployments({ accountId, apiToken, project, environment }),
    readProject: async ({ project }) => getPagesProject({ accountId, apiToken, project }),
    fetchHttp: async (url) => {
      const body = await fetchBytes(url);
      return { ok: true, status: 200, url, body: body.toString("utf8") };
    },
    persist: async (evidence) => {
      persistDeployEvidence(evidence, lease);
    },
    audit: refreshAuditBundle,
    officialPages: officialPages(),
    lease
  });
}

function persistDeployEvidence(evidence, lease) {
  const snapshot = persistClaimedDeployEvidence(lease, evidence);
  const text = JSON.stringify(snapshot, null, 2);
  if (/Bearer/i.test(text) || /ghp_[A-Za-z0-9]+/.test(text) || /github_pat_[A-Za-z0-9_]+/.test(text)) {
    throw new Error("部署证据含不可信字段");
  }
  console.log(text);
  return snapshot;
}

function persistEvidence(evidence, writeAtomic = writeFileAtomic) {
  const result = { schemaVersion: 1, verifiedAt: evidence.verifiedAt ?? new Date().toISOString(), ...evidence };
  if (evidencePath) {
    writeAtomic(resolve(repo, evidencePath), Buffer.from(`${JSON.stringify(result, null, 2)}\n`));
  }
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function refreshAuditBundle() {
  execFileSync(process.execPath, [resolve(repo, "scripts/week-audit.mjs"), "--write"], {
    cwd: repo,
    stdio: "inherit"
  });
  execFileSync(process.execPath, [resolve(repo, "scripts/week-audit.mjs"), "--check"], {
    cwd: repo,
    stdio: "inherit"
  });
}

if (mode === "--check-candidate") {
  const tracked = loadTrackedReleaseAssetManifest(repo, tag);
  persistEvidence({
    tag,
    availability: availabilityState("candidate"),
    trackedManifest: {
      schema: tracked.schema,
      tag: tracked.tag,
      package: tracked.package,
      version: tracked.version
    }
  });
} else {
  const releaseEvidence = await verifyRelease();
  if (mode === "--verify") {
    persistEvidence({ ...releaseEvidence, availability: availabilityState("candidate") });
  } else if (mode === "--write-availability") {
    const physicalRecords = verifyPhysicalEvidence(releaseEvidence);
    const expectedHead = gitText(["rev-parse", "HEAD"]);
    await runMutationsWithRollback({
      snapshotPaths: availabilitySnapshotPaths(),
      preflight: ({ snapshot }) => {
        assertAvailabilityWorkspace(expectedHead);
        applyAvailabilityReplacementsFromSnapshot(snapshot, availabilityReplacements, repo);
      },
      mutate: async ({ snapshot, writeAtomic, writeDirAtomic }) => {
        const { writes } = applyAvailabilityReplacementsFromSnapshot(snapshot, availabilityReplacements, repo);
        persistPhysicalEvidence(physicalRecords, writeDirAtomic);
        for (const item of writes) writeAtomic(item.path, item.content);
        persistEvidence(
          {
            ...releaseEvidence,
            physicalEvidence: physicalRecords.map((row) => row.validated),
            availability: availabilityState("available")
          },
          writeAtomic
        );
        // 新写的实体证据在 index 之外,而 refreshAuditBundle 内的
        // capturePublicationManifest 要求应发布源全部入 index(rc.11 实体门在此自拦,
        // 四项真机实跑全绿后功亏一篑)。先 add 再刷账本;失败时对称撤销暂存,
        // 文件内容由外层 snapshot rollback 恢复。
        const stagedPaths = [evidencePath, physicalEvidenceDir];
        gitText(["add", "--", ...stagedPaths]);
        try {
          refreshAuditBundle();
        } catch (error) {
          try {
            gitText(["reset", "-q", "--", ...stagedPaths]);
          } catch {
            // reset 失败不掩盖主错误
          }
          throw error;
        }
      }
    });
  } else {
    await deploySites(releaseEvidence);
  }
}
