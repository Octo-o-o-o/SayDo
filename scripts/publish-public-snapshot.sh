#!/bin/bash
# 公开快照发布:把当前 HEAD 的文件树作为一个快照提交推到公开仓(github.com/Octo-o-o-o/SayDo)。
# 完整过程史留在私有归档(origin = SayDo-archive);本脚本只推树,不推逐提交历史。
# 推前跑隐私探针(对 HEAD 树,不含本脚本自身与排除清单),任一命中即拒绝发布。
# 排除清单(PUBLIC_EXCLUDE):只入私有归档、不进公开树的路径(owner 2026-08-22 裁决)。
#   注:被排除路径在公开仓不存在,docs/release 里指向它们的相对链接在公开侧会 404,这是有意的。
# 用法: bash scripts/publish-public-snapshot.sh [remote=public]
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
PUBLIC_REMOTE="${1:-public}"
# 只入私有归档的路径(软著鉴别材料:源码摘录 PDF / 操作说明书 / 截图 / R11 预填表)
PUBLIC_EXCLUDE=(
  'artifacts/release/copyright'
)
exclude_pathspec=(':!scripts/publish-public-snapshot.sh')
for p in "${PUBLIC_EXCLUDE[@]}"; do exclude_pathspec+=(":!$p"); done
probes=(
  '(^|[^0-9a-fA-F])1[3-9][0-9]{9}($|[^0-9a-fA-F])'   # 11 位手机号(十六进制串边界排除 sha 误报)
  'wangyixiao59|wyxgcp|wyxiao59'          # 私有账号名/邮箱前缀
  '30178660879026728'                     # ICP 订单号
  '15502443@'                             # 备案通知邮箱
  'wxkey|kvcomm'                          # 图片工具名
  '祝威廉'                                # 第三方实名
)
fail=0
for p in "${probes[@]}"; do
  if git grep -qE "$p" HEAD -- "${exclude_pathspec[@]}" 2>/dev/null; then
    echo "[fail] 隐私探针命中: $p"
    git grep -nE "$p" HEAD -- "${exclude_pathspec[@]}" | head -5
    fail=1
  fi
done
if [ "$fail" = "1" ]; then echo "[fail] 拒绝发布"; exit 1; fi
prev="$(git ls-remote "$PUBLIC_REMOTE" refs/heads/main | cut -f1)"
# 按排除清单裁剪出公开树(临时 index,不动工作区与真实 index)
tmpindex="$(mktemp "${TMPDIR:-/tmp}/saydo-pub-index.XXXXXX")"
rm -f "$tmpindex"
trap 'rm -f "$tmpindex"' EXIT
GIT_INDEX_FILE="$tmpindex" git read-tree HEAD
for p in "${PUBLIC_EXCLUDE[@]}"; do
  GIT_INDEX_FILE="$tmpindex" git rm -r --cached --quiet --ignore-unmatch -- "$p" >/dev/null
  if GIT_INDEX_FILE="$tmpindex" git ls-files --cached --error-unmatch -- "$p" >/dev/null 2>&1; then
    echo "[fail] 排除路径仍在公开树内: $p"; exit 1
  fi
  echo "[ok] 公开树已剔除: $p"
done
tree="$(GIT_INDEX_FILE="$tmpindex" git write-tree)"
msg="snapshot: $(git log -1 --format=%cd --date=short) from internal $(git rev-parse --short HEAD)"
if [ -n "$prev" ]; then new="$(git commit-tree "$tree" -p "$prev" -m "$msg")"; else new="$(git commit-tree "$tree" -m "$msg")"; fi
git push "$PUBLIC_REMOTE" "$new:refs/heads/main"
echo "[ok] 已推快照 $new -> $PUBLIC_REMOTE/main"
