# ECC 最终文档评审与交付记录

> 当前范围以文末「2026-09-05 持续成本范围修订」为准：本次独立复审 GREEN、十三项冻结门禁通过。以下 R1–R4 与十二门记录原样保留为上一版历史证据。

最终结论：文档语义 GREEN，十二项冻结文档门禁 exit 0；产品建议尚未实施。最终报告把 Fable 和 Astra 调研合成一份内容，两仓报告逐字节一致；每仓各有一个最终方案和一个后续实施 prompt。

## 评审与修复

R1 找到五条能力登记截断及不可执行的启动命令；评审末尾自报检索越界，其通过项不作为最终验收。负向问题经机械复现后修复。R2 为完整独立评审，报告与方案 A1/A2/A4/A5/A6 通过，A3 指出首次候选身份迁移和单阶段预算问题。修订两阶段流程并用合成临时仓验证初次 GREEN、RED→repair→GREEN（合成不是产品验收）。R3 全部语义 GREEN。完整门禁随后发现 ContextView 文档检查把行内正则识别为引用链接；单行改成等价文字后由 R4 独立确认 GREEN，其余五正文 SHA 未变。

最终 `validate_review_manifest.py` 返回 `status=valid,next_action=full_gate`，`cycle_control.py --finalize` 返回 `status=finalized`。修复计数 3（两次流程/内容修复和一次格式修复），复审计数 3，未重置预算或降低模型。最终 P2 sweep 一次；后发现的 `portable-control-evidence-coordinate` 仍 deferred：报告中的少量 control 坐标依赖本次冻结包，正文已内嵌事实，后续任务会重读现场，不阻断实施方案。

## 本会话门禁证据

SayDo：`git diff --check`、六文件完整性/镜像/118源索引/110能力/两handoff检查、`bash scripts/check-emoji.sh`、`node scripts/check-doc-links.mjs`、`node scripts/check-public-tree-privacy.mjs --fs`、`node scripts/schedule-pointer.mjs --check`。

ContextView：`python3 scripts/check_docs.py`、`python3 scripts/check_acceptance.py --structure`、`--traceability`、`--corpus`、`python3 scripts/check_semantic_team.py`、`TMPDIR=/tmp python3 -m unittest discover -s tests/acceptance -p 'test_*.py'`。

十二项 exit 0；最后一条原始输出：`Ran 148 tests in 79.170s` / `OK`。这是冻结 foundation clone 的文档验收，不是正在并行推进的 WP-02、Rust 产品、SayDo daemon 或 ECC 全量测试验收。源码基线 SayDo `bcf8ea855f25b177888d9159f75e49214f3dd892`、ContextView `492fd5fe7183fc5517fb6a1ca811d8d5233eb1f3`、ECC `e04ea0b9cc8248686edf5ac751cadff550e162b8` 均来自本会话 git 输出。

## 接收范围

最终稿之外，只给旧方案和旧研究加归档指针，更新索引及本记录，保留旧正文与并行任务改动。评审后正文修改仅登记状态和本次门禁事实；逐文件 reviewed/delivered SHA 在交付证据。两份实施 prompt 要求在新任务先重核 HEAD、前置、冻结 policy 与当时完整门禁，再由 Grok CLI 实施、全新 Codex review。

未改产品代码或 canonical/排产；未运行未来实施 prompt；未 commit/push/install；未对 shortlist 项目深入研究。原始 CLI 日志不入 Git，文件名/字节数/SHA-256 记入交付证据；保留于本地隔离任务日志目录。

[逐文件交付与日志摘要](../ecc-final/delivery-evidence.json)；[R3 语义评审](../ecc-final/review-r3.txt)；[R4 单行复核](../ecc-final/review-r4.txt)。

## 落回原工作区后的校验

SayDo emoji、活动文档链接（148 files，0 broken）、隐私（0 hits）和两仓 handoff validator 通过；ContextView 当前树 `check_docs.py PASS`。六主文件 SHA 与交付收据匹配，统一报告镜像一致。

