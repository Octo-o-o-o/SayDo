# 邮件作为通知与交互通道 · 双方调查交叉比对终稿(2026-09-08)

> 性质:专题评估,不是排产源,不改合同。落地须先改 canonical(04 §4 / 07 D11 / 09)并导入
> `IMPLEMENTATION-PLAN-2.md`。本稿由当前会话(Fable)综合 owner 提供的 Codex 分析与本会话自查写成;
> 两方都只做了静态阅读,未改代码、未运行验证。

> **核验状态(2026-09-09,Fable)**:阶段 A 核验为有价值的小批(现有 `SweepDeps` 已并列 desktop/ntfy,加 email 投递对象是同构接线),但取决于 §5 四个 owner 决定,未实施、未导入 PLAN-2;`IMPL-PROMPT-2026-09-09-gap-consolidation.md` §3 将其列为“待 owner 具名”。阶段 B 与三个并行候选维持原判(P1/P2),不再复查。

## 0. 结论

**想法合理,应该做,但要拆成两个阶段,而且不替代现有内核。**

- 邮件不是"整套通知调度的替代品",而是升级链 L1 的一条新出站通道,以及未来的一条弱认证输入通道。
  outbox、settle barrier、升级计时、DND、审批矩阵、审计仍由 daemon 自己持有。
- **阶段 A(现在可排小批)**:邮件作为出站通道。ready_for_review / blocked / failed 按任务聚合成邮件线程,
  深链回控制台完成 ack 与后续操作。走用户现有邮箱的 SMTP submission,不自建邮件服务器。
- **阶段 B(依赖 P1 文字轮次通道)**:邮件回复作为输入。提交任务、补充要求、回答澄清进入与控制台文字
  输入同一条对话入口。前置条件是 daemon 先有文字轮次通道,而 05 路线图把纯文字模式定为 P0 非目标、
  P1 再开,当前 daemon 没有任何文字输入 API。所以这是 P1 级产品项,不是本批次能做的事。
- **永远不做**:邮件承担 S2/S3 审批;邮件替代语音回叫 L0 和手机来电式汇报;SayDo 自己提供 IMAP/SMTP 服务。
- **"任何客户端都能标准接入"这个目标要分两层看**:人用邮箱客户端,阶段 A + B 满足;硬件与第三方程序
  应接 HTTPS 操作接口 + 事件订阅,邮件不是它们的正确接口。

## 1. owner 原始问题

把项目里所有通知调度类事件改成标准邮件服务,让所有客户端用一套标准方式接入,甚至无需专用客户端,
用户有邮箱客户端、走 IMAP/SMTP 就能完整接入。这个想法是否合理,有无更合适方案,当前是否已是最优。

## 2. 两方各自做了什么

### 2.1 Fable(本会话)

读取与核验的对象:

