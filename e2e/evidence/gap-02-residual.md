# GAP-02 残项 + 研究档案入库 + 邮件出站阶段 A 候选(2026-09-09 晚)

[warn] 这是候选,不是交付:分支 `gap-02-residual-20260909`(基于 main `c9f9c52`,含 `docs/research-ingest-20260909` 的 §1 提交)上的本地提交,未合并、未 push、未公开快照;自检不算独立 GREEN。宿主 Claude Code Fable 5.1 当前会话直接实施(执行卡 `docs/plan/IMPL-PROMPT-2026-09-09-gap-residuals.md` §0 授权)。

## 身份与范围

| 段 | 提交 | 分支 | stat |
|---|---|---|---|
| §1 研究档案入库 | `e7a6ceb8270e1c2531bc82319260a6b1472b937f` | `docs/research-ingest-20260909`(也是本分支的第一个提交) | 92 files, +10422 / -4 |
| §2 GAP-02 残项 | `a0c82cb89d0597535bbddc570f2e1898c15d30ab` | `gap-02-residual-20260909` | 22 files, +760 / -114 |
| §3 canonical + 候选批卡 | `17dd011` | 同上 | 6 files, +31 / -4 |
| §3 代码候选 | `dec54d2` + 夹具修复 `fc3c662` | 同上 | 8 files, +829 / -6;修复 1 file |
| E(本文 + journal) | 本文随 E 提交入库,不自指 | 同上 | — |

`git diff --stat main..fc3c662`:127 files changed, 12042 insertions(+), 128 deletions(-)。完整门禁绑定 HEAD `fc3c662872be82b8ea866ed540385923f55f930e`,工作树干净(`git status --short` 空)。

## 逐条裁决

