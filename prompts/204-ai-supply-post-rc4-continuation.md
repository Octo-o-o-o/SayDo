# AI 供给普适接入专题 · RC4 收口后续接 Prompt（2026-08-25）

你是一个对本专题零上下文的新会话。这份 prompt 加上它点名的文档，就是你的全部依据。

> **前置**：本 prompt 只在 **RC4 发布线收口之后**启用。启用前先做 §0 的门检查；
> 任一门未过就停下报告 owner，**不要开始**。RC4 的交接见 `prompts/203-rc4-long-session-handoff-to-new-codex.md`
> —— 该文件在 2026-08-25 时是**未跟踪**状态（属 RC4 线的工作文件，本线未擅自入库）；
> 若 RC4 收口时已入库或删除，以届时实况为准。

## 0. 启用门（逐条实测；任一红 = 停，上浮）

1. **RC4 已收口**：
   ```bash
   git cherry main codex/rc4-release-second-red-rebuild | grep -c '^+'
   git cherry main codex/rc4-mobile-readiness-fix | grep -c '^+'
   git tag --list 'v0.1.0-rc.4'
   ```
   预期：前两条均为 `0`（两线已并入 main）；第三条能列出 `v0.1.0-rc.4`。
   2026-08-25 实测时分别为 `8`、`6`、空 —— 那时 RC4 未收口，故本 prompt 当时不可启用。
2. **active pointer 已释放**：
   ```bash
   grep -n '当前批次指针' HANDOFF.md | head -1
   ```
   预期为空或明确标注 RC4 已收口。若仍是 `w54b-wiring`，先按
   `docs/plan/IMPL-PROMPT-16-W54B-CLOSEOUT.md` 处置（注意该文件头部有「当前不可执行」
   前置警告块，需先确认其五条阻断已解除）。
3. **门禁绿**：`just ci` exit 0（退出码显式核查，禁止管道取尾）。
4. **工作树可用**：`git status --porcelain` 中不含你不认识的在途改动。
   2026-08-25 时主工作区有 16 个 `deploy/saydo-octoooo-com/` 官网文件改动属他人在途工作，
   **不要清理、不要提交、不要顺手整理**。

## 1. 你要接手的是什么

一份 **AI 供给普适接入与零配置引导** 的专题方案。它已经过 20 轮对抗评审、
一次结构手术和四项 owner 决策签署，但**尚未实施任何生产代码**。

必读，按此顺序：

1. `docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`（2,484 行）
   —— 主方案。**先读它开头的「本文档的组成」与「owner 决策状态」两节**，那里说明了
   本专题被拆成三份产物、以及四项已签决策如何改变了范围。
2. `docs/plan/2026-08-24-ai-supply-owner-decisions.md`（349 行）
   —— 十项 owner 决策的签署状态。四项已签、五项预填待确认、一项建议暂缓。
3. `docs/review/2026-08-24-ai-supply-v20-loop-diagnosis.md`（171 行）
   —— **为什么停止 v21**。读它才能理解为何不该继续「再评审一轮」。
4. `docs/plan/ai-supply-contracts-draft/README.md`
   —— 45,696 行合同草案的构成，以及 v20 十一条 A 级 finding 到具体文件的映射。
5. `docs/review/2026-08-25-agent-cli-acp-capability-survey.md`（195 行）
   —— ACP 生态实证，决策 2 的依据。
6. `docs/review/2026-08-24-decision-2-impact-analysis.md`（215 行）
   —— Codex `exec` vs `app-server` 的实证对比与 D8 张力分析。

过程记录见 `history/PROCESS-JOURNAL.md` 的 **R98–R108**（AI 供给线；
R94–R97 是同期的 RC4 线，两者无关）。

## 2. 四项已签决策如何改变了范围（这是你最需要先消化的）

| 决策 | 裁决 | 对你的影响 |
|---|---|---|
| **1 排产坐标** | 先收口 `w54b-wiring`，再排本专题 | 你的第一件事是 §3 阶段 A 的排产，不是写代码 |
| **2 Codex/ACP** | **引入 ACP 适配层**；Codex 沿用 `codex exec`，不为其单独建平面 | §10 Phase 5 须按协议（`acp`/`app_server`/`cli_stdio`）重组，取代现有九个品牌子批 |
| **6 付费边界** | 双双关闭 | 按方案原文执行，无额外动作 |
| **7 扩展交付边界** | **首发只开放内置受信 connector**，第三方声明式 pack 一并推迟 | **本轮最大减重**，见下 |

**决策 7 的连带推迟清单**（这些本轮都不做，不要收敛它们的合同）：

