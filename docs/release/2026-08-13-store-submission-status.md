# SayDo Store Submission Status — 2026-08-13 占坑战役

> 本文件是本战役的**过程 SoT**(做没做、卡在哪、店/备案 ID)。成文材料、备案提交原文、证书抄表各有专文件,见 [README.md](README.md)。不写密钥、密码、审核账号口令。
> 本轮目标是**占长周期坑**(标识符 / 备案 / 软著 / 商店应用记录),不是把评估壳送审。
> 创建:`[setup-0813]` 2026-08-13 14:30 CST
> 拍板回写:`[setup-0813]` 2026-08-13 14:40 CST — 独立产品 / 中文主名待发送 / 三店含中国大陆 / 子域 saydo.octoooo.com / 中国包装豆包 / 复用千手账号 / 已登记 Bundle ID / 已生成仓库外签名材料
> 定名回写:`[name-0813]` 2026-08-13 — **中文主名「说到」**(owner 从 说到/一诺/口谕 三候选中选定;六候选占用核验见 name-occupancy.md §6)。三端 `app_name` 与 release 文档已同步。
> 归并回写:`[name-0813]` 2026-08-13 — `docs/store/00–05`(既白同日起草的隐私政策/文案/审核备注/备案表/软著说明)已逐项裁决归并至 **[2026-08-13-app-materials.md](2026-08-13-app-materials.md)**,六份原稿加弃用横幅冻结;融合文案已投影 metadata.json(28 字段 0 违规)。
> 占坑回写:`[occupy-0813]` 2026-08-13 — Pages 站点 + 自定义域上线;ASC/Play/AGC 应用记录均以「说到」建好;鸿蒙发布证书已签发,叶证书指纹写入 filing-cheatsheet。
> 备案回写:`[filing-0813]` 2026-08-13 16:44 — 腾讯云新增 App 服务已提交初审(订单号私存),状态「腾讯云审核中」。字段快照 `docs/release/2026-08-13-tencent-icp-app-filing.md`。
> 备案通过回写:`[filing-0821]` 2026-08-21 — 管局审核通过,App 服务号 `京ICP备2025153079号-4A`;服务名「说到」,域名 `saydo.octoooo.com`,接入 IP 与主体站点同机。证据:腾讯云控制台「新增服务 - 备案成功」。
> 审核路径回写:`[review-0813]` 2026-08-13 — DEC-9:审核夹具=家里 Mac mini,仅提审窗口在线,不成产品云;清单 `app-materials.md` §4。

Previous campaign: 无(SayDo 首次)。可复用的邻产品战役:`OctoDesk/docs/plan/2026-07-21-mobile-store-submission-status.md`(千手,包名 `com.octoooo.desk`,备案号 `京ICP备2025153079号-3A`)

## 0. Overview

| Track | Store | Status (updated) | Next action | Owning session |
|---|---|---|---|---|
| iOS | App Store | app-record-created | 店名「说到」已占,App Store ID `6801042343`;en-US 店名 `SayDo - You Say, AI Do`(2026-08-22 写入 ASC)。勿传 spike IPA | `[occupy-0813]` / `[name-0822]` |
| Android | Google Play | package-reserved | title「说到」,包名 `com.octoooo.saydo`,Play 应用 ID `4975182458667142159`。Dashboard 未见 12 人内测门横幅(账号已有正式应用)。勿传 spike AAB | `[occupy-0813]` |
| HarmonyOS / Android channel | AppGallery | app-id-and-release-cer | App ID `6917613548237019987`, listing `9249519184596237673`,手机-only,发布证书 `SayDo Release` 至 2029-08-13。Profile `.p7b` 未建。勿传 spike HAP | `[occupy-0813]` |

Shared: bundle/package id `com.octoooo.saydo`(工程+三店均已占) · 三端壳 `0.1.0 (1)`(不可提审) · version SoT [`version-matrix.md`](version-matrix.md) · 深链域已挂 · 审核夹具策略已定(家里 Mac mini,未执行)

