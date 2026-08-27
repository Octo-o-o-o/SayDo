#!/usr/bin/env node
// iOS 真机产物政策:无账户/固定设备 id/team literal,同一环境变量绑定 build/sign/install。
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { countPublicPrivacyHits } from "./public-text-redaction.mjs";
import { scanIosTrackedTree } from "./ios-artifact-policy.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const script = join(root, "apps/ios/build-and-install.sh");
const readme = join(root, "apps/ios/README.md");
const source = readFileSync(script, "utf8");
const readmeText = readFileSync(readme, "utf8");
let pass = 0;
let fail = 0;

function assert(label, ok) {
  if (ok) {
    process.stdout.write(`[ok] ${label}\n`);
    pass += 1;
  } else {
    process.stdout.write(`[fail] ${label}\n`);
    fail += 1;
  }
}

function git(args, cwd) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  return result;
}

assert("source has no account placeholder", !source.includes("<account>") && !readmeText.includes("<account>"));
assert("source has no name= destination", !/platform=iOS,name=/.test(source));
assert("source has no literal device id", !/--device\s+[A-Fa-f0-9-]{8,}/.test(source));
assert(
  "same env binds xcodebuild id and devicectl",
  source.includes("platform=iOS,id=${SAYDO_IOS_DEVICE_ID}") && source.includes('--device "${SAYDO_IOS_DEVICE_ID}"')
);
assert(
  "team env is consumed only by xcodebuild",
  source.includes('DEVELOPMENT_TEAM="${SAYDO_IOS_DEVELOPMENT_TEAM}"') && !source.includes("DEVELOPMENT_TEAM: ")
);
const deviceAt = source.indexOf("${" + "SAYDO_IOS_DEVICE_ID:-}");
const teamAt = source.indexOf("${" + "SAYDO_IOS_DEVELOPMENT_TEAM:-}");
const xcodegenAt = source.indexOf("xcodegen generate");
const xcodebuildAt = source.indexOf("\nxcodebuild");
const installAt = source.indexOf("devicectl device install");
assert(
  "missing env fails before generate/build/install",
  deviceAt >= 0 && teamAt >= 0 && deviceAt < xcodegenAt && teamAt < xcodegenAt && xcodegenAt < xcodebuildAt && xcodebuildAt < installAt
);

const denied = spawnSync("bash", [script], {
  encoding: "utf8",
  env: { PATH: process.env.PATH, HOME: process.env.HOME }
});
assert("missing env exits 2", denied.status === 2);
const deniedOut = `${denied.stdout ?? ""}${denied.stderr ?? ""}`;
assert("fail-fast before xcodegen", !deniedOut.includes("xcodegen") && deniedOut.includes("[fail]"));
assert("error is generic", !deniedOut.includes("<account>") && !/--device\s+[A-Fa-f0-9-]{8,}/.test(deniedOut));
const deniedTeam = spawnSync("bash", [script], {
  encoding: "utf8",
  env: {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    SAYDO_IOS_DEVICE_ID: "00000000-0000-0000-0000-000000000000"
  }
});
const deniedTeamOut = `${deniedTeam.stdout ?? ""}${deniedTeam.stderr ?? ""}`;
assert("missing team exits 2", deniedTeam.status === 2);
assert("missing team does not echo device id", !deniedTeamOut.includes("00000000-0000-0000-0000-000000000000"));
assert("readme uses env example without angle brackets", readmeText.includes("SAYDO_IOS_DEVICE_ID=00000000-0000-0000-0000-000000000000"));
assert("readme documents team env", readmeText.includes("SAYDO_IOS_DEVELOPMENT_TEAM="));
assert("ios script has no public privacy hits", Object.keys(countPublicPrivacyHits(source)).length === 0);
assert("ios readme has no public privacy hits", Object.keys(countPublicPrivacyHits(readmeText)).length === 0);

