# SayDo 工程改进统一方案 · Astra

日期：2026-09-05。当前维护入口：[统一实施 Prompt](IMPL-PROMPT-engineering-unified.astra.md)。本文件合并工程缺口成本修订稿与 ECC 最新 AS-01/AS-02 范围；旧方案及旧 Prompt 已归档。本轮只整理方案、交接与归档，没有实施产品或激活排产。

合同形状仍由 docs/01–11、modules、ADR（尤其 docs/09）决定；唯一实际排产源仍是 [PLAN-2](IMPLEMENTATION-PLAN-2.md)。本轮实读产品 HEAD：`bcf8ea855f25b177888d9159f75e49214f3dd892`。下面的源码引用以此为基线，未来开批按真实 HEAD 核验，不要求回退到旧版本。

## 1. 合并结论与执行顺序

**合并为一套方案和一个交接入口，产品按独立小批串行：PG-01B → AS-01/AS-02 隐私批 → 回到 PG-02 及原安全链。** 无需等待语音流式、升级、gist 或连接器扩展全部实施后再补持久化隐私；也不把远程止损与隐私写入混成一个大批。

依据：PG-01B 保护远程 business API/WS 及动作真相；AS-01/AS-02 保护 ledger/foundation 的新持久化和 Git 私有生成物。它们的故障处理与验收不同，却会相遇在 `brain/liveTools.ts`、09/10/11 和 Console 消费处，所以选择前批闭合后的新基线，串行施工可减少状态与错误码冲突。AS 的新能力/受限状态再由 PG-02 能力真相体系消费；新审计调用点在 PG-04 继续被 inventory 覆盖。AS 不代替 PG-04 的审计新写入安全或 PG-05 的数据库恢复。

| 位置 | 范围与收益 | 前置与边界 |
|---|---|---|
| 当前首批 PG-01B | 放弃/归档语义、预算 unknown、远程业务面止损 | 沿现役批卡；统一 Prompt 负责形成该批可审查候选，避免旧 ECC 入口只准备却无人推进前置 |
| 随后 AS-01/AS-02 | 凭据写前拒绝、私有生成物 Git 保护、同批失败可见与恢复 | PG-01B 已合并且所需 evidence 可验证后，先将本批登记到 PLAN-2，再设计和实施；不得把未提交 worktree 当已合并 |
| 接回 PG-02 | 动作/能力真实状态与最小台账 | AS 正式闭合后接回原链；不重复建立 ECC adapter ledger |
| 原 PG-03/04/05/06 | 门禁真相、审计、迁移恢复、准入 | 各自保留批卡和退出条件，不因合并文档合并这些产品批 |
| 再选有收益的候选 | VOBS-01、低开销 VIEW-01、最小 HOST-01；语音按证据只选一处 | 每次具名选一项；VOBS 可在 PG-02 后提名，仍须单独调整排产，不由本稿自动插入 |

**当前排产事实与推荐顺序分开记录。** 本轮 PLAN-2 仍为 `active=none,next=PG-01B`，现役链为 `PROC-01 → PG-01B → PG-02 → PG-03 → PG-04 → PG-05 → PG-06 → owner-stop`；本次未改这条链。未来用户明确要求“按统一 Prompt 实施”时，采纳的近期组合是 PG-01B 与 AS-01/AS-02 及上述位置。supervisor 在 PG-01B 前置成立后，把该次具名授权登记到现有 owner 决策载体，并同步 PLAN-2、受影响链断言/引用/测试后才开 AS；旧 D17 不是任意插批授权。若实际排产已推进或某批已闭合，先按 evidence/祖先关系核对，跳过已闭合范围，不为旧顺序倒退或重复施工。

默认授权范围到 AS 隐私批的可审查结果为止。PG-02 之后仍看新任务授权与实际 next；任何已具名、合同完整且无 checkpoint 的下一阶段可继续，不能自动全做候选，也不能消除 owner-stop。commit/merge/push/install/deploy 未获授权时，先交付具体候选，不能伪造前置闭合。

## 2. 两组范围的去重与保留

