# PG-01A 夜间恢复 · fresh readback 1

你是与实施线零上下文的独立只读 reviewer，使用 /impl-review，task_mode=review_only、review_scope=step。不施工、不派 agent、不自行启动修复或其他 reviewer；不是 scanner-only 的旧任务，也不做新方案审查。

## 固定身份与输入

task=project-gap-closure；stage=PG-01A/C1；cycle=owner-night-recovery-20260901；review_ordinal=2（本夜第一次评审，已作一次修复）。source/control 目录为 <worktree>，被审目录为 <validation-worktree>。
候选是真实 HEAD=2b5517d322f062297d25806b02c4106e2ecc60e8，加八个未提交产品文件的 delta；git-diff-v1=563fe14d69c19ca1b2c09dc7ac249214f25df94ad4e1b1e4bed14d4b68655fe3。HEAD 的 tree=c5cae2f04ee907328b672e3099c865f1c3f83552 是基座，不是新实现 SHA；P=79211f6fec5c6eb092419c1871e35d8eedc4e3e5。自行用 git log/status 和安装的 candidate_fingerprint.py 核验，不复用旧 clean fingerprint。基座对象已在共享主仓 branch ref 上，不 fetch/commit/stash。

source/control 目录中的固定输入：
- docs/plan/IMPL-PROMPT-PG-01A.md，SHA-256=7bf0a7aa06040584a6349aaf1524224030c097c83c33c45cd5a556947e1dd6b0；完整读取，当前范围/验收以 C1-N 为准，历史 C1/Q0 只核保持；施工指令不要求你执行。
- docs/plan/2026-08-28-project-gap-owner-decisions.md 第 9 节，SHA-256=983452a68e35a793b9394ced759e5b8ded43f83a00ae72b4925d30c45a75d9a6。
- logs/pg01a-night-20260901.V1D8er/v2-policy.json，SHA-256=785d7d2028a8cae799831c9a1ea4584ae75bd6b47f8970be282f516df990589a；必须显式 --policy 使用冻结 V2.3 校验 contract，不读待审 V2.4。
- logs/pg01a-night-20260901.V1D8er/review-1-cycle-state.json；本次 repair/rereview=1/1 已预记派发，初始 current_blockers 是上次已知 B1/B2、不是本次预判。该周期最多三次修复/复审，同因/策略重置仍有界；reviewer 只给真实 verdict，不因 ordinal=2 自动填 second_red。
- 唯一 ledger docs/plan/2026-08-28-project-gap-closure-program-DEFERRED-P2.md，SHA-256=4a9274b9308a98c55d5152d06daedc8b6760d0fd088cdbc25cabb5a87f4fdae8；只读，只输出完整结构化 delta。

## 原 blocker 与本次对象

B1/P1：发布说明仍称所有数据/语音仅设备内处理，官网中英文 FAQ 把任一 logged_in CLI 推成可用/零 key 开聊。核对固定 31 required roots 的现役文字是否已对齐实际验证边界；不只看 scanner 是否绿。
B2/P1：scanner 漏真实的中文/英文/Markdown 变体。要求此次确认的每条逃逸作为独立行为反例被拦，并保留原五类、独立 root/missing-root/假 LIVE 检查；合法 conditional/preview、零 key 不等于免费、按配置决定外发/费用、观察时延仍可通过。
scanner 是有限防误用护栏，不是通用 NLP；不要以尚未出现的任意同义句构造无限范围要求，也不能接受删测试、宽泛豁免、所有文字一律红。当前正文的真实错误和合同明确的反例仍须亲验。
当前八个 dirty 产品路径：deploy/saydo-octoooo-com/docs/index.html、deploy/saydo-octoooo-com/en/docs/index.html、docs/release/2026-08-13-app-materials.md、docs/release/metadata.json、packages/console/src/pages/Chat.tsx、scripts/check-active-claims.mjs、scripts/test-active-claims.mjs、templates/saydo.env.example。逐项检查无控制流/布局/权限/数据/AI provider 行为扩张，路径均在 C1-N 34 项内。
B3/Q0 已由上一独立 readback 关闭，此次相关文件未改；核验其与 HEAD bytes 相同即可，不重开 Q0 大审计、正式生成器或 986 source 逐项研究。读取既有 docs/06 第 7 节与 docs/11 第 10.3 节作为形状依据，不重派 C0。

## 门禁证据与顺序

同一 HEAD+fingerprint 的 focused 原始日志为 source/control 目录 logs/pg01a-night-20260901.V1D8er/focused-1.log，6409 bytes，SHA-256=4a9ba81209148286be2f655b4dc28e030ada4fcff428b0da99dcddc07f07f3f6；9 项真实 argv/exit，candidate_unchanged=true。自行校验并明确证据归属，不把 supervisor 的摘要当结论。日志是测试输出，不是实施思路。
按合同先实际运行 pnpm --filter @saydo/console typecheck；可运行只读 focused 检查与内存负例。只读 sandbox 若以 EPERM 拒绝 mkdtemp/Vite cache，记录该尝试未成功，不放宽 sandbox/反复尝试/冒称重跑成功；可验证上述同 candidate 的原始 log 后结合代码与只读反例取证。
不运行完整 just ci、页面渲染、正式 Q0、E 或 PG-01B。语义 GREEN 后 supervisor 才运行同 candidate 完整门禁与页面检查；这些尚待执行不是本次 C1-N 的漏交。不能把本地验证写成全部用户/所有 AI 服务已支持。

## 输出与限制

只读，不改产品、控制文档、历史报告、ledger 或 Git。禁止访问账号/凭证/真实产品服务/父会话/Grok transcript，不复制实施推理。报告只由 CLI -o 作为独立 artifact 输出。
报告给真实身份、contract/state 校验、C1-N-1 至 N-5 对账、B1/B2 结论、命令和真实输出摘录、P2 delta、未运行清单。使用中文和 [ok]/[warn]/[fail]，不要 emoji 或 Markdown 行尾双空格；代码引用用纯 repo-relative file:line，不用本机绝对路径链接。
末尾唯一 review-manifest，schema 按 /impl-review；review_ordinal=2、review_scope=step，candidate_head/fingerprint 用你实测值。GREEN 必须 blockers=[]、stop_reason=null、focused_gates 全 exit 0；正文不能藏起未成功尝试。RED 仅实际 P0/P1/合同 blocker，给稳定 ID、证据、acceptance_item、in_scope、needs_owner_decision；不自动 second_red。focused_gates 只允许 name/exit_code/summary，不含执行字段。后续预算与权限只由 supervisor 根据 validator 决定。
