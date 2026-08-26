#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if [ -n "${SAYDO_INSTALL_LIB:-}" ]; then
  # shellcheck disable=SC1090
  . "${SAYDO_INSTALL_LIB}"
else
  COMMON_LIB="${SCRIPT_DIR}/../../scripts/mobile-install-common.sh"
  if [ ! -f "${COMMON_LIB}" ]; then
    echo "[fail] 找不到安装器公共库" >&2
    exit 1
  fi
  # shellcheck disable=SC1090
  . "${COMMON_LIB}"
fi

SAYDO_INSTALL_USAGE_NAME="./build-and-install.sh"
SAYDO_INSTALL_USAGE_EXTRA="
  --build-only 只构建并校验本次 signed HAP，不查询、不安装真机。
只接受本次构建后更新的 signed HAP。unsigned 或 Profile 缺失会失败。
DevEco / hvigor / hdc 路径可用 HVIGORW_BIN、HDC_BIN、DEVECO_SDK_HOME 注入。
发布证书不等于签名 Profile；当前缺 Profile 时不能把 unsigned 包当作可安装产物。
"
saydo_parse_install_args "$@"

cd "${SCRIPT_DIR}"

resolve_hvigorw() {
  if [ -n "${HVIGORW_BIN:-}" ]; then
    if [ ! -x "${HVIGORW_BIN}" ]; then
      saydo_fail "HVIGORW_BIN 不可执行。请设置可执行的 HVIGORW_BIN。"
    fi
    printf '%s' "${HVIGORW_BIN}"
    return 0
  fi
  local candidate
  for candidate in \
    "/Applications/DevEco-Studio.app/Contents/tools/hvigor/bin/hvigorw"
  do
    if [ -x "${candidate}" ]; then
      printf '%s' "${candidate}"
      return 0
    fi
  done
  saydo_fail "找不到 hvigorw。请设置 HVIGORW_BIN。"
}

resolve_hdc() {
  if [ -n "${HDC_BIN:-}" ]; then
    if [ ! -x "${HDC_BIN}" ]; then
      saydo_fail "HDC_BIN 不可执行。--build-only 不要求 hdc；安装请设置可执行的 HDC_BIN。"
    fi
    printf '%s' "${HDC_BIN}"
    return 0
  fi
  local candidate sdk="${DEVECO_SDK_HOME:-}"
  if [ -n "${sdk}" ]; then
    for candidate in \
      "${sdk}/default/openharmony/toolchains/hdc" \
      "${sdk}/openharmony/toolchains/hdc"
    do
      if [ -x "${candidate}" ]; then
        printf '%s' "${candidate}"
        return 0
      fi
    done
  fi
  for candidate in \
    "/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc"
  do
    if [ -x "${candidate}" ]; then
      printf '%s' "${candidate}"
      return 0
    fi
  done
  saydo_fail "找不到 hdc。请设置 HDC_BIN 或 DEVECO_SDK_HOME。"
}

harmony_target_id_ok() {
  local id="$1"
  case "$(printf '%s' "${id}" | tr '[:upper:]' '[:lower:]')" in
    error|failed|fail|empty|disconnected|unauthorized|offline|unknown|busy|waiting|connected|device|online)
      return 1
      ;;
  esac
  printf '%s' "${id}" | grep -Eq '^[A-Za-z0-9][A-Za-z0-9._-]{5,63}$'
}

harmony_trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "${value}"
}

# Empty, unknown, error-like, or default placeholders are not physical proof.
harmony_value_unproven() {
  local lowered
  lowered="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
  case "${lowered}" in
    ""|error|failed|fail|unknown|n/a|na|none|null|undefined|default)
      return 0
      ;;
    *unknown*|*error*|*getparameter*|*fail\ to*|*failed*)
      return 0
      ;;
  esac
  return 1
}

harmony_param_get() {
  local id="$1"
  local key="$2"
  local out
  if ! out="$("${HDC_RESOLVED}" -t "${id}" shell param get "${key}")"; then
    return 1
  fi
  out="$(harmony_trim "$(printf '%s' "${out}" | tr -d '\r\n')")"
  if harmony_value_unproven "${out}"; then
    return 1
  fi
  printf '%s' "${out}"
}

