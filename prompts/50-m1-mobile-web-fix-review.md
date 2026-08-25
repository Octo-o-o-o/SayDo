# SayDo M1 移动 Web 回修终审

你是独立对抗审查者。只读复核当前工作区未提交改动，不要修改任何文件。

基线为 `main` HEAD `415df2a86a5208c1f68672bab0c75618f3070594`。任务规格仍以
`~/WorkSpace/OctoAgent/docs/product/2026-08-11-SayDo移动端完整方案-v1.md`
的 v3.2、v3.3（冲突以后者为准）为正本，canonical 为本仓 `docs/09-data-contracts.md`、
`docs/11-ui-spec.md`。前轮报告是
`research/codex-findings/49-m1-mobile-web-review.md`，判为 6A/8B No-Go；实现已逐项回修。

请优先逐条验证 49 号 A-1 至 A-6、B-1 至 B-8 是否真实关闭，同时寻找回修引入的新问题：

- `mobile_lan` 必须只开放 RFC1918 IPv4 Host + 同 Host Origin + token 的 M1 最小 HTTP/WS 面；
  recovery-only 不随该开关暴露；移动 WS 不得控制音频、pipeline 或旧确认入口。
- `confirm.decision` 必须显式 `receiptId+sessionId` 定向；三动作只接受各自精确 outcome；
  `mobile_lan` 不得伪装成 voice 释放 runtime S2；withdraw 只撤 presentation，不制造伪消费。
- attention `expiresAt`、四状态单 SQL 聚合、移动 Focus 最小 DTO、contracts 类型不得分叉。
- Provider 在分树外；桌面/移动 hash 双向切换不重建 WS；CardResolver 五态权限准确；
  dstat 首连失败和再次重连均有界，离线只禁发不丢草稿；first-run 消费既有端点。
- console 桌面既有源码除 `packages/console/src/App.tsx` 入口不得修改；移动 CSS 必须 `.m-root` 隔离。

输出 Markdown，首行给 `Go` / `Conditional Go` / `No-Go`。按 A/B/C 分级，只报有当前代码证据、
可复现反例和规格依据的问题；每条给 `file:line` 和最小修法。没有发现的级别明确写零。
对 49 号每项给 Fixed/仍开放结论；不要把未执行的测试写成已通过。
