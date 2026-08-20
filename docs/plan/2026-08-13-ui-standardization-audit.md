# 全端 UI 标准化·规范化批 — 审计清单与处置

> 批次:2026-08-13。范围 `packages/console/src`(桌面 + 移动共壳),排除 `*.test.*` / `*.fixture.*`。
> 性质:排产/交接档案,**非 canonical**。规范真相源仍是 [`docs/11-ui-spec.md`](../11-ui-spec.md);本批结论已回写该篇 §2。
> 只做视觉规范层:不改布局结构、不改交互逻辑、不改移动字阶数值。

## 0. 方法与基线

扫描命令(全部在本会话实际执行):

```
rg -n -g '!*.test.*' -g '!*.fixture.*' -g '!tokens.css' -g '!mobile.css' '#[0-9a-fA-F]{3,8}\b' packages/console/src
rg -n -g '!*.test.*' -g '!*.fixture.*' -g '!tokens.css' -g '!mobile.css' 'rgba?\(' packages/console/src
rg -n 'backdrop-?[Ff]ilter|backdropFilter' packages/console/src
rg -n 'borderRadius:\s*(?!"var\()' -P packages/console/src | grep -v 'borderRadius: "var('
```

「幽灵 token」检出法:抽出 src 内全部 `var(--x)` 名,与 `tokens.css` + `mobile.css` 的定义名做 `comm -23` 差集。

施工前基线(本会话实测):`pnpm -r build` 四包绿;`pnpm --filter @saydo/console test` = **194 passed / 25 files**。

## 1. 汇总

| 类别 | 数量 | 涉及文件 |
|---|---|---|
| A 桌面写死色值(hex) | 48 处 | 10 个 |
| B 桌面写死色值(rgb/rgba) | 10 处 | 6 个 |
| C 幽灵 token(引用未定义变量,实际渲染 fallback) | 19 行 / 8 个变量名 | 3 个 |
| D `backdrop-filter` 引用 | 5 处 | 5 个 |
| E 非 token 圆角 | 38 行 | 12 个 |
| F 非 token 阴影 | 5 处 | 4 个 |
| G `mobile.css` 内字面色(token 块之外) | 36 行 | 1 个 |

移动端 TSX **零内联样式**(`rg 'style=\{\{' packages/console/src/mobile` 无命中),色彩全部集中在 `mobile.css`,是本批唯一需要处理的移动面。

## 2. A/B 类 — 写死色值逐条处置

### 2.1 球权四色三处复制(最大一块)

`orange/blue/green/gray` 四色在三个文件各写死一份,且用的是**换芯前的旧色**(Tailwind 系 `#d97706/#3b6ef6/#16a34a/#98a2b3`),与纸上账本矿彩(赭石 `#a8641f` / 黛蓝 `#3c5f96` / 松绿 `#41755a` / 暖灰)完全不同族——这是「桌面看着不像同一本账」的主因。`AttentionItemCard.tsx:10-15` 早已改成 token 映射,是正确先例。

| 文件:行号 | 现值 | 处置 | 目标 |
|---|---|---|---|
| `pages/Board.tsx:12-17` | `BALL` 四色 hex | 换 token | `--color-warning` / `--active-ink` / `--color-success` / `--text-faint` |
| `pages/Chat.tsx:115-124` | `ENTITY_COLOR` 八键 hex(四色 + act/wait/start/ext 别名) | 换 token,别名保留映射关系 | 同上 |
| `pages/FocusDetail.tsx:113-118` | `BALL` 四色 hex | 换 token | 同上 |
| `pages/FocusDetail.tsx:120-124` | `ACTOR_BAR` 三色 hex(`#ea580c`/`#16a34a`) | 换 token | user=`--color-warning`,daemon/brain_proposal=`--color-success` |
| `pages/FocusDetail.tsx:663,871` | `?? "#98a2b3"` 兜底 | 换 token | `--text-faint` |

### 2.2 幽灵 token 的 fallback 色(C 类同源,一并列出)

