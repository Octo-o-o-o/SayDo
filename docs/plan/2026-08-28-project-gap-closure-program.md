# SayDo 项目缺口治理总案

> 日期：2026-08-28
> 版本：v7，标准 Git 可执行性收口：补齐签署/被测提交绑定、完整覆盖分母、发布账本与恢复门，仍保持最小两提交及批内检查器（见第 20–22 节）
> 状态：implementation-ready candidate；D17 未签，最终可签性以本文件锁定 bytes 的独立复审与 import spec 输入锁为准；不是当前排产源，也未授权实施
> 审计基线：`280b0cfa1594a8963bed2a4b730734915a3762b0`
> 审计方式：只读代码、canonical、计划、评审与语料；本轮未运行产品测试、构建、真实账号、真实 connector 或设备验证
> 排产关系：`IMPLEMENTATION-PLAN-2.md` 仍是唯一排产源。本文件已给出可直接导入的确定批次与门禁，但只有 owner 在 `2026-08-28-project-gap-owner-decisions.md` 签署 D17、并完成第 14.8 节的标准 Git 两提交导入后才能实施
> 合同关系：本文件不直接定义生产合同。第 1.3 节只是候选词表；采用前必须把状态、迁移权、证据过期与降级规则写入 `docs/06`/`docs/09`，把文案上限写入 `docs/11`。任何合同形状仍以 `docs/09-data-contracts.md` 为准

## 0. 结论

SayDo 已经不是一个“缺少主体代码”的早期原型。它在 coding 主线、持久状态、确认收据、Gate 0、S3 安全、任务执行、移动 dogfood 外壳、首启自检和证据纪律上已有较深基础。当前主要问题是五条成熟度曲线彼此不同步：

1. **工程曲线**已经能支撑开发者 dogfood，但“本地 CI 等效”、默认路由动作、直达验收、非代码证据、隔离、备份和跨平台发布仍有明确缺口。
2. **用户曲线**仍以懂 CLI、API、项目路径和本地 daemon 的工程师为隐含基准；非技术、初级、移动、无障碍、弱网和团队管理员没有同等完整的成功路径。
3. **AI 供给曲线**有一份很完整的专题设计，但生产实现仍是窄协议、窄 provider、窄订阅与执行后端集合；“发现到一个服务”不能等同于“有权、可用、费用明确、适配当前槽位”。
4. **工具曲线**目前主要覆盖 SayDo 内部任务控制与本地工程文件。语料中的 Web、PDF、表格、邮箱、日历、CRM 等 LIVE 工具族是需求合同，不是已接通能力。
5. **语料曲线**很好地覆盖了“用户想做什么”，但没有系统覆盖“不同用户怎样使用 SayDo”；而且 v8 独立评审留下的两条 A 级 LIVE 假闭合仍未处置。

因此，不应继续用“再加 provider 名单”“再加业务问题”“再补几个 UI 按钮”的方式横向扩张。先建立统一的能力真相链，再按可走通的纵向用户旅程推进：

```text
文档声明 → 合同 → 实现 → 默认入口可达 → 故障可恢复 → 门禁验证 → 真实证据
```

只有七段都成立的能力，才可以对用户称为“支持”。只完成前几段的能力分别标为“已设计”“开发者预览”“条件可用”或“路线图”，不能混写。

## 1. 本轮范围与判定方法

### 1.1 本轮回答的五个问题

1. 实施工程质量是否足以继续扩张，哪里会产生假绿、数据损失、安全或发布风险。
2. 资深用户、初级用户、非开发者、移动/弱网/无障碍用户、团队管理员分别能否完成从首启到验收的完整旅程。
3. AI 推理、订阅、API、本地模型与 Execution Agent 的覆盖边界是否诚实、可扩展、可验证。
4. 本地工具与外部 connector 是否足以兑现广域业务场景，读与写的授权语义是否闭合。
5. 600 条问题、16 个上下文包和 72 个模拟会话还漏掉哪些人群、产品阶段、故障和长会话行为。

### 1.2 严重级别

- **A 级**：会造成安全/授权/数据/合同/evidence truth 失真，或让发布门产生假绿；进入任何扩张批次前必须关闭或由 owner 明确降级承诺。
- **B 级**：显著阻断目标用户旅程、恢复能力、平台一致性或可维护性；应进入相邻阶段，不应长期以 TODO 或口头边界存在。
- **C 级**：不阻断主路径，但增加认知负担、运维成本或未来扩展成本；按触发线吸收。

### 1.3 能力成熟度状态

建议建立唯一的 capability ledger，每项能力只能处于下列一个状态。下表在 E0 canonical 回写完成前不能作为生产状态机使用：

| 状态 | 含义 | 用户文案上限 |
|---|---|---|
| `inventory_only` | 只发现名称、安装或配置痕迹 | “检测到，尚不能使用” |
| `designed` | 有方案或草案，没有生产合同/实现 | “规划中” |
| `contracted` | canonical 与 production contract 已落，未接线 | “开发中”，不得出现在默认选择器 |
| `implemented_hidden` | 已实现但无完整默认旅程或门禁 | “开发者预览” |
| `conditional` | 在列明的平台、账户、协议、权限或网络条件下可用 | 明示条件后称“可用” |
| `supported` | 默认入口可达、恢复闭合、门禁与真实证据齐全 | 可称“支持” |
| `deprecated` | 只为迁移保留 | 明示替代与截止点 |

ledger 至少记录：capability ID、用户任务、canonical、合同、实现入口、UI/CLI 入口、平台、账户/权限、费用、数据边界、失败恢复、门禁、证据、owner、最后核验时间和已知限制。

E0 还必须定义：谁有权升降级、证据过期是否自动从 `supported` 降为 `conditional`、distribution/platform 变化如何失效、状态 schema/version/migration，以及生成投影失败是否阻断发布。

产品档位再拆成两条正交轴，避免把 RC、目标人群与支持承诺混成一个词：

- distribution：`source | dev_build | rc | signed | store`；
- audience/maturity：`developer | individual | team` × `preview | supported`。

例如当前推荐是 `rc + developer/preview`，不是“Developer RC”这一项同时承担三个维度。任何
晋级必须分别改变对应轴，不能由版本号、存在移动壳或一条 reference journey 顺带推断。

### 1.4 编号体系导读

本文并存六套编号，各自含义与所在节：

- `G-A1–G-A9`、`G-B1–G-B17`、`C1–C4`：缺口登记（第 3 节）。
- `E0–E9`、`U0–U5`、`S0–S6`（含 S0.5/S0.6、S2a/S2b）、`T0–T6`、`Q0–Q6`：五线计划叶项（第 4–8 节）。
- `Wave 0–5` 与「下一 RC 前置批」：依赖时序透镜（第 9 节），不是排产单元。
- `SP0–SP7`（core/条件子项如 SP2a0/a1、SP2b0/b1、SP2c0/c1/c2、SP3a0/a1）：施工包族
  （14.6）；D17 实际导入的是第 20.3 节 PG exact-set，不是整个 SP 族。
- `D1–D19`：本文件的 owner 裁决项（第 10 节），签署方式见该节引言。
- 「AI 决策 1–10」：`docs/plan/2026-08-24-ai-supply-owner-decisions.md` 的既有编号，与 D1–D19
  是两套体系；本文引用一律带「AI 决策」或「AI supply 决策」前缀。

## 2. 当前值得保留的基础

以下是继续演进应复用的骨架，不应在新计划中重写：

1. `docs/09–11` 已把任务状态、收据、Gate 0、S3、语音和 UI 边界写成相对细的 canonical。
2. 首启配置已经采用 staged → self-test → restart → live self-test，且对长 CLI 自检给出四步进度；见 `packages/console/src/components/SetupWizard.tsx:114-207`。
3. Brain 工具注册表把未知工具、坏参数和 handler 失败折叠为模型可读错误，并且现役工具覆盖项目锚定、任务、确认、状态、取消、评审、重试、记忆、Focus 和本地项目文件；见 `packages/daemon/src/brain/registry.ts:1-56`、`packages/daemon/src/brain/liveTools.ts:555-2515`。
4. 600 条问题在 12 个业务领域、风险等级、上下文来源和 F1–F4 能力边界上有系统结构；72 个会话也已具备 fixture、oracle 与诚实的 mock 边界。
5. AI 供给专题已经覆盖协议、订阅、API、本地服务、发现、费用、数据边界与分阶段验收；本计划只负责把它放回全项目优先级，不另造一份竞争方案。
6. 移动端已经明确区分 dogfood 临时 LAN 面与可信设备模型，没有把当前 cleartext/token 外壳包装成正式安全配对。

## 3. 当前缺口登记

### 3.1 A 级

| ID | 缺口 | 静态证据 | 必须结果 |
|---|---|---|---|
| G-A1 | customer corpus 的 LIVE 来源存在假闭合 | 本轮对当前基线只读统计得到 986 个 `source_kind`，其中 752 个 locator 含 `USER-PROVIDED`、234 个含 `authorized-project-root`；当前 `LIF.json:267-363`、`WRT.json:1-40` 仍可见来源种类与 required fields 污染。v8 评审的系统性分析见 `research/codex-findings/178-customer-question-corpus-final-independent-review-v8.md:57-125`，而 README 仍称“具体现势对象来源”，见 `research/customer-question-corpus/README.md:15-16,32,60` | 先修合同与 validator，或把 986 个对象降级为“待解析需求模板”；未处置前不得把该 corpus 当 connector readiness 证据；修复前后都输出绑定 commit 的 machine report |
| G-A2 | “本地 CI 等效”存在假绿可能 | `justfile:7-31`、`package.json:14`、`.github/workflows/ci.yml:24-104` 是三套非同构、互有缺项的门集；eslint 还显式忽略全部 `*.mjs`，见 `eslint.config.mjs:4-8` | 建立一个机器可读 gate/workflow manifest，统一命令与 GitHub 控制流；本地等效必须按平台明确“全等”或“可证明子集” |
| G-A3 | 产品合同、默认入口与现役动作不全等 | canonical 把“直达验收/逐步确认”并列，见 `docs/02-product-definition.md:32-35`；生产对 `direct_to_review` 返回 `direct_mode_not_wired`，见 `packages/daemon/src/brain/liveTools.ts:985-991`。正式路由已切 redesign，见 `packages/console/src/App.tsx:47-49,80-88`；其中既有 toast/TODO，也有 `abandon` 实际调用 archive、未知预算投影 `0/0 CNY` 的错误语义，见 `RecordsPageRoute.tsx:70-83`、`hooks/redesign/mappers.ts:255-279`；该占位再被 `components/redesign/ExpectationGroup.tsx:63`、`ProgressAlignCard.tsx:31` 如实渲染为 `¥0`，违反 `components/ui.tsx:92` 自述的 unknown 禁 0 纪律 | action ledger 同时检查 `unreachable`、`wrong_semantic_target`、`fabricated_projection`；每项绑定预期 request、durable transition、禁止 transition 与用户文案；直达验收要么收窄 canonical/隐藏入口，要么完整接线后再开放 |
| G-A4 | AI 订阅、费用和协议的现役公共文案超过生产事实 | 现役部署首页仍称“已订阅哪家用哪家、无需额外付费”和“任一 OpenAI 兼容 API”，见 `deploy/saydo-octoooo-com/index.html:294,370,388,475`；UI 也称任意兼容端点，见 `packages/console/src/components/SupplyPicker.tsx:272-283`。生产却会把一般 `logged_in` 推为 subscription，并固定走 Bearer `/chat/completions`，见 `packages/daemon/src/config/cliCapability.ts:600-641`、`packages/daemon/src/providers/openaiCompat.ts:75-148` | Wave 0 扫描并降级 README、active listing projection、`deploy/saydo-octoooo-com/**` 中英文页面、templates 与 console claim；无 rights evidence 不称订阅内零成本，无协议 TCK 不称任意兼容；Anthropic Messages adapter 前隐藏或 hard-block 官方直连 |
| G-A5 | 数据库升级没有前向 schema 拒绝与迁移前恢复点 | `packages/daemon/src/storage/db.ts:11-24,39-71` 打开即迁移，只取未应用版本，不拒未来版本、缺口或非前缀集合；`packages/daemon/src/backup/cli.ts:16-29` 先调用会迁移的 `openDb` 再备份 | 启动先只读识别 schema；未来/缺口/乱序 fail-closed；生产迁移前生成 recovery snapshot，并先在复制库全迁移 + `quick_check`；旧 binary 明确拒开新 schema；backup CLI 不调用迁移型 open |
| G-A6 | 远程/移动配对把长寿命全局 owner token 放入明文 URL 与 localStorage，部署文案又误述存储与审批能力 | `packages/console/src/lib/api.ts:20-27,47-55` 从 URL 落 localStorage、未去参且 WS 重带 query；daemon 侧 `packages/daemon/src/net/capToken.ts:11-21` 是持久全局 token；`packages/daemon/src/net/pairUrl.ts:25-34` 生成明文 URL。现役首页称手机审批封顶 S2，见 `deploy/saydo-octoooo-com/index.html:490`，现役 Docs 却说明 LAN 面不裁决 S2/S3，见 `deploy/saydo-octoooo-com/docs/index.html:810`；隐私页还错误声称 token 在系统安全存储，见 `deploy/saydo-octoooo-com/privacy/index.html:92` | 关闭正式远程业务 payload；只保留无业务数据的 health/static shell。未来由 D18 + ADR 唯一选择 authenticated encrypted transport、trust root、issuer/store、兼容窗与恢复方案，再用短 TTL 单次配对码交换逐设备最小权限凭据；URL 去参、长寿命 bearer 不进 query、逐设备撤销、同源导航 |
| G-A7 | 首次 AI 请求前缺 endpoint/principal/secret/rights/funding/data 的共同 admission | 未知端点共用 `OPENROUTER_API_KEY`，配置先写而 secret 后写，随后 resolver 读取 secret 并用 Bearer 发包，见 `packages/console/src/lib/setupApi.ts:1334-1389,1414-1418`、`packages/daemon/src/providers/resolve.ts:80-89`、`providers/openaiCompat.ts:113-118`；登录态与权益推断见 `config/cliCapability.ts:574-641` | 在协议接线前落最小 pre-send admission。identity/egress/rights/data 任一 unknown 必须零 secret read、零 packet；funding unknown 仅保留 owner 已签的逐次确认 + request/token/physical hard cap 路径，禁止推荐、fallback、后台调用与持久自动路由 |
| G-A8 | 自动发现会执行第三方程序并读取第三方状态，未满足静态发现边界 | Setup 首载自动触发 probe，见 `packages/console/src/components/SetupWizard.tsx:1096`、`packages/daemon/src/index.ts:1101`；probe 会执行 `--version/--help/-h`、auth/model 并读取 session/config，见 `config/cliCapability.ts:899-949,1098-1207` | 自动阶段只读静态属性、签名与公开 metadata：零 PATH 程序、零 packet、零 token/session/history/prompt open；主动 probe 必须由用户显式触发、绑定 binary identity 并进入 cage；未关闭前禁用自动推荐 |
| G-A9 | audit sink 可把模型原句、用户理由和空间标题永久写入不可变审计 | SQLite audit sink 接受并原样序列化任意 `meta`，见 `packages/daemon/src/storage/dao/misc.ts:83-100`；生产调用会传模型句子原文片段（截断 80 字符、仍为明文非 digest）、用户理由与标题，见 `packages/daemon/src/live/dialog.ts:1015-1021`、`api/focuses.ts:142-152`、`api/spaces.ts:47-100`，违反 `docs/modules/e-crosscutting.md:24-28` 的敏感 payload 只记 digest | audit action 使用判别联合与逐事件 schema；sink 层拒绝 raw text/secret/path，只允许 digest/ref 与明确无敏字段；迁移或处置既有敏感行；原文注入 mutation 必须失败。logger 容量/背压仍留 B 级 |

G-A1 当前统计使用的只读命令是：

```bash
rg -o '"source_kind"' research/customer-question-corpus/contracts/live/*.json | wc -l
rg -o 'USER-PROVIDED' research/customer-question-corpus/contracts/live/*.json | wc -l
rg -o 'authorized-project-root' research/customer-question-corpus/contracts/live/*.json | wc -l
```

本轮原始输出依次为 `986`、`752`、`234`；另以逐对象方式复核（对每个含 `source_kind` 的 JSON 对象判断 locator 构成），752 与 234 是互斥的对象数、合计恰为 986，出现次数与对象数一致。这组计数只证明 locator 构成；字段污染的语义下界仍以当前 JSON 反例和 v8 全量评审为输入，Q0 必须生成新的当前 machine report。

### 3.2 B 级

| ID | 缺口 | 静态证据 | 方向 |
|---|---|---|---|
| G-B1 | 非代码产物的证据快照器不足 | `packages/daemon/src/evaluator/snapshotter.ts:1-7,60-73` 只支持 `repo_file`、`user_edit`、`user_utterance`，`web`/`artifact` fail-closed unsupported | 在启用 research/writing/marketing 前补 artifact 与受控 Web snapshot，并把 provenance、freshness、内容摘要与重放验证纳入 settle proof |
| G-B2 | Tier1 沙箱不能阻止绝对路径读取与出站网络，verify 仍有 TOCTOU 留白 | `packages/daemon/src/tier1/executor.ts:222-229`、`packages/daemon/src/tier1/verifyFreeze.ts:62-69` | 分平台列出可证明隔离与不可证明隔离；高风险 route 不依赖提示词或事后 tripwire；verify 绑定不可变输入与产出 |
| G-B3 | 备份只完整支持活动 `local_folder` 工作区 | `packages/daemon/src/backup/snapshot.ts:446-480` 对其他活动 workspace 类型硬失败 | 先定义每种 workspace 的 backup/restore/RPO/RTO；不支持者在创建与升级前明示，不能等备份时才失败 |
| G-B4 | 初级用户仍需理解内部供给结构 | 首启/设置暴露 CLI/API、多个模型槽、评估隔离与 Gate 0/Tier1；见 `packages/console/src/components/SetupWizard.tsx:1435-1593`、`packages/console/src/pages/GlobalSettings.tsx:232-335,460-645` | managed-first 主路径只问用户拥有的账号/是否接受新增费用/数据边界；槽位、协议、family 与 evaluator 放高级模式 |
| G-B5 | 非技术用户与广义非开发项目的承诺尚未形成默认可用主线 | 产品定义把 coding 工程师列为 P0，非技术负责人为 P3，非开发项目为 P2；见 `docs/02-product-definition.md:5-15`。语料能力边界中缺省完整 F1 仍主要是 coding | owner 先决定产品承诺：若近期仍是 developer RC，则收窄首页/README；若要普适用户，则按本计划 U/N 纵切片补齐，不用业务问题数量代替实现 |
| G-B6 | 移动端是平台不对称的 dogfood 外壳 | iOS/Android/HarmonyOS README 均披露未完成设备信任；Android/HarmonyOS 仍是 cleartext WebView 路径，iOS 才有原生语音胶囊；见 `apps/ios/README.md:12-22`、`apps/android/README.md:13-24`、`apps/harmonyos/README.md:12-26` | 建平台 capability parity 表；每个平台按文字、语音、确认、离线、通知、设备信任逐项标级，不用“有 app”代表完整移动能力 |
| G-B7 | 无障碍、语言、弱网不是一等合同 | `docs/11-ui-spec.md:536-541,566` 只给基础 focus/对比度/点击目标卫生线并明示不提供字号缩放；Web 与 iOS 语音路径固定 `zh-CN`；corpus 自认手机原生、低数字熟练度、多语言与无障碍没有独立大样本，见 `research/customer-question-corpus/02-覆盖索引.md:80`；弱网是本轮登记的新缺口、无既有语料锚 | 把 accessibility、locale、device、modality、connectivity 放入用户旅程合同和门禁，不能再由自由文本角色或关键词推断 |
| G-B8 | 72 个模拟会话不能代表长会话与跨会话恢复 | schema 允许 R3/R4，但当前计划只要求每会话至少 3 轮，生命周期只有九类；见 `research/customer-question-corpus/simulations/01-schema.md:30-110` | 保留短会话集，另建 10+ turn 与跨 session journey 集；覆盖约束漂移、摘要/记忆重载、崩溃、重复送达和多故障组合 |
| G-B9 | fixture 故障分类不足以验证真实外部副作用 | fixture 状态只有 ok/empty/stale/conflict/permission_denied/partial/no_tool，且每会话只有一个扰动；见 `simulations/01-schema.md:46-80` | 增 rate limit、auth expiry、timeout、schema drift、pagination、partial write、delivery unknown、duplicate callback、idempotency、MFA、account ambiguity、tool prompt injection |
| G-B10 | HarmonyOS 的发布证据无法由公共 CI 重放 | `.github/workflows/ci.yml:106-107` 明确没有标准 runner；`apps/harmonyos/README.md:64-75` 记录 fresh hydrate 受上游 502 阻塞 | 把它标为 local witnessed/unsigned preview，并建立签名环境、工具链版本、依赖镜像与 detached 证据；在此之前不称多平台 release parity |
| G-B11 | 工具需求覆盖与生产 connector 能力不在同一成熟度账本 | 现役 Brain 工具是内部任务、记忆、Focus 和本地项目读面；语料使用 Web、SaaS、PDF、表格、邮箱、日历、CRM，但明确模拟不证明 connector 接通，见 `packages/daemon/src/brain/liveTools.ts:555-2515`、`research/customer-question-corpus/00-能力边界.md:21-34` | 新建 Tool/Connector Plane；UI、README、语料把需求覆盖与可执行覆盖分栏，mock/合同不升为 supported |
| G-B12 | 公开一键包不含核心语音与完整生命周期 | 产品核心包含语音驱动 agent，见 `README.md:3-4`；发布入口却明确只含 daemon+console，不含 pipeline/常驻/生产移动配对，见 `README.md:18-33`、`packages/cli/README.md:18-22` | owner 二选一：把当前包命名为 daemon/console Developer Preview；或立产品级分发批，包含 voice runtime、doctor、service、upgrade/uninstall、backup/restore |
| G-B13 | 常态 CI 的 fixture 证据不能外推真实 provider/agent/恢复/真机 | live agent 与慢恢复测试默认条件 skip，见 `packages/daemon/test/tier1-live.e2e.test.ts:1-7`、`p05b-recovery.e2e.test.ts:1-22`；Playwright seed fixture，移动多为 simulator/debug | 建 PR hermetic、nightly 小预算 live、RC 真 agent/provider/kill-9、签名真机四层 evidence matrix；release-required case 被 skip 必须失败 |
| G-B14 | logger 缺机械的容量、背压与故障隔离 | `packages/daemon/src/obs/logger.ts:50-60` 每条同步 append、无 retention/backpressure/error isolation，fields 可覆保留键 | 有界异步 logger、drop/backpressure 指标、磁盘满降级、容量/天数治理与保留键反例；audit 隐私已单列 G-A9 |
| G-B15 | Console 与 daemon API DTO 手工镜像，核心模块继续膨胀 | `packages/console/src/lib/api.ts:163-185` 明写“镜像；宽松记录型”，客户端无共享 runtime parse；多个 composition/state 文件已承担过多职责 | 新增 API 必须共享 `@saydo/contracts` schema 并两端 runtime parse；按依赖方向和状态机不变量拆边界，不以行数本身为 KPI |
| G-B16 | 下一 release candidate 仍由 rc.12 专用程序驱动 | `.github/workflows/release.yml:3-7` 与 `scripts/post-release-gate.mjs:78-80` 固定 rc.12，生产入口需同步手改多处 | 用 candidate manifest 生成 active workflow、asset、notes/site marker；历史 evidence immutable；dry-run 输出 exact mutation set并拒绝 active 旧 tag |
| G-B17 | pipeline self-exec 会无条件删除显式进程语音凭据 | `pipeline/src/saydo_pipeline/__main__.py:64-74` pop 三项 env，与前段“显式 export 保留”语义冲突；`pipecat-ai` 依赖也未见生产 import | 仅清带来源标记的旧 `.env` 注入值；覆盖 env-only/.env/pending promotion；Pipecat 用 ADR 二选一采用或移除，并补 TTS 超时/取消/畸形帧/恢复门 |