SayDo 原工作区额外 `schedule-pointer --check` 为 exit 1：`revision 回退:候选 2 < main 3`。当前分支 HEAD 仍为 `bcf8ea8`，PLAN-2 与该 HEAD 字节相同；并行任务已把 main 推进到 `99d51106c9caaefcf55f72bff1a17a78abf58be9`（其指针 revision 3，active=PG-01B）。本任务没有修改排产，也没有用冻结 clone 的通过结果声称原工作区该项通过。后续启动 prompt 时须从当时合法新基线核对 PG-01B 关闭状态，不能只凭提交名推断完成。

ContextView 接收时 HEAD 为 `b05c272b808343cde19883b29beae153161fdfa6`，本任务的冻结 foundation 基线保持不变。此处仅记录并行变更，不验收该实现。


## 2026-09-05 持续成本范围修订

**输入与范围：** owner 明确授权按实际回报与后续成本调整文档和 Prompt。本次沿用两份 final 方案、两个未来实施入口、统一研究源/镜像和三个索引，共九文件，不启动产品任务。

**本次修订：** SayDo 保留完整的凭据写前拒绝和私有生成物 Git 保护；共享开关、allowlist、设置 schema/UI/DDL 延期；三类失败、新鲜度、脱敏来源、去重和既有重试恢复纳入同批验收。ContextView 取消独立全量 ECC intake；AC-03/05/07 按当前消费者、真实缺口和既有授权 WP 逐项吸收，已覆盖或未触发允许 no-change；AC-01/02/04 延期，AC-06 移出本批。不定期全量追踪 ECC。

**独立证据：** Grok `grok-4.6` / `xhigh` 实施（实际 `grok-4.6-build`、`stopReason=end_turn`）；一名全新 Codex `gpt-5.6-sol` / `max` reviewer（`turn.completed`）。A1–A6 均 [ok]，P0/P1=0，Deferred P2=0；manifest validator `status=valid,next_action=full_gate`；finalizer `status=finalized`。初审一次，无修复/复审；最终 P2 sweep 一次，无改动。不是上一版预算清零重审，而是 owner 新授权的范围修订任务。

**本会话门禁：** 九文件/镜像/历史证据/两 handoff/变更范围检查；SayDo emoji、doc-links、privacy；ContextView docs、acceptance structure/traceability/corpus、semantic-team、negative-tests 和 cargo build/test/clippy，共十三项 exit 0。离线测试原始输出：`Ran 148 tests in 72.696s` / `OK`。Cargo 六组非空测试 27/9/11/17/10/3 passed，另两组 0 tests；全部 0 failed。门禁只覆盖冻结 clone 与修订文档，不验收原树仍在施工的 fs/collect 或未来 ECC 产品改动。

**身份与接收：** SayDo `bcf8ea855f25b177888d9159f75e49214f3dd892`；ContextView `b05c272b808343cde19883b29beae153161fdfa6`。SayDo fingerprint `7bf13516076dd44abf3721275e9f2c3dd3cbd1b1ad2b4b2d5df18376647458a9` 通过九文件 SHA 清单绑定跨仓候选。接收前九目标与修订前摘要一致，接收后与 reviewed bytes 一致；三个索引的非 ECC 内容保留。未改 canonical/产品/排产，未 commit/push/install。SayDo 全量 `just ci` 与原树 schedule-pointer 本轮未跑，不将历史绿/红移作本次结果。

E-01–E-110、118 条 legacy source 与 12 条历史测试表原行保持，研究源与镜像逐字节相同。原始 CLI 日志留本地隔离目录，公开记录仅含文件名、字节数与 SHA-256。

[本次独立评审](../ecc-final/scope-revision/review-r1.txt)；[验收与日志摘要](../ecc-final/scope-revision/delivery-evidence.json)；[门禁收据](../ecc-final/scope-revision/gate-evidence.json)；[唯一 P2 记录](../ecc-final/scope-revision/deferred-p2-ledger.json)。
