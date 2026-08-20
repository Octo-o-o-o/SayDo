// Tier1 gate 脚本供给(执行器批;09 §11 Tier1 审批门 + IMPL-PROMPT fail-closed 四律)。
// gate.sh 落 ~/.saydo/tier1/(worktree 外,但与 agent 同 UID **非强制不可写**——Codex 20 A1
// 诚实口径;完整性由 W2 阶段 0 的每请求 digest 补偿控制承保,见 executor.gateScriptDriftGuard),
// daemon 每次启动重写(内容漂移自愈);worktree 内 .cursor/hooks.json 指向此绝对路径。
// 脚本纪律(spike 8 实证 + 律②):JSON 全程 jq 构造(畸形 fail-open);curl 失败/超时/非 JSON 一律 deny;
// 审批表达 = daemon 决策后返回非 deny(律①只依赖 deny 语义)。

import { chmodSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** hooks timeout 120s(spike 原件);curl 110s 留余量;daemon 侧 S2 审批 45s 收据窗在其内 */
export const GATE_CURL_TIMEOUT_SEC = 110;

export function buildGateScript(sockPath: string, logPath: string): string {
  return `#!/bin/bash
# SayDo Tier1 审批门(daemon 生成,每次启动重写,手改无效;fail-closed 四律见 tier1/gate.ts)
set -u
SOCK='${sockPath}'
LOG='${logPath}'
input=$(cat)
# W2 阶段0-④(Codex 20 B5):hook 输入对象校验——非 JSON 对象 / command 缺失·非 string·空串,
# 一律不 POST 直接 deny(此前 2>/dev/null 吞错后空 command 继续上行,未达"畸形立即 deny"口径)
if ! printf '%s' "$input" | jq -e 'type == "object" and (.command | type == "string") and (.command | length > 0)' >/dev/null 2>&1; then
  jq -nc '{permission:"deny", agent_message:"SayDo gate: malformed hook input (fail-closed)"}'
  exit 0
fi
cmd=$(printf '%s' "$input" | jq -r '.command' 2>/dev/null)
cwd=$(printf '%s' "$input" | jq -r '.cwd // .workspace_root // empty' 2>/dev/null)
[ -z "$cwd" ] && cwd="$PWD"
printf '%s\\n' "$(jq -nc --arg ts "$(date +%s)" --arg c "$cmd" --arg w "$cwd" '{ts:$ts,cmd:$c,cwd:$w}')" >> "$LOG" 2>/dev/null || true
resp=$(jq -nc --arg c "$cmd" --arg w "$cwd" '{command:$c,cwd:$w}' \\
  | curl -s --max-time ${GATE_CURL_TIMEOUT_SEC} --unix-socket "$SOCK" -X POST \\
      -H 'content-type: application/json' --data-binary @- http://saydo/gate 2>/dev/null)
perm=$(printf '%s' "$resp" | jq -r '.permission // empty' 2>/dev/null)
if [ "$perm" = "allow" ]; then
  jq -nc '{permission:"allow"}'
else
  msg=$(printf '%s' "$resp" | jq -r '.agent_message // "SayDo gate denied (fail-closed)"' 2>/dev/null)
  jq -nc --arg m "$msg" '{permission:"deny", agent_message:$m}'
fi
exit 0
`;
}

export interface GatePaths {
  dir: string;
  scriptPath: string;
  sockPath: string;
  logPath: string;
}

export function gatePaths(saydoHome: string): GatePaths {
  const dir = join(saydoHome, "tier1");
  return {
    dir,
    scriptPath: join(dir, "gate.sh"),
    sockPath: join(saydoHome, "tier1-gate.sock"),
    logPath: join(dir, "gate-fired.log")
  };
}

/** 原子写脚本(临时文件 + rename;迟到评审 C 回收:防并发在途 hook exec 到半截脚本) */
export function writeGateScriptAtomic(scriptPath: string, content: string): void {
  const tmp = `${scriptPath}.tmp`;
  writeFileSync(tmp, content);
  chmodSync(tmp, 0o755);
  renameSync(tmp, scriptPath);
}

/** 启动时供给(幂等重写;0o755 可执行) */
export function ensureGateScript(saydoHome: string): GatePaths {
  const p = gatePaths(saydoHome);
  mkdirSync(p.dir, { recursive: true });
  writeGateScriptAtomic(p.scriptPath, buildGateScript(p.sockPath, p.logPath));
  return p;
}

/** claude PreToolUse hook 脚本 curl 上限(v3.1:< hook timeout 120) */
export const CLAUDE_GATE_CURL_TIMEOUT_SEC = 100;

export const CLAUDE_HOOK_DENY_STATIC =
  '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"SayDo gate: fail-closed"}}';

function bashSingleQuoted(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function assertPositiveInt(n: number, name: string): number {
  if (!Number.isInteger(n) || n <= 0 || n > 3600) {
    throw new Error(`${name} must be a positive integer <= 3600`);
  }
  return n;
}

/** 纯函数:生成 gate-claude.sh 正文。本批不接线 ensureGateScript。 */
export function buildClaudeGateScript(
  sockPath: string,
  logPath: string,
  opts?: { curlMaxTimeSec?: number }
): string {
  const curlMax = assertPositiveInt(opts?.curlMaxTimeSec ?? CLAUDE_GATE_CURL_TIMEOUT_SEC, "curlMaxTimeSec");
  const sockLit = bashSingleQuoted(sockPath);
  const logLit = bashSingleQuoted(logPath);
  return `#!/bin/bash
# SayDo Tier1 claude PreToolUse 门(daemon 生成;失败路径 deny JSON + exit 2)
set -u
SOCK=${sockLit}
LOG=${logLit}
input=$(cat)
if [ -z "$input" ]; then
  printf '%s' '${CLAUDE_HOOK_DENY_STATIC}'
  exit 2
fi
if ! command -v jq >/dev/null 2>&1; then
  printf '%s' '${CLAUDE_HOOK_DENY_STATIC}'
  exit 2
fi
if ! printf '%s' "$input" | jq -e 'type == "object" and (.tool_name | type == "string") and (.tool_name | length > 0)' >/dev/null 2>&1; then
  printf '%s' '${CLAUDE_HOOK_DENY_STATIC}'
  exit 2
fi
tool=$(printf '%s' "$input" | jq -r '.tool_name')
cwd=$(printf '%s' "$input" | jq -r '.cwd // empty')
[ -z "$cwd" ] && cwd="$PWD"
printf '%s\\n' "$(jq -nc --arg ts "$(date +%s)" --arg t "$tool" --arg w "$cwd" '{ts:$ts,tool:$t,cwd:$w}')" >> "$LOG" 2>/dev/null || true
emit_allow() {
  printf '%s' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}'
  exit 0
}
emit_deny() {
  jq -nc --arg m "$1" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$m}}' || {
    printf '%s' '${CLAUDE_HOOK_DENY_STATIC}'
    exit 2
  }
  exit 0
}
emit_fail() {
  printf '%s' '${CLAUDE_HOOK_DENY_STATIC}'
  exit 2
}
emit_nodecision() { exit 0; }
path_outside() {
  local path="$1" root="$2"
  case "$path" in
    *..*) return 0 ;;
    '~'|'~/'*) return 0 ;;
    '$HOME'*|'\${HOME}'*) return 0 ;;
  esac
  if [ "\${path#/}" != "$path" ]; then
    case "$path" in
      "$root"|"$root"/*) return 1 ;;
      *) return 0 ;;
    esac
  fi
  return 1
}
post() {
  curl -s --max-time ${curlMax} --unix-socket "$SOCK" -X POST \\
    -H 'content-type: application/json' --data-binary "$1" http://saydo/gate 2>/dev/null
}
handle_resp() {
  local resp="$1"
  local perm
  perm=$(printf '%s' "$resp" | jq -r '.permission // empty' 2>/dev/null) || perm=""
  if [ "$perm" = "allow" ]; then emit_allow; fi
  if [ "$perm" = "deny" ]; then
    local msg
    msg=$(printf '%s' "$resp" | jq -r '.agent_message // "SayDo gate denied (fail-closed)"' 2>/dev/null)
    emit_deny "$msg"
  fi
  if [ "$perm" = "no_decision" ]; then emit_nodecision; fi
  emit_fail
}
case "$tool" in
  Bash)
    cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')
    if [ -z "$cmd" ]; then emit_fail; fi
    payload=$(jq -nc --arg c "$cmd" --arg w "$cwd" '{kind:"command",command:$c,cwd:$w}')
    handle_resp "$(post "$payload")"
    ;;
  Write|Edit|NotebookEdit)
    path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_input.notebook_path // empty')
    if [ -z "$path" ]; then emit_fail; fi
    if path_outside "$path" "$cwd"; then emit_deny "outside worktree"; fi
    payload=$(jq -nc --arg t "$tool" --arg p "$path" --arg w "$cwd" '{kind:"file_write",tool:$t,path:$p,cwd:$w}')
    handle_resp "$(post "$payload")"
    ;;
  Read)
    path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')
    if [ -z "$path" ]; then emit_fail; fi
    if path_outside "$path" "$cwd"; then emit_deny "outside worktree"; fi
    payload=$(jq -nc --arg p "$path" --arg w "$cwd" '{kind:"file_read",path:$p,cwd:$w}')
    handle_resp "$(post "$payload")"
    ;;
  *)
    emit_fail
    ;;
esac
`;
}

