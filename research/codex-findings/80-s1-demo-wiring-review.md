# 80 · S1 批(决策包 Demo 小样接线)code review(Grok grok-4.6 xhigh 只读;Codex 配额耗尽回落)

> prompt:`prompts/80-s1-demo-wiring-review.md`;session `01a01b4e-6be6-77d2-8c02-362f8fe32720`;门禁由调度方沙箱外实跑:`just ci` EXIT=0(contracts 103 / cli 19 / console 256 / daemon 1514|4 / python 33)。

先读评审技能、规格与 diff，再按 A/B/C 对照必读源码做只读对抗审查。规格已读。接下来对照方案 §2 与 patch，再核必读源码与测试。先摸清 patch 体量，再按提交分块读实现与测试。继续读完 patch 各 hunk，并对照当前实现源码。对照身份门、签名域、话术门与 iframe 沙箱，核当前实现。对照规格与当前源码后，**未发现必须挡合并的 A 级问题**。身份门、签名域、话术门、契约/DDL、iframe 沙箱这些红线在代码里是立住的。下面只列问题；门禁本会话按指令未跑。

## 总评

**可并入**（无 A 级必修）。B 级按轻量评审「择要吸收」，不构成返工红灯。本会话只读 `read_file`/`grep`/`list_dir`，不把 evidence 里的测试数字或 SHA 当作本会话复算结果。

---

## 红线核对（A 级范围）

| 项 | 结论 | 证据 |
|---|---|---|
| 新端点在 capability / Host-Origin 门之后 | [ok] | `index.ts:871-890` 先 `checkIdentity`，再 `mobileLanApiAllowed`；`mArtVer` 在其后的 `GET` 分支 `index.ts:1111-1133` |
| `mobile_lan` 拒、tailnet 可读 | [ok] | 白名单无此路径 `mobileLan.ts:11-25`；`t2-thin.test.ts:200` 断言 `false`；生产 403 走既有 `mobile_lan_route_rejected` |
| 跨项目读取 | [ok] | `console.ts:308-309` 先比 `owner.project_id !== projectId` 再 `store.read` |
| digest 重校 | [ok] | `store.read` 重校；损坏映射 409 `console.ts:315-318` |
| 1 MB 上限 | [ok] 语义有、[warn] 时机见 B1 | `ARTIFACT_CONTENT_MAX_BYTES` + 413 `console.ts:282,321-323` |
| iframe `sandbox=""` + `srcDoc`、无 `allow` | [ok] | `DemoFrame.tsx:10-13`；未抄 TaskDetail trust-report 的 `allow-same-origin`（`TaskDetail.tsx:261`） |
| Demo HTML 转义 | [ok] | `generator.ts:10-12`；既有 XSS 用例仍在 `p05e-demo.test.ts:47-52` |
| `demoRef` 进 `sign()`/`revise()` | [ok] | `factory.ts:77-78,120-126,199` |
| 有 `demoRef` 可验包 | [ok] | `package-factory.test.ts:149-152,181`；`computePackageDigest` 本批未改、域内已含 `demoRef` |
| 旧包无 `demoRef` 仍可读/可拍板 | [ok] 代码、[warn] 无回归用例 | `sign()` 无则省略；JCS 丢 `undefined`（`jcs.ts:28`）；`demoRef` 仍 optional；`validateDispatch` 仍走 `verifyPackageDigest`（`effects.ts:195-196`） |
| `SCREEN_CLAIM_RE` 未放宽 | [ok] | 定义未进本批 diff；`dialogLoop.ts:33` 原词表；`propose-start-demo.test.ts:147-151` |
| `demoPresented:true` 仅真实投递成功 | [ok] | `liveTools.ts:861-866`：`succeeded >= 1`；无 peer 不调用 |
| 契约只 import `@saydo/contracts`、无 DDL | [ok] | daemon 用 `Omit<DecisionPackage,"digest">`；patch 无 `ddl.ts` / 无改 `computePackageDigest` |
| 既有测试期望值零改 | [ok] | 既有 `it` 未改 expect；`t2-thin` 只在原 `it` 内加一条断言 |

---

## A 级

无。未发现身份门绕过、跨项目读、digest 不校、iframe 放脚本、签名域分叉、话术门放宽、DDL/`computePackageDigest` 改动、或既有 expect 被改。

---

## B 级

### B1 · 跨项目 403 被前端当成「凭证失效」

