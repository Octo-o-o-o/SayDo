# SayDo S1 批（决策包 Demo 小样接线）· 实施 Prompt（第十二轮交接）

> 方案源：`docs/plan/2026-08-20-seven-steps-gap-closure.fable.md` §0/§2（裁决 D-S1-1…D-S1-6）。背景：决策包"三件套"里的轻量 Demo 生成器 `renderPackageDemo` 已落地但生产零调用方、`demoRef` 恒空；本批把它接进组包 → 产物库 → 控制台 iframe 沙箱 → 话术，并修生成器的 `.amount` 误读。
> 性质：接线 + 两处 additive（`ArtifactStore` 扩展名按类型、一个只读 HTTP 端点）+ 一条 canonical 措辞回写（`docs/07` D14 的 Demo 生成归属，解决其与 `docs/08` §R4 的既有矛盾；随批回写 + 一致性评审）。不改 DDL（`demoRef` 在 `body_json`）、不改签名算法（`computePackageDigest` 早已含 `demoRef`）。
> 纪律：两提交法；evidence `e2e/evidence/s1-demo-wiring.md`；零 emoji；不部署常驻、不 push、不改 `~/.saydo`；施工 = 独立 clone 分支 `batch/s1-demo-wiring`；实施 = Grok 4.6 headless，评估 = 零上下文只读会话。HANDOFF「当前批次指针」由 W5.4-a 占用，本批**不写指针**（小批，evidence 自证）。

---

你接手 **SayDo S1 批**。代码仓 = 当前目录（独立 clone，分支 `batch/s1-demo-wiring`，基线 `354b028`）。完成判定 = §3 各项验收锚全绿 + evidence 落盘 + §5 对账表。

## 0. 坐标核验（先做，漂移即停并汇报）

| 命令 | 期望 |
|---|---|
| `git log --oneline -1` | `354b028` |
| `rg -n "demoRef" packages/daemon/src packages/console/src` | 仅 `packages/daemon/src/packages/factory.ts:5`（注释）命中 |
| `rg -n "export function renderPackageDemo" packages/daemon/src/demo/generator.ts` | `:11` 附近 |
| `rg -n "amount" packages/daemon/src/demo/generator.ts` | 一处（`cost.expected as {amount?: number}`，即 R-A8 bug） |
| `rg -n "const moneySchema" -A 6 packages/contracts/src/types/common.ts` | 字段名是 `value`（非 `amount`） |
| `rg -n "demoRef" packages/contracts/src/digests.ts packages/contracts/src/types/package.ts packages/contracts/src/types/artifact.ts` | `digests.ts` 签名域含 `demoRef`；`package.ts` `demoRef?: {artifactId, version}`；`artifact.ts` 类型枚举含 `"demo"` |
| `rg -n "async assemble\|sign\(\|revise\(" packages/daemon/src/packages/factory.ts` | `assemble` `:66` 附近、`sign` `:130` 附近、`revise` `:87` 附近 |
| `rg -n "\\.md\`" packages/daemon/src/artifacts/store.ts` | `:44` 附近路径写死 `.md` |
| `rg -n "getProjectArtifacts\|getArtifactDiff\|exportArtifacts" packages/daemon/src/index.ts` | 三处路由（约 `:1989-2011`） |
| `rg -n "SCREEN_CLAIM_RE" packages/daemon/src/brain/dialogLoop.ts packages/daemon/src/live/dialog.ts` | 定义 `dialogLoop.ts:33`；消费 `dialog.ts:973-992` |
| `rg -n "sendScreenText" packages/daemon/src/voice/hub.ts packages/daemon/src/index.ts` | hub `:720-729`；index 闭包 `:2722-2724` |
| `rg -n "trust-report" packages/console/src/pages/TaskDetail.tsx` | `:239-245`（现有 iframe 先例） |
| `pnpm --filter @saydo/daemon exec vitest run test/p05e-demo.test.ts test/package-factory.test.ts` | 全绿（记基线用例数） |

## 1. 必读

