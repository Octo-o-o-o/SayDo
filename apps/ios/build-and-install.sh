#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DERIVED_DATA_PATH="${SCRIPT_DIR}/.build"
APP_PATH="${DERIVED_DATA_PATH}/Build/Products/Debug-iphoneos/SayDo.app"

cd "${SCRIPT_DIR}"
xcodegen generate
xcodebuild \
  -project SayDo.xcodeproj \
  -scheme SayDo \
  -configuration Debug \
  -destination 'platform=iOS,name=WangYixiao' \
  -derivedDataPath "${DERIVED_DATA_PATH}" \
  build
xcrun devicectl device install app \
  --device BF884EAE-6CC0-55A1-9A5F-D0DADCB6089C \
  "${APP_PATH}"
