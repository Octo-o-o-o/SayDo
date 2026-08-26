#!/usr/bin/env node
// 三端安装器确定性自测:只用临时 fake 工具,不接触真机或真实设备列表。
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const repo = dirname(scriptsDir);
const commonLib = join(scriptsDir, "mobile-install-common.sh");
const installers = {
  ios: join(repo, "apps/ios/build-and-install.sh"),
  android: join(repo, "apps/android/build-and-install.sh"),
  harmonyos: join(repo, "apps/harmonyos/build-and-install.sh")
};

let pass = 0;
let fail = 0;

function record(ok, label, detail = "") {
  if (ok) {
    process.stdout.write(`[ok] ${label}\n`);
    pass += 1;
  } else {
    process.stdout.write(`[fail] ${label}${detail ? `: ${detail}` : ""}\n`);
    fail += 1;
  }
}

function writeExec(path, body) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
  chmodSync(path, 0o755);
}

function syntaxCheck() {
  for (const [name, file] of Object.entries(installers)) {
    const result = spawnSync("bash", ["-n", file], { encoding: "utf8" });
    record(result.status === 0, `bash -n ${name}`, result.stderr);
  }
  const common = spawnSync("bash", ["-n", commonLib], { encoding: "utf8" });
  record(common.status === 0, "bash -n mobile-install-common.sh", common.stderr);
}

