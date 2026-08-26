# 官网 Docs 页内容稿 v2(Fable 独立梳理版)

> 定位:saydo.octoooo.com 新增「文档(Docs)」页的**内容与结构稿**。官网首页保持简洁、优雅、高级;Docs 页承载详尽说明——内容越全越好,视觉可以朴素。
> 产出:Claude Fable 5(2026-08-20;本会话实读 `docs/01–11`、`docs/09 §11/§13/§15/§16`、`docs/07 D3/D8/D18`、`templates/*`、`packages/daemon/src/config/*`、`packages/contracts/src/types/modelbinding.ts`、`packages/cli/src/*`、`packages/console/src/lib/resourcePlans.ts`、`DEPLOY-测试机部署清单.md`、`HANDOFF.md`、`docs/plan/2026-08-15-default-runner-decision.md`、`docs/plan/2026-08-19-w54-claude-cli-tier1.fable.md`、`docs/release/*`、`deploy/saydo-octoooo-com/*`;另派三路 Explore 子代理分别核对安装/执行与 Git/记忆与账本三域,坐标经本会话抽查)。
> 关系:本稿 **supersede** `docs/site/archive/2026-08-20-docs-page-content-v1-glm53.md`(GLM 5.3 起草的 v1,已归档);v1 中值得保留的条目已经逐条对照吸收,差异与裁决见 §C.3。
> 完成度标注约定(与官网「产品现状」区一致):**现在可用** = 有代码与证据;**进行中** = 已开工未收口;**规划中** = 未开工。
> 硬约束(违反 = bug):零 emoji;状态词纪律(执行状态不说「完成/做完」,口径是「执行和检查都跑完了,等你验收」;合并/交付后才说「交付了」);不承诺未落地能力;不暗示无人值守隔夜完成。
> 本稿三部分:**A 实施建议**(怎么把内容放进站点,不属页面正文)/ **B 页面正文**(建议直接采用)/ **C 维护注记**(出处、待 owner 裁决的事实口径、与 v1 的差异,不入页面)。

---

# A. 实施建议(不属页面正文)

1. **路由**:`deploy/saydo-octoooo-com/docs/index.html`(中文)+ `/en/docs/index.html`(英文);静态站无构建,沿用 `site.css`/`tokens.css`/`theme.js`。Docs 页不追求营销动效:左侧(桌面)/顶部折叠(移动)粘性目录 + 正文 + 「返回顶部」即可。
2. **单页 vs 拆页**:建议 **先单页长文 + 目录锚点**(零维护成本;浏览器内搜索可用)。若日后觉得过长,按 B 部分的五大块拆成五页:`上手` / `模型与供给` / `机制参考` / `安全与隐私` / `参考与帮助`,目录结构不变。
3. **入口**:官网顶栏 nav 加「文档」;页脚「资源」列加「文档」;support 页首段加一句「使用说明见文档页」;首页「开始用」区的 macOS 卡片旁加「安装说明 →」链到 `/docs/#quickstart`。
4. **完成度徽标**:沿用首页 `现在可用 / Coming soon` 的视觉语义,Docs 里用三档文字标签「现在可用 / 进行中 / 规划中」(Docs 是说明书,需要比首页多一档「进行中」)。
5. **维护规则**:每次产品批次收口后同步更新 B 中对应小节与 §B.16 完成度总表;页面正文**不出现仓内批号、内部文件路径、commit SHA、本机绝对路径**(那些留在 C 部分与仓内文档);配置示例以 `templates/saydo.config.example.toml` 为同源,改模板必改 Docs。
6. **英文版**:术语表(§B.19)先定英译,再翻正文;状态词英译固定:`ready for your review`(不用 done)、`delivered`(合并后)。

---

# B. 页面正文

## 0. 怎么读这份文档

- **只想先跑起来**:读 §1(它是什么)→ §4(快速开始)→ §5.3(三种配置方案)就够;其余按需查。
- **想知道它到底怎么做到的**:§3(工作原理)→ §7(项目与 Git)→ §8(审批与安全)→ §9(记忆与账本)→ §10(验收与交付)。
- **想配多家模型 / 多个 CLI 把效果调到最好**:§5(模型与供给)全读,再看 §6(执行器)。
- **关心数据去哪了、花不花钱**:§14(隐私与数据)、§15(费用)。
- 每节标题后若带 **[现在可用] / [进行中] / [规划中]**,表示该节描述的能力当前状态;没带的 = 该节内容整体现在可用,个别差异在正文内标注。
- 文档口径以桌面服务当前版本为准(macOS 为主线;Windows 已完成原生 P0 适配并经真机验证、Linux 经 CI 全量验证,二者可运行但常驻安装与系统通知仍是 macOS 实现);移动 App 均未上架,手机相关内容以「可以这样连」而非「商店下载」为准(§13)。

## 1. 「说到」(SayDo)是什么

「说到」(SayDo)是**一个你能对着说话的高级助手**,运行在你自己的电脑上(macOS 主线;Windows / Linux 已可运行)。你只管把事情聊清楚——甚至边聊边想清楚;它先吃透你的项目上下文,把每件事记成一本账;听懂了、火候够了,就主动提议开工,驱动你电脑上已有的 AI 工具去办;执行和检查都跑完,它主动叫你来验收;你点头,才算交付。

它的心智模型是**幕僚长**(chief of staff):天天和你聊、听懂就自己把事办成、做完来汇报——而不是「你说得越清楚我做得越好」的指令翻译器。核心竞争力不在用哪个模型,而在**上下文工程 + 人机协作流程**。

### 1.1 三条核心承诺

- **说了就记**:按住说话(或打字),想到哪说到哪。随口一句「帮我记一下」立刻进账;答应的事、等你拍板的事、AI 正在办的事、等别人回音的事,件件有归属有去向。
- **先吃透,再办事**:第一次接触一个项目,它先做一次「奠基」——扫清项目结构与关键文件、吸收仓里已有的约定、生成持久的项目知识底座;之后每次对话都带着对你项目的理解,而不是从零开始。这是「说到」和「新开一个聊天窗口」的分水岭。(当前版本的奠基是确定性的机械管道;由沉思档模型做的深度研究是规划中的下一档,§9.2)
- **人拍板才算数**:开工前给你决策包(做什么、怎么做、哪些它做哪些要你配合、最终长什么样);办完只说「等你验收」,不说「做完了」;合并、交付,永远你点头才生效。

### 1.2 它不是什么

- **不是语音输入法**。它不做「语音转文字再粘贴」;语音只是入口,后面是理解上下文、立账、判断就绪、驱动执行、组织验收的完整闭环。
- **不是「说到」自营云端代跑**。没有承载产品数据的「说到」自营服务器,也没有账号注册。重活与任务、确认、审计等核心持久数据都在你自己的电脑上;你主动接入的第三方 AI、系统或浏览器语音识别、推送服务等例外由你的设备直接调用,按对应服务商条款处理,开发者不经手、不可见。
- **不是又一个聊天客户端**。语音识别、聊天、编码 agent 每一块都有成熟单点;「说到」做的是把「聊透 → 自动开工 → 办完叫你验收」治理成同一套闭环——含审批、预算、隔离、回叫、验收、沉淀。
- **不是通用语音助手**。不做闹钟、闲聊、放歌;不替代 IDE——diff、日志、长文档永远转屏幕看,语音只承载决策和摘要。

### 1.3 适用的事

它服务「**有明确产出物的事**」:代码改动 / 文档 / 调研报告 / 文章 / 方案 / 行动计划。编码开发是主场景(工程师口述需求 → AI 在隔离 worktree 里开发 → 你验收合并);但同一套上游能力(奠基、采访、就绪决断、回叫、沉淀)也服务写作与生活筹备、调研这类非代码的事。当前项目类型能力门:`coding`(现在可用)、`writing`(窄版已落地,合并链复用 coding 的 worktree + 强认证合并;引用级引证、归属合同等全量仍规划中);`research` / `marketing` / `planning` / `general` 的专属执行合同规划中——但「立一件事盯着、记义务、采访、调研」这些上游能力对任何事都可用(§9.4)。

### 1.4 当前状态一句话

- **macOS 桌面服务**(守护进程 daemon + Web 控制台 + 可选语音管线):现在可用,开源免费(见 §18 开源与参与)。
- **驱动你已有的 AI**:推理槽位可用 Claude Code / Codex / Cursor / Grok / Gemini CLI / Qwen Code / Copilot CLI 的**订阅登录态**或任意 OpenAI 兼容 API(§5);**稳定执行器路径当前为 Cursor CLI**,Claude Code 已接入生产主流程、最终 live conformance 收口中,Codex 执行路线规划中(§6)。
- **项目记忆与四色账本**:现在可用。
- **iOS / Android / HarmonyOS App**:工程壳存在,均未提审上架;手机当前可经局域网用 App 壳或手机浏览器连接桌面服务(§13)。
- **来电式语音汇报**:规划中。

### 1.5 费用一句话

桌面服务本身免费。AI 能力的费用直接付给你选的厂商——用你已有的 CLI 订阅(额度内零额外费用),或你自己的 API key 按量计费。「说到」不加价、不经手、不代充。细节见 §15。

## 2. 核心概念速查

| 概念 | 一句话 | 详见 |
|---|---|---|
| **沟通面 / 执行面** | 手机和浏览器是沟通面(说话、看进展、按来源面做允许的确认):LAN 不裁 S2/S3,语音确认封顶 S2,tailnet 配对屏幕面在支持后封顶 S2;S3 只在本机认证屏幕。你的电脑是执行面(奠基、记忆、驱动 AI、后台办事) | §3.1、§13 |
| **daemon(守护进程)** | 桌面服务的核心常驻进程:持有全部账本与状态,托管 Web 控制台,执行工具调用,派发任务,发回叫。语音会话断了它也活着 | §3.1 |
| **Brain(对话大脑)** | 对话轮次背后的模型:采访、答疑、口播;它**没有直接执行权**,所有副作用都经 daemon | §3.1 |
| **一件事(Focus)** | 账本的主轴:一件持续关注的事(可以关联 0..N 个项目,也可以不属于任何项目);下面挂「义务」(谁欠什么)与「期待」(做成什么样) | §9.4 |
| **四色账本** | 今天页的四个色区:**等你拍板**(橙)/ **你欠的动作**(蓝)/ **AI 正在办**(绿)/ **等外部回音**(灰)。每件事都有归属和去向 | §9.4 |
| **项目 / 工作区** | 项目 = 一类产出物的承载边界;coding 项目的工作区是你本机的一个 git 仓库文件夹;非代码项目默认用系统管理的文件夹 | §7.1 |
| **奠基(Foundation)** | 第一次接触项目时运行的确定性机械管道,建立项目知识底座(M1);LLM 深研规划中 | §9.2 |
| **M0–M3 记忆** | M0 跨项目用户档案层 / M1 项目知识底座 / M2 累积产物 / M3 会话转写 | §9.1 |
| **就绪(Readiness)** | 「够不够开始」的判定:按项目类型的就绪清单逐项确认,由独立评估器(与对话模型**不同家族**)复核 | §3.3、§5.4 |
| **决策包** | 就绪后端出的成果预览 + 实施计划(每步标 AI 执行 / 需你配合)+ 预计花费与封顶,外加一份轻量小样(与计划同源机械渲染的网页预览)和一句「现在开始?」 | §3.3 |
| **执行模式** | **逐步确认**(每个出圈动作和步骤边界都先问你;出厂默认,当前唯一生效档)/ **直达验收**(一口气跑到等你验收,S2 类效果按念读签署的预授权清单放行;进行中) | §8.4 |
| **S0–S3** | 动作风险分级(按效果算,不按动作名):S0 读 / S1 写 worktree 内 / S2 出圈可逆 / S3 不可逆或外部影响。S3 永远只走已认证屏幕,语音绝不放行 | §8.1 |
| **Gate 0** | 开放自主派发前的安全门禁(身份授权、幂等、独立验收 oracle、secret/egress、意图审计、删除/同意传播);代码里没有 bypass 分支 | §8.2 |
| **worktree 隔离** | 每个任务一个独立 git worktree,主工作区永不被 agent 碰 | §7.2 |
| **`ready_for_review`** | 执行和检查都跑完、产物落盘、等你验收的状态;回叫从这里触发。**它不等于完成**;合并/归档后才是「交付了」 | §10.1 |
| **推理槽位(四槽)** | 对话 dialog / 沉思 thinking / 廉价 cheap / 评估 evaluator——各自可选 API 或订阅 CLI 供给 | §5.1 |
| **开发档(执行器)** | 第五个槽位 `[models.dev]`:派发任务时**驱动哪个 agent 去改代码**(与上面「调哪个模型说话」是两回事) | §6 |
| **BYOA(Bring Your Own Agent)** | 用你本机已登录的 CLI(Codex / Claude Code / Cursor / Grok / Gemini / Qwen / Copilot)做推理供给,零 API key | §5.2 |
| **cap-token** | 控制台的本机能力令牌(`~/.saydo/.cap-token`),进控制台的 URL 里带它;删了会轮换 | §4.3、§14 |

## 3. 工作原理

### 3.1 整体架构:三层

```
人(说 / 听 / 偶尔看屏;拍板 / 审批)
   │ 语音或文字(浏览器、手机)                回叫(语音 / 桌面通知 / 手机推送)
┌──▽────────────────────────────────────────────────────────────┐
│ 沟通面:Web 控制台(桌面浏览器)/ 手机(App 壳或手机浏览器,局域网)     │
│   · 语音引擎(可选 Python 语音管线:ASR → 文本模型 → TTS)           │
│   · Brain:采访 / 就绪自省 / 决策包 / 口播;无直接执行权              │
├────────────────────────────────────────────────────────────────┤
│ 控制面:daemon(Node 22,常驻)——一切 durable 状态的唯一持有者        │
│   · 账本:一件事 / 义务 / 四色 attention / 记忆事件账本 / 审批收据     │
│   · 工具执行、Context Pack 装配、任务派发、事件对账、回叫、成本记账     │
│   · 本机 HTTP/WS(缺省 127.0.0.1:47100,能力令牌鉴权),托管控制台静态页 │
├────────────────────────────────────────────────────────────────┤
│ 执行面:本机 AI 执行器(Tier 1,当前 Cursor CLI)——在隔离 worktree 里  │
│   改代码;每条 shell 命令经审批门回连 daemon;预算/时长/回合三熔断     │
│   (另有经 Hopper 的批式执行路线,合同已定、生产绑定当前休眠,§6.3)    │
└────────────────────────────────────────────────────────────────┘
```

三条铁律贯穿全部设计:

1. **Brain 的模型进程可丢弃、无直接执行权**——语音会话或推理进程随时可以死掉重建,任务照跑;所有副作用发生在 daemon / 执行器。
2. **语音会话短命,任务长命**——会话是事件驱动的窗口(空闲 45 秒或你说「先到这里 / 先这样 / 收工」就挂起,零成本);任务在后台持续执行,靠回叫把人拉回来。
3. **每项状态只有一个 owner**——对话域状态归 daemon,执行域状态归执行器/后端;跨边界用 durable 协议(幂等 key、事件游标、收据)连接,不共用数据库。

**组件一览**(核心组件跑在你自己的电脑上;你主动启用的第三方 AI、联网语音识别与推送例外按对应服务商条款处理):

