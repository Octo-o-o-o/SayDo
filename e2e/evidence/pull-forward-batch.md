# W2 提前批(四项 + 安全五件 + 场次①修复)—— 验收证据(2026-07-26)

> 范围 = IMPL-PROMPT-5 §3(唯一排产源 PLAN-2 §W2):阶段 0 安全五件 + A launchd + B T2 薄版 +
> C M1 完整版 + D VAD 免手;E(S3 卡/writing 窄版)= 合同门检查(未就绪按纪律登记顺延,见 §E);
> **增补:场次①现场发现修复批(owner 2026-07-26 下午授权纳入本批,见 §S1)**。
> 三级词表:[ok] 可复跑证据 / [warn] 差距如实 / [fail] 未做。SHA 均为本会话 git log 真实输出。
> 基线:开批 HEAD `ce24c14`(W1 收口);§0 坐标核验六项全过(ci 双矩阵 contracts 66 + daemon 467|4 skipped
> + python 11;playwright 10/10;launchctl 无 saydo 条目;05 §4 提前批表在;cursor-agent 登录正常)。

## 0. 安全五件(Codex 20 移交,场次②前必落;代码 `5391b0f`)

| # | 项 | 状态 | 验收锚 |
|---|---|---|---|
| ① | A1 gate.sh 每请求补偿控制 | [ok] | `executor.gateScriptDriftGuard`:每收 gate 请求重读 gate.sh 与 `buildGateScript()` 期望比对;漂移 ⇒ deny + 全部活跃 run 终止(canary 同族,任务 failed)+ 审计(expected/actual digest;unreadable 同处置)+ 自愈重写。测试 `tier1-executor.test.ts` "gate.sh 被改写/被删除" 2 例 |
| ② | B2 validateTier1Config | [ok] | `tier1/validateConfig.ts`:绝对路径/存在/常规文件/可执行/versions/<pinned>/ 形态;`assertExactVersion` 精确相等替换 `includes()`(实测 `--version` 输出 = 裸版本串,`-dirty` 类漂移串被拒)。§12-9 正反例 `tier1-config-validate.test.ts` 13 例 |
| ③ | B3 非 cursor 后端启动即拒 | [ok] | `tier1StartupVerdict`:`models.dev.agent != "cursor"` ⇒ 拒起 + 审计;`steerApplied` 恒 `queued_delta`(无后端实现流中注入,不谎报 live;canonical 标注见 §回写清单) |
| ④ | B5 gate.sh jq -e 输入校验 | [ok] | 非 JSON 对象 / command 缺失·非 string·空串 ⇒ 不 POST 直接 deny;三反例 + "未到达 daemon" 断言(gate-socket 测试 seen=0)+ 正例照常上行 |
| ⑤ | B6 前半 step_confirm 承载核对 | [ok](核对结论,不改代码) | 见下节 |

**⑤ 核对结论**:mode 只落 `DecisionPackage`(P0 语音拍板恒 `step_confirm`;`direct_to_review` 语音确认 fail-closed 拒——预授权清单念读环未接),不落 tasks 行;`Tier1Executor` 不读 mode——所有 tier1 任务同一策略:每条 S2 逐个上浮(= 04 §5.4 step_confirm 档的 S2 语义)、S0/S1 放行、S3 拒。落差三处:① step_confirm 的"计划步骤边界确认"无承载(单 attempt 拓扑不产生 `step_paused`,09 §9 该边无产生方——Codex 20 B6 前半原文);② direct_to_review 档预授权清单消费缺失(所有 S2 恒上浮,方向保守 = 过度确认,非放行面扩大);③ mode 不进认领链。**裁决:安全方向保守成立;canonical 侧需把 09 §9 step_paused 边与 §13 执行模式承载标 deferred——列入回写清单上浮,不自定语义。**

## A. launchd 常驻(07 D17;代码 `478864c`,竞态修复随场次①批)

