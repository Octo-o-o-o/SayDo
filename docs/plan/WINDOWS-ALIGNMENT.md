# Windows 对齐实施计划

> **For agentic workers:** 按任务顺序落地。步骤用 checkbox。设计源 =
> [设计 ADR-004](../adr/design/ADR-004-windows-platform.md) +
> [工程 ADR-003](../adr/ADR-003-os-adapters.md)。
> 形状冲突以 `docs/09-data-contracts.md` 为准。

**Goal:** 让 SayDo 在原生 Windows 上按与 macOS 相同的 Gate 0 / 身份 / 审批纪律跑通
daemon + console + pipeline + Tier1 门,且 macOS 零回归。

**Architecture:** 新增 `@saydo/platform` 承载 OS adapter;daemon/cli 删除 win32 短路;
pipeline 用对等 Python 小模块;POSIX 的 unix-socket/`gate.sh`/launchd 保持生产路径。
Windows 审批门 = 环回临时端口 + HMAC,不是 Named Pipe。

**Tech Stack:** Node 22, koffi(Job Object / GetProcessTimes / NTFS 卷断言,失败 fail-closed),
环回 HTTP + HMAC,Node 门禁脚本。PowerShell 不作 production birth/ACL 主路径。
本批独占 gate 运输与 `gate-*.mjs`;W5.4-b 暂停改 `handleGateRequest` 直到本批收口。

## Global Constraints

- 全仓零 emoji;状态词不说"完成/做完"。
- 不 bypass Gate 0;S3 语音不放行。
- 不改官网 FAQ;不 commit/push/deploy,除非 owner 另授权。
- 不把 WSL 当测试绿。
- 新增依赖必须在工程 ADR-003 已点名(koffi)。
- 标识符与日志键英文;注释与文档简体中文。

---

## File map

| 路径 | 职责 |
|---|---|
| `packages/platform/` | 新建:host/fs/process/gate listen/ACL/lock |
| `packages/daemon/src/projects/workspace.ts` | 改用 platform 的 identity/owner/reparse |
| `packages/daemon/src/projects/anchor.ts` | Windows 路径词法(先拒 URI,盘符左边界,quoted 整段) |
| `packages/daemon/src/index.ts` | processBirth/lock 改调 platform |
| `packages/daemon/src/runtimeChildRegistry.ts` | 具名 Job Object;删除 win32 空组 |
| `packages/daemon/src/tier1/executor.ts` | env 白名单;killOwnedTree;verify 隔离 USERPROFILE |
| `packages/daemon/src/tier1/gateServer.ts` | POSIX sock;win32 环回+HMAC |
| `packages/daemon/src/tier1/gateScript.ts` | 生成 gate-cursor.mjs / gate-claude.mjs;digest 活动入口 |
| `packages/daemon/src/config/validateConfig.ts` | cursor_agent_bin 允许 .exe |
| `packages/daemon/src/net/capToken.ts` | restrictOwnerOnly,失败 fail-closed |
| `packages/daemon/src/launchd/uvBin.ts` | `path.delimiter` + `uv.exe` |
| `packages/daemon/src/brain/tools.ts` | 跨 OS 编辑器探测 |
| `packages/daemon/src/callback/desktop.ts` | Windows toast provider |
| `packages/cli/src/emergencyReaper.ts` | 删除 throw;用 killOwnedTree+birth |
| `packages/cli/src/supervisor.ts` | processStart 改 platform |
| `packages/cli/src/open.ts` | 迁到 platform 或薄转调 |
| `packages/cli/scripts/verify-distribution.mjs` | 去 bash 硬依赖 |
| `pipeline/src/saydo_pipeline/platform.py` | 信号、状态根、owner |
| `pipeline/src/saydo_pipeline/__main__.py` | 去 `add_signal_handler` |
| `scripts/check-emoji.mjs` 等 | Node 门禁 |
| `scripts/dev.mjs` | 跨 OS 三进程(先 daemon ready 再 pipeline;只杀本脚本 spawn) |
| `justfile` | 调 node,不绑 bash shebang |
| `docs/09` 等 | 已在设计回写任务 |

---

### Task 1: `@saydo/platform` 内核 + 单测

