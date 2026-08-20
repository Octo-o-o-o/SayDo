# 官网首页结构与文案稿 v2(Fable,2026-08-20)

> 定位:saydo.octoooo.com 首页(中文 `index.html` / 英文 `en/index.html`)的**结构与文案**修订稿。owner 对现有 UI(R75 重建:印泥朱 + 纸上账本、亮暗双主题、移动适配)满意,本稿**不动视觉与组件**,只调区块顺序 / 取舍与每段文案;供另一会话照稿修改 HTML。
> 依据:本会话实读现站全文(中英)、`docs/01/02/04`、`docs/release/2026-08-13-app-materials.md` §3 商店文案、以及 Docs 内容稿 `docs/site/2026-08-20-docs-page-content.fable.md` §C.1 的事实核对结论(仓库可见性、执行器现状、Demo / 回叫 / 奠基 落地程度等)。
> 硬约束:零 emoji;状态词纪律;完成度诚实(现在可用 / Coming soon;必要处加「进行中」);不暗示无人值守完成;品牌印泥朱 / 纸感;禁赛博霓虹。
> 本稿三部分:**A 结构**(现状 → 建议,每区 保留 / 改文案 / 新增 / 合并)/ **B 逐区文案定稿**(中文为主,英文给对应句)/ **C 事实红线与待 owner 裁决** / **D 自审记录**。

---

# A. 结构

## A.1 现状区块(自上而下)与诊断

| # | 现状区块 | 锚点 | 诊断 |
|---|---|---|---|
| 0 | 顶栏 nav:怎么工作 / 为什么不一样 / 产品现状 / 下载 / 常见问题 / 中·EN / 主题 | — | 缺「文档」入口;「下载」名不副实(无安装包可下,实际是「开始用」) |
| 1 | Hero:eyebrow + H1「说到,就做到。」+ 副标 + 长描述 + 双按钮(查看开源仓库 / 了解怎么工作)+ aside + 语音条 + 四色账本 + 图例 | `.hero` | 主视觉与账本合一很好。**主按钮指向 GitHub**——对访客而言首要动作应是「开始用」;仓库公开前该按钮更不宜为主 CTA。长描述一句 70+ 字可再收 |
| 2 | 信任条:数据不出你的设备 / 开源免费 / 复用你已有的 AI 订阅 / 无账号·无云端·无埋点 | `.strip` | 好;「开源免费」受 C-1 约束 |
| 3 | 怎么工作:七步时间线 | `#how` | (2026-08-20 已解除)Demo 小样与回叫升级链当日落地;步 3 / 6 用 B.3 更新版文案 |
| 4 | 痛点对照:没有它的时候 / 有了说到 | `#contrast` | 好,保留 |
| 5 | 为什么不一样:六卖点卡 | `#why` | 「先吃透,再办事」中「先深度研究透」偏重;「AI 真的在干活」把推理供给与执行器混为一句(Gemini CLI 不能执行;Claude Code 执行器在建) |
| 6 | 产品现状:7 张卡(3 可用 + 4 Coming soon) | `#status` | 诚实区是亮点;「驱动你已有的 AI · 现在可用」需拆两层;可补「进行中」徽标承载 Claude Code 执行器(新增一种 badge 颜色属最小 UI 变更,可选) |
| 7 | 沟通面 ↔ 执行面 | 无 id | 好;「局域网直连」属实 |
| 8 | 隐私带 | `#privacy` | 好 |
| 9 | 开始用 / 下载:四平台卡 | `#download` | 文案把「手机扫码即连」写成默认体验,但 App 未上架、LAN 面需开关;缺「安装说明」入口;macOS 卡当前无可点的去处 |
| 10 | FAQ 五问 | `#faq` | 好;可补「花钱吗」「会不会替我 push / 开 PR」两问(访客最常问) |
| 11 | 尾 CTA:前往 GitHub / 了解隐私承诺 | — | 加「读文档」 |
| 12 | 页脚四栏 | `.site-footer` | 资源列加「文档」 |

## A.2 建议结构(保持区块顺序基本不变,最小改动)

```
0  顶栏:怎么工作 · 为什么不一样 · 产品现状 · 开始用 · 文档 · 常见问题 · [中 | EN] · [主题]
1  Hero(改按钮:主=开始用 → #start;次=怎么工作 → #how;GitHub 移到 aside 或第三按钮)
2  信任条(保留)
3  怎么工作(七步保留;改第 3、6 步文案)
4  痛点对照(保留)
5  为什么不一样(六卡保留;改 2、3 卡文案)
6  产品现状(7 卡保留;改「驱动你已有的 AI」卡;可选新增「Claude Code 执行器 · 进行中」卡或把该信息并入上卡)
7  沟通面 ↔ 执行面(保留)
8  隐私带(保留)
9  开始用(#download → 建议 id 改为 #start 并保留 #download 锚点兼容;改文案;macOS 卡加「安装说明 →」链到 /docs/#quickstart)
10 FAQ(五问保留 + 新增两问)
11 尾 CTA(三按钮:开始用 / 读文档 / 前往 GitHub)
12 页脚(资源列加「文档」)
```

