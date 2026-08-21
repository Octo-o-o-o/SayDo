# 86 · 官网/文档/HANDOFF/本机三层状态对齐 · 对抗性交叉评审(Claude 独立复核)

> 评审日期:2026-08-21。评审性质:对调度方「状态未对齐」草稿的逐条证伪,非附和。
> 本报告只读取证,未做任何 commit / push / deploy / 文件修改(本文件除外)。
> supersede 关系:上一份 Claude 报告被中止的 Grok workspace sandbox 意外移除,本文为完整重做,不基于其残稿。

---

## 1. 评审身份与取证范围

独立评审会话,与实施会话零共享上下文。逐条主张均对照真实文件行号或本会话真实命令输出;凡未能独立复核的项显式标注。

**本会话真实执行的本机命令与结果摘录**:

| 命令 | 结果 |
|---|---|
| `git log -1 --format='%H %ci %s'` | `088b8f0cc176bc2be9cf09235a640301dd35cb55 2026-08-20 13:10:42 +0800` |
| `curl -s http://127.0.0.1:47100/health` | `runtimeSha:"ada7981c67ef3a07e6df0431643bb8b7661e22d4"` |
| `git rev-list --count ada7981c..HEAD` | `355` |
| `launchctl print gui/<uid>/com.saydo.daemon` | `SAYDO_HOME=/Users/…/.saydo`、`SAYDO_DEV=1`;`grep -c 'SAYDO_MOBILE_LAN'` = 0(确认无该变量);job state = running |
| live `~/.saydo/config.toml`(只取非密字段) | 行 15 `agent = "cursor"`;行 35 `voice = "zh_female_jitangmei_uranus_bigtts"`;行 75 `tailnet_hosts` 两槽已填;行 76 `listen = "0.0.0.0"` |
| `lsof -nP -iTCP:47100 -sTCP:LISTEN` | `node … TCP *:47100 (LISTEN)`——监听全接口,证明 `[t2].listen` 已被当前常驻加载 |
| `Tailscale status --json` | `BackendState: Running`、`Self.Online: True` |
| `systemextensionsctl list` | `io.tailscale.ipn.macsys.network-extension … [activated enabled]` |
| `claude --version` / `claude auth status` | `2.1.220`;`"loggedIn": true`、`"subscriptionType": "max"`(不录邮箱) |
| `gh run view 32334615753 --repo Octo-o-o-o/SayDo` | node job 6s 失败于 `pnpm/action-setup@v4`,错误原文 `Multiple versions of pnpm specified: version 10 in the GitHub Action config … version pnpm@10.33.1 in the package.json`;python job 11s 绿 |
| `ls ~/.saydo/runtime/packages/console/src/components/SetupBootstrapBoundary.tsx` | No such file;`~/.saydo/runtime/packages/daemon/src/focus` 亦不存在——常驻树确为 T19 / focus 之前的旧代码点 |

调度方 2026-08-21 本机快照全部条目经上表独立复核成立,包括其中「请尽环境所能复核」的 Tailscale 项(Running / Online / 扩展 enabled 三项均实测)。唯一限定:`/health` 响应中的 `ts` 为 `2026-08-20T17:31:44Z`,不影响 `runtimeSha` 判定。

**读取的文件**(全部为本会话 Read/grep 真实读取):
`deploy/saydo-octoooo-com/{index.html, en/index.html, docs/index.html(全文), privacy/index.html, terms/index.html, en/privacy/index.html(节选), en/terms/index.html(节选)}`;`docs/site/2026-08-20-docs-page-content.fable.md`(行 7 / 771);`HANDOFF.md`(全文);`docs/plan/IMPLEMENTATION-PLAN-2.md`(文首、W5、remote-mobile-w0、7.1、§8 执行顺序段);`packages/console/src/components/SetupBootstrapBoundary.tsx`(全文)与 `.test.ts`(行 95-96);`packages/daemon/src/index.ts`(setup 门上下文,行 975-1065);`packages/daemon/src/tier1/validateConfig.ts`(行 60-113);`pipeline/src/saydo_pipeline/vad.py`(头注释);`docs/release/2026-08-13-store-submission-status.md`(§0-§1);`e2e/evidence/w54a-claude-cli.md`(行 3 / 94 / 251 / 281);`apps/ios/SayDo/ConnectionStore.swift`;`apps/android/…/TokenStore.kt`(全文);`apps/harmonyos/…/security/SecureStore.ets`(头 40 行)。

