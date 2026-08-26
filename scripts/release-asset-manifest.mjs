#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { writeFileAtomic } from "./release-file-transaction.mjs";

// v2(2026-08-26,owner 裁决「来源绑定」):tracked manifest 只承载**跨机器成立**的字段。
// 实测定界:同一 sourceRevision 在 macOS-arm64/node22.23.1 与 linux-x64/node22.23.2 下,
// tgz 内部 17 个文件逐字节相同,而 tgz 外壳差 7098 字节——差异全部在 npm pack 的
// tar/gzip 包装层(随 node patch 漂移)。故 tgz 绑定「内容摘要」(解包后逐文件 sha256 的
// 规范化聚合,机器无关且字节级强度);外壳 sha256/bytes/npmIntegrity 由 CI 构建的
// SHA256SUMS/release-metadata.json 随 Release 发布并在下载侧做自洽校验,不进跨机合同。
// SHA256SUMS 与 release-metadata.json 因内嵌外壳哈希,本身机器相关,只绑文件名存在性。
export const RELEASE_ASSET_SCHEMA = "saydo-release-assets/v2";
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
const ASSET_COMMON_KEYS = ["filename"];
const TGZ_EXTRA_KEYS = ["entryCount", "contentDigest"];

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
    // 用 cwd+相对名传 -f:绝对 Windows 路径的冒号会被 GNU tar 当远程主机
    // (rc.8 smoke 实测 "Cannot connect to C: resolve failed"),--force-local 又不被 bsdtar 认。
    return execFileSync("tar", ["-tzf", basename(path)], {
      cwd: dirname(path),
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024
    })
      .split(/\r?\n/u)
      .filter((entry) => entry !== "" && !entry.endsWith("/")).length;
  } finally {
    if (scratch) rmSync(scratch, { recursive: true, force: true });
  }
}

function walkFilesSorted(root, prefix = "") {
  return readdirSync(root, { withFileTypes: true })
    .flatMap((entry) => {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) return walkFilesSorted(join(root, entry.name), relative);
      invariant(entry.isFile(), `tarball 含非普通文件:${relative}`);
      return [relative];
    })
    .sort();
}

/** tgz 的跨机内容摘要:解包后按路径排序,对每个文件 `sha256(bytes)  path` 逐行聚合再 sha256。
 *  只看文件内容与路径,不看 tar 头(mode/mtime/uid)与 gzip 层——那些随环境漂移。 */
export function tarballContentDigest(bytes, tarballPath) {
  let path = tarballPath;
  let scratch;
  if (!path) {
    scratch = mkdtempSync(join(tmpdir(), "saydo-asset-"));
    path = join(scratch, "package.tgz");
    writeFileSync(path, bytes);
  }
  const extractDir = mkdtempSync(join(tmpdir(), "saydo-asset-x-"));
  try {
    execFileSync("tar", ["-xzf", basename(path), "-C", extractDir], { cwd: dirname(path), stdio: ["ignore", "ignore", "pipe"] });
    const lines = walkFilesSorted(extractDir).map(
      (relative) => `${sha256Bytes(readFileSync(join(extractDir, relative)))}  ${relative}\n`
    );
    invariant(lines.length > 0, "tarball 解包为空");
    return sha256Bytes(Buffer.from(lines.join("")));
  } finally {
    rmSync(extractDir, { recursive: true, force: true });
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
    record.contentDigest = tarballContentDigest(buffer, options.tarballPath);
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

function assertExactKeys(value, allowed, message, options = {}) {
  const keys = Object.keys(value);
  const noUnknown = keys.every((key) => allowed.includes(key));
  if (options.allowMissing === true) {
    invariant(noUnknown, message);
    return;
  }
  invariant(noUnknown && allowed.every((key) => keys.includes(key)), message);
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
  // 输入既可能是 tracked 文件里的 v2 资产,也可能是 inspectAssetBytes 的实测记录
  // (后者额外携带 bytes/sha256/npmIntegrity 等机器相关字段,用于同机自洽校验)。
  // 固化时只取跨机字段;机器相关字段绝不进入 tracked manifest。
  const KNOWN_INSPECT_KEYS = ["filename", "bytes", "sha256", "npmIntegrity", "entryCount", "contentDigest"];
  const ordered = expected.map((filename) => {
    const asset = byName.get(filename);
    assertPlainObject(asset, `asset 非法:${filename}`);
    assertExactKeys(asset, KNOWN_INSPECT_KEYS, `asset 含未知字段:${filename}`, { allowMissing: true });
    invariant(asset.filename === filename, `asset filename 不一致:${filename}`);
    if (filename.endsWith(".tgz")) {
      invariant(Number.isInteger(asset.entryCount) && asset.entryCount > 0, `entryCount 非法:${filename}`);
      invariant(isSha256(asset.contentDigest), `contentDigest 非法:${filename}`);
      return {
        filename: asset.filename,
        entryCount: asset.entryCount,
        contentDigest: asset.contentDigest
      };
    }
    invariant(asset.entryCount === undefined && asset.contentDigest === undefined, `非 tgz asset 不得含 entryCount/contentDigest:${filename}`);
    return { filename: asset.filename };
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
  const expectedNames = manifest.assets.map((asset) => asset.filename).sort((a, b) => a.localeCompare(b, "en"));
  invariant(
    JSON.stringify(actual.map((asset) => asset.name)) === JSON.stringify(expectedNames),
    `Release API exact-set 与 tracked manifest 不一致:${JSON.stringify({ actual, expectedNames })}`
  );
  // 字节数属机器相关包装层,不与 tracked manifest 绑定;只做非空健全性。
  invariant(actual.every((asset) => Number.isInteger(asset.bytes) && asset.bytes > 0), `Release API asset 字节非法:${JSON.stringify(actual)}`);
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
    const tag = process.argv[4] ?? "v0.1.0-rc.9";
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
    const tag = process.argv[3] ?? process.env.GITHUB_REF_NAME ?? "v0.1.0-rc.9";
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