harmony_value_emulatorish() {
  case "$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')" in
    *emulator*|*simulator*|*qemu*|*goldfish*|*ranchu*)
      return 0
      ;;
  esac
  return 1
}

harmony_probe_device() {
  local id="$1"
  local out dtype hardware model
  if ! out="$("${HDC_RESOLVED}" -t "${id}" shell echo SAYDO_PROBE)"; then
    return 1
  fi
  out="$(printf '%s' "${out}" | tr -d '\r')"
  printf '%s' "${out}" | grep -q 'SAYDO_PROBE' || return 1
  dtype="$(harmony_param_get "${id}" const.product.devicetype)" || return 1
  hardware="$(harmony_param_get "${id}" ohos.boot.hardware)" || return 1
  model="$(harmony_param_get "${id}" const.product.model)" || return 1
  case "$(printf '%s' "${dtype}" | tr '[:upper:]' '[:lower:]')" in
    phone|tablet|2in1|wearable)
      ;;
    *)
      return 1
      ;;
  esac
  if harmony_value_emulatorish "${dtype}" || harmony_value_emulatorish "${hardware}" || harmony_value_emulatorish "${model}"; then
    return 1
  fi
  return 0
}

harmony_accept_target() {
  local id="$1"
  if ! harmony_target_id_ok "${id}"; then
    return 1
  fi
  harmony_probe_device "${id}"
}

list_harmony_targets() {
  local listed available="" unavailable_note="" line id nf state
  listed="$("${HDC_RESOLVED}" list targets)"
  while IFS= read -r line || [ -n "${line}" ]; do
    line="$(printf '%s' "${line}" | tr -d '\r')"
    case "${line}" in
      ""|"[Empty]"|"[Disconnected]"|"[empty]")
        continue
        ;;
    esac
    nf="$(printf '%s' "${line}" | awk '{print NF}')"
    id="$(printf '%s' "${line}" | awk '{print $1}')"
    if [ -z "${id}" ] || [ -z "${nf}" ] || [ "${nf}" -lt 1 ]; then
      continue
    fi
    if [ "${nf}" -eq 1 ]; then
      if harmony_accept_target "${id}"; then
        available="${available}${id}"$'\n'
      else
        unavailable_note="诊断文本或非真机目标，未当作可安装目标。"
      fi
      continue
    fi
    if [ "${nf}" -eq 2 ]; then
      state="$(printf '%s' "${line}" | awk '{print $2}')"
      case "$(printf '%s' "${state}" | tr '[:upper:]' '[:lower:]')" in
        online|connected|device)
          if harmony_accept_target "${id}"; then
            available="${available}${id}"$'\n'
          else
            unavailable_note="诊断文本或非真机目标，未当作可安装目标。"
          fi
          ;;
        offline|unauthorized|disconnected)
          unavailable_note="存在 Offline/unauthorized 设备，未当作可安装目标。"
          ;;
        *)
          unavailable_note="存在未知诊断文本，未当作可安装目标。"
          ;;
      esac
      continue
    fi
    unavailable_note="存在诊断文本，未当作可安装目标。"
  done <<EOF
${listed}
EOF
  SAYDO_HARMONY_AVAILABLE="${available}"
  SAYDO_HARMONY_UNAVAILABLE_NOTE="${unavailable_note}"
}

resolve_java() {
  if [ -n "${SAYDO_JAVA:-}" ]; then
    if [ -x "${SAYDO_JAVA}" ]; then
      printf '%s' "${SAYDO_JAVA}"
      return 0
    fi
    saydo_fail "SAYDO_JAVA 不可执行。"
  fi
  if [ -n "${JAVA_HOME:-}" ] && [ -x "${JAVA_HOME}/bin/java" ]; then
    printf '%s' "${JAVA_HOME}/bin/java"
    return 0
  fi
  command -v java >/dev/null 2>&1 || saydo_fail "找不到 java。请设置 SAYDO_JAVA 或 JAVA_HOME。"
  command -v java
}

