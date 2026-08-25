# AI 供给普适接入 v21 设计闭包续接 Prompt

> **已废弃（2026-08-24），请勿执行。**
>
> 本 prompt 要求做 v21 设计闭包并重新取得三路 A=0/B=0。该路线经独立诊断判定不可收敛：
> v1–v20 的 A 级计数为随机游走（v13 曾降至 1，v14 反弹至 9），20 轮零 PASS；
> 被审对象是内嵌在 Markdown 里的 45,696 行 TypeScript，其中单个代码块达 24,283 行，
> 不是零上下文人读评审能收敛的形态。
>
> 诊断见 [`../docs/review/2026-08-24-ai-supply-v20-loop-diagnosis.md`](../docs/review/2026-08-24-ai-supply-v20-loop-diagnosis.md)。
>
> 已改道：合同草案外移至 `docs/plan/ai-supply-contracts-draft/`（可被 tsc 直接检查），
> 评审记账归档至 `docs/review/2026-08-24-ai-supply-review-loop-archive.md`，
> 主方案回到人可读规模。**当前关键路径是先签 §14 十项 owner 决策**，
> 见 [`../docs/plan/2026-08-24-ai-supply-owner-decisions.md`](../docs/plan/2026-08-24-ai-supply-owner-decisions.md)。
>
> 本文件保留为过程证据，不再是可执行交接。


你在仓库 `<repo>` 工作。请用简体中文沟通、注释和写文档，严格遵守本机全局 `AGENTS.md` 与仓库 `AGENTS.md`。这是一个零上下文续接任务；不要依赖上一会话记忆，以下内容就是交接真相，但所有事实仍须用本会话真实命令复核。

## 任务目标

继续完成 AI CLI、订阅、官方/三方 API、自定义 OpenAI/Anthropic Base URL、本地模型、CC Switch/网关、自动探测和主动/被动 UX 的专题方案终审闭包。当前不是生产实施阶段：先把冻结 v20 的全部 A/B 级 finding 做成一次系统性的 v21 根因修订，重新冻结并完成三路独立终审。只有三路都达到 A=0、B=0，才生成下一份真正的生产实施 kickoff prompt。

不要因为上一会话很长或版本号很多而降低标准，也不要继续做只改变名称、重复解释或一般 C 级偏好的版本。v21 只处理能影响正确性、安全、费用、状态、可实施性、当前官方事实或首用体验的根因。

## 当前冻结身份

先原样复核，任一项不一致就停止并说明漂移：

- 分支：`codex/week-audit-faststart-20260822`
- HEAD：`174ab48895aa1e4a6c6b42b9c74187f20efc3cfd`
- 目标：`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`
- 目标 SHA-256：`33afc197085f92355e12272a9c45a49ce4d560715b7b7992759dac8398c83531`
- 目标：48,809 行，3,022,748 bytes
- 目标当前为未跟踪文件，不得用 Git index 反推其内容身份。

工作树还包含其他任务或本轮历史产物：`docs/plan/README.md`、`history/PROCESS-JOURNAL.md` 为已修改文件；主方案、95–166 系列 prompt/report、week-audit 产物、截图与 `.playwright-mcp/` 等为未跟踪内容。不要 reset、checkout、clean、覆盖或顺手整理。只修改本任务明确需要的主方案、新 prompt/report 和 journal 追加段；先逐 path 核对所有拟改文件。

## 上一会话已经完成的工作

1. 对现有源码完成了逐文件现状审计。基线事实是：
   - 已接线 CLI 为 Codex、Claude、Cursor、Grok、Gemini、Qwen、Copilot。
   - Kimi、OpenCode 当前只是 inventory，`provider=null`；智谱尚无完整 CLI/API 一键接入。
   - 当前自定义 HTTP 端点只实现 OpenAI Chat Completions 子集，未原生实现 OpenAI Responses 与 Anthropic Messages。
   - “检测到 CLI/登录态”尚不能证明订阅权益、程序化授权、费用边界或可供 SayDo 分发使用。
