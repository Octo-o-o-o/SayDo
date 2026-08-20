# 场次①项目归属发布候选终审

请对当前未提交工作树做严格只读、对抗性 code review。不要修改文件，不要启动 subagent，
不要执行会修改仓库或真实 `~/.saydo` 的命令。结论按 A/B/C 分级；没有发现也要明确写 0。

背景：真人场次①中，中文 ASR 良好，`OctoBlog` 被听成 `Oct block`；Brain 首次询问项目归属
合理，但用户随后明确说出 `~/WorkSpace/OctoBlog` 后仍重复同一问题。当前候选试图把
“当前 heard turn 的显式路径 → daemon 核验 → 封闭确认 → 原子归属”做成机械闭环，并修复
上一轮审计 33 的 A=1/B=2/C=1。

重点核查：

1. 实际 `SAYDO_HOME` 是否是单一可信根：词法位置、父目录 symlink、首次创建、owner、
   daemon index/backup/pair/launchd install/deploy/logs、daemon plist、pipeline plist、
   pipeline `.env`/`.cap-token`、runtime preflight 是否一致；默认根和自定义根都不能分叉。
2. 通用归属问题是否每个 live session 最多播一次：首次成功 TTS 后是否记录，重建/重启后
   是否恢复，动态 instructions 与输出闸是否一致，重复时是否产生沉默、重复或错误确认。
3. `resolveProject` 是否只读当前仍有效的 heard turn、无 Brain utterance/path 参数、只做
   name-only 引导；是否绝不形成 candidate/presentation/confirmation，后续裸肯定零写入，
   隐私关闭与迟到旧轮是否安全。
4. 显式路径的 `proposeProjectAnchor` 是否仍满足旧轮失效、无 transcript fallback、路径
   词法/realpath/identity/overlap/type immutable、accept 写锁线性化、readiness/Pack revision
   双闸、TTS 成功后才 arm。
5. barge-in replay 是否严格 `prepare → enqueue → arm`；enqueue 返回 false 或 throw 时连续
   裸肯定均零写入；accepted/rejected/to_screen 是否清理 presentation。
6. canonical、实现、测试是否同口径；测试是否真的经过生产同型入口，而非只断言 fake 自己
   返回的目标结果。

允许运行只读验证：`git diff --check`、typecheck、现有测试。若 sandbox 不允许测试创建临时
文件，请明确说明，不要把未运行写成通过。最后给出是否可形成发布前 commit 的明确建议；
commit、deploy、真人复验不属于本次静态审计。
