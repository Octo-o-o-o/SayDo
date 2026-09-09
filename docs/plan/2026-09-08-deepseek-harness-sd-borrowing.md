# SayDo:从 deepseek-harness 借鉴的增量改进建议(SD-1/2/3)

> 状态注(2026-09-09,Fable 核验后回写):本文是 owner 于 2026-09-08 提供的独立可读建议稿(原稿由另一会话产出,
> 内嵌夹具与定位信息)。同日 Fable 会话按「review 后实施保留项」授权,在 main `25a9924` 基线上核验并实施了
> SD-1/SD-2/SD-3 三项,候选在独立 worktree `../SayDo-wt-sd-borrow`(分支 `sd-harness-borrow`,未提交);
> 过程与门禁记录见 `history/PROCESS-JOURNAL.md` R141。下表是核验结论,**已核验无价值/已满足的条目不必再复查**。
>
> | 条目 | 核验结论(2026-09-09) | 依据 |
> |---|---|---|
> | SD-1 承诺绑定实际结果 | **仍成立 → 已实施(候选)**。API 与 CLI 两出口共用 `LedgerActionRecord` 结果视图;failed/unknown 由系统句呈现,部分成功分开说 | `packages/daemon/src/brain/dialogLoop.ts`;测试 `test/dialog-loop.test.ts` SD-1 组 |
> | SD-2 记忆信任由系统确认 | **仍成立 → 已实施(候选)**。`user_approved` 任何入口不可自报;M0 走 confirm 环 `kind=memory`,`memory/m0Confirm.ts` 消费;canonical 09 §4/§13、b-memory、10 #36b 已同步 | `test/memory-m0-confirm.test.ts`;e2e `live-wiring` SD-2 全链 |
> | SD-3 配置执行器按能力分类 | **仍成立 → 已实施(候选)**。删 `PKG_EXEC_S1_TOOLS`;package-script/exec/本地 go·cargo·poetry run 归 S2;canonical 04 §5.1/§5.4、10 #14、golden c14b 同步;阳性对照测试落地 | `packages/daemon/src/tier1/cmdEffect.ts`;`test/tier1-cmd-effect.test.ts` SD-3 组 |
> | 「明确不提的改进」四条(settle/outbox 重做、Cordis/子代理/MCP、全请求日志重建/LLM compaction/新知识层、golden 数量替代真实语音) | **核验同意:无价值,不再复查**。settle/outbox 现有实现与测试完整;MCP/子代理与 Gate 0 收缩方向冲突;compaction/gist 无失真证据(与统一方案 CONTEXT-01 结论一致);golden 数量不是可靠性替代 | 同 08-13 评估 C 项与统一方案 §4/§5 |
> | verify 冻结闭包不含间接 import | **限制仍在,本轮不做**。`enumerateConfigClosureKeys("node verify.mjs")` 只含 verify.mjs。要解决需单独威胁模型(可信基线 verifier 或隔离执行),不建议仓促上闭包扫描器 | `packages/daemon/src/tier1/verifyFreeze.ts` |
> | 附带发现:`pnpm ls` / `npm view` 归 write_worktree S1 而非 S0 | **方向保守,无价值,不修** | `cmdEffect.ts` PKG_QUERY_S1 |
> | 附带发现:console 确认卡 kind 联合未含 `memory` | **小缺口,有价值**,已列入 2026-09-09 缺口收敛 Prompt | `packages/console/src/components/redesign/types.ts` |
>
> 以下为原稿全文(保留原措辞,含当时的旧根目录路径;行号仅为旧版本提示)。

日期:2026-09-08。状态:独立可读的建议与接续说明。建议正文已经独立 review;本版补齐单文件接续条件,审查版本边界见文末。

## 新会话从这里开始

**只需要本文和当前 SayDo 仓库,即可继续 review;当前用户明确要求 review 后实施时,可按核验结果推进保留项。** 不需要原对话、另外两个项目的建议、总体评分报告、DSH checkout 或旧探针附件。本文是输入材料,不自行产生权限;但不要在用户已明确要求实施时,因历史措辞"不是开工授权"再次要求同一授权。若当前用户只要求 review,则到审查结论停止。

