# AI 供给专题 · owner 决策单(十项)

- 日期:2026-08-24
- 来源:`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md` §14,第 47,902–47,935 行
- 整理者:Claude(未参与 v1–v20 施工)

## 为什么单独抽出这份

这十项是**当前项目真正的关键路径**,但它们躺在一份 48,809 行 / 3 MB 文档的尾部,已随该文档
经历 20 轮评审而一项未签。与此同时,已完成的 20 轮工作(v1–v20 三路终审共 60 份报告)全部
用于审查同一文档 §4 的 4.3 万行 TypeScript——而 §4 之所以有 4.3 万行,部分正是因为它必须
同时容纳这十项决策的多种未定形态。

诊断详见 `docs/review/2026-08-24-ai-supply-v20-loop-diagnosis.md`。

## 怎么用这份文档

每项包含三块:

- **决策问题** 与 **与合同的耦合**:整理者补充,便于判断轻重,不属原文。
- **方案默认推荐(原文)**:一字不差引自 §14,未做任何改写或压缩。
- **签署**:直接在本文件勾选或改写。

原文开头的约束同样适用:

> 需要 owner 拍板的十项,本文给出默认推荐;**未拍板项不由施工方推断**。

---

## 决策 1 · 排产坐标

**决策问题**:本专题在 PLAN-2 中占哪个批次坐标?在此之前能否开工?

**方案默认推荐(原文,未改动)**:

> 排产坐标：先对账 HANDOFF/PLAN-2 并关闭旧 pointer，再把本专题拆成具名子批；未完成前禁止 Phase 0。

**与合同的耦合**(整理者补充):这是 §0 开工纪律第 3 条的同一件事。当前 `HANDOFF.md` active pointer 仍是 `w54b-wiring`(C3 未做、本批未收口),PLAN-2 未给本专题具名坐标。**此项不签,其余九项签了也开不了工。**

**签署**:

- [x] 采纳上述默认推荐　　←　**owner 已签 2026-08-25**
- 具体裁决:**先收口 `w54b-wiring` C3,再排本专题**。C3 范围见
  `IMPL-PROMPT-15-W54B-WIRING.md` §3(设置页 Tier1 卡 / 任务详情 adapter+observedModel /
  语音 S2 文件工具文案 / blocked 原因人话 / prompt 执行约定按 backend / 10/11 回写草案),
  锚为 console 单测 + Playwright 定向 ≥2,门禁 `just ci` 双矩阵绿 + C 阶段末零上下文 code-review。
  C3 收口并关闭 active pointer 后,才由 owner 在 PLAN-2 给本专题具名坐标。
- 签署人 / 日期:owner / 2026-08-25

---

## 决策 2 · Codex App Server/ACP 归属

**决策问题**:Codex App Server / ACP 是独立的 Execution Agent 平面,还是并入现有 Tier 1 / Hopper?

**方案默认推荐(原文,未改动)**:

> Codex App Server/ACP 归属：推荐作为独立 Execution Agent plane，经控制桥接入；若并入 Tier 1/Hopper，必须同步 D8 与全部状态/proof 合同。

**与合同的耦合**(整理者补充):§4 内 `execution` 相关命中 **2,154 行**,是十项中耦合最深的一项。§4 目前必须同时容纳两种形态,这是该节体量的主要来源之一。并入 Tier 1/Hopper 还会连带要求同步 D8 与全部状态/proof 合同。

**影响面分析**(Claude,2026-08-24):已基于**真实生产代码**(不引用合同草案)出具
[`../review/2026-08-24-decision-2-impact-analysis.md`](../review/2026-08-24-decision-2-impact-analysis.md)。
三条关键发现:

1. **D8 已有立场**,与本项默认推荐存在张力。`docs/07-tech-stack-decisions.md:131` 把 Codex 定位为
   「经 Hopper 现状 `codex exec` adapter(Tier 2)」,app-server 排在 **P1/P2**「待 Hopper M3b 或缝合层直连」;
   同节 133 行对 ACP 的立场是「持续跟进**不押注**」。默认推荐把 App Server 与 ACP 并列建独立平面,
   等于提前押注 ACP。
