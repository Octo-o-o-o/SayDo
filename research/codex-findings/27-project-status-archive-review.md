**总判：No-Go。**

该结论针对“本轮五份状态文档封账、首发验收及 `v0.1.0` 发布”，不推翻 Codex 26 对迁移提交 `f28489d` 的完整性结论。本轮为纯只读评审，未修改文件。

## 五层独立判定

| 层级 | 判定 | 结论 |
|---|---|---|
| 单仓迁移 | Go | 冷档检查仍为 `[ok] archive unchanged outside allowlist: 2085 entries`；GitHub `main` 与 `f28489d` 一致。 |
| 工程实现 | No-Go 收口 | 已实施主体证据充分，但生产备份遗漏 JSONL/knowledge，存在数据恢复缺口。 |
| 常驻部署 | Conditional Go | runtime clean @ `838aeea`，daemon/pipeline 均 running，端口在监听；尚未部署 `f28489d`，本次未能独立取得 `/health` JSON。 |
| 真人验收 | No-Go | 场次①有失败尝试和真实反馈，但修复后的完整复验未记录；场次②至④无通过记录。 |
| 正式发布 | No-Go | 仅有 `v0.1.0-rc.1`；本地及 GitHub 均无 `v0.1.0`。 |

因此，“真人验收与正式发布未收口”证据充分；“首发候选工程侧已收口”措辞过强，当前最多能说“首发候选主体实现已有证据，但仍有发布前工程阻断”。

## A 级发现

### A-1：生产备份静默遗漏 session JSONL 与项目 knowledge

- 事实：手工备份和每日备份都调用 `defaultSources(..., [])`；该函数只有收到 workspace 才加入 `.saydo/knowledge` 和 `.saydo/sessions`。[backup/cli.ts:15](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/backup/cli.ts:15)、[index.ts:1157](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/index.ts:1157)、[snapshot.ts:87](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/backup/snapshot.ts:87)
- 现场：最新备份只有 `saydo.db` 一个文件；源端 `~/.saydo/sessions` 有 2 个文件、8 KiB，OctoDesk knowledge 有 58 个文件、304 KiB。SQLite 备份自身 `quick_check=ok`。
- 影响：恢复后 session 引用的 JSONL 和项目知识可能丢失，与 [justfile:28](/Users/wangyixiao/WorkSpace/SayDo/justfile:28) 承诺的“SQLite/JSONL/knowledge”不符；状态归档漏掉了首发级数据丢失风险。
- 最小修法：生产调用显式纳入 `~/.saydo/sessions` 及所有活动 workspace 的 knowledge；补生产调用者回归测试和隔离目录恢复演练；发布前生成一份包含三类对象的真实快照并核对计数、摘要。

### A-2：场次②可能验到开发树，并只覆盖 S3 降级路径

- 事实：常驻 daemon/pipeline 已运行且要求使用独立 runtime，但运行册仍要求 `just dev`；它会从活动工作树再启动 daemon、pipeline、console。[session-2.md:30](/Users/wangyixiao/WorkSpace/SayDo/e2e/owner-sessions/session-2.md:30)、[justfile:4](/Users/wangyixiao/WorkSpace/SayDo/justfile:4)
- 事实：步骤 6 只写 `requestManualMerge` 和人工 MergeProof 路径，没有按当前 canonical 验证 WebAuthn/Touch ID 主路径。[session-2.md:53](/Users/wangyixiao/WorkSpace/SayDo/e2e/owner-sessions/session-2.md:53)、[09-data-contracts.md:415](/Users/wangyixiao/WorkSpace/SayDo/docs/09-data-contracts.md:415)
- 影响：可能端口冲突、验错 SHA，或把“人工降级链通过”误当成“S3 主链通过”，形成错误发布证据。
- 最小修法：统一改为 runtime preflight，记录 runtime SHA、clean、launchd、schema 和 health；只单独启动必要的 console。S3 先跑 Touch ID 主路径并记录收据/挑战消费，人工合并明确标为 fallback。

### A-3：本轮两个迁移派生清单当前为红

真实输出：

- source 冷档检查：exit 0；
- `verify-design-migration.mjs check`：`[fail] migration manifest differs from current source/target`；
- `target-change-manifest.mjs check`：`[fail] target change manifest differs from current worktree`。

