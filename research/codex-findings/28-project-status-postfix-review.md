# No-Go

截至 `2026-07-29 23:17 +0800`，迁移基线 `f28489d` 本身仍成立，但当前未提交回修不能封账、部署、开四场真人验收或发布 `v0.1.0`。Codex 27 的 A-1、A-2 仅部分关闭，并新增了备份语义完整性、保留期和运行时身份三个 A 级阻断。

先披露只读边界偏差：仓库文件没有被本轮评审修改；但一条委派的 `sqlite3 -readonly` 命令在真实快照目录生成了 `saydo.db-shm`（32768 bytes）和空的 `saydo.db-wal`，时间均为 `22:39:00 +0800`。数据库本体 mtime、原始 SHA-256 和 manifest 自定义 fingerprint 未变化；我没有擅自删除。该快照现在也因此不再是目录级 pristine 恢复点，应在修复后重新生成新快照。

## A 级发现

### A-R1：快照仍遗漏 authoritative foundation 状态

- 事实：生产源只纳入 `.saydo/knowledge` 和可选 `.saydo/sessions`，未纳入 `.saydo/foundation`。[snapshot.ts:212](~/WorkSpace/SayDo/packages/daemon/src/backup/snapshot.ts:212)
- 证据：`FoundationBuilder` 从 `.saydo/foundation/current.json` 取得当前 generation；缺失时返回 0，且代码明确该文件是唯一真相源。[foundation.ts:269](~/WorkSpace/SayDo/packages/daemon/src/memory/foundation.ts:269)、[foundation.ts:378](~/WorkSpace/SayDo/packages/daemon/src/memory/foundation.ts:378)。OctoDesk 当前为 generation 3，而真实快照没有 `foundation` 条目或目录。
- 影响：恢复后虽有 knowledge 文档，但 generation、manifest、inventory 和 readiness generation 绑定丢失，不能称为完整 active workspace 恢复。
- 最小修法：把 `.saydo/foundation` 作为 required、带 `projectId` 的角色备份；隔离恢复后实际断言 `currentGeneration()=3`、`currentManifest()` 可读及 `knowledge/current` 一致。

### A-R2：保留期在备份失败或崩溃时不能兑现“最多 N 天”

- 事实：旧快照清理只在新快照成功发布后运行；任何必需源缺失、复制错误或磁盘错误都会跳过清理。[snapshot.ts:118](~/WorkSpace/SayDo/packages/daemon/src/backup/snapshot.ts:118)、[snapshot.ts:186](~/WorkSpace/SayDo/packages/daemon/src/backup/snapshot.ts:186)
- 证据：
  - `parseStamp()` 不识别 `.partial`，进程被 kill 或掉电留下的半成品不会过期。
  - `retentionDays=0` 仍合法，时间戳丢毫秒而 cutoff 保留毫秒，新快照会立即被自己清掉。
  - 手工与定时路径把所有配置解析/健全性异常静默降为默认 30 天。[cli.ts:17](~/WorkSpace/SayDo/packages/daemon/src/backup/cli.ts:17)、[index.ts:1150](~/WorkSpace/SayDo/packages/daemon/src/index.ts:1150)。例如运行中配置从合法 365 天改成坏 TOML，下一轮可按 30 天误删原本应保留的快照。
- 影响：含 hard-forget 数据的旧 final/partial 副本可能无限超过合同保留期；配置异常又可能反向造成不可预期删除。
- 最小修法：把 retention reconciliation 从“新建成功”中拆出，在启动和每轮无论备份成败都执行；治理 stale partial；要求 `retentionDays>0` 或明确定义 0；区分“配置不存在”与“现有配置非法”，非法时拒绝 prune 或使用持久化的 last-good 值。补失败清旧、crash partial、0 值和坏配置反例。

### A-R3：active workspace 清单与 SQLite 快照存在时间竞态

- 事实：CLI/timer 先从 live DB 调 `productionBackupSources()`，之后才执行 SQLite 在线备份。[cli.ts:29](~/WorkSpace/SayDo/packages/daemon/src/backup/cli.ts:29)、[snapshot.ts:119](~/WorkSpace/SayDo/packages/daemon/src/backup/snapshot.ts:119)
- 证据：发布前没有从备份出来的 DB 重新派生或复核 active workspace 列表。
- 影响：并发 activate/reanchor 时，SQLite 可能记录新 workspace，但 manifest 复制旧 workspace，最终仍标 `completed:true`。本次真实快照未观察到该错配，但代码允许该竞态。
- 最小修法：SQLite 备份完成后，从备份 DB 派生 active workspace 清单并在发布前对账；补并发 activate/reanchor 测试。

