# 任务：关闭模拟会话 validator 的生成物虚绿

仓库：`~/WorkSpace/SayDo`

这是同一 A-02 在第一次返工 readback 中仍红，必须用全新的实现会话做最小修复。不要继承或辩护旧实现，不要扩大到语料内容、connector schema、轮数或构建原子性。

先读取：

- `research/codex-findings/182-customer-simulation-data-repair-readback.md`
- `prompts/181-customer-simulation-data-a-repair.md`
- `research/customer-question-corpus/simulations/simulation-spec.mjs`
- `research/customer-question-corpus/simulations/validate-simulations.mjs`
- `research/customer-question-corpus/simulations/test-simulation-mutations.mjs`
- `research/customer-question-corpus/simulations/rebuild-simulations.mjs`
- `research/customer-question-corpus/simulations/README.md`
- `research/customer-question-corpus/simulations/00-simulation-plan.md`

## 唯一 A 级目标

当前 validator 会检查 spec 的必需字段，但当 spec 保持正确、只篡改已生成的 Markdown 时，仍会接受：

1. 从生成 fixture 删除必需 payload 字段；
2. 把生成 S3/F4 会话写成“已经部署/已有授权”；
3. 把另一个 SIM 的用户轮文本塞进当前会话。

必须让这三种情况退出非零。

## 实现边界

1. 使用 `renderGenerated(specs)` 形成期望生成物，并对当前 12 个 session 文件、12 个 fixture 文件及 `02-coverage.md` 做逐文件完整字节对账。任一文件有任何内容漂移都进入 A errors；错误信息只报相对文件和类别，不倾倒全文。
2. 保留现有按 SIM 解析、最小字段、时序泄漏、失败 delta、S3/F4 通用禁令检查；完整字节对账是新增的独立防线，不删除已有检查。
3. 更新 `test-simulation-mutations.mjs`：除现有 spec 变异外，至少新增三类“spec 不变、只修改 `renderGenerated()` 返回的内存 Markdown”变异，分别覆盖上面三条。每条必须被 `collectIssues` 拒绝，并核对正式树前后摘要不变。
4. 不在测试中写正式树，不使用网络或第三方包。
5. 在 `README.md` 的导航与命令块加入 `test-simulation-mutations.mjs`；在 `00-simulation-plan.md` 的门禁命令加入该测试。不要改其他说明。
6. 禁止修改：72 个 RAW spec 的会话内容、`sessions/`、`fixtures/`、`02-coverage.md`、现有 review 报告、主 600 条、contexts、contracts、主构建器。若验证需要重建，只能让输出保持字节不变。
7. 不 commit、不 push。

## 验收

```bash
node --check research/customer-question-corpus/simulations/validate-simulations.mjs
node --check research/customer-question-corpus/simulations/test-simulation-mutations.mjs
node research/customer-question-corpus/simulations/validate-simulations.mjs
node research/customer-question-corpus/simulations/test-simulation-mutations.mjs
find research/customer-question-corpus/simulations -type f -print0 \
  | xargs -0 bash scripts/check-emoji.sh
node research/customer-question-corpus/validate.mjs
```

必须保持：

- 72 会话、12 域、H/M/L 32/25/15；
- tree SHA-256 `9c46c80089f3d5b7adc27f49f1140f70aff39ef811d1f6334e84aa53f0bce4f1`；
- 28 条非阻塞 warning 可原样保留；
- 三类生成物变异均明确输出 `[ok] ... rejected`；
- 主语料 600 条不变。

结束时只报告真实改动文件、真实命令退出码和输出摘要。
