你是对抗评审。只读,不改仓库文件。不要把 AGENTS.md 评审制度理解成要再起一层 Codex。不要通读或转储 docs/09 全文;只在需要核对白名单合同句时用 rg 定位片段。

<task>
裁决「SayDo 移动外壳第 0 步还要不要加东西一起做」。不要重开战略辩论(薄壳/CallKit/Capacitor 已由 69 号审裁过,除非代码证明 69 错了)。

实施仓:~/WorkSpace/SayDo
HEAD 以 git rev-parse 为准(预期在 e987f05 附近)。工作树可能有未提交终稿,只读。
不要把 ~/WorkSpace/OctoDesk 当证据。

材料(方案建议 SoT):
docs/review/2026-08-13-mobile-shell-strategy-final.fable.md
尤其 §3 第 0 步、§7 二次通读。

材料(证据,可证伪):
docs/review/2026-08-13-mobile-gap-audit.fable.md
research/codex-findings/69-mobile-shell-strategy-review.md
</task>

<current_week0_claim>
终稿主张本周仍只两条竖切:remote-mobile gate + 回前台去重。同批完整回报四件:
1. remote-mobile 必须是新 kind,否则 probe=null 会掉进 wizard
2. 直接挂 MobileApp,因为 iPhone 横屏>768 且 iOS 只在 iPad 注入 __saydoForceMobileShell
3. B3 把 hooks.reload 传到 Today/Things(与 A2 同改 MobileApp.tsx)
4. 回写 09 已放行的三条 GET,防止有人按合同收紧拆 Chat

验收当天才做:en0 扩 RFC1918、刘海/键盘、B1 热区、B4 文案。
明确不做:CallKit、Android 语音、Noise、三端源白名单、给 Android 注入 force flag、改 just dev 默开 SAYDO_MOBILE_LAN。
</current_week0_claim>

<grounding_rules>
每条 finding 必须有本会话读到的 file:line 或命令输出。凭终稿「写过」不算证据。
宁降不升。允许证伪终稿 §7,不要护短。
缺真机照片标 [warn],不要因此否掉代码已锁死的机制。
</grounding_rules>

<research_mode>
沿真机狗粮链独立走代码(扫码 → token 注入 → G1 → probe 门 → 挂树 → attention/WS/文本/确认卡/first-run → 切应用/横屏),找「不做则 A1 假绿」的缺口。重点核这 10 问,每问给成立/不成立/部分成立:

1. 只跳过 probe-error 是否必然掉进 wizard?读 resolveSetupBootstrapState 与 isDialogReadyFromProbe(null)。

2. iPhone 横屏是否真会走桌面树?读 useMobileViewport、WebContainer.swift force flag 条件(是否仅 iPad)、Android/鸿蒙有无注入。via=local 时桌面 API 是否掩盖。LAN 下 /api/overview 是否不在 mobileLanApiAllowed。

3. B3 reload 是否必须同批?hooks 是否已有 reload、Today/Things 是否只收 error。

4. 09 三条 GET 回写是否必须同批,还是 A1 PR 说明里一句就够?

5. 已有 e2e: e2e/console/console.spec.ts 里 LAN RFC1918 用例(约 182 行起)在 T19 后门是否必红?docs/11:575 写 29 failed/3 passed 是 localhost 向导门还是 LAN probe 门?A1 是否必须把 LAN 用例拉绿?是否必须顺手武装 global-setup 救全部 29 条桌面用例?(fixture.ts seed 是否已武装 dialog)

6. origin_rejected: mobile_lan GET 缺 Origin 时要 Referer(identity.ts)。apiGet 的 fetch 会不会让 WKWebView 踩 origin_rejected,使 A1 旁路永远进不了(因为还没到 mobile_lan_route_rejected)?是否禁止把 origin_rejected fail-open?e2e 已证明 Playwright 缺 Origin+有 Referer 能过——这能不能外推到 iOS WKWebView?

7. pairingInfo 只认 en0:是否本周必修,还是浮层报错再做?

8. 确认卡独立 WS(confirmDecision.ts)在 mobile_lan 是否另有阻断?first-run 在无原生桥时 delivered=false 是否挡住开口聊?

9. iOS 下拉刷新 webView.reload 与 A2 去重是否互相打架?要不要同批改原生 PTR?

10. 你新发现的、终稿 §7 没写的「同批必修」项。没有就明确写无。不要把 CallKit/安卓语音/Noise 塞回来,除非完整回报链已经具备(配对合同+凭据面),代码能证明具备。
</research_mode>

<structured_output_contract>
Markdown,简体中文,零 emoji(勾叉用 [ok]/[warn]/[fail])。

# 70 移动第 0 步同批范围对抗审
> 日期/HEAD/只读

## 终裁
一段:维持 / 收窄 / 扩大第 0 步。列出最终「同批必修」清单(越短越好)和「仍后置」清单。

## Findings
编号。每条:标题、打终稿哪一句、证据 file:line、对派工的含义。

## 对 §7 十条候选的逐条裁决
表:候选 / 终稿主张 / 代码终审 / 派工

## 证伪
终稿或体检里被推翻的句子。

## 可派工条件
最小范围;若某条被你从同批拿掉或加进去,必须写原因。
</structured_output_contract>

<default_follow_through_policy>
不要问 owner 问题;该上浮的写成「需 owner 拍板」。不要建议改 G1 对 origin_rejected 的 fail-closed。
</default_follow_through_policy>
