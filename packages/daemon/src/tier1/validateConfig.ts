// Tier1 配置集中校验(W2 阶段 0-②/③;Codex 20 B2/B3,出处 research/codex-findings/20-executor-writeback.md §遗留)。
// 此前散装:绝对路径只在 index 判、版本断言用 includes()、无文件存在/可执行/versions 形态校验、
// 非 cursor 后端配置仍起 cursor 二进制。本模块收拢为单一裁决点,fail-closed:任一不满足 ⇒
// 执行器不启动(queued 不认领),verdict 带处方化 reason 供日志与审计。

import { accessSync, constants, lstatSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute } from "node:path";
import { hostKind, isReparsePoint } from "@saydo/platform";
import { familyFromModelName } from "../config/family.js";
import type { ClaudeIdentityVerdict } from "./claudeIdentity.js";

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
  /** [tier1] cursor 两键(缺任一 = not_configured,与既有 fail-closed 行为一致) */
  cursorAgentBin?: string | undefined;
  pinnedVersion?: string | undefined;
  /** models.dev.agent(缺省 cursor) */
  adapter: string;
  /** claude 分支输入(W5.4-b C1;09 §11 claude_code 承载段四键 + identity 登记核验结论) */
  claude?:
    | {
        bin?: string | undefined;
        pinnedVersion?: string | undefined;
        model?: string | undefined;
        /** verifyClaudeIdentity 结论(调用方注入;缺省按登记缺失 fail-closed) */
        identity?: ClaudeIdentityVerdict | undefined;
      }
    | undefined;
}

export type Tier1StartupVerdict =
  | { start: true; bin: string; pinned: string }
  | { start: false; code: "not_configured" | "unsupported_adapter" | Tier1ConfigFailCode; reason: string };

const CLAUDE_NOT_CONFIGURED_PRESCRIPTION =
  '在 ~/.saydo/config.toml 的 [tier1] 段配置 claude_bin="<claude 实体绝对路径>" claude_pinned_version="<claude --version 实测>" model="<opus 等 claude 族>",并跑 POST /api/setup/test {"scope":"tier1"} 写入 claude-identity.json;queued 任务在配置齐备前不会被认领';

/**
 * claude 分支(方案 §3.9/§3.7):bin 绝对路径+存在+可执行、pinned 非空、model 解析出 claude 族
 * (别名 opus/sonnet/haiku/fable 与 claude-* 前缀,族判定单源 familyFromModelName)、
 * identity 登记存在且 binaryPath/digest 一致。任一不满足 ⇒ not_configured + 处方化提示(含缺的键名);
 * spawn 前的运行时核验码(binary_identity_mismatch)归 C2 认领链,不在启动资格层。
 */
function claudeStartupVerdict(c: NonNullable<Tier1StartupInput["claude"]> | undefined): Tier1StartupVerdict {
  const bin = c?.bin && c.bin.trim() !== "" ? c.bin : undefined;
  const pinned = c?.pinnedVersion && c.pinnedVersion.trim() !== "" ? c.pinnedVersion : undefined;
  const model = c?.model && c.model.trim() !== "" ? c.model : undefined;
  const missing: string[] = [];
  if (!bin) missing.push("claude_bin");
  if (!pinned) missing.push("claude_pinned_version");
  if (!model) missing.push("model");
  if (!bin || !pinned || !model) {
    return {
      start: false,
      code: "not_configured",
      reason: `[tier1] 缺 ${missing.join("/")};${CLAUDE_NOT_CONFIGURED_PRESCRIPTION}`
    };
  }
  if (!isAbsolute(bin)) {
    return {
      start: false,
      code: "not_configured",
      reason: `claude_bin 必须是实体文件绝对路径(裸名走 PATH 不满足 pin),得到 "${bin}";${CLAUDE_NOT_CONFIGURED_PRESCRIPTION}`
    };
  }
  let st;
  try {
    st = statSync(bin);
  } catch {
    return { start: false, code: "not_configured", reason: `claude_bin 文件不存在:${bin};${CLAUDE_NOT_CONFIGURED_PRESCRIPTION}` };
  }
  if (!st.isFile()) {
    return { start: false, code: "not_configured", reason: `claude_bin 不是常规文件:${bin};${CLAUDE_NOT_CONFIGURED_PRESCRIPTION}` };
  }
  try {
    accessSync(bin, constants.X_OK);
  } catch {
    return { start: false, code: "not_configured", reason: `claude_bin 不可执行:${bin};${CLAUDE_NOT_CONFIGURED_PRESCRIPTION}` };
  }
  if (familyFromModelName(model) !== "claude") {
    return {
      start: false,
      code: "not_configured",
      reason: `[tier1] model="${model}" 解析不出 claude 族(接受别名 opus/sonnet/haiku/fable 或 claude-* 前缀);${CLAUDE_NOT_CONFIGURED_PRESCRIPTION}`
    };
  }
  const identity = c?.identity;
  if (!identity || !identity.ok) {
    const detail = identity && !identity.ok ? identity.detail : "identity 登记缺失(尚未跑 scope=tier1 自检)";
    return {
      start: false,
      code: "not_configured",
      reason: `claude 身份登记未通过:${detail};${CLAUDE_NOT_CONFIGURED_PRESCRIPTION}`
    };
  }
  return { start: true, bin, pinned };
}

/**
 * 启动资格集中裁决(index.ts 消费;B3:非 cursor 后端配置启动即拒——
 * 此前 agent="claude_code" 仍起 cursor 二进制:runs.adapter 记错、能力谎报,fail-closed 修复)。
 * W5.4-b C1:先按生效 adapter 分叉再校验(方案 §3.9 顺序重排);cursor 分支输出形状不变,
 * claude_code 走 claudeStartupVerdict,其余(codex 等)仍 unsupported_adapter。
 */
export function tier1StartupVerdict(i: Tier1StartupInput): Tier1StartupVerdict {
  if (i.adapter === "claude_code") return claudeStartupVerdict(i.claude);
  if (i.adapter !== "cursor") {
    return {
      start: false,
      code: "unsupported_adapter",
      reason: `models.dev.agent="${i.adapter}" 后端执行器未实现(仅 cursor/claude_code);拒起而非起别家二进制冒充(fail-closed;codex 随后续批接入)`
    };
  }
  if (!i.cursorAgentBin || !i.pinnedVersion) {
    return {
      start: false,
      code: "not_configured",
      reason:
        '在 ~/.saydo/config.toml 增加 [tier1] cursor_agent_bin="<versions/<ver>/cursor-agent 绝对路径>" cursor_agent_pinned_version="<ver>";queued 任务在配置齐备前不会被认领'
    };
  }
  const v = validateTier1Config({ cursorAgentBin: i.cursorAgentBin, pinnedVersion: i.pinnedVersion });
  if (!v.ok) return { start: false, code: v.code, reason: v.reason };
  return { start: true, bin: i.cursorAgentBin, pinned: i.pinnedVersion };
}
