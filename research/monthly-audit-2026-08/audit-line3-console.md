# 审计报告 · Line 3「console/UI」工作线 commit↔文档 双向对照

- 审计日期:2026-08-27
- 审计员:零上下文独立会话(只读;未修改/新建仓库正式文件,未 git add/commit)
- 仓库状态:`main` @ `f723ab7dd3f71cc6e6c3a4949e34e80ce22b695c`(本会话 `git log -1` 实测)
- 输入:commit 清单 `scratchpad/line3-console.txt`(111 条,08-04 ~ 08-20)
- 锚定文档:`docs/11-ui-spec.md`(589 行)、`docs/plan/2026-08-13-ui-standardization-audit.md`(198 行)、`docs/10-voice-ux-spec.md`(185 行)、`docs/modules/d-presentation.md`(23 行);过程日志 `history/PROCESS-JOURNAL.md`(2976 行)、批次台账 `history/DEV-VERSION-LEDGER.md`

**结论速览:A 级 2 条,B 级 3 条,C 级 4 条。** 整体判断:该线的**代码↔审计清单一致性极好**(ui-standardization-audit 七类整改逐条复核全部落地、零回潮),**commit↔journal/台账归属完整**(111 条全部可归属到有名载体的批次);漂移集中在 **canonical 规范文本未跟上 8 月上中旬的壳层/语音层实施**——正是本线预期的高发漂移型。

---

## 0. 方法与总量核验

1. **commit 清单全量核验**:111 个 hash 逐个 `git merge-base --is-ancestor <h> main`,全部通过(输出静默 = 全在 main;本会话实测)。
2. 文档→实现(Part A):以 `docs/11-ui-spec.md` 各节与 `2026-08-13-ui-standardization-audit.md` 逐条主张为基准,对 `packages/console/src` 与 `e2e/console` 用 rg/grep/读文件实证。
3. 实现→文档(Part B):111 条 subject 分 13 簇,逐簇核对 journal(R84 补录索引 + R64-R74)/台账(DEV-VERSION-LEDGER §2 时代 V-VII)/evidence 载体;抽 11 个重要 commit 读 diff 与规范比对。
4. 纪律:所有断言均来自本会话真实命令输出;未验证处显式标「未核实」。

---

## 1. Part A · 文档→实现 核对结果

### 1.1 `2026-08-13-ui-standardization-audit.md` 整改条目逐类复核(全部落地)

| 审计类别 | 声称处置 | 本会话复核命令与结果 | 判定 |
|---|---|---|---|
| A/B 类:桌面写死 hex/rgb 58 处 | 全部换 token | `rg '#[0-9a-fA-F]{3,8}\b'` 排除 tokens.css/test/fixture → **hex-count: 0**;`rgba?\(` 排除 color-mix → 0 命中 | 落地 |
| C 类:幽灵 token 19 行/8 个变量 | 换真 token | used-vs-defined `comm -23` 差集(175 used vs 201 defined,3 个 css 定义源)→ **空**(零幽灵) | 落地 |
| D 类:backdrop-filter 5 处 | 全删 | `rg 'backdrop-?[Ff]ilter'` → **0** | 落地 |
| E 类:非 token 圆角 38 行 | 换刻度/pill;真圆 50% 保留 | `rg 'borderRadius: *[0-9"]'` 排除 var(--) → 仅剩 4 处 `"50%"` 真圆(GlobalSettings.tsx:270 等)+ 共 7 处 50%,与「真圆可保留」清单一致 | 落地 |
| F 类:非 token 阴影 5 处 | 换 token | 含于 A/B 类 rgba 扫描,0 命中 | 落地 |
| G 类:mobile.css 字面色 36 行 | 收进共享 token | mobile.css 未被排除的 hex/rgba 扫描 0 命中 | 落地 |
| §5 token 三层归一 | tokens.css 唯一定义源 | tokens.css 含矿彩层(`--paper/--ink/--ochre/--indigo/--pine/--seal/--rule`)+ 夜色层(`--night-*`)+ 语义层;`--brand-seal: var(--seal)`(tokens.css:244)等 | 落地 |
| §7 圆角刻度 md/lg/xl → 10/12/14 | 改值 | tokens.css:51-61 实测 `2xs:4/xs:8/sm:10/md:10/lg:12/xl:14/pill:999` + ledger 三档,与 docs/11 §2.3 逐值一致 | 落地 |
| §2.7a 门禁 | 接入 ci:node + justfile | `package.json:14` 与 `justfile:17` 实测含 `check-hardcoded-colors.mjs` + `test-color-gate.mjs`;白名单 `ALLOW_RE = /tokens\.css$/`(check-hardcoded-colors.mjs:12,mobile.css 不豁免,与 §2.7a 一致) | 落地(命令路径 .sh→.mjs 演化见 C1) |
| §9 复核批:按钮圆角收 xs、卡片收 md、7 个零消费 token 退役 | — | `shared.tsx:173` Btn=`--radius-xs`;`shared.tsx:10` card=`--radius-md`;`ui.tsx` PaperCard=`--radius-md`;`--color-*-border`/`--fg-on-fill-dim` 等只存于矿彩层(幽灵差集为空反证无悬空引用) | 落地 |
| 玻璃旧名 238 处消灭 | 全仓改名 | `rg -e '--surface-glass' -e '--glass-border' -e '--glass-blur' -e '--control-glass' packages/console/src` → exit 1(零命中;落盘文件 wc=0 复核,规避管道退出码陷阱) | 落地(238 数字为历史计数,未复算) |

