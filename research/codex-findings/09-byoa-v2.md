# 09 · BYOA v2 对抗性复评(Codex)+ triage 记录

- **评审器**:`codex exec -m gpt-5.6-luna -c model_reasoning_effort=max -s read-only`,54 分钟,2026-07-23 15:42–16:36;全文日志 `logs/09-byoa.log`(2.3MB),prompt `prompts/09-byoa-v2.md`。
- **评审对象**:07 D18(v2:对话档判死/本机 dev profile/cursor_cli/三方端点)、09 §11/§12-9、两份模板、计划 v2.2。
- **总评(评审原话)**:**No-Go**——"修订方向基本正确……但当前设计仍有 5 个 A 级闭环缺口"。
- **triage 结论(主会话,2026-07-23 16:40–17:00)**:A1–A5 与 B1–B9 **全部当轮设计级回修完毕**(落点见下表);其中两条 A 级的"实测失败"证据判定为**复评自身沙箱伪证**(见文末)。回修后状态:**设计基线放行,实现义务已挂 0.4/1.2b 验收**。

## A 级 triage

| # | 评审意见 | 裁决 | 回修落点 |
|---|---|---|---|
| A1 | `profile="dev"` 是可漂移的安全后门;要求 dev evaluator 非权威化、硬禁 dispatch | **部分采纳**。定位澄清:dev 放宽的是防错链(评估独立性),不是审批安全链(Gate 0/S3/收据/预授权反例全部不动)——"后门"定性过重;但**防漂移诉求成立** | 07 D18 dev 段 + 09 §11-1:**双开关**(config `profile="dev"` ∧ env `SAYDO_DEV=1`,单开关按 default 拒);readiness 落 `evaluator_isolation="unproven"` 标记;invocation 记录含生效 profile;§12-9 加单开关拒启动断言。不采纳"非权威化/禁 dispatch"——会使 dev 机无法联调完整闭环,且评估是质量门不是权限门 |
| A2 | codex 笼不是读隔离,勿称"证据只读笼";其带笼实测在 app-server 初始化即失败 | **采纳表述修正;实测失败为伪证**(其沙箱内嵌套调用被拒;本机直跑当日多次成功出真实模型输出)。设计本就声明 codex 限写不限读、评估档缺省禁 | 07 D18 纪律 1 改为**三档能力表**(claude=tool-deny 可证 / codex=write-sandbox 限写不限读 / cursor=ask+tripwire 检测型,不再统称"纯推理笼");09 §11-4 codex 行同步"读盘不可挡" |
| A3 | cursor tripwire 事后检测太晚;OctoDesk StreamJsonParser 识别 claude `tool_use`,不识别 cursor 顶层 `tool_call`,可能漏事件 | **采纳**(parser 不同型是硬事实;tripwire=检测非防止本就是缺省禁 cursor 评估档的理由,dev 下自担) | 07 实现路径 + 09 §11-4:cursor **独立 raw NDJSON parser**(顶层 tool_call started/completed;未知事件/解析失败一律作废 fail-closed);1.2b 验收加六类 golden fixtures(读/写/shell/MCP/未知/解析异常) |
| A4 | `via.family > 前缀表` 允许 family 谎报绕异族;OpenAICompatAdapter 不提取响应 model,observedModel 断言对 api 未实现 | **采纳** | 07 纪律 2 + 09 §11-2 收紧:**前缀表可解析时为准,显式 family 冲突 ⇒ 拒启动**;前缀解析不出才用显式 family;**observedModel 断言对 api 强制**(适配器必须提取响应体 model,缺失/改写/不符作废);§12-9/1.2b 加对应断言与适配器义务 |
| A5 | 限流"确认后切 api"无可执行收据,E1 通用降级可绕过确认 | **采纳** | 07 纪律 3 + 09 §11-5:限流后槽位置 `waiting_confirmation`,确认落**一次性 billing-switch 收据**(绑 session+槽位+端点+有效期,原子单次消费);无收据不得产生 `source='api'` 行;provider 层禁跨计费源自动降级;§12-9 加收据单次消费/过期/竞态不双扣测试 |

## B 级 triage(全部采纳,轻重不一)

