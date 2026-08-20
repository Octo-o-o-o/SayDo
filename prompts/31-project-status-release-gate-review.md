# SayDo 发布前回修终审 31

请在只读模式审查 `/Users/wangyixiao/WorkSpace/SayDo` 当前工作树。禁止修改文件，禁止启动
subagent，禁止 commit、push、deploy、restart 或写生产数据。只报告仍然存在的 A/B 级问题；
没有则明确写 `A=0, B=0, Go`。

这是 Codex 30 后的窄复核，重点验证下列回修是否真实闭合且没有引入新阻断：

1. `runSnapshotBackup` 是否在发布 completed manifest 前，对 SQLite、global sessions、active
   project foundation/knowledge、四份知识文档、generation 和 session JSONL 双向映射
   fail-closed；`isSnapshotBackupDue` 是否复用同一语义并拒 manifest 外 extras。
2. `scripts/verify-snapshot.mjs` 与 `scripts/dry-run-restore-snapshot.mjs` 是否形成一致的严格
   恢复证明；dry-run 的数据库 workspace path 必须指隔离根，并调用真实
   `FoundationBuilder`/`knowledge/current/core.md` 消费路径。
3. pipeline 启动是否真实探活 ASR/TTS，运行调用失败是否降级 health，`/readyz` 是否不会只因
   provider 对象存在而假绿；release config digest 是否覆盖 `.env`、project_settings 与实际
   project.toml，且不打印秘密。
4. deploy 是否先在独立 release 树 install/build/clean，再切 runtime；pipeline plist 改写后
   是否 bootout+bootstrap 重载，最终成功只在双方同 SHA readyz 后输出。
5. 场次③是否承载 OctoBlog 首篇 writing 独立 pass，场次④是否机械绑定；四场 evidence
   origin、同 SHA/config，以及 tag 后纯 `chore(evidence)` 持久化流程是否自洽。
6. 阶段判断是否仍诚实：runtime 是旧 `838aeea`，当前回修未 commit/deploy，四场 not_run，
   无 `v0.1.0`。最终派生清单、journal 和完整 `just ci` 会在本报告落盘后刷新，暂不把这三项
   程序性收尾判为 A/B，除非其设计本身无法闭合。

所有事实请给 `file:line` 或真实命令输出。不要把只读沙箱无法写 cache/tmp 误判成代码失败。
