// Tier1 配置集中校验(W2 阶段 0-②/③;Codex 20 B2/B3,出处 research/codex-findings/20-executor-writeback.md §遗留)。
// 此前散装:绝对路径只在 index 判、版本断言用 includes()、无文件存在/可执行/versions 形态校验、
// 非 cursor 后端配置仍起 cursor 二进制。本模块收拢为单一裁决点,fail-closed:任一不满足 ⇒
// 执行器不启动(queued 不认领),verdict 带处方化 reason 供日志与审计。

import { accessSync, constants, lstatSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute } from "node:path";
import { hostKind, isReparsePoint } from "@saydo/platform";

export interface Tier1ConfigInput {
  cursorAgentBin: string;
  pinnedVersion: string;
}

/** B2 校验失败码(封闭联合;迟到评审 C 回收:去掉 `| string` 自我削弱,保穷尽检查) */
export type Tier1ConfigFailCode =
  | "pinned_version_empty"
  | "bin_not_absolute"
  | "bin_missing"
  | "bin_not_file"
  | "bin_not_executable"
  | "bin_not_versions_layout";

export type Tier1Verdict = { ok: true } | { ok: false; code: Tier1ConfigFailCode; reason: string };

/**
 * B2 四项(顺序即失败优先级):
 * ① 绝对路径(裸名走 PATH 会随 symlink 自更新漂移,削弱版本 pin 红线);
 * ② 文件存在且是常规文件、可执行;
 * ③ versions/<pinnedVersion>/ 目录形态(锁定副本的物理承载:versions/<ver>/cursor-agent——
 *    路径不在 pin 版本目录下 = 配错成 symlink 入口或别家副本);
 * ④ 精确版本相等由 assertExactVersion 在启动断言时执行(需要跑二进制,不在纯配置校验里)。
 */
export function validateTier1Config(i: Tier1ConfigInput): Tier1Verdict {
  if (i.pinnedVersion.trim() === "") {
    return { ok: false, code: "pinned_version_empty", reason: "cursor_agent_pinned_version 为空串" };
  }
  if (!isAbsolute(i.cursorAgentBin)) {
    return {
      ok: false,
      code: "bin_not_absolute",
      reason: `cursor_agent_bin 必须是锁定副本绝对路径(pin 红线),得到 "${i.cursorAgentBin}"`
    };
  }
  let st;
  try {
    st = statSync(i.cursorAgentBin);
  } catch {
    return { ok: false, code: "bin_missing", reason: `cursor_agent_bin 文件不存在:${i.cursorAgentBin}` };
  }
  if (!st.isFile()) {
    return { ok: false, code: "bin_not_file", reason: `cursor_agent_bin 不是常规文件:${i.cursorAgentBin}` };
  }
  try {
    if (isReparsePoint(i.cursorAgentBin) || lstatSync(i.cursorAgentBin).isSymbolicLink()) {
      return { ok: false, code: "bin_not_file", reason: `cursor_agent_bin 是漂移链接:${i.cursorAgentBin}` };
    }
  } catch {
    return { ok: false, code: "bin_missing", reason: `cursor_agent_bin 文件不存在:${i.cursorAgentBin}` };
  }
  if (hostKind() === "win32") {
    const base = basename(i.cursorAgentBin).toLowerCase();
    if (base !== "cursor-agent.exe" && base !== "cursor-agent") {
      return {
        ok: false,
        code: "bin_not_versions_layout",
        reason: `cursor_agent_bin 基名须为 cursor-agent.exe(得到 ${basename(i.cursorAgentBin)})`
      };
    }
  } else {
    try {
      accessSync(i.cursorAgentBin, constants.X_OK);
    } catch {
      return { ok: false, code: "bin_not_executable", reason: `cursor_agent_bin 不可执行:${i.cursorAgentBin}` };
    }
  }
  const verDir = dirname(i.cursorAgentBin);
  if (basename(verDir) !== i.pinnedVersion || basename(dirname(verDir)) !== "versions") {
    return {
      ok: false,
      code: "bin_not_versions_layout",
      reason: `cursor_agent_bin 须位于 versions/${i.pinnedVersion}/ 锁定副本目录下(实际 ${verDir})`
    };
  }
  return { ok: true };
}

/** B2-④ 精确版本相等(替换 includes():前缀/子串包含会放过 "<pinned>-dirty" 类漂移) */
export function assertExactVersion(actual: string, pinned: string): void {
  if (actual.trim() !== pinned) {
    throw new Error(
      `cursor-agent 版本漂移:pinned "${pinned}" 实际 "${actual.trim()}"——升级须重跑门禁仪式(spike run.sh + golden),不走自更新生效路径`
    );
  }
}

export interface Tier1StartupInput {
  /** [tier1] 两键(缺任一 = not_configured,与既有 fail-closed 行为一致) */
  cursorAgentBin?: string | undefined;
  pinnedVersion?: string | undefined;
  /** models.dev.agent(缺省 cursor) */
  adapter: string;
}

export type Tier1StartupVerdict =
  | { start: true; bin: string; pinned: string }
  | { start: false; code: "not_configured" | "unsupported_adapter" | Tier1ConfigFailCode; reason: string };

/**
 * 启动资格集中裁决(index.ts 消费;B3:非 cursor 后端配置启动即拒——
 * 此前 agent="claude_code" 仍起 cursor 二进制:runs.adapter 记错、能力谎报,fail-closed 修复)。
 */
export function tier1StartupVerdict(i: Tier1StartupInput): Tier1StartupVerdict {
  if (!i.cursorAgentBin || !i.pinnedVersion) {
    return {
      start: false,
      code: "not_configured",
      reason:
        '在 ~/.saydo/config.toml 增加 [tier1] cursor_agent_bin="<versions/<ver>/cursor-agent 绝对路径>" cursor_agent_pinned_version="<ver>";queued 任务在配置齐备前不会被认领'
    };
  }
  if (i.adapter !== "cursor") {
    return {
      start: false,
      code: "unsupported_adapter",
      reason: `models.dev.agent="${i.adapter}" 后端执行器未实现(仅 cursor);拒起而非起 cursor 二进制冒充(fail-closed;claude_sdk/codex 随后续批接入)`
    };
  }
  const v = validateTier1Config({ cursorAgentBin: i.cursorAgentBin, pinnedVersion: i.pinnedVersion });
  if (!v.ok) return { start: false, code: v.code, reason: v.reason };
  return { start: true, bin: i.cursorAgentBin, pinned: i.pinnedVersion };
}
