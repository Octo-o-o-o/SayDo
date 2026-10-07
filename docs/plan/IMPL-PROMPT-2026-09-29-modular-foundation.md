# SayDo 模块化底座全量实施 Prompt

> 将本文件全文提交到 SayDo 新会话,作为 owner 当次实施指令。仅引用文件或审阅附件不会自动启动。当前生成本文件的会话只出方案与 prompt,不实施。

> 脱敏投影注(2026-09-29 repair-1):本文是仓外原件的脱敏投影——内容逐字保留,
> 仅把本机 home 前缀按 `scripts/public-text-redaction.mjs` home-macos 规则转为 `~`。
> 原件:`~/.codex/worktrees/saydo-foundation-plan/SayDo/docs/plan/IMPL-PROMPT-2026-09-29-modular-foundation.md`
> (只读交接 worktree,不入本仓 Git);原件 SHA-256
> `9300fe2905e813889ac1269de635367f1630f7d589be3c7a8f8f78da73d12178`。

我已采纳随附《SayDo 模块化与开源工程底座最终方案》。请采用 supervised-delivery,连续实施全部 RF-00～RF-11 及其必要 PG-02～PG-06 前置,不要只做前三步、只出报告、只搭骨架或每批询问是否继续。目标是完整、可验证、可维护的本地候选,并完成当前授权和设备/凭据条件下能执行的真实验收。

## 1. 材料与优先级

工作仓库 `~/WorkSpace/SayDo`。必读终稿:`~/.codex/worktrees/saydo-foundation-plan/SayDo/docs/review/2026-09-29-modular-foundation-consolidated-final.md`。配套原始交叉报告:`~/.codex/worktrees/saydo-foundation-plan/SayDo/docs/review/2026-09-29-modular-foundation-cross-review.md`。启动入口与校验清单:`~/.octoworkflow/local/research/2026-09-29-saydo-modular-foundation/handoff-manifest.json`。这些文档当前是交接worktree中的未提交候选,不保证任何Git ref已包含它们;先读和核SHA,在新的实施检出中复制对应相对路径并程序化核对,不得只checkout原HEAD后找不到文档就另起方案。docs/09是合同形状权威,PLAN-2是唯一排产源。本prompt规定新任务范围及自主授权,并不把旧研究当成已实施。

必读:AGENTS.md、docs/README.md、docs/plan/README.md、PLAN-2顶部及PG批卡、HANDOFF.md、.octoworkflow/project-profile.md、终稿、交叉评审及裁决。按改动领域读取09/10/11、03/07及modules/ADR;不把历史全文读一遍当施工成果。

记录当前HEAD、分支、dirty与worktree/活调用所有权。研究基线为d023ffcebfad38563bc988977192e77654d7e2a1,只供差异定位;启动时如有新提交,先做增量对账,不硬reset回此版本。主树已有他人修改/未合并候选要保留,不自动stash、clean、覆盖或合并他人WIP。

## 2. 一次性授权与默认决定

我授权在隔离worktree/clone中连续完成范围内canonical修订与一致性评审、排产导入、代码实现、依赖与工具链局部安装、测试、构建、故障注入、文档/治理/发布工具完善及独立验收。可创建本任务分支、按项目两提交法生成本地代码/证据提交,用于冻结候选与恢复;只提交本任务明确pathspec,不提交秘密/原始私有日志。不得自动push、合入共享main、发布版本、npm publish、公开快照、部署官网/常驻服务或改远端仓库规则。此处“完整实施”以本地候选为终点,外部发布不是暗含的下一步。

无需再问我的默认决定:
- 全量范围为RF-00～RF-11,不是RF-00～02试做。为安全落地所必需的PG前置包含在范围内,现有RED不清零,与原owner/活调用冲突时不抢任务。
- 保留单仓、模块化单体、SQLite、React与现有原生工程;core/client-sdk先行,其余按真实消费价值拆包。禁止微服务/多仓/整套重写。
- HTTP、编译器、Node、媒体等候选按终稿预设比较与门禁自主选型;有充分证据则采用并实现,无收益或回归则保留现役并落ADR,不为“不换”反复请示。RF-08只授权有限对照与媒体边界实现,不自动授权替换整套生产语音框架;不替换也必须完成其验收产物。
- 现有正式支持范围不得缩减求绿,不得未经实测扩大。新增平台能力只记候选/未验;远程业务继续关闭,Codex App Server不转生产,不引入多租户/完整来电产品。
- 开源协作与新release来源合同可完整实现并在本地快照/fixture验证,旧发布路径保持兼容。真实公开主线切换、ruleset、DCO/法律承诺仅准备具体配置与草案,本次不对外生效;不凭空填其他人的maintainer用户名。
- 本地测试使用临时数据根、测试账号和sandbox资源;现有合法凭据只在原项目用途和既有额度内使用,不得输出秘密、购买配额、改计费路线。缺凭据/预算时保留真实服务NOT_RUN,继续其他工作。

