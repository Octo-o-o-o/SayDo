# SayDo 单仓迁移与实施状态归档

> 快照日期:2026-07-29
> 性质:一次性事实快照与交接归档，不是新的合同或排产真相源。
> 迁移细节以 `docs/plan/MIGRATION.md` 为准；实施状态以 `HANDOFF.md` 为准；
> 排产以 `docs/plan/IMPLEMENTATION-PLAN-2.md` 为准；合同形状以 `docs/09-data-contracts.md`
> 等 canonical 文档为准。后续状态变化不回改本文件，而写入上述现役文档与 journal。

## 1. 结论

1. 单仓迁移的数据完整性已经成立。SayDo 是唯一活动仓；旧路径 `voice-coding` 是指向
   SayDo 的兼容链接，真正冷档是独立普通目录 `voice-coding.archive-20260729`。
2. 项目处在“首发候选主体实现已有证据、发布前回修已落在未提交工作树、真人验收与正式发布
   尚未收口”的阶段，不是“整个 PLAN-2 都已实施”。P0/P0.5、W1、W2、W4、W5a、R-A
   closeout、A3-armed 与后续语音稳定性修复已有代码和自动化证据；Codex 27、迟到落盘的
   Codex 28、最终对抗审计 30/31 所发现的生产备份、运行时身份、provider 探活、部署准备、
   验收记录和状态文档问题均已在本轮工作树回修，但尚未 commit 或部署。
3. 现场没有发现 owner 场次①至④已经通过的持久化证据。生产库有 2 个 session、3 个
   decision package，但 task、approval 与 active readiness binding 都是 0；因此不能把
   “工程侧可约”写成“真人已经验收”。
4. 常驻 daemon 与 pipeline 正在运行，daemon `/health` 返回 `ok:true`。运行树当前是
   `838aeea`，活动仓 HEAD 是迁移提交 `f28489d`，本轮回修仍未提交；迁移提交中的知识底座
   兼容修复和本轮发布前修复都尚未部署到常驻树。按 dogfood 时段不擅自重启的纪律，commit
   与部署都需要 owner 明确授权。
5. 正式版本仍未发布。仓库只有 `v0.1.0-rc.1`；`v0.1.0` 按既定规则要等场次④通过后再打。

## 2. 本次核对的边界

本快照核对以下五层，不能互相替代：

| 层 | 核对问题 | 本次判定 |
|---|---|---|
| 迁移层 | 旧目录中的数据是否有去向 | [ok] 2087 个迁前非目录条目严格分为迁入 161 与冷档 1926，未知项 0 |
| 实现层 | 代码、契约、测试和证据是否落地 | [warn] 主体与发布前回修已落工作树并通过本轮最终门禁，但尚未入库/部署 |
| 运行层 | 本机正在跑什么版本 | [warn] 服务健康，但 runtime 比活动仓少迁移提交 `f28489d` |
| 验收层 | owner 是否真实使用并签收 | [warn] 四场验收、S3 Touch ID、OctoBlog 首篇与手机烟测仍缺通过记录 |
| 发布层 | 正式版本是否成立 | [warn] 只有 `v0.1.0-rc.1`；场次④未通过，`v0.1.0` 不存在 |

本次没有删除、移动历史数据、chflags、commit、push、打 tag、部署或重启服务；只为新增的
`scripts/runtime-preflight.sh` 设置了可执行位，并在 `~/.saydo/backups` 新增恢复验证快照
（本轮 retention `pruned=0`）。配置核对只读取非敏感开关，没有输出 token、密钥或完整凭据。

## 3. 迁移状态

### 3.1 活动入口与冷档

- 唯一活动仓：`/Users/wangyixiao/WorkSpace/SayDo`。
- 兼容入口：`/Users/wangyixiao/WorkSpace/voice-coding`，精确指向 SayDo，与 SayDo 跟随后的
  inode 相同，不是第二个开发目录。
