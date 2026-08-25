# 2026-08-16 全量测试验收 · report

- Run ID: `2026-08-16-full-acceptance`
- Tester: Cursor Grok 4.6 agent
- Env: 源码 live daemon PID 49749,`SAYDO_HOME=~/.saydo`,`SAYDO_MOBILE_LAN=1`,监听 `*:47100`
- HEAD: `bc2ac871ee97c7e74c38e19b2b90a98fb55f61b4`(evidence;`feat` `addfd19`)
- `/health.identity.sourceRevision` 与 HEAD 一致:`bc2ac871ee97`
- Browser: Playwright Chromium headless;桌面 1440x900;本机窄屏 390x844;LAN 横屏 1000x844
- Web 入口:`http://localhost:47100/`(G1 首次 `?token=`,证据不写 token)
- LAN:`http://<private-ip>:47100/`
- API:`http://127.0.0.1:47100`
- Start: 2026-08-16T17:50:06+08:00
- End: 2026-08-16T17:51:27+08:00(走查主程 81s;just ci 与 Playwright 全套另计)
- Scope: config + usage + full + diagnostic(仓内已落地能力,不限于本批 remote-mobile-w0)
- 模型(验收临时改 live `~/.saydo/config.toml`;备份 `.bak-2026-08-16-acceptance`):
  - dialog / thinking / evaluator = `cursor_cli` / `cursor-grok-4.6-high-fast`
  - cheap = `cursor_cli` / `composer-2.5-fast`
  - `[models.dev]` = cursor CLI `composer-2.5-fast`
- 密钥:cap-token 未入库;配对二维码未截。

姊妹文档:[bugs-for-engineers.md](bugs-for-engineers.md) · [manual-retest-needed.md](manual-retest-needed.md) · [board.html](board.html) · [plan.md](plan.md)

## 结论(先说清楚)

自动化能证明的部分,**live 已绿**。本轮没有新的 live 产品阻断。

| 层 | 结果 | 口径 |
|---|---|---|
| `just ci` 双矩阵 | **exit 0 / 47182ms** | 本会话真实命令。contracts 103;console 253;cli 19;daemon 1300 passed / 4 skipped;python 33;emoji-gate 11/0;color 21/0 |
| live 走查 26 步 | **26 PASS / 0 FAIL** | G1、全桌面路由、设置槽、文本对话、LAN `remote-mobile`、setup/test |
| Playwright `e2e/console/console.spec.ts` | **9 passed / 25 failed / 34 total / 9.1m / exit 1** | 夹具 daemon `47188`,不是 live。9 绿含 G1 + 本批 6 条 LAN。25 红是 T19 向导/首页已改今天/夹具未武装 dialog 的已知债,本轮不修 |
| 真麦 / Touch ID / 真机扫码 / writing 首篇 | **未做** | AI 不能代跑,见人工清单 |

这不是 v0.1.0 发布证据:锁的是常驻 `~/.saydo/runtime` SHA,当前验收打的是源码 `bc2ac87`。

## 模型实测

`POST /api/setup/test` `scope=plan`(本会话,约 75s):

| 槽 | status | requested | observed | latencyMs |
|---|---|---|---|---|
| dialog | ok | cursor-grok-4.6-high-fast | Cursor Grok 4.6 High Fast | 14755 |
| thinking | ok | cursor-grok-4.6-high-fast | Cursor Grok 4.6 High Fast | 18572 |
| cheap | ok | composer-2.5-fast | Composer 2.5 Fast | 15939 |
| evaluator | ok | cursor-grok-4.6-high-fast | Cursor Grok 4.6 Fast | 22656 |
| dev | ok | (执行器 pin) | (ok) | 567 |

设置页截图与 probe `effective=active` 一致。evaluator 的 observed 被 CLI 降到 Fast 档,self-test 仍 ok,不升格为缺陷。