- [ok] plist 纯函数生成(全绝对路径;`KeepAlive.SuccessfulExit=false` 崩溃自启、graceful exit 0 不复活;`RunAtLoad` 重登录自起;stdout/stderr 兜底落 `~/.saydo/logs/`;PATH/SAYDO_DEV 快照自安装 shell)。结构测试 3 例。
- [ok] **装载实测(owner 批准,2026-07-26 13:41)**:`launchctl list` 出现 `com.saydo.daemon`(初始 pid 67610);`/health` 应答正常。
- [ok] **kill -9 自启实测**:kill 后 launchd 自动重启(pid 67610 → 78332),`/health` 恢复,日志显示 `tier1 executor started`(版本断言过)+ `daemon started`——启动对账链跑通。
- [ok] **C2 运行时/开发树分离(场次①增补)**:`just daemon deploy` 把常驻切到 `~/.saydo/runtime` 独立树锁定 SHA;首次 deploy 实测(锁 `980579d`,pid 20365,`ps` 确认进程路径 = runtime 树入口;`/health` 正常)。bootout→bootstrap 竞态(实测 "Bootstrap failed: 5: Input/output error")已修:`bootstrapWithRetry` 小退避。
- [warn] 重登录自起为 RunAtLoad 机制性保证,重登录实测留 owner 顺手验;`just ci` 不受影响(装载后多次全绿)。

## B. T2 薄版(05 §4 提前批 #2;代码 `27e0951`)

- [ok] tailnet 白名单显式枚举:`[t2].tailnet_hosts`(纯主机名/IP;含通配/空串/scheme/端口 ⇒ 整体 fail-closed 不开 + 审计)+ `listen` 缺省 127.0.0.1;`verifyIdentity` 加 tailnet 面与 `via` 来源标注。测试 `t2-thin.test.ts` 11 例(白名单外 Origin 拒 / 端口变体拒 / https origin 拒 / 未配置时 tailnet Host 拒)。
- [ok] S3 手机面拒:tailnet 来源 `request-manual-merge`/`verify-merge` ⇒ 403 + 话术引导回受信终端 + 审计;S2 面照常可批;`/dev/*` 仅本机;console S3 按钮对远程来源置灰。
- [ok] ntfy L1 投递接线 + 深链(此前 `attemptNotify` 无生产消费者):15s sweep 扫 outbox pending ⇒ ntfy JSON POST,深链 = tailnet console 任务详情 hash 路由、**不带 token**(测试断言);DND 沿用 engine snooze;话术走 10 §1 状态词。
- [ok] token 面收紧:console fetch 改走 x-saydo-token header(WS 保持 query——浏览器限制);`just t2-pair` 一次性配对 URL(token 注入手机本地会话后深链不带 token)。
- [warn] **组网与手机烟测:owner 暂缓(2026-07-26 下午)**。过程实录:Tailscale 实体未装(仅失效 wrapper 残留)→ owner 批准 brew 装(cask 装 pkg 需系统密码,环境拿不到 sudo)→ owner 自装并登录 → 点 Connect 弹回:诊断①Clash Verge TUN 模式(enable+auto-route)冲突,owner 已关;诊断②真因 = **Tailscale 系统网络扩展卡 "activated waiting for user"**(`systemextensionsctl list`),需系统设置-网络扩展里手动批准——已代开设置页,owner 选择改天完成。烟测四页 + S2 批 + S3 拒话术验收随组网完成后补验,登记 HANDOFF 待办。
- **ntfy X-Call 过渡层评估(W2-B 顺手项;不动 canonical)**:ntfy 电话呼叫 = 发布带 call 参数(ntfy.sh 需 Pro 档 + 验证手机号;自托管需自配 Twilio),消息文本 TTS 单向朗读,无 DTMF 交互(承载不了 ack/snooze,不触碰电话形态锁定计划的 DTMF 红线)。工程接入 ≈ 零成本(发布体加字段);货币成本非零 ⇒ 新花费过检查点④。**结论:可作"离机只收文字推送"缺口的过渡,建议等 W1.5 周报触发线读数出现缺口证据再开通,本批只评估不接线。**

## C. M1 奠基完整版 + 生长闭环 + AGENTS.md 互通(05 §4 提前批 #4;代码 `97c74cc` + `9956a70`)