平台可行性(skill Phase 0 门):

- iOS: 原生 SwiftUI 壳,XcodeGen,Team `5CS6HUB4P2`,可出包。现状 = LAN spike。
- Android: Kotlin 壳,`applicationId com.octoooo.saydo`,可 `assembleDebug`。现状 = 明文 HTTP spike。
- HarmonyOS NEXT: ArkTS 壳,`bundleName com.octoooo.saydo`,可 hvigor 出 unsigned HAP。**有官方 NEXT 目标**,不是 Flutter 壳,AGC 可走鸿蒙通道。

不可提审的硬原因(三端共同):无生产配对/信任层、明文 LAN、审核夹具尚未执行(策略见 §1.2);App Store en-US 精确名 `SayDo` 仍被占(中文店名「说到」已占)。隐私页已挂网,不再是拒因。

## 1. Shared infrastructure

### 1.1 Deep-link domain
- [x] Pass 1: `https://link.saydo.octoooo.com/.well-known/{apple-app-site-association,assetlinks.json,applinking.json}` 均 HTTP 200 且 `Content-Type: application/json`(2026-08-13 curl)。AASA `appIDs`=`5CS6HUB4P2.com.octoooo.saydo`;assetlinks 为我方 Android release SHA-256;applinking 已填 AGC App ID `6917613548237019987`。**尚未**在 AGC 增长后台登记该域名。
- [ ] Pass 2: 未跑 `check-deeplink-live.mjs`(壳未接生产 Associated Domains / assetlinks)

Pages: 项目 `saydo` → `saydo-3xb.pages.dev` + 自定义域 `saydo.octoooo.com`;项目 `saydo-link` → `saydo-link.pages.dev` + `link.saydo.octoooo.com`。上传含非隐藏 `well-known/` 副本。

### 1.2 Review demo path
- T1/T2 无云登录。审核员不能靠「用户名密码」。配对即凭证。**禁止**把千手 demo 账号写进 SayDo 表单。
- **DEC-9**(owner 2026-08-13):不做成产品云、不把家里电脑当用户后端。提审时打开家里一台 **Mac mini** 作审核夹具,让审核员临时连接;审完关机并轮换 token。成文口径与执行清单:`docs/release/2026-08-13-app-materials.md` §4。
- 辅证:演示视频必附。壳内演示模式仍建议做,不是 DEC-9 前置。
- 夹具本身未建(spike 阶段不要送审)。公网入口/IP 不写本仓。

### 1.3 Privacy pages + disclosure matrix
- [x] privacy 200-verified `https://saydo.octoooo.com/privacy/` · [x] terms 200-verified `https://saydo.octoooo.com/terms/` · [x] support 200-verified · matrix: `docs/release/data-disclosure-matrix.md`(草稿)
- 挂网正文生效日 2026-08-13,联系邮箱 `support@octoooo.com`(复用千手既有邮箱,不是新开账号)。canonical 材料里的【邮箱】占位以本页为准。
- 无独立营销站以外的产品云。不能把千手隐私页冒充 SayDo。
- [ ] 三商店隐私表单未填(也不应在 spike 阶段填)

### 1.4 Production freeze log
| Date | Change | Reason | Verification |
|---|---|---|---|
| — | 尚未进入审核冻结 | | |

## 2. Google Play track

- Console coordinates: 复用千手账号 Huying `5565423440378520991`(owner 2026-08-13 确认)。`[occupy-0813]` 已创建应用 title「说到」,默认语言 zh-CN,免费 App,包名 `com.octoooo.saydo`(Check availability: available → 占用)。Play 应用 ID `4975182458667142159`。
- 创建后 Dashboard 未见 12 人封闭测试门横幅;按 skill 视为该账号已有正式发布应用而豁免,仍勿传 spike 包。
- `[setup-0813]` Android release keystore 已生成于仓库外 `~/.config/saydo/keystores/saydo-android-release.p12`,口令只在钥匙串。指纹已写入 `docs/release/filing-cheatsheet.md`。
- Closed-testing gate: 该账号已有正式发布应用,按 skill 视为豁免;创建应用后在 Console 再确认横幅。
- Artifacts: 无 AAB。图标草稿 `artifacts/release/store-assets/play-icon-512.png`。
- 下一步:**不要上传 spike 包到正式轨。** 生产壳齐后再走内部测试/正式轨。

