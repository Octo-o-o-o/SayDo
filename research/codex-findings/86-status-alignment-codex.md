# 86 · 官网、文档、HANDOFF、本机三层状态对齐 · 对抗性交叉评审

## 1. 评审身份与取证范围

我是独立只读评审员，目标是证伪调度方草稿，而不是替草稿排期背书。本报告只写证据能支持的结论；“运行中”“可用”“内测中”等词按访客能作出的通常理解审查。

取证对象分为四组：

- 对外候选静态源：deploy/saydo-octoooo-com/index.html、en/index.html、docs/index.html、privacy/index.html、terms/index.html 及对应英文页；同时读 docs/site/2026-08-20-docs-page-content.fable.md。
- 内部档案与计划：HANDOFF.md §1/§2，docs/plan/IMPLEMENTATION-PLAN-2.md，W5.4-a 证据 e2e/evidence/w54a-claude-cli.md，remote-mobile-w0 证据与计划。
- 源码合同：packages/daemon/src/index.ts、packages/daemon/src/tier1/validateConfig.ts、packages/console/src/components/SetupBootstrapBoundary.tsx 及测试、pipeline 的 VAD/ASR/TTS 文件、iOS/Android token 与语音实现。
- 商店与隐私上游：docs/release/2026-08-13-store-submission-status.md、docs/release/README.md、docs/release/2026-08-13-app-materials.md、docs/release/data-disclosure-matrix.md、docs/store/01-隐私政策.md。

本会话实际执行的只读命令及结果摘录：

- git rev-parse HEAD 输出 088b8f0cc176bc2be9cf09235a640301dd35cb55；git rev-list --count ada7981c67ef3a07e6df0431643bb8b7661e22d4..HEAD 输出 355。
- git status --short 显示官网多项已修改条目，deploy/saydo-octoooo-com/docs/ 与 en/ 为未跟踪目录。git cat-file -e HEAD:deploy/saydo-octoooo-com/docs/index.html 与 en/index.html 均报告“exists on disk, but not in HEAD”。
- readlink ~/.saydo/runtime 指向 ada7981c67ef3a07e6df0431643bb8b7661e22d4；git -C ~/.saydo/runtime rev-parse HEAD 同值，runtime commit date 为 2026-07-31。launchctl 显示 com.saydo.daemon state = running、工作目录在 ~/.saydo/runtime；lsof 显示监听 *:47100。
- 对 ~/.saydo/config.toml 只做字段筛选：models.dev.agent = cursor；voice = zh_female_jitangmei_uranus_bigtts；[t2] 有两个 tailnet_hosts 槽位且 listen = 0.0.0.0。报告不抄录主机值或任何凭证。
- curl http://127.0.0.1:47100/health 返回 rc=7，未读到 JSON，因此本报告不把 runtimeSha 写成“本会话通过 /health 复核”。
- tailscale status --json 输出 “The Tailscale CLI failed to start: Failed to load preferences.”；systemextensionsctl list rc=69。BackendState、Online、扩展 activated 均未独立复核。
- claude --version 输出 2.1.220；claude auth status 输出 loggedIn=false、authMethod=none、rc=1。调度方或其他环境的 loggedIn=true/subscriptionType=max 与此冲突，不能在本报告合并成一个事实。
- gh run view 32334615753 因代理连接被拒，未拿到 run metadata/log；pnpm 版本键只用仓内 package.json 与 .github/workflows/ci.yml 交叉核对。
- 报告落盘后运行 bash scripts/check-emoji.sh research/codex-findings/86-status-alignment-codex.md，输出 [ok] emoji gate: clean；同时用 wc -l 复核报告确实落盘。

没有执行的动作：没有 commit、push、deploy、just daemon deploy、just t2-pair、手机烟测、线上浏览器核验、完整测试门禁或任何 nested codex/claude。没有读取或写入任何能力令牌原文、环境变量秘密值或其他凭证。

关键限制：以下 C 条目引用的是当前工作树静态候选稿，不等于已经部署给访客；HEAD 仍是 088b8f0，线上发布快照本会话未验证。对外结论必须先过“候选稿与实际发布树一致”门。

## 2. 分层纪律裁决

