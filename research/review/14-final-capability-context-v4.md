# SayDo 600 条潜在客户生产力提问语料最终终审

- 评审轮次：final capability/context v4
- 评审日期：2026-08-26，Asia/Shanghai
- 评审范围：能力边界、工具与输入、风险与 effect、RAG 事实闭合
- 评审身份：全新零上下文终审，只读评估，不实施
- 最终裁决：`[fail]`

## 1. 结论

全量语料的结构、登记合同、source digest 与已知规则门均通过，但语义终审发现 2 个 A 级和 3 组 B 级问题，因此不能给出 `[pass]`。

最重问题是：

1. `MKT-033` 明确要求写入 live 渠道配置，变更会控制后续邮件、应用内消息和推送，却标成 `S2/F2`；
2. `OPS-048` 的“协调预约和随访提醒”没有唯一限定为草案，按自然语义可直接创建预约或发送通知，却同样标成 `S2/F2`。

两题都与本语料自己的能力边界冲突：connector、登录态和普通批准不能替代 S3 effect 的判别、签发、单次消费和反例门。当前代码中的直接 EffectGrant 白名单只有依赖安装和分支推送；当前 S3 挑战签发与消费只覆盖注册和合并。

另有三组重要缺口：`WRT-059` 的长期多语言传播与专家签核没有工具和 effect 语义闭合；`LRN-002/LRN-003` 只有错题主题摘要，没有原题、用户作答和正确答案；`LIF-022` 缺实时交通、住宿可用性工具及必要行程输入。

## 2. 方法与隔离

### 2.1 实际阅读范围

本轮逐行阅读并语义核对：

- `README.md`、`00-能力边界.md`、`01-设计与分布.md`；
- 12 份 `questions/*.md` 的全部 600 条问题；
- 16 个 context 的全部 manifest；
- 50 份 source 正文；
- 172 条 required claim；
- `validate.mjs`；
- `docs/06-references.md`、`docs/08-module-design.md`、`docs/09-data-contracts.md`、`docs/10-voice-ux-spec.md`；
- 当前实施计划中的类型、通用执行器、长期 workflow、connector 与 S3 能力段落；
- 必要的 contracts、daemon policy、类型门和 S3 工具代码。

没有读取禁止范围中的既有 corpus review、Codex findings、prompts、logs、过程 journal、`rebuild.mjs`，也没有读取 Git diff、status 或 log。

### 2.2 判定方法

逐题按以下顺序检查：

1. 先从题面识别最高预期 effect，不从工具名倒推风险；
2. 再检查 `S0-S3`、`F1-F4` 和 `B-*` 是否与该 effect、隐私、专业责任和授权边界一致；
3. 检查工具族是否足以读取必需事实并执行题面承诺的写入、通知、发布、支付、部署或分派；
4. 检查 `CTX/USER/LIVE` 是否补足静态事实、用户专有输入和实时状态；
5. 对每条 required claim 回到列出的具体 source 正文做语义核对，不把 digest 一致当作语义蕴含；
6. 对照 canonical 与当前代码，确认 schema 中的前瞻词表没有被误当成已接通能力。

严重度口径：

- A：会把当前不能安全签发或消费的 S3 effect 表述成可执行，或使高风险动作在较低风险门下通过；
- B：会让任务无法按题面可靠完成，或使输入、工具、长期状态和风险语义产生实质歧义；
- C：不改变能力与安全结论的维护性问题。

## 3. 全量计数

### 3.1 语料与上下文

- 问题：600 条，12 个领域文件；
- context：16 个；
- source：50 份；
- required claim：172 条；
- supplemental input：`-` 34 条，`USER` 20 条，`LIVE` 118 条；
- 近重复对阈值 0.55：0 对。

### 3.2 能力、风险与边界

- `F1` 49，`F2` 483，`F3` 57，`F4` 11；
- `S0` 195，`S1` 187，`S2` 187，`S3` 31；
- `B0` 395，`B-AUTH` 117，`B-PRIV` 36，`B-LEG` 15，`B-FIN` 14，`B-MED` 13，`B-ID` 6，`B-ATTR` 4。

