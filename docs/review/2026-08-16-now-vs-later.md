# 现在做 / 可后置 · 2026-08-16 更新建议

> 性质:上一轮缺口沟通的复核与收窄。不实施代码;不代 owner 改 v0.1.0 范围。
> 触发:owner 澄清 oTree=worktree,要求区分「现在有价值」「上次疏漏」「可先不做」,交 Codex 交叉审后实施。
> 时间锚:2026-08-16 11:28 +0800 实测。HEAD=`3197fd8`。
> 实施对象若本建议被接受:第 0 步 `remote-mobile`(处方已冻于 `docs/review/2026-08-13-mobile-shell-strategy-final.fable.md` §3,Codex 69/70 收窄)。

## 0. 对上一轮的修正

| 上一轮说法 | 复核 | 证据 |
|---|---|---|
| 提到有 demo recorder worktree,未打开看 | **疏漏,已补。** 官方 `git worktree list` 只有两棵:本仓 `main` @ `3197fd8`;`.repo-demo-recorder/worktrees/saydo-complete-walkthrough` detached @ `946cc68`(main 的祖先,落后 47 提交)。脏区 25 文件/`+70/-75`,含 console 组件、tokens、vite 端口与三端元数据,不是未合入功能分支。`WorkSpace/_worktrees` 是 Hopper/Kit,与 SayDo 无关 | `git worktree list`;`git rev-list --count 946cc68..HEAD`=47 |
| Focus「M3 live 未做」 | **过宽。** HEAD 已有 `focus-m3-live.test.ts` 与 live 出口;缺省 `[focus].stage=0` 写闸关闭。常驻 `ada7981c` 树不含这些文件。口径=HEAD 已实现未开闸,不是「已部署生产只关开关」 | `config/types.ts:97`;`focus/stage.ts` |
| 09 三条 GET「没回写」 | **成立,口径应收紧。** 代码 `mobileLan.ts:16-23` 已放行 `recent-transcript` / `memory/recent` / `projects/:id/memory`;09 M1 段(约 1143 行)只点名 attention/focuses/first-run,三路径名零命中。这是合同落后于实现,不是功能没做 | `rg` 09 零命中;代码白名单有 |
| 本地分支未合入 | **不成立。** 三分支 tip 均无独有提交(ahead=0),只是陈旧名字 | `main...branch` behind/ahead |
| 常驻 runtime 仍是发布锁 | **成立(磁盘树)。** `~/.saydo/runtime` HEAD=`ada7981c`;该树无 M1/T19 文件,真机打常驻不是在撞 T19 probe 门。health 接口会随进程启停变化,不得把一次 curl 写成恒真 | `git -C ~/.saydo/runtime rev-parse HEAD` |
| HANDOFF 停在 7-31 | **成立。** 末次提交 `97b01f7` 2026-07-31 | `git log -1 -- HANDOFF.md` |
| `v0.1.0` 未打 | **成立。** 仅 `v0.1.0-rc.1` | `git tag -l 'v0.1*'` |

## 1. 现在有价值、建议本批就做

唯一工程批 = **LAN `remote-mobile` 第 0 步**(约 2.5 份)。理由不是「清单上还有很多洞」,而是:

1. **处方已冻、代码为零、真机现在不可用。** `SetupBootstrapKind` 仍是 `pending|loading|probe-error|wizard|app`(`SetupBootstrapBoundary.tsx:10`)。LAN 扫码 `GET /api/setup/probe` 得 `mobile_lan_route_rejected`(`index.ts:882`),`SetupContext` 只把 `e.message` 写入 `probeError`(第 80 行),丢掉 `ApiError.code`(`apiError.ts:29` 明明有 code)。结果停在「没连上本机服务」卡,`MobileApp` 永不挂载。本机窄窗 `via=local` 与模拟器 127.0.0.1 掩盖。
2. **只跳过 probe-error 不够。** `isDialogReadyFromProbe(null)===false`(`setupApi.ts:406-407`);`peeked=false` 且 `probe=null` 会进 `wizard`(`SetupBootstrapBoundary.tsx:22`)。必须是新 kind,且该态自己取 `useMobileRoute` **直接挂 `MobileApp`**,不得映射成 `app`(iPhone 横屏 >768 且 iOS 只在 iPad 注入 `__saydoForceMobileShell`,`useMobileViewport.ts:6-11`;LAN 下 `/api/overview` 不在白名单,桌面树 403)。
3. **回前台双监听是代码事实。** `MobileApp.tsx:82-86` 的 `installMobileForegroundReconnect` 在 `visibility=visible` 时无条件 `voice.reconnect()`;`useVoiceChannel.ts:409-416` 另有一份,仅非 OPEN 才重连。A2 = 删 MobileApp 第二份 visibility,保留 iOS `native-resume` 与手动事件,短窗口合并。
4. **09 三条 GET 同批回写。** 不改 allowlist 语义;补路径名 + payload/隐私边界(转写含 sessionId+原文,记忆含 claim 全文)。防止后人按过时合同把 Chat 回放拆掉。
5. **不依赖未拍板项。** tailnet 不纳入本批验收(缺省遵守 09 bootstrap 仅 local)。v0.1.0 范围、ADR-003 不阻塞合入。本批**不部署**常驻:`ada7981c` 无 M1/T19,合入 main 对常驻真机零收益。完成定义 = 代码 + 临时 LAN/Chromium 证据,不宣称 WKWebView 或常驻狗粮。

验收(定向,不救 29 条桌面 e2e;Codex 73/70):

- 单测:未 peek 首开、已 peek、`token_mismatch`/`origin_rejected`/`host_rejected` 仍错误卡;宽视口 `remote-mobile` 仍为移动树。
- Playwright RFC1918:Today、Things、文本、first-run;LAN 横屏仍 `[data-mobile-page]`;记录 Origin/Referer/`Sec-Fetch-Site`。
- 重连:visibility / 手动 / native-resume 单一 owner + 短窗口;覆盖 OPEN 不拆、非 OPEN 重连、连发合并。
- 二维码 Host 先过 RFC1918;非私网不出码。
- `origin_rejected` 禁止旁路。真机若踩,上浮 owner,不扩 G1。
- 不改 `just dev` 默开 `SAYDO_MOBILE_LAN`;不给 Android 注入 force flag;不武装 global-setup 救桌面 29 红。

开批前置(B4,Codex 73 A 级):HANDOFF 指针=`remote-mobile-w0`;PLAN-2 写明 8 月临时轨道插在 W5.4 之前、收口后恢复 W5 剩余。owner 本会话「开始实施」=停点。四场真人验收为并行 owner 轨,不进本代码批、也不排到工程队尾。

## 2. 有价值,但本批先不做

这些不是假缺口。不做是因为 **完整回报链未齐 / 抢同一注意力 / 要 owner 真人时间或拍板**。

| 项 | 为什么先不做 |
|---|---|
| 四场真人验收 / 打 `v0.1.0` | 不进本代码批。但是 **owner 并行轨**,不是工程队尾:先裁决 v0.1.0 target,再部署/preflight,从场次①复验 |
| `native_api` 执行器(19–29 人天) | 独立工程批,不并入进壳。Brain 四槽能跑只证明供给层,不证伪执行器债;若目标改成「无 Cursor 也能改代码」需 owner 另立战役 |
| W5.4 Claude SDK | 设计 ADR-001 产品缺省,实现只有 cursor。挂订阅解锁,与进壳无依赖 |
| R-B 配对/信任五件套 | 上架硬门,但是第 2 步;本周做是半截工程(无 Noise 合同、无凭据面) |
| 设计 ADR-003 / CallKit / Android 语音 / 电话 40–55 日 | 第 3 步,触发线 = 进壳狗粮一周 + R-B + Apple 凭据 |
| Focus 开 stage 1/2 | 代码在;开闸是产品主轴切换,不是进壳阻断 |
| Hopper 生产绑定 | dormant 是刻意的;唤醒要执行器批,不是 UI 门 |
| writing 首篇 / S3 真人过卡 | owner 触点,代码绿 |
| DSH 插件线(`dshp` / 今日泳道插件) | 8-15 已否决当默认 Runner;仓外实验,不占 SayDo 批次指针 |
| W6–W9、5.11 微项篮剩余、sqlite-vec、S2S、本地栈 | PLAN-2 仍有效,未取消;不是本周狗粮阻断 |
| T19 桌面 Playwright 29/3 | 已登记,修法归向导 e2e 装配;70 号审明确不并进第 0 步 |
| 把常驻 runtime 从 `ada7981c` 推到 HEAD | 8 月纪律不部署。本批合入后真机狗粮需另开部署时窗(owner),否则代码在 main、手机仍打旧 runtime |

