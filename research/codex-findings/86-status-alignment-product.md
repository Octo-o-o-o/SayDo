# 86 · 对外承诺层交叉评审(独立评审员 · 只做 C1–C10 + 新发现)

> 评审对象:调度方「状态未对齐」草稿的**对外承诺层**部分(C1–C10)。
> 本报告只判「访客与商店审核看到的东西是不是真的」。本机狗粮层(H1–H6、launchd、runtime SHA、Tailscale 常驻)交另一路,
> 本报告对它们的全部立场压缩成一句:**那是对内档案,不是对外承诺,不得用它去改官网文案。**
> 三级词表:`[ok]` 草稿主张成立 / `[warn]` 方向对但过满、混层或受众错 / `[fail]` 主张不成立或按它改会把对外口径改假。
> 分级:A = 对外自相矛盾 / 完成度撒谎 / 让法律页或商店口径变假;B = 混层、徽章用词不准、档案与页面脱节;C = 文风。

---

## 1. 评审身份与取证范围

独立评审员,与调度会话零上下文,只读取证,未做任何写入(除本文件)。未 commit、未 deploy、未改官网、未改 HANDOFF、未起 nested agent。

### 1.1 本会话真实读过的文件

对外页面(全部为仓内 `deploy/saydo-octoooo-com/` 工作树版本,**未**抓线上 HTML 比对):

- `deploy/saydo-octoooo-com/index.html`(541 行,全文)
- `deploy/saydo-octoooo-com/en/index.html`(541 行,按段取证:信任条、状态卡、架构、隐私带、开始使用、FAQ)
- `deploy/saydo-octoooo-com/docs/index.html`(977 行,全文)
- `deploy/saydo-octoooo-com/en/docs/index.html`(997 行,按 Windows/Linux FAQ 取证)
- `deploy/saydo-octoooo-com/privacy/index.html`(149 行,正文全读)
- `deploy/saydo-octoooo-com/en/privacy/index.html`(149 行,正文全读)
- `deploy/saydo-octoooo-com/terms/index.html`(124 行,正文全读)
- `deploy/saydo-octoooo-com/support/index.html`(检索,无网络口径命中)
- `docs/site/2026-08-20-docs-page-content.fable.md`(941 行,按 Windows/Linux 段取证)

对外主张的代码与档案侧证据:

- `docs/release/2026-08-13-store-submission-status.md` §0
- `e2e/evidence/w54a-claude-cli.md` §范围声明 / §1 阻塞红表
- `packages/daemon/src/tier1/validateConfig.ts`(`tier1StartupVerdict`)
- `packages/daemon/src/net/mobileLan.ts`(全文 26 行)
- `packages/daemon/src/net/identity.ts`(`IdentityVia` / `hostAllowed` / `verifyIdentity`)
- `packages/daemon/src/voice/hub.ts` L138–156(LAN 面上下行白名单)
- `packages/daemon/src/index.ts`(按 `idvVia` 检索路由裁决点)
- `pipeline/src/saydo_pipeline/vad.py` 头注释与阈值常量
- `apps/ios/SayDo/ConnectionStore.swift`
- `apps/android/app/src/main/java/com/octoooo/saydo/TokenStore.kt`(全文 74 行)
- `apps/harmonyos/entry/src/main/ets/security/SecureStore.ets`
- `packages/cli/src/emergencyReaper.ts`(Windows 支撑度)

### 1.2 本会话真实跑过的命令

- `git rev-parse HEAD` → `088b8f0cc176bc2be9cf09235a640301dd35cb55`
- `git log -1` → `088b8f0 2026-08-20 13:10:42 +0800 docs(site): 两稿同步 2026-08-20 收口后事实……`
- `wc -l` 对上列九个页面文件(行数已写入 §1.1)
- 若干 `rg` / `fd` 检索(pipeline 全目录 `partial|interim|字幕` 零命中;`apps/` 三端令牌存储实现定位)

### 1.3 明确未跑、未复核的

- **未** curl 线上 `https://saydo.octoooo.com/`。本报告全部结论针对**仓内工作树版本**;工作树相对 HEAD 有未提交改动(`index.html` / `privacy` / `terms` / `support` / `site.css` / `theme.js` 已改,`en/` 全系与 `docs/index.html` 为未跟踪新增)。**线上是否已是这一版,本会话未独立复核。** 若线上仍是旧版,下列 C2 / C5 的部分结论(架构图已写「局域网或远程连接」)不适用于线上。
- **未** 复核 `/health` `runtimeSha`、launchd、Tailscale 状态、`claude auth status`、GitHub Actions run —— 属本机层,交另一路。
- **未** 复核商店后台实况(App Store Connect / Play / AGC),只读了仓内 `2026-08-13-store-submission-status.md` 的自述。

---

## 2. 分层纪律裁决:哪几条草稿混了层

我接受 prompt 给的三层时钟。按这个尺子,草稿在对外段里混层的有两条:

