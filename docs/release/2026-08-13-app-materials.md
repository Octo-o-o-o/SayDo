# 「说到」(SayDo) 上架与备案材料总包 — 2026-08-13

> 单一材料终稿。归并 `docs/store/00–05`(既白 2026-08-13 起草)与 `docs/release/` 战役集的重叠内容,
> 应用名统一为**「说到」**(owner 2026-08-13 定名,占用核验见 [name-occupancy.md](name-occupancy.md) §6)。
> **Supersedes: `docs/store/00..05` 全部六份**(原文保留,已加弃用横幅,不再更新)。
>
> 分工边界(避免再分叉):过程状态与拍板以 [2026-08-13-store-submission-status.md](2026-08-13-store-submission-status.md) 为准;
> 已提交备案原文以 [2026-08-13-tencent-icp-app-filing.md](2026-08-13-tencent-icp-app-filing.md) 为准;
> 商店表单字段投影以 [metadata.json](metadata.json) 为准(本文 §3 已同步过去);隐私表单唯一上游是
> [data-disclosure-matrix.md](data-disclosure-matrix.md);证书指纹与标识符以 [filing-cheatsheet.md](filing-cheatsheet.md) 为准。
> 本文收拢**给人读、给表单抄的成文材料**:隐私政策、商店文案、审核备注、软著说明。阅读地图见 [README.md](README.md)。

## 0. 归并裁决记录

store/ 与 release/ 同日各自起草,重叠处按「owner 已拍板 > 已实证 > 后写推测」裁决:

| 议题 | store/ 版 | release/ 版 | 终稿裁决 |
|---|---|---|---|
| 应用名 | 【应用名】占位 | 「说到」已定 | **说到**;英文 SayDo |
| 商店范围 | iOS+鸿蒙优先,国内安卓(华米OV/应用宝)后置,未提 Play | App Store + Play + AGC,含中国大陆(DEC-3 已拍板) | **三店**;国内安卓商店后置未选,两版一致 |
| 备案通道 | 「工信部经商店平台通道」 | 腾讯云接入商「新增 App 服务」(千手先例) | **腾讯云**;商店只核验备案号,不是备案通道 |
| 备案域名 | 「无开发者服务端,必填就填官网」 | `saydo.octoooo.com`(DEC-4 已拍板) | **saydo.octoooo.com**;服务说明如实写本地工具 |
| 隐私页挂网 | GitHub Pages / 官网 | `saydo.octoooo.com/privacy`(等 DNS) | **saydo.octoooo.com/privacy** |
| Android 指纹 | 「提交前采集」 | 已生成 release keystore,指纹在速查卡 | **已完成**,抄 filing-cheatsheet.md |
| Android 包名 | 待核对 build.gradle | — | **已核** `com.octoooo.saydo`(build.gradle.kts:13) |
| 审核演示对策 | 演示视频+临时公网 demo+壳内演示模式 | 「配对不是密码;未建」 | **DEC-9**:审核夹具=家里 Mac mini,仅提审窗口在线,不成产品云;视频必附;壳内演示模式仍建议做(§4) |
| 软著全称 | 【应用名】事务管理软件 V1.0 | 基于「说到」待拟 | **「说到事务管理软件 V1.0」** |
| 商店文案 | 账本叙事(说和做连起来/四色/盖章销账) | agent 叙事(驱动电脑 agent/回叫验收) | **融合版**(§3),已投影 metadata.json |

## 1. 流水线总览

关键路径:**软著(不加急 50–75 工作日,加急 7–15 工作日)> App 备案(主体已有,约 8–23 工作日)> 商店审核(数天)**。
上架备案与功能开发并行,不互相等;但**送审必须等生产壳**(当前 spike 明文 LAN、无审核演示路径,送审必拒。隐私页已挂网,不再是拒因)。

| 步骤 | 前置 | 状态(2026-08-13) |
|---|---|---|
| 1. 中文名拍板 | — | 完成:「说到」,三端 app_name 已改 |
| 2. 软著申请(CPCC,账号名私存) | 定名(已);材料生成(§6) | 材料已按千手体例生成,走官方免费通道。千手 R11 自 2026-07-30 仍待受理,说到不加急 |
| 3. DNS + 隐私页挂网 | Cloudflare 自定义域 | **完成**:`https://saydo.octoooo.com/privacy` 200 |
| 4. App 备案(腾讯云新增 App 服务) | 定名(已)+域名 DNS(已)+鸿蒙叶证书(已) | **管局已通过**(2026-08-21),号 `京ICP备2025153079号-4A`。进度以状态文档为准 |
| 5. 三店建应用占名 | ASC 网页/Play Console/AGC | **完成**(店名「说到」);Bundle ID 已先行 |
| 6. 公安备案 | App 号已下发;腾讯云提示服务开通后 30 日内 | 未做,约 2026-09-20 前 |
| 7. 送审 | 生产壳+截图+Mac mini 审核夹具(DEC-9)+视频+隐私页 200 | 远期;策略见 §4,进度见状态文档 §8 |

