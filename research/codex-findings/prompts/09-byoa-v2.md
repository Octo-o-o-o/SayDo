你是严格的技术评审员。SayDo(语音高级助手,设计库 /Users/wangyixiao/WorkSpace/voice-coding/)的"BYOA 模型供给"设计(07 D18 / 09 §11)在 2026-07-23 下午做了第二轮修订,请对**修订后全量设计**做对抗性复评(上一轮复评进程中断未产出,本轮覆盖其全部范围 + 新增改动)。

评审对象(以文件现状为准):
1. docs/07-tech-stack-decisions.md D18 节:槽位矩阵、**对话档 BYOA 判死结案表(新)**、**本机开发 profile(新)**、OctoDesk 复用路径(含 **cursor_cli 适配注意项,新**)、四条纪律 + 刻意不做
2. docs/09-data-contracts.md §11:ModelBinding(**新增 cursor_cli 与 api via 命名端点**)、5 条校验规则(**规则 1 增 profile="dev" 放宽;规则 2 增 family 显式声明;规则 4 增 cursor 笼**)、§12-9 契约测试扩充
3. templates/saydo.config.example.toml:**[providers.api.*] 命名端点(新)**、**dev profile 参考块(新)**、[hopper] 锁定点回填
4. IMPLEMENTATION-PLAN.md v2.2 变更行、Phase -1 A⑤、1.2b 行

本轮新改动的背景事实(均 2026-07-23 本机一手实测,可自行复测):
- 对话档 BYOA 判死数据:codex exec(luna,low)13–21s/轮、(luna,max)~17s/轮、exec resume 第二轮 17.7s(无收益);cursor-agent -p(fable-5-max)~18s/轮、(thinking-max)~23s、流式首 token 17.6s、create-chat+--resume 第二轮 78.8s(含一次网络重试)
- codex v0.145 reasoning effort 服务端词表:none/minimal/low/medium/high/xhigh/max(非法值 400)——09 旧注"无 max"已更正
- cursor-agent 2026.07.20:有 -p/--mode ask/--trust/--output-format stream-json/--resume/create-chat;非受信目录不加 --trust 会挂起;无"工具零集"参数

重点核对(A–F 沿上轮,G–J 新增):
A. 笼子有效性:codex -s read-only 挡什么;claude --tools "" allow 式;评估器"只读证据账本不读 Brain 自辩"在 BYOA 下是否被击穿
B. 评估档调用频率与订阅时窗挤兑(04 §2.2 分层后"低频"是否成立)
C. 成本契约:source='subscription' known=0 与"unknown 永不显示为 0"、maxCost 熔断兼容性
D. 降级链 agent_cli→api 的确认语义(限流停下询问,绝不静默转计费)是否闭合
E. OctoDesk 四件套移植工作量与依赖传染(实读 /Users/wangyixiao/WorkSpace/OctoDesk/electron/services/engines/bridge/)
F. 模板缺省对"无订阅只有 1 个 key"新用户的失败路径(处方化报错是否可达)
G. **profile="dev" 是否构成安全后门**:放宽面是否真的只有 evaluator 供给白名单一条;横幅+审计是否足以防"dev 配置漂到生产";要不要加"dev 下禁 route=hopper dispatch"之类的硬约束?
H. **cursor_cli 笼等级**:--mode ask 只读但可读盘、无零工具旗标——评估档 dev 放宽下,tripwire(tool_call 即作废)对"读 ~/.saydo/ 转写"类破笼是否可观测(ask 模式读文件是否产生可检测的 tool_call 事件?实测 cursor-agent --output-format stream-json 的事件形状)?若不可观测,dev 放宽的诚实声明是否足够?
I. **[providers.api.*] 命名端点**:family 显式声明 + 前缀表的解析顺序是否有绕过异族校验的组合(比如 family 谎报)?observedModel 二次断言对三方端点是否仍有效(三方网关常改写模型名)?
J. **对话档判死的结论稳健性**:每轮 13–23s 的瓶颈归因(服务端 agent-loop 初始化)是否成立;有没有被忽略的低延迟通道(如 codex proto/app-server 常驻模式)值得在矩阵里标注为未来选项而非一刀切?

输出格式:① 总评(Go/Conditional/No-Go);② A 级(错误/安全)/ B 级(缺口)/ C 级(建议)问题清单,每条:文件+位置+证据(命令输出或文件:行)+改法;③ 你实测确认的三份笼子 argv(codex/claude/cursor 各一条,标注哪些旗标你验证过哪些没有);④ 一句话:修订后的 BYOA 设计该不该进 P0。
