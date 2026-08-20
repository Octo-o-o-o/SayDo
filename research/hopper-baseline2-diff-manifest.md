# Hopper v0.1.0-saydo-baseline.2 — diff 面清单(公布件)

> **来源**:Hopper 侧交付(2026-07-24,X1 条件式前移的公布件)。
> **用途**:SayDo 审计 baseline.1→baseline.2 的全部变更面,跑契约测试,全绿后切锁。

## 1. 版本坐标

| | tag | commit(40 位,切锁用) |
|---|---|---|
| 旧锁 | `v0.1.0-saydo-baseline.1` | `ea3fb31fd04946a66229022782b43daf57bf3fe4` |
| 新候选 | `v0.1.0-saydo-baseline.2` | `bdd1e548f9359789497a797eda24398beba68ac5` |

区间共 **2 个 commit**(仅这两个,无其他混入):

1. `e3c559b7c2884a391a4aec6a93e6b6a9ce1de02e` — feat(integration): 批次 A 使能 + RunSettled 实现面(46 文件 +1501/−96)
2. `bdd1e548f9359789497a797eda24398beba68ac5` — docs(plan): 裁决终稿 + 配合分析(2 文件 +823,纯文档)

合计 48 文件 +2324/−96。**门禁在 e3c559b 树上实测**:lint 0 警告 / typecheck / typecheck:test / vitest 1090 tests / 156 files 全绿。

## 2. 变更性质声明

**全部 additive,无破坏性变更**:

- 既有 CLI 命令的旧调用形态行为不变(新旗标全部可选);
- 事件 schema 仅新增 `RunSettled` 事件类型(additive minor,经 owner 批准登记于 `docs/SCHEMA-FREEZE-M3A.md` §5),既有事件 payload 未动;
- 新增文件(`vault.json`/`daemon-heartbeat.json`)不影响旧 vault(init 幂等补建,读方缺失容忍);
- 存量测试修复仅动测试代码(typecheck:test 主干既有错误),不动运行时。

## 3. 分类文件清单

### 3.1 生产代码(21 文件)

| 文件 | Δ | 说明 |
|---|---|---|
| `src/schemas/mutation.ts` | +5 | mutation 请求增可选 `origin`/`receipt` 审计字段 |
| `src/scheduler/mutation/queue.ts` | +22 | 直连路径 `req_id` 幂等(重放返回首次结果) |
| `src/cli/context.ts` | +46/−2 | CLI→mutation 旗标贯通(`buildMutationCliOpts`) |
| `src/cli/commands/review.ts` | +34/−10 | review approve/request-changes/reject 接集成旗标 |
| `src/cli/commands/control.ts` | +19/−7 | cancel/unblock 接集成旗标 |
| `src/cli/commands/drop.ts` | +7 | `--req-id`(仅单文件/stdin) |
| `src/cli/commands/lifecycle.ts` | +6/−6 | merge/retry 接 `--origin`/`--receipt` |
| `src/scheduler/mutation/handlers/review.ts` | +5/−2 | origin/receipt 进 Review* 事件 payload |
| `src/scheduler/mutation/handlers/control.ts` | +31/−1 | origin 进事件 payload;cancel dead-owner 兜底补 RunSettled |
| `src/review/merge.ts` | +15/−8 | MergeStarted/MergeFinished 带审计字段 |
| `src/review/retry.ts` | +3/−1 | RetryRequested 带 origin |
| `src/cli/commands/run.ts` + `src/scheduler/scheduler.ts` | +19/+52 | `hopper run <task-id>` 定向执行(闸门与 run next 同,机器可读 skip reason) |
| `src/cli/commands/capabilities.ts` | +108(新) | `hopper capabilities` 握手(版本/commit/schema hash/能力分级) |
| `src/cli/commands/project-show.ts` | +88(新) | `hopper project show <name>`(解析后配置快照) |
| `src/core/vault/init.ts` / `layout.ts` | +28/+8 | `.hopper/vault.json` vault 身份(init 幂等) |
| `src/daemon/daemon.ts` | +13/−1 | `.hopper/daemon-heartbeat.json` 每 tick 刷新 |
| `src/cli/commands/recovery.ts` | +27/−3 | `hopper show` 增 `last_run_cost`(known:false 明示) |
| `src/schemas/event.ts` | +9 | `RunSettled` 事件类型 |
| `src/scheduler/execute.ts` | +44/−1 | RunSettled emit(成功/异常双路径,artifacts+投影写回之后) |
| `src/core/state/projector.ts` | +4 | RunSettled 显式 no-op(不改投影状态) |
| `src/cli/register/*`(6 文件)+ `src/core/i18n/zh-cli2.ts` | +132/−41 | 命令注册旗标 + 中文文案 |

