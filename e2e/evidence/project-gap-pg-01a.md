# PG-01A · 公开承诺与 corpus 止损证据（已收口 2026-09-02；历史段原文保留）

> 当前坐标（2026-09-02 收口）：batch_id=PG-01A；status=CLOSED_LOCAL_I_E；implementation_sha=`2a786ed803f8229ea2fefe8240d9e644306331c4`；implementation_tree=`6cb66c57dc0ecda7389593c5a7dc02dd70e5647c`；predecessor_sha=`79211f6fec5c6eb092419c1871e35d8eedc4e3e5`；细节见文末「收口（2026-09-02）」节。下方从 `task=…` 起至该节之前均为在途历史，其 status/candidate 字段不再是当前坐标。

> task=project-gap-closure；stage=PG-01A/C1；cycle=owner-night-recovery-20260901
> status=BLOCKED_FULL_GATE（历史）；review_scope=step
> previous_stop_reason=same_root_cause_attempts_exhausted（保留）；next_action=stop_for_owner；open_blockers=FG-1；closed_blockers=B1,B2,B3
> repair_rounds_used=3；rereview_rounds_used=3；C1_review_used=3（ordinal 4 当前派发预记）；strategy_resets_used=1
> previous_cycle=owner-recovery-20260831-2（repair=1/rereview=1/C1_review=1）；更早 owner-recovery-20260831-1（repair=1/rereview=0/C1_review=1）、owner-continuation-20260831（repair=1/rereview=1/C0_review=2）均保留
> branch=codex/pg-01a-20260831
> predecessor_sha=79211f6fec5c6eb092419c1871e35d8eedc4e3e5
> candidate_head=2b5517d322f062297d25806b02c4106e2ecc60e8；base_implementation_tree=c5cae2f04ee907328b672e3099c865f1c3f83552；night_implementation_sha=n/a
> plan_section=PLAN-2 PG-01A / project-gap-closure-program §20.4
> contract=docs/plan/IMPL-PROMPT-PG-01A.md
> ledger=docs/plan/2026-08-28-project-gap-closure-program-DEFERRED-P2.md

## 授权与范围

2026-08-31 owner 授权继续实施至人工检查点，目标同时包含开发者与普通用户，完整语音非必需。原话只维护于 owner 决策单第 6 节。
owner 第 7 节批准三文件恢复及本地 I/E 提交；本次对 B1/B2/B3 的具体续行问题回复“授权你继续完整对应”，原话与边界见第 8 节。仍禁止 push、merge、deploy、真实产品 AI/connector 调用、付费和用户数据删除。
C0 已独立一致性 GREEN；C1 的本地 I 在上一 cycle 首次 readback 判 RED。当前按新授权开启 owner-recovery-20260831-2，只修 B1/B2/B3 并作一次 fresh rereview，不覆盖旧 RED 或计数。未发布 I 的必要调整保持本地 I/E 两提交边界，产品与更早合同范围不扩张。

## RECONCILE

主仓 HEAD 保持 predecessor，唯一既存非 ignored untracked 是 2026-08-31 只读评估报告；新 worktree 从 P 建立，未复制该报告。
先前评估的 just ci exit=1（daemon ownershipEstablished 断言），定向单例 exit=0，原因未定；不作本批 pass。
前一评估 cycle 的 RED 只作背景；本轮授权新实施 cycle，不抹去原报告，也不预支本批 review。

2026-08-31 上下文 checkpoint：重新核实候选 HEAD 仍为上述 P；tracked dirty 仅 owner 决策单，另有本批 prompt、唯一 P2 ledger 与本证据三个 untracked 文件；尚无产品 diff、存活实施进程或 reviewer。主仓仍只有先前只读评估报告这一项非 ignored untracked。
本机机器可读 SoT 当前为 policy_revision=2.2，合同已使用该版本；context-budget 的 handoff_on_first_compaction=false 与 allow_authorized_autonomous_continue=true 允许在本次明确继续授权下 checkpoint/RECONCILE 后推进 C0。旧上下文中的强制换会话判断不沿用；质量预算和外部操作权限不变。
控制文档检查（不是 C0 产品门禁）：validate_handoff.py exit=0/status=valid；四项控制文档 emoji gate exit=0；IMPL-PROMPT 实际 282 行。

## C0 与首次 C1 的门禁、readback 与产物（历史）

C0 独立实施已返回实际三文件 diff，二轮独立一致性 readback GREEN；C1 已返回未提交候选，定向门禁仍红，尚无 implementation commit 或 C1 readback。
focused_gate（C0 dirty 文档子阶段，非 I 门禁）：emoji exit=0；doc-links exit=0（files=119 broken=0）；git diff --check exit=0。原始 supervisor 命令输出保存于 logs/pg01a-c0-20260831.HMyzKK/focused-gates.json。
full_gate=[]；A_ID_disposition=[]。
readback=C0 ordinal 1 RED：candidate HEAD=P；fingerprint=bbff6d1ca0405cd0668639978b651c2117849b422824ae31a14c9ee4c9f1663e。报告 logs/pg01a-c0-20260831.HMyzKK/review-1.md，10210 bytes，SHA-256=b1891d0ac5a5f6931182dbc738708198018d879c143ae42c50b962d58fc10571；日志 review-1.log，453870 bytes，SHA-256=47079aafd94b4da98ef60b1b0894c98ebda4f30ecf798e6841910648a14e4576；runner exit=0 且真实 turn.completed。
manifest validator exit=0，status=valid，next_action=auto_repair_once。唯一 blocker B1/P1/C0-5，docs/06-references.md:189，in_scope=true，needs_owner_decision=false；unresolved_count>0 时仍允许 blocks_expansion，与只允许 owner_downgraded_with_public_limit 的合同冲突。P2 delta=[]，不扫 P2。
原实施线 repair 1 已退出，runner exit=0，duration=87.625s；CLI stopReason=end_turn，modelUsage=grok-4.6-build，同 session。repair-1.log：90358 bytes，SHA-256=1d9093f249a8e1d7f28ce6a26e92b0167ca3baa4b2adced8c9fe2878c77f4d32。docs/06:189 已出现三项 disposition 必须均为 owner_downgraded_with_public_limit 的文字；语义判决待二轮。三项 C0 文档门由 supervisor 复跑全部 exit=0，原始结果 repair-focused-gates.json；HEAD 与产品改动路径仍不变。
readback=C0 ordinal 2 GREEN：candidate HEAD=P；fingerprint=e0fe7094a6ef940fc2da26ee705dbfc23839bceabe86fd5b9bd8d23be196ef1c。报告 logs/pg01a-c0-20260831.HMyzKK/review-2.md，10151 bytes，SHA-256=84c429c7fa343c68aec6f288fb446c49ef538a098b02d9c5b9a81084dee25745；review-2.log，483791 bytes，SHA-256=a223c7cf2a2b67354839d34d9282587b5b2054d92d856ba1994a9a818292c2fd；runner exit=0 且 turn.completed。validator exit=0/status=valid/next_action=full_gate；B1 closed，blockers=[]，P2 delta=[]，三项文档门 exit=0。C0 无代码 full gate；原合同将 just ci 放在 C1 语义 GREEN 后。
not_run_exact_set=C1_semantic_readback,just_ci_on_candidate,Q0_real_I_report,render_visual_QA,product_live,account_login,microphone,passkey,phone,hosted_ci,release_download,distribution_install,production_backup_migration,commit,push,merge,deploy。
sp2d_state=N/A(claim-only，不改 runtime isolation)。
rollback_or_safe_default=只允许保守声明；不恢复失实承诺。候选未晋升，不影响常驻运行版。

## C0 到 C1 的历史交接

后续先核实 HEAD、完整 dirty fingerprint、合同和本文件计数；禁止因为新 fingerprint 重置 repair/rereview。C0/C1 只读 reviewer 不读实施 transcript。
开批时仅派独立 Grok grok-4.6/xhigh 执行 C0，再经零上下文 Codex gpt-5.6-sol/max 一致性 review 与一次 repair/rereview；当前已获得 C0 GREEN，见上方记录。

本次 C0 实施 session=97B1C3A9-AA21-42DC-AF22-3DB75985FEA9 已退出；runner exit=0，duration=628.335s，CLI stopReason=end_turn，modelUsage 实际模型 grok-4.6-build。日志 logs/pg01a-c0-20260831.HMyzKK/implementation.log：1981681 bytes，SHA-256=15fbec0b59673a1cf37a8b8b0d03deee782ab675abdcd867e7ac24b828ae8bf3。独立 Git 检查证实 HEAD 未变，实施改动限于 C0 的三个 must_change 文件。
C1 派发前仅补充已有 console package 的 typecheck/lint/直接测试 argv，以满足当前 V2.2 focused 覆盖要求；C0 验收、产品 exact scope 和预算未改变。没有提交权限，Q0 的真实 I 绑定产物与 E 均保持待定。当前禁止自动恢复实施，先等待下方明确的人工续行授权。
本次明确释放输入为 prompts/2026-08-31-pg-01a-c1-release.md；C1 日志目录 logs/pg01a-c1-20260831.8VfzN8。C1 前 hashCorpusSourceTree 实测=0c2a1f6569db7c05088ab6d624eeecbcf3bc9260008780c42f3bf01db9db2da6。
候选依赖准备 pnpm install --frozen-lockfile --offline exit=0，Node v22.23.1 / pnpm 10.33.1；install.log 1367 bytes，SHA-256=7b2535611e3f845f0f152e1e0fca157ba2133c1bd0f8a6ee129af6befffc2f1d。不把依赖安装当门禁通过。

## C1 候选与独立门禁复跑

原 Grok session 的 C1 调用已退出，runner exit=0、duration=1875.840s；CLI stopReason=end_turn，实际 modelUsage=grok-4.6-build。implementation.log：4585324 bytes，SHA-256=1d43ec0f0bf6edabe85378183a73bf82d6b77b66a372b5da8e0340b089226fcc。进程成功退出不代表产品通过。

supervisor 按合同复跑 13 项 focused 与 3 项文档/格式检查；共 16 项，14 项 exit=0、2 项 exit=1。每条 argv、原始 stdout/stderr 和直接 exit 保存在 logs/pg01a-c1-20260831.8VfzN8/focused.log：32754 bytes，SHA-256=ba3ca1f6673c72e433af2d2462b25006711a7789097391ff8a35d7fe213e88c8。隔离 TMPDIR 下运行，显式 unset SAYDO_LIVE_E2E/SAYDO_SLOW_E2E，没有 product live。

