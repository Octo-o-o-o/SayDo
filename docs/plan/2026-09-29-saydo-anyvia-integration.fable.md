# SayDo × Anyvia 跨仓对接最终方案

> 日期:2026-09-29(v2:同日晚按 Codex 只读评审修订)。状态:研究方案定稿,待 owner 采纳;不是排产源,不授权实施、commit、push 或部署。
> 取代关系:本文取代 `2026-08-26-capture-device-ingress.fable.md` 的设备直连传输层(其权限层结论被本文第二阶段吸收)。
> 证据来源:宿主会话对两仓源码的核实(SayDo HEAD `d023ffc`,Anyvia HEAD `9defe0d`)+ 三次 ChatGPT Pro 评估(双账号首评 + 一次合并复核,均经模型、Pro 档、附件回执核验)+ 一次 Codex `gpt-6-astra`/`medium` 零上下文只读评审(报告 `research/codex-findings/2026-09-29-saydo-anyvia-integration-review.md`,结论 YELLOW,其依据经宿主逐条核实)。研究目录 `~/.octoworkflow/local/research/2026-09-29-saydo-anyvia-integration/`,裁决记录见该目录 `decision.md`。
> 标记:[F] 宿主核实的事实;[P] Pro 建议经宿主采纳;[H] 宿主裁量;[U] 未核实。

## 1. 结论

**不合并仓库;以三个彼此独立、可分别关闭的合同完成对接;分四个阶段,每阶段独立可用;第一阶段只做"SayDo 的回叫上 Anyvia 的屏"。**

| 能力 | 边界 | 前提 |
|---|---|---|
| B 回叫上屏 | SayDo 产生脱敏、不可变的通知;Anyvia 持有 Activity、路由、已读;回执只是呈现证据 | 来源隔离、持久幂等、通知与审批严格分离 |
| A 外部轮次 | Anyvia 转交用户显式提交、绑定目标的文本;SayDo 接受轮次并执行来源权限 | 终端签名、SayDo 资源绑定、来源限制贯穿工具环与恢复 |
| 远程确认 | SayDo 冻结确认对象、签发挑战、验证决定;Anyvia 只负责可信呈现与转交 | 内容绑定、逐次用户验证、单次消费、具名类型白名单 |

## 2. owner 四项裁决与本方案的对应

| owner 裁决(2026-09-29) | 方案落点 |
|---|---|
| 重开 Q5,设备归 Anyvia、大脑归 SayDo;Anyvia 不依赖固定 agent | 第 9 节 ADR;connector 新能力档保持中立,不为 SayDo 开专门分支 |
| SayDo 是否依赖 Anyvia 由方案建议 | **不依赖**。两产品互不为安装前提,核心互不导入,适配器可选,网络调用双向 |
| 方向 B 做 | 第一阶段,见第 4 节与两份实施 prompt |
| 远程确认要做 | 第三阶段,先在一个手机原生端;AI Passport 当前不具备审批资格;S3 永不经本通道 |
| Passport 语音上传做在 Anyvia 固件侧 | 第四阶段,SayDo 只接收用户核对后的文本,不接设备音频 |

## 3. 宿主草案被推翻或修正的地方

宿主 2026-09-29 早先给 owner 的建议里有三条捷径,经三次 Pro 评估与源码核实后不成立:

1. **"同机回环就不算重开远程"——不成立。** [F] SayDo 身份门成功后统一返回 `principal:"owner"`,回环被归为 `via:"local"`;直接接入会把远端输入变成本机 owner 输入。SayDo 当日模块化裁决已写明"中继落 localhost 不得洗成本地可信身份"。[P] 需要同时保留三个不同事实:网关是谁、终端持有什么密钥、SayDo 授予该外部身份什么权限。
2. **"远程确认直接映射 `push + paired_device_pin ≤ S2`"——部分成立。** [F] 该收据行形状存在但现为 designed/deferred。[P] "已配对"不证明"本次已验证";须对具体对象、具体修订、具体决定做逐次用户验证与签名绑定。
3. **"用 Anyvia 已读结算 SayDo 的已听"——不成立。** [P] 已受理、已送达、已展示、已读、已播放、显式知悉是六种不可互换的证据;无播放端时回答应记为"已生成、未证明呈现"。

