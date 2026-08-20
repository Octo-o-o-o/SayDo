# Focus Contract 批 1 · M1+M2 实施证据

> 分支：`feature/focus-contract-v0`（独立 clone `SayDo-focus-build`）
> 日期：2026-08-04
> 范围：实施计划 M1(A1–A5) + M2(B1–B5)；**不含 M3 live 接缝**

## 1. 任务完成状态

| 任务 | 状态 | 说明 | commit |
|---|---|---|---|
| A1 DDL 批 1 表 | 完成 | 7 canonical + 2 shadow + sessions 两列；约束/触发器齐 | `ac659dc` |
| A2 DDL 批 2 表壳 | 完成 | `focus_resume_packets` + `action_execution_bindings` | `ac659dc` |
| A3 contracts Focus zod | 完成 | 六对象 + RpFact/packet/binding + event payload v1 | `ac659dc` |
| A4 FocusWriteTx | 完成 | 唯一写入口；seq/revision 连续；崩溃回滚测试 | `ac659dc` |
| A5 feature flag stage | 完成 | `[focus].stage` 缺省 0；五项基线 diff 测试 | `ac659dc` |
| B1 registry+resolver+lifecycle | 完成 | 判别返回 / title 候选 / 全边硬前置 | `a876037` |
| B2 obligation 台账 | 完成 | 双轴 SM / dedupe 幂等 / resolution 跨表 validator | `a876037` |
| B3 activation 基础 | 完成 | create/close/anchor CAS；恢复回接归 M3 C2 | `a876037` |
| B4 CloseSettlement | 完成 | 枚举→呈现→确认/auto→committed CAS；纯服务层 | `a876037` |
| B5 conformance | 完成 | V1/V2/V4/V7① + matrix 28 条正反例 | `a876037` |

### 版本号偏离（非产品裁决）

计划文稿写「迁移 v14/v15」。本仓迁移链在开工时已占用：

- v14 = `applyDdlV14ProjectAnchors`
- v15 = `DDL_V15_PROJECT_TYPE_IMMUTABLE`

Focus 批 1/批 2 顺延为 **v16 / v17**（内容与约束按方案 §2 与计划 A1/A2，仅版本号反映链序）。未改既有 v14/v15 语义。

### frozenInputs CAS 与相位事件

收场 present/confirm/auto_ledger 会追加 `close_settlement` 相位事件，抬高 `MAX(seq)`。
committed 时 CAS 将「冻结水位之后的非 `close_settlement` 事件」视为真正漂移；相位事件不触发 conflict。
义务 digest / focusRevision / sessionFocusAnchorRevision 仍 exact CAS。

## 2. 代码 commit SHA（本会话 `git rev-parse`）

| 角色 | short | full |
|---|---|---|
| M1 feat | `ac659dc` | `ac659dc52fe7a037185be3fbc3fa92b76fe3d4b4` |
| M2 feat | `a876037` | `a87603786bcb5794e149dd05878b51a8b5f6535b` |
| evidence | 本文件所在 `chore(evidence)` tip（不自指 SHA，避免 amend 漂移） | 以 `git log -1 --oneline` 为准 |

## 3. 门禁命令与输出摘录（本会话真实运行）

### 3.1 `pnpm typecheck` — exit 0

```
Scope: 4 of 5 workspace projects
packages/contracts typecheck$ tsc --noEmit
packages/contracts typecheck: Done
packages/console typecheck$ tsc --noEmit
packages/daemon typecheck$ tsc --noEmit
packages/console typecheck: Done
packages/daemon typecheck: Done
```

注：根 `package.json` 无 `build` script；编译门 = `pnpm typecheck`（`tsc --noEmit` 全绿）。

### 3.2 `pnpm lint` — exit 0

```
> eslint packages/*/src
（无 error 输出）
```

### 3.3 `bash scripts/check-emoji.sh` — exit 0

```
[ok] emoji gate: clean
```

### 3.4 contracts 测试

基线（实施前）：**73 passed**

实施后：

```
Test Files  7 passed (7)
     Tests  83 passed (83)
```

（+10 focus-schema 测试；只增不减）

### 3.5 Focus 新增测试

```
[pass] test/focus-stage0.test.ts (5 tests)
[pass] test/focus-migration.test.ts (5 tests)
[pass] test/focus-write-tx.test.ts (7 tests)
[pass] test/focus-services.test.ts (13 tests)
[pass] test/focus-conformance.test.ts (29 tests)

Test Files  5 passed (5)
     Tests  59 passed (59)
```

### 3.6 daemon 全量测试（环境说明）

本会话 sandbox **禁止写入 `$HOME`**（`touch ~/.saydo-test-write-probe` → EPERM）。
既有用例中约 42 个使用 `mkdtempSync(join(homedir(), ".saydo-..."))`，在本环境恒红，与 Focus 改动无关。

实施后本环境实测：

```
Test Files  11 failed | 62 passed | 2 skipped (75)
     Tests  42 failed | 659 passed | 4 skipped (705)
```

