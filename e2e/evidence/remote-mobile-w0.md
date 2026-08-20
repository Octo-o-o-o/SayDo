# remote-mobile-w0 · LAN 进壳第 0 步(2026-08-16)

> 范围 = Codex 73 收窄后的第 0 步:A1 `remote-mobile` 直挂 `MobileApp` + A2 重连单一 owner + 09/11 合同回写 + RFC1918 出码 + 定向 LAN Playwright。
> 完成定义 = 代码 + 临时 Chromium/LAN 证据。不部署常驻,不宣称 WKWebView/真机狗粮,不救桌面 Playwright 29 红。
> 基线 HEAD(开批 `git rev-parse`):`3197fd8a2b60e4cd948ef2efe9e8fa3a7c5853ca`。代码提交(feat 后 `git log -1`):`addfd1965a5144223df3bfa3f7c407976664929a`。本文件不自指 SHA。
> 三级词表:[ok] 本会话真实命令 / [warn] 差距如实 / [fail] 未做。

## 0. 开批

- [ok] HANDOFF 批次指针开批 = `remote-mobile-w0`;两提交法后已清。
- [ok] PLAN-2 §1 增 `remote-mobile-w0` 临时轨道;§7-8 写明插在 W5.4 之前、收口后回 W5 剩余。
- [ok] owner 本会话「开始实施」=停点。四场真人验收为并行 owner 轨,不进本代码批。

## 1. A1 remote-mobile 门

- [ok] `SetupContext` 保留 `probeErrorCode`;`probeFailureFromCaught` 从 `ApiError.code` 抽码,不靠「访问凭证已失效」人话。
- [ok] `SetupBootstrapKind` 增 `remote-mobile`;仅 `mobile_lan_route_rejected` 命中。该态 `RemoteMobileShell` 自己 `useMobileRoute` 直挂 `MobileApp`,不走 `AppContent` / `useMobileViewport` / 桌面 `Layout`。
- [ok] `token_mismatch` / `origin_rejected` / `host_rejected` / `setup_local_only` 仍 `probe-error`。已 peek 的 LAN 精确码仍 `remote-mobile`,不得落到 `app`。
- [ok] 未改 `mobileLan.ts` allowlist,未开放远程 `GET /api/setup/probe`。

## 2. A2 重连

- [ok] `shouldFireReconnect`:健康 OPEN 的 visibility 不拆且不占用 400ms 窗口;`native-resume` / `manual` 强制;短窗口去重。
- [ok] 生产路径 listener 只在 `useVoiceChannel`(visibility / `saydo:reconnect-request` / `saydo:native-resume`)。`MobileApp` 已删除第二份 `installMobileForegroundReconnect`。手动按钮仍派同一事件。

## 3. 合同与配对码

- [ok] `docs/09` M1 段补录三条已放行 GET 的路径与隐私边界 + `remote-mobile` 门语义。不改 allowlist 语义。
- [ok] Codex 74 B 已吸收:`GET /api/projects/:id/memory` 改为显式字段集(含 `taint` 数组,不含 `ts`),不再自指「行形状同项目记忆」。
- [ok] `docs/11` §5.6b / §5.8a:`remote-mobile` 直挂移动树;本机 localhost 宽屏仍重定向桌面;LAN 宽屏不落桌面。
- [ok] 配对二维码 Host 先过 RFC1918(`10/8` `172.16/12` `192.168/16`);公网 / CGNAT `100.64/10` / 环回不出码。

## 4. 本会话命令证据

工作目录:`/Users/wangyixiao/WorkSpace/SayDo`。基线 HEAD `3197fd8a2b60e4cd948ef2efe9e8fa3a7c5853ca`。

1. `pnpm --filter @saydo/console typecheck` → exit 0
2. `just ci`(清偿 HEAD 既有 7 条 eslint 后复跑)→ **exit 0 / 45398ms**。摘录:`contracts` Tests 103 passed;`console` Test Files 30 / Tests 253 passed;`cli` Tests 19 passed;`daemon` Test Files 105 passed | 2 skipped, Tests 1300 passed | 4 skipped;`emoji-gate self-test: pass=11 fail=0`;color gate `[summary] pass=21 fail=0`;python ruff + pytest **33 passed**;尾句 `[ok] just ci: node + python matrices green`。
3. 初跑 `just ci` 因 HEAD 既有 eslint 红(exit 1 / 8096ms):`SetupWizard.tsx` 6 条 unused + `setupWizardUx.test.tsx:199` unused-expression。清偿后才绿。这是收口质量门偏离,不是处方范围。
4. `npx playwright test e2e/console/console.spec.ts -g "RFC1918|LAN Things|LAN 横屏|first-run 端点|文本经既有|WS 写入异常"` → **6 passed**(8.2s)。global-setup 仍 `SAYDO_MOBILE_LAN=1` + RFC1918 `lanAddress`,未武装 dialog 救桌面套件。
5. `bash scripts/check-emoji.sh` 对本批改动文件 → `[ok] emoji gate: clean`

LAN 定向结果:

| 用例 | 结果 |
|---|---|
| first-run 开场白 + `data-setup-bootstrap=remote-mobile` | [ok] |
| RFC1918 Today;缺 Origin;有则 `Sec-Fetch-Site=same-origin`;不再停在「正在翻账」 | [ok] |
| `#/m/things` → `[data-mobile-page=things]`,无桌面 `[data-page=today]` | [ok] |
| 宽 1000 LAN `#/m` 仍移动树,URL 保持 `#/m` | [ok] |
| 文本「撤销」走既有 dialog 链,first-run query=0 | [ok] |
| LAN WS 写失败留草稿 | [ok] |

文本链 helper 从顶层 `runtimeSha` 改为 `/health.identity`(对齐 hub `runtimeIdentitySchema`);这是 e2e 装配合同漂移,不是开放远程 probe。

- [warn] 桌面 Playwright 29 红未修,不在完成定义内。
- [fail] 未 `just backup` / 未 deploy `~/.saydo/runtime`(仍为旧树纪律)。
- [fail] 未宣称真机 WKWebView;Chromium + RFC1918 只证明 LAN 门与移动树。

## 5. 批末 code-review

1 个 code-review subagent,A 级零。残留(未改生产行为):`installMobileForegroundReconnect` 仍导出给测试;抽码已补 `probeFailureFromCaught` 单测。

## 6. 明确未做

CallKit / Noise / `setup_local_only` 旁路 / 开放远程 probe / 把 `remote-mobile` 映射成 `app` / 改 allowlist / 救 29 条桌面 e2e / 部署常驻 / Android force flag / `just dev` 默开 `SAYDO_MOBILE_LAN`。

## 7. 评审

- [ok] 批末 code-review:A 级零。
- [ok] 一致性 subagent:`history/reviews/2026-08-16-remote-mobile-canonical-consistency.md` 通过(C 级不挡)。
- [ok] Codex 74:`research/codex-findings/74-canonical-remote-mobile.md` 终裁「需回修后通过」;A 级零;唯一 B 已吸收进 09。prompt `prompts/74-canonical-remote-mobile.md`;日志 `logs/74-canonical-remote-mobile.log`(不入 Git)。SHA 见 journal R72。
