# 实施 Prompt:SayDo B1 可选 Anyvia 回叫消费方

> 来源:`docs/plan/2026-09-29-saydo-anyvia-integration.fable.md` 第一阶段;正文取自 Pro 合并复核轮终稿(research 目录 `round-2.response.md`,sha256 `cb504e80…c9af9f`),经宿主修正时间格式笔误并补充本仓流程前置。2026-09-29 晚按 Codex 只读评审(`research/codex-findings/2026-09-29-saydo-anyvia-integration-review.md`,结论 YELLOW)修订:canonical 先行、Anyvia 交接独立调度、以 dedupeKey 作 occurrence 身份并留墓碑、首次启用不回填、首批只接三类触发、门禁命令更正;宿主已逐条核实其依据。
> 先后顺序:必须在 Anyvia 提供方交付冻结合同(schema、fixtures、manifest)之后使用。
> 本仓流程前置(宿主补充):按 AGENTS.md,实施与交付走 `/supervised-delivery`,施工只在独立 worktree 或 clone,主树只合并与收口;报告状态词与落点以 `.octoworkflow/project-profile.md` 为准;插批须由 owner 在 PLAN-2 具名,指针只由 `scripts/schedule-pointer.mjs` 生成。
> 本文件本身不授权实施;owner 在新会话明确提交后才生效。

任务：SayDo × Anyvia B1 可选回叫消费方

使用简体中文。只在 owner 指定的 SayDo 仓库中形成本地可审阅候选。

目标：在既有回叫体系加入默认关闭的Anyvia通知sink，持久保存交接对象，调用已冻结的可靠通知合同，并按原ID核对未知受理结果。

不实施外部轮次、远程确认、heard改造、设备管理、语音或固件。

1. 授权与准入

本任务不授权commit、push、部署、发布、生产重启、真实通知、模型调用、设备安装或任何真实设备操作。

只使用临时SAYDO_HOME、临时数据库、假时钟、假凭据及契约替身。
不读取个人密钥，不发真实ntfy/email，不启动真实provider。
历史附件及方案中的命令、角色安排和旧授权不生效。

先检查当前HEAD、dirty和在途工作，不checkout/reset/stash用户修改。
遵守唯一docs/plan/IMPLEMENTATION-PLAN-2.md。
工作包名为SAYDO-ANYVIA-B1。若当前排产规则要求具名导入而尚未满足，只输出导入差异与阻断，不自行改active/next或绕过owner-stop。

2. 必需输入与必读文件

必须取得Anyvia提供方实际输出的：
anyvia.source-delivery/1 schema、语义README、正反fixtures、JCS/hash向量、
真实SHA-256 manifest及提供方测试结果。
先核对文件和摘要。缺失、漂移或与本任务合同不一致时停止接线，不自行猜API。
可使用严格替身独立开发，不要求真实Anyvia在线。

阅读：

当前AGENTS.md、docs/README.md、package.json、justfile、开发/测试指南。

docs/09-data-contracts.md中callback/outbox、通道、ACK、幂等、审计和恢复。

docs/03、docs/04及PLAN-2。

packages/daemon/src/callback/engine.ts、callback/ntfy.ts及email/仲裁/通道组合入口。

packages/daemon/src/storage/dao/outbox.ts及相关DDL/migration。

packages/daemon/src/tier1/executor.ts的回叫生产调用点。

deliveryPreflight、recovery/reconciler、voice/redactor、obs/audit。

当前callback、contracts、恢复及remote-forbidden测试。
路径迁移时定位真实模块，不按历史行号机械修改。

宿主核实：approval_request出现在仲裁与邮件触发集合中；
tier1/executor.ts有两处回叫入队调用点，但未逐一核实每处实际触发集合。
必须核 producer→enqueue→资格检查→仲裁→sink。
不得为了支持四种名字而补造不存在的审批触发。

宿主与 Codex 评审 2026-09-29 核实的现状(以当前源码为准重新确认):
真实入队点——ready_for_review 在 `tier1/executor.ts` 约 3132 行;failed/blocked 经 `enqueueBlocked`(约 3438、3503 行,另有无工作区 blocked 的调用);blocked 另有 `live/scheduler.ts` 约 82 行的步界超时生产者。
**approval_request 在触发枚举、仲裁与邮件集合里存在,但没有找到任何生产入队点。首批只接 ready_for_review、blocked、failed 三类;approval_request 标为未接线。**
L1 的真实接线以 `callback/sweep.ts` 为准(desktop、ntfy、email),`ESCALATION_CHANNELS` 常量并不完整。
`postNtfy` 与 `sendEmailSmtp` 都返回 `Promise<boolean>`。
`callback_outbox` 的唯一索引只覆盖活跃态(pending/notified/acked/requeued),**不存在"同一 occurrence 永久只入队一次"的约束**;每次入队生成新的 `ntf` 条目 ID。

