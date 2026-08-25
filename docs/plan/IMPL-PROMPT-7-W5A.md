# SayDo W5 前段批(合同就绪子集 + TTS 拍板落地)· 实施 Prompt(第七轮交接,复制分隔线以下到新会话)

> 背景:W1/W2 已收口并经 /impl-review 对账通过(evidence `w1-batch.md`/`pull-forward-batch.md`;readback 报告在设计库 research/)。排产源 PLAN-2 的下一实施批本是 W4(S3 卡+writing 窄版),但其前置 R-A 合同轮正由设计库并行进行;**本批 = W5 中不依赖 W4/R-A 的合同就绪子集**(PLAN-2 §7-8 批间重估授权的顺序调整),外加 owner 已拍板的 TTS 音色落地。估 3–5 天,做不完如实登记顺延,不硬塞。

---

你接手 **SayDo W5 前段批(W5a)**。代码仓 `~/WorkSpace/SayDo`(main 直推);设计库 `~/WorkSpace/voice-coding`(只读;canonical 回写见 §2 特别红线)。完成判定 = §3 各项验收锚绿 + evidence `e2e/evidence/w5a-batch.md` 落盘 + HANDOFF 回填(批次指针开批写 `W5a`、收口清除)。

## 0. 坐标核验(先做,漂移即停;期望值 2026-07-26 22:55 实测)

| 命令 | 期望 |
|---|---|
| `git -C ~/WorkSpace/SayDo log --oneline -1` | `086001d`(W2 第四轮终验回修)或其后 evidence 提交;工作区干净;远端已同步 |
| `rg -n "当前批次指针" ~/WorkSpace/SayDo/HANDOFF.md` | 指针为空(非空 ⇒ 有批在途,停) |
| `cd ~/WorkSpace/SayDo && just ci` | contracts **66** + daemon **521 passed \| 4 skipped** + python **20**;ci-exit=0(退出码显式核查,禁管道取尾) |
| `pnpm exec playwright test` | 10 passed |
| `git -C ~/.saydo/runtime rev-parse HEAD` | `086001d`(常驻运行时树;本批收口后 `just daemon deploy` 更新) |
| `ls ~/WorkSpace/voice-coding/IMPLEMENTATION-PLAN-2.md` | 存在(唯一排产源,§1-W5 为本批出处) |

## 1. 必读(按序)

1. `SayDo/HANDOFF.md`(§0 硬教训 / §4 铁律,含 W2 新增两条:改 DDL_V1 必配迁移、dogfood 时段不重启)+ `SayDo/AGENTS.md`
2. `voice-coding/IMPLEMENTATION-PLAN-2.md` §1-W5(5.1/5.2/5.3/5.5/5.7/5.10/5.11 行内出处)+ §4 通则 + §6(挂触发线项,**不做**)
3. 分项合同:5.1=09 §13(`explainResult` level=decisions / `openOnScreen`)+ 08 §6(任务详情行);5.2=09 §3(`decision:"edit"`/`superseded_by_edit`/重签句)+ §12-3;5.3=03 §5 + 09 §13(steer applied 词表);5.5=02 §5.1 + 09 §9 注(cache_write 列位)+ **09 §11 白名单(项目层禁键不放宽,承载=daemon 受控设置表)**;5.7=modules/b B4;5.10=`e2e/evidence/tier1-conformance.md` §3/§4 两条 [warn] + 05 §4 Gate 0 G3/G4;5.11=各行内注
4. `e2e/evidence/pull-forward-batch.md`(W2 现状边界,尤其 §S1 与 canonical 回写清单)

## 2. 红线(违反即停)

恒律全套(零 emoji / 状态词纪律 / Gate 0 无 bypass / S3 语音绝不放行 / TTS 必经 redactor / 契约只 import `@saydo/contracts` / 两提交法 / 每步独立核实 SHA / 门禁退出码显式核查)+ 本批专属:
- **不碰 console 输入区/PTT 面**(R-A 场次① UX 补丁在途,撞车即返工);
- **不碰 S3 卡/writing/类型门禁开值**(W4 域,等 R-A 合同);
- **canonical 回写攒批不落盘**:R-A 合同轮正在设计库进行,本批任何 09/10/11 回写只登记进 evidence"待回写清单",收口时若 R-A 已收口才落盘(防双写 docs/09);语义级缺口一律登记回设计库,不自定;
- 5.5 的项目级覆盖**绝不落 project.toml**(09 §11 白名单是安全面);
- 5.10 的 verify 隔离方案若触及 09 语义(如新增 dispatch 快照字段)⇒ 先登记设计库,只做实现面(env 白名单/最小 HOME)。

## 3. 任务清单(竖切,按序;每项验收锚可判定)

