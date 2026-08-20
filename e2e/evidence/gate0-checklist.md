# Gate 0 六项证据清单(5.3;05 §4——每项绑测试名,审计复核口径)

> 口径:5.3 是"逐项出示证据"不是补课(计划 §45);G2/G5 跨两阶段——P0 关 Tier1 半边并留基元级证据,
> 跨域半边 P0.5-B 以 §12-7 跨域子集 + §12-8 重新出证据(evidence 分行标注)。
> 运行验证:`just ci` 全绿(2026-07-25,contracts 65 + daemon 290);Playwright 8/8;音频烟测 5/5。

## G1 身份/授权模型

| 子项 | 证据(测试名/文件) | 状态 |
|---|---|---|
| 单用户假设显式化 + S3 只走屏幕 | `storage-checks.test.ts > approvals CHECK(09 §9 合法组合矩阵)`(S3 非 screen 强认证 INSERT 被 CHECK 拒);`policy-approvals.test.ts > dispatch_package 收据(签发/矩阵/生命周期)` | [ok] |
| PTT 窗口外/挂起态音频不产生指令 | `session.test.ts > G1 语音半边(05 §4 P0 口径:PTT 窗口外/挂起态音频不产生指令)` | [ok] |
| daemon HTTP/WS 调用方身份:capability token + Host/Origin 白名单 + DNS rebinding | `tier1-security.test.ts > G1 网络半边(capability token / Host / Origin / DNS-rebinding)`;Playwright `G1:无 token 打开 API 被拒(fail-closed)`(真 daemon 403) | [ok] |
| 审批门完整性:决策走 daemon socket / gate 不可写目录 / canary / 版本 pin | `tier1-security.test.ts > 审批门 fail-closed 四律(G3)`(含 canary 触发 cancel);`> 适配器:cursor worktree 供给 + 版本 pin + egress(G4)`(版本漂移拒起);4.0 conformance 报告 `e2e/evidence/phase-4.md` | [ok] |
| role 消息白名单(防 console 伪造 asr.final) | `voice-hub.test.ts > role 消息类型白名单(评审 B8:防伪造)` | [ok] |

## G2 跨边界事务幂等

| 子项 | 证据 | 状态 |
|---|---|---|
| callback outbox 活跃唯一 + dedupe NOT NULL | `storage-checks.test.ts > callback_outbox 活跃唯一(部分索引)+ dedupe NOT NULL`;`callback.test.ts > dedupe 活跃唯一 + 取消冻结 + 升级` | [ok] |
| 事件游标(events_cursor)+ 崩溃重放 | `storage-crash.test.ts > §12-7 崩溃注入(kill -9)`;`memory.test.ts > §12-4 崩溃相位重放` | [ok](本地半边) |
| 跨域 outbox/inbox + hopper_commands 重放 | P0.5-B 出证据(§12-7 跨域子集 + §12-8 fake-runner);本阶段 dispatch_bindings 悬账仅计数上浮(`summary-reconcile.test.ts` reconcile 报告) | [P0.5 分行] |

## G3 独立 acceptance oracle

| 子项 | 证据 | 状态 |
|---|---|---|
| verify 白名单(Brain 不可拼命令) | `tier1-security.test.ts > G3 verify 内容冻结 + Plan Delta`(非登记项拒冻);`policy-approvals.test.ts > E2 风险计算`(registered verify=S1) | [ok] |
| verify 内容冻结(argv+脚本 digest,执行前重校) | 同上(dispatch 冻结/执行前 drift 检出 fail-closed) | [ok] |
| agent 合法改 test ⇒ Plan Delta 重授权(不静默放行不静默死) | `tier1-security.test.ts`(content_drift ⇒ blocked 回叫载荷"需要你重新拍板") | [ok] |
| 生成方不自评(闸门判定与 Brain 无关) | 判定走 daemon 白名单执行器 + 独立 gate;golden `#16 Gate 0 未关拒绝开工` 话术断言(`golden-coverage.test.ts`) | [ok] |

## G4 secret/egress 隔离

