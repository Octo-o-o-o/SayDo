> 入库说明:本文件是零上下文 reviewer 报告的归档副本。原报告在逐字引用 vitest / Playwright
> 原始输出时保留了勾号等 pictographic 字符,与 `docs/11-ui-spec.md` 12 的全仓禁令冲突。
> 入库副本已把这些字符替换为 `[ok]` / `[fail]`(共 6 处),并删除本机绝对路径;其余内容未改。
> 另外,报告在讨论 TTS 脱敏用例时逐字写出了合成样本路径(测试源码本身用字符串拼接构造该路径,
> 正是为了避开 `check-public-tree-privacy` 的 macOS home 模式)。入库副本把 6 处 `/Users/`
> 前缀改写为 `<macos-home>/`;这不改变论证内容,但请注意其中若干处原文是断言字面量。
> 未修改的原报告 SHA-256 = `571802de75e51b7c9bd9d4c28d9d8aaa87f35518513227285e7ddb761b1ad4c0`,
> 35512 bytes。

# PG-01B owner-recovery-3 零上下文复审报告(ordinal 2)

> 本报告由全新、零上下文、只读 reviewer 独立完成。所有命令均在
> `<repo>`(独立 clone)本会话真实执行。
> 未读取任何他人 review/diagnosis/carry-in/DELIVERY-STATUS/events.jsonl/summary/gate_receipts/gate_logs。

## 1. candidate 身份核验

| 项 | 期望 | 实测 | 结论 |
|---|---|---|---|
| HEAD | `ebd449080bb0e476eb2dd3334ee0b152cb3a7eeb` | `ebd449080bb0e476eb2dd3334ee0b152cb3a7eeb` | [ok] |
| tree | `20e3303197f602d27548a4ab7d4490263fb85272` | `20e3303197f602d27548a4ab7d4490263fb85272` | [ok] |
| parent(P) | `bcf8ea855f25b177888d9159f75e49214f3dd892` | `bcf8ea855f25b177888d9159f75e49214f3dd892` | [ok] |
| `git rev-list --count P..I` | 1 | 1 | [ok] |
| fingerprint(`candidate_fingerprint.py --expect`) | `e42dd19c...92f9727` | 同值,exit 0 | [ok] |
| 工作树/index | clean | `git status --short` 无输出 | [ok] |
| 分支/worktree | 单一 clone | `codex/pg-01b-runtime-entry-stoploss`,`git worktree list` 仅本目录 | [ok] |

commit 元数据:`feat(pg-01b): 收紧运行时入口并修正默认语义`,author `octoooo <octoooo@octoooo.com>`,
`Sat Sep 5 00:25:58 2026 +0800`。确为 parent=P 的单一 implementation commit。

门禁全部跑完后复算:`git status --short` 仍无输出,fingerprint 仍为 `e42dd19c...92f9727`(exit 0)。

## 2. P..I exact pathset(44 项)

```
M HANDOFF.md
M docs/02-product-definition.md
M docs/04-key-mechanisms.md
M docs/06-references.md
M docs/08-module-design.md
M docs/09-data-contracts.md
M docs/10-voice-ux-spec.md
M docs/11-ui-spec.md
M docs/plan/IMPLEMENTATION-PLAN-2.md
M e2e/console/console.spec.ts
M packages/console/src/components/SetupBootstrapBoundary.test.ts
M packages/console/src/components/redesign/DecisionPackageCard.fixture.ts
M packages/console/src/components/redesign/DecisionPackageCard.test.tsx
M packages/console/src/components/redesign/DecisionPackageCard.tsx
M packages/console/src/components/redesign/ExpectationGroup.tsx
M packages/console/src/components/redesign/ProgressAlignCard.fixture.ts
A packages/console/src/components/redesign/ProgressAlignCard.test.tsx
M packages/console/src/components/redesign/ProgressAlignCard.tsx
M packages/console/src/components/redesign/RecordsPanel.tsx
M packages/console/src/components/redesign/types.ts
M packages/console/src/hooks/redesign/mappers.test.ts
M packages/console/src/hooks/redesign/mappers.ts
M packages/console/src/pages/redesign/README.md
M packages/console/src/pages/redesign/RecordsPage.fixture.ts
M packages/console/src/pages/redesign/RecordsPageRoute.tsx
M packages/daemon/src/api/focuses.ts
M packages/daemon/src/api/recoveryOnlyServer.ts
M packages/daemon/src/brain/golden.ts
M packages/daemon/src/brain/instructions.ts
M packages/daemon/src/brain/liveTools.ts
M packages/daemon/src/index.ts
A packages/daemon/src/net/remoteSurface.ts
M packages/daemon/src/voice/hub.ts
M packages/daemon/test/console-actions.test.ts
M packages/daemon/test/console-api.test.ts
M packages/daemon/test/focus-v04e-screen-a7-a6.test.ts
M packages/daemon/test/mobile-lan-process.test.ts
M packages/daemon/test/p05c-direct-mode.test.ts
M packages/daemon/test/pairing-info.test.ts
M packages/daemon/test/t2-thin.test.ts
M packages/daemon/test/voice-hub.test.ts
A scripts/check-remote-surface-inventory.mjs
A scripts/remote-surface-inventory.json
A scripts/test-remote-surface-inventory.mjs
```

统计:44 files changed, 3887 insertions(+), 393 deletions(-)。

### 2.1 相对上一 candidate `c1e7f5bc...48` 的 delta

```
M e2e/console/console.spec.ts             | 35 +++++
M packages/daemon/test/voice-hub.test.ts  | 47 ++++++
2 files changed, 82 insertions(+), 0 deletions(-)
```

