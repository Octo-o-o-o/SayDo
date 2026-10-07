# VOICE-MEASURE-01 / CODEX-AS-SPIKE-01 执行卡

日期:2026-09-23。基线 `595725bad012302ef75ec7ab68c4aaf773f7155a`。本卡是 PLAN-2 的批卡引用,不是第二套排产源。唯一现势仍是 PLAN-2 顶部 schedule-pointer;HANDOFF 指针块只由 `node scripts/schedule-pointer.mjs --render` 生成。

## 顺序与指针

本批已本地收口；现势只读PLAN-2顶部生成指针。后继为CODEX-AS-SPIKE-01,本文件不另维护active/next。

收口证据见[`voice-measure-01.md`](../../e2e/evidence/voice-measure-01.md)。不改旧批额度、历史结论或 legacy 18 行。`Codex-app-server` 保持 `deferred_by_AI_decision_2`。

## 本批做什么

VOICE-MEASURE-01 只修两处局部语义:

1. EOU 判定视图:续接标点(半角逗号、全角逗号、顿号)仍等待;句末终止标点规范化后再判断连接词。判定函数不改 ASR 正文,HF 合并与状态机保持原始文本。
2. TTS 归属:入队时按已有 `s-<turnId>-<数字>` 规则绑定源 turn,合成返回沿该绑定。不读最近 ASR。未知、系统和非标准 ID 不填最近 turn,也不填 `0`。按 turn 去重且有界;reset / reconnect 清理。取消中的句子不发 `tts_first_byte`。

`native.reply` 不是 `tts.say`,不把它的 turnId 当成已有 TTS 字段。

不改 canonical wire。不重写 HF 状态机,不加协议、表或跨时钟减法,不伪造 `vad_end`。

## L5

HF 五段仍 undeterminable。可靠补齐需要候选端点修订和 turn 映射合同,本批明确延期。延期不阻止后面的 App Server 原型,也不报 SLO 或真实麦克风性能通过。

## 下一批不在语音批实现

上一节是 VOICE-MEASURE-01 收口时的边界:当时 CODEX-AS-SPIKE-01 只登记为 next,语音批不写该目录。

## CODEX-AS-SPIKE-01 继续授权(2026-09-23)

owner 消息「确认，请你继续实施」后,该原型进入施工。范围仍是未装配生产的本地 stdio 原型,不改 PG-07 与设计 ADR-005,不改生产 index、后端选择器、BYOA 或 contracts。真实 Agent 实验默认关闭。本卡不记 GREEN,不把 initialize 或 fixture 写成真实模型控制成功。

## 本批 policy 例外

`.octoworkflow/project-profile.md` 里的 `roles_runtime=v2-policy.json` 与 `pinned_policy_revision=2.4.2` 仍是历史通用默认,不改写成全局 v3,也不把缺失的 v2 文件当成现存文件使用。

只对 `VOICE-MEASURE-01` 与现役施工的 `CODEX-AS-SPIKE-01` 适用下列冻结来源。继续授权不改来源、角色或 limits。任务目录里的 `policy.frozen.json` 与 `~/.octoworkflow/policy.json` 字节相同, `roles.override.frozen.json` 与 `~/.octoworkflow/roles.override.json` 字节相同。两份来源彼此不同,下表是各来源自己的 SHA-256:

| 文件 | SHA-256 |
|---|---|
| `~/.octoworkflow/policy.json` | `788c2f591856fdbd3099171edfe973cfa99b64b41c52fafc9b0fc9dc372456f4` |
| `~/.octoworkflow/roles.override.json` | `67cda8dbc8ed84a5bb75af4d22711e5720fe0490f65335d19c37b22fbabe97fa` |

`schema_version=1`,`workflow=v3`。实施角色 Grok `grok-4.7` / `xhigh`;独立只读 review 角色 Codex `gpt-6-astra` / `medium`。limits:`reviewers_per_candidate=1`,`max_repair_rounds=3`,`max_rereview_rounds=3`,`max_same_root_cause_repairs=2`,`max_procedure_retries=2`,`max_same_procedure_cause_retries=1`。不自选模型,不增加预算,不迁移旧任务。

私有 task.json 不进入 Git。

## 验收时不在本卡宣称的门

迭代跑定向 pytest 与 schedule `--check` / `--self-test`。`just ci`、`pnpm exec playwright test`、`just precommit` 由 supervisor 在固定候选执行。外部真实模型、ASR/TTS 与真人设备为 not_run。本卡不记 GREEN。

## 受控原型本地收口（2026-09-23）

owner授权「本地提交、合并与收口」。review-5 GREEN、五项门禁通过,准确范围与代码SHA见`e2e/evidence/codex-as-spike-01.md`。前文施工阶段not_run只描述当时实施者调用,本节记录supervisor最终证据。两次追加授权各1次修复+1次复审,累计修复5、复审4,程序恢复2;原policy与角色快照未改。真实Agent仍not_run,PG-07仍deferred。当前串行批收口,next=PG-02,不自动开工。

## 2026-09-27 审计候选补充

daemon 首播去重此前在第 501 个 turn 整表清空，会使刚登记的 turn 再次计入。当前候选改为仅淘汰最旧项，保留最近 500 个 turn，与 pipeline 的有界去重方向一致。该补充不改写上文历史验收；本批独立复审与完整门禁尚未执行。
