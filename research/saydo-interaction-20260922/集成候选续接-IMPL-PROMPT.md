> 2026-09-23 状态更新：本文件为历史交接，不再直接执行。DAILY/JOURNEY已本地合并收口；当前基线与下一批建议以同目录 `方案.md` 第0章为准。旧active阻塞、旧额度与旧候选不能用于新批。

请继续本任务「评估并实施 SayDo 关键改进」，沿用现有 supervised-delivery 任务，不新开预算账本，不从 DAILY-01 旧候选重新实施。

我明确授权：在现有累计计数基础上，追加最多 8 次修复和 8 次独立复审。这是上限，不要求用满；达到完整验收即停止修复。授权原文为「确认追加最多8次修复＋8 次独立复审」。本次不扩大同一根因的修复次数上限，不更换在途模型/角色配置，不重置旧 RED、程序重试或已消耗次数。

工作坐标：
- 唯一续接任务：~/.codex/tasks/saydo-journey01-acceptance-20260920/task.json
- 实施候选：~/WorkSpace/SayDo-journey01-integ
- 原 DAILY 来源：~/WorkSpace/SayDo-daily01，只读保留。
- 主仓：~/WorkSpace/SayDo，施工期间只读。
- 必读任务文件：同任务目录的 acceptance.md、ACCEPTANCE-STATUS.md、review-5.md、已冻结 policy 和历次修复/评审事件；读候选 AGENTS.md、docs/README.md 及所涉 canonical。
- 补充核查：~/.codex/worktrees/saydo-research-20260922/research/saydo-interaction-20260922/K0-续接核查.md。

2026-09-22 最新核验：active_call=null；累计4次修复、4次复审；两项总上限当前均为4。候选 HEAD=25d96595cde150428b6840e450e15f11d50f021f，git-diff-v1=1c99dfb8e21e04ef0103952bd3943b7f37f0a739615e597495a2a4c17c3810cb。先重新核实这些状态及唯一 supervisor 所有权；若没有漂移，写入下一份 owner-extension-N.json，保留授权原文和 before/after，将两个累计上限从4增加到12。若有漂移，先对账，严禁重复应用本授权或重复启动活调用。当前会话「调研并推进 SayDo 方案」只做过核查和交接，未追加额度、未启动施工。

本轮范围及推进顺序：
1. 继续处理 review-5 两项 P1：HF 显式“说完”没有正确结束语音账项，合法非空 final 未进入 Brain；VAD start→console barge-in 的真实顺序产生 generation 错配，空 final 无法解除 speechPending。
2. 先写能复现真实生产事件顺序的测试，再从录音轮身份、结束与打断归属修复。不得删除世代校验、将所有空 final 放行、加入 sleep 掩盖竞态，或只改测试顺序。覆盖按钮/自然结束、非空/空/失败、重复 done、旧 epoch、并发乱序和取消。
3. 补齐同库浏览器 REST/WS 七步参考旅程。复用已有生产 Executor、真实产物/Git tree/settle proof、验收调用和下一对话记忆消费测试；明确 fixture 与真实模型/CLI 的证据边界。该项有 B4 两次修复历史：不改根因 ID 清零，不把额度追加当作同因上限豁免。先判断改为真实浏览器接线验证是否构成规则允许的新方法；若仍触及硬上限，保留其他可推进工作并提出该根因的具体决定。
4. review-5 的三个 P2继续只在原清单登记，不为扫尾扩大范围；若它们阻断现有验收条目，施工前明确归属并纳入同一候选验证，不能在最终通过后再改代码。
5. 保留 DAILY、main、选定 consolidation 的来源对账。已核 DAILY 58个改动路径在集成候选均存在，但30个字节一致、28个不同，不得将“路径存在”当作全部语义无损证明。
6. 每候选按原任务有效配置派一名 fresh、零上下文、只读 reviewer。实施者与 reviewer 分离；冻结候选并核指纹，保留所有累计事件。语义通过后对当前候选运行 required gates：在候选根目录执行 just ci、pnpm exec playwright test、just precommit，分别记录实际退出码、日志、字节数和SHA-256。长调用使用有界 runner，不重复启动，不在模型层定频轮询。
7. 全部 required 条件满足后，按原任务已存在的本地提交授权执行产品/证据两提交；不新增 merge、push、发布或部署授权，不清空活动批来假装收口。准确报告候选验收、本地提交、主仓集成、远端CI与生产状态。

App Server 原型仍是后续独立批，本轮不混入其代码；待本集成任务真实收口并核清主仓排产后，再返回其 K0 判断。参考原型交接仅作后续资料：~/.codex/worktrees/saydo-research-20260922/research/saydo-interaction-20260922/方案-IMPL-PROMPT.md。

请直接恢复任务并推进，不再询问是否追加上述8+8额度。无需用满轮次；遇到真实范围/权限/同因上限阻塞或追加额度耗尽再停。未运行的真实麦克风、云ASR、多设备、远端CI如实标记，不能用本地全绿代替。最终给出独立结论、门禁、实际提交或未提交状态与剩余事项。