| 原建议 | 统一归属 | 处理 |
|---|---|---|
| ECC AS-01/AS-02 + 同批恢复 | 本文 §3 | 独立隐私批；不是远程关闭或全面审计重构 |
| 工程缺口中的动作/预算/远程 | PG-01B/PG-02 | 保留原 exact-set；AS 不顺带重做 TaskModal 动作体系 |
| ECC S-04 adapter 诚实表 | PG-02 | 只消费一个 capability/action/support 真相源 |
| ECC 安装收据/doctor/G-B12 与 HOST-01/02 | HOST 候选 | HOST-01 先按需被动诊断；安装所有权收据与升级/卸载仍归 G-B12/HOST-02。无收据只能报告 ownership 未验证，不能伪装安装校验通过 |
| ECC AS-03 笼子与 PG-06 准入 | 独立 conformance 条件项 | 保留不同 enforcement 分档；不把 live 笼子作为静态 PG-06 的隐性前置 |
| ECC AS-04 工具循环 | 先诊断的条件项 | 不与语音 latency 合成大观测平台，不自动新增 blocked |
| ECC AS-05 Git grammar | 触达相应效果判定时的小修 | 风险只上浮，verify 冻结仍生效，不重写 shell parser |
| ECC AS-06 dependency advisory | 发布/依赖维护条件项 | 不是 PG-04 的不可变业务审计；不新增默认依赖安装策略 |
| ECC AS-07 数据外发披露 | 具名外部调用批的 UI/话术 | 使用既有审批，不建设第二 consent 系统 |
| AS importer/MCP 与 READ-01 | 具名资料任务或消费者出现后 | 第三方仅 candidate+taint；不把外部工具或 ECC runtime 自动装进来 |
| VOBS/VIEW/VOICE/CONTEXT | 本文 §4 | 保留前次成本修订；无固定 5 秒全量刷新、无固定 TTS→LLM 顺序 |
| 旧 Fable/Astra 比较表、E/S/P2 全量映射 | 归档与 research 原记录 | 保留可追溯性，不再作为第二入口；不是将未展开项全改成“必须做” |

远程止损的用户成本保持显式：手机或远程浏览器的业务查看和操作会不可用，包括只读数据；已有本地正常入口仍须可用，受限状态和替代入口需清楚显示。远程若是 owner 当前核心使用方式，应提出安全重开的具名范围与优先级；重开依赖[缺口决策表](2026-08-28-project-gap-owner-decisions.md) D6/D18、相应 ADR、加密认证传输、逐设备身份/最小权限/撤销、凭据存储/轮转及兼容恢复。此 D18 指 remote trust stack，不是 docs/07 的同号模型供给决策。重配对、重新登录和中断成本由重开批说明，不能恢复不安全只读口来缓解功能损失。

不复制 ECC runtime、hooks/skills 内容包或全局配置；Tier1 的 `--setting-sources ""` / `--strict-mcp-config`、Gate 0、S3、记忆信任与不可变审计红线保留。若未来实际复制第三方文本，按原来源/许可登记流程处理；本轮只合并本仓已有方案，不引入新依赖。

## 3. AS-01/AS-02 隐私批：统一设计，再统一实现


本统一方案中的 AS-01/AS-02 合为一个 daemon 隐私批。投入 M（跨 ledger / foundation / canonical，不是单模块一日小改）。scope 不含 `packages/daemon/src/net/**`（PG-01B roots）。失败可见与恢复和保护一起交付，不另开第三阶段，不另建管理产品。

### AS-01 持久化入口的窄凭据字面量检测

**机制：** 抽纯函数 `findCredentialLiterals(text) -> {kind, spanDigest}[]`，与 TTS 展示策略分离。只复用凭据子集：PEM 私钥块、明确 token literal（`sk-` / `ghp_` / `github_pat_` / `xox[baprs]-` / `AKIA` / `ASIA` + 声明长度）。**不**纳入 TTS 表其余项（`voice/redactor.ts:30-47`）：`env:NAME`、`sha256:` digest、ULID/Crockford 业务 id、路径、客户数字、>=20 字符泛长串、熵估计。保护层在 `classifyTrust` 与任何 `requestedTrust` 豁免之前。扫描只绑在下列写入/构建边界，不无条件在每轮对话全量扫描。

**声明 write set（命中只拒这次写入或这次新 generation）：**

1. `MemoryLedger.add`（`ledger.ts:89-116`），含 supersedes。命中：不 insert，账本无原文，audit 只记 digest+kind。
2. `liveTools` `remember`（`brain/liveTools.ts:1273-1318`）。`user_stated` / `requestedTrust` 不能绕过。
3. foundation 构建：在读 KEY_FILES 原文进 excerpts 之后、**首次 raw 写入 staging 之前**扫描。`:262-268` 会 `mkdirSync(staging)` 再 `writeKnowledgeDocs`。`:327-403` 不是单一敏感面：`core.md` 含 AGENTS/CLAUDE 摘录；`conventions.md` 含 AGENTS/CLAUDE 与现场读取的 `.cursor/rules`（`:392-397`，不经 excerpts map）；`build-test-run.md` 含 `package.json` scripts（`:368-377`）与 justfile 任务（`:378-385`）。规则读取、package scripts 与 justfile 进入 staging 的路径必须在首次 raw 写入前覆盖。
4. 本批若触及其它新持久化知识投影正文，同一函数，禁止第二套规则。

