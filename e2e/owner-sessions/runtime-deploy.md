# 常驻 runtime 部署与回滚运行册

> 用途:把已经 commit、评审和门禁通过的 SayDo SHA 部署到 `~/.saydo/runtime`。
> `just daemon deploy` 会切换并重启 daemon 与 pipeline；dogfood 会话进行中不部署。

## 1. 部署前记录

| 字段 | 记录 |
|---|---|
| target SHA | 待填；必须是已 commit 的精确 SHA |
| origin/main baseline | `git rev-parse origin/main`；target 必须是其后代，可 `--ff-only` 到达 |
| previous runtime SHA | `git -C ~/.saydo/runtime rev-parse HEAD` |
| runtime clean | `git -C ~/.saydo/runtime status --porcelain=v1` 为空（含未跟踪文件） |
| 本地门禁 | `test "$(git rev-parse HEAD)" = "<target-SHA>" && test -z "$(git status --porcelain=v1)" && just ci` exit 0 |
| owner 时窗 | 日期、开始时间、允许中断时长 |

开场前先执行 `git fetch origin main`，再执行
`git merge-base --is-ancestor origin/main <target-SHA>`，非零即停止。四场期间不得
改写或 rebase target。若四场通过，正式 main 只能 `git merge --ff-only <target-SHA>` 到同一
SHA；禁止再制造 merge commit。发布前再次 `git fetch origin main` 后复核 fast-forward；
`v0.1.0` 必须精确指向四场记录的 target SHA。若 origin/main 在期间前进导致不能
fast-forward，既有四场证据失效，先重新确定 release SHA。

四场运行记录会修改 `session-1..4.md`，但不得混入 release target。场次④通过后，先让
main `--ff-only` 到已验证 target 并把 `v0.1.0` 精确打在该 target；随后才可在其子提交形成
纯 `chore(evidence)` 记录四场结果。该证据提交不得改代码、canonical、依赖锁或发布配置，
不改变已验证 runtime，tag 也不移动；main 是否再前进到证据提交仍需 owner 单独授权。

先运行并保存一份真实快照：

```bash
just backup
```

从输出记录 `snapshotDir`，并核对：

```bash
test -f <snapshotDir>/snapshot-manifest.json
node scripts/verify-snapshot.mjs <snapshotDir>
sqlite3 'file:<snapshotDir>/saydo.db?immutable=1' 'PRAGMA quick_check;'
node scripts/dry-run-restore-snapshot.mjs <snapshotDir>
```

`snapshot-manifest.json` 必须同时列出 `saydo.db`、全局 `~/.saydo/sessions` 与所有 active
workspace 的 `.saydo/foundation`、`.saydo/knowledge`。任一缺失即停止部署，不把旧的
SQLite-only 或缺 foundation 快照当回滚点。manifest 还必须是 `schemaVersion:2`、
`completed:true`、`digestAlgorithm:"saydo-tree-sha256-v1"`，`requiredRoles` 与实际条目一致，
每个已复制条目含 `sha256` 与 `bytes`；
目录名带 `.partial` 的快照一律不是恢复点。快照数据库的只读核验必须用 `immutable=1`，避免
SQLite 在不可变快照旁生成 `-wal` / `-shm` sidecar。

dry-run 会先重跑 strict verifier，再把数据库、全局 sessions 及每个 active 项目的
foundation/knowledge/project sessions（若有）映射到一个 `mktemp` 隔离根，复核恢复后的
SQLite，将恢复库内的 workspace path 改写到隔离根，并由真实 `FoundationBuilder` 与
`knowledge/current/core.md` 消费路径复核 generation/正文可读；session transcript path 也
改写到隔离 `saydoHome/sessions`，再由真实 `SessionManager.readTurns` 回读，避免误碰现役
转写。最后打印 `dryRunRoot`。核对后用
`trash <dryRunRoot>` 移入废纸篓；不得把 dry-run 目标指向现役 `~/.saydo` 或真实 workspace。

## 2. 部署

```bash
just daemon deploy <target-SHA>
```

命令先在 `~/.saydo/releases/<target-SHA>` 独立树完成 fetch/checkout、pnpm 与 `uv --frozen`
锁定依赖安装、console 构建与 clean 检查；任一步失败都不切现役 runtime。准备成功后才把 `~/.saydo/runtime`
切到该 release、改写 plist、依次重启 daemon 与 pipeline，并等待双方 loaded SHA 与 readyz
对账（最长约 60 秒，覆盖 ASR/TTS 各 20 秒启动探活）。它没有内建部署前备份或 readyz
失败后的自动回滚；这些由本运行册补齐。

## 3. 部署后验证

```bash
scripts/runtime-preflight.sh <40位-target-SHA>
sqlite3 ~/.saydo/saydo.db 'PRAGMA quick_check;'
```

