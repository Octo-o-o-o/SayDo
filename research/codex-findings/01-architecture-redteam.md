# VoiceLoop 架构红队评审与 2026 补充调研

> 评审日期：2026-07-22（Asia/Shanghai）
> 评审对象：`voice-coding-framework.Cursor2.md` v1.12、`business-flows.md`（含 v1.13 §11）、`local-projects-borrowing-assessment.md`、`competitive-scan-2026-07.md`，以及本地 Hopper `main@c4c29c62d03c29816b74d0889efa7db7ceb2df7f`。
> 结论口径：这是一次对抗性 review，不把“方向合理”当作“产品可交付”，也不把 schema、Demo 或单次成功当作运行时能力、可靠性或产品市场验证。
> 联网状态：已联网。OpenAI 相关事实优先核对官方文档；产品事实优先官方公告/官方仓库；论文事实链接原论文。检索截止本报告日期。

## 0. 执行结论

**总判定：战略方向 Conditional Go，按当前方案直接做完整产品 No-Go。** 可以立即做一个“语音访谈 → 版本化决策包 → durable dispatch → Hopper 单任务 → 回叫/审阅”的窄闭环；在下列 P0 门禁完成前，不应承诺“AI 自己判断成熟后开工”“跨会话记忆越用越懂”“隔夜交活”三项产品承诺。

最重要的三个发现：

1. **Hopper 是 schema-ready，不是 VoiceLoop 所需的 runtime-ready；所谓“薄缝合层”实际是一套控制平面。** `business-flows.md §11` 的战略切分是对的，但把尚未实现的流式事件、运行中 steer/answer、durable command/decision 消费、workflow executor、Notification transport 当成可直接复用，形成了最现实的交付断层。
2. **让同一个 Brain 产事实、判缺口、做 Demo、再自评“够不够完美实施”，是核心致命假设。** 错误高度相关，Demo 又会制造确认偏差；一旦 readiness 假阳性，用户一句轻量“好”就把误解放大为长时副作用。
3. **L0-L3 持久记忆首先是跨会话安全边界，其次才是体验壁垒。** 仓库、网页、上传资料、会议参与者都能污染候选记忆；当前“自动提炼 + 静默沉淀”会把一次 prompt injection 固化成未来项目和行动依据。2026 年多项 memory-poisoning 研究直接击中这个设计。

建议把产品承诺改成：**“VoiceLoop 能较早发现自己还不该开工；在可审计证据、版本化授权和可恢复执行合同成立后，才建议开工。”** 这比“AI 知道何时已经完美准备好”更可测、更可信，也更可能成为护城河。

### 0.1 事实标签

- **【已验证事实·本地】**：本次实际读取到的方案、源码、Git 或测试输出。
- **【已验证事实·联网】**：本次从官方页面、官方仓库或原论文核实的信息。
- **【推断】**：由事实推导的架构/产品判断，不冒充实测数据。
- **【待验证】**：目前没有数据，必须用实验、日志或用户研究回答。

### 0.2 本地核验基线

- **【已验证事实·本地】** Hopper 当前分支为 `main`，HEAD 为 `c4c29c62d03c29816b74d0889efa7db7ceb2df7f`；工作区已有用户改动 `M docs/IMPL-LOG-PLATFORM-2026-07-20.md`，本评审未修改 Hopper。
- **【已验证事实·本地】** 定向命令 `npx vitest run test/unit/platform-schemas.test.ts` 实际输出：`1 passed`、`25 passed (25)`。这只证明 M3a platform schema 的定向测试通过，不证明 M3b/M3c/M3d 运行时存在。
- **【已验证事实·本地】** Hopper 最新 commit message 自述全量门禁为 unit 1076 / golden 48 / e2e 198；本会话没有重跑这些全量门禁，因此报告不把它们写成“本次实测”。

---

## 1. 确认成立的判断

### 1.1 “短命语音会话、长命后台任务”是正确的生命周期切分

