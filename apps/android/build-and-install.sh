#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

./gradlew --no-daemon :app:assembleDebug
adb -s 01234ABC install -r app/build/outputs/apk/debug/app-debug.apk