| 条 | 混层判定 |
|---|---|
| C8 | **[warn] 混层。** 草稿问「文档 LAN 手机面 / Focus / 回叫升级链标『现在可用』是对 HEAD 说话,该不该加『相对源码 / 需开 `SAYDO_MOBILE_LAN`』」。这是拿本机常驻落后的账去要求对外文档加免责。访客不跑 owner 的 7 月树,访客跑的就是 `git clone` 的 HEAD——对访客而言 HEAD 就是「今天能装到什么」,文档标「现在可用」正确。而「需开 `SAYDO_MOBILE_LAN=1`」文档**已经写了**(`deploy/saydo-octoooo-com/docs/index.html:320`)。加「相对源码 HEAD」这类措辞属于把内部时钟泄漏到对外页面。 |
| C4 | **[warn] 受众错。** 草稿说「可能成立于原生壳、不成立于手机浏览器 dogfood」。隐私政策的规制对象是**商店里的移动 App**(`deploy/saydo-octoooo-com/terms/index.html:62` 把本产品定义为「开源桌面软件的移动伴侣」),不是 owner 的浏览器狗粮路径。用浏览器路径去否掉商店隐私页是拿错受众——prompt 自己也点了这一句,我确认该提醒成立。 |

其余 C1 / C2 / C3 / C5 / C6 / C7 / C9 / C10 都落在对外层,不存在混层问题。

---

## 3. 逐条裁决 C1–C10

### C1 · Windows/Linux 首页「内测中」vs 文档「暂不支持、不承诺」 —— `[ok]` **A 级**

草稿成立,且比草稿描述的更严重:这是**中英四个页面之间的直接自相矛盾**,不是措辞不齐。

首页说内测:

- `deploy/saydo-octoooo-com/index.html:96` — 「Windows / Linux / iOS / Android / HarmonyOS · 内测中 · 发邮件申请」
- `deploy/saydo-octoooo-com/index.html:383` — 「Windows 与 Linux 正在内测」
- `deploy/saydo-octoooo-com/index.html:401` / `:406` — Windows / Linux 各挂 `badge-progress`「内测中」
- `deploy/saydo-octoooo-com/index.html:431` — 「Windows、Linux 与移动 App 均在内测。」
- 英文同位:`deploy/saydo-octoooo-com/en/index.html:96` / `:383` / `:401` / `:406` / `:431`(「Closed beta」)

文档说不支持:

- `deploy/saydo-octoooo-com/docs/index.html:856` — 「**支持 Windows / Linux 吗?** 暂不支持,当前面向 macOS……**没有明确时间表,不承诺**。」
- `deploy/saydo-octoooo-com/docs/index.html:262` — 前提表「其他系统未支持」
- `deploy/saydo-octoooo-com/en/docs/index.html:876` — 「Not for now …… no clear timeline, no promises.」
- FAQ 源稿 `docs/site/2026-08-20-docs-page-content.fable.md:771` 同口径

代码侧站在文档这边:`packages/cli/src/emergencyReaper.ts` 明写「Windows agent process-group reaper 尚未闭环」——不是「内测中」,是关键收尾链在 Windows 上根本没做完。

「内测中」在中文语境下承诺的是「有包、有名额、申请能拿到」。仓内没有任何 Windows/Linux 分发物或内测名单的证据。**首页那句是对访客的假承诺,不是文档太保守。**

一句修法:首页 Windows/Linux 从「内测中」降为「暂不支持」,把「发邮件申请」改成「想要就留个邮箱」,与 `docs/index.html:856` 对齐。

### C2 · 架构图写「局域网或远程连接」,法律页/隐私带/FAQ 仍写「只在局域网」 —— `[ok]` **A 级**(但要收窄修法)

草稿成立。同一个首页里自己打自己:

- `deploy/saydo-octoooo-com/index.html:346` — 架构连线 `al-label`「局域网或远程连接」(英文 `en/index.html:346`「LAN OR REMOTE」)
- 同页 `index.html:289` — 「数据只在你的设备和局域网里」
- 同页 `index.html:367` — 隐私带「在你自己的局域网内传输」
- 同页 `index.html:452` — FAQ「手机只在局域网里和它说话」
- 同页 `index.html:460` — FAQ「手机与电脑之间在你的局域网内通信」

法律页更旧:

- `deploy/saydo-octoooo-com/privacy/index.html:64` — 「在你自己的局域网内传输」
- `deploy/saydo-octoooo-com/privacy/index.html:78` — 本地网络能力「仅限你的局域网」
- `deploy/saydo-octoooo-com/privacy/index.html:85` — 「手机与电脑之间的通信发生在你的局域网内」
- `deploy/saydo-octoooo-com/terms/index.html:62` — 「用手机扫码在局域网内连接」
- 英文同位 `en/privacy/index.html:64` / `:78` / `:85`

而 tailnet 面确实已是产品面,不是路线图:

- `deploy/saydo-octoooo-com/docs/index.html:830` — 完成度总表「tailnet 薄版 · 现在可用(需手工配)」
- `deploy/saydo-octoooo-com/docs/index.html:753` — §13.1 tailnet 面配置与能力
- 代码印证:`packages/daemon/src/net/identity.ts:12`(`IdentityVia = "local" | "tailnet" | "mobile_lan"`)、`:69`–`:71`(tailnet 主机白名单放行)

**我对修法的收窄**:草稿说「法律页补『局域网或你自己的加密组网』」,方向对但别顺手动到「不运营任何服务器」。tailnet 流量仍然只在用户自己的两台设备之间、经用户自己的 WireGuard 隧道,不经开发者的任何服务器。所以要改的只是**「局域网」这个物理范围词**,不是信任模型。

一句修法:把四处「局域网」统一改成「你自己的局域网,或你自行配置的加密组网(如 Tailscale)」,`privacy` / `terms` / 首页隐私带 / 首页 FAQ 同步。