2. **`codex` 槽位已预留**。`packages/contracts/src/types/task.ts:12` 的 `adapterSchema` 已含 `codex`,
   只是 `backends/types.ts:5` 的 `AdapterKind` 未实现它。
3. **真正的分歧点不是「独立 vs 并入」,而是「`codex exec` 还是 `codex app-server`」**。
   现有 `Tier1Backend` 接口(`backends/types.ts:48-65`)的每个成员都假设
   「构造一次命令行 → 单向读 stdout → 进程结束」,**没有任何向 agent 发送消息的方法**;
   `codex exec` 完全吻合(成本≈再写一个后端,参照 cursor.ts 71 行 / claude.ts 263 行),
   而 app-server 的双向 JSON-RPC + 审批回调在此接口中没有落点。

**两者差异已于 2026-08-24 本机实证**(codex-cli 0.147.0):`codex exec` 实跑全部输出仅四个单向事件
(`thread.started`→`turn.started`→`item.completed`→`turn.completed`)后进程退出,无输入通道;
`codex app-server` 是完整双向 JSON-RPC,**95 个客户端方法 + 10 个服务器反向请求(含 7 个审批/征询)**。
两个补充发现:(a) Tier 1 现有的 hook 拦截机制正是在**模拟 app-server 原生就有的审批回调**,
故"并入 Tier 1"在架构上别扭;(b) `app-server` 仍标注 `[experimental]` 且协议 v1/v2 并存,
押注意味着跟随其变更——这支持 D8 把它排在 P1/P2 的现有判断。

**2026-08-25 生态实证改变了本项的形状**
(`../review/2026-08-25-agent-cli-acp-capability-survey.md`):
本机 11 个 agent CLI 中 **6 个实测可作为 ACP server 启动并正确应答 `initialize`**
(goose 1.37.0、opencode 1.18.21、kimi 0.38.0、gemini 0.55.1、copilot 1.0.61、qwen 0.18.0),
返回结构同构的 `protocolVersion:1` + `agentCapabilities` + `authMethods`;grok 的原生输出格式即
ACP session updates。**Codex 是唯一走专有 app-server 协议的**,
而 SayDo 现有两个 Tier 1 后端(`claude_code`、`cursor`)恰是唯二完全不沾 ACP 的。

D8 第 133 行原文「ACP 持续跟进不押注……**若成事实标准则适配层整体切 ACP**」——
**该条自带的触发条件已经满足。**

因此存在第三条路线,且它与「为 Codex app-server 建独立平面」需要的新抽象**是同一种东西**
(能应答服务器反向审批请求的双向 JSON-RPC 客户端),但覆盖面差一个数量级:

| 路线 | 覆盖 agent 数 | 协议稳定性 |
|---|---|---|
| A. `codex exec` 作第三个 Tier 1 后端 | 1 | 正式子命令 |
| B. `codex app-server` 独立平面 | 1(专有协议) | `[experimental]`,v1/v2 并存 |
| **C. ACP 适配层** | **实测 6** | `protocolVersion:1`,gemini 已从 `--experimental-acp` 转正 |

**建议改拆成三问再签**:

1. **本轮是否引入 ACP 适配层?** 一次接入覆盖实测 6 个 agent,并可让主方案 §9.4 中
   kimi/opencode 等长尾条目共用同一适配器与 TCK。
2. **Codex 走哪条?** 建议短期沿用 `codex exec`(D8 现状,成本最低),
   中期观察其 app-server 何时脱离 `[experimental]`;不建议为单一专有协议单独建平面。
3. **`claude_code` 与 `cursor` 保持现状。** 二者无 ACP,现有 hook 机制是对它们的正确适配,
   不应为统一而废弃。

