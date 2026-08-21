# 11 · UI 规范(UI Specification)

> **状态:canonical(2026-07-24 建立)**。SayDo 全部人机界面的持久化视觉与交互规范:控制台(D1)、响应式/移动外壳(D2)、审批卡、通知文本、Demo/营销页、CLI 与日志输出。实现期界面工作**照抄本篇**,与 Demo HTML 冲突时本篇胜(Demo 是早于本篇的草稿,Phase 5 对齐)。
> 话术与口播内容归 [10 · 语音 UX 规范](10-voice-ux-spec.md)(状态词纪律、数字纪律、诚实原则),本篇只管**视觉与书面呈现**;两篇共同构成呈现层合同。
> 设计基因(**2026-08-13 起 supersede**):起步继承 OctoBlog / OctoDesk 的 Soft Glass 体系(雾灰蓝画布、玻璃面板),现已整体换芯为 **纸上账本**(宣纸画布、实底纸面、松烟墨、矿彩语义色、印泥朱盖章),桌面与移动同一套 token(§2.0)。玻璃遗产只剩 Dark 主题暂留的夜色,归「夜账本」二期。原 Soft Glass 表述见 git 历史。

## 0. 设计原则(五条,冲突时按序让位)

1. **诚实优先**:UI 不得美化状态——没有假百分比、没有伪精确数字(unknown 显示"还没有确切数字")、状态词三级纪律(收到/等你验收/已交付)与 10 §1 一致;视觉强调服务于"需要人"的时刻,不服务于装饰。
2. **标准而非独特**:采用业界事实标准的库与模式,组件长得像"专业工具该有的样子";本项目不追求视觉个性,优雅、克制、可预期即可。
3. **安静的工作台**:大面积中性色 + 单一强调色(ink 蓝);语义色(成功/警告/危险/信息)只在状态处出现,永不作装饰;无大面积彩色渐变、无荧光色。
4. **注意力经济**:同屏最多一个主强调元素;"待你处理"类信息(验收/审批/回叫)有恒定的视觉等级,其余一律退后。
5. **零 emoji(硬规则)**:全项目(UI 文案、代码、注释、日志、通知、commit message、测试固件)禁止 emoji 与 pictographic 符号;图形语义一律用图标库(§4)。理由:owner 拍板——emoji 拉低项目品味,且在 TTS/日志/diff 场景产生噪音。CI 门禁见 §12。

### 0.1 协作呈现原则(十条;2026-08-08 增设,console 重构方案 v1 §2 论证)

> 从属关系:十条是"注意力经济"与"诚实优先"在协作场景的实现细则,与上五条冲突时让位于五条。

1. **操作面唯一性**:同一实体两个投影——推进投影(对话时间线内,可操作)与状态投影(右栏,只读);操作永远单点。
2. **对话-账本双向锚定**:每个实体可反向定位到生成它的对话时刻;账本与叙事互锚(叙事-账本分叉的呈现层防线)。
3. **球权分流,而非优先级分流**:收件箱四色按「球在谁+需要什么动作」组织(橙=拍板/回答、蓝=你的动作、绿=AI 在做、灰=等外部)。
4. **对齐是 AI 的义务,不是用户的查询**:进度对齐卡由 AI 主动推入。
5. **有账的沉默**:待命卡写明在等什么、叫醒条件、到期兜底;等外部永不悬空。
6. **判断可见、可推翻**:AI 的自由裁量显式列出,每条带 why,用户可推翻。
7. **所闻即所签**:口播原文=签署内容;预授权超 3 项强制屏幕同显;语音授权不得弱于屏幕。
8. **历史不可变,贯穿情感层**:已放弃≠已收官≠已归档,三种停机三种文案;closed 只能 fork。
9. **阻塞式诚实**:「学习中」为一等状态;不懂装懂比让用户等更糟。
10. **渠道只是 transport,账本是真相**:一切通知渠道与「今天」页同一 attention 账本,一处处理全网作废。

## 1. 技术基线(库选型,一次定死方便扩展)

| 层 | 选型 | 理由(标准性优先) |
|---|---|---|
| CSS 引擎 | **Tailwind CSS v4** | 事实标准;token 经 CSS variables 注入(§2 的变量即真相源,Tailwind 只是消费方式),不锁死 |
| 组件基元 | **shadcn/ui(Radix UI primitives)** | 当前 React 生态最标准的组件方案;代码复制进仓、完全可改可拥有、无运行时锁定;Radix 提供可及性(焦点/键盘/ARIA)兜底 |
| 图标 | **Lucide(lucide-react)** | 最通用的开源图标库(ISC,1500+,24px 网格 / 2px 描边一致性好);shadcn 生态缺省;emoji 的唯一合法替代(§4) |
| 图表(成本页) | **Recharts**(P0 只需条形/折线) | shadcn charts 同款底座,声明式,够用且不引入设计语言冲突 |
| 字体 | 系统栈(§2.1),**零 webfont** | 本地工具,不为字体引网络依赖;中文渲染交给平台(PingFang/HarmonyOS Sans) |
| 主题切换 | CSS variables + `data-theme` + `prefers-color-scheme` 跟随 | 与 OctoBlog 同构(§2.5) |

**禁选清单**:不引第二个组件库(MUI/AntD 等,风格与体量冲突);不引 CSS-in-JS 运行时;不引 emoji/表情类资源;图标不混用第二套库(单一 Lucide,缺的图标用其 24px 网格自绘补齐)。

## 2. Design Tokens(真相源;实现期落 `packages/console/src/styles/tokens.css`)

> **2026-08-13 全端标准化批 supersede 了「与 OctoBlog 同名同值」的起步约定**:token 名已从玻璃语言换成纸语言,值以纸上账本矿彩为准,与 OctoBlog 正式分叉(本篇为 SayDo 唯一真相源)。`tokens.css` 是**全端唯一定义源**——桌面与移动共用一份,移动 `mobile.css` 只做消费映射,不再自带一套色值。**改 token 走轻量评审回写本篇**;组件里写死色值由 §2.7 门禁拦。

### 2.0 三层结构(2026-08-13 建立)

| 层 | 内容 | 谁消费 |
|---|---|---|
| ① 矿彩原色层(`:root`,**不随主题变**) | 纸上账本定稿色的字面量唯一出处:`--paper/--paper-card/--paper-raised/--ink*/--ochre/--indigo/--pine/--seal/--rule/--paper-fg/--seal-fg/--paper-shadow*` | 语义层 Light;**移动 `--m-*` 直接消费这一层** |
| ② 夜色原色层(`:root`,不随主题变) | Dark 暂留玻璃夜色的字面量唯一出处(`--night-*`) | 语义层 Dark(两处 dark 块只做指派,夜色值只写一次) |
| ③ 语义层(Light / Dark 各一份) | 表面/文字/交互态/语义四态/品牌朱/线与影 | **组件只许消费这一层** |

移动 `--m-*` 指向 ① 而不是 ③,是刻意的:M1 移动壳无暗色设计(§5.6b),切 `data-theme=dark` 时手机必须仍是纸。桌面组件消费 ③,因此照常跟随主题。

### 2.1 字体

```css
--font-body: 'PingFang SC', 'HarmonyOS Sans SC', 'MiSans', 'Hiragino Sans GB',
  'Microsoft YaHei', -apple-system, sans-serif;      /* 全部 UI 正文与控件 */
--font-mono: ui-monospace, 'SF Mono', 'JetBrains Mono', 'Menlo', 'Cascadia Code',
  'Source Han Mono SC', monospace;                    /* 数据/代码/digest/金额/命令 */
--font-display: 'Songti SC', 'Noto Serif SC', serif;  /* 品牌字标与 Demo/营销页大标题 */
--font-ledger: 'Songti SC', STSong, SimSun, serif;    /* 账本衬线:移动标题/卡片主问题/菜单项 */
```

- 等宽字体的适用面(强制):taskId/digest/SHA、金额与计数、命令与路径、转写时间戳。中文正文永不套等宽。
- **衬线边界现状与本条原文冲突,留义骁拍板(§2.8 待拍板 1)**:原文写「控制台一律不用衬线;衬线只属对外 Demo/营销页」,但纸上账本换芯后,移动壳标题/卡片主问题/菜单项已实用 `--font-ledger` 衬线,向导页头字标用 `--font-display`。本批**如实记录现状、不改代码、不擅自改本条款**。

### 2.2 字号与行高(固定值,不随视口缩放)

```css
--text-xs: 12px;  --text-sm: 13px;  --text-base: 15px;  --text-md: 16px;
--text-lg: 19px;  --text-xl: 24px;  --text-2xl: 32px;   --text-3xl: 42px;
--leading-tight: 1.3;   /* 标题/卡片标题 */
--leading-body: 1.8;    /* 中文正文 */
--leading-data: 1.5;    /* 表格/数据行 */
```

层级用法:页面题 `xl`、区块题 `lg`、卡片题 `md`(600 权重)、正文 `base`、辅助 `sm`、标注/徽章 `xs`。**同页字号档不超过 4 种**。

**移动五级字阶(真机验收定稿,数值不得改;2026-08-13 起定义位置上移到共享 token 层)**:

