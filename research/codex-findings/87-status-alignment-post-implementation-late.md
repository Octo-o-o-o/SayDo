# 87 · 状态对齐首次收口后的迟到复核回收

> 日期：2026-08-21
> 性质：两路只读复核在首次收口后返回；先按当前工作树重放，再裁决是否需要追加回修。

## 1. 仍成立的新发现

### A · 语音审批边界被错误收窄

Docs 成品页、源稿与原实施 prompt 写成「LAN 与语音不放行审批」。这与 canonical 冲突：

- `docs/09-data-contracts.md` §3：`voice` + `voice_weak` 允许风险 ≤ S2；
- `docs/10-voice-ux-spec.md` §2.5：S2 语音确认使用封闭肯定词表，未匹配默认拒绝；
- S3 才是语音绝不放行，只走本机认证屏幕。

终裁口径：LAN 手机面不裁 S2/S3；语音确认封顶 S2；tailnet 配对屏幕面在支持后封顶 S2；S3 只走本机认证屏幕。

### B · LLM 深研状态分叉

Docs 同时出现「进行中的下一档」与「规划中（方案在拟）」。packages 与 PLAN-2 均无 LLM 深研实施命中，当前只有确定性奠基机械管道。统一为「规划中」，并纠正把当前奠基称为「阻塞式深度研究」的词条。

### B · 备份事实缺来源分级

场次① `failed` 有仓内 `session-1.md` 一等证据；备份连续失败则来自本机 `~/.saydo/logs` 与 `~/.saydo/backups` 现场取证，仓内没有可复跑原始日志。HANDOFF 必须显式区分。

## 2. 已由首次回修关闭的重复发现

- Docs「无云端依赖」绝对句；
- 隐私页「音频仅设备端 / never uploaded」；
- tailnet 对当前 HEAD 过满；
- PLAN-2 Claude SDK / live steer / 历史 HEAD；
- prompt 文本状态标记规则；
- evidence 后验 Playwright provenance。

## 3. 无需动作的通知

- 86 报告与 IMPL-PROMPT-11 的恢复任务只确认文件已找回，当前文件仍在；
- 旧 Codex 任务成功通知对应已落盘报告；
- 静态预览服务器的 aborted 状态来自调度方主动清理，不是产品或验证失败。