| 组件 | 是什么 | 备注 |
|---|---|---|
| daemon | 核心守护进程(TypeScript / Node 22):对话与任务状态的唯一持有者;托管控制台网页;审批门、账本、审计都在这 | 缺省端口 47100;只监听本机回环 |
| console | Web 控制台(Vite + React);桌面与手机(移动壳路由)共用一套 | 由 daemon 直接托管,浏览器打开即用 |
| pipeline | 语音管线(Python):桌面浏览器的云端听与说(火山豆包 ASR / TTS) | 可选;不起则用打字或浏览器系统语音 |
| saydo CLI | `saydo up / status / open`:前台持有 daemon、探活、开控制台 | 可选;与直接起 daemon 二选一 |
| contracts | 数据契约包(zod schema、状态机、digest):各组件不分叉的类型单源 | 开发者关心 |
| 执行器 | 拍板后在 worktree 里真的改代码的 agent(当前 Cursor CLI) | 可选;没有不影响对话与记账 |

### 3.2 一次完整闭环:从聊一句到办完叫你

| 步骤 | 发生什么 | 背后机制 | 你做什么 |
|---|---|---|---|
| 1 开口聊 | 「今天」页点「开口聊」,按住说话或打字;随口一句「帮我记一下」立刻进账;它像采访一样一次问一个 | Context Pack(从 M0+M1+M2 挑相关切片 + 最近几轮)注入;采访纪律:一次一问、选择题优先、有问题预算 | 说 |
| 2 就绪决断 | 它每轮自省「知识够不够 + 需求清不清」,缺哪维补哪维;够了才提议开工 | 按项目类型的就绪清单(coding:目标 / 可验证的验收标准 / 范围 / 约束 / 代码库关键部分已理解)逐项确认;确认 = 你亲口给出 + 它复述你点头;独立评估器(异族模型)在提议前复核 | 听提议 |
| 3 决策包 | 端出成果预览、实施计划(每步标 AI 执行 / 需你配合)、范围内外、验收标准、风险,报预计花费与封顶;随包生成一份轻量小样(网页预览,与计划同源机械渲染)——控制台点「看小样」查看,本机对话时同轮放到你屏幕上 | 计划落盘为可编辑产物,批准版本固化为「合同」;小样随包固化(改包即重生成);决策包有效期 24 小时 | 看 |
| 4 你拍板 | 说「就这样」/「开始」;执行模式当前按「逐步确认」(「一口气跑完」档的语音念读签署进行中,§8.4) | 两把钥匙:「证据够了」≠「有权的人批准了这个包+范围+预算+有效期」;派发收据 digest 绑定、单次消费;Gate 0 未关拒派发 | 拍板 |
| 5 后台执行 | 在独立 git worktree 里跑,主工作区不被碰;每条 shell 命令过审批门;预算 / 活跃时长 / 回合三熔断;你可以走开,语音会话挂起 | 命令按效果分级 S0–S3;S0/S1 自动放行,S2 上浮要你确认(45 秒无应答即拒),S3 拒绝并要求屏幕强认证 | 可以走开 |
| 6 办完叫你 | 执行和检查都跑完、产物落盘确认 → 它主动叫你:「执行和检查都跑完了,等你验收」 | settle 对账后才回叫(runner 退出不等于完成);优先级 blocked > failed > 待审批 > 待验收 > 进度(默认不叫);投递按升级链:你在控制台且语音就绪 ⇒ 在线语音开口叫你(第一句就是回叫原因,30 秒没应答再升级)→ macOS 桌面通知 + ntfy 手机推送;免打扰窗口内只发一条低打扰推送、过后补叫(§11) | 被叫回来 |
| 7 验收沉淀 | 口播摘要(一句话 / 150 字走读 / 它自己做的决策清单)+ 证据视图(diff、测试、决策、未验证项);你点头 → 过强认证合并 → 「交付了」;知识与产物留存 | 合并 = 本机 WebAuthn 审批卡(例如 macOS Touch ID/设备密码、Windows Hello 或 Linux passkey/安全密钥)签单次收据,或你自己去终端合并(人工交接);会话末机械提名稳定结论为候选,你批准后进 M1 | 验收 |

### 3.3 采访、就绪与决策包:为什么不用你写需求文档

- **指令是有损压缩,对话是逐步展开。**「说到」不要求你会下指令:你只管聊,它聊到自己懂了、准备够了,主动提议开始。**规格是它的产物,不是你的输入。**
- **认知负担从「表达」转移到「判断」**:不让你凭空把需求说全,而是让你看着具体的东西(成果预览 + 计划 + Demo)说「对 / 不对 / 调一下」。
- **就绪判定是类型化的**:开发缺验收标准不能开工,写作缺核心论点成不了文;所以先识别这是哪类事,再拿对应清单判就绪。清单里的 critical 项没确认覆盖,它机械地出不了包(不是靠模型自觉)。
- **防「相关错误链」**:同一个模型产事实、判缺口、做 Demo、再自评「够不够」,错误高度相关。所以「够不够开始」由**独立评估器**复核——与对话/沉思模型**不同家族**、只读证据账本、不读 Brain 的自辩(这也是 §5.4 异族规则的由来)。
- **三个正交档位**(设计原则,落地程度不一):对话车道(Quick 一两句确认直接干 / Guided 标准采访 / Explore 开放脑暴——规划中,当前只有埋点)× 执行模式(逐步确认 现在可用 / 直达验收 进行中)× 治理深度(S0–S3 由动作效果决定,现在可用)。守门句:你可以把对话调快、把确认调稀,**但不能把任何动作的风险等级或 S3 门槛调低**。

## 4. 快速开始(普通用户路径)

> 目标:一台电脑(macOS 主线;Windows / Linux 同样可跑)、一个你已登录的 AI CLI(或一个 API key),十几分钟跑起来并开口聊。

### 4.1 前提

| 项 | 要求 | 说明 |
|---|---|---|
| 系统 | macOS(Apple Silicon / Intel 均可)· Windows · Linux | 三端都能跑桌面服务;**常驻安装与系统通知当前仍是 macOS 实现**,Windows/Linux 需前台运行 |
| Node | **22.x**(`>=22 <23`) | 桌面服务与 CLI 的运行时;用 nvm / fnm / Homebrew 装 |
| 可选 · pnpm | 10.x | 只有源码开发需要;Release 包不需要 |
| 可选 · git | 任意新版 | 只有让执行器修改代码、创建隔离 worktree 时需要;只使用账本与控制台不需要 |
| 一个 AI 供给 | 二选一:① 本机已登录任一已接线 CLI(Codex / Claude Code / Cursor / Grok / Gemini CLI / Qwen Code / Copilot CLI);② 一个 OpenAI 兼容 API key(OpenRouter / OpenAI / Anthropic / DeepSeek) | 只聊天、立账、调研不需要 key(走 CLI 订阅);见 §5.3 |
| 可选 · Python 3.11+ 与 `uv` | 只有**桌面浏览器云端语音**(火山豆包 ASR/TTS)才需要 | 不配也能说话:浏览器系统语音兜底(§12) |
| 可选 · 一个执行器登录态 | `cursor-agent`(当前稳定缺省)或 Claude Code(生产主流程已接线、最终 live conformance 收口中) | 只有**派发执行任务**才需要;Codex 执行器尚未实现并会 fail-closed 拒起,不影响对话(§6) |

### 4.2 安装

**推荐 · 不克隆源码:**下面是 v0.1.0-rc.11 的发布候选固定 URL;仅当 GitHub Release 页面已经出现且发布检查全绿后才可用。尚未发布到 npm registry 或 Homebrew。

```bash
# 一次运行:下载到 npm 缓存后直接启动
npm exec --yes --package=https://github.com/Octo-o-o-o/SayDo/releases/download/v0.1.0-rc.11/saydo-cli-0.1.0-rc.11.tgz -- saydo up

# 常用安装:安装一次,以后直接用 saydo
npm install --global https://github.com/Octo-o-o-o/SayDo/releases/download/v0.1.0-rc.11/saydo-cli-0.1.0-rc.11.tgz
saydo up
```

该包只包含 daemon + Web 控制台,支持 macOS / Windows / Linux。语音 pipeline、macOS launchd 常驻和修改源码不在包内;Windows/Linux 当前以前台方式运行。远程终端加 `--no-open`。

**源码开发:**

```bash
git clone https://github.com/Octo-o-o-o/SayDo.git && cd SayDo
pnpm install && pnpm -r build
```

### 4.3 启动桌面服务

上一步的一次运行命令已经启动服务;全局安装后可使用:

```bash
saydo up        # 前台持有 daemon,Ctrl+C 优雅退出并可续接任务
saydo status    # 探活:0=已连上 / 1=端口空闲 / 2=端口冲突
saydo open      # 打开控制台
```

源码开发形态使用 `pnpm --filter @saydo/cli build` 后运行 `node packages/cli/dist/cli.mjs up`。同一个数据目录 `~/.saydo` 同时只允许一个实例。

- 缺省端口 **47100**(直起 daemon 用环境变量 `SAYDO_DAEMON_PORT` 覆盖;`saydo` 命令行只认 `--port`);缺省只监听本机回环地址。`saydo up` 缺省会自动打开浏览器,`--no-open` 可关。
- 数据目录缺省 `~/.saydo`(`--home` 或 `SAYDO_HOME` 覆盖)。首次启动会自动生成:`config.toml`(占位模板)、`.cap-token`(控制台令牌)、`saydo.db`、`sessions/`、`logs/`、`projects/` 等。
- 健康探针:`curl -s http://127.0.0.1:47100/health`(`ok:true` 即起来了;tsx 冷启动约 10–15 秒)。
- 进控制台使用 `saydo open`。它在 macOS 调 `open`、Windows 调系统浏览器、Linux 调 `xdg-open`;无图形环境用 `--no-open`。注意使用 **localhost**:为了屏幕强认证的 WebAuthn 绑定,`127.0.0.1` 的页面请求会被重定向到 `localhost`。

### 4.4 首次使用:资源画像向导

进门先看到**资源画像**:它清点这台机器能用的模型来源(装了哪些 CLI、哪些已登录、`.env` 里有哪些 key),然后给出方案卡(§5.3 三种)。典型零 key 流程:

1. 看到「全用 Codex(订阅内零成本)」之类的一键卡(每家已登录的 CLI 一张;列表按 已登录 > 仅安装 > 未装 排序,同档内按用过次数);
2. 勾两条知情确认(评估档与对话同族 / 评估器笼隔离不可证,§5.4);
3. 点「确认并启动」→ 写入待生效配置 → **自检 1/2**(四槽各真调一次)→ 重启服务 → **自检 2/2**(生效后再确认)→ 落到「开口聊」。全 CLI 方案每槽一次 15–25 秒,**两轮自检合计约 1–3 分钟**(视 CLI 而定,可能更久),界面有进度与耗时;
4. 之后随时可在「设置」里换方案、逐槽手配(高级模式)。

没配好对话档之前,进哪一页都会先弹向导(有「先随便看看」逃生口);首次且账本为空时,它会先说一句固定开场白请你「随便说三件这周要办的事」给你立账看看。

### 4.5 开口聊:今天页

控制台左栏:**开口聊**(主入口)/ **今天**(四色账本,唯一「需要你」入口)/ **全景看板** / 「正在持续的事」分组(按空间列出各件事)/ 「记录」分组:**记忆库** / **产物** / **成本** / **设置**;旧版 Dashboard、审批中心、通知、任务、Focus 列表(旧)、看板(旧)收在「旧版」折叠组里。

- 「今天」页点「开口聊」:打字,或按住说话(§12);想到哪说到哪。
- 聊成熟它会问你要不要立成一件持续关注的事;要它办的、你欠它的、等别人的,都会出现在「今天」页的四色区。
- 开发类请求会真的走「采访 → 就绪 → 决策包 → 拍板 → 派发」全链(§3.2);拍板前它会报预计花费与封顶。
- 已知体感(不是坏了):CLI 对话模式每轮想 15–25 秒是常态,别连点(桌面端单次调用 120 秒上限后才报错);偶尔只回应一半诉求,再问一次即可;「帮我记一下」类随口记录通常当轮提议落账,偶尔会降级先进记忆库(菜单里可看),立起事后可再挂账。

### 4.6 可选:桌面浏览器语音

- **零配置**:浏览器有系统语音识别(Chrome / Safari 的 `SpeechRecognition`)就能按住说话、朗读回复;质量一般,识别文本走文字通道。
- **云端语音(更准更自然)**:在 `~/.saydo/.env` 填火山豆包的 `VOLC_APP_ID` + `VOLC_ACCESS_TOKEN`(流式识别,带你项目术语的热词偏置)与 `DOUBAO_TTS_API_KEY`(seed-tts-2.0 合成),并起 Python 语音管线:

```bash
cd pipeline && uv sync
SAYDO_HOME=$HOME/.saydo SAYDO_DAEMON_PORT=47100 nohup uv run python -m saydo_pipeline >> ~/.saydo/pipeline.log 2>&1 &
```

配好后控制台自动切到云端;管线缺席时 `/readyz` 报 `voiceReady=false`(文本与控制面照常可用,不算启动失败)。细节见 §12。

### 4.7 可选:手机连接(局域网)

手机 App 均未上架;当前可经局域网用**手机浏览器**(或自行构建的 App 壳)连到桌面服务:

1. 启动 daemon 时加 `SAYDO_MOBILE_LAN=1`(监听 `0.0.0.0`,只接受内网 RFC1918 来源 + 能力令牌 + Host/Origin 校验三道门);
2. 查本机内网 IP(`ipconfig getifaddr en0`),把 `http://<内网IP>:47100/?token=<cap-token>` 做成二维码(令牌不要贴进第三方在线工具)给手机扫;手机浏览器直接打开该 URL 也行(移动壳路由 `#/m`);
3. 手机上从下方胶囊按住说话(iPhone 走系统语音识别,不需要 Python 管线),上滑选放进哪件事;看「今天」四色、看进展、对立账 / 记账类确认卡点头或撤回。**执行中的命令审批(S2)与合并 / 删除(S3)只在本机受信屏幕出现,局域网手机面不能裁决**(手机上没有设备配对身份)。

这是 dogfood 级的临时边界(局域网明文 HTTP + 长期能力令牌),**不要暴露到不受信网络**;设备配对 / 端到端加密 / 商店版 App 见 §13 与 §16。删 `~/.saydo/.cap-token` 再重启会轮换令牌,所有已连设备一起掉线需重扫。

### 4.8 常驻、备份、关停与重置

