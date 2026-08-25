# S1 批 · 决策包 Demo 小样接线(2026-08-20)

> 范围 = 生成器 `.value` 修正 + assemble/revise 同轮渲染 Demo + 产物 `.html` + 只读内容端点 + 控制台 iframe 沙箱 + proposeStart 上屏回传 + 07 D14 / 09 §2 措辞对齐。
> 完成定义 = IMPL-PROMPT-12 §3 锚全绿 + 本文件落盘。本文件不自指 SHA。
> 三级词表:[ok] 本会话真实命令 / [warn] 差距如实 / [fail] 未做或沙箱受阻。
> 不写 HANDOFF「当前批次指针」(W5.4-a 占用;本批小批,evidence 自证)。

## 0. 坐标

- 工作目录:`~/WorkSpace/saydo-batch-s1-demo-wiring`
- 分支:`batch/s1-demo-wiring`
- 开批 HEAD:`33c5cf134f08942457f9bc7f5589eeef88c0fbce`(`docs(plan,site): 官网 Docs/首页内容稿 v2...`)。prompt 写 `354b028`;本 clone 多一个其后 docs 提交,属允许漂移。
- `assemble` 行号:prompt 写 `:66` 附近,本树 `factory.ts:67`(函数体,非 `async`);`sign` `:174` 起(施工后;开批时 `:130`);`revise` `:90`(开批 `:87`)。结构未漂,仅行号随本批增长。
- Checkpoint 1:未用 zod `.omit`;daemon 内 `type DecisionPackageDraft = Omit<DecisionPackage,"digest">`(类型级,不重定义 schema)。
- Checkpoint 2:artifacts 表有 `project_id`,可 `SELECT 1 FROM projects WHERE id=?` 回查可见性,未停。
- Checkpoint 3:未放宽 `SCREEN_CLAIM_RE`;iframe `sandbox=""` 零 allow,未加 `allow-scripts` / `allow-same-origin`。

## 1. 五提交 SHA(代码/文档;本文件记录,不自指)

| 项 | 短 SHA | 完整 SHA | 标题 |
|---|---|---|---|
| A | `8e6c819` | `8e6c819a78a06aa896aed90e20c24fee1db6c39d` | `fix(demo): 生成器读 Money.value；支持从不签名草案渲染` |
| B | `3c9c52b` | `3c9c52bb909f20f19d8fd98e991da35a4891974f` | `feat(packages): 决策包组包/改包同轮生成 Demo 小样并签入 demoRef` |
| C | `5c48eb4` | `5c48eb44d46afe8692614c10a6d1aeaf60b62312` | `feat(console): 决策包「看小样」——只读产物端点 + iframe 沙箱渲染` |
| D | `81e6b9a` | `81e6b9a7d519a2dd8162598529a12dbaebdee1d0` | `feat(brain): proposeStart 回传 demoRef 并同轮上屏` |
| E docs | `6e0a9b2` | `6e0a9b28ae31334e7e721923d2bc91bd6b7c53cb` | `docs(canonical): 07 D14 Demo 生成归属与 08 R4 对齐` |

来源:`git log --format='%h %H %s' 33c5cf1..HEAD`(本会话)。

## 2. 用例数前后

开批基线(prompt §0 命令):

```
pnpm --filter @saydo/daemon exec vitest run test/p05e-demo.test.ts test/package-factory.test.ts
```

EXIT=0 · Tests **11 passed**(p05e 3 + factory 8)。

收口定向(同会话):

| 文件 | 前 | 后 | EXIT |
|---|---|---|---|
| `test/p05e-demo.test.ts` | 3 | 6 | 0 |
| `test/package-factory.test.ts` | 8 | 13 | 0 |
| `test/artifacts-controls.test.ts` | 3 | 6 | 0 |
| `test/propose-start-demo.test.ts` | 0 | 3 | 0 |
| `test/t2-thin.test.ts` | 16 | 16(既有 it 内加 mobile_lan 断言,不增 it) | 0 |
| `test/focus-v04e-screen-a7-a6.test.ts`(话术门零改) | 8 | 8 | 0 |
| `packages/console/.../DecisionPackageCard.test.tsx` | 0 | 3 | 0 |

`just ci` 的 `pnpm test` 摘录(node 段,本会话日志):

- contracts: **103 passed**
- cli: **19 passed**
- console: **256 passed**
- daemon: **1514 passed / 4 skipped**(Test Files 106 passed / 2 skipped)

相对开批定向 11,本批净增 daemon 定向 +11(p05e+3 / factory+5 / artifacts+3 / propose-start+3)+ console 卡 3。全量 daemon 1514 未在开批时跑全量,不把 1514-14 写成未实测的「开批全量」。

## 3. 门禁表(`cmd; echo EXIT=$?`)

| 命令 | EXIT | 摘录 |
|---|---|---|
| 开批 `pnpm --filter @saydo/daemon exec vitest run test/p05e-demo.test.ts test/package-factory.test.ts` | 0 | Tests 11 passed |
| `pnpm --filter @saydo/daemon exec vitest run test/p05e-demo.test.ts test/package-factory.test.ts test/artifacts-controls.test.ts test/propose-start-demo.test.ts test/t2-thin.test.ts test/focus-v04e-screen-a7-a6.test.ts` | 0 | Test Files 6 passed; Tests **52 passed** |
| `pnpm --filter @saydo/console exec vitest run src/components/redesign/DecisionPackageCard.test.tsx` | 0 | Tests **3 passed** |
| `pnpm typecheck` | 0 | contracts/cli/daemon/console `tsc --noEmit` Done |
| `pnpm lint` | 0 | `eslint packages/*/src` 无输出 |
| `bash scripts/check-emoji.sh` | 0 | `[ok] emoji gate: clean` |
| `just ci` | **2** | node 矩阵(typecheck/lint/test/emoji/color/migration)跑完;python 在 `uv sync` 处沙箱拒写 `~/.cache/uv`(`Operation not permitted`)。见下。 |
| `pipeline/.venv/bin/python -m ruff check pipeline/.` | 0 | `All checks passed!`(本会话后补 `.venv`;不是 `just ci` 本体) |
| `cd pipeline && UV_CACHE_DIR=... uv run python -m pytest -q` | 0 | **33 passed** in 0.29s |

