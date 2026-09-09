# ECC 调研与双项目方案：评审和交付核验

> 本轮文档结论：独立 R3 GREEN；最终本地门禁 9/9；5 个 P1、3 个 P2 均已关闭。此结论针对文档与可行性，不代表产品功能已实施、托管 CI 已通过或建议已获排产授权。

## 产物与范围

- ECC 详细调研报告：SayDo `research/ecc/2026-09-05-ecc-project-research.md`；ContextView 同名研究副本。
- SayDo 借鉴方案：SayDo `docs/plan/2026-09-05-ecc-borrowing-plan.md`。
- ContextView / Contexpect 借鉴方案：ContextView `docs/research/2026-09-05-ecc-borrowing-plan.md`；SayDo 保留调研档案。
- 118 个具体源码/合同证据条目、12 个测试证据记录。最终正文去除本次证据状态头后，与 R3 只读核验稿逐字节一致。
- 已覆盖全部顶层目录清单和主要运行时路径；翻译、二进制、锁文件及大量技能正文采用计数/抽样。没有宣称逐行读完 3520 个文件。

## 独立评审轨迹

| 轮次 | 结论 | 问题及处置 |
| --- | --- | --- |
| R1 | RED，4 P1 | 纠正 Codex native/legacy hook 与 MCP 分层；取消会触发 foreign-map 的 overlay 文件承诺；分开自有 Apache 合成与真实 MIT 条件包；固定 SayDo `import → candidate` 正式账本路径。 |
| R2 | RED，新增 1 P1 | 明确认可前 4 项闭合；补齐 ContextView 同目录报告、证据索引与目录入口。 |
| 最终 P2 sweep | 唯一一次 | 规则数量口径、包装进程与子测试退出状态、`sourceRevision` 类型编码三项校正。 |
| R3 | GREEN，无 P0/P1，3 P2 fixed | 4 个接收文件 SHA、10 个相对链接、118 source 与 12 test 条目有效；前次技术结论无回归。 |

实施与评估分属独立会话；每个候选只有一名 reviewer。实施使用 Grok 4.6 xhigh，review 使用 gpt-5.6-sol max，3 次 reviewer 均全新零上下文。R1/R2 归档去除了本机绝对路径，行号指当轮冻结稿；原件 hash 与本轮日志收据保存在任务工作区。R3 原结论没有语义改写。

## 固定坐标与真实终态

- ECC 源码 HEAD：`e04ea0b9cc8248686edf5ac751cadff550e162b8`，源码包标 2.2.1；研究时 npm 发布坐标为 2.2.0。
- SayDo 基线 HEAD（本会话 git log）：`bcf8ea855f25b177888d9159f75e49214f3dd892`。
- ContextView 基线 HEAD：`3ae72e47ae2b770dabd31b5948736fc38a5e45ef`，研究读取了包含未提交规范/验收基线的隔离工作副本，没有把 HEAD 当全文。
- R3 语义候选 git-diff-v1：`7089536f83a122527091f8a2bff75306c6a7a62935693bfd5affde7977652e44`。
- `validate_review_manifest.py` 原始输出：`"status": "valid", "next_action": "full_gate"`。
- `cycle_control.py --finalize` 原始输出：`"status": "finalized"`。冻结收据见 SayDo `research/ecc/workflow-final.json`。
- 后续变化仅为评审状态头、评审/日志收据与目录同步；交付状态头不改变冻结正文。未 commit、push、安装 ECC、改产品代码或排产源。

## 最终门禁

在 R3 语义 GREEN 后运行：`git diff --check`、`bash scripts/check-emoji.sh`、本次源码证据/日志 hash/最终引用核验，以及 ContextView 六条 required gate：

```text
python3 scripts/check_docs.py
python3 scripts/check_acceptance.py --structure
python3 scripts/check_acceptance.py --traceability
python3 scripts/check_acceptance.py --corpus
python3 scripts/check_semantic_team.py
TMPDIR=/tmp python3 -m unittest discover -s tests/acceptance -p 'test_*.py'
```