### 3.3 context 登记

- `CTX-01`：13 claims，2 sources；
- `CTX-02`：12 claims，3 sources；
- `CTX-03`：22 claims，3 sources；
- `CTX-04`：6 claims，3 sources；
- `CTX-05`：10 claims，4 sources；
- `CTX-06`：15 claims，3 sources；
- `CTX-07`：16 claims，3 sources；
- `CTX-08`：15 claims，3 sources；
- `CTX-09`：8 claims，3 sources；
- `CTX-10`：9 claims，3 sources；
- `CTX-11`：9 claims，3 sources；
- `CTX-12`：4 claims，3 sources；
- `CTX-13`：6 claims，4 sources；
- `CTX-14`：3 claims，4 sources；
- `CTX-15`：11 claims，3 sources；
- `CTX-16`：13 claims，3 sources。

## 4. 基准能力核对

### 4.1 当前能力边界

`00-能力边界.md:9-19` 把缺省启用的 coding 主线、worktree、verify、S2 审批和 S3 合并列为 `F1`；`00-能力边界.md:23-32` 把外部工具、登录态、writing 窄版和一般长任务列为有条件 `F2`；`00-能力边界.md:38-47` 把通用 research/marketing/general 执行器、原生 connector、跨天 workflow 和多人会议列为 `F3`；`00-能力边界.md:51-58` 把越权支付、部署、删除、发布和绕过 S3 列为 `F4`。

代码与 canonical 支持这一分界：

- `packages/daemon/src/config/types.ts:113-121` 的缺省启用类型仍为 `coding`；
- `packages/daemon/src/tier1/typeGate.ts:14-32` 对未启用类型 fail-closed；
- `docs/plan/IMPLEMENTATION-PLAN-2.md:115-123` 把通用类型合同、四类型执行器、writing 全量和 network fetch 放在 R-C/W8；
- `docs/09-data-contracts.md:1145` 明确 research、marketing、general、planning 仍未开；
- `packages/contracts/src/types/package.ts:10-15` 的 P0 effect 白名单仅为 `install_dependency`、`push_branch`，下游触发仅为 `none`、`ci_preview`；
- `docs/09-data-contracts.md:371-375` 明确 `publish/deploy/delete_data/external_send/force_push` 只是保留词表，P0 签发入口只有 register 和 merge；
- `packages/daemon/src/tier1/s3Tools.ts:104-109` 与 `docs/09-data-contracts.md:1396-1404` 的真实签发、验证、消费路径也只承载 register 和 merge。

因此，外部 connector 或登录态只能证明工具前置条件可能具备，不能把没有 effect 合同的发布、通知、预订、支付、部署或分派升级为当前 `F2`。这与 `00-能力边界.md:34` 的明文规则一致。

### 4.2 全量 F1-F4 结论

- `F1`：49 条中未发现把非缺省执行器、原生 connector 或一般 S3 外部动作冒充当前核心能力的新增问题；
- `F2`：483 条中发现 `MKT-033`、`OPS-048` 两个阻断级越界；
- `F3`：57 条整体诚实覆盖通用执行器、长期 workflow 和真实外部 effect；`WRT-059` 的 `F3` 本身正确，但工具和风险语义不闭合；
- `F4`：11 条均为明确越权或产品边界，未发现应降为可执行任务的条目。

## 5. A 级发现

### A-01 `MKT-033`：live 通知配置写入被错误标成 `S2/F2`

证据：

- `questions/07-marketing-growth.md:46` 明确要求“把频率上限写入 live 渠道配置”，目标覆盖邮件、应用内和推送；现标签为 `S2`、`F2/B-AUTH`；
- `01-设计与分布.md:70-72` 要求风险按题面最高预期 effect 计算；
- `docs/08-module-design.md:62` 要求风险由 effect、目标、数据、身份、下游触发和成本共同决定；
- `packages/daemon/src/policy/engine.ts:39-50` 把 `send_external` 定为 `S3`，并在 `:74-83` 明确下游部署触发会把普通 push 升为 `S3`；
- `00-能力边界.md:34` 明确自动通知和跨渠道发布没有当前直接签发、消费路径，不能因已有工具或登录态标为 `F2`；
- `validate.mjs:152` 反而把该题的 `S2` 固定为已知期待，因此 validator 绿不能证明这个语义正确。

