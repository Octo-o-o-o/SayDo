# 接线增量批(HANDOFF §2-9 六项)— 验收证据(2026-07-25)

> 场次②–④共同前置批;任务单一真相 = HANDOFF §2-9(六项),canonical 先行更新
> (09 §6.1 failed→queued 边 / §11 规则 2 收窄条款 / §13 retryTask 语义注,2026-07-25)。
> 三级词表:[ok] 带可复跑证据 / [warn] 附差距 / [fail] 附原因。

## 1. 测试命令与尾行输出(本会话真实输出)

- `just ci`:双矩阵绿——contracts **66 passed**(65→66,新增 failed→queued 边表测试)+
  daemon **386 passed | 1 skipped**(349→386,新增 37:live-voice-sessions 7 / live-wiring e2e 6 /
  console-actions 14 / park-scheduler 5 / voice-hub asr.hotwords 2 / tier1-operations 重派发+终态断言 3;
  Codex 16 回修批 commit message 笔误写 391,以本行与 git 可复跑输出为准)+
  python **11 passed**(8→11,新增 hub_client 热词 3);emoji 门禁 clean + 自测 4/4。
- Playwright:`pnpm exec playwright test` → **10 passed**(原 8 + 新 2:vite dev 47120 路径回归 /
  任务详情操作行 approve→待合并 + S3 批准前置灰)。
- golden 复跑:golden-coverage.test 5/5(43 条,状态词零违规)随 CI 全绿。

## 2. 六项 ↔ 实现与测试对照

