# No-Go

审计静止点：2026-07-30 01:08 +0800。迁移提交 `f28489d14af78d67d6ed3d223395d172b7e6056c` 的迁移完整性结论不被推翻；`No-Go` 针对当前未提交回修的封账、部署、四场真人验收与正式发布。

## A 级发现

### A-1：恢复候选点有效，但自动备份的语义闭包仍不完整

当前候选点 `/Users/wangyixiao/.saydo/backups/20260729T163416Z` 本身通过了严格校验：

- `verify-snapshot.mjs` exit 0：`entries=4 digests=verified foundation=restorable extras=0`。
- SQLite immutable `quick_check=ok`。
- SQLite、全局 sessions、唯一 active 项目的 foundation/knowledge 均存在；数据库 active project ID 与 manifest `projectId` 一致。
- foundation pointer、manifest、status、generation、`knowledge/current` 均为 generation 3；四份知识文档存在。
- 数据库 2 个 session 的 `transcript_path` 均映射到快照内对应 JSONL，数量为 2/2。
- sessions、foundation、knowledge 与当前源执行 `git diff --no-index --quiet` 均 exit 0；快照无 WAL/SHM。

但一般化恢复保证仍有缺口：

- foundation 与 knowledge 是先后独立复制，随后直接发布 `completed:true` manifest；发布路径没有调用 strict verifier 做跨目录语义对账。[snapshot.ts](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/backup/snapshot.ts:169)
- `FoundationBuilder` 明确存在 `current.json` 与 `knowledge/current` 两次 rename 之间的崩溃窗口。[foundation.ts](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/memory/foundation.ts:377)
- 最新 verifier 已检查 active ID、SQLite、manifest status、generation 和 `gen-N` 目录，但仍不检查 `gen-N` 中四份必需知识文档，也不核对 SQLite session 行与 global session JSONL 的双向映射。[verify-snapshot.mjs](/Users/wangyixiao/WorkSpace/SayDo/scripts/verify-snapshot.mjs:121)

因此，本次真实候选点可判定为结构性恢复候选，但不能把生产备份机制整体写成已形成持续的 fail-closed 恢复闭包。

### A-2：启动 catch-up 与 strict verifier 仍不是同一有效性判定

`isSnapshotBackupDue()` 现在已比初版严格，会检查 v2、摘要算法、基础角色、destination 和 fingerprint；但它不检查：

- manifest 外额外文件；
- SQLite `quick_check`；
- active project 双向集合；
- foundation/knowledge generation 语义闭合；
- global session 映射。

现存 `20260729T163307Z` 是直接反例：它通过了 verifier 的角色和摘要阶段，仅因额外 WAL/SHM 被 strict verifier 拒绝；而 [isSnapshotBackupDue()](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/backup/snapshot.ts:334) 没有 extras 检查，会把它当作近期成功快照，从而跳过启动补跑。

其余 A-R2 子项已经闭合：备份失败仍执行 retention reconciliation，stale partial 会过期，symlink 不会被递归删除，`retentionDays<=0` 在任何创建或清理前拒绝，坏配置拒绝该轮备份和清理，daemon 启动会立即检查 catch-up。[index.ts](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/index.ts:1223)、[docs/09](/Users/wangyixiao/WorkSpace/SayDo/docs/09-data-contracts.md:986)

### A-3：loaded SHA 身份链已闭合，但 readyz 可对失效的 ASR/TTS 报假绿

daemon/pipeline 的 SHA 证明链已正确落地：

- 两进程分别从实际加载源码所在 Git 树固化 40 位 SHA。
- pipeline hello/health 携带 SHA；daemon 对 hello、health 和自身 SHA三方精确校验。
- `/health`、`/readyz` 和 preflight 对双方 SHA、连接状态及 45 秒 freshness 对账。
- deploy 重启两个进程并等待相同 SHA ready。[launchd/cli.ts](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/launchd/cli.ts:253)

但 ASR/TTS readiness 不足以解锁真人场次：

- pipeline 仅凭 provider 对象是否构造就上报 `asr:"ok"`、`tts:"ok"`。[hub_client.py](/Users/wangyixiao/WorkSpace/SayDo/pipeline/src/saydo_pipeline/hub_client.py:141)
- ASR/TTS 构造函数只保存凭据；真正的网络、鉴权和供应商可用性直到首次识别或合成才验证。
- 运行中识别/合成失败只记日志，不会把后续 health 降为 degraded/down。
- 因此，错误凭据、供应商故障或最近一次真实调用失败时，`/readyz` 与 preflight 仍可能为绿。[index.ts](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/index.ts:156)
- preflight 的 `release-config` 只摘要 `config.toml` 和两个 plist，未纳入实际控制 ASR/TTS 的 `.env` 或进程环境；四场可能记录相同 digest，但实际有效凭据已改变。[runtime-preflight.sh](/Users/wangyixiao/WorkSpace/SayDo/scripts/runtime-preflight.sh:67)