| 对象 | 位置 | 用途 |
|---|---|---|
| 回叫策略正文 | `docs/04-key-mechanisms.md` §3–§4(L95–128) | 状态词、事件优先级、升级链、DND、实现注记 |
| 审批与远程通道 | `docs/04-key-mechanisms.md` §5.1–§5.2(L134–158) | S0–S3 分级;远程通道只读、DTMF 只 ack/snooze/拒绝、S3 只走已认证屏幕 |
| 回叫 outbox 合同 | `docs/09-data-contracts.md` §6.3(L644–669)、DDL L903 | dedupeKey 四段、至少一次 + dedupe 收敛、离开 ready_for_review 冻结 |
| 审批矩阵 | `docs/09-data-contracts.md` §3(L308–332)、DDL L766–777 | `decidedVia` 词表 voice/screen/push/preauthorized,DDL CHECK 锁词表;push 封顶 S2 且需 paired_device_pin |
| attention 账本 | `docs/09-data-contracts.md` L1549 | 回叫送达账与 attention ack 分账 |
| 模块分工 | `docs/modules/c-control-bridge.md` C4(L40–42)、`docs/modules/d-presentation.md` D2 | C4 依赖 ntfy(E1 供给);D2 = PushKit/CallKit |
| 技术选型 | `docs/07-tech-stack-decisions.md` D11(L29、L151) | "P0 ntfy + 桌面通知 → P1 APNs/FCM 直连",定稿 |
| 路线图 | `docs/05-roadmap.md` L69、L91、L111 | 单用户假设;**纯文字模式 = P0 非目标,文字轮次通道 P1 再开**;回叫聚合 P1 |
| UI 原则 | `docs/11-ui-spec.md` L29 | "渠道只是 transport,账本是真相" |
| 回叫实现 | `packages/daemon/src/callback/{engine,sweep,ntfy,desktop,ack,arbitration}.ts`(共 891 行) | engine 231 行持有 outbox 与升级;sweep 353 行做 L0/L1/DND 选路;ntfy 94 行只做渲染 + POST |
| 投递注入点 | `packages/daemon/src/index.ts` L3476–3553 | `SweepDeps` 注入 `desktop` 与 `ntfy` 两个对象;ntfy 来自 `NTFY_TOPIC` / `NTFY_SERVER` 环境变量 |
| 脱敏 | `packages/daemon/src/voice/redactor.ts` | `redactText` 已被 ntfy 渲染复用,任何外呼面必经 |
| HTTP 接口面 | `packages/daemon/src/index.ts` 路由挂载 | 只有 setup / spaces / focuses / approvals / outbox / attention / s3 等读写面,**没有文字轮次入口** |
| 停靠老化 | `packages/daemon/src/live/scheduler.ts` | 步界 30s 超时转 blocked、72h 老化取消、收据超时终局 |
| 既有提法检索 | `docs/` 全文 | canonical 中没有任何 邮件 / email / IMAP / SMTP / Web Push / CalDAV / CloudEvents 提法,本题是新议题 |

主要判断:邮件适合出站,不适合承担 ack 时效、语音、来电、S2+ 审批;入站是注入面;
"无需硬件客户端"现在已成立,邮件替换的是 ntfy app 而不是控制台。另提出 Web Push 与 CalDAV 两个并行候选。

### 2.2 Codex(owner 提供)

阅读了回叫引擎、`live/scheduler.ts`、`docs/11-ui-spec.md` L28 附近,引用 RFC 5321 与 CloudEvents 官网。
主张:邮件做成一等交互入口,承载完整异步工作流(提交任务、补充要求、回答澄清、结果汇报、附件、每日摘要);
内部调度、超时、重试、状态流转仍由 SayDo 持有;强认证操作经邮件链接进确认页;
先接用户现有邮箱,不自建 IMAP/SMTP;硬件与程序客户端走 HTTPS 接口 + 事件订阅,事件封套可考虑 CloudEvents;
过期回复、重复投递、已读不等于批准都要服务端识别。

### 2.3 对 Codex 引用的核验

| Codex 主张 | 核验结果 |
|---|---|
| 回叫引擎负责持久化待投递、去重、升级链 | [ok] `callback/engine.ts` L2、L51、L173–206 属实 |
| 调度器负责确认超时与任务老化 | [ok] `live/scheduler.ts` L1–7、L59–182 属实 |
| 11 规范"渠道只是 transport,账本是真相" | [ok] `docs/11-ui-spec.md` L29 原文第 10 条 |
| "已有适合承接这个方向的基础" | [warn] 对出站成立;对入站不成立。daemon 没有文字轮次 API,05 L91 把文字通道定为 P0 非目标、P1 再开 |
| SMTP 无秒级送达承诺、有重复投递 | [ok] 与 RFC 5321 语义一致,也与 04 §4 30s 应答窗、resolution-timeout 冲突,结论一致 |

## 3. 交叉比对

### 3.1 一致点(两方独立得出)

