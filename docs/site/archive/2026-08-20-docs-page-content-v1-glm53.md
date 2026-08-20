> **[已归档 · superseded]** 本稿为 GLM 5.3 起草的官网 Docs 页内容 v1(原路径 `prompts/76-website-docs-content.md`,未评审、未入库),2026-08-20 由 Claude Fable 5 独立梳理的 v2 **supersede**:`docs/site/2026-08-20-docs-page-content.fable.md`。逐条对照裁决(吸收 / 修正 / 不采纳)见 v2 §C.2。本文件仅作过程档案,不再维护,**勿据此实施**——其中 §2 执行模式两档、§3 Demo 三件套、§5.4 常驻安装、§5.5 CLI 路径、§7.4 订阅记账文案、§8.5 月预算、§10.1 麦克风禁用、§13.1 M0 落点、§13.3 深度研究、§18 launchd 可用 等处与实现不符。

# 76 · 官网 Docs 页面内容稿 v1(供 owner 评审)

> 定位:saydo.octoooo.com 新增 Docs 页面的内容与结构稿。官网首页保持简洁优雅,Docs 承载详尽说明。
> 本稿分三部分:A 实施建议;B 页面正文(建议直接采用的内容);C 维护注记(问题清单与出处索引,不入正式页面)。
> 完成度标注约定(与官网一致):「现在可用」= 已有代码与证据;「进行中」= 已开工未收口;「规划中」= 未开工。
> 硬约束:零 emoji;状态词纪律(执行状态不说「完成/做完」,口径是「执行和检查都跑完了,等你验收」);不承诺未落地能力。

---

# A. 实施建议(不属页面正文)

1. 路由与拆页:建议 `deploy/saydo-octoooo-com/docs/index.html` 一页长文 + 粘性目录(静态站无构建,单页最省维护;英文版 `/en/docs/`)。若嫌单页过长,可按 B 部分的四大块拆:「上手(1-6)/AI 接入(7-8)/机制参考(9-16)/帮助(17-20)」。
2. 入口:官网顶栏 nav 加「文档」链接;页脚「资源」列加「文档」;support 页顶部加一行指引。
3. 视觉:复用 site.css 与 tokens.css,信息密度优先,不做营销级动效;目录锚点 + 返回顶部即可。
4. 维护规则:三档完成度标注随版本更新;每次产品批次收口后同步本文档对应小节;页面正文不引用仓内内部批号与文件路径(那些留在 C 部分与仓内)。

---

# B. 页面正文

## 1. 说到(SayDo)是什么

说到(SayDo)是一个你能对着说话的高级助手,运行在你自己的 Mac 上。你只管把事情聊清楚——它先吃透你的项目上下文,把每件事记成一本账;听懂了、火候够了,就驱动你电脑上已有的 AI 工具去办事;执行和检查都跑完,它主动叫你来验收,你点头才算交付。

三层核心承诺:

- **说到就记**:按住说话,想到哪说到哪。随口一句「帮我记一下」立刻进账;答应的事、等你拍板的事、AI 正在办的事,件件有着落,不用靠脑子记。
- **先吃透,再办事**:第一次接触一个项目,它先做一次深度研究,沉淀成持久的项目知识底座。这是「说到」和「新开一个聊天窗口」的分水岭——它带着对你项目的理解跟你协作,而不是每次从零开始。
- **人拍板才算数**:开工前给你决策包(做什么、怎么做、哪些它做哪些你配合);办完说「等你验收」而不是「做完了」;合并、交付,永远你点头才生效。

**它不是什么**:

- 不是语音输入法。它不做「语音转文字再粘贴」,而是先理解上下文、立账、判断就绪、驱动执行、组织验收的完整闭环。
- 不是云端代跑。没有 SayDo 的云端服务器,没有账号注册。重活在你自己的电脑上跑,数据存在你自己的设备上。
- 不是又一个聊天客户端。市面上每一块(语音识别、聊天、编码 agent)都有成熟单点;说到做的是把「聊透、自动开工、办完交付」治理成同一套闭环。

**当前状态与平台**:桌面服务(macOS)现在可用、开源免费;iOS / Android / HarmonyOS App 与来电式语音汇报在路上(见 §18 路线图)。

**费用**:桌面服务本身免费。AI 能力的费用直接付给你选的厂商——用你已有的 CLI 订阅(额度内零额外费用),或你自己的 API key 按量计费。SayDo 不加价、不经手、不代充。

## 2. 三分钟理解工作流:一个完整闭环

从聊一句,到办完叫你,共七步。前四步是你们的对话,后三步是它的执行与你的验收:

| 步骤 | 发生什么 | 你做什么 |
|---|---|---|
| 1 开口聊 | 按住说话,想到哪说到哪;它会像采访一样一次问一个,把事聊透;随口记录立刻进账 | 说 |
| 2 就绪决断 | 它判断火候够了,主动提议开工;规格是它的产物,不是逼你写需求文档 | 听提议 |
| 3 决策包 | 端出三件套:成果预览(做完你会得到什么)、实施计划(每步标好 AI 执行还是需要你配合)、轻量 Demo(最终长什么样) | 看 |
| 4 你拍板 | 看着预览和计划说一句「就这样」;同时选执行模式(直达验收或逐步确认) | 拍板 |
| 5 后台执行 | 在独立 git worktree 里隔离执行,主工作区不被碰;每条 shell 命令过审批门;预算/时长/回合三熔断兜底 | 可以走开 |
| 6 办完叫你 | 执行和检查都跑完,它主动叫你验收——说「等你验收」,不说「做完了」 | 被叫回来 |
| 7 验收沉淀 | 口播摘要 + 证据视图(diff、测试、决策);你点头,过强认证合并销账;知识与产物留存 | 验收 |

两个执行模式(拍板时选):

- **直达验收**:执行期间不打扰你,跑完直接叫你验收(高风险动作仍会中途拦截)。
- **逐步确认**:每个关键动作(安装依赖、push 等)都停下来等你确认,适合初次合作或不放心的任务。