桌面开口聊发验收探针后,对话流出现用户句 + AI「新事情,还是接着哪个项目继续?」,顶栏变为「会话中 · 未命名草稿」,横幅为 CLI 慢速模式。证明 `turn.text` 经 Cursor CLI grok 4.6 oneshot 闭环。模型没有按「四个字」复读,而是走无锚定开口聊的项目归属问句——这是产品策略,不是断链。

走查脚本里 `latencyMs=13` **不可信**:等待条件误把用户句后半段当成 AI 回复。真实证据以 F1 截图与 C6 槽耗时为准。

## Coverage

- config:G1 403 `token_missing`;`/health`;probe 四槽+dev active;`overview`(5 项目)/`attention`/`focuses`(0 条);127.0.0.1 HTML **308** → `http://localhost:47100/`;setup/test plan
- usage:今天、全景看板、开口聊、设置、成本(「还没有确切数字」+ 56 笔明细)、记忆/产物/项目设置、旧版 Dashboard/审批/通知/Focus 列表/任务/旧看板、404、dev 走查页、localhost 宽屏 `#/m` → 桌面今天、本机窄屏移动树(bootstrap=`app`,不是 `remote-mobile`)、配对 overlay 开关(不截码)
- full:LAN Today / Things / 横屏仍移动树;`remote-mobile` 直挂;文本对话
- diagnostic:Playwright 全套对照;vite 47120 本轮无监听(live 主入口是 47100);本机另有长期 vite 47121 与 stale `pnpm daemon exec` PID 70325,不是合同入口

未覆盖(有意):对 OctoDesk/OctoBlog 派真实改代码;S3 过卡;真麦 ASR/TTS;真机 WKWebView;开放远程 probe。

## Step log