| 检查 | exit | 实际结果 |
|---|---:|---|
| corpus validate | 0 | 600 条结构、登记合同完整性与已知语义反例门通过 |
| corpus mutations | 0 | 77 类 mutation 被拒绝；正式源树 digest 未变 |
| simulation validate | 0 | A-level checks passed；存在既有 payload 丰富度 warning |
| simulation mutations | 0 | self-test passed；正式 tree 未变 |
| dry-run validate | 1 | result/solution renderer bytes 与 authority digest 不匹配 |
| dry-run mutations | 0 | self-test passed；不是实际 dry-run 投影已通过 |
| public-text-redaction | 0 | pass=28 fail=0 |
| active-claims | 0 | roots=31 |
| active-claim mutations | 0 | 7 passed |
| Q0 mutations | 0 | 15 passed；只写临时 report，不是实际 I/E report |
| console typecheck | 0 | pnpm --filter @saydo/console typecheck，实际 tsc --noEmit |
| console lint | 0 | pnpm exec eslint packages/console/src |
| console vitest | 1 | 277 passed / 2 failed；32 passed / 1 failed files |
| emoji | 0 | clean |
| doc-links | 0 | files=119 broken=0 |
| git diff --check | 0 | stdout 为空 |

复跑后、写入本次证据/归档前的完整 dirty fingerprint=71ce9bd9cfed426b74f823daeb467193e5c38067dae40d9dd5796a5abda61069，HEAD 仍为 P。上述是 dirty 候选定向结果，不是 clean I 同 SHA 门禁；本证据与报告归档随后只改变 control 文件。未将 C0 的 GREEN 推广到 C1。

## 上轮两项阻塞与人工续行范围（历史；本次授权见第 7 节）

1. C1-FOCUSED-01：packages/console/src/components/setupWizardUx.test.tsx:246 与 :269 仍断言“本机运行 · 数据不出这台电脑”。SetupGate.tsx:132 已按 canonical 改为“本机运行 · 外发范围以当前配置为准”。该测试未列入 supervisor 展开的 C1 exact-set，属于本次范围展开遗漏；独立 scope 检查确认 in_scope=false，实施者没有越界修改。必须先补入这一确切测试文件并保留有效断言，不能恢复失实文案或删除测试。
2. C1-FOCUSED-02：两份现有 dry-run 投影记录 authority_sha256=2a83fe2355fc7328eb559d1f9fd78217cd920b323a6950725c832a1064e54365，而现役 hashAuthorityInputs 实测为 e62d2115beee835ee882061be4b62512ef6ab6507c907a7e597fb92e8405ab98。完整核对 48 个 authority input，全部与 HEAD bytes 相同；两份投影也都与 HEAD 相同。主仓相同 P 上只读运行同一 validator，同样 exit=1、同样五条错误。因此这是既有基线失配，不是本次修改 source 引起。诊断原始数据为 authority-baseline-diagnostic.json 与 dry-run-baseline.json。source-tree digest 仍为 0c2a1f6569db7c05088ab6d624eeecbcf3bc9260008780c42f3bf01db9db2da6，故当前 C1-5 禁止直接改两份投影；须先明确允许在本次权威摘要失配下按现役 writer 重生成，不能改 oracle、伪改源文件触发条件或放宽 validator。

拟请求下一轮有限修复的精确产品路径：

- packages/console/src/components/setupWizardUx.test.tsx
- research/customer-question-corpus/dry-runs/01-three-pass-dry-run-result.md
- research/customer-question-corpus/dry-runs/02-dry-run-remediation-plan.md

上轮在未获批准时停止，没有自行清零计数或追加 repair。现 owner 已批准，原 IMPL-PROMPT 的 exact scope 与本次投影例外已在派发前修订；旧 cycle repair=1/rereview=1 与 C0 RED 历史保留。C1 独立 readback 仍未派发，待真实修复和定向门禁后再进入，不预填语义判决或 P2 sweep。

本地“代码 + 证据”两次提交权限已获本次答复批准，不包含 push、合并晋升、部署、真实账户/服务调用或付费。当前尚无 I；须先修复、核 exact paths 并形成 I，才能在 clean I 上运行门禁、生成真实 Q0 与形成 E。

## C1 首次 focused 时的 exact product path set（历史）

独立程序化核对得到 28 个产品路径，must_change 全覆盖，out_of_scope=[]；另有 supervisor 控制文件。四个新脚本共 633 行。该计数不代表语义通过。

```text
AGENTS.md
HANDOFF.md
README.md
deploy/saydo-octoooo-com/docs/index.html
deploy/saydo-octoooo-com/en/docs/index.html
deploy/saydo-octoooo-com/en/index.html
deploy/saydo-octoooo-com/index.html
docs/06-references.md
docs/11-ui-spec.md
docs/release/2026-08-13-app-materials.md
docs/release/metadata.json
docs/site/style-demos/11-hybrid.html
justfile
packages/console/src/components/SetupGate.tsx
packages/console/src/components/SetupWizard.tsx
packages/console/src/components/SupplyPicker.tsx
packages/console/src/lib/resourcePlans.test.ts
packages/console/src/lib/resourcePlans.ts
packages/console/src/lib/setupApi.ts
research/customer-question-corpus/README.md
research/customer-question-corpus/check-q0-truth-report.mjs
research/customer-question-corpus/test-q0-truth-mutations.mjs
research/customer-question-corpus/validate.mjs
scripts/check-active-claims.mjs
scripts/test-active-claims.mjs
templates/saydo.config.dev.example.toml
templates/saydo.config.example.toml
templates/saydo.env.example
```

## 上轮停止时的结果与未达成目标（历史）

C0 二轮报告归档为 docs/review/2026-08-31-pg-01a-c0-impl-readback.fable.md，supersedes 首轮旧 C0 candidate 判决，不覆盖 C1。
归档副本起初触发 18 个本机绝对链接错误；supervisor 仅机械转为仓内相对链接，保留证据标签行号和 manifest，未改原始日志报告或产品文件。修后 doc-links 实测 exit=0（files=120 broken=0），归档 manifest 再校验仍 valid/next_action=full_gate；它仍只属于原 C0 坐标。
当前只形成公开声明止损与检查脚本候选；不记 G-A1/G-A4 为 repo_closed，不改变部署状态。C1 尚未独立复审，未跑候选 just ci、页面渲染截图或真实 I Q0 producer，尚不能交付。
开发者与普通用户、文本优先/语音可选的目标已进入合同；所有本地/云端、订阅/API 用户快速上手仍未被本次证明。运行时缺口、真实账号权益/计费、无 key 本地端点、普通用户任务可达性及真人旅程仍在后续 PG 与人工验收范围。
本轮受监督的 CLI/test runner 均已退出，没有在等待中的语义 child；候选留在独立 feature worktree。主仓 HEAD/工作区未被本批晋升或部署修改。

## owner-recovery-20260831-1 启动 checkpoint

owner 的本次回复承接上轮三个文件、有限恢复与本地 I/E 两提交的具体问题，不授予新产品范围或外部权限。续跑实测 HEAD 仍为 P、完整 dirty fingerprint=65e127336fd96da5d4bba1336c7057542a3310a621b3904ed764519df3187326，与上轮最终现场一致；该值为更新本控制文档前的 checkpoint，不冒充后续候选 fingerprint。
只恢复原 Grok session=97B1C3A9-AA21-42DC-AF22-3DB75985FEA9；当前无存活 owned runner。下一动作是三个文件的一次恢复修复，随后 fresh C1 reviewer，不重跑 C0 评审，不自行进入 PG-01B。

恢复派发：prompts/2026-08-31-pg-01a-c1-owner-recovery.md；本次启动即计 repair_rounds_used=1，不因后续坐标变化清零。日志预定唯一目录 logs/pg01a-recovery-20260831.fWhCEM。上下文 checkpoint 后实测 HEAD 仍为 P，控制文档更新后的 fingerprint=d457ec70c523512b2c9bb2280b28ba7f1959ca8261c271438371937e5b50ec39（本段写入前），没有存活 owned runner；合同验收与三个文件范围不变。

## 本次恢复结果（dirty 候选，非 clean I 门禁）

原 Grok session 的本次调用 runner exit=0，duration=170.095s；实际 type=end/stopReason=end_turn，modelUsage=grok-4.6-build。repair-1.log 为 266376 bytes，SHA-256=681fb8ed0f0a89fff200a0be1fcf5335fda7a88f9f8fa84590a059180f5aba42。
实施前完整 dirty fingerprint=6b4bbad27e6736d9583c5e9fe420258671f45f8aaf26c16637e0735b5788395f；返回后=4c26a8644be9356985b07746ee27817eef74581f2277561536b513753cbb1ab2，HEAD 均为 P。
supervisor 完整检查全部 2041 个 tracked/非 ignored untracked 路径；排除授权三个文件后的 2038 项路径、权限与 bytes 摘要前后相同，SHA-256=25197643978376cd57384552da29e181f553a9e1c4c1db9080c8ce8925d3954b。此为全文件保存核对，不替代 git-diff-v1。快照为同目录 pre-scope.json/post-scope.json。测试文件仅两条文案断言变化；两份投影仅三个 authority digest 字面值变化。source digest 和 48 项 authority input digest 均与 C1-8 固定值一致。

按原合同复跑受三文件影响的八项：dry-run validate、dry-run mutations、console typecheck、console lint、console vitest、emoji、doc-links、git diff --check；全部 exit=0。console 为 33 files / 279 tests passed，dry-run 为 rows=600 且 renderer 校验通过。两项旧 blocker 的定向失败已消除，不代表 C1 语义或完整门禁通过。原始 argv/exit/stdout/stderr 为 focused.log，6116 bytes，SHA-256=8be923b78a72f1981a2fade7ab141654b37eecd1759d7d0b3b2ceddace04bb49；duration=8.051s。
上述过程使用隔离 TMPDIR，unset SAYDO_LIVE_E2E/SAYDO_SLOW_E2E；没有 live 产品调用。其余未改动的 C1 focused 历史绿灯不冒充 clean I 结果，I 形成后重新绑定同 SHA 门禁。

I 准备：本批产品实际集合为上方历史 28 路径加本次授权三个文件，共 31 路径；实施者未改其他路径。supervisor 随后仅更新 HANDOFF 的本地提交授权与待审阶段文字，active=PG-01A,next=none 不变；这是 I/E 生命周期状态记录，不计作原实施线的恢复 delta。控制文档、prompt、report、ledger 与本 evidence 留待 E，不混入代码 I。

## 本地 implementation commit 与同 SHA 验证

