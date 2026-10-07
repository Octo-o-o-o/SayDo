# SayDo 模块化与开源工程底座最终方案

日期:2026-09-29。状态:本次唯一subagent交叉评审已取回,1项流程阻塞已按同轮建议修订并由宿主核验。方案与新会话Prompt已定稿,尚未实施,不是产品GREEN。本文是本专题方案的唯一终稿入口,不替代docs/09等合同canonical,也不另立active/next。执行入口见[全量实施Prompt](../plan/IMPL-PROMPT-2026-09-29-modular-foundation.md)。

> 脱敏投影注(2026-09-29 repair-1):本文是仓外原件的脱敏投影——内容逐字保留,
> 仅把本机 home 前缀按 `scripts/public-text-redaction.mjs` home-macos 规则转为 `~`。
> 原件:`~/.codex/worktrees/saydo-foundation-plan/SayDo/docs/review/2026-09-29-modular-foundation-consolidated-final.md`
> (只读交接 worktree,不入本仓 Git);原件 SHA-256
> `6d77c8e16614ef2a74ac32d1ba3cee2a8e80f9af58c42a8ad17af7c9759cb2f2`。

Supersedes:仓外研究目录的decision.md(v2)及decision-v1-reviewed.md仅作历史;round-1.a/round-1.b/round-2为顾问输入,不是并行实施方案。现有2026-09-05工程统一与2026-08-28缺口总案不整体作废,只按下文映射复用其适用范围和PG门禁。历史研究与回执保留于 `~/.octoworkflow/local/research/2026-09-29-saydo-modular-foundation/`。

本次用户要求生成覆盖全部RF的新会话自主实施Prompt。授权以用户在新会话明确提交该Prompt为准;当前只交付文档候选。全量范围不再以RF-00至02作为结束点,日常阶段不重复征求继续许可。发布/生产切换与required真人条件的边界见Prompt。

## 1. 结论与范围

推荐保留单仓,建设模块化单体控制核心,以版本化协议连接可独立开发的 Web/原生客户端、媒体运行时、模型供给与执行适配器。先建立可测试的业务边界,随后按实际消费需要拆包;不以微服务、多仓、换语言或整体重写作为质量目标。

“顶级开源”不能由架构方案保证。可判定目标是:非原作者能够独立修改一个模块、运行必要测试、定位故障、验证制品并安全交接维护,同时原有审批、恢复、隐私和实际设备语义不退化。预算充足应投入这些证据与开发体验,不用于无必要的平台复杂度。

本次覆盖现状与历史核验、目标结构、接口与状态所有权、技术去留、完整迁移及开源治理。本轮只在隔离worktree写方案、交接Prompt、评审索引及journal,不改产品代码、合同canonical或现行排产指针,不commit/push。

## 2. 当前证据与历史实施判断

宿主本次读取 main HEAD `d023ffcebfad38563bc988977192e77654d7e2a1`,开始时 `git status --short` 为空。以下是源码/文档审计,不是全量测试、运行制品或真机验收。

|项目|当前事实|判断|
|---|---|---|
|单仓与包|`pnpm-workspace.yaml`、五个 `packages/*`、三个 `apps/*`、`pipeline/`|已有组织边界,不能据此认定独立协议与发布兼容已成立|
|历史前端组件化|`HANDOFF-前端组件化施工交接.md` 明记 2026-08-09 已交付归档;Git 可解析 `ecf3e69` 创建交接、`2d0f6e9` 归档记录;现有 redesign 组件与 fixture|呈现组件已落地;该批明确排除 fetch/WS/语音/路由/全局状态,不能解释为全项目解耦|
|后续前端接线|当前祖先中 `dc3b18c`、`6e4ea74`、`ac8df81`、`62b07c2` 分别涉及确认类型单源、失效刷新、键盘与旅程整合|也不能反向说真实接线从未做过;现有工作应复用|
|入口耦合|`daemon/src/index.ts` 4202 行;950 行起 API 身份、remote、recovery、S3 分支;1030 附近仍直接查询 sessions|混合组装、transport、业务与持久化,有明确抽离价值;行数不是缺陷严重度|
|工具耦合|`brain/liveTools.ts` 2666 行,直接 import DAO/receipt/Tier1/Focus 写事务;Deps 暴露 Db 等|HTTP 与模型工具应共用应用用例,不能分别重建授权逻辑|
|执行复杂度|`tier1/executor.ts` 4900 行,已存在现役执行实现|按启动/观察/取消/恢复/settle 分责,不另建执行权威|
|DTO 与客户端|两端 `api.ts`/`api/console.ts` 各有 TaskRowView;前端泛型请求断言;部分移动响应已有 schema parse|需要 wire 单源与覆盖,不能声称当前完全没有运行时校验|
|存储查询|`api/console.ts` Db/SQL/read projection|只读跨表 JOIN 可以保留在查询适配器,不拆成 N 次服务调用;业务写入所有权需约束|
|语音|`hub_client.py:35,204` 使用 EnergyVad;扫描受 Git 跟踪的 pipeline/src 未发现 pipecat import;D2/技术状态说明现役自写 WS|Pipecat 1.6.0 被锁定且旧 spike 通过,生产框架接入未成立|
|包分发|contracts/platform private 且导出 src;CLI 0.1.0-rc.13 有 dist 构建|仓内复用存在,独立公共 SDK 尚无交付证据|
|治理入口|有 LICENSE/NOTICE/SECURITY;本次根路径检查缺 CONTRIBUTING/CODE_OF_CONDUCT/GOVERNANCE 与 .github/CODEOWNERS|补贡献与维护入口,不能说全仓无治理|
|CI|现有 Ubuntu Node/Python、浏览器、三 OS distribution、Android 与 iOS 任务|三 OS 打包不等于三 OS 全量行为测试;本次未核远端运行状态|
|唯一排产|PLAN-2 revision18 active=none,next=PG-02,last_closed=SC-RELAND-01|不存在“整体模块化已验收”的证据;旧 PG-02 RED 记忆不能代替当前候选复验|