[ok] 本轮只动这 2 个测试文件,零删除行;`packages/**/src/**`、`pipeline/**`、`scripts/**`
在这一段 delta 里**未被触碰**,无越界。

### 2.2 范围判定(supervisor 请求我独立判断的部分)

对照 `logs/pg01b-implementation-20260904/implementation-prompt.md` 的 `must_change`(29)/`may_change`(14):

- `must_change` 29 项**全部**出现在 changed set;
- 超出声明集的有 8 项:
  `docs/02-product-definition.md`、`docs/04-key-mechanisms.md`、`docs/06-references.md`、
  `docs/08-module-design.md`、`e2e/console/console.spec.ts`、
  `packages/console/src/components/SetupBootstrapBoundary.test.ts`、
  `packages/console/src/components/redesign/ProgressAlignCard.test.tsx`、
  `packages/daemon/test/focus-v04e-screen-a7-a6.test.ts`。

我逐条读了这 8 项的 diff,独立结论:**不构成范围扩张**,是冻结 acceptance 反向强制的机械后果。

1. docs/02、04、06、08:acceptance 第 1 项要求「canonical 只开放 `step_confirm`」。这四篇
   canonical 原本正面陈述「直达验收 / 逐步确认二选一」「远程下发指令需配对设备 + PIN」。若只改
   09/10/11 而不动它们,受管 canonical 之间会出现**真矛盾**——按 Review Value Boundary 那本身
   就是 P0/P1。改动全部是加限定(designed/deferred、现役口径),未删历史原文,未新增功能。
2. `e2e/console/console.spec.ts`:acceptance 第 4 项(P0)要求 remote 业务面 fail-closed 且
   local 不回归,冻结 `required_gates` 含 `playwright`;LAN 403 与本机回归只能写在这里。
3. `ProgressAlignCard.test.tsx`(新增):acceptance 第 3 项明写「SSR 测试真测 DOM」,原仓没有
   这个测试文件,不新增就无法取证。
4. `SetupBootstrapBoundary.test.ts`:新错误码 `remote_business_forbidden` 必须进既有 blocked
   列表,否则 console 引导层会把 403 误判成可继续态。是新增 code 的机械后果。
5. `focus-v04e-screen-a7-a6.test.ts`:该测试原来的前提是「tailnet console peer 连得上但收不到
   `screen_text`」。remote WS fail-closed 之后这个前提在物理上不成立(连接就被 4003 拒),测试
   必须改写,否则冻结 acceptance 与既有测试直接冲突。

因此我**不**把这 8 项报为 blocker,`needs_owner_decision=false`。

## 3. 本轮三处补回守护的独立验证

### 3.1 缺口 1(最重要):TTS 脱敏接线断言是否会被产品变更抓住

核心问题:**若把 `packages/daemon/src/voice/hub.ts:845` 的 `redactText(msg.text, redactSpans)`
换成直接透传 `msg.text`,新增断言会不会失败?**

结论:**会失败。断言非永真,不是「换一层假绿」。** 以下用代码路径论证(未做变异实验,我无写权限)。

产品侧接线:

- `packages/daemon/src/voice/hub.ts:845` — `const safeText = redactText(msg.text, redactSpans);`
- `hub.ts:846` — `const safe = { ...msg, text: safeText };`
- `hub.ts:855` — `const pipelineDelivery = this.broadcast("pipeline", safe);`

即 pipeline 侧收到的 `tts.say.text` **就是** `redactText` 的返回值;移除该调用后 pipeline 会收到原文。
两条新用例都是在 `connect("pipeline")` 建立的真实 WS pipeline peer 上
(`packages/daemon/test/voice-hub.test.ts:58-85` 的 `connect`,`:87-103` 的 `nextJson`)读取消息,
监听器在 `hub.sendTtsSay(...)` 之前注册,观测对象正确。

**样本 1(绝对路径),`voice-hub.test.ts:695-716`**

样本文本 `任务这边,我需要读取 <macos-home>/someone/.saydo/.env 里的配置,可以吗?`
(`secretPath` 由 `"<macos-home>/" + "someone" + "/.saydo/.env"` 拼接构造)。

redactor 侧确实处理这一形态:

- `packages/daemon/src/voice/redactor.ts:27` 的
  `PATH_RE = /(?:~\/|\/(?:Users|home|var|tmp|etc|opt|private)\/|[A-Za-z]:\\)[^\s，。;；、"']*/g`
  以 `<macos-home>/` 起头匹配,字符类不排除 ASCII 逗号,但排除空白,故匹配终止于路径后的空格,
  命中片段恰为 `<macos-home>/someone/.saydo/.env`;
- `redactor.ts:37-41` 该规则 `cls: "path"`,`label` 用
  `/\.(?:env|toml|json|ya?ml|conf|cfg|pem|key)\b/i` 判定,片段以 `.env` 结尾 ⇒ 替换成
  **「某个配置文件」**;
- 顺序上 PATH_RE 排在裸长串规则(`redactor.ts:46`)之前,不会被后者抢走;
  `redactor.ts:72-78` 的 SayDo 业务 id 保护正则不匹配该串。

同一字面量在 `packages/daemon/test/redactor.test.ts:10`(`fake.homePath()`)与 `:26-32` 已有
单测,断言 `not.toContain("<macos-home>/")` + `toContain("某个配置文件")` + `hasResidualSensitive=false`。
本会话 daemon 全量跑中 `test/redactor.test.ts (12 tests)` 全绿,说明该形态**确实被改写**。

