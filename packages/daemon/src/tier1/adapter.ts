// C2-Tier1 执行器适配层(计划 4.1;09 §6.1;modules/c C2)。
// 接口 = canUseTool 语义(后端无关);cursor_cli = dev 缺省(已验证),claude_sdk = 产品缺省(顺延)。
// 本文件:适配器接口 + cursor worktree 供给 + 版本 pin + egress 声明(G4)。
// 真实 spawn 在 CursorSpawner(可注入,测试用 fake);安全逻辑(hooks.json/版本断言/egress)纯函数化可单测。

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execAgentFileSync } from "../runtimeChildRegistry.js";

export type AdapterKind = "claude_code" | "cursor" | "codex";

/** egress 控制能力(G4:cursor 后端无法沙箱网络,egress=uncontrolled 如实声明,证据按后端分行) */
export type EgressControl = "sandboxed" | "uncontrolled";

export interface Tier1Adapter {
  readonly kind: AdapterKind;
  /** egress 控制声明(证据分行,不假装 cursor 能拦网络) */
  readonly egress: EgressControl;
  /** 启动前版本断言(锁定二进制 + 版本 pin;不符 fail-closed 拒起) */
  assertVersion(): void;
  /** 供给一次执行 worktree(git worktree add + 写审批钩子 + setup);返回 cwd 与 hook 路径 */
  provisionWorktree(input: ProvisionInput): ProvisionResult;
}

export interface ProvisionInput {
  taskId: string;
  /** 主仓路径(git worktree 的源) */
  repoPath: string;
  /** worktree 根(缺省 <repo>/.saydo/worktrees/<taskId>) */
  worktreeRoot?: string;
  branch: string;
  /** daemon 审批 socket 的 gate 脚本绝对路径(在 agent 不可写目录,4.1 完整性) */
  gateScriptPath: string;
}

export interface ProvisionResult {
  cwd: string;
  hooksJsonPath: string;
}

/**
 * hook 的 command 串(cursor `hooks.json` 与 claude `--settings` 共用)。
 * POSIX = 单引号包裹的脚本路径;win32 = 引用过的 node.exe + 脚本。
 *
 * 评审 91 B-3:POSIX 此前裸拼路径。该串由 shell 执行,`SAYDO_HOME` 含空格或单引号时
 * 会被切成多个词或直接语法损坏——门脚本执行不起来,等于每条命令都拿不到裁决。
 * 脚本正文里的 SOCK/LOG 已转义,这里是最后一处裸拼。
 */
export function cursorHookCommand(gateScriptPath: string, nodeExe = process.execPath): string {
  if (process.platform !== "win32") return `'${gateScriptPath.replace(/'/g, `'\\''`)}'`;
  const quote = (value: string): string => `"${value.replace(/"/g, '""')}"`;
  return `${quote(nodeExe)} ${quote(gateScriptPath)}`;
}

/** cursor hooks.json 生成(beforeShellExecution 阻塞钩子回连 daemon 审批通道) */
export function buildCursorHooksJson(gateScriptPath: string, timeoutSec = 90, nodeExe = process.execPath): string {
  return JSON.stringify(
    {
      version: 1,
      hooks: {
        beforeShellExecution: [{ command: cursorHookCommand(gateScriptPath, nodeExe), failClosed: true, timeout: timeoutSec }]
      }
    },
    null,
    2
  );
}

export interface CursorSpawner {
  /** cursor-agent status;抛错=未登录/不可用 */
  version(): string;
  /** git worktree add <path> -b <branch>(幂等由调用方保证) */
  addWorktree(repoPath: string, worktreePath: string, branch: string): void;
}

/** 真实 spawner(execFileSync;测试注入 fake) */
export function realCursorSpawner(lockedBinary?: string): CursorSpawner {
  const bin = lockedBinary ?? "cursor-agent";
  return {
    version() {
      return execAgentFileSync(bin, ["--version"], { encoding: "utf8" });
    },
    addWorktree(repoPath, worktreePath, branch) {
      execFileSync("git", ["worktree", "add", "-b", branch, worktreePath, "HEAD"], { cwd: repoPath, stdio: "ignore" });
    }
  };
}

export interface CursorAdapterOptions {
  spawner: CursorSpawner;
  /** 版本 pin:锁定的期望版本串(启动断言比对;不符 fail-closed) */
  pinnedVersion: string;
}

export class CursorCliAdapter implements Tier1Adapter {
  readonly kind = "cursor" as const;
  readonly egress: EgressControl = "uncontrolled"; // G4:cursor 无法沙箱网络,如实声明
  private readonly spawner: CursorSpawner;
  private readonly pinnedVersion: string;

  constructor(opts: CursorAdapterOptions) {
    this.spawner = opts.spawner;
    this.pinnedVersion = opts.pinnedVersion;
  }

  /** 版本 pin 断言(锁定二进制副本 + 启动版本断言;禁自更新生效路径——升级须重跑门禁仪式) */
  assertVersion(): void {
    const actual = this.spawner.version();
    if (!actual.includes(this.pinnedVersion)) {
      throw new Error(
        `cursor-agent version drift: expected pinned "${this.pinnedVersion}", got "${actual}" —— 升级须重跑门禁仪式(4.0),不走自更新生效路径`
      );
    }
  }

  provisionWorktree(input: ProvisionInput): ProvisionResult {
    const root = input.worktreeRoot ?? join(input.repoPath, ".saydo", "worktrees");
    const cwd = join(root, input.taskId);
    this.spawner.addWorktree(input.repoPath, cwd, input.branch);
    // 审批钩子:.cursor/hooks.json 指向 daemon 提供的 gate 脚本(gate 脚本在 agent 不可写目录)
    const cursorDir = join(cwd, ".cursor");
    mkdirSync(cursorDir, { recursive: true });
    const hooksJsonPath = join(cursorDir, "hooks.json");
    writeFileSync(hooksJsonPath, buildCursorHooksJson(input.gateScriptPath));
    return { cwd, hooksJsonPath };
  }
}

/** setup 命令 argv(worktree 供给;缺省 --ignore-scripts:不跑 postinstall 生命周期脚本,G4) */
export function setupArgv(packageManager: "pnpm" | "npm"): string[] {
  return packageManager === "pnpm"
    ? ["pnpm", "install", "--ignore-scripts"]
    : ["npm", "install", "--ignore-scripts"];
}