未核实项:audit §11「浏览器实拍留证」的截图文件位置未查证;§0 施工前基线「194 passed / 25 files」与各 commit 自述测试数(「892 tests 全绿」等)未重跑。

### 1.2 `docs/11-ui-spec.md` 结构性主张抽查

| 规范主张 | 实证 | 判定 |
|---|---|---|
| §2.6 状态 chip 16 呈现态四联映射、单源组件 | `StatusChip.tsx:33-50` CHIP_TABLE 恰好 16 键,键名/文案/色调/图标与 §2.6 表逐行一致;`CHIP_TABLE` 全仓仅此一处(rg -l 单文件) | 一致 |
| §2.7 盖章判定线(9 个「是盖章」动作) | `rg 'variant="seal"'`:批准/按我改的签新收据/可以发(Modals.tsx:72,91,215)、记(ConfirmCard.tsx:73)、拍板,开始(DecisionPackageCard.tsx:151)、通过(ReviewPanel.tsx:199)、这一步行,继续/拍板:切到 API 计费(TaskCard.tsx:53,60);`btnCommit` 在 SetupWizard.tsx:236(全用它,启动:1613)与 TaskModal.tsx:94 | 一致 |
| §5.1(第二个)redesign 组件登记「16 组件+4 页」 | `components/redesign/` 现 17 个组件 tsx(08-09 时 16 个;第 17 个 DemoFrame 为 08-20 新增,见 B2)+ `pages/redesign/` 四页齐;ExpectationGroup 已接入 FocusPage.tsx:259,ExpectationDriftCard 仅在 DevComponents(与「DriftCard 不接入/接线归消费批」注一致) | 一致 |
| §5.6b 移动路由表 | `mobile/router.ts:16-31`:`/m`、`/m/things`、`/m/focus/:id`、`/m/lane/:f/:l`、`/m/card/:kind/:id`、`/m/chat` 全在;composer placeholder=「用键盘上的话筒说话」(MobileChrome.tsx:99) | 一致 |
| §5.8a remote-mobile 仅 `mobile_lan_route_rejected` 进壳 | `SetupBootstrapBoundary.tsx:12,27,151,168-178` 逐句对应(直挂 MobileApp、不走 AppContent/桌面 Layout) | 一致 |
| §5.8a 融合页:单浮层/absolute 浮层/预置表/骨架卡/busy 锁 | SetupWizard 单一 `overlay` state(:934,FusionOverlay);ModelCombo.tsx:178-182 absolute + `--z-setup-overlay`;`CLI_PROVIDER_CONTRACT`(setupApi.ts:861)cursor/codex/gemini 槽预置值与 §5.8a 表逐值一致 | 一致 |
| §5.10 输入区四态×双动作 | Chat.tsx:204-205 `"idle"|"recording"|"transcribing"|"confirm"` + A/B 双动作注释与实现、B 档覆盖基线守卫(:250,:372-384) | 一致 |
| §3「待你处理」排序(呈现层二次排序) | Today.tsx:52-66 `sortOrange`(task>confirmation>前置已终止>obligation>其余)+ Today.sort.test.ts;daemon attention.ts 实证 orange task 只出 `ready_for_review`(:124-152)、blocked 以 obligation+title 前缀下发(:201-234)——五档语义成立 | 一致 |
| §3 紧凑模式 data-density | Layout.tsx:346-347 + tokens.css:79 | 一致 |
| §12 e2e「2026-08-23 实测 35 passed」 | 未重跑(需 global-setup 起真 daemon 写 `.runtime.json`,`--list` 无夹具即 ENOENT,属环境前置非反证);静态计数现 36 个 `test(`,多出的 1 个来自 8941e1c(08-27 w54b 修复批,晚于该声明日期)——口径自洽 | 声明与当日口径相容(未复跑) |
| §5.8/§5.8a 其余抽查 | 7431fb2 diff 实证「秒数只留进度行」与 §5.8a「四步进度+已用时长在启动区原位」相容;「不提供跟回入口」「未就绪 provider=null 不展示测一发」等均能在 subject/代码对应 | 一致 |