安全不随模式放松:S3 级动作(合并、删除等)在任何模式下都必须本机强认证,三熔断任何模式下不放宽。

## 3. 核心概念词汇表

| 术语 | 含义 |
|---|---|
| 账本 / attention | 所有「谁欠谁、等什么」的读模型。你在控制台「今天」页看到的就是它 |
| 四色 | 账本条目的四种归属色:橙=等你拍板/回答;蓝=你欠的动作;绿=AI 正在办;灰=等外部回音(详见 §14) |
| 就绪 / ReadinessBinding | 一件事「可以开工了」的判定与登记。缺关键信息会被拦下问你,不会带着糊涂账开工 |
| 决策包 | 开工前的三件套:成果预览、实施计划、轻量 Demo |
| 执行模式 | 直达验收 / 逐步确认两档(见 §2) |
| 奠基 / Foundation | 第一次接触项目时的阻塞式深度研究,产出项目知识底座的第一代 |
| 知识底座 / knowledge | `<项目>/.saydo/knowledge/` 下的持久知识,按代(generation)演进,越用越懂你的项目 |
| M0-M3 | 记忆四层:M0 用户档案 / M1 项目知识底座 / M2 累积产物 / M3 会话工作记忆(详见 §13) |
| S0-S3 | 风险四级:S0 只读 / S1 圈内写 / S2 需逐次审批 / S3 强认证(详见 §12) |
| worktree | 每个任务在项目里的独立 git 工作树,与主工作区隔离 |
| 熔断 | 预算/时长/回合三个上限,任一触发即停任务并叫人 |
| 验收 / review | 你对「执行和检查都跑完」的成果做裁决;通过才合并销账 |
| capability token | daemon 首次启动生成的访问令牌(`~/.saydo/.cap-token`),控制台与手机配对都靠它 |

## 4. 架构与组件

SayDo 是一组跑在你 Mac 上的本地进程,没有云端依赖:

| 组件 | 是什么 | 备注 |
|---|---|---|
| daemon | 核心守护进程(TS/Node 22),对话与任务状态的唯一持有者;托管控制台网页;审批门与审计都在这 | 缺省端口 47100 |
| console | Web 控制台,浏览器打开即用;桌面与手机(移动网页)共用一套 | 由 daemon 直接托管 |
| pipeline | 语音管线(Python),负责桌面网页里的听与说 | 可选;不配则用打字 |
| saydo CLI | 可选的桌面命令行小工具(up/status/open) | 可不装 |
| contracts | 数据契约包(zod schema 与状态机),保证各组件不分叉 | 开发者关心 |

架构上是「沟通面 ↔ 执行面」:手机/浏览器只做沟通(说话、看账、拍板、审批),重活(吃透项目、驱动 AI、后台执行)全部留在电脑上。同一项目同时只跑一个执行任务,不同项目可并行;手机暂时离开不打断执行。

**本地优先的边界——什么流量会出网**:只有两类,且都是你自己配置的上游:

1. 你接入的 AI 上游:CLI 订阅工具直接用它们各自的官方通道;API key 直连你配置的端点。
2. 语音识别与合成(火山引擎豆包 ASR/TTS,仅在你启用桌面网页语音时)。

没有 SayDo 服务器、没有账号体系、没有埋点、没有崩溃收集与广告 SDK。你的对话、账本、任务与知识全部存在本机(清单见 §16)。

## 5. 安装与运行

### 5.1 系统要求

| 项 | 要求 |
|---|---|
| 电脑 | Mac(macOS)。当前版本面向 macOS,暂未支持 Windows/Linux |
| Node.js | 22 或更高 |
| pnpm | 10.x(`corepack enable` 后可用) |
| git | 需要 |
| Python + uv | 可选,仅桌面网页语音需要(Python 3.11+) |
| AI 供给 | 任一已登录的 AI CLI(见 §7),或一个 OpenAI 兼容 API key |
| 执行器(可选) | cursor-agent CLI 登录态——要「让 AI 真正改代码」时需要(见 §7.3) |

### 5.2 安装

```bash
git clone https://github.com/Octo-o-o-o/SayDo.git && cd SayDo
pnpm install && pnpm -r build   # build 必须:控制台网页来自构建产物
```

### 5.3 启动(快速试用,单进程)

```bash
mkdir -p ~/.saydo
cd SayDo/packages/daemon   # 在 §5.2 克隆出的仓库目录内
SAYDO_HOME=$HOME/.saydo SAYDO_MOBILE_LAN=1 nohup ./node_modules/.bin/tsx src/index.ts >> ~/.saydo/daemon.log 2>&1 &

# 等 10-15 秒后健康检查,看到 ok:true 即成功
curl -s http://127.0.0.1:47100/health

# 打开控制台
open "http://127.0.0.1:47100/?token=$(cat ~/.saydo/.cap-token)"
```

- 缺省端口 47100,改端口用环境变量 `SAYDO_DAEMON_PORT`。
- `SAYDO_MOBILE_LAN=1` 允许手机在同一局域网访问(见 §11);只在桌面浏览器用可以去掉。

### 5.4 常驻安装(推荐日常使用)

```bash
just daemon install    # 写入 launchd:开机自启、崩溃自动拉起
just daemon status     # 查看状态
just daemon logs       # 看日志
just daemon stop       # 本次会话停止(uninstall 才彻底移除)
```

常驻安装包含 daemon 与 pipeline 两个服务。更新版本:`git pull && pnpm install && pnpm -r build`,常驻用户再执行 `just daemon deploy` 把常驻服务切到新代码并重启(会重启服务,挑空闲时段执行)。

### 5.5 可选:桌面 CLI 小工具

```bash
pnpm --filter @saydo/cli build
node packages/cli/dist/saydo.js up      # 起 daemon
node packages/cli/dist/saydo.js status  # 查状态
node packages/cli/dist/saydo.js open    # 打开控制台
```

