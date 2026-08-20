# Codex 攒批评审 13:canonical 回写批 2(外部评审 M1-M11 文档侧)

> 模型:gpt-5.6-sol,effort=max(13 全量,25min 超时截断)→ effort=high 聚焦复核(13b,完整输出)。
> prompt:`prompts/13-canonical-writeback-m-batch.md` + `prompts/13b-m-batch-focused.md`;日志同目录 logs/。
> 结论:**No-Go(3A+7B)→ 全部按最小改法回修(2026-07-25 同日)→ Go**。

## 发现与 triage(全采纳)

| # | 级 | 位置 | 问题 | 回修 |
|---|---|---|---|---|
| 1 | A | 09 §9 ↔ §11-5 | 订阅 llm 行 meta 形状矛盾(四 usage 键 vs {provider,plan_window,requests}) | §11-5 改为并集(四键+provider/requests;CLI 无 usage 记 0+usage_unavailable);ledger.ts 订阅行强制 subscription meta |
| 2 | A | 09 §0.1 ↔ §5 | prefixDigest 被 §0.1 写进签名域,与"派生值排除"自相矛盾 | §0.1 明确 slices 只签 tier/refs/tokens/segment/form;§5 注释同步(实现本就排除,文档对齐) |
| 3 | A | 10 §2.5-5 | 匹配细则还是旧"邻接防护"版,与 A1 定稿封闭文法不一致 | 重写第 5 条:疑问句护栏/否定任意位置子串 reject/肯定=整句封闭匹配 |
| 4 | B | 09 §11-4 | invocation 记录无 routed_provider(M2 未闭合) | 字段拆 configured/routed(无回显记 unknown);SayDo dialog 环补 invocation.dialog 审计行 |
| 5 | B | 09 §12 | M1 拆表无 P0 测试条目 | §12-4 增快照拆表条(内容幂等/同毫秒各记/跨会话/rebuild/篡改失败) |
| 6 | B | 10 §2.5-6 | (与 3 同源)golden/状态机需引用同一词表 | 随 3 回写;实现本就单源(confirmVocab) |
| 7 | B | 09 §1/§11 | audio_retention_days 双源([privacy] 与 [params]) | 唯一 owner=[privacy];params 删键;PARAM_DEFAULTS 同步删;§1 注释指向 privacy |
| 8 | B | 09 §9 | kind 词表口径漂移('llm' vs 实际 llm.dialog/asr.seconds/tts.chars) | 定前缀词表 llm.<slot>/asr.seconds/tts.chars/hopper.run;M4/M9 注释同步 |
| 9 | B | 09 §9 ↔ §12 | "§12 断言 cached<=input"是空头注释(§12 无该条) | §12-4 补成本条目(四键必填/cached<=input/非法 kind 反例) |
| 10 | B | 09 §11 [params] ↔ §12-9 | M8 新键无契约断言(low<high/非负/覆盖边界) | §12-9 补断言条;SayDo assertParamSanity 启动 fail-closed |

## 交叉记录

- 同日 code-review subagent(SayDo 实现侧)独立发现 3A+6B,含 confirmVocab 误放行(A1,与本批 #3 同源双向印证)、
  静态服务路径穿越、/dev GET 绕身份门、M3 跨进程时钟混算——全部已修(SayDo `e8e9876`)。
- 一致性 subagent(915be816)结果未及本轮回收,其审查面与 Codex 13b 重叠,结论以 Codex 为准。
