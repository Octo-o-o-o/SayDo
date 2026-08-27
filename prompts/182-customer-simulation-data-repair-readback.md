# 任务：72 组模拟用户会话 A 级返工定向 readback

你是与实现过程零上下文的单一只读评审者。仓库位于 `~/WorkSpace/SayDo`。不要派生其他评审者，不得修改、删除或创建仓库文件；最终只输出 Markdown 报告正文。

以下评审文件是主会话明确授权的正式交付，不是执行偏差，不得删除，也不要把它们的出现当作仓库污染：

- `research/customer-question-corpus/simulations/review/01-coverage-naturalness.md`
- `research/customer-question-corpus/simulations/review/02-safety-rag-oracle.md`
- 后续可能出现的 `03-repair-readback-coverage.md`、`04-repair-readback-safety.md`

本次只做第一轮红灯的定向 readback，不再发散全面审查。读取：

- `prompts/181-customer-simulation-data-a-repair.md`
- `research/codex-findings/180-customer-simulation-data-adversarial-review.md`
- 上述 01/02 两份独立评审
- 当前 `research/customer-question-corpus/simulations/` 的 plan/schema/README/spec/build/validator/mutation、全部 12 个 sessions 和 12 个 fixtures

逐项判定：

1. `SIM-DAT-04` 是否已删除无来源的 RAG 账户时区，USER 声称是否保持待核；`SIM-SAL-05` 是否不再提前把 USER 红线写进 RAG。
2. 原独立评审 A-02 的 15 个会话是否已有完成题面与首个可审阅结果所需的最小合成事实：WRT-01、WRT-04、OPS-05、OPS-06、SAL-04、DAT-05、LRN-03、LIF-02、LIF-03、LIF-05、CAR-02、CAR-03、CAR-04、FAM-02、FAM-03。
3. WRT-01、OPS-05、SAL-05、DAT-04、RES-05、MKT-01、LRN-02、CAR-03 的基线 fixture 是否不再提前泄漏后续 USER 值。
4. RES-01、SAL-02、MKT-04、MKT-06、DAT-03、DAT-04 的失败变体是否与基线有明确状态或字段 delta。
5. 17 个 S3/F4 的生成会话是否呈现通用三联禁令，且仍未伪造外部消费、授权、发送、支付、部署、发布、删除或签署。
6. validator 是否精确按 SIM 块对账，并对已修最小字段和时序回归设门；`test-simulation-mutations.mjs` 是否真实拒绝三类变异且不改正式树。
7. 72 会话、12 域各 6、H/M/L 32/25/15、主 600 条是否保持；两次重建是否确定性一致；逐文件 emoji 门禁是否绿。

验收尺度仍然放宽：这是人读模拟数据，不是生产 connector 合同。只有原 A 未关闭或引入新安全/事实/结构 A 才判 `[fail]`；28 条短 payload warning、71 个三轮会话、构建器非原子、B/C 文案不阻塞，也不要据此启动新一轮全面复审。

必须运行真实命令并记录退出码：

```bash
node research/customer-question-corpus/simulations/validate-simulations.mjs
node research/customer-question-corpus/simulations/test-simulation-mutations.mjs
find research/customer-question-corpus/simulations -type f -print0 \
  | xargs -0 bash scripts/check-emoji.sh
node research/customer-question-corpus/validate.mjs
```

最终报告包括：结论 `[pass]`/`[fail]`、A/B/C 数量、逐项 readback、真实门禁摘要、是否建议按当前用途交付。零 emoji，不修改文件。