### 3.3 C 级

C 级不阻断主路径，按触发线吸收；每条登记唯一归属包与触发线，触发前只保持登记、不施工：

1. C1：root/private packages 的版本与 CLI RC 版本采用不同节奏，需补版本治理说明，避免支持与诊断时误判。归属 SP3b 条件包；触发线为下一次 release 收口，或首次因版本误判产生支持成本。
2. C2：ESLint 只覆盖 `packages/*/src/**/*.{ts,tsx}`；大量 `.mjs` 门禁与迁移脚本只能靠各自自测，后续应引入适合脚本层的静态检查，而不是简单取消 ignore 后制造噪声。归属 SP3a0/1 的对应 gate consumer；触发线为相关 gate manifest 批开工，或脚本出现真实缺陷。
3. C3：多处内部术语直接进入用户界面；专业模式可保留，但普通模式应使用任务、费用、隐私和失败结果语言。归属 SP4；触发线为 D1 选择扩圈后随 U1 主路径改写。
4. C4：当前 corpus 的 H/M/L 是专家先验，不是客户频率；用户研究或遥测到位后应覆盖先验，不为旧分布辩护。归属 SP7 校准。

## 4. 计划 A：工程质量与可信发布

### E0 · 真相基线与可达性清单

**目标**：先知道“实际有什么”，再继续加能力。

交付：

1. 首批机器可读 capability ledger 只覆盖 active public claims、当前 release profile、当前默认路由和 required gates；其余 canonical 能力先进入 inventory backlog，不把全库建模作为 Developer Preview 的开工前置。
2. 默认 desktop/mobile/CLI 路由的 action truth 图：按钮或 Brain tool → request schema → API/handler → 预期 durable transition/禁止 transition → audit/evidence → 用户文案。
3. 首批以小型 schema、validator、claim-root checker 和一份 support matrix 对账高风险现役声明；出现第二个 distribution 或第二次跨输出漂移后，才另开生成器批，把 README、release metadata、实际 `deploy/` 树、templates、console UI 与测试手册改为受控投影。
4. 清理或降级 G-A1、G-A3 中的失真声明。
5. 首批只增加有现役消费者的 `capability-ledger.schema`、active claim root 清单与 checker gate log；
   owner decision SHA、included/deferred exact-set 直接进入 batch evidence。只有第二个 distribution 或
   第二次跨输出漂移实际触发生成器批后，才定义投影 manifest/receipt，不在 bootstrap 预建。

验收：

- 默认入口不存在无 handler、指向错误状态或伪造投影的承诺型动作。
- canonical 中每个“已支持”能力都有现役实现与 gate；代码中每个默认可达能力都有 canonical。
- `inventory_only`/`designed` 不能被推荐器选中。
- 首批 ledger 与 active high-risk claim roots、当前 support matrix 的 in-scope exact-set 全等；漏现役根、漏 claim 或未登记人工修改使 checker 非零退出。尚未采用生成器的输出不伪称 generated。

### E1 · 单一门禁清单

**目标**：消除 `just ci`、package script、GitHub Actions 三套事实。

交付：

1. 一份 gate/workflow manifest，除 gate ID、命令、平台、依赖、required/optional、预期退出码、证据 schema 与 TTL 外，还记录 trigger/ref、job/step、matrix、`needs`、`if`、`continue-on-error`、runner、timeout、permissions、skip 条件和 release dependency graph。
2. 本地、CI、release workflow 从 manifest 生成或逐项对账。
3. `just ci` 输出明确区分“当前平台全量门”“其他平台待证门”，不再笼统宣称跨平台等效。
4. 把 docs links、notices、distribution、week audit 与移动发布门纳入同一账本。

验收：

- 每个 CI release-blocking step 在 manifest 中恰好一条；每个 manifest blocking gate 在目标 distribution 对应环境真实执行。
- 本地缺平台能力时可以输出 `[warn] not witnessed on this host`，但 `supported`/release profile 的 required gate 未 witnessed 时整体必须非零；warn 只允许 preview/conditional profile。
- 门禁失败的退出码、日志、SHA 与被测 commit 绑定。
- mutation 至少覆盖删除 matrix OS、恒假 `if`、`continue-on-error`、断开 `needs`、required step skipped 和权限/timeout 被收窄；命令存在但控制图不可达必须判红。

### E2 · 用户动作与状态机闭环

**目标**：关闭默认 UI TODO、直达验收和状态转换断层。

交付：

1. 对 Focus/Review/Records/Decision Package 每个动作逐项作“实现、隐藏、降级为导航”三选一。
2. `direct_to_review` 单独立项：preauthorized effects 推导、确认话术、预算、撤销、S2/S3、执行器、审核证据和负例全部闭合；若本期不做，保留其设计合同并标 `designed/deferred`，active capability/default route/UI 与公开文案收窄到 `step_confirm`，不删除兼容读取所需 schema。
3. 取消、重试、改需求、打回、人工合并、忘记等动作均绑定幂等键、旧 attempt 隔离和恢复说明。
4. 先修正式 redesign 的语义错误：`abandon` 只能落 `abandoned`，不得调用 archive；unknown budget 不得投影数值/币种；收集 project path 的控件要么删除，要么落到已声明关系。

验收：

- action truth gate 的 denominator 是所有默认可见/Brain 可调用动作，逐项校验 request schema、预期 transition、forbidden transition、projection 与 copy。
- 所有承诺型动作都有成功、拒绝、超时、重放、旧状态和重启恢复门。
- 不再存在默认可达的 `TODO`/toast-only action。

### E3 · 数据、恢复与可观察性

**目标**：从“能运行”升级为“故障后仍能解释与恢复”。

交付：

1. SQLite、audit、outbox、knowledge、foundation、workspace、secret/config 的 RPO/RTO 表。
2. 每种 workspace 的 backup/restore 合同；不支持类型在入口前 fail-closed。
3. provider、tool、execution、callback、mobile 的统一 error taxonomy 与 correlation ID。
4. 资源预算：队列深度、会话数、provider rate limit、磁盘、备份、日志、审计增长与清理策略。
5. 数据升级控制面：只读 schema probe、supported range、迁移前 recovery snapshot、复制库 dry-run、生产晋升、downgrade 拒绝与 restore rehearsal；backup CLI 使用不触发 migrate 的只读 open。

验收：

- 每种 durable store 都有“故障点→恢复动作→用户可见结果→audit”表。
- restore 产物必须在隔离目录验证完整性，不能覆盖现役状态后再检查。
- `delivery_unknown` 一类外部副作用不会被自动重试，必须先 reconcile。
- schema probe 使用 read-only/immutable 形态；`current+1`、缺口/乱序 migration 集均使旧 binary 非零退出，并要求主 DB、`-wal`、`-shm`、`-journal` 的存在 exact-set、bytes digest 与 `schema_migrations` exact-set 前后全等；每个 migration 边界故障后原库或恢复点可用。

### E4 · 隔离、凭据与供应链

**目标**：把目前“不可证明”的安全边界变成显式产品限制或可验证机制。

交付：

1. 按 macOS/Windows/Linux 和 execution backend 的文件、网络、进程、HOME、secret、hook/MCP 暴露矩阵。
2. 出站域、代理、云 metadata、redirect、DNS rebinding、mTLS、企业 CA 的策略；本轮以声明边界为主，未选中的企业网络形态明示 unsupported，不为其实现支持。
3. binary identity、版本、下载 provenance、plugin/connector 来源与升级回滚。
4. threat model 覆盖 prompt injection、tool output injection、workspace 恶意文件和外部页面。
5. 远程信任面：当前关闭业务 payload；未来由 D18/ADR 选择唯一 authenticated encrypted transport 与 trust root，再实现一次性配对票据 → per-device scoped credential、逐设备撤销/轮转、URL 去参、同源导航与匿名 health 最小化。
6. AI 静态发现面：自动阶段零程序/零 packet/零第三方 secret/session/history/prompt open；显式主动 probe 绑定 binary identity 与 cage。

验收：

- 每条“隔离”声明都绑定可机械验证的 enforcement；其余统一写“不可证明”并限制 route。
- secret 不进日志、语音、artifact、tool result 或可提交树。
- 高风险路径没有仅靠 prompt 的安全控制。
- 恶意 PATH、session/history open、packet recorder、配对过期/重放/撤销/Referer/恶意导航反例均 fail-closed。

### E5 · 非代码证据平面

**目标**：让 research/writing/marketing/planning 的“验收”不再套用 git 假设。

交付：

1. artifact snapshot、受控 Web snapshot、document/spreadsheet evidence 的不可变引用与 digest。
2. source authority、freshness、as-of、引用片段、版权/隐私和用户材料分层。
3. 每项目类型的 settle proof 与 review UI。

验收：

- 启用一个项目类型前，其 required evidence source 全部有 snapshotter 与 verifier。
- 证据无法冻结或已过期时，状态只能是 unknown/waiting，不得落 ready_for_review。

### E6 · 平台与发布分级

**目标**：不同平台各自诚实，而不是追求名义对齐。

交付：

1. macOS/Windows/Linux/iOS/Android/HarmonyOS 的 install、upgrade、uninstall、voice、text、approval、notification、offline、device trust、auto-start 矩阵。
2. release channel：developer source、RC package、signed desktop、mobile preview、store-ready。
3. 每档支持期限、诊断包、回滚路径与最低复现证据。

验收：

- 发布页只从矩阵生成支持声明。
- 每项 capability 规定 evidence TTL；超期自动降级，未被当前 CI/实体设备证明的平台显示 age 与限制。

### E7 · 产品级分发与分层真实证据

**目标**：解决“控制面 package”与“能说话并派 agent 的产品”之间的交付断层。

交付：

1. owner 选择：当前包明确标为 daemon/console Developer Preview，或把 voice runtime、provider doctor、service lifecycle、upgrade/uninstall、backup/restore 纳入同一 installer。
2. evidence matrix：PR hermetic、nightly 小预算 live account、release candidate 真 provider/agent/kill-9、签名实体设备；每项登记 selected/skipped/passed/failed。
3. live evidence 绑定 binary、model、account realm、funding、platform、commit、expiry 与 cleanup；fixture 证据不能投影成 live。

验收：

- Developer Preview 的 support matrix 自动断言 `voice=false`；若宣称完整产品，固定 release asset 必须在全新目标机完成真麦一轮 → 真实派发 → 回叫 → 验收。
- release-required live case 被 skip 或证据过期时整体非零。

### E8 · 可观察性与 API 边界

**目标**：让故障观测不反过来杀死业务，也阻止 API 合同继续手工漂移。

交付：

1. 先关闭 G-A9：audit action 判别联合与每事件 schema；sink 层拒绝 raw text/secret/path，敏感 payload 只收 digest/ref；对既有敏感行给迁移、轮换或 owner 处置方案。
2. 有界异步 logger、drop/backpressure metric、磁盘满降级、固定容量/天数；保留键不可被 fields 覆盖。
3. Console/daemon HTTP request/response schema 移入 `@saydo/contracts`，server/client 使用同一 runtime parse；禁止新增 mirror DTO。
4. 以依赖方向、状态机不变量和失败注入拆 composition/routes/adapters；不以文件行数本身作为通过条件。

验收：模型句子、用户理由、标题、secret/path 的原文注入 audit 全部被 schema/sink 拒绝；磁盘满或普通 logger sink 失败不改变主状态机终态；API inventory 每一路都有 shared schema ID 或已登记的迁移期限；新增镜像 DTO 为零，本批 selected inventory 完成双端 runtime parse，存量按 G-B15 的期限迁移；被拆模块无循环依赖。

### E9 · Release 参数化与 voice restart

**目标**：下一 RC 不再靠手改 rc.12 常量，同时修复 pipeline self-exec 的确定性凭据丢失。

交付：

1. candidate manifest 生成 active workflow input、asset path、notes、site marker；历史 release/evidence immutable。
2. `release plan --dry-run` 输出 exact mutation set，active tree 残留旧 tag 失败。
3. pipeline 凭据带 source marker，只清旧 `.env` 注入值；覆盖 env-only、`.env`、pending promotion 三态。
4. Pipecat ADR 二选一：真正采用或移除依赖；补 TTS 畸形帧、超时、取消、provider restart 规格。

验收：仅改 candidate manifest 即可生成下一候选的全部 active 输入；历史证据零改动；三种凭据来源 self-exec 后值与优先级符合合同。

## 5. 计划 B：不同用户的完整使用路径

### 5.1 先定义“完全使用”

对任一目标人群，“完全使用”不是看见首页或能发一句话，而是能独立完成：

```text
获得产品 → 安装/进入 → 选择合法供给 → 建立或锚定项目 → 表达任务
→ 澄清与就绪 → 审阅决策包 → 安全派发 → 中途控制/失败恢复
→ 审阅证据 → 验收/打回/交付 → 续接、备份、导出或删除
```

每类用户必须指定哪些环节由用户完成、哪些由管理员或受信桌面完成。无法独立走完的，只能称“伴随使用”或“只读使用”。

统一 journey responsibility matrix：

| 人群/条件 | 安装与供给 | 任务与恢复 | 高风险审批 | 验收/导出/删除 | 可宣称边界 |
|---|---|---|---|---|---|
| 初级个人用户 | 系统引导，普通模式不暴露内部槽位 | 应可独立完成一个 supported 纵切片 | 受信屏幕、人话说明 | 应可独立完成 | 仅已走通的纵切片 |
| 资深个人用户 | 可配置、导出、diff、回滚 | 可精确诊断和控制 | 可检查 receipt/policy | 可检查证据与 provenance | 条件与限制全部显式 |
| 非开发用户 | 不以 repo/path 为全局前提 | 按获批项目类型闭环 | effect 独立确认 | artifact review/export | 只宣称已闭合项目类型 |
| 移动 companion | 由受信桌面建立逐设备身份 | 按 capability 分 read/control | D18/ADR 与逐设备信任未闭合前关闭业务 payload | 未来可为只读或受限辅助 | 当前 `unsupported`；未来按 `read-only`/`assisted`/`supported` 分级 |
| 弱网/断网 | 安装不作特殊承诺 | 必须区分未送达/已送达/结果未知并可恢复 | 结果未知不盲重试 | 以 durable truth 对账 | 不把禁按钮当离线支持 |
| 无障碍用户 | 关键 setup 可由目标模态独立操作 | 全程不依赖单一颜色/声音/悬停 | 风险、期限、动作顺序可读 | 证据与操作可达 | 每类 access need 独立分级 |
| 非缺省 locale | 仅获批 locale 可独立 setup | UI/ASR/TTS/时区/币种分别标级 | 确认语义不因翻译弱化 | locale 不改变 durable truth | 不以“能产出翻译”冒充 UI 国际化 |
| 团队管理员/成员 | 仅 D8=preview 时启用组织路径 | 角色与策略决定能力 | 审批人身份可验证 | audit export 与离职撤权闭合 | D8=后置时只验证正确拒绝 |

### U0 · 产品承诺分层

owner 先选择并写入产品定义：

- **`rc + developer/preview`**：工程师 coding 是唯一完整主线；其他场景明确为需求研究或 capability preview。
- **Individual general availability**：初级与非开发者至少各有一个不依赖 CLI 术语的完整纵切片。
- **Team/enterprise preview**：管理员、成员、审批者、离职撤权、策略与审计具备最小闭环。

三档可以依次存在，但 README、首页和发布页必须显示当前档，不得同时借用三档的最好文案。

### U1 · 初级用户 managed-first

目标用户不知道 CLI、API key、Base URL、模型 family、项目路径或 Gate 0。

主路径：

1. 先问“你已有哪种账号/是否愿意新增按量费用/数据能否离开本机”，由系统生成推荐。
2. 如果没有可合法复用的供给，给唯一下一步，不把四槽和协议同时抛给用户。
3. 提供安全示例项目或系统管理的非代码工作区，让用户不先选路径也能理解价值。
4. 首个任务限制在一个真实 `supported` 纵切片，展示正在做什么、卡在哪里、如何恢复。
5. 高级设置始终可见但不阻塞普通路径。

验收：

- 用户不接触 `daemon`、`family`、`evaluator`、`Tier1`、`Base URL` 也能完成首个支持任务。
- 没有供给、只有消费订阅、key 无 billing、限流、登录过期均有单一可执行恢复动作。
- 不会因“自动推荐”产生未确认的新按量费用。

### U2 · 资深用户 composable-first

资深用户需要的不是更多向导，而是可预测、可导出和可诊断：

1. 每槽独立 provider/model/protocol/realm/principal/预算/数据边界。
2. 项目级覆盖、命令行配置、dry-run、diff、导入导出和回滚。
3. routing/fallback 的精确顺序、触发条件、费用上限和禁止降级项。
4. tool/connector 账户、scope、读写能力与 receipt 可检查。
5. provider/tool/execution 的结构化日志、trace 与错误处方。

验收：

- 配置可重复应用且 secret 与非 secret 分离。
- 同一结果可解释“用了谁、为何路由、花费归谁、数据去了哪里、调用了哪些工具”。
- 自动 fallback 永不改变费用或数据边界，除非已有匹配策略或本次授权。
- 从安装/导入配置到任务、失败恢复、验收、导出/删除的每一阶段，都有 CLI 或高级 UI 入口；不能只证明配置页可用。

### U3 · 非开发者与非代码项目

不按“覆盖 12 个业务领域”开批，而按一个个端到端产物类型开批：

1. research：Web/source snapshot → 报告 → 引用/时效 → 人审。
2. writing：用户论点与素材 → 草稿/版本 → 逐节验收 → export；发布仍是独立 effect。
3. planning：访谈 → 文档体系 → 决策/未知项 → 可开工评审。
4. marketing/operations：只在对应 connector、证据和写前收据闭合后启用。

验收：每启用一种项目类型，readiness、demo、artifact、verify、review、export、memory 和 failure recovery 必须同批闭合。

### U4a · 移动

按 text/status/notification/voice/confirmation/runtime approval/admin capability 分别标 `read-only`、`assisted`、`supported` 或 `unsupported`。逐设备信任关闭前，不允许任何 transcript、memory、attention、project 或其他业务 payload 读写；只保留无业务 payload 的 health/static shell 与回受信桌面的安全跳转。所谓 dogfood 不构成降低信任要求的理由。

验收：设备丢失、撤销、重放、换网、App 重启和桌面离线均有确定终态；高风险卡片不会因“手机有界面”取得权限。

### U4b · 弱网与离线

定义 online/high-latency/intermittent/offline/reconnected，以及每种 action 的 queue policy、idempotency、expiry 和 reconcile。不能只把按钮置灰后丢弃用户意图。

验收：用户始终能区分“本地未提交”“服务已收”“外部 effect 已发生”“结果未知”；断线恢复不会重复派发、重复批准或把旧 receipt 复活。

### U4c · 无障碍

独立覆盖 keyboard-only、screen reader、低视力/200–400% zoom、听障字幕、运动障碍/voice-only、reduced motion 与认知负担。每一类注明完整使用、伴随使用或当前不支持。

验收：关键审批信息和动作不依赖颜色、悬停、声音或单一模态；focus order、live region、倒计时公告、风险/期限/按钮顺序有可判定 oracle。

### U4d · locale 与语音现象

locale 拆开 UI、ASR、TTS、输入内容、输出内容、日期时区、数字与币种。语音另覆盖打断、沉默、否定优先、肯否混合、背景肯定词、中英混说、同音专名、低置信和转写超时。

验收：每个获批 locale 单独声明上述子能力；未获批 locale 的正确行为是诚实限制或拒绝，不能用“可翻译内容”冒充产品 UI/ASR/TTS 支持。

### U5 · 团队与企业

本项在 owner 选择 team/enterprise preview 前不实施，但要预留边界：组织身份、成员角色、策略锁定、provider allowlist、预算、DLP、retention、审批人、共享项目、审计导出、离职撤权和数据 residency。P0 单用户数据模型不能被 UI 上一个“团队”标签冒充。

- 若 D8=`preview`：验收组织创建 → 成员加入 → 管理员策略/预算 → 成员任务 → 指定审批者 → audit export → 离职撤权，并含跨组织访问、旧成员凭据和无权审批负例。
- 若 D8=`后置`：语料只验证能力边界、正确拒绝和不冒充支持，不把管理员问题计作成功 journey。

## 6. 计划 C：AI 服务、订阅与 API 覆盖

### 6.1 不另造第二份 AI 供给计划

执行优先级必须是：owner 已签决策 → `IMPLEMENTATION-PLAN-2.md:151-184` → AI supply 专题正文。后者残留的 Codex App Server、外部 SDK、TUF、第三方 pack/code plugin 条目不能覆盖已签决策。本总案增加四个全项目约束：

1. supply ledger 必须接入第 1.3 节 capability maturity，不能只看 provider 名单。
2. AI 推理/Execution Agent 与第 7 节工具 connector 分平面治理；ACP 不等于通用业务工具接入。
3. 每个生产 phase 必须交付一个真实纵向旅程，而不是只下沉大批类型。
4. AI supply 的 scoped rows 直接进入 capability ledger 与本批 evidence，以
   `(plane,product,edition,realm,surface,protocolVersion,driver,distribution,maturity)` 为 key 做 exact set，
   并在 evidence 绑定 owner decision SHA：AI 决策 2 的六项 ACP 产品逐行 included/deferred，Hopper 标
   既有依赖，Codex `codex exec`、Claude/Cursor hook CLI 独立登记；App Server 为 deferred/inventory；
   第三方 pack、Connector SDK、TUF registry、code plugin 均标 `deferred_by_owner_decision_7`。不另建
   独立 scope manifest。

### 6.2 覆盖模型

每个 AI product/realm/access mode 必须独立登记：

- operation：dialog/thinking/cheap/evaluator/execution，以及未来独立立项的 embedding、rerank、image、video、STT、TTS。
- plane：`inference`、`execution_agent`、`tool_connector`，跨 plane 的 receipt/权限不得复用。
- surface：official API、authorized subscription CLI、Codex exec、shared ACP、Claude/Cursor hook CLI、local runtime、user gateway、third-party API；App Server 当前只登记 deferred。
- protocol 与版本：不能把 OpenAI Chat、Responses、Anthropic Messages、Google GenAI 或各云 IAM 塞进“兼容 API”一个布尔值。
- auth/principal：key、OAuth、workload identity、subscription login、本地免认证或条件认证。
- realm/funding：地区、endpoint、key namespace、biller、quota、subscription entitlement、unknown metering。
- rights/data：用途限制、自动化权利、processor、retention、proxy/interception、数据驻留。
- capability profile：text、vision input、structured output、reasoning、tool definition/result/parallel call、stream、cancel、usage/cache；vision input 不等于 image generation，品牌不等于 endpoint 能力。
- runtime：discovery、health、capabilities、model availability、rate limit、recovery、fallback。
- evidence：hermetic contract、live account journey、平台/locale、最后核验时间。
- external policy evidence：source digest、observed/effective/review 时间、product edition、realm、
  operation、price unit/currency/tax/overage、terms version 与 deprecation date。

每个外部供给另有生命周期 `active | degraded | policy_review_required | deprecated |
sunset_pending | retired`。pricing/terms/rights/data/endpoint 的变化必须提升 generation，并在下一次
secret read/首字节前重裁决；退役包含 claim 撤销、用户迁移预览、替代项重新过
rights/funding/data、credential revoke、旧配置只读兼容和 retirement receipt。同协议替代者也
不得自动继承 key、model mapping、rights 或数据迁移许可。

上述登记字段只对进入 scoped 施工的条目全量要求；`inventory_only` 与 deferred 条目只登记稳定
身份、当前状态、defer 理由与重开条件，不为登记本身补齐全字段，避免 ledger 先于能力变成形式
负担。

### 6.3 分层交付

1. **S0 scope**：先完成 `ai-supply-scope`，把 selected/deferred rows 与 decision SHA 写入 capability ledger
   和 batch evidence；未签决策不推断，stale GA 条目不进入本轮 gate。随后按专题 Phase 0 把 scoped AI
   canonical diff、ADR 与一致性 gate 落地；这是 S0.5/S1 的 blocking predecessor，不另建 scope manifest。
