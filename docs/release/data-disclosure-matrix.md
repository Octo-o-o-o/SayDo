# SayDo 数据采集披露矩阵(草稿)

> 三商店隐私表单的唯一上游。改行为先改本表,再投影到 ASC App Privacy / Play Data safety / AGC 隐私标签。
> 挂网隐私正文在 `docs/release/2026-08-13-app-materials.md` §2(已上线 `https://saydo.octoooo.com/privacy/`)。
> 当前移动端是 LAN 评估壳,不是可提审二进制。表 A = 今日二进制事实;表 B = 目标首发 T2 预告,未实现的行不得填进商店表单。
> 阅读地图:`docs/release/README.md`。

最后更新: 2026-08-13

## A. 今日二进制实际采集(spike)

依据:`apps/ios` Info.plist、`apps/android/.../AndroidManifest.xml`、`apps/harmonyos/.../module.json5`、三份 README。

| 数据 | 采集? | 目的 | 关联身份? | 共享? | 加密? | 删除路径 | 证据 |
|---|---|---|---|---|---|---|---|
| 相机画面(扫配对码) | 是,仅设备内扫描 | 解析桌面 `http://ip:port/?token=` | 否 | 否 | 不落盘 | 退出扫码即丢 | iOS `NSCameraUsageDescription`; Android `CAMERA`; 鸿蒙 spike 未声明相机权限 |
| 麦克风音频 | iOS 是; Android 声明了权限; 鸿蒙未声明 | iOS 原生按住说话转写 | 否(无账号) | 转写结果发往已配对桌面 | 传输=当前 LAN HTTP 明文(spike) | 不在手机侧长期存 | iOS `NSMicrophoneUsageDescription` / `NSSpeechRecognitionUsageDescription`; Android `RECORD_AUDIO` |
| 语音转写文本 | iOS 是 | 发给已配对桌面 | 否 | 发往桌面;桌面可能再发 ASR/LLM 供应商 | 同上 | 桌面侧遵 `[privacy].store_transcript` | iOS 原生语音层 |
| 配对 URL / token | 是 | 重连桌面 | 是(这台手机上的桌面档案) | 否 | iOS Keychain / Android Keystore AES-GCM / 鸿蒙 HUKS | 用户删除该桌面档案 | 三端 README |
| 桌面档案元数据(名称、URL) | 是 | 多桌面切换 | 否 | 否 | iOS UserDefaults / Android SharedPreferences / 鸿蒙 preferences(不含 token) | 删除档案 | 三端 README |
| 通过 WebView 看到的控制台内容 | 是(渲染,不等于我方云采集) | 沟通面 | 视桌面会话 | 内容留在已配对桌面 | spike 为明文 HTTP | 桌面侧会话/forget | WebView / ArkWeb |
| 推送 token | 否 | — | — | — | — | — | 未接 APNs/FCM/HMS |
| 账号邮箱 / 密码登录 | 否 | — | — | — | — | — | 无云账号 |
| 崩溃/性能遥测 | 否 | — | — | — | — | — | 无 |
| 广告 ID | 否 | — | — | — | — | — | 未引入广告 SDK |

权限与商店声明必须一致的已知偏差(提审前必修):

- Android `usesCleartextTraffic=true`、鸿蒙 MixedMode.All:评估壳放行明文 HTTP,生产不可原样上架。
- 扫到的 URL 目前没有第一方源白名单。Guideline 4.7 / 任意 WebView 是真实拒因。生产必须只加载已配对、已校验的桌面源。
- 鸿蒙 `requestPermissions` 目前只有 `INTERNET`,与 iOS/Android 的相机/麦克风不一致;正式包按实际能力补齐后再投影本表。

第三方 SDK(spike):Android `zxing-android-embedded`(扫码,画面不上传)。无广告、无崩溃收集 SDK。

## B. 目标首发 T2 预告(未实现,禁止提前填表)

产品合同:`docs/02-product-definition.md` §7 T2 = 手机沟通 + 桌面执行。连接:`docs/03-architecture.md` §7 Tailscale 优先,可选密文中继。

| 数据 | 预期 | 目的 | 关联身份? | 共享? | 备注 |
|---|---|---|---|---|---|
| 配对设备公钥 / 信任材料 | 是 | Noise XX 互认证 | 是(设备) | 否,除非走自建中继(中继只见密文) | 采 OctoDesk 五件套,尚未落地 |
| 推送 token(APNs/FCM/HMS) | 是 | 回叫;payload 只带 opaque id | 是 | 与 APNs/FCM/HMS | PLAN-2 W7.3;digest 存盘 |
| 语音音频 | 视原生层 | 说话;iOS 走 VoiceProcessingIO | 是 | 桌面;桌面再决定是否发火山 ASR | 缺省 `[privacy].store_audio=false` |
| 转写 | 是 | 对话 | 是 | 桌面;可选火山 ASR | `[privacy].store_transcript` 缺省 true |
| 用户口播内容 / 任务 / 审批决定 | 是 | 产品功能 | 是 | 桌面执行面;agent/模型供应商由用户 BYOA 或 API 配置决定 | 中国区若申报 AI,必须能诚实说出上游备案号 |
| 崩溃日志 | 可选,缺省关 | 诊断 | 否 | 仅当用户打开 | 未做 |
| 中继流量 | T3/防火墙兜底才有 | 打通手机-桌面 | 设备级 | 中继只见密文 | 域名未定,这是 ICP「应用访问的域名」候选 |

删除路径(目标):手机内删除桌面档案;桌面 `forget_hard` 传播;无云账号则没有「网页注销账号」——Play 若判定创建了账号,会要账号删除 URL。T1/T2 应在表单写「无云账号,数据在用户设备」,并准备被打回后的解释。

## C. 生成式 AI 申报(中国区硬题)

应用向用户暴露文本生成(对话、代码、文章)。skill 口径:上游**没有**中国备案号就不能如实申报,不能借别人的号。

| 能力 | 当前上游 | 公开备案号? | 申报含义 |
|---|---|---|---|
| ASR | 火山 sauc(工程 ADR-101) | 候选:豆包/火山语音识别类(须对**实际产品页**核验,不直接抄 Coze 文档) | 可申报前提=核验通过 |
| TTS | 火山 seed-tts-2.0 | 候选:火山引擎文本转语音算法 `网信算备110108823483901230057号`(同源核验) | 同上 |
| 对话 / 决策 / 代码执行 | BYOA(`claude` / `codex` / `cursor-agent`) + OpenRouter 等 API | OpenAI / Anthropic / Cursor **无**中国算法备案 | **不能**用豆包号冒充。中国区选项:① 对话默认切已备案国产模型;② 中国商店包关掉生成式对话;③ 不上中国区 |

豆包文本大模型(仅当对话真的走它才能写进申报):

- 算法备案号 `网信算备110108823483901230031号`
- 大模型备案号 `Beijing-YunQue-20230821`
- 来源:https://www.doubao.com/legal/instructions (2026-08-13 打开核验页存在)

OctoDesk 千手申报用的是「服务端接入已备案第三方大模型」。SayDo T1/T2 的「服务端」是用户自己的 Mac,不是我们的云。申报措辞不能照抄千手,必须 owner/法务另拟。
