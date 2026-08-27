# 一次性对抗评审：600 条提问三轮静态 dry run

你是零上下文、只读的独立评审。仓库：`~/WorkSpace/SayDo`。不要使用 subagent，不要修改任何文件，不要调用真实 connector、外部账号、模型业务执行或业务写工具。

只评审以下交付及其权威源：

- `research/customer-question-corpus/dry-runs/00-three-pass-dry-run-plan.md`
- `research/customer-question-corpus/dry-runs/01-three-pass-dry-run-result.md`
- `research/customer-question-corpus/dry-runs/02-dry-run-remediation-plan.md`
- `research/customer-question-corpus/dry-runs/dry-run-model.mjs`
- `research/customer-question-corpus/dry-runs/rebuild-three-pass-dry-run.mjs`
- `research/customer-question-corpus/dry-runs/validate-three-pass-dry-run.mjs`
- `research/customer-question-corpus/questions/*.md`
- `research/customer-question-corpus/contexts/CTX-*/manifest.md`
- `research/customer-question-corpus/contracts/live/*.json`
- `research/customer-question-corpus/contracts/f1-capability-contracts.json`
- `research/customer-question-corpus/simulations/simulation-spec.mjs`
- `research/customer-question-corpus/00-能力边界.md`
- `docs/09-data-contracts.md`、`docs/10-voice-ux-spec.md`

不要读取实现 prompt、实施日志或其他评审报告。

## 必查事项

1. 独立解析 600 条，而不是只相信生成器：逐行核对 F/S/context、DR1、DR2、扰动、DR3、priority、issue code、理论结论。
2. 独立重算并核对：
   - F1/F2/F3/F4=46/483/60/11；
   - DR1 七类计数；
   - simulation=72；
   - priority replay/P0/P1/P2/P3=72/16/41/322/149；
   - P0 16、P1 41、GO 28 的完整 ID 集合。
3. 判断三轮是否真正互补，是否把 WAIT/UNPROVEN 误写成题目必然失败，或把 F3/F4 写成原始目标可执行。
4. 全量审查 33 个 S3、11 个 F4、16 个未 simulation 的 P0；确认 S3 语音绝不放行、非 merge effect 不签发、F4 拒绝并收缩、`ready_for_review` 不等于交付。
5. 检查 solution 是否覆盖 result 实际使用的全部 issue code；P0 16 是否逐题提供非 generic 补充；P1 41 是否完整且互斥；USER/connector/F2/F3/F4/S3/长任务/多工具/oracle 模板是否足以作为后续真实运行前置。
6. 检查 source/authority 摘要、两次 rebuild 的确定性设计、生成物 exact compare、主语料不变保护。
7. 运行真实门禁并记录退出码：

```bash
node research/customer-question-corpus/dry-runs/validate-three-pass-dry-run.mjs
node research/customer-question-corpus/validate.mjs
find research/customer-question-corpus/dry-runs -type f -print0 \
  | xargs -0 bash scripts/check-emoji.sh
```

8. 不改盘，使用 `collectDryRunIssues({resultText, solutionText})` 做至少四类内存 mutation，确认 validator 真能拒绝：
   - 把一条 F4 的 DR2 改成 `EXECUTABLE`；
   - 从 P0 标记块删除一个 ID；
   - 从 solution 移除一个 result 使用的 issue code 标题/模板；
   - 只篡改一条生成结果的 DR1 或 issue code。

## 分级

- A：改变主要结论、漏高风险 ID、F3/F4/S3 越界、600 行错配、solution 未覆盖实际失败簇、validator 可被上述反例绕过，或虚构真实执行。
- B：不影响安全和主要统计，但会降低后续实际运行效率或可读性。
- C：增强建议。

按本轮适度尺度，只有 A 阻断；不要为了清零 B/C 建议无限返工。

最终报告必须包含：`[pass]` 或 `[fail]`、A/B/C 数量、逐项真实证据、门禁退出码、mutation 结果、明确的交付建议。不要写文件，只把最终报告返回给调用方。