本次机械清单遍历 795 个受 Git 跟踪的 TS/TSX/Python/Kotlin/Swift/ArkTS 文件,只是路径与指定正则统计,没有宣称语义读完每个文件。关键入口/合同/发布配置做定向阅读。历史设计匹配到单仓整理、前端组件化、AI 供给、工程统一与缺口总案多条线;无法唯一确定用户记忆对应哪一篇,但足以否定“前端组件化归档即全项目已解耦”的推论。

锁文件实读:TypeScript 5.9.3、React 19.2.8、Vite 7.3.6、Vitest 3.2.7、better-sqlite3 13.0.3、Pipecat 1.6.0。声明范围不是安装值,本机安装值也不是已发布制品值。当前 CLI engines 是 `>=22 <23`,根是 `>=22`。

需校正文档的候选项:README 的 Python/Pipecat 简写、D16 的旧 Hopper 所有权、D9 标题的 Markdown 真相、原生壳目标与现役实现的分层说明。未来改 canonical 时必须先做一致性评审,本次不直接覆盖。

## 3. 目标边界

```text
Console / CLI / Native devices / future third-party clients
                         |
             client SDK + versioned wire contracts
                         |
            gateway: HTTP / WS / authenticated context
                         |
       application commands / queries / event subscriptions
                         |
       domain policies / approvals / task and memory rules
                         |
                   semantic ports
              /          |             \
       SQLite/files   provider       executor/media/platform
```

运行图不等于编译依赖图:application 依赖 ports/domain;基础设施实现 ports;composition root 创建具体实现并注入。客户端不能 import daemon 私有代码,core 不依赖 HTTP/WS/SQLite/React。gateway 不直接做 SQL 或决定审批;只读投影实现可查询跨域数据,不得取得任意写权限。

|模块|职责及状态所有权|测试/扩展方式|
|---|---|---|
|contracts|wire DTO、错误、事件、兼容投影;现有 JCS/digest 与纯规则保持兼容|subpath exports、schema/生成物差异、跨语言 golden JSON|
|core/application|对话接受轮、Focus/项目、审批各类状态机、执行协调、记忆与通知用例|注入 clock/repository/provider/executor/media;不用真 key 可测|
|gateway|编码/解码、身份上下文、来源限制、HTTP/WS lifecycle、背压|fake application 驱动协议测试,无数据库启动可测|
|storage-sqlite|连接、迁移、事务与 projection 实现|临时数据根,旧库/故障点/一致备份测试|
|provider adapters|推理请求、能力、usage、取消、错误转换|API 与 BYOA 纯推理分开;凭据最小暴露|
|executor adapters|受控 CLI、hook 回调、观察、取消、恢复|不签发收据,不把进程 exit 当 settle;conformance corpus|
|media runtime|采集链路/VAD/ASR/TTS/缓冲与播放回执|进程可重启,不持有审批/可信记忆业务真相|
|client-sdk|协议校验、错误/游标/请求状态、环境适配|core 不依赖 DOM,传入 credential/transport/clock|
|UI|tokens、纯组件与 fixture|SDK mock 下独立预览,无真实执行权限|
|native apps|安全存储、音频会话、权限、系统生命周期和 bridge|共享协议语料,三端分别签名/安装/真机验收|
|platform/CLI|OS 锁、进程树、文件语义、supervisor 与诊断|Windows/macOS/Linux 真实生命周期测试|

