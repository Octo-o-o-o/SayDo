# SayDo 600 条潜在客户提问语料最终独立对抗评审 v3

你是一个全新、零上下文的只读对抗评审会话。仓库根目录是
`~/WorkSpace/SayDo`。本轮只评审，不实施修复、不 commit、不修改正式语料。

## 隔离要求

先完整阅读仓库适用的 `AGENTS.md`。禁止读取以下内容，以免继承实施者或旧评审的推理：

- `research/customer-question-corpus/review/` 下全部既往报告；
- `research/codex-findings/` 下全部既往报告；
- `prompts/` 下除本 prompt 外的文件；
- `logs/`；
- `history/PROCESS-JOURNAL.md`；
- Git diff、status、log 或 commit 信息；
- 任何其他代理的消息或输出。

允许并要求读取：

- `research/customer-question-corpus/README.md`、`00-能力边界.md`、`01-设计与分布.md`、`02-覆盖索引.md`、`03-频率与语义校准.md`；
- 全部 12 个 `questions/*.md`，必须逐条覆盖 600 条；
- 全部 `contexts/**/manifest.md` 和所有 source 正文；
- `research/customer-question-corpus/validate.mjs` 与 `rebuild.mjs`，但不要把其中的显式基线当成语义正确性的证据；
- 为核对当前能力所需的 `docs/06-references.md`、`docs/08-module-design.md`、`docs/09-data-contracts.md`、`docs/10-voice-ux-spec.md`、`docs/11-ui-spec.md`、`docs/plan/IMPLEMENTATION-PLAN-2.md` 相关段落，以及必要的 `packages/`、`pipeline/` 实际代码。

## 评审目标

请对最终语料做一次真正独立、全量、对抗性的验收。不能只抽样后对全体下结论。

1. 核对恰好 600 条、12 个领域配额、H/M/L 配额与领域内相对可能性。H/M/L 是专家启发式先验，不是市场概率；检查是否仍有明显先验倒置。
2. 逐条核对 `C/D/H/R/K/S`、`F`、`B-*`、工具列表和上下文模式是否与题面及目的一致。特别关注：
   - `D` 首次可审阅结果与 `H` 现实世界跨度是否混淆；
   - 周期性自动巡检、提醒、通知、调度是否为 `D4/H4`；
   - 外部写入、发布、通知、支付、删除、授权、专业判断是否正确标为 `S2/S3` 与对应边界；
   - F1 当前内建、F2 connector/人协作、F3 实验方向、F4 越界拒绝是否符合代码和 canonical，而非愿景。
3. 全量核对 USER/LIVE/CTX 输入充分性。题面出现“这些、我的、当前、最新、三份、自动、持续、直接”等依赖时，不能凭空开始。
4. 对每个 context 的每个 supported question，逐项读取 required claim 指定的 source 正文，判断 source 是否真的蕴含 claim；digest 只证明字节完整性，不证明语义蕴含。核对 supplemental input、as_of、valid_until 和 authority order。
5. 核对生产力与生活管理覆盖、角色、目的、复杂度、轮次、周期、工具链和风险是否分布合理；排除娱乐用途。
6. 对全部 179,700 对问题做字符近似检查，并结合人工语义检查发现跨措辞重复；核对 validator 输出的 top-10，但不要把字符 Dice 当语义去重的替代品。
7. 检查自然度：真实客户是否会这样问，是否仍像验收合同；分别统计 H/M/L 的问号、句长、常见模板开头，并点名问题 ID。
8. 审查构建器和 validator 的诚实边界：配额、digest、显式 ID 基线、staged promotion、caught-failure rollback、top-N 是否实现；不要把未测试的进程崩溃原子性或语义理解写成已证明。

## 命令与证据

- 真实运行 `node research/customer-question-corpus/validate.mjs`，记录退出码和关键原始输出。
- 可运行任意只读统计脚本或命令。若只读沙箱不允许创建临时文件或执行 mutation，必须如实写明“未验证”，不得据此判通过。
- 对事实性结论给出 `file:line`、问题 ID、source 路径或真实命令输出。
- 不得依据 validator 自称通过就判定语义通过。

## 分级与输出

- A：会导致能力误导、风险失真、RAG 假闭合、数量/合同破坏或显著概率倒置，必须修。
- B：明显的工具、标签、覆盖、自然度或语义重复问题，应修。
- C：可选增强或目前无法证明的限制。

若存在任何 A/B，结论写 `[fail]`；仅当没有 A/B 才写 `[pass]`。报告必须包含：方法、全量计数、逐类发现、命令证据、已验证与未验证边界、最终结论。不要给模糊“整体不错”代替裁决。

最终报告由调用方通过 `-o` 写入：
`research/codex-findings/173-customer-question-corpus-final-independent-review-v3.md`。