**foundation 唯一合同：** 本次构建任一声明敏感面命中，则在首次 raw 写入 staging 之前终止「本次新 generation 发布」。旧已验证 generation 及 `current.json` pointer 不变；不得把旧 manifest 改成 `partial`；不得写 partial 新版；不得同时承诺发布新 generation。只返回本次构建受限/未发布的结构化结果（建议码 `foundation_build_restricted`，名称在回写 09 时定）。项目登记与其它对话不因此停；用户原文件不改。预算超限的既有 `partial` 续跑合同不套用到凭据命中。

**正例：**

- claim 含 PEM 或 `ghp_` literal -> `add` 抛 `memory_secret_literal`，账本无原文，audit 只记 digest+kind。
- foundation 任一声明敏感面命中 -> 本次不创建 staging、不 publish、不改 `current.json`、旧 generation 保持原 status。
- `env:OPENAI_API_KEY`、`sha256:` 64 hex、SayDo id、常见明确占位符（如 `sk-test` 文档夹具、`ghp_fixture_not_a_real_secret`）可过。
- 合法引用（env 名、digest、路径、业务 ID、泛长串）不误拦。

**反例：**

- `requestedTrust=user_stated` 绕过。
- 先写入 staging 再告警。
- 把旧 manifest 改成 `partial` 同时发布新 generation。
- 错误信息、TTS 或日志回显命中原文。
- 因一个 excerpt 含 token 拒绝整个项目登记。
- 改用户 AGENTS.md 原文件。
- 每轮对话无条件全仓扫描。

**失效：** 新供应商 token 形态不在声明 grammar 内 = 已知漏检，不是「已证明无 secret」。格式与真实凭据相同的假 token 不承诺可以准确区分。

**回退：** 方案尚未上线时可撤回本提案。上线后遇误伤：优先停受影响的新写入，保留旧有效数据与保护策略，按有证据的修订/回退合同恢复。不回放被拒 secret，不自动删库/改 Git 历史。不得「删除检测函数即可」使已经选择的保护要求静默失效。

**canonical：**

- ledger/`remember`：09 §13 增建议码 `memory_secret_literal`；§12-4 正反例。不改 trust 枚举。foundation 错误不得只塞进 remember 工具码。
- foundation：`docs/modules/b-memory.md` B3；`docs/09-data-contracts.md` §11 / §12；`docs/04-key-mechanisms.md` §1.2（刷新失败保留旧 generation）。

### AS-02 `.saydo` Git 保护语义

**机制：** 保护声明私有生成物，验证**实际保护语义**。不是停掉 Git 防护，也不能借删除共享开关改成整个 `.saydo` 全目录一律封禁。`docs/03-architecture.md:143` 既有约定是「知识库默认 gitignore，可显式选择提交以团队共享」；当时 `packages/daemon/src` 无 gitignore 读写。本批落实默认忽略与语义验证，不覆盖现有用户文件，不自动取消既有人工共享配置。

| 路径 | 本批默认 | 本批不做什么 |
| --- | --- | --- |
| `<workspace>/.saydo/foundation/`（含 `staging-gen-*`） | 忽略；永不当作可共享目标 | 不新增 schema 豁免 |
| knowledge 投影 | 忽略；已跟踪/用户已提交的文件当作用户数据保留 | 不把已有共享文件无条件当作安全豁免去继续写入新私有投影 |
| 转写 / token | 不因本批落工作区；`~/.saydo/sessions` 本就不进仓 | 不随共享讨论放开 |

新托管 ignore **create-only**：无文件则写最小规则，只覆盖声明私有 write set；已有合法等价规则（覆盖声明 write set）接受、不覆盖用户文件。已跟踪文件不受 gitignore 影响。当前不能安全生成到已跟踪或未保护目标时：保留用户数据与配置，**只停本次受影响私有投影**并给处方（可由用户 `git rm --cached`，daemon 不执行）；不阻塞其它项目工作。不自动 `git rm`、不清理历史、不删用户文件。

Git 必须支持：非 Git 仓、worktree 的 `.git` 文件、等价 ignore、tracked 检查、根外 symlink、写失败。查询绑在相关写入/构建边界，不每轮对话全量扫描。

**本批明确延期（不是验收项，也不为此新增承载）：** `knowledgeShare` enabled/allowlist、`projectOverridesSchema` 共享字段、共享设置 UI、DDL/`project_settings` 新字段。`projectOverrides.ts:18-33` 目前 strictObject 仅 `models`/`budget`，保持不变。`project.toml` 仍不得放松保护。未来真正存在合法共享消费者时单独设计。

**正例：**

- 非 git 仓 -> 跳过 Git 查询，仍写本地文件并记录 `not_git`。
- worktree 的 `.git` 文件 -> 用 `git -C <workspace>` 查询，不把 `.git` 当目录读。
- 已有 ignore 等价覆盖 foundation -> 不覆盖文件。
- 用户先前手工 tracked 的 knowledge 文件 -> 保留该文件与配置；本次新私有投影若无法安全写入则停这次投影并给处方，不自动 untrack。

