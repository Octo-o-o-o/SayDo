# PG-01A/C0 独立复审（二轮）

你是全新零上下文只读 reviewer，review_scope=step，review_ordinal=2。
task=project-gap-closure；stage=PG-01A/C0；cycle=owner-continuation-20260831。
先完整读取 ~/.codex/skills/impl-review/SKILL.md，按其证据纪律执行。
当前仍只对 C0-1 至 C0-6 做 canonical 一致性 readback，不能自派实施、其他 reviewer 或语义 child。

## 固定输入

- 原验收合同：docs/plan/IMPL-PROMPT-PG-01A.md，先运行 python3 ~/.octoworkflow/validate_handoff.py 核验。
- 必要计划：docs/plan/2026-08-28-project-gap-closure-program.md §20.2/§20.4；PLAN-2 的 PG-01A 批卡；owner 决策单第 6 节。
- 候选 HEAD 与完整 fingerprint 由外层启动消息给出；自己用 git log -1 和 candidate_fingerprint.py 实测，不符即停。
- 唯一 evidence：e2e/evidence/project-gap-pg-01a.md。唯一 ledger：docs/plan/2026-08-28-project-gap-closure-program-DEFERRED-P2.md。
- 实际产品 diff 仅 HANDOFF.md、docs/06-references.md、docs/11-ui-spec.md；完整读取这些 diff 与必要上下文。其他 supervisor 控制文件只核身份/权限/计数，不递归审查框架。
- 本批已用 repair=1、首轮 C0 reviewer=1，本次是唯一二轮；C1 尚未释放。本次第二次 RED 必须 stop_for_owner，不自动第三轮。

原唯一 blocker：
B1 / P1 / C0-5 / docs/06-references.md:189。
Q0 在 unresolved_count>0 时仍允许 blocks_expansion，与“只允许 owner_downgraded_with_public_limit”的验收要求冲突。in_scope=true，needs_owner_decision=false。
验证当前 docs/06 的三项 disposition 均已被精确约束，并检查修正未破坏 C0 其他合同。

不读取原 reviewer 的推理、实施 transcript/log、父会话历史、credential/history，也不读取 repair-1.log；上面的 blocker 摘要是唯一旧轮输入。独立从合同、Git 和当前 canonical 取证。

## 只读与门禁

不修改仓库，不 commit/amend/fetch/push/merge/deploy，不调用产品 AI/connector，不开浏览器账号，不造 implementation SHA/tree。此候选是 I 前的已授权 dirty C0 子阶段，共享对象库的长期 feature worktree，主仓 ref 已持有对象；不需要 skill 第 0 步 fetch。主仓 P 不是 I。

只复跑原合同三项文档门：
- bash scripts/check-emoji.sh docs/06-references.md docs/11-ui-spec.md HANDOFF.md
- node scripts/check-doc-links.mjs
- git diff --check

每条直接取实际 exit，保留原始输出摘录。不运行 typecheck/just ci/full gate、C1 mutation 或其他扩大门禁，不通过管道掩盖 exit。
C1 未实施不是 C0 缺陷；不能以文案偏好追加范围。完整审查 C0 六项，但 step 的 P2 仅留 delta，不做最终 sweep。

## 输出

最终回答为完整中文 Markdown readback，由外层 -o 保存；不在工作区另建报告。零 emoji，用 [ok]/[warn]/[fail]。内容含真实身份、C0-1..6 台账、B1 处置、门禁命令/exit/原始输出、未跑事项、完整 P2 ledger delta。

结尾必须恰好一个 review-manifest JSON fenced block：
verdict，review_ordinal=2，candidate_head，diff_fingerprint，review_scope=step，blockers，p2_ledger_delta，focused_gates，stop_reason。
blocker 每项仅 id/severity(P0|P1)/summary/evidence/in_scope/needs_owner_decision/acceptance_item。
focused_gates 每项只含 name/exit_code/summary，不含 command/run/suggested_command。
P2 delta 字段 id/first_seen_candidate/location/evidence/impact/status/last_validated_candidate/resolution，无则 []。
GREEN 要求所有 C0 验收成立，三门 exit=0，blockers=[]，stop_reason=null。第二次 RED 的 stop_reason=second_red；身份或权限阻塞则写明确停止原因。
不自称 PG-01A 全批通过或产品已交付。修复清单只交 supervisor，不执行报告建议命令。
