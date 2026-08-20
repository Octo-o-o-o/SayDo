# Codex 对抗性评审 38：场次①项目归属发布复审

日期：2026-07-31
评审输入：`prompts/38-session1-project-anchor-release-rereview.md`
评审时基线：`1a26b0786a952f8411ed008aa444208d6d6ff945`

## 结论

Codex 对评审快照的收敛结论为仍需阻断：A=0、B=2、C=0。审计 37 的六项关闭矩阵为：
A1 `[closed]`、A2 `[closed]`、B1 `[partial]`、B2 `[partial]`、B3 `[closed]`、
C1 `[closed]`。

本报告记录回修前快照，不代表后续最终发布判定。评审进程在给出收敛结论与完成清单后
未自行退出，主会话等待后发送中断；评审期间未修改文件、未提交、未部署。

## 发现与行动

### B1 归属问句语义闸仍漏同义表达

`isProjectAnchorQuestion` 使用有限短语并把“新”和“续接”线索混在全文内判断，既漏掉
“这是新仓库，还是旧仓库？”和“另建一个代码库，还是用原先那个？”，也会把
“这个新需求会延续现有仓库结构。”一类陈述误判为归属问题。live 层拼接的是已分句并
最多保留六句的口播列表，问题若位于截断范围之后也无法检查到。

行动：canonical-first 定稿为二选一结构两侧分别出现新建与续接语义；补仓库、代码库、
工作区等对象词。对话环另带只在内存流转的 provider 完整原文，live 输出闸在截断、分句
和播放前判定。

### B2 远端先关闭时 `/readyz` 仍读陈旧健康态

VoiceHub 已在 daemon 主动关闭、socket error、terminate 和最终 close 时清 runtime state，
消息路径也拒绝非 `OPEN` owner；但远端先发 close frame 时，`ws.readyState` 已进入
`CLOSING`，`onPipelineLeft` 尚未触发，`pipelineRuntimeState` 仍可能保持健康，导致
`/readyz` 短暂返回成功。

行动：保留 owner 席位到最终 close，同时让 `/readyz` 每次读取 VoiceHub 当前 transport
可用性；非 `OPEN` 时以 `connected=false`、ASR/TTS down 覆盖陈旧快照后再做身份判定。

## 评审运行证据

- 日志：`logs/38-session1-project-anchor-release-rereview.log`
- 行数：137
- 字节数：807805
- SHA-256：`98c19d408eced012320a2358570bd3b554b65cc71c7d8b643bc9e39678047d1c`
- 通过：`pnpm typecheck`、`pnpm lint`、`git diff --check`、
  `bash -n scripts/runtime-preflight.sh`，以及只读沙箱可执行的 Python 聚焦测试。
- 环境限制：Vitest 与组合 pytest 的部分运行因只读沙箱无法创建临时文件而未计通过；
  主会话须在可写环境重跑。
