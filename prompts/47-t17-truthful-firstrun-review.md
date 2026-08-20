# T17 全面如实化、初始化流程与首跑引导对抗审

你是独立对抗评审员。只读检查当前仓库未提交工作树，不修改文件，不启动子代理，不接受实现者自述作为证据。基线为 `2599f8f`，任务分支应为 `fix/t17-truthful-firstrun`。

本轮必须落实的现势事实是：四个推理槽当前真实供给全部为 API；dialog CLI 必须阻断；thinking/cheap 的存量 CLI 配置只允许回落全局 dialog API 并告警；evaluator CLI 不武装；CLI 订阅推理接入仅作后续预告。请对 `git diff 2599f8f --`、相关测试和 canonical 逐项核验，尤其攻击以下边界：

1. 非法活动配置能否让 daemon 真正保持 recovery-only，而不是在后续初始化、对话或 Tier 1 路径崩溃或漏 dispatch；probe/setup 写口是否仍可自救，新非法 pending 是否 422。
2. dialog/thinking/cheap/evaluator 的 validator、resolver、probe `effective/reason/fallbackTo` 是否同源；named endpoint `family` 是否优先；evaluator CLI、异族 API、同族未确认、同族已确认四行是否一致；项目 override 是否硬拒全局 ack 绕过。
3. global thinking 与 project thinking override 是否都进入真实 BrainTools 消费链，回落是否明确告警；cheap 回落是否不再静默。
4. setup 自检是否真实覆盖 dialog tool-call 往返、cheap 起草器 JSON schema、evaluator 结构化输出及 observed model、thinking 的真实 resolver，而且每槽失败能独立标红。
5. first-run once marker、Focus/session/audit legacy 判定、用户消息抢先竞态、固定开场白、transcript/history `origin=onboarding`、HTTP 端点与 console 正常消息渲染是否闭合；寻找重复投递、永不投递、先写 marker 后丢消息、会话建立顺序等问题。
6. console 是否只有唯一全 API 一键卡且四模型可编辑；无 key 说明和表单是否保留；CLI 画像是否如实、advanced CLI 是否禁用且存量只读；probe 新合同、四张案例卡不自动发送、完成流 `/chat-new` 是否真实接线。
7. `docs/07`、`docs/09`、`docs/11`、templates 与代码是否仍有把 CLI 推理写成当前可用的矛盾；旧误导文案是否清尽。
8. 测试是否覆盖用户验收矩阵，而非只测辅助纯函数；指出任何假绿、未消费配置、合同分叉、安全或数据丢失风险。

输出中文 Markdown 报告，开头给 Go/Conditional Go/No-Go。发现按 A（安全、合同、数据丢失或验收硬阻断）、B（应修正确性/一致性）、C（改进）分级；每条必须给精确 `file:line`、触发条件、实际后果和最小修法。无 A/B 时也要明确写零发现，并列出你实际核过的命令与关键输出。不要复述任务，不要编造未运行的测试。