---

## 2. Part B · commit→文档 分簇归属核对

111 条全部归属成功;载体文件均实测存在。簇表(行号=清单行):

| 簇 | 清单行 | 代表 commit | 记录载体(实测存在) | 核对结果 |
|---|---|---|---|---|
| 1. Focus 合同 v0 M1-M3 | 109-111 | ac659dc/a876037/3a0afc0 | `e2e/evidence/focus-contract-batch.md`(M1+M2 与 M3 两节,hash 与清单一致);台账时代 V 行 | 一致 |
| 2. E2/dogfood 修复串(F/J/K/L/M/N/W 系) | 78-79,81-87,95-108 | 至 c00f09f | 同上 evidence E2 节 + E2 证据提交 `fe8a85e`(实测存在)+ 提交信息;ef171b9/8b74430/b490713 ancestry ≤ c00f09f 实测 | 一致 |
| 3. focus 批 0-4 | 89-94 | f2753ed…820218d | **提交信息自述**(台账明示「提交信息(grok 施工/既白验收)」) | 一致但证据薄(见 C4) |
| 4. redesign B1 | 63-77(15 条) | 391f21a…4ce320b | `HANDOFF-前端组件化施工交接.md`(§3 props 合同)+ `HANDOFF-2`;台账行(merge 254491d/6d3c050) | 一致 |
| 5. focus-v04 批①-④ | 54-62(9 条) | 45788aa…48cfc8b | docs/09 §15.1 回写 `9b8c7e9`;段末 `12d3474`(9 条 ancestry 全过) | 一致 |
| 6. L1-L5 + 壳对齐 + 心跳/screen_text | 46-53(8 条) | 72d5ce6…bec5efb | `HANDOFF-3`;段末 `4d41775`(8 条 ancestry 全过) | 一致 |
| 7. onboarding 向导三步 | 43-45 | 8ad9e5e/6573490/6cbcd46 | 段末 `862d921`(ancestry 全过) | 一致 |
| 8. 首启门禁+画像向导 | 41-42 | 18c1e33/e0bb23a | `HANDOFF-4`;段末 e0bb23a(18c1e33 ancestry 过) | 一致 |
| 9. 08-12 console 杂修 | 39-40 | 7abf7d4/075dd3c | 7abf7d4 ∈ voice-fix merge `6cd362d`;075dd3c ∈ iPad 批 `60d96ca`(均 ancestry 实测) | 一致 |
| 10. 08-13 T19/T20 向导+CLI 扩容+UI 标准化+品牌朱 | 5-38(34 条) | aa8034e/1b59da2/013d84b/af80b26/05f714c/55d61d2 各段 | 台账时代 VI 六行 + findings 65-68 + ui-standardization-audit | 一致(8a8247a 缝隙见 C3) |
| 11. remote-mobile w0 | 4 | addfd19 | R71-R73 + `e2e/evidence/remote-mobile-w0.md` + 台账时代 VII 行 | 一致 |
| 12. 看小样 + s2 返工 | 1-3 | 5c48eb4/2260033/93eb814 | 5c48eb4/2260033 ∈ merge `1a41b45`(s1-demo-wiring),93eb814 ∈ `aa2dffc`(s2-callback)——ancestry 实测;evidence `s1-demo-wiring.md`/`s2-callback-channels.md` 存在;IMPL-PROMPT-12/13、R84、2026-08-22-week-audit-ledger 均有记 | 一致(canonical 缺口见 B2) |

journal 空洞已由 R84(2026-08-21 补录,journal:1793-1820)一行索引清偿;R84 所引 14 个 hash 本会话逐个 `git log -1` 解析成功。

