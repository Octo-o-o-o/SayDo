# SayDo M1 移动 Web 最终对抗审

只读审查当前未提交工作树，不要修改文件。基线为
`415df2a86a5208c1f68672bab0c75618f3070594`。规格正本仍是
`/Users/wangyixiao/WorkSpace/OctoAgent/docs/product/2026-08-11-SayDo移动端完整方案-v1.md`
v3.2/v3.3（冲突以后者为准），canonical 为本仓 docs/09 与 docs/11。

前轮 `research/codex-findings/50-m1-mobile-web-fix-review.md` 判 4A/3B No-Go；本轮只需：

1. 逐条验证 50 号 A-1 至 A-4、B-1 至 B-3 是否关闭，并检查回修副作用。
2. 特别构造反例核对：远端 socket 伪报 localhost/tailnet Host；浏览器同源 GET 无 Origin；
   跨站/缺 Referer；mobile_lan 文本在 daemon session 账本接受前断线；错误/跨 session
   `turn.accepted`；runtime withdraw 后 presentation/receipt/gate；无 Focus 目标回执动作。
   另核对 daemon 已落账但 `turn.accepted` 丢失时，同文重试是否沿用原 `turnId`、只重放回执而不重复进入 Brain，同 ID 异文是否拒绝。
3. 核查 Attention/Focus/outcome contracts 是否由 daemon 与 mobile console 同一 schema/type 承载，
   移动 Focus DTO 是否仍最小化，`turn.accepted` 是否仅在 durable user turn 接受后定向发出。
4. 核查 daemon 改动仍落在 v3.3 四项白名单；console 既有桌面源码除 App.tsx 接线外零 diff，
   Provider 分树与 `.m-root` 隔离不退化。
5. 审核测试证明力：真实 RFC1918 进程与 Chromium GET、Host 伪装、账本 ack、first-run 真实端点、
   双向视口、重连、withdraw 二次裁决。不要把未实际运行的测试写成通过。

输出 Markdown，首行 `Go` / `Conditional Go` / `No-Go`；A/B/C 分级，每条必须有当前
`file:line`、可复现反例、规格依据和最小修法。没有发现的级别明确写零。最后用表格给 50 号
7 项 Fixed/仍开放结论，并写明本轮实际运行的命令边界。
