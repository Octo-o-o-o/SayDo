# 实施计划索引

`docs/plan/` 是排产与交接档案，不属于合同 canonical。合同形状仍以 `docs/09–11` 和 `docs/adr/` 为准。

## 当前入口

- `IMPLEMENTATION-PLAN-2.md`:当前唯一排产源。`AS-01-AS-02`(PG-01B 后、PG-02 前)已于 2026-09-06 收口;2026-09-09 在其后、PG-02 前插入的 `GAP-02-consolidation` 同日收口;同日晚在其后插入的 `EMAIL-A-outbound`(邮件出站阶段 A)亦已收口;指针 `active=none`、`next=PG-02`(未开工)。
- `IMPL-PROMPT-2026-09-09-gap-consolidation.md`:GAP-02-consolidation 缺口收敛批唯一执行卡(§1 SD-1/2/3 + §2 九条 + §3 默认做项)。
- `IMPL-PROMPT-ecc-as01-as02-privacy.md`:AS-01-AS-02 隐私批唯一执行卡(contract → implementation)。
- `IMPL-PROMPT-2026-09-09-gap-residuals.md`:2026-09-09 晚的研究档案入库 + GAP-02 残项 + `EMAIL-A-outbound` 执行卡(三段均已合并入 main,决策单第 12 节);证据 `e2e/evidence/gap-02-residual.md` 与 `e2e/evidence/email-a-outbound.md`。
- [工程改进统一方案 · Astra](2026-09-05-engineering-unified.astra.md) / [统一实施 Prompt](IMPL-PROMPT-engineering-unified.astra.md)：2026-09-05 的工程缺口与 ECC 交接入口；其近期组合 PG-01B → AS-01/AS-02 已于 09-05/09-06 收口，Prompt 转为历史材料，候选核验状态见方案末尾状态注。
- `MIGRATION.md`:2026-07-29 双目录合并的执行记录、路径映射与回滚说明。
- `REPO-MERGE-PROPOSAL.md`:2026-07-25 的 v2 前置方案;已由 `MIGRATION.md` 的实况执行记录 supersede。

## 专题方案

### 项目缺口治理总案（2026-08-28）

- `2026-08-28-project-gap-closure-program.md`：基于当前代码、canonical、AI 供给方案与
  customer-question corpus 的静态缺口总览，分工程质量、用户旅程、AI 供给、工具 connector、
  模拟提问五条计划，并给出逐缺口对应方案、施工包依赖、预期回报、价值测量、全生命周期
  成本、兼容/运维合同和合理性边界。该文档不是第二套排产源；owner 选中的批次仍须按其
  标准 Git 两提交本地候选流程导入 `IMPLEMENTATION-PLAN-2.md` 后才能实施，未签路线只保持候选或
  deferred。
- `2026-08-28-project-gap-owner-decisions.md`：D1–D19 的唯一签署载体；当前只有 D17 是导入
  A 级风险关闭链的必要决策，其他选择按触发线后置。第 10 节登记 2026-09-05 owner 直接提交统一实施 Prompt 后的 AS-01-AS-02 授权,不改写 D17 原话。
- `2026-08-28-project-gap-d17-import-spec.md`：D17 绑定的 PLAN-2/HANDOFF 标准 Git 导入规格与旧节点
  disposition；在当前专用 feature branch 上用 explicit pathspec 形成本地 I/E 两提交，以 clean
  validation worktree 复审。未签 D17 前只读，不能据此直接改排产源；条件包不进入当前活动队列。

### 流程收敛（2026-09-02）

- `2026-09-02-process-convergence-plan.fable.md`:把排产现势、评审制度、候选门、证据卫生与执行层路线收敛成一份方案;不是排产源,落地须导入 `IMPLEMENTATION-PLAN-2.md`。
- `2026-09-02-process-convergence-plan-IMPL-PROMPT.md`:PROC-01 实施交接 prompt(P1–P5);本文件只覆盖方案 §3.1。

### 快速启动分发（2026-09-02）

- `2026-09-02-quick-start-distribution.md`：一条命令安装（`install.sh` / `install.ps1`,官网托管）+ R2 镜像 `dl.saydo.octoooo.com` 的渠道裁决、脚本行为、版本钉住/刷新纪律、托管位置与两端实测证据。发布/分发面的独立小批,不改变 PLAN-2 串行链。

### 邮件通道评估（2026-09-08）