**反例：**

- 只读目录创建 ignore 失败 -> 停敏感投影，不清空用户 ignore。
- symlink 指向根外 -> 拒写。
- 已跟踪的 `foundation/core.md` -> 不新增该投影，给出处方。
- 因延期共享开关，改成整个 `.saydo` 字节全等 `*`。
- 把已有共享文件当作无条件安全豁免，继续往里面写新私有生成物。
- 本批新增 DDL / 设置页 / `projectOverrides` 字段承载延期能力。

**证据：** 对声明 write set 跑 `git check-ignore -v` 与 `git ls-files`，不是无限语法 linter。linter 不是安全边界。

**回退：** 方案尚未上线时可撤回「自动创建 ignore」提案。上线后：可停止后续 ignore 自动创建；已建保护保留；不覆盖用户文件；不重新写未保护私有目标。不回放 rejected 内容或历史提交，不自动 `git rm --cached` / 改 Git 历史。

**canonical：** `docs/03-architecture.md:143` 保持「默认可忽略、用户可手工共享」的既有表述，不在本批改成 `knowledgeShare` 开关；`docs/09` foundation/ledger 错误码；`docs/04` §1.2；`docs/modules/b-memory.md` B3；`docs/10` 复用既有处方话术（blocked 原因本轮不改）。建议处方码 `git_protection_insufficient`。02 §5.1、11 项目设置行、`projectOverridesSchema` 共享字段不进本批。

### 失败可见与恢复（与保护同批）

不新建通知中心、持久化遥测平台或新 blocked 状态。复用既有错误卡、项目详情与奠基/重试入口（`ProjectSettings.tsx` 奠基/重奠基、`ErrorCard`）。新鲜度不得静默伪装成成功。

必须可判定区分：

1. **单条记忆未保存：** ledger/`remember` 命中；该片段不落盘；其它对话继续。
2. **更新失败仍用旧有效知识：** foundation 命中且已有已验证 generation；pointer/status 不变；界面明确「未更新」，不得把旧知识说成本次成功刷新。
3. **首次构建失败暂无底座：** 没有旧 generation 时不得假称保留成功。

现有可视界面可给安全的来源定位、原因分类和具体恢复动作：相对来源与行号仅作脱敏元数据给现有 UI；禁止回显命中原文；不得把完整路径送 TTS 或把敏感片段写日志。审计/日志仍只保留允许的 kind/digest。

同一未解决问题避免反复通知：优先用既有 callback `dedupeKey` / occurrence 去重；若该路径没有现成去重，只做本次流程内最小去重，不建设跨服务状态。

修复源文件或 Git 保护后，走既有 refresh/retry（项目设置奠基/重奠基）可以发布新一代；无需重装、无需关闭保护或自动删除用户文件。

**正例：** 三类失败可区分；旧知识仍可用但明确未更新；首次无旧知识不假称保留成功；恢复后实际更新；同一问题不重复轰炸；source metadata 脱敏；合法引用不误拦。

**反例：** 把未更新显示成成功；TTS 读出完整路径或命中原文；为去重新建通知中心；要求用户关闭保护才能恢复。

开销只用定向测量说明（绑定写入/构建边界的扫描与 Git 查询），不编造毫秒/收益比例，不增加持续上报。

### 失败、迁移、依赖

| 文件 | 合法变更 |
| --- | --- |
| `docs/09-data-contracts.md` §13 / §12-4 | `memory_secret_literal`；审计只记 kind+digest；三类失败语义 |
| `docs/09` foundation 段 | 凭据命中 = 本次未发布；旧 generation/pointer 不变；首次无旧知识不假称保留 |
| `docs/modules/b-memory.md` B3 | generation 未切换前旧底座可用；失败可见 |
| `docs/04-key-mechanisms.md` §1.2 | 刷新失败保留旧 generation，不得伪装成功 |
| `docs/03-architecture.md:143` | 可澄清默忽略私有生成物；**不**改成 `knowledgeShare` 开关或覆盖用户手工共享 |
| `docs/10-voice-ux-spec.md` | 复用既有处方话术；blocked 原因本轮不改；不把完整路径送 TTS |
| `docs/11-ui-spec.md` | 复用既有错误卡/项目详情/重试；不新增共享设置行；AS-07 才动 §5.8a |
| `docs/02` §5.1 / `projectOverrides.ts` / DDL | **本批不改** |

