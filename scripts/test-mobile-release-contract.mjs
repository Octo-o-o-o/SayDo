#!/usr/bin/env node
// 三端版本 / 安装器 / Docs 状态映射合同自测。读完整文件,不得抽样。
import { execSync, spawnSync } from "node:child_process";
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PRIVACY_LABELS,
  listRc4MobilePrompts,
  privacyHits,
  promptTreeBound,
  promptTreeHandleBindingAvailable,
  scanRc4MobilePromptPrivacy
} from "./pairing-url-fixtures.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const repo = dirname(dirname(scriptPath));
const TEST_ONLY_FLAG = "--saydo-test-only-prompt-root";
const TEST_ONLY_SENTINEL = ".saydo-test-only-prompt-root";
const TEST_ONLY_TOKEN = "saydo-test-only-prompt-root-v1";
const REPO_PROMPT_DIR = join(repo, "prompts");
let pass = 0;
let fail = 0;

function parseTestOnlyPromptRoot(argv) {
  const values = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] !== TEST_ONLY_FLAG) continue;
    values.push(argv[i + 1]);
    i += 1;
  }
  if (values.length === 0) return "";
  if (values.length !== 1 || !values[0]) {
    throw new Error("invalid test-only prompt root");
  }
  return assertTestOnlyPromptRoot(values[0]);
}

function assertTestOnlyPromptRoot(raw) {
  if (!isAbsolute(raw)) throw new Error("invalid test-only prompt root");
  let rootStat;
  try {
    rootStat = lstatSync(raw);
  } catch {
    throw new Error("invalid test-only prompt root");
  }
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    throw new Error("invalid test-only prompt root");
  }
  const sentinel = join(raw, TEST_ONLY_SENTINEL);
  let sentStat;
  try {
    sentStat = lstatSync(sentinel);
  } catch {
    throw new Error("invalid test-only prompt root");
  }
  if (sentStat.isSymbolicLink() || !sentStat.isFile()) {
    throw new Error("invalid test-only prompt root");
  }
  if (readFileSync(sentinel, "utf8").trim() !== TEST_ONLY_TOKEN) {
    throw new Error("invalid test-only prompt root");
  }
  return raw;
}

let testOnlyPromptRoot = "";
try {
  testOnlyPromptRoot = parseTestOnlyPromptRoot(process.argv.slice(2));
} catch {
  process.stdout.write("[fail] invalid test-only prompt root\n");
  process.exit(1);
}

function read(rel) {
  return readFileSync(join(repo, rel), "utf8");
}

function record(ok, label, detail = "") {
  if (ok) {
    process.stdout.write(`[ok] ${label}\n`);
    pass += 1;
  } else {
    process.stdout.write(`[fail] ${label}${detail ? `: ${detail}` : ""}\n`);
    fail += 1;
  }
}

function includesAll(text, snippets, label) {
  const missing = snippets.filter((snippet) => !text.includes(snippet));
  record(missing.length === 0, label, missing.join(" | "));
}

function includesNone(text, snippets, label) {
  const found = snippets.filter((snippet) => text.includes(snippet));
  record(found.length === 0, label, found.join(" | "));
}

const androidGradle = read("apps/android/app/build.gradle.kts");
record(/\btargetSdk\s*=\s*36\b/.test(androidGradle), "Android targetSdk=36");
record(/\bminSdk\s*=\s*26\b/.test(androidGradle), "Android minSdk=26");
record(/\bversionName\s*=\s*"0\.1\.0"/.test(androidGradle), "Android versionName 0.1.0");
record(/\bversionCode\s*=\s*1\b/.test(androidGradle), "Android versionCode 1");
record(
  !/upload|p12|play-store|release\.keystore/i.test(androidGradle),
  "Android Gradle has no upload/release keystore"
);
record(
  androidGradle.includes("debug.keystore") && androidGradle.includes("androiddebugkey"),
  "Android uses a local debug keystore, not ~/.android"
);

const iosPlist = read("apps/ios/SayDo/Info.plist");
const iosProject = read("apps/ios/project.yml");
record(iosPlist.includes("<string>0.1.0</string>") && iosPlist.includes("<key>CFBundleShortVersionString</key>"), "iOS CFBundleShortVersionString 0.1.0");
record(iosPlist.includes("<key>CFBundleVersion</key>") && iosPlist.includes("<string>1</string>"), "iOS CFBundleVersion 1");
record(iosProject.includes('MARKETING_VERSION: "0.1.0"'), "iOS MARKETING_VERSION 0.1.0");
record(iosProject.includes('CURRENT_PROJECT_VERSION: "1"'), "iOS CURRENT_PROJECT_VERSION 1");

const harmonyApp = read("apps/harmonyos/AppScope/app.json5");
record(harmonyApp.includes('"versionName": "0.1.0"'), "Harmony versionName 0.1.0");
record(harmonyApp.includes('"versionCode": 1'), "Harmony versionCode 1");

const harmonyProfile = read("apps/harmonyos/build-profile.json5");
record(
  /"certpath":\s*""/.test(harmonyProfile) &&
    /"keyPassword":\s*""/.test(harmonyProfile) &&
    /"profile":\s*""/.test(harmonyProfile) &&
    /"storePassword":\s*""/.test(harmonyProfile),
  "Harmony signing material remains empty placeholders"
);
record(!/"signingConfig"\s*:/.test(harmonyProfile), "Harmony product does not reference a signingConfig");

const cliPackage = read("packages/cli/package.json");
// 版本锚动态化:合同本意是「CLI 版本自洽且存在同版本 release note」。
// 原实现钉死 0.1.0-rc.4,RC 链推进到 rc.12 后即假红(2026-08-26 mobile 线并入 main 时暴露)。
const cliVersionMatch = /"version":\s*"(0\.1\.0-rc\.\d+)"/.exec(cliPackage);
record(cliVersionMatch !== null, "CLI version is an rc semver");
const cliVersion = cliVersionMatch ? cliVersionMatch[1] : "unresolved";
const releaseNote = read(`docs/release/v${cliVersion}.md`);
record(releaseNote.includes(cliVersion), `CLI release note exists for v${cliVersion}`);

function literalDeviceAssignment(text) {
  const re = /(?:SAYDO_)?DEVICE_ID=([^\n]+)/g;
  let match;
  while ((match = re.exec(text))) {
    const value = match[1].trim();
    if (value === '""' || value === "''") continue;
    if (
      value.startsWith('"$') ||
      value.startsWith("'$") ||
      value.startsWith("${") ||
      value.startsWith("$(")
    ) {
      continue;
    }
    return match[0].trim();
  }
  return "";
}

const installerPrivacyKeep = new Set([
  "macos-home",
  "linux-home",
  "windows-home",
  "file-url",
  "uuid-like-id",
  "device-path"
]);

