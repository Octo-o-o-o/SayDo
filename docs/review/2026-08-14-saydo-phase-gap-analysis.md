# SayDo 阶段、缺口与核心问题分析(2026-08-14 终版)

> 性质:首发版(8-13)经三路独立评审回修后的终版。评审:事实证据 subagent + 战略价值 subagent + Codex 71 对抗审(报告 research/codex-findings/71-phase-analysis-review.md,triage 见该文末)。
> 时间锚:全部数字为 2026-08-13 23:35 +0800 实测(git fetch 实采);历史快照数字一律标注快照时点。
> 边界:不实施代码;不代 owner 裁决;待拍板项只列清单。

## 0. TL;DR

- **阶段**:首发主体(P0/P0.5/合同)收口,但体验工程(T16-T19/M1)、生产壳、真实价值证据仍在建;两条门未关:首发发布门(四场真人验收)与对外上架门(生产壳+审核夹具+软著/备案)。
- **发布线现状(实测)**:HEAD=origin/main=c5148ab(feat/t20-fusion-layout 已合并推送),无未 push 提交;发布验收锁 ada7981c(7-31)是当前 main 的**线性祖先**,main 在其上前移 **270 个提交**。这是基线漂移,不是分叉。
- **核心问题(并列,均压在 owner 真人时间上)**:B1 四场真人验收悬空(①failed@ada7981c、②③④ not_run)是发布门未关的根因;B0 v0.1.0 范围未裁决(默认路径=8 月工作属 v0.2,需显式裁决记录确认或推翻)是 B1 复验基线的前置。二者并列;此外 dogfood 价值证据零数据应与其同层供 owner 排序。
- **工程侧本周可并行的事**:LAN 进壳两刀竖切(移动评估壳范围内唯一 Critical,经 69/70 号评审收窄)、HEAD 门禁/evidence 转绿、最小 HANDOFF 治理。三者互不依赖 owner 拍板,但按 PLAN-2 开批纪律需 owner 停点确认。
- **长周期必须立即并行启动**:软著(50-75 工作日,加急 7-15)、ICP 备案在途核验、App Store en-US 店名后缀、审核夹具——这些才是提审关键路径,不依赖移动线收口。

## 1. 复核状态与首版修正表

三路评审结论:事实层无 A 级错误(数字在快照时点成立);战略层 2A + 多 B/C;Codex 判需回修后接受。**复核期间仓库被另一会话推进(8-13 22:52 两条新提交并已 push),所有旧数字已重采。**