```css
--m-fs-title: 20px;                    /* 页标题 700 · 移动专有档 */
--m-fs-card: 17px;                     /* 卡片主问题 700 · 移动专有档 */
--m-fs-body: var(--text-base);         /* 15 正文 400 */
--m-fs-secondary: var(--text-sm);      /* 13 次要 500 */
--m-fs-btn: var(--text-md);            /* 16 按钮主 700 */
--m-fs-btn-sub: var(--text-xs);        /* 12 按钮副 */
--m-fs-chip: 11px;                     /* chip 600 · 最小红线,窄屏不再缩小 */
```

### 2.3 圆角、间距、布局

```css
--radius-2xs: 4px;  --radius-xs: 8px;  --radius-sm: 10px;  --radius-md: 10px;
--radius-lg: 12px;  --radius-xl: 14px;  --radius-pill: 999px;
/* 票据类不对称角(移动先例;2px 起的"裁纸口") */
--radius-ledger: 3px 12px 4px 10px;  --radius-ledger-lg: 2px 14px 3px 9px;
--radius-ledger-sm: 2px 10px 3px 8px;
--space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
--space-5: 24px; --space-6: 32px; --space-7: 48px; --space-8: 72px;
--h-titlebar: 52px;  --w-sidebar: 232px;  --shell-gutter: 20px;
```

- 圆角语义:小件(tag/进度条/角标)=`2xs`,控件/按钮/输入=`xs`,行/小卡=`sm`,卡片=`md`,页面级面板=`lg`,模态=`xl`,chip/圆点=`pill`,票据类卡=`ledger` 系。**同类组件圆角必须一致**。
- **2026-08-13 supersede**:原刻度 `md=14 / lg=18 / xl=24` 是玻璃时代的圆度,与移动 2–10px 纸感圆角不同族,已收到 `10 / 12 / 14`(语义槽位名与用法不变)。真圆形(头像/圆点)继续用 `50%`,是几何不是 token。
- **同批修的两处「同类不一致」**:① 按钮此前混用 `sm`(redesign `Btn` 基座)与 `xs`(页面内联按钮),已全部收到 `xs`;输入/textarea 同理收到 `xs`。② 卡片原语此前两套——`ui.tsx PaperCard` 用 `md`、`redesign/shared.tsx card` 用 `lg`,已统一到 `md`。`sm` 保留给行/小卡/浅块/代码块/气泡/浮层。
- 间距只允许取刻度值;组件内 `1–4`,组件间 `4–6`,区块间 `6–8`。

### 2.4 动效

```css
--duration-fast: 140ms;  --duration-base: 220ms;  --duration-slow: 420ms;
--ease-out: cubic-bezier(0.22, 0.61, 0.36, 1);
--ease-spring: cubic-bezier(0.34, 1.3, 0.5, 1);   /* 仅入场;悬停/退出用 ease-out */
```

- 动效只做三件事:入场(淡入+4px 上移)、状态切换(色彩/边框过渡)、注意引导(running 的呼吸点)。**禁**:无限循环装饰动画、视差、弹跳列表。
- `prefers-reduced-motion: reduce` 时全部动画降为即时切换(呼吸点降为静态圆点)。

### 2.5 语义 token 全集(Light 纸上账本 / Dark 夜雾蓝工作灯=夜账本二期前暂留)

> 2026-08-13 全端标准化批:token 名从玻璃语言换成纸语言,并与移动 `--m-*` 收敛到同一份定义(§2.0)。Dark 暂留原玻璃夜色,专门的「夜账本」调色批(墨底+矿彩提亮)排二期——切暗=旧观感为已知不一致,本批只保证不破版。原雾灰蓝色板见 git 历史(aa8034e 前)。

**改名对照(旧名已全仓消灭,共 238 处,不留别名)**:

| 旧名(玻璃) | 新名(纸) |
|---|---|
| `--surface-glass` | `--surface` |
| `--surface-glass-strong` | `--surface-raised` |
| `--surface-glass-soft` | `--surface-soft` |
| `--control-glass` | `--surface-control` |
| `--glass-border` | `--line` |
| `--glass-border-bright` | `--line-soft` |
| `--glass-blur` | 退役(backdrop-filter 全删,纸是清晰的) |

#### 表面三级 + 控件面 + 洗底 + 遮罩

| Token | Light | Dark | 用途 |
|---|---|---|---|
| `--bg-app` | `#f0ede4` 宣纸 | `#12161f` | 画布 |
| `--bg-glow-a/b` | 赭石 5% / 黛蓝 4.5% 色渍 | 蓝 13% / 暖 7% | 画布氛围(纸不发光,只有渍) |
| `--surface` | `#faf7ef` 纸面**实底** | `rgb(26 32 45 / 62%)` | 卡片/面板 |
| `--surface-raised` | `#fcfaf4` 抬升纸面 | `rgb(30 37 52 / 82%)` | 顶栏/侧栏/模态/浮层 |
| `--surface-soft` | 纸面 68% | 26 32 45 / 40% | 弱化纸面:骨架块/浅底区 |
| `--surface-control` | 纸面 80% | 38 46 64 / 55% | 输入/下拉/次按钮面 |
| `--surface-ink-wash` | 墨 5% | 反白 4.5% | 悬停/选中底 |
| `--scrim` | 墨 42% | `rgb(8 10 16 / 55%)` | 模态遮罩(原来三处三个不同的黑) |

#### 文字四级 + 反白前景

| Token | Light | Dark | 用途 |
|---|---|---|---|
| `--text-primary` | `#34332e` 松烟墨 | `#e8ecf4` | 主文 |
| `--text-secondary` | `#5b564b` | `#a8b2c4` | 次文 |
| `--text-muted` | `#706b61` | `#6e7a90` | 辅助 |
| `--text-faint` | `#a29b8f` 暖灰·浅 | `#515c70` | 占位/禁用/球权灰 |
| `--fg-on-fill` | `#fffaf0` 暖白 | `#12161f` 墨 | 饱和底上的反白正文 |

饱和底上的**次行小字**用 ① 层的 `--paper-fg-dim`(暖白 78%),移动壳专用,桌面暂无消费者。

#### 交互态(两端同一组;移动壳在 `.m-root` 内改指矿彩层,不随主题变)

| Token | 值 | 用途 |
|---|---|---|
| `--active-ink` | `#3c5f96` 黛蓝 / Dark `#7aa5f7` | **浏览/导航/选择**的强调色:链接/次主按钮/选中/会话活跃 |
| `--active-ink-fg` / `-wash` / `-border` | 暖白 / 9% / 34% | 强调前景、底色、描边 |
| `--focus-ring` `--focus-ring-width` `--focus-ring-offset` | `= --active-ink` / 2px / 2px | 全站 `:focus-visible` 焦点环(§9) |
| `--hover-wash` | `= --surface-ink-wash` | 悬停底 |
| `--selected-wash` | `= --active-ink-wash` | 选中底 |
| `--disabled-opacity` | `0.45` | 禁用态 |
| `--dimmed-opacity` | `0.58` | **降级可用 ≠ 禁用**(离线/重连中的移动输入条,§5.6b) |

#### 语义四态(各带 wash 淡底)

| Token | Light | Dark | 语义 |
|---|---|---|---|
| `--color-success` / `-wash` | `#41755a` 松绿 / 6% | `#5cab7d` / 12% | 成功 |
| `--color-warning` / `-wash` | `#a8641f` 赭石 / 5% | `#cfa050` / 12% | 警告 |
| `--color-error` / `-wash` | `#b13a2b` 印泥朱 / 6% | `#d47f7f` / 12% | 危险 |
| `--color-info` | `#3c5f96` 黛蓝 | `#6f9bd1` | 信息 |

语义色的**淡边**(42%)目前只有移动壳在用,所以只存在于 ① 矿彩层(`--ochre-line` / `--pine-line` / `--seal-line` / `--indigo-line`);桌面的语义描边一律用全强度 `--color-*`(§2.6 的「描边 chip」)。桌面真需要淡边时按 §2.7a 的正道加语义别名,不预留空 token。

#### 品牌朱(盖章)

| Token | Light | Dark | 用途 |
|---|---|---|---|
| `--brand-seal` / `-fg` / `-border` | `#b13a2b` / `#fff8ed` / 42% | `#c9563f`(待夜账本批定) | **承诺型/终局动作**按钮与品牌印记 |

品牌朱与 `--color-error` 同值不同名,是刻意的:见 `assets/brand/README.md` 末节的三分工——**身份**(朱印 icon / 侧栏 mark / favicon)、**盖章**(承诺型动作,§2.7a)、**error**(危险语义)。三者同色但语义分名,改动互不牵连。

#### 线与影

| Token | Light | Dark | 用途 |
|---|---|---|---|
| `--line` | `#cec6b7` 墨线(=移动 `--m-line`,实底) | 反白 9% | 1px 描边(所有面板必带) |
| `--line-soft` | 暖灰软线 62% | 反白 13% | 虚线框/连接线 |
| `--rule-line` | `rgb(98 82 58 / 4%)` | 同 | 账页格纹底线 |
| `--shadow-card` / `-hover` | 暖影 `rgb(75 64 47 …)` | 黑影 | 卡片/悬停 |
| `--shadow-modal` / `-titlebar` | 暖影系 | 黑影系 | 模态 / 顶栏 |
| `--code-block-bg` | 纸面 75% | `rgb(16 20 30 / 66%)` | 代码块/证据块底 |

气泡影 / 抽屉影 / 黛蓝投影只有移动壳在用,同样只存在于 ① 层(`--paper-shadow-soft` / `-drawer` / `-ink`)。