| 条目 | 状态 | 落点 / 说明 |
|---|---|---|
| §1.1 33 个未跟踪路径(88 文件)入库 | [ok] | explicit pathspec,逐文件 `cmp` 与主树全等;`docs/plan/IMPL-PROMPT-2026-09-09-gap-consolidation.md` main 已有,未重复;本执行卡 `IMPL-PROMPT-2026-09-09-gap-residuals.md` 一并入库(不在执行卡列出的 33 条内,按执行卡入库惯例带入,可单独剔除) |
| §1.2 `docs/plan/README.md` / `research/README.md` | [ok] | main 为底手工并入:入口行、工程缺口与 ECC 节、邮件通道评估节、soc-agent/SD 两行、08-13 状态注指针;GAP-02/AS 行未删 |
| §1.3 08-13 DSH 评估状态注 | [ok] | main 版本 + 主树末尾「状态注(2026-09-09)」表 |
| §1.4 journal 补记 | [ok],**编号偏离** | 主树未入库条目实为 R129–R136 共 8 条(执行卡只提到 R129 一条),全部改编号为 R151–R158 追加(标明补记、原编号、原稿日期),main 的 R129–R150 未动;因此 §2/§3 的 journal 从 R159 起(执行卡写的是 R152) |
| §1 丢弃 | [ok] | `AGENTS.md`、`.octoworkflow/project-profile.md`、journal 的主树版本未带入 |
| §1.5 文档门 | [ok] | check-emoji / check-doc-links(files=156 broken=0)/ check-active-claims(roots=33)/ check-public-tree-privacy --fs(首跑 2 命中=两处本机绝对家目录路径,改 `~/` 前缀后 hits=0)/ `git diff --check` |
| §1.6 主树 checkout main 与 sd-borrow 清理 | **未做(留 owner)** | 主树仍在 `codex/ecc-research-20260905`,6 个修改 + 未跟踪文件仍在;执行卡条件是「先确认主树已无未提交差异」,而主树差异仍在且可能有并发会话;`sd-harness-borrow` 分支与 `../SayDo-wt-sd-borrow` 已核对指向 main 同一提交 `c9f9c52`、工作树干净,可删但本会话未删。owner 合并 §1 后,主树可 `git stash` + `git checkout main`(见 checkpoint) |
| §2.1 移动确认卡按 kind 取文案 | [ok] | contracts `attentionItemSchema.confirmKind`(additive,`confirmKindSchema.optional()`);daemon `computeAttentionItems` 取 `pending_confirmations.kind`(表外值不投);console 单源 `lib/confirmCardCopy.ts`(桌面 `Chat.tsx` 改 import+re-export;移动 `CardPage.tsx` 按 `item.confirmKind`):memory「记 / 不用记」+ kicker「记忆 · 信息确认 · 不是授权」+「过期即丢,不会偷偷记」;登记 kind「做 / 不要」;表外/缺失 kind「确认 / 不」。卡正文:移动 attention confirmation 条目的 `title` 本来就是 daemon `prompt_text`(`api/attention.ts`),无需新字段;09 §15 与 11 §5.6b 已对齐 |
| §2.1 **口径偏离** | 如实 | 执行卡要求「未知 kind 回落确认/不」且「与 Chat.tsx 共用同一映射」,而原桌面 `confirmCardCopy` 对表外 kind 回落「做/不要」;本批统一为「确认/不」(与 11「表外 kind 显示通用『确认』前缀」一致),`Chat.test.tsx` 对应用例改写 |
| §2.2 三页 hook 测试 | [ok](形态同 GAP-02 2.5) | 抽 `hooks/redesign/pageSession.ts`(pageLoader + installRefreshSignal 合成,纯模块);`createReviewPageSession` / `createFocusPageSession` / `createRecordsPageSession` 导出,hook 改薄包装;每页 2 例:失效事件触发重取(fetch 计数 +1、视图更新)+ dispose 后无残留(失效事件/回前台/兜底定时器/run 均不再 fetch,在途晚到响应不回调)。`sessionTestKit.ts` 提供 stub fetch(pathname 路由、5xx 注入)与假 window/document;fake timers 只假 setTimeout/setInterval/Date(保留 setImmediate 以 flush) |
| §2.2 Board 定向重试 | [ok] | `createBoardPageSession.retryDetail(focusId)`:只重拉 `/api/focuses/:id`,不重拉列表/attention/其它 detail;失败保留占位(错误更新为最新人话);首屏未成功时退回整页;dispose 后 no-op。`BoardPageRoute` `onRetryDetail={retryDetail}`(动作成功后的 `reload` 仍整页)。单测 3 例;Playwright `redesign-refresh.spec.ts` 增 1 例(点重试后 detail +1、列表/attention 计数不变) |
| §3.1 canonical 先行 | [ok] | 04 §4 升级链 L1 加邮件(可选,与 ntfy 并存)+ 实现注记;07 D11 P0.5 候选;09 §6.3 `threadMessageId?` + DDL 注 v32 additive(PG-05 可恢复点红线,只 ADD COLUMN);C4 职责/依赖行补 email |
| §3.2 批卡 | [ok] 候选 | PLAN-2 新增「候选批卡」小节 + `EMAIL-A-outbound` 卡(depends_on / A-ID / deferred exact-set / scope roots / FG-EMAIL-A / full gate / evidence / 回滚上限 / not_run);**未改 schedule-pointer、未插链**;`schedule-pointer --check` 通过(revision=7 不变) |
| §3.3 代码候选 | [ok] 候选 | `callback/email.ts`:`resolveEmailTarget`(SMTP_HOST/SMTP_FROM/EMAIL_TO 三键必填;587 STARTTLS 缺省,465 或 `SMTP_SECURITY=tls` 隐式 TLS)、`renderEmailMessage`(复用 `renderNtfyMessage`:标题经 redactor、正文 10 §1 状态词、深链无 token;整体再过一遍 `redactText`;只发 ready_for_review/blocked/failed/approval_request;每任务一线程:Message-ID=`<entryId@发件域>`,In-Reply-To/References 取同任务已发 `thread_message_id`)、`sendEmailSmtp`(node:net/tls 最小客户端,EHLO→STARTTLS→EHLO→AUTH PLAIN(仅 TLS 后)→MAIL/RCPT/DATA→QUIT,20s 超时,失败一律 false 不抛);`sweep.ts` 可选 `email` dep,桌面/ntfy/邮件任一成功才 `attemptNotify`,DND 邮件只发一次并 snooze;`index.ts` 注入 + 两通道皆未配置 warn;DDL v32 `thread_message_id`(additive);DAO `setOutboxThreadMessageId`;contracts `threadMessageId?`;secret 白名单加 `SMTP_PASSWORD`;`templates/saydo.env.example` 登记。**无新增依赖**(执行卡「新增依赖先列许可与体积」不触发) |
| §3.3 **口径偏离** | 如实 | 执行卡写「凭据经 `/api/setup/secret` 落 OS 机密存储」;仓内该端点实为 `writeSetupSecretStaged` 写 `~/.saydo/.env.pending`(0600)再 restart 生效,不是 OS keychain。本批按现状把 `SMTP_PASSWORD` 加入白名单,不新造 keychain 路径;是否要 OS 机密存储属 owner 决策 |
| §3.4 验收 | [ok] 单测;真实发送 not_run | `test/callback-email.test.ts` 14 例:三键解析、渲染脱敏(任务名含 `sk-…` 与 `/Users/…` 均不进主题)、线程头、四类过滤、SMTP 会话(587/465、RCPT 550、greeting 4xx、socket error、超时)、数据段(RFC 2047 主题、base64 正文可还原、行首点转义、AUTH 不在明文段)、sweep 集成(邮件成功→notified+线程锚;三通道全失败→留 pending 不写 notified、告警一次;DND 只发一次并 snooze;未配置行为不变;非四类不发) |
| §4 待 owner 具名三项 | 未做(按执行卡) | GAP-02 独立零上下文评审、PG-02、DSH D-01 / Console WS token |

