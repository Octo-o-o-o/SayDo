# RF-01 模块维护卡(module-cards)

> 来源:`docs/08-module-design.md` 目标边界 + 现役仓库结构。每张卡给:职责与
> 状态所有权、公共入口、依赖边(允许/禁止)、测试方式、恢复路径、canonical。
> `状态` 列与 inventory `maturity` 口径一致;目标是"照卡能维护",不是状态宣称。
> owner 字段一律写**角色**不实名(治理草案未定人选,见
> `governance/maintainer-handover.md`)。

## 包级卡

### `@saydo/contracts`(packages/contracts)

- 职责:docs/09 的 zod schema、JCS digest、状态机、renderSpoken;**契约类型唯
  一定义点**(硬规则 5:别处不得重定义)。
- 状态所有权:无运行状态;它是形状权威。
- 公共入口:`src/index.ts` 导出;`src/types/*` 分域(pipeline/voiceBarrier 等)。
- 依赖边:零依赖外泄——contracts 不得依赖 daemon/console/cli;所有人单向依赖它。
- 测试:`pnpm --filter @saydo/contracts test`(schema round-trip + 契约测试)。
- 恢复:不涉及运行时;schema 变更须同版本 bump 与迁移说明。
- canonical:`docs/09-data-contracts.md`。

### `packages/daemon`

- 职责:常驻守护进程——对话域 durable 状态唯一持有者、审批/收据、S3 强认证、
  tier1 执行编排、Brain 工具面、WS/HTTP 服务端。
- 状态所有权:daemon 是对话域 durable owner，持有 SQLite(tasks/approvals/
  memory_events/callback_outbox/focus_* 等)+ 文件(日志/锁/备份)。全部业务写入
  经 `storage/dao/*` 窄口归口是 RF-04/RF-05 目标，尚非现役事实。
  当前四项 `dual_write_gap`：`index.ts` 直接 DELETE `pending_confirmations`、
  UPDATE `confirmation_ledger`；`live/confirm.ts` 直接写 `focus_events` 与 `focuses`。
  这些写面已登记，尚未收拢或修复，见 `repair-3-evidence.md` 与
  `semantic-claims.json` state-owner-* 系列。
- 公共入口:`src/index.ts`(HTTP/WS 路由+生命周期)、`src/tier1/*`(执行域)、
  `src/brain/*`(工具面)、`src/api/*`(门面)。
- 依赖边:→ `@saydo/contracts`、`@saydo/platform`;不得反向依赖 console/cli。
- 测试:`pnpm --filter @saydo/daemon test` + e2e 场景(需 `just dev` 起栈)。
- 恢复:crash → supervisor 生命周期帧(`ipc_frames`)+ recovery-only server;
  数据恢复走 §17.5 隔离序列。
- canonical:`docs/03-architecture.md`、`docs/09-data-contracts.md` §3/§6/§16。

### `packages/console`

- 职责:Web 控制台(Vite+React+Tailwind v4+shadcn/ui);消费面,不是端点定义面。
- 状态所有权:无服务端状态;UI 态在组件与 `lib/api.ts` 投影。
- 公共入口:`src/lib/api.ts`(`apiGet/apiPost/apiDelete` 成员)、
  `src/lib/setupApi.ts`(setupFetch)、`src/voice/useVoiceChannel.ts`。
- 依赖边:→ daemon HTTP/WS;不得直连 DB/绕 daemon。
- 测试:`pnpm --filter @saydo/console test` + Playwright(`e2e/` 走宿主配置)。
- 恢复:重连 WS;守护不可用时降级只读提示。
- canonical:`docs/08-module-design.md` §6、`docs/11-ui-spec.md`。

### `packages/cli`

- 职责:`saydo` CLI——up(默认,probe→holdAttached/runOwned)/status/open/
  doctor/help;supervisor 进程监管;emergency reaper。
- 状态所有权:无业务状态;持有 supervisor IPC 客户端与 pid/锁文件视图。
- 公共入口:`src/cli.ts`(命令分支)、`src/options.ts`(声明/解析)、
  `src/supervisor.ts`(spawn/IPC)。