新用例断言(`voice-hub.test.ts:711-714`):
`not.toBe(raw)`、`not.toContain(secretPath)`、`not.toContain("<macos-home>/")`、`toContain("某个配置文件")`。
其中 `toContain("某个配置文件")` 只有在 redactor 真的跑过才成立,`not.toBe(raw)` 在透传下必然为假。
[ok] 非永真。

**样本 2(redactSpans),`voice-hub.test.ts:717-740`**

样本 `客户张三的备注是 VIP`,`redactSpans=[{ value: "张三的备注是 VIP", dataClass: "customer" }]`。
`redactor.ts:63-68` 显式段循环用 `text.split(span.value).join(REPLACEMENTS[cls])` 改写,
`REPLACEMENTS.customer = "一处客户数据"`(`redactor.ts:17`)。同一字面量在
`redactor.test.ts:53-57` 已有单测并通过。
新用例断言 `not.toBe(raw)`、`not.toContain(customer)`、`not.toContain("张三")`、
`toContain("一处客户数据")`。
[ok] `redactSpans` 这条路径**被独立覆盖**;透传即失败。

三个追问的回答:
1. 样本是 redactor 确实会改写的形态 — [ok](与 `redactor.test.ts` 同源字面量,该测试本会话通过)。
2. 断言绑定「脱敏后」结果 — [ok](既断言不含敏感字面量,又断言含脱敏标记,不是弱断言)。
3. `redactSpans` 路径被覆盖 — [ok](第二条用例专测)。

### 3.2 缺口 2、3:MobileApp `queueText` 成功/失败路径

1. **本机路径** — [ok]。两条用例都调 `open(page, "/m")`
   (`e2e/console/console.spec.ts:26-32`),走 `page.goto("/?token=...#/m")`;
   `playwright.config.ts` 的 `use.baseURL = "http://localhost:47188"`。
   未使用 `runtime.lanAddress`/`lanOrigin()`(`console.spec.ts:74-76`)。
2. **断言对准真实文案与 DOM** — [ok]。
   - 成功 toast:`packages/console/src/mobile/MobileApp.tsx:113` `setToast(sentToast(text))`,
     `packages/console/src/mobile/toasts.ts:12-15` 返回 `已发送:"{≤20 字摘要}"`;
     草稿 `本机发送草稿守护句` 为 9 字,不截断,故 `console.spec.ts:398` 的
     `已发送:"${draft}"` 与实现逐字一致。
   - 失败 toast:`MobileApp.tsx:116` `setToast(sendFailedToast("unknown"))`,
     `toasts.ts:21` 返回 `还没发出去，草稿给你留着了。`,与 `console.spec.ts:420` 一致;
     **且与 offline 分支文案(`toasts.ts:19` 还没发出去，等连接恢复后再试。)不同**,
     所以这条断言能区分「catch 分支」与「sendText 返回 false 分支」,不是笼统匹配。
   - DOM 钩子全部真实存在:`MobileChrome.tsx:64` `data-mobile-shell` + `data-dstat`、
     `MobileChrome.tsx:86` `.m-composer`、`MobileChrome.tsx:104` `.m-send`、
     `MobileApp.tsx:192` `.m-toast`、`ChatPage.tsx:221` `data-mobile-transcript`。
3. **猴补确实命中发送路径** — [ok]。
   `packages/console/src/voice/useVoiceChannel.ts:827` 是唯一发送点:
   `ws.send(JSON.stringify({ t: "turn.text", sessionId, turnId, text: t, typed: true }))`;
   `JSON.stringify` 输出首字段即 `{"t":"turn.text",`,与 `console.spec.ts:409` 的
   `data.includes('"t":"turn.text"')` 精确匹配。`sendText` 内部**没有** try/catch
   (`useVoiceChannel.ts:818-837`),异常直接冒泡到 `MobileApp.tsx:115` 的 catch。
   猴补在抛错前先 `WebSocket.prototype.send = original` 还原,不会连锁污染心跳,
   避免把 `status` 打成 offline 而误走另一分支。
   前置条件也已断言:用例先等 `data-dstat="online"`,满足 `MobileApp.tsx:99` 的
   `status !== "online"` 早退门;新页面 `pendingSend` 为 null。
4. **草稿保留断言** — [ok]。`console.spec.ts:419`
   `expect(page.locator(".m-composer input")).toHaveValue("不能静默丢掉的草稿")`,
   断言输入框值仍等于原草稿字面量;并配合 `console.spec.ts:418` 断言 URL 停在 `#/m`
   (`MobileApp.tsx:110-112` 的跳转在 try 内、`sendText` 之后,抛错即不执行)。
   成功路径对应断言 `toHaveValue("")`(`console.spec.ts:396`,对应 `MobileApp.tsx:109` 清草稿)。

两条用例在本会话 Playwright 全量中真实通过(见 §5)。

## 4. 冻结 acceptance 七项逐项 readback

| # | ID | 结论 | 关键证据 |
|---|---|---|---|
| 1 | PG01B-DIRECT-HIDDEN | [ok] | 见 4.1 |
| 2 | PG01B-ABANDON-SEPARATE | [ok] | 见 4.2 |
| 3 | PG01B-BUDGET-UNKNOWN | [ok] | 见 4.3 |
| 4 | PG01B-REMOTE-BUSINESS-403(P0) | [ok] | 见 4.4 |
| 5 | PG01B-REMOTE-DENOMINATOR | [ok] | 见 4.5 |
| 6 | PG01B-SP2D-COMPAT | [ok] | 见 4.6 |
| 7 | PG01B-GIT-POINTER | [ok] | 见 4.7 |