经 git status、explicit pathspec stage、git diff --cached --name-only/--stat/--check 核验，I 已创建，31 个路径与声明集合全等（827 insertions、78 deletions）。本会话 git log 实测 I=004b226db0b9a6fb0347d60dc790c97293d11635，tree=578f45078cde3e920912d108d1158dfefc7dc051，parent=P=79211f6fec5c6eb092419c1871e35d8eedc4e3e5。提交本身不代表质量通过。
建立独立 detached clean I validation worktree；与候选共享 Git 对象，I 已由本地 codex/pg-01a-20260831 ref 固化，不需 fetch。初始 git status --porcelain 为空，git-diff-v1 fingerprint=e42dd19ca752c0ee2dca966fb0e915cbc9fce9375efcd3d45a53f060692f9727。控制文件仍只在候选工作区，未混入 I。
本轮 contract SHA-256=7ef0233ed1e7204789f86d40e871216fff66ee8eb729a5e428ac5177ce53da16；owner decision SHA-256=f7dbb21aca5e935c2738ce00c6ed34b218099b89331a2b20b77c0cc70ea65463；唯一 ledger 当时 SHA-256=4a9274b9308a98c55d5152d06daedc8b6760d0fd088cdbc25cabb5a87f4fdae8。C1 首次 reviewer 只读取固定合同/授权、clean I 与原始 focused gate 数据，不传实施 transcript。

clean I 依赖安装 pnpm install --frozen-lockfile --offline exit=0；clean-i-install.log 1367 bytes，SHA-256=7b2535611e3f845f0f152e1e0fca157ba2133c1bd0f8a6ee129af6befffc2f1d。安装不改版本/锁文件。
同 clean I 上完整 13 项 C1 focused 加 emoji/doc-links/diff 三项全部 exit=0，共 16/16；运行前后 clean，fingerprint 仍为 e42dd19ca752c0ee2dca966fb0e915cbc9fce9375efcd3d45a53f060692f9727。原始命令与直接 exit 为 focused-on-i.log，23140 bytes，SHA-256=afde1697194a55978b5064f5c4c6a47ecba3a6733bda33af5396a2047dd06264；duration=34.122s。全部 tested_implementation_sha/tree 即本节 I/tree；没有执行 full just ci 或正式 Q0 producer。
本次独立 C1 首次 review 输入为 prompts/2026-08-31-pg-01a-c1-review.md；新 Codex gpt-5.6-sol/max 只读会话，ordinal=1。C1_review_used=1 计入本次派发；若出现 blocker，因本 cycle repair 已用完，stop_for_owner，不自动加轮。

## C1 首次独立 readback 与上一 cycle 停止（owner-recovery-20260831-1）

本次 Codex 只读 reviewer 已退出：runner exit=0，duration=1279.248s，真实事件含 turn.completed。c1-review-1.log 为 1055804 bytes，SHA-256=c6157f00f01b8bf4d9fdb1734920873882900f5f610870fc400079ec2b803b5b；原始 c1-review-1.md 为 13423 bytes，SHA-256=c23c595d0a75ca8a91134ffe7b109f23b2b5651baa35a3eae8ea0173de64f615。上述 exit 是 reviewer 进程退出，不是产品门绿。
消费前运行 validate_review_manifest.py，明确绑定 I=004b226db0b9a6fb0347d60dc790c97293d11635、clean-I fingerprint=e42dd19ca752c0ee2dca966fb0e915cbc9fce9375efcd3d45a53f060692f9727、ordinal=1，实际 exit=0/status=valid/next_action=stop_for_owner。reviewer 结束后 supervisor 重新核对 git log、status 与 fingerprint，I/tree 不变且 clean。

reviewed_implementation_sha=004b226db0b9a6fb0347d60dc790c97293d11635；reviewed_implementation_tree=578f45078cde3e920912d108d1158dfefc7dc051；verdict=RED；C1-1 至 C1-8 为 5 [ok] / 3 [fail]；P0=0，P1=3，P2 ledger delta=[]。三个 blocker 均 in_scope=true、needs_owner_decision=false，但当前 repair_rounds_used=1，故停止，不自动新建 cycle：

- B1 / C1-1：现役中英文页面仍有数据绝不出设备、订阅零费用、任意兼容 API 和固定时延承诺。位置与原文证据见独立报告。
- B2 / C1-2：active-claim checker 漏检上述真实残留；组合 mutation 只验证免费短语命中，没有独立证明 full-support 反例被拦。
- B3 / C1-3：Q0 checker 接受 reason、locator_check、required_field_check 的伪造漂移；现有反例被 status 变化遮蔽。

同 I 原有 16 项定向门禁确实为绿，但独立 reviewer 的两项只读语义反例均 exit=1；前者不能掩盖后者。reviewer 受只读沙箱 EPERM 限制的 Vitest/临时 fixture 复跑明确标为未直接执行，并引用已核 SHA 的同 I 原始日志，未假称本会话直接运行成功。
归档报告为 docs/review/2026-08-31-pg-01a-c1-impl-readback.fable.md，273 行、13834 bytes，SHA-256=bba40db85f0c82c2bd2e2ca1649273ebc47e88e3daa345bd2c21a4756cf103f9。仅增加 supervisor 归档/supersede 元数据，独立正文与 manifest 不改写；归档 manifest 再验证仍 valid/stop_for_owner。不做 P2 sweep。

当前已形成仅本地 I，未形成 E；不 amend I 掩盖本次 RED。full_gate=[]；not_run_exact_set=just_ci_on_I,render_visual_QA,Q0_real_I_report,Q0_real_report_check,E_commit,week_audit_writer,week_audit_bundle,product_live,account_login,microphone,passkey,phone,hosted_ci,release_download,distribution_install,production_backup_migration,push,merge,deploy。G-A1/G-A4 未记 repo_closed；G-A2 仅有声明止损候选，不冒充治理闭环；deployed 状态未改变。

恢复指引：必须先获得 owner 对 B1/B2/B3 下一轮有界恢复的明确授权，才开启新的 cycle；保留本轮 RED 与计数。随后沿原 Grok 实施线修复，在原有本地 I/E 两提交边界内处理未发布 I，再对新候选进行一次 fresh readback。当前不启动实施、full gate、E producer、PG-01B 或其他语义 child。唯一 ledger 路径不变，未结 P2 ID 为空。主仓未被晋升，既存只读评估报告未动。
本轮最终恢复坐标、控制文件 exact set 和完整 dirty fingerprint 另存于 ignored logs/pg01a-recovery-20260831.fWhCEM/stop-checkpoint.json；该文件不自指，也不改变 clean I 的审查 fingerprint。

停止归档静态核对：bash scripts/check-emoji.sh exit=0/clean；node scripts/check-doc-links.mjs exit=0/files=121 broken=0；git diff --check exit=0。这些是控制文档归档检查，不是未运行的 full gate 或 E 账本门。

## owner-recovery-20260831-2 启动 checkpoint

owner 本次明确批准 B1/B2/B3 的下一轮有界恢复，授权原话只登记于 owner 决策单第 8 节。启动实测 HEAD=004b226db0b9a6fb0347d60dc790c97293d11635，parent=P，tree=578f45078cde3e920912d108d1158dfefc7dc051；完整 dirty fingerprint=9ea51163f7ad370c76ad7d64faf4da4623be9b6649764d01c561aade24b20342，与上轮 ignored stop-checkpoint 全等。本值为本轮控制文档更新前的恢复坐标。
旧 manifest 再校验仍 valid/stop_for_owner；该旧判决不被改绿。新授权允许本 cycle 的一次修复和一次 fresh rereview，预期 ordinal=2；修复与复审分别在实际派发时计数。source digest/48 authority digest 重新实测仍为 C1-8 固定值。主仓仍只有先前只读评估报告这一项非 ignored untracked，未被本批修改或晋升；当前没有 owned running CLI。
本轮日志唯一目录为 logs/pg01a-recovery2-20260831.i5h14e；继续原 Grok session=97B1C3A9-AA21-42DC-AF22-3DB75985FEA9。复审前重新形成并验证新 clean I，不能让旧 I 的 16 项绿灯或旧报告替新 I 背书。

派发输入为 prompts/2026-08-31-pg-01a-c1-recovery2.md；当前 cycle 的 repair_rounds_used=1 在本次派发计入。本轮范围是原 C1 总允许集合中的 36 个 exact 路径，七项 must_change；canonical、源输入、两份已修投影及 runtime 不变。验收细化对应既有 C1-1/2/3 和三项已证实 blocker，不降低原合同或覆盖旧发现。

## 第二次恢复的实际结果（尚未重新判绿）

原 Grok session 本次调用 runner exit=0，duration=1421.287s；真实 end_turn、modelUsage=grok-4.6-build。日志 repair-1.log 为 8259762 bytes，SHA-256=2d7f07e1aa38201080481ea370dd267c26c1b6495316b44e8a8c63125adb7a47，位于 logs/pg01a-recovery2-20260831.i5h14e。CLI 自身发生一次 auto_compact_completed 并正常结束，不是新建实施会话或增加修复次数。
本次派发前完整 fingerprint=3924fb11d4aa9887d67d1654c31c88d417e51002b9a8ef40ffe96f0e5df4250f；实施返回后=bba1cd3737d40220e1ad956dc6c162c42b36beb0ee958a20ff54c76bae0be378，HEAD 仍为旧 I。完整核对 2044 个路径，36 个允许路径之外的 2008 项路径/权限/bytes 摘要前后均为 8fabc4658b5f039459f053fdfa2308c0f42c8f172ab298981fddbae3385a6127；快照为同目录 pre-scope.json/post-scope.json。source digest 与 48 authority input digest 仍与 C1-8 固定值一致，两份投影未改动。

实际 recovery delta 为 12 路径，七项 must_change 全覆盖，全部在已验证的 36 路径范围内：

- deploy/saydo-octoooo-com/docs/index.html
- deploy/saydo-octoooo-com/en/docs/index.html
- deploy/saydo-octoooo-com/en/index.html
- deploy/saydo-octoooo-com/en/privacy/index.html
- deploy/saydo-octoooo-com/index.html
- deploy/saydo-octoooo-com/privacy/index.html
- docs/site/style-demos/11-hybrid.html
- packages/console/src/lib/setupApi.ts
- research/customer-question-corpus/check-q0-truth-report.mjs
- research/customer-question-corpus/test-q0-truth-mutations.mjs
- scripts/check-active-claims.mjs
- scripts/test-active-claims.mjs

supervisor 独立执行十项受影响 focused：active checker、active mutations、Q0 mutations、dry-run validator、console typecheck/lint/Vitest、emoji、doc-links、diff check，全部 exit=0。active mutations=12，Q0 mutations=38，console=33 files/279 tests；Q0 八字段的独立漂移、缺字段和错误类型均有各自输出。focused.log 为 6358 bytes，SHA-256=791605632d0f3aa05e357430af4c3388c30621db30bb1af3e81b05d55c211bf6；duration=8.027s。此处是 dirty recovery 结果，不冒充新 I 的语义判决或完整门禁。
恢复验收合同 SHA-256=93cc4fa7fa676ab4f8c60f73468815b43b24f264b649a2414c3fd99bcd11b608，owner 决策 SHA-256=5e123aa2236ddc8553d55f65244e98cd1a21139fc6857783db0f7993e1a5970b；唯一 ledger 保持空表。