2. 主方案已经覆盖两条供给平面、三核心协议、云 IAM、本地/LAN/云计算边界、Ollama/LM Studio/oMLX 等本地运行时、CC Switch 与常见网关、provider pack/Connector SDK/TCK、自动发现、推荐/fallback、费用和数据边界、首启与运行中 UX、发布/回滚/运维及 Phase 0–8。
3. v20 机械读回已真实复核：
   - 16 个 TypeScript block；按“正则逐块捕获、块间两个换行、末尾一个换行”的算法得到 45,728 行、2,282,249 bytes、SHA `234c5ff9a0c68d691eb7547a611e2604d45930ccbaa54a4d8a93874fb810be4e`。
   - Node 22.23.1、TypeScript 5.9.3、`--max-old-space-size=2048`、strict/NodeNext 下 0 diagnostics；489,891 types、809,365 instantiations；24,806 properties、writable=0、`any`=0、duplicate literal properties=0、非品牌 required-never=0。
   - 81 requirements 与 81 exact oracle 双射；71 inference、5 execution、4 bridge、1 control plane。
   - 37 suites 展开 39 BOM rows；5 public producers、5 public roots；17 positive/25 negative 未来 fixture ID；972 a11y cells。
   - 本次交接前单次复核 wall 30.89 秒、max RSS 2,069,364,736 bytes，仍在 60 秒/2.5 GiB/900,000 instantiations 绝对门内。该单次样本不能替代五冷进程和相对基线门。
   - 文档 emoji 门和 active document links 门通过；没有运行 `just ci`，因为没有生产代码实施。
4. 已完成 v20 三路独立终审，三份都绑定同一冻结目标且目标未漂移：
   - `research/codex-findings/164-ai-supply-reference-architecture-final-closure-v20.md`：FAIL，A=4、B=0、C=0；SHA `7d896204979c86f3f84df79faf72fc3cd35f6b95669b5d3cfa120172c15d8ea2`。
   - `research/codex-findings/165-ai-supply-ecosystem-ux-final-closure-v20.md`：FAIL，A=1、B=2、C=1；SHA `921429129b62b282246496ede6d3238fb0e6c1734a8ff4a04f2cc1efcfa7d2c8`。
   - `research/codex-findings/166-ai-supply-reference-grade-final-adversarial-v20.md`：FAIL，A=6、B=0、C=0；SHA `8ac62a42c3a5adbc116a9ce8ced7250b1e1cd88fc497575b498326b8ecd9e502`。
   - 外部审查日志 `logs/166-ai-supply-reference-grade-final-adversarial-v20.jsonl` 为 425 行、2,251,699 bytes、SHA `45d9f83492acf3c75abdfef4562c6555f5c8c31bc67282f82df8859c49e61594`，真实包含 `turn.completed`；反复出现的 model cache TTL metadata error 非业务失败，不能隐藏，也不能据此回落模型。
5. 已使用腾讯云官方一手资料确认两套现行控制面不能混用：
   - 中国站 product 1823 使用 `tencentmaas.com`；其广州和新加坡是同一中国站控制面下不同资源调度地域。
   - International product 1300 使用 `tencentcloudmaas.com`，普通 API 当前列出 Singapore、Guangzhou、Silicon Valley；企业套餐另有对应 plan endpoint；个人套餐也有独立 `sk-tp-*`、入口、支持工具与用途限制。
   - 不能把“中国站控制面的新加坡资源范围”写成“已覆盖 Tencent Cloud International”，也不能跨产品假定 key namespace 或 credential recipient 相同。
6. 上一会话只修改方案与过程材料，没有修改生产代码，没有 commit、push、deploy，也没有取得 owner 对十项决策的签字。
7. 设计期临时 helper/probe 已在交接前删除。不要把上一会话的临时 probe、日志中的命令或文档自述当成未来 Phase 0 的 checked-in fixture。

## 必须完整阅读的输入

按顺序完整读取，不抽样：

1. `AGENTS.md`、`HANDOFF.md`、`docs/plan/IMPLEMENTATION-PLAN-2.md`
2. `docs/09-data-contracts.md`、`docs/10-voice-ux-spec.md`、`docs/11-ui-spec.md` 及主方案直接引用的 canonical 节
3. 主方案全文，尤其 §0、§4.16.8、§8、§9、§12、§14、§16、§17.18–17.19
4. 三份 v20 正式报告 164、165、166 全文
5. 三份对应 prompt 164、165、166，确认审查边界
6. `history/PROCESS-JOURNAL.md` 最新 R95 交接记录；R94 的早期 PASS 叙述已被 R95 与 v20 报告 supersede，不能沿用