### 4.1 PG01B-DIRECT-HIDDEN

- 底层 schema 保留且标注 designed/deferred:`docs/09-data-contracts.md`
  `Project.executionModeDefault` 与 `DecisionPackage.mode` 注释均保留 `direct_to_review`
  联合类型、加 designed/deferred 限定;`docs/08-module-design.md:98-102` 同步;
  `docs/04-key-mechanisms.md` §5.4 加「现役口径(PG-01B)」引言并明记「D3 未签」;
  `docs/06-references.md:99` 术语表同步;`docs/02-product-definition.md` 第 4 条与
  三正交档位段同步。[ok] 未删 schema、未删历史原文。
- 现役 UI:`packages/console/src/components/redesign/DecisionPackageCard.tsx` 删除二选一按钮网格,
  改为固定文案;`blockedDirect = pkg.selectedMode === "direct_to_review"` 时
  `canApprove=false`,拍板按钮禁用并给出 designed/deferred 提示。[ok]
- Brain instructions:`packages/daemon/src/brain/instructions.ts:94` 第 6 条改为「说明按逐步确认执行」
  且明写不询问「一口气跑完」。[ok]
- tool enum / default route:`packages/daemon/src/brain/liveTools.ts:1053`
  `mode: { type: "string", enum: ["step_confirm"] }`;`:1059-1060` 入口先过
  `parseActiveDispatchMode`,非 `step_confirm` 直接 `toolError("direct_mode_not_wired", ...)`;
  组包默认 `mode: "step_confirm"`(`liveTools.ts:899`)。[ok]
- 旧 direct package fail-closed:`liveTools.ts:431-435` 在 `dispatchApprovedPackage` 内既校验
  请求 mode,也校验 `pkg.mode !== ACTIVE_DISPATCH_MODE` 时抛
  `direct_mode_not_wired`;`liveTools.ts:1004-1009` 语音确认环对
  `pkg.mode === "direct_to_review" || preauthorizedEffects.length > 0` 返回同 code。[ok]
- active golden:`packages/daemon/src/brain/golden.ts` g2/c10/c14a/c27 改为逐步确认话术并加
  `mustNotContain`,`P05_GOLDEN` 移除 `p05-12` 念清单用例。
  `mustNotContain` 是**真实生效**的判定(`golden.ts:15` 声明、`golden.ts:27`
  `for (const m of c.mustNotContain ?? []) if (c.utterance.includes(m)) reasons.push(...)`),
  不是装饰字段。[ok]
- 新增单测 `packages/daemon/test/p05c-direct-mode.test.ts:103-112` 直接锁
  `parseActiveDispatchMode("direct_to_review").ok === false` 与 `undefined` 也 fail-closed。[ok]

### 4.2 PG01B-ABANDON-SEPARATE

- UI 独立 endpoint:`packages/console/src/pages/redesign/RecordsPageRoute.tsx:70-77`
  走 `POST /api/focuses/{id}/abandon`,不复用 `/archive`;
  `RecordsPanel.tsx:11,51` 独立 `{ type: "abandon" }` 动作。[ok]
- server 端 trim 后拒纯空白:`packages/daemon/src/api/focuses.ts:32-34`
  `abandonBody = z.object({ reason: z.string().trim().min(1) })` —— zod `.trim()` 先转换再校验,
  纯空白 → 400;`focuses.ts:174-176` 解析失败即 `err(400, "invalid_input", ...)`。
  lifecycle 不变由 `packages/daemon/test/console-actions.test.ts:187-197` 断言。[ok]
- 写 `abandoned` + 独立 `focus.abandoned` audit:`focuses.ts:207-221`;
  `console-api.test.ts:174-186` 同时断言 `focus.archived` **未**被记录。[ok]
- audit 不落自由文本 reason:`focuses.ts:215` `refDigest: jcsDigest(reason)`,`meta` 只含
  `focusId/eventId/closedActivations`;`console-actions.test.ts:222-225` 断言
  `meta` 无 `reason` 键、整条 audit 序列化后不含理由原文、`refDigest === jcsDigest(reason)`。
  digest 用仓内 canonical `jcsDigest`(`@saydo/contracts`)。[ok]
- trim 后 reason 进 `lifecycle_changed` payload 且有断言:
  `focuses.ts:209-213` 把 `parsed.data.reason`(已 trim)传给 `changeFocusLifecycle`;
  `console-actions.test.ts:227-240` 读回 `focus_events` 行,断言
  `type === "lifecycle_changed"`、`payload.reason === "不再做了"` 且
  `payload.reason !== "  不再做了  "`、`from=active`/`to=abandoned`。[ok]
- archive 兼容不变:`console-actions.test.ts:242-248` 与 `console-api.test.ts:188-198`
  断言 archive 仍写 `archived` 且 audit `meta.reason` 保留原语义。[ok]
- 边界:`ABANDON_FROM = {active, dormant, archived}`(`focuses.ts:36`),
  captured/closed → 409,缺 reason → 400,未知 id → 404,由
  `console-api.test.ts:200-207` 覆盖。[ok]

### 4.3 PG01B-BUDGET-UNKNOWN

- 无来源显式 unknown:`packages/console/src/hooks/redesign/mappers.ts:276`
  由 `{ spent: 0, max: 0, currency: "CNY" }` 改为 `{ known: false }`;
  类型改为判别联合 `FocusBudgetView`(`types.ts:216-218`)。[ok]
