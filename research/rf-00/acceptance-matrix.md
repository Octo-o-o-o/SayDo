# RF-00..RF-11 / PG-02..06 验收矩阵(独立准备,非验收结论)

> 目的:把 RF-00 的每类分母与每个 RF/PG 的验收面逐项映射到真实命令与脚本。
> `selected` = `semantic-claims.json` `item_dispositions` 命中的机械项数;
> `script` 列标脚本是否现存(`[new]`=该批卡声明随批建立);`run` 列区分
> `已跑`/`NOT_RUN(原因)`;**不把未跑说成已验**。本文件是映射表,实际执行记录
> 在 `repair-3-artifacts/REPORT.md` 与 `logs/`(仓外证据目录)。
> A 节分母由 inventory --write 同步、--check 全类逐行比较：稳定类取 fresh，legacy 取落盘库存快照；逐项处置≠生产验收；
> 逐项核验等级见 `repair-3-evidence.md` 与 REPORT 分节。

> 时点说明：本表的已跑与 NOT_RUN 记录来自 2026-09-29 repair-3，后续整合测试不回写为该轮通过。2026-10-03 的机械库存更新只对账当前受跟踪源码与逐项处置，不证明 RF-01..11 生产验收；新测试事实见本轮整合审计记录。

## A. RF-00 分母逐项映射

| 类 | discovered | selected | 归口 RF/PG | 核验命令 | script | 本轮状态 |
|---|---|---|---|---|---|---|
| `transport_registrations` | 660 | 660 | RF-00 全源候选;RF-05 入口 | `node scripts/rf00-inventory-scan.mjs --check` | 现存 | 精确处置映射;运行时 NOT_RUN |
| `http_routes` | 87 | 87 | RF-05 逐路由迁移台账;RF-02 竖切 | `node scripts/rf00-inventory-scan.mjs --check` | 现存 | 逐项处置完成(源码级);路由运行时验收=RF-05,NOT_RUN |
| `ws_messages` | 35 | 35 | RF-02 wire 合同;RF-05 WS 生命周期;RF-08 对照 | 同上 | 现存 | 逐项处置完成(contracts schema+各端生产/消费面);WS 会话验收=RF-02/05,NOT_RUN |
| `ipc_frames` | 5 | 5 | RF-05 进程生命周期;RF-10 启动关闭验证 | 同上 | 现存 | 逐项处置完成(supervisor `{v:1,t}` 帧源) |
| `brain_tools` | 32 | 32 | RF-03 工具面;RF-07 provider/executor 分责 | 同上 | 现存 | 逐项处置完成(liveTools 注册→operations/DAO 效果);端到端验收=RF-03/07,NOT_RUN |
| `task_actions` | 5 | 5 | RF-05;RF-06 操作行 | 同上 | 现存 | 逐项处置完成,`action-effect-audit.md` |
| `cli_commands` | 5 | 5 | RF-01 命令入口;RF-10 工具链面 | 同上 | 现存 | 逐项处置完成,含默认 `up→runOwned` 三方对账 |
| `console_api_members` | 43 | 43 | RF-02 SDK 竖切;RF-06 消费 | 同上 | 现存 | 逐项处置完成(api.ts/setupApi.ts 消费面→路由);消费端运行时=RF-06,NOT_RUN |
| `tables` | 57 | 57 | RF-04 ports/迁移 | 同上 | 现存 | 逐项处置完成(DDL 声明+代际/FTS/迁移标注);表行为验收=RF-04,NOT_RUN |
| `table_writers` | 116 | 116 | RF-04 唯一 owner 归口 | 同上 | 现存 | 逐项处置完成;4 项双写缺口登记未修(见 repair-3-evidence);owner 归口验收=RF-04,NOT_RUN |
| `file_writers` | 225 | 225 | RF-04 文件写归口;RF-10 制品验证 | 同上 | 现存 | 逐项处置完成(调用点级语义);文件系统运行时验收=RF-04,NOT_RUN |
| `module_dependencies` | 5 | 5 | RF-01 导入白名单 | 同上 | 现存 | 逐项处置完成(声明面);白名单执行=RF-01,NOT_RUN |
| `external_dependencies` | 55 | 55 | RF-01 依赖禁则;RF-10 SBOM | 同上 | 现存 | `declared_only`:仅声明面核对,无下载/审计/锁定核验(=RF-10 范围,NOT_RUN) |
| `artifacts` | 9 | 9 | RF-10 exact-set/签名 | 同上 | 现存 | 逐项处置完成(声明/模板/跟踪清单面);制品生成与签名校验 NOT_RUN |
| `support_facts` | 28 | 28 | RF-09 设备矩阵;RF-11 支持声明 | 同上 | 现存 | 声明面逐项核对+本机只读实测(见 D 节);跨平台实测=RF-09,NOT_RUN |
| `legacy_candidates` | 54 | 14 | RF-00 disposition;PG-02 旧账对账 | 同上 | 现存 | 本机运行元数据快照枚举；selected 为具名处置数量，未据此宣称全部产品语义已验；不恢复/不合并/不覆盖 |