| 层 | 本会话锚点 | 可以诚实回答谁 | 本报告不允许的推导 |
|---|---|---|---|
| 对外 | deploy/ 候选中文、英文首页、文档、隐私、条款 | 访客与商店审核 | 不能把未跟踪候选页当成已上线；不能把 owner 的本机状态写成访客能力 |
| 源码 HEAD | 088b8f0，较 ada7981 多 355 个提交 | 克隆仓库的人“今天能装到什么” | 不能把 HEAD 新合同写成当前常驻已经运行 |
| 本机狗粮 | launchd、runtime ada7981、配置筛选、/health（本会话不可读） | owner 操作手册 | 不能用常驻落后改法律页，也不能用“有 HEAD 代码”写成这台 Mac 已启用 |

H1–H5 主要是 HANDOFF、owner 账号或工程基础设施时钟；H6 是 HEAD 源码合同。它们只能回写内部档案或触发 owner 决策，不能单独改变官网承诺。反过来，官网候选页若尚未进入发布树，也不能反推 HEAD 或本机。调度方关于 Tailscale、Claude Max 的快照在本会话都有未复核或冲突点，按“未独立复核”处理。

明确混层的草稿条目是：H1 把本机组网状态推成对外事实；H2 把 runtime/health SHA 与源码 HEAD 或历史场次锁混为一条；H3 把 CLI 账号状态推成 daemon 已能接线；H5 把 live 音色与源码缺省混写；C8 把 HEAD 的 remote-mobile 代码或临时证据推成常驻狗粮；H6 若直接部署则把 HEAD 的 setup 合同强加给当前 runtime。C2 也有同样的发布门问题：文档代码面存在不等于线上已承诺远程能力。

## 3. 逐条证伪

### C1

**判定：[ok]（A）**

证据：中文首页 index.html:96 把 Windows/Linux/iOS/Android/HarmonyOS 一并写成“内测中”并给发邮件入口，:383、:400-406 继续写 Windows/Linux 内测；文档 docs/index.html:856 与英文 docs/en/docs/index.html:876 写 Windows/Linux“暂不支持、没有明确时间表、不承诺”。这是同一访客可能同时看到的相反承诺。

修法：Windows / Linux 统一为“暂不支持；没有明确时间表，不承诺”，移动端另写“工程壳/内部 dogfood，尚未提审，暂不接受外部报名”，中英文保持同义。

### C2

**判定：[warn]（A）**

证据：首页 index.html:336、:346 把手机审批与“局域网或远程连接”放在泛化架构里，隐私带 :366-367、FAQ :452、:460 仍只说局域网；文档 docs/index.html:749-755、:829-830 才写出 tailnet 手工白名单、可批 S2、合并和 S3 回本机。代码有 tailnet 身份面，但本会话没有独立通过 Tailscale 状态或手机烟测，且候选页未证明已部署。

修法：法律页和首页只承诺“局域网，或你自行配置且符合文档的加密组网（如 Tailscale）；SayDo 不提供中继或云端托管；S3 与合并仍须本机受信屏幕”，不要把“远程连接”写成无条件产品服务。

### C3

**判定：[ok]（A）**

证据：privacy/index.html:64、:67、:76-86 与首页 index.html:160、:172、:289、:366-367、:452 使用“无服务器”“不上传”“数据不出设备”等绝对句；生成后的 docs/index.html:716-717、:733、:782-783、:800 明写桌面可把语音交给火山、AI 上游以及可选 ntfy。隐私页 :76 还写麦克风音频“仅在本机处理，不上传”，而 apps/ios/SayDo/NativeSpeechController.swift:202-232、:241-246 存在显式 allowServerRecognition 的联网识别分支。

修法：统一改为“SayDo 不运营产品后端、账号服务或分析采集；核心账本在你的设备；若你主动启用第三方 AI、语音识别/合成或 ntfy，相应请求、音频、转写或通知会发送给你选择的服务商并按其条款处理”，并同步首页首屏、FAQ、中文/英文法律页及商店上游材料。

### C4

**判定：[ok]（B）**

证据：iOS ConnectionStore.swift:21、:39、:73-114 通过 Keychain 读写并使用设备级可访问性；Android TokenStore.kt:30-69 使用 AES/GCM 与 AndroidKeyStore。浏览器 dogfood 的 packages/console/src/lib/api.ts:20-26 则把首次注入的会话凭证放入 localStorage，这是另一种载体，不能用它否掉原生壳的商店隐私声明。

修法：保留“原生壳凭证存 iOS Keychain/Android Keystore”等价设施，并另写“手机浏览器 dogfood 使用浏览器本地存储”；同时复核隐私页“一次性扫码”措辞，因为 docs/index.html:752-755 描述的当前 dogfood 能力令牌并非一次使用即失效。

### C5

**判定：[ok]（A）**

