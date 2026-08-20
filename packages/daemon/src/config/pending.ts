// first-run onboarding v4 晋升协议(staged pending → 活动文件)。
// 序:copy 活动→.bak + fsync(.bak) → rename(pending→活动) → fsync(目录)。
// 任一步失败=保留现场,启动用旧配置;pending 残留=下次启动再晋升(幂等)。

import {
  copyFileSync,
  existsSync,
  fsyncSync,
  openSync,
  closeSync,
  renameSync,
  unlinkSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  chmodSync,
  constants as fsConstants
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";

export const PENDING_SUFFIX = ".pending";
export const BAK_SUFFIX = ".bak";

export type PromoteStatus =
  | { ok: true; promoted: false; reason: "no_pending" }
  | { ok: true; promoted: true; activePath: string; bakPath: string | null }
  | { ok: false; promoted: false; stage: string; error: string; activePath: string; pendingPath: string };

/** pending / 活动 / bak 路径三元组 */
export function pendingPaths(saydoHome: string, baseName: string): {
  active: string;
  pending: string;
  bak: string;
} {
  const active = join(saydoHome, baseName);
  return {
    active,
    pending: active + PENDING_SUFFIX,
    bak: active + BAK_SUFFIX
  };
}

function fsyncPath(path: string): void {
  const fd = openSync(path, "r");
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

function fsyncDir(dir: string): void {
  // 目录 fsync:macOS/Linux 均支持 O_RDONLY 打开目录后 fsync
  try {
    const fd = openSync(dir, fsConstants.O_RDONLY);
    try {
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
  } catch {
    // 部分 FS 不支持目录 fsync;rename 同目录已原子,降级不抛
  }
}

/**
 * 晋升单个 pending 文件到活动位。
 * @param validatePending 可选:rename 前校验 pending 内容;失败则不晋升并 ok:false
 */
export function promotePendingFile(
  saydoHome: string,
  baseName: string,
  opts?: {
    validatePending?: (pendingText: string) => void;
    /** 测试注入:在指定阶段后抛错,模拟崩溃点(bak_done | rename_done) */
    crashAfter?: "bak_done" | "rename_done";
  }
): PromoteStatus {
  const { active, pending, bak } = pendingPaths(saydoHome, baseName);
  if (!existsSync(pending)) {
    return { ok: true, promoted: false, reason: "no_pending" };
  }

  mkdirSync(saydoHome, { recursive: true });

  try {
    const pendingText = readFileSync(pending, "utf8");
    if (opts?.validatePending) opts.validatePending(pendingText);
  } catch (err) {
    return {
      ok: false,
      promoted: false,
      stage: "validate",
      error: String(err).slice(0, 300),
      activePath: active,
      pendingPath: pending
    };
  }

  // 1) 活动 → .bak(+fsync)
  let bakWritten: string | null = null;
  try {
    if (existsSync(active)) {
      copyFileSync(active, bak);
      fsyncPath(bak);
      bakWritten = bak;
    } else if (existsSync(bak)) {
      // 没有本轮 active 时,历史 bak 不是可回滚快照;防止旧 secret 在后续恢复中复活。
      unlinkSync(bak);
      fsyncDir(saydoHome);
    }
    if (opts?.crashAfter === "bak_done") {
      throw new Error("injected_crash:bak_done");
    }
  } catch (err) {
    return {
      ok: false,
      promoted: false,
      stage: "bak",
      error: String(err).slice(0, 300),
      activePath: active,
      pendingPath: pending
    };
  }

  // 2) rename pending → 活动(同目录原子)
  try {
    renameSync(pending, active);
    if (opts?.crashAfter === "rename_done") {
      throw new Error("injected_crash:rename_done");
    }
  } catch (err) {
    // rename 失败:活动仍旧,pending 仍在(或已不在若部分 FS 怪异)——保留现场
    return {
      ok: false,
      promoted: false,
      stage: "rename",
      error: String(err).slice(0, 300),
      activePath: active,
      pendingPath: pending
    };
  }

  // 3) fsync 目录
  try {
    fsyncDir(saydoHome);
  } catch {
    // rename 已成功;目录 fsync 失败不回滚,记 stage 但视为已晋升
    return {
      ok: true,
      promoted: true,
      activePath: active,
      bakPath: bakWritten
    };
  }

  return { ok: true, promoted: true, activePath: active, bakPath: bakWritten };
}

export interface PromoteAllResult {
  config: PromoteStatus;
  env: PromoteStatus;
}

/** 启动对外只投影最终有效的晋升;rename 后又回滚不得报 promoted。 */
export function effectivePromotion(
  status: PromoteStatus,
  activation: { rolledBack: boolean; rollbackFailed: boolean }
): boolean {
  return status.ok && status.promoted && !activation.rolledBack && !activation.rollbackFailed;
}

function blockedStatus(saydoHome: string, baseName: string, stage: string, error: string): PromoteStatus {
  const paths = pendingPaths(saydoHome, baseName);
  return existsSync(paths.pending)
    ? { ok: false, promoted: false, stage, error, activePath: paths.active, pendingPath: paths.pending }
    : { ok: true, promoted: false, reason: "no_pending" };
}

/** 同一 activation 的后一文件失败时恢复前一文件,并把候选放回 pending。 */
function rollbackPromotedFile(saydoHome: string, baseName: string, status: PromoteStatus): PromoteStatus {
  if (!status.ok || !status.promoted) return status;
  const paths = pendingPaths(saydoHome, baseName);
  try {
    renameSync(paths.active, paths.pending);
    if (status.bakPath) {
      copyFileSync(status.bakPath, paths.active);
      fsyncPath(paths.active);
    }
    fsyncDir(saydoHome);
    return {
      ok: false,
      promoted: false,
      stage: "activation_rolled_back",
      error: "同一 activation 的另一文件晋升失败,已恢复旧活动文件",
      activePath: paths.active,
      pendingPath: paths.pending
    };
  } catch (err) {
    return {
      ok: false,
      promoted: false,
      stage: "activation_rollback_failed",
      error: String(err).slice(0, 300),
      activePath: paths.active,
      pendingPath: paths.pending
    };
  }
}

/** rename 后、runtime 合并前的崩溃恢复失败时,按 activation digest 把候选放回 pending 并恢复 bak。 */
export function rollbackActivationFiles(
  saydoHome: string,
  activation: { configDigest?: string; envDigest?: string } | undefined,
  statuses?: PromoteAllResult
): { ok: true } | { ok: false; error: string } {
  if (!activation) return { ok: true };
  try {
    for (const [baseName, digest] of [
      ["config.toml", activation.configDigest],
      [".env", activation.envDigest]
    ] as const) {
      if (!digest) continue;
      const paths = pendingPaths(saydoHome, baseName);
      if (!existsSync(paths.active)) continue;
      const activeDigest = createHash("sha256").update(readFileSync(paths.active)).digest("hex");
      if (activeDigest !== digest) continue;
      if (!existsSync(paths.pending)) renameSync(paths.active, paths.pending);
      const status = baseName === "config.toml" ? statuses?.config : statuses?.env;
      const backupForThisPromotion = status?.ok && status.promoted ? status.bakPath : undefined;
      // 本转明确 bakPath=null 表示晋升前没有 active,不得读任意历史 .bak。
      const recoverableBackup = backupForThisPromotion === null
        ? null
        : backupForThisPromotion ?? (existsSync(paths.bak) ? paths.bak : null);
      if (recoverableBackup) {
        copyFileSync(recoverableBackup, paths.active);
        fsyncPath(paths.active);
      }
    }
    fsyncDir(saydoHome);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err).slice(0, 300) };
  }
}

/** 启动最先:config/.env 共享预检;任一失败时不允许另一文件留在新活动态。 */
export function promoteAllPending(
  saydoHome: string,
  opts?: {
    validateConfigText?: (text: string) => void;
    validateActivation?: () => void;
  }
): PromoteAllResult {
  const configOpts: {
    validatePending?: (pendingText: string) => void;
  } = {};
  if (opts?.validateConfigText) configOpts.validatePending = opts.validateConfigText;
  if (opts?.validateActivation && (existsSync(pendingPaths(saydoHome, "config.toml").pending) || existsSync(pendingPaths(saydoHome, ".env").pending))) {
    try {
      opts.validateActivation();
    } catch (err) {
      const error = String(err).slice(0, 300);
      return {
        config: blockedStatus(saydoHome, "config.toml", "activation_preflight", error),
        env: blockedStatus(saydoHome, ".env", "activation_preflight", error)
      };
    }
  }
  let config = promotePendingFile(saydoHome, "config.toml", configOpts);
  if (!config.ok) {
    return {
      config,
      env: blockedStatus(saydoHome, ".env", "activation_blocked", "config 晋升失败,同一 activation 未发布")
    };
  }
  const env = promotePendingFile(saydoHome, ".env");
  if (!env.ok) config = rollbackPromotedFile(saydoHome, "config.toml", config);
  return { config, env };
}

/** 写 pending 文件(0600 用于密钥类;配置类同 0600 保守) */
export function writePendingFile(pendingPath: string, content: string, mode = 0o600): void {
  mkdirSync(dirname(pendingPath), { recursive: true });
  // 原子写到 pending 本身:tmp + rename 同目录
  const tmp = pendingPath + ".tmp";
  writeFileSync(tmp, content, { mode });
  try {
    chmodSync(tmp, mode);
  } catch {
    // 某些 FS 不支持 chmod
  }
  const fd = openSync(tmp, "r");
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(tmp, pendingPath);
  try {
    chmodSync(pendingPath, mode);
  } catch {
    /* ignore */
  }
}

/** 测试辅助:清理残留 pending/tmp */
export function clearPendingArtifacts(saydoHome: string, baseName: string): void {
  const { pending } = pendingPaths(saydoHome, baseName);
  for (const p of [pending, pending + ".tmp"]) {
    try {
      if (existsSync(p)) unlinkSync(p);
    } catch {
      /* ignore */
    }
  }
}
