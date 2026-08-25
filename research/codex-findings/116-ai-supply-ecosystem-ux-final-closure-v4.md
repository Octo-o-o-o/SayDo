# AI 供给生态与零配置体验最终闭包复审 v4

VERDICT: FAIL

## 校验与实际读取范围

- 开始/结束 SHA-256：`79ad953a4dbb200100ff5362079928b0e8f0e03837cae1401e6b8b6fe19c27dd`，与 prompt 一致。
- 完整读取 prompt 第 1–35 行、目标文档第 1–5,341 行（471,590 bytes）。
- 补充读取仅限发现引用的官方标准/厂商页面；未读取源码或既往报告，未编辑文件、未执行实现测试。

## A

### A1. forward proxy/TLS 终止代理可观察应用凭据，但合同仍把唯一 recipient 记为 origin

- 位置：第 541–566、1806–1818、1831–1855、2994–2995、3572、3941 行。
- 反例：LAN HTTP 私有网关带 Bearer，经企业 HTTP forward proxy访问；或 HTTPS被企业 custom CA终止。proxy能看到 origin Authorization与 prompt，但当前单值 `recipientEndpointDigest` 仍可声称只有 origin。
- 现有条款为何挡不住：显式 proxy与分离 Proxy-Authorization只能证明用户知道代理和防止 proxy凭据发到 origin，不能表达 forward/intercept proxy 对应用凭据与数据的明文可见性。
- 最小修订：逻辑 recipient与 `observableRecipientSet`/`plaintextProcessorSet` 分离；默认禁止带应用 credential的 forward proxy，除非 proxy与 origin均有独立授权；CONNECT/SOCKS只有端到端 TLS未终止才能声明 proxy不可见；custom CA/TLS inspection把 terminator显示为 secret/data processor并触发 hard stop。
- 标准依据：[RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html)、[RFC 9112](https://www.rfc-editor.org/rfc/rfc9112.html)。

## B

### B1. GA mandatory baseline 不能证明必需 category 与逐 auth journey 均存在

- 位置：第 3696–3736、3768、4713 行。
- 反例：Azure只提交 API-key journey、删除 Entra；OpenRouter删除 OAuth。entry仍非空并可命中 requiredEntryKeys；requiredCategoryKeys又没有到 entry的可验证 join。
- 现有条款为何挡不住：schema一边把 auth放在 entry唯一键，一边把多个 auth内嵌为 journeys；baseline没有 required journey集合。
- 最小修订：定义不含 auth的 canonical entryKey和 `journeyKey=entryKey+authProfileDigest`；entry增加 categoryKeys；baseline增加 requiredJourneyKeys或 required auth profiles，并做集合相等/唯一/confusable门。

### B2. GA matrix 未类型化绑定同一 distribution 的 ReleaseConformanceBinding

- 位置：第 3502–3547、3696–3748、4713 行。
- 反例：把旧 binary通过的 OAuth payload/attestation挂进新 matrix，再用新 distribution生成 ReleaseEcosystemBinding；没有必填等式证明旧报告的 SUT digest等于新发货物。
- 最小修订：journey/entry必填类型化 release-conformance binding；校验 payload/attestation、SUT distribution、当前 ecosystem binding distribution、report kind/profile/auth journey全部相等；加入旧报告挂新 binary等 mutation。

### B3. 中国/国际产品 realm 仍停在品牌级，关键 endpoint/key namespace 未成为 mandatory entry

- 位置：第 4078–4093、4384、4390、5041、5050 行。
- 反例：MiniMax中国/国际、SiliconFlow中国/国际、百炼不同地域、方舟/BytePlus账号与 key被混用；一条品牌级 L0行仍可被当作交付。
- 最小修订：为各 realm建立明确 product/region entry，固定 account realm、credential namespace、endpoint/profile、model/billing/rights/data evidence；不支持的 realm也具名显示 inventory/blocked；跨 realm key在 secret read/网络字节前失败。
- 官方依据：[MiniMax 国际](https://platform.minimax.io/docs/token-plan/cursor)、[MiniMax 中国](https://platform.minimaxi.com/docs/token-plan/cursor)、[Alibaba regions](https://help.aliyun.com/en/model-studio/regions/)、[Alibaba API key](https://help.aliyun.com/zh/model-studio/get-api-key/)、[Volcengine Ark](https://www.volcengine.com/docs/82379/1795150)、[BytePlus ModelArk](https://docs.byteplus.com/en/docs/modelark/1099455)、[SiliconFlow 中国](https://docs.siliconflow.cn/cn/userguide/quickstart)、[SiliconFlow 国际](https://docs.siliconflow.com/en/userguide/quickstart)。

### B4. mTLS-only 远程 gateway 在连接合同中不可表达

- 位置：第 231–242、1806–1828、2900、2994、3941 行。
- 反例：企业 gateway只用客户端证书，不用 Bearer/Basic/OAuth。transport能携带证书，但 connection选 `none` 会被远程规则拒绝，其他 auth又要求不存在的应用 credential。
- 最小修订：application auth与 transport authentication正交；远程 application-auth none只在 profile明确允许且已验证 mTLS identity/ACL/egress/peer时成立。加入 mTLS-only正例和 placeholder key负例。

### B5. Docker Model Runner 只有 L2 名称，没有可实施 journey

- 位置：第 3887–3900、4146–4148、3758、4465–4479 行。
- 反例：Docker已安装且 runner/model存在，但 runner或 TCP关闭、模型冷态；普通容器枚举不一定能识别 Docker Model Runner，用户仍需理解 `docker model` 与端口。
- 最小修订：具名 provider pack/journey，静态识别 capability；用户确认后只读 `docker model status/list`或受限 API；区分 disabled/TCP off/no model/cold/loaded/port conflict；不自动 enable/pull。加入支持平台 matrix/TCK。
- 官方依据：[Docker Model Runner](https://docs.docker.com/ai/model-runner/)、[API reference](https://docs.docker.com/ai/model-runner/api-reference/)、[Get started](https://docs.docker.com/ai/model-runner/get-started/)。

### B6. readiness 与 release maturity 有多套不等价枚举

- 位置：第 2964–2968、3481、3717、3774、4256、4913、4918 行。
- 反例：compiler输出 `ready`，console只处理 `connected_verified`；matrix stable与支持页 supported/builtin-stable/community互相漂移。
- 最小修订：分别只保留一套 PublicApiStability、ConnectorReleaseMaturity、ConnectionReadiness、SolutionReadiness、ProtocolConformance；给旧词唯一迁移映射和 exhaustive unknown-fail-closed门。

## C

### C1. 早期主动作表仍违反一状态一个 primaryAction

- 位置：第 166–167、3775 行。
- 反例：实现者照早期“打开 Ollama或查看启动方法”“等待恢复或改走付费来源”生成两个主按钮。
- 最小修订：按机器状态拆行或引用唯一 primaryActionId，其他动作进入 secondaryLink。

## 结论

发现 A=1、B=6、C=1。本轮不通过。
