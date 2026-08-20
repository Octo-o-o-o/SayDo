# Codex 攒批评审 14:canonical 回写批 3(首发收口批)

> **Triage 总结(收口会话,2026-07-25;逐条独立核实后处置——评审在只读沙箱未跑成测试,全部指控经收口会话读码/跑测复核)**
>
> | # | 级 | 核实 | 处置 |
> |---|---|---|---|
> | #1a preauthorized 认证强度可伪造 | A | 属实(参数外传;但生产零调用,暴露=库函数层) | **已修** SayDo `e4b6ab3`:查库继承+无父 fail-closed+反例测试 |
> | #1b turn_ref 对 screen/push runtime_effect 过约束 | A(并入#1) | 属实但 fail-closed 方向、P0 无该路径,无实伤 | **注记不改表**:09 §9 DDL 行内注明 P1 随 additive 迁移放宽 |
> | #2 停靠 T 边调度未接线/transitionTask 非 CAS | B | 属实(parkAging 无生产调度;单线程+同步 SQLite 竞态窗口极小) | **登记上浮 owner**(功能建设,超收口边界;dogfood 前接线即可,72h 老化在 owner 日用场景 dogfood 期才有对象) |
> | #3a protected 替换语义 | A | 属实(e50668e 只修了 [] 顶默认,未做并集) | **已修** `e4b6ab3`:effectiveProtectedBranches 并集贯穿 contracts/policy |
> | #3b 项目层配置生产加载缺失(schema 无 project/git/verify/setup;mergeConfig 无生产调用) | A→B(重定级) | 属实;但当前无任何路径传入项目值 ⇒ 无运行时暴露("库+测试就绪、生产未接线"=staged 形态) | **登记上浮 owner**(接线属功能建设;защит面:并集修复后即使接线也无降级风险) |
> | #3c 备份保留期硬编码 30 | B(并入#3) | 属实 | **已修** `e4b6ab3`:每轮重读 [params].backup_retention_days |
> | #4 api observedModel 严格断言未兑现 | A | 属实(provider 只提取不拦;evaluator/thinking 消费端未校验;dialog 拦缺失不拦族——后者 p0-readback 已注记"评审跟踪") | **已修** `e4b6ab3`:openaiCompat 缺 model 即作废(canonical 义务在 provider 层),evaluator/thinking/dialog 天然继承;dialog 族校验保持"评审跟踪"登记(BYOA 侧 consume.ts 分档自始正确);§12-9 措辞已补分档括注 |
> | #5 params/invocation 测试锚虚 | B | 部分属实(assertParamSanity 存在但无直接测试;invocation 字段不全) | assertParamSanity 反例**已补** `e4b6ab3`;invocation 统一 finally 落账**登记**(结构改动随 dogfood 期) |
> | #6 切锁回写锚错位 + 05/ADR-001/模板未同步 | B | 属实(56d8b89=2/2,f03c637 补至 3/3;本收口会话自己写错的锚) | **已修**(文档批):09 锚勘误;05:49/ADR-001:14,74/两份模板同步 baseline.2 |
> | #7 reviewTask 返回字段名 status≠state | A | 属实(cancelTask 本就用 state,reviewTask 是孤例) | **已修** `e4b6ab3`:实现+测试统一 state,JSDoc"reject→failed"残留清理;09 §13 补三实体 scope 注 |
> | 横1 retryTask 缺状态机边 | B | 属实(§6.1 无 failed→running 边,实现绕状态机) | **登记上浮 owner**(canonical 语义级变更——补边或改派发流程需拍板;交接指令 §4-3) |
> | 横2 principal/decision 无 DDL CHECK | B | 属实 | **登记**(SQLite 加 CHECK 需重建表,成本>P0 收益;词表由 TS/zod 层承载) |
> | 横3 §2 protected 公式明示 | C | 采纳 | **已修**(文档批):§2 唯一公式 ∪ |
> | 横4 07/modules-e 旧口径与分档冲突 | B | 属实 | **已修**(文档批):两处改引 09 §11 规则 2 |
> | 横5 三种 rejected 实体 scope 注 | C | 采纳 | **已修**(文档批):09 §13 scope 区分注 |
>
> **A 级清零口径**:#1a/#3a/#4/#7 代码修复 + #1b 注记 + #6 文档修复;#3b 经核实重定级 B(无运行时暴露)。
> 登记上浮三件(#2 调度接线/#3b 项目层加载/横1 retryTask 边)= 功能建设或语义级变更,收口会话不擅自扩面。
> 修复后门禁:`just ci` 双矩阵绿(contracts 65 + daemon 344 passed | 1 skipped——skip 为并行会话新增 SAYDO_SLOW_E2E 门控慢测试,合法)。

> 模型:gpt-5.6-sol,effort=max(38 分钟,只读沙箱——vitest/嵌套 codex 因 EPERM 未跑成,全部结论来自读码,收口会话逐条独立核实后 triage)。
> prompt:`prompts/14-canonical-writeback-closeout.md`;日志 `logs/14-canonical-writeback-closeout.log`。
> 原始裁决:#1/#3/#4/#7 A 级,#2/#5/#6 B 级,横切 1/2/4 B + 3/5 C。**triage 与核实结论见文末附录(收口会话)**。

## 原始报告(全文)

我会按七处逐条做只读核验，证据范围覆盖 `docs/09`、相关 canonical 文档、`docs/adr/ADR-002` 以及 SayDo 实现与测试；同时按项目评审制度并行做互补复核。全程不修改文件、不提交。
关联证据已定位到实现与测试：目前最值得警惕的是项目层 `[git].protected` 的并集语义、`reviewTask` 返回字段名，以及若干测试锚点是否只覆盖相邻记账而未覆盖文档所称的审计字段。我继续做逐条机械对照，并会把“文档正确但实现未接线”和“文档自身矛盾”分开裁决。
已完成源码/文档的第一轮逐项比对；目前正在补做独立 Codex 只读复核，并等待另一位一致性审查的结论，之后会把硬伤与最小改法收敛成 1–7 条裁决。
证据说明：全程只读、未修改文件。目标 Vitest 在收集阶段因 `EPERM` 失败；Codex CLI 只读复核也因 `Operation not permitted` 未能初始化，以下未把它们冒充通过证据。

## 逐条裁决

#1|A级硬伤|docs/09-data-contracts.md:150-157,453-474；SayDo/packages/daemon/src/storage/ddl.ts:18-38；SayDo/packages/contracts/src/types/approval.ts:54-95；SayDo/packages/daemon/src/approvals/directMode.ts:69-101|DDL 与矩阵大部分等价，但“preauthorized 继承父 dispatch 收据 authStrength”没有被机械保证，另有一项反向过约束。|`issuePreauthorizedReceipt` 接受调用者传入 `parentAuthStrength`，不查询父收据，既可伪造更强认证也可默认降成 `voice_weak`；同时 DDL/TS 强制所有非预授权 `runtime_effect` 带 `turn_ref`，而 §3 只要求 voice，导致 screen/push 合法形态被拒。|新增 `parent_receipt_id` 或事务内查询唯一已消费父收据并内部复制认证强度，移除调用者输入；把 `turn_ref` 条件收窄到 voice，补父子不一致拒绝及 screen/push 无 `turn_ref` 正例。

#2|B级应修|docs/09-data-contracts.md:313-330；docs/04-key-mechanisms.md:182,190；docs/10-voice-ux-spec.md:56-78；docs/11-ui-spec.md:113-125；SayDo/packages/contracts/src/statemachines/task.ts:23-35；SayDo/packages/daemon/src/storage/dao/tasks.ts:65-83；SayDo/packages/daemon/src/approvals/parkAging.ts:20-47|跨文档、话术、UI 与状态机边一致，但运行时 T 边和 T/U 竞态尚未闭合。|老化扫描自身有状态 CAS，但通用 `transitionTask` 是先读后无旧状态条件更新，T 与 U 可相互覆盖；未见生产 30 秒定时器、`parkedAt/parkedDeadline` 落值或 `ageOutParkedTasks` 调度，现有测试靠 fixture 手工塞停靠字段。|状态转换改为 `WHERE status=from` 的 CAS 并定义“先提交者胜”；接入 30 秒转 blocked、原子写停靠期限、72 小时扫描及草稿回落，并补 T/U 并发测试。

#3|A级硬伤|docs/09-data-contracts.md:120-126,684-699,748；SayDo/packages/contracts/src/effects.ts:65-70,88-95；SayDo/packages/daemon/src/policy/engine.ts:70-78；SayDo/packages/daemon/src/tier1/gate.ts:46-51；SayDo/packages/daemon/src/config/types.ts:6-60；SayDo/packages/daemon/src/config/load.ts:16-50；SayDo/packages/daemon/src/index.ts:369-377|项目白名单不是与实现等价的机械合同，且 protected 默认集可被清空，形成安全降级。|`[]` 或仅 `["release"]` 会替换而非并入 main/master，使主分支 push 不再升 S3；配置 schema 没有 project/git/verify/setup，解析会静默剥除，`mergeConfig` 也无生产调用；备份执行仍硬编码 30 天，合法全局 `backup_retention_days` 同样不生效。|统一计算 `effectiveProtected = default ∪ project` 并贯穿 grant、risk、gate；增加严格 project schema 和生产加载/合并路径；备份读取合并后的全局参数；补空数组、自定义列表及全部禁键测试。

#4|A级硬伤|docs/09-data-contracts.md:725-727,748；SayDo/docs/adr/ADR-002-byoa-observed-model.md:14-22,38-45；SayDo/packages/daemon/src/providers/byoa/consume.ts:54-82；SayDo/packages/daemon/src/providers/openaiCompat.ts:58-83；SayDo/packages/daemon/src/index.ts:271-310；SayDo/packages/daemon/src/brain/tools.ts:64-78；SayDo/packages/daemon/src/evaluator/readiness.ts:153-158|09 与 ADR-002 的分档及 owner 语境限定本身一致；A级来自严格 API 运行时断言没有兑现，不是对固定族豁免本身拍板。|BYOA 固定族分档已实现，但 API 仅提取 `model`：dialog 只拦缺失、不校验 family；thinking 直接消费；evaluator 缺失时回退配置模型。§12-9 还笼统写“缺失即作废”，与 codex/claude 缺失豁免冲突。|建立统一 observedModel 门：api/cursor 缺失或族不符均作废并审计；codex/claude 仅缺失豁免、有值仍校验；同步收窄 §12-9 措辞并补 API 缺失/异族反例。

#5|B级应修|docs/09-data-contracts.md:742,748；SayDo/packages/daemon/test/storage-checks.test.ts:38-94；SayDo/packages/daemon/test/config.test.ts:317-362；SayDo/packages/daemon/test/provider.test.ts:93-121；SayDo/packages/daemon/test/byoa.test.ts:169-174；SayDo/packages/daemon/src/config/types.ts:59,80-87；SayDo/packages/daemon/src/providers/byoa/provider.ts:70-87|测试文件和多数大类锚点真实存在，但 params 与 invocation 两组新增断言没有真实闭环。|没有 low≥high、负值、字符串/NaN 等 `assertParamSanity` 测试，且当前 validator 本身只拒数值负数；`byoa.test` 只测 evidence digest，BYOA audit 缺 configured/routed 字段，API invocation 又只在有 usage 时记录；`edit(P1)` 也无直接重签链测试。|补 params 类型、finite、非负和水位正反例；所有调用统一在 finally 落 invocation，缺路由写 `unknown`；对 API/BYOA audit row 加集成断言并补 edit 链测试。

#6|B级应修|docs/09-data-contracts.md:340-368,653-661；SayDo/packages/daemon/test/p05b-fake-runner.e2e.test.ts:17-19,50-160；docs/05-roadmap.md:49；docs/adr/ADR-001-execution-layer.md:14,70；templates/saydo.config.example.toml:88,93-94；templates/saydo.config.dev.example.toml:66-67|baseline.2 SHA/tag、tag 对象 SHA 警告及 baseline.1 非缺省降级路径均正确，但证据归属和配套 canonical/template 尚未同步。|`git show 56d8b89` 的测试文件只有 2 个用例，当前第 3 个由后续 `f03c637` 加入，故 09:659 的“3/3，提交 56d8b89”锚错位；05、ADR-001 和两份被 09:602 引用的模板仍把 baseline.1 写成当前锁。|改成“56d8b89=2/2，f03c637=3/3”或只锚后者；把当前锁统一为 baseline.2，同时明确保留 baseline.1 仅作降级路径。

#7|A级硬伤|docs/09-data-contracts.md:776,781-783；SayDo/packages/daemon/src/tier1/operations.ts:35-37,103-114,139-180；SayDo/packages/daemon/test/tier1-operations.test.ts:153-177|三种状态值、状态边、取消链和 10 #34 均一致，但返回对象字段名仍违反唯一 Brain 工具契约。|canonical 要求 `{state:...}`，实现及测试全部返回/读取 `status`，且未找到 adapter；实现 JSDoc 和测试标题仍残留 `reject → failed`。ApprovalReceipt 的 `outcome=rejected` 是不同实体，无需联动替换。|实现与测试统一改为 `state`，清掉 `failed` 旧注释；在 §6.2/§13 加一句 Tier1 reject 与 Hopper `review_reject` 的范围区别。

## 横切发现

横切-1|B级应修|docs/09-data-contracts.md:317,329,784；SayDo/packages/daemon/src/tier1/operations.ts:234-250|§13 声称 `retryTask` 支持 failed/blocked，但 §6.1 没有 failed→running 边；实现直接绕状态机更新。|补明确的 re-drop/retry 状态边，或把 failed retry 改成重新派发流程，并补 failed 正例测试。

横切-2|B级应修|docs/09-data-contracts.md:131-145,453-474；SayDo/packages/daemon/src/storage/ddl.ts:18-38|`principal="owner"` 与 `decision` 词表只存在于 TS，DDL 无 CHECK，raw SQL 可写任意值，与“DDL 可直接执行、TS↔DDL round-trip”不符。|补 `principal='owner'` 及 nullable decision 词表 CHECK。

横切-3|C级建议|docs/09-data-contracts.md:120-126,684-699|§2 仅写“项目值、缺省 main/master”，§11 才写“与默认取并集”，机械实现者可能选择替换语义。|在 §2 直接写唯一公式 `effective = ["main","master"] ∪ project.git.protected`。

横切-4|B级应修|docs/07-tech-stack-decisions.md:235；docs/modules/e-crosscutting.md:9；docs/09-data-contracts.md:727|07 仍写 BYOA 缺 observedModel 一律作废，与 ADR-002/09 的固定族缺失豁免冲突。|在 07/E 引用 09 的 provider 分档，避免重复旧规则。

横切-5|C级建议|docs/09-data-contracts.md:350-352,422,781-783|Hopper 的 `review_reject→rejected→failed` 与 Tier1 `reviewTask(reject)→cancel_requested` 是不同路径，但当前仅靠上下文区分。|补显式 scope 注释；ApprovalReceipt 的 `rejected` 保持不变。