- **常驻(launchd)**:`just daemon install | start | stop | restart | status | logs | deploy [sha]`——开机自起 + 崩溃自启,运行时树与开发树分离(`~/.saydo/runtime` → `~/.saydo/releases/<sha>`)。`install` 会一并生成并装载语音管线的常驻配置(需要 `uv`);没装 `uv` 时用 `just daemon install --without-pipeline` 只装 daemon(桌面浏览器云端语音不可用,系统语音与文本照常);`uninstall` 对称卸载两者。日常上手用 §4.3 的前台方式即可,常驻适合长期挂机。
- **更新**:`git pull && pnpm install && pnpm -r build`,然后重启 daemon(前台形态 Ctrl+C 再起;launchd 形态 `just daemon deploy`——会重启 daemon 与语音管线,挑空闲时段)。
- **备份**:daemon 每日自动快照到 `~/.saydo/backups/<时间戳>/`(SQLite 在线备份 + `sessions/` + 用户档案 + 各项目的知识底座与奠基产物),保留期 `[params].backup_retention_days`(缺省 30 天);`just backup` 手动触发。
- **关停**:`lsof -t -iTCP:47100 -sTCP:LISTEN | xargs kill; pkill -f saydo_pipeline`(`saydo up` 前台形态直接 Ctrl+C:会先停新派发、给活跃任务写「待续接」标记、再收口进程,下次启动接着跑)。
- **完全重置**(回到全新用户):停完后 `rm -rf ~/.saydo`——会轮换令牌,也会删掉全部账本与记忆;项目工作区里的 `<repo>/.saydo/` 不在此目录,需单独处理。

## 5. 模型与供给(高级用户必读)

「说到」把模型用途拆成**五个槽位**,每个槽位独立选供给方式与模型。这是「一个订阅就能用」和「多家模型配合到最好」两种玩法的同一套机制。

### 5.1 五个槽位

| 槽位 | 配置键 | 干什么 | 要什么 | 示例(仓库模板 / 向导「一个 key」卡) |
|---|---|---|---|---|
| **对话档** | `[models].dialog` | 每一轮对话:采访、答疑、口播 | 低延迟、中文口语好、工具调用纪律强 | API(OpenRouter,`openai/gpt-5.6-luna`) |
| **沉思档** | `[models].thinking` | 任务卡起草、决策包 / 计划生成、奠基提炼(轻量小样为机械渲染,不占模型) | 深推理,异步不阻塞对话 | API(OpenRouter,`openai/gpt-5.6-terra-pro`) |
| **廉价档** | `[models].cheap` | 摘要叙事、热词抽取、事件打标等高频结构化调用 | 便宜、快 | API(OpenRouter,`google/gemini-3.1-flash-lite`) |
| **评估档** | `[models].evaluator` | 独立判「够不够开始」(就绪深评) | **与对话/沉思不同家族**(§5.4) | API(OpenRouter,`anthropic/claude-sonnet-5`) |
| **开发档(执行器)** | `[models.dev]` | 派发任务时驱动哪个 agent 改代码、用它的哪个模型 | 见 §6 | `agent = "cursor"`(与仓库模板一致;当前稳定缺省);`claude_code` 生产主流程已接线、live conformance 收口中 |

为什么分档:对话档要的是延迟(你在等它出声),沉思档要的是质量(产出是「合同」),廉价档要的是成本(高频调用),评估档要的是独立性(换一家模型做裁判)。一个模型通吃四档要么慢、要么贵、要么不独立。

### 5.2 两种供给方式

**方式 A · API 直连**(`{ provider = "api", via = "<端点名>", model = "..." }`)

- 任意 **OpenAI 兼容**端点:在 `[providers.api.<name>]` 声明 `base_url` + `api_key = "env:VAR"`(key 只能以环境变量引用,**禁止明文写进配置**)。
- 推荐网关 **OpenRouter**:一个 key 打通多家(缺省模板就是它);也可直连单家(OpenAI / Anthropic / DeepSeek / 月之暗面 / 阿里百炼……模板有示例)。
- 模型名带厂商前缀时(`openai/…`、`anthropic/…`、`google/…`、`deepseek/…`、`x-ai/…`、`qwen/…`)家族自动解析;单家直连端点模型名无前缀时,端点要显式写 `family = "deepseek"` 之类——给 §5.4 的异族校验用。
- 对话档走 API 时是**实时模式**:完整多轮工具环、流式、秒级返回,语音对话就靠它。

**方式 B · 订阅 CLI(BYOA)**(`{ provider = "<x>_cli", model = "..." }`)

用你本机**已经登录**的 AI 命令行工具做推理供给,零 API key、走你的订阅额度。当前已接线的 CLI:

| provider | 对应命令 | 备注 |
|---|---|---|
| `codex_cli` | `codex` | 家族恒 GPT;可配 `reasoning`(none/minimal/low/medium/high/xhigh/max);model 可省 |
| `claude_cli` | `claude` | 家族恒 Claude;model 可省 |
| `cursor_cli` | `cursor-agent` | **model 必填**(如 `claude-fable-5-thinking-max`、`cursor-grok-4.6-high-fast`),家族按模型名解析 |
| `grok_cli` | `grok` | 家族恒 grok;model 可省 |
| `gemini_cli` | `gemini` | 家族来自显式 model 名或流内上报;解析不出则该槽阻断 |
| `qwen_cli` | `qwen` | 同上(传输型 CLI) |
| `copilot_cli` | `copilot` | 同上(传输型 CLI) |

(`kimi_cli` / `opencode_cli` 只在资源画像里「可识别」,**不能**当供给——本机实测无法在执行前可证零工具,出于安全不接线。)

登录是你与厂商之间的事:用各家官方方式登录,「说到」只探测「装没装 / 登没登录 / 能列出哪些模型」,未登录时向导给出可直接粘贴的修复命令(以向导提示为准):

| CLI | 登录 |
|---|---|
| `cursor-agent` | `cursor-agent login` |
| `codex` | `codex login` |
| `claude` | `claude auth login` |
| `grok` | `grok login` |
| `gemini` | 在终端运行 `gemini` 完成 Google 登录 |
| `qwen` | 配置 OpenAI 兼容端点或 `OPENAI_API_KEY`(它走上游 API 计费,账本文案如实区分) |
| `copilot` | `copilot login` |

BYOA 的工作方式与纪律(你会在界面上感到的部分):

- **一发一收、无状态**:每次调用起一个新的 CLI 子进程,不复用会话(刻意不用 resume——会话落盘与隐私开关互斥,且实测 resume 对延迟也无收益)。
- **对话档走 CLI = 慢速文本模式**(`dialog_cli_oneshot`):每轮约 15–25 秒,返回一段回复 + 最多 8 个结构化动作(记一笔、立任务、查状态、提议开工……),daemon 逐个执行;**不进入语音实时环**(语音对话请给对话档配 API)。这不是卡死,界面会显示慢速徽标与进度。
- **真实自检后才生效**:配置保存时,每个走 CLI 的槽都会真的调一次(对话档要回合法 envelope,廉价档要过 schema,评估档要过与生产同形的深评请求并上报实际模型),四槽全过才重启生效;任一失败只把该槽标红并给人话原因,不伪装成功。
- **笼子**:推理用的 CLI 调用在**逐次新建的空隔离目录**里跑、prompt 头部硬禁「执行命令 / 读文件」,并按 CLI 能力用最严的零工具旗标(Claude `--tools ""`、Codex 只读沙箱、Grok `--tools ""`、Gemini/Qwen/Copilot 各自的 deny 策略 + 隔离 HOME);流里一旦出现工具调用事件立即终止作废(tripwire)。Cursor CLI 没有可证零工具旗标,只有「ask 模式 + tripwire 检测」,是三档里最弱的笼。正因为 CLI 笼都「限写不限读」(读盘不可挡,评估器理论上能翻到 Brain 的自辩),**评估档用任何 CLI 都需要你亲手勾两条知情确认**(同族 + 隔离,§5.4)。
- **实际模型复核**:每次调用记录 `requestedModel / observedModel`,流内上报的模型家族与配置不符即该次作废;Codex / Claude 这类固定家族 CLI 在可执行文件身份核验(绝对路径 + 内容 digest 登记)通过时允许按登记家族放行。

### 5.3 三种配置方案(首跑向导里的三张卡)

首次进控制台会看到「资源画像向导」:它探测本机装了哪些 CLI、哪些已登录、`.env` 里已有哪些 key,然后给出可一键套用的方案卡——

| 方案 | 适合谁 | 四个推理槽怎么配 | 体验 |
|---|---|---|---|
| **全用某个 CLI**(如「全用 Codex」) | 只有一个订阅、不想申请 key | 对话 / 沉思 / 廉价 / 评估四槽全走该 CLI | 零 key 零终端;对话每轮 15–25 秒(慢速文本模式);订阅额度内零额外费用。评估档走 CLI 且与对话同族,需勾「同族知情确认」+「隔离知情确认」两条 |
| **对话走 API + 其余槽 CLI** | 有订阅,也愿意为实时对话花一点 API 费 | 对话档 API(秒级、可语音);沉思 / 廉价 / 评估走 CLI | 推荐的「又快又省」组合;评估档走 CLI 同样需勾两条知情确认 |
| **一个 key 全搞定** | 没有任何 CLI 订阅 | 四槽都走 OpenRouter API,各槽按规格指定模型 | 秒级返回;按量计费,以服务商账单为准 |

向导的「高级模式」允许逐槽手配:每槽独立选 API 端点 / 任一已登录 CLI / 指定模型;两路都要四槽自检全绿才会重启生效。进阶玩法举例:

- 对话档 API(如 OpenRouter 上的 `google/gemini-3.1-flash` 类低延迟模型,家族 gemini)+ 沉思档 `cursor_cli`(`claude-fable-5-thinking-max`,家族 claude)+ 廉价档 `grok_cli` + 评估档 `codex_cli`(`reasoning = "max"`,家族 gpt)——对话快、沉思强、评估与对话 / 沉思都异族,且沉思与评估不共享同一家订阅时窗(评估档走 CLI 需勾两条知情确认)。
- 全 API 但分家:对话 / 沉思走一家,评估走另一家;或用 OpenRouter 统一 key、按槽挑不同厂商的模型。
- 项目级覆盖(控制台项目设置):某个项目把**对话档 / 沉思档**换成更强(或更省)的 API 模型、改开发档模型、改预算上限;项目层只允许 API binding,评估档不可覆盖(它是护栏锚点)。

### 5.4 异族规则:评估器必须换一家

「够不够开始」的判定若由同一个模型(或同一家族)自评,错误会与生成高度相关。因此:

- 评估档的模型家族 **不得** 与对话档、沉思档相同(fail-closed:同族且未确认 → 评估档 `unarmed`,daemon 启动给提示;对话仍可用,但就绪深评不会武装)。
- 家族按**解析后的实际模型**判:`openai/…`→gpt、`anthropic/…`/fable/sonnet/opus→claude、`google/…`→gemini、deepseek、grok、qwen、composer(Cursor 自研)……;`codex_cli` 恒 gpt、`claude_cli` 恒 claude、`grok_cli` 恒 grok;Cursor CLI 按你填的模型名解析。
- **知情豁免两条**(必须你亲手勾,界面不代签):`evaluator_same_family_ack`(接受同族评估,代价是独立性下降)、`evaluator_isolation_ack`(接受「限写不限读」的 CLI 笼做评估器,代价是「评估器读不到 Brain 自辩」不可证)。**评估档只要走 CLI(任何一家、不论家族是否相异),两条都必须为 true**;评估档走 API 且异族则一条都不需要。「全用某 CLI」方案天然需要这两条。
- 评估档走 CLI 的武装条件 = 两条 ack 都为 true + 自检通过 + 实际模型家族可证;任一不满足就 `unarmed`(原因会分别显示 `same_family_blocked` / `isolation_ack_required` / `cli_self_test_required` / `cli_self_test_failed`)。
- 相邻规则:沉思档 / 廉价档的 CLI 未登记或自检失败时,**如实回落到对话档供给**(状态显示 `fallback_dialog` 并给原因),服务不中断、不伪装成 active。

### 5.5 计费与记账口径

- **订阅 CLI 调用不产生「元」**:成本账本记为 `source = subscription`,界面显示「订阅额度内」(调用次数在周报里看)——不显示 ¥0、不显示「未知」、不预测剩余额度。只有探测到该 CLI 的认证面确属订阅(如 Gemini 个人 OAuth、Copilot GitHub 登录)才写「订阅内零成本」;若 CLI 上游其实是 API key 计费(如 Qwen 配 key),文案如实改为「按该 CLI 的上游计费方式,说到不代付」。
- **API 调用按单价表估算**:`[pricing]` 无表项的模型成本显示「还没有确切数字」(绝不编数、不显示 0)。真正拦你的是**每个任务**的成本 / 时长 / 回合三熔断(§8.5),成本封顶只约束 API 计费部分,订阅调用靠墙钟 + 回合数兜底;`[budget].monthly` 目前只是配置项(无任何执行或展示点),不是硬闸。
- **订阅限流不静默转计费**:触发周 / 5 小时时窗限流时,该次调用返回可重试的限流错误并如实告知,**绝不自动转 API 计费**。「停下问你切按量计费还是等重置 + 单次 billing-switch 收据(有效期 10 分钟)」与「durable 排队自动重放」两套合同已落,生产尚未接入(进行中)。

### 5.6 配置文件参考

全局配置 `~/.saydo/config.toml`(非密)+ `~/.saydo/.env`(密钥真值;永不进 Git);仓库 `templates/` 下有可复制模板。首跑向导写的就是这两个文件,手改后重启 daemon 生效(配置非法时 daemon 进入「仅恢复」模式:健康探针与设置自救页可用,对话与派发停用,见 §17)。

```toml
[models]
profile   = "default"                # default | dev(dev 还需环境变量 SAYDO_DEV=1,双开关)
dialog    = { provider = "api", via = "openrouter", model = "openai/gpt-5.6-luna" }     # 家族 gpt,实时语音环
thinking  = { provider = "codex_cli", reasoning = "high" }                            # 家族恒 gpt,走 ChatGPT 订阅
cheap     = { provider = "grok_cli" }                                                 # 家族恒 grok,model 省略=CLI 默认
evaluator = { provider = "api", via = "openrouter", model = "anthropic/claude-sonnet-5" } # 家族 claude,与上两者异族,无需 ack
# evaluator_same_family_ack = true   # 评估档走任一 CLI 时两条都必填(否则就绪深评 unarmed);评估档走 API 且同族时只需第一条
# evaluator_isolation_ack   = true

[models.dev]                         # 开发档 = 执行器(§6)
agent     = "cursor"
transport = "cli"
model     = "grok-4.6"               # 以 cursor-agent 当前可列出的模型名为准

[providers.api.openrouter]
base_url = "https://openrouter.ai/api/v1"
api_key  = "env:OPENROUTER_API_KEY"  # 恒 env 引用;多家网关不写 family
# provider_order = ["deepinfra"]     # 可选:聚合网关钉死上游路由顺序并禁自动兜底(确定性路由)
# [providers.api.deepseek]           # 单家直连示例:模型名无前缀 ⇒ family 必填
# base_url = "https://api.deepseek.com/v1"
# api_key  = "env:DEEPSEEK_API_KEY"
# family   = "deepseek"

[voice]
engine = "cascade"                   # 级联:ASR → 文本模型 → TTS
asr    = "volc"                      # 火山豆包流式识别(带热词偏置)
tts    = "volc"                      # 豆包 seed-tts-2.0 v3 双向流式

[privacy]
store_audio          = false         # 录音与转写分别同意
store_transcript     = true
audio_retention_days = 0

[budget]
monthly  = 200                       # 当前只是配置项(无执行点),不是硬闸;真正的熔断在每个任务(§8.5)
currency = "CNY"
task_max_default = 20                # 单任务成本封顶缺省(元;只约束 API 计费部分)

[dnd]
window = "23:00-08:00"               # 免打扰:窗口内不外呼,记 snooze 到窗口末后按队列补叫

[tier1]                              # 执行器(Cursor CLI)版本钉死,两键齐备才启用
cursor_agent_bin            = "/Users/<你>/.local/share/cursor-agent/versions/<ver>/cursor-agent"  # 必须绝对路径,不接受 ~
cursor_agent_pinned_version = "<ver>"

[gate0]
enabled = true
bypass  = false                      # 恒 false;为 true 反而一律拒绝派发(防误配)

[params]                             # 可调参数(节选)
foundation_budget_min  = 5           # 奠基墙钟上限(分钟)
interview_question_budget = 8        # 采访问题预算
park_aging_hours       = 72          # 停靠老化:等人超过 72h 取消并转草稿
proposed_ttl_hours     = 24          # 决策包有效期
backup_retention_days  = 30
enabled_project_types  = ["coding"]  # 类型能力门;可开 ["coding","writing"]
```

