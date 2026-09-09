# 项目缺口治理 owner 决策单

> 日期：2026-08-28
> 对应方案：`docs/plan/2026-08-28-project-gap-closure-program.md` v7
> 状态：D17 已签（2026-08-29）；D1/D14 的首批目标人群与语音非必需约束于 2026-08-31 部分裁决，后续实施授权见第 6 节；PG-01A 三文件恢复与本地 I/E 提交授权见第 7 节，C1 三项 blocker 的再次有界恢复见第 8 节；AS-01-AS-02 隐私批授权见第 10 节（来源为 owner 直接提交统一实施 Prompt，不是 D17 扩权）。D1–D16 与 D18–D19 未因此整体签署，产品支持档位未晋级；D17 的历史授权仍只覆盖 PG-00
> 规则：本文件是 D1–D19 的唯一签署载体；方案正文中的缺省动作不是签名，也不是已实施状态

## 1. 签署方法

owner 只在需要进入对应批次前签署，不要求一次决定全部长期方向。签署一项时：

1. 把该项的 `[ ]` 改为 `[x]`；
2. 填写日期、选项与必要上限；
3. 方案会话核对选择与当前代码、canonical、排产源是否仍兼容；
4. 批级 evidence 记录本文件当时的 bytes SHA-256 与 included/deferred exact-set，后续修改不会追溯
   授权旧批扩大范围。

D17 另有一条不可替代的约束：owner 原始批准消息必须直接写出最终 64 位 import spec SHA-256。
只说“按本文件所列 digest”不生效。方案会话收到一次有效回复后可据此登记 `[x]`、日期和原话；
这只是签名留档，不需要 owner 再做第二次战略选择，也不自动开始 PG-00。

安全收紧、撤销失实承诺和停止新增敏感明文不等待战略决策；任何能力放开、外部花费、产品晋级、
新数据留存或新支持承诺必须等相应签名。

## 2. D17 签署留档（本签名不覆盖 D1–D16/D18–D19）

### D17 · 导入唯一排产源

- [x] 已签
- 日期：2026-08-29
- 绑定输入：以 `docs/plan/2026-08-28-project-gap-d17-import-spec.md` 记录的 branch/HEAD、PLAN-2 与
  HANDOFF preimage、preexisting dirty exact-set 和提交 path exact-set 为准；import spec SHA-256 在签署前
  由本文件登记。任一锁定值漂移则本签名不生效，必须先重生成 spec。
- import spec SHA-256：`9159d69ba91f3676cb96a896ac55f7e3976cc503e5212f1b378089de997940cf`
- owner 批准原文（签署后逐字登记，必须含上行相同的 64 位值）：