初期新增 `packages/core` 与 `packages/client-sdk`,gateway 先作为 daemon 内独立模块;有第二个真实宿主消费时再出 `packages/gateway`。storage-sqlite/UI 有独立测试或消费者需求后再出包。contracts 先加子路径与兼容导出,不一次搬空既有状态机。领域目录不自动成为 npm 产品,内部包协调发版,公开 SDK 才承诺独立 SemVer。

单仓内允许不同模块并行 PR,集成通过合入队列和核心 owner 审核。现行项目串行实施规则需要显式修订后才改变执行方式。多仓只在不同所有者、不同权限/许可、稳定兼容周期同时成立时重议。微服务只在真实扩缩容/隔离需要及恢复协议成熟后重议。

## 4. 状态、安全、事务与恢复合同

1. Approval Authority 是应用门面,不是一个万能 approve():意图、派发、运行时 effect、验收、记忆、S3 保留独立类型与状态机。设备配对不等于审批权限,送达不等于已读或同意。
2. 核心用例接收服务端建立的 principal、project scope、connection trust、auth epoch;客户端传入的 via/local/trust 一律不作权威。媒体/Brain 只能提交观察和候选。
3. 产生或扩大执行副作用的命令:严格解码 → 服务端身份/范围与当前remote/recovery策略 → 适用的Gate0/风险/预算/绑定收据 → 持久意图与业务提交 → 执行前重验 → 副作用与证据/settle。Gate0沿用canonical谓词。取消、停止、拒绝批准与恢复读取使用各自准入规则,核身份/资源归属但不得误套新派发预算、收据或readiness,关闭新派发不能阻断收口。普通查询或所有写入不强制走任务验收/S3链。新入口必须跑相同拒绝语料。
4. 同库需要强一致的幂等占位、状态、收据消费、执行意图、事务内审计与outbox由显式UnitOfWork协调,不能因同库就假设已同事务;事务内不等待网络/模型/外部进程。repository使用语义方法。消费后的收据绑定已接受的intent/run/attempt;重复请求只读原结果,执行前校验当前必要条件,不要求收据恢复pending。失败或取消保留消费历史,不重置资格。预算预留/释放、计费切换与重试资格均列明owner,不由adapter自行决定。
5. SQLite 与文件/JSONL、外部 CLI/SMTP 不假设跨资源原子提交。逐链标明真相源、可重建投影、提交顺序与持久恢复意图;未知结果进入 unknown/reconcile,禁止自动重做副作用。审计 sink 的事务边界与失败策略须按 PG-04 核清,不能假设一次 DB 事务能覆盖文件审计。
6. durable owner 保持唯一:execution owns run/attempt/settle;memory owns candidate→trusted;notification owns outbox/ACK;媒体缓冲/UI缓存是可丢弃状态。后台任务不随页面卸载默认取消。
7. 不可信第三方 adapter 禁止动态载入主 daemon。优先最小能力代理与隔离进程;子进程本身不是沙箱,OS限制未验证时不能标安全支持。第一方 adapter 可同进程审查发布。
8. 保持 Gate0 无 bypass、S3 禁止语音放行、远程业务 fail-closed、审计不可变与payload脱敏、记忆批准、计费切换批准、取消进程树和恢复等语义。接口独立不自动重开 remote。

## 5. API、事件、SDK、设备

现有内部 API 保持兼容;新受支持 API 与管理/恢复/hook 协议分层,不把全部 `/api/*` 宣布稳定开放。先选一个只读查询、一个非 S3 有副作用命令、一个事件订阅做端到端样板,再按完整路由台账迁移。私有协议也有版本与兼容测试,只是无公共稳定承诺。

契约以 docs/09 和 contracts 中受审查 schema 同步为源,仅导出可表示的 JSON wire 子集。内部 Date/Map/BigInt/refinement/transform 不直接承诺跨语言等价。HTTP 建议 OpenAPI 3.1 兼容基线,事件 AsyncAPI 3.0;不是宣称最新版本,以生成器与消费者真实验收锁具体小版本。生成错误码、DTO、示例与基础客户端;授权、重试、音频、连接恢复手写薄层。

协议明确 product/protocol/SDK/DB schema/bridge/adapter 各自版本。稳定后测试当前及前一个受支持协议代际,弃用窗口发布前按维护资源冻结;0.x 不自动享有相同承诺。读取 DTO 可允许明确可忽略的新字段;授权命令未知字段/风险类型不得默默删掉继续执行。

