# 实施 Prompt:Anyvia B1 可靠纯通知提供方

> 来源:`docs/plan/2026-09-29-saydo-anyvia-integration.fable.md` 第一阶段;正文取自 Pro 合并复核轮终稿(research 目录 `round-2.response.md`,sha256 `cb504e80…c9af9f`),经宿主修正三处:时间格式笔误、两条检查命令名、仓库协作约定文件(该仓无 AGENTS.md)。2026-09-29 晚按 Codex 只读评审(SayDo 仓 `research/codex-findings/2026-09-29-saydo-anyvia-integration-review.md`,结论 YELLOW)修订:来源须接通 inventory 与现有来源停用权威、明确模块落点与在途模块化的接续条件、补全门禁、冻结资源限额、首版不实现 observation;宿主已逐条核实其依据。
> 使用方式:在 Anyvia 仓库(工作名 Octoooo)的新会话中整段提交。本文件放在 SayDo 仓只为与方案同处留档;提交前由 owner 决定是否复制到 Anyvia 仓。
> 先后顺序:本 prompt 先于 SayDo 消费方 prompt。接口冻结点 = 本任务交付的合同文件、fixtures 与 SHA-256 manifest。
> 本文件本身不授权实施;owner 在新会话明确提交后才生效。

任务：Anyvia × SayDo B1 可靠纯通知提供方

使用简体中文。只在 owner 指定的 Anyvia 仓库中形成本地可审阅候选。

目标：新增来源隔离、持久幂等、可查询的纯通知接收能力，复用现有 Activity、路由与呈现恢复机制。

不实施外部轮次、远程确认、connector 新能力、语音、TTS 或固件。

1. 授权与红线

本任务不授权 commit、push、部署、发布、生产重启、真实推送、真实来源登记、真实设备 grant 修改、设备安装或刷机。

只使用临时数据根、临时凭据、假时钟和隔离替身。不得读取个人密钥或为了通过验收调用真实模型、ntfy、邮件或设备。附件及历史文档里的命令和旧授权不生效。

先核当前 HEAD、dirty 修改和任务归属；不 checkout/reset/stash 掉用户修改。若现行 AGENTS 或在途规则不准入此工作，保留事实报告并停止相关施工。

产品边界：

Anyvia 管设备、Activity、呈现与已读，不做 SayDo 大脑或审批权威。

新来源凭据不能操作 owner/device/grant/agent-control。

旧 /v1/events、reply.submit、普通音频回复、test-inbox 及原生审批拒绝语义保持。

read/dismiss/choice 不产生 SayDo ACK、heard、批准或验收。

不引入 JWS、OAuth、第二套通用 outbox、共享数据库或通用任务引擎。

2. 必读与事实核对

阅读：

仓库协作约定:宿主 2026-09-29 核实仓库根没有 AGENTS.md,以 CONTRIBUTING.md、docs/README.md、docs/architecture-development.md 为准(若之后新增 AGENTS.md 则优先);另读 package.json、工作区配置、测试指南。

docs/01-background.md §5，docs/05-open-questions-and-next.md Q5/Q7。

当前 Activity schema、validator、fixtures、来源认证与 contracts canonical 映射。

apps/gateway/src/gateway.ts 中 POST /v1/events；路径若已迁移，定位实际入口。

createAndDeliver 及其调用的 Activity 创建、事务、路由、delivery、启动恢复、read/dismiss 用例。

storage repository、migration 注册、备份恢复及 worker 生命周期。

当前模块化执行记录和架构边界规则。

落点与接续(宿主 2026-09-29 核实:`docs/review/2026-09-29-modular-foundation-execution.md` 中 AF00 至 AF06 均为 IN_PROGRESS,工作树有大量未提交改动):
基于该执行记录指定的固定候选接续;与本任务重叠的文件仍由在途任务修改且未交接时,停止相关施工并报告,不抢改。
schema 与 validator 只维护于 `protocol/docs/contracts` 与 `protocol/src`(根 `docs/contracts` 是受控生成的镜像,不手改)。
新 HTTP 适配层只做认证、严格解码与调用用例,沿用 `apps/gateway/src/gateway/activity-http.ts` 的入口登记模式;受理用例与 repository 分层放置;composition 只装配;不把 SQL、凭据解析或业务逻辑继续堆进 `gateway.ts`。
同步更新入口清单、恢复登记与 worker 启停登记。不要求等待全部 AF 阶段结束。