- 不显示零值或 0% track:
  `ExpectationGroup.tsx:26` `budPct` 增加 `exp.budget.known &&` 短路;
  `ExpectationGroup.tsx:63-64` 标题走 `focusBudgetCopy`,unknown 时 `sub={undefined}`(不渲染轨道);
  `ProgressAlignCard.tsx:28-37` unknown 时 push 的 row **不带 `pct`**,
  `:58-60` 只有 `typeof r.pct === "number"` 才渲染 `ProgressTrack`。
  文案 `types.ts:220-222` `focusBudgetCopy` unknown → 「还没有确切数字」。[ok]
- 已知预算正常:`ProgressAlignCard.tsx:29-35` known 分支照旧算 pct 与 warn。[ok]
- SSR 测试真测 DOM:新增 `packages/console/src/components/redesign/ProgressAlignCard.test.tsx`
  用 `renderToStaticMarkup` 出真实 HTML,`:8-10` 用
  `/width:([0-9.]+%)/g` 数出实际渲染的轨道条数——unknown 时断言
  `progressWidths(html)` 恰为 `["75%","50%"]`(2 条,预算轨道缺席)、
  `not.toMatch(/width:\s*0%/)`、`not.toContain("¥0")`;known 时断言 3 条且第三条 ≈58%。
  这是对渲染产物的计数断言,不是字符串包含的弱断言。[ok]
- 端到端另有 `console.spec.ts:259` 成本页 unknown 纪律用例(本会话通过)。[ok]

### 4.4 PG01B-REMOTE-BUSINESS-403(P0)

统一守卫新增于 `packages/daemon/src/net/remoteSurface.ts`:
`remoteHttpBusinessDecision`(`:34-48`)对 `via ∈ {tailnet, mobile_lan}` 且路径以
`/api/`、`/dev/`、`/ws/` 起头者返回 `remote_business_forbidden`;
`remoteVoiceWsDecision`(`:51-54`)对远程 via 一律拒。

**handler / upgrade / guard 实际顺序**(我逐行读了调用点,不依赖 linter 结论):

- main HTTP:`packages/daemon/src/index.ts:934` 进入 `/api/` 分支 → `:935-940` G1 身份门 →
  **`:942-954` remote guard 403** → `:955` mobile_lan 路由白名单 → `:967+` 业务处理。
  guard 在任何业务 handler 之前。[ok]
- recovery HTTP:`packages/daemon/src/api/recoveryOnlyServer.ts:424` 进入 `/api/` →
  `:425-433` 身份门 → **`:435-444` remote guard 403** → `:445+` 业务。[ok]
- `/dev/**`:不经上述 guard,但有更严格的本机门 ——
  `index.ts:881-895` 对 `pathname.startsWith("/dev/")` 且 `idv.via !== "local"` 一律 403
  (`dev_local_only`),位置在 `/dev/seed-fixture`(`:897`)、`/dev/inject|/dev/say`(`:903`)、
  `/dev/latency-report`(`:928`)三个 handler **之前**。远程仍是 fail-closed。[ok]
- WS:双层。`index.ts:3087-3096` 的 `verifyUpgrade` 先 `checkIdentity` 再
  `remoteVoiceWsDecision`,不通过即返回 `{ok:false, code}`;
  `packages/daemon/src/voice/hub.ts:189-206` 在 `onConnection` 里再判一次,
  拒绝发生在 `peers.add(peer)`(`:218`)与 hello 处理之前,`ws.close(4003, code)`。[ok]
- 仅放行面:`/health`(`index.ts:809`)、`/readyz`(`:836`)在守卫之前直接应答;
  静态壳与 127.0.0.1→localhost 308 归一属非 `/api|/dev|/ws` 路径,`remoteHttpBusinessDecision`
  返回 allow。与 inventory 的 remote-allow 集合完全一致(§4.5)。[ok]
- local 不回归:本会话 Playwright 38/38 通过,其中本机路由渲染、写口、S3 卡、
  vite dev 47120 同源 proxy、双动作等本机用例全绿;LAN 侧
  `console.spec.ts:301/316/329/337/345/353` 六条真浏览器 RFC1918 用例断言 403 与
  「不挂业务树 / WS 到不了 online」全部通过;
  `packages/daemon/test/mobile-lan-process.test.ts` 真实进程链用例通过
  (daemon 全量日志:`[ok] test/mobile-lan-process.test.ts (1 test) 2225ms`)。[ok]

### 4.5 PG01B-REMOTE-DENOMINATOR

- `scripts/remote-surface-inventory.json`:119 条 entry。我用 python 程序化核验:
  **每条都有 `method`、`via`、`outcome` 三个字段,缺失 0 条**;
  method 分布 `POST 49 / GET 41 / NOT_APPLICABLE 28 / DELETE 1`;
  `outcome` 是 per-via 字典(取值域 `allow` / `remote_business_403` / `local_only`)。[ok]
- 远程可达面恰好 6 条,且只有 health / readiness / static_shell:
  main 与 recovery 各 `GET /health`、`GET /readyz`、`GET /*`(static_shell)。
  `safe_redirect` 两条(`308:localhost`)只对 `local` allow。
  28 条 WS 全部 class=business,**远程 allow 计数为 0**。
  Unix 一条 `tier1 POST /gate`,via=`not_applicable`,outcome=`local_only`。[ok]
- `scripts/check-remote-surface-inventory.mjs` 做**双向** exact-set 对账:
  源→清单(`:625` 起 `unregistered ...`)与清单→源(`:629` `inventory HTTP method+path missing in
  ${root} source`)两个方向都报错;WS(`:633-639`)、tier1 Unix(`:641-651`)同样双向;
  另检 guard 存在性(`:654-657`)与 guard 相对 `/api/` 块、`onConnection` 的位置
  (`:658-671`)。四个 composition root 见 `:11-16`。[ok]