另有两处表述修正:"依赖单向"改为第 2 节的表述;[F] 现有 connector 的 `append(id,text)` 承载不了来源证明,HTTP 调用每次新 requestId、接收端只有进程内去重,不能当跨重启业务幂等。

## 4. 第一阶段 B1:可靠纯通知

### 4.1 为什么不能复用现有入口

[F] Anyvia `POST /v1/events`(`apps/gateway/src/gateway.ts:1156`):全局唯一静态 `OCTO_SOURCE_TOKEN`;`sourceId` 硬编码 `"webhook"`,客户端带 `source` 即 400;`correlation_id` 可选且只有非唯一索引,**无幂等**;每次 201 并同步 `createAndDeliver`。

### 4.2 冻结的合同选择

| 项 | 选择 |
|---|---|
| 协议 | `anyvia.source-delivery/1`(新增,旧 `/v1/events` 不动) |
| 接口 | `PUT /v2/source-deliveries/{deliveryId}`、`GET` 同路径 |
| 身份 | 逐来源受限 Bearer,服务端映射到稳定 `sourceId`;换凭据不换 `sourceId` |
| 接收代际 | 请求头 `Anyvia-Receiver-Epoch`;普通重启不变,破坏历史连续性的恢复后轮换 |
| 幂等键 | `sourceId + deliveryId`;摘要是比较值不进唯一键;同键异内容 409 |
| 内容 | 严格 closed JSON;`title ≤200`、`body ≤10000`;`actions` 固定空数组;不接受 callback URL、审批参数 |
| 摘要 | JCS + SHA-256 |
| 呈现 | `presentation_request` 沿用现有枚举,适配器默认 `summary`、`sensitivity=high`,首次发送前冻结 |
| 回执 | 只做受理查询;GET 可带 Activity 状态作观察值,SayDo 不据此改任何业务状态 |
| 网络 | 仅具名回环;不进设备 TLS 或远程 relay 白名单 |
| 签名 | **第一阶段不引入 JWS** |

### 4.3 关于"不签名"的裁决

[H] 宿主初裁第一阶段不用签名信封,理由写的是"通知不携带权威"。[P] 合并复核轮支持结论、纠正理由:通知仍有信息外发、注意力占用、伪造来源的风险,正确理由是"在共同可信宿主内,B 无业务授权能力,签名收益不抵成本"。因此来源隔离、脱敏、纯文本呈现、限额、严格校验一项不能省。不签名不会迫使第二阶段返工,前提是 **B 永远只是通知,不被升级为输入或审批的载体**。

### 4.4 三个必须写进实现的边界(复核轮补充,前两路与宿主均漏)

1. **受理必须形成可恢复的呈现责任。** 只加"Activity + 去重记录"事务、把路由放进内存回调,进程在两者之间退出会出现"查询永远 accepted 但通知永远不上屏"。优先复用 Anyvia 已有恢复机制,不足时只补本用例的最小持久标记。[F] 已核实(Codex 评审发现,宿主复核):Anyvia 的 Activity 写库在事务内,提交后才发布并路由(`modules/activity/application/service.ts` 的 `create` → `publishCreated`,`gateway.ts` 的 `deliverCreated`);启动恢复只处理 attention intent 与 presentation job,**普通 Activity 没有补投责任**。所以这一条不是假设,是提供方必须新增的最小持久责任。
2. **SayDo 恢复旧库同样会造成重复通知。** 发送方丢失 `deliveryId` 映射后给旧条目分配新 ID 即绕过去重;SayDo 恢复旧库时必须暂停该通道。
3. **通道受理不能阻断既有升级链。** 不能让原来表示"发送成功"的布尔值同时承载受理、未知、用户确认和业务解决。

### 4.5 重试规则

