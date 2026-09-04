# 本地遗留工作收敛证据（2026-09-04）

batch_id: `local-convergence-20260904`

task: `saydo-local-convergence`

stage: `pending-local-work`

cycle: `initial`

plan_section: 不推进 PG-01B；本批只收敛磁盘上未入主线的 Tailcat 评估与安装自测 mutation。HANDOFF 指针保持 `active=none`、`next=PG-01B`。

predecessor_sha: `a4f1a0618fdbb7c4a8eb7178429cd9b08a8b92d8`

implementation_sha: `5cf1cabb2feea2508a4724082a408c7b734e81e2`

implementation_tree: `79748f2da3bab36a34cb27b08c1b0452653ba111`

parent_check: `parent(I)=a4f1a0618fdbb7c4a8eb7178429cd9b08a8b92d8`

git-diff-v1: `e42dd19ca752c0ee2dca966fb0e915cbc9fce9375efcd3d45a53f060692f9727`

## 性质与边界

本文件只证明：implementation I 已在独立 clone 分支 `codex/local-convergence-20260904` 上通过语义复审与本地完整门禁，随后由本证据提交入库。不得把本地绿推导成线上、托管 CI、真人场次、付费路径或部署验收。本批未修改产品 installer、未改计划排期指针、未执行 final P2 sweep。

## changed_path_exact_set（I）

```text
docs/plan/2026-09-03-tailcat-borrowing-assessment.fable.md
docs/plan/README.md
scripts/test-install-scripts.mjs
```

`git diff-tree --no-commit-id --name-only -r 5cf1cabb2feea2508a4724082a408c7b734e81e2` 实读以上三路径。handoff 字面五路径白名单中的 `scripts/check-active-claims.mjs` 与 `scripts/test-active-claims.mjs` 未改；独立复审将此记为合理 `[divergent]`，不是验收失败。

## focused_gate

supervisor 在同一冻结 candidate、可写 OS 临时目录的普通测试环境重跑原七项 focused gate。日志路径以 `<supervisor-control>` 表示 ignored 监督目录。tested SHA/tree 均为 I。

| command | exit | 日志要点 |
|---|---:|---|
| `node scripts/test-install-scripts.mjs` | 0 | `mutations=21 all red; dynamic no-write checks=6` |
| `node scripts/check-public-tree-privacy.mjs --fs` | 0 | `hits=0` |
| `node scripts/check-active-claims.mjs` | 0 | `roots=33` |
| `node scripts/test-active-claims.mjs` | 0 | `33 passed` |
| `bash scripts/check-emoji.sh` | 0 | `clean` |
| `node scripts/check-doc-links.mjs` | 0 | `files=138 broken=0` |
| `git diff --check` | 0 | 成功时静默；汇总 exit 0 |

focused-supervisor.log：2189 bytes，SHA-256 `2d1a561b1740d8da544c7bc32da9b4c6156c7c1c70e6942271f9c452006e2c6a`。summary `status="completed"`、`exit_code=0`，SHA-256 `46c3bab553568be89ec01dc0cca8cfa18dfc664c9241e5a98d648d07069acc47`。

## 程序性替代（不是产品 RED）

第一名 reviewer 因 Codex `-s read-only` 禁止 OS `mkdtemp` 而无法跑完安装自测与 active-claims mutation 两条 suite，报告 workflow verdict `RED / BLOCKED_REQUIRED_GATE`。该报告产品 P0=0、P1=0，但按合同不能把补充静态/内存证据冒充为原门禁通过，因此整份报告无效。

- 失效报告：`<supervisor-control>/review-1.md`，13952 bytes，SHA-256 `64ca6e36bdc3eff1132345a88edc02128ac91ab9035a1e62126c5a29df7d20ae`
- 失效事件流：4294976 bytes，SHA-256 `aba063d0797ee8a047c2236b178fe002d773c80b86cfba4512f244196eaee246`
- 恢复记录：`<supervisor-control>/recovery-review-temp-write.json`，`incident_kind=review_invalid`，`cause_id=read-only-mkdtemp`
- supervisor 判定：`plan_recovery.py` → `retry_procedure_once/review_invalid_replace`

随后 supervisor 同候选重跑七项 focused gate 全绿，并以全新零上下文 reviewer 得到有效 GREEN。替代复审 `cost_kind=none`，未消耗 repair/rereview/strategy_reset；review ordinal 仍为 `1`。不得把第一份失效报告宣称为产品 RED。

## readback