**未跑的命令**:未起浏览器实测 tailnet / LAN 活体页面(涉及配对 URL 含令牌,且非本评审必需);未跑 `just ci` 或任何测试套件(本评审为状态对齐评审,非代码验收);未访问线上已部署站点(以仓内 deploy/ 目录为「对外」层锚,与任务的三层时钟定义一致)。涉及 HEAD 上 tailnet 行为的结论(见 H6 与 §4-1)为「daemon 分支 + console 单测断言」两端实证之间的静态推理,已如实标注。

---

## 2. 分层纪律裁决:哪几条草稿混层了

三层时钟(对外 / 源码 HEAD / 本机狗粮)接受为评审基线。草稿在「硬纪律」段自我声明了分界,总体守住;以下为逐处裁定:

1. **C4 的前史是混层,草稿的纠正正确**。「调度方一度想删」隐私页 Keychain/Keystore 句,依据是手机浏览器 dogfood 路径不走系统安全存储——这是拿「本机狗粮」层的临时路径去否「对外(商店 App)」层的真实实现。三端原生壳的安全存储均已实证(见 C4),该句必须保留。
2. **C8 若执行「加相对源码标注」即混层,应保持不动**。对外文档的口径基准已在 `docs/index.html:132` 写明(「以 macOS 桌面服务当前版本为准」),访客克隆 HEAD 即得这些能力;owner 本机常驻落后 355 个提交是 HANDOFF 层的事实,不进对外文案。
3. **H1「不要为此 just daemon deploy」正确,且有新证据加固**:`lsof` 显示当前常驻已监听 `*:47100`,即 `[t2].listen=0.0.0.0` 已生效于现运行实例——手机烟测不需要任何部署动作,连 restart 都不需要。
4. **C1/C6 是反向混层的实例**:首页把「未开工 / 无可分发物」写成「内测中」,等于把不存在的完成度提前记入对外层。对外层的错不能用「HANDOFF 里另有真话」抵扣。
5. P1 把「升常驻 + 开 SAYDO_MOBILE_LAN」列为 owner 拍板项,与 remote-mobile-w0 完成定义(`docs/plan/IMPLEMENTATION-PLAN-2.md:71`「不部署常驻、不宣称真机 WKWebView 狗粮」)一致,不混层。

---

## 3. 逐条裁决

### 对外承诺 C1-C10

**C1 · Win/Linux 口径自相矛盾 —— [ok] · A 级**

证据:首页 `deploy/saydo-octoooo-com/index.html:96`「Windows / Linux / iOS / Android / HarmonyOS · 内测中 · 发邮件申请」;`:383`「Windows 与 Linux 正在内测」;`:401/:406` 徽章「内测中」;`:431`「Windows、Linux 与移动 App 均在内测」。英文页 `en/index.html:96/:383/:401/:406/:431` 同构(Closed beta)。而文档 FAQ `docs/index.html:856`:「暂不支持,当前面向 macOS……没有明确时间表,不承诺」,与源稿 `docs/site/2026-08-20-docs-page-content.fable.md:771` 一字不差;该源稿行 7 的硬约束即「不承诺未落地能力」。真相在文档侧:`docs/index.html:262`(§4.1)写明「其他系统未支持」,daemon 源码中 `process.platform === "win32"` 分支全部是防御性短路(`runtimeChildRegistry.ts:47/130/146` 等返回空值/unknown),不存在 Windows/Linux 发行物或适配层。首页「内测中 + 发邮件申请」邀请访客申请一个不存在的东西。修法:首页两语言全部 Win/Linux 表述与 FAQ 收敛到同一口径(替换句见 §5)。

**C2 · 法律页「只在局域网」已被 tailnet 产品面推翻 —— [ok] · A 级**

