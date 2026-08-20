#!/bin/bash
# 写死色值 CI 门禁(docs/11-ui-spec.md §2.7)。
# 口径:console 源码内禁止出现字面色值,一切颜色必须消费 tokens.css 的 token。
#   命中 hex(#rgb/#rrggbb/#rrggbbaa,含 Tailwind 任意值类 [#fff])、
#        函数式色(rgb/rgba/hsl/hsla/oklch/oklab/lab/lch/hwb/color)、
#        CSS 文件里的 CSS 具名色(color: red 之流)。
#   放行 color-mix(...)(基色仍来自 token,只做本地 alpha 派生)、
#        currentColor / transparent / inherit,以及 .tsx 里把 "orange"/"blue" 等
#        当作球权枚举键的写法(所以具名色只在 .css 里查)。
# 白名单:packages/console/src/styles/tokens.css —— token 的唯一定义源。
#   mobile.css 不在白名单:2026-08-13 起它只做消费映射,已零字面色。
# 用法:check-hardcoded-colors.sh            扫 packages/console/src(CI 模式)
#       check-hardcoded-colors.sh <files..>  只查指定文件(自测模式)
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"

SCAN_DIR="packages/console/src"
ALLOW_RE='(^|/)tokens\.css$'

# 函数式色。注意 color-mix 天然不命中:正则要求函数名后紧跟 "(",而 color-mix 的
# "color" 后面是 "-mix(",所以不必另做豁免(自测 colormix 固件守住这条)。
FUNC_RE='(?<![-\w])(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb|color)\s*\('
HEX_RE='#[0-9a-fA-F]{3,8}(?![0-9a-zA-Z_-])'
NAMED='white|black|red|green|blue|yellow|orange|purple|pink|brown|gray|grey|silver|gold|cyan|magenta|lime|navy|teal|olive|maroon|aqua|fuchsia|beige|ivory|coral|salmon|tan|violet|indigo|khaki|crimson|orchid|plum|azure|wheat|linen|snow|mint'
NAMED_RE="(?:^|[;{])\\s*(?:-webkit-)?(?:color|background|background-color|border|border-color|border-top|border-right|border-bottom|border-left|border-top-color|border-right-color|border-bottom-color|border-left-color|outline|outline-color|fill|stroke|box-shadow|text-shadow|caret-color|accent-color|text-decoration-color)\\s*:[^;{}]*(?<![-\\w#])(?:${NAMED})(?![-\\w])"

if ! command -v rg >/dev/null 2>&1; then
  echo "[fail] color gate: rg is required" >&2
  exit 2
fi

files=()
if [ "$#" -gt 0 ]; then
  for file in "$@"; do
    if [ ! -f "$file" ] || [ ! -r "$file" ]; then
      echo "[fail] color gate: unreadable or missing file: $file" >&2
      exit 2
    fi
    files+=("$file")
  done
else
  if [ ! -d "$SCAN_DIR" ]; then
    echo "[fail] color gate: scan dir missing: $SCAN_DIR" >&2
    exit 2
  fi
  # 测试/fixture 不在门禁范围(它们会为了断言而写出色值字面量)
  while IFS= read -r file; do files+=("$file"); done < <(
    rg --files "$SCAN_DIR" -g '*.css' -g '*.ts' -g '*.tsx' \
      -g '!*.test.*' -g '!*.fixture.*' | sort
  )
fi

output=$(mktemp)
trap 'rm -f "$output"' EXIT
: >"$output"

scan() { # scan <pattern> <only-css:0|1>
  local pattern=$1 css_only=$2
  local targets=()
  local file
  for file in "${files[@]}"; do
    [[ "$file" =~ $ALLOW_RE ]] && continue
    if [ "$css_only" = "1" ] && [[ "$file" != *.css ]]; then continue; fi
    targets+=("$file")
  done
  [ "${#targets[@]}" -eq 0 ] && return 0
  set +e
  rg -nP "$pattern" --no-heading --with-filename -- "${targets[@]}" >>"$output"
  local status=$?
  set -e
  # rg: 0=有命中(已写进 output),1=无命中,其余=真出错
  if [ "$status" -gt 1 ]; then
    echo "[fail] color gate: scanner failed with exit $status" >&2
    exit 2
  fi
}

scan "$HEX_RE" 0
scan "$FUNC_RE" 0
scan "$NAMED_RE" 1

if [ -s "$output" ]; then
  echo "[fail] color gate: found hardcoded colors (use tokens from styles/tokens.css):"
  cat "$output"
  exit 1
fi
echo "[ok] color gate: clean"