function privacyIssues(text, { tools = false } = {}) {
  const issues = privacyHits(text).filter((label) => installerPrivacyKeep.has(label));
  if (/platform=iOS,name=(?!\$)/.test(text)) issues.push("literal-simulator-name");
  if (literalDeviceAssignment(text)) issues.push("literal-device-assignment");
  if (tools) {
    if (/-s\s+(?!"\$\{SAYDO_DEVICE_ID\}")(?!"\$)[A-Za-z0-9]/.test(text)) {
      issues.push("adb-serial-literal");
    }
    if (/-t\s+(?!"\$\{SAYDO_DEVICE_ID\}")(?!<)(?!"\$)[A-Za-z0-9]/.test(text)) {
      issues.push("hdc-target-literal");
    }
    if (/--device\s+(?!"\$\{SAYDO_DEVICE_ID\}")(?!<)(?!"\$)[A-Za-z0-9]/.test(text)) {
      issues.push("device-flag-literal");
    }
    if (/-destination\s+"id=(?!\$\{SAYDO_DEVICE_ID\})/.test(text)) {
      issues.push("xcodebuild-id-literal");
    }
  }
  return issues;
}

function failEchoesSensitive(text) {
  const issues = [];
  if (/saydo_fail[^\n]*\$\{(APK_PATH|UNSIGNED_HAP|APP_PATH|COMMON_LIB|GRADLEW_BIN|pkg|SAYDO_DEVICE_ID)\}/.test(text)) {
    issues.push("fail-interpolates-path-or-id");
  }
  if (/echo "\[fail\][^\n]*\$\{(UNSIGNED_HAP|APK_PATH|COMMON_LIB|APP_PATH)\}/.test(text)) {
    issues.push("echo-fail-interpolates-path");
  }
  if (text.includes("${list_msg}")) issues.push("fail-prints-device-list");
  return issues;
}

const installerFiles = [
  "apps/ios/build-and-install.sh",
  "apps/android/build-and-install.sh",
  "apps/harmonyos/build-and-install.sh",
  "scripts/mobile-install-common.sh"
];
for (const rel of installerFiles) {
  const text = read(rel);
  const issues = privacyIssues(text, { tools: true });
  record(issues.length === 0, `${rel} has no hardcoded private identifiers`, issues.join(" | "));
  const failIssues = failEchoesSensitive(text);
  record(failIssues.length === 0, `${rel} fail output does not echo path or device values`, failIssues.join(" | "));
  record(text.includes("--build-only"), `${rel} documents or implements --build-only`);
}

const iosInstall = read("apps/ios/build-and-install.sh");
record(iosInstall.includes("-destination \"id=${SAYDO_DEVICE_ID}\""), "iOS xcodebuild binds id= of resolved device");
record(iosInstall.includes("--device \"${SAYDO_DEVICE_ID}\""), "iOS devicectl binds the same device id");
record(iosInstall.includes("codesign") && iosInstall.includes("--verify") && iosInstall.includes("--deep") && iosInstall.includes("--strict"), "iOS verifies codesign");
record(
  iosInstall.includes("CFBundleIdentifier") &&
    iosInstall.includes("CFBundleShortVersionString") &&
    iosInstall.includes("CFBundleVersion") &&
    iosInstall.includes("project.yml"),
  "iOS verifies Info.plist identity from project.yml"
);

const androidInstall = read("apps/android/build-and-install.sh");
record(androidInstall.includes("platform-tools/adb"), "Android resolves SDK adb");
record(androidInstall.includes("\"${ADB_BIN}\" -s \"${SAYDO_DEVICE_ID}\""), "Android adb binds -s of resolved serial");
record(
  androidInstall.includes("apksigner") && androidInstall.includes("aapt2") && androidInstall.includes("dump packagename"),
  "Android verifies APK with apksigner and aapt2"
);
record(androidInstall.includes("android_highest_build_tool"), "Android selects highest build-tools");
const wrapper = read("apps/android/gradle/wrapper/gradle-wrapper.properties");
record(
  wrapper.includes("distributionSha256Sum=f397b287023acdba1e9f6fc5ea72d22dd63669d59ed4a289a29b1a76eee151c6"),
  "Gradle wrapper pins 8.11.1 distributionSha256Sum"
);
record(androidInstall.includes("不会自动卸载"), "Android installer does not auto-uninstall");
record(androidInstall.includes("android_qemu_flag_unsafe"), "Android rejects non-zero qemu flags");

const harmonyInstall = read("apps/harmonyos/build-and-install.sh");
record(harmonyInstall.includes("\"${HDC_RESOLVED}\" -t \"${SAYDO_DEVICE_ID}\""), "Harmony hdc binds -t of resolved target");
record(harmonyInstall.includes("signed HAP") || harmonyInstall.includes("signed.hap"), "Harmony requires signed HAP");
record(
  harmonyInstall.includes("verify-app") &&
    harmonyInstall.includes("verify-profile") &&
    harmonyInstall.includes("-outFile") &&
    harmonyInstall.includes("module.json") &&
    harmonyInstall.includes("verifiedPassed"),
  "Harmony verifies HAP signature to files and parses verifiedPassed"
);
record(iosInstall.includes("pairingState"), "iOS requires pairingState");
record(harmonyInstall.includes("const.product.devicetype"), "Harmony requires device-type proof");
record(read("scripts/mobile-install-common.sh").includes("saydo_assert_artifact_tree"), "installers reject symlink parents");

const ci = read(".github/workflows/ci.yml");
record(ci.includes("android-shell"), "CI has android-shell job");
record(ci.includes("ios-shell"), "CI has ios-shell job");
record(ci.includes("test-mobile-installers.mjs"), "CI node job runs installer self-test");
record(ci.includes("test-mobile-release-contract.mjs"), "CI node job runs contract self-test");
record(ci.includes("test-pairing-url-corpus.mjs"), "CI node job runs pairing URL corpus");
record(
  read("apps/android/app/src/test/java/com/octoooo/saydo/PairingUrlCorpus.kt").includes("Generated from scripts/pairing-url-corpus.json") &&
    read("apps/ios/SayDoTests/PairingUrlCorpus.swift").includes("Generated from scripts/pairing-url-corpus.json") &&
    read("apps/harmonyos/entry/src/test/PairingUrlCorpus.ets").includes("Generated from scripts/pairing-url-corpus.json"),
  "three-end pairing fixtures are generated"
);
record(!/harmonyos-shell|hvigorw/.test(ci), "CI has no fake HarmonyOS job");
record(!ci.includes("EXCLUDED_ARCHS=x86_64"), "CI generic iOS build does not pin x86_64 exclusion");
record(/11d5960a326750d5838078e36cf38b85af677262/.test(ci), "CI checkout remains pinned");
const uses = [...ci.matchAll(/^\s+- uses:\s+(\S+)/gm)].map((match) => match[1]);
const unpinned = uses.filter((value) => !/@[0-9a-f]{40}\b/.test(value));
record(unpinned.length === 0, "every CI uses: pin is a full commit SHA", unpinned.join(" | "));
record(!/-latest\b/.test(ci), "CI does not use *-latest runners");
record(
  ci.includes("ubuntu-24.04") && ci.includes("macos-15") && ci.includes("windows-2022"),
  "CI uses GitHub versioned runner aliases"
);
record(
  ci.includes("Major pin only") && /node-version:\s*22\b/.test(ci),
  "Node is major-only 22; patch is not claimed immutable"
);
record(
  ci.includes("Homebrew formula is not content-addressed") && ci.includes("xcodegen --version"),
  "xcodegen is Homebrew plus version log, not content-addressed"
);
record(
  ci.includes("not a content-addressed snapshot") && ci.includes("not a pinned Xcode/xcodegen snapshot"),
  "CI does not claim immutable runner or Xcode snapshots"
);

const homepage = read("deploy/saydo-octoooo-com/index.html");
includesAll(
  homepage,
  ["iOS<i>开发中</i>", "Android<i>开发中</i>"],
  "Chinese homepage keeps no-download mobile status"
);
const homepageEn = read("deploy/saydo-octoooo-com/en/index.html");
includesAll(
  homepageEn,
  ["iOS<i>In dev</i>", "Android<i>In dev</i>"],
  "English homepage keeps no-download mobile status"
);

const docs = [
  "docs/site/2026-08-20-docs-page-content.fable.md",
  "deploy/saydo-octoooo-com/docs/index.html",
  "deploy/saydo-octoooo-com/en/docs/index.html"
];
for (const rel of docs) {
  const text = read(rel);
  includesNone(
    text,
    ["局域网手机面(浏览器 / 壳)", "LAN phone surface (browser / shell)"],
    `${rel} no longer maps browser/shell as one live row`
  );
}

const misleadingZh = [
  "App 壳或手机浏览器连接",
  "手机当前可经局域网用 App 壳",
  "App 壳当前可连接"
];
const misleadingEn = [
  "via an app shell or the mobile browser",
  "app shell or mobile browser, LAN",
  "a mobile browser or self-built app shell opens"
];

const zhSource = read("docs/site/2026-08-20-docs-page-content.fable.md");
includesAll(
  zhSource,
  [
    "局域网手机面(浏览器)",
    "iOS 壳",
    "Android 壳",
    "HarmonyOS 壳",
    "开发签名候选",
    "待本轮真机复测",
    "构建/单测候选",
    "无当前设备证据",
    "unsigned HAP",
    "未上架",
    "无公开下载",
    "移动浏览器 LAN dogfood"
  ],
  "Docs source splits mobile status"
);
includesNone(zhSource, misleadingZh, "Docs source has no connectable-shell phrasing");

const zhHtml = read("deploy/saydo-octoooo-com/docs/index.html");
includesAll(
  zhHtml,
  [
    "局域网手机面(浏览器)",
    "iOS 壳",
    "Android 壳",
    "HarmonyOS 壳",
    "开发签名候选",
    "待本轮真机复测",
    "构建/单测候选",
    "无当前设备证据",
    "unsigned HAP",
    "未上架",
    "无公开下载",
    "移动浏览器 LAN dogfood"
  ],
  "Chinese Docs page splits mobile status"
);
includesNone(zhHtml, misleadingZh, "Chinese Docs page has no connectable-shell phrasing");

const enHtml = read("deploy/saydo-octoooo-com/en/docs/index.html");
includesAll(
  enHtml,
  [
    "LAN phone surface (mobile browser)",
    "iOS shell",
    "Android shell",
    "HarmonyOS shell",
    "development-signed candidate",
    "pending this-round on-device retest",
    "build/unit-test candidate",
    "no current device evidence",
    "unsigned HAP",
    "no public download",
    "mobile-browser LAN dogfood"
  ],
  "English Docs page splits mobile status"
);
includesNone(enHtml, misleadingEn, "English Docs page has no connectable-shell phrasing");

const matrix = read("docs/release/version-matrix.md");
includesAll(
  matrix,
  [
    "0.1.0-rc.4",
    "0.1.0",
    "No-Go",
    "无当前设备证据",
    "Profile",
    "无 Harmony job",
    "本机门禁",
    "BUILD SUCCEEDED",
    "22/22",
    "TEST SUCCEEDED",
    "尚未实际运行",
    "502",
    "fresh dependency hydration",
    "OhmUrl",
    "12/12",
    "13",
    "cached-exact",
    "fresh hydrate",
    "实施自报",
    "未独立验收",
    "255",
    "不得把 Harmony job 宣称为可复现 CI 绿",
    "本轮无在线目标证据"
  ],
  "version-matrix records CLI, shells, No-Go, iOS XCTest evidence, and Harmony hydration status"
);
record(
  privacyIssues(matrix).length === 0,
  "version-matrix has no private device identifiers",
  privacyIssues(matrix).join(" | ")
);

const harmonyReadme = read("apps/harmonyos/README.md");
includesAll(
  harmonyReadme,
  [
    "fresh dependency hydration",
    "502",
    "OhmUrl",
    "12/12",
    "cached-exact",
    "fresh hydrate",
    "实施自报",
    "未独立验收",
    "255",
    "不得把 Harmony job 宣称为可复现 CI 绿",
    "oh-package.json5",
    "oh-package-lock.json5"
  ],
  "Harmony README distinguishes fresh 502, OhmUrl copy, 12/12 as self-reported, and no CI green"
);
record(harmonyReadme.includes("USB 风格"), "Harmony README documents USB-style hdc targets");
record(harmonyReadme.includes("cached-exact") && harmonyReadme.includes("255"), "Harmony README marks 13/13 as cached-exact not fresh");
record(
  privacyIssues(harmonyReadme).length === 0,
  "Harmony README has no private device identifiers",
  privacyIssues(harmonyReadme).join(" | ")
);
for (const rel of ["apps/ios/README.md", "apps/android/README.md"]) {
  const text = read(rel);
  const issues = privacyIssues(text);
  record(issues.length === 0, `${rel} has no private device identifiers`, issues.join(" | "));
}
includesAll(
  read("apps/ios/README.md"),
  ["待本轮真机复测", "不得放入 GitHub Release"],
  "iOS README keeps this-round retest and no-release status"
);
includesAll(
  read("apps/android/README.md"),
  ["无在线 adb 设备证据", "不会自动卸载", "debug.keystore"],
  "Android README records no device evidence and no auto-uninstall"
);

const harmonyRootPkg = JSON.parse(read("apps/harmonyos/oh-package.json5"));
record(
  harmonyRootPkg.devDependencies?.["@ohos/hypium"] === "1.0.25" &&
    harmonyRootPkg.devDependencies?.["@ohos/hamock"] === "1.0.0" &&
    Object.keys(harmonyRootPkg.devDependencies || {}).length === 2,
  "Harmony root-only test devDependencies are hypium 1.0.25 and hamock 1.0.0"
);
const harmonyEntryPkgText = read("apps/harmonyos/entry/oh-package.json5");
record(
  !harmonyEntryPkgText.includes("@ohos/hypium") && !harmonyEntryPkgText.includes("@ohos/hamock"),
  "Harmony entry does not repeat hypium or hamock"
);

const lockText = read("apps/harmonyos/oh-package-lock.json5");
const lock = JSON.parse(lockText);
const hamock = lock.packages?.["@ohos/hamock@1.0.0"];
const hypium = lock.packages?.["@ohos/hypium@1.0.25"];
record(lock.meta?.stableOrder === true, "Harmony lock stableOrder");
record(lock.lockfileVersion === 3, "Harmony lockfileVersion 3");
record(hamock?.version === "1.0.0" && hypium?.version === "1.0.25", "Harmony lock exact versions");
record(
  hamock?.integrity ===
    "sha512-K6lDPYc6VkKe6ZBNQa9aoG+ZZMiwqfcR/7yAVFSUGIuOAhPvCJAo9+t1fZnpe0dBRBPxj2bxPPbKh69VuyAtDg==" &&
    hypium?.integrity ===
      "sha512-l6uO2pjl8HyEKdekLqQt7tUpWbDqX/42zoAzkagtUVZAW9jT6lMvbe54MVjoLxq/RwQGygRvi6j4GpypSMFSHw==",
  "Harmony lock exact integrity"
);
record(
  hamock?.resolved === "https://ohpm.openharmony.cn/ohpm/@ohos/hamock/-/hamock-1.0.0.har" &&
    hypium?.resolved === "https://ohpm.openharmony.cn/ohpm/@ohos/hypium/-/hypium-1.0.25.har",
  "Harmony lock exact resolved"
);
record(Object.keys(lock.packages || {}).length === 2, "Harmony lock contains only hypium and hamock");
includesNone(
  lockText,
  ["/Users/", "file://", "token=", "password="],
  "Harmony lock has no personal paths or credentials"
);
record(!privacyHits(lockText).includes("uuid-like-id"), "Harmony lock has no UUID device identifier");

const trackedHarmony = execSync("git ls-files -- apps/harmonyos", {
  cwd: repo,
  encoding: "utf8"
});
const vendored = trackedHarmony.split("\n").filter((line) => {
  if (!line) return false;
  return (
    /(^|\/)oh_modules(\/|$)/.test(line) ||
    /(^|\/)\.ohpm(\/|$)/.test(line) ||
    line.includes("entry/.test/") ||
    line.endsWith(".hap") ||
    line.endsWith(".app")
  );
});
record(vendored.length === 0, "no vendored ohpm/SDK/HAP artifacts in Git", vendored.join(" | "));

function isGitIgnored(rel) {
  try {
    execSync(`git check-ignore -q -- ${rel}`, { cwd: repo, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
record(!isGitIgnored("apps/harmonyos/oh-package-lock.json5"), "Harmony lockfile is not gitignored");
record(isGitIgnored("apps/harmonyos/oh_modules/"), "Harmony oh_modules is gitignored");
record(isGitIgnored("apps/harmonyos/.ohpm/"), "Harmony .ohpm is gitignored");
record(isGitIgnored("apps/harmonyos/entry/.test/"), "Harmony entry/.test is gitignored");

const selector = read("scripts/select-ios-simulator.mjs");
includesNone(
  selector,
  ["iPhone 17", "iPhone 16", "iPhone 15", "iPhone 14"],
  "simulator selector does not hardcode a generation"
);
record(selector.includes("simctl") && selector.includes("available"), "simulator selector reads runtime available devices");

const gitignore = read("apps/harmonyos/.gitignore");
includesAll(
  gitignore,
  ["build/", "entry/.test/", "oh_modules/", ".ohpm/"],
  "Harmony gitignore covers build, tests, oh_modules, and .ohpm"
);

const evidenceFiles = [
  "e2e/evidence/2026-08-22-mobile-shells-device-build.md",
  "docs/release/version-matrix.md",
  "docs/site/2026-08-20-docs-page-content.fable.md",
  "deploy/saydo-octoooo-com/docs/index.html",
  "deploy/saydo-octoooo-com/en/docs/index.html"
];
for (const rel of evidenceFiles) {
  const text = read(rel);
  const issues = privacyIssues(text);
  record(issues.length === 0, `${rel} has no private device identifiers`, issues.join(" | "));
}
record(
  read("e2e/evidence/2026-08-22-mobile-shells-device-build.md").includes("cached-exact") &&
    read("e2e/evidence/2026-08-22-mobile-shells-device-build.md").includes("255"),
  "device-build evidence marks Harmony 13/13 as cached-exact"
);
record(
  read("e2e/evidence/2026-08-22-mobile-shells-device-build.md").includes("非空目标数 0"),
  "device-build evidence records this-round Harmony online target count 0"
);

const currentOnePhrasesZh = ["宿主当前发现 1 台", "宿主当前发现一台", "有物理目标但"];
const currentOnePhrasesEn = ["has a physical target but", "a physical target is present"];
const currentStatusFiles = [
  "apps/harmonyos/README.md",
  "docs/release/version-matrix.md",
  "docs/site/2026-08-20-docs-page-content.fable.md",
  "deploy/saydo-octoooo-com/docs/index.html",
  "deploy/saydo-octoooo-com/en/docs/index.html"
];
for (const rel of currentStatusFiles) {
  const text = read(rel);
  includesNone(text, currentOnePhrasesZh, `${rel} has no unbounded current Harmony device-count`);
  if (rel.endsWith("/en/docs/index.html")) {
    includesNone(text, currentOnePhrasesEn, `${rel} has no unbounded English current Harmony device-count`);
  }
  record(text.includes("本轮无在线目标证据") || text.includes("no online target evidence"), `${rel} states this-round Harmony has no online target evidence`);
}

function joinParts(parts, sep) {
  return parts.join(sep);
}

function threw(fn) {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
}

function capturedOutput(result) {
  return `${result.stdout || ""}${result.stderr || ""}`;
}

function spawnReleaseContract(args, extraEnv = {}) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: repo,
    encoding: "utf8",
    env: { ...process.env, ...extraEnv },
    timeout: 120000,
    maxBuffer: 20 * 1024 * 1024
  });
}

const detectorSamples = {
  "10/8": joinParts(["10", "0", "0", "1"], "."),
  loopback: joinParts(["127", "0", "0", "1"], "."),
  "192.168/16": joinParts(["192", "168", "1", "8"], "."),
  "172.16/12": joinParts(["172", "16", "0", "1"], "."),
  ULA: `[${joinParts(["fd12", "", "1"], ":")}]`,
  "macos-home": `/Users/${"agent"}`,
  "linux-home": `/home/${"agent"}`,
  "windows-home": `C:\\Users\\${"agent"}`,
  "file-url": `file://${"localhost/tmp"}`,
  "uuid-like-id": joinParts(["aaaaaaaa", "bbbb", "4ccc", "8ddd", "eeeeeeeeeeee"], "-"),
  "device-path": `/private/var/${"tmp"}`
};
record(
  Object.keys(detectorSamples).length === PRIVACY_LABELS.length,
  `detector category positives cover all ${PRIVACY_LABELS.length} labels`
);
let detectorPositives = 0;
let detectorNegatives = 0;
for (const label of PRIVACY_LABELS) {
  const sample = detectorSamples[label];
  record(Boolean(sample) && privacyHits(sample).includes(label), `detector hits ${label}`);
  detectorPositives += 1;
}
const ipv6LoopbackBare = joinParts(["", "", "1"], ":");
const ipv6LoopbackBracket = `[${ipv6LoopbackBare}]`;
record(privacyHits(ipv6LoopbackBare).includes("loopback"), "detector hits bare IPv6 loopback");
detectorPositives += 1;
record(privacyHits(ipv6LoopbackBracket).includes("loopback"), "detector hits bracketed IPv6 loopback");
detectorPositives += 1;
record(
  privacyHits(`c:\\users\\${"agent"}`).includes("windows-home"),
  "detector hits mixed-case Windows home"
);
detectorPositives += 1;
record(
  privacyHits(`C:\\USERS\\${"agent"}`).includes("windows-home"),
  "detector hits upper-case Windows home"
);
detectorPositives += 1;
record(privacyHits(`FILE://${"localhost/tmp"}`).includes("file-url"), "detector hits upper-case file URI");
detectorPositives += 1;
record(privacyHits(`File://${"localhost/tmp"}`).includes("file-url"), "detector hits mixed-case file URI");
detectorPositives += 1;
record(
  privacyHits(detectorSamples.ULA).includes("ULA") && !privacyHits(detectorSamples.ULA).includes("loopback"),
  "ULA sample is not classified as loopback"
);
detectorPositives += 1;
record(
  privacyHits("/Users/<you>").length === 0 &&
    privacyHits("/home/<you>").length === 0 &&
    privacyHits("C:\\Users\\<you>").length === 0 &&
    privacyHits("c:\\users\\<you>").length === 0 &&
    privacyHits("$HOME/Library").length === 0 &&
    privacyHits("<repo>").length === 0,
  "detector ignores semantic path placeholders"
);
detectorNegatives += 1;
record(
  privacyHits('["192","168","1","8"]').length === 0 &&
    privacyHits('["fd12","","1"]').length === 0 &&
    privacyHits('["", "", "1"]').length === 0,
  "detector ignores split host parts"
);
detectorNegatives += 1;
record(
  privacyHits("RFC1918 loopback ULA file URL Windows home").length === 0 &&
    privacyHits("file: URI").length === 0 &&
    privacyHits("IPv6 loopback").length === 0,
  "detector ignores category descriptions"
);
detectorNegatives += 1;
record(detectorPositives >= 17, `detector category positives ${detectorPositives}`);
record(detectorNegatives >= 3, `detector placeholder/parts negatives ${detectorNegatives}`);

function cwdKey() {
  const fd = openSync(".", constants.O_RDONLY);
  try {
    const st = fstatSync(fd);
    return `${st.dev}:${st.ino}`;
  } finally {
    closeSync(fd);
  }
}

function fdCount() {
  const dir = process.platform === "linux" ? "/proc/self/fd" : "/dev/fd";
  return readdirSync(dir).filter((name) => /^\d+$/.test(name)).length;
}

let walkerFailClosed = 0;
promptTreeHandleBindingAvailable();
const walkRoot = mkdtempSync(join(tmpdir(), "saydo-prompt-walk-"));
try {
  const emptyCwd = cwdKey();
  const emptyFds = fdCount();
  record(listRc4MobilePrompts(walkRoot).length === 0, "empty prompt tree returns no prompts");
  record(cwdKey() === emptyCwd, "empty listing restored cwd");
  record(fdCount() === emptyFds, "empty listing does not leak fds");
  mkdirSync(join(walkRoot, "nested", "deep"), { recursive: true });
  writeFileSync(join(walkRoot, "x-rc4-mobile.md"), "ok\n");
  writeFileSync(join(walkRoot, "nested", "deep", "x-rc4-mobile.md"), "ok\n");
  writeFileSync(join(walkRoot, "notes.txt"), "skip\n");
  const listed = listRc4MobilePrompts(walkRoot);
  record(
    listed.length === 2 && listed[0] === "nested/deep/x-rc4-mobile.md" && listed[1] === "x-rc4-mobile.md",
    "recursive listing keeps nested same-name paths"
  );

  const slFileRoot = mkdtempSync(join(tmpdir(), "saydo-prompt-slf-"));
  writeFileSync(join(slFileRoot, "target-rc4-mobile.md"), "ok\n");
  symlinkSync(join(slFileRoot, "target-rc4-mobile.md"), join(slFileRoot, "link-rc4-mobile.md"));
  const slCwd = cwdKey();
  const slFds = fdCount();
  record(threw(() => listRc4MobilePrompts(slFileRoot)), "symlink file fail-closed");
  record(cwdKey() === slCwd, "symlink file fail-closed restored cwd");
  record(fdCount() === slFds, "symlink file fail-closed does not leak fds");
  walkerFailClosed += 1;
  rmSync(slFileRoot, { recursive: true, force: true });

  const slDirRoot = mkdtempSync(join(tmpdir(), "saydo-prompt-sld-"));
  const slReal = join(slDirRoot, "real");
  mkdirSync(slReal);
  writeFileSync(join(slReal, "x-rc4-mobile.md"), "ok\n");
  symlinkSync(slReal, join(slDirRoot, "nested"));
  record(threw(() => listRc4MobilePrompts(slDirRoot)), "symlink directory fail-closed");
  walkerFailClosed += 1;
  rmSync(slDirRoot, { recursive: true, force: true });

  const outer = mkdtempSync(join(tmpdir(), "saydo-prompt-outer-"));
  writeFileSync(join(outer, "SENTINEL"), "keep\n");
  writeFileSync(join(outer, "outer-rc4-mobile.md"), "ok\n");
  const inner = mkdtempSync(join(tmpdir(), "saydo-prompt-inner-"));
  symlinkSync(outer, join(inner, "escape"));
  record(threw(() => listRc4MobilePrompts(inner)), "outbound symlink fail-closed");
  walkerFailClosed += 1;
  record(readFileSync(join(outer, "SENTINEL"), "utf8") === "keep\n", "outbound symlink was not followed");
  rmSync(inner, { recursive: true, force: true });
  rmSync(outer, { recursive: true, force: true });

  const fifoRoot = mkdtempSync(join(tmpdir(), "saydo-prompt-fifo-"));
  const fifoPath = join(fifoRoot, "fifo-rc4-mobile.md");
  const fifoMade = spawnSync("mkfifo", [fifoPath], { encoding: "utf8" });
  record(fifoMade.status === 0, "fifo candidate fixture created");
  record(threw(() => listRc4MobilePrompts(fifoRoot)), "non-regular candidate fail-closed");
  walkerFailClosed += 1;
  rmSync(fifoRoot, { recursive: true, force: true });

  mkdirSync(join(walkRoot, "dir-rc4-mobile.md"));
  record(threw(() => listRc4MobilePrompts(walkRoot)), "directory candidate fail-closed");
  walkerFailClosed += 1;
  rmSync(join(walkRoot, "dir-rc4-mobile.md"), { recursive: true, force: true });

  const enumRoot = mkdtempSync(join(tmpdir(), "saydo-prompt-enum-"));
  try {
    const invalidCwd = cwdKey();
    const invalidFds = fdCount();
    record(threw(() => promptTreeBound.list(-1)), "unreadable directory fail-closed");
    record(cwdKey() === invalidCwd, "unreadable directory fail-closed restored cwd");
    record(fdCount() === invalidFds, "unreadable directory fail-closed does not leak fds");
    walkerFailClosed += 1;

    const plain = join(enumRoot, "plain");
    writeFileSync(plain, "x\n");
    const fileCwd = cwdKey();
    const fileFds = fdCount();
    const fileFd = openSync(plain, constants.O_RDONLY);
    try {
      record(threw(() => promptTreeBound.list(fileFd)), "non-directory fd enumerate fail-closed");
    } finally {
      closeSync(fileFd);
    }
    record(cwdKey() === fileCwd, "non-directory fd enumerate restored cwd");
    record(fdCount() === fileFds, "non-directory fd enumerate does not leak fds");
    walkerFailClosed += 1;
  } finally {
    rmSync(enumRoot, { recursive: true, force: true });
  }

  const fileRoot = join(walkRoot, "not-a-dir");
  writeFileSync(fileRoot, "x\n");
  record(threw(() => listRc4MobilePrompts(fileRoot)), "non-directory prompt root fail-closed");
  walkerFailClosed += 1;
} finally {
  rmSync(walkRoot, { recursive: true, force: true });
}
record(walkerFailClosed >= 7, `prompt tree fail-closed tests ${walkerFailClosed}`);
record(promptTreeHandleBindingAvailable(), "prompt tree handle binding is available");

const LINUX_RENAME_NOREPLACE = 1;
const LINUX_RENAME_EXCHANGE = 2;
const DARWIN_RENAME_SWAP = 0x0002;
const LINUX_AT_FDCWD = -100;

record(LINUX_RENAME_NOREPLACE === 1, "LINUX_RENAME_NOREPLACE equals 1");
record(LINUX_RENAME_EXCHANGE === 2, "LINUX_RENAME_EXCHANGE equals 2");
record(
  LINUX_RENAME_EXCHANGE !== LINUX_RENAME_NOREPLACE,
  "LINUX_RENAME_EXCHANGE is not LINUX_RENAME_NOREPLACE"
);
record(DARWIN_RENAME_SWAP === 0x0002, "DARWIN_RENAME_SWAP equals 0x0002");

function loadNativeLibc() {
  const require = createRequire(join(repo, "packages/platform/package.json"));
  const koffi = require("koffi");
  if (process.platform === "darwin") {
    return { kind: "darwin", libc: koffi.load("libc.dylib") };
  }
  if (process.platform === "linux") {
    return { kind: "linux", libc: koffi.load("libc.so.6") };
  }
  return null;
}

function tryAtomicExchange(left, right) {
  try {
    const native = loadNativeLibc();
    if (!native) return { ok: false, method: "unavailable" };
    if (native.kind === "darwin") {
      const renamex = native.libc.func("int renamex_np(const char *from, const char *to, unsigned int flags)");
      if (renamex(left, right, DARWIN_RENAME_SWAP) === 0) {
        return { ok: true, method: "renamex_np RENAME_SWAP" };
      }
      return { ok: false, method: "renamex_np failed" };
    }
    const renameat2 = native.libc.func(
      "int renameat2(int olddirfd, const char *oldpath, int newdirfd, const char *newpath, unsigned int flags)"
    );
    if (renameat2(LINUX_AT_FDCWD, left, LINUX_AT_FDCWD, right, LINUX_RENAME_EXCHANGE) === 0) {
      return { ok: true, method: "renameat2 RENAME_EXCHANGE" };
    }
    return { ok: false, method: "renameat2 failed" };
  } catch {
    return { ok: false, method: "unavailable" };
  }
}

function inodeOf(path) {
  const st = lstatSync(path);
  return `${st.dev}:${st.ino}`;
}

{
  const exchRoot = mkdtempSync(join(tmpdir(), "saydo-prompt-exch-"));
  try {
    const pathA = join(exchRoot, "a");
    const pathB = join(exchRoot, "b");
    writeFileSync(pathA, "one\n");
    writeFileSync(pathB, "two\n");
    const beforeA = inodeOf(pathA);
    const beforeB = inodeOf(pathB);
    record(beforeA !== beforeB, "atomic exchange fixtures have distinct inodes");

    if (process.platform === "linux") {
      let invoked = false;
      let noreplaceRc = 0;
      let exchangeRc = 1;
      try {
        const native = loadNativeLibc();
        const renameat2 = native.libc.func(
          "int renameat2(int olddirfd, const char *oldpath, int newdirfd, const char *newpath, unsigned int flags)"
        );
        invoked = true;
        noreplaceRc = renameat2(LINUX_AT_FDCWD, pathA, LINUX_AT_FDCWD, pathB, LINUX_RENAME_NOREPLACE);
        record(
          readFileSync(pathA, "utf8") === "one\n" && readFileSync(pathB, "utf8") === "two\n",
          "RENAME_NOREPLACE left both existing paths unchanged"
        );
        exchangeRc = renameat2(LINUX_AT_FDCWD, pathA, LINUX_AT_FDCWD, pathB, LINUX_RENAME_EXCHANGE);
      } catch {
        invoked = false;
      }
      if (!invoked) {
        record(false, "linux renameat2 RENAME_EXCHANGE unavailable");
      } else {
        record(noreplaceRc !== 0, "renameat2 RENAME_NOREPLACE fails when destination exists");
        if (exchangeRc === 0) {
          record(true, "linux atomic exchange via renameat2 RENAME_EXCHANGE");
          record(inodeOf(pathA) === beforeB && inodeOf(pathB) === beforeA, "linux RENAME_EXCHANGE swapped inodes");
          record(
            readFileSync(pathA, "utf8") === "two\n" && readFileSync(pathB, "utf8") === "one\n",
            "linux RENAME_EXCHANGE swapped content"
          );
        } else {
          record(false, "linux renameat2 RENAME_EXCHANGE unavailable");
        }
      }
    } else {
      record(true, `linux renameat2 RENAME_EXCHANGE not applicable on ${process.platform}`);
      const swapped = tryAtomicExchange(pathA, pathB);
      if (swapped.ok) {
        record(true, `atomic exchange via ${swapped.method}`);
        record(inodeOf(pathA) === beforeB && inodeOf(pathB) === beforeA, "atomic exchange swapped inodes");
        record(
          readFileSync(pathA, "utf8") === "two\n" && readFileSync(pathB, "utf8") === "one\n",
          "atomic exchange swapped content"
        );
      } else {
        record(false, `atomic exchange ${swapped.method}`);
      }
    }
  } finally {
    rmSync(exchRoot, { recursive: true, force: true });
  }
}

function scanThrew(dir) {
  try {
    return { threw: false, rows: scanRc4MobilePromptPrivacy(dir) };
  } catch {
    return { threw: true, rows: null };
  }
}

function rowsAcceptedOutside(rows) {
  if (!rows) return false;
  return rows.some((row) => row.hits.length > 0);
}

let raceTests = 0;
const raceRoot = mkdtempSync(join(tmpdir(), "saydo-prompt-race-"));
try {
  record(promptTreeBound.available(), "bound ops report available");
  raceTests += 1;

  const outside = mkdtempSync(join(tmpdir(), "saydo-prompt-race-out-"));
  const leakBody = `http://[${joinParts(["fd12", "", "1"], ":")}]:47100/?token=abc\n`;
  writeFileSync(join(outside, "x-rc4-mobile.md"), leakBody);
  writeFileSync(join(outside, "extra-rc4-mobile.md"), leakBody);

  const fileRoot = join(raceRoot, "file");
  mkdirSync(fileRoot);
  const candidate = join(fileRoot, "x-rc4-mobile.md");
  writeFileSync(candidate, "clean\n");
  const link = join(fileRoot, "link");
  symlinkSync(join(outside, "x-rc4-mobile.md"), link);
  const beforeFile = inodeOf(candidate);
  const beforeLink = inodeOf(link);
  const fileSwap = tryAtomicExchange(candidate, link);
  if (fileSwap.ok) {
    record(true, `file/symlink atomic exchange via ${fileSwap.method}`);
    record(
      inodeOf(candidate) === beforeLink && inodeOf(link) === beforeFile,
      "file/symlink atomic exchange swapped inodes"
    );
  } else {
    renameSync(candidate, join(fileRoot, "x.bak"));
    renameSync(link, candidate);
    record(true, `file/symlink sequential replace; atomic exchange ${fileSwap.method}`);
  }
  record(lstatSync(candidate).isSymbolicLink(), "file path is a symlink after replace");
  const fileScan = scanThrew(fileRoot);
  record(fileScan.threw, "file/symlink candidate scan fail-closed");
  record(!rowsAcceptedOutside(fileScan.rows), "file/symlink candidate did not accept outside content");
  raceTests += 2;
  walkerFailClosed += 1;

  const dirRoot = join(raceRoot, "dir");
  mkdirSync(join(dirRoot, "nested"), { recursive: true });
  writeFileSync(join(dirRoot, "nested", "deep-rc4-mobile.md"), "clean\n");
  const nestedDir = join(dirRoot, "nested");
  const nestedLink = join(dirRoot, "nested-link");
  symlinkSync(outside, nestedLink);
  const beforeNested = inodeOf(nestedDir);
  const beforeNestedLink = inodeOf(nestedLink);
  const dirSwap = tryAtomicExchange(nestedDir, nestedLink);
  if (dirSwap.ok) {
    record(true, `middle-directory atomic exchange via ${dirSwap.method}`);
    record(
      inodeOf(nestedDir) === beforeNestedLink && inodeOf(nestedLink) === beforeNested,
      "middle-directory atomic exchange swapped inodes"
    );
  } else {
    renameSync(nestedDir, join(dirRoot, "nested.bak"));
    renameSync(nestedLink, nestedDir);
    record(true, `middle-directory sequential replace; atomic exchange ${dirSwap.method}`);
  }
  const dirScan = scanThrew(dirRoot);
  record(dirScan.threw, "middle-directory symlink candidate scan fail-closed");
  record(!rowsAcceptedOutside(dirScan.rows), "middle-directory candidate did not accept outside content");
  raceTests += 2;
  walkerFailClosed += 1;

  const boundRoot = join(raceRoot, "bound");
  mkdirSync(join(boundRoot, "nested"), { recursive: true });
  writeFileSync(join(boundRoot, "top-rc4-mobile.md"), "clean-top\n");
  writeFileSync(join(boundRoot, "nested", "deep-rc4-mobile.md"), "clean-deep\n");
  const rootFd = promptTreeBound.openRoot(boundRoot);
  const nestedFd = promptTreeBound.openChild(rootFd, "nested");
  const topFd = promptTreeBound.openChild(rootFd, "top-rc4-mobile.md");
  renameSync(boundRoot, join(raceRoot, "bound.bak"));
  symlinkSync(outside, boundRoot);
  const listed = promptTreeBound.list(rootFd);
  const nestedListed = promptTreeBound.list(nestedFd);
  const topText = promptTreeBound.readFile(topFd);
  const deepFd = promptTreeBound.openChild(nestedFd, "deep-rc4-mobile.md");
  const deepText = promptTreeBound.readFile(deepFd);
  record(
    listed.includes("top-rc4-mobile.md") && listed.includes("nested") && !listed.includes("extra-rc4-mobile.md"),
    "bound root listing ignores later path swap"
  );
  record(
    nestedListed.includes("deep-rc4-mobile.md") && !nestedListed.includes("extra-rc4-mobile.md"),
    "bound nested listing ignores later path swap"
  );
  record(topText === "clean-top\n" && privacyHits(topText).length === 0, "bound file read ignores later path swap");
  record(deepText === "clean-deep\n" && privacyHits(deepText).length === 0, "bound nested file read ignores later path swap");
  raceTests += 4;
  promptTreeBound.close(deepFd);
  promptTreeBound.close(topFd);
  promptTreeBound.close(nestedFd);
  promptTreeBound.close(rootFd);

  const live = join(raceRoot, "live-file");
  mkdirSync(live);
  writeFileSync(join(live, "x-rc4-mobile.md"), "clean\n");
  const liveRootFd = promptTreeBound.openRoot(live);
  const liveFileFd = promptTreeBound.openChild(liveRootFd, "x-rc4-mobile.md");
  const livePath = join(live, "x-rc4-mobile.md");
  const liveLink = join(live, "l");
  symlinkSync(join(outside, "x-rc4-mobile.md"), liveLink);
  const liveSwap = tryAtomicExchange(livePath, liveLink);
  if (!liveSwap.ok) {
    renameSync(livePath, join(live, "x.bak"));
    renameSync(liveLink, livePath);
    record(true, `live-file sequential replace; atomic exchange ${liveSwap.method}`);
  } else {
    record(true, `live-file atomic exchange via ${liveSwap.method}`);
  }
  const liveText = promptTreeBound.readFile(liveFileFd);
  record(liveText === "clean\n" && privacyHits(liveText).length === 0, "open-then-replace-path still reads bound file");
  raceTests += 1;
  promptTreeBound.close(liveFileFd);
  promptTreeBound.close(liveRootFd);

  const vanished = join(raceRoot, "vanished");
  mkdirSync(vanished);
  writeFileSync(join(vanished, "gone-rc4-mobile.md"), "clean\n");
  rmSync(vanished, { recursive: true, force: true });
  record(scanThrew(vanished).threw, "disappeared prompt root fail-closed");
  raceTests += 1;
  walkerFailClosed += 1;

  const goneChildRoot = join(raceRoot, "gone-child");
  mkdirSync(goneChildRoot);
  const goneFd = promptTreeBound.openRoot(goneChildRoot);
  writeFileSync(join(goneChildRoot, "soon-rc4-mobile.md"), "clean\n");
  rmSync(join(goneChildRoot, "soon-rc4-mobile.md"));
  record(threw(() => promptTreeBound.openChild(goneFd, "soon-rc4-mobile.md")), "disappeared candidate fail-closed");
  raceTests += 1;
  walkerFailClosed += 1;
  promptTreeBound.close(goneFd);

  rmSync(outside, { recursive: true, force: true });
} finally {
  rmSync(raceRoot, { recursive: true, force: true });
}
record(raceTests >= 10, `prompt tree race tests ${raceTests}`);
record(walkerFailClosed >= 10, `prompt tree fail-closed tests ${walkerFailClosed}`);

function scanPromptDir(dir, label) {
  try {
    return scanRc4MobilePromptPrivacy(dir);
  } catch {
    record(false, `${label} prompt tree scan failed`);
    return [];
  }
}

const promptResults = scanPromptDir(REPO_PROMPT_DIR, "repo");
record(promptResults.length >= 13, "mobile rc4 prompts present for privacy scan", `count=${promptResults.length}`);
record(
  promptResults.some((row) => row.name.startsWith("166-")),
  "prompt 166 is included in privacy scan"
);
record(
  promptResults.some((row) => row.name.startsWith("167-")),
  "prompt 167 is included in privacy scan"
);
let promptHits = 0;
for (const row of promptResults) {
  promptHits += row.hits.length;
  record(row.hits.length === 0, `prompts/${row.name} has no private identifiers`, row.hits.join(" | "));
}
record(promptHits === 0, `rc4-mobile prompts privacy hits ${promptHits}`);

if (testOnlyPromptRoot) {
  const extraResults = scanPromptDir(testOnlyPromptRoot, "test-only");
  for (const row of extraResults) {
    record(
      row.hits.length === 0,
      `test-only prompt ${row.name} has no private identifiers`,
      row.hits.join(" | ")
    );
  }
}

if (!testOnlyPromptRoot) {
  const leakUla = `http://[${joinParts(["fd12", "", "1"], ":")}]:47100/?token=abc`;
  const leakRfc = `http://${joinParts(["192", "168", "1", "8"], ".")}:47100/?token=abc`;
  const leakLoop = `http://${ipv6LoopbackBracket}:47100/?token=abc`;
  const secrets = [leakUla, leakRfc, leakLoop, ipv6LoopbackBare, ipv6LoopbackBracket];
  const redactedBody = "# leak\nhost parts only; no assembled private address\n";

  function writeSentinel(root) {
    writeFileSync(join(root, TEST_ONLY_SENTINEL), `${TEST_ONLY_TOKEN}\n`);
  }

  function makeIsolatedPromptRoot() {
    const root = mkdtempSync(join(tmpdir(), "saydo-prompt-entry-"));
    writeSentinel(root);
    return root;
  }

  function assertNoEcho(result, label) {
    const out = capturedOutput(result);
    const leaked = secrets.filter((value) => value && out.includes(value));
    record(leaked.length === 0, `${label} does not echo privacy values`);
    const fails = out.split("\n").filter((line) => line.startsWith("[fail]"));
    record(
      fails.every((line) => !/\/Users\//.test(line) && !/\/home\//.test(line) && !/[A-Za-z]:\\Users\\/i.test(line)),
      `${label} fail summary has no absolute home path`
    );
  }

  function bindsRepoPrompts(result, label) {
    const out = result.stdout || "";
    record(
      out.includes("prompt 166 is included in privacy scan") &&
        out.includes("prompt 167 is included in privacy scan"),
      `${label} still binds repo prompts`
    );
  }

  const topRoot = makeIsolatedPromptRoot();
  writeFileSync(join(topRoot, "999-rc4-mobile-top.md"), `# leak\n${leakUla}\n${leakRfc}\n${leakLoop}\n`);
  const topResult = spawnReleaseContract([TEST_ONLY_FLAG, topRoot]);
  record(topResult.status !== 0, `full entry top-level private category is non-zero (status=${topResult.status})`);
  record(
    (topResult.stdout || "").includes("[fail] test-only prompt 999-rc4-mobile-top.md"),
    "full entry top-level scans the isolated file"
  );
  bindsRepoPrompts(topResult, "full entry top-level");
  assertNoEcho(topResult, "full entry top-level");
  rmSync(topRoot, { recursive: true, force: true });

  const nestedRoot = makeIsolatedPromptRoot();
  mkdirSync(join(nestedRoot, "nested", "deep"), { recursive: true });
  writeFileSync(
    join(nestedRoot, "nested", "deep", "999-rc4-mobile-nested.md"),
    `# leak\n${leakUla}\n${leakRfc}\n${leakLoop}\n`
  );
  const nestedResult = spawnReleaseContract([TEST_ONLY_FLAG, nestedRoot]);
  record(nestedResult.status !== 0, `full entry nested private category is non-zero (status=${nestedResult.status})`);
  record(
    (nestedResult.stdout || "").includes("[fail] test-only prompt nested/deep/999-rc4-mobile-nested.md"),
    "full entry nested scans the deep file"
  );
  bindsRepoPrompts(nestedResult, "full entry nested");
  assertNoEcho(nestedResult, "full entry nested");
  rmSync(nestedRoot, { recursive: true, force: true });

  const cleanRoot = makeIsolatedPromptRoot();
  mkdirSync(join(cleanRoot, "nested", "deep"), { recursive: true });
  writeFileSync(join(cleanRoot, "999-rc4-mobile-top.md"), redactedBody);
  writeFileSync(join(cleanRoot, "nested", "deep", "999-rc4-mobile-nested.md"), redactedBody);
  const envDecoy = mkdtempSync(join(tmpdir(), "saydo-prompt-env-"));
  const cleanResult = spawnReleaseContract(
    [TEST_ONLY_FLAG, cleanRoot, "--prompt-dir", envDecoy],
    {
      SAYDO_PROMPT_DIR: envDecoy,
      SAYDO_TEST_PROMPT_ROOT: envDecoy,
      SAYDO_TEST_ONLY_PROMPT_ROOT: envDecoy
    }
  );
  record(cleanResult.status === 0, `full entry after redact is zero (status=${cleanResult.status})`);
  bindsRepoPrompts(cleanResult, "full entry redact");
  assertNoEcho(cleanResult, "full entry redact");
  rmSync(cleanRoot, { recursive: true, force: true });
  rmSync(envDecoy, { recursive: true, force: true });
}

if (fail > 0) {
  process.stdout.write(`[fail] mobile release contract ${fail} failed, ${pass} passed\n`);
  process.exit(1);
}
process.stdout.write(`[ok] mobile release contract ${pass} passed\n`);