## 3. 上次疏漏、已补进判断但不另开批

- **worktree**:无隐藏未合入功能。录制 worktree 脏区大于 token/文案,清理仍不并入本批。
- **09 vs 代码白名单漂移**:并入第 0 步合同回写,不单独立项。
- **双 visibility 监听**:并入 A2,不是新 Critical。
- **`ApiError.code` 已存在、SetupContext 丢弃**:实施时从这里接线,不必新造错误类型。
- **既有 M1 LAN Playwright 在 T19 后预期红**:本批应用它们做验收,而不是宣布套件全绿。

## 4. 本批明确不做(防扩大)

CallKit / PushKit / Android 原生语音 / Noise / 三端源白名单 / 鸿蒙相机 / 壳内 demo / `setup_local_only` 旁路 / 开放远程 `GET /api/setup/probe` / 把 `remote-mobile` 映射成 `app` / 改 allowlist 语义 / 救 29 条桌面 e2e / 部署常驻 / push 是否做另候 owner。

## 5. 建议的实施顺序(若对抗审接受)

1. 开批:HANDOFF 指针 = `remote-mobile-w0`;断言指针当前为空。
2. 合同:`docs/09` M1 段补三条 GET + 隐私边界;不改代码白名单。
3. 竖切 A1:`SetupContext` 保留 `probeErrorCode`;仅 `mobile_lan_route_rejected` → kind `remote-mobile` → 包装器直接挂 `MobileApp`。
4. 竖切 A2:visibility / 手动 / native-resume 归 `useVoiceChannel` 单一 owner + 短窗口;MobileApp 不再装第二份监听。
5. 单测 + 定向 Playwright RFC1918(Today/Things/文本/first-run/横屏/来源头)。
6. 收口:evidence、HANDOFF 指针清除、journal。不部署;不得把本批写成常驻狗粮已交付。

对抗审:`prompts/73-now-vs-later-review.md`(46 行 / 2881 bytes / SHA-256 `a8e87ee4500b5efb65f80c903edc9b22dc7188931f667124a510c74f6d424645`);报告 `research/codex-findings/73-now-vs-later-review.md`(含 triage);日志 `logs/73-now-vs-later-review.log`(8366 行 / 987417 bytes / SHA-256 `f7b2ed19a9ae8d22846e0b09e3cf5556f50a58fecad68e63e49519fa841186aa`,不入 Git)。事实 subagent + 战略 subagent + Codex 73:需回修后接受,A 级全吸收。

## 6. 实施状态(2026-08-16 已入库)

基线 HEAD=`3197fd8`。代码提交 `addfd1965a5144223df3bfa3f7c407976664929a`。第 0 步 + `just ci` 双矩阵绿 + 定向 Playwright 6/6 + canonical Codex 74 B 已吸收,见 `e2e/evidence/remote-mobile-w0.md`。HANDOFF 指针已清。未部署常驻,不宣称真机 WKWebView 狗粮。桌面 Playwright 29 红不在本批完成定义内。