## 2. 隐私政策定稿(挂 `saydo.octoooo.com/privacy`)

> 主体=个人 汪义骁(OWN-4 已确认)。挂网生效日期 2026-08-13,联系邮箱 `support@octoooo.com`(复用千手既有邮箱)。
> 政策文本与商店隐私表单必须同源:表单按 data-disclosure-matrix.md 投影,矩阵变了先改矩阵再改本文。
> 注意(不进政策正文):T2 计划引入推送回叫(APNs/FCM/HMS),届时本政策「收集信息」与表单须同步更新后再发布该版本。

---

### 「说到」(SayDo) 隐私政策

生效日期:2026 年 8 月 13 日 | 开发者:汪义骁(个人) | 联系方式:support@octoooo.com

**一句话版本**

「说到」不运营任何服务器。核心账本在你的电脑上；你自行启用的云端语音、AI 上游和推送由你的电脑直连第三方，外发范围以当前配置为准。开发者无法访问、也不收集你的任何数据。

**我们收集哪些信息**

开发者不收集。本应用没有开发者运营的服务端,不设账号体系,不埋点,不接入第三方统计/广告 SDK。开发者不上传、不接收用户数据;你自行启用的语音或 AI 上游由你的电脑按当前配置直连第三方。

**应用会使用哪些设备能力,为什么**

| 能力 | 用途 | 数据去向 |
|---|---|---|
| 相机 | 扫描桌面端展示的配对二维码 | 仅本机解析,不存储图像 |
| 麦克风 | 按住说话 | 音频交给系统语音识别,说到不保存音频;是在设备端处理还是联网处理,取决于应用或系统设置与操作系统厂商的实现,联网时适用该厂商的隐私条款 |
| 语音识别 | 将你的话转成文字(使用系统语音识别,默认设备端处理) | 转写文本仅发送到**你自己配对的电脑**;若你在系统设置中允许了联网语音识别,适用操作系统厂商的隐私条款 |
| 本地网络 | 与你自己电脑上的「说到」服务通信 | 仅限你的局域网,凭配对令牌通信 |

**数据存储与传输**

- 所有事项、对话与账本数据存储在**你的电脑**上的「说到」数据目录;手机端仅作为你电脑的显示与输入设备;
- 手机与电脑之间的通信发生在你的局域网内,凭一次性扫码交换的令牌鉴权;令牌保存在手机系统安全存储(iOS Keychain / Android Keystore / HarmonyOS 等价设施)中;
- 你在桌面端配置的第三方 AI 服务(你自己的 CLI 订阅或 API key)由你的电脑直接调用,适用你与相应服务商之间的协议;本应用开发者不经手、不可见。

**数据删除**

删除应用即删除手机端全部本地数据(配对信息与缓存);电脑端数据由你在电脑上自行管理与删除。

**未成年人**

本应用不面向未满 14 周岁的未成年人设计,不收集任何个人信息,亦不含针对未成年人的内容。

**政策变更**

政策如有变更,将在本页面更新并标注生效日期。

**联系我们**

support@octoooo.com

---

## 3. 商店文案定稿(已投影 metadata.json;字段限长以校验脚本为准)

- **App 名称**:说到(zh)/ `SayDo - You Say, AI Do`(en。App Store 精确 `SayDo` 被占,owner 2026-08-22 定后缀,对齐千手「品牌 - 副标」)
- **iOS 副标题(主选)**:`聊清楚,它去办,办完叫你`;备选:`开口说,替你记账盯到做完` / `说过的事,件件有着落`
- **关键词(iOS,zh)**:`语音,待办,任务,GTD,助手,AI,agent,记事,提醒,账本,效率,验收`
- **分类**:效率(Productivity),次分类商务;**分级** 4+;**价格** 免费,无内购
- **通用描述底稿(融合版)**:

> 说到(SayDo)是一个你能对着说话的高级助手。说到,就做到。
>
> 说过的话,转头就忘;答应的事,不知道办到哪了。「说到」把「说」和「做」连起来:你只管把事聊清楚,它先吃透你的项目上下文,替你把每件事记成一本账——等你拍板的、你欠的动作、AI 正在办的、等外部回音的,一眼看清。听懂了它会主动提议开工,驱动你电脑上已有的 AI agent 去办事;执行和检查都跑完,再叫你验收,办完盖章销账。
>
> 手机是沟通面:说话、看进展、拍板、审批。重活留在你的电脑上,手机暂时离开也不打断执行。
>
> - 说了就记:按住说话,想到哪说到哪,随口一句「帮我记一下」立刻进账。
> - 一本账,不是一堆待办:每件事都有归属和去向,四色分明。
> - AI 真的在干活:接上你电脑上已有的 AI(已登录不等于可调用,需已接线并完成自检;登录不等于免费),对话、整理、跟进、动手都由它来。
> - 外发范围以当前配置为准:没有账号注册。手机扫码连接你自己的电脑。模型与语音是否出网取决于你的配置。
>
> 使用前提:需在你的电脑(macOS)上运行「说到」桌面服务(开源免费),手机扫码即连。
>
> 这不是语音输入法,也不是把你的项目上传到云端代跑的服务。核心账本在你的电脑上;模型与语音外发以当前配置为准。

