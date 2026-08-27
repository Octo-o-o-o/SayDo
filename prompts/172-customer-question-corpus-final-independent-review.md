# SayDo 600 条潜在客户生产力提问语料最终独立对抗审查

你是绝对隔离、未参与生成和修复的对抗审查者。仓库为 `~/WorkSpace/SayDo`。本轮只读，不得修改任何正式文件，不得 commit。

## 独立性边界

必须读取仓库根 `AGENTS.md`（若存在）和以下正式输入：

- `research/customer-question-corpus/README.md`
- `research/customer-question-corpus/00-能力边界.md`
- `research/customer-question-corpus/01-设计与分布.md`
- `research/customer-question-corpus/02-覆盖索引.md`
- `research/customer-question-corpus/03-频率与语义校准.md`
- `research/customer-question-corpus/questions/*.md` 全部 12 个文件
- `research/customer-question-corpus/contexts/README.md`
- `research/customer-question-corpus/contexts/CTX-*/manifest.md` 全部 16 个 manifest
- 每个 manifest 登记的全部来源文件
- `research/customer-question-corpus/validate.mjs`
- `research/customer-question-corpus/rebuild.mjs`
- 为核实能力边界所必需的 canonical、当前实现与 `HANDOFF.md`

严禁读取以下目录或文件，以免继承既往结论：

- `research/customer-question-corpus/review/`
- `research/codex-findings/`
- `prompts/` 中除本 prompt 之外的文件
- `history/`
- `logs/`
- Git diff、Git status 或任何工作区变更历史

报告开头列出实际读取范围，并明确是否误触禁读内容。若误触，必须披露，且结论不能被称为零上下文终审。

## 必做检查

1. 独立解析 600 条记录，确认固定文件集、12 个领域与 600 个唯一 ID；完整审查领域、行业、客户角色、组织形态、生命周期、生活生产力及非娱乐边界。
2. 逐条核对 H/M/L、C/D/H/R/K/S、工具、USER/LIVE/CTX、F1-F4 与 B-* 的语义；重点全量回读 S0、S3、F1、F4、K0、K4、CTX-only，不得抽样代替全体判断。
3. 对全部 179,700 对问题做近重复候选计算，并人工裁决高相似候选；寻找跨措辞同构，不得只依赖字符阈值。
4. 对 16 个 context、全部引用边、required claims 和所有来源正文逐包核对。必须判断每条 claim 是否真的由登记来源支撑，以及缺失事实是否正确落在 USER/LIVE，不能用摘要、文件存在或集合对称性冒充语义闭合。
5. 独立核验 `00-能力边界.md` 与 canonical/当前实现，尤其当前 Tier1 route、writing 类型门、外部 connector、长任务和 F1/F2/F3/F4 口径。
6. 检查 `rebuild.mjs` 是否先在完整暂存树验证，并对可捕获的第 3 次 rename 失败执行真实故障注入；核对正式 `questions/` 与 `contexts/` 前后逐文件摘要完全不变。不要把断电/进程强杀场景误报为已保证。
7. 在隔离临时副本执行至少四类 mutation：直接群发却保留 S0、工具错配、required claim 漂移或无关长句、来源空白；记录每个真实退出码。不得修改正式语料。
8. 运行正式命令 `node research/customer-question-corpus/validate.mjs`，记录真实退出码和末行。运行限定语料范围的 emoji 门，记录真实退出码。
9. 检查说明文档是否诚实区分：专家频率先验与市场概率、场景清单与多轮 benchmark、摘要完整性与 claim 语义真实性、可捕获回滚与进程崩溃原子性。

## 裁决格式

- 问题分 A/B/C：A 为会导致能力误导、安全低标、关键输入假闭合、构建半更新，或使语料不能按标签/覆盖使用的阻断项；B 为重要质量缺口；C 为表达或维护性问题。
- 每项必须给具体 ID、文件与行号、实际读到的文本、影响和最小修复；不得只给笼统意见。
- 清楚列出已通过项和 validator 仍不能证明的范围。
- 最终结论只能是 `[pass]`、`[pass-with-warnings]` 或 `[fail]`。结构门绿色不能自动推导终审通过。
- 全文使用简体中文，不使用 emoji；标记只用 `[ok]`、`[warn]`、`[fail]`。