这些 `var()` 引用的变量**在两份 token 文件里都不存在**,所以浏览器实际渲染的是逗号后的写死 fallback——等于绕过 token 体系写死色,且值是玻璃/Tailwind 时代的。`TaskModal.tsx:71-73` 的注释已记录义骁 8/6 实测「弹窗跟背景一样暗」正是这个坑,但只修了一处。

| 文件:行号 | 现值 | 实际渲染 | 目标 token |
|---|---|---|---|
| `pages/FocusDetail.tsx:258` | `var(--border-default)` **无 fallback** | 未定义 ⇒ 退化为 `currentColor` 描边 | `--line` |
| `pages/FocusDetail.tsx:597` | `var(--bg-app, #fff)` | `--bg-app` 有定义,fallback 死码 | `--surface-raised`(浮层应为抬升纸面,非画布色) |
| `pages/FocusDetail.tsx:798` | `var(--bg-elevated, #fff)` | `#fff` 纯白 | `--surface-raised` |
| `pages/FocusDetail.tsx:647,677,708,742,751,757,918` | `var(--text-tertiary, #98a2b3)` ×7 | `#98a2b3` 冷灰 | `--text-faint` |
| `pages/FocusDetail.tsx:669,877` | `var(--glass-bg, rgba(0,0,0,0.03))` | 冷黑洗 | `--surface-ink-wash` |
| `pages/Chat.tsx:152,537,561,582,591` | `var(--status-warn, #d97706)` ×8 | 旧橙 | `--color-warning` |
| `pages/Chat.tsx:451` | `var(--bg-subtle, rgba(59,110,246,0.08))` | 旧蓝洗 | `--active-ink-wash` |
| `pages/Chat.tsx:487` | `var(--color-error, #b91c1c)` | `--color-error` 有定义,fallback 死码 | 去 fallback |
| `components/TaskModal.tsx:109` | `var(--bg, transparent)` | 透明输入框 | `--surface-control` |
| `components/TaskModal.tsx:421` | `var(--danger, #dc2626)` | 旧红 | `--color-error` |

### 2.3 其余散点

| 文件:行号 | 现值 | 处置 | 目标 |
|---|---|---|---|
| `pages/redesign/{Focus,Board,Review,Records}PageRoute.tsx` | `var(--surface-glass-strong, #1a1a1a)` ×4 | 去 fallback + 改名 | `--surface-raised` |
| `pages/redesign/FocusPageRoute.tsx:29` | `boxShadow: 0 8px 24px rgba(0,0,0,0.2)` | 换 token | `--shadow-card-hover` |
| `pages/TaskDetail.tsx:485` | `color: "#fff"`(选中态裁决按钮) | 换 token | `--fg-on-fill` |
| `components/StatusChip.tsx:93` | `color: "#fff"`(S3 徽章) | 换 token | `--fg-on-fill` |
| `components/TaskModal.tsx:60` | `background: rgba(0,0,0,0.45)`(遮罩) | 换 token | `--scrim` |
| `components/TaskModal.tsx:74` | `var(--bg-app, var(--surface-glass-strong, #fff))` | 简化 | `--surface-raised` |
| `components/TaskModal.tsx:77` | `0 16px 48px rgba(0,0,0,0.28)` | 换 token | `--shadow-modal` |
| `components/redesign/Modals.tsx:39` | `background: rgba(18,22,31,0.32)`(遮罩) | 换 token | `--scrim` |
| `pages/Board.tsx:774` | `background: rgba(16,24,40,.35)`(遮罩) | 换 token | `--scrim` |
| `pages/FocusDetail.tsx:602,803` | `0 8px 24px rgba(0,0,0,0.12)` | 换 token | `--shadow-card-hover` |
| `pages/Chat.tsx:561` | `color: "#fff"` | 换 token | `--fg-on-fill` |

三处模态遮罩三个不同的黑(`rgba(0,0,0,.45)` / `rgba(16,24,40,.35)` / `rgba(18,22,31,.32)`),移动端第四种(`rgb(52 51 46 / 42%)`)——归一到单一 `--scrim`(Light 取移动端的松烟墨遮罩)。

