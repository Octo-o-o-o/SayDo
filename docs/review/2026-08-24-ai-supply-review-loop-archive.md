# AI 供给专题 · v1–v20 评审循环归档

- 归档日期:2026-08-24
- 来源:`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md` 原 §17「本方案评审闭环」
- 原文行号:48,069–48,809(共 741 行)
- 归档原因:该节是 20 轮「第 N 次终审 + 第 N 次回修」的过程记账,不是设计内容。
  它随每轮评审线性增长,把主方案从设计文档变成了评审台账。
  按 `docs/review/2026-08-24-ai-supply-v20-loop-diagnosis.md` 的结论,过程记账应与设计分离。

本文件为**原样归档,未做任何改写**,作为 v1–v20 的过程证据保留。
主方案不再携带本节;后续评审记录改为落在 `docs/review/` 与 `history/PROCESS-JOURNAL.md`。

三路终审报告原件仍在 `research/codex-findings/`,prompt 原件仍在 `prompts/`。

---

## 17. 本方案评审闭环

### 17.1 初审输入与结论

同一草案在未回修前接受三路只读评审：

| 评审 | 角度 | 原始结论 |
|---|---|---|
| subagent A | 仓内 canonical、迁移、安全、Phase 依赖和门禁 | `FAIL`；10 A、8 B、3 C |
| subagent B | 中国大陆/全球生态、订阅权益、费用和用户交互 | `FAIL`；8 A、6 B、3 C |
| Codex `gpt-5.6-sol` max | 零上下文对抗性复核 | `FAIL`；13 A、5 B、2 C |

Codex 输入见 [`prompts/95-ai-supply-universal-onboarding-adversarial-review.md`](../../prompts/95-ai-supply-universal-onboarding-adversarial-review.md)，原始报告见 [`research/codex-findings/95-ai-supply-universal-onboarding-adversarial-review.md`](../../research/codex-findings/95-ai-supply-universal-onboarding-adversarial-review.md)。三路数量是各自独立分级，存在重叠，不能相加当作唯一问题数。

### 17.2 Triage 与回修

| 合并后的问题族 | 分级 | 行动 | 修订落点 |
|---|---|---|---|
| active pointer/dirty canonical/PLAN-2 坐标冲突 | A | 变成 Phase 0 之前的硬停门，branch/clone 不再被描述成豁免 | §0、Phase 0、§14 |
| D8 与 App Server/ACP 归属冲突 | A | 上浮 owner；同步 D7/D8/D18、09 多节与 modules/c | §0、Phase 0、§14 |
| 单一 Connector 可混装 plane/model/protocol | A | 拆 connection、per-slot binding、execution agent 和 immutable receipts；严格判别联合 | §4.1–§4.3 |
| 事件、工具、Gate 0 与逐工具 gate 不可判定 | A | 增加 event state machine、逐调用 cage、dispatch/per-tool receipt、unknown deny+kill | §4.3、§6.2、Phase 2/5 |
| secret、endpoint、SSRF、代理、云 metadata 边界 | A | broker-only、EndpointIdentity、DNS-to-socket pin、安全 dialer、显式 proxy、credential egress | §4.5、§6.5–§6.6、Phase 1/7 |
| rights、billing、data 去向不可执行 | A | 三类版本化 receipt；资金/route/overage 正交；SpendAuthorization 原子预算 | §4.6–§4.8、§7 |
| migration 只有升级没有降级，跨介质非原子 | A | inactive dual-read、v31+ additive、activation journal/CAS、上一版真实降级 | Phase 0/1/3、§11–§12 |
| registry 可回放且技术数据越权决定权益 | A | 独立签名域、generation/expiry/revoke/anti-rollback、人工 decision source | §4.4、Phase 3 |
| evaluator 可被用户 family/gateway route 绕过 | A | 可验证模型/上游身份、fallback 全槽重算、双 readiness | §4.3、§4.8、§7、§12 |
| Discovery 会执行 PATH 程序或读取第三方历史 | A | 自动阶段纯静态，执行进 cage，文件/二进制 sentinel | §6.1、Phase 1/4 |
| Gemini/Kimi/中国 Coding Plan/CC Switch 事实失真 | A | Gemini/Antigravity、Kimi API/Agent、普通 API/套餐、Desktop/CLI fork 全部拆项 | §6.2、§6.4、§9、Phase 3/5 |
| 一键激活与真实自检费用不透明 | A | candidate/可激活/已验证分层；显示请求/token/最坏费用；单次/持久授权分离 | §3、§4.6、§8、§12 |
| receipt 失效仍继续调用 | A | hard-stop/soft-stale 分类，route/rights/billing/data 变化立即停 | §4.8、§13 |
| conformance/推荐器顺序与阶段验收互相依赖 | A/B | harness 前移 Phase 2；Phase 1 不激活；Phase 4 只验候选，完整推荐留 Phase 6 | Phase 1–4、Phase 6/8 |
| SLO、平台、企业网络和门禁不唯一 | B/C | 唯一 SLO、样本基线、planned `lint:all`/benchmark、平台与企业网络矩阵 | §6.6、§12、Phase 7 |
| URL、术语、字段等证据卫生 | C | 补 `provider_order`，改稳定 URL，L0/L1/L2 去除 P0 歧义，指纹改 keyed HMAC | §1、§4.5、§9、§15 |

初审的全部 A 级已在第一轮回修中转化为明确合同、机械门禁或 owner 前置阻断；B/C 中影响可实施性与用户承诺的项目已吸收。这不等于宣告已通过收口，后续仍按下节构造新反例。排产坐标和 owner 十项决策仍是**预期的开工阻断**，不是授权施工方自行补全的悬空设计。

### 17.3 收口复核与二次回修

第一轮回修后，两个互补 subagent 分别从仓内合同和生态/交互角度给出 `PASS`，但独立 Codex 收口复核仍给出 `FAIL`，确认 8 个“即使完全照方案实施也可复现”的 A 级缝隙。输入见 [`prompts/96-ai-supply-universal-onboarding-closure-review.md`](../../prompts/96-ai-supply-universal-onboarding-closure-review.md)，原始报告见 [`research/codex-findings/96-ai-supply-universal-onboarding-closure-review.md`](../../research/codex-findings/96-ai-supply-universal-onboarding-closure-review.md)。

| 收口阶段 A 级反例 | 二次/定向回修 | 修订落点 |
|---|---|---|
| 指向不存在的旧 C 域文件，或五处 canonical 只做弱关键词检查 | 改为真实 C2/C5；五处写同一机器可读投影，专用脚本逐字段和 anchor 对账，隔离测试逐个只漂移一处并要求非零 | §0、Phase 0 |
| query 未进 EndpointIdentity | 自定义 URL 默认禁 query；受限公开参数规范化进 RequestProfile digest | §4.2、§4.5、Phase 1 |
| principal/scope/policy receipt 可换挂 | 新增 AuthSubject、判别型 ResourceScopeReceipt、完整 PolicySubject 与恰好一条命中 | §4.2、Phase 0/1 |
| dynamic failover 无完整可冻结闭包 | 新增 RouteSetReceipt，成员全收据笛卡尔积检查与调用前 generation CAS | §4.2–§4.3、§6.4、Phase 5 |
| 发送后失败会误释放费用 | 账本增 `sent/charge_unknown`，无权威免费证明不释放，截止时悲观提交 | §4.6、Phase 3、§12 |
| 单 protocol 授权不能覆盖双协议自检 | 改为有序有限尝试集合 + 逐项子额度 + 聚合上限 | §4.6、§5.3、Phase 3 |
| verify→promote 缺全资源 fence | 新增 ActivationManifest、fencing token、activation barrier、紧邻 CAS 与逐 dispatch 复核 | §4.9、Phase 0/3、§12 |
| 云路由与全局“数据不出本机”自相矛盾 | 撤销固定承诺，改为全 data-egress graph 真值表驱动的动态文案；远程 API 门前移 Phase 3，Execution Agent 反例进 Phase 5 | Phase 0/3/5/6、§12 |
| loopback 被误当成本机计算 | 新增模型级 ComputeBoundary core；Ollama cloud/LM Link 按 cloud/LAN 建模，绑定 principal/费用/数据并 hard stop | §4.2–§4.8、§6.3、Phase 4、§12 |
| transport 与真实 compute 主体仍可换挂 | 新增 `InferenceResourceSubject` 的双主体/双 scope，以外层 ComputePolicyBinding 绑定 PolicyBinding、RouteSet、Spend、Activation；direct/gateway/bridge 交换反例 fail-closed | §4.2、§4.6、§4.9、Phase 0/1/3/4/5 |
| ComputeBoundary 与 policy receipts 互相引用形成 digest 环 | 拆成无反向引用的 core 和后置 ComputePolicyBinding，规定 producer 顺序并加入可重算正向 fixture | §4.2、Phase 0 |
| Capability 可跨实际 compute member 换挂 | Capability 绑定 resource subject、core、effective route、model identity；Binding/RouteSet/Spend/Activation 精确同一并加三时点拒绝反例 | §4.2–§4.3、§4.6、§4.9、Phase 0/3/4/5 |
| 单一 policy binding 无法覆盖 chat→tool_roundtrip | InferenceBinding/RouteSetCore 改为 operation-indexed 无重复集合，dispatch 恰好命中一项并加正反例 | §4.2、Phase 0/2 |
| 多 route/member 共用顶层 Spend subject | 费用身份闭包下沉至每个 attempt/member，顶层仅保留聚合上限；协议/成员切换重新预留 | §4.6、Phase 3 |
| 首次 conformance 依赖尚未生成的 observed model/Capability | 新增候选 subject/boundary/policy/route set 与一次性 ConformanceAuthorization；响应后才生成 runtime 闭包 | §4.2、§4.6、Phase 0/3 |
| bridge 一次 ingress 可连续计费多个上游 | 冻结 InvocationEnvelope，按最坏调用序列总和预留；A charge_unknown 与 B settled 分别记账 | §4.2、§4.6、Phase 3/5 |
| 首测 local boundary 比 runtime 证明更弱 | 两阶段共用类型化 LocalComputeEvidence；缺 device/process/artifact/local-only 任一项时首测零请求或按远程边界重确认 | §4.2、§6.3、Phase 4 |
| 同一 local runtime 的模型证据可换挂 | LocalComputeEvidence 绑定 attempt/route/requested model/route→artifact；响应后另绑 observed identity→同一 artifact | §4.2、Phase 4 |
| 首测候选链与 runtime 能力链没有防换挂接缝 | ConformanceResult 绑定已消费授权/ledger/请求响应/terminal 与最终 route/model/subject/core/adapter，Capability/RouteSet/Activation 必引 | §4.2–§4.3、§4.9、Phase 0/3 |
| route_set binding 被迫携带一个成员的单值证据 | InferenceBinding 改 fixed/route_set 判别联合；动态分支只引用完整 RouteSet，Activation 按 ordinal 比对全部成员 | §4.2、§4.9、Phase 0/3 |
| 激活快照冻结可消费 runtime 授权，混淆连接与付费同意 | Manifest 只冻结 FundingPolicyTemplate；具体授权在 dispatch 取得，缺失/过期只锁付费请求，Conformance 同意不升级 | §4.6、§4.9、Phase 3/6 |
| 首测 preflight 与首字节之间可切账号/route/device | 每个 attempt 增 CandidateRouteFence，发送 lease 首字节前复核；无 admission token/callback/immutable config 时只 inventory | §4.2、§4.6、Phase 0/4 |
| 首测前 DataBoundary 反向依赖响应后的 effective route | 拆 Candidate/runtime DataBoundary，ConformanceResult 验证实际值属于事前完整披露集合；candidate 不满足 runtime 承诺 | §4.2、§4.7、Phase 0/3/4 |
| RouteSet 把 CNY、USD 或 provider credits 塞进单一金额，授权与账本无法守住上限 | Conformance/Runtime/持久预算全部改用 canonical `BillingLimitVector`；最坏序列逐单位聚合，账本逐单位 reserve/settle/reconcile，首版禁止隐式 FX | §4.6、Phase 3、§12 |
| CandidateBilling 为 CNY，响应后 runtime Billing 漂成 USD 仍可激活 | 新增 BillingMatch/anomaly 接缝，逐项绑定 candidate/runtime/authorization/ledger；新增单位、价格/资金语义漂移或超限均零 ConformanceResult、零激活并独立记费用异常 | §4.2、§4.6、Phase 0/3、§12 |
| runtime worst 为 CNY 1，实账 CNY 5，二者只分别受 CNY 10 总 cap 覆盖 | BillingMatch 增逐单位完整不等式和 InvocationEnvelope terminal ledger 总和；runtime worst 被击穿或 entry 漏/重/错 member 进入专用 anomaly | §4.2、§4.6、Phase 0/3、§12 |
| 单值 BillingMatch 可匹配 chat/CNY，却激活 tool_roundtrip/USD binding | CandidateBilling 增 runtime operation 投影；每个 operation 建准确 ComputePolicyBinding/runtime Billing closure，并与 fixed/RouteSetCore 集合完全相等 | §4.2、§4.6、Phase 0/3、§12 |
| Match 可把真实 1 元 candidate/auth/reserve 抄成 10 元，或把 ledger 5 元低报为 0 | 删除所有可填写金额副本；固定 fold 从 typed refs 重算，strict schema 拒 summary，构造/verify/promote/dispatch 均重验 | §4.2、§4.6、Phase 0/3、§12 |
| dynamic 只验成功 B，A 的 runtime worst 1/held 5 可被 10 元 aggregate 掩盖 | coverageSources 必须覆盖全部 sent attempt；逐 member 先验完整链，再聚合 ingress，任一成员异常即零 covered | §4.2、§4.6、Phase 0/3、§12 |

表中前 8 项来自 Codex 96。其后的定向 subagent 复核又把 A-8 的运行时门前移到首个远程 API 激活之前，并将真值表扩到 Execution Agent；生态复核另构造出 loopback 云/LAN offload 的新反例，形成表中第 9 项；后续仓内/生态复核继续构造出双主体换挂、digest 环、跨 compute capability 换挂、operation 基数、费用授权基数、首次 conformance producer 环、bridge 序列费用、首测本地证据过弱、同进程模型换挂、候选/runtime 接缝换挂、route_set binding 基数、激活/付费同意混淆、首测 route TOCTOU 与候选/runtime 数据边界 producer 矛盾，形成第 10–23 项。Codex 97 最终门又指出 canonical 门禁仍不可机械判定，以及异币种 RouteSet 仍被压成单金额；前者回修进 Phase 0 的五投影专用对账与漂移自测，后者形成第 24 项的分单位预算向量。Codex 98 对这两项给出 `PASS` 后，生态定向复核进一步构造出同成员 candidate CNY→runtime USD 漂移，形成第 25 项 BillingMatch/anomaly 接缝。Codex 99 对该接缝给出 `PASS` 后，两路定向复核继续发现 runtime worst/实账缺不等式与单值 BillingMatch 跨 operation 换挂，形成第 26–27 项并回修为完整数值链和 operation-specific closure。Codex 100 与两路复核随后共同确认可填写数值副本和 dynamic 只验成功成员仍能绕过，形成第 28–29 项；最终改为无金额副本的 typed-ref deterministic fold 和全 sent-member 覆盖。

### 17.4 前一版收口结论

在本轮“参考实现级开源架构”增强之前，当时的 reviewed contract 已无未处置 A 级。两路独立复核在当时最后一版分别从仓内合同/DAG/门禁和生态计费/主动被动交互角度给出 `PASS`；零上下文 Codex 101 也给出 `PASS`。该轮只读输入的方案 SHA-256 为 `69ddf7081241cdc55c515934855d059b4317283dd635181128ea1bf5e1159a74`。本轮新增 IR、SDK/TCK、控制/数据面、plugin 隔离、性能和供应链合同后，不能沿用该 `PASS`，必须以 §17.5 的新评审为准。

终审链没有用早到的 `PASS` 掩盖后发现的问题：

| 轮次 | 结论 | 处置 |
|---|---|---|
| Codex 97 | `FAIL`：canonical 门不可机械判定、异币种金额不可相加 | 五处机器投影与漂移自测；分单位预算向量 |
| Codex 98 | `PASS`：确认上述两项关闭 | 生态复核随后继续攻击新接缝 |
| Codex 99 | `PASS`：确认 candidate/runtime Billing 身份接缝 | 两路复核随后发现数值链和 operation 基数漏洞 |
| Codex 100 | `FAIL`：派生向量可伪造、dynamic 可漏验非成功 member、Phase 0 缺专用门 | 删除金额副本，改 typed-ref deterministic fold；覆盖全部 sent member；补合同门命令 |
| Codex 101 + 两路最终复核 | `PASS` | 无剩余可复现 A 级 |

终审输入与原始结论：

- [`prompts/97-ai-supply-universal-onboarding-final-closure-review.md`](../../prompts/97-ai-supply-universal-onboarding-final-closure-review.md) / [`Codex 97`](../../research/codex-findings/97-ai-supply-universal-onboarding-final-closure-review.md)
- [`prompts/98-ai-supply-universal-onboarding-final-gate-review.md`](../../prompts/98-ai-supply-universal-onboarding-final-gate-review.md) / [`Codex 98`](../../research/codex-findings/98-ai-supply-universal-onboarding-final-gate-review.md)
- [`prompts/99-ai-supply-universal-onboarding-billing-closure-review.md`](../../prompts/99-ai-supply-universal-onboarding-billing-closure-review.md) / [`Codex 99`](../../research/codex-findings/99-ai-supply-universal-onboarding-billing-closure-review.md)
- [`prompts/100-ai-supply-universal-onboarding-final-billing-gate-review.md`](../../prompts/100-ai-supply-universal-onboarding-final-billing-gate-review.md) / [`Codex 100`](../../research/codex-findings/100-ai-supply-universal-onboarding-final-billing-gate-review.md)
- [`prompts/101-ai-supply-universal-onboarding-derived-billing-final-review.md`](../../prompts/101-ai-supply-universal-onboarding-derived-billing-final-review.md) / [`Codex 101`](../../research/codex-findings/101-ai-supply-universal-onboarding-derived-billing-final-review.md)

上述前一版“评审通过”只表示当时的**专题方案**可以交给 owner 审批并等待并入唯一排产源，不表示任何生产代码、canonical 回写、provider preset、自动探测器或未来测试已经实施。当前仍禁止进入 Phase 0：必须先完成 §0 的 active pointer/dirty canonical/PLAN-2 坐标开工门，并取得 §14 十项 owner 决策。计划中列出的 `billing-match-contract`、canonical consistency 等命令是未来阶段的验收门，本轮没有伪称它们当前已存在或已通过。

### 17.5 参考实现级增强审查

本轮新增 IR、SDK/TCK、控制/数据面、插件、跨平台性能与开源治理后，以 SHA-256 `7fb98df5defe9f96dcc917067f645e4e7c1cac0148691c0e9f0633a5f964884c` 作为共同初审输入。三路都给出 `FAIL`，因此没有沿用 §17.4 的旧 `PASS`：

- [`prompts/102-ai-supply-reference-architecture-review.md`](../../prompts/102-ai-supply-reference-architecture-review.md) / [`仓内架构原始报告`](../../research/codex-findings/102-ai-supply-reference-architecture-review.md)
- [`prompts/103-ai-supply-ecosystem-oss-review.md`](../../prompts/103-ai-supply-ecosystem-oss-review.md) / [`生态与开源原始报告`](../../research/codex-findings/103-ai-supply-ecosystem-oss-review.md)
- [`prompts/104-ai-supply-reference-grade-adversarial-review.md`](../../prompts/104-ai-supply-reference-grade-adversarial-review.md) / [`Codex 104 原始报告`](../../research/codex-findings/104-ai-supply-reference-grade-adversarial-review.md)

合并 triage 与回修如下：

| 初审问题族 | 回修结果 | 落点 |
|---|---|---|
| native plugin/Execution Driver 只有同 UID 子进程 | 正式 capability 模式改为三平台 OS-enforced deny-by-default sandbox；直接 syscall TCK；缺 backend 只 inventory | §4.10、§4.13、Phase 5/8、§12–§15 |
| hard-stop 只挡新请求 | generation 屏障同步 abort 全部 in-flight transport/session/process/tool gate，已发费用 `charge_unknown`，崩溃可恢复 | §4.8–§4.9、§12 |
| adapter 可漏 occurrence 或忽略未知事件 | request/response 双向逐 occurrence coverage；未知 event 默认 fatal，仅 profile allowlist 可忽略 | §4.11、Phase 2、§12 |
| Ollama 冷态无法自举 | 新增禁止下载/外网、content-free 的 LocalPreload 授权与收据链，覆盖 OOM/取消/cloud/LAN | §4.2、§6.3、Phase 4 |
| OpenRouter BYOK 隐藏多key、shared fallback与双计费 | 普通key或PKCE换取key下BYOK只inventory；正式路径要求management fence和逐biller/account component授权/结算 | §4.6、§9、Phase 3、§12 |
| CandidateDataBoundary 可跨成员拼接 | 改为绑定 member/attempt/fence 的完整 `DataBoundaryAlternative` 元组，runtime 只能整体命中 | §4.2、§4.7 |
| Execution Agent 缺费用、peer 身份和 effect-once | 增 session funding/spend/attempt closure、LocalExecutionPeer 与 ToolInvocation durable fencing/人工调和分支 | §4.2、§6.2、Phase 5、§12 |
| plugin 可借 host transport/auth 成为 confused deputy | 插件只能返回纯 wire plan；host 校验、签名并自行发送 single-use prepared attempt；新 secret signer 进入 trusted core | §4.10 |
| snapshot digest、TCK digest 与 runner 责任不确定 | 纯 JSON snapshot core + deep-freeze；deterministic conformance core/run payload/detached attestation；TCK 包独占 runner | §4.12、§4.15、§11–§12 |
| TCK publisher 可自签正式徽章 | verifier policy 钉住 issuer/repo/workflow/ref/builder/provenance；项目 CI 重跑，自签只 `community_unverified` | §4.15、Phase 8、§12–§13 |
| TUF policy 权限仍过宽 | `policy.tuf` 委派 credential-egress/rights/billing/data-boundary/emergency-deny 独立 role/key/threshold/path | §4.4、Phase 0/3、§13–§14 |
| Phase 0/2/3 依赖倒置 | Phase 0 只冻结依赖图；Phase 1 建机械包门；Phase 2 仅 fake/shadow；Phase 3 完整 policy 后首个 production cutover | Phase 0–3、§12.3 |
| 资源预算和 RouteSet 只有“有界”没有数值 | 冻结 detector/plugin 数字 profile 与 `route-set-v1` 六项上限，增大必须新 profile | §4.2、§4.13、Phase 0、§12 |
| 跨平台性能、sandbox、24h soak 与 SDK 发布不可证明 | CI/nightly/release 分层；三平台签名报告与独立 soak；真实 tarball 仓外安装 | Phase 8、§12、§16 |
| 报告 schema 混填、四轴无法表达当前阻断 | protocol/capability/discovery/execution/bridge五类report判别联合；四轴外只计算`ConnectionReadiness`与`SolutionReadiness` | §4.15、§9、§12.4 |
| BigModel/Z.AI 协议外推，OpenCode 产品混装 | BigModel 普通 API 按最新官方证据拆 Chat/Messages，Z.AI 普通 API仍只声明 Chat；OpenCode Zen/Go/Server 分成 payg/subscription/execution 三产品 | §6.2、§9、Phase 3/5、§15 |
| 开源证据可变、贡献治理缺失 | 架构链接固定 commit，动态网页进入 evidence lock；补治理、delegation、晋升/交接/sunset/撤销合同 | §4.15、Phase 0/8、§15–§16 |
| “最多 2 请求”和“2 点击”会掩盖真实成本 | 2 请求仅限 custom protocol probe；其他文案从 InvocationEnvelope 派生；SayDo 点击与厂商外部任务分别计数 | §5.3、§8、§12.1 |

初审回修后，以 SHA-256 `4fbb74de830b6accb470d4abd87e4c9beec3482e822634e7ad7a981944d5cf71` 冻结同一输入做第二次三路终审；三路仍为 `FAIL`，没有把第一轮 triage 当成通过：

- [`prompts/105-ai-supply-reference-architecture-final-review.md`](../../prompts/105-ai-supply-reference-architecture-final-review.md) / [`仓内架构终审`](../../research/codex-findings/105-ai-supply-reference-architecture-final-review.md)：A=5、B=4、C=1。
- [`prompts/106-ai-supply-ecosystem-ux-final-review.md`](../../prompts/106-ai-supply-ecosystem-ux-final-review.md) / [`生态与体验终审`](../../research/codex-findings/106-ai-supply-ecosystem-ux-final-review.md)：A=1、B=1、C=0。
- [`prompts/107-ai-supply-reference-grade-final-adversarial-review.md`](../../prompts/107-ai-supply-reference-grade-final-adversarial-review.md) / [`Codex 107 原始报告`](../../research/codex-findings/107-ai-supply-reference-grade-final-adversarial-review.md)：A=16、B=8、C=0。

第二次终审存在重叠，按可实施边界合并后的回修如下；这里保留每一族的可机械验收对象，不把它们缩成泛泛原则：

