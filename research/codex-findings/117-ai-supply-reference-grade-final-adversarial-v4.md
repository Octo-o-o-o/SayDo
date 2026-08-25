# AI 供给普适接入参考级最终对抗评审 v4

> 执行说明：按规定先调用 Codex `gpt-5.6-sol`，但其在读取目标前返回 usage limit；失败事件保存在 `logs/117-ai-supply-reference-grade-final-adversarial-v4.jsonl`。确认零报告落地后，按只读评审回落链改用 Grok `grok-4.6`、`xhigh`。Grok 的工具白名单不含 hasher，故报告中的开始/结束 SHA 由主会话另行核验，不能伪称由 Grok 独立计算。

VERDICT: FAIL

Grok 通读目标文档 1–5,342 行，并只读抽查 `packages/contracts/src/types/modelbinding.ts`、`packages/daemon/src/providers/openaiCompat.ts`。报告给出 A=11、B=6、C=5。

## A

### A1. `oauth_managed_by_upstream` 可旁路 OAuth 闭包

- 位置：`ApplicationAuth` 约第 237 行；对比 §4.16.2。
- 反例：direct inference connection选该分支时没有 grant、token endpoint、refresh family、scope或 client registration，本机 sidecar可注入任意 token。
- 最小修订：删除该分支，或限制为 official-surface-only Execution并强制绑定可验证上游 credential authority；direct inference命中该 kind必须零字节。

### A2. 开放的 `RequestProfile.headers` 可绕过 secret broker

- 位置：第 1872–1875、2996 行。
- 反例：pack写入 `x-api-key` 或账单组织/项目身份头；它们不经过 SecretRef/egress/ACL即可发出。
- 最小修订：公共头改为受信 allowlist/policy判别联合；所有 credential、组织、项目身份头进入 CredentialComponentBinding，禁止开放字符串表。

### A3. CONNECT/SOCKS origin 解析与安全 dialer pin 不闭合

- 位置：`TransportHop` 第 1831–1849 行；安全 dialer第 2993 行；复合传输第 3572 行。
- 反例：本地检查 `api.example` 为公网 IP，但 proxy再次解析 hostname到 metadata/LAN；ordered hops又不强制包含独立 origin hop。
- 最小修订：origin成为独立 hop；host-pinned模式只把已批准 IP字面量交给 proxy并保留 Host/SNI，或要求独立 proxy enforcement authority证明准确 destination policy；remote resolution缺证明即零字节。

### A4. Execution physical terminal 是非法笛卡尔积

- 位置：`ExecutionPhysicalRequestTerminalReceipt` 第 2504–2511 行。
- 反例：已发送请求可填 `{outcome:"failed_before_send",sentState:"not_sent"}`并释放费用、推进 successor。
- 最小修订：改为严格判别联合；failed-before-send只能 not-sent，success/after-send只能 sent，并显式 closes/retry edge。

### A5. `charge_unknown`、cursor关闭与 fallback后继语义冲突

- 位置：inference terminal第 986–988 行、runtime edges第 889–893 行、fallback edges第 2117–2124 行、Phase 3第 4427/4437 行。
- 反例：A sent timeout若写 charge-unknown则 cursor关闭不能调B；若改写 retryable又可能在同 solution隐藏重试。
- 最小修订：把 retry control outcome与 billing disposition正交成严格联合；after-send successor只有事前登记边、aggregate reservation与非空 charge-unknown ledger一同满足才可发生。

### A6. Rights/Network/Runtime Billing 与付费授权仍有通用 `ReceiptRef` 接缝

- 位置：Conformance admission第 760–764 行、Inference funding第 1734–1738 行、ComputePolicyRefs第 1239–1244 行。
- 反例：把 ProductEligibility或任意 receipt挂进 authorization，类型仍通过。
- 最小修订：canonical回写必须为 Rights、Network、ConformanceAuthorization、RuntimeSpendAuthorization、RuntimeBilling定义具名严格 kind，关键外键不得停在不可判别 ReceiptRef。

### A7. 自动 half-open metadata可带凭据且被 ledger sent=0抹掉

- 位置：第 3762、4441 行。
- 反例：带 Authorization的 `/models` 后台请求可能计次/计费，却因门禁要求 ledger sent为0而不入账。
- 最小修订：自动 half-open仅允许 auth-none、release-bundled、带权威 zero-generation/zero-cost policy的 metadata；需要凭据或无法证明不计费时只等下一次正常授权用户请求。

### A8. usage/计费维度无规范形状