证据:架构图已写「局域网或远程连接」(`index.html:346`;en `LAN OR REMOTE`);tailnet 薄版在文档中是「现在可用(需手工配)」(`docs/index.html:830`,§13.1 行 753 有完整描述)。但:隐私政策 `privacy/index.html:64`「在你自己的局域网内传输」、`:78`「仅限你的局域网」;en/privacy `:64`「travel only within your own local network」、`:78`「Your LAN only」;条款 `terms/index.html:62`「用手机扫码在局域网内连接」、en/terms `:62` 同;首页隐私带 `index.html:367`「在你自己的局域网内传输」;首页 FAQ `:452`「手机只在局域网里和它说话」、`:460`「手机与电脑之间在你的局域网内通信」。Tailscale 是 WireGuard 加密覆盖网,不是「你自己的局域网」;用户按文档 §13.1 配好 tailnet 后,法律页的字面描述即失真。主张成立,且属于「对外自相矛盾」面。修法:上述八处(zh/en 各四处)补「或你自己配置的加密组网」,替换句见 §5;法律页改字面须同步更新生效日期(现为 2026-08-13,`privacy/index.html:61`)。

**C3 · 「不上传任何用户数据 / 不运营任何服务器」应收窄 —— [warn] · B 级(打击面过宽)**

成立的一半:`privacy/index.html:67`「不上传任何用户数据」(en `:67`「No user data is uploaded」)作为绝对句过宽——桌面级联语音把录音经 WebSocket 发到火山引擎云端(文档自己在 `docs/index.html:782` 如实写了),可选 ntfy 把脱敏标题发到公网 topic(`docs/index.html:783` 列为出网第三类)。法律页应向 §14 的诚实口径收窄。
不成立的一半:「不运营任何服务器」(`privacy/index.html:64`、首页 `:366`)是关于开发者的真陈述——火山、ntfy、AI 上游都不是开发者运营的,这句不需要改,草稿把它并列进收窄清单是打击面过宽。另注意受众层:`privacy/index.html:76`「(麦克风)音频仅在本机处理,不上传」所在表格明确是「应用会使用哪些设备能力」——主语是移动 App,App 用系统语音识别,该行对 App 为真,不要因桌面级联把它改错;至多补「(手机端)」限定。修法见 §5。

**C4 · 隐私页 Keychain/Keystore 句必须保留 —— [ok](主张成立,句子不删)**

三端实证:iOS `apps/ios/SayDo/ConnectionStore.swift:21/39/73-128` 为真实 `KeychainTokenStore`(`kSecClassGenericPassword` 读写删全套);Android `apps/android/…/TokenStore.kt:14-71` 用 `AndroidKeyStore` 生成 AES 密钥、GCM 加密后存 `MODE_PRIVATE` SharedPreferences(标准 Keystore-backed 形态,`KEYSTORE_PROVIDER = "AndroidKeyStore"` 在行 67);HarmonyOS `apps/harmonyos/…/security/SecureStore.ets:1-13` 为 HUKS(`@kit.UniversalKeystoreKit`)包裹密钥 + GCM 信封,对应隐私页「HarmonyOS 等价设施」。`privacy/index.html:85` 的表述对原生壳完全成立。手机浏览器 dogfood 的令牌在浏览器存储,不属于商店 App 隐私披露对象——不得以该路径否掉此句。裁决:保持不动。

**C5 · 首页把手机「审批」混层夸大 —— [ok] · A 级**

证据:首页 `index.html:336`「手机只做沟通——说话、看进展、拍板、审批」、`:342` 手机节点同句(en 同构)。而文档:LAN 面(唯一不需额外组网的路径)「执行中的命令审批(S2)与合并 / 删除(S3)只在本机受信屏幕出现,局域网手机面不能裁决」(`docs/index.html:322`,§4.7),LAN 面「写口、设置写口、S3、全文屏幕文本一律拒」(`:752`);能批 S2 的是 tailnet 面(`:753`),而 tailnet 需手工配 Tailscale。首页架构区不区分两种远程面,把 tailnet 才有的「审批」并进默认叙事,且同屏 `:383`「手机可在同一局域网里扫码连上」引导的正是不能审批的那条路径。「拍板」在 LAN 面同样无写口。属首页与文档直接矛盾。修法:首页手机侧动词降到 LAN 面真实能力(确认卡点头),审批表述加限定,替换句见 §5。

