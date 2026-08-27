# simulations 第一轮返工定向 readback：覆盖与自然度

- 复核日期：2026-08-26
- 复核范围：原报告 B-01、B-02、B-03、C-02，以及指定追加项 `SIM-SAL-02`、`SIM-MKT-04`；另做数量与自然度防回归
- 判定尺度：模拟使用数据；只有破坏用途的结构性错误进入 A 级并阻塞，B/C 为非阻塞改进项
- 基线：`review/01-coverage-naturalness.md` 与 `prompts/181-customer-simulation-data-a-repair.md`
- 当前输入：`simulation-spec.mjs`、12 个生成 session、对应 fixture、`validate-simulations.mjs`、`test-simulation-mutations.mjs`

## 1. 结论

[pass] 定向 readback 通过。A=0；原 B-01、B-02、B-03 和 C-02 指定问题均已真实修复，未发现数量、领域频率或自然度回归。

本结论没有因为常量、字段或断言存在就直接判通过：每项同时对照当前 spec、渲染后的 session 与 fixture；另用不调用 `buildSpecs()` 的只读解析核对渲染文件。validator 与 mutation 自测均真实执行并退出 0。

## 2. 原 B-01：六条时序泄漏

[pass] B-01 已关闭。六组 USER 值都不再提前进入首轮绑定的静态 fixture，并仍在正确的后续 USER 轮出现。spec 也登记了相应回归禁值（`simulation-spec.mjs:149-157`）。

| 会话 | 当前生成物证据 | 判定 |
|---|---|---|
| `SIM-WRT-01` | 回放前仍说明草稿未提供，40% 只随第 2 轮粘贴正文到达（`sessions/03-writing-content.md:19,32-37`）；`author-rag` 仅含确认论点数、风格和归属标记（`fixtures/03-writing-content.md:15-20`） | [pass] |
| `SIM-RES-05` | 第 1 轮把版本与种子标为 unknown，第 2 轮 USER 才给 `libx 1.4.2` 与 seed 17（`sessions/04-research-decision.md:328-340`）；fixture 使用 `unknown-until-user-log`（`fixtures/04-research-decision.md:100-107`） | [pass] |
| `SIM-OPS-05` | 人员代号只在第 2 轮出现（`sessions/05-business-operations.md:320,333-338`）；`trip-options` 只有两档 LIVE 候选及价格，没有 A-01/A-02/A-03（`fixtures/05-business-operations.md:121-139`） | [pass] |
| `SIM-SAL-05` | 红线只在第 2 轮 USER 口述（`sessions/06-sales-customer-procurement.md:322,335-340`）；`clause-rag` 只有模板区块、字段名与 `legalConclusion=false`（`fixtures/06-sales-customer-procurement.md:93-107`） | [pass] |
| `SIM-MKT-01` | 第 2 轮 USER 才给 n=220（`sessions/07-marketing-growth.md:32-37`）；基线只保留 `previousN: unknown-until-user`（`fixtures/07-marketing-growth.md:15-20`） | [pass] |
| `SIM-CAR-03` | 每周十小时只在第 2 轮 brief 出现（`sessions/11-career-freelance.md:182-187`）；市场 fixture 只有带日期、地域、币种和区间的 LIVE 数据（`fixtures/11-career-freelance.md:52-60`） | [pass] |

`SIM-OPS-05` 的含税 18,600 仍存在于首轮 LIVE 候选中是合理差异，不是残余泄漏。该数值是用户首轮所求方案的可见报价，后续 USER 动作是从候选中确认一档；原报告修复方向本就要求 fixture 保留“候选和价格”、只把人员及确认状态留给 USER（`review/01-coverage-naturalness.md:118`），返工要求也只禁止人员代号提前进入 LIVE（`prompts/181-customer-simulation-data-a-repair.md:38`）。

## 3. 原 B-02：状态扰动

[pass] B-02 已关闭，且指定追加的两条也通过。六条变体均从当前真实基线切换到不同状态，恢复语义继续 fail-closed；spec 的状态对账表见 `simulation-spec.mjs:160-166`。

| 会话 | 当前基线 | 失败注入 | 恢复闭合 | 证据 |
|---|---|---|---|---|
| `SIM-RES-01` | `market-refresh=ok` | `empty` | 现势字段保持未知，不用冻结快照冒充当前 | `fixtures/04-research-decision.md:27-40`；`sessions/04-research-decision.md:67-71` |
| `SIM-MKT-06` | `community-probe=empty` | `permission_denied` | 不绕过、不编造成员 | `fixtures/07-marketing-growth.md:108-120`；`sessions/07-marketing-growth.md:444-448` |
| `SIM-DAT-03` | `weekly-metrics=stale` | `empty` | 停止发送，不编造周报数字 | `fixtures/08-data-finance.md:39-51`；`sessions/08-data-finance.md:216-220` |
| `SIM-DAT-04` | `cohort-run=partial` | `permission_denied` | 报告无法执行，不补造转化率 | `fixtures/08-data-finance.md:73-87`；`sessions/08-data-finance.md:293-297` |
| `SIM-SAL-02` | `workshop-tasks=stale` | `empty` | 只用 USER 新约束，系统日期保持未知 | `fixtures/06-sales-customer-procurement.md:17-30`；`sessions/06-sales-customer-procurement.md:142-146` |
| `SIM-MKT-04` | `partner-crm=stale` | `permission_denied` | 禁用旧名单，标明当前名单不可读 | `fixtures/07-marketing-growth.md:81-93`；`sessions/07-marketing-growth.md:293-297` |

