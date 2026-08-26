#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if [ -n "${SAYDO_INSTALL_LIB:-}" ]; then
  # shellcheck disable=SC1090
  . "${SAYDO_INSTALL_LIB}"
else
  COMMON_LIB="${SCRIPT_DIR}/../../scripts/mobile-install-common.sh"
  if [ ! -f "${COMMON_LIB}" ]; then
    echo "[fail] 找不到安装器公共库" >&2
    exit 1
  fi
  # shellcheck disable=SC1090
  . "${COMMON_LIB}"
fi

SAYDO_INSTALL_USAGE_NAME="./build-and-install.sh"
SAYDO_INSTALL_USAGE_EXTRA="
  --build-only 只构建并校验本次 .app，不查询、不安装真机。
本脚本只安装本次构建且 codesign --verify --deep --strict 通过的 .app。
开发签名真机包不是 App Store 包，不得放入 GitHub Release。
"
saydo_parse_install_args "$@"

cd "${SCRIPT_DIR}"

XCODEGEN_BIN="${SAYDO_XCODEGEN:-xcodegen}"
XCODEBUILD_BIN="${SAYDO_XCODEBUILD:-xcodebuild}"
XCRUN_BIN="${SAYDO_XCRUN:-xcrun}"
CODESIGN_BIN="${SAYDO_CODESIGN:-codesign}"
PYTHON_BIN="${SAYDO_PYTHON:-python3}"
DERIVED_DATA_PATH="${SCRIPT_DIR}/.build"
APP_PATH="${DERIVED_DATA_PATH}/Build/Products/Debug-iphoneos/SayDo.app"

list_ios_physical_devices() {
  local json_file listed
  json_file="$(mktemp "${TMPDIR:-/tmp}/saydo-ios-devices.XXXXXX")"
  if ! "${XCRUN_BIN}" devicectl list devices --json-output "${json_file}"; then
    rm -f "${json_file}"
    saydo_fail "无法读取 iOS 设备列表。请确认 Xcode / devicectl 可用。"
  fi
  if ! listed="$("${PYTHON_BIN}" - "${json_file}" <<'PY'
import json
import sys

path = sys.argv[1]
try:
    with open(path, encoding="utf-8") as handle:
        data = json.load(handle)
except Exception:
    sys.stderr.write("[fail] 无法解析 devicectl JSON\n")
    sys.exit(2)

devices = data.get("result", {}).get("devices")
if not isinstance(devices, list):
    sys.stderr.write("[fail] devicectl JSON 缺少 result.devices\n")
    sys.exit(2)

for device in devices:
    if not isinstance(device, dict):
        continue
    ident = device.get("identifier")
    if not isinstance(ident, str) or ident == "":
        continue
    hardware = device.get("hardwareProperties")
    if not isinstance(hardware, dict):
        print("skip\t%s\tno-hardware" % ident)
        continue
    connection = device.get("connectionProperties")
    if not isinstance(connection, dict):
        connection = {}
    platform = str(hardware.get("platform", "")).lower()
    reality_raw = hardware.get("reality")
    if not isinstance(reality_raw, str) or reality_raw.strip() == "":
        print("skip\t%s\tmissing-reality" % ident)
        continue
    reality = reality_raw.lower()
    tunnel = str(connection.get("tunnelState", "")).lower()
    pairing_raw = connection.get("pairingState")
    if not isinstance(pairing_raw, str) or pairing_raw.strip() == "":
        print("skip\t%s\tmissing-pairing" % ident)
        continue
    pairing = pairing_raw.lower()
    if platform not in ("ios", "ipados"):
        print("skip\t%s\tplatform" % ident)
        continue
    if reality != "physical":
        print("skip\t%s\tsimulator" % ident)
        continue
    if pairing != "paired":
        print("skip\t%s\tpairing" % ident)
        continue
    if tunnel in ("connected", "available"):
        print("available\t%s" % ident)
        continue
    reason = tunnel if tunnel else "offline"
    print("skip\t%s\t%s" % (ident, reason))
PY
  )"; then
    rm -f "${json_file}"
    saydo_fail "无法解析 iOS 设备列表。"
  fi
  rm -f "${json_file}"
  printf '%s\n' "${listed}"
}