> 批准 D17；绑定 import spec SHA-256=9159d69ba91f3676cb96a896ac55f7e3976cc503e5212f1b378089de997940cf；授权 PG-00 在当前专用 feature branch 上只以 import spec 明示的 I/E required path 与 week-audit 七项 allowlist 实际变化子集创建仅本地 I plan/import commit 与 E evidence commit，并创建一个 clean validation worktree 及 exact ignored review logs；不授权产品代码实施、推送、合并、部署、真实账号/connector/产品外部调用、付费、既有、用户、产品或历史数据删除、条件包。
- 选择：采纳 v7 的 A 级 core 风险关闭方案，并授权一次标准 Git 的本地文档导入。
- 授权边界：
  1. 允许在当前专用 feature branch `codex/project-gap-plans-20260828` 上，只以 import spec 明示的
     explicit pathspec 创建本地 plan/import commit `I` 与 evidence commit `E`；禁止 `git add -A`；
  2. `I` 把 `PG-01A`、`PG-01B`、`PG-02`、`PG-03`、`PG-04`、`PG-05`、`PG-06` 导入
     `docs/plan/IMPLEMENTATION-PLAN-2.md`，并同步 `HANDOFF.md` 的唯一下一批指针；
  3. 用 import spec 的逐节点 disposition 唯一处置：
     `legacy_node_exact_set={AI-ACTIVE,AI-DRAFT,W5.4-c,W5.3-tail,W5.6,W5.8,W5.9,W5.11-rest-six,R-B,R-C,A5-armed,A5-UI,W6,W7,W8,W9,PLAN2-default-all,Codex-app-server}`；
     未被 exact 选入即 deferred，不再“缺省全做”；
  4. 只授权 import spec 明示的 I required path、E required path、现有 week-audit writer 七项 allowlist
     的实际变化子集、一个 clean validation worktree 与 exact ignored review-log 目录；本地 commit
     不授权 push、merge 或 deploy；
  5. 两路 subagent、一次 fresh Codex 只读复审与静态门必须绑定同一 `I` commit/tree；任一回修产生
     新 `I` 后旧复审与门禁失效；
  6. 只有 `parent(I)=locked HEAD`、`parent(E)=I`、两段 committed pathset 全等、签署 digest 与 I 中
     spec/program blob 全等、E 前 index/working-tree 全等、I 的三路 review 通过且 clean E 上
     `week-audit --check-bundle` 与静态门全绿，
     才算 PG-00 形成可验收的本地候选；
  7. 导入后停在 owner，不自动开启 `PG-01A`。D17 不授权产品代码实施、push、merge、deploy、真实账号/
     connector/产品外部调用、付费，也不授权删除或覆盖既有、用户、产品、历史 evidence 或其他数据。
- 导入后的安全规划档：`rc + developer/preview`；daemon/console 为当前声明上限；voice 未被 candidate
  选入时为 false；corpus unresolved；`direct_to_review` hidden；remote/MCP/A2A/team/connectors
  disabled/deferred；external live/spend=0；telemetry off；不新增用户内容 snapshot；不做历史不可逆
  删除；support 为 best-effort preview。
- 不授权：SP4–SP7、connector、remote business payload、团队版、移动正式能力、产品档位晋级。
- owner 原话/补充限制：

> 批准 D17；绑定 import spec SHA-256=9159d69ba91f3676cb96a896ac55f7e3976cc503e5212f1b378089de997940cf；授权 PG-00 在当前专用 feature branch 上只以 import spec 明示的 I/E required path 与 week-audit 七项 allowlist 实际变化子集创建仅本地 I plan/import commit 与 E evidence commit，并创建一个 clean validation worktree 及 exact ignored review logs；不授权产品代码实施、推送、合并、部署、真实账号/connector/产品外部调用、付费、既有、用户、产品或历史数据删除、条件包。

本签名只覆盖 D17。D1–D16 与 D18–D19 保持未签，不得由本条推断为已授权。

推荐的最小回复文本是：

> 批准 D17；绑定 import spec SHA-256=9159d69ba91f3676cb96a896ac55f7e3976cc503e5212f1b378089de997940cf；授权 PG-00 在当前专用 feature branch 上只以 import spec 明示的 I/E required path 与 week-audit 七项 allowlist 实际变化子集创建仅本地 I plan/import commit 与 E evidence commit，并创建一个 clean validation worktree 及 exact ignored review logs；不授权产品代码实施、推送、合并、部署、真实账号/connector/产品外部调用、付费、既有、用户、产品或历史数据删除、条件包。

若 D17 未签，本方案保持审计建议，现有排产源不改，任何 PG/SP 均不得开工。
2026-08-29：D17 已按上方 owner 原话签署；该签署不使 D1–D16/D18–D19 变为已签，也不自动开工 PG-01A。

## 3. 分阶段决策队列

下表只规定“最迟何时要决定”，不要求现在签。选项、影响和安全缺省详见方案第 10 节。