判断：写入 live 频控配置会改变已经存在的外发系统行为，最高预期 effect 不是普通可逆内容写入，而是对后续 external send 的控制。题面没有“只生成草案、不写 live、不触发发送”的限定。当前 S3 生产链不能判别、签发和消费这种动作，`S2/F2` 会把不可用且高影响的 effect 放进普通授权路径。

处置：二选一，不能维持现状。

1. 保留 live 写入：改为至少 `S3/F3/B-AUTH`，列出真实渠道配置写 connector/API、目标环境、下游触发、回滚与当前排期输入；只有补齐专用 S3 判别合同、签发、消费和反例门后才可重评 `F2`；
2. 保留 `F2`：把题面改成“读取当前配置，生成去重和频控变更草案，不写 live、不触发发送”，再按草案对敏感数据的实际接触面重评 `S1/S2`。

### A-02 `OPS-048`：预约与随访提醒没有唯一限定草稿还是 live effect

证据：

- `questions/05-business-operations.md:56` 要求“协调预约、材料和随访提醒”，列 `calendar,notification,rag`、`CTX-13+LIVE`，但标签仅为 `S2/F2/B-MED`；
- `contexts/CTX-13/manifest.md:11` 明确任何对外发送前必须人工确认收件人和字段；
- `contexts/CTX-13/coordination-rules.md:3-7` 限制共享范围，并要求预约取消双重确认；
- `00-能力边界.md:34` 明确自动通知不在当前直接签发与消费路径；
- `docs/10-voice-ux-spec.md:86-94` 规定 S2 可逐项确认，但 `:87` 规定 S3 绝不由语音放行。

判断：“协调预约”和“随访提醒”按自然语义可以直接创建或修改外部预约，并向患者发送通知；也可能只是生成行政计划。当前题面没有唯一判定，工具列和 `LIVE` 又强化了实际执行的解释。如果按实际执行理解，它包含 external send，至少应进入 `S3/F3`；若按草案理解，必须把“不创建预约、不发提醒”写进题面。医疗边界声明只限制诊断和改医嘱，不能代替外部动作授权。

处置：

1. 草案路线：改成“整理待预约事项、材料清单和提醒计划，不创建或取消预约、不发送提醒”，保留 `F2/B-MED` 并重评工具；
2. live 路线：改为 `S3/F3/B-MED`，显式给出患者授权、收件人、字段、渠道、时间、当前预约状态和专用 connector，且在 effect 合同接通前只交人工执行。

## 6. B 级发现

### B-01 `WRT-059`：长期传播、专家签核和工具族不闭合

证据：

- `questions/03-writing-content.md:136` 要求持续维护五种语言的政策手册，从单一源传播变更并让本地专家签字；当前是 `D4 H4 K2 S1`，工具仅 `pdf,document,rag`，能力为 `F3/B-AUTH`；
- `validate.mjs:138` 把该题的 `D4/H4/S1/B-AUTH` 固定为期待；
- `01-设计与分布.md:21` 要求工具列是完成问题确需的唯一工具族；
- `00-能力边界.md:32,46` 明确可靠跨长时、完全无人值守 workflow 尚不能承诺。

判断：`F3` 与 `D4/H4` 是诚实的，但题面没有说明传播止于版本化草案，还是写入正式手册并触发审批。若“签字”是实际审批动作，至少缺 workflow/tasks 或 e-sign 类工具；若变更进入正式发布面，还会升到 `S3`。当前 `pdf,document,rag` 只能覆盖取材与稿件生产，不能闭合长期监测、传播和签核。

处置：将题面限定为“生成五语版本化草案和专家签核清单，不发布、不通知、不代签”，可保留 `S1/F3`；若保留真实传播和审批，则补 automation/tasks/notification/e-sign 或实际 connector，按是否正式生效或外发重评 `S2/S3`，并保持 `F3`。