## 4. 原 B-03：`SIM-OPS-05` 结果摘要

[pass] B-03 已关闭。第 3 轮确认含税 18,600 档且明确不下单（`sessions/05-business-operations.md:340-345`）；首个可审阅结果已同步为“人员和含税 18,600 档已确认，预订未授权、未下单”（同文件 `:347-349`）。oracle 继续禁止下单、付款、发送预订与伪造外部执行（同文件 `:351-362`），没有以修正文案为由打开 effect。

## 5. 原 C-02：三处文字

[pass] C-02 已关闭。旧截断文字均不再出现，当前生成物分别为：

- `SIM-RES-02`：“权限与幂等仍弱”（`sessions/04-research-decision.md:122-124`）；
- `SIM-RES-03`：“不作法律结论”（同文件 `:201-207`）；
- `SIM-RES-04`：“不代用户做价值拍板”（同文件 `:273-275`）。

## 6. 覆盖与自然度防回归

[pass] 数量与频率未回归。独立解析当前 12 个 session 文件得到 72 个会话、每文件 6 个、H/M/L=32/25/15；生成覆盖表同样记录 72/12/6 与 32/25/15（`02-coverage.md:7-10,20-33`）。

[pass] 多轮形状和动作分布未回归。当前仍有 217 个用户轮、145 个后续轮，71 个会话为 3 轮、1 个会话为 4 轮；后续动作仍为 `confirm=38`、`supplement=35`、`correct=27`、`constraint_change=22`、`reject=15`、`resume=8`，与原报告基线（`review/01-coverage-naturalness.md:78-85`）一致。

[pass] 重复与模板化风险未回归。145 条后续 USER 文本精确重复组为 0；10,440 对中文字符 trigram Jaccard 中，达到 0.4 的仍为 0 对，最高为 0.208。最高相似对只是两个不同生活/运营场景里自然复用“那档，但还是不要……”的确认加拒绝句式，不构成同构复制。

[pass] 长度分布没有自然度退化。按原报告数值对应的原始字符串长度口径，当前最短 8、第一四分位 16、中位数 20、第三四分位 26、最长 99、均值 22.7。中位数与主体分布保持稳定；最长值和均值上升来自 `SIM-WRT-01`、`SIM-WRT-04` 按返工要求补入两段实际可加工的合成 USER 正文（`sessions/03-writing-content.md:35,263`），是自然的粘贴材料，不是把普通追问扩成验收合同口吻。

## 7. A/B/C 判定与非目标项

### A 级

[pass] A-0：未发现破坏用途的数量/映射错误、虚假多轮、安全越界或本轮返工引入的明显场景失真。A=0，不阻塞。

### B 级

[pass] 原 B-01、B-02、B-03 均已关闭；本轮没有新增 B 级发现。即使未来出现 B 级增强建议，按本轮尺度也不阻塞。

### C 级

[pass] 原 C-02 已关闭。原 C-01 的 71 个三轮会话按用户裁决不在本轮扩写；当前结构与动作分布未恶化。validator 仍保留 28 条“payload 仍可更丰富”警告，少于原报告的 32 条，但本轮不要求机械清零；这些 warn 不计 A，也不阻塞。

## 8. 门禁证据

### validator

命令：

```bash
node research/customer-question-corpus/simulations/validate-simulations.mjs
```

结果：退出码 0；摘要为 `sessions=72 domains=12 H/M/L=32/25/15`、`tree_sha256=9c46c80089f3d5b7adc27f49f1140f70aff39ef811d1f6334e84aa53f0bce4f1`、`A=0 warn=28`、`[ok] A-level checks passed`。

### mutation

命令：

```bash
node research/customer-question-corpus/simulations/test-simulation-mutations.mjs
```

结果：退出码 0；删除后续轮与 oracle、伪造 S3/F4 已执行、删除必需 payload 路径三种变异分别被拒绝为 A=3、A=1、A=1；正式生成树前后 SHA-256 均为 `9c46c80089f3d5b7adc27f49f1140f70aff39ef811d1f6334e84aa53f0bce4f1`。

### 逐文件 emoji

命令按 `find research/customer-question-corpus/simulations -type f -print0` 的结果逐个调用 `bash scripts/check-emoji.sh "$file"`，没有把整批路径当成一次调用。

结果：检查 36 个文件，每个文件均输出 `[ok] emoji gate: clean`，汇总退出码 0。

## 9. 最终判定

[pass] 第一轮返工在本次定向范围内真实收口。没有 A 级阻塞项；原指定 B/C 问题已修，72/12/32-25-15 与多轮自然度未回归。71 个三轮结构和 28 条短 payload warning 按用户裁决继续作为非阻塞现状保留。
