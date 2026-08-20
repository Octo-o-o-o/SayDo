# 七步闭环补全方案(现状 → 缺口 → 分批落地)

> 产出:Claude Fable 5,2026-08-20;依据 = 本日 Docs 内容稿事实核对(`docs/site/2026-08-20-docs-page-content.fable.md` §C.1 / §C.5)+ 两路 Explore 子代理接缝梳理(坐标经本会话抽查)+ 方案/合同文档(`docs/04` §2.4/§4/§5.4/§1.2、`docs/09` §2/§6.3/§13、`docs/10` #10/#12/§2.4、`docs/07` D3/D14/D18)。
> 目的:owner 问「七步里的其他内容现在是什么状态,能否尽快补全」。本文逐项给 状态 / 缺口 / 落地设计 / 验收锚 / 分批,并作为后续 IMPL-PROMPT 的方案源。零 emoji;状态词纪律。
> 分工:我调度;实施 = Grok 4.6 headless(独立 clone);评估 = 零上下文只读会话(Codex 链头,配额不足回落 Grok)。

## 0. 七步逐项状态总表

| 步 | 官网口径 | 现状(代码事实) | 缺口 | 处置 |
|---|---|---|---|---|
| 1 开口聊 | 按住说话 / 打字;随口记录立刻进账;采访式一次一问 | 全链可用:PTT/免手/说完了、`proposeObligation` 当轮落账(偶发降级 remember)、采访纪律在 instructions | 无阻塞缺口 | 不立批 |
| 2 就绪决断 | 火候够了主动提议;规格是它的产物 | 类型就绪清单 + 规则层 + 异族深评 + 复述确认绑定 全可用 | 无 | 不立批 |
| 3 决策包 | 成果预览 + 实施计划 + **轻量 Demo** | 预览 / 计划 / 成本 / 风险 / 验收标准可用;**Demo 生成器 `renderPackageDemo` 已落地但生产无调用方,`demoRef` 恒空** | Demo 接线:产出 → 产物库 → 控制台 iframe 沙箱 → 话术「小样放屏幕上了」 | **批 S1(Demo 接线)** |
| 4 你拍板 | 说「就这样」;合并交付永远人拍板 | 拍板链可用;**执行模式只有逐步确认,直达验收档语音链 `direct_mode_not_wired`** | 直达档 = 预授权清单念读签署 + 门内 `matchGrant` 消费 | **批 S3(直达验收档)**——安全面最重,排最后 |
| 5 后台执行 | worktree 隔离;命令过门;三熔断 | Cursor 执行器全链可用;Claude Code 执行器 W5.4 进行中 | 执行器多样性(Claude / Codex) | W5.4-a/b/c(已开批)+ 后续 Codex |
| 6 办完叫你 | 说「等你验收」;升级链 语音回叫 → 桌面通知 → 手机推送 | `ready_for_review` 口径与 outbox 可用;**只有 ntfy 真投递;L0 语音回叫未接(仲裁函数无调用方);L1 桌面通知零代码** | 桌面通知(osascript)+ L0 在线语音回叫 + 输出仲裁接线 | **批 S2(回叫通道)** |
| 7 验收沉淀 | 口播摘要 + 证据视图;点头合并;知识留存 | 证据视图 / 三层摘要 / Touch ID 合并 / 人工核验 / 会后提名 全可用 | 无阻塞缺口(Touch ID 真人过卡待 owner 触点) | 不立批 |
| (卖点)先吃透再办事 | 「先深度研究透」 | 奠基 = 机械管道(清单 + 摘录 + 四文档 + AGENTS 指针),**无 LLM 深研** | 沉思档深研档:在机械底座之上由沉思档生成带 provenance 的理解层 | **批 S4(奠基深研)** |

## 1. 批次顺序与理由

`S1 Demo 接线` → `S2 回叫通道` → `S4 奠基深研` → `S3 直达验收档`。S1/S2 是纯接线(零合同变更或 additive 补录),风险低、见效快;S4 涉及记忆 provenance 纪律,需合同先行一小段;S3 触及授权安全面(预授权收据、念读签署、门内消费),必须在 Claude 执行器 seam 稳定、且 Codex 对抗评审可用后做。W5.4(Claude 执行器)与 S1/S2 并行不冲突(文件面不重叠:S1 在 packages/factory + console 决策包卡 + demo;S2 在 callback/ + index.ts sweep + console 通知;W5.4-a 在 tier1/backends + spikes)。

## 2. 批 S1 · 决策包 Demo 小样接线(IMPL-PROMPT-12)

**现状事实**(接缝梳理,坐标经抽查):唯一组包点 `brain/liveTools.ts` proposeStart(`:832-846`)→ `packages/factory.ts assemble()`(`:66-83`,先写 `plan` artifact 再 `sign()`);`sign()`/`revise()` 的字段列表**都漏 `demoRef`**(`:133-150`/`:88-103`),但 `computePackageDigest` 把 `demoRef` 纳入签名域(`contracts/src/digests.ts:40`);`decision_packages` 其余字段进 `body_json`(无需 DDL);artifact 类型枚举已含 `demo`;`ArtifactStore.write` 自分配 id、路径写死 `.md`(`store.ts:38-44`);无读 artifact 原文的 HTTP 端点;`renderPackageDemo` 纯确定性、含 `pkg.digest` 行且误读 `cost.expected.amount`(应为 `.value`,R-A8);`DecisionPackageCard` 在 Focus 页因 `lookups.packages` 恒空而不可达,`TaskDetail` 可达;"放屏幕上了"话术门 `dialog.ts:973-992` 只认本轮 `screen_text` 投递成功。

**裁决**:
- D-S1-1 **机械小样**(A6 决策包工厂确定性渲染),不走沉思档 LLM;随批回写 `docs/07` D14 那句为"Demo HTML 由决策包工厂确定性渲染(与 08 §R4 归属一致);沉思档生成为后续增强"。理由:同源可机械保证、零成本零延迟、不引入新 provider 合同。
- D-S1-2 先有鸡还是先有蛋:**Demo 从不签名的草案渲染**(`renderPackageDemo(draft)`,HTML 不含 digest,保留 revision 与 plan.seq 互引),`assemble()` 顺序 = 写 plan artifact → 渲染 demo → `artifacts.write({type:"demo"})` → 带 `demoRef` 签名;`revise()` 同法重渲染(新版本 supersedes 旧版本)并把 `demoRef` 纳入 merged。
- D-S1-3 存储:`ArtifactStore` 按类型选扩展名(`demo` ⇒ `.html`,其余维持 `.md`),只影响新写入。
- D-S1-4 读取:新增 `GET /api/artifacts/:id/versions/:version`(返回 `{artifact, content}`,项目归属断言 + digest 重校,`via` local/tailnet 可读、mobile_lan 不放行);控制台用 `iframe srcdoc` + `sandbox=""`(零 allow,禁脚本)渲染,不把 token 放 URL。
- D-S1-5 呈现:`TaskDetail` 决策包区与 `DecisionPackageCard` 增「看小样」;`proposeStart` 返回值带 `demoRef`,并在本地 console 在线时同轮 `sendScreenText`「小样已放到屏幕:{title}」,使 10 #10 的「我做了个小样放屏幕上了」能过话术门(不改门)。
- D-S1-6 修 R-A8(`.value`),补单测。

验收锚与门禁见 IMPL-PROMPT-12。

## 3. 批 S2 · 回叫通道(L0 语音 / L1 桌面 + ntfy / ack / 分级)(IMPL-PROMPT-13)

**现状事实**:sweep `index.ts:3405-3444` 15s 周期,只按 `created_at` 取 pending、只投 ntfy、不看 `escalation`、不调 `arbitrate()`;`ESCALATION_CHANNELS {0:voice,1:desktop+ntfy,2:phone}` 零调用方;`escalateIfStale/ack/resolve` 零生产调用方(条目永停 `notified`);`freezeForTask` 仅停靠老化调用;`say()` 闭包(`index.ts:2260-2273`)无 pipeline 时回落 console 文字气泡;console 会话常驻可被主动 `say`;`reconnectFirstLine` 七 trigger 齐;`arbitrate(pending,{voiceBusy,micHeldByMeeting})` 纯函数;`micHeldByMeeting` 无数据源;桌面通知零代码;DND 在 sweep 与 engine 双判;console 只轮询 30s。

**裁决**:
- D-S2-1 分级选路:sweep 改为"按优先级与级别选路":level 0 = 语音回叫(条件:该任务所属项目有 console peer 在线 **且** pipeline TTS 健康 **且** 不 voiceBusy;经 `arbitrate`);不满足 ⇒ 直接 level 1。level 1 = 桌面通知(`osascript display notification`,标题 `SayDo · {项目}`,正文经 `redactText`,spawn detached)+ ntfy(现状);任一成功 ⇒ `notified`(`escalation=1`)。level 2(电话)不做,保持 `escalation` 上限 1 并如实注释。
- D-S2-2 L0 语义:`say(reconnectFirstLine(trigger,title) + one_liner?)` 直发(不经 dialog 出句管线,避免结果句式闸误拦;origin=`callback`);置 `notified(escalation 0)` 并启动 30s 应答窗;窗内该 session 出现用户轮 ⇒ `ack`;否则 ⇒ 升级到 level 1 再投(`escalation 0→1`)。无 pipeline 的纯文字 console ⇒ 不算 L0,直接 L1,但同时 `sendConsoleSay` 一条文字气泡(不改状态)。
- D-S2-3 DND:收口到一处(engine `deliveryPreflight`);窗口内**只推送不出声**:发 ntfy 低优先级(2)一次并 `snoozed_until=窗口末`,状态保持 pending(`meta.dnd_pushed`),窗口结束按正常链补叫;桌面通知与语音在窗口内不发。
- D-S2-4 ack / resolve / 冻结:新增 `POST /api/outbox/:id/ack`(local/tailnet)+ Notify 页「知道了」;`ack` 后 `callback_resolution_timeout_min` 未 resolve ⇒ `requeued` ⇒ sweep 再投 level 1(`escalateIfStale` 接线);任务离开 `ready_for_review`(approve/reject/request_changes/cancel)与 blocked 被 retry/answer 消解 ⇒ `resolve`/`freezeForTask`(补 R-B6 半边)。
- D-S2-5 `micHeldByMeeting` 恒 false(无数据源,如实注释;console 不出「开会不打扰」承诺)。
- D-S2-6 不新增 WS 事件类型;console 轮询从 30s 收到 10s(仅 outbox/attention)。

验收锚与门禁见 IMPL-PROMPT-13。

## 4. 批 S4 · 奠基深研档(方案先行,暂不开批)

**现状事实**:`foundation.ts` 机械管道,`bootstrap()` 同步、无 provider 位;四档知识文档**不进账本也不进 Context Pack**(pack 只装账本事实;`core.md` 唯一消费者是备份与 AGENTS.md 指针);奠基唯一入口 = 项目设置页按钮(`POST /api/projects/:id/foundation/bootstrap`),会话预热不触发;`learning` 是死状态;换代使 knowledge 轴就绪绑定失效(用户要重确认 #44);BYOA 沉思档输入 256KB 硬墙、120s wall、空目录无工具笼;`readonlyFoundation` 只读例外笼只有 claude_cli 形态且未接线;LLM 产出按 §1.4 必须 `agent_output` ⇒ candidate。

**结论**:深研档不是"接线",是带合同变更的新能力,需要方案文档(合同先行):① 深研产物落点(建议 = 多条带 provenance 的 candidate claim 入账本 + `understanding.md` 文件投影,**不**改 Context Pack 编译器签名域);② 分片与预算(256KB/120s 下按关键文件分片多次一发一收,`retryBudget` 与幂等);③ 触发时机(只在项目设置显式触发,不自动;UI 明说"换代后需重新确认代码理解");④ `learning` 进度通道;⑤ `[params]` 新键与 `docs/09 §11`/`docs/modules/b-memory.md` B3 回写;⑥ owner 拍板的 provenance 定级(candidate 需人批 vs 机械事实)。排在 S1/S2 与 W5.4-a 之后立方案。

## 5. 批 S3 · 直达验收档(方案先行,暂不开批)

**现状事实**:组包恒 `step_confirm` + `preauthorizedEffects: []`(`liveTools.ts:842-843`),语音拍板环 `direct_mode_not_wired`(`:930-937`);`matchGrant/issuePreauthorizedReceipt/InterceptCounter/renderGrantChecklist` 零生产调用;`deriveGrants` 只有注释(`policy/engine.ts:6`),而计划是自然语言 step ⇒ **推导源不存在**;`executionModeDefault` 存了读了从未被 proposeStart 消费;console 卡的二选一 UI 已按 canonical 做好但无 daemon 写口;`validateDispatch` 契约校验器在生产链无调用(散装检查双实现);带 `ci_preview` 的 push grant 会把包风险算成 S3 ⇒ 语音拍不了板。

**结论**:需要方案文档先拍板:① `deriveGrants` 输入合同(起草模型输出结构化 `intendedEffects[]` 原料 → 引擎白名单化 + 约束补全 + `renderSpoken` 重渲染 + digest,Brain 的 spokenForm 丢弃重算);② 模式二选一封闭词表(10 新增锁定档)与两段确认状态机(选档 → 念清单 → 签署);③ 最小可行切片 = **屏幕签署**(console 写口 + `executionModeDefault` 被消费 + 门内 `matchGrant`),语音念读第二切片;④ `validateDispatch` 收敛单实现;⑤ 09 §2/§3 口径统一。排在 W5.4 三批之后。

