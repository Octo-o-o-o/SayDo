# SayDo 接线增量批 · 实施 Prompt(第三轮交接,复制分隔线以下到新会话)

> 背景:首发工程侧已收口并打 `v0.1.0-rc.1`(@ `628f7e4`);五路对抗面板(2026-07-25)实证**发起面零生产调用方**——live 工具环/tier1 操作面/bridge 驱动全是"库+测试就绪、生产未接线"。本批任务 = 把这些接进生产,使 owner 四场真人验收(①→②→③→④)可开。owner 已拍板:严格四场分开;retryTask=重派发;ADR-002 收窄条款已回写 09。估 4–7 人日。

---

你接手 **SayDo 接线增量批**(场次②–④共同前置)。任务清单的单一真相 = SayDo `HANDOFF.md` §2-9(六项);canonical 已先行更新(09 §6.1 新增 failed→queued 边、§11 规则 2 收窄条款、§13 retryTask 语义注——2026-07-25)。代码仓 `/Users/wangyixiao/WorkSpace/SayDo`(main 直推);设计库 `/Users/wangyixiao/WorkSpace/voice-coding`(只读,回写走轻量评审)。

## 0. 坐标核验(先做,漂移即停)

| 命令 | 期望(2026-07-25 16:20 实测) |
|---|---|
| `git -C ~/WorkSpace/SayDo log --oneline -1` | `628f7e4` 或其后的 evidence 提交(工作区可能含本轮未提交的 HANDOFF/sheets 修订——先 `git status` 核对是否已由上一会话提交,未提交则先按其内容收口一个 `chore(evidence)` 提交) |
| `git -C ~/WorkSpace/SayDo tag -l` | `v0.1.0-rc.1`(剥离 SHA = `628f7e4cd9684c0ecc61f000028ce3dab248ba0d`) |
| `cd ~/WorkSpace/SayDo && just ci` | 双矩阵绿(contracts 65 + daemon 349 passed \| 1 skipped) |
| `rg -n "expected_version" ~/.saydo/config.toml` | `bdd1e548…`(baseline.2) |
| `rg -rn "from \"./bridge" packages/daemon/src --glob '!**/*.test.ts'` | 空(接线前基线;接完不应再空) |

## 1. 必读(以 `/Users/wangyixiao/WorkSpace/` 为根)

1. `SayDo/HANDOFF.md`(§2-9 = 你的任务清单;§0 两条硬教训;§4 铁律)
2. `voice-coding/docs/09-data-contracts.md` §6.1(failed→queued 新边)/§11 规则 2(收窄条款)/§13(工具契约;retryTask 语义注)——**照抄源**
3. `voice-coding/docs/10-voice-ux-spec.md`(话术)+ `docs/11-ui-spec.md`(UI/零 emoji)
4. `SayDo/e2e/owner-sessions/session-1..4.md`(每份头部"修订"节列了接线批的回填义务)
5. `voice-coding/research/codex-findings/15-owner-decisions-panel.md` + `14-canonical-writeback-closeout.md`(裁决出处)
6. `SayDo/AGENTS.md`(评审制度)

## 2. 红线(违反即停;全文出处 HANDOFF §4)

零 emoji 门禁 / 状态词纪律 / S3 语音绝不放行(无自动 `hopper merge` 路径)/ Gate 0 无 bypass / verify 白名单+内容冻结 / TTS 必经 redactor / 契约只 import `@saydo/contracts`,形状冲突以 09 为准 / 设计库只读(回写=轻量评审)/ 每步独立核实落盘与 SHA / 两提交法 / **接线不降门**:每接一个操作面,其既有库层测试语义不得放宽。

## 3. 任务清单(= HANDOFF §2-9 六项;竖切,每项接完即测)

1. **SessionManager live 构造**:daemon 启动构造并传 `cfg.privacy.store_transcript`(验收锚 = gate0-checklist G6 行);**unheard 过滤**——被打断句(tts.playout watermark 未及句)不入 Brain 对话史;转写落盘 `~/.saydo/sessions/`。
2. **tier1 操作面接线**:reviewTask/cancelTask/**retryTask(改重派发:failed→queued,走 `canTransitionTask`,删裸 UPDATE)**/requestManualMerge → Brain 工具面 + console 写口(console API 现全 GET,需加受 capability token 保护的动作端点);**sheets 回填义务**:session-2 §0 的"owner 触发动作"定稿回填。
3. **live 工具调用环**:dialogLoop 接 function-call 装配(createTask/proposeStart/approveAction 等按 09 §13);**Context Pack live 传入**(index.ts 调用处传 packText);**热词偏置传参**(hub_client recognize 传 hotwords)。
4. **停靠老化调度**:30s 步界转停靠 + 72h 老化定时器挂生产(照 index.ts 备份定时器样板,unref+每轮重读配置);**同批 transitionTask 改 `WHERE status=from` CAS**(Codex 14 #2:定时器上线即激活竞态,禁先接线后修);blocked/ready_for_review 进入时落 parked 字段;package 回落 draft 的调用方承接。
5. **console 修**:api.ts dev 端口判定 bug(写死 5173,实际 vite 47120——统一改按 origin 判定或 env 注入);Playwright 用例覆盖 vite 路径或删除 vite 混淆入口。
6. **ADR-002 附则同步**(文档批):ADR-002 文末补收窄条款附则(09 §11 规则 2 已是 SoT);**豁免身份核验链本批不实现**(休眠;claude_cli 接入时做)。

每项验收:相关 §12 测试子集绿 + 新增 e2e(至少:语音派单→任务创建、审批语音消费、验收三态、取消、retry 重派发、停靠老化各一条)+ `just ci` 全绿。

## 4. 检查点(必须停下等 owner)

① canonical 语义级变更(超出 09 已拍板内容的);② 新花费/新账号/对外副作用;③ 四场验收本身(你只备料,接完通知 owner 可约场次①)。缺省动作纪律:必须确认项无回复=暂停该分支继续其他。

## 5. 诚实汇报 + 收尾

三级词表([ok] 带可复跑证据/[warn] 附差距/[fail] 附原因);每 SHA 来自本会话真实输出;收尾:全量 `just ci` + Playwright + golden 复跑,evidence 六段落 `e2e/evidence/wiring-batch.md`,更新 HANDOFF(§2-9 清账、§2-1 场次解锁声明),canonical 回写(ADR-002 附则等)走一致性 subagent + **Codex 攒批(编号 16)**,两提交法推远端。owner 之后用 /impl-review 对账。

## 6. 工作方式

main 直推;每项一对 feat+evidence 提交或整批两提交;`just ci` 每提交前必绿;评审 = 纯代码每阶段 1 code-review subagent(A 必修)+ canonical 攒批 Codex 16;遇阻用卡点格式。

开始吧:先跑 §0 坐标核验,读 §1,按 §3 顺序接线。
