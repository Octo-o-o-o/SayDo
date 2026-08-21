import { lstatSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, normalize, relative, sep } from "node:path";
import { hostKind } from "@saydo/platform";
import type { EffectDescriptor } from "../policy/engine.js";

/** 按文件名收窄的敏感基名(圈内写 ⇒ touchesSensitiveData / S2)。`.env*` 含 .envrc / .env.local */
export const SENSITIVE_FILE_BASENAME_RE =
  /(?:^|\/)\.env[^/]*$|(?:^|\/)[^/]*\.pem$|(?:^|\/)[^/]*\.key$|(?:^|\/)id_rsa[^/]*$|(?:^|\/)id_ed25519[^/]*$|(?:^|\/)\.npmrc$|(?:^|\/)\.netrc$|(?:^|\/)credentials[^/]*$/i;

function basenameOf(p: string): string {
  const norm = p.replace(/\\/g, "/");
  const i = norm.lastIndexOf("/");
  return i >= 0 ? norm.slice(i + 1) : norm;
}

function expandUser(p: string): string | "unresolvable" {
  if (p === "~") return homedir();
  if (p.startsWith("~/")) return join(homedir(), p.slice(2));
  if (p === "$HOME" || p === "${HOME}") return homedir();
  if (p.startsWith("$HOME/")) return join(homedir(), p.slice("$HOME/".length));
  if (p.startsWith("${HOME}/")) return join(homedir(), p.slice("${HOME}/".length));
  if (/\$|`/.test(p)) return "unresolvable";
  return p;
}

function lstatOrNull(p: string): ReturnType<typeof lstatSync> | null {
  try {
    return lstatSync(p);
  } catch {
    return null;
  }
}

export type ResolvedFileToolPath =
  | { abs: string }
  | { unresolvable: true }
  | { dangling: true }
  | { dotdot: true };

function hasDotDotComponent(p: string): boolean {
  return p.replace(/\\/g, "/").split("/").includes("..");
}

/** 祖先链用 lstat。任一层是 symlink ⇒ realpath;抛错(悬空)⇒ dangling,禁止把 symlink 基名当普通后缀拼接。
 *  normalize 之前若任一分量为 `..` ⇒ dotdot(S3):禁止词法折叠穿过 live symlink。 */
export function resolveFileToolPath(path: string, cwd: string): ResolvedFileToolPath {
  if (typeof path !== "string" || path.trim() === "") return { unresolvable: true };
  if (hasDotDotComponent(path)) return { dotdot: true };
  const expanded = expandUser(path.trim());
  if (expanded === "unresolvable") return { unresolvable: true };
  if (hasDotDotComponent(expanded)) return { dotdot: true };
  if (hostKind() !== "win32" && /^[A-Za-z]:[\\/]/u.test(expanded)) return { unresolvable: true };
  let abs = expanded;
  if (!isAbsolute(abs)) {
    if (!cwd || typeof cwd !== "string") return { unresolvable: true };
    abs = `${cwd.replace(/[/\\]+$/, "")}/${expanded}`;
  }
  if (hasDotDotComponent(abs)) return { dotdot: true };
  abs = normalize(abs);
  const suffixParts: string[] = [];
  let ancestor = abs;
  for (;;) {
    const st = lstatOrNull(ancestor);
    if (!st) {
      if (ancestor === dirname(ancestor)) return { unresolvable: true };
      suffixParts.unshift(basenameOf(ancestor));
      ancestor = dirname(ancestor);
      continue;
    }
    if (st.isSymbolicLink()) {
      let root: string;
      try {
        root = realpathSync(ancestor);
      } catch {
        return { dangling: true };
      }
      return { abs: suffixParts.length > 0 ? join(root, ...suffixParts) : root };
    }
    let root: string;
    try {
      root = realpathSync(ancestor);
    } catch {
      return { unresolvable: true };
    }
    return { abs: suffixParts.length > 0 ? join(root, ...suffixParts) : root };
  }
}

function isInsideWorktree(absPath: string, cwd: string): boolean | "unresolvable" {
  if (typeof cwd !== "string" || cwd.trim() === "" || cwd === "/") return "unresolvable";
  let wt: string;
  try {
    const st = lstatOrNull(cwd);
    wt = st ? realpathSync(cwd) : normalize(cwd);
  } catch {
    return "unresolvable";
  }
  if (wt.endsWith(sep) && wt.length > 1) wt = wt.slice(0, -1);
  if (wt === "/" || wt.length === 0) return "unresolvable";
  const p = absPath.endsWith(sep) && absPath.length > 1 ? absPath.slice(0, -1) : absPath;
  const rel = relative(wt, p);
  if (rel === "") return true;
  if (isAbsolute(rel) || rel === ".." || rel.startsWith(`..${sep}`)) return false;
  return true;
}

function outsideRead(): EffectDescriptor {
  return { kind: "delete_data", target: "read-outside-worktree" };
}

function outsideWrite(reason?: string): EffectDescriptor {
  const d: EffectDescriptor = { kind: "delete_data", target: "write-outside-worktree" };
  if (reason) d.reason = reason;
  return d;
}

export function fileToolToEffect(tool: string, path: unknown, cwd: string): EffectDescriptor {
  const isRead = tool === "Read";
  if (typeof path !== "string") {
    return isRead ? outsideRead() : { kind: "delete_data", target: "unresolvable" };
  }
  const resolved = resolveFileToolPath(path, cwd);
  if ("dotdot" in resolved) {
    return isRead
      ? { kind: "delete_data", target: "read-outside-worktree", reason: "dotdot" }
      : outsideWrite("dotdot");
  }
  if ("dangling" in resolved) {
    return isRead
      ? { kind: "delete_data", target: "read-outside-worktree", reason: "dangling_symlink" }
      : outsideWrite("dangling_symlink");
  }
  if ("unresolvable" in resolved) {
    return isRead ? outsideRead() : { kind: "delete_data", target: "unresolvable" };
  }
  const inside = isInsideWorktree(resolved.abs, cwd);
  if (inside === "unresolvable") {
    return isRead ? outsideRead() : { kind: "delete_data", target: "unresolvable" };
  }
  const sensitive = SENSITIVE_FILE_BASENAME_RE.test(resolved.abs.replace(/\\/g, "/"));
  if (isRead) {
    if (!inside) return outsideRead();
    return { kind: "read", ...(sensitive ? { touchesSensitiveData: true } : {}) };
  }
  if (!inside) return outsideWrite();
  return {
    kind: "write_worktree",
    ...(sensitive ? { touchesSensitiveData: true } : {})
  };
}