- [ok] 奠基生产接线(此前 `bootstrap()` 无生产调用点):`POST /api/projects/:id/foundation/bootstrap`(写仓库文件 ⇒ 仅受信终端,tailnet 403)+ psettings 奠基按钮;预算读 `[params]`;事实入账本(auto_low_impact + taint[repo_file]);重奠基旧代事实按 `foundation@` 前缀 invalidate(不堆积,测试断言)。
- [ok] generation 失效(IMPL-5 §3-C):`effectiveMemoryGeneration` = 账本 forget_hard 代 + 奠基代之和(两个持久单调计数器;09 §0.1 packDigest 签名域承载)——重奠基后同输入 packDigest 必变(测试断言)。
- [ok] 会后提炼闭环(只提名、人批准):挂起时机械提名(决策性标记窄口 + isImperative 双保险,上限 5/会话,去重)⇒ candidate;console 记忆页批准/拒绝;批准 = user_approved supersedes 候选,拒绝 = forget_soft 不复活。**提炼闭环 e2e 一条**(`memory-growth.test.ts` 全链:suspend → 提名 2(问句不提)→ 批 1 拒 1 → trusted 进投影与 pack → m1-notes 含批准项不含拒绝项)。
- [ok] AGENTS.md 互通:读侧既有(conventions.md 吸收);写侧新增 M1 稳定结论人可读投影 `.saydo/knowledge/m1-notes.md`(账本为真相源可重放再生;P0 无 watcher 如实注记),指针块加投影行。
- [ok] kill -9 一致性:current.json 唯一真相源;半切换(指针新/symlink 旧)自愈;工作区失踪 fail-closed。§12-4 记忆用例不回退(memory 19 + foundation 9 + compiler 12 全绿)。
- [ok] **OctoDesk 真仓首次奠基(owner 知会后执行,2026-07-26 13:43)**:`bootstrapProjectFoundation` → gen 2 complete(5 关键文件、2 事实入账本;gen-1 为同分钟内非法 projectId 首试的半发布产物,见下);产物核实:`.saydo/foundation/current.json`(generation 2)+ `knowledge/current -> gen-2` + `m1-notes.md`(机械事实节)+ AGENTS.md 指针块含 m1-notes 行。**kill -9 复测**:kill 常驻 daemon → launchd 自启 → current.json 读数一致;**重奠基**:gen 3 + invalidatedOld=2(旧代事实退场)。
- [ok] **真仓踩坑修复(`9956a70`)**:非法 projectId 在 publish 之后的 ledger 写入才炸,把已发布 generation 翻转成失败返回(半状态)——修:入口 idSchema 快速失败 + 单条事实写入失败只记审计不作废底座 + e2e 候选按 claim 定位(同毫秒 ULID 随机段排序不定,三连跑验证)。
- [warn] 提名器为机械词表窄口;LLM 提名增强挂 dogfood 观察。

## D. VAD 免手 + 语义 EOU + AEC 外放(05 §4 提前批 #6;代码 `c87b734`)

- [ok] 轮次三层(10 §3-1):能量 VAD 起停(RMS+hangover,900ms 静音断轮中英混说延长口径,preroll 防吞首字)→ 语义 EOU(接续词/逗号收尾判未完 ⇒ 缓存拼接,悬挂 2.5s 硬终结)→ 显式"说完了"按钮(免手档强制终结);PTT 保留兜底。
- [ok] **免手 5 轮注入不误断**(IMPL-5 §3-D 验收):`test_vad_handsfree.py`——5 轮含轮内 400ms 停顿,恰 5 条 asr.final、5 次识别调用、每轮恰一对 vad.speech start/end。
- [ok] barge-in 语义不回退:免手档开口(vad.speech start)⇒ console 在播即发**既有** barge_in(watermark 截断);unheard 链路未动,既有测试全绿。
- [ok] 契约 additive:`voice.mode`/`vad.speech` 入 contracts + hub 角色白名单(方向越权丢弃,测试 2 例);09 §10 回写列入清单。
- [ok] AEC 外放 baseline(03 §3 口径):echoCancellation 请求 + `track.getSettings()` 实测生效 + 免手常听态呈现"外放建议耳机"。
- [warn] VAD 引擎 = 能量 RMS(纯 python 零依赖确定性;07 D2 的 Silero 是 Pipecat 框架语境内置件,当前管线为自写 WS client)——Silero/webrtcvad 升级与阈值调优登记 R-C sweep;真麦免手体感与外放回声实测留 owner 场次。`asr.partial` 实时字幕不在本批(仍 P1)。

## E. S3 屏幕审批卡 + writing 窄版:顺延(合同门未就绪,按纪律登记——不算失败)

- 就绪判定复核(2026-07-26):09 §13 `explainResult` 判别值仍仅 `coding_done|blocked|failed|unknown`;09 无 S3 卡认证/merge 接线节;05 §4 提前批 #3/#5 仍标"合同设计先行"。⇒ **E 顺延,等 R-A 合同轮交付后由 W4 承接**(PLAN-2 已如此排产)。
- 依据:IMPL-5 §2 红线"合同未落 09/10 前不得开工;绕过合同直接编码 = 违反契约不分叉"。

## S1. 场次①现场发现修复批(owner 授权纳入 W2;代码 `980579d`,优先级 A1→A3→A2→B1/B2→C1→C3)

