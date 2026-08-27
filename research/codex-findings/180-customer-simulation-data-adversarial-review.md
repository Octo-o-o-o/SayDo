# 72 组模拟用户会话一次性对抗终审报告

## 结论

`[fail]`

- A：2
- B：4
- C：1
- 当前不建议交付。
- 仅 A1、A2 阻塞；B/C 不应触发新一轮全面复审。

## A 级发现

### A1. 六组 fixture 缺少核心结果所需事实

这不是 payload 不像真实 API，而是全部可用输入合并后仍缺主任务的关键数据；回放只能编造或无法产出登记的首个可审阅结果。

- `SIM-LIF-02`：要求列出四项具体到期日，`expiry-table` 没有任何日期。[fixture](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/fixtures/10-personal-life-admin.md:50)
- `SIM-CAR-03`：要求结合市场价格起草报价区间，`rate-band` 没有费率、币种或区间。[fixture](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/fixtures/11-career-freelance.md:50)
- `SIM-CAR-04`：CTX 明确不含当前薪酬，`comp-band` 也只有日期和 `userOffer:null`，没有薪酬区间。[fixture](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/fixtures/11-career-freelance.md:67)
- `SIM-FAM-02`：要求列回执、活动、材料截止和缴费；`school-mail` 只有金额和未支付状态。[fixture](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/fixtures/12-household-family-community.md:32)
- `SIM-FAM-03`：会话明确要求 LIVE 提供当前确认报名和最低覆盖阈值，但 `roster-live` 两者都没有，无法计算缺口。[session](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/sessions/12-household-family-community.md:169)、[fixture](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/fixtures/12-household-family-community.md:49)
- `SIM-OPS-06`：要求给出重复实体候选、证据字段和流程差异；`entity-overlap` 只有候选总数、禁止自动合并和空法律意见。[fixture](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/fixtures/05-business-operations.md:139)

### A2. 验证器存在已证实的虚绿

[validate-simulations.mjs](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/validate-simulations.mjs:109) 只确认 payload 是对象，并按顶层键数告警；不检查它是否包含任务所需事实。对生成文件也只做全文件 `includes` 检查，没有解析所属 SIM 的 turn、oracle、payload 或终态，见 [165 行](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/validate-simulations.mjs:165)。

只读内存变异测试证实它会接受：

```text
mutation=session accepted=true
mutation=fixture accepted=true
mutation=non_substantive_turns accepted=true
```

三个变异分别删除会话的实质轮次/oracle、把 S3 fixture 改成已部署、把后续轮改成首轮原话复刻；验证器仍输出：

```text
[ok] A-level checks passed
```

当前 A1 六组真实存在时，正式验证命令同样报告 `A=0`，因此不是理论缺口。

## B 级发现

1. 以下 payload 偏薄，但仍足以测试安全停止、来源纪律或结构行为，按放松尺度不阻塞：`SIM-OPS-05`、`SIM-SAL-04`、`SIM-DAT-05`、`SIM-LRN-03`、`SIM-LIF-05`、`SIM-WRT-01`、`SIM-WRT-04`、`SIM-RES-03`、`SIM-LIF-01`、`SIM-LIF-03`、`SIM-CAR-02`、`SIM-LRN-04`。

2. 六个失败变体与基线实质相同，扰动没有新增测试价值：`SIM-RES-01`、`SIM-SAL-02`、`SIM-MKT-04`、`SIM-MKT-06`、`SIM-DAT-03`、`SIM-DAT-04`。基线本身仍能测试 fail-closed。

3. `SIM-MKT-01` 和 `SIM-SAL-05` 存在局部 USER 时序混淆：回放前声明材料尚未提供，但首轮 fixture 已包含用户第二轮才补充的数值或红线。

4. 17 个 S3/F4 的实际行为都安全，但部分 oracle 只写动作特定禁令，没有逐项复述 [01-schema.md 第 76 行](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/01-schema.md:76) 的三条通用判据。现有 oracle 仍能判断核心行为，因此不阻塞。

## C 级发现

[00-simulation-plan.md 第 101 行](~/WorkSpace/SayDo/research/customer-question-corpus/simulations/00-simulation-plan.md:101) 的 emoji 示例直接传目录，与门禁实际接口不符。真实执行结果：

```text
exit=2
[fail] emoji gate: unreadable or missing file: research/customer-question-corpus/simulations
```

README 中通过 `find | xargs` 逐文件传参的写法是正确的。

## 已确认无硬问题

- 上游问题行 600/600 唯一；选中 72/72，corpus ID 全部唯一，源问题、H/M/L、标签、工具、上下文和能力边界逐字段一致。
- 每域 6 组；H/M/L 为 32/25/15。
- 共 217 个用户轮、145 个后续轮；全部后续轮均有实质补充、纠正、改约束、确认、拒绝或恢复。
- 217 条用户话术无完全重复；15 种后续 move 序列、60 种工具组合，字符三元组最高跨会话相似度 0.090，未发现大面积语义模板复刻。
- 35 个 CTX 会话全部存在于对应 manifest 的 `supported_questions` 和 required-claims 表，未发现 CTX 越界或 USER/LIVE 冒充冻结事实。
- 80 个 fixture 事件均被实际引用；没有空引用或 locator 错位。
- 17 个 S3/F4 全部 `authReady=false`，未伪造发送、支付、部署、发布、删除、签署或授权收据。
- 9 个 `ready_for_review` 均未写成完成或交付。
- 生成器连续两次内存构建完全一致，并与当前 25 个生成物逐字节一致：

```text
digest_run1=3650c9977040ede65ac4a499e7d3980a45d06faf751212df26604b7bc0f43e69
digest_run2=3650c9977040ede65ac4a499e7d3980a45d06faf751212df26604b7bc0f43e69
current_mismatches=0
rerun_mismatches=0
```

## 门禁原始摘要

指定验证器，退出码 0：

```text
sessions=72 domains=12 H/M/L=32/25/15
CTX=35 USER=28 LIVE=51 dash=2 S3orF4=17 LIF/FAM=12
lifecycle first_clarify=25 user_supplement=24 rag_conflict=17 live_degrade=40 write_confirm=19 mid_change=8 tool_fail=11 pause_resume=10 overreach=10
tags C=C1,C2,C3,C4,C5 D=D0,D1,D2,D3,D4 H=H0,H1,H2,H3,H4 R=R1,R2,R3,R4 K=K0,K1,K2,K3,K4 S=S0,S1,S2,S3 F=F1,F2,F3,F4
tree_sha256=3650c9977040ede65ac4a499e7d3980a45d06faf751212df26604b7bc0f43e69
A=0 warn=32
[ok] A-level checks passed
```

逐文件 emoji 门禁，退出码 0：

```text
[ok] emoji gate: clean
```

## 过程完整性说明

独立 `codex exec` 因当前只读环境无法写入本机 state DB，退出码 1，未产生评审结论，未被计入证据。

两名独立子评审违反只读要求，新建了以下未跟踪文件：

```text
research/customer-question-corpus/simulations/review/01-coverage-naturalness.md
research/customer-question-corpus/simulations/review/02-safety-rag-oracle.md
```

已尝试用 `apply_patch` 精确删除，但沙箱拒绝写入；两个文件仍需由具备写权限的会话移除。评审对象本身未被改写。

## 交付建议

当前不建议交付。只需：

1. 补齐 A1 六组 fixture 的核心合成事实；
2. 修正 A2，使验证器能检查核心字段并精确对账生成物，同时加入上述三个变异反例。

完成这两项并重跑指定门禁后即可收口；本报告的 B/C 不阻塞交付，也不建议据此再启动全面复审。