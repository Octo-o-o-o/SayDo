// F26(2026-08-04 任务3 dogfood,义骁拍板方案 A):Brain 只读仓库能力——
// 锚定项目 workspace 路径内 readProjectFile/listProjectDir。硬边界(fail-closed):
// realpath 前缀判定防逃逸(含 symlink 穿越)、敏感名黑名单、单文件 16KB/400 行截断、
// listDir 200 项上限并跳过 .git/node_modules。写路径一概没有;审计留痕在工具注册侧。

import { readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { join, sep } from "node:path";

/** 敏感文件/目录名(命中即拒,不读不列) */
const DENY_NAME_RE = /^(\.env[^/]*|\.git|node_modules|id_rsa[^/]*|.*\.(pem|key|p12|pfx|keystore)|\.?secrets?[^/]*|\.npmrc|\.netrc)$/i;
/** listDir 恒跳过的子树(噪音+体积) */
const SKIP_DIR_RE = /^(\.git|node_modules|\.venv|__pycache__|dist|build|\.next|target)$/;

const MAX_FILE_BYTES = 16 * 1024;
const MAX_FILE_LINES = 400;
const MAX_DIR_ENTRIES = 200;

export type RepoReadResult =
  | { ok: true; relPath: string; content: string; truncated: boolean; totalBytes: number }
  | { ok: false; code: string; message: string };

export type RepoListResult =
  | { ok: true; relPath: string; entries: { name: string; kind: "file" | "dir"; size?: number }[]; truncated: boolean }
  | { ok: false; code: string; message: string };

/** workspace 内相对路径解析:realpath 前缀判定(symlink 逃逸同拒);黑名单逐段检查 */
function resolveInWorkspace(workspace: string, relPath: string): { ok: true; abs: string; wsReal: string } | { ok: false; code: string; message: string } {
  const cleaned = relPath.replace(/^\/+/, "").trim();
  if (cleaned.includes("..")) return { ok: false, code: "path_escape", message: "路径不得包含 .." };
  for (const seg of cleaned.split("/")) {
    if (seg && DENY_NAME_RE.test(seg)) {
      return { ok: false, code: "path_denied", message: `路径段「${seg}」属敏感名单,不可读` };
    }
  }
  let wsReal: string;
  try {
    wsReal = realpathSync(workspace);
  } catch {
    return { ok: false, code: "workspace_missing", message: "项目 workspace 路径不存在" };
  }
  const abs = join(wsReal, cleaned);
  let absReal: string;
  try {
    absReal = realpathSync(abs);
  } catch {
    return { ok: false, code: "not_found", message: `路径不存在:${cleaned || "."}` };
  }
  if (absReal !== wsReal && !absReal.startsWith(wsReal + sep)) {
    return { ok: false, code: "path_escape", message: "路径解析后越出项目 workspace(symlink 逃逸拒)" };
  }
  return { ok: true, abs: absReal, wsReal };
}

export function readRepoFile(workspace: string, relPath: string): RepoReadResult {
  const r = resolveInWorkspace(workspace, relPath);
  if (!r.ok) return r;
  let st: ReturnType<typeof statSync>;
  try {
    st = statSync(r.abs);
  } catch {
    return { ok: false, code: "not_found", message: `文件不存在:${relPath}` };
  }
  if (!st.isFile()) return { ok: false, code: "not_a_file", message: `不是文件:${relPath}(目录用 listProjectDir)` };
  const totalBytes = st.size;
  let raw: Buffer;
  try {
    raw = readFileSync(r.abs);
  } catch (err) {
    return { ok: false, code: "read_failed", message: String(err).slice(0, 120) };
  }
  // 二进制嗅探:前 512 字节含 NUL 即拒(语音对话读二进制无意义)
  const head = raw.subarray(0, 512);
  if (head.includes(0)) return { ok: false, code: "binary_file", message: "二进制文件不读;要看请用 openOnScreen" };
  let text = raw.subarray(0, MAX_FILE_BYTES).toString("utf8");
  let truncated = totalBytes > MAX_FILE_BYTES;
  const lines = text.split("\n");
  if (lines.length > MAX_FILE_LINES) {
    text = lines.slice(0, MAX_FILE_LINES).join("\n");
    truncated = true;
  }
  return { ok: true, relPath, content: text, truncated, totalBytes };
}

export function listRepoDir(workspace: string, relPath: string): RepoListResult {
  const r = resolveInWorkspace(workspace, relPath || ".");
  if (!r.ok) return r;
  let st: ReturnType<typeof statSync>;
  try {
    st = statSync(r.abs);
  } catch {
    return { ok: false, code: "not_found", message: `目录不存在:${relPath}` };
  }
  if (!st.isDirectory()) return { ok: false, code: "not_a_dir", message: `不是目录:${relPath}(文件用 readProjectFile)` };
  let names: string[];
  try {
    names = readdirSync(r.abs);
  } catch (err) {
    return { ok: false, code: "list_failed", message: String(err).slice(0, 120) };
  }
  const entries: { name: string; kind: "file" | "dir"; size?: number }[] = [];
  let truncated = false;
  for (const name of names) {
    if (DENY_NAME_RE.test(name) || SKIP_DIR_RE.test(name)) continue;
    if (entries.length >= MAX_DIR_ENTRIES) {
      truncated = true;
      break;
    }
    try {
      const s = statSync(join(r.abs, name));
      entries.push(s.isDirectory() ? { name, kind: "dir" } : { name, kind: "file", size: s.size });
    } catch {
      // 竞态消失的条目跳过
    }
  }
  entries.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "dir" ? -1 : 1));
  return { ok: true, relPath: relPath || ".", entries, truncated };
}