| # | 意见 | 落点 |
|---|---|---|
| B1 | "低频"是口径非机制 | 09 §11 新增规则 6:深评按 `(sessionId,evidenceDigest,trigger)` 去重 + `[params].evaluator_deep_review_max_per_session=3` + 冷却 60s + 与 Tier1 并发预检 |
| B2 | cost_entries 无 DDL CHECK | §9 DDL 加 `known/source` CHECK + 订阅行恒 `known=0 ∧ amount IS NULL` 组合 CHECK |
| B3 | OctoDesk 迁移低估(40 文件;spawnSupport/agentDiscovery Electron 传染;discovery 把 cursor 映射为 ACP) | 07 实现路径 + 1.2b:按"core/适配器/安全策略/探测"四层拆,只搬前两层;维持 2.5 天并列滚动重估点 |
| B4 | cursor 探测非机器可读(`status` 无 --json;沙箱 keychain `-50`) | 09 §11-3:cursor 探测 = status(人读)+ **真实 `-p` smoke** + keychain/未登录错误分类处方化。注:`-50` 在本机非沙箱环境未复现,cursor 实际已登录可用 |
| B5 | 主模板 dev 块取消注释 ⇒ TOML 重复声明 `[models]` 报错 | **新建独立完整模板 `templates/saydo.config.dev.example.toml`**(tomllib 解析验证通过);主模板 dev 块改为指路注释;§12-9 加两模板解析+effective binding 断言 |
| B6 | "无订阅仅 1 key"失败路径无 fixture;env 模板"Codex/Cursor 属 P1"与 D18 口径混淆 | env 模板改写(区分"执行后端 P1"与"BYOA 供给 P0 零 key")+ 补三方 key 示例;§12-9/0.4 加"仅 1 key"启动 fixture(一次列全+修复行) |
| B7 | 审计字段不足以证明 dev 无漂移 | 07 纪律 1 + 09 §11-4:**不可变 invocation 记录**(profile/provider/argv digest/cwd/笼档/observedModel/tool 计数/证据 digest) |
| B8 | "服务端 agent-loop 初始化"归因过强 | 07 spike 结案改为"当前 CLI 一发一收通道不适合对话档"(不下瓶颈断言);常驻协议(codex app-server/Cursor SDK/ACP)保留为未来矩阵候选行,进入门槛=首 token/p95/取消/并发/额度/隔离六项实测 |
| B9 | `reasoning="max"` 未映射进 canonical argv | 09 §11-4 codex argv 加 `[-c model_reasoning_effort=<reasoning>]`;快照测试含该映射 |

C 级三条(笼分档改名/golden fixtures/常驻候选行)已分别并入 A2/A3/B8 的回修。

## 环境伪证说明(重要,防后续误读)

复评运行在 codex 只读沙箱内,其**嵌套调用**外部 CLI 受限,由此产生两条不成立的"实测失败"证据:

1. `cursor-agent … ERROR: SecItemCopyMatching failed -50`——沙箱无 keychain 访问权。**本机直跑事实(2026-07-23,主会话)**:`cursor-agent -p --trust --mode ask --model claude-fable-5-max` 多次成功返回真实模型输出(~18s/次),登录态正常。
2. `codex … failed to initialize in-process app-server client: Operation not permitted`——同因。**本机直跑事实**:`codex exec -m gpt-5.6-luna -c model_reasoning_effort=max` 成功(16.9s),`model_reasoning_effort=bogus` 得到服务端 400 与合法词表 `none/minimal/low/medium/high/xhigh/max`。

其"claude 本机未登录(loggedIn:false)"为真(与 Phase -1 A⑤ 记录一致)。

## 三份笼 argv(评审确认版,验证范围如其声明)

见日志 §③ 原文:codex/claude 旗标全部经 `--help` 核verified;claude 初始化事件实测 `tools:[]`/`mcp_servers:[]`/`permissionMode:"dontAsk"`;cursor 旗标经 help 核实、真实事件流待 1.2b golden(A3 落点)。

## 一句话(评审原话 → 回修后)

评审:"修订后的 BYOA 设计不应按当前形态进入 P0;先关闭上述 A 级问题。" → **A 级五项已当轮全部设计级关闭**(本文件与 07/09/模板/计划的对应改动即关闭证据),实现期义务落 0.4/1.2b 验收;设计基线放行。