const production = scanIosTrackedTree(root);
assert("tracked ios tree is clean", production.ok && production.files.length >= 1);
assert("project.yml is enumerated", production.files.includes("apps/ios/project.yml"));

const dir = mkdtempSync(join(tmpdir(), "saydo-ios-policy-"));
try {
  const seed = (name) => {
    const repo = join(dir, name);
    mkdirSync(join(repo, "apps/ios"), { recursive: true });
    git(["init", "-q"], repo);
    git(["config", "user.email", "test@example.invalid"], repo);
    git(["config", "user.name", "test"], repo);
    writeFileSync(join(repo, "apps/ios/README.md"), "ios\n");
    writeFileSync(join(repo, "apps/ios/build-and-install.sh"), "#!/bin/bash\n");
    writeFileSync(join(repo, "apps/ios/project.yml"), "name: SayDo\n");
    git(["add", "apps/ios"], repo);
    git(["commit", "-q", "-m", "seed"], repo);
    return repo;
  };

  const teamRepo = seed("team");
  writeFileSync(join(teamRepo, "apps/ios/project.yml"), "settings:\n  base:\n    DEVELOPMENT_TEAM: ABCDE12345\n");
  git(["add", "apps/ios/project.yml"], teamRepo);
  git(["commit", "-q", "-m", "team"], teamRepo);
  const teamScan = scanIosTrackedTree(teamRepo);
  assert("project.yml team literal is rejected", teamScan.ok === false && teamScan.failures.includes("ios-team-literal"));

  const uuidRepo = seed("uuid");
  writeFileSync(
    join(uuidRepo, "apps/ios/README.md"),
    "device 12345678-1234-1234-1234-1234567890ab\n"
  );
  git(["add", "apps/ios/README.md"], uuidRepo);
  git(["commit", "-q", "-m", "uuid"], uuidRepo);
  const uuidScan = scanIosTrackedTree(uuidRepo);
  assert("readme device id is rejected", uuidScan.ok === false && uuidScan.failures.includes("ios-device-id-literal"));

  const scriptRepo = seed("script");
  writeFileSync(join(scriptRepo, "apps/ios/build-and-install.sh"), '--device 12345678-1234-1234-1234-1234567890ab\n');
  git(["add", "apps/ios/build-and-install.sh"], scriptRepo);
  git(["commit", "-q", "-m", "script-id"], scriptRepo);
  const scriptScan = scanIosTrackedTree(scriptRepo);
  assert("script device id is rejected", scriptScan.ok === false && scriptScan.failures.includes("ios-device-id-literal"));

  const pbxRepo = seed("pbx");
  mkdirSync(join(pbxRepo, "apps/ios/SayDo.xcodeproj"), { recursive: true });
  writeFileSync(join(pbxRepo, "apps/ios/SayDo.xcodeproj/project.pbxproj"), "DevelopmentTeam = ABCDE12345;\n");
  git(["add", "apps/ios/SayDo.xcodeproj/project.pbxproj"], pbxRepo);
  git(["commit", "-q", "-m", "pbx"], pbxRepo);
  const pbxScan = scanIosTrackedTree(pbxRepo);
  assert("pbxproj team literal is rejected", pbxScan.ok === false && pbxScan.failures.includes("ios-team-literal"));

  const linkRepo = seed("link");
  symlinkSync("project.yml", join(linkRepo, "apps/ios/link.yml"));
  git(["add", "apps/ios/link.yml"], linkRepo);
  git(["commit", "-q", "-m", "link"], linkRepo);
  const linkScan = scanIosTrackedTree(linkRepo);
  assert("tracked symlink is rejected", linkScan.ok === false && linkScan.failures.includes("ios-tracked-symlink"));
} finally {
  rmSync(dir, { recursive: true, force: true });
}

process.stdout.write(`ios-artifact-policy self-test: pass=${pass} fail=${fail}\n`);
process.exit(fail === 0 ? 0 : 1);
