#!/usr/bin/env bash
# 真机构建与安装。必须显式提供 SAYDO_IOS_DEVICE_ID（CoreDevice id），无默认设备或账户。
set -euo pipefail

if [[ -z "${SAYDO_IOS_DEVICE_ID:-}" ]]; then
  echo "[fail] 真机构建与安装需要环境变量 SAYDO_IOS_DEVICE_ID（CoreDevice id）。用 xcrun devicectl list devices 查看 id 后导出该变量再跑。" >&2
  exit 2
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DERIVED_DATA_PATH="${SCRIPT_DIR}/.build"
APP_PATH="${DERIVED_DATA_PATH}/Build/Products/Debug-iphoneos/SayDo.app"

cd "${SCRIPT_DIR}"
xcodegen generate
xcodebuild \
  -project SayDo.xcodeproj \
  -scheme SayDo \
  -configuration Debug \
  -destination "platform=iOS,id=${SAYDO_IOS_DEVICE_ID}" \
  -derivedDataPath "${DERIVED_DATA_PATH}" \
  build
xcrun devicectl device install app \
  --device "${SAYDO_IOS_DEVICE_ID}" \
  "${APP_PATH}"