- §4.10 参考实现级扩展内核**整节**（三种扩展交付级别、plugin sandbox、TCK 分发信任）
- 决策 8 的 TUF 双 root registry
- Connector SDK 对外发布（决策 9 的 `v1alpha1` 时间点顺延）
- §9.8 生态包与扩展成本策略
- 草案中 `docs/plan/ai-supply-contracts-draft/` 下 `03-extension-points.ts`、
  `06-sdk-compat.ts` 及 `08-wire-budget.ts` 的相当部分

## 3. 分阶段任务

### 阶段 A · 排产（不写代码）

按决策 1，在 `docs/plan/IMPLEMENTATION-PLAN-2.md` 为本专题建立具名坐标：

- 记录基线 HEAD 与主方案文件的 SHA-256；
- **按决策 7 收缩后的范围**切子批，不要按方案原文的 Phase 0–8 全量排；
- 在 `HANDOFF.md` §1 开启新 pointer。

**验收**：PLAN-2 有本专题的具名批次、依赖与验收；`HANDOFF.md` pointer 指向它；
`node scripts/check-doc-links.mjs` broken=0。

### 阶段 B · 重新界定本轮真实下沉范围

决策 7 生效后，合同草案里有相当部分本轮用不上。**先算清楚要下沉多少，再动手。**

- 逐个文件判断 `docs/plan/ai-supply-contracts-draft/*.ts` 本轮是否需要；
- 对需要的部分，核对 v20 十一条 A 级 finding 中哪些仍然适用
  （§4.10 相关的若干条会因决策 7 而本轮无关）；
- 产出一份「本轮下沉清单 + 仍需修复的 A 级清单」，**这份清单是后续所有工作的依据**。

**验收**：清单落盘到 `docs/plan/`；每个「本轮不下沉」的判断都写明依据（哪条决策）。

### 阶段 C · 修复仍适用的 A 级 finding

按阶段 B 的清单逐条修。**注意：修的是合同草案，不是继续写文档评审。**

修完的判据是 `tsc` 与后续的真实测试，不是「又一轮零上下文评审说 PASS」——
诊断报告 §2 已证明那条路不收敛（20 轮、A 级计数在 1–9 间随机游走）。

**验收**：草案在 strict/NodeNext 下 tsc 零诊断；每条 finding 的修复有对应的类型级反例
（负例编译失败）或测试。

### 阶段 D · 下沉 `packages/contracts` 并按 Phase 实施

到这一步才开始碰生产代码。按 PLAN-2 的子批推进，遵循方案 §10 各 Phase 的
「验收标准」——但先读 §10 开头的「本节各 Phase『验收标准』的定位」，
那 327 条是 gate 脚本的规格，不是人工 checklist。

## 4. 红线

1. **不要再起新一轮「三路零上下文终审」**。那条路已经证明不收敛，理由见诊断报告。
   需要评审时，评审对象应是**真实代码 + 测试**，不是 Markdown 里的类型体操。
2. **不要收敛决策 7 已推迟的部分**（§2 的清单）。写了也是白写。
3. **未签的决策不由施工方推断**（§14 原文）。决策 3/4/5/8/9 是 Claude 预填的草案，
   决策 10 建议暂缓；需要它们时先上浮 owner，不要自行采纳预填值。
4. **不要动主方案的 §17 与 `docs/review/2026-08-24-ai-supply-review-loop-archive.md`**
   —— 那是 v1–v20 的过程存档，不随方案演进。
5. **保全过的产物不要删**：`prompts/` 下 72 份、`research/codex-findings/` 下 71 份
   是过程证据，已入库；其中的绝对路径已在 `85b0470` 脱敏，原件可从 `57819ad` 恢复。
6. 禁止 `git add -A`；只有 owner 明确要求时才 commit/push。

## 5. 诚实汇报

- 三级词表：**已实现且测试绿 / 已实现未验 / 未做**；对账用
  `[ok]` / `[warn]` / `[fail]` / `[divergent]`。
- 每个「完成」给证据：commit hash 来自本会话真实 `git log`，测试附命令与原始输出摘录。
- 若发现本 prompt 的断言与实测不符（尤其 §0 的预期值），**如实报告，不要默默适配**。
- 本专题的历史教训就是「文档写了 ≠ 做到了」：20 轮评审产出 4.8 万行合同、
  零行生产代码。不要重复它。

## 6. 工作方式

- 从 `main` 起新分支（阶段 A 的排产结果决定分支名）。
- 阶段 A/B 是文档与判断工作，可自治推进；**阶段 C 开始前把阶段 B 的清单贴给 owner 确认**。
- 阶段 D 碰生产代码，按 PLAN-2 子批与 `just ci` 门禁推进，实施与评估会话零上下文隔离。
- 遇到与 RC4 或其他线的坐标冲突：停下上浮，不要自行裁决。