门禁脚本存在性与作用:

| 脚本 | 存在 | 覆盖 |
|---|---|---|
| `scripts/rf00-inventory-scan.mjs` | 现存 | 机械扫描+对账+变异自测 |
| `scripts/check-offline-fixtures.mjs` | 现存 | fixtures/ 语料形状+变异自测(fixture pass≠产品验收) |
| `scripts/schedule-pointer.mjs` | 现存 | 排产指针 |
| `scripts/check-doc-links.mjs` | 现存 | canonical 链接 |
| `scripts/check-emoji.sh` | 现存 | 零 emoji |
| `scripts/check-public-tree-privacy.mjs` | 现存 | 隐私硬门(`--fs` 与 `--ref`) |
| `scripts/check-active-claims.mjs` | 现存 | 活动声明 |
| `scripts/check-remote-surface-inventory.mjs` | 现存 | 远端面清单(本轮未跑,NOT_RUN) |
| `scripts/check-gate-list-parity.mjs` | 现存 | gate 一致性(本轮未跑,NOT_RUN) |

## B. RF/PG 逐项:可独立准备物与阻塞类别

阻塞类别取值:`required 门未过`(链上前置未收口)/`外部未授权`/`设备凭据缺失`/`合同审查未过`。
2026-09-29 repair-3 的授权覆盖 RF-00 证据补齐与普通连续推进；当时剩余的第三次独立合同评审已获 owner 确认通过，见下表。该合同检查点不代表 PG-02 或后续 RF 产品验收。

