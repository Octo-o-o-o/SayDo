#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { writeFileAtomic } from "./release-file-transaction.mjs";

export const RELEASE_ASSET_SCHEMA = "saydo-release-assets/v1";
const MANIFEST_TOP_KEYS = [
  "schema",
  "tag",
  "package",
  "version",
  "sourceRevision",
  "buildId",
  "protocolVersion",
  "assets"
];
const ASSET_COMMON_KEYS = ["filename", "bytes", "sha256"];
const TGZ_EXTRA_KEYS = ["npmIntegrity", "entryCount"];

export function releaseAssetExactSet(version) {
  return [`saydo-cli-${version}.tgz`, "SHA256SUMS", "release-metadata.json"];
}

export function trackedReleaseAssetManifestPath(repo, tag) {
  return join(repo, "docs", "release", `${tag}-assets.json`);
}

export function serializeReleaseAssetManifest(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

function invariant(value, message) {
  if (!value) throw new Error(message);
}

function isSha256(value) {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function tarballEntryCount(buffer, tarballPath) {
  let path = tarballPath;
  let scratch;
  if (!path) {
    scratch = mkdtempSync(join(tmpdir(), "saydo-asset-"));
    path = join(scratch, "package.tgz");
    writeFileSync(path, buffer);
  }
  try {
    return execFileSync("tar", ["-tzf", path], {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024
    })
      .split(/\r?\n/u)
      .filter((entry) => entry !== "" && !entry.endsWith("/")).length;
  } finally {
    if (scratch) rmSync(scratch, { recursive: true, force: true });
  }
}

export function inspectAssetBytes(filename, bytes, options = {}) {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const record = {
    filename,
    bytes: buffer.length,
    sha256: sha256Bytes(buffer)
  };
  if (filename.endsWith(".tgz")) {
    record.npmIntegrity = `sha512-${createHash("sha512").update(buffer).digest("base64")}`;
    record.entryCount = tarballEntryCount(buffer, options.tarballPath);
  }
  return record;
}

export function inspectReleaseAssetDir(dir, version) {
  invariant(existsSync(dir), `缺少 release artifact 目录:${dir}`);
  const expected = releaseAssetExactSet(version);
  const names = readdirSync(dir)
    .filter((name) => statSync(join(dir, name)).isFile())
    .sort();
  invariant(
    JSON.stringify(names) === JSON.stringify([...expected].sort()),
    `asset exact-set 漂移:${JSON.stringify({ expected, actual: names })}`
  );
  return expected.map((filename) => {
    const path = join(dir, filename);
    return inspectAssetBytes(filename, readFileSync(path), { tarballPath: filename.endsWith(".tgz") ? path : undefined });
  });
}

function assertPlainObject(value, message) {
  invariant(value !== null && typeof value === "object" && !Array.isArray(value), message);
}

function assertExactKeys(value, allowed, message) {
  const keys = Object.keys(value);
  invariant(keys.every((key) => allowed.includes(key)) && allowed.every((key) => keys.includes(key)), message);
}

export function buildTrackedReleaseAssetManifest({
  tag,
  packageName,
  version,
  sourceRevision,
  buildId,
  protocolVersion,
  assets
}) {
  invariant(tag === `v${version}`, `tag/version 不一致:${tag} v. ${version}`);
  invariant(packageName === "@saydo/cli", `package 非法:${String(packageName)}`);
  invariant(/^0\.1\.0-rc\.\d+$/.test(version), `version 非法:${String(version)}`);
  invariant(isSha256(sourceRevision), "sourceRevision 不是 sha256");
  invariant(typeof buildId === "string" && buildId.startsWith(`${version}+${sourceRevision.slice(0, 12)}.`), "buildId 与 version/sourceRevision 不一致");
  invariant(typeof protocolVersion === "string" && /^\d+\.\d+\.\d+$/.test(protocolVersion), "protocolVersion 非法");
  invariant(Array.isArray(assets), "assets 必须是 exact-set 数组");
  const expected = releaseAssetExactSet(version);
  const byName = new Map(assets.map((asset) => [asset.filename, asset]));
  invariant(
    JSON.stringify([...byName.keys()].sort()) === JSON.stringify([...expected].sort()),
    `tracked manifest exact-set 漂移:${JSON.stringify({ expected, actual: [...byName.keys()] })}`
  );
  const ordered = expected.map((filename) => {
    const asset = byName.get(filename);
    assertPlainObject(asset, `asset 非法:${filename}`);
    invariant(asset.filename === filename, `asset filename 不一致:${filename}`);
    invariant(Number.isInteger(asset.bytes) && asset.bytes > 0, `asset bytes 非法:${filename}`);
    invariant(isSha256(asset.sha256), `asset sha256 非法:${filename}`);
    if (filename.endsWith(".tgz")) {
      assertExactKeys(asset, [...ASSET_COMMON_KEYS, ...TGZ_EXTRA_KEYS], `tgz asset 字段集非法:${filename}`);
      invariant(typeof asset.npmIntegrity === "string" && asset.npmIntegrity.startsWith("sha512-"), `npmIntegrity 非法:${filename}`);
      invariant(Number.isInteger(asset.entryCount) && asset.entryCount > 0, `entryCount 非法:${filename}`);
      return {
        filename: asset.filename,
        bytes: asset.bytes,
        sha256: asset.sha256,
        npmIntegrity: asset.npmIntegrity,
        entryCount: asset.entryCount
      };
    }
    assertExactKeys(asset, ASSET_COMMON_KEYS, `非 tgz asset 不得含 npmIntegrity/entryCount:${filename}`);
    return {
      filename: asset.filename,
      bytes: asset.bytes,
      sha256: asset.sha256
    };
  });
  return {
    schema: RELEASE_ASSET_SCHEMA,
    tag,
    package: packageName,
    version,
    sourceRevision,
    buildId,
    protocolVersion,
    assets: ordered
  };
}

export function parseTrackedReleaseAssetManifest(raw) {
  const parsed = JSON.parse(typeof raw === "string" ? raw : raw.toString("utf8"));
  assertPlainObject(parsed, "tracked manifest 不是对象");
  assertExactKeys(parsed, MANIFEST_TOP_KEYS, `tracked manifest 顶层字段集非法:${Object.keys(parsed).join(",")}`);
  invariant(parsed.schema === RELEASE_ASSET_SCHEMA, `tracked manifest schema 非法:${String(parsed.schema)}`);
  const rebuilt = buildTrackedReleaseAssetManifest({
    tag: parsed.tag,
    packageName: parsed.package,
    version: parsed.version,
    sourceRevision: parsed.sourceRevision,
    buildId: parsed.buildId,
    protocolVersion: parsed.protocolVersion,
    assets: parsed.assets
  });
  invariant(
    serializeReleaseAssetManifest(rebuilt) === serializeReleaseAssetManifest(parsed),
    "tracked manifest 字段未能逐字节规范化"
  );
  return rebuilt;
}

export function loadTrackedReleaseAssetManifest(repo, tag) {
  const path = trackedReleaseAssetManifestPath(repo, tag);
  invariant(existsSync(path), `缺少 tracked asset manifest:${path}`);
  const raw = readFileSync(path);
  const manifest = parseTrackedReleaseAssetManifest(raw);
  invariant(manifest.tag === tag, `tracked manifest tag 不一致:${manifest.tag} != ${tag}`);
  invariant(raw.equals(Buffer.from(serializeReleaseAssetManifest(manifest))), "tracked manifest 文件字节与规范序列化不一致");
  return manifest;
}

export function freezeTrackedReleaseAssetManifest(repo, manifest) {
  const rebuilt = buildTrackedReleaseAssetManifest({
    tag: manifest.tag,
    packageName: manifest.package,
    version: manifest.version,
    sourceRevision: manifest.sourceRevision,
    buildId: manifest.buildId,
    protocolVersion: manifest.protocolVersion,
    assets: manifest.assets
  });
  writeFileAtomic(trackedReleaseAssetManifestPath(repo, rebuilt.tag), Buffer.from(serializeReleaseAssetManifest(rebuilt)));
  return rebuilt;
}

export function assertAssetsMatchTrackedManifest(actualAssets, manifest) {
  const expected = buildTrackedReleaseAssetManifest({
    tag: manifest.tag,
    packageName: manifest.package,
    version: manifest.version,
    sourceRevision: manifest.sourceRevision,
    buildId: manifest.buildId,
    protocolVersion: manifest.protocolVersion,
    assets: actualAssets
  });
  const expectedBytes = serializeReleaseAssetManifest(manifest);
  const actualBytes = serializeReleaseAssetManifest(expected);
  invariant(actualBytes === expectedBytes, `资产与 tracked manifest 全字段不一致:\nexpected=${expectedBytes}\nactual=${actualBytes}`);
  return expected;
}

export function assertIdentityMatchesTrackedManifest(identity, manifest) {
  invariant(identity.package === manifest.package, "package 与 tracked manifest 不一致");
  invariant(identity.version === manifest.version, "version 与 tracked manifest 不一致");
  invariant(identity.tag === manifest.tag, "tag 与 tracked manifest 不一致");
  invariant(identity.sourceRevision === manifest.sourceRevision, "sourceRevision 与 tracked manifest 不一致");
  invariant(identity.buildId === manifest.buildId, "buildId 与 tracked manifest 不一致");
  invariant(identity.protocolVersion === manifest.protocolVersion, "protocolVersion 与 tracked manifest 不一致");
}

export function assertReleaseApiAssetsMatchManifest(release, manifest) {
  invariant(Array.isArray(release?.assets), "Release API 缺 assets");
  const actual = [...release.assets]
    .map((asset) => ({ name: asset.name, bytes: asset.size ?? asset.bytes }))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
  const expected = manifest.assets
    .map((asset) => ({ name: asset.filename, bytes: asset.bytes }))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
  invariant(
    JSON.stringify(actual) === JSON.stringify(expected),
    `Release API exact-set/bytes 与 tracked manifest 不一致:${JSON.stringify({ actual, expected })}`
  );
}

function launchedAsCli() {
  const self = fileURLToPath(import.meta.url);
  const argv1 = process.argv[1] ? resolve(process.argv[1]) : "";
  return self === argv1;
}

function main() {
  const mode = process.argv[2];
  const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  if (mode === "--check-dir") {
    const dir = process.argv[3];
    const tag = process.argv[4] ?? "v0.1.0-rc.5";
    invariant(dir && !dir.startsWith("--"), "用法:node scripts/release-asset-manifest.mjs --check-dir <dir> [tag]");
    const manifest = loadTrackedReleaseAssetManifest(repo, tag);
    const actual = inspectReleaseAssetDir(dir, manifest.version);
    assertAssetsMatchTrackedManifest(actual, manifest);
    const metadata = JSON.parse(readFileSync(join(dir, "release-metadata.json"), "utf8"));
    assertIdentityMatchesTrackedManifest(metadata, manifest);
    console.log(`[ok] release assets match tracked manifest: ${dir}`);
    return;
  }
  if (mode === "--check-release-json") {
    const tag = process.argv[3] ?? process.env.GITHUB_REF_NAME ?? "v0.1.0-rc.5";
    const raw = process.env.RELEASE_JSON;
    invariant(raw, "RELEASE_JSON 为空");
    const manifest = loadTrackedReleaseAssetManifest(repo, tag);
    assertReleaseApiAssetsMatchManifest(JSON.parse(raw), manifest);
    console.log("[ok] release API assets match tracked manifest");
    return;
  }
  console.error("用法:node scripts/release-asset-manifest.mjs <--check-dir <dir> [tag]|--check-release-json [tag]>");
  process.exit(2);
}

if (launchedAsCli()) main();