若 Codex 沿用 `codex exec`,则 §4 中为「独立执行面」准备的 execution 合同本轮大部分用不上,
可整段推迟下沉。

**签署**:

- [ ] 采纳上述默认推荐
- [x] **改为**:**引入 ACP 适配层;Codex 沿用 `codex exec`,不为其单独建平面**　←　**owner 已签 2026-08-25**
  - 依据 2026-08-25 实测(`../review/2026-08-25-agent-cli-acp-capability-survey.md`):
    goose/opencode/kimi/gemini/copilot/qwen 六家均可作为 ACP server 应答同构 `initialize`;
    D8:133「若成事实标准则适配层整体切 ACP」的触发条件已满足。
  - 一个共享 ACP driver + 一套 execution TCK 覆盖上述六家及 §9.4 同类长尾条目。
  - Codex 走 `codex exec`(完全契合现有 `Tier1Backend`;`codex` 槽位已在 `adapterSchema` 预留);
    `codex app-server` 等其脱离 `[experimental]` 后再评,本轮**不**为其建独立平面。
  - `claude_code` 与 `cursor` 保持现状,沿用 hook 拦截形态,不为统一而废弃。
  - **连带**:§10 Phase 5 应按协议(`acp` / `app_server` / `cli_stdio`)重组,取代现有九个品牌子批。
- 签署人 / 日期:owner / 2026-08-25

---

## 决策 3 · evaluator 同 family 降级

**决策问题**:同 family 模型互评(如用 GPT 评 GPT)是否允许达到 `review_ready`?

**方案默认推荐(原文,未改动)**:

> evaluator 同 family 降级：推荐保留“可聊天但缺独立复核”的显式降级，不允许其达到 `review_ready`。

**与合同的耦合**(整理者补充):影响 evaluator 槽的准入判定与降级文案。相对独立,耦合面小,但决定 §8 交互合同里的一组状态文案。

**推荐理由**(Claude 预填草案,2026-08-24):同一 model family 的两个实例共享权重与训练分布,
判断误差高度相关——用 GPT 评 GPT 得到的不是独立复核,而是同一个模型的自我确认。
若允许其达到 `review_ready`,用户会以为拿到了独立验证,实际没有;这是把"缺能力"显示成"有能力",
比明确降级危险得多。默认推荐的降级路径(`review_ready` → `conversation_ready`)保留了可用性,
只是不对用户撒谎。找不到值得反驳的理由。

**签署**:

- [x] 采纳上述默认推荐　　←　**Claude 预填草案,待 owner 确认**
- [ ] 改为(填写):
- 签署人 / 日期:

---

## 决策 4 · 分发版 Claude 订阅接入

**决策问题**:分发版(非 API)的 Claude 订阅是否可被 SayDo 自动使用?

**方案默认推荐(原文,未改动)**:

> 分发版 Claude 订阅接入：推荐默认禁止，只给 API；获 Anthropic 批准或官方明确 surface 后再开。

**与合同的耦合**(整理者补充):§4 内 `subscription`/`rights` 命中 **443 行**。这一项还有 §0 之外的外部约束:参见记忆条目「Claude 订阅程序化使用政策(2026-08 核实)」——官方条款是硬边界,不是产品偏好。

**推荐理由**(Claude 预填草案,2026-08-24):**这不是产品偏好,是条款约束**。
Anthropic 官方原文(`code.claude.com/docs/en/legal-and-compliance`,2026-08-19 核实):

> Anthropic does not permit third-party developers to offer Claude.ai login or to route requests
> through Free, Pro, or Max plan credentials on behalf of their users.

同页并声明保留执法权且可不经预先通知("may do so without prior notice")。
分发版 SayDo 若自动使用终端用户的 Claude 订阅登录态,正落在该禁令内,后果由**用户账号**承担。
默认推荐(默认禁止、只给 API)是唯一合规选项。

**两点必须区分清楚**:

