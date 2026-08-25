# SayDo 场次①项目归属闭环最终对抗审计 33

请在只读模式审查 `~/WorkSpace/SayDo` 当前未提交工作树。禁止修改文件，禁止
启动 subagent，禁止 commit、push、deploy、restart 或写生产数据。报告写在最终回答中，只列
有代码或测试证据的 A/B/C 级问题；没有阻断则明确写 `A=0`。

背景：owner 真人场次①里，首次询问项目归属合理；用户明确输入
`~/WorkSpace/OctoBlog` 后仍重复询问不合理。英文 `OctoBlog` 被 ASR 识别成 `Oct block`
是体验观察，但不应成为项目归属身份源。当前 diff 用本地路径候选 + daemon 确认环闭合归属，
尚未 commit、deploy 或重跑真人场次。

上一轮审计 32 的 A/B 已回修，请重点验证修法本身而非复述旧报告：

1. 迟到旧轮：项目归属与 readiness 候选是否只认仍有效的进程内当前 heard turn；新轮先到后
   旧工具调用是否 fail-closed，是否仍可能从持久化 TranscriptTurn 回捞。
2. 重播授权：barge-in/unmatched 后是否保持 invalidated，只有在线 TTS enqueue 成功才
   arm；false/throw 后的后续裸肯定是否仍零写入；accepted/rejected/to_screen 是否清理
   presentation。
3. 路径词法与安全：普通闭合引号 + 路径能否工作，`file://`、未闭合路径引号、`~user/`、
   多路径、越界、状态根、冷档、symlink/identity、exact/父子冲突是否 fail-closed。
4. accept 线性化：`BEGIN IMMEDIATE` 后两分支是否都重验 identity/exact/ancestor/descendant；
   adopt 是否重验 type，SQL CAS 是否检查 changes；新库和 v15 是否都保证非 pending type
   不可变。
5. 根信任：实际 `SAYDO_HOME` 是否单源；daemon、backup、launchd install/deploy/logs、
   pair 等生产入口是否在敏感读写前验证；测试是否使用临时状态根；fixture 是否符合 managed
   workspace 合同。
6. UX 主路径：无路径新会话是否只问一次归属；name-only 是否只引导本地路径且不形成假确认；
   明确路径是否只播一次机械确认并 `await_user`；accept 后下一普通轮是否不再问归属。
7. 测试是否真实覆盖以上竞态和反例，是否存在 mock 假绿或新迁移破坏旧测试语义。

本轮已有真实证据：

- daemon typecheck exit 0。
- 定向 4 files / 56 tests passed。
- daemon 全量 67 files passed、2 skipped；730 tests passed、4 skipped。
- `git diff --check` exit 0。

请自行读取实际代码、canonical、diff 和测试，不采信上述自述代替证据。每项问题给
`file:line`、触发路径与最小修法。尚未 commit/deploy/真人复验不是实现 bug，但必须在结论中
明确发布边界。