2. **S0.5 pre-send admission**：采用两阶段而不是不可达的“所有 unknown 永久零包”。
   Stage 1 在零 secret/零 packet 下确认 endpoint identity、egress/data policy、principal、用户意图，
   以及有权执行无业务 payload probe 的 `probe_rights`。Stage 2 仅在用户显式签发单次
   `ProbeGrant` 后读取指定 SecretRef，并只向 pinned endpoint 发送限次数、限字节、限时、限费用、
   可取消且不含用户业务内容的 caged probe；产出带 TTL 的 entitlement/funding/capability evidence。
   法律/条款 rights 仍来自权威条款或人工签署，不能由 200 response 推断。生产请求要求 Stage 2
   evidence 或 owner 签署的静态权益声明；identity/egress/data/probe_rights unknown 仍零 secret/零包，
   funding unknown 仅保留逐次确认 + 物理硬上限，并禁止推荐、fallback、后台和持久自动路由。
3. **S0.6 discovery safety**：自动阶段零程序、零 packet、零第三方 token/session/history/prompt open；
   主动 probe 只能消费上项 ProbeGrant，绑定 binary/endpoint identity、cage、预算和 TTL。
4. **S1 core wire**：按用户价值选择最小协议纵切片；每片包含真实 protocol、stream、usage、error、cancel、tool intent 与 setup。Inference 只解码无权 `ToolIntent`，不能直接授予或执行 effect。
5. **S2a authorized subscription inference**：逐 product/edition/surface/use-case/operation/realm 验证 rights、funding 与 usage，不把 CLI 登录等同于订阅可复用。
6. **S2b execution drivers**：shared ACP、Codex exec、Claude/Cursor hooks 分别验收 session、工具审批、取消与数据边界；不按品牌复制公共状态机。
7. **S3 local/custom/cloud**：loopback、LAN、custom gateway、AWS/GCP/Azure 身份各自建 threat 与费用边界。
8. **S4 onboarding**：被动状态零假动作，主动配置每次只有一个主动作；公共 claim 同 maturity 投影。
9. **S5 advanced routing**：只承载 fallback、持久预算和多 route；合法首个请求所需 rights/funding/data 已在 S0.5 关闭。未知不自动降级。
10. **S6 certification**：hermetic 协议门与真实账号旅程分开；真实账号证据有 lease、cleanup、平台、locale 和过期时间。

### 6.4 完成定义

provider 名称出现、CLI 已安装、用户已登录、API 返回 200、模型能回答文本，均不足以称“支持”。至少要证明：当前 operation 合法、当前 principal 有权、当前 realm 与费用路径明确、工具/流式事件能解析、失败有处方、secret/data 边界闭合、默认入口可达、外部政策与证据未过期。cross-realm、cross-principal、secret version changed、rights expired、logged-in-only、identity/egress/data unknown 必须在 secret read/首字节前拒绝；probe 只走具名 ProbeGrant，funding unknown 只允许上段具名的逐次授权硬上限例外。

## 7. 计划 D：工具与 connector 覆盖

### 7.1 独立的 Tool/Connector Plane

当前 `ToolRegistry` 是 Brain 到 daemon 内部能力的执行面，不等于外部业务 connector 平面。新增专题应复用其 fail-closed、receipt、audit 与状态机纪律，但不能把任意 MCP、CLI 或插件的工具定义直接暴露给 Brain。Inference adapter 只能产生无权 `ToolIntent`；tool broker 在核验 connector instance/principal/scope/preview/receipt 后执行。Execution Agent 自带工具只走其 session/Gate/逐工具审批，provider-hosted tools 另列数据/费用边界。

MCP 可以作为候选 transport/adapter 之一，但 D5/D9 未签前整体保持 deferred，不进入任何排产；
若 owner 签出启用，第一形态只允许内置且签名的 `local_stdio_builtin` client adapter：不自动
扫描，不导入任意 command 或 server URL。其余
`local_stdio_user_supplied`、`remote_https_static_auth`、`remote_oauth` 三类继续 deferred，
分别需要 binary/network/OAuth/egress TCK 后解锁。MCP 只属于 Tool/Resource Connector Plane，
不自带身份、rights 或 permission model；server/tool/resource/principal/scope/egress/
prompt-injection/effect gate 仍逐项验证。SayDo 是否提供 MCP server 仍须 owner 决定。A2A 本轮
缺省 `inventory/deferred`；未来若启用，归 remote agent delegation/coordination，需要 remote
principal、delegation scope、task lifecycle、billing/data/effect approval/reconcile，不能借
ACP/MCP receipt。

### 7.2 每个工具的最小合同

命名由后续 canonical 决定，但语义至少包含：

1. connector/product/instance/realm/principal 的稳定身份。
2. operation 与资源范围：search/read/list/create/update/delete/send/publish 等分开。
3. input/output schema、分页、freshness、authority、provenance 与内容 digest。
4. auth scope、账户歧义、管理员策略、凭据版本和撤权。
5. effect level、写前预览、receipt、idempotency key、delivery unknown、reconcile 与 compensating action。
6. rate limit、timeout、partial、schema drift、prompt injection 与 retry policy。
7. data boundary、日志脱敏、audit 与 snapshotter 支持。
8. OAuth operational profile：app registration owner/environment/client type、redirect ownership、
   requested/granted scope、consent copy、vendor review、audience/expiry/refresh/revoke、client secret
   rotation、disconnect/delete、renewal 和 incident contact；未获 production approval 只能 preview。
9. quota policy：权威 quota source、unit、account/tenant/user/app scope、remaining/reset、burst/
   concurrency、pagination/max pages、polling/webhook、foreground/background reservation、
   Retry-After 与日/月硬上限；unknown quota 禁后台同步、自动分页和自动重试。
10. portability/exit 与 external dependency register：provider-specific state、export/delete、
    retention、替代候选、重新授权、数据格式、license/EOL、version pin、SLA、价格/region、
    security owner 和退出成本。协议同构只复用 wire adapter，不复用 rights/capability/migration receipt。

### 7.3 首发顺序

本总案对业务工具采用与 AI supply 决策 7 相同的保守缺省：先做内置受信 connector，不做第三方 pack/SDK/registry；但该决策原签署范围是否覆盖所有业务 connector，仍须通过 D5 由 owner 确认。按闭环价值而不是厂商数量分层：

1. **T0 本地工程面**：盘点现役 repo/file/git/shell/execution，补 capability ledger 与隔离事实。
2. **T1 Web research 读面**：首个候选只允许 `user_provided_public_url_read` + 引用、
   freshness、SSRF 与 Web snapshot。搜索发现、登录网页、browser automation 各自是后续独立
   capability，不能借“Web read”一起开。
3. **T2 document 读写面**：PDF/docx/markdown 与 artifact snapshot；外部发布仍不含。
4. **T3 structured data 读面**：CSV/spreadsheet/database query 的 schema、范围与 provenance；写操作后置。
5. **T4 productivity 读面**：drive/email/calendar/task/CRM 选择少量高价值内置 connector，必须解决账户与 scope 歧义。
6. **T5 外部写面**：draft → preview → receipt → execute → reconcile；send/publish/delete/payment 分风险档，S3 仍只走受信屏幕。
7. **T6 extension**：真实内置 connector 形成稳定 TCK 后，再由 owner 解锁第三方声明式 pack、SDK 与 registry。

具体厂商优先级不在本计划代拍板。输入应是：目标用户、现有 600 条工具需求、首批访谈、可合法 programmatic surface、集成成本、安全等级与可维护性；第一次只输出 owner 签署的一个纵切片，出现真实复用与维护容量后再扩，不是一张“所有工具”名单。

### 7.4 工具完成定义

每个 connector 至少经过：发现/配置、选择正确账户、最小 scope、读取、空/过期/分页、限流、登录过期、schema drift、partial、prompt injection、撤权、审计；有外部 effect 的还要经过 preview、确认、幂等、结果未知后的 reconcile、重复送达和取消/补偿。mock 只证明合同，不证明 live connector。

## 8. 计划 E：模拟提问与用户旅程语料

### Q0 · 先修现有真相

在扩容前关闭 G-A1：逐题修复 LIVE source 对象、locator 和 required fields，或把这些记录降级为 unresolved source requirements；validator 要检查 source kind、题面实体、reader schema、USER 前置和多对象基数，而不是只检查字段非空和数量。

验收：v8 的 A-RAG-01/A-RAG-02 与 B-VAL-01 都有逐条 disposition；README 不再把占位需求说成现势对象闭合；修复前后 machine report 绑定 commit、命令、退出码与 source/locator/field anomaly 计数，不能只用 disposition 文档证明修复。

### Q1 · 保留 600 条业务任务层，新增产品 meta-corpus

不向 600 条继续塞近义业务问题。新建 13 族“如何使用 SayDo”的问题：

1. 价值、能力与诚实边界。
2. 安装、首启、升级、迁移、卸载。
3. 订阅、API、额度、费用与数据去向。
4. 模型、Execution Agent 与 fallback。
5. 工具、connector、账户与 scope。
6. 项目建立、锚定、错锚与切换。
7. 语音、文字、语言与环境噪声。
8. 移动、弱网、离线与多设备。
9. 决策包、执行模式、Gate 0、S2/S3 审批。
10. 执行、预算、熔断、取消、重试与恢复。
11. 验收、证据、打回、合并、导出与交付。
12. 记忆、纠错、forget、备份与保留期。
13. 团队、管理员、审计、策略与离职撤权。

每个 meta 问题必须绑定 canonical answer source、as-of、maturity 与 F1–F4；没有来源时答案只能是 unknown/decision required。

seed 每族只收三种 intent：happy/use、boundary/refusal、failure/recovery，初始上限 39 条。只有 answer source、maturity、state transition、authority 或 recovery 发生实质变化时才允许新增；近义表达留作真实访谈样本，不在合成集堆量。

### Q2 · 增加正交字段

现有自由文本“角色”不足以判断谁能使用。journey schema 增加：

- persona：domain expertise、digital literacy、authority、access needs。
- channel：device、modality、environment、connectivity、locale。
- product phase/subphase：install、supply_select、setup、anchor、dialog、readiness、decision、preauthorization、approval、dispatch、run、settle、recover、review、rework、merge、export、deliver、memory、forget/delete、backup/restore、admin/offboard。
- supply：provider、access mode、principal、quota/funding、rights。
- tool auth：connector instance、account、scope、write capability。
- speech phenomena、failure、expected UI、expected spoken、durable events/receipts、external effect/no-effect。
- conversation depth：`smoke|long|cross_session`、turn count、session count、actual memory horizon、source expected R。

字段必须由生成器校验，不从角色文字或问题关键词推断。

另建 versioned product-state contexts，与 16 个业务材料 CTX 分开：fresh install、no supply、subscription-only/no API entitlement、quota exhausted、auth expired、wrong anchor、pending S2/S3、delivery unknown、stale receipt/old attempt、daemon restart、memory reload/correction、lost/revoked device，以及 D8 获批后的 team offboarding。每个 journey 必须绑定 context ID/version；validator 校验 maturity、principal/account、durable state 与允许动作相容。

### Q3 · 三层会话集

1. 保留现有 72 个短回放，定位为单一交互机制 smoke oracle；覆盖报告分列 source expected R 与 actual depth，3-turn smoke 永不计入 R3/R4 配额。
2. journey 采用 12 → 24 → 48 的阶段预算而非一次性固定门。12 个 reference 阶段至少含 3 个
   10+ turn、2 对 cross-session；24 阶段至少 6 个长会话、3 对 cross-session；只有扩到 48
   阶段才以 12 个长会话、6 对 cross-session 为候选上限。
3. 跨 session 覆盖重启、另一设备、记忆重载、旧 receipt/attempt 和错项目恢复；每次扩容必须
   由新增独立状态转换、真实缺陷或获批 capability 触发。
4. 任何宣称 R3/R4 的源问题，至少链接一个 10+ turn 或跨 session journey。

长会话不能只在文末附一个失败变体；故障必须发生在 turn 中，并包含用户观察、纠正或重试后的后续轮。

### Q4 · 故障与组合扰动

扩展 failure taxonomy：rate_limit、auth_expired、network_timeout、schema_drift、pagination_gap、partial_write、delivery_unknown、duplicate_callback、idempotency_conflict、MFA、account_ambiguity、tool_prompt_injection、daemon_restart、device_race、stale_receipt、budget_exhausted、disk_full。

failure 按 capability-scoped profile 生效。普适故障先进入 core；MFA、pagination、partial write、
callback 等只在对应 surface 进入 scope 后要求。机械 fault microcase 与真人 end-to-end journey
分账；12/24 阶段按 active capability 选择最小代表集，只有 48 阶段才以每个 applicable failure
至少三个、至少十个复合故障为候选上限。每个 active persona/slice 必须保留无注入故障的 clean
baseline。任何外部 effect 的结果未知场景都必须先 reconcile 再决定是否 retry。

failure 对象至少包含 `class/layer/injection_turn/trigger/observable/retry_safe/reconcile_required/expected_transition/terminal_state`。每个 turn 的 oracle 使用：precondition → stimulus → expected UI/spoken/subtitle → durable event/receipt → tool call/no-call → external effect `occurred|not_occurred|unknown` → forbidden effects → recovery/final state。四层字段有条件必填，N/A 必须给 reason；复合故障定义优先级，每个 journey 最多计两个 failure 类。validator 必须证明 `delivery_unknown` 在 reconcile 前零 retry，prompt injection 不改变 scope/authority。

### Q5 · 人群配额与 oracle

第一阶段只做 12 个 reference journey。D14 签出 primary ICP 后，至少一半服务 primary；
若选择向 Individual 扩圈，至少 3 个保护现有 expert Developer 主线的 must-not-regress；
至少 3 个覆盖当前明确不支持的高风险 boundary/refusal。D8 后置时管理员只保留 3–4 个边界
case，不占成功旅程配额。validator 稳定且出现新增独立覆盖、真实缺陷或新 capability 后，才扩
到 24，再决定是否需要 48；这些数字都是成本预算上限，不是成熟度证书。

mobile、weak-network、accessibility、non-default-locale 是可交叉 overlay，只对准备宣称的
子能力设配额；未获批能力可以验证诚实限制，不能记为支持成功。长会话和 cross-session 始终是
active journey 的子集，不额外相加。applicable failure 每 journey 最多计两类，机械 microcase、
真人 journey、unique journeys、sessions、turns、failure occurrences 和 corpus 维护小时分账，
不能重复计数刷满覆盖。扩到下一阶段必须报告“新增发现/新增维护小时”，没有边际收益就停止。

oracle 分四层：

1. user observable：屏幕、口播、字幕、通知和可操作项。
2. durable truth：task/package/receipt/event/memory 状态。
3. tool truth：请求、scope、snapshot、结果、错误与 reconcile。
4. external effect：已发生、未发生或 unknown，以及禁止的副作用。

### Q6 · 更新人工提问手册

现有手册的生活筹备、买手机、写作和玩具开发可保留，但新增首启、供给配置、ASR 误听/打断/沉默、弱网重连、多端竞态、S2/S3、成本/额度、取消/重试/熔断、验收/合并、记忆/遗忘、无障碍与语言地区。每张人工问题卡绑定 `journey_id/context_id/persona/channel/phase/failure/oracle_id`，写操作员观察项、允许追问、停止条件和证据位置，并生成 manual→corpus exact-set 对账。此项仍是未来测试设计，本轮不实际执行。

## 9. 综合排期建议

本节只是依赖顺序。owner 选定后，必须把具名批次插入 `IMPLEMENTATION-PLAN-2.md`；不得直接据本节开工。

所有 A 级使用统一 disposition 状态：`closed`、`owner_downgraded_with_public_limit`、`blocks_expansion`。只有纯 claim/evidence overstatement 可仅靠公开降级进入第二态；运行时 A 还必须记录 `disabled_entrypoints` exact-set、负例 gate 与 claim receipt，否则保持 `blocks_expansion`。Wave 2–5 开工前，G-A1–G-A9 必须全部是前两态；warning 不构成绕过。Wave 0 与 Wave 1 共同构成扩张 Gate 0。

| A-ID | 最小技术门 | 未实施时必须禁用/降级 |
|---|---|---|
| G-A1 | LIVE source semantic report + validator mutations | 禁止 connector-readiness claim；corpus 标 unresolved requirements |
| G-A2 | gate/workflow control graph exact-set + skip mutations | 禁止“本地 CI 等效”与 release green claim |
| G-A3 | action truth gate：request/transition/forbidden/projection/copy | 隐藏具体动作与 `direct_to_review`，不能 toast 冒充成功 |
| G-A4 | claim-source exact roots + checker gate log + batch evidence | 删除/降级 provider、协议、订阅与零额外费用声明 |
| G-A5 | live consistent read + quiesced-copy immutable probe + main/sidecar exact-set + every-production-migration restore | 禁止自动升级；仅允许已知 schema range 的旧版本运行 |
| G-A6 | remote `server × route/message × via` denominator + guard-bypass/omission/WS mutations；未来重开才跑 pairing replay/revoke/storage/transport/approval | 正式远程业务读写、S2 与原文/记忆访问全部 unsupported；只保留无业务 payload health/static shell 或已证明安全的受信传输 |
| G-A7 | field-aware pre-send admission mutations | 禁用不具 identity/rights/data 的 connection；funding unknown 仅逐次硬上限 |
| G-A8 | malicious PATH/open/packet sentinels | 禁用自动 probe、自动推荐；只保留用户显式 active check |
| G-A9 | typed audit schema + raw-text/secret/path injection mutations | 无安全 disable 子集时保持 `blocks_expansion`；不得靠文案降级 |

### Wave 0 · 范围冻结与验收形状

包含 E0 canonical/claim roots、Q0、产品承诺 U0、AI supply scoped ledger rows/batch evidence 与 scoped AI
canonical Phase 0，并无条件降级已经证伪的 G-A1/A3/A4/A6 现役声明和入口；owner 对替代文案未决时
保持 `blocks_expansion`，不能继续 RC 或能力升级。Q1/Q2 taxonomy、product-state contexts 与 reference
journey 不在本波预建，等 SP4/SP5 中首个真实 slice 获批后由该批唯一初始化 `Q1Q2-CORE`。产品线的 problem interview/
concept comparison 可并行准备，但只作为 D1/D14 与 SP4/SP5 的开包输入，不阻塞 A 级关闭。

退出条件：active claim/source/capability 三类最小输入有 schema 与 exact roots，selected/deferred scope rows
和 decision SHA 已进入 batch evidence；其余 canonical 只登记 inventory ID/count；每项 A 都有
disposition owner；公开 claim 不超过现役 maturity；Q0 有逐对象 machine baseline。后续用户/工具批的
journey 和 oracle 在各自开包前建立。

### Wave 1 · A 级关闭与可信工程底座

本波的 D17 active exact-set 只做 A 级 core：E1 gate truth、E2 default-route 止损、E3 DB 安全、
E4 admission/discovery 收紧、E8 的 G-A9 新写入安全，以及 S0.5/S0.6 fail-closed 子集。G-A6 未有逐设备
信任和安全传输时，关闭全部远程业务 payload，只保留无业务 payload health/static shell；
`direct_to_review` 未获排期则隐藏。E6/E7、广义 API/兼容、logger、历史 retention、live evidence 与
distribution 都按 20.6 触发，不占本波活动队列。D13 只约束历史/retention 与任何新增用户内容
snapshot，不阻塞 A 级 core。

退出条件：G-A1–G-A9 全部 `closed` 或满足严格降级条件；required gate 缺证据时 overall nonzero；默认动作 durable 语义正确；未来/乱序 DB 及 sidecar 不被改写；audit 原文注入被拒；AI 请求满足字段化 pre-send admission；自动发现通过零程序/零 packet/零 history sentinel。

### Wave 2 · 首个普通用户纵切片 + AI core supply

先由 D1/D14 决定“深化 Developer 主线”或“向 Individual 扩圈”。两路都先交付一个现役 expert
longitudinal journey、must-not-regress gate 和当前支持/留存 baseline；若选择扩圈，再交付 U1
seed journey pack，实施 U1、AI supply 的 S1/S2a/S2b/S4 最小纵切片。S0.5/S0.6 已在前波关闭，
未签 AI 决策 3/4/5 不能由实施批推断。对选中的 Execution exact-set 同波交付 S6 live/no-skip
certification，并在批中做使用参与者真实或等价任务的 formative usability，记录 assisted/unassisted、
主持人干预、关键错误、放弃和恢复。目标不是接最多 provider，而是用一种合法供给闭合一个任务；
在 D15 真人晋级门前仍是 developer/preview 下的 capability 级实验，不升产品级 Individual。

退出条件：无 CLI 术语的首启→首任务→失败恢复→验收走通；费用和数据边界无隐式变化；选中 surface 的 required live case 未 skip 且证据未过期。

### Wave 3 · Tool read plane + 首个非代码纵切片

只有 D4/D5 discovery 选择非代码 primary 或有预算上限的第二实验、D13 retention 已签，才交付
U3+tool journey pack、E5 和一个读面。缺省候选仅是 user-provided public URL read + artifact
snapshot；Web search、登录页面、browser automation、document/spreadsheet 和厂商 SaaS 分别后置。
随后只启用对应的一个项目类型。

退出条件：非代码 artifact 有不可变证据、source/freshness 可审、失败不编造；选定 `capability_id` exact-set 完成真实授权 read journey，账户、最小 scope、空结果、分页、auth expiry、rate limit 均有未过期 live evidence，required case skipped 即失败。

### Wave 4 · 专业、移动与外部写

先交付 U2/U4a–d journey packs，再实施 U2、U4、T4/T5；按 capability 开放移动动作和外部 connector 写操作。团队 U5 仅在 owner 明确选择后进入，并先有 team boundary/success pack。

退出条件：账户/scope/receipt/idempotency/reconcile 闭合；设备和无障碍合同有独立 gate。

### Wave 5 · 语料扩容与真实校准

只做已选 slice 从首个正/反 journey 到 12、再按新增发现到 24、必要时到 48 的扩容、长会话/
cross-session、applicable 复合故障、人工手册对账和真实校准；未选 persona/task 不预建 schema 或
journey。本波执行 repeated-use pilot、纵向复用和频率校准，不用合成扩容代替第一次真人验证。

退出条件：业务任务层、产品 meta 层、短交互、长会话、跨 session、机械故障与真人 journey 各自有独立基数和报告；扩容有新增发现/维护小时证据，互不冒充。

### 下一 RC 前置批 · Release/voice 可重复性

E9 不等待 Wave 5，并拆成互不共享回滚面的 E9a release parameterization 与 E9b voice restart。
E9a 先选唯一 active candidate identity：迁移完成前仍以现役 version matrix 为 SoT；若 owner 采用
machine-readable candidate manifest，则 version matrix、release profile、package version、tag、
workflow 和 site marker 全部改为生成/校验投影，迁移事务前后 mismatch fail-closed，历史 release
零回写。E9b 单独处理 env source marker、Pipecat ADR 与语音 provider restart。E9a 在创建任何下一
release candidate 前阻断；E9b 只在 candidate manifest 包含 voice runtime 或公开 `voice=true` 时
阻断。E8 logger 为条件批，G-A9 新写入安全不能后移。

退出条件：E9a 只改一个 active identity 即得到全部现役输入，固定旧 asset 可回滚且历史证据不变；
E9b 的 env-only/.env/pending promotion 和 TTS restart/cancel/error 各有独立门。

## 10. owner 必须裁决的事项

唯一裁决载体为 `docs/plan/2026-08-28-project-gap-owner-decisions.md`。沿用 AI supply 决策单的
签署惯例：逐项 `[x]` + 签署日期 + 一句裁决内容；本节只定义问题与缺省动作，不接受第二处
签名。第 14.6 节引用的 decision digest 必须来自该文件的 bytes SHA-256；未签项只表示本计划按
安全缺省继续收敛范围，不表示生产运行时已经完成对应改动，也不构成施工授权。