| 决策 | 最迟签署点 | 未签时行为 | 当前状态 |
|---|---|---|---|
| D2 corpus v8 A 级处置 | 全修 986 source 或恢复 readiness 引用前 | PG-01A 只执行安全降级，不逐条修复 | [ ] |
| D3 `direct_to_review` | 选择完整实施而非隐藏前 | PG-01B 从默认 UI 和承诺隐藏 | [ ] |
| D6 移动边界 | 重开任一远程业务 payload 前 | PG-01B 全关业务面，仅保留 health/static shell | [ ] |
| D13 retention/telemetry | SP2c1 或任何新 snapshot/不可逆历史处置前 | PG-04 只停新写入并盘点；不新增 snapshot，不处置历史行 | [ ] |
| D10 当前发布物定位 | SP3b 或下一公开 RC 前 | 保持 Developer Preview | [ ] |
| D11 variant 容量 | 任一 variant 升 `supported` 前 | unknown/超额 variant 不升级 | [ ] |
| D12 live 证据预算 | SP2b1/SP3b 或首次外部调用前 | 只做 hermetic/静态收紧，不调用外部账号 | [ ] |
| D19 support/Ops0 | SP3b 或下一公开 RC 前 | best-effort preview，仍保留最小安全事故职责 | [ ] |
| D1 产品方向与档位 | SP4 前 | 保持 `rc + developer/preview` | [ ] |
| D14 primary ICP/JTBD | SP4 前 | 只保护 expert developer 基线 | [ ] |
| D15 真人验证与晋级 | audience/maturity 晋级前 | formative preview 不升档 | [ ] |
| D16 战略回报与 portfolio 预算 | 第二价值轨、持续预算或 portfolio 扩张前 | 只允许一个零/小额可逆实验；有费用先签上限 | [ ] |
| D4 首个普通用户任务 | SP5 前 | 不开第二价值轨 | [ ] |
| D5 首批 connector | SP5 前 | connector 与 MCP 整体 deferred | [ ] |
| D7 locale/无障碍目标 | SP6 前 | 不宣称完整支持 | [ ] |
| D8 team/enterprise | SP6 前 | 后置，保持单 owner | [ ] |
| D9 MCP/A2A | 开具体 MCP/A2A capability 前 | MCP/A2A deferred；不阻塞其他 SP5/SP6 capability | [ ] |
| D18 remote trust stack | SP6 重开移动业务面前 | 业务远程 unsupported | [ ] |

## 4. AI supply 既有决策的消费边界

AI supply 的十项既有决策继续只在
`docs/plan/2026-08-24-ai-supply-owner-decisions.md` 签署，本文件不复制签名：

- 已签 AI 决策 2：Codex 本轮使用现有 `codex exec` 路径；`codex app-server` deferred。
- AI 决策 4/5 未签时，PG-06 只完成 fail-closed admission、静态发现与自动 probe hard-disable；
  不实现或启用权益推断、网络发现、live ProbeGrant cage 或真实外部 probe。
- SP4 只消费 selected surface 的 applicable AI decision：决策 3 仅 evaluator same-family fallback，
  决策 4 仅分发版 Claude 订阅，决策 5 仅 LAN discovery；无关决策不构成 blanket 前置。
- 其他 AI 决策只在其专题实际消费前核对，不因 D17 一并视为批准。

## 5. 变更账

| 日期 | 决策 | 变化 | 影响批次 | 记录人 |
|---|---|---|---|---|
| 2026-08-28 | 建立载体 | D1–D19 从方案中的候选问题收敛到唯一可签文件；全部保持未签 | 全部 | 方案会话 |
| 2026-08-29 | D17 | `[x]`；日期 2026-08-29；逐字登记 owner 原话；绑定 import spec SHA-256=9159d69ba91f3676cb96a896ac55f7e3976cc503e5212f1b378089de997940cf。本签名不覆盖 D1–D16/D18–D19，不自动开工 PG-01A | PG-00 | 实施会话 |
| 2026-08-31 | 首批用户与后续实施 | 登记第 6 节新授权；首批同时服务开发者与普通用户，完整语音非必需；不改写 D17，也不把未给出的子决策标为已签 | PG-01A 起的既定治理链 | supervisor |
| 2026-08-31 | PG-01A 有界恢复与本地提交 | 登记第 7 节对上一轮明确问题的批准；只补入向导测试与两份现役投影，恢复本地 I/E 流程，不扩大外部权限 | PG-01A | supervisor |
| 2026-08-31 | PG-01A C1 三项 blocker 恢复 | 登记第 8 节新授权；处理 B1/B2/B3，维持一次修复和一次 fresh readback、本地 I/E 边界，保留旧 RED | PG-01A | supervisor |
| 2026-09-06 | AS-01-AS-02 隐私批 | 登记第 10 节；来源是 owner 于 2026-09-05 直接提交《SayDo 工程改进统一实施 Prompt · Astra》，默认近期组合 PG-01B → AS-01/AS-02；不改写 D17 原话；PG-01B 已入 main 但无 `--finalize` 记录 | AS-01-AS-02 | supervisor |

