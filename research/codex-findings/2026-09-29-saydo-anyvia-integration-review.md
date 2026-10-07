YELLOW（修订后可进入）——最大的单一风险是：消费方若直接挂入现有 L1 sweep，旧通道发送成功后，Anyvia 的未受理交接可能失去后续调度，留下持久记录却不再发送。

本报告仅审查当前工作树材料及源码，未修改文件，未运行候选文档中的命令、测试或实施流程。下文 `S/` 指 SayDo 仓根，`A/` 指 相邻 `Octoooo/` 仓根；路径后的数字为实际核对行号。发现的 A/B/C 级表示修订优先级，括号注明所属判断维度。

**1. 固定核验清单**

| # | 结果 | 核验事实与依据 |
|---|---|---|
| 1 | **成立** | `/v1/events` 调用静态 Bearer 校验；配置来自 `OCTO_SOURCE_TOKEN`。客户端 `source` 被拒，服务端写死 `sourceId:"webhook"`。1.1.0 白名单为 title/body/correlation_id/urgency/sensitivity/presentation_request/actions，旧协议只接受前三项。`correlation_id` 非唯一索引，没有按它查重；每次成功创建返回 201。依据：`A/apps/gateway/src/gateway.ts:1131`、`:1158`、`:1177`、`:2767`；`A/apps/gateway/src/config.ts:285`；`A/apps/gateway/src/store.ts:643`。 |
| 2 | **部分成立** | 创建与路由**不在同一事务**。真实链路为 HTTP → `createAndDeliver` → `ActivityService.create` → 事务内 `createInTransaction` 写 Activity/events → 提交后 `publishCreated` → `deliverCreated` → routing/WS/native push/ntfy。启动恢复处理 attention intent、presentation job，并未为普通 `/v1/events` Activity 补建同等责任。Activity 仍可被查询、同步，不等于恢复了原路由投递。依据：`A/apps/gateway/src/gateway.ts:2276`、`:2286`、`:625`、`:679`、`:783`；`A/apps/gateway/src/modules/activity/application/service.ts:85`、`:148`；`A/apps/gateway/src/modules/attention/application/service.ts:78`；`A/apps/gateway/src/modules/presentation/application/service.ts:79`。方案将此标为未核实是诚实的；现在可明确为需要补齐的边界，未做崩溃实测。 |
| 3 | **部分成立** | 可实现，但来源登记与现有授权的衔接没有冻结。凭据解析应落配置/认证适配层，受理与幂等落应用用例，账本/代际落 SQLite adapter，装配在 composition，恢复接 `quarantineRestoredWork`。`sourceId` 除格式外还必须通过 Provider inventory；现有 `management_switches` 又持有来源 enabled，不能新增独立开关后忽略它。现有迁移是 `Store.migrate()` 加各 repository 构造期 DDL，未看到已完成的统一版本迁移注册器。设备 TLS 和 relay 均为显式白名单，新路径目前不在其中。依据：`A/protocol/src/contracts.ts:268`；`A/apps/gateway/src/gateway/composition.ts:26`；`A/apps/gateway/src/modules/authorization/application/service.ts:120`；`A/apps/gateway/src/adapters/sqlite/authorization.ts:41`；`A/apps/gateway/src/store.ts:577`；`A/apps/gateway/src/adapters/sqlite/restore.ts:4`；`A/apps/gateway/src/device-ingress.ts:19`；`A/apps/gateway/src/device-relay.ts:20`。 |
| 4 | **部分成立** | 字段枚举一致：urgency 四值、sensitivity 两值、presentation_request 三值；Activity actions 最多 3 项 choice，B1 固定空数组是合法收窄。source 必须为 `{id,kind:"source"}`，id 匹配 `^[a-z0-9][a-z0-9-]{1,62}$`，且运行时还要 inventory allowlist。title/body 上限一致。现役 validator 会补缺省值，不能直接承担 B1 的严格解码。依据：`A/docs/contracts/activity.schema.json:32`、`:117`、`:130`；`A/protocol/src/contracts.ts:243`、`:268`。当前 schema 权威已在 `protocol/docs/contracts`，根 docs 是镜像，见 `A/docs/architecture-development.md:34`。 |
| 5 | **成立** | 提供方列出的 `gate`、`test:architecture-package`、`test:delivery` scripts，以及两个具名脚本均真实存在。依据：`A/package.json:30`、`:34`、`:41`；`A/scripts/r6-isolated.py:1`；`A/scripts/check-architecture-boundaries.ts:1`。不过当前完整指南还要求 workspace 包测试及完整边界检查，见发现 B5。命令未执行。 |
| 6 | **成立** | 本次文件存在性检查确认 Anyvia 仓根没有 `AGENTS.md`。入口是 `CONTRIBUTING.md`、`docs/README.md`、`docs/architecture-development.md`，并继续指向合同、交付和 AF 执行记录。依据：`A/CONTRIBUTING.md:3`、`:13`；`A/docs/README.md:7`、`:13`；`A/docs/architecture-development.md:7`。 |
| 7 | **部分成立** | B1 业务方向没有被模块化方案禁止，也没有证据要求等整个 AF00–AF08 结束；但 AF02/03/04 正在同时迁移合同、应用/存储及 transport。新增业务不能继续堆进 gateway bootstrap，也不能维护根 src 或 docs/contracts 的第二份实现。提供方仅要求“读当前记录”，尚缺明确落点与候选交接条件。依据：`A/docs/plan/2026-09-29-modular-open-source-foundation.md:70`、`:82`、`:86`；其 `-IMPL-PROMPT.md:43`；`A/docs/review/2026-09-29-modular-foundation-execution.md:17`。 |
| 8 | **部分成立** | `ESCALATION_CHANNELS[1]` 仍只有 desktop/ntfy，但实际 sweep 已有 desktop、ntfy、email；应以真实接线为准。`postNtfy`、`sendEmailSmtp` 均为 `Promise<boolean>`。outbox 状态为 pending/notified/acked/requeued/resolved，DDL 另有 resolution、escalation、各时间列，v32 增 thread_message_id。唯一索引只覆盖活跃态，**不存在同一 occurrence 永久只入队一次的约束**。依据：`S/packages/daemon/src/callback/engine.ts:51`；`callback/sweep.ts:381`；`callback/ntfy.ts:80`；`callback/email.ts:346`；`storage/ddl.ts:173`、`:828`；`S/packages/contracts/src/types/outbox.ts:19`、`:49`。 |
| 9 | **部分成立** | ready_for_review：`tier1/executor.ts:3132`。failed/blocked：`:3438` 经 `enqueueBlocked`，实际 enqueue 在 `:3503`；无工作区 blocked 还有 `:1658` 的调用。blocked 另有 `live/scheduler.ts:82` 的步界超时生产者。**未找到 approval_request 的生产入队点**：存在仲裁和邮件枚举、审批审计，以及只返回 shouldCallback 的计数器；这些均不是 enqueue。依据：`S/packages/daemon/src/tier1/approvalFlow.ts:173`；`approvals/directMode.ts:129`；`callback/arbitration.ts:12`；`callback/email.ts:17`。消费方“不补造生产者”的限制正确，应明确首批该类未接线。 |
| 10 | **部分成立** | 具名源码路径均存在；deliveryPreflight 是 `recovery/reconciler.ts:102` 的函数，并非独立模块。`docs/03`、`docs/04` 是简写，真实文件是 `03-architecture.md`、`04-key-mechanisms.md`。remote-forbidden 是行为范围，真实测试包括 `test/t2-thin.test.ts:193`、`test/mobile-lan-process.test.ts:122`。canonical 定位：回叫/ACK/升级在 `S/docs/09-data-contracts.md:645`，DDL 在 `:912`，恢复要求在 `:1990`，远程通道限制在 `:1914`。泛称“开发/测试指南”未指向唯一文件。 |
| 11 | **部分成立** | 方案列出的 12 个 kind 与源码完全一致；ledger 接受终局是 accepted，没有 consumed。依据：`S/packages/contracts/src/types/confirmation.ts:14`、`:25`、`:46`。实际倒计时调用覆盖 focus_create_anchor、focus_anchor、focus_obligation_resolve、focus_obligation、focus_lane_split、expectation_ack，见 `S/packages/daemon/src/brain/liveTools.ts:1803`、`:1883`、`:2010`、`:2364`、`:2575`、`:2655`；未见 focus_revision 或五个非语义 kind 的调度调用。恢复仅重建 pending、重发卡片，方案“重启重新挂倒计时”的事实陈述不成立，见 B2。 |
| 12 | **部分成立** | PG-01B 的远程业务拒绝、DF-REMOTE-REOPEN deferred、身份门成功返回 owner 均属实。依据：`S/packages/daemon/src/net/identity.ts:158`；`net/remoteSurface.ts:33`；`index.ts:958`、`:3195`；`S/docs/plan/IMPLEMENTATION-PLAN-2.md:65`。B1 只出站通知，不需因此重开远程业务。消费方承认 PLAN-2 和 supervised-delivery，方向相容；但 canonical 更新排在实现后，与 AGENTS 冲突。当前链 `active=none,next=PG-02`，没有 SAYDO-ANYVIA-B1，仍须具名导入；见 PLAN-2 `:10`、`:25`，以及发现 A4。 |