| ID | 裁决 | 选项及影响 | 缺省动作 |
|---|---|---|---|
| D1 | 近期产品方向与档位 | 深化 developer/preview / 向 individual/preview 扩圈 / team preview；另选 distribution 轴 | 保持 rc + developer/preview；先加 expert must-not-regress 与 baseline |
| D2 | corpus v8 A 级处置 | 修 986 source 合同 / 将其降级为待解析需求模板 | 先降级声明并阻断 connector-readiness 引用，再逐域修 |
| D3 | `direct_to_review` | 本期完整实施 / 从默认 UI 与承诺隐藏 | 隐藏，保留合同为后续能力 |
| D4 | 首个普通用户任务 | coding / research / writing 先经 problem interview，同 rubric 比任务频率、替代品、切换/付费意愿、输入、rights/data、闭环成本和 time-to-value | 未签 D14 前只保留桌面 coding reference，不开第二价值轨 |
| D5 | 首批内置 connector | user-provided public URL / search / document / structured data / productivity | 未签前不排 connector；若获批，先 public URL read + artifact snapshot |
| D6 | 移动投资与正式边界 | 不做移动 / 单一优先平台 / 多平台 companion，再选 read/control/approval/voice | 关闭远程业务 payload；只保留 static shell/health，不把 read-only 当安全降级 |
| D7 | 国际化与无障碍目标 | 中文单语卫生线 / 双语 + WCAG 目标 / 更广地区 | 未裁决前不宣称国际化或完整无障碍支持 |
| D8 | Team/enterprise | 后置 / preview | 后置，保持单 owner 语义 |
| D9 | MCP/A2A 方向 | builtin local stdio / user local / remote HTTPS/OAuth / server；A2A deferred | 只有 D5 明签后才允许 first-party signed local stdio client；其余与 A2A deferred |
| D10 | 当前发布物定位 | daemon/console Developer Preview / 完整语音产品 installer | 缺完整物理证据前保持 Developer Preview |
| D11 | supported variant 的持续维护容量 | 以 product/edition/realm/surface/protocol/auth/operation/funding/platform/locale/distribution 为单位，签总 variants、maintainer 小时、账号/API、真机/runner、证据 backlog 与年度费用上限 | 任一上限 unknown 或超额时不得升级；按价值降级/退役 |
| D12 | 真实证据预算与频率 | 每次/日/月 request、token、金额、effect 上限；账号 lease/MFA/rotation/cleanup/quarantine/kill switch | PR hermetic；scheduled canary 按 TTL；RC 只重跑 new/changed/expired/high-risk，全部 claim 仍须有未过期 receipt exact-set |
| D13 | telemetry 与逐 store 保留姿态 | local/opt-in/team；日志、audit、snapshot、备份、证据的 retention/delete/export/backup propagation/legal hold | local-first、数据最小化、遥测缺省关闭；未签前不新增用户内容 snapshot |
| D14 | primary ICP/JTBD | 首先为谁、替代什么、明确非目标；coding/research/writing 的 primary 与实验关系 | 现有 expert developer 为保护基线；新 ICP 未经 discovery 不代拍 |
| D15 | 真人验证与产品晋级 | 招募/排除、样本或饱和理由、真实任务、assisted 上限、重复使用窗、质量/恢复/事故/支持分钟和晋级规则 | 未签/未跑时只作 capability preview，不升 Individual/Team |
| D16 | 商业或战略回报与 portfolio 预算 | WTP/price 或非收入价值、next-best alternative、owner-weeks、time-to-learning、概率收益、recurring/WIP cap | unknown 时先做最可逆的单轨实验，不扩 portfolio |
| D17 | 导入唯一排产源 | 是否按绑定 digest 的 import spec 把 PG-01A–PG-06 A 级 core 导入 PLAN-2，并逐项处置旧队列 | 未签并回写 PLAN-2 前，本文件没有开工权，任何 PG/SP 均不可记为可开 |
| D18 | 未来 remote trust stack | transport/trust root、issuer/store、TTL/rotation/revoke、N/N-1、丢设备恢复和首发平台 | 维持业务远程 unsupported；另走 ADR 后才重开 |
| D19 | support 与事故响应 | preview 是否 best-effort、支持版本/OS、intake/响应、安全更新、EOL、事故 owner/通知 | best-effort preview；但安全/数据事故仍须最小 Ops0 runbook |

缺省动作只用于保持诚实与安全，不等于 owner 已批准路线。

## 11. 每个未来实施批次的统一模板

没有以下内容，不得派实施：

1. **用户结果**：谁在什么条件下能完成什么，明确排除什么。
2. **现状证据**：file:line、现役入口、maturity 与真实失败。
3. **canonical diff**：需要先改哪些合同；无合同变更也要说明理由。
4. **纵切片范围**：UI/CLI、API、state、audit、error、recovery、docs、support matrix 一次闭合。
5. **正反验收**：正常、拒绝、超时、重放、重启、权限、费用、数据、旧状态。
6. **门禁命令**：命令、平台、预期退出码、证据路径和 commit 绑定。
7. **降级/回滚**：功能开关、配置迁移、数据兼容和用户处方。
8. **不做清单**：防止把 provider/tool/平台名单顺手扩大。
9. **决策与依赖**：owner decision digest、depends_on、唯一 primary owner、consumer 和 deferred exact-set。
10. **TCO 与退出**：外部依赖、portability、固定/变量成本、维护/支持/CI-device/storage/incident 小时与退役动作。
11. **价值测量**：metric ID、公式、事件来源、numerator/denominator、样本、窗口、missing-data、人工兜底、privacy mode、baseline、threshold 和 decision rule。
12. **兼容与运维**：producer/consumer 版本窗、升级顺序、unknown-field、旧 credential/receipt 读取、固定 asset 回滚，以及 incident kill/revoke/notify/restore/postmortem。

模板按批性质分三级，避免为小修复编造不适用材料：

1. claim-only 止损批只要求第 2、3、6、7、8、9 项，以及 exact diff/claim root；
2. runtime safety/工程修复批使用第 1–10、12 项，但不适用项允许写 `N/A + 可核理由`，不得空白；
3. SP4 起的扩张批 12 项全量，缺项不得派实施。

SP0–SP3 均免第 11 项价值测量：风险关闭本身即价值，由 A-ID disposition 与 gate evidence 证明，
不为修复批编造用户指标。

E0/E1 只固定当前已有消费者的最小输入/输出：

- `capability-ledger.schema`：稳定 ID、plane、maturity、distribution/platform/product/surface/protocol/auth/rights/funding/data、evidence expiry、limitations。
- `claim-source-manifest`：README、`docs/site`、`docs/release/metadata.json`、`deploy/saydo-octoooo-com/**` 中英文首页/Docs/Privacy/Terms/Support、templates、console、canonical 的 exact path 与 section selector；漏根即失败。冻结 store 草稿不得代替现役 projection/deploy tree。
- generator 尚未触发时，support checker 只产普通 gate log，由 batch evidence 引用；触发生成器批后才
  另定义投影输入/输出 manifest 与 receipt，不能把 v0 checker log 包装成未来平台。
- `batch-evidence contract`：predecessor/implementation commit、owner decision SHA、included/deferred
  exact-set、required/optional gate ID、platform、实际 exit、
  freshness、A-ID→gate/disabled-entrypoints/evidence 映射与 overall verdict；Git parent chain 提供 predecessor，
  不另造 wave-exit receipt 链。

每个 gate 必须有正例和至少一个 mutation。候选统一静态门在 E1 批中落地后应提供类似入口：

```bash
node scripts/check-capability-ledger.mjs
node scripts/check-action-reachability.mjs
node scripts/check-gate-manifest.mjs
node scripts/check-support-matrix.mjs
```

这些脚本当前不存在，本文件只是验收规格，不能把上述命令写成已通过。各功能批仍需在未来按改动范围运行 typecheck、lint、单元、契约、e2e、平台构建/实体设备或真实账号门；本轮没有运行这些测试。

## 12. 本计划本身的验收标准

1. 五个用户要求的角度都有独立缺口、计划、依赖和完成定义。
2. 每条 A/B 级事实有当前代码或文档证据，不从旧评审状态反推。
3. 不把 600 条业务覆盖写成用户覆盖，不把 mock/LIVE 合同写成 connector 实接，不把 provider inventory 写成可用供给。
4. 不与 `IMPLEMENTATION-PLAN-2.md` 创建第二套排产，不重启 AI 供给约 45.8k 行草案的无尽文档终审；精确规模以生成清单为准。
5. 实施前有可判定验收目标和未来 gate 命令；本轮不运行产品测试。
6. 三路 subagent 分别从工程、用户/语料、AI/工具生态交叉评审本文件；A 级全吸收，B/C 逐条 disposition。
7. 按仓规完成一次独立 `codex exec` 对抗性静态评审、过程 journal 和 emoji/doc 静态门。
8. 九个 A、十七个 B、E/U/S/T/Q 叶项和 SP0–SP7 都有唯一处置、依赖、主责包与标准 Git 导入；未签 owner 决策不能伪装成已选路线。
9. 回报、价值测量、全生命周期成本、兼容/运维和退出条件都有合同形状；无真人或 live evidence 时不宣称市场最优。

## 13. 交叉评审记录

三路 subagent 在初稿落盘后独立做了第二轮只读交叉 review；均未改文件、未跑测试：

| 角度 | 结果 | disposition 与本轮修改 |
|---|---|---|
| 工程质量 | 5A / 8B / 1C | A 全吸收：A 关闭顺序、DB 前向兼容/迁移前恢复、remote token 信任、默认 UI 语义、不以旧评审代替当前 corpus 计数。B 全吸收进 E7–E9、gate artifact、maturity canonical；C 改为约数 |
| 用户与语料 | 0A / 6B / 3C | B 全吸收：U4 拆四线、U5 条件闭环、actual depth、product-state contexts、结构化 failure/oracle、当时的 48 journey 配额算术、验收语料前置。C 吸收进 phase/subphase、13 族 seed/停止准则、人工手册 exact-set；第二轮已进一步改为 12→24→48 触发式扩容 |
| AI 与工具生态 | 3A / 5B / 2C | A 全吸收：S0.5 pre-send admission、S0.6 静态发现、公共订阅/协议 claim。B 全吸收：Decision 2 exact scope、三 plane/ToolIntent 边界、MCP/A2A、gate artifacts、capability/modality。C 吸收为 S2a/S2b，并把业务 connector 的保守边界重新上浮 D5 |

三路 finding 没有未处理项；其中涉及产品路线的 D1、D4–D10 只上浮 owner，本计划不代拍板。

独立 Codex `gpt-5.6-sol` + `max` 对抗评审报告为
`research/codex-findings/206-project-gap-program-adversarial-review.md`，评审输入为
`prompts/206-project-gap-program-adversarial-review.md`。报告对评审时快照裁决 `[fail]`，计 5A / 6B / 1C；本轮 disposition：

- A-R1 吸收：把现役 `deploy/saydo-octoooo-com/**` 及 `docs/release/metadata.json` 纳入 exact claim roots，并把移动 storage/transport/approval 错述并入 G-A4/G-A6。
- A-R2 吸收：audit raw text 从 G-B14 拆为 G-A9；logger capacity 保留 B。
- A-R3/A-R4 吸收：gate manifest 加完整 workflow 控制图与 skip mutation；DB gate 对账主文件和 WAL/SHM/journal sidecar。
- A-R5 吸收：identity/egress/rights/data unknown 仍零读零包；funding unknown 保留 owner 已签逐次授权 + 硬上限例外。
- B-R1–B-R6 全吸收：A-ID 技术映射、Execution exact key + S6、AI canonical Phase 0、Wave 3 live connector、E8/E9 排期、现役证据与行号纠正。
- C-R1 吸收：修正 just/verifyFreeze/SetupWizard/自动 probe 的证据锚。

该报告仍如实保留 pre-fix `[fail]`，不会被本轮文字 disposition 改写成复评通过；回修后的总案未再运行第二次独立 Codex 复评。

## 14. 完整对应方案

### 14.1 先定义落地后的产品档位

本方案不是把所有路线图项目一次做完。完整对应的含义是：每个已登记缺口都有唯一处置、禁用
边界、交付物、验收和持续责任；条件项没有需求或维护能力时，可以诚实保持 deferred，而不是
为了“全覆盖”强行实现。

| 闭合层 | 对应范围 | 落地后的真实状态 | 仍不能宣称 |
|---|---|---|---|
| 可信底座 | Wave 0–1 + 下一 RC 前置批 | rc + developer/preview；声明、数据、安全和发布可审计 | Individual GA、远程业务读写、任意 AI/工具 |
| 单一价值探针 | Wave 2 | developer/preview 下一个 desktop coding capability 有真实 reference journey | 一般初级用户成功、市场匹配、第二项目类型 |
| 第二纵切片候选 | Wave 3，仅 D14/D5/D13 签出后 | 仍是 capability preview；通过 D15 repeated-use promotion contract 后才可评 individual/preview | 未获批业务域、移动、团队或广域自动化 |
| 受控扩展 | Wave 4–5 中 owner 选中的项目 | 资深控制、获批平台/locale、少量外部写与可校准语料 | 全平台等价、企业治理、开放插件市场 |
| 团队/生态 | 仅 D8/D9/D11/D16 另行批准后 | Team preview 或第三方生态预备能力 | 未经独立合同与运维预算不得借前层成果提前宣称 |

所以，“完整对应后”的缺省目标不是万能 AI 平台，也不会自动得到 `individual/preview`。它先得到
一个可信、可扩展、能证明单一 desktop coding 纵切片的 developer/preview；产品级晋级必须经过
D15 的真人、重复使用、质量、支持和事故门。

### 14.2 六层解法

六层只是一张 review lens，不是新的部署组件、package 或 canonical 词表。对应现有资产如下：

    Truth Plane
      docs/06/09/11 + packages/contracts + scripts 中的最小 ledger/manifest/checker
            |
    Authority Kernel
      packages/contracts 与 daemon 的 identity/principal/SecretRef/rights/funding/data/effect grant
            |
    Durable Core
      daemon storage/state/outbox/audit/backup/reconcile
            |
    Interaction Profiles
      console/mobile/pipeline 与 docs/10/11 的 novice/expert/non-code/access/locale 投影
            |
    Adapter Planes
      daemon providers/backends/brain 中分离的 inference/execution/tool connector
            |
    Evidence and Operations
      scripts/e2e/research 中的 hermetic/live/device/release/journey/expiry/runbook

跨层硬规则：

1. Truth Plane 首批只覆盖 active public claims、当前 release profile 和 required gates；使用小型
   ledger、validator、claim-root checker 与一份 support matrix，不先建设全站 bytes generator。
   第二个分发面或第二次真实漂移才触发生成系统。
2. Authority Kernel 的生产 admission 在 secret read 和首包前完成；显式 ProbeGrant 只允许上文
   Stage 2 的无业务 payload caged probe。Inference 产生的 ToolIntent 永远不自带权限。
3. Durable Core 是状态与副作用真相源；UI、agent、移动端都不能自创“成功”。
4. Interaction Profile 只改变呈现和职责分配，不降低风险、费用、隐私和验收语义。
5. 只有新的 wire/event state machine 才新建 protocol adapter；同 wire 的 header/path/error/usage
   差异进 versioned product profile。无法保真的专属语义必须进入 opaque extension +
   adaptation-loss gate，不能为复用退化到最低公分母。
6. ExternalPolicyEvidence 与 Evidence 都有 version、TTL 和适用范围；过期、条款/价格/endpoint
   漂移只会 hard stop 或降级 maturity，不会被旧报告永久续命。

### 14.3 九个 A 级缺口的唯一处置

| ID | 立即止损 | 最终方案 | 必备产物与关闭条件 |
|---|---|---|---|
| G-A1 | README 和覆盖报告把 986 项降为 unresolved source requirements，禁止作为 connector readiness 证据 | validator 按 source kind、实体、reader schema、USER 前置和对象基数逐项验证；只修 owner 选中的首发领域，其余继续 unresolved | 绑定 commit 的 corpus truth report；A-RAG-01/A-RAG-02/B-VAL-01 exact disposition；异常计数归零或逐项降级 |
| G-A2 | 删除“本地 CI 等效”总括声明，release 只认目标 workflow 的真实 conclusion | 一个 gate/workflow manifest 描述命令与控制图，本地、CI、release 生成或 exact-set 对账 | 删除 matrix、恒假 if、continue-on-error、断 needs、skip required 的 mutation 全红；required 未 witnessed 时非零 |
| G-A3 | 隐藏 direct_to_review 与 TODO/toast-only 动作；修正 abandon、unknown budget 等现役错义 | action truth ledger 把每个默认动作绑定 request、durable transition、forbidden transition、projection 和 copy | 默认可见与 Brain 可调用动作 denominator 全量通过；暂缓动作从入口和声明同时消失 |
| G-A4 | 无条件收窄官网、部署树、console、template 中已证伪的“任意兼容”“订阅零额外费用”等文案 | 首批用小型 ledger + claim-root checker 投影 maturity；完整 generator 只在触发线后建设 | claim-source roots exact-set；无 rights/TCK/新鲜 policy evidence 的 surface 只能 detected/conditional/deferred |
| G-A5 | 禁止未知 schema 自动升级，旧 binary 只读探测后拒绝 | 先 quiesce/checkpoint 后使用 SQLite backup API，或在离线状态做主文件/sidecar 一致快照；只在恢复副本用 immutable probe，复制库 dry-run/quick_check 后再生产 migrate | current+1、缺口、乱序和每个 migration 故障点均不改原库；禁止把任意时刻复制 live DB/WAL/SHM 当一致快照；backup CLI 不触发 migrate |
| G-A6 | 关闭正式远程业务 payload 的读写、S2、转写与记忆访问；只有 health/static shell 或已证明安全的受信传输可留 | 未来另由 D18 + ADR 唯一选择 transport/trust root、credential issuer/store、TTL/rotation/revoke、N/N-1 与丢设备恢复；本轮不在 TLS/Noise 间代拍 | D18/ADR 未签前业务远程为 unsupported；签后才跑 replay/revoke/navigation/Referer/换网/丢设备门 |
| G-A7 | identity/egress/data/probe_rights unknown 时禁连接；funding unknown 默认 hard block | Stage 1 静态 admission + 用户显式单次 ProbeGrant 的 Stage 2 caged probe；每个 production connection 仍有 EndpointIdentity/principal/SecretRef/Rights/Funding/DataBoundary | 自动/background 仍零 secret/零包；probe 限 endpoint/secret/次数/字节/时间/费用且无业务内容；生产首包前 evidence 或静态权益签名齐全 |
| G-A8 | 自动 probe、自动推荐只保留静态 inventory；第三方程序和状态读取改为用户显式动作 | passive static detector 与只消费 ProbeGrant 的 active caged probe 分离，结果绑定 binary/endpoint identity、预算和 TTL | malicious PATH、history/session open、packet sentinel 全部 fail-closed；首启无隐式执行 |
| G-A9 | 未有安全 schema 前，敏感 audit 事件停写原文，只写允许字段或 digest | audit action 判别联合 + sink allowlist；先对 DB、备份、副本做 affected-row exact inventory，再按事件类别给唯一迁移/隔离/删除/限时 canonical 例外 | raw model text、reason、title、secret、完整路径注入被拒；普通 owner acceptance 或密钥轮换不能关闭明文，例外必须有 canonical、期限、访问限制与退役证明 |

这些处置里，立即止损和最终方案可以分批，但不能跳过立即止损直接继续扩能力。

### 14.4 十七个 B 级缺口的对应方案

| ID | 条件推荐（仍受对应 decision 约束） | 未满足时的产品边界 | 主要持续责任 |
|---|---|---|---|
| G-B1 | 只为 selected project type 的 required-source exact-set 建 snapshot/verifier；首个候选仅 public URL + artifact | 未选择的 research/writing source 只能草稿或 unsupported，不得 ready_for_review | source freshness、版权与已启用 snapshot 格式迁移 |
| G-B2 | 各平台声明可证明 sandbox；高风险 route 使用 OS enforcement、网络策略和不可变 verify input | 无 enforcement 的 backend 只做低风险/用户监督，不能称隔离 | OS 更新、sandbox TCK、绕过反例 |
| G-B3 | 每种 workspace 定 RPO/RTO 和 restore；unsupported 在创建/升级前拒绝 | 只支持 local_folder 的可恢复性声明 | 恢复演练、容量、旧格式读取 |
| G-B4 | novice managed-first，内部槽位和术语进入 advanced | 普通模式只开放一个 supported 纵切片 | onboarding 文案、处方、支持工单 |
| G-B5 | 先保持 rc + developer/preview；D14 discovery 选中后才以一个非开发纵切片做有预算上限的实验 | 不把 12 业务领域语料写成产品支持 | 用户研究、模板和 selected artifact support |
| G-B6 | 平台 capability parity 表；D18 前远程业务面 unsupported，之后只做 owner 选中的一个首发平台/能力 | Android/HarmonyOS/iOS 各自显示限制；有壳不等于 companion | 签名、设备、系统版本、商店与真机证据 |
| G-B7 | accessibility、locale、device、modality、connectivity 进入 journey schema 和 support matrix | 未获批子能力显示 unsupported/assisted | 辅助技术、翻译、语音与地区回归 |
| G-B8 | 保留 72 smoke；每个选中 slice 先一正一反 reference，再按新增发现扩到 12/24/48，长会话与 cross-session 比例随阶段 | 3-turn 不再计 R3/R4；未选 slice 不预建 | corpus 版本、记忆/摘要漂移与维护小时 |
| G-B9 | capability-scoped failure + 四层 oracle；机械 microcase 与真人 journey 分账，external effect unknown 必须 reconcile | 不适用的故障不为凑数塞入；单 fixture 只证明单点交互 | provider/connector 故障演化与 fixture 更新 |
| G-B10 | HarmonyOS 维持 local witnessed/unsigned preview 并冻结扩功能；只有进入 supported-set 且有用户/签名预算才建 mirror/signing | 不称 release parity，不把上游 502 转化为持续固定成本 | 触发后才承担工具链镜像、签名机与依赖可得性 |
| G-B11 | 独立 Tool/Connector Plane，需求覆盖和 live capability 分栏 | mock、MCP metadata、语料均不升 supported | 账户、scope、schema、rate limit、撤权 |
| G-B12 | 当前包明确 daemon/console Developer Preview；真实需求达线再做 voice installer | 不称完整语音产品 | service、doctor、升级卸载、语音依赖和平台支持 |
| G-B13 | PR hermetic、scheduled live canary 按 TTL、RC 重跑 new/changed/expired/high-risk；全部 claim 消费未过期 receipt exact-set | required receipt 缺失/过期使 profile 降级；外部 outage 与 protocol compatibility 分轴 | test-account manifest、调用费、设备、证据 TTL、清理/quarantine |
| G-B14 | 有界异步 logger、背压/drop 指标、磁盘满隔离和 retention | 无法保证的日志只作 best effort，不阻塞业务 | 磁盘预算、告警、轮转和格式兼容 |
| G-B15 | 新 API 一律共享 contracts schema 并双端 runtime parse；旧 mirror 先 exact inventory，再按纵切片给期限迁移 | 禁止新增 mirror；“归零”只对本批 selected inventory 判定，不用随触达无限拖延 | schema 演进、N/N-1 或明确 no-compat 窗口、客户端升级 |
| G-B16 | 迁移前保留现役 version matrix 为 SoT；owner 采用 machine-readable active candidate 后，其余 package/tag/profile/workflow/site 全为投影 | 下一 RC 前阻断；任何两个 authority/mismatch 非零，历史证据 immutable | release 模板、签名、站点投影与固定 asset rollback |
| G-B17 | env source marker 修 self-exec；Pipecat ADR 采用或移除 | 语音 restart 不能称可靠 | provider SDK 漂移、TTS 异常帧/取消/重启 |

### 14.5 当前真正的最小组合