## 更新后的本地 I 与同 SHA 定向门禁

先以本地 ref codex/pg-01a-c1-red-20260831 固化旧被拒 I=004b226db0b9a6fb0347d60dc790c97293d11635；不移动或改写旧报告。只 stage 本轮 12 个 exact 路径并复核 cached diff/name/stat/check 后，在 owner 第 7/8 节权限内 amend 未发布 I。实际 git log：I=2b5517d322f062297d25806b02c4106e2ecc60e8，tree=c5cae2f04ee907328b672e3099c865f1c3f83552，parent=P。P..I 为 33 路径、969 insertions/114 deletions，均在原 C1 允许集合；未让旧被拒 I 进入新 I 的祖先链。新增于上一 31 路径集合的仅中英文 privacy 页面两个路径。
原 validation worktree 经 status 空核实后以正常 detached switch 切到新 I；没有 reset/clean/强制丢弃。锁文件、依赖和环境没有变化，不重复安装。新 clean I 的 16 项原合同 focused 全部 exit=0，运行前后 clean；focused-on-i.log 为 24122 bytes，SHA-256=c37af2d284f60c61ffcc84612ca35c93c1ea15fd3d010ce3bb839dda40d4d816，duration=35.136s。全部 tested_implementation_sha/tree 为上述新 I/tree。
新 clean I 的 git-diff-v1=e42dd19ca752c0ee2dca966fb0e915cbc9fce9375efcd3d45a53f060692f9727；这是空 dirty diff 的摘要，与旧 clean I 相同是预期行为，审查身份必须同时绑定不同的 HEAD/tree，不能仅按摘要复用结果。
本次 fresh Codex gpt-5.6-sol/max 复审输入为 prompts/2026-08-31-pg-01a-c1-rereview2.md；review_ordinal=2，当前 cycle 的 rereview_rounds_used=1/C1_review_used=1 计入本次派发。只携带当前固定合同、B1/B2/B3 摘要、新候选坐标和必要定向证据，不传实施推理；仍不预跑 full gate 或正式 Q0 writer。

复审派发前 checkpoint/RECONCILE：validation HEAD/tree 与 clean git-diff-v1 均保持上述新 I 坐标；尚无存活 reviewer，本次已预留的计数不重复扣减。机器 SoT 实测更新为 policy_revision=2.3，旧合同 validator exit=5（policy_revision_mismatch、max_repair_rounds/max_rereview_rounds/second_red_action 不匹配）。按 --print-contract 同步唯一策略块，不改产品验收或 owner 原话。第 8 节钉住的一次修复已使用，不能因新全局上限而再扩充本 cycle；追加修复的 followup_authorized=false，原定一次 fresh rereview 和 GREEN 后门禁/E 继续。旧 RED 和历史日志不改写。

## C1 第二次独立 readback 与停止点

fresh Codex gpt-5.6-sol/max 只读进程已退出，runner exit=0、duration=785.867s、真实 turn.completed；新会话 ID=01a05839-6bb9-7aa0-837c-095b70d80b94。报告判 RED，C1 九项为六项 [ok]、三项 [fail]；不是 full gate 判决。B3/Q0 八字段一致性经独立负例核验关闭，B1/B2 仍为 P1，均 in_scope=true、needs_owner_decision=false。

- B1：release 材料仍有“全部保存在自己的设备”与 on-device 语音的绝对表述，官网中英文 FAQ 仍把任一 logged_in CLI 推成可开聊。位置：docs/release/2026-08-13-app-materials.md:59/70/170，deploy/saydo-octoooo-com/docs/index.html:892、en/docs/index.html:915。
- B2：现役 checker 对上述真实变体返回 0，独立内存负例 exit=1；12 项原 mutation 的绿灯未覆盖这些措辞。位置：scripts/check-active-claims.mjs:52、scripts/test-active-claims.mjs:96。
- B3：独立核验 baseline=986、八字段漂移/删除/错型及其他不变量均能被拒；不再列 blocker。P2 ledger delta=[]，不 sweep。

原始产物在 logs/pg01a-recovery2-20260831.i5h14e：c1-rereview-2.log 为 929458 bytes，SHA-256=fccc29c96123e2bd7343f232fb1e3c9ef382419380ad2ea148184e9d7bd248c3；c1-rereview-2.md 为 13542 bytes，SHA-256=f29d95e354fc2c723a5eee9f275989e00812e1d936ffa76726d55fbda2ae4898。归档报告为 docs/review/2026-08-31-pg-01a-c1-rereview-2.fable.md，SHA-256=9395ec0ea104a884d6fa760c338175567305247c4f5b1029b9c3eb66f5f101ba；只加来源说明，不改 reviewer manifest。

复审使用的合同 SHA-256=2a74991ec2af1c511490ce330c4c8440d0d77149923be6d9f1e9a7c791a264ad，派发前 validate_handoff exit=0/status=valid。返还后 HEAD/tree、clean git-diff-v1 与输入 digest 均再次核验未漂移。current policy 2.3 + cycle-state-review-2.json + expected task/stage/cycle/HEAD/fingerprint/ordinal 的 manifest validator 实际 exit=0、status=valid、next_action=stop_for_owner。该 cycle-state 的 repair/rereview used/reserved 均为 1，追加修复 followup_authorized=false 来源为 owner 第 8 节的一轮限定，不是假填预算或把 P2 升为 P1。

reviewer 本次实际 typecheck/ESLint/public redaction/dry-run/Q0 内存反例通过；Vitest 和需 mkdtemp 的 mutation 在只读 sandbox 被 EPERM 拒绝，报告如实保留，不作本轮重跑成功。原 16 项 focused 原始输出仍绑定同 I，不能覆盖语义 RED。
not_run_exact_set=just_ci_on_new_I,render_visual_QA,Q0_real_I_report,Q0_real_report_check,week_audit_writer,E_evidence_commit,product_live,account_login,microphone,passkey,phone,hosted_ci,release_download,distribution_install,production_backup_migration,push,merge,deploy。
执行线与评估线均已退出；未自动新增修复或复审，不移动候选或开启下一 PG。owner 所问的开发者/普通用户、本地/云端、订阅/API 快速上手目标仍未被全量验收，本轮不冒称支持。
收口控制文档门：全仓 emoji exit=0；active doc links exit=0（files=122 broken=0）；git diff --check exit=0；归档报告 manifest 再校验 valid/stop_for_owner。以上仅验证证据文件，不抵消产品 RED。最终状态与完整 dirty fingerprint 固化于同日志目录 stop-checkpoint.json；ignored checkpoint 不进入 candidate 指纹或 E。
额外全量检查 14 个未 tracked 文件时，三个原文归档报告的 Markdown 行尾双空格被 git no-index whitespace 检查拒绝（各 exit=3，汇总 exit=1）；其余 11 项无诊断。旧报告及本轮原始文本目前保持，不在此将格式告警隐藏为通过；后续若获准进入 E，须先处理归档格式并复核 manifest 不变。当前仅产品 I，不称 E 已可提交或所有收口门全绿。

## 2026-09-01 夜间恢复 RECONCILE

owner 明确恢复本现存 PG-01A 主交付；授权原文及范围见 owner 决策单第 9 节。检索现有 plan/review/evidence/prompts 与本批日志未发现已登记的 owner-night-recovery-20260901，因此仅建立该周期一次，不改旧 RED/计数。新周期最多三次产品修复、三次复审，同根因最多两次尝试和一次策略重置仍有界。E/正式 Q0 与 PG-01B 本夜排除；不预先 amend I。

实测 candidate HEAD=2b5517d322f062297d25806b02c4106e2ecc60e8、tree=c5cae2f04ee907328b672e3099c865f1c3f83552，完整 dirty git-diff-v1=19a6b658b78290f6763f495f1a4e955dfd313ee42462a1c6115b6910741891bd，与旧 stop-checkpoint 完全一致；没有额外修复落地。lsof 只读核验候选与 validation 目录中 task_cwd_processes=[]；没有继承或重复启动进程。

本机 policy_revision=2.3，SHA-256=785d7d2028a8cae799831c9a1ea4584ae75bd6b47f8970be282f516df990589a，与 owner 指定值相符；原 bytes 冻结于 logs/pg01a-night-20260901.V1D8er/v2-policy.json，副本摘要同值。不使用待审 V2.4。旧报告按此冻结 policy、原 cycle-state 与原 expected 身份再次验证为 valid/stop_for_owner；该旧判决保留，新授权才是新周期的依据。

当前只恢复 B1/B2：现役发布/官网承诺与 scanner 的真实措辞逃逸。B3/Q0 保持旧结论，只核 bytes 未变；不扩大 AI provider 实现或宣称各类用户已开箱可用。无产品范围变化，不派额外方案审查。下一步先以纯工具验证当前 contract/state/candidate，再将本轮明确范围交原 Grok4.6/xhigh 实施线；产品结果由 fresh Codex sol/max 只读评估。

夜间 repair 1 已退出：原 Grok session=97B1C3A9-AA21-42DC-AF22-3DB75985FEA9，runner exit=0，duration=451.677s，真实 stopReason=end_turn、modelUsage=grok-4.6-build。repair-1.log 为 1663412 bytes，SHA-256=c60ceb1f29ce43dc281f3a42590231c499eb84383b832a13a4ef5b51230a7f8f。派发前 preflight_valid，contract digest=7bf0a7aa06040584a6349aaf1524224030c097c83c33c45cd5a556947e1dd6b0；source fingerprint=d618d4261d618b31157959f4cea49e3a282cd9f0ae378c494668337841a118d1。实施返回后 source fingerprint=5fba2c32695568617ad0f7fef5893fe2de8bcd3b710ae9b8d062415cac76c549，HEAD 不变。
完整保护快照覆盖 2047 文件，34 允许路径之外的 2013 项前后摘要均为 981a813c53f3d67fc4de84fa841ea41d48ccc719a9c1e74d169952f7b8e50a25。实际产品 delta=8：中英文 docs、release app materials/metadata、Chat.tsx 文案、active checker/test、env 模板；五项 must_change 均出现。Q0、source、authority、投影和 runtime 未被此 repair 改动。证据为同日志目录 pre-scope.json/post-scope.json，不替代 git-diff-v1。
仅将这 8 项产品 delta 机械复制到现有 validation worktree（原 HEAD 相同且先前 clean），逐文件 bytes 与 changed exact-set 相等后用于门禁；未复制 owner/实施叙述或其他会话文档。当前无新 commit、正式 Q0 或 E。
夜间定向门禁在该 validation candidate 运行，HEAD=2b5517d322f062297d25806b02c4106e2ecc60e8，git-diff-v1=563fe14d69c19ca1b2c09dc7ac249214f25df94ad4e1b1e4bed14d4b68655fe3，前后不变。九项均 exit=0，active mutations=18、console=33 files/279 tests、redaction=28；runner duration=8.031s。focused-1.log 为 6409 bytes，SHA-256=4a9ba81209148286be2f655b4dc28e030ada4fcff428b0da99dcddc07f07f3f6。这是 HEAD+dirty product delta 的证据，不冒称新 I 或 full gate。
下一次 fresh Codex 为本夜第一次只读评审、修后 ordinal=2；rereview=1/C1_review=1 已预记该派发，不重复扣减。付费派发前将显式核验 frozen policy、contract/owner/state 和 validation HEAD/fingerprint；当前 open blockers 表示最后已知状态，待独立 verdict 再机械更新。