证据：首页 index.html:336、:341-347、:383、:456、:460 把“拍板、审批”与泛化 LAN/remote、扫码即连放在一起；文档 :317-324 明确 LAN 手机不能裁决 S2/S3，:749-755 才区分 tailnet 可批 S2、合并和 S3 回桌面。页面没有把这两个远程面和本机受信屏幕的权限边界说清楚。

修法：首页改成“手机可说话、看进展和处理低风险确认；LAN 面不裁 S2/S3；符合配置的 tailnet 面可批 S2；合并与 S3 回到本机受信屏幕”，并在开始使用处标明 SAYDO_MOBILE_LAN=1、私网和浏览器/自构壳前提。

### C6

**判定：[warn]（A 风险）**

证据：首页 index.html:96、:383、:400-432 把五个平台写“内测中”并提供发邮件申请；商店 SoT docs/release/2026-08-13-store-submission-status.md:19-23、:27-31、:41-45、:122-124 只记录占坑/包名，spike 0.1 不可提审、无生产配对和审核夹具、商店轨尚未提交；docs/index.html:158、:763-768 也写各端未提审。单独的“内测中”可以被解释为内部工程 dogfood，但与外部邮箱并列时，访客会理解为有可申请的 beta。

修法：改成“工程壳与商店记录已建，尚未提审或开放外部内测；当前仅内部 dogfood，暂不接受报名”，除非先有真实分发轨、可安装包和审核证据。

边界：若“发邮件申请”被读作可获得外部 beta，该子主张单独为 [fail]（A）；“内测中”只表示内部工程 dogfood 时，不必把这个词本身绝对判假。

### C7

**判定：[warn]（B）**

证据：docs/index.html:824-825 把云端级联语音列为现在可用，同时把实时字幕、Silero VAD 写成进行中；pipeline/src/saydo_pipeline/vad.py:1-9、:82-129 明确当前是 Energy RMS、hangover、语义 EOU 和“说完了”按钮，Silero/webrtcvad 仅 R-C；doubao_asr.py:1-10、:123-124 与 console voice/useVoiceChannel.ts:496-501 仍是按住后松手的整段识别、无 partial。文档定义“进行中”是已开工未收口，因此不能把整个云端语音行降为规划中，也不能把已有能量 VAD 倒写成未做。

修法：拆成三项：“云端级联 ASR/TTS 现在可用；实时字幕（partial）进行中，当前仍按段识别；Silero VAD 规划中/待 spike”。

边界：若官网“进行中”被访客理解为已经能看到 partial，则实时字幕也应降为“规划中”；只有 owner 能拿出 W7.1 已开工证据时，才保留“进行中”，且必须同时写“当前无 partial”。

### C8

**判定：[warn]（B）**

证据：docs/plan/IMPLEMENTATION-PLAN-2.md:69-71 与 remote-mobile-w0 证据定义的是代码加临时 Chromium/LAN 证据，不部署常驻、不宣称真机 WKWebView dogfood；对外 docs/index.html:317-324、:749-755、:829-830 已写 SAYDO_MOBILE_LAN=1、私网、浏览器/自构壳、dogfood 和 S2/S3 边界。反而首页 index.html:383、:456、:460 只写扫码即连和局域网，没有开关与 dogfood 条件。

修法：保留文档已有的 dogfood 备注，不向访客写“相对 HEAD”这类内部时钟；只在首页开始使用处补“需本机开启 SAYDO_MOBILE_LAN=1、仅私网的浏览器/自构壳连接”，不宣称商店 App 或常驻手机面已开放。

### C9

**判定：[warn]（A）**

证据：首页 index.html:315-316 先说以 Claude 订阅登录态在隔离 worktree 中改代码，再说能力实测与审批门已落地；e2e/evidence/w54a-claude-cli.md:1-4、:180-189 明确 W5.4-a 只是 spike 与纯函数，未接执行器主路径、gateServer、配置入口或常驻部署；packages/daemon/src/tier1/validateConfig.ts:94-108 对非 cursor 返回 unsupported_adapter，当前启动资格仍只有 Cursor。

修法：整张卡改为“Claude CLI 能力 spike 与审批门纯函数已落盘；生产执行器尚未接线，当前真正改代码的执行器仍为 Cursor Agent”，不要让前半句暗示 Claude 已能生产改码。

### C10

**判定：[ok]（B）**

证据：首页 index.html:323-324 明标 PushKit/CallKit 来电式语音汇报 Coming soon，docs/index.html:716-717、:836 将当前在线语音、macOS 通知和 ntfy 回叫与未来电话形态分开。