在 D14–D16、D5 和 D13 尚未有签署值前，最小组合只保留：

1. 第 20.3 节 PG-01A–PG-06 的 A 级风险关闭目标；Truth lens 使用小型 ledger/validator/
   claim-root checker，不建完整多输出生成系统；其余 SP0–SP3 条件项不在当前施工集。
2. 一个 desktop coding reference journey、一个具备合法 rights/funding/data evidence 的
   inference protocol、一个已经证明的 execution driver；persona 精确写成现有 expert developer
   或 owner 选择的 sample-workspace 用户，不冒充一般初级用户。
3. 已签 ACP 方向只保留内部 execution preview；六家 inventory 不因此进入 supported denominator。
4. 当前远程/移动业务 payload 全部 unsupported，不把 read-only 当安全降级。
5. Web research、MCP 和其他 connector 等 D14/D5/D11–D13 签出后再二选一引入；即使选择 Web，
   第一刀也只允许 user-provided public URL read + artifact snapshot。A2A、Team、第三方 SDK/
   registry 继续 deferred。

这不是永远的产品方向，而是单 owner、developer/preview、无新增真人证据时风险最低且
time-to-learning 最短的组合。problem interview 若选择 research 或 writing 为 primary，只替换
价值探针，不改 Truth/Authority/Durable 公共不变量。

### 14.6 施工包与依赖

| 方案包 | primary 内容 | depends_on | 决策前置 | 退出结果 |
|---|---|---|---|---|
| SP0 公开与入口止损 | G-A1/A3/A4/A6 的降级/禁用、G-A2 的等效 claim 立即撤销、Q0 baseline、active claim roots | D17 标准 Git 导入 | 无；D2/D3/D6 未签时使用安全缺省 | 未实现、不安全或费用未知入口不再公开可达；`AGENTS.md`/`justfile` 不再把本地基线称为 CI 等效；只形成 repo closure，不冒充已部署关闭 |
| SP1 最小真相与 gate bootstrap | active capability/action/scope schema、claim checker、最小 support matrix、gate-ID registry、batch evidence schema、`ai-supply-scope` 重分类 | SP0 | 升降级规则是本批 canonical deliverable，不是额外 owner 决策 | 现役高风险 claim 可追到稳定 gate/evidence；不含通用执行平台、全站 generator、Q1/Q2 或 reference journey |
| SP2a0 DB 安全收紧 | G-A5 的 future/gap schema 拒绝、迁移前恢复点、backup 不触发迁移 | SP1 | 无 | 未知/乱序 schema 不改原库；备份入口不迁移 |
| SP2a1 广义数据兼容（条件） | G-B3、workspace/config/receipt/client N/N-1、RPO/RTO | SP2a0 | 兼容窗口在批内按现役 producer/consumer 事实定义；新增支持承诺上浮 owner | 只在具体 consumer/release 需要时启动 |
| SP2b0 admission 收紧 | G-A7/A8 的 field admission、自动 probe hard-disable、静态 inventory、AI safety contract exact-set | SP1 | 无 | identity/rights/data/funding unknown fail-closed；零自动执行/packet/history |
| SP2b1 显式 probe/live 隔离（条件） | ProbeGrant、active caged probe、sandbox/egress、live evidence | SP2b0 | selected live surface 的 applicable AI decision exact-set + D12；Claude subscription 才需 AI 决策 4，LAN discovery 才需 AI 决策 5；企业网络形态另走 ADR | 未签时 disabled，不阻塞 SP2b0 收口 |
| SP2c0 audit 新写入安全 | G-A9 typed envelope/allowlist/digest、历史 exact inventory 与隔离标记 | SP1 | 无 | 新写入无敏感原文；历史行只盘点/隔离，不做不可逆处置 |
| SP2c1 历史/retention（条件） | 逐 store retention、迁移/删除/backup propagation/legal hold | SP2c0 | D13；不可逆删除另取当次授权 | 历史处置唯一且总数守恒；未签 parked |
| SP2c2 logger/correlation（条件） | G-B14、error taxonomy、correlation、容量 | SP2c0 | 具体 release/support 消费触发 | sink 故障与业务终态解耦 |
| SP2d API 边界规则 | G-B15：禁止新增 mirror；新增或改变跨进程/跨 package API contract、DTO 或 schema 的 consumer 才对 touched exact-set 做双端 runtime parse | SP1 | 兼容窗是该 consumer 批 deliverable；只改实现而合同/DTO/schema 零变化时以 schema diff 证据登记 `N/A` | 不建独立全量迁移批；该规则是批内义务，不形成额外活动批 |
| SP3a0 gate truth | G-A2 gate/workflow control graph 与 skip mutation | SP1 | 无 | required gate 可达且缺 evidence 非零；不依赖 SP2 receipts |
| SP3a1 release 参数化（条件） | G-B16、active candidate identity、固定 asset 回滚 | SP3a0 | 创建下一 RC 触发 | 本地门不外推跨平台/发布全绿 |
| SP3b distribution/evidence/Ops0（条件） | G-B10/B12/B13、E6/E7、最小 support/incident；按 distribution 消费 W5.4-c | SP3a0 + 对应 capability evidence | trigger=实际外部发布/public snapshot、创建下一 RC、提高 capability claim 或改变 distribution/support 承诺；repo-only 的保守降级不触发；D10+D19 必签，D12 仅 live/external 调用时，D11 仅升 `supported` 时 | 声明与 evidence exact-set 一致；W5.4-c 不形成平行活动批 |
| SP3c voice restart（条件） | G-B17、E9b | SP1 | candidate manifest 含 voice runtime 或公开 `voice=true` 时触发；Pipecat 选择为批内工程 ADR | env/Pipecat/TTS restart 独立验证；voice=false 时不施工 |
| SP4 单一 desktop formative 探针 | expert baseline + U1 条件实验 + AI supply 除 safety 子集外的 S1/S2a/S2b/S4/S6 exact-set；若是首个获批 slice，同批承担一次性 `Q1Q2-CORE` 初始化角色 | A 级 core evidence commits + 相应 release gate | D1、D14 + selected surface 的 applicable AI decision exact-set（3=evaluator fallback、4=分发版 Claude、5=LAN discovery）；有非零外部费用再签 D12/D16 小额上限 | 一个 desktop coding capability 有 formative evidence，不升产品档位 |
| SP5 条件非代码读面 | G-B1/B5/B11、E5、U3、一个 T1 read capability；若是首个获批 slice，同批承担一次性 `Q1Q2-CORE` 初始化角色 | A 级 core evidence commits + 对应 release gate | D4/D5/D14；新增 snapshot/retention 时 D13，有外部费用时 D12/D16 | 一个获批 read journey 可引用/复核/导出；D11/D15 仅阻断升 supported/升档 |
| SP6 条件扩展 | U2/U4、T2–T5、更多 protocol/platform/locale | 对应已闭合纵切片 + SP3 | 每项具名 decision/maintainer/预算/ADR | 只扩 owner 选择且能持续维护的 variant |
| SP7 校准与退役 | Q1–Q6 首个 slice→12→24→48、value-cost ledger、maturity 降级/退役 | SP1 + 被校准 slice | 扩容或晋级时的 D15/D16 | 频率与真实价值校准，低价值能力可退出 |

逻辑 DAG 不表示并行授权；受单仓单批规则约束，落入 PLAN-2 后仍逐批串行。core/条件子项拆开，
是为了让 gate、迁移、admission、audit、API、release、evidence 和 voice 各自可 readback/回滚，
并防止未签的放开项反向阻塞 fail-closed 收紧。

### 14.7 gap 与五线叶项到主责包的唯一映射

| gap | immediate owner | final primary owner | consumer / 未来重开 |
|---|---|---|---|
| G-A1 | SP0 降级 | SP0；选中领域的语义修复由 SP7 | SP5/6 只消费已修领域 |
| G-A2 | SP0/PG-01A 撤销 `AGENTS.md`、`justfile` 与现役 claim roots 的等效 claim | SP3a/PG-03 | SP1/PG-02 提供最小 schema；`stop_loss_set` 不改变唯一 `close_set` |
| G-A3 | SP0/PG-01B 隐藏并修已知错义 | SP1/PG-02 以完整 action denominator 关闭 | SP4/6 可另案实现已隐藏能力 |
| G-A4 | SP0 降级 claim | SP0 | SP1 checker 防回归 |
| G-A5 | SP2a0 禁自动升级 | SP2a0 | 后续 consumer 消费 migration receipt |
| G-A6 | SP0 关闭业务远程面 | SP0 | 仅 D18+ADR 后由 SP6 重开 |
| G-A7/G-A8 | SP2b0 禁未获权连接/自动 probe | SP2b0 | SP2b1/SP4–6 消费 admission receipt |
| G-A9 | SP2c0 停原文新增 | SP2c0 | SP2c1/2 与 SP3b 消费 audit receipt |
| G-B1/G-B5/G-B11 | 保持 deferred | SP5 | SP6 后续 connector |
| G-B2 | 限制高风险 route | SP2b1 条件；SP2b0 只做 hard-disable | SP4–6 |
| G-B3 | 入口明示 unsupported | SP2a1 条件 | SP3b 条件 |
| G-B4 | 保持 advanced/dev 路径 | SP4 | SP6 |
| G-B6/G-B7 | 诚实 unsupported/conditional | SP6 | SP7 校准 |
| G-B8/G-B9 | 旧 smoke 不外推 | SP7 | 各 slice 提供 reference |
| G-B10/G-B12/G-B13 | release claim 降级 | SP3b 条件 | SP6 新平台 |
| G-B14 | 普通日志 best effort | SP2c2 条件 | SP3b capacity |
| G-B15 | 禁新增 mirror | SP2d 跨批规则 | 每个 API consumer slice |
| G-B16 | 阻断下一 RC 手工改 tag | SP3a1 条件 | SP3b |
| G-B17 | voice restart 不称可靠 | SP3c 条件 | 含 voice 的 candidate |

每项只有一个 final primary owner；其他包只能消费 evidence 或在新 owner decision 后重开，不能复制
实现。批级 manifest 必须展开 slash 组合为 exact gap ID，不能把合并行当作模糊范围。C1–C4 的
归属与触发线就地登记在 3.3，不在本表重复。

五线叶项（E/U/S/T/Q）到主责包与 Wave 的唯一 crosswalk 如下；一个叶项拆成多行时以子项为准，
两表联合构成完整映射，表内未出现的编号不存在：

| 叶项 | 主责包 | Wave | 决策/前置 | 未触发时状态 |
|---|---|---|---|---|
| E0 现役 claim roots 与止损 | SP0 | 0 | 无 | — |
| E0 ledger/schema/checker/support matrix | SP1 | 0–1 | canonical 升降级权 | — |
| E1 gate/evidence bootstrap | SP1 | 0–1 | — | — |
| E1 workflow control graph | SP3a0 | 1 | — | — |
| E2 现役错义修正与隐藏（G-A3） | SP0 | 0 | 无 | — |
| E2 action truth gate | SP1 | 1 | — | — |
| E2 `direct_to_review` 完整实施 | 另案 | — | D3 | 隐藏并收窄 canonical |
| E3 DB 安全（G-A5） | SP2a0 | 1 | — | — |
| E3 广义兼容/restore（G-B3） | SP2a1 条件 | 1 之后 | consumer/release 触发 | deferred |
| E3 error taxonomy 与 correlation ID | SP2c2 条件 | 1 之后 | release/support 触发 | deferred |
| E3 资源预算与 capacity | SP3b 条件 | 1 之后 | release/support 触发 | deferred |
| E4 admission/发现收紧（G-A7/A8） | SP2b0 | 1 | — | — |
| E4 显式 probe/隔离（G-B2） | SP2b1 条件 | 1 之后 | selected live surface applicable AI decision exact-set + D12 | disabled |
| E4 远程信任面 | SP6 重开 | — | D18 + ADR | 业务远程 unsupported |
| E5 非代码证据平面 | SP5 | 3 | D4/D5、D13 | deferred |
| E6 平台与发布分级 | SP3b 条件 | 1 之后 | D10/下一 RC | Developer Preview 保守声明 |
| E7 分发定位与 evidence matrix | SP3b 条件 | 1 之后 | trigger=下一 RC/公开 claim；D10+D19，D12 仅 live，D11 仅升 supported | deferred |
| E8 audit 新写入安全（G-A9） | SP2c0 | 1 | — | — |
| E8 audit 历史/logger（G-B14） | SP2c1/2 条件 | 1 之后 | D13 或 release/support 触发 | parked/deferred |
| E8 API 边界（G-B15） | SP2d 跨批规则 | 各批 | consumer 定义兼容窗 | — |
| E9a release 参数化（G-B16） | SP3a1 条件 | 下一 RC 前 | 下一 RC 触发 | deferred |
| E9b voice restart（G-B17） | SP3c 条件 | 含 voice 的 RC 前 | candidate `voice=true` | deferred |
| U0 产品承诺分层 | SP0 | 0 | D1 缺省档 | — |
| U1 初级 managed-first | SP4 | 2 | D1、D14；D15 仅在晋级时 | capability 实验，不升档 |
| U2 资深 composable-first | SP6 | 4 | D1 | deferred |
| U3 非开发纵切片 | SP5 | 3 | D4、D14 | deferred |
| U4a 移动 | SP6 | 4 | D6、D18 | 业务面 unsupported |
| U4b 弱网/离线 | SP6 | 4 | — | deferred |
| U4c 无障碍 | SP6 | 4 | D7 | 卫生线以上 deferred |
| U4d locale 与语音现象 | SP6 | 4 | D7 | deferred |
| U5 团队与企业 | SP6 条件 | 4 之后 | D8 | 后置，只验证正确拒绝 |
| S0 scoped ledger rows/evidence 与 AI canonical Phase 0 | SP1 | 0–1 | 已签决策 SHA | — |
| S0.5 pre-send admission 收紧 | SP2b0 | 1 | — | — |
| S0.6 discovery safety 收紧 | SP2b0 | 1 | — | — |
| S1/S2a/S2b/S4/S6 核心供给纵切片 | SP4 | 2 | D1 + selected surface applicable AI decision exact-set | — |
| S3 local/custom/cloud | SP6 | 4 之后 | 各自 threat/费用 ADR | deferred |
| S5 advanced routing | SP6 | 4 之后 | D11 | deferred |
| T0 本地工程面盘点 | SP1（ledger 面）+ SP2b0（收紧事实） | 1 | — | — |
| T1 Web research 读面 | SP5 | 3 | D5 | deferred |
| T2–T5 document/structured/productivity/外部写 | SP6 | 4 之后 | D5、D11 | deferred |
| T6 extension | 不排产 | — | AI 决策 7 重开 + D9 | deferred |
| Q0 corpus 真相修复 | SP0 | 0 | D2 | — |
| Q1/Q2 taxonomy、schema、contexts、oracle 模板 | `Q1Q2-CORE` 一次性初始化角色；由首个获批的 SP4 或 SP5 slice 在自身批内唯一承担 | 首个实际 slice | 选定 persona/task | 未选 slice 不预建；后续 slice 只能具名消费/扩展，不得重建 core |
| Q3–Q5 reference 扩容执行（首个 slice→12→24→48） | SP4/SP5 提供首个消费样例；SP7 负责 12/24/48 校准 | 2/5 | 边际发现与维护预算触发；D15 仅 promotion，D16 仅第二轨/持续费用/portfolio | 只维护已消费 slice 的样例，不为 deferred 面造语料 |
| Q6 人工手册对账 | SP7 | 5 | — | 未来测试设计 |

两点归属澄清：

1. 运行时 A 级（G-A5/A7/A8/A9）的「立即止损」是行为改动，分别归 SP2a0/SP2b0/SP2c0；
   在对应 core 批落地前按第 9 节保持 `blocks_expansion`，不能以文案降级进入第二态。SP0 只关闭
   公开 claim、默认入口和远程业务面，不代替这四项代码收紧。
2. 决策前置只阻塞条件子项，从不阻塞 core 收紧：AI 决策 4/5 与 D12 只约束 SP2b1；D13 只
   约束 SP2c1；SP2c0 的停写、typed envelope、inventory/隔离标记无决策前置。core 与 conditional
   evidence 使用不同 ID，调度器不得以条件 evidence 未签为由阻塞 SP3a0 或其他 A 级关闭。

### 14.8 标准 Git 导入唯一排产源

本文件仍不是排产 SoT。D17 必须绑定
`docs/plan/2026-08-28-project-gap-d17-import-spec.md` 的最终 spec SHA-256；branch/HEAD、preexisting dirty
exact-set 或锁定输入漂移时旧签名失效，先重生成 spec，不能近似套用。owner 的批准原文必须字面包含
最终 64 位 spec SHA-256。

PG-00 直接使用当前专用 feature branch 的标准两提交流程：先以 explicit pathspec 形成 plan/import
commit `I`，再让两路 subagent 与 fresh Codex 在 I 的 clean validation worktree 上复审；通过后以
explicit pathspec 形成 evidence commit `E`，随后停在 owner。普通 commit 已原子推进 branch，reflog、
revert 与未来绑定完整 E OID 的 `merge --ff-only` 已覆盖恢复；不再创建 whole-dirty `B0`、temporary index、recovery/core
ref、手写 CAS、batch-open 或 abort 协议。本批不 push、merge、deploy 或自动开启 PG-01A。`I` 的确定
导入内容是：

1. 验证 `HANDOFF.md` active pointer 为空并锁定输入 revision/dirty exact-set；若不为空或 bytes 漂移，
   PG-00 零写入停止。
2. 在 PLAN-2 新增唯一的 A 级风险关闭串行坐标，并把当前“下一批 = ai-supply”改为 `PG-01A`；
   同步 HANDOFF 的下一批指针与开工先读链。PLAN-2 的“未回复缺省全做”对未来项改为“未被 exact
   选入即 deferred”；历史批次原文保留并标 superseded，绝不删除或改写既有 evidence。
3. 消除 AI supply 循环依赖与 draft-first 过度施工：`ai-supply-scope` 并入 SP1；只从 45k 行草案
   提取 SP2b0 实际需要的 selected safety contract，直接写 canonical/production contract；其余
   `ai-supply-contracts/ai-supply-p*` 保持 archive/deferred，等 SP4 选中 exact surface 后再消费，
   不预先编译、修全量 finding 或下沉。已签 AI 决策 2 对应的 Codex `exec` 路径保留，PLAN-2 的
   app-server spike 移入 deferred inventory。
4. 把已完成的 W5.4-b 作为历史输入；W5.4-c 改为 `conditional_release_evidence`，只在
   对 Claude capability 作公开/RC 支持声明前由 SP3b 消费，不再形成平行下一批。R-B remote 部分
   `deferred_by_D18`；R-C 与 W6–W8 分别进入 inventory/deferred；A5-armed/UI 为
   `not_authorized`；W9 保留为只读 trigger track，不是 active/next batch。
5. 按第 20.3 节只写入 `PG-01A`、`PG-01B`、`PG-02`、`PG-03`、`PG-04`、`PG-05`、`PG-06`
   七个 A 级 core 批；每批登记 depends_on、A-ID exact-set、
   scope roots、focused/full gate、evidence path、rollback 和 deferred exact-set。
6. 两路 subagent 与一次 fresh Codex 对同一 `I` commit/tree 做独立一致性复审；A 必须为空，B/C
   必须逐项 disposition。`E` 只写第 3.2 节列明的 required evidence 与现有 week-audit writer 七项
   allowlist 的实际变化子集，不写自身 SHA；E 后静态门由 Git history
   与本会话原始输出证明。E 形成后停在 owner，不要求对同一战略重复确认；但开 `PG-01A` 仍遵循
   PLAN-2 批生命周期，且 D17 不授权后续产品代码实施、push、merge、deploy 或外部调用。

PG-00 本身不实施功能，但它是“完整方案可执行”的 A 级前置。若 owner 不签 D17，本计划的正确
状态是保留为审计建议，而不是让实施者在两个计划之间自行选择。

## 15. 完整对应后的回报与补足

### 15.1 可直接得到的回报

| 回报面 | 补足了什么 | 可机械确认的领先指标 | 不能在静态计划里承诺的商业结果 |
|---|---|---|---|
| 产品真相 | “有设计/检测到/可条件使用/已支持”不再混写；官网、UI、README、release 同源 | supported claim 全部有 capability ID、现役入口、required gate 和未过期 evidence；孤儿 claim 为零 | 用户是否因此更愿意购买或传播 |
| 发布可信度 | 本地、CI、release 的命令和控制流可对账，skip/假绿可见 | required gate 不可达、被 skip 或证据过期时 overall 非零；被测 commit 与 artifact digest 可追 | 发布频率一定提高多少 |
| 数据与恢复 | 未来 schema、失败迁移、workspace/sidecar、backup/restore 有确定处方 | future/gap/WAL-only 与任一 production migration 故障反例不改原数据；支持类型均有 RPO/RTO 和 restore rehearsal | 现实世界永远不丢数据 |
| 安全与费用 | production secret、账户、权限、数据边界和费用在首包前共同裁决；审计原文有唯一处置 | 自动/后台 probe 零 secret/零包；显式 ProbeGrant 有物理上限且无业务内容；未知外部 effect 零盲重试 | 没有任何第三方或人为安全事故 |
| 初级用户 | 在 D14 选择扩圈后，普通模式可隐藏内部供给结构 | reference + formative journey 只证明特定 persona/task 可用；D15 前不升产品档位 | 大众用户一定能自助，需 repeated-use 真人门 |
| 资深用户 | 配置、路由、费用、数据与工具调用可解释、可导出、可回滚 | 每次运行能回答用了谁、为何、费用归属、数据去向、工具和 receipt | 所有专家偏好都被满足 |
| 非开发场景 | 不再拿 coding/git 证据套 research/writing；D4/D5 后可试一个 public-URL read 纵切片 | selected Web/artifact snapshot、freshness、citation、review/export 同批闭合 | 12 个业务领域都已经可执行 |
| AI 与工具扩展 | 以 protocol/capability/authority 扩展，避免品牌乘以槽位、平台和权限的组合爆炸 | 新 surface 复用公共 admission、receipt、TCK；品牌 inventory 不进入 supported denominator | “所有订阅、所有 API、所有工具”都可用 |
| 移动与平台 | 有 app、能打开、能安全访问业务数据、能审批、能语音被拆成独立能力 | D18 前业务远程 unsupported；各平台只显示 maturity、evidence age 和限制 | iOS/Android/HarmonyOS 完全等价 |
| 模拟提问 | 从“用户想做什么”补到“谁在何种产品状态下如何使用、失败后如何恢复” | 选中 slice 一正一反→12→24→48；长/跨 session、applicable failure、真人与 microcase 分账 | 合成语料能代替真人测试与真实遥测 |

### 15.2 产品层面的实际跃迁

按推荐顺序落地后，SayDo 会发生三次可区分的跃迁：

1. SP0–SP3 把“功能很多但边界不齐”变成“少承诺但每条承诺可证明”。主要回报是降低数据、
   凭据、费用、审计、误述和发布事故，而不是新增可见功能。
2. SP4 先证明现有 Developer 主线不退化，并形成一个 desktop coding 的真人 formative 探针；
   SP5 只有 discovery 与 retention/预算裁决后，才增加一个非代码 read 实验。两者都不自动改变
   audience/maturity。
3. D15 repeated-use promotion 通过后，才可能从 developer/preview 进入 individual/preview；
   SP6–SP7 再把获批纵切片变成可维护组合：资深控制、选定平台、外部写、真实故障、
   长会话和退役机制开始闭合。

即使所有推荐项都对应，仍有明确未补足面：Team/enterprise、A2A、第三方 connector 市场、
所有 SaaS 写面、所有 locale、全平台语音等价、电话形态和“任意消费订阅复用”。这些不是漏做，
而是必须由需求、合规、维护预算和 owner 决策重新解锁的独立产品。

### 15.3 经济回报如何判断

本计划可以证明风险、交付与使用路径是否闭合，不能仅凭静态分析给出收入或 ROI 数字。经济回报
需要在实施前为每个纵切片登记 baseline、反事实和完整单位经济性，并在真实使用后观察：

