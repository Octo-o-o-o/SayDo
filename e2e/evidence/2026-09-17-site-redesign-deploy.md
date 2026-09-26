# 官网 White Edition 改版部署证据(2026-09-17)

owner 任务:官网按 `index(3).html`(首页)与 `quick_start(1).html`(Quick Start)设计稿完全对齐,补齐 demo 未覆盖的既有官网 UI,部署到 production。

## 提交链(internal main,父 `c012c97`)

| 提交 | 内容 |
|---|---|
| `8086af1` | feat(site):首页中英对齐 White Edition;新增 `/quick-start/`、`/en/quick-start/`;8 个保留子页导航/主题兼容;`site.css` +99;`theme.js`;`_redirects` |
| `a06613d` | fix(site):回修评审 major——首页补 `id="faq"`;英文页 `data-internal` 链接规范到 `/en/` |
| `7d40e9d` | fix(site):首页恢复 rc.13 availability 锚句(非切换 `.micro` 元素,门禁逐字匹配要求) |
| `6c19e1e` | chore(evidence):评审记录 `research/codex-findings/2026-09-17-site-redesign-review.md` |

## 评审与门禁

- 零上下文评审(fresh-context 只读 subagent,detached worktree 冻结 ref,指纹 `e42dd19c…` 派发前后一致):轮 0 RED(major faq 锚点 + minor en 路由)→ 轮 1 GREEN → 轮 2 YELLOW(仅"锚句不随语言切换"的门禁约束 minor)。遗留登记:terms/support/privacy 存量 QR 配对文案与新口径不一致,非本次引入,待 owner 另行排期。
- 本地基线:`just ci` 全绿(最终 HEAD `6c19e1e`);`pnpm exec playwright test` 41/41(同 HEAD);headless 浏览器桌面/390px/暗色/双语路由/锚点/无 JS error 全过。
- 部署门禁对照:`post-release-gate.mjs --deploy` 的 `exactPublicMain` 要求把整仓新快照推到 public 仓并经 public CI——"公开快照"是独立 owner checkpoint,不在本次授权范围;故沿用 rc.13 已验证的 `wrangler pages deploy`(OAuth)路径,人工满足不变量:main 分支、工作树 clean、HEAD `6c19e1e` == `origin/main`。`saydo-link` 未改动未重部署。

## 部署

| 阶段 | 结果 |
|---|---|
| preview `preview-site-redesign-20260917` | `1f5b6502` / alias `preview-site-redesign-202609.saydo-3xb.pages.dev`:15 条路由全 200,锚点/标记齐,install.sh text/plain+nosniff;headless 交互(主题/语言/复制命令/移动宽)零 console error |
| production `main` | `b9c53998`(wrangler `pages deploy deploy/saydo-octoooo-com --project-name saydo --branch main --commit-hash 6c19e1e… --commit-dirty=false`) |

## 线上核验(saydo.octoooo.com,部署后实测)

- 12 条页面路由全 200:`/ /en/ /quick-start/ /en/quick-start/ /docs/ /en/docs/ /privacy/ /en/privacy/ /terms/ /en/terms/ /support/ /en/support/`
- `install.sh`/`install.ps1`/`install-core.ps1` 200,`text/plain`,线上 SHA-256 与仓内全等
- availability 锚 zh/en 各 1;`id="faq"` 双语各 1;`id="voice-setup"` 1;`iOS<i>开发中</i>`/`iOS<i>In dev</i>` 各 1
- headless 线上复测:首页 390px 无溢出、移动导航可开;`/en/` lang=en、`#faq` 落点、主题切 dark、`/en/quick-start/` 落地正确;无页面 JS error
- 已知行为声明:新页面带设计稿自带 CSP meta(`default-src 'none'`),Cloudflare 自注入 `beacon.min.js`(Web Analytics)在首页/Quick Start 被拦——与页脚"无追踪"口径一致;`_headers` 未改动。若 owner 需要该 analytics 可另议。

## not_run / 如实登记

- `saydo-link` 未改动未重部署。
- 未走 `--deploy` 门禁全链(需整仓公开快照,超出本次授权);Cloudflare API 侧 listDeployments 核验未做,以 wrangler 输出 + 线上实测为准。
- Windows 真机访问线上页面 not_run。