**Files:**
- Create: `packages/platform/package.json`
- Create: `packages/platform/tsconfig.json`
- Create: `packages/platform/src/index.ts`
- Create: `packages/platform/src/host.ts`
- Create: `packages/platform/src/fs.ts`
- Create: `packages/platform/src/process.ts`
- Create: `packages/platform/src/lock.ts`
- Create: `packages/platform/test/fs.test.ts`
- Create: `packages/platform/test/process.test.ts`
- Modify: `pnpm-workspace.yaml`(已含 `packages/*`,无需改成员,只需新包被扫到)

**Interfaces:**
- Produces:
  - `hostKind(): "darwin" | "win32" | "linux" | "other"`
  - `homeDir(): string`
  - `pathDelimiter(): string`
  - `fsIdentity(absPath: string): { path: string; dev: string; ino: string }`
  - `assertRealDirectory(absPath: string): string`
  - `assertOwnedByCurrentUser(absPath: string): void`
  - `restrictOwnerOnly(absPath: string, kind: "file" | "dir"): void`
  - `isReparsePoint(absPath: string): boolean`
  - `processBirth(pid: number): string | null`
  - `processAlive(pid: number): boolean`
  - `killOwnedTree(claim: { pid: number; expectedBirth: string; jobName?: string }): Promise<void>`
  - `createNamedJob(name: string): JobHandle` (non-win32 不调用;koffi 失败抛错)
  - `acquireExclusiveLink(path: string, payload: string): void`
  - `listenGateHttp` / `gateClientEnv`

- [x] **Step 1: 写失败测试** `packages/platform/test/fs.test.ts`

```ts
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, afterEach } from "vitest";
import { assertRealDirectory, fsIdentity, restrictOwnerOnly } from "../src/fs.js";

const roots: string[] = [];
afterEach(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
  roots.length = 0;
});

describe("fsIdentity", () => {
  it("同一路径两次 identity 相等,不同目录不相等", () => {
    const root = mkdtempSync(join(tmpdir(), "saydo-plat-"));
    roots.push(root);
    const a = fsIdentity(root);
    expect(a.path).toBe(root);
    expect(a.dev.length).toBeGreaterThan(0);
    expect(a.ino.length).toBeGreaterThan(0);
    expect(fsIdentity(root)).toEqual(a);
    const other = mkdtempSync(join(tmpdir(), "saydo-plat-"));
    roots.push(other);
    expect(fsIdentity(other).ino).not.toBe(a.ino);
  });
});

describe("restrictOwnerOnly", () => {
  it("写入后当前用户仍可读,不抛", () => {
    const root = mkdtempSync(join(tmpdir(), "saydo-plat-"));
    roots.push(root);
    const f = join(root, "secret");
    writeFileSync(f, "x");
    restrictOwnerOnly(f, "file");
    expect(assertRealDirectory(root)).toBeDefined();
  });
});
```

- [x] **Step 2: 跑测确认失败**(模块不存在)
- [x] **Step 3: 最小实现**(POSIX 用 `stat`/`chmod`;win32 用精确 DACL 构造+回读,禁止 `icacls /grant` 字面;测试注入 stub)
- [x] **Step 4: process 测本进程 birth 非空且 alive;killOwnedTree 仅在 birth 匹配时杀派生 sleep 子进程**
- [x] **Step 5: 接入 pnpm filter;typecheck 绿**

验收: `pnpm --filter @saydo/platform test` 在本机绿。

---

### Task 2: 工程入口去 bash 硬依赖

**Files:**
- Create: `scripts/check-emoji.mjs`(逻辑照抄 `scripts/check-emoji.sh`,用 `rg` 子进程或逐文件扫;优先 spawn `rg`,无 rg 时用 Node 读文本文件)
- Create: `scripts/test-emoji-gate.mjs`
- Create: `scripts/check-hardcoded-colors.mjs`
- Create: `scripts/test-color-gate.mjs`
- Create: `scripts/test-migration-tools.mjs`(包装现有 `.mjs` 工具自测;若 `test-migration-tools.sh` 只是调 node,直接改 just)
- Create: `scripts/dev.mjs`
- Modify: `justfile`
- Modify: `package.json` `ci:node`

`scripts/dev.mjs` 行为:先起 daemon,等 ready,再起 pipeline 与 console;转发 SIGINT。
Windows 只杀本脚本 spawn 的三进程,禁止调用 `killOwnedTree` / `taskkill /T`。

justfile `ci-node` 改为只调 `node scripts/....mjs`。保留 `.sh` 文件作 POSIX 兼容包装(内部 `exec node`),避免外链文档立刻死。

