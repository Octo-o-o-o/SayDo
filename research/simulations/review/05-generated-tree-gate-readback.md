# 模拟生成物字节门定向 readback

- 评审日期：2026-08-26
- 范围：只复核 prompt 183 的生成物完整字节对账，不重新评审 72 条会话内容
- 结论：`[pass]`
- 分级：A `[fail]` 0 条，B `[fail]` 0 条，C `[fail]` 0 条

## 1. 结论

`[pass]`。`research/codex-findings/182-customer-simulation-data-repair-readback.md:19-37` 所列唯一 A 已关闭：当 spec 保持不变、只篡改 `renderGenerated()` 返回的内存 Markdown 时，删除 fixture 必需字段、伪造 S3 执行、把另一 SIM 的用户轮塞入当前会话三类变异现在均被 validator 拒绝。

当前正式生成树在独立试验和正式 mutation 自测前后均保持 SHA-256：

```text
9c46c80089f3d5b7adc27f49f1140f70aff39ef811d1f6334e84aa53f0bce4f1
```

未发现 prompt 183 范围内的新 A。

## 2. 代码对账

### A-01 `[pass]` Validator 对 25 个生成文件做完整字节比较

- `validate-simulations.mjs:20` 从唯一生成源导入 `renderGenerated`。
- `validate-simulations.mjs:313-324` 使用同一份 `specs` 生成期望结果，然后对 12 个 session 文件、12 个 fixture 文件及 `02-coverage.md` 逐文件使用严格不等比较；任何单字节漂移均加入 A errors。
- 错误只包含相对文件和“生成物字节漂移”类别，不输出正文，符合 prompt 183 的错误输出边界。
- 原有逐 SIM 解析、字段、时序、失败差分和 S3/F4 检查仍保留在 `validate-simulations.mjs:55-311`，字节门是独立追加防线。

判定：182 中“spec 正确而生成 Markdown 单独漂移仍虚绿”的根因已被完整文件等值比较覆盖。

### A-02 `[pass]` 三类测试确实保持 spec 不变，只改内存 Markdown

`test-simulation-mutations.mjs:32-42` 的 `expectGeneratedRejected()` 先 clone 当前 spec，再调用 `renderGenerated(specs)`；mutation callback 只接收 `generated` 和名称，不接收 spec。三条新用例位于 `test-simulation-mutations.mjs:62-89`：

1. `rendered-required-field-deleted` 只删除内存 fixture 中护照的 `expiresOn`；
2. `rendered-s3-fake-execution` 只把内存 session 的安全结果改成已部署、已有授权；
3. `rendered-turn-content-wrong-sim` 只把另一 SIM 的关账用户轮写进 WRT 会话。

为避免仅相信测试脚本自身输出，本轮另行构造等价只读内存试验；每条分别计算 spec 前后 JSON SHA、变化文件集合和 `collectIssues()` 结果：

```text
rendered-required-field-deleted spec_unchanged=true changed_files=fixtures/10-personal-life-admin.md rejected=true A=1
  error=fixtures/10-personal-life-admin.md 生成物字节漂移
rendered-s3-fake-execution spec_unchanged=true changed_files=sessions/01-software-it.md rejected=true A=1
  error=sessions/01-software-it.md 生成物字节漂移
rendered-turn-content-wrong-sim spec_unchanged=true changed_files=sessions/03-writing-content.md rejected=true A=1
  error=sessions/03-writing-content.md 生成物字节漂移
official_tree_before=9c46c80089f3d5b7adc27f49f1140f70aff39ef811d1f6334e84aa53f0bce4f1
official_tree_after=9c46c80089f3d5b7adc27f49f1140f70aff39ef811d1f6334e84aa53f0bce4f1
official_tree_unchanged=true
independent_exit_code=0
```

三条用例均只改变一个预期 Markdown 文件，spec 摘要前后相同，并各产生一条 A。正式磁盘树未被测试修改。

### A-03 `[pass]` 正式 mutation 自测覆盖生成物变异并保护正式树

- `test-simulation-mutations.mjs:44` 在全部变异前读取正式树摘要；`test-simulation-mutations.mjs:91-97` 在全部变异后再次读取并要求相等。
- 原有三类 spec 变异仍保留在 `test-simulation-mutations.mjs:46-60`；三类生成 Markdown 变异是新增覆盖，没有替换旧门禁。
- 正式运行结果中三条生成物变异分别明确输出 `[ok] ... rejected A=1`，正式树摘要保持指定值，见第 4 节。

### A-04 `[pass]` README 与 plan 已登记 mutation 命令

- `README.md:19` 在导航中说明 `test-simulation-mutations.mjs` 同时覆盖 spec 与生成 Markdown 变异；`README.md:31-37` 的命令块包含该命令。
- `00-simulation-plan.md:95-104` 的门禁命令包含该 mutation 测试。

判定：prompt 183 对导航与门禁登记的要求已落实。

## 3. A 级收口

| 验收项 | 结果 |
|---|---|
| 删除生成 fixture 必需字段必须被拒绝 | `[pass]` |
| 生成 S3/F4 会话伪造执行或授权必须被拒绝 | `[pass]` |
| 跨 SIM 用户轮内容漂移必须被拒绝 | `[pass]` |
| 三类生成物变异期间 spec 保持不变 | `[pass]` |
| 正式树前后摘要保持 `9c46...e4f1` | `[pass]` |
| README/plan 登记 mutation 命令 | `[pass]` |

结论：唯一 A 已关闭，整体 `[pass]`。

## 4. 最终命令记录

报告主体落盘后运行 prompt 183 的全部验收命令。28 条 warning 均为非阻塞的“payload 仍可更丰富”，本轮未把它们写成已修。

```text
$ node --check research/customer-question-corpus/simulations/validate-simulations.mjs
check_validator_exit_code=0

$ node --check research/customer-question-corpus/simulations/test-simulation-mutations.mjs
check_mutation_exit_code=0
```

```text
$ node research/customer-question-corpus/simulations/validate-simulations.mjs
sessions=72 domains=12 H/M/L=32/25/15
CTX=35 USER=28 LIVE=51 dash=2 S3orF4=17 LIF/FAM=12
tree_sha256=9c46c80089f3d5b7adc27f49f1140f70aff39ef811d1f6334e84aa53f0bce4f1
A=0 warn=28
[ok] A-level checks passed
validator_exit_code=0
```

```text
$ node research/customer-question-corpus/simulations/test-simulation-mutations.mjs
[ok] mutation delete-later-turns-and-oracle rejected A=3
[ok] mutation s3f4-already-executed rejected A=1
[ok] mutation delete-required-payload-path rejected A=1
[ok] mutation rendered-required-field-deleted rejected A=1
[ok] mutation rendered-s3-fake-execution rejected A=1
[ok] mutation rendered-turn-content-wrong-sim rejected A=1
[ok] official tree unchanged sha256 9c46c80089f3d5b7adc27f49f1140f70aff39ef811d1f6334e84aa53f0bce4f1
[ok] mutation self-test passed
mutation_exit_code=0
```

```text
$ find research/customer-question-corpus/simulations -type f -print0 | xargs -0 bash scripts/check-emoji.sh
[ok] emoji gate: clean
emoji_exit_code=0
```

```text
$ node research/customer-question-corpus/validate.mjs
"records": 600
"questionFiles": 12
[ok] 600 条语料结构、登记合同完整性与已知语义反例门通过
corpus_validator_exit_code=0
```

最终回复另给出报告最终版本再次运行门禁后的退出码、行数和 SHA-256。