与 §5.3 的直启方式二选一,不要混跑(同一台机器单实例)。

### 5.6 备份

```bash
just backup
```

快照落在 `~/.saydo/backups/<时间戳>/`:完整数据库(在线备份,不撕裂)、会话转写、用户档案、各项目的知识底座与奠基产物。保留期缺省 30 天(`[params].backup_retention_days`),daemon 每日还会自动快照一次。

### 5.7 停止与完全卸载

```bash
just daemon uninstall                       # 常驻用户
lsof -t -iTCP:47100 -sTCP:LISTEN | xargs kill; pkill -f saydo_pipeline   # 直启用户
rm -rf ~/.saydo                             # 完全重置(会轮换 token,手机需重新扫码)
```

## 6. 首次设置(向导)

第一次打开控制台, daemon 会写入缺省配置模板并弹出**资源画像向导**:

1. **看画像**:自动检测本机已安装、已登录的 AI CLI 与已存的 API key,并给出推荐方案卡(例如本机有已登录的 Codex,就推荐「全用 Codex,订阅内零成本」)。
2. **选供给**:左栏选用哪家(检测到的 CLI 列表,或填一个 OpenAI 兼容 API key),右栏是五个用途槽位(对话/思考/廉价/评估/执行,见 §8),一般直接采纳推荐方案即可。
3. **知情确认**:勾选两条知情说明(例如 CLI 模式较慢),点「确认并启动」。
4. **真实自检**:对你选的每个槽位真实调用一次(约 1-2 分钟),全部通过后自动重启进入对话页。

不想现在配?点「先随便看看」可跳过向导直接逛控制台(用打字对话仍需至少配好一个对话槽位)。

供给配好后,在项目切换器里「从本地文件夹添加」接入你的第一个项目;第一次跟它聊某个项目时会触发奠基(§13.3),期间它如实显示「学习中」。空账本新用户还会收到一句开场白,引导你随口说三件本周要办的事,立刻立账给你看。

**预期管理(不是坏了)**:

- CLI 订阅模式每轮回复约 15-25 秒,属预期而非卡死;配 API key 秒回。思考气泡超过 90 秒会明确报错。
- 偶尔只回应一半诉求,再问一次即可。
- 「帮我记一下」类随口记录先进记忆库(记录页可看),聊成熟立起事后才挂到账上。

## 7. 接入你已有的 AI(普通用户路径)

### 7.1 原理:复用订阅,不经手凭据

SayDo 通过各家 CLI 的无头模式(headless)调用你电脑上已登录的 AI 工具——一发一收,prompt 经标准输入传入。这意味着:

- **登录态是你与厂商之间的事**:你用各家官方方式登录(如 `codex login`),SayDo 只检测「是否已登录」,未登录时会给出可直接粘贴的修复命令。
- **SayDo 不碰你的凭据**:派发给 AI 工具的环境变量走白名单(仅 PATH/HOME 等基础变量),任何 key/token 都不会被带入;部分工具因凭据形态需要隔离 HOME 运行,SayDo 已内置处理。
- **调用前核验二进制身份**:每个 CLI 的可执行文件按预登记路径 + SHA-256 摘要核验,防止路径漂移后调错程序。

### 7.2 支持列表(对话/思考/评估层,现在可用)

| 接入 | CLI 命令 | 登录方式(以向导提示为准) |
|---|---|---|
| Codex(OpenAI) | `codex` | `codex login` |
| Claude(Anthropic) | `claude` | 按向导提示完成 CLI 登录 |
| Cursor | `cursor-agent` | `cursor-agent login` |
| Gemini(Google) | `gemini` | 终端运行 `gemini` 完成 Google 登录 |
| Grok(xAI) | `grok` | `grok login` |
| Qwen(通义千问) | `qwen` | 见向导提示 |
| GitHub Copilot | `copilot` | `copilot login` |

另:kimi / opencode 的 CLI 目前仅能被识别,不可选为供给(尚无法满足零工具阻断的安全要求)。

任选一家登录即可零 key 开聊;也可以混搭(如对话用 Claude、廉价档用 Gemini),见 §8。

### 7.3 执行层:让 AI 真正改代码

对话层之外,「派发任务、改代码、跑测试」由**执行后端**承担,与对话层相互独立:

- **现在可用**:Cursor CLI(`cursor-agent`)。需要安装并登录,由向导/设置页登记锁定副本与版本(SayDo 对执行器做版本锁定,防止自动更新导致行为漂移)。未配置时对话与记账完全可用,只是派发编码任务会停在队列并给出处方化提示(告诉你缺哪两个配置键)。
- **进行中**:Claude Code CLI 作为执行后端(方案已定档,接入中)。就绪后用你的 Claude 订阅登录态即可,无需 API key。
- Codex 作为执行后端属后续规划。

### 7.4 费用怎么看

- 订阅供给:显示「订阅额度内(已用 N 次)」,不产生额外费用。
- API 供给:按你的 key 实际计费,控制台「记录-成本」页按项目/任务可查。
- 订阅触发限流时不会偷偷转成 API 计费——会停下来等你确认,确认后才切换。

### 7.5 常见组合

| 你的情况 | 推荐供给 |
|---|---|
| 有任一家 AI 订阅且 CLI 已登录 | 向导直接采纳「全用这家(订阅内零成本)」方案卡 |
| 有 Claude 订阅 + 想执行编码任务 | 对话/思考用 Claude CLI;执行器配 cursor-agent(过渡期),Claude 执行后端接入后可全家桶 |
| 不想用订阅,追求秒回 | 向导填一个 OpenAI 兼容 key(OpenRouter 一个 key 通多家,或 DeepSeek 单家直连) |
| 混搭党 | §8 手工配五槽位 |

## 8. 高级配置:多模型与多 Provider

配置文件三个,分工明确:

