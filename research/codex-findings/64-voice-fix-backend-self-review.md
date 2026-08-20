# 64 · voice-fix-backend 自审（义骁真机反馈：历史回放 + 记忆可见）

日期: 2026-08-12  
分支: `fix/vfx-backend`  
基线: `main` @ `6cd362d`  
范围: daemon 新端点 + mobile_lan 白名单；console mobile 回放/记忆库/toast 去向

## 两件对账

| # | 需求 | 状态 | 证据 |
|---|---|---|---|
| 1 | 对话历史回放 | 完成 | `GET /api/sessions/recent-transcript?limit=40`（`packages/daemon/src/api/recentTranscript.ts`）：sessions 表 talking 优先否则 `started_at` 最新；读 `transcript_path` 尾 N 轮，字段 `speaker/text/origin`（+turnId/ts 供去重），读法对齐 `firstRun.ts:142`；`mobileLanApiAllowed` 放行该 GET；`MobileChatPage` 加载回放置顶，`mergeChatBubbles` 按 turnId 与 live/乐观流去重 |
| 2 | 记忆归属可见 | 完成 | 桌面 Memory 同源只读 `GET /api/projects/:id/memory`（`getProjectMemory` / `api.memory`）；mobile_lan 白名单放行；M-Menu 记忆库纸账本列表（标题/时间/来源，`memoryView.ts`）；确认卡 accept 去向 `confirmDestinationHint(sourceKind=confirmation)` →「记入记忆库」→ toast「已确认·记入记忆库」 |

## daemon 改动边界

- 新增：`api/recentTranscript.ts` + `routeConsoleApi` 一行挂载
- 白名单：`net/mobileLan.ts` 增加 recent-transcript 与 `/api/projects/:id/memory`
- 未改：contracts 形状、Gate 0、写口、S3 面、记忆写路径

## 门禁

- `pnpm --filter @saydo/daemon test`：recent-transcript / t2-thin / mobile-lan-process 在内 **全量绿**（本会话：101 files passed，1214 tests）
- `pnpm --filter @saydo/console test`：**122 passed**
- `scripts/check-emoji.sh`：**[ok]**
- `pnpm ci:node`：**全绿**（typecheck + lint + test + emoji + cli verify:distribution）

## mobile_lan 进程测试

`mobile-lan-process.test.ts` 在 `SAYDO_MOBILE_LAN=1` 下补两条放行：

1. `GET /api/sessions/recent-transcript?limit=40` → 200 + 空投影
2. `GET /api/projects/prj_01F1XT0RE0A000000000000000/memory` → 200 + `[]`

## 偏差与张力

1. **记忆列表 project 来源**：未开 overview 白名单；M-Menu 用 focuses.projectRefs ∪ recent-transcript.projectId 聚合，无项目时空态诚实。
2. **记忆时间**：投影无 `ts` 字段，前端用 mem_ 后 ULID 近似时间；解不出显示「时间未知」。
3. **历史与 live 同会话**：按 turnId 去重；无 turnId 的坏行本就不入投影。
4. **确认卡去向**：有 focusTitle 仍优先「归入「…」」；无 focus 的 confirmation 才「记入记忆库」（与「可证明字段」一致，且记忆库入口已接上只读 API）。

## A 级检查

- [x] Gate 0 无 bypass 新增
- [x] 契约未分叉（未新造 memory/transcript 合同类型进 contracts）
- [x] mobile_lan 仍拒 setup 写口与 overview
- [x] 零 emoji
- [x] TTS/敏感路径未进新响应（只投影 speaker/text/origin/turnId/ts）

## 结论

两件可合入 `fix/vfx-backend`；建议 owner 真机：刷新 M-Chat 仍见历史、侧栏记忆库有条目、确认卡 accept toast 含去向。不 push。
