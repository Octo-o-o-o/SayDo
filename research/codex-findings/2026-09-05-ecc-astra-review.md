# ECC Astra 双项目方案：独立评审与交付核验

研究与核验日：2026-09-05。范围为比较 Fable 原始方案、旧 Codex 方案与 ECC 源码，并形成两份新的 Astra 建议文档。产品功能、运行时、排产、canonical、并行 WP-02 均未由本任务修改或验收。

## 结论

最终独立只读复审 R3：**GREEN，A1–A6 全部 [ok]，P0=0/P1=0，无新增 P2/P3**。监督线消费 manifest 返回 `status=valid,next_action=full_gate`；冻结阶段文档门禁 12/12 exit 0；`cycle_control.py --finalize` 返回 `status=finalized`。这些是文档方案的证据，不是建议已经实施或产品 runtime/live 通过。

SayDo 冻结 HEAD：`bcf8ea855f25b177888d9159f75e49214f3dd892`；ContextView 已提交 foundation：`492fd5fe7183fc5517fb6a1ca811d8d5233eb1f3`；ECC：`e04ea0b9cc8248686edf5ac751cadff550e162b8`。以上 SHA 均经本会话真实 git 命令核验。

最终候选 fingerprint：`4e816187028a01f41d91df68e5a8033cc0c6c66d2883a8dd39b4fadd0dec1cbe`。它绑定两份送审正文及来源 manifest；最终文件仅登记评审状态与监督核验记录，建议正文保持一致。送审正文 SHA-256：SayDo `e858089109d4ea91bf32abdd92728e97805eb0b107a15cfbf3db0ea87239f98f`；ContextView `758498a426b8cf469689f91562a050eab3e633bac99d1b654375aa346deb4c84`。交付文件摘要另记，不冒充原候选摘要。

## 实际评审和修订

| 轮次 | 实际结论 | 处置 |
| --- | --- | --- |
| 首次派发 | 1200 秒超时，无有效报告 | 不计 GREEN/RED；同模型、同 effort 新会话替代，不 resume |
| 有效 R1 | RED，1 个 P1：Git bypass 有限 grammar | 补 commit/am `-n`、短选项参数值、push dry-run 反例及既有 S3 不下调；执行唯一一次最终 P2 sweep |
| R2 | A1–A5 [ok]，A6 RED | 文本技术内容通过；补齐隔离评审副本的历史链接依赖，明确在已有接收工作区创建新文件 |
| R3 | GREEN，A1–A6 [ok] | 复核来源摘要、原工作区实际依赖、两稿全文和关键源码；无新增 P0/P1/P2/P3 |

每个候选只有一名全新独立只读 reviewer，角色为 Codex `gpt-5.6-sol/max`。实施与评估隔离；本次使用 2 次回修、2 次复审和 1 次最终 P2 sweep，未递归评审。文档送审前没有伪写通过状态。

R3 原始机械核验摘录：

```text
manifest-bindings frozen=15+9 destination=15+9 plans=2 heads=3 bad=0
crosswalk saydo=65 contextview=74 old=17+20 deferred=9+4 bad=0
delivery relative_links=3+4 scope=expected-only banner-offset=+2 bad=0
```

共覆盖 Fable 原始 139 行、旧 Codex 37 项、Fable Deferred 13 项。原工作区并行添加 Fable consolidated 文档与 supersede banner；不覆盖那些产物。对照表行号属于本次最初冻结输入，原方案加两行 banner 后坐标为 `+2`。本轮比较对象是用户提供的原始 Fable 评估，不对稍后出现的 consolidated 稿宣称完成了另一次比较。

## 冻结阶段文档门禁

以下全部在隔离候选执行；ContextView 为已提交 foundation 加本轮文档的快照，不代表原工作区并行 Cargo/WP-02 门禁。

| 名称 | 实际命令 | exit | attempt |
| --- | --- | --- | --- |
| `diff-check` | `git diff --check` | 0 | 1 |
| `astra-evidence` | `python3 docs/plan/ecc-astra-20260905/astra-evidence.py` | 0 | 1 |
| `emoji-check` | `bash scripts/check-emoji.sh` | 0 | 1 |
| `saydo-doc-links` | `node scripts/check-doc-links.mjs` | 0 | 1 |
| `saydo-privacy` | `node scripts/check-public-tree-privacy.mjs --fs` | 0 | 1 |
| `saydo-schedule` | `node scripts/schedule-pointer.mjs --check` | 0 | 2 |
| `context-docs-structure` | `python3 scripts/check_docs.py` | 0 | 1 |
| `context-acceptance-structure` | `python3 scripts/check_acceptance.py --structure` | 0 | 1 |
| `context-traceability` | `python3 scripts/check_acceptance.py --traceability` | 0 | 1 |
| `context-corpus` | `python3 scripts/check_acceptance.py --corpus` | 0 | 1 |
| `context-semantic-team` | `python3 scripts/check_semantic_team.py` | 0 | 1 |
| `context-negative-tests` | `TMPDIR=/tmp python3 -m unittest discover -s tests/acceptance -p 'test_*.py'` | 0 | 1 |

