#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
HVIGORW_BIN="${HVIGORW_BIN:-/Applications/DevEco-Studio.app/Contents/tools/hvigor/bin/hvigorw}"
HDC_BIN="${HDC_BIN:-/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc}"
DEVECO_SDK_HOME="${DEVECO_SDK_HOME:-/Applications/DevEco-Studio.app/Contents/sdk}"
DEVICE_ID="5KLBB25B07200565"
SIGNED_HAP="${SCRIPT_DIR}/entry/build/default/outputs/default/entry-default-signed.hap"
UNSIGNED_HAP="${SCRIPT_DIR}/entry/build/default/outputs/default/entry-default-unsigned.hap"
BUILD_MARKER="$(mktemp "${TMPDIR:-/tmp}/saydo-harmony-build.XXXXXX")"
trap 'rm -f "${BUILD_MARKER}"' EXIT

cd "${SCRIPT_DIR}"
env DEVECO_SDK_HOME="${DEVECO_SDK_HOME}" "${HVIGORW_BIN}" assembleHap

if [[ ! -f "${SIGNED_HAP}" || ! "${SIGNED_HAP}" -nt "${BUILD_MARKER}" ]]; then
  if [[ -f "${UNSIGNED_HAP}" ]]; then
    echo "构建到未签名 HAP：${UNSIGNED_HAP}" >&2
  fi
  echo "签名待验收人用 DevEco 自动签名填充 build-profile.json5 后重试。" >&2
  exit 2
fi

"${HDC_BIN}" -t "${DEVICE_ID}" install -r "${SIGNED_HAP}"