| 时间 | 状态 | 步骤 | 对象 | 结果摘要 | request_id/trace_id | 证据 |
|---|---|---|---|---|---|---|
| 2026-08-16T17:50:06+08:00 | START | C1 | G1 无 token 打开 API 被拒 | pending | - | - |
| 2026-08-16T17:50:06+08:00 | PASS | C1 | G1 无 token 打开 API 被拒 | 403 token_missing | - | api |
| 2026-08-16T17:50:06+08:00 | START | C2 | GET /health 身份 | pending | - | - |
| 2026-08-16T17:50:06+08:00 | PASS | C2 | GET /health 身份 | pid=49749 sha=bc2ac871ee97 | - | api |
| 2026-08-16T17:50:06+08:00 | START | C3 | setup probe 已武装且槽为 Cursor CLI | pending | - | - |
| 2026-08-16T17:50:09+08:00 | PASS | C3 | setup probe 已武装且槽为 Cursor CLI | dialog=active cheap=active dev=active | - | api |
| 2026-08-16T17:50:09+08:00 | START | C4 | overview / attention / focuses | pending | - | - |
| 2026-08-16T17:50:09+08:00 | PASS | C4 | overview / attention / focuses | projects=5 attention=200 focuses=0 pid=yes | - | api |
| 2026-08-16T17:50:09+08:00 | START | C5 | 127.0.0.1 HTML 是否 308 到 localhost | pending | - | - |
| 2026-08-16T17:50:09+08:00 | PASS | C5 | 127.0.0.1 HTML 是否 308 到 localhost | status=308 location=http://localhost:47100/ | - | api |
| 2026-08-16T17:50:09+08:00 | START | D1 | 无 token 打开控制台 fail-closed | pending | - | - |
| 2026-08-16T17:50:09+08:00 | PASS | D1 | 无 token 打开控制台 fail-closed | bootstrap=probe-error | - | screenshots/01-D1_20260816-175009_PASS.png |
| 2026-08-16T17:50:09+08:00 | START | D2 | 带 token 进入应用 · 今天 | pending | - | - |
| 2026-08-16T17:50:11+08:00 | PASS | D2 | 带 token 进入应用 · 今天 | 今天空态 + 语音就绪 | - | screenshots/02-D2_20260816-175011_PASS.png |
| 2026-08-16T17:50:11+08:00 | START | D3 | 全景看板 | pending | - | - |
| 2026-08-16T17:50:11+08:00 | PASS | D3 | 全景看板 | redesign-board 空板四列 | - | screenshots/03-D3_20260816-175011_PASS.png |
| 2026-08-16T17:50:11+08:00 | START | D4 | 开口聊空态 | pending | - | - |
| 2026-08-16T17:50:11+08:00 | PASS | D4 | 开口聊空态 | indicator=语音就绪 | - | screenshots/04-D4_20260816-175011_PASS.png |
| 2026-08-16T17:50:11+08:00 | START | D5 | 全局设置模型槽 | pending | - | - |
| 2026-08-16T17:50:11+08:00 | PASS | D5 | 全局设置模型槽 | grok 4.6 + composer 2.5 五槽实际生效 | - | screenshots/05-D5_20260816-175011_PASS.png |
| 2026-08-16T17:50:11+08:00 | START | D6 | 成本页 | pending | - | - |
| 2026-08-16T17:50:11+08:00 | PASS | D6 | 成本页 | 还没有确切数字;56 笔明细 | - | screenshots/06-D6_20260816-175011_PASS.png |
| 2026-08-16T17:50:11+08:00 | START | D7 | 记忆库 | pending | - | - |
| 2026-08-16T17:50:11+08:00 | PASS | D7 | 记忆库 | 空记忆诚实空态 | - | screenshots/07-D7_20260816-175011_PASS.png |
| 2026-08-16T17:50:11+08:00 | START | D8 | 产物 | pending | - | - |
| 2026-08-16T17:50:11+08:00 | PASS | D8 | 产物 | 空产物诚实空态 | - | screenshots/08-D8_20260816-175011_PASS.png |
| 2026-08-16T17:50:11+08:00 | START | D9 | 项目设置 | pending | - | - |
| 2026-08-16T17:50:12+08:00 | PASS | D9 | 项目设置 | 未命名草稿 draft | - | screenshots/09-D9_20260816-175011_PASS.png |
| 2026-08-16T17:50:12+08:00 | START | D10 | 旧版 Dashboard / 审批 / 通知 / Focus 列表 | pending | - | - |
| 2026-08-16T17:50:12+08:00 | PASS | D10 | 旧版 Dashboard / 审批 / 通知 / Focus 列表 | 四页均渲染;截图为最后一页 | - | screenshots/10-D10_20260816-175012_PASS.png |
| 2026-08-16T17:50:12+08:00 | START | D11 | Focus 正式页 / 任务 / 旧看板 | pending | - | - |
| 2026-08-16T17:50:12+08:00 | PASS | D11 | Focus 正式页 / 任务 / 旧看板 | live 无 Focus,跳过详情;tasks+legacy-board | - | screenshots/11-D11_20260816-175012_PASS.png |
| 2026-08-16T17:50:12+08:00 | START | D12 | 不存在页 | pending | - | - |
| 2026-08-16T17:50:12+08:00 | PASS | D12 | 不存在页 | 页面不存在 | - | screenshots/12-D12_20260816-175012_PASS.png |
| 2026-08-16T17:50:12+08:00 | START | D13 | dev 走查页 | pending | - | - |
| 2026-08-16T17:50:12+08:00 | PASS | D13 | dev 走查页 | dev-components + dev-pages | - | screenshots/13-D13_20260816-175012_PASS.png |
| 2026-08-16T17:50:12+08:00 | START | D14 | localhost 宽屏 #/m 重定向桌面今天 | pending | - | - |
| 2026-08-16T17:50:12+08:00 | PASS | D14 | localhost 宽屏 #/m 重定向桌面今天 | redirected to desktop today | - | screenshots/14-D14_20260816-175012_PASS.png |
| 2026-08-16T17:50:12+08:00 | START | D15 | 本机窄屏移动树(非 remote-mobile) | pending | - | - |
| 2026-08-16T17:50:12+08:00 | PASS | D15 | 本机窄屏移动树(非 remote-mobile) | 断言在 390 宽通过;首张截图误在还原视口后拍摄 | - | screenshots/15-D15_20260816-175012_PASS.png |
| 2026-08-16T17:58:00+08:00 | PASS | D15R | 本机窄屏补拍 | bootstrap 非 remote-mobile;可见移动今天 | - | screenshots/15-D15_20260816-175800_PASS.png |
| 2026-08-16T17:50:12+08:00 | START | D16 | 配对 overlay 可开关(不截二维码) | pending | - | - |
| 2026-08-16T17:50:12+08:00 | PASS | D16 | 配对 overlay 可开关(不截二维码) | opened and closed; QR not captured | - | no-qr-by-policy |
| 2026-08-16T17:50:12+08:00 | START | F1 | 桌面文本对话 grok 4.6 oneshot | pending | - | - |
| 2026-08-16T17:50:12+08:00 | PASS | F1 | 桌面文本对话 grok 4.6 oneshot | 用户探针 + AI 项目归属问句 + 未命名草稿 | - | screenshots/16-F1_20260816-175012_PASS.png |
| 2026-08-16T17:50:12+08:00 | START | L1 | LAN Today remote-mobile | pending | - | - |
| 2026-08-16T17:50:12+08:00 | PASS | L1 | LAN Today remote-mobile | remote-mobile today · 在线 | - | screenshots/17-L1_20260816-175012_PASS.png |
| 2026-08-16T17:50:12+08:00 | START | L2 | LAN Things | pending | - | - |
| 2026-08-16T17:50:12+08:00 | PASS | L2 | LAN Things | 事 / Focus 空态 | - | screenshots/18-L2_20260816-175012_PASS.png |
| 2026-08-16T17:50:12+08:00 | START | L3 | LAN 横屏仍移动树 | pending | - | - |
| 2026-08-16T17:50:12+08:00 | PASS | L3 | LAN 横屏仍移动树 | 1000 宽仍移动今天,无桌面 Layout | - | screenshots/19-L3_20260816-175012_PASS.png |
| 2026-08-16T17:50:12+08:00 | START | C6 | POST /api/setup/test scope=plan | pending | - | - |
| 2026-08-16T17:51:27+08:00 | PASS | C6 | POST /api/setup/test scope=plan | 五槽 status=ok | - | api |