**C6 · 三端 App「内测中」不诚实 —— [ok] · A 级**

证据:首页 `:416/:421/:426` iOS/Android/HarmonyOS 徽章「内测中」+ `:96/:431`(en Closed beta)。实况:文档 §13.2(`docs/index.html:763-768`)三端「未提审」「无可提审包」,三端共同不可提审原因明列;`docs/release/2026-08-13-store-submission-status.md` §0 三轨状态是 app-record-created / package-reserved / app-id-and-release-cer,全部「勿传 spike 包」,version 为 `spike 0.1(不可提审)`,Play 侧「Dashboard 未见 12 人内测门横幅」——即不存在 TestFlight / Play 内测轨道 / AGC 任何可分发渠道。「内测中」向访客暗示可申请加入的分发中测试;实际邮件申请后无任何东西可发。这是完成度不诚实,与 C1 同修:移动三端徽章降为「开发中(未上架)」,并把「可先用手机浏览器连接」这条真实路径写上(文档 `:158` 已是此口径)。

**C7 · 「实时字幕、Silero VAD 进行中」应降「规划中」 —— [ok] · B 级**

证据:`docs/index.html:825`(§16 级联语音行备注)「实时字幕、Silero VAD 进行中」;`:733`(§12.1)「(实时字幕进行中)」。实况:Silero——`pipeline/src/saydo_pipeline/vad.py` 头注释原文「升级 Silero/webrtcvad 留 R-C sweep」,R-C 是未来合同清扫轮,无任何在途批次;实时字幕——`docs/plan/IMPLEMENTATION-PLAN-2.md:86` 把 `asr.partial 实时分片流式 + 实时字幕` 排在 W7 7.1(「允许前移」,但当前批次指针为空、下一批是 W5 剩余),代码侧仅有浏览器系统语音自带的 `interimResults`(`systemVoice.ts:132`,属另一档,非云端级联字幕)。两者均为「已排产未动工」,按文档 §0 自己的三档词表应标「规划中」。草稿主张的能量 VAD 与「说完了」按钮「已在」亦实证(vad.py 头注释三层描述)——级联语音行本体「现在可用」徽章无误,只降备注两词。

**C8 · LAN 手机面 / Focus / 回叫链「现在可用」 —— [ok](裁决:保持现状,不加标注)**

「现在可用」的基准是对外文档口径(`docs/index.html:132`:以 macOS 桌面服务当前版本为准),对克隆 HEAD 的访客为真;`SAYDO_MOBILE_LAN=1` 的启用前提已在 §4.7(`:320`)、§13.1(`:752`)、附录(`:916`)三处写明;dogfood 边界诚实段已在(`:324`、`:755`)。remote-mobile-w0 完成定义(`IMPLEMENTATION-PLAN-2.md:71`)禁止的是「宣称真机狗粮」,不禁止对 HEAD 说「现在可用」。owner 本机常驻是否落后属 HANDOFF 层(见 H2),写进对外文案反而混层。裁决:对外保持不动,现有备注已够。

**C9 · Claude Code 卡「能力实测与审批门已落地,接线进行中」 —— [warn] · B 级**

证据:`index.html:316`。实况三点:① `e2e/evidence/w54a-claude-cli.md:3` 范围声明「不改执行器主流程接线、不改 gateServer.ts……不部署常驻」,`:94`「本批 claude backend 未接生产认领」,`:251`「未改 executor 认领主流程」;② `packages/daemon/src/tier1/validateConfig.ts:103-108` `tier1StartupVerdict` 对 `adapter !== "cursor"` 直接 `unsupported_adapter` 拒起(「claude_sdk/codex 随后续批接入」);③ 接线批(W5.4-b)尚未开批(HANDOFF §1 当前批次指针为空)。裁决:「能力实测已落地」真;「审批门已落地」过满半格——落地的是审批门**判定纯函数**,未接入任何产品执行链,访客会读成「该门已生效」;「接线进行中」应为「接线批在途/待开批」。徽章「进行中」可保;正文一句应对齐文档 §6.3/§16 的精确口径(`docs/index.html:513/:831`「第一批(对官方 CLI 的真机能力实测 + 审批门纯函数)已收口,接线批在途」)。替换句见 §5。