## v21 必须关闭的根因

三份报告存在重叠。不要把 finding 数量机械相加；按下列依赖顺序一次关闭同类问题。

### 1. 统一安全权威顺序，停止把 TypeScript 泛型当运行时授权

- 固化唯一裁决模型：resolver 先验证六字段 pointer、kind、签名/commit、digest 和 canonical subject bytes；私有 producer 在运行时重算 JCS/等值关系并在需要唯一化的路径执行持久 CAS；只有它能签发 committed receipt。
- TypeScript 只作静态辅助，不授予安全、费用、状态或发布权限。运行时同型对象、联合变量、宽模板、`string & Brand` 必须按已解析 pointer/digest/canonical bytes判断。
- 从同一 schema/codegen 生成静态 boundary gate，递归拒绝安全关键身份中的 union、裸 string、开放 template literal、宽数组/对象和多参数共同反推；一个输入是唯一推断锚，其余位置统一 `NoInfer`。
- 对完整泛型 constituent 做分布式条件，不对 `S["sendState"]`、`C["exactDefinition"]`、`R["onboardingAvailability"]` 等 indexed access做非分布式判断。`OwnerAdditionalRequirementV4<I>` 必须先按 `I` 整体分布再生成全部派生字段。
- 静态负例只证明静态辅助门；TypeScript 无法区分的场景改为运行时 mutation/property test，并要求零副作用前拒绝。不要继续宣称“能编译失败”等于运行时安全证明。

必须覆盖报告中的 TUF path 联合、开放 protocol 模板、owner tuple/claim omission、fresh/migration 联合、physical before/after 联合、Codex retry/fixed refresh 换挂反例。

### 2. 由一个持久 transition/CAS 内核生成全部状态链

- 从 canonical transition table 生成唯一运行时内核，至少以 `{domain, exactSubjectPointerDigest, cursorRevision}` 为 key；event 另绑定 `{requestPointerDigest, physicalAttemptPointerDigest, nextSequence, terminalState}`。
- 每个私有 producer 在一个持久事务中解析准确前驱、验证 branch、消费 lease/authority、CAS revision并写唯一 successor；terminal 后禁止任何 successor。
- physical、fallback、Inference event、Codex refresh 必须使用同一模型。fallback 每个 disposition 都显式要求或禁止 physical terminal，保存准确 predecessor/cursor revision，且同一 subject 只能有一个 terminal。
- fallback ordinal 必须是 literal generic，并以它索引准确 alternative；不得宽化为 `number` 或 union alternative。
- `AuthoritativeLedgerRangeReceipt` 参数化到准确 domain/logical call/physical attempt，terminal 保存准确 ledger pointer和逐字段 equality receipt；cross-call、cross-attempt、cross-domain 均拒绝。
- raw frame/occurrence、DecodeContext 和 legacy read/decode 由 host-only branded producer签发，直接绑定 content handle、raw digest、request pointer、physical attempt/send-intent pointer、sequence和读取 authority。插件只能提出 proposal，不能伪造 host context。

### 3. 重新生成 final-AST authority 闭包

- authority compiler 只以包含全部 v21 声明的最终 package program、resolved symbol和 source annotation 为输入；一次生成 source、alias、branch、constituent、policy、lifecycle group、producer/terminal/recovery、edge manifest及 signed expected artifact。
- 删除“较早代码块维护固定 76/89 数量”的权威地位；数量必须由 final AST 生成，再由 exact set 比对。
- `FallbackAttemptLeaseReceiptV20` 与 `CodexCommandAuthRefreshAttemptLeaseReceiptV20` 等所有 concrete authority lease 都必须有准确 kind、canonical subject、私有 issuance producer、intent 前关闭、intent 后 terminal、restart/expiry/reconciliation/revoke 和 exact release tuple。
- fallback lease producer必须原子消费 ready cursor并签发 in-flight successor；任何未分类声明、无 producer 或无恢复路径都使构建非零。