- 依赖边:→ daemon HTTP + supervisor IPC;不直接改 daemon SQLite。
- 测试:`pnpm --filter @saydo/cli test`;`scripts/test-dev-lifecycle.mjs`。
- 恢复:父死→reaper 兜底;`stopped/fatal` IPC 帧驱动退出语义。
- canonical:`docs/09-data-contracts.md` §16.3/§16.4。

### `packages/platform`

- 职责:宿主平台抽象(锁/家目录防护/fsync 语义),向 daemon/cli 提供宿主原语。
- 状态所有权:宿主文件层原语,不持业务状态。
- 公共入口:`src/homeLock.ts`、`src/lock.ts`、`src/fs.ts`。
- 依赖边:零对 daemon/console 依赖;被单向引用。
- 测试:`pnpm --filter @saydo/platform test`。
- canonical:`docs/09-data-contracts.md` §16.x 宿主契约段。

### `pipeline/`(Python/WS)

- 职责:语音管线——ASR/TTS/VAD 编排,无状态可重启,经 WS 与 daemon 通信。
- 现役底座:独立 Python WS client 与 RMS/hangover VAD；Pipecat 打断 spike 已验证但未接入运行时，Silero 升级仍为待验目标，见 `docs/03-architecture.md` 语音底座与 `docs/07-tech-stack-decisions.md` D2。
- 状态所有权:无 durable 状态(无状态设计);会话态在 daemon。
- 公共入口:`pipeline/src/saydo_pipeline/`(hub_client/doubao_asr/doubao_tts/
  hf_round/vad/platform/win32_native)。
- 依赖边:→ daemon WS(`/ws/voice` 词表);不持业务真相。
- 测试:`uv --directory pipeline run python -m pytest -q`(just ci-python)。
- 恢复:进程可重启;崩溃按 watermark/unknown 语义上报,不重放副作用。
- canonical:`docs/10-voice-ux-spec.md`、`docs/09-data-contracts.md` §17.6。

### `apps/ios`、`apps/android`、`apps/harmonyos`

- 职责:三端原生壳——WebView/ArkUI 容器 + bridge + 安全存储 + 扫码配对。
- 状态所有权:设备端凭据(Keychain/AndroidKeyStore/HUKS 映射 §17.7);
  业务真相不回写设备。
- 现状:**inventory_only/designed**(文件树 23/37/33 可证,未跑真机);
  能力矩阵见 `fixtures/device-capability-matrix.json`;壳存在 ≠ 远端业务开放。
- 测试:三端单测目录存在;真机验证需签名与设备凭据(缺失,NOT_RUN)。
- canonical:`docs/09-data-contracts.md` §17.7。

### `e2e/`、`scripts/`、`docs/`、`demo/`、`research/`、`history/`

- `e2e/`:端到端与证据(`e2e/evidence/phase-N.md`、`e2e/smoke/`)。
- `scripts/`:门禁与工具(check-*/test-*;`check-offline-fixtures.mjs` 为
  RF-00 离线语料校验)。
- `docs/`:canonical 唯一源;`docs/plan/` 管排产不管合同形状。
- `research/`/`history/`/`prompts/`:证据/过程档案/评审输入。

## 贡献入口与扩展样例(RF-01)

新增能力的三个最小样例(形状照抄,均在 RF-01 实施期才落):

- **新 provider adapter**:在 `pipeline/` 增 ASR/TTS 实现 → 注册进 provider 表
  → conformance corpus(`fixtures/provider-executor-conformance.json`)加对应
  surface=provider 案例 → contract 侧如有新帧先改 `packages/contracts`。
- **新设备 client**:`apps/<platform>/` 增壳 → `fixtures/device-capability-matrix`
  增平台行(maturity_now=inventory_only 起步)→ bridge 帧 golden 复用
  `fixtures/bridge-frames.json` → 远端开放仍需 owner 授权,不因壳存在而开。
- **新 console 页面**:`packages/console/src/` 增页 → `lib/api.ts` 增投影成员
  → `inventory.json` `console_api_members` 机械命中自动跟上 → RF-06 挂接验收。

约定:任何"扩展样例"先过 contract-first 检查(§17 形状优先),再在对应 RF
批次内实施;本文件是 RF-01 准备材料,不是模块改造完成证明。