## 6. 2026-08-31 后续实施授权

owner 原话：

> 首批需要既服务开发者，也服务普通用户，但是不必须包含完整语音。
>
> 授权你继续往下对应，直到必须人工参与的环节

- 首批目标用户包含开发者与普通用户；这是产品目标，不是已经通过普通用户上手验收的声明。D1 的 audience 方向与 D14 的人群范围据此部分确定，具体普通用户首个任务、发布档位及真人晋级标准尚不代填。
- 完整语音不是首批必需项；现有文本交互作为可独立验证的入口，语音仍按实际安装与健康状态说明，不借此删除现有语音功能或伪造离线/全本地支持。
- 新授权允许沿 PLAN-2 已列范围、验收与门禁继续实施，从 PG-01A 开始；按当前 Workflow V2 监督交付，一名零上下文 reviewer 对每个候选评估，范围内阻塞最多返工一次、复审一次，第二次红灯停止。
- 本地 commit 权限在此条授权时尚待单独回复；后续 PG-01A 本地提交批准见第 7 节。push、合并晋升、部署、真实账号/connector 调用、外部付费和既有用户数据删除仍须对应的明确授权。
- 不把双人群目标扩展成全部 connector、企业/团队、移动或全部 AI 服务已支持；触发未决 owner 选择或必须真人/真实账户参与时，固化证据并停下。

## 7. 2026-08-31 PG-01A 恢复与本地 I/E 提交授权

本次回复前，supervisor 明确请求：下一轮有限修复向导测试与两份 dry-run 投影，修订对应允许路径及投影更新条件，并允许本地“代码 + 证据”两次提交；不包含 push、合并或部署。

owner 回复原文：

> 授权你继续对应

该回复承接上述具体请求，允许：

- 在既有 PG-01A 候选上继续，不重建候选、不丢弃已落地改动；恢复 cycle 为 owner-recovery-20260831-1。旧 owner-continuation-20260831 的 repair=1/rereview=1、C0 首轮 RED 与二轮 GREEN 保留，不用新 fingerprint 消去旧记录。
- 将 packages/console/src/components/setupWizardUx.test.tsx 纳入 exact scope，同步两条已失真的文案断言；不删除测试，不恢复“数据不出这台电脑”的失实承诺。
- 对已验证的 authority digest 既有失配，允许按现役 rebuild-three-pass-dry-run.mjs 重生成 research/customer-question-corpus/dry-runs/01-three-pass-dry-run-result.md 与 02-dry-run-remediation-plan.md，即使 source-tree digest 未变；只修改这两份生成投影，不改 renderer/oracle、源对象或 600 题范围来造绿。
- 依当前 V2 的有界恢复执行一次范围内修复和独立 readback；每个候选仍仅一名零上下文 reviewer，不自动增加返工额度。必要门禁仍按原合同，不能以本授权跳过 gate。
- 由 supervisor 以 explicit pathspec 为本批形成两个仅本地提交 I 与 E，满足 parent(I)=P、parent(E)=I；在两个提交范围内按合同处理未发布候选的必要调整，不改 predecessor。提交不表示通过验收。