再检查 pipeline 日志出现重连成功，跑一条不派发、不消费审批的语音连接 smoke。全部通过后记录：

| 字段 | 记录 |
|---|---|
| deployed runtime SHA | 待填 |
| release config digest | 待从 preflight 原样记录 |
| daemon health + loaded SHA | 待填 |
| pipeline loaded SHA + fresh health | 待填 |
| database quick_check | 待填 |
| smoke | 待填 |

`release config digest` 覆盖全局 `config.toml`、`.env`（只进入摘要，不打印内容）、daemon/
pipeline plist、数据库内全部 `project_settings`，以及数据库已登记 workspace 中实际存在的
`.saydo/project.toml`。四场间其中任一项变化都会改变 digest；项目运行数据、session/任务/
artifact 变化不计入该摘要。

## 4. 失败回滚

部署后任一必检失败，先保留日志和新 runtime，不恢复数据库，执行代码回滚：

```bash
just daemon deploy <previous-runtime-SHA>
```

然后完整重跑 §3。若 pipeline 未自动重连，再执行：

```bash
launchctl kickstart -k "gui/$(id -u)/com.saydo.pipeline"
```

只有数据库 quick_check 失败或明确证实前向写入不可兼容时，才上浮 owner 决定是否从
`snapshotDir` 恢复数据库/JSONL/foundation/knowledge。数据恢复会覆盖现役数据，必须另行确认，不能作为
代码回滚的隐含动作。

## 5. 本轮结果

| 字段 | 当前值 |
|---|---|
| status | `pass` |
| target SHA | `ada7981c67ef3a07e6df0431643bb8b7661e22d4` |
| previous runtime SHA | `b20151440011ce0452417439c2d81745cb5d7d39` |
| owner verdict | 2026-07-31 授权当前部署时窗 |

### 2026-07-31 实际记录

| 字段 | 结果 |
|---|---|
| origin/main baseline | `97b01f767f3eeb80b3ca0b2d641dfbd33388a75a`；是 target 祖先 |
| target clean CI | 独立 detached clean worktree；`just ci` exit 0；contracts 73、console 2、daemon 781 passed / 4 skipped、Python 31，emoji 自测 11/11 |
| snapshot | `~/.saydo/backups/20260731T013926Z`；`entries=4 digests=verified foundation=restorable extras=0` |
| dry-run restore | 外部 workspace 四字段原子重写、managed 分支、路径穿越拒绝与失败清理回归通过；真实 consumer 隔离恢复探针通过，临时根移入 Trash |
| deployed runtime SHA | `ada7981c67ef3a07e6df0431643bb8b7661e22d4`，runtime clean |
| release config digest | `90e35db971e7006303dbbfdb99b6d186e7e8beb5132be760d19531c8acf90207` |
| daemon health | `ok:true`，loaded SHA 与 target 一致 |
| pipeline health | 2026-07-31 09:39:52 +0800 重连成功；loaded SHA 与 target 一致，ASR/TTS 均为 `ok` |
| database | 快照与现役 `PRAGMA quick_check` 均返回 `ok` |
| smoke | console voice WebSocket hello/ack 通过；未 dispatch、未消费审批 |
| push/tag | 未授权，未执行 |

### 2026-07-30 实际记录

| 字段 | 结果 |
|---|---|
| origin/main baseline | 本地引用 `f28489d14af78d67d6ed3d223395d172b7e6056c`；是 target 祖先 |
| 远端刷新 | `git fetch origin main` 两次均因 GitHub TLS `SSL_ERROR_SYSCALL` 失败；未冒充在线刷新成功 |
| target clean CI | 独立 detached clean worktree；`just ci` exit 0；contracts 73、daemon 700 passed / 4 skipped、Python 25、emoji 自测 11/11 |
| snapshot | `~/.saydo/backups/20260730T110948Z`；`entries=4 digests=verified foundation=restorable extras=0` |
| dry-run restore | 隔离恢复、真实 `FoundationBuilder`/`SessionManager` 消费探针通过；临时根移入 Trash，可恢复 |
| deployed runtime SHA | `b20151440011ce0452417439c2d81745cb5d7d39`，runtime clean |
| release config digest | `522e07160563a3de2afafa5517dd6b5a8b418c8e38a76fdd7fad1baf9b3c4660` |
| daemon health | `ok:true`，loaded SHA 与 target 一致 |
| pipeline health | connected，loaded SHA 与 target 一致，ASR/TTS 启动探活均为 `ok` |
| database | `PRAGMA quick_check` 返回 `ok` |
| smoke | console voice WebSocket hello/ack 通过；未 dispatch、未消费审批 |
| push/tag | 未授权，未执行 |