### A-R4：preflight 不能证明 daemon/pipeline 实际加载了目标 SHA

- 事实：deploy 只重启 daemon，pipeline 依靠原进程重连。[runtime-deploy.md:3](~/WorkSpace/SayDo/e2e/owner-sessions/runtime-deploy.md:3)
- 证据：
  - preflight 验证磁盘 HEAD、clean、launchd cwd；pipeline 连 ProgramArguments 都未核对。[runtime-preflight.sh:15](~/WorkSpace/SayDo/scripts/runtime-preflight.sh:15)
  - daemon `/health` 只有 `ok/service/ts`，没有启动时 SHA。[index.ts:122](~/WorkSpace/SayDo/packages/daemon/src/index.ts:122)
  - pipeline hello/health 不携带 loaded SHA。[hub_client.py:110](~/WorkSpace/SayDo/pipeline/src/saydo_pipeline/hub_client.py:110)
- 影响：checkout 后仍在内存运行旧 Python 模块的 pipeline 可以通过当前 preflight，owner 可能验错 runtime。
- 最小修法：部署时无条件重启两服务；daemon 与 pipeline 启动时固化 SHA，pipeline hello 上报 SHA；增加带双方 SHA、WS freshness、ASR/TTS 状态的 `/readyz`，preflight 与目标 SHA 精确对账。

## B 级发现

### B-R1：manifest 能验证“所列条目”，不能验证“应有条目”或恢复可行性

- 事实：`completed:true` 只表示循环完成；生产 CLI 在 DB 不存在时仍能发布无 SQLite 的完成快照。
- 证据：真实 manifest 三项 fingerprint 均复算一致，但其 `sha256` 是带 `file\0/directory\0` 前缀的私有算法；例如 DB manifest 值为 `81b7…`，普通文件 SHA-256 为 `f1f3…`。测试没有断言 `schemaVersion/sha256/bytes`，也未做隔离恢复。[backup.test.ts:67](~/WorkSpace/SayDo/packages/daemon/test/backup.test.ts:67)
- 影响：外部恢复者无法仅凭 schema 判断缺项、算法或目标映射。
- 最小修法：提供严格 v2 verifier、`digestAlgorithm`、expected/required role 集及 dry-run restore plan；生产模式要求 SQLite 存在。

### B-R2：真人主路径、fallback 与自动化仍可能在记录层混账

- 事实：场次②正文已明确 Touch ID 与人工 fallback 不得互相替代，但运行记录仍只有一个 `status` 和一个证据栏。[session-2.md:53](~/WorkSpace/SayDo/e2e/owner-sessions/session-2.md:53)、[session-2.md:71](~/WorkSpace/SayDo/e2e/owner-sessions/session-2.md:71)
- 证据：场次④自身写成“唯一真人验收点”并以单场 pass 解锁 tag，没有在该记录中机械绑定①②③均 pass 及同一 release SHA。[session-4.md:1](~/WorkSpace/SayDo/e2e/owner-sessions/session-4.md:1)、[session-4.md:73](~/WorkSpace/SayDo/e2e/owner-sessions/session-4.md:73)
- 影响：fallback 或自动化证据可能被误记为真人主路径通过，或孤立场次④被误读为足够发布。
- 最小修法：增加 `overall_status`、`touch_id_main_status`、`manual_fallback_status`、`evidence_origin` 和各自证据；发布收据绑定四场 pass 与同一 target SHA。

### B-R3：阶段与 commit 时序仍有文字冲突

- 事实：状态归档一处写“工程侧已可约”，另一处又正确写明门禁、commit、deploy 后才进入验收。[状态归档:118](~/WorkSpace/SayDo/history/2026-07-29-migration-and-implementation-status.md:118)、[状态归档:152](~/WorkSpace/SayDo/history/2026-07-29-migration-and-implementation-status.md:152)
- 证据：归档第 189 行把 commit/push 放在场次④之后，但部署前显然先需要一个经过授权的精确 commit。[状态归档:182](~/WorkSpace/SayDo/history/2026-07-29-migration-and-implementation-status.md:182)
- 影响：owner/Codex 分工和发布步骤存在操作歧义。
- 最小修法：改成“运行册已备、当前仍受封账与部署阻塞”；拆分“发布前修复 commit 授权”和“验收证据/tag/push 授权”。

### B-R4：定时备份没有启动 catch-up

- 事实：只有 `setInterval(..., 24h)`，首次启动后要连续运行 24 小时才执行。[index.ts:1159](~/WorkSpace/SayDo/packages/daemon/src/index.ts:1159)
- 影响：若 daemon 经常在 24 小时内重启，自动备份可以长期不发生。
- 最小修法：启动时读取最近有效 completed manifest，逾期即补跑；将创建调度与 retention reconciliation 分离。