不授权 push、合并晋升、部署、发布、真实账号/connector/产品 AI 调用、外部付费、用户数据删除，亦不将其他未签 D/AI 决策升级为批准。

## 8. 2026-08-31 PG-01A C1 三项 blocker 再次恢复授权

上轮已形成仅本地 I=004b226db0b9a6fb0347d60dc790c97293d11635，C1 首次独立 readback 判 RED：B1 为现役公开承诺残留，B2 为 active-claim 门禁漏检，B3 为 Q0 字段漂移未被拒绝。supervisor 明确询问是否授权针对这三项问题再做一轮有限修复与独立复审。

owner 本次回复原文：

> 授权你继续完整对应

该回复承接上述具体问题，允许在既有 PG-01A 范围内开启 cycle=owner-recovery-20260831-2：

- 全量清查既有 active roots 并收紧 B1 残留；修复 B2 的 checker 与彼此独立的声明反例；修复 B3 的八字段一致性与独立字段漂移反例。由 supervisor 先在原 IMPL-PROMPT 写明本轮 exact delta 允许集合，不以修复为由扩张运行时能力或数据源。
- 原实施线作一次范围内修复，随后一个全新零上下文 reviewer 对新候选复审一次；旧 cycle=owner-recovery-20260831-1 的 RED、repair=1、C1_review=1 与更早 C0 记录不改写。此次普通授权不是无限返工或预算 override。
- 第 7 节本地 I/E 权限继续用于同一批：supervisor 可仅调整尚未发布的 I，使最终 parent(I)=P，且 E 仍为唯一 parent(E)=I 的证据提交；保留旧被拒 I 的取证引用，不改 predecessor，不把中间被拒 I 留入最终 E 祖先链。
- 语义 GREEN 后继续原合同的同 SHA 完整门禁、隔离页面渲染、正式 Q0 与 E；缺必要人工输入、权限、平台条件或本轮预算耗尽时仍停止并说明具体原因，不假绿。

本条不授权 push、合并晋升、部署、发布、真实账号/connector/产品 AI 调用、外部付费或用户数据删除，不改变未决产品/架构决策，也不把新 cycle 变成今后自动重开预算的常规。

## 9. 2026-09-01 夜间 PG-01A 主交付恢复授权

来源为 owner 在监督根任务 01a05299-fac0-71b2-a0b9-e7780e56ff23 发给本现存任务的夜间继续消息。关键原文：

> 对原已停止的旧周期，依据本次授权记录一次 owner-night-recovery-20260901 恢复周期；若已存在就恢复它，不能重复新开。保留旧RED与计数，本次最多3次产品修复、3次复审，同根因/策略重置仍有界。
>
> 继续当前 SayDo PG-01A 主交付，不是已完成的 scanner-only 老恢复任务。
>
> Q0字段校验上次已关闭、16定向门禁通过；当前两项阻塞是官网/发布说明过度承诺，以及scanner漏掉这些真实措辞。
>
> scanner是有限防误用护栏，不需构建通用NLP证明所有表达；不要靠删测试/泛化成所有文字一律红去过关。
>
> 保留本任务原明确允许的本地commit边界，只有原合同明确允许且完成验收时才用；不push/merge/deploy、不调用真实产品AI服务、不买额度。只继续原已接受且无owner checkpoint的阶段，不自动执行明确排除的E/PG-01B。

本次授权的执行边界：

