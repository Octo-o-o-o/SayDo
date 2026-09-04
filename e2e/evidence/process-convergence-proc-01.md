# PROC-01 流程收敛 evidence

batch_id: `PROC-01`

plan_section: `docs/plan/2026-09-02-process-convergence-plan.fable.md` §3.1

predecessor_sha: `80829cdac2f8b2a7de5b95526548f988db221b07`

implementation_sha: `289cb384a7bcfd4f7413cb05dd69e0a8c05b80f9`

implementation_tree: `2ac96978001e2f62d09ddae49879929e924a1500`

parent_check: `parent(I)=80829cdac2f8b2a7de5b95526548f988db221b07`

## changed_path_exact_set

```text
.github/workflows/ci.yml
.github/workflows/release.yml
.octoworkflow/project-profile.md
AGENTS.md
HANDOFF.md
docs/03-architecture.md
docs/05-roadmap.md
docs/09-data-contracts.md
docs/README.md
docs/adr/README.md
docs/adr/design/ADR-001-execution-layer.md
docs/adr/design/ADR-005-execution-single-route.md
docs/plan/2026-08-28-project-gap-closure-program.md
docs/plan/2026-08-28-project-gap-d17-import-spec.md
docs/plan/IMPLEMENTATION-PLAN-2.md
docs/plan/OWNER-DECISIONS.md
docs/plan/README.md
docs/plan/project-gap-closure/README.md
justfile
package.json
scripts/check-gate-list-parity.mjs
scripts/schedule-pointer.mjs
templates/saydo.config.example.toml
```

该集合共 23 个路径，等于 P1-P5 `must_change` 与允许的两个索引路径之并集；不含产品代码目录。实施 prompt 的 owner recovery 单行修订属于 E 的 prompt 产物，不混入 I。

## decision_file_sha256_exact_set

- `docs/adr/design/ADR-005-execution-single-route.md`: `7ae156b98f429249d460099ae4ec3b2a16ac15ee0df69a86676196256e650402`
- `docs/plan/OWNER-DECISIONS.md`: `042a90de4f7e4c941006877e4d9aa9f6cc41719cb96546d225db3715cbf845a7`

## sp2d_state

`N/A(reason=五个最终语义评审的 Deferred P2 delta 均为空；任务唯一 ledger 未创建；最终 P2 sweep 对空集执行一次，无待处理项)`

## focused_gate

下列命令都在 clean I validation worktree、同一 implementation SHA/tree 上运行。日志路径以 `<supervisor-control>` 脱敏表示本机监督目录。