> `--line-soft` 在换名前叫 `--glass-border-bright`,Light 值是近白高光(`rgba(255,253,247,.85)`)——玻璃时代的内高光配方,画在宣纸上几乎不可见,StageTag 虚线框与 RecordsPanel 连接线因此一直是隐形的。本批换成暖灰软线,是修 bug 不是调色。

主题切换:缺省跟随系统,手动切换写 `data-theme` 持久化到 localStorage;两主题都必须过 §9 对比度线(纸账本 Light 已核:墨/宣纸 9.8:1,黛蓝 5.3:1,四态均 ≥4.5:1;`--fg-on-fill` 在黛蓝上 6.2:1)。

### 2.5a 两端映射(移动 `--m-*` 全是消费别名,`mobile.css` 零色值定义)

| 移动名 | 指向(① 矿彩层) | 桌面同族语义名 |
|---|---|---|
| `--m-paper` | `--paper` | `--bg-app` |
| `--m-card` | `--paper-card` | `--surface` |
| `--m-ink` | `--ink` | `--text-primary` |
| `--m-muted` | `--ink-muted` | `--text-muted` |
| `--m-gray` | `--ink-gray` `#8b8578` | (桌面球权灰用 `--text-faint` `#a29b8f`,两个暖灰并存,§2.8 待拍板 2) |
| `--m-orange` | `--ochre` | `--color-warning` |
| `--m-blue` | `--indigo` | `--active-ink` / `--color-info` |
| `--m-green` | `--pine` | `--color-success` |
| `--m-seal` | `--seal` | `--brand-seal` / `--color-error` |
| `--m-line` | `--rule` | `--line` |
| `--m-shadow` | `--paper-shadow` | `--shadow-card` |
| `--m-fs-*` | 共享字阶(§2.2) | `--text-*` |

移动侧的本地 alpha 派生(pending 气泡底、按钮描边等)一律用 `color-mix(in srgb, var(--token) N%, transparent)`,基色仍是 token,不新造字面量、也不为一次性用途污染 token 表。

### 2.6 状态语义层(SayDo 新增;与 09 §7 投影词表一一对应)

> 这是本规范的核心合同:**状态→颜色→图标→文案**四联映射,全站唯一。组件不得自创状态色。名词与 09 §6.1/§7 状态机一致,文案与 10 状态词纪律一致。**本表键 = TaskView 呈现态(持久态 ∪ 派生态)**,不是数据库枚举——标「派生」的行由投影/收据状态推导(09 §13 TaskView),不得写回 `tasks.status`(Codex 复审 B9)。