| 文件 | 作用 |
|---|---|
| `~/.saydo/config.toml` | 全局非密配置:槽位、端点、预算、门禁 |
| `~/.saydo/.env` | 密钥真值(永不进 git;config.toml 用 `env:VAR` 引用,禁明文) |
| `<项目>/.saydo/project.toml` | 项目层白名单覆盖(全局安全键如 gate0 禁止在项目层改) |

模板见仓库 `templates/saydo.config.example.toml` 与 `saydo.env.example`。

### 8.1 五个用途槽位

不同用途用不同模型,各槽独立绑定、可混搭 CLI 与 API:

| 槽位 | 用途 | 典型选择 |
|---|---|---|
| dialog | 日常对话 | 响应快、听写流畅的模型 |
| thinking | 决策包起草、奠基提炼 | 推理强的模型 |
| cheap | 高频轻量结构化调用 | 便宜快速的模型 |
| evaluator | 独立判定「够不够开工」 | 与 dialog/thinking 不同家族(异族规则,防相关错误链) |
| dev | 执行后端用哪个 agent 改代码 | 当前为 cursor;见 §7.3 |

绑定写法(ModelBinding):

```toml
[models]
# API 形态:官方端点(简写)或命名端点(via)
dialog    = { provider = "api", via = "openrouter", model = "openai/gpt-5.6-luna" }
# CLI 订阅形态
thinking  = { provider = "claude_cli" }              # model 可省,用该家默认
cheap     = { provider = "gemini_cli", model = "..." }
evaluator = { provider = "api", via = "deepseek", model = "..." }
# codex 档还支持 reasoning 档位:none|minimal|low|medium|high|xhigh|max

[models.dev]
agent = "cursor"            # claude_code | cursor | codex(运行时当前仅 cursor 可启动,其余接入中)
model = "..."
```

### 8.2 多 Provider:命名端点

任意 OpenAI 兼容端点都能注册,一家一档:

```toml
[providers.api.openrouter]
base_url = "https://openrouter.ai/api/v1"
api_key  = "env:OPENROUTER_API_KEY"    # 恒 env 引用,禁明文

[providers.api.deepseek]
base_url = "https://api.deepseek.com/v1"
api_key  = "env:DEEPSEEK_API_KEY"
family   = "deepseek"                  # 单家直连必填;多供应商网关(如 OpenRouter)不写,按模型名前缀解析
```

`provider_order`(可选):给端点钉死模型路由顺序并禁用自动兜底,适合聚合网关做确定性路由。

### 8.3 路由与兜底规则

- thinking/cheap 槽的 CLI 未登记或自检失败时,自动回落到 dialog 槽,服务不中断。
- 评估器默认要求与 dialog/thinking 异族(fail-closed);确有需要可在配置里显式落知情豁免(`evaluator_same_family_ack` / `evaluator_isolation_ack`),启动时仍会提示。
- 订阅限流不自动转计费(见 §7.4)。

### 8.4 项目层覆盖

在控制台的项目设置里,可对单个项目覆盖 dialog/thinking/dev 槽位与预算(例如某仓库只允许特定 agent)。覆盖存在 daemon 受控表中,不落 project.toml,避免被克隆仓篡改。

### 8.5 预算、免打扰与熔断

```toml
[budget]
monthly  = 200            # 月度预算(元)
# task_max_default = 20   # 单任务成本熔断缺省(元);订阅调用靠时长/回合兜底

[dnd]
window = "23:00-08:00"    # 免打扰时段
```

三熔断(每个派发任务,详见 §12.4):活跃时长 45 分钟(等审批/停靠时停表)、回合数 80、成本上限(缺省 20 元)。

### 8.6 执行器配置(两键)

```toml
[tier1]
cursor_agent_bin = "<锁定副本绝对路径,形如 .../versions/<版本>/cursor-agent>"
cursor_agent_pinned_version = "<版本>"
```

两键齐备才会启用执行器(fail-closed:缺任一不认领任务)。一般由向导/设置页代填,不必手写。版本升级走重新登记,不支持自动更新生效。

## 9. git 与 GitHub:代码怎么被安全地改动

### 9.1 你需要做的:几乎没有

SayDo 工作在你本地的 git 仓库上——从 GitHub / GitLab / 任何地方 clone 到本地的项目都行。不需要给 SayDo 任何 GitHub 授权,不需要填仓库地址,不需要装 GitHub App。

### 9.2 SayDo 不做什么

- **不连接 GitHub API**:不开 PR、不评论 issue、不读你的 GitHub 账号信息。
- **daemon 永不 push**:执行器收到的指令里明确写着「不要 git push、不要自己合并」;push 作为效果类还受审批门管制(预授权范围当前为空,任何 push 都要逐次审批)。
- 也就是说:GitHub 上发生什么,由你的拍板决定;SayDo 只管本地,不代替你同步远程。

### 9.3 一个任务的生命周期

1. **隔离**:派发时在你的项目里创建独立 worktree(`.saydo/worktrees/<任务ID>`),并建分支 `saydo/<任务ID>`。主工作区从头到尾不被执行器触碰。
2. **执行**:agent 在 worktree 里改代码、跑命令;每条 shell 命令回连 daemon 审批门做风险裁决(§12.2)。
3. **定格**:执行和检查都跑完时,daemon(不是 agent)对 worktree 拍树快照,连同验证摘要、转写游标一起写进结算证明——之后任何漂移都会被发现。
4. **验收**:你在验收面看证据(diff、测试结果、决策),点批准并用 Touch ID / passkey 过强认证。
5. **合并**:由 daemon(不是 agent)执行,且只做快进合并(`--ff-only`),不改写历史;合并信息形如 `saydo: merge <任务ID> (S3 approved)`。
6. **没有 passkey?** 可选人工合并:SayDo 给出深链指引你在终端自己合并,它持续对账你的仓库状态,对上才销账。

### 9.4 SayDo 自身的开源仓库