- 凭据命中（ledger）：该片段不落盘；ledger 不 insert；项目登记与用户原文件继续。
- 凭据命中（foundation）：本次新 generation 不发布；staging 不写；旧 generation 与 pointer 不变。
- ignore 创建失败 / 已跟踪 / 保护不足：只停这一次敏感投影。
- 已有明文 secret 不自动 forget、不 `git filter-repo`；用户走既有 forget 两阶段（`docs/10` #38）。
- 未来门禁：canonical / daemon 改动须 `just ci` + 必要定向测试（ledger/foundation）。文档检查不能代替产品门禁。

## 4. 性能、交互与诊断候选：保留成本约束


以下仍为未排产候选。AS 隐私批与原 PG 安全批不依赖这些扩展。只有 VOBS-01 给出较完整的技术出口；候选被具名选中后先补 canonical、exact pathset 和 gate argv，再交 Grok，不能凭本表全部开工。

每个实际开批的执行卡只补四行，原 PG 批也适用：**用户可见回报**；**增量运行成本与上限**（请求、存储、模型用量、后台资源，无新增则写明依据）；**用户负担**（功能损失、配置、重登录或中断）；**后续维护责任与停止/扩展条件**。上限可暂待开批取数，冻结验收前须能判断；未知成本不能写成零成本。记录放进原批卡/执行副本和收口说明，不新增报表平台、通用 checker 或独立审批流程。

### VOBS-01：现有语音观测准确性，预计 L2

范围：复用 `LatencyCollector`、现有 dev 报告与普通日志；不新增公开 API、WS 消息或自动 provider 探测。不改实时部署。

回报与持续成本：得到可用于选优化方向的分段与失败报告，用户此时未必感觉更快。只增加有界内存统计和必要的聚合日志；分组维度、计数窗口、已结算轮去重索引都须有界，不能把 turn/session ID 变成永久指标标签。沿用普通日志现有轮转，开批明确本批新增字段的输出频率、保留容量/期限和维护位置；日志可轮转不等于可裁剪不可变审计。默认不留新增逐轮原文、不引入外部监控服务或模型费用；若现有观测已足够支持选型，到此停止扩建。

验收：

1. 至少 20 个有效完整样本后才允许表达 SLO 可判定；P50 ≤ 1500 ms 且 P90 ≤ 2500 ms 同时满足才 pass。少样本、非有限/逆序时间戳不能给 pass。
2. 按会话/轮次关联，重复/迟到事件不复活已结算轮；pending 设固定容量与 TTL，溢出/超时明确计数。首次实现可采用 500 条 pending、120 秒 TTL 的工程限制；写入该批验收合同后固定测试，不作为产品速度承诺。
3. 分母至少区分已开始、完整、取消、超时/缺段；文本轮、PTT、免手、工具轮不能不加标注混成一个语音首响分布。计数总量可对账；不能只让成功轮进入可见数据。
4. 现有阶段名若继续保留，报告明确 `llm_first_token`/`tts_first_byte` 当前是响应/句合成完成的近似，daemon 接收时间是跨进程代理。发现必须改 WS 词表时，先回 canonical 并重新冻结该批范围，不能偷加字段。
5. 用合成成功、P90 超限、取消、缺段、重复事件验证报告；现有生产 hub/dialog/pipeline 路径分别验证，不仅直接调用 collector。真实供应方基线属于后续具名环境的条件证据，未跑即 `not_run`，不为它读取 owner 配置或凭据。

出口：可信的分段报告及失败分母；不承诺性能达标。最低 focused 面为 collector 统计测试、voice-hub/live-dialog 接线测试和受影响 Python 测试。源树当前测试文件名由开批搜索核验，新增 collector 测试标 `[new]`，不能假装已有测试路径。

### VIEW-01/02：先让页面知道变化，再减小读放大

VIEW-01（L2）只改正式页面已有读口的生命周期：初次快照后，优先在动作成功、已覆盖该变化的现有事件、回到前台/恢复连接时刷新；事件合并、请求去重、组件卸载取消，局部失败保留事项并可重试。不把 attention 颜色翻译为确定业务状态；无可靠任务读口时显示未知或收窄标签。先列明现有事件覆盖与遗漏，不能假定已有事件覆盖全部后台变化。

不预设每 5 秒全量拉取，也不承诺统一 6 秒更新。未被事件覆盖的变化保留有界兜底刷新和手动重试；后台标签页暂停非必要请求，恢复前台重新取快照。开批将可接受的新鲜度上限与每个活跃页面的请求预算一起冻结，用指定 Focus 数、事件突发、离线恢复和多标签场景验证。当前 N+2 下，一次全量刷新 20 项会发 22 个请求；频率乘请求数只是负载估算，不是 CPU/数据库瓶颈实测。若预算与新鲜度不能同时满足，缩小刷新范围或提请 VIEW-02，不能暗中加频率。