durable envelope 建议包含 version/eventId/sequence/aggregateId/revision/causationId/scope。游标绑定授权与恢复代际,撤权或旧库恢复后失效。快照与游标同一一致边界采集。durable 事件可重放去重;PCM、token delta 等瞬时流有界缓冲并明确可丢失。审批事件不得被音频背压静默丢弃;过载断开后走 resync。

durable事件须具名持久来源与发布边界,业务提交后才发布,发布前已有可恢复领域事件/持久投递依据。提交后发送前崩溃可补发,已发未ACK可重放去重。优先复用领域账本及必要事务记录,不把callback_outbox改成通用真相源,不对客户端暴露原始审计。跨DB/文件声明checkpoint与恢复法;保留窗口、游标过期resync、范围过滤与脱敏纳入RF-02/04/05。

服务端幂等唯一键 K=installationId+principal+scope+operation+requestId,requestDigest不进入K,而作为记录比较字段。服务端从严格验证与版本化规范化后的请求计算digest,保存expectedRevision/attempt、稳定operationId与状态。唯一约束/原子占位防并发双建;同K不同digest拒绝,相同返回原身份与状态,不重建intent或重消费收据。返回结果仍鉴权,幂等不授予权限。持久提交后才返回已接受;提交/响应/网络不确定则按operationId/requestId查询,不自动重执行。旧端点在服务端幂等与结果查询验收前保留现有POST/DELETE重试限制。未决/unknown记录不得因缓存TTL清空后执行成新请求;过期键、恢复后缺记录返回明确过期或待对账,查不到不证明没执行。确认卡重现不能重播旧“同意”。

SDK 分 core/browser/node,原生 Swift/Kotlin/ArkTS 共用 JSON corpus;ArkTS 生成器可行性单独验,不承诺照搬 TypeScript。SDK 注入凭据提供器,不硬编码 localStorage 或 `window`;native bridge 限 origin/消息类型/请求大小/导航与生命周期,网页不能任意调用 OS。

远程未来分设备身份、受限读/输入、具名业务能力三步设计并分别验收。TLS/Noise保护链路不替代授权,中继落 localhost 不得洗成本地可信身份。当前 URL token/ws:// 风险登记到对应安全迁移,不在本研究开远程监听。未来多租户先一实例一数据根/凭据/进程所有权,共享租户数据库需要单独隔离与配额设计。

## 6. 技术去留裁决

|技术|裁决|前置与验证|
|---|---|---|
|Node|保留,独立评估 24 LTS;22保留兼容过渡|当前发布只声明22;OS/arch原生依赖、supervisor、旧数据、真实tarball通过后才调整支持范围|
|TypeScript|保留,5.9.3用于基线;评估当前稳定7.x而非把6.0当唯一终点|先核release,编译API/ESLint/声明产物/tsconfig迁移;若需6.x作为迁移步单独记录;不和领域改造同批|
|pnpm/build|保留固定pnpm和esbuild,加包级dist/.d.ts/exports|工作区外Node与浏览器消费者可安装;无深路径依赖;project references可先PoC;不预设Nx/Turbo|
|React/Vite|保留React19与Vite;锁定实际19.2.8/7.3.6基线|Pro提出“若仍7.0则升级”条件不适用;按安全修复/维护窗口单独升级,不换前端框架|
|Vitest/Playwright|保留并单独评估升级|测试发现数量/非空关键集合、timers/mock/concurrency/coverage、跨浏览器需等价|
|HTTP/WS|先保留node:http/ws,抽边界后优先Fastify5局部PoC|输入coercion/default/removal必须显式禁用或校验语义,不能改变digest;Origin/Host/starting/WS/S3/drain回放不退化|
|Zod/OpenAPI/AsyncAPI|保留Zod,增加受限生成链|生成不是第二合同源;strict command,运行时请求响应校验,跨语言语料|
|SQLite/better-sqlite3|保留,先做PG-05与表写入所有权|不为“专业”换Postgres;不因内置node:sqlite就换驱动;WAL/备份/FTS/整数/旧库/取消阻塞实测|
|Python/uv|保留,固定受支持版本/严格lock同步|从wheel安装、媒体启动和同语料验收;源码跑过不算制品|
|Pipecat/LiveKit|Pipecat优先有限生产链PoC,LiveKit为对照及网络媒体需求候选|旧watermark实验不重做冒充新成果;禁止框架接管审批/任务；模型、语料、设备固定对比|
|执行器|保留现役Tier1,先拆protocol/adapter/lifecycle|Codex App Server保持受控实验,生产接线另批；不能拿上游能力代替安装二进制能力|
|原生客户端|保留Swift/Kotlin/ArkTS工程,抽bridge与协议|不为统一技术而重写三端；签名、升级、后台音频各端分别验|
|队列/工作流服务/插件市场/多租户平台|本轮不引入|只有被实测需求触发才另做方案,不预防性复制现有outbox与状态机|