## 3. D 类 — `backdrop-filter`(玻璃时代核心残留)

| 文件:行号 | 现值 | 处置 |
|---|---|---|
| `components/ui.tsx:15` | `blur(var(--glass-blur)) saturate(1.4)` | 删除;`GlassCard` → `PaperCard` |
| `components/redesign/shared.tsx:12` | `blur(var(--glass-blur)) saturate(1.4)` | 删除 |
| `pages/Board.tsx:305` | `blur(var(--glass-blur))` | 删除 |
| `pages/Board.tsx:791` | `blur(var(--glass-blur))` | 删除 |
| `pages/Today.tsx:261` | `blur(var(--glass-blur))` | 删除 |

`--glass-blur` token 随之删除。Light 侧同步把半透明纸面改实底(见 §5),Dark 侧数值不动——Dark 画布是近匀色 + 极弱径向渍,对近匀背景做模糊本就近似恒等,去 blur 不破版。

## 4. E/F 类 — 非 token 圆角与阴影

**圆角**(38 行)分三类:

- **应换 pill**(`999`/`99` 字面量,10 行):`FocusDetail.tsx:237,704,910`、`Board.tsx:398`、`Today.tsx:404`、`Layout.tsx:180,605,625,646`、`TaskModal.tsx` chip → `var(--radius-pill)`。
- **应换刻度**(`8`/`6`/`4`/`3`/`2`/`24`/`10` 字面量,15 行):`FocusDetail.tsx:599,670,697,713,800,878,898,926`、`Chat.tsx:148,453,668,825`、`Layout.tsx:225,387`、`SetupGate.tsx:43`、`Modals.tsx:258,261`、`shared.tsx:128-129` → `--radius-2xs/--radius-xs/--radius-sm`。
- **真圆(`50%`)可保留**:`GlobalSettings.tsx:186`、`SetupWizard.tsx:380`、`SetupGate.tsx:143`、`DevPages.tsx:30`、`shared.tsx:147`、`ReviewPanel.tsx:27`、`RecordsPanel.tsx:22`、`AttentionItemCard.tsx:65,109` 等——圆形是几何不是 token,不入门禁。

**阴影**(5 处)全部在 §2.3 表内已列。

另:桌面圆角刻度本身偏「玻璃圆」(`md=14 / lg=18 / xl=24`),与移动 2–10px 纸感圆角不同族——本批把三档收到 `10 / 12 / 14`,语义槽位(控件/行/卡片/面板/模态)不动,见 §5。

## 5. token 归一方案(施工②的设计)

分三层,`tokens.css` 是唯一定义源:

1. **矿彩原色层(`:root`,不随主题变化)** — 纸上账本定稿色的唯一字面量出处:`--paper` `#f0ede4`、`--paper-card` `#faf7ef`、`--paper-raised` `#fcfaf4`、`--ink` `#34332e`、`--ink-secondary` `#5b564b`、`--ink-muted` `#706b61`、`--ink-gray` `#8b8578`、`--ink-faint` `#a29b8f`、`--ochre` `#a8641f`、`--indigo` `#3c5f96`、`--pine` `#41755a`、`--seal` `#b13a2b`、`--rule` `#cec6b7`,以及 `--fg-on-fill` / `--fg-on-seal` 两个反白前景。
2. **语义层(Light 消费矿彩 / Dark 覆盖夜色)** — 表面、文字、交互态、语义四态、品牌朱、线与影。
3. **消费层** — 移动 `--m-*` 全部改成指向**第 1 层**的别名(不是指向语义层),因为 M1 移动壳无暗色设计,必须在 `data-theme=dark` 下仍是纸;若别名指向语义层,切暗会把手机也拖成夜色。这是对交接稿「`--m-ink: var(--text-primary)` 式别名」的一处有理由的偏离,归一目标(单一定义源、零独立色值)照样达成。

桌面改名(玻璃语言 → 纸语言,共 **238** 处机械替换;下表「出现数」是 `rg` 的前缀计数,嵌套名互相包含——`--surface-glass` 的 42 含 strong 20 与 soft 9,`--glass-border` 的 160 含 bright 6,去重后为 238):