夜间 review 1 已退出：fresh Codex gpt-5.6-sol/max 只读 session=01a0599e-c323-7170-956f-3dbea1c09b1b，runner exit=0、duration=857.301s、真实 turn.completed。报告 RED，保留 B1/B2、B3 仍关闭、P2 delta=[]。原始报告 15649 bytes/SHA-256=8b16487bc4fdfe3b509bf60391513ed2e51a5a15effc1a8143a9a3fa536467e7；日志 885258 bytes/f692b9f7644b16f5ba10b3600c62780fb07f7041d3606df654f40924f88a34ac。归档为 docs/review/2026-09-01-pg-01a-night-readback-1.fable.md。
reviewer 确认上一轮点名句式已收紧，但同一 31 roots 仍有七类现役实际逃逸：SetupGate 登录态、中文/英文首页登录与订阅、中文/英文 docs 登录/额度、style demo 同类文案、SetupWizard API 秒回、release 绝对不上传用户数据。不是构造无限同义句；均在现有 34 路径和 C1-N-1/2 内，needs_owner_decision=false。checker 对七类 hits=[]，当前 green 仍为假绿。
冻结 policy + review-1-cycle-state + expected task/stage/cycle/HEAD/fingerprint/ordinal 的 manifest validator 实际 exit=0、status=valid、next_action=diagnose_and_repair_fresh。因此本轮第一次策略重置已预留：另起全新 Grok4.6/xhigh 实施上下文，不 resume 旧实现叙述，不更换 provider/model，仍只修 B1/B2；repair 2 尚未返回前 used 保持 1、reserved=2。

## 夜间策略重置、repair 2 与定向门禁

repair 2 使用全新 Grok4.6/xhigh 实施会话 `47c53a80-b8df-469e-907e-890974925d0e`，没有 resume repair 1、没有更换 provider/model，也没有 subagent。runner exit=0、duration=819.993s、stopReason=end_turn、modelUsage=grok-4.6-build。`repair-2.log` 为 3169990 bytes，SHA-256=`c3e929be81e6adfaed3fab2116554fccfa0e3e1c2367bdd1b4a28eed61e36ba3`。

本次策略重置先按固定 31 roots 全量核对当前正文，再处理 review 1 的七类现役实际逃逸；不把 scanner 扩成通用 NLP。相对 repair 1 的实际 delta 为 12 个允许路径：中英文 docs 与首页、release app materials、style demo、SetupGate、SetupWizard、GlobalSettings、active checker/test、config 模板。合并本夜两次修复后，validation candidate 的实际 dirty set 共 15 路径，全部位于 C1-N 的 34 path exact-set，且 source/validation 逐文件 bytes 相等。

repair 2 前后完整保护快照均覆盖 2016 个允许集合之外的文件，摘要同为 `feeae9b61a06a498825ec8c1da1d2ad2d11c8ab1d2b61c30d187a76f68a63e23`；证据为 `pre-scope-2.json`/`post-scope-2.json`。Q0/corpus、canonical、authority、dry-run、provider runtime 与其他会话控制文档均未被实施线改动。

supervisor 在 validation candidate 直接运行 9 项 affected focused，显式 unset `SAYDO_LIVE_E2E`/`SAYDO_SLOW_E2E`，使用隔离 TMPDIR；exit=0、duration=7.758055917s。起止身份均为 HEAD=`2b5517d322f062297d25806b02c4106e2ecc60e8`、git-diff-v1=`32ff760d7da4d797230267342b70b4f88999fa1f6e76df1daf0d9ad14f224964`，candidate_unchanged=true。九项 9/9：active roots=31、active mutations=28、public redaction=28、console=33 files/279 tests，typecheck、ESLint、emoji、117 文件 doc-links 与 diff-check 均 exit=0。结构化工具回执为 `logs/pg01a-night-20260901.V1D8er/focused-2-receipt.json`；它明确不是伪造的原始 stdout 日志，也不冒充语义 GREEN 或 full gate。

当前 repair_rounds_used=2/3，strategy_resets_used=1/1；B1/B2 同根因各已尝试两次，B3 仍关闭。下一步只预留一次 fresh Codex sol/max 只读复审，ordinal=3；复审前仍需重新校验冻结 policy、合同、cycle-state 与上述实际 candidate 身份。若同根因再次 RED，按同根因两次上限停止，不继续第三次机械返工。

复审 2 派发前纯工具预检已通过：冻结 V2.3 handoff status=valid；`review-2-cycle-state.json` 经当前 validator 的 `validate_cycle_state` 返回 errors=[]；validation HEAD/fingerprint 与 focused 2 一致；实际 dirty 路径恰为 15 项且与 source 对应产品文件逐项 bytes 相等；没有既存 owned CLI。ordinal=3 的 rereview_rounds_used/reserved=2/2 在本次派发预记，不重复扣减。

## 夜间 fresh readback 2 与停止点

fresh Codex `gpt-5.6-sol/max` 只读复审已退出：session=`01a059c1-e2fb-7820-a2f4-2d191650e8fb`，runner exit=0、duration=790.999s，日志存在唯一 `thread.started` 与唯一 `turn.completed`。原始报告为 10548 bytes、SHA-256=`0bf883ab89043c619cbf4491acde0feeb652490f3b161de668884d215d47fe33`；日志为 874910 bytes、SHA-256=`3aed12e71421435831cdcb0824468e832ff60f3df71341932a3ff67eed252707`。归档报告为 `docs/review/2026-09-01-pg-01a-night-readback-2.fable.md`。

独立 verdict 仍为 RED，稳定 blocker B1/B2 均为 P1、`in_scope=true`、`needs_owner_decision=false`，B3/Q0 继续关闭，P2 delta=[]。reviewer 证实上一轮十个点名旧句式已全部移除，SetupGate、首页、style demo、SetupWizard、release 与 metadata 均有真实进展；但 31-root 全量复核仍发现五条同根因现役残留：

- 中文 docs `deploy/saydo-octoooo-com/docs/index.html:158,837` 仍把订阅登录态或现有 CLI 登录推成推理供给/订阅额度。
- 英文 docs `deploy/saydo-octoooo-com/en/docs/index.html:159,860` 保留同类 subscription login/quota 推导。
- 英文 docs `deploy/saydo-octoooo-com/en/docs/index.html:862` 仍无条件称浏览器系统语音免费。
- checker 对上述五条 `scanner_hits=[]`，对应独立行为回归 needle 均不存在；当前 `[ok] active claims roots=31` 因而仍是假阴性。

复审结束后 validation candidate 身份再次实测不变：HEAD=`2b5517d322f062297d25806b02c4106e2ecc60e8`、git-diff-v1=`32ff760d7da4d797230267342b70b4f88999fa1f6e76df1daf0d9ad14f224964`，仍恰为 15 个产品 dirty 路径。冻结 V2.3 + `review-2-cycle-state.json` + expected task/stage/cycle/HEAD/fingerprint/ordinal 的 manifest validator exit=0，返回 `status=valid,next_action=stop_for_owner`。

本 cycle 已用 repair=2/3、rereview=2/3、strategy reset=1/1；B1/B2 两个 root cause 的修复尝试均为 2/2。虽然总轮数各还剩 1，同根因上限已经触发，故不启动 repair 3、不滚动新 cycle。语义未 GREEN，因此按原验收顺序没有运行完整 `just ci` 或页面 headless Chrome；不是将 focused 9/9 冒充 full gate。也未运行正式 Q0、E、PG-01B、真实 AI/connector/账号、付费、commit/amend、push、merge或 deploy。

公开限制保持：当前候选只证明若干过度承诺已被收紧与有限 scanner 回归变强，不能证明开发者或普通用户已能用全部本地/云端、订阅/API AI 服务开箱启动。进入下一产品修复需要 owner 明确决定是否为同一根因开启新的恢复授权或调整验收/策略上限；在此之前保留未提交 15 路径候选和全部旧 RED，不自行改写。

## 夜间最后槽位调度

根监督在 owner 既有夜间有界自动交付委托下登记决定 `saydo-pg01a-last-slot-20260901`：不是 owner 新回复，不新开 cycle、不增加 3/3 总预算、不增加 strategy reset；只释放尚未使用的 repair 3 / rereview 3。原决定文件与冻结副本 SHA-256 均为 `4611029bf3b02c350751b15f2d5e41b1a930c51399810ed23ff2f72b27cc8e0b`。ordinal 3 的 RED、`valid/stop_for_owner`、repair/rereview=2/2 和 root attempts=2 全部保留；仅对这一次特定 attempt 3 作有界例外。

RECONCILE 实测 source HEAD/fingerprint 仍为 `2b5517d322f062297d25806b02c4106e2ecc60e8` / `1050f6790bd11924c4d7c726bd19feb798f347e3561d6b1e71d7c25de18354dc`，validation 为同 HEAD / `32ff760d7da4d797230267342b70b4f88999fa1f6e76df1daf0d9ad14f224964`；ordinal 3 manifest 再验证仍 `valid/stop_for_owner`，没有存活 SayDo CLI。`grok sessions list` 确认原 implementation session `47c53a80-b8df-469e-907e-890974925d0e` 仍存在且为 local；本次只能 resume 它，恢复失败即停止。

repair 3 只允许中英文 docs 五条现役残留与 scanner/test 对应漏检，产品 exact-set 为四个路径。实施前要求完整遍历 31 roots；新发现不得借机扩范围。focused 后只派 fresh ordinal 4；RED 即终止，GREEN 才进入同候选 `just ci` 与中英文 docs 页面 QA。E、PG-01B、正式 Q0、真实服务、提交和晋升仍排除。

RECONCILE 另发现 ignored `night-state.json` 的 `rereview_rounds_used` 仍为过时值 1，而已验证的 ordinal 3 cycle-state、报告、stop checkpoint 与实际次数均为 2。派付费实施前机械改正为 2，并把 `procedural_recoveries_used` 从 1 记为 2；这不改旧报告、产品候选、repair/rereview 产品预算或 strategy reset。修订后的合同 SHA-256=`1acd33ba471f71209bbceb7d10fec1bb1f0162f677ab5c6a8967076268ebaa8d`，冻结 V2.3 handoff 校验仍为 valid。

