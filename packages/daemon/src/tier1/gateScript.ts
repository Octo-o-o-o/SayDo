// Tier1 gate 脚本供给(执行器批;09 §11 Tier1 审批门 + IMPL-PROMPT fail-closed 四律)。
// gate.sh 落 ~/.saydo/tier1/(worktree 外,但与 agent 同 UID **非强制不可写**——Codex 20 A1
// 诚实口径;完整性由 W2 阶段 0 的每请求 digest 补偿控制承保,见 executor.gateScriptDriftGuard),
// daemon 每次启动重写(内容漂移自愈);worktree 内 .cursor/hooks.json 指向此绝对路径。
// 脚本纪律(spike 8 实证 + 律②):JSON 全程 jq 构造(畸形 fail-open);curl 失败/超时/非 JSON 一律 deny;
// 审批表达 = daemon 决策后返回非 deny(律①只依赖 deny 语义)。

import { chmodSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { restrictOwnerOnly } from "@saydo/platform";

/** hooks timeout 120s(spike 原件);curl 110s 留余量;daemon 侧 S2 审批 45s 收据窗在其内 */
export const GATE_CURL_TIMEOUT_SEC = 110;

export function buildGateScript(sockPath: string, logPath: string): string {
  // 评审 90 B-3:路径必须走 bashSingleQuoted(claude 版已正确)。SAYDO_HOME 允许含单引号
  // (workspace 路径校验不禁),裸拼会生成语法损坏的脚本 —— 门脚本坏掉 = 每条命令都拿不到裁决。
  const sockLit = bashSingleQuoted(sockPath);
  const logLit = bashSingleQuoted(logPath);
  return `#!/bin/bash
# SayDo Tier1 审批门(daemon 生成,每次启动重写,手改无效;fail-closed 四律见 tier1/gate.ts)
set -u
SOCK=${sockLit}
LOG=${logLit}
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
  /** 当前 backend 活动入口(POSIX=gate.sh, win32=gate-cursor.mjs) */
  scriptPath: string;
  /** claude PreToolUse 门脚本(与活动入口同目录;POSIX=gate-claude.sh, win32=gate-claude.mjs) */
  claudeScriptPath: string;
  sockPath: string;
  logPath: string;
  bindPath: string;
  secretPath: string;
}

export function gatePaths(saydoHome: string): GatePaths {
  const dir = join(saydoHome, "tier1");
  const win = process.platform === "win32";
  return {
    dir,
    scriptPath: join(dir, win ? "gate-cursor.mjs" : "gate.sh"),
    claudeScriptPath: join(dir, win ? "gate-claude.mjs" : "gate-claude.sh"),
    sockPath: join(saydoHome, "tier1-gate.sock"),
    logPath: join(dir, "gate-fired.log"),
    bindPath: join(dir, "gate-bind.json"),
    secretPath: join(dir, "gate-secret")
  };
}

/**
 * 原子写脚本(临时文件 + rename;迟到评审 C 回收:防并发在途 hook exec 到半截脚本)。
 * 评审 91 C-1:win32 上 chmod 近乎无效,rename 后重走 restrictOwnerOnly——
 * 否则漂移自愈会把一个本来 owner-only 的门脚本换成继承默认 DACL 的新文件。
 */
export function writeGateScriptAtomic(scriptPath: string, content: string): void {
  const tmp = `${scriptPath}.tmp`;
  writeFileSync(tmp, content);
  chmodSync(tmp, 0o755);
  renameSync(tmp, scriptPath);
  if (process.platform === "win32") restrictOwnerOnly(scriptPath, "file");
}

/**
 * 数据面原子写(hooks.json / gate-bind.json):0o600,不给执行位。
 * 评审 91 C-1:win32 上 chmod 近乎无效,rename 后必须重走 restrictOwnerOnly 才有 owner-only DACL。
 */
export function writeDataSurfaceAtomic(path: string, content: string): void {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, content, { mode: 0o600 });
  chmodSync(tmp, 0o600);
  renameSync(tmp, path);
  if (process.platform === "win32") restrictOwnerOnly(path, "file");
}

export function buildActiveGateScript(p: GatePaths): string {
  if (process.platform === "win32") {
    return buildCursorGateMjs(p.bindPath, p.secretPath, p.logPath);
  }
  return buildGateScript(p.sockPath, p.logPath);
}

/** claude 门脚本正文(与 buildActiveGateScript 对称:POSIX=bash+curl --unix-socket, win32=Node+HMAC) */
export function buildActiveClaudeGateScript(p: GatePaths): string {
  if (process.platform === "win32") {
    return buildClaudeGateMjs(p.bindPath, p.secretPath, p.logPath);
  }
  return buildClaudeGateScript(p.sockPath, p.logPath);
}

/** 启动时供给(幂等重写;0o755 可执行)。双脚本同写:cursor 活动入口 + claude hooks 门(W5.4-b C2a drift guard)。 */
export function ensureGateScript(saydoHome: string): GatePaths {
  const p = gatePaths(saydoHome);
  mkdirSync(p.dir, { recursive: true, mode: 0o700 });
  if (process.platform === "win32") restrictOwnerOnly(p.dir, "dir");
  // 两个 writeGateScriptAtomic 内部已在 win32 重走 restrictOwnerOnly(评审 91 C-1),此处不再重复
  writeGateScriptAtomic(p.scriptPath, buildActiveGateScript(p));
  writeGateScriptAtomic(p.claudeScriptPath, buildActiveClaudeGateScript(p));
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

/** 纯函数:生成 gate-claude.sh 正文。启动/ensureGateScript 原子落盘,不进 worktree。 */
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
# 与圈根无关的越界向量预筛(第二层 fail-closed)。
# 评审 92 + owner 2026-08-22 裁决:**不再判「绝对路径是否在 cwd 下」**——
# 那条需要 worktree 根,而脚本是全局单份、跨 run 复用,手里只有 hook 报的 cwd;
# daemon 的 findRunByCwd 明确允许 cwd 落在 worktree 子目录,拿 cwd 当圈根会误拒圈内文件。
# 圈内外由 daemon 的 fileToolToEffect(tool, path, cwd, run.worktree) 单点裁决。
# 这里只挡「无论圈根是什么都越界」的形态:.. 分量、~ 展开、$HOME 展开。
path_traversal() {
  local path="$1"
  # 按分量判,不用 *..* 裸通配(评审 92 新 C:那样会误拒 foo..bar 这类合法文件名)
  case "$path" in
    */../*|*/..|../*|..) return 0 ;;
    '~'|'~/'*) return 0 ;;
    '$HOME'*|'\${HOME}'*) return 0 ;;
  esac
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
    if path_traversal "$path"; then emit_deny "path traversal (fail-closed)"; fi
    payload=$(jq -nc --arg t "$tool" --arg p "$path" --arg w "$cwd" '{kind:"file_write",tool:$t,path:$p,cwd:$w}')
    handle_resp "$(post "$payload")"
    ;;
  Read)
    path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')
    if [ -z "$path" ]; then emit_fail; fi
    if path_traversal "$path"; then emit_deny "path traversal (fail-closed)"; fi
    payload=$(jq -nc --arg p "$path" --arg w "$cwd" '{kind:"file_read",path:$p,cwd:$w}')
    handle_resp "$(post "$payload")"
    ;;
  *)
    emit_fail
    ;;
esac
`;
}

const GATE_MJS_IMPORTS = `import { createHmac } from "node:crypto";
import { appendFileSync, readFileSync } from "node:fs";
import http from "node:http";
`;

function gatePostClientSource(timeoutMs: number): string {
  return `
function postGate(bodyObj) {
  const bodyBuf = Buffer.from(JSON.stringify(bodyObj), "utf8");
  return new Promise((resolve) => {
    let bind;
    try {
      bind = JSON.parse(readFileSync(BIND_PATH, "utf8"));
    } catch {
      resolve("");
      return;
    }
    // 评审 90 B-2:JSON.parse("null")/数组/标量都是合法 JSON 但非法形状;
    // 不先判就会在 bind.host 上抛,顶层 await 无 catch ⇒ 不出 deny JSON、退出码也不是合同要求的 2
    if (!bind || typeof bind !== "object" || Array.isArray(bind)) {
      resolve("");
      return;
    }
    if (bind.host !== "127.0.0.1" || typeof bind.port !== "number" || bind.port === 47100) {
      resolve("");
      return;
    }
    let secret;
    try {
      secret = readFileSync(SECRET_PATH);
    } catch {
      resolve("");
      return;
    }
    const hex = createHmac("sha256", secret).update(bodyBuf).digest("hex");
    const req = http.request({
      host: "127.0.0.1",
      port: bind.port,
      path: "/gate",
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(bodyBuf.length),
        "x-saydo-gate": hex
      },
      timeout: ${String(timeoutMs)}
    }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    });
    req.on("error", () => resolve(""));
    req.on("timeout", () => {
      req.destroy();
      resolve("");
    });
    req.write(bodyBuf);
    req.end();
  });
}

function logLine(obj) {
  try {
    appendFileSync(LOG_PATH, JSON.stringify({ ts: Math.floor(Date.now() / 1000), ...obj }) + "\\n");
  } catch {
    // 日志失败不阻断门
  }
}
`;
}

/** Windows Cursor beforeShellExecution 入口(Node JSON.parse + HMAC;禁止字符串拼接 JSON) */
export function buildCursorGateMjs(
  bindPath: string,
  secretPath: string,
  logPath: string,
  timeoutSec = GATE_CURL_TIMEOUT_SEC
): string {
  const timeoutMs = assertPositiveInt(timeoutSec, "cursorGateTimeoutSec") * 1000;
  return `#!/usr/bin/env node
${GATE_MJS_IMPORTS}const BIND_PATH = ${JSON.stringify(bindPath)};
const SECRET_PATH = ${JSON.stringify(secretPath)};
const LOG_PATH = ${JSON.stringify(logPath)};
${gatePostClientSource(timeoutMs)}
function deny(msg) {
  process.stdout.write(JSON.stringify({ permission: "deny", agent_message: msg }));
}
// 评审 90 B-2:任何未预期抛出都必须仍然出 deny(fail-closed),不能静默退出让 hook 落回 vendor 权限流
function bail() {
  try {
    deny("SayDo gate: internal error (fail-closed)");
  } catch {
    // stdout 都写不出就只能靠退出码
  }
  process.exit(0);
}
process.on("uncaughtException", bail);
process.on("unhandledRejection", bail);

const raw = readFileSync(0, "utf8");
let input;
try {
  input = JSON.parse(raw);
} catch {
  deny("SayDo gate: malformed hook input (fail-closed)");
  process.exit(0);
}
if (!input || typeof input !== "object" || Array.isArray(input)) {
  deny("SayDo gate: malformed hook input (fail-closed)");
  process.exit(0);
}
if (input.kind !== undefined && input.kind !== "command") {
  deny("SayDo gate: unknown kind (fail-closed)");
  process.exit(0);
}
const command = input.command;
if (typeof command !== "string" || command.length === 0) {
  deny("SayDo gate: malformed hook input (fail-closed)");
  process.exit(0);
}
const cwd = typeof input.cwd === "string" && input.cwd
  ? input.cwd
  : (typeof input.workspace_root === "string" && input.workspace_root ? input.workspace_root : process.cwd());
logLine({ cmd: command, cwd });
const respRaw = await postGate({ command, cwd });
let resp;
try {
  resp = JSON.parse(respRaw);
} catch {
  deny("SayDo gate denied (fail-closed)");
  process.exit(0);
}
if (resp && resp.permission === "allow") {
  process.stdout.write(JSON.stringify({ permission: "allow" }));
} else {
  const msg = resp && typeof resp.agent_message === "string" && resp.agent_message
    ? resp.agent_message
    : "SayDo gate denied (fail-closed)";
  deny(msg);
}
process.exit(0);
`;
}

/** Windows Claude PreToolUse:与 POSIX `gate-claude.sh` 同分支——Bash/Write/Edit/NotebookEdit/Read 四路 + 三态响应 */
export function buildClaudeGateMjs(
  bindPath: string,
  secretPath: string,
  logPath: string,
  opts?: { timeoutSec?: number }
): string {
  const timeoutMs = assertPositiveInt(opts?.timeoutSec ?? CLAUDE_GATE_CURL_TIMEOUT_SEC, "claudeGateTimeoutSec") * 1000;
  return `#!/usr/bin/env node
${GATE_MJS_IMPORTS}const BIND_PATH = ${JSON.stringify(bindPath)};
const SECRET_PATH = ${JSON.stringify(secretPath)};
const LOG_PATH = ${JSON.stringify(logPath)};
const DENY_STATIC = ${JSON.stringify(CLAUDE_HOOK_DENY_STATIC)};
${gatePostClientSource(timeoutMs)}
function emitDeny(msg) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: msg
    }
  }));
}
function emitFail() {
  process.stdout.write(DENY_STATIC);
  process.exit(2);
}
function emitAllow() {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "allow" }
  }));
  process.exit(0);
}
// 无裁决:空输出 exit 0,落回 Claude 自身权限流(与 POSIX emit_nodecision 等价)
function emitNoDecision() {
  process.exit(0);
}
// 评审 90 B-2:未预期抛出走合同失败出口(deny JSON + exit 2),不留静默退出的口子
process.on("uncaughtException", () => emitFail());
process.on("unhandledRejection", () => emitFail());
// 与圈根无关的越界向量预筛(第二层 fail-closed),语义与 POSIX 的 path_traversal 一致。
// 评审 92 + owner 2026-08-22 裁决:不再判「绝对路径是否在 cwd 下」(见 POSIX 侧同注)。
// 评审 92 另点名 POSIX 的 *..* 裸通配会误拒 foo..bar 这类合法文件名——两端本次统一改为按分量判。
function pathTraversal(p) {
  if (typeof p !== "string" || p.length === 0) return true;
  const BS = String.fromCharCode(92);
  const parts = p.split("/").join(BS).split(BS);
  if (parts.includes("..")) return true;
  if (p.charAt(0) === "~") return true;
  const up = p.toUpperCase();
  if (up.indexOf("%USERPROFILE%") === 0 || up.indexOf("%HOMEPATH%") === 0) return true;
  if (p.indexOf("$HOME") === 0 || p.indexOf("\${HOME}") === 0) return true;
  return false;
}
async function decide(payload) {
  const respRaw = await postGate(payload);
  let resp;
  try {
    resp = JSON.parse(respRaw);
  } catch {
    emitFail();
  }
  if (resp && resp.permission === "allow") emitAllow();
  if (resp && resp.permission === "no_decision") emitNoDecision();
  if (resp && resp.permission === "deny") {
    emitDeny(typeof resp.agent_message === "string" && resp.agent_message
      ? resp.agent_message
      : "SayDo gate denied (fail-closed)");
    process.exit(0);
  }
  emitFail();
}

const raw = readFileSync(0, "utf8");
if (!raw) emitFail();
let input;
try {
  input = JSON.parse(raw);
} catch {
  emitFail();
}
if (!input || typeof input !== "object" || Array.isArray(input)) emitFail();
const tool = input.tool_name;
if (typeof tool !== "string" || tool.length === 0) emitFail();
const cwd = typeof input.cwd === "string" && input.cwd ? input.cwd : process.cwd();
logLine({ tool, cwd });
const ti = input.tool_input && typeof input.tool_input === "object" ? input.tool_input : {};
if (tool === "Bash") {
  const command = typeof ti.command === "string" ? ti.command : "";
  if (!command) emitFail();
  await decide({ kind: "command", command, cwd });
} else if (tool === "Write" || tool === "Edit" || tool === "NotebookEdit") {
  const fp = typeof ti.file_path === "string" && ti.file_path
    ? ti.file_path
    : (typeof ti.notebook_path === "string" ? ti.notebook_path : "");
  if (!fp) emitFail();
  if (pathTraversal(fp)) {
    emitDeny("path traversal (fail-closed)");
    process.exit(0);
  }
  await decide({ kind: "file_write", tool, path: fp, cwd });
} else if (tool === "Read") {
  const fp = typeof ti.file_path === "string" ? ti.file_path : "";
  if (!fp) emitFail();
  if (pathTraversal(fp)) {
    emitDeny("path traversal (fail-closed)");
    process.exit(0);
  }
  await decide({ kind: "file_read", path: fp, cwd });
} else {
  emitFail();
}
`;
}
