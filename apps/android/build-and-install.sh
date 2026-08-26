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
  --build-only 只构建并校验本次 debug APK，不查询、不安装真机。
Android SDK 解析顺序: ANDROID_HOME、ANDROID_SDK_ROOT、本目录 local.properties 的 sdk.dir、
各系统标准 SDK 目录。找到后使用该 SDK 的 platform-tools/adb，不依赖 PATH 中的 adb。
Debug 真机包不是 Play 可发布包，release 未接线签名，不得放入 GitHub Release。
"
saydo_parse_install_args "$@"

cd "${SCRIPT_DIR}"

GRADLEW_BIN="${SAYDO_ANDROID_GRADLEW:-${SCRIPT_DIR}/gradlew}"
APK_PATH="${SCRIPT_DIR}/app/build/outputs/apk/debug/app-debug.apk"

resolve_android_sdk_root() {
  local candidate props line sdk_dir
  if [ -n "${ANDROID_HOME:-}" ]; then
    if [ -d "${ANDROID_HOME}" ]; then
      printf '%s' "${ANDROID_HOME}"
      return 0
    fi
    saydo_fail "ANDROID_HOME 不是目录。请设置 ANDROID_HOME 或 ANDROID_SDK_ROOT，或在 local.properties 写入 sdk.dir。"
  fi
  if [ -n "${ANDROID_SDK_ROOT:-}" ]; then
    if [ -d "${ANDROID_SDK_ROOT}" ]; then
      printf '%s' "${ANDROID_SDK_ROOT}"
      return 0
    fi
    saydo_fail "ANDROID_SDK_ROOT 不是目录。请设置 ANDROID_HOME 或 ANDROID_SDK_ROOT，或在 local.properties 写入 sdk.dir。"
  fi
  props="${SCRIPT_DIR}/local.properties"
  if [ -f "${props}" ]; then
    while IFS= read -r line || [ -n "${line}" ]; do
      case "${line}" in
        sdk.dir=*)
          sdk_dir="${line#sdk.dir=}"
          sdk_dir="$(printf '%s' "${sdk_dir}" | tr -d '\r')"
          sdk_dir="${sdk_dir//\\:/:}"
          sdk_dir="${sdk_dir//\\\\/\\}"
          if [ -n "${sdk_dir}" ] && [ -d "${sdk_dir}" ]; then
            printf '%s' "${sdk_dir}"
            return 0
          fi
          ;;
      esac
    done < "${props}"
  fi
  for candidate in \
    "${HOME}/Library/Android/sdk" \
    "${HOME}/Android/Sdk" \
    "/usr/local/lib/android/sdk" \
    "/opt/android-sdk"
  do
    if [ -d "${candidate}" ]; then
      printf '%s' "${candidate}"
      return 0
    fi
  done
  if [ -n "${LOCALAPPDATA:-}" ] && [ -d "${LOCALAPPDATA}/Android/Sdk" ]; then
    printf '%s' "${LOCALAPPDATA}/Android/Sdk"
    return 0
  fi
  saydo_fail "找不到 Android SDK。请设置 ANDROID_HOME 或 ANDROID_SDK_ROOT，或在 local.properties 写入 sdk.dir。"
}

require_android_adb() {
  ADB_BIN="${SDK_ROOT}/platform-tools/adb"
  if [ ! -x "${ADB_BIN}" ]; then
    saydo_fail "安装需要该 SDK 的 platform-tools/adb。--build-only 不要求 adb；安装请安装 platform-tools，或改用 --build-only。"
  fi
}

android_version_key() {
  printf '%s' "$1" | awk -F. '{
    printf "%03d.%03d.%03d\n", $1+0, $2+0, $3+0
  }'
}