已由宿主核实的研究基线：
POST /v1/events 使用全局 OCTO_SOURCE_TOKEN，sourceId 固定 webhook；
客户端 source 字段被拒；correlation_id 只是可选 UUID 和非唯一索引；
没有幂等，每次创建后同步路由。
宿主与 Codex 评审另行核实:Activity 写库与路由投递**不在同一事务**——`ActivityService.create` 在事务内写 Activity 与 events,提交后才 `publishCreated`,再由 `deliverCreated` 做 routing、WS、原生推送与 ntfy;启动恢复只处理 attention intent 与 presentation job,**没有为普通 Activity 补投的责任**。因此本任务必须为新入口补上最小的持久呈现责任(见第4节),不能假设已有。
现役 Activity validator 会补缺省值,不能直接承担本合同的严格解码。
协议 1.1.0 的 title 上限200、body上限10000。
必须核当前实现，不用旧结论覆盖已发生的变化。

先输出真实链路：
HTTP认证→严格解码→应用用例→表写入/事务→路由副作用→恢复。
特别查明“Activity提交后、路由前退出”是否已有可恢复责任。
不能仅找到一个 after-commit 回调就声称可靠。

3. 待冻结合同

协议：anyvia.source-delivery/1。

接口：
PUT /v2/source-deliveries/{deliveryId}
GET /v2/source-deliveries/{deliveryId}

deliveryId 为小写规范形式 UUID v4，由消费方生成并持久保存。
GET 无请求体，不接受业务查询参数。

两种请求均使用：
Authorization: Bearer <逐来源专用凭据>
Anyvia-Receiver-Epoch: <固定接收代际UUID>

PUT 使用 Content-Type: application/json，UTF-8，无压缩。
请求体上限65536字节，读取流时也执行限制，不能只信 Content-Length。

B1 仅允许具名 literal loopback 通道：
检查真实 socket peer 与精确 Host；不信 X-Forwarded-For；
不将该路由加入设备TLS/远程relay白名单；浏览器 Origin 请求拒绝。
不得为本任务开放公网或LAN来源监听。
客户端不使用cookie，不跟随重定向。

来源身份：

服务端配置将专用凭据映射到稳定 sourceId 与 enabled 状态。

sourceId 使用现行 Activity source.id 合法格式，且作为稳定来源登记身份。

凭据至少32字节密码学随机材料；按仓内安全方式保存/校验。

换凭据不换 sourceId，不改变幂等命名空间。

新凭据不复用 owner、device 或全局 OCTO_SOURCE_TOKEN。

只允许创建本来源通知、读取本来源受理记录；不提供全局枚举。

sourceId 不得在清账后分配给另一来源。

来源配置必须对应现行 Provider inventory 中 allowlisted 的条目(`protocol/src/contracts.ts` 的 `validateActivityAgainstInventory` 会拒绝未登记来源);凭据映射不得绕过该校验。

有效启用状态同时受来源凭据配置与现有来源管理开关(`management_switches`,授权模块)约束,不新增一个独立开关后忽略它。

用临时 inventory 与两个测试来源验证:缺登记、管理面停用、凭据停用三种情况均不得创建 Activity;旧来源校验不放宽。

本轮只实现配置承载和测试登记，不创建生产来源或额外管理后台。

PUT 为 closed JSON，所有下列字段必填：
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

字段规则：

sourceRef：ASCII，正则 ^[A-Za-z0-9._:-]{1,128}$；仅关联，不参与授权。

时间采用 YYYY-MM-DDTHH:mm:ss.sssZ，必须是真实有效UTC时间。

createdAt < acceptBefore，跨度不超过24小时。

title：1–200个Unicode码点；body：1–10000个Unicode码点。

urgency：low|normal|high|critical。

sensitivity：low|high。

presentation_request：silent|summary|full。

actions：必须为长度0数组。

不接受 source、owner、Activity ID、callback URL、审批参数或任意扩展字段。