官方关键事实宿主已复核:Node官网列22/24为LTS、26 Current;TS官方release页面已核得7.0.2稳定发布,是否采用仍待工具兼容验收。上游滚动页面只证明能力,不证明本项目兼容。更多官方来源见第11节与两份Pro原文。

语音继续执行docs/03 §3现有硬门:P50≤1.5s且P90≤2.5s同判,样本≥20;不足或非有限/逆序时间戳记undeterminable,取消/超时/缺段轮进入分母,文本/PTT/免手/工具轮分组。固定同供应商/模型/采样格式/设备/语料先取现役基线。新增P95、真实设备首声、EOU误切/漏切、打断停止、watermark、CPU/RSS/启动/成本的口径与阈值在查看候选前冻结,不替代既有硬门。daemon收到事件近似时间与设备真实播放时间分列,未校准时钟不混算。规定验收集合中确认/授权违反次数须为零,不把有限样本当全场景安全证明。覆盖中文停顿/中英混说/噪声/迟到ASR/播报中断/媒体崩溃/蓝牙切换/锁屏,缺设备记NOT_RUN。正式框架替换须另行具名授权。

## 7. 完整迁移工作包与已有计划关系

以下 RF 编号仅为研究工作分解,不是 active/next。实施前通过一份导入变更落到 PLAN-2,不增加第二排产源。

RF-02采用安全竖切,所选一读一写一订阅须包含所需窄用例、服务端持久幂等、事件来源与安全回归,满足相关PG前置后才验收生产语义。能力未齐时仅记合同/SDK骨架/模拟通过,生产未验证。RF-03/04/05负责全量扩展,不能拿模拟通过抵扣。

|工作包|依赖与既有归属|产物|可判定退出条件|估算人周|
|---|---|---|---|---|
|RF-00 现势和基线|起点;复用PG-02清单,不清零旧RED|全路由/命令/表写入者/状态owner/依赖图/旧方案 disposition;兼容语料|清单有分母与例外,主入口、模型工具、媒体、恢复路径均覆盖;源码/制品/真机分列|3–5|
|RF-01 边界与贡献入口|RF-00;PG-03守门|导入白名单、模块维护卡、CONTRIBUTING、隔离开发模式、包级命令|新增禁止依赖必失败;UI/核心贡献者无key完成样例;现有基线不退化|3–5|
|RF-02 wire与SDK竖切|RF-01;PG-02类型台账,PG-06准入约束|一读一写一订阅、typed DTO、TS SDK、兼容适配|合同模拟与生产竖切分列;真实用例/持久幂等/事件接线齐备,同键冲突/并发重复/提交后断线/撤权/恢复通过;满足相关PG前置|4–7|
|RF-03 应用服务与安全主链|RF-02;PG-04审计约束、PG-06准入|HTTP/Brain共用用例,Approval门面,registry/composition|任何入口不能绕Gate0/S3;收据单次消费;同副作用轨迹等价|6–10|
|RF-04 storage与恢复|RF-03;先满足PG-05|语义ports、迁移/备份/旧库恢复、读投影|每生产迁移有恢复点;WAL/故障注入通过;不兼容库拒绝;无未验证逆DDL|4–7|
|RF-05 gateway与协议覆盖|RF-02/03;RF-04相关接口|逐路由迁移,HTTP/WS独立生命周期,Fastify ADR|全量路由与旧行为对账,origin/remote/recovery/S3/启动关闭逐项通过|4–7|
|RF-06 Web与组件消费|RF-02/05|SDK接线、容器/呈现、fixtures/可访问性、可选UI包|真实参考旅程浏览器验证;新页面无需了解DAO/executor;mock不替代真服务|3–5|
|RF-07 provider/executor|RF-03/04;PG-06先行|adapter合同、能力证据、启动取消恢复settle分责|hook失联拒绝,真实进程树终止,未知终态不冒绿,计费不静默切换|5–8|
|RF-08 media对照与选择|RF-02/03;既有VOICE基线|自写/Pipecat/LiveKit对照,选择或不替换ADR|同语料安全不变量、冻结质量/延迟门与依赖成本;正式替换超出试验另估|4–7|
|RF-09 native bridge与设备|RF-02/05/06及选定媒体合同|三端版本化bridge、安全存储、设备矩阵|模拟器/签名制品/升级/真机分别验;不因壳可用宣布remote开放|8–14|
|RF-10 工具链与可信发布|RF-01后可逐项穿插,各发布依赖相关工作包|Node/TS等单独迁移,制品SBOM/签名/来源证明、exact-set升级|实际下载字节校验,清洁安装升级恢复,required门无skip/假绿|4–7|
|RF-11 开源与第二维护者验收|文档早建,收口依赖已声明支持范围|公开main治理、维护者规则、模块贡献示例、交接演练|非原作者独立改adapter/页面、恢复数据并验证候选发布;未支持面明确标记|3–5|