1. `AGENTS.md`、`HANDOFF.md` §0/§4。
2. 方案 §2 全文；`docs/04-key-mechanisms.md:79-88`（决策包三件套、Demo 与计划同源互引）；`docs/09-data-contracts.md:208-276`（§2 DecisionPackage，`demoRef` 语义 `:221`）、§8 Artifact（`:673-685`）；`docs/07-tech-stack-decisions.md:161`（D14）与 `docs/08-module-design.md:40,205`（A6 / R4）；`docs/10-voice-ux-spec.md:67`（#10 口播位）；`docs/11-ui-spec.md:516-531`（§7 Demo 视觉 / §8 零 emoji）。
3. 代码：`packages/daemon/src/packages/factory.ts` 全文、`demo/generator.ts`、`artifacts/store.ts`、`storage/dao/{packages,artifacts}.ts`、`api/console.ts:120-270`（任务详情 / 产物读口 / export 的归属断言）、`index.ts:1985-2015`（产物路由）、`brain/liveTools.ts:737-860`（proposeStart）、`live/dialog.ts:960-1000`（screen_text 投递与话术门）、`voice/hub.ts:715-730`；console：`components/redesign/DecisionPackageCard.tsx`、`components/redesign/types.ts:141-157`、`pages/TaskDetail.tsx`、`pages/Artifacts.tsx`、`lib/api.ts`。
4. 测试：`packages/daemon/test/p05e-demo.test.ts`、`package-factory.test.ts`、`artifacts*.test.ts`、`packages/console/src/**/DecisionPackageCard*.test.tsx`（若有）。

## 2. 红线

- 契约只 import `@saydo/contracts`；不改 DDL；不改 `computePackageDigest`；不在 URL 里放 capability token；iframe 必须 `sandbox=""`（零 allow）+ `srcdoc`，不得 `allow-scripts`/`allow-same-origin`。
- Demo HTML **不含** `pkg.digest`（避免签名循环）；HTML 内每个计划条目带 `data-seq` 与 `plan.seq` 互引（既有测试断言保留）。
- 话术门 `SCREEN_CLAIM_RE` **不放宽**：要让 #10 那句成立，必须靠本轮真实 `sendScreenText` 投递成功。
- 端点只读；项目归属断言与 `exportArtifacts` 同级；`via="mobile_lan"` 拒（不入 `mobileLan.ts` 白名单）。
- 零 emoji；状态词纪律；不 push。

## 3. 任务清单

### 3.1 A · 生成器修正 + 草案渲染入口（提交 `fix(demo): 生成器读 Money.value；支持从不签名草案渲染`）

- `demo/generator.ts`：成本读 `cost.expected.value / cost.max.value`（`known:false` 仍显示「还没有确切数字」）；新导出 `renderPackageDemoDraft(draft: DecisionPackageDraft)`，其中 `DecisionPackageDraft = Omit<DecisionPackage,"digest">`（在 daemon 内定义类型别名或由 contracts 的 `decisionPackageSchema.omit({digest:true})` 推导，**不得**在 daemon 重定义 schema）；`renderPackageDemo(pkg)` 保留为 `renderPackageDemoDraft` 的薄封装；HTML 删除 digest 行，保留 revision 与 `data-seq`。
- **锚**：`p05e-demo.test.ts` 既有三条通过；新增 ≥ 3：`known:true` 时显示真实 `value`；HTML 不含 `digest` 子串；draft 与签名后 pkg 渲染结果相同（除无 digest 本就不存在）。

### 3.2 B · 工厂接线 + 产物库扩展名（提交 `feat(packages): 决策包组包/改包同轮生成 Demo 小样并签入 demoRef`）

- `artifacts/store.ts`：新增 `extensionForType(type)`（`demo` ⇒ `.html`，其余 `.md`），`write()` 用之；既有读路径靠 DB 里存的 `path`，不受影响。
- `packages/factory.ts`：`AssembleInput` 不变（不让调用方传 demoRef）；`assemble()` 顺序：写 plan artifact → 构造 unsigned 草案（含 id/revision/planRef）→ `renderPackageDemoDraft(草案)` → `artifacts.write({projectId, type:"demo", source:"agent_output", tags:["decision-package-demo"], content})` → 草案带 `demoRef:{artifactId, version}` 进 `sign()`；`sign()` 的 `unsigned` 字段列表补 `demoRef`；`revise()` 的 `merged` 补 `demoRef` 并**重渲染**（新 demo artifact 以 `supersedes` 指向上一版本）。
- **锚**：`package-factory.test.ts` 新增 ≥ 5：assemble 后 `pkg.demoRef` 存在且 artifact 可读为 HTML；`verifyPackageDigest(pkg)` 通过；`revise()` 后 demoRef 指向新版本且 `supersedes` 旧版本、digest 变化；demo artifact 路径以 `.html` 结尾；`getPackage()` 回读含 demoRef。既有用例期望值零改动。