| stage | command | exit | log_path | bytes | log_sha256 |
|---|---|---:|---|---:|---|
| P1 | `node scripts/schedule-pointer.mjs --check` | 0 | `<supervisor-control>/control-final/focused/p1-01-schedule-check.log` | 83 | `3691f37b67afdace47af5f6baa0a949d12095e0eedc5663081bb07645ed867ca` |
| P1 | `node scripts/schedule-pointer.mjs --self-test` | 0 | `<supervisor-control>/control-final/focused/p1-02-schedule-self-test.log` | 229 | `ed17c00fd49763075c9ecb2ca78e9b57e66c9f648fea70eee0223a276dac8770` |
| P1 | `bash scripts/check-emoji.sh` | 0 | `<supervisor-control>/control-final/focused/p1-03-emoji.log` | 23 | `e97ffbbcc1ec2da64acb2b45cd94178bfa0703a13878c9345ab3f93ff96d7da3` |
| P1 | `node scripts/check-doc-links.mjs` | 0 | `<supervisor-control>/control-final/focused/p1-04-doc-links.log` | 47 | `710a83183e15355713860439c0e5846458ec49b4d1f4c41e3d071a687920160d` |
| P1 | `git diff --check` | 0 | `<supervisor-control>/control-final/focused/p1-05-diff-check.log` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| P2 | `bash scripts/check-emoji.sh` | 0 | `<supervisor-control>/control-final/focused/p2-01-emoji.log` | 23 | `e97ffbbcc1ec2da64acb2b45cd94178bfa0703a13878c9345ab3f93ff96d7da3` |
| P2 | `node scripts/check-doc-links.mjs` | 0 | `<supervisor-control>/control-final/focused/p2-02-doc-links.log` | 47 | `710a83183e15355713860439c0e5846458ec49b4d1f4c41e3d071a687920160d` |
| P2 | `git diff --check` | 0 | `<supervisor-control>/control-final/focused/p2-03-diff-check.log` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| P3 | `node scripts/check-gate-list-parity.mjs` | 0 | `<supervisor-control>/control-final/focused/p3-01-gate-parity.log` | 104 | `b30cc3e1cd52c763c116d5554c49a5a423fad9a9939e9c64f600fc2344946be8` |
| P3 | `node scripts/check-public-tree-privacy.mjs --ref 289cb384a7bcfd4f7413cb05dd69e0a8c05b80f9` | 0 | `<supervisor-control>/control-final/focused/p3-02-public-privacy.log` | 67 | `21ed0bb65436abb779e93ba524945cd36a56999c7feef403dbc74d976cd1c7e9` |
| P3 | `node scripts/check-active-claims.mjs` | 0 | `<supervisor-control>/control-final/focused/p3-03-active-claims.log` | 28 | `0615049331d262a11931b9756d7464673db9198c8942598d58df955c8a239591` |
| P3 | `python3 -c 'import yaml,sys; yaml.safe_load(open(sys.argv[1]))' .github/workflows/ci.yml` | 0 | `<supervisor-control>/control-final/focused/p3-04-ci-yaml.log` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| P3 | `python3 -c 'import yaml,sys; yaml.safe_load(open(sys.argv[1]))' .github/workflows/release.yml` | 0 | `<supervisor-control>/control-final/focused/p3-05-release-yaml.log` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| P3 | `bash scripts/check-emoji.sh` | 0 | `<supervisor-control>/control-final/focused/p3-06-emoji.log` | 23 | `e97ffbbcc1ec2da64acb2b45cd94178bfa0703a13878c9345ab3f93ff96d7da3` |
| P4 | `bash scripts/check-emoji.sh` | 0 | `<supervisor-control>/control-final/focused/p4-01-emoji.log` | 23 | `e97ffbbcc1ec2da64acb2b45cd94178bfa0703a13878c9345ab3f93ff96d7da3` |
| P4 | `node scripts/check-doc-links.mjs` | 0 | `<supervisor-control>/control-final/focused/p4-02-doc-links.log` | 47 | `710a83183e15355713860439c0e5846458ec49b4d1f4c41e3d071a687920160d` |
| P4 | `pnpm --filter @saydo/contracts exec vitest run test/schemas.test.ts` | 0 | `<supervisor-control>/control-final/focused/p4-03-contract-schema.log` | 289 | `d51c33cd7b059488b41b1a5bca31cbdff1da237f74f76c25d20fe5ca39f78c27` |
| P4 | `git diff --check` | 0 | `<supervisor-control>/control-final/focused/p4-04-diff-check.log` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| P5 | `just precommit` | 0 | `<supervisor-control>/control-final/focused/p5-01-precommit.log` | 371 | `2ae599703cf87c023ec535c9e4a7c76fefa67d685fc97c0513a8100d472b2164` |

每一行的 `tested_implementation_sha` 均为 `289cb384a7bcfd4f7413cb05dd69e0a8c05b80f9`，`tested_implementation_tree` 均为 `2ac96978001e2f62d09ddae49879929e924a1500`。

## full_gate

`TMPDIR` 的 owner home 前缀按公开树隐私规则写作 `<owner-home>`；以下三次均固定同一 I SHA/tree。

| command | exit | classification | log_path | bytes | log_sha256 |
|---|---:|---|---|---:|---|
| `env -u SAYDO_LIVE_E2E -u SAYDO_SLOW_E2E TMPDIR=/tmp/sdtmp-p01-i just ci` | 1 | validation worktree/TMPDIR 位于 owner home 外，222 个用例同根因被 `workspace_outside_owner_home` 拒绝；无产品结论 | `<supervisor-control>/control-final/i-just-ci.log` | 249272 | `d80573fe21d55d96fc2671b9988fc91cf066bf0b405714e1f0d59cff7023cfea` |
| `env -u SAYDO_LIVE_E2E -u SAYDO_SLOW_E2E TMPDIR=<owner-home>/.t just ci` | 2 | clean clone 缺本机 `.git/info/saydo-private-probes`；Node 测试完成后隐私门 fail-closed | `<supervisor-control>/control-final/i-just-ci-home-tmp.log` | 91567 | `e280d00abf3d7678915abccf4d273d530fb183ebb1bc476a74a791817793fdd5` |
| `env -u SAYDO_LIVE_E2E -u SAYDO_SLOW_E2E TMPDIR=<owner-home>/.t just ci` | 0 | 本机探针复制到 validation clone 的 Git info 后，exact full gate 通过 | `<supervisor-control>/control-final/i-just-ci-final.log` | 97127 | `1f4ea8e2d0d19b4fa00c843c33fea9102b2590e0f2761b5df5c6013d914a85b3` |

三行的 `tested_implementation_sha` 均为 `289cb384a7bcfd4f7413cb05dd69e0a8c05b80f9`，`tested_implementation_tree` 均为 `2ac96978001e2f62d09ddae49879929e924a1500`。前两次是验证环境失配，未改候选；最后一条是合同要求的 clean I 绿灯。

## readback

阶段 reviewer 都在 I 提交前读取同一 dirty candidate 的冻结 fingerprint；supervisor 随后用 explicit pathspec 将已评审字节机械提升为 I，未改任何文件字节。下表的 `reviewed_implementation_sha/tree` 是该 byte-exact 提升后的身份；`report_path_or_message_id` 同时保留 reviewer 当时真实的 HEAD/fingerprint 坐标。P4 后只有 P5 的 `justfile` 配方新增，P4 canonical 路径未变化。

| stage | reviewer | reviewed_implementation_sha | reviewed_implementation_tree | report_path_or_message_id | report_sha256_if_file | verdict | A | B | C |
|---|---|---|---|---|---|---|---:|---:|---:|
| P1 | Codex `gpt-5.6-sol/max` fresh zero context, ordinal 2 | `289cb384a7bcfd4f7413cb05dd69e0a8c05b80f9` | `2ac96978001e2f62d09ddae49879929e924a1500` | `<retired-control>/p1-review-2.md`; manifest HEAD=`80829cdac2f8b2a7de5b95526548f988db221b07`, fingerprint=`e51258d4bca344fbdfd35bf19a79122104db4075153a5ed76dcf0321e5ecc449` | `18929318a243015efa68298836eeca31a81b893c34974b9b33e24558974daff6` | GREEN | 0 | 0 | 0 |
| P2 | Codex `gpt-5.6-sol/max` fresh zero context, ordinal 1 | `289cb384a7bcfd4f7413cb05dd69e0a8c05b80f9` | `2ac96978001e2f62d09ddae49879929e924a1500` | `<retired-control>/p2-review-1.md`; manifest HEAD=`80829cdac2f8b2a7de5b95526548f988db221b07`, fingerprint=`7a0ebe091ec7e1b08c449101e0782e8c3dbe987a7b5d1f7b74dd0bf73da78163` | `2bab2383b9ed3da9716bd0a41d9437b5648a5a389726d243d762a600cf66fa00` | GREEN | 0 | 0 | 0 |
| P3 | Codex `gpt-5.6-sol/max` fresh zero context, ordinal 2 | `289cb384a7bcfd4f7413cb05dd69e0a8c05b80f9` | `2ac96978001e2f62d09ddae49879929e924a1500` | `<retired-control>/p3-review-2.md`; manifest HEAD=`80829cdac2f8b2a7de5b95526548f988db221b07`, fingerprint=`74947abd9669d0bdfb7e46cbe60af7c54c72f1720940ea6662dbf6c6b0dd25d0` | `6777bfed5d87d625fe72b450de07f4ede3131ac99bc405959327d01c3689369e` | GREEN | 0 | 0 | 0 |
| P4 | Codex `gpt-5.6-sol/max` fresh zero context, ordinal 3 | `289cb384a7bcfd4f7413cb05dd69e0a8c05b80f9` | `2ac96978001e2f62d09ddae49879929e924a1500` | `<supervisor-control>/control-p4/p4-review-3.md`; manifest HEAD=`80829cdac2f8b2a7de5b95526548f988db221b07`, fingerprint=`dfdcc0f0bbc140dca166c14d379a0b4eaea5bada6f0f8cb01decec85078f8421` | `1a6ec59aa3f7c91ca54889231fbbc6e56e86f7aa122fafb079e728fa8b74784e` | GREEN | 0 | 0 | 0 |
| P5 | Codex `gpt-5.6-sol/max` fresh zero context, ordinal 1 | `289cb384a7bcfd4f7413cb05dd69e0a8c05b80f9` | `2ac96978001e2f62d09ddae49879929e924a1500` | `<supervisor-control>/control-p5/p5-review-1.md`; manifest HEAD=`80829cdac2f8b2a7de5b95526548f988db221b07`, fingerprint=`b64b11d2a33fe0ea026cdf2cf78e781a7f07bcb0f19da22af982ffeb61be69b3` | `b288444dcb0cbdba979b9064f498ae0df92ca0138392e92caf9c14e12c34885d` | GREEN | 0 | 0 | 0 |