### 2.1 抽样 commit 深读(11 个)

| commit | 核对点 | 结果 |
|---|---|---|
| 391f21a 组件库基座 | types.ts TimelineItem 判别联合 vs HANDOFF §3(无 confirm/turn 成员) | 一致(types.ts:131-138;多一个 `note` 成员,对应八卡之 Note,HANDOFF §3 未列但属排产档非 canonical) |
| bdc4c50 四页拼装 | subject 的 OPEN QUESTION(Interview 卡无 TimelineItem 成员) | `pages/redesign/README.md:29` 如实登记「暂作页面级可选字段,归位待拍板」 |
| 4ce320b 正式路由切换 | 路由 diff vs 08 §6 修订 | `#/review/:tid`、`#/records/:fid`、legacy 路由与 08 §6:165(canonical 路由新增清单)一致 |
| 55d61d2 Light 换芯 | 「docs/11 §2.5 回写」声称 | 同 commit 触及 docs/11(38 行)+ tokens.css,属实 |
| 68388bb 品牌朱推广 | diff 中 seal 化按钮 vs §2.7 判定线 | 逐一命中「是盖章」清单;「不是盖章」类(发送/去验收等)未被 seal 化 |
| 45788aa + e9262a9 focus-v04 | DDL v26 + saga vs 09 §15.1 | `ddl.ts:740-766` confirmation_ledger;`live/confirm.ts`:expired-only 降格(:906)、`DOWNGRADE_STORM_DAILY_LIMIT = 5`(:170)+ 批量聚合(:595)、retry≥3→abandoned(:171-173,:517)、90 天清理 pending/failed 豁免(:415-430)——五项合同细节逐条与 09 §15.1 文本一致 |
| 8b74430 主容器 1200→1600 | Layout.tsx diff + docs | 只改代码未回写 docs/11 §3(见 A1) |
| 3918eef 宣纸通底 | 侧栏/顶栏 `--surface-glass-strong/soft` → `--bg-app` | 只改 Layout.tsx 零 docs;与后续 §2.5 回写冲突(见 A2) |
| addfd19 remote-mobile | 「回写合同」声称 | 同 commit 触及 docs/11(9 行)+ docs/09,属实;代码与 §5.8a 文本逐句对应 |
| 5c48eb4/2260033 看小样 | DemoFrame 实现 vs canonical | 代码+IMPL-PROMPT-12+site 文档齐;docs/11 零提及(见 B2) |
| 7431fb2 启动忙态 | 「计时只留进度行」vs §5.8a | diff 实证秒数保留在进度行,§5.8a「已用时长在启动区原位」仍真,无漂移 |

---

## 3. 发现清单

### A 级(错误/不一致)

**A1 · docs/11 §3 外壳描述停留在 08-05 前的旧壳,且与其自称对齐的 08 §6 矛盾**
- 主张:canonical UI 规范 §3 的外壳/IA 描述已失实约 3 周,并在 08-13 被编辑过的情况下仍未修正。
- 证据:
  - `docs/11-ui-spec.md:313`:「左侧栏(…分"当前项目/全局"两段,**项目切换器置顶**)+ …内容区(**最大宽 1200px** 居中…)」;§3 标题自称「与 08 §6 对齐」。
  - 实现:`Layout.tsx:801` `max-w-[1600px]`(来源 `8b74430` 08-06「主容器 1200→1600」,该 commit 只改 2 个代码文件零 docs);`Layout.tsx:2,450-576` 侧栏实为「开口聊 CTA/今天/全景看板/正在持续的事/记录/旧版折叠」树,项目选择器已沉底(`ef171b9` 08-05 壳层主轴倒置、`a8ed29f` 08-08 侧栏新树)。
  - `docs/08-module-design.md:165-166` 自身已于 08-08/08-09 写入新 IA 修订与「新 IA 已全量上线」进度注——11 §3 与之直接矛盾。
  - `git log -L 313,313` 显示该行最后由 `ec2423b`(08-13 UI 标准化回写)编辑过(只换了 token 语言),旧 IA 事实原样保留。
- 定级理由:不止「未同步」——canonical 文档间互相矛盾 + 该行在实施后被主动编辑过仍保留错误事实。
- 建议处置:重写 11 §3 外壳段(侧栏树、默认路由 `#/today`、内容区 1600、项目选择器去向),或将 IA 细节改为纯指针指向 08 §6 并只留视觉参数。