响应丢失后先按原 `deliveryId` 查询;当前代际、账本可服务、查不到、条目仍有效时,允许重传**完全相同**的 PUT。禁止换 ID、换内容、自动采纳新代际。[P] 这一条采纳答复 b 与复核轮的判断,修正了答复 a"只查不发"的绝对禁止(会把根本没到达的通知永久冻住)。

### 4.6 Codex 评审后新增的实施约束(均已写入两份 prompt)

提供方(Anyvia):

1. [F] 来源必须是现行 Provider inventory 中 allowlisted 的条目(`protocol/src/contracts.ts` 的 `validateActivityAgainstInventory` 会拒绝未登记来源);启用状态同时受来源凭据配置与现有来源管理开关约束。只按"稳定 sourceId + 配置 enabled"实现,认证成功后仍会在创建 Activity 时失败,或绕过管理面的停用。
2. [F] Anyvia 模块化施工在途(AF00 至 AF06 均 IN_PROGRESS,工作树大量未提交改动)。新入口沿用 `gateway/activity-http.ts` 的入口登记模式分层放置;schema 只维护于 `protocol/docs/contracts`;与在途任务重叠的文件未交接时停止。
3. 资源限额冻结成数值并写进合同说明;临时限流与持久容量耗尽用不同错误码。
4. [H] 首版 GET 不实现 Activity 观察值(采纳 Codex C1:它不驱动任何业务状态,只增加分支)。

消费方(SayDo):

5. [F] **Anyvia 交接必须独立调度。** 现有 `allowsL1Channel`(`callback/sweep.ts`)只放行 pending、requeued、或 escalation=0 的 notified;旧通道一旦成功,条目变为 notified 且 escalation=1,后续 sweep 不再取它。直接把新通道挂进现有 L1 循环,会出现"桌面通知成功、Anyvia 请求没到,此后永不再发"。这是 Codex 指出的最大单一风险。
6. [F] **occurrence 身份用完整 dedupeKey 并保留墓碑。** `callback_outbox` 的唯一索引只覆盖活跃态,旧条目 resolved 后相同 dedupeKey 可再次入队并得到新条目 ID;按条目 ID 分配 deliveryId 会在 Anyvia 产生第二条通知。
7. [F] **首批只接三类触发。** `approval_request` 在触发枚举、仲裁与邮件集合里存在,但没有任何生产入队点;不补造生产者。
8. canonical 先行:先把通道状态、occurrence 唯一键、启用边界、调度与恢复语义写入 `docs/09` 并完成一致性评审,再写代码(AGENTS.md 既有要求,原 prompt 把它排在了实现之后)。
9. 首次启用默认不回填旧事项,持久记录启用边界。
10. 门禁更正:lint 入口是仓库根的 `pnpm lint`;本地门另含 `pnpm exec playwright test`。

## 5. 第二阶段 A:带可验证来源的文本轮次

最小必要机制 [P]:独立 integration 主体 + 终端对确切提交对象的签名 + SayDo 本地资源绑定 + 按 `operationId` 对账 + 贯穿业务用例的来源限制。

- 终端签名覆盖:用途、目标 SayDo 实例、绑定、精确会话、`operationId`、最终文本、首次受理期限。
- 有效权限 = Anyvia 当前 grant ∩ SayDo 当前绑定 ∩ 来源能力 ∩ 对象状态与现行门禁。
- [H] 不默认套三层签名:SayDo 资源绑定先是本地权威记录,Anyvia 的 grant 声明先走受认证的本机通道;跨不可信异步边界时再加签名层。
- 首批只允许 owner 已在 SayDo 创建并显式绑定的会话;不按"最近 Console"选会话,不自动建会话。
- 输入用 Anyvia 转写并经用户核对的文本,SayDo 不重复识别;SayDo 本机麦克风仍走自己的管线。
- connector 新增中立能力档(稳定操作 ID、来源证明、受限查询、`lookupOperation`);旧能力档保持原义;`steer`/`create`/`resume` 首批不声明。

**上线前置(不是体验优化):**