说到(SayDo)本身的源码公开托管在 GitHub(github.com/Octo-o-o-o/SayDo),问题反馈开 issue,版本以仓库 tag 为准。[占位:开源许可证条款以仓库 LICENSE 为准——正式页面上线前需补定]

## 10. 语音交互

### 10.1 两种语音形态

| 形态 | 识别与合成 | 需要什么 | 状态 |
|---|---|---|---|
| 桌面网页语音 | 浏览器采集麦克风音频,本地语音管线转发;ASR/TTS 为火山引擎豆包服务 | 在 `~/.saydo/.env` 配置 VOLC_APP_ID / VOLC_ACCESS_TOKEN / DOUBAO_TTS_API_KEY 三键,并启动 pipeline 进程 | 现在可用(可选) |
| 手机原生语音 | iOS 系统语音识别与合成,不经管线、不需语音 key | 随移动 App 提供 | Coming soon |

不配语音 key 时麦克风按钮禁用并提示,**打字对话与键盘听写始终可用**——语音是可选增强,不是前提。

### 10.2 桌面语音怎么配

```bash
cd pipeline && uv sync
SAYDO_HOME=$HOME/.saydo nohup uv run python -m saydo_pipeline >> ~/.saydo/pipeline.log 2>&1 &
```

常驻安装(`just daemon install`)会一并管理 pipeline 进程。

### 10.3 交互形态

- 三种发起:点击起停 / 按住说话(空格键长按)/ 免手模式(自动检测你说完)。
- 录完两个去向:直接发送,或先转成文字改一改再发。
- **播报脱敏是硬规则**:token、密钥、客户数据、完整本机路径永不进语音——路径只说「某个配置文件」,密钥只说「一处凭据」。

### 10.4 来电式语音汇报(规划中)

电脑办完事,手机像来电一样响起,接起来就是它讲进展(PushKit 唤醒 + CallKit 来电形态)。随移动 App 一并到来。

## 11. 手机与多设备

### 11.1 现在就能用:移动网页(同一局域网)

1. 桌面 daemon 以 `SAYDO_MOBILE_LAN=1` 启动(§5.3 的启动命令已带)。
2. 控制台的「与手机配对」入口展示二维码(仅对私网地址出码)。
3. 手机浏览器扫码即进入移动版界面(路由 `#/m`):看今天账、看进展、拍板审批、按住说话(文本)。

安全边界,如实说明:

- 连接受限于家庭/办公局域网(RFC1918 私网来源),且手机端只放行最小只读与拍板确认接口;执行中的命令级审批、配置修改、合并等仍在桌面完成。
- 鉴权靠配对时一次性注入的长期令牌 + 局域网来源校验;这是局域网明文 HTTP 的临时边界,不含端到端加密,不要在不受信网络使用。
- 已知限制:删除 `~/.saydo/.cap-token` 后重启会轮换令牌,所有已配对手机一起掉线,需重新扫码。

### 11.2 跨网远程(实验性,进阶)

通过 Tailscale 等 组网可在异地访问(配置 `[t2]` 白名单)。属实验能力,正式的远程体验随移动 App 到来。

### 11.3 原生 App(Coming soon)

iOS / Android / HarmonyOS 三端 App 正在朝上架推进:按住说话、看账本、拍板审批、手机推送、来电式汇报。

## 12. 安全模型

原则:能力越自动化,门禁越硬;所有安全判定 fail-closed(宁可停,不可放)。

### 12.1 Gate 0:开工总门

Gate 0 是一组工程安全门禁(身份与授权模型、事务幂等、独立验收、凭据隔离、意图审计、删除传播)的统称,未关闭时拒绝一切任务派发。它由代码保证,不存在绕过分支;配置项 `[gate0]` 中 `bypass = true` 的含义是「一律拒绝派发」(防误配),而不是绕过。你不需要日常操作它——保持缺省即可。

### 12.2 S0-S3:按效果定风险

风险不看命令叫什么名字,看它实际造成什么效果:

| 级别 | 定义 | 例子 | 怎么放行 |
|---|---|---|---|
| S0 | 只读 | 看文件、查状态 | 直接过 |
| S1 | 圈内写 | 改本任务 worktree 内的文件 | 直接过 |
| S2 | 有外延 | 安装依赖、push 分支、读工作区外路径 | 逐次审批(桌面审批窗约 45 秒) |
| S3 | 重效果 | 合并到保护分支、删除数据、对外发送、强推 | 本机屏幕强认证(Touch ID/passkey),语音永不放行 |

「圈」= 本任务的 worktree。执行器每条 shell 命令都回连 daemon 审批门,由保守词表把命令映射成效果再定级:写圈外路径按最高级处理;无法判断的命令(含变量替换、命令替换)一律上浮,不猜。敏感文件(.env、凭据)触碰、保护分支(main/master)相关操作自动升级。

### 12.3 已知边界(如实告知)

当前执行后端的内置文件写入工具不经 shell 审批门(门只覆盖 shell 命令);独立的受控执行环境(独立用户/容器、全部写入进门)在规划中。在此之前,请只在信任的项目目录使用执行功能——这与「不把电脑交给来路不明的代码」的一般原则一致。

### 12.4 三熔断:防无人值守烧钱

每个派发任务带三个上限:活跃时长(缺省 45 分钟,等审批时停表)、回合数(缺省 80)、成本(缺省 20 元,只计 API 计费行;订阅调用由时长与回合兜底)。任一触发立即停止任务、落审计、带上下文转「需要你处置」。另有停靠老化:等你验收/审批超过 72 小时无应答的任务自动收起转草稿,不无限悬挂。

### 12.5 验证只认登记模板

执行后的验证命令只能从项目预登记的模板里选(package.json scripts / justfile / 配置登记),不能自由拼装;派发时冻结模板内容摘要,执行前重校,防止「改测试自证通过」。没有可用的验证登记,任务不会进入待验收,而是停下叫人。

### 12.6 状态词纪律

