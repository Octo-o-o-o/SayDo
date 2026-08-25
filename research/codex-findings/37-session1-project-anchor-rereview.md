# Codex 对抗性评审 37：场次①项目归属复审

日期：2026-07-31
评审输入：`prompts/37-session1-project-anchor-rereview.md`
评审时基线：`1a26b0786a952f8411ed008aa444208d6d6ff945`

## 结论

Codex 在 2026-07-31 02:34:12 +0800 冻结的工作树快照上判定仍需阻断：
A=2、B=3、C=1。审计 36 的 8 项中，3 项关闭、4 项部分关闭、1 项未关闭。

本报告记录评审快照，不代表后续回修的最终发布判定。评审期间未修改文件、未提交、未部署。

## 发现与行动

### A1 路径白名单仍可绕过

实现先以有限否定词排除，再对任意以“路径是/路径为”结尾的残余文本放行，导致以下句子
同时绕过分类器和 handler：

```text
把 RSS feed 接上，路径是 ~/WorkSpace/SayDo
无需采用这个目录，路径是 ~/WorkSpace/SayDo
```

行动：删除 denylist 与后缀式提前放行，改为残余文本完整匹配的正向归属 allowlist；
“项目元数据/参考资料/任务描述 + 路径是”不再放行。

### A2 同一 canonical path 多次出现的合同冲突

Canonical 同时存在“只接受唯一路径字面量”和“同一 canonical path 只算一个候选”两种口径，
实现采用前者，导致同一路径重复或兼容链接与真实路径同时出现时被判歧义。

行动：canonical-first 定稿为“恰好一个路径字面量”；重复出现一律 fail-closed，要求用户重说，
不在语义分类前触碰文件系统做去重。

### B1 同义或跨句归属问句绕过

逐句检测无法识别“这是新需求。还是回到之前那个项目？”；词表也未覆盖“新档/老工程”等
同义表达。行动：在播放前对完整模型输出做一次 dialog-act 判定，命中后整体替换为 daemon
锁定句，并补三种归属状态的回归测试。

### B2 `CLOSING` pipeline 的陈旧 health

唯一 pipeline owner 与消息隔离已经接入，但服务端调用 `close()` 后，要等 close 事件才清
runtime state；窗口内 `/readyz` 仍可能返回成功。行动：保留 owner 席位到 close，同时在进入
不可用状态时立即广播 down 并失效 runtime readiness。

### B3 Python 重连仍遗漏 PTT 链与连接状态

`_asr_task` 只保存串行链尾；断线取消链尾时，正在运行的旧 ASR 仍可向旧 websocket 发送。
`_mic_buf`、`_pending_text`、`_active_sid` 也未清空。行动：维护连接级 task set，断线取消并
等待所有 TTS/PTT/EOU/inline ASR 任务，同时清除麦克风、VAD、EOU 与会话状态。

### C1 生产 composition 缺同型测试

生产已经接好 `acceptProjectAnchorWithFollowup -> VoiceHub.sendSessionProject -> rebuild`，
但现有测试分层，不能锁住组合接线。行动：抽出生产投递检查函数，并以真实 VoiceHub peer
覆盖成功与失败统计。

## 评审运行证据

- 日志：`logs/37-session1-project-anchor-rereview.log`
- 行数：257
- 字节数：1422598
- SHA-256：`d261e85aff166aef4e9bfddf700c3424c61aa9586a1101922981ffe59fa273ea`
- 通过：`pnpm typecheck`、`pnpm lint`、ruff、`bash -n scripts/runtime-preflight.sh`、
  `git diff --check`、`pipeline/tests/test_hub_hotwords.py` 9 项。
- 未计通过：Codex 只读沙箱内 Vitest、组合 pytest 与 emoji 门禁因临时目录不可写未完整启动；
  `just ci` 未运行，须由主会话在可写环境重跑。