### B-02 `LRN-002`、`LRN-003`：错题主题摘要不能充当原始错题

证据：

- `questions/09-learning-development.md:10-12` 分别要求“拿订单重复消费的错题讲清”和把“最近两次模考的错题”做成逐题口头复盘，两题都只声明 `CTX-10`；
- `contexts/CTX-10/mistake-log.md:1-9` 只有五类错误主题和两次总分，没有原题题干、选项、学习者作答、正确答案，也没有两次模考逐题归属；
- `contexts/CTX-10/time-constraints.md:3-9` 支持通勤、口头复盘和学习偏好，但不能补出错题正文；
- `contexts/CTX-10/manifest.md:30-31` 把两题的 supplemental input 都登记为 `-`；
- `validate.mjs:261-264` 只锁定了“最近两次模考的五类错题”摘要与无 supplemental，并未验证 source 是否足以重放实际题目。

判断：172 条 required claim 的声明文本中，这两条仍能被 source 的摘要语义支持；问题出在 claim 本身没有覆盖题面所需事实。系统可以基于五个薄弱主题生成新练习，却不能诚实声称在回放“最近两次模考的错题”。否则会虚构原题、原答案或错误归属。

处置：二选一。

1. 改题面为“基于已记录的误区设计新题”及“把五类错题主题做成十分钟复盘”，保留 `CTX-10`；
2. 保留原题回放：改为 `CTX-10+USER`，在 required claim 的 supplemental input 中要求用户提供原题、本人作答和可核验答案；若原题受版权或保密限制，只保存最小必要摘要。

### B-03 `LIF-022`：实时行程比较缺交通、住宿数据工具和必要用户输入

证据：

- `questions/10-personal-life-admin.md:66` 要求在当晚比较改签、换站和住一晚，并满足次日十点前到家的硬约束；工具仅 `maps,finance`，上下文只有 `LIVE`；
- `01-设计与分布.md:21,62-68` 要求列出完成当前问题确需的工具族，K 由去重后的实际工具数派生；
- `00-能力边界.md:25-26` 要求外部工具、登录态、联网来源与新鲜度显式成立。

判断：地图与费用计算不足以取得实时车次、余票、改签规则、站点替代方案、酒店当晚可用性和即时价格；题面也没有提供出发地、目的地、当前票据、可接受换乘与住宿约束。虽然“付款前停住”使本题不含实际购买 effect，当前输入仍不足以产生可靠比较。

处置：增加 `browser` 或专用交通/住宿 booking connector，并将上下文改为 `USER+LIVE`，由用户或已授权票务系统提供当前票据、起终点、乘客与偏好。加入 `browser` 后工具总数仍在 `K2` 的 2 至 3 个范围内；如果依赖多个独立 booking 系统，则按真实去重工具数重算 K。

## 7. RAG 事实闭合结论

### 7.1 source 与 claim

- 50 份 source 均存在、非空，manifest 的 source 集合与目录闭合；
- 172 条 required claim 均登记具体 source，而不是只登记 digest；
- 本轮逐条回读后，172 条“声明文本”均可由所列 source 的正文直接支持或由同一组来源做有限合成，没有发现用 digest 替代语义蕴含、把低权威来源覆盖高权威来源或跨 context 借证的问题；
- `CTX-10/LRN-002`、`CTX-10/LRN-003` 是任务级输入闭合失败，不是 source 对现有 claim 文本的反证：现有 claim 只承诺错误主题摘要，题面却要求原题复盘。

因此：claim-source 语义支持计数为 172/172；面向问题的 RAG 任务闭合为 170/172，缺口是 `LRN-002`、`LRN-003`。

### 7.2 supplemental input

登记层的 `USER/LIVE` 与题目行机械一致，但语义上有三处需回修：

- `LRN-002`、`LRN-003` 应补 `USER`，除非改写成基于主题生成新题；
- `LIF-022` 应补 `USER` 以取得票据和行程约束；
- `MKT-033`、`OPS-048` 的 `LIVE` 只说明要读当前系统，不会自动赋予 S3 写入或外发能力。

### 7.3 as_of、valid_until 与 authority order