`.env` 常用键:`OPENROUTER_API_KEY` / `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `DEEPSEEK_API_KEY`(按你建的端点填)、`DOUBAO_TTS_API_KEY` + `VOLC_APP_ID` + `VOLC_ACCESS_TOKEN`(桌面浏览器语音用,§12)、`NTFY_TOPIC` + `NTFY_SERVER`(手机推送,§11)。

项目层可覆盖的键白名单见 §7.1(`<workspace>/.saydo/project.toml`):只允许 `[project]/[git]/[verify]/[setup]/[writing]` 与 budget / dnd / params 子集;**models / providers / gate0 / hopper / privacy / voice 出现在项目层一律拒绝**——仓库随附文件是不可信输入,不能把你的 key 引到别人的端点。

## 6. 执行器(开发档):谁来真的改代码

### 6.1 两套词表,别混

- **推理槽的 CLI 供给**(§5.2)= 让 Codex / Claude / Cursor / Grok / Gemini / Qwen / Copilot 的 CLI **替 Brain 说话、想事、评估**——它们只做一发一收的文本推理,不碰你的仓库。
- **执行器(开发档,`[models.dev]`)**= 拍板后**在 worktree 里真的改代码、跑命令的 agent**。词表 `claude_code | cursor | codex`;`cursor` 是当前稳定缺省,`claude_code` 的生产主流程已接线但最终 live conformance 仍在收口,`codex` 尚未实施。只有尚未支持或配置不完整的分支会被 daemon 拒起(fail-closed,不会偷偷拿另一种二进制冒充),对话不受影响。

### 6.2 当前可用:Cursor CLI 执行器 [现在可用]

- 驱动方式:`cursor-agent -p --force --trust --output-format stream-json --model <model> [--resume <chatId>] <prompt>`,在任务 worktree 里跑;模型填 `cursor-agent` 当前可列出的任一模型名(已实测过 Grok 4.6 与 Composer 2.5;Claude 系亦可),事件流上报的实际模型家族与配置不符即该轮作废。
- 审批门:执行器为每个 worktree 写 `.cursor/hooks.json`,`beforeShellExecution` 钩子**同步阻塞**回连 daemon 的本机 unix socket;daemon 按命令**效果**分级裁决(§8.1/§8.3);钩子超时、JSON 畸形、socket 不通一律 = 拒绝;事件流里出现 shell 调用却没有对应门请求 ⇒ 判定门被绕过,立即终止任务(canary)。
- 版本钉死:`[tier1].cursor_agent_bin` 必须是锁定副本的**绝对路径**(`…/versions/<ver>/cursor-agent`)+ `cursor_agent_pinned_version` 精确相等;两键齐备才启用执行器——防 `cursor-agent` 自更新后行为漂移。升级 = 改两键 + 重跑门禁。
- 凭据剥离:agent 进程只继承固定平台白名单:POSIX 核心为 `PATH/HOME/USER/LOGNAME/SHELL/LANG/LC_ALL/LC_CTYPE/TERM/TMPDIR`;Windows 按需另带 `TEMP/TMP/USERPROFILE/USERNAME/HOMEDRIVE/HOMEPATH/APPDATA/LOCALAPPDATA/PATHEXT/SYSTEMROOT/WINDIR/COMSPEC`。白名单不含任何 API key / token;执行器登录态仍在它自己的 HOME 存储里。
- 诚实边界:Cursor 后端只有 shell 通道过门,内建的文件读写 / 联网工具不经钩子——所以它的网络出口能力表如实标 `egress = uncontrolled`,隔离靠「独立 worktree + 凭据剥离 + 命令门」,**不是沙箱**;不信任的任务请用逐步确认档并盯紧 S2。
- 中途改需求(steer):当前没有任何后端支持运行中即时注入;运行中的任务 = **终止本轮再带新指令续跑**(`cancel_resume`,worktree 保留),排队 / 停靠中的任务 = 下次运行时注入(`queued_delta`)。它会如实告诉你是哪一种。

### 6.3 进行中与规划中

| 后端 | 状态 | 说明 |
|---|---|---|
| **Claude Code 执行器**(`agent = "claude_code"`) | **收口中** | 以官方 `claude -p --output-format stream-json` 子进程为传输,用 `PreToolUse` hooks 做 S1–S3 裁决;订阅只经 `claude` 登录态消费、零 API key,不启用 bypass 权限、不做 live steer。配置、生产执行主流程、审批门、恢复、记账、自检、设置页与任务详情已经接线;最终真实端到端 conformance 尚未收口,当前稳定缺省仍为 Cursor |
| **Codex 执行器** | **规划中** | 设计上经 Hopper 批式路线(见下);当前 `agent = "codex"` 会被拒起 |
| **Hopper 批式路线**(重任务 drop 进独立的 Hopper 任务系统:worktree / 事件溯源 / 崩溃恢复 / 预算 / 验收闸门) | **合同已定,生产绑定休眠** | daemon 主流程不启动它;锁定版本副本与专用 vault 的约定写在配置模板里但当前不被消费;Hopper 路线的合并恒为人工交接,不经本机认证卡。对用户来说今天它不是可用功能 |
| **provider-neutral 原生执行器**(任意 OpenAI 兼容后端) | **规划中** | 2026-08 决策推荐的方向(替代「拿 DeepSeek Harness 当默认 runner」——后者因审批缺省放行、钩子故障不阻断等与 fail-closed 红线冲突被否决) |
| **Gemini CLI 作执行器** | 无此计划 | Gemini CLI 仅作推理槽供给 |

## 7. 项目与 Git:它怎么和你的仓库打交道

### 7.1 项目与工作区

- **一个 coding 项目 = 你本机的一个文件夹(git 仓)**,以绝对路径登记(`~/` 可;符号链接会被解析;记录文件系统身份防漂移)。硬约束:必须在你的用户目录内、不能与 `~/.saydo` 重叠、不能与其他现役项目互为父子目录。
- **不支持「给我一个远端仓库 URL 我来 clone」**:全部实现都以本地文件夹为前提;想用远端仓先自己 clone 下来。
- **登记方式**:对话里点名本地路径(它只从**你当前这句原话里的唯一路径字面量**解析,只读核验目录存在,复述「这个本地项目、类型 X」请你封闭确认后才采用——否认、歧义、路径不存在、路径不是你亲口说的,一律零写入,绝不由模型编路径自动挂靠);或在控制台受信终端选择已有项目。非代码的事(写作、调研、生活筹备)默认用系统管理目录 `~/.saydo/projects/<id>`,不会拦着你「先选文件夹」。
- **项目内目录** `<workspace>/.saydo/`:`knowledge/`(M1 知识底座,Markdown,人可读可改,自带独立 git 历史)/ `foundation/`(奠基产物与 manifest)/ `worktrees/<taskId>/`(任务隔离树)/ `project.toml`(项目层配置)。产物库、源快照、就绪深评记录与会话转写都在全局 `~/.saydo/{artifacts,snapshots,assessments,sessions}`,不在项目目录。**建议把 `.saydo/` 加进项目 `.gitignore`**(daemon 不会替你改 `.gitignore`;知识库想团队共享可显式提交 `knowledge/`)。
- **`project.toml`**(仓库随附、视为不可信输入):只认 `[project]`(type / exec_mode_default)、`[git].protected`(保护分支,**与缺省 `["main","master"] 取并集`**,只能加不能减)、`[[verify.entries]]`(验收命令登记,§7.4)、`[setup].command`(装依赖命令)、以及 budget / dnd / params 子集;`models / providers / gate0 / hopper / privacy / voice / pricing / tier1` 出现即拒收(拒键不拒文件,拒收项落审计)。文件坏了 = 该项目的任务认领转 blocked 叫人,不带宽松缺省硬跑。
- **AGENTS.md 互通**:奠基时反向吸收仓里已有的 AGENTS.md / CLAUDE.md / `.cursor/rules`;输出侧在 AGENTS.md 放一段幂等指针块指向知识底座(`<!-- saydo:knowledge:begin/end -->`),换工具时知识库价值不归零。

### 7.2 每个任务一个 worktree

- 拍板派发后,执行器在 `<repo>/.saydo/worktrees/<taskId>/` 建 `git worktree add -b saydo/<taskId> … HEAD`——**分支名 `saydo/<taskId>`,从主仓当前 HEAD 切出**;同一任务返工 / 恢复复用同一 worktree。**你的主工作区在执行期不会被碰**(agent cwd 锁死在 worktree;圈外命令按 S2/S3 上浮或拒)。
- 装依赖:`[setup].command` 只接受 `pnpm / npm / yarn` 的 `install / i / ci` 形态,旗标白名单,且**强制追加 `--ignore-scripts`**(postinstall 属供应链执行面,确需时按 S2 上浮)。
- agent 的 prompt 里明写:只在当前工作目录内改动、**不要 git push**、改动不需要你合并。
- 同仓任务串行、跨仓并行;重型仓库可单 worktree 串行。
- **worktree 不会被自动删除**(取消也保留,方便捡回);磁盘上会累积 `<repo>/.saydo/worktrees/`,定期自己 `git worktree remove` / 清理。

### 7.3 完成、验收与合并:它不会替你 push,也不会开 PR

1. 执行跑完 → **daemon(不是 agent)**对 worktree 拍树快照(`git add -A` 排除 `.cursor/` 后 `write-tree` 得到 `treeSha`)→ 在 worktree 里**重跑冻结的验收命令**(§7.4)→ 产 settle 证明(任务 / 轮次 / 决策包版本 / treeSha / verify digest / 转写游标)→ 任务进入 **`ready_for_review`** → 回叫你。之后任何漂移都会被发现。
2. 你在验收面三选一:**通过**(记录批准的 `treeSha`,进入「等合并」)/ **要改**(同任务新一轮,复用 worktree,意见进下次 prompt)/ **作废**(取消本轮)。
3. 合并两条路,都是「人触发」:
   - **本机认证 / passkey 审批卡**(Tier1 缺省):屏幕上完成一次 WebAuthn 强认证(由系统提供,例如 macOS Touch ID/设备密码、Windows Hello 或 Linux passkey/安全密钥),签一张绑定 任务 / 轮次 / 决策包版本 / 预期树 的单次收据;daemon 凭收据执行:复核 worktree 现树 == 收据树(漂移拒)→ 隔离环境再跑一遍冻结 verify(不过 ⇒ `merge_failed` 转人工)→ 断言主仓未动(`merge-base == HEAD`)且主仓已跟踪文件干净(有未提交改动 ⇒ 转人工)→ `git commit-tree` + **`git merge --ff-only`** 到主仓当前分支(只快进、不改写历史;提交信息形如 `saydo: merge <taskId> (S3 approved)`)→ 再断言 HEAD 树 → 「交付了」。首次使用要先在本机「注册本机批准凭据」(一次性)。
   - **人工合并交接**(没注册 passkey、或你想自己来):它给你一个交接入口,你在终端自己 merge;之后点「核验」,daemon **现读**主仓 `HEAD` 的树与批准时落库的 `treeSha` 对账,一致才推进到「交付了」,不一致拒绝并留痕(防「已回滚却显示完成」)。
4. **它不 push、不开 PR**:全部实现里没有推送远端或创建 Pull Request 的路径;agent 若自己敲 `git push`,按 S2(feature 分支)/ S3(保护分支或 force)上浮或拒。推远端、开 PR 是你验收合并后自己做的事。
5. 语音面**永不渲染**合并按钮;局域网 / tailnet 手机面调用合并动作会被拒并审计。

### 7.4 验收命令只认登记模板(防命令注入与「自证通过」)

- 在 `project.toml` 登记:`[[verify.entries]] name="test" source="package_script" ref="test"`(`source` 只有 `package_script` / `justfile` 两种);Brain 只能**选**登记项,任何拼接串拒绝。
- **内容冻结**:派发 / 认领时冻结每条 verify 的 argv + 脚本内容 digest + 相关框架配置文件(vitest / vite / playwright / jest / tsc / eslint / pytest / ruff / mocha 等已知 config)的 digest;执行前重读重算,不符 ⇒ fail-closed。agent 合法改了测试脚本 ⇒ 拦下转 blocked 回叫「要改验证命令,需要你重新拍板」(Plan Delta),不静默放行也不静默死。
- 没登记任何 verify 的 coding 任务**不 settle**,转 blocked 叫人——独立验收 oracle 是门禁,不是可选项。
- verify 跑在比 agent 更窄的环境(HOME 换成一次性空目录)。诚实边界:绝对路径直读与出网仍不可挡,完整隔离 = 后续容器 / sandbox。
- 合并前会**再跑一次**冻结 verify。

## 8. 审批与安全

### 8.1 风险按效果分级 S0–S3

语音是弱认证通道(在场任何人都能说话、识别有误听率),所以审批权按风险分级;**分级由效果计算,不按动作名**:`效果 × 目标(圈内 / 圈外)× 触及数据敏感度 × 身份凭据 × 触发的下游(CI / 部署)× 成本`。

| 级别 | 典型(缺省,可被效果升级) | 审批方式 |
|---|---|---|
| S0 读 | 读代码、只读命令 | 自动放行 |
| S1 写(worktree 内) | 改代码、跑登记的 verify、本地 commit | 自动放行 |
| S2 出圈但可逆 | 装依赖、push 到 feature 分支、未识别的命令 | 逐步确认档:屏幕 / 语音确认(缺省 45 秒窗,超时即拒);直达验收档:命中念读签署的预授权清单则放行(当前未在语音链启用,见 §8.4) |
| S3 不可逆 / 外部影响 | 合并到保护分支、force push、部署、花钱、删数据、对外发消息 | **必须在本机屏幕完成 WebAuthn 认证**(平台可用方式如 Touch ID/设备密码、Windows Hello、passkey/安全密钥);语音绝不放行——同一麦克风的复述不构成独立认证因子 |

升级规则:触及 `.env` / 凭据 / 客户数据 ⇒ 至少 S2;依赖带 postinstall ⇒ 至少 S2 且必须出清单;push 触发预览部署 ⇒ S3;push 到保护分支 ⇒ S3。

### 8.2 Gate 0:能不能开工的总闸

Gate 0 不是运行期的命令门,而是**开放自主派发前必须关闭的六项安全门禁**,每次派发前都检查 `[gate0] enabled = true && bypass = false`,**代码里没有 bypass 分支**(配置文件损坏时按「未关」处理,拒派发而不是带宽松缺省继续):

| 门 | 内容 |
|---|---|
| G1 身份 / 授权 | 单用户假设显式化;S3 只走屏幕;控制台能力令牌 + Host/Origin 白名单 + DNS rebinding 防护;审批门完整性(socket 裁决、canary) |
| G2 跨边界事务幂等 | 回叫 outbox 唯一、事件游标 + 崩溃重放 |
| G3 独立 acceptance oracle | verify 白名单 + 内容冻结 + Plan Delta;生成方不自评 |
| G4 secret / egress 隔离 | agent 环境剥离凭据;出口能力按适配器如实声明(Cursor = uncontrolled,不假绿);setup 缺省 `--ignore-scripts`;TTS 脱敏 |
| G5 意图审计 | 转写 → 收据 → 任务三方留痕贯通;审计表不可变(触发器) |
| G6 删除 / 同意传播 | 「忘掉这个」硬删通路;录音 / 转写分别同意;备份按保留期整份过期 |

### 8.3 每条 shell 命令怎么过门

- 物理链:worktree 内 `.cursor/hooks.json` → daemon 供给、放在 worktree 之外 `~/.saydo/tier1/` 的 gate 脚本(与 agent 同用户,**当前不保证 agent 不可写**——诚实口径)→ unix socket → daemon 裁决;补偿控制 = 每次门请求都重算脚本完整性,漂移 ⇒ 取消全部活跃任务。
- 分类器把命令**保守**推导成效果:识别不出的一律按 S2 上浮;词面含 `.env / credential / secret / .pem / .key / id_rsa / id_ed25519 / .npmrc / .netrc / keychain / token` ⇒ 敏感升级;force push / 绝对路径删除 / 管道执行远端脚本 ⇒ S3;复合命令(`&&` / `;` / `|` / 子 shell)按**最高风险段**归类,任一段不可判 ⇒ 整条不可判。`node / python / tsx / just` 等任意代码执行入口也按 S2(`node -e "fetch(…)"` 与 `node build.js` 词面无法区分);已登记的 verify(如 `just test`)在门里**先于**分类表匹配,仍自动放行。
- 裁决:S0/S1 放行;S2 上浮(45 秒,超时 = 拒);S3 直接拒;风险计算异常 = 拒。**每条命令独立审批,一次放行不得长期有效**。
- 第四个动作「**修改后批准**」:你可以把命令改一改再批,agent 收到编辑后的命令原样重试即命中这张单次收据。
- 每条 S2 一张收据,绑定父决策包 digest 与拍板轮次,接受即消费。

### 8.4 执行模式两档

| 档 | 语义 | 现状 |
|---|---|---|
| **逐步确认**(出厂默认,口语「每步问我 / 盯着点」) | 每个出圈动作(S2)前置确认 + 计划步骤边界确认;agent 提问即时上浮;S0/S1 任何档都不问(worktree 已兜底) | **现在可用**——当前全部任务都按此姿态执行 |
| **直达验收**(口语「一口气跑完」) | 拍板即授权整包:决策包逐项声明并**念出**本任务预计的 S2 效果类(带约束参数:装哪些包 / 推哪个分支模式),随包 digest 签署;运行中命中清单自动放行(落预授权收据,执行点复验有效期),未命中或被升级的拒绝并反馈 agent 换路 | **进行中**——预授权清单的合同与匹配逻辑已落,但语音拍板环尚未接入念读签署,组包恒为逐步确认;拍板时选「一口气」会被如实告知走屏幕或改逐步确认 |

不变量(任何档位不得触碰):效果分级、S3 屏幕强认证、三熔断、verify 白名单、Plan Delta 重授权、回叫优先级、状态词纪律、两把钥匙、Gate 0。**预授权范围永远属于决策包、由你听到并签署;模式只是这份清单的启用开关**——否则「切到全自动」就成了一句话扩权通道。默认收紧(逐步确认)是对冲自动化偏信;「信任毕业制」被明确否决。

### 8.5 三熔断与停靠老化

- **三熔断**(任一触发 ⇒ cancel ⇒ 带上下文进 blocked 叫你):**活跃墙钟**(缺省 45 分钟,审批 / 提问停靠期停表)+ **回合数**(缺省 80)+ **API 成本**(来自决策包封顶,缺省 20 元;只约束 API 计费部分,订阅调用靠前两者兜底)。项目级可覆盖三者。「15 分钟无事件」只能抓挂死,抓不住「活跃地兜圈烧钱」,所以三者缺一不可。
- **停靠老化**:等你验收 / 等你解 blocked 超过 `park_aging_hours`(缺省 72 小时)⇒ 取消并转草稿卡(停靠占着 worktree 与同仓队列,不能无限悬挂);长停靠恢复时强制复验收据有效期。
- **决策包有效期** `proposed_ttl_hours`(缺省 24 小时),过期作废;同项目新提议 supersede 旧的。

### 8.6 其他安全纪律

- **TTS 脱敏**:token、密钥、客户数据、完整本机路径永不进语音(路径说「某个配置文件」,密钥说「一处凭据」)。
- **控制台调用方身份**:每次请求 / WS 握手校验能力令牌,Host / Origin 白名单,防恶意网页绕过语音授权直调 daemon;缺省只监听本机回环。
- **记忆写路径**:第三方内容(仓库 / 网页 / 资料)永远不能定义「你喜欢什么 / 允许什么 / 凭据在哪」;候选 → 受信需人批(§9.3)。
- **审计与日志分流**:日志可轮转,审计表不可变;敏感 payload 只记 digest 不记原文。

## 9. 记忆与账本

### 9.1 四层记忆(M0–M3)

| 层 | 名称 | 存储 | 生命周期 | 内容 |
|---|---|---|---|---|
| M0 | 用户档案 | 记忆账本中的跨项目层(`~/.saydo/saydo.db`;`~/.saydo/profile.md` 已纳入备份保护范围,作为人可读投影规划中) | 跨项目、长期 | 偏好、技术栈、沟通风格、术语热词(顺带提升识别准确率) |
| M1 | 项目知识底座 | `<workspace>/.saydo/knowledge/`(Markdown,人可读;`m1-notes.md` 为账本投影) | 项目级、长期稳定 | 项目目标 / 约束、代码库理解(架构 / 模块 / 术语)、关键决策、领域知识 |
| M2 | 累积对话知识 | 产物库(`~/.saydo/artifacts/` + 主库索引,按项目归属) | 项目级、随对话增长 | 每次对话新生成的方案 / 决策、调研资料(版本化、可召回) |
| M3 | 会话工作记忆 | 上下文窗口 + 转写(`~/.saydo/sessions/<id>.jsonl`) | 单次会话 | 最近 N 轮、当前任务 |

**Context Pack** = 每轮从 M0 + M1 + M2 挑相关切片 + M3 最近几轮拼进窗口(带版本,失配则重取);检索用 SQLite FTS5(trigram,BM25)答「我们决定过什么」,代码事实永远现场 `rg` 现读、不进知识库(无陈旧税;短于 3 字符的词靠 rg 兜底)。

**真相源**:记忆域以 **append-only 记忆事件账本**为真相,Markdown 文件与 SQLite 索引都是可重建投影;源码与 Git 永远是代码事实的最终权威。`m1-notes.md` 是单向投影——直接改文件不会回写记忆,要改就对它说(P0 没有文件监听)。

### 9.2 奠基(Foundation)[现在可用 · 机械管道]

第一次接触一个项目时触发,阻塞式(「学习中」是一等会话状态,会说清在学什么、进度、还要多久):

- 扫文件清单与语言分布;按白名单读关键文件(README / AGENTS.md / CLAUDE.md / package.json / pyproject.toml / justfile / Makefile / Cargo.toml / go.mod 等,单文件摘录上限 6000 字符);
- 反向吸收你仓里已有的 AGENTS.md / CLAUDE.md / `.cursor/rules`;
- 生成四份知识文档:`core.md` / `inventory.md` / `build-test-run.md`(标注「未运行验证」)/ `conventions.md`;
- 预算:缺省 5 分钟墙钟 + 200k token,超限产出 partial 并如实写「还没读完,按已读部分回答」;
- **按 generation 原子切换**(`knowledge/gen-N/` + `current` 链接;失败保留旧代),`knowledge/` 目录自带独立 git 历史;奠基换代后,依赖旧代知识的就绪绑定自动失效(不拿过期理解开工);
- 在你的 AGENTS.md 里放一段幂等指针块(`<!-- saydo:knowledge:begin … end -->`)指向知识底座,写失败(只读仓 / 权限)静默降级不翻转已发布的 generation。
- 会话预热(每次,轻):按 `git diff` 四组种子(已提交 / 暂存 / 未暂存 / 未跟踪)增量刷新;rebase / force-push 不会被误判为「全删」。

诚实标注:**当前奠基是确定性的机械管道(清单 + 摘录 + 文档生成),不含由沉思档模型做的 LLM 深度研究**——后者是规划中的下一档。

### 9.3 记忆写路径:候选 → 受信(安全边界)

持久记忆的头号风险不是陈旧,而是**来源污染与跨项目泄漏**。写路径是:

```
raw evidence(不可信)→ candidate(带来源 / 引文 / 信任级 / 有效期)→ 冲突 / taint / policy 检查
→ 低影响的项目本地事实可自动入库;偏好 / 决策 / 外部事实需你批准 → trusted
```

- 直入 trusted 的只有**你亲口说的**(`user_stated`)与**低影响机械事实**(git 跟踪的仓内文件 / 你的编辑,且是事实性陈述);命中指令 / 副作用词(`curl | sh`、`rm -rf`、`sudo`、`git push`、「部署 / 上线 / 删库 / 迁移」…)一律降为候选;来自网页 / agent 输出 / 导入的一律候选。
- **M0 红线**:第三方内容永远不能定义「你喜欢什么 / 允许什么 / 凭据在哪」;M0 只接受你亲述或你批准的。
- 会后提炼 = **机械提名 + 你批准**(不是自动沉淀):会话挂起时按决策性词表(「决定 / 定了 / 就用 / 以后都 / 统一用 / 拍板」…)提名最多 5 条候选,你在记忆库页逐条批准 / 拒绝(拒绝 = 软遗忘,否定不复活)。
- **遗忘**:失效标记(不删行,投影排除)/ 软遗忘 / **硬删**(「忘掉这个」:tombstone + 历史正文就地覆写为 `[forgotten]` + 从全文索引、投影、源快照正文与评估记录里清除)。诚实边界:自动快照备份是不可变整体文件,硬删不逐条清备份,靠保留期(缺省 30 天)到期整份删除闭合。

### 9.4 一件事、义务与四色账本 [现在可用]

控制台主轴是「**一件事**」(Focus):一件持续关注的事,生命周期 captured / active / dormant / closed / abandoned / archived;可以关联 0..N 个项目,也可以不属于任何项目(生活筹备、调研都行);下面挂**义务**(谁欠什么:owner = 你 / AI / 外部,状态 open / in_progress / waiting / deferred / blocked → resolved / superseded)与**期待**(做成什么样的验收标准,改了要 AI 复述影响再确认)。

**四色账本**(今天页)不是独立的表,而是从账本现算出来的「球在谁」视图:

| 色 | 含义 | 来源 |
|---|---|---|
| 橙 · 等你拍板 | 需要你回答 / 决定 | 待确认卡、等你验收的任务、owner=你且需要决策 / 补充的义务、任何被前置终止(blocked)的事 |
| 蓝 · 你欠的动作 | 需要你动手 | owner=你、需要行动的义务 |
| 绿 · AI 正在办 | 球在 AI | 排队 / 运行中的任务、owner=AI 的未结义务 |
| 灰 · 等外部回音 | 球在别人 | owner=外部的未结义务 |

- 「帮我记一下 / 记一条 / 别忘了」⇒ 当轮立即提议落账(决定 = decision,待办按归属,要查证 = check),经**确认卡**(你点头或倒计时)写入;同一句里多条可一卡确认、全有或全无。若当前对话工具面没有落账工具,会降级先记进记忆库并告诉你「立起来后可以再挂到账上」。
- **销账**:义务由 AI 提议 resolve(done / abandoned / 不再适用)经你确认;AI 自己的义务标 done 必须带可验证证据(产物 / 任务 / 事件三查);叙事性修订不销账。绿 / 灰条目可「知道了」让它从收件箱消失,橙 / 蓝不能 ack、只能靠源数据变化消失;条目升级(绿 → 橙)时无视历史 ack 必然重现。
- **确认卡过期不蒸发**:屏幕档确认卡超时(10 分钟)会按归属降格落到对应色区(「待你补一句」形态);语音档 5 秒倒计时自动执行属设计内;防风暴:同会话同事日限 5 条,超限聚合。
- **多步接续**:你确认一步后 AI 自动续走下一步,连续自动最多 3 步,到上限就停下来挂账(防失控)。

## 10. 验收与交付

### 10.1 状态词纪律(硬约束)

| 状态 | 含义 | 它怎么说 |
|---|---|---|
| `run.completed` | agent 进程退出(闸门 / 产物可能还没 settle) | **不播报「完成」** |
| `ready_for_review` | 验收闸门跑完、产物落盘确认,等你验收 | 「执行和检查都跑完了,等你验收」 |
| `task.done` | 你验收 + 合并 / 归档后 | 「这件事交付了」 |

执行任务不预估剩余时长,只说已发生(「跑了 18 分钟」);成本 unknown 说「还没有确切数字」,不说 0。

任务状态机(coding 类,节选主干;另有 confirmed / paused_step_boundary / merge_failed / cancel_settled / superseded 等状态):

```
queued → running → ready_for_review → review_approved_waiting_merge → merging → task_done
              ↑            │ 要改:同任务新一轮(复用 worktree)
              └────────────┘
  任一阶段:blocked(等你:S2 超时 / 提问 / 熔断 / verify 缺失)· failed(可重试)· cancel_requested(作废,worktree 保留)