### 3.3 C · 只读端点 + 控制台呈现（提交 `feat(console): 决策包「看小样」——只读产物端点 + iframe 沙箱渲染`）

- daemon：`GET /api/artifacts/:id/versions/:version` → `{ artifact, content }`；归属断言（artifact.projectId 必须属于受信请求可见项目；复用 `exportArtifacts` 的断言方式）；`read()` digest 重校失败 ⇒ 409；`via="mobile_lan"` 403（不进白名单）；content 长度上限 1 MB。
- console：`lib/api.ts` 新增 `getArtifactContent(id, version)`；`components/redesign/types.ts` `DecisionPackageView` 加 `demoRef?`；`DecisionPackageCard.tsx` 在「做出来什么样」节末加「看小样」按钮（无 demoRef 时不渲染）；新组件 `DemoFrame`（`<iframe title="决策包小样" sandbox="" srcdoc={html} />`，高度自适应或固定 480，下方「在产物库查看」链接）；`pages/TaskDetail.tsx` 决策包区接入同组件（该页可达）。`pages/Artifacts.tsx` 类型 `demo` 显示为「小样」。
- **锚**：daemon 端点测试 ≥ 4（200 含 content；跨项目 404/403；digest 损坏 409；`mobile_lan` 403）；console 单测 ≥ 3（有 demoRef 渲染按钮、无则不渲染、iframe `sandbox` 属性为空字符串且使用 `srcdoc` 而非 `src`）。

### 3.4 D · 话术与 proposeStart 回传（提交 `feat(brain): proposeStart 回传 demoRef 并同轮上屏`）

- `brain/liveTools.ts` proposeStart：返回值增 `demoRef`（有则带）；组包成功且本地 console 在线（`voiceHub.hasConsolePeerForSession(sessionId)` 或等价）时，经 `screenText` 闭包投递一条「决策包小样已放到屏幕：{outcomePreview 前 40 字}」（`via=local` 才投）；投递结果按既有口径回传 dialog（使 #10 的「小样放屏幕上了」在投递成功时能过 `SCREEN_CLAIM_RE` 门；未投递成功则 Brain 不该说这句——instructions 加一句：只有工具结果 `demoPresented:true` 时才可说"放屏幕上了"）。
- **锚**：liveTools 单测 ≥ 2（有 peer ⇒ 投递并回 `demoPresented:true`；无 peer ⇒ `demoPresented:false` 且不投递）；`dialog` 话术门既有测试零改动。

### 3.5 E · canonical 回写 + evidence（提交 `docs(canonical): 07 D14 Demo 生成归属与 08 R4 对齐` 与 `chore(evidence): s1-demo-wiring`）

- `docs/07-tech-stack-decisions.md:161` D14："Demo HTML 由沉思档模型生成、iframe 沙箱内渲染" → "Demo HTML 由决策包工厂（08 A6）按包内容确定性渲染、iframe 沙箱（`srcdoc` + 零 allow）内渲染；沉思档生成为后续增强（2026-08-20 S1 批对齐 08 §R4）"；`docs/09 §2 :221` demoRef 注释补"assemble/revise 同轮生成"。一致性 subagent 评审由调度方跑。
- evidence：坐标、五提交 SHA、门禁表、用例数前后、未做清单（Focus 页 `lookups.packages` 仍空 ⇒ 该页卡片不可达属既有债，登记；writing 类型 Demo 形态未变形，登记）。

## 4. 检查点

1. 若 `decisionPackageSchema.omit` 推导在 zod 版本下不可用 ⇒ 在 daemon 定义 `type DecisionPackageDraft = Omit<DecisionPackage,"digest">`（类型级，不重定义 schema），继续。
2. 若端点归属断言发现 artifacts 表无法回查 project 可见性 ⇒ 停并汇报。
3. 任何想放宽 `SCREEN_CLAIM_RE` 或给 iframe 加 allow 的冲动 ⇒ 停。

## 5. 诚实汇报

对账表（完成 / 部分 / 未做 + 真实 commit hash + `cmd; echo EXIT=$?` + 用例数前后）；`just ci` 在沙箱内 python 段若红如实记录，调度方沙箱外复跑。