修法：保持 Coming soon/规划中；可补一句“当前可用的是桌面通知与 ntfy 回叫，不是系统来电”，不得升格为现在可用。

### H1

**判定：[warn]（B）**

证据：HANDOFF.md:51 仍把系统网络扩展写成待批准、Tailscale/手机烟测 owner 暂缓；本会话 tailscale status --json 只输出 CLI failed to start，systemextensionsctl list rc=69，故调度方所称 Running/Online/enabled 未独立复核。launchd running 只证明 daemon 作业存在，不能证明 Tailscale 状态。

修法：HANDOFF 先保留手机烟测待办并标“待 owner 提供可复跑组网证据”，证据确认后再单独清理扩展待批准语句，期间不 deploy。

### H2

**判定：[ok]（B）**

证据：HANDOFF.md:40 的场次①历史锁是 b201514；本会话 git rev-parse HEAD 是 088b8f0，runtime symlink/git HEAD 是 ada7981，rev-list 计数差为 355；curl /health rc=7，所以 runtimeSha 没有被本会话 HTTP 独立读到。

修法：HANDOFF 当前坐标明确列成“源码 HEAD=088b8f0｜当前 runtime=ada7981；/health runtimeSha 待复核｜场次①历史锁=b201514”，保留历史锁但未经 owner 授权不把 HEAD 灌进 launchd。

### H3

**判定：[warn]（B）**

证据：HANDOFF.md:45 与 IMPLEMENTATION-PLAN-2.md:17、:53、:60、:124、:149 仍写“下周购入 Claude/5.4 挂订阅”；W5.4-a 证据 :1-4、:180-189 只证明 spike、纯函数和未接主流程。本会话 claude auth status 返回 loggedIn=false、authMethod=none，与调度方 Max 快照冲突，可能是钥匙串/执行环境不同，不能据此判定 owner 全局没有订阅。

修法：把计划改成“W5.4-b 接线，前置 canonical 合同评审与 owner 同环境订阅登录态复核”，确认前不要写“已购/已登录”，也不要把 CLI 登录推导为常驻 daemon 已能消费 Claude。

边界：若把“本会话已登录 Max”写成确定事实，该子句单独为 [fail]；本条整体仍为 [warn]，因为不同环境的账号状态尚未统一复核。

### H4

**判定：[warn]（B）**

证据：HANDOFF.md:44 仍写“2026-08 再开”；package.json:6 是 pnpm@10.33.1，而 .github/workflows/ci.yml:13-15 使用 pnpm/action-setup 且 version=10，方向上确有工程版本键债。本会话 gh run view 32334615753 因代理失败，未独立取得“约 14 秒”或具体 run 日志。

修法：HANDOFF 改成“最近一次 CI 运行状态/失败日志待 owner 复核；仓内 pnpm 版本键不一致待修后重跑”，把它留在工程基础设施档案，不写成对外 billing 或产品承诺。

### H5

**判定：[ok]（B）**

证据：HANDOFF.md:49 已区分源码缺省音色与 live 覆盖；本会话安全筛选的 ~/.saydo/config.toml:35 是 jitangmei，pipeline/src/saydo_pipeline/doubao_tts.py:86-98 的源码缺省是 tianmeiyueyue。

修法：保持这条 owner 侧区分；若要切 live 音色，另做 owner 拍板与听感证据，不把源码缺省写成当前实例。

### H6

**判定：[ok]（B；误部署会升为 A 级回归风险）**

证据：HEAD packages/daemon/src/index.ts:888 对受限移动路由返回 mobile_lan_route_rejected，:1000、:1054、:1173 对 tailnet/setup 返回 setup_local_only；SetupBootstrapBoundary.tsx:12、:27 只把 mobile_lan_route_rejected 映射为 remote-mobile，测试 .test.ts:95-109 仍把 setup_local_only 留在错误卡。当前常驻 runtime 是 ada7981，目标 HEAD 新文件/分支不在该 runtime 中。

修法：不把 setup_local_only 静默扩成 tailnet remote-mobile；先由 owner 拍板 T19 × tailnet 合同、新错误码和测试，再决定是否部署。

## 4. 草稿没有列出的错位

1. **A 级：无云端依赖的文字与实际出网冲突。** docs/index.html:216 写“全部跑在你的 Mac 上，无云端依赖”，同表 :224 及 :782-783 又写火山云端 ASR/TTS 和外部出网，:716-717、:800 还写 ntfy；docs/site/2026-08-20-docs-page-content.fable.md:688-694 也保留同一冲突。应改为“无 SayDo 自营后端；可选第三方语音、AI、推送由你配置”。

