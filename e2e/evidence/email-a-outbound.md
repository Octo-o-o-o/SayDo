# EMAIL-A-outbound 邮件出站阶段 A 收口证据(2026-09-09 晚)

本批 I 链已随候选合并入 main(owner 2026-09-09 晚「都合并,并且都按最完整的方式推进实施」,决策单第 12 节);本文随 E 提交入库,不自指。合并前候选期证据(逐条裁决、门禁表、口径偏离)见 `e2e/evidence/gap-02-residual.md`,本文只登记批次身份、关批依据与残留。

## 身份

| 项 | 值 |
|---|---|
| I 链(父=main `c9f9c52` 之上的 §1/§2 提交) | `17dd011`(canonical + 批卡)→ `dec54d2`(email 通道代码)→ `fc3c662`(测试夹具避开隐私门) |
| 候选期 E | `5eb083a`(`e2e/evidence/gap-02-residual.md` + journal R159–R160) |
| 插批 | `1409d71`(指针 revision 7→8,链串插入 EMAIL-A-outbound,schedule-pointer `--check`/`--self-test` 通过) |
| 完整门禁绑定 | `fc3c662`(`just ci` exit 0;`pnpm exec playwright test` 41 passed);`git diff fc3c662..1409d71 -- packages e2e/console pipeline` 为空,产品代码未变 |
| 关批 HEAD 重跑 | `pnpm -r typecheck` 0;`FG-EMAIL-A` daemon 7 files 72 passed;contracts 13 files 135 passed(日志 `fg-email-a-close.log`) |

## 合同与实现对照

| 合同项(批卡 / 执行卡 §3) | 状态 | 落点 |
|---|---|---|
| 04 §4 升级链 L1 邮件(可选,与 ntfy 并存) | [ok] | `docs/04-key-mechanisms.md` 升级链块 + 实现注记 |
| 07 D11 补句 | [ok] | P0.5 候选行 |
| 09 §6.3 `threadMessageId` additive + DDL v32 注(PG-05 可恢复点) | [ok] | contracts `callbackOutboxEntrySchema.threadMessageId?`;`ddl.ts` v32 `addColumnIfMissing` 只 ADD COLUMN |
| C4 依赖行补 email | [ok] | `docs/modules/c-control-bridge.md` |
| `SweepDeps.email` 投递对象 + index.ts 注入 | [ok] | `callback/sweep.ts` 可选 dep;`index.ts` 三键解析注入 |
| SMTP submission 587/STARTTLS 或 465 | [ok] | `callback/email.ts` node:net/tls 最小客户端,无新依赖 |
| 凭据经 `/api/setup/secret` | [ok](落点如实) | 白名单加 `SMTP_PASSWORD`;该端点现役落 `.env.pending`(0600)而非 OS keychain,未新造 keychain 路径 |
| 每任务一线程 Message-ID / In-Reply-To / References | [ok] | `thread_message_id` 投递成功后写;后续邮件取同任务先前值 |
| 正文按 10 §1 状态词;标题与阻塞原因经 redactText | [ok] | 复用 `renderNtfyMessage` + 整体 `redactText` |
| 深链只带路由不带 token | [ok] | 复用 ntfy click |
| 只发四类事件 | [ok] | `EMAIL_TRIGGERS` |
| 投递失败不写 notified | [ok] | 三通道全失败 ⇒ 留 pending,告警一次 |
| 两者都未配置 ⇒ L1 只剩桌面并 warn | [ok] | `index.ts` warn |
| DND 只发一次 | [ok] | 邮件与 ntfy 同法 snooze |
| 单测覆盖(渲染脱敏 / 线程头 / DND 一次 / 失败不写 notified / 未配置降级) | [ok] | `test/callback-email.test.ts` 14 例 |
| 真实发送实测 | **not_run** | 需 owner 提供临时邮箱 SMTP 凭据;本机不代填 |

## 门禁日志(scratchpad,不入 Git)

| 日志 | bytes | SHA-256 |
|---|---:|---|
| focused-email-3.log | 1057 | `decc364b183672beb473750d51796737e46cdd9d872c1c08d8bceb590e963d44` |
| focused-email-4.log | 395 | `24dcdd875fd410afdc00e821a95dde3562d14c9366cc5c2928fa44909d6cde12` |
| just-ci-red-dec54d2.log | 111051 | `4c63f6932415d06706a0a0377215391fb090778fd17a53c89939248617ea0970` |
| just-ci.log | 106970 | `2bc7f73637be8a38103b9806b97910fdda6efe4580eebf4997c2a6c9cec2d2ca` |
| playwright.log | 5431 | `cf1a5d7ca975af63da0e1d3275836ebb8df69873927d7064b55f9c2b9fa9c9ab` |
| fg-email-a-close.log | 1951 | `e7c4787ea8a6c6ea2f640a9925e052bf3bbd71cc72aa1caa8630364ec9e0896d` |

## 残留与边界

- not_run:真实 SMTP 发送与收件端线程展示;真实 `.saydo` 库 v32 迁移(只在测试临时库跑到 32);托管 CI;常驻 runtime。
- deferred exact-set 保持:`DF-EMAIL-B-INBOUND`、`DF-WEB-PUSH`、`DF-CALDAV`。
- 无独立零上下文评审(执行卡为直接实施路径;owner 未具名 `/impl-review`),自检不算独立 GREEN。
- 本批不含 push / 公开快照;是否推送私有归档与公开快照待 owner 一句话。