| 二次终审问题族 | 回修结果 | 落点 |
|---|---|---|
| runtime 仍复用首测 fence，dynamic sequence 无执行证明 | 新增 fixed/route-set 判别型 template、非空 route→enforcement 映射、ingress single-use lease 与每个物理请求 predecessor-CAS child lease；aggregate cap 不再冒充 route fence | §4.2、§4.12、Phase 3/4 |
| inference/ACP/agent HTTP 共用 endpoint 类型 | 拆 `InferenceEndpointIdentity` 与 `ExecutionEndpointIdentity`，后者绑定 surface/wire profile，两平面连接池与 hard-stop key 永不复用 | §4.2、Phase 1/5 |
| Phase 0 依赖尚未实现的 runtime 行为 | Phase 0 只验 canonical/schema example/阶段映射与受测文档门；Zod、fake runtime、policy/activation 行为分别移到 Phase 1/2/3 | Phase 0–3 |
| catalog、Rights 与 secret endpoint 可被换挂 | 增独立 credential-egress delegation/receipt；official preset 与精确 custom consent 分流，endpoint 改变做到零 secret read/零 packet | §4.2、§4.4–§4.5、Phase 1/3 |
| OAuth flow、首次 key/rights 存在 producer 缺口 | 增完整 PKCE grant、state/code/session/issuer/account binding与 `ProductEligibilityReceipt`；先允许本地录入，后生成 principal-bound Rights/egress | §4.2、§8、Phase 1/3 |
| 本地端口可冒充，既存 runtime 不能事后获得零外网证明 | 增 OS 观察的 local peer、managed/unmanaged 分流和 runtime egress assurance；无法强绑定或隔离时只 inventory/安全重启，preload 限制目标 daemon 而非 helper | §4.2、§4.7、§6.3、Phase 4 |
| provider-hosted tool 可借 chat 粗粒度费用/数据/Gate | 激活冻结 policy template，runtime 每 occurrence 绑定当前 funding/route/data/rights/component reservation；不可逐次 Gate 的有副作用 hosted tool 首字节前拒绝 | §4.2、§4.11、Phase 2/3 |
| response loss 与第三方 decoder 自报安全事实 | raw occurrence/DecodingPlan/ResponseLoss 进入 Conformance/Capability/Activation/runtime terminal；model/route/usage/data/terminal 只接受受信 authority，缺失降级或 `charge_unknown` | §4.11、Phase 2/3/8 |
| Execution Agent 只隔离 driver，费用、session 和 tool effect 可漏闭包 | sandbox 绑定真实 Agent 进程树；按 operation/session funding、全部物理请求 deterministic fold；stable logical tool ID、判别 transition、commit lease、工具独立费用与人工调和 | §4.2、§4.8–§4.10、Phase 5/8 |
| binary verify→spawn TOCTOU | 同一 no-follow object 执行或 immutable content-addressed staging，并核对 spawned image identity | §4.2、Phase 1/5 |
| 空 region、observed model 缺失与 temporal validity 可产生伪证明 | non-empty region tuple、显式 ObservedModel absent、统一可信时间/高水位/最早 expiry/generation 屏障 | §4.2、§4.7–§4.8、Phase 1–3/5 |
| TCK signature 自引用、未绑定 shipped runtime/sandbox | 不含签名引用的 canonical run payload → detached attestation → 外层 release binding 单向 DAG；黑盒启动最终 distribution 并绑定 runtime/sandbox/platform/seed/exit/raw evidence | §4.15、Phase 2/8、§12 |
| 自动发现“零网络”与 loopback 冲突 | 拆 `static_filesystem`、host-owned `passive_loopback_metadata`、`explicit_active`，分别冻结 endpoint/method/path/request/byte/time 预算 | §4.10、§4.13、§6.1、Phase 4/8 |
| parser/plugin 只有字节或单实例预算 | 增 JSON/schema/event/occurrence/regex/CPU slice、worker 阈值，以及宿主 active/RSS/CPU/process/queue/prepared/publisher 全局数值和公平 admission | §4.13、Phase 2/8 |
| OpenRouter BYOK、fallback、最大 RouteSet 与 security flag 仍有运行缝隙 | revision 绑定全部 key/user/model filters；完整 fallback 编进 snapshot；最大图预编译 fold 并进 benchmark；security flag 使用 `revoke_disable` 撤销在途 | §4.6、§4.8、§4.12–§4.13、Phase 3/5/8 |
| 两次 SayDo 点击掩盖外部任务 | 四级 journey contract 对外部任务、MFA、copy/paste、离开/返回、恢复、raw/app time设硬上限；超限自动降为 advanced/beta | §8、§12.1、Phase 6 |
| BigModel 普通 API 漏掉官方 Messages | 中国普通 payg product 下把 Chat 与 Anthropic Messages 拆成独立 route/profile/TCK；继续与 Coding Plan、Z.AI 分离 | §6.2、§9、Phase 3、§15 |

上述两轮 `FAIL` 都是本轮审查证据，不能在最终文档中删除或改写成“已通过”。在继续补强 runtime/local/Execution/OAuth 与生态 UX 后，以 SHA-256 `7bfe7457b88bf909d9a9d85e4a0f2e0668675aa4bd38e4d8c421ef20645fb576` 作为第三次共同只读输入；三路仍给出 `FAIL`，因此顶部状态继续保持“评审中”：

- [`prompts/109-ai-supply-reference-architecture-closure-v2.md`](../../prompts/109-ai-supply-reference-architecture-closure-v2.md) / [`架构闭包复核 109`](../../research/codex-findings/109-ai-supply-reference-architecture-closure-v2.md)：A=4、B=2、C=0。
- [`prompts/110-ai-supply-ecosystem-ux-closure-v2.md`](../../prompts/110-ai-supply-ecosystem-ux-closure-v2.md) / [`生态体验复核 110`](../../research/codex-findings/110-ai-supply-ecosystem-ux-closure-v2.md)：A=2、B=4、C=2。
- [`prompts/111-ai-supply-reference-grade-final-adversarial-v2.md`](../../prompts/111-ai-supply-reference-grade-final-adversarial-v2.md) / [`Codex 111 原始报告`](../../research/codex-findings/111-ai-supply-reference-grade-final-adversarial-v2.md)：A=13、B=8、C=0；事件日志 `logs/111-ai-supply-reference-grade-final-adversarial-v2.jsonl` 以 `turn.completed` 收口。

第三次 triage 不按报告顺序打零散补丁，而按 reference-monitor、证据权限、可扩展边界和真实用户旅程合并如下：

| 第三次评审问题族 | 规范性回修 | 机械验收落点 |
|---|---|---|
| conformance hosted-tool 曾引用响应后runtime template，且authorization未成为send intent的durable前驱 | 拆conformance/runtime authorization；final physical lease仅给条件资格，随后`PhysicalSendAuthorizationBundleReceipt`无漏无重引用准确lease与全部occurrence authorization并由send intent单次消费，只有bundle授予最终发送权 | §4.2、§4.16.1、Phase 2/3、`inference-funding-attempt.model` |
| Execution `session_start` 授权在真实 session 后才产生 | 新增 pre-spawn/connect `ExecutionSessionAdmissionReceipt`；真实 peer/sandbox 后才生成 session lease | §4.2、§4.16.1、Phase 5 |
| runtime/首测 physical lease 可能出现 sibling 或重放 | conformance、inference runtime、Execution 各有 durable cursor；successor CAS、reservation、sent 与 commit token 同事务 | §4.2、§4.16.1、Phase 2/3/5 |
| fixed route 唯一序列与安全 retry 矛盾 | fixed 也用 invocation envelope；每次 retry 是重复 fixed ordinal、独立 lease/reservation/terminal | §4.2、§4.16.1、Phase 3 |
| local 只对 `auth=none` 验 peer，且未证明当前 loaded config/model | 全部 local-device route 每物理请求先 peer lease，再 `LocalComputeLeaseReceipt`；绑定 config/model-load/artifact/file/device/route/egress，secret read 在后 | §4.2、§4.16.1、Phase 4 |
| OAuth device flow 伪用 PKCE callback/code，且缺 client 与 token-exchange egress | 拆 flow authorization、PKCE grant、device grant、逐 exchange/poll lease；绑定 client registration/app/distribution、requested/granted scope、aud/azp与 sensitive egress | §4.2、§4.16.2、Phase 1/3 |
| proxy + mTLS + application auth 不能组合，ACL 可在 session 前后扩大 | 有序 TransportHop 与三类 credential component；逐 component secret/version/principal/egress/ACL，complete-set digest进入 Activation/session admission | §4.2、§4.16.2、Phase 1/5 |
| gateway/provider/remote Agent 可用 self-attestation 给自己授权 | 只接受 SayDo reference monitor 或不同信任域、可测量且不可绕过的 enforcement authority；self-report 只 inventory | §4.2、§4.16.1、Phase 3/5 |
| “数据不出机”遗漏 inherited handle、文件同步、IPC/helper 等出口 | sandbox/data-locality 覆盖完整进程树、FD/HANDLE、mount/sync/temp/log、IPC/shared memory、helper和所有 socket；三平台 canary 直测 | §4.2、§4.16.1、Phase 5/8 |
| signed online catalog 可下发 loopback path，形成 local CSRF | passive request 只能引用 release-bundled immutable capability ID；新 destination/method/path 必须新 release 或 explicit-active | §4.16.4、Phase 4/8 |
| security extractor 没有 field-specific TUF authority | `ExtractorPolicyReceipt<F>` 绑定 field/product/protocol/profile/raw path/rule/repository/role/threshold；跨 field 换挂拒绝 | §4.16.4、Phase 0/3 |
| 时间 receipt 没有可信 issuer/freshness/monotonic lineage | source attestation 绑定 issuer/key/trust/nonce/sample/uncertainty/max-age/boot lineage；假时钟和 replay TCK | §4.2、§4.16.4、Phase 0/3 |
| breaker half-open 可后台做付费生成 | v1 删除自动生成型 probe；自动只允许零生成零费用 metadata，其余由下一正常已授权请求携带 token | §4.16.4、Phase 3 |
| Base URL 与 operation path 解析不确定 | RFC 3986 directory resolution + explicit `api_root\|version_root`；不猜 `/v1`，拒绝 leading slash/dot/encoded separator，三协议矩阵 | §4.16.2、§5、Phase 1 |
| 1 MiB plugin frame 与 32 MiB request/2 MiB event 冲突；stream/handle/evidence 只有单项上限 | 大内容改 host-owned chunked ContentHandle；固定累计 wire、四级 handle/spool、worker 与 evidence-store 总预算和恢复清理 | §4.16.3、Phase 2/8 |
| registry archive 只有“有界”没有准确 profile | 固化 compressed/expanded/files/file/depth/ratio/metadata/delegation/target/node/CPU/wall/temp 数值与 N-1/N/N+1 | §4.16.3、Phase 0/3/8 |
| TCK builder 可接触签名身份 | hermetic untrusted build/test 与独立 verifier/signing 两 job、两 permission domain；immutable digest handoff | §4.16.5、Phase 8 |
| evidence-lock 只有 digest，审查者不能重放投影 | 保存 raw artifact、访问级别、fetcher/canonicalizer、locale/region/account、normalized projection；受限证据分库存储 | §4.16.5、Phase 0/3/8 |
| GA 生态范围非机器确定，Gemini API 无实施归属 | 当时的回修把release固定为`ga-ecosystem-matrix.json`并将Gemini API放入Phase 3 L1；当前v14已据后续官方证据升级为独立L0 API-key垂直切片 | §4.16.5、§9、Phase 0/3/8 |
| Phase 0 没机械覆盖 pointer/baseline/PLAN-2/owner decisions | 独立 preflight 在 canonical edit 前与 Phase 0 收口各跑一次，并要求 batch/decision digest 相同 | §4.16.5、Phase 0、§12.3 |
| discovery 全局预算无公平确定调度 | stable ID 的 deterministic deficit round-robin、核心 detector 保留份额、publisher quota；随机顺序/洪泛 TCK | §4.16.3–§4.16.4、Phase 4/8 |
| stopped Docker 本地服务没有从静态发现到可操作处方的路径 | 自动只识别安装痕迹；一个 explicit-active 动作后 sandbox 只读枚举 stopped container，永不自动启动/拉取/加载 | §4.16.4、§8、Phase 4/6 |
| 真 custom endpoint 因 ProductEligibility/费用 unknown 死锁 | 增精确且非官方的 `user_or_admin_attested_custom`；未知计量逐物理请求 consent，禁 no-new-spend/推荐/fallback | §4.2、§4.16.2、Phase 1/3 |
| closed protocol union 要求每个新 wire 改核心，或跨平面换挂 | builtin + 分域 `ext:inference:`/`ext:execution:`；plane/connector kind/artifact/profile/SDK/TCK binding；fresh extension 的 core diff 为零 | §4.2、§4.10、Phase 1/8 |
| 用户自有 LAN 算力被排除在 no-new-spend，或被误写成本机隐私 | 增 `owned_capacity` 证明覆盖 local/LAN 无逐调用费/overage；LAN 只承诺已有容量，不承诺数据留在本机 | §4.2、§4.6、Phase 4/6 |
| 首次 payg “两次点击”和固定“1 ingress”不真实 | 当时先把readiness拆为connected/conversation并把payg无预算放宽到三动作；当前v14再由versioned graph机械推导，`no_account/signed_out` guided-key最坏路径为四动作 | §4.16.6、§8、Phase 6、§12.1 |
| 多个“或”动作与 i18n 无机械门 | 每状态唯一 `primaryAction` + secondary links；`zh-CN/en-US/ar-SA` typed ICU parity、独立`en-XA` pseudo locale、RTL、长文/200%/screen-reader gate | §4.16.6、§8、Phase 6 |
| parser 可接受 duplicate key/非法 Unicode/危险数字 | strict parser 拒 duplicate key、非法 UTF-8/lone surrogate、非 canonical/不安全数字、encoded separator；chunk/平台 digest 一致 | §4.16.5、Phase 2/8 |

这次回修还统一了公共 TLS leaf 正常轮换与 pin/trust policy hard-stop 的边界，并把 conformance physical lease、owned capacity、Docker cold journey 和费用 renderer 加入阶段门。上述“已回修”只表示文档已写入拟议合同，不等于实现或评审通过。下一步必须针对**回修后的新 SHA**再执行两路全新上下文独立复审与一次零上下文 Codex 对抗复核；只有三路均无未处置 A/B 且文档门禁真实通过，才能把顶部状态改为“方案终审通过”。排产坐标与 owner 十项决策即使届时仍会继续阻断实施。

第三次回修后，以 SHA-256 `a6333241ff6345773d95e5a98c0889f84ef2f223ddecdb38e0e0798a4a855453` 固定 4,379 行、420,572 bytes 的共同输入，发起第四次三路只读闭包复核。三路仍为 `FAIL`，原始失败证据继续保留：

- [`prompts/112-ai-supply-reference-architecture-closure-v3.md`](../../prompts/112-ai-supply-reference-architecture-closure-v3.md) / [`架构闭包复核 112`](../../research/codex-findings/112-ai-supply-reference-architecture-closure-v3.md)：A=5、B=4、C=0。
- [`prompts/113-ai-supply-ecosystem-ux-closure-v3.md`](../../prompts/113-ai-supply-ecosystem-ux-closure-v3.md) / [`生态体验复核 113`](../../research/codex-findings/113-ai-supply-ecosystem-ux-closure-v3.md)：A=1、B=4、C=1。
- [`prompts/114-ai-supply-reference-grade-final-adversarial-v3.md`](../../prompts/114-ai-supply-reference-grade-final-adversarial-v3.md) / [`Codex 114 原始报告`](../../research/codex-findings/114-ai-supply-reference-grade-final-adversarial-v3.md)：A=12、B=5、C=0；事件日志 `logs/114-ai-supply-reference-grade-final-adversarial-v3.jsonl` 以 `turn.completed` 收口。

第四次发现按能被同一合同和门禁关闭的根因合并如下；报告中的每个 A/B 都必须能映射到其中一行，不以重复计数掩盖问题：

| 第四次评审问题族 | 规范性回修 | 机械验收落点 |
|---|---|---|
| inference/Execution 扩展 ID 共域，implementation receipt 可跨平面换挂 | 扩展 ID 改为 `ext:inference:`/`ext:execution:`；implementation 按 plane、connector kind、SDK/TCK kind 判别，第三方 inference code plugin 另强制 policy receipt | §4.2、§4.10、Phase 1/2/8 |
| OAuth 首字节前参数、client 身份、refresh 结果与并发 successor 不闭合 | flow-start 按 PKCE/device 判别；client registration/auth 按 public、secret、private-key JWT、mTLS 判别；durable exchange cursor、terminal 与 credential transition绑定新旧 access/refresh token、issuer/scope/aud/azp/cnf | §4.2、§4.16.2、Phase 1/3 |
| proxy、双 TLS、mTLS 与 application auth 到物理发送前丢组件 | 每 hop 独立 DNS/socket/TLS/SNI/trust/client identity；descriptor 携带排序、无漏无重的全部 egress 与 ACL，完整集合为空才允许 no-credential proof | §4.2、§4.5、§4.16.2、Phase 1/5 |
| conformance/runtime/Execution cursor 可在前驱未 terminal 时发 successor，成功后不能原子停 | 三平面都增加权威 physical terminal；只有失败边可原子推进，success 原子关闭；前驱未 terminal、success 后 next 和 sibling 都要求零字节 | §4.2、§4.16.1、Phase 2/3/5 |
| 事前授权集合与事后实际 `sent` 被错误要求数量相等 | 拆 `AuthorizationDisclosureReceipt` 与 `ActualAttemptReportReceipt`；前者覆盖全部允许序列和上限，后者与 ledger sent 一一对应；实际序列只能是已披露合法序列的前缀/成员且不得超限 | §4.2、§4.6、§8、Phase 3/6 |
| fallback 只有分散的 solution 预算，缺跨 solution 因果、总额和快照闭包 | Activation 冻结 fallback plan；新增跨 solution envelope、总费用/数据闭包、durable cursor、attempt lease 与 terminal edge；否则仅 `failed_before_send` 可重新求解 | §4.2、§4.6–§4.9、Phase 3/5 |
| extractor 输出未绑定、field union 分叉，TUF lineage 不足 | 全链共用唯一 security field union；receipt 绑定 raw occurrence、typed canonical value、目标 subject；保存 root/timestamp/snapshot/delegated metadata 版本摘要、target path/hash/length与 anti-rollback 高水位 | §4.2、§4.4、§4.11、§4.16.5、Phase 0/2/3 |
| 自动生成型 health probe 无完整 operation/policy/funding 合同 | v1 删除生成型后台 probe；自动 half-open 只允许已证明零生成零费用 metadata，其余由下一次正常授权用户请求携带 token | §4.16.4、Phase 3 |
| Execution credential、no-new-spend、session/tool consent、physical cap 与 abort terminal 不可判定 | credential/no-secret、known/unknown metering 全部改为严格联合；新增 Execution 专用 owned-capacity/no-spend proof；session/tool consent 绑定金额、披露与物理 cap；工具增加有证据的 `aborted` terminal | §4.2、§4.6、§4.8–§4.10、Phase 5 |
| inference code plugin 权限、数据范围、sandbox 与 runtime 未进入激活/发送闭包 | 新增 plugin policy receipt，绑定 manifest/publisher/artifact/capability/permission/data/sandbox/IPC/budget；Activation 和每次 PreparedAttempt 都验证最终 runtime sandbox | §4.2、§4.10、Phase 2/8 |
| local conformance/runtime 物理 lease 断链，网络隔离被误写成本机隐私；LAN owned capacity 依赖自报 | conformance/runtime 共用判别物理主体，peer+compute+isolation 全部进入 descriptor；本机完整 data-exit sandbox 与无法圈禁但可证明 local compute 的分支分开；LAN 要求独立 authority 和逐请求 compute lease | §4.2、§4.7、§4.16.1、Phase 4/8 |
| producer 可从 TemporalValidity 漏掉最早过期安全收据 | `temporal-validity-fold-v1` 从规范 manifest security closure 重算非空完整 refs、最早 expiry 和 outcome；compile/promote/send 均重算，不接受摘要副本 | §4.2、§4.8–§4.9、Phase 0/3/5 |
| 真 custom/private endpoint 未知计量仍无首测 producer 或会被伪装成正式 Rights/settled | 增精确且明确非官方的 private-use attestation、首测 unknown-metering consent、ConformanceResult/runtime funding 严格分支；永久禁止推荐、fallback、evaluator、后台请求和 settled/no-new-spend 徽章 | §4.2、§4.6、§4.16.2、Phase 1/3/6 |
| 同名 wire profile 数值冲突，ContentHandle/evidence store 只有单对象上限 | 删除旧数值，只保留一份完整 `wire-budget-v1`；增加 host/publisher/session/attempt 四级 handle、resident/spool/temp/lifetime/recovery 和 evidence-store 聚合预算 | §4.13、§4.16.3、Phase 0/2/8 |
| GA matrix 缺固定 baseline、生态层级、多 auth journey 与受信 gate；matrix/probe release digest 自引用 | 定义 matrix core、mandatory baseline、逐 auth journey和受信 report/attestation/outcome/owner receipt；release digest 只存在于 detached binding，并明确 manifest 排除范围和替换 mutation | §4.16.5、§9、Phase 0/3/8 |
| `review_ready` 无 view-model 行，正式阶段仍允许 B 级进入顶级/GA | 补唯一主动作、降级、双 locale/a11y fixture；reference-grade/GA/DoD 统一要求零未处置 A/B，B waiver 必须自动降级 maturity 并撤销相应声明 | §8、§12、Phase 0/6/8、§16 |

第四次回修将 112/113/114 的全部 A/B 转成了判别联合、单向 receipt DAG、逐请求 reference-monitor lease、固定派生算法或 release gate；这仍只是“拟议修订已落入本文”，不是新的通过证据。必须以当前修订后的新 SHA 再做第五次全新上下文三路终审；若任一路仍能给出可复现 A/B，继续回修并重新冻结，不得把顶部状态改为通过。

第五次终审以 SHA-256 `79ad953a4dbb200100ff5362079928b0e8f0e03837cae1401e6b8b6fe19c27dd` 固定 5,341 行、471,590 bytes 的同一目标。三路仍为 `FAIL`，故第四次后的“拟议修订”不能冒充闭包：

- [`prompts/115-ai-supply-reference-architecture-final-closure-v4.md`](../../prompts/115-ai-supply-reference-architecture-final-closure-v4.md) / [`架构闭包复核 115`](../../research/codex-findings/115-ai-supply-reference-architecture-final-closure-v4.md)：A=4、B=6、C=0。
- [`prompts/116-ai-supply-ecosystem-ux-final-closure-v4.md`](../../prompts/116-ai-supply-ecosystem-ux-final-closure-v4.md) / [`生态体验复核 116`](../../research/codex-findings/116-ai-supply-ecosystem-ux-final-closure-v4.md)：A=1、B=6、C=1。
- [`prompts/117-ai-supply-reference-grade-final-adversarial-v4.md`](../../prompts/117-ai-supply-reference-grade-final-adversarial-v4.md) / [`对抗复核 117`](../../research/codex-findings/117-ai-supply-reference-grade-final-adversarial-v4.md)：A=11、B=6、C=5。Codex在读取目标前命中 usage limit，失败事件保存在 `logs/117-ai-supply-reference-grade-final-adversarial-v4.jsonl`；确认零报告落地后按规定回落到 Grok。该回落报告还抽查了两份源码，因此只作为补充攻击输入，不能替代下一轮严格“只读目标、零旧报告”的 Codex终审。

第五次发现与本轮进一步自审按根因合并如下。这里的“回修”仍只表示拟议合同已经落盘，不表示评审或实现通过：

| 第五次问题族 | 规范性回修 | 机械验收落点 |
|---|---|---|
| OAuth success terminal与 credential transition形成 digest环；device code缺响应 producer | 改为 success evidence → transition → commit单向链；新增 device authorization result，绑定 flow/client/issuer/session/user/request/handle/expiry | §4.2、§4.16.2、Phase 1/3 |
| OAuth可跨 flow、exchange kind、refresh family或 daemon实例换挂 | PKCE/device/refresh使用严格 flow/lease判别型别；cursor/lease/terminal/commit全带 writer lease/epoch，commit逐字段验证同一 flow/ordinal/success/transition/revision | §4.2、§4.16.1–§4.16.2、Phase 1/3 |
| Activation-time fallback依赖 runtime授权；solution间因果与费用结果不闭合 | 拆不可消费的 `FallbackPlanTemplateReceipt` 与 per-ingress envelope/admission；逐 solution cursor/lease/terminal绑定当前 FundingDecision、聚合 reservation、披露和 sent/billing双轴 | §4.2、§4.6–§4.9、Phase 3/5 |
| Execution tool只有 invocation级 consent，真实外部请求/effect可重复 | 增 tool request cursor、逐 external request ordinal lease/terminal与逐 effect ordinal commit lease；no-charge只接受网络/副作用出口和计费组件均为零的严格证明 | §4.2、§4.8–§4.10、Phase 5/8 |
| runtime sender未绑定当前 FundingDecision；关键 Rights/Network/Billing/authorization仍可塞任意 receipt | runtime lease、descriptor、fallback/tool/execution发送链全部使用具名判别 receipt；关键 cursor/terminal/policy外键改为可遍历强类型，不接受通用引用替代授权 | §4.2、§4.6、§4.16.1、Phase 0/2/3/5 |
| Execution terminal、no-secret、owned-capacity和 attempt report可表达非法笛卡尔积 | terminal拆 sent outcome与 billing disposition严格交集；no-secret/owned-capacity分 trusted local与 independent authority；披露/报告按 conformance/runtime/fallback/session/tool分支并绑定权威 ledger range subject | §4.2、§4.6、§4.8–§4.10、§4.16.6、Phase 5/6 |
| Execution extension的 implementation/TCK未贯穿对象图 | surface、Connection、Activation、admission、session lease逐层保存同一 plane/wire/implementation/TCK/distribution；ACP stdio/HTTP独立 wire kind | §4.2、§4.10、§4.16.1、Phase 1/5/8 |
| evidence temp并发可超过 orphan recovery cap | temp与 potential-orphan共同受128 MiB原子 admission硬上限，journal/staging/rename/crash cleanup加入 N-1/N/N+1 | §4.13、§4.16.3、Phase 2/8 |
| forward/intercept proxy可看见应用凭据和prompt，却只披露origin | transport分 logical recipient、observable/plaintext processor set与授权 processor set；CONNECT/SOCKS仅在端到端TLS未终止时视为不可见，custom CA inspection触发独立 secret/data processor授权与hard stop | §4.5、§4.16.2、Phase 1/3/5 |
| CONNECT/SOCKS可由proxy远端重解析绕过本地SSRF pin | origin是独立terminal hop；host-pinned只交付已批准IP并保留Host/SNI，remote resolution必须有独立 destination enforcement authority，否则零字节 | §4.5、§4.16.2、Phase 1 |
| 开放 header可旁路secret broker；upstream-managed auth可旁路OAuth | `RequestProfile`只允许版本化公开常量，credential/organization/project identity全部进入broker component；upstream-managed credential只允许具名官方Execution surface并要求可验证broker authority | §4.2、§4.5、§4.16.2、Phase 1/5 |
| application auth与mTLS不正交，mTLS-only gateway不可表达 | 增严格 `transport_mtls_only`，client identity component、peer、ACL、egress与application-auth-none policy必须同时命中；placeholder key负例零secret read | §4.2、§4.5、§4.16.2、Phase 1/3 |
| 自动metadata probe可能带凭据/计费却记sent=0 | 自动half-open仅限loopback、auth-none、release-bundled且有权威zero-generation/zero-cost proof；其他metadata也走用户FundingDecision、credential egress与sent/terminal ledger | §4.16.4、Phase 3/4 |
| `charge_unknown`与retry/fallback控制混成一个状态 | retry outcome与billing disposition正交；after-send后继必须命中事前edge、aggregate reservation并保留前一项最坏预留/charge-unknown ledger | §4.2、§4.6、§4.16.1、Phase 3/5 |
| usage维度缺cache/reasoning/image/audio/minimum等完整形状 | 固定可扩展 `UsageDimensionId`/profile、逐raw occurrence coverage和component mapping；未知维度保留并进入anomaly/charge-unknown | §4.2、§4.11、Phase 2/3/8 |
| daemon双实例、OIDC nonce、TLS 0-RTT与staged/live授权仍有重放缝隙 | 全 durable writer加storage fencing epoch；OIDC flow-start冻结nonce并具名校验；所有凭据/生成/非幂等请求禁0-RTT；staged/live共用一个决定下的两个显式子预算 | §4.2、§4.5–§4.6、§4.16.1–§4.16.2、Phase 1/3/8 |
| requested/granted scope字面相等会拒绝合法缩权或接受扩权 | 固定canonical set与alias规则，要求 `granted ⊆ requested` 且覆盖minimum；超集、重复、顺序换挂有mutation | §4.16.2、Phase 1/3 |
| 中国/国际realm停在品牌级，长尾缺华为与系统本机模型 | MiniMax、SiliconFlow、百炼、火山方舟/BytePlus各按realm/key/endpoint/billing/data拆entry；华为ModelArts/MaaS、Foundry Local、Apple Foundation Models以具名inventory/L2进入，不经TCK不进GA | §6、§9、§15、Phase 3/4/7 |
| Docker Model Runner只有名称没有journey | 固定disabled/API-off/no-model/cold/loaded/port-conflict状态；静态只识别安装，用户确认后只读枚举，绝不自动enable/pull/load | §4.16.4、§6.3、§8–§9、Phase 4/6 |
| maturity/readiness词表和早期多个主动作漂移 | 只保留五套正交canonical词表并拒绝旧混合字段；每个机器状态唯一`primaryAction`，其他路径均为secondary link | §4.16.5–§4.16.6、§8–§9、Phase 0/6 |
| GA baseline不能证明category/逐auth journey，旧报告可挂新binary | baseline固定required entry/category/journey与minimum；detached evidence set精确覆盖并绑定当前distribution、report/attestation、auth/realm/category，旧distribution mutation失败 | §4.16.5、§9、Phase 0/3/8 |
| matrix或implementation把当前release digest写回被测artifact会自引用 | 稳定matrix/implementation core先入distribution；黑盒测试后才生成包外 journey evidence、implementation receipt、release binding与其attestation，manifest scope排除全部detached metadata | §4.10、§4.15–§4.16.5、§11、Phase 0/2/8 |
| 隐私文案遗漏swap/coredump/VRAM/snapshot/backup等设备级侧信道 | 对外承诺收窄为已验证的SayDo进程树出口，设备级残余固定披露；只有完整sandbox分支才能显示本轮本机处理 | §4.7、§4.16.1、§8、Phase 5/6/8 |
| 已确认的边界未全部固化成fixture，或builtin ID被误当成已交付 | 按安全性质列出具名suite/positive/negative/mutation与Phase gate；builtin ID须同时进入implemented manifest、TCK、feature flag与GA evidence才可激活 | §4.10、§12、Phase 0–8 |
| ACP、SSE resume、workload identity、Unix socket和OCSP边界不明确 | ACP拆stdio/HTTP；消费字节后禁自动SSE resume；workload source用判别lease；Unix socket/named pipe inference明确不在v1；证书吊销由版本化trust policy按环境判定 | §4.2、§4.5、§5、Phase 1/2/5/8 |