| 项 | 状态 | 验收锚 |
|---|---|---|
| A1 DDL v5 全量增量迁移 | [ok] | 系统性差集经机械对账(v4-era 库 vs 全新库,**与 owner 现场实测清单完全吻合**):3 表(context_snapshot_uses/source_snapshots/claim_snapshot_links)+ 6 列(sessions.lane / tasks.approved_tree_sha / readiness 四列)+ 1 索引。代码迁移形态(PRAGMA 探测容错——owner 手术库跳过不炸,手术列无列级 CHECK 如实接受,新库走 DDL_V1 完整 CHECK;readiness 跨列 CHECK 老库无法后补,SQLite 无 ADD CONSTRAINT,DAO/契约层兜,诚实注记);owner 库手术后与全新库 schema 已零差集(独立复核)。回归 `storage-migration-v5.test.ts` 4 例:v4-era fixture(`test/fixtures/schema-v4-era.sql`,取自 phase-0 初版 DDL_V1 + 现行 v2-v4)→ openDb → 对象齐 + 手术容错 + 幂等 + **崩点复现面全链冒烟**(session/turn/pack 编译/readiness 落库);storage-checks 终版本断言改读 MIGRATIONS 尾项(不写死版本号);HANDOFF §4 加铁律 |
| A2 Chat 时序交错 | [ok] | 用户轮/AI 句打统一到达序(arrivalSeq),合并按 seq 排序(此前两列表拼接 AI 恒叠上方);partial→final 替换保原位 |
| A3 思考中指示 | [ok] | asr.final 置 thinking、首句 tts.say 清除、45s 兜底(Brain 环异常不悬挂);chat 页气泡位"思考中…"(02 §3 学习中一等状态) |
| B1 空账本被判就绪(缓解) | [ok](known-gap 登记) | **不自定硬闸**(生产 dims 恒空,硬闸会死锁 propose 链——w1-batch §4 诚实边界):instructions 第 5 条加"采访未覆盖目标/验收/边界不得提议开始";golden `s1-b1` 反例(known-gap 标注,正式空账本 fail-closed 闸等 canonical dims 合同,设计库在途) |
| B2 settle 话术谎报(缓解) | [ok] | instructions 第 13 条"结果句式只归回叫播报";golden `s1-b2` 反例(无任务上下文禁"等你验收/交付了/跑完了");正式 10 硬规则随设计库补丁 |
| B3 悬挂 proposed 包 | [ok] | 两个测试期凭空包(B1 产物)按状态机合法边 proposed→draft + 审计留痕(库内 UPDATE + audit_log 行,真库实测);**核对确认缺口:proposed 无过期/作废终态**(PACKAGE_TRANSITIONS 仅 approved|draft 两出边;09 §0.1 只派生 approved 的 expiresAt)——登记 canonical 清单 |
| C1 Dashboard 新对话 | [ok] | `#/chat` 无锚定路由(此前空态死链 / 有项目劫持首项目);Chat projectId 可空不锚定,开口即建 draft(既有 ensureSession);instructions 第 2 条加第一句问归属。**不碰输入区/PTT 面(D4 红线,设计库 UX 补丁在途)**。owner 补验场次①步骤 1 待办 |
| C2 运行时/开发树分离 | [ok] | 见 §A(deploy 实测锁 `980579d`);HANDOFF §4 惯例(dogfood 时段不重启) |
| C3 对话档延迟 | [ok](核对 + owner 已拍板) | 结论:dialog=qwen3-32b 属**混合推理模型,OpenRouter 缺省开思考** ⇒ asrFinal→llmFirstToken 5.3–6.6s(owner 实测)是结构性的;`provider_order=["deepinfra"]` 钉路由配置与代码(openaiCompat body.provider)均在;latency-report 重启后无新样本(n=0)。**owner 拍板(2026-07-26 下午):先不动,等 Gemini 解封换回**;A3 思考中指示补体感。登记 D 项:换模型时按 09 §11 异族约束选非 GPT/Claude 族 |
| D1–D4 登记 | [ok] | D1 evaluator 深评装配仅 api 形态(BYOA CLI 不装配;dims 恒空期无实际影响,随 dims 语义批支持)/ D2 TTS 音色等 owner 拍板(HANDOFF §2-10 在案)/ D3 提交门禁纪律照守(本批每次提交独立跑 `just ci` 看真实退出码,未用管道取尾)/ D4 console 输入区/PTT 面未自行改动(等 10/11 补丁交接) |

