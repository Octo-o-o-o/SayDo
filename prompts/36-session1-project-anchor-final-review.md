你是 SayDo 场次①项目归属返工的最终发布前对抗审查员。只读审查当前未提交工作树，不修改
文件。

上一轮审计 35 原判 A=4/B=3/C=1，报告在
`research/codex-findings/35-session1-project-anchor-postfix-review.md`。本轮声称已逐项修复：

1. daemon 单源 `classifyProjectAnchorTurn` 严格分类 explicit_path/name_only/other；显式路径
   与纯项目名在 Brain 前机械预路由；未归属 draft 的 other 首轮由 daemon 签发锁定归属
   问句。否定、需求载荷、项目名子串、多匹配均 fail-closed。
2. durable accept 只在提交前错误域允许说“这轮没改”；提交后的成功口播、delivery、
   rebuild、audit、warn 全部 best-effort，不反转提交事实。
3. VoiceHub `broadcast` 返回 `{attempted,succeeded,failed}`；`sendTtsSay` 至少一个真实
   pipeline 同步 enqueue 成功才返回 true，成本钩子与 console mirror 不反转结果；
   `sendSessionProject` 的真实投递统计进入 post-commit degraded 域。
4. unquoted 路径内及末尾 ASCII 撇号不再截短。
5. 同时只允许一个 pipeline peer；第二个拒绝，替换入场清空旧 health；
   `injectPipelineMsg` 禁止 `pipeline.health`。

请重点验证：

- 分类器是否仍有否定、比较、前后缀、附带任务语义或多项目匹配的误放；直接预路由是否会
  把已经锚定的 revision>0 会话重新问成“新事情/哪个项目”，或破坏旧轮失效/隐私语义。
- TTS 的“同步 enqueue 成功”统计是否真的覆盖 send 竞态；首次确认 arm、barge-in replay、
  通用问句 durable 状态是否仍会因假成功/真成功后钩子异常而出错。
- durable accept 后是否还有 logger、audit、TTS、UI 投递或重建异常能逃到“这轮没改”；
  production composition 是否真实消费 `session.project` 投递统计。
- pipeline 唯一性、旧 peer 关闭/新 peer 入场顺序、health 来源与 `/readyz` 全局状态是否仍有
  陈旧绿或注入伪造窗口。
- canonical、审计 35、场次档案和测试是否与实现一致；测试是否只 mock 而未覆盖生产同型链。

请执行安全只读检查和可运行门禁。按 A/B/C 分级给精确 file:line、可复现链和最小修复；
明确命令真实通过/未运行。最后只回答：可以进入完整 `just ci` 与发布前 commit 准备，还是
仍需阻断。