排产门禁第一次失败原文：`[fail] git show main:docs/plan/IMPLEMENTATION-PLAN-2.md 失败`。原因是独立 clone 只有 `origin/main`，没有本地 `main`。经真实 git log 核对 origin/main 与原工作区 main 均等于 SayDo 基线 SHA 后，恢复 clone 的本地引用，未改 HEAD、工作区内容或排产，唯独该项第二次运行通过。其它 11 项未无故重跑。

代表性成功原始输出：

```text
SayDo: 65 crosswalk rows, 375 document lines
ContextView: 74 crosswalk rows, 350 document lines
{"errors": [], "result": "PASS"}
[ok] schedule-pointer check active=none next=PG-01B last_closed=PROC-01 revision=2
check_docs.py PASS
Ran 148 tests in 84.338s
OK
```

## 日志索引

日志不入 Git；名称、真实字节数与 SHA-256 如下。原始整批门禁日志保留第一次排产失败，因此该批 wrapper 的 exit=1；最终收口引用下表 attempt 2 的实际成功收据，不隐藏失败历史。

| 日志名 | wrapper exit | bytes | SHA-256 |
| --- | --- | --- | --- |
| `implementation-r0.log` | 0 | 2709484 | `5f704e0fbeedd374a58b05fb64b542a8f4bc96f9bf05551f0fcbac3cc341ae07` |
| `review-r1.log` | -15 | 1531239 | `4de4b2791542ad06a0b9c9af4f3af306a992951b10347a160cfd09bffa1cef75` |
| `review-r1-replacement.log` | 0 | 637592 | `0f9c5d8184e0eaef0ee12bee459026a11efa9dfaa1cae601f9242cc130a0a528` |
| `repair-r1.log` | 0 | 1945836 | `1a41dba0bbb31a0d680af67cee7c033cba042433159ebadf7b7c4178cb8da9e4` |
| `review-r2.log` | 0 | 1386264 | `3b5ac9c3bde817e7e852edf16fd0a54884699eea3da5f77d9fe32eaffd979725` |
| `review-r3.log` | 0 | 658382 | `c22c7782a491a3eea7b10b3dd1a9c089d39dd40576e29715693535d7b09ecf61` |
| `final-gates.log` | 1 | 2677 | `7355247f3d8136eb82f8a9bfaf17bc43a86802904c2e2fad9d8a0af48e03793c` |

| 最终门禁日志名 | bytes | SHA-256 |
| --- | --- | --- |
| `diff-check-attempt-1.log` | 198 | `187b2b4c51f7da09fff516c424a5ed05f663bd138875f47d03071aa2cf760e14` |
| `astra-evidence-attempt-1.log` | 327 | `eefa96732d5fcf7725ec05fc3c979a7d18c8a9a16ac50035152dde272f548afa` |
| `emoji-check-attempt-1.log` | 221 | `fefc983db17c3af9b34756eeb5b82200c6bd1fa3087468e0b137136f42636cba` |
| `saydo-doc-links-attempt-1.log` | 245 | `5c997a6f9d3078fea3fe871b44aa27523929905483b9b6b1c50c5d9c0d22f20f` |
| `saydo-privacy-attempt-1.log` | 265 | `db62901f694ea007a50f3cef9253ee3fd3f968fbab88bd7108b9183ab245cc91` |
| `saydo-schedule-attempt-2.log` | 281 | `7bb96ada5a03a41ad3dc56bb53cc8f9ebf8fedf01709f2da7e76d62c674113d8` |
| `context-docs-structure-attempt-1.log` | 251 | `c29e43520349cf4532932626d7f27b4e4472c96528b878d091be86e2880d1a40` |
| `context-acceptance-structure-attempt-1.log` | 235 | `e5674f31165ceead3bc22f306e235707665e6e99f1beaa356b76ced66350d3f2` |
| `context-traceability-attempt-1.log` | 290 | `34433fd85c6f7b5914739121abef8dce555a34c0f2f34fc45d3b4b7d138f4631` |
| `context-corpus-attempt-1.log` | 343 | `36cb1efc46b106ec6625761dc71f0e22177af4ddc153bfa09ffb99230025440e` |
| `context-semantic-team-attempt-1.log` | 262 | `00195790710c806f5c94bf30466c4815add38cf4bcc294bb3231efcbf7d42869` |
| `context-negative-tests-attempt-1.log` | 2653 | `5509aed621af91a548604d2cf2224b1991c42342d1e66ee47c3322d007e96e96` |

## 未做的事

未运行产品 `just ci`、Rust build/test/clippy/parity、模型 runtime/live、笼子实测、`pnpm audit` 或第三方账号调用；未安装 ECC、修改用户配置、提交或推送。原工作区并行变更保持原状，六门通过不能代替并行 WP-02 的九门验收。
