# PG-01A 夜间恢复 · B1/B2 repair 1

继续原 Grok 实施 session，不恢复代码快照、不派 subagent、不启动 reviewer。你是 grok-4.6/xhigh implementation；当前用户已明确批准夜间继续至本轮可验收边界，supervisor 只编排。

task=project-gap-closure；stage=PG-01A/C1；cycle=owner-night-recovery-20260901。工作目录为当前 SayDo-pg-01a-20260831，branch=codex/pg-01a-20260831，HEAD=2b5517d322f062297d25806b02c4106e2ecc60e8。保留已有产品/文档改动，不新建重复任务或候选，不动主仓、validation worktree、Git refs、index 或提交。

先完整读取 docs/plan/IMPL-PROMPT-PG-01A.md。当前执行范围只认 C1-N 的 34 个 night exact paths；上方 C1-8/9 与 36 路径是历史恢复，不允许因此重开 Q0。读取 owner 决策单第 9 节、docs/06 第 7 节、docs/11 第 10.3 节、最后报告 docs/review/2026-08-31-pg-01a-c1-rereview-2.fable.md 的 B1/B2。没有范围变化，不再做方案审查。

执行前纯工具校验合同：python3 ~/.octoworkflow/validate_handoff.py docs/plan/IMPL-PROMPT-PG-01A.md --policy logs/pg01a-night-20260901.V1D8er/v2-policy.json。冻结 policy SHA-256=785d7d2028a8cae799831c9a1ea4584ae75bd6b47f8970be282f516df990589a；V2.3，不读待审 V2.4。不得因旧 cycle 一次修复额度再次询问；本夜预算由 supervisor 管理，你只执行当前一次范围内 repair。

## 必须修复的实际问题

B1：完整检查当前 31 required roots 的现役说明，不只改报告给出的行。重点是 release 中文“全部保存在**你自己的设备**”、音频“仅在本机处理，不上传”、英文 speech recognition/on-device 的绝对说法，以及中英文官网 FAQ 的任一 logged_in CLI 即可零 key 开聊。按真实配置/已验证能力给出条件和未验证范围，不凭检测或登录态推断调用成功、订阅权益、零费用或固定速度。保持双人群目标、完整语音可选，但不能写成普通用户/全部 AI 已开箱可用。

B2：将报告的实际中英文、Markdown/HTML 变体分别纳入独立行为回归。至少包含任一已登录 CLI、any logged-in CLI、Markdown 全部设备内、英文 on-device 语音、浏览器系统语音免费、配 API key 立即变快这些真实逃逸。先保留可复现的旧 checker 红灯输出，再修 checker/公开 copy，最后同一新测试转绿；每类独立断言，不能借另一个错误混过。现有五类、独立 required roots、missing-root、假 LIVE 测试全部保留。

同时补正常说明的负向保护：conditional/preview、零 key 不等于免费、具体配置决定外发和费用、约 15-25 秒观察值不是速度保证。scanner 是有限 guardrail，不是通用 NLP；不要求证明所有自然语言表达，也不能所有文本一律红。轻量扩充现有两文件即可，不造解析/生成/工作流平台。

## 不变与限制

Q0 checker/test、986 source、48 authority inputs、两份 dry-run 投影、renderer/oracle 全部不改，不重新生成正式 Q0，不做已关闭 Q0 大审计。runtime/provider/API key/权限/数据库/remote/语音行为不改；只改允许集的公开 copy、对应断言和两份 scanner 文件。canonical、HANDOFF、owner 决策、IMPL、evidence、ledger、journal、prompts、旧 review/日志均只读。其他会话可能改文档，保留，不覆盖。

所有文本编辑用 apply_patch；不删测试、skip/only、扩大豁免、编码隐藏短语或改规则造绿；不 reset/clean/stash。无 push/merge/deploy、真实产品 AI/connector 调用、登录/凭证、额度购买或数据删除权限。不变更 provider/model 或降低 sandbox。

## 本次返回边界

仅跑 C1-N focused：active-claim checker、active mutations、public redaction、emoji、doc links、git diff --check；若 console TS/TSX 有变化，补合同中的 console typecheck/lint/Vitest。已有 16 focused 不是本轮重跑证据。长于 30 秒的命令交已安装 external-cli-orchestrator 或交 supervisor，禁止模型层定频轮询。
不预跑完整 just ci，不生成 E/正式 Q0，不 commit/amend，不启动 PG-01B；supervisor 在 fresh 只读语义 GREEN 后跑同 candidate 完整门禁与页面验证。
返回实际 changed exact paths、B1/B2 对应位置、每条真实 focused argv/exit、旧红新绿摘要及未做事项。不要自判语义 GREEN 或把测试通过写成所有服务已支持。
