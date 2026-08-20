# 80 · S1 批(决策包 Demo 小样接线)code review(零上下文只读;Grok 回落,Codex 配额耗尽)

你是对抗性 code reviewer,只读(read_file / grep / list_dir)。被审对象 = `.tmp/batch-diff.patch`(`git diff 33c5cf1..HEAD` 全文;六提交 `8e6c819` 生成器 / `3c9c52b` 工厂 / `5c48eb4` 端点+console / `81e6b9a` proposeStart / `6e0a9b2` canonical / `40810a3` evidence)。规格 = `docs/plan/IMPL-PROMPT-12-S1-DEMO-WIRING.md` 与方案 `docs/plan/2026-08-20-seven-steps-gap-closure.fable.md` §2。门禁由调度方沙箱外实跑(结果随后补入评审 2;你不跑命令)。

找问题不给好评,按 A/B/C:
- A 级:安全(新端点 `GET /api/artifacts/:id/versions/:version` 的身份门位置是否在 capability token / Host-Origin 门之后、`mobile_lan`/tailnet 口径、跨项目读取、digest 重校、1 MB 上限、XSS——iframe 是否真的 `sandbox=""` + `srcdoc` 且不含 allow、demo HTML 转义);签名域正确性(`demoRef` 进 `sign()`/`revise()`、`verifyPackageDigest` 对有 demoRef 的包通过、旧包无 demoRef 仍可读/可拍板);话术门 `SCREEN_CLAIM_RE` 未放宽且 proposeStart 只有真实投递成功才回 `demoPresented:true`;契约只 import `@saydo/contracts`、无 DDL 改动;既有测试期望值零改动(除规格允许)。
- B 级:`ArtifactStore` 扩展名改动对既有读路径的影响;`revise()` 的 supersedes 链;端点错误码与前端处理;console 组件可达性(TaskDetail 接入是否真渲染);canonical 回写措辞是否准确对齐 08 §R4;evidence SHA/数字。
- C 级:措辞。

必读对照源:`packages/daemon/src/{packages/factory.ts,demo/generator.ts,artifacts/store.ts,api/console.ts,index.ts(路由与身份门段),brain/liveTools.ts(proposeStart),live/dialog.ts(SCREEN_CLAIM_RE 消费),voice/hub.ts}`、`packages/contracts/src/{digests.ts,types/package.ts,types/artifact.ts}`、console `components/redesign/{DemoFrame,DecisionPackageCard}.tsx`、`pages/TaskDetail.tsx`、`lib/api.ts`,以及新增/改动的测试文件。

产出:A/B/C 发现(文件:行、问题、证据、修法)+ 总评(可并入 / 需返工)。简体中文,零 emoji,[ok]/[warn]/[fail]。报告全文作为最终回复输出。