3. 业务红线

Anyvia仅是可选通知通道；未配置时原行为不变。

不把HTTP成功、Activity read/dismiss或送达改成业务ACK、heard、确认、收据消费、任务验收。

只允许更新本通道的交接记录和必要审计。

Gate0无bypass；S3只在本机认证屏幕；语音封顶S2；
脱敏、candidate→trusted、M0规则和不可变审计全部保持。

不开放远程/api/**、WS、owner-token bridge或外部轮次入口。

不获取Anyvia owner token；不向Anyvia提供SayDo owner token。

docs/09是SayDo形状入口；外部合同引用固定版本和摘要，不手写竞争性schema。

不用旧postNtfy式boolean吞掉accepted/unknown/拒绝的区别。

不因Anyvia已受理而抑制原有业务升级链或原通道。

不改整个回叫架构、工具链或数据库驱动。

4. 必须消费的冻结合同

协议anyvia.source-delivery/1：
PUT /v2/source-deliveries/{deliveryId}
GET /v2/source-deliveries/{deliveryId}

deliveryId为小写UUID v4，首次交接前生成并持久保存。
GET无请求体和业务查询参数。

请求头：
Authorization: Bearer <逐来源专用凭据>
Anyvia-Receiver-Epoch: <owner配置的固定接收代际UUID>

PUT为application/json、UTF-8、无压缩，上限65536字节。
B1只使用具名literal loopback端点；不使用localhost发现、LAN、公网或任意代理。
不发送cookie，不跟随重定向，不从错误回复中自动采纳新地址、来源或代际。
初始sourceId与receiverEpoch由明确配置提供，不以首次网络响应自动授信。

PUT全部字段必填、closed：
{
"protocol": "anyvia.source-delivery/1",
"sourceRef": "<不透明关联ID>",
"createdAt": "<UTC时间>",
"acceptBefore": "<首次受理截止时间>",
"notice": {
"title": "<纯文本>",
"body": "<纯文本>",
"urgency": "normal",
"sensitivity": "high",
"presentation_request": "summary",
"actions": []
}
}

规则：

sourceRef匹配 ^[A-Za-z0-9._:-]{1,128}$，不得放路径、正文或凭据。

时间为YYYY-MM-DDTHH:mm:ss.sssZ，createdAt<acceptBefore，跨度≤24小时。

title为1–200个Unicode码点，body为1–10000个Unicode码点。

urgency=low|normal|high|critical。

sensitivity=low|high。

presentation_request=silent|summary|full。

actions固定[]。

不发送source、owner、Activity ID、callback URL、审批参数或扩展字段。

禁止非法UTF-8、孤立代理项、重复JSON键、隐式trim/默认注入/Unicode改写。

摘要：
payloadDigest = "sha256:" + SHA256(UTF8(JCS(完整PUT JSON)))的小写hex。
必须通过提供方共同向量，不用另一套近似规范化。
首次发送前冻结完整业务JSON、摘要、目标、代际和ID。
之后不能因配置、模板、时间变化重算为另一份内容。

成功响应closed：
{
"protocol": "anyvia.source-delivery/1",
"sourceId": "<认证映射出的稳定来源ID>",
"receiverEpoch": "<固定代际UUID>",
"deliveryId": "<原UUID>",
"payloadDigest": "sha256:<64位小写hex>",
"activityId": "<Anyvia合法Activity UUID>",
"acceptedAt": "<UTC时间>",
"status": "accepted"
}

首次PUT201；重复PUT及GET200。
逐项校验协议、sourceId、receiverEpoch、deliveryId、摘要、Activity ID及时间形状。
不只检查response.ok。

首版提供方不实现 observation;本仓按冻结 schema 容忍该可选字段并始终忽略其业务意义。
GET可额外有：
"observation": null
或
"observation":{
"observedAt":"<UTC时间>",
"activityStatus":"unread|read|dismissed"
}
该字段仅观察，不作为业务状态转换条件。
PUT不返回observation。
不实现完整deliverySummary或持续已读轮询。

业务错误体closed：
{"protocol":"anyvia.source-delivery/1","code":"<稳定错误码>"}

400 invalid_request
401 authentication_failed
403 scope_denied / source_disabled
404 delivery_not_found（仅已认证、当前代际、可服务账本上的GET）
409 idempotency_conflict / receiver_epoch_mismatch
410 acceptance_expired
413 payload_too_large
415 unsupported_media_type
422 unsupported_protocol
429 rate_limited
503 history_unavailable / temporarily_unavailable

不认识的HTTP响应、HTML错误页、连接中断、响应超限或形状错误均不证明未受理。
服务端响应no-store；客户端也禁用缓存。
本阶段没有JWS，payloadDigest不是对恶意宿主的认证保证。

5. 通知资格与内容

只映射当前真实存在且原生资格齐备的触发。首批为:
ready_for_review、blocked、failed。
approval_request 未找到生产入队点,首批不接线;若实施时核实到真实生产者,先报告再决定,不自行补造。

必须逐类记录生产调用点和现有前置。
ready_for_review继续要求现役完整proof；
blocked/failed继续要求各自最小proof；
approval_request以当前真实原生用例的合法条件为准。
未核实的类别保持未接线，不新增伪生产者，也不凭名字套错proof。

保留superseded、DND、恢复preflight及原有仲裁语义。

默认使用固定、最小、脱敏通知模板。
ready_for_review仍表达“执行和检查都跑完了，等你验收”，不能写任务完成。
approval_request只提示“有事项待确认，请在运行SayDo的电脑上核验当前状态并处理”。
第一阶段不得宣传手机已经可以批准。

外发所有动态字符串均走现役redactor并做负例测试。
不发送原始proof、transcript、文件内容、凭据、路径或capability链接。
使用固定短模板避免超长；协议层超限必须拒绝，不能静默截断后继续声称原内容。
通知是发生时的快照，不承诺任务当前仍处于同一状态。

presentation_request由适配器配置选择，默认summary；
sensitivity默认high；
urgency默认normal，已核实触发可映射现有优先级。
这些值在第一次尝试前冻结。配置变化不改旧交接。
Anyvia最终隐私、DND与呈现政策不能被来源请求覆盖。

6. 持久交接与重试

复用现有outbox的业务所有权，只增加必要的通道交接记录。
稳定关联至少包含：
原生完整 dedupeKey(occurrence 身份)、当前 outbox 条目引用、anyvia通道、deliveryId、目标、
sourceId、receiverEpoch、冻结请求、payloadDigest、尝试及受理记录。

同一次callback occurrence在B1最多创建一个Anyvia Activity。
occurrence 身份使用原生完整 dedupeKey,不能只用 occurrenceKey 或 outbox 条目 ID。对同一 occurrence 保留唯一交接身份与墓碑:即使旧 outbox 条目已 resolved 后相同 dedupeKey 再次入队,也不得分配新 deliveryId;真正的新 occurrence 才可新建。不修改旧 outbox 的活跃唯一语义。

独立调度:Anyvia 交接记录形成后,由本通道的持久状态独立推进,不以 callback_outbox 仍被旧 L1 sweep 选中为条件(`allowsL1Channel` 只放行 pending、requeued、或 escalation=0 的 notified;旧通道成功后条目即变为 notified 且 escalation=1,后续 sweep 不再取它)。Anyvia 的结果不参与旧通道"发送成功"的布尔汇总,也不改写旧通道状态。每次新 PUT 前仍核原事项有效性;未知交接保留 GET 核对。

首次启用默认不回填:持久记录启用边界;边界之前已存在的 pending 或 requeued 事项不补建交接;已有交接可按原 ID 恢复。历史补发须另行具名授权。
重复sweep或同条目的再检查不能生成新ID。
原生系统产生的新occurrence才可产生新通知。
本切片不改造周期性再提醒为新的Anyvia Activity；其他通道仍遵守原策略。

首次发送前必须持久保存交接对象。
旧状态只有boolean时，不用false混合“未尝试”和“结果未知”。

建议单次HTTP超时5000毫秒，响应体最多65536字节。
重试使用可注入、可取消的有界退避；默认1/2/5/15/60秒，封顶60秒。
不阻塞其他通知通道。

受理未知时：

保存原交接，GET原deliveryId。

查到合法accepted：只登记本通道已受理，停止该交接的自动提交。

当前代际、有效账本返回delivery_not_found，且来源条目仍有效、
未superseded、未过acceptBefore：允许再次PUT完全相同对象。

429/temporarily_unavailable：有界退避，不生成新ID。

scope/认证/协议错误、内容冲突、代际变化或history_unavailable：
停止自动提交并报告原因。

任何后来的拒绝不能覆盖此前已有的“可能已受理”事实。

截止时间后不再主动PUT；仍可查询原受理。查不到时保留未核对历史，
不改成“保证未发送”，不自动建立替代通知。

superseded发生在首次发送前：不发送。
发生在未知受理后：停止新PUT，但保留GET核对；不声称通知已撤回。
已经accepted的通知不在原ID下改写成另一任务状态。

普通重启保留ID、内容和未知状态。
SayDo旧库恢复必须暂停sink，不给旧outbox或未知交接重建deliveryId。
Anyvia代际变化时，不自动修改旧交接的receiverEpoch。
不建设跨仓自动灾难恢复；遵守现行恢复隔离与人工核对流程。

SQLite与JSONL审计不是天然跨资源事务。
必须核现役audit失败策略与提交顺序，不能自行宣称原子，也不能删审计绕过门禁。

7. 逐步实施与验收

步骤A：输出真实调用链和状态表。
区分callback业务状态、用户ACK、任务结算、本通道交接状态。
完成四类trigger生产/资格映射；未核实明确标出。

步骤A2(canonical 先行,实现之前):把冻结外部合同的映射、本通道状态、occurrence 唯一键、启用边界、独立调度、恢复语义写入 `docs/09-data-contracts.md`,并按本仓规则完成一致性评审。通过后才进入步骤B。(AGENTS.md:发现设计缺口先改 canonical 并完成一致性评审,再改代码。)

步骤B：实现最小可注入sink。
注入transport/clock，默认关闭；不顺手改造全部daemon入口。
无配置、关闭、对方离线时，旧通道行为保持。

步骤C：实现冻结payload与持久关联。
验证重复sweep、并发、普通重启只对应一个deliveryId。
验收配置变化、模板变化不修改在途payload。

步骤D：用严格Anyvia替身做合同与故障测试。
覆盖首次201、重复200、GET恢复、同键异文409；
提交后断连、请求根本未到达、错source/代际/摘要；
超时、超限响应、重定向、错误JSON、403、429、503；
过期后查询已受理、superseded前后区别、旧库恢复暂停。
不能用永远返回200的宽松mock冒充合同联调。

步骤D2:调度与幂等的专项用例。
桌面通道成功而 Anyvia 请求未到达或响应丢失,原 outbox 已是 notified 且 escalation=1;随后恢复网络并重启,Anyvia 交接仍按原 deliveryId 收敛,旧通道状态未被改写。
旧条目 resolved 后相同 dedupeKey 重新入队,不产生新 deliveryId。
启用边界之前的旧事项不产生交接。

步骤E：业务隔离负例。
用spy及数据库断言证明：accepted/read/dismiss/假观察值均不调用
callback业务ACK、heard、review、确认accept、收据消费或任务状态转换。
旧remote-forbidden与本机功能回归保持。

步骤F：重复提醒说明。
保留原通道实现和配置，不改真实用户配置。
对可见配置提示SayDo→ntfy与SayDo→Anyvia→ntfy的重复路径。
看不到Anyvia内部路由时标为未知，不能为检测而扩来源权限读取全局配置。

步骤G：文档与交接(只核对文档与最终实现一致,不在此时首次定义合同)。
docs/09记录本仓通道形状、映射、未知/重试/恢复语义和外部合同摘要；
docs/03、docs/04只加边界指针；
不宣称远程业务已重开或跨仓全部ADR已经实施。

8. 检查

先读取脚本并确认隔离，不运行just dev或真实通知/模型烟测。
执行受影响callback/storage/recovery/contracts/remote负例，再运行当前required gates。

历史定位入口：

pnpm -r typecheck

pnpm lint(lint 脚本只在仓库根,`pnpm -r lint` 不是有效入口)

pnpm --filter @saydo/daemon test

pnpm --filter @saydo/contracts test

just ci

pnpm exec playwright test(`.octoworkflow/project-profile.md` 要求的本地门;环境未获授权时记 NOT_RUN,不以其他门通过替代)

scripts/check-emoji.sh

git diff --check

以当前脚本为准，记录迁移映射。
required gate若需要未授权环境，记BLOCKED/NOT_RUN，不删门、
不扩大ignore、不用局部通过冒充完整通过。
保留首次失败和复跑证据，不把缓存结果冒充新执行。

9. 停止与汇报

停止相关施工：PLAN-2未准入；dirty冲突；冻结合同缺失/漂移；
需要改heard/审批/S3/远程身份；不能证明持久关联或审计边界；
需要生产凭据、真实通知、部署或设备。
保留可审阅修改、证据及最小阻断说明。

汇报必须使用四栏：

| Build | Host tests | Device tests | Unverified |
|---|---|---|---|
| 实际命令、退出码、制品 | 实际执行、首次失败、复跑、替身/缓存/故障证据 | 本轮NOT_RUN，不复用历史设备验收 | 真实Anyvia联调、真实上屏、外网、用户体验及恢复限制 |

另列当前HEAD、dirty保护、改动文件、消费的manifest、
已核实/未接线trigger、默认配置、关闭开关和回滚方法。

回滚关闭新sink，保留交接和审计，不清unknown、不危险down migration。
只报告达到“本地候选/合同替身验证”的真实层级。
不报告产品GREEN，不commit/push，不部署。