1. 本决策约束的是"分发版产品自动使用终端用户的订阅"。owner 本机 `claude_cli` 的现有用法
   (spawn 官方 CLI 子进程、单用户自机、真实 HOME 登录态)属于官方文档认可的
   "run the CLI as a subprocess with the `-p` flag",**不在本决策禁止范围内**,W5.4 既有设计不受影响。
2. **签署前建议重新核一次官方页面**——该政策 2026 年内已变更多次,上述原文核实于 2026-08-19。

**签署**:

- [x] 采纳上述默认推荐　　←　**Claude 预填草案,待 owner 确认**
- [ ] 改为(填写):
- 签署人 / 日期:

---

## 决策 5 · LAN 自动发现

**决策问题**:自动发现是否探测 LAN,还是只探 loopback?

**方案默认推荐(原文,未改动)**:

> LAN 自动发现：推荐默认关闭，只探 loopback；用户主动开启一次且可撤销。

**与合同的耦合**(整理者补充):§4 内 `LAN`/`loopback`/`discovery` 命中 **304 行**。默认关闭 vs 默认开启会改变 §6 自动发现设计的整个信任模型(局域网内的未知服务能否被当作供给候选)。

**推荐理由**(Claude 预填草案,2026-08-24):LAN 扫描是主动向局域网内未知主机发包,
会暴露 SayDo 的存在、可能触发企业网络告警,且局域网内的服务不受本机信任边界保护。
反向设想足以定论:若默认开启,用户在咖啡厅或公司网络首次启动 SayDo 就会扫描他人设备——这无法辩护。
默认关闭是标准的 fail-safe 默认值,且方案已给出显式开启入口(一次授权、可撤销),不损失能力。

**签署**:

- [x] 采纳上述默认推荐　　←　**Claude 预填草案,待 owner 确认**
- [ ] 改为(填写):
- 签署人 / 日期:

---

## 决策 6 · secret/付费边界

**决策问题**:无可证明的 secret broker 隔离时,是否允许远程 agent + API 组合?付费 fallback 默认开还是关?

**方案默认推荐(原文,未改动)**:

> secret/付费边界：推荐无可证明 secret broker 隔离则禁用远程 agent+API 组合；付费 fallback 默认关闭，用户可分别建立单次授权或有硬上限的持久预算。

**与合同的耦合**(整理者补充):§4 内 `Spend`/`funding`/`overage` 命中 **519 行**。这是唯一直接涉及"用户真金白银"的一项,错误的默认值会造成静默扣费。方案默认推荐是**双双关闭**。

**签署**:

- [x] 采纳上述默认推荐　　←　**owner 已签 2026-08-25**
- 即:无可证明 secret broker 隔离则禁用远程 agent+API 组合;付费 fallback **默认关闭**,
  保留「单次授权」与「有硬上限的持久预算」两条显式出口,均不进入自动推荐与后台调用。
- 签署人 / 日期:owner / 2026-08-25

---

## 决策 7 · 扩展交付边界

**决策问题**:第三方扩展首发只接受声明式包,还是开放 code plugin capability 模式?

**方案默认推荐(原文,未改动)**:

> 扩展交付边界：推荐内置受信 connector 与 TUF 签名声明式 product pack 首发 `builtin_stable`；第三方 code plugin 只有在当前 OS 的 App Sandbox/namespace+seccomp+Landlock/AppContainer 等 deny-by-default backend 通过直接 syscall TCK 后才可进入 `community_verified` capability 模式。缺 backend 时只 `inventory`；“完全信任的本机代码”仅开发模式并永久不授 `community_verified`、`builtin_*` 或本机数据驻留 badge。WASI 只作为后续满足同等 TCK/性能后的宿主，不作为首发依赖。

**与合同的耦合**(整理者补充):§4 内 `plugin`/`sandbox`/`capability` 命中 **627 行**。此项决定要不要在首发就背上跨 OS deny-by-default sandbox(App Sandbox / namespace+seccomp+Landlock / AppContainer)与 syscall TCK 的全部工程量。