repair 3 已在原 Grok session `47c53a80-b8df-469e-907e-890974925d0e` 返回，runner exit=0、duration=299.164s；真实终态为 `stopReason=end_turn`，modelUsage=`grok-4.6-build`，未新建 implementation session。`repair-3.log` 为 1418966 bytes、SHA-256=`720e1bf97e5a621cdd7109f57dbae8277add22da5f24ab9633303fa5634934f2`。本次 repair 3 已计入总预算，repair=3/3；两个特定 root cause attempts 按 last-slot 例外记为 3，strategy reset 仍为 1/1。

实施前后只允许的四个产品路径全部真实变化：中英文 docs、active checker、active mutation test；四路径之外 2049 个 tracked/非 ignored untracked 文件摘要前后同为 `68e70710da7d0558a478ff1f903a86b33e821f19f833112405dda0cd04db94b5`，status path set 也相同。证据为 `pre-scope-3.json` / `post-scope-3.json`。source 的四项产品 delta 已机械同步到既有 validation，15 个累计 dirty 产品文件逐项与 source bytes 相同；validation HEAD=`2b5517d322f062297d25806b02c4106e2ecc60e8`、git-diff-v1=`8455d6c5d42142b36cd7104e3b74989c64a2db6d2871af771610e598aa9fda49`。

首次机械同步因 `apply_patch` 不接受带行号的标准 hunk 头而在验证阶段原子失败；validation 指纹和四文件 hash 证实零部分写入。随后对同一 diff 仅去除 hunk 行号元数据后应用成功，没有扩大文件集或重跑产品实施。该格式插曲不占 repair/review 或 strategy reset。

同一 validation candidate 的 C1-N-L focused 已实跑 6/6 exit=0：active roots=31、active mutations=33、public redaction=28、emoji clean、doc-links files=117/broken=0、diff-check 无输出；起止 HEAD/fingerprint 同为上述 `2b5517d...` / `8455d6c5...`，candidate_unchanged=true。结构化直接工具回执为 `focused-3-receipt.json`，1117 bytes、SHA-256=`9b9e5e326be915318eeaab2a2643d2d2d0a048f4c9d763702fb5a223eb2490a8`；它不冒充 raw stdout 或语义 GREEN。

ordinal 4 付费派发前预检：冻结 handoff valid；`review-ordinal-4-cycle-state.json` 经官方 validator 内部 `validate_cycle_state` 返回 errors=[]；HEAD/fingerprint 与 15 项累计 dirty exact-set未漂移；该 fingerprint 没有既存 review；没有存活 SayDo semantic child。rereview=3/3 在本次派发预记，若报告无效只走程序恢复，不伪作产品 verdict。

fresh Codex `gpt-5.6-sol/max` ordinal 4 已退出：session=`01a059e3-8a15-7190-8976-1e838a5ccf43`，runner exit=0、duration=714.75s；日志存在唯一 `thread.started` 与 `turn.completed`。原始报告为 10836 bytes、SHA-256=`7f1134248f36cc0e24271b9efec76de7cb833cd1b0292c311f7e14b6783ab85a`；日志为 561852 bytes、SHA-256=`d71acb83c2a9958b9e7ebe6e2f4b599b52a33e581a8f3a6242a8ea1e4441ff04`。归档为 `docs/review/2026-09-01-pg-01a-night-readback-3-ordinal4.fable.md`，11656 bytes、SHA-256=`93fd04d861a793c3c07df1d823970d7ae9c23ad73dc3a1ff6d1708fe73b017a3`。

独立 verdict=GREEN：31 roots 全量列举；五条 ordinal 3 残留全部关闭；五个非法实例命中预期规则，四个合法反例均零命中；B1/B2 blockers=[]、P2 delta=[]。reviewer 明确这只是 step 语义通过，不代表 full gate、页面 QA、真实服务或最终交付。报告返回后 validation HEAD/fingerprint 仍为 `2b5517d...` / `8455d6c5...`。将 cycle-state 的 `current_blockers` 从上次已知 B1/B2 机械改为空后，冻结 V2.3 manifest validator exit=0，返回 `status=valid,next_action=full_gate`。

按合同现在只对同一 validation candidate 运行一次 `just ci`；这不是复审重跑。完整门禁产品失败时本 cycle repair 预算已达 3/3，不再修或换 provider；基础设施缺失则按原质量策略如实标状态。中英文 docs 页面 QA 仍在同候选 full gate 后执行。

## 同候选完整门禁与停止点

ordinal 4 manifest 验证为 `valid/full_gate` 后，supervisor 在同一 validation candidate 上仅运行一次 `just ci`，显式 unset `SAYDO_LIVE_E2E` 与 `SAYDO_SLOW_E2E`，没有调用真实产品服务。外部 runner exit=1、duration=91.313s；`full-gate-1.log` 为 72927 bytes、SHA-256=`e9b01f9c7bb98f1fd63b9e07b0500e9c36e06cd96153db85cfb2733824cec819`，summary 为 649 bytes、SHA-256=`9f57dd731f64eb421935fe102a4a9ec8d76bc7486404c40d535f664acabdaf28`。

真实失败位于 `packages/daemon/test/tier1-executor.test.ts:6404`：`executor ownership / recover abort 行为回归 > ownershipEstablished 必须在 durable owner 写完之后` 的第二次 `existsSync(agent-owner.json)` 期望 true、实际 false。daemon 汇总为 130 个 test files 通过、1 个失败、2 个跳过；2176 个 tests 通过、1 个失败、6 个跳过，随后 `ci-node` exit=1。失败测试文件不在 validation 的 15 项 dirty exact-set 中；工作区文件 blob 与 HEAD blob 均为 `0826a48756d7748815d7e003beb3c33f03163603`，`git diff --quiet -- packages/daemon/test/tier1-executor.test.ts` exit=0。源码显示 callback 观察到 owner 文件后，run 的终态路径会异步调用 `clearAgentOwnershipAfterDurable`；本次现象与两次断言之间的清理竞态相符，但未用重跑把这一推断冒充已证实的 flaky 结论。

完整门禁前后 validation 身份均为 HEAD=`2b5517d322f062297d25806b02c4106e2ecc60e8`、git-diff-v1=`8455d6c5d42142b36cd7104e3b74989c64a2db6d2871af771610e598aa9fda49`，candidate 未漂移。夜间决定明确要求 full gate RED 后停止，且 repair/rereview 已达 3/3；因此不重跑该单测或 `just ci`、不启动 repair 4、不换 provider，也不把 ordinal 4 的语义 GREEN 或 focused 6/6 冒充完整门禁通过。

中英文 docs 页面 headless Chrome QA 的前置条件是同候选 full gate GREEN，故本轮未执行截图或视觉结论。正式 Q0、E、PG-01B、真实 AI/connector/登录/付费、commit/amend、push、merge、deploy 也均未执行。当前状态为 `BLOCKED_FULL_GATE`：B1/B2/B3 的独立语义评审已关闭，但 PG-01A 尚未达到完整验收；下一步需要 owner 决定是否另行授权调查并修复这个门禁测试问题，不能声明开发者或普通用户、全部本地/云端、订阅/API AI 服务已开箱可用。

## FG-1 程序性瞬态恢复与最终停止

根监督依据既有夜间自动推进授权登记一次决定特例 `saydo-pg01a-fg1-transient-recovery-20260901`，文件 SHA-256=`d5c3097f6240b3069a984020551dfd1dc3c9b112a95adda3700c699afefa9ed3`。它不是 repair 4、rereview 4、strategy reset 或新 cycle，只允许一次 FG-1 定向复现；定向通过时再允许一次完整门禁重跑。首轮完整门禁 RED 与 repair/rereview=3/3 全部保留。

恢复前 RECONCILE 再次确认 validation HEAD=`2b5517d322f062297d25806b02c4106e2ecc60e8`、git-diff-v1=`8455d6c5d42142b36cd7104e3b74989c64a2db6d2871af771610e598aa9fda49`、15 项 dirty exact-set 全等；FG-1 测试文件 worktree/HEAD blob 仍同为 `0826a48756d7748815d7e003beb3c33f03163603`，diff quiet exit=0。首轮日志证明 package 原调用为 `vitest run --passWithNoTests`；定向命令仅在同一 daemon package 上增加 `test/tier1-executor.test.ts` 与唯一 `-t 'ownershipEstablished 必须在 durable owner 写完之后'` 过滤，并显式 unset live/slow 环境。

唯一一次定向复现 exit=0、duration=2.008s，实际为 1 test passed、154 skipped；原始日志 360 bytes、SHA-256=`5ab43f817a1f9d717b9befc82ac18ba8ebfc8884417907c2fc7a0deb27524987`，summary 682 bytes、SHA-256=`998d92303ff83572ecce7c4239b23d6451d78a0368f3355e36b59158325af6d3`。复现后 candidate 身份与 15 路径均未漂移；因此只将该结果分类为受控 transient evidence，不把单例通过冒充完整门禁 GREEN。

随后在相同 candidate 上执行第二次且最后一次 `just ci`。runner exit=1、duration=117.445s；仍是同一个 FG-1 在 `packages/daemon/test/tier1-executor.test.ts:6404` 的 expected true / received false，daemon 统计仍为 2176 passed、1 failed、6 skipped。`full-gate-2.log` 为 71936 bytes、SHA-256=`6ba20eba2b52e996b3e0db93f46bd92770af0d763515f146c4cff5db99b7a0a1`；summary 650 bytes、SHA-256=`50d7d728626158c6f797033a0ad2840d9196af0445761a7c28f9c0bfc5a117f3`。门禁后 HEAD/fingerprint 与 15 项 exact-set 仍不变。

FG-1 因此不是可由一次 isolated pass 关闭的门禁瞬态：它在两次完整 suite 中同点失败，现记为稳定的 full-gate blocker；是否扩展到 daemon/test 调查或修改已经超出当前授权，需要 owner 决策。依决定不第三跑、不改代码、不派 reviewer，也不运行以 full gate GREEN 为前置的中英文 headless browser QA。E、PG-01B、正式 Q0、真实 AI/登录/付费、commit、push、merge、deploy 继续未运行。

## owner-night-fg1-recovery-20260901 · FG-1 根因修复与本地完整验收（2026-09-01）

### 输入与旧证据保留

owner 明确授权一个新的有界 FG-1 恢复周期，仅调查并最小修复 daemon ownership lifecycle / suite timing 根因。启动 RECONCILE 实测 validation HEAD=`2b5517d322f062297d25806b02c4106e2ecc60e8`、`git-diff-v1=8455d6c5d42142b36cd7104e3b74989c64a2db6d2871af771610e598aa9fda49`，与授权锚点一致；上一周期 ordinal 4 语义 GREEN 和两次同点 full-gate RED 的日志 SHA-256 `e9b01f9c7bb98f1fd63b9e07b0500e9c36e06cd96153db85cfb2733824cec819`、`6ba20eba2b52e996b3e0db93f46bd92770af0d763515f146c4cff5db99b7a0a1` 均保留，没有清零或改写。

