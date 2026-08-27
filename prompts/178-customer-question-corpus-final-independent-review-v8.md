# SayDo 600 条潜在客户提问语料 v8 最终独立对抗评审

你是全新、零上下文、只读的最终对抗评审会话。仓库根目录为
`~/WorkSpace/SayDo`。只评审当前结果，不修复、不修改正式语料、不
commit，不参考旧评审或实施过程。

## 隔离门

禁止读取或搜索：corpus `review/**`、`research/codex-findings/**`、`prompts/**`、
`logs/**`、`history/PROCESS-JOURNAL.md`、`test-mutations.mjs`、Git 状态/历史/diff 及
其他代理输出。严禁对 corpus 根、research 根或仓库根做递归搜索。语料搜索必须分别
点名 questions、contexts、contracts，或明确文件 README、00–04、validate/rebuild；
能力搜索只指向必要 docs/packages/pipeline。意外读到禁止内容即判隔离失效。

## 必须读取与验收

1. 读取 corpus README、00–04、12 个 questions、16 个 manifest 与 50 个 source、
   全部 live/F1 contracts、validate/rebuild，以及必要 canonical 与能力代码。
2. 核对 600 条、12 域、各域 H/M/L；逐域查长期自治/重大转型的显著先验逆序。
3. 逐条核对 C/D/H/R/K/S/F/B；D 是实际安全首个可审阅结果，H 是未来现实跨度，
   R 是交互轮次；F1 仅限缺省 coding/workspace；持续语义与 D4/工具应一致。
4. 逐条核对全部 465 个 LIVE contract 与 986 个对象来源，不可抽样：题面实体、
   locator/connector、字段、reader tools、authority、freshness、授权范围必须语义对应。
   特别找自动模板、虚构 locator、通用 reader、工具存在但无法读取对象、把 USER
   输入冒充现势来源。字段非空、摘要和集合全等不证明闭合。
5. 全量核对 CTX+LIVE 与 manifest supplemental；逐条对照 172 claim 与 50 source
   正文的实际蕴含、临时条件归因、authority、as_of/valid_until。
6. 全量核对敏感经营/客户/员工/财务/安全、医疗/法律/身份/隐私/归因，以及所有
   外部 effect 的 S/F/B、授权、草稿、回滚与消费边界。connector/用户首句不是 S3
   能力或正式收据。
7. 遍历 179,700 对字符近似并人工查跨域同构；统计 H/M/L 自然度、长度、开头、
   验收合同口吻；核对生产力/生活覆盖与娱乐排除。
8. 审查 validate/rebuild 的诚实边界、显式 contract、staged promotion 与回滚边界；
   fixed baseline 只防漂移，不能作为语义证明。

## 证据与裁决

- 真实运行 `node research/customer-question-corpus/validate.mjs`，记录紧跟命令取得的
  退出码和关键原始输出。
- 只读统计可以运行；禁止 mutation 和 rebuild；不能实测的写未验证。
- 每个发现给 ID、file:line、source 或代码/命令证据。
- A：能力误导、风险失真、RAG 假闭合、数量合同破坏或显著概率逆序。
- B：明确工具、标签、输入、覆盖、自然度、重复或 validator 缺陷。
- C：增强或本轮无法证明的限制。
- 任一 A/B 即 `[fail]`；没有 A/B 才 `[pass]`。不要为严格而误判合理差异，也不能
  用 validator 绿替代语义判断。

报告包含方法、全量计数、发现、RAG/能力/去重/自然度结论、命令证据、验证边界与
最终裁决。最终报告由调用方通过 `-o` 写入：
`research/codex-findings/178-customer-question-corpus-final-independent-review-v8.md`。