- 恢复唯一 cycle=owner-night-recovery-20260901，不覆盖第 8 节 cycle 的 RED、repair=1/rereview=1 或更早记录。当前周期按已发布 V2.3 使用最多三次产品修复、三次复审，同根因最多两次修复尝试、最多一次策略重置；不滚动重开周期。
- 本机安装 policy SHA-256 必须为 785d7d2028a8cae799831c9a1ea4584ae75bd6b47f8970be282f516df990589a，冻结副本后使用。不得使用待审 V2.4，不改 provider/model、不买额度、不降低权限、不关闭 CI。付费派发前用纯工具核验合同、状态、候选；格式/参数错误不消耗产品修复额度。
- 仅续修 B1/B2，维持既定 active-root 范围、copy-only 与真实行为回归；Q0 保持已验收 bytes，不重建或重开大审计，不扩展 AI provider 实现或承诺。没有范围变化时不另派方案审查。
- 迭代只跑受影响 focused；fresh Codex 只读语义 GREEN 后，对同一锁定候选运行完整门禁和页面检查。完整门禁产品失败与语义 RED 共享修复预算，按已核验 state/validator 续行。
- 本地 commit 仍仅限原明确授权且验收成立的范围；本夜不预先 amend 被拒 I，不生成正式 Q0/E，不启动 PG-01B。可以保留经验证的未提交 product diff 及精确指纹交接，不把 HEAD 的旧提交身份冒充新实现 SHA。
- owner 至明早不自行实施；其他会话可能仅修改文档，必须保留。允许本任务与不同项目并行不增加本任务的语义子会话或修复预算。
- 最终报告给出实际 candidate、独立 verdict、focused/full 实证、公开声明限制和未执行事项。真实范围/权限/凭证或预算阻塞时固化 handoff，不假绿，不因软上下文或旧预算重新询问。

本节只覆盖上述夜间 PG-01A 恢复，不改变未签产品/架构决策，也不授权对外推送、合并晋升、部署、发布、真实产品 AI/connector 调用或用户数据删除。

## 10. 2026-09-05/06 AS-01-AS-02 隐私批授权

来源：owner 在 2026-09-05 本新任务直接提交《SayDo 工程改进统一实施 Prompt · Astra》（仓内 `docs/plan/IMPL-PROMPT-engineering-unified.astra.md`）作为实施请求，并按其 §1 默认近期组合 **PG-01B → AS-01/AS-02** 接续。这不是仅合并文档的旧研究任务，也不是 D17 扩权。本节不编造逐字引语，不改写上方 D17 原话。

登记边界：

- 前置：PG-01B 已入 `main`。implementation `ebd449080bb0e476eb2dd3334ee0b152cb3a7eeb`，evidence commit `99d51106c9caaefcf55f72bff1a17a78abf58be9`，证据正文 `e2e/evidence/pg-01b-20260905.md`（不是原批卡旧文件名 `e2e/evidence/project-gap-pg-01b.md`）。原始七项 gate log 与 receipt SHA 已核验；代码从 I 到 E 无变。journal R129 记录 owner 已知情接受 `--finalize` 程序性债并合并。不清旧账、不伪称 finalized、不重做 PG-01B。PLAN-2 曾把 `active=PG-01B` 留作滞后文字，不否认已经入 main 的实现。
- 产品范围仅同一隐私批的 contract → implementation 两阶段（凭据写前拒绝、私有 write set Git 保护、三类失败可见与恢复）。不自动实施 AS-03..07、PG-02 或其它候选。
- 本登记不授权 commit/push/merge/install/deploy、真实 provider 调用或付费探针。合同阶段只改 canonical/排产/有限共享 schema；implementation 另阶段再改 daemon/console。
- 旧 D17 仍只覆盖 PG-00 导入；不得把 D17 当作本批授权。

## 11. 2026-09-09 GAP-02-consolidation 收口授权与 §3 三项立项

来源：owner 在 2026-09-09 对本会话交付候选的四项 checkpoint 回复「都同意，授权你完整的实施，按照你的建议对应」。本节不编造逐字引语之外的内容，不改写上方 D17 原话，不是 D17 扩权。

登记边界：