1. 来源权限贯穿链:鉴权 → 会话选择 → **上下文组装** → 模型输入 → 工具准入 → 应用用例 → 收据消费 → 结果投影 → 记忆提名 → 恢复。先把整个私密会话送进模型再限制工具,已无法保证不泄密。
2. 来源权限六类(取代 capture 方案的三档):受限查询、不可信贡献、有界提案、经批准副作用、保护性控制(取消/停止/拒绝,独立准入)、本机管理(外部一律拒)。未分类默认拒绝;来源缺失不回落成本机 owner。
3. 远程来源派生的确认卡**持久标记**为不得自动接受。[F] 现状(Codex 评审更正了本文 v1 的错误陈述):自动接受倒计时只存在于内存,只在六类语义提案的生产路径调度(`focus_create_anchor`、`focus_anchor`、`focus_obligation_resolve`、`focus_obligation`、`focus_lane_split`、`expectation_ack`);重启恢复只重建 pending 并重发确认卡,**不会**重新挂倒计时。持久标记仍然需要,理由是防止后续重新呈现或新增调度入口绕过,而不是当前已有的恢复行为。
4. 无 Console、无播放端时不得结算为已听。
5. 外部轮次不触发回叫 ACK、`settlePendingSpeech`、Console hold 队列(capture 方案三轮评审已识别的副作用)。

## 6. 第三阶段:远程确认

权威链 [P]:SayDo 冻结真实业务对象并确定性生成呈现 → 可信终端展示 → 用户选择 → SayDo 为该对象、修订、决定、终端生成挑战 → 终端完成逐次用户验证 → SayDo 验证并调用原生确认用例 → 适用时由执行点消费收据。

### 6.1 白名单(用真实枚举,`packages/contracts/src/types/confirmation.ts`)

| kind | 政策 | 边界 |
|---|---|---|
| `focus_anchor` | 可远程 | 仅接受或拒绝已冻结的语义提案;不等于设备或信任根登记 |
| `focus_obligation` | 可远程 | 不附带未展示的派工、预算或执行授权 |
| `focus_obligation_resolve` | 可远程 | 不等于任务验收通过 |
| `focus_create_anchor` | 可远程 | 限当前已授权范围,不借此扩权 |
| `focus_revision` | 可远程 | 只 accept/reject;不等于 `decision="edit"` |
| `focus_lane_split` | 可远程 | 无法完整呈现全部受影响对象时不开放 |
| `expectation_ack` | 可远程 | 不能由 Activity 已读或通知关闭自动产生 |
| `dispatch` | 可远程 | 仅冻结的、范围与预算明确、≤S2 的具体对象;Gate 0 等现行门禁全部保留 |
| `runtime_effect` | 可远程 | 仅一次具体 effect,绑定父包与 grant;无"以后都允许" |
| `readiness` | 首版不可远程 | 须先证明不会把"人确认就绪"变成"覆盖机器就绪门" |
| `memory` | 首版不可远程 | 首版不扩大可信记忆写入面 |
| `project_anchor` | 首版不可远程 | 副作用范围未核实 |

[P] 这是准入**政策**,不是已实现清单:每个"可远程"类型须独立完成确定性呈现、摘要绑定、原生处理器验证后才在运行时开启。没有任何一个 kind 被整体定为"永不可远程";永久禁止的是跨 kind 约束:任何 S3、Gate 0 bypass、信任根登记、本桥扩权、`decision="edit"`、以及用 choice、已读、关闭、语音附和冒充批准。

### 6.2 两层状态不得混用

[F] 确认账本的接受终局是 `accepted`,没有 `consumed`;审批收据是另一套状态机(accept 后可仍为 pending,执行点消费后才 consumed)。远程提交成功只能显示"决定已登记",不能显示"已执行"。

### 6.3 启用门

可信确认呈现(不能由网关任意替换的发行物或独立受信 Origin)、逐次用户验证、决定按 `decisionId` 对账、撤销与双设备竞争负例。[U] 真实手机平台的密钥存储、用户验证、RP 绑定均未验证。