## 门禁(串行执行、无并发 vitest;受影响门在 `dec54d2`,完整门在 `fc3c662`)

| 门 | exit | 结果 |
|---|---:|---|
| `pnpm -r typecheck` | 0 | 全包 0 error |
| console vitest(hooks/redesign 全部 + CardPage + Chat + ConfirmCard) | 0 | 10 files, 57 passed |
| daemon vitest(attention 3 文件) | 0 | 3 files, 26 passed |
| contracts vitest | 0 | 13 files, 135 passed |
| `FG-EMAIL-A`(daemon callback 5 文件 + focus-batch3 + focus-rebuild-migration + setup-onboarding + config + attention) | 0 | 10 files, 150 passed |
| eslint(改动文件) | 0 | 0 error(1 warning = Playwright spec 无 eslint 配置,既有) |
| check-emoji / check-doc-links(files=156 broken=0)/ check-active-claims(roots=33)/ schedule-pointer --check / privacy --fs(hits=0)/ `git diff --check` | 0 | 全 [ok] |
| `just ci`(首轮 HEAD `dec54d2`) | 1 | vitest 全绿,`check-public-tree-privacy --ref HEAD` 命中测试夹具 `/Users/...` 路径(home-macos)⇒ 红;修为 `/opt/saydo-fixture/` 后提交 `fc3c662` |
| `just ci`(HEAD `fc3c662`) | 0 | contracts 13 文件 135、platform 7 文件 72 \| 14 skipped、console 43 文件 328、cli 5 文件 62 \| 1 skipped、daemon 137 passed \| 2 skipped 文件 / 2327 passed \| 6 skipped;eslint 与全部 check/test 脚本(隐私门 hits=0);python ruff + pytest 34 passed |
| `pnpm exec playwright test`(HEAD `fc3c662`) | 0 | 41 passed(3.7m;含新增 redesign-refresh 定向重试 1 例);跑完 `git checkout -- e2e/screenshots`,工作树仍干净 |

