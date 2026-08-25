# SayDo M1 移动 Web 对抗性评审

你是独立对抗审查者。只读评审当前工作区未提交改动，不要修改任何文件。

基线是 `main` HEAD `415df2a86a5208c1f68672bab0c75618f3070594`，任务是 console M1 移动 Web。规格正本为：

1. `~/WorkSpace/OctoAgent/docs/product/2026-08-11-SayDo移动端完整方案-v1.md` 的 v3.2。
2. 同文件 v3.3，冲突时 v3.3 优先。
3. 视觉参照 `~/WorkSpace/OctoAgent/docs/product/2026-08-11-mobile-demo-final-v3.html`，但 v3.3 明示降级的数据不得伪造。

必审范围：

- daemon 只允许四项：`SAYDO_MOBILE_LAN=1` 的私网 Host/Origin/token 与最小路由面；`confirm.decision` 的 `receiptId+sessionId` 定向及 `withdraw`；attention `expiresAt`；`/api/focuses` 四状态单 SQL 聚合。找所有越界、fail-open、身份混淆、跨 session 误裁、重复执行、误导回执。
- console 的 `VoiceProvider/SetupProvider` 必须在分树外，窄屏实时切移动树，宽屏 `#/m/*` 重定向，不重建 WS。桌面现有源码除 `App.tsx` 入口不得改。
- 七页、M-Menu、CardResolver `live/resolved/expired/stale/missing` 五态与动作权限、dstat `connecting/online/offline` 与离线禁发、M-Confirm 三段式 durable 倒计时、精确文案、M-Chat first-run 既有端点、移动 Today 与桌面 `/api/attention` 同源。
- `.m-root` 样式完全隔离，不得泄漏泛选择器或复制 demo 中超出 M1 的假交互。
- 测试是否真能证明验收项，特别是进程级 LAN 开关、跨 session 裁决、视口切换 Provider 不卸载、first-run、同源。
- 对照 `docs/09-data-contracts.md`、`docs/11-ui-spec.md`与实现，找 canonical 分叉。检查零 emoji、状态词纪律与敏感信息。

输出 Markdown 报告，先给 `Go` / `Conditional Go` / `No-Go`。只报有代码证据的发现，按 A（必修：安全/契约/数据丢失/验收不成立）、B（应修）、C（建议）分级；每条必须给出 `file:line`、反例、规格依据和最小修法。若某级无发现，明确写零。不要用重复大段规格充字数。