原始输出摘录：

```text
check_docs.py PASS
check_acceptance.py --structure PASS
traceability statements: 249
traceability rows: 249
check_acceptance.py --traceability PASS
static coordinates meeting >=60: 19/19
declared oracles: 2
doctor cases: 589 clean=125 lookalike=208 issue=256
check_acceptance.py --corpus PASS
check_semantic_team.py PASS
Ran 144 tests in 87.079s
OK
{"passed": 9, "total": 9}
```

| 门禁 | exit | 原始日志 SHA-256 |
| --- | --- | --- |
| diff-check | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| emoji-check | 0 | `e97ffbbcc1ec2da64acb2b45cd94178bfa0703a13878c9345ab3f93ff96d7da3` |
| research-evidence | 0 | `fad83e18836eed4b7407e75993a7e6efa3a901e4416a3e819a687e1d257eff91` |
| context-docs-structure | 0 | `6d1060fc4133d300a7c29724624c955a79cb035673a4e59e1de9e4ed844eb40b` |
| context-acceptance-structure | 0 | `bb5dd7c4f07430849cfa6330488c1c2798b4d6188295fa026eb27e1e97c7a78c` |
| context-traceability | 0 | `232a4f4acd0ec1d6bf33f45f96a698ce84ef155c23556c2f4a983aec05909887` |
| context-corpus | 0 | `3719f72a2e0107174ca73594dbbc7f1fd33e6d447d6acffb84f047a88b15123e` |
| context-semantic-team | 0 | `22b8e7a0bd3e11fd438235f2cd7debad9060c369dc525aa3f8aee4de0b497be9` |
| context-negative-tests | 0 | `066f11387001092d0fa8c3e4089eeb8e379b05fa77446459a967950ad00ddb5f` |

本任务是文档调研阶段，上表是预先冻结的阶段合同。没有运行 SayDo 产品 `just ci` / Playwright，也没有声称托管 CI 等效。ECC 抽样 16 个测试文件中 14 个通过，2 个因缺依赖失败；原报告保留失败，未运行 ECC 全量 `npm test`、Rust 或真实宿主集成。

## 日志档案

下列为本轮任务日志（不入 Git），只登记名称、字节与 SHA-256。ECC 测试的三份原日志额外记于 evidence index；没有修改它们。

| 日志 | 字节 | SHA-256 |
| --- | --- | --- |
| implementation-r1.log | 4503251 | `01455b8249462c7bf0736de1de3638a6a5cbf0abee9f4f61518ee658962f5ca4` |
| review-r1.log | 3841225 | `07fafa449d535ecbe6a1bf06d38fe4c7e0294d6f746848272e106699aa192d5c` |
| repair-r1.log | 1890004 | `cf12bbf2bf8af6c414418819f42cee4c3cfd0898c6a29edbda78168aa1f7aa62` |
| review-r2.log | 1802470 | `fe039a62ef8cf6515bfb1c8eeb5e8d31b76108391bd40303a29b9275df975818` |
| review-r3.log | 428605 | `7eeed2f97b39fc08a4340886955bc76f024415c4d02e0834480bf8762845ba12` |
| final-gates-runner.log | 2635 | `e18dd4a49012e5522560b8214fa8d0a96459ccc20dfd66bdeec9f41dec134f42` |

## 同步与现有工作保护

同步时两个项目里出现另一份同日 ECC 评估及索引新增。本次保持它们原样，按当前索引作增量合并；本轮 review 不替那份并发评估背书。ContextView 的 F/WP、cutoff、canonical、验收集合和既有未提交文件未被覆盖。本方案仍是候选，不创建第二个排产源。

P2 权威收尾台账：SayDo `research/ecc/deferred-p2-ledger.json`。3 项均 fixed；没有未结 P0/P1/P2。本地原始运行记录和冻结 review clone 保留在任务独立工作区，便于复现审查。