## 评审(轻量制度;A 级必修)

- **过程事故如实**:分阶段派的三路后台 code-review(阶段 0 / B / C+D)长时间无返回(超 3 小时判超时弃用),改派**一路前台合并终审**覆盖 W2 全部提交(ce24c14..HEAD,A 级聚焦)。
- **合并终审结论:1A + 1B(高置信),其余七大红线域(gate 完整性/tailnet 枚举/S3 面隔离/token 不入深链/记忆信任分级/语音 unheard/迁移容错)逐域核验通过**。triage:
  - A1(必修,已修 `d8b5025`):ntfy 通知标题未经 redactor——任务标题自由文本经公网 ntfy(topic 明文可订阅)+ 手机锁屏,与 TTS 同族外呼面;修 = `renderNtfyMessage` 标题过 `redactText` + 敏感形态反例测试(运行时拼接构造)。
  - B1(同批修,`d8b5025`):`effectiveMemoryGeneration` 奠基代 IO 读失败静默归 0 ⇒ generation 从 L+F 倒退 L(破坏 09 §0.1 签名域单调;终审核链确认不会使已遗忘内容复活,危害限 digest 一致性误报)——修 = per-project last-known 下限 + current.json 损坏注入测试。
- **canonical 回写一致性评审(设计库七处回写)**:0A + 5B,五条全数回修(B-1 两消息并入 PipelineMsg 判别联合防形态分叉 / B-2 tailnet S2 收据口径与 04 §5.2 PIN 行对表登记挂 R-A/R-C / B-3 R-C 登记措辞 / B-4 配对 URL"一次性"补惯例限定 / B-5 proposed 降级补"无工具面承载"限定);附注两条(05 §4 提前批 #6 的"10 §4"陈旧编号、07 §0 索引表 D2 行)已挂 R-C sweep。
- **Codex 攒批**:按轻量制度"攒批 1 次 Codex"——本批回写与 W1 批攒批合并,登记由下一轮设计库会话补发(编号顺延;W1 先例:对账会话补发 Codex 20)。
- **迟到评审回收批(`fd3918d`,收口后追加)**:三路后台分阶段评审迟到返回(此前超时判弃),与合并终审交叉比对净新增 **3A**:① tailnet 语音通道可触发 S3(requestManualMerge 挂语音工具集不判来源——修 = hub via 透传 + tailnet console 在连即拒,P0 保守宁误拒,精确 per-session 绑定留 P1);② EOU 缓存三条早退路径悬挂失效(修 = 统一重挂兜底 + 真函数悬挂测试);③ pipeline 会话绑定黏滞(修 = voice.mode 无条件重绑 sid + console hello.ack 同步)。同批回收 6B(奠基调序/拒候选不复活+去重限项目/悬挂先发后清/ntfy 失败首败即警/t2 解析炸留痕/Host 小写归一化)与 C 组(gate.sh 原子自愈+头注改口/失败码封闭联合/SteerApplied 收编 contracts)。已登记不修:ntfy 缺省公有 ntfy.sh 面(owner 已显式配自有 server;换缺省属行为变更留 R 轮)、pairUrl stdout 留存、WS query token(已核无日志泄漏)、bootstrap 同步阻塞 event loop(奠基属显式操作,登记)。**基线更新:daemon 520|4 skipped + python 20**;三路评审对阶段 0 的结论 = 0A0B3C(与合并终审一致,C 组已随本批回收)。

## 测试与门禁(本会话真实输出)

- `just ci` 双矩阵:每次提交前独立全绿(看真实退出码,D3 纪律);**收口终值 = contracts 66 + daemon 514 passed | 4 skipped(W1 基线 467 → +47)+ python 18(11 → +7)**;emoji 门禁 clean(自测 4/4)。
- `pnpm exec playwright test`:10/10(多次复跑)。
- 本批新增测试:tier1-config-validate 13 / gate-socket +1 / tier1-executor +2 / launchd-plist 3 / storage-migration-v5 4 / golden +2;**迟到回收批与第四轮终验补测后明细终值**(对账复审抽验勘误——此前明细写于收口提交、后续补测只更新了总基线):t2-thin **14** / memory-growth **12** / voice-hub **+5**(14→19,含 B1 role 自报拒连)/ python vad_handsfree **9**。

## canonical 回写清单(设计库;走一致性 subagent + Codex 攒批,编号顺延)

1. 09 §11 `[t2]` 配置键补录(tailnet_hosts 显式枚举禁通配 + listen;additive,时序如实);
2. 09 §10 `voice.mode` / `vad.speech` 两消息补录(免手档 additive;方向白名单语义);
3. 09 §9/§13:step_confirm 档执行器承载落差标 deferred(阶段 0-⑤ 核对结论)——上浮 owner;
4. 09 §13 steer 三后端能力表:steerApplied 恒 queued_delta 标注;
5. 09 §2:proposed(未批准)包的过期/作废语义缺口(场次① B3 核对:PACKAGE_TRANSITIONS 无 proposed 终态边);
6. 07 D17 状态行(launchd 已实施)与 05 §4 提前批 #1/#2/#4/#6 状态回写(留待场次验收后一并);
7. 07 D2 注:P0 免手档 VAD 引擎实现口径(能量 RMS;Silero 留升级);
8. B1/B2 正式合同(dims 最小构造 + 空账本 fail-closed;10 硬规则结果句式约束)= 设计库补丁在途,落地后按合同收口(不在本清单内重复)。

## 第四轮终验(owner 要求收口后完整复核;两路并行:缺陷终验 + 承诺对账)

- **承诺对账路**:台账 A(IMPL-5 §3 六段)/ B(场次①九项)/ C(evidence 抽验 13 条)**全 ok,零虚报零"计划有代码无"**;唯一勘误 = 四个测试计数明细滞后于补测(实多于报,已回填上节)。OctoDesk 奠基产物(current.json generation=3)本会话实读吻合。
- **缺陷终验路**:A 级零(七项红线复扫全过,基线 520|4 + 20 独立复现);**3 高置信 B 全数回修(随收口后提交)**:
  - B1:WS hello role 自报——tailnet 客户端自称 pipeline 可绕 hasTailnetConsole 的 S3 门探测并进 asr.final 白名单注入伪造转写;修 = tailnet 来源自称 pipeline 拒连(pipeline 恒同机)+ 拒连/console 照常两断言;
  - B2:奠基链两处 post-publish 抛点(端点无 try/catch 可崩 daemon;writeAgentsPointer/commitKnowledge 抛错把已发布 generation 伪装成失败——OctoDesk 首奠同族坑换了抛点);修 = 端点兜底 + 两收尾步骤降级不外抛;
  - B3:EOU 悬挂发射失败"保留 pending 但无人重挂"(闭包持旧 ws),打破 A1 立的"有缓存必有计时"不变量;修 = 发射失败如实丢弃 + 日志(诚实丢弃优于错拼;console 刷新场景另有重绑清账兜住)。
- **C 级登记(不修,防丢)**:bootstrapWithRetry 末次失败仍 sleep/对非竞态错误盲重试;hub 无 ping/pong 心跳(tailnet 死连接会让语音合并持续误拒——fail-safe 方向,P1 补);hasClaimHistory 无 (op,claim) 索引(账本上万行后建);ntfy sweep 队头阻塞面(失败条目退避/轮转);lastKnownFoundationGen 在"改工作区指向"功能出现时须同步清缓存(当前无该功能,纯理论)。

## canonical 回写落盘记录(设计库,2026-07-26;voice-coding 非 git,落盘即收)

09 §10(免手两消息并入 PipelineMsg 联合)/ §11([t2] 配置与 via 来源面 + S2 收据口径对表登记)/
§13(steerApplied 实施状态注)/ §9(step_paused deferred 状态注)/ §2(proposed 无终态缺口注);
07 D17(launchd 落地状态行 + runtime 树分离)/ D2(P0 VAD 引擎口径注)。
清单第 6 条(05 §4 提前批状态行)留待场次验收后一并;第 8 条(B1/B2 正式合同)设计库补丁在途。

## 代码提交(SHA 均为本会话 git log 真实输出)

`5391b0f`(阶段 0)/ `478864c`(A launchd)/ `27e0951`(B T2 薄版)/ `97c74cc`(C M1)/
`c87b734`(D VAD)/ `9956a70`(C 奠基健壮性修复)/ `980579d`(场次①修复批)/
`9fe7bea`(bootstrap 竞态重试)/ `d8b5025`(批末终审回修 A1+B1)。
基线 `ce24c14`(W1 收口);本文件与 HANDOFF 更新随末次 `chore(evidence)` 提交(不自指)。
备注:部分提交夹带 e2e/screenshots 基线抖动(playwright 验证副产物,反锯齿微差,无语义);
evidence 初稿曾混入 `9956a70`(两提交法轻微破例,如实记)。