## 7. 第四阶段:AI Passport 语音

只改 Anyvia 固件与其转写草稿链。[F] Anyvia 现行上限为单帧 32KB、累计 1MiB、会话 120 秒。[P] 在 16kHz 单声道 PCM16 下 1MiB 约 32.8 秒——"会话 120 秒"不等于可连续录 120 秒;无 PSRAM 的 C3 不能沿用 capture 方案的整轮 1.92MB 缓冲。采用有界环形缓冲加背压,缓冲满即终止本轮并明确报错;松开录音键只结束采集,最终发送仍需用户核对正文与目标;小屏无法核对长文本时转手机确认。

## 8. 部署信任边界

[H] 两仓同一台 Mac、同一用户运行。第一、二阶段按"共同可信宿主"处理,不以进程隔离为前置,**也不承诺抵抗不受限的网关远程代码执行**。第三阶段启用前 owner 必须选定威胁模型:若要承诺抵抗网关失陷,须有真实权限隔离;接受较弱模型则须明文登记,且不豁免 S3、Gate 0、来源限制与审批绑定。

## 9. 跨仓 ADR 正文(Proposed)

**决策。** 设备归 Anyvia,大脑归 SayDo。两产品保持独立仓库、独立数据根、独立安装。核心互不导入对方私有源码,不共享可写数据库。集成适配器可选,网络调用双向。Anyvia 不依赖固定 Agent;SayDo 不以安装 Anyvia 为启动前提。Anyvia 不通过底层 Codex、终端模拟或其他旁路接管 SayDo 拥有的任务与会话。

**各自三不做。** Anyvia 不建立 reasoning/tool loop;不判断 SayDo 的就绪、验收与业务完成;不拥有 SayDo 的可信记忆、确认账本与审批收据权威(允许保存经授权的会话视图与有界缓存)。SayDo 不管理设备注册、配对与固件;不决定跨设备呈现路由;不维护第二套跨设备已读权威(可保存外部主体引用与本产品的资源授权绑定)。

**状态权威。**

| 对象 | 权威 |
|---|---|
| 设备身份、配对、设备 grant、Activity、路由、跨设备已读 | Anyvia |
| 外部资源绑定、会话、轮次、任务、就绪、确认账本、审批收据、记忆 | SayDo |
| 未交付输入队列 | Anyvia |
| 已受理操作及其业务结果 | 对应业务接收方 |
| 展示、播放等端侧事实 | 实际终端产生,Anyvia 汇集;SayDo 决定其业务用途 |
| 审计 | 各仓各自不可变记录,以 ID 与摘要关联 |

**接口归属。** B 的接收合同归 Anyvia,SayDo 实现可选通知通道。A 与远程确认的业务合同归 SayDo,Anyvia 经中立 connector 能力档适配。

**降级。** 任一产品离线时另一产品独立工作;不切换大脑、不暗建替代会话、不伪造成功;关闭连接不表示任务已停止;撤权不表示已发生效果被撤销。未知不写成成功,也不写成"确定未执行"。

**版本。** 产品、wire、connector、数据库、固件版本分别管理;安全字段与未知能力不猜测降级。B 的 wire 形状由 Anyvia contracts 维护,SayDo 在 `docs/09-data-contracts.md` 记录本仓映射与固定摘要引用;A 与远程确认的形状归 SayDo `docs/09`。

**回写位置。** Anyvia:`docs/01-background.md` §5、`docs/05-open-questions-and-next.md` Q5/Q7、contracts canonical。SayDo:`docs/09`;`docs/03`、`docs/04` 只加边界指针;capture 方案保留历史并注明处置;实施经 PLAN-2 具名导入。

## 10. 阶段与出口

