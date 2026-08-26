#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, posix, resolve } from "node:path";

export const WINDOWS_VERIFIER_RELATIVE_PATH = "scripts/verify-release-url.mjs";
export const WINDOWS_WRAPPER_RELATIVE_PATH = "scripts/run-release-verifier-windows.ps1";
export const TRACKED_ASSET_MANIFEST_RELATIVE_PATH = "docs/release/v0.1.0-rc.12-assets.json";
export const PHYSICAL_JS_ROOTS = Object.freeze([
  "scripts/post-release-gate.mjs",
  "scripts/verify-release-url.mjs",
  "scripts/week-audit.mjs"
]);
export const PHYSICAL_NON_JS_ROOTS = Object.freeze([
  WINDOWS_WRAPPER_RELATIVE_PATH,
  TRACKED_ASSET_MANIFEST_RELATIVE_PATH,
  "scripts/release-openat-posix.py"
]);

function invariant(value, message) {
  if (!value) throw new Error(message);
}

export function listRelativeImports(source) {
  const imports = [];
  for (const line of source.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) continue;
    const match = /(?:from|import)\s+["'](\.[^"']+)["']/.exec(trimmed);
    if (match) imports.push(match[1]);
  }
  return imports;
}

export function walkJsClosure(repo, roots) {
  const files = new Set();
  const queue = [...roots];
  while (queue.length > 0) {
    const relative = queue.pop();
    invariant(typeof relative === "string" && relative.endsWith(".mjs") && !relative.includes("\\"), `JS 闭包路径非法:${relative}`);
    invariant(!relative.split("/").includes("..") && !relative.startsWith("/"), `JS 闭包路径穿越:${relative}`);
    if (files.has(relative)) continue;
    files.add(relative);
    const source = readFileSync(join(repo, relative), "utf8");
    invariant(!/import\s*\(/.test(source), `动态 import 不纳入实体门闭包:${relative}`);
    invariant(!/require\s*\(\s*["']\./.test(source), `动态 require 不纳入实体门闭包:${relative}`);
    for (const specifier of listRelativeImports(source)) {
      invariant(specifier.startsWith("./") || specifier.startsWith("../"), `非相对 import:${relative} ${specifier}`);
      const resolved = posix.normalize(posix.join(posix.dirname(relative), specifier));
      invariant(resolved.endsWith(".mjs"), `相对 import 不是 .mjs:${relative} ${specifier}`);
      invariant(!resolved.startsWith("../") && !resolved.startsWith("/"), `相对 import 越出仓库:${relative} ${specifier}`);
      queue.push(resolved);
    }
  }
  return [...files].sort((a, b) => a.localeCompare(b, "en"));
}

export function physicalToolClosure(repo) {
  return [...new Set([...walkJsClosure(repo, PHYSICAL_JS_ROOTS), ...PHYSICAL_NON_JS_ROOTS])].sort((a, b) =>
    a.localeCompare(b, "en")
  );
}

export function windowsVerifierClosure(repo) {
  return [
    ...new Set([
      ...walkJsClosure(repo, [WINDOWS_VERIFIER_RELATIVE_PATH]),
      WINDOWS_WRAPPER_RELATIVE_PATH,
      TRACKED_ASSET_MANIFEST_RELATIVE_PATH
    ])
  ].sort((a, b) => a.localeCompare(b, "en"));
}

export function windowsRemoteRootName(gateRunId) {
  invariant(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(gateRunId), `gateRunId 非法:${gateRunId}`);
  return `saydo-rv-${gateRunId}`;
}

export function assertSafeRemoteVerifierPath(value) {
  invariant(value === WINDOWS_VERIFIER_RELATIVE_PATH, `远端 verifier 路径不是固定相对布局:${String(value)}`);
  return value;
}

export function hashClosureFiles(root, files) {
  return Object.fromEntries(
    [...files]
      .sort((a, b) => a.localeCompare(b, "en"))
      .map((relative) => {
        const bytes = readFileSync(join(root, relative));
        return [relative, createHash("sha256").update(bytes).digest("hex")];
      })
  );
}

export function assertClosureFingerprints(actual, expected, label) {
  const actualKeys = Object.keys(actual ?? {}).sort();
  const expectedKeys = Object.keys(expected ?? {}).sort();
  invariant(
    JSON.stringify(actualKeys) === JSON.stringify(expectedKeys),
    `${label} 闭包成员不一致:${JSON.stringify({ expectedKeys, actualKeys })}`
  );
  for (const key of expectedKeys) {
    invariant(actual[key] === expected[key], `${label} digest 漂移:${key}`);
  }
}

export function assertPhysicalToolFingerprints({ files, worktreeHashes, tagHashes, publicationEntries }) {
  const extra = files.filter((path) => !publicationEntries.some((entry) => entry.path === path));
  invariant(extra.length === 0, `实体门闭包未登记 publication manifest:${extra.join(",")}`);
  const fingerprints = {};
  for (const path of files) {
    const worktree = worktreeHashes[path];
    const tagged = tagHashes[path];
    const entry = publicationEntries.find((candidate) => candidate.path === path);
    invariant(worktree && tagged && worktree === tagged, `实体门闭包与 immutable tag 不一致:${path}`);
    invariant(entry?.kind === "file" && entry.sha256 === worktree, `实体门闭包未绑定 publication manifest:${path}`);
    fingerprints[path] = worktree;
  }
  return fingerprints;
}

export function materializeClosure(repo, files, destRoot, { failIfExists = true } = {}) {
  invariant(Array.isArray(files) && files.length > 0, "闭包文件集为空");
  if (failIfExists) invariant(!existsSync(destRoot), `闭包目标已存在:${destRoot}`);
  mkdirSync(destRoot, { recursive: true });
  for (const relative of files) {
    invariant(!relative.split("/").includes(".."), `闭包成员穿越:${relative}`);
    const destination = join(destRoot, relative);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(resolve(repo, relative), destination);
  }
  return destRoot;
}

export function probeVerifierModuleLoad(nodePath, root) {
  return spawnSync(nodePath, [join(root, WINDOWS_VERIFIER_RELATIVE_PATH)], {
    cwd: root,
    encoding: "utf8"
  });
}