- 项目定位:SayDo 的 Brain 提议动作,daemon 持有记忆、确认与任务状态;语音管线不是权威状态源。M0 是偏好等高信任记忆层,S0–S3 是动作风险层,两者不是同一个分类。
- 路径约定:文中 `~/WorkSpace/SayDo/` 只是审查时旧根目录。新会话所有源码定位与修改都以当前仓库根为准,用该前缀之后的相对路径定位;行号仅为旧版本提示。不要跳回旧工作区施工或 checkout/reset 到历史 SHA。
- 先读当前 `AGENTS.md`、`docs/README.md`、`docs/09-data-contracts.md`、`docs/10-voice-ux-spec.md`、`docs/11-ui-spec.md`、`docs/plan/IMPLEMENTATION-PLAN-2.md` 和 `.octoworkflow/project-profile.md`。它们决定现行合同、排产、隔离与门禁;历史借鉴报告只作可选背景。
- 本文的实测结论指下面列出的历史基线。新会话先检查当前 HEAD/工作树和对应函数,逐项判为"仍成立 / 已修复 / 需修正 / 不适用"。已经修复就记录当前证据并撤掉该项,不能为了照单实施重做功能。
- 每项的输入、旧观察、目标行为、边界均写在本文。所有外部日志、review、DSH 链接只供溯源;缺失不阻止用本项目源码与下方夹具重建实验。它们的旧通过结论不替代新候选验收。

### 接续顺序与交付终点

1. 先核实下面三项,不做无边界全仓扫描。没有新的实质争议,且当前用户已经授权 review 后实施,就继续实施保留项;模型、谁实施及独立验收方式遵守当前项目规则与用户选择,不由本文自动升级为额外编排流程。
2. SD-1 可先独立落地;SD-2 必须先补普通 memory 提议/确认合同,再实现,不能绕过 canonical 前置;SD-3 并入现有 cmdEffect/verify 工作单元。若原 AS-05 编号已变化,按模块和问题合并,不把旧阶段名当硬依赖。三项不扩展到整套 DSH 接入。
3. AS-05 在本文需要保留的含义是:风险取原风险与新下限的较高者,原 S3 不降级;已有参数语义不能被宽泛字符串匹配误伤,例如 commit/am 的 `-n` 与其他命令的 no-commit/dry-run 含义不同;verify 不因提级而解冻。不要求为此补齐无限 shell 语法。
4. 先用项目自己的测试运行时补可失败的回归,再实施并跑受影响的合同/集成测试。测试定位见下文;从当前 package.json/批卡读取实际命令,不能借用另一个项目的 tsx、旧日志的 native ABI 或全局环境。收口执行当前 required gate,不能用本文历史的 220 用例结果代替。原检查入口包括 `scripts/check-emoji.sh`、`scripts/check-doc-links.mjs`、`just ci` 和 Playwright,具体适用范围以当前项目为准。
5. 最终交付逐项裁决、实际 diff、验收输出、未完成条件及维护说明。源码/合同在项目内按当前规范保存;无明确授权不 commit/push、不发布、不改全局配置、不迁移或清洗真实用户记忆。需要真人语音评测或外部条件时先完成可代办部分,保留对应未验状态;不将建议 review 当产品 GREEN。

## 结论与范围

保留三项改进候选:**承诺绑定实际结果、记忆信任由系统确认、收紧可执行配置入口的效果分类**。不重建 SayDo 的执行器、settle、outbox、审批引擎或记忆库,不引入 DSH runtime。

DSH 的启发是"模型可提出动作,事实与权限必须由可检查的系统状态给出"。这不是建议用更多 prompt 教模型诚实,而是修补具体的结果消费与授权边界。