| 日志(scratchpad,不入 Git) | bytes | SHA-256 |
|---|---:|---|
| ingest-docgates.log | 654 | `609fe121bd1519aac0e83bc16e98badcbd01a1bff4a28767fad9853c579d35a5` |
| typecheck-1.log | 399 | `c5371a25a148981bc17393e9f15b76f2287df1c6e9eb938b74a0fefe6334807d` |
| focused-console.log | 950 | `4670416dec3f68cc90ddbce74d1795f888199cf23ce3e4e16476fd037f1677bb` |
| focused-daemon-contracts.log | 1333 | `9c78f24012bc22d7bbef9e06e89d04a4c6cf4f4675e6fa1812999ecbf28b1745` |
| lint-2.log | 291 | `1fb0157efa3d02f622bbe897baa0ca19db964e8dfb3f28600ce84a6370b33ebd` |
| typecheck-2.log | 399 | `c96b6d44076875cd61447bb868a1b0f600f2ed5ef8131db23335655d46f76902` |
| focused-email-3.log | 1057 | `decc364b183672beb473750d51796737e46cdd9d872c1c08d8bceb590e963d44` |
| docgates-3.log | 241 | `cf5eed319e00eaef94a95a40b4cacab0e2c7e5389b50a2c5caebf672b1d1aa9e` |
| focused-email-4.log | 395 | `24dcdd875fd410afdc00e821a95dde3562d14c9366cc5c2928fa44909d6cde12` |
| just-ci-red-dec54d2.log | 111051 | `4c63f6932415d06706a0a0377215391fb090778fd17a53c89939248617ea0970` |
| just-ci.log | 106970 | `2bc7f73637be8a38103b9806b97910fdda6efe4580eebf4997c2a6c9cec2d2ca` |
| playwright.log | 5431 | `cf1a5d7ca975af63da0e1d3275836ebb8df69873927d7064b55f9c2b9fa9c9ab` |

这是本地 Node/Python/浏览器基线,不是托管 CI、真机、真实 SMTP、真实 provider 等效。

## not_run 与边界

not_run:真实 SMTP 发送与收件端线程展示(需 owner 提供临时邮箱凭据,本机不代填);真实 provider 付费调用;真实 `.saydo` 数据库上的 v32 迁移(只在测试临时库上跑过 `MIGRATIONS` 到 32);Windows 真机;托管 CI;常驻 runtime;真实邮箱地址。未 push / merge / 公开快照 / rc / 部署;主树未施工、未 checkout main;PLAN-2 指针未动;独立零上下文评审未做(自检不算独立 GREEN)。

## owner checkpoint

1. §1 合并:`docs/research-ingest-20260909`(`e7a6ceb`)ff 到 main;合并后主树 `git stash`(保留 6 个修改文件以防万一)+ `git checkout main`、删除 `sd-harness-borrow` 分支与 `../SayDo-wt-sd-borrow` worktree(已核对与 main 同提交、干净)。若不想入库本执行卡 `IMPL-PROMPT-2026-09-09-gap-residuals.md`,可单独剔除。
2. §2 合并:`a0c82cb`(建立在 §1 之上;若 §1 不合并需 cherry-pick)。含表外 kind 回落「确认/不」的桌面口径变化。
3. §3 插批位置与是否实施:候选卡 `EMAIL-A-outbound` 现在 PLAN-2「候选批卡」小节,未插链;`17dd011` + `dec54d2` 是可审查候选。若同意实施:决定插批位置(建议 PG-02 后或与 PG-04 并行的独立小批)、是否要 OS 机密存储而非 `.env`、提供临时 SMTP 凭据做一次真实发送实测。若不同意:`dec54d2` 可单独 revert,canonical 回写 `17dd011` 亦可回退。
4. 是否补 GAP-02(main `c9f9c52`)与本批的独立零上下文评审(`/impl-review`)。