- 冷档：`/Users/wangyixiao/WorkSpace/voice-coding.archive-20260729`，是独立普通目录。
- 冷档“冻结”是仓库协作规则，不是文件系统不可变属性；owner 仍可在操作系统层写入。

迁前 2087 个非目录条目经清单守恒复算为：

- 161 个映射进入 SayDo；
- 1926 个留在冷档；
- 未知或无去向条目 0。

完整映射、SHA-256、目录与 xattr 证据边界、回滚步骤见 `docs/plan/MIGRATION.md`。迁移提交为
`f28489d14af78d67d6ed3d223395d172b7e6056c`，唯一父提交是
`838aeea4385a41ec58318437bb36a7db5ede635f`，本次核对时本地 `main`、`origin/main` 与
迁移分支均指向该提交。

### 3.2 迁移复核证据

提交后复核已经重跑：

- source、migration、target-change 三份清单检查；
- `scripts/test-migration-tools.sh` 故障注入自测；
- 活动代码、配置、模板与 canonical 对 sibling/archive 的依赖扫描；
- Markdown 本地链接、内层 knowledge Git、兼容 symlink 与在线远端分支核对；
- 完整 `just ci`。

末次完整 CI 的实测基线是 contracts 73、daemon 687 passed / 4 skipped、Python 20、
emoji gate 11/11，命令 exit 0。独立评审与日志摘要见
`research/codex-findings/26-repo-migration-post-commit-audit.md` 和 journal R60。

本轮新增的状态归档、评审报告、canonical 与 journal 会让 migration 和 target-change
两份派生清单在本轮证据落盘后已统一刷新；最终机械结果见 §3.3，不能把此前中途数量当最终数量。

### 3.3 本轮发布前回修证据

Codex 27 初审判 No-Go，五项 A 级分别是生产备份漏项、场次可能验错树且漏 S3 主路径、
两份派生清单未刷新、canonical writing 状态陈旧、PLAN-2 默认范围与单批授权混写。两路独立
评审另补充备份半成品、保留期与 runtime preflight 风险。本轮完成的最小回修包括：

- 生产快照覆盖 SQLite、全局 sessions 与所有 active 项目 knowledge；必需源缺失或不支持的
  active workspace fail-closed；
- `.partial` 复制、源/副本摘要校验、manifest v2 后原子发布；手工与定时保留期同源且拒非法值；
- 四场统一使用 `runtime-preflight.sh` 锁定磁盘与两进程 loaded SHA/clean/launchd/readyz，明确 Touch ID 主路径、
  人工 fallback、durable verdict 与四场同 SHA 规则；
- canonical、HANDOFF、PLAN-2 与 roadmap 的 writing/A3/当前阶段和授权边界对齐；
- 部署运行册增加备份、摘要重算、精确 target CI、部署后核验和失败回滚。

Codex 28 的 wrapper 在约 60 分钟停滞后结束，报告随后才落盘，不能沿用当时“无报告”的判断。
该报告判 No-Go，并新增四项 A 级：foundation 真相源漏备、失败/崩溃时保留期不闭环、active
workspace 清单与 SQLite 备份点竞态、preflight 不能证明两进程实际加载目标 SHA。Codex 29
范围较窄，未覆盖这些问题，因此不构成对 28 的替代。完整报告见
`research/codex-findings/28-project-status-postfix-review.md` 与
`research/codex-findings/29-project-status-final-review.md`。

最终对抗审计 30 进一步把持续恢复闭包、catch-up 判定、ASR/TTS 假绿和派生清单列为
No-Go；回修后窄终审 31 又发现隐私不留转写与真实丢失未区分、TTS 空音频假绿、Python
依赖未在切 runtime 前准备及 ready 等待不足。最终实现以显式
`transcriptPersistence`、全链 no-follow/active exact-set、启动与运行期 provider 探活、
预切 `uv sync --frozen` 和约 60 秒 ready 窗口闭合；两路最终只读复核均为 A=0、B=0。
报告保留初始发现与 triage，不把 No-Go 原文改写成通过。