- 16 个 context 的 `as_of` 均不晚于 2026-08-26；
- 13 个日期型 `valid_until` 均未过期；
- `CTX-01`、`CTX-04` 使用 `fixture-frozen`，并要求真实产品或外部证据经 `LIVE` 复核；
- `CTX-02` 使用 `immutable_event_window`，只陈述冻结事故窗口；
- 每个 context 的 authority order 均与来源性质相符，未发现把反馈、个人观察、旧 runbook 或销售材料覆盖正式合同、机构指示或已校时时间线的情况。

## 8. validator 与门禁解释

`validate.mjs` 的绿灯是真实结构证据，但不是本次语义裁决的替代品：

- `validate.mjs:593-620` 检查 source 集合、长度和 digest；
- `validate.mjs:627-636` 检查 required claim 与预置字符串、source 文件名和 supplemental 字段；
- 它没有把每条 claim 的自然语言含义与 source 正文做普遍语义推理；
- `validate.mjs:439-440` 的真实外部 effect 门是有限正则，未覆盖“写入 live 渠道配置”与“协调预约和提醒”；
- `validate.mjs:138,152` 还分别锁定了 `WRT-059=S1`、`MKT-033=S2`，所以这两处需要先修正语义基线，不能拿当前 validator 绿灯反证终审发现。

建议回修后把上述 ID 加入 effect、工具和 supplemental 的明确反例门，但 validator 仍应被描述为结构与已知反例门，不应声称证明全部 RAG 语义。

## 9. 命令证据

### 9.1 全量库存

执行了只读 Node 库存脚本并紧跟读取退出码，原始关键输出：

```text
questions 600
questionFiles 12
contexts 16
sources 50
requiredClaims 172
exit_code=0
```

另一次 supplemental 计数输出：

```text
{"total":172,"dash":34,"USER":20,"LIVE":118,"other":0}
supplemental_count_exit_code=0
```

### 9.2 官方 validator

执行命令：

```sh
node research/customer-question-corpus/validate.mjs
rc=$?
echo "validator_exit_code=$rc"
exit $rc
```

关键原始输出：

```text
[ok] 600 条语料结构、登记合同完整性与已知语义反例门通过
validator_exit_code=0
```

该结果只证明 validator 已覆盖的结构、digest 和已知反例全部通过；A/B 发现来自对 600 条题面、172 条 claim 与 50 份 source 正文的独立语义回读。

### 9.3 限定路径 emoji 门

在报告落盘后，对本轮允许读取的 canonical、计划、必要代码、corpus README/00/01、全部问题、全部 context、validator 和本报告执行了明确 pathspec 的 emoji 门，没有递归扫描 corpus 根目录或禁止目录。关键原始输出：

```text
[ok] emoji gate: clean
emoji_gate_exit_code=0
```

## 10. 限制

- 本轮没有连接真实邮件、日历、CRM、票务、渠道配置或移动推送账户，无法证明具体 connector、登录态、权限范围和实时数据可用；本报告只判断语料是否把这些前置条件和 effect 合同说闭合。
- 本轮没有实施修复，也没有修改语料、validator、canonical 或代码。
- 本轮没有运行 Git 命令，也没有检查或评价其他工作树改动。
- 终审只覆盖委托指定的能力边界、工具与输入、风险与 effect、RAG 事实闭合，不对语言自然度、市场频率先验或领域覆盖做新的排序。

## 11. 最终裁决与清单

- A-01 `MKT-033`：live 渠道配置写入应改为 `S3/F3` 或明确改成不写 live 的草案；
- A-02 `OPS-048`：预约与提醒必须唯一限定为草案或 `S3/F3` live 路线；
- B-01 `WRT-059`：补长期传播与签核工具，明确正式生效边界并重评风险；
- B-02 `LRN-002/LRN-003`：补原始错题 USER 输入，或改成基于错误主题生成新题；
- B-03 `LIF-022`：补实时交通/住宿工具和当前票据、起终点等 USER 输入；
- C：本轮没有单列 C 级问题。

由于存在 2 个 A 级和 3 组 B 级问题，最终裁决为：`[fail]`。
