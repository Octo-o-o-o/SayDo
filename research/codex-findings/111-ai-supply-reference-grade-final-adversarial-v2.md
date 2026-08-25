结论：`VERDICT: FAIL`。

开始与结束 SHA-256 均匹配期望值。共确认 13 项 A、8 项 B；均是当前方案本身允许的反例，不包含“生产代码尚未实施”。

## A 级

1. `[A-1] OAuth device flow 使用了错误的 PKCE 合同`

位置：[L231](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:231)、[L246](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:246)、[L1604](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1604)、[L2800](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2800)。

最小反例：同一 issuer 并发启动 connector A、B 两个 device flow，poller 交换两者的 `device_code`，A 最终绑定 B 的 principal/token。

现有条款挡不住：`oauth_pkce | oauth_device` 共用只有 redirect/state/S256/authorization-code 的 `OAuthGrantReceipt`；没有 device authorization endpoint、device-code handle、user code、poll generation、interval、poll terminal。RFC 8628 的 device flow是独立 endpoint、device/user code及轮询状态机，不是 PKCE callback 流程。[RFC 8628](https://www.rfc-editor.org/rfc/rfc8628.html)

最小修订：拆成判别型 `PkceGrantReceipt | DeviceGrantReceipt`；device 分支绑定 connector/session/user/client/audience/scopes、两个 endpoint、opaque device-code handle/version、poll CAS、expiry/interval、最终 subject/version，并增加并发交换、慢轮询和 replay fixture。

2. `[A-2] Auth 合同无法表达 proxy + mTLS + application auth 的复合闭包`

位置：[L225](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:225)、[L280](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:280)、[L1691](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1691)、[L2353](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2353)。

最小反例：企业端点要求“认证 proxy + mTLS client certificate + Entra Bearer”。`AuthSource` 只能选择一个 kind，egress receipt 也只有一组 principal/source/version。

现有条款挡不住：把证书私钥或 proxy secret 藏进 `tlsPolicyDigest`/network receipt 后，broker 无法分别验证其 principal、版本、ACL、轮换和撤销；mTLS本身也是独立的 OAuth client-auth/token-binding机制。[RFC 8705](https://www.rfc-editor.org/rfc/rfc8705.html)

最小修订：建立有序 `TransportHop[]`，分别建模 `ProxyAuth`、`TlsClientIdentity`、`ApplicationAuth`；每个 credential component 独立绑定 SecretRef/version/principal/egress/ACL，manifest 与 attempt 对完整集合无漏无重。

3. `[A-3] 不可信 gateway/provider/remote Agent 可以给自己作证`

位置：[L444](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:444)、[L765](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:765)、[L1191](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1191)、[L1234](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1234)、[L2010](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2010)、[L1620](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1620)。

最小反例：gateway 消费一次 admission token，却内部调用未登记 provider 两次，然后签发“只执行一次、route=A”的 attestation；远程 Agent 同样可在 callback 外执行副作用。

现有条款挡不住：执行者、路由者和证明者是同一不可信主体；service identity只能说明“谁说的”，不能证明其没有隐藏 retry/fallback、数据外发或绕过 Gate。

最小修订：严格承诺只能由 SayDo-owned dispatch/reference monitor，或独立、可测量且不可旁路的远端 enforcement plane满足；attestation须绑定独立 issuer/trust policy/measurement/nonce和受约束 egress。服务自报只能 advisory/inventory。

4. `[A-4] Runtime single-use lease 可产生两个合法 sibling`

位置：[L459](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:459)、[L473](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:473)、[L1618](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1618)、[L2822](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2822)。

最小反例：两个线程同时为同一 fence lease 签发 ordinal 0、空 predecessor，但 `physicalAttemptId` 不同的 C1/C2；两张 receipt 各自只用一次，两次请求均发出。

现有条款挡不住：`singleUse: true` 只防同一 receipt 重放；没有 fence-scoped 持久 cursor、expected revision 或“一 predecessor 只能有一 successor”的唯一约束。“按 predecessor CAS”仍未定义 CAS 的对象。

最小修订：增加按 fence 唯一的 durable sequence cursor，以 `expectedRevision + nextOrdinal + lastLeaseRef` 原子签发 child；reserve、lease claim和 `sent` 在首字节前同事务提交，并测试两个不同 child争抢同一 ordinal。

5. `[A-5] Execution consent 到每个物理模型请求之间没有 single-use admission DAG`

位置：[L1267](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1267)、[L1287](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1287)、[L1304](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1304)、[L1364](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1364)、[L1399](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1399)、[L1621](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1621)。

最小反例：`host_metered` template 省略可选 `sessionWorstCaseLimit`，用户同意 `maxTurns=1`；两个并发 worker各创建一个 `turnOrdinal=0` attempt并各发一次请求。

现有条款挡不住：session lease/consent没有 single-use状态、turn cursor或最大物理请求序列；`ExecutionBillingCoverageSource` 是发送后的覆盖证据，`charge_unknown` 无法撤回第二笔费用。

最小修订：已知计量模式强制 aggregate limit与物理请求上限；新增原子 `ExecutionTurnLease`、`ExecutionPhysicalRequestLease` 和 per-session cursor，所有 Agent 网络必须经 host broker或等价不可旁路 admission。

6. `[A-6] Execution activation 没有冻结 secret-broker ACL`

位置：[L1515](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1515)、[L1572](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1572)、[L1787](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1787)、[L1793](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1793)。

最小反例：verify 时 ACP Basic secret v1仅 daemon可读；promote前 ACL扩大到 driver/Agent。connection revision和 egress receipt不变，promote仍只检查“当前 secret存在且有 ACL”。

现有条款挡不住：Inference manifest显式保存 `secretBrokerAcl`，Execution manifest没有预期 ACL ref/generation；session lease也不引用它，无法做相等 CAS。

最小修订：endpoint型 Execution surface冻结完整 endpoint/auth/principal/secret-version/broker-ACL/egress集合；stdio型使用明确的 no-connector-secret proof。ACL widening加入 verify→promote与 session-start竞态门。

7. `[A-7] “数据不出机”只约束目标进程网络，不约束真实可达数据路径`

位置：[L534](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:534)、[L557](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:557)、[L594](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:594)、[L1615](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1615)、[L1761](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1761)。

最小反例：network-denied runtime P通过 Unix socket或继承 FD把 prompt交给既存 helper H，由 H上传；P的 network receipt仍全绿。`allowlisted_only` 中若含远程 telemetry endpoint也有同类问题。

现有条款挡不住：receipt只绑定 P 的 process generation；没有 process-tree继承、foreign IPC/FD、同步目录/日志/temp sink闭包，也没有逐 allowlisted endpoint的 locality/DataBoundary。

最小修订：本机隐私证明须绑定完整 process tree、继承规则、FS/mount/sync/log/temp、IPC/shared memory/FD和所有可达 endpoint；只有全树 network-denied，或所有出口均证明本机且无旁路时才允许该文案。

8. `[A-8] Plugin/Execution sandbox 可借继承 descriptor/HANDLE 绕过`

位置：[L1211](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1211)、[L1243](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1243)、[L1910](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1910)、[L2093](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2093)、[L2944](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2944)。

最小反例：daemon启动 Agent前已有未设 close-on-exec的 broker socket、SQLite FD或 Windows HANDLE。子进程无需新 `open/connect` 即可使用它。

现有条款挡不住：runtime receipt记录 mounted handles和 egress，却没有 inherited descriptor/HANDLE实际集合及原子关闭证明；当前 syscall TCK只测“新建访问”，因此可假绿。

最小修订：定义唯一允许继承集合并使用 `close_range`、`posix_spawn` file actions或 Windows handle allowlist原子清理；runtime receipt记录 realized set。TCK预置 secret/socket canary句柄并验证不可见。

9. `[A-9] 签名技术 catalog 可把自动 loopback probe 变成本机 CSRF`

位置：[L1675](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1675)、[L1842](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1842)、[L2090](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2090)、[L2249](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2249)、[L2255](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2255)。

最小反例：被攻破但签名有效的 catalog加入 `GET 127.0.0.1:<port>/admin/delete`。请求无 DNS/query/body/auth且在预算内，host仍自动执行有副作用的 GET。

现有条款挡不住：技术 catalog既能定义 probe method/path，又被自动阶段当成授权来源；literal loopback和资源上限不证明路径无副作用。

最小修订：在线 catalog只能引用 release-bundled不可变 probe capability ID；新增/修改 destination/method/path须独立 discovery-probe delegation，或降为用户确认的 `explicit_active`。恶意签名 catalog fixture必须产生零 socket字节。

10. `[A-10] `explicit_active` CLI 只有环境清理，没有 OS 文件/IPC隔离`

位置：[L2090](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2090)、[L2249](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2249)、[L2250](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2250)、[L2262](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2262)。

最小反例：已验证 publisher/digest的恶意 `status` 子命令读取绝对路径下的 SSH key或同 UID credential store，再写入 stdout或允许的 metadata请求。

现有条款挡不住：空 cwd、隔离 HOME/env、关闭 stdin和禁用部分网络都不是文件、credential-store、process-inspection或 foreign-IPC访问控制；plugin/driver的 OS sandbox门并未覆盖 discovery CLI。

最小修订：给 `explicit_active` 定义独立 OS-enforced discovery sandbox receipt和直接 syscall canary；不满足时只做静态 inventory或提示用户在官方 UI手工确认。

11. `[A-11] Security extractor 没有 field-specific TUF授权域`

位置：[L1675](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1675)、[L1972](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1972)、[L2010](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2010)、[L2824](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2824)。

最小反例：将 billing delegated role签发的 extractor receipt挂到 `field="data_boundary"`，或把 data-boundary extractor挂到 `usage/terminal`。

现有条款挡不住：五个 policy role没有 model/route/usage/terminal extractor的授权映射；`extractorPolicy`只是无类型 `ReceiptRef`，field与 repository/role/path互不绑定。

最小修订：新增 `ExtractorPolicyReceipt<F>`，绑定 field、product/protocol/response profile、raw path/rule、repository/issuer role/threshold；定义逐字段唯一 delegation并测试 billing↔data、route↔terminal换挂。

12. `[A-12] TimeAuthorityReceipt 不能证明时间来源可信或新鲜`

位置：[L310](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:310)、[L1674](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1674)、[L1777](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1777)、[L2825](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2825)。

最小反例：攻击者提供由任意 key签名或重放的 network time，填入仍覆盖旧 policy期限的上下界；receipt只记录 `source="signed_network_time"`，所有 temporal判断可通过。

现有条款挡不住：没有 authority identity、trust-root/policy、签名证据、nonce/request binding、最大年龄或 uncertainty；source枚举不等于可信证明。TUF验证本身依赖受信时间和明确的过期处理。[TUF Specification](https://theupdateframework.github.io/specification/latest/)

最小修订：定义判别型 source attestation，冻结 issuer/key/trust policy、nonce、sample/evidence、uncertainty、issued/max-age和 boot/monotonic lineage；无可信上界必须 `clock_untrusted`。加入伪 key、旧签名重放和 fresh-install离线 fixture。

13. `[A-13] Circuit-breaker half-open 可绕过唯一费用授权 producer`

位置：[L1743](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1743)、[L1745](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1745)、[L1753](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1753)、[L2099](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2099)。

最小反例：payg route进入 half-open，后台用 synthetic prompt发一次生成请求；“独立预算”不是用户的 ConformanceAuthorization、RuntimeSpendAuthorization或 NoNewSpendProof。

现有条款挡不住：费用章节声明没有通用授权，但 breaker没有独立 operation、funding template、reservation或物理 lease；“不夹带真实用户 prompt”不等于不计费。

最小修订：自动 half-open只允许已证明零费用的 metadata probe；生成探测必须使用显式 `health_probe` operation、用户授权、逐 component reservation和 single-use physical lease，否则由下一次正常已授权请求承担半开探测。

## B 级

1. `[B-1] 自定义 Base URL 与 operation path的组合算法未冻结`

位置：[L1684](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1684)、[L2201](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2201)、[L2215](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2215)、[L2233](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2233)。

最小反例：base为 `https://gw.example/team/acme/v1/`，三个实现分别发送 `/team/acme/v1/chat/completions`、`/chat/completions`、`/team/acme/v1/v1/chat/completions`，均可声称用了 normalizer。

现有条款挡不住：只定义最终 URI规范化，没有定义 base prefix、已有版本段与 protocol operation path的 resolution算法。

最小修订：冻结 RFC 3986 resolution、尾斜杠、已有 `/v1`、leading slash、dot segment、percent-encoding和 encoded separator规则；三协议添加组合矩阵。

2. `[B-2] Plugin RPC 1 MiB frame与合法 wire上限不闭合`

位置：[L1829](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1829)、[L1949](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1949)、[L2091](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2091)、[L2092](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2092)。

最小反例：2 MiB text/tool schema请求低于32 MiB wire上限，但进程外 adapter的 `compile()`/`AdaptationPlan.wireRequest` 超过1 MiB frame；1.5 MiB合法响应 event亦然。

现有条款挡不住：大型 media有 handle，但大型 text、schema、tool arguments和 decoder输出没有 chunk/handle协议，也未声明 plugin能力更低。

最小修订：所有大型 content使用只读 content-addressed handle或带 digest/backpressure的分块 RPC；否则发布独立 plugin capability profile并在编译前明确拒绝。

3. `[B-3] Registry/TUF archive资源上限只有名称，没有数值合同`

位置：[L1679](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1679)、[L2634](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2634)、[L2655](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2655)、[L2796](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2796)。

最小反例：签名 pack包含20,000文件、展开2 GiB、深度64；不同实现可任意接受或拒绝，均满足“存在上限”。

现有条款挡不住：`ResourceBudgetProfile v1`只量化 discovery/plugin/wire；TUF signed length不等于解压、delegation graph和 schema计算成本上限。

最小修订：增加 digest-bound `RegistryArtifactBudgetProfile v1`，固定压缩/展开字节、文件数、单文件、深度、ratio、metadata/delegation/target数、JSON nodes、CPU/wall/temp disk；门禁跑 N-1/N/N+1。

4. `[B-4] Trusted TCK builder未隔离不可信构建步骤与签名身份`

位置：[L2125](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2125)、[L2191](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2191)、[L3045](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:3045)、[L3067](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:3067)。

最小反例：社区 connector的 build/lifecycle步骤与签名动作同 job运行，恶意代码修改报告或读取 OIDC token；产物仍具有 verifier接受的 repo/workflow/builder identity。

现有条款挡不住：钉住 workflow、builder和 provenance证明谁运行了流程，不证明不可信代码运行时签名权限不可得。

最小修订：强制两阶段两权限域：无 OIDC/write secret且限制网络的 hermetic build/test产生不可变 digest；独立 verifier/signing job只消费该 digest，黑盒复测后才短时取得 OIDC。参照 [SLSA build requirements](https://slsa.dev/spec/v1.2/build-requirements)。

5. `[B-5] evidence-lock只有 digest，不能重放动态证据`

位置：[L2636](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2636)、[L2658](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2658)、[L2785](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2785)、[L3358](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:3358)。

最小反例：厂商次日修改同一 URL页面；审计者只有旧 digest和新页面，无法恢复或验证旧 digest对应的内容。

现有条款挡不住：schema没有 content-addressed evidence对象、immutable locator、canonicalization版本、locale、HTTP metadata或受控存储引用。

最小修订：policy target引用可获取的内容寻址 evidence artifact；保存原始内容 digest、规范化声明投影、canonicalizer/fetcher版本、locale/region和存储引用。版权受限原件可进入受限证据库。

6. `[B-6] GA必选生态集合不可判定，Gemini API形成实际孤儿项`

位置：[L2226](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2226)、[L2459](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2459)、[L2527](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2527)、[L2776](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2776)、[L3009](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:3009)、[L3060](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:3060)。

最小反例：实施方将所有 Agent项保持 inventory，并从“当前 L0列表”删除失败项；`every([])`式 GA gate通过。独立 Gemini API虽列为 L1，Phase 3不含它，Phase 7只实现 Vertex，也可永远不交付。

现有条款挡不住：CLI/Agent表没有机器可读 tier/required-for-GA；GA门读取的必选集合、非空约束和 owner批准的降级流程均未定义。Gemini API是独立于 Vertex的正式 API surface。[Gemini API](https://ai.google.dev/api/generate-content)

最小修订：新增版本化、签名并进入 release digest的 `ga-ecosystem-matrix`，逐项固定 product/region/surface/protocol/tier/journey/required-for-GA；类别非空，删除或降级必须 owner决策并改变 manifest digest。给 Gemini API指定明确 Phase和门禁。

7. `[B-7] Phase 0机械门没有覆盖自身开工前置和九项 owner决策`

位置：[L2623](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2623)、[L2659](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2659)、[L2661](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2661)。

最小反例：PLAN-2仍无具名批次，基线 digest已漂移，§14仍有未签决定；五处投影、链接和 emoji检查均绿，唯一 Phase 0 command仍返回0。

现有条款挡不住：gate说明只编排 canonical consistency、links和 emoji；没有读取 active pointer、dirty对账、PLAN-2坐标、基线 digest或 owner decision record。

最小修订：新增机器可读、owner签名的 batch/decision record和独立 preflight command；Phase 0收口再次核对九项非 `undecided`，且 pointer/baseline/PLAN-2 digest未漂移。

8. `[B-8] Discovery总预算没有公平、确定性的仲裁`

位置：[L2090](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2090)、[L2248](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2248)、[L3074](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:3074)。

最小反例：排在前面的合法 detector消耗全部256 paths或16个 loopback probes，后面的 Ollama/LM Studio detector永远不运行；所有 detector均未越过单项或全局预算。

现有条款挡不住：没有 canonical排序、按类别公平份额、L0保留额度或 registry重排不变性；当前门只测越界，不测合法 starvation。

最小修订：冻结与 registry顺序无关的调度和配额仲裁，为 GA核心 detector保留最低份额；TCK随机重排 detector并插入合法洪泛 pack，仍须保证 L0可发现性和截断 provenance。

## C 级

无。

## 核验记录

- 开始 SHA-256：`7bfe7457b88bf909d9a9d85e4a0f2e0668675aa4bd38e4d8c421ef20645fb576`
- 结束 SHA-256：`7bfe7457b88bf909d9a9d85e4a0f2e0668675aa4bd38e4d8c421ef20645fb576`
- 两次命令：`shasum -a 256 docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`
- 实际本地读取范围：唯一评审对象完整 L1–L3609；未以“当前代码未实现”形成 finding，未编辑仓库。
- 外部交叉范围：RFC 8628、RFC 8705、TUF Specification、Gemini API、SLSA build requirements；另执行两路独立只读交叉评审后由主评审逐项回读验证。
- 最终结论：`VERDICT: FAIL`。