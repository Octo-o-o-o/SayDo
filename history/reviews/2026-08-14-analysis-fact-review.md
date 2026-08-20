# 事实与证据复核评审 — 2026-08-14 SayDo 阶段缺口分析

> 评审对象:docs/review/2026-08-14-saydo-phase-gap-analysis.md
> 评审角:事实与证据复核(subagent,独立只读;git fetch 实采、pnpm lint 实跑、门禁 HEAD/工作区双跑、/health 实采)
> 结论:事实层可接受,无 A 级事实错误;1 处 B 级措辞瑕疵。

## 终裁

文档事实层可接受。全部 §6 证据锚硬主张经独立复核成立,数字、SHA、行号、文件路径均与仓库实况一致;无 A 级事实错误。存在 1 处 B 级措辞瑕疵:正文多处把「268 提交」挂在「main」名下,而 268 实为当前 HEAD(feat/t20-fusion-layout),main 本身是 257——但 §6 锚已给出精确口径,结论不受影响。

复核基线:已执行 git fetch origin(exit 0),远端引用为实采;HEAD=e987f05(分支 feat/t20-fusion-layout),local main=origin/main=cda99b83a44d72a2db7ff4c439082abf07f431c5。

## 逐条复核

| 主张 | 结论 | 证据 |
|---|---|---|
| git fetch exit 0;origin/main..HEAD=11 且全部 2026-08-13;HEAD..origin/main=0;origin/main=cda99b8 | [ok] | 实跑;git rev-parse origin/main=cda99b83a44d72a2db7ff4c439082abf07f431c5 |
| ada7981c..HEAD=268;ada7981c..origin/main=257 | [ok] | git rev-list --count 实跑 268 / 257 |
| session-1 current_status=failed、runtime SHA=ada7981c | [ok] | session-1.md:54 / :57 |
| session-2/3/4 待开场记录 | [ok] | session-2.md:82、session-3.md:56、session-4.md:91(status=not_run) |
| session-4 ff-only 与 v0.1.0 tag 纪律 | [ok] | session-4.md:77-79(文档锚"约 77-80"含约字,不构成误差) |
| lint 8 errors 位置 | [ok] | pnpm lint 实跑 8 errors:SetupWizard.tsx 38/41/44/213/715/1013/1103 均为 no-unused-vars;setupWizardUx.test.tsx:198 为 no-unused-expressions(this; 表达式) |
| "8-13 UI 批引入"归属 | [ok] | git log -- SetupWizard.tsx / setupWizardUx.test.tsx 末次改动均为 2026-08-13 提交(646c900、228ac4c、af80b26、8181e67 等) |
| HEAD 版门禁缺 icns 排除且命中 saydo.icns;工作区版只加 icns 后绿 | [ok] | HEAD 版实跑 exit 1("assets/brand/saydo.icns: binary file matches");工作区版 exit 0;git diff 仅一行 BIN_RE 改动 |
| docs/11 登记 Playwright 29/3 且修法归 T19 | [ok] | 精确位置 docs/11-ui-spec.md:575(锚写 573-577 为宽松区间) |
| HANDOFF 末次提交 97b01f7(2026-07-31),8 月零回写 | [ok] | git log -1 -- HANDOFF.md |
| docs/plan 8 月唯一新文件=UI 审计,无 T16-T19/M1/D1 排产文件 | [ok] | git log --diff-filter=A --since=2026-08-01 -- docs/plan/ 仅 226a515 |
| git tag 仅 v0.1.0-rc.1,无 v0.1.0 | [ok] | git tag --list |
| 常驻 runtime=ada7981c | [ok] | curl /health 实返 runtimeSha=ada7981c67ef3a07e6df0431643bb8b7661e22d4 |
| 移动阻断(唯一 Critical/第 0 步) | [ok] | mobile-gap-audit.fable.md:25,:29;mobile-shell-strategy-final.fable.md:78 |
| 上架状态(三店/ICP 订单(号私存)/DEC-9/version spike 0.1) | [ok] | store-submission-status.md:6,:10,:23,:43,:90,:113 |
| PLAN-2 W1-W5a 收口、W5 剩余/W6-W9 无后续状态 | [ok] | IMPLEMENTATION-PLAN-2.md:53 明确 W5a 收口;W6/W7/W8/W9(74/78/95/100 行)仅有定义无收口标记 |

## 分级结论

- A 级(影响结论的事实错误):无。
- B 级(不影响结论):1 条——「268 提交」的归属措辞。正文 §0/§1-5/§3-B0 表述为「main 已累积 268 提交」;实际 268 = ada7981c..HEAD(HEAD 在 feat/t20-fusion-layout),main = origin/main = 257。B0 结论性数字用 257,结论不受影响。建议正文把「main 累积 268」改为「HEAD 累积 268,main=257」。
- 另两条可忽略行号微偏(session-4 纪律正文 77-79 行、Playwright 精确 575),文档已用「约/区间」缓解。
