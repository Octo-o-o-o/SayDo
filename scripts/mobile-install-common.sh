# Shared helpers for apps/*/build-and-install.sh.
# Sourced by those scripts. Not executed directly.
# Compatible with macOS /bin/bash 3.2.

saydo_fail() {
  echo "[fail] $*" >&2
  exit 1
}

saydo_ok() {
  echo "[ok] $*"
}

saydo_usage() {
  local script_name="$1"
  local extra="$2"
  cat <<EOF
用法: ${script_name} [--build-only] [--device <id>]

  --build-only   只构建并校验本次产物，不查询、不要求真机
  --device <id>  显式指定真机。也可用环境变量 SAYDO_DEVICE
  未指定设备时，必须恰好一台 connected/online/available 真机，
  零台、多台或仅 Offline/unauthorized 都会失败，不会挑列表第一项。
${extra}
EOF
}

# Sets SAYDO_BUILD_ONLY (0/1) and SAYDO_DEVICE_ID (explicit id or empty).
saydo_parse_install_args() {
  SAYDO_BUILD_ONLY=0
  SAYDO_DEVICE_ID=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --build-only)
        SAYDO_BUILD_ONLY=1
        shift
        ;;
      --device)
        if [ $# -lt 2 ]; then
          saydo_fail "--device 需要一个设备标识"
        fi
        case "$2" in
          ""|--*)
            saydo_fail "--device 需要一个设备标识"
            ;;
        esac
        SAYDO_DEVICE_ID="$2"
        shift 2
        ;;
      --device=*)
        SAYDO_DEVICE_ID="${1#--device=}"
        if [ -z "${SAYDO_DEVICE_ID}" ]; then
          saydo_fail "--device 需要一个设备标识"
        fi
        shift
        ;;
      -h|--help)
        saydo_usage "$SAYDO_INSTALL_USAGE_NAME" "${SAYDO_INSTALL_USAGE_EXTRA:-}"
        exit 0
        ;;
      *)
        saydo_fail "未知参数: $1。可用 --build-only 或 --device <id>。"
        ;;
    esac
  done
  if [ -z "${SAYDO_DEVICE_ID}" ] && [ -n "${SAYDO_DEVICE:-}" ]; then
    SAYDO_DEVICE_ID="${SAYDO_DEVICE}"
  fi
  case "${SAYDO_DEVICE_ID}" in
    *$'\n'*|*$'\r'*|*$'\t'*)
      saydo_fail "设备标识含有空白控制字符，已拒绝"
      ;;
  esac
}

saydo_count_nonempty_lines() {
  local text="$1"
  local count=0
  local line
  if [ -z "${text}" ]; then
    echo 0
    return
  fi
  while IFS= read -r line || [ -n "${line}" ]; do
    if [ -n "${line}" ]; then
      count=$((count + 1))
    fi
  done <<EOF
${text}
EOF
  echo "${count}"
}

saydo_first_nonempty_line() {
  local text="$1"
  local line
  while IFS= read -r line || [ -n "${line}" ]; do
    if [ -n "${line}" ]; then
      printf '%s' "${line}"
      return 0
    fi
  done <<EOF
${text}
EOF
  return 1
}

saydo_line_in_list() {
  local needle="$1"
  local text="$2"
  local line
  while IFS= read -r line || [ -n "${line}" ]; do
    if [ "${line}" = "${needle}" ]; then
      return 0
    fi
  done <<EOF
${text}
EOF
  return 1
}

# Picks exactly one available device into SAYDO_DEVICE_ID.
# $1 platform label
# $2 newline-separated available ids
# $3 optional note about offline/unauthorized rows
saydo_pick_single_device() {
  local platform="$1"
  local available="$2"
  local unavailable_note="$3"
  local count

  count="$(saydo_count_nonempty_lines "${available}")"

  if [ -n "${SAYDO_DEVICE_ID}" ]; then
    if saydo_line_in_list "${SAYDO_DEVICE_ID}" "${available}"; then
      return 0
    fi
    if [ -n "${unavailable_note}" ]; then
      saydo_fail "指定的 ${platform} 设备不在线或不存在。${unavailable_note}请确认该标识为 connected/online/available，或改用 --device / SAYDO_DEVICE 指定另一台。"
    fi
    saydo_fail "指定的 ${platform} 设备不在线或不存在。请确认该标识为 connected/online/available，或改用 --device / SAYDO_DEVICE 指定另一台。"
  fi

  if [ "${count}" -eq 0 ]; then
    if [ -n "${unavailable_note}" ]; then
      saydo_fail "未发现已连接的 ${platform} 真机。${unavailable_note}请连接并解锁恰好一台设备，或用 --device <id> / SAYDO_DEVICE 显式指定。"
    fi
    saydo_fail "未发现已连接的 ${platform} 真机。请连接并解锁恰好一台设备，或用 --device <id> / SAYDO_DEVICE 显式指定。"
  fi

  if [ "${count}" -gt 1 ]; then
    saydo_fail "发现 ${count} 台已连接的 ${platform} 真机，未指定时不会自动挑选。请用 --device 或 SAYDO_DEVICE 指定其中一台；本输出不打印设备标识。"
  fi

  SAYDO_DEVICE_ID="$(saydo_first_nonempty_line "${available}")"
  if [ -z "${SAYDO_DEVICE_ID}" ]; then
    saydo_fail "未发现已连接的 ${platform} 真机。请连接并解锁恰好一台设备，或用 --device <id> / SAYDO_DEVICE 显式指定。"
  fi
}