```

### 10.2 证据视图

任务验收面按**验收标准组织**:左边标准、右边证据(diff、测试结果、它自己做的决策清单、未验证项)。纪律:agent 自报的证据用空心标记以示降权、可推翻;没绑上证据的项诚实标 unknown,不显示伪精确;决策清单与口播**同源**(落库的 `decisions`),口播与上屏一致。

### 10.3 口播摘要三层

1. **一句话**(≤40 字,纯规则):「改了 5 个文件,测试 12/12 过,1 个待确认决策」——文件数来自 git、测试数来自独立闸门,未知标 unknown 不写 0;
2. **走读**(150 字口语稿,你说「讲讲」时);
3. **决策清单**(每条 = 决策 + 理由 + 可推翻动作,≤5 条;从事件流机械抽取 → 廉价档惰性提炼一次 → 落库)。

原始事件流**永不**直接进对话模型;叙事模型只做措辞,不得产生规则层没有的数字。

### 10.4 验收三态与合并

通过 / 要改(同任务新一轮,复用 worktree,意见进下次 prompt)/ 作废;通过后按 §7.3 的两条路合并。写作类另有「逐节裁决」屏障:settle 不等于全绿,未逐条裁决不能通过。

## 11. 回叫与通知

- **触发**:只由 settle 后的状态触发(`ready_for_review` / blocked / failed 等),runner 退出不算;durable outbox,重放幂等,daemon 重启只叫一次。
- **优先级**:blocked(等人)> failed > 待审批 > `ready_for_review` > 进度(默认不通知)。
- **升级链 [现在可用]**:**L0 在线语音回叫**——控制台在线、语音管线健康且你没在说话时,它直接开口,第一句就是回叫原因;30 秒没应答升级。**L1 macOS 桌面通知(系统通知中心)+ ntfy 手机推送**——任一送达即算已通知(桌面通知首次弹出可能需要在系统设置里允许通知);「今天」页橙区始终常亮。L2 电话与移动端来电式汇报规划中。sweep 每 15 秒扫 outbox,投递失败留队重试。
- **ntfy**:`.env` 填 `NTFY_TOPIC`(随机串,手机 ntfy App 订阅同名主题)与 `NTFY_SERVER`(缺省 `https://ntfy.sh`,可自托管);消息 JSON POST(中文标题走 body),优先级 blocked / failed = 4,待验收 = 3;**深链只带路由、绝不带能力令牌**;标题经与 TTS 同一套脱敏(公网 topic 明文可订阅)。这两个键当前不在向导白名单内,需手改 `.env`。
- **PagerDuty 式状态机**:pending → notified → acked → resolved;**ack 只停止升级,不等于解决、更不等于授权任何动作**;ack 后 30 分钟(`callback_resolution_timeout_min`)未解决重新升级。ack 的途径:「通知」页点「知道了」,或你直接开口回话(语音回叫后的开口即视为已应答);任务离开待验收 / blocked 被解决时自动销账。
- **免打扰** `[dnd].window`(缺省 `23:00-08:00`,支持跨午夜):窗口内不出声、不弹桌面,只发一条低优先级 ntfy(注明免打扰时段)并 snooze 到窗口末;窗口结束后按队列顺序补叫;设备不可达不算 DND,走短周期重试。
- **拦截不等于叫人**:危险动作先把原因反馈给 agent 让它换路,同一意图被拦 ≥ 2 次才进回叫链。
- 输出仲裁 [现在可用]:你这轮话还没说完时不插播语音,该条降级走桌面 + 推送;「会议软件占麦」检测暂无数据源,恒按未占处理(如实)。