针对 Codex 28 的追加回修：

- active 项目的 `.saydo/foundation` 改为必需恢复角色；strict verifier 校验
  `current.json`、对应 manifest 与 generation；
- SQLite 先在线备份，再从副本解析 active workspace，避免 activate/reanchor 竞态；
- retention reconciliation 与创建解耦，失败也清过期 final/stale partial；启动时补跑，
  `retentionDays` 必须大于 0，现有非法配置拒绝而非静默回 30；
- manifest 增加 `digestAlgorithm` 与 `requiredRoles`；生产入口要求 SQLite 和全局 sessions；
- daemon `/health` 回显 loaded SHA，pipeline hello/health 回显并三方校验 SHA，`/readyz`
  叠加连接与 45 秒心跳新鲜度；deploy 重启 daemon 和 pipeline，preflight 精确核对两者；
- 场次②拆分 Touch ID 主路径、人工 fallback 与 evidence origin；场次④记录机械绑定前三场
  pass 与同一 SHA。

本轮最终 `just ci` exit 0：contracts 73、daemon 700 passed / 4 skipped、Python 25，
typecheck/lint、emoji gate 与 11 项自测、迁移工具故障注入均通过。派生清单末次数字以
journal R61 的收口段为准；当前 source allowlist 2085、migration 161、target-change 236，
三个 `check` 均 exit 0。

最终生产恢复点是 `~/.saydo/backups/20260729T163416Z`：

- `scripts/verify-snapshot.mjs` 输出
  `entries=4 digests=verified foundation=restorable extras=0`；
- SQLite 以 `immutable=1` 打开，`PRAGMA quick_check` 返回 `ok`，再次运行 verifier 仍无 sidecar；
- 全局 sessions、OctoDesk foundation 与 knowledge 均经 `git diff --no-index --quiet` 对源一致；
- foundation `current.json` 与 `manifest-gen-3.json` 均为 generation 3，manifest 状态 complete；
- 在隔离临时 workspace 只恢复 foundation+knowledge 后，真实 `FoundationBuilder` 回读仍为
  generation 3 / complete；恢复数据库内 workspace/transcript path 已改写到隔离根，真实
  `SessionManager.readTurns` 也从隔离 JSONL 回读；
- 顶层只有 `saydo.db`、`sessions`、`foundation`、`knowledge` 与 manifest。

`20260729T143851Z` 与 `20260729T163307Z` 均出现 manifest 外 WAL/SHM sidecar，strict verifier
按预期拒绝；没有擅自删除。`20260729T160930Z` 虽无 sidecar，但缺 foundation，也不再是完整
生产恢复点。

## 4. 当前实施状态

### 4.1 已有工程证据支持的部分

| 范围 | 状态 | 主要证据 |
|---|---|---|
| P0 + P0.5-A/B/C/E 与全量 readback | 主体实现已有历史收口证据 | `e2e/evidence/final-readback.md`、`closeout-verification.md` |
| W1 收尾与 dogfood 起步 | 已收口 | `e2e/evidence/w1-batch.md` |
| W2 常驻、T2 薄版、M1、VAD 与场次①修复 | 代码与自动化已收口 | `e2e/evidence/pull-forward-batch.md` |
| W4 S3 卡、writing 窄版与增量项 | 代码与自动化已收口 | `e2e/evidence/w4-batch.md` |
| W5a 合同就绪子集与 TTS | 已收口 | `e2e/evidence/w5a-batch.md` |
| R-A closeout + A3-armed | 工程已 armed；A3 门语义待 owner 明确确认 | `ra-closeout-batch.md`、`a3-armed-batch.md` |
| 语音冻结、长语音与双动作交互修复 | 已进入运行树 | runtime HEAD `838aeea` 及其前置提交 |
| 单仓迁移 | 已进入活动仓与远端 main | `f28489d`、`docs/plan/MIGRATION.md` |