估算合计51–87工程人周,加25%–30%集成与未知量储备约64–113人周。仅为范围规划假设,不是报价或AI执行时长承诺。两路Pro分别给45–75和69–110人周,分歧来自协议/原生/治理覆盖范围,不可简单平均作精确工期。RF-00结束用真实清单重新估算,首段RF-00至RF-02估算10–17人周,但本次全量实施Prompt范围覆盖RF-00至RF-11,不得在首段后结束。范围包含既有行为迁移、有限媒体对照、原生桥和验证与开源治理;不包含远程重开、Codex生产接线、多租户、完整来电产品、媒体正式替换及持续维护。人数/专业/并行比例/设备资源另列,不能把人周直接换算自然工期。

PG映射:PG-02管理能力/action/scope与声明证据;PG-03管理required门真相;PG-04管理审计新写安全;PG-05管理DB恢复点;PG-06管理准入/discovery。它们是已有必需安全工作,不能被RF改名、删门或重复立账。本方案不自动改变现有串行链。导入时将重叠验收绑定既有PG evidence,新增架构任务接在必要前置后;并行仅限明确独立且项目规则允许的领域。现有PG-06后owner-stop是旧范围停止点。本次用户在新会话采纳全量实施Prompt时,明确授权为该新任务导入完整RF后续链和最终停止点;按版本化排产导入规则更新PLAN-2/HANDOFF及checker,保留旧记录,不跨过PG门或清零旧RED。当前文档生成轮不执行导入。

每次迁移按“旧入口委托新用例 → 对照测试 → 切换 → 验证旧消费者 → 移除死分支”。只读投影可影子对比;写命令禁止双执行shadow。安全修复与行为等价重构如必须混合,明确列出有意差异并单独验收,不能把旧漏洞固化成等价要求。

回滚单位为代码制品+协议兼容+数据版本+配置+授权语义。无schema变化也不保证可回退:旧制品须满足最低安全版本,识别当前数据/授权/恢复隔离状态,否则不在回滚清单。

恢复前关闭新副作用准入,按真实进程所有权停止或隔离旧daemon/子进程/执行资格,不只看PID或新数据根;旧进程可能仍写同workspace。保留当前数据、快照后审计/运行证据/外部产物,核备份清单后恢复到隔离根,业务重新开放前建立新恢复代际。

旧待决收据、未决派发、billing-switch资格和设备会话不因快照记录有效而自动续用。保留原授权历史,通过新恢复记录失效/隔离,重新执行按适用规则获取新授权。对快照后设备/记忆信任撤销对账;不能证明有效的状态不可恢复为可消费。游标失效不代替业务授权失效。恢复点之后执行/付费/投递不能由DB回滚撤销,unknown保持reconcile并禁止自动重发,新授权也不能把未知执行追认为没发生。记录丢失窗口由owner决定处置。RF-04须测已消费收据、旧intent、已撤销凭据、已投递outbox、存活旧进程等反例。

## 8. 开源工程与多人维护标准

- 三条开发入口:UI fixtures/mock SDK、核心fake provider/executor、原生/媒体回放器;均使用临时数据根,不读维护者个人凭据。mock模式与production配置严格分离。
- 每模块维护卡限定职责/owner/公共入口/状态/依赖/测试/恢复/canonical链接;默认读短文档,历史证据按需追溯。提供一个provider、一个设备客户端和一个页面的最小扩展示例。
- CONTRIBUTING、GOVERNANCE、CODE_OF_CONDUCT、CODEOWNERS、issue/PR模板、SECURITY支持矩阵;关键安全/发布变更独立复核,普通UI变更按局部范围评审。CODEOWNERS必须配ruleset才成为门,本次不改远端设置。
- 保留Apache-2.0;代码、第三方二进制、模型/音色/字体/数据、品牌商标分别清点授权;DCO为建议,CLA仅有明确法律需求时考虑。许可最终裁决由有权人员完成。
- 公共仓未来应具备可追溯贡献主线与release源,避免长期快照镜像让外部PR无处合入。先核当前公开分发与私有档案边界,以专门ADR迁移;不重写历史或删恢复证据。当前release workflow要求snapshot提交格式、public-tree、filter-version;转普通公开贡献主线须在RF-10/11以ADR及版本化验证器同步迁移源码身份/私有映射/制品来源合同,不能删除校验应付新历史;不可变tag与制品保留。
- CI分PR快速门、跨OS生命周期、主干完整矩阵、受保护真实provider、制品安装、设备验收。release必须绑定实际commit/制品hash/工具链/OS+arch;本地just ci不等价托管CI。
- SBOM区分包内组件与安装后运行依赖,选择CycloneDX或SPDX主格式。npm解析依赖/原生平台组件/额外下载字节记录实际版本、来源、完整性和OS/arch,不由tarball或根lockfile推导全安装覆盖,缺口明示。来源证明绑定实际字节与预期仓库/commit/workflow/签名主体。当前release exact-set有三个资产约束,增加文件必须同步版本化合同与检查器,不得删掉完整性门。原生签名/公证与来源证明分别验。
- 真实服务密钥只进入受保护任务,不提供给不可信fork PR;依赖变更独立审查,Actions完整SHA/最小权限继续保留。失败release维持unavailable,不发半成品成功声明。
- 中文canonical继续权威;英文README/quickstart/贡献/API文档作同步投影,不建立另一套不同合同。代码注释沿项目简体中文约定,标识符英文。