verify_ios_app_identity() {
  local plist python_bin expected_id expected_short expected_build
  python_bin="${SAYDO_PYTHON:-python3}"
  plist="${APP_PATH}/Info.plist"
  if [ -L "${plist}" ] || [ ! -f "${plist}" ]; then
    saydo_fail "缺少本次构建的 Info.plist"
  fi
  expected_id="$(awk -F ': *' '/PRODUCT_BUNDLE_IDENTIFIER:/ { print $2; exit }' "${SCRIPT_DIR}/project.yml" | tr -d '[:space:]')"
  expected_short="$(awk -F '" *' '/MARKETING_VERSION:/ { print $2; exit }' "${SCRIPT_DIR}/project.yml")"
  expected_build="$(awk -F '" *' '/CURRENT_PROJECT_VERSION:/ { print $2; exit }' "${SCRIPT_DIR}/project.yml")"
  if [ -z "${expected_id}" ] || [ -z "${expected_short}" ] || [ -z "${expected_build}" ]; then
    saydo_fail "无法从 project.yml 读取 iOS 身份版本。"
  fi
  if ! "${python_bin}" - "${plist}" "${expected_id}" "${expected_short}" "${expected_build}" <<'PY'
import plistlib
import sys

path, expected_id, expected_short, expected_build = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
try:
    with open(path, "rb") as handle:
        payload = plistlib.load(handle)
except Exception:
    raise SystemExit(1)
if not isinstance(payload, dict):
    raise SystemExit(1)
if payload.get("CFBundleIdentifier") != expected_id:
    raise SystemExit(2)
if payload.get("CFBundleShortVersionString") != expected_short:
    raise SystemExit(3)
if str(payload.get("CFBundleVersion")) != expected_build:
    raise SystemExit(4)
PY
  then
    saydo_fail "iOS 包身份或版本与工程声明不一致"
  fi
}

resolve_ios_device() {
  local listed available="" unavailable_note="" status ident rest
  listed="$(list_ios_physical_devices)"
  while IFS=$'\t' read -r status ident rest || [ -n "${status}" ]; do
    [ -z "${status}" ] && continue
    if [ "${status}" = "available" ]; then
      available="${available}${ident}"$'\n'
    else
      unavailable_note="存在 Offline/unauthorized/非真机条目，未当作可安装目标。"
    fi
  done <<EOF
${listed}
EOF
  saydo_pick_single_device "iOS" "${available}" "${unavailable_note}"
}

saydo_remove_fixed_artifact "${APP_PATH}" dir

"${XCODEGEN_BIN}" generate

if [ "${SAYDO_BUILD_ONLY}" -eq 1 ]; then
  "${XCODEBUILD_BIN}" \
    -project SayDo.xcodeproj \
    -scheme SayDo \
    -configuration Debug \
    -destination "generic/platform=iOS" \
    -derivedDataPath "${DERIVED_DATA_PATH}" \
    build
else
  resolve_ios_device
  "${XCODEBUILD_BIN}" \
    -project SayDo.xcodeproj \
    -scheme SayDo \
    -configuration Debug \
    -destination "id=${SAYDO_DEVICE_ID}" \
    -derivedDataPath "${DERIVED_DATA_PATH}" \
    build
fi

saydo_require_rebuilt_dir "${APP_PATH}" "iOS .app"
if ! "${CODESIGN_BIN}" --verify --deep --strict "${APP_PATH}"; then
  saydo_fail "codesign --verify --deep --strict 未通过"
fi
verify_ios_app_identity
saydo_ok "iOS 构建产物校验通过"

if [ "${SAYDO_BUILD_ONLY}" -eq 1 ]; then
  saydo_ok "build-only: 未安装"
  exit 0
fi

"${XCRUN_BIN}" devicectl device install app --device "${SAYDO_DEVICE_ID}" "${APP_PATH}"
saydo_ok "已安装到指定 iOS 真机"
echo "这是开发签名 dogfood 包，不是 App Store 包，不得放入 GitHub Release。"
