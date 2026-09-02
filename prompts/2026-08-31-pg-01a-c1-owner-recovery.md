# PG-01A C1 · owner 恢复派发

继续原实施 session，不重建 C0/C1。task=project-gap-closure；stage=PG-01A/C1；cycle=owner-recovery-20260831-1。
你是 implementation，Grok grok-4.6/xhigh；不是 reviewer 或 supervisor。只执行本次恢复，不派 subagent、不提交、不扩预算。

先重新读取 docs/plan/IMPL-PROMPT-PG-01A.md 全文及 docs/plan/2026-08-28-project-gap-owner-decisions.md 第 7 节。当前 canonical workflow-v2 contract 已由 supervisor 验证有效。旧 cycle 记录保留；本次恢复使用当前 cycle 的一次 repair。

owner 已明确批准上一轮提出的三个文件修复，以及由 supervisor 处理本地 I/E 两提交；仍无 push、merge、deploy、真实产品 AI/connector/账号调用、付费、用户数据删除权限。

## 这一次唯一允许的 delta

- packages/console/src/components/setupWizardUx.test.tsx：两条旧断言仍期待“本机运行 · 数据不出这台电脑”，而 SetupGate 已改为 canonical 文案“本机运行 · 外发范围以当前配置为准”。只更新对应文本断言，保留全部有效结构与行为断言，不 skip/删除/放宽。
- research/customer-question-corpus/dry-runs/01-three-pass-dry-run-result.md
- research/customer-question-corpus/dry-runs/02-dry-run-remediation-plan.md

两份投影须用现役 node research/customer-question-corpus/dry-runs/rebuild-three-pass-dry-run.mjs 重生成。新的授权例外见 C1-5/C1-8：本次已验证是既有 authority digest 失配，源摘要未变也允许重建这两份投影。
复用 dry-run-model.mjs 导出函数核验：source digest 必须仍为 0c2a1f6569db7c05088ab6d624eeecbcf3bc9260008780c42f3bf01db9db2da6；authority digest 必须仍为 e62d2115beee835ee882061be4b62512ef6ab6507c907a7e597fb92e8405ab98。48 项 authority 输入不得改变，writer/model/oracle 均不得改动。

保留已有全部其他 C1 产品 bytes，禁止修改 HANDOFF、控制文档、历史报告或证据。文本修改用 apply_patch；现役生成器可生成其两份产物。不能用改原始语料、改 oracle、改 renderer 或改 validator 消除红灯。

本次只修复以上内容并作必要短命令检查。supervisor 将独立执行合同内 focused gates 与全新 C1 readback；不在实施会话自判 GREEN，不自行跑 full gate 或启动后续 PG。
返回三份实际改动、生成器实际 exit、两类源摘要、未做事项。若出现新范围或命令错误，保留现场并报告，不改其他文件。不读取本机凭据或其他会话。