- **文件:** `packages/console/src/lib/apiError.ts:107-117`；`packages/daemon/src/api/console.ts:308-309`；`packages/console/src/components/redesign/DemoFrame.tsx:52-59`
- **问题:** 新读口跨项目返回 **403** `artifact_project_mismatch`。`apiErrorFromResponse` 把任意 403 打成 `kind:"auth"`，文案「访问凭证已失效」。点「看小样」若 project 对不上（或 `mobile_lan` 403），UI 会叫人换 token，而不是说产物不属于该项目。
- **证据:** `if (status === 401 \|\| status === 403 \|\| AUTH_CODES.has(code))` 不看 `code`；`PackageDemoPreview` 直接 `e.message`。
- **修法:** 业务 403（`artifact_project_mismatch` / `mobile_lan_route_rejected`）从 AUTH 分支排除，按 `code` 映射；或读口跨项目改 404（与「不给枚举面」更一致，需同步测试）。

### B2 · 1 MB 上限在整文件入内存且 digest 之后才判

- **文件:** `packages/daemon/src/api/console.ts:313-323`；`packages/daemon/src/artifacts/store.ts:68-73`
- **问题:** 规格要 1 MB 上限。实现是 `readFileSync` 全文 → 算 digest → 再 `Buffer.byteLength`。超大文件会先撑内存，再 413。`ArtifactStore.write` 无对称上限，组包可以写入、读口再拒。
- **证据:** 上限只出现在 `getArtifactContent`；`store.write` 无 size 检查。
- **修法:** 读前 `stat`/`fd` 超限直接 413；写入 demo 时同样封顶，避免「包签了、小样永远 413」。

### B3 · `screen_text` 被当成「小样上屏」，实际会拆 ④e 气泡语义

- **文件:** `packages/daemon/src/brain/liveTools.ts:861-866`；`packages/console/src/voice/useVoiceChannel.ts:593-616`；`packages/daemon/src/live/dialog.ts:965-973`
- **问题:** ④e 的 `screen_text` 是「同 `turnId` 用全文**替换**本轮气泡，并 `thinking:false`」。`proposeStart` 在工具阶段用**同一** `ctx.turnId` 先发「决策包小样已放到屏幕：…」。结果：思考态被提前关掉；该句随后被 dialog 对 `modelText` 的第二次 `sendScreenText` 覆盖。iframe 并不出现在对话页，要到 TaskDetail 再点「看小样」。prompt 写的「投递结果回传 dialog」也未并入 dialog 的 `screenDelivery`；话术硬门仍只看第二次投递。
- **证据:** `useVoiceChannel` 的 `case "screen_text"` 无条件 `thinking: false` + 按 `turnId` 替换；`liveTools` 只把 `VoiceDelivery` 写进工具返回值。
- **修法:** 不要占用本轮 `turnId` 的 ④e 通道（独立 turnId，或等最终口播那一次投递）；工具投递的 `succeeded` 若要算话术门，应累加进 dialog 本轮 `screenDelivery`。硬门本身未放宽，故不是 A。

### B4 · `DecisionPackageCard` 有 `demoRef` 无 `projectId` 仍画「看小样」

- **文件:** `packages/console/src/components/redesign/DecisionPackageCard.tsx:45`；对比 `TaskDetail.tsx:93-98`
- **问题:** TaskDetail 要求 `demoRefOk && projectId`。卡片只看 `pkg.demoRef`。Focus 以后若补上 `lookups.packages` 却漏 `projectId`，按钮可点，然后「缺少项目,无法加载小样」。
- **修法:** 与 TaskDetail 对齐：无 `projectId` 不渲染按钮。

### B5 · `PackageDemoPreview` 失败不清空旧 HTML，`demoRef` 变化不重置

- **文件:** `packages/console/src/components/redesign/DemoFrame.tsx:44-60`
- **问题:** 第一次成功后，再点失败仍显示旧 iframe；`demoRef` 换版本不 `useEffect` 清理。`revise()` 后若卡片实例复用，会把旧小样当成新包。
- **修法:** `demoRef` 变化时重置 `html/err`；`catch` 里 `setHtml(null)`。

### B6 · 读口不校验 `type==="demo"`，响应带本机绝对 `path`