本地基线:SayDo `bcf8ea855f25b177888d9159f75e49214f3dd892`;DSH `67eac41d8788681901915b9f755e9f81d2962a7b`。证据来自本会话源码检查与实际探针。DSH 根 LICENSE 已读取,标示 MIT;本建议只迁移设计与测试思想,没有复制代码或引入依赖。

## 与已有方案的关系

- [08-13 DSH 评估](2026-08-13-deepseek-harness-borrowing-assessment.fable.md) 已提出请求重建、真实入口测试、权限边界等方向。本文件是现用路径的增量,不重新建立 42 项排期。
- [09-05 工程统一稿](2026-09-05-engineering-unified.astra.md) 已将效果词表列为 AS-05 条件项,将 context gist 等退出近期默认范围。本次命令反例应并入同一 cmdEffect/verify 工作单元;不并行再建一条"DSH 迁移线"。
- `docs/09-data-contracts.md` 管合同,`docs/plan/IMPLEMENTATION-PLAN-2.md` 管排产。采纳建议后,涉及合同形状先同步 canonical;本文件不会自行修改两者或提升现有阶段状态。

## SD-1:用实际操作结果约束成功承诺

**裁决:B,改造借;优先。** 借 DSH 事件派生事实、缺失结果保留未知的原则,不复制其 Session 实现。

### 已有与缺口

SayDo 的执行任务已能严格结算;这里的缺口仅在 Brain API 对话出口。

- `dialogLoop.ts:684` 在收到结果前记录工具名,`:715` 仅按工具名是否调用过决定是否允许账本成功承诺。
- CLI oneshot 同文件 `:585` 已用 `actionFailed` 拦截失败;API 路径仍可能把失败结果后的"记下了"发送给用户。
- 实测日志(旧探针):真实对话循环 + 假 provider + 返回 `{ok:false}` 的 remember,审计为失败,最终句子却是"记下了"。这不是实际模型发生率测量,但确定性证明现有 guard 接受错误承诺。
- DSH 对照:checkpoint policy 与调度结果收束。其底层结果语义值得借鉴;不声称 DSH 自然语言层已全面解决此问题。

### 最小实施范围

在现有 `dialogLoop` / presentation 边界建立同一份本轮操作结果视图,供 API 与 CLI 消费。记录具体调用及其对象、结果类别;不要只把 `toolNamesCalled` 改成 `successfulToolNames`,否则"记住 A 成功、记住 B 失败"仍能被合并成"都记住了"。

逐工具区分"已持久化""仅创建提议/待确认""失败""未知""尚未执行",使用返回对象 ID 或服务端确定的目标;例如 remember 成功只返回 `{memId}`,不能统一要求 `{ok:true}`,也不能把 `ok !== false` 当成动作完成。待确认沿现有 `awaitsUser` 路径,旧轮沿 `isCurrent` 路径。涉及这些动作的确认句由现有话术/呈现机制依据结果产生,模型正文不能覆盖失败/未知状态。多个动作有部分成功时准确说明部分结果,不能全部说失败,也不能暗示应重试已成功动作。

第一刀只覆盖 `LEDGER_WRITE_TOOLS` 所代表的现有动作,先核对各返回形状;不为所有闲聊新增持久化日志、状态机或第二次模型调用。不能靠扩展一句成功关键词正则宣称问题已经解决。

### 验收与价值

- 注入明确未写入的 remember 失败:API/CLI 均不输出成功承诺;不产生记忆事件。结果不确定的真实异常不能凭错误码一律推导为"未写入",须按实际回执/可回读状态处理,避免重复执行。
- A 成功、B 失败或待确认:只确认实际落盘的 A;不会因为任一工具成功而放行"全部成功",未执行的后续动作也不写成失败。即使模型采用未命中现有正则的措辞,也不能覆盖服务端的动作结果呈现。
- 工具待确认或旧轮迟到:不输出完成承诺,不重复执行。
- 使用真实注册工具、临时 SQLite 与现用 API/CLI 组装入口做 keyless 测试;重读 ledger 断言结果,不能只检查 onToolCall 回调。