原方案“先批准RF-00～02”“全RF另问owner”“PG-06之后owner-stop不能自动续接”等研究阶段待决,由我本次采用此prompt明确改为:为本任务正式导入完整RF链,历史PG-stop保留历史记录,新导入事务为本任务建立后续链与最终停止点。不得仅改注释或手写绕过schedule checker,必须同步schema/验证器/测试及PLAN-2/HANDOFF;只改本任务排产关系,不顺带启动无关deferred项。

## 3. 监督交付与有界自治

当前宿主主持,按实际可用supervised-delivery入口执行。实施者和reviewer独立,每candidate仅一名fresh只读reviewer。角色/模型/预算从本任务冻结的当前policy及overlay解析,不硬编码本prompt生成时的默认模型。

当前项目profile引用的v2-policy已过时:若启动复核仍不存在,本prompt授权仅对这个新任务采用现行 `~/.octoworkflow/policy.json` 与overlay快照,记录具名局部例外并按当前schema建唯一task.json。不创建假的v2文件,不改全局配置,不迁移旧任务预算。profile的required gate和owner checkpoint继续有效,仅取消本范围日常推进的重复询问。

canonical阶段保留互补双视角:每个固定合同candidate一名fresh只读reviewer,分别按“合同/状态安全”和“跨端/可实施性”两个清单给结论;不冒充两名独立reviewer,不对同一candidate派第二个人。每版本最多2轮对抗+1轮回修,不自动第三轮。本次交叉评审不能代替未来新合同评审。

为避免当前默认max_rereview_rounds=3在正常PG链中必然耗尽,我明确授权仅这个新任务在初始化effective_limits使用下列有界覆盖,不改全局、不修改已在途旧任务限额:

```json
{
  "reviewers_per_candidate": 1,
  "max_repair_rounds": 8,
  "max_rereview_rounds": 15,
  "max_same_root_cause_repairs": 2,
  "max_procedure_retries": 2,
  "max_same_procedure_cause_retries": 1
}
```

这代表最多16次占名额语义评审,不是16名并行reviewer或要求凑满。正常审查计划:必要合同统一包1次(修订后可有第2次) + PG-02～06各自required阶段验收5次 + RF-00～11整体集成最终1次,合计7～8次;其余仅为有根因的修复复核余量。已有有效门与旧任务结论应先核是否可复用,不能为凑次数重评;旧任务的历史失败/额度仍保留,不得改名到本任务洗掉。普通RF阶段不另造语义checkpoint,focused测试不是独立review。

启动时依据当前schema预声明合同和PG检查点及其acceptance,并用计数器/校验器核这条无缺陷路径可走通后再占用真实调用。第一次review后所有review/rereview(包括下一PG的首评)均计复审。合同v2等回修阶段可预记标识,但RED后的施工必须记repair、复核计rereview,不能以checkpoint或continue绕修复计数。正常检查点成功只记全任务INCOMPLETE+checkpoint.complete,续工绑定最近review,不能提前--deliver。

所有门禁/修复/同因/程序重试累计记账,不得通过换RF、候选、模型、新task清零。若当前已存在属于本任务的在途账本,优先恢复,不得用上述“初始化”重建空账。只有完全新任务使用上述预算。额度耗尽先做不依赖该阻塞且不需要新语义调用的证据整理,其余最终集中报告,不得自动扩额。

长调用用宿主通知与有hard/idle timeout、进程组清理的runner;恢复原活调用,不重复启动。保持短进度更新,不把更新变成“要继续吗”。上下文压缩后按账本续做;不创建未经我要求的新聊天或跨聊天发消息。

## 4. 执行顺序和完整范围

先RF-00采集全量路由/工具/表写入者/owner/依赖/制品及旧候选清单,建立带分母的覆盖表,恢复PG-02现状。已有正确实现只补绑定证据,已被替代的旧需求记处置,不盲搬旧45k行草案或旧RED分支。

随后对必要PG-02→03→04→05→06完成前置,复用通过证据;再按终稿依赖落实RF。仅文档/fixtures等无依赖准备可先做,生产幂等/恢复等不能用模拟成果跨过PG门。完整范围:

