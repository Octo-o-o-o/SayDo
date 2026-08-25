# T18a 三槽 CLI 接线对抗性评审

你是 SayDo T18a 第一批的对抗性只读评审者。仓库
`~/WorkSpace/SayDo`，基线 `d1bde0d`，当前分支
`feat/t18a-cli-slots`；候选包含已提交的 canonical/BYOA 骨架与未提交的三槽接线。

规格正本是
`~/WorkSpace/OctoAgent/docs/product/2026-08-09-onboarding方案-v1.md`
的 `## v11`、`### v11.1`，细则以后者为准。先完整阅读规格、`AGENTS.md`、当前
`git diff d1bde0d`、`docs/07-tech-stack-decisions.md`、`docs/09-data-contracts.md`、
`docs/11-ui-spec.md` 与相关测试。不要修改文件，不要启动 subagent。

逐项寻找可复现反例：

1. T18-0 是否把三槽 CLI 一发一收、`dialog_cli_oneshot` 后续批、dialog 判死收窄及 UI 后续批写成单一当前真相。
2. BYOA 是否真实传递/清理 schema，cursor 是否内嵌 schema 且严格只重试一次；非零退出、空输出、未知事件是否 fail-closed。
3. AbortSignal、SIGTERM→3s→SIGKILL、wall/idle/output cap、stderr drain、单次网络重试、per-CLI=1/全局=2/队满 busy 是否有竞态、泄漏或错误分类。
4. thinking/cheap/evaluator CLI 是否只有真实 self-test 登记命中才 active；配置/binary digest 漂移是否 fail-closed；project override 是否恒拒 CLI。
5. 四字段 `requestedModel/observedModel/observedModelSource/observedModelExempted` 是否在生产结果和审计一致；Codex 无流内 model 是否只有绝对路径+内容 digest 复核与审计后豁免；unknown 是否可能武装 evaluator。
6. evaluator 双 ack 四态是否只有双齐+self-test 过才 armed；setup 是否逐槽真实调用，cheap/evaluator 严格 schema；失败是否只清本槽且人话不泄 secret/完整路径；probe 是否 unarmed→active。
7. subscription ledger 是否按真实槽位、`source=subscription/known=0/amount=NULL`、用量不可得四键 0 + `usage_unavailable` 落账；重试 requests 是否如实。
8. fake CLI 进程测试是否覆盖超时、畸形 JSON、非零退出、unknown event、取消、并发排队、队满、schema 拒绝，以及三槽各自红绿、双 ack、豁免链。
9. 是否越界实现 T18b/T18-ui，或改动 console；是否存在合同分叉、数据丢失、安全退化、无法编译/测试的问题。

按 A（安全/合同/数据丢失/会错误武装，必修）、B（重要）、C（建议）分级，每项给
`file:line`、具体反例和最小修法。明确区分代码缺陷与只读/网络沙箱导致的测试限制。
最终输出 Go/No-Go、A/B/C 数量、OPEN QUESTION、逐项裁决与实际验证边界。