### C3 · 隐私「不上传任何用户数据 / 不运营任何服务器」过宽 —— `[warn]` **A 级(前半句)**

方向对,但草稿把两句强弱完全不同的话捆成一条,按它整条收窄会误伤。逐句拆:

**必须改(A 级)** —— 绝对句与桌面级联语音直接冲突:

- `deploy/saydo-octoooo-com/index.html:160` — 信任条「数据不出你的设备」(首屏,四条里唯一绝对句)
- `deploy/saydo-octoooo-com/en/index.html:160` — 「YOUR DATA NEVER LEAVES YOUR DEVICES」(比中文更绝对)
- `deploy/saydo-octoooo-com/index.html:367` — 隐私带「你的对话、**语音**、事项与账本数据,全部保存在你自己的设备上」
- `deploy/saydo-octoooo-com/privacy/index.html:64` / `en/privacy/index.html:64` — 同款「语音……全部保存在你自己的设备上」
- `deploy/saydo-octoooo-com/privacy/index.html:67` — 「**不上传任何用户数据**」

自家文档已经承认了反例:

- `deploy/saydo-octoooo-com/docs/index.html:782` — 「**桌面端配了火山豆包 key 时,音频经 WebSocket 发到火山引擎云端识别与合成**」
- `deploy/saydo-octoooo-com/docs/index.html:783` — 出网三类:AI 上游、火山语音、可选 ntfy

**不该改** —— 「不运营任何服务器」(`privacy/index.html:64`、`index.html:366` 标题、`en/index.html:366`「No servers. Period.」)。这句主语是开发者,字面成立:火山是用户自己配的 key、用户自己的电脑直连;ntfy 是用户自己的 topic。把这句一起收窄等于白扔一个真实且稀缺的承诺,也会让「无账号、无云端、无埋点」这条差异化叙事塌掉。

一句修法:只动「不上传任何用户数据」和三处「数据不出设备 / 语音全在本机」,补一句「你自行启用的桌面云端语音会把音频发到你自己配置的第三方语音服务」;「不运营任何服务器」原样保留。

### C4 · 隐私写令牌存在 Keychain / Keystore,调度方一度想删 —— `[fail]`

**删除建议不成立,按它改会把一条真承诺改成弱承诺。** 三端原生壳全部实证兑现:

- iOS:`apps/ios/SayDo/ConnectionStore.swift:73` `KeychainTokenStore`;`:78` / `:94` / `:121` 均用 `kSecClassGenericPassword`,service `com.octoooo.saydo.desktop-token`;读写删三路都走 Keychain(`:21` / `:39` / `:52`)
- Android:`apps/android/app/src/main/java/com/octoooo/saydo/TokenStore.kt:46`–`:63` 从 `AndroidKeyStore`(`:67`)取/生成 AES-GCM 密钥(`:56`–`:58` GCM + `setRandomizedEncryptionRequired`),`:30`–`:40` 只把密文落 SharedPreferences。**密钥由 Keystore 托管,不是明文 SP**
- HarmonyOS:`apps/harmonyos/entry/src/main/ets/security/SecureStore.ets:2` 引 `huks`(`@kit.UniversalKeystoreKit`),`:13` `HuksWrappedPreferenceStore`,`:9` 别名 `saydo.desktopTokens.wrapKey`——即隐私页所称的「HarmonyOS 等价设施」

所以 `privacy/index.html:85` / `en/privacy/index.html:85` 那句(iOS Keychain / Android Keystore / HarmonyOS 等价设施)**三端全部有实现支撑**,连 HarmonyOS 的「等价设施」都不是空话。

一句修法:保持不动。真要动只该动一处——那句里同时写着「一次性扫码交换的令牌」,而 `deploy/saydo-octoooo-com/docs/index.html:324` 承认当前是「长期能力令牌」,这个才是隐私页真正的措辞债(见 §4 N3)。

### C5 · 首页架构 / 开始使用暗示手机可「审批」 —— `[ok]` **B 级**

草稿成立,但成立的理由比草稿写的更硬:不只是「把两种远程面混成一句」,而是**首页给访客的唯一上手路径是 LAN,而 LAN 面代码里连一个审批写口都没有**。

首页:

- `deploy/saydo-octoooo-com/index.html:342` — 架构节点「说话、看进展、**拍板、审批**。」(无任何限定)
- `deploy/saydo-octoooo-com/index.html:336` — 「手机只做沟通——说话、看进展、拍板、审批」
- `deploy/saydo-octoooo-com/index.html:383` — 开始使用只给 LAN 路径:「手机可在同一局域网里扫码连上,也可以先用手机浏览器」,只字未提 tailnet
- 英文同位:`en/index.html:342`「Talk, watch progress, decide, approve.」

代码侧 LAN 面能做什么:

- `packages/daemon/src/net/mobileLan.ts:11`–`:26` — HTTP 白名单只有 4 条 GET(attention / focuses / recent-transcript / memory/recent)+ 1 条 POST(`/api/setup/first-run/query`)。**没有任何审批或合并写口**
- `packages/daemon/src/index.ts:883`–`:888` — 白名单外一律 `mobile_lan_route_rejected`
- `packages/daemon/src/voice/hub.ts:141`–`:146` — LAN 面 WS 上行只放 `voice.mode` / `turn.text` / `confirm.decision` / `console.heartbeat`;`confirm.decision` 是立账记账确认卡,不是命令门
- `packages/daemon/src/index.ts:1554` — `runtimeApprovals.decide` 的 `via` 只取 `"tailnet"` 或 `"screen"`,LAN 面根本进不到这里