原则:**不新增大区块、不改组件**;所有改动都是「换词 / 加链接 / 调按钮指向」级别。英文页同步。

---

# B. 逐区文案定稿

> 标注:**[保留]** = 与现站一致;**[改]** = 替换为本稿文本;**[新增]**。英文在每条中文后给出(斜体标 EN)。

## B.0 顶栏

[改] nav 项:`怎么工作 · 为什么不一样 · 产品现状 · 开始用 · 文档 · 常见问题`
*EN: How it works · Why different · Status · Get started · Docs · FAQ*

(「开始用」指向 `#start`;「文档」指向 `/docs/`,英文 `/en/docs/`。)

## B.1 Hero

- [保留] eyebrow:`语音驱动 · 本地优先 · 开源` / *VOICE-FIRST · LOCAL-FIRST · OPEN SOURCE*
- [保留] H1:`说到,就做到。` / *Say it. Consider it handled.*
- [保留] 副标:`聊清楚,它去办,办完叫你验收。` / *From conversation to completion — it calls you back when it's ready for your review.*
- [改] 描述(收短):`一个你能对着说话的高级助手。你只管把事聊清楚——它先读透你的项目,把每件事记成一本四色账;听懂了,就驱动你电脑上已有的 AI 去办;执行和检查都跑完,叫你来验收。`
  *EN: A voice-first chief of staff for your projects. Just talk it through — it studies your project first, keeps a four-color ledger of everything, and once it understands, it drives the AI tools already on your machine. When the run and its checks are done, it calls you back for review.*
- [改] 按钮:主 `开始用`(→ `#start`)/ 次 `了解怎么工作`(→ `#how`)
  *EN: Get started / How it works*
- [改] aside:`桌面服务开源免费 · 查看 GitHub` | `iOS / Android / HarmonyOS · Coming soon`(GitHub 链接指向已公开的仓库)
  *EN: Desktop service · free & open source · View on GitHub | iOS / Android / HarmonyOS · Coming soon*
- [保留] 语音条示例句、四色账本四行与图例(文案已贴合产品:等你拍板 / 你欠的动作 / AI 正在办 / 等外部回音)。

## B.2 信任条

[保留] `数据不出你的设备 · 开源免费 · 复用你已有的 AI 订阅 · 无账号 · 无云端 · 无埋点`
*EN: Your data never leaves your devices · Free & open source · Uses the AI subscriptions you already have · No accounts · No cloud · No tracking*

## B.3 怎么工作(七步)