**A2 · docs/11 §2.5 `--surface-raised` 用途「顶栏/侧栏」在回写当日即为假**
- 主张:§2.5 语义 token 表把顶栏/侧栏列为 `--surface-raised` 消费者,但同日早间代码已把两者改为 `--bg-app` 宣纸通底;回写发生在改动之后,属写入时即错。
- 证据:
  - `docs/11-ui-spec.md:147`:「`--surface-raised` … 用途:顶栏/侧栏/模态/浮层」。
  - `3918eef`(2026-08-13 09:59,「侧栏与顶栏宣纸通底」)diff:侧栏 `--surface-glass-strong`→`--bg-app`、顶栏 `--surface-glass-soft`→`--bg-app`;只改 Layout.tsx,零 docs。
  - `ec2423b`(同日 15:05)写入上述 §2.5 表;`git merge-base --is-ancestor 3918eef ec2423b` 实测成立(回写建立在已改代码之上)。
  - 现状:`Layout.tsx:416`(aside)与 `Layout.tsx:657`(header,注释即「顶栏同宣纸通底」)均为 `background: "var(--bg-app)"`;`--surface-raised` 对模态/浮层仍真。
- 建议处置:§2.5 该行用途改为「模态/浮层」(顶栏/侧栏注明宣纸通底 + 墨线/阴影分隔),并把 §3:313 的 `--surface-raised` 同步修正。

### B 级(疏漏/不足,含 spec 未同步实施)

**B1 · 浏览器系统级语音回退(40a607f)未回写 docs/10 §3-8 与 docs/11 §5.10**
- 主张:语音传输已是三态(cloud/system/unavailable),VOLC 未配但浏览器支持时话筒不再禁用而走 SpeechRecognition/speechSynthesis;canonical 两处仍写二态合同「ASR 未配置/不可用 ⇒ 话筒禁用 + 固定人话」。
- 证据:`voice/systemVoice.ts:1-10,55-63`(`VoiceTransport = "cloud"|"system"|"unavailable"`;文件唯一历史 commit=`40a607f` 08-13);`Chat.tsx:38` 仅 `unavailable` 才禁用;vs `docs/10-voice-ux-spec.md:141`、`docs/11-ui-spec.md:495`(「probe 表明 ASR 未配置/不可用时,『点击说话』与模式切换禁用」)。site 文档(`docs/site/2026-08-20-docs-page-content.fable.md`)已如实描述浏览器语音兜底,唯 canonical 未动;docs/10 自身规定「修改话术必须回写本篇」(:3),systemVoice.ts 携三条新话术常量(`VOICE_SYSTEM_NOTE` 等)。
- 建议处置:10 §3-8 与 11 §5.10 补三态合同与系统语音话术;明确「禁用」仅剩 unavailable 分支。

**B2 · 决策包「看小样」/DemoFrame(5c48eb4+2260033,08-20)未回写 docs/11 §5**
- 主张:新组件 + 新交互(iframe `sandbox=""` srcdoc 渲染、「在产物库查看」链接、看小样状态机)落地并入 evidence/IMPL-PROMPT/site 文档,但 canonical UI 规范零提及,违反其 §12 组件新增流程「无则自建并回写本篇 §5」。
- 证据:`rg '看小样|DemoFrame|demoRef' docs/11-ui-spec.md` → exit 1(零命中);`components/redesign/DemoFrame.tsx:1-30`(实现);§5.1 组件登记表「决策包卡」行(docs/11:510)与「实施状态(2026-08-09)」注(:503)均停在 08-09;载体齐备但都在 plan/evidence/site 层(`IMPL-PROMPT-12-S1-DEMO-WIRING.md` §3.3、`e2e/evidence/s1-demo-wiring.md`、week-audit-ledger 行 38/57)。
- 建议处置:§5.1 登记表补 DemoFrame 行(含 sandbox 零 allow、不放 token 进 URL 的红线),决策包卡行补「看小样」动作。

**B3 · docs/modules/d-presentation.md D1 停留在主轴倒置前(07-29 后未更新)**
- 主张:D 域模块详设仍写旧 IA,与 08 §6 修订、默认路由、侧栏实现三方矛盾。
- 证据:`d-presentation.md:7`「11 页全量:全局区(Dashboard/…)+ 项目区…+ 项目切换器」、`:10`「① Dashboard 即主入口」;`git log -- docs/modules/d-presentation.md` 最后一次改动 `f28489d`(2026-07-29 单仓合并);实现默认路由 `lib/router.ts:40`(`"/" → today`),Dashboard 已入「旧版」折叠组(Layout.tsx:555)。
- 建议处置:D1 节按 08 §6 修订重写职责/页面清单,或改为纯指针;它是本线锚定文档之一,不宜长期失实。