**C10 · 来电式语音汇报 Coming soon —— [ok](维持,不改「现在可用」)**

证据:`index.html:323-324`(PushKit/CallKit);文档侧 `docs/index.html:768` 把来电式列入上架前规划项、`:836`(§16)「规划中」。HEAD 已可用的回叫升级链(在线语音 → 桌面通知 + ntfy,`index.html:226`、`docs/index.html:824`)是另一条已交付链路,与系统来电形态不是同一件事。草稿主张(不要改成现在可用)成立。附注 C 级一笔:首页徽章「Coming soon」对应文档「规划中」,词感上比「规划中」更近期;不强制改,若求严格可统一为「规划中」。

### 内部档案 / 本机 H1-H6

**H1 · HANDOFF §2-12 Tailscale「waiting for user」过期 —— [ok] · B 级**

证据:`HANDOFF.md:51`「系统网络扩展待批准(activated waiting for user)」。本会话实测:`systemextensionsctl list` 显示 `[activated enabled]`;BackendState=Running、Online=True;live config `[t2]` 两槽已填、`listen=0.0.0.0`;且 `lsof` 证明现常驻已监听 `*:47100`——即 §2-12 里「填 config → deploy 生效」这半段也已经完成,剩余仅手机烟测(`just t2-pair` → 四页走查 → 批一条 S2 → 点 S3 合并见拒绝话术)。修法:§2-12 改写为现状 + 剩余动作;确认无需 `just daemon deploy`,也无需 restart(监听已生效)。

**H2 · 场次①锁定 runtime SHA 已与现实脱节 —— [ok] · B 级**

证据:`HANDOFF.md:40`(§2-1)「四场必须继续锁定 runtime `b20151440011ce0452417439c2d81745cb5d7d39`……任一变化从①重跑」;`:33/:34` 两条现场记录同锚 b201514。实测 `/health` runtimeSha = `ada7981c…`(落后 HEAD 355 个提交)。即按 §2-1 自己的规则,锁定条件已被打破,而档案未记。修法:§2-1 与 §1 补记三层 SHA 现值(对外站点稿基于 HEAD `088b8f0`;常驻 runtime `ada7981c`;旧锁定点 `b201514` 已失效,四场若开须由 owner 重新指定锁定点)。「未授权不要把 HEAD 灌进 launchd」成立,另有 H6 的行为回退风险加持。

**H3 · 「下周购入 Claude」与「下一批 = 5.4 挂订阅」双双过期 —— [ok] · B 级**

证据:`HANDOFF.md:45`(§2-6)「owner 已定档:下周购入」;`:21`(§1)「下一工程批 = PLAN-2 W5 剩余(5.4 挂 Claude 订阅)」;`docs/plan/IMPLEMENTATION-PLAN-2.md` W5 行「W5 剩余 = 5.4(挂 Claude 订阅)」、5.4 行标题仍是「Claude SDK Tier1 主档接入(订阅解锁后)」、§8 执行顺序段(行 182)同句。实测:claude CLI 2.1.220 已登录、subscriptionType=max;W5.4-a 已收口且明确走 CLI 非 SDK(HANDOFF `:81`;evidence 范围行)。修法:§2-6 改「已购入并登录(Max);W5.4-a 已消费该解锁;剩余 = W5.4-b 接线」;§1 指针与 PLAN-2 两处活性句改「下一工程批 = W5.4-b(Claude CLI 执行器接线)」;PLAN-2 5.4 行的「SDK」措辞一并按 CLI 现实修(PLAN-2 §0 快照行自带「开批时现状以 HANDOFF 为准」豁免,可不动)。

**H4 · Actions「2026-08 再开」已过期,败因是 pnpm 版本键冲突 —— [ok] · B 级**