执行状态永不说「完成/做完」——结算后说「执行和检查都跑完了,等你验收」;你验收、合并成功后才说「交付了」。这不是话术偏好,而是把「机器跑完」与「人验收交付」分开的机制的一部分。

## 13. 记忆与知识底座

### 13.1 四层记忆

| 层 | 内容 | 存在 |
|---|---|---|
| M0 用户档案 | 你的偏好、称呼、习惯,跨项目 | `~/.saydo/profile.md` |
| M1 项目知识底座 | 对项目的结构化理解,按代演进 | `<项目>/.saydo/knowledge/` |
| M2 累积产物 | 任务产物、决策、写作沉淀 | `<项目>/.saydo/artifacts/` |
| M3 会话工作记忆 | 当前对话上下文与转写 | 会话内 + `sessions/` |

### 13.2 写入纪律:candidate 到 trusted

记忆不是聊什么就信什么。写入路径统一是:原始语句先成 candidate(候选),经冲突/污染/策略检查后才升 trusted(可信)。直接进 trusted 的只有两种:你亲口确认的,与明确低影响的机械事实。M0(你的个人档案)最严:只收你亲口说的,不接受第三方来源。你可以在记录页查看与编辑记忆。

### 13.3 奠基:第一次吃透项目

第一次接触一个项目时,SayDo 做一次阻塞式深度研究(期间如实显示「学习中」):扫描结构、构建与运行方式、约定,产出四份知识文档,作为第一代(generation 1)知识底座。此后的每次重大研究产出下一代,原子切换、失败保留旧代;奠基换代后,依赖旧代知识的就绪判定自动失效,防止拿过期理解开工。知识底座本身是独立 git 仓库,每次奠基自动提交,可回溯。若你的项目有 AGENTS.md 一类协作说明文件,SayDo 会与之互通(读取你的约定,也维护自己的知识投影)。

## 14. 四色账本与任务状态

### 14.1 四色:一眼看清球在谁那

| 颜色 | 含义 | 你该做什么 |
|---|---|---|
| 橙 | 等你拍板/回答 | 决策或补充信息 |
| 蓝 | 你欠的动作 | 你亲自去做 |
| 绿 | AI 正在办 | 等着,可随时看进展 |
| 灰 | 等外部回音 | 等第三方,到期它会提醒 |

条目颜色由「球在谁手上 + 需要什么动作」机械推导,不靠模型自觉。被你暂时收起(ack)的条目,一旦颜色升级(如绿转橙)必然重新出现,不会因为点过「知道了」就永久静音。

### 14.2 任务状态机(编码类任务)

```
queued → running → ready_for_review → review_approved_waiting_merge → merging → task_done
              ↑            │ 返工:同任务新开一轮
              └────────────┘
```

`ready_for_review`(等你验收)不等于完成;`task_done`(交付)只能发生在你验收且合并成功之后。失败与熔断都会转「需要你处置」并保留全部上下文。

## 15. 控制台导览

侧栏结构(信息密度优先,账要全局记、看要就地看):

| 页 | 看什么/做什么 |
|---|---|
| 开口聊 | 主入口:进对话,按住说话或打字 |
| 今天 | 你的一天:四色账本聚合,唯一「需要你」的入口(有待处理时亮徽章) |
| 全景看板 | 所有项目与任务的执行全景 |
| 正在持续的事 | 长期关注的分组建模 |
| 记录 | 记忆库、产物库、成本、设置 |
| 验收面 | 从「今天」点进任务:证据视图(diff/测试/决策)→ 批准合并 |
| 设置 | 五槽位模型供给、预算、免打扰、隐私开关、用户档案 |

项目通过「从本地文件夹添加」接入;切导航不打断进行中的语音会话(顶栏指示器可跳回)。

## 16. 数据、隐私与备份

### 16.1 你的数据在哪

| 数据 | 位置 |
|---|---|
| 全局状态、账本、审计(SQLite) | `~/.saydo/saydo.db` |
| 配置与密钥 | `~/.saydo/config.toml` + `~/.saydo/.env` |
| 访问令牌 | `~/.saydo/.cap-token` |
| 用户档案(M0) | `~/.saydo/profile.md` |
| 会话转写 | `~/.saydo/sessions/` 与 `<项目>/.saydo/sessions/` |
| 项目知识底座(M1)与产物(M2) | `<项目>/.saydo/knowledge/`、`<项目>/.saydo/artifacts/` |
| 任务 worktree | `<项目>/.saydo/worktrees/<任务ID>` |
| 备份 | `~/.saydo/backups/` |
| 日志 | `~/.saydo/logs/` 与 `~/.saydo/daemon.log` 等 |

### 16.2 隐私承诺的机械落实

- 无账号、无埋点、无遥测、无崩溃收集、无广告 SDK;开发者无法访问你的数据。
- 录音与转写分别同意:缺省不留原始音频(`store_audio=false`),保留文字转写(`store_transcript=true`),可在设置中改。
- 日志与审计分流:日志可轮转,审计记录不可变;敏感内容只记摘要不记原文。
- 语音播报脱敏(§10.3);派发给 AI 工具的环境变量剥除一切凭据(§7.1)。
- 出网流量只有你配置的 AI 上游与语音上游(§4)。

### 16.3 删除与迁移

删除任务/项目即删除其账目与产物引用;「完全忘记」会传播到相关记忆。整机迁移:新机重装后把 `~/.saydo/`(或备份目录)拷回即可,注意 token 与执行器锁定副本需重新登记。删除应用即删除手机端本地数据,电脑端数据由你自行管理。

## 17. 故障排查(FAQ)

**问:打开控制台没反应 / 白页。**
先查健康:`curl -s http://127.0.0.1:47100/health`,不是 ok:true 就看日志(`~/.saydo/daemon.log` 或 `just daemon logs`)。tsx 冷启动需 10-15 秒,多等一会再试。确认打开的 URL 带了 token(`?token=$(cat ~/.saydo/.cap-token)`)。