- **平台变体**:
  - App Store 中国区:描述末尾附 `ICP 备案号:京ICP备2025153079号-4A`
  - AGC:描述强调支持 HarmonyOS 设备扫码连接;隐私标签按披露矩阵申报,生成式 AI 备案号规则见矩阵 §C(中国包未接已备案模型前不填)
  - 安卓商店:敏感权限说明逐条同 §2 政策措辞——相机(扫码)/麦克风(语音输入)/局域网(连接自有电脑)
- **截图脚本(提交前真机现刷,五张)**:
  1. 今天页:四色收件箱有真实内容(等你拍板 2 条 / AI 在做 1 条)
  2. 开口聊:按住说话胶囊按下态+一句自然话
  3. 记账瞬间:消息上屏+回执(「先记进记忆…」)
  4. 全景看板:两三件事的泳道
  5. 扫码配对页(体现「连接你自己的电脑」)

## 4. 审核员连接路径 + iOS 审核备注

### 4.1 口径(owner 2026-08-13 拍板,DEC-9)

审核员没有用户的电脑。只靠局域网扫码 = App Store 2.1/4.2、Play、AGC 都会当成空壳。视频只能当辅证。

**要给审核员一条当场能点开的路径,但不把「说到」做成开发者运营的用户云,也不把家里电脑做成产品入口。**

三层,提审时至少前两层就绪:

1. **审核夹具(已选)**:提审时打开家里一台 **Mac mini**,跑「说到」桌面服务,让审核员临时连接。这是审核窗口内的夹具,不是 T3 产品云,也不是 365 天用户后端。审完关机、轮换配对 token。隐私政策与备案备注仍成立:生产用法是连用户自己的电脑。
2. **演示视频(必附)**:桌面起服务 → 扫码 → 说话记账 → 跨端同显 → 销账,2–3 分钟。防审核员不会扫码或夹具网络失败。
3. **壳内演示模式(建议做,不挡 DEC-9)**:无连接也能进示例账本。最贴 4.2,也改善真实用户首启。未实现前不写进商店隐私表单。

禁止:

- 把常开公网 daemon 写进生产路径,当成用户后端
- 把千手 demo 账号写进「说到」审核表单(配对即凭证,不是用户名密码)
- 用当前 spike(明文 HTTP、WebView 无源白名单)送审——夹具也过不了 4.7
- Review Notes 对外写「家里的电脑」(只写 dedicated review desktop;住址与公网 IP 不进本仓)

Mac mini 操作风险(提审执行时处理,不改产品口径):休眠、公网 IP 变化、CGNAT、时差复审。提审窗口内保持开机、防休眠,并确认审核员从公网能连上;二次抽查/拒后再审期间同样保持在线。

### 4.2 中文底稿(自查用)

本应用是开源桌面软件 SayDo(github.com/Octo-o-o-o/SayDo,已核验为本仓 origin)的移动伴侣端「说到」。它不运营任何云服务:用户在自己的 Mac 上运行「说到」桌面服务,手机扫码(局域网内)连接后,作为语音输入与账本查看设备使用。因此:

1. 应用无账号体系、无注册登录、无内购、不收集数据(详见隐私政策);
2. 首次启动为扫码配对页——需要一台运行桌面服务的电脑才能体验完整功能;
3. 为便于审核,我们提供:完整功能演示视频(链接);审核期间可用的专用演示桌面配对二维码(见下)。该演示桌面只在审核窗口在线,不是面向用户的云端服务;生产用法仍是连接用户自己的电脑。

### 4.3 Review Notes(英文,贴表单)

This app ("说到", English name SayDo) is the mobile companion for SayDo, an open-source desktop application (github.com/Octo-o-o-o/SayDo). It operates NO cloud service of its own: the user runs the SayDo service on their own Mac, and this app connects to it over the local network by scanning a pairing QR code. The phone then serves as a voice-input and ledger-viewing device for the user's own desktop.

Key points for review:

- No account system, no sign-up, no in-app purchases, no data collection (no developer-operated user cloud exists; see privacy policy).
- Camera is used solely to scan the pairing QR code; microphone + speech recognition are used for push-to-talk input; whether recognition is on-device or network-based depends on app or OS settings and the vendor's implementation; local network access is required to reach the user's own computer.
- On first launch the app shows a pairing screen. Full functionality requires a desktop instance.

