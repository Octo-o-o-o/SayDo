# 场次①项目归属回修终审

你是发布前对抗性评审者。只读检查当前未提交工作树，不修改任何文件，不 commit、不部署。

背景：

- 审计 36 在 `research/codex-findings/36-session1-project-anchor-final-review.md` 判定 A=2、
  B=3、C=3。
- 本轮已按 canonical-first 回修路径否定/比较/任务载荷、归属三态、同义问句、唯一
  pipeline owner、pipeline 重连 worker、post-commit logger 和 name-only 单 span。
- 场次①仍是失败状态；当前运行环境尚未部署本轮代码。

请重点核验：

1. `docs/09-data-contracts.md`、`docs/10-voice-ux-spec.md` 与实现是否一致。
2. 否定路径、比较路径、多路径、路径任务载荷能否在分类器和
   `proposeProjectAnchor` handler 两层 fail-closed；合法纯路径及“路径是”元数据是否仍可用。
3. `unasked_draft / asked_unresolved / anchored` 是否贯穿 Brain 指令、daemon 预路由、
   输出闸、`resolveProject` 和 `proposeProjectAnchor`；`projectRevision>0` 是否完全退出归属链。
4. 同义归属问句是否只能落成 daemon 锁定句，最多一次是否仍由 durable 状态保证。
5. `currentPipelinePeer` 是否覆盖 OPEN、CLOSING、close 事件、JSON、二进制、health、
   broadcast；旧 peer 是否仍可能污染 `/readyz`。
6. Python 断线清理是否取消并等待所有捕获旧 websocket 的 TTS/ASR/EOU 任务；新连接
   消息是否可能被旧 worker 消费。
7. durable accept 后任何投递、重建、TTS、audit、logger 异常是否都不会反转提交事实或
  进入“这轮没改”错误域。
8. 测试是否真覆盖上述反例，是否存在“测试绿但生产 composition 未接线”的窗口。

输出要求：

- 先给“可进入完整 CI / 仍需阻断”结论。
- 按 A（安全、契约、数据丢失）、B（发布可靠性）、C（增强）分级。
- 每条发现给出文件和行号、可复现路径、最小修复建议。
- 明确列出审计 36 每项是否关闭。
- 运行你认为必要的只读检查；命令失败必须原样说明，不能把未启动测试写成通过。