## 12. 语音

### 12.1 三档语音能力

| 档 | 条件 | 说明 |
|---|---|---|
| **打字**(始终可用) | 无 | 任何时候都能打字;键盘自带的系统听写也能用 |
| **浏览器系统语音**(零配置) | 浏览器支持 `SpeechRecognition`(Chrome / Safari) | 按住说话 → 浏览器识别 → 文字通道进对话;朗读用 `speechSynthesis`。质量一般 |
| **云端级联语音**(更准更自然) | `.env` 填火山豆包三键 + 起 Python 语音管线 | ASR = 火山豆包 sauc 流式(带**热词偏置**:你纠正过的术语、项目符号自动注入,实测术语召回 +10 点);TTS = 豆包 seed-tts-2.0 v3 双向流式(首句先播、可随时打断);当前识别形态 = 按住说话松手后整段识别(实时字幕规划中) |
| **手机原生语音** | iOS / Android 壳 | 走系统语音识别与合成;设备端或联网处理取决于应用 / 系统设置与厂商实现,联网时按系统厂商条款处理;不需要 Python 管线 |

### 12.2 采集与轮次

- 桌面三种触发:**点击 - 再点击**(toggle)/ **键盘长按**(按住空格)/ **免手 VAD**(能量 RMS + hangover 状态机 + 语义「说完了没」词表 + 显式「**说完了**」按钮兜底;中英混说默认延长静音阈值 900ms);嘈杂环境走按住说话。
- 录完二选一:「**发送**」(语音气泡先进对话,转写异步补挂,AI 即刻开跑)/「**转文字改一改**」(转写只进输入框,改字后发送);「取消」彻底丢弃。转写在途必有显式「转写中」状态;空转写 / 超时给「没听清」。
- **打断**:TTS 立停;未播完的文本标 `heard=false`、不进对话事实;被打断的授权类播报(S2 / 预授权清单)立即作废当前确认,随后的裸肯定「好 / 可以」不消费旧收据。
- **重听上一问**:原文重放,不重新生成。
- **误听纠错**:说「不是 X,是 Y」 ⇒ 纠正进 M0 热词(`热词:X->Y`),下次识别带偏置;连续误听降级打字。
- 会话空闲 45 秒或你说「先到这里 / 先这样 / 收工」即挂起(零成本),收尾语必含状态:「任务在跑,到验收点我叫你」。

### 12.3 口播纪律

人格 = 幕僚长:简短、口语、中文、不念代码、先结论后细节;口播 ≤ 30 秒;清单 > 3 项转屏幕;选项一次最多念 3 个。**TTS 脱敏红线**:token / 密钥 / 客户数据 / 完整本机路径永不进语音;PEM 块、`sha256:`、Bearer、`sk-`/`ghp_` 等前缀、云访问密钥、绝对路径、11–19 位数字串、≥20 位裸密钥串自动替换。

## 13. 手机与远程

### 13.1 今天能做什么

- **局域网直连**(`SAYDO_MOBILE_LAN=1`,§4.7):手机浏览器或自行构建的 App 壳打开 `http://<内网IP>:47100/?token=…`(桌面控制台可出二维码;**只对 RFC1918 私网地址出码**,公网 / CGNAT 不出)。手机面是移动壳路由(`#/m`):今天四色、一件事详情、最近对话回放、最近记忆;发文字 / 原生语音转文字进对话;对立账 / 记账类确认卡点头 / 撤回。LAN 面 HTTP 路由白名单极窄(只读投影 + 首跑开场白),写口、设置写口、S3、全文屏幕文本一律拒。
- **tailnet(Tailscale)面,进行中**:目标合同是 `config.toml` `[t2].tailnet_hosts = [...]`(纯主机名 / IP 显式白名单,**禁通配**,含任一非法项整面不开)+ `[t2].listen`;`just t2-pair` 出配对 URL(一次性注入手机本地会话,深链之后不带令牌)。目标 tailnet 面可看任务、批 S2 级审批(review / decide / 记忆候选批准),合并链动作与 `/dev/*` 注入通道 403 引导回桌面。开发机的 Tailscale / MagicDNS 底座已就绪,但当前 HEAD 的 setup probe 仍会拒绝 tailnet 配置,尚不能作为受支持入口。
- **S3 永远不在手机**:四重断言(socket 必须本机回环、Origin 精确 `http://localhost:<port>`、来源面 `local`、rpId 固定 `localhost`),拒绝文案「S3 操作只在本机受信终端完成——回到桌面屏幕操作」;S3 工具也不进对话模型的工具面。
- **诚实边界**:当前 LAN 面是「局域网明文 HTTP + 长期能力令牌」的 dogfood 临时边界,**没有设备配对 / 逐设备身份 / 端到端加密**;删令牌重启即全员掉线。不要暴露到不受信网络。

### 13.2 App 状态

| 端 | 状态 | 说明 |
|---|---|---|
| iOS | 未提审 | 原生 SwiftUI 壳(扫码配对、原生语音识别 / 合成、Web 容器)工程存在;App Store 记录已建(中文店名「说到」),无可提审包 |
| Android | 未提审 | Kotlin 壳可构建;Play 应用记录已建(`com.octoooo.saydo`),无可提审包 |
| HarmonyOS | 未提审 | HarmonyOS NEXT ArkTS 壳;AppGallery 记录与发布证书已就绪,Profile 未建 |

三端共同的不可提审原因:无生产配对 / 信任层、明文 LAN、审核夹具未执行。上架前要做的:设备配对(一次性票据 + Noise XX 互认证 + 桌面人工确认 + 信任设备免确认重连)、推送隐私合同(payload 只带 opaque id)、来电式汇报(PushKit 唤醒 + CallKit 来电 UI)。这些都是规划中。

### 13.3 设计原则

沟通天然是移动的,执行天然是固定的:手机只做沟通面(说话、看进展、点头确认)。局域网手机面不裁决 S2/S3;语音确认按 canonical 封顶 S2;tailnet 配对屏幕面在支持后同样封顶 S2;合并、删除等 S3 始终只在本机认证屏幕。重活留在你的电脑;手机断连不影响后端执行。远程通道默认只读;电话 DTMF(规划中)只做 ack / snooze / 拒绝,不做任何审批。

## 14. 隐私与数据

- **没有服务器、没有账号、没有埋点**:代码里没有任何遥测 / 统计 / 广告 SDK;开发者无法访问、也不收集你的数据。
- **数据在哪**:
  - `~/.saydo/saydo.db`(任务 / 审批 / 成本 / 记忆事件 / 审计等主库)、`~/.saydo/sessions/*.jsonl`(转写,目录权限 0700)、`~/.saydo/.cap-token`(控制台令牌,0600)、`~/.saydo/logs/`、`~/.saydo/backups/`;
  - `<workspace>/.saydo/`(知识底座 / 奠基 / worktrees / project.toml);`~/.saydo/{artifacts,snapshots,assessments}`(产物 / 源快照 / 就绪深评记录);
  - 第三方 AI 由你的电脑直接调用(CLI 订阅或 API key),适用你与服务商的协议。
- **语音的数据去向(两端不同,请分清)**:手机端与浏览器使用系统或浏览器提供的语音识别;设备端或联网处理取决于应用 / 系统 / 浏览器设置与厂商实现,联网时音频按相应厂商条款处理。**桌面端配了火山豆包 key 时,音频经 WebSocket 发到火山引擎云端识别与合成**——这是你自己配置、你的电脑直连的第三方服务。缺省 `store_audio = false`(当前版本根本没有写录音文件的代码路径)、`store_transcript = true`(可关;关了轮内流程照常、只是不落盘,并如实标注)。
- **什么流量会出网**(以下是主要路径,不是穷举):① 你接入的 AI 上游——CLI 订阅工具走它们各自的官方通道,API key 直连你配置的端点;② 系统 / 浏览器联网语音识别,以及你启用桌面云端语音时的火山豆包识别与合成;③ 可选的 ntfy 推送(你配置的 topic,标题经脱敏)。
- **审计不可变**:审计表有数据库触发器禁 UPDATE / DELETE;敏感 payload 只记 digest 不记原文;每条带 actor。日志可轮转,审计不可变。
- **调用方身份**:控制台能力令牌 + Host / Origin 白名单 + DNS rebinding 防护;缺省只监听本机回环;LAN / tailnet 面另有来源门(§13)。
- **备份**:每日自动快照(SQLite 在线备份 + sessions + 各项目 foundation / knowledge),保留期缺省 30 天;`just backup` 手动。
- **删除**:「忘掉这个」硬删传播到索引 / 投影 / 源快照 / 评估记录;备份按保留期整份过期(如实告知);完全重置 = 删 `~/.saydo`(令牌轮换、设备掉线)。
- **迁移**:新机装好后把 `~/.saydo/`(或某份备份)拷回即可;令牌与执行器锁定副本需重新登记;各项目的 `<workspace>/.saydo/`(知识底座 / 奠基 / worktrees)随项目目录走。
- 完整隐私政策见 `/privacy/`。

## 15. 费用

- **软件**:桌面服务开源免费;App 免费、无内购(规划中)。
- **AI 费用去向**:
  - **订阅 CLI(BYOA)**:走你已有的 Codex / Claude / Cursor / Grok / Gemini / Qwen / Copilot 订阅额度,零额外费用;账本显示「订阅额度内」;撞限流该次调用如实报错,不偷偷转计费。
  - **API key**:按各家账单;账本按 `[pricing]` 单价表估算(缺省不填 = 显示「还没有确切数字」,不编数);每个任务有成本封顶(缺省 20 元)+ 活跃 45 分钟 + 80 回合三熔断。
  - **语音(可选)**:火山豆包 ASR / TTS 按你的火山账号计费;浏览器系统语音免费。
  - **推送(可选)**:ntfy 公共服务器免费 / 自托管。
- 「说到」不加价、不经手、不代充。**放外人用之前先确认额度**:开发类请求会真实派发执行任务、消耗订阅或 API 额度。

## 16. 路线图与完成度总表

| 能力 | 状态 | 备注 |
|---|---|---|
| 桌面服务(daemon + 控制台)· macOS / Windows / Linux | 现在可用 | 源码形态已经可运行;v0.1.0-rc.11 固定 URL 仅在 GitHub Release 出现且发布检查全绿后生效。npm registry / Homebrew 与桌面 App 壳仍规划中;常驻安装(launchd)与系统通知目前只有 macOS 实现 |
| 四推理槽 API 供给(OpenAI 兼容 / OpenRouter) | 现在可用 | |
| 四推理槽 CLI 订阅供给(Codex / Claude / Cursor / Grok / Gemini / Qwen / Copilot) | 现在可用 | 对话档走 CLI 为慢速文本模式 |
| 首跑资源画像向导(三种方案卡 + 高级逐槽) | 现在可用 | |
| 一件事 / 义务 / 期待 / 四色账本 / 确认卡降格 / 多步接续 | 现在可用 | |
| 奠基(机械管道)+ M1 知识底座 + AGENTS.md 互通 + 会后提名批准 + 遗忘 | 现在可用 | LLM 深研档规划中(方案在拟) |
| 类型就绪清单 + 规则层 + 异族深评 + 复述确认绑定 | 现在可用 | |
| 决策包(预览 / 计划 / 成本 / 风险 / 验收标准 / 轻量小样) | 现在可用 | 小样与计划同源机械渲染;控制台「看小样」+ 本机同轮上屏 |
| Cursor CLI 执行器 + worktree 隔离 + 命令效果门 + 三熔断 + verify 冻结 | 现在可用 | |
| 验收证据视图 + 三层口播 + 本机认证合并卡 + 人工合并核验 | 现在可用 | 本机认证卡真人过卡待 owner 触点 |
| 逐步确认档 | 现在可用 | |
| 直达验收档(预授权清单念读签署) | 进行中 | 合同与匹配逻辑已落,语音拍板环未接 |
| 回叫升级链:在线语音回叫 → macOS 桌面通知 + ntfy 手机推送;免打扰;应答(ack) | 现在可用 | 语音回叫需控制台在线 + 语音管线健康;30 秒未应答升级;输出仲裁同批落地 |
| 云端级联语音(豆包 ASR/TTS)+ 浏览器系统语音 + 热词纠错 | 现在可用 | 实时字幕、Silero VAD 规划中 |
| coding 类型 | 现在可用 | |
| writing 类型(窄版) | 现在可用(需开能力门) | 引证 / 归属合同等全量规划中;真人全链待验 |
| research / marketing / planning / general 执行合同 | 规划中 | 上游采访 / 立账 / 调研可用 |
| 局域网手机面(浏览器 / 壳) | 现在可用(dogfood 边界) | 无配对 / 无 E2E |
| tailnet 薄版 | 进行中 | Tailscale / MagicDNS 底座已就绪；当前 HEAD 的 setup probe 仍拒绝 tailnet 配置，尚不能作为受支持入口 |
| Claude Code 执行器 | 收口中 | 生产执行主流程、审批门、恢复、记账、自检与控制台已接线;最终 live conformance 尚未收口 |
| Codex 执行器 / Hopper 批式路线 | 规划中 / 休眠 | |
| provider-neutral 原生执行器 | 规划中 | |
| 设备配对 / E2E 加密 / 推送隐私合同 | 规划中 | |
| iOS / Android / HarmonyOS App 上架 | 规划中 | 商店记录已建,壳工程存在 |
| 来电式语音汇报(PushKit + CallKit) | 规划中 | |
| 电话回叫 / S2S 语音引擎 / 本地全栈语音 / 唤醒词 | 规划中 | |
| 对话车道 Quick / Guided / Explore | 规划中 | 只有埋点 |
| 主动巡检 / 多人会议旁听 | 规划中 | |