- 标题 [保留]:eyebrow `从聊一句,到办完叫你` / H2 `一个完整的闭环` / 引语 `你只管聊和拍板,重活它来。执行和检查都跑完,它主动叫你验收——你点头,才算交付。`
- 1 开口聊 [保留]
- 2 就绪决断 [保留]
- 3 决策包 [改]:`端出决策包请你拍板:成果预览(做完你会得到什么)、实施计划(每步标好 AI 执行还是需要你配合)、预计花费与封顶,外加一份轻量小样——和计划同源生成的网页预览,先看一眼「最终长什么样」。看着具体的东西说「对 / 不对 / 调一下」,比凭空写需求容易一个数量级。`
  *EN: A decision pack lands in front of you: an outcome preview (what you'll get), a plan (each step marked AI-run or needs-you), the expected cost with a hard cap — plus a lightweight mock: a web preview generated from the same plan, so you can see what "done" looks like first. Saying "yes / no / tweak this" to something concrete is an order of magnitude easier than writing a spec from scratch.*
- 4 你拍板 [保留]
- 5 后台执行 [保留]
- 6 办完叫你 [改]:`执行和检查都跑完,它主动叫你验收——说「等你验收」,而不是「做完了」。回叫按升级链走:配好语音时它在线开口叫你,没应答再升级为桌面通知和手机推送(ntfy);免打扰时段只留一条轻推送,过后补叫。`
  *EN: When the run and its checks finish, it says "ready for your review" — not "done". Callbacks escalate: with voice set up it speaks to you at the console; if you don't answer, it escalates to a desktop notification and a push to your phone (ntfy). During do-not-disturb hours it leaves one quiet push and follows up after.*
- 7 验收沉淀 [保留]

## B.4 痛点对照

[保留] 两栏原文。

## B.5 为什么不一样(六卡)

- 标题 [保留]:`不是又一个语音工具` + 引语。
- 说了就记 [保留]
- 先吃透,再办事 [改]:`第一次聊一个项目,先读透结构、约定与关键文件,沉淀成持久知识底座,之后每次都带着对你项目的理解开聊。这是「说到」和「新开一个聊天窗口」的分水岭。`
  *EN: The first conversation about a project starts by reading its structure, conventions, and key files into a persistent knowledge base — every later conversation begins with that understanding. That's the line between SayDo and a fresh chat window.*
- AI 真的在干活 [改]:`接上你电脑上已登录的 AI——Codex、Claude Code、Cursor、Gemini CLI、Grok 等替它对话、思考、评估;动手改代码由 Cursor Agent 承担,Claude Code 执行器在建。已订阅哪家用哪家,无需额外付费。`
  *EN: It plugs into the AI already signed in on your machine — Codex, Claude Code, Cursor, Gemini CLI, Grok and more for thinking and evaluation; hands-on code changes run through Cursor Agent today, with a Claude Code executor in progress. Whichever you subscribe to, it uses. No extra fees.*
- 人拍板才算数 [保留]
- 数据完全在你手里 [保留]
- 跨设备同一本账 [保留]

## B.6 产品现状(7 卡)

- 标题 [保留]:eyebrow `产品现状` / H2 `做到哪了,一眼看清` / 引语 `不画饼。已经能用的如实标注「现在可用」,还在路上的如实写 Coming soon。`
- 桌面服务 · 现在可用 [改]:`macOS 上的执行面:守护进程、Web 控制台与可选语音管线,开源免费;装好自己的电脑就是全部基础设施。目前以源码形式提供,安装说明见文档。`
  *EN: The execution side on macOS: daemon, web console, and an optional voice pipeline. Free and open source — your own computer is all the infrastructure there is. Currently distributed as source; see the docs to install.*
- 驱动你已有的 AI · 现在可用 [改]:`对话、思考、评估可用你已登录的 Codex / Claude Code / Cursor / Gemini CLI / Grok / Qwen / Copilot 订阅,或任一 OpenAI 兼容 API;真正动手改代码的执行器当前为 Cursor Agent。`
  *EN: Conversation, reasoning, and evaluation run on your signed-in Codex / Claude Code / Cursor / Gemini CLI / Grok / Qwen / Copilot subscriptions, or any OpenAI-compatible API; the executor that actually edits code is Cursor Agent today.*
- 项目记忆与四色账本 · 现在可用 [保留]
- [可选新增] Claude Code 执行器 · 进行中:`用你的 Claude 订阅登录态驱动 Claude Code 在隔离 worktree 里改代码,审批门同样 fail-closed。能力实测与审批门已落,接线中。`(需新增一种「进行中」徽标;若不想动 UI,把这句并入上一张卡末尾)
  *EN: Claude Code executor · In progress — drive Claude Code with your own Claude subscription in an isolated worktree, behind the same fail-closed approval gate. Capabilities verified and the gate built; wiring in progress.*
- iOS / Android / HarmonyOS / 来电式语音汇报 四卡 [保留]

## B.7 沟通面 ↔ 执行面

[保留] 全部文案。

## B.8 隐私带

[保留] 全部文案(与隐私政策一致)。

## B.9 开始用(`#start`,保留 `#download` 锚点)

- 标题 [改]:eyebrow `开始用` / H2 `桌面开源,App 在路上`(保留)
- 引语 [改]:`桌面服务是执行面,开源免费;移动 App 是沟通面,正在朝上架推进。在你的 Mac 上跑起桌面服务就能开聊:不需要申请任何 API key——电脑上有任意一家已登录的 AI 命令行工具即可;手机可在同一局域网里扫码连上,App 上架前先用手机浏览器。`
  *EN: The desktop service is the execution side — free and open source. The mobile apps are the communication side, working toward store release. Run the desktop service on your Mac and start talking: no API keys to apply for — any signed-in AI command-line tool on your computer is enough. Your phone can pair over your LAN; until the apps ship, use the phone's browser.*
- macOS 卡 [改]:`macOS 桌面服务 · 开源免费 · 现在可用` + 链接 `安装说明 →`(`/docs/#quickstart`)+ `GitHub →`
  *EN: macOS desktop service · Free & open source · Available now · Install guide → · GitHub →*
- iOS / Android / HarmonyOS 三卡 [保留] Coming soon

## B.10 FAQ

- 标题 [保留]:`先说清楚它不是什么`
- 五问 [保留](「需要什么前提」一问末句 `语音无需额外配置,浏览器即可用` 成立,可保留;如要更准:`语音不用额外配置——浏览器自带的系统语音就能说;想要更准更自然可选配云端语音`)
  *EN (optional): Voice needs no setup — your browser's built-in speech works out of the box; cloud voice is an optional upgrade for better accuracy.*
- [新增] `要花钱吗?`:`桌面服务免费。AI 的费用直接付给你选的厂商:用你已有的订阅(额度内零额外费用),或你自己的 API key 按量计费;每个任务有成本、时长、回合三重熔断。说到不加价、不经手、不代充。`
  *EN: Does it cost money? The desktop service is free. AI costs go straight to the vendor you choose — your existing subscription (no extra fees within its quota) or your own API key, pay as you go — with per-task cost, time, and turn circuit-breakers. SayDo adds no markup and never handles payment.*
- [新增] `它会替我 push 或开 PR 吗?`:`不会。它只在你项目里的独立 worktree 和 saydo/<任务> 分支上改代码;合并到你的分支要你 Touch ID 确认或自己动手;推送远端、开 PR 永远是你之后自己做的事。`
  *EN: Will it push or open PRs for me? No. It only edits code in an isolated worktree on a saydo/<task> branch inside your project; merging into your branch takes your Touch ID or your own hands, and pushing or opening a PR is always something you do afterwards.*

## B.11 尾 CTA

- 标题 / 引语 [保留]:`把「说」和「做」连起来` / `桌面服务开源免费,App 在路上。从今天起,说过的事,件件有着落。`
- 按钮 [改]:`开始用`(→ `#start`)/ `读文档`(→ `/docs/`)/ `前往 GitHub`
  *EN: Get started / Read the docs / Go to GitHub*

## B.12 页脚

- [保留] 品牌句、产品列、法律列、版权行。
- [改] 资源列:`文档 · GitHub · 支持 · 常见问题` / *Docs · GitHub · Support · FAQ*
- [改] 产品列「下载」→「开始用」/ *Download → Get started*

---

# C. 事实红线与待 owner 裁决

| # | 事项 | 现状 | 建议 |
|---|---|---|---|
| C-1 | **已解除(2026-08-20)**:LICENSE = Apache-2.0;仓库已公开(`github.com/Octo-o-o-o/SayDo` = 快照仓,全史在私有归档;处置记录 `docs/plan/2026-08-20-repo-public-readiness.fable.md` §3.1) | 首页「开源免费」与 GitHub 直链成立 | 本稿可按原文案上线 |
| C-2 | 「驱动你已有的 AI」两层混写 | 推理槽 7 家 CLI 可用;执行器仅 Cursor;Claude Code 执行器第一批(能力实测 + 审批门)已收口(2026-08-20)、接线批在途;Gemini CLI 无执行计划 | 按 B.5 / B.6 拆句;是否加「进行中」徽标由 owner 定 |
| C-3 | **已解除(2026-08-20)**:七步第 3 步「轻量 Demo」 | S1 批落地:决策包同轮生成轻量小样(机械渲染)+ 控制台「看小样」+ 本机同轮上屏 | B.3 第 3 步已恢复小样表述(更新版) |
| C-4 | **已解除(2026-08-20)**:七步第 6 步回叫升级链 | S2 批落地:在线语音回叫(控制台在线 + 语音管线健康)→ macOS 桌面通知 + ntfy;免打扰只推不响;「知道了」/开口即应答 | B.3 第 6 步已按新事实改写 |
| C-5 | 「先深度研究透」 | 奠基 = 机械管道;LLM 深研未做 | B.5 改「读透结构、约定与关键文件」 |
| C-6 | 「手机扫码即连」 | 需 `SAYDO_MOBILE_LAN=1`、仅私网、App 未上架(浏览器或自构建壳) | B.9 引语加限定;FAQ 保留但 Docs 写清 |
| C-7 | 「语音无需额外配置,浏览器即可用」 | 成立(浏览器系统语音回退,2026-08-13) | 可保留;B.10 给更准版本供选 |
| C-8 | 英文页同步 | 现英文页与中文逐段对应 | 每处 [改] 都给了 EN;按同位置替换 |
| C-9 | `#download` 改 `#start` | 站内 nav / 页脚 / en 页引用该锚点 | 保留旧 id 作兼容(同一 section 双 id 不合法——可在 section 上设 `id="start"`,并在其前放一个空 `<span id="download"></span>` 锚) |

---

# D. 自审记录

- 对照现站中英文全文逐区核对;每条 [改] 的事实依据均可在 Docs 稿 §C.1 / §C.3 找到坐标;未引入任何未落地能力的承诺;状态词全稿只用「等你验收」「交付」。
- 零 emoji:本稿过 `scripts/check-emoji.sh`。
- 未动视觉:所有建议均为文案替换、链接指向与锚点;唯一可选 UI 变更 = 新增「进行中」徽标(B.6),已标可选并给不改 UI 的替代。
- 2026-08-20 午前复核(第二轮):C-1 / C-3 / C-4 解除(仓库公开、Demo 小样与回叫升级链落地),B.1 aside / B.3 第 3、6 步 / B.6 进行中卡 / C 表同步更新;其余区块复核无变,可直接实施。