当前 `migrated-files.tsv` 对 `history/README.md`、PLAN-2 的目标摘要已陈旧；target-change 清单还漏本次状态归档、session-2、Codex 27 prompt，并有 HANDOFF、PLAN-2、history/README 摘要漂移。

影响：这不代表迁移数据重新丢失，但意味着当前工作树不能按“迁移与状态归档已封账”交接。[状态归档:61](/Users/wangyixiao/WorkSpace/SayDo/history/2026-07-29-migration-and-implementation-status.md:61) 只提 target-change 会增长，遗漏 migration manifest 也需刷新。

最小修法：所有内容最终静止后同时刷新两份派生 manifest，重跑三项检查、migration 工具自测和完整门禁。

### A-4：canonical 仍声称 writing effective 为 coding-only

- 事实：owner 已授权翻值，journal 记录 writing dogfood 已开，当前配置也是 `["coding","writing"]`。[PROCESS-JOURNAL.md:789](/Users/wangyixiao/WorkSpace/SayDo/history/PROCESS-JOURNAL.md:789)、[PROCESS-JOURNAL.md:794](/Users/wangyixiao/WorkSpace/SayDo/history/PROCESS-JOURNAL.md:794)
- 冲突：canonical 多处仍写“effective coding-only”“翻值待执行”。[09-data-contracts.md:407](/Users/wangyixiao/WorkSpace/SayDo/docs/09-data-contracts.md:407)、[09-data-contracts.md:431](/Users/wangyixiao/WorkSpace/SayDo/docs/09-data-contracts.md:431)、[09-data-contracts.md:907](/Users/wangyixiao/WorkSpace/SayDo/docs/09-data-contracts.md:907)
- 影响：HANDOFF/状态档与合同真相源相互矛盾，下一会话无法可靠判断 writing 是产品缺省、实例有效值还是待启用能力。
- 最小修法：保留产品 fail-closed 缺省 `["coding"]`，但删除 canonical 对当前实例“仍 coding-only”的陈旧断言；本机有效状态只由 HANDOFF/journal 记录。按 canonical 一致性流程评审后封账。

### A-5：PLAN-2 的默认范围与状态归档的执行授权混写

- 事实：PLAN-2 记录 owner “全部完成”并规定 §6“缺省=全做”。[PLAN-2:3](/Users/wangyixiao/WorkSpace/SayDo/docs/plan/IMPLEMENTATION-PLAN-2.md:3)、[PLAN-2:150](/Users/wangyixiao/WorkSpace/SayDo/docs/plan/IMPLEMENTATION-PLAN-2.md:150)
- 状态归档则要求 owner 重新选择，且称不能把“缺省全做”用于本轮。[状态归档:176](/Users/wangyixiao/WorkSpace/SayDo/history/2026-07-29-migration-and-implementation-status.md:176)、[状态归档:190](/Users/wangyixiao/WorkSpace/SayDo/history/2026-07-29-migration-and-implementation-status.md:190)
- 影响：尚不能判断这是“默认范围不变、但每批仍需 stop-point 授权”，还是撤销既有范围授权；历史快照不能代替唯一排产源作此决定。
- 最小修法：明确区分“计划默认范围”和“本批开工授权”。若要改变默认范围，先由 owner 裁决并修改 PLAN-2；否则状态归档只写“开批仍需 owner stop-point 确认”。

## B 级发现

1. 核心表声称核对“四层”，遗漏正式发布层。[状态归档:26](/Users/wangyixiao/WorkSpace/SayDo/history/2026-07-29-migration-and-implementation-status.md:26)
   最小修法：增加独立发布层，明确 `v0.1.0-rc.1`、场次④门和 `v0.1.0` 缺失。

2. “首发真人反馈为 0”不实。场次①发生过多轮失败、迁移缺陷和 UX 反馈，只是没有完整通过。[状态归档:158](/Users/wangyixiao/WorkSpace/SayDo/history/2026-07-29-migration-and-implementation-status.md:158)、[PROCESS-JOURNAL.md:693](/Users/wangyixiao/WorkSpace/SayDo/history/PROCESS-JOURNAL.md:693)
   最小修法：改为“四场通过记录为 0；场次①已有失败尝试和反馈，修复后完整复验未记录”。