**签署**:

- [ ] 采纳上述默认推荐
- [x] **改为**:**首发只开放内置受信 connector;第三方声明式 product pack 一并推迟**　←　**owner 已签 2026-08-25**
  - 比方案默认推荐更保守。code plugin 维持默认推荐的最严格形态(缺 deny-by-default backend 只 `inventory`)。
  - **连带推迟**:§4.10 参考实现级扩展内核整节、决策 8 的 TUF 双 root registry、
    Connector SDK 对外发布(决策 9 的 `v1alpha1` 时间点顺延)、§9.8 生态包与扩展成本策略。
    合同草案中对应部分本轮不下沉 `packages/contracts`。
  - 长尾 provider 首发只能由官方逐个内置;这是本项接受的代价。
- 签署人 / 日期:owner / 2026-08-25

---

## 决策 8 · Registry 信任域

> **2026-08-25 连带影响**:决策 7 已裁决「首发只开放内置受信 connector,第三方声明式 product pack 一并推迟」,
> 本项的 TUF 双 root registry 因此**本轮不落地**。预填的推荐理由(爆炸半径控制)在技术上依然成立,
> 建议**保留签署但标注为「架构方向确认,实施时点随第三方包开放顺延」**,不要在本轮排产中当作待办。

**决策问题**:`catalog.tuf` 与 `policy.tuf` 是否使用不同 root 与发布权限?

**方案默认推荐(原文,未改动)**:

> Registry 信任域：推荐 `catalog.tuf` 与 `policy.tuf` 使用不同 root、threshold 和发布权限；`policy.tuf` 再委派 credential-egress、rights、billing、data-boundary、emergency-deny 五个路径隔离 role，TCK trusted-builder/verifier policy 也使用独立 delegation。技术 catalog 或 connector publisher永远不能给自己签发 secret egress、Rights allow、正式 conformance badge 或 emergency deny。

**与合同的耦合**(整理者补充):§4 内 `TUF`/`registry`/`delegation` 命中 **579 行**。核心安全属性是:技术 catalog 或 connector publisher 永远不能给自己签发 secret egress、Rights allow、conformance badge 或 emergency deny。

**推荐理由**(Claude 预填草案,2026-08-24):核心安全属性可以用一句话说清——
技术 catalog 的发布者不能给自己签发 secret egress 许可、Rights allow、正式 conformance badge 或 emergency deny。
若 `catalog.tuf` 与 `policy.tuf` 共用 root,一个 catalog 签名密钥泄漏就等于同时拿到了权益与费用的签发权。
分离 root 与 threshold 是对密钥泄漏做爆炸半径控制,属安全工程标准做法;
成本仅是多维护一套签名流程,与其防住的风险不成比例。

**签署**:

- [x] 采纳上述默认推荐　　←　**Claude 预填草案,待 owner 确认**
- [ ] 改为(填写):
- 签署人 / 日期:

---

## 决策 9 · SDK 与运行时演进

> **2026-08-25 连带影响**:决策 7 推迟第三方包后,Connector SDK 本轮没有外部消费者,
> 「两个独立外部 reference connector 经一个 minor 升级仍兼容」的验收条件本轮无法启动。
> 预填的推荐(先 `v1alpha1`)依然成立且更有必要,但**stable 的时间点随第三方包开放顺延**。

**决策问题**:Connector SDK 以 `v1alpha1` 起步还是直接 stable?是否允许引入 native/Wasm?

**方案默认推荐(原文,未改动)**:

> SDK 与运行时演进：推荐 Connector SDK 以 `v1alpha1` 发布，两个独立外部 reference connector 经过至少一个 minor 升级仍兼容后再 stable；保持 TypeScript/Node 22 主实现，只有 §12 profile 证明具体热点跨平台不达标且局部 native/Wasm 实现通过同一 TCK、故障隔离、供应链与回滚门，才允许引入，不接受无数据重写。

