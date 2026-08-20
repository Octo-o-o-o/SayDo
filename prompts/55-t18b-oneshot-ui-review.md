# T18b oneshot 与三形态 UI 对抗性评审

你是 SayDo T18b 终批的对抗性只读评审者。仓库
`/Users/wangyixiao/WorkSpace/SayDo`，基线 `main` 的 `9a6e767`，当前分支
`feat/t18b-oneshot-ui`；候选改动尚未提交。

规格正本是
`/Users/wangyixiao/WorkSpace/OctoAgent/docs/product/2026-08-09-onboarding方案-v1.md`
的 v11 与 v11.1，尤其 A6/B1/B3/B4/B5/B6；任务还要求 L26 重启后保留
`/chat-new` 导航意图，以及 voice probe 失败时禁用「点击说话」并给固定人话。先完整阅读
规格、仓库 `AGENTS.md`、`git diff 9a6e767`、`docs/07`、`docs/09`、`docs/10`、
`docs/11` 与相关测试。不要修改任何文件，不要启动 subagent，不要运行会写仓库的命令。

逐项寻找可复现反例：

1. canonical 是否把全局 dialog CLI=oneshot、项目 override 恒拒、精确 allowlist、上限、单
   pending、await_user 停、失败丢 reply、零应用才可重试、B4 cap 与 self-test 晋升门写成单一真相。
2. 生产运行时是否按严格 `{version:1,reply,actions:[{id,tool,arguments}]}` 校验并依序 dispatch；
   执行/授权/删除/会话/文件/屏幕工具是否可能进入；可选参数的 strict JSON Schema null 往返是否
   会改变工具合同；部分 action 已应用后是否可能重跑或继续；真实 pending 是否都返回 await_user。
3. BYOA 的 schema/硬禁令/逐调用空 cwd/identity/tripwire/网络与 schema 重试是否共享全调用唯一
   预算；任何分支是否可能第三发；输入是否按历史→Context Pack 截断且保住 instructions、当前轮
   与 action manifest；错误话术、模型 reply、日志/审计是否泄敏或伪成功。
4. dialog CLI binding 是否由现有 ModelBinding 天然投影 oneshot；resolver、probe、setup 自检、
   pending activation receipt、正常与 recovery-only restart/boot 晋升是否一致 fail-closed；project
   override 是否仍恒拒。无 pipeline 的纯文本用户是否仍能看到回复、收到确认卡并裁决。
5. 三形态卡是否严格按 found+logged_in 生成；每家 CLI 一张、排序已登录>用过>装了且确定、最多
   三张；cursor 取首个非 auto、codex/claude 用默认；全 CLI 双 ack 不代签；self-test 全绿前不
   激活，失败有 key 时确定性切混合卡，无 key 如实停；多 CLI 占满三卡时降级是否仍存在。
6. 基础一键卡是否置顶、三列呈现，高级逐槽是否保留；“接入开发中”是否从实际 UI 撤除；卡面
   代价和 oneshot 15-25 秒是否准确。L26 是否在 restart 前保存 hash，失败/重载是否有错误导航。
7. Chat 是否只用现有 turn/thinking 状态显示按秒进度而不伪造 assistant；voice key 缺失、ASR down
   或 pipeline peer 离线时按钮与模式切换是否动作前禁用，固定文案逐字一致且文本输入仍可用。
8. fake CLI 与 UI 测试是否覆盖用户要求的全部反例；真实 smoke 是否真的调用 Codex 并验证
   `remember` action，而非只验证手写 JSON。检查类型、lint、竞态、数据丢失与越界改动。

按 A（安全/合同/数据丢失/错误激活，必修）、B（重要）、C（建议）分级。每项必须给当前
`file:line`、具体反例/影响和最小修法；没有则明确写“无”。最终输出 Go/No-Go、A/B/C 数量、
OPEN QUESTION、逐项裁决和你实际执行的只读验证边界。不要把沙箱/网络失败写成代码失败或测试通过。