1. 邮件不替代 SayDo 内核:outbox、升级链、超时、重试、审批、审计仍由 daemon 持有。
2. 出站告知与结果汇报是邮件最合适的场景。
3. 已读不等于 ack,更不等于批准;需要强认证的操作由邮件链接引导进已认证界面。
4. 先接用户现有邮箱,不自建 IMAP/SMTP 服务。
5. 实时语音、流式进度、打断执行不适合邮件。
6. 过期回复(任务已改版)、重复投递、网页已处理但邮箱旧通知仍在,都要服务端处理。

### 3.2 分歧与裁决

**分歧 1:邮件的定位。** Codex 主张"一等交互入口";Fable 主张"出站通道优先,入站限 ack/snooze/拒绝"。

裁决:两者都对,只是时间不同。Codex 描述的产品价值真实存在,邮箱自带搜索、附件、归档、多设备同步,
一条任务线程就是一段异步工作流。但它依赖文字轮次通道,而这条通道在 05 路线图里明确是 P1 才开,
daemon 现在也没有对应入口。因此拆成阶段 A(出站,现在可做)与阶段 B(入站,跟随 P1 文字通道)。
阶段 B 的入站范围不必像 Fable 最初说的那样只剩 ack/snooze,可以承载提交任务与回答澄清,
但它只能是弱认证来源,封顶与语音同级,且不能作为任何 approval 的 `decidedVia`。

**分歧 2:入站是否安全。** Fable 强调注入面;Codex 只提"身份校验"。

裁决:两者都需要。单用户产品下,发件人白名单 + DKIM 通过 + 每线程一次性 token(plus-addressing 或
`In-Reply-To` 绑定)构成最低身份门槛,但 From 可伪造、邮箱可被接管,所以它的认证强度只能对齐 voice 档,
不进入 09 §3 矩阵作 approval 来源。邮件正文进入对话上下文时按同一 dialog 入口处理,不绕过 M0 与 redactor。
若要让 `decidedVia` 出现 `email`,必须先改 09 §3 词表与 DDL CHECK,并且只能映射到 ≤S1。

**分歧 3:标准化层次。** Codex 提 HTTPS 接口 + CloudEvents 给硬件与程序;Fable 提 Web Push 与 CalDAV。

裁决:互补,不冲突,分别记为独立候选。CloudEvents 只作对外事件封套,不改 09 内部合同,排 P2 且需要真实的
第三方接入需求才立项。Web Push(RFC 8030 / VAPID)是"无 app 的标准通知"里最贴的候选,可与邮件并列为 L1
传输。CalDAV free/busy 与本题无关,但能给 `micHeldByMeeting`(04 §4 注记:无数据源,恒 false)提供数据源,
作为副产记录。

### 3.3 各自遗漏

Codex 遗漏:
- 文字轮次通道是 P0 非目标、P1 再开,入站闭环不可当前排产。
- 09 §3 `decidedVia` 词表被 DDL CHECK 锁死,新来源要改合同。
- ntfy.sh 公网 topic 明文可订阅的隐私问题,以及 ntfy 渲染已经必经 redactor,邮件同样必经。
- attention 账本"一处处理全网作废"对邮件只能做到"链接打开时已处理",邮箱里的旧邮件无法撤回,
  只能靠线程内后续邮件覆盖。

Fable 遗漏:
- 邮件线程可以承载完整异步工作流与附件,这是产品价值而不只是通道替换。
- 硬件与第三方程序需要的是 HTTPS 操作接口 + 事件订阅,邮件不是它们的接口。
- 两种邮件方案(接现有邮箱 vs 自建 IMAP/SMTP)成本差异需要显式写出。

## 4. 终稿建议

### 4.1 阶段 A:邮件作 L1 出站通道(可排小批)

范围:
- 在 `SweepDeps` 增加 `email` 投递对象,与 `desktop`、`ntfy` 并列;L1 与 DND 路径同构接线。
- 走用户现有邮箱的 SMTP submission(587/STARTTLS 或 465);凭据经 `/api/setup/secret` 落 OS 机密存储,
  不进环境变量明文,不进 Git。
