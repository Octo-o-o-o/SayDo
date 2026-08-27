# Prompt 205 — capture-device-ingress 方案对抗评审(Codex)

你在 SayDo 仓库做一次零上下文的对抗性设计评审。评审对象:`docs/plan/2026-08-26-capture-device-ingress.fable.md`——一份"口袋硬件设备(ESP32-C3)经 WS 向本机 daemon 推 PCM 音频、走现有 ASR→Brain 链路"的设计方案。该方案已经过两轮内部评审回修;你的任务是独立找出仍然存在的问题,不要预设它是对的。

先通读方案全文,再对照仓内真实代码逐条验证。至少读:`packages/daemon/src/voice/hub.ts`、`packages/daemon/src/net/identity.ts`、`packages/daemon/src/net/capToken.ts`、`packages/daemon/src/index.ts`(身份校验、/dev、/api、onAsrFinal 接线段)、`pipeline/src/saydo_pipeline/hub_client.py`、`packages/daemon/src/live/dialog.ts`(onAsrFinal 主链与确认词表环)、`packages/daemon/src/live/voiceSessions.ts`、`packages/contracts/src/types/pipeline.ts`、`packages/console/src/voice/useVoiceChannel.ts`、`docs/09-data-contracts.md` §10。

按以下维度找问题,每条发现必须落到具体机制与 file:line,不接受泛泛之谈:

1. 事实错误:方案中的 file:line 引用、"现网行为是 X"断言、契约形状、失败码,与真实代码不符的地方。
2. 安全绕过:三点 scope 判定(§3.2)、准入矩阵(§3.3)、origin 盖章/剥离(§2.4)是否存在方案未覆盖的绕过路径;丢失 capture 令牌后攻击者能做到的事是否超出 §3.4 声称的范围。
3. 并发与状态机:store-and-forward 的 flush 判定 a-g(§2.2)、三影子值维护规则(§2.5)、captureInFlight 版本偏斜后备(§2.4)在哪些时序交错下失效或死锁;原子转发断言(§2.2)在 ws 背压/分帧下是否成立。
4. 会话与对话环:每轮只读解析(§2.3)、onAsrFinal 入口分流(§2.6)与 dialog.ts 真实控制流的相互作用;是否有方案没想到的副作用(idle 定时器、speechPending、控制轮队列、readinessAssemble、hold 旗、记忆提名)。
5. 合同一致性:与 docs/09 §10 的 B8、轮次守恒、单 pipeline owner、unheard 纪律是否冲突;additive origin 字段对现有消费方是否有破坏面。
6. 实施可行性:PR1 改动清单(§6)是否漏文件、漏接线点、漏调用方;验收门禁是否可判定;测试计划(§7)是否漏关键用例。
7. 过度设计:方案里有没有可以砍掉而不损失安全性/正确性的机制(明确指出砍哪条、为什么安全)。

输出(简体中文,零 emoji):
- 按严重度 A(必修)/B(应修)/C(可选)列出全部发现,每条给「问题 → 依据(file:line) → 建议修法」;
- 单独一节回答:方案是否可进入实施(可 / 需回修后可 / 不可),以及你认为最大的单一风险;
- 事实核验覆盖说明:你实际读过并核对的文件清单。

不要修改任何文件。你的最终回复就是评审报告全文。