文档自己也这么写:`deploy/saydo-octoooo-com/docs/index.html:322` — 「执行中的命令审批(S2)与合并 / 删除(S3)只在本机受信屏幕出现,**局域网手机面不能裁决**」。

即:走首页教的 LAN 路径,手机能做的「审批」只有账本确认卡。S2 要么回电脑,要么自己配 tailnet(首页没教)。

一句修法:首页架构节点把「审批」拆开写成「说话、看进展、拍板;S2 审批需自行配好远程组网,S3 只在电脑上」,或直接删掉「审批」二字。

### C6 · 三端 App「内测中」vs 文档「均未提审上架」 —— `[ok]` **A 级**

草稿成立。「内测中」算完成度不诚实,判定依据是**根本不存在可分发的内测包**:

- `docs/release/2026-08-13-store-submission-status.md:19` — iOS `app-record-created`,「**勿传 spike IPA**」
- `:20` — Android `package-reserved`,「**勿传 spike AAB**」;同行注明「Dashboard 未见 12 人内测门横幅」(与调度方快照一致)
- `:21` — AppGallery `app-id-and-release-cer`,Profile `.p7b` 未建,「**勿传 spike HAP**」
- `:23` — 「version `spike 0.1`(**不可提审**)」
- `:31` — 「不可提审的硬原因(三端共同):无生产配对/信任层、明文 LAN、审核夹具尚未执行」

官网文档口径也是「未提审」:`deploy/saydo-octoooo-com/docs/index.html:158`(「工程壳存在,均未提审上架」)、`:763`–`:765`(三端逐行「未提审」)、`:835`(完成度总表「iOS / Android / HarmonyOS App 上架 · 规划中」)。

而首页 `index.html:416` / `:421` / `:426` 三端全挂「内测中」,`en/index.html` 同位「Closed beta」。三个商店里都是占位记录,没有 TestFlight、没有内部测试轨、没有任何人能装到。**「Closed beta」对英文读者的含义尤其明确(有 build、有 tester 名单),这一条对商店审核也不利——审核员会照着官网找那个 beta。**

一句修法:三端从「内测中」改为「规划中 · 想第一批试用留个邮箱」,与 `docs/index.html:835` 对齐。

### C7 · 文档「实时字幕、Silero VAD 进行中」该不该降为规划中 —— `[ok]` **B 级**

草稿成立,但草稿的理由只对了一半,而且差点连带降错东西。

- `deploy/saydo-octoooo-com/docs/index.html:825` — 完成度总表备注「实时字幕、Silero VAD 进行中」
- `deploy/saydo-octoooo-com/docs/index.html:733` — §12.1「当前识别形态 = 按住说话松手后整段识别(实时字幕进行中)」

证据:

- **实时字幕:零代码。** 本会话对 `pipeline/src/saydo_pipeline/` 全目录检索 `partial|interim|字幕`,**零命中**。没有 partial 结果通道,连埋点都没有。「进行中」不成立,应为「规划中」。
- **Silero:是 sweep 备忘,不是在途批次。** `pipeline/src/saydo_pipeline/vad.py:6`–`:8` 原文:「P0 免手档用**能量 RMS + hangover 状态机**……升级 Silero/webrtcvad **留 R-C sweep**,嘈杂环境先走 PTT/按钮兜底」。R-C sweep 项在本项目口径里等于「登记待办」,不是「进行中」。同样应为「规划中」。

**别降错的部分**:草稿说「能量 VAD +『说完了』已在」,这一点我确认——`vad.py:1`–`:9` 三层免手轮次(能量 VAD → 语义 EOU → 显式「说完了」按钮)是已落地的现在可用能力,`:20`–`:31` 常量齐备。降级只该动「实时字幕 / Silero」两个词,免手 VAD 本身留在「现在可用」。

一句修法:`docs/index.html:825` 与 `:733` 里的「进行中」改「规划中」,措辞改为「实时字幕与 Silero VAD 规划中;当前免手档走能量 VAD +『说完了』兜底」。

### C8 · LAN 手机面 / Focus / 回叫升级链标「现在可用」是否该加「相对源码」 —— `[warn]` 混层,**建议保持不动**

见 §2。草稿的担心属于本机层。对访客而言,`git clone` 的 HEAD 就是他的今天,文档标「现在可用」是对的。且文档**已有**足够的条件备注:

- `deploy/saydo-octoooo-com/docs/index.html:829` — 「局域网手机面(浏览器 / 壳) · 现在可用(**dogfood 边界**)· 无配对 / 无 E2E」
- `deploy/saydo-octoooo-com/docs/index.html:320` — 明写「启动 daemon 时加 `SAYDO_MOBILE_LAN=1`」
- `deploy/saydo-octoooo-com/docs/index.html:324` — 明写「局域网明文 HTTP + 长期能力令牌」「不要暴露到不受信网络」
- `deploy/saydo-octoooo-com/docs/index.html:132` — §0 已声明「文档口径以 macOS 桌面服务当前版本为准」

现有 dogfood 备注对访客已经够,再加「相对源码 HEAD / 需开环境变量」是把内部时钟写进用户文档。

