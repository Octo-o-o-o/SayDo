# SayDo 600 条潜在客户提问语料最终独立对抗评审 v4

最终裁决：`[fail]`

发现 3 项 A、3 组 B。validator 虽以退出码 0 通过，但存在 RAG 假闭合、能力风险歧义、明显频率逆序、D/H 与工具标签错误，不能作为最终通过依据。

本会话保持只读：未读取禁止路径，未运行任何 Git 命令，未修改语料、未执行 `rebuild.mjs`、未 commit。

## 1. 方法与范围

已完成：

- 逐条读取 12 个问题文件，共 600 条。
- 读取 16 个 manifest 和全部 50 个 source 正文。
- 对 172 条 CTX 引用及其 172 条 required claim 逐项核对来源、补充输入、日期和权威顺序。
- 读取 `validate.mjs`、`rebuild.mjs`，并核对必要 canonical 与实际风险代码。
- 真实运行 validator。
- 使用独立解析器重算全部计数、自然度和 179,700 个问题对。
- 人工复核独立 top-30 问题候选、目的相似候选及跨措辞语义。

隔离门未失效。

## 2. 全量计数

### 2.1 领域与 H/M/L

| 领域 | 总数 | H | M | L |
|---|---:|---:|---:|---:|
| ENG | 120 | 54 | 42 | 24 |
| PRJ | 70 | 31 | 25 | 14 |
| WRT | 70 | 32 | 24 | 14 |
| RES | 60 | 27 | 21 | 12 |
| OPS | 55 | 25 | 19 | 11 |
| SAL | 45 | 20 | 16 | 9 |
| MKT | 45 | 20 | 16 | 9 |
| DAT | 35 | 16 | 12 | 7 |
| LRN | 30 | 13 | 11 | 6 |
| LIF | 30 | 13 | 11 | 6 |
| CAR | 20 | 9 | 7 | 4 |
| FAM | 20 | 10 | 6 | 4 |
| 合计 | 600 | 270 | 210 | 120 |

与设计配额 [01-设计与分布.md:80](~/WorkSpace/SayDo/research/customer-question-corpus/01-设计与分布.md:80) 完全一致。

### 2.2 标签分布

| 维度 | 全量计数 |
|---|---|
| C | C1 28；C2 242；C3 241；C4 65；C5 24 |
| D | D0 258；D1 277；D2 27；D3 3；D4 35 |
| H | H0 479；H1 23；H2 26；H3 34；H4 38 |
| R | R1 23；R2 432；R3 97；R4 48 |
| K | K0 32；K1 117；K2 346；K3 98；K4 7 |
| S | S0 195；S1 187；S2 187；S3 31 |
| F | F1 49；F2 483；F3 57；F4 11 |
| B | B0 395；AUTH 117；PRIV 36；LEG 15；FIN 14；MED 13；ID 6；ATTR 4 |

共覆盖 36 个工具族。`LIVE` 出现 483 次、`USER` 145 次、自包含 `-` 13 次；这些是可重叠 token 数，不是互斥记录数。

角色与目的方面，独立统计得到 599 个不同角色情境、600 个不同问题、600 个不同目的。LIF+FAM 共 50 条，占 8.3%，未命中娱乐主题；与 [02-覆盖索引.md:64](~/WorkSpace/SayDo/research/customer-question-corpus/02-覆盖索引.md:64) 的生活生产力口径一致。

## 3. A 级发现

### A-1：SAL-014 把“三年 TCO”错误升级成“三年合同”，RAG 假闭合

[SAL-014:55](~/WorkSpace/SayDo/research/customer-question-corpus/questions/06-sales-customer-procurement.md:55) 明确预设：

> 面对这份三年采购合同……

其 required claim 又把“三年合同约束”写成冻结背景：[CTX-16 manifest:33](~/WorkSpace/SayDo/research/customer-question-corpus/contexts/CTX-16/manifest.md:33)。

但三个登记来源只能证明：

- “三年总拥有成本透明”： [rfp-summary.md:7](~/WorkSpace/SayDo/research/customer-question-corpus/contexts/CTX-16/rfp-summary.md:7)
- 评分维度含“三年总成本”： [evaluation-rules.md:8](~/WorkSpace/SayDo/research/customer-question-corpus/contexts/CTX-16/evaluation-rules.md:8)
- 厂商能力和价格自报，不含合同期限： [vendor-responses.md:3](~/WorkSpace/SayDo/research/customer-question-corpus/contexts/CTX-16/vendor-responses.md:3)