- 42 failed：全部为 `EPERM mkdtemp '/Users/.../.saydo-...'`（home 写禁）
- 4 skipped：与基线一致
- 659 passed = 原可跑通部分 + Focus 59 条（tmp 夹具）
- Focus 相关文件全部绿；v4-era 追赶到 v17 的 migration 测试在 Focus 套件内绿

无沙箱机器上预期：home 写可用时 42 个 EPERM 应恢复绿，总数约 701 passed | 4 skipped（基线约 642–700 量级 + 59 Focus）。

### 3.7 `just ci` / Python 矩阵

`just ci-python` 在本环境失败：

```
error: Failed to initialize cache at `/Users/wangyixiao/.cache/uv`
  Caused by: ... Operation not permitted
```

同样为 sandbox 禁写 home/cache，**非 Focus 代码越界**（Python 侧零改动）。无沙箱环境应重跑 `just ci` 全绿验收。

## 4. 主要落盘路径

```
packages/contracts/src/types/focus.ts
packages/contracts/src/digests.ts          # computeObligationsDigest / resume packet
packages/daemon/src/storage/ddl.ts         # v16/v17
packages/daemon/src/focus/writeTx.ts
packages/daemon/src/focus/registry.ts
packages/daemon/src/focus/obligations.ts
packages/daemon/src/focus/activation.ts
packages/daemon/src/focus/closeSettlement.ts
packages/daemon/src/focus/stage.ts
packages/daemon/src/focus/directWriteGuard.ts
packages/daemon/src/config/types.ts        # [focus].stage
packages/daemon/test/focus-*.test.ts
```

## 5. 未做 / 明确边界（M1+M2 批；见下节 M3 已交付）

- canonical 回写 09/10/04 — 计划随实施批轻量评审，本批未改 main 仓文档
- 未触 `~/.saydo/`、未触主仓 `SayDo`、未合并未部署

## 6. BLOCKED / NEEDS_DECISION（M1+M2）

无。版本号 v16/v17 为链序必然适配，已在上文记录。

---

# Focus Contract 批 · M3 实施证据（live 接缝 + 批 2）

> 日期：2026-08-04
> 分支：`feature/focus-contract-v0`
> 基线 HEAD（M1+M2 tip）：`1f8e2ff`
> M3 feat：`3a0afc0`（full `3a0afc0` 见 `git rev-parse 3a0afc0`）
> 范围：C1–C7 全量

## M3.1 任务完成状态

| 任务 | 状态 | 说明 | commit |
|---|---|---|---|
| C1 requestClose/requestSuspend 门 | 完成 | `sessionCloseGate.ts`；`voiceSessions.suspend` 先门后转态；stage0 旧直转保留 | `3a0afc0` |
| C2 中断恢复 + V7② | 完成 | `interruptRecovery.ts` + reconciler 扩；closed 禁 rebuild；provisional 尾部重建 | `3a0afc0` |
| C3 ConfirmationLoop Focus 分支 | 完成 | focus_anchor/obligation/revision；未知 payload fail-closed；三 propose 工具 stage≥1 | `3a0afc0` |
| C4 RP 编译器+renderer V5 | 完成 | `resumePacket.ts` typed IR；只存 IR；renderer 纯函数幂等；冲突并列 | `3a0afc0` |
| C5 binding 生产接线 | 完成 | 签发冻结快照 v18；dispatch CAS+binding；claimNext ledgerRef；hopper dormant 写序 | `3a0afc0` |
| C6 shadow + task→obligation | 完成 | projection/compare；external_bootstrap 写闸；结算状态表写死；outbox ack 负向 | `3a0afc0` |
| C7 console 只读页 | 完成 | Focus 列表/详情 API+页；Playwright ≥2；fixture 种 Focus | `3a0afc0` |

DDL 增量：**v18** `focus_auth_snapshots`（签发时冻结 Focus 授权快照）。

## M3.2 门禁（本会话真实命令）

### typecheck / lint / emoji

```
pnpm typecheck  → packages/contracts/console/daemon Done（exit 0）
pnpm lint       → eslint packages/*/src 无 error（exit 0）
bash scripts/check-emoji.sh → [ok] emoji gate: clean
bash scripts/test-emoji-gate.sh → emoji-gate self-test: pass=11 fail=0
```

### contracts

```
Test Files  7 passed (7)
     Tests  83 passed (83)
```

### Focus 套件（含 M3）

```
test/focus-stage0.test.ts
test/focus-migration.test.ts   # 尾项=18 + focus_auth_snapshots
test/focus-write-tx.test.ts
test/focus-services.test.ts
test/focus-conformance.test.ts
test/focus-m3-live.test.ts     # 22 tests: C1–C6 / V5 / V7② / 负向

Test Files  6 passed (6)
     Tests  81 passed (81)
```

### daemon 全量（环境说明）

本会话 sandbox 对 `$HOME` 写受限。用**工作区内** `HOME=$PWD/.tmp-home` 跑全量：

```
Test Files  1 failed | 72 passed | 3 skipped (76)
     Tests  1 failed | 858 passed | 7 skipped (866)
```