一句修法:保持不动。

### C9 · 首页 Claude Code 卡「能力实测与审批门已落地,接线进行中」 —— `[warn]` **B 级(偏 A)**

草稿判「过满」成立,但落点应该在**「审批门已落地」**这五个字,不是整句。

- `deploy/saydo-octoooo-com/index.html:316` — 「以 Claude 订阅登录态在隔离 worktree 中改代码,**审批门同样 fail-closed。能力实测与审批门已落地**,接线进行中。」
- `deploy/saydo-octoooo-com/en/index.html:316` — 「…… Capabilities verified and **the gate built**; wiring underway.」

反证:

- `packages/daemon/src/tier1/validateConfig.ts:103`–`:109` — `tier1StartupVerdict` 里 `adapter !== "cursor"` 直接 `start: false` / `code: "unsupported_adapter"`,reason 原文「后端执行器未实现(仅 cursor);拒起而非起 cursor 二进制冒充(fail-closed;**claude_sdk/codex 随后续批接入**)」。也就是说今天配 `claude_code` 连执行器都起不来。
- `e2e/evidence/w54a-claude-cli.md:3` — 范围声明「**不改执行器主流程接线**、不改 `gateServer.ts`、不改 `validateConfig.ts`/`index.ts`……不部署常驻」
- `e2e/evidence/w54a-claude-cli.md:4` — 完成定义 = 「spike RESULT + 七件 fixture + **纯函数层**独立提交 + evidence」
- `e2e/evidence/w54a-claude-cli.md:41` — 阻塞红 `B-10prime` 判 `[fail]`(`acceptEdits` 下 hook 超时后圈内 `.env` 落盘;v3.1 改 `default` 后 X2 证实超时不落盘)

「审批门已落地」在中文里读作「门已经在那儿、能挡住东西了」。实际落地的是**判定用的纯函数**,门体本身还没接进任何可运行的执行链。而同一句话前半段说「审批门同样 fail-closed」——那是在给一个还起不来的执行器背书安全性。

**徽章「进行中」本身是对的**(spike 已收口、接线批在途),别一起降。

一句修法:把「能力实测与审批门已落地」改成「已在官方 CLI 上完成能力实测,审批门的判定逻辑已写好,尚未接进执行链」,前半句「审批门同样 fail-closed」改为将来时「接线后审批门同样 fail-closed」。

### C10 · 首页「来电式语音汇报 · Coming soon」 —— `[ok]` **保持不动**(但发现一处词表分叉)

草稿「不要改成现在可用」正确,我确认两者不是同一件事:

- `deploy/saydo-octoooo-com/index.html:323`–`:324` — 「来电式语音汇报 · Coming soon」,正文「PushKit 唤醒,CallKit 来电界面」
- HEAD 已有的是另一层:`deploy/saydo-octoooo-com/docs/index.html:716` — 升级链 L0 在线语音 → **L1 macOS 桌面通知 + ntfy 手机推送**,并明写「**L2 电话与移动端来电式汇报规划中**」
- `deploy/saydo-octoooo-com/docs/index.html:159` / `:836` — 「来电式语音汇报:规划中」

一句修法:能力口径保持不动。

**但顺带发现词表分叉(C 级)**:`docs/index.html:131` §0 明确定义了对外三档徽章「现在可用 / 进行中 / 规划中」,中文首页其余徽章全部遵守,唯独 `index.html:323` 这一处用英文「Coming soon」。同一件事在文档叫「规划中」、在首页叫「Coming soon」。建议中文首页统一为「规划中」。

---

## 4. 草稿没写的对外错位(我的补充)

### N1 · 首页信任条「数据不出你的设备」是最硬的一句假话,且在首屏 —— **A 级**

- `deploy/saydo-octoooo-com/index.html:160` — 「数据不出你的设备」
- `deploy/saydo-octoooo-com/en/index.html:160` — 「YOUR DATA NEVER LEAVES YOUR DEVICES」

草稿的 C3 只盯了隐私页和隐私带,漏了这条。它比隐私带更危险:位置在首屏信任条、是四条里唯一的绝对句、英文版用了 `NEVER`。而 `docs/index.html:783` 自己列了三类出网流量(AI 上游 / 火山语音 / ntfy)。**任何一个配了 API key 或云端语音的用户,打开抓包就能证伪这一句。**

修法:改成「无账号 · 无云端后台 · 只连你自己配的上游」。

### N2 · 首页 FAQ「没有云端服务器」与「你接入的第三方 AI」并列时的自我抵消 —— **B 级**

`deploy/saydo-octoooo-com/index.html:452` 同一段里先说「没有云端服务器」,再说「你接入的第三方 AI(CLI 订阅或 API key)由你的电脑直接调用」。逻辑上自洽(没有**我们的**服务器),但并置读起来像自我否定。加两个字「没有**我们的**云端服务器」即可,零风险。英文同位 `en/index.html:452`。

### N3 · 隐私页写「一次性扫码交换的令牌」,文档承认是「长期能力令牌」 —— **B 级,商店审核相关**

- `deploy/saydo-octoooo-com/privacy/index.html:85` / `en/privacy/index.html:85` — 「凭一次性扫码交换的令牌鉴权」
- `deploy/saydo-octoooo-com/index.html:460` — FAQ 同款「凭一次性扫码交换的令牌鉴权」
- 反证 `deploy/saydo-octoooo-com/docs/index.html:324` — 「局域网明文 HTTP + **长期能力令牌**」;`:755` 再次强调「**没有设备配对 / 逐设备身份 / 端到端加密**」

