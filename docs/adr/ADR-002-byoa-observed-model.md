# ADR-002(工程)· BYOA observedModel 断言按 provider 分档(恒定族豁免)

- 状态:已定(2026-07-24,计划 1.2b);**2026-07-25 owner 批复收窄改写(见文末附则)——本文决策表与
  "回写与攒批"节的旧宽松措辞已 superseded,冲突一律以附则(SoT = 09 §11 规则 2)为准**
- 依据:09 §11 规则 2 + 07 D18 纪律 2;真实 CLI spike 实测

## 背景(spike 实测,2026-07-24)

- `codex exec --json` 事件流 = `thread.started / turn.started / item.completed(item.type=agent_message,text) / turn.completed(usage)`,**流内无 model 字段**;
- `cursor-agent -p --output-format stream-json`:model 在 **`system.init` 事件顶层**(不在 assistant),值为人类可读显示名(如 `Fable 5 300K Max No Thinking`);
- 09 §11 规则 2 字面要求"BYOA 取流内 observedModel,缺失即作废"——对 codex 严格执行 = codex_cli 永久不可用(dev 机缺省 evaluator/thinking 就是 codex/cursor 订阅)。

## 决策

observedModel 运行时断言按 provider 分档(安全等价细化,非放宽):

| provider | 族来源 | observedModel 缺失 | 有 observedModel |
|---|---|---|---|
| `codex_cli` / `claude_cli` | **provider 二进制恒定**(canonical familyOf:codex→GPT,claude→Claude) | 不作废(族已锁,无谎报面) | 仍校验族,不符即作废(改写检测保留) |
| `cursor_cli` | 族随所选模型参数 | 作废(observed_model_missing) | 校验族 |
| `api`(含命名端点) | 配置声明 + 网关回显 | 作废(owner 严格口径,不放宽) | 校验族 |

安全论证:observedModel 断言目的是**防 family 谎报**。codex_cli/claude_cli 的族由二进制供给锁死(跑 codex 就是 GPT,跑 claude 就是 Claude),不存在"配置谎报 family"攻击面;tripwire(tool_call 即作废)+ 笼 argv(read-only/tool-deny)独立防笼破。故恒定族 provider 缺 observedModel 不削弱安全。owner 的"严格口径不放宽"上下文是 **api 官方直连缺响应体 model**(有谎报面),本决策不触碰该口径。

## 验证(真实冒烟,packages/daemon/test/byoa-smoke.mjs)

- codex(gpt-5.6-luna,write-sandbox 笼):"能听到。" ok,toolCalls=0,未作废;
- cursor(claude-fable-5-max,ask+tripwire 笼):ok,observedModel="Fable 5 300K Max No Thinking",`fable` 前缀命中 claude 族,断言通过;
- claude:未登录,顺延订阅购入(计划 v2.3①,不阻塞;族恒定 claude,接入即用)。

## 已知脆弱点(记录,后续观察)

- cursor observedModel 是**显示名**非 slug——前缀表靠 `fable`/`gpt`/`luna` 命中。若 cursor 改显示名格式且不以已知前缀开头,会误作废(fail-closed 方向,安全但可用性受损)。缓解:familyFromModelName 前缀表随实测扩;cursor_cli 族其实也可由所选 `--model` 参数恒定推断(fable→claude),P1 可把 cursor 也纳入"参数恒定族"降低对显示名的依赖。

## 回写与攒批(**旧宽松措辞,已 superseded——按文末附则/09 §11 规则 2 收窄版执行,勿照此节核对 09**)

- 09 §11 规则 2 需补一句"BYOA 恒定族 provider(codex_cli/claude_cli)流内无 model 时依 provider 恒定族,不作废;cursor_cli/api 维持严格"——已登记,随 Phase 1 末 canonical 回写批次走一致性 subagent + Codex,并在下次 owner 汇报点复核本 ADR。

## owner 裁定(2026-07-25):dev 期只用 cursor,豁免暂不启用

owner 决定开发调试期只用 cursor_cli 一家:思考=cursor `sonnet-4.5-thinking`(Claude 族)、评估=cursor `gpt-5`(GPT 族),
一家两族满足异族;dialog/cheap 走 OpenRouter。实测 cursor stream-json 的 `system.init` 带 model 字段
(`"model":"gpt-5"` / `"model":"sonnet-4.5-thinking"`),故 cursor_cli 的 observedModel 严格口径天然满足、不放宽
——ADR-002 恒定族豁免在 dev 期不激活。豁免逻辑保留在 consume.ts(familyFixed),仅供未来 claude_cli/claude_sdk
接入时若流无 model 字段复用(届时实测再定);对 cursor_cli/api 严格口径完全不放宽。
owner ~/.saydo/config.toml 已改(evaluator=cursor gpt-5,解析校验 ok/devMode=true,异族 gemini/claude/gpt)。

## 附则(2026-07-25,owner 批复:收窄改写;SoT = `docs/09-data-contracts.md` §11 规则 2)

本 ADR 决策表中"codex_cli/claude_cli 缺失不作废(族已锁,无谎报面)"一行,经五路对抗面板复核
(Codex 15 Q2 实测勘误:cage 返回裸名、runner 走 PATH,PATH shim/同名替换可冒充二进制——
**"二进制锁族=零谎报面"在无身份核验时不成立**),owner 2026-07-25 批复按收窄条款执行,09 §11 规则 2 为唯一 SoT:

1. **豁免仅限封闭枚举** `{codex_cli, claude_cli}`;扩名单 = canonical 变更,须上浮 owner;
2. **豁免生效前提 = 可执行文件身份核验通过**:调用前解析到**预登记的绝对路径**且内容 digest 与登记一致
   (裸名走 PATH 不满足);任一核验缺失/漂移/失败 ⇒ 缺失一律按 `observed_model_missing` 作废 + 审计;
3. **豁免实际生效的每次调用必落 invocation 标记 `observed_model_exempted=true`**
   (cursor_cli/api 路径出现该标记 = bug,09 §12-9 反例断言恒不出现);流内若有 model 仍校验族(改写检测);
4. **当前状态:豁免休眠**——dev 仅用 cursor(流内有 model,严格口径天然满足),且身份核验链未实现,
   故豁免不可启用;**身份核验链本接线批不实现**(2026-07-25 接线批确认),claude_cli 接入时随核验一并实施
   并**再次上浮 owner,不自决启用**。

本决策表原文保留作历史记录;与本附则冲突处以附则(即 09 §11 规则 2)为准。
