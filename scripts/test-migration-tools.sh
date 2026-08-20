#!/bin/bash
# 迁移清单工具最小回归：broken symlink 必须记录为 L，不能误报删除或空目标。
set -euo pipefail

DIR=$(mktemp -d)
trap 'rm -rf "$DIR"' EXIT
REPO="$DIR/repo"
SCRIPT="$(cd "$(dirname "$0")" && pwd)/target-change-manifest.mjs"

mkdir -p "$REPO"
git -C "$REPO" init -q
git -C "$REPO" config user.email test@example.invalid
git -C "$REPO" config user.name test
printf 'baseline\n' > "$REPO/tracked"
git -C "$REPO" add tracked
git -C "$REPO" commit -q -m baseline
BASELINE=$(git -C "$REPO" rev-parse HEAD)

rm "$REPO/tracked"
ln -s missing-target "$REPO/tracked"
ln -s another-missing-target "$REPO/new-broken"

if node "$SCRIPT" write "$REPO" "$BASELINE" "$REPO/target.tsv" >/dev/null 2>&1; then
  echo "[fail] migration tools self-test: wrong branch write was accepted"
  exit 1
fi
SAYDO_MIGRATION_TEST_ROOT="$REPO" node "$SCRIPT" write "$REPO" "$BASELINE" "$REPO/target.tsv" >/dev/null
node "$SCRIPT" check "$REPO" "$BASELINE" "$REPO/target.tsv" >/dev/null

awk -F '\t' '$1 == "M" && $8 == "L" && $10 == "tracked" { found = 1 } END { exit !found }' "$REPO/target.tsv"
awk -F '\t' '$1 == "A" && $8 == "L" && $10 == "new-broken" { found = 1 } END { exit !found }' "$REPO/target.tsv"

ln -s ../outside "$REPO/outside-link"
if SAYDO_MIGRATION_TEST_ROOT="$REPO" node "$SCRIPT" write "$REPO" "$BASELINE" "$REPO/target.tsv" >/dev/null 2>&1; then
  echo "[fail] migration tools self-test: outside symlink was accepted"
  exit 1
fi
unlink "$REPO/outside-link"

mkfifo "$REPO/untracked-pipe"
if SAYDO_MIGRATION_TEST_ROOT="$REPO" node "$SCRIPT" write "$REPO" "$BASELINE" "$REPO/target.tsv" >/dev/null 2>&1; then
  echo "[fail] migration tools self-test: untracked FIFO was omitted"
  exit 1
fi

echo "[ok] migration tools self-test: symlink metadata + boundaries + FIFO fail-closed"