android_highest_build_tool() {
  local name="$1"
  local dir ver key best_key="" best_path=""
  [ -d "${SDK_ROOT}/build-tools" ] || return 1
  for dir in "${SDK_ROOT}/build-tools"/*; do
    [ -d "${dir}" ] || continue
    ver="$(basename "${dir}")"
    printf '%s' "${ver}" | grep -Eq '^[0-9]+(\.[0-9]+)*$' || continue
    [ -x "${dir}/${name}" ] || continue
    key="$(android_version_key "${ver}")"
    if [ -z "${best_key}" ] || [ "${key}" \> "${best_key}" ]; then
      best_key="${key}"
      best_path="${dir}/${name}"
    fi
  done
  [ -n "${best_path}" ] || return 1
  printf '%s' "${best_path}"
}

resolve_apksigner() {
  if [ -n "${SAYDO_APKSIGNER:-}" ]; then
    if [ -x "${SAYDO_APKSIGNER}" ]; then
      printf '%s' "${SAYDO_APKSIGNER}"
      return 0
    fi
    saydo_fail "SAYDO_APKSIGNER 不可执行。"
  fi
  if android_highest_build_tool apksigner; then
    return 0
  fi
  saydo_fail "找不到 apksigner。请安装 Android SDK build-tools，或设置 SAYDO_APKSIGNER。"
}

resolve_aapt2() {
  if [ -n "${SAYDO_AAPT2:-}" ]; then
    if [ -x "${SAYDO_AAPT2}" ]; then
      printf '%s' "${SAYDO_AAPT2}"
      return 0
    fi
    saydo_fail "SAYDO_AAPT2 不可执行。"
  fi
  if android_highest_build_tool aapt2; then
    return 0
  fi
  saydo_fail "找不到 aapt2。请安装 Android SDK build-tools，或设置 SAYDO_AAPT2。"
}

verify_android_apk() {
  local apksigner aapt2 pkg expected_version python_bin
  python_bin="${SAYDO_PYTHON:-python3}"
  apksigner="$(resolve_apksigner)"
  aapt2="$(resolve_aapt2)"
  expected_version="$(awk -F '"' '/versionName/ { print $2; exit }' "${SCRIPT_DIR}/app/build.gradle.kts")"
  if [ -z "${expected_version}" ]; then
    saydo_fail "无法从 app/build.gradle.kts 读取 versionName。"
  fi
  if ! "${apksigner}" verify --verbose --print-certs "${APK_PATH}"; then
    saydo_fail "apksigner verify 未通过"
  fi
  pkg="$("${aapt2}" dump packagename "${APK_PATH}" | tr -d '\r\n')"
  if [ "${pkg}" != "com.octoooo.saydo" ]; then
    saydo_fail "APK applicationId 与工程声明不一致"
  fi
  if ! "${aapt2}" dump badging "${APK_PATH}" | "${python_bin}" -c '
import re, sys
expected = sys.argv[1]
text = sys.stdin.read()
q = chr(39)
match = re.search("versionName=" + q + "([^" + q + "]*)" + q, text)
if not match or match.group(1) != expected:
    raise SystemExit(1)
' "${expected_version}"; then
    saydo_fail "APK versionName 与工程声明不一致。"
  fi
}

android_qemu_flag_unsafe() {
  local value
  value="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
  case "${value}" in
    ""|0|false|n|no)
      return 1
      ;;
  esac
  return 0
}

android_probe_physical() {
  local serial="$1"
  local key value blob=""
  for key in ro.kernel.qemu ro.boot.qemu ro.hardware ro.product.model ro.build.fingerprint; do
    if ! value="$("${ADB_BIN}" -s "${serial}" shell getprop "${key}")"; then
      return 1
    fi
    value="$(printf '%s' "${value}" | tr -d '\r\n')"
    case "${key}" in
      ro.kernel.qemu|ro.boot.qemu)
        if android_qemu_flag_unsafe "${value}"; then
          return 1
        fi
        ;;
      ro.hardware|ro.product.model|ro.build.fingerprint)
        if [ -z "${value}" ]; then
          return 1
        fi
        ;;
    esac
    blob="${blob} ${value}"
  done
  case "$(printf '%s' "${blob}" | tr '[:upper:]' '[:lower:]')" in
    *qemu*|*emulator*|*goldfish*|*ranchu*|*cuttlefish*|*sdk_gphone*|*generic*)
      return 1
      ;;
  esac
  return 0
}

list_android_devices() {
  local listed available="" unavailable_note="" serial state
  listed="$("${ADB_BIN}" devices)"
  while IFS= read -r line || [ -n "${line}" ]; do
    case "${line}" in
      ""|"List of devices attached"*)
        continue
        ;;
    esac
    serial="$(printf '%s' "${line}" | awk '{print $1}')"
    state="$(printf '%s' "${line}" | awk '{print $2}')"
    if [ -z "${serial}" ] || [ -z "${state}" ]; then
      continue
    fi
    case "${serial}" in
      emulator-*)
        unavailable_note="模拟器未当作可安装真机。"
        continue
        ;;
    esac
    if [ "${state}" = "device" ]; then
      if android_probe_physical "${serial}"; then
        available="${available}${serial}"$'\n'
      else
        unavailable_note="模拟器或身份查询失败，未当作可安装真机。"
      fi
    else
      unavailable_note="存在 Offline/unauthorized 设备，未当作可安装目标。"
    fi
  done <<EOF
${listed}
EOF
  SAYDO_ANDROID_AVAILABLE="${available}"
  SAYDO_ANDROID_UNAVAILABLE_NOTE="${unavailable_note}"
}

SDK_ROOT="$(resolve_android_sdk_root)"
export ANDROID_HOME="${SDK_ROOT}"
export ANDROID_SDK_ROOT="${SDK_ROOT}"

saydo_remove_fixed_artifact "${APK_PATH}" file

if [ ! -x "${GRADLEW_BIN}" ]; then
  saydo_fail "找不到 gradlew"
fi
"${GRADLEW_BIN}" --no-daemon :app:assembleDebug
saydo_require_rebuilt_file "${APK_PATH}" "Android debug APK"
verify_android_apk
saydo_ok "Android 构建产物校验通过"

if [ "${SAYDO_BUILD_ONLY}" -eq 1 ]; then
  saydo_ok "build-only: 未安装。Debug 真机包不是 Play 可发布包。签名与本机 debug.keystore 不一致时需用户显式卸载或提供稳定的本地 keystore，安装器不会自动卸载。"
  exit 0
fi

require_android_adb
list_android_devices
saydo_pick_single_device "Android" "${SAYDO_ANDROID_AVAILABLE}" "${SAYDO_ANDROID_UNAVAILABLE_NOTE}"
if ! "${ADB_BIN}" -s "${SAYDO_DEVICE_ID}" install -r "${APK_PATH}"; then
  saydo_fail "adb install 失败。若提示签名不一致，请用户显式卸载已装包或提供稳定的本地 debug keystore；安装器不会自动卸载。"
fi
saydo_ok "已安装到指定 Android 真机"
echo "这是 Debug 真机 dogfood 包，不是 Play 可发布包，不得放入 GitHub Release。"