两份 prompt 的 PUT/GET 路径、请求字段、成功响应、错误码、JCS 摘要和“未知后查询、原 ID 重传”规则相互一致，未发现需要改协议才能互通的直接冲突。主要问题是这些规则尚未完整落到两仓现有生命周期上。

**2. 发现列表**

**A 级：必修**

**A1（合同缺陷、可执行性）：来源凭据配置没有接通现役 inventory 与来源停用权威。**

- 所在：提供方 §3“来源身份”，`S/docs/plan/IMPL-PROMPT-2026-09-29-anyvia-b1-provider.md:90`。
- 问题：prompt 只规定稳定 sourceId 的合法格式及配置 enabled。按这个最低要求实现，新增来源即使认证成功，也可能在创建 Activity 时失败；若仅检查新配置 enabled，则可能忽略现有管理面已停用的来源。
- 依据：`A/protocol/src/contracts.ts:280` 实际判定：

  ```ts
  if (allowlisted === null || sourceId === null || !allowlisted.has(sourceId))
  ```

  Activity 创建必经该 validator，见 `A/apps/gateway/src/modules/activity/application/service.ts:118`。现有来源停用权威在 `modules/authorization/application/service.ts:120` 和 `adapters/sqlite/authorization.ts:73`。
- 建议最小修改文字：

  > 来源配置必须对应现行 inventory 中 allowlisted 的 Provider；凭据映射不得绕过该校验。有效启用状态同时受来源凭据配置和现有来源管理开关约束。使用临时 inventory 与两个测试来源验证；缺登记、管理面停用或凭据停用均不得创建 Activity，旧来源校验不放宽。