resolve_hap_sign_tool() {
  local jar
  if [ -n "${SAYDO_HAP_SIGN_TOOL:-}" ]; then
    if [ -f "${SAYDO_HAP_SIGN_TOOL}" ]; then
      printf '%s' "${SAYDO_HAP_SIGN_TOOL}"
      return 0
    fi
    saydo_fail "SAYDO_HAP_SIGN_TOOL 不是文件。"
  fi
  jar="${DEVECO_SDK_HOME:-}/default/openharmony/toolchains/lib/hap-sign-tool.jar"
  if [ -f "${jar}" ]; then
    printf '%s' "${jar}"
    return 0
  fi
  saydo_fail "找不到 hap-sign-tool.jar。请设置 SAYDO_HAP_SIGN_TOOL 或 DEVECO_SDK_HOME。"
}

saydo_cleanup_hap_verify() {
  if [ -n "${SAYDO_HAP_VERIFY_DIR:-}" ] && [ -d "${SAYDO_HAP_VERIFY_DIR}" ]; then
    rm -rf "${SAYDO_HAP_VERIFY_DIR}"
  fi
}

verify_harmony_hap() {
  local java jar chain profile expected python_bin profile_out app_log profile_log
  java="$(resolve_java)"
  jar="$(resolve_hap_sign_tool)"
  python_bin="${SAYDO_PYTHON:-python3}"
  SAYDO_HAP_VERIFY_DIR="$(mktemp -d "${TMPDIR:-/tmp}/saydo-hap-verify.XXXXXX")"
  chmod 700 "${SAYDO_HAP_VERIFY_DIR}"
  trap saydo_cleanup_hap_verify EXIT
  chain="${SAYDO_HAP_VERIFY_DIR}/chain.cer"
  profile="${SAYDO_HAP_VERIFY_DIR}/profile.p7b"
  profile_out="${SAYDO_HAP_VERIFY_DIR}/profile-verify.json"
  app_log="${SAYDO_HAP_VERIFY_DIR}/verify-app.log"
  profile_log="${SAYDO_HAP_VERIFY_DIR}/verify-profile.log"
  if ! "${java}" -jar "${jar}" verify-app -inFile "${SIGNED_HAP}" -outCertChain "${chain}" -outProfile "${profile}" \
    >"${app_log}" 2>&1; then
    saydo_fail "hap-sign-tool verify-app 未通过"
  fi
  if [ ! -s "${chain}" ] || [ ! -s "${profile}" ]; then
    saydo_fail "verify-app 未写出 cert chain 或 profile。"
  fi
  if ! "${java}" -jar "${jar}" verify-profile -inFile "${profile}" -outFile "${profile_out}" \
    >"${profile_log}" 2>&1; then
    saydo_fail "hap-sign-tool verify-profile 未通过"
  fi
  if [ -L "${profile_out}" ] || [ ! -f "${profile_out}" ]; then
    saydo_fail "verify-profile 输出不是普通文件。"
  fi
  if [ ! -s "${profile_out}" ]; then
    saydo_fail "verify-profile 输出为空。"
  fi
  if [ "$(wc -c < "${profile_out}" | tr -d ' ')" -gt 1048576 ]; then
    saydo_fail "verify-profile 输出超过大小上限。"
  fi
  if ! "${python_bin}" - "${profile_out}" <<'PY'
import json
import sys

path = sys.argv[1]
try:
    with open(path, encoding="utf-8") as handle:
        payload = json.load(handle)
except Exception:
    raise SystemExit(1)
if not isinstance(payload, dict) or payload.get("verifiedPassed") is not True:
    raise SystemExit(1)
PY
  then
    saydo_fail "hap-sign-tool verify-profile 未通过"
  fi
  expected="$("${python_bin}" - "${SCRIPT_DIR}/AppScope/app.json5" <<'PY'
import re
import sys

text = open(sys.argv[1], encoding="utf-8").read()
match = re.search(r'"versionName"\s*:\s*"([^"]+)"', text)
if not match:
    raise SystemExit(1)
sys.stdout.write(match.group(1))
PY
)" || saydo_fail "无法从 AppScope/app.json5 读取 versionName。"
  if [ -z "${expected}" ]; then
    saydo_fail "无法从 AppScope/app.json5 读取 versionName。"
  fi
  if ! "${python_bin}" - "${SIGNED_HAP}" "${expected}" <<'PY'