saydo_realpath() {
  local python_bin="${SAYDO_PYTHON:-python3}"
  "${python_bin}" -c 'import os, sys; sys.stdout.write(os.path.realpath(sys.argv[1]))' "$1"
}

# Reject symlink parents. allow_leaf_link=1 lets the final artifact itself be a symlink
# so stale links can be removed with rm -f (no follow). Writes/deletes must stay under
# the real SCRIPT_DIR tree.
saydo_assert_artifact_tree() {
  local path="$1"
  local allow_leaf_link="${2:-0}"
  local anchor="${SCRIPT_DIR:?}"
  local cursor parent real_anchor real_path python_bin
  python_bin="${SAYDO_PYTHON:-python3}"
  command -v "${python_bin}" >/dev/null 2>&1 || saydo_fail "找不到 python3，无法校验产物路径。"
  cursor="${path}"
  while [ -n "${cursor}" ] && [ "${cursor}" != "/" ] && [ "${cursor}" != "${anchor}" ]; do
    if [ -L "${cursor}" ]; then
      if [ "${cursor}" = "${path}" ] && [ "${allow_leaf_link}" = "1" ]; then
        :
      else
        saydo_fail "产物路径含有 symlink 父目录或叶 symlink，已拒绝"
      fi
    fi
    parent="$(dirname "${cursor}")"
    if [ "${parent}" = "${cursor}" ]; then
      break
    fi
    cursor="${parent}"
  done
  if [ -L "${anchor}" ]; then
    saydo_fail "构建根是 symlink，已拒绝"
  fi
  if [ -e "${path}" ] || [ -L "${path}" ]; then
    if [ -L "${path}" ] && [ "${allow_leaf_link}" = "1" ]; then
      real_path="$(saydo_realpath "$(dirname "${path}")")"
    else
      real_path="$(saydo_realpath "${path}")"
    fi
    real_anchor="$(saydo_realpath "${anchor}")"
    case "${real_path}" in
      "${real_anchor}"|"${real_anchor}"/*)
        ;;
      *)
        saydo_fail "产物路径不在构建根内，已拒绝"
        ;;
    esac
  fi
}

# Remove one script-owned artifact. kind=file removes a regular file or symlink;
# kind=dir removes a directory, or a symlink without following it.
# Path must be constructed by the caller from the script's own fixed directory.
saydo_remove_fixed_artifact() {
  local path="$1"
  local kind="$2"
  saydo_assert_artifact_tree "${path}" 1
  case "${kind}" in
    file)
      if [ -L "${path}" ] || [ -f "${path}" ]; then
        rm -f "${path}"
      elif [ -e "${path}" ]; then
        saydo_fail "预期产物路径不是普通文件，已拒绝删除"
      fi
      ;;
    dir)
      if [ -L "${path}" ]; then
        rm -f "${path}"
      elif [ -d "${path}" ]; then
        rm -rf "${path}"
      elif [ -e "${path}" ]; then
        saydo_fail "预期产物路径不是目录，已拒绝删除"
      fi
      ;;
    *)
      saydo_fail "内部错误: 未知产物类型 ${kind}"
      ;;
  esac
}

saydo_require_rebuilt_file() {
  local path="$1"
  local label="$2"
  saydo_assert_artifact_tree "${path}" 0
  if [ -L "${path}" ]; then
    saydo_fail "${label} 是 symlink，已拒绝"
  fi
  if [ ! -f "${path}" ]; then
    saydo_fail "${label}不是本次构建重新产生的普通文件"
  fi
}

saydo_require_rebuilt_dir() {
  local path="$1"
  local label="$2"
  saydo_assert_artifact_tree "${path}" 0
  if [ -L "${path}" ]; then
    saydo_fail "${label} 是 symlink，已拒绝"
  fi
  if [ ! -d "${path}" ]; then
    saydo_fail "${label}不是本次构建重新产生的目录"
  fi
}
