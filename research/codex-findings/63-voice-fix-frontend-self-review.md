# 63 · voice-fix-frontend 自审（义骁 iPhone 真机首测前端半 5 件）

日期: 2026-08-12  
分支: `feat/m2-ios-shell-spike`  
范围: `packages/console/src/mobile/**`、`apps/ios/**`；为断连重连最小触及 `packages/console/src/voice/useVoiceChannel.ts`  
并行切割: 未动 `packages/daemon` / `cli` / `contracts` / `apps/android` / `apps/harmonyos`；历史回放/记忆列表未实现

## 五件对账

| # | 需求 | 状态 | 证据 |
|---|---|---|---|
| 1 | 发送反馈环：导航 M-Chat + 乐观上屏 + AI 实时追加 | 完成 | `MobileApp.queueText` 成功后 `ensureMobileChatRoute` → `#/m/chat`；`voice.sendText` 既有乐观 transcript；`ChatPage` 消费 `transcript/spoken/thinking`；`pendingUserText` 灰显至对账清除 |
| 2 | 移动字阶系统 | 完成 | `mobile.css` CSS 变量：20/17/15/13/16/12/11；卡片主问题 `17/700` + `line-height:1.65`；chip 最小 11，窄屏不再降到 9 |
| 3 | 确认卡「做」副文字 | 完成 | `confirmAcceptSubtext`：>12 字 →「按建议」；否则短摘要；不要/撤销固定短语；主问题只在 h1 |
| 4 | 断连重连 | 完成（见偏差） | 退避 cap 30s 次数不封顶（`nextWsReconnectDelayMs`）；visibility 非 OPEN 立即重连；dstat/菜单「重连」；iOS `scenePhase.active` → `saydo:native-resume` |
| 5 | toast 内容化 | 完成 | `sentToast`/`confirmSettlementToast`/`sendFailedToast`；拍板去向只消费 `focusTitle/needs/sourceKind`，无字段则「已确认·已记账」，不造「记入记忆」 |

## 门禁

- `pnpm --filter @saydo/console test`：**118 passed**
- `pnpm --filter @saydo/console typecheck`：**通过**
- `pnpm --filter @saydo/console build`：**通过**（vite production）
- `scripts/check-emoji.sh` 对本 diff：**[ok]**
- iOS 模拟器构建：**未绿** — 本机 Xcode 27.0 (27A5194q) 报 `SwiftUIMacros.StateMacro` / `swift-plugin-server produced malformed response`，连既有 `@State` 文件一并失败，属工具链宏插件异常，非本次 WebContainer/RootView 语法错误。源码改动为 `resumeToken` + `notifyNativeResume` 注入事件。

## 偏差与张力

1. **路径切割**: 任务写「只动 mobile + ios」，但 WS 指数退避/立即重连只能落在共享 `useVoiceChannel`；已做最小补丁并导出 `reconnect`。daemon/cli/contracts/android/harmonyos 未动。
2. **docs/11 §5.6 与真机反馈**: canonical 仍写「做」副文字逐字 `prompt_text`；本批按真机反馈改为短语（主问题已在 h1，避免重复撑破按钮）。canonical 回写需另批一致性评审，本批未改 `docs/`。
3. **乐观灰显窗口**: `sendText` 在 WS OPEN 时同步写入 transcript，pending 灰显窗口极短；语义上「ws 已发出」即实心。转写中气泡仍走 `transcribing` 灰显。
4. **拍板去向**: attention 无独立 destination 字段；有 `focusTitle` 时「已确认·归入「…」」，否则「已确认·已记账」，绝不编造记忆落点。

## A 级检查（本批）

- [x] 无 daemon 新端点/占位
- [x] 无 contracts 分叉
- [x] 发送失败保留草稿语义（toast + 不清成功路径外 draft）
- [x] 零 emoji
- [x] 确认卡副文字 ≤12 字红线

## 结论

前端五件可合入本分支；iOS 模拟器构建需本机 Xcode 宏插件恢复后复跑自证。建议后续：canonical 11 与确认卡副文字对齐；owner 真机回归发送环与回前台重连。