function makeHarness() {
  const root = mkdtempSync(join(tmpdir(), "saydo-mobile-install-"));
  const state = join(root, "state");
  const bin = join(root, "bin");
  const home = join(root, "home");
  const log = join(root, "fake.log");
  mkdirSync(state);
  mkdirSync(bin);
  mkdirSync(home);
  writeFileSync(log, "");
  writeFileSync(join(state, "xcodebuild-mode"), "ok\n");
  writeFileSync(join(state, "codesign-status"), "0\n");
  writeFileSync(join(state, "gradle-mode"), "ok\n");
  writeFileSync(join(state, "hvigor-mode"), "signed\n");
  writeFileSync(
    join(state, "ios-devices.json"),
    JSON.stringify({
      result: {
        devices: [
          {
            identifier: "IOS-ONE",
            hardwareProperties: { platform: "iOS", reality: "physical" },
            connectionProperties: { tunnelState: "connected", pairingState: "paired" }
          }
        ]
      }
    })
  );
  writeFileSync(join(state, "adb-devices.txt"), "List of devices attached\nANDROIDONE\tdevice\n");
  writeFileSync(join(state, "hdc-targets.txt"), "HARMONYONE\n");
  writeFileSync(join(state, "apksigner-status"), "0\n");
  writeFileSync(join(state, "aapt2-package"), "com.octoooo.saydo\n");
  writeFileSync(join(state, "aapt2-version"), "0.1.0\n");
  writeFileSync(join(state, "hap-verify-status"), "0\n");
  writeFileSync(join(state, "adb-props-default"), "physical\n");
  writeFileSync(join(state, "hdc-model"), "GenericPhone\n");
  writeFileSync(join(state, "hdc-devicetype"), "phone\n");
  writeFileSync(join(state, "hdc-hardware"), "chipset\n");
  writeFileSync(join(state, "hdc-probe"), "ok\n");
  writeFileSync(join(state, "ios-plist-id"), "com.octoooo.saydo\n");
  writeFileSync(join(state, "ios-plist-short"), "0.1.0\n");
  writeFileSync(join(state, "ios-plist-build"), "1\n");

  writeExec(
    join(bin, "xcodegen"),
    `#!/bin/sh
echo "xcodegen $*" >> "$SAYDO_FAKE_LOG"
mkdir -p SayDo.xcodeproj
exit 0
`
  );
  writeExec(
    join(bin, "xcodebuild"),
    `#!/bin/sh
echo "xcodebuild $*" >> "$SAYDO_FAKE_LOG"
mode=$(cat "$SAYDO_FAKE_STATE/xcodebuild-mode")
app=".build/Build/Products/Debug-iphoneos/SayDo.app"
if [ "$mode" = "ok" ]; then
  rm -rf "$app"
  mkdir -p "$app"
  echo stub > "$app/SayDo"
  ident=$(cat "$SAYDO_FAKE_STATE/ios-plist-id" | tr -d '\n')
  short=$(cat "$SAYDO_FAKE_STATE/ios-plist-short" | tr -d '\n')
  build=$(cat "$SAYDO_FAKE_STATE/ios-plist-build" | tr -d '\n')
  python3 - "$app/Info.plist" "$ident" "$short" "$build" <<'PY'
import plistlib, sys
path, ident, short, build = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
with open(path, "wb") as handle:
    plistlib.dump({
        "CFBundleIdentifier": ident,
        "CFBundleShortVersionString": short,
        "CFBundleVersion": build,
    }, handle)
PY
  touch "$app"
fi
exit 0
`
  );
  writeExec(
    join(bin, "codesign"),
    `#!/bin/sh
echo "codesign $*" >> "$SAYDO_FAKE_LOG"
status=$(cat "$SAYDO_FAKE_STATE/codesign-status")
exit "$status"
`
  );
  writeExec(
    join(bin, "xcrun"),
    `#!/bin/sh
echo "xcrun $*" >> "$SAYDO_FAKE_LOG"
if [ "$1" != "devicectl" ]; then
  echo "unexpected xcrun $*" >&2
  exit 1
fi
shift
if [ "$1" = "list" ]; then
  json=""
  prev=""
  for arg in "$@"; do
    if [ "$prev" = "--json-output" ]; then
      json="$arg"
    fi
    prev="$arg"
  done
  if [ -z "$json" ]; then
    echo "missing --json-output" >&2
    exit 1
  fi
  cp "$SAYDO_FAKE_STATE/ios-devices.json" "$json"
  exit 0
fi
if [ "$1" = "device" ] && [ "$2" = "install" ]; then
  echo "devicectl-install $*" >> "$SAYDO_FAKE_LOG"
  exit 0
fi
echo "unexpected devicectl $*" >&2
exit 1
`
  );
  writeExec(
    join(bin, "adb"),
    `#!/bin/sh
echo "PATH_ADB $*" >> "$SAYDO_FAKE_LOG"
exit 1
`
  );

  const iosRoot = join(root, "ios");
  const androidRoot = join(root, "android");
  const harmonyRoot = join(root, "harmonyos");
  mkdirSync(iosRoot);
  mkdirSync(androidRoot);
  mkdirSync(harmonyRoot);
  copyFileSync(installers.ios, join(iosRoot, "build-and-install.sh"));
  copyFileSync(installers.android, join(androidRoot, "build-and-install.sh"));
  copyFileSync(installers.harmonyos, join(harmonyRoot, "build-and-install.sh"));
  chmodSync(join(iosRoot, "build-and-install.sh"), 0o755);
  chmodSync(join(androidRoot, "build-and-install.sh"), 0o755);
  chmodSync(join(harmonyRoot, "build-and-install.sh"), 0o755);

  const sdk = join(root, "sdk");
  writeExec(
    join(sdk, "platform-tools/adb"),
    `#!/bin/sh
echo "SDK_ADB $*" >> "$SAYDO_FAKE_LOG"
if [ "$1" = "devices" ]; then
  cat "$SAYDO_FAKE_STATE/adb-devices.txt"
  exit 0
fi
if [ "$1" = "-s" ]; then
  serial="$2"
  echo "adb-bind $serial" >> "$SAYDO_FAKE_LOG"
  if [ "$3" = "shell" ] && [ "$4" = "getprop" ]; then
    kind=$(cat "$SAYDO_FAKE_STATE/adb-props-default")
    if [ -f "$SAYDO_FAKE_STATE/adb-props-$serial" ]; then
      kind=$(cat "$SAYDO_FAKE_STATE/adb-props-$serial")
    fi
    key="$5"
    if [ "$serial" = "localhost:5555" ] || [ "$serial" = "127.0.0.1:5555" ]; then
      kind=emulator
    fi
    if [ "$kind" = "emulator" ]; then
      case "$key" in
        ro.kernel.qemu|ro.boot.qemu) echo 1 ;;
        ro.hardware) echo goldfish ;;
        ro.product.model) echo sdk_gphone64_arm64 ;;
        ro.build.fingerprint) echo generic/sdk_gphone64_arm64/emulator ;;
        *) echo ;;
      esac
      exit 0
    fi
    if [ "$kind" = "empty-id" ]; then
      case "$key" in
        ro.kernel.qemu|ro.boot.qemu) echo ;;
        ro.hardware) echo qcom ;;
        ro.product.model) echo Pixel ;;
        ro.build.fingerprint) echo ;;
        *) echo ;;
      esac
      exit 0
    fi
    if [ "$kind" = "fail" ]; then
      exit 1
    fi
    if [ "$kind" = "qemu-one" ]; then
      case "$key" in
        ro.kernel.qemu) echo 1 ;;
        ro.boot.qemu) echo ;;
        ro.hardware) echo qcom ;;
        ro.product.model) echo PhoneLike ;;
        ro.build.fingerprint) echo oem/phone/phone:14 ;;
        *) echo ;;
      esac
      exit 0
    fi
    case "$key" in
      ro.kernel.qemu|ro.boot.qemu) echo ;;
      ro.hardware) echo qcom ;;
      ro.product.model) echo Pixel ;;
      ro.build.fingerprint) echo google/pixel/pixel:14 ;;
      *) echo ;;
    esac
    exit 0
  fi
  if [ "$3" = "install" ]; then
    echo "adb-install $serial" >> "$SAYDO_FAKE_LOG"
    exit 0
  fi
  exit 0
fi
exit 1
`
  );
  writeExec(
    join(androidRoot, "gradlew"),
    `#!/bin/sh
echo "gradlew $*" >> "$SAYDO_FAKE_LOG"
mode=$(cat "$SAYDO_FAKE_STATE/gradle-mode")
apk="app/build/outputs/apk/debug/app-debug.apk"
if [ "$mode" = "ok" ]; then
  mkdir -p "$(dirname "$apk")"
  python3 - "$apk" <<'PY'
import zipfile, sys
zipfile.ZipFile(sys.argv[1], "w").writestr("AndroidManifest.xml", "pkg")
PY
fi
if [ "$mode" = "ascii" ]; then
  mkdir -p "$(dirname "$apk")"
  echo apk > "$apk"
fi
exit 0
`
  );
  writeExec(
    join(bin, "apksigner"),
    `#!/bin/sh
echo "apksigner-bin $0 $*" >> "$SAYDO_FAKE_LOG"
echo "apksigner $*" >> "$SAYDO_FAKE_LOG"
status=$(cat "$SAYDO_FAKE_STATE/apksigner-status")
apk=""
prev=""
for arg in "$@"; do
  if [ "$prev" = "verify" ] || [ "$prev" = "--print-certs" ]; then
    :
  fi
  prev="$arg"
  apk="$arg"
done
if [ -f "$apk" ]; then
  head=$(dd if="$apk" bs=2 count=1 2>/dev/null)
  case "$head" in
    PK*) ;;
    *) exit 1 ;;
  esac
fi
exit "$status"
`
  );
  writeExec(
    join(bin, "aapt2"),
    `#!/bin/sh
echo "aapt2-bin $0 $*" >> "$SAYDO_FAKE_LOG"
echo "aapt2 $*" >> "$SAYDO_FAKE_LOG"
if [ "$1" = "dump" ] && [ "$2" = "packagename" ]; then
  cat "$SAYDO_FAKE_STATE/aapt2-package"
  exit 0
fi
if [ "$1" = "dump" ] && [ "$2" = "badging" ]; then
  if [ -f "$SAYDO_FAKE_STATE/aapt2-badging" ]; then
    cat "$SAYDO_FAKE_STATE/aapt2-badging"
    exit 0
  fi
  ver=$(cat "$SAYDO_FAKE_STATE/aapt2-version" | tr -d '\n')
  echo "package: name='com.octoooo.saydo' versionCode='1' versionName='$ver'"
  exit 0
fi
exit 1
`
  );
  writeExec(
    join(bin, "hvigorw"),
    `#!/bin/sh
echo "hvigorw $*" >> "$SAYDO_FAKE_LOG"
mode=$(cat "$SAYDO_FAKE_STATE/hvigor-mode")
signed="entry/build/default/outputs/default/entry-default-signed.hap"
unsigned="entry/build/default/outputs/default/entry-default-unsigned.hap"
mkdir -p "$(dirname "$signed")"
if [ "$mode" = "signed" ]; then
  rm -f "$unsigned"
  python3 - "$signed" <<'PY'
import json, zipfile, sys
with zipfile.ZipFile(sys.argv[1], "w") as archive:
    archive.writestr("module.json", json.dumps({
        "app": {"bundleName": "com.octoooo.saydo", "versionName": "0.1.0"}
    }))
PY
  exit 0
fi
if [ "$mode" = "ascii" ]; then
  rm -f "$unsigned"
  echo signed > "$signed"
  exit 0
fi
if [ "$mode" = "bundle-drift" ] || [ "$mode" = "version-drift" ]; then
  rm -f "$unsigned"
  python3 - "$signed" "$mode" <<'PY'
import json, zipfile, sys
bundle = "com.example.other" if sys.argv[2] == "bundle-drift" else "com.octoooo.saydo"
version = "9.9.9" if sys.argv[2] == "version-drift" else "0.1.0"
with zipfile.ZipFile(sys.argv[1], "w") as archive:
    archive.writestr("module.json", json.dumps({
        "app": {"bundleName": bundle, "versionName": version}
    }))
PY
  exit 0
fi
if [ "$mode" = "unsigned" ]; then
  rm -f "$signed"
  echo unsigned > "$unsigned"
  exit 0
fi
exit 0
`
  );
  writeExec(
    join(bin, "java"),
    `#!/bin/sh
echo "JAVA $*" >> "$SAYDO_FAKE_LOG"
cmd=""
infile=""
outc=""
outp=""
outfile=""
prev=""
for arg in "$@"; do
  if [ "$arg" = "verify-app" ]; then cmd=verify-app; fi
  if [ "$arg" = "verify-profile" ]; then cmd=verify-profile; fi
  if [ "$prev" = "-inFile" ]; then infile="$arg"; fi
  if [ "$prev" = "-outCertChain" ]; then outc="$arg"; fi
  if [ "$prev" = "-outProfile" ]; then outp="$arg"; fi
  if [ "$prev" = "-outFile" ]; then outfile="$arg"; fi
  prev="$arg"
done
status=$(cat "$SAYDO_FAKE_STATE/hap-verify-status")
secret="SAYDO_HAP_PROFILE_UNIQUE_FRAGMENT"
if [ "$cmd" = "verify-app" ]; then
  echo "HAP_ARGV verify-app -inFile $infile -outCertChain $outc -outProfile $outp" >> "$SAYDO_FAKE_LOG"
  echo "hap-verify-app $infile" >> "$SAYDO_FAKE_LOG"
  if [ -f "$infile" ]; then
    head=$(dd if="$infile" bs=2 count=1 2>/dev/null)
    case "$head" in
      PK*) ;;
      *) exit 1 ;;
    esac
  fi
  [ -n "$outc" ] && echo cert > "$outc"
  [ -n "$outp" ] && echo profile > "$outp"
  exit "$status"
fi
if [ "$cmd" = "verify-profile" ]; then
  echo "HAP_ARGV verify-profile -inFile $infile -outFile $outfile" >> "$SAYDO_FAKE_LOG"
  echo "hap-verify-profile $infile" >> "$SAYDO_FAKE_LOG"
  if [ -z "$outfile" ]; then
    echo "$secret"
    exit 1
  fi
  printf '{"verifiedPassed":true,"message":"ok","content":{"%s":"do-not-echo"}}\n' "$secret" > "$outfile"
  exit "$status"
fi
exit 1
`
  );
  writeFileSync(join(bin, "hap-sign-tool.jar"), "fake-jar\n");
  writeExec(
    join(bin, "hdc"),
    `#!/bin/sh
echo "hdc $*" >> "$SAYDO_FAKE_LOG"
if [ "$1" = "list" ] && [ "$2" = "targets" ]; then
  cat "$SAYDO_FAKE_STATE/hdc-targets.txt"
  exit 0
fi
if [ "$1" = "-t" ]; then
  echo "hdc-bind $2" >> "$SAYDO_FAKE_LOG"
  if [ "$3" = "shell" ]; then
    echo "hdc-shell $2" >> "$SAYDO_FAKE_LOG"
    probe=$(cat "$SAYDO_FAKE_STATE/hdc-probe")
    if [ "$probe" = "fail" ]; then
      exit 1
    fi
    if [ "$4" = "echo" ]; then
      echo SAYDO_PROBE
      exit 0
    fi
    if [ "$4" = "param" ] && [ "$5" = "get" ]; then
      key="$6"
      case "$key" in
        const.product.devicetype) cat "$SAYDO_FAKE_STATE/hdc-devicetype" ;;
        ohos.boot.hardware) cat "$SAYDO_FAKE_STATE/hdc-hardware" ;;
        const.product.model) cat "$SAYDO_FAKE_STATE/hdc-model" ;;
        *) echo ;;
      esac
      exit 0
    fi
  fi
  if [ "$3" = "install" ]; then
    echo "hdc-install $2" >> "$SAYDO_FAKE_LOG"
    exit 0
  fi
  exit 0
fi
exit 1
`
  );
  mkdirSync(join(androidRoot, "app"), { recursive: true });
  writeFileSync(join(androidRoot, "app/build.gradle.kts"), 'versionName = "0.1.0"\n');
  mkdirSync(join(harmonyRoot, "AppScope"), { recursive: true });
  writeFileSync(
    join(harmonyRoot, "AppScope/app.json5"),
    '{ "app": { "bundleName": "com.octoooo.saydo", "versionName": "0.1.0" } }\n'
  );
  writeFileSync(
    join(iosRoot, "project.yml"),
    'settings:\n  base:\n    MARKETING_VERSION: "0.1.0"\n    CURRENT_PROJECT_VERSION: "1"\n    PRODUCT_BUNDLE_IDENTIFIER: com.octoooo.saydo\n'
  );

  const env = {
    PATH: `${bin}:/usr/bin:/bin:/usr/sbin:/sbin`,
    HOME: home,
    TMPDIR: join(root, "tmp"),
    SAYDO_INSTALL_LIB: commonLib,
    SAYDO_FAKE_LOG: log,
    SAYDO_FAKE_STATE: state,
    SAYDO_APKSIGNER: join(bin, "apksigner"),
    SAYDO_AAPT2: join(bin, "aapt2"),
    SAYDO_JAVA: join(bin, "java"),
    SAYDO_HAP_SIGN_TOOL: join(bin, "hap-sign-tool.jar"),
    LANG: "C",
    LC_ALL: "C"
  };
  mkdirSync(env.TMPDIR);

  return { root, state, bin, log, env, iosRoot, androidRoot, harmonyRoot, sdk };
}

