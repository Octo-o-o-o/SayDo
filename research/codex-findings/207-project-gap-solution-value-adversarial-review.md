[fail] A=4 / B=9 / C=1

本次仅做静态只读审查；未联网、未修改文件、未运行产品测试。真实用户需求、live account、真机表现、商业 ROI 和现役线上部署状态均为 `unknown`。

## Findings

### A 级

1. **A：公开止损仍受主观产品判断约束。** [docs/plan/2026-08-28-project-gap-closure-program.md:823](docs/plan/2026-08-28-project-gap-closure-program.md:823) 把 SP0 开包条件写成“owner 接受诚实收窄不会被视为功能倒退”，但同文 :779 又规定立即止损不能跳过。后果是已判定失真的费用、能力和安全声明可能因“看起来像倒退”而继续保留。最小修订：采用本计划后，已证伪 claim/入口必须无条件降级或禁用；owner 未接受具体文案时保持 `blocks_expansion`，不得继续 RC、发布或能力升级。

2. **A：`mobile read-only` 不是 G-A6 的安全降级。** [docs/plan/2026-08-28-project-gap-closure-program.md:774](docs/plan/2026-08-28-project-gap-closure-program.md:774) 和 :811 允许保留 insecure dogfood 读面；但当前合同明确该面是明文 LAN + 长寿命全局 token，并能读取转写原文和 M1–M3 记忆全文，见 [docs/09-data-contracts.md:1231](docs/09-data-contracts.md:1231)，token 还进入 URL/localStorage，见 [packages/console/src/lib/api.ts:20](packages/console/src/lib/api.ts:20)。后果是凭据泄露仍可造成敏感数据读取，禁写/S2 不能关闭该 A 级风险。最小修订：逐设备凭据和安全传输闭合前，正式能力标为 `unsupported`；远程面只保留无业务 payload 的 health/static shell，或明确限定在已证明安全的受信传输，不得计入推荐最小组合。

3. **A：历史敏感 audit 数据没有唯一、合同相容的关闭方案。** [docs/plan/2026-08-28-project-gap-closure-program.md:777](docs/plan/2026-08-28-project-gap-closure-program.md:777) 给出“迁移、密钥轮换、隔离或 owner 接受”四个分支。当前 sink 是明文 JSON 且审计不可变，见 [packages/daemon/src/storage/dao/misc.ts:83](packages/daemon/src/storage/dao/misc.ts:83)；单纯轮换密钥并不会删除明文，“owner 接受”也不能自动满足敏感 payload 只记 digest 的 canonical。后果是 G-A9 可在原文仍存在时被误标关闭。最小修订：先给受影响行、备份和副本 exact inventory，再为每类确定唯一处置；任何例外必须先形成 canonical 例外、期限、访问限制和退役证明，不能以普通 owner acceptance 计作 `closed`。

4. **A：retention 被列为规则，却没有成为扩展前置。** [docs/plan/2026-08-28-project-gap-closure-program.md:645](docs/plan/2026-08-28-project-gap-closure-program.md:645) 要求决定日志、审计、备份和证据保留期，:919 又说必须分别定义；但 SP5 在 :828 只要求场景和 live budget，未要求 D13 已签。后果是 Web/source snapshot、artifact 和真实账号证据可在删除、备份传播、版权及事故责任未定时开始积累。最小修订：把逐 store 的 retention/deletion/export/backup propagation/legal-hold 表列为 SP2、SP5 的 blocking predecessor；未签时禁止新增用户内容类 snapshot。

### B 级

5. **B：D12 的推荐不能机械约束真实调用成本。** [docs/plan/2026-08-28-project-gap-closure-program.md:644](docs/plan/2026-08-28-project-gap-closure-program.md:644) 的问题包含账号、token、调用量和清理责任，但 :954 只回答“小预算 canary + RC exact-set”。“小预算”不可判定，SP3 却可据此把 D12 视为已裁决。最小修订：D12 必须签出每次/每日/每月的 request、token、金额、外部 effect 上限，账号 lease、清理责任、kill switch 和超限非零退出条件。

6. **B：待裁决路线被写成“选定方案”。** [docs/plan/2026-08-28-project-gap-closure-program.md:783](docs/plan/2026-08-28-project-gap-closure-program.md:783) 的列名是“选定方案”，随后 :789、:790、:796 分别选定 Developer RC/research、mobile read-only、Developer Preview；但 D1/D4/D6/D10 在 :631–647 仍只是缺省建议。后果是路线建议可能被当成 owner 已批准的产品档位。最小修订：改为“条件推荐”，增加 `decision_id/status/decision_digest`；未签项只保留分支，不得进入 SP 的已选 exact-set。