|工作包|必须交付|
|---|---|
|RF-00|现势/历史清单、行为语料、owner/读写与依赖图、真实支持矩阵|
|RF-01|依赖禁止边、模块维护卡、贡献入口、隔离开发与包级命令|
|RF-02|wire单源、TS SDK及一读一写一订阅真实竖切;持久幂等/事件恢复与兼容|
|RF-03|HTTP与Brain共用用例、专属审批状态机门面、窄ports、composition|
|RF-04|存储与查询投影边界、迁移前恢复点、旧授权隔离与旧进程对账|
|RF-05|完整路由/WS迁移覆盖、身份/生命周期/背压/Fastify取舍|
|RF-06|Web全量范围SDK接线、容器/组件、fixtures、可访问性与真实旅程|
|RF-07|provider/executor协议与现役adapter、取消/恢复/settle/预算语义|
|RF-08|媒体接口、固定语料对照、自写/Pipecat/LiveKit取舍和性能/安全证据|
|RF-09|三端bridge合同、机密存储、签名安装/升级/音频/设备能力矩阵|
|RF-10|工具链适配、包dist与工作区外消费、安装闭包SBOM/签名/来源合同工具|
|RF-11|开源治理入口、公开贡献主线候选与兼容发布验证、维护者交接包与独立演练|

条目全部有处置才算覆盖完成;条件不成立的框架替换可以“不采用+证据”收口,已required的功能和测试不得改称不适用。不同模块实现可有先后,不能把RF-02样板当RF-05/06全部覆盖。

## 5. 不可退化的实现合同

- Gate0沿用canonical谓词,无bypass;S3禁止语音/远程放行,身份/Origin/资源归属不得由客户端自报。
- 命令按效果分类,取消/拒绝/恢复读不误套新派发预算或收据。HTTP/WS/Brain/媒体不得另起授权权威。
- 幂等K=installationId+principal+scope+operation+requestId;digest是比较字段而非唯一键一部分,原子占位、稳定operationId、同键冲突与并发反例必须有测试。未知副作用不得自动重执行。
- durable事件在业务提交后发布且有持久恢复来源;快照/游标一致,撤权/恢复代际失效,保留窗口过期resync;不能只靠内存bus或复用原始审计作对外API。
- 恢复旧库先停新副作用并核旧进程所有权,恢复代际隔离旧receipt/intent/billing-switch/session/撤销状态,不把旧pending恢复成可执行,unknown外部结果留reconcile。
- 单一任务/审批/记忆/outbox owner;SQLite/文件/外部进程没有隐含分布式事务。收据消费历史不可重置,事务内不等网络/模型。
- 敏感payload只记digest,可信记忆candidate→trusted;媒体watermark决定已听历史,模型回复不等于执行/验收。
- voice保留P50≤1.5s且P90≤2.5s、样本≥20和原分组/分母/undeterminable规则;新增p95仅追加,不放宽原门。
- Fastify隐式coercion/default/removal不可改变审批digest;未知授权字段拒绝;旧wire消费者、Node支持范围与制品exact-set不静默破坏。

## 6. 验收与结束条件

迭代跑对应focused gates,稳定候选跑 `just ci` 与 `pnpm exec playwright test`,以及受影响PG/项目required gates。先核脚本存在,`[new]`任务先实现再运行,不能省略。门禁由合同/任务卡给出,不直接执行reviewer命令。

额外验收覆盖:禁止依赖反例、schema与生成物同步、工作区外SDK消费、全部选定入口权限/幂等/恢复、真服务浏览器旅程、Windows/macOS/Linux进程与存储、Python wheel、各端制品签名安装与真实设备。mock/静态/模拟器/真机/provider/托管CI分别记录,每项分母含发现/选定/执行/唯一/重试/跳过/NOT_RUN。

不要用一项缺设备阻止其余可代办工作。真人主观验收、首次登录/MFA、缺设备/证书、外部发布等依赖记录在单一最终清单,能够准备的脚本/制品/模板先全部准备。AI reviewer模拟接手可验证文档与复现,不能冒充第二位真人维护者或owner四场真人验收。

终态必须分别给:
1. 全部RF/PG的代码与文档覆盖以及明确不采用的技术决策;
2. 固定候选独立review结论及未决项;
3. 本地门、托管CI、provider、平台/设备与制品的独立结果;
4. Git提交/分支/候选身份、日志SHA和恢复说明;
5. 尚需本人或外部授权的最小操作清单。

任一required门RED/NOT_RUN/pending则对应交付保持未完成,不能因“所有可做的都做了”宣称全量GREEN。但也不得在普通阶段先停下来等待我确认继续。只有安全/权限/设备/明确外部依赖或累计预算使所有剩余可推进路径真正无法继续时,保存状态并一次性报告阻塞;不扩大权限,不悄悄降验收、不无限重试。独立验收后仍是待owner验收的本地候选,不自动发布。

现在先读材料、核当前现场与所有权,登记任务并从RF-00开始,持续推进到上述终态。