- `2026-09-08-email-channel-consolidated.fable.md`：owner 提出"通知调度改标准邮件服务"后，Fable 自查与 Codex 分析的交叉比对终稿。结论为邮件作 L1 出站通道（阶段 A，可排小批）与 P1 文字轮次通道下的输入 adapter（阶段 B），不替代 outbox/升级链/审批内核，不自建 IMAP/SMTP；附 Web Push / CalDAV / HTTPS+CloudEvents 三个独立候选与 owner 待决项。不是排产源;owner 决策单第 11 节已同意阶段 A 进入排产候选。

### 月度双向对账（2026-09-02）

- 报告在 `docs/review/2026-09-02-monthly-docs-commit-crosscheck.md`：R114 修复复核、08-27 之后全部变更对账、全月 SHA 解析与 commit 覆盖的机械核验、A/B/C 处置与 owner 待决。

### AI 供给普适接入（2026-08-23 起）

本专题拆成三份各自可验证的产物，合起来才是完整方案：

- `2026-08-23-ai-supply-universal-onboarding-final.fable.md`（约 2,400 行）：主方案。审计结论、
  用户旅程、架构决策、协议与自动发现设计、生态覆盖清单、分阶段计划、验收总表与风险决策点。
  该文档不是排产源；须先解除其 §0 开工门、完成 owner 决策，并由 `IMPLEMENTATION-PLAN-2.md`
  建立唯一批次坐标后才能实施。
- `ai-supply-contracts-draft/`（45,696 行 TypeScript）：合同草案，原为主方案 §4/§8 的内嵌代码块。
  可被 `tsc` 直接检查（当前 strict/NodeNext 零诊断），但**不参与构建、不是生产合同**；
  下沉 `packages/contracts` 的前置条件见该目录 README。
- `2026-08-24-ai-supply-owner-decisions.md`：主方案 §14 十项 owner 决策的可签署副本
  （原文逐字引用 + 耦合注解 + 签署栏）。这十项是当前专题的关键路径，未签前施工方不得推断。

相关评审材料在 `docs/review/`：

- `2026-08-24-ai-supply-v20-loop-diagnosis.md`：对 v1–v20 评审循环的路线诊断，
  结论为该循环不收敛，建议停止 v21（`prompts/167`）并按上述三分法改道。
- `2026-08-24-ai-supply-review-loop-archive.md`：v1–v20 共 20 轮「终审 + 回修」的过程记账，
  原为主方案 §17，已归档为过程证据，不再随方案演进。

### 工程缺口与 ECC（2026-09-05）

当前方案与 Prompt 见上方统一入口。工程缺口的成本约束和 ECC 最新隐私/恢复范围已统一，诊断、分发、供给等重叠项去重。九份被替代方案/Prompt 已移至 [归档索引](archive/2026-09-05-engineering-unified/README.md)，原路径仅跳转，不再列为平行候选。原研究与审查继续保留在 `research/`，不把旧 GREEN 当统一稿或产品验收。

### 其它借鉴评估

- `2026-09-07-soc-agent-borrowing-assessment.md`:soc-agent(`llm-net/soc-agent`,MIT)。复审结论是零借鉴点;不 supersede `docs/07` D13/D15/D18,不导入 PLAN-2。
- `2026-09-03-tailcat-borrowing-assessment.fable.md`:Tailcat(`tailscale/tailcat`)对照当前 T2/LAN 组网。结论是不能整面替换系统 Tailscale;不 supersede `docs/07` D13。
- `2026-08-13-deepseek-harness-borrowing-assessment.fable.md`:DeepSeek Harness 对照。不替换 Hopper / voiced daemon。2026-09-09 状态注:第一刀 D-01/D-05/D-02+D-14 已逐项核验并回写结论,见该文件末尾。
- `2026-09-08-deepseek-harness-sd-borrowing.md`:DeepSeek Harness 增量建议 SD-1/2/3(owner 2026-09-08 提供)。三项已于同日核验成立,随 GAP-02-consolidation 入库(journal R141/R142);「明确不提」四条核验同意无价值,不再复查。

## 历史锁版

除「当前入口」明确列出的执行卡与统一 Prompt 外，`IMPLEMENTATION-PLAN.md` 与旧 `IMPL-PROMPT*.md` 是历史交接材料。旧绝对路径、双仓措辞与当时状态只用于追溯；实际开工链以 PLAN-2 为准，运行坐标结合 `HANDOFF.md` 核验。
