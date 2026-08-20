// V4:服务层无 Focus 直写路径。Brain/工具面只能走 proposal → FocusWriteTx 服务 API。
// 本模块提供负向探测:检测 SQL 是否绕过 FocusWriteTx 的"直写"模式(测试用)。

import type { Db } from "../storage/db.js";

/** Focus 语义表(canonical);任何绕过 withFocusWriteTx 的 INSERT/UPDATE 视为违规 */
export const FOCUS_CANONICAL_TABLES = [
  "focuses",
  "focus_states",
  "focus_events",
  "focus_obligations",
  "focus_activations",
  "focus_close_settlements",
  "focus_project_refs",
  "focus_resume_packets",
  "action_execution_bindings"
] as const;

/** shadow 表允许直接写(不经 FocusWriteTx),但 external_bootstrap 不得写 canonical */
export const FOCUS_SHADOW_TABLES = ["focus_shadow_projections", "focus_compare_records"] as const;

/**
 * 测试/审计辅助:包装 db.prepare,拦截对 Focus 表的直接写 SQL。
 * 生产路径不启用;V4 负向测试用。
 */
export function installFocusDirectWriteGuard(db: Db): {
  restore: () => void;
  violations: string[];
} {
  const violations: string[] = [];
  const original = db.prepare.bind(db);
  const writeRe = /^\s*(INSERT|UPDATE|DELETE)\s+/i;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (db as any).prepare = (sql: string) => {
    const stmt = original(sql);
    if (writeRe.test(sql)) {
      const hit = FOCUS_CANONICAL_TABLES.find((t) => new RegExp(`\\b${t}\\b`, "i").test(sql));
      if (hit) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (stmt as any).run = (..._args: unknown[]) => {
          violations.push(sql.slice(0, 200));
          throw new Error(`V4 focus_direct_write_denied: attempted write to ${hit} outside FocusWriteTx`);
        };
        return stmt;
      }
    }
    return stmt;
  };
  return {
    violations,
    restore: () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (db as any).prepare = original;
    }
  };
}

/**
 * 服务层公开 API 白名单(Brain 不得 import 更底层 rows/SQL)。
 * 负向测试:模拟 "直调" fail-closed。
 */
export function denyBrainDirectFocusMutation(): never {
  throw new Error("V4: Brain has no direct Focus mutation path; use proposal tools only");
}