### 3.2 schema 导出(2 文件,由 zod 单源派生)

- `src/schemas/json/event.schema.json` +249(RunSettled)
- `src/schemas/json/mutation-request.schema.json` +8(origin/receipt)

### 3.3 build(1 文件)

- `scripts/build.mjs` +12/−1:dist 嵌入 `BUILD_INFO.json`(commit SHA + 构建时间,`capabilities` 回显用)

### 3.4 测试(11 文件,+481)

新增 9:`run-targeted`(e2e)、`cancel-settled-event`、`capabilities`、`daemon-heartbeat`、`frontmatter-unknown-keys`(未知键保留契约)、`mutation-origin-expects`、`project-show`、`vault-identity`(unit)+ `cli-smoke` 增补(L4)。
修复 2:`migration-samples-replay`/`delivery-project-gate`(主干既有 typecheck:test 错误,不动运行时)。

### 3.5 文档(5 文件)

- `docs/01-specification.md` +17(§18 三新命令与旗标;§24 条目 49/50)
- `docs/03-testing-and-usage.md` +3(`run <task-id>` 用法)
- `docs/SCHEMA-FREEZE-M3A.md` +6(§5 additive minor 登记:RunSettled)
- `docs/plan/2026-07-23-saydo-integration-adjudication.fable.md` +586(裁决终稿)
- `docs/plan/2026-07-24-saydo-collaboration-and-gaps.cursor.md` +237(配合分析)

## 4. SayDo 可见契约面变化(审计重点)

1. **`RunSettled` 事件**(settle barrier 官方判据):终态任务的末事件,payload 含 `final_status` / `runner_status` / `summary_path`(可 null) / `evidence_digest`(可 null) / `attempt`。emit 时点在 artifacts 持久化 + 投影写回**之后**——消费到它即可安全读全部产物。三条 emit 路径:executeTask 正常终态、executeTask 异常兜底、cancel dead-owner 兜底。
2. **`hopper capabilities --json`**:握手命令,`schema_version`/`build.commit`/能力分级(`settle_event: "runtime"` 等)。SayDo 启动时校验锁定 SHA 与能力位。
3. **`hopper run <task-id> --json`**:定向执行,闸门与 `run next` 全同;未执行时输出机器可读 `skip_reason`。
4. **幂等/CAS/审计旗标**:`--req-id`(重放安全)、`--expect-status`/`--expect-last-event`(CAS 前置校验,失败退出码非 0 不落事件)、`--origin`/`--receipt`(进事件 payload 审计链)。覆盖 review 三动作、cancel、unblock、merge、retry、drop。
5. **`hopper project show <name> --json`**:解析后项目配置(缺省补全),C2 组装 prompt 语境用。
6. **`.hopper/vault.json`**(vault_id 身份)与 **`.hopper/daemon-heartbeat.json`**(daemon 活性,pid+时间戳,每 tick 刷新):bridge 崩溃恢复与多 vault 识别用。
7. **`hopper show <task-id> --json` 增 `last_run_cost`**:`{known:false}` 与 `$0` 语义区分(fake/离线路径成本未知)。

## 5. 契约测试与切锁流程(复述拍板口径)

1. SayDo 对 baseline.2 树 build dist,跑 P0.5-B 契约测试(fake-runner harness 见 `research/hopper-integration-appendix.md` §2,场景矩阵含 RunSettled 断言);
2. **全绿** → 切锁 `bdd1e548f9359789497a797eda24398beba68ac5`(40 位 SHA);
3. **不绿** → 停留 baseline.1 + 过渡兜底(投影稳定判据),回报失败用例给 Hopper 侧。

> Hopper 侧备注:tag 与 commit 已在 Hopper 本地 main;push 到 origin 由 Hopper owner 决定,不影响 SayDo 按 SHA 锁定本地副本。