## 3. App Store track

- Coordinates: Bundle ID 已登记 `com.octoooo.saydo` / ASC `bundleIds` id `PFS4HWS6C9` / Team `5CS6HUB4P2` / seedId `5CS6HUB4P2` / App Store ID **`6801042343`**. `[occupy-0813]` 网页创建应用:平台 iOS、店名「说到」、主语言 zh-Hans、SKU `saydo`、Full Access。创建时 ASC 提示 user access 设置未保存(个人账无实际影响)。`[name-0822]` en-US 店名已写 `SayDo - You Say, AI Do`(精确 `SayDo` 仍被占)。
- `[setup-0813]` 2026-08-13 14:39: ASC API `POST /v1/bundleIds` 成功,platform=UNIVERSAL。随后 `POST /v1/bundleIdCapabilities` 打开 `PUSH_NOTIFICATIONS` 与 `ASSOCIATED_DOMAINS`。系统默认带了 `IN_APP_PURCHASE`(无内购计划,可留)。
- 店名精确 `SayDo` 仍被占用,证据 `docs/release/name-occupancy.md`。中文店名「说到」已占用。
- 加密豁免:未对二进制跑 `nm`/`strings`,不宣称 `ITSAppUsesNonExemptEncryption=false`。
- EU DSA: 未决。
- Artifacts: 无 IPA。图标母版 `artifacts/release/store-assets/app-icon-1024.png`。

## 4. AppGallery track

- Coordinates: AGC App ID `6917613548237019987`; HarmonyOS NEXT listing 记录 `9249519184596237673`; 项目名 `SayDo`; 设备类型仅手机。
- `[setup-0813]` ECC P-256 p12 + CSR 已生成于 `~/.config/saydo/keystores/saydo-harmony-release.{p12,csr}`。
- `[occupy-0813]` CSR 已上传,发布证书名 `SayDo Release` 生效至 2029-08-13。下载的 `.cer` 是三件套链,备案指纹必须用**叶证书**(SHA-1 与 AGC「备案信息」一致 `D816EA3D…`)。指纹已写入 filing-cheatsheet。Profile `.p7b` 未申请。
- 设备类型:已勾仅手机(listing `9249519184596237673`)。
- AI 申报:owner 选择中国 SKU 对话默认豆包/火山、BYOA 不进中国包。在中国包真正接到该模型之前,**不填写** AGC「涉及生成式 AI」的备案号。
- Artifacts: 图标 `artifacts/release/store-assets/agc-icon-216.png`。

## 5. China compliance track

| Item | Status | Filed | Expected | Number/receipt |
|---|---|---|---|---|
| ICP 网站备案(主体) | 已有,属 octoooo.com / 千手 | 既有 | — | `京ICP备2025153079号` |
| ICP App 备案(SayDo) | 管局已通过,状态正常 | 2026-08-13 提交;2026-08-21 通过 | — | `京ICP备2025153079号-4A` |
| 软著 CPCC | R11 已提交,流水号 `2026R11L2860558`,待受理 | — | 普通通道,不加急;千手 `2026R11L2548912` 未动 | 2026-08-21 签章页已传并确认提交;电子证书 |
| AI declaration evidence | 策略已定:中国包装豆包/火山,BYOA 排除;号未写入 | — | 中国包接到真实模型后再填 | 见矩阵 §C |
| 公安备案 | 号已下发,未做;腾讯云提示服务开通后 30 日内 | — | 约 2026-09-20 | 千手先例:全国互联网安全管理服务平台 |

备案字段以快照为准,本表不另维护第二套填写清单:

