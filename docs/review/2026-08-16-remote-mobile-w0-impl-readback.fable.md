# remote-mobile-w0 实施对账报告

> 对象:代码提交 `addfd1965a5144223df3bfa3f7c407976664929a`(本会话 feat 后 `git log -1`)。基线 HEAD `3197fd8a2b60e4cd948ef2efe9e8fa3a7c5853ca`。无独立分支,不 fetch。
> 计划:`docs/review/2026-08-16-now-vs-later.md` §1/§5 + `docs/review/2026-08-13-mobile-shell-strategy-final.fable.md` §3 + Codex 73。
> 日期:2026-08-16。零 emoji。

## TL;DR

计划第 0 步(A1 门 / A2 重连 / 09+11 回写 / RFC1918 出码 / 定向 LAN Playwright)在工作区均有代码+测试双证据。未部署、未宣称真机狗粮。桌面 Playwright 29 红按计划不修。门禁见 §门禁结果(本会话实跑)。

计数:完成 8 / 部分 0 / 未做 0 / 偏离 1(既有向导 lint 清偿以便 `just ci`,非处方范围)。

## 对账台账

| # | 计划项 | 状态 | 证据 |
|---|---|---|---|
| 1 | B4:HANDOFF 指针=`remote-mobile-w0`;PLAN-2 临时轨道 | [ok] | `HANDOFF.md:21`;`docs/plan/IMPLEMENTATION-PLAN-2.md:69-71` 与 §7-8 |
| 2 | 09 三条 GET + probe 仍拒 + remote-mobile 门语义,不改 allowlist | [ok] | `docs/09-data-contracts.md:1143`;`packages/daemon/src/net/mobileLan.ts:11-25` 未改语义 |
| 3 | A1:`probeErrorCode`;仅 `mobile_lan_route_rejected` → `remote-mobile` 直挂 MobileApp | [ok] | `SetupContext.tsx` `probeFailureFromCaught`;`SetupBootstrapBoundary.tsx:12-31,151,168-175`;测试 `SetupBootstrapBoundary.test.ts:67-109` |
| 4 | 不得映射 `app`;四码仍错误卡;已 peek 仍 remote-mobile | [ok] | 同文件 `resolveSetupBootstrapState` 先判精确码;`test.ts:81-109`;`test.tsx:118-157` |
| 5 | 横屏 LAN 不走 `useMobileViewport`/桌面 Layout | [ok] | Boundary 在 `kind===remote-mobile` 早退;`App.tsx:140-160` 的 viewport 分树在 AppContent,LAN 不挂载。e2e「LAN 横屏」 |
| 6 | A2:visibility/手动/native-resume 单一 owner + 400ms | [ok] | `reconnectPolicy.ts:15-21`;`useVoiceChannel.ts:411-431`;`MobileApp.tsx` 无 `installMobileForegroundReconnect` |
| 7 | RFC1918 出码 | [ok] | `pairing.ts:16-47`;`pairing.test.tsx:41-61`;与 `identity.ts:14-23` 三段同口径 |
| 8 | 定向 Playwright:Today/Things/first-run/横屏/文本/来源头 | [ok] | 本会话上一轮 `npx playwright test ... -g "RFC1918|LAN Things|LAN 横屏|first-run 端点|文本经既有|WS 写入异常"` → 6 passed。文本链 hello 改为 `/health.identity`(偏离旧 `runtimeSha`,对齐 hub schema,合理) |
| 9 | 不开放远程 probe / 不救 29 e2e / 不部署 | [ok] | `mobileLan.ts` 无 probe;evidence 写明未 deploy |

## 质量复审

批末 code-review(前一轮)A 级零。一致性 subagent 通过,报告 `history/reviews/2026-08-16-remote-mobile-canonical-consistency.md`。Codex 74 终裁「需回修后通过」,A 级零;唯一 B(`GET /api/projects/:id/memory` 漏 `taint` 且自指)已吸收进 `docs/09-data-contracts.md` M1 段。报告 `research/codex-findings/74-canonical-remote-mobile.md`;prompt `prompts/74-canonical-remote-mobile.md`;日志 `logs/74-canonical-remote-mobile.log`(不入 Git)。SHA 见 journal R72。

固定项:

- 被测条件 == 要求:boundary 测试用精确码而非人话;四码显式循环。
- 破坏性:公网 IP 不出码;token_mismatch peeked 仍 probe-error。
- 净新增无 `eslint-disable` / `@ts-ignore` / `test.skip` / `fromCharCode`(本批 grep)。

## 门禁结果

命令均在 `~/WorkSpace/SayDo`,本会话终端实跑。

### `just ci`(清偿 HEAD 既有 7 条 eslint 后)

exit 0,elapsed 45398ms。摘录:

```
packages/contracts test:  Test Files  9 passed (9)
packages/contracts test:       Tests  103 passed (103)
packages/cli test:       Tests  19 passed (19)
packages/console test:  Test Files  30 passed (30)
packages/console test:       Tests  253 passed (253)
packages/daemon test:  Test Files  105 passed | 2 skipped (107)
packages/daemon test:       Tests  1300 passed | 4 skipped (1304)
[ok] emoji gate: clean
emoji-gate self-test: pass=11 fail=0
[summary] pass=21 fail=0
33 passed in 0.28s
[ok] just ci: node + python matrices green
```

初跑 `just ci` exit 1(8096ms):HEAD 既有 `SetupWizard.tsx` unused 6 条 + `setupWizardUx.test.tsx:199` unused-expression。本批为过质量门清偿,计入偏离 1。

覆盖面:`just ci` = `pnpm typecheck`(contracts/cli/daemon/console `tsc --noEmit`)+ `eslint packages/*/src` + 全仓 vitest + emoji/color/migration 自测 + pipeline ruff/pytest。不是裸 `tsc -b`。

### 定向 Playwright

`npx playwright test e2e/console/console.spec.ts -g "RFC1918|LAN Things|LAN 横屏|first-run 端点|文本经既有|WS 写入异常"` → **6 passed (8.2s)**。未武装 dialog 救桌面 29 红。

## 修复清单

1. P2(可选):RFC1918 谓词三处拷贝,未单源。不挡收口。
2. P2(可选):`installMobileForegroundReconnect` 仍导出给测试,生产已不调用。
3. 两提交法已执行(代码 `addfd19`);HANDOFF 指针已清。未部署常驻。