### C 级(观察)

**C1 · docs/11 §2.7a/§12 门禁命令写 `.sh`,CI 实际执行 `.mjs`**
- `docs/11:291,570` 写 `scripts/check-hardcoded-colors.sh`/`test-color-gate.sh`;`package.json:14` 与 `justfile:17` 实际跑 `.mjs`(`1482510` 08-22 Windows 对齐批引入);`.sh` 保留为 `exec node *.mjs` shim(本会话 cat 实证),文档命令仍可用。建议顺手更新为 .mjs 或注明 shim 关系。

**C2 · docs/11 存在两个 `### 5.1`**
- `:329`「5.1 按钮」与 `:499`「5.1 三面一栏新组件登记」编号撞号(后者物理位置在 5.10 之后)。外部引用「11 §5.1」(如 9b8c7e9 提交信息「11 §5.1 实施状态」)存在指代歧义。建议后者改号(如 5.11 或 5.0a)并全仓修引用。

**C3 · 08-14 三个收尾 commit 落在台账两行之间,无显式索引**
- `c5148ab`(08-13 自检同族降级说明)/`d039552`(删 PlanSlotList 死代码)/`8a8247a`(08-14 槽行换家 defaultSlotModels)按 ancestry 位于融合布局段(af80b26)之后、DeepSeek 批(789b76d)之前;台账时代 VI 无对应行(日期上仅被「品牌朱印…08-13~08-15」行的日期窗覆盖,但该行只列 ecdd1d2/55d61d2/b13b744 三码)。属一行索引纪律的粒度缝隙,非缺账——功能内容已由 §5.8a 预置表覆盖。
- 建议处置:可在台账该行或融合布局行补一句「+ 08-14 槽行换家收尾(8a8247a 段)」。

**C4 · focus 批 0-4(f2753ed…820218d)的记录载体仅为提交信息自述**
- 台账时代 V 如实声明「记录载体 = 提交信息(grok 施工/既白验收)」;「882/892 tests 全绿」等断言无独立 evidence 文档承载(与 M1-M3/E2 批有 `focus-contract-batch.md` 形成对比)。非隐瞒(台账已声明),但这些 commit 含看板主页/attention API/lanes 模型等大件,证据强度弱于同线其他批。本审计未重跑其测试(标注:未核实其测试数)。

---

## 4. 附:核验通过的「声称→属实」清单(防漂移的正面账)

- R84 补录索引 14 个 hash 全部 `git log -1` 解析成功;所指载体(`e2e/evidence/focus-contract-batch.md`、`HANDOFF-前端组件化/2/3/4`、`remote-mobile-w0.md`、`s1-demo-wiring.md`、`s2-callback-channels.md`、`fe8a85e` E2 证据提交)全部存在。
- 「回写」类 commit 声称逐一属实:`55d61d2`(docs/11 §2.5)、`addfd19`(docs/11+09)、`9b8c7e9`(09 §15.1/11 §5.1/08 §6)、`1b59da2`(向导合同收口)。
- focus-v04 合同五细节(v26 DDL/expired-only saga/日限 5/三败 abandoned/90 天豁免)代码↔09 §15.1 逐条一致。
- ui-standardization-audit 七类 + 复核批四项,当前代码零回潮。
- §2.6 十六态 chip、§2.7 盖章清单、§5.6b 移动路由、§5.8a 融合页与 remote-mobile、§5.10 四态双动作、§3 attention 排序(含 daemon 侧构成)逐项与实现一致。

## 5. 未核实事项(如实登记)

1. 各 commit 自述测试计数(194/871-892 tests、e2e 35 passed)未重跑;e2e 需 global-setup 起真 daemon,`--list` 因缺 `.runtime.json` 属环境前置而非反证。
2. audit §11 截图留证的文件落点未查。
3. §2.5「改名 238 处」为历史计数,未复算(现状零残留已另证)。
4. HANDOFF-2/3/4 内条目未逐条对账(仅确认存在与簇归属;L1-L5 逐条内容以 HANDOFF-3 为载体的声称未展开核对)。