- 已按授权执行：插批 `GAP-02-consolidation`（AS-01-AS-02 后、PG-02 前，提交 `4fe4666`）、关批（指针 revision 7，`last_closed=GAP-02-consolidation`、`next=PG-02`）、ref-only 快进合并 main 并推送私有归档（main = origin/main = `1ccca4835a62668f1c7d5796deefe40b94df6227`）、公开快照（`public/main = 53a3cd298b5894026ccc9f58f3639acfafdf6900`，`snapshot: 2026-09-09 from internal 1ccca48…`，隐私探针 scanned=2039 hits=0）。
- §3 三项按执行卡 `docs/plan/IMPL-PROMPT-2026-09-09-gap-consolidation.md` §3 的建议**立项**（登记为具名候选，不在本节直接开工，不插入当前唯一串行链）：
  1. **邮件出站通道阶段 A**（方案 `docs/plan/2026-09-08-email-channel-consolidated.fable.md` §4.1；该文件截至本节仍只在主树未提交研究稿中）：owner 同意进入排产候选（该文 §5 问 1 = 是）。§5 问 2–4 按该文建议缺省登记：邮件与 ntfy 并列可选（任一配置即启用）；阶段 B 等阶段 A 用过再议；Web Push / CalDAV 不各开独立候选。开批前置：先改 04 §4 / 07 D11 / 09 §6.3（`thread_message_id` additive 迁移须走 PG-05 的可恢复点纪律）与 `docs/modules/c-control-bridge.md` C4，再以独立批卡与执行卡导入 PLAN-2；真实发送实测需 owner 提供临时邮箱 SMTP 凭据，本机不代填。
  2. **DSH D-01 实发 messages 可从 transcript 重建**（`docs/plan/2026-08-13-deepseek-harness-borrowing-assessment.fable.md` D-01）：最小形态 = 工具轮 assistant/tool 消息 digest 落 transcript + 重建断言测试；登记为 PG-04（audit-new-write-safety）开批时的同批候选，由 PG-04 执行卡决定是否纳入，不改 PG-04 现有 A-ID / scope / gate 字段。
  3. **Console WS `?token=` 明文**（`packages/console/src/lib/api.ts`）：属 PG-01B deferred `DF-REMOTE-REOPEN`，本地环回下不动；立项 = 维持该 deferred ID 归属，重开远程面时一并处理。
- 本节不授权上述三项的 commit/push/merge/deploy、真实 provider 或 SMTP 调用；各自开批时另有具名授权与完整合同。PG-02 仍为 next，未开工。

## 12. 2026-09-09 晚 研究档案入库、GAP-02 残项与 EMAIL-A-outbound 合并/实施授权

来源:owner 对执行卡 `docs/plan/IMPL-PROMPT-2026-09-09-gap-residuals.md` 候选交付的四项 checkpoint 回复「都合并,并且都按最完整的方式推进实施」。本节不编造逐字引语之外的内容,不改写上方 D17 原话,不是 D17 扩权。

登记边界:

- 已按授权执行:§1 研究档案入库(`e7a6ceb`)、§2 GAP-02 残项(`a0c82cb`)、§3 EMAIL-A canonical/代码候选(`17dd011`→`dec54d2`→`fc3c662`,E `5eb083a`)ref-only ff 入 main;主树 `git stash`(6 个旧版修改文件,stash 留存)后 `checkout main`,删除已合并的 `sd-harness-borrow` 分支与 worktree;插批 `EMAIL-A-outbound`(GAP-02-consolidation 后、PG-02 前,`1409d71`,revision 7→8)并同批收口(revision 8→9,`last_closed=EMAIL-A-outbound`、`next=PG-02`,evidence `e2e/evidence/email-a-outbound.md`)。
- 「最完整推进实施」的落地口径:邮件通道代码、canonical、批卡、单测、完整门禁均已入库;**真实 SMTP 发送仍 not_run**(需 owner 提供临时邮箱凭据,本机不代填);凭据落点沿用现役 `/api/setup/secret` → `.env.pending`(0600),未新造 OS keychain 路径;阶段 B / Web Push / CalDAV 保持 deferred。
- 本节不含 push 私有归档、公开快照、rc、部署;独立零上下文评审未具名(执行卡为直接实施路径)。PG-02 仍为 next,未开工。
