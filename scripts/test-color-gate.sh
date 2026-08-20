#!/bin/bash
# 写死色值门禁自测(docs/11 §2.7 门禁说明):注入固件必红、token 写法不误伤。
set -u
DIR=$(mktemp -d)
trap 'rm -rf "$DIR"' EXIT
SCRIPT="$(cd "$(dirname "$0")" && pwd)/check-hardcoded-colors.sh"

# --- 必须命中 ---
printf 'a { color: #b13a2b; }\n'                            >"$DIR/hex6.css"
printf 'a { color: #fff; }\n'                               >"$DIR/hex3.css"
printf 'a { background: rgba(0, 0, 0, 0.45); }\n'           >"$DIR/rgba.css"
printf 'a { background: rgb(52 51 46 / 42%%); }\n'          >"$DIR/rgbspace.css"
printf 'a { color: hsl(12 60%% 40%%); }\n'                  >"$DIR/hsl.css"
printf 'a { color: oklch(0.5 0.1 30); }\n'                  >"$DIR/oklch.css"
printf 'a { color: red; }\n'                                >"$DIR/named.css"
printf 'a { border: 1px solid white; }\n'                   >"$DIR/named-border.css"
printf 'const s = { color: "#34332e" };\n'                  >"$DIR/inline.tsx"
printf 'const c = <b className="bg-[#f0ede4]" />;\n'        >"$DIR/tailwind.tsx"
printf 'const s = { boxShadow: "0 1px 2px rgba(0,0,0,.2)" };\n' >"$DIR/shadow.tsx"

# --- 必须放行 ---
printf 'a { color: var(--text-primary); }\n'                >"$DIR/token.css"
printf 'a { border: 1px solid color-mix(in srgb, var(--ink) 34%%, transparent); }\n' >"$DIR/colormix.css"
printf 'a { background: transparent; border-color: currentColor; }\n' >"$DIR/keyword.css"
printf 'a { border-radius: 50%%; opacity: 0.45; }\n'        >"$DIR/geometry.css"
# 球权枚举键在 .tsx 里叫 orange/blue/green/gray,不是 CSS 具名色 —— 不得误伤
printf 'type B = { color: "orange" | "blue" | "green" | "gray" };\n' >"$DIR/ballkey.tsx"
printf 'const m = { orange: "var(--color-warning)" };\n'    >"$DIR/ballmap.tsx"
# --m-green 之类 token 名内含具名色词,不得误伤
printf 'a { color: var(--m-green); background: var(--paper-fg); }\n' >"$DIR/tokenname.css"
# 深链 hash 与 JSX 里的 # 号不得误伤
printf 'const h = "#/m/chat";\nconst n = <b>#{seq}</b>;\n'  >"$DIR/hash.tsx"

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
    bash "$SCRIPT" "$1" 2>&1 | sed 's/^/       /'
  fi
}

expect_hit   "$DIR/hex6.css"         "hex #rrggbb"
expect_hit   "$DIR/hex3.css"         "hex #rgb"
expect_hit   "$DIR/rgba.css"         "rgba()"
expect_hit   "$DIR/rgbspace.css"     "rgb() space syntax"
expect_hit   "$DIR/hsl.css"          "hsl()"
expect_hit   "$DIR/oklch.css"        "oklch()"
expect_hit   "$DIR/named.css"        "CSS named color"
expect_hit   "$DIR/named-border.css" "CSS named color in border"
expect_hit   "$DIR/inline.tsx"       "hex in inline style"
expect_hit   "$DIR/tailwind.tsx"     "tailwind arbitrary value"
expect_hit   "$DIR/shadow.tsx"       "rgba in boxShadow"
expect_clean "$DIR/token.css"        "var() token"
expect_clean "$DIR/colormix.css"     "color-mix over token"
expect_clean "$DIR/keyword.css"      "transparent / currentColor"
expect_clean "$DIR/geometry.css"     "radius / opacity numbers"
expect_clean "$DIR/ballkey.tsx"      "ball color enum keys in tsx"
expect_clean "$DIR/ballmap.tsx"      "ball color map to tokens"
expect_clean "$DIR/tokenname.css"    "token name containing color word"
expect_clean "$DIR/hash.tsx"         "hash route / jsx sequence"

# tokens.css 是唯一白名单:同样内容在白名单文件里必须放行
cp "$DIR/hex6.css" "$DIR/tokens.css"
expect_clean "$DIR/tokens.css"       "tokens.css whitelist"

# 错误路径:文件不存在必须以 2 退出(不是静默通过)
bash "$SCRIPT" "$DIR/does-not-exist.css" >/dev/null 2>&1
if [ "$?" -eq 2 ]; then
  echo "[ok] missing file: exits 2"; pass=$((pass+1))
else
  echo "[fail] missing file: expected exit 2"; fail=$((fail+1))
fi

echo "---"
echo "[summary] pass=$pass fail=$fail"
[ "$fail" -eq 0 ] || exit 1
