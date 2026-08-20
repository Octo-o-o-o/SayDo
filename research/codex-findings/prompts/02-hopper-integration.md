你是一名集成架构师。请评估 VoiceLoop(语音前脑)与 Hopper(执行后端)对接的**真实技术可行性**,产出一个可落地的最小对接方案与风险清单。请实际读 Hopper 源码,如可联网则补充相关实践。

## 背景
VoiceLoop 定位为"语音前脑":实时语音采访用户→沉淀分层记忆→AI 自判就绪→给决策包→拍板后需要把任务交给一个执行后端去跑、并消费其事件做**语音回叫**。据调研,最自然的执行后端是本地项目 **Hopper**(`~/WorkSpace/Hopper/`,TS/Node、MIT、测试全绿):AI 代码交付验收流水线 + 预算中枢,drop→triage→compiler→调度→worktree→runner→四道验收闸门→review→merge,文件系统为真相 + 事件溯源。Hopper 正在做"统一自动化平台"program(M3a 领域模型 schema 已冻结,含 DecisionRequest 审批 / NotificationIntent 通知 / Command / ExecutorHandle / UsageEvent)。

## 必读
- Hopper:`~/WorkSpace/Hopper/README.md`、`docs/00-overview.md`、`docs/M3A-DOMAIN-MODEL-DESIGN-2026-07-21.md`、`src/schemas/`、`src/runners/`、`src/core/events/`、`src/usage/`、`src/worktree/`、`src/console/`、`src/daemon/`(挑核心读)
- VoiceLoop:`~/WorkSpace/voice-coding/local-projects-borrowing-assessment.md`(§4 落地映射)、`business-flows.md`(§11)、`voice-coding-framework.Cursor2.md`(§4.4/§4.6/§4.7/§4.8/§4.19)

## 你的评估问题(逐条回答,给源码证据:文件:行)
1. **任务卡 drop 接口**:VoiceLoop 的"决策包/任务卡"要变成 Hopper 能消费的输入,具体走哪个入口(Markdown drop?CLI?schema)?字段能不能对上?缺什么?
2. **事件消费 → 语音回叫**:Hopper 的 events.jsonl / NotificationIntent 能否支撑 VoiceLoop"完成/卡住/需审批时语音回叫"?消费协议(轮询/watch/webhook)怎么接?延迟如何?
3. **审批对接**:Hopper M3a DecisionRequest 能否承接 VoiceLoop 的"语音审批(L2)+ 屏幕/复述(L3)"?"所闻即所签"(语音批准绑 payload digest)在 Hopper 现有模型下怎么实现?
4. **适配器缺口**:VoiceLoop 需要"运行中 steer / 流式事件",而 Hopper runner 是"单发+终报"。要改 Hopper 什么?改动量多大?还是 VoiceLoop 侧适配?
5. **成熟度 gap**:Hopper 平台化(执行器 M3d)未实现,自估 10-12 周。哪些能力**今天就能对接**(现状 task 粒度),哪些必须等?给一个"现在就能拼出的最小闭环"。
6. **最小对接方案**:给出一个具体的 PoC 步骤(语音产一张任务卡→drop 进 Hopper→跑通→消费完成事件→一次语音回叫),标出每步用 Hopper 哪个现有接口、哪里要写胶水。

## 输出要求
- 完整报告写入 `~/WorkSpace/voice-coding/codex-findings/02-hopper-integration.md`(结构化:Hopper 现有接口清单 / 对接可行性逐条 / 缺口与改动量 / 最小 PoC 步骤 / 风险)。
- 结论必须有源码证据(文件路径:行号);区分事实与推断。
- stdout 回一句话:报告已写入 + 最小闭环今天能否拼出的判断。