第五次回修后的本地自审还主动拆除了旧GA matrix core内嵌当前release报告造成的摘要环，并将 `AuthorizationDisclosureReceipt`、`ActualAttemptReportReceipt`、OAuth exchange、fallback、Execution request/tool与关键 policy链进一步收紧为强类型判别联合。下一步仍必须冻结新的 SHA并执行两路全新上下文独立复审与一次严格目标-only Codex对抗复核；三路未同时达到零未处置 A/B前，顶部状态继续保持“评审中”。

第六次终审以 SHA-256 `37f8d831088c8613ef5d91c6ad8d40d73e6d63b2797cf662e26ea3bba60034ff` 固定 6,580 行、552,023 bytes 的同一目标。两路 subagent 均使用全新零上下文，只读完整目标；Codex 使用 `gpt-5.6-sol`、`model_reasoning_effort=max`、`-s read-only`和严格 target-only prompt，分块读完前后再次核对 SHA/bytes。三路仍为 `FAIL`，原始证据及失败结论完整保留：

- [`prompts/118-ai-supply-reference-architecture-final-closure-v5.md`](../../prompts/118-ai-supply-reference-architecture-final-closure-v5.md) / [`架构闭包复核 118`](../../research/codex-findings/118-ai-supply-reference-architecture-final-closure-v5.md)：A=7、B=7、C=1；报告 16,601 bytes，SHA-256 `2dc7b09fd6248eded7417fa7fa9e573de2aee4e98d046d646a9567c758a4a332`。
- [`prompts/119-ai-supply-ecosystem-ux-final-closure-v5.md`](../../prompts/119-ai-supply-ecosystem-ux-final-closure-v5.md) / [`生态体验复核 119`](../../research/codex-findings/119-ai-supply-ecosystem-ux-final-closure-v5.md)：A=2、B=3、C=1；报告 13,306 bytes，SHA-256 `17b33cb33708a34a42d8250a57429fca91a2262efd7ade09db852e4142bd51d5`。
- [`prompts/120-ai-supply-reference-grade-final-adversarial-v5.md`](../../prompts/120-ai-supply-reference-grade-final-adversarial-v5.md) / [`Codex 对抗复核 120`](../../research/codex-findings/120-ai-supply-reference-grade-final-adversarial-v5.md)：A=10、B=8、C=0；规范化报告 15,482 bytes，SHA-256 `e13663a4e640993462cccf6d6c0abfc8360cf8849c0e1c11d2d42c48e2ba32ce`。事件日志 `logs/120-ai-supply-reference-grade-final-adversarial-v5.jsonl` 为 754,318 bytes并包含真实 `turn.completed`。

第六次 A/B 发现按安全性质合并如下。每一行都已经同时进入规范合同、对应 Phase 验收和 §12 持续 fixture；“已回修”仍只表示本文拟议设计发生了变化，不表示实现或终审已经通过：

| 第六次问题族 | 规范性回修 | 机械验收落点 |
|---|---|---|
| local/LAN no-new-spend 与最终 send lease互引；首字节记录和最终retry terminal不闭合；fallback可越过未结束inner route sequence | 增不具发送权的runtime intent，funding/compute先单向汇聚到send lease；首字节前持久化send intent，未知投递单列`delivery_unknown`；inner route sequence terminal成为outer advance的强前驱 | §4.2、§4.6、§4.16.1、Phase 3/4/5、`inference-funding-attempt.model` |
| conformance只证明“有价格”而未绑定实际request，动态route set共用单subject，staged/live无完成证书 | 授权逐round冻结IR、fixture、adaptation、prepared/wire request和hosted-tool occurrence；route set逐member授权；新增两round terminal与`ConformanceJourneyCompletionReceipt` | §4.2、§4.6、§4.15、Phase 3/6/8、`conformance-round-closure.model` |
| custom与official enterprise unknown-metering缺可达的实际报告路径 | admission decision和actual report按official-known、official-unknown、custom-unknown严格判别；后两者逐物理请求确认且永久禁no-new-spend/推荐/静默fallback | §4.2、§4.6、Phase 1/3/6 |
| 本地授权只有事后decision引用，无法证明知情同意发生在敏感动作之前 | 增绑定OS principal、Origin/Host/WS Origin、channel和CSRF的local session；proposal→disclosure→accepted decision单向签收，最终authorization只引用accepted decision | §4.2、§4.16.1、Phase 0/1、`local-control-authorization.tck` |
| 标准OAuth、OpenRouter官方登录、callback、access/refresh生命周期与native client边界混装 | 标准OAuth使用credential family与逐send access lease；PKCE callback在held socket上先提交result；public client禁内置secret；OpenRouter另建只产API key的PKCE exchange状态机，不伪造OAuth token/scopes/client ID | §4.2、§4.16.2、Phase 1/3、`oauth-state-machine.tck` |
| workload identity只描述来源却无durable issuance；AWS named static profile缺路径；私有签名算法只能改core | 增issuance cursor/request lease/terminal/commit/credential family和逐请求lease；static profile独立SigV4 authority；受TUF/TCK约束的声明式signer DSL覆盖有限长尾，越界进入bundled trusted signer安全评审与独立release，不向code plugin开放secret | §4.2、§4.16.2、Phase 7、`workload-identity-signing.tck` |
| Execution request cursor把session/turn/request/tool混在一起；tool invocation与cursor成环；外部副作用请求未绑定准确政策与commit lease | 拆session、turn、request sequence和tool-results-applied状态；tool invocation只作前驱；每个tool external request冻结endpoint/body/network/rights/data/billing/transport/credential/consent，副作用再消费同一request的single-use commit lease并落effect terminal | §4.2、§4.8–§4.10、Phase 5/8、`execution-surface-chain.tck`、`execution-tool-child-lease.model` |
| independent proxy remote resolution只有模板声明，没有逐attempt目的地执法证明 | 每个attempt加入绑定resolved destination、authority、nonce、route、measurement与期限的proxy resolution attestation；缺独立enforcement authority则零字节 | §4.5、§4.16.2、Phase 1/3/5、`transport-credential-boundary.tck` |
| passive loopback先验PID后另连存在TOCTOU；credentialed metadata没有durable发送/结算链或bootstrap admission | 在held accepted/connected socket上验证peer后复用同一socket；metadata按bootstrap/established admission分支，并走cursor、physical lease、send intent、terminal、result和ledger | §4.16.4、Phase 3/4、`passive-loopback-peer.tck`、`metadata-health-admission.tck` |
| persistent budget曾只有策略文字或整policy串行；ledger correction可在过早释放hold后超总cap | balance cursor只序列化reservation/status/correction，child lease扣除包含最大更正向量的最坏额度后立即返回ready/exhausted并以独立settlement cursor并发；只有不可上调的final、权威horizon close或not-sent才释放。horizon内更正只能消费保留escrow且不改变余额/physical/outstanding轴；越过声明最大值属于authority breach并撤profile，不能扩用户授权 | §4.2、§4.6、Phase 3/8、`persistent-budget-ledger.model` |
| writer/time/TUF高水位没有不可回退锚；TUF授权只保存局部metadata | 所有安全writer和高水位绑定monotonic anchor；TUF receipt保存root→timestamp→snapshot→top-level targets→ordered delegation→target的完整lineage，连续性丢失fail-closed | §4.2、§4.4、§4.16.5、Phase 0/1/3/8、`receipt-dag-and-anchor.model` |
| GA core内嵌owner裁决、baseline可被临时删减、单run/generic report可冒充完整journey；protocol TCK report kind冲突 | 固定不可降级`ReferenceGradeProfileV2`；profile自身冻结category/auth/state/fixture和platform×双用户locale+pseudo exact run set，core、detached owner decision、强类型run/journey aggregate evidence与release binding单向分层；删除minimum机械更名并撤徽章；protocol统一`reportKind=protocol`加plane | §4.15–§4.16.5、§9、Phase 0/3/8、`realm-and-ga-binding.tck` |
| 多处receipt或GA摘要可能成环，temp与potential-orphan可分别吃满上限 | schema导出producer DAG并拒绝cycle/通用ref旁路；evidence temp与潜在orphan共用同一原子admission cap | §4.2、§4.13、Phase 0/2/8、`receipt-dag-and-anchor.model`、`evidence-orphan-recovery.chaos` |
| 推荐文案把thinking能力归给Codex订阅 | 改为OpenAI Responses inference与Codex Execution两条独立产品路径，分别按API或surface权益判断，不再由订阅名称推断推理能力 | §5、§7、§8、Phase 3/5/6 |

第六次回修还把以上合同逐项加入 Phase 0/1/3/4/5/7/8 的验收条目和真实拟议测试命令，避免只在长类型定义中“隐含满足”。下一步必须对当前新快照重新冻结 SHA/lines/bytes，先通过本地结构、TypeScript片段、链接、表格和emoji门，再进行两路全新零上下文独立复审与一次严格target-only Codex终审。任一路存在未处置A/B，仍继续回修并重新冻结；三路同时无A/B之前，顶部状态保持“评审中”。

第七次终审以 SHA-256 `fc4454fc6ac05c545d90b0780a5298a16f0a021c5e972da1f4df3de460da4c0e` 固定 8,219 行、638,999 bytes 的同一 v6 目标。两路 subagent均为全新零上下文并只读该快照；Codex继续使用`gpt-5.6-sol`、`model_reasoning_effort=max`、`-s read-only`和target-only prompt。三路仍为`FAIL`，原始失败证据、大小和摘要如下，不能被本轮后续回修覆盖：

- [`prompts/121-ai-supply-reference-architecture-final-closure-v6.md`](../../prompts/121-ai-supply-reference-architecture-final-closure-v6.md) / [`架构闭包复核 121`](../../research/codex-findings/121-ai-supply-reference-architecture-final-closure-v6.md)：A=11、B=3、C=0；报告 370 行、36,165 bytes，SHA-256 `2374ac3b73b920025b06864454a30962187498e36154be775d822a4232b73c0c`。
- [`prompts/122-ai-supply-ecosystem-ux-final-closure-v6.md`](../../prompts/122-ai-supply-ecosystem-ux-final-closure-v6.md) / [`生态体验复核 122`](../../research/codex-findings/122-ai-supply-ecosystem-ux-final-closure-v6.md)：A=2、B=5、C=0；报告 240 行、22,038 bytes，SHA-256 `7690e7526e313d339c7af065a9b85995ab8749f06fe8bc5640af1322f83a52e7`。
- [`prompts/123-ai-supply-reference-grade-final-adversarial-v6.md`](../../prompts/123-ai-supply-reference-grade-final-adversarial-v6.md) / [`Codex 对抗复核 123`](../../research/codex-findings/123-ai-supply-reference-grade-final-adversarial-v6.md)：A=8、B=3、C=0；报告 120 行、14,570 bytes，SHA-256 `3a74726eb663f2cf31e44c13f0ee4f58a271cf2660be8516f9c84ff054da9117`。事件日志`logs/123-ai-supply-reference-grade-final-adversarial-v6.jsonl`为273行、1,673,186 bytes，SHA-256 `e69843fc540a6d472bceb8241183dcbe89a9d133a75963cc2146ec7f17cc8043`，最终事件为真实`turn.completed`；过程中两次WebSocket compact recovery和非致命cache TTL metadata错误均保留在原日志，不改写为无异常运行。

第七次 A/B 发现按能够共享同一不变量和门禁的根因合并如下。每项都已回写到本轮拟议合同、对应 Phase 与 §12 fixture；这仍只表示文档修订，不表示实现或新终审已经通过：

| 第七次问题族 | 规范性回修 | 机械验收落点 |
|---|---|---|
| edge manifest只能登记单边，无法证明复合顺序、跨边同值、状态机与single-successor | manifest增加ordering rule、same-value path pairs、state projection、branch predicate和CAS authority；同源生成refinement、producer DAG、instance verifier与mutation | §4.2、§4.16.1、Phase 0、`receipt-dag-and-anchor.model` |
| ledger correction/report可以从同一predecessor分叉 | 新增subject-scoped report cursor、correction lease/commit和initial/corrected严格联合；迟到usage只能生成唯一superseding report | §4.2、§4.6、Phase 3/8、`ledger-report-correction.model` |
| TUF缺pinned-root rotation和逐repository+role rollback状态 | root从distribution预置版本逐步旧/新双阈值旋转；每个repo/role保存version+hash high-watermark与完整imported metadata evidence | §4.4、§4.16.5、Phase 0/3/8、`tuf-root-role-rollback.tck` |
| OAuth/API-key browser、manual reconciliation与GA owner裁决缺事前本地授权或decision可重复消费 | 四类动作都使用proposal→disclosure→accepted decision→durable single-use consumption；action subject/nonce/generation/expiry完全相等 | §4.2、§4.16.1–§4.16.2、Phase 0/1/5/8、`local-control-authorization.tck` |
| OAuth start/callback/exchange负面terminal与refresh family并发不闭合 | 三种flow各自具备before/after/deadline/cancel/reject/delivery-unknown terminal、revision和family cursor/refresh lease/原子winner commit | §4.2、§4.16.2、Phase 1/3、`oauth-state-machine.tck` |
| conformance一次decision授权两轮却只签一轮；final lease早于credential/local-compute闭包；result未强绑success terminal | decision前冻结`[staged,live]`完整tuple；每轮intent汇聚credential/compute/prepared descriptor后才生成final lease；typed success terminal/result/report/range进入completion | §4.2、§4.16.1、§4.16.6、Phase 3/6/8、`conformance-round-closure.model` |
| custom unknown与official unknown在后续report/funding/UX合流 | proposal、disclosure、admission、actual report、operation closure与funding decision全部分成custom/official严格分支，并禁止借rights/措辞/no-new-spend | §4.2、§4.6、§8、Phase 1/3/6 |
| credentialed或付费metadata允许空账、send intent可重放 | bootstrap/established metadata各有完整本地decision；用户分支NonEmpty reservation/range、intent deadline+single-use，automatic分支严格零账 | §4.16.4、Phase 3/4、`metadata-health-admission.tck` |
| Execution缺session-start状态机、tool-call全集、effect terminal、zero-work/deadline fold和安全人工调和 | 增start cursor/lease/intent/terminal/recovery、registered tool set与results-applied exact coverage、strict effect terminal、zero-turn/request terminal、single-use reconciliation decision和最终session cursor | §4.2、§4.8–§4.10、Phase 5/8、`execution-surface-chain.tck`、`execution-tool-child-lease.model` |
| GA subject/report/gate曾只容纳单run，profile漏category/minimum且Azure auth用OR | V2 profile固定entry/category/replacement/auth/state/fixture；baseline物化platform×双用户locale与pseudo exact run set，evidence使用完整`runs[]`和typed UX metrics；run→journey aggregate→entry→ecosystem gate重算集合；Azure/Vertex/Bedrock逐auth独立，Kimi三产品身份互斥一致 | §4.16.5、§9、Phase 0/3/8、`realm-and-ga-binding.tck` |
| 三平台没有必然可用的strong anchor producer；remote witness曾缺自举网络、数据边界和恢复UX | macOS/Linux/Windows仅接受TPM2或一等remote witness持久模式；fresh boot只开放release-pinned、零secret/费用/redirect的typed bootstrap状态机，witness冻结realm/operator/data/retention/proxy/rotation并覆盖双locale恢复journey；不可用或拒绝时降为当前boot匿名本机plain-dialog | §4.16.5、Phase 0/8、`platform-anchor-offline-mode.tck` |
| custom endpoint不能添加安全非秘密header；rights“改用官方API”没有typed destination | 增custom-public-header受限policy与逐header授权；blocked主动作必须引用完整official destination journey，否则确定性改为choose-another-source | §4.5、§8、Phase 1/6、`transport-credential-boundary.tck` |
| text-only本机模型无法ready，Podman AI Lab没有产品级journey | plain-dialog能力只要求text/stream/cancel并源级隐藏tools；Podman AI Lab独立identity与六态只读处方，不借普通Podman容器报告 | §4.3、§4.16.4、§6.3、Phase 4/6、`local-product-journeys.tck` |
| signer缺完整scope/time/nonce，DSL越界与plugin边界矛盾 | workload/static/declarative signer冻结method/path/query/header/body和host time/nonce；DSL越界只能进入bundled trusted signer双owner/TUF/TCK发布，不给code plugin secret | §4.10、§4.16.2、Phase 7/8、`workload-identity-signing.tck` |
| plugin预算文字冲突、restart窗口不唯一；LocalPreload无并发single-use状态机 | 单一plugin/host profile digest与1小时sliding restart window；preload改为global cursor→lease→effect intent→terminal→release→result的CAS链 | §4.13、§4.16.3、Phase 4/8、`plugin-budget-state-machine.tck`、`local-preload-state-machine.model` |

本轮还把Podman AI Lab的官方model-service/OpenAI-compatible API事实补进§15证据基线，把custom priced Billing缩窄为严格`priced_candidate`，并让Execution terminal cursor强引用最终session terminal。下一步只允许以本轮全部回修后的新SHA做本地门禁和第八次全新三路终审；任一路仍有A/B都必须继续回修、重新冻结和复核，不能提前把顶部状态改成通过。

第七次回修后的主动自审继续把“合法状态”从文字约束下沉为类型、schema与CAS共同约束：OAuth start/callback/exchange/refresh、OpenRouter API-key PKCE、local-control decision consumption、workload identity issuance、metadata、local preload、conformance/runtime/fallback、persistent budget、ledger correction以及Execution session/turn/request/tool都改为状态专属判别联合；每张lease只接受准确ready/waiting前驱并原子产生in-flight，terminal/commit只接受该in-flight的last lease。推理发送顺序固定为无发送权intent→完整credential/compute descriptor→final physical lease→durable send intent，删除descriptor反向依赖final lease的错误边；`delivery_unknown`、zero-work和恢复分支均只能走具名terminal。文档内9个TypeScript合同块已用TypeScript 5.9.3、`strict`和准确22个外部边界stub执行语义编译，结果为0 diagnostics；另有21条反向类型断言证明错误cursor、错round、失败GA payload、refresh不确定态和tool effect不确定态不能赋给受保护分支。Phase 1/3/5、§12测试矩阵与§16完成定义已同步这些不变量。该结果仍只是本地拟议合同自审，必须由下一冻结快照的三路独立终审验证，不能替代评审结论。

### 17.6 第八次终审与第八次回修

第八次终审以 SHA-256 `c0d36de218f4a6db475f000d09eb1fe5d26e57ebaab0f9224ce1bc05fb6b2b72` 固定 12,330 行、833,246 bytes 的同一 v7 目标。两路 subagent继续使用全新零上下文，只读完整目标；Codex继续使用`gpt-5.6-sol`、`model_reasoning_effort=max`、`-s read-only`和严格target-only prompt。三路仍为`FAIL`，原始证据如下；本轮后续回修不得覆盖这些失败事实：

- [`prompt 124`](../../prompts/124-ai-supply-reference-architecture-final-closure-v7.md) 为39行、3,780 bytes，SHA-256 `819066105b3b95eabfd84049480d415a5b054198c0cd9278082fa4470b6fedc3`；[`架构闭包复核 124`](../../research/codex-findings/124-ai-supply-reference-architecture-final-closure-v7.md) 为`FAIL`、A=3、B=3、C=1，148行、17,044 bytes，SHA-256 `67b9e6601e8c48c02dd96563596b499e1803318185b9485327f21f561acb5929`。
- [`prompt 125`](../../prompts/125-ai-supply-ecosystem-ux-final-closure-v7.md) 为39行、3,626 bytes，SHA-256 `c0e6b282ca2a59d480b6b094ea0011b3e72db69ba083125b2f472c191c705a7e`；[`生态体验复核 125`](../../research/codex-findings/125-ai-supply-ecosystem-ux-final-closure-v7.md) 为`FAIL`、A=2、B=3、C=2，228行、21,470 bytes，SHA-256 `e852d3c78e1d9183311b4bb53423a847b8cb9179538b949b4b23bf8cc22d86bb`。
- [`prompt 126`](../../prompts/126-ai-supply-reference-grade-final-adversarial-v7.md) 为23行、2,626 bytes，SHA-256 `76d0ce9b8a0dbb495e231e76673bbc8f37a2ed6aeb648eff4a7ff4eab023f8e0`；[`Codex对抗复核 126`](../../research/codex-findings/126-ai-supply-reference-grade-final-adversarial-v7.md) 为`FAIL`、A=7、B=0、C=0，88行、11,706 bytes，SHA-256 `dad8b5e4a7c834d058b9bbd88dd0d61b533fc7a8d1589dc0e4b3b7b2d12821f2`。事件日志`logs/126-ai-supply-reference-grade-final-adversarial-v7.jsonl`为365行、2,088,747 bytes，SHA-256 `d8cfb238cd645fd5f1ee1365bd21a2ce0729fde0a71113c51d5b7ebd698663d0`；其中254行为有效JSON事件，111行为非致命cache warning，最后一个有效事件为真实`turn.completed`。

第八次 A/B 发现和主动类型审计按共同根因合并如下。表中“已回修”只说明当前拟议合同、Phase和fixture已经同步，不说明实现或新终审通过：