**A2（合同缺陷）：缺少“旧通道成功后，Anyvia 交接仍继续推进”的具体接线约束及验收。**

- 所在：消费方 §3、§6、§7，分别见消费方 prompt `:79`、`:218`、`:274`。
- 问题：已有“不能抑制旧升级链”“持久重试”的原则，但未说明新交接如何摆脱原 outbox 的待投递筛选。最直接的 sink 接线会出现：桌面成功，Anyvia 请求未到达或结果未知，原行成为 notified/escalation=1，后续 sweep 不再取它，Anyvia 永久停住。反过来把 Anyvia accepted 纳入旧 boolean 成功汇总，又违背仅更新本通道状态的要求。
- 依据：[现有 L1 资格判断](../../packages/daemon/src/callback/sweep.ts)只接受 pending/requeued，或 escalation=0 的 notified；同文件 `:425` 在旧通道成功后写 notified 并升到 L1。
- 建议最小修改文字：

  > Anyvia 交接记录形成后，由本通道持久状态独立调度，不以 callback_outbox 仍被旧 L1 sweep 选中为条件；Anyvia 结果不参与旧通道成功布尔汇总。每次新 PUT 仍核原事项有效性，未知交接保留 GET 核对。新增测试：桌面成功且 Anyvia 未到达/响应丢失，原 outbox 已 notified/escalation=1，随后恢复网络及重启后仍能按原 ID 收敛，旧通道状态不被改写。

这是实施风险推导，不是宣称尚不存在的 B1 代码已经发生丢通知。

**A3（合同缺陷）：occurrence 与 entry 混用，永久幂等键未明确。**

- 所在：消费方 §6，消费方 prompt `:221`：“原 callback occurrence/entry”，以及 `:225` 的最多一个 Activity 承诺。
- 问题：按 entryId 建唯一交接只能抵御同一行重复 sweep。同一 dedupeKey 的旧行 resolved 后，现有索引允许再次入队并生成新 entryId；新交接若分配新 deliveryId，会在 Anyvia 创建第二条。
- 依据：[DDL 活跃唯一索引](../../packages/daemon/src/storage/ddl.ts)：

  ```sql
  CREATE UNIQUE INDEX outbox_active_dedupe ON callback_outbox(dedupe_key)
    WHERE state IN ('pending','notified','acked','requeued');
  ```

  `callback/engine.ts:95` 每次创建新 `ntf` ID；`packages/contracts/src/types/outbox.ts:49` 明确完整业务去重键组成。