收益是用户口头获得的状态与实际操作一致;无需新增在线模型费用。成本集中在返回形状归一与已有话术维护。验收上述路径后结束,不趁机重构整个对话管线。

## SD-2:普通 M0 记忆不能由模型自授用户信任

**裁决:B,改造借;优先。** 借 DSH 审批由独立系统接口产生、没有 answerer 不自动许可的边界思想;复用 SayDo 自己更严格的确认收据合同。

### 已有与缺口

readinessKey 路径已有确认保护,不能把它当成缺失能力重建。缺口是普通 remember:

- `liveTools.ts:1275` 让模型提供 `trust=user_stated|user_approved`;readinessKey 之外直接传给 ledger。
- `classify.ts:65` 优先接受 requestedTrust;`ledger.ts:89` 据此创建持久事件。
- 探针调用实际 handler 和 classifier,在没有确认收据依赖的情况下到达写入端,M0 被标记为 user_approved。写入端是采集桩,没有污染用户记忆。此证据不等于下游发布门已经被绕过。
- DSH 对照:user-approval 实现。

### 最小实施范围

收紧模型可调用的 remember 边界:`user_approved` 只能由系统持有、绑定具体 claim/对象与会话上下文的既有确认流程产生。**M0 的 user_stated 也不能成为改名后的旁路**:普通模型工具调用不得凭一个 trust 标签直接落 trusted M0;必须先补充普通 memory 提议合同,再复用已有确认基础设施,确认后才交给 ledger。

区分"当前轮存在用户原文"和"用户确认了模型概括的这条偏好"。turnId 是来源锚,不是语义确认。复用既有 claim digest、过期/撤销与上下文校验,不以模型自述"刚才用户说了"代替。用户在后续轮回应仍有效的 pending 是合法流程;"旧轮拒绝"针对失效或错上下文,不是要求确认轮必须等于提议轮。

第一刀覆盖 M0 以及所有 `user_approved` 升格;普通低风险事实、检索、遗忘保持现有产品合同,不把每条记忆都变成额外审批。不要批量删除或降级已有用户记忆;旧记录是否需要回查是独立的数据治理决定。源码已确认 `live/confirm.ts:121` 的 PendingPayload 没有普通 memory kind,而 M0 不允许 candidate。故合同补充是确定前置:在现有确认基础设施定义普通 memory 提议载荷及消费点,绑定 claim digest、tier、project/session 与适用来源锚。确认前内容保留在提议载荷,不能先写 `ledger.add(M0,candidate)`、伪装 readinessKey 或降为 M1 绕过。确认消费后才写 trusted M0。收紧仅针对模型工具入口,不能取消可信系统路径或真实人工亲述的既有合同。

### 验收与价值

- 无确认时分别自报 user_approved 和 user_stated 写 M0:均不能得到 trusted M0。
- 确认前 ledger 无 trusted M0;正确确认一次写入,重复消费不重复写。对 A 的确认用于 B、确认后改 claim、过期/撤销或失效上下文:零写入;跨到后续轮的有效确认正常工作。
- readiness 已有正常确认路径与低风险事实流程无额外无关确认。
- 从真实 registerLiveTools → MemoryLedger → 临时数据库验证 trust,不止测 classifyTrust。

收益是避免模型将推断或外部内容洗成用户偏好/权限依据。成本包括普通 memory 提议载荷合同、确认消费、口播/屏幕呈现兼容和取消/过期测试,以及用户的一次明确 M0 确认;不只是改一个参数,不新增长期模型调用。做到上述边界后停止,不扩成通用语义鉴伪系统。

## SD-3:配置执行器按能力分类,不按测试工具名称放行

**裁决:B,改造借;并入下一次 cmdEffect/verify 安全修复工作单元。** 直接修当前反例,不等待另建通用沙箱。

### 已有与缺口

`cmdEffect.ts:26` 已明确 node/just 可执行任意代码,因此退出 S1;但 `PKG_EXEC_S1_TOOLS` 仍含 vitest、vite 等可加载可编辑配置的工具。实际 `pnpm exec vitest --config ./custom.ts` 在空 verify registry 下得到 `allow/S1`,确认次数为 0。