7. **B：所谓最小组合实际同时开启五条价值与维护轨。** [docs/plan/2026-08-28-project-gap-closure-program.md:805](docs/plan/2026-08-28-project-gap-closure-program.md:805) 同时包含 coding、Web research、mobile、AI protocol、tool connector，而 D4/D5 尚无新用户证据。后果是单 owner 会在尚未验证 coding 主线价值时，同时背上 Web 版权/SSRF、移动安全、connector drift 和 live evidence 成本。最小替代见下文“最小组合判断”。

8. **B：唯一排产源自身仍有冲突和已签决策残留。** 主案要求只回填 [docs/plan/IMPLEMENTATION-PLAN-2.md](docs/plan/IMPLEMENTATION-PLAN-2.md)，见 [project-gap:8](docs/plan/2026-08-28-project-gap-closure-program.md:8)；但该文件 :137 声称 ai-supply 已开坐标，:253 又称下一批是 W5.4-c→R-B，且 :122 仍排 Codex app-server spike，与已签“Codex 走 `codex exec`、本轮不建 app-server 平面”冲突，见 [owner-decisions:120](docs/plan/2026-08-24-ai-supply-owner-decisions.md:120)。后果是即使总案不自称排产源，实施者也无法从唯一源确定下一批。最小修订：先在唯一排产源消除当前指针/顺序冲突，并把 app-server 明确移到 deferred inventory。

9. **B：SP/Wave/五线没有 exact crosswalk，关闭条件出现冲突。** [docs/plan/2026-08-28-project-gap-closure-program.md:821](docs/plan/2026-08-28-project-gap-closure-program.md:821) 只有包级摘要：SP4 写模糊的 `S2`，而正文定义的是 S2a/S2b；SP7 写 Q1–Q6，但 Q1/Q2 的 schema/reference 子集又在 Wave 0；E9 标题后的 :627 却是语料退出条件；G-B15 的“旧 DTO 随触达迁移”(:799)又与 E8“mirror DTO 为零”(:281)冲突。后果是可能重复施工、漏项或永远无法判定关包。最小修订：增加每个 E/U/S/T/Q 叶项到唯一 SP、Wave、decision、前置、gate、deferred 状态的一对一矩阵。

10. **B：Truth Plane 的生成系统范围自相矛盾且偏重。** [docs/plan/2026-08-28-project-gap-closure-program.md:137](docs/plan/2026-08-28-project-gap-closure-program.md:137) 要求 README、deploy、templates、console 等全部从 ledger 投影，:148 要求生成物 exact-set 全等；但 :959–960 又说先手工维护少量条目、出现第二个输出漂移后才做完整生成。后果是 SP1 的完成定义不可唯一理解，并可能先建设一套发布编译器再验证产品价值。最小修订：Developer RC 只保留小型 ledger schema、validator、claim-root checker 和一份 support matrix；多输出生成器设独立触发线。

11. **B：D11 只有逐项准入，没有组合总量上限和支持等级。** [docs/plan/2026-08-28-project-gap-closure-program.md:643](docs/plan/2026-08-28-project-gap-closure-program.md:643) 问“每个 release 最多维护多少”，但 :953 只要求每项有 maintainer。后果是每项单独合规，AI × protocol × platform × locale × connector 的笛卡尔组合仍可无限增长；事故响应、支持时限和 EOL 也无人承担。最小修订：D11 签出总组合上限、owner 小时/账号/设备/年度费用容量，并补 Developer Preview 的支持级别、事故责任和安全更新/EOL 规则；超额时 support projection 必须拒绝升级。

12. **B：ROI 纪律没有进入继续/退出卡的样本设计。** [docs/plan/2026-08-28-project-gap-closure-program.md:877](docs/plan/2026-08-28-project-gap-closure-program.md:877) 正确要求 baseline、样本量和观察窗，但 :972 的 decision card 漏了样本量、分母、测量方法和排除规则，:975 仍允许按“达到阈值”继续。后果是一位 owner 的一次成功任务就可能被解释为产品跃迁。最小修订：card 增加用户/任务分母、最小样本、baseline 周期、观察窗、人工帮助计入方式和明确 decision rule。

13. **B：未签 AI 决策没有绑定到 SP 开包条件。** [docs/plan/2026-08-28-project-gap-closure-program.md:414](docs/plan/2026-08-28-project-gap-closure-program.md:414) 声明未签项不得推断，但 SP2/SP4 的 :825/:827 没列 AI 决策 3、4、5；它们仍分别未签 evaluator 同族、分发版 Claude 订阅、LAN discovery，见 [owner-decisions:151](docs/plan/2026-08-24-ai-supply-owner-decisions.md:151)、:186、:209。另 :475 承认已签“内置 connector only”是否覆盖 MCP 尚待确认，:951 却已推荐 MCP adapter。后果是 quality、rights、网络探测或扩展边界可能被施工批隐式决定。最小修订：为每个 SP 增 owner-decision exact prerequisites；MCP 在 D5 明确前保持 deferred 或严格限定为 first-party built-in transport。

