# 72 个模拟用户多轮使用会话

本目录从 600 条主问题中选取 72 条代表性条目，补成 3–5 轮模拟会话。用途是访谈演练、对话设计、提示词回放和人工评测：观察用户如何补信息，系统如何澄清、读取材料、停在审批点，以及如何从失败中恢复。

这些材料不是真实使用日志，不是 connector 可用性证明，也不是市场份额或需求概率。`H/M/L` 仍沿用主语料的专家启发式先验。mock LIVE 结果全部是合成快照，locator 只定位本目录 fixture。

## 快速导航

| 文件 | 作用 |
|---|---|
| [00-simulation-plan.md](00-simulation-plan.md) | 样本分层、生命周期最低数量、A/B 验收 |
| [01-schema.md](01-schema.md) | 单会话字段、turn 语义、fixture 事件、oracle、终态 |
| [02-coverage.md](02-coverage.md) | 72 个 `SIM` 到 corpus ID 的映射和覆盖统计（生成物） |
| [sessions/](sessions/) | 12 个领域文件，每域 6 个会话（生成物） |
| [fixtures/](fixtures/) | 与会话一一对应的 mock 工具/RAG 事件（生成物） |
| [simulation-spec.mjs](simulation-spec.mjs) | 72 个结构化显式 spec 的唯一生成源 |
| [rebuild-simulations.mjs](rebuild-simulations.mjs) | 只重写 `sessions/`、`fixtures/`、`02-coverage.md` |
| [validate-simulations.mjs](validate-simulations.mjs) | A 级失败；B/C 只输出 `[warn]` 且退出 0 |
| [test-simulation-mutations.mjs](test-simulation-mutations.mjs) | spec 与生成 Markdown 变异自测，正式树不得被改写 |

## 如何回放

1. 在 [02-coverage.md](02-coverage.md) 选一个 `SIM-*-NN`。
2. 打开对应 `sessions/*.md`，先读源标签、选样理由和回放前状态。
3. 若上下文含 `CTX-xx`，先读 `../contexts/CTX-xx/manifest.md`，只使用白名单与 required claims 内的事实。
4. 按轮次读用户原话和“期望系统动作”。动作规定行为，不规定逐字答案。
5. 用 `fixtures/*.md` 中的 `sim://SIM-ID/event-name` 事件提供 mock 工具或 RAG 结果；`no_tool` 表示 K0 不调用外部工具。
6. 用 oracle 判定必须做到、不得做和可接受差异；再看失败/扰动变体是否 fail-closed。
7. 终态停在等待用户、可审阅、已给草稿、已给证据或拒绝并收缩范围。不要把 `ready_for_review` 说成完成或交付。

```bash
node research/customer-question-corpus/simulations/rebuild-simulations.mjs
node research/customer-question-corpus/simulations/validate-simulations.mjs
node research/customer-question-corpus/simulations/test-simulation-mutations.mjs
find research/customer-question-corpus/simulations -type f -print0 \
  | xargs -0 bash scripts/check-emoji.sh
```

构建器只读取主语料 `questions/*.md` 以回填标签，不改写 600 条问题、contexts、contracts 或 `04-live-source-contracts.md`。

## 哪些是模拟

- 用户后续轮次、澄清、纠正、改需求、确认、拒绝和续接；
- 期望系统动作与 oracle；
- 合成组织、账号代号、冻结 CTX 引用和 mock LIVE payload；
- 工具失败、空结果、冲突、过期、权限不足和部分结果；
- S3/F4 的预览、挑战、拒绝或安全降级路径。

## 哪些不能当真实能力证明

- 真实 SaaS 登录、object ID、token 或可执行 locator；
- 真实付款、发送、部署、发布、删数据或签署；
- 逐字一致的理想助手答案；
- 用这 72 个会话的频次替代访谈、遥测或市场研究；
- 把 `ready_for_review` / `draft_ready` / `evidence_ready` 写成已经交付。

S3 或 F4 会话只允许预览、挑战、拒绝或降级。fixture 不含真实姓名、个人联系方式、密钥、完整本地路径、医疗诊断或可执行交易指令。