「一次性」修饰的是扫码动作,不是令牌寿命,但读者(和审核员)会读成一次性令牌。这条比 C4 想删的那句更值得改。修法:「凭扫码一次交换、之后长期有效的令牌鉴权;删除令牌会让全部已连设备掉线」。

### N4 · 首页用同一个 `badge-progress` 同时表示「进行中」和「内测中」 —— **B 级**

`index.html:315`(Claude Code「进行中」)与 `index.html:401` / `:406` / `:416` / `:421` / `:426`(五端「内测中」)共用同一个 `badge-progress` 视觉。`docs/index.html:131` 定义的对外三档里没有「内测中」这一档。C1 / C6 改完后这个分叉自然消失;若保留「内测中」措辞,则应另立徽章档并在文档 §0 登记。

### N5 · 法律页生效日期停在 2026-08-13,官网口径已在 08-20 迭代 —— **B 级**

`privacy/index.html:61` / `terms/index.html:61` / `en/privacy/index.html:61` 均写「生效日期:2026 年 8 月 13 日」。而首页与文档已按 `088b8f0`(2026-08-20)同步了远程连接、执行器、回叫升级链口径。C2 / C3 改完法律页后必须同步推进生效日期,否则会出现「政策文本变了但生效日期没动」——这在商店审核和合规上是硬伤。

### N6 · 使用条款把整个产品定义为「移动伴侣」,而移动 App 不存在 —— **B 级**

`deploy/saydo-octoooo-com/terms/index.html:62` — 「「说到」(英文名 SayDo)是开源桌面软件的**移动伴侣**」。结合 C6(三端均未提审、无可分发包),这份条款的规制对象目前不存在;而访客真正在用的桌面服务,其许可实际由 Apache-2.0 承载(`docs/index.html:867`)。条款页对今天的访客是错的。修法:开头补一句「本条款适用于移动应用;桌面服务按仓库 Apache-2.0 许可」。

### N7 · 首页把「手机扫码」写成开箱即用,未提需要显式开开关 —— **B 级**

`index.html:289`「手机扫码连你自己的电脑」、`index.html:383`「手机可在同一局域网里扫码连上」,均未提门槛。实际需要 `SAYDO_MOBILE_LAN=1`(`docs/index.html:320`),且二维码只对 RFC1918 私网地址出(`docs/index.html:752`)。首页不必写环境变量,但「扫码即连」的暗示应软化为「按文档打开局域网访问后可扫码连上」。

---

## 5. 最终建议(只覆盖对外文案)

### 5.1 优先对齐(本周,不需要 owner 拍板 —— 都是「把已知事实写对」)

| # | 动作 | 涉及 |
|---|---|---|
| 1 | Windows/Linux 从「内测中」降为「暂不支持、无时间表」,中英同步 | `index.html:96` `:383` `:401` `:406` `:431` + `en/index.html` 同位 |
| 2 | 三端 App 从「内测中 / Closed beta」降为「规划中」,中英同步 | `index.html:96` `:383` `:416` `:421` `:426` `:431` + `en/index.html` 同位 |
| 3 | 收窄三处绝对隐私句(信任条 / 隐私带 / 隐私页一句话版 + 「不上传任何用户数据」),**保留「不运营任何服务器」** | `index.html:160` `:367`、`privacy/index.html:64` `:67` + 英文同位 |
| 4 | 「局域网」→「局域网或你自行配置的加密组网」,四页统一 | `index.html:289` `:367` `:452` `:460`、`privacy:64` `:78` `:85`、`terms:62` + 英文同位 |
| 5 | 首页架构节点删「审批」或加限定 | `index.html:342` `:336` + `en/index.html:342` |
| 6 | Claude Code 卡「审批门已落地」改为「判定逻辑已写好,尚未接进执行链」 | `index.html:316` + `en/index.html:316` |
| 7 | 文档「实时字幕、Silero VAD 进行中」→「规划中」(不动免手 VAD) | `docs/index.html:825` `:733` + 英文同位 |
| 8 | 法律页生效日期随本轮改动推进 | `privacy:61`、`terms:61` + 英文同位 |

### 5.2 后续对齐(需 owner 拍板)

| # | 事项 | 为什么要 owner |
|---|---|---|
| 1 | 是否在首页正式把 tailnet 写成一条对外可用路径(而不只是架构连线上的「或远程连接」)。写了要配文档入口与安全提示;不写则 C2 只能停在「或你自行配置的加密组网」这种模糊措辞 | 是产品面范围决策 |
| 2 | 隐私页「一次性扫码交换的令牌」改口径(N3)。改成「长期有效令牌」在商店审核语境下是往下调,可能引出「为什么没有设备配对」的追问 | 商店口径取舍 |
| 3 | 使用条款的适用对象重写(N6)。移动 App 不存在期间,是否干脆把 terms 改成桌面 + 未来移动的合并条款 | 法律文本 |
| 4 | 「内测中」这一档要不要作为正式对外徽章档进入 `docs/index.html:131` 的三档定义(N4)。若将来真开内测,现在就该定义好 | 对外词表 |
| 5 | 线上站点是否已是仓内这一版(§1.3)。若线上仍是旧版,上述改动的部署顺序需要重排 | 部署决策,本报告不建议 deploy |