- 激活：从安装到首次合法供给、首次 dispatch、首次验收的到达率与人工帮助分钟。
- 可靠：失败恢复率、重复 effect、数据恢复、release rollback、support incident。
- 质量：coding 的独立任务/回归结果和延迟返工；research 的引用支持率、关键来源遗漏、事实纠错、
  时效和盲审质量。用户点击“验收”不等于独立质量。
- 价值：与当前人工流程/next-best product 比质量、时间和主动人类分钟；WTP/price，或明确的
  非收入战略回报；cohort repeat/retention 窗口与任务复杂度。
- 成本：每次成功任务的 AI/connector/evidence/support/incident 变量成本，固定账号、CI/device、
  storage、maintainer 小时，贡献毛利或预算消耗；考虑 GA 时另计获客/分发成本。
- 组合：每个 supported surface 的活跃用户/任务量，相对于其维护、账号、合规和回归负担。

统一 value-cost-ledger 至少记录 metric ID、公式、事件源、numerator/denominator、任务复杂度、
样本与 dropout、窗口、missing-data、人工帮助、privacy mode、baseline/threshold、签署人、
固定/变量成本与 decision rule。默认本地聚合并可导出，跨用户聚合需 opt-in；无遥测是 missing，
不能记作 0。没有上述字段时只报告原始计数，不写趋势因果或“提升百分之多少”。

### 15.4 真人验证与晋级合同

真人验证不等 Wave 5，分三段：

1. D4 前 problem interview/concept comparison：比较任务频率、痛点、当前替代、切换/付费意愿、
   输入可得性、rights/data 风险、闭环成本与 time-to-value。
2. SP4/SP5 内 formative usability：参与者使用自有或等价真实任务，登记 target segment、招募/
   排除、样本量或饱和理由、assisted/unassisted、主持人干预预算、关键错误、放弃/恢复，以及准备
   宣称的 device/network/access need/locale。
3. audience/maturity 晋级前 repeated-use pilot：固定 exact capability/task、质量、无协助完成、
   关键安全/数据/费用事故、失败恢复、重复使用窗口、support minutes、evidence TTL 与 decision rule。

研究材料还需同意、脱敏、retention 和删除传播。未完成第三段时，只能说具名 capability preview，
不能把一次内部 dogfood、合成 journey 或单次成功 live 调用写成 Individual/Team 晋级。

## 16. 除开发之外的全生命周期成本

### 16.1 成本分类

下表的低/中/高只用于方向说明，不能参与开包或 D11–D19 裁决。具体 SP 必须改用：月固定账号/
订阅费、每成功任务变量费、每 release qualification 费、maintainer/support/incident 小时、
真机/runner 小时、证据存储/保留、最坏事故响应小时；无法报价写 unknown 并 hard stop。

| 成本 | 可信底座 | 首个价值闭环 | 受控扩展后的强度 | 主要驱动 |
|---|---|---|---|---|
| AI/API 与 connector 用量 | 低 | 中 | 高且随任务量变化 | token、搜索、抓取、SaaS API、重试、测试调用 |
| 真实测试账号与订阅 | 低到中 | 中 | 高且随 product/realm 增长 | provider 账号、MFA、额度、地区、清理和封禁风险 |
| CI、构建、签名与设备 | 中 | 中 | 高 | 多 OS runner、真机、Apple/Android/Harmony 工具链、证书与商店 |
| 存储、备份与证据 | 中 | 中 | 中到高 | audit 增长、snapshot、日志、备份世代、artifact 与保留期 |
| 监控与事故响应 | 中 | 中 | 高 | live canary、证据过期、磁盘/队列、provider drift、撤权和恢复 |
| provider/connector 兼容维护 | 低 | 中 | 高 | 协议、schema、OAuth、scope、定价、条款和产品 edition 变化 |
| 密钥、证书与供应链 | 中 | 中 | 高 | signing、rotation、依赖 EOL/CVE、SBOM/provenance、商店与 OAuth app |
| 隐私、版权、条款与合规复核 | 中 | 中 | 高 | 用户内容出网、Web snapshot、数据驻留、消费订阅 rights、企业要求 |
| 客服、文档与培训 | 低到中 | 中 | 高 | 初级用户处方、迁移、账户问题、费用争议、平台差异 |
| 无障碍、locale 与语音质量 | 低 | 中 | 高 | 辅助技术、翻译、ASR/TTS、时区/币种、真人回归 |
| 用户研究与语料策展 | 中 | 中 | 中 | 访谈、journey/oracle、失败复现、频率校准与去重 |
| 兼容与退役税 | 中 | 中 | 高 | DB/schema、API、配置、旧客户端、旧凭据、旧 receipt 和迁移窗口 |
| 机会成本与认知复杂度 | 中 | 中 | 很高 | 同时维护过多 provider、平台、项目类型和设置项会挤压核心体验 |

### 16.2 容易被忽略的非现金成本

1. owner 注意力：rights、费用、产品档位、支持组合和退役都需要持续裁决，不能完全自动化。
2. 账号责任：真实测试账号可能触发 MFA、封禁、额度、残留资源和个人/公司责任边界。
3. 证据债：一项能力一旦称 supported，就要在协议、平台、账号或发布变化后重跑证据。
4. 隐私与法律暴露：Web、邮箱、文档、审计和遥测扩大数据处理范围，也扩大删除、访问和事故响应责任。
5. 支持承诺：多平台/多 provider 的边缘问题通常不是代码缺陷，而是版本、网络、账号、条款和地区组合。
6. 性能与可用性税：更多 admission、snapshot、receipt 和 verify 会增加启动、派发或收尾延迟，需要预算和降级设计。
7. 组织复杂度：capability ledger、TCK、release profile 本身也要维护；若能力数很少，过早全自动生成会成为形式负担。

### 16.3 成本控制规则

1. supported 是 supported_variant 的持续服务合同，不按 logo/surface 粗算。维护 key 至少包含
   product/edition/realm/surface/protocol/auth/operation/funding/platform/locale/distribution；
   没有 maintainer、live 账号/设备、费用上限、evidence TTL 和退役路径，只能 conditional/preview。
2. 一次只新增一个需要 live evidence 的外部纵切片；先观察真实使用，再增加同类 provider/connector。
3. 证据按风险和变更触发：PR 只跑 hermetic；scheduled live canary 按 TTL；RC 重跑
   new/changed/expired/high-risk variant。所有公开 claim 必须消费未过期 receipt exact-set，但
   不等于每次 RC 对所有外部厂商重跑；当前 health/outage 与 protocol compatibility 分轴。
4. API/connector 有物理调用和费用硬上限；unknown funding 不进入后台、fallback 或自动重试。
5. 日志、snapshot、backup、audit 分别定 retention/deletion/export/backup propagation/legal hold；
   D13 未签禁止新用户内容 snapshot。audit 最小化不等于无限存储，原文不进 audit。
6. 每次新增平台、locale、provider、connector 或项目类型时，必须同时登记 external dependency、
   portability、credential revoke、用户迁移和退役/降级步骤。
7. 每个发布周期对 supported 组合做价值/成本盘点：低使用、高事故或证据长期无法刷新的能力降级，
   不用沉没成本维持虚假覆盖。

### 16.4 必须持续运转的四份合同

1. capacity envelope：每个 distribution profile 的最大 concurrent session/task、queue depth、
   DB/WAL/log/audit/snapshot/backup 存储、provider retry/rate、p95/p99 latency 与 degraded behavior；
   用合成负载/故障注入和 doctor capacity 判定，不承诺未测 SLO。
2. compatibility/rollback：daemon↔pipeline、console/mobile↔daemon、DB/config/secret、receipt/
   evidence/ledger 各自列 producer/consumer version、支持窗口、升级顺序、unknown-field、旧凭据/
   receipt 读取期限；RC 覆盖 old/new binary × old/new state/client，并演练固定 asset rollback。
3. support contract：每个 release profile 的 supported version/platform exact-set、best-effort 或
   响应目标、issue intake、脱敏诊断包、known issues、安全更新、EOL/deprecation notice 和 owner。
   无合同只能 preview。
4. Ops0 incident runbook：severity/trigger、incident owner、kill switch、credential revoke/rotate、
   provider/connector disable、backup restore、release rollback、用户/安全公告、证据保全和
   postmortem；SP3b 前至少做一次 tabletop，receipt 有 TTL。

## 17. 是否都是最合理方案

### 17.1 结论

不是所有“最终形态”都应现在实施；但本方案已经把合理性分为三类：

- 必须现在做或禁用：9 个 A 级、E9 下一 RC 参数化、现役公开误述。这里不存在“继续带风险扩张”
  的合理第三条路，只有修复或诚实关闭。
- 当前最合理的价值投资：最小 Truth/Authority/Durable 公共底座、一个 desktop coding
  reference journey、一个合法 inference protocol、一个已证明 execution driver 和少量真实 evidence。
  先保护 expert Developer 主线，再由 discovery 决定是否扩圈。
- 只有触发后才合理：完整移动写/审批、多 locale、Team、SaaS 写、第三方 SDK/registry、A2A、
  Web research/MCP 第二价值轨、全语音 installer 和大范围 provider 矩阵。当前远程业务读面也
  不属于安全降级；提前做会把维护与数据风险放在用户价值之前。

因此，合理性不等于每一行都施工；合理方案是“硬风险关闭 + 最小纵切片验证 + 需求驱动扩张”。

### 17.2 owner 决策的推荐答案

| 决策 | 当前推荐 | 为什么 | 何时重开 |
|---|---|---|---|
| D1 | 保持 rc + developer/preview；深化核心与扩圈二选一，先有 expert must-not-regress | 目标人群/成熟度/distribution 不能混成 Developer RC | D15 repeated-use promotion 通过 |
| D2 | 立即降级 986 项声明，只修 owner 选中 capability 所需领域 | 全量人工修复成本高，且大部分尚无生产 connector | 新 connector 进入 scope 时逐域修 |
| D3 | 隐藏 direct_to_review | 完整接线牵涉预授权、预算、S2/S3 和证据，不应为按钮强做 | step_confirm 使用证明直达有高价值 |
| D4 | 先做 problem interview；签 D14 前只有 expert desktop coding reference | coding/research/writing 服务不同 ICP，不能无证据合成定位 | rubric 选出 primary 与预算上限实验 |
| D5 | 未签不排 connector；若选 Web，只做 public URL read + artifact | search/browser/SaaS 的条款与成本完全不同 | public URL journey 稳定且出现具名需求 |
| D6 | 远程业务面 unsupported；未来先选一个平台再选 capability | 当前 bearer 可读转写/记忆，read-only 仍是 A 级风险 | D18/ADR、per-device trust 与真机闭合 |
| D7 | 中文主线 + 无障碍卫生线，不宣称双语/WCAG 全面达标 | 全 locale/辅助技术持续成本高，当前缺真实目标人群 | 目标市场与 access need 有明确用户 |
| D8 | Team/enterprise 后置 | 单 owner 数据与审批语义尚未演化，提前加 UI 会造空壳 | 有第二组织和管理员需求 |
| D9 | D5 未签时 MCP deferred；获批也只 first-party signed local stdio client | 任意 local/remote/OAuth server 的风险不同；A2A 是另一风险面 | 各 transport 独立 TCK 与真实需求 |
| D10 | 当前包继续 daemon/console Developer Preview | voice runtime、service lifecycle 和全新机真麦证据未进包 | 用户证明完整语音 installer 值得持续支持 |
| D11 | 按 supported_variant 签组合总上限、owner 小时、账号/设备、evidence backlog 与年度费用 | 每项单独有 maintainer 仍会发生笛卡尔爆炸 | owner 明确扩大持续容量 |
| D12 | PR hermetic + TTL canary + RC changed/expired/high-risk；签每次/日/月硬上限 | 兼顾真实性与外部 outage/费用，不绑架每次 RC | 事故数据证明提高某类频率 |
| D13 | local-first、遥测 opt-in、逐 store retention/deletion；未签不新增用户内容 snapshot | retention 是 Web/artifact 的前置，不是事后成本 | 独立隐私设计获批 |
| D14 | 现有 expert developer 是保护基线；新 primary ICP/JTBD 由 discovery 决定 | 先回答为谁、替代什么、明确不为谁 | problem interview 饱和且 owner 签署 |
| D15 | 三段真人合同，晋级前 repeated-use、质量、恢复、事故和 support minutes 全过 | 合成/内部一次成功不能证明产品档位 | decision rule 达标且 evidence 未过期 |
| D16 | 每条价值轨必须有反事实、WTP/战略价值、unit economics、next-best、WIP/recurring cap | 工程指标好不代表值得持续投资 | 概率收益和 portfolio 容量重新签 |
| D17 | 若采纳本 program，先以标准 Git 的本地 I/E 两提交导入 PLAN-2 并阻断旧扩张路径 | 否则两个计划并存，本文件没有执行力 | commit parent、staged/diff exact-set、I 复审与 HANDOFF pointer 对账 |
| D18 | remote trust 另走 ADR，唯一选择 transport/root/issuer/store/compat/recovery | TLS/Noise 不能由方案作者代拍，也不能跨端各做一套 | 业务远程需求与首发平台明确 |
| D19 | Developer Preview 采用 best-effort support，但安全/数据事故有 Ops0 owner、更新与 EOL | preview 不等于无人负责 | 支持团队或 SLA 改变 |

### 17.3 需要主动防止的过度设计

1. capability ledger 先用最小 schema + validator + 手工维护的少量现役条目；只有第二个以上输出面
   出现漂移后才扩成完整生成系统。
2. 不先逐条修 986 个 LIVE source；先降级真相，再按首发 connector 领域修。
3. 不按品牌做十几个 provider adapter；协议同构者走 registry，非同构协议才写 adapter。
4. 不在真实 read journey 之前做 connector SDK、marketplace、TUF registry 或 code plugin sandbox。
5. 不因已有三个移动壳就追求三端全能力等价，也不保留不安全业务 read；D18 后只选一个平台。
6. 每个选中 slice 从一正一反 reference 开始；只有新增发现/维护小时证明边际价值才扩 12/24/48，
   配额是预算上限。
7. 不把所有 live evidence 放进 PR；按 release promise exact-set 和风险分层。
8. 不在业务价值未证明前做 Team、A2A、电话、全本地语音或所有 locale。

### 17.4 继续、暂停与退出条件

owner 当前只需签 D17 的 exact import spec；它不一并签 external spend、release promise 或长期产品
方向。PG-01A–PG-06 的安全缺省不因工程拆分重复请求战略签名，但每批仍按 PLAN-2 取得实现停点，
部署另取授权。SP4–SP6
每次新增用户、connector、platform、费用承诺或 scope 时才签 decision card。card 至少包含：
target ICP/JTBD、明确非目标、唯一纵切片、next-best alternative、baseline 周期、用户/任务
denominator、样本/饱和理由、任务复杂度、观察窗、人工帮助与排除规则、质量/成功阈值、完整
成本与 WIP 上限、required evidence、maintainer、privacy/retention、decision rule 和退役动作；
其中价值测量类字段直接复用 15.3 value-cost-ledger 的字段定义，不另维护第二份字段清单。

- 继续：安全门关闭，真实旅程按 card 的 denominator/rule 达标，持续成本未超上限，且没有用
  未登记人工兜底伪造成功。
- 暂停：rights/费用/数据边界未知，required evidence 过期，真实账号/设备不可维护，或 support
  负担超过签署容量。
- 降级：能力仍有价值但只在特定条件成立，公开状态改 conditional 并显示限制与 evidence age。
- 退出：低使用、高事故、上游 surface 退役、条款不允许或维护者缺失；先导出/迁移，再撤销
  credential、停止新调用、保留必要兼容读取和退役收据。

没有真实用户测试时，本轮只能判断架构、安全与成本逻辑是否合理，不能判断市场选择是否最优。
后者必须由 SP4/SP5 的真人旅程、访谈和实际使用数据回答。

## 18. 第二轮完整方案复审记录

本节审查的是补入第 14–17 节后的方案快照，与第 13 节的初稿复审不是同一轮。三路 subagent
均只读、未改文件、未运行产品测试：

| 角度 | 结果 | 主要问题 | disposition |
|---|---|---|---|
| 工程质量 | 3A / 11B / 2C | 唯一排产源可被绕过、SP 无闭合 DAG/唯一主责、G-A7 认证探测循环；另有拆包、兼容、容量、事故、支持与 TCO 缺口 | 三个 A 分别落为 D17 导入事务、SP0–SP7 DAG/唯一映射、Stage 1 静态 admission + Stage 2 显式 ProbeGrant；B/C 吸收进 SP 拆分、D18、§15.3、§16.4 和过度设计触发线 |
| 用户与语料 | 0A / 7B / 2C | 晋级缺真人合同、两个新纵切片分属不同 ICP、资深用户机会成本、ROI/反事实不足、语料固定扩容 | 新增 D14–D16 与 §15.3–15.4；最小价值面收窄到 desktop coding；expert must-not-regress 前置；journey 改为 12→24→48 分段预算 |
| AI 与工具生态 | 0A / 8B / 2C | provider policy/OAuth/quota/portability 生命周期、MCP 边界、supported variant 组合上限、live evidence cadence | 新增 ExternalPolicyEvidence、OAuthOperationalProfile、QuotaPolicy、portability/exit、D11–D13；Web 限 user-provided public URL read，MCP 未签保持 deferred |

三路发现均已转成以下三种可判定 disposition：文本纠错、future acceptance/contract、或 owner
decision/deferred；“已吸收”不表示 D1–D19 已签，也不表示对应能力已经实现。

独立 Codex 对抗评审输入为
`prompts/207-project-gap-solution-value-adversarial-review.md`。第一次 fresh session 在 20 分钟
上限后 exit 124，未产出 report，日志保留为
`logs/207-project-gap-solution-value-adversarial-review-attempt1-timeout.jsonl`；没有 resume 卡住的
session。收敛 prompt 后第二个 fresh session 使用 `gpt-5.6-sol` + `max`、read-only、stdin 关闭，
exit 0 且事件流含 `turn.completed`，报告为
`research/codex-findings/207-project-gap-solution-value-adversarial-review.md`。

该报告对评审时快照裁决 `[fail] 4A / 9B / 1C`。本轮逐项吸收了四个 A：SP0 无条件止损、
远程业务 payload 全关、历史敏感 audit exact inventory + 分类唯一处置、D13 成为 SP2/SP5 阻断
前置；九个 B 与一个 C 转为 D11–D19、最小 Truth checker、单一 desktop coding 价值面、叶项
crosswalk、ROI 样本设计、AI 决策前置和 12→24→48 语料触发线。报告继续保留 pre-fix
`[fail]`，回修后没有再次运行独立 Codex 复评，不能宣称外部 `[pass]`。

本轮仍是静态方案工作：未运行 lint、typecheck、unit、contract、build、e2e、真实账号、真人、
真机或 connector 测试。最终只运行文档 emoji、链接和 diff whitespace 门；结果记入
`history/PROCESS-JOURNAL.md`。

## 19. 第三轮独立复审与修订记录

本节记录 2026-08-28 由独立会话（Claude，与第 13/18 节撰写与评审方均非同一会话）对 v2 全文的
复审与回修；仍是静态文档工作，未运行产品测试。

证据核验：三路并行 subagent 对 G-A1–G-A9 的全部 36 条 file:line 证据锚、G-B1–G-B17 证据锚与
对 PLAN-2/owner decisions/AI 专题的引用共 59 条逐条只读复核：对本文档正文引用 0 条方向性
失实，A 级 36 条全部成立。G-A1 计数在 rg 出现次数之外另做逐对象复核（752/234 为互斥对象数，
合计恰为 986）。核验发现的精度问题已回修：G-A2 justfile 行段补含 ci-python；G-A6 的
`net/capToken.ts`、`net/pairUrl.ts` 补 `packages/daemon/src/` 包前缀（原文紧跟 console 路径
易误导包归属）；G-A9 补「截断 80 字符仍为明文」语义；G-A3 补 `ExpectationGroup.tsx:63`、
`ProgressAlignCard.tsx:31` 将 `0/0` 占位如实渲染为 `¥0` 的消费端证据；G-B7 摘除该锚不支持的
「弱网」半句（覆盖索引 :76-82 无弱网字样，改为本轮新登记缺口）；14.8 的 W5.4 链补「先关
W5.4-b 复审」一步。

结构回修（针对第 18 节自称已吸收但未完全落地、或本轮新发现的问题）：

1. 207-B9 残留：第二轮实际只落了 gap 级映射（14.7 第一表），五线叶项级 crosswalk 缺失，
   E3 观测/容量子项、U0、S0、S3、S5、T0、Q1/Q2 前置均无主责包归属。本轮在 14.7 补齐叶项到
   SP/Wave 的唯一 crosswalk 表，消除全部悬空叶项。
2. E8 验收的「镜像 DTO 为零」（全局断言）与 G-B15 的「归零只对本批 selected inventory 判定」
   （分批口径）矛盾，统一为分批口径：新增为零、本批完成双端 parse、存量按期限迁移。
3. 决策前置死锁修复：D13、AI 决策 4/5、D12 原样前置整个 SP2 会让 fail-closed 收紧被未签
   决策卡死；精化为只阻塞对应放开/retention/live 子项（14.6 前置列、14.7 澄清 2、Wave 1），
   收紧永不等待未签决策。Wave 0 的 problem interview 同理改为并行启动，只阻塞 SP4/SP5。
4. 防过度设计补两条：6.2 的 ledger 全字段只对进入 scoped 施工的条目要求，`inventory_only`/
   deferred 条目最小字段登记；7.1 的 MCP 表述从「本轮缺省仅允许 builtin」（可误读为缺省启用）
   收紧为 D5/D9 未签前整体 deferred。

owner 随后为本轮追加定位「尽可能标准完整的对应，但不过度设计、不过度实施」，同一会话按此
做了第二批修订：

1. 完整性补齐：新增 1.4 编号体系导读（六套编号、两套决策体系的读法）；C 级升格为 C1–C4 并
   逐条登记归属包与触发线（3.3，14.7 注明不重复列表）；第 10 节补裁决登记方式（沿用
   ai-supply 签署惯例、载体二选一、decision digest 来源、未签即缺省动作生效）；17.4 decision
   card 的价值测量字段复用 15.3 value-cost-ledger 定义，消除第二份字段清单的漂移源。
2. 防过度：11 节批模板分级——SP0–SP3 止损/修复批免第 11 项价值测量（风险关闭本身即价值，
   由 A-ID disposition 与 gate evidence 证明），SP4 起扩张批 12 项全量；E4 出站策略以声明边界
   为主，未选中的企业网络形态（mTLS、企业 CA 等）标 unsupported，不为其实现支持。
3. 编号统一：正文两处「owner 决策 2」「决策 7」统一为「AI 决策 N」前缀，消除与 D1–D19 的
   混淆面。

本轮（含第二批）回修后同样未再运行独立 Codex 复评；第 13/18 节与本节的评审结论各自针对其
评审时快照，历史 `[fail]` 记录不因回修改写。静态门（emoji、doc links、`git diff --check`）在
每批修订后重跑，结果记入 `history/PROCESS-JOURNAL.md`。

## 20. v7 实施化层

### 20.1 状态、授权与复杂度预算

`implementation-ready candidate` 只表示范围、顺序、门禁、证据和回滚可以被独立实施会话照抄；
不表示 D17 已签、PLAN-2/HANDOFF 已回写、代码已实施、产品测试已运行或任何能力已部署。

当前唯一需要 owner 决定的是 D17：是否允许 PG-00 在当前专用 feature branch 上，以 explicit
pathspec 创建一个本地 plan/import commit `I` 和一个本地 evidence commit `E`。精确授权文本见
`docs/plan/2026-08-28-project-gap-owner-decisions.md`。D17 不授权 PG-01A 之后的代码施工、push、merge、
deploy、真实账号、外部调用、费用或数据删除。