**与合同的耦合**(整理者补充):决定兼容包袱的起点。方案默认推荐 `v1alpha1` + 两个外部参考实现经一个 minor 升级后再 stable,并要求 native/Wasm 必须有 §12 profile 数据支撑,不接受无数据重写。

**推荐理由**(Claude 预填草案,2026-08-24):SemVer stable 是对外兼容承诺,发出后不能撤回。
在没有任何外部实现验证过 API 之前宣布 stable,等于用未来的兼容包袱去赌当前设计是对的——
而这份合同恰好连续 20 轮未通过对抗评审。先 `v1alpha1` 的成本只是贡献者需接受 API 可能变化,
收益是保留修正自由。至于 native/Wasm,默认推荐要求先有 §12 profile 数据证明热点确实不达标,
这是"先测量再优化"的常规纪律,拒绝的正是无数据重写。

**签署**:

- [x] 采纳上述默认推荐　　←　**Claude 预填草案,待 owner 确认**
- [ ] 改为(填写):
- 签署人 / 日期:

---

## 决策 10 · 合同编译资源基线

> **2026-08-25 状态**:仍建议暂缓。除原有理由(草案已外移为真实 `.ts`,预算须重新推导)外,
> 决策 7 推迟 §4.10 扩展内核后,本轮实际需要编译的合同面显著小于该预算设定时的范围,
> 应在确定本轮真实下沉范围后再推导。

**决策问题**:合同编译的资源基线绝对门取什么值?

**方案默认推荐(原文,未改动)**:

> 合同编译资源基线：推荐采用`type-contract-compile-budget-v1`的Node 22、准确单次`--max-old-space-size=2048`、手写schema 1 MiB/20,000行、完整generated contract 4 MiB/80,000行且bytes/lines至少保留30%容量、2.5 GiB peak RSS、900,000 type instantiations、60秒wall和零stub绝对门，同时保留相对签名基线的RSS/instantiation不超过15%、wall不超过20%、source不超过15%的回退门；完整合同与每个fixture隔离测量。任何扩大heap/预算、换runtime或runner后重置基线、把共同加载合同伪拆成不相交单元，或为新增类型恢复`any` stub都必须由owner签名决定，并在新profile ID下解释为何不能通过生成代码、真实package边界或简化类型解决。

**与合同的耦合**(整理者补充):这一项在当前语境下有特殊含义:它是**为 §4 那 4.3 万行类型体操本身**设定的编译预算(2.5 GiB peak RSS、900,000 type instantiations、60 秒 wall)。若采纳本诊断的拆分建议(§4 下沉为真实代码),此项的形态需要随之重估,而不是照签。

**签署**:

- [ ] 采纳上述默认推荐
- [ ] 改为(填写):
- 签署人 / 日期:

---

## 签完之后

1. 决策 1 一旦签出,`HANDOFF.md` 的 active pointer 与 `IMPLEMENTATION-PLAN-2.md` 排产才能对账,
   §0 开工纪律第 3 条的五步开工门才能启动。
2. 决策 2、4、5、6、7 签出后,§4 中为「两种可能都保留」而存在的分支合同才能真正塌缩;
   建议在塌缩之后再决定 §4 的去向(继续留在 Markdown,还是按诊断建议下沉为
   `packages/contracts` 真实源码)。
3. 决策 10 建议**最后签**,且在 §4 去向确定之后签——它的现有形态是为 Markdown 内类型体操
   设定的编译预算,若 §4 下沉为真实代码,该预算需重新推导。

## 本文档不做的事

- 不 supersede 主方案 §14;主方案原文仍是权威出处,本文只是可读副本加整理者注解。
- 不代替 owner 做任何推断;所有「与合同的耦合」均为整理者分析,已与原文严格区分。
- 未修改主方案、未修改生产代码、未 commit。
