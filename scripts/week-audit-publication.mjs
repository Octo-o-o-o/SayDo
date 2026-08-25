import { createHash } from "node:crypto";

export const PUBLIC_EXCLUDES = Object.freeze(["artifacts/release/copyright/"]);
export const MUST_PUBLISH_PREFIXES = Object.freeze(["scripts/", "packages/", "pipeline/", "docs/", "e2e/", "deploy/"]);

const sha256Text = (value) => createHash("sha256").update(value).digest("hex");

const uniqueSorted = (values) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "en"));

const sameSet = (a, b) =>
  a.length === b.length &&
  new Set(a).size === a.length &&
  [...a].sort((left, right) => left.localeCompare(right, "en")).every((value, index) => value === [...b].sort((left, right) => left.localeCompare(right, "en"))[index]);

export function isPublicExcluded(path, excludes = PUBLIC_EXCLUDES) {
  return excludes.some((prefix) => path.startsWith(prefix));
}

export function publicationLivePaths(tracked, _others, generatedOutputs) {
  return uniqueSorted(tracked.filter((path) => !generatedOutputs.has(path)));
}

export function unpublishedIndexedSource(others, generatedOutputs) {
  return uniqueSorted(
    (others ?? []).filter(
      (path) =>
        !generatedOutputs.has(path) &&
        !isPublicExcluded(path) &&
        MUST_PUBLISH_PREFIXES.some((prefix) => path.startsWith(prefix))
    )
  );
}

export function privateExcludedIdentity(paths, fingerprint, excludes = PUBLIC_EXCLUDES) {
  const privatePaths = uniqueSorted(paths.filter((path) => isPublicExcluded(path, excludes)));
  const material = privatePaths
    .map((path) => {
      const fp = fingerprint(path);
      return [path, fp.kind, String(fp.mode ?? ""), String(fp.bytes ?? ""), fp.sha256 ?? ""].join("\0");
    })
    .join("\n");
  return {
    count: privatePaths.length,
    digest: sha256Text(material)
  };
}

export function assertPublicationExactSet({
  livePaths,
  entryPaths,
  generatedOutputs,
  publicExcludes = PUBLIC_EXCLUDES,
  privateExcludedCount,
  privateExcludedDigest,
  fingerprint
}) {
  if (new Set(entryPaths).size !== entryPaths.length || entryPaths.some((path) => isPublicExcluded(path, publicExcludes))) {
    throw new Error("公开发布全树 manifest 含重复或私有路径");
  }
  if (unpublishedIndexedSource(livePaths.others ?? [], generatedOutputs).length > 0) {
    throw new Error("应发布源文件未入 index");
  }
  const liveAll = publicationLivePaths(livePaths.tracked, livePaths.others, generatedOutputs);
  const identity = privateExcludedIdentity(liveAll, fingerprint, publicExcludes);
  const publicLive = liveAll.filter((path) => !isPublicExcluded(path, publicExcludes));
  if (!sameSet(publicLive, entryPaths)) {
    throw new Error("公开发布树路径 exact-set 与冻结 manifest 不一致");
  }
  if (identity.count === 0) {
    if (!sameSet(liveAll, entryPaths)) {
      throw new Error("公开发布树路径 exact-set 与冻结 manifest 不一致");
    }
    return identity;
  }
  if (
    !Number.isInteger(privateExcludedCount) ||
    privateExcludedCount < 0 ||
    identity.count !== privateExcludedCount ||
    typeof privateExcludedDigest !== "string" ||
    identity.digest !== privateExcludedDigest
  ) {
    throw new Error("公开发布树仍含私有排除路径");
  }
  return identity;
}