2. **A 级：发布树与链接可能不一致。** 当前候选首页 index.html:59、:394、:486、:517 及法律页链接 /docs/；英文页链接 /en/docs/，但 HEAD 的 git ls-tree 只有根首页、privacy、support、terms 等，没有 docs/ 或 en/，git cat-file 对两路径均 rc=128。HEAD 首页自身仍在 :79、:313-335 写“移动 App 即将上架/三端即将上架”，与候选“内测中”又是第三套口径。线上是否已部署候选目录本会话未验证；在确认发布树前，不能把这些链接当已对外可用。

3. **A 级：商店隐私上游继续漂移。** docs/release/README.md:7-27 指定 app-materials 与 data-disclosure-matrix 为商店成文上游；app-materials.md:57-78 仍写无服务器、麦克风不上传，data-disclosure-matrix.md:16-21 却记录转写发桌面、桌面可能再发 ASR/LLM 供应商。只改 deploy/privacy 会让商店表单仍承诺另一套事实。

4. **B 级：原生语音例外没有投影到法律页。** privacy/index.html:76 的麦克风绝对句与 NativeSpeechController.swift:202-232、:241-246 的显式联网识别开关冲突；法律页应写“默认设备端，用户开启联网识别时按系统厂商条款”，英文页同样处理。

5. **B 级：完成度表把代码路径和真人触点合成一个状态。** docs/index.html:821 把 Touch ID/验收证据视为现在可用，但备注仍是 owner 真人过卡待验；应拆成“代码路径/合同可用，真人验收待验”，否则对外完成度仍过满。

6. **B 级：当前坐标仍有历史现在时。** HANDOFF.md:33-34、:52 与 PLAN-2 的历史 runtime 指针有日期，但 active 的场次/下一步段落仍容易把 b201514 或旧相对时间读成当前；应在 §1 增加唯一 current coordinate，不改写历史记录。

7. **B 级：英文与中文候选稿不能只按文件存在推断上线。** 当前英文目录是未跟踪候选，HEAD 不含 en/；任何中文先改、英文后补的做法都必须在发布树门禁中阻断，否则法律与状态会语言分叉。

8. **B 级：源稿维护注记自身落后于代码路径。** docs/site/2026-08-20-docs-page-content.fable.md:918 仍指向 callback/index.ts 并保留“L0 未接”注记，但当前源码实际由 callback/sweep.ts 与 packages/daemon/src/index.ts:3480-3505 调用回叫链；这条注记不能用来否定 docs 对 L0/L1 已有路径的状态，应在下一次 canonical 回写时校正引用和边界。

## 5. 最终建议

### 优先对齐（本周）

1. 先建立“实际发布树”证据，再同步 CN/EN 首页、文档、隐私、条款和 FAQ：收窄无服务器/不上传，补第三方出网例外，拆 LAN/tailnet/本机审批边界，统一 Windows/Linux 与移动端状态，并验证 /docs/ 与 /en/ 链接不会指向未发布目录。
2. 同一轮同步商店唯一上游 app-materials 与 data-disclosure-matrix；不接受只改挂网页面的局部修补，也不把未提审的占坑记录称为外部内测。
3. HANDOFF 增加三层 SHA 当前坐标、/health 未复核标记、SAYDO_MOBILE_LAN 当前缺失和 Claude/Tailscale 证据冲突；把“下周”“2026-08 再开”改成可复核状态句，历史快照保留原日期。
4. Claude 卡、实时字幕/Silero、Touch ID 真人触点分别标明“纯函数/代码路径”与“生产/真人尚未收口”，不为填平徽章而宣称能力已接线。

### 后续对齐（拍板后）

- owner 在同一可复跑环境完成 Tailscale 扩展、BackendState/Online 和 just t2-pair 四页手机烟测；再决定是否让常驻启用 SAYDO_MOBILE_LAN=1。
- owner 先拍 T19 × tailnet setup 合同，再决定新错误码、实现和测试；在此之前不把 HEAD remote-mobile 分支部署到 ada7981 常驻。
- W5.4-b 以前置合同评审、订阅登录态复核、daemon 自检和真实 smoke 为门；不能只凭 W5.4-a evidence 或 auth status 改成 Claude 现在可执行。
- 修正 Actions 的 pnpm 版本键后重跑并留 run 日志；TTS live 音色、Touch ID 真人场次与 OctoBlog 由 owner 分别给听感/真人证据。

