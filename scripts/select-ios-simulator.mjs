#!/usr/bin/env node
// 按运行时实际 available iPhone simulator 确定性选择,不硬编码某代机型。
import { spawnSync } from "node:child_process";

const listed = spawnSync("xcrun", ["simctl", "list", "devices", "available", "-j"], {
  encoding: "utf8"
});
if (listed.status !== 0) {
  process.stderr.write("[fail] 无法列出 available iOS simulator\n");
  process.stderr.write(listed.stderr || "");
  process.exit(2);
}

const runtimesListed = spawnSync("xcrun", ["simctl", "list", "runtimes", "-j"], {
  encoding: "utf8"
});

let payload;
let runtimesPayload = { runtimes: [] };
try {
  payload = JSON.parse(listed.stdout);
  if (runtimesListed.status === 0) {
    runtimesPayload = JSON.parse(runtimesListed.stdout);
  }
} catch {
  process.stderr.write("[fail] simctl JSON 无法解析\n");
  process.exit(2);
}

function isPreviewRuntime(identifier) {
  const runtime = (runtimesPayload.runtimes || []).find((item) => item.identifier === identifier);
  const build = String(runtime?.buildversion || runtime?.buildVersion || "");
  return /p$|beta|preview/i.test(build);
}

function parseVersion(runtime) {
  const match = /iOS[^\d]*(\d+)(?:[.\-](\d+))?/i.exec(runtime);
  if (!match) return [0, 0];
  return [Number(match[1]), Number(match[2] || 0)];
}

function compareVersion(left, right) {
  if (left[0] !== right[0]) return left[0] - right[0];
  return left[1] - right[1];
}

const devices = [];
for (const [runtime, list] of Object.entries(payload.devices || {})) {
  if (!/iOS/i.test(runtime) || !Array.isArray(list)) continue;
  const version = parseVersion(runtime);
  for (const device of list) {
    if (!device || device.isAvailable !== true) continue;
    if (typeof device.name !== "string" || !/^iPhone /.test(device.name)) continue;
    if (typeof device.udid !== "string" || device.udid.length === 0) continue;
    devices.push({
      udid: device.udid,
      name: device.name,
      runtime,
      version,
      preview: isPreviewRuntime(runtime)
    });
  }
}

devices.sort((left, right) => {
  if (left.preview !== right.preview) return left.preview ? 1 : -1;
  const versionCmp = compareVersion(right.version, left.version);
  if (versionCmp !== 0) return versionCmp;
  const nameCmp = left.name.localeCompare(right.name, "en");
  if (nameCmp !== 0) return nameCmp;
  return left.udid.localeCompare(right.udid, "en");
});

if (devices.length === 0) {
  process.stderr.write("[fail] 没有 available iPhone simulator\n");
  process.exit(2);
}

const selected = devices[0];
process.stderr.write(
  `[ok] selected available iPhone simulator count=${devices.length} runtime=${selected.runtime} name=${selected.name}\n`
);
process.stdout.write(`platform=iOS Simulator,id=${selected.udid}\n`);