本 cycle 冻结 OctoWorkFlow V2.4 policy，SHA-256=`6368bc583926ffec4f038bb5c5ec4528957b62797ebe2822396d638868e136de`；task/stage/cycle 为 `project-gap-closure` / `PG-01A/FG-1` / `owner-night-fg1-recovery-20260901`。

### 修复与 focused

Grok `grok-4.6/xhigh` fresh implementation session=`01a05a3d-fc78-7bf0-ab57-00b5c72a8b9a`，runner exit=0、duration=2453.04s，真实 `stopReason=end_turn`、`modelUsage=grok-4.6-build`。原始日志 3123646 bytes，SHA-256=`1c6b59d68def9e69279e236456ce4a2a04678432efd8cafe0b1f6a9e8ac0821a`；summary SHA-256=`a0df6052c5d0a6304786f9881dacddc6a3880851a7922bdd58c3104d1b34cd8f`。

根因是旧测试把 recover 的 claim barrier 错当成 settle/clear barrier；production 的 durable owner publication → callback → resolve claim → proc.wait → settle → owner CAS cleanup happens-before 正确。产品 delta 仅 `packages/daemon/test/tier1-executor.test.ts` 6 行新增、2 行删除：保留 callback 内 owner 已发布断言，删除 `await recovering` 后 owner 必须仍存在的错误稳定态断言与固定 100ms sleep，改为等待 `activeRunCount()===0` 且 owner 已清理。两个 production may-change 文件与 HEAD 完全一致；protected 2029 路径摘要修前修后均为 `7661120cfe7abc30e6d705d1a3a7b0f73d7caca3c7f24fbf6dbf0f538d91ff7e`，旧 15 路径逐字节未变。

新 validation candidate 为同一 HEAD + 16 dirty paths，`git-diff-v1=d324b59bce25b1c3eedb0110c77e520f160f57bc44c2ad3e6b51552ac26444e8`。focused runner exit=0、duration=134.482s；日志 47132 bytes，SHA-256=`38b6a444f8c42895f0e073c331f3d6e663d1993782e2eec9cd498044853d484f`，summary SHA-256=`4c403a7a1b24b072515c2ef08132b1892ab86ec93a299e631c30035c74956928`：targeted 1 passed / 154 skipped；tier1 文件 155 passed；daemon suite 131 files passed / 2 skipped、2177 tests passed / 6 skipped；daemon typecheck、ESLint 与 `git diff --check` 全部 exit 0。ESLint 对测试文件给出 ignored-file warning，独立 reviewer 将其登记为 `P2-001`，不构成本次 P1。

### Fresh review 与 manifest

fresh zero-context Codex `gpt-5.6-sol/max` read-only session=`01a05a69-697c-7550-ac94-93cbcb8e2bb2`，runner exit=0、duration=614.44s，事件含唯一 `thread.started` 与 `turn.completed`。review log 426601 bytes，SHA-256=`117be3290e42c457b3c85a59a6f426ddb018f1cf1449968046c28b59d2edeb35`；raw report 9025 bytes，SHA-256=`d6a156fe6aaa351b8942981bddb0d6e99104475acb63e21a524efdf122171e42`。结论 GREEN、P0/P1=0、P2 delta=`P2-001`。

归档报告为 `docs/review/2026-09-01-pg-01a-fg1-impl-readback.fable.md`，6250 bytes，SHA-256=`c86f2403e86befd963dac43d03394cc2c918ac0026010e0a33e1ea8262021f13`。以冻结 policy、完整 cycle-state、expected HEAD/fingerprint/ordinal/task/stage/cycle 验证 raw 与归档 manifest，均真实 exit 0、`status=valid`、`next_action=full_gate`。

### 唯一完整门禁

同一未漂移 candidate 仅运行一次 `env -u SAYDO_LIVE_E2E -u SAYDO_SLOW_E2E TMPDIR=<isolated> just ci`。runner exit=0、duration=140.455s；原始日志 89073 bytes，SHA-256=`e6b99d5967462d7d24a735c0cd79174e67b6b01c8d7c81595d0623a7fce5f1d1`，summary SHA-256=`bc42b4837d464288cfa69e1bca36ed1f740b2d91379a090fd80f42185a5cbc7e`。日志末端真实记录 daemon 131 files passed / 2 skipped、2177 tests passed / 6 skipped，Node 全门、emoji/隐私/发布合同门、Python ruff 和 34 tests 均绿，最终行为 `[ok] just ci: node + python matrices green`。门禁后 fingerprint 仍为 `d324b59b...`。

### 中英文页面视觉 QA

通过隔离的 Chromium in-app browser 与只绑定 `127.0.0.1` 的临时静态服务加载：

- `deploy/saydo-octoooo-com/docs/index.html`
- `deploy/saydo-octoooo-com/en/docs/index.html`

两页均 `readyState=complete`、页面级 error 日志 0、全局横向溢出 0；本轮 9 条中文与 9 条英文公开声明变体全部 `present=true/rendered=true`。全页与概览/快速开始/费用/FAQ 的 10 张截图已逐张目检，目标文案清晰，无明显截断、重叠或遮挡；懒加载页尾图实际 HTTP 200、`naturalWidth=192`，broken image 0。浏览器工具调用不产生 POSIX 退出码，故 receipt 诚实记录 `exit_code=null/tool_status=success`；receipt SHA-256=`bd98327b45310eb9395b3de4e9186710a4238a0095088031094be863a378faa8`。本地证据校验器真实 exit=0，核对 receipt 与 10 张截图哈希；verify log SHA-256=`af53509e15b0cdd1b85da2af3acd2a4423c2417960dfa5cc7cf0a69ecea8514c`，summary SHA-256=`15fcf6853beb58991d1f9265b767ed6a0333fcf8aa1cc1396d83c73ba384b97c`。完整截图哈希清单见该 receipt；QA 后标签页与临时服务均已关闭。

### 状态与边界

FG-1 当前达到本地验收闭环：focused GREEN + fresh independent GREEN + manifest valid/full_gate + same-candidate `just ci` exit 0 + 中英文视觉 QA success。V2.4 cycle-state 保持 repair used/reserved=1/1、rereview=0/0、reset=0/0，review ordinal=1；未新增 owner cycle。唯一 P2 ledger 新增 `P2-001=open`，本步骤不做 final P2 sweep。

这仍是 HEAD + dirty candidate，不是发布或新 implementation SHA。未运行 E、PG-01B、正式 Q0、真实产品 AI/connector/登录/订阅/API 调用、账号/麦克风/设备/跨平台矩阵、付费、commit/amend、push、merge、deploy；也没有降低权限、关闭 CI 或更换 provider/model。当前公开声明只证明“已接线并通过调用验证”这一条件边界，不证明全部本地/云端、订阅/API 服务对所有用户天然开箱可用。

## 收口（2026-09-02）

> 依据：owner 2026-09-02 当前消息授权「全部实施后提交完整更新并合并所有 worktree/分支」；本节由主会话（supervisor 角色）执行 program §20.2 第 4/5/7 步，不派新实施线、不新增 reviewer。

- batch_id：`PG-01A`
- plan_section：PLAN-2「PG-01A · public-claim-corpus-stoploss」；program §20.4 PG-01A
- predecessor_sha：`79211f6fec5c6eb092419c1871e35d8eedc4e3e5`（PG-00 E）
- implementation_sha：`2a786ed803f8229ea2fefe8240d9e644306331c4`
- implementation_tree：`6cb66c57dc0ecda7389593c5a7dc02dd70e5647c`
- parent(I)=P：`git log -1 --format=%P` 实读 `79211f6fec5c6eb092419c1871e35d8eedc4e3e5`
- I 形成方式：对未发布 I `2b5517d322f062297d25806b02c4106e2ecc60e8` 作 amend（owner 决策单第 7/8 节允许调整未发布 I），以 explicit pathspec 加入夜间恢复与 FG-1 的 16 个已核验产品路径；amend 前 `git diff --cached` 为空，staged=16。旧被拒 I `004b226…` 固化于 `codex/pg-01a-c1-red-20260831`，最终 E 祖先链只含 P→I。
- changed_path_exact_set（P..I，36 路径，`git diff --name-only` 实读）：`AGENTS.md`、`HANDOFF.md`、`README.md`、`deploy/saydo-octoooo-com/docs/index.html`、`deploy/saydo-octoooo-com/en/docs/index.html`、`deploy/saydo-octoooo-com/en/index.html`、`deploy/saydo-octoooo-com/en/privacy/index.html`、`deploy/saydo-octoooo-com/index.html`、`deploy/saydo-octoooo-com/privacy/index.html`、`docs/06-references.md`、`docs/11-ui-spec.md`、`docs/release/2026-08-13-app-materials.md`、`docs/release/metadata.json`、`docs/site/style-demos/11-hybrid.html`、`justfile`、`packages/console/src/components/SetupGate.tsx`、`packages/console/src/components/SetupWizard.tsx`、`packages/console/src/components/SupplyPicker.tsx`、`packages/console/src/components/setupWizardUx.test.tsx`、`packages/console/src/lib/resourcePlans.test.ts`、`packages/console/src/lib/resourcePlans.ts`、`packages/console/src/lib/setupApi.ts`、`packages/console/src/pages/Chat.tsx`、`packages/console/src/pages/GlobalSettings.tsx`、`packages/daemon/test/tier1-executor.test.ts`、`research/customer-question-corpus/README.md`、`research/customer-question-corpus/check-q0-truth-report.mjs`、`research/customer-question-corpus/dry-runs/01-three-pass-dry-run-result.md`、`research/customer-question-corpus/dry-runs/02-dry-run-remediation-plan.md`、`research/customer-question-corpus/test-q0-truth-mutations.mjs`、`research/customer-question-corpus/validate.mjs`、`scripts/check-active-claims.mjs`、`scripts/test-active-claims.mjs`、`templates/saydo.config.dev.example.toml`、`templates/saydo.config.example.toml`、`templates/saydo.env.example`。其中 `packages/daemon/test/tier1-executor.test.ts` 不在 program §20.4 原 scope roots 内，来源是 owner 决策单第 9 节夜间授权下的 FG-1 有界恢复（`docs/plan/IMPL-PROMPT-PG-01A-FG1.md` §2 may-change），且产品代码 `executor.ts`/`restartPolicy.ts` 与 P 全等。
- 与已复审候选的等价证明：ordinal 4（C1-N）与 FG-1 ordinal 1 两份 GREEN 均绑定 `HEAD=2b5517d + dirty`（`git-diff-v1` 分别为 `8455d6c5…` 与 `d324b59b…`）。amend 前对 16 个 dirty 路径逐一 `git hash-object <file>` 与 `git rev-parse 2a786ed:<file>` 比对，mismatch=0；P..2b5517d 的其余 20 路径 bytes 未动。因此 readback 的 reviewed_implementation_sha 为历史候选身份，其 bytes 与顶层 implementation_tree 全等；本批未对新 I 追加第二名 reviewer（复审预算：本 cycle rereview 0/0 未动用）。
- decision_file_sha256_exact_set：`docs/plan/2026-08-28-project-gap-owner-decisions.md` = `983452a68e35a793b9394ced759e5b8ded43f83a00ae72b4925d30c45a75d9a6`（含第 6–9 节授权；与 ordinal 4 readback 记录的 owner decisions digest 全等）。
- sp2d_state：`N/A(claim-only 批，PLAN-2 PG-01A 未登记 SP2d 触发)`
- 入库前脱敏：按 R114 建立的「归档文档不含本机绝对路径」纪律，对本批 15 个 prompt/report/control 文件把 `<worktree>`/`<validation-worktree>`/`~/.octoworkflow`/`~/.codex`/`<repo>`/`<codex-work>` 替换本机绝对路径（`git status` 逐文件 grep 复核为零命中）。因此各 readback 中记录的 IMPL-PROMPT digest（如 ordinal 4 的 `1acd33ba…`）对应派发时 bytes，而非入库 bytes；入库 bytes 以 E 的 blob 为准。产品路径与 Q0 report 未做任何替换。