### C 级

14. **C：语料配额是未经基线支持的固定工作量。** [docs/plan/2026-08-28-project-gap-closure-program.md:540](docs/plan/2026-08-28-project-gap-closure-program.md:540) 和 :556–558 固定 48 journey、12 长会话、6 对跨 session、17 类各三次及十个复合故障，没有说明这些数字来自何种风险模型或用户频率。后果主要是策展维护负担和“数量即覆盖”的错觉。最小修订：把数字改为首轮预算上限/候选目标；关闭标准按风险、状态转换和真实故障信号，不按条数本身。

## 方案中最合理的部分

- `designed / conditional / supported` 分级、claim 与 evidence exact-set、过期自动降级的方向正确。
- Authority Kernel、Durable Core、inference/execution/tool 三平面分离合理；协议优先、read 先于 write、内置先于扩展能降低组合爆炸。
- Developer RC、A2A/team/SDK deferred 是当前阶段合理边界。
- 15.1 对工程结果与商业结果的分栏，以及 15.3 明确拒绝无 baseline 的 ROI 百分比，基本诚实。
- 生命周期成本表已覆盖 AI/API、账号、设备、存储、合规、客服、无障碍、退役、owner 注意力和机会成本；主要缺口是没有把这些成本变成签署值与机械门。

## 最小组合判断

当前组合不是风险最低的“最小组合”。在单 owner、Developer RC、无新增真人证据的条件下，更小的方案文本应是：

1. 只保留 SP0–SP3 的风险目标，但 Truth Plane 采用最小 ledger/validator，不建完整生成系统。
2. 价值面只保留一个桌面 coding reference journey、一个合法 inference protocol 和一个已经证明的 execution driver。
3. 已签 ACP 决策保留为内部 execution preview，不把六家品牌都升入 supported denominator，也不作为下一 RC 的价值门。
4. 当前 mobile 只做诚实降级/关闭业务读面，不列为 supported/read-only 产品纵切片。
5. Web research 和 MCP 等 D4/D5、真实非开发需求、maintainer、费用与 retention 卡签出后再二选一引入；首个 connector 仍限内置。
6. A2A、Team、第三方 SDK/registry 继续 deferred。

当真实用户明确把 research 排在 coding 之后或之前，并且 D4/D5、D11–D13均有签署值时，再把 Web research 加为第二纵切片。

## 完整性核对

| 对象 | 形式完整性 | 实质结论 |
|---|---:|---|
| 9A | 9/9 均有登记、14.3 行和 Wave 处置 | 未通过：A6 降级不安全，A9 历史处置不唯一，SP0 止损仍受主观条件 |
| 17B | 17/17 均有 14.4 行 | 未完全可关闭：B1 超出当前纵切片，B15 存在“随触达”与“归零”冲突 |
| E/U/S/T/Q | 各编号均出现 | 未形成叶项级唯一 SP/Wave/decision/gate 映射 |
| SP0–SP7 | 8 个包齐全 | SP0 条件不安全；SP4 的 S2 含义不唯一；SP7 与 Wave 0 重叠 |
| Wave 0–5 | 六波齐全 | E9 退出条件错位；尚未回填唯一排产源 |
| D1–D13 | 13 项齐全 | 都是推荐而非已签裁决；D11–D13 缺可机械执行的数值 |
| 已签 AI 决策 | #1、#2、#6、#7 | 总案正文基本一致；唯一排产源仍残留 Codex app-server spike |
| 未签 AI 决策 | #3、#4、#5、#8、#9、#10 | #3–#5 会影响近期 SP，必须显式前置；#8–#10 可继续 deferred |

## 仍需 owner 裁决、计划不能代拍

- D1–D10 的产品档位、corpus 处置、direct mode、首个用户任务、首个 connector、移动、locale/accessibility、Team、MCP 和发布物定位。
- D11 的支持组合硬上限与 owner 可持续维护容量。
- D12 的具体账号、调用/金额上限、频率和清理责任。
- D13 的逐 store retention、删除传播、telemetry 和用户内容边界。
- AI 决策 3、4、5；决策 8–10 在对应 deferred 路线重开时再签。
- 还缺一个明确的“支持等级与事故响应”裁决：Developer Preview 是否 best-effort、支持哪些版本、漏洞/事故由谁响应、何时 EOL。

真实用户偏好、激活率、复用率、商业 ROI、live connector 稳定性和真机可用性目前均为 `unknown`。