| 阶段 | 独立可用的出口 | 必须具备的证据 | 回滚 |
|---|---|---|---|
| 1 B1 纯通知 | 脱敏通知被 Anyvia 可靠受理并进入呈现流程 | 合同、并发去重、崩溃恢复、来源隔离;真实上屏另验 | 关闭新通道,保留账本 |
| 2 A 受限文本 | 一个已绑定终端向一个具名会话提交文本并核对结果 | 终端提交证明、来源贯穿、忙闲原子准入、无假已听、无自动接受 | 关闭外部轮次,B 继续 |
| 3 远程确认 | 一个可信手机端处理白名单中已验证的子集 | 对象与决定绑定、用户验证、两层账本、撤销与竞争负例;真机 | 停止新挑战,保留历史;不把远程收据改签成本机 |
| 4 Passport 语音 | 固件上传、转写、用户核对后提交文本 | 内存与背压、半轮失败、最终文本与目标核对;真机 | 关闭固件语音开关 |

工作量:两路首评分别给出第一阶段 4–8 与 8–14 工程人日,复核轮明确这些未经同口径测量、不应取平均。[H] 本方案不给工期承诺,以第一阶段事实核对后的真实清单重估。

## 11. 明确不做

持 owner 令牌的 Console bridge;Activity 已读结算已听;choice 冒充批准;capture 方案的共享令牌、SayDo 设备 WS、LAN 监听、静默丢轮、最近 Console 选会话;把签名或授权信息塞进 prompt 或在旧 connector 能力档里偷加参数;两边重复识别;Anyvia 接管 SayDo 底层执行会话;通用 OAuth/STS、DPoP、PKI、分布式队列、共享数据库、全局事件溯源;第一阶段的 JWS、逐设备身份、完整回执流、播放水位;首批全设备审批、锁屏批准、语音批准、批量同意。

[P] 不能因"单人维护"省掉的:持久幂等、来源隔离、未知状态、内容冻结、事务边界、恢复暂停、已读/已听/批准三者分离。

## 12. 仍需 owner 决定

| 事项 | 推荐 | 不决定的后果 |
|---|---|---|
| B1 是否具名进入实施链 | 先批准 Anyvia 提供方候选;合同冻结后再批准 SayDo 消费方进 PLAN-2 | 维持研究状态 |
| 通知默认呈现与移动提醒主通道 | 默认 `summary`、`high`;避免 SayDo→ntfy 与 SayDo→Anyvia→ntfy 重复 | 启用后可能重复提醒 |
| 首次启用是否补发旧通知 | 不自动回填(已作为默认写入消费方 prompt;你不同意则该通道只实现不启用) | 已处理事项可能被重新推上屏 |
| Anyvia 在途模块化与 B1 的先后 | 先让在途模块化形成一个已提交的固定候选,再从它开 B1;不在当前未提交的工作树上叠加 | 两项施工改同一批文件,互相覆盖 |
| 本方案与两份 prompt 是否先提交入库 | 先做一次只含文档的提交 | 新 worktree 或 clone 里看不到这些未跟踪文件 |
| 备份恢复流程 | 接受"暂停集成、保全账本、切代际、人工核对"的最小方案 | 无法承诺恢复后的去重连续性 |
| 第三阶段首个手机端与威胁模型 | 先一个现有原生手机端;个人试用可接受共同可信域并明文登记 | 远程确认保持关闭 |
| 远程确认首批类型 | 采纳第 6.1 节九个候选,逐个验证后开启 | 默认全部不开放 |
| "视觉已告知"是否成为正式语义 | 与音频已听分开 | 无 Console 的 A 不能安全上线 |
| `DF-REMOTE-REOPEN` 的正式处置 | 在 PLAN-2 具名改写其范围:旧远程面保持关闭,仅具名外部集成面可开 | 第二、三阶段无排产依据 |

## 13. 交付物

- 本文。
- 第一阶段实施 prompt(先后顺序固定):
  1. `docs/plan/IMPL-PROMPT-2026-09-29-anyvia-b1-provider.md`(在 Anyvia 仓的新会话使用)
  2. `docs/plan/IMPL-PROMPT-2026-09-29-saydo-b1-consumer.md`(Anyvia 交付冻结合同后,在 SayDo 仓的新会话使用)
- 研究目录内:brief、9 份外发材料、三份 Pro 答复全文、回执、裁决记录。