验收同时覆盖动作成功后的定向失效、缺事件时的兜底更新、刷新不重叠及晚到旧响应不覆盖新状态；断网时保留旧内容并标 stale，恢复后在冻结的上限内更新；一个 detail 失败保留原项/占位错误；重复挂载卸载后无残留请求或定时器。收益是少手动刷新且不静默丢项；持续成本是浏览器流量、daemon 读取与电量，用户仍会看到明确的短暂旧数据状态。维护点留在现有数据 hook，不另建常驻同步层。

VIEW-01 不声称解决 N+2。VIEW-02（跨边界 DTO/权限按 L3）另补分页、有容量上限的聚合读口及共享 runtime parse，消除逐项扇出并给出业务状态来源；事件只是失效提示，丢失/重连后重新拉快照，授权 scope 不能靠事件 ID 猜。选择 WS additive 消息时同步 09、schema、角色白名单与兼容；不需要引入独立 CQRS 平台。

VIEW-02 仅在上述预算/新鲜度约束无法满足，或已有读口无法给出必要的真实状态时启动；需承担服务端读模型、分页与权限合同的持续维护，不因 N+2 这个形状本身就开工。

### VOICE-01/02：音频早播与 LLM 早播分开，均按 L3 准备

两个 ID 表示不同改动面，不表示先后顺序。VOBS-01 后先比较同一模式/配置下的阶段占比、端到端 P50/P90 和失败/取消情况；当前代理阶段只能支持其实际口径内的归因。选一条有安全可行性且预期收益足够的路径，必要时先补最小测点。主耗时若在 LLM，不能默认先做收益很小的 TTS 改动；未授权真实供应方调用时只报告 fixture 结论，不据此宣称实际瓶颈已确定。

选 VOICE-01 时保留完整 LLM 输出校验，验证一句已授权、已脱敏文本的 TTS 首块到达即可形成可播放前缀。定义供应方 adapter 的窄迭代接口，不建设供应方市场；明确音频格式、序号、结束/取消、背压和断线恢复。若需要调整二进制 framing、播放器或身份兼容，先补 09 §10/§16 和共享合同。

选 VOICE-02 时只做一个已登记 API 路径的增量文本，它不以 VOICE-01 已实施为前提，可在现有整句 TTS 边界验证收益。`live/dialog.ts:915–1026` 的项目锚定、屏幕投递与落账/结果话术闸，以及 `dialogLoop.ts` 的模型身份、工具参数和脱敏，必须在首句播出前保持有效。不能先说后校验，不能把未执行工具的结果当成事实。

若某条全局输出规则必须等完整回复才能判断，该轮继续缓冲；先确定允许早播的子路径及其证明，不为赶低延迟删除输出闸。跨 chunk 的 token/路径脱敏、半截 tool arguments、缺 model、取消后迟到 chunk、断线重连、未听到的句子不入 history，均是明确反例。打断时取消 provider 读取、TTS 队列与播放器，晚到音频不能复活。移动 native.reply 与浏览器音频是不同消费面，不把桌面一次通过外推全端。

验收仅覆盖所选路径：VOICE-01 在受控延迟 fixture 下首个可播放前缀早于整句合成完成；VOICE-02 在允许早播的文本路径首句早于完整回复。再做同配置、同输入、具名 artifact 的对照统计；只有真实环境证据支持才声明改善。单纯收到网络 chunk 不算实际出声。ASR partial、gist、第二供应方不在两批内。

开批先固定端到端改善目标及可接受的失败/取消回归界限，并约束并发请求、重试、缓冲和取消后的在途工作。流式不等于更便宜：连接与播放状态更复杂，打断后已生成的 token/音频可能仍计费；不增加供应方也不能承诺账单不变。维护责任落在所选 adapter/播放器路径；未达到收益目标或成本界限时停在旧的安全路径，不自动继续另一半改造。

### HOST-01/02：最小被动诊断可提前，同包验证与迁移按需

HOST-01（只读诊断 L2）复用 `status/health/readyz/setup`，报告安装版本、运行 identity、脱敏 state root、配置世代、pipeline 缺失或上游降级。默认不发 provider 请求、不执行第三方 CLI、不打印 key/完整路径。未获授权的 live 面只读取已提供的 fixture。判定能区分没起服务、旧 runtime、包不含 pipeline、配置未生效。

它可以早于分发改造成为独立小批：按用户请求聚合已有本地结果和已记录失败，未知就明示，不能为了填满诊断表自动调用模型或扫描外部账户。收益是减少排障步骤，成本主要是诊断映射随版本维护与一次按需本地读取；不新增后台探测服务或必填配置。不为它预先建设 upgrade/logs/uninstall 全套管理框架。