**问:CLI 模式每轮要想 15-25 秒,是卡死了吗?**
是预期(订阅无头模式的节奏)。思考气泡超过 90 秒会明确报错,不会无限转。想要秒回,配一个 API key。

**问:向导自检失败,说 CLI 未登录。**
按向导给出的修复命令登录(如 `codex login`),点刷新重测。自检是真实调用一次,失败信息会指明是哪一家。

**问:麦克风按钮是灰的。**
桌面网页语音需要 pipeline 进程与语音三键(§10.2)。没配也能用打字与键盘听写。

**问:派发任务停在队列,提示执行器未配置。**
按提示补 `[tier1]` 两键(§8.6)——一般去设置页让向导代填。对话与记账不受影响。

**问:手机突然连不上了。**
令牌可能被轮换(`~/.saydo/.cap-token` 被删后重启会轮换),重新扫码;确认手机与电脑在同一局域网、daemon 带着 `SAYDO_MOBILE_LAN=1` 启动。

**问:任务被停了,说预算熔断。**
三熔断之一触发(§12.4)。去任务详情看是时长、回合还是成本,调整预算或拆小任务后可继续。

**问:Touch ID 批准合并没反应 / 报错。**
S3 强认证要求经 `http://localhost:47100` 打开控制台(绑定本机域名);首次使用先在任务详情完成一次「注册批准指纹」。

**问:支持 Windows / Linux 吗?**
暂不支持,当前版本面向 macOS(常驻依赖 launchd)。没有明确的跨平台时间表,不承诺。

**问:要给 SayDo 付费吗?**
不用。桌面服务免费开源;你只为自己的 AI 供给(订阅或 key)付费,直接付给厂商。

**问:放朋友/家人用要注意什么?**
开发类请求会真实派发执行并消耗额度。开放给别人前确认预算设置,知会三熔断默认值;S3 合并只在本机强认证,远程放不了行。

## 18. 路线图与完成度

不画饼,做到哪说到哪:

**现在可用**:桌面服务(daemon + 控制台 + 语音管线,macOS);对话/思考/评估层的 7 家 CLI 接入与 API 直连;项目记忆与四色账本;就绪判定与决策包;编码任务执行(Cursor CLI 后端)、审批门、三熔断、验收与 S3 强认证合并;移动网页(局域网扫码);备份;launchd 常驻。

**进行中**:Claude Code CLI 作为执行后端(方案定档,接入中)。

**规划中(不承诺时间)**:iOS / Android / HarmonyOS App(按住说话、拍板审批、手机推送);来电式语音汇报(PushKit + CallKit);受控执行环境(独立用户/容器);更多执行后端(Codex);远程访问的正式形态。

## 19. 开发者指南

SayDo 是单仓 monorepo(TS/Node 22 + Python):

| 目录 | 内容 |
|---|---|
| `packages/contracts` | 数据契约(zod schema、状态机、契约测试)——一切类型以此为准 |
| `packages/daemon` | 核心守护进程 |
| `packages/console` | Web 控制台(Vite + React) |
| `packages/cli` | 桌面 CLI 小工具 |
| `pipeline` | 语音管线(Python) |
| `e2e` | 端到端测试与实施证据 |
| `docs` | 设计文档、数据契约、ADR 与实施计划(canonical) |

```bash
pnpm install && cd pipeline && uv sync
just dev    # 起 daemon + pipeline + console(开发热更)
just ci     # 本地双矩阵 CI(node + python + 门禁)
```

参与前请读仓库根目录的 `AGENTS.md`(协作约定)与 `README.md`(文档地图):包括零 emoji 门禁、状态词纪律、契约不分叉(类型一律 import `@saydo/contracts`)、两提交法等硬规则。设计依据在 `docs/01-11` 与 `docs/adr/`,按文档地图索引阅读。

## 20. 支持与联系

- 使用问题、隐私请求:support@octoooo.com
- 源码与问题反馈:github.com/Octo-o-o-o/SayDo(开 issue)
- 邮件请说明设备系统版本、是否完成扫码配对;**不要**在邮件里粘贴 API key、配对令牌或完整日志。
- 安全问题请邮件单独标注,先私下告知、勿公开细节,我们会认真回应。

## 附录:速查表

| 项 | 值 |
|---|---|
| daemon 端口 | 47100(`SAYDO_DAEMON_PORT` 可改) |
| 控制台入口 | `http://127.0.0.1:47100/?token=$(cat ~/.saydo/.cap-token)` |
| 健康检查 | `curl -s http://127.0.0.1:47100/health` |
| 状态根目录 | `~/.saydo`(`SAYDO_HOME` 可改,须绝对路径) |
| 常驻管理 | `just daemon install / status / logs / stop / uninstall / deploy` |
| 备份 | `just backup` → `~/.saydo/backups/<时间戳>/` |
| 手机访问 | 启动加 `SAYDO_MOBILE_LAN=1`,控制台「与手机配对」出码 |
| 环境变量 | `SAYDO_HOME`(状态根)、`SAYDO_DAEMON_PORT`(端口)、`SAYDO_MOBILE_LAN`(局域网手机访问) |
| .env 主要键 | `OPENROUTER_API_KEY` / `DEEPSEEK_API_KEY` / `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`(模型);`VOLC_APP_ID` / `VOLC_ACCESS_TOKEN` / `DOUBAO_TTS_API_KEY`(语音) |

---

# C. 维护注记(不入正式页面)

## C.1 发现的口径问题(建议随 Docs 上线一并处置,部分需 owner 裁决)

