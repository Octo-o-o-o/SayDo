# SayDo 600 条潜在客户提问语料最终独立对抗评审 v5

你是全新、零上下文、只读的最终对抗评审会话。仓库根目录为
`~/WorkSpace/SayDo`。只评审，不修复、不修改正式语料、不 commit。

## 隔离是有效性门

禁止读取或搜索以下路径中的任何内容：

- `research/customer-question-corpus/review/**`
- `research/codex-findings/**`
- `prompts/**`
- `logs/**`
- `history/PROCESS-JOURNAL.md`
- Git diff、status、log、commit 或其他代理输出

所有搜索命令必须使用明确允许的文件或目录。严禁对
`research/customer-question-corpus`、`research` 或仓库根目录做递归
`rg`、`grep`、`find`。需要搜索语料时，只可分别搜索：

- `research/customer-question-corpus/questions`
- `research/customer-question-corpus/contexts`
- 明确点名的 README、00、01、02、03、`validate.mjs`、`rebuild.mjs`

需要搜索产品能力时，只可明确搜索 `docs`、`packages`、`pipeline` 中必要路径。
检查构建器时直接读取 `rebuild.mjs`，不要在 corpus 根目录搜索关键词。任何命令若
意外输出禁止路径内容，立即停止并把本会话判为隔离失效，不能继续给语料裁决。

## 允许且必须读取

- `research/customer-question-corpus/README.md`
- `research/customer-question-corpus/00-能力边界.md`
- `research/customer-question-corpus/01-设计与分布.md`
- `research/customer-question-corpus/02-覆盖索引.md`
- `research/customer-question-corpus/03-频率与语义校准.md`
- 全部 12 个 `questions/*.md`，逐条覆盖 600 条
- 全部 16 个 `contexts/**/manifest.md` 与全部 source 正文
- `research/customer-question-corpus/validate.mjs` 和 `rebuild.mjs`
- 能力核对需要的 `docs/06-references.md`、`docs/08-module-design.md`、
  `docs/09-data-contracts.md`、`docs/10-voice-ux-spec.md`、
  `docs/11-ui-spec.md`、`docs/plan/IMPLEMENTATION-PLAN-2.md` 相关段落，以及
  必要的 `packages/`、`pipeline/` 代码

## 全量验收

1. 核对恰好 600 条、12 领域配额、H/M/L 配额，并在每个领域审查相对需求先验
   是否存在明显逆序。H/M/L 是专家启发式先验，不是市场概率。
2. 逐条核对 `C/D/H/R/K/S`、`F`、`B-*`、工具和上下文：
   - `D` 是首个可审阅结果，`H` 是现实世界跨度；周期动作本身要求持续运行时应为
     D4，且应有能支撑持续编排的工具；
   - 简单但罕见的 L/C1/R1 必须语义成立，不能为交叉表机械改标；
   - 直接外部 effect 的 S/B/F 必须与当前判别、签发、消费能力一致；connector 和
     登录态不能替代 S3 能力；
   - 写入、发送、发布、通知、分派、部署、支付等工具必须闭合，题面必须能判定是
     草稿还是 live 写入。
3. 全量核对 USER/LIVE/CTX 输入充分性。对每条 required claim 读取其列出的具体
   source 正文，判断语义蕴含；digest 只证明字节完整性。核对 supplemental input、
   as_of、valid_until、authority order，找出“题面比 fixture 多事实”的假闭合。
4. 核对生产力与生活管理领域、角色、目的、复杂度、周期、轮次、工具和风险交叉
   覆盖；排除娱乐。
5. 遍历全部 179,700 对问题做字符近似检查，并结合人工语义检查跨措辞重复；独立
   核对 validator top-10。
6. 检查自然度：分别统计 H/M/L 问句率、长度、开头模式，逐题找 fixture 枚举、
   required-claim 合同或验收规范被说进客户嘴里的痕迹。不能把问号数量当作自然度
   本身。
7. 审查构建器与 validator 的诚实边界：配额、digest、显式 ID 基线、周期工具、
   staged promotion、可捕获失败回滚与 top-N；不得把进程崩溃原子性、市场概率或
   通用语义理解写成已证明。

## 证据与裁决

- 真实运行 `node research/customer-question-corpus/validate.mjs`，记录紧跟命令取得的
  退出码与原始关键输出。
- 可以运行只读统计。只读沙箱不允许 mutation 或临时文件时必须写“未验证”，不得
  据此判通过。
- 每个事实性发现给出 ID、`file:line`、source 或真实命令证据。
- A：能力误导、风险失真、RAG 假闭合、数量/合同破坏或显著概率逆序，必须修。
- B：明显工具、标签、覆盖、自然度、重复或 validator 缺口，应修。
- C：增强或无法由本轮证明的限制。
- 有任何 A/B 则 `[fail]`；只有没有 A/B 才 `[pass]`。

报告必须包含方法、全量计数、发现、RAG/能力/去重结论、命令证据、已验证与未验证
边界、最终裁决。最终报告由调用方通过 `-o` 写入：
`research/codex-findings/175-customer-question-corpus-final-independent-review-v5.md`。