`just ci` python 段红原因:沙箱禁写 `~/.cache/uv`。调度方沙箱外复跑 `just ci` 即可。本会话用工作区 cache 起 `.venv` 后 ruff/pytest 绿,不把 `just ci` 写成全绿。

## 4. 未做清单

- Focus 页 `lookups.packages` 仍空 ⇒ 该页 `DecisionPackageCard` 不可达,属既有债,本批不接线。
- writing 类型 Demo 形态未变形:生成器仍是决策包计划/验收/成本小样,无文章样章变体。
- 一致性 subagent + Codex 攒批由调度方跑(prompt §3.5)。
- 未 push;未改 `~/.saydo` / `~/Library`;测试未真弹通知、未真发网络请求。
- 未改 DDL、未改 `computePackageDigest`、未把 capability token 放 URL。

## 5. 实现要点(供对账)

- Demo HTML 不含 `digest`;成本读 `cost.expected.value`,`cost.max` 仍是 number(09 §2,非 `max.value`)。
- `GET /api/artifacts/:id/versions/:version?project=` 返回 `{artifact,content}`;跨项目 403 / 缺失 404 / digest 损坏 409;内容上限 1 MB;`via=mobile_lan` 不进 `mobileLanApiAllowed` 白名单 ⇒ 403。
- iframe:`title="决策包小样"` `sandbox=""` `srcDoc`;下方「在产物库查看」。
- `proposeStart` 返回 `demoRef` + `demoPresented`;仅 `hasConsolePeerForSession` 为真时 `sendScreenText`;instructions 禁止在 `demoPresented!==true` 时说「放屏幕上了」。

## 6. 评审 1 返工

报告:`research/codex-findings/80-s1-demo-wiring-review.md`(无 A 级,B1–B8 + C1 择要全收)。本文件记录返工 SHA,不自指。

| 提交 | 完整 SHA | 标题 |
|---|---|---|
| console | `2260033accd1fed13584a30e3427983c867aff92` | `fix(console): 评审 1 返工——业务 403 人话、看小样状态机与 iframe 属性` |
| daemon | `3badf47db4fb643ab14f1f46a2ac1dcedfccaf8c` | `fix(daemon): 评审 1 返工——独立 turnId 上屏、读口硬化与测试锚` |

来源:`git log --format='%h %H %s' -2`(本会话,evidence 提交之前)。

| 条 | 处置 |
|---|---|
| B1 | 业务 403(`artifact_project_mismatch` / `mobile_lan_route_rejected`)按 code 给人话,kind=client,不进凭证失效 |
| B3 | 小样 `screen_text` 用独立 `newId("ses")`;`creditScreenDelivery` 累加进 dialog 本轮 `screenDelivery`;不放宽 `SCREEN_CLAIM_RE`;补 `succeeded=0 ⇒ demoPresented:false` |
| B4 | `DecisionPackageCard` 无 `projectId` 不渲染「看小样」 |
| B5 | `demoRef` 变化重置 html/err;失败 `setHtml(null)` |
| B2 | 读前 `stat` 超 1 MB ⇒ 413;写 `type=demo` 对称封顶 |
| B6 | 响应 `path` 只回 basename;前端 `artifact.type==="demo"` 才进 srcDoc |
| B7 | ENOENT ⇒ 404;500 消息抹 `/Users` 等绝对路径 |
| B8 | HTTP mobile_lan 打到新路由 403;旧包无 demoRef `getPackage`+`verifyPackageDigest`+`assertProposable`;413;console 403/409 渲染 |
| C1 | 单测锁 `/sandbox=""/` 与 `/srcdoc=/i`,禁止独立 `\ssrc="` |
| C3 | 「看小样」`minHeight/minWidth: 40` |
| C2 | 未改:「在产物库查看」仍到产物库列表(规格只要求这句链接;hash 路由无 artifact id) |

用例数(评审 1 返工前 → 后,定向文件):

| 文件 | 前 | 后 | EXIT |
|---|---|---|---|
| `test/artifacts-controls.test.ts` | 6 | 8 | 0 |
| `test/package-factory.test.ts` | 13 | 14 | 0 |
| `test/propose-start-demo.test.ts` | 3 | 4 | 0 |
| `test/mobile-lan-process.test.ts` | 1 | 1(既有 it 内加新路由 403) | 0 |
| `DecisionPackageCard.test.tsx` | 3 | 7 | 0 |
| `apiError.test.ts` | 22 | 23 | 0 |

门禁(返工后本会话):

| 命令 | EXIT |
|---|---|
| 定向 daemon 6 文件 | 0(56 passed) |
| console DecisionPackageCard + apiError | 0(30 passed) |
| `pnpm typecheck` | 0 |
| `pnpm lint` | 0 |
| `bash scripts/check-emoji.sh` | 0 |
| `test/mobile-lan-process.test.ts` | 0(HTTP 新路由 403) |