- 已提交原文:`docs/release/2026-08-13-tencent-icp-app-filing.md`
- 号下发后只改本表 Number/receipt,不改快照里的提交值
- 接入:共用 `octoooo.com` 主体,腾讯云「新增 App 服务」,轻量 IP `123.207.158.219`

## 6. Owner TODO

| # | Action | Exact steps/values | Status |
|---|---|---|---|
| DEC-1 | 产品载体(设计 ADR-003) | A 并入千手=本战役停止;B 独立产品=继续占坑;C 只占标识符、载体以后再定 | **已选 B 独立产品**(2026-08-13) |
| DEC-2 | 商店唯一名 + 包内名 | 中文主名**「说到」** + 英文 SayDo;ASC en-US 店名 **`SayDo - You Say, AI Do`**(owner 2026-08-22;精确 `SayDo` 仍被占,走千手「品牌 - 副标」) | **已定**(2026-08-13;en-US 后缀 2026-08-22) |
| DEC-3 | 目标商店与地区 | App Store + Play + AGC,含中国大陆。国内安卓未选 | **已选**(2026-08-13) |
| DEC-4 | 域名 | `saydo.octoooo.com` + `link.saydo.octoooo.com` | **已上线** 2026-08-13 |
| DEC-5 | 中国区 AI 上游 | 中国商店包对话默认已备案国产模型;BYOA 不进中国包 | **已选**(2026-08-13) |
| DEC-6 | 登记 Apple Bundle ID `com.octoooo.saydo` | ASC `PFS4HWS6C9` | **已完成** 2026-08-13 14:39 |
| DEC-7 | 复用千手 Apple / Play / AGC 个人账号 | 主体与备案证件一致 | **已确认** |
| DEC-8 | EU DSA | 申报个人经营者或排除欧盟 | 待答 |
| DEC-9 | 审核员连接路径 | 不成产品云;提审窗口打开家里 Mac mini 作夹具;视频必附;壳内演示模式建议做。清单 app-materials.md §4 | **已选**(2026-08-13) |
| OWN-1 | 登录 Play Console / AGC / 腾讯云备案,把已登录浏览器交给本会话 | 三店与 DNS 已完成。腾讯云 App 备案已提交(订单号私存) | **已完成** |
| OWN-2 | 若走商标:先办个体工商户执照,经营范围覆盖第 9、42 类 | 自然人无执照会被退回;官费约 270 元/类/件 | 待你决定是否现在办 |
| OWN-3 | Android release keystore | `~/.config/saydo/keystores/saydo-android-release.p12`;口令钥匙串 | **已完成** |
| OWN-3b | HarmonyOS ECC p12+CSR+AGC 发布证书 | 同目录 `saydo-harmony-release.{p12,csr,cer}`;叶证书 `*-leaf.pem` | **已完成** |
| OWN-4 | 隐私政策主体名称 | 个人 汪义骁;挂网 `https://saydo.octoooo.com/privacy`,邮箱 `support@octoooo.com` | **已完成** |
| OWN-5 | Cloudflare 给 `octoooo.com` 加 `saydo` / `link.saydo` 记录 | CNAME `saydo`→`saydo-3xb.pages.dev`;`link.saydo`→`saydo-link.pages.dev`(橙云 Auto) | **已完成** |
| OWN-6 | 发送中文主名 | 「说到」——已用作三端包内名;备案名、软著名、AGC 中文名照此填 | **已完成**(2026-08-13) |
| OWN-7 | 官网与 App 悬挂备案号 | 页脚挂 `京ICP备2025153079号-4A`,链到 `https://beian.miit.gov.cn/` | **官网已部署** 2026-08-21;App 关于页待上架前补 |
| OWN-8 | 公安联网备案 | 全国互联网安全管理服务平台;腾讯云提示服务开通后 30 日内 | **APP 已重交** 2026-08-21 10:42,待大兴审核。10:06 单已撤销。功能描述=腾讯云现网备注;G4;前置许可否 |
| OWN-9 | CPCC 申请确认签章页 | 打印 `2026R11L2860558` 签章页,本人签字后拍照/扫描交给本会话上传 | **已上传并确认提交** 2026-08-21。列表=待受理;详情=已提交材料。签章原件私存,不入仓 |

