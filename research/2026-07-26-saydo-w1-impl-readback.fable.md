# SayDo W1 批(收尾与 dogfood 起步)实施对账报告

> 仓:`~/WorkSpace/SayDo` main;基线 `65559c2` → 收口 `ce24c14`,**11 个提交**(本会话 `git log 65559c2~1..HEAD` 真实输出);计划 = voice-coding `IMPLEMENTATION-PLAN-2.md` §1-W1(九项)+ 交接 `IMPL-PROMPT-6-W1.md`;实施方证据 = `e2e/evidence/w1-batch.md`。对账人:设计库会话(Fable),2026-07-26 11:50–12:05。
> 基线漂移说明:IMPL-6 生成时预期 `602aa09`,实际开批 `65559c2`——中间两提交(`47118a9` 一致性回修、`65559c2` evidence 更新)属并发的执行器批 /impl-review 对账会话(其报告 `research/2026-07-26-saydo-executor-impl-readback.fable.md` + Codex 20),已核实非 W1 会话产出、内容合法。

## TL;DR

**W1 九项全部完成,对账通过。** 台账:[ok] 9 / [warn] 0 / [fail] 0 / [mixed] 0(四条诚实边界如实登记,均非缺口);门禁本会话亲跑全绿(`just ci` contracts 66 + daemon 467 passed | 4 skipped + python 11 + emoji 门禁,ci-exit=0;Playwright 10/10;真人底板音频烟测 3/5 known-miss 口径 exit 0);批末 code-review 的 A1/B1/C1 修复经我读码证实;一次过程纪律违规(CI 红被管道吞)已自愈并留教训。**零 canonical 变更属实**(voice-coding 的 09/05 在 11:00 的修改属对账会话的执行器批回写,有 Codex 20 评审,与 W1 无涉)。

## 对账台账(九项;证据均为本会话 Read/运行)

| # | 项 | 状态 | 证据 |
|---|---|---|---|
| 1.1 | audio-smoke 收编 | [ok] | 本会话亲跑 `--profile owner` → 3/5(a01/a02/a04 ok,a13/a20 known-miss)exit 0,输出与 evidence 一致;HANDOFF:65 WAVEFORMATEXTENSIBLE 知识在案 |
| 1.2 | 误听种子 + 热词调优 | [ok] | `e2e/golden/asr-regression.mjs` 存在(r001/r002,status=open);调优五组无改善=能力边界,如实登记,拉回路径改挂纠错链(场次①步骤5) |
| 1.3 | 项目层配置生产加载 | [ok] | `config/project.ts:1-40`(独立 schema+顶层白名单+拒键不拒文件);`config-project.test` 6 用例在 ci 内绿;executor 双链消费(认领+恢复) |
| 1.4 | 挂账清偿(深评装配/seedTerms/0.0(a)) | [ok] | governor 三段合同 `evaluator/readiness.ts:83-119`(admit 只读/成功才 commit/duplicate 返缓存照拒/throttled fail-closed :76-103);恢复钥匙落 `tier1_runs.native_session_id`——**09 §9:556 本就有此列,零契约分叉**(ddl.ts:99 一致);门控真 agent 3/3 未复跑(**跳过:耗订阅额度**;evidence 含 audit 行与 52.4s 细节,test 文件 5 个 test() 在案) |
| 1.5 | 周报增量 | [ok] | `obs/valueReport.ts`(北极星②机器+手工组分/触发线读数栏/0 值列位注明);写口 `/api/value-report/manual` 在 index.ts:213,**/api/* token 门内**(:332 注明安全边界);`value-report.test` 5 用例 ci 内绿;"建议性不作 stop/go"声明在文件头 |
| 1.6 | TTS 尾项 | [ok] | 6 个试听 mp3 在 `~/.saydo/tts-voice-candidates/`(均 uranus 系);分句首包引 phase-1 证据免补测成立(同型:每句独立连接);owner 听感 = HANDOFF §2-10 登记不阻塞;moon/uranus 系别知识 HANDOFF:67 |
| 1.7 | HANDOFF §2 回填 | [ok] | §2 #2/#3/#5/#6/#8-②/#10 逐行在案;音频 5 文件 sha256 入 evidence(可复跑,本会话烟测已复跑) |
| 1.8 | 转写 ref 口径统一 | [ok] | `liveTools.ts:645-647,668`(ref=裸 turnId 自取);`snapshotter.ts:133-138`(locator 形态处方化拒收);verify 零改属实;evaluator 反例 + live-wiring 回读 e2e 在 ci 内绿;**红线"不改 09"守住**(09 §4/§4.1 本就是两个字段,病灶在实现) |
| 1.9 | 排产源移交 | [ok] | HANDOFF:7 先读链含 PLAN-2(唯一排产源,首发降出处索引);HANDOFF:21 批次指针行(现为空=W1 已收口清指针) |

## 质量复审发现

- **批末 code-review 的三修全部证实**:A1 深评门(见台账 1.4)、B1 evaluator 异族强制(`index.ts:437-450`:familyFromModelName 比对 dialog/thinking,同族 warn+不装配)、C1 读错误面(`project.ts:77` 仅 ENOENT 空合法,其余 rethrow)。
- **过程纪律违规(实施方自报,属实)**:`e745f9a` 提交时 CI 实有 1 红(governor 旧断言),`just ci | rg` 管道吞退出码;`ffadec6` 立即修复。**机制教训已采纳:PLAN-2 §7 批模板补"门禁退出码显式核查,不得管道取尾"。**
- **并发写者事件处置得当**:开批期间对账会话覆盖其 HANDOFF 编辑,W1 重放并独立核实内容;这正是批次指针要防的窗口,机制已随 1.9 建立。
- **本会话新发现问题:无 A/B 级。**残留风险即 Codex 20 移交五件(已登记 HANDOFF §2-11,gate.sh digest 补偿控制为其首——同 UID 写工具改写 gate.sh 洗审批的补偿面,场次②前必落)。

## 门禁结果(本会话命令与尾行)

- `just ci` → contracts **66 passed** / daemon **467 passed | 4 skipped**(52+2 文件)/ python **11 passed** / emoji gate clean + 自测 4/4 / **ci-exit=0**(`/tmp/w1-ci-rerun.log`)。
- `pnpm exec playwright test` → **10 passed (15.0s)**。
- `audio-smoke-5.py --profile owner` → **3/5,exit 0**(known-miss 基线口径)。
- 门控 live e2e(SAYDO_LIVE_E2E)**跳过复跑**:耗真实订阅额度;采信 evidence 详输出(3 passed,含 gate audit 双行与 --resume session_id 同一断言)+ 本会话读码吻合。

## 处置与移交(不列修复清单——无待修缺陷)

1. Codex 20 五件 → **W2 阶段 0**(IMPL-PROMPT-5 已补 §3-0,场次②前必落);
2. 远端 push(main ahead 17)→ 本会话代推;
3. owner 待办不变:场次①(顺做 TTS 试听 + 误听纠错链验证)、§6 二次确认清单、Claude 订阅。