| 第八次问题族 | 规范性回修 | 机械验收落点 |
|---|---|---|
| API-key PKCE多flow/多daemon没有family winner、旧key处置与response-loss恢复 | 增family cursor、rotation/recovery lease、稳定exchange identity、原子winner commit、逐send current-key lease和old-key retirement cursor；撤销未知时旧key永久失去broker lease | §4.2、§4.16.2、Phase 1/3、`oauth-state-machine.tck` |
| OAuth refresh可用自由字符串证明after-send复用 | 删除通用reuse evidence；只有durable send intent证明零字节才保留refresh，所有after-send/provider failure/unknown均撤销refresh并进入重新授权 | §4.2、§4.16.2、Phase 1/3、`oauth-state-machine.tck` |
| workload metadata的无credential正向路径在schema中不可构造 | issuance lease拆成credentialed nonempty与metadata exact-empty严格联合；AWS IMDSv2、Google metadata、Azure managed identity各有source-specific admission和零credential egress证明 | §4.2、§4.16.2、Phase 7、`workload-identity-signing.tck` |
| persistent budget仍可能把整policy串行到一个child结束，correction horizon也可能过早释放escrow | balance cursor在child包含最大更正向量的最坏额度原子扣减后立即回ready/exhausted，child settlement各自并发；horizon open保留完整escrow且禁止供新child消费，更正只在escrow内调整actual分配，超界或immutable final后上调进入authority breach并永久hard-stop | §4.2、§4.6、Phase 3/8、`persistent-budget-ledger.model` |
| session-start `still_unknown`是一轮死路，人工恢复可盲目重启 | recovery改为可重复`ready→query-in-flight→still-unknown/ready或resolved` cursor，保持稳定identity、backoff和hold；无authority时只允许独立absence evidence或永久封锁identity并保留hold | §4.2、§4.8、Phase 5/8、`execution-surface-chain.tck` |
| turn `delivery_unknown`可回session ready并继续新turn | 增`reconciliation_required` cursor，turn lease只接受ready；unknown只能成为最终session unknown分支，完成turn tuple保证unknown恰好是最后一项且此前无unknown | §4.2、§4.8–§4.9、Phase 5/8、`execution-surface-chain.tck` |
| tool side-effect的5xx/4xx/after-send取消可走普通retry，零外部工作没有结果终态 | read-only与side-effect terminal严格分支；side-effect任何sent/unknown先到effect-in-flight，只有权威not-committed加登记edge可重试；增加zero-work success/abort和read-only result合法路径 | §4.2、§4.9–§4.10、Phase 5/8、`execution-tool-child-lease.model` |
| tool final transition可把read-only、committed、unknown、zero-work和abort cursor任意拼接 | final transition改成六类严格联合并逐类强绑相容terminal cursor；unknown effect不能作为普通abort，read-only success不能借effect commit | §4.2、§4.9–§4.10、Phase 5/8、`execution-tool-child-lease.model` |
| hosted-tool auth不是durable send intent的必备前驱，physical lease过早拥有最终发送权 | physical lease只授予条件式权限；无漏无重的hosted authorization bundle按phase/occurrence闭合并取得唯一最终发送权，send intent原子消费bundle | §4.2、§4.6、Phase 3/8、`inference-funding-attempt.model` |
| local conformance的compute/descriptor/final-lease顺序相互矛盾 | 全文统一为无发送权intent→held socket peer/compute/isolation→descriptor→条件式final lease→hosted bundle→send intent | §4.16.1、Phase 3/4/8、`inference-funding-attempt.model` |
| strong anchor remote witness自举仍依赖尚不存在的强writer，且恢复UX不可执行 | fresh boot只开放恰好一次release-pinned、零secret/费用/redirect的bootstrap能力；request-loss走稳定identity status reconciliation；witness的realm/operator/data/retention/proxy/rotation和每态唯一动作全部类型化 | §4.2、§4.16.5、Phase 0/8、`platform-anchor-offline-mode.tck` |
| GA单份报告或布尔值仍可冒充platform×locale笛卡尔积，`en-XA`混入用户locale | `GaJourneyDefinitionV2`分别物化user和pseudo run set；每个run有typed UX event inventory、report/attestation/gate/binding，journey/entry/ecosystem逐层重算exact sets | §4.16.5、§9、Phase 0/3/8、`realm-and-ga-binding.tck` |
| reference profile没有精确最低集合，漏oMLX、mTLS、Bedrock API key与Azure独立auth | `ReferenceGradeProfileV2`固定named entry、category minimum、entry-category mapping、state/fixture/run requirement与有限replacement slot；Azure、Vertex、Bedrock逐auth独立journey | §4.16.5、§9、Phase 0/3/7/8、`realm-and-ga-binding.tck` |
| custom endpoint不能安全表达私有secret header | 增`custom_secret_header` auth、独立broker handle/version、endpoint/profile/principal/recipient/processor/ACL/egress/decision绑定；`X-Auth-Token`和无同名preset的`api-key`为正例，collision/reserved/proxy/redirect为负例 | §4.5、Phase 1、`transport-credential-boundary.tck` |
| provider-first unknown计量与priced前置条件互相排斥，rights主动作和local SLO仍靠字面量 | provider-first三分支改为priced/custom-unknown/official-unknown严格判别；rights主动作由typed destination resolver生成；local SLO分别限定零认证zero-config和有认证guided-key | §3、§8、§12、Phase 1/6 |
| 多个“看似可编译”联合分支因复合literal与`Extract`组合实际产生必填`never` | workload source、OAuth terminal、budget settlement改为逐判别值真实联合；自动检查全部286个type alias的每个union constituent，拒绝任何必填`never` | §4.2、Phase 0/1/3/7、合同语义编译门 |

第八次回修后的预冻结自审读取文档内全部9个TypeScript合同块，以TypeScript 5.9.3、`strict`和准确22个外部边界stub执行语义编译，结果为0 diagnostics；对286个type alias逐union constituent检查，必填`never`为0；62条正反例类型断言全部通过，覆盖credential/no-credential、API-key与OAuth family、并发预算、session恢复、tool副作用和zero-work、hosted send authority、GA逐run、reference profile、anchor bootstrap、custom secret header以及三核心协议。结构门同时得到：63个本地Markdown链接零缺失、9个TypeScript块零重复属性、围栏成对、表头列数一致、零尾随空白，目标文件emoji门输出`[ok] emoji gate: clean`。这些结果仍只是本地合同自审；必须在当前完整文本冻结后重新执行两路全新零上下文评审和一次target-only Codex对抗评审，三路未同时达到零未处置A/B前不得改变顶部“评审中”状态。

### 17.7 第九次终审输入、triage 与第九次回修

第九次评审读取的是 SHA-256 `5ae8c540fe32e67cc6bae3788f22b90126223e3914dce5f236d273d0f2e51d65`、14,502 行、945,084 bytes 的同一 v8 冻结快照。两路 subagent均为全新零上下文，只读完整目标；Codex使用`gpt-5.6-sol`、`model_reasoning_effort=max`、`-s read-only`和target-only prompt。原始失败和通过证据都保留，不用本轮后续回修覆盖：

- [`prompt 127`](../../prompts/127-ai-supply-reference-architecture-final-closure-v8.md) 为40行、3,906 bytes，SHA-256 `210183e8280933b448a5b0d89918c0ef9b87ed61cf424dab494a92142bba25c2`；[`架构闭包复核 127`](../../research/codex-findings/127-ai-supply-reference-architecture-final-closure-v8.md) 为`FAIL`、A=6、B=1、C=0，132行、16,645 bytes，SHA-256 `f2ca6479ce9a4eb5ef26e2a2c2942476865ebd99776f5096edd425104cd05111`。
- [`prompt 128`](../../prompts/128-ai-supply-ecosystem-ux-final-closure-v8.md) 为40行、3,931 bytes，SHA-256 `d9b8d85b887bf8b1f37873cd62e433feec4ecbb7308d61e2d59872eb5c19a6e7`；[`生态体验复核 128`](../../research/codex-findings/128-ai-supply-ecosystem-ux-final-closure-v8.md) 为`PASS`、A=0、B=0、C=0，65行、12,362 bytes，SHA-256 `69b8d68bffa0b8dcc018f5945ca930285415dd77cc17a3f45e54c62d09a35096`。
- [`prompt 129`](../../prompts/129-ai-supply-reference-grade-final-adversarial-v8.md) 为23行、2,812 bytes，SHA-256 `d1a4209bc7ac480c953e23591779b2cf45db92a278fdf86aaae4a5dc4b268daa`。第一次执行在30分钟边界停止，未生成报告；原始日志`logs/129-ai-supply-reference-grade-final-adversarial-v8.jsonl`为396行、1,762,621 bytes，SHA-256 `5eb6163909624caaf0c1fa8b99c928fc4d625810683a3e1ba08e2e9be5102e22`。确认目标未漂移后使用同一prompt发起全新session，第二次日志`logs/129-ai-supply-reference-grade-final-adversarial-v8-attempt2.jsonl`为1,207行、2,789,681 bytes，SHA-256 `2b428fa46b823c026afc430debe7155183faa25a39c6600ae41575c999c04add`，第1,207行为真实`turn.completed`；[`Codex对抗复核 129`](../../research/codex-findings/129-ai-supply-reference-grade-final-adversarial-v8.md) 为`FAIL`、A=12、B=3、C=0，202行、20,259 bytes，SHA-256 `dea387c041339b87b61869a43d0e10ad5fa153b62f313d7b789be1ff93b74684`。

三份报告的重叠发现按同一安全不变量合并，全部进入第九次拟议合同、对应Phase和持续fixture；表中“回修”仍不代表实现已经交付：

| 第九次问题族 | 根因级回修 | 机械验收落点 |
|---|---|---|
| workload metadata仍能进入credentialed分支；逻辑issuance不能表达IMDSv2两次发送 | `CredentialedWorkloadIdentityProfileReceipt`排除三类metadata source；零credential proof按provider/source严格联合。逻辑lease不授发送权，每个物理step独立lease/send-intent/terminal；AWS拆token PUT和credential GET，并为首step失败保留可达终态 | §4.2、§4.16.2、Phase 1/7、`workload-identity-signing.tck` |
| OAuth access-only成功无family cursor，pending可挂code/refresh，OAuth与API-key exchange缺send-intent | family静态模式与cursor当前模式分离，初始access-only可签发未过期access lease但不能取refresh lease；pending/slow-down和unexpected-poll只接受device poll；OAuth/API-key exchange在任何网络字节前消费独立intent，before-send分支反向禁止intent | §4.2、§4.16.2、Phase 1/3、`oauth-state-machine.tck` |
| fresh witness的普通TUF依赖尚不存在的持久强锚；registration与status query没有共享有界预算 | 新增只依赖当前distribution manifest、pinned initial root和exact target bytes的bootstrap authorization；registration=1和有限status query共享durable boot cursor，累计次数、bytes、墙钟与退避。query的before/after-send、cancel、deadline、response-loss、权威found/absent/still-unknown和budget exhausted均有typed terminal | §4.2、§4.16.5、Phase 0/8、`platform-anchor-offline-mode.tck` |
| persistent budget在释放hold后接受late correction会突破硬额度，且correction可扩physical cap或丢outstanding hold | policy只能选择immutable final或bounded correction horizon；horizon open保留完整最坏escrow且不能供新child消费。escrow内更正保持余额、physical cap、outstanding set/count和两类aggregate hold不变；超界或immutable final后上调成为authority breach并撤profile，不扩用户授权 | §4.2、§4.6、Phase 3/8、`persistent-budget-ledger.model` |
| fallback outer可把inner success/unknown改写为retry/not-sent | runtime terminal按outcome×sent×billing展开真实constituent；outer不再复制sent/billing，只能由固定fold映射。success、unknown和control stop只能terminal；只有inner exhausted且存在预登记相邻edge与剩余总cap证明时才能advance | §4.2、§4.6、Phase 3/5、`inference-funding-attempt.model` |
| staged/live缺restart与loaded-generation barrier | 新增`staged_passed → restart_in_flight → restart_commit_pending → live_ready` writer-fenced cursor；restart terminal/commit证明旧进程终结和准确snapshot/distribution/config generation已加载，live intent/lease/result/completion全部强引用同一barrier | §4.2、§4.16.1、Phase 3/8、`conformance-round-closure.model` |
| local state write复合literal被`Extract`擦除；人工确认effect committed后无最终result路径 | local committed/not-committed展开成真实联合constituent；`ToolInvocationFinalTransitionReceipt`增加强绑unknown cursor、owner decision、effect evidence和result的manual-committed `record_result`分支 | §4.2、§4.9–§4.10、Phase 5、`execution-tool-child-lease.model` |
| turn delivery-unknown可消费任意receipt终结session；session closed-before-request会回ready | 新增turn unknown reconciliation的ready/in-flight/still-unknown/committed状态机，只有authoritative resolved、cleanup confirmed或permanent block-with-hold能终结；still-unknown不可取新turn或session terminal。远端首请求前关闭投影`session_closing → terminal`，旧lease永不复用 | §4.2、§4.8–§4.10、Phase 5/8、`execution-surface-chain.tck` |
| 正式conformance core缺kind-specific语义主体 | `ConformanceResultCore`拆成protocol/capability/discovery/execution/bridge五个严格分支，分别绑定wire/provider-model/detector-budget/surface-sandbox-Gate/bridge-route-control等确定性身份；不适用字段为optional `never`，跨kind换挂在类型和strict schema层拒绝 | §4.15、Phase 0/2/5/8、conformance TCK |
| GA不比较expected/final readiness，inventory或community-unverified可成为required，planned UX缺copy/paste与leave-return上限 | `requiredForGa:true`只允许profile冻结的maturity/tier；pass payload和run gate用类型级同值映射绑定definition expected与actual readiness，entry/ecosystem再重算；planned metrics增加两项硬上限 | §4.16.5、§9、Phase 0/6/8、`realm-and-ga-binding.tck` |
| Phase 0文字声称语义门但orchestrator未执行；publisher公平性缺机器profile | Phase 0真实执行strict TypeScript/schema、required-never、正向可达、edge manifest、producer DAG、instance acyclic和mutation自测；host profile增加逐publisher queue/prepared/RSS/CPU/process/worker-slot、最低健康份额、WDRR、退避/抢占和restart持久化字段 | §4.13、§4.16.3、Phase 0/8、`plugin-budget-state-machine.tck` |

第九次回修后的预冻结自审读取全部9个TypeScript合同块，以TypeScript 5.9.3、`strict`和22个准确外部边界stub执行语义编译，得到0 diagnostics；对384个type alias的1,470个union constituent逐项检查，必填`never`为0。文档内57条显式`ContractAssert`正反例同时覆盖metadata/credential source、IMDSv2首step失败与两step、OAuth access-only和device-only pending、三类exchange intent、fresh anchor与共享budget、correction escrow、fallback fold、restart barrier、local effect、manual committed result、turn reconciliation、conformance semantic subject、GA readiness/maturity/UX和publisher公平profile。Phase 0的拟议orchestrator把这三类检查连同edge/instance/mutation门设为不可跳过的独立CI step。该自审只证明当前拟议合同在本地语义编译下闭合；最终判定仍必须引用下一冻结SHA的detached三路终审，不能由本文自证。

### 17.8 第十次终审输入、triage 与第十次回修

第十次评审读取的是 SHA-256 `ae6175a7195411f6878f4317ef4413f354df0763e3be6a80e7c54fc2c0c6980e`、16,355 行、1,025,192 bytes 的同一 v9 冻结快照。两路 subagent均为全新零上下文并连续读取完整目标；Codex使用`gpt-5.6-sol`、`model_reasoning_effort=max`、`-s read-only`和target-only prompt。三路均为`FAIL`，后续回修不覆盖原始失败事实：

- [`prompt 130`](../../prompts/130-ai-supply-reference-architecture-final-closure-v9.md) 为36行、3,017 bytes，SHA-256 `cc21c9081397ff8d43ee1ab441295dabc1ff95785e506f9177655b0d6e8ba1b6`；[`架构闭包复核 130`](../../research/codex-findings/130-ai-supply-reference-architecture-final-closure-v9.md) 为`FAIL`、A=3、B=3、C=0，195行、23,591 bytes，SHA-256 `7e1cff0dd18c53c28ca3ec09b897d501cb609ff3b0298453a219e8a960bb0da5`。
- [`prompt 131`](../../prompts/131-ai-supply-ecosystem-ux-final-closure-v9.md) 为36行、3,324 bytes，SHA-256 `78e6b11754efa17f6bb6447687d2206c0acba0a67ff4b44d4c62413e99fffcce`；[`生态体验复核 131`](../../research/codex-findings/131-ai-supply-ecosystem-ux-final-closure-v9.md) 为`FAIL`、A=3、B=0、C=0，58行、11,710 bytes，SHA-256 `b46b478ebff018b0c89449d5ffbb5e18f896db63eb14d3307631c79950526ab0`。
- [`prompt 132`](../../prompts/132-ai-supply-reference-grade-final-adversarial-v9.md) 为23行、2,611 bytes，SHA-256 `20906aeaf0eb5d31114fb4a2308ba7f62b269c05d144b95c180ea30b1dccdc7f`。第一次执行日志`logs/132-ai-supply-reference-grade-final-adversarial-v9.jsonl`为358行、1,937,518 bytes，SHA-256 `2f24d043b903618da08b4017925374afd83b026e8d305a8eafff8a5b9dfd292b`，含240行有效JSON、118行非JSON诊断，最后没有`turn.completed`，因此不作为完成证据。确认目标未漂移后用同一prompt发起全新session；第二次日志`logs/132-ai-supply-reference-grade-final-adversarial-v9-retry2.jsonl`为1,550行、2,716,150 bytes，SHA-256 `42418f1593e63d5afb79446af06bd505f0fd97d98afc9dc071b73c5ba5f194f3`，含622行有效JSON、928行非JSONcache诊断，最后一个有效事件为真实`turn.completed`。[`Codex对抗复核 132`](../../research/codex-findings/132-ai-supply-reference-grade-final-adversarial-v9.md) 为`FAIL`、A=13、B=3、C=0，165行、18,861 bytes，SHA-256 `1d24c6beb7afb8b4a0cbb2b875670adbf149758ec7e756bfd6fc9573acbb3c6d`。

三份报告的重叠发现以“最早取得副作用权的持久状态必须有唯一前驱、准确意图和可恢复终态”为共同根因合并；生态发现则以“GA只证明真实用户从两种anchor起点达到可用正向终态，且所有前置成本都计入”为共同根因合并。下表中的“回修”只代表当前 v10 拟议合同、Phase和fixture已同步，不代表生产实现或下一轮终审已经通过：

| 第十次问题族 | 根因级回修 | 机械验收落点 |
|---|---|---|
| final lease与durable intent之间仍有不可闭合窗口 | 新增通用typed pre-intent resource/worker/funding closure；witness、推理、workload、metadata、OAuth/API-key、local preload、Execution start/request/tool均按`intentState: absent/present`拆分，absent分支禁止intent和任何物理字节并关闭准确lease、cursor与hold | §4.2、§4.16.1–§4.16.5、Phase 0/1/3/4/5/7/8及各状态机model/TCK |
| Public SDK descriptor反向依赖尚未生成的final lease | `PreparedAttemptDescriptor`删除final lease digest；final lease后新增`AuthorizedSendEnvelope`及receipt，把descriptor、lease、hosted authorization bundle与send intent按单向DAG绑定 | §4.2、§4.11、Phase 0/3/8、producer/instance DAG门 |
| independent enforcement与LAN authority可被宽泛receipt换挂 | route authority policy、attestation、physical decision、runtime enforcement和LAN compute authority全部使用具名强类型，逐项绑定双方trust domain、subject、route、nonce、commit token、generation与measurement；本轮主动审计继续把route envelope和local preload authority收窄 | §4.2、§4.16.1、Phase 0/3/4/8、edge manifest与跨域mutation |
| workload物理步骤可产生同ordinal sibling lease | 引入按issuance和ordinal分区的ready/in-flight/terminal cursor，lease创建即做single-successor CAS；ordinal 2只能消费ordinal 1的准确success cursor，logical issuance另有zero-step closure | §4.2、§4.16.2、Phase 1/7、`workload-identity-signing.tck` |
| persistent budget correction/finality可重复消费escrow或无限hold | 每child新增escrow cursor、correction sequence与finality lease；有限deadline到达时按完整最坏reservation悲观终结且释放量为零，correction和finality原子竞争同一cursor，late correction进入authority breach | §4.2、§4.6、Phase 3/8、`persistent-budget-ledger.model` |
| hosted side effect缺逐occurrence Gate | policy、conformance/runtime authorization与terminal均拆read-only/side-effect；side-effect必须绑定当前occurrence的Gate lease、accepted decision、single-use consumption和不可绕过pre-effect authority，否则首字节前拒绝 | §4.2、§4.6、§4.11、Phase 3/8、`inference-funding-attempt.model` |
| fallback四槽与alternative仍可跨方案拼接 | 定义恰好四槽的`SupplySolutionReceipt`、逐槽binding/funding/fence/rights/data证据、typed alternative和anti-splice proof；admission、attempt、advance只能消费所选solution与slot | §4.2、§4.6、Phase 3/5/8、`inference-funding-attempt.model` |
| restart barrier不能证明旧进程终止和live实际进程 | distribution artifact、process identity、旧进程终止、candidate loaded process和live binding均为具名receipt；live descriptor/compute closure必须绑定准确新进程，禁止旧进程和跨generation换挂 | §4.2、§4.16.1、Phase 3/8、`conformance-round-closure.model` |
| Execution external identity可复用，hard-stop可折回ready，结果可伪造 | 新增全局external identity lifecycle cursor与start/activate/close/block链；hard-stop fold只能进入closing/terminal；本地transaction terminal、人工result authority和read-only/zero-work结果来源均强类型化 | §4.2、§4.8–§4.10、Phase 5/8、Execution两套model/TCK |
| protocol/capability/discovery/execution/bridge semantic subject可跨plane或product拼接 | conformance semantic subject按report kind、plane和每个protocol ID映射为真实union；runner、SUT、implementation、provider/model、execution surface或bridge dependency与release binding逐项同值，required-never审计覆盖每个constituent | §4.15、Phase 0/2/5/8、五类conformance TCK |
| remote witness只有登记外壳，缺持续阈值服务和可运维发布条件 | profile新增成员身份、公钥、阈值集合、client/service artifact、不可变store、SLO、限流、数据处理和key ceremony；持续append/read、member occurrence、quorum checkpoint、equivocation、rotation和continuity recovery均走writer-fenced状态机 | §4.2、§4.16.5、Phase 0/8、`platform-anchor-offline-mode.tck` |
| Claude subscription被无条件列入固定GA最低集，与公开API-only rights冲突 | 从固定最低集移除Claude订阅，只在rights receipt证明允许当前产品、surface和use case时作为条件entry；Claude官方API仍为固定主路径，不能用消费订阅额度替代 | §6、§9、Phase 1/6/8、`realm-and-ga-binding.tck` |
| required journey可把blocked/action-required/advanced或自写宽松UX当作pass | required定义只保留supply、execution、control三类正向可用终态；负向状态移入独立fixture且不存在pass payload；profile按journey class冻结精确数值上限，run和gate通过mapped union绑定同一tier、solution和limit | §4.16.5、§9、Phase 0/6/8、十类固定GA mutation |
| witness前置成本未计入provider/local首次接入 | 每条required journey绑定`not_enrolled/ready`两种anchor起点和强类型prerequisite closure；事件集合按有序无重并集、metric vector按分量求和，主journey、前置动作和总elapsed三组上限分别签入profile | §4.16.5、§8–§9、Phase 0/6/8、fresh/ready交叉换挂mutation |
| reference-grade可把matrix中L0主流入口改成非required | `requiredForGa:false`类型上排除L0；baseline严格派生自全部matrix L0、固定最低集和owner只增不减项；固定中国入口补齐混元、千帆API V2/权益、MiniMax中外realm、方舟和SiliconFlow中外realm | §4.16.5、§9、Phase 0/3/6/8、L0降级与rights替换mutation |
| publisher公平常量互相冲突且缺可判定服务语义 | 四worker明确拆成2个core保留槽和2个plugin pool槽；plugin pool使用有界服务deficit round robin v2，定义worker-ms成本、quantum、non-preemptible上限、service curve、debt、稳定publisher identity、overload cohort轮转和最大等待，不再声称每publisher独占slot或无条件25%全机份额 | §4.13、§4.16.3、Phase 0/8、`plugin-budget-state-machine.tck` |
| canonical `ReceiptRef`字段名不一致且关键本机/响应链仍有宽泛边 | 全文统一为`dependencyDomainDigest`；本轮主动收窄本机peer/compute/egress/full data-exit sandbox、preload authority、dynamic route、DataBoundary、raw response inventory/decoding/loss及按field映射的三类权威extraction，未验证提取单独进入advisory类型 | §4.2、§4.11、§4.16.1、Phase 0/4/8、edge manifest、required-never与cross-subject mutation |

第十次回修后的预冻结自审读取全部9个TypeScript合同块，以TypeScript 5.9.3、`strict`和22个准确外部边界stub执行语义编译，得到0 diagnostics；对423个type alias中303个实际union alias的1,943个constituent逐项检查，必填`never`为0；9个TypeScript块内部重复属性为0。活动文档链接门得到`[ok] active document links: files=97 broken=0`，emoji门得到`[ok] emoji gate: clean`。这仍是冻结前的本地证据；下一步必须对v10最终字节重新计算行数、bytes与SHA，并由两路全新零上下文subagent和一次target-only Codex对抗评审共同达到A=0、B=0，才可把本文状态改为终审通过。

### 17.9 第十一次终审输入、triage 与第十一次回修

第十一次评审读取的是 SHA-256 `e5100062006a86b5828630a068f51b615c38aee2642229f572271b0b5e5a9cdc`、19,742 行、1,182,440 bytes 的同一 v10 冻结快照；冻结前TypeScript 5.9.3严格编译读取9个合同块和22个外部边界stub，得到0 diagnostics，alias/union逐constituent必填`never`审计为0，TypeScript块内重复属性为0，44个code fence平衡，42张表无列数错位，trailing whitespace为0，活动文档链接为97文件、broken=0，emoji门为clean。三路均在该SHA不漂移的前提下完成，且均为`FAIL`；本节保留原始失败，不用后续回修覆盖事实：

- [`prompt 133`](../../prompts/133-ai-supply-reference-architecture-final-closure-v10.md) 为40行、3,995 bytes，SHA-256 `5213b49d3eee95eb5187e2e52cc1c97be98e28ea5494af681389d7f7a46431d6`；[`架构闭包复核 133`](../../research/codex-findings/133-ai-supply-reference-architecture-final-closure-v10.md) 为`FAIL`、A=7、B=2、C=0，204行、20,448 bytes，SHA-256 `a195d3c2fbd7c2f4b964b72d28992833a21379a1807c5d12ccc77dcae6ed3b45`。
- [`prompt 134`](../../prompts/134-ai-supply-ecosystem-ux-final-closure-v10.md) 为40行、4,209 bytes，SHA-256 `603f363560e7625a33f5d6d5ce8b4eb74481143932cfb5f3f217439a2711f18e`；[`生态体验复核 134`](../../research/codex-findings/134-ai-supply-ecosystem-ux-final-closure-v10.md) 为`FAIL`、A=1、B=2、C=0，76行、12,799 bytes，SHA-256 `5c0ff9e28b089d666aa5e872dc43e0bcb0e6df2175652cd1113b6d5824aed4f1`。
- [`prompt 135`](../../prompts/135-ai-supply-reference-grade-final-adversarial-v10.md) 为23行、2,689 bytes，SHA-256 `451424df48b68a84c441622d35a754d385d8247e4901e5e2ab6e636916d29956`；[`Codex对抗复核 135`](../../research/codex-findings/135-ai-supply-reference-grade-final-adversarial-v10.md) 为`FAIL`、A=12、B=5、C=0，169行、18,900 bytes，SHA-256 `47497c78162d7223ad54df1993fe5c86b8cf8f6e7601064d4c3b3d97515f9431`。日志`logs/135-ai-supply-reference-grade-final-adversarial-v10.jsonl`为513行、2,875,429 bytes，SHA-256 `32e732612f6b223147d6baf1635222b7e97e1753750e1903549ae99077aa509e`；其中349行为有效JSON、164行为非JSON诊断，最后一个有效事件为真实`turn.completed`且完成事件计数为1。

三路发现按物理授权、Execution生命周期、生态最低真相和可机械验证发布证据四个根因族合并。下表中的“回修”只代表当前 v11 拟议合同、Phase、TCK与官方证据基线已同步；它不代表生产实现，也不代表下一冻结SHA已经终审通过：