只有分发变更或可复现运行身份差异需要时，才在隔离 state root 上复用已有打包安装测试验证同一制品，不把它作为最小诊断的必做扩项；这不产生新 RC。HOST-02（L3）退出近期默认范围；具名分发需求成立后才选择常驻制品迁移或自动 upgrade，二者也不必须捆绑。前置 PG-05 恢复保障、daemon/pipeline identity 兼容、digest、原生依赖/许可、失败回滚。持续成本包括版本/兼容矩阵、恢复点与旧版本占盘；用户可能需要重启或短暂停用，迁移与退出方式须提前明确。部署、发布、重启常驻或迁移真实状态仍需当次 owner 授权。相同 bundle digest 只是其中一项验收。

### READ-01、A11Y-01 与其余候选

READ-01：退出近期默认范围；PG 安全链后，有一个现有工具不能满足的具名资料任务时，按 SP5/SP6 选一个只读来源，完成内容快照、出处、引用回读、截断/变化说明、导出验收；不默认 SaaS/OAuth/写入。持续成本是来源格式/权限变化、请求与快照保留，可能增加用户配置或授权负担；开批限定来源、容量和维护责任，无额外来源需求时不扩成连接器平台。工具输出视为数据，不能直接变 trusted 记忆。权限/外部输入边界按 L3。

A11Y-01：触达正式 TaskModal 时做键盘闭环（进入焦点、焦点限制、Escape、返回触发点），L2；几乎不增加远端请求或用户配置，维护随组件变化进行。后续快捷键另验证输入冲突与录音生命周期，不额外造全局系统。

CONTEXT-01：退出近期默认范围；只有固定长对话用例证明当前 pack/记忆/历史窗口丢失重要约束，且现有 pack/记忆修正不足以解决，才设计有预算、可回溯、可失效的 gist。持续模型调用、摘要保存与失真纠正都是成本；冻结调用频率/用量上限、失效规则和维护责任，不能证明约束保留改善就不启用。摘要不进入 trusted 记忆，不放在首响关键路径同步等模型；不以“廉价模型”替代可信度设计。

Pipecat 依赖、logger 背压、测试拆分和前端拆包：分别需要依赖闭包、故障/容量、耗时或加载证据。触达时处理，不先立治理批或大重构。额外语音供应方与本地模型同样后置：有现有供给无法满足的具名可用性、能力或成本需求，且维护者能承接凭据、协议、版本及本地资源成本时，只选择一种组合验证，不扩展成默认支持矩阵。

## 5. ECC 后续条件项与停止边界

这些条目均不在近期默认施工范围。开批时沿 §4 的四行成本说明，复用现有模块和测试；不以“ECC 有此机制”为实施理由。

- **AS-03 conformance：** 只在具名 BYOA/conformance 窗口启动。现有 `providers/byoa/cage.ts` 分档为 claude/grok 的 tool-deny、codex 的 write-sandbox、cursor 的 ask+tripwire。分别记录 tool/write denied、tripwire、leak_observed、unverified；“没输出哨兵”不等于读隔离。用允许读取的阳性控制证明夹具有效，模型自述无效。真实 CLI/凭据/费用须有对应授权，未启动/超时不能给 pass；维护 CLI 版本与夹具，保持既有 cage argv 与准入合同。
- **AS-04 循环：** 只有无进展重复调用的具名排障需求才加有界诊断。以 tool+参数摘要和结果/写入路径/错误/cwd 的进展信号判断；N=5 仅旧建议初值，不预先当硬合同。计数、缓存与输出频率有上界，敏感数据不进原文日志。未来若要自动停止，先改既有 circuitBreakers、共享 presentation 与 docs/10 的唯一 blocked 合同；不另造控制状态。
- **AS-05 效果词表：** 触达 `cmdEffect`/verify 配置保护时，只补有限正反例。保留 commit/am 的 `-n`、组合短选项与取值参数区分；push 的 dry-run、cherry-pick 的 no-commit 等不得误判同义 bypass。`--no-verify`、`core.hooksPath` 按实际 Git 版本和子命令核对；最终风险取原风险与新下限的较高值，既有 S3 不降成 S2。heredoc 区内写、不可判解释器等按既有策略，`cat <<EOF | sh` 不天然等于 S3。维护成本是这段有限 grammar 的兼容，verify 不因提级而解冻。
- **AS-06 dependency advisory：** 在具名发布或依赖维护批选择 runtime prod 依赖扫描，证据绑定锁文件摘要、工具版本、advisory 时间和退出原因；网络错误/过期为 indeterminate。保留现有 SHA pin、构建脚本许可；不默认加入 ignore-scripts/minimumReleaseAge。需要持续更新 advisory 证据，只有消费该结果的发布判定已明确才做；不宣称一次无告警永久安全。
- **AS-07 披露：** 具名探针或新增数据外发能力被选择时，补既有 docs/10/11 的用途、数据类别和操作后果说明；不提供关闭必要审批的选项，不新建 consent 存储。文字随对应能力维护。