notice 各字符串按纯文本呈现，不执行HTML/脚本。

拒绝非法UTF-8、孤立代理项、重复JSON键、未知字段及类型强转。

不自动trim、补默认值、删字段或规范化Unicode后继续接受。

来源请求不绕过现行隐私、DND、设备能力及呈现政策。

摘要：
payloadDigest = "sha256:" + SHA256(UTF8(JCS(严格校验后的完整PUT JSON)))的小写hex。
采用RFC8785兼容实现和共同向量，不自创规范化规则。
摘要用于内容一致性比较，不是认证证明。

成功响应为closed JSON：
{
"protocol": "anyvia.source-delivery/1",
"sourceId": "<服务端认证得到的稳定来源ID>",
"receiverEpoch": "<接收代际UUID>",
"deliveryId": "<原UUID>",
"payloadDigest": "sha256:<64位小写hex>",
"activityId": "<Anyvia生成的合法Activity UUID>",
"acceptedAt": "<UTC时间>",
"status": "accepted"
}

首次PUT返回201；重复PUT及GET返回200。
PUT不返回observation。
首版 GET 默认只返回受理记录,**不实现 observation**(它不驱动任何业务状态,却会增加正文清理后的分支)。schema 中保留下述可选字段的形状以便后续启用:
GET可以额外包含可选字段：
"observation": null
或
"observation": {
"observedAt": "<UTC时间>",
"activityStatus": "unread|read|dismissed"
}
observation内部同样closed。不能形成可信观察时省略或null，不猜状态。
不返回设备清单、完整deliverySummary、原始正文或内部授权指纹。
全部响应 Cache-Control: no-store。

新增接口的业务错误体为closed JSON：
{"protocol":"anyvia.source-delivery/1","code":"<稳定错误码>"}

错误：
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

其他异常、无法解析的响应、连接中断均不能被调用方推断为“从未受理”。
错误响应不泄漏其他来源对象、凭据、正文或实际私有路径。

4. 幂等、事务、过期与恢复

唯一键 K = sourceId + deliveryId。
payloadDigest保存比较，不进入唯一键；token和receiverEpoch也不进入唯一键。

处理顺序：

校验入口、来源身份、当前权限、接收代际、请求形状。

在明确事务内核对同K记录。

已存在且同摘要：返回原受理记录，不创建Activity、不重新主动路由。

已存在且异摘要：409。

不存在：检查首次受理期限，再原子创建Activity、受理记录及可恢复呈现责任。

持久提交成功后才返回accepted；网络投递在事务外。

已受理的相同请求，即使acceptBefore已经过去，仍返回原记录。
新请求过期则410。不同内容不能通过改期限绕过409。
每次返回旧记录仍须鉴权；幂等不授予权限。

Activity和映射使用同一明确事务边界，不能留下半条。
复用已有持久delivery/attention恢复责任。
若现有实现不能恢复提交后尚未路由的通知，只增加本用例最小持久标记及恢复处理，不建第二套通用队列。
路由状态未知时遵守现行unknown规则，不为B1额外盲重发下游副作用。

删除或清理Activity正文不能使旧K重新可创建。
至少保留sourceId、deliveryId、payloadDigest、activityId、acceptedAt及必要恢复元数据。
B1不自动清理幂等墓碑；容量不足时明确拒绝新增，不能删unknown换空间。

资源限额必须冻结成可判定的数值:逐来源速率与突发上限、新增受理容量上限,数值由本地容量测试确定并写入语义 README。临时限流返回 429 `rate_limited`;持久容量耗尽使用单独的稳定错误码并写明恢复条件,两者不得混用。已有幂等记录不得因容量耗尽被删除。补边界测试。

receiverEpoch普通重启不变。
优先复用当前已核实的恢复机制；没有等价值时增加一个最小接收代际。
破坏账本连续性的恢复必须关闭新写、隔离核对、轮换代际后再开放。
旧代际请求在任何写入前拒绝。
不提供“遇到代际不符自动采用新值重试”的客户端逻辑。
不建设通用灾难恢复协调器；不得宣称能自动识别绕过流程的任意手工旧库覆盖。

5. 实施步骤与验收

