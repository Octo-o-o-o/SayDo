# SayDo 场次①项目归属闭环对抗审计 32

请在只读模式审查 `~/WorkSpace/SayDo` 当前未提交工作树。禁止修改文件，禁止
启动 subagent，禁止 commit、push、deploy、restart 或写生产数据。报告写在最终回答中，只列
有代码或测试证据的 A/B/C 级问题；没有阻断则明确写 `A=0`。

背景：2026-07-30 owner 真人场次①中，Brain 在用户先说 OctoBlog、再明确输入
`~/WorkSpace/OctoBlog` 后仍第三次重复“新事情，还是接着哪个项目继续？”。生产库只有
pending draft，OctoBlog 目录存在但未登记；旧生产代码只有无人调用的 `reanchorDraft`，
没有能消费该答案的 live 工具。当前 diff 目标是修复这个闭环，不部署。

请重点对抗下列不变量：

1. canonical 文档与实现是否一致：仅当前 heard user turn 的唯一路径能签发候选；Brain 不传
   path；name-only 不构成改锚授权；未登记目录保持 draft，登记不受执行
   `enabled_project_types` 限制；`pending → 非 pending` 后 type 不可再改。
2. 路径安全与唯一性：quoted/unquoted 解析、`~/`、NFC、realpath+lstat、home 边界、
   `.saydo`/archive 拒绝、exact/ancestor/descendant 冲突；v14 存量回填失败必须回滚；
   `BEGIN IMMEDIATE` 后重验 filesystem identity 与数据库冲突，不能有 TOCTOU/双登记。
3. 授权与隐私：ConfirmationLoop 候选是否绑定 session/draft/turn/revision/expiry；accept 前
   零项目写入；reject/barge-in/unmatched/旧 revision/重复 accept 均零写入；完整路径与
   basename/title 不得进入 TTS、audit meta、WS 事件或 tool result。
4. 状态收敛：accept 是否原子更新 project/session、递增 revision、清空旧 Context Pack、
   写 immutable audit + durable event；post-commit readiness/Pack 失败是否使下一 Brain/tool
   fail-closed；reconnect 是否回放权威 event；console 是否按 revision 去重、刷新 overview、
   更新 anchor 并导航。
5. 主路径是否真能工作：Brain instructions/tool manifest 是否足以在当前轮含明确路径时调用
   `proposeProjectAnchor`，确认答复是否被 daemon 消费而不再送 Brain；现有工具/确认类型是否
   被意外串线。
6. 测试是否覆盖主路径及关键反例，是否有因 mock/固定时钟/错误调用方式导致假绿。

本轮已有真实门禁证据：

- `pnpm lint` exit 0。
- contracts/daemon/console typecheck exit 0。
- `pnpm test` exit 0：contracts 73 passed；daemon 709 passed / 4 skipped。
- 定向 8 files 73 tests passed。
- 当前生产 SQLite 的只读 `.backup` 副本经新代码 v13→v14：`version=14,indexed=1,events=0,
  foreign_key_check=0`；现役数据库未改。

请自行读取实际 diff 和相关 canonical/测试，不采信上述自述代替代码证据。不要把“尚未形成
commit、尚未部署、场次①尚未复验”误判成实现 bug；但若实现本身不能安全部署或不能解决重复
追问，应列 A/B。每项给 `file:line`、触发路径和最小修法。