| 第十一次问题族 | 根因级回修 | 机械验收落点 |
|---|---|---|
| pre-intent closure仍靠泛化资源摘要，API-key/workload/OAuth与physical send存在缺口或producer环 | 所有可产生socket、network byte、secret、credential/signature、browser、process/listener、effect或hold的lease统一为`AuthorityInventoryBearingLease`，逐kind/ordinal/subject映射准确release set；descriptor保持无final-lease反向边，final lease后才materialize credential、闭合hosted-tool bundle并生成send intent；API-key absent分支不再同时要求credential | §4.2、§4.16.1–§4.16.2、Phase 0/1/3/7/8、`pre-intent-authority-closure.model`与`inference-funding-attempt.model` |
| child escrow、bootstrap cursor与settlement/finality存在互相引用或无唯一后继 | 删除持久cursor对尚未产生hold/settlement的反向边；reservation/finality按映射lease kind竞争同一revision，bootstrap registration与status query共享单向budget cursor，registration cap与query cap分别固定 | §4.2、§4.16.1/§4.16.5、Phase 0/3/8、budget与anchor两套model/TCK |
| Execution close与turn可独立CAS，peer/process仍可用bare ref，unknown recovery混合query/cleanup | stdio、loopback、remote identity改为surface映射联合；close lease与turn lease竞争同一session cursor/revision，close terminal不二次CAS，intent前失败精确释放并回retry-ready。turn unknown将`authority_query`与`effect_cleanup`拆成不同intent/terminal，cleanup需query的权威disposition，still-unknown只回required | §4.2、§4.8–§4.10、Phase 5/8、`execution-surface-chain.tck` |
| Execution成功、tool-call与人工结果可脱离真实响应字节 | 模型与tool外部响应分别新增`ExecutionResponseEvidenceReceipt`和`ExecutionToolResponseEvidenceReceipt`，强绑准确lease/send intent/request、raw inventory、decoding、loss、权威/advisory extraction、result/tool occurrences；普通、committed-effect、zero-work与manual committed result严格互斥，manual分支绑定原unknown effect和独立authority且排除普通committed terminal | §4.2、§4.8–§4.10、Phase 5/8、Execution两套model/TCK |
| restart失败没有stage、清理基线和unknown恢复，close前状态可永远卡住 | restart按五个物理stage判别；intent前逐authority关闭，已知失败只有完整`StageCleanup + SafeRetryBaseline`可重试，candidate/listener未知只走query reconciliation。直接或reconciled loaded success互斥进入同一commit pending，still-unknown不重启 | §4.2、§4.16.1/§4.16.6、Phase 3/8、`conformance-round-closure.model` |
| fallback同时存在named slots与tuple两份真相，跨solution/slot仍可拼接 | `SupplySolutionReceipt.slots`成为唯一四槽tuple；template、alternative、envelope、admission、cursor、attempt、terminal、advance全部由同一`invokedSlot`映射准确tuple member，named副本与跨slot/solution在类型/Zod/CAS/fold四层拒绝 | §4.2、§4.6、Phase 3/5/8、`inference-funding-attempt.model` |
| reference minimum停在品牌或entry布尔，BytePlus、LM Studio、Kimi双协议、OpenCode执行面与企业auth recipe不可从唯一truth推导 | 历史v11首次建立当时61行`REFERENCE_REQUIREMENTS_V3`和`ReferenceRequirementsDerivationReceiptV3`，逐`entry+surface/protocol+auth+realm+platform+recipe`固定；BytePlus、Azure四auth、Bedrock四auth/SSO、Kimi Code双协议、LM Studio/oMLX三协议、OpenCode Zen/Go各三协议与Server HTTP/ACP均有编译期断言和逐requirement gate，V1/V2只可迁移且`gaEligible=false` | §4.16.5、§9、Phase 0/3/8、`realm-and-ga-binding.tck` |
| UX可借最宽enterprise限额，手填字段与离开/返回焦点没有真实门 | 每个journey tier映射自己的scalar与per-class limit；`manualFieldCount`从完整typed action inventory求和，external task、MFA、copy/paste、leave/return与前置事件同样计入。`ReturnFocusPolicyV1`保存离开前准确window/route/card/control/nonce并按可见可用目标顺序恢复，键盘和screen-reader证据进入release gate | §4.16.5–§4.16.6、§8–§9、Phase 0/6/8、`realm-and-ga-binding.tck` |
| remote witness只有发布物与自报SLO，缺真实production运行资格 | 新增当前production deployment+threshold set的至少24小时operational qualification：每member至少288个签名append/read/consistency run、双独立observer domain、逐quorum序列、availability/P50/P95/P99、七类故障注入与raw signed corpus独立replay；release精确消费且检查未过期 | §4.16.4–§4.16.5、Phase 0/8、`platform-anchor-offline-mode.tck` |
| publisher公平仍是一句opaque service curve，无法机械验证舍入、restart与overload | 用twelfths整数递推定义逐interval actual worker-time、debt、reservation、dispatch tie-break、service window、cohort rotation与restart restore；第5–8个只保证600秒active-cohort admission，第9个立即拒绝。独立reference evaluator与十类mutation逐state/decision digest对账 | §4.13、§4.16.3、Phase 0/8、`plugin-budget-state-machine.tck` |
| discovery conformance subject漏mode、budget、provenance、environment与artifact/config generation | provider-agnostic/specific semantic subject与flat report都强制携带并逐字段相等，错mode/environment/generation或漏provider profile无法借另一份discovery报告 | §4.15、§4.16.4、Phase 4/8、discovery conformance TCK |

历史v11回修后的本地预审以TypeScript 5.9.3严格编译9个合同块得到0 diagnostics；全局required-`never`扫描为0、重复TypeScript属性为0，当时61行requirements的duplicate key与duplicate composite subject均为0；44个code fence平衡、42张表无列错、trailing whitespace为0，活动文档链接为97文件、broken=0，`bash scripts/check-emoji.sh`为`[ok] emoji gate: clean`。下一步必须冻结v11准确字节并重新执行两路全新零上下文subagent与一次target-only Codex对抗评审；三路A=0、B=0之前，本文头部状态不得宣称终审通过。

### 17.10 第十二次终审输入、triage 与第十二次回修

第十二次评审读取的是SHA-256 `3b93808d641a6f2a59a1938ae6526280da1d7746dc8acf4197d030cdc6bf8ed1`、22,507行、1,363,124 bytes的同一v11冻结快照。两路subagent均为全新零上下文；外部Codex使用`gpt-5.6-sol`、`model_reasoning_effort=max`、`-s read-only`和target-only prompt。三路均为`FAIL`，本节保留真实失败；当前回修不改变报告当时的结论：

- [`prompt 136`](../../prompts/136-ai-supply-reference-architecture-final-closure-v11.md)为40行、3,944 bytes，SHA-256 `eb084051b73ba05d6dfb0805a96b4c3b7814632ffadbc46497a5b61a5a964d6b`；[`架构闭包复核 136`](../../research/codex-findings/136-ai-supply-reference-architecture-final-closure-v11.md)为`FAIL`、A=4、B=2、C=0，91行、15,241 bytes，SHA-256 `16fb148d56fb8a073ca610fab877eeab74e5896e56bb9c23d9ea5083683cdc28`。
- [`prompt 137`](../../prompts/137-ai-supply-ecosystem-ux-final-closure-v11.md)为40行、4,277 bytes，SHA-256 `2839d2367cdf01bfb895c84666bb868d3f4a14962d9893583c70a499800df342`；[`生态体验复核 137`](../../research/codex-findings/137-ai-supply-ecosystem-ux-final-closure-v11.md)为`FAIL`、A=4、B=1、C=0，82行、16,340 bytes，SHA-256 `76aaaff78031f73255e6c7b6253fe223756548cce713efb0b7e1293d92e90a1c`。
- [`prompt 138`](../../prompts/138-ai-supply-reference-grade-final-adversarial-v11.md)为23行、2,556 bytes，SHA-256 `85ebe4123a61248335168cecc5e202626b165dbb10036937c3dc7e5374043c8c`；[`Codex对抗复核 138`](../../research/codex-findings/138-ai-supply-reference-grade-final-adversarial-v11.md)为`FAIL`、A=7、B=3、C=0，120行、16,207 bytes，SHA-256 `0fac13c6d483ae3f73131cfb6efff41b2338da55554ea33d2df5f57cd570974d`。日志`logs/138-ai-supply-reference-grade-final-adversarial-v11.jsonl`为696行、2,685,546 bytes，SHA-256 `318d56db3e93e549b8f556266e12be1e3b4652bbe7299a7a86d7641d19cbed4b`；其中487行为有效JSON、209行为非JSON诊断，最后一个有效事件为唯一真实`turn.completed`，进程退出码为0。

三路发现按authority生命周期、producer DAG、Execution闭包、自动供给资格、discovery语义、真实账户旅程和公平调度八个根因族合并。下表中的“回修”表示本文当前v12拟议合同、Phase和TCK已同步，不表示生产实现已经施工，也不预先宣称下一冻结SHA通过终审：

| 第十二次问题族 | 根因级回修 | 机械验收落点 |
|---|---|---|
| descriptor前后多类租约不保证非空完整inventory，expiry/restart或abort可能漏关authority | 只有最终登记的`*LeaseReceipt`可结构上持权；66个声明、7个纯alias、59个concrete policy从AST精确对账。任何非标准持权名只能是三项无增字段纯alias；每个inventory非空并按kind/ordinal/subject/commit token逐项typed release，restart admission等待全量sweep | §4.2、Phase 0/1/3/4/5/7/8、`pre-intent-authority-closure.model` |
| hosted Gate、effect与最终network send重复或悬空持权，公共descriptor/envelope与后继形成环 | producer固定为descriptor→final lease→credentialized envelope→hosted bundle→send intent，删除全部反向digest；Gate allow先关闭准确Gate authority再产生single-use effect permit，permit按committed/not-committed/delivery-unknown关闭，deny与not-invoked各有准确retirement；最终bundle只持network authority | §4.2、§4.6、Phase 0/3/8、`inference-funding-attempt.model` |
| Execution resolved/cleanup与close竞争同一revision，人工committed result和准确surface identity不可构造 | reconciliation terminal先生成独立close-ready revision，close只消费该后继；manual committed final transition绑定原unknown effect和独立authority。stdio、loopback HTTP与remote HTTP分别映射准确process tree、OS peer与upstream-attested sandbox，并以编译正反例拒绝跨surface拼接 | §4.8–§4.10、Phase 5/8、Execution两套model/TCK |
| custom/official unknown-metering仍可进入推荐、evaluator、自动fallback；四槽能力轴不足 | funding template、decision与binding严格拆automated和manual-only，unknown只能由用户对准确物理调用逐次确认；dialog/thinking/cheap/evaluator分别要求conversation、reasoning、cost qualification、strict schema与独立性证据，类型断言拒绝plain dialog或unknown funding换挂 | §4.2、§4.6、Phase 3/5/6/8、`capability-slot-funding.tck` |
| 三种discovery mode被压成两种语义，live证据与deterministic core混装，probe authority终态过宽 | static/passive/explicit-active拥有三份互斥semantic subject与run evidence；core不含live lease/decision/time。passive以同held socket admission→intent→terminal并typed关闭准确network authority；explicit active逐动作闭合lease/inventory/intent/terminal和完整release set | §4.15、§4.16.4、Phase 4/8、`discovery-conformance.tck` |
| enterprise/custom requirement无可执行账户起点、recipe字段或state producer；secret-header字段缺失 | 历史v12把五类journey tier、八类真实账户起点、逐step graph、五条custom recipe和完整state producer registry放入当时61行唯一requirements真相；secret-header name/value、mTLS handle及Chat/Responses/Messages各自有typed字段和恢复链 | §4.16.5–§4.16.6、§8–§9、Phase 0/6/8、`realm-and-ga-binding.tck` |
| UX日志不能严格派生等待、copy/paste、raw/app time、焦点与条件式MFA，图节点点击口径可任选 | event总函数加入run起止、monotonic clock、visibility、wait、copy/paste、field ID、window/route焦点和parent-bound MFA；每个step判别`user_primary_action/automatic`，前者恰有一个step/action event，后者无按钮。独立路径求值穷举全部账户起点与前向路径，按精确tier核对主动作、外部任务、字段与离开返回 | §4.16.6、§8、Phase 6/8、`realm-and-ga-binding.tck` |
| OpenCode Server/ACP与CC Switch被错误套用provider账号/OAuth图，本地已安装服务仍要求虚构billing | 增独立execution-local graph与stdio/HTTP/bridge recipe；Codex/Kimi订阅stdio继续走账户/OAuth，OpenCode Server/ACP与CC Switch只走installed/not-running、binary/loopback证据和验证。HTTP密码作为一个optional secret正反fixture，ACP/bridge零伪造字段 | §6、§9、Phase 5/6/8、`realm-and-ga-binding.tck` |
| 公平调度按publisher alias重复记服务，舍入、overload与第5–8组语义不唯一 | 唯一主体改为signer-realm admission/debt group，actual service聚合其全部alias且候选每组至多一个；`-13..13`固定signed truncate，0–8 exact tuple表达active/waiting，第5–8组只承诺cohort admission，第9组立即capacity unavailable | §4.13、§4.16.3、Phase 0/8、`plugin-budget-state-machine.tck` |

历史v12回修后的预冻结机械自审从当时全文重新读取9个TypeScript合同块和22个外部边界stub：TypeScript 5.9.3 strict为0 diagnostics；619个文档type alias中376个实际union alias、2,987个constituent的必填`never`为0，TypeScript块内重复属性为0。authority census得到66个声明、7个alias、59个concrete和59个policy，结构持权的非`LeaseReceipt`名称恰为登记的三项纯alias且无missing/extra。当时61行requirements无重复key或复合subject；独立运行时投影SHA-256为`e22861fb3d95055fb813528552e8119a7fec8db66c38150a8b3bab9df93730be`，逐producer检查及184条账户起点前向路径的signed tier求值均为0 failures，观察最大值为主旅程4个动作、含anchor 6个动作、4个外部任务、5个字段和3次离开返回。本节落盘后的文档结构门为44个fence delimiter成22对、44张表且0列错、trailing whitespace为0、211条Markdown链接中93条本地链接且0 broken；仓库活动文档链接门为97文件、0 broken，两套emoji门均为clean。下一冻结的准确字节数与SHA将写入三份detached review prompt；三路A=0、B=0之前不作终审通过声明。

### 17.11 第十三次终审输入、triage 与第十三次根因回修

第十三次评审读取的是SHA-256 `7ffadde7837eeab3332431a67437aff2a65595cc1e9cda8c88c69a2e970e8d09`、25,018行、1,513,595 bytes的同一v12冻结快照。两路subagent为全新零上下文；外部Codex使用`gpt-5.6-sol`、`model_reasoning_effort=max`、`-s read-only`和target-only prompt。三路均为`FAIL`，当前v13回修不覆盖这些失败事实：

- [`prompt 139`](../../prompts/139-ai-supply-reference-architecture-final-closure-v12.md)为30行、3,491 bytes，SHA-256 `d6d01f82135405e9b0cdbcb6917208e16ab8afa14aef3e50a6004f08b4a88ebc`；[`架构闭包复核 139`](../../research/codex-findings/139-ai-supply-reference-architecture-final-closure-v12.md)为`FAIL`、A=2、B=2、C=0，157行、16,667 bytes，SHA-256 `335fe11c253e37befb639b8899449ccf588820b799c820af38c25e3497b581ac`。
- [`prompt 140`](../../prompts/140-ai-supply-ecosystem-ux-final-closure-v12.md)为30行、3,702 bytes，SHA-256 `80ba0ff811db246751f85de8017beddc134b9f36e03735e9764e7c0d16c5e1cc`；[`生态体验复核 140`](../../research/codex-findings/140-ai-supply-ecosystem-ux-final-closure-v12.md)为`FAIL`、A=5、B=1、C=0，150行、18,709 bytes，SHA-256 `ae4909eb381b5be65cc43b0e20f4866aff2367cf1245239d6ff83c57d131937e`。
- [`prompt 141`](../../prompts/141-ai-supply-reference-grade-final-adversarial-v12.md)为28行、2,966 bytes，SHA-256 `752224a70e3e396bd2a6162e7b734a7e29727f558c32d9c6dee294fc99176023`。该次只读任务真实完成并给出`FAIL`、A=19、B=8、C=0，但因其沙箱不能写指定报告，只留下15行失败与落盘错误记录；日志`logs/141-ai-supply-reference-grade-final-adversarial-v12.jsonl`为1,039行、3,468,933 bytes，SHA-256 `517dfc741f2a2581c1793add39d1332e95e109ccf0d3beef88f54b2ab269c9be`。不把这份不完整报告冒充详细证据。
- 为恢复完整可审计发现，使用同一冻结SHA和更严格的逐节输出协议执行[`prompt 142`](../../prompts/142-ai-supply-reference-grade-final-adversarial-v12-report-recovery.md)，其为27行、3,521 bytes，SHA-256 `1b7ee09ddf8b2dc0b5a27f03b0055be7b6ff22909a08e16e022abb43c714806f`；[`完整对抗复核 142`](../../research/codex-findings/142-ai-supply-reference-grade-final-adversarial-v12-report-recovery.md)为`FAIL`、A=18、B=11、C=0，325行、36,117 bytes，SHA-256 `8d9a57b313a99a56ef648293113039fbdc9a15baf775274cee7159f6b1048ba3`。日志`logs/142-ai-supply-reference-grade-final-adversarial-v12-report-recovery.jsonl`为996行、3,539,504 bytes，SHA-256 `a6f916c090cb2a9d481b83505016b54b1b0e01b513181b4fc82ed400a811d3f6`。第142份作为第141份的完整恢复报告，计数差异不被静默合并；v13按两份发现并集处理。

第139、140、142份完整报告以及第141份可恢复摘要按根因合并如下。表中“回修”只表示v13拟议合同、阶段与持续门已同步，不表示生产实现已施工，也不预先宣称下一冻结通过：

| 第十三次问题族 | 根因级回修 | 机械验收落点 |
|---|---|---|
| unknown funding可藏入自动decision，slot/fallback又可把另一template或裸decision换挂；custom eligibility允许非法状态笛卡尔积 | proof、runtime authorization、decision与每个准确slot admission共同参数化为同一dependent funding template和receipt identity；manual unknown在类型上不能进入推荐/evaluator/fallback/background。eligibility改为严格分支，private rights只接受同endpoint/product/use/distribution/principal的custom-attested分支 | §4.2、§4.6、Phase 0/1/3/5/8、`capability-slot-funding.tck`、`inference-funding-attempt.model` |
| authority registry按声明而非联合分支定权、release/restart不是逐inventory双射，所谓AST census仍来自人工名字表 | registry升级为`type + discriminant path/value`的逐constituent声明；read-only、side-effect、query、cleanup、manual-block与七种Execution start surface各有准确权限集。release tuple由具体inventory映射，restart recovery按同一登记分支生成；compiler API独立扫描最终AST，再与registry双向比较 | §4.2、Phase 0/1/3/5/8、`pre-intent-authority-closure.model` |
| evaluator operation存在两套语义，单row可自报`review_ready`，GA pass又无需live/Activation/active pointer | 删除伪独立`evaluate` operation，evaluator按chat operation取得逐operation Rights/Billing/Funding；单row正向终态固定为`conversation_ready`。Supply、Execution、control各有私有positive-terminal producer且构造输入为准确typed chain；全局`review_ready`只由四元素slot-qualification tuple生成，每槽绑定同一solution tuple成员、当前pointer、chat success、conversation-ready gate与distribution，evaluator proof与solution同值 | §4.2、§4.3、§4.16.5–§4.16.6、Phase 0/3/6/8、`capability-slot-funding.tck`、`realm-and-ga-binding.tck` |
| Execution首个spawn/connect前缺准确surface，close-ready、manual committed result与subject可跨session/tool/effect换挂 | stdio本地三分支与HTTP loopback/remote四分支逐项绑定start/admission/identity/sandbox；reconciliation先产生同session/terminal的新close-ready revision。人工结果强绑原unknown effect、单次authority、准确tool invocation和result material | §4.8–§4.10、Phase 5/8、`execution-surface-chain.tck`、`execution-tool-child-lease.model` |
| discovery explicit-active可借任意authority，IPv6 raw IP与URL authority混成两种identity | 每个explicit action强绑同lease/inventory/intent/terminal和完整typed release tuple；统一保存`127.0.0.1 \| ::1`的raw canonical IP，URL serializer才把IPv6派生为`[::1]`，并加入IPv4/IPv6和括号混用golden/mutation | §4.15、§4.16.4、Phase 4/8、`discovery-conformance.tck`、`passive-loopback-peer.tck` |
| plugin implementation/policy/Activation可换挂，TUF root/delegation/raw metadata/high-watermark可跨repository拼接，remote witness qualification可即时伪造 | plugin manifest、publisher signer、artifact、permissions、core、policy、runtime与Activation形成同一closure；TUF以原始五role metadata、完整delegation lineage、逐repository+role high-watermark和exact target authorization闭合。witness production deployment与threshold set使用私有producer，24小时raw signed corpus、双observer、逐member/quorum/fault与独立replay逐字段同值 | §4.4、§4.12–§4.13、§4.16.5、Phase 0/3/8、TUF/plugin/witness三套TCK |
| signer-realm身份可由调用方拆组复制公平份额 | 私有identity normalizer从已验证registry source与canonical signer chain派生唯一group receipt；调度器和独立evaluator都从原始签名事实重算，覆盖同realm多display ID、display ID漂移、伪造chain与跨realm复用display ID | §4.13、Phase 8、`plugin-budget-state-machine.tck` |
| failed/cancelled/rejected可冒充pass，visibility/app time和全部scalar不是总函数，MFA/条件字段缺可重算挑战证据 | event fold改为pass/fail/incomplete严格判别；successor只消费成功前驱。run起点携带initial visibility，事件按ordinal与monotonic clock总序，半开区间闭合；每个scalar输出实际值/签名上限/comparison，逐项N+1 mutation。MFA、OpenCode password和LiteLLM optional secret都由权威positive/negative observation分支驱动，成立时恰一field event，不成立时字段为零 | §4.16.5–§4.16.6、§8、Phase 0/6/8、`realm-and-ga-binding.tck` |
| runtime state source只校验名字，不校验观察/动作/后置方向；本地ready、冷态、停止态和容器多态处方被压成伪零配置直线 | compiler-selected assertion plan为每个required state固定`observes_precondition \| causes_transition \| proves_postcondition`及准确source，运行时不可伪造evidence set逐键闭合。`local_service_ready`只走零动作passive→validation；managed/unmanaged按准确负向state进入独立install/start/load或enable/repair/load恢复图，恢复terminal前禁止zero-config pass，之后仍需live/Activation/pointer | §4.16.5–§4.16.6、§6.3、§9.5、Phase 0/4/6/8、`local-product-journeys.tck`、`realm-and-ga-binding.tck` |
| guided key没有厂商侧创建credential，OAuth signed-out会绕过entitlement，OpenCode密码没有可执行条件路径 | guided key显式执行账号创建/登录→权威entitlement观察→缺失才billing→厂商侧credential创建→typed字段录入→验证；最坏主旅程4动作、含anchor 6动作、copy/paste 2次。OAuth所有已有账户起点都先完成本应用授权或key exchange，再观察当前principal entitlement。OpenCode password与LiteLLM secret各有challenge-required/absent分支、条件字段和正反证据 | §3、§4.16.5–§4.16.6、§8、Phase 0/5/6/8、`oauth-state-machine.tck`、`realm-and-ga-binding.tck` |
| 历史v12的61行机器真相漏普通CLI和第二具名bridge，与正文minimum冲突；owner additions可碰撞固定key | 历史v13把固定SoT增为63行，新增普通`cli_stdio`和LiteLLM OpenAI bridge，并用编译期critical assertion钉住；owner key限制为canonical `owner.<owner>.<name>`，对NFKC、小写ASCII、confusable、固定+追加key/composite subject做完整collision检查，owner只能追加不能替换 | §4.16.5、§9.9、Phase 0/5/8、`realm-and-ga-binding.tck` |
| requirement run可换挂其他protocol/auth/realm/surface的conformance，a11y只有digest，支持页/picker/test matrix/release note不在release图 | exact branded run subject把row、账户起点、graph entry、recipe、state plan、platform/locale/anchor绑为一体；generic conformance payload/attestation/release binding直接以同一core参数化，row semantic producer再绑定准确core与distribution。a11y/ICU收据携带platform、locale、viewport、zoom、input、screen-reader、DOM/a11y/focus/live/screenshot原始证据并做矩阵双射。四类支持产物各有generation input、generator与exact bytes收据，完整四件套进入release binding | §4.15–§4.16.6、Phase 0/2/6/8、`realm-and-ga-binding.tck`、供应链门 |
| bridge被压成capability或execution协议，CC Switch control requirement不可构造；开放扩展协议的mapped union使编译器耗尽内存 | 新增独立`reportKind=bridge`和`BridgeControlProtocolId`；inference data-plane与bridge control为常数复杂度的两类联合，由私有producer把protocol dependency、semantic subject、route/failover、费用、数据和credential isolation逐项同值。CC Switch与LiteLLM分别有正向可达和跨类负断言；禁止在开放模板字面量上建立mapped type | §4.2、§4.15、Phase 0/5/8、`bridge-conformance.tck`、strict TypeScript性能门 |
| Gate/effect/passive-peer的release target与Execution完成终态在类型上不可达 | transport admission、hosted Gate与effect permit分别声明准确`network_admission/gate_lease/external_effect` inventory；terminal逐项消费映射型release。Execution turn的completed/failed由outcome映射展开，使`completedTurnTerminal`正例非`never`；required-never门忽略的仅为私有unique-symbol品牌 | §4.2、§4.8–§4.10、§4.15、Phase 0/3/4/5/8、authority与Execution持续门 |
| `review_ready`与旧同义状态冲突 | 唯一状态词固定为`review_ready`，独立性失效唯一转移为`review_ready → conversation_ready`；类型、reducer、UI、文案和生成支持材料由同一状态机投影 | §7.3、§8、§12、Phase 6/8 |

历史v13还主动收紧了对外可执行真相：当时固定63行只代表reference-grade最低闭包，长尾provider通过受签provider pack、protocol profile、detector或execution driver扩展；每个owner追加项都必须进入同一requirements/run/evidence/release投影。该轮仅完成方案文档的根因回修，未施工生产代码。

历史v13冻结前机械自审从当时全文重新读取9个TypeScript合同块，并只为22个明确的外部SDK边界名称提供`any` stub：TypeScript 5.9.3 strict得到0 diagnostics。文档自身722个type alias中有392个实际union alias，共3,520个alias/union constituent；12个必填`never`全部来自私有`unique symbol`品牌，非品牌必填`never`为0，重复TypeScript属性为0。authority对账得到71个声明与71个expected、8个纯alias、63个concrete，其中5个branch-dispatched、58个branch-free；58个required policy和21个constituent policy无missing/extra，三项非`LeaseReceipt`持权名恰为登记纯alias。当时63行requirements无重复key或复合subject，分布为55条inference、5条execution、2条bridge和1条control plane；智谱双协议、Kimi普通/会员、OpenCode Zen/Go/Server、普通CLI、CC Switch、LiteLLM、oMLX三协议与custom三协议的critical key均非空。结构门为44个fence delimiter且平衡、45张表零列错、零尾随空白；排除代码区后的218条Markdown链接中100条为本地链接且零缺失，118个外部URL唯一。仓库活动文档链接门输出`[ok] active document links: files=97 broken=0`，目标文件与全仓emoji门均输出`[ok] emoji gate: clean`，`git diff --check`为0。以上只证明该轮候选方案的本地可解析性和合同自洽；仍须冻结准确字节并重新执行两路全新零上下文和一次target-only Codex对抗评审，任一路A/B非零都继续回修并重新冻结。