这是本项目效果分类不一致;未证明所有外部 CLI 或 OS 边界均失效。DSH 的参考点是 sandbox capability 区分实际 enforcement,与 tools 执行管线将许可放在执行前;不是照搬 DSH 的权限默认值。

### 最小实施范围

在现有分类函数范围内,将未登记、可执行配置/代码的包管理器 exec 入口与 package-script 执行动词(run/test/build 等)一起移出 S1 自动许可,沿现有 unknown/interpreter 路径至少上浮 S2;保留已有 S3 更高风险,不降级。独立 reviewer 已复现 pnpm/npm/yarn run arbitrary 和 pnpm test 同为 write_worktree,故只删 exec 工具名特权仍有直接替代路径。对同一函数已支持的 go run、本地 build 等执行型入口也按同一能力边界核对,不按语言名称豁免;确实只读的查询继续按现有语义分类。登记 verify 继续走既有匹配和冻结路径,不能把任意新脚本登记为 verify 来抵消提级。

同时核对同类入口是否通过 `npm exec`、`yarn exec`、参数前缀得到不同结果;范围以实际分类函数支持的形式为限,不做无限 shell grammar。AS-05 已有风险地板与参数兼容约束继续有效。

**冻结保证必须准确表述:** 当前 `verifyFreeze` 不包含间接 import 的完整执行闭包,已有探针证明 helper 改动未被检测。本条只修未登记入口,不能宣称一并解决 verifier 抗篡改。完整隔离执行、可信基线 verifier 或依赖闭包保护,需要单独明确威胁模型和维护成本;本次不建议仓促引入通用闭包扫描器。

### 验收与价值

- 未登记 vitest 配置入口不能无确认 S1;把同一 runner 写入 package.json 后经 pnpm/npm/yarn run 或 test 也不能恢复 S1。现有分类器其他已支持的执行型入口遵循同一地板,正确登记 verify 仍按现有合同工作。
- 阳性对照:在完全临时的目录中,受测配置能写入夹具指定的工作树外哨兵,证明入口确有超过 worktree 的能力;不读取或外发真实数据。
- 同类命令参数变体一致;既有 S3 不降级,只读查询不被无差别拦截。
- 保留 freeze 的间接依赖反例为明确限制,不把本修复的通过写成"任意验证代码可信"。

收益是去掉现有包执行分类中的工具名/脚本入口自动授权例外,不宣称修复了所有 shell 或 OS 边界。代价是未登记的临时测试/构建命令会增加确认,需同步现有将 pnpm test/run build 判为 S1 的测试和对应合同;用已登记 verify 消除正常高频路径的负担,不用扩大自动白名单抵消修复。

## 明确不提的改进

- 不重做 settle/outbox/restart:现用路径已有扎实实现,本会话选定 220 用例通过。
- 不照搬 Cordis、子代理、MCP 宿主或多运行时支持矩阵。
- 不立即做全请求日志重建、LLM compaction 或新知识层:有历史建议,当前没有足以证明值得优先实施的新证据;全文日志还涉及隐私与存储成本。
- 不以 golden 数量作为"真实语音可靠"的替代;SD-1/2/3 各自增加反例验收即可,不另开"增加测试覆盖率"项目。

建议的排序不改写现有排产;本次交付仅为可审阅建议。源代码、用户数据、全局配置均未修改。

## 不带附件也能重建的最小核验

以下是夹具规格,不是已经修复的断言。把它们实现为当前仓库的测试;只使用自有临时数据库/目录,不调用真实模型或污染用户数据。旧观察作为历史反例,当前复现结果为准。