这表示首发候选的主体实现已经具备，不表示发布前工程门、owner 验收或 W1 至 W9 全部结束。

### 4.2 当前常驻运行现场

2026-07-29 现场只读核对：

- `com.saydo.daemon` 与 `com.saydo.pipeline` 均为 running；
- `http://127.0.0.1:47100/health` 返回 `{"ok":true,"service":"saydo-daemon",...}`；
- runtime 是 detached HEAD `838aeea`，工作树 clean；
- 活动仓是 `f28489d`，比 runtime 多一个迁移提交；
- `enabled_project_types = ["coding", "writing"]` 已在有效配置中，不再是“待翻值”；
- Tailscale 网络扩展仍是 `activated waiting for user`；
- 数据库项目分布为 coding/active 1、pending/draft 3；writing 项目 0；
- 数据库 session 2、decision package 3、artifact 3，但 task 0、approval 0、
  readiness assessment 0、active readiness binding 0。

由这些数据只能得出“服务可运行、曾有对话和提议”，不能得出“完整派发、审批、执行、验收、
合并链已经被 owner 在生产库跑通”。

### 4.3 尚缺真人验收或外部条件的部分

| 项 | 当前事实 | 解锁者 |
|---|---|---|
| 场次①至④ | 运行册已备，但须先 commit/deploy 同一目标 SHA；未找到通过记录 | owner 授权部署后逐场体验与裁决 |
| 首发正式 tag | 只有 `v0.1.0-rc.1` | 场次④通过后，owner 明确授权 tag/push |
| S3 Touch ID 真卡 | 自动化已证机制，真人过卡未记录 | owner 在本机完成强认证 |
| OctoBlog 首篇 writing 全链 | writing 开关已开，但生产库无 writing 项目 | owner 逐节验收首篇 |
| T2 手机烟测 | 代码已收口，系统扩展待批准 | owner 在系统设置批准扩展 |
| Claude SDK Tier1 主档 | W5.4 挂 Claude 订阅与登录态 | owner 购入并登录 |
| GitHub Actions | billing 按既定计划 2026-08 再开 | owner 或到账条件 |

### 4.4 尚未实施的计划主体

- W5 剩余：5.4、5.3 尾项、5.6、5.8、5.9 与 5.11 余项；其中多项要先经过
  PLAN-2 §6 二次确认或外部订阅解锁。
- R-B 规模与通道合同。
- W6 并行与规模完整版。
- W7 语音与移动完整版；电话形态另有独立锁定计划与触发条件。
- R-C 通用化合同。
- W8 通用化与治理完整版。
- A5-armed 深评生产装配与就绪复述确认卡 UI。
- W9 是持续数据触发轨，不存在一次性“全部结束”的时点。

## 5. 状态文档中发现的陈旧点

1. `HANDOFF.md` 的 W4 owner 触点曾写 writing 开关待翻、runtime 仍在更早提交；本轮已按
   现场配置与 runtime 更新为 writing 已启用、`838aeea`。
2. `IMPLEMENTATION-PLAN-2.md` 的 R-A 主段曾保留旧的 `not ready_for_review` 条件叙述，
   本轮已改成历史关闭说明，并保留 A3 产品语义待 owner 确认。
3. 同计划的 runtime 记录曾停在 `103e2f6`，本轮已刷新为实际部署到 `838aeea`。
4. canonical 曾把产品缺省 `["coding"]` 与本机 effective 值混写；本轮已保留缺省合同，
   把当前实例值归回 HANDOFF/journal。
5. “主体实现有证据”“场次可约”“首发已交付”是三个不同命题。当前支持第一个；
   发布前阻断复验后才支持第二个，不支持最后一个。

本轮只修正 canonical 的陈旧实施状态和已登记的 provider 形状漂移，不改变产品合同语义。

## 6. 当前阶段判定

当前阶段可准确表述为：