3. 尚未实施清单漏掉 A5-armed 与就绪确认卡 UI；A3 还应区分“工程已武装”和“产品语义待 owner 确认”。[a3-armed-batch.md:29](/Users/wangyixiao/WorkSpace/SayDo/e2e/evidence/a3-armed-batch.md:29)、[PLAN-2:178](/Users/wangyixiao/WorkSpace/SayDo/docs/plan/IMPLEMENTATION-PLAN-2.md:178)
   最小修法：补齐两项及前置/验收锚；A3 状态改为两段式。

4. 部署说明与实现不一致。状态归档称部署会重启 daemon/pipeline；实际 deploy 只切换并重启 daemon，且没有部署前备份、失败回滚或部署后 health 断言。[状态归档:181](/Users/wangyixiao/WorkSpace/SayDo/history/2026-07-29-migration-and-implementation-status.md:181)、[launchd/cli.ts:176](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/launchd/cli.ts:176)
   最小修法：在实现或运行册中补齐 pipeline、备份、health、失败回滚的明确步骤，不能把人工检查写成 deploy 已自动保证。

5. 四份 owner session 文件都是操作清单，没有 durable 的 `not_run/pass/fail`、runtime SHA、日期和 owner verdict 字段。
   最小修法：每场增加独立运行记录区；历史场次不反填“通过”，场次①标注 partial/failed attempt。

6. A3 evidence provider 仍存在已登记的实现/合同形状漂移：canonical 为 `{checklistDigest, bindings}`，实现返回 `{covered, bindings}`。[09-data-contracts.md:1139](/Users/wangyixiao/WorkSpace/SayDo/docs/09-data-contracts.md:1139)、[readinessBinding.ts:170](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/evaluator/readinessBinding.ts:170)
   最小修法：通过轻量 canonical 评审统一形状；统一前不要把合同面写成完全无债。

## C 级发现

- HANDOFF 把 proposed TTL 反例写成 9 例，W4 evidence 已勘误为 8 例。[HANDOFF.md:28](/Users/wangyixiao/WorkSpace/SayDo/HANDOFF.md:28)、[w4-batch.md:53](/Users/wangyixiao/WorkSpace/SayDo/e2e/evidence/w4-batch.md:53)
- PLAN-2 把 A3-armed 写成 6 提交，实际 `git rev-list --count 2f2f7d8^..103e2f6` 为 5。[PLAN-2:178](/Users/wangyixiao/WorkSpace/SayDo/docs/plan/IMPLEMENTATION-PLAN-2.md:178)
- session-2 仍要求现场指定 dogfood 仓，但 OctoDesk/OctoBlog 已指定。[session-2.md:29](/Users/wangyixiao/WorkSpace/SayDo/e2e/owner-sessions/session-2.md:29)、[HANDOFF.md:39](/Users/wangyixiao/WorkSpace/SayDo/HANDOFF.md:39)

## 未验证

- `/health` 当前 JSON：launchd 两服务 running、`127.0.0.1:47100` listener 和 pipeline 连接日志已验证；但本沙箱 `curl` exit 7，Chrome 为 `ERR_BLOCKED_BY_CLIENT`。因此当前 HTTP 响应明确记为“未验证”，不能据此判 daemon 不健康。
- 未重跑完整 `just ci`；只读约束下会写依赖缓存或临时文件。文档内的 73/687/20 等数字是历史证据，不是本次复跑结果。
- 当前 Touch ID、Tailscale 扩展、Claude 登录/订阅及 GitHub billing：未验证。

## 独立交接版本

- 当前阶段一句话：单仓迁移静止点已经成立，首发候选主体实现已有证据，但备份、运行册、canonical 状态和派生清单仍有发布前阻断；真人验收与 `v0.1.0` 均未成立。
- owner 下一步：先裁决 A3 产品语义及 PLAN-2 默认范围与逐批授权的关系；A 级修复封账后再给 runtime 部署时窗并逐场验收。
- Codex 下一步：按单批串行先关闭上述 A 级项，补恢复测试和验收运行记录，刷新两份 manifest 并跑完整门禁；部署后再协助四场真人取证，场次④通过且 owner 明确授权前不打 `v0.1.0`。