- **文件:** `packages/daemon/src/api/console.ts:288-324`；`packages/daemon/src/artifacts/store.ts:51-56`
- **问题:** 规格把该 GET 做成通用内容口，与 `exportArtifacts` 同级，tailnet 可读。但成功体是完整 `Artifact`（含 `path` = `~/.saydo/artifacts/…html`）。列表口本来就有 `path`，本批把**全文 + 绝对路径**给到同一面。前端也不校验返回 `type`。
- **修法:** 响应去掉 `path`（或只回 basename）；`PackageDemoPreview` 校验 `artifact.type==="demo"`，否则不进 `srcDoc`。

### B7 · 文件缺失走 500，`message` 可能带绝对路径

- **文件:** `packages/daemon/src/index.ts:1142-1144`；`store.ts:71`
- **问题:** 归属检查过了之后 `readFileSync` 若 ENOENT，不是 `ArtifactCorruptError`，落到通用 `api_error` 500，`String(err).slice(0, 200)` 常含本机路径。tailnet 可见。
- **修法:** ENOENT → 404/409；500 消息去路径。

### B8 · 测试锚有缺口（功能代码在，锁不牢）

- **文件:** `packages/daemon/test/artifacts-controls.test.ts:94-134`；`propose-start-demo.test.ts:109-101`；`package-factory.test.ts`
- **问题:**
  1. `mobile_lan` 403 只测了 `mobileLanApiAllowed` 函数，没有 HTTP 打到 `mArtVer`。
  2. 无「旧包无 `demoRef` → `verifyPackageDigest` 仍 null / 可拍板」用例（红线有、测试无）。
  3. 无 `sendScreenText` `succeeded=0` → `demoPresented:false`（mock 恒 `succeeded:1`）。
  4. 无 413 用例；console 只测了 SSR 按钮/iframe，未测 fetch/403/409。
- **修法:** 补上述用例。旧包可用 `insertPackage` 塞无 `demoRef` 的 body，再 `getPackage` + `verifyPackageDigest`。

---

## C 级

### C1 · iframe 单测锁的是 `srcDoc=` 不是 HTML `srcdoc=`

- **文件:** `DecisionPackageCard.test.tsx:37`
- **问题:** 客户端 JSX 用 `srcDoc` 没问题；SSR 串断言 `srcDoc=` 对「禁止 `src=`」锁得偏弱（`/\ssrc="/` 本来也匹配不到 `srcdoc=`）。
- **修法:** 断言 `/srcdoc=/i`，并继续禁止独立 `src=`。

### C2 · 「在产物库查看」只到列表，不到该 artifact

- **文件:** `DemoFrame.tsx:25`
- **问题:** `#/p/${projectId}/artifacts` 符合 hash 路由，但不带 id。规格只要求这句链接，属措辞/体验。

### C3 · 「看小样」沿用 `Btn` 默认 padding，高度大约不到 11 §9 的 40px

- **文件:** `shared.tsx:170-184`；`DemoFrame.tsx:64-66`
- **问题:** 既有按钮规格债，本批新主按钮沿用。

### C4 · evidence SHA / 全量用例数本会话未复算

- **文件:** `e2e/evidence/s1-demo-wiring.md:18-58`
- **问题:** 五提交短 SHA 与「不自指」写法符合两提交法。源码侧用例数（p05e 6 / factory 13 / artifacts-controls 6 / propose-start 3 / console 3）与表一致。完整 SHA、`just ci`、daemon 1514 需调度方评审 2 复跑。本会话**不能**签这些数字。

---

## 规格对齐上的非缺陷（避免误报）

- `cost.max` 按 09 是 `number`，未读 `max.value`。evidence 已写明。以 canonical 为准，不算偏。
- Focus `lookups.packages` 仍空：规格未做清单已登记，卡片接线在组件层，页不可达是既有债。
- `SCREEN_CLAIM_RE` 不匹配「已放到屏幕」是故意的（`propose-start-demo.test.ts:151`）；#10 那句仍靠口播「放屏幕上了」+ dialog 二次投递。

---

## 修复优先级（若择要吸收）

1. B1：403 文案（小、用户能撞到）
2. B3：不要用本轮 `turnId` 提前发 ④e `screen_text`（口播/上屏一致性）
3. B5 + B4：预览状态机
4. B2 + B7 + B6：读口硬化
5. B8：补锁红线的测试

**结论:** 安全红线与签名/话术/契约在实现上成立，**不需因 A 级返工**。B1/B3 建议在并入前或紧随的小补丁里收。