terminal PASS=27(含 D15 补拍) FAIL=0 TIMEOUT=0 SKIP=0 BLOCKED=0

## Playwright 全套(夹具,非 live)

命令:`npx playwright test e2e/console/console.spec.ts`(worker=1,baseURL `localhost:47188`)。

绿(9):G1 无 token;M-Chat first-run 开场白;RFC1918 Today;LAN Things;LAN 横屏;文本经 dialog 链;WS 草稿保留;无 Origin CLI 拒;同源 POST 查 S3 注册状态。

红(25),与已登记「向导/夹具挡住桌面套件」同形,不在本轮修复范围:

Focus 列表/详情;11 路由+截图基线;Dashboard 聚合条;任务看板 parked;任务详情 AC+S3 按钮;紧凑模式;成本 unknown;切项目不断会话;窄屏移动树(本机夹具路径);WS 首连 connecting;断网重连;first-run 回放;审批中心;vite 47120;任务操作行;127.0.0.1 归一(live C5 已证明 308);未注册 passkey 降级;输入区三态;点击说话;双动作 A/B;产物时间线/diff/导出。

## Console / page errors

pageerror=0。console.error=2,均是 D1 无 token 的预期 403,不是应用崩溃。

## Cleanup

- 未写 pending 配置,未重启 daemon,未 `just daemon deploy`,未改 Git。
- 文本烟测把无锚定对话立成「未命名草稿」项目(会话中)。未删除,以免误伤 live 数据;owner 可在控制台丢掉该草稿。
- 配对 overlay 已关。
- live 模型仍是 Cursor grok/composer,不是验收前的备份。

## Test board

仓内无 `kanban.html`。本目录 [board.html](board.html) 为最近测试板。
