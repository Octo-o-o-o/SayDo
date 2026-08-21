# 87 · 状态对齐批实施后对抗复核 Prompt

你是 SayDo 状态对齐批的独立只读评审员。你的目标是证伪实施结果，而不是复述实施报告。

## 坐标与范围

- 仓库：`/Users/wangyixiao/WorkSpace/SayDo`
- 分支：`chore/status-alignment-20260821`
- HEAD：`088b8f0cc176bc2be9cf09235a640301dd35cb55`
- 当前工作树未提交、未推送、未部署。
- 开批前改动已暂存；Grok 本批增量主要显示在 `git diff`，最终整体显示在 `git diff HEAD`。不得把暂存基线误当成本批新改动，也不得忽略最终页面的整体语义。

## 必读

1. `AGENTS.md`
2. `research/codex-findings/86-status-alignment-triage.md`
3. `docs/plan/IMPL-PROMPT-11-STATUS-ALIGNMENT.md`
4. `e2e/evidence/status-alignment-20260821.md`
5. 本批允许修改的中英官网、源稿、`HANDOFF.md`、`docs/plan/IMPLEMENTATION-PLAN-2.md` 与两个 emoji prompt。
6. 为核验事实可读四份 86 原始报告、owner session、W5.4-a evidence、workflow、package.json 与相关源码，但不要扩成新一轮全仓战略审计。

## 评审问题

逐项回答并给出路径与行号：

1. Grok 是否完整执行 IMPL-PROMPT-11，是否有漏项、越界修改、误改或中英文语义分叉。
2. 对外文案是否仍有会让普通访客误解的过度承诺，重点检查：
   - Windows / Linux 与三端 App 状态；
   - 开发者自营后台、第三方 AI / 云端语音 / 推送的数据路径；
   - LAN、用户自行配置的加密组网、S2 与 S3 权限边界；
   - Claude Code、实时字幕、Silero VAD 的完成度；
   - 法律页日期及“不运营任何服务器”、Keychain / Keystore 保留项。
3. 成品页与两份源稿是否会在下次生成时复活旧口径。
4. `HANDOFF.md` 与 `IMPLEMENTATION-PLAN-2.md` 是否正确区分活动树 HEAD、常驻 runtime、release config、场次状态、Claude、Actions、Tailscale、T19 前置门与备份故障；不得把 HEAD 能力写成当前常驻已启用。
5. evidence 是否与真实 diff、真实命令结果和未做清单一致；若浏览器核验在 Grok 会话后由调度方补做，应建议按来源追加，不得倒写成 Grok 已完成。
6. 本批是否触碰红线：canonical、workflow、运行时代码、live 配置、TTS、commit、push、deploy。
7. 是否存在 A 级问题（安全、法律事实、数据路径、重大虚假承诺、证据造假）或 B 级问题（状态/双语/档案明显失真）。只报告可复现问题；纯文风建议列 C 级且不阻塞。

## 已有后验验证事实

调度方在 Grok 结束后用独立 Playwright MCP 对本地静态站做了浏览器复核：

- 桌面视口 1442×867：中英首页与中英文档页；
- 手机视口 390×844：中英首页、文档、隐私、条款、支持，共 10 页；
- 结果：无横向溢出、无 `naturalWidth=0` 图片、整轮控制台 0 error / 0 warning；
- 隐私页中英日期、第三方例外、不运营服务器、Keychain / Keystore 锚均存在；
- 中英首页平台状态与中英文档 S2 / S3、Claude、Silero 锚存在。

请把这当成“调度方后验验证”，不是 Grok 会话自身证据；仍可从代码与内容证伪。

## 输出格式

只输出一份简体中文 Markdown 报告，并写入
`research/codex-findings/87-status-alignment-post-implementation-codex.md`；只允许写这一个文件：

1. 总评：`PASS`、`PASS_WITH_CONCERNS` 或 `FAIL`
2. A / B / C 发现，按严重度排序；每条含证据、影响、最小修法
3. IMPL-PROMPT-11 逐节覆盖结论
4. evidence 可信度与浏览器后验验证应如何记录
5. 保持不动项
6. 最终是否可进入 owner 验收

不要修改任何文件，不要 commit、push、deploy，不要运行 live 配置命令，不要再启动 nested Codex / Claude / subagent。
