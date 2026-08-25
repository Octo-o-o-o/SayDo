#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertAssetsMatchTrackedManifest,
  assertIdentityMatchesTrackedManifest,
  freezeTrackedReleaseAssetManifest,
  inspectReleaseAssetDir,
  loadTrackedReleaseAssetManifest
} from "./release-asset-manifest.mjs";

const mode = process.argv[2];
if (!["--write", "--check", "--freeze"].includes(mode)) {
  console.error("用法:node scripts/build-release-artifacts.mjs <--write|--freeze|--check>");
  process.exit(2);
}

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = join(repo, "packages", "cli");
const pkg = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
if (pkg.name !== "@saydo/cli" || !/^0\.1\.0-rc\.\d+$/.test(pkg.version)) {
  throw new Error(`发布包身份非法:${String(pkg.name)}@${String(pkg.version)}`);
}

const releaseDir = join(repo, "artifacts", "release", "github", `v${pkg.version}`);
const expectedFilename = `saydo-cli-${pkg.version}.tgz`;
const tarball = join(releaseDir, expectedFilename);
const checksumFile = join(releaseDir, "SHA256SUMS");
const metadataFile = join(releaseDir, "release-metadata.json");
const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const npmIntegrity = (path) => `sha512-${createHash("sha512").update(readFileSync(path)).digest("base64")}`;
const packageDocuments = ["LICENSE", "NOTICE", "README.md", "THIRD_PARTY_NOTICES.md", "package.json"];

function listFiles(root, prefix = "") {
  return readdirSync(root, { withFileTypes: true })
    .flatMap((entry) => {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) return listFiles(join(root, entry.name), relative);
      if (!entry.isFile()) throw new Error(`当前 dist 含非普通文件:${relative}`);
      return [relative];
    })
    .sort();
}

function expectedPackedPaths() {
  return [...packageDocuments, ...listFiles(join(packageRoot, "dist"), "dist")].sort();
}

function npmCommand() {
  if (process.platform !== "win32") return { file: "npm", prefix: [] };
  const cli = join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
  if (!existsSync(cli)) throw new Error(`npm-cli.js 未找到:${cli}`);
  return { file: process.execPath, prefix: [cli] };
}

function validatePackedFiles(files) {
  const paths = files.map((file) => file.path).sort();
  if (files.some((file) => file.mode !== undefined && file.mode !== 0o644)) {
    throw new Error("release tarball 文件 mode 不是固定 0644");
  }
  const expected = expectedPackedPaths();
  if (new Set(paths).size !== paths.length || JSON.stringify(paths) !== JSON.stringify(expected)) {
    throw new Error(`release tarball 文件 exact-set 漂移:${JSON.stringify({ expected, actual: paths })}`);
  }
}

function buildCurrentSource() {
  const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  execFileSync(pnpm, ["--filter", "@saydo/cli", "build"], { cwd: repo, stdio: "inherit" });
  return JSON.parse(readFileSync(join(packageRoot, "dist", "build-metadata.json"), "utf8"));
}

function archivedBuildMetadata() {
  try {
    const raw = execFileSync("tar", ["-xOf", tarball, "package/dist/build-metadata.json"], {
      cwd: repo,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    });
    return JSON.parse(raw);
  } catch {
    throw new Error("release tarball 缺 build-metadata.json；它是旧包或已损坏，必须从当前源码重建");
  }
}

function verifyArchiveAgainstCurrentBuild() {
  const archiveEntries = execFileSync("tar", ["-tzf", tarball], {
    cwd: repo,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024
  })
    .split(/\r?\n/u)
    .filter((entry) => entry !== "");
  const verboseEntries = execFileSync("tar", ["-tvzf", tarball], {
    cwd: repo,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024
  })
    .split(/\r?\n/u)
    .filter((entry) => entry !== "");
  if (archiveEntries.length !== verboseEntries.length) {
    throw new Error("release tarball 普通/详细目录成员数量不一致");
  }
  if (new Set(archiveEntries).size !== archiveEntries.length) {
    throw new Error("release tarball 含重复成员");
  }
  if (archiveEntries.some((entry) => entry.endsWith("/"))) {
    throw new Error("release tarball 不允许目录成员；npm pack 当前合同是普通文件 exact-set");
  }
  const entries = archiveEntries.map((entry, index) => {
    if (!entry.startsWith("package/")) throw new Error(`release tarball 成员缺 package/ 前缀:${entry}`);
    const path = entry.slice("package/".length);
    if (path.split("/").some((segment) => segment === "" || segment === "." || segment === "..")) {
      throw new Error(`release tarball 成员路径非法:${entry}`);
    }
    const mode = verboseEntries[index].trim().split(/\s+/u)[0];
    if (mode !== "-rw-r--r--") throw new Error(`release tarball 文件类型或 mode 非固定普通文件 0644:${entry}:${mode}`);
    return { entry, path, mode: 0o644 };
  });
  validatePackedFiles(entries);
  for (const file of entries) {
    const currentPath = join(packageRoot, file.path);
    if (!existsSync(currentPath) || !statSync(currentPath).isFile()) {
      throw new Error(`当前构建缺普通文件 tarball 成员:${file.entry}`);
    }
    const archived = execFileSync("tar", ["-xOf", tarball, file.entry], {
      cwd: repo,
      maxBuffer: 16 * 1024 * 1024
    });
    const current = readFileSync(currentPath);
    if (!archived.equals(current)) throw new Error(`release tarball 成员与当前构建不一致:${file.entry}`);
  }
  return entries.length;
}

