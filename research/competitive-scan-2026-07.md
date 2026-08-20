# VoiceLoop 竞品与能力调研综合(6 路联网调研,2026-07-22)

> 6 个 subagent 分别从语音交互、异步编排、对话式需求获取、记忆/context、HITL 回叫、规划/Demo 六个角度联网深挖。本文件综合结论;各角度原始来源见文末链接。**用途:交叉 review + 指导方案吸收(哪些机制补进主方案)。**

## 0. 一句话总览

**VoiceLoop 的整体方向与 2026 年行业收敛点高度一致(不是拍脑袋),但"每一块单独都已有人做得更成熟",而"完整闭环没人做全"。** 具体:语音层已被官方(Codex realtime、Claude `/voice`)和开源(Happy 23k stars、Veelops、VoiceClaw)分别验证;编排/worktree/恢复有一大批成熟实现(Conductor、Claude Squad、Sculptor、cmux 22k stars);记忆/奠基有几乎同构的产品(Letta MemFS、OpenWiki 13k stars、DeepWiki);采访式需求获取有工具链(spec-kit 122k stars、Kiro)+ 学术基准(ReqElicitGym);HITL/回叫有 PagerDuty/AgentPing/LangGraph 的成熟范式;规划/Demo 有 Devin 置信度、Replit 隔离预演、Kiro 类型模板。**VoiceLoop 的独特点收窄为三处半**:① 语音回叫全链路(语音→通知→电话)× 审批风险分级 × 免打扰仲裁的绑定;② 双维就绪(知识充分 × 需求明确);③ 跨项目类型(开发/调研/营销)统一的"采访→就绪→决策包";半个:"对话优先于指令 + 规格是 AI 产物"的理念在编码场景无人主打。

## 1. 每路的"最该抄的作业"(高优先,可直接落地)

### 语音层
- **薄语音前台 + 升级委托后台**(VoiceClaw 的 `ask_brain` / GPT-Live 架构 / maxrubin629 "语音层保持窄"):实时模型只管对话/播报/打断,真活用一个显式工具甩给后台 agent,结果流回后编进正在进行的对话——不做"转文字→等→念结果"的串行。
- **Codex realtime 的三个踩坑答案**:①会话初始化注入近期上下文;②自我打断防护(TTS 被麦克风收回);③跨端 handoff 带 transcript。
- **ASR 词汇偏置**:把 repo 文件名/符号/分支名注入 STT 提示(Claude `/voice` 官方就这么做),级联引擎相对 S2S 的可控性优势,最便宜见效最快。
- **可听见的差异化**:开工前 AI 用 30–60 秒口头复述"我对项目的理解 + 2–3 个澄清问题"——现有竞品都没有的第一分钟体验。

### 异步编排 / 恢复
- **worktree 供给要带生命周期**:setup 脚本(装依赖)+ 不被 git 追踪文件的拷贝清单(`.worktreeinclude`,解决 `.env`)+ 端口池 + 结束自动 `git worktree remove`;隔离后端留 Docker 口子(Sculptor)。
- **恢复:自己持久化映射表,别只信 agent 端 resume**。关键事实:Claude 会话文件按 cwd 哈希存、跨目录 resume 会失败,要用 `SessionStore` 镜像;策略 = 原生 resume 失败则"摘要+diff 注入新会话"降级(Anthropic 文档明说后者更稳)。
- **Codex `turn/steer`(app-server)= 最佳中途转向原语**:不打断当前轮直接追加输入,正好对应语音"顺便把报错也打印出来"。适配器接口应有 `interrupt()` 与 `steer(text)` 两个方法。
- **适配器别从零写**:参考 `spawner`(adapter 四方法 buildCommand/parseLine/detect/classifyError)、`ai-ide-cli`(能力矩阵),Codex 走 app-server 而非 exec 文本流;长期关注 **ACP(Agent Client Protocol)** —— Zed/JetBrains 共建、25+ agent、已有公共 Registry,可能成为标准适配层。
- **best-of-N** 是低成本高感知的并行(同任务派 Claude+Codex 各跑一次挑优,Cursor `/best-of-n`、Codex `--attempts` 已验证)。

### 需求获取 / 采访
- **决定问什么:覆盖分类扫描 + Impact×Uncertainty 排序**(spec-kit `/speckit.clarify`),每题必须能用"2–5 个互斥选项或 ≤5 词"回答且附推荐选项。别让对话模型即兴发挥。
- **何时停:预算 + 边际增益放代码层,不放 prompt**(多来源一致)。模型只"提议候选问题+自报置信度",政策层决定问/带假设推进/静默推进(学术:Ask-or-Assume 把欠规格检测解耦成独立 agent,校准良好)。
- **对话→规格:回写 + 溯源 + 状态**:每次澄清以 Q→A 追加进 spec 并递增版本(spec-kit);每条需求挂来源引语/置信度/"明说 vs 推断"标记(LENS/Storimo)。
- **一次一问 + 选择题优先**(Harper Reed / superpowers 267k 安装 / SpecTalk 语音上限3问)——语音场景尤其:让用户说"第二个"比组织一段描述容易一个数量级。
- **风格/审美类隐性需求是全行业弱点**(ReqElicitGym 实测挖掘率≈0),而 vibe 用户最在意"长得不对"→ 用视觉参考图代替语言描述。

