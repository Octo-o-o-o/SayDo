# 模块详设 E · 横切域(E1–E3)

> **性质**:实施视角详设 + 核对索引,细化 [08](../08-module-design.md) §2 E 域。合同真相源 = [09 §11](../09-data-contracts.md)(ModelBinding/校验规则/配置)、[07 D18](../07-tech-stack-decisions.md)(BYOA 政策)、[04 §5](../04-key-mechanisms.md)(风险);本文引用不复制,冲突时 canonical 胜。

## E1 · Provider 抽象(ModelProviders)

- **职责**:五槽位模型供给(dialog/thinking/cheap/evaluator/dev)+ ASR/TTS 供应商抽象;统一超时/重试/降级;用量事件供 C8。**不做**:槽位约束裁决(校验器在配置层,09 §11 校验规则 1–6)、把 BYOA 用于对话档(已判死,07 D18 结案表)。
- **接口面**:`ModelBinding` 四形态(09 §11:api 简写/api+via 命名端点/codex_cli/claude_cli/cursor_cli 档位词表);`[providers.api.<name>]`(base_url/api_key env 引用/family 规则:前缀表优先、网关端点必须省略端点级 family);`buildCageArgv()` 三档笼参数集(09 §12-9 快照);invocation 审计记录(07 D18)。
- **设计要点**:① BYOA 笼子:无状态一发一收(砍 resume)、tripwire(tool_call ⇒ 作废+审计)、observedModel 族断言**按 09 §11 规则 2 分档**(api/cursor 严格——api 响应体 model 字段同断言,**官方直连缺字段同样作废**,2026-07-24 严格口径;codex/claude 恒定族缺失豁免、有值仍校验,工程 ADR-002——Codex 14 横切-4 统一引用);② cursor 独立 raw NDJSON parser(六类 golden,未知事件作废 fail-closed);③ 限流 = fail-fast + billing-switch 一次性收据,无收据不产生 api 计费行,禁跨计费源静默降级;④ 改造自 OctoDesk `engines/bridge/` 四层拆(core 可搬,spawn/discovery 重写,1.2b);⑤ ASR/TTS:doubao v3 双向流式(07 D5)+ 可换 provider + 本地兜底链。
- **依赖**:配置(09 §11 校验规则 1–6)、`~/.saydo/.env`(key);被 A3/A5/B3/C6/A1 消费。
- **失效与恢复**:探测失败拒启动(处方化报错一次列全);运行中单请求失败按槽位重试策略,不静默换供给。
- **验证归属**:§12-9 全绿(异族/双开关/family 冲突/argv 快照/tripwire/限流收据竞态/深评律/TOML 模板解析)。
- **分期与开放项**:P0(1.2 provider + 1.2b BYOA);acp 供给 P1。开放:cursor_sdk(API key)后续优化档。

## E2 · 安全策略引擎(PolicyEngine)

- **职责**:effect-based 风险计算(S0–S3 = effect × 目标 × 数据敏感度 × 身份 × 下游触发 × 成本)+ 效果升级规则(.env/客户数据升 S2+、postinstall/CI 触发升 S2/S3)+ verify 白名单校验 + `EffectClass` 预授权清单推导(从计划,带约束参数,Brain 不得自由声明)。**不做**:按动作名硬编码风险(03 §2 明令)、审批流程(C5)。
- **接口面**:分级表与升级规则 04 §5.1;**双维语义**(04 §5.1,X3):effect 维与 Hopper content-risk 维取交集互不替代,content=low 不减免 effect 闸门;路径二 P0 红线 = 只允许 S0/S1(04 §5.4);预授权清单纪律(无约束参数不可预授权、>3 项强制屏幕同显、每包重新生成);spokenForm 渲染(10 #39,E2 签名件,Brain 不自由造句)。
- **设计要点**:① 计算输入是 effect 描述对象(不是命令字符串正则);② verify 白名单:只认登记模板(package_script/justfile),Brain 只能选不能拼(04 §5.3);③ 与 C2 的执行点复验共享同一判定函数(单实现防漂移)。
- **依赖**:项目配置(protected 分支/verify 登记);被 A6/C1/C2/C5 消费。
- **验证归属**:§12-2 预授权反例全套 + 3.4(效果升级测试)+ 04 §5.4 反例集(P0.5-B 对接验收项)。
- **分期**:P0(3.4);EffectGrant 全链 P0.5-C。

## E3 · 审计与可观测(Audit/Obs)

- **职责**:结构化日志(JSONL)+ `audit_log` 审计 sink(敏感 payload 不记原文,记 digest)+ 关键横切事件(Gate 0 状态、dev profile 横幅、BYOA invocation、billing-switch、canary 触发)。**不做**:P0 指标面板(P1)、把日志当审计(两条流分开:日志可轮转,审计不可变)。
- **接口面**:`audit_log` DDL(09 §9);invocation 记录字段集(07 D18);日志风格 = 11 §8(纯文本标记 `[ok]/[warn]/[fail]`,**禁 pictographic 字符**,NO_COLOR 约定)。
- **设计要点**:① 审计事件是安全合同的一部分(tripwire/作废/拒启动都必须落痕,复评 B7);② 隐私:转写原文/密钥值永不进日志,引用用 digest/turn_ref;③ 每条审计带 actor(owner/brain/daemon/bridge)。④ **背压隔离(GAP-02 2.8)**:普通日志机器流是有界队列 + 异步写,ENOSPC/EACCES 等写失败与队列溢出只计数并降级(丢弃普通日志、`Logger.health()` 暴露 `degraded/writeFailures/dropped`,`GET /readyz` 以 `loggerDegraded` 上报),不冒进业务调用栈;审计 sink 保持同步写且失败 fail-closed(抛 `AuditWriteError` 给调用方,可挂失败钩子让其可见),**日志可降级、审计不可**。
- **依赖**:被全部模块调用(唯一全局依赖方向,08 §3)。
- **验证归属**:随各安全测试断言审计痕(§12-9/-10 的"+审计"从句);0.1(日志底座随脚手架)。
- **分期**:P0 日志+审计 / P1 指标。