| 项 | 本轮已备(独立) | 真实命令/脚本(批卡原文) | 阻塞类别 | 精确依赖与入口 |
|---|---|---|---|---|
| RF-00 合同检查点 | §17.1/17.2/17.3/17.7/17.8 定稿;分母逐项处置见本表 A 节生成值(唯一数值源);三方对账;action-effect-audit;fixtures;矩阵 | `node scripts/rf00-inventory-scan.mjs --check/--write/--mutation-test`、`node scripts/check-offline-fixtures.mjs`、`node scripts/schedule-pointer.mjs --check`、`node scripts/check-doc-links.mjs`、`bash scripts/check-emoji.sh`、`node scripts/check-public-tree-privacy.mjs --fs` 与固定 `--ref`、`git diff d023ffcebfad38563bc988977192e77654d7e2a1 --check` | **合同检查点已独立通过**(owner 本卡确认);PG-02 在途待独立验收 | 合同检查点通过不代表 PG-02 产品通过 |
| PG-02 minimal-truth-gate-bootstrap | RF-00 逐项处置供其 inventory/对账消费;旧账对账 `pg02-fact-reconciliation.md` | focused `FG-PG02-BOOTSTRAP`:`pnpm --filter @saydo/contracts exec vitest run test/schemas.test.ts`;`[new] node scripts/check-capability-ledger.mjs`;`[new] node scripts/test-capability-ledger.mjs`;`[new] node scripts/check-action-reachability.mjs`;`[new] node scripts/test-action-reachability.mjs`;`[new] node scripts/check-support-matrix.mjs`;`[new] node scripts/test-support-matrix.mjs`;full `just ci`、`pnpm exec playwright test`;impl commit 重跑 `FG-PG01A-CLAIM`(read-only validator/mutation 与 Q0 --check 子集)与 `FG-PG01B-RUNTIME` | PG-02 required 门未过 | 入口 `docs/plan/IMPLEMENTATION-PLAN-2.md` PG-02 批卡;evidence `e2e/evidence/project-gap-pg-02.md`;PG-02 检查器已恢复为候选,真实自检见 project-gap-pg-02 证据 |
| PG-03 gate-truth | 无(不前置本批) | focused `FG-PG03-CONTROL`:`node scripts/test-release-provenance.mjs`;`node scripts/test-release-physical-evidence.mjs`;`node scripts/check-doc-links.mjs`;`node scripts/third-party-notices.mjs --check`;`pnpm --filter @saydo/cli verify:distribution`;`[new] node scripts/check-gate-manifest.mjs`;`[new] node scripts/test-gate-manifest.mjs`;full `just ci`、`pnpm exec playwright test` | required 门未过(PG-02) | 入口 PLAN-2 PG-03 批卡;evidence `e2e/evidence/project-gap-pg-03.md` |
| PG-04 audit-new-write-safety | 无 | focused `FG-PG04-AUDIT`:`[new] pnpm --filter @saydo/daemon exec vitest run test/logger.test.ts test/audit.test.ts`;`[new] node scripts/audit-sensitive-inventory.mjs`;`[new] node scripts/test-audit-sensitive-inventory.mjs`;full `just ci` | required 门未过(PG-03) | 入口 PLAN-2 PG-04 批卡;evidence `e2e/evidence/project-gap-pg-04.md` |
| PG-05 db-safety | tables/table_writers/file_writers 逐项处置底稿 | focused `FG-PG05-DB`:`pnpm --filter @saydo/daemon exec vitest run test/storage-migration-v5.test.ts test/storage-checks.test.ts test/storage-crash.test.ts test/storage-roundtrip.test.ts test/backup.test.ts`(批卡要求含 WAL/SHM 一致读、quiesced copy、WAL-only future/gap、每种迁移故障点反例);full `just ci` | required 门未过(PG-04) | 入口 PLAN-2 PG-05 批卡;evidence `e2e/evidence/project-gap-pg-05.md` |
| PG-06 admission-discovery-tightening | 无 | focused `FG-PG06-ADMISSION`:`[new] pnpm --filter @saydo/daemon exec vitest run test/cli-capability.test.ts test/provider.test.ts test/setup-onboarding.test.ts test/tier1-security.test.ts test/provider-admission.test.ts`;`pnpm --filter @saydo/console exec vitest run src/lib/setupApi.test.ts`;full `just ci` | required 门未过(PG-05) | 入口 PLAN-2 PG-06 批卡;evidence `e2e/evidence/project-gap-pg-06.md`;收口后停 owner-stop |
| RF-01 boundary-contribution | `module-cards.md`、根 `CONTRIBUTING.md`(草案)、module_dependencies 逐项处置 | 现有可复用命令:`pnpm --filter <pkg> test`、`pnpm -r typecheck`、`just ci`;focused gate 随执行卡定档 | required 门未过(PG-02..06 全部) | 入口:packages/* + module-cards |
| RF-02 wire-sdk | §17.7/17.8 帧与兼容窗口定稿;ws_messages 逐项处置 | focused gate 随执行卡定档;可复用 `pnpm --filter @saydo/contracts exec vitest run` | required 门未过 | contracts schema 落地 |
| RF-03 app-service-security | `action-effect-audit.md`、brain_tools 逐项处置(提案/效果/presentation/S3 拒口语分类) | focused gate 随执行卡定档 | required 门未过 | RF-02 + PG-04 |
| RF-04 storage-recovery | tables/table_writers/file_writers 逐项处置 + 4 项双写缺口具名登记 | focused gate 随执行卡定档 | required 门未过 | RF-03 + PG-05 |
| RF-05 gateway-protocol | http_routes 逐项处置(分母见 A 节唯一生成值)(五面分源/权限断言);ipc_frames 处置 | focused gate 随执行卡定档 | required 门未过 | RF-02/03 + RF-04 接口 |
| RF-06 web-consumption | `rf06-fixture-demo-plan.md`、console_api_members 逐项处置（分母见 A 节） | `node scripts/check-offline-fixtures.mjs`(现存,已跑);focused 随执行卡 | required 门未过 | 入口:`packages/console/src/lib/*` |
| RF-07 provider-executor | `fixtures/provider-executor-conformance.json`(13 案例) | `node scripts/check-offline-fixtures.mjs`(现存,已跑);focused 随执行卡 | required 门未过 | tier1/pipeline 责任边界 |
| RF-08 media-selection | `fixtures/media-corpus.json`(24 场景) | `node scripts/check-offline-fixtures.mjs`(现存,已跑);focused 随执行卡 | required 门未过 + **provider 未跑=无性能数据** | 入口:pipeline + §17.6 硬门 |
| RF-09 native-bridge | `fixtures/bridge-frames.json`(14 案例)+ `device-capability-matrix.json`;本机只读设备枚举(见 D) | `node scripts/check-offline-fixtures.mjs`(现存,已跑);focused 随执行卡 | required 门未过 + **设备凭据缺失**(Android/HarmonyOS 无目标,模拟器二进制缺失) | 入口:apps/* + §17.7 |
| RF-10 toolchain-release | `fixtures/release-closure-sample.json`;artifacts/external_dependencies 声明面处置 | `node scripts/check-offline-fixtures.mjs`、`node scripts/release-asset-manifest.mjs`(现存);focused 随执行卡 | required 门未过 + **外部未授权**(本轮 RF-10 新制品的验证/签名/发布未获授权；既有 rc.13 发布保留) | 入口:scripts/release-*.mjs |
| RF-11 open-source | `CONTRIBUTING.md`/`GOVERNANCE.md`/`CODE_OF_CONDUCT.md`(草案)+ `governance/maintainer-handover.md` + `CODEOWNERS.draft` | focused gate 随执行卡定档 | required 门未过 + **外部未授权**(公开贡献主线切换未获授权；既有公开快照保留);**演练 NOT_RUN**(无第二人) | 收口依赖已声明支持范围 |

## C. 显式 NOT_RUN / 阻塞声明

- `just ci` 全量、`pnpm exec playwright test`、provider/executor 实跑、真机/模拟器、
  真实安装与发布:**NOT_RUN**,不因静态处置与 fixture 通过而冒认为已验。
- 合同检查点已独立通过(owner 2026-09-29 本卡确认);PG-02 产品尚待独立验收,历史 RED 与计数保留。
- `check-remote-surface-inventory.mjs`、`check-gate-list-parity.mjs`、`week-audit`:
  本轮未跑,NOT_RUN。
- 2026-10-03 已核：公开 SayDo 的 `release tags immutable` ruleset(id 21510845)为 active，公开快照与 rc.13 Release 已存在；私有 SayDo-archive 的 rulesets 为空。RF-11 的公开贡献主线与分支保护尚未切换，DCO 签署未启用，治理文件仍为草案；既有发布不代表本轮获准发布新制品。
- `external_dependencies` 55 项仅声明面处置;未做 lockfile 字节级核验与安装审计。
- `artifacts` 9 项为声明/模板/跟踪清单核对;未做制品生成、签名与远端下载核验。
- 双写缺口 4 项(table_writers)已具名登记于 `repair-3-evidence.md`,属 finding
  不属修复。

## D. 本机只读可用性盘点(2026-09-29,repair-3 实跑)

工具可用性(实测存在+版本):

| 工具 | 路径 | 版本/状态 |
|---|---|---|
| node | `/opt/homebrew/opt/node@22/bin/node` | v22.23.2 |
| pnpm | `~/.local/bin/pnpm` | 10.33.1 |
| python3 | `/opt/homebrew/opt/python@3.12/libexec/bin/python3` | 3.12.14 |
| just | `/opt/homebrew/bin/just` | 1.57.0 |
| uv | `/opt/homebrew/bin/uv` | 0.11.7 |
| git | `/opt/homebrew/bin/git` | 2.55.0 |
| xcrun | `/usr/bin/xcrun` | 存在 |
| security | `/usr/bin/security` | 存在(identity 枚举只读) |
| adb | `/opt/homebrew/bin/adb` | 存在;`adb devices` 空(无 Android 设备) |
| hdc | DevEco-Studio 内 toolchains | 存在;`hdc list targets` 空(无 HarmonyOS 目标) |
| xcodebuild | `/usr/bin/xcodebuild` | 存在 |
| gh | `/opt/homebrew/bin/gh` | 存在 |
| Android emulator 二进制 | — | **缺失**(`emulator` 不在 PATH/sdk 常规位) |

设备/运行时枚举(只读,未改任何设备状态):

- iOS 模拟器运行时:iOS 27.0、watchOS 27.0 已装;`simctl list devices` 有可用机型。
- Android:`adb devices` 无附加设备;无 emulator 二进制 => Android 通道当前不可实测。
- HarmonyOS:`hdc list targets` 空 => 当前不可实测。

签名 identity(`security find-identity -v -p codesigning`,只读枚举,不含私钥内容):
4 个有效 identity——Apple Development×2(含一枚 API 创建)、Apple Distribution、
Developer ID Application(均属 Yixiao Wang)。可签名能力存在;实际签名与公证执行
属 RF-10 外部授权范围,NOT_RUN。

实测口径:以上为 `darwin/arm64` 本机观察,不外推 win/ubuntu 支持;声明与实测
分记在 `support_facts` 各项 note 与 `support-matrix` 处置。