验收:在 Windows PowerShell 无 Git Bash 假设下 `node scripts/check-emoji.mjs` exit 0。

---

### Task 3: workspace / 路径词法 / 状态根

**Files:**
- Modify: `packages/daemon/src/projects/workspace.ts`
- Modify: `packages/daemon/src/projects/anchor.ts`
- Modify: `packages/daemon/test/project-anchor.test.ts`
- Modify: `pipeline/src/saydo_pipeline/__main__.py` + 新建 `platform.py`

要点:
- `getuid` 缺失时走 `assertOwnedByCurrentUser`,不得跳过。
- `mkdirSync(..., { mode: 0o700 })` 之后 `restrictOwnerOnly`。
- `pathSpans` 接受盘符路径;补 Windows 样例测试(即使用 posix 分隔的 `C:/Users/...` fixture,在 win32 用真 homedir 子目录)。

验收: `project-anchor` 相关 vitest 在本机绿;pipeline `python -c "from saydo_pipeline.platform import saydo_state_root"` 在已有 HOME 下不因 signal 崩。

---

### Task 4: 实例锁 + supervisor + reaper

**Files:**
- Modify: `packages/daemon/src/index.ts` (`processBirth`/`acquireInstanceLock`)
- Modify: `packages/cli/src/supervisor.ts`
- Modify: `packages/cli/src/emergencyReaper.ts`
- Modify: 对应测试

删除 `if (win32) throw`。生产禁止 `alive1:pid`。
Windows 外部编排不能投递可捕获 SIGINT,走 `$SAYDO_HOME/runtime/cli-stop-<cliPid>`。

验收:在 Windows 上启动 daemon 两次,第二次报 already owned;杀第一进程后第二进程能夺锁。

---

### Task 5: 子进程 Job Object + env 白名单

**Files:**
- Modify: `packages/daemon/src/runtimeChildRegistry.ts`
- Modify: `packages/daemon/src/tier1/executor.ts`
- Modify: `packages/daemon/src/providers/byoa/runner.ts`
- Modify: `packages/daemon/src/launchd/uvBin.ts`
- Modify: `packages/daemon/test/tier1-security.test.ts`

win32 spawn 进 Job;verify 隔离 `USERPROFILE` 与 `HOME` 同时指向任务空目录。

验收:既有"verify 读 ~/.ssh 失败"在 Windows 上对 `%USERPROFILE%\.ssh` 同样成立。

---

### Task 6: 审批门环回+HMAC + gate-*.mjs

**Files:**
- Modify: `packages/daemon/src/tier1/gateServer.ts`
- Modify: `packages/daemon/src/tier1/gateScript.ts`
- Modify: `packages/daemon/test/tier1-gate-socket.test.ts`(win32 skipIf)
- Create: `packages/daemon/test/tier1-gate-loopback.test.ts`(win32)

POSIX 测试保持 bash+curl。Windows 测试:startGateServer(loopback+HMAC) + spawn `node gate-cursor.mjs`。
未知 `kind` deny。digest 覆盖活动入口。W5.4-b 不得并行改 `handleGateRequest`。

验收:四律用例在本机绿(malformed deny / timeout deny / allow / 独立 seq / HMAC 失败 deny)。

---

### Task 7: pipeline 信号 + 桌面通知 + 编辑器探测

**Files:**
- Modify: `pipeline/src/saydo_pipeline/__main__.py`
- Modify: `packages/daemon/src/callback/desktop.ts`
- Modify: `packages/daemon/src/brain/tools.ts`
- Test: pipeline pytest 增 Windows 可跑的 signal 单测(mock)

`notifyDesktop` 分发:darwin=osascript, win32=PowerShell toast, else=false。
失败返回 false,不抛。

---

### Task 8: canonical 已在设计包落地后的测试与 11 文案接线

**Files:**
- Modify: console S3 按钮文案键,按 11 新句"用本机认证批准"
- 不改 WebAuthn 协议

---

### Task 9: 本机 `just ci` 与定向回归

跑:
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`(允许 darwin skip)
- `node scripts/check-emoji.mjs` 与 color/migration 等价
- pipeline ruff + pytest
- `git diff --check`

把跳过的 darwin 测试名单写入 `e2e/evidence/windows-alignment.md`。

---

## 非本计划

- 官网 FAQ 翻转
- Actions `windows-latest`
- Windows Service / Scheduled Task 安装器
- SAPI TTS
- Linux 正式 SKU
- 提交与部署