| # | HANDOFF §2-9 项 | 状态 | 实现锚 | 测试锚 |
|---|---|---|---|---|
| ① | SessionManager live 构造 + unheard 过滤 + 转写落盘 | [ok] | `index.ts` 构造传 `cfg.privacy.store_transcript`(G6 锚=gate0-checklist G6 行);`live/voiceSessions.ts`(开口即建 draft/落盘 `~/.saydo/sessions/<id>.jsonl`/barge-in 句粒度 unheard/空闲 45s 挂起+重建) | `live-voice-sessions.test.ts` 7/7(unheard 不入对话史+落盘 heard 标/挂起重建 history 读回滤 unheard/G6 store_transcript=false 不落盘重建如实降级) |
| ② | tier1 操作面接线 | [ok] | Brain 工具面(`brain/liveTools.ts` 注册 cancelTask/reviewTask/retryTask/requestManualMerge)+ console POST 写口(`api/actions.ts`,G1 门内)+ TaskDetail 操作行;reviewTask approve 的 evidenceDigest **库内自取**(settle proof,拒外部注入——接线收紧);补 verify-merge(MergeProof 按需核验:daemon git 现读 treeSha 对账批准落库值) | `console-actions.test.ts` 14/14(验收三态/取消即时 settle/retry/merge 核验 git 真仓正反例);`tier1-operations.test.ts` 13/13 |
| ③ | live 工具调用环 + Context Pack + 热词 | [ok] | provider 层 function-call(`openaiCompat.ts` tools/tool_calls)+ `brain/registry.ts` + 全套 09 §13 工具;**dispatch 确认词表环**(`live/confirm.ts`:词表匹配在 daemon 状态机侧单源,10 §2.5;presentation barge-in 作废 A8)+ 词表环 accept 后 `dispatchApprovedPackage`(Gate 0 检查/收据时效复验/consume/包 approved/建任务入队);Context Pack live(`live/pack.ts`:每轮编译+快照落盘+session digest);热词 `asr.hotwords` 下发 → `hub_client.py` recognize 传参 | `live-wiring.e2e.test.ts` 6/6(派单全链→queued+turn_ref 绑签发轮/含糊复读→转屏收据留 pending/barge-in 作废裸"好"不消费重播后可/否定拒/Gate 0 拒/**过期补发拒+收据 expired**);`voice-hub.test.ts` +2(广播/peer 直发丢弃);pytest +3 |
| ④ | 停靠老化调度 + transitionTask CAS | [ok] | `live/scheduler.ts`(30s 步界 paused→blocked (T)+parked 字段+blocked 回叫;72h 老化→cancel_requested(park_expired)→无活跃 run 即时 settled+package revise 回落 draft+回叫 #35);`dao/tasks.ts` transitionTask 改 `WHERE status=from` CAS+停靠字段进出;index.ts 15s 定时器(unref,每轮重读 park_aging_hours) | `park-scheduler.test.ts` 4/4(30s 边界/T-U 竞态 CAS 先提交者胜/72h 全链含 revision+1 draft/有活跃 run 停 cancel_requested 不伪 settled) |
| ⑤ | console 修 | [ok] | api.ts 端口判定**归零**(恒同源;旧写死 5173 判定删除)+ vite `server.proxy`(/api,/dev,/ws,/health 转发+剥 Origin=本地进程语义,token 门不放宽)+ `allowedHosts` 白名单 + 显式绑 127.0.0.1(vite 7 缺省 [::1] 不同栈) | Playwright #9(47120 页数据真达 daemon)+ #10(操作行);直连方案否决理由:撞 G1 Origin 白名单(DNS-rebinding 防护不放宽)+ 缺 CORS |
| ⑥ | retryTask 重派发 | [ok] | contracts `task.ts` 补 `failed→queued (U)` 边(09 §6.1 照抄);`operations.ts` retryTask 走 canTransitionTask+CAS(裸 UPDATE 已删),failed⇒queued(不直进 running)+freezeOutbox(trigger=failed)/blocked⇒running(应答注入);message 只落 digest(E3) | `task-sm.test.ts` 边表五断言;`tier1-operations.test.ts` 重派发正反例(旧 run 终态不动/audit 无原文);`console-actions.test.ts` retry 3 例 |

新增 e2e 六条(任务清单要求)全落:语音派单→任务创建 / 审批语音消费 / 验收三态 / 取消 / retry 重派发 / 停靠老化(锚见上表)。

## 3. 评审(制度:纯代码 1 code-review + canonical 1 一致性 subagent + Codex 攒批 16)

- **code-review subagent**:A 级 1 条——`dispatchApprovedPackage` 不复验 `expiresAt`,Gate 0 拒后残留的
  accept+pending 悬挂张可被 Brain 经 confirmAndDispatch 补发(**已修** `0111d5f`:消费前时效复验,过期置
  expired 终态+拒,附反例测试);B1 parkAging 裸边补状态机守卫(已修);B2 vite 剥 Origin 纵深收窄
  (已加 allowedHosts;evidence 记录:dev 通道安全=token+Host 两道,生产不经 vite);C1 收据未绑
  session(P0 单 owner 单机,登记多租户前提);C2 裁决轮 user 文本入 history(语义合理,登记)。
  其余 A 级候选面(Brain 伪造确认/S3 语音/barge-in 裸肯定/Gate 0 bypass/verify-merge 注入/POST 身份门/
  TTS redactor/hotwords 注入)评审逐一核为已守住。
- **一致性 subagent**:A 级零。B-1 09 §10 词源句写超实现(**已修**:如实改"P0=M0 热词,seedTerms 预留
  挂账 dogfood"+两处实现注释同步);B-2 ADR-002 新旧并存误读面(**已修**:状态行前向指针+旧节标
  superseded);B-3 HANDOFF #9 未标完成(**已修**:#1/#9 清账+场次解锁声明);C-1 atMs 措辞/C-2 words
  约束/C-3 watcher 按需形态注/C-4 11 §5.5 操作行两按钮回填(**均已修**);C-5 hotwords 测试零锚
  (**已补** hub 级 2 例);C-6 AGENTS.md 术语表指向漂移(登记 owner 侧,不代改)。
- **Codex 攒批 16**(`gpt-5.6-sol`/max,只读,50 分钟):报告 `research/codex-findings/16-wiring-batch-writeback.md`
  (含 triage 表)。裁决:canonical 回写文字层通过(09 §10 形状三方一致/ADR-002 四要点逐字无漂移/
  approve 自取=合同收紧非偏离/CAS+parked+调度与边表一致);**A 级 5 条**——① 全角问号护栏失效
  ("可以?"误 accept,python 读码点+node 复现证实,存量 bug 生产化后必修)② retry message/返工
  comments 原文无 durable 落点 ③ approve proof 仅 truthy 检查 ④ blocked 回叫缺 09 §9 最小 proof
  ⑤ accept/consume/建任务非原子——**4 条当轮修复**(回修批 2 `b78d2e6`:词表 `[?\uFF1F]`/DDL v3
  task_messages 表+事务内持久化+readTaskMessages 消费口/tier1SettleProofSchema.parse+run state+四字段
  交叉核对/minimalProof fail-closed 门+contracts additive 字段/dispatch 全链同事务),1 条(BYOA
  familyFixed 与"豁免休眠"声明并存)核实为**生产不可达**(resolve.ts 仅 api,BYOA 无生产构造点;
  Codex 自注 potential)+ owner 已有保留决策,登记身份核验链批;B 级 7 条全修(retry 终态断言/
  retry 事务化/direct 档拒/收据超时 sweep/裁决轮不入 history/revise 失败不发成功回叫/tier1_run CAS);
  C 级 2 修 2 登记。

## 4. canonical 回写与 sheets 回填

- voice-coding `docs/09` §10:PipelineMsg 词表补录 `latency.stage` + `asr.hotwords`(工程 additive 扩展
  的 canonical 补录,时序如实注明);§13 requestManualMerge 补 P0 watcher 按需核验形态注;
- voice-coding `docs/11` §5.5:操作行回填"作废这轮"+"我已合并,核验"两按钮(实现不夹带文档没有的元素);
- SayDo `docs/adr/ADR-002`:文末收窄条款附则(SoT=09 §11 规则 2 四要点逐字;豁免休眠;身份核验链
  本批不实现,claude_cli 接入时随核验实施并再次上浮)+ 新旧口径前向指针;
- sheets:session-1 §0(47120 修复解锁+挂账步骤解锁)/ session-2 §0+step5/6(owner 触发动作定稿:
  语音"验收通过/不行改X/算了这轮不要了"+屏幕按钮一一对应;如实标注执行器边界)。

## 5. 偏离与差距(诚实清单)

- [warn] **Tier1 生产执行器不在本批**(HANDOFF §2-9 六项原文无此项):认领 queued 任务起 agent 进程、
  审批门 S2 上浮 live 环、Tier1SettleProof 生产产出与 settle 回叫链——场次② step 2-4 依赖它;
  派单链 e2e 如实止于 queued(story-acceptance 的 running→ready_for_review 为注入模拟)。
- [warn] retryTask message / 返工 comments 的**编译上下文消费点**在执行器认领时(随执行器批);
  原文已 durable(DDL v3 task_messages,Codex 16 回修——"记下了"是机械事实),仅消费口挂账。
- [warn] BYOA familyFixed 豁免代码与"豁免休眠"声明并存(Codex 16 A 潜在):生产不可达
  (resolve.ts 仅 api)+ owner 保留决策;**身份核验链批实施时必须改写 familyFixed 门与 byoa.test
  恒定族用例**(ADR-002 附则第 2/4 条为义务承载)。
- [warn] assessReadiness live 注册为规则层最小形态(机械可判面=草稿要点有无;critical claim 证据链
  §4.1 与异族深评触发的 live 装配随 dogfood 期,readiness.ts 库层已备)。
- [warn] 运行中 S2 审批(approveAction 工具/gate stepConfirm 语音上浮)无生产发起方(执行器批);
  本批词表环覆盖 dispatch 收据消费;approveAction 工具未注册(无消费者不造接口)。
- [warn] 热词 seedTerms(奠基词元)未进生产偏置词表(biasTerms extraSeeds 预留;dogfood 期接)。
## 6. 代码提交(SHA 均为本会话 git log 真实输出)

`4e97ae1`(任务①②③:SessionManager live + tier1 操作面 + live 工具环)
`5769ae9`(任务④⑤⑥:停靠调度 + console 同源化 + ADR-002 附则 + MergeProof 核验 + sheets)
`0111d5f`(评审回修批 1:subagent 双路——A1 时效复验 / B1 守卫 / B2 allowedHosts / 一致性 B-1/B-2/C-5)
`b78d2e6`(评审回修批 2:Codex 16——全角问号 / task_messages / proof 严格校验 / 最小 proof 门 / 事务化)
`2292a37`(evidence 首版)
基线 `4307358`;本文件更新随末次 `chore(evidence)` 提交(SHA 见 git log,不自指)。

## 7. impl-readback 回收批 2(2026-07-25 晚,owner 授权修;代码提交 `bf4b956`)

owner 侧 /impl-review(`research/2026-07-25-saydo-wiring-impl-readback.fable.md`)判
"可合并、无 A 级",其 4B 6C 中 B1–B4 + C1/C2/C3/C4 当轮回收:B1 词表全角感叹号(与 Codex 16 A2 同种
字节病残留,hexdump 实证)/ B2 过期确认零反馈(按错误面分话术)/ B3 blocked 回叫冻结 / B4 config 损坏
朝紧(新模块 config/runtime.ts:启动拒 + Gate 0 fail-closed)。复审(code-review subagent)抓 1 A 当轮修
——B4 自身的审计原文泄漏(TomlError codeblock 流入永不可清的 audit_log,摘要脱原文);C-1(catch 面
分话术)/C-2(字节计数)/C-3(/dev 路由同限)/C-4(fixture 状态机可达)择要吸收;C-5 截图噪声剔除。
门禁:`just ci` 双矩阵绿(contracts 66 + daemon **393 passed | 1 skipped**,+7 测试)+ Playwright 10/10。
C2(句中问号剥除)为语义取舍不动;C6(45s 定时器直接测试)登记 dogfood 期。