- mutation self-test:`node scripts/test-remote-surface-inventory.mjs` exit 0,输出 8 条 —
  omission(drop route)、unlisted handler、guard bypass、WS、method、via、outcome 均覆盖,
  与 acceptance 列举一一对应。[ok]

### 4.6 PG01B-SP2D-COMPAT

- additive runtime parse:`abandonFocusApi` 是新增函数,`/api/focuses/:id/abandon` 是新增
  路由分支(`index.ts:1768` 正则、`:1838-1839` 分派),`archive`/`reopen` 分支原样保留
  (`:1836-1837`、`:1840-1841`)。无破坏性 schema 变更,无数据库迁移
  (P..I 内 `packages/daemon/src/storage/**` 未被改动,`packages/contracts/**` 亦未改动)。[ok]
- bundled client 已使用:console 源 `RecordsPageRoute.tsx:77` 调新 endpoint;
  Playwright 由 global-setup 构建并经 daemon 同源静态服务该 bundle,本会话 38/38 通过。[ok]
- 旧 `/archive` N/N-1 兼容:`archiveFocusApi` 未改签名与返回,
  `console-api.test.ts:188-198`、`console-actions.test.ts:242-248` 断言
  `archived` 语义与 audit `meta.reason` 不变。[ok]

### 4.7 PG01B-GIT-POINTER

- `node scripts/schedule-pointer.mjs --check` exit 0,输出
  `[ok] schedule-pointer check active=PG-01B next=none last_closed=PROC-01 revision=3`。
- `HANDOFF.md` 与 `docs/plan/IMPLEMENTATION-PLAN-2.md` 两处 `schedule-pointer` 块内容逐字相同
  (revision=3 / active=PG-01B / next=none / last_closed=PROC-01 / updated_at=2026-09-04)。[ok]

## 5. 安全红线复核(未被放宽)

| 红线 | 结论 | 依据 |
|---|---|---|
| Gate 0 无 bypass | [ok] | P..I diff 内无 Gate 0 相关改动;`liveTools.ts` dispatch 前置注释与闸序未动 |
| S0-S3 / S3 语音绝不放行 | [ok] | 本 candidate 未改风险分级与 S3 路径;`docs/04` §5.2 改动只**收紧**远程面(远程下发指令由「配对 + PIN」降为 designed/deferred),未放宽 |
| audit 不可变 / 敏感只记 digest | [ok] | 新增 `focus.abandoned` 走同一 `AuditSink.record`,理由只落 `jcsDigest`(`focuses.ts:215`) |
| TTS 脱敏 | [ok] | 产品侧 `hub.ts:845/884/894` 三处 `redactText` 均在;本轮为 `sendTtsSay` 补上真实接线断言(§3.1) |
| D3/D6 未签不得当作已放开 | [ok] | `docs/plan/2026-08-28-project-gap-owner-decisions.md:83-84` 两行仍是 `[ ]` 未勾选,且本 candidate 未改该文件;`docs/04-key-mechanisms.md` §5.4 与 §5.2 明写「D3 未签」「DF-REMOTE-REOPEN designed/deferred」 |

## 6. 我本会话实际运行的门禁(命令 + exit code)

均在 `<repo>` 前台真实执行,未使用会因
stdout 静默而中断的包装器。

| 门禁 | 命令 | exit | 计数行原文 |
|---|---|---|---|
| focused-daemon | `bash logs/pg01b-owner-recovery-3-20260905/gate-entries/focused-daemon.sh` | 0 | ` Test Files  131 passed \| 2 skipped (133)` / `      Tests  2184 passed \| 6 skipped (2190)` / `   Duration  129.89s` |
| focused-console | `bash logs/pg01b-owner-recovery-3-20260905/gate-entries/focused-console.sh` | 0 | ` Test Files  34 passed (34)` / `      Tests  283 passed (283)` |
| playwright | `bash logs/pg01b-owner-recovery-3-20260905/gate-entries/playwright.sh` | 0 | `  38 passed (2.3m)` |
| remote-inventory-check | `bash .../gate-entries/remote-inventory-check.sh` | 0 | `[ok] remote-surface-inventory exact-set matches four composition roots` |
| remote-inventory-mutations | `bash .../gate-entries/remote-inventory-mutations.sh` | 0 | `[ok] remote-surface-inventory self-test 8 passed` |
| pairing-corpus | `bash .../gate-entries/pairing-corpus.sh` | 0 | `[ok] pairing url corpus 216 passed` |
| schedule-pointer | `node scripts/schedule-pointer.mjs --check` | 0 | `[ok] schedule-pointer check active=PG-01B next=none last_closed=PROC-01 revision=3` |
| emoji | `bash scripts/check-emoji.sh` | 0 | `[ok] emoji gate: clean` |
| public-tree-privacy | `node scripts/check-public-tree-privacy.mjs --fs` | 0 | `[ok] public-tree-privacy scanned=1991 binary=108 excluded=8 hits=0` |
| fingerprint | `python3 ~/.octoworkflow/candidate_fingerprint.py --expect e42dd19c...` | 0 | `{"algorithm": "git-diff-v1", "fingerprint": "e42dd19c...", "head": "ebd4490..."}` |

`just ci` 与裸 `pnpm exec playwright test` 按本轮任务书约定未由我运行/不由我判定:
`just ci` 属 semantic GREEN 后 supervisor 在同一 clean I 上跑的完整门禁,**未运行**。

单测/e2e 中与本轮 delta 直接相关的用例明细(取自真实输出):