> SayDo 的首发候选主体实现及发布前回修已在未提交工作树通过门禁，待 owner 授权 commit 和
> runtime 部署后，才进入四场真人验收与发布裁决。首发后的
> 体验、规模、移动与通用化工作仍未实施或受外部条件阻塞。

最近的主风险已经从“代码是否存在”转为：

1. 已验证的 SQLite/session/foundation/knowledge 恢复链能否在部署后的定时任务中持续成立；
2. owner 是否能按真实 runtime 跑过对话、派发、审批、回叫、验收与合并；
3. A3-armed 后的零 readiness binding 是否会让真实首次提议卡在采访与确认环；
4. S3、writing 与 T2 的自动化正确性是否能在真实设备和真实项目上成立；
5. runtime 与活动仓继续分叉是否会让迁移后的知识底座兼容修复无法生效；
6. 四场通过记录为 0；场次①已有失败尝试和反馈，但最新修复后的完整复验未记录。此时继续
   扩 W5/R-B，可能扩大未经使用验证的实现面。

因此，近期主线应先经 owner 授权把已过门禁的发布前回修 commit 并部署到锁定 runtime，再把
首发候选交给 owner 真实验收；新功能只处理验收暴露的 A 级问题，或按 PLAN-2 单批 stop-point
得到 owner 确认的 W5 子项。

## 7. 现在的职责分工

### 7.1 Codex 现在应做

1. 本轮迁移与状态审计已经收口：HANDOFF/PLAN-2 状态、归档、独立评审、Codex 27/28/29、
   journal、最终清单和完整门禁均已落证；下一动作是等待 owner 决定是否形成发布前提交。
2. 生产备份已覆盖 SQLite、session JSONL 与 active workspace foundation/knowledge，并完成
   原子发布、严格 manifest、失败期治理、同备份点清单和真实 generation 3 恢复点核对。
3. 不在 dogfood 时段擅自重启。等 owner 给部署时窗后，按
   `e2e/owner-sessions/runtime-deploy.md` 把 runtime 从 `838aeea` 更新到活动仓已审提交，
   部署前后核对备份、Git SHA、服务 health、pipeline 重连、数据库迁移与日志。
4. 为场次①至④逐场代跑 runtime preflight、记录原始结果、定位失败。涉及 Touch ID、主观听感、
   文章质量与是否接受的判断交给 owner。
5. 若验收暴露安全、契约或数据丢失级问题，先回 canonical 再做最小修复；体感类问题记录
   可复现步骤和数据，不凭一次印象改架构。
6. 发布前修复需要先由 owner 授权 commit，才能以精确 SHA 部署；push 是独立授权。target
   必须是 origin/main 的后代且可 fast-forward。场次④通过后只能把 main `--ff-only` 到四场
   同一 SHA，`v0.1.0` 也精确指向它；merge commit/rebase 或代码/发布配置新提交都会使四场
   证据失效。四场记录在 tag 后形成纯 `chore(evidence)` 子提交，不移动 tag、不改变 runtime。
7. PLAN-2 §6 的默认范围仍是全做；默认范围不等于某一批已经获准开工。W5 下一批仍须
   stop-point 确认，Claude 订阅未解锁时不做 5.4；owner 若要把某项改挂触发线，再修改排产源。

### 7.2 owner 现在应做

1. 先明确确认或否决 A3 门语义收窄：`gap_critical` 拒绝，知识/需求建议项放行；不接受则
   在场次②前要求回修。
2. 明确是否授权形成发布前 commit；若授权，再给一个短部署时窗，让 Codex 把该精确 SHA
   部署到常驻 runtime。deploy 会重启 daemon 与 pipeline；须避开 dogfood，且备份、readyz、
   数据库与失败回滚仍由运行册显式核对。
3. 按既定顺序分别安排场次①、②、③、④。Codex 可负责前置、观察和记录；owner 负责语音
   体感、是否可接受、是否返工和场次通过裁决。场次④仍是 `v0.1.0` 的发布门。