function trackedIdentityFromMetadata(metadata, current) {
  return {
    package: metadata.package,
    version: metadata.version,
    tag: metadata.tag,
    sourceRevision: current.sourceRevision,
    buildId: current.buildId,
    protocolVersion: current.protocolVersion
  };
}

const currentBuild = buildCurrentSource();

if (mode === "--write" || mode === "--freeze") {
  rmSync(releaseDir, { recursive: true, force: true });
  mkdirSync(releaseDir, { recursive: true });
  const npm = npmCommand();
  const scratch = mkdtempSync(join(tmpdir(), "saydo-release-build-"));
  const destinations = [join(scratch, "a"), join(scratch, "b")];
  let packed;
  try {
    const results = destinations.map((destination) => {
      mkdirSync(destination, { recursive: true });
      const raw = execFileSync(
        npm.file,
        [...npm.prefix, "pack", "--ignore-scripts", "--json", "--pack-destination", destination],
        {
          cwd: packageRoot,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "inherit"],
          env: {
            ...process.env,
            npm_config_cache: join(scratch, "npm-cache"),
            npm_config_logs_dir: join(scratch, "npm-logs")
          }
        }
      );
      const result = JSON.parse(raw)[0];
      if (result?.filename !== expectedFilename) throw new Error(`tarball 文件名不一致:${String(result?.filename)}`);
      validatePackedFiles(result.files ?? []);
      return { result, path: join(destination, expectedFilename) };
    });
    const first = readFileSync(results[0].path);
    const second = readFileSync(results[1].path);
    if (!first.equals(second)) throw new Error("两次隔离 npm pack 的 tgz 字节不一致，拒绝发布不可复现资产");
    packed = results[0].result;
    copyFileSync(results[0].path, tarball);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  const digest = sha256(tarball);
  const integrity = npmIntegrity(tarball);
  if (packed.integrity !== integrity) throw new Error("npm pack 返回的 integrity 与 tgz 实际字节不一致");
  const size = statSync(tarball).size;
  writeFileSync(checksumFile, `${digest}  ${expectedFilename}\n`);
  writeFileSync(
    metadataFile,
    `${JSON.stringify(
      {
        schemaVersion: 3,
        package: pkg.name,
        version: pkg.version,
        tag: `v${pkg.version}`,
        filename: expectedFilename,
        sha256: digest,
        bytes: size,
        npmIntegrity: integrity,
        entryCount: packed.entryCount,
        reproducibleBuilds: 2,
        sourceRevision: currentBuild.sourceRevision,
        buildId: currentBuild.buildId,
        protocolVersion: currentBuild.protocolVersion
      },
      null,
      2
    )}\n`
  );
  console.log(`[ok] release artifact: ${expectedFilename} bytes=${size} sha256=${digest}`);
  if (mode === "--freeze") {
    const metadata = JSON.parse(readFileSync(metadataFile, "utf8"));
    freezeTrackedReleaseAssetManifest(repo, {
      ...trackedIdentityFromMetadata(metadata, currentBuild),
      assets: inspectReleaseAssetDir(releaseDir, pkg.version)
    });
    console.log(`[ok] frozen tracked manifest: docs/release/v${pkg.version}-assets.json`);
  }
  process.exit(0);
}

for (const path of [tarball, checksumFile, metadataFile]) {
  if (!existsSync(path)) throw new Error(`缺少 release artifact:${path}`);
}
const metadata = JSON.parse(readFileSync(metadataFile, "utf8"));
const archivedBuild = archivedBuildMetadata();
const archiveEntryCount = verifyArchiveAgainstCurrentBuild();
const digest = sha256(tarball);
const integrity = npmIntegrity(tarball);
const expectedChecksum = `${digest}  ${expectedFilename}\n`;
if (readFileSync(checksumFile, "utf8") !== expectedChecksum) throw new Error("SHA256SUMS 与 tarball 不一致");
if (
  metadata.schemaVersion !== 3 ||
  metadata.package !== pkg.name ||
  metadata.version !== pkg.version ||
  metadata.tag !== `v${pkg.version}` ||
  metadata.filename !== expectedFilename ||
  metadata.sha256 !== digest ||
  metadata.bytes !== statSync(tarball).size ||
  metadata.npmIntegrity !== integrity ||
  metadata.entryCount !== archiveEntryCount ||
  metadata.reproducibleBuilds !== 2 ||
  metadata.sourceRevision !== currentBuild.sourceRevision ||
  metadata.buildId !== currentBuild.buildId ||
  metadata.protocolVersion !== currentBuild.protocolVersion ||
  archivedBuild.package !== pkg.name ||
  archivedBuild.version !== pkg.version ||
  archivedBuild.sourceRevision !== currentBuild.sourceRevision ||
  archivedBuild.buildId !== currentBuild.buildId ||
  archivedBuild.protocolVersion !== currentBuild.protocolVersion
) {
  throw new Error("release-metadata / tarball build identity 与当前源码输入不一致");
}
const tracked = loadTrackedReleaseAssetManifest(repo, `v${pkg.version}`);
assertIdentityMatchesTrackedManifest(trackedIdentityFromMetadata(metadata, currentBuild), tracked);
assertAssetsMatchTrackedManifest(inspectReleaseAssetDir(releaseDir, pkg.version), tracked);
console.log(
  `[ok] release artifact verified: ${expectedFilename} bytes=${metadata.bytes} sha256=${digest} source=${currentBuild.sourceRevision}`
);