| 旧名 | 新名 | 出现数 |
|---|---|---|
| `--surface-glass` | `--surface` | 42 |
| `--surface-glass-strong` | `--surface-raised` | 20 |
| `--surface-glass-soft` | `--surface-soft` | 9 |
| `--control-glass` | `--surface-control` | 36 |
| `--glass-border` | `--line` | 160 |
| `--glass-border-bright` | `--line-soft` | 6 |
| `--glass-blur` | (删除) | 6 |
| `--surface-ink-wash` | (不改,已是纸语言) | 21 |

顺带修一个真 bug:`--glass-border-bright` 在 Light 是 `rgba(255,253,247,.85)`(近白高光,玻璃时代的内高光配方),画在宣纸上**几乎不可见**——`shared.tsx:60` StageTag 的虚线框与 `RecordsPanel.tsx:21` 的连接线因此是隐形的。改名后 `--line-soft` 取暖灰软线。

## 6. G 类 — `mobile.css` 内字面色(36 行)

全部按语义收进共享 token,`mobile.css` 内不留任何字面色。归并结果:

- 反白前景 6 种(`#f7f1e7` / `#fff8ed` / `#fff9ee` / `#fffaf0` / `#f1eee4` / `#e8f0fa`)→ 归并为 `--fg-on-fill` `#fffaf0`、`--fg-on-fill-dim`、`--fg-on-seal` `#fff8ed` 三个。逐通道差 ≤8/255,肉眼不可辨。
- 纸面半透明 4 档(72% / 62% / 66% / 88%)→ `--surface-soft` 与 `--surface`。四档在宣纸上的实际渲染值互差 ≤1/255。
- 语义色淡边/淡底(赭石 42%/58%/5%、松绿 42%、印泥朱 42%/6%)→ `--color-warning-border` / `--color-warning-wash` / `--color-success-border` / `--color-error-border` / `--color-error-wash`。
- 阴影 4 种 → `--shadow-card`(=原 `--m-shadow`)、`--shadow-soft`、`--shadow-ink`、`--shadow-drawer`。
- 格纹底线 `rgb(98 82 58 / 4%)` 与 `/3%` → 单一 `--rule-line`(取 4%)。
- 遮罩 `rgb(52 51 46 / 42%)` → `--scrim`。
- 票据不对称圆角 3 种(`3px 12px 4px 10px` / `2px 14px 3px 9px` / `2px 10px 3px 8px`)→ `--radius-ledger` / `--radius-ledger-lg` / `--radius-ledger-sm`,桌面票据类组件也可消费。

移动**五级字阶数值一个不动**(20/17/15/13/11 + 按钮 16/12),只把定义位置上移到共享层,其中 15/13/16/12 直接指向已有的 `--text-base/sm/md/xs`(值完全相同),20/17/11 作为共享层新增字面值。

## 7. 圆角刻度调整(③)

| token | 旧值 | 新值 | 语义(不变) |
|---|---|---|---|
| `--radius-2xs` | 4px | 4px | 小件:tag / 进度条 / 角标 |
| `--radius-xs` | 8px | 8px | **按钮 / 控件 / 输入** |
| `--radius-sm` | 10px | 10px | 行 / 小卡 |
| `--radius-md` | 14px | **10px** | 卡片 |
| `--radius-lg` | 18px | **12px** | 页面级面板 |
| `--radius-xl` | 24px | **14px** | 模态 |
| `--radius-pill` | 999px | 999px | chip / 圆点 |
| `--radius-ledger*` | — | 新增三档 | 票据类不对称角(移动先例) |

## 8. 待拍板(不猜,留义骁)

见 [`docs/11-ui-spec.md`](../11-ui-spec.md) §2.7 与本批最终报告的「待拍板」节。要点:

1. **衬线字族的现状与 §2.1 冲突** — §2.1 写「控制台一律不用衬线;衬线只属 Demo/营销页」,但移动壳(`mobile.css`)已在标题/卡片主问题/菜单项大量使用 `Songti SC`,且向导页头字标也用 `--font-display`。现状是「纸上账本」美学的一部分,本批**如实记录现状、不改代码、不擅自改 §2.1 条款**。
2. **品牌朱的三分工边界** — 身份(朱印 icon)/ 盖章(承诺型动作)/ error(印泥朱同值)三形态同色,是否需要在 error 场景微调色相以免与「盖章」混淆。
3. **移动确认卡「撤销」与「做」的同色** — 本批按交接稿把「做」从松绿改为品牌朱填充(盖章);但同卡的「撤销 · 当我没问过」当前也是朱色虚线边。两者同色系,是否把「撤销」降为暖灰退后,留义骁看真机后拍板。本批**不动「撤销」**。
4. **两个暖灰并存** — 移动 `--m-gray` `#8b8578`(球权灰/连接状态条底)与桌面 `--text-faint` `#a29b8f`(球权灰/占位)是两个不同的暖灰,本批各自保留(动任一端都会改定稿观感),是否收敛为一个待拍板。
5. **Dark 的 `--brand-seal`** 现为 `#c9563f`(非定稿品牌朱 `#b13a2b`,为暗底可读性提亮)。归「夜账本」二期一并定,本批不动。

## 9. 复核批修正(2026-08-13 二轮自查)

一轮交付后完整复核,发现并修掉四类问题:

| 问题 | 性质 | 处置 |
|---|---|---|
| 按钮圆角两套(`Btn` 基座 `sm=10` / 页面内联 `xs=8`) | ③「同类组件圆角必须一致」没做透 | 全部收到 `xs`;输入/textarea 同理 |
| 卡片原语两套(`PaperCard` `md` / redesign `card` `lg`) | 同上 | 统一到 `md` |
| 7 个语义别名零消费者(`--color-*-border` / `--fg-on-fill-dim` / `--shadow-{soft,drawer,ink}`) | 过度设计 | 退役;淡边/淡影只有移动壳在用,留在 ① 矿彩层。token 185 → 171 |
| 门禁脚本一段 perl 预处理 | 冗余 | `color-mix` 天然不命中函数式色正则,预处理无必要,已删 |

同时订正:改名条数 273 → **238**(原数是 `rg` 前缀计数,嵌套名互相包含);`docs/11 §5.1` 标注 `demo/saydo-console-redesign-proposal.html` 内嵌的仍是换芯前的雾灰蓝玻璃色板,只能当布局参考。

## 10. 既有红(不是本批引入,已实证)

| 项 | 证据 | 归属 |
|---|---|---|
| `pnpm lint` 2 处 error(`setupWizardUx.test.tsx:133`、`daemon/providers/byoa/provider.ts:23`) | 在 `main` 上跑同样红 | 既有基线 |
| `scripts/check-emoji.sh` 红 | 命中在未追踪的 `docs/store/*.md` 表格符号 | 另一工作线 |
| `npx playwright test` 29 failed / 3 passed | 在 `main` 的干净 worktree 上跑同一条用例,失败方式完全相同:页面渲染的是首启向导而非应用页 | T19 向导门与 e2e 装配不匹配 |

第三条的直接后果:docs/11 §12 要求的「token 改动必须重录亮暗截图基线」**本批做不到**,以下方针对性截图代替。

## 11. 本批视觉留证(浏览器实拍)

桌面 1440×960 与移动 375×812 各三页(今天 / 开口聊 / 向导画像),Light 下两端同族;桌面 Dark 一张证明切暗不破版;移动端在系统暗色下仍是纸一张,验证「`--m-*` 指 ① 矿彩层而非 ③ 语义层」这一架构决定确实生效。截图经 Playwright 直驱真实 daemon(fixture 种子 + 首启 daemon)拍摄。

## 12. commit 顺序

① 审计(本文档) → ② token 归一 → ③ 玻璃残留清理 → ④ 品牌朱推广 → ⑤ 状态一致性 → ⑥ 防回潮门禁 → ⑦ docs/11 回写。