## 7. Rejections log

商店轨尚未提交,故无商店拒信。ICP App 备案已于 2026-08-21 管局通过,号 `京ICP备2025153079号-4A`,无驳回。

## 8. While-waiting queue

- [x] `[setup-0813]` 战役文件 + 店名占用核验 + 披露矩阵草稿 + listing 草稿 + 商店图标尺寸导出
- [x] `[setup-0813]` Apple Bundle ID `com.octoooo.saydo` = `PFS4HWS6C9` + Push + Associated Domains
- [x] `[setup-0813]` Android release keystore + HarmonyOS ECC CSR(仓库外)
- [x] `[name-0813]` 中文主名「说到」锁定,三端 `app_name` 已改(iOS project.yml+Info.plist / Android strings.xml / 鸿蒙 string.json)
- [x] `[occupy-0813]` ASC 建应用「说到」=`6801042343`;Play 建应用「说到」包名占用;AGC APP ID + 手机 listing
- [x] `[occupy-0813]` Cloudflare Pages + 自定义域 `saydo.octoooo.com` / `link.saydo.octoooo.com`
- [x] `[occupy-0813]` 隐私/条款/支持页 200;deep-link well-known JSON 200
- [x] `[occupy-0813]` AGC 上传 CSR → 发布 `.cer` → 叶证书指纹写入 filing-cheatsheet
- [x] `[filing-0813]` 腾讯云新增 App 服务已提交(订单号私存,腾讯云审核中)。快照 `2026-08-13-tencent-icp-app-filing.md`。下一步:接 010-5610 审核电话,再等工信部 24h 短信
- [x] `[filing-0821]` 管局通过,App 服务号 `京ICP备2025153079号-4A`(说到 / `saydo.octoooo.com`)
- [x] `[filing-0821]` OWN-7 官网中英十页 + link 域已挂 `京ICP备2025153079号-4A` 并部署 Pages;App 关于页待上架前补
- [x] `[filing-0821]` 软著鉴别材料已生成:`artifacts/release/copyright/{source-code-60pages,user-manual}.pdf`;R11 预填避开千手「只写鸿蒙」坑
- [x] `[filing-0821]` OWN-8 公安「说到」10:06 单已撤销;10:42 按腾讯云现网备注重交,待大兴审核(G4 / 前置许可否 / 功能描述=本地效率工具)
- [x] `[filing-0821]` 腾讯云现网回读:说到 `-4A` 服务内容=工具(个人不能备「软件开发」);公安已按该口径对齐
- [ ] AGC 增长登记 App Linking 域名(applinking.json 已带 App ID `6917613548237019987`,增长后台尚未登记)
- [ ] HarmonyOS 发布 Profile `.p7b`(签名出包用,不挡备案)
- [x] `[name-0813]` docs/store 六份旧稿归并进 app-materials.md,弃用横幅已加
- [x] `[filing-0821]` 软著 R11 `2026R11L2860558` 签章页已传并确认提交,列表「待受理」。千手那条未动
- [ ] 中国 SKU:对话默认豆包/火山,BYOA 打成海外 flavor
- [x] `[review-0813]` 审核演示路径策略已定:家里 Mac mini 仅提审窗口在线,不成产品云。口径+清单 `app-materials.md` §4
- [ ] 提审执行:打开 Mac mini + 公网可达 + 演示数据 + 配对码 + 视频(§4.4);结论出来前保持在线
- [ ] 壳内演示模式(无连接示例账本;不挡 DEC-9)
- [ ] 生产壳:HTTPS、源白名单、关明文、签名、隐私清单

## 9. Retrospective

尚未结束。本轮已证明:「先占 SayDo 这个店名」在 App Store 走不通;「先占 `com.octoooo.saydo`」走得通。