v7 采用以下复杂度预算，后续 reviewer 不得通过“再加一层摘要/receipt/selector”规避它：

1. 标准 branch/worktree/commit/tree 是版本、隔离、恢复与 bytes 身份；不另造 B0、recovery/core ref、
   `update-ref` CAS、WAL 或文件级提交点。
2. 一批只有 `P predecessor → I implementation → E evidence` 三个角色。当前由 owner 单一 dispatch
   保证串行；若误开两个 candidate，只有 predecessor 仍匹配、source tip 仍恰等于已复审完整 E OID
   的候选可按该 OID `merge --ff-only`，另一支失效。
   只有出现可复现的并发开批事故后才允许增加普通 open commit，不预建锁与 abort 状态机。
3. 一份 evidence 同时承担批结果、门禁记录和 readback 指针；不再生成 execution manifest、validation
   run/attempt、wave input、finalization invocation/result 或 mutable selector 等平行投影。
4. 只有产品合同需要的 schema/checker 才进入 PG-02/PG-03；纯编排元数据不演化成通用执行平台。
5. 对真实高损害风险保留 fail-closed、exact scope、独立 readback、ff-only 晋升和整笔回滚；对未建立
   威胁模型的 ACL/xattr/mount/fencing 不预先施工。

### 20.2 所有代码批共用的标准 Git 生命周期

PG-01A–PG-06 仍按 PLAN-2 串行执行。每批必须完整满足：

1. **开批授权**：锁定前批 evidence commit `P`；其 HANDOFF active 为空且 next 唯一指向本批，owner
   明确允许启动。未签的 D/AI decision 只阻塞对应放开项，不能阻塞安全收紧。实现会话从 P 建一个
   普通 `codex/` feature branch 与独立 worktree；目标集成分支不在该 worktree 中施工。
2. **exact scope**：实施 prompt 把批卡的 scope roots 展开为 exact path list，并列 `must_change`、
   `may_change`、`must_not_change`；HANDOFF 始终是 must-change。新增路径时先停当前 turn、修订 scope 并
   重做独立 readback；不得 `git add -A`、顺手清债或带入 preexisting dirty bytes。
3. **合同先行**：涉及状态/API/话术/数据/发布承诺时，先按 `docs/09`、`docs/10`、`docs/11` 权威分界
   修改 canonical 并做一致性复审；若合同不变，evidence 写明理由。
4. **implementation commit**：形成唯一一个 `parent(I)=P` 的 implementation commit；HANDOFF 在 I 中
   记 `active=<batch>,next=none`。只用 explicit pathspec staged，并证明
   `must_change ⊆ changed ⊆ must_change∪may_change`、`changed∩must_not_change=∅`。review 返工只能
   amend/recreate 这个未发布单 commit；不能把曾触碰越权路径后又还原的祖先 commit 留入 E 的历史。
5. **同 SHA 门禁**：在 I 的 clean validation worktree 上运行 focused gate、`just ci`，以及批卡列明的
   Playwright/live/device/release gate。每条命令直接记录 exit；skip、命令不存在或在另一 SHA 运行
   都不算绿。
6. **独立 readback**：实现会话不能评自己。reviewer 只读取本批计划、P/I SHA/tree、exact diff 与
   门禁日志；`verdict=pass` 且 A 为空才允许继续，B/C 必须逐项 disposition。A 级红灯回原实施会话，
   第二次仍红则按仓库规则换新实施会话。
7. **evidence commit**：先显式 stage prompt/report、journal、evidence，并把 HANDOFF 改成
   `active=none,next=<next-or-owner-stop>`；证明 working tree 与 staged index 全等且无非 ignored
   untracked path 后，运行现役 `node scripts/week-audit.mjs --write`，只把其七项固定输出的实际变化
   subset 加入同一个 E，再次证明全 tracked index/worktree 全等并形成唯一一个 `parent(E)=I` 的 E。
   E 不写自身 SHA；在 clean E 上重跑 emoji、doc links、`node scripts/week-audit.mjs --check-bundle`、
   仓库当时其他 publication/audit 门、`git diff --check <P>..<E>` 并回读两段 exact pathset。若未来
   week-audit 的固定输出集合改变，批 prompt 必须从当时脚本/config 展开，不沿用本文七项旧列表；
   不得跳过 writer、把生成物拆成第三提交，或用遗留 working-tree bytes 通过门禁。
8. **晋升停点**：只有 owner 另行允许集成、目标分支 tip 仍 byte-exact 等于 P、目标 worktree 干净时，
   且授权字面绑定完整 E OID、candidate branch tip 仍恰等于该 E 时，才可在目标分支的正常 attached
   worktree 执行 `git merge --ff-only <full-E-OID>`，随后断言目标 tip 恰等于 E；不允许按可移动 branch
   名集成、merge commit、force、隐式 rebase 或复用旧 review。D17 不提供这项后续授权，push/deploy
   继续单独审批。
9. **失败与回滚**：晋升前失败只影响 candidate branch，取消时直接不采用，无全局 active 锁需要解除。
   若两个 candidate 从同一 P 误开，先晋升者使另一个 predecessor 失效，后者必须停止。确需撤销已晋升
   E 时另获授权后整笔 revert；不得恢复失实 claim、远程业务 payload、自动 probe、DB 自动升级或敏感
   原文写入，安全缺省始终保留。

#### 20.2.1 最小 evidence schema

`e2e/evidence/project-gap-<batch-lowercase>.md` 只需包含：

```text
batch_id
plan_section
predecessor_sha
implementation_sha
implementation_tree
changed_path_exact_set
decision_file_sha256_exact_set
sp2d_state: triggered | N/A(reason)
focused_gate: [{command, tested_implementation_sha, tested_implementation_tree, exit, log_path, log_sha256}]
full_gate: [{command, tested_implementation_sha, tested_implementation_tree, exit, log_path, log_sha256}]
readback: [{reviewer, reviewed_implementation_sha, reviewed_implementation_tree,
            report_path_or_message_id, report_sha256_if_file, verdict, A, B, C}]
A_ID_disposition: [{id, repo_status, deployed_status, evidence}]
not_run_exact_set
rollback_or_safe_default
```

其中 Git SHA/tree 直接由本会话真实命令取得，且 `parent(I)=P,parent(E)=I`。每条 gate 的
`tested_implementation_sha/tree`、每条 readback 的 `reviewed_implementation_sha/tree` 必须分别与顶层
`implementation_sha/tree` 全等；任一返工形成新 I 后，旧 gate/readback 不能挂到新 evidence。
Markdown 不写 E 自身 SHA，Git parent chain 已提供该身份。`repo_status` 与 `deployed_status` 分轴；
未获 deploy 授权时只能关闭前者。日志可 ignored，但 evidence 必须记录文件名、bytes 与 SHA-256。
没有消费者的摘要字段一律不加。

#### 20.2.2 focused gate registry

下表是计划层的唯一 gate 列表；实施 prompt 必须把对应单元格复制成 argv 数组并在当时仓库核对命令
存在性。`[new]` 表示本批必须实现且先用 mutation 证明能红。表格不作为运行时解析协议，也不要求
Markdown lexer、gate-run cardinality service 或 content-addressed artifact store。

| gate set | 批次 | focused commands |
|---|---|---|
| `FG-PG00-I` | PG-00/I | `bash scripts/check-emoji.sh`；`node scripts/check-doc-links.mjs`；`git diff --check <LOCKED_HEAD>..<I_OID>`；D17 第 4 节 I 调度断言；说明：OID 在 PG-00 prompt 中替换为完整 commit OID并作为单独 argv 传入 |
| `FG-PG00-E` | PG-00/E | `bash scripts/check-emoji.sh`；`node scripts/check-doc-links.mjs`；`node scripts/week-audit.mjs --check-bundle`；`git diff --check <LOCKED_HEAD>..<E_OID>`；D17 第 6 节 closure 断言；说明同上 |
| `FG-PG01A-CLAIM` | PG-01A | `node research/customer-question-corpus/validate.mjs`；`node research/customer-question-corpus/test-mutations.mjs`；`node research/customer-question-corpus/simulations/validate-simulations.mjs`；`node research/customer-question-corpus/simulations/test-simulation-mutations.mjs`；`node research/customer-question-corpus/dry-runs/validate-three-pass-dry-run.mjs`；`node research/customer-question-corpus/dry-runs/test-dry-run-mutations.mjs`；`node scripts/test-public-text-redaction.mjs`；`[new] node scripts/check-active-claims.mjs`；`[new] node scripts/test-active-claims.mjs`；`[E-artifact producer, after all read-only I gates] node research/customer-question-corpus/check-q0-truth-report.mjs --write --output research/customer-question-corpus/review/23-pg01a-q0-truth-report.json --implementation-sha <full-I-OID> --implementation-tree <full-I-tree>`；`[new] node research/customer-question-corpus/check-q0-truth-report.mjs --check research/customer-question-corpus/review/23-pg01a-q0-truth-report.json`；`[new] node research/customer-question-corpus/test-q0-truth-mutations.mjs` |
| `FG-PG01B-RUNTIME` | PG-01B | `pnpm --filter @saydo/console exec vitest run src/hooks/redesign/mappers.test.ts src/components/redesign/DecisionPackageCard.test.tsx src/lib/apiError.test.ts`；`pnpm --filter @saydo/daemon exec vitest run test/console-actions.test.ts test/console-api.test.ts test/p05c-direct-mode.test.ts test/mobile-lan-process.test.ts test/pairing-info.test.ts test/t2-thin.test.ts test/logger.test.ts`；`node scripts/test-pairing-url-corpus.mjs`；`[new] node scripts/check-remote-surface-inventory.mjs`；`[new] node scripts/test-remote-surface-inventory.mjs` |
| `FG-PG02-BOOTSTRAP` | PG-02 | `pnpm --filter @saydo/contracts exec vitest run test/schemas.test.ts`；`[new] node scripts/check-capability-ledger.mjs`；`[new] node scripts/test-capability-ledger.mjs`；`[new] node scripts/check-action-reachability.mjs`；`[new] node scripts/test-action-reachability.mjs`；`[new] node scripts/check-support-matrix.mjs`；`[new] node scripts/test-support-matrix.mjs` |
| `FG-PG03-CONTROL` | PG-03 | `node scripts/test-release-provenance.mjs`；`node scripts/test-release-physical-evidence.mjs`；`node scripts/check-doc-links.mjs`；`node scripts/third-party-notices.mjs --check`；`pnpm --filter @saydo/cli verify:distribution`；`[new] node scripts/check-gate-manifest.mjs`；`[new] node scripts/test-gate-manifest.mjs`；说明：I 阶段不运行 predecessor 的 `week-audit --check-bundle`，该门只在通用 E writer 后的 clean E 执行，gate-manifest mutation 负责证明 workflow 可达该 E 门 |
| `FG-PG04-AUDIT` | PG-04 | `[new] pnpm --filter @saydo/daemon exec vitest run test/logger.test.ts test/audit.test.ts`；`[new] node scripts/audit-sensitive-inventory.mjs`；`[new] node scripts/test-audit-sensitive-inventory.mjs` |
| `FG-PG05-DB` | PG-05 | `pnpm --filter @saydo/daemon exec vitest run test/storage-migration-v5.test.ts test/storage-checks.test.ts test/storage-crash.test.ts test/storage-roundtrip.test.ts test/backup.test.ts`；同组测试必须包含 live main+WAL/SHM 一致读取、quiesced copy immutable probe、WAL-only future/gap、每种生产 migration（含 additive）恢复点及故障点反例 |
| `FG-PG06-ADMISSION` | PG-06 | `[new] pnpm --filter @saydo/daemon exec vitest run test/cli-capability.test.ts test/provider.test.ts test/setup-onboarding.test.ts test/tier1-security.test.ts test/provider-admission.test.ts`；`pnpm --filter @saydo/console exec vitest run src/lib/setupApi.test.ts` |

`full_gate` 固定为：所有代码批 `just ci`；PG-01B、PG-02、PG-03 另跑
`pnpm exec playwright test`。托管 CI、跨平台、live、真机与 release gate 只有批卡明确要求并具备授权时
才运行；未运行必须写入 `not_run_exact_set`，不能由本机门替代。

### 20.3 唯一施工链与依赖

```text
PG-00 标准 Git 排产导入
  → PG-01A public-claim-corpus-stoploss
  → PG-01B runtime-entry-stoploss
  → PG-02 minimal-truth-gate-bootstrap
  → PG-03 gate-truth
  → PG-04 audit-new-write-safety
  → PG-05 db-safety
  → PG-06 admission-discovery-tightening
  → owner stop
```

| 顺序 | 批次 | 唯一主要结果 | 进入条件 | 收口锚 |
|---|---|---|---|---|
| 0 | PG-00 | PLAN-2/HANDOFF 只有一个 next | D17 已签 | local I plan + E evidence commits |
| 1 | PG-01A | 公开 claim/corpus 先保守止损 | PG-00 evidence commit | implementation + evidence commits |
| 2 | PG-01B | 默认动作、预算与 remote 入口 fail-closed | PG-01A evidence commit | implementation + evidence commits |
| 3 | PG-02 | 最小 capability/action/support truth plane | PG-01B evidence commit | implementation + evidence commits |
| 4 | PG-03 | required gate 与真实执行路径对账 | PG-02 evidence commit | implementation + evidence commits |
| 5 | PG-04 | audit 新写入不再保存敏感原文 | PG-03 evidence commit | implementation + evidence commits |
| 6 | PG-05 | future/gap/失败迁移不改原库 | PG-04 evidence commit | implementation + evidence commits |
| 7 | PG-06 | 静态发现不等于授权；unknown 一律拒绝 | PG-05 evidence commit | implementation + evidence commits |

PG-00 不运行未来批门；PG-02 不追溯改写 PG-01A/PG-01B evidence，也不要求三批共享一套 union
receipt。历史 evidence 保持其当时事实，当前 revision 的 regression 由当前批自己的 focused/full gates
负责。任何下一批只依赖前批 evidence commit，不依赖 mutable selector 或本地 artifact 目录。


### 20.4 PG-00 至 PG-02 批卡

#### PG-00 · 标准 Git 排产导入

- 用户结果：实施者只看到一个下一批，不再在 ai-supply、W5.4-c 和本 program 之间自行选路。
- `deferred_exact_set=[DF-CLAIM-SOURCE-FULL,DF-CLAIM-GENERATOR,DF-DIRECT-REVIEW-FULL,
  DF-REMOTE-REOPEN,DF-AI-DRAFT-FULL,DF-SP2A1-DATA,DF-SP2B1-LIVE,DF-SP2C1-HISTORY,
  DF-SP2C2-LOGGER,DF-SP3A1-RELEASE,DF-SP3B-DIST,DF-SP3C-VOICE,
  DF-SP4-FORMATIVE,DF-SP5-READ,DF-SP6-EXPAND,DF-SP7-CALIBRATE]`；
  `safe_default=active_pointer_empty + next_batch_PG-01A_not_open`。重复引用仅表示不授权，不产生
  新的 owner。
- Git exact-set：在当前专用 feature branch 上用 explicit pathspec 形成 `parent(I)=locked HEAD` 的
  plan/import commit；`I` 只含 D17 第 3.1 节的七个路径。独立复审后形成 `parent(E)=I` 的 evidence
  commit；`E` 只含 D17 第 3.2 节的 journal/evidence/prompt/report exact-set。
- read-only pinned inputs：当前分支、HEAD、真实 index、owner 原工作树、本方案、owner 决策单、D17
  import spec、AI supply 决策单与 `AGENTS.md`；不改 canonical、产品代码、测试或历史 evidence。
- 实施：严格照 14.8 与 D17 import spec 导入 PG-01A–PG-06；同时逐项处置旧队列与“缺省全做”；
  历史段只标 superseded，不删除。
- focused gate set：I 阶段只引用 `FG-PG00-I`，E 阶段只引用 `FG-PG00-E`；PG-01A–PG-06 的门只
  登记未来合同，本批不执行。两路
  subagent 与 fresh Codex 都绑定 `I` commit/tree；A 非空即返工，B/C 必须逐项
  `fix_now|tracked|deferred_with_trigger|rejected_with_reason`，不能以清空 C 作为无限复评门。
- 收口：I 的 clean validation worktree 上三路 readback 全绿，E 后静态门与两段 pathset 全等，当前
  feature branch tip 为 E。随后停在 owner；不 push、不 merge，纠错另走受审 commit/revert，不逐文件
  恢复。退出证据：`e2e/evidence/project-gap-pg-00.md`。

#### PG-01A · 公开 claim 与 corpus 止损

- 批类型/合同：claim-only，规模 S；canonical_change=yes；先完成 claim 上限与 Q0 口径的一致性复审。
- `close_set=[G-A1,G-A4]`；`stop_loss_set=[G-A2]`；`deferred_exact_set=[DF-CLAIM-SOURCE-FULL,
  DF-CLAIM-GENERATOR,DF-SP3B-DIST,DF-SP4-FORMATIVE,DF-SP5-READ]`；
  `safe_default=unsupported_or_conditional + repo_closed_only + no_deploy`。
- repo exit：仓内官网源、README、release metadata、模板、默认 console 与 corpus 不再把未实现、
  费用 unknown、未授权 connector 或 mock/live 混合项称为当前支持。
- deployed exit：仅在另获 deploy 授权并核对网站/public snapshot 的 asset digest 后成立；本批默认
  只记 `repo_closed`，外部仍 `blocks_expansion`。
- scope roots：`AGENTS.md`、`justfile`、`README*`、`docs/site/**`、`docs/release/**`、
  `deploy/saydo-octoooo-com/**`、
  `templates/**`、与受影响 claim 直接对应的 console copy、
  `research/customer-question-corpus/{README.md,contracts/**,questions/**,contexts/**,04-live-source-contracts.md,
  validate.mjs,rebuild.mjs,test-mutations.mjs,dry-runs/rebuild-three-pass-dry-run.mjs,
  dry-runs/01-three-pass-dry-run-result.md,dry-runs/02-dry-run-remediation-plan.md,
  check-q0-truth-report.mjs,test-q0-truth-mutations.mjs,review/23-pg01a-q0-truth-report.json}`、
  `docs/06-references.md`、`docs/11-ui-spec.md`、`scripts/{check-active-claims.mjs,test-active-claims.mjs}`。
- 实施边界：按 D2 安全缺省先降级 986 source 合同与 connector-readiness 引用，不逐条修 986 个
  source；只修 active claim roots 和生成真相，不新增 generator 平台。
- Q0 truth report 固定为
  `research/customer-question-corpus/review/23-pg01a-q0-truth-report.json`。最小 schema 只含：
  `schema_version`、本批 implementation commit/tree、`expected_total=986`、逐对象
  `{source_id,status=valid|unresolved,reason,source_kind,entity,reader,locator_check,required_field_check}`、
  两态 aggregate count 与 `A-RAG-01/A-RAG-02/B-VAL-01` disposition。报告缺失、ID 重复/漏项、
  总数不等于 986、字段与 validator 不一致或 mutation 不会红时，G-A1 不得记 `repo_closed`；
  unresolved 只能形成 `owner_downgraded_with_public_limit`，不得作为 connector readiness 证据。
  该报告在 I 的 clean worktree 上生成、字段绑定 I commit/tree，并作为 evidence artifact 进入 E，
  因而不自指；focused gate 记录 report raw SHA-256，E 后要求 `sha256(E:report-path)` 与该值全等，
  并在 clean E bytes 上重跑 report checker。若 `unresolved_count>0`，`close_set` 只表示本批完成处置，
  不得把 repo_status 写成 closed。
  现役 986 个对象没有持久化 `source_id`；report producer 必须用
  `<repo-relative-contract-path>#<RFC6901-json-pointer>` 从输入位置确定性导出 `source_id`，按 UTF-8
  字节序排序，并用该 identity 做 exact coverage/重复 mutation。不得要求为此回写 986 个源对象。
  唯一 producer argv 是 `FG-PG01A-CLAIM` 中同一 checker 的 `--write --output ...
  --implementation-sha <full-I-OID> --implementation-tree <full-I-tree>` 形态；不得由施工会话另选脚本、
  抽样或手工拼 report。
- dry-run 投影规则：批 prompt 先记录现役 `dry-run-model.mjs` 所定义 source-tree digest；只要
  questions/contexts/contracts/`04-live-source-contracts.md` 的该 digest 改变，就必须在 I 形成前运行现役
  `rebuild-three-pass-dry-run.mjs`，且条件 may-change 仅为
  `dry-runs/01-three-pass-dry-run-result.md` 与 `dry-runs/02-dry-run-remediation-plan.md`。随后 validator 与
  mutation 必须通过；digest 未变时这两份投影不得产生 diff。不另建生成器或复制摘要算法。该 writer
  不是 focused gate，禁止在 detached clean-I validation worktree 中用重写后的 bytes 掩盖 I 内旧投影；
  I 的 read-only validator 必须先直接检查 committed I bytes，且在 Q0 E-artifact producer 开始前 worktree
  仍 clean。
- 必做的 G-A2 止损：在第一批代码/文档 diff 中删除 `AGENTS.md`、`justfile` 与 active-claim
  manifest 所覆盖现役 roots 的“本地 CI 等效”总括说法，改成“本地 Node/Python 基线”；这只是
  `stop_loss_set`，G-A2 仍由 PG-03 的 control graph 唯一关闭。
- focused gate set：只引用 `FG-PG01A-CLAIM`；随后 `just ci`。evidence 直接绑定本批 implementation
  commit/tree、真实 exit 与独立 readback，不等待 PG-02 追溯升级。
- 正反验收：现役 claim 均有 `supported/conditional/preview/unsupported` 之一与证据指针；删掉一个
  root 或把 deferred connector 改成 LIVE 时门必红；不修改任何运行时权限。
- 回滚：只能回到更保守文案或关闭投影，不能恢复已证伪 claim。证据：
  `e2e/evidence/project-gap-pg-01a.md`。

#### PG-01B · 运行时入口止损

- 批类型/合同：runtime safety，规模 M；canonical_change=yes；`direct_to_review` 保留设计合同并标
  `designed/deferred`，从 active selector/default route/public claim 移除，不删 schema。
- `close_set=[G-A6]`；`stop_loss_set=[G-A3]`；`deferred_exact_set=[DF-DIRECT-REVIEW-FULL,
  DF-REMOTE-REOPEN,DF-SP2B1-LIVE,DF-SP2C1-HISTORY]`；
  `safe_default=hidden + remote_business_403 + budget_unknown`。
- repo exit：仓内默认入口不能触发未接线动作；移动未受信端的业务 API fail-closed；预算 unknown
  不再显示为零。
- deployed exit：另获 runtime/移动壳 deploy 授权并核对 loaded SHA/asset digest 后才成立；此前即使
  source 绿也保持 `blocks_expansion`。
- scope roots：`packages/daemon/src/net/**`、`packages/daemon/src/index.ts`、
  `packages/daemon/src/voice/hub.ts`、`packages/daemon/src/api/recoveryOnlyServer.ts`、
  `packages/daemon/src/tier1/gateServer.ts`（仅证明 Unix socket 不属于远程面）、
  对应 remote/mobile/console/recovery/voice WS API tests、
  `packages/daemon/src/brain/liveTools.ts`、`packages/console/src/**` 中 action/budget/remote 消费点、
  `packages/daemon/src/api/**` 的 touched exact-set、`docs/09-data-contracts.md`、
  `docs/10-voice-ux-spec.md`、`docs/11-ui-spec.md`、`scripts/{pairing-url-corpus.json,
  remote-surface-inventory.json,check-remote-surface-inventory.mjs,test-remote-surface-inventory.mjs}`。
- 必做：remote business API 统一 fail-closed；只保留无业务 payload health/static shell 与安全跳转；
  `direct_to_review` 隐藏；abandon 不再映射 archive；0/0 改 unknown。G-A9 单独由 PG-04 关闭，
  避免把 audit 故障域藏进入口批。若本批新增或改变跨端 contract/DTO/schema，则在本批 exact-set
  内完成双端 runtime parse 与兼容窗，并登记 `SP2d=triggered`；否则 evidence 附零 schema diff 并登记
  `SP2d=N/A(reason)`，不会另开 API 批。
