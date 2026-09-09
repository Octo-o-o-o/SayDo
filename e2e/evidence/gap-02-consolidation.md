# GAP-02-consolidation 缺口收敛批候选与本地门禁(2026-09-09)

[warn] 这是候选,不是交付:分支 `sd-harness-borrow`(基于 main `25a99242a3863ba24ba7fc7a4b382c880c2c18d6`)上的本地提交,未合并、未 push、未公开快照;自检不算独立 GREEN。宿主 Claude Code Fable 5.1 当前会话直接实施(执行卡 `docs/plan/IMPL-PROMPT-2026-09-09-gap-consolidation.md` §0 授权),2.5/2.6/§3 与 2.7 由两个子会话在同一 worktree 施工、主会话一手复跑核验后入库。

## 身份与范围

- 产品候选 I 链(按顺序):`b415255`(§1 SD-1/2/3)→ `dc3b18c`(2.1)→ `c69aa23`(2.2)→ `c130ed1`(2.3)→ `2759916`(2.7)→ `b3c2009`(2.9)→ `b525aef`(2.8)→ `6e4ea74`(2.5)→ `ac8df81`(2.6)→ `9a398a2`(2.4);中间 E `5b4d5dc`(SD 追记)。
- 排产候选(owner checkpoint,可单独回退):`4fe4666`(插批 GAP-02-consolidation、指针 revision 5→6、schedule-pointer 链串、执行卡入库)、`2158ae0`(journal R142–R147)。
- 门禁所绑定的 HEAD:`2158ae0cfc2ebbe9c4be35df94da58bcf875f924`,工作树干净(`git status --short` 空);本文随后续 E 提交入库,不自指。
- `git diff --stat main..HEAD`:81 files changed, 4441 insertions(+), 529 deletions(-)(新增 17,修改 64)。

## 逐条裁决

| 条目 | 状态 | 落点 |
|---|---|---|
| §1 SD-1/2/3 收口 | [ok] 两提交法入库 | `b415255` / `5b4d5dc`;四文件 341 passed,`pnpm -r typecheck` 0 |
| 2.1 确认卡 kind 单源 | [ok] | contracts `CONFIRM_KINDS` 单源,daemon re-export + 编译期 parity,console `ConfirmKind` 同源、表外 kind「确认」、memory 文案;09 §15.1 / 11 确认卡行 |
| 2.2 git hooks 绕过 grammar | [ok] | commit/merge `--no-verify`、commit `-n` ⇒ S2;push `--no-verify` ⇒ S3;18 行正反例;04 §5.1 加行 |
| 2.3 对话审计去原文 | [ok] | `dialog.result_phrase_blocked` meta 只留 sentenceId + textDigest;`grep "text: s.text"` 零命中 |
| 2.4 VOBS-01 延迟观测 | [ok] | P50/P90 同判 + n>=20;pending 500 / TTL 120s / 宽限 5s;counts 分母;byOrigin;segmentNotes;hub 与 dialog 真实接线各 1 条;03 §3 |
| 2.5 VIEW-01 失效刷新 | [ok](验收形态有替代,见下) | detail 失败保留 + 重试;WS 事件 / visibilitychange / 60s 兜底;去重、abort、晚到丢弃;「状态待核实」;Playwright 2 例 |
| 2.6 A11Y-01 弹窗键盘 | [ok] | Escape / Tab 环 / 焦点进出;11 §9 |
| 2.7 HOST-01 saydo doctor | [ok] | 五种判定 + 附加判定,只读,输出不含路径/密钥;README 命令表 |
| 2.8 logger 背压隔离 | [ok] | 有界队列 + 异步写 + `health()`;`/readyz` `loggerDegraded`;审计 fail-closed `AuditWriteError`;E3 |
| 2.9 BYOA 笼分档类型化 | [ok] | `CAGE_LEVELS {level, enforcement}`;审计 + cli-capability 引用;09 §11 / 07 D18 |
| §3 移动确认路径核实 | [ok] 未失效,不改代码 | `mobile_lan` 在更上游 403/4003 fail-closed,`MobileApp` 不挂载;执行卡所指 console 侧 `net/remoteSurface.ts` 实为 daemon 侧 |
| §3 待 owner 具名三项 / §4 明确不做 | 未做(按执行卡) | 邮件出站阶段 A、DSH D-01、Console WS `?token=`;VIEW-02 / VOICE / READ / CONTEXT / HOST-02 / AS-03..07 / PG-02..06 |
| §5 批卡 + 指针 | [ok] 候选 | `4fe4666`;`schedule-pointer --check` / `--self-test` 六坏例通过;PG-02 `depends_on` 按执行卡保持原文 |