### 17.12 第十四次终审输入、triage 与第十四次根因回修

第十四次回修读取的是SHA-256`ae03c940ee211ee816c608cbddcd8536d7dc80a2847e057c2844a611226fe743`、28,097行、1,679,137 bytes的同一v13冻结快照。两路subagent均为全新零上下文；外部Codex使用`gpt-5.6-sol`、`model_reasoning_effort=max`、`-s read-only`和target-only prompt。三路都完成了冻结身份核对并给出`FAIL`，当前v14回修不能覆盖这些失败事实：

- [`prompt 143`](../../prompts/143-ai-supply-reference-architecture-final-closure-v13.md)为31行、2,560 bytes，SHA-256`e0418d0210f2bb1996fb2bb247cac6ecbd76cd840e65b1fd04358ae74a3a5ab5`；[`架构闭包复核 143`](../../research/codex-findings/143-ai-supply-reference-architecture-final-closure-v13.md)为`FAIL`、A=3、B=2、C=0，308行、20,676 bytes，SHA-256`01dd0343a77df4aa7af35c4357cd02fec58ba0886b983313e0bab0924da27c78`。
- [`prompt 144`](../../prompts/144-ai-supply-ecosystem-ux-final-closure-v13.md)为28行、3,214 bytes，SHA-256`a72df27fb8e54614590f53788df75e15bd9c321539f3bb4f2851c11f2495ba2e`；[`生态体验复核 144`](../../research/codex-findings/144-ai-supply-ecosystem-ux-final-closure-v13.md)为`FAIL`、A=1、B=2、C=1，235行、21,158 bytes，SHA-256`7e8bab54d22539bbd3a77145b5aacf67466069dfa901baddc39697901acb18ed`。
- [`prompt 145`](../../prompts/145-ai-supply-reference-grade-final-adversarial-v13.md)为11行、1,925 bytes，SHA-256`37ce3ff2f5232384af20984323f992c19be7bc74a7043f094aab68b614e39982`；[`Codex对抗复核 145`](../../research/codex-findings/145-ai-supply-reference-grade-final-adversarial-v13.md)为`FAIL`、A=9、B=4、C=0，219行、22,501 bytes，SHA-256`17d48be5156892dcefa945b239d43f1a04a6befe02eef27df2fb91ed6f092bef`。事件日志`logs/145-ai-supply-reference-grade-final-adversarial-v13.jsonl`为583行、2,673,287 bytes，SHA-256`98994721ef16875010de0e5a170bbe624bf1bd1507b3c29a5d679150a8232c2c`，最后一个事件为真实`turn.completed`。

三路发现按同一不变量能够消除的根因合并如下。表中的“回修”只表示v14拟议合同、Phase和持续门已经同步，不表示生产实现已施工，也不预先宣称下一冻结快照通过终审：

| 第十四次问题族 | 根因级回修 | 机械验收落点 |
|---|---|---|
| runtime recovery的期望状态来自recipe通用scenario，证据可跨requirement换挂 | 每条requirement逐state生成`normal_observation/recovery_required`分类，recovery state、首步、终态与品牌证据都从同一row机械派生；generic V5证据不能直接进入row gate | §4.16.5–§4.16.6、Phase 0/4/6/8、`realm-and-ga-binding.tck` |
| `SupplySolutionReceipt`可直接写`review_ready`，逐槽gate可复用 | 基础solution不再携带`review_ready`；只有私有producer可生成`ReviewReadySupplySolutionReceiptV5`，并按solution、slot ordinal、requirement、binding、当前Activation pointer、chat terminal、journey gate、distribution和evaluator proof逐字段绑定准确四元素tuple | §4.2、§4.16.5–§4.16.6、Phase 0/3/6/8、`capability-slot-funding.tck`、`realm-and-ga-binding.tck` |
| restart sweep的after-intent分支接受裸`ReceiptRef` | registry每个constituent声明准确action-intent、in-flight cursor、domain terminal及私有producer；recovery sweep只消费同registry row品牌化pair，裸ref、generic wrapper、跨row terminal和错lease均不可构造 | §4.2、Phase 0/1/3/5/8、`pre-intent-authority-closure.model` |
| 22个核心IR/wire/discovery/snapshot名称被伪装成“外部SDK”并用`any`补齐 | 文档合同内完整定义全部内部类型，strict编译不再注入任何内外部`any` stub；遗漏任一TS block、未定义名或新增`any`都使统一orchestrator非零 | §4.2–§4.16、Phase 0、`type-contract-compile-budget.model` |
| 合同冷编译接近资源边界却没有预算 | 历史v14冻结TypeScript 5.9.3、runner、argv与lockfile，并采用当时2 MiB/40,000行、900,000 instantiations、2.5 GiB peak RSS、60 s wall绝对门及相对回退门；当前预算已由v19按手写/生成物拆分并加入30%容量门 | §4.13、§12.1、Phase 0/8、`type-contract-compile-budget.model` |
| receipt envelope可写，嵌套subject与持久化别名可篡改 | `ReceiptRef`及其canonical subject改为deep-readonly，私有constructor在JCS校验后冻结对象；runtime与持久层复验digest并拒绝alias mutation | §4.2、Phase 0/1/8、`receipt-dag-and-anchor.model`、供应链门 |
| rights、credential egress、ACL与route仍允许裸引用或非法eligibility | allowed rights、credential custody/wire/challenge、broker ACL、egress与route全部按principal/product/surface/operation/endpoint/distribution参数化，forbidden/unknown分支不能进入首字节授权 | §4.2、§4.5–§4.6、Phase 0/1/3/5/8、rights/transport/funding三套门 |
| unknown metering可进入priced/no-new-spend，任意receipt可冒充订阅或overage关闭 | known-priced、subscription、owned-capacity与external-unknown使用封闭closure；funding template、operation、route、principal、biller/account及credential version同值，unknown只允许用户对准确物理调用逐次确认 | §4.2、§4.6、Phase 0/3/5/6/8、`inference-funding-attempt.model`、`capability-slot-funding.tck` |
| TUF repository、role、target path与rotation证据被擦除 | repository kind、role、target namespace进入泛型和私有品牌；producer显式消费连续raw root rotation、完整delegation lineage、可信时间与逐repository+role high-water CAS | §4.4、Phase 0/1/3/8、`tuf-root-role-rollback.tck` |
| Gemini、Azure、智谱等wire auth不准确，custody/wire/challenge混成一个字段 | 拆`CredentialCustodyProfileV5`、`WireAuthSchemeV5`与`AuthChallengeModeV5`；逐requirement固定Gemini`x-goog-api-key`、Azure`api-key`/Entra Bearer、BigModel Chat Bearer/Messages`x-api-key`、Kimi Platform/Kimi Code隔离及Kimi Code Chat Bearer/Messages`x-api-key`、TokenHub两realm三协议；optional Basic/Bearer/none走权威challenge分支 | §4.16.5、Phase 3、`provider-wire-auth-regression.tck` |
| Phase shell块可由末项成功遮蔽前项失败 | 每个Phase与release只公开一个无shell拼接、顺序fail-fast的Node orchestrator；结构化记录每个argv、signal、exit code和artifact digest，首项失败后其余步骤标记`not_run_due_to_predecessor_failure` | Phase 0–8、§12.3、orchestrator mutation self-test |
| GA强制remote witness和三平台sandbox，却没有产品、包、native helper、IaC或运营交付路径 | 新增Phase 1A platform productization，明确`packages/platform-security`、三平台native helper/installer、witness client/service、global/中国大陆/enterprise IaC、签名、密钥仪式、升级回滚和运维SLO | §4.16.4、Phase 1A/5/8、`platform-anchor-offline-mode.tck`与三平台syscall TCK |
| 真实账号全笛卡尔积不可重复，无asset pool、MFA、预算、reset与cleanup | deterministic fixture零Internet穷举73行；真实provider按product/realm/auth/protocol/funding做不超过192 run的最小set cover，从非个人账号池排他lease。pass/fail/timeout/cancel/crash均先删除资源、撤销credential/session、对账usage/billing并恢复baseline，cleanup失败即quarantine和发布失败 | §12.1、Phase 8、`provider-test-account-pool.model` |
| OpenAI Chat、Ollama Responses、LiteLLM Responses/Messages缺行，且当时把CC Switch误设为不可构造的固定control requirement | 固定minimum扩为不可降级73行：增加上述四协议行及TokenHub六行；第十五次回修又把CC Switch当前公开能力改为固定的Anthropic Messages opaque proxy row，control只保留负向inventory fixture。未来稳定control API必须新增profile/requirement，不能在原public-proxy row上静默顶替 | §4.16.5、§6.4、§9、Phase 0/3/4/5/8、`bridge-conformance.tck`、`realm-and-ga-binding.tck` |
| `ConnectorDefinition.protocolProfiles:string[]`允许跨plane垃圾协议，第三方Execution receipt为`never` | inference与execution协议数组分型；connector按kind/plane/protocol/source判别，第三方Execution receipt显式绑定publisher、artifact、sandbox、permission、generation与TCK，不改daemon核心即可由仓外包构造 | §4.10–§4.13、Phase 0/5/8、SDK/TCK门 |
| SQLite operation authority与现有逐PID JSON child registry无升级/降级协议 | 以不可复用process/operation identity建立五态dual-read、shadow-write、reconcile、dual-write、cutover；两个store取精确并集，冲突只quarantine，上一正式版真实降级与rollback window关闭前不删旧投影 | §4.2、§10、Phase 1/8、`runtime-child-registry-migration.model` |
| UX scalar由多处手写，automatic状态仍能出现伪主动作 | graph node使用`automatic/user_required/terminal_start`判别reducer；automatic无`primaryActionId`，后两类各恰一个。所有scalar/per-class limit由versioned graph机械求最坏路径，guided key的`no_account/signed_out`缺billing路径准确为4个SayDo动作 | §4.16.6、§8、§12.1、Phase 6/8、`realm-and-ga-binding.tck` |
| 腾讯当前TokenHub缺失，旧混元仍可能被当fresh路径，套餐名与API资金混同 | 广州与新加坡各建Chat/Responses/Messages三行，固定站点origin、备用origin、key namespace、Bearer或`x-api-key`、Bearer models目录、401002/402/429/SSE terminal和model-service状态；基础为payg，Token Plan/TPM预留/模型单元只作为同principal/realm/model的独立funding observation；旧混元仅existing-connection migration | §4.16.5、§9、Phase 3、`provider-wire-auth-regression.tck`、`realm-and-ga-binding.tck` |
| 历史61/63行、Gemini L1和payg三动作叙述与当前真相并存 | 旧轮次全部显式标注“历史v11/v12/v13/当时”；当前唯一机器真相固定73行、Gemini API-key L0、guided-key最坏四动作，发布生成物不读取历史评审段落 | §4.16.5–§4.16.6、§9、§12、§16 |

v14预冻结机械自审直接读取全部11个TypeScript合同块，不提供任何stub：TypeScript 5.9.3 strict为0 diagnostics、0个`any`关键字；804个type alias中420个解析为union，共3,845个alias/union constituent；33个必填`never`全部是私有computed-brand字段，非品牌必填`never`为0，重复TypeScript属性为0。合同抽取为1,196,868 bytes、27,682行，type instantiations为867,615；连续两次观测的peak RSS为1,818,416–1,823,376 KiB、wall为10.03–10.14 s，均低于预签绝对门。authority声明为71、alias为8、concrete为63、branch-dispatched为5、branch-free为58；58个required policy和21个constituent policy无missing/extra，三项非`LeaseReceipt`持权名仍恰为纯alias。73行requirements无重复key或复合subject，分布为63条inference、5条execution、4条bridge和1条control plane。结构门为52个fence delimiter且平衡、46张表零列错、零尾随空白；12个shell fence均只有一个统一orchestrator命令；排除代码区后的Markdown本地链接零缺失。以上仍只是预冻结自审；下一步必须冻结准确SHA/lines/bytes并完成两路全新零上下文与一次target-only Codex终审，任一路A/B非零都继续回修并重新冻结。

### 17.13 第十五次终审输入、triage 与第十五次根因回修

第十五次回修的输入是三路审查共同读取的同一v14冻结快照：SHA-256 `fcde60a8700dbfc14566d7183a30bf14d0310aa070d628173e23177dd1bda1ab`、30,490行、1,830,991 bytes。两路subagent均为全新零上下文；外部Codex使用`gpt-5.6-sol`、`model_reasoning_effort=max`、`-s read-only`和target-only prompt。三路都为`FAIL`，本节保留原始失败事实；当前v15回修既不改变报告当时结论，也不把尚未施工的生产实现写成已完成：

- [`prompt 146`](../../prompts/146-ai-supply-reference-architecture-final-closure-v14.md)为34行、3,641 bytes，SHA-256 `4bda2f12d053c064443a3c2eaa014ae28e2473ba35e4f6036a92e3abbe8a1b0c`；[`架构闭包复核 146`](../../research/codex-findings/146-ai-supply-reference-architecture-final-closure-v14.md)为`FAIL`、A=4、B=0、C=0，147行、17,964 bytes，SHA-256 `b8e5017264543b1f1d4a70e8042554e2f6c41fc0e339d9249054842b2156097b`。
- [`prompt 147`](../../prompts/147-ai-supply-ecosystem-ux-final-closure-v14.md)为26行、3,309 bytes，SHA-256 `f539e0e7a0fcccd5c16b92e5e77c14952fad3f109192891376f2ceae3197fdab`；[`生态体验复核 147`](../../research/codex-findings/147-ai-supply-ecosystem-ux-final-closure-v14.md)为`FAIL`、A=7、B=2、C=0，121行、20,390 bytes，SHA-256 `b143d2698c8d32e792e277e85ed81d6c50c8bebc937ae6ad0b20ee14f18a6a35`。
- [`prompt 148`](../../prompts/148-ai-supply-reference-grade-final-adversarial-v14.md)为19行、2,653 bytes，SHA-256 `2915f305e622cf35c8041f728b29f09239d0dcf847f36785b5cb38687c3a3989`；[`Codex对抗复核 148`](../../research/codex-findings/148-ai-supply-reference-grade-final-adversarial-v14.md)为`FAIL`、A=9、B=4、C=0，243行、32,687 bytes，SHA-256 `0a6a79b361be260a063ceb892015cbc1e32ef92c6638e226c4bd4e5c6e731d72`。首次运行日志`logs/148-ai-supply-reference-grade-final-adversarial-v14.jsonl`为1,545行、3,920,800 bytes，SHA-256 `14ee1de7a2f4c5d039e2dc9326b050bfe3f914f19281a8a026c4367495ce441e`，未产生`turn.completed`，不作为完成证据；全新会话重试日志`logs/148-ai-supply-reference-grade-final-adversarial-v14-retry1.jsonl`为536行、2,595,356 bytes，SHA-256 `b57e2cb0f40d2472f95e879584eebeb16600509b2a6850f9dc541bd78e839844`，最后一个有效事件为真实`turn.completed`。

三路A/B发现与本轮主动契约审计按共同不变量合并如下。表中的“回修”只表示v15拟议合同、Phase与持续门已经同步，不表示生产代码已经实施，也不预先宣称下一冻结快照通过终审：

| 第十五次问题族 | 根因级回修 | 机械验收落点 |
|---|---|---|
| receipt candidate可伪造、commit前后JCS或嵌套对象可变，deep-readonly又会擦除tuple | candidate与committed receipt分型；私有commit producer复算JCS并deep-freeze，保留tuple和品牌精确形状；普通对象、可变嵌套对象、错误digest及冻结后别名修改均不可进入下游 | §4.2、Phase 0/1/8、`receipt-dag-and-anchor.model`、strict反向断言 |
| authority registry擦除逐分支生命周期，restart/recovery可跨requirement或跨state换挂 | registry按准确receipt分支、discriminant、inventory、intent、in-flight、terminal、release与restart policy闭合；每个requirement逐state派生期望恢复图，不再从全局scenario猜测 | §4.2、§4.16.5–§4.16.6、Phase 0/1/3/5/8、`pre-intent-authority-closure.model`、`realm-and-ga-binding.tck` |
| live provider账号lease绕开统一authority，cleanup失败后无可达重试，账号池缺持久cursor/CAS | 账号池使用generation化cursor、排他asset lease、MFA/admin/principal/flow维度和single-successor CAS；pass/fail/timeout/cancel/crash都进入资源、credential/session、usage/billing清理，pending cleanup签发独立retry authority并只能重试同一清理主体，连续两轮恢复baseline才可复用 | §12.1、Phase 8、`provider-test-account-pool.model` |
| remote行可把live qualification写成`not_applicable`，真实账户set-cover又漏起始auth flow、principal、MFA与admin条件 | compiler从准确row决定deterministic/live义务；remote主体不能选择N/A。最小set-cover把product、realm、protocol、auth、funding、starting flow、principal class、MFA和admin逐维纳入并输出可重算coverage proof | §4.16.5、§12.1、Phase 8、`realm-and-ga-binding.tck`、provider live gate |
| 73行大多数wire/auth只是宽字符串，OpenCode Server操作、optional auth与custom路径无法形成准确请求 | `REFERENCE_EXACT_CONNECTION_ORACLE_V6`为73个固定key逐行冻结method、origin/base语义、relative operation path、models path、公开header/query、wire auth、challenge与recipient；OpenCode Server固定公开`POST /session/{sessionId}/message`。LM Studio、OpenCode Server、LiteLLM使用权威challenge驱动的none/Basic/Bearer分支 | §4.16.5、§9、Phase 0/3/5/8、`provider-wire-auth-regression.tck`、`realm-and-ga-binding.tck` |
| custom Base URL把字符串拼接当安全路径，协议与认证耦合，不能完整表达Chat/Responses/Messages、无认证、自定义secret header或mTLS组合 | 私有normalizer把用户输入提交为带品牌的canonical base directory，operation只接受无前导斜杠的`api_root/version_root`相对路径；协议与应用层认证、传输认证正交建模，覆盖Chat/Responses/Messages乘以none/Bearer/`x-api-key`/custom secret header，再独立叠加none/mTLS，并绑定credential component、recipient、proxy可见性、egress与ACL | §4.5、§4.16.5、§8–§9、Phase 1/3/6/8、`transport-credential-boundary.tck`、`provider-wire-auth-regression.tck` |
| custom与部分云profile的模板变量过宽，固定fixture被误读为运行时组合上限 | custom只保留private-brand profile；Azure必需模板变量缩为`resource`、BytePlus缩为`region`；五条custom固定row明确只是发布资格fixture，运行时允许由安全profile构造全部受支持组合，但未经对应row资格不得形成公开支持宣称 | §4.16.5、§9、Phase 0/3/8、exact oracle与support-claim gate |
| local、CLI、Execution与bridge共用错误恢复处方，graph终点/字段还可继承别的产品 | normal/recovery状态和首步、终态按requirement row机械派生；inference local、Execution stdio/HTTP与opaque bridge使用不同图族。custom graph终点固定为第4步；CC Switch独立零字段；OpenCode Server密码、LM Studio Bearer和LiteLLM secret都只在权威challenge成立时出现 | §4.16.5–§4.16.6、§6、§8–§9、Phase 4/5/6/8、`local-product-journeys.tck`、`realm-and-ga-binding.tck` |
| 账号创建、browser-key exchange与其他认证外部任务没有条件式MFA；UI registry可自由拼action，automatic anchor仍有主动作 | 每个可触发认证的external task都绑定authoritative challenge并分MFA/no-MFA；literal UI registry从graph生成state、message、action和DOM/a11y投影，automatic严格零主动作，查看进度只为secondary control | §4.16.6、§8、Phase 0/6/8、`oauth-state-machine.tck`、`realm-and-ga-binding.tck` |
| UX可访问性矩阵漏theme，mobile paper与desktop dark要求矛盾 | accessibility identity加入声明支持的color scheme；发布矩阵固定desktop light/dark与mobile paper，不伪造mobile dark支持，复制light证据、只改标签或dark-only对比度退化都使gate失败 | §4.16.5–§4.16.6、§8、Phase 2/6/8、a11y/ICU mutation gate |
| OpenCode Go同时声明禁用与启用overage，TokenHub缺free-only资金态且套餐名可能冒充API资金 | Go显式分`go_only_hard_stop`与用户事先接受的`go_then_zen_balance`；TokenHub和同类平台按准确principal/site/key/model/operation区分free-only、free→payg、plan→payg、reserved和dedicated，免费耗尽且付费关闭时零发送 | §4.6、§4.16.5、§9、Phase 3/6/8、`inference-funding-attempt.model`、`capability-slot-funding.tck` |
| CC Switch当前公开桌面能力不能在请求前冻结GUI failover route，却被固定成要求control API的GA row | 固定minimum改为公开loopback Anthropic Messages opaque proxy row；只验证公开代理端点、协议、认证与进程/peer，route/failover一律按不可观测processor处理，不宣称控制、路由冻结或供应商计费归因。未来出现稳定公开control API时必须新增profile和requirement | §4.15–§4.16.5、§6.4、§9、Phase 0/4/5/8、`bridge-conformance.tck` |
| 当前JSON v1 child记录缺operation/writer/containment/spawn identity，旧迁移合同却要求先构造完整v5 identity | migration输入直接接受生产真实`LegacyRuntimeChildOwnershipRecordV1`；可证明者lift，不可证明者进入无signal/delete/spawn authority的`unliftable_quarantined`，双存储以prepare journal、逐store commit和typed repair收口，绝不编造identity或提前cutover | §4.2、§10、Phase 1/8、`runtime-child-registry-migration.model` |
| 四槽`review_ready`可复用dialog terminal或由调用方直接手写，public support又不与准确row和distribution同值 | 四种positive terminal、result、report与gate按slot参数化，基础solution不含`review_ready`；私有producer逐槽绑定同一solution成员、Activation pointer、terminal、journey、distribution和evaluator proof。公开claim是73行closed mapped union，保留准确row、oracle、资格证据与distribution，owner扩展只能追加 | §4.2、§4.16.5–§4.16.6、Phase 0/3/6/8、`capability-slot-funding.tck`、support-claim generation gate |
| 对外L0清单、支持页、picker、测试矩阵和release note可能与73行SoT分叉 | 删除手写支持等级作为发布真相；`PublishedProductProtocolClaimV6`及claim set从准确qualified row生成，再从同一input一次生成支持页、picker、测试矩阵与release note四件套，四者和released distribution共同进入release binding | §9、§12、§16、Phase 0/2/6/8、support artifact mutation gate |
| 三平台helper/installer与remote witness只有digest，平台、backend、服务部署和release不能进入最终门 | macOS/Linux/Windows helper、installer、qualification与enrollment按platform和distribution参数化；witness closure精确绑定threshold、deployment、service、release、realm与production observation，私有producer组成三平台tuple并进入GA evidence set | §4.16.4–§4.16.5、Phase 1A/5/8、`platform-anchor-offline-mode.tck`、三平台syscall TCK |
| 第三方Execution implementation、policy、Activation、session与runtime可以换挂 | Execution closure同值绑定publisher、TUF target、signed manifest、artifact、driver、sandbox、permission/data/workspace-egress、IPC、budget与generation；第三方Activation、session admission、start和runtime必须消费同一closure | §4.10–§4.13、Phase 0/5/8、Connector SDK/TCK与plugin mutation gate |

本轮主动自审还把public support claim、三平台production closure和remote witness都参数化到准确released distribution；所有TypeScript property signature保持readonly；authority census以编译器AST对最终联合逐分支核对，而不是用名字表代替。当前唯一机器真相仍是73行，分布为63条inference、5条execution、4条bridge和1条control plane；CC Switch的正向固定行现在是opaque Messages proxy，control只保留不能发布的负向inventory fixture。

v15冻结前机械自审连续两次直接读取全部11个TypeScript合同块且不注入stub：TypeScript 5.9.3 strict均为0 diagnostics、0个`any`关键字，合同抽取为1,490,264 bytes、30,356行，types为134,210，instantiations为882,412；两次wall分别为2,058.53 ms和2,188.28 ms，peak RSS分别为626,032 KiB和624,768 KiB，全部低于预签绝对门。899个type alias中457个解析为union，共4,468个alias/union constituent；48个必填`never`全部是私有computed-brand字段，非品牌必填`never`为0，重复属性与可写property signature均为0。authority expected为72、alias为8、concrete为64、branch-dispatched为5、branch-free为59；59个required policy和21个constituent policy均无missing/extra。73行requirements与73行exact connection oracle无重复、遗漏、额外或binding错误。结构门为52个fence delimiter且平衡、47张表零列错、零尾随空白，12个shell fence均只调用一个统一orchestrator；235条Markdown链接中112条为本地链接且零broken。仓库活动文档链接门得到`[ok] active document links: files=97 broken=0`，目标文件与全仓emoji门均得到`[ok] emoji gate: clean`，`git diff --check`退出码为0。

文档仍然只是待终审的实施蓝图；必须冻结当前准确SHA/lines/bytes，再完成两路全新零上下文和一次target-only Codex终审。任何一路A/B非零都继续回修并重新冻结，不能用本节自审代替终审结论。

### 17.14 第十六次终审输入、triage 与第十六次根因回修

第十六次回修的输入是三路审查共同读取的同一v15冻结快照：SHA-256 `7fbc0a8ba767d90d84e26a49f83a357d57c5a269f1cf0c43b54c2e6a4d832967`、33,210行、2,146,263 bytes。两路subagent均为全新零上下文；外部Codex使用`gpt-5.6-sol`、`model_reasoning_effort=max`、`-s read-only`、target-only prompt和关闭stdin的headless形态。三路都为`FAIL`，本节保留原始失败事实；当前第十六次回修不改变报告当时结论，也不把尚未施工的生产实现写成已完成：