`LIVE` supplemental 也只要求刷新价格和补齐三年 TCO，不要求提供合同正文：[rebuild.mjs:737](~/WorkSpace/SayDo/research/customer-question-corpus/rebuild.mjs:737)。

独立逐词核对结果为：

```text
CTX-16/SAL-014 term=三年合同 sourceContains=false
CTX-16/SAL-014 term=合同约束 sourceContains=false
```

根因是构建器会把未覆盖条目的 `purpose` 自动拼入 required claim：[rebuild.mjs:1520](~/WorkSpace/SayDo/research/customer-question-corpus/rebuild.mjs:1520)。digest 只证明这些错误文本没有被篡改，不能证明来源蕴含。

结论：数量与摘要合同完整，但事实输入不足，属于必须修复的 RAG 假闭合。

### A-2：OPS-048 无法判定是计划草稿还是 live 预约/通知，现有 S2/F2 不安全

[OPS-048:56](~/WorkSpace/SayDo/research/customer-question-corpus/questions/05-business-operations.md:56) 要求“协调预约、材料和随访提醒”，登记 `calendar,notification,rag`、`LIVE`、`S2 F2/B-MED`。

题面没有说明：

- 只产预约方案和提醒草稿；
- 还是实际写日历、联系机构、发送随访提醒。

能力边界明确规定，connector、登录态和授权不能把预约、自动通知等直接 effect 自动升级为 F2；当前直接签发与消费链未覆盖这些动作：[00-能力边界.md:34](~/WorkSpace/SayDo/research/customer-question-corpus/00-能力边界.md:34)。实际策略引擎也把 `send_external` 归为 S3：[engine.ts:39](~/WorkSpace/SayDo/packages/daemon/src/policy/engine.ts:39)。

因此当前题面不能支撑唯一的 S/F 判定：

- 若是草稿/计划，必须在题面写清；
- 若是 live 预约或通知，应进入 S3/F3。

这种二义性可能直接造成能力误导和风险低标，判 A。

### A-3：PRJ-019 存在明显领域内频率逆序

[PRJ-019:130](~/WorkSpace/SayDo/research/customer-question-corpus/questions/02-product-project.md:130) 是交付经理面对客户临时加需求、对照合同起草 change request 的常规场景，却标为 L。

在同一领域中，以下更窄、触发更少的场景反而标为 M：

- 季度客户顾问委员会：[PRJ-046:109](~/WorkSpace/SayDo/research/customer-question-corpus/questions/02-product-project.md:109)
- 三国发布策略：[PRJ-048:113](~/WorkSpace/SayDo/research/customer-question-corpus/questions/02-product-project.md:113)
- 年度战略深度访谈：[PRJ-057:121](~/WorkSpace/SayDo/research/customer-question-corpus/questions/02-product-project.md:121)

按语料自己的定义，L 应依赖罕见事件或特殊前提，而范围变更在合格交付经理人群中会反复出现：[03-频率与语义校准.md:7](~/WorkSpace/SayDo/research/customer-question-corpus/03-频率与语义校准.md:7)。

这是启发式先验内部的显著逆序，不是声称真实市场概率，仍应判 A。

## 4. B 级发现

### B-1：四条 D/H 与题面现实跨度不符

分档合同规定：实际执行 2–6 周后才出现结果为 D3；要求持续跟踪、重排或提醒为 D4/H4：[01-设计与分布.md:35](~/WorkSpace/SayDo/research/customer-question-corpus/01-设计与分布.md:35)。

- [ENG-097:224](~/WorkSpace/SayDo/research/customer-question-corpus/questions/01-software-it.md:224)：明确“先用两周摸清……再决定”，却标 D1；应按首个所求决策结果复核为 D3。
- [MKT-044:104](~/WorkSpace/SayDo/research/customer-question-corpus/questions/07-marketing-growth.md:104)：要求用一年执行内容、社区、研究与销售反馈，并按季度校准，当前 D1/H3；这是持续动作，应为 D4/H4。
- [LIF-028:72](~/WorkSpace/SayDo/research/customer-question-corpus/questions/10-personal-life-admin.md:72)：明确“用一年跟踪”，当前 D1/H3；应为 D4/H4。
- [FAM-017:41](~/WorkSpace/SayDo/research/customer-question-corpus/questions/12-household-family-community.md:41)：同样要求一年持续跟踪，当前 D1/H3；应为 D4/H4。