### focused_gate（clean I worktree `<validation-worktree>` @ `2a786ed`，tested_implementation_sha/tree 与顶层全等）

| command | exit | log |
|---|---|---|
| `node research/customer-question-corpus/validate.mjs` | 0 | `logs/pg01a-close-20260902/focused-I.log` |
| `node research/customer-question-corpus/test-mutations.mjs` | 0 | 同上 |
| `node research/customer-question-corpus/simulations/validate-simulations.mjs` | 0 | 同上 |
| `node research/customer-question-corpus/simulations/test-simulation-mutations.mjs` | 0 | 同上 |
| `node research/customer-question-corpus/dry-runs/validate-three-pass-dry-run.mjs` | 0 | 同上 |
| `node research/customer-question-corpus/dry-runs/test-dry-run-mutations.mjs` | 0 | 同上 |
| `node scripts/test-public-text-redaction.mjs` | 0 | 同上 |
| `node scripts/check-active-claims.mjs` | 0（`roots=31`） | 同上 |
| `node scripts/test-active-claims.mjs` | 0 | 同上 |
| `node research/customer-question-corpus/test-q0-truth-mutations.mjs` | 0 | 同上 |
| `bash scripts/check-emoji.sh` | 0 | 同上 |
| `node scripts/check-doc-links.mjs` | 0 | 同上 |
| `git diff --check 79211f6…..2a786ed…` | 0 | 同上 |

focused-I.log：20113 bytes，SHA-256=`08dead7577a1c5680efcd77bbb7190afc05a95d7043908432b1a5e07f210dba2`。上述 13 项运行后 worktree 仍 clean（porcelain 空）。

### Q0 truth report（E artifact）

- producer argv：`node research/customer-question-corpus/check-q0-truth-report.mjs --write --output research/customer-question-corpus/review/23-pg01a-q0-truth-report.json --implementation-sha 2a786ed803f8229ea2fefe8240d9e644306331c4 --implementation-tree 6cb66c57dc0ecda7389593c5a7dc02dd70e5647c`，在上述 13 项 read-only 门之后于 clean I worktree 运行，exit 0，`objects=986`。
- checker：`--check research/customer-question-corpus/review/23-pg01a-q0-truth-report.json` exit 0；`test-q0-truth-mutations.mjs` exit 0。
- aggregate：`valid_count=0`、`unresolved_count=986`；dispositions `A-RAG-01`/`A-RAG-02`/`B-VAL-01` 均 `owner_downgraded_with_public_limit`（reason `pg01a-safety-downgrade`）。按 program §20.4：`unresolved_count>0` 时 G-A1 只表示本批完成处置，`repo_status` 不得写 closed。
- report raw：395227 bytes，SHA-256=`be5ff653d59f6c866cab32943eca205cc2fec1484255722dd59f3c2aed4d81c1`；从 validation 复制到本 worktree 同路径后 SHA-256 全等，随后从 validation 删除以保持 clean。

### full_gate

| 次序 | command | tested sha/tree | exit | 说明 |
|---|---|---|---|---|
| 1 | `env -u SAYDO_LIVE_E2E -u SAYDO_SLOW_E2E TMPDIR=<scratchpad 深路径> just ci` | `2a786ed`/`6cb66c57` | 1 | **环境错误，不计产品失败**：`packages/platform` `home-lock.test.ts` 两例因 tsx IPC Unix socket 路径 `<TMPDIR>/tsx-501/<pid>.pipe` 超过 macOS `sun_path` 上限而 `EADDRINUSE`，其余包未运行（fail-fast）。日志 `logs/pg01a-close-20260902/full-gate-I.log` 9737 bytes，SHA-256=`15dc17ed91fd88e08c19e19f278e7d31276a8fb77402c65684240f13703aa63d`。不占用产品修复预算（程序性恢复：仅更换 TMPDIR）。 |
| 2 | `env -u SAYDO_LIVE_E2E -u SAYDO_SLOW_E2E TMPDIR=/tmp/sd-close.XXXXXX just ci` | `2a786ed`/`6cb66c57` | 0 | duration=128.515s；contracts 111、platform 72 passed/14 skipped、console 279、cli 49/1 skipped、daemon 131 files/2177 tests/6 skipped、Python ruff + pytest 34；末行 `[ok] just ci: node + python matrices green`。日志 `logs/pg01a-close-20260902/full-gate-I-2.log` 89884 bytes，SHA-256=`51afe87f5ee813f1baad1b67f66fae60a37c30bb11f35eb05b10adad90848368`。门后 validation porcelain 仍空。 |

### readback（历史节已详述；此处只列身份）

| reviewer | reviewed sha / fingerprint | report | verdict |
|---|---|---|---|
| fresh Codex gpt-5.6-sol/max（C1-N ordinal 4） | `2b5517d` + `8455d6c5…` | `docs/review/2026-09-01-pg-01a-night-readback-3-ordinal4.fable.md` | GREEN；B1/B2 关闭；A=0 |
| fresh Codex gpt-5.6-sol/max（FG-1 ordinal 1） | `2b5517d` + `d324b59b…` | `docs/review/2026-09-01-pg-01a-fg1-impl-readback.fable.md` | GREEN；P0/P1=0；P2 delta=`P2-001` |
| 更早 C0/C1 各轮（RED→GREEN 链） | 见本文件历史节 | `docs/review/2026-08-31-pg-01a-*.fable.md`、`2026-09-01-pg-01a-night-readback-{1,2}.fable.md` | 历史 RED 保留 |

### A_ID_disposition

| id | repo_status | deployed_status | evidence |
|---|---|---|---|
| G-A1 | `repo_downgraded`（986 source 全部 `unresolved`，按 D2 安全缺省降级；不是 closed） | `blocks_expansion` | Q0 report（上节）；`research/customer-question-corpus/README.md` unresolved 标记 |
| G-A4 | `repo_closed`（31 个 active roots 的公开承诺收紧到「已接线并通过调用验证」条件边界；scanner + 33 mutation） | `blocks_expansion`（待部署授权后按官网/公开快照 digest 核对） | ordinal 4 readback；`scripts/check-active-claims.mjs` |
| G-A2 | `stop_loss_recorded`（`AGENTS.md`/`justfile`/README 的「本地 CI 等效」总括改为「本地 Node/Python 基线」；关闭归 PG-03） | n/a | I diff `AGENTS.md`/`justfile`/`README.md` |

- not_run_exact_set：`pnpm exec playwright test`（PG-01A 批卡 full gate 只列 `just ci`）；托管 CI；跨平台真机；live/真实 AI/账号；deploy。
- rollback_or_safe_default：`unsupported_or_conditional + repo_closed_only + no_deploy`；回滚只能回到更保守文案或关闭投影。
- E 前归一：`git diff --check P..E` 为硬门，三份归档 reviewer 报告含 Markdown 双空格硬换行（trailing whitespace），E 前统一去除行尾空白（内容不变）。归一后 SHA-256：`docs/review/2026-08-31-pg-01a-c0-impl-readback.fable.md` 9505 bytes `df1c261aec361bff80472239b0d272b614e6d264b5fddd8fe4c8b1427721bc7a`；`docs/review/2026-08-31-pg-01a-c1-impl-readback.fable.md` 13808 bytes `22e0cdb0cce709a7c95cd4d47c93c60512ca49bae74d97586a97fecc15374f54`；`docs/review/2026-08-31-pg-01a-c1-rereview-2.fable.md` 14182 bytes `d2ccc1f176c297f83ab65247fc2c3ccb17b058d1c7e5fa4258dc2df79d5a661f`。journal R120/R121 记录的归档副本 digest（`bba40db8…`/`9395ec0e…`）为归一前值。
- 公开树隐私探针：`node scripts/check-public-tree-privacy.mjs --ref <E>` 命中 13 个文件、类别均为 `home-macos`，全部来自 PG-00 E（`79211f6`）入库的 `prompts/206–207`、`research/codex-findings/206–220` 与 journal R119 一行，不属于本批 pathset；本批 39 路径零命中。该 13 处在随后的月度对账提交中脱敏（见 journal R127），PG-00 的 E 门列表未含隐私探针属 PG-00 缺口。
- E pathset（本节写入后由 E 提交承载，E 不写自身 SHA）：`history/PROCESS-JOURNAL.md`、`HANDOFF.md`（指针 `active=none,next=PG-01B`）、`docs/plan/IMPLEMENTATION-PLAN-2.md`（PG-01A 状态行）、`docs/plan/2026-08-28-project-gap-owner-decisions.md`、`docs/plan/2026-08-28-project-gap-closure-program-DEFERRED-P2.md`、`docs/plan/IMPL-PROMPT-PG-01A.md`、`docs/plan/IMPL-PROMPT-PG-01A-FG1.md`、`docs/plan/project-gap-closure-cycle.json`、`docs/plan/project-gap-closure/{control.json,policy.frozen.json,fg1-carry-in-red.md,fg1-repair-1.receipt.json,fg1-review-1.receipt.json}`、`docs/review/` 7 份 PG-01A readback、`prompts/` 16 份 PG-01A 派发 prompt、本文件、`research/customer-question-corpus/review/23-pg01a-q0-truth-report.json`，加 `node scripts/week-audit.mjs --write` 七项固定输出的实际变化子集。