- [`prompt 149`](../../prompts/149-ai-supply-reference-architecture-final-closure-v15.md)为32行、4,449 bytes，SHA-256 `3d13d3c8cab4b875835f3bf54018fbb0b5898813897a2bdfaaad194d77ab8a1c`；[`架构闭包复核 149`](../../research/codex-findings/149-ai-supply-reference-architecture-final-closure-v15.md)为`FAIL`、A=3、B=0、C=0，291行、17,977 bytes，SHA-256 `19af12adb7e3077aff7df2739c43b1bfa76463ad91b4669d9eb2096d5aa13011`。
- [`prompt 150`](../../prompts/150-ai-supply-ecosystem-ux-final-closure-v15.md)为28行、3,885 bytes，SHA-256 `117acb4fea95a1de8204c302f846e9648bf5e7ecd9cc99d36ef6c38cea1d71c4`；[`生态体验复核 150`](../../research/codex-findings/150-ai-supply-ecosystem-ux-final-closure-v15.md)为`FAIL`、A=3、B=2、C=0，287行、21,709 bytes，SHA-256 `06c2f49b090c67fcf015d94de77303291cdb39ce31a35c4dc21ab012871cca90`。
- [`prompt 151`](../../prompts/151-ai-supply-reference-grade-final-adversarial-v15.md)为22行、3,366 bytes，SHA-256 `dd659f590f357eb740d10c48b63f15b484a55866eabb8d1a02019dd2a1aeaf23`；[`Codex对抗复核 151`](../../research/codex-findings/151-ai-supply-reference-grade-final-adversarial-v15.md)为`FAIL`、A=12、B=2、C=0，468行、30,804 bytes，SHA-256 `ff09d842bfd1856844363549086ea769630a3a1d7149eebec8433573391f0531`。首次运行日志`logs/151-ai-supply-reference-grade-final-adversarial-v15.jsonl`为414行、2,923,009 bytes，SHA-256 `2e5bb1b116e8a344a67b277cb4d184c932a1dadc9f4a9dcd728c5b57c0d16341`并未产生报告，不作为完成证据；全新会话重试日志`logs/151-ai-supply-reference-grade-final-adversarial-v15-retry1.jsonl`为582行、3,163,820 bytes，SHA-256 `bfb1930f0c7637630b096295b5ed9def56cd762e759c992c2f77d7f027f303cd`，退出码为0且最后一个有效事件为真实`turn.completed`。

三路A/B按共同根因合并如下；“回修”只表示拟议合同、Phase与持续门已同步，不表示生产代码已经实施，也不预先宣称下一冻结快照通过：

| 第十六次问题族 | 根因级回修 | 机械验收落点 |
|---|---|---|
| candidate JCS证明对象与最终committed body可分离，序列化后又不能恢复品牌 | 删除自由materializer；schema生成唯一canonical payload与commit envelope，统一绑定body、subject、id、digest、sequence、token、CAS、epoch与anchor；反序列化复算exact roundtrip后才恢复私有品牌 | §4.2、Phase 0/1/8、`receipt-dag-and-anchor.model`、跨语言interop与字段逐项mutation |
| 测试账号cleanup可在资源、session、credential、billing残留或baseline漂移时自报成功，pending又与retry authority形成摘要环 | 增`provider_test_account_cleanup`独立authority域；success直接refine五类嵌套证据并要求零残留及原baseline；重试固定为已提交`T → A → retryStart`；cleanup只进入`cleanup_verified`，统一逐constituent terminal和release barrier后才生成可租用cursor | §4.2、§12.1、Phase 1/8、`provider-test-account-pool.model` |
| authority registry只用宽域terminal或缺逐constituent producer | 每个constituent由registry codegen准确action、terminal、业务证据、release tuple和私有producer；provider账号lease使用专属cleanup terminal，网络send或compute release不能代替资源清理 | §4.2、Phase 0/1/3/5/8、authority AST census与restart sweep mutation |
| 外层fallback可在首字节、UI publication、usage或tool effect后切换来源 | 增producer-only retry safety subject/receipt并绑定raw response、首字节、publication、usage、tool与effect closure；只有全部为零且权威未发生effect才可advance | §4.2、§7、Phase 3/5/8、`inference-funding-attempt.model`与首字节/effect kill-point corpus |
| 第三方protocol core可能为`never`或伪装bundled，Execution又缺完整TUF、manifest、artifact、consent与runtime authority闭包 | core改为按plane/class私有品牌的可构造精确类型；bundled/declarative限制inner class。Execution沿同一generic subject绑定publisher、TUF lineage、signed manifest、provenance、artifact/open handle、用途专属proposal/disclosure/decision/consumption、sandbox与注册runtime lease | §4.10–§4.13、Phase 0/1/5/8、Connector SDK正例与plugin mutation gate |
| TokenHub、OpenCode Go与Execution资金证据可做笛卡尔换挂 | requirement/variant映射直接派生site、protocol、funding mode、payment/overage与typed entitlement/no-new-spend；special funding release使用命名私有producer和准确evidence tuple | §4.6、§9、Phase 3/5/8、funding穷举与cross-swap mutation |
| remote-backed Execution/bridge被误判N/A，两轮live资格可复用同一证据 | 从真实dependency class而非surface名派生live mode；remote provider、remote upstream、local product、platform control分别使用typed资格；cycle identity、受管账号、run/lease/raw occurrence/cursor集合在两轮间强制不相交并在每轮后释放或quarantine | §4.16.5、§12.1、Phase 5/8、live two-cycle gate |
| exact oracle只有73个key，没有逐operation/auth/stream语义；TokenHub Messages模型目录认证、Gemini/Vertex/Bedrock stream、SigV4、ADC/WIF与Kimi真实User-Agent会丢失 | canonical oracle生成物理operation graph；unary、stream、models、execution各自绑定method/path/query/framing/auth/header/recipient和独立fallback identity。ADC、WIF、AWS SigV4、Azure三类flow分型；TokenHub Messages业务用`x-api-key`而models用Bearer；Kimi两协议都从签名distribution派生真实User-Agent | §4.16.2、§4.16.5、§9、Phase 0/3/8、exact capture compiler与special-oracle mutation gate |
| optional auth条件字段手写联合漏OpenCode username与LM Studio Bearer | 条件binding从每条requirement的recipe、graph、step、field、metric、positive/negative discriminator同源生成；固定8个field occurrence的正负golden与漏项、重复、跨row/step/polarity mutation | §4.16.6、§8、Phase 0/4/5/6/8、`realm-and-ga-binding.tck` |
| Vertex `global`会被拼成错误host，model/location证据与ADC/WIF recipient也可换挂 | `global`固定`aiplatform.googleapis.com`，regional只接受当前签名region/model目录品牌；endpoint resolver在DNS和credential read前绑定project/model/location、unary/stream path、recipient、data boundary与endpoint identity，并固定global、`us-central1`正例和错误host/未知location mutation | §4.16.2、§9、Phase 1/3/8、Vertex endpoint resolution conformance |
| remote witness可跨distribution换挂，一个realm可冒充global、中国大陆与enterprise三套部署 | witness closure按distribution与realm参数化，bootstrap target、manifest、deployment、threshold、operator、endpoint、IaC、data boundary、qualification、service与release同值；平台闭包要求准确三realm有序tuple | §4.16.4–§4.16.5、Phase 1A/5/8、三realm 24h与fault corpus |
| owner扩展可自填compiled oracle/live/availability/state/资格，并靠摘要发布支持 | owner只交canonical namespaced raw input和签名source，固定与owner共用semantic compiler profile；输出row、oracle、journey、live、funding、platform、locale/a11y、entry/ecosystem gate与mutation资格全部typed并由命名私有producer绑定同一distribution | §4.10、§4.16.5–§4.16.6、§9、Phase 0/1/3/6/8、owner fresh-consumer与shadow/cross-swap mutation |
| evaluator独立性proof可跨solution、generation或槽位复用 | proof参数化准确solution id/generation和四槽binding/model/route/raw occurrence tuple；唯一producer同时返回proof与已绑定evaluator槽tuple，solution constructor只消费该commit bundle，不再接受第二份宽proof；review-ready继续从同一solution资格链生成 | §4.2、§7、Phase 0/3/6/8、`capability-slot-funding.tck`与跨solution mutation |
| legacy JSON/SQLite五态只有描述和最终双写commit，崩溃后缺状态专属恢复后继 | 固定五态operation/next-state表；每态都有writer-fenced lease、intent、terminal、retry authority、recovery terminal和single-successor cursor。shadow、reconcile、repair、dual write、permit、cutover、rollback、downgrade、cleanup与quarantine resolution共享同一机器；JSON temp/write/rename/fsync、SQLite prepare/commit/WAL、permit/cutover/cleanup逐点kill并要求公平重试最终到`sqlite_only` | §4.16.1、§10、Phase 1/8、`runtime-child-registry-migration.model` |
| rights blocked主动作仍是字符串，reducer接收任意事件且可能打开错误或空目的地 | `PrimaryActionForStateV7<S>`为所有19态提供唯一typed投影：automatic严格`never`，每个user-required/terminal动作都携带直接可执行target；rights两态强制完整official API journey或带absence proof的安全替代picker。reducer按target state和typed domain event参数化，click handler不做字符串查找 | §8、Phase 6/8、UI reducer schema/handler/ICU/a11y mutation |

第十六次回修还把超大状态断言交叉积改为可执行编译器receipt和固定mutation corpus，在保持73行逐row精确类型的同时避免TypeScript产生二次方实例化；第三方protocol core也采用小型品牌化精确类型，而不是把所有plane、protocol和class预展开成不可维护的巨大联合。合同复杂度、编译时间、内存、source bytes/lines和零`any`继续受`type-contract-compile-budget-v1`的绝对门与签名基线回退门共同约束。

本节仍不是终审通过声明。下一步必须先复核所有手抄身份、运行完整机械门并冻结新的准确SHA/lines/bytes，再以两路全新零上下文subagent和一次target-only Codex重新终审；只有三路均为`PASS`且A=0、B=0，才可在下一节记录最终detached结论。

第十六次回修的冻结前主动审计又拒绝了四类“类型能描述，但受信producer、确切前驱或安全终态仍可缺失”的旁路：legacy迁移现在把operation与任意多轮recovery分别展开为私有品牌的lease、durable intent、判别型terminal、逐authority release和single-successor authority，空inventory仍可迁移；quarantine只能以绑定准确已提交lift/terminal的自然退出证据收口，或保留永久deny tombstone并归档，不能在未证明退出时删除追踪。`unknown/forbidden`权益动作保留品牌化eligibility、已发布official destination及其journey资格，或保留“没有合格官方目的地”的编译器证据和安全替代claim set；两个producer overload不能返回相反动作。其余UI主动作、domain subject、domain event、state registry与reducer都改为私有品牌的单向构造链，action ID同时精确约束source state与destination kind，candidate projection只允许进入对应两种candidate状态，click handler只消费view model内嵌动作。这样实现方不能靠普通结构对象、空目的地、错误状态动作、无证据quarantine或宽`ReceiptRef`满足完成门。

该版本最后一次冻结前合同抽取共33,695行、1,672,591 bytes；TypeScript 5.9.3在`strict`、`exactOptionalPropertyTypes`、`noUncheckedIndexedAccess`、ES2023/NodeNext和零stub下为0 diagnostics，types为325,400，instantiations为736,964，编译器报告总时长3.26秒，进程实测wall为3.65秒、peak RSS为705,609,728 bytes。Compiler API逐一检查19,773个property signature，得到可写property 0、同一literal重复property 0、`any` keyword 0；101个必填`never`全部是computed private brand。上述数值均低于`type-contract-compile-budget-v1`绝对门，但仍只是冻结前自审，不替代绑定最终SHA的detached三路终审。

### 17.15 第十七次终审输入、triage 与第十七次根因回修

第十七次回修的输入是三路审查共同读取的同一v16冻结快照：SHA-256 `8541960c14c8b2cd3e7e87ee217580c6bc989b225c204513bd9d0aefdff126da`、36,595行、2,340,853 bytes。两路subagent均为全新零上下文并完整读取目标；外部Codex使用`gpt-5.6-sol`、`model_reasoning_effort=max`、`-s read-only`、target-only prompt和关闭stdin的headless形态。三路都为`FAIL`；本节保留原始失败事实，当前回修不改变报告当时结论，也不把拟议合同写成生产功能已实施：

- [`prompt 152`](../../prompts/152-ai-supply-reference-architecture-final-closure-v16.md)为34行、5,314 bytes，SHA-256 `9822154a3b548e751e220203f016724ac65075822babf58f5868c90f35d02cba`；[`架构闭包复核 152`](../../research/codex-findings/152-ai-supply-reference-architecture-final-closure-v16.md)为`FAIL`、A=2、B=0、C=0，275行、17,366 bytes，SHA-256 `72dd66861f66cc80201cc4f06a01e08bcf78c5433fd8fc9fd94849de72733ac8`。
- [`prompt 153`](../../prompts/153-ai-supply-ecosystem-ux-final-closure-v16.md)为30行、4,451 bytes，SHA-256 `20a00459243034c0fcf5c3f86bee2452e963dad58c4be525b94e864ef6270636`；[`生态体验复核 153`](../../research/codex-findings/153-ai-supply-ecosystem-ux-final-closure-v16.md)为`FAIL`、A=4、B=1、C=0，270行、25,203 bytes，SHA-256 `a2e66f1a8a1d6919600ec00f58c796bdcb160cda05272132be7e5a3c117e9051`。
- [`prompt 154`](../../prompts/154-ai-supply-reference-grade-final-adversarial-v16.md)为23行、3,856 bytes，SHA-256 `70822f67679a6888a8320e79c7b6f23284d04e69473d622ea81024ddb0ca0294`；[`Codex对抗复核 154`](../../research/codex-findings/154-ai-supply-reference-grade-final-adversarial-v16.md)为`FAIL`、A=4、B=1、C=0，272行、24,723 bytes，SHA-256 `78358e306b4c47acb26973223a7b60560a5b18937f14b8a153d1f38a9239fbfe`。日志`logs/154-ai-supply-reference-grade-final-adversarial-v16.jsonl`为915行、5,554,358 bytes，SHA-256 `4ef0a882021c17f07817cc6a1d92580c446015515152aea0e0ae76ca6e3af441`，退出码为0且最后一个有效事件为真实`turn.completed`。

三路A/B按可共同机械验证的十个根因合并如下。“回修”只表示当前拟议合同、Phase和持续门已同步；必须重新冻结并取得新的三路A=0、B=0报告，才能改变终审状态：

| 第十七次问题族 | 根因级回修 | 机械验收落点 |
|---|---|---|
| plugin runtime及JSON/SQLite migration后置lease不在最终authority闭包 | 最终program AST生成完整census；migration operation/recovery分别进入lifecycle、restart与release；第三方dispatch精确持有process/session、artifact open handle与broker IPC，runtime只消费dispatch authority而不派生registry外新lease | §4.2、Phase 0/1/5/8、late-subtype与逐kill-point authority mutation |
| provider测试账号cleanup terminal、barrier与successor cursor互相引用 | lease、cleanup start、cleanup terminal和release barrier只保存已提交前驱；各successor cursor由独立producer在后一步提交，pending retry authority只消费已提交terminal与cursor，形成无环的单向DAG | §4.2、§12.1、Phase 1/8、`provider-test-account-pool.model` |
| WIF、Azure Managed Identity与OpenRouter PKCE把最终请求认证和凭据取得混在一起 | WIF区分scheme-less STS audience、IdP token audience、validated external-account source和可选impersonation；Azure VM IMDS与App Service identity endpoint独立于tenant OAuth；OpenRouter固定真实authorize、callback/state/verifier及key exchange物理请求 | §4.16.2、§15、Phase 1/3/7/8、golden capture与credential-acquisition mutation |
| rights官方API目的地可跨产品、realm、journey、发行物或时效换挂 | 签名静态source-to-destination policy只映射同provider intent；compiler把准确source eligibility/realm、destination requirement/claim/realm/auth journey、distribution、generation与expiry组成一个品牌化relationship receipt；无合格目的地只能生成排除原principal/credential family的安全替代picker | §8、Phase 0/3/6/8、cross-product/realm/expiry/distribution compile-negative与click E2E |
| 静态UI registry内嵌session、subject、nonce、generation或expiry | registry只保存state/action/label/destination kind/factory descriptor；每次render针对准确domain subject与当前local session动态物化control epoch、route、handler和single-use capability，execute只消费该capability并CAS一次性nonce | §8、Phase 0/6/8、静态序列化零动态字段门及refresh/restart/replay/expiry E2E |
| Hunyuan migration-only仍可能进入fresh账户笛卡尔journey | requirement、recipe、run deriver、live mode、公开claim、picker与终态全部按onboarding availability判别；正向只从既有连接只读元数据和broker handle开始，无既有连接只产生`not_applicable_no_existing_connection`，不出现开户、开通计费、建key或fresh CTA | §4.16.5至§4.16.6、§9、Phase 0/3/6/8、migration-only exact-set gate |
| retry safety丢失exact physical attempt，Execution与tool sent-retry缺统一闭包 | inference、Execution physical、read-only tool与side-effect tool全部把candidate/body、attempt、sequence、funding、raw response、delivery、first byte、publication、usage和effect参数化进exact safety subject、terminal、cursor与advance edge；sent retry必须有provider idempotency、权威未提交或无effect及账务闭包；delivery unknown固定禁止直接automatic retry和fallback | §4.2、§7、Phase 3/5/8、universal retry AST mutation与六个kill point |
| runtime rights缺use case或operation dependent equality | 闭合`UseCaseIdV8`贯穿ingress、PolicySubject、rights、funding、slot、physical attempt、fallback和Execution tool policy binding；Kimi Code、OpenCode Go等限制性权益使用静态restriction floor与exact product/surface policy compiler，cross-product/operation/use-case/surface/realm在secret read和send前拒绝 | §4.2、§4.6至§4.8、Phase 0/3/5/8、rights dependent-binding mutation |
| optional-auth resolver可把none、Basic、Bearer、`x-api-key`或另一run的field receipt换挂 | challenge evidence绑定requirement、graph step、endpoint、process generation与时效；compiler从全局canonical binding union一次抽取封闭的requirement/scheme lookup，并以key/scheme exact-set断言拒绝漏项，避免每次解析重复展开73行；credential subject绑定同一challenge、准确field tuple和broker handle，none分支强制空tuple与零credential，其余分支只接受准确scheme和byte-exact header component | §4.16.6、§8、Phase 0/4/5/6/8、optional-auth全分支compile-negative、lookup mutation与live fixture |
| LM Studio Messages认证被过度收窄为单一header | 依据2026-08-24当前官方资料，Require Authentication关闭时为none，开启时Messages同时接受`x-api-key`和Bearer；oracle按确定性顺序优先`x-api-key`但允许显式Bearer，每个物理请求只能有一种credential header。native REST、OpenAI-compatible与Messages各自保留独立wire与测试 | §4.16.5至§4.16.6、§15、Phase 4/8、none/x-api-key/Bearer三分支capture |

本轮主动审计还把官方迁移receipt的canonical subject直接参数化到准确source eligibility receipt，从而继承并显式投影source realm、hard-stop generation与rights expiry；Execution tool外部请求policy binding改为品牌化的exact rights subject，side-effect已发送但权威未提交的terminal只能由绑定同一request terminal与commit lease的安全producer生成。静态registry禁入表同时覆盖`authoritativeDomainReceipt`、`exactDomainSubject`与`controlEpoch`。这些补强均需进入下一冻结版本的compile-negative与runtime mutation corpus，不能靠文字声明验收。

冻结前编译热点审计发现optional-auth的泛型field extractor会在多个resolver分支重复展开全局73行联合；当前合同改为先从canonical conditional binding union一次抽取封闭的requirement/scheme lookup，再以key与scheme tuple exact-set断言阻止漏项或增项。重新读取全部11个TypeScript块、零stub编译后，TypeScript 5.9.3 strict为0 diagnostics，合同源为36,384行、1,811,142 bytes，types为363,293，instantiations为845,003，wall为3,961.63 ms，观测max RSS为754,581,504 bytes；绝对门全部通过，且instantiations低于以v16证据736,964计算的115%回退门847,508。Compiler API同时得到20,932个property signature中可写项0、`any` keyword 0、非品牌必填`never` 0、重复声明/属性0；73条requirement与73条exact oracle零漏项/额外，63 inference、5 execution、4 bridge、1 control plane分布不变，authority由60个branch-free policy与23个判别分支准确生成83个constituent。

本节仍不是终审通过声明。当前文件已解除v16冻结；下一步先运行完整机械门并记录新的SHA/lines/bytes，再用两路全新零上下文subagent和一次target-only Codex对抗评审审查完全相同的v17字节。冻结后本文件保持只读，终审结论分别落入`research/codex-findings/155-ai-supply-reference-architecture-final-closure-v17.md`、`156-ai-supply-ecosystem-ux-final-closure-v17.md`与`157-ai-supply-reference-grade-final-adversarial-v17.md`，并由`history/PROCESS-JOURNAL.md`记录三份detached证据的digest；这样不会为把报告hash写回被审目标而制造自指或使评审SHA失效。任一路出现A/B时，当前三份报告只作为失败证据，回修后必须以新版本和新编号重新冻结、重审；只有三路A=0、B=0时，这个不再改字节的v17快照才取得终审闭包。

### 17.16 第十八次终审输入、triage 与第十八次根因回修

第十八次回修的输入是三路审查共同读取的同一v17冻结快照：SHA-256 `1fa73d595c2b898637e5e9b573aa01c0e2cbfe7517d45c9e9104bfe4929aec93`、39,300行、2,494,649 bytes。两路subagent均为全新零上下文；外部Codex使用`gpt-5.6-sol`、`model_reasoning_effort=max`、`-s read-only`、target-only prompt和关闭stdin的headless形态。三路都为`FAIL`，因此v17没有取得终审闭包：

- [`prompt 155`](../../prompts/155-ai-supply-reference-architecture-final-closure-v17.md)为35行、5,645 bytes，SHA-256 `ccaba99252c6df7049637b9ce326cc4b8a9358a9c18bfeea19704543f530dd6e`；[`架构闭包复核 155`](../../research/codex-findings/155-ai-supply-reference-architecture-final-closure-v17.md)为`FAIL`、A=4、B=1、C=0，371行、27,313 bytes，SHA-256 `e5eb175ab9329e81a808002eb5ba113b05a56fd3efa3b489c0f57d958a0e52cd`。
- [`prompt 156`](../../prompts/156-ai-supply-ecosystem-ux-final-closure-v17.md)为31行、4,654 bytes，SHA-256 `97138535e1ee9a45adfe6cace87b1ebfd494a016dd4aab26ace4cf95b8ef1e9e`；[`生态体验复核 156`](../../research/codex-findings/156-ai-supply-ecosystem-ux-final-closure-v17.md)为`FAIL`、A=2、B=0、C=0，211行、16,534 bytes，SHA-256 `ad8a8bcb63178c11a402d52c45f7a8c53ffcf5e2c666c883f218b000ae40245f`。
- [`prompt 157`](../../prompts/157-ai-supply-reference-grade-final-adversarial-v17.md)为23行、4,017 bytes，SHA-256 `2cb603e80c2a653095197c98c3a2dafd0775ecc1fe846ff2d54f3511edbb735d`；[`Codex对抗复核 157`](../../research/codex-findings/157-ai-supply-reference-grade-final-adversarial-v17.md)为`FAIL`、A=24、B=4、C=0，332行、36,415 bytes，SHA-256 `8141235e52e65331d92540d156c8d28ea6541bef3d9f277031bf692495826b22`，外部进程退出码为0并以真实`turn.completed`收口。

三路A/B按共同安全性质合并如下。这里的“回修”只表示当前拟议合同已改变，不表示生产代码已实施，也不预先宣告下一冻结版本通过：

| 第十八次问题族 | 根因级回修 | 机械验收落点 |
|---|---|---|
| receipt反序列化仍允许调用方指定body类型，authority source lease又会在60条branch-free policy中退化 | decoder只从私有schema品牌推导body；authority registry增加逐policy exact source lease map、key集合和non-never断言 | §4.2、Phase 0/1/8、receipt roundtrip与authority AST census |
| Rights缺`forbidden/unknown`，restriction floor没有覆盖operation、use case、surface、realm等轴，unknown metering又内嵌Allowed Rights | eligibility和Rights拆成allowed/official-unknown/user-attested-custom/forbidden四分支；完整restriction axis参与同值编译；unknown metering只绑定对应unknown rights | §4.6至§4.8、Phase 0/3/5/8、rights cross-axis mutation |
| TokenHub预留与专属单元混装，Chat流内错误缺typed terminal；BytePlus把region ID直接插入DNS | 预留TPM与专属model unit拆成独立entitlement receipt；TokenHub六行统一HTTP或typed SSE error terminal；BytePlus只消费release-signed region catalog并固定两个官方region到origin映射 | §4.6、§9、Phase 3/8、funding与wire golden capture |
| custom可选认证在Activation与物理发送间丢失，Google WIF/Azure managed identity与官方取得流程不符 | optional-auth endpoint closure贯穿request profile、credential closure、send intent和terminal；WIF分OIDC/SAML/AWS/X.509、global/regional/mTLS STS及可选impersonation；Azure分device、service principal assertion、VM IMDS和App Service identity endpoint | §4.16.2、Phase 1/3/7/8、官方golden capture与错误source mutation |
| 同provider或同协议的exact oracle、证据路径和distribution可换挂 | 独立签名的expected-oracle identity registry逐row绑定provider/product/realm/wire/origin/path/stream/auth/recipient/operation/evidence/distribution；conformance、entry/ecosystem gate、claim与release binding都消费同一comparison receipt | §4.16.5至§4.16.6、Phase 0/3/8、provider/origin/auth/evidence/distribution swap |
| plugin dispatch、provider账号租用和external identity在并发或重启后可重复获权 | 三者分别增加unused→consumed单胜CAS、`lease_in_flight`游标与三分支恢复、retired generation与全新subject生成器；失败sibling零spawn、零IPC、零effect | §4.10、§12.1、Phase 1/5/8、100 sibling与逐kill-point model |
| provider cleanup只有逻辑terminal，没有执行DELETE/revoke/reconcile/reset所需的物理权限 | 五类cleanup操作各持准确network/effect/budget/credential/recipient lease、before-byte intent、typed terminal和unknown reconciliation；全部authority关闭后才可过release barrier | §12.1、Phase 1/8、provider account cleanup operation matrix |
| TUF非root role只读高水位，旧external identity可原subject复活 | timestamp/snapshot/targets/delegated target逐role写入rollback-resistant高水位并与授权原子提交；已退休identity只能以不同subject和准确generation+1重新创建 | §4.4、§4.16.5、Phase 1/8、rollback/restart/reuse mutation |
| Execution副作用terminal与commit lease可跨request换挂 | external request lease、commit lease、sent/not-sent/unknown terminal与ToolInvocation commit transition按tool/session/cursor/request/endpoint/body/funding/generation全量泛型绑定并使用私有producer | §4.9至§4.10、Phase 5/8、全字段cross-swap与effect-once model |
| runtime route可把`delivery_unknown`改写为success/exhausted/not-sent再进入fallback | 私有`fallback-inner-fold-v1`只从final cursor和准确有序physical terminal tuple生成outcome、sent、billing与fallback；unknown永远terminal | §4.16.1、Phase 3/5/8、全终态枚举与字段单点mutation |
| JSON/SQLite五态迁移可跳过cutover前置，kill证据只按全局点计数 | 每个state/operation使用字面量步骤和前置receipt tuple；`advance_sqlite_only`强制上一版真实降级、窗口关闭、兼容到期、零in-flight/quarantine/journal及零冲突；completion覆盖operation×kill-point exact oracle | §4.16.1、Phase 1/8、迁移状态模型与逐对恢复矩阵 |
| `review_ready`可接任意投影，Capability可重放旧render，UI动作与destination仍有空壳 | state到权威receipt、四槽qualification、render instance/revision、single-winner mint CAS及完整typed action/destination全部私有生成并绑定当前session/generation/expiry | §7至§8、Phase 0/6/8、render replay、slot swap与空destination compile-negative |
| accessibility pass可携带false事实，三realm witness可复用同一operator/endpoint/store/IaC | pass snapshot把六项断言固定为literal true且key包含platform/locale/viewport/presentation/zoom/modality/screen reader；三realm增加逐对manifest/operator/trust/endpoint/store/IaC/member/generation/observer separation receipt | §4.16.4至§4.16.6、Phase 1A/6/8、a11y笛卡尔与cross-realm alias mutation |
| release-critical derived receipt可结构性自填，fail-fast manifest可以删掉关键step | plugin implementation/activation、native helper、owner attestation、GA evidence、四件支持产物、set、binding与attestation全部有独立私有品牌和producer；canonical phase/suite/Definition Complete生成签名BOM，执行前精确比对step、argv、predecessor、持续范围和coverage | §4.10、§4.16.5至§4.16.6、§12至§16、producer census与manifest mutation |
| UX上限只能从opaque digest自报，MFA/SCA漏billing/admin，性能相对门可换更快runner | journey graph逐step/branch/task/anchor保存typed数值并由total path fold派生上限；挑战present/absent适用于login、credential creation、billing activation、admin approval；性能环境必须exact相等或经owner批准的双环境保守校准 | §4.16.6、§12.1、Phase 0/6/8、独立重算、四类挑战fixture与环境swap mutation |