| 子项 | 证据 | 状态 |
|---|---|---|
| agent 环境剥离凭据 + .env 读取升 S2+ | `policy-approvals.test.ts > E2 风险计算(效果升级)`(secret_read 升 S2+);`tier1-security.test.ts`(worktree 供给不带 .env) | [ok] |
| egress 按适配器如实声明(cursor=uncontrolled,不假绿) | `tier1-security.test.ts > 适配器…egress(G4)`(CursorCliAdapter.egress === "uncontrolled" 断言;证据本行如实标注:cursor 后端网络出口不可控,禁 network_fetch 类预授权) | [ok](如实=uncontrolled) |
| setup 供应链:缺省 --ignore-scripts | `tier1-security.test.ts`(setupArgv 断言 --ignore-scripts) | [ok] |
| TTS 脱敏(token/路径/PII 永不进语音) | `redactor.test.ts > TTS 脱敏 redactor(安全红线 10 §1)` | [ok] |

## G5 canonical intent 审计

| 子项 | 证据 | 状态 |
|---|---|---|
| 转写 + 任务卡 + 审批收据三方留痕链 | `policy-approvals.test.ts > G5 意图账本关联视图(贯通 join)`(utterance→receipt→task 贯通);`session.test.ts > A2 会话生命周期 + 转写落盘` | [ok] |
| audit_log 不可变 + 全动作落账 | `storage-checks.test.ts > audit_log 不可变(E3;v2 触发器,收口对账 #1)`(UPDATE/DELETE 触发器拒 + 旧库增量迁移);各服务测试断言 audit.record 调用。**勘误(2026-07-25 收口对账):本行原声称的触发器与测试当时并不存在(证据虚报),DDL v2 迁移补上后方为真** | [ok](收口修复) |
| 跨域执行留痕(Hopper 事件) | P0.5-B 出证据 | [P0.5 分行] |

## G6 删除/同意传播

| 子项 | 证据 | 状态 |
|---|---|---|
| forget 硬删通路(活动存储零明文零孤儿) | `memory.test.ts > forget_hard 传播 + 重放幂等(G6)`;`evaluator.test.ts`(A-1/A-3 快照删除序 + 崩溃恢复重删) | [ok] |
| 备份例外(登记待过期 + 如实话术) | `backup.test.ts`(保留期);golden #38(不说"所有副本已立即删除") | [ok] |
| 录音/转写分别同意 | 配置 [privacy] store_audio(缺省 false)/store_transcript 分键:`config.test.ts > [privacy] 录音/转写分别同意(G6;收口对账 #2 补证)`(缺省值/独立可配/项目层拒)+ `session.test.ts`(store_transcript=false 不落盘);store_audio:P0 无音频写盘路径(rg 实证零命中),天然满足;音频保留期 audio_retention_days=0(M11)。**勘误(2026-07-25 收口对账):本行原绑 config.test.ts 当时无 privacy 断言且 store_transcript 键未被消费(schema .partial() 还削弱 default),收口修复:prefault 缺省单源 + SessionManager 接线 + 双测试。挂账(code-review B1):SessionManager 的 live 实例化(场次② dogfood 增量)必须传 `cfg.privacy.store_transcript`——漏传缺省 true 静默违 G6,接线时以此行为验收锚** | [ok](收口修复) |

## golden 覆盖矩阵(10 §6)

- `golden-coverage.test.ts` 5/5:合计 39 条(PHASE1 5 + M6 4 + COVERAGE 30)>=20;
  §2 P0 场景号全覆盖(#7 停用注记、#12/#39 P0.5、#22/#25 路径二除外);
  逆风齐:Gate0 拒绝(#16)/预算不足(#17)/熔断(#28)/merge 失败(#32)/撤回(#38)/不置可否(#15);
  状态词零违规 + 零 emoji 断言。

## 音频烟测(5 条,真管线 sauc)

- `e2e/smoke/audio-smoke-5.py` 5/5(2026-07-25):a01/a02/a04/a13/a20 术语全命中(热词偏置开);
  **注**:owner 真人底板未录(owner 侧资产),本次用 1.0 种子语料合成音替代——如实标注,
  真人 5 条补录后重跑同脚本即可。barge-in/unheard 断言由 `voice-hub.test.ts`(watermark 截断)承载。