其他 ECC deferred 继续保留原触发：S-01/G-B12/P2-10 安装生命周期归 HOST；S-03/P2-11 importer 只经 `MemoryLedger.add`、`source.kind=import`、不传 requestedTrust、不绑 readiness，candidate+taint 后再由既有批准升格；S-05 MCP 清点需具名诊断，S-06/P2-12 只有宿主实际给 context occupancy 才展示，不用 run cost 冒充；S-07/P2-01 工作区观测、P2-02 跨机 ID 仅关联 hint、P2-03 系数、P2-04 Windows 管线桩、P2-06 golden 扩容、P2-07 任务卡提示、P2-08 晋升提名、P2-09 Codex rollout 解析均保持各自具名消费窗口。AS-07 已吸收 P2-05；不重复立批。

## 6. 事实底线、验证与归档

本轮定点读到 `memory/ledger.ts:89–116` 在 classify 后直接 insert，`memory/foundation.ts:243–268,327–403` 在 staging/publish 中消费 AGENTS/CLAUDE、现场 rules 和构建命令。这支撑 AS 新持久化保护；不是“所有存储都没有任何保护”的泛化断言。`.saydo` 私有写集与既有手工共享约定必须同时保留。项目中现有受限态、callback 和 UI 消费应在开批追到正式路由，不能把某个旧页面文件当作当前唯一路径。

工程缺口的反证继续有效：延迟 collector 已有接线，但 P90/失败分母/pending 边界待修；控制面已有部分事件；正式看板仍有 N+2 与局部失败丢项；CLI 为 up/status/open；已有 distribution 验证。原研究探针不是实际供应方延迟、播放端或常驻升级证据，不重复承诺亚秒、固定工期或零维护成本。

Grok CLI 承担产品实施，supervisor 编排，正式 review 由一名全新零上下文 Codex 完成。每阶段范围/验收/门禁先固定；沿有效 policy 的角色与 3/3 预算，P2 仅最终一次 sweep。AS 采用 contract→implementation 两个预先接受阶段，不按 AS-01/AS-02 再拆四个审查阶段。完整产品门禁在语义 GREEN 后执行，文档校验不冒充产品验收。

本次统一稿的审查与文件摘要见 [本轮证据目录](../../research/engineering-unified/)。旧 review 的 GREEN 仅对应它自己的文件摘要，不自动覆盖本统一稿；未运行产品 CI、真实 provider/runtime、部署的部分均不宣称通过。

旧操作入口均改为跳转页，原始字节放在 [归档索引](archive/2026-09-05-engineering-unified/README.md)，含 ECC 五份方案/一个 Prompt、工程缺口两份方案/一个 Prompt，共九份。原始研究与审查保留在 research；Astra 初次只读报告仍为历史证据，不是开工入口。归档清单记录旧路径、新路径和 SHA-256；历史指令、支持状态和旧 GREEN 不再具有当前效力。当前统一 Prompt 不依赖归档中的命令才能执行。

> **状态注(2026-09-09,Fable 核验后回写)**:§1 推荐组合已闭合——PG-01B 收口于 2026-09-05(I `ebd4490`),AS-01-AS-02 收口于 2026-09-06(I `7ab7ab3`,E `21ed284`);PLAN-2 指针 `next=PG-02`。配套统一 Prompt 因此转为历史材料。§4/§5 候选逐项核验结果(main `25a9924`):
>
> - **AS-05**:包管理器/exec 部分已由 SD-3 实施(候选 worktree `../SayDo-wt-sd-borrow`,journal R141);Git hooks 绕过(`commit --no-verify`/`-n`、`push --no-verify`)仍未覆盖,`core.hooksPath` 已 S3。残项进 `IMPL-PROMPT-2026-09-09-gap-consolidation.md` §2.2。
> - **VOBS-01**:仍成立(P50-only、partial 无界、无失败分母;completed 上界已有),有价值 → Prompt §2.4。
> - **VIEW-01**:仍成立(N+2、静默丢项、只靠 tick),有价值 → Prompt §2.5;**VIEW-02** 条件未触发,不做。
> - **VOICE-01/02**:等 VOBS-01 证据,本轮不选。
> - **HOST-01**:仍成立(CLI 仅 up/status/open),有价值 → Prompt §2.7;**HOST-02** 不做。
> - **A11Y-01**:仍成立(TaskModal 无 Escape/trap/焦点归还) → Prompt §2.6。
> - **AS-03**:最小前置(cage 分档类型化)→ Prompt §2.9;真实 CLI conformance 探针条件未触发。
> - **AS-04 / AS-06 / AS-07 / READ-01 / CONTEXT-01**:核验条件均未触发,**无近期价值**,不再复查;触发条件维持原文。
> - logger 背压(G-B14):仍成立 → Prompt §2.8(普通日志可降级,审计不可)。