### 记忆 / 奠基
- **Letta MemFS = 最直接对标**:记忆即 git 仓库(带 commit message)+ `/init` 奠基(可消化历史会话)+ `/doctor` 审计漂移 + "dreaming" 后台整理。VoiceLoop 已有 `.voiceloop/knowledge/`,补 **git 版本化 + 审计命令 + 后台整理** 三件事。
- **OpenWiki(LangChain 13k stars)验证了 VoiceLoop 的 git diff 增量刷新路线**,并给出防误伤做法:知识库与指令文件解耦,AGENTS.md 里只放幂等标记块(`<!-- OPENWIKI:START/END -->`)指向 wiki,更新只重写自己的块;用户简报(INSTRUCTIONS.md)与生成文档物理分离。
- **索引常驻 + 正文按需**(Claude auto memory:每次只加载 MEMORY.md 前 200 行/25KB,主题文件按需读)——这是"持久知识库 vs 每次拼接 Context Pack"分界的最简实现。
- **[warn] 最大缺口:记忆生命周期治理(遗忘/失效/审计)**。行业头号翻车点是"知识库越长越脏"。补法:失效标记而非删除(Zep bi-temporal)、读取期衰减(Mem0 ADD-only + 0.3–1.5x)、后台 consolidation(去重/合并/降权)。**软删除+宽限期,硬删只为合规。**
- **非代码知识(L2 对话/调研)不随 git 变**,其陈旧要靠时间衰减/矛盾检测/用户纠正,现设计缺这个通道。
- **检索:SQLite FTS5(BM25)起步、零运维**,需语义再叠 sqlite-vec + RRF;**代码事实永远 agentic grep 现读,不进知识库**(Claude Code 创始人明确弃 RAG 向量库,理由=无陈旧税)。
- **输出 AGENTS.md 幂等指针块** + 奠基时反向吸收已有 AGENTS.md/CLAUDE.md/.cursor/rules(Devin Knowledge 已验证)——否则用户换工具知识库价值归零(AGENTS.md 已是 30+ 工具事实标准)。

### HITL / 回叫 / 熔断
- **回叫链做成 PagerDuty 式状态机**:`pending→notified(level n)→ack'd→resolved`;ack 只"停止升级"不"解决",resolution timeout 到期未处理重新升级(防"接了电话又睡");同级多渠道 stagger;urgency 两档(完成=低/卡住审批=高)。
- **每级升级前留 ack 窗口**(AgentPing "chat-first then escalate");电话层要能闭环确认(DTMF 0=批/1=snooze/挂断=拒),不能只单向播报。
- **拦截 ≠ 叫人**(Claude auto mode):危险动作先把原因反馈给 agent 让它换路,同一意图被拦 ≥2 次才进回叫链——能把回叫频率降一个数量级。
- **审批中断点必须落盘可恢复**(LangGraph interrupt / Temporal / Inngest 都这么做):否则 daemon 重启静默丢审批,违反自己的"失败可见性"原则。审批 schema 借 Agent Inbox 四动作:accept/edit/respond/ignore(语音只给 accept/ignore,屏幕开放 edit)。
- **审批超时要有默认终局分支**(Temporal 强制:超时→拒绝或升级)。
- **成本熔断三件套**:每步预检(不是事后算账)+ 并发悲观预留 + 计费降级 fail-closed;墙钟只是 backstop(紧错误重试环能一夜烧光预算)。
- **presence-file 抑制推送**(Claude Code `CLAUDE_CLIENT_PRESENCE_FILE` 已验证)= 现成的"输出仲裁"先例。
- **失败可见性有真实反例背书**:Codex 云任务角标清不掉、OpenClaw 移动端压缩静默丢消息(公开 issue)——把它当原则是对的。

### 规划 / Demo / 就绪
- **Devin 的"置信度即就绪判定"绑定行为**:绿(自动开工)/黄(提问拉分)/红(等待);官方数据绿灯 PR 合并率约红灯 2 倍。→ VoiceLoop 双维评分映射:两维都够=绿(出决策包)、一维不够=黄(定向问)、都不够=红(继续探索/准备知识)。
- **模板要带"深浅两档"**(Kiro:feature 出三件套、bugfix 只出 bugfix.md、小任务走 Quick Plan 跳门控)——回应 Martin Fowler "对小任务太重"的批评。
- **Demo 与实现同源**(Replit 隔离预演→批准合并 / v0 Design Mode diff):一次性扔掉的 HTML 会导致"确认了 demo 实现却不一样"的信任损耗。VoiceLoop 的 Demo 应至少与最终交付同一份数据结构/文案;Demo 元素与计划条目编号互引(点 demo 元素定位到计划条目提异议)。
- **计划要落盘为可编辑文件**(Cursor `.cursor/plans`、Lovable `.lovable/plan.md`、OpenHands PLAN.md),让用户直接改计划而非用对话反复修正;批准版本固化为"合同"。
- **选项式澄清降负担**(CHI 2026 论文 + Cursor 2.1 + superpowers 三方验证)。
- **建校准回路**:记录决策包判定分数 vs 结局(接受/小改/推翻),定期回归相关性——否则就绪分数会退化成装饰(Devin 公开了这条曲线)。