- remote denominator 固定为一份批内静态清单，逐项枚举
  `composition root(main/recovery/voice/tier1) × protocol(HTTP/WS/Unix) × method/path/message ×
  via(local/mobile_lan/tailnet/not_applicable)`；recovery 是 server mode/composition root，不伪装成
  `IdentityVia`。Unix socket 必须以绑定/权限证据明确排除为 local-only，非 local 项只能是
  health、static shell 或 safe redirect，其余必须经过同一 fail-closed guard。checker 必须对漏登记路由、
  绕过 guard 与 WS 业务消息 mutation 转红；清单缺失，或与上述 composition roots 中实际 HTTP
  handler、WS message switch 和 Unix listener 源码枚举出的 exact-set 不全等时，G-A6 不得关闭。
- PG-01B 只关闭已知错义与远程入口风险，并把 G-A3 记为 stop-loss；直到 PG-02 的完整
  action denominator 证明默认 UI、Brain 可调用动作、transition 与 receipt 全等后，G-A3 才能关闭。
- focused gate set：只引用 `FG-PG01B-RUNTIME`；随后 `just ci` 与 Playwright。evidence 直接绑定本批
  implementation commit/tree、真实 exit 与独立 readback。
- 回滚：保持入口 hidden/403/unknown；如兼容客户端失败，返回稳定 typed unsupported/error，不恢复
  不安全读取。证据：`e2e/evidence/project-gap-pg-01b.md`。

#### PG-02 · 最小真相控制面

- 批类型/合同：runtime safety/bootstrap，规模 M；canonical_change=yes；canonical 独立一致性复审是
  进入 schema/checker 实现的前置。
- `close_set=[G-A3]`；`stop_loss_set=[]`；`deferred_exact_set=[DF-CLAIM-GENERATOR,
  DF-AI-DRAFT-FULL,DF-SP4-FORMATIVE,DF-SP5-READ,DF-SP7-CALIBRATE]`；
  `safe_default=unregistered_not_claimable + evidence_bound_to_git_commit`。
- 用户结果：一个公开能力可以从 claim 追到合同、入口、门、证据与限制；未登记能力默认不可宣称。
- scope roots：`docs/06-references.md`、`docs/09-data-contracts.md`、`docs/11-ui-spec.md`、
  `packages/contracts/**`、最小 release/support projection、
  `scripts/{check-capability-ledger.mjs,check-action-reachability.mjs,check-support-matrix.mjs}`
  及对应 mutation self-tests；
  `ai-supply-scope` 在本批重分类，不下沉全部 45k 行草案。
- 必做：最小 capability/action/scope schema、手工维护 scoped ledger、claim/gate/support checker；
  inventory/deferred 只填最小字段；建立供 PG-03–PG-06 消费的稳定 gate-ID registry，但不建设通用
  wave-exit 执行/receipt 平台。action checker 必须枚举默认 UI 与 Brain 全部可调用动作、目标 transition、
  receipt/错误形状并对遗漏动作和错 transition mutation 转红；它是 G-A3 从 stop-loss 到 repo_closed
  的唯一分母。Q1/Q2/journey 延到选中真实 slice。PG-02 在自己的 implementation commit
  上重跑 `FG-PG01A-CLAIM`、`FG-PG01B-RUNTIME`、`just ci` 与 Playwright，证明当前 revision 没有回归；
  PG-01A/PG-01B 的历史 evidence 不改写、不升级。这里的 `FG-PG01A-CLAIM` 回归只运行其 read-only
  validator/mutation 与 Q0 `--check` 子集，明确排除 Q0 `--write` E-artifact producer；不得把报告的
  implementation identity 改绑到 PG-02 I。
- focused gate set：只引用 `FG-PG02-BOOTSTRAP`；随后 `just ci` 与 Playwright。
- 回滚：checker/projector 失败即阻断新 claim，不回退为人工口头对账。证据：
  `e2e/evidence/project-gap-pg-02.md`。

### 20.5 PG-03 至 PG-06 批卡

#### PG-03 · gate truth

- 批类型/合同：runtime safety，规模 S/M；canonical_change=yes；只关闭 G-A2，不做下一 RC。
- `close_set=[G-A2]`；`stop_loss_set=[]`；`deferred_exact_set=[DF-SP3A1-RELEASE,
  DF-SP3B-DIST,DF-SP3C-VOICE]`；`safe_default=unwitnessed_required_gate_nonzero +
  local_baseline_not_hosted_or_release`。
- 用户结果：所谓 required gate 必须从真实入口可达、运行并产出绑定 revision 的 evidence；本地基线、
  CI、release、Playwright、平台与 live gate 不再互相冒充。
- scope roots：`AGENTS.md`、`justfile`、根/各 package scripts、`.github/workflows/**`、与当前公开 claim 相关的
  release/gate scripts、`docs/09-data-contracts.md`、PG-02 的 gate registry/schema、
  `scripts/{check-gate-manifest.mjs,test-gate-manifest.mjs}`；不做 candidate identity 参数化。
- 必做：现役 gate/workflow control graph；required/optional 与平台 exact-set；删除 matrix、恒假 if、
  `continue-on-error`、断 needs、required skip mutations；缺当前 commit 的 gate evidence/freshness 时
  overall nonzero。
- focused gate set：只引用 `FG-PG03-CONTROL`；随后 `just ci` 与 Playwright。托管 CI、跨平台与
  live 的未运行状态必须单独记录，
  不能由本机 exit 0 填绿。
- 回滚：gate checker 故障时阻断新 claim/RC，不恢复“本地 CI 等效”总括声明。证据：
  `e2e/evidence/project-gap-pg-03.md`。

#### PG-04 · audit 新写入安全

- 批类型/合同：runtime safety，规模 M；canonical_change=yes；D13 只阻塞历史处置，不阻塞本批。
- `close_set=[G-A9]`；`stop_loss_set=[]`；`deferred_exact_set=[DF-SP2C1-HISTORY,
  DF-SP2C2-LOGGER,DF-SP3B-DIST]`；`safe_default=stop_unsafe_write + safe_envelope +
  history_inventory_only`。
- 用户结果：用户原文、凭据、模型片段和完整路径不再进入新 audit 写入；历史敏感行被完整盘点并
  标记隔离，但本批不删除、不改 retention。
- scope roots：`packages/daemon/src/obs/**`、audit SQLite sink、`audit.record(...)` 全 callsite exact-set、
  `packages/contracts/**` 的 selected audit schema、`docs/09-data-contracts.md`、
  `docs/modules/e-crosscutting.md`、logger/audit tests、
  `scripts/{audit-sensitive-inventory.mjs,test-audit-sensitive-inventory.mjs}`。
- 必做：稳定 event ID + typed envelope；已知事件 exact schema；未知 meta 仅允许 safe scalar allowlist
  或 digest；reserved-key/secret/path/raw-text mutations；对 DB、备份、副本生成逐对象 history inventory
  与隔离状态，不做不可逆变换。普通 logger/correlation/capacity 不在本批。
- focused gate set：只引用 `FG-PG04-AUDIT`；随后 `just ci`。
- 回滚：保持 stop-write 与最小 safe envelope；sink 可 fail-closed/告警，不能恢复原文。证据：
  `e2e/evidence/project-gap-pg-04.md`。

#### PG-05 · DB 安全收紧

- 批类型/合同：runtime safety，规模 M；canonical_change=yes；只关闭 G-A5，不顺带兑现 G-B3 的
  所有 workspace/RPO/RTO 支持。
- `close_set=[G-A5]`；`stop_loss_set=[]`；`deferred_exact_set=[DF-SP2A1-DATA]`；
  `safe_default=consistent_read_then_refuse_incompatible + snapshot_before_every_production_migrate +
  no_reverse_DDL`。
- 用户结果：打开 future、gap、乱序或失败迁移库不会改原数据；backup CLI 不因复用 `openDb` 偷偷
  迁移生产库。
- scope roots：`packages/daemon/src/storage/**`、`packages/daemon/src/backup/**`、直接迁移入口与
  storage/backup tests、`docs/09-data-contracts.md`；config/receipt/client 只在被现役 DB schema
  直接触及时列入 exact-set。
- 必做：open/inspect/migrate 分离；live inspect 使用能看到 main 与现役 `-wal/-shm` 或 rollback journal
  的 SQLite 一致只读视图，禁止对仍在写入的 live 主文件使用 `immutable=1`；immutable probe 只允许在
  quiesce/checkpoint 后形成的一致副本上运行。future/gap/non-prefix fail-closed，backup 只读不迁移；
  每一次 production migration（additive/destructive 均含）前都用 SQLite backup API 或
  quiesced/checkpointed consistent copy 建立可恢复点，再做 copy fixture、quick_check 与恢复演练。
  反例必须覆盖只存在于 WAL 的 future/gap、additive migration 每个故障点，以及拒绝/失败后
  main/`-wal`/`-shm`/journal 的 exact-set 与 digest 不变。
- focused gate set：只引用 `FG-PG05-DB`；随后 `just ci`。
- 回滚：保留迁移前 snapshot；固定旧 compatible artifact，只读/拒绝不兼容库；不做未验证逆向 DDL。
  证据：`e2e/evidence/project-gap-pg-05.md`。

#### PG-06 · admission 与发现收紧

- 批类型/合同：runtime safety，规模 M；canonical_change=yes；只关闭 G-A7/A8。AI 决策 4/5、D12
  未签不阻塞本批，也不在本批实现 live ProbeGrant cage。
- `close_set=[G-A7,G-A8]`；`stop_loss_set=[]`；`deferred_exact_set=[DF-SP2B1-LIVE,
  DF-AI-DRAFT-FULL,DF-SP4-FORMATIVE,DF-SP5-READ,DF-SP6-EXPAND]`；
  `safe_default=unknown_deny + static_inventory_only + zero_probe`。
- 用户结果：检测到账号、订阅、CLI、endpoint 或模型不等于有权调用；identity/rights/data/funding
  任一 unknown 均 fail-closed；首启、页面加载和后台任务零自动 probe/packet/history open。
- scope roots：`packages/contracts/**` 的 selected admission schema、daemon config/provider/resolver/
  discovery/executor 边界、console setup 对应 surface、`docs/09-data-contracts.md`；AI 草案只提取
  exact safety types，不整包下沉；新增 test 路径为 `packages/daemon/test/provider-admission.test.ts`。
- 必做：static inventory 与 production admission 分离；field-aware pre-send gate；自动 probe hard-disable；
  malicious PATH/program/history/packet sentinels；高风险 route 无已证明 enforcement 时拒绝或降级。
- focused gate set：只引用 `FG-PG06-ADMISSION`；随后 `just ci`。
- 回滚：保持 static inventory 与 provider route disabled；不能回到页面加载即探测。证据：
  `e2e/evidence/project-gap-pg-06.md`。

### 20.6 条件包登记（完整覆盖，不进入 D17 活动队列）

以下项目保留完整归属与触发线，但在触发前只有 inventory/deferred 状态。触发时必须基于届时 HEAD
生成新的批卡、exact scope 与门禁，不能复用本节今天的路径猜测直接施工：

| 条件包 | 触发线 | 最小交付 | 当前边界 |
|---|---|---|---|
| SP2a1 广义数据兼容 | 新 workspace/client/version 被选入支持矩阵 | 该 consumer 的 N/N-1、RPO/RTO、restore receipt | 只支持当前已证明 exact-set |
| SP2b1 ProbeGrant/live 隔离 | selected live surface、D12 与该 surface 的 applicable AI decision exact-set 已签；Claude subscription 才需 AI 决策 4，LAN discovery 才需 AI 决策 5 | scope/TTL/budget/audit cage + sandbox/egress TCK | static inventory only；零 live probe |
| SP2c1 history/retention | D13 已签 | 逐 store 计数守恒、保留/迁移/删除/backup propagation；删除另签 | 不删历史，不新增 snapshot |
| SP2c2 logger/correlation | 下一公开 RC 或支持面需要 | error taxonomy、correlation、capacity/sink failure receipt | 普通日志 best effort，不冒充 audit |
| SP2d touched API rule | 每个代码 consumer 批都记录 `SP2d=triggered|N/A(reason)`；新增或改变跨进程/跨 package contract、DTO 或 schema 时触发 | 同一 consumer 批内完成 shared runtime schema 双端 parse、兼容窗、mirror-new mutation；零 schema diff 时登记 `N/A(reason)` | 这是跨批规则，不是 deferred 批；不开全量 API 迁移批，也不因触及 `api/**` 路径自动扩大范围 |
| SP3a1 release 参数化 | 创建下一 RC | active candidate identity、release plan、固定旧 asset 回滚 | 不建 RC、不改 tag |
| SP3b distribution/evidence/Ops0 | 实际外部发布/public snapshot、创建下一 RC、提高 capability claim 或改变 distribution/support 承诺 | support/evidence exact-set、Ops0、相应 W5.4-c live receipt | repo-only 的 claim 保守降级不触发；Developer Preview 声明保持保守 |
| SP3c voice restart | candidate manifest 含 voice runtime 或公开 `voice=true` | env/Pipecat/TTS restart/cancel/error receipt | `voice=false` 时不施工；既有 ADR 优先更新/supersede |
| `Q1Q2-CORE` 一次性初始化角色 | SP4/SP5 中第一个真实获批 slice 开批 | 由该 slice 在本批内建立稳定 taxonomy/schema/context/oracle 模板，并在 evidence 记录 `initializer_batch`；不是独立施工批 | 后续 slice 只能引用并做兼容扩展；未选 slice 时不存在 |
| SP4 desktop formative slice | D1、D14 与 selected surface 的 applicable AI decision exact-set 已签；有外部费用时再签 D12/D16 | 选中 expert persona/task 的 Q1/Q2 consumer、首个 journey、formative evidence；若最先开包则同批初始化 `Q1Q2-CORE` | 不预建 12 条 journey 或全量 AI 草案，不要求无关 D4/D5 |
| SP5 non-code read slice | D4、D5、D14 已签；新增 snapshot 时 D13，有外部费用时 D12/D16 | 选中普通 persona/task 的 read/citation/review/export journey；若最先开包则同批初始化 `Q1Q2-CORE` | 不要求无关 D1 或 AI 决策；未选 connector 保持 deferred |
| SP6/SP7 扩展/校准 | 相应 capability 已证明价值且有维护容量 | 具名 variant、12→24→48 校准或退役 receipt | remote/MCP/A2A/team/locale deferred |

D15 只阻断 audience/maturity 晋级；D11 只阻断 variant 升 `supported`；D16 只阻断第二价值轨、持续
预算或 portfolio 扩张。它们不阻断一个零/小额、明确不升档的 formative preview；若实验产生外部
费用，则 D12/D16 先签本次硬上限。

### 20.7 阶段出口与不做清单

本次 A 级 core 只在 PG-01A–PG-06 全部满足以下条件时收口：A-ID 无悬空、focused gate 与适用的
`just ci`/Playwright 绿、evidence 在案、独立 readback 无
A 级、HANDOFF 与 PLAN-2 指针一致。
条件包不属于该 denominator；它们各自保持 `deferred`、`disabled` 或 `parked_by_decision`。

A-ID disposition 必须分两轴：仓库代码/文档/门闭合记 `repo_closed`；网站、public snapshot、常驻
runtime、移动壳或外部服务实际更新并核对 loaded SHA/asset digest 后才记 `deployed_closed`。本计划
与 D17 均不授权部署，所以 core 批即使 repo 绿，在部署 owner 停点前仍保持 `blocks_expansion`，
不得把 source commit 写成生产风险已关闭。

本轮 A 级 core 明确不做：全修 986 source、Q1/Q2 与 12/24/48 journey、完整生成平台、全 API DTO 迁移、
新 provider/connector/MCP/A2A、remote trust、移动正式能力、Team、国际化扩张、新 RC、deploy、商店
发布、voice restart 或产品档位晋级。任何一项只有在第 20.6 节触发线成立、具名 decision card 与
维护容量齐全时重开。

### 20.8 v7 完成后的可实施性判定

本节把 v4 的“自洽但过重”实施合同收敛为可生成独立 IMPL prompt 的最小充分输入：A 级 core 每批已有唯一顺序、用户
结果、scope roots、必做/不做、前置决策、focused/full gate、证据路径和回滚上限。真正开批时只
需要在锁定 revision 上把 roots 展开成 exact file list、核对现有 test 命令参数并生成批级 prompt，
不再由施工会话重新发明范围或完成定义；标准 branch/worktree/commit/tree 直接承担版本、恢复与
predecessor 身份，
不再维护自定义 WAL、lease、digest DAG、selector 或追溯 receipt 升级。

仍不能由文档预先证明的只有三类：代码实施是否正确、live/设备/真人证据是否通过、市场方向是否
值得继续。它们分别交给独立 readback、触发后的 SP3b live gates 和 SP4 之后的真人 decision card；不在本轮
静态方案中虚构答案。

## 21. 标准 Git 复杂度回收与最终复审边界

v4 在逐项关闭事务与证据 finding 后形成了 500 余行 PG-00 文件事务协议和多层 Wave artifact/digest
DAG。两路新的零上下文 subagent 没有继续检查“字段是否有消费者”，而是按故障概率、损害、现有 Git
恢复能力和维护成本做比例性复审，均裁决 `[fail]`：仓内没有该事务执行器及其 crash 测试，且 D17
禁止本地 commit 迫使方案在 Git 外重造 commit point；Wave DAG 同样早于真实 A 级风险关闭变成了通用
执行平台。

v5 先删除了自制文件事务，但仍保留 whole-dirty `B0`、recovery/core ref、手写 CAS，以及后续批的
`P→O→I→E/E_abort`。两路新的比例性复审再次裁决 `[fail]`：当前已在专用 feature branch，ordinary
commit、explicit pathspec、clean worktree、reflog/revert 与 `merge --ff-only` 已覆盖真实风险；额外
协议主要是在修复其自己引入的持久锁，并且 no-attached-worktree 检查与 `update-ref` 之间仍有 TOCTOU。

v6 因此继续回收：

1. PG-00 改为当前专用 feature branch 上的 `I plan/import → E evidence → owner stop`；不创建 B0、
   temporary index、recovery/core ref 或自定义提交点。
2. I/E 都以 explicit pathspec、staged exact-set、direct parent 与 clean validation worktree 证明范围；
   review 绑定 I，E 不自指，未来是否 `merge --ff-only` 另由 owner 决定。
3. 所有代码批只保留 predecessor/implementation/evidence 三个角色；owner 单一 dispatch 是当前协调
   假设，取消只需放弃未晋升 branch。只有发生真实并发事故后才允许增加普通 open commit。
4. PG-02 只实现产品真相需要的最小 ledger/checker/gate-ID registry，不实现通用执行/证据平台。
5. D17 唯一新增授权是当前 feature branch 的两个本地文档 commit；仍不授权后续产品代码、push、merge、
   deploy、外部调用、付费、数据删除或条件包。

v7 保留上述标准 Git 骨架，只补 v6 外部复审证明真实缺失的现役仓库门、bytes 身份和批内覆盖分母；
没有恢复任何自制事务层。最终外部 Codex 必须对 v7 semantic freeze 重新评审；旧 208–212、214 的
`[fail]` 和被 v5/v6 取代的 213 未完成事件流都只作过程证据。评审前先固定 final prompt/report path；评审后只允许按
D17 spec 第 2.2 节在 owner 签署前机械填 input hashes、dirty manifest 与 PG-00 future review path；
owner reply 只登记到 `POST_SIGNATURE_RECORD` owner decision，绝不回写已签 spec，
再由两路只读 subagent 对现场全等和“非占位 bytes 零变化”做核验。最终报告、日志 bytes/SHA、
静态门和输入锁写入 `history/PROCESS-JOURNAL.md`；任何非白名单正文变化都会使外部评审失效并重跑，
从而避免“为记录评审而改变被评审语义”的循环。

## 22. v7 对抗复审回修与最小性裁决

`research/codex-findings/214-project-gap-v6-standard-git-final-review.md` 对 v6 裁决 `[fail] 7A/8B/0C`，
同时明确标准 Git `P→I→E` 骨架是最小合理形态，`OVERDESIGN_REGRESSION=no`。本轮两路互补 subagent
逐项回查后，七条 A 全部成立；八条 B 中七条成立，`B-SP2D-TRIGGER-STATE-07` 的风险表述偏重但
陈旧 deferred 标签确与既有批内硬规则冲突，因此仍按最小修法清理。处置如下：

1. PG-00 复用现有 week-audit writer，把七个既有输出作为 E 的固定 may-change allowlist，并在 E 后跑
   `--check-bundle`；E 前强制 index↔working-tree 全等，E 后只认 clean committed bytes。仍只有 I/E
   两提交，没有第三提交或 publication 平台。
2. owner 签署的 spec SHA 在 prospective index 与 `I:path` 各重验一次，program digest 同样绑定；未来
   晋升只按完整、已复审 E OID fast-forward，不增加 CAS/ref/lease。
3. PG-01A 新增一份绑定 I 的 986 对象 Q0 truth report 与两条批内 checker/mutation；不要求本批修全
   986 source，也不建立通用 report 服务。
4. PG-01B 只把 G-A3 做 stop-loss，PG-02 以完整 action denominator 关闭；remote 只新增一份
   `server × route/message × via` 静态清单及遗漏/绕过 mutation，不建立 route registry 平台。
5. PG-05 明确 live sidecar 一致读取、quiesced-copy immutable probe，以及每次生产 migration 前使用
   现有 SQLite backup API 或一致副本恢复点；不建设 snapshot manager。
6. gate/readback 条目直接绑定同一 implementation SHA/tree；PG-00 I/E 门分开；amend 检查始终相对
   locked HEAD；中断恢复只允许普通 Git 的两个可证明 staged 状态和字面 path unstage。
7. W5.3-tail 整体回到 PLAN-2 §6.10 触发线；SP2d 只保留每批
   `triggered|N/A(reason)`；`Q1Q2-CORE` 由首个实际获批 SP4/SP5 slice 在本批内唯一初始化，不另开批。
8. 最终化补全所有 untracked 文件的 no-index whitespace 门；已发现的 prompt 206 EOF 空行、report
   212/214 trailing whitespace 均在重新计算任何 digest 前修复。

这些修订只对可复现的“候选可绿但事实仍错”场景增加硬门。它们没有扩大当前授权：本轮仍不运行
产品测试，不开 PG-01A，不调用真实账号、connector 或设备，不 push/merge/deploy，也不要求 owner
现在签 D1–D16、D18、D19。fresh Codex 215 因其运行中 semantic bytes 又被两路 subagent 发现并回修
而主动终止；216 在持续有事件时达到 20 分钟硬时限；217 在启动后发现 D17 仍把不存在的 216 report
列为 E required path，遂在形成结论前停止；218 又因并行 subagent 找到 PG-01A 的 dry-run 派生文档
不在条件 scope 中而停止。四者都只有 ignored 事件流、不形成 report。为关闭这些
尝试暴露的可复现假绿，本版只补四个最小约束：D17 在 E 前重验 preexisting literal blob、所有代码批
E 复用现役 week-audit writer、PG-01A scope 覆盖真实 questions/contexts/合同投影、Q0 source identity
由 path+JSON Pointer 确定导出而不回写 986 个对象，并在 corpus source-tree digest 改变时只复用现役
dry-run rebuild 更新两份既有投影。fresh Codex 219 随后形成 `[fail] 2A/0B/0C`：dry-run producer
被误放进 I focused gate，会以
working-tree 重写掩盖 committed I 旧投影；PG-03 I 又误用 predecessor 的旧 publication bundle。
两项均按报告最小回修：producer 回到 I 前，I 只读校验 committed bytes；PG-03 删除 I 阶段
`--check-bundle`，只保留通用 E writer 后的 clean-E 门。fresh Codex 220 将复核当前 bytes；
只有 A/B/C open exact-set 为空，才进入 D17 的机械最终化与 owner 单一签署动作。
