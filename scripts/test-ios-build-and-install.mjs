#!/usr/bin/env node
// iOS 真机安装脚本合同:同一环境变量绑定 build/install,缺省 fail-fast,源码无账户或固定设备 id。
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, "..", "apps/ios/build-and-install.sh");
const readme = join(here, "..", "apps/ios/README.md");
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

assert("source has no account placeholder", !source.includes("<account>") && !readmeText.includes("<account>"));
assert("source has no name= destination", !/platform=iOS,name=/.test(source));
assert("source has no literal device id", !/--device\s+[A-Fa-f0-9-]{8,}/.test(source));
assert(
  "same env binds xcodebuild id and devicectl",
  source.includes('platform=iOS,id=${SAYDO_IOS_DEVICE_ID}') &&
    source.includes('--device "${SAYDO_IOS_DEVICE_ID}"')
);
const envCheckAt = source.indexOf("${" + "SAYDO_IOS_DEVICE_ID:-}");
const xcodegenAt = source.indexOf("xcodegen generate");
const xcodebuildAt = source.indexOf("\nxcodebuild");
const installAt = source.indexOf("devicectl device install");
assert(
  "missing env fails before generate/build/install",
  envCheckAt >= 0 && envCheckAt < xcodegenAt && xcodegenAt < xcodebuildAt && xcodebuildAt < installAt
);

const denied = spawnSync("bash", [script], {
  encoding: "utf8",
  env: { PATH: process.env.PATH, HOME: process.env.HOME }
});
assert("missing env exits 2", denied.status === 2);
const deniedOut = `${denied.stdout ?? ""}${denied.stderr ?? ""}`;
assert("fail-fast before xcodegen", !deniedOut.includes("xcodegen") && deniedOut.includes("[fail]"));
assert("error is generic", !deniedOut.includes("<account>") && !/--device\s+[A-Fa-f0-9-]{8,}/.test(deniedOut));
assert("readme uses env example without angle brackets", readmeText.includes("SAYDO_IOS_DEVICE_ID=00000000-0000-0000-0000-000000000000"));

process.stdout.write(`ios-build-and-install self-test: pass=${pass} fail=${fail}\n`);
process.exit(fail === 0 ? 0 : 1);