4. 在场次中补三个真人触点：S3 Touch ID 真卡、OctoBlog 首篇逐节验收、A3 readiness
   采访与复述确认。writing 开关已经打开，不需要再次翻值。
5. 若近期要手机使用，在系统设置批准 Tailscale 网络扩展，再让 Codex 接续配对与四页烟测；
   若近期不需要，可继续顺延，不阻塞桌面首发。
6. PLAN-2 §6 默认范围维持全做；若要把 5.6/5.8/5.9、Tier2 步序循环等改挂触发线，
   由 owner 修改该默认范围。另决定 Claude 订阅何时购入，未解锁前 5.4 不开。
7. 对本轮未提交的迁移复核与状态归档，分别明确 commit 与 push 授权；本文件落盘本身
   不等于已经进入 Git 历史，两项授权也不自动互相包含。若四场后授权 push/tag，只允许
   fast-forward 同一验收 SHA，不再改变代码。

## 8. 推荐的最近三个停点

1. **审计停点**：本轮文档、评审、清单与 `just ci` 已全绿，owner 决定是否先形成发布前 commit。
2. **部署停点**：runtime 与活动仓对齐，服务 health 和关键 smoke 绿。
3. **首发停点**：四场真人验收有逐场记录；场次④通过后，由 owner 决定打 `v0.1.0`，
   或按失败记录开一个聚焦返工批。

在第三个停点前，不建议直接开启 R-B、W6 或更远的规模化工作。

## 9. 2026-07-30 后续状态（不改写 2026-07-29 快照）

owner 已确认 A3 门语义：`gap_critical` 阻断；`gap_knowledge` 与 `gap_requirement` 仅提示。
判断依据是 critical 缺口代表执行目标、边界或事实仍可能根本错误，必须 fail-closed；知识与需求
建议项若一律阻断，会把非关键的不确定性变成无限采访。它们仍会显式展示，且不会绕过 Gate 0、
S0–S3 风险门、逐步确认、S3 语音禁行与 verify，因此放行建议项没有取消安全边界。

owner 同时授权形成发布前 commit，并给出立即部署 daemon 与 pipeline 的时窗；push 仍是独立
授权，未执行。发布前代码提交是
`b20151440011ce0452417439c2d81745cb5d7d39`（`fix(release): 收紧备份恢复与运行时发布门`）。
该精确 SHA 在独立 detached clean worktree 运行 `just ci`，结果为 contracts 73、daemon
700 passed / 4 skipped、Python 25、emoji 自测 11/11，exit 0。

部署前生成新快照 `/Users/wangyixiao/.saydo/backups/20260730T110948Z`，strict verifier
输出 `entries=4 digests=verified foundation=restorable extras=0`；隔离 dry-run restore 与真实
消费者探针通过，临时根随后移入 Trash，可恢复。`git fetch origin main` 因 GitHub TLS
`SSL_ERROR_SYSCALL` 连续两次失败，因此祖先关系仅基于本地
`origin/main=f28489d14af78d67d6ed3d223395d172b7e6056c` 核对并明确保留限制。

`just daemon deploy b20151440011ce0452417439c2d81745cb5d7d39` exit 0，现役 runtime 已切到
该 clean release；daemon 与 pipeline loaded SHA 一致，`readyz` 的 pipeline 连接、ASR 与 TTS
启动探活均为 `ok`，SQLite `quick_check=ok`，只握手的 voice smoke 通过且未 dispatch、未消费
审批。release config digest 为
`522e07160563a3de2afafa5517dd6b5a8b418c8e38a76fdd7fad1baf9b3c4660`。

因此项目从“发布前回修待入库/部署”推进到“发布候选 runtime 已锁定，等待四场真人验收”。
现在 Codex 应维持该 SHA 与配置摘要、逐场跑 preflight 并记录证据；owner 依次参与场次①、
②、③、④，负责主观语音体感、Touch ID、OctoBlog 文章质量与最终裁决。场次结果当前仍是
`not_run`，`v0.1.0`、push 与 tag 均未授权、未执行。
