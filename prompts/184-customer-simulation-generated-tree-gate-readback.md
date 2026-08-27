# 任务：生成物字节对账门最终定向复核

你是零上下文、单一只读评审者。仓库为 `~/WorkSpace/SayDo`。不得派生子评审，不得修改、删除或创建仓库文件，最终只输出 Markdown 报告正文。

只读取并对账：

- `research/codex-findings/182-customer-simulation-data-repair-readback.md`
- `prompts/183-customer-simulation-generated-tree-gate-repair.md`
- `research/customer-question-corpus/simulations/validate-simulations.mjs`
- `research/customer-question-corpus/simulations/test-simulation-mutations.mjs`
- `research/customer-question-corpus/simulations/simulation-spec.mjs`
- `research/customer-question-corpus/simulations/README.md`
- `research/customer-question-corpus/simulations/00-simulation-plan.md`

唯一问题：原 A-02 是否已关闭。必须独立验证：

1. validator 用 `renderGenerated(specs)` 对 12 个 session、12 个 fixture 和 `02-coverage.md` 做逐文件完整内容/字节相等检查；
2. spec 不变、仅变异内存生成 Markdown 的三类反例都被拒绝：删除必需 fixture payload 字段、把 S3/F4 结果写成已执行、把别的 SIM 用户轮塞进当前会话；
3. 正式树在 mutation 前后不变，摘要仍为 `9c46c80089f3d5b7adc27f49f1140f70aff39ef811d1f6334e84aa53f0bce4f1`；
4. 原 72/12/HML、28 个非阻塞 warning、600 条主语料无回归；
5. README 与计划已登记 mutation 命令。

运行并记录真实退出码：

```bash
node research/customer-question-corpus/simulations/validate-simulations.mjs
node research/customer-question-corpus/simulations/test-simulation-mutations.mjs
find research/customer-question-corpus/simulations -type f -print0 \
  | xargs -0 bash scripts/check-emoji.sh
node research/customer-question-corpus/validate.mjs
```

本次不重新审查 72 条内容，不讨论短 payload、三轮集中或构建原子性。只有生成物虚绿仍存在或引入新安全/结构回归才判 A。最终报告给 `[pass]`/`[fail]`、A/B/C 数量、逐项证据、门禁摘要和是否建议按既定模拟用途交付。零 emoji。
