#!/bin/bash
# 公开快照发布:把当前 HEAD 的文件树作为一个快照提交推到公开仓(github.com/Octo-o-o-o/SayDo)。
# 完整过程史留在私有归档(origin = SayDo-archive);本脚本只推树,不推逐提交历史。
# 推前跑隐私探针(对 HEAD 公开候选树,只跳过排除清单),任一命中即拒绝发布。
# 排除清单(PUBLIC_EXCLUDE):只入私有归档、不进公开树的路径(owner 2026-08-22 裁决)。
#   注:被排除路径在公开仓不存在,docs/release 里指向它们的相对链接在公开侧会 404,这是有意的。
# 发布预发布标签时,标签必须与 main 在同一次 atomic push 中指向本脚本生成的公开快照,
# 禁止先在私有 HEAD 打标签再单独推到公开仓。
# 用法: bash scripts/publish-public-snapshot.sh [remote=public] [tag] <expected-internal-sha>
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
PUBLIC_REMOTE="${1:-public}"
PUBLIC_TAG="${2:-}"
EXPECTED_INTERNAL_SHA="${3:-}"
PUBLIC_FILTER_VERSION="public-exclude-v1"
if [[ ! "$EXPECTED_INTERNAL_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "[fail] 必须显式传入 40 位 expected internal SHA"
  exit 2
fi
ACTUAL_HEAD="$(git rev-parse HEAD)"
if [ "$ACTUAL_HEAD" != "$EXPECTED_INTERNAL_SHA" ]; then
  echo "[fail] HEAD 与 expected internal SHA 不一致: $ACTUAL_HEAD != $EXPECTED_INTERNAL_SHA"
  exit 1
fi
if [ "$(git branch --show-current)" != "main" ]; then
  echo "[fail] 公开快照只能从 clean main 发布"
  exit 1
fi
if [ "$(git config --get branch.main.remote || true)" != "origin" ] ||
   [ "$(git config --get branch.main.merge || true)" != "refs/heads/main" ]; then
  echo "[fail] main upstream 必须是 origin/main"
  exit 1
fi
if [ -n "$(git status --porcelain=v1 --untracked-files=all)" ]; then
  echo "[fail] 工作树或 index 非 clean，拒绝从游离文件生成公开快照"
  exit 1
fi
EXPECTED_INTERNAL_URL="https://github.com/Octo-o-o-o/SayDo-archive.git"
if [ "$(git remote get-url --push origin)" != "$EXPECTED_INTERNAL_URL" ]; then
  echo "[fail] 私有归档 origin 必须精确指向 $EXPECTED_INTERNAL_URL"
  exit 1
fi
origin_main_sha="$(git ls-remote origin refs/heads/main | cut -f1)"
if [[ ! "$origin_main_sha" =~ ^[0-9a-f]{40}$ ]] || [ "$origin_main_sha" != "$EXPECTED_INTERNAL_SHA" ]; then
  echo "[fail] expected internal SHA 尚未实际推到私有归档 origin/main"
  exit 1
fi
EXPECTED_PUBLIC_URL="https://github.com/Octo-o-o-o/SayDo.git"
if [ "$(git remote get-url --push "$PUBLIC_REMOTE")" != "$EXPECTED_PUBLIC_URL" ]; then
  echo "[fail] 公开 remote 必须精确指向 $EXPECTED_PUBLIC_URL"
  exit 1
fi
EXPECTED_PUBLIC_TAG="v$(node -p "require('./packages/cli/package.json').version")"
if [ -n "$PUBLIC_TAG" ] && [ "$PUBLIC_TAG" != "$EXPECTED_PUBLIC_TAG" ]; then
  echo "[fail] 公开预发布标签必须与 CLI package version 精确一致: $PUBLIC_TAG != $EXPECTED_PUBLIC_TAG"
  exit 2
fi
if [ -n "$PUBLIC_TAG" ] && ! grep -Fq -- "      - \"$PUBLIC_TAG\"" .github/workflows/release.yml; then
  echo "[fail] release workflow 未声明精确触发标签: $PUBLIC_TAG"
  exit 1
fi
if [ -n "$PUBLIC_TAG" ] && [ -n "$(git ls-remote --tags "$PUBLIC_REMOTE" "refs/tags/$PUBLIC_TAG")" ]; then
  echo "[fail] 公开标签已存在且不可移动: $PUBLIC_TAG"
  exit 1
fi
if [ -n "$PUBLIC_TAG" ]; then
  immutable_enabled="$(gh api \
    -H 'Accept: application/vnd.github+json' \
    -H 'X-GitHub-Api-Version: 2026-03-10' \
    repos/Octo-o-o-o/SayDo/immutable-releases \
    --jq .enabled)"
  if [ "$immutable_enabled" != "true" ]; then
    echo "[fail] 公开仓尚未启用 immutable releases，拒绝推 release tag"
    exit 1
  fi
fi
# 只入私有归档的路径(软著鉴别材料:源码摘录 PDF / 操作说明书 / 截图 / R11 预填表)
PUBLIC_EXCLUDE=(
  'artifacts/release/copyright'
)
exclude_pathspec=()
for p in "${PUBLIC_EXCLUDE[@]}"; do exclude_pathspec+=(":!$p"); done
probes=(
  '(^|[^0-9a-fA-F])1[3-9][0-9]{9}($|[^0-9a-fA-F])'   # 11 位手机号(十六进制串边界排除 sha 误报)
)
git_common_dir="$(git rev-parse --git-common-dir)"
if [[ "$git_common_dir" != /* ]]; then git_common_dir="$(pwd)/$git_common_dir"; fi
canonical_private_probes_file="$git_common_dir/info/saydo-private-probes"
private_probes_file="${SAYDO_PRIVATE_PROBES_FILE:-$canonical_private_probes_file}"
resolve_regular_path() {
  local candidate="$1"
  local parent
  parent="$(cd "$(dirname "$candidate")" && pwd -P)"
  printf '%s/%s\n' "$parent" "$(basename "$candidate")"
}
if [ ! -f "$private_probes_file" ] || [ -L "$private_probes_file" ]; then
  echo "[fail] 公开快照的隐私探针锚必须是 Git 私有目录中的常规文件且不可为 symlink"
  exit 1
fi
resolved_private_probes_file="$(resolve_regular_path "$private_probes_file")"
resolved_canonical_private_probes_file="$(resolve_regular_path "$canonical_private_probes_file")"
if [ "$resolved_private_probes_file" != "$resolved_canonical_private_probes_file" ]; then
  echo "[fail] 公开快照拒绝 SAYDO_PRIVATE_PROBES_FILE 指向 Git 私有目录之外"
  exit 1
fi
if stat -f '%u %Lp' "$resolved_private_probes_file" >/dev/null 2>&1; then
  read -r probes_uid probes_mode < <(stat -f '%u %Lp' "$resolved_private_probes_file")
else
  read -r probes_uid probes_mode < <(stat -c '%u %a' "$resolved_private_probes_file")
fi
if [ "$probes_uid" != "$(id -u)" ] || (( (8#$probes_mode & 077) != 0 )); then
  echo "[fail] 公开快照的隐私探针锚必须由当前用户持有且权限为 owner-only"
  exit 1
fi
private_probes_file="$resolved_private_probes_file"
private_probe_path_digest="$(printf '%s' "$private_probes_file" | shasum -a 256 | cut -d' ' -f1)"
echo "[ok] 隐私探针路径锚 SHA-256:$private_probe_path_digest"
private_probe_count=0
if [ -f "$private_probes_file" ]; then
  while IFS= read -r probe || [ -n "$probe" ]; do
    probe="${probe%$'\r'}"
    probe="${probe#"${probe%%[![:space:]]*}"}"
    probe="${probe%"${probe##*[![:space:]]}"}"
    [[ -z "$probe" || "$probe" == \#* ]] && continue
    probes+=("$probe")
    private_probe_count=$((private_probe_count + 1))
  done < "$private_probes_file"
fi
if [ "$private_probe_count" -lt 1 ]; then
  echo "[fail] 公开快照前必须在 Git 私有目录配置至少一条有效隐私探针（空行和注释不计）"
  exit 1
fi
fail=0
probe_index=0
for p in "${probes[@]}"; do
  probe_index=$((probe_index + 1))
  set +e
  git grep -qE -e "$p" "$EXPECTED_INTERNAL_SHA" -- "${exclude_pathspec[@]}" 2>/dev/null
  grep_status=$?
  set -e
  case "$grep_status" in
    0)
      echo "[fail] 隐私探针命中: #$probe_index"
      git grep -lE -e "$p" "$EXPECTED_INTERNAL_SHA" -- "${exclude_pathspec[@]}" | sed -n '1,5p'
      fail=1
      ;;
    1) ;;
    *) echo "[fail] 隐私探针执行失败: #$probe_index (exit=$grep_status)"; exit 1 ;;
  esac
done
if [ "$fail" = "1" ]; then echo "[fail] 拒绝发布"; exit 1; fi
prev="$(git ls-remote "$PUBLIC_REMOTE" refs/heads/main | cut -f1)"
# 按排除清单裁剪出公开树(临时 index,不动工作区与真实 index)
tmpindex="$(mktemp "${TMPDIR:-/tmp}/saydo-pub-index.XXXXXX")"
rm -f "$tmpindex"
trap 'rm -f "$tmpindex"' EXIT
GIT_INDEX_FILE="$tmpindex" git read-tree "$EXPECTED_INTERNAL_SHA"
for p in "${PUBLIC_EXCLUDE[@]}"; do
  GIT_INDEX_FILE="$tmpindex" git rm -r --cached --quiet --ignore-unmatch -- "$p" >/dev/null
  if GIT_INDEX_FILE="$tmpindex" git ls-files --cached --error-unmatch -- "$p" >/dev/null 2>&1; then
    echo "[fail] 排除路径仍在公开树内: $p"; exit 1
  fi
  echo "[ok] 公开树已剔除: $p"
done
tree="$(GIT_INDEX_FILE="$tmpindex" git write-tree)"
msg="$(printf 'snapshot: %s from internal %s\n\npublic-tree: %s\nfilter-version: %s' \
  "$(git log -1 --format=%cd --date=short "$EXPECTED_INTERNAL_SHA")" \
  "$EXPECTED_INTERNAL_SHA" \
  "$tree" \
  "$PUBLIC_FILTER_VERSION")"
if [ -n "$prev" ]; then new="$(git commit-tree "$tree" -p "$prev" -m "$msg")"; else new="$(git commit-tree "$tree" -m "$msg")"; fi
if [ -n "$PUBLIC_TAG" ]; then
  git push --atomic "$PUBLIC_REMOTE" "$new:refs/heads/main" "$new:refs/tags/$PUBLIC_TAG"
  echo "[ok] 已原子推送公开快照与约定不得移动标签 $new -> $PUBLIC_REMOTE/main + $PUBLIC_TAG"
else
  git push "$PUBLIC_REMOTE" "$new:refs/heads/main"
  echo "[ok] 已推快照 $new -> $PUBLIC_REMOTE/main"
fi