| # | 首版说法 | 修正(终版口径) | 证据 |
|---|---|---|---|
| 1 | 8 月以来 11 条未 push | 快照时点(8-13 22:20 前)成立;**当前 0 条未 push**,HEAD=origin/main=c5148ab | 实测 origin/main..HEAD=0 |
| 2 | main=ada+268,远端 257 分叉 | **用词错误**:ada7981c 是 main 的线性祖先,main 前移 **270** 个提交(当时 268=feature HEAD,257=旧 origin/main,归属写反)。是基线漂移,不是分叉 | 实测 ada7981c..main=270;merge-base 祖先关系 |
| 3 | ff-only 纪律已被破坏、四场证据已失效 | 时序误读:ff-only 是场次④ pass 后的**发布时点**条件;①failed、②③④ not_run,不存在已通过证据可失效。正确结论:**旧 target 不满足现行 preflight,发布 target 需重选或 owner 改流程** | runtime-deploy.md:17-27;session-4.md:77-79 |
| 4 | 场次①–④锁 runtime ada7981c | 只有①有历史尝试(failed@ada7981c);②③④ not_run、runtime 待开场。规则是四场同 SHA,不是已锁定 | session-1.md:54-59;session-2/3/4 运行记录 |
| 5 | lint 本会话实跑 8 errors | 快照(8-13 22:20)实测 8 errors;**当前 HEAD 重跑仍 8 errors**(SetupWizard.tsx 7 处 unused + setupWizardUx.test.tsx:199 表达式,行号+1) | 本会话两轮实跑 |
| 6 | Playwright 29 failed/3 passed | 2026-08-13 历史实测,docs/11:575 已登记、修法归 T19 工作线;**当前未重跑**,不能代表当前全套件健康度。历史档案另有 9/16、M1 定向 8/8 等不同分母 | docs/11-ui-spec.md:575;journal:1217-1221,1276-1287 |
| 7 | emoji 门禁绿依赖脏工作区修改 | 成立(HEAD 版实跑命中 assets/brand/saydo.icns 二进制误扫,工作区版加 icns 排除后绿)。注意:这是二进制误扫,不等于源码含 emoji;修法宜通用跳过二进制规则 | 双版实跑;git diff |
| 8 | 8 月 docs/plan 唯一新文件=UI 审计 | 过宽:8-13 23:17 又落 docs/plan/2026-08-13-deepseek-harness-borrowing-assessment.fable.md(未追踪);git log --diff-filter=A 也看不到未追踪文件。准确表述:唯一排产源(PLAN-2)停在旧快照,8 月临时轨道没有跨轨映射 | ls 实测;PLAN-2:4 |
| 9 | 门是瓶颈不是建造 | 压扁了仍在施工的工程(W5-W9 未实施、生产壳/源白名单/夹具未完成、M1 只验证了真实 daemon 下行)。改:首发主体收口;体验工程、生产壳与真实价值证据仍在建 | PLAN-2 W6-W9;store-status:31,146;journal:1279-1282 |
| 10 | B2 是本周唯一工程杠杆、范围已被 69/70 锁死、不依赖 owner | 外推过度:B2 是**移动评估壳范围内**唯一 Critical;70 号报告确实存在(8-13 22:50,未 git 追踪)且收窄了范围(B3 reload 降为顺手、en0 触发才做、09 GET 回写+RFC1918/横屏证据必做);但开批仍需 PLAN-2 纪律(owner 停点确认、HANDOFF 指针、合同门),LAN 竖切才不依赖 tailnet 拍板 | 70 号报告:1-4;PLAN-2:171-172;移动终稿:151-159 |
| 11 | 其余(HANDOFF 止于 97b01f7、v0.1.0 未打、runtime=ada7981c、三店占坑、5 件拍板) | 全部复核成立;runtime=ada7981c 是服务当前运行版本,不等同于四场已锁定 | 三路评审独立核验 |

## 2. 阶段判定(修正)

1. **7 月 = 首发主体期**(已收口):P0/P0.5、W1/W2/W4/W5a、R-A、A3-armed,发布前部署门通过。
2. **7-31 = 发布门断点**:场次①真人 failed,聚焦返工部署 ada7981c 后无真人复验;②③④未开;v0.1.0 未打。
3. **8 月 = 体验工程 + 对外准备期**:T16-T19/M1/D1/UI 批收口并推送 main;8-13 单日三战役(移动战略/商店占坑/UI 归一)。8 月批次统一边界不部署、不改常驻 runtime。
4. **未收口的三层仍在建**:体验层(T16-T19/M1 未部署、未过真人验收)、生产壳层(HTTPS/源白名单/签名/隐私清单未做)、价值证据层(dogfood 数据零积累)。

**判定**:首发主体收口;体验工程、生产壳与真实价值证据仍在建。当前瓶颈是门(真人验收 + owner 裁决 + 长周期合规),不是主体建造——但 8 月确实在持续造新的未收口工程,这正是发布线漂移的实体来源。

## 3. 缺口与阻断(按严重度)

### B1 · 四场真人验收悬空(发布门根因)

场次① failed@ada7981c(历史尝试 3 次:7-26/7-30/7-31),修复已部署,等 owner 从步骤 1 复验;②③④ not_run(② Touch ID 真人过卡+Tier1 两键;③ OctoBlog 逐节验收;④ Hopper/真 runner/精确 CI)。只有 owner 真人时间能关。

### B0 · v0.1.0 范围未裁决(B1 复验基线的前置)

- 机械事实:ada7981c 是 main 线性祖先,main 前移 270;若 v0.1.0=ada7981c,发布时点 ff-only 条件数学上不可满足(ff 只能前进不能后退)。
- 默认路径(先验更强):8 月批次纪律不部署、不改常驻 runtime 等价于 8 月工作不进当前发布候选,即 8 月=v0.2 前置;商店材料也写 spike 0.1、version SoT 未建。但没有任何文档把这个默认写成裁决记录。
- 需要的 owner 裁决:确认默认路径(8 月=v0.2,发布 target 重选或按 7-31 口径处理 main 漂移),还是把 8 月批次纳入 v0.1.0(部署新基线+四场从①重跑)。
- 注意:每多开一批 push main,漂移距离扩大一分(当前 270)。