证据:`HANDOFF.md:44`(§2-5)「2026-08 再开……修 billing 自动恢复」。实测 `gh run view 32334615753`:workflow 已实际运行(billing 已通),node job 6s 失败,错误原文即「pnpm/action-setup 的 version: 10 与 package.json `packageManager: pnpm@10.33.1` 冲突」;python job 绿。调度方归因独立复核成立。这是公开仓工程债,不是对外承诺,不上首页。修法:§2-5 改为现状 + 一行修法(删 Action 的 `version` 键或与 packageManager 对齐),并保留「本地 `just ci` 仍是唯一门禁」句。

**H5 · live TTS jitangmei —— [warn](已写清,草稿把完成项当待办)**

证据:`HANDOFF.md:49`(§2-10)已写「源码缺省已落地,live 显式覆盖尚未切换……当前实例不得写成已切」;`:34`(§1,2026-07-31 复核)同口径;实测 live config 行 35 确为 jitangmei。即档案早已按草稿要求的样子写清,本条无事可做,不应再进 P0 的 HANDOFF 清账清单。裁决:保持不动。

**H6 · T19 `setup_local_only` × tailnet:升常驻会让远程面回退 —— [ok] · B 级(升级警示)**

证据链:① daemon `packages/daemon/src/index.ts:993-1005`(probe)与 `:1047-1060`(cli-capability):注释「first-run onboarding:setup 四端点仅本机(tailnet 一律 403)」,`idvVia === "tailnet"` 恒 403 `setup_local_only`(第三处在 `:1173`);② console `SetupBootstrapBoundary.tsx:12` 仅 `mobile_lan_route_rejected` 一个码判 remote-mobile 直挂移动树(`:26-29`),`SetupBootstrapBoundary.test.ts:95-96` 直接断言「token_mismatch/origin_rejected/host_rejected/**setup_local_only** 仍停错误卡」;③ 实测 runtime 树无 `SetupBootstrapBoundary.tsx`——现常驻没有这道首启门,tailnet 浏览器今天可直进旧 console。静态推理(两端实证、未跑活体):升常驻到 HEAD 后,tailnet 来源首启 probe 恒 403 → console 停「没连上本机服务/读不到配置」错误卡 → 已配 `[t2]` 的远程手机面从「可用」回退为「开门即卡」。草稿主张成立,且不止「setup 变差」——是 tailnet 面整体被首启门挡住(见 §4-1)。处置:升常驻前必须 owner 拍板 T19 × tailnet 合同(例如把 `setup_local_only` 纳入 remote-mobile 判定,或对 tailnet 放行 probe 只读子集);禁止任何实施会话以「顺手修」名义静默扩合同。

---

## 4. 草稿漏掉的错位(评审自查新增)

1. **docs §16「tailnet 薄版 现在可用(需手工配)」(`docs/index.html:830`)在 HEAD 上与 T19 行为冲突**——这是 H6 的对外投影,草稿只把 T19 当本机/合同问题。文档口径基准是 HEAD(`:132`),而按 §3-H6 的证据链,HEAD 上手工配好 tailnet 的手机浏览器首启会停在 probe-error 卡,§13.1 描述的「看任务、批 S2」根本进不去。即「现在可用」徽章对 HEAD 存疑。因未跑活体 e2e,建议处置二选一:优先在 T19 × tailnet 合同裁决时一并修代码(还原可用);若短期不裁决,则 §13.1/§16 的 tailnet 行加「与首跑向导的兼容修复在途」一类备注。此条与 H6 同源,合并裁决即可,但对外层的暴露面草稿没有点名。
2. **HANDOFF §2-13(`:52`)「runtime 部署门已通过(§4-⑤):runtime clean @ b201514…」**——与 §2-1 同锚过期,H2 修订时应一并清,草稿只点了 §2-1。
3. **法律页改字面牵动生效日期**:`privacy/index.html:61` 生效日期 2026-08-13;按 C2/C3 修订后未更新日期会造成「政策变更」节自相矛盾(`:96` 承诺变更会标注日期)。en 对应页同。
4. **首页 FAQ「需要什么前提?」(`index.html:456`)「手机扫码即连」**——省略了 `SAYDO_MOBILE_LAN=1` 前提,与 §4.7 的三道门描述相比过顺滑。C 级文风,可随 C5 顺手补「(需在电脑上开启局域网连接开关)」,不单列。
5. **PLAN-2 §8 执行顺序段(行 182)结尾的活性指针**「下一工程批仍是 W5 剩余(5.4 挂 Claude 订阅)」——H3 修 HANDOFF 时若漏掉此处,两份档案会再次分叉。

---

## 5. 最终建议

### 优先对齐(本周,纯文案 + 档案,零工程)

1. **首页平台完成度统一(C1+C6,zh/en 同步)**:Win/Linux 全部「内测中」表述收敛到 FAQ 口径;移动三端「内测中」降「开发中(未上架)」;保留邮件链接但语义改为关注进展。
2. **传输范围句(C2+C3 收窄版,zh/en 各四页 + 首页两处)**:法律页、条款、首页隐私带与 FAQ 补「或你自己配置的加密组网」;「不上传任何用户数据」收窄为「不向开发者上传」;「不运营任何服务器」保持;改后更新两语言隐私页生效日期。
3. **首页手机能力句(C5)**:删去无限定的「审批」,对齐 §4.7/§13.1。
4. **docs 徽章两词(C7)**:`:825` 与 `:733` 的「实时字幕/Silero VAD 进行中」改「规划中」。
5. **首页 Claude 卡一句(C9)**:对齐文档「第一批已收口,接线批在途」的精确口径。
6. **HANDOFF 五处(H1-H4 + §2-13)**:§2-12 Tailscale 现状化;§2-1/§1/§2-13 三层 SHA 记实(088b8f0 / ada7981c / b201514 失效);§2-6 Claude 已购入、下一批 = W5.4-b(同步 PLAN-2 行 182 与 W5/5.4 活性句);§2-5 Actions 败因改记 pnpm 版本键冲突。TTS(H5)不动。

### 后续对齐(需 owner 拍板)

- 手机 Tailscale 烟测:现常驻即可做(监听与 [t2] 已生效,无需 deploy/restart);报告只记步骤名,不落配对 URL。
- T19 × tailnet 合同裁决(H6 + §4-1):升常驻的前置门,决定 `setup_local_only` 是否纳入 remote-mobile 或 tailnet 放行只读 probe;裁决前 docs tailnet 行是否加备注一并定。
- 是否为狗粮升常驻 + 开 `SAYDO_MOBILE_LAN`(8 月完成定义明确不部署,需显式推翻)。
- Claude 执行器接线(W5.4-b)。
- 真人场次(须先重定 runtime 锁定点,见 H2)/ S3 Touch ID / OctoBlog。

### 改承诺的具体句子(替换句)

| 位置 | 现句 | 替换句 |
|---|---|---|
| `index.html:96` | Windows / Linux / iOS / Android / HarmonyOS · 内测中 · 发邮件申请 | iOS / Android / HarmonyOS App 开发中(未上架,手机浏览器已可先用)· Windows / Linux 暂不支持 · 发邮件关注进展 |
| `index.html:383`(节选) | Windows 与 Linux 正在内测。移动 App 是沟通面,同样内测。 | Windows 与 Linux 暂不支持、没有时间表。移动 App 是沟通面:原生壳开发中、均未上架,手机浏览器已可先用。 |
| `index.html:401/:406` 徽章 | 内测中 | 规划中(apply-note 同步:「Windows / Linux 暂不支持,没有明确时间表,不承诺。」) |
| `index.html:416/:421/:426` 徽章 | 内测中 | 开发中 · 未上架 |
| `index.html:431` | Windows、Linux 与移动 App 均在内测。 | 移动 App 均未上架;Windows / Linux 暂不支持。想第一时间知道进展,发邮件给我们。 |
| `index.html:336`(§架构 lead) | 手机只做沟通——说话、看进展、拍板、审批;重活留在你的电脑上。 | 手机只做沟通——说话、看进展、对确认卡点头;命令审批与合并永远留在你的电脑屏幕上。 |
| `index.html:342`(手机节点) | 说话、看进展、拍板、审批。随时在手,断了也不影响后端。 | 说话、看进展、点头确认。随时在手,断了也不影响后端。 |
| `privacy/index.html:64`(en:64 同式) | ……在你自己的局域网内传输…… | ……在你自己的局域网内(或你自己配置的加密组网,如 Tailscale)传输…… |
| `privacy/index.html:67`(en:67 同式) | 不收集。本应用没有开发者运营的服务端,不设账号体系,不埋点,不接入第三方统计/广告 SDK,不上传任何用户数据。 | 不收集。本应用没有开发者运营的服务端,不设账号体系,不埋点,不接入第三方统计/广告 SDK,不向开发者上传任何用户数据。你自行启用的第三方服务(AI 模型、云端语音识别与合成、消息推送)由你的设备直接调用,适用你与相应服务商的协议,开发者不经手、不可见。 |
| `privacy/index.html:78` | 仅限你的局域网,凭配对令牌通信 | 仅限你的局域网或你自己配置的加密组网,凭配对令牌通信 |
| `terms/index.html:62`(en:62 同式) | ……用手机扫码在局域网内连接。 | ……用手机扫码在局域网内(或经你自己配置的加密组网)连接。 |
| `index.html:367`(隐私带)与 `:452/:460`(FAQ) | 「只在局域网」各句 | 按上式补「或你自己配置的加密组网」;`:452` 改「手机在你的局域网(或你自己配置的加密组网)里和它说话」 |
| `index.html:316`(Claude 卡) | 能力实测与审批门已落地,接线进行中。 | 对官方 CLI 的真机能力实测与审批门判定逻辑已收口,接入执行链的接线批在途。 |
| `docs/index.html:825` | 实时字幕、Silero VAD 进行中 | 实时字幕、Silero VAD 规划中 |
| `docs/index.html:733` | (实时字幕进行中) | (实时字幕规划中) |

en/index.html 对应行(96/383/401/406/416/421/426/431/336/342/367/452/460/316)按同义英文同步;en/docs 若含同句一并巡检(本评审未逐行核对 en/docs,标注为执行时自查项)。

### 保持不动

- macOS「现在可用」、Cursor 执行器「现在可用」(`docs/index.html:820` 有据)。
- Claude 执行器徽章「进行中」;来电式「Coming soon」(C10;如求词表统一可改「规划中」,非必须)。
- 直达验收「进行中」(`docs/index.html:823`「合同与匹配逻辑已落,语音拍板环未接」属实)。
- 隐私页 Keychain / Keystore / HarmonyOS 等价设施句(C4,三端实证)。
- C8:LAN 手机面 / Focus / 回叫链的「现在可用」及现有 dogfood 备注,不加「相对源码」标注。
- H5:TTS 音色两档记述(档案已写清)。
- 「不运营任何服务器」全部出现处。

### 不要做(确认草稿红线)

deploy HEAD(T19 合同未裁决前双重禁止);Cloudflare 隧道不写进任何对外稿;cap-token / `.env` 原文不进任何文件;评估侧不改官网与 HANDOFF(本报告未改)。

---

## 6. 总评

**裁决:需收窄。** 草稿方向正确、分层意识好,16 条主张里 11 条 [ok]、2 条 [warn]、0 条 [fail]、3 条为「维持现状」类正确裁决;但存在三处过冲:C3 把真句「不运营任何服务器」列入收窄面,H5 把已写清的档案当待办,C8 若照「加标注」执行会混层。另有两处草稿未见的暴露面(tailnet「现在可用」对 HEAD 存疑、§2-13 同锚过期)已补录 §4。

A 级共 4 条:C1(Win/Linux 对外自相矛盾)、C2(法律页与产品面矛盾)、C5(首页手机审批与文档矛盾)、C6(移动「内测中」完成度不实)。B 级:C3/C7/C9/H1/H2/H3/H4/H6。C 级:Coming soon 词感、FAQ 顺滑句。

**若只做三件事**:
1. 首页(zh/en)平台完成度统一——Win/Linux 与移动全部「内测中」按 §5 替换句降档(C1+C6,消除最直接的对外撒谎面);
2. 隐私政策与条款(zh/en)传输范围句 + 「不上传」收窄 + 生效日期更新(C2+C3,消除法律页失真);
3. HANDOFF §1/§2-1/§2-5/§2-6/§2-12/§2-13 一次清账并写明三层 SHA(H1-H4,让下一个会话不再基于过期档案决策)。