- `[ok] test/voice-hub.test.ts (51 tests) 1574ms`
- `[ok] test/redactor.test.ts (12 tests) 10ms`
- `[ok] test/mobile-lan-process.test.ts (1 test) 2225ms`
- `[ok]  21 e2e/console/console.spec.ts:388:1 › M1 本机 queueText 成功：清草稿、跳聊天、transcript 出现原文 (682ms)`
- `[ok]  22 e2e/console/console.spec.ts:402:1 › M1 本机 queueText 写入异常：保留草稿并提示失败 (646ms)`

本会话日志(仅存于会话 scratchpad,不入 Git):

| 文件 | 字节 | SHA-256 |
|---|---|---|
| daemon-vitest.txt | 56203 | `4ca929c7fc8a60fb36e52f6c457524250bdd5134cdf4299423608aab00ddb332` |
| console-vitest.txt | 2180 | `18898999d75043a55fe896675b9119c7a507defc922659c95043eacca17aeef3` |
| playwright.txt | 4976 | `834cab6ce740e7d8f82f1d4aa05b86606555b335b2432d3ad03b3fa72237fbca` |

### 6.1 截图副作用与工作树污染处理

我使用仓内已冻结入口 `logs/pg01b-owner-recovery-3-20260905/gate-entries/playwright.sh`。
运行前我先自查 47188/47189/47120 三个端口:`lsof -ti` 全部无输出,
`/private/tmp/saydo-playwright-home-*` 不存在,因此该脚本的清理段是空操作,
没有杀掉任何进程、没有删除任何既有目录。
脚本在 `pnpm exec playwright test` 之后执行 `git checkout -- e2e/screenshots` 还原被重写的
tracked 截图并保留原始 exit code(0)。

daemon 全量测试期间会创建临时 git worktree(日志可见
`Preparing worktree (new branch 'saydo/tsk_...')`),用例自行清理。

三套门禁跑完后:`git status --short` **无任何输出**,
`git status --short -- e2e/screenshots` 无输出,`git worktree list` 只剩本目录,
`git rev-parse HEAD` 仍为 `ebd4490...`,fingerprint 复算仍等于期望值。
[ok] 工作树干净,未留污染。

## 7. P0/P1 blocker

无。本轮未发现绑定当前 canonical / 正式入口 / 声明 grammar 内**实际可达**失败的 P0 或 P1。

特别地,本轮最关键的怀疑点(新增 TTS 脱敏断言是否为永真的假绿)经代码路径论证**不成立**:
断言绑定 redactor 真实改写后的输出,移除 `hub.ts:845` 的 `redactText` 接线会使两条用例同时失败。

## 8. Deferred P2 delta

以下四条只登记、不当轮修,`docs/plan/2026-08-28-project-gap-closure-program-DEFERRED-P2.md`
现有最大 ID 为 `P2-001`,故本轮从 `P2-002` 递增。均不影响 verdict。

- **P2-002** `packages/console/src/mobile/MobileApp.tsx:108` — 新增成功路径 e2e 未独立锁住
  `setSuppressFirstRun(true)`。`MobileApp.tsx:200` 传的是
  `suppressFirstRun || voice.transcript.length > 0`,而该用例断言 transcript 已含原文,
  第二个析取项已为真,故删掉 `:108` 该行不会让新用例变红。属覆盖缺口,不是行为缺陷。
- **P2-003** `packages/daemon/test/focus-v04e-screen-a7-a6.test.ts:128-135` — 改写后
  `hub.sendToConsolePeers((m) => m.via === "tailnet", ...)` 断言 `succeeded === 0`,
  在远程 console peer 已无法建连的前提下恒成立;原先「连上但永不投递」的定向 predicate
  防泄漏覆盖度下降。连接层 4003 拒绝已被断言,不构成安全回归。
- **P2-004** `packages/daemon/test/voice-hub.test.ts:784-801` — `sendConsoleSay`
  (`packages/daemon/src/voice/hub.ts:894`)与 `sendNativeReply`(`hub.ts:884`)的
  `redactText` 接线仍无脱敏样本断言(现有样本「文本确认」不含可脱敏内容),
  与本轮为 `sendTtsSay` 修掉的是同一类缺口。产品代码已脱敏,属既存覆盖缺口。
- **P2-005** `scripts/check-remote-surface-inventory.mjs:658-671` — guard 顺序校验用
  `lastIndexOf` 字符串偏移做启发式判断,把 guard 抽成 helper 或出现第二个 `/api/` 块时
  可能失准。按 Review Value Boundary,linter 是 defense-in-depth 不是 security boundary,
  真实顺序已由 §4.4 的源码逐行核验与进程级用例保证。

## 9. 结论

verdict:**GREEN**。

candidate `ebd4490` 是 parent=P 的单一 implementation commit,fingerprint 与期望一致;
相对上一 candidate 只新增 82 行测试、未触碰任何产品代码;冻结 acceptance 七项独立取证全部成立;
安全红线未放宽;本轮补回的三处守护经代码路径论证均为**有效**断言,不是换层假绿;
我实跑的 10 项只读/焦点门禁 exit code 全部为 0,工作树跑完仍然干净。