### B-2：三条必需工具族不闭合

- [LIF-019:49](~/WorkSpace/SayDo/research/customer-question-corpus/questions/10-personal-life-admin.md:49)：每周汇总血压、症状和生活记录，却只有 `automation`。没有能够读取或承载当前记录的工具族；冻结 CTX 不能替代 `LIVE` 的当前数据。
- [LIF-028:72](~/WorkSpace/SayDo/research/customer-question-corpus/questions/10-personal-life-admin.md:72)：一年期建房跟踪登记 `test,spreadsheet,finance`。`test` 未由题面明确支撑，同时缺少持续进度、日程、文档或自动化工具。
- [WRT-069:154](~/WorkSpace/SayDo/research/customer-question-corpus/questions/03-writing-content.md:154)：持续更新教材并保留旧版和变更理由，却只有 `rag`；至少缺少正文写入和版本留存能力。

这违反“工具列只登记完成题目确需的唯一工具族”以及 LIVE 必须有现势读取工具的规则：[03-频率与语义校准.md:53](~/WorkSpace/SayDo/research/customer-question-corpus/03-频率与语义校准.md:53)。

### B-3：validator 的 LIVE 读取工具检查实际为空门

`allowedTools` 包含全部 36 个工具族，而 `liveTools` 又原样包含全部工具族：[validate.mjs:26](~/WorkSpace/SayDo/research/customer-question-corpus/validate.mjs:26)、[validate.mjs:39](~/WorkSpace/SayDo/research/customer-question-corpus/validate.mjs:39)。

随后 LIVE 校验只检查是否有任意一个 `liveTools` 成员：[validate.mjs:429](~/WorkSpace/SayDo/research/customer-question-corpus/validate.mjs:429)。因此任何非空工具列都会通过，包括只有输出、编排或生成用途的工具。

LIF-019 的 `automation`-only 即为被漏过的真实反例。validator 输出中的“含 LIVE 却有实时读取工具”不能视为已证明。

## 5. RAG、输入与现势结论

独立统计结果：

```json
{
  "ctxRefs": 172,
  "totalClaims": 172,
  "totalSources": 50,
  "digestMismatches": [],
  "suppMismatches": [],
  "missingSources": [],
  "expired": []
}
```

- 172 个 CTX 引用与 172 条 claim 一一对应。
- 50 个 source 均存在，source/claim digest 均匹配。
- USER/LIVE supplemental token 无缺报或多报。
- 13 个日期型 `valid_until` 在 2026-08-26 均未过期；CTX-01、02、04 分别使用已登记的 `fixture-frozen` 或 `immutable_event_window` sentinel。
- 16 个 manifest 均给出权威或来源优先顺序。
- 除 SAL-014 外，逐项阅读未发现另一项达到 A/B 的来源语义不蕴含。

因此结构闭合总体成立，但 SAL-014 足以使 RAG 最终结论失败。

## 6. 去重结论

独立重新实现字符 bigram multiset Dice，实际遍历：

```text
records=600
pairCount=179700
ge055=0
```

独立 top-10 与 validator 完全一致：

| 排名 | 问题对 | Dice |
|---:|---|---:|
| 1 | SAL-002 / SAL-012 | 0.324324 |
| 2 | ENG-109 / WRT-042 | 0.294118 |
| 3 | ENG-117 / RES-060 | 0.280702 |
| 4 | PRJ-016 / SAL-009 | 0.272727 |
| 5 | ENG-045 / LRN-016 | 0.260870 |
| 6 | PRJ-020 / WRT-019 | 0.254545 |
| 7 | ENG-014 / WRT-006 | 0.245614 |
| 8 | WRT-055 / RES-014 | 0.244898 |
| 9 | SAL-027 / MKT-020 | 0.241379 |
| 10 | ENG-054 / DAT-016 | 0.237288 |

人工复核 top-30 问题候选和目的相似候选后，未发现应合并的跨措辞重复。最高对 SAL-002/SAL-012 分别包含首次发送授权与客户改口后的续接草稿，输入、生命周期和外部 effect 均不同。

去重项判通过。

## 7. 自然度结论