### B2 · 移动真机进壳未施工(移动评估壳范围内唯一 Critical)

T19 向导硬门使真机 LAN/tailnet 停在 probe 门,MobileApp 永不挂载(本机窄窗/模拟器掩盖)。69/70 号评审收窄后的第 0 步:两刀竖切(remote-mobile 新 kind 直挂移动树 + 回前台去重,保留 iOS native-resume)+ 09 三条 GET 回写 + RFC1918/横屏真机证据;B3 reload 降为顺手、en0 触发才做。LAN 竖切不依赖 tailnet 拍板;按 PLAN-2 开批纪律需 owner 停点确认。

### B4 · 排产与状态权威失效

- HANDOFF 止于 7-31(97b01f7),批次指针为空但多战役并行;
- PLAN-2 停在 W5a,W5 剩余/W6-W9/R-B/R-C 未做也未正式取消;8 月临时轨道(T/M/D/移动/上架)无跨轨映射;
- 三战役各有 SoT,无现在轮到谁施工的权威答案。

### B5 · 工程红点与收口卫生

- lint:8-13 22:20 快照 8 errors;**当前 HEAD(c5148ab)重跑仍 8 errors**(SetupWizard 7 unused + setupWizardUx.test.tsx:199 表达式);
- emoji 门禁:HEAD 版命中 icns 二进制误扫(修法建议:通用跳过二进制);
- Playwright:29/3 为 8-13 历史实测,已登记、修法归 T19 工作线,未修;
- UI 批无 chore(evidence) 提交;工作区当前 27 项未提交/未追踪(含上架战役产物、移动评审产物、本分析三路评审产物、docs/plan 新评估文件)。

### B6 · 上架线:已占坑,长周期在途

已占:三店应用记录、域名、Bundle ID、证书、ICP 备案初审(订单号私存,待来电+工信部 24h 核验)。
**长周期关键路径(应立即并行启动,不依赖移动线)**:软著 50-75 工作日(加急 7-15,材料未生成);App Store en-US 精确名 SayDo 被占(中文店名「说到」已占,en-US 后缀待定);加密豁免未核;EU DSA 待决;AGC 域名未登记;鸿蒙 Profile .p7b 未建;审核夹具(Mac mini)未建。
不可提审硬原因:无生产配对/信任层、明文 LAN、夹具未执行——其工程前置是 B2+冻桥+R-B,但**软著/备案/店名/夹具等长周期件与工程前置无关,应并行**。

### 补充缺口(评审新增,C 级)

- **dogfood 价值证据零数据**:value-report 北极星与触发线读数自项目启动零积累(场次②是价值轨起点,not_run)。对外准备跑在价值证据之前。
- **R-B 同链提醒**:PLAN-2 的 R-B(生产配对五件套)既是 W6 排产债、又是 B6 商店硬门(无生产配对/信任层)的工程前置——同一条链,不是两条债。
- **tailnet 外部阻断**:Tailscale 系统扩展 activated waiting for user(HANDOFF §2-12),是并行外部阻断,不阻塞 LAN 竖切。
- **评审开销反思**:R62-R69 跑了 30+ 次 Codex 对抗审(如 R69 单次 25.4 分钟),发布门真人进展为 0——评审密度与发布门进展不对称,注意力被体验工程吸走。
- **已接受的 C 级残余**:config-project-overrides 同毫秒 ULID 反序(单文件 10/10 复跑绿,留 rowid 去抖);外部进程越过 setup 并发改 pending 的 TOCTOU(56 号终审保留 C=1)。均不升发布阻断,明确记已接受。

## 4. 核心问题与行动序(三路评审合流版)

**核心问题**:B1(发布门根因)与 B0(复验基线裁决)并列,均压在 owner 真人时间上;dogfood 价值证据零数据应与其同层供 owner 排序。B2 是工程侧本周可并行的施工,不是全项目唯一杠杆。

### 行动序(Codex 71 建议,采纳)

