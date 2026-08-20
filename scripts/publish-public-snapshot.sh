#!/bin/bash
# 公开快照发布:把当前 HEAD 的文件树作为一个快照提交推到公开仓(github.com/Octo-o-o-o/SayDo)。
# 完整过程史留在私有归档(origin = SayDo-archive);本脚本只推树,不推逐提交历史。
# 推前跑隐私探针(对 HEAD 树,不含本脚本自身),任一命中即拒绝发布。
# 用法: bash scripts/publish-public-snapshot.sh [remote=public]
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
PUBLIC_REMOTE="${1:-public}"
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
  if git grep -qE "$p" HEAD -- ':!scripts/publish-public-snapshot.sh' 2>/dev/null; then
    echo "[fail] 隐私探针命中: $p"
    git grep -nE "$p" HEAD -- ':!scripts/publish-public-snapshot.sh' | head -5
    fail=1
  fi
done
if [ "$fail" = "1" ]; then echo "[fail] 拒绝发布"; exit 1; fi
prev="$(git ls-remote "$PUBLIC_REMOTE" refs/heads/main | cut -f1)"
tree="$(git rev-parse 'HEAD^{tree}')"
msg="snapshot: $(git log -1 --format=%cd --date=short) from internal $(git rev-parse --short HEAD)"
if [ -n "$prev" ]; then new="$(git commit-tree "$tree" -p "$prev" -m "$msg")"; else new="$(git commit-tree "$tree" -m "$msg")"; fi
git push "$PUBLIC_REMOTE" "$new:refs/heads/main"
echo "[ok] 已推快照 $new -> $PUBLIC_REMOTE/main"