所以 A-R4 的“同一目标 SHA”已关闭，“真人语音可用性及有效配置证据”仍未关闭。

### A-4：派生清单当前为红，状态归档却已写成最终封账

本次真实命令：

- archive manifest：exit 0，`[ok] archive unchanged outside allowlist: 2085 entries`
- migration manifest：exit 1，`[fail] migration manifest differs from current source/target`
- target-change manifest：exit 1，`[fail] target change manifest differs from current worktree`

`target-change-manifest.tsv` 当前还未列出 prompt 30、report 30 和 `scripts/dry-run-restore-snapshot.mjs`。

与此冲突的是：

- 状态归档称 Codex 28 问题“均已回修”、实现“通过本轮最终门禁”、派生清单“已统一刷新”。[状态归档](/Users/wangyixiao/WorkSpace/SayDo/history/2026-07-29-migration-and-implementation-status.md:16)
- 同文件称最终 `just ci` 为 daemon 698，并说最终数字见 journal R61 收口段。[状态归档](/Users/wangyixiao/WorkSpace/SayDo/history/2026-07-29-migration-and-implementation-status.md:115)
- R61 实际只记录“第一次门禁”daemon 691，随后记录 Codex 28 回修和恢复点，文件到第 967 行结束，没有最终 698、最终清单或最终 emoji 门收口。[PROCESS-JOURNAL.md](/Users/wangyixiao/WorkSpace/SayDo/history/PROCESS-JOURNAL.md:946)
- HANDOFF 也直接写入了未在 R61 中闭环的 698 基线。[HANDOFF.md](/Users/wangyixiao/WorkSpace/SayDo/HANDOFF.md:24)

这不代表 698 一定没有运行过，但它不是当前审计可复核的最终工作树证据；当前两份派生清单明确为红，不能写成“审计、清单与完整门禁均已收口”。

## B 级发现

### B-1：四场记录仍未完整隔离 evidence origin、主路径和 fallback

场次②已经正确拆分 `overall`、Touch ID 主路径、人工 fallback、各自证据和 `live/fixture/test` origin；场次④也增加了前三场 `pass + 同一 SHA + 同一 config digest` 的汇总记录。

剩余问题：

- 场次①、③、④仍只有泛化“证据”字段，没有强制 `evidence_origin`。
- 场次③正文要求 Touch ID 主路径、fallback 另记，但运行记录没有分别承载两条路径。[session-3.md](/Users/wangyixiao/WorkSpace/SayDo/e2e/owner-sessions/session-3.md:43)
- 场次④标题和正文仍称“唯一真人验收点”“final-readback + 本场次通过”，与四场必须全部 pass 的发布锁存在文字冲突。[session-4.md](/Users/wangyixiao/WorkSpace/SayDo/e2e/owner-sessions/session-4.md:1)
- 所有记录当前均为 `not_run`；场次①只有历史 failed/partial，不能算通过。

### B-2：dry-run 是低层文件映射演练，不是完整产品恢复演练

`dry-run-restore-snapshot.mjs` 会在临时目录复制数据库与文件，检查 SQLite、active project、pointer 和 symlink，但没有：

- 实例化真实 `FoundationBuilder`；
- 核对 session 行与 JSONL；
- 启动 daemon 验证恢复后运行；
- 自动清理临时根。

因此运行册可称其为“隔离文件恢复演练”，不宜单独作为完整应用恢复证明。[dry-run-restore-snapshot.mjs](/Users/wangyixiao/WorkSpace/SayDo/scripts/dry-run-restore-snapshot.mjs:27)

### B-3：canonical 主体基本一致，但状态源仍有局部张力

- `docs/09` 对产品缺省、当前实例 effective 值和非法备份配置的口径与代码一致。
- PLAN-2 当前顺序已正确写成“发布前回修 commit/deploy → 四场 → v0.1.0”。[PLAN-2](/Users/wangyixiao/WorkSpace/SayDo/docs/plan/IMPLEMENTATION-PLAN-2.md:145)
- HANDOFF、状态归档对旧 runtime、未提交、未部署、无真人通过、无 `v0.1.0` 的主结论正确。
- 但 PLAN-2 开头仍写 P0/P0.5“工程侧已收口、只剩 owner 场次”，与当前尚有发布前 A 级工程阻断的事实不够严谨。[PLAN-2](/Users/wangyixiao/WorkSpace/SayDo/docs/plan/IMPLEMENTATION-PLAN-2.md:4)

## C 级发现