- **3.0 TTS 音色落地(owner 2026-07-26 拍板)**:`pipeline/src/saydo_pipeline/doubao_tts.py` voice 缺省改 `zh_female_tianmeiyueyue_uranus_bigtts`;跑一次真实合成烟测(一句话术,听感文件落 /tmp 即可);**`just daemon deploy` 重部署常驻**(部署前若 owner 在场次中先知会——HANDOFF"dogfood 时段不重启"惯例);HANDOFF §2-10 清账。验收:合成烟测 exit 0;runtime HEAD = 本批收口 SHA;§2-10 标完成。
- **3.1 verify 安全债两条(5.10;Gate 0 族,最高优先)**:① 框架 config 面——`vitest.config.ts`/`playwright.config.ts` 等可执行 config 纳入 dispatch 冻结快照(digest 随 verify argv 冻结,执行前重校不符 fail-closed)或保守拒(verify 模板引用的 config 文件白名单化),二选一并 evidence 说明取舍;② verify 执行 env 隔离——最小 env 白名单 + HOME 指向任务专用空目录(凭据面 ~/.ssh/~/.aws 不可达),破坏性动作零。验收:反例双绿(改 config 自证通过被拦;verify 进程读 ~/.ssh 失败),`tier1-conformance.md` 两条 [warn] 改 [ok] 并注修复 SHA。
- **3.2 decisions[] 摘要层 + open_on_screen 编辑器(5.1)**:`explainResult(level="decisions")` 口播接线(10 三层摘要之第三层)+ 任务详情 decisions 区(11 §5.5 证据视图内);`openOnScreen` 加 editor 深链(`cursor://file/<path>:<line>` 优先,`vscode://` 兜底,不可用回落本地 review URL——纯实现扩展,09 §13 签名不动)。验收:decisions 落库任务口播/上屏一致;深链 e2e(url 生成断言)。
- **3.3 edit 审批第四动作(5.2)**:审批卡"修改后批准"——`decision:"edit"` 原收据作废+新收据重签链(09 §3 骨架照抄;§12-3 用例补齐:edit 作废旧 nonce/新 refDigest/单次消费);console 审批页 edit 交互(S2 面;S3 不适用)。**撞合同缺口(如 edit 的 spokenForm 重渲染语义)⇒ 登记设计库 R-B,该项顺延不硬造。**验收:§12-3 正反例绿;audit 链完整。
- **3.4 steer 增量(5.3)**:`cancel_resume` 档落地(运行中改需求:终止当前 run→保留 worktree→新 spec 编译进下次 run,09 §13 applied 词表已有)+ Hopper capabilities steer 分级消费核对(现 steer=none,消费面代码就位、能力出现自动启用);Tier2 步序循环**不做**(6.10 挂触发)。验收:cancel_resume e2e(注入版);capabilities 消费单元锚。
- **3.5 项目级模型/预算覆盖 + cache_write 列位(5.5)**:daemon 受控设置表(新表走**增量迁移**,铁律)+ 项目设置页 UI(08 §6 行)+ 生效链(dialog/thinking/执行档按项目覆盖解析,家族护栏 02 §5.1 照守:evaluator 异族校验对覆盖后的组合同样跑);`cache_write_input_tokens` 列位(09 §9 注预留,additive 迁移)。成本三档预设**不做**(6.11)。验收:覆盖解析单元锚 + 同族覆盖被拒反例 + 迁移幂等。
- **3.6 产物库控制面(5.7)**:产物页时间线(version/supersedes 链)+ diff(相邻版本文本 diff)+ 子集导出(选中产物打包下载);sqlite-vec **不做**(6.7)。验收:Playwright 三交互用例。
- **3.7 微项篮(5.11 合同就绪子集;每项一句验收,做不完顺延如实登记)**:订阅限流 durable 排队重放(09 §11-5 清偿)· cursor BYOA 笼两处"实测后补"变量(09 §11 规则 3/4)· C8 成本表盘 + E3 指标完整版(08 §2;Langfuse 不引,SQL 直出)· 会话滚动 gist 蒸馏(modules/a A3)· A7 IntentLedger 独立账本(08 §2)· 评估档"读禁闭 spike"(07 D18;BYOA 走订阅零 key,花费=订阅额度声明即可)· D9 中文分词/预分词真实语料 spike(顺带消解 07/modules 的 sqlite-vec 标注冲突,结论登记设计库)· 10 §6 音频级 golden 其余项 · 11 §3 紧凑模式。`[pricing.llm]` 三键分列**跳过**(候 owner 价签)。
- **3.8 收尾**:evidence `w5a-batch.md`(各项一段:验收命令+输出摘要+SHA;含"待回写清单"节)+ HANDOFF §2 回填 + 指针清除 + `just daemon deploy` + PLAN-2 §1-W5 对应行标状态(经设计库,若 R-A 在途则连同待回写清单一并移交)。

## 4. 检查点(必须停等 owner)

① 新花费/外部副作用(预期仅订阅额度内 BYOA 调用与分钟级 ASR/TTS,超出即停);② canonical 语义级变更(一律登记回设计库,本批零 canonical 落盘——见 §2);③ `just daemon deploy` 重启常驻若 owner 正在语音会话中,先知会;④ 3.1 的 config 冻结取舍若影响 owner 日用 verify 模板,给一句说明再实施。缺省动作:无回复=暂停该分支继续其他。

## 5. 诚实汇报 + 工作方式

三级词表([ok] 可复跑证据/[warn] 差距/[fail] 原因);SHA 与测试输出来自本会话真实命令;`just ci` 每提交前必绿(退出码显式核查);两提交法(feat/fix → chore(evidence));批末 1 个 code-review subagent(A 级必修,前台;后台评审超 1 小时判超时改前台);收口后 owner 用 /impl-review 对账;竖切顺序 3.0→3.1→3.2→…,3.7 按篮内顺序,批容量不足时 3.6/3.7 尾项顺延并登记。

开始吧:先跑 §0(指针非空或基线漂移即停),读 §1,按 §3 顺序实施。