| 档位 | 条数 | 句末问号 | 句末问句率 | 含任意问号 | 平均长度 | 中位数 | P90 |
|---|---:|---:|---:|---:|---:|---:|---:|
| H | 270 | 84 | 31.1% | 127 | 34.19 | 33 | 41 |
| M | 210 | 51 | 24.3% | 68 | 35.94 | 35 | 43 |
| L | 120 | 23 | 19.2% | 33 | 36.15 | 35 | 43 |

“把”字开头为 H/M/L=28/27/15，共 70 条。最常见二字开头为“这个”22、“我们”12、“客户”11、“根据”11，未形成单一压倒性模板。

人工逐题审查认为：

- 专业场景中的清单式约束多数仍可作为真实客户表达，不应仅因没有问号判不自然。
- SAL-014 把不存在的“三年合同”说进客户嘴里，是唯一达到 A/B 的明确 fixture/required-claim 泄漏，已计入 A-1。
- 未发现另一组系统性的验收规范或合同字段机械复述问题。

## 8. 构建器与 validator 诚实边界

静态审查确认：

- 构建前断言 600 条、连续 ID 和领域配额：[rebuild.mjs:1463](~/WorkSpace/SayDo/research/customer-question-corpus/rebuild.mjs:1463)。
- 先生成 staging、更新合同并运行 staging validator：[rebuild.mjs:1610](~/WorkSpace/SayDo/research/customer-question-corpus/rebuild.mjs:1610)。
- 可捕获 rename 失败有回滚和备份保留路径：[rebuild.mjs:1591](~/WorkSpace/SayDo/research/customer-question-corpus/rebuild.mjs:1591)。
- validator 全量遍历 pair 并截取 top-10：[validate.mjs:525](~/WorkSpace/SayDo/research/customer-question-corpus/validate.mjs:525)。
- README 如实说明不保证进程强杀/断电原子性，也明确 digest 与 validator 不证明 claim 语义：[README.md:46](~/WorkSpace/SayDo/research/customer-question-corpus/README.md:46)。

但有两项实际缺口：

1. generic required-claim fallback 会把目的文本拼成“冻结背景”，是 SAL-014 假闭合的构建器根因。
2. LIVE 读取检查是空门，见 B-3。

## 9. 命令证据

validator 原始关键输出：

```text
{
  "records": 600,
  "demandPrior": {
    "H": 270,
    "M": 210,
    "L": 120
  },
  ...
  "nearDuplicatePairsAt055": 0,
  "topNearDuplicatePairs": [
    {
      "score": 0.324324,
      "left": "SAL-002",
      "right": "SAL-012"
    },
    ...
  ]
}

[ok] 600 条语料结构、登记合同完整性与已知语义反例门通过

VALIDATOR_EXIT_CODE=0
TOOL_EXIT_CODE=0
```

脚本语法检查：

```text
NODE_CHECK_VALIDATE=0
NODE_CHECK_REBUILD=0
EXIT=0
```

首次独立统计尝试因只读沙箱不允许 heredoc 临时文件而失败：

```text
zsh:1: can't create temp file for here document: operation not permitted
EXIT=1
```

随后改用不落盘的 `node -e` 完成全部统计，退出码 0。

## 10. 已验证与未验证边界

已验证：

- 数量、领域配额、连续 ID、H/M/L 和全部标签计数。
- 600 条问题文本及全部工具、输入、风险、能力标签的语义审查。
- 16 个 manifest、50 个 source、172 条 required claim。
- source/claim digest、supplemental input、as_of、valid_until、authority order。
- 179,700 对字符近似及 validator top-10。
- 当前 S3、effect whitelist 和类型门相关能力边界。

未验证：

- 未运行 `rebuild.mjs`，因此未动态执行 staged promotion 和故障注入；这是为遵守“不修改正式语料”。
- 未验证进程崩溃或断电原子性；文档也没有声称保证。
- 未实际执行 600 个场景、connector 登录、外部发送或 S3 真人认证。
- H/M/L 没有市场访谈或遥测依据；本报告只裁决其内部启发式相对顺序。

## 11. 最终裁决

`[fail]`

validator 的退出码 0 只能证明其实现覆盖的结构合同和已登记反例通过。当前仍有 3 项 A 和 3 组 B，特别是 SAL-014 的 RAG 假闭合与 OPS-048 的 effect/能力二义性，不能判为最终验收通过。