- 建议最小修改文字：

  > B1 occurrence 身份使用原生完整 dedupeKey，不能仅使用 occurrenceKey 或 outbox entryId。对同一 occurrence 保留唯一交接身份及墓碑，即使旧 outbox 已 resolved 后再入队，也不得分配新 deliveryId；真正的新 occurrence 才可新建。新增“终局后相同 dedupeKey 重入队”测试，不修改旧 outbox 的活跃唯一语义。

**A4（可执行性）：消费方把 canonical 更新放在实现之后。**

- 所在：消费方 §7，步骤 B–F 在前，步骤 G 才更新 docs/09，见消费方 prompt `:274`、`:299`。
- 问题：无上下文 agent 顺序执行，会先写通道类型、持久状态和迁移，再补合同，违反项目明确前置。顶部仅提 supervised-delivery，不能消除正文顺序冲突。
- 依据：[AGENTS.md:16](../../AGENTS.md)要求先改 canonical 并完成相应一致性评审，再改代码。
- 建议最小修改文字：

  > 步骤 A 后、任何实现前，先把冻结外部合同映射、本通道状态、occurrence 唯一键、启用边界、恢复与调度语义写入 docs/09，并按本仓规则完成一致性评审。通过后进入步骤 B；步骤 G 只核对文档与最终实现一致。

**B 级：应修**

**B1（遗漏）：首次启用是否补发旧通知没有进入消费方执行合同。**

- 所在：方案 §12，方案 `:180`；消费方 §5–§6。
- 问题：方案建议“不自动回填”，但仍列为 owner 待决；消费方没有默认策略或缺决定时的停止条件。现有 sweep 会读取已存在的 pending/requeued，启用新 sink 可能立即外发旧事项。
- 依据：`S/packages/daemon/src/callback/sweep.ts:110`、`:227`；消费方 prompt `:260` 只覆盖重启和旧库恢复，没有覆盖首次启用。
- 建议最小修改文字：

  > 首次启用默认不回填历史 occurrence，持久记录启用边界；已有交接可按原 ID 恢复，新启用不得为边界前事项补建交接。历史补发另行具名授权。若 owner 尚未采纳该默认，只实现默认关闭候选，不启用通道。

**B2（事实错误）：方案把自动接受倒计时的恢复风险写成了当前行为。**

- 所在：方案 §5 上线前置第 3 项，方案 `:89`。
- 问题：“重启或恢复后会重新挂倒计时”不符合当前代码。倒计时保存在内存 Map，启动恢复没有重新调度它。持久限制外部来源仍是合理的未来合同，但依据应改准确。
- 依据：`S/packages/daemon/src/live/dialog.ts:1399`；`live/confirm.ts:1653` 恢复后调用 onPresent；`index.ts:2654` 的 onPresent 只发送 confirm.card，`:3219` 调用恢复，没有挂计时器。
- 建议最小修改文字：

  > 当前自动接受倒计时只在六类已接线语义提案的生产路径调度，重启恢复只重建 pending 并重发确认卡。第二阶段仍须持久保存外部来源的禁止自动接受属性，并在提案、自动接受入口和恢复路径统一检查，防后续重新呈现或调度绕过。

**B3（可执行性）：Anyvia 模块化在途，B1 缺明确落点和接续基线。**

- 所在：提供方 §2，提供方 prompt `:44`、`:52`。
- 问题：没有必然架构冲突，但“新增网关入口”仍可能被解释为在大 gateway.ts 内继续加入 SQL、认证配置和业务逻辑；“contracts canonical”也没有明确当前已经迁移。
- 依据：`A/docs/architecture-development.md:7`、`:34`；模块化方案 `:70`、`:82`、`:86`；AF 执行记录 `:20` 标明 AF02–AF04 仍在途。当前 `gateway/activity-http.ts:6` 已有具名 HTTP 入口登记，可沿用模式。
- 建议最小修改文字：

  > 基于 AF 执行记录指定的固定候选接续；重叠文件仍由在途任务修改且未交接时停止相关施工。schema/validator 维护于 protocol 权威目录；新 HTTP adapter 只认证解码与调用用例，受理用例及 repository 分层，composition 只装配。更新入口清单、恢复及 worker 启停登记，不要求等待全部 AF 阶段结束。

**B4（可执行性）：消费方的 lint 命令与当前仓脚本布局不匹配。**

- 所在：消费方 §8，消费方 prompt `:313`。
- 问题：列的是 `pnpm -r lint`，实际 lint script 在根 package.json；本次检查子包 package.json 未找到 lint script。这不是可靠的根 ESLint 入口。
- 依据：`S/package.json:12` 是 `eslint packages e2e/journey01-browser`；`S/justfile:13` 调用的是 `pnpm lint`。
- 建议最小修改文字：

  > 将 `pnpm -r lint` 改为 `pnpm lint`；递归 typecheck 与两个具名 test 命令保留。

**B5（可执行性、遗漏）：两份 prompt 的具体门禁列表容易漏掉现役 required 项。**

- 所在：提供方 §6、消费方 §8。
- 问题：虽然都写了“当前 required gates”，但列出的具体清单不完整。Anyvia 单跑旧 `check-architecture-boundaries.ts` 不包含新的 workspace import/export 检查；SayDo 的 `just ci` 不包含项目 profile 要求的 Playwright。
- 依据：`A/CONTRIBUTING.md:13`；`A/package.json:44`、`:45`。SayDo `.octoworkflow/project-profile.md:67` 明列 `just ci` 和 `pnpm exec playwright test`。
- 建议最小修改文字：

  > Anyvia 清单补 `pnpm test:workspace-packages`，以 `pnpm check:boundaries` 执行完整边界门。SayDo 清单补 profile 要求的 Playwright 门；环境未获授权时记录未运行，不将其它门通过当作替代。

另外，`A/scripts/r6-isolated.py:7` 只移除 OCTO_/DOTENV_ 环境变量，并不自动隔离 HOME 或所有凭据。保留 prompt 中“先读脚本并确认临时数据根、假凭据”的要求，不能仅凭 runner 名称认定完全隔离。

**B6（遗漏）：资源限额仍是原则，缺可判定验收。**

- 所在：方案 §4.3 `:62`；提供方 §3 的 429、§4 的墓碑容量要求。
- 问题：正文规定请求大小，却未要求冻结逐来源速率、突发容量或未处理呈现责任上限。“容量不足拒绝新增”也未明确对应哪个错误码。两个实现可以都声称符合 prompt，却产生不同限流和重试行为。
- 依据：提供方 prompt `:195`、`:231`；消费方 `:246` 按 429/temporarily_unavailable 自动退避。
- 建议最小修改文字：

  > 提供方冻结逐来源速率/突发上限及新增受理容量上限，数值由本地容量测试确定并写入语义 README；已有幂等记录不得因新增容量耗尽而被删除。分别固定临时限流与持久容量耗尽的响应及恢复条件，补边界测试。

**C 级：可选**

**C1（过度设计）：B1 可以先不实现 Activity observation。**

- 所在：两份 prompt 的 GET observation 可选扩展，提供方 `:171`、消费方 `:159`。
- 问题：B1 不允许它驱动任何业务状态，也不做持续已读轮询；实现读取当前 Activity 状态会增加正文删除、墓碑保留后的分支，不能提升受理幂等。
- 依据：提供方 `:178` 已允许省略/null，`:229` 要求 Activity 清理后仍保留受理身份。
- 建议最小修改文字：

  > B1 GET 默认只返回受理记录，暂不实现 observation；消费方仍按冻结 schema 容忍合法可选 observation，并始终忽略其业务意义。

没有发现需要为了“单人维护”删除持久幂等、冻结内容、接收代际或恢复暂停的依据；这些要求对应真实故障窗口。

**3. 实际核对的文件与范围**

三份候选文档均已全文读取。结束时读取得到的 SHA-256：

| 文件 | SHA-256 |
|---|---|
| 方案 | `221d1ee5302c31c1ef9afa3fb242135dc90f89b6ca98c1bd794b035123768948` |
| 提供方 prompt | `dc7b19b4d00b7e4df8b15eb699f1e2e2c73c109924848843fd5f528fb1324054` |
| 消费方 prompt | `533093d530bfde27360f2e974837bfb4853c28c65e5b763d62ed0e59237ac2a1` |

