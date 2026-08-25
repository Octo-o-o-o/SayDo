# SayDo(原 VoiceLoop)实施计划(分步骤)· v2.5

> **v2.5 变更(2026-07-24 中午,开工前锁版复审)**:全文对照 canonical(01–11/modules/ADR)重读修漂移:① 0.1 emoji 门禁改引 11 §12 收窄正则(旧 Extended_Pictographic 全类会误伤文本箭头);② 2.1 删"deletion job"(09 §4:P0 就地覆写+重放幂等,无独立 job 表)+ 补 `auto_low_impact` 机械判定器(owner 2026-07-24)+ 备份例外联动(`backup_retention_days`,10 #38 话术);③ Phase 3 前置补 SourceSnapshot/VerifiedExcerpt 最小合同回写(SOL A3,daemon 侧快照器)、3.2 补 critical-claim source 回读抽查(04 §2.2-5,P0);④ P0.5 前置②改"A7 已拍板"(04 §5.4 矩阵 2026-07-23 canonical,P0.5-C 只剩落地验证);⑤ P0.5-A 六项按 §14 真实编号列全(A2/A3/A4/A6/A7/A8);⑥ 0.1 快照备份补保留期参数;⑦ **2 subagent 对抗评审全部 A/B 级回修 + baseline.2 已交付事实刷新**(Hopper baseline.2 commit `bdd1e548…` 已 tag/词表/harness 附录,owner 侧 Hopper 待办清零)——明细见文末"评审记录";⑧ **Codex 复审(No-Go→修复→Go):A6/B20/C6 全部采纳**——切锁 commit 勘误 `bdd1e548…`、settle 复核按终态拆分、trust-report .md 映射+emoji 呈现层转换、P0.5 合并人工交接、TTS redactor、依赖图重写、工期 34–47 等,明细见文末"评审记录"与 `research/codex-findings/11-implementation-plan-v25.md`。**本版为开工锁版。**
> **v2.4 变更(owner 2026-07-24 上午拍板,Hopper 侧反馈 `docs/hopper-side-feedback-for-saydo.cursor.md` 消费完毕)**:① **Hopper 批次 A + RunSettled 已在 Hopper 侧实施**(未 commit,本会话 git 实证:HEAD 仍 `ea3fb31`、30 文件已改未提交)——**X1 拍板:锁定点条件式前移 baseline.2**(Hopper commit+tag+diff 面 → SayDo 契约测试全绿才切锁;期间 baseline.1+过渡兜底照跑,09 §11 [hopper] 写明开关);② **X3 拍板:接受双维风险边界**——content-risk(Hopper 关键词维)与 effect(S0–S3)取交集互不替代、Hopper 判 low 非 effect 背书、**high 不自动执行且 bridge 挡自动 retry**(04 §5.1/§5.4、09 §6.2 retry 闸门/§7 ready∧high 投影行、10 #30 第四分支);③ settle barrier 主判据升级为**消费 RunSettled+廉价复核**,六字段机械判定降级兜底;cancel settled 判据统一 RunSettled(09 §6.3、ADR-001 协调点 6);④ **三件 Hopper 免费资产登记**:`hopper check`=Tier1 确定性验收 oracle(09 §9,0.5 行做可行性)、`HOPPER_FAKE_SPEC` fake-runner=桥契约测试 harness(§12-8、P0.5-B)、自包含 trust-report HTML=路径二证据视图主体(05 §4、ADR-001);⑤ drop 前 `hopper lint --json` 预检(查 classification/execution_decision,不只 exit code;09 §6.2);⑥ 遗留拍板落地:备份 store 排除 hard-forget 传播+如实告知(09 §4/04 §1.3/10 #38,`backup_retention_days=30`)、observedModel 维持严格(09 §11);⑦ SOL 复核 DDL 三缺口堵死(语音收据须绑 turn_ref/遗忘事件拒空 payload/callback dedupe_key NOT NULL);⑧ **(同日晚)新增 `docs/11-ui-spec.md`(全端 UI 规范:Soft Glass token 体系承 OctoBlog、Tailwind+shadcn+Lucide、状态四联映射、零 emoji 门禁)与 `docs/modules/a–e` 五份分域详设**(每模块七栏:职责/接口引用/要点/依赖/失效恢复/§12 归属/步骤映射)——0.1/5.1/5.2/P0.5-E 已挂钩,真相源行已扩。
> **v2.3 变更(owner 2026-07-23 晚裁定)**:① **Tier1 dev 后端确认用 Cursor CLI(Fable 5)过渡**——Claude 订阅因封号推迟约 1 周购入;Fable 5 = Claude 旗舰模型,**模型质量已被 dogfood 覆盖**,唯一未跑的是 claude_sdk 的 **live-steer(流中注入)** 交互(cursor 用 queued_delta/cancel_resume 代偿),此为**时限性已知缺口、接受**,claude_sdk 四能力验证 + live-steer dogfood 顺延至订阅购入后;② **控制台 P0 不剪页(O2 收敛建议否决)**——owner:凡有价值都做,不在乎工期,但每页须有真实功能、不留空壳占位(避免低价值页的长期维护成本);现 11 页经核对均对应真实功能,全保留;③ **三盲区表态落 05**:无障碍/纯文字 = 非目标(P0,不架构性封死);应急车道、回叫聚合 = P1,各有 P0 兜底(Quick-已奠基免重研究 / 通知优先级+输出仲裁)。
> **v2.2 变更(owner 2026-07-23 下午裁定)**:① **对话档 BYOA 结案判死**(实测每轮 13–23s、resume 无收益,07 D18 结案表)——对话档恒 api,原 P2 spike 取消;② **BYOA 增 cursor_cli**(cursor-agent -p 无头一发一收,与 claude stream-json 同型,1.2b +0.5 天 ⇒ **边际合计约 2.5 天**);③ **api 供给增命名三方端点** `[providers.api.<name>]`(OpenAI 兼容 base_url + api_key env 引用 + family 显式声明,多家对比调试;0.4 校验器随之扩);④ **`profile="dev"` 本机开发档**(唯一放宽:evaluator 允许 codex_cli/cursor_cli,横幅+审计;owner 机缺省对 = thinking:cursor fable-5-thinking-max + evaluator:codex luna max,不依赖 Claude);⑤ codex reasoning 词表更正(服务端校验 none…xhigh/max,修正旧注"无 max");⑥ **Hopper 裁决终稿已回并消费完毕**(`docs/plan/2026-07-23-saydo-integration-adjudication.fable.md`,Hopper 仓)——锁定点 `ea3fb31`+tag `v0.1.0-saydo-baseline.1`(已打)回填 09 §11/模板/ADR-001;§4 批注与 §7 更正清单已逐条回填(09 §6/§7 重写、10 #30 分支话术、supersedes 改同卡修订缺省);**09 §14 A3/A4 已封闭(设计)**;正式文档更名 sweep 完成(VoiceLoop→SayDo,demo 改名 `saydo-console-demo.html`);⑦ **BYOA v2 Codex 复评已回并 triage 完毕**(`research/codex-findings/09-byoa-v2.md`:总评 No-Go → A1–A5 全部设计级回修——dev 双开关防漂移、笼分三档改名、cursor 独立 parser、family 冲突拒+observedModel 对 api 强制、billing-switch 收据;B 级并入 0.4/1.2b 验收;两处"实测失败"证据判定为复评自身沙箱伪证,本机直跑成功);⑧ **Tier 1 dev 机后端定为 Cursor CLI 订阅态**(owner:该账号 CLI 有额度、API key 无)——2026-07-23 实测通过(`research/spikes/cursor-cli-tier1/`:worktree 钩子无头触发 + deny 拦截 + 阻塞放行三测全过,零 key),D8/09 §11 DevAgentBinding(transport cli/sdk)/dev 模板/0.0/4.1 已回填;API/SDK 路径降为后续优化。
> **v2.1 变更(owner 2026-07-23 裁定)**:① 项目定名 **SayDo**,仓库 `github.com/Octo-o-o-o/SayDo`;② **首发交付 = 完整双路径**(owner:"第一次能做的更完整,不用担心判断错误浪费工作量和时间")——P0/P0.5 保留为**阶段序号与开发顺序**(依赖使然:Tier 1 先行,Hopper 桥前置 = §14 封闭 + 裁决回填),但**发布定义改为:"P0.5 收尾"行(全量 readback)完成才算首发交付**;③ 对接 prompt 升 v4(4 subagent 对抗评审后)、**立即发 Hopper**;④ 窄闭环 PoC 前移(新增 0.5 行,用 Hopper 现状 CLI 手动做,不等裁决);⑤ 配置模板已备:`templates/saydo.config.example.toml` + `templates/saydo.env.example`;⑥ **模型供给 BYOA(07 D18,owner 提出;经 2 subagent + Codex 评审回修)**:沉思/评估档可复用本地 Codex/Claude 订阅 CLI,LLM key 最少 1 个(双订阅前提)——0.4 加 ModelBinding 校验全套、新增 1.2b BYOA 后端(改造 OctoDesk bridge 四件套 + 笼子/tripwire/限流,**边际约 +2 天**计入滚动重估;acp 与 resume 砍到 P1)。
> **v2.0 变更**(据 4 subagent + Codex 07 计划评审):① **Gate 0 前移**——六项安全门禁分散到构建它的 Phase 关闭,不再堆在末尾;② P0 阶段收敛为 Tier 1 全闭环 + Gate 0 最小关闭(约 21–27 工程日),Hopper 桥/直达验收档/Demo 生成器列 P0.5 阶段;③ 新增 **Phase -1 环境与决策前置**;④ 修正依赖图;⑤ 补 spike D4/D5;⑥ 拆过大步骤;⑦ 实施期轻量评审制度。
>
> **性质**:首发是**一次完整交付**(P0 阶段 + P0.5 阶段全部做完再交;owner 在 Phase 4 出口起受控 dogfood,但不以 Tier1 为首发终点)。P0 阶段出口 = owner 能每天自用 Tier 1 闭环;**首发交付点 = P0.5 收尾全量 readback 通过**。
> **真相源**:设计以 `docs/01–11 + docs/modules/ + adr/` 为准;**schema 照抄 `docs/09`(标 [P0-Tier1 就绪] 的部分)、话术照抄 `docs/10`、界面照抄 `docs/11`(含零 emoji 门禁)**;分域详设 `docs/modules/a–e` 是每模块的实施导航(接口引用/测试归属/步骤映射)。发现设计问题先回写文档(轻量评审)再改代码。
> **协作**:遵守 `AGENTS.md`;实施期评审用下方"轻量版"(§收尾仪式)。

## Phase -1 · 环境与决策前置(owner 完成,约半天)

> 出口:下表每项打钩,AI 实施会话从 Phase 0 起不因外部前置提问。

**A 凭据与模型缺省**:① 填模板 `templates/saydo.config.example.toml`(五槽位:dialog/thinking/cheap/evaluator/models.dev;**本机开发用独立模板 `saydo.config.dev.example.toml`**)+ `templates/saydo.env.example`(key),分别落到 `~/.saydo/config.toml` 与 `~/.saydo/.env`(**owner 机已落,2026-07-23,含 `SAYDO_DEV=1` 写入 ~/.zshrc;待填 key**);确认 evaluator 与 dialog/thinking **异族**;**槽位可走订阅 CLI(BYOA,07 D18):LLM key 最少只需 1 个(dialog+cheap 的家)**;② **Tier 1 执行档 = Cursor CLI 订阅态(2026-07-23 实测通过,dev 机缺省)**:零 API key、走 Cursor 订阅额度(owner 该账号 CLI 有额度、API key 无),审批门经 worktree 钩子已验证,无需额外凭据;备选(需要时)claude_sdk(需 claude 登录/ANTHROPIC_API_KEY + "执行+评估并发"额度实测)或 cursor_sdk(CURSOR_API_KEY,后续要更低延迟时);③ **语音 key**:TTS 已定档=火山豆包 seed-tts-2.0 v3(07 D5),填 `DOUBAO_TTS_API_KEY`(=repo-demo-recorder 同款 key);**ASR 已结项(2026-07-24)**:火山 sauc 单家定档,凭据 = ASR 账号三元组 `VOLC_APP_ID`/`VOLC_ACCESS_TOKEN`(owner 已填);~~≥2 家 key 硬门~~ 取消——第二家对比 = 换 provider 门禁非开工门(Codex 12 A3);种子语料方案见 1.0 行。dialog/cheap 走 **OpenRouter**(`OPENROUTER_API_KEY`,OpenAI billing 问题的替代)——dev 机 API 侧只此一 key;④ **ntfy 已配**(SayDo 生成主题写入 `~/.saydo/.env`,owner 只需手机装 ntfy app 订阅同名主题);⑤ 若用 BYOA:确认 `codex login status` / `claude auth status` 登录态、cursor 用真实 `-p` smoke(owner 本机 2026-07-23 实测:codex [ok] ChatGPT 登录、cursor [ok] 可用、claude [fail] 未登录)。
**B 本机环境**:Node≥22 + pnpm、Python≥3.11 + uv、headless Chrome + Playwright、麦克风/扬声器可用。
**C 仓库/CI**:GitHub 私有仓 `github.com/Octo-o-o-o/SayDo` + Actions(已建);本地克隆到 `~/WorkSpace/SayDo/`——**2026-07-24 实测本地尚未 clone:授权实施 AI 自办**(`gh repo clone` + push 权限烟测,计入 0.1)。
**A 补**:对话/沉思/廉价档所属家族的 **LLM API key**(不止 Claude);**Codex CLI 可用性**(轻量评审"攒批 Codex"依赖它,不可用则降级)。
**D Hopper 前置(首发后半程的关键路径)**:**全部裁决与 Hopper 侧配合【已完成,2026-07-24 git 实证】**——裁决终稿已回(baseline.1 = `ea3fb31`);X1/X3 已回传并登记(Hopper commit `7936511`);**baseline.2 已 commit+打 tag:`v0.1.0-saydo-baseline.2`,切锁 commit = `bdd1e548f9359789497a797eda24398beba68ac5`**(annotated tag 对象 SHA ff6cee28… 不可用作 rev-parse HEAD/expected_version 断言——Codex 复审 A1 实测勘误);diff 面清单已交付 `research/hopper-baseline2-diff-manifest.md`;acceptance 标题词表 + `HOPPER_FAKE_SPEC` harness 文档已交付 `research/hopper-integration-appendix.md`(C1 渲染与 P0.5-B 契约测试的显式输入)。**剩余全在 SayDo 侧(AI 自行执行,不需 owner)**:① 物理落地【未做】——`~/.saydo/hopper-dist`(git checkout `bdd1e548…` + npm ci && build,Node≥22)+ `HOPPER_VAULT=~/.saydo/hopper-vault` + `hopper init`,bridge 启动断言 `git rev-parse HEAD`==SHA;② 契约测试对 baseline.2 全绿 → 把 09 §11 [hopper] `expected_version` 切到 `bdd1e548…`,不绿停留 baseline.1+过渡兜底(此时 checkout 对象改回 `ea3fb31`)。0.5 窄闭环 PoC 按 ADR-001 同机隔离红线**须用锁定副本**,故 D①是 0.5 的真实前置、不止 P0.5。
**E 测试资产**:指定奠基用中型仓(建议 `~/WorkSpace/Hopper` 只读)、授权 AI 自建 Tier1 小仓与 PoC 独立测试仓;**指定 dogfood 首个真实项目**(场次②起每天自用的仓);owner 录 5 条音频烟测底板(1.0/5.3 用)。
**F 决策纪律**:实施期工程 ADR 进 `SayDo/docs/adr/`(编号按实际顺序,计划里的 ADR-101/102 只是示意,撞号顺延);设计层 ADR 留 voice-coding(002 已预留给产品载体);卡点上浮格式(见文末)。
**分档**:阻塞 P0(A 凭据(ASR 已结项,单家凭据已备)+ B 环境 + C 仓库 + E 测试仓授权)→ 缺则停;可挂起(D 物理 checkout/build/init 由 AI 在 0.5 前自行完成;E 音频底板可延到 Phase 1 前)→ 先干不依赖项。**owner 侧已无 Hopper 相关待办。**

## 0. 全局约定

- **代码结构**(pnpm workspace + Python 子进程):`packages/contracts`(09 的 zod schema + digest + 状态机 + 契约测试,先行包)、`packages/daemon`、`packages/console`、`pipeline`(Python/Pipecat)、`e2e`。
- **质量门(每 Phase 通用)**:lint + typecheck + 单测 + 新增契约测试绿;`docs/09 §12` 相关条目绿;**本 Phase 归属的 Gate 0 项关闭并留证据**;自测清单逐项过 + 轻量评审 + **两提交法**(代码提交 `feat(phase-N)` → 证据提交 `chore(evidence)`,evidence 记录**代码提交**的 SHA——commit hash 不能自指,Codex 复审 B12)+ `e2e/evidence/phase-N.md`(六段:测试命令与尾行输出 / §12 条目↔测试对照 / golden 通过率 / 截图清单 / 偏离与回写链接 / 代码提交 hash)。
- **Gate 0 无 bypass 铁律**:`Gate 0 未关 ⇒ 拒 dispatch` 的检查器从 Phase 0 就存在;任何环境的 Gate 0 状态是**显式配置 + 审计事件**,代码中不存在 bypass 分支(评审最强调的一条)。
- **P0 阶段明确不做**(防蔓延;是开发顺序不是砍范围):Hopper 桥、直达验收档 + 预授权全链、Demo 生成器——**属首发后半程(P0.5 阶段),契约落地后必做**;S3 屏幕审批卡(用拒绝+降级话术)、decisions[] 口播、consolidate、sqlite-vec、多任务跨项目并行、电话、Live Activity、云 repo、S2S——**这些是 P1/P2,不在首发**。

## Gate 0 分散关闭表(每项在其自然 Phase 落实施步 + 关闭)

| Gate 0 项 | 实施落点 | 关闭证据 |
|---|---|---|
| G2 跨边界事务幂等(outbox/inbox) | 0.3 两阶段写基元 + 4.x Tier1 恢复 | §12-7 崩溃注入测试绿 |
| G3 独立 acceptance oracle | 4.1 verify 白名单执行器(与 Brain 无关判定) | §12-9 白名单外命令拒绝 |
| G4 secret/egress 隔离 | **4.1 worktree 供给时**(agent 环境剥离凭据、`.env` 读取升 S2、出口按适配器声明) | 凭据不可见测试 + `.env` 升级测试 |
| G5 canonical intent 留痕链 | **3.4 后**(A7 意图账本:转写 turnRef↔收据↔任务卡关联视图) | 一条贯通 join 查询测试 |
| G6 删除/同意传播 | 0.4 privacy 配置 + 2.1 forget_hard | §12-4 传播 + 录音/转写分别同意 |
| G1 身份/多说话人 | **1.3a**(单用户假设显式化 + PTT 窗口外/挂起态音频不产生指令)+ **4.1**(daemon HTTP/WS 调用方身份 + selected-adapter 审批门完整性——05 §4 G1 三合一) | 单用户假设显式化文档 + PTT 窗口外测试 + capability token/Origin 反例 + canary 反例(P0 无声纹,不做"软过滤"绿测) |

5.3 因此退化为"逐项**出示证据**"(审计复核),不是"逐项补课"。G1 的 P0 关闭口径按 `docs/05 §4` 最低交付:**单用户假设显式化文档 + S3 只走屏幕(已有 CHECK 测试)+ "PTT 窗口外/挂起态音频不产生指令"测试**(P0 无声纹/说话人分离,不造假"软过滤"绿测;真软过滤待所选 ASR 具备说话人标签能力再升级并回写 05)。G2/G5 跨两阶段:P0 关 Tier1 半边并留"基元级证据",跨域半边在 P0.5-B 以 **§12-7 跨域子集(dispatch binding/hopper_commands 重放)+ §12-8** 重新出证据(evidence 分行标注)。

---

## P0(约 21–27 工程日关键路径;单人 AI 主力可压缩):Tier 1 全闭环,owner 可日用

### Phase 0 · 工程底座与契约包(3–4 天)

| 步 | 内容 | 验收/自测 | 执行 |
|---|---|---|---|
| 0.0 | **Tier1 执行后端冒烟(多后端,2026-07-23 起)**:(a) **cursor_cli = dev 机缺省,审批门冒烟 2026-07-23 已通过**(`research/spikes/cursor-cli-tier1/`:beforeShellExecution 钩子无头触发 + `--force` 下 deny 拦截 + 阻塞等待放行,零 API key 走订阅)——0.0 只需在真实多步执行任务里补验 setup/push 钩子覆盖面 + `--resume` 恢复;(b) **claude_sdk 四能力冒烟**(streaming input / canUseTool 阻塞 / resume / **live steer**)——产品缺省路径,**顺延至 Claude 订阅购入后(约 1 周,owner v2.3)**,含 live-steer dogfood;(c) cursor_sdk(API key)后续优化,脚本备 `research/spikes/cursor-sdk-tier1/`。**至少一个后端成立即可开工**(适配层按 canUseTool 语义抽象,tier1_runs.adapter 承载);皆不成立才停止上浮 owner | (a) **setup/push 钩子触发证据 + `--resume` 续会话成功各一条**(钩子门 deny/放行 spike 已有,不重跑充数)或 (b) claude 四能力各一条脚本通过 | AI |
| 0.1 | 脚手架 + 工程版 AGENTS.md + `just dev`(一键起 daemon/pipeline/console)+ **JSONL 结构化日志底座**(E3;11 §8 风格,审计 sink 与日志分流)+ **pnpm+Python 双运行时 CI 首跑**(仓库与 Actions 已在 Phase -1 C 建好;万一 Actions 不可用,本地等效判定=`just ci` 双矩阵全绿留证)+ SQLite/JSONL/knowledge 定时快照备份(保留期 `backup_retention_days`=30,09 §4 备份例外:hard-forget 对备份=登记待过期)+ **UI 底座按 11 §1/§12**(Tailwind v4 + shadcn/ui + lucide-react;`tokens.css` 照抄 11 §2;**零 emoji CI 门禁用 11 §12 收窄正则**——封真 emoji+勾叉警告符号区,放行 `→`/`↔` 文本箭头) | CI 双矩阵绿(或本地 `just ci` 等效留证);`just dev` 起三进程;emoji 门禁自测(注入固件红、箭头不误伤) | AI |
| 0.2a | contracts:09 全类型(zod)+ JCS + 三 digest 签名域 + §0.1 生成-校验矩阵 | §12-1(digest 确定性/跨状态不变/grant 篡改拒绝) | AI |
| 0.2b | contracts:EffectGrant fail-closed 校验器 + 收据状态机(§3)+ TaskCard 状态机(§6.1)+ **`renderSpoken` 纯模板函数落 contracts 包**(反例⑤要用,3.4 的 E2 复用同一实现,不重建) | §12-2 预授权反例 **Tier1 校验器子集 = ①–⑤/⑨/⑩**(grant 实例类⑥⑦⑧随 P0.5-C)、§12-3 收据转换 | AI |
| 0.3 | 存储:09 §9 DDL 迁移 **v1 = 全集建表**(与 09 "v1=本表全集"注释一致;dispatch_bindings/hopper_commands 两张空表零成本建好,**其读写路径属 P0.5-B**,P0 不实现)+ **sqlite3 可执行 + CHECK/NOT NULL 拒非法行**(已验)+ schema_migrations + DAO + audit_log + outbox 部分唯一索引 + **Tier1 本地 invocation journal + 崩溃重放基元**(`tier1_runs`)+ TS↔DDL round-trip 测试 | §12-7 的 **Tier1 子集**(kill -9 注入)、round-trip、非法直写被拒 | AI |
| 0.4 | 配置解析(项目>全局)+ ModelBinding(api/agent_cli 双供给 + `[providers.api.*]` 命名端点,09 §11)+ 校验器全套(evaluator 异族按 familyOf 解析后判、**family 冲突拒(前缀表优先,复评 A4)**、api/cursor/acp 模型名解析不出拒、dialog 拒 agent_cli、evaluator 拒 codex/cursor(default)、**dev 双开关**(config+`SAYDO_DEV=1`,单开关拒,复评 A1)、acp P0 拒)+ BYOA 探测(只探配置引用 binary,5s+重试一次;`codex login status`/`claude auth status`;**cursor=status+真实 -p smoke,keychain 错误分类,复评 B4**)+ **处方化报错**(一次列全、每条给可粘贴修复行、结合 .env 现状;**"无订阅仅 1 key"fixture,复评 B6**)+ privacy 键(**G6 一半**) | §12-9 **配置/启动子集**绿(校验器反例 + dev 双开关 + family 冲突 + 两份模板 TOML 解析与 effective binding;argv 快照/tripwire/observedModel/billing-switch 等运行时项随 1.2b/4.1 关闭) | AI |
| 0.5 | **窄闭环 PoC·手动版**(与 0.x 并行,不阻塞出口;3–4 天):用 **Hopper 现状 CLI** 遥控完成一个真实小任务(stdin drop→run→blocked 应答→review approve→merge),对照 05 §3 八条逐条记"现状能/不能+证据";**手写任务卡先过 `hopper lint --json`**(查 classification/execution_decision,09 §6.2 预检合同第一次真用);**顺做 `hopper check` 可行性验证**(对 Tier1 式产出跑 `--staged --criteria -` 四闸门,喂 acceptance[],验"确定性验收 oracle"成立,09 §9);结论回写 09 §14(以既定裁决验证现状,留 PoC 证据) | 八条对照表 + 全程命令记录(P0.5-D 用 bridge 复跑同样八条)+ lint/check 各一份 JSON 证据 | AI+[owner 抽查] |

**出口**:contracts + storage 全绿(0.5 不算出口条件);此后不得自定义 09 已有类型。

### Phase 1 · 语音管线与最小对话(5–7 天)

| 步 | 内容 | 验收/自测 | 执行 |
|---|---|---|---|
| 1.0 | ~~ASR 定档 spike(07 D4)~~ **已结项(2026-07-24)**:60 条种子语料(TTS 合成变速档)火山 sauc **单家定档**(owner 提供 ASR 账号三元组解锁;热词偏置实证 +10 点术语召回;ADR-101 @ SayDo 仓 docs/adr + e2e/spikes/asr-1.0);**第二家对比(gpt-4o-transcribe)与完整 300–500 条真实 golden = 换 provider 门禁,非 P0 开工门**(原"候选 ≥2 家"硬门取消——Codex 12 A3 权威统一);TTS 首包 p50=202ms 达标(07 D5 调参顺做) | ~~两家跑分表~~ 单家定档 + 跑分表已出;TTS 首包 SLO 达标;[owner 听感抽查待真人场次] | AI+[owner 听感抽查] |
| 1.1 | **D2 去留 spike**:Pipecat 打断截断已听历史(watermark + unheard);本地兜底链(`say`+MLX)先跑,不达标切 LiveKit(记 ADR-102) | 音频级:打断后 unheard 不进事实 | AI |
| 1.2 | pipeline 进程:09 §10 WS 契约(sessionId/seq/health + 版本/重连)+ console **最小音频页**(开麦/PTT/转写流;**daemon 连接预留 capability token 参数位**——形状先定,4.1 才启用校验,防 5.x 返工)+ **测试音频注入通道(三类事件可注入:asr.final / barge_in / tts.playout watermark**,供 1.1/2.4/**4.2 打断作废**/5.3 音频断言一人可跑)+ E1 provider 抽象(统一超时/重试/降级)+ C8 记账接线(ASR 分钟/token/TTS 字符入 cost_entries) | WS 契约测试;注入通道三类事件用例各一 | AI |
| 1.2b | **BYOA 供给后端**(07 D18;可与 1.3 并行):改造 OctoDesk `engines/bridge/`(**按四层拆:core 解析器/适配器可搬,spawnSupport/agentDiscovery 有 Electron 传染需重写,discovery 现把 cursor 映射为 ACP——复评 B3;砍单**:resume 三件套/reverse-MCP/plan-mode/17 家扫描表)+ **cursor_cli 适配**(+0.5 天:**独立 raw NDJSON parser,顶层 tool_call started/completed,未知事件作废 fail-closed(复评 A3);golden fixtures 读/写/shell/MCP/未知/解析异常六类**;--trust/偶发网络重试墙钟 120s+单次重试)+ `buildCageArgv()` 纯函数(codex/claude/cursor 三档笼,09 §11-4;**codex reasoning→`-c model_reasoning_effort` 映射,复评 B9**)+ tripwire(tool_call ⇒ 作废+审计)+ observedModel 族断言(**含 api 响应体 model 提取——OpenAICompatAdapter 现状不提取,复评 A4**)+ 限流识别与 **billing-switch 一次性收据**(`subscription_rate_limited` → waiting_confirmation → 收据原子消费,无收据不产生 api 计费行,复评 A5)+ 订阅记账(source='subscription',显示"订阅额度内";DDL CHECK,复评 B2)+ **深评调用律**(去重/上限/冷却,复评 B1)+ **invocation 审计记录**(profile/argv digest/笼档/observedModel/tool 计数,复评 B7)+ **命名 api 端点**(base_url/api_key/family 解析)+ spawn env 白名单透传(CODEX_HOME/CLAUDE_CONFIG_DIR,09 §11-3)+ **奠基只读例外笼变体**(只读仓 cwd + claude `--tools "Read,Glob,Grep"`,07 D18 唯一例外,2.3 消费);**边际估 2.5 天为下限,按行内工作量实际 4–6 天,四层拆分后滚动重估** | argv 快照(含 cursor+effort 映射);tripwire/限流/收据竞态故障注入;cursor 六类 golden;真实 codex(沉思档)+ claude(评估档)+ cursor(dev profile)各跑通一次;三方端点 family 缺失/冲突拒启动 | AI |
| 1.3a | A2 会话管理器:建立/挂起/重建 + TranscriptTurn 落盘(**含 lane 字段埋点**,价值证据轨用);**G1 身份(语音半边)**:单用户假设显式化 + **PTT 窗口外/挂起态音频不产生指令**(P0 无声纹,不做"软过滤",05 §4 口径) | 断/重建上下文连续(packDigest 一致 + turnId 连续);PTT 窗口外音频丢弃测试 | AI |
| 1.3b | A3 对话引擎:对话档接入 + **工具路由(照抄 09 §13 契约;`createTask` 的 daemon 侧文本模型起草、`getStatus` 的 TaskView 最小字段(§13 已定)、`openOnScreen` P0=本地 review URL 各给显式 handler,Codex 复审 B3)** | 工具入出参符合 §13(含三工具显式用例);桩 Context Pack | AI |
| 1.4 | 10 §4 instructions 落地(编号展开为自包含文本)+ **共享 TTS 脱敏 redactor**(data-class:token/secret/客户数据/完整路径永不进语音,10 §1;审批播报与溯源共用)+ golden 文本注入框架 + 5 条(采访/不置可否/状态词)+ **脱敏反例 3 条(#19/#37/#39 各一)**;**P0 golden 只跑 step_confirm 与 mode 无关分支**(直达档分支随 P0.5-C 启用) | golden 5/5(模板要素 + 状态词零违规)+ 脱敏反例 3/3 | AI |

**出口 [owner 场次①]**:戴耳机与 Brain 采访式对话,打断正确、挂起重建无缝;owner 抽查语音体感。

### Phase 2 · 记忆域最小可信(3–4 天;2.1–2.3 可与 P1 并行,2.4 前置=1.2)

| 步 | 内容 | 验收/自测 |
|---|---|---|
| 2.1 | B2 记忆账本:写路径(candidate→trusted;**`auto_low_impact` 独立机械判定器**,owner 2026-07-24:source∈{git-tracked repo_file,user_edit}∧事实性陈述,指令词/第三方降 candidate,不经 Brain)+ M0 红线 + **forget_hard(tombstone 带 target ids/digests + generation,就地覆写 + 重放幂等;P0 无独立 job 表,09 §4)**+ **备份例外**(备份登记待过期、`backup_retention_days` 到期整份删,话术 10 #38 如实告知)(**G6 另一半**) | §12-4 全绿(含崩溃相位重放 + 空 payload 遗忘拒绝 + auto_low_impact 判定器正反例) |
| 2.2 | **FTS5 分词 spike(07 D9)**:trigram 缺省起步,语料分两批(先 voice-coding 文档、2.3 奠基后补测);B1 ContextCompiler(确定性**七规则**——M7 2026-07-25 增⑥装配序/⑦驱逐 + snapshot 落 `context_snapshots` 内容表+`context_snapshot_uses`,M1 拆表;**验收补 prefix-diff:相邻两次编译易变字段位于公共前缀之后**)+ **B5 检索**(FTS + `rg` 现读组合 + provenance/freshness 硬过滤) | 同输入同 digest;excluded 记录;freshness 过滤测试 |
| 2.3 | B3 奠基器轻量版:**预算化奠基**(时间/token 上限可配,超限产 partial manifest + 进度话术)+ generation 原子切换 + 预热(git diff 种子)+ knowledge git 版本化 | 中型仓缺省预算内完成;大仓超限如实降级;预热增量 fixture 断言 |
| 2.4 | M0 热词积累 + ASR 偏置接线 + draft 项目全流程(开口即建→识别回填→**转正(promote)在 2.3 奠基后或首个决策包后触发**(09 §13)/re-anchor **提议+确认**) | 误听纠正→热词生效;re-anchor 候选并入测试 |

### Phase 3 · 采访、就绪与决策包(Tier1 范围)(4–5 天)

> **开工前先回写一次 09**(半天内):SourceSnapshot/VerifiedExcerpt 最小合同(A5 引证快照——daemon 侧解析与 quote 比对,**不让 evaluator 自由浏览文件**;SOL A3 项,modules/a-dialogue A5 开放项)——走轻量评审,定稿后 3.2 直接消费。

| 步 | 内容 | 验收/自测 |
|---|---|---|
| 3.1 | A4 采访策略:覆盖扫描 + Impact×Uncertainty + **"值得问"机械定义**(只问改变 outcome/scope/acceptance/风险级/执行路径或消除 critical unknown 的问题,04 §2.1)+ 问题预算(参数入 config)+ 选项≤3 + **Quick 直通判定**(05 §4 P0 保证:已奠基项目"就做 X、现在"即刻派单,不因采访姿态阻塞;问题带目标字段标签埋点)+ 真 Context Pack 重跑 1.4 golden | 预算耗尽必停;golden 采访 3 条(真 Pack)+ **Quick 直通 golden 1 条** |
| 3.2 | **A5 就绪评估器(独立)**:分层评估(规则层每轮免费,异族深评触发式)+ critical 硬门槛 + 只读隔离 + **critical-claim source 回读抽查**(04 §2.2-5,P0:按 SourceRef 回读原文,不符 ⇒ conflicting → gap_critical)+ shadow 落盘(`readiness_assessments` 表 09 §9 已定义,直接用) | critical unknown⇒不就绪;评估器读不到 Brain 自辩(接口隔离测试);**篡改 claim 状态但 source 不符 ⇒ gap_critical 反例** |
| 3.3 | A6 决策包工厂:组装 + 签署(digest)+ plan 落 artifact;**Money 接线**(cost estimate 用 known/asOf 结构;**开工前先回写 09 定 `[pricing]` 最小合同**——模型/ASR/TTS 单价 + currency + asOf,轻量评审;无表项即 unknown 不编数,Codex 复审 B6);**B4 产物库写入**(artifact digest 校验 + version/supersedes 链;daemon 内部 DAO,modules/b-memory B4) | §12-1 相关;cost unknown 不显示 0;产物版本链测试 |
| 3.4 | E2 策略引擎(effect 推导 + **效果升级规则**:.env/敏感升 S2、postinstall/CI 升级;spokenForm 渲染**复用 0.2b 的 renderSpoken**)+ 拍板流程(**P0 单档:固定逐步确认、不询问两档**——中性二选一话术随直达档 P0.5-C 启用,10 表内混合行按 mode 拆分期)+ dispatch_package 收据签发(**接入 0.2b 校验器 + 0.3 CHECK,不重建第三层**);**G5 意图账本关联视图** | §12-3;S2 效果升级测试;**effectPolicyVersion 变 ⇒ 旧包拒 dispatch(§12-1 子项)**;贯通 join 查询 |

> 注:P0 **只做逐步确认档**(每个 S2 语音确认);直达验收档 + 预授权 EffectGrant 全链是 P0.5-C(04 §5.4;§14-A8 指的是"完整 E2 签名 presentation",随 P0.5-A,勿混)。3.4 的收据/矩阵/升级规则 Tier1 就要用,故在 P0。

### Phase 4 · Tier 1 执行 + 回叫(Tier1 范围)(5–6 天)

| 步 | 内容 | 验收/自测 |
|---|---|---|
| 4.0 | **selected-adapter 脚本级预检**(评审 B-5 修正:真实 worktree/审批闭环 4.1 才存在——本步只做脚本级前置:dev=cursor_cli 钩子门+resume 脚本复跑、版本断言;claude_sdk 四能力**顺延至订阅购入,不预设"已冒烟"**);**全链复验 = 4.1 出口验收项**(conformance 报告在 4.1 末产出);所选后端不符 ⇒ 停止上浮(风险表),未选后端顺延不停 | 脚本级预检记录;conformance 报告随 4.1 出口 |
| 4.1 | C2-Tier1:执行器适配层(接口=canUseTool 语义;后端 claude_sdk=产品缺省 / **cursor_cli=dev 机缺省,已验证**——cursor 审批经每任务 worktree `.cursor/hooks.json` 的 beforeShellExecution 阻塞钩子回连 daemon 审批 socket,**fail-closed 四律**:只依赖 deny / jq 构造 JSON / 超时=deny / 每条命令独立审批(禁便车);steer 按 §13 应答 queued_delta/cancel_resume;吞模型切换与重连提示)+ streaming + worktree 供给(setup **缺省 --ignore-scripts**)+ **G3 verify 白名单执行器(+ 内容冻结:dispatch 冻结 argv+脚本 digest、执行前重校、不符 fail-closed)** + **G4 secret/egress 剥离(cursor 后端 egress=uncontrolled 如实声明、证据按后端分行)** + **审批门完整性**(决策走 daemon socket、gate 在 agent 不可写目录、**tool_call 无 hook 回调的 canary ⇒ 立即 cancel**、**`cursor-agent` 版本 pin 手段=锁定二进制副本 + 启动版本断言 + 升级走"重跑门禁仪式"**,禁自更新生效路径)+ **Plan Delta P0 承载**(verify 内容冻结拦下 agent 合法改验证脚本 ⇒ 转 blocked 回叫"要改验证命令,需要你重新拍板"→ 新 revision 重签,**不静默放行不静默死**,04 §5.4/05 §4-G3)+ **daemon HTTP/WS 身份(G1 网络半边:capability token 启用校验(1.2 已留参数位)+ Host/Origin 白名单 + 写工具主体绑定)** | 改文件→verify 绿;白名单外拒绝;凭据不可见 + `.env` 升级测试;**cursor_cli hooks 审批门 e2e(deny 拦截 + 阻塞放行,复用 spike run.sh)+ 反例:改 gate 后 canary 触发 cancel、改 test 脚本被 digest 拦→Plan Delta 回叫、跨站/DNS-rebinding 调 daemon 被拒**;**selected-adapter conformance 报告(4.0 挂账)** |
| 4.2 | C5 审批服务:收据全生命周期(超时按档/单次消费/nonce/S3 CHECK)+ canUseTool 接 E2(逐步确认档上浮)+ **S2 打断即作废最小版**(确认播报 sentenceId 关联收据,收到 barge_in 置 presentation 失效、必须重播才可消费;完整状态机 P0.5-A)+ **三熔断**(活跃墙钟停表 + 回合 + 成本)+ 停靠老化 72h | §12-3;熔断注入;停靠老化;音频烟测:打断后裸"好"不消费 |
| 4.3 | C6 摘要器(规则统计 + one_liner/walkthrough 判别联合 + decisions[] **采集落库**)+ C7 启动对账 + preflight + 电源断言(caffeinate) | kill 重启恢复/降级;摘要数字=规则统计;preflight 项 |
| 4.4 | C4 回叫(outbox 状态机:dedupe/settle 缺一不叫/取消冻结/DND;升级链 语音→桌面→ntfy)+ 重建接通(第一句=原因)+ 输出仲裁 | §12-5;免打扰补叫;走开→回叫→接通 |
| 4.5 | steer(运行中注入)+ blocked 应答 + **Tier1 取消全链**(cancelTask → cancel_requested → `Tier1CancelProof` 齐备 → cancel_settled;旧 run 晚到事件转历史不回叫——owner 日用基本操作,§12-6 Tier1 子集)+ **验收裁决与人工合并链**(reviewTask 三态 approve/request_changes/reject + 返工 attempt+1 复用 worktree + requestManualMerge + MergeProof watcher(treeSha 匹配才 task_done)+ retryTask,09 §13/§6.1)+ **E2E:故事一 Tier1 逐步确认版** | E2E 绿;golden 执行中/回叫话术 6 条;**取消 e2e(proof 齐备/晚到转历史)**;**§12-10 reviewTask/MergeProof/AcceptanceCheck 条目绿** |

**出口 [owner 场次②]= 受控 dogfood gate**(非正式交付):轻任务全闭环(不依赖 Hopper),owner **在受控范围开始每天自用**;所有 Gate 0 项已关闭(dogfood 合法)。**P0 阶段出口 = Phase 5 出口(§5.4 总验收通过);首发交付点 = P0.5 收尾**。**+ 价值证据轨周报(建议性,05 §价值证据轨)**:此场次起挂一页零成本 SQL 周报(双北极星 proxy + 返工率/接通率/自发选择率 + review 检错仪式),喂 §6 未决项与 P1 排序,**不作 stop/go 门**(owner v2.3 不因工程完成自动判价值成立)。

### Phase 5 · 控制台、Gate 0 复核与 P0 总验收(4–5 天)

> **控制台 P0 = 全量页(owner v2.3 裁定,不剪)**:11 页(Dashboard / 对话 / 任务看板 / 任务详情·review / 记忆 / 产物 / 项目设置 / 审批 / 通知 / 成本 / 全局设置)经核对均对应真实功能,全部 P0 交付;纪律 = **每页须有真实功能,禁空壳占位**(低价值页的长期维护成本 > 首次开发省的工期)。评审 O2"收敛到 6 页"建议**否决**。

| 步 | 内容 | 验收/自测 |
|---|---|---|
| 5.1 | D1 控制台接真数据·全局区(Dashboard 主入口/待处理聚合/项目卡 + 审批/通知/成本/设置);**视觉照抄 11**(StatusChip 单源映射 11 §2.6/组件约束 §5) | Playwright 冒烟:各路由渲染 + fixture 一致;**截图基线(亮暗)首录,11 §12** |
| 5.2 | D1 项目区(对话页/任务/记忆/产物/项目设置)+ 切换器(切项目不断会话)+ review 证据视图(按验收标准组织 diff/测试/decisions[]/未验证项,形态照 11 §5.5;**trust-report iframe 组件本步只建壳**,真实渲染验证挂 P0.5-D——P0 无 Hopper 任务可验)| 切项目不断会话自动断言;证据视图零外部跳转;**截图基线补全项目区(合计亮暗各 11 页,11 §12)** |
| 5.3 | **Gate 0 六项逐项出示证据** + §12 相关全绿 + golden **按 10 §6 覆盖矩阵**全过(含逆风:Gate0 拒绝/预算不足/撤回/熔断)+ 音频烟测 5 条(owner 底板) | Gate 0 checklist 每项绑测试名;覆盖矩阵全过 |
| 5.4 | **P0 阶段总验收**:01 §5 故事一 Tier1 版完整闭环(ready_for_review→人工合并→task_done;除 S3 与开麦不碰键盘)×3 稳定复现(**AI 用注入通道跑,真麦体感归场次③**)+ P0 readback 对账(实现 vs 09/10,偏离回写) | 3/3;readback 零未解释偏离 |

**出口 [owner 场次③]**:P0 阶段完成,可日用 + 界面可视(首发继续推进 P0.5 阶段)。

---

## P0.5 · 首发后半程(约 8–12 工程日,评审 B-3 重估):Hopper 桥 + 直达验收档

> **属首发交付范围**(owner 2026-07-23 裁定),不是可选的第二次发布;做完 P0.5 收尾才算首发交付。**dogfood 反馈非门**(评审 B-6):owner 自用反馈异步攒批消费,不阻塞 P0.5-A 开工。

> 前置:① `docs/09 §14` 的 A2/A3/A4/A6/A7/A8 逐项封闭——**A3/A4 已按裁决封闭、A7 已 owner 拍板(2026-07-23,04 §5.4 矩阵 canonical),A6 完整形态已降 P1(2026-07-24,§14-A6)**,实现期补 validator+正反例即闭环;A2/A8 本地项随 Phase 编码封闭;② baseline.2 切换完成(**Hopper 侧已交付:baseline.2 commit `bdd1e548…` 已打 tag、diff 面与词表/harness 附录在 research/**——SayDo 契约测试全绿即切;不绿则按 baseline.1 过渡兜底合同先行,09 §11 [hopper] 开关)。**封闭纪律(Codex 复审 B2 澄清)**:P0.5-A 自己就是封闭动作(写合同/validator/正反例),不受门约束;**门设在运行时行为路径**——未全绿不启用 dispatch/不进 P0.5-D。

| Phase | 内容 |
|---|---|
| P0.5-A 契约封闭 | 按 §14 收口(编号对齐,评审修正):**A2** presentation 状态机完整形态(presentation digest+nonce、heard/invalidated、parentReceiptId、per-subject CAS)、**A3** 跨域 exactly-once(validator+正反例,expired≠失败对账)、**A4** Hopper 状态 total mapping + cancel settled=RunSettled(validator+CancelProof 正反例)、**A7** 模式×后端矩阵落地验证(拍板已毕,capability 握手照答)、**A8** 完整 E2 签名 presentation(project/task/effect/target/downstream/expiry 六字段 + TranscriptTurn presentation id + golden 断言无 receipt/package/tool 状态变化);~~A6 完整形态~~ 已降 P1(单机低价值维护,§14-A6);每项补正/反例测试 |
| P0.5-B Hopper 桥 | **启动 capabilities 握手断言**(bridge 第一调用 `hopper capabilities --json`:commit 锁定点 + settle_event/steer 能力分级,断言失败 fail-closed 拒 dispatch,09 §11)+ C1 任务卡渲染(acceptance 标题按词表,**输入=research/hopper-integration-appendix.md**)+ **drop 前 lint 预检** + drop 两阶段 + **scan/run 驱动链**(bridge-driven:drop→scan→queue explain→`hopper run <task-id>`;baseline.1 兜底 `drain --max 1`)+ C3 事件消费(cursor/半行/损坏/未知类型/**RunSettled 消费+廉价复核**/settle barrier 兜底)+ hopper_commands journal + cancel/review/merge/retry(CAS 预检 + voided_by_conflict + **retry 闸门:high 不自动 retry**)+ approve→**人工合并交接**(approve 附收据;P0.5 与 Tier1 同构走 requestManualMerge + MergeProof watcher,**SayDo 不自动调 `hopper merge`**——S3 屏幕审批卡 P1 落地前无合法 S3 merge 授权来源,Codex 复审 A5)+ **C8 路径二 per-task 成本对账**(dispatch_binding taskId↔runId + `show --json` last_run_cost 累加,04 §6);**§12-2/6/7(跨域子集)/8 全绿**(**harness=`HOPPER_FAKE_SPEC` fake-runner,对锁定二进制 CI 确定性跑、零 LLM 成本**;若停留 baseline.1 兜底分支:§12-8 降级为 mock 事件流 harness+人工核对,或上浮 owner 裁决切 baseline.2;risk 双维反例 + 04 §5.4 反例集=对接验收项;fixtures/migration-samples 作 C3 种子;capabilities 断言正反例) |
| P0.5-C 直达验收档 | EffectGrant 全链(E2 推导 + spokenForm 渲染 + 念清单话术 + preauthorized 子收据 + ttl 复验)+ **"同一意图被拦 ≥2 次才叫"拦截计数**(04 §5.4 直达档语义)+ 模式×后端矩阵落地;§12-2 全反例(补 ⑥⑦⑧ grant 实例类) |
| P0.5-D 窄闭环 PoC·bridge 版 **[owner 场次④]** | 05 §3 的 8 条验收在真实 Hopper(锁 SHA/专用 vault/版本断言)经 bridge 跑通(复跑 0.5 手动版同样八条)+ 升级仪式演练 + **trust-report iframe 对真实 run 渲染成功**(5.2 挂账)+ owner 现场过直达档念清单与 Hopper 全链(首发最终发布裁决点；场次①–③仍是必需真人验收) |
| P0.5-E Demo 生成器 | 决策包 HTML Demo(mock + plan.seq 互引)+ 控制台展示;**视觉按 11 §7**(控制台 demo 已 2026-07-24 对齐,不在本步) |
| P0.5 收尾 | 全量 readback;golden 补 P0.5 场景(直达档/Hopper 回叫);**价值证据轨第二锚点**(05 §4:周报口径复核 + 埋点数据齐备性检查) |

## 依赖图(修正版)

```
Phase -1(owner)──▶ Phase 0 底座
Phase 0 ──▶ Phase 1 语音 ──▶ Phase 3 采访/决策包 ──▶ Phase 4 Tier1 执行+回叫 ──▶ Phase 5 控制台+总验收
        └─▶ Phase 2 记忆:1.2(provider)→ 2.1 → 2.2 → 2.3(沉思档=1.2b 或 api key;B4 最小写入随 2.3 先行,完整版本链 3.3)
             2.4 前置 = {1.2 注入通道, 1.3a 会话, 1.3b 工具面, 2.1 写路径};项目转正(promote)延到 2.3 奠基后或首个决策包后(09 §13)
Phase 3 依赖 {Phase 1, 2.2, 2.3}(真实 B2/B5/pack);3.1 依赖 3.2 核心读口(A4 覆盖扫描消费 A5 证据缺口)
Phase 4 内序:4.2 收据裁决核心 → 4.1 出口 E2E(canUseTool 接 E2 才有真实审批闭环);4.2 也是 P0.5-B(merge/CAS)前置
P0 完成(可日用)──▶ P0.5-A 契约封闭 ──▶ B/C ──▶ D(依赖 B∧C)──▶ E/收尾(dogfood 反馈异步攒批,非门)
```

**工期口径(评审 B-3/B-4 重估,单人 AI 串行)**:"并行"只是排序自由,不抵扣工时——0.5(3–4 天)与 1.2b(2.5–6 天)全部计入串行总量。**P0 单人串行 ≈ 34–47 工程日** = 各 Phase 步骤(24–31)+ 0.5/1.2b 并行行归还(+7–10)+ 每 Phase 收尾仪式与评审(0.5–1 天 × 6 = +3–6);P0.5 ≈ 8–12 工程日(Codex 复审 B13 校算)。**Phase 0 末执行首次滚动重估并回写本段**(唯一工期口径;旧"21–27"为关键路径下限口径,保留作参照不作承诺)。

## 风险与调整规则

| 风险 | 预案 |
|---|---|
| Pipecat 打断 spike 失败 | 1.1 当天切 LiveKit(ADR-102),影响面限 pipeline 包 |
| ASR/TTS 首包/中文不达标(D4/D5) | 供应商候选表 + Kokoro 本地兜底验收线;golden 用真实误听积累 |
| FTS5 中文召回不达标 | trigram→simple 扩展→预分词;最坏 rg-only + 结构图 |
| **所选 Tier 1 后端**(tier1_runs.adapter)conformance 不达标 | 0.0 冒烟即验**所选后端**(dev=cursor_cli 钩子门+setup/push 覆盖+resume;产品缺省=claude_sdk 四能力);**所选后端任一能力不成立 ⇒ 停止并上浮 owner**;**未选中后端**(如 claude_sdk 顺延至订阅购入)验证顺延**不触发停止**;claude_sdk 单独不成立 ⇒ 上浮定产品缺省后端归属(联动 v2.3①/§G2);live steer 不支持按 §13 `queued_delta/cancel_resume` 降级并如实告知,不静默 |
| Hopper 裁决与 09 冲突 | 只改适配层(C1/C2/C3);§14 封闭前不进 P0.5 编码 |
| golden CI flaky | 对话档模型 pin + 温度 0;真实 E2E 分层(mock 每次/真实 nightly)+ 预算上限;音频烟测本地跑留证不进 CI |
| Python/Node 混仓 CI | 0.1 就跑通双矩阵,不拖到 P1 |
| **cursor-agent 升级破坏 hooks/事件语义**(自更新) | 锁定二进制副本 + 启动版本断言(4.1 pin 手段)+ 升级走"重跑门禁仪式"(spike run.sh + 六类 golden 全绿才换);canary 只兜运行时逃逸,不兜事件形态漂移,故版本断言不可省 |
| **OctoDesk bridge 四层拆解超预期**(1.2b) | 降级路径:先交付 codex/claude 两适配跑通沉思/评估档,cursor parser+golden 顺延半个 Phase;dev profile 期间 thinking 临时走 api(OpenRouter)兜底 |
| **owner 场次验收不过**(①②③④) | 每场次预设"不过退出条件":一次针对性返工后复验;再不过 ⇒ 上浮拍板(降级验收线/换供应商/调范围),不进入无限返工循环 |

## 每 Phase 收尾仪式(固定;实施期轻量评审)

1. 自测清单逐项过(表"验收/自测"列;标 [owner] 的攒到 owner 场次)。
2. **轻量评审**(按改动类型分级,非每 Phase 全套):纯代码→1 个 code-review subagent(A 级必修);**回写 09/10 等 canonical→1 subagent(一致性)+ 攒批 1 次 Codex**;spike ADR→Codex 一次或 owner 直批;journal/证据→免评审;战略/范围→上浮 owner。
3. 修复后再测 → commit(`feat(phase-N): … + 验收证据摘要`,引用 `e2e/evidence/phase-N.md`)。
4. **下一 Phase 前重估**:对照已实施内容,判断本 Phase 计划是否还值得做/要调整/影响后续;有明确建议按建议继续,需 owner 拍板的攒成"完整问题+建议"再问。

## 卡点上浮格式(阻塞型即时发,非阻塞型攒到 Phase 末)

背景一句 / 选项 A、B(各一句利弊)/ 我的建议与理由 / 影响面 / **若无回复我将执行的缺省动作**。

## 评审记录(v2.5 锁版轮,2026-07-24)

- **2 subagent 对抗评审(完整性/一致性 × 工程现实性)**:合计 A 级 2 / B 级 25 / C 级 26。**全部 A/B 级已回修**:①§14-A8 错配修正(A8=完整 E2 签名 presentation,非 EffectGrant);②ASR key/语料前置升阻塞档;③baseline.2 状态刷新(Hopper 已交付,切锁 commit `bdd1e548…`+词表/harness 附录,owner 侧 Hopper 待办清零);④G1 三处口径统一(PTT 窗口外,不做"软过滤"绿测,05 §4 已回写);⑤0.3 v1=全集建表(消解与 09 冲突);⑥Tier1 取消链/验收合并链/capabilities 握手/Plan Delta/Quick 直通补落点(4.5/P0.5-B/4.1/3.1);⑦4.0 与 4.1 倒置修正;⑧工期口径改单人串行 30–38+8–12 并计收尾仪式;⑨A6 完整形态降 P1(09 §14 已回写);⑩风险表补 3 行;C 级除两条"随 Phase 顺修"外全部落地。09 §12 分层句/§14-A6/[hopper] 块、05 §4-G1、ADR-001 分箱、modules 引用勘误同轮回写。
- **Codex 复审(gpt-5.6-sol max,30 分钟,读了 Hopper 源码实证)**:总评 No-Go → **A 6 / B 20 / C 6 全部采纳回修** ⇒ Go。A 级硬伤:①切锁 SHA 引用错误(annotated tag 对象 ff6cee2… ≠ commit `bdd1e548…`,rev-parse 断言必炸)②`summary_path` 实为 .md(iframe 合同改受控映射 .html)③failed/blocked 无 summary(settle 复核按终态拆分,否则永不回叫)④trust-report 内含 emoji(呈现层确定性转换+DOM 门禁)⑤S3 merge 授权缺位(P0.5 合并统一人工交接,自动 merge 禁用至 S3 卡 P1)⑥TTS 脱敏 redactor 无实施步(落 1.4+golden 反例)。B 级要点:0.4 出口收窄为配置子集、P0.5 前置循环澄清(封闭动作不受门约束、门在运行时路径)、§13 三工具落点+TaskView 最小字段定形、issueDispatchReceipt/promoteProject 枚举收紧、10 话术按 mode 拆分期、[pricing] 合同前置、依赖图重写(2.x 串行/3.1←3.2/4.2→4.1 出口/D←B∧C/promote 延后)、11 §2.6 改"持久态+派生态"、IMPL-PROMPT 权威边界与路径基准、必须确认卡点缺省=暂停分支、evidence 两提交法、工期校算 34–47、本地 clone 授权自办。报告与逐条 triage:`research/codex-findings/11-implementation-plan-v25.md`。