import json
import sys
import zipfile

hap, expected = sys.argv[1], sys.argv[2]
try:
    with zipfile.ZipFile(hap) as archive:
        names = archive.namelist()
        path = next((name for name in names if name == "module.json" or name.endswith("/module.json")), "")
        if not path:
            raise SystemExit("missing module.json")
        payload = json.loads(archive.read(path).decode("utf-8"))
except Exception:
    raise SystemExit("invalid hap")
app = payload.get("app") if isinstance(payload, dict) else None
if not isinstance(app, dict):
    raise SystemExit("missing app")
if app.get("bundleName") != "com.octoooo.saydo":
    raise SystemExit("bundle")
if app.get("versionName") != expected:
    raise SystemExit("version")
PY
  then
    saydo_fail "HAP module.json 身份与工程声明不一致。"
  fi
}

HVIGORW_RESOLVED="$(resolve_hvigorw)"
SIGNED_HAP="${SCRIPT_DIR}/entry/build/default/outputs/default/entry-default-signed.hap"
UNSIGNED_HAP="${SCRIPT_DIR}/entry/build/default/outputs/default/entry-default-unsigned.hap"

if [ -z "${DEVECO_SDK_HOME:-}" ] && [ -d "/Applications/DevEco-Studio.app/Contents/sdk" ]; then
  DEVECO_SDK_HOME="/Applications/DevEco-Studio.app/Contents/sdk"
fi

saydo_remove_fixed_artifact "${SIGNED_HAP}" file
saydo_remove_fixed_artifact "${UNSIGNED_HAP}" file

if [ -n "${DEVECO_SDK_HOME:-}" ]; then
  env DEVECO_SDK_HOME="${DEVECO_SDK_HOME}" "${HVIGORW_RESOLVED}" assembleHap --no-daemon
else
  "${HVIGORW_RESOLVED}" assembleHap --no-daemon
fi

if [ -L "${SIGNED_HAP}" ] || [ ! -f "${SIGNED_HAP}" ]; then
  saydo_fail "缺少本次构建后更新的 signed HAP。当前只有 unsigned HAP 或产物无效。发布证书/P12 不等于签名 Profile；Profile 缺失时不能把 unsigned 包当作可安装产物，也不能手工临时签名后冒充发布包。"
fi
saydo_require_rebuilt_file "${SIGNED_HAP}" "Harmony signed HAP"
if [ -f "${UNSIGNED_HAP}" ] && [ ! -L "${UNSIGNED_HAP}" ] && [ "${UNSIGNED_HAP}" -nt "${SIGNED_HAP}" ]; then
  saydo_fail "缺少本次构建后更新的 signed HAP。当前只有 unsigned HAP 或产物无效。发布证书/P12 不等于签名 Profile；Profile 缺失时不能把 unsigned 包当作可安装产物，也不能手工临时签名后冒充发布包。"
fi
verify_harmony_hap
saydo_ok "HarmonyOS signed HAP 校验通过"

if [ "${SAYDO_BUILD_ONLY}" -eq 1 ]; then
  saydo_ok "build-only: 未安装。unsigned 包不可安装。"
  exit 0
fi

HDC_RESOLVED="$(resolve_hdc)"
list_harmony_targets
saydo_pick_single_device "HarmonyOS" "${SAYDO_HARMONY_AVAILABLE}" "${SAYDO_HARMONY_UNAVAILABLE_NOTE}"
"${HDC_RESOLVED}" -t "${SAYDO_DEVICE_ID}" install -r "${SIGNED_HAP}"
saydo_ok "已安装到指定 HarmonyOS 真机"
echo "这是签名 HAP 的开发安装，不是商店发布包，不得放入 GitHub Release。"
