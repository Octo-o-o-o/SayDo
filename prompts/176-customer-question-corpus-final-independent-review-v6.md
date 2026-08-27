# SayDo 600 条潜在客户提问语料返工后最终独立对抗评审 v6

你是全新、零上下文、只读的最终对抗评审会话。仓库根目录为
`~/WorkSpace/SayDo`。只评审当前结果，不修复、不修改正式语料、不
commit，不参考任何旧评审或修复过程。

## 隔离有效性门

禁止读取或搜索：

- `research/customer-question-corpus/review/**`
- `research/codex-findings/**`
- `prompts/**`
- `logs/**`
- `history/PROCESS-JOURNAL.md`
- Git diff、status、log、commit 或其他代理输出

所有搜索必须点名允许的文件或目录。严禁对
`research/customer-question-corpus`、`research` 或仓库根目录做递归
`rg`、`grep`、`find`。语料搜索只可分别指向 `questions`、`contexts`，或明确点名
README、00、01、02、03、`validate.mjs`、`rebuild.mjs`。能力搜索只可明确指向
`docs`、`packages`、`pipeline` 的必要路径。任何命令若意外输出禁止路径内容，立即
停止并判隔离失效，不能继续给语料裁决。

## 必须读取

- corpus 的 README、00-能力边界、01-设计与分布、02-覆盖索引、03-频率与语义校准
- 全部 12 个 `questions/*.md`，逐条覆盖 600 条
- 全部 16 个 `contexts/**/manifest.md` 与 50 个 source 正文
- `validate.mjs`、`rebuild.mjs`
- 能力核对必要的 `docs/06-references.md`、`docs/08-module-design.md`、
  `docs/09-data-contracts.md`、`docs/10-voice-ux-spec.md`、`docs/11-ui-spec.md`、
  `docs/plan/IMPLEMENTATION-PLAN-2.md` 相关段落，以及必要的 `packages/`、`pipeline/`
  代码

## 全量验收

1. 核对恰好 600 条、12 领域和各域 H/M/L 配额；逐领域查明显相对概率逆序，长期
   成熟自动化不能机械混入高频。H/M/L 是专家启发式，不冒充市场统计。
2. 逐条核对 `C/D/H/R/K/S/F/B`：D 是首个可审阅结果，H 是未来现实周期，R 是真实
   交互轮次；周期任务须有相称的持续调度、状态或监控工具。
3. 全量核对工具、USER/LIVE/CTX 和 draft/live effect。发送、发布、通知、写入、
   分派、部署、支付、生产数据变更等须有正确 S/F/B、授权、预览、回滚或消费边界；
   connector、登录态和用户首句不等于 S3 能力或正式收据。
4. 逐条对照 172 个 required claim 与其列出的 source 正文；判断实际语义蕴含、
   supplemental input、authority、as_of/valid_until。特别检查是否仍存在只换词、
   复制题面或包级主题的伪逐题 claim；digest 和字符串唯一性不证明事实闭合。
5. 遍历全部 179,700 对做字符近似，并人工查跨领域同构；不能只复述阈值。核对
   validator top-10。
6. 统计 H/M/L 问句率、长度、开头模式；逐条找 fixture/验收合同口吻、异常长句、
   内部术语和不自然客户表达。安全约束可以存在，但不能把整份 manifest 塞进用户
   原话。
7. 核对生产力与生活管理覆盖并排除娱乐；核对敏感经营、客户、财务、安全、医疗、
   法律、身份、隐私和归因边界。
8. 审查 rebuild/validator 的诚实边界：类别规则、显式基线、逐题 claim、staged
   promotion、可捕获失败回滚与断电边界。不能把 fixed baseline 当语义证明。

## 证据与裁决

- 真实运行 `node research/customer-question-corpus/validate.mjs`，记录紧跟命令取得的
  退出码和关键原始输出。
- 只读统计可以运行；禁止 mutation 与 rebuild。不能实测的写“未验证”。
- 每个事实性发现必须给 ID、`file:line`、source 或代码/命令证据。
- A：能力误导、风险失真、RAG 假闭合、数量合同破坏或显著概率逆序。
- B：明确工具、标签、输入、覆盖、自然度、重复或 validator 缺陷。
- C：增强或本轮无法证明的限制。
- 有任一 A/B 则 `[fail]`；只有没有 A/B 才 `[pass]`。不要为了显得严格把可解释差异
  判成缺陷，也不要用 validator 绿代替语义判断。

报告必须包含方法、全量计数、发现、RAG/能力/去重/自然度结论、命令证据、已验证
与未验证边界、最终裁决。最终报告由调用方通过 `-o` 写入：
`research/codex-findings/176-customer-question-corpus-final-independent-review-v6.md`。