| TaskView 呈现态 | 用户语(10) | 色 | Lucide 图标 | 视觉处理 |
|---|---|---|---|---|
| queued | 排队中/已接单分诊中 | muted | `clock` | 灰 chip,无动效 |
| confirmed(已拍板待派发) | 收到,准备开工 | muted | `clock` | 灰 chip(短暂过渡态) |
| running | 执行中(第 N 次尝试) | info | `loader-circle` | 蓝 chip + 呼吸点(reduced-motion 降静态) |
| paused_step_boundary | 等你确认这一步 | warning | `circle-pause` | 琥珀 chip + 置顶"待你处理" |
| blocked | 需要你(四来源分话术,10 #30) | warning | `circle-help` | 琥珀 chip + 置顶"待你处理" |
| waiting_confirmation(派生:billing-switch 等收据 pending) | 等你拍板(限流/切计费等) | warning | `circle-alert` | 琥珀 chip |
| ready_for_review | **等你验收** | active-ink | `flag` | **全站最高优先级**:ink 填充 chip + Dashboard 聚合条首位 |
| review_approved_waiting_merge | 已批准·待合并 | active-ink(wash) | `git-merge` | ink 描边 chip |
| merging | 合并中 | info | `git-merge` | 蓝 chip + 呼吸点 |
| merge_failed | 合并冲突/失败 | error | `git-pull-request-closed` | 红 chip |
| task_done | 已交付 | success | `check` | 绿 chip;完成后 24h 内保留在看板"已交付"列 |
| failed | 失败了 | error | `x` | 红 chip + 一句人话原因 |
| cancel_requested | 正在停(等执行侧确认) | muted | `ban` | 灰 chip + 呼吸点(settle 前不说"已停") |
| cancel_settled | 停了,这轮作废 | muted | `ban` | 灰 chip,删除线不用 |
| superseded | 已被新版本替代 | muted | `history` | 灰 chip + 指向新卡链接 |
| parked(派生:blocked/审批超时停靠 + parked_deadline) | 停靠等你,N 天后自动取消 | warning(wash) | `circle-pause` | 琥珀描边 chip + `--color-warning-wash` 淡底 + 倒计时(mono) |

其余语义映射:

| 域 | 映射 |
|---|---|
| 风险 S0/S1 | muted 文本徽章,不着色(自动放行,不制造焦虑) |
| 风险 S2 | warning 描边徽章 + `shield` 图标 |
| 风险 S3 | error 填充徽章 + `shield-alert`;S3 审批按钮永远是屏幕强认证样式(§5.4) |
| content-risk high(Hopper 维,09 §7) | 同 blocked 处理 + 副文案"内容被判高风险,不会自动执行" |
| route=tier1 / hopper | mono 小徽章 `T1` / `HP`,muted 色;仅任务详情显示(用户不需要懂路由) |
| 成本 known | mono 数字 + "元";预算进度条用 ink→warning(80%)→error(100%)三段 |
| 成本 unknown | 文本"还没有确切数字",**禁 0/禁空** |
| 成本 subscription | 文本"订阅额度内(已用 N 次)",不折算金额 |
| 回叫升级 L0/L1/L2 | `phone`/`monitor-speaker`/`bell-ring` 图标 + 时间线行,颜色恒 muted(历史记录不再警示) |
| 记忆 trust 层 | user_stated=ink 描边;user_approved=success 描边;auto_low_impact=muted;candidate/third_party=faint + `flask-conical`(待复核) |
| BYOA/api 供给 | T18b 已实施四槽 CLI:dialog 为 `mode="oneshot"` 慢速文本形态,其余三槽一发一收;console 不得出现“尚未接线/接入开发中”,必须按 probe 的实际 self-test 状态呈现 |

### 2.7 品牌朱使用准则(盖章语义;2026-08-13 建立)

品牌朱 `#b13a2b` 有且只有三个形态,**同色不同职**:

| 形态 | token | 用在哪 |
|---|---|---|
| **身份** | `--brand-seal` | 朱印 icon(favicon/App icon)、侧栏 mark、向导页头字标旁的印、移动 avatar、选中供给卡的印角 |
| **盖章** | `--brand-seal` / `-fg` / `-border` | **承诺型/终局动作按钮**——一按就落账、签收据、授权执行、宣告收官 |
| **error** | `--color-error` | 危险语义(失败态、危险按钮描边、error 描边卡) |

**盖章的判定线(逐处判断,拿不准列入 §2.8 而不是猜)**:

- **是盖章**:批准 / 按我改的签新收据 / 可以发(放行对外动作)/ 记(落账)/ 这一步行,继续 / 拍板:切到 API 计费 / 拍板,开始 / 验收通过 / 做(桌面与移动确认卡)/ 我做完了,办结 / 全用它,启动。
- **不是盖章,保持 `--active-ink` 黛蓝**:浏览与导航(去验收、开口聊、开始新对话、开新对话续推)、低摩擦对话动作(发送、回话、steer)、修改类(调期待)、恢复类(重试、重新检测)、向导分步推进(保存并继续——step advance 不是终局)。
- **例外**:S3 审批按钮是独立组件(§5.4),不复用普通按钮样式,也不转朱——防肌肉记忆误点的隔离优先于色彩统一。

实现:`Btn variant="seal"`(redesign 组件库)与 `btnCommit`(TaskModal / SetupWizard 内联样式)。

### 2.7a 写死色值门禁(防回潮)

`scripts/check-hardcoded-colors.sh`,接入 `package.json ci:node` 与 `justfile ci-node`。

- **范围**:`packages/console/src` 的 `.css/.ts/.tsx`,排除 `*.test.*` / `*.fixture.*`。
- **拦**:hex(含 Tailwind 任意值类 `[#fff]`)、`rgb/rgba/hsl/hsla/oklch/oklab/lab/lch/hwb/color()`、以及 `.css` 文件里的 CSS 具名色(`color: red` 之流)。
- **放行**:`color-mix(...)`(基色仍是 token,只做本地 alpha 派生)、`transparent` / `currentColor` / `inherit`,以及 `.tsx` 里把 `orange/blue/green/gray` 当**球权枚举键**的写法——所以具名色只在 `.css` 查,避免误伤。
- **白名单**:只有 `packages/console/src/styles/tokens.css`。`mobile.css` **不在**白名单:2026-08-13 起它只做消费映射、已零字面色,给它豁免等于给回潮开门。
- **自测**:`scripts/test-color-gate.sh`,21 项(11 项必红固件 + 9 项不得误伤 + 白名单 + 错误路径)。

新增颜色的正道:先在 `tokens.css` 里加语义 token 并回写本篇 §2.5,再在组件里 `var()` 消费。

### 2.8 待拍板(本批不擅自定;义骁看真机后决定)

1. **衬线边界**:§2.1 原文「控制台一律不用衬线」与现状冲突——移动壳标题/卡片主问题/菜单项已用 `--font-ledger` 衬线,向导字标用 `--font-display`。要么改条款承认「纸上账本的账本衬线」是合法用法,要么退回全 sans。本批只如实记录。
2. **两个暖灰并存**:移动球权灰 `--ink-gray` `#8b8578` 与桌面球权灰 `--text-faint` `#a29b8f` 不同值。两端球权条并排看时会有细微差,但动任一端都改定稿观感,故各自保留。
3. **移动确认卡「撤销」与「做」同色系**:本批把「做」改成品牌朱填充(盖章),同卡「撤销 · 当我没问过」仍是朱色虚线边。是否把「撤销」降为暖灰退后。
4. **「立起来」类是否算盖章**:创建并开聊 / fork 一件新的 / 新 Focus——开一件新事是承诺还是导航。本批按导航处理(保持黛蓝)。
5. **「标完成」/「标记已产出」/「回答」是否算盖章**:登记事实 vs 终局宣告的边界。本批按登记处理(保持黛蓝)。
6. **Dark 的 `--brand-seal`** 现为 `#c9563f`(非定稿品牌朱,为暗底可读性提亮)。归「夜账本」二期一并定。
7. **移动 composer 输入框 `outline: 0`**:焦点环被去掉,与 §9「键盘可达 + 全站焦点环」有张力。改法(给容器加 `:focus-within` 环)会改移动观感,本批未动。

## 3. 布局与信息架构(与 08 §6 对齐)

- **外壳**:左侧栏(`--w-sidebar`,`--surface-raised`,分"当前项目/全局"两段,项目切换器置顶)+ 顶栏(52px:语音会话指示器 + 通知铃 + 免打扰 + 主题切换)+ 内容区(最大宽 1200px 居中,gutter 20px)。
- **画布**:`--bg-app` + 双光斑 + 细噪点(唯一装饰,照抄 OctoBlog `.canvas-atmosphere` 配方)。
- **卡片即单位**:一切内容承载在纸面卡片(`--surface` + `--radius-md`/`lg` + `--line` + `--shadow-card`;组件为 `PaperCard`);票据类卡用 `--radius-ledger` 系不对称角。卡片不嵌卡片超过两层。**禁 `backdrop-filter`**——纸是清晰的,不做玻璃模糊。
- **断点**:`≥1280` 双栏(对话页转写流+右栏草稿);`768–1279` 单栏可折叠侧栏;`<768` 移动式(侧栏抽屉、底部主操作)。D2 原生外壳(P1)复用同一套响应式,不另做设计。
- **密度**:表格行高 40px,列表行高 48–56px;**紧凑模式已实施(W5a 2026-07-27)**:顶栏切换 `data-density=compact`(表 40→32 / 列表 52→40 / 页距收紧;字号/圆角不动——密度让位可读性)+ localStorage 持久。
- **"待你处理"聚合条**(2026-08-08 修订,原 Dashboard 首位,批次②起由「今天」页橙区继承):恒定位置,排序修订为 **ready_for_review > 审批/确认卡 > blocked > blocking 挂账义务(needs:decision/input) > 回叫未读**(理由:已成型工作等人验收,损失随延迟线性增大;挂账义务是未成型问题,晚答成本前期平缓);排序由呈现层对 `GET /api/attention` 结果二次排序实施,daemon 排序(颜色+时间)不改;空态显示"没有需要你的事"(faint,不庆祝)。

## 4. 图标规范(Lucide,emoji 的唯一替代)

- 尺寸三档:16(行内/chip)/ 20(按钮/列表)/ 24(空态/页头);描边恒 2px,不改粗细。
- 颜色跟随文本层级(`currentColor`),**语义色图标只出现在语义 chip/徽章内**。
- 语义固定表(§2.6 已列状态图标)之外的常用映射:项目 `folder`、对话 `mic`(活跃)/`mic-off`、任务 `list-todo`、记忆 `database`、产物 `package`、审批 `shield-check`、通知 `bell`、成本 `wallet`、设置 `settings-2`、深链外跳 `arrow-up-right`、复制 `copy`、验收通过 `check`、打回 `undo-2`、合并 `git-merge`、Demo `play`。
- 每个图标必须有文本伴随或 `aria-label`;**纯图标按钮仅限顶栏三件**(通知/免打扰/主题)。

## 5. 组件规范(shadcn 基础上的定制约束)

### 5.1 按钮

- 主按钮(每屏 ≤1):ink 填充,白字,`radius-xs`,高 36px;危险确认(取消任务/hard-forget)用 error 填充,且必须带二次确认对话框。
- 次按钮:`--surface-control` 底 + `--line`;文字按钮仅用于表格行内操作。承诺型/终局动作按钮走品牌朱(§2.7),不是主按钮的一个变体而是另一种语义。
- **S3 审批按钮是独立组件**(§5.4),不复用普通按钮样式,防止肌肉记忆误点。

### 5.2 Chip/徽章

单一来源组件 `StatusChip`,输入 09 状态枚举,内部查 §2.6 表;禁止页面各自拼装。徽章(risk/route/供给)高 20px、`text-xs`、mono 可选。

### 5.3 任务卡(看板/列表两形态)

标题(md/600)+ StatusChip + 项目名(muted)+ 预算进度(mono)+ 最后事件一句话(sm/secondary,来自摘要器 one_liner,**不显示原始事件**)。attempt>1 时标"第 N 次尝试"。retry 在旧 base 上跑时,追加 muted 注脚"在原快照基础上继续"(08 §5.1)。

### 5.4 审批卡(C5;全站最严肃的组件)

- 恒定结构:效果描述(spokenForm 同文,10 #39)→ 项目/任务上下文(必带,04 §5.2)→ 约束参数表(mono)→ digest 尾码(mono,faint)→ 操作行。
- S2:accept/ignore 双按钮;S3:单一"去屏幕确认"入口 + 强认证流程(样式独立:error 描边卡 + `shield-alert`);**语音 UI 永不渲染 S3 批准按钮**。**edit 第四动作已实施(W5a 2026-07-27,09 §3 骨架)**:"修改后批准"按钮仅 S2 ∧ 有 pending_command 时渲染——旧张 superseded_by_edit + 新张重签(新 nonce/新 refDigest),编辑后命令风险重估 S3 ⇒ 拒(不开 S3 预批面);S3 卡不适用 edit。
- **S3 卡 WebAuthn 交互(R-A 2026-07-26;09 §3.3;设计 ADR-004)**:S3 卡按钮文案"用本机认证批准"(`fingerprint` 图标;macOS 系统弹窗仍可能显示 Touch ID,Windows 显示 Windows Hello),点击触发浏览器原生 `navigator.credentials.get`(platform authenticator)——**认证 UI 由 OS 提供,SayDo 不自绘密码框**;成功→daemon 校验断言签 S3 收据→动作执行,失败→error toast 不放行。**仅本机受信终端渲染**:tailnet/远程来源(`via="tailnet"`)一律不渲染 S3 卡,置"请回桌面完成"引导(09 §3.3 红线;W2 已 403)。未注册 passkey ⇒ 卡降级为"去受信终端手动合并"(requestManualMerge 降级路径)。按钮下诚实注脚(同步凭据条款,09 §3.3):"本机生物或 PIN 凭据可能经系统账号同步到你的其他设备;批准动作本身只能在这台电脑完成。"
- 超时/被打断即置灰并标注终局(timeout_rejected 等),不可再点(收据单次消费的视觉表达)。

### 5.5 review 证据视图(任务详情主体)

- 按 `DecisionPackage.acceptance[]` 分组:每条 AC 一行 `AcceptanceCheck`(pass=`check`/fail=`x`/unknown=`circle-dashed`+"未验证",禁伪精确)。**decisions 区已实施(W5a 2026-07-27)**:证据视图内 decisions 列表(每条=决策+理由+可推翻,≤5 条)读 `tier1_runs.decisions_json`——与语音口播同一落库份(09 §13 生产语义注)。
- 路径二任务:证据主体 = 嵌 Hopper trust-report(自包含单文件,09/设计 ADR-001)。**嵌入合同(Codex 复审 A2/A4)**:`RunSettled.summary_path` 指向 `.md`——校验其在受信 vault 内(防越界路径)后**受控映射到同 basename 的 `.html`**(post-run 同时生成),文件缺失/扩展名异常按证据缺失处理;**展示层做确定性字符转换**(Hopper 报告内含 emoji,渲染前按映射表替换为 Lucide 图标/文本标记 + DOM 字符门禁),**原始文件原样留存、不改变证据 digest**——转换只发生在呈现层。
- 操作行:验收通过(次按钮)/ 提修改(次按钮,文案"这轮不作废")/ **作废这轮**(危险描边,带二次确认对话框——§5.1 危险确认纪律;走取消链,10 #34)/ 合并(S3 组件;**批准前置灰**,§5.4 终局置灰同款)/ **我已合并,核验**(次按钮,归 S3 组件组)。零外部跳转(diff/日志深链仅工程排障入口,collapsed)。**writing 任务(R-A 补完 2026-07-27,Codex 21 A5)**:manual 验收项未逐条裁决前"验收通过"置灰(writingSettleBarrier ④,09 §6.1a);AcceptanceCheck 行提供逐条 pass/fail 勾选,勾选结果即 approve 载荷的一部分——settled ≠ 全绿,禁默认 pass 投影。
- **合并按钮语义(R-A 2026-07-26;S3 卡兑现后收窄;设计 ADR-004)**:`review_approved_waiting_merge` 态下——**主路径 = "用本机认证批准合并"**(S3 卡,§5.4;过卡→daemon 本地 rebase+verify+合并,09 §3.3);**"我已合并,核验"降级为次要入口**(仅未注册 passkey / owner 选人工时用,触发 MergeProof watcher 对账外部合并)。coding 与 writing(content_done 态)同构此操作行;writing 的"合并"= 文章稿并回主分支(02 §5.0)。

### 5.6 转写流(对话页)

- 用户轮右对齐 ink-wash 底,AI 轮左对齐 `--surface` 纸面底;工具调用行 mono/sm/muted,折叠显示。
- ASR partial 用 faint 渐显,final 转 primary;被打断的 TTS 未播部分标 faint 删除线(unheard 不进事实的视觉对应)。
- 时间戳 mono/xs/faint,悬停显示完整。
- **T17 首跑引导**:对话页进入时探询 daemon once 状态;eligible 时固定开场白作为普通 AI 轮渲染。React StrictMode 重放 effect 时同一 session 必须共享一次在途探询,不得让已 cleanup 的请求独占 once 结果;响应丢失或页面重挂后,同 session 探询必须拿回稳定的同一 `turnId/message`。旧用户或真正被 daemon 接纳的抢先用户消息不投递,recovery-only 拒收不消费首跑资格。消息流为空时在空态下显示四张"试试这样说"静态案例卡;点击只填输入草稿,绝不自动发送。

### 5.6a 就绪复述确认卡(A3-armed 2026-07-28;10 #41 的屏幕面)

- 触发:confirmReadiness 环激活时在对话流内联渲染(非模态——与审批卡同"卡片"体系但**视觉降一级**:普通描边,非 error 描边;这是信息确认不是授权确认,10 #41 两环差异纪律)。
- 结构:标题"跟你确认几点" → 逐 key 行(`{label}(mono/sm/muted)+ {claim 原文}(primary)`,来自 renderReadinessChecklist 机械渲染,与 TTS 同文)→ 操作行:确认(主按钮)/ 有出入(次按钮,点击 = 环作废,回采访)。
- 语音封闭肯定与屏幕按钮等价(先到先算);确认后卡片置灰标"已确认",逐 key 打 `check`。candidate 未确认项在项目页就绪面板显示 `circle-dashed` +"记了还没核对"(骨架 unknown 的视觉对应)。

### 5.6b M1 移动 Web shell(2026-08-11)

窄屏 `<768px` 在 `VoiceProvider` 与 `SetupProvider` 内、`SetupBootstrapBoundary` 之后、桌面 `Layout` 前切换到独立 `.m-root` 组件树;视口实时切换不得重建主 WS。首启判定由 `SetupBootstrapBoundary` 统一消费(§5.8a):本机窄视口与原生强制移动壳共用该门;真实 `mobile_lan` 不开放 setup probe,LAN 撞 `mobile_lan_route_rejected` 时进入 `remote-mobile` 直挂 `MobileApp`,不得静默套用桌面向导,也不得把该码映射成桌面 `app`。移动 hash 表固定为 `#/m`、`#/m/things`、`#/m/focus/:id`、`#/m/lane/:focusId/:laneId`、`#/m/card/:kind/:id`、`#/m/chat`;本机 localhost 宽屏进入移动路由须重定向到对应桌面页,桌面 hash 缩窄时反向映射对应移动页;`remote-mobile` 宽屏仍保持移动树(iPhone 横屏不得落到桌面 `Layout`)。移动 Today 直接读取桌面 Today 同一个 `/api/attention` 投影,不得复制球权推导。M1 CardResolver 使用仅供前端缓存/导航的 `MobileCardRef(kind+entityId+focus/lane hint)`;带 revision/digest 的 durable CardRef 与精确回执端点属 M2。

M1 确认卡只呈现当前数据面可证明的三段:问题、durable `expiresAt` 倒计时、动作行。动作固定为“做”(副文字节点直接逐字渲染当前卡的 `prompt_text`,不加前后缀、不另造建议)、“不要 · 不按这个来”、“撤销 · 当我没问过”;过期文案是“过期自动搁置”。建议/代价/证据/锚点属 M1.5,不得填演示数据。`mobile_lan` 不具备 S2 配对身份,runtime approval 在手机裁决时如实提示回受信桌面处理,不得伪装成 voice 放行。stale 卡只说“这张卡已不在待办里(可能已在桌面处理,或已过期搁置)”并在存在真实 focus/lane 目标时给“去泳道看”,不得伪称已由桌面处理;missing 零动作。底部只提供菜单钮与文本输入条;话筒图标的唯一行为是聚焦输入,placeholder 固定“用键盘上的话筒说话”,不得实现假按住说话。连接呈现由 `connecting/online/offline` 状态机驱动,非 online 时只禁发送按钮,输入与键盘话筒仍可编辑草稿。M-Chat 直接复用分树外 VoiceProvider 的既有 `turn.text` 与 VoiceHub 广播,桌面与手机同开时回复在双端同显;M1 不新增跨 Brain/tool 的接纳 outbox 或回执协议,per-session 多端定向留 M2。

- pending 提案卡变体:决策包卡在 pending 项目下标题改"立项提案"(chip:`pending`),不渲染"开始"主按钮语义(10 #10 pending 变体同文),仅"定型"引导。

### 5.7 语音会话指示器(顶栏常驻)

三态:活跃(ink 圆点呼吸 + 项目名)/ 挂起(muted 圆点 + "挂起")/ 无会话(faint "开始对话")。切导航不断会话,点击回到锚定项目对话页(08 §6)。

开口创建 draft 或归属确认 accept 后，daemon 从 durable event 投递 `session.project`；
消息只带 sessionId/projectId/projectRevision/reason，不带完整本机路径。console 持久化
当前 sessionId；WS 断线按指数退避自动重连，每次握手后发送 `voice.mode{sessionId}`，
由 daemon 回放该 session 最新 durable event。console 按同一 session 的 `projectRevision`
单调去重，事件到达或重连后都回读 session/project 权威状态，
乱序旧事件不得覆盖新锚。console 必须刷新项目列表、项目切换器与顶栏名称，并导航到该项目
对话页；draft 采用未登记 workspace 时 projectId 不变但 title/type 会变，仍必须刷新，不能
依赖 route id 变化；re-anchor 到已有项目时切换到 target id。投递或回读失败显示可恢复状态
并自动重试，不回滚已提交的 daemon 事实。该事件只声明 durable project 归属，不表示
readiness/Context Pack 双闸已追平；两项重建失败只暂停 Brain/tool，不阻止 UI 展示新锚。

### 5.8 表单与设置

shadcn 原样(Input/Select/Switch/Tabs);设置页每项带一句 muted 说明;危险区(删除项目/hard-forget)单独分组 + error 描边。五槽位模型配置用表格而非五张卡。

向导的视觉与交互合同见 §5.8a。槽状态必须消费 probe 的 `mode/effective/reason/fallbackTo`,不得从配置形状推导;cheap 回落时固定显示"实际走对话档模型计费"。若 recovery violation 指向失效 project override,门禁须提供明确的"清除失效覆盖"动作,说明项目随后继承全局配置,不得让用户只能手改 SQLite。完成流在发起 restart 前先把目标 hash 置为 `#/chat-new`,使协调重载保留导航意图;live self-test 通过后必须刷新 setup 判定:新 probe 已武装则 `SetupBootstrapBoundary` 就地翻到应用并挂载 `AppContent`;仍未武装则整页进入已写入的 `#/chat-new`,由 `SetupProvider` 重新 probe。不得停留在启动前的向导快照上等人手刷新。

### 5.8a 首启配置向导(T19 2026-08-13;三卡制废止;T20 融合页 2026-08-13)

> 取代「基础层最多三张一键卡 / mixed 自动降级 / one-key 独立卡」合同。实施照抄源=本小节;旧三席推荐槽退役。

**门层级**:`SetupProvider` 内、`AppContent` 外挂 `SetupBootstrapBoundary`。桌面与本机/原生强制移动壳在判定完成前一律不挂载今天页/`Layout`/`MobileApp`。真实 `mobile_lan` 仍不开放 setup probe 与完整 setup API;console 仅当失败码为 `mobile_lan_route_rejected` 时进入 `remote-mobile`(自己取移动路由并直挂 `MobileApp`,不走 `AppContent`/`useMobileViewport`/桌面 `Layout`)。不得把该码映射成 `app`。`token_mismatch`/`origin_rejected`/`host_rejected`/`setup_local_only` 仍停错误卡。

**判定**:

- `loading`:全屏品牌(朱印 icon + 「说到 SayDo」组合字标,与页头同款)置于呼吸文案上方 +「正在看这台机器的资源…」呼吸动效。**300ms 延迟出现**(§5.9 例外):300ms 内判定完成则一帧 Loading 都不闪;超过才显示。这是「禁全屏 spinner」的唯一首启例外,不得用于其它页面。
- `probe` 失败:第三态错误卡「没连上本机服务/读不到配置」+ 重试。`probe=null` 不得当成 `dialogReady=true` 的 fail-open,不得渲染成「已配好」。
- `remote-mobile`:仅 `mobile_lan_route_rejected`。直挂移动树,宽屏不重定向桌面。
- 未配好且未 peek:直接渲染向导,不先挂 `Layout`。
- 已配好或已 peek:挂载 `AppContent`;桌面 peek 后保留顶栏 `SetupBanner`。配置成功(晋升重启完成)后清除 `peeked`,并按完成流刷新判定或整页进入 `#/chat-new`。本机移动壳 peek 后的返回入口=移动菜单内「完成配置」(仅未配好时显示,跳桌面向导路由并提示宽窗)。已配好用户仍会经过首载 Loading 门,但不误进向导、不改配置。`remote-mobile` 即使已 peek 也不落到 `app`。

**融合页(快速/高级收成同一页)**:左右分栏消解互斥双视图。高级独立视图(`SetupWizard` step 1–4)与右上「高级配置」切换按钮退役;`SupplyPicker` 不删,降为槽行「切换提供商」popover 内核(逐槽 CLI/API/跳过 + API 表单 + key 复用 + 行内重探)。`GlobalSettings` 内嵌向导**强制上下回落**,永不分栏。

- **左栏**=主供给选择器(纵向单选;回落形态=既有供给网格):可选「我的混搭」快照卡(见下)+ 已就绪家 +「添加 API 直连」+ 底部「另有 N 家未就绪」折叠 +「重新检测」。点左栏某家 → 右栏四槽整体切换为该家预置(`allCliPlan` / `apiKeyPlan`)。再点当前左栏家=no-op。切到另一家=直接切换,不弹覆盖确认;已有混搭以快照卡形式保留,数据不丢。
- **右栏**=五个用途区(对话/沉思/廉价/评估/开发;轻分组,区间细墨线,不做重卡片)。对话/沉思/廉价/评估可切换提供商、可换模型;开发槽只读「留空 · 稍后在设置里配」,无切换提供商、无预置(省略 `[models.dev]`)。
- **混搭快照**:槽行「切换提供商」打开 `SupplyPicker` popover。单槽改过(含只改模型)=左栏顶部出现「我的混搭」卡(印泥朱徽;副文「以 \<底家\> 为底 · N 槽自定义」),选中态落在该卡;槽行混搭徽。点「我的混搭」=恢复快照;继续编辑=更新快照。混搭槽清零(各槽回到快照底家 `defaultSlotModels` 的 provider+模型)→ 快照解散、卡消失,启动按钮回「全用它,启动」;快照存在且正在看它时按钮=「按这套配置,启动」。快照为会话内存态,不落盘。不提供「跟回」槽行入口——快照卡已承担回得去。v3.1 切家覆盖确认框退役。
- **ack 单源**:`requiredAcksForSupplies(supplies) → PlanAcks`。console **不推断家族**:评估槽=CLI ⇒ 恒双 ack;评估槽=API ⇒ 不前置勾选,沿用「先存、validate 422 再原位摊开」。dialog 换 API 必走完整表单(baseURL/key/模型);已存 key 按 `probe.secrets` 选,无则展开「添加 API 直连」表单。禁止复用 `mixedPlan` 的假 OpenRouter key。
- **自检失败去向**:原位失败卡=死因人话 +「重试」+ 原地「对话改走 API」(对话槽切 API、标混搭、展开 key 表单)。不再跳高级、不套假 OR key。
- **语音**:向导零语音职责。`GlobalSettings` 增「语音」独立小节(表单复用原 step 3 VOLC 字段)。
- **设置页入口改道**:「撤销评估豁免」→ 打开向导并自动把评估槽置 API 待配;存量 dialog=CLI「重新配置」→ 打开向导并聚焦对话槽。

**可用供给列表**(只列可用项):

- CLI:检测成功 + `logged_in` + wired(inventory 如 opencode 即便可枚举也不进列表,`provider:null`)。
- API:**已存 key**(文案「已存 key · 有效性以启动自检为准」)。probe 只有 `secretPresent` 布尔,禁写「有效」。
- 每行:名称 + 一句人话(「已登录 · 本机用过 2 个模型」/「已存 key · 秒级返回 · 按量计费」)。版本号/构建 hash 移入未就绪入口与设置页。
- 排序沿用 `sortCliCapabilities`;首项默认选中。
- 空态:「登录一个本机 CLI,或添加 API 直连」+「添加 API 直连」动作(展开 baseURL/key/模型表单;提交后按 one-key 语义构造完整四槽 pending,进入下方确认流)+ 未就绪入口。

**推荐卡取消**:底部推荐卡 / mixed 卡 / one-key 卡整体取消。推荐语义=列表首项默认选中;API 直连=列表一员;混搭=右栏逐槽切换提供商 + 左栏「我的混搭」快照卡。`generateResourcePlans` 三席逻辑退役;`allCliPlan` 保留为「选中供给 → 四槽方案」factory;`mixedPlan` 保留但不再自动降级、也不再作为 dialog→API 的 key 来源。

**选中态与启动**(二层确认弹窗删除):

- 左栏列表行=单选。选中 → 右栏五用途区切到该家预置 + 代价一句话 + 按 `requiredAcksForSupplies` 显隐的 ack +「全用它,启动」(正在看混搭快照时「按这套配置,启动」)。`busy` 时禁止切换提供商/切左栏。
- 点启动复用完整链(T17/T18 状态机零改动):双 ack 检查 → ack 写进 `models` → `writeSetupConfigStaged`(只写 pending) → staged self-test → 通过才重启 → live self-test。发起 restart 前先把目标 hash 置为 `#/chat-new`。禁止简化成 save → restart。
- 启动后锁定列表与四槽草稿(`busy` 锁);四步进度 + 已用时长显示在右栏启动区原位;失败详情原位展开。
- 全 CLI 方案必须写明 dialog「每轮约 15-25 秒」(槽行内保留「CLI 慢速 / API 秒回」如实提示),并让 owner 分别确认 evaluator 隔离边界与同族风险,不得静默代写 ack。失败配置不激活。
- **单家 API 预设方案的同族 ack 前置(owner 2026-08-15 裁决:异族规则优先级低于开箱即用)**:当**预设方案**四槽共用同一单家直连端点(如 DeepSeek 一键)、evaluator 必然与 dialog/thinking 同族时,该方案自带 `requiredAcks.evaluatorSameFamily = true`,ack **前置展示且默认勾选**(代价文案沿用既有 ack 行措辞,canonical 不另立新串)。这**不是静默代写**——ack 可见、可取消、写入 config 前用户看得到;禁止的是"不展示就写 true"。理由:用户只有一家 provider 时,撞一次 422 才看到一个看不懂的开关,是开箱即用的净损失。**适用边界(三条都是实现事实,不是愿景)**:① 只对方案自带的前置 ack 生效——用户**手工组合**出的 API 同族**仍走「先存、422 再摊开」**,因为 console 不推断模型家族(`familyOf` 单源在 daemon),任意组合无法在前端预判,且不得为此在前端重造家族表(契约不分叉);② evaluator 槽一旦被改成非预设值,回落 `requiredAcksForSupplies` 的 live 计算,不再挂无谓的 ack;③ 只放松 API 同族——**CLI 的 `evaluatorIsolation` 双 ack 仍不得默认勾选**,同族是相关错误链的质量问题,隔离边界是「evaluator 可读 `~/.saydo/` 内 Brain 自辩」的独立性不可证问题(09 §11 规则 4),性质不同(收窄解读,待 owner 复核)。
- 「跳过(留空)」保留在沉思/廉价/评估的「切换提供商」popover(对话槽不可跳;开发槽无此入口)。

**模型选择器**:每槽一个 `ModelCombo`。点击输入框立即展开**全量**候选列表(`max-height` 约 320px 内滚动;不得用当前已选模型 id 当过滤词把列表收成一项);输入框兼过滤(打字即筛,清空回全量);「匹配 x / N」保留;键盘上下/Enter/Escape 沿用。页面级下拉为 **absolute 浮层**(锚定输入框下方,`z-index: var(--z-setup-overlay)`,不占布局流——展开零重排,禁 `position:static` 挤压);浮层=纸面白底 + 明确墨线边框 + `--shadow-card-hover`;高亮项用浅黛蓝洗底 + 墨字(次行 label 可读)。**全局同刻至多一个浮层**:打开模型下拉或「切换提供商」popover 须关掉另一个;popover 内的模型列表是内嵌区域(in-flow,不另起浮层)。Esc 与点击外部关闭。可枚举家(cursor/grok)=listed 列表 + 搜索;codex=used/configured chips + 可编辑输入;claude=used/alias chips + 可编辑输入;传输型(qwen/gemini/copilot)=可编辑输入 +「以你 CLI 配置的上游为准」。`CLI_PROVIDER_CONTRACT` 是可编辑性与槽位预置单源,禁止组件内另立 provider 名单或散写预置。四槽跟随联动取消:选中一家即按预置表填差异化初值,改哪槽只动哪槽。dev 槽文案「留空 · 稍后在设置里配」,语义=省略整个 `[models.dev]`。用户可见文案遵守 §10.1:不解释交互、不重复教学。`ModelCombo` 不在槽下写「点输入框看全部 / 打字可筛选 / 从本机记录里找到这些」;可枚举 placeholder=「搜索模型(共 N 个)」,不可枚举=「搜索或直接填模型名(已知 N 个)」(已知数已含来源)。槽行入口文案是「切换提供商」,禁止「换家 · \<家名\>」。

**槽位预置表**(`CLI_PROVIDER_CONTRACT.defaultSlotModels`;选中即四槽各就各位。探测能匹配预置 id 时用探测 id,防大小写/前缀漂移;匹配不到时可枚举家回退列表首项、不可枚举家回退预置串):

| provider | 对话/沉思/评估(思考档) | 廉价 |
|---|---|---|
| `codex_cli` | `gpt-5.6-sol` | `gpt-5.6-luna` |
| `claude_cli` | Fable 5 系(探测 alias/used 真名,如 `claude-fable-5`) | Opus 5 系(如 `claude-opus-5`) |
| `cursor_cli` | `cursor-grok-4.6-high-fast` | `composer-2.5-fast` |
| `grok_cli` | 探测所列模型(现 `grok-4.6`) | 同左 |
| `gemini_cli` | `gemini-3.2-pro` | `gemini-3.2-flash` |
| `qwen_cli` 等传输型 | 探测 configured/observed(单值填四槽) | 同左 |
| `copilot_cli` | 公开稳定名单值(`gpt-5.2`,help 实证) | 同左 |
| API 直连 | 用户自填(one-key 表单,保持现状) | — |

**检测策略**:

- 阶段 1=现有并行 probe(单家 3.5s,整体约 4s)。
- 阶段 2=对超时/unknown 家,前端自动调一次轻量重探端点 `POST /api/setup/cli-capability/reprobe`(逐家 `bypassCache` 并行、单家 8s 预算、不做模型真实调用)。完成后**增量合并回主列表**(新登录成功的家立刻入列)。整体两阶段 ≤13s。禁止「完成一家亮一家」的逐家增量协议;阶段 1/2 都是该轮全部返回后再合并。
- 检测中态(阶段 1+2 全程):列表区顶部进度行「正在清点这台机器能用的模型来源…」(墨色 `--text-base` + 前置 CSS 呼吸圆点,禁 emoji);供给网格区渲染 3 张骨架卡(纸面浅块 `--surface` 系 + 标题条/副文条轮廓 + 呼吸 opacity 0.55→0.85 / 1.6s)。两阶段之间不闪空;两阶段都结束后骨架整批替换为真卡。空态(检测完零可用)保持引导卡。
- `confirm` 保留为显式动作(未就绪入口里「真实测一发(约 15-25 秒,会调用一次该 CLI)」),不再自动触发——额度消耗必须用户显式点。
- 两轮后不可用者不进主列表。未就绪入口=列表底部「另有 N 家未就绪」→ 逐家:原因人话(「未登录,跑 `claude auth login` 后点刷新」/「探测超时」/「可识别,暂不能当模型供给(安全原因)」)+ 版本细节。`provider=null` 的 inventory 家(如 Kimi/OpenCode)只留原因说明,不展示「重试」与「真实测一发」(重测也进不了主列表)。探测超时/未登录的 wired 家保留这两钮。整区另有「重新检测」。主列表「测一下」按钮取消。

**向导页装帧**(仅 `SetupGate` / boundary wizard 态;`GlobalSettings` 内嵌向导、App 内页面、移动壳不带页头页尾):

- **分栏坐标系**:视口 `≥1080px` 且非设置页内嵌 → 左右分栏(左栏固定 300px,右栏自适应);内容列 `max-width:1080px`。视口 `<1080px` → 回落上下布局(供给网格断点 1100/720 不变,配置区在网格下方全宽)。720 帽只约束回落态向导页;分栏态例外。`GlobalSettings` 内嵌强制回落。
- 页头品牌笺:通栏约 56px,宣纸底 + 底部细墨线 `--line`(通栏底与墨线保留)。笺内内容(朱印 24px + 「说到 SayDo」组合字标 / 「首次配置」)收进与内容列同宽的容器居中(回落 720 / 分栏 1080),大屏不再顶左贴边。朱印复用 console 侧栏/favicon 同款 `saydo-mark`;字标=`--font-display` 600 18px 墨色(「说到」+ SayDo 并排);右侧「首次配置」=`--text-sm` 暖灰。
- 页尾:逃生门下方细墨线 + 两端小字:左「本机运行 · 数据不出这台电脑」;右「版本 `<sourceRevision` 前 7 位>」(取自 `/health` identity,失败不显示不报错)。
- 标题「先把对话模型配好」与副文收在页头下的内容列;副文自称用「说到」。整页仍纯宣纸,不引新色。

**品牌落点**(Web console 本批;壳 App 显示名归上架线,`apps/` 零接触):

- `index.html` `<title>`、向导页头/Loading(`SayDoBrandLockup`)、桌面侧栏、移动菜单字标:一律「说到 SayDo」。
- 向导副文等产品自称用「说到」。技术错误文案(`apiError` 等)自称本批不动。

### 5.9 空态/加载/错误

- 空态:24px muted 图标 + 一句话 + 一个动作;不放插画。
- 加载:骨架屏(`--surface-soft` 纸面浅块微闪),300ms 内完成的不显示;禁全屏 spinner。**唯一例外**:首启 `SetupBootstrapBoundary` 在判定超过 300ms 仍未完成时,允许全屏品牌呼吸 Loading(见 §5.8a);300ms 内完成则一帧都不闪。其它页面不得援引此例外。
- 错误:error 描边卡 + 人话一句 + 原始错误(mono,折叠)+ retryable 时的重试按钮(§13 错误合同的 UI 面)。

### 5.10 对话输入区(R-A 2026-07-26 新增;场次① owner 反馈;W4 三态实施;**双动作四态改版 2026-07-28**——owner dogfood 反馈:无转写反馈被当卡死/转写双写对话流与编辑框/直发与编辑必须是两个显式动作)

对话页布局分两区,**恒定上下关系**:上 = **消息流**(转写流 §5.6,历史往上滚)、下 = **输入区**(常驻底部)——两区物理分离,消息(AI 输出/用户已发轮)只进消息流、**绝不渲染进输入区**(修场次① "Output 叠 Input" bug:§5.6 消息流内部 AI 句与用户轮按到达序 `seq` 交错,非两列表拼接)。输入区规格:

- **四态 × 双动作**:① 待命(麦克风按钮 + 文本框 + 模式切换;点麦或按住空格进录音,直接打字回车发)② **录音中**(实时电平 + 计时 mono + 结束三选:「**发送**」主按钮(动作 A·直接发送;松开空格同义)/「**转文字改一改**」次按钮(动作 B·转写编辑)/「取消」(Esc 同义,彻底丢弃——不进对话、不打扰 AI,daemon 侧走 hold 语义零痕迹)③ **转写中**(仅 B 档占输入区:「转写中…」显式等待反馈 + 可先打字;**任何异步等待必须有状态呈现,禁止静默等待**)④ **待确认**(仅 B 档:可编辑转写 + "发送"主按钮 + "重录";提示明示"这里的内容 AI 还看不到")。
- **动作 A·直接发送(主路径,低摩擦)**:松开即发——消息流**立刻**插入语音气泡占位「语音 mm:ss · 转写中…」(已发出语义先行),转写到达后同气泡替换为文字(保留时长标签),同时"思考中…"出现(Brain 开跑);空转写/超时 ⇒ 气泡置失败态「没听清(转写失败),请重说」。**转写去向唯一**:A 档只进消息流。
- **动作 B·转写编辑(纠错通道)**:转写**只进输入框**(绝不进消息流、不触发思考中),用户改字后发送才进对话(10 #8/#9 纠错链);转写中已打字则后到转写不覆盖;空转写/超时 ⇒ 显式错误条「没听清——重说一次,或直接打字」。
- **免手档(hands_free)**:VAD 自动断轮天然直发语义(A 档),不变。
- **思考中反馈**(场次① A3;02 §3 learning 一等状态):用户轮发出(A 档转写到达/文本发送)到 Brain 首句回话之间,消息流末尾显示"思考中…"占位;首句 TTS 到达即替换,45s 兜底自动清——**不留白让用户以为卡死;B 档转写期间绝不显示思考中**(AI 尚未收到任何内容)。
- **CLI 慢速模式**:probe 的 dialog `mode="oneshot"` 时,对话页常驻徽标"CLI 慢速模式·每轮约 15-25 秒·配 API key 立即变快"。轮次进行中使用现有 turn/thinking 状态显示按秒更新的"CLI 慢速模式处理中",这是 UI 状态而非 assistant 消息,不得写入对话历史。
- **语音未配置**:probe 表明 ASR 未配置/不可用时,「点击说话」与模式切换禁用,不得点击后无声失败;固定人话为"语音未配置(可选)——用键盘上的话筒,或直接打字;配好豆包 key 后这里可以开口即说"。文本输入和发送保持可用。
- **轮次守恒(09 §10 同批合同)**:PTT 下每个 done_speaking 恰好一个 asr.final(可空)——console 采集意图按 FIFO 队列逐条消费(直发/编辑/取消三种意图),超时(录音时长+30s,至少 20s)逐出并置失败态。
- 状态词纪律:输入区任何提示文案禁结果句式(10 §4-1);禁 emoji(§12)。

### 5.1 三面一栏新组件登记(2026-08-08 增设;视觉参考实现=demo/saydo-console-redesign-proposal.html,唯一样式规范)

> **视觉参考实现已过期(2026-08-13 标注)**:`demo/saydo-console-redesign-proposal.html` 内嵌的是**换芯前的雾灰蓝玻璃色板**(`#edf0f6` 画布 / `#2b5fd9` 蓝 / `--glass-*` 旧名),纸上账本换芯与本批 token 归一都未回灌进去。它只能当**布局与信息结构**的参考;**色彩/圆角/token 一律以 §2 为准**,冲突时 §2 胜。重刷 demo 归独立批。
>
> **实施状态(2026-08-09)**:下表组件已全部落地(components/redesign/ 16 组件+4 页+接线,含通知铃/AttentionItemCard 对齐轮);"分批"列保留为历史规划痕迹。确认卡的 v0.4 落账语义、期待组(ExpectationGroup 已接入右栏)与 DriftCard(daemon 侧 expectation_adjusted 已备,前端接线归消费批)见 09 §15.1。

| 组件 | 要点 | 分批 |
|---|---|---|
| 四色收件箱条目 | 左色条(橙/蓝/绿/灰)+标题+Focus 归属+needs 标签;绿/灰带「知道了」(ack),橙/蓝无 ack(源数据驱动消失) | ② |
| 任务状态 chip | CHIP_TABLE 16 呈现态四联映射(状态→颜色→图标→文案)全站唯一渲染表,消费 TaskRowView.viewStatus,禁读原始 status | ② |
| 球权徽章 | owner 三色(我来做/需要你/外部);数字徽章全站单源=attention,openByOwner 仅文字描述 | ② |
| 决策包卡 | 做出来什么样/做不做/每步谁做/验收标准/成本熔断/预授权(所闻即所签)/怎么跑二选一无默认 | ③b |
| 确认卡 | 按 daemon 真实 kind 枚举投影;倒计时;「也可以直接开口回答」;超时语义按 v0.4 落账机制 | ③b |
| 进度对齐卡 | AI 主动对账:决策包步进/产物计数/下一步在谁 | ③a |
| 待命卡 | 虚线边;在等什么+叫醒条件+到期兜底 | ③a |
| 采访卡 | 一次一问,选择题优先,口播选项≤3,推荐只占徽章不占预选位 | ③b |
| 会话段卡 | timeline 历史会话折叠段,点开懒加载转写;未存转写显示占位不伪造 | ③a |
| 验收面 | 左标准清单(机器验/自报/人工三源;自报=空心勾降权)右证据;讲给我听三层;判断可推翻;S3 独立按钮 | ④ |

## 6. 通知与外呼文本(ntfy/桌面通知)

- 纯文本,**无 emoji、无 markdown**;首行=一句话事实(≤40 字,状态词纪律),次行=项目/任务名;不带敏感 payload(转写原文/diff 内容/密钥,推送隐私对齐 03 §7)。
- 标题格式:`SayDo · {项目名}`;正文以动词开头("等你验收:…"/"需要你补:…")。
- 电话(P1)与 TTS 文案归 10,不在此重复。

## 7. Demo/营销页(P0.5-E Demo 生成器)

- 允许 display 衬线标题与更宽的留白,但 token 同源(§2);决策包 Demo 的元素编号与 plan.seq 互引(02 §5)。
- 现存 `demo/saydo-console-demo.html` **已按本篇对齐(v5,2026-07-24 重刷并截图验证)**;新 Demo 生成器直接按本篇出。

## 8. CLI 与日志输出(工程面同样受禁 emoji 约束)

- daemon/工具日志:结构化 JSONL 为主;人读行用 `level=info msg="..."` 风格,状态标记用 `[ok]/[warn]/[fail]` 文本,**不用勾叉警告类 pictographic 字符**(U+2705/U+274C/U+26A0 之流)。
- 进度输出用纯文本计数(`3/8`)或百分比;不画花哨进度条。
- 终端色:仅 stderr 错误红、警告黄两色,依赖 `NO_COLOR` 约定可关。

## 9. 可及性基线(P0 卫生线;纯文字无障碍模式=非目标,05 §6)

- 对比度:正文 ≥4.5:1,大字/次文 ≥3:1(两主题都验;§2.5 色板已按此调过)。
- 焦点:全站 `:focus-visible` ink 焦点环(2px,offset 2px);键盘可达所有操作,审批卡有显式 tab 序。
- 点击目标 ≥40×40px(移动 ≥44);表格行内文字按钮除外(但提供行级焦点)。
- 色盲安全:状态不只靠色——chip 恒带图标+文字(§2.6 的四联映射保证)。

## 10. 文案书写规则(书面;口播归 10)

### 10.1 产品哲学(2026-08-13 owner 裁决)

功能上做的门槛低,和把用户当成笨蛋,是两种不同的产品思路。

文案标准=高级、简洁:

- **不解释交互本身**。按钮、输入框、下拉、展开的用法应自明,helper 不教「点哪里 / 打字会怎样」。
- **不重复教学**。同一信息只出现一处(placeholder、空态、知情行择一,不叠第二句复述)。
- **只说用户不点不知道的信息**:代价、风险、来源、状态。知情类(CLI 慢速、代价行、双 ack、未就绪原因、检测进度)保留;教怎么用控件的句子删除。

门槛低靠交互自明与默认合理,不靠把界面写成说明书。

### 10.2 书写细则

- 中文为主,中英文与数字之间留半角空格;标点全角;金额"N 元"、时长"N 分钟"。
- 术语表:验收(不说"审核")、拍板(不说"提交")、回叫(不说"提醒")、作废(不说"失效");与 10 词表一致。
- 大小写:产品名「说到 SayDo」(字标组合);中文自称「说到」;代码/命令/仓库名仍写 `SayDo`/`saydo`,一律代码体(mono),不加书名号。
- 禁:感叹号堆叠、"成功!"式庆祝语、拟人卖萌("我尽力啦")、emoji(§0-5)。

## 11. 主题与个性化边界

P0 提供:亮/暗/跟随系统 + 免打扰。**不提供**:自定义主题色、字号缩放(用浏览器缩放)、卡片密度选项。个性化最小化是维护成本决策(owner v2.3 反空壳纪律的延伸)。

## 12. 工程落地与门禁

- token 文件:`packages/console/src/styles/tokens.css`(与本篇 §2 同步,PR 里两处一起改);Tailwind 经 `@theme` 消费同一组变量;移动 `mobile.css` 只做消费映射,不得自定义色值/字号。
- **写死色值 CI 门禁**:`bash scripts/check-hardcoded-colors.sh`(口径与白名单见 §2.7a),自测 `scripts/test-color-gate.sh`;两者已接入 `ci:node` 与 `just ci-node`。
- **禁 emoji CI 门禁(0.1 脚手架即接)**:对 git 追踪的全部文本文件跑
  `rg -nP "[\p{Emoji_Presentation}\x{FE0F}\x{1F000}-\x{1FAFF}\x{2600}-\x{27BF}]" --glob '!node_modules'`,
  命中即 CI 红;无豁免清单。HTML/Markdown numeric entity 与 HTML script 的 Unicode escape
  必须按解码后的码点再扫，禁止“源码无字符、浏览器仍渲染 emoji”的绕过；测试源码中的转义夹具
  可以保留，但可渲染载体必须改 inline SVG 或文本标记。口径:封禁真 emoji(含变体选择符)与杂项
  符号/装饰区(勾/叉/警告/星形之流);**纯文本箭头与数学符号(U+2190–U+21FF 的 `→`/`↔` 等)不在禁区**——技术文档与注释的 `A→B`、`taskId↔runId` 是合法写法。文本 lockfile 同样扫描，不作为二进制豁免。2026-07-29 单仓迁移后适用于 SayDo 全仓;迁入历史文本已做确定性文本标记转换，原始字节保留在冻结冷档。门禁自测含 literal、文本 lockfile、entity、HTML script escape 与错误路径共 11 项。
- 组件新增流程:先查 shadcn/Radix 有无现成 → 有则收进 `components/ui/` 定制 token → 无则自建并回写本篇 §5。
- 视觉回归:Phase 5 起 Playwright 截图基线(亮暗各 11 页),token 改动必须重录基线。
  - **2026-08-13 实测:该基线当前录不出来(既有红,与本批无关)**。T19 首启向导门(§5.8a `SetupBootstrapBoundary`)落地后,`e2e/console` 的测试 daemon 是未配置状态,`open()` 又不 peek,于是每条用例拿到的都是「先把对话模型配好」向导页而非应用页——`npx playwright test` 现为 29 failed / 3 passed。已在 `main` 的干净 worktree 上跑同一条用例复现同样失败,确认是向导门与 e2e 装配的既有不匹配,不是 token 批引入。**修法归 T19 工作线**(让 global-setup 把测试 HOME 配成 dialog 已武装,或让 `open()` 过门),修好之前 token 改动的视觉证据以「针对性截图」代替(本批留证见 `docs/plan/2026-08-13-ui-standardization-audit.md` §11)。

## 13. 与其他文档的关系

| 文档 | 分工 |
|---|---|
| 10 语音 UX | 口播话术/状态词/数字纪律(本篇的文案层引用它) |
| 08 §6 / modules/d-presentation | 信息架构与页面清单(本篇管每页长什么样) |
| 09 §7 | 状态枚举真相源(§2.6 映射表的键) |
| 05 §4 | review 面最小交付线(§5.5 是其视觉合同) |
| OctoBlog tokens.css | token 上游参照(同名同值起步,分叉时本篇为 SayDo 真相源) |