## 9. 验收清单与本次未运行

最终架构验收至少包括:模块依赖禁止边可机械失败;公开包在工作区外可构建;现有HTTP/WS/Brain/媒体所有入口映射到同一用例权限;协议旧新消费者兼容;迁移恢复验证;跨OS进程取消;三端分别真机验收;新维护者无个人上下文可贡献;制品可下载验签安装升级。

性能分继承硬门与新增指标:语音保留第6节现有canonical数值/样本/分组;启动、RSS、事件循环延迟、查询/命令p95、CI耗时与新增设备指标按同负载采基线,候选对比前冻结允许变化。已有阈值不得记成未定义,本次未运行性能测试。

验收矩阵按制品/版本×OS/arch/设备×具名能力记录通过/失败/NOT_RUN/明确不支持。三端原生bridge、签名安装升级、前后台音频分别验,不能用mobile pass统称,模拟/原生可用不代表remote业务开放。声明支持的required项缺测不通过,暂不支持如实披露而不扩大范围。

本次未执行 `just ci`、产品集成测试、真实provider调用、设备安装、签名、公网发布与远端ruleset检查;这些不是研究文档的通过证据。未语义遍历全部795文件,未核每个历史分支候选。Pro是顾问研究,不称零上下文独立产品验收。

## 10. 决策与争议裁决

采纳:模块化单体/单仓、单一状态owner、先用例后框架、wire/SDK单源、可独立开发的多端、恢复/制品/贡献者验收。
部分采纳:core/client-sdk先新增;gateway/storage/UI按消费价值渐进拆包,不照搬两路包数量。Fastify是候选不是硬前提;跨表只读SQL可留在投影adapter。
修正:Vite实际7.3.6不是7.0;Pipecat确实未在生产源码import;TS不能停在“6.0最新”叙述;根工程pnpm.allowBuilds禁用某依赖脚本不等于安装必坏,也不等于npm安装链采用相同策略;分别按实际制品核。13.0.3是better-sqlite3包版本,SQLite引擎版本另记。
保留待验证:全部路由完整图、所有表写入与事务/审计关系、已发布rc.13依赖字节、OS/设备现势、真实远程产品诉求。对应RF-00及制品/设备门,不把未知填绿。

实施默认决定由配套Prompt一次给齐:完整RF链、既有支持范围不缩减、公开主线/发布合同做本地候选而不实际切换、许可维持现状且不自动签法律承诺。新会话采纳Prompt可做任务范围本地I/E提交,但无push/共享main合入/发布/部署授权。缺设备或凭据不阻断独立工作,required未验保持未完成,最后集中报告。

## 11. 来源与回执

本地依据见 source-context.md、inventory.md、host-static-checks.json 及原仓对应路径。两路原文 round-1.a.response.md / round-1.b.response.md,模型与附件完整性均经fetch核对,加第3次整合复核round-2.response.md,共3次已提交评估。第3次runner等待账号槽后超时,原会话重连成功取回;原timeout与原始日志均保留,模型/Pro证据从同slug恢复输出原样提取,fetch再次验证成功,没有重发。详见round-2.recovery-provenance.json。所有建议最终由宿主裁决。