实际 Git 查询：SayDo HEAD 为 `d023ffcebfad38563bc988977192e77654d7e2a1`，Anyvia HEAD 为 `9defe0da9949c5a8b67e0b58d9fffae57a597754`。**HEAD 不代表本次已包含 dirty 文件的工作树身份**，本报告不冒充冻结提交评审。

以下文件已打开或检索读取相关正文；长文件仅核对与清单有关的段落，不表示全文审计。

| 仓库 | 实际核对文件 |
|---|---|
| Anyvia：入口与规范 | `CONTRIBUTING.md`；`docs/README.md`；`docs/architecture-development.md`；`docs/01-background.md`、`docs/05-open-questions-and-next.md` 的相关检索段落；模块化方案、配套 IMPL-PROMPT；`docs/review/2026-09-29-modular-foundation-execution.md` |
| Anyvia：合同与工具 | `docs/contracts/activity.schema.json`；`protocol/docs/contracts/activity.schema.json`；`protocol/src/contracts.ts`；`protocol/README.md`；`protocol/package.json`；根 `package.json`；`scripts/r6-isolated.py`；`scripts/check-architecture-boundaries.ts` |
| Anyvia：网关与存储 | `apps/gateway/src/gateway.ts`、`config.ts`、`store.ts`、`providers.ts`、`backup.ts`、`device-ingress.ts`、`device-relay.ts` |
| Anyvia：分层实现 | `apps/gateway/src/gateway/{composition,fastify-http,activity-http}.ts`；`modules/{activity,attention,presentation,authorization,routing}/application/service.ts`；`adapters/sqlite/{authorization,attention,restore,unit-of-work}.ts` |
| SayDo：项目约定与合同 | `AGENTS.md`；`.octoworkflow/project-profile.md`；`docs/README.md`；`docs/03-architecture.md`、`docs/04-key-mechanisms.md` 的入口段落；`docs/09-data-contracts.md`；`docs/plan/IMPLEMENTATION-PLAN-2.md`；三份候选文档 |
| SayDo：回叫与生产者 | `packages/daemon/src/callback/{engine,sweep,ntfy,email,arbitration}.ts`；`storage/dao/outbox.ts`；`storage/ddl.ts`；`tier1/executor.ts`；`tier1/approvalFlow.ts`；`live/scheduler.ts`；`approvals/directMode.ts` |
| SayDo：确认、身份及恢复 | `packages/contracts/src/types/{outbox,confirmation}.ts`；`packages/daemon/src/live/{confirm,dialog}.ts`；`brain/liveTools.ts`；`index.ts`；`net/{identity,remoteSurface}.ts`；`voice/hub.ts` 的守卫调用；`recovery/reconciler.ts`；`voice/redactor.ts`；`obs/audit.ts` |
| SayDo：检查入口 | 根 `package.json`、`justfile`；`packages/{daemon,contracts}/package.json`；子包 package.json 的 lint 检索；`scripts/{check-emoji.sh,schedule-pointer.mjs}`；`test/t2-thin.test.ts`、`test/mobile-lan-process.test.ts` 的相关断言；`test/callback-sweep.test.ts` 的相关测试入口 |

此外做过源码路径枚举和全 `packages/daemon/src` 的 enqueue、approval_request、自动接受调度调用点检索；仅出现在路径枚举中的文件，不算已核对其实现。

明确**未核实**的范围：

- 未运行任何构建、单测、合同测试、门禁、崩溃注入或真实双仓联调；本文的故障结论来自静态调用链。
- 未核对真实设备、推送后台、Surface 在 summary/high 下的呈现及真实上屏。
- 未读取个人凭据、生产数据库或运行配置；未核实实际来源/设备登记和当前常驻实例。
- 未全文审计备份工具、所有恢复入口、全部迁移及所有测试；没有证明任意手工旧库覆盖可被检测。
- 未逐项验证 12 类确认处理器的全部副作用，未验证远程确认、终端签名、手机密钥或用户验证方案。
- 未核实方案所引三次 Pro 会话、附件回执、研究目录报告及外部规范状态；这些不作为本报告结论的证据。
- 未实测外部 connector requestId/去重、Passport 音频上限与固件内存；这些属于后续阶段，本次未给通过结论。
- 未将 AF 执行记录里的历史测试声明当作当前工作树测试通过；也未验证在途进程状态或候选在整个读取期间保持不变。