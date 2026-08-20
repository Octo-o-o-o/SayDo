#!/bin/bash
# emoji 门禁自测(计划 0.1 验收项):注入固件必红、文本箭头不误伤。
# 固件用 printf 转义构造(不把真 emoji 写进仓库,遵守门禁自身)。
set -u
DIR=$(mktemp -d)
trap 'rm -rf "$DIR"' EXIT
SCRIPT="$(cd "$(dirname "$0")" && pwd)/check-emoji.sh"

# 固件 1:真 emoji(U+1F600)必须命中
printf 'hello \xf0\x9f\x98\x80 world\n' > "$DIR/emoji.txt"
# 固件 2:勾叉警告符(U+2705 / U+274C / U+26A0)必须命中
printf 'status \xe2\x9c\x85 \xe2\x9d\x8c \xe2\x9a\xa0\n' > "$DIR/marks.txt"
# 固件 3:变体选择符 FE0F 必须命中
printf 'digit 1\xef\xb8\x8f\xe2\x83\xa3\n' > "$DIR/vs16.txt"
# 固件 4:文本箭头(U+2192 / U+2194)必须放行
printf 'A\xe2\x86\x92B taskId\xe2\x86\x94runId\n' > "$DIR/arrows.txt"
# 固件 5:文本 lockfile 不能按二进制静默跳过
printf 'locked \xf0\x9f\x98\x80\n' > "$DIR/emoji.lock"

pass=0; fail=0
expect_hit() {
  if bash "$SCRIPT" "$1" >/dev/null 2>&1; then
    echo "[fail] $2: expected gate to catch, but it passed"; fail=$((fail+1))
  else
    echo "[ok] $2: caught as expected"; pass=$((pass+1))
  fi
}
expect_clean() {
  if bash "$SCRIPT" "$1" >/dev/null 2>&1; then
    echo "[ok] $2: passed as expected"; pass=$((pass+1))
  else
    echo "[fail] $2: false positive"; fail=$((fail+1))
  fi
}

expect_hit "$DIR/emoji.txt" "true emoji"
expect_hit "$DIR/marks.txt" "check/cross/warning marks"
expect_hit "$DIR/vs16.txt" "variation selector"
expect_clean "$DIR/arrows.txt" "text arrows"
expect_hit "$DIR/emoji.lock" "text lockfile"

mkdir -p "$DIR/no-rg-bin"
ln -s "$(command -v bash)" "$DIR/no-rg-bin/bash"
ln -s "$(command -v dirname)" "$DIR/no-rg-bin/dirname"
if PATH="$DIR/no-rg-bin" "$DIR/no-rg-bin/bash" "$SCRIPT" "$DIR/arrows.txt" >/dev/null 2>&1; then
  echo "[fail] missing rg: expected gate error, but it passed"; fail=$((fail+1))
else
  echo "[ok] missing rg: failed closed as expected"; pass=$((pass+1))
fi

printf '<p>&#x1F399;</p>\n' > "$DIR/entity.html"
expect_hit "$DIR/entity.html" "encoded HTML entity"
printf '<script>const icon="\\u2600";</script>\n' > "$DIR/escape.html"
expect_hit "$DIR/escape.html" "encoded HTML script escape"

if bash "$SCRIPT" "$DIR/missing.txt" >/dev/null 2>&1; then
  echo "[fail] missing file: expected gate error, but it passed"; fail=$((fail+1))
else
  echo "[ok] missing file: failed closed as expected"; pass=$((pass+1))
fi

printf 'plain text\n' > "$DIR/unreadable.txt"
chmod 000 "$DIR/unreadable.txt"
if bash "$SCRIPT" "$DIR/unreadable.txt" >/dev/null 2>&1; then
  echo "[fail] unreadable file: expected gate error, but it passed"; fail=$((fail+1))
else
  echo "[ok] unreadable file: failed closed as expected"; pass=$((pass+1))
fi
chmod 600 "$DIR/unreadable.txt"

mkdir -p "$DIR/untracked-repo/scripts"
cp "$SCRIPT" "$DIR/untracked-repo/scripts/check-emoji.sh"
git -C "$DIR/untracked-repo" init -q
printf 'untracked \xf0\x9f\x98\x80\n' > "$DIR/untracked-repo/new.md"
if bash "$DIR/untracked-repo/scripts/check-emoji.sh" >/dev/null 2>&1; then
  echo "[fail] untracked default scan: expected gate to catch, but it passed"; fail=$((fail+1))
else
  echo "[ok] untracked default scan: caught as expected"; pass=$((pass+1))
fi

echo "emoji-gate self-test: pass=$pass fail=$fail"
[ "$fail" -eq 0 ]