1. **仓库无 LICENSE 文件**(根目录与 package.json 均无 license 声明),官网与 Docs 均宣称「开源」。§9.4 已留占位。建议:owner 定许可证并在仓库补 LICENSE,Docs 填实;在补之前「开源」措辞存在事实缺口。
2. **官网 FAQ「语音无需额外配置,浏览器即可用」不准确**:桌面网页语音需 VOLC 三键 + pipeline 进程;无 key 时麦克风禁用仅可打字(B 面正文 §10 已按实情写并给出「语音是可选增强」的口径)。建议官网该句同步修正,否则 Docs 与官网自相矛盾。
3. **官网「驱动你已有的 AI(现在可用)」在执行层的张力**:对话/思考/评估层 7 家 CLI 确已可用;但执行后端当前仅 Cursor CLI 可启动(claude_code/codex 在 DevAgentBinding 合同里存在,运行时非 cursor 一律拒起;Claude Code 执行后端方案已定档未实施)。Docs §7.3 已按两层如实拆开。官网是否微调措辞由 owner 定。
4. **templates/saydo.config.example.toml 两处陈旧**:头部注释「四个推理槽均走 API;CLI 订阅接入开发中」已过时(T18b 起四槽均支持 CLI);`[models.dev]` 示例 `agent = "claude_code"` 与运行时(仅 cursor 可启动)不符,且注释「首发用 Claude Code…Agent SDK」是旧路线。建议随 Docs 上线一并修模板,否则用户照抄会被拒起。
5. **手机扫码的现状口径**:移动 LAN + 扫码代码已收口,需 `SAYDO_MOBILE_LAN=1` 启动才可用;Docs §11 已写明条件。官网 FAQ「手机扫码即连」未提启动开关,建议对齐。
6. writing 项目类型:代码已启用 `["coding","writing"]`(owner 机),缺省安装仍为 `["coding"]`,且 writing 窄版未经真人验收。B 面正文未提 writing,如实略去;若 owner 希望对外预告,建议放路线图并标实验性。

## C.2 页面实施补充

- 静态站无构建:单页长文 + 目录锚点最易维护;若拆页,建议按 B 部分四大块。
- 中英双语:英文版整页照译,完成度标注与中文严格同义(评审硬约束)。
- 上线前过 `scripts/check-emoji.sh`;SEO 补 title/description/canonical/hreflang(与现有页一致)。
- 建议随 Docs 上线在仓库加 CHANGELOG(或在 Docs 加「版本记录」小节),否则 §9.4「版本以 tag 为准」没有可读的落点。
- 长期维护:每次批次收口后同步对应小节;「进行中」条目(Claude Code 执行后端)落地后改「现在可用」并更新 §7.3/§18。

## C.3 主要事实出处索引(核对自 main@29f33cf 工作树)

- 安装/启动/手机/停启命令:`DEPLOY-测试机部署清单.md`;端口/health/token:`packages/daemon/src`(缺省 47100)、`packages/cli/src/options.ts`
- launchd 常驻与 deploy:`packages/daemon/src/launchd/cli.ts`、`justfile`
- 备份对象与保留期:`packages/daemon/src/backup/cli.ts`、`backup/snapshot.ts`、`docs/09-data-contracts.md`(backup_retention_days=30)
- 7 家 CLI 与登录提示、headless argv、env 白名单、二进制身份核验:`packages/daemon/src/config/cliProviders.ts`、`providers/byoa/cage.ts`、`byoa/provider.ts`、`config/cliCapability.ts`
- kimi/opencode inventory_only、ModelBinding/DevAgentBinding 形状:`docs/09-data-contracts.md`(§11 模型槽位绑定)、`packages/contracts/src/types/modelbinding.ts`
- 执行器仅 cursor、[tier1] 两键与 versions/<ver> 形态:`packages/daemon/src/tier1/validateConfig.ts`、`config/types.ts`
- 三熔断默认值(45 分钟/80 回合/20 元、monthly 200):`packages/daemon/src/brain/liveTools.ts`、`tier1/executor.ts`、`docs/04-key-mechanisms.md`
- worktree/分支/合并(commit-tree + ff-only)/不 push/无 GitHub API:`packages/daemon/src/tier1/executor.ts`、`tier1/s3Tools.ts`、`tier1/operations.ts`
- Gate 0/S0-S3/圈外写/词表/O-1 豁免:`packages/daemon/src/policy/engine.ts`、`tier1/cmdEffect.ts`、`brain/liveTools.ts`(无 bypass 分支)、`docs/09-data-contracts.md`
- verify 登记模板与冻结:`docs/04-key-mechanisms.md`、`tier1/executor.ts`
- M0-M3/奠基 generation/知识独立仓:`docs/04-key-mechanisms.md`、`packages/daemon/src/memory/foundation.ts`
- 四色派生/attention 读模型:`packages/contracts/src/types/focus.ts`、`packages/daemon/src/api/attention.ts`、`docs/11-ui-spec.md`
- 语音(浏览器采集/火山 sauc/seed-tts/三键):`packages/console/src/voice/useVoiceChannel.ts`、`pipeline/src/saydo_pipeline/doubao_asr.py`、`doubao_tts.py`、`templates/saydo.env.example`
- 移动 LAN 白名单/RFC1918 出码/token 轮换缺口:`packages/daemon/src/net/mobileLan.ts`、`pairingInfo.ts`、`packages/console/src/lib/pairing.ts`、`DEPLOY-测试机部署清单.md` §3
- TTS 脱敏/审计日志分流/隐私缺省:`packages/daemon/src/voice/redactor.ts`、`obs/audit.ts`、`obs/logger.ts`、`docs/09-data-contracts.md`
- 控制台新 IA(今天/开口聊/看板/记录/#/m):`docs/08-module-design.md` §6(2026-08-08 修订段)
- 首跑向导/方案卡/自检/慢速预期:`.onboarding-spec.md`、`docs/11-ui-spec.md` §5.8a、`DEPLOY-测试机部署清单.md` §2/§5
- 完成度(哪些可用/Coming soon):官网 `deploy/saydo-octoooo-com/index.html`(R75 口径)、`HANDOFF.md`、`docs/plan/IMPLEMENTATION-PLAN-2.md`;Claude Code 执行后端=进行中(方案 v2 已入库未开工)