How to review: A dedicated review desktop (SayDo desktop service) will remain online for the entire review window. It is a review fixture only; production usage is LAN to the user's own computer.

- Demo video (full flow): 【链接,提交前填】
- To try the app live: scan the QR code in the attachment【或:open this pairing link on the test device】. Pairing is the credential; there is no username/password.
- The review desktop will remain online until the review is complete (including any follow-up).

### 4.4 提审前执行清单(打开家里 Mac mini 那天)

- [ ] 生产壳已具备:HTTPS(或等价密文)、源白名单、关明文、签名;否则不要送审
- [ ] Mac mini 开机、防休眠,桌面服务常驻;确认审核员从公网可连(穿透或固定入口),本仓不写 IP/端口
- [ ] 只装演示数据(两三件事+账本),与工作机/真实项目隔离
- [ ] 生成配对二维码图片(附件)+配对链接——**配对即凭证;禁止把千手 demo 账号写进「说到」表单**
- [ ] 录演示视频:桌面起服务 → 手机扫码 → 按住说话「帮我记一下…」→ 账面变化 → 跨端同显 → 销账盖章(2–3 分钟,无剪辑花活)
- [ ] 三店 Review Notes 贴 §4.3;审核结论出来前保持在线(含拒后再审)
- [ ] 审核通过后:关机或断开公网入口、轮换 token、清演示数据
- [ ] (排进开发,非 DEC-9 前置)壳内置「演示模式」:无连接时可进只读示例账本

## 5. App 备案(号已下发;本节不再当填写表维护)

腾讯云「新增 App 服务」已交初审并已于 2026-08-21 管局通过。提交原文存根见 **[2026-08-13-tencent-icp-app-filing.md](2026-08-13-tencent-icp-app-filing.md)**;进度与后续动作以状态文档为准;证书抄 [filing-cheatsheet.md](filing-cheatsheet.md)。

索引(与已下发号对齐,不另维护第二套提交字段):

| 项 | 值 |
|---|---|
| 主体 | `京ICP备2025153079号` / 个人 汪义骁 |
| App 服务号 | `京ICP备2025153079号-4A`(2026-08-21 管局通过) |
| 订单 | 订单号私存(2026-08-13 提交) |
| App 名称 | 说到(表单无独立英文名栏;SayDo 只在备注与商店侧) |
| 服务内容 | **工具**(2026-08-21 现网;提交时曾写「软件开发」,专员电话改窄。不是经营性「软件开发」) |
| SDK | 对外不提供 / 外部不使用 |
| 包名三端 | `com.octoooo.saydo` |
| 域名 | `saydo.octoooo.com` |
| 隐私政策 | `https://saydo.octoooo.com/privacy`(挂网 200;腾讯云无独立 URL 栏,写在备注) |
| 公安备案 | 已重交待审(2026-08-21 10:42);功能描述与腾讯云现网备注相同 |

## 6. 软著申请材料(CPCC 线上提交,账号名私存)

1. **申请表**:软件全称=**「说到事务管理软件 V1.0」**(备选:说到语音驱动助手软件 V1.0);开发方式=独立开发;著作权人=汪义骁(与备案主体一致);开发完成日期=如实填(建议取 M2-voice 上真机日 2026-08-12,owner 确认);发表状态=未发表(或已发表填开源发布日)。
2. **程序鉴别材料**:源代码前 30 页+后 30 页,每页 ≥50 行,连续不留白,页眉带软件名+版本+页码。生成方式:按 `git ls-files` 稳定序拼接 `packages/daemon` + `packages/console` 源码,首尾各截 30 页出 PDF。
3. **文档鉴别材料**:操作说明书。千手实交是 7 页图文(不是 30–60 页),说到照同一体例:`artifacts/release/copyright/user-manual.pdf`。

注意:

- 开源不影响登记(著作权自动产生,登记仅为权属证明);
- 软著名称与商店名不必逐字一致,但含「说到」主词,商店审核关联更顺;
- owner 已选**普通通道、不加急**(与千手相同)。R11 流水号 `2026R11L2860558`,2026-08-21 填报并确认提交,现网待受理。

## 7. 与状态文档的接口

本文只放「成文材料」(隐私/文案/审核备注/软著)。做没做、卡在哪,以 [2026-08-13-store-submission-status.md](2026-08-13-store-submission-status.md) 为准(审核夹具拍板 = DEC-9)。已提交备案字段以 [tencent-icp-app-filing.md](2026-08-13-tencent-icp-app-filing.md) 为准,不回写成本节填写表。隐私/文案变更:先改本文,再投影 metadata.json,再回写状态文档对应条目。