验收形态偏离(如实):2.5/2.6 验收写的是「vitest + Testing Library 渲染生产 hook」,仓内无 DOM 测试环境且本批禁新依赖,改为把逻辑抽成纯模块(`installRefreshSignal` / `createPageLoader` / `assembleBoardView` / `installDialogKeyboard`)用 Node `EventTarget` + fake timers 覆盖同一批验收点,React 薄包装只经 typecheck / eslint 与 Playwright。2.4 origin 为全局采集模式近似(hub `lastVoiceMode`),文本轮按五段合同结算为 missing_segment 计入 `byOrigin.text`。2.7 源码树运行恒 `installed_unknown`(exit 1),配置世代只以 pending 候选文件存在性表示。2.8 `/readyz` 字段未做端到端 HTTP 断言。2.9 新三家(gemini/qwen/copilot)沿用既有 tool-deny 审计口径登记为 full。

## 门禁(HEAD `2158ae0`,worktree 干净,串行执行、无并发 vitest)

| 门 | exit | 结果 |
|---|---:|---|
| `FG-GAP02-CONSOLIDATION` daemon 10 文件 | 0 | Test Files 10 passed,Tests 556 passed |
| contracts confirm-kinds + schemas | 0 | 2 files,21 passed |
| console hooks/redesign + components/redesign + useDialogKeyboard + Chat | 0 | 9 files,62 passed |
| `pnpm --filter @saydo/cli test` | 0 | 5 files,62 passed \| 1 skipped(既有 emergency-reaper skip) |
| `pnpm -r typecheck` / `check-emoji` / `check-doc-links`(files=140 broken=0)/ `schedule-pointer --check` / `git diff --check` | 0 | 全 [ok] |
| `just ci` | 0 | contracts 13 文件 135、platform 7 文件 72 \| 14 skipped、console 40 文件 316、cli 5 文件 62 \| 1 skipped、daemon 136 passed \| 2 skipped 文件 / 2313 passed \| 6 skipped;eslint 与全部 check/test 脚本;python ruff + pytest 34 passed |
| `pnpm exec playwright test` | 0 | 40 passed(4.7m;含新增 redesign-refresh 2 例);跑完 `git checkout -- e2e/screenshots`,工作树仍干净 |

| 日志(scratchpad,不入 Git) | bytes | SHA-256 |
|---|---:|---|
| focused.log | 12923 | `4fb608a55d1273a5055e5b0edf6787effcbb405366987627ac7b086ae0851229` |
| just-ci.log | 112257 | `6416c6f0a6bafe39538fbc4f789169cda80d5b297ef48ed31b9e6e25c130d529` |
| playwright.log | 5220 | `be7b5dbc3294c6334c0f7cbd5523890c82f0b624d2c8295cd111d3116d2a8922` |

这是本地 Node/Python/浏览器基线,不是托管 CI、真机、真实 provider 等效。

## not_run 与边界

not_run:真实供应方语音延迟基线、真实 provider 调用、真 recovery-only daemon 与真实发布包上的 `saydo doctor`、Windows 真机、托管 CI、常驻 runtime、真实 `.saydo` 数据。未 push / merge / 公开快照 / rc / 部署;主树未施工;PLAN-2 指针改动为候选。独立零上下文评审未做(执行卡为直接实施路径,自检不算独立 GREEN)。

## owner checkpoint

1. 是否同意插批 `GAP-02-consolidation`(提交 `4fe4666`,不同意可单独 revert,产品候选不受影响)。
2. 合并 `sd-harness-borrow` 到 main(ref-only ff 或 merge)。
3. push 私有归档;公开快照另行决定。
4. §3 待具名三项(邮件出站阶段 A、DSH D-01、Console WS token)是否立项。