### 改承诺的具体句子

以下句子可作为中文对外替换句，英文页逐句保持同义，不把内部 SHA 或本机路径带入：

1. **Windows/Linux：**“Windows / Linux 暂不支持；没有明确时间表，不承诺内测时间。”
2. **移动端：**“iOS / Android / HarmonyOS 工程壳与商店记录已建，尚未提审或开放外部内测；当前仅支持手机浏览器或自构壳的内部 dogfood，暂不接受报名。”
3. **网络面：**“手机与电脑可在同一局域网，或你自行配置且符合文档的加密组网（如 Tailscale）中通信；SayDo 不提供中继或云端托管；S3 与合并仍须本机受信屏幕。”
4. **隐私总句：**“SayDo 不运营产品后端、账号服务或分析采集；核心账本在你的设备；若你主动启用第三方 AI、语音识别/合成或 ntfy，相应请求、音频、转写或通知会发送给你选择的服务商并按其条款处理。”
5. **原生与浏览器存储：**“原生壳把配对凭证存入 iOS Keychain、Android Keystore 等系统安全存储；手机浏览器 dogfood 使用浏览器本地存储，两者不是同一分发面。”
6. **手机审批：**“手机可查看进展并处理低风险确认；LAN 面不裁 S2/S3，符合配置的 tailnet 面可批 S2，合并与 S3 回到本机受信屏幕。”
7. **语音徽章：**“云端级联 ASR/TTS 现在可用；实时字幕（partial）进行中，当前仍按段识别；Silero VAD 规划中/待 spike。”
8. **Claude 卡：**“Claude CLI 能力 spike 与审批门纯函数已落盘；生产执行器尚未接线，当前真正改代码的执行器仍为 Cursor Agent。”
9. **无云表述：**“核心 daemon、账本和执行在你的 Mac；你主动配置的第三方语音、AI 或推送服务可能接收相应数据，SayDo 不运营产品后端。”
10. **首页手机前提：**“手机浏览器/自构壳 LAN dogfood 需本机开启 SAYDO_MOBILE_LAN=1，并满足私网与文档中的配对条件；这不代表商店 App 已开放。”

### 保持不动

- macOS 桌面服务现在可用、当前真正改代码的执行器为 Cursor Agent；这两句保留，但不外推为 Claude 已接线。
- 来电式 PushKit/CallKit 继续标 Coming soon/规划中；不要把桌面通知或 ntfy 回叫改名为系统来电。
- 原生 Keychain/Keystore 安全存储事实保留，浏览器 dogfood 单独说明。
- S3 只在本机受信屏幕、语音不放行的边界保持不动。
- live TTS 的 jitangmei 与源码缺省 tianmeiyueyue 继续作为 owner 侧双时钟记录，不自行改 live 配置。
- 不 deploy HEAD，不把 Cloudflare 隧道或本机常驻状态写进对外承诺。

## 6. 总评

**整体判断：需收窄。**

草稿的大方向抓到了主要矛盾，但若按原样执行会有三处风险：把未独立复核的 tailnet 状态当成法律事实；把“内测中 + 发邮件”留给没有可提审包的商店轨；只修挂网页而不修首屏、英文、商店上游和发布树。因而它还不能直接称为“可执行”；但证据没有显示整个方案必然会改错，关键是先把层和受众收窄。

分级汇总：

- A 级：C1 的 Win/Linux 语义矛盾，C3 的绝对隐私句，C5 的审批面混写，C6 的外部内测暗示，C9 的 Claude 生产能力暗示，以及无云依赖、发布树链接、商店隐私上游和原生联网识别遗漏。
- B 级：C2/C7/C8 的条件与徽章过满，H1-H5 的档案/证据时钟，H6 的未拍板源码合同，Touch ID 真人触点与历史 current coordinate。
- C 级：中英文文风、徽章命名和段落位置；只有在 A/B 事实收窄后再处理。

如果只能做三件事，我会做：

1. 以真实发布树为门，统一中英对外状态、网络权限和隐私出网，并同步商店两份上游材料。
2. 把 HANDOFF 改成三层 current coordinate，明确 /health、Tailscale、Claude 登录状态哪些已证、哪些冲突或未读；不 deploy。
3. 把所有工程扩展留到 owner 拍板后的 T19/W5.4-b/手机烟测门，维持当前 Cursor、Coming soon 电话回叫和 S3 本机边界不变。