## 17. 常见问题与故障排查

**这是语音输入法吗?** 不是。语音只是入口;后面是理解上下文、立账、判断就绪、驱动执行、组织验收的闭环。

**是把我的项目上传到「说到」自营云端代跑吗?** 不是。没有承载产品数据的「说到」自营云后台;重活和核心持久数据在你的电脑上;你主动配置的第三方 AI、系统或浏览器语音识别、推送服务等例外由你的设备直连并适用对应服务商条款。

**需要什么前提?** macOS / Windows / Linux + Node 22 + 一个已登录的 AI CLI(或一个 API key);常驻安装与系统通知目前只有 macOS 实现。语音和执行都是可选增量(§4)。

**不配任何 key 能用吗?** 能:本机有任一已登录 CLI 即可零 key 开聊(对话每轮 15–25 秒的慢速文本模式);语音走浏览器系统语音或打字。

**它怎么知道「办完了」?** 执行和检查都跑完、产物落盘,它说「等你验收」——不说「做完了」;你点头、过强认证合并,才是「交付了」。

**它会不会偷偷花钱?** 订阅调用不产生费用、撞限流只会如实报错不会转计费;API 调用有每任务成本封顶 + 活跃时长 + 回合三熔断;S3(花钱 / 部署 / 删数据 / 对外发消息)必须你在屏幕上强认证。

**它会 push 到 GitHub 或开 PR 吗?** 不会。它在 `saydo/<taskId>` 分支的 worktree 里改代码;合并到你当前分支要你用本机认证确认或自己 merge;push / PR 是你之后自己做的。

**对话每轮要等十几二十秒,是卡了吗?** 不是。对话档走 CLI 订阅就是慢速文本模式(15–25 秒);界面有慢速徽标;桌面端单次 CLI 调用 120 秒上限后明确报错(手机页 90 秒提示重发)。想要秒级对话给对话档配一个 API key(§5.3 方案二)。

**界面说「仅恢复模式 / recovery-only」。** 活动配置非法(TOML 坏了、参数越界、项目覆盖冲突等):daemon 不退,只留健康探针、控制台静态页与设置自救写口;对话、派发、合并、恢复任务全停。去设置页按提示重建安全配置或清理非法项目覆盖,再重启。

**向导说某个 CLI「可识别,暂不能当模型供给」。** 该 CLI(如 kimi / opencode)无法在执行前可证零工具,出于安全不接线;换一家或用 API。

**评估档一直 unarmed。** 看原因:同族未确认(勾 `evaluator_same_family_ack` 或换家族)/ CLI 评估器缺隔离确认(勾 `evaluator_isolation_ack`)/ 自检失败 / 实际模型家族上报 unknown。unarmed 不影响对话,只是就绪深评不武装。

**打开控制台白页 / 没反应。** 先 `curl -s http://127.0.0.1:47100/health`;不是 `ok:true` 就看 `~/.saydo/daemon.log`(tsx 冷启动 10–15 秒);确认 URL 带了 `?token=`、用的是 `localhost`。

**支持 Windows / Linux 吗?**(改 2026-08-22)支持。Windows 已完成原生 P0 适配并经真机全量验证,Linux 经 CI(node + python)全量验证,均可运行;常驻安装、系统通知等链路当前仍为 macOS 实现,后续按 ADR-003/ADR-004 逐批补齐。

**端口冲突。** `saydo status` 退出码 2 = 47100 被别的服务或另一个数据目录的 daemon 占着;不会自动换端口或杀进程,用 `--port` 换或停掉对方。

**手机扫码连不上 / 全部掉线。** 确认 daemon 带 `SAYDO_MOBILE_LAN=1`、手机与电脑同一私网;删过 `.cap-token` 会轮换令牌,重新扫码。

**拍板后没有起执行器。** 按 `[models.dev].agent` 分支检查:`cursor`(或留空,缺省即 cursor)须有非空 `[models.dev].model`、`[tier1].cursor_agent_bin` 锁定副本**绝对路径**与精确版本,并已登录;POSIX 门还要求 `jq` 与 `curl` 在 PATH。`claude_code` 须有 `[tier1].claude_bin` 实体**绝对路径**、`claude_pinned_version`、Claude 族 `model`,登录后跑 Tier1 自检写入身份登记。`codex` 执行器尚未实现,会明确 fail-closed 拒起。任一分支不满足时任务停在 queued 并给处方化日志,对话不受影响。

**任务停在 blocked。** 看原因:S2 等你确认超时 / 没有登记 verify / project.toml 坏了 / 工作区或 `.git` 不见了 / agent 提问 / 熔断触发。解了在任务页「重试 / 回答」。

**worktree 越来越多。** 设计上不自动删(便于捡回);自己 `git worktree remove <repo>/.saydo/worktrees/<taskId>` 清理。

**常驻(launchd)装不上。** `just daemon install` 需要 `uv` 才能一并装语音管线常驻;报「未找到 uv」时按提示用 `just daemon install --without-pipeline` 只装 daemon(云端语音不可用,系统语音与文本照常),或先装 `uv` 再重跑(§4.8)。

## 18. 开源与参与

- 仓库:`https://github.com/Octo-o-o-o/SayDo`(桌面服务:contracts / daemon / console / cli / pipeline 与全部设计文档、证据、过程档案同仓);执行后端候选 Hopper 为同作者独立仓。公开仓为**快照仓**(自 2026-08-20 起):逐提交过程史保存在私有归档,文档中引用的历史 commit SHA 在归档中解析(仓库 README「过程史与归档」有说明)。
- **许可证:Apache License 2.0**(含专利授权);「说到」/「SayDo」名称、印章 logo 与 `assets/` 品牌资产不在许可范围(Apache 2.0 第 6 条),衍生作品不得以原项目名义呈现;详见仓库 `LICENSE` / `NOTICE`。
- 工程约定:全仓零 emoji;状态词纪律;Gate 0 无 bypass;契约不分叉(类型只从 `@saydo/contracts` import);审计与日志分流;两提交法(代码提交 + 证据提交)。
- 本地开发:`pnpm install && pnpm -r build`,`just dev`(daemon + pipeline + console 热更),`just ci`(node + python 双矩阵 + emoji / 颜色 / 迁移门禁);发行验收 `pnpm --filter @saydo/cli verify:distribution`。
- 设计文档地图:`docs/01–11`(愿景 / 产品定义 / 架构 / 关键机制 / 路线 / 参考 / 选型 / 模块 / 数据契约 / 话术 / UI)+ `docs/adr/`。
- 反馈与支持:`support@octoooo.com`(请说明系统版本、是否已完成扫码配对;不要粘贴 API key、配对令牌或完整日志)。安全问题按仓库 `SECURITY.md` 私下披露(邮件标题注明 SECURITY),勿公开细节。

## 19. 术语与状态词对照(中英)

| 中文 | English | 说明 |
|---|---|---|
| 说到 | SayDo | 产品名 |
| 沟通面 / 执行面 | communication surface / execution surface | |
| 一件事 | Focus | 账本主轴 |
| 义务 | obligation | 谁欠什么 |
| 期待 | expectation | 验收标准的管理层 |
| 四色账本 | four-color ledger | 等你拍板 awaiting your call / 你欠的动作 owed by you / AI 正在办 AI working / 等外部回音 waiting externally |
| 奠基 | grounding / foundation | 项目知识底座建立 |
| 知识底座 | knowledge base(M1) | |
| 就绪 | readiness | |
| 决策包 | decision pack | |
| 拍板 | sign-off | |
| 逐步确认 / 直达验收 | step-confirm / direct-to-review | 执行模式 |
| 等你验收 | ready for your review | 状态词,不说 done |
| 交付了 | delivered | 合并 / 归档后 |
| 回叫 | callback | |
| 停靠 | parked | 等人期间 |
| 熔断 | circuit breaker | |
| 推理槽位 / 开发档 | reasoning slots / dev slot (executor) | |
| 订阅 CLI 供给 | BYOA (bring your own agent) | |
| 异族 | different model family | 评估器规则 |
| 能力令牌 | capability token | |

## 附录 · 速查表