官方来源:
- Node LTS与Current:https://nodejs.org/en/about/previous-releases
- TypeScript发布:https://github.com/microsoft/TypeScript/releases
- TS项目引用:https://www.typescriptlang.org/docs/handbook/project-references.html
- Fastify校验:https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/
- Fastify WS:https://github.com/fastify/fastify-websocket
- Zod JSON Schema:https://zod.dev/json-schema
- OpenAPI:https://spec.openapis.org/oas/v3.1.1.html
- AsyncAPI:https://www.asyncapi.com/docs/reference/specification/v3.0.0
- SQLite WAL/备份:https://sqlite.org/wal.html ; https://sqlite.org/backup.html
- Pipecat:https://github.com/pipecat-ai/pipecat/releases
- LiveKit:https://docs.livekit.io/agents/logic/turns/
- Vite:https://vite.dev/releases
- SDK生成:https://openapi-generator.tech/docs/generators/
- GitHub安全与来源证明:https://docs.github.com/en/actions/reference/security/secure-use ; https://docs.github.com/en/actions/concepts/security/artifact-attestations

上述资料用于核验技术能力,不是本项目已实施证明。Pro原文内上游版本说法若未宿主逐项核实,只能作为待选线索;实施前重核固定版本与兼容。

## 12. 最后一轮裁决与状态

|意见|宿主核验与处理|最终状态|
|---|---|---|
|B1旧快照授权复活|确认原稿未写足授权恢复边界;补恢复代际、撤销对账、进程隔离、最低安全版本、禁止自动重派发|已修订,不是认定产品已复现漏洞|
|B2幂等唯一键歧义|确认digest入唯一键会破坏同requestId参数冲突检测;明确K排除digest、原子占位与unknown保留|已修订|
|B3遗漏语音硬门|本次复读docs/03:64确认P50/P90/样本分母合同;原样保留,P95仅新增|已修订|
|N1竖切与依赖|区分合同模拟与真实生产切片,补owner-stop与具名导入|已修订|
|N2发布闭包|复读release.yml:41-43确认snapshot/public-tree/filter-version;补安装闭包SBOM与pnpm/npm区别|已修订|
|N3成本/矩阵|明确工作量不是自然工期,正式媒体替换等范围另计;三端具名能力分列|已修订|

上一轮用满3次Pro提交,v2按最后意见修改后未再送Pro。本轮用户明确新增1名subagent交叉review,只增加这一次文档审查,不重新调用Pro,不把研究review当产品验收。原稿与原始意见保留。

## 13. 本次交叉评审融合裁决

原始报告:[唯一subagent交叉评审](2026-09-29-modular-foundation-cross-review.md)。被评输入为仓外decision.md v2及implementation-prompt-draft.md,原稿SHA见报告,报告未改写。终稿路径调整、授权消歧、预算修订由宿主完成;不冒称reviewer已读取这份最终字节。

|主张|裁决|证据与处置|
|---|---|---|
|唯一task默认预算不足以走完整PG/RF正常验收|确认|delivery-schema中首次以外的review全部计复审;默认max_rereview_rounds=3最多4次,五个PG阶段已超额。Prompt给新任务具名有界覆盖和预声明检查点|
|把新阶段首评当免费或新建RF账本即可解决|证伪|真实checker累计计数;禁止换阶段/候选/task洗掉历史,旧RED/额度不清零|
|扩大预算意味着每candidate可多派reviewer|证伪|reviewers_per_candidate仍1;合同同一reviewer以安全与可实施性两个互补清单评,不声称双人独立评审|
|新Prompt能够减少普通中途确认|部分成立|完整RF范围与旧owner-stop的新导入授权已明确;预算最多16语义审查/8修复/同因2,不是无限调用;权限/设备/真人/额度真阻塞不能承诺消失|
|现有方案还有新增实质架构/安全/平台阻塞|未发现新增|唯一reviewer定向检查A/B/D未发现新增阻塞;这是审查结果,不是证明源码无缺陷|
|当前实现和所有平台已通过|未验证|本轮无产品测试/真实设备/制品发布;required缺测仍未完成|

Prompt初始化预算以用户在新会话全文提交为生效点:reviewers_per_candidate=1,max_repair_rounds=8,max_rereview_rounds=15,max_same_root_cause_repairs=2,max_procedure_retries=2,max_same_procedure_cause_retries=1。角色仍按当次policy/overlay冻结;限额只覆盖这个新任务,不改全局和旧任务。正常合同1～2次+必要PG5次+RF总集成1次合计7～8次,剩余只供有限修复复核;RED不可伪装checkpoint continue。

收口结论:1项确认阻塞已修订;2项错误规避办法明确证伪;无新增需重设架构的阻塞。当前授权终点为文档交接,实施只在owner新会话提交Prompt后开始。Prompt覆盖RF-00～11全部及必要PG前置,不是试做前三步。正式支持不缩减、外部发布不暗含、required未验不冒绿。
