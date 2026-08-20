# 0.5 窄闭环 PoC · 手动版 · 结果

- 日期:2026-07-24 · Hopper 锁定副本 `~/.saydo/hopper-dist` @ `bdd1e548`(baseline.2)· fake-runner harness(零 LLM/零网络)
- 复现:`bash run.sh`(证据落 `evidence/`)· 红线⑦:独立临时 vault + 临时 repo + 锁 SHA,无外部副作用
- 性质:以既定裁决(§14 A3/A4/A7 已封闭)验证 Hopper 现状 CLI 支持 bridge 所需闭环;bridge 代码属 P0.5-B,本步只手动遥控走通并采证。

## 全链跑通(命令级)

版本断言 `HEAD == bdd1e548` → `lint`(预检) → `drop` → `scan`(triage) → `run`(fake completed,产真实 `docs/GREETING.md`) → `RunSettled` → `review approve` → `merge` → 顺做 `hopper check`。

## 05 §3 八条红线对照(现状能/不能 + 证据)

| # | 红线 | 现状 | 证据 |
|---|---|---|---|
| ① | 产品语义 = `ready_for_review`,不是"已完成" | 支持 | `RunSettled.final_status=review`;task status=review;merge 前非 done(见⑥ merge 闸门) |
| ② | 不能把一句"好"转成 approve+merge | **现状强制**(正面) | automation `review approve` 被拒:`"automation can only approve gap-free tasks; found: acceptance is needs_human"`;`merge` → `blocked_gates`:`not approved` + `approval has no binding (run/evidence/tree)`。印证 P0.5 必须人工合并交接(ADR-001 / Codex A5:SayDo 不自动 merge) |
| ③ | 回叫必须等 settle barrier | 支持 | `capabilities.settle_event=runtime`;`RunSettled` payload 带 `final_status/evidence_digest/summary_path`,emit 在 artifacts 落盘+投影写回之后(附录 §2.1) |
| ④ | 事件消费重放幂等、处理 gap/损坏行 | 支持(结构) | `events.jsonl` append-only;`status.corrupt_event_lines=0`(现状有损坏行计数器);byte cursor 断点续读 bridge C3 消费属 P0.5-B |
| ⑤ | bridge 重启只回叫一次 | bridge 侧(P0.5) | 现状 `events.jsonl` 可断点续读支撑之;SayDo 侧 dedupe 由 callback_outbox 活跃唯一索引保证(0.3 已建表/DDL 反例绿),C4 逻辑 4.4 |
| ⑥ | verify 失败报"闸门阻断"而非"完成" | 支持 | `hopper check` `verification.status ∈ {passed,failed}`;`merge` 明确列 `blockers[]`;fake spec verification 失败 → 投影 failed(附录 §2.3) |
| ⑦ | PoC 禁止外部副作用 | 满足 | 独立临时 vault + 临时 git repo + fake-runner + 锁 SHA;无网络无真实 agent |
| ⑧ | 全链审计可追 | 支持 | 事件序列 `AcceptanceReviewed → DocsAlignmentChecked → RunSettled`;drop 卡尾 `<!-- saydo:dispatch -->` 注释;review/merge `--origin/--receipt` 透传(audit only,不授信)。SayDo 侧 turnRef↔收据↔任务卡链在 3.4/G5 |

结论:八条中 ①③④⑥⑦⑧ 现状直接支持;② 现状**强制**(automation 无法自批需人工验收的任务,正是我们要的);⑤ 属 bridge 侧,现状事件流可支撑。**无一条现状阻断 bridge 闭环**,与裁决一致。

## 顺做证据

### lint 预检合同(09 §6.2 第一次真用)

`hopper lint --json`:`classification=ready`、`execution_decision=execute`、`risk=low`、`blocking=[]`。
判定口径按 09 §6.2:必须查 `result.classification`/`execution_decision`(不能只看 exit code),本卡满足 ⇒ 可 drop。

### hopper check 确定性验收 oracle(09 §9 可行性验证)

`hopper check --staged --criteria - --format json`(exit=0):
- `verification.status=passed`(跑 `npm test`,`trust=trusted`,exitCode 0);
- `guardrails.blocked=false`;
- `acceptance.status=supported`,逐条 `criteria[].{text,status,evidence[]}` —— **与 09 §13 `AcceptanceCheck` 合同同构**(criterion/status/evidence),`recommended_next_step=approve`。

结论:`hopper check` 作为 Tier1 verify 的确定性 oracle 成立(纯确定性、非模型、不写事件流不动工作区),4.1 `Tier1SettleProof.tier1VerifyDigest` 可基于其输出。**且比 Hopper post-run acceptance 闸门更适合 automation**——后者对本 PoC 任务标 `needs_human`(挡 automation 自批),前者可逐条机械判 `supported`。

## 对后续 Phase 的备注(回写登记,无 09 形状改动)

- ② 的实证再次确认 Codex 复审 A5:**P0.5 合并统一人工交接**(requestManualMerge + MergeProof watcher),SayDo 永不自动调 `hopper merge`/`review approve` 于 needs_human 任务。09/ADR-001 已写明,无需改合同。
- `RunSettled.summary_path` 实测为 `.md`(如 `20-Runs/Summaries/<runId>.md`)——印证 Codex 复审 A2:iframe 嵌入需受控映射到同 basename `.html`(11 §5.5 已写明)。
- 本 PoC 未发现 09 需改形状项;§14 PoC 证据以本文件留证,attest 现状与裁决一致。
