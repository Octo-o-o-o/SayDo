# bugs-for-engineers

本轮 live 走查(localhost:47100,HEAD `bc2ac87`)没有可交给工程师立刻修的产品缺陷:26 步终端断言全 PASS,pageerror=0。

不要把下面几类升格为本轮 bug:

1. **Playwright 夹具 25 红**(`e2e/console/console.spec.ts` 对 47188)。根因是测试 HOME 未武装 dialog、首页已改为今天、向导挡住桌面套件。live 同路径已渲染。救套件是独立工程批,不在 remote-mobile-w0 完成定义内。
2. **evaluator observed `Cursor Grok 4.6 Fast` vs requested `cursor-grok-4.6-high-fast`**。self-test status=ok,属 CLI 档位降级展示,与先前验收记录一致。
3. **开口聊未复读「模型在场」**。实际回复是无锚定对话的项目归属问句,并建立「未命名草稿」。这是对话策略,链路是通的。证据:`screenshots/16-F1_20260816-175012_PASS.png`。
4. **走查脚本 D15 首张截图拍在还原视口之后**。断言当时已在 390 宽通过;补拍 `screenshots/15-D15_20260816-175800_PASS.png`。这是 runner 缺陷,已记录,不是产品问题。

若后续要把 Playwright 25 红当工程债跟踪,应单独开「夹具套件与 live IA 对齐」批,不要混进 LAN 门或模型配置。