### 4. 让公共 proof graph 真正自描述且可离线重放

- 新建完整 v21 edge/DAG schema，不复用缩减的 `ReceiptNodeEdgeSchemaV19`。
- manifest 至少表达 field edge、edge role、same-value path pair、state-machine identity、branch predicate、复合 ordering key、producer DAG、instance verifier、consumed/released terminal predicate和 single-successor authority。
- release root 直接保留准确 release-binding pointer、bootstrap root/content handle；public operation result保留 typed single-use consumption/CAS terminal pointer，不能只剩普通 digest。
- offline verifier必须能从 5 个公共 root遍历和重放全部发布关键边，不能依赖无法解析的 opaque 摘要。

### 5. 重做 43 个性能测量主体和跨发行物 baseline

- 定义 invariant `MeasurementTarget = complete_contract | { fixtureId, modulePath }`，精确集合为完整合同 1 项加 17 positive、25 negative，共 43 项。
- target进入 invocation、metrics、baseline namespace、cursor、gate、TUF policy subject和 release aggregate；每项保存 source digest、五个独立冷进程样本和准确 invocation identity。
- aggregate gate 对 43 项做 exact-key bijection；release必须消费 aggregate，不能消费单一 compile gate或 opaque transcript。
- baseline replacement显式区分 predecessor distribution 与 current distribution；要求同一 target、旧 passing gate、owner批准、环境校准和 single-winner CAS。genesis只允许一次 repository initialization。
- 固定一种可执行、可签名的 canonical extraction算法。当前两个算法会产生相同行数和 bytes、不同 SHA：
  - regex block concat：`234c5ff9a0c68d691eb7547a611e2604d45930ccbaa54a4d8a93874fb810be4e`
  - line-preserving fence blank：`99bbb2ecb8a861d5aedb1093decbf10a621dd4261e544790c800db40e08b6dd1`
  不能再用 bytes/lines 暗示二者相同；在 schema、runner、evidence和文档中只认一个带版本的算法 ID。

### 6. 修复 Tencent 产品域和生态覆盖

- 把 account/control-plane product identity、resource scheduling realm、credential recipient/key namespace 分开建模。
- 现有 `tencentmaas.com` Singapore 行明确标为中国站 product 1823 控制面，不再泛称 Tencent global/International。
- 按当前官方一手资料为 International product 1300 建准确普通 API 与企业套餐能力，使用 `tencentcloudmaas.com` 的 region/origin/path/auth；若某个 surface 本轮不能达到同等级 TCK，就标为 inventory并撤销相应 global claim，不能借中国站行占位。
- International 个人 Token Plan独立建 product/key/endpoint/allowlist/rights；SayDo 未列入允许工具或用途时保持零 secret、零调用，仅给合规替代路径。
- 增加两套控制面、地域、普通/企业/个人、Chat/Responses/Messages、key namespace的交叉负例，要求 secret read和首字节前拒绝。
- 当前一手入口至少包括：
  - `https://cloud.tencent.com/document/product/1823/130078`
  - `https://cloud.tencent.com/document/product/1823/130079`
  - `https://cloud.tencent.com/document/product/1823/130060/`
  - `https://intl.cloud.tencent.com/document/product/1300/78941?lang=en`
  - `https://intl.cloud.tencent.com/document/product/1300/80632?lang=en`
  - `https://intl.cloud.tencent.com/document/product/1300/81315?lang=en`
  - `https://intl.cloud.tencent.com/document/product/1300/81489?lang=en`
  实施前重新浏览官方页面，不使用二手资料，不把搜索摘要当最终依据。

### 7. 统一 UX 机器真相

- 外部任务总数、逐 class、条件 MFA、用户披露、GA 验收表和测试断言只能从完整 journey graph fold 的一个 literal SoT生成。删除当前 7/7/10/8 与手写 4/4/5/4 两套冲突口径；产品若要更窄上限，就让超限分支机械降为 advanced，而不是保留矛盾表。
- generic runtime state projection携带由准确 requirement row生成的 `productDisplayName`、journey/action destination、realm和 typed ICU arguments；三真实 locale、DOM和 a11y snapshot从同一 row展开。增加错品牌、错 realm负例。
- 将当前固定 execution row从“Kimi Server/ACP”准确重命名为“Kimi Code CLI ACP”，锁定受信 binary与 `kimi acp`。未来 `kimi web` 必须作为独立 HTTP/WS surface，不复用 ACP claim。