### 5.3 改承诺的具体句子(给替换句)

原句 → 建议替换句。中英各一,英文按现有页面语气。

**S1 · 首页信任条(`index.html:160` / `en/index.html:160`)**

- 原:`数据不出你的设备`
- 改:`无账号 · 无云端后台 · 只连你自己配的上游`
- EN 原:`YOUR DATA NEVER LEAVES YOUR DEVICES`
- EN 改:`NO ACCOUNTS · NO BACKEND OF OURS · ONLY THE UPSTREAMS YOU CONFIGURE`

**S2 · 首页隐私带正文(`index.html:367`)**

- 原:`你的对话、语音、事项与账本数据，全部保存在你自己的设备上，在你自己的局域网内传输。没有账号体系，不埋点，不接入第三方统计或广告 SDK。开发者无法访问、也不收集你的任何数据。`
- 改:`你的对话、事项与账本数据，全部保存在你自己的设备上，在你自己的局域网或你自行配置的加密组网内传输。没有账号体系，不埋点，不接入第三方统计或广告 SDK。开发者无法访问、也不收集你的任何数据。你自行启用的桌面云端语音、AI 上游与手机推送，是你自己配置、由你的电脑直连的第三方服务。`
- EN 同义改写,`travel only across your own LAN` → `travel only across your own LAN or a private network you set up yourself`,并补一句 third-party upstreams 说明。

**S3 · 隐私页「我们收集哪些信息」(`privacy/index.html:67` / `en/privacy/index.html:67`)**

- 原:`不收集。本应用没有开发者运营的服务端，不设账号体系，不埋点，不接入第三方统计/广告 SDK，不上传任何用户数据。`
- 改:`不收集。本应用没有开发者运营的服务端，不设账号体系，不埋点，不接入第三方统计/广告 SDK，不向开发者上传任何用户数据。你在桌面端自行配置的第三方服务（AI 上游、可选的云端语音识别与合成、可选的推送）由你的电脑直接调用，适用你与这些服务商之间的协议。`
- EN:`No user data is uploaded.` → `No user data is uploaded to the developer. Third-party services you configure yourself on the desktop side (AI upstreams, optional cloud speech recognition and synthesis, optional push) are called directly by your computer under your own agreements with those providers.`

**S4 · 首页 Windows/Linux/移动端徽章与申请条(`index.html:96` `:401` `:406` `:416` `:421` `:426` `:431`)**

- 原(hero,`:96`):`Windows / Linux / iOS / Android / HarmonyOS · 内测中 · 发邮件申请`
- 改:`Windows / Linux / iOS / Android / HarmonyOS · 规划中 · 想第一批试用留个邮箱`
- 原(徽章):`内测中` → 改:`规划中`
- 原(`:431`):`Windows、Linux 与移动 App 均在内测。` → 改:`Windows、Linux 与移动 App 都还没有可安装的版本。想第一批试用，留个邮箱。`
- EN:`Closed beta` → `Planned`;`Email to apply` → `Leave your email for the first wave`

**S5 · 首页架构沟通面节点(`index.html:342` / `en/index.html:342`)**

- 原:`说话、看进展、拍板、审批。随时在手，断了也不影响后端。`
- 改:`说话、看进展、拍板。出圈动作的审批需要远程组网，不可逆动作只在你的电脑上。随时在手，断了也不影响后端。`
- EN:`Talk, watch progress, decide, approve.` → `Talk, watch progress, decide. Approving out-of-scope actions needs a private network of your own; irreversible ones stay on your computer.`

**S6 · 首页 Claude Code 状态卡(`index.html:316` / `en/index.html:316`)**

- 原:`以 Claude 订阅登录态在隔离 worktree 中改代码，审批门同样 fail-closed。能力实测与审批门已落地，接线进行中。`
- 改:`以 Claude 订阅登录态在隔离 worktree 中改代码，接线后审批门同样 fail-closed。官方 CLI 的能力实测已完成，审批门的判定逻辑已写好，还没接进执行链。`
- EN:`Capabilities verified and the gate built; wiring underway.` → `Capabilities verified against the official CLI and the gate's decision logic written; not yet wired into the execution path.`

**S7 · 文档语音完成度备注(`docs/index.html:825`,`:733` 同步)**

- 原:`实时字幕、Silero VAD 进行中`
- 改:`实时字幕、Silero VAD 规划中；当前免手档走能量 VAD + 「说完了」兜底（现在可用）`

**S8 · 隐私页与条款的局域网口径(`privacy:64` `:78` `:85`、`terms:62`)**

- 原(`privacy:85`):`手机与电脑之间的通信发生在你的局域网内，凭一次性扫码交换的令牌鉴权；令牌保存在手机系统安全存储（iOS Keychain / Android Keystore / HarmonyOS 等价设施）中；`
- 改:`手机与电脑之间的通信发生在你的局域网内，或在你自行配置的加密组网（如 Tailscale）内；凭扫码一次交换、之后长期有效的令牌鉴权，删除令牌会让全部已连设备掉线；令牌保存在手机系统安全存储（iOS Keychain / Android Keystore / HarmonyOS HUKS）中；`
- 注:后半句(安全存储)是三端已兑现的真承诺,**必须保留**,只把 `等价设施` 具体化为 `HUKS`。

### 5.4 保持不动