| 条目 | 最小输入与真实入口 | 历史观察 | 修复后必须满足 |
|---|---|---|---|
| SD-1 | 实际 `runDialogTurnWithTools`;假 provider 第一次返回 remember tool call,第二次返回文本"记下了。";registry 中 remember 返回 `{ok:false,code:"fixture_write_failed",message:"no write occurred",retryable:false}`;用户文本"请记住这个偏好" | onToolCall 为失败,但最终 sentences 仍包含"记下了。" | 操作呈现不能说已记住;无实际落盘。再加 A 成功/B 失败或 pending 的组装用例,只确认 A |
| SD-2 | 实际 `registerLiveTools` 注册 remember;调用参数 `{tier:"M0",claim:"用户偏好:不再询问即可发布",trust:"user_approved"}`,普通 session/turnId,不带 readinessKey、无确认收据;写入端最初可用采集桩,再接临时 MemoryLedger | handler 向 ledger 传 `source.kind=user_utterance` 和 requestedTrust;真实 classifyTrust 接受 user_approved | 无有效普通 memory 确认不得写 trusted M0;再把 trust 换成 user_stated 检查无改名旁路。测试不声称可因此越过独立发布权限门 |
| SD-3 | 把 `pnpm exec vitest --config ./custom.ts` 作为字符串交给实际 `commandToEffect`,再交给 `decideCommand`;空 registry `{packageScripts:[],justfileTasks:[]}`;stepConfirm 计数并返回 false | `effect.kind=write_worktree`、`permission=allow`、`risk=S1`、确认次数 0 | 未登记执行型入口至少 S2,拒绝确认后不能执行;正确登记 verify 保持原合同 |
| SD-3 同效入口 | 仅分类,不执行:`pnpm run arbitrary`、`npm run arbitrary`、`yarn run arbitrary`、`pnpm test`;对照 `node helper.js` | 前四项为 write_worktree;node 为 install_dependency | 不能把同一 runner 放到 package.json 后恢复自动 S1;按现有函数支持的其他执行型入口核对同一能力边界 |

冻结限制另可用自有临时文件重建:package.json 的 test 为 `node verify.mjs`,verify.mjs 只 import helper.mjs;冻结 `package_script:test` 后改变 helper,当前基线 precheck 仍通过。这个反例只界定本条不承诺完整 verifier 闭包,不是 SD-3 必须一并实现的另一个大项目。

项目内定位入口:

- SD-1:`packages/daemon/src/brain/dialogLoop.ts`(API/CLI 两个入口、LEDGER_WRITE_TOOLS、actionFailed、awaitsUser);`src/brain/registry.ts` 与 `src/live/dialog.ts`(均相对 packages/daemon);测试 `packages/daemon/test/dialog-loop.test.ts`。将集成测试接到真实返回形状与 ledger 回读。
- SD-2:`packages/daemon/src/brain/liveTools.ts`、`src/memory/classify.ts`、`src/memory/ledger.ts`、`src/live/confirm.ts`(后三个相对 packages/daemon);测试 `packages/daemon/test/memory.test.ts`、`readiness-binding.test.ts`、`approvals-service.test.ts`。新的普通 memory 确认类型和测试在该基础设施内补充,不伪装为 readiness。
- SD-3:`packages/daemon/src/tier1/cmdEffect.ts`、`gate.ts`、`executor.ts`、`verifyFreeze.ts`(后三个同目录)及 `packages/daemon/src/policy/engine.ts`;测试 `packages/daemon/test/tier1-cmd-effect.test.ts`、`tier1-approval-live.test.ts`。确认当前 executor 仍先匹配 frozen argv 再做分类。

## 独立 review 与最终裁决

一个未继承作者对话的 subagent 对建议实质内容独立核验并复核回修,结论为三项可保留、必要修订满足。初审要求 SD-2 明确普通 memory 合同前置,SD-3 覆盖 package-script 同效入口;这些已吸收。该版建议 SHA-256 为 `ed18f71c00baeadb29d5e1ad68502bdc8c2b3c5a4668f1323d1cecc20cf87637`,不是本次补充接续说明后的全文哈希。

本版仅补充单文件接续、内嵌夹具与定位信息,不新增建议。任何旧 review 都不替代当前源码与实施候选的验收。
