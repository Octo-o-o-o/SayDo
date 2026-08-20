你是对抗评审。只读任务,不改任何文件。

评审对象:/Users/wangyixiao/WorkSpace/OctoAgent/docs/product/2026-08-13-CLI供给扩容与画像融合方案-v1.md
实施仓:/Users/wangyixiao/WorkSpace/SayDo(main HEAD 4196613)

方案要点:把 gemini/qwen/kimi/opencode/copilot 五家 CLI 从"仅识别"升级为可选进推理槽的真实供给(cage/parser/slotResolvers/cliRuntime/contracts/探测策略五件套),前端把画像列表改为"列表即菜单"(detected 全列+行内「全用它」直达确认卡),方案卡区收窄为推荐位。

请对照仓内真实代码核验方案的可行性与漏洞,重点:
1. packages/daemon/src/config/cliCapability.ts(12 家目录/两层结构)、cliRuntime.ts(provider 词表+registry+自检)、validate.ts(SLOT_POLICY)、providers/byoa/(cage/parsers/runner/provider/billing)、slotResolvers.ts——方案的五件套清单是否漏了真实存在的第六件?新增 5 个 provider 词表值会波及哪些 switch/enum 校验点?逐个列出(含 contracts 包与测试 fixture)。
2. 对话槽恒 api+oneshot 豁免:新 provider 进 oneshot 路径还需要动哪里(dialogLoop、setup 自检、first-run 状态机)?方案说"复用现 envelope 零改动"是否成立?
3. 前端 SetupWizard.tsx/SupplyPicker.tsx/resourcePlans.ts:行内「全用它」复用 QuickConfigPlan 确认流,现有代码结构支持吗?generateResourcePlans 的 3 张上限与 fallbackResourcePlan 逻辑会不会与"推荐位"语义冲突?
4. 探测:cliCapability 的 authStrategy/modelStrategy 枚举扩展面;billing.ts 对新 provider 的计费假设。
5. 安全:五家新 CLI 的 cage 兜底(空隔离 cwd+prompt 禁令)对 gemini/qwen(会自发跑工具吗)是否足够?对照 codex tripwire 先例。
输出:编号 findings,每条标 A(阻断)/B(应修)/C(建议),给 file:line 证据;最后给整体裁决(可派工/需修订)。