- 位置：`SecurityExtractionValue.canonicalUsageVectorDigest` 第 3357 行；CandidateBilling约第 1398–1418 行。
- 反例：cache creation/read、reasoning、image/audio或请求最低费未被 pack声明，fold不会把“从未存在的维度”识别为新增 component。
- 最小修订：定义可扩展但受信的 UsageDimension profile与完整 raw occurrence coverage；协议出现未授权维度即 anomaly/charge-unknown，不得并入其他维度。

### A9. 缺 daemon instance fencing

- 位置：commit token/cursor第 780–797、3560 行；全文无 instance lease。
- 反例：两个 daemon打开同一 SoT，共用 in-flight commit token并分别写出首字节。
- 最小修订：排他 reference-monitor writer lease/epoch进入每份 physical lease与首字节复核；失去 epoch的旧实例零字节。

### A10. OIDC flow-start 未冻结 nonce

- 位置：OAuth PKCE flow第 307–319 行；OIDC证据第 5021 行。
- 反例：若消费 ID Token，授权请求未绑定 nonce，无法证明 replay/mix-up被拒绝。
- 最小修订：OAuth-only与 OIDC严格分支；OIDC flow-start冻结 nonce，结果由具名 ID-token validation receipt校验 issuer/signature/aud/azp/nonce/time。OAuth-only禁止用 ID Token派生 subject。

### A11. TLS 1.3 0-RTT 可重放计费 POST

- 位置：Transport TLS与安全 dialer第 1820–1849、2993 行。
- 反例：同一 lease的 early data被网络/CDN重放，上游执行/计费两次，本地仍只记一次 sent。
- 最小修订：所有带 credential、生成或非幂等请求禁用 0-RTT；mutation TCK必须红。

## B

### B1. ACP wire ID 未区分 stdio/HTTP

- 位置：BuiltinExecutionWireProtocol第 209–213 行；ExecutionSurface第 2204–2209 行。
- 反例：HTTP ACP的 implementation/TCK挂给 stdio ACP。
- 最小修订：wire拆 `acp_stdio|acp_http` 并与 surface一一相等。

### B2. staged/live 两轮没有共同授权身份

- 位置：第 81、157、972、4597 行。
- 反例：staged success关闭 cursor，restart后 mint新 authorization跑 live，而用户只批准旧 disclosure。
- 最小修订：同一 conformance authorization显式包含 staged/live ingress集合与总披露；restart只能恢复同一 decision，新 mint必须重新确认。

### B3. 长尾覆盖候选：华为云与系统级本机模型未进 matrix

- 影响：中国主流云和系统级 local runtime覆盖不完整。
- 建议：作为具名 inventory/L1候选进入 matrix，不经验证不得 mandatory/GA。该项需结合本版明确 operation范围和用户需求由 owner定级。

### B4. Phase/GA/DoD还需把发现固化为具名 fixture

- 仅要求评审 A/B计数归零不足以替代每个安全性质的可执行负例。
- 最小修订：把所有确认成立的发现映射到对应 Phase gate、GA baseline与 release report。

### B5. requested/granted scope 不能要求字面相等

- 位置：第 2906、3571 行。
- 反例：OAuth server合法缩小 scope或返回不同顺序会让连接永久失败；宽松实现又可能接受 scope提升。
- 最小修订：canonical集合 `granted ⊆ requested`，禁止超集；顺序/alias由固定 canonicalizer处理。

### B6. “数据不出本机”还需覆盖持久化侧信道或收窄文案

- 当前 sandbox覆盖进程树FD/mount/temp/log/IPC/shared-memory/helper/socket，但未明确 swap、coredump、GPU VRAM、系统快照。
- 最小修订：privacy TCK加入 crash dump/swap/snapshot/accelerator memory policy，或将文案收窄为“SayDo已阻断并验证的进程树出口”。

## C

1. builtin protocol不等于 Phase 2三核心必交，需在阶段映射中明确。
2. 禁止 SSE `Last-Event-ID`/Range在已消费字节后自动续传。
3. `workload_identity.sourceRef:string` 应改为判别型 credential-source/lease receipt。
4. Unix socket/named pipe inference若进入范围，需要独立 EndpointIdentity；否则明确不在v1。
5. OCSP/stapling不能用一条全球统一 fail-closed规则，应由版本化 TLS trust policy按 provider/enterprise环境决定并有测试。

## 完整性说明

Grok受只读工具白名单限制，未能自行执行 SHA命令；主会话在其前后另行核验目标 SHA。回落流以 `stopReason=end_turn`、model `grok-4.6-build` 收口；usage：input 206,475、cache-read 1,267,584、output 40,913、reasoning 32,874、15 turns。
