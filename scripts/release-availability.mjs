#!/usr/bin/env node

import { resolve } from "node:path";

function invariant(value, message) {
  if (!value) throw new Error(message);
}

export function applyAvailabilityReplacementsFromSnapshot(snapshot, replacements, repoRoot) {
  invariant(Array.isArray(snapshot) && Array.isArray(replacements), "availability 快照/替换表非法");
  const byPath = new Map();
  const states = [];
  for (const replacement of replacements) {
    invariant(replacement?.path && replacement.before && replacement.after, `availability 替换项非法:${replacement?.path}`);
    const absolute = resolve(repoRoot, replacement.path);
    const entry = snapshot.find((item) => item.path === absolute);
    invariant(entry?.existed === true && entry.kind === "file" && entry.bytes, `availability 快照缺普通文件:${replacement.path}`);
    const current = byPath.get(absolute) ?? Buffer.from(entry.bytes).toString("utf8");
    const beforeCount = current.split(replacement.before).length - 1;
    const afterCount = current.split(replacement.after).length - 1;
    invariant(beforeCount + afterCount === 1, `availability 快照锚异常:${replacement.path}`);
    invariant(beforeCount === 1, `availability 快照不是 candidate:${replacement.path}`);
    byPath.set(absolute, current.replace(replacement.before, replacement.after));
    states.push({ path: replacement.path, state: "candidate" });
  }
  return {
    writes: [...byPath.entries()].map(([path, content]) => ({ path, content })),
    snapshotStates: states
  };
}