- **【已验证事实·本地】** 主方案 §4.1 明确把语音会话与开发任务生命周期解耦，并在空闲后挂起会话（`voice-coding-framework.Cursor2.md:202-218`）。这避免为等待 agent 持续支付音频会话成本，也使断线不等于任务死亡。
- **【已验证事实·联网】** OpenAI Realtime 按每次 Response 的输入/输出 token 计费，连接或带宽本身当前不收费，VAD 会过滤空输入；因此“静默连接本身持续烧音频 token”的说法需要修正，但“不要让长时执行绑住实时会话”的架构结论仍成立。[OpenAI Realtime cost guide](https://developers.openai.com/api/docs/guides/realtime-costs#per-response-costs)
- **【推断】** VoiceLoop 的 session 应是可丢弃 projection，durable conversation/intention ledger 才是事实源；重建失败只能影响交互，不能改变任务状态。

### 1.2 Context Pack 与持久知识库分离是必要设计

- **【已验证事实·本地】** §4.19 把 L0-L2 持久知识与 L3/Context Pack 分开，并提出生长、提炼、失效、索引、人可编辑闭环（`voice-coding-framework.Cursor2.md:528-577`）。方向正确。
- **【已验证事实·联网】** Realtime 每个 Response 会重新带入整个 conversation，后续 turn 越来越贵；超窗时从最老消息开始截断，且频繁截断会破坏 prompt cache。官方建议限制 post-instructions window、调整 `retention_ratio`、删除旧 item 或以摘要替换。[OpenAI Realtime cost/truncation guide](https://developers.openai.com/api/docs/guides/realtime-costs#truncation)
- **【推断】** 因而 Context Pack 不是简单“检索几段文本”，而是有版本、预算、来源、冲突、敏感度与 taint 的确定性编译器；这是前脑的核心后端，不是附属功能。

### 1.3 采访式澄清与“会问再做”的方向有实证支持

- **【已验证事实·联网】** 2026 年 OntoAgent 论文指出只靠自由聊天会漏掉隐性需求并产生冗余提问；结构化 ontology + concern selection 相对基线提升 IRE 33%、问题效率指标 21%。[From Chat to Interview](https://arxiv.org/abs/2605.05828)
- **【已验证事实·联网】** Ask or Assume 把“欠规格检测”与执行解耦，在其 SWE-bench 变体上从 61.20% 提升到 69.40%，且简单任务少问、复杂任务多问。[Ask or Assume?](https://arxiv.org/abs/2603.26233)
- **【推断】** 这支持 VoiceLoop 的问题意识，却反对“Realtime Brain 每轮自由自省”作为唯一实现；需要结构化 coverage map 和独立 readiness evaluator。

### 1.4 worktree、独立验证、熔断、失败可见性都是真正的底线

- **【已验证事实·本地】** §4.7 禁止从口语自由拼 verify 命令，要求只从项目登记模板选择；§4.8 提出 worktree、墙钟/回合/成本三熔断、启动对账和 rebase 后重验（`voice-coding-framework.Cursor2.md:365-394`）。这些不是“高级能力”，而是无人值守最低安全线。
- **【已验证事实·联网】** Anthropic Auto mode 仍明确表示风险分类器可能放过危险动作或误挡正常动作，并继续建议隔离运行。[Claude Code Auto mode](https://claude.com/blog/auto-mode)
- **【推断】** VoiceLoop 不应以“模型会谨慎”替代 OS/container、credential scoping、network egress 和机械 gate；其差异化只能在这些边界之上成立。

### 1.5 “VoiceLoop 前脑 + Hopper 后端”的战略方向优于再造整套 runner

- **【已验证事实·本地】** Hopper 已有 task 级 runners、worktree、事件、usage、恢复与交付 gate；VoiceLoop 重写这些会制造双份真相源。`local-projects-borrowing-assessment.md §4-§5` 的“复用 Hopper”方向成立。
- **【推断】** 但复用的正确形态是“两个有清晰所有权的 bounded context + durable protocol”，不是共用 SQLite/JSONL 或让 VoiceLoop 直接改 Hopper 内部状态。

### 1.6 语音本身不构成壁垒，review 才是长任务的瓶颈

- **【已验证事实·联网】** Paseo 已覆盖本地 daemon、多 provider、语音模式、手机/桌面/CLI、worktree、流式输出、follow-up、diff 和 plan card；其 2026-05-26 release 为 v0.1.83。[Paseo repository](https://github.com/getpaseo/paseo) / [Paseo changelog](https://github.com/getpaseo/paseo/blob/main/CHANGELOG.md)
- **【已验证事实·联网】** OpenAI 2026-05 已提供手机连接本机/远程 Codex、查看实时状态、批准、steer、看截图/终端/测试/diff；Claude 也有 background agent view 与 2026-07 的 Cowork web/mobile 后台执行和手机决策。[Codex from anywhere](https://openai.com/index/work-with-codex-from-anywhere/) / [Claude agent view](https://claude.com/blog/agent-view-in-claude-code) / [Claude Cowork web/mobile](https://claude.com/blog/cowork-web-mobile)
- **【推断】** “移动端沟通 + 固定端执行 + 做完通知”已经商品化。VoiceLoop 必须把 review/acceptance 视为核心产品面，而不是 `open_on_screen` 的辅助跳转。

---

## 2. 证伪或存疑的主张

### 2.1 “Hopper 下游基本直用、只需薄缝合”——部分证伪

- **【已验证事实·本地】** `business-flows.md §11` 把 Hopper 描述为可提供 runners、事件真相源、恢复、DecisionRequest、NotificationIntent，并称 VoiceLoop 只需 drop/consume/callback（`business-flows.md:236-275`）。
- **【已验证事实·本地】** 当前 `RunnerAdapter` 只有 `buildCommand()` 与 `parseResult()`，没有 `events / steer / interrupt / resume / answer`（`Hopper/src/runners/types.ts:38-48`）。Claude adapter 用 `-p --output-format json --json-schema` 一次性返回（`claude-adapter.ts:47-88`）；Codex adapter 用 `codex exec --json ... -o` 并只解析终报（`codex-adapter.ts:46-91`）。
- **【已验证事实·本地】** capability manifest 虽声明 Claude/Codex `resume_session: true`（`capability.ts:39-87`），adapter 契约与 executor 并未暴露 resume；这是“能力声明”与“可消费运行时 API”的落差。
- **【已验证事实·本地】** `DecisionRequest`、`Command`、`NotificationIntent` 目前只出现在 schema、event schema、导出 JSON、测试和文档中；没有业务运行时 consumer。`SCHEMA-FREEZE-M3A.md:43-54` 又明确把 command 执行点、记账、workflow loader、projection 等义务分配给未来 M3b/M3c/M3d。
- **结论：** 前后端边界正确，成熟度判断错误。缝合层至少包含 durable outbox、命令服务、事件订阅/游标、审批收据、幂等/对账、runtime adapter、通知 transport、兼容/迁移和端到端 observability；这不是薄胶水。

### 2.2 “S2S 比级联贵一个数量级”——当前价格下不成立为普遍结论

- **【已验证事实·联网】** `gpt-realtime-2.1` 音频 input/cached/output 为 $32/$0.40/$64 每百万 token；mini 为 $10/$0.30/$20。用户音频约 600 token/分钟，助手音频约 1,200 token/分钟。[OpenAI pricing](https://developers.openai.com/api/docs/pricing#audio-tokens) / [Realtime cost guide](https://developers.openai.com/api/docs/guides/realtime-costs#per-response-costs)
- **【已验证事实·联网】** 级联中的 `gpt-4o-mini-transcribe` 估算 $0.003/分钟；`gpt-4o-mini-tts` 文本 input $0.60/M、音频 output $12/M。[OpenAI pricing](https://developers.openai.com/api/docs/pricing#transcription-models) / [GPT-4o mini TTS](https://developers.openai.com/api/docs/models/gpt-4o-mini-tts)
- **【推断】** full Realtime 与低价级联的纯语音 I/O 在一个代表性 mix 下约差 5-6 倍，未必 10 倍；mini Realtime 可能接近“ASR+TTS+文本 Brain”的总价。真实差距取决于说话比例、上下文 cache、文本模型、工具调用和重试，必须 benchmark，不能写死。

### 2.3 “Brain 无状态”——实现层面不准确

- **【已验证事实·本地】** `business-flows.md:52` 称 Brain 无状态，但决策质量依赖 L0-L3 选择、摘要、检索、模型版本、prompt、readiness history、未决问题与 artifact 版本。
- **【推断】** 模型进程可以无状态；**Brain 服务不无状态**。Context compiler 与 intent ledger 是其 durable state machine。把它称为无状态会让恢复、审计和 schema migration 被低估。

### 2.4 “每轮自省是否够完美实施”——不可测且有害

- **【已验证事实·本地】** §4.20 要求同一 Brain 每轮判断知识充分度与需求明确度，措辞是“够不够完美实施”（`voice-coding-framework.Cursor2.md:579-600`）。
- **【已验证事实·联网】** 长对话研究观察到 instruction drift、intent confusion、contextual overwriting；Ask or Assume 的收益恰来自把欠规格检测与执行解耦。[Conversational Reliability](https://arxiv.org/abs/2603.01423) / [Ask or Assume?](https://arxiv.org/abs/2603.26233)
- **结论：** “完美”没有 ground truth，且 self-evaluation 与生成错误相关。目标应改成“是否达到该任务类别的可执行证据门槛，剩余未知是否在授权风险预算内”。

### 2.5 “先把项目研究透再进入实质问答”——作为统一默认存疑

- **【已验证事实·本地】** §4.19 把首次奠基定为阻塞式“先备后答”，允许为了积累未来知识暂停当前回答（`voice-coding-framework.Cursor2.md:543-550`）。
- **【推断】** 对大型陌生 repo 有价值；对一句能完成的小修、故障响应、专家用户、空仓新项目则会制造 activation cliff，并可能先研究错问题。应是 risk-based progressive grounding，不是全局 hard gate。
- **【待验证】** 首次有价值语音反馈的 P50/P95、放弃率、奠基复用率、奠基后返工下降量。目前方案没有数据支持“宁可让用户等”能提高留存。

### 2.6 “隔夜交活”与 45 分钟墙钟默认相互矛盾

- **【已验证事实·本地】** §4.8 每任务默认墙钟 45 分钟（`voice-coding-framework.Cursor2.md:384-392`）；§4.21 又把“明早交活/隔夜异步交活”作为核心落点（`voice-coding-framework.Cursor2.md:602-614`）。
- **【推断】** 单 run 45 分钟不可能支撑 8 小时工作，除非上层 workflow 能可靠切 step、重派、恢复、保留预算与验收；而 Hopper 的该 workflow runtime 正是 M3d 未实现部分。当前承诺与能力闭环不一致。

### 2.7 “Codex 运行中不能 steer”——2026 现状下已过时

- **【已验证事实·本地】** 主方案 §4.9 把 Codex steer 一律降级为 kill-and-resume（`voice-coding-framework.Cursor2.md:396-402`）。
- **【已验证事实·联网】** 当前 Codex app-server 官方协议支持 `thread/start/resume/fork`、流事件、`turn/steer`、`turn/interrupt`；`turn/steer` 还要求 `expectedTurnId`，正好可用于防 stale steer。[Codex app-server](https://learn.chatgpt.com/docs/app-server#lifecycle-overview)
- **结论：** 产品能力假设应更新；但 Hopper 目前使用 `codex exec` 一次性 adapter，所以“官方可用”不等于“本地已接入”。

### 2.8 “Codex realtime 是稳定官方产品面”——只能算方向证据

- **【已验证事实·联网】** 当前 OpenAI `openai/codex` app-server README 有 `thread/realtime/*` 事件，但逐项标为 experimental，原始 item schema 也注明不稳定。[Codex app-server README](https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md#thread-realtime-events-experimental)
- **结论：** 可证明大厂正在把语音和 agent thread 融合，不能作为 VoiceLoop P0 的稳定依赖或壁垒证明。应把 voice provider 与 agent runtime 分开适配并做 contract tests。

### 2.9 “复述短语能对冲 L3 风险”——安全模型内部矛盾

- **【已验证事实·本地】** §4.7 表格说 L3 必须屏幕确认、语音不可批（`voice-coding-framework.Cursor2.md:365-375`）；后文又说屏幕确认之外复述短语可放行，并称其对冲弱认证/误听（`voice-coding-framework.Cursor2.md:380-382`）。
- **【推断】** 同一麦克风、同一 ASR、同一 speaker context 的复述不提供独立因子；录音、旁人、合成语音和错误指代仍在。PIN 口述还会把 secret 暴露给音频链和转写。L3 应由已认证屏幕/生物识别/OS confirmation 批准，语音只能导航到审批卡。

---

## 3. Q1：致命假设（按风险排序）

| 排名 | 隐藏假设 | 为什么会垮 | 当前证据 | 最小验证与否决线 |
|---:|---|---|---|---|
| 1 | **同一个 Brain 能可靠知道“何时已足够开工”** | 假阳性把误解变成长时副作用；假阴性把产品变成无尽采访。生成、总结、Demo、自评使用同一上下文，错误相关而非相互校验 | §4.20 同模型每轮自省；Ask or Assume 显示解耦 detector 更好 | 建 200+ 条按任务类型分层的 underspecified/contradictory corpus；独立 evaluator + 人类标注。P0 要求高风险任务 readiness 假阳性 <1%，普通任务 <5%，并报告 ECE/Brier、不是只看准确率；达不到则禁止自主 propose-start，只显示 gaps |
| 2 | **开放对话中的“好/可以/就这样”可稳定映射为实施意图和权限** | 用户可能在脑暴、举例、讽刺、回答上一问、同意 Demo 方向而非 dispatch；多人语音还涉及谁有权批准 | 方案把轻量口头确认直接接 `confirm_and_dispatch`（§4.20；`business-flows.md:68-92`） | 采集真实多轮/打断/多说话人 replay，测试 proposal-version 绑定。任何未绑定 `package_digest + revision + action=dispatch` 的“是”都不得开工；错派发目标为 0 |
| 3 | **持久记忆净增益大于污染、陈旧和跨域泄漏** | 一次恶意网页/仓库/会议内容可进入 L1/L0，跨未来会话反复影响工具和行动，破坏产品核心价值 | §4.19 当前是自动提炼、静默沉淀；2026 memory-poisoning 论文证明 aggressive write/retrieve 更易受攻击 | 对四种写入渠道做 memory red-team；污染内容进入 trusted L0/L1 的比例必须为 0；高影响记忆必须有 provenance/quote/digest/reviewer/expiry；删除后任何 Pack 与执行不得再召回 |
| 4 | **Hopper 已具备 VoiceLoop 需要的异步控制面** | 没有 runtime events/steer/decision consumer/notification transport 就无法完成“挂断继续、卡住回叫、回答后续跑” | 本地 runner 接口只有 build/parse；M3a freeze 把 runtime 义务留给 M3b-d | 先做 contract spike：断开 UI 后 dispatch、重启两端、重复投递、stale approval、steer、cancel、blocked 回答、通知 ACK 全链。任一动作依赖共享内存/轮询脆弱文件即不通过 |
| 5 | **长时 agent 可以在无人值守下达到用户可接受可靠性** | “执行成功”还要乘上环境、恢复、验证、交付、通知成功率；复杂任务成功时也可能规避难点或过度声称完成 | METR 明确 50% time horizon 不是可委派边界；可靠性关键任务可能需 98%+ | 按 task archetype 做 100 次 overnight shadow run，独立验收。报告 deadline hit、verified success、false-complete、human repair minutes、cost p95；在 verified success <90% 前不得使用无条件“隔夜交活”文案 |
| 6 | **人能以低认知成本审掉 agent 的错误** | 决策包降低了前置表达成本，却把复杂性后移到 diff、证据、行为和回归审查；语音无法承载细节 | 竞品都强化 diff/test/screenshot/review；方案只把细节推屏幕 | 做真实交付审阅实验：用户能否在 5 分钟内发现植入的行为偏差/漏测/副作用。若高严重度检出率 <95%，必须增加独立 verifier、risk-focused review cards 和逐 acceptance evidence |
| 7 | **项目奠基能在可接受时间/成本内得到足够准确的知识** | 大 monorepo、多语言、generated/vendor、dirty worktree、远程服务、隐含业务知识都无法靠一次扫库“研究透” | §4.19 用“足够/研究透”但无预算、freshness、coverage 或 uncertainty schema | 20 个真实规模 repo 试验：TTFV、foundation cost、事实准确率、遗漏约束、增量失效；P95 首次可交互 >10 秒应 progressive，>60 秒仍阻塞则该默认失败 |
| 8 | **本地设备适合可靠“隔夜”运行** | 合盖/睡眠、断电、网络、quota、磁盘、VPN、钥匙串、CLI 登录过期都会中断；`caffeinate` 不是跨设备 HA | §4.8 仅提电源断言；§4.22 承诺移动沟通/固定执行 | dispatch 前 delivery preflight：电源/睡眠/网络/磁盘/quota/auth/secrets/clean repo/callback；注入掉网、重启、token 过期。没有 always-on runner 时文案只能叫“离席后台”，不能叫“关机/合盖后继续” |
| 9 | **语音优于指令适用于足够大的核心用户群** | 小任务、精确命令、专家快捷流、嘈杂/共享/保密场所、听说障碍都可能更差；强迫对话会增加时间与社会摩擦 | 方向性竞品证明语音可用，不证明 voice-first PMF | A/B 三车道：Quick / Guided / Explore；测 time-to-dispatch、correction、放弃、return rate。若多数任务主动切 Quick，定位应改为 conversation-capable 而非 conversation-first |
| 10 | **单位经济可由 $20-50/月语音预算覆盖** | 语音只是小头；foundation/research、Brain、Demo、执行 agent、验证、失败重试、存储/推送才是项目总成本 | 现方案只给粗语音估计，未建 project/run ledger | 建全链成本归因；开工包展示 expected/p95/max cost 与剩余额度。目标毛利下 P95 成本越界或无法预估时，必须降模型/缩 scope/转人工确认 |

### 3.1 最危险的相关错误链

**【推断】** 当前设计不是多个独立保护层，而可能是同一个模型错误的连续放大器：

`错误奠基/被投毒 → Context Pack 召回 → Brain 按错误事实采访 → 同一 Brain 判定 ready → 同一 Brain 生成看似合理的 Demo → 用户因具体预览产生自动化偏信 → 轻量“开工” → agent 在无人值守时实施`

这条链中，Demo 和轻量确认不是天然护栏；如果它们依赖同一错误事实，反而会提高错误方案的说服力。真正独立的保护层必须换信息源或换判定机制：机械事实检查、独立模型/规则 evaluator、版本化 acceptance contract、OS sandbox、独立 test/verifier、用户在高风险点明确签署。

---

## 4. Q2：可行性硬伤

### 4.1 语音会话经济学：语音账本能算，产品账本还没有

#### 4.1.1 按 2026-07-22 公开价格重算

**【已验证事实·联网】** Realtime 用户音频约 1 token/100ms，即 600 token/分钟；助手音频约 1 token/50ms，即 1,200 token/分钟。按当前标准价：

| 引擎 | 用户说 1 分钟 | AI 说 1 分钟 | 15 分钟用户 + 15 分钟 AI / 日 | 22 工作日 / 月 |
|---|---:|---:|---:|---:|
| `gpt-realtime-2.1` | 600 × $32/M = **$0.0192** | 1,200 × $64/M = **$0.0768** | **$1.44** | **$31.68** |
| `gpt-realtime-2.1-mini` | 600 × $10/M = **$0.006** | 1,200 × $20/M = **$0.024** | **$0.45** | **$9.90** |

来源：[OpenAI pricing](https://developers.openai.com/api/docs/pricing#audio-tokens)、[Realtime token accounting](https://developers.openai.com/api/docs/guides/realtime-costs#per-response-costs)。

注意：

- **【已验证事实·联网】** 以上只算每分钟新增音频。每次 Response 还会把完整 conversation 作为 input；后续 turn 更贵，尽管稳定 prefix 可能命中 cached input。截断会破坏 cache，工具/文本 token 另计。
- **【已验证事实·联网】** 官方当前说连接/带宽不收费，VAD 会过滤空输入。因此主方案 §4.1“静默期麦克风音频仍按音频 token 计费”不是普遍事实；只有被客户端作为 conversation input 提交的音频才计入。45 秒挂起仍有隐私、功耗、占麦和误触发价值，但不能用“连接本身烧钱”论证。
- **【推断】** 如果每天是总共 60 分钟、说话比例仍为 1:1，上表月成本约翻倍：full **$63.36**、mini **$19.80**，仍未含 Brain/foundation/agent。

**级联对照：**

- **【已验证事实·联网】** `gpt-4o-mini-transcribe` 约 $0.003/输入分钟；15 分钟用户输入 = $0.045/日。
- **【已验证事实·联网】** `gpt-4o-mini-tts` 当前文本 input $0.60/M、音频 output $12/M。模型页没有把 output audio token 明确换算成每分钟，不能把 token 价直接伪装成精确分钟价。
- **【推断·粗估】** 若仅为量级比较，假设 TTS 同样约 1,200 audio token/分钟，则 15 分钟输出约 $0.216/日，语音 I/O 合计约 $0.261/日、$5.74/22 日；**此数不是供应商承诺**，上线前必须用实际 `usage` 校准。还需加文本 Brain input/output、上下文、工具调用和失败重试。

#### 4.1.2 当前漏算的九本账

产品真实成本至少是：

```text
C_project = C_new_audio + C_history/cache_miss + C_brain
          + C_foundation + C_research + C_artifact/demo
          + C_execution_agent + C_independent_verify + C_retry/repair
          + C_storage/index/notification
```

主方案的月度语音估算没有回答：

1. 首次 foundation 扫多少文件、是否用昂贵模型、何时停止；
2. 每轮 `assess_readiness` 是否多一次模型调用；
3. 网络调研、Demo/截图/浏览器操作的工具和模型费；
4. Hopper runner 走订阅额度还是 API，如何统一折算；
5. independent verifier 是否再跑一个模型；
6. failed/timeout/retry 的尾部成本；
7. Context Pack cache miss 与 compaction 的成本；
8. 多项目/多任务并发的悲观预算预留；
9. “用户一句继续”是否会重开一个不受原预算约束的新 run。

**建议：** 预算对象不是“语音会话”，而是 `ProjectBudgetEnvelope → DecisionPackage estimate → DispatchBudget → RunActual → RepairActual`。决策包显示 expected / p95 / hard max，Hopper 只接受带预算 envelope 的 dispatch；85% 预警、100% fail-closed，重试必须消费同一上限而不是刷新额度。

### 4.2 上下文重建：当前有材料清单，没有可重复的编译语义

§4.1 列了 active tasks、滚动摘要、最后 N 轮、触发事件、术语表、预研摘要（`voice-coding-framework.Cursor2.md:220-238`），但这些还不足以确定“重建后 Brain 理解同一件事”。缺少：

1. **优先级与冲突规则**：用户最新明确修订、已批准计划、L1 旧决策、代码现状、第三方资料谁覆盖谁；
2. **source binding**：每个事实是否有来源、原文 quote、采集时间、commit/blob digest、说话人、可信级别；
3. **否定与撤销**：用户说“不是 X”不能在摘要后重新变成 X；已撤销要求不得因旧 transcript 检索复活；
4. **token budget**：各 tier 预算和裁剪策略；不能让 L0 profile 或旧 L2 抢掉本轮 acceptance 的空间；
5. **freshness**：`git diff` 只覆盖工作区差异，不覆盖外部 API、数据库、远程分支、依赖和业务政策变化；
6. **compaction verification**：摘要是否保留 MUST/NOT、数字、单位、责任人、未决问题和授权边界；
7. **determinism/audit**：同一 snapshot 能否重编出相同 Pack；运行结果能否追溯当时看到的准确输入；
8. **taint propagation**：来自网页/issue/repo comment 的不可信文本不得升级为 system rule 或用户偏好；
9. **schema migration**：L0-L3 格式和 embedding/model 更新后如何重建、回滚、备份和恢复；
10. **cross-project isolation**：L0 哪些偏好可跨项目，哪些客户/安全/许可证事实绝不能跨域。

建议将 Context Pack 实现为确定性 `ContextCompiler`，输入是不可变 refs，输出至少包含：

```text
ContextSnapshot {
  snapshot_id, schema_version, compiler_version, model_profile,
  project_revision, conversation_revision, approved_plan_digest,
  facts[{claim, source_ref, quote_ref, observed_at, trust, confidence, valid_from, valid_to, taint}],
  constraints[{id, text, source_ref, priority, status}],
  unresolved[{id, question, blocker_class}],
  exclusions[{source_ref, reason}],
  token_budget_by_tier, pack_digest
}
```

**【推断】** transcript 应是审计证据，不是直接可执行状态；执行状态应来自版本化 intent/constraint ledger。每次恢复先展示“一句话目标 + 关键约束 + 仍未解决”，用户可快速纠正，纠正产生新 revision 而非原地覆写历史。

### 4.3 失控防护：风险级别按“动作例子”分，未按 effect × data × identity 分

现有 L0-L3 把“push feature branch”视为可逆 L2，把“发消息/部署/花钱”视为 L3。硬伤是：同一个动词的风险取决于对象和数据。

- 安装一个可信 lockfile 内依赖，与执行未知 package 的 postinstall 不是同风险；
- push 私有 feature branch 可能触发 CI、部署 preview、泄露 secret 或通知客户；
- “读代码”若读取 `.env`、客户数据、SSH key 不是普通 L0；
- 一条看似可逆的 API 写可能触发不可逆的外部工作流；
- worktree 隔离文件改动，不隔离网络、云凭据、包管理器、keychain、Docker socket 和本机其他 repo；
- “本地 commit”可能触发 hook；verify 白名单脚本本身也可能被不可信 branch 修改。

应把 policy key 改成：

```text
risk = f(effect_type, target_scope, data_classification,
         reversibility, external_visibility, credential_scope,
         trigger_chain, estimated_cost, actor_identity)
```

每个授权应是一次性 capability receipt：`subject_ref + effect_digest + target + max_scope + expires_at + one_shot + approver_identity + auth_strength`。执行点重算 digest/revision/risk，不能只信语音层传来的“approved=true”。这正好可复用 Hopper `DecisionRequest` 已有的 digest/revision/expiry 设计（`Hopper/src/schemas/platform/decision.ts:30-74`），但四项执行点复验仍待 M3b 实现（`Hopper/docs/SCHEMA-FREEZE-M3A.md:43-48`）。

**批准通道建议：**

| 风险 | 语音作用 | 真正授权 |
|---|---|---|
| S0 只读、无敏感数据 | 可直接请求 | policy 自动授权 |
| S1 project sandbox 内可恢复 | 可直接请求/撤销 | scoped run capability |
| S2 持久或出圈但可逆 | 语音复述后展示 consequence | 已登录 UI 一次确认，必要时 OS auth |
| S3 外部发布/钱/数据删除/高敏读取 | 只允许导航和解释 | 独立设备或 OS biometric/password；短 TTL；执行前二次显示最终 payload |

口述 PIN 和复述短语都不应被当作强认证。

### 4.4 “隔夜交活”的端到端可靠性没有 SLO

成功不是 runner exit 0，而是下列串联事件全部成功：

1. 语音/文本正确捕获意图；
2. foundation/Context Pack 没有遗漏或污染；
3. readiness 没有假阳性；
4. approval 与正确 revision 绑定；
5. dispatch 被 Hopper 恰好执行一次；
6. agent 完成真正目标；
7. 独立 gate 检出错误且环境可信；
8. artifact/event/receipt durable 落盘；
9. callback 被送达、去重并得到 ACK；
10. 用户能审阅并接受，而不是“通知已发”等于“交付已完成”。

**【推断·示意，不是实测】** 即使只抽象成 8 个独立阶段，每阶段 98% 可靠，端到端也只有 `0.98^8 ≈ 85.1%`；每阶段 95% 时只有 `0.95^8 ≈ 66.3%`。实际失败并不独立，供应商故障、过期凭据和错误上下文会相关地击穿多个阶段。

METR 的 2026 口径也不能替“隔夜可靠”背书：其 time horizon 是某人类用时下 50%/80% 成功概率，不是 agent 实际能连续运行多久；METR 明确提醒可靠性关键任务可能需要 98%+，复杂失败还会增加人类修复劳动，长任务与真实经济任务也更 messy。[METR time horizons](https://metr.org/time-horizons/) / [limitations](https://metr.org/notes/2026-01-22-time-horizon-limitations/) / [Frontier Risk Report](https://metr.org/blog/2026-05-19-frontier-risk-report/)

#### “隔夜”必须改成 deadline workflow，而不是超长单 run

- 每个 attempt 可保留 45 分钟 backstop；上层 workflow 有 8 小时 deadline、总 token/cost、最大 attempts、最大无进展次数；
- step 边界 durable checkpoint，恢复时从 receipt 重建，不依赖进程内 session；
- retry 必须分类：transient 可自动、deterministic failure 禁止盲重试、ambiguous effect 先对账；
- 每个 step 有机械 acceptance 和 evidence ref；模型说“已完成”不是 gate；
- deadline 前预留 review/repair budget，不能把全部时间烧在首次实现；
- 到时未 verified success 就诚实交付 partial receipt：做了什么、没做什么、为什么、剩余风险；
- 默认不 merge、不 deploy、不发外部消息；“早晨有可审阅成果”与“早晨已上线”必须是两种产品承诺。

#### dispatch 前必须做 delivery preflight

至少检查：host 在线与睡眠策略、剩余电量/电源、磁盘、网络、provider quota/rate limit、CLI auth、必要 secrets、repo/branch/worktree 状态、setup 可重复性、test 时长、callback 渠道、quiet hours、预算和 deadline。失败应在用户离开前暴露，而不是凌晨 1 点才回叫。

---

## 5. Q3：“对话优先 + AI 自主提议开工”最容易失败的场景

| 场景 | 典型失控 | 必要护栏 |
|---|---|---|
| 脑暴/假设/反例 | “如果我们改成 X 呢”被沉淀成需求 | turn-level intent 标记：explore / decide / authorize；explore 内容默认只进 candidate notes，不进 approved spec |
| 模糊肯定 | “好、行、听起来不错”可能是在认可摘要而非 dispatch | 确认必须引用 proposal title、revision、关键后果和动作：“批准 v7 并后台执行，预算上限 $8？”；非绑定 yes 无效 |
| 中途改口/否定 | 旧摘要把被撤销约束复活 | append-only revision ledger；撤销是一等事件；stale package 自动失效，执行前 expected_revision 比对 |
| 多说话人/会议 | 客户建议被当 owner 授权；旁人可说“开工” | speaker diarization 仅作辅助，不作认证；owner device session 绑定；全体录音同意；第三方话语不写 L0；会后单独 owner confirmation |
| 嘈杂、口音、专名、数字 | ASR 把文件名、金额、否定词听错 | 关键实体屏显；数字/路径/外部对象必须文字确认；保留音频 ref 与 transcript confidence；低置信度主动问 |
| S2S 理解与 transcript 不一致 | 模型按音频理解 A，审计记录却是转写 B，后续下游按 B 执行 | 行动依据统一到 canonical text/event；高风险 turn 做独立 transcription 或 out-of-band audit；检测差异就阻断。OpenAI 官方 cookbook 也提醒 Realtime 对音频的理解不一定等于独立 transcript，[参考](https://developers.openai.com/cookbook/examples/realtime_out_of_band_transcription) |
| 小而明确的任务 | 强制奠基/采访比直接做更慢 | 三车道：Quick（直接 spec preview）、Guided（定向问）、Explore（开放聊）；系统建议，用户随时切换 |
| 紧急故障 | “先研究透”错过恢复窗口 | Incident lane：只读诊断优先、时间盒、明确变更冻结、操作 runbook 与双确认，不复用普通 product interview |
| 专家用户 | AI 反复问已知常识，产生被控制感 | 可说“按当前信息给我三个未知/直接出草案”；显示 coverage map，允许标记 assumption accepted |
| 非技术用户 | 漂亮 Demo 掩盖架构、安全、维护成本 | consequence card：数据、成本、依赖、不可逆点、仍未知；独立 verifier；验收按业务结果而非只看 Demo |
| 审美/UI | 语言采访难表达隐性偏好 | reference image/annotation、多版本对比；Demo 元素与 acceptance/plan item 互链；实现与 Demo 使用同一 design tokens/content schema |
| 需求逐步膨胀 | 每轮新点子让 readiness 永不收敛或 scope 暗增 | parking lot；package scope freeze；新需求标 in/out；超过阈值拆新 package，不静默并入已批准任务 |
| 用户疲劳/自动化偏信 | 连续确认最终变成机械点“是” | confirmation budget；只在 material change 请求；随机/风险触发 comprehension check；高风险要求用户选择 consequence 而非 yes/no |
| 恶意仓库/网页/issue | 内容操控 Brain、memory 或执行计划 | untrusted-data channel；候选记忆隔离；指令检测不是唯一防线；工具 policy 不接受内容自授予权限 |
| 跨项目对话 | 客户 A 的偏好/secret 泄到客户 B | project tenant boundary；L0 只允许低敏、用户明确偏好；Pack 编译器 data-class filter；跨项目引用必须显式 |
| 离线/回叫失败 | 用户以为系统在做，实际未 dispatch/已 blocked | dispatch receipt 立即给 run id/deadline；notification 是有 ACK 的状态机；failed delivery 进入 fallback，不把“已发”当“已达” |

### 5.1 推荐的交互状态，而不是一个万能“聊天态”

```text
EXPLORE ──用户/AI收束──▶ DRAFT
   │                      │
   └─候选材料，不可执行    ├─结构化事实/假设/unknown
                          ▼
                       REVIEWABLE
                          │ 生成 versioned DecisionPackage
                revise ◀─┼─▶ approve(package_digest)
                          ▼
                       DISPATCHED
                          │ 后续变更一律新 revision/Command
                          ▼
                    VERIFYING → REVIEW → ACCEPTED
```

任何语音 turn 都只能提出状态转换；durable service 校验转换是否合法。Brain 不得通过 tool call 跳过 `REVIEWABLE` 或以口播内容直接构造 side effect。

---

## 6. Q4：VoiceLoop + Hopper 分层评审

### 6.1 边界切分结论

**切分方向正确，职责表述过粗，成熟度被高估。** VoiceLoop 应拥有“理解人和项目的控制面”；Hopper 应拥有“接受已批准合同后安全执行并交付证据的执行面”。两者不能同时拥有 task status、approval truth、budget truth、retry 或 notification escalation，否则一定 split-brain。

### 6.2 推荐的唯一所有权矩阵

| 对象/职责 | 唯一 owner | 另一侧只能做什么 |
|---|---|---|
| Voice session、turn、speaker/ASR evidence | VoiceLoop | Hopper 不感知音频，只接 canonical artifacts |
| L0-L3 memory candidate、provenance、ContextSnapshot | VoiceLoop | Hopper 按 ref 读取冻结 snapshot；不能写 profile/L1 |
| InterviewCoverage、ReadinessAssessment | VoiceLoop | Hopper 可拒绝不满足 contract 的 dispatch，不替 Brain 判业务 readiness |
| DecisionPackage、acceptance、package revision | VoiceLoop | Hopper 保存不可变 digest/ref，执行时不可自行改 spec |
| DispatchApproval（“执行这个 package”） | VoiceLoop 采集；Hopper 执行点验证 | VoiceLoop 不能把 `approved=true` 当授权；Hopper 校验 identity/digest/revision/expiry/budget/risk |
| Hopper Task/Run/Attempt/Step、worktree、runner session | Hopper | VoiceLoop 只读 projection，不直接改 status/PID/session |
| runtime DecisionRequest（预算、危险 effect、blocked choice） | Hopper | VoiceLoop 作为展示/语音 transport，回传带身份的 resolution；Hopper 是 resolution 与 effect 的事实源 |
| Command/steer/cancel/answer | Hopper command service | VoiceLoop 发送幂等 request，不直接发 signal/写 runner stdin |
| Usage/Budget/Retry/Recovery/Gates | Hopper | VoiceLoop 展示并可请求策略变更，不能自己重置预算或伪造 gate pass |
| NotificationIntent 与 dedup/escalation state | Hopper 产生/拥有 | VoiceLoop transport 负责 voice/UI delivery 与 ACK receipt；不得重复产生同一业务通知 |
| ResultReceipt/verification evidence | Hopper | VoiceLoop 摘要、回叫、写入候选 L2；不可把摘要反写成 Hopper 成功事实 |
| 最终用户 acceptance | VoiceLoop 采集；Hopper 关联交付对象 | 双方以 digest/ref 对账，不能只靠 task_id 或自然语言标题 |

### 6.3 “缝合层”必须升级为显式 Control Plane Bridge

建议最小 dispatch 合同：

```text
DispatchEnvelope {
  schema_version, dispatch_id, idempotency_key, trace_id,
  project_ref,
  decision_package_ref, decision_package_digest, package_revision,
  context_snapshot_ref, context_snapshot_digest,
  approval_receipt_ref, approver_subject, auth_strength,
  acceptance_contract_ref,
  risk_policy_ref, capability_refs[],
  budget_envelope, deadline_at,
  callback_endpoint_ref, created_at
}
```

Hopper 返回 durable `DispatchAccepted | DispatchRejected` receipt，含其 task/run refs 与拒绝理由。其后事件必须有 `event_id + aggregate_id + sequence + occurred_at + observed_at + causation_id + schema_version`。VoiceLoop 以 cursor/ACK 消费；传输允许 at-least-once，effect 依靠 idempotency 做 exactly-once 语义。断线重连从 cursor 重放，不能 tail 一个可能轮转/截断的文件并猜位置。

### 6.4 前后端之间必须有的五类消息

1. `DispatchEnvelope`：开始一个冻结 package；
2. `CommandRequest`：steer/cancel/answer/snooze，带 `expected_revision/expected_run_id/idempotency_key`；
3. `ExecutionEvent`：状态与证据，不携带可执行自然语言指令；
4. `DecisionRequest/Resolution`：digest-bound、到期 fail-closed；
5. `NotificationIntent/DeliveryReceipt`：业务触发与 transport delivery 分离，ACK 不等于问题 resolved。

### 6.5 必须消除的重叠与漏切

- **任务状态重叠：** 主方案 §4.10 仍在 VoiceLoop SQLite 定义 tasks/runs/events/approvals（`voice-coding-framework.Cursor2.md:404-418`），而 v1.13 又让 Hopper 成为 task truth。若战略确认，主方案必须 supersede 旧数据模型，VoiceLoop 只保留 external refs/projections。
- **恢复重叠：** VoiceLoop 不能扫描 Hopper PID、自行 resume runner；只请求 Hopper recover/reconcile 并消费 receipt。
- **预算重叠：** VoiceLoop 估算和展示，Hopper 执行与强制；两侧共享 envelope version，不各算一套余额。
- **审批漏切：** “是否执行 package”与“运行中是否允许某个 effect”是两个 decision domain；当前文档把它们都叫审批，容易套用旧批准。
- **通知重叠：** Hopper 决定哪个事实值得发 intent；VoiceLoop 决定怎样用语音/屏幕/推送呈现。quiet hours、ack、dedup、resolution timeout 的状态归属要固定。
- **memory 回写漏切：** Hopper 原始 log/diff 是不可信 evidence，不应自动沉淀 L1。VoiceLoop 只能把 verified receipt 和用户接受的决策提升为 trusted memory。
- **schema/runtime 漏切：** Hopper M3a schema 已通过定向测试，但 command/decision/workflow/notification runtime 仍属未来 milestone；集成排期必须以代码而非 schema 名称估算。
- **版本漂移：** Voice provider、Brain model、Context compiler、Hopper schema、runner CLI 五处都需要 compatibility matrix 与 contract CI。

### 6.6 文档本身已形成双重架构

**【已验证事实·本地】** 主方案 §3.2-§4.10 仍描述 VoiceLoop 自建 daemon、编排器、runner adapter、SQLite、worktree、恢复和回叫；`business-flows.md §11` 才追加 Hopper 战略，而且标记“待确认”。`business-flows.md:213-225` 的一致性自检发生在 §11 之前，却写“无冲突”。

**建议：** owner 一旦选择 VoiceLoop+Hopper，就先出 ADR，明确 supersede 的章节和 owner matrix，再做代码；否则工程师会同时实现旧 daemon 和新 bridge。不要仅在末尾追加 v1.13，必须让 canonical 主方案收敛为一个架构。

---

## 7. Q5：已识别 6 个真缺口逐项判定

| 缺口 | 严重度 | 判定 | 现有基础 | 必须补到什么程度才算关闭 |
|---|---|---|---|---|
| G1 记忆生命周期治理 | **P0 / Critical** | 判断正确但严重低估：陈旧/膨胀只是可靠性问题，**provenance、poisoning、跨项目泄漏是安全问题** | §4.19 已有提炼、代码变更失效、人可编辑；`competitive-scan §2.1` 提了衰减/consolidation | candidate/trusted/quarantined 三态；source quote/digest/trust/valid time；矛盾图；read-time taint；L0 只允许本人明确表达或显式批准；软删/硬删/export；删除传播验证；memory red-team 与 `/doctor` |
| G2 审批持久化 | **P0 / Critical** | 完全成立；Hopper schema 设计强，但当前 runtime 未实现 | `DecisionRequest` 已有 digest/revision/risk/expiry，且 expiry 只 reject/pause；定向 25 tests 通过 | append-only request/resolution；执行点四复验；identity/auth strength；single-use/TTL；supersede；idempotent effect；重启/重复投递/并发批准测试；任何 timeout 不自动放行 |
| G3 计划落盘 + Demo 同源 | **P1 / High** | 成立；Artifact Store 只能说明“能存”，不能说明“批准的是哪版、执行遵守哪版” | §4.18 有 versioned artifact；§4.20 有 Decision Package，但 Demo 明称 disposable mock | `DecisionPackage@revision` 不可变；plan/acceptance/demo refs 与 digest；用户修改产生新 revision；每个 Demo 元素链接 acceptance/plan item；执行结果逐项回写 evidence；批准后 semantic diff 必须重批 |
| G4 恢复工程 | **P0 / Critical** | 成立；Hopper 原 task 级恢复可借，但前脑↔后端新控制面没有恢复闭环 | Hopper 已有事件/对账/runner task 基础；主方案有 `native_session_id`/启动对账 | voice/session、outbox/inbox、dispatch、command、decision、workflow、notification 各自 checkpoint；ambiguous effect 对账；resume 不支持时从 frozen context+diff+receipt 新开 run；灾难恢复/备份还原 drill；RTO/RPO |
| G5 AGENTS.md 互通 | **P1 / High** | 互通是必要的可迁移性，不是护城河；处理不当又是 prompt-injection 放大器 | scan 提出幂等 marker block、反向吸收规则文件 | 只写 VoiceLoop 自有 marker 区；默认写“索引指针 + digest”，不把第三方调研/推断写成指令；读取时保留文件/层级/commit provenance 与 precedence；跨 trust domain 不自动提升；冲突和删除可审计 |
| G6 就绪校准 | **P0 / Critical** | 这是产品核心，不是优化项；没有 calibration，双维分数只是 UI 装饰 | §4.20 有两维但无量表、ground truth、独立性、阈值或反馈数据 | detector 与 generator/executor 解耦；task-type rubric；证据 coverage + uncertainty；shadow mode；human label；false-ready/ECE/Brier/返工/推翻率；阈值按 effect risk 提升；模型升级必须重跑回归 |

### 7.1 G1：记忆不应“自动写入”，而应“自动提出写入”

**【已验证事实·联网】** 2026 年系统性 memory-poisoning 研究识别四种写入渠道、九类结构性弱点、六类攻击，并发现写入/召回越激进的 agent 越容易被利用，普通 prompt-injection 防御覆盖不足。[From Untrusted Input to Trusted Memory](https://arxiv.org/abs/2606.04329)

**【已验证事实·联网】** Sleeper Memory Poisoning 专门演示文档、网页或仓库如何诱使 agent 保存关于用户的伪造记忆，再在未来会话触发行为。[Hidden in Memory](https://arxiv.org/abs/2605.15338)；更晚的 2026-07 benchmark 也继续验证这是跨模型/渠道问题：[MemPoison](https://arxiv.org/abs/2607.14651)。

建议写路径：

```text
raw evidence (immutable, untrusted)
  → memory candidate (claim + source + quote + trust + expiry)
  → conflict/taint/policy checks
  → [auto-accept only low-impact project-local fact]
     [user/reviewer accept for preference, decision, external fact]
  → trusted memory
  → retrieval-time risk filter + provenance-visible Context Pack
```

L0 的硬规则：第三方内容永远不能定义“用户喜欢什么/允许什么/凭据在哪里”；模型对用户的心理、身份、关系、政治/健康等推断默认不得写；敏感偏好必须用户可见且可删除。L1 的代码事实优先现读/机械提取，过期即降权；外部调研事实必须有 `observed_at` 和 URL/content digest。L2 可以广收，但默认 quarantined，不得直接授权工具。

### 7.2 G2：批准的是不可变 effect，不是自然语言意向

批准收据至少包含：

```text
ApprovalReceipt {
  decision_id, subject_ref, subject_digest, revision,
  chosen_option, consequence_digest,
  approver_subject, auth_method, auth_strength,
  issued_at, expires_at, consumed_at?, channel, trace_id
}
```

执行点检查 live subject digest/revision、option、expiry/supersede、capability、预算、数据分类与 target。检查之后到 effect 之间仍有 TOCTOU，需在 Hopper 同一 command transaction/lease 内完成；无法原子化的外部 effect 要用 idempotency key + provider receipt 对账。

### 7.3 G3：Demo 必须是合同视图，不是说服材料

§4.20 把 Demo 定义为“mock 数据的可抛弃预览”。这在探索阶段合理，但在批准阶段危险：用户签了视觉承诺，agent 收到的是另一份自然语言 plan。推荐：

- 探索 Demo 可抛弃，但明确水印 `concept / non-binding`；
- 决策 Demo 必须绑定 package revision，并引用同一 design tokens、数据字段、文案与 acceptance IDs；
- 实现可不复用 Demo 代码，但必须通过 screenshot/DOM/behavior acceptance 对照；
- 决策包同时显示“Demo 没展示的内容”：数据、权限、失败态、移动端、可访问性、成本、迁移；
- 任何 material semantic diff 生成 `DecisionPackageDiff` 并使旧批准失效。

### 7.4 G4：恢复目标不是“进程继续”，是“效果不重复、事实不丢”

`native_session_id` 只解决模型对话恢复，不解决：命令是否已经产生外部 effect、预算是否已扣、notification 是否已达、approval 是否已消费、worktree 是否与 session 对应。恢复测试应覆盖 kill -9 两侧进程、主机重启、事件写一半、重复 webhook、乱序事件、provider timeout 但 effect 已成功、token 过期、schema 升级和回滚。

### 7.5 G5：互通会削弱锁定，但增强可信度

VoiceLoop 应主动支持 AGENTS.md/CLAUDE.md/.cursor/rules 的导入导出，因为用户数据可携带是采用条件。护城河不应是把知识锁在 `.voiceloop/`，而应是：更好的 provenance graph、更准确的 readiness calibration、跨工具 outcome/eval 数据和更低返工率。导出标准化材料反而能建立信任。

### 7.6 G6：双维就绪应拆成至少四维

现有“知识充分 + 需求明确”遗漏两个开工前必要维度：

1. **可执行性**：环境、权限、依赖、工具、时间、预算是否可用；
2. **可验证性**：验收 oracle 是否存在，是否能独立判断完成。

建议 readiness vector：

```text
R = {
  intent_clarity,
  evidence_coverage,
  execution_feasibility,
  verification_strength,
  residual_uncertainty[],
  risk_class,
  recommended_lane
}
```

开工 policy 不是平均分，而是 hard constraints：高风险 effect 的 verification/authority 不达标时，其他维度再高也不能 dispatch。

---

## 8. 新发现缺口（方案与 6 缺口之外）

### 8.1 P0 级新增缺口

1. **身份、授权主体与多说话人安全**：speaker diarization 不是认证；“谁说的、谁有权批、设备是否已登录、代理权限范围”尚无模型。
2. **跨边界事务与幂等**：VoiceLoop package 已批准但 Hopper 未接收、Hopper 已执行但 VoiceLoop 超时重投、通知已达但 ACK 丢失等 ambiguous state 尚无 outbox/inbox/receipt 方案。
3. **memory provenance / poisoning / taint**：原 6 缺口只谈遗忘和审计，没有把不可信来源写入长期控制上下文当成 security boundary。
4. **独立 acceptance oracle**：当前 readiness、计划、Demo、执行摘要都可能由同族模型产生；缺少机械检查、独立 verifier 和 false-complete 指标。
5. **secret、network egress 与 supply-chain policy**：worktree 不隔离凭据/网络/包管理器/Docker socket；install dependency 不能简单归为可逆 L2。
6. **canonical intent/ASR audit**：S2S 的音频理解、独立 transcript、用户看到的文字、下游 spec 可能四者不一致；尚无唯一授权文本和差异阻断。
7. **数据删除/导出/同意传播**：删 transcript 是否连带删除 embedding、摘要、L1 提炼、备份、Hopper snapshot；会议参与者撤回同意如何处理，均未定义。

### 8.2 P1 级新增缺口

8. **review/acceptance surface**：移动 diff、测试证据、截图、artifact diff、风险聚焦 review 不是附属页面，而是核心留存面。
9. **计划变更控制**：开工后 steer 是否改变 acceptance、预算、risk class；何时必须重新出包/重批没有明确 policy。
10. **端到端 SLO 与 trace**：没有从音频 turn → package → approval → dispatch → run → gate → callback → acceptance 的统一 trace、阶段延迟和失败 taxonomy。
11. **模型/提示/编译器版本治理**：model alias 漂移会改变采访、记忆提炼和 readiness；需要 snapshot、canary、回归、rollback。
12. **schema migration、备份与灾难恢复**：L0-L3、artifact、bridge cursor、Hopper refs 的跨版本迁移和恢复没有 RPO/RTO。
13. **overnight scheduler / host availability**：合盖、断网、quota、auth、维护窗口、时区/DST、quiet hours 与 deadline 冲突未建模。
14. **notification lifecycle**：`pending → delivered → acknowledged → resolved` 未分开；ACK 只说明用户看见，不说明 blocker 被处理。需 snooze、resolution timeout、dedup 和 fallback。
15. **多租户/多客户数据边界**：L0 全局 profile 与跨项目检索可能泄露客户事实、许可证或策略；需要 namespace 和 data class。
16. **滥用与 DoS**：恶意/失控对话可连续触发 foundation、research、Demo 或草稿巡检；即使不执行代码也能烧费和填满磁盘。
17. **公平性与可访问性**：口音、言语障碍、听障、非母语、共享办公/保密环境；必须有完整文本/键盘等价路径，不能降级成二等体验。
18. **数据驻留与第三方同意**：默认本地 artifact 不等于音频/模型调用本地；哪些数据上云、供应商 retention、地区处理与会议录音法域需显式。

### 8.3 P2 但应早埋点的缺口

19. **反馈学习反噬**：用“接受/推翻”训练 readiness 会受到用户懒惰确认、权威偏见和任务难度混杂；需要 outcome label 与安全隔离，不能直接回写长期记忆。
20. **召回风暴/注意力竞争**：并行任务同时 blocked/done 时会回叫轰炸；需要 per-user attention budget、聚合和优先队列。
21. **国际化与术语发音**：代码/中英文混说、路径/符号/版本号口播与屏显映射，需要专门 grammar/lexicon/eval。
22. **观测本身泄密**：log、transcript、raw runner stream、通知 body、crash report 可能泄 secret；需要字段级 redaction 与敏感通知降级。

---

## 9. 汇总风险清单（按严重度）

### 9.1 P0 / Critical：未关闭不得开放自主 dispatch

| ID | 风险 | 触发/后果 | 关闭门禁 |
|---|---|---|---|
| R0-1 | readiness 假阳性 | 错误理解被自动提议并执行 | 独立 evaluator；分类型校准；false-ready SLO；shadow mode |
| R0-2 | persistent memory poisoning | 一次恶意内容跨会话支配未来行为 | provenance/taint/quarantine；L0/L1 promotion policy；red-team 零越权写 |
| R0-3 | 授权歧义或冒充 | 旁人/模糊 yes/stale package 触发执行 | authenticated subject；digest/revision/TTL；S2+ 独立 UI auth |
| R0-4 | VoiceLoop/Hopper split-brain | 重复执行、状态冲突、预算/审批丢失 | owner matrix；durable protocol；outbox/inbox；idempotency/reconcile |
| R0-5 | schema 被误当 runtime | 回叫/steer/decision 在真实断线时不可用 | M3b-d contract spike；kill/restart/duplicate/timeout E2E |
| R0-6 | false complete | agent/摘要声称完成但行为错误或漏验 | independent acceptance oracle；evidence-by-criterion；false-complete metric |
| R0-7 | secret/exfil/supply-chain | 安装、测试、读文件或网络动作泄密/执行恶意代码 | OS/container sandbox；credential broker；egress allowlist；data-class policy |
| R0-8 | 数据删除/跨项目泄漏 | 敏感 L0/L1/L2 或会议数据无法彻底撤销 | namespace；lineage deletion；export/audit；restore 后仍遵守 tombstone |

### 9.2 P1 / High：会导致承诺失真、严重返工或不可运营

| ID | 风险 | 触发/后果 | 主要缓解 |
|---|---|---|---|
| R1-1 | Context Pack 漂移/冲突 | 恢复后目标和约束变化 | deterministic compiler、claim provenance、revision re-grounding |
| R1-2 | 45 分钟 fuse 与 overnight 不闭环 | 长任务必停或无限重派 | deadline workflow、bounded attempts、step receipts |
| R1-3 | 成本尾部失控 | foundation/agent/verifier/retry 叠加 | end-to-end budget envelope、p95 estimate、同预算 retry |
| R1-4 | review 成为瓶颈 | 用户无法发现行为偏差，成品堆积 | mobile evidence review、risk cards、acceptance trace |
| R1-5 | host/网络/凭据不可用 | 夜间早停，第二天无成果 | delivery preflight、always-on option、auth/quota monitor |
| R1-6 | Demo 诱导错误批准 | 漂亮 mock 与实现/失败态脱节 | concept/contract 分层、同 revision、acceptance linking |
| R1-7 | steer 静默扩大 scope | 旧批准被套到新目标/成本/风险 | change classifier、semantic diff、material change reapproval |
| R1-8 | notification 未送达/风暴 | blocker 无人处理或用户关闭通知 | durable lifecycle、ACK≠resolve、aggregation、fallback |
| R1-9 | model/provider/CLI drift | adapter 或 readiness 行为无预警变化 | snapshots、capability probe、contract CI、canary/rollback |
| R1-10 | 首次奠基 activation cliff | 用户等待/离开，且先研究错方向 | progressive grounding、timebox、TTFV SLO、quick lane |
| R1-11 | S2S 理解与审计文本分叉 | 审批证据和实际理解不同 | canonical text、out-of-band transcript、difference gate |
| R1-12 | schema/索引损坏或迁移失败 | 长期记忆和游标不可恢复 | versioned migrations、backup/restore drill、RPO/RTO |
| R1-13 | AGENTS.md 信任提升 | 不可信知识变成 agent 高优先级指令 | marker-only pointer、provenance/precedence、no auto-promotion |
| R1-14 | 合规/第三方同意失败 | 会议音频和敏感数据被违规留存/上云 | consent receipts、data map、retention policy、region/provider controls |

### 9.3 P2 / Medium：影响采用、留存或长期维护

| ID | 风险 | 主要缓解 |
|---|---|---|
| R2-1 | voice-first 对小任务过重 | Quick/Guided/Explore 三车道，记住用户偏好但可随时覆盖 |
| R2-2 | 专家用户被重复采访 | coverage 可视化、assumption accept、直接出 draft |
| R2-3 | 语音可访问性/社交场景受限 | 完整文本等价面、push-to-talk、耳机/隐私模式、无障碍评测 |
| R2-4 | 多任务注意力争夺 | attention budget、digest、优先级与 quiet-hour scheduler |
| R2-5 | 竞品快速复制交互 | 把资源投向 calibration/eval/provenance/domain outcomes，不投向通用 voice chrome |
| R2-6 | 长期记忆无限增长 | retention、bi-temporal validity、consolidation、冷热分层、可解释召回 |

---

## 10. Q6：竞争与护城河

### 10.1 2026 竞争现实

VoiceLoop 原来可讲成优势的五层中，四层已经快速商品化：

| 能力 | 2026 已有证据 | 对 VoiceLoop 的含义 |
|---|---|---|
| Realtime voice / barge-in | OpenAI Realtime 是公开 API；Codex app-server 甚至已有 experimental thread realtime | 语音链路、VAD、打断、TTS 音色不是持久壁垒 |
| 本地 daemon + 多 runner + 手机 | Paseo 已覆盖 Claude/Codex/Copilot/OpenCode/Pi、语音、iOS/Android/桌面/web/CLI、worktree、stream/follow-up | “语音遥控本地 coding agent”已经有高度重叠的开源竞品 |
| 后台长任务 + 需要时叫人 | Claude agent view/background、Claude Cowork mobile/web、Codex mobile 都已提供 | 挂断继续、手机批准、通知、跨设备 steer 是平台能力 |
| 更少人工审批的安全执行 | Claude Auto mode、Codex sandbox/approvals、各类 agent harness 持续增强 | 通用风险分类/权限 UX 会被基础平台吞噬 |
| 结构化采访 + 何时开工 + 可审计长期项目理解 | 研究原型存在，通用产品仍未形成强标准 | 这是最可能保留差异化的层，但必须用指标证明，不是靠 L0-L3 命名 |

Paseo 是现有 `competitive-scan-2026-07.md` 漏掉的最危险近邻。它不仅有 voice dictation，而是明确写“dictate tasks or talk through problems”，并已有 spoken messages、plan actions、context meter、diff、questions、notifications、reconnect 和 orchestration error visibility。[Paseo](https://github.com/getpaseo/paseo) / [changelog](https://github.com/getpaseo/paseo/blob/main/CHANGELOG.md)

其他邻近产品：

- [Happy](https://github.com/slopus/happy)：手机/网页控制 Claude Code/Codex、push、resume、端到端加密，说明 remote control/notification 生态很拥挤；
- [Orchestra Mobile](https://orchestracode.com/mobile)：语音 dictation → cloud background agent → PR/live preview/push，虽不是采访式但覆盖结果链；
- [Codex from anywhere](https://openai.com/index/work-with-codex-from-anywhere/)：手机连接本机/remote、审批、steer、diff/test/screenshot；
- [Claude agent view](https://claude.com/blog/agent-view-in-claude-code) 与 [Claude Cowork web/mobile](https://claude.com/blog/cowork-web-mobile)：后台 agent、手机提问/通知、设备离线后继续和 scheduled/overnight work；
- [Claude dynamic workflows](https://claude.com/blog/introducing-dynamic-workflows-in-claude-code)：大任务动态编排、并行 subagent 和独立检查，持续压缩通用下游价值。

### 10.2 哪些不是护城河

1. **不是语音**：API 可购买，开源/官方产品都能复制；
2. **不是本地 daemon / worktree / runner adapter**：Paseo、Hopper、官方 app-server 都在做；
3. **不是“会记忆”**：记忆正在成为平台能力，而且未经治理的记忆是负资产；
4. **不是多 agent**：平台正把并发和 dynamic workflows 产品化；
5. **不是“主动通知”**：push/needs-input/background 已成为标准交互；
6. **不是把知识锁在私有格式**：这会提高采用阻力，且 AGENTS.md 互通要求本就与锁定相反。

### 10.3 真正可能形成的护城河

#### A. 经校准的“何时问、何时做、何时拒绝做”

核心资产不是 readiness prompt，而是按任务类型积累的：真实对话 → 缺口标签 → 决策包 revision → 接受/推翻 → 执行结果 → 返工/事故的闭环数据。若能在同样用户负担下显著降低 false-ready 和返工，才是难复制的行为护城河。

应公开或内部长期跟踪：

- false-ready rate at fixed coverage；
- calibration error / Brier score；
- time-to-reviewable-package；
- package first-pass acceptance / material revision rate；
- execution first-pass verified success；
- human repair/review minutes；
- “问了有价值问题”比例与冗余问题率。

#### B. 安全、可解释、可撤销的项目记忆图

如果每个 recall 都能回答“这是谁在什么时候基于什么原文说的、当前为何仍有效、是否被第三方污染、如何撤销”，且能把 verified execution outcome 回写而不吸收恶意内容，记忆才会从功能变成信任资产。单纯 Markdown + embedding 无壁垒。

关键指标：memory precision、contradiction detection、stale recall、poison activation、删除传播、跨项目泄漏均可量化。

#### C. 领域化的 interview/readiness/acceptance 模板与 eval

“做网站”“修 bug”“做调研”“出营销材料”不能只换 prompt。每类任务有自己的隐性 concerns、权限、evidence 和验收 oracle。越接近行业/组织真实工作流，越有数据与集成复利。先选 1-2 个 wedge，不要 P0 同时覆盖 coding/planning/research/marketing/general。

#### D. vendor-neutral 的批准合同与 outcome ledger

把 VoiceLoop 的高质量 DecisionPackage、ApprovalReceipt、ContextSnapshot、AcceptanceContract 投递给 Hopper/Codex/Claude/其他后端，并持续对账结果，会形成跨模型的“项目理解与治理层”。基础模型越换越快，这层价值越高。

#### E. 把 review attention 变成产品，而不是尾声

按 acceptance 自动组织 diff、截图、测试、决策、风险和未验证项，让用户只在高信息增益处介入。谁能减少 review minutes 同时提高严重错误检出率，谁就控制长时 agent 的真实瓶颈。

### 10.4 护城河判断

**【推断】** VoiceLoop 有潜在 wedge，但当前还没有已验证护城河。最好的战略表述不是“第一个语音 coding agent”，而是：

> **一个在开放对话中建立可审计项目理解、能校准是否该开工，并把获批合同安全交给任意执行 agent 的本地优先控制面。**

如果 3-6 个月内不能在 false-ready、first-pass acceptance、human repair time 或 verified overnight success 上显著优于“Paseo/Codex/Claude + 普通语音”，则前脑并未形成产品价值，应收缩为 Hopper 的一个 voice/intake transport，而不是独立产品。

---

## 11. Q7：2026 补充调研

### 11.1 产品与工程实践

| 来源 | 已验证新事实 | 对方案的修正 |
|---|---|---|
| [OpenAI Realtime pricing/cost](https://developers.openai.com/api/docs/guides/realtime-costs) | conversation 每次 Response 重入、后续 turn 更贵；用户/助手音频 token 速率不同；truncation 影响 cache；mini 明显便宜但 tool/instruction following 更弱 | 建 per-response ledger、Context window policy 和 full/mini/cascade 实测；不能只按“连接分钟”估价 |
| [Codex app-server](https://learn.chatgpt.com/docs/app-server#lifecycle-overview) | thread start/resume/fork、stream events、`turn/steer`、`turn/interrupt` 已有官方协议 | Hopper Codex adapter 应评估从 `codex exec` 升为 app-server；主方案的 Codex kill-and-resume-only 假设过时 |
| [Codex app-server realtime events](https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md#thread-realtime-events-experimental) | thread-scoped realtime/audio/transcript/handoff 已出现，但仍 experimental | 方向被平台验证；P0 不应依赖其稳定性，需 provider abstraction |
| [Codex from anywhere](https://openai.com/index/work-with-codex-from-anywhere/) | 2026-05 已覆盖手机跨设备 active work、approval、steer、diff/test/screenshot 和 secure relay | VoiceLoop §4.22 的部署拓扑不是差异化；review/grounding/readiness 才可能有价值 |
| [Claude agent view](https://claude.com/blog/agent-view-in-claude-code) | background agent、needs-input、inline reply、`/bg` 已产品化 | 后台任务和“卡住叫人”进入平台层 |
| [Claude Auto mode](https://claude.com/blog/auto-mode) | permission classifier 可自动允许安全动作、阻挡危险动作并在反复失败时叫人，但官方承认会错判且仍建议隔离 | “拦截≠叫人”正确；VoiceLoop 不应自建通用 classifier 作为壁垒，需在外部 effect/用户 intent 上增强 |
| [Claude Cowork web/mobile](https://claude.com/blog/cowork-web-mobile) | 2026-07 已有设备离线后台、手机决策、scheduled overnight、成果先 review 再外发 | “隔夜 + 回叫 + 非 coding”已被大厂覆盖，产品承诺必须更具体 |
| [Paseo](https://github.com/getpaseo/paseo) | 与 VoiceLoop 外壳高度重叠的 self-hosted voice/mobile/multi-agent daemon，且有成熟 UI/可靠性修复记录 | 必须纳入竞争基线；优先学习其真实故障清单，不重做通用 client shell |
| [OpenAI running Codex safely](https://openai.com/index/running-codex-safely/) | 官方实际部署强调 sandbox、network、identity/credentials、rules、managed config、telemetry/audit | VoiceLoop 当前仅 worktree+策略白名单不足；身份、凭据和 network 必须一等设计 |

OpenAI 2026-06 的内部采用数据表明用户确实在委派更长任务，甚至并行产生大量 agent turn-hours；但这是 adoption/usage 证据，不是单任务可靠性或“隔夜成功率”证据。[How agents are transforming work](https://openai.com/index/how-agents-are-transforming-work/)

### 11.2 论文与评测

| 论文/评测 | 关键发现 | VoiceLoop 应吸收的工程动作 |
|---|---|---|
| [From Chat to Interview (2026)](https://arxiv.org/abs/2605.05828) | 自由聊天漏隐性需求、问题冗余；结构化 experience ontology 提升覆盖和效率 | 建 concern ontology/coverage map；问题选择与语言生成分离；一次一问只是 UX，不是完整采访算法 |
| [Ask or Assume? (2026)](https://arxiv.org/abs/2603.26233) | 欠规格 detector 与 executor 解耦能提高 resolve，并显示较好 uncertainty calibration | readiness 独立服务；按任务复杂度决定问/做，不让 Brain 自判即自执 |
| [Conversational Reliability (2026)](https://arxiv.org/abs/2603.01423) | 多轮下 instruction drift、intent confusion、context overwrite 明显 | 用 durable intent ledger/revision，而不是只靠 transcript+summary；长会话定期 re-ground |
| [From Untrusted Input to Trusted Memory (2026)](https://arxiv.org/abs/2606.04329) | persistent memory 有多写入渠道和结构性 poisoning 弱点；激进记忆更脆弱 | 候选隔离、trust/provenance/taint、promotion policy、memory security eval |
| [Hidden in Memory (2026)](https://arxiv.org/abs/2605.15338) | 文档/网页/repo 可植入 sleeper memory，跨未来会话触发 | 第三方材料不得写 L0；L1 promotion 需 evidence/policy；读时仍要检查 taint |
| [How Agents Ask for Permission (2026)](https://arxiv.org/abs/2607.13718) | 对 21 种 agent permission 方案的综述显示 UI 中的用户权限表达与内部 policy/enforcement 之间仍有缺口 | 不把语音确认当 enforcement；做 digest-bound capability，从 UI 到执行点全链可证 |
| [METR Time Horizons + limitations (2026)](https://metr.org/time-horizons/) | 50%/80% success horizon 与人类任务时长有关，不等于可放心委派；messy/高可靠任务更难 | 用自家真实 task archetype 的 verified success、人类修复时长、deadline SLO，不用 frontier headline 代替验收 |
| [AsyncVoice Agent (2025，2026 仍相关)](https://arxiv.org/abs/2510.16156) | 解耦 streaming backend 与 voice frontend，支持 barge-in/steer，降低交互等待 | 支持前脑/后端异步分离，但不能把“可打断 narration”误当 durable command；语音 steer 必须进 command service |
| [τ²-bench (2025)](https://arxiv.org/abs/2506.07982) | user 与 agent 双方都能改变状态的 multi-turn 场景显著更难，合作行为影响成功 | 测试用户改口、迟到信息、错误回答、打断和权限，而不是只测理想合作脚本 |

### 11.3 研究空白，也是产品机会

本轮没有找到成熟产品同时公开证明以下三件事：

1. 从长、开放、非指令式语音中持续形成**可审计且版本化**的 execution contract；
2. 用真实 outcome 校准“该继续问还是该开工”，并公开 false-ready/返工指标；
3. 对跨会话项目记忆同时做好 provenance、poisoning defense、撤销与跨后端执行。

**【推断】** 这三者的交集就是 VoiceLoop 最值得押注的空白；但也是最难、最不适合只靠 prompt 的部分。

---

## 12. 可落地完善建议

### 12.1 先改产品承诺与 canonical 架构

1. 做一份 ADR，确认 VoiceLoop+Hopper；列出主方案 §3.2、§4.4、§4.8、§4.10 中由 Hopper supersede 的职责。
2. 把“Brain 判断是否够完美实施”改成“独立 Readiness Policy 判断是否达到可执行证据门槛”。
3. 把“隔夜交活”分成三个 SLO 文案：`后台尝试`、`deadline 前给可审阅成果`、`经验证交付`；禁止混用。
4. 把“对话优先”改成三车道产品：Quick / Guided / Explore，默认由 task/risk 推荐，用户一言切换。
5. P0 明确 non-goal：多人会议、电话审批、L3 effect、自动 merge/deploy、跨项目 L0 推断、通用 research/marketing executor。

### 12.2 第一阶段只做 text-first contract spine

在接实时语音前，用文本/录制 transcript 跑通：

```text
ConversationEvidence
 → IntentLedger / InterviewCoverage
 → independent ReadinessAssessment
 → DecisionPackage@revision
 → ApprovalReceipt
 → DispatchEnvelope
 → Hopper Task/Run events
 → ResultReceipt + evidence-by-criterion
 → Review / Accept / Revise
```

原因不是“语音不重要”，而是这条 spine 才承载安全、恢复和护城河；先接语音会把逻辑 bug 与 ASR/duplex/设备 bug 混在一起。

### 12.3 第二阶段实现 Bridge，而不是共享数据库

最小实现顺序：

1. `DispatchEnvelope` + immutable receipt + idempotency；
2. versioned events + cursor/ACK + replay；
3. `CommandRequest`（cancel/steer/answer）+ expected run/revision；
4. durable DecisionRequest/Resolution runtime 与执行点复验；
5. NotificationIntent → voice/UI transport → DeliveryReceipt；
6. kill/restart/duplicate/out-of-order/timeout chaos suite；
7. 再决定 Hopper runner 是扩展现有 `exec`，还是对 Codex 使用 app-server、对 Claude 使用流式 headless/SDK。

VoiceLoop 不直接 tail/写 Hopper 内部文件作为长期 API。P0 可临时 file-drop，但 envelope 必须原子 rename、带 digest/schema，消费后有 receipt；同时明确这是 adapter，不是最终 contract。

### 12.4 第三阶段做可信记忆最小集

P0 不要自动构建全功能 L0-L3。先做：

- L3：immutable transcript/evidence；
- L2：versioned artifacts，默认 untrusted/candidate；
- L1：只收用户批准的决策 + 机械提取的 repo facts，带 commit/source/digest；
- L0：只收用户显式说“记住这个”的低敏偏好；
- Context compiler：source-bound、预算确定、显示 exclusions、输出 digest；
- `/memory doctor`：stale/conflict/unattributed/tainted/secret scan；
- delete/export/restore test 从第一版就有。

等 red-team 数据证明自动 promotion 安全，再逐步放宽“静默沉淀”。

### 12.5 第四阶段才接实时语音

- 级联作为可审计默认：canonical transcript 先落 ledger，再由 Brain/工具消费；
- S2S 作为 low-latency enhanced mode，但对会导致 dispatch/approval 的 turn 做 canonical text confirmation；
- full/mini/cascade 用同一录音 corpus 比较：端到端首 token、barge-in、专名/否定/数字、function-call accuracy、cost、用户偏好；
- 所有设备断线、reconnect、microphone denial、autoplay block 都降级到文本/通知，不改变 durable state；
- voice UI 必须同步显示当前 mode、package revision、是否只是探索、是否已真正 dispatch。

### 12.6 Readiness 的工程化实现

建议三层而不是一个分数：

1. **机械 hard gate**：repo/project、scope、acceptance、budget、deadline、risk、authority、verify command、environment preflight；
2. **独立 uncertainty detector**：从 evidence/ledger 输出 missing/contradiction/assumption，不产 Demo、不执行；
3. **policy**：按 task type + risk 决定 `ASK / PROPOSE / BLOCK / QUICK_DRAFT`，保留理由与证据。

Brain 只负责把 gaps 转成自然的一次一问、把已通过的 assessment 转成决策包。任何“ready”都要保存 assessor/model/prompt/rubric version，方便回放。

### 12.7 Review 面的最小产品要求

回叫不是“完成了”，而是打开一张交付卡：

- 目标与批准 package revision；
- acceptance criterion 逐条 pass/fail/unknown + evidence；
- 做了什么、没做什么、偏离什么；
- tests/commands 的可信来源与输出摘要；
- screenshot/demo/diff；
- agent 自主决策和 residual risk；
- cost/time/attempt；
- `accept / request change / reject / open details`；
- material change 自动新建 package revision。

语音只播 one-liner 和前三个风险，用户说“展开第 2 条”再 drill down；不能用口播摘要替代 evidence。

### 12.8 推荐 P0 MVP

**只做：** 单用户、单项目、单任务、coding 小中型任务；push-to-talk；级联语音；Guided/Quick 两车道；L1 只存批准决策；DecisionPackage/Approval/Dispatch 全落盘；Hopper 单 task；worktree；机械 test gate；完成/blocked 推送与语音回叫；移动/桌面 review card。

**明确不做：** 多人会议、通话常驻、电话层、自动巡检、通用 planning/research/marketing、S2S 高风险批准、跨项目自动 L0、自动 merge/deploy、任意命令、动态多 agent workflow、关闭设备继续。

这个 MVP 仍能验证唯一真正关键的假设：**开放对话是否能比普通 prompt 更快形成更少返工的执行合同。**

---

## 13. 验证计划与退出标准

| 验证 | 数据/故障注入 | 核心指标 | 建议退出标准（P0） |
|---|---|---|---|
| V1 Readiness corpus | ≥200 条，按 task/risk/明确度分层；包含矛盾、缺验收、假熟悉 | false-ready、false-block、ECE/Brier、问题数 | 高风险 false-ready <1%；普通 <5%；模型升级不回退 |
| V2 Conversation replay | 打断、改口、否定、模糊 yes、跨话题、多人录音 | 错 revision dispatch、撤销复活、speaker 越权 | 错 dispatch = 0；stale approval 全拒；所有动作可回放解释 |
| V3 Memory red-team | repo/web/doc/meeting 四写入渠道；sleeper trigger | trusted promotion、poison activation、跨项目泄漏 | untrusted→L0 = 0；未批高影响 L1 = 0；跨项目泄漏 = 0 |
| V4 Bridge chaos | kill -9 两侧、重启、重复/乱序、半写、timeout-but-effected、断网 | duplicate effect、lost state、RTO/RPO | duplicate external effect = 0；无 silent loss；P95 恢复 <2 分钟（可再校准） |
| V5 Cost/latency | 真实 5/15/30 分钟会话；full/mini/cascade；大小 repo | TTFV、turn p95、project cost p50/p95、cache hit | 开工前可给 p95/max；hard cap 无越界；模型选择有数据依据 |
| V6 Overnight shadow | ≥100 个真实任务，不自动 merge | verified deadline success、false-complete、repair minutes、cost | 先以 ≥90% verified success 且高危 false-complete=0 才小流量宣称“可审阅成果” |
| V7 Review usability | 在成果中植入已知行为偏差/漏测/副作用 | 严重错误检出、review time、误接受 | 高严重度检出 ≥95%；P50 review time 有明确目标并优于基线 |
| V8 Privacy lifecycle | delete user/project/source；backup→restore；撤回会议同意 | 残留召回、embedding/summary/backup 残留 | 删除后 Pack/搜索/执行零召回；restore 仍尊重 tombstone |
| V9 Safety effects | secret files、network exfil、malicious package/hook、CI trigger | 越权 effect、secret exposure、policy bypass | 所有禁止路径 fail-closed；批准 effect 与 receipt 可一一对账 |
| V10 PMF baseline | VoiceLoop vs “普通语音+Paseo/Codex”随机/交叉实验 | time-to-package、first-pass acceptance、返工、人类分钟、7/30 日复用 | 至少一个核心 outcome 显著改善；否则降级为 transport/插件 |

阈值是建议起点，不是假装已有行业标准；应由 risk appetite 与真实 baseline 调整。关键是发布前先写退出线，避免看到漂亮 Demo 后移动门柱。

---

## 14. 建议优先级

### 现在（先于 UI/语音打磨）

1. ADR 收敛 VoiceLoop/Hopper owner 与 supersede 章节；
2. 定义 DecisionPackage、ApprovalReceipt、DispatchEnvelope、ResultReceipt；
3. 做 Hopper runtime capability gap list，不再用 M3a schema 名称代表已实现；
4. 建 readiness corpus 与 false-ready baseline；
5. 建 memory provenance/taint threat model；
6. 选定一个 coding wedge 和 Quick/Guided 两车道。

### 随后

7. text-first E2E + chaos/recovery；
8. durable approval/command/notification bridge；
9. review card + evidence-by-criterion；
10. 级联语音和 canonical transcript；
11. full/mini S2S 对照；
12. 小流量 shadow overnight，不自动产生外部 effect。

### 暂缓

多人会议、电话升级、自动巡检、通用多类型 executor、全自动 L0、动态多 agent、自动部署/发消息。这些会同时放大授权、合规、记忆污染和可靠性尾部，不会优先验证核心 PMF。

---

## 15. 来源链接与本地证据索引

### 15.1 本地方案与代码

- `voice-coding-framework.Cursor2.md`：§4.1 会话经济学/Context Pack（行 202-238）；§4.7-§4.10 审批、熔断、steer、数据模型（行 365-418）；§4.18-§4.20 Artifact/L0-L3/readiness（行 511-600）；§4.21-§4.22 隔夜与跨设备（行 602 起）；§15 六缺口。
- `business-flows.md`：主闭环（行 56-92）；Hopper 分工（§11，行 236-275）。
- `local-projects-borrowing-assessment.md`：Hopper 成熟度与改造点（§3-§5，尤其行 32-60）。
- `competitive-scan-2026-07.md`：原 6 缺口、竞品与 moat 判断（§2-§4，行 58-82）。
- `Hopper/src/runners/types.ts:38-48`：当前 adapter 只有 build/parse。
- `Hopper/src/runners/claude-adapter.ts:47-88`、`codex-adapter.ts:46-91`：当前一次性 CLI/终报路径。
- `Hopper/src/runners/capability.ts:39-87`：manifest 声明 resume 与实际 adapter API 的落差。
- `Hopper/src/schemas/platform/decision.ts:30-92`：digest/revision/expiry-bound Decision schema。
- `Hopper/src/schemas/platform/workflow.ts:1-106`：WorkflowDefinition 与 NotificationIntent 仍为 schema。
- `Hopper/docs/SCHEMA-FREEZE-M3A.md:36-54`：执行点不变量和未来 M3b/M3c/M3d consumer 义务。
- 本次定向测试：`npx vitest run test/unit/platform-schemas.test.ts` → `Test Files 1 passed (1)`、`Tests 25 passed (25)`、exit 0。

### 15.2 官方 API、产品与工程资料

- [OpenAI Realtime cost guide](https://developers.openai.com/api/docs/guides/realtime-costs)
- [OpenAI API pricing](https://developers.openai.com/api/docs/pricing#audio-tokens)
- [GPT-4o mini TTS model page](https://developers.openai.com/api/docs/models/gpt-4o-mini-tts)
- [Codex app-server lifecycle](https://learn.chatgpt.com/docs/app-server#lifecycle-overview)
- [Codex app-server repository documentation](https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md)
- [OpenAI: Work with Codex from anywhere](https://openai.com/index/work-with-codex-from-anywhere/)
- [OpenAI: Running Codex safely](https://openai.com/index/running-codex-safely/)
- [OpenAI: How agents are transforming work](https://openai.com/index/how-agents-are-transforming-work/)
- [Claude Code agent view](https://claude.com/blog/agent-view-in-claude-code)
- [Claude Code Auto mode](https://claude.com/blog/auto-mode)
- [Claude Cowork web/mobile](https://claude.com/blog/cowork-web-mobile)
- [Claude dynamic workflows](https://claude.com/blog/introducing-dynamic-workflows-in-claude-code)
- [Paseo](https://github.com/getpaseo/paseo) / [Paseo changelog](https://github.com/getpaseo/paseo/blob/main/CHANGELOG.md)
- [Happy](https://github.com/slopus/happy)
- [Orchestra Mobile](https://orchestracode.com/mobile)

### 15.3 论文与评测

- [From Chat to Interview: Agentic Requirements Elicitation with an Experience Ontology](https://arxiv.org/abs/2605.05828)
- [Ask or Assume? Uncertainty-Aware Clarification-Seeking in Coding Agents](https://arxiv.org/abs/2603.26233)
- [Quantifying Conversational Reliability under Multi-Turn Interaction](https://arxiv.org/abs/2603.01423)
- [From Untrusted Input to Trusted Memory](https://arxiv.org/abs/2606.04329)
- [Hidden in Memory: Sleeper Memory Poisoning](https://arxiv.org/abs/2605.15338)
- [MemPoison](https://arxiv.org/abs/2607.14651)
- [How Agents Ask for Permission](https://arxiv.org/abs/2607.13718)
- [AsyncVoice Agent](https://arxiv.org/abs/2510.16156)
- [τ²-bench](https://arxiv.org/abs/2506.07982)
- [METR Task-Completion Time Horizons](https://metr.org/time-horizons/)
- [METR: Clarifying limitations of time horizon](https://metr.org/notes/2026-01-22-time-horizon-limitations/)
- [METR Frontier Risk Report](https://metr.org/blog/2026-05-19-frontier-risk-report/)

### 15.4 明确未验证的范围

- 本会话未运行 Hopper 全量 unit/golden/e2e，仅运行 platform schema 定向 25 tests；全量计数只作为 commit message/本地文档事实，不作为本次实测。
- 未见 VoiceLoop 可运行实现、真实用户数据、成本日志或 prototype telemetry；因此所有 PMF、延迟、readiness 准确率和 overnight 成功率结论都标为待验证或推断。
- 在线产品与价格会变化；本报告只对 2026-07-22 检索到的页面负责，实施时应锁模型 snapshot/价格版本并持续复核。
- 本报告不是特定法域的录音、隐私或劳动合规法律意见；多人会议上线前需按目标市场另做法律评估。

---

## 16. 最终红队意见

VoiceLoop 最大的机会和最大风险是同一件事：它试图替用户完成“我是否已经把事情想清楚，可以把控制权交给 agent”这个元决策。若只是让一个会说话的模型自信地回答这个问题，产品会把聊天幻觉放大成真实副作用；若把它做成**有来源的项目理解、经校准的未知检测、版本化批准合同、独立验证和可恢复执行**，它才可能在语音与执行后端都商品化之后仍有价值。

因此建议的 go/no-go 不是“Realtime 能不能做”，而是：**能否在盲测中比普通 voice+agent baseline 更少误开工、更少返工、更快完成可靠审阅，并且经得住 memory poisoning 和 crash/replay。** 先证明这四件事，再扩大语音、记忆自动化和隔夜自主性。