## C 级发现

- C-R1：未使用的导出 `defaultSources()` 仍保留，是重新引入“漏传 workspace”的脚枪。[snapshot.ts:202](~/WorkSpace/SayDo/packages/daemon/src/backup/snapshot.ts:202)。最小修法：删除或改成测试私有 helper。
- C-R2：PLAN-2 的 W4 状态行仍把“翻 writing 值”列为 owner 触点，与同文件后文及现场有效配置冲突。[PLAN-2:49](~/WorkSpace/SayDo/docs/plan/IMPLEMENTATION-PLAN-2.md:49)。最小修法：改为“已翻值；真人 writing 全链待验”。

## Codex 27 A-1 至 A-5

| 项 | 当前状态 | 结论 |
|---|---|---|
| A-1 生产备份 | 部分关闭 | SQLite、全局 sessions、active knowledge、原子发布、remote workspace fail-closed 和负值检查已落；foundation、retention 闭环、同点清单和真实恢复仍未关。 |
| A-2 runtime/S3 | 部分关闭 | 四册已统一 preflight，Touch ID 与 fallback 文本已分开；loaded SHA 和分路径 durable 记录仍缺。 |
| A-3 派生清单 | 计划内未关闭 | archive 检查 exit 0；migration、target-change 均 exit 1。按用户说明不另计独立缺陷，但最终刷新前不能封账。 |
| A-4 writing effective | 工作树已关闭 | docs/09 已区分产品缺省 `["coding"]` 与本机 effective；实现/provider 形状一致。 |
| A-5 默认范围/逐批授权 | 已关闭 | PLAN-2 的默认全做与每批 stop-point 授权已分开。 |

Codex 27 其余项：B-1/B-2/B-3/B-6 已关闭；B-4 部分关闭（运行册补齐了人工边界，但 loaded SHA 未闭）；B-5 部分关闭（四场有记录区，但主路径/fallback 未拆）；原 C 三项 TTL 8 例、A3 五提交、OctoDesk dogfood 均已修正。

## 快照和运行现场结论

- 快照 `~/.saydo/backups/20260729T143851Z`：
  - 操作层可识别为已发布：schema v2、`completed:true`，当前 backup root 无 `.partial`。
  - SQLite immutable `quick_check=ok`；全局 sessions 与 OctoDesk knowledge 当前逐文件一致；三项自定义 fingerprint/bytes 均匹配。
  - 语义层不能判完整：缺 `.saydo/foundation`、没有 expected role 集、没有恢复 verifier；加上本轮意外 sidecar，不能继续作为首发回滚点。
- Git：活动仓分支 `codex/merge-voice-coding-20260729`，HEAD、本地 `main`、本地 `origin/main` 均为 `f28489d…`；GitHub main 已独立核为同一提交。工作树有 18 个 tracked 修改和 8 个 untracked 文件。
- Runtime：clean detached `838aeea…`，未包含迁移和本轮修复。
- launchd：daemon、pipeline 均 `running`；47100 正在监听，pipeline 与 daemon 有 ESTABLISHED 连接。
- Health：本沙箱 `curl /health` exit 7，因此当前 HTTP JSON未验证；不能据此推断服务不健康。
- Tag：本地和 GitHub只有 `v0.1.0-rc.1`，剥离提交 `628f7e4…`；`v0.1.0` 不存在。
- 生产库：`quick_check=ok`；coding/active 1、pending/draft 3、sessions 2、packages 3、artifacts 3；tasks、approvals、readiness assessments、active bindings 均为 0。

只读门结果：daemon typecheck、`bash -n runtime-preflight.sh`、`git diff --check` 均 exit 0；archive 清单 exit 0；另外两份派生清单 exit 1。未运行 backup tests 或完整 `just ci`；正式 emoji 脚本因沙箱禁止 `mktemp` 未执行成功，不是内容红。因此当前归档中“本轮 daemon 全套测试已通过”也未由本次最终工作树复验。

除刷新派生清单、写 journal、跑 `just ci` 外，收口前仍必须修复四项 A 级问题、补 manifest verifier 与隔离恢复演练、生成一份包含 foundation 的新真实快照，并把真人路径记录和 release SHA 绑定补齐。

一句话阶段判断：SayDo 处于“首发候选主体已有证据，但备份恢复闭包和可证明 runtime 身份仍阻断发布”的阶段；owner 最近一步是维持不部署、不约场、不打 tag，并决定是否单独授权处理本轮两个 sidecar；Codex 最近一步是先修上述 A 级项并生成新恢复点，再刷新清单、journal、跑完整门禁后申请 commit/deploy 时窗。