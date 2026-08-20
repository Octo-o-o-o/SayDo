你是对抗评审。只读,不改文件。

评审对象:/Users/wangyixiao/WorkSpace/OctoAgent/docs/product/2026-08-13-向导快速配置UX重构方案-v1.md
实施仓:/Users/wangyixiao/WorkSpace/SayDo(main aa8034e)

背景:owner 首开实测给出七条反馈(方案 §0 对位表),核心=画像区从检测全景清单改为可用供给选择器。上一批(65 号评审+批 A/B)刚交付列表即菜单+推荐槽,本方案将部分推翻重构(推荐卡取消/确认弹窗取消/测一下移位)。

请对照真实代码核验,重点:
1. §1 Loading 门:SetupContext 的 loading/peeked 语义(packages/console/src/shell/SetupContext.tsx、App.tsx、SetupGate.tsx)——全屏 Loading 与现有 SetupGate/Banner/移动壳的关系,先渲染今天页的根因在哪,方案的门放哪层才真堵得住(含移动壳)?
2. §4 取消二层确认弹窗:现有确认流(choosePlan/selectedPlan/双 ack/writeSetupConfigStaged→四步进度)在 SetupWizard 里的结构——展开区内联确认+启动是否会破坏 T17/T18 的 first-run 状态机或 staged 写口约定?ack 内联后 requiredAcks 消费点是否完整?
3. §5 模型选择器:cursor 201 模型的搜索下拉性能与现有 models 数据结构;codex/claude 无枚举时 used/configured chips 数据从哪来(cliCapability models source);四槽联动与 provider 契约表(批 B 刚做的)如何配合;dev 槽「留空 · missing」的来源与修法。
4. §7 自动重试轮:probe 现协议(单次全量/缓存/confirm 端点)支持两段式吗?前端串行重试失败家用 confirm 端点逐家打是否等价;整体 ≤15s 预算是否现实(参考实测:首轮并行 max≈3.5s,confirm 单家真实一发约 20s——**方案的 8s 重试预算与 confirm 的 20s 实测矛盾,请裁决**)。
5. §2/§3 只列可用+推荐卡取消:resourcePlans 刚交付的推荐槽/plan factory 退役面;「无任何可用供给」引导态与现有无 key 说明卡/api 表单的关系;API 直连作为列表一员时 key 表单放哪。
6. 兼容:「先随便看看」逃生门;配置已完成用户;mobile 壳的 Loading 门。
输出:编号 findings(A/B/C+file:line 证据),终裁(可派工/需修订+条件)。