## 四种坏例

命令：`node scripts/schedule-pointer.mjs --self-test`，顶层 exit 0。原始输出：

```text
[ok] self-test HANDOFF 生成块改坏 exit=1
[ok] self-test revision 回退 exit=1
[ok] self-test active 与 next 同时非空 exit=1
[ok] self-test 已收口批卡状态行改成未开工 exit=1
[ok] schedule-pointer self-test
```

## just precommit 耗时

`just precommit`: exit 0，工具层 duration `2.006 s`，日志 371 bytes，SHA-256 `2ae599703cf87c023ec535c9e4a7c76fefa67d685fc97c0513a8100d472b2164`。

## control freeze 与 pending-rebind

- 脱敏前命令：`python3 ~/.octoworkflow/cycle_control.py --verify-freeze --control-dir <supervisor-control>/control-p5/docs/plan/process-convergence --cycle-state <supervisor-control>/control-p5/docs/plan/process-convergence-cycle.json`。
- 脱敏前结果：exit 0，`status=verified`，policy revision `2.4.2`。
- 本机工具没有 `--rebind-control-dir`。入库副本的 `control_dir` 已从本机绝对路径替换为 `<repo>/docs/plan/process-convergence`，状态标记为 `pending-rebind`。
- 脱敏后 `--verify-freeze`：exit 5，`status=invalid`，`rule_ids=[control_dir_mismatch]`；按合同不记作绿。后续工具提供 rebind 后再消除此标记。

## A_ID_disposition

`[]`。PROC-01 批卡没有 A-ID；本批只收敛流程资产，不关闭其他 PG 的 A-ID。

## week_audit_writer

- 正式命令：`node scripts/week-audit.mjs --write`，在 9 个 E 源路径已显式进入 index、index 与 worktree 全等后运行，exit 0。
- 原始输出：`[ok] week audit ledger: main=115 all_refs=131 extra=16 paths=434 docs=219 markdown=154`。
- actual_change_subset：`research/week-audit/2026-08-22-bundle-integrity.json`、`research/week-audit/2026-08-23-publication-manifest.json`。
- 一次前置试跑因源文件尚未进入 index 而抛出“应发布源文件未入 index”；该次没有生成变化，也没有被记作通过。随后按 program §20.2 第 7 条修正操作顺序，以上正式命令才是 E writer 收据。

## not_run_exact_set

- `pnpm exec playwright test`：PROC-01 验收合同未要求；program §20.2.2 只对 PG-01B、PG-02、PG-03 的 full gate 追加此命令。
- hosted 公开快照仓 CI：远端不在本批范围，状态为 `LOCAL_GREEN_REMOTE_PENDING`。
- live E2E：合同明确以 `env -u SAYDO_LIVE_E2E` 运行，未触发真人或真实服务调用。
- slow E2E：合同明确以 `env -u SAYDO_SLOW_E2E` 运行。
- device、release、publish、deploy gates：批卡未列出且 owner 未授权发布、推送或部署。

## rollback_or_safe_default

候选只存在于独立 clone 的 `codex/proc-01-process-convergence` 分支。未获 merge/push/deploy 授权时，主仓保持 predecessor P；放弃候选即可回滚，不需要改主仓。隐私门与 Gate 0 等安全缺省未放宽。