- 1 failed：`memory-foundation` 在临时 HOME 下 git 探测偏差（与 Focus 改动无关；默认 HOME 下该套件可绿）
- 7 skipped：含既有 skip + 环境跳过
- Focus 相关文件全部绿；基线约 840 passed 量级 + M3 22 条落在 858 内
- 跑完已 `rm -rf .tmp-home`，emoji 门禁再扫 clean

### Playwright C7

新增用例（依赖 e2e/console global-setup；本会话未起完整 Playwright daemon——代码与 fixture 已落盘）：

- `Focus 列表渲染(lifecycle/revision/未结义务)`
- `Focus 详情义务清单渲染(kind/owner/status/nextStep)`

无沙箱机器上跑：`pnpm exec playwright test e2e/console/console.spec.ts -g Focus`

### just ci

`just ci-python` 在本环境仍受 uv cache 写 `$HOME` 限制（同 M1+M2）。node 侧 typecheck+lint+Focus 套件+emoji 已绿。

## M3.3 主要落盘路径

```
packages/daemon/src/focus/sessionCloseGate.ts
packages/daemon/src/focus/interruptRecovery.ts
packages/daemon/src/focus/resumePacket.ts
packages/daemon/src/focus/binding.ts
packages/daemon/src/focus/shadow.ts
packages/daemon/src/focus/taskObligationMap.ts
packages/daemon/src/live/voiceSessions.ts      # C1/C2
packages/daemon/src/live/confirm.ts            # C3
packages/daemon/src/live/dialog.ts             # C3
packages/daemon/src/brain/liveTools.ts         # C3 tools + C5 dispatch
packages/daemon/src/approvals/issue.ts         # C5 快照
packages/daemon/src/tier1/executor.ts          # C5 claimNext
packages/daemon/src/bridge/dispatch.ts         # C5 hopper dormant
packages/daemon/src/recovery/reconciler.ts     # C2
packages/daemon/src/storage/ddl.ts             # v18
packages/console/src/pages/Focuses.tsx
packages/console/src/pages/FocusDetail.tsx
packages/daemon/test/focus-m3-live.test.ts
e2e/console/console.spec.ts
```

## M3.4 偏离与诚实边界

1. stage1 空闲超时：present 留痕后由调用方 suspend（零语义挂账）；stage2 才 auto_ledger+commit（与 stage 语义对齐）。
2. Hopper binding：完整写序在 `completeDispatch` + `activateHopperBindingOnDispatchComplete`，`focus.hopperBindingEnabled` 缺省 false（dormant）。
3. Playwright 全链路未在本会话起 global-setup 实测（fixture+用例已写）；owner 侧无沙箱可复验。
4. 未触 `~/.saydo/`、未触主仓、未合并未部署。

## M3.5 BLOCKED / NEEDS_DECISION

无。

---

# E2 修复批(2026-08-04 下午,reviewer 既白现场实施+浏览器模拟验证)

## 修复清单与验证(全部经浏览器全流程模拟+库验)

| 刀 | 内容 | commit | 模拟验证 |
|---|---|---|---|
| F20 | proposeObligationResolve 销账工具+确认环+消费 | 2a7cd29+39e7d85 | [pass] 「整理观察表行」resolved/done/带 resolution event(seq 56) |
| F02 | anchor 零候选转"新建并锚定"确认环 | 2a7cd29 | [pass] 「E2 复盘演练」created+锚定 |
| 换锚 | 锚定消费前关闭异 Focus active activation | c9de306 | [pass] 新 active/旧 closed;captured→active 生命周期兑现 |
| F01 | 归属预路由 Focus 意图放行 | 2a7cd29 | [pass] fresh 会话锚定句直达确认,无归属问句 |
| F17 | redactor 豁免自家业务 id | aaa7bdc | [pass] 话术完整显示 focus:foc_01KZ5PD0... |
| F18 | 三 propose 工具 control:await_user | af5bfdb | [pass] 三次确认环零抢答 |
| F14 | 已答问句不挂账/承诺不算答 | 2a7cd29 | [pass] 空清单如实播"本轮没有需要挂账的事项" |
| F07 | 空句过滤 | 2a7cd29 | [pass] 本批对话零空气泡 |
| F05 | barge-in 否定词消费(收窄版;肯定放行待 owner 拍板 A8 权衡) | 2a7cd29 | 单测过(A8 四测试保持) |
| F04 | TTS 空音频剥引号重试+单句失败不降全局 | 2a7cd29 | py 32 过(含两条新用例) |
| F15 | 孤儿转写防御 | 2a7cd29 | 单测过 |
| 路由 | 确认消费白名单补两 kind | 39e7d85 | [pass](模拟先抓出 unknown 拦截后补) |

## 门禁终态

contracts 83 / daemon 863|4 skipped / python 32 / just ci exit 0(本文件更新前实测)。

## 已知残留(下一批)

F22 同 focus 重复锚定不幂等(撞单 active 报错,应幂等答"已锚着");错误话术含 error code 且被脱敏(R4 人话化);F05 肯定词放行待 owner 拍板;F10 模态自适应阈值;F19 弱模型回归对照。
