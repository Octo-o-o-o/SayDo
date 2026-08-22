import { existsSync, lstatSync, mkdirSync, realpathSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { jcsDigest } from "@saydo/contracts";
import {
  assertOwnedByCurrentUser,
  assertRealDirectory,
  isReparsePoint,
  restrictOwnerOnly
} from "@saydo/platform";

export type WorkspacePolicyCode =
  | "workspace_path_form"
  | "workspace_unavailable"
  | "workspace_not_directory"
  | "workspace_outside_owner_home"
  | "workspace_state_overlap"
  | "workspace_project_overlap"
  | "workspace_managed_root"
  | "workspace_managed_owner"
  | "workspace_frozen_archive"
  | "workspace_registry_incomplete"
  | "workspace_identity_changed";

export class WorkspacePolicyError extends Error {
  readonly code: WorkspacePolicyCode;
  readonly pathDigest?: string;

  constructor(code: WorkspacePolicyCode, message: string, path?: string) {
    super(message);
    this.name = "WorkspacePolicyError";
    this.code = code;
    if (path) this.pathDigest = jcsDigest({ canonicalPath: path });
  }
}

export interface WorkspaceIdentity {
  path: string;
  dev: string;
  ino: string;
}

export function saydoStateRoot(): string {
  const configured = process.env["SAYDO_HOME"] ?? join(homedir(), ".saydo");
  if (!isAbsolute(configured)) {
    throw new WorkspacePolicyError("workspace_state_overlap", "SAYDO_HOME 必须是绝对路径");
  }
  return resolve(configured);
}

export function stateRootDigest(stateRoot: string): string {
  return createHash("sha256").update(stateRoot, "utf8").digest("hex");
}

export function managedProjectsRoot(): string {
  return join(saydoStateRoot(), "projects");
}

export function managedProjectPath(projectId: string): string {
  return join(managedProjectsRoot(), projectId);
}

function nearestExistingAncestor(path: string): string {
  let candidate = resolve(path);
  while (!existsSync(candidate)) {
    const parent = dirname(candidate);
    if (parent === candidate) break;
    candidate = parent;
  }
  return candidate;
}

function assertLexicalPathIsReal(path: string, code: "workspace_state_overlap" | "workspace_managed_root"): void {
  const lexical = resolve(path);
  const existing = nearestExistingAncestor(lexical);
  try {
    if (isReparsePoint(existing) || !lstatSync(existing).isDirectory() || realpathSync(existing) !== existing) {
      throw new WorkspacePolicyError(code, "路径父级包含漂移链接或不是实体目录");
    }
  } catch (err) {
    if (err instanceof WorkspacePolicyError) throw err;
    throw new WorkspacePolicyError(code, "路径父级包含漂移链接或不是实体目录");
  }
}

export function validateManagedRoot(
  root: string,
  expectedRoot = resolve(root)
): string {
  if (!existsSync(root)) {
    throw new WorkspacePolicyError("workspace_managed_root", "daemon-owned root 不存在");
  }
  try {
    const resolvedRoot = assertRealDirectory(root);
    if (resolvedRoot !== expectedRoot) {
      throw new WorkspacePolicyError("workspace_managed_root", "daemon-owned root 发生路径逃逸");
    }
    assertOwnedByCurrentUser(resolvedRoot);
    return resolvedRoot;
  } catch (err) {
    if (err instanceof WorkspacePolicyError) throw err;
    throw new WorkspacePolicyError("workspace_managed_root", "daemon-owned root 不是实体目录或 owner 不匹配");
  }
}

export function validateStateRoot(
  stateRoot: string,
  expectedStateRoot = resolve(stateRoot)
): string {
  if (!existsSync(stateRoot)) {
    throw new WorkspacePolicyError("workspace_state_overlap", "SayDo 状态根不存在");
  }
  try {
    const resolvedState = assertRealDirectory(stateRoot);
    if (resolvedState !== expectedStateRoot) {
      throw new WorkspacePolicyError("workspace_state_overlap", "SayDo 状态根发生路径逃逸");
    }
    assertOwnedByCurrentUser(resolvedState);
    return resolvedState;
  } catch (err) {
    if (err instanceof WorkspacePolicyError) throw err;
    throw new WorkspacePolicyError("workspace_state_overlap", "SayDo 状态根不是实体目录或 owner 不匹配");
  }
}

export function ensureStateRoot(): string {
  const stateRoot = saydoStateRoot();
  assertLexicalPathIsReal(stateRoot, "workspace_state_overlap");
  if (!existsSync(stateRoot)) mkdirSync(stateRoot, { recursive: true, mode: 0o700 });
  restrictOwnerOnly(stateRoot, "dir");
  return validateStateRoot(stateRoot, stateRoot);
}

export function ensureManagedWorkspaceRoot(): string {
  const stateRoot = ensureStateRoot();
  const root = join(stateRoot, "projects");
  mkdirSync(root, { recursive: true, mode: 0o700 });
  restrictOwnerOnly(root, "dir");
  return validateManagedRoot(root, join(stateRoot, "projects"));
}

export function validateManagedWorkspace(projectId: string, raw: string): string {
  const root = managedProjectsRoot();
  const resolvedState = validateStateRoot(saydoStateRoot());
  const resolvedRoot = validateManagedRoot(root, resolve(resolvedState, "projects"));
  const expected = resolve(root, projectId);
  if (resolve(raw) !== expected) {
    throw new WorkspacePolicyError("workspace_managed_root", "managed workspace 不在 daemon-owned root");
  }
  if (!existsSync(expected)) return expected;
  try {
    if (isReparsePoint(expected) || !lstatSync(expected).isDirectory()) {
      throw new WorkspacePolicyError("workspace_managed_root", "managed workspace 不是受管目录");
    }
    const resolved = realpathSync(expected);
    if (resolved !== resolve(resolvedRoot, projectId)) {
      throw new WorkspacePolicyError("workspace_managed_root", "managed workspace 逃逸 daemon-owned root");
    }
    assertOwnedByCurrentUser(resolved);
    return expected;
  } catch (err) {
    if (err instanceof WorkspacePolicyError) throw err;
    throw new WorkspacePolicyError("workspace_managed_root", "managed workspace 不是受管目录或 owner 不匹配");
  }
}

function isStrictDescendant(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

export function assertNoProjectWorkspaceOverlap(
  candidatePath: string,
  existing: Array<{ id: string; path: string }>,
  allowExactId?: string
): void {
  const conflict = existing.find(
    (item) =>
      (item.path === candidatePath ||
        isStrictDescendant(item.path, candidatePath) ||
        isStrictDescendant(candidatePath, item.path)) &&
      !(item.path === candidatePath && item.id === allowExactId)
  );
  if (conflict) {
    throw new WorkspacePolicyError(
      "workspace_project_overlap",
      `workspace 与现役项目 ${conflict.id} 重叠`,
      candidatePath
    );
  }
}

export function assertAllowedWorkspacePath(path: string): void {
  const ownerHome = realpathSync(homedir());
  if (!isStrictDescendant(ownerHome, path)) {
    throw new WorkspacePolicyError("workspace_outside_owner_home", "路径必须位于 owner home 的子目录", path);
  }
  const saydoStateLexical = saydoStateRoot();
  let saydoState = saydoStateLexical;
  if (existsSync(saydoStateLexical)) {
    saydoState = validateStateRoot(saydoStateLexical);
  }
  if (path === saydoState || isStrictDescendant(saydoState, path) || isStrictDescendant(path, saydoState)) {
    throw new WorkspacePolicyError("workspace_state_overlap", "不能把 SayDo 状态目录登记为项目", path);
  }
  const relParts = relative(ownerHome, path).split(sep);
  if (relParts.some((part) => part.startsWith("voice-coding.archive-"))) {
    throw new WorkspacePolicyError("workspace_frozen_archive", "冻结归档目录不能重新登记", path);
  }
}

export function canonicalizeWorkspace(raw: string): WorkspaceIdentity {
  if (raw.startsWith("~") && !raw.startsWith("~/")) {
    throw new WorkspacePolicyError("workspace_path_form", "不支持 ~user 路径");
  }
  const expanded = raw.startsWith("~/") ? resolve(homedir(), raw.slice(2)) : raw;
  if (!isAbsolute(expanded)) {
    throw new WorkspacePolicyError("workspace_path_form", "只接受绝对路径或 ~/ 路径");
  }
  let path: string;
  try {
    path = realpathSync(expanded);
  } catch {
    throw new WorkspacePolicyError("workspace_unavailable", "路径不存在或当前不可访问");
  }
  let stat;
  try {
    stat = lstatSync(path, { bigint: true });
  } catch {
    throw new WorkspacePolicyError("workspace_unavailable", "路径不存在或当前不可访问", path);
  }
  if (!stat.isDirectory()) {
    throw new WorkspacePolicyError("workspace_not_directory", "路径不是目录", path);
  }
  if (isReparsePoint(path)) {
    throw new WorkspacePolicyError("workspace_not_directory", "路径是漂移链接", path);
  }
  assertAllowedWorkspacePath(path);
  return { path, dev: String(stat.dev), ino: String(stat.ino) };
}

/**
 * 重校验 workspace 身份。
 *
 * **合同(09 §规则 1)= `realpath + (dev, ino)`。本函数按平台分叉,不是全平台丢 dev。**
 *
 * - **win32**:`dev` 承载 volume serial number,跨重启稳定(09 §规则 1 原文点名)。
 *   三项任一不符即 `workspace_identity_changed`,与合同逐字一致。
 * - **POSIX**:`st_dev` 是**挂载期标识**,同一卷在重启或挂载顺序变化后会换号。硬锚它会把
 *   「重挂载」误判成「目录被替换」。现场取证(2026-08-22,定时快照自 2026-08-07 连续失败):
 *
 *   ```
 *   sqlite3 ~/.saydo/saydo.db "SELECT workspace_dev, workspace_ino FROM projects WHERE status='active'"
 *   # -> 16777234|765311   (登记值)
 *   stat -f "%d %i" ~/WorkSpace/OctoDesk
 *   # -> 16777231 765311   (现值:dev 变了,ino 没变)
 *   ```
 *
 *   故 POSIX 上 `dev` 漂移**不判身份变化**,返回当前 identity 供调用方刷新;`path` 或 `ino` 变仍硬拒。
 *   威胁模型不放宽:目录被真正替换必然换 inode,且 `canonicalizeWorkspace` 已有
 *   realpath + 非 reparse point + `assertAllowedWorkspacePath` 位置约束。
 *
 * 09 §规则 1 已随本改动加「POSIX dev 语义」补注(评审 92 A 级:此前只改实现未回写契约,属静默双改)。
 */
export function revalidateWorkspaceIdentity(expected: WorkspaceIdentity): WorkspaceIdentity {
  const current = canonicalizeWorkspace(expected.path);
  if (current.path !== expected.path || current.ino !== expected.ino) {
    throw new WorkspacePolicyError("workspace_identity_changed", "目录在确认期间发生变化", expected.path);
  }
  // win32:dev = volume serial,稳定,按合同硬锚;POSIX:dev 是挂载期标识,漂移视为重挂载
  if (process.platform === "win32" && current.dev !== expected.dev) {
    throw new WorkspacePolicyError("workspace_identity_changed", "卷标识发生变化", expected.path);
  }
  return current;
}
