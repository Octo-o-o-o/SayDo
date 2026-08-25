FAIL

### A-1（上一轮 A-1 残留）：Phase 0 指向错误的控制桥 canonical

位置：[方案 §0](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:14)、[Phase 0](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:790)。两处都指定不存在的 `docs/modules/c-tier1.md`；真实入口是 [08 索引](docs/08-module-design.md:5) 指向的 [c-control-bridge.md C2](docs/modules/c-control-bridge.md:15) 与 [C5](docs/modules/c-control-bridge.md:47)。

可复现反例：照方案新建 `c-tier1.md`，D8、执行所有权和审批所有权便会与真实 C 域详设分叉；现有链接门还会屏蔽行内代码路径，[不会检测该错误](scripts/check-doc-links.mjs:30)。

最小修复：两处统一改为 `docs/modules/c-control-bridge.md`，明确回写 C2/C5，并增加 08 索引、D8、09、C2/C5 一致性门禁。

### A-2（上一轮 A-3 残留）：EndpointIdentity 仍可发生 query 碰撞

位置：[§4.5-2](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:349)只拒绝 `secret query`，身份字段没有 query；[失效键](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1229)也只有 scheme/host/port/path。

可复现反例：

```text
https://gateway.example/v1?workspace=A
https://gateway.example/v1?workspace=B
```

两者 query 都不含 secret。若 adapter 保留 query，它们可共享 EndpointIdentity、SecretRef 和旧 receipt，却把凭据或请求投向不同租户。

最小修复：自定义 URL 默认拒绝全部 query；确需 `api-version` 等参数时，移入受限、规范化、版本化的 RequestProfile，并把其 digest 纳入 EndpointIdentity、receipt、activation 和 hard-stop 键。增加参数差异、重排和重复参数 fixture。

### A-3：principal、resource scope 与 policy receipt 没有不可换挂的共同 subject

位置：[AuthSource](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:198)、[PolicyBinding](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:218)、[resourceScopeId](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:243)、[InferenceBinding](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:254)、[Phase 0 反例门](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:800)。

可复现反例：创建非空 `resourceScopeId="scope_all"`，令其允许 `/`、HOME 和任意 egress；再为同一 `surfaceId+operation` 放入重复、相互冲突的 policy binding。当前要求只封死“缺 scope”“空 receipt”和 operation-only 兜底，没有定义 ResourceScope 字段、禁止宽泛范围、唯一匹配规则或跨 connection/revision/scope 换挂检查。Gate 即使逐次被调用，也能依据这个合法的宽 scope 放行。

最小修复：定义判别型、不可变 ResourceScopeReceipt；分别钉住本地规范根目录/解析后路径/操作/egress 与云 account/project/region/deployment。建立包含 connection revision、route/surface、slot/operation、稳定 principal、credential-source digest、scope digest 和 hard-stop generation 的 PolicySubject；要求恰好一个 binding 命中，否则 deny。增加 `/`、HOME、`*`、symlink 逃逸、重复 binding、账号漂移和跨 scope 换挂反例。

### A-4：dynamic failover 的预调用闭包既不完整，也不能冻结

位置：[四槽能力](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:311)、[CC Switch 闭包](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:553)、[调用前规则](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:554)、[调用后重算](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:406)。

可复现反例：evaluator 的有限队列为 `[Claude, GPT]`，两者 rights/billing/data 与预算等价，因此满足第 554 行；thinking 已使用 GPT。Claude 失败后，代理在 SayDo 获知 route 前把 evaluator 请求发给 GPT。同族复核已经发生，事后全槽重算来不及阻止。当前闭包也未要求每个候选具备独立 ModelIdentity/Capability/network receipt，更没有 queue digest/generation；预检后加入海外 PAYG 路由同样可绕过。

最小修复：增加不可变 RouteSetReceipt，钉完整有序队列、每个成员的 endpoint/principal/model/family/protocol/capability/network/rights/billing/data receipt 及桥配置 generation。所有槽约束必须对集合成员逐一成立；调用前原子 pin/freeze 并 CAS 相同 generation。不能冻结或证明完整集合时只能 inventory。

### A-5：失败或取消会释放“已经发生但不可观测”的费用

位置：[重试边界](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:324)、[预算账本](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:388)、[零未授权费用指标](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1157)。

可复现反例：预留 1 美元后 provider 已执行并扣费，但 usage 响应丢失。daemon 按“失败后释放未用余额”归还额度并重试；重复 N 次仍显示只消费 1 美元预算，真实账单却可达 N 美元。取消和发送后崩溃也一样。

最小修复：账本增加 `reserved → sent → settled | charge_unknown`。只有证明请求未发出，或经权威 usage/账单确认未收费，才能释放；发送后的超时、取消、断线和崩溃保留最坏金额，重试另行预留。绑定 provider request/idempotency ID，并加入响应丢失、首 token 后取消、发送后 kill、迟到 usage 测试。

### A-6：单协议 SpendAuthorization 无法授权双协议自检

位置：[单次授权字段](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:384)绑定单个 `protocol`；[Custom Endpoint](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:469)却允许一次确认后依次发送最多两个协议的生成请求。

可复现反例：候选为 Chat 和 Messages。授权若绑定 Chat，第二个 Messages 请求越权；若绑定 Messages，第一个越权；当前 Protocol 枚举也没有可安全使用的 `auto` 值。

最小修复：授权绑定有序、有限的 `(routeId, endpointDigest, model, protocol, requestProfileDigest)` 尝试集合及聚合请求/token/金额上限，并为每次尝试原子消费子额度；否则每切换一次协议都重新确认。增加首协议失败、第二协议成功的授权匹配 fixture。

### A-7：activation 的 verify→promote 之间没有全资源 generation fence

位置：[两阶段协议](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:412)、[prepare/verify](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:414)、[promote](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:416)、[Phase 0 验收](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:802)。

可复现反例：verify 通过后、promote 前撤销 rights、修改 route-set/resource scope，或轮换 broker ACL；connection revision 不变。promote 明确只复查 secret 存在/ACL并 CAS SQLite pointer，外部状态还可在复查与 CAS 之间变化，最终激活的是从未整体通过验证的组合。“全资源 digest journal”没有给出可消除该 TOCTOU 的比较代际。

最小修复：定义不可变 ActivationManifest，列出全部 binding、secret/ACL attestation、scope、endpoint/request profile、adapter、model/capability、rights/billing/data、RouteSet 和 hard-stop policy 的 `{id,generation,digest}`。外部资源必须提供不可变版本或 fencing token；最终事务紧邻 pointer CAS 复核完整 manifest，开放流量前设 activation barrier，每次 dispatch 再核 manifest/hard-stop generation。

### A-8（上一轮 A-13 残留）：现有全局隐私承诺没有被机械撤销

位置：当前 canonical 仍固定显示[“本机运行 · 数据不出这台电脑”](docs/11-ui-spec.md:471)；方案虽要求 DataBoundaryReceipt [支撑数据去向](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:394)，但 [Phase 0](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:792)没有点名撤销该文案或设置反例门。

可复现反例：接入 OpenAI、Anthropic 或海外 gateway，正确显示其 DataBoundary 卡片，同时原样保留页尾；用户会同时看到真实云路径与“数据不出这台电脑”。

最小修复：Phase 0 明确修改该 canonical：固定页尾至多表述核心服务本机运行；“数据不出本机”只能在全部 active route 均有可信本机处理证明时动态显示。增加本地、云 API、gateway route drift 三组 Playwright 文案反例。