### C-1：场次④升级仪式后的 CI 命令缺少 runtime cwd

场次④前置明确使用 `(cd ~/.saydo/runtime && just ci)`，但升级仪式步骤只写“演练后 `just ci` 仍绿”，可能误从活动开发树运行。[session-4.md](/Users/wangyixiao/WorkSpace/SayDo/e2e/owner-sessions/session-4.md:67)

## Codex 28 四项 A 关闭表

| 项 | 状态 | 已关闭部分 | 剩余问题 |
|---|---|---|---|
| A-R1 | partial | 当前候选含 SQLite、global sessions、active foundation/knowledge；strict verifier 已检查 active IDs、pointer、manifest、complete status、generation 和 `gen-N` | 发布路径未执行跨源 strict 校验；verifier 未检查四知识文档及 session→JSONL 映射 |
| A-R2 | partial | 失败清理、stale partial、`retentionDays=0`、坏配置、启动即时 catch-up 均已回修 | catch-up 的“成功快照”判定弱于 strict verifier，现存 `163307Z` 是反例 |
| A-R3 | closed | workspace 列表在 SQLite 在线副本完成后从该副本派生；当前候选 active ID 与 manifest 精确一致 | 无 |
| A-R4 | partial | 两进程 loaded SHA、hello/health、freshness、deploy 与 preflight 身份链已闭合 | ASR/TTS 只是“对象存在”健康；失败不降级；release config digest 未覆盖 `.env`/有效环境 |

## 运行册与发布时序

已正确形成的时序为：

1. owner 授权形成精确 commit；
2. target 必须是 `origin/main` 后代且可 fast-forward；
3. 在该 SHA 跑门禁并生成、验证恢复点；
4. deploy 同时重启 daemon/pipeline，并证明双方 loaded SHA；
5. 场次①→②→③→④全部使用同一 SHA 和 config digest；
6. 四场全 pass 后再次 fetch，main 仅 `--ff-only` 到该 SHA；
7. `v0.1.0` 精确指向该 SHA，tag/push 另等 owner 授权。

该顺序文本已基本闭合；当前没有任何步骤已实际发生。

## 本次真实门禁与边界

- Git：HEAD、本地 `main`、本地 `origin/main` 均为 `f28489d…`；工作树有 26 个 tracked 修改、16 个 untracked 文件。
- Runtime：clean `838aeea4385a41ec58318437bb36a7db5ede635f`；launchd 显示 daemon/pipeline 均 running。
- `runtime-preflight.sh f284…` exit 1：因磁盘 runtime 仍是旧 SHA，符合预期，不是新实现部署失败。
- `runtime-preflight.sh 838…` exit 7：本沙箱无法连接 localhost；不能据此判服务不健康，也不能证明当前 HTTP health。
- `v0.1.0` 不存在；本地仅有 `v0.1.0-rc.1`。
- `pnpm typecheck` exit 0；`pnpm lint` exit 0。
- `git diff --check`、`bash -n runtime-preflight.sh`、verifier 实际执行均 exit 0。
- 完整 `just ci` 未在本次最终工作树重跑：Vitest/Pytest 尝试因只读环境无法创建临时目录或 cache，在收集测试前退出；emoji 脚本也因 `mktemp` 被拒而未形成内容判定。不能把这些环境失败写成代码失败，也不能据此认证历史 698 为当前最终门。
- 最新恢复候选的 manifest、immutable SQLite、源目录一致性、foundation generation、session 映射均由本次只读命令重新核验。
- 生产计数以 00:34 +0800 的在线备份副本为准；该副本晚于现役 WAL mtime：coding/active 1、pending/draft 3、sessions 2、decision packages 3、artifacts 3，tasks、approvals、readiness assessments、active bindings 均为 0，与状态文档一致。未用普通 SQLite 打开现役库。
- 未运行会创建临时恢复目录的 dry-run；未修改快照、运行时、数据库、Git 状态，未 commit、push、tag、deploy 或 restart。
- 受只读约束，本审计进程没有写入 `research/codex-findings/30-project-status-final-adversarial-review.md`；静止点 `test -e` 为 exit 1，本回复即应落盘的报告正文。

当前阶段是“迁移提交已成立、真实恢复候选点可用，但发布前回修仍未提交且 A-R1/A-R2/A-R4 仅部分关闭，runtime 仍为旧 SHA、四场与正式发布均未发生”；Codex 下一步是修正上述 A 级缺口、补齐场次证据字段、回写真实状态并刷新两份派生清单后在可写环境重跑完整门禁，owner 下一步是继续不部署不发布，先裁决 A3 门语义，待 Codex 封账后分别授权 commit 与部署时窗，再以同一 SHA 完成四场并另行决定 tag/push。