function runScript(harness, script, args, extraEnv = {}) {
  writeFileSync(harness.log, "");
  return spawnSync("bash", [script, ...args], {
    encoding: "utf8",
    env: { ...harness.env, ...extraEnv },
    cwd: dirname(script)
  });
}

function logText(harness) {
  return readFileSync(harness.log, "utf8");
}

function redact(text) {
  return String(text || "")
    .replace(/\/Users\/[^\s]+/g, "$HOME/...")
    .replace(/\/home\/[^\s]+/g, "$HOME/...")
    .replace(/\/private\/var\/[^\s]+/g, "<private>")
    .replace(/file:\/\/[^\s]+/g, "file-url")
    .replace(
      /\b[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\b/g,
      "<id>"
    );
}

function expectStatus(result, status, label) {
  record(
    result.status === status,
    label,
    `exit=${result.status} stdout=${redact(result.stdout).trim()} stderr=${redact(result.stderr).trim()}`
  );
}

function expectOutputHas(result, snippet, label) {
  const text = `${result.stdout || ""}\n${result.stderr || ""}`;
  record(text.includes(snippet), label, redact(text).trim());
}

function runCases() {
  const harness = makeHarness();
  try {
    expectStatus(
      runScript(harness, join(harness.iosRoot, "build-and-install.sh"), ["--build-only"]),
      0,
      "iOS --build-only succeeds without device list"
    );
    record(
      !logText(harness).includes("devicectl list"),
      "iOS --build-only does not query devices"
    );
    record(
      logText(harness).includes("generic/platform=iOS"),
      "iOS --build-only uses generic iOS destination"
    );

    writeFileSync(
      join(harness.state, "ios-devices.json"),
      JSON.stringify({ result: { devices: [] } })
    );
    expectStatus(
      runScript(harness, join(harness.iosRoot, "build-and-install.sh"), []),
      1,
      "iOS zero devices fail-closed"
    );
    expectOutputHas(
      runScript(harness, join(harness.iosRoot, "build-and-install.sh"), []),
      "未发现已连接的 iOS 真机",
      "iOS zero devices explains how to continue"
    );

    writeFileSync(
      join(harness.state, "ios-devices.json"),
      JSON.stringify({
        result: {
          devices: [
            {
              identifier: "IOS-ONE",
              hardwareProperties: { platform: "iOS", reality: "physical" },
              connectionProperties: { tunnelState: "connected", pairingState: "paired" }
            },
            {
              identifier: "IOS-TWO",
              hardwareProperties: { platform: "iOS", reality: "physical" },
              connectionProperties: { tunnelState: "connected", pairingState: "paired" }
            }
          ]
        }
      })
    );
    const iosMulti = runScript(harness, join(harness.iosRoot, "build-and-install.sh"), []);
    expectStatus(iosMulti, 1, "iOS multiple devices fail-closed");
    record(
      !logText(harness).includes("devicectl-install"),
      "iOS multiple devices does not install the first id"
    );

    writeFileSync(
      join(harness.state, "ios-devices.json"),
      JSON.stringify({
        result: {
          devices: [
            {
              identifier: "IOS-OFF",
              hardwareProperties: { platform: "iOS", reality: "physical" },
              connectionProperties: { tunnelState: "disconnected" }
            }
          ]
        }
      })
    );
    expectStatus(
      runScript(harness, join(harness.iosRoot, "build-and-install.sh"), []),
      1,
      "iOS offline-only fail-closed"
    );

    writeFileSync(
      join(harness.state, "ios-devices.json"),
      JSON.stringify({
        result: {
          devices: [
            {
              identifier: "IOS-NO-REALITY",
              hardwareProperties: { platform: "iOS" },
              connectionProperties: { tunnelState: "connected", pairingState: "paired" }
            }
          ]
        }
      })
    );
    expectStatus(
      runScript(harness, join(harness.iosRoot, "build-and-install.sh"), []),
      1,
      "iOS missing reality is not treated as physical"
    );
    record(
      !logText(harness).includes("devicectl-install"),
      "iOS missing reality does not install"
    );

    writeFileSync(
      join(harness.state, "ios-devices.json"),
      JSON.stringify({
        result: {
          devices: [
            {
              identifier: "IOS-NO-PAIRING",
              hardwareProperties: { platform: "iOS", reality: "physical" },
              connectionProperties: { tunnelState: "connected" }
            }
          ]
        }
      })
    );
    expectStatus(
      runScript(harness, join(harness.iosRoot, "build-and-install.sh"), []),
      1,
      "iOS missing pairingState fail-closed"
    );
    writeFileSync(
      join(harness.state, "ios-devices.json"),
      JSON.stringify({
        result: {
          devices: [
            {
              identifier: "IOS-DIAG",
              hardwareProperties: { platform: "iOS", reality: "physical" },
              connectionProperties: { tunnelState: "connected", pairingState: "diagnostic" }
            }
          ]
        }
      })
    );
    expectStatus(
      runScript(harness, join(harness.iosRoot, "build-and-install.sh"), []),
      1,
      "iOS unknown pairingState fail-closed"
    );
    writeFileSync(
      join(harness.state, "ios-devices.json"),
      JSON.stringify({
        result: {
          devices: [
            {
              identifier: "IOS-TUNNEL",
              hardwareProperties: { platform: "iOS", reality: "physical" },
              connectionProperties: { tunnelState: "diagnostic", pairingState: "paired" }
            }
          ]
        }
      })
    );
    expectStatus(
      runScript(harness, join(harness.iosRoot, "build-and-install.sh"), []),
      1,
      "iOS unknown tunnelState fail-closed"
    );

    writeFileSync(
      join(harness.state, "ios-devices.json"),
      JSON.stringify({
        result: {
          devices: [
            {
              identifier: "IOS-ONE",
              hardwareProperties: { platform: "iOS", reality: "physical" },
              connectionProperties: { tunnelState: "connected", pairingState: "paired" }
            }
          ]
        }
      })
    );
    const iosOk = runScript(harness, join(harness.iosRoot, "build-and-install.sh"), []);
    expectStatus(iosOk, 0, "iOS one available device installs");
    record(
      logText(harness).includes("-destination id=IOS-ONE"),
      "iOS xcodebuild binds id= of the resolved device"
    );
    record(
      logText(harness).includes("devicectl-install") &&
        logText(harness).includes("--device IOS-ONE"),
      "iOS devicectl binds the same device id"
    );

    const iosMissing = runScript(
      harness,
      join(harness.iosRoot, "build-and-install.sh"),
      ["--device", "IOS-MISSING"]
    );
    expectStatus(iosMissing, 1, "iOS explicit missing device fail-closed");

    writeFileSync(join(harness.state, "xcodebuild-mode"), "stale\n");
    const iosApp = join(harness.iosRoot, ".build/Build/Products/Debug-iphoneos/SayDo.app");
    mkdirSync(iosApp, { recursive: true });
    writeFileSync(join(iosApp, "SayDo"), "old");
    spawnSync("touch", ["-t", "203501010000", iosApp], { encoding: "utf8" });
    const iosFuture = runScript(harness, join(harness.iosRoot, "build-and-install.sh"), ["--build-only"]);
    expectStatus(iosFuture, 1, "iOS future-timestamp .app fail-closed");
    record(!logText(harness).includes("devicectl-install"), "iOS future-timestamp .app does not install");

    mkdirSync(iosApp, { recursive: true });
    writeFileSync(join(iosApp, "SayDo"), "old");
    spawnSync("touch", [iosApp], { encoding: "utf8" });
    const iosSame = runScript(harness, join(harness.iosRoot, "build-and-install.sh"), ["--build-only"]);
    expectStatus(iosSame, 1, "iOS same-timestamp .app fail-closed");
    record(!logText(harness).includes("devicectl-install"), "iOS same-timestamp .app does not install");

    const iosReal = `${iosApp}.real`;
    rmSync(iosApp, { recursive: true, force: true });
    mkdirSync(iosReal, { recursive: true });
    writeFileSync(join(iosReal, "SayDo"), "old");
    symlinkSync(iosReal, iosApp);
    const iosLink = runScript(harness, join(harness.iosRoot, "build-and-install.sh"), ["--build-only"]);
    expectStatus(iosLink, 1, "iOS symlink .app fail-closed");
    record(!logText(harness).includes("devicectl-install"), "iOS symlink .app does not install");
    writeFileSync(join(harness.state, "xcodebuild-mode"), "ok\n");

    writeFileSync(join(harness.state, "codesign-status"), "1\n");
    expectStatus(
      runScript(harness, join(harness.iosRoot, "build-and-install.sh"), ["--build-only"]),
      1,
      "iOS codesign failure fail-closed"
    );
    writeFileSync(join(harness.state, "codesign-status"), "0\n");

    writeFileSync(join(harness.state, "ios-plist-id"), "com.example.other\n");
    expectStatus(
      runScript(harness, join(harness.iosRoot, "build-and-install.sh"), ["--build-only"]),
      1,
      "iOS signed app with wrong CFBundleIdentifier fail-closed"
    );
    writeFileSync(join(harness.state, "ios-plist-id"), "com.octoooo.saydo\n");
    writeFileSync(join(harness.state, "ios-plist-short"), "9.9.9\n");
    expectStatus(
      runScript(harness, join(harness.iosRoot, "build-and-install.sh"), ["--build-only"]),
      1,
      "iOS signed app with wrong CFBundleShortVersionString fail-closed"
    );
    writeFileSync(join(harness.state, "ios-plist-short"), "0.1.0\n");
    writeFileSync(join(harness.state, "ios-plist-build"), "99\n");
    expectStatus(
      runScript(harness, join(harness.iosRoot, "build-and-install.sh"), ["--build-only"]),
      1,
      "iOS signed app with wrong CFBundleVersion fail-closed"
    );
    writeFileSync(join(harness.state, "ios-plist-build"), "1\n");

    writeFileSync(
      join(harness.state, "ios-devices.json"),
      JSON.stringify({
        result: {
          devices: [
            {
              identifier: "IOS-ONE",
              hardwareProperties: { platform: "iOS", reality: "physical" },
              connectionProperties: { tunnelState: "connected", pairingState: "paired" }
            }
          ]
        }
      })
    );
    writeFileSync(join(harness.state, "ios-plist-id"), "com.example.other\n");
    expectStatus(
      runScript(harness, join(harness.iosRoot, "build-and-install.sh"), []),
      1,
      "iOS signed app with wrong identity does not install"
    );
    record(
      !logText(harness).includes("devicectl-install"),
      "iOS wrong identity is rejected before install"
    );
    writeFileSync(join(harness.state, "ios-plist-id"), "com.octoooo.saydo\n");

    const iosOutside = join(harness.root, "ios-outside");
    mkdirSync(join(iosOutside, "Build/Products/Debug-iphoneos/SayDo.app"), { recursive: true });
    writeFileSync(join(iosOutside, "SENTINEL"), "keep");
    writeFileSync(join(iosOutside, "Build/Products/Debug-iphoneos/SayDo.app/payload"), "victim");
    const iosBuildLink = join(harness.iosRoot, ".build");
    rmSync(iosBuildLink, { recursive: true, force: true });
    symlinkSync(iosOutside, iosBuildLink);
    expectStatus(
      runScript(harness, join(harness.iosRoot, "build-and-install.sh"), ["--build-only"]),
      1,
      "iOS parent symlink .build fail-closed"
    );
    record(existsSync(join(iosOutside, "SENTINEL")), "iOS parent symlink keeps external sentinel");
    rmSync(iosBuildLink, { force: true });

    const androidEnv = {
      ANDROID_HOME: harness.sdk,
      ANDROID_SDK_ROOT: harness.sdk,
      HVIGORW_BIN: join(harness.bin, "hvigorw"),
      HDC_BIN: join(harness.bin, "hdc")
    };

    const androidBuildOnly = runScript(
      harness,
      join(harness.androidRoot, "build-and-install.sh"),
      ["--build-only"],
      androidEnv
    );
    expectStatus(androidBuildOnly, 0, "Android --build-only succeeds without device");
    record(logText(harness).includes("apksigner"), "Android --build-only invokes apksigner");

    const toolsSdk = join(harness.root, "sdk-tools-shuffled");
    mkdirSync(join(toolsSdk, "platform-tools"), { recursive: true });
    copyFileSync(join(harness.sdk, "platform-tools/adb"), join(toolsSdk, "platform-tools/adb"));
    chmodSync(join(toolsSdk, "platform-tools/adb"), 0o755);
    for (const version of ["9.0.0", "36.0.0", "19.0.0", "36.1.0"]) {
      mkdirSync(join(toolsSdk, "build-tools", version), { recursive: true });
      copyFileSync(join(harness.bin, "apksigner"), join(toolsSdk, "build-tools", version, "apksigner"));
      copyFileSync(join(harness.bin, "aapt2"), join(toolsSdk, "build-tools", version, "aapt2"));
      chmodSync(join(toolsSdk, "build-tools", version, "apksigner"), 0o755);
      chmodSync(join(toolsSdk, "build-tools", version, "aapt2"), 0o755);
    }
    const androidHighest = runScript(
      harness,
      join(harness.androidRoot, "build-and-install.sh"),
      ["--build-only"],
      {
        ANDROID_HOME: toolsSdk,
        ANDROID_SDK_ROOT: toolsSdk,
        SAYDO_APKSIGNER: "",
        SAYDO_AAPT2: ""
      }
    );
    expectStatus(androidHighest, 0, "Android picks highest build-tools among shuffled versions");
    record(
      logText(harness).includes("build-tools/36.1.0/apksigner") &&
        !logText(harness).includes("build-tools/9.0.0/apksigner"),
      "Android highest build-tools is 36.1.0 not 9.0.0"
    );

    const oldSdk = join(harness.root, "sdk-old-build-tools");
    mkdirSync(join(oldSdk, "platform-tools"), { recursive: true });
    copyFileSync(join(harness.sdk, "platform-tools/adb"), join(oldSdk, "platform-tools/adb"));
    chmodSync(join(oldSdk, "platform-tools/adb"), 0o755);
    mkdirSync(join(oldSdk, "build-tools/19.0.0"), { recursive: true });
    writeExec(
      join(oldSdk, "build-tools/19.0.0/apksigner"),
      `#!/bin/sh
echo "apksigner-bin $0 $*" >> "$SAYDO_FAKE_LOG"
exit 1
`
    );
    writeExec(
      join(oldSdk, "build-tools/19.0.0/aapt2"),
      `#!/bin/sh
echo "aapt2-bin $0 $*" >> "$SAYDO_FAKE_LOG"
exit 1
`
    );
    expectStatus(
      runScript(harness, join(harness.androidRoot, "build-and-install.sh"), ["--build-only"], {
        ANDROID_HOME: oldSdk,
        ANDROID_SDK_ROOT: oldSdk,
        SAYDO_APKSIGNER: "",
        SAYDO_AAPT2: ""
      }),
      1,
      "Android old build-tools fail-closed"
    );

    writeFileSync(join(harness.state, "gradle-mode"), "ascii\n");
    const androidAscii = runScript(
      harness,
      join(harness.androidRoot, "build-and-install.sh"),
      ["--build-only"],
      androidEnv
    );
    expectStatus(androidAscii, 1, "Android ASCII fake APK fail-closed");
    record(logText(harness).includes("apksigner"), "Android ASCII APK still invokes apksigner");
    writeFileSync(join(harness.state, "gradle-mode"), "ok\n");

    writeFileSync(join(harness.state, "apksigner-status"), "1\n");
    expectStatus(
      runScript(harness, join(harness.androidRoot, "build-and-install.sh"), ["--build-only"], androidEnv),
      1,
      "Android apksigner non-zero fail-closed"
    );
    writeFileSync(join(harness.state, "apksigner-status"), "0\n");

    writeFileSync(join(harness.state, "aapt2-package"), "com.example.other\n");
    expectStatus(
      runScript(harness, join(harness.androidRoot, "build-and-install.sh"), ["--build-only"], androidEnv),
      1,
      "Android applicationId drift fail-closed"
    );
    writeFileSync(join(harness.state, "aapt2-package"), "com.octoooo.saydo\n");
    writeFileSync(join(harness.state, "aapt2-version"), "9.9.9\n");
    expectStatus(
      runScript(harness, join(harness.androidRoot, "build-and-install.sh"), ["--build-only"], androidEnv),
      1,
      "Android versionName drift fail-closed"
    );
    writeFileSync(join(harness.state, "aapt2-version"), "0.1.0\n");
    writeFileSync(
      join(harness.state, "aapt2-badging"),
      "package: name='com.octoooo.saydo' versionCode='1' versionName='0a1a0'\n"
    );
    expectStatus(
      runScript(harness, join(harness.androidRoot, "build-and-install.sh"), ["--build-only"], androidEnv),
      1,
      "Android regex-decoy versionName fail-closed"
    );
    writeFileSync(
      join(harness.state, "aapt2-badging"),
      "package: name='com.octoooo.saydo' versionCode='1' versionName='0.1.0-preview'\n"
    );
    expectStatus(
      runScript(harness, join(harness.androidRoot, "build-and-install.sh"), ["--build-only"], androidEnv),
      1,
      "Android approximate versionName fail-closed"
    );
    rmSync(join(harness.state, "aapt2-badging"), { force: true });

    expectStatus(
      runScript(harness, join(harness.androidRoot, "build-and-install.sh"), ["--build-only"], {
        ...androidEnv,
        SAYDO_APKSIGNER: join(harness.root, "missing-apksigner")
      }),
      1,
      "Android missing apksigner fail-closed"
    );
    expectStatus(
      runScript(harness, join(harness.androidRoot, "build-and-install.sh"), ["--build-only"], {
        ...androidEnv,
        SAYDO_AAPT2: join(harness.root, "missing-aapt2")
      }),
      1,
      "Android missing aapt2 fail-closed"
    );

    writeFileSync(join(harness.state, "adb-devices.txt"), "List of devices attached\n");
    expectStatus(
      runScript(harness, join(harness.androidRoot, "build-and-install.sh"), [], androidEnv),
      1,
      "Android zero devices fail-closed"
    );

    writeFileSync(
      join(harness.state, "adb-devices.txt"),
      "List of devices attached\nANDROIDONE\tdevice\nANDROIDTWO\tdevice\n"
    );
    const androidMulti = runScript(
      harness,
      join(harness.androidRoot, "build-and-install.sh"),
      [],
      androidEnv
    );
    expectStatus(androidMulti, 1, "Android multiple devices fail-closed");
    record(!logText(harness).includes("adb-install"), "Android multiple devices does not install first serial");

    writeFileSync(
      join(harness.state, "adb-devices.txt"),
      "List of devices attached\nANDROIDONE\toffline\n"
    );
    expectStatus(
      runScript(harness, join(harness.androidRoot, "build-and-install.sh"), [], androidEnv),
      1,
      "Android offline-only fail-closed"
    );

    writeFileSync(
      join(harness.state, "adb-devices.txt"),
      "List of devices attached\nANDROIDONE\tunauthorized\n"
    );
    expectStatus(
      runScript(harness, join(harness.androidRoot, "build-and-install.sh"), [], androidEnv),
      1,
      "Android unauthorized fail-closed"
    );

    writeFileSync(
      join(harness.state, "adb-devices.txt"),
      "List of devices attached\nemulator-5554\tdevice\n"
    );
    expectStatus(
      runScript(harness, join(harness.androidRoot, "build-and-install.sh"), [], androidEnv),
      1,
      "Android emulator-only is not treated as a physical device"
    );

    writeFileSync(
      join(harness.state, "adb-devices.txt"),
      "List of devices attached\nlocalhost:5555\tdevice\n"
    );
    const androidLocalhost = runScript(
      harness,
      join(harness.androidRoot, "build-and-install.sh"),
      [],
      androidEnv
    );
    expectStatus(androidLocalhost, 1, "Android localhost emulator alias fail-closed");
    record(!logText(harness).includes("install -r"), "Android localhost emulator does not install");
    const androidLocalhostExplicit = runScript(
      harness,
      join(harness.androidRoot, "build-and-install.sh"),
      ["--device", "localhost:5555"],
      androidEnv
    );
    expectStatus(androidLocalhostExplicit, 1, "Android explicit localhost emulator fail-closed");

    writeFileSync(
      join(harness.state, "adb-devices.txt"),
      "List of devices attached\nANDROIDONE\tdevice\n"
    );
    writeFileSync(join(harness.state, "adb-props-ANDROIDONE"), "emulator\n");
    const androidEmulatorExplicit = runScript(
      harness,
      join(harness.androidRoot, "build-and-install.sh"),
      ["--device", "ANDROIDONE"],
      androidEnv
    );
    expectStatus(androidEmulatorExplicit, 1, "Android explicit emulator serial fail-closed");
    record(!logText(harness).includes("install -r"), "Android explicit emulator does not install");
    writeFileSync(join(harness.state, "adb-props-ANDROIDONE"), "empty-id\n");
    expectStatus(
      runScript(harness, join(harness.androidRoot, "build-and-install.sh"), [], androidEnv),
      1,
      "Android empty identity fields fail-closed"
    );
    writeFileSync(join(harness.state, "adb-props-ANDROIDONE"), "fail\n");
    expectStatus(
      runScript(harness, join(harness.androidRoot, "build-and-install.sh"), [], androidEnv),
      1,
      "Android getprop failure fail-closed"
    );
    writeFileSync(join(harness.state, "adb-props-ANDROIDONE"), "qemu-one\n");
    expectStatus(
      runScript(harness, join(harness.androidRoot, "build-and-install.sh"), [], androidEnv),
      1,
      "Android qemu=1 with phone-like identity fail-closed"
    );
    record(!logText(harness).includes("install -r"), "Android qemu=1 does not install");
    writeFileSync(join(harness.state, "adb-props-ANDROIDONE"), "physical\n");

    writeFileSync(
      join(harness.state, "adb-devices.txt"),
      "List of devices attached\nANDROIDONE\tdevice\n"
    );
    const androidOk = runScript(
      harness,
      join(harness.androidRoot, "build-and-install.sh"),
      [],
      androidEnv
    );
    expectStatus(androidOk, 0, "Android one device installs");
    record(logText(harness).includes("SDK_ADB -s ANDROIDONE"), "Android uses SDK adb -s binding");
    record(!logText(harness).includes("PATH_ADB"), "Android does not use PATH adb");

    const androidMissing = runScript(
      harness,
      join(harness.androidRoot, "build-and-install.sh"),
      ["--device", "NO-SUCH-SERIAL"],
      androidEnv
    );
    expectStatus(androidMissing, 1, "Android explicit missing serial fail-closed");

    writeFileSync(
      join(harness.state, "adb-devices.txt"),
      "List of devices attached\nANDROIDONE\toffline\n"
    );
    expectStatus(
      runScript(
        harness,
        join(harness.androidRoot, "build-and-install.sh"),
        ["--device", "ANDROIDONE"],
        androidEnv
      ),
      1,
      "Android explicit offline serial fail-closed"
    );

    writeFileSync(join(harness.state, "gradle-mode"), "stale\n");
    const staleApk = join(harness.androidRoot, "app/build/outputs/apk/debug/app-debug.apk");
    mkdirSync(dirname(staleApk), { recursive: true });
    writeFileSync(staleApk, "old");
    spawnSync("touch", ["-t", "203501010000", staleApk], { encoding: "utf8" });
    const androidFuture = runScript(
      harness,
      join(harness.androidRoot, "build-and-install.sh"),
      ["--build-only"],
      androidEnv
    );
    expectStatus(androidFuture, 1, "Android future-timestamp APK fail-closed");
    record(!logText(harness).includes("adb-bind"), "Android future-timestamp APK does not install");

    writeFileSync(staleApk, "old");
    spawnSync("touch", [staleApk], { encoding: "utf8" });
    const androidSame = runScript(
      harness,
      join(harness.androidRoot, "build-and-install.sh"),
      ["--build-only"],
      androidEnv
    );
    expectStatus(androidSame, 1, "Android same-timestamp APK fail-closed");
    record(!logText(harness).includes("adb-bind"), "Android same-timestamp APK does not install");

    writeFileSync(`${staleApk}.real`, "old");
    rmSync(staleApk, { force: true });
    symlinkSync(`${staleApk}.real`, staleApk);
    const androidLink = runScript(
      harness,
      join(harness.androidRoot, "build-and-install.sh"),
      ["--build-only"],
      androidEnv
    );
    expectStatus(androidLink, 1, "Android symlink APK fail-closed");
    record(!logText(harness).includes("adb-bind"), "Android symlink APK does not install");
    writeFileSync(join(harness.state, "gradle-mode"), "ok\n");

    const androidOutside = join(harness.root, "android-outside");
    mkdirSync(join(androidOutside, "outputs/apk/debug"), { recursive: true });
    writeFileSync(join(androidOutside, "SENTINEL"), "keep");
    mkdirSync(join(harness.androidRoot, "app"), { recursive: true });
    const androidBuildLink = join(harness.androidRoot, "app/build");
    rmSync(androidBuildLink, { recursive: true, force: true });
    symlinkSync(androidOutside, androidBuildLink);
    expectStatus(
      runScript(harness, join(harness.androidRoot, "build-and-install.sh"), ["--build-only"], androidEnv),
      1,
      "Android parent symlink app/build fail-closed"
    );
    record(existsSync(join(androidOutside, "SENTINEL")), "Android parent symlink keeps external sentinel");
    rmSync(androidBuildLink, { force: true });

    const androidPropsRoot = join(harness.root, "android-props");
    mkdirSync(androidPropsRoot);
    copyFileSync(installers.android, join(androidPropsRoot, "build-and-install.sh"));
    chmodSync(join(androidPropsRoot, "build-and-install.sh"), 0o755);
    copyFileSync(join(harness.androidRoot, "gradlew"), join(androidPropsRoot, "gradlew"));
    mkdirSync(join(androidPropsRoot, "app"), { recursive: true });
    writeFileSync(join(androidPropsRoot, "app/build.gradle.kts"), 'versionName = "0.1.0"\n');
    writeFileSync(join(androidPropsRoot, "local.properties"), `sdk.dir=${harness.sdk}\n`);
    const androidFromProps = runScript(
      harness,
      join(androidPropsRoot, "build-and-install.sh"),
      ["--build-only"],
      { ANDROID_HOME: "", ANDROID_SDK_ROOT: "" }
    );
    expectStatus(androidFromProps, 0, "Android discovers SDK from local.properties when env is empty");

    const sdkNoAdb = join(harness.root, "sdk-no-adb");
    mkdirSync(join(sdkNoAdb, "platforms"), { recursive: true });
    const androidNoAdbEnv = {
      ANDROID_HOME: sdkNoAdb,
      ANDROID_SDK_ROOT: sdkNoAdb
    };
    expectStatus(
      runScript(
        harness,
        join(harness.androidRoot, "build-and-install.sh"),
        ["--build-only"],
        androidNoAdbEnv
      ),
      0,
      "Android --build-only succeeds when SDK has no adb"
    );
    const androidNoAdbInstall = runScript(
      harness,
      join(harness.androidRoot, "build-and-install.sh"),
      [],
      androidNoAdbEnv
    );
    expectStatus(androidNoAdbInstall, 1, "Android install fail-closed when adb is missing");
    record(!logText(harness).includes("adb-bind"), "Android install without adb does not bind a serial");

    const harmonyEnv = {
      HVIGORW_BIN: join(harness.bin, "hvigorw"),
      HDC_BIN: join(harness.bin, "hdc"),
      DEVECO_SDK_HOME: join(harness.root, "empty-sdk")
    };
    mkdirSync(harmonyEnv.DEVECO_SDK_HOME);

    const harmonySigned = runScript(
      harness,
      join(harness.harmonyRoot, "build-and-install.sh"),
      ["--build-only"],
      harmonyEnv
    );
    expectStatus(harmonySigned, 0, "Harmony --build-only succeeds with signed HAP");
    record(logText(harness).includes("hap-verify-app"), "Harmony --build-only invokes verify-app");
    record(
      /HAP_ARGV verify-app -inFile .+ -outCertChain .+ -outProfile .+/.test(logText(harness)),
      "Harmony verify-app uses -inFile -outCertChain -outProfile in order"
    );
    record(
      /HAP_ARGV verify-profile -inFile .+ -outFile .+/.test(logText(harness)),
      "Harmony verify-profile uses -inFile -outFile in order"
    );
    record(
      !`${harmonySigned.stdout || ""}\n${harmonySigned.stderr || ""}`.includes(
        "SAYDO_HAP_PROFILE_UNIQUE_FRAGMENT"
      ),
      "Harmony installer stdout/stderr omit profile unique fragment"
    );

    writeFileSync(join(harness.state, "hvigor-mode"), "ascii\n");
    const harmonyAscii = runScript(
      harness,
      join(harness.harmonyRoot, "build-and-install.sh"),
      ["--build-only"],
      harmonyEnv
    );
    expectStatus(harmonyAscii, 1, "Harmony ASCII fake HAP fail-closed");
    record(logText(harness).includes("hap-verify-app"), "Harmony ASCII HAP still invokes verify-app");
    writeFileSync(join(harness.state, "hvigor-mode"), "signed\n");

    writeFileSync(join(harness.state, "hap-verify-status"), "1\n");
    expectStatus(
      runScript(harness, join(harness.harmonyRoot, "build-and-install.sh"), ["--build-only"], harmonyEnv),
      1,
      "Harmony verify-app non-zero fail-closed"
    );
    writeFileSync(join(harness.state, "hap-verify-status"), "0\n");

    expectStatus(
      runScript(harness, join(harness.harmonyRoot, "build-and-install.sh"), ["--build-only"], {
        ...harmonyEnv,
        SAYDO_JAVA: join(harness.root, "missing-java")
      }),
      1,
      "Harmony missing java fail-closed"
    );
    expectStatus(
      runScript(harness, join(harness.harmonyRoot, "build-and-install.sh"), ["--build-only"], {
        ...harmonyEnv,
        SAYDO_HAP_SIGN_TOOL: join(harness.root, "missing-hap-sign-tool.jar")
      }),
      1,
      "Harmony missing hap-sign-tool fail-closed"
    );

    writeFileSync(join(harness.state, "hvigor-mode"), "bundle-drift\n");
    const harmonyBundle = runScript(
      harness,
      join(harness.harmonyRoot, "build-and-install.sh"),
      ["--build-only"],
      harmonyEnv
    );
    expectStatus(harmonyBundle, 1, "Harmony bundleName drift fail-closed");
    record(logText(harness).includes("hap-verify-app"), "Harmony bundle drift still invokes verify-app");
    writeFileSync(join(harness.state, "hvigor-mode"), "version-drift\n");
    const harmonyVersion = runScript(
      harness,
      join(harness.harmonyRoot, "build-and-install.sh"),
      ["--build-only"],
      harmonyEnv
    );
    expectStatus(harmonyVersion, 1, "Harmony versionName drift fail-closed");
    record(logText(harness).includes("hap-verify-app"), "Harmony version drift still invokes verify-app");
    writeFileSync(join(harness.state, "hvigor-mode"), "signed\n");

    const harmonyNoHdcEnv = {
      HVIGORW_BIN: join(harness.bin, "hvigorw"),
      HDC_BIN: join(harness.root, "missing-hdc"),
      DEVECO_SDK_HOME: join(harness.root, "empty-sdk")
    };
    expectStatus(
      runScript(
        harness,
        join(harness.harmonyRoot, "build-and-install.sh"),
        ["--build-only"],
        harmonyNoHdcEnv
      ),
      0,
      "Harmony --build-only succeeds when hdc is missing"
    );
    const harmonyNoHdcInstall = runScript(
      harness,
      join(harness.harmonyRoot, "build-and-install.sh"),
      [],
      harmonyNoHdcEnv
    );
    expectStatus(harmonyNoHdcInstall, 1, "Harmony install fail-closed when hdc is missing");
    record(!logText(harness).includes("hdc-bind"), "Harmony install without hdc does not bind a target");

    writeFileSync(join(harness.state, "hvigor-mode"), "unsigned\n");
    const unsigned = runScript(
      harness,
      join(harness.harmonyRoot, "build-and-install.sh"),
      ["--build-only"],
      harmonyEnv
    );
    expectStatus(unsigned, 1, "Harmony unsigned HAP fail-closed even in --build-only");
    expectOutputHas(unsigned, "unsigned HAP", "Harmony unsigned error names unsigned HAP");
    writeFileSync(join(harness.state, "hvigor-mode"), "signed\n");

    writeFileSync(join(harness.state, "hdc-targets.txt"), "[Empty]\n");
    expectStatus(
      runScript(harness, join(harness.harmonyRoot, "build-and-install.sh"), [], harmonyEnv),
      1,
      "Harmony zero devices fail-closed"
    );

    writeFileSync(join(harness.state, "hdc-targets.txt"), "error\n");
    const harmonyError = runScript(
      harness,
      join(harness.harmonyRoot, "build-and-install.sh"),
      [],
      harmonyEnv
    );
    expectStatus(harmonyError, 1, "Harmony single-token diagnostic is not a target");
    record(!logText(harness).includes("hdc-bind"), "Harmony diagnostic token does not install");
    const harmonyErrorExplicit = runScript(
      harness,
      join(harness.harmonyRoot, "build-and-install.sh"),
      ["--device", "error"],
      harmonyEnv
    );
    expectStatus(harmonyErrorExplicit, 1, "Harmony explicit diagnostic token fail-closed");
    record(!logText(harness).includes("hdc-bind"), "Harmony explicit diagnostic token does not install");

    writeFileSync(join(harness.state, "hdc-targets.txt"), "No connected targets\n");
    const harmonyDiag = runScript(
      harness,
      join(harness.harmonyRoot, "build-and-install.sh"),
      [],
      harmonyEnv
    );
    expectStatus(harmonyDiag, 1, "Harmony diagnostic text is not an online device");
    record(!logText(harness).includes("hdc-bind"), "Harmony diagnostic text does not install");

    writeFileSync(join(harness.state, "hdc-targets.txt"), "HARMONYONE\nHARMONYTWO\n");
    const harmonyMulti = runScript(
      harness,
      join(harness.harmonyRoot, "build-and-install.sh"),
      [],
      harmonyEnv
    );
    expectStatus(harmonyMulti, 1, "Harmony multiple devices fail-closed");
    record(!logText(harness).includes("hdc-install"), "Harmony multiple devices does not install first target");

    writeFileSync(join(harness.state, "hdc-targets.txt"), "HARMONYONE\tOffline\n");
    expectStatus(
      runScript(harness, join(harness.harmonyRoot, "build-and-install.sh"), [], harmonyEnv),
      1,
      "Harmony offline-only fail-closed"
    );

    writeFileSync(join(harness.state, "hdc-targets.txt"), "HARMONYONE\n");
    writeFileSync(join(harness.state, "hdc-model"), "emulator\n");
    const harmonyEmulator = runScript(
      harness,
      join(harness.harmonyRoot, "build-and-install.sh"),
      [],
      harmonyEnv
    );
    expectStatus(harmonyEmulator, 1, "Harmony emulator model fail-closed");
    const harmonyEmulatorExplicit = runScript(
      harness,
      join(harness.harmonyRoot, "build-and-install.sh"),
      ["--device", "HARMONYONE"],
      harmonyEnv
    );
    expectStatus(harmonyEmulatorExplicit, 1, "Harmony explicit emulator fail-closed");
    writeFileSync(join(harness.state, "hdc-model"), "GenericPhone\n");
    writeFileSync(join(harness.state, "hdc-devicetype"), "\n");
    writeFileSync(join(harness.state, "hdc-hardware"), "\n");
    expectStatus(
      runScript(harness, join(harness.harmonyRoot, "build-and-install.sh"), [], harmonyEnv),
      1,
      "Harmony reachable ordinary model without device-type proof fail-closed"
    );
    record(!logText(harness).includes("hdc-install"), "Harmony missing device-type proof does not install");
    writeFileSync(join(harness.state, "hdc-devicetype"), "unknown\n");
    writeFileSync(join(harness.state, "hdc-hardware"), "chipset\n");
    writeFileSync(join(harness.state, "hdc-model"), "GenericPhone\n");
    expectStatus(
      runScript(harness, join(harness.harmonyRoot, "build-and-install.sh"), [], harmonyEnv),
      1,
      "Harmony unknown device-type fail-closed"
    );
    writeFileSync(join(harness.state, "hdc-devicetype"), "phone\n");
    writeFileSync(join(harness.state, "hdc-hardware"), "emulator\n");
    expectStatus(
      runScript(harness, join(harness.harmonyRoot, "build-and-install.sh"), [], harmonyEnv),
      1,
      "Harmony contradictory emulator hardware fail-closed"
    );
    writeFileSync(join(harness.state, "hdc-devicetype"), "phone\n");
    writeFileSync(join(harness.state, "hdc-hardware"), "chipset\n");
    writeFileSync(join(harness.state, "hdc-probe"), "fail\n");
    expectStatus(
      runScript(harness, join(harness.harmonyRoot, "build-and-install.sh"), [], harmonyEnv),
      1,
      "Harmony hdc probe failure fail-closed"
    );
    writeFileSync(join(harness.state, "hdc-probe"), "ok\n");

    writeFileSync(join(harness.state, "hdc-targets.txt"), "HARMONYONE\n");
    const harmonyOk = runScript(
      harness,
      join(harness.harmonyRoot, "build-and-install.sh"),
      [],
      harmonyEnv
    );
    expectStatus(harmonyOk, 0, "Harmony one device installs signed HAP");
    record(logText(harness).includes("hdc-bind HARMONYONE"), "Harmony hdc binds -t of the resolved target");

    const harmonyMissing = runScript(
      harness,
      join(harness.harmonyRoot, "build-and-install.sh"),
      ["--device", "NO-SUCH-TARGET"],
      harmonyEnv
    );
    expectStatus(harmonyMissing, 1, "Harmony explicit missing target fail-closed");

    writeFileSync(join(harness.state, "hvigor-mode"), "stale\n");
    mkdirSync(join(harness.harmonyRoot, "entry/build/default/outputs/default"), { recursive: true });
    const staleHap = join(
      harness.harmonyRoot,
      "entry/build/default/outputs/default/entry-default-signed.hap"
    );
    writeFileSync(staleHap, "old");
    spawnSync("touch", ["-t", "203501010000", staleHap], { encoding: "utf8" });
    const harmonyFuture = runScript(
      harness,
      join(harness.harmonyRoot, "build-and-install.sh"),
      ["--build-only"],
      harmonyEnv
    );
    expectStatus(harmonyFuture, 1, "Harmony future-timestamp HAP fail-closed");
    record(!logText(harness).includes("hdc-bind"), "Harmony future-timestamp HAP does not install");

    writeFileSync(staleHap, "old");
    spawnSync("touch", [staleHap], { encoding: "utf8" });
    const harmonySame = runScript(
      harness,
      join(harness.harmonyRoot, "build-and-install.sh"),
      ["--build-only"],
      harmonyEnv
    );
    expectStatus(harmonySame, 1, "Harmony same-timestamp HAP fail-closed");
    record(!logText(harness).includes("hdc-bind"), "Harmony same-timestamp HAP does not install");

    writeFileSync(`${staleHap}.real`, "old");
    rmSync(staleHap, { force: true });
    symlinkSync(`${staleHap}.real`, staleHap);
    const harmonyLink = runScript(
      harness,
      join(harness.harmonyRoot, "build-and-install.sh"),
      ["--build-only"],
      harmonyEnv
    );
    expectStatus(harmonyLink, 1, "Harmony symlink HAP fail-closed");
    record(!logText(harness).includes("hdc-bind"), "Harmony symlink HAP does not install");

    writeFileSync(join(harness.state, "hvigor-mode"), "signed\n");
    const harmonyOutside = join(harness.root, "harmony-outside");
    mkdirSync(harmonyOutside, { recursive: true });
    writeFileSync(join(harmonyOutside, "SENTINEL"), "keep");
    const harmonyBuildLink = join(harness.harmonyRoot, "entry/build");
    rmSync(harmonyBuildLink, { recursive: true, force: true });
    symlinkSync(harmonyOutside, harmonyBuildLink);
    expectStatus(
      runScript(harness, join(harness.harmonyRoot, "build-and-install.sh"), ["--build-only"], harmonyEnv),
      1,
      "Harmony parent symlink entry/build fail-closed"
    );
    record(existsSync(join(harmonyOutside, "SENTINEL")), "Harmony parent symlink keeps external sentinel");
  } finally {
    rmSync(harness.root, { recursive: true, force: true });
  }
}

syntaxCheck();
runCases();

if (fail > 0) {
  process.stdout.write(`[fail] mobile installer self-test ${fail} failed, ${pass} passed\n`);
  process.exit(1);
}
process.stdout.write(`[ok] mobile installer self-test ${pass} passed\n`);