| 项 | 理由 |
|---|---|
| `privacy/index.html:64` / `index.html:366` / `en/index.html:366` 「不运营任何服务器 / No servers. Period.」 | 字面成立(开发者确实不运营任何服务端),是真实且稀缺的承诺。C3 若整条收窄会误伤 |
| `privacy/index.html:85` 令牌存 Keychain / Keystore / HUKS 那半句 | 三端实证兑现(见 C4)。删掉是自降承诺 |
| `index.html:323` 来电式语音汇报「Coming soon」的**能力口径** | 与 HEAD 的 S2 桌面 + ntfy 回叫确实不是一件事(C10)。仅建议措辞统一为「规划中」 |
| `docs/index.html:829` 局域网手机面「现在可用(dogfood 边界)」 | 对访客口径正确,dogfood 备注已足(C8) |
| `docs/index.html:825` 里的免手 VAD / 云端级联语音「现在可用」主项 | `vad.py` 三层免手轮次已落地,只降「实时字幕 / Silero」两词 |
| macOS「现在可用」、Cursor 执行器「现在可用」 | 未发现反证;`tier1StartupVerdict` 对 cursor 是唯一放行路径,与文案一致 |

---

## 6. 总评

**草稿整体判定:需收窄。**

不是「会改错」——草稿在对外层的十条里,C1 / C2 / C5 / C6 / C7 / C10 六条方向正确,C1 / C2 / C6 三条我确认是 A 级、必须改。但它有三处必须收窄或推翻,否则执行下去会伤到真承诺或写进错误的层:

1. **C4 是净损失(`[fail]`)。** 「删掉隐私页 Keychain/Keystore 句」的想法在三端代码面前站不住。iOS 走 Keychain、Android 走 AndroidKeyStore 包裹的 AES-GCM、HarmonyOS 走 HUKS,全部有实现。删了等于把一条能过商店审核的真承诺换成空白。
2. **C3 捆得太粗(`[warn]`)。** 「不上传任何用户数据」必须改,「数据不出你的设备」更必须改;但「不运营任何服务器」不能一起收窄——它字面成立,且是这个产品叙事的地基。
3. **C8 是混层(`[warn]`)。** 拿本机常驻落后去要求对外文档加「相对源码」免责,把 owner 的时钟写给了访客。文档现有的 dogfood 备注对访客已经够。

草稿另外漏了七处对外错位,其中 **N1(首页首屏信任条「数据不出你的设备」/ `NEVER LEAVES`)是本轮我找到的最硬的一条**:位置最显眼、措辞最绝对、最容易被抓包证伪,而草稿完全没提。

### 若只做三件事

1. **改 N1 + C3 的三处绝对隐私句**(`index.html:160`、`en/index.html:160`、`index.html:367`、`privacy:64` `:67` 及英文同位)。这是唯一一组「随时可能被一次抓包或一个截图打脸」的话,且直接关系法律页可信度。保留「不运营任何服务器」。
2. **改 C1 + C6 的「内测中 / Closed beta」**(首页五端徽章 + hero 条 + apply-note,中英)。这是官网与自家文档的正面冲突,也是商店审核员会照着找的东西——找不到 beta 会变成对整站可信度的减分。
3. **改 C2 的「局域网」范围词**(`privacy` / `terms` / 首页隐私带与 FAQ,四页中英八处)。法律页写的物理范围与产品已有的 tailnet 面不符,是法律文本层面的失准,改动成本极低。

---

## 附 · 若只改三句对外文案,会改哪三句

| 序 | 位置 | 现文案 | 改成 |
|---|---|---|---|
| 1 | `deploy/saydo-octoooo-com/index.html:160`(英文 `en/index.html:160`) | `数据不出你的设备` / `YOUR DATA NEVER LEAVES YOUR DEVICES` | `无账号 · 无云端后台 · 只连你自己配的上游` / `NO ACCOUNTS · NO BACKEND OF OURS · ONLY THE UPSTREAMS YOU CONFIGURE` |
| 2 | `deploy/saydo-octoooo-com/index.html:431`(英文 `en/index.html:431`,配套把 `:96` `:401` `:406` `:416` `:421` `:426` 六处徽章由「内测中 / Closed beta」改「规划中 / Planned」) | `Windows、Linux 与移动 App 均在内测。` / `Windows, Linux, and the mobile apps are in closed beta.` | `Windows、Linux 与移动 App 都还没有可安装的版本。想第一批试用，留个邮箱。` / `Windows, Linux, and the mobile apps have no installable build yet. Leave your email for the first wave.` |
| 3 | `deploy/saydo-octoooo-com/privacy/index.html:64`(英文 `en/privacy/index.html:64`) | `「说到」不运营任何服务器。你的对话、语音、事项与账本数据，全部保存在你自己的设备（你的电脑与手机）上，在你自己的局域网内传输，开发者无法访问、也不收集你的任何数据。` | `「说到」不运营任何服务器。你的对话、事项与账本数据，全部保存在你自己的设备（你的电脑与手机）上，在你自己的局域网或你自行配置的加密组网内传输，开发者无法访问、也不收集你的任何数据。你在桌面端自行启用的云端语音、AI 上游与推送，由你的电脑直连你自己配置的第三方服务。` |

这三句分别封住:**首屏最硬的绝对句**、**完成度撒谎**、**法律页字面失准**。三句都不需要 owner 做产品范围决策,都是把已经成立的事实写对。