1. **owner 决策先行(异步,不阻塞工程)**:v0.1.0 范围/target(vs 默认 8 月=v0.2)+ 本周必答 2 条;长周期件(软著/en-US 后缀/EU DSA)同步给材料。
2. **最小 B4 治理**:恢复 HANDOFF 当前批次指针、写清 PLAN-2 与 8 月临时轨道的跨轨关系、把 B0 裁决记录落账。半天级,是后面一切开批的前提。
3. **B5a 门禁/evidence 转绿(在选定范围上)**:lint、emoji 门禁通用修法、UI 批 evidence 补交。完成后才允许 pin 干净 HEAD。
4. **约场次① 与 B2 LAN 竖切并行**:完成 target 与 preflight 后立即约①(与 ②③④ 依赖推进);同时按 PLAN-2 纪律开 B2 批(owner 停点确认 + 合同门),补 RFC1918/横屏真机证据。
5. **长周期并行收口**:软著材料、ICP 核验、夹具、B5b(工作区分类/授权推送/归档)。

顺序逻辑:先定靶再转绿再开批;owner 真人时间是稀缺资源,场次不能排到所有工程之后;软著等长周期不能等移动线。

## 5. owner 决策清单(分组)

**本周必答(2 条)**:
1. v0.1.0 范围:确认默认路径(8 月=v0.2、发布 target 重选)还是纳入 8 月批次(部署新基线+四场从①重跑)(B0);
2. tailnet 是否纳入 remote-mobile(决定第 0 步验收口径;不拍板则本周只认 LAN)(B3-1)。

**触发线后(3 条,移动终稿已标)**:
3. 设计 ADR-003 载体回写(B3-2);4. 鸿蒙通道化(B3-3);5. CallKit 商业面 + 壳内 demo mode(B3-4/5)。

**长周期材料件(可随本周给料)**:
6. App Store en-US 店名后缀;7. EU DSA 申报取向;8. 软著加急与否;9. 加密豁免核验授权。

**例行授权(非裁决,单列)**:工作区收口提交与推送、B2 开批停点。

## 6. 证据锚(2026-08-13 23:35 +0800 实测,除非标注快照)

- HEAD=origin/main=c5148ab(feat/t20-fusion-layout);origin/main..HEAD=0;HEAD..origin/main=0(git fetch exit 0 后实采)。
- ada7981c..HEAD=270;ada7981c..origin/main=270;ada7981c 是 origin/main 的线性祖先(merge-base 实测)——基线漂移 270,非分叉。
- 历史快照(8-13 22:20 前):origin/main..HEAD=11;ada7981c..HEAD=268;ada7981c..origin/main=257。
- lint:8-13 22:20 快照 8 errors(SetupWizard.tsx:38,41,44,213,715,1013,1103 + setupWizardUx.test.tsx:198);当前 HEAD(c5148ab)重跑仍 8 errors(测试文件行号 199:66)。
- 场次:e2e/owner-sessions/session-1.md:54-59(①failed@ada7981c);session-2.md:78-84、session-3.md:54-60、session-4.md:85-92(not_run);runtime-deploy.md:17-27(开场 target 必须为 origin/main 后代 + ④后允许纯 evidence 子提交);session-4.md:77-79(ff-only 与 v0.1.0 tag 纪律,场次④ pass 后条件)。
- 门禁:HEAD 版 scripts/check-emoji.sh 实跑 exit 1(assets/brand/saydo.icns 二进制误扫);工作区版(diff 仅 icns 排除)exit 0。
- Playwright:docs/11-ui-spec.md:575(2026-08-13 历史实测 29 failed/3 passed,修法归 T19 工作线);journal:1217-1221(9/16)、1276-1287(M1 定向 8/8)。
- 移动:mobile-gap-audit.fable.md:25-29(体检范围内唯一 Critical);mobile-shell-strategy-final.fable.md:78-105(第 0 步)、151-159(LAN 不依赖 tailnet);70 号报告(8-13 22:50,未 git 追踪,B3 降顺手/en0 触发才做)。
- 上架:store-submission-status.md(三店占坑、ICP 订单号私存、en-US 被占、DEC-9);app-materials.md:32-43(软著 50-75 工作日,加急 7-15)。
- 排产:HANDOFF.md 末次提交 97b01f7(7-31);PLAN-2:53(W5a 收口)、74-100(W6-W9 无状态)、171-172(开批纪律);docs/plan 8-13 新增两文件(UI 审计已追踪 + deepseek-harness 评估 23:17 未追踪)。
- 价值证据:session-2.md:65,78-88(价值轨起点,not_run);PLAN-2:21(dogfood 价值优先)。