```review-manifest
{
  "verdict": "GREEN",
  "review_ordinal": 2,
  "candidate_head": "ebd449080bb0e476eb2dd3334ee0b152cb3a7eeb",
  "diff_fingerprint": "e42dd19ca752c0ee2dca966fb0e915cbc9fce9375efcd3d45a53f060692f9727",
  "review_scope": "step",
  "blockers": [],
  "p2_ledger_delta": [
    {
      "id": "P2-002",
      "first_seen_candidate": "ebd449080bb0e476eb2dd3334ee0b152cb3a7eeb",
      "location": "packages/console/src/mobile/MobileApp.tsx:108; e2e/console/console.spec.ts:388-400",
      "evidence": "MobileApp.tsx:200 传入 suppressFirstRun || voice.transcript.length > 0;新增成功用例已断言 transcript 含原文,第二析取项恒真,故 setSuppressFirstRun(true) 这一行未被独立锁住。",
      "impact": "覆盖缺口:删除该行不会让新增 e2e 变红;当前场景可观察行为不变,无功能缺陷。",
      "status": "open",
      "last_validated_candidate": "ebd449080bb0e476eb2dd3334ee0b152cb3a7eeb",
      "resolution": "step scope 只登记;未修改产品或测试代码。"
    },
    {
      "id": "P2-003",
      "first_seen_candidate": "ebd449080bb0e476eb2dd3334ee0b152cb3a7eeb",
      "location": "packages/daemon/test/focus-v04e-screen-a7-a6.test.ts:128-135",
      "evidence": "改写后断言 hub.sendToConsolePeers((m) => m.via === 'tailnet', ...).succeeded === 0;远程 console peer 已被 hub.ts:201-206 在建连阶段拒绝,该断言恒成立。",
      "impact": "定向 predicate 层的防泄漏覆盖度下降;连接层 4003 拒绝已被同用例断言,不构成安全回归。",
      "status": "open",
      "last_validated_candidate": "ebd449080bb0e476eb2dd3334ee0b152cb3a7eeb",
      "resolution": "step scope 只登记;未修改产品或测试代码。"
    },
    {
      "id": "P2-004",
      "first_seen_candidate": "ebd449080bb0e476eb2dd3334ee0b152cb3a7eeb",
      "location": "packages/daemon/src/voice/hub.ts:884; packages/daemon/src/voice/hub.ts:894; packages/daemon/test/voice-hub.test.ts:784-801",
      "evidence": "sendNativeReply 与 sendConsoleSay 同样调用 redactText,但现有测试样本为「文本确认」「不得泄露」,不含任何 redactor 会改写的形态,接线被移除测试仍会绿。",
      "impact": "与本轮为 sendTtsSay 修掉的是同一类覆盖缺口;产品代码脱敏仍在,当前无实际泄漏路径。",
      "status": "open",
      "last_validated_candidate": "ebd449080bb0e476eb2dd3334ee0b152cb3a7eeb",
      "resolution": "step scope 只登记;未修改产品或测试代码。"
    },
    {
      "id": "P2-005",
      "first_seen_candidate": "ebd449080bb0e476eb2dd3334ee0b152cb3a7eeb",
      "location": "scripts/check-remote-surface-inventory.mjs:658-671",
      "evidence": "guard 顺序判定用 lastIndexOf('startsWith(\"/api/\")') 与 lastIndexOf(GUARD_HTTP) 的字符串偏移比较,属启发式;把 guard 抽成 helper 或新增第二个 /api/ 分支时可能失准。",
      "impact": "linter 是 defense-in-depth 而非 security boundary;真实 guard 顺序已由源码逐行核验与 mobile-lan 进程级用例保证,当前无可达失败。",
      "status": "open",
      "last_validated_candidate": "ebd449080bb0e476eb2dd3334ee0b152cb3a7eeb",
      "resolution": "step scope 只登记;未修改产品或脚本代码。"
    }
  ],
  "focused_gates": [
    {"name": "focused-daemon", "exit_code": 0, "summary": "pnpm --filter @saydo/daemon exec vitest run: Test Files 131 passed | 2 skipped (133); Tests 2184 passed | 6 skipped (2190); voice-hub.test.ts 51 tests 通过"},
    {"name": "focused-console", "exit_code": 0, "summary": "pnpm --filter @saydo/console exec vitest run: Test Files 34 passed (34); Tests 283 passed (283)"},
    {"name": "playwright", "exit_code": 0, "summary": "冻结入口 gate-entries/playwright.sh: 38 passed (2.3m);含新增两条本机 queueText 用例;跑完自动 git checkout -- e2e/screenshots,git status 干净"},
    {"name": "remote-inventory-check", "exit_code": 0, "summary": "node scripts/check-remote-surface-inventory.mjs: [ok] remote-surface-inventory exact-set matches four composition roots"},
    {"name": "remote-inventory-mutations", "exit_code": 0, "summary": "node scripts/test-remote-surface-inventory.mjs: [ok] remote-surface-inventory self-test 8 passed(omission/unlisted handler/guard bypass/WS/method/via/outcome 全覆盖)"},
    {"name": "pairing-corpus", "exit_code": 0, "summary": "node scripts/test-pairing-url-corpus.mjs: [ok] pairing url corpus 216 passed"},
    {"name": "schedule-pointer-check", "exit_code": 0, "summary": "node scripts/schedule-pointer.mjs --check: [ok] active=PG-01B next=none last_closed=PROC-01 revision=3"},
    {"name": "emoji-gate", "exit_code": 0, "summary": "bash scripts/check-emoji.sh: [ok] emoji gate: clean"},
    {"name": "public-tree-privacy", "exit_code": 0, "summary": "node scripts/check-public-tree-privacy.mjs --fs: [ok] scanned=1991 binary=108 excluded=8 hits=0"},
    {"name": "candidate-fingerprint", "exit_code": 0, "summary": "python3 ~/.octoworkflow/candidate_fingerprint.py --expect: git-diff-v1 fingerprint 与期望一致,head=ebd4490"}
  ],
  "stop_reason": null
}
```