### 8. 全量传播与历史闭环

- Tencent 若新增 requirement row，必须同步全部固定计数、oracle、baseline、claim、fixture、支持表、发布定义和 prose；不得只加表格。用程序化 exact set检查 missing/extra/duplicate。
- 在 §17 新增 v20 三路终审输入、准确 hash/计数、归并 triage、v21 根因修复和验证证据；明确纠正旧的“已通过”历史叙述，不删历史。
- 不修改生产代码，不提前创建 Phase 0 的正式 43 fixture，不运行不存在的未来命令，不把设计期临时 probe冒充实施证据。

## v21 验证与冻结门

1. 先建立书面验收目标和对应门禁，再编辑；每个上列根因都有正向可构造路径、静态负例和运行时 mutation层的明确归属。
2. 所有 repo 文件编辑只用 `apply_patch`；保留用户和其他任务改动。批量编辑后逐项程序化核验。
3. 完整合同使用 Node 22、TypeScript 5.9.3、唯一前置 `node --max-old-space-size=2048`、ES2023/NodeNext、strict、`exactOptionalPropertyTypes`、`noUncheckedIndexedAccess`、zero stub。冻结前跑五个独立冷进程；记录 diagnostics、types、instantiations、wall、peak RSS、source bytes/lines和环境身份。不得提高预算掩盖退化。
4. 全量 Compiler API/AST census 至少检查 writable、`any`、duplicate property、非品牌 required-never、public producers/roots、final-AST authority exact set、requirement/oracle双射、BOM、a11y、43 measurement target和 proof graph边集合。
5. 重新运行文档结构、trailing whitespace、表格、emoji、active links和 `git diff --check`。生产代码未改时不要虚报 `just ci`；若越界改了生产代码，立即停止并说明。
6. 冻结 v21 的目标 SHA、lines、bytes、canonical extraction algorithm ID/digest、HEAD和 path status。
7. 按仓库制度创建三个新编号 prompt：两个 `fork_turns="none"` 的零上下文、互补 subagent独立复审，以及一次 target-only 的外部 Codex `gpt-5.6-sol`、reasoning max、read-only、stdin关闭审查。评估者不能读取本续接会话的推理、自辩、旧 finding或彼此报告，只读冻结目标与各自 prompt。
8. 任一路 A/B 非零就 triage、根因回修、重冻和全新重审；三路同时 A=0、B=0 才能说“设计具备实施资格”。一般 C 项进入 backlog，不单独触发新版本。

## 仍然存在的开工阻断

即使 v21 三路 PASS，也不能在本会话直接进入生产 Phase 0：

- `HANDOFF.md` 当前 active pointer 仍是 `w54b-wiring`，C3 未收口。
- `IMPLEMENTATION-PLAN-2.md` 规定全仓同一时刻只允许一个活动批次，本专题尚未作为具名批次写入唯一排产源。
- 主方案 §14 的十项 owner decision尚未形成签名、schema-valid 的 batch/decision record。
- 相关 canonical ownership、dirty 文件、基线 HEAD/SHA和依赖尚未完成开工前对账。

这些是预期治理阻断，不是让你绕过的障碍。设计 PASS 后，输出一份单独的生产实施 kickoff prompt；该 prompt 第一阶段只能做只读 preflight，任一阻断仍在就明确停下，不得用 branch/worktree/clone 绕过。

## 本会话交付要求

- 主交付：完成并冻结 v21，三路终审 A=0、B=0；若仍失败，诚实报告并继续根因闭包，不生成误导性的生产开工指令。
- 过程交付：新 prompt/report、必要官方证据、§17 triage和 `history/PROCESS-JOURNAL.md` 新轮次追加记录。
- 最终回复先给结论，再给主方案、三份终审报告和后续生产 kickoff prompt的绝对路径链接；明确列出未实施项、真实门禁结果、是否仍受 pointer/PLAN-2/owner 决策阻断。
- 不 commit、push、deploy，除非 owner 在该新会话明确授权。
