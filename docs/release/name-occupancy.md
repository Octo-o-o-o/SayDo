# SayDo 商店名占用核验 — 2026-08-13

> 本文件是**定名前占用证据**,不是过程 SoT。现行占用结果以文首 §0 与
> [2026-08-13-store-submission-status.md](2026-08-13-store-submission-status.md) `[occupy-0813]` 为准。
> 证据来自当日真实请求: iTunes Search/Lookup API、Play 详情页 HTTP 状态、ASC API(本团队)。
> 不把这些应用的存在写成商标检索结论;中国商标网未在本轮完成(官方站需人机验证)。
> §2 精确店名 `SayDo` 占用证据仍有效。§1 / §3 / §5 里「未登记 / 未创建 / 待拍板」已过时,不要当现状抄。

## 0. 占用后现状 `[occupy-0813]`

| 标识 | 现状 |
|---|---|
| 中文主名 / 包内名 | 「说到」(owner 2026-08-13 选定;核验见 §6) |
| App Store 中文店名「说到」 | 已占;App Store ID `6801042343`;SKU `saydo`;主语言 zh-Hans |
| App Store 精确英文 `SayDo` | **仍被占用**(§2);en-US 本地化名称留空,提审前定后缀 |
| Apple Bundle ID `com.octoooo.saydo` | 已登记;资源 `PFS4HWS6C9`;Team `5CS6HUB4P2` |
| Play 包名 `com.octoooo.saydo` | 已占;Play 应用 ID `4975182458667142159`;title「说到」 |
| 鸿蒙 `bundleName` `com.octoooo.saydo` | 已创建;AGC App ID `6917613548237019987`;listing `9249519184596237673` |

## 1. 定名前结论(2026-08-13 占坑前快照,勿当现状)

| 标识 | 状态 | 能不能今天占上 |
|---|---|---|
| App Store 商店名精确 `SayDo` | **已被至少两个在架应用占用** | 不能。ASC 创建应用时店名必须唯一,硬用会创建失败或随后被商标投诉 |
| App Store 商店名 `Saydo AI` | 已被占用 | 不能 |
| Apple Bundle ID `com.octoooo.saydo` | **本团队未登记**(ASC `filter[identifier]` 返回 0) | 能。API `POST /v1/bundleIds` 可当天占用,不依赖店名 |
| Play 包名 `com.octoooo.saydo` | 详情页 **HTTP 404** (2026-08-13 浏览器+curl) | 能。创建 Play 应用即占用包名 |
| Play 店名 `SayDo` | 搜索未见精确同名;近邻有 SaydooAI / SmartDo | 大概率能,但仍建议带区分后缀,避免审核员按误导性命名打回 |
| 鸿蒙 `bundleName` `com.octoooo.saydo` | 仓库已写,AGC 应用未创建 | 能。AGC 创建应用即占用 |
| 代码内包名 | iOS / Android / HarmonyOS 三端已经是 `com.octoooo.saydo` | 已占工程位,未占商店位 |

当时结论(占坑前):不要用精确英文 `SayDo` 创建 App Store 应用记录;先定商店唯一名,Bundle ID 可以先行。占坑时用了中文店名「说到」,en-US 精确 `SayDo` 仍未用。

## 2. App Store 在架同名 / 近名(iTunes API)

查询:`https://itunes.apple.com/search?term=SayDo&entity=software` 以及 lookup。

| trackId | 店名 | Bundle ID | 销售方 | 上架 |
|---|---|---|---|---|
| 6759785727 | SayDo | `io.github.Dencik21.SayDo` | Denys Ilchenko | 2026-03-04 |
| 6777723524 | SayDo | `com.zhengyunhao.ReminderVoice` | 云浩 郑 | 2026-08-06 |
| 6752837516 | Saydo AI | `com.saydoai.saydo` | Kirubel Tesfaye | 2025-09-29 |
| 6783212972 | 说了算 | `com.nnzt.Saydo` | 德民 周 | 2026-06-25 |

另:lookup `6756865724`(搜索引擎曾列出 "SayDO - Voice to Action")本轮 lookup 无结果,可能已下架,不计入硬占用。

公开页:

- https://apps.apple.com/us/app/saydo/id6759785727
- https://apps.apple.com/us/app/saydo/id6777723524
- https://apps.apple.com/us/app/saydo-ai/id6752837516

产品形态都是「语音 → 待办/日历」,和 SayDo「语音驱动本地 agent 办事」相邻,审核与商标风险都高于普通撞名。

## 3. 本 Apple 团队现况(占坑前 ASC API 快照, team `5CS6HUB4P2`)

已有应用(节选):`com.octoooo.desk` / 千手 - AI工作台(`6768164675`)。已有 bundle ID 含 `com.octoooo.desk`、`com.octoooo.octodesk`。**当日查询没有** `com.octoooo.saydo`;随后已登记为 `PFS4HWS6C9`,见 §0。

凭证位置(只记位置):`~/.config/octodesk/.env.build` 的 `APPLE_API_KEY_ID/ISSUER/KEY`。

## 4. 其它品牌碰撞(非商店,但影响域名/商标)

- https://saydoapp.com/ — 另一款 "Say it, Do it" 网页产品(GitHub/Jira/日历)
- https://www.usesaydo.com/ — 另一款 Saydo,隐私政策写明走 App Store / Play
- 俄罗斯主体 AO Saydo International 有 SAYDO 商标公开信息(网络检索,未做官局核验)

## 5. 店名策略(定名前选项;已由 DEC-1/DEC-2 关闭)

备案、软著、AGC 都绑**包内应用名**。OctoDesk 的可复用模式是:包内名短且唯一(「千手」),商店名可以带副标题(「千手 - AI工作台」)。

当时列出的方向(现已拍板,保留作证据):

1. **中文主名 + SayDo 作英文名**(最像千手路径) — **已选**:「说到」+ SayDo。
2. 英文店名加区分,避开精确 `SayDo` — en-US 后缀仍待定。
3. 改品牌后再占坑 — 未选。
4. 并入千手,不单独上架(设计 ADR-003 选项 A) — **未选**(DEC-1 = 独立产品)。

拍板记录见状态文档 §6;精确 `SayDo` 占用证据仍见 §2。

## 6. 中文候选名核验与定名 — 2026-08-13 `[name-0813]`

方法:iTunes Search API `search?term=<名>&entity=software`,cn/us 双 storefront,limit=200,统计 `trackName` 精确等于候选名的应用数。局限:搜索接口按相关性返回,不是注册表;最终以 ASC 创建应用时的唯一性校验为准。

| 候选 | cn 精确 | us 精确 | 近名情况 | 判定 |
|---|---|---|---|---|
| 说到 | 0 | 0 | 仅「说到照片」 | 干净 |
| 说办 | 0 | 0 | 无 | 干净 |
| 一诺 | 0 | 0 | 「一诺聆听」「一诺数字助理」等 5+ | 精确名可用,近名/商标拥挤 |
| 口谕 | 0 | 0 | 无 | 最干净,但「谕」字生僻 |
| 吩咐 | 0 | 0 | 无(搜索仅 2 结果) | 干净 |
| 如意 | 0 | 0 | 近名 30+(阿里如意系等) | 商标空间差,弃 |

**定名:owner 2026-08-13 选定中文主名「说到」**(shuō-dào 谐音 SayDo,取「说到做到」),英文名保持 SayDo。已同步:三端 `app_name`、`release-profile.yaml`、`metadata.json`、`filing-cheatsheet.md`。英文商店名精确 `SayDo` 仍被占用(§2),ASC en-US 店名待定后缀方案。