| 项 | 值 |
|---|---|
| daemon 端口 | 47100(直起 daemon:`SAYDO_DAEMON_PORT`;`saydo` CLI:`--port`) |
| 控制台入口 | `http://localhost:47100/?token=$(cat ~/.saydo/.cap-token)`(`saydo open`) |
| 健康 / 就绪探针 | `GET /health`、`GET /readyz`(`voiceReady=false` 不算启动失败) |
| 数据目录 | `~/.saydo`(`--home` / `SAYDO_HOME`,绝对路径) |
| 配置 / 密钥 | `~/.saydo/config.toml` / `~/.saydo/.env`(模板在仓库 `templates/`) |
| 项目内目录 | `<workspace>/.saydo/{knowledge,foundation,worktrees,project.toml}`;产物 / 快照 / 深评记录 / 转写在 `~/.saydo/{artifacts,snapshots,assessments,sessions}` |
| 环境变量 | `SAYDO_HOME`、`SAYDO_DAEMON_PORT`、`SAYDO_MOBILE_LAN=1`(局域网手机面)、`SAYDO_DEV=1`(dev profile 双开关) |
| `.env` 常用键 | 模型:`OPENROUTER_API_KEY` / `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `DEEPSEEK_API_KEY`;语音:`VOLC_APP_ID` / `VOLC_ACCESS_TOKEN` / `DOUBAO_TTS_API_KEY`;推送:`NTFY_TOPIC` / `NTFY_SERVER` |
| 常驻 | `just daemon install / start / stop / restart / status / logs / deploy [sha]`(install 一并生成语音管线常驻配置;无 uv 用 `--without-pipeline`,§4.8) |
| 备份 | `just backup` → `~/.saydo/backups/<时间戳>/`;自动每日;保留 30 天 |
| 关停 | `lsof -t -iTCP:47100 -sTCP:LISTEN | xargs kill; pkill -f saydo_pipeline` |
| 熔断缺省 | 活跃 45 分钟 / 80 回合 / 20 元;停靠老化 72 小时;决策包有效期 24 小时;S2 确认窗 45 秒 |
| 分支 / 目录 | `saydo/<taskId>` @ `<repo>/.saydo/worktrees/<taskId>` |


---

# C. 维护注记(不入正式页面)

## C.1 待 owner 裁决 / 上线前必须处置的事实口径(按风险排序)

1. **已解除(2026-08-20)**:LICENSE = Apache-2.0 已落;隐私项按选项 C 处置后仓库已公开——`github.com/Octo-o-o-o/SayDo` 为干净快照仓(逐提交过程史在私有归档 `SayDo-archive`),处置记录见 `docs/plan/2026-08-20-repo-public-readiness.fable.md` §3.1。「开源免费 · 前往 GitHub」口径成立;Docs §18 无需改动。
2. **Hopper 仓(`github.com/Octo-o-o-o/Hopper`)可见性与许可证未核实**;B §18 只说「同作者独立仓」,未给 URL。若要给链接先确认公开。
3. **官网「驱动你已有的 AI:Claude Code、Codex、Cursor、Gemini CLI 等已登录的 AI 工具直接接入 · 现在可用」**:对**推理槽**成立(7 家 CLI 已接线);执行器层须继续拆写。**2026-08-22 更新**:Cursor 是当前稳定缺省;Claude Code 的配置、生产执行主流程、审批门、恢复、记账、自检与控制台已经接线,最终 live conformance 尚未收口;Codex 执行路线规划中,Gemini CLI 无执行计划。官网已按此写成「生产接线已落地、最终收口中」,不得再写「尚未接线」或提前写成稳定可用。
4. **已解除(2026-08-20)**:S1 批落地 Demo 小样(决策包同轮机械渲染 + 控制台「看小样」+ 本机同轮上屏);S2 批落地回叫升级链(在线语音回叫 → macOS 桌面通知 + ntfy;免打扰只推不响;「知道了」/开口即应答)。官网七步第 3 / 6 步可按原意保留,措辞见首页稿 B.3(2026-08-20 更新版);Docs B §3.2 / §11 / §16 已同步。
5. **官网「先深度研究透、沉淀成持久知识底座」**:当前奠基是确定性机械管道(清单 + 关键文件摘录 + 四份文档 + AGENTS.md 指针),LLM 深研档未做。Docs B §1.1 / §9.2 已如实标注;官网「先吃透,再办事」的措辞尚可,但「深度研究」四字偏重,建议改「先读透项目」一类。
6. **官网 FAQ「语音无需额外配置,浏览器即可用」**:成立(2026-08-13 起 VOLC 未配时回退浏览器 `SpeechRecognition` / `speechSynthesis`),但质量一般;Docs B §12 写成三档(打字 / 浏览器系统语音 / 云端级联)。官网可不改。
7. **官网 FAQ「手机扫码即连」**:需 daemon 带 `SAYDO_MOBILE_LAN=1` 启动、手机浏览器或自构建壳、仅私网;App 未上架。Docs B §4.7 / §13 写明条件;官网可加一句「(需在本机开启局域网访问)」。
8. **执行模式**:官网第 4 步未提模式,无须改;但仓内 02/04 口径「拍板时选直达 / 逐步」在生产是单档(组包恒 `step_confirm`,语音链拒直达)。Docs B §8.4 标「直达验收 进行中」。
9. **已解除(2026-08-20,public-readiness 批)**:模板已对齐当前实现(七家 CLI 供给示例、cursor 执行器、`[tier1]` 注释示例、评估档双 ack),经两轮零上下文评审收口;Docs §5.6 示例与模板同源成立。
10. **已解除(2026-08-20,public-readiness 批)**:DEPLOY 已改 `dist/cli.mjs`,并写清端口与控制台入口口径。
11. **已解除(2026-08-20,public-readiness 批)**:`install` 自动生成并装载语音管线 plist(无 `uv` 用 `--without-pipeline`),`uninstall` 对称清理;真机实跑仍属 owner 触点。Docs B §4.8 已按新行为改写。
12. **`enabled_project_types`**:代码缺省 `["coding"]`,owner 机 live 已 `["coding","writing"]`;writing 真人全链未验。Docs B §1.3 / §16 标「窄版可用(需开能力门)· 真人全链待验」。
13. **订阅记账文案**:`docs/04` 写「订阅额度内(已用 N 次)」,UI 只显示「订阅额度内」,次数在周报。Docs 按 UI 写;二选一回修(改 UI 或改 04)。
14. **M0 ≠ `~/.saydo/profile.md`**:无写入代码,M0 承载在账本 tier;`profile.md` 仅在备份源清单。Docs B §9.1 已按实情写;`docs/04` §1.1 表的 M0 存储列属超前表述,可加注。
15. **`[budget].monthly` 无执行点**(schema `looseObject`,仅 `task_max_default` 被消费)。Docs 已说明;若要让月预算成为硬闸属新功能。
16. **`scripts/runtime-preflight.sh`** 写死 47100、假设 `~/.saydo/runtime/.git` 为实体目录、强制 asr/tts ok——与零 key 定位不一致,疑似遗留;不影响 Docs,登记待清。

## C.2 与 v1(GLM 5.3 稿,已归档)的对照裁决

v1 路径:`docs/site/archive/2026-08-20-docs-page-content-v1-glm53.md`(原 `prompts/76-website-docs-content.md`,untracked,未评审)。总体评价:结构完整、口径纪律好(状态词 / 零 emoji / 完成度三档),B 面大部分段落可用;但有若干「按设计文档写、未对实现核验」的超前表述。逐条裁决:

| v1 条目 | 裁决 | 说明 |
|---|---|---|
| §1 定位 / 三条承诺 / 不是什么 / 费用 | 吸收 | v2 §1 同口径,补「适用的事」与「当前状态一句话」 |
| §2 七步表 + 「两个执行模式(拍板时选)」 | 部分吸收,**修正** | 直达验收档语音链未接(`direct_mode_not_wired`),v2 标进行中;Demo 三件套改为「生成器已落地未接线」 |
| §3 词汇表 | 吸收并扩 | v2 §2 扩至 22 条,区分「推理槽位」与「开发档(执行器)」两套词表(v1 未区分,§8.1 把 dev 与四槽并列易混) |
| §4 架构组件表 + 「什么流量会出网」 | 吸收 | v2 §3.1 组件表、§14 出网两类 |
| §5.1–5.3 安装启动 | 吸收 | v2 §4 同;控制台入口改用 `localhost`(WebAuthn rpId,`127.0.0.1` 页面请求会 308) |
| §5.4 常驻安装「推荐日常使用」「包含 daemon 与 pipeline」 | **修正** | `install` 在干净机因缺 pipeline plist 失败;v2 标进行中,普通用户走前台;更新流程(`git pull` + deploy)吸收 |
| §5.5 `node packages/cli/dist/saydo.js` | **修正** | 产物是 `dist/cli.mjs` |
| §5.6 备份 / §5.7 卸载 | 吸收 | |
| §6 向导四步 | 吸收并修 | 「约 1–2 分钟」→ 全 CLI 两轮自检合计 2–4 分钟;「左栏选哪家 / 右栏五槽」UI 描述未核实,v2 不写版面只写流程;「项目切换器里从本地文件夹添加」console 无此入口(grep 零命中),v2 改为对话点名路径 + 复述确认 |
| §7.1「prompt 经标准输入传入」「每个 CLI 的可执行文件按预登记路径 + SHA-256 核验」 | **修正** | 身份核验(`verified_binary_default`)仅 `codex_cli` / `claude_cli`;prompt 传入方式各家不同,v2 不写 |
| §7.2 七家 CLI 表 + 登录提示 | 吸收 | 登录提示按 `cliCapability.ts` 词表核对(claude 是 `claude auth login`;qwen 无登录子命令,配端点或 key) |
| §7.3 执行层 | 吸收 | v2 §6 扩展(版本钉死、凭据剥离、egress 诚实边界、steer 语义) |
| §7.4「订阅额度内(已用 N 次)」 | **修正** | UI 只显示「订阅额度内」 |
| §7.5 常见组合 | 吸收为 v2 §5.3 进阶举例 | |
| §8.1–8.2 槽位与命名端点 | 吸收 | `provider_order` 吸收 |
| §8.3「thinking/cheap CLI 失败回落 dialog」 | 吸收 | 已核 `slotResolvers.ts` `fallback_dialog` |
| §8.4 项目层覆盖 | 吸收 | 补「项目层只允许 API binding、evaluator 不可覆盖、dev 仅 cursor」 |
| §8.5「月度预算」 | **修正** | `monthly` 无执行点,v2 说明三熔断才是硬闸 |
| §8.6 执行器两键 | 吸收 | |
| §9 git 与 GitHub | 吸收并扩 | 分支名 / worktree 不删 / 主仓 tracked 干净断言 / 合并信息 / 人工合并核验基准 均补入 |
| §9.4「开源许可证条款以 LICENSE 为准」占位 | 吸收为 C.1-1 | 另发现仓库 private(v1 未查) |
| §10.1「不配语音 key 时麦克风按钮禁用」 | **修正** | 2026-08-13 起有浏览器系统语音回退;v2 三档 |
| §10.1 手机原生语音 Coming soon | 吸收 | v2 明确「壳工程存在、未上架」 |
| §11 手机 | 吸收并扩 | 补 S3 四断言、LAN 面白名单范围、tailnet 配法 |
| §12 安全模型 | 吸收并扩 | 补 cmdEffect 分类规则(复合命令、代码执行入口按 S2、敏感词升级)、canary、edit 第四动作、Gate 0 六项 |
| §13.1「M0 在 profile.md」 | **修正** | 见 C.1-14 |
| §13.3「阻塞式深度研究」 | **修正** | 机械管道,LLM 深研未做 |
| §14 四色 + 任务状态机 | 吸收 | |
| §15 控制台导览 | 吸收为 v2 §4.5 | |
| §16 数据 / 隐私 / 迁移 | 吸收 | 补「桌面云端语音音频出网」两端区分 |
| §17 FAQ | 吸收并扩 | 补 recovery-only / evaluator unarmed / 端口冲突 / blocked / worktree 累积 |
| §18 路线图「launchd 常驻 现在可用」 | **修正** | install 缺口,标进行中 |
| §19 开发者指南 / §20 支持 / 附录速查 | 吸收 | |
| C.1-2「官网语音 FAQ 不准确」 | **不采纳** | 系统语音回退已落地(`packages/console/src/voice/systemVoice.ts`,commit 40a607f),官网该句成立 |
| C.1 其余(LICENSE / 执行层张力 / 模板陈旧 / 手机开关 / writing) | 吸收 | 见 C.1 |

v1 **没有**而 v2 新增的整节:§0 阅读指南、§3.3 采访 / 就绪原理、§5.4 异族规则、§5.5 计费口径、§9.3 记忆写路径、§9.4 一件事 / 义务 / 确认卡降格 / 多步接续、§10.1 状态词表、§11 回叫状态机与 ntfy 细节、§12.2 采集与打断、§13.1 LAN 面范围与 S3 四断言、§16 逐项完成度总表、§19 中英术语对照。

## C.3 主要事实出处(核对自 main@29f33cf 工作树,2026-08-20)

- 仓库可见性 / license:`gh repo view Octo-o-o-o/SayDo --json isPrivate,licenseInfo`(private / null);根目录无 LICENSE。
- CLI 命令与端口:`packages/cli/src/options.ts`(`up|status|open`,缺省 47100,`--home`/`SAYDO_HOME`)、`cli.ts`、`supervisor.ts`(只起 daemon,console 静态托管,不起 pipeline)、`open.ts`(`http://localhost:<port>/?token=`)、`package.json`(bin `dist/cli.mjs`,engines `>=22 <23`);`docs/09 §16.6`(npm/brew 公网发布为独立 release gate,未发布)。
- 安装 / 启动 / 手机 / 关停:`DEPLOY-测试机部署清单.md`(2026-08-12);`packages/daemon/src/index.ts`(PORT、`SAYDO_MOBILE_LAN`、127.0.0.1→localhost 308)。
- 首跑向导:`packages/console/src/components/SetupGate.tsx`、`SetupWizard.tsx`(四步:staging / testing_staged / restarting / testing_live)、`lib/resourcePlans.ts`(三形态卡文案)、`packages/daemon/src/api/firstRun.ts`(开场白)。
- 模型槽位与供给:`packages/contracts/src/types/modelbinding.ts`、`packages/daemon/src/config/{types,cliProviders,family,validate,projectOverrides}.ts`、`packages/daemon/src/providers/slotResolvers.ts`(effective / fallback_dialog / unarmed)、`docs/09 §11` + T18b 合同、`docs/07 D3/D18`;登录提示 `config/cliCapability.ts` CLI_CATALOG。
- 执行器:`packages/daemon/src/tier1/validateConfig.ts`(非 cursor 拒起)、`executor.ts`(argv、env 白名单、worktree 路径与分支、settle)、`adapter.ts`(hooks.json、egress uncontrolled)、`gate.ts` / `gateScript.ts` / `cmdEffect.ts`(裁决与分类)、`operations.ts`(review 三态、steer、retry、cancel、人工合并核验)、`s3Tools.ts`(S3 收据与合并段)、`verifyFreeze.ts`、`projectConfig.ts`(setup 消毒、verify source 枚举)、`approvals/circuitBreakers.ts` / `parkAging.ts`;`docs/plan/2026-08-19-w54-claude-cli-tier1.fable.md`(Claude 执行器方案 v2)、`docs/plan/2026-08-15-default-runner-decision.md`(DSH 否决、native_api 建议、Hopper dormant)。
- 项目 / 工作区 / project.toml:`packages/daemon/src/projects/{workspace,lifecycle,anchor}.ts`、`config/project.ts`、`config/load.ts`、`packages/contracts/src/effects.ts`(保护分支并集、Gate 0 判定、预授权校验)。
- 记忆:`packages/daemon/src/memory/{foundation,classify,growth,ledger,fts,retrieval,hotwords,snapshotForget}.ts`、`docs/04 §1`、`docs/modules/b-memory.md`;AGENTS.md 指针块实例 `AGENTS.md:88-91`。
- 账本 / 四色 / 确认环:`packages/daemon/src/api/attention.ts`、`focus/{stage,obligations}.ts`、`brain/instructions.ts`(J1)、`brain/dialogLoop.ts`(降级 remember)、`packages/contracts/src/types/focus.ts`、`docs/09 §15`、`docs/11 §0.1`;v0.4 机制 `TESTING-测试提问手册.md` §二。
- 就绪 / 决策包 / Demo:`packages/contracts/src/readiness.ts`(类型清单单源、`isReadinessBlocking`)、`packages/daemon/src/evaluator/readiness.ts`、`packages/contracts/src/types/package.ts`、`packages/daemon/src/packages/factory.ts`(demoRef 占位)、`demo/generator.ts`(无生产调用方)、`brain/liveTools.ts`(组包恒 step_confirm、`direct_mode_not_wired`、Gate 0 检查)。
- 回叫:`packages/daemon/src/callback/{engine,ntfy,arbitration}.ts`、`index.ts`(ntfy sweep、L0 未接注记)、`recovery/reconciler.ts`(DND)。
- 语音:`pipeline/src/saydo_pipeline/{doubao_asr,doubao_tts,vad,__main__}.py`、`packages/console/src/voice/{systemVoice,useVoiceChannel}.ts`、`packages/daemon/src/voice/redactor.ts`、`docs/10 §1/§3`、`e2e/golden/asr-regression.mjs`。
- 手机 / 远程:`packages/daemon/src/net/{mobileLan,pairingInfo,t2,identity,s3Guard,pairUrl,capToken}.ts`、`packages/console/src/lib/pairing.ts`、`docs/09 §11` M1 移动 LAN 段、`docs/release/2026-08-13-store-submission-status.md`、`docs/release/2026-08-13-app-materials.md`。
- 隐私 / 数据 / 备份:`packages/daemon/src/storage/ddl.ts`(audit 触发器)、`obs/audit.ts`、`backup/{cli,snapshot}.ts`、`config/types.ts`(privacy prefault、PARAM_DEFAULTS)、`deploy/saydo-octoooo-com/privacy/index.html`。
- 官网现状与口径:`deploy/saydo-octoooo-com/index.html`、`en/index.html`、`support/`、`history/PROCESS-JOURNAL.md` R75。

## C.4 Docs 上线前检查清单

- [x] C.1-1 已解除:仓库已公开(快照仓)+ Apache-2.0(2026-08-20)。
- [ ] C.1-3/5/7 官网文案微调是否采纳(owner 定);C.1-4 已解除(Demo 与回叫升级链已落地)。
- [x] C.1-9/10/11 已解除(public-readiness 批,2026-08-20)。
- [ ] 英文版按 B §19 术语表翻译;状态词英译固定。
- [ ] 页面过 `scripts/check-emoji.sh`;title / description / canonical / hreflang 与现有页一致;顶栏与页脚加「文档」入口。
- [ ] B §16 完成度总表与 HANDOFF 当前批次核对一次(Claude 执行器若已开批,标注更新)。
- [ ] 正文不含仓内路径 / 批号 / SHA / 本机绝对路径(本稿 B 面已按此写;`~/.saydo` 与 `<workspace>/.saydo` 属产品路径,允许)。

## C.5 评审与复核记录(本会话)

- 事实采集:三路 Explore 子代理(安装 / 运行时;执行与 Git;记忆 / 账本 / 语音 / 手机 / 隐私 / 成本),坐标经本会话抽查(`validateConfig.ts` 非 cursor 拒起、`systemVoice.ts` 系统语音回退、`slotResolvers.ts` evaluator 双 ack、`liveTools.ts` 熔断缺省、`gate.ts` 45 秒、`cliCapability.ts` 登录提示等)。
- 对抗复核:一路零上下文 fact-checker 子代理冷读 B 面并逐条对照代码,报 24 条(1 条绝对路径 `~`、1 条示例配置 evaluator CLI 缺 ack、4 处产物 / 快照 / 深评 / 转写目录误写进项目目录、gate 脚本「不可写」写反、挂起触发词误写「去吧」、限流「停下问你 + 收据」超前、90 秒 vs 120 秒、桌面通知「进行中」应为「规划中」、DND 补叫顺序、§5.1 缺省列、多步接续上限 3、侧栏分组、自检时长 1–3 分钟、方案卡排序、端口环境变量与 `--no-open`、「帮我记一下」常态 vs 降级、会话末提名而非自动提炼、执行器 FAQ 条件、`jq`/`curl` 依赖、批号 (v0.4) 泄漏、`monthly` 无展示点、状态机节选、`id_ed25519` / `vite` 漏项、「发送」按钮文案)——**全部已回修**。同时确认高风险断言(示例配置可过 schema、七家 CLI 与登录提示、笼子旗标、执行器链、合并段、verify 冻结、数字缺省、完成度标注)为正确。
- 零 emoji 门禁:`scripts/check-emoji.sh` 对本稿与首页稿均 clean。
- 未做:英文整页翻译(A §6 留待实施);Codex 对抗评审(按 AGENTS.md 评审制度应补一次 `codex exec -m gpt-5.6-sol`,本轮未跑,建议随 Docs 页实施时一并做)。
- 2026-08-20 午前复核(第二轮):S1(Demo 小样)、S2(回叫升级链)、public-readiness(模板 / DEPLOY / launchd)、W5.4-a(Claude 执行器第一批)相继收口并入 main,仓库按选项 C 公开;本稿 B §3.2 / §4.8 / §6.3 / §11 / §16 / §18 / 附录 与 C.1(3/4/9/10/11)/ C.4 已同步为收口后事实;首页稿 B.1 / B.3 / B.6 / C 表同步。
