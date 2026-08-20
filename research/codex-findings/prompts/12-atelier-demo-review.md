# SayDo 控制台 Demo 重设计(Atelier 版)独立评审

你是与生成者独立的资深产品、前端与一致性评审者。请只读审查:

- 新文件:`demo/saydo-console-demo-atelier.html`(本轮新做,重设计)
- 旧文件:`demo/saydo-console-demo.html`(基线,不得修改)
- 信息架构 canonical:`docs/08-module-design.md` §6,以及必要的 `docs/09-data-contracts.md`、`docs/10` 话术口径
- 项目纪律:`AGENTS.md`(文档结构纪律、术语口径、Demo 纪律)

背景:

1. 本轮任务是"参考旧 Demo,用更高级优雅的设计语言重做一个,存新文件,不改老文件"。新版自称 Atelier「墨与纸」:暖纸底 + 黛青单强调色、Fraunces 衬线标题、发丝线无投影、导航衬线编号、stepper 编号节点、双主题。
2. 项目纪律要求:Demo 与 docs/08 §6 信息架构保持同步;Demo 不得夹带文档没有的功能;超出 P0 的元素必须就地标注分期(P0.5/P1/P2)。
3. 你就是项目制度要求的第三路 Codex 评审;根会话已另外完成两名 subagent 评审。不要调用 collaboration、不要 spawn/wait 其他 agent,只用本地只读工具自行核验后直接完成报告。
4. 控制读取范围:重点对比两个 HTML 文件本身(可分段通读),docs/08 §6 用于抽查 IA 一致性。不要读 `research/codex-findings/logs/`、`archive/`。使用不超过 15 轮本地检查后收口。

评审任务:

1. **信息对等核验(最重要)**:逐 section(data-route 共 12 个)对比新旧两版,检查新版是否丢失任何信息点——包括但不限于:验收指引、状态口径、成本口径、五槽位模型配置与异族校验、M0 档案、审批 S0–S3 口径、回叫策略、预算/熔断数字、P0/P0.5/P1/P2 标注、docs/07/08/09/10 引用、Gate 0 说明。新版是否新增了旧版/文档没有的功能或承诺。
2. **功能对等核验**:JS 路由(#/、#/p/:pid/:page)、switchProject 语义、newTalk/closePick/pickMode/s3ok/toggleTheme、id 契约(#psel #crumb #stepper #nav #themebtn #s3mask #pickmask #draftnote #spk #s3done #toast、`*-main`/`*-q3` 占位对、`.step[data-st]`、`.mode`、`nav a[data-nav]`、section[data-route])是否与旧版行为等价;stepMap/crumbMap 映射是否一致;主题 localStorage key 变更是否有副作用。
3. **工程质量**:HTML/CSS/JS 明显错误、无障碍硬伤(对比度、label)、响应式断点合理性、深色主题 token 是否遗漏。
4. **Demo 纪律**:demo-banner 内容是否仍准确(全 Mock、docs/08 §6 v4 2026-07-23、主题切换、分期标注说明);术语口径(M0–M3、S0–S3、ready_for_review、直达验收/逐步确认)是否与 docs/06 一致,有无自造同义词。
5. 按以下格式输出中文报告:
   - 总判:Go / Conditional Go / No-Go;
   - A 级硬伤(必须修);
   - B 级重要优化;
   - C 级可选;
   - 最小回修清单。
6. 每条事实性发现必须给当前文件的 `file:line`,或明确说明是推断。不要编造文件内容。

不要修改任何文件,不要提交,不要联网。最终回答就是独立评审报告正文。