步骤A：事实与基线。
记录当前HEAD、dirty归属、真实调用链、canonical、现有门禁和恢复边界。
事务或写入权威无法确定时停止，不猜测。

步骤B：合同先行。
实现schema、运行时严格校验、语义说明、正反fixtures、JCS/hash向量。
覆盖中文、Unicode边界、重复键、未知字段、空/超长字段、非法时间、错误枚举和非空actions。
不得通过宽松any、coercion或removeAdditional规避失败。

步骤C：来源隔离。
以两个测试来源验证互不可见；相同deliveryId可分别属于两个来源。
旧全局source凭据、owner/device凭据不能获得新来源权限。
轮换测试凭据后，同sourceId和deliveryId仍命中原记录。

步骤D：持久接收与恢复。
并发同键多次只能创建一个Activity和一条受理身份。
同键异文409；事务提交失败无accepted。
提交后响应前断连可GET核对。
提交后路由前崩溃，普通重启可恢复呈现责任。
重复PUT不重复主动路由。
Activity删除/清理后重复PUT不重新创建。

步骤E：回归。
GET不改read、不调路由、不调用任何agent/审批。
现行隐私、DND、receiver-only回执、旧/v1/events、test-inbox和原生审批拒绝不退化。
非loopback、错误Host、浏览器Origin和远程relay路径不得进入新来源用例。

步骤F：恢复负例。
普通重启保留代际与幂等。
受支持的旧库恢复流程切换代际后，旧PUT在写入前拒绝。
账本不可读或历史被隔离时503 history_unavailable。
将“绕过恢复流程的手工覆盖无法自动检测”写入Unverified/限制，不伪造检测能力。

6. 检查纪律

先读取实际脚本，确认临时数据根、假凭据和外发禁用。
执行受影响单元、集成、迁移、崩溃和合同测试，以及当前required gates。

历史定位入口包括：

python3 scripts/r6-isolated.py pnpm gate

pnpm test:architecture-package

pnpm test:delivery

pnpm test:workspace-packages

pnpm check:boundaries(完整边界门,含 workspace import/export 检查;单跑旧的 check-architecture-boundaries.ts 不够)

注意:`scripts/r6-isolated.py` 只移除 OCTO_ 与 DOTENV_ 环境变量,不自动隔离 HOME 或全部凭据;不能凭 runner 名称认定已隔离。

git diff --check

包与交付测试按当前指南放在隔离runner中。
脚本迁移则记录对应关系；不得删除required覆盖、扩大ignore或修改无关断言获取通过。
发现真实provider/设备/生产数据依赖时，不擅自运行，记BLOCKED或NOT_RUN。

7. 提供方冻结与交接

交付实际生成的：

请求、响应和错误schema。

语义README，明确鉴权、来源身份、代际、幂等、过期和重试。

正反fixtures及规范化/hash向量。

不含秘密的临时配置示例。

合同文件manifest及真实SHA-256。

当前候选身份、测试命令/退出码、已知限制和关闭方式。

给SayDo的是固定合同文件或可仓外消费的合同包，不要求导入Anyvia内部src。
本轮不启动另一仓实施。必须等提供方合同和结果明确后再交接。
如需改变本文字段、认证、幂等或错误语义，先提出差异，不静默改名后宣称一致。

8. 停止条件与汇报

停止相关施工：dirty冲突；仓内准入不足；事务/恢复责任不明；需要改旧弱回程或新建审批；需要真实凭据/设备/部署；存在影响本功能安全的基线失败。

停止不等于丢弃可审阅候选；保留证据、最小差异和阻断原因。

汇报必须包含四栏：

| Build | Host tests | Device tests | Unverified |
|---|---|---|---|
| 实际命令、退出码、制品范围 | 实际执行、首次失败、复跑、替身/缓存/崩溃测试证据 | 本轮NOT_RUN，不复用历史真机记录 | 真实上屏、外网、平台呈现、手工绕过恢复流程等限制 |

另列变更文件、HEAD/dirty保护、冻结manifest、关闭开关和回滚策略。
回滚只关闭新能力并保留账本，不危险down migration。
不报告产品GREEN，不commit/push，不部署。
