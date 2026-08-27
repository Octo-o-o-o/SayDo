# SayDo 600 条潜在客户提问语料 v7 最终独立对抗评审

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
- `research/customer-question-corpus/test-mutations.mjs`
- Git diff、status、log、commit 或其他代理输出

所有搜索必须点名允许的文件或目录。严禁对 corpus 根目录、`research` 或仓库根目录
递归 `rg`、`grep`、`find`。语料搜索只可分别指向 `questions`、`contexts`，或明确
点名 README、00、01、02、03、`validate.mjs`、`rebuild.mjs`。能力搜索只可明确
指向 `docs`、`packages`、`pipeline` 的必要路径。命令若意外输出禁止路径内容，立即
停止并判隔离失效。

## 必须读取与全量验收

1. 读取 corpus README、00/01/02/03、全部 12 个 questions 文件、全部 16 个
   manifest 与 50 个 source、validate/rebuild，以及能力核对必要的 docs、packages、
   pipeline。
2. 核对恰好 600 条、12 领域和各域 H/M/L；逐域查相对概率逆序，长期自治、重大
   转型和成熟自动化不能机械高频。H/M/L 只是专家启发式。
3. 逐条核对 C/D/H/R/K/S/F/B：D 是首个可审阅结果，H 是未来现实跨度，R 是交互
   轮次；F1 只能覆盖当前缺省 coding/workspace；D4 要有相称持续工具。
4. 对全部 LIVE 与 CTX+LIVE 逐题判断 reader 是否真正读取题面所需对象。不能把
   rag/document/pdf、automation/notification 或固定 ID 例外当万能现势来源；需要
   用户资料时 USER 与 supplemental 必须闭合。
5. 逐条对照 172 个 required claim 与 source 正文，检查实际蕴含、题面临时条件的
   正确归因、supplemental、authority、as_of/valid_until。source contract、digest、
   exact baseline 只证明登记与漂移，不能替代人工语义判断。
6. 全量核对敏感经营、客户、员工、财务、安全、医疗、法律、身份、隐私、归因及
   所有外部 effect 的 S/F/B、授权、草稿、回滚和消费边界；connector/用户首句不等于
   S3 能力或正式收据。
7. 遍历全部 179,700 对字符近似，并人工查跨领域同构；核对 validator top-10。
8. 统计 H/M/L 自然度、长度、开头，逐条找 fixture/验收合同口吻、异常长句、内部
   术语；核对生产力与生活覆盖并排除娱乐。
9. 审 rebuild/validator 的诚实边界：显式 source/capability/risk contract、staged
   promotion、可捕获回滚与断电边界；不能把固定 baseline 当语义证明。

## 证据与裁决

- 真实运行 `node research/customer-question-corpus/validate.mjs`，记录紧跟命令取得的
  退出码和关键原始输出。
- 只读统计可以运行；禁止 mutation 与 rebuild。不能实测的写“未验证”。
- 每个发现给 ID、`file:line`、source 或代码/命令证据。
- A：能力误导、风险失真、RAG 假闭合、数量合同破坏或显著概率逆序。
- B：明确工具、标签、输入、覆盖、自然度、重复或 validator 缺陷。
- C：增强或本轮无法证明的限制。
- 任一 A/B 则 `[fail]`；只有没有 A/B 才 `[pass]`。不要为显得严格误判合理差异，
  也不能用 validator 绿代替语义判断。

报告必须包含方法、全量计数、发现、RAG/能力/去重/自然度结论、命令证据、已验证
与未验证边界、最终裁决。最终报告由调用方通过 `-o` 写入：
`research/codex-findings/177-customer-question-corpus-final-independent-review-v7.md`。