| 项 | 值 |
|---|---|
| reviewer | Codex `gpt-5.6-sol/max`，fresh zero context |
| review ordinal | `1`（程序性替代，不是第二次产品复审） |
| review_scope | `workflow-final` |
| reviewed HEAD / tree / fingerprint | `5cf1cabb2feea2508a4724082a408c7b734e81e2` / `79748f2da3bab36a34cb27b08c1b0452653ba111` / `e42dd19ca752c0ee2dca966fb0e915cbc9fce9375efcd3d45a53f060692f9727` |
| 原始 prompt | `<supervisor-control>/review-replacement-handoff.md`，3964 bytes，SHA-256 `bad4cc588d3f45ca7b546a4e407529b7a975045d7b7bb730efd2c7ba556f98a2` |
| 原始报告 | `<supervisor-control>/review-1-replacement.md`，12781 bytes，SHA-256 `52b98619e334fa779a31022c39f7a08ae4ad49c290ce2c65ad610daf0ab62414` |
| 事件流 | 1028832 bytes，SHA-256 `1d6bc21b9deff864bec61475873eb84bf6caf967df0ebb3b36032f7d18ed8c23`；`turn.completed=1` |
| 入库副本 | `prompts/226-local-convergence-review.md`、`research/codex-findings/226-local-convergence-review.md`（脱敏后 digest 不同于原始 raw SHA） |
| verdict | GREEN；P0=0；P1=0；blockers=[]；`stop_reason=null` |
| manifest validator | `valid/full_gate`（reviewer 内存校验 `errors=[]`、`next_action="full_gate"`） |
| 验收台账 | `LC-GIT-FREEZE` `[ok]`；`LC-SCOPE` `[divergent]`；`LC-TAILCAT-DOC` `[warn]`；`LC-QUICKSTART-MUTATIONS` `[ok]`；`LC-PG01A-SCANNER` `[ok]` |

该 reviewer 会话明确未运行 `just ci` 与 Playwright；完整门禁由 supervisor 在语义 GREEN 之后执行。

## full_gate

冻结 acceptance 要求 `just-ci` 与 `playwright`。均在 I 的干净工作树上运行，`tested_implementation_sha/tree` 与顶层全等。

| command | exit | duration | bytes | sha256 | 结果 |
|---|---:|---:|---:|---|---|
| `just ci` | 0 | 182.57s | 94404 | `a957c453e79b17f6084310601b287b8e6e51d767c3e0b0677c8b0dd48bc67ac0` | contracts 111；platform 72 passed / 14 skipped；console 279；cli 49 passed / 1 skipped；daemon 2177 passed / 6 skipped；Python 34；安装自测 21 mutation 全红、6 项动态无写入；active-claims roots=33；隐私探针 hits=0；末行 `[ok] just ci: node + python matrices green` |
| `pnpm exec playwright test` | 0 | 212.711s | 4882 | `a17bfe033deccb0ea3747875e2b80c528aa21b4fe408bdb7da0212082a771448` | `36 passed` |

Playwright 运行时写回四张受管截图。supervisor 已仅恢复这四个测试生成路径；恢复后 fingerprint 仍为 `e42dd19ca752c0ee2dca966fb0e915cbc9fce9375efcd3d45a53f060692f9727`。这是测试副作用，不是产品失败。

`full-gates.json` 与 `frozen/final.json` 中两条 gate 的 exit 与 log SHA 与上表一致。

## finalizer

`<supervisor-control>/frozen/final.json` 于 `2026-09-04T14:41:47Z` 写入。`cycle_control.py` persist 非 idempotent 时 status=`finalized`。记录字段：

- candidate_head=`5cf1cabb2feea2508a4724082a408c7b734e81e2`
- diff_fingerprint=`e42dd19ca752c0ee2dca966fb0e915cbc9fce9375efcd3d45a53f060692f9727`
- review_ordinal=`1`
- policy_revision=`2.4.2`
- review_manifest_sha256=`7f6406d8a3acd318d974146b3eccfeb88f544790c20eb11808e53cb138d31057`
- gate_evidence：just-ci / playwright 均为 exit 0，log SHA 与上表全等

cycle-state：repair=0 / rereview=0 / strategy_reset=0；`current_blockers=[]`。

## Deferred P2

本次只登记，不修复，不执行 final P2 sweep。

| id | status | disposition |
|---|---|---|
| `LC-P2-OBSOLETE-SCANNER-SIBLING` | deferred | 现役 checker 无 occurrence-selector；旧 clone sibling 加固对正式入口不可达。仅未来恢复 selector grammar 时处理，不得整文件移植。 |
| `LC-P2-TAILCAT-COUNT` | deferred | 能力表机械计数 `A=0/B=8/C=22`，摘要写成 `A=1/B=8/C=21`。核心 D13/T2/T3/S3 裁决不受影响。 |

## week_audit_writer

四个源文件进入 index 且 index/worktree 全等后运行 `node scripts/week-audit.mjs --write`。只把 writer 实际变化的既有输出加入暂存，不手改生成账本。实际变化子集以本证据提交的 pathset 为准。

## not_run_exact_set

- 真实服务探活、常驻 runtime 升级
- 真实账号、connector、产品 AI 调用、付费
- 部署、官网刷新、GitHub Release
- `git push`、`merge --ff-only` 进 main、公开快照 `publish-public-snapshot.sh`
- 托管 CI / 公开仓 CI
- 真人语音/S3/真机验收
- PG-01B 任何产品工作
- final P2 sweep

## rollback_or_safe_default

候选只存在于分支 `codex/local-convergence-20260904`。未获 merge/push/deploy 授权时，放弃该分支即可回滚，不需要改 main。隐私门、Gate 0 与 S3 守卫未放宽。`SAYDO_INSTALL_ALLOW_OUTSIDE_HOME` 仍为显式逃生阀。

## 后续仍待

- main fast-forward
- 私有归档 push
- 公开快照
- PG-01B

以上均需 owner 另行授权。本证据提交不自指 SHA。
