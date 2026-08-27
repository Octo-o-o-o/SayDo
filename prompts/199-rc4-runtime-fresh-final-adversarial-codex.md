# RC4 runtime fresh final adversarial readback

你是一个全新、零上下文、只读的对抗评审会话。请审查当前仓库工作树（分支 `codex/rc4-runtime-recovery-rebuild`，真实 HEAD `2637d30ba5ffeedb6067555e9d816dd02d526e43`）相对 HEAD 的全部 tracked 与相关 untracked 产品/测试改动，并与 `prompts/196-rc4-runtime-second-readback-red-fresh-reimplementation.md` 的验收合同逐项对账。

不要读取 `research/codex-findings/`、其它编号 prompt、外部 agent 报告或实施者自述；它们会污染独立性。事实只来自你亲自读取的 prompt 196、AGENTS.md、canonical/ADR（按需）和当前代码/测试/真实命令。

全程只读：不得编辑、暂存、提交、推送、tag、发布、部署、删除或终止非本审查创建的进程。测试按文件串行，避免 daemon Vitest 并发。不要把 macOS policy/mock 测试冒充 Windows native 证据。

## 已有宿主门禁（仅作线索，不替代你的静态审查）

- platform：47 passed，5 条 Windows 条件 skip，exit 0。
- CLI：45 passed，1 条 Windows 条件 skip，exit 0。
- daemon 全套：128 files passed、2 skipped；2108 tests passed、6 skipped，exit 0。
- workspace typecheck、lint、emoji gate、`git diff --check`：exit 0。
- 真实 daemon recover-hold shutdown 用例在宿主通过；完整 startup-failure 19/19 通过。

绿色门禁不能覆盖静态安全/竞态/ABI 缺陷。请独立核对以下承重边界：

1. Windows Koffi typed ABI、结构布局与 pointer width；STARTUPINFOEXW handle whitelist；CRT fd3 reserved2；完整 argv quoting；CREATE_SUSPENDED → 同一 process handle assign Job → membership/birth → durable owner → ResumeThread → permit。
2. Windows real exit code、exit/close/stdout/stderr drain、pipe/HANDLE/CRT fd/thread/process/Job exactly-once ownership、所有 fault-point rollback、KILL_ON_JOB_CLOSE 与 process handle lifetime。
3. 每次 spawn 的不可变 UUID generation/capability；严格 `saydo-child-<uuid>`；所有 delayed signal/timer/release/reaper 捕获原 generation，不按裸 PID 重新查询 successor。
4. POSIX flock / Windows LockFileEx 真正跨进程、规范 home、deadline、崩溃释放；所有 writer/reaper/release 在锁内重读并按完整 identity CAS；kill 在锁外，audit + delete 在锁内且顺序 fail-closed。
5. shutdown/restart/fatal disposition `fatal > signal > restart`，只在 terminal freeze；首次 shutdown 立即取得 lifecycle；AbortSignal 贯穿 prior owner recovery、recover hold、inactive drain、spawn、tick；shutdown 后零新工作。
6. 普通入口与 recovery-only 的 ready IPC rejection、hostile unknown/Proxy/accessor/revoked/primitive 投影、catch 自身不抛、不泄漏 secret/完整路径；failure leaf first-seen、identity 去重、业务错误在前、精确测试。
7. 测试是否真过 production composition；是否有 test-only ambient 开关、放宽 timeout、主动 release 掩盖、mock/policy 冒充 native、宽松包含断言或缺失 Windows 真机杀伤性场景。

## 输出要求

用简体中文写最终报告：

- 先给 `Go` 或 `No-Go`。
- 只列 P0/P1/P2 的确定性、可行动 findings；每条必须含精确 `file:line`、触发路径/复现、合同影响、最小修复。不要用风格偏好充数。
- 给 prompt 196 逐项台账：`[ok]` / `[partial]` / `[fail]` / `[deviation]`。
- 列出你实际运行的命令、真实退出码和关键原始输出；失败不得隐藏。
- Windows 无法在本机证明的项目明确写“待 Windows host 验证”，不要推断通过。
- 给审查前后 HEAD、porcelain checksum、产品 diff checksum，证明零落地。

如果没有发布阻断 finding，明确写 Go；如果有，按严重级别给最小修复清单。不要因为实现规模大或测试绿而降低证据标准。