## 2. 对方案的净影响:方向确认 + 6 个真缺口

**方向被确认的**:级联/S2S 双引擎、context 前置奠基、分层记忆、git diff 增量、FTS5 检索、采访式、就绪决断、Demo 预览、回叫分级、三熔断、失败可见性——全部命中行业收敛点或已有同构实现,方案没有"想当然"的部分。

**必须补的 6 个真缺口(此前方案未覆盖或过弱)**:
1. **记忆生命周期治理**:只有"生长"没有"遗忘/失效/审计"——头号缺口。补失效标记 + 读取期衰减 + 后台 consolidation + `/doctor` 式审计。
2. **审批中断点持久化 + 超时终局分支 + 四动作 schema**:当前审批太轻,重启会丢、超时无默认、只有批/拒。
3. **计划/决策包落盘为可编辑 artifact + Demo 与实现同源**:避免"计划只在对话流里"和"demo 与实现断裂"。
4. **恢复的健壮性工程**:自持久化 (task,adapter,session_id,cwd,cursor) 映射表 + 降级到"摘要+diff 注入新会话";用 Codex `steer` 做转向。
5. **AGENTS.md 互通**:输出幂等指针块 + 反向吸收既有约定文件,否则知识库锁死在自己产品里。
6. **就绪判定校准回路 + 拦截≠叫人**:让双维就绪分数可验证;回叫是 agent 自救失败后的最后手段。

## 3. 竞品格局的战略提示(归 owner 判断)
- **官方入口正在吞低端**:Claude `/voice`(免 token 听写)+ Codex realtime(官方语音结对)覆盖轻用户;Anthropic 在 issue #2116 明说不做完整语音、留给 MCP/hooks 生态——是机会窗但可能随时变。
- **GPT-Live API 开放后语音层门槛骤降**,壁垒只能建在编排层(项目研究、多 agent 调度、回叫策略)与交互打磨,语音本身不构成壁垒。
- **活下来的编排器核心留存功能都是 diff review**(Conductor/Vibe Kanban/Nimbalyst);Vibe Kanban sunset 声明点破"瓶颈已从执行转移到 plan 和 review"——纯语音闭环里"人怎么审代码"是硬问题,VoiceLoop 需要一个 review 面(手机 diff + 语音 resume,学 Nimbalyst)。
- 与 §13 生态呼应:这些成熟实现大多正是 OctoDesk(ExternalAgentBridge/ACP)、OpenClaw(worktree/Genesis)已经或可以接入的,进一步支持"VoiceLoop 做增量能力、复用下游"的重定位。

## 4. 关键来源(每路 top 链接;完整清单见各 subagent 原始输出)
- 语音:Happy https://github.com/slopus/happy · Codex realtime https://codex.danielvaughan.com/2026/03/31/codex-cli-realtime-sessions-voice-transcription/ · Claude /voice https://code.claude.com/docs/en/voice-dictation · Pipecat https://github.com/pipecat-ai/pipecat
- 编排:Conductor https://conductor.build/ · Claude Squad https://github.com/smtg-ai/claude-squad · cmux https://github.com/manaflow-ai/cmux · Codex app-server https://developers.openai.com/codex/app-server · ACP https://zed.dev/acp · spawner https://github.com/0xtiby/spawner
- 需求获取:spec-kit https://github.com/github/spec-kit · Kiro https://kiro.dev/docs/specs/ · Ask-or-Assume https://arxiv.org/html/2603.26233v2 · ReqElicitGym https://arxiv.org/abs/2602.18306 · superpowers brainstorming
- 记忆:Letta MemFS https://www.letta.com/blog/context-repositories · OpenWiki https://github.com/langchain-ai/openwiki · DeepWiki https://docs.devin.ai/work-with-devin/deepwiki · Claude Code memory https://code.claude.com/docs/en/memory · AGENTS.md https://agents.md/
- HITL/回叫:LangGraph interrupt + Agent Inbox https://github.com/langchain-ai/agent-inbox · AgentPing https://agentping.me/ · PagerDuty escalation https://support.pagerduty.com/main/docs/escalation-policies · Claude auto mode https://www.anthropic.com/engineering/claude-code-auto-mode · ntfy https://docs.ntfy.sh/publish/
- 规划/Demo:Devin 2.1 https://cognition.ai/blog/devin-2-1 · Replit Agent 4 https://replit.com/blog/whats-changed-agent3-to-agent4 · v0 Design mode https://v0.app/docs/design-mode · agent-ready https://github.com/agentlane/agent-ready · Kiro specs https://kiro.dev/docs/specs/feature-specs/
