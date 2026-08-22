import { linkSync, unlinkSync, writeFileSync } from "node:fs";
import { restrictOwnerOnly } from "./fs.js";

/** 原子独占创建:写临时文件再 link 到目标。已存在则抛 EEXIST。 */
export function acquireExclusiveLink(lockPath: string, payload: string): void {
  const temporary = `${lockPath}.${String(process.pid)}.tmp`;
  writeFileSync(temporary, payload, { mode: 0o600 });
  try {
    restrictOwnerOnly(temporary, "file");
    linkSync(temporary, lockPath);
    restrictOwnerOnly(lockPath, "file");
  } finally {
    try {
      unlinkSync(temporary);
    } catch {
      // 目标已链接后删临时;不存在则忽略
    }
  }
}