本轮还主动把73行聚合claim、run subject和journey release conformance链改为由逐row精确producer生成的小型私有索引。重型`core → payload → attestation → distribution`类型链只在品牌化producer入口展开一次，下游索引保存准确row、core digest、distribution和有序receipt edge；`NoInfer`与运行时canonical digest比较共同拒绝不同core或distribution的并集推断和换挂。紧凑索引仍由deep-frozen commit品牌保护，调用方不能结构性自填。这是消除重复展开全生态交叉积，不是把验证字段擦成普通摘要。

预冻结的expanded alias主动审计还发现了两类此前基础编译不会报错的不可构造分支：restriction floor对泛型`F`再次`Extract`会得到required-`never`，物理attempt的authority、outcome和billing三组独立union则会产生互相矛盾的笛卡尔积；nonzero route又把`zeroAttemptTerminal`写成required-`never`。当前合同改为逐floor分布式决定、按`intentState/sentState`匹配的terminal composer、先按outcome再收窄continuation的retry subject，以及zero/nonzero判别分支。Compiler API随后展开4880个alias constituent，非品牌必填`never`为0；正向断言证明retryable advance、failed-before-send exhausted、pre-intent、zero-attempt和with-attempt终态均非`never`，同时`delivery_unknown`不能取得fallback edge。

当前预冻结合同抽取为39,475行、1,978,244 bytes；TypeScript 5.9.3严格零stub编译为0 diagnostics，types为418,145，instantiations为630,250。三次独立进程的compiler wall为2,936至3,370 ms，进程wall为3.12至3.61秒，peak RSS为675,168,256至695,123,968 bytes。16条owner扩展资格/claim探针为0 diagnostics、630,282 instantiations；相对v16的847,508 instantiation门仍余217,226次。上一冻结v17的source、instantiation、wall和RSS候选本身先通过v16证据门，当前source相对v17为1,092.3 permille，未借已回退基线放宽；真正施工仍必须由锁定runner为准确artifact生成签名baseline与gate receipt，本段自审数字不能代替它。

当前预冻结机械审计仍须在最终字节上重跑完整结构门、16条owner扩展预算探针、文档链接和零emoji门，并冻结新的SHA/lines/bytes。之后必须以新的编号启动两路全新零上下文subagent和一次target-only Codex审查同一只读快照；任一路出现A/B都继续回修和重冻，三路同时A=0、B=0之前本节不是通过声明。

### 17.17 第十九次终审输入、triage 与第十九次根因回修

第十九次回修的输入是三路审查共同读取的同一v18冻结快照：SHA-256 `c9d4c0d3a827f2fc8b4a5a46d6bbf8449e056eec08b68b8170fe5b7f5ce41bd0`、42,437行、2,672,219 bytes；抽取的11个TypeScript合同块为39,475行、1,978,244 bytes，TypeScript 5.9.3 strict为0 diagnostics、418,145 types、630,250 instantiations。两路subagent均为全新零上下文；外部Codex使用`gpt-5.6-sol`、`model_reasoning_effort=max`、`-s read-only`、target-only prompt和关闭stdin的headless形态。三路都为`FAIL`，所以v18没有取得终审闭包：

- [`prompt 158`](../../prompts/158-ai-supply-reference-architecture-final-closure-v18.md)为26行、2,953 bytes，SHA-256 `758cc5e483a5db33c1013bb5be4185e2323bb869a3b6e1dbed1a073c4fd66eb3`；[`架构闭包复核 158`](../../research/codex-findings/158-ai-supply-reference-architecture-final-closure-v18.md)为`FAIL`、A=5、B=0、C=0，221行、19,140 bytes，SHA-256 `4423b4ac471a17c2ac115a565d42226336e7f75d1eb8411a0cab674046591fab`。
- [`prompt 159`](../../prompts/159-ai-supply-ecosystem-ux-final-closure-v18.md)为26行、3,073 bytes，SHA-256 `36a59d7ccb6d00690888d742f8ea24154d1d05c5f423d03ccd1722fa871c513b`；[`生态体验复核 159`](../../research/codex-findings/159-ai-supply-ecosystem-ux-final-closure-v18.md)为`FAIL`、A=2、B=1、C=0，172行、17,330 bytes，SHA-256 `5cd3b3fe37ba899e11952cf7444d39e156ff51f7805a49bf3cb574645fdc44b6`。
- [`prompt 160`](../../prompts/160-ai-supply-reference-grade-final-adversarial-v18.md)为13行、2,027 bytes，SHA-256 `9b420b4e27408fa471e069d85804ccdf906681f9dcd57062d88e79b7665ef1f2`；[`Codex对抗复核 160`](../../research/codex-findings/160-ai-supply-reference-grade-final-adversarial-v18.md)为`FAIL`、A=20、B=4、C=1，387行、33,484 bytes，SHA-256 `646abded0b93394ab7fe51d85f0c5895ccfb060e421c01e61ef2fa6b2ae6c398`。主事件日志为5,608,867 bytes、SHA-256 `f4449e5ef376b244a1d507e200dfe138f4e8451ec97242ec7bf346b961037237`；报告恢复日志为34,967 bytes、SHA-256 `c42a838abb29e2e2e46ab4e9c2bb2e4a73a2343d9cfdddaf264919b454422f9a`。

各报告的finding有重叠，不能把A/B数量相加当作唯一问题数。本轮按可共同关闭的安全性质归并，并落实到v19受信合同：

| v18问题族 | v19根因级回修 | 机械验收落点 |
|---|---|---|
| public/deep-frozen/JCS声明与ambient producer现实冲突，裸receipt边无法生成可信manifest | 只公开55个resolved symbol；统一canonical producer ID与deep-frozen commit；从53个根kind的resolved property/target symbol生成完整edge manifest，legacy导出为0 | §4.2、§4.16.7、Phase 0/8，public export/compiler/manifest AST census与host-object mutation |
| authority source模板漏versioned名字与provider cleanup；process/secret新路径可能游离registry | source从真实declaration symbol生成；provider五类cleanup和Codex command auth lease进入76 source、89 constituent完整lifecycle | §4.2、§4.16.7、Phase 0/1/5/8，missing/extra/duplicate/branch mutation |
| TUF final role可为root/timestamp/snapshot，中间delegated role无逐项高水位，本次可信时间可复用旧值 | target role封闭为targets/delegated；ordered role tuple逐项原子推进version/hash/expiry；target verifier消费本次固定update-start可信时间 | §4.4、Phase 0/3/8，多级delegation rollback、stale time与anchor swap |
| phase BOM tuple不可构造、suite可漏、失败也能形成terminal且release不消费 | 32个exact suite递归生成34-row签名BOM；passed/failed/not-run私有producer与成功/失败orchestrator分离，只有成功终态进入v19 release | §4.16.7、§12、Phase 0/8，删项/重排/前项失败末项成功/旧V9晋升mutation |
| journey binding同字段交叉两种receipt、run subject可由联合推断换挂、migration-only被conversation-ready gate阻断 | detailed/index receipt分离；requirement为唯一推断锚且其他输入`NoInfer`；fresh、migration positive与migration absence为三个准确集合 | §4.16.5至§4.16.7、Phase 0/3/6/8，跨row/联合D与Hunyuan正反例 |
| 只有两种真实locale，expected a11y matrix可被调用者缩小 | 增加真实RTL locale `ar-SA`并保留独立`en-XA`；canonical生成972-cell exact key map与同distribution actual closure | §4.16.6至§4.16.7、§8、Phase 0/6/8，笛卡尔missing/extra/cross-locale/distribution mutation |
| retry terminal未锁同一物理subject，fallback主状态机无完整producer DAG | 四domain共用品牌化subject与before/after-send判别terminal；fallback按subject/cursor/start/physical terminal/advance/final单向推进 | §4.2、§4.16.7、Phase 3/5/8，六kill point、physical+zero冲突与delivery-unknown无edge断言 |
| support claim与runtime rights首发自引用，credential前无法表达rights，ComputePolicy四组件可跨主体 | pre-credential eligibility/rights为权威view evidence；claim严格下游；Rights/Network/Billing/DataBoundary从一个ComputePolicy subject分别生成并准确合并 | §4.6至§4.8、§4.16.7、Phase 0/3/6/8，空claim bootstrap与cross-subject mutation |
| inference plugin缺consent链，Execution条件类型可省略第三方authority，runtime assertion模式证明可选 | inference plugin贯穿subject/proposal/disclosure/decision/consumption/policy/activation/runtime；Execution使用分布式条件；runtime assertion为mode判别必填 | §4.9至§4.10、Phase 0/1/5/8，第三方/内置全分支compile-negative |
| owner approve为required-never且可联合矛盾；namespace、raw source、qualification producer悬空；无法表达migration-only | approve/reject严格判别；canonical namespace、非空签名raw tuple、共享compiler与四类子qualification均有私有producer；migration-only原始判别受限且有双gate | §4.10、§4.16.7、Phase 0/3/8，empty/collision/union/cross-component/fresh-consumer mutation |
| outer release与四件套可用联合D换挂，多个trust root可结构性自填 | 非联合distribution identity作为唯一推断锚；其余`NoInfer`；trust roots、type baseline、a11y expected、support set均品牌化并由canonical bytes/TUF/private producer生成 | §4.16.5至§4.16.7、Phase 0/6/8，union-D、baseline放宽与matrix缩小反例 |
| UX state无入口、三平台anchor enrollment无producer、observer同realm可共享故障域 | state registry生成逐state exhaustive producer；platform enrollment与observer identity/pairwise independence均有私有producer | §4.16.4至§4.16.7、Phase 0/1A/6/8，state key双射、cross-platform与pairwise alias mutation |
| MFA/SCA图级最坏路径超过签名上限，合同source预算几乎无扩展余量 | 从完整graph event fold重算四类挑战最坏路径；手写与generated source分预算，以紧凑DSL/codegen消除重复展开并保留增长余量 | §4.16.6至§4.16.7、§12.1、Phase 0/6/8，N+1 path与absolute/relative compiler budget |
| Codex custom provider的command-backed auth没有低配置安全导入闭包 | 静态解析零执行；definition/candidate/distribution/decision/process lease/pre-intent或send intent/typed terminal/broker credential/refresh cursor完整闭合 | §4.16.7、§6.2、Phase 5/8，shell/env/output/timeout/concurrency/cross-subject与secret leakage mutation |

本轮预冻结合同已经重新以TypeScript 5.9.3 strict零stub编译，并用主动反例验证union distribution、cross-distribution artifact/release、before/after-send非法terminal、fallback physical与zero并存、cross-subject ComputePolicy、空owner raw source、cross-requirement run、Codex refresh判别及失败orchestrator晋升均不能通过。该结果仍只是当前工作树的回修证据，不是终审通过声明；必须在最终字节上重跑完整结构、性能、链接、emoji和diff门，冻结v19准确SHA/lines/bytes，再以新编号启动两路全新零上下文subagent和一次target-only Codex对抗评审。任一路A/B非零都继续回修、重冻、重审，三路同时A=0、B=0之前不能声称本方案取得终审闭包。

冻结前的最后一次机械读回又发现并消除了一个public boundary宽化：`compileOwnerAdditionalRequirementSetV7`原先在普通对象中包裹committed compilation，现改为顶层直接返回精确owner tuple参数化的`DeepFrozenCommittedReceiptV1`。最终11个TypeScript合同块为41,547行、2,082,083 bytes；TypeScript 5.9.3 strict为0 diagnostics、427,189 types、639,671 instantiations。Compiler API逐symbol确认55个public ID准确解析为54个顶层返回deep-frozen committed receipt的callable和1个覆盖19状态的穷举registry；53个public receipt graph root全部唯一。AST census得到23,286个property signature、可写项0、`any` keyword 0、非品牌必填`never` 0、重复property 0；76个authority source减去8个纯alias后，61个branch-free policy与28个判别branch准确展开为89个lifecycle constituent，零漏项或额外项；73条requirement input与73条exact connection oracle一一对应；32个suite递归形成34行BOM；3个真实locale加1个pseudo locale在3平台、3 presentation、3 viewport、3 zoom和3 modality上准确展开972个a11y cell。14条当前快照的`@ts-expect-error`反例在0 diagnostics下证明非法distribution换挂、send-state倒置、fallback双终态、cross-subject policy、owner raw source缺失、Codex refresh/lease错配、空a11y matrix、失败orchestrator晋升和BOM错误前驱均被类型系统拒绝。

相同source、argv、lock与runner的5个全新独立编译进程观测wall依次为3.58、3.74、4.22、3.68、3.79秒，median为3.74秒；peak RSS最大714,964,992 bytes；`(max-min)/median`为171.123 permille。五次types与instantiations完全一致，绝对60秒、2.5 GiB、900,000 instantiations、4 MiB和80,000行门以及30% source headroom均通过。签名相对回退门仍必须由实施期锁定runner生成的准确baseline receipt判断，本轮不以这些预冻结样本冒充相对门通过。以上机械结果在冻结后还须随最终文档字节重跑文档结构、链接与零emoji门，并且不能替代三路独立终审。

### 17.18 第二十次回修输入、v19 结论纠正与 v20 根因闭包

第二十次回修读取的是三路审查共同核验的同一v19冻结快照：SHA-256 `f965ee3e63fdd0c0242d8fe58cc4574dbfcc04962322851e434d6195378d5ea7`、44,555行、2,797,930 bytes，仓库HEAD `174ab48895aa1e4a6c6b42b9c74187f20efc3cfd`。11个TypeScript合同块为41,547行、2,082,083 bytes，三路均独立复现strict 0 diagnostics；三路都为`FAIL`，所以v19没有取得终审闭包：

- [`prompt 161`](../../prompts/161-ai-supply-reference-architecture-final-closure-v19.md)为28行、4,113 bytes，SHA-256 `4ecf853fbd26cc00c7c636e4f1d8030ce55daa8556f26c127d0df57f9c7ea691`；[`架构终审 161`](../../research/codex-findings/161-ai-supply-reference-architecture-final-closure-v19.md)为`FAIL`、A=8、B=0、C=1，390行、26,875 bytes，SHA-256 `25c94a80fee25d2e85f40e5ebf35b2cc631ae2ca2b7f9b5ed19b48affdc3b8ef`。
- [`prompt 162`](../../prompts/162-ai-supply-ecosystem-ux-final-closure-v19.md)为28行、4,363 bytes，SHA-256 `73d0802d3a128db53c944389b29df4187402f16ca719197c9a5fbe3db1ab0220`；[`生态体验终审 162`](../../research/codex-findings/162-ai-supply-ecosystem-ux-final-closure-v19.md)为`FAIL`、A=1、B=0、C=0，113行、13,829 bytes，SHA-256 `969d64a013e3ca1c4b4e33a58c24d9f0de3b2cd1ef430045c677c6e13a5ca7ca`。
- [`prompt 163`](../../prompts/163-ai-supply-reference-grade-final-adversarial-v19.md)为13行、2,714 bytes，SHA-256 `0e94f8c9809268fb73fb98b32edccc5135f458cf0526186fc2c2d895dd7ec169`；[`Codex对抗终审 163`](../../research/codex-findings/163-ai-supply-reference-grade-final-adversarial-v19.md)为`FAIL`、A=19、B=7、C=0，515行、25,415 bytes，SHA-256 `d7bd04e9f332c95a9f1d5a1d58eba50d1d3d542792944299227dca92f1fbf0ed`。事件日志`163-ai-supply-reference-grade-final-adversarial-v19.jsonl`为671行、1,934,234 bytes，SHA-256 `a2c0c29f31941b1f6cddd390870fcaab9a4b5f0ccbebed1d6d36244d1e364ac8`，含真实`turn.completed`。

三路finding存在重叠，不能把数量相加当作独立问题数。v20不再继续加v19局部补丁，而把可组合性、安全边界与编译成本作为同一个根因处理：

| v19问题族 | v20根因级回修 | 实施期机械验收 |
|---|---|---|
| canonical projection保留symbol、nested receipt没有wire/hydrated分型，union decoder形成kind/subject/body笛卡尔积 | nested receipt唯一wire形态为六字段`ReceiptPointerV20`；decoder一次分布式推导完整分支，显式resolver验证后才hydrate | canonical roundtrip、union decoder与cross-body负向模块 |
| public graph存在bare ref、authority release只保留摘要、cleanup缺lifecycle domain | v20公开面缩成5个facade producer和5个root；edge manifest只接受准确pointer；物理terminal保存准确lease与完整authority release tuple，cleanup纳入唯一domain partition | public export、transitive no-bare-pointer、authority exact partition与五类cleanup矩阵 |
| TUF consumer擦除repository/role/path/digest，Rights/Network/Billing/DataBoundary缺可遍历授权链 | distribution与四个policy component都参数化准确root-to-target lineage、canonical bytes、可信时间、高水位、role/path/digest和同一非联合主体 | repository/role/path/digest/time与四组件cross-swap负向模块 |
| IR只有occurrence metadata，adapter和decoder没有真实内容及request/attempt相关性 | typed value携带text、tool JSON或host-owned content handle；IR与event由宿主唯一producer签发，decoder只能提案，host把raw frame、request、attempt、sequence和值逐项绑定 | `inference-ir-content-event-correlation`及value/digest、cross-request/attempt负向模块 |
| 开放extension literal被mapped union吃掉，conformance与distribution可分叉 | protocol subject保留单一literal；implementation、core、payload、attestation、binding与实际加载artifact使用同一distribution锚和runtime canonical equality | extension literal正例、cross-plane与cross-distribution反例 |
| before-send terminal消失、fallback advance擦除前驱、delivery unknown可被错误续跑 | physical subject按send state分布，terminal消费完整authority closure；advance receipt保存cursor/start/terminal/successor与CAS，unknown永远terminal | before/after-send、multi-attempt history和unknown-no-advance模块 |
| ComputePolicy与rights action可用union或不同主体组件拼接 | 非联合invariant subject是唯一推断锚；四组件与UI action都保存同一subject/distribution并做canonical byte equality | cross-subject compute policy与rights action反例 |
| schema-invalid或unreadable旧child无法进入quarantine | raw read envelope在解析前表示read/decode结果；逐输入mapped lift result让invalid与unreadable只能产生准确原因的quarantine，并把index纳入subject | invalid/unreadable正例与cross-index反例 |
| owner migration-only被编译成fresh，新增qualification未进入claim | owner compiler直接消费onboarding availability；migration必须同时有positive与absence，fresh与migration producer互斥，owner claim只消费v20 onboarding qualification | owner fresh、migration positive/absence正例与migration-as-fresh反例 |
| 两份suite清单漂移、BOM用shell字符串、terminal与distribution无关、官方BOM输出深递归不可组合 | 唯一37-suite tuple生成39行`shell:false` argv数组；BOM、step、orchestrator与distribution同主体；下游使用紧凑pointer而不是重复深展开 | producer输出直接串接、错误前驱和cross-distribution terminal反例 |
| baseline可无批准重建，a11y matrix/closure不可构造且对象展开可洗brand | baseline只有受信genesis或前任passing gate+owner批准+单胜CAS两入口；a11y逐cell签发，受信resolver形成972-pointer set，release消费set pointer | baseline bootstrap/replacement与unapproved反例；单cell、exact set、brand-spread反例 |
| remote witness发布时效只留布尔值 | release-time comparison保存qualification、time authority和monotonic anchor的准确pointer；operational release从同一comparison派生时间/anchor并做canonical equality | release-time正例与cross-deployment comparison反例 |
| Codex将`refresh_interval_ms=0`误建模为expiry且刷新生命周期未闭合 | candidate先绑定准确definition；0为authentication retry，正整数为fixed interval；single-winner cursor、完整process authority、typed terminal、旧secret retirement与新generation transition闭合 | auth-retry/fixed-interval正例与cross-mode/cross-lease retirement反例 |
| 依赖默认Node heap的聚合自检在相同类型图下可超过2.5 GiB RSS，事后预算无法约束进程 | compile budget锁定Node 22与唯一、前置的`--max-old-space-size=2048`；完整合同与单fixture分别测量，遗漏/改宽heap、只测fixture或伪拆共同加载合同都失败 | 完整artifact五冷进程、42个隔离fixture、argv AST与process RSS/wall门 |
| Azure公开表越过claim、缺`ar-SA`交付，腾讯个人Token Plan被普通TokenHub路径误接 | Azure Chat/Responses分别有准确row；`ar-SA`进入目录、typed locale与972-cell矩阵；腾讯个人套餐独立key/endpoint且SayDo未入allowlist时hard block，企业版广州/新加坡Chat/Messages四row与两edition逐项闭合 | 81-row双射、三真实locale+pseudo、个人版禁止与企业版region/protocol/edition反例 |
| v19自述“当前有14条compile-negative”，实际文档没有这些夹具 | 删除把自审叙述当测试的做法；v20列出17个positive和25个negative实施期独立模块，qualification逐文件核验真实diagnostic与digest | 42个真实文件、逐文件冷编译、unused directive和禁止stub/as-any门 |

这里明确纠正§17.17的历史自述：v19冻结文档并没有14个真实checked-in compile-negative；终审163的B-07已用机械扫描证伪。当前会话中的临时probe只用于设计期验证，不是实施产物，也不能计入未来release receipt。只有Phase 0按固定17/25清单提交真实模块、逐文件运行锁定compiler并由`AiSupplyContractFixtureQualificationReceiptV20`绑定准确artifact后，才能声称这些夹具存在并通过。

v20当前仍是预冻结候选，不因本节列出回修就自动通过。冻结前必须在最终字节上重跑strict/AST/结构/链接/emoji，以Node 22和准确`--max-old-space-size=2048`前缀完成完整合同五冷进程；实施期再对42个真实fixture逐模块重复同一门禁。随后两路全新零上下文subagent和一次target-only Codex必须同时A=0、B=0。任一路非零就重开下一节、修复、重冻和重审，不允许以版本号多或审查轮次长为理由降低门槛。

### 17.19 v20 冻结前机械证据与收敛边界

最后一次资源复核先用Node 22.23.1默认heap运行相同聚合合同自检。五个隔离进程的wall为20.75、20.95、25.33、25.69、22.71秒，最大RSS为2,984,738,816 bytes；它既超过2.5 GiB绝对门，wall离散度也超过200 permille。该失败没有通过提高门限处理，而是回到§4.16.3把Node 22和唯一、前置的`--max-old-space-size=2048`写入受信compile profile、invocation identity、metrics subject、Phase 0验收和owner变更门。受控heap并不把fixture切碎或擦除类型：完整16块仍在一个TypeScript program中共同加载。

最终合同抽取为16个TypeScript块、45,728行、2,282,249 bytes，SHA-256为`234c5ff9a0c68d691eb7547a611e2604d45930ccbaa54a4d8a93874fb810be4e`。TypeScript 5.9.3在ES2023/NodeNext、`strict`、`exactOptionalPropertyTypes`、`noUncheckedIndexedAccess`、零stub下五次都是0 diagnostics、489,891 types和809,365 instantiations；wall为24.47、21.11、21.99、21.09、20.69秒，中位数21.11秒，`(max-min)/median`为179.063 permille，最大RSS为2,081,472,512 bytes。完整抽取源相对4 MiB/80,000行绝对门还分别保留455.869和428.400 permille容量；手写/生成物分账与相对签名baseline仍必须由Phase 0真实artifact和受信runner产生，本段不冒充该实施期证据。

13个定向组合probe也分别以相同heap前缀运行，全部为0 diagnostics；instantiations范围810,271至869,017，最大RSS为2,086,092,800 bytes，覆盖IR/legacy、baseline、a11y、owner、Codex command auth、remote witness、BOM、support、ecosystem与完整release组合。它们仍只是设计期反例探针，不能计入§4.16.7固定的17个positive和25个negative实施fixture。文档结构自检得到62个平衡fence、零尾随空白、零错列表格行；目标emoji门为`[ok]`，活跃文档链接门为97份文件、零broken。

从本节起冻结范围：不再为“覆盖更多名字”或一般C级建议继续增加v21。只有冻结后三路终审发现能在完全照方案实施后复现的A/B级正确性、安全、可实施性、官方事实或首用体验缺口，才解除冻结并进入下一版本；命名偏好、重复解释和未改变合同的增强项进入实施backlog。即使终审通过，也只表示设计具备实施资格，不改变`HANDOFF.md`活动批次指针、`IMPLEMENTATION-PLAN-2.md`唯一排产源和owner前置决策所形成的开工阻断。
