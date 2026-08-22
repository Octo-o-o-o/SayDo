# Codex 对抗评审 88 · Windows 对齐合同包

只读。不改文件、不提交、不部署。审查当前工作树的 Windows 对齐设计包是否可放行实施。

## 必读

1. `docs/adr/design/ADR-004-windows-platform.md`
2. `docs/adr/ADR-003-os-adapters.md`
3. `docs/plan/WINDOWS-ALIGNMENT.md`
4. 已回写的 canonical:`docs/02` §7、`docs/03` 文首与 Keychain 句、`docs/04` 桌面通知注记、`docs/07` 原则 2/D5/D11/D17、`docs/09` §1 路径与状态根/§11 审批门、`docs/11` §5.4/§5.5、`docs/adr/README.md`、`docs/plan/IMPLEMENTATION-PLAN-2.md` W-Win 行
5. 对照实现现状(只读,用于证伪"纸面可跑"):
   - `packages/cli/src/emergencyReaper.ts` win32 throw
   - `packages/daemon/src/runtimeChildRegistry.ts` win32 空组
   - `packages/daemon/src/tier1/gateServer.ts` / `gateScript.ts`
   - `packages/daemon/src/index.ts` processBirth / linkSync
   - `packages/daemon/src/projects/workspace.ts` / `anchor.ts` pathSpans
   - `pipeline/src/saydo_pipeline/__main__.py` add_signal_handler
   - `justfile` bash shebang

## 核验题

1. 不变量是否真的没放宽 Gate 0 / S3 / 身份 fail-closed?有没有把 Named Pipe、koffi、icacls 写成可静默降级?
2. `alive1:pid` 收紧是否波及 macOS 现网锁(daemon 今日有此回退)?这是回归还是必要硬化?若硬化,计划是否给了 macOS 行为变化说明?
3. Job Object + koffi 是否把 native 编译/CI 变成新单点?失败模式是否 fail-closed?
4. 路径词法加 `C:\` 会不会把普通中文里的"C:"或盘符口语误触发?quoted/unquoted 规则有无歧义?
5. cap-token 从"chmod 失败继续"收紧为 fail-closed,是否打爆非 NTFS/测试 FS?
6. 律②从 jq 改为 JSON 解析器,macOS `gate.sh` 是否仍必须 jq(应是)?digest 补偿是否覆盖 `.mjs`?
7. 官网 FAQ 不动 vs 内部合同已写 Windows 正式面,对外诚实口径有无裂口?
8. W-Win 与 W5.4-b 并行是否会双写 executor/gate?
9. Node `stat.dev`/`ino` 在 ReFS / 网络盘 / subst 上的稳定性是否被合同排除?
10. pipeline Python 与 TS platform 双写语义会不会分叉?

先给可放行/仍需阻断和 A/B/C 计数。发现须给 file:line、复现、后果、最小修复。无 A/B 时明确 A=0、B=0。报告仅输出到 stdout。
