# 88 · Windows 对齐 · 一致性评审(subagent)

评审员:独立 code-reviewer subagent。工作树 `feat/windows-alignment`。只读。
输入:`prompts/88-windows-alignment-consistency-review.md`。

**结论:阻断。A=2 B=4 C=3。** 升「已批准」前须先修两处 09 合同残留。官网 FAQ 本批未翻,符合 ADR;内部「正式面」用词过强,属 B。设计 ADR-003 预留与本 ADR-004 不撞号。

硬规则抽检:本批未见 emoji;未见 Gate 0 bypass;11 §5.4 仍「语音 UI 永不渲染 S3 批准按钮」。

## A · 必修

### A1 · 09 §9 DDL 迁移注记仍把 uid / 非 symlink 写成唯一形态

`docs/09-data-contracts.md` §9 DDL(`projects` 迁移注释)仍写「非 symlink + owner uid」。Windows 写闸若照抄会跳过 SID/reparse。

最小修复:与 §1 同一句,按 OS 投影。

### A2 · 09 §11 门完整性补偿仍只点名 gate.sh / 同 UID

digest 补偿与 §12-10 反例仍只点 `gate.sh`。Windows 改 `gate.mjs` 洗审批不被 cancel。

最小修复:补偿控制覆盖本 OS 正在使用的门脚本;同 UID → 同一 OS 用户身份。

## B · 应修

- B1 03/02/ADR 决策 1「正式执行面」强于决策 4「狗粮面」
- B2 07 D8 仍写 JSON 必用 jq
- B3 09 §3.3 / 10 #20 仍 Touch ID 口吻,与已改 11 分叉
- B4 09 锁定路径仍写死无扩展名 `cursor-agent`

## C · 择要

- C1 03 §9 STT/TTS 速览未按 OS 分行
- C2 11 §12 色值门禁仍 bash
- C3 工程 ADR 与计划接口名不一致

## 专门检查

- FAQ 本批未翻,分层正确;裂口在内部「正式」用词(B1)
- unix-socket 在 §11 已分行;jq 残留在 07 D8;uid 残留在 DDL 与「同 UID」
- 设计 ADR-003 与本 ADR-004 不撞号;工程 ADR-003 同号不同序列