- 每个任务一条线程:首封邮件的 `Message-ID` 记入 outbox 行,后续同 task 邮件带 `In-Reply-To` / `References`。
- 正文固定话术按 10 §1 状态词;标题与阻塞原因经 `redactText`;深链只带路由不带 token(沿用 ntfy 红线)。
- 事件粒度:只发 ready_for_review / blocked / failed / approval_request,progress 默认不发;
  可选每日摘要(依赖 P1 回叫聚合,先不做)。
- ack 仍走深链回控制台;不做 IMAP 收信。
- 与 ntfy 的关系:并列可选,任一配置即启用;两者都未配置时 L1 只剩桌面通知并 warn。

合同改动(先改 canonical 再改代码):
- 04 §4 升级链:L1 = 桌面通知 + ntfy / 邮件(可选其一或并存)。
- 07 D11:补"邮件 = L1 可选出站通道,走用户现有 SMTP,不自建服务"。
- 09 §6.3 outbox 行增加 `thread_message_id`(可空,additive 迁移)。
- `docs/modules/c-control-bridge.md` C4 依赖行补 email。

验收:
- 单测:渲染经 redactor、线程头正确、DND 路径只发一次、投递失败不写 notified(沿用 sweep 既有断言)。
- 实测:用临时邮箱账户真实发送一封 ready_for_review,客户端能看到线程并点深链到达任务详情。

### 4.2 阶段 B:邮件回复作输入(跟随 P1 文字轮次通道)

前置:daemon 先有文字轮次通道(05 L91 P1 项),邮件只是它的一个 adapter。

范围:
- IMAP IDLE 或轮询收信;只接受发件人白名单 + DKIM 通过 + `In-Reply-To` 命中已知线程或带一次性 token 的信。
- `Message-ID` 作幂等键,重复投递不重复执行;回复时对账线程绑定的 `packageRevision`,过期回复进提示而不执行。
- 回复正文进入与控制台文字输入同一条 dialog 入口;来源标记为弱认证,封顶与 voice 同级。
- 邮件永不作为 S2/S3 的 `decidedVia`;S2+ 一律由邮件链接引导进已认证界面。
- 新任务提交:标题 + 正文映射到 project 开口即建 draft(08 R11),再走既有采访/决策包流程。

### 4.3 不做

- SayDo 自己提供 IMAP/SMTP 服务。
- 邮件替代语音回叫 L0、PushKit/CallKit 来电式汇报。
- 邮件承担任何 S2/S3 审批。
- 邮件替代 outbox、升级计时、DND、老化等内部调度。

### 4.4 并行候选(各自独立裁决,不与本题捆绑)

| 候选 | 解决什么 | 建议 |
|---|---|---|
| Web Push(RFC 8030 / VAPID) | 浏览器标准通知,无需 ntfy app,覆盖桌面与 iOS 主屏 PWA 的纯通知 | 与邮件并列为 L1 传输候选;P1 评估 |
| CalDAV free/busy | `micHeldByMeeting` 数据源 | 04 §4 注记的真空位;独立小批 |
| HTTPS 操作接口 + 事件订阅,封套可用 CloudEvents | 硬件与第三方程序接入 | P2,有真实接入需求再立项;不改 09 内部合同 |

## 5. 请 owner 决定

1. 是否批准阶段 A 进入排产候选(改 04 §4 / 07 D11 / 09 §6.3 后导入 PLAN-2)。
2. 阶段 A 中邮件与 ntfy 的关系:并列可选(建议),还是邮件替代 ntfy 作默认 L1。
3. 阶段 B 是否作为 P1 文字轮次通道的一部分登记,还是等阶段 A 用过再议。
4. Web Push 与 CalDAV 是否各自开独立候选。

## 6. 局限与未做

- 两方均为静态阅读,未修改代码、未运行 daemon、未做任何投递实测。
- 未评估具体 SMTP 库选型与 Windows 下机密存储形态(工程 ADR-003 适配层范围)。
- 未与 `docs/plan/IMPLEMENTATION-PLAN-2.md` 当前串行链对排期,只判断了可排性。
