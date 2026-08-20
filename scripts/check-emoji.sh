#!/bin/bash
# 零 emoji CI 门禁(docs/11-ui-spec.md §12 收窄正则,照抄)。
# 口径:封禁真 emoji(含变体选择符 FE0F)与杂项符号/装饰区(U+2600-27BF:勾/叉/警告/星形之流);
#       纯文本箭头与数学符号(U+2190-21FF)不在禁区。HTML/Markdown numeric entity 与 HTML
#       script 中的 Unicode escape 也按解码后的码点检查，防视觉层绕过。
# 用法:check-emoji.sh            对 git 追踪的全部文件跑(CI 模式)
#       check-emoji.sh <files..>  只检查指定文件(自测模式)
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"
PATTERN='[\p{Emoji_Presentation}\x{FE0F}\x{1F000}-\x{1FAFF}\x{2600}-\x{27BF}]'

# 只扫文本文件:rg 的 --glob 排除对"显式列出的文件参数"不生效(只作用于目录遍历),
# 所以二进制排除必须在文件清单层做(grep -v 扩展名)。
BIN_RE='\.(mp3|wav|png|jpg|jpeg|gif|webp|pdf|ico|icns|woff2?)$'
if ! command -v rg >/dev/null 2>&1; then
  echo "[fail] emoji gate: rg is required" >&2
  exit 2
fi

list=$(mktemp)
output=$(mktemp)
trap 'rm -f "$list" "$output"' EXIT
files=()
if [ "$#" -gt 0 ]; then
  for file in "$@"; do
    if [ ! -f "$file" ] || [ ! -r "$file" ]; then
      echo "[fail] emoji gate: unreadable or missing file: $file" >&2
      exit 2
    fi
    if [[ ! "$file" =~ $BIN_RE ]]; then files+=("$file"); fi
  done
else
  git ls-files -z --cached --others --exclude-standard >"$list"
  while IFS= read -r -d '' file; do
    if [[ ! "$file" =~ $BIN_RE ]]; then files+=("$file"); fi
  done <"$list"
fi

if [ "${#files[@]}" -eq 0 ]; then
  echo "[ok] emoji gate: clean"
  exit 0
fi

set +e
rg -nP "$PATTERN" --no-heading -- "${files[@]}" >"$output"
status=$?
set -e

if [ "$status" -eq 0 ]; then
  echo "[fail] emoji gate: found forbidden pictographic characters:"
  cat "$output"
  exit 1
fi
if [ "$status" -ne 1 ]; then
  echo "[fail] emoji gate: scanner failed with exit $status" >&2
  exit 2
fi

# Numeric HTML entity 会在 HTML/Markdown 渲染时变成真实符号；HTML script 的 Unicode
# escape 会在浏览器执行时变成真实符号。只解码这两类视觉输出载体，不误伤 TS 中用于过滤
# emoji 的正则边界转义。
encoded_files=()
for file in "${files[@]}"; do
  case "$file" in
    *.html|*.md) encoded_files+=("$file") ;;
  esac
done
if [ "${#encoded_files[@]}" -gt 0 ]; then
  set +e
  node - "${encoded_files[@]}" >"$output" <<'NODE'
const fs = require("node:fs");
const forbidden = (cp) =>
  cp === 0xfe0f ||
  (cp >= 0x2600 && cp <= 0x27bf) ||
  (cp >= 0x1f000 && cp <= 0x1faff);
const report = [];
for (const file of process.argv.slice(2)) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    for (const match of line.matchAll(/&#(?:x([0-9a-f]+)|([0-9]+));/gi)) {
      const cp = Number.parseInt(match[1] ?? match[2], match[1] ? 16 : 10);
      if (forbidden(cp)) report.push(`${file}:${index + 1}:${match[0]}`);
    }
    if (!file.endsWith(".html")) continue;
    for (const match of line.matchAll(/\\u(?:\{([0-9a-f]{1,6})\}|([0-9a-f]{4}))/gi)) {
      const cp = Number.parseInt(match[1] ?? match[2], 16);
      if (forbidden(cp)) report.push(`${file}:${index + 1}:${match[0]}`);
    }
    for (const match of line.matchAll(/\\u(d[89ab][0-9a-f]{2})\\u(d[c-f][0-9a-f]{2})/gi)) {
      const high = Number.parseInt(match[1], 16);
      const low = Number.parseInt(match[2], 16);
      const cp = 0x10000 + ((high - 0xd800) << 10) + (low - 0xdc00);
      if (forbidden(cp)) report.push(`${file}:${index + 1}:${match[0]}`);
    }
  }
}
if (report.length > 0) {
  process.stdout.write(`${report.join("\n")}\n`);
  process.exit(1);
}
NODE
  encoded_status=$?
  set -e
  if [ "$encoded_status" -eq 1 ]; then
    echo "[fail] emoji gate: found encoded forbidden pictographic characters:"
    cat "$output"
    exit 1
  fi
  if [ "$encoded_status" -ne 0 ]; then
    echo "[fail] emoji gate: encoded scanner failed with exit $encoded_status" >&2
    exit 2
  fi
fi
echo "[ok] emoji gate: clean"