## 14. 在两个项目执行 prompt 的步骤

顺序固定:先 Anyvia 提供方,后 SayDo 消费方。接口冻结点是 Anyvia 交付的合同文件、fixtures 与 SHA-256 manifest。

**第 0 步(两仓共同前置)。** 本方案与两份 prompt 目前是 SayDo 主树里的未跟踪文件;独立 worktree 或 clone 看不到它们。先由 owner 授权一次只含文档的提交,或在新会话里用绝对路径引用。

**第 1 步:Anyvia 仓(`~/WorkSpace/Octoooo`)。**

1. 前置:在途的模块化施工先形成已提交的固定候选(当前工作树有大量未提交改动,AF00 至 AF06 在途)。
2. 从该候选开独立 worktree,新开会话,提交如下消息:

   > 按 `<SayDo 仓绝对路径>/docs/plan/IMPL-PROMPT-2026-09-29-anyvia-b1-provider.md` 实施。只做本地可审阅候选,不 commit、不 push、不部署、不碰真实设备。基线是 `<固定候选的提交号>`。

3. 出口:合同 schema、语义说明、正反 fixtures、JCS 摘要向量、manifest,以及四栏汇报。
4. 独立验收:该仓没有 AGENTS.md,是否走 `/supervised-delivery` 由 owner 当次决定;不走时实施者的自检不能称为独立通过。

**第 2 步:SayDo 仓。**

1. 前置:owner 在 PLAN-2 具名插批 `SAYDO-ANYVIA-B1`(当前 `active=none,next=PG-02`),指针由 `scripts/schedule-pointer.mjs` 生成;拿到第 1 步的冻结合同包。
2. 按 AGENTS.md 走 `/supervised-delivery`,施工在独立 worktree,新会话提交如下消息:

   > /supervised-delivery 按 `docs/plan/IMPL-PROMPT-2026-09-29-saydo-b1-consumer.md` 实施 SAYDO-ANYVIA-B1。冻结合同包位于 `<路径>`,manifest 摘要 `<值>`。不 commit、不 push、不部署。

3. 出口:`docs/09` 先行回写并过一致性评审 → 默认关闭的通道实现 → 严格替身上的合同与故障测试 → 四栏汇报。

**第 3 步:联调与真机(另行授权)。** 两仓候选各自通过后,用临时数据根做一次本机双进程联调;真实上屏在 Tab5 或 Passport 上验证中文、长标题、敏感信息裁剪与已读,不复用历史真机记录。

## 15. 证据分档

- **Build**:未改任何产品代码,未运行构建。
- **Host tests**:未运行。
- **Device tests**:NOT RUN。
- **Codex 评审**:1 次,`gpt-6-astra`/`medium`,只读沙箱,隔离会话;runner 退出码 0,`turn.completed` 1 次,rollout 记录的模型与档位与请求一致;评审前后三份候选文件 SHA-256 未变。结论 YELLOW:4 条 A 级、6 条 B 级、1 条 C 级,宿主逐条核实后全部采纳。评审对象是未提交的工作树文件,不是冻结提交。
- **Pro 评估**:3 次提交(账号 a、b 首评;账号 a 合并复核),三次取回均 `complete`、`pro_verified`、`input_attachments_verified` 为真;已达 3 次上限。
- **宿主核实**:`/v1/events` 鉴权与幂等、`CONFIRM_KINDS` 枚举、两仓 HEAD、两份 prompt 引用的文件与脚本存在性(Anyvia 仓无 AGENTS.md 已在 prompt 中修正)。
- **已修改未复核**:本文 v2 与两份 prompt 按 Codex 发现做了修订,修订后的文本未再送任何外部评审。
- **Unverified**:12 个确认类型的完整处理器与副作用;同用户进程隔离;崩溃注入未实测(Anyvia 无补投责任的结论来自静态调用链);手机端密钥与用户验证;各 Surface 在 `summary/high` 下的真实呈现;外部规范状态(如 WebAuthn Level 3 的发布状态)为 Pro 引述,宿主未独立核对。
