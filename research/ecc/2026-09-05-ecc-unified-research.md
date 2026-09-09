# ECC 统一研究报告（2026-09-05）

> **状态：范围修订，独立评审结果见本仓交付记录。本轮未实施产品代码。** 研究终稿，不是产品合同、排产或产品验收。
> **上一版历史证据（不得误认为本修订范围已评审）：** R3 完整语义 GREEN；R4 复核 GREEN；十二项文档门禁 exit 0，ContextView 148 tests OK。那些结果验收的是修订前文档。
> **维护源：** SayDo `research/ecc/2026-09-05-ecc-unified-research.md`。ContextView `docs/research/2026-09-05-ecc-unified-research.md` 为逐字节相同的便携镜像。两边都不依赖相对 Markdown 链接才能打开。
> **读法：** 按机制合并，不串接两份旧报告。旧 Fable / Astra / Codex 全文保留于两项目原路径，仅作归档。
> **ECC 源码钉：** `e04ea0b9cc8248686edf5ac751cadff550e162b8`（2026-09-03）。许可 MIT，Copyright (c) 2026 Affaan Mustafa。
> **成熟度词：** 原 source 表里的 `stable` 只是作者分类，不是本任务验证过的生产成熟度。
> **坐标存在 ≠ claim 复核：** 源索引 118 条路径/行范围本轮机械检查全部存在；这只证明坐标存在。改变最终裁决的事实已读源码。

## 0. 本轮新核验 vs 历史测量

两栏不得混用。本轮未复跑 ECC 单测、未 `npm install`、未装用户配置、未跑 `ecc2` cargo、未连真实 MCP、未跑全套 `tests/run-all.js`。

| 项 | 本轮新核验（2026-09-05 本任务） | 历史测量（旧会话，当前未复跑） |
| --- | --- | --- |
| npm `ecc-universal` | `control/internet-observation.json`：`latest=2.2.0`，`has_2_2_1=false`，`published_2_2_0=2026-08-27T17:34:09.403Z` | 旧报告同一结论；不得把源码 `package.json` 2.2.1 写成已发布 npm |
| ECC HEAD | 本 clone `git rev-parse HEAD` = `e04ea0b9...` | 旧报告同一 SHA |
| tag `v2.2.0` | annotated tag 对象 `a1d9b395...`，指向提交 `5eddf1a3...`（2026-08-27）；`git rev-list --count v2.2.0..HEAD` = 147；`git describe` = `v2.2.0-147-ge04ea0b9` | 旧报告写 tag=`5eddf1a3` 是 **tagged commit**，不是 tag 对象。计数 147 一致 |
| GitHub 描述 | 官方仓描述已访问确认；不得追加未读发布计数 | stars/forks/issues 是旧会话 `gh api` 数字，本轮不刷新 |
| Windows `FILE_ID_INFO` | 官方文档 URL：`https://learn.microsoft.com/en-us/windows/win32/api/winbase/ns-winbase-file_id_info` | 旧稿曾写「必须 64 位」，已纠正为 128-bit FileId + volume |
| SayDo HEAD | `bcf8ea855f25b177888d9159f75e49214f3dd892` | 同 |
| ContextView clone HEAD | `492fd5fe7183fc5517fb6a1ca811d8d5233eb1f3`；无 Cargo | 旧 Codex 快照仓曾是 `3ae72e4` + 未提交文档；Fable 工作树另有未跟踪 Cargo。三者不是同一工作区 |
| ContextView 负例测试 | 最终监督在冻结 foundation clone 运行：148 tests，79.170s，OK；不验收并行 WP-02 | 历史：144 OK（evidence-index，快照仓）；另一会话工作树 148 OK。缺依赖失败不得改绿 |
| ECC 单测子集 | 本轮未跑 | 见附录 C。包装进程 exit 0 ≠ 子测试全绿 |
| 118 源路径 | 本轮机械检查存在 | 旧索引坐标 |
| OWF probe | `control/octoworkflow-facts.json`：repair=2 且 `current_blockers=[]` 时 yield=false；7 个 hyphen-summary，discovery 0 | 不把读取旧 release evidence 当新验收 |

## 1. 定位、版本、发布坐标

ECC（Everything Claude Code / `ecc-universal`）是一套跨 harness 的可选择安装工作流包 + Node CLI + 可选 Rust 控制面脚手架。它把 skills、agents、commands、rules、hooks、MCP 约定、install-state 和少量 session/MCP 观测合同放到一个 Git/npm 分发面里。它不是语音前脑，不是不可 bypass 的执行控制面，不是 Context Receipt 产品。

口号「Optimize the context window. Persist everything else.」与 `plan → test → implement → review → verify → remember → improve` 是产品叙事。源码更窄：主入口 `scripts/ecc.js` 是 selective-install CLI 路由器，把子命令 `spawnSync` 到 setup/install/doctor/memory/control-pane 等。

版本必须分层：

- **源码事实：** `VERSION` 与 `package.json` = `2.2.1`；CHANGELOG 2.2.1 在 Unreleased。
- **发布坐标：** npm `dist-tags.latest=2.2.0`（2026-08-27），registry 无 2.2.1；git tag 止于 v2.2.0。
- **研究钉：** SHA `e04ea0b9`，不是「跟着 main」。

官网/README 计数（286 skills / 68 agents / 94 commands）与 ecc.tools 过期营销（261/64/84）冲突时，全仓事实用 catalog，官网数字不当价值证明。star 证明分发，不证明质量。`SOUL.md`「30 agents / 135 skills」是过期自述。

演进（源码 + Release，不是官网单独叙事）：1.0 插件 → 1.8 harness performance → 1.9 selective install → 2.0 自称 Agent Harness Operating System（control-pane/MCP inventory/worktree）→ 2.1 Plan Canvas / Memory Vault → 2.2 guided setup / 安装态所有权。网站把 2.0 control-plane 写成 shipped；`ecc2/README.md` 自称为 alpha。以源码自我定性为准。

## 2. 资产、目录、三层 identity

目录（源码计数，不是营销）：`agents/` 68；`commands/` 94；`skills/` 286 个 SKILL 目录（tracked md 更多）；`hooks/` 配置少、`scripts/hooks/` 实现多；`rules/` 122（含 README）；`scripts/` 267；`tests/` tracked 279；`schemas/` 11；`docs/` 含翻译树；`ecc2/` Rust alpha；`src/llm/` Python provider。

三层 identity 不得混写：286 `SKILL.md` ≠ 83 install-components ≠ 36 modules；7 profiles，`full`=26 modules。digest 按文件。Contexpect 若观察 ECC，`asset_kind` 需区分 skill-file / install-component / install-module / hook-entry / memory-document。不要把 286 写成已验证 native 能力数。

`hooks/hooks.json` 约 23 条 id。每条 command 内嵌同一段 plugin-root 解析一行式；实测长度约 1,045–2,169 字符，不是「每条 400 字符」。过长 ≠ 恶意。

## 3. 选择性安装与生命周期

机制：manifest 驱动的 modules/profiles/components；CI 校验 path 真实存在。15 个安装目标 adapter（`registry.js:18-34`）。安装态账本 `ecc.install.v1`：每个受管文件带 `contentSha256` 与 `ownership`。doctor/repair/uninstall 只回放 `ownership === 'managed'`，目的地必须落在 adapter 推导的受信根内，不信任状态文件里的路径（源码注释 GHSA-hfpv-w6mp-5g95；公开 advisory API 历史 404，不得写成已公开 advisory）。

两条安装路径（guided plugin vs 其它）互斥有警告。`ecc doctor` 无 install-state 时 `results=[]`，无 issue 则 exit 0：残留配置 ≠ 可运行。auto-update = pull 最新 + 按原 request 重装，与 SayDo 锁版本身份 pin 冲突，不借。

对 SayDo：可借账本形状作 G-B12 候选，不借把 ECC 装进 harness。SayDo 已有 `deploy/saydo-octoooo-com/install.sh`（pin `v0.1.0-rc.12`），缺的是收据/doctor/升级卸载，不是安装器本身。

对 Contexpect：技术上可作 file-import 第三方来源、无 authority；无 ECC 项目不得因多一条 integration 行变红。正式登记（AC-01）延期，不在本范围自动写入 `INTEGRATION_SOURCES`。

## 4. 跨 harness

15 adapter 与 Contexpect 冻结 18 family 的实际交集是 **7 family / 8 根**（claude home+project、codex、cursor、opencode、gemini、kimi、qwen）。Antigravity/Hermes/OpenClaw/CodeBuddy/JoyCode/Zed/adal 不在 18 family，不得因 ECC 支持加入 required family。

`guidedReady` 仅 claude/codex/kimi。Codex 必须三列：native plugin（`.codex-plugin/plugin.json` + 仅 SessionStart 的 `codex-hooks.json` + `.mcp.json` 仅 chrome-devtools）、legacy sync（`sync-ecc-to-codex.sh` + `.codex/config.toml` 六 MCP）、项目配置旋钮。`/hooks` 显式信任是前提，不是 live 触发证据。未在真实 Codex 会话验证 SessionStart 是否触发。

Claude plugin `mcpServers: {}`；Codex native `.mcp.json` 仅 chrome-devtools；legacy TOML 六服务器是兼容层。不得用「plugin.json 为空」概括全部 MCP 声明。政策文件默认只留 chrome-devtools，其余降为 skill 包 CLI。

## 5. Hook 运行时与 fail-open

23 条 hook 覆盖 PreToolUse / PreCompact / SessionStart / PostToolUse / PostToolUseFailure / Stop / SessionEnd。旋钮：`ECC_HOOKS_ENABLED`、`ECC_HOOK_PROFILE`、`ECC_DISABLED_HOOKS`。PostToolUse 有单进程 dispatcher。

fail-open 缺省（E-110）：Claude plugin `hooks_enabled.default=true`；`ECC_HOOKS_ENABLED` 缺省 true；`check-hook-enabled.js` 缺 `hookId` 时输出 `yes` 并 exit 0；metrics bridge 读成本文件失败时 "failing open"，成本归零。这是观测路径 fail-open，不是 SayDo 门的 fail-closed。Contexpect Doctor 不得把「缺省启用」自动写成 `unknown_source` finding；必须有该规则声明语义下的可达输入。

行为分类：质量/提醒、拦截（config-protection、gateguard、block-no-verify）、观测/学习、上下文注入、成本、赞助入口。GateGuard 首次 Edit/Write 先 deny 要列 importer——与 SayDo fail-closed 效果门冲突，不借。Stop hook 默认可把 transcript 外发给模型生成摘要，属 consent 组披露对象。

未在真实 Claude 会话触发 hooks。历史单测只覆盖 `ecc-context-monitor` 等子集。

## 6. 记忆、instinct、信任

Memory Vault `ecc.memory.v1`：Markdown + 严格 JSON frontmatter；`trust` 只能 `unreviewed`；create-only；写前 `findPotentialSecrets` 拒写；不跟随符号链接；project 作用域 fail-closed `.gitignore`（内容必须恰为 `*\n!.gitignore\n`）；TOCTOU 文件身份守卫。历史单测 `memory-vault.test.js` Passed 35 Failed 0（含 gitignore fail-closed），当前未复跑。

与 SayDo：ECC 硬约束是永不自动升格；SayDo 硬约束是 candidate→trusted，且 M0 只收 `user_stated`/`user_approved`。不能把 ECC vault 当 M0。SayDo 持久化缺口是写路径在分级前没有凭据字面量检测，且 `.saydo/` gitignore 文档有代码无。当前建议第一批：窄凭据写前拒绝 + 私有生成物 Git 保护 + 失败可见；`knowledgeShare` schema/UI 延期，不改成整个 `.saydo` 一律封禁。

Instinct / continuous learning：PreToolUse/PostToolUse 观察 → Haiku observer → confidence 0.3–0.9 → SessionStart 注入（阈值 0.7、最多 6 条、项目/栈 boost 0.25/0.2）。这是启发式置信度 + 自动注入常驻上下文。对 SayDo：违反 M0 与「LLM 只能提名」。对 Contexpect：最多 heuristic 候选，不得写成 observed。不自动 instinct promotion。

可选 `ecc-memory-mcp`：harness 身份由服务端绑定。SayDo/Contexpect 都不做 MCP 宿主。

## 7. 会话与 MCP 观测

`ecc.session.v1`：把已有宿主产物归一化成观测快照，不是启动/审批/settle。四适配器：claude-history、dmux-tmux、codex-worktree（rollout JSONL）、opencode（ses_*/msg_*）。worker health 对 running 用 5 分钟 stale 阈值——启发式。

`ecc.mcp.v1`：只保留 env 键名；argv/URL 按模式脱敏；signature 去重。历史 `mcp-inventory.test.js` 18 passed / 2 failed：缺 `@iarna/toml` 时 Codex TOML 路径红。失败不能解释为生产 reader 坏了，只能记「缺依赖时未在本机验证」。未连真实 MCP。`mcp-health-check` hook 会探进程，SayDo/Contexpect 被动扫描禁执行。

## 8. 控制面与 ecc2

JS control pane：默认 127.0.0.1:8765，loopback Host/Origin 白名单。默认 DB 在 `~/.claude/ecc/state.db` 与 `~/.claude/ecc2.db`。有目录残留 ≠ 控制面在跑。未在本任务起服务。

ecc2：ratatui + rusqlite + git2 + tokio + ureq。README 明说非 GA。`harness-eval` 自述本地 recorded-measurements。ureq 意味着二进制可以出网。本任务未 `cargo test`/`cargo run`。Rust 成熟度 = 未验证。不借 ecc2 替换 SayDo 审计或 Contexpect Effect Lab。

`ecc ito find` 可提交真实 RFQ。赞助/商业桥是独立危险面，不借。

## 9. Orchestration 与 worktree

`scripts/worktree-lifecycle.js` + `scripts/lib/worktree-lifecycle/`（旧稿曾写 `scripts/lib/worktree-lifecycle.js` 单文件，部分成立）。从 git 事实分类；cleanup 只计划删除已完全 merge 或 stale 且干净且无未合并提交的树。这是只读分类 + 安全 GC 计划，不是 SayDo/Hopper 任务 worktree 供给。

tmux 编排、`orch-*`、Plan Canvas、TCAS 邻近是多 agent 编排表面。SayDo 执行编排已有 Tier1/Hopper 合同。Contexpect 最多当 session/worktree 观测夹具。不引入第二套拓扑。

## 10. 供应链、Unicode、路径安全

已证实的工程点：path-safety 不信任目的地路径；memory create-only/symlink 拒绝/secret 拒写/gitignore fail-closed；MCP inventory 脱敏；loopback 门；hook consent 分组披露；Actions 钉 SHA / `persist-credentials` 检查 / `--ignore-scripts` 安装矩阵；个人路径校验；Unicode 脚本禁 pictographic 与一宽零宽/双向/VS/Tag 集合。

需要警惕：IOC 清单时效性强，不借当产品规则；`--ignore-scripts` 与 SayDo `allowBuilds`（esbuild/koffi）关系未在本任务实测，默认不加；`minimumReleaseAge` 会延迟安全补丁。Unicode 对 Contexpect：源码/配置与故意 corpus 分流是技术裁决；仓库级 Unicode gate 移出本 ECC 批，随既有输入规范校验另评，不删除已有 Doctor `hidden_unicode` 检测器。不泛禁合法 ZWJ/ZWNJ；拓展集合要精度样本。SayDo 已有 `check-emoji` 与公开树隐私门。

Windows 文件身份：ECC CHANGELOG 提到 BigInt 修复 libuv 卷序列缺陷。Contexpect 负例必须保留 128-bit FileId + volume，不抄未经验证 Rust API。SayDo POSIX 已用 BigInt `dev/ino`。

## 11. 测试成熟度

仓内 `tests/` tracked 279；`tests/run-all.js` 逐文件 spawn，剥离 `GIT_DIR` 等继承变量。本任务没有跑全套。历史子集见附录 C。成熟度分层：

- 可独立运行、测试较密：install-state、path-safety、memory vault、hook consent、loopback、worktree 分类、capability catalog。
- 需要 npm 依赖才构成产品：guided install（ajv）、control pane/state store（sql.js）、Codex MCP TOML（toml）。
- 文档大于运行时：ecc2 GA 叙事、官网 skill 数、控制面 shipped。
- 内容资产巨大、验收不齐：286 skills 未按 skill 回归。

包装进程 exit 0 不代表子测试通过。缺依赖的红不得改绿，也不得写成上游回归。

## 12. 许可与维护成本

ECC MIT。借鉴设计与小段模式时保留来源声明；不要整仓搬 286 skills。复制具体文件须保留版权与 MIT 全文。依赖 `sql.js`/`ajv`/`toml` 各有自己的许可，不能从 ECC MIT 推导。赞助商标、ecc.tools 文案、GitHub App 不是 MIT 可再品牌化的对象。

SayDo 与 Contexpect 均为 Apache-2.0 根许可。Contexpect development static fixture 强制 Apache-2.0；真实 MIT 片段是独立条件包，禁止再盖 Apache 头。

维护成本：跟踪 ECC HEAD 等于跟随周更的巨型内容仓。正确姿势是钉 SHA 当夹具，不是 submodule 同步一切。

## 13. 与三项目的价值边界

**SayDo：** 同一问题域的另一种解法。ECC 把纪律放在 agent 内部（hooks/skills，模型可关）；SayDo 把纪律放在 agent 外部（daemon 审批门、verify、settle，模型关不掉）。Tier1 `--setting-sources ""` 使 ECC hooks 不加载。可借：窄凭据拒写、`.saydo` Git 保护语义、分档笼子测试思想、循环诊断信号、有限 git grammar、advisory audit、披露词表。不借运行时、不装全局 hooks、不自动 instinct、不做 MCP 宿主、不替换排产。当前建议第一批只 AS-01/AS-02（凭据写前拒绝 + 私有生成物 Git 保护 + 同批失败可见/恢复）；共享设置/schema 延期。

**Contexpect：** ECC 首先是被观察的第三方受管资产来源，其次是原生 surface 线索。不能当 native oracle，不能第 19 family，不改 cutoff。技术可借点仍包括 file-import 形状、线索、hook 诚实边界、逐事件损失、Apache-2.0 合成负例、Unicode 分流、128-bit+volume 负例。当前范围：**取消独立全量 intake**。AC-01 登记、AC-02 完整队列、AC-04 专门事件样例延期；AC-06 仓库 Unicode gate 移出本 ECC 批；AC-03/05/07 按消费者并入既有已授权 WP，无消费者则 research-only/未触发。不另维护重复台账，不承诺追所有 ECC release。不借运行时执行、不复制上游脚本、不把未核验键写成 present。

**OctoWorkFlow：** 不是 ECC 同类。ECC 的 doctor/install-state 对 OWF 的启发已被 OWFOutcome 自己的 receipt/doctor/collector/adopt 覆盖。不要为「看起来像 ECC 生命周期」再造一套。评价见 §14。

跨项目：可共用脱敏原创场景、ECC SHA 快照、阅读方法（打开 `file:line`，不信自述）。不可共用权威 ledger、运行时 adapter、审批决定、自动 trusted 记忆。Contexpect 观察 SayDo 投影也是外部来源。SayDo 不得根据 Contexpect GREEN 放行 dispatch。无共享运行时。

## 14. OctoWorkFlow 评价（主仓 / 已提交 outcome / 已安装）

事实矩阵：`control/octoworkflow-facts.json`。本轮未跑其 release 门禁；只核对源码与已存证据，不宣称本轮验收这条分支。

| 面 | HEAD / 身份 | 要点 |
| --- | --- | --- |
| 主仓 | `0b93139c7ce9f14f537ac50c8bb2ef11509d68be` | README 仍偏「待实施」叙事。`scripts/install.sh` **无** `--doctor` / `--prune-backups` |
| 已提交 outcome 工作树 | `e06a62ac0e73d779d58687bad5d920f8a89d3ef8`；代码 release `eb3703826833ba6b141a36fdb4aaae2dcd786ff6` | `git merge-base` 相对主仓 exit 1，不是祖先。已有 `scripts/install.sh --doctor/--prune-backups`、`install-receipt.json`、`collect.sh` 收据与 dirty/落后保护、`workflow/collect_control_events.py`、`report_conventions`（`workflow/project-profile-template.md`）、`scripts/adopt.sh` |
| 已安装 runtime | `control/runtime/` 25 个公开工具/markdown/policy | 与 outcome/main 的关键 Python hash 不全相同。`v2-policy.json` 三面 hash 相同（`996871d9...`）；`cycle_control.py` / `collect_control_events.py` / `supervised-delivery.md` 等不同 |

`policy_revision` 同 2.4.2 不能保证执行整段周期自动使用同一套工具。runtime_receipt 有工具 hash 能检测不一致。建议按 cycle 固定完整工具 bundle + schema 能力坐标，升级显式迁移。不增加常驻服务、不降低 3/3 或模型。

不要重造：collector、receipt、doctor、adopt、`report_conventions`。旧 main 文档状态落后于 outcome。

本轮实际 probe（已安装 `collect_control_events.py`）：前轮完成 cycle `repair_rounds_used=2` 但 `current_blockers=[]`，`review_yield_from_state` 返回 false（空 blockers 被当成无 yield）。7 个 `*-summary.json` 一个都不被仅识别 `*.summary.json` 的 discovery 读到。应区分当前未关闭 blocker 与历史有效 yield；统一受管 summary 命名或显式 artifact 索引，不靠无限递归扫私人会话。不把当前 false 解读成没有过质量收益。保留分母/unknown、阶段与 repair/rootcause 去重。这是 observability 缺口，不是控制失效，也不是伪造 review 的证明。

建议顺序（每个都有触发、最小实施点、离线验收、代价/不做项）。本轮不为 OWF 写一整套未授权实施任务。

1. **先发布来源收敛。** 触发：三面 hash 不一致或 receipt 与执行工具不符。最小实施点：比较 main/outcome/installed，按 cycle 固定 bundle，显式迁移；不直接 collect 或 install 覆盖。离线验收：同一 cycle 的 `runtime_receipt` 工具 hash 与实际加载文件一致。代价：需一次发布/验收，不是热补。不做：常驻服务、降模型、把 e06 当 main 祖先。
2. **声明候选/只读依赖/最终接收位置闭包。** 触发：上轮把本地已存在但未 tracked 旧报告误认为交付缺失。最小实施点：轻量 source manifest + delivery check；预检 clone 必须具备门禁用的真实 main ref。离线验收：empty checkout 与已有工作区两种语义测试。代价：多一份 manifest。不做：把所有输入放进产品 diff。
3. **telemetry 在已有 collector 上补历史事件/runner artifact grammar。** 触发：本轮 probe 的 yield/suffix 缺口。最小实施点：history yield ≠ current empty blockers；识别 `*-summary.json` 或显式索引。离线验收：用本轮那 7 个 hyphen-summary 与空 `current_blockers` 的 fixture。代价：改 discovery grammar。不做：无限递归扫私人会话；把 false yield 当成从未有过质量收益。
4. **少量高价值机制。** 触发：文档 sourcegen 漂移、同一真实故障缺离线 fixture、source pin 与受管收据语义不清、重复提案。最小实施点：已有文档 sourcegen 一致性/预算 contract 生成、同一真实故障的原创离线 fixture、source pin 与受管收据语义、先检索 KB 去重再提案。离线验收：有限 acceptance surface。代价：小。不做：自动 instinct promotion、跟 ECC 装全局 hooks、每次反复审全部历史报告、削弱必要独立 review。

## 15. 其它项目浅层初筛

扫描范围（不是完全递归硬盘）：WorkSpace 直层、Reference 直层、Reference/_borrow-peers、OctoSkill 直层。只读 README 说明、目录和本地 HEAD，不读源码、不跑测试、不安装。`control/workspace-inventory.json` 列 **190 个 git 目录**（含 worktree/clone/同源副本），不能说 190 个独立产品；identity 去重 **175**。

下列为初筛假设，非已可借用结论，不断言实现质量或直接可抄。不引用营销「最强/全隐私/全部兼容」当事实。

### 15.1 优先 7 个

| 项目 | 相关自有项目 | 后续要验证的问题 | README / 官方坐标 |
| --- | --- | --- | --- |
| beforedone | OctoWorkFlow / Hopper | file-bound evidence gate 与 incident replay 是否真绑定 declared file scope；是否优于或可补 OWF collector/Hopper check，而不是第二套编排 | 本地 `Reference/beforedone/README.md:1-8`；origin `https://github.com/rrrrrredy/beforedone`。官方 README 网页本轮 supervisor 已开；只推荐专项核验 |
| compound-engineering-plugin | OWF 多宿主分发；SayDo 不自动信任 | learn/plan/review/compound 的知识复用如何分发到 Claude/Codex；是否等同自动信任；root-native 迁移是否破坏旧安装 | 本地 `Reference/compound-engineering-plugin/README.md:1-16`；origin `https://github.com/EveryInc/compound-engineering-plugin` |
| pi-mono | ContextView surface；SayDo 适配研究 | agent loop/session/extension 边界是否可观察；官方仓是否已迁 | 本地 `Reference/pi-mono/README.md:20-24`；origin 仍 `https://github.com/badlogic/pi-mono`。官方 URL 本轮重定向到 `https://github.com/earendil-works/pi`；记录重定向，不自行更新 clone |
| agent-compose | SayDo 笼子 | 隔离 sandbox 与 provider CLI 生命周期是否对照 `providers/byoa/cage.ts`；是否把常驻编排引进 OWF（不应） | 本地 `Reference/agent-compose/README.md:21-28`；origin `https://github.com/chaitin/agent-compose` |
| OpenViking | ContextView 上下文组织；SayDo 不替换信任 ledger | 静态层级 vs 证明边界；检索观察面是否可当 Contexpect 线索而不是 native oracle | 本地 `Reference/OpenViking/README.md:9-34`；origin `https://github.com/volcengine/OpenViking` |
| ReMe | SayDo 记忆；Contexpect 只观察 | file-based memory/index/consolidation 是否只适合候选生成/去重；会否滑向自动 trusted | 本地 `Reference/ReMe/README.md:30-31`；origin `https://github.com/agentscope-ai/ReMe` |
| voicebox | SayDo 语音 | 本地语音 I/O 与模型装配是否可对照 pipeline；本轮暂不读代码 | 本地 `Reference/voicebox/README.md:9-72`；origin `https://github.com/jamiepine/voicebox` |

### 15.2 次级 5 个

| 项目 | 相关自有项目 | 后续要验证的问题 | 坐标 |
| --- | --- | --- | --- |
| opentag | SayDo 任务卡 / OWF 收据 | 上下文包与动作收据是否真绑定 source thread；会否变成第二套审批 | `Reference/opentag/README.md:16-28`；`https://github.com/amplifthq/opentag`；站点 `https://opentag.im` |
| synara | ContextView session；OWF worktree | 会话/worktree/handoff 是否可观察；会否引入常驻桌面编排 | `Reference/synara/README.md:3-14`；`https://github.com/Emanuele-web04/synara` |
| codex_manager | OWF 监督状态口径 | 多会话监督是否与 cycle-state 同构还是另一套 GUI | `Reference/codex_manager/README.md:1-9`；`https://github.com/SpecterHi/codex_manager` |
| TokenTracker | SayDo 成本三态；Aindle/YoUsage | usage 与成本边界是否本地、是否造 remaining% | `Reference/TokenTracker` origin `https://github.com/xiufengsun/TokenTracker` |
| autoresearch | 无直接产品对应 | 固定实验预算/可重复度；场景是训练不是软件交付 | `Reference/autoresearch/README.md:1-13`；`https://github.com/karpathy/autoresearch` |

### 15.3 已有调研，不再排首位

deepseek-harness、tailcat、swarm-forge 及 `_borrow-peers` 已有深研。OctoWorkFlow `docs/plan/` 下 swarmforge 文档已覆盖同伴。第一方 Hopper / Aindle / OctoMonitor / YoUsage 先复用自己的现成证据/观察能力，别造第二套。deepseek-harness 本地 README 标明非官方桌面壳；tailcat 是 Tailscale 控制面；swarm-forge origin `https://github.com/unclebob/swarm-forge`。

## 16. 负面案例（不要当成已实现/已验证）

1. README 286 ≠ 官网 261 ≠ 构建器 91。
2. star ≠ npm 下载 ≠ 生产安装质量。
3. `ecc doctor` 无收据 exit 0 ≠ 系统健康。
4. `context_remaining_pct` ≠ 真实 prompt 重建。
5. `trust: unreviewed` 文件被 commit ≠ 已治理规则。
6. ecc2 能编译 ≠ ECC 2.0 GA。
7. changelog “control-plane shipped” ≠ `ecc2/README.md` alpha。
8. `hooks_enabled` default true ≠ 用户已理解六组副作用。
9. 本会话或历史单测绿 ≠ 全仓 `npm test` 绿；缺依赖的红 ≠ 上游回归。
10. GHSA 注释编号 ≠ 已验证公开 advisory。
11. 把 ECC 安装进 `~/.claude` 再扫私人 sessions（本次明确没做）。
12. clone 无 Cargo ≠ 原树没有 Rust 工作；原树有 Cargo ≠ 本任务已验收 WP-02。
13. 历史 ContextView 144/148 记录与本轮新增的 148 项文档门测试分开登记；二者均不代表 ECC overlay 已接入。
14. 四个文档门历史绿 ≠ 未来代码验收。

## 附录 A. E-01..E-110 能力登记（纠正后）

成熟度列保留原文作者分类，**不是**本任务生产验证。纠正注记：E-21 statusline 实读 `context_window.remaining_percentage`，`cost.total_cost_usd` 作为 statusline 输入字段是 comment-only；E-28 命令长度 1,045–2,169 不是 400；E-34 Windows 身份是 128-bit FileId + volume 不是「必须 64 位」；E-44/E-104 与 18 family 交集 7 family/8 根不是「至少 10」；E-109/E-110 为补登记；worktree 路径为 `scripts/worktree-lifecycle.js` + `scripts/lib/worktree-lifecycle/`。

| 编号 | 能力/设计 | 对方位置 | 作者成熟度分类 |
| --- | --- | --- | --- |
| E-01 | 三份长文指南（shortform/longform/security）作为产品的"说明书" | `the-shortform-guide.md`、`the-longform-guide.md`、`the-security-guide.md` | stable |
| E-02 | 能力面选择决策序（rule/skill/MCP/CLI/API） | `docs/capability-surface-selection.md` | doc-only |
| E-03 | MCP 连接器两条准入规则 + 六个被降级连接器的裁决表 | `docs/MCP-CONNECTOR-POLICY.md` | stable（已执行） |
| E-04 | skill 放置与 provenance 策略：curated 入仓、learned/imported 只在用户目录并要求 `.provenance.json` | `docs/SKILL-PLACEMENT-POLICY.md`、`schemas/provenance.schema.json` | stable |
| E-05 | 外来贡献适配策略（复制思想不引依赖、按 ECC 面重命名） | `docs/skill-adaptation-policy.md` | doc-only |
| E-06 | 数据驱动的 harness 适配合规矩阵：记录必填 `id/state/supported_assets/unsupported_surfaces/install_or_onramp/verification_commands/risk_notes/last_verified_at/owner/source_docs`，缺一校验失败；文档表由数据渲染并 `--check` 防漂移 | `scripts/lib/harness-adapter-compliance.js:9-27`、`docs/architecture/harness-adapter-compliance.md` | stable |
| E-07 | 平台支持表把每个 harness 标为 Native / Adapter-backed / Instruction-backed / Reference-only | `docs/architecture/harness-adapter-compliance.md` Compliance States | stable |
| E-08 | 目录计数 CI 强制（README/AGENTS 数字与真实目录不符即红） | `scripts/ci/catalog.js`、`package.json` `catalog:check` | stable |
| E-09 | 陈旧 PR 抢救台账与遗留工件清单（关 PR 不丢工作、保留署名） | `docs/stale-pr-salvage-ledger.md`、`docs/legacy-artifact-inventory.md` | stable |
| E-10 | Living docs governance：constitution / map / status / history 四角色、一事一主、delete-zone | `skills/living-docs-governance/SKILL.md` | doc-only |
| E-11 | 进度同步合同（GitHub / Linear / handoff / roadmap 四源各自角色） | `docs/architecture/progress-sync-contract.md` | doc-only |
| E-12 | 1.x → 2.0 迁移指南（重名插件并存、只走一条安装路径） | `docs/MIGRATION-1X-TO-2.0.md` | stable |
| E-13 | Prompt Defense Baseline 统一前置到 68 个 agent | `agents/*.md` 首段 | stable |
| E-14 | 23 条 hook，覆盖 PreToolUse / PreCompact / SessionStart / PostToolUse / PostToolUseFailure / Stop / SessionEnd；每条有稳定 `id` | `hooks/hooks.json`（`grep -o '"id":'` 得 23 条） | stable |
| E-15 | hook 运行时旋钮：`ECC_HOOKS_ENABLED`、`ECC_HOOK_PROFILE=minimal\|standard\|strict`、`ECC_DISABLED_HOOKS`、`ECC_SESSION_START_MAX_CHARS`、`ECC_SESSION_START_CONTEXT=off` 等 | `hooks/README.md:96-135`、`scripts/hooks/run-with-flags.js` | stable |
| E-16 | 单进程 PostToolUse 调度器（sync/async 两条），避免每个 hook 各起进程 | `scripts/hooks/posttooluse-dispatcher.js`、`hooks/hooks.json` `post:dispatcher:*` | stable |
| E-17 | GateGuard fact-forcing：首次 Edit/Write 先 deny 并要求列出 importer/公共 API/数据 schema/用户原话；破坏性 Bash 每次要求回滚方案；有 exempt glob、denial 次数后折叠 | `scripts/hooks/gateguard-fact-force.js`（1,300 行）、`skills/gateguard/SKILL.md` | stable（A/B 证据仅 n=2） |
| E-18 | config-protection：阻止修改 lint/format 配置（首建放行，大小写不敏感，stat 错误 fail-closed） | `scripts/hooks/config-protection.js:22-60,84-110` | stable |
| E-19 | strategic-compact：用 transcript 最新 `usage`（input + cache_read + cache_creation）算真实上下文占用，在窗口比例阈值（200k 窗 160k、1M 窗 250k）与工具调用计数两个信号上建议 `/compact` | `scripts/hooks/suggest-compact.js`、`skills/strategic-compact/SKILL.md:393-433` | stable |
| E-20 | context monitor：从 metrics bridge 读上下文剩余、成本、文件数、最近 5 次工具环形缓冲，检测"5 次完全相同 tool+参数"循环 | `scripts/hooks/ecc-context-monitor.js:18-28,97-115` | stable |
| E-21 | statusline：读 Claude Code 传入的 stdin JSON，实读字段为 `model.display_name`、`workspace.current_dir`、`session_id`、`context_window.remaining_percentage`（`ecc-statusline.js:101-104`）；成本数字来自 metrics bridge 的 `total_cost_usd`（`ecc-metrics-bridge.js:264`），而 `cost.total_cost_usd` 作为 statusline 输入字段只出现在 `cost-tracker.js:25-27` 的注释里（comment-only 线索）；扣除 16.5% 自动压缩缓冲后画进度条（`:18,44-58`） | `scripts/hooks/ecc-statusline.js`、`scripts/hooks/ecc-metrics-bridge.js`、`scripts/hooks/cost-tracker.js` | stable |
| E-22 | cost tracker：Stop 时汇总 transcript 各 assistant 轮的 `message.usage.{input_tokens,output_tokens,cache_creation_input_tokens,cache_read_input_tokens}` 与 `message.model`；优先采用 statusline 写入的权威 `cost.total_cost_usd`（≤300s 新鲜） | `scripts/hooks/cost-tracker.js:1-70` | stable |
| E-23 | session-end：从 transcript JSONL 抽用户消息/工具/改动文件写会话摘要，过滤 `<local-command-caveat\|system-reminder\|task-notification>` 噪声 | `scripts/hooks/session-end.js:26-90` | stable |
| E-24 | pre-compact：压缩前用 `claude -p haiku` 生成富摘要写入当前 worktree 的 session 文件；按 `**Worktree:**` 头匹配 cwd 防写错项目 | `scripts/hooks/pre-compact.js`、`scripts/lib/llm-summary.js` | stable（transcript 外发到模型） |
| E-25 | session-start：注入最近会话摘要 + 学习到的 skill + instincts（置信度≥0.7、最多 6 条、按项目/栈相关性加权）+ 项目类型，总量封顶 8,000 字符 | `scripts/hooks/session-start.js:32-42,197-260,605-760`、`scripts/lib/instinct-relevance.js` | stable |
| E-26 | governance-capture：PreToolUse/PostToolUse 检测 secret 形态、审批类命令、敏感路径，写 `governance_events` | `scripts/hooks/governance-capture.js:25-54` | beta（需 `ECC_GOVERNANCE_CAPTURE=1`） |
| E-27 | mcp-health-check：PreToolUse 探测 MCP 端点可达性（401/403/404/406 视为存活），失败后标记不健康并退避 | `scripts/hooks/mcp-health-check.js:20-45` | beta |
| E-28 | 每条 hook 内嵌同一段 plugin-root 解析一行式（依次找 `CLAUDE_PLUGIN_ROOT`、`~/.claude`、`~/.claude/plugins/{ecc,ecc@ecc,marketplaces/ecc,…}`、`~/.claude/plugins/cache/{ecc,everything-claude-code}/*/*`） | `hooks/hooks.json` 每个 `command` 字段 | stable（可读性差） |
| E-29 | hook 安装前六类能力披露与单次 consent：automatic-source-writes / command-rewrite-and-process-control / transcript-derived-llm-egress / mcp-network-and-process-activity / automatic-permission-gates / session-observation-and-cost-records | `scripts/lib/install/hook-consent.js:12-36` | stable |
| E-30 | hooks.json schema 校验：事件白名单 18 种（含 `InstructionsLoaded`、`ConfigChange`、`WorktreeCreate/Remove`、`PermissionRequest`、`TeammateIdle`、`TaskCompleted`），类型 command/http/prompt/agent | `scripts/ci/validate-hooks.js:13-35`、`schemas/hooks.schema.json` | stable |
| E-31 | Cursor hook 适配器复用同一批 Node 脚本（DRY adapter） | `.cursor/hooks/adapter.js` 及 17 个事件文件 | beta |
| E-32 | hook bug workaround 页（false Hook Error、早压缩、MCP auth 压缩后失效、hook 不热加载、529） | `docs/hook-bug-workarounds.md` | stable |
| E-33 | Memory Vault `ecc.memory.v1`：Markdown + 严格 JSON 值 frontmatter；`kind` 8 种、`scope` project/team/user、`trust` 只能是 `unreviewed`、`status` active/rejected/superseded；create-only；ID/slug 语法受限；正文 ≤64 KiB | `schemas/memory.schema.json`、`docs/design/ecc-memory-vault.md` | stable |
| E-34 | 写前 secret 形态拒绝、不跟随符号链接、project 作用域 fail-closed `.gitignore`（内容必须恰为 `*\n!.gitignore\n`，否则拒写）、TOCTOU 文件身份守卫（BigInt stat，修复 Windows libuv 卷序列缺陷） | `scripts/lib/memory-vault.js:243-262,319-324`、`scripts/lib/memory-vault-format.js:49,282`、`CHANGELOG.md:24` | stable |
| E-35 | 可选 MCP 服务 `ecc-memory-mcp`：只暴露 save/search/read/doctor；harness 身份由服务端 `ECC_MEMORY_HARNESS` 绑定，调用方不能冒充；user 作用域需 `ECC_MEMORY_ALLOW_USER_SCOPE=1` | `scripts/memory-mcp.mjs`、`README.md:1024-1028` | stable |
| E-36 | 跨 harness handoff 文档（`kind: handoff`，`source_harness` → `target_harnesses`） | `skills/unified-memory/SKILL.md` | stable |
| E-37 | continuous-learning v2.1：PreToolUse/PostToolUse 写 `observations.jsonl`，后台 Haiku observer 归纳 instinct（trigger/confidence 0.3–0.9/domain/evidence），项目作用域按 `git remote origin` URL 哈希（跨机器一致），`/promote` 在 ≥2 项目出现时升全局，`/evolve` 聚类成 skill/command/agent | `skills/continuous-learning-v2/SKILL.md`、`agents/observer.md`、`hooks/observe.sh:137-200` | beta（Windows observer 有 open defect） |
| E-38 | 学习数据放在 `~/.local/share/ecc-homunculus/` 而非 `~/.claude/`，绕开 Claude Code 敏感路径守卫 | `skills/continuous-learning-v2/SKILL.md:139-151` | stable |
| E-39 | 会话文件 `~/.claude/session-data/YYYY-MM-DD-<id>-session.tmp`、别名、保留期清理 | `scripts/lib/session-manager.js`、`scripts/lib/session-aliases.js` | stable |
| E-40 | `ecc.session.v1` 会话快照合同：`schemaVersion` 是唯一兼容闸；`workers[]` 带 state/health/runtime/intent/outputs/artifacts；aggregates 必须与 workers 一致；未知 state 字符串合法；adapter 不得新增顶层字段 | `docs/SESSION-ADAPTER-CONTRACT.md`、`scripts/lib/session-adapters/canonical-session.js:169-255` | stable |
| E-41 | 会话 adapter 四个：dmux-tmux、claude-history（读 ECC 自己的 session.tmp）、codex-worktree（解析 `~/.codex/sessions/**/rollout-*.jsonl`：`session_meta.payload.{id,cwd,originator,cli_version,timestamp}`、`turn_context.payload.model`、首条用户消息若含 `AGENTS.md instructions`/`<cwd>` 视为注入前言）、opencode（`~/.local/share/opencode/storage/session/ses_*.json` + `message/<sid>/msg_*.json` 的 `modelID/providerID`） | `scripts/lib/session-adapters/{registry,codex-worktree,opencode}.js` | stable |
| E-42 | SQLite state store（sql.js）：sessions / skillRuns / skillVersions / decisions / installState / governanceEvents / workItems，JSON Schema 逐实体校验 | `scripts/lib/state-store/`、`schemas/state-store.schema.json` | stable |
| E-43 | skill 运行追踪与健康（`post:skill:track`、`skills-health.js`、skill-evolution/provenance/versioning） | `scripts/lib/skill-evolution/*`、`scripts/hooks/skill-run-tracker.js` | beta |
| E-44 | 15 个安装目标 adapter（claude home/project、cursor、antigravity、codex、gemini、hermes、opencode、openclaw、codebuddy、joycode、kimi、qwen、zed、adal），各自声明根目录与 install-state 路径（Claude 为 `<claude-root>/ecc/install-state.json`） | `scripts/lib/install-targets/registry.js`、`claude-home.js:53` | stable |
| E-45 | 安装态账本 `ecc.install.v1`：`target{id,root,installStatePath}`、`request{profile,modules,…,hookConsent}`、`resolution`、`source{repoVersion,repoCommit,manifestVersion}`、`operations[]{kind,moduleId,sourceRelativePath,destinationPath,strategy,ownership,scaffoldOnly,contentSha256}` | `schemas/install-state.schema.json` | stable |
| E-46 | doctor / repair / uninstall 从账本回放；所有写/删目的地必须落在 adapter 推导的受信根内，不信任状态文件里的路径（GHSA-hfpv-w6mp-5g95）；用 `lstat` 不跟符号链接、父目录身份稳定性检查 | `scripts/lib/path-safety.js:1-14,84-104`、`scripts/lib/install-lifecycle.js:318-560,1386-1530` | stable |
| E-47 | manifest 驱动的选择性安装：modules（带 `cost: light\|medium`、`stability`、`targets`）、profiles（minimal/core/developer/security/research/full）、components；CI 校验每个 path 真实存在 | `manifests/*.json`、`scripts/ci/validate-install-manifests.js` | stable |
| E-48 | 引导式 `npx ecc-universal setup`：安装/更新/移动一个 `ecc@ecc` 插件作用域并记录 hook profile；两条安装路径互斥的显式警告 | `README.md:69-90,192-224`、`scripts/install-guided.js` | stable |
| E-49 | 每 harness 能力表：安装通道、作用域、hooks 模式（`profile-selection` / `native-trust` / `not-configured` / `adapter-configured`） | `scripts/lib/harness-capabilities.js` | stable |
| E-50 | Claude Code 插件安装位置探测：`installed_plugins` manifest → `~/.claude/plugins/{ecc,…}` 平铺 → `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/` | `scripts/harness-audit.js:235-386` | stable |
| E-51 | MCP 清点 `ecc.mcp.v1`：读 Claude `~/.claude.json`/`.mcp.json` 的 `mcpServers{type stdio\|http\|sse,command,args,env,url,disabled}`、Codex `~/.codex/config.toml [mcp_servers.NAME]`、OpenCode `~/.config/opencode/opencode.json mcp{type local\|remote,command[],environment,enabled}`；transport 归一；只保留 env key 名；argv 中 `--flag=secret`/跟在 secret 名旗标后的值/已知前缀（`sk-`、`ghp_`、`github_pat_`、`AIza`、`xox[baprs]-`、Stripe）/高熵值全部脱敏；URL userinfo 与 token 参数脱敏；按 transport+command+args 签名去重并报 `consistent`/DRIFT | `scripts/lib/mcp-inventory/readers/*.js`、`canonical-mcp.js:1-120,160-284` | stable |
| E-52 | 跨工具 capability map 与"AGENTS.md 是通用文件、Copilot 用 .github/copilot-instructions.md"等事实 | `README.md:1594-1616` | stable |
| E-53 | 多 harness 数据隔离 `ECC_AGENT_DATA_HOME`（Cursor 与 Claude 各自 session/skills/metrics 根） | `README.md:1567-1581` | stable |
| E-54 | Codex 原生插件/hook 需显式信任决策；OpenCode 走插件事件；Copilot 只有 instruction 文件 | `README.md:1583-1592` 表 | stable |
| E-55 | harness-audit 记分卡：12 类（Tool Coverage、Context Efficiency、Quality Gates、Memory Persistence、Eval Coverage、Security Guardrails、Cost Efficiency + 4 个部署平台集成），`RUBRIC_VERSION` 冻结，输出总分 | `scripts/harness-audit.js:7-22,947-1010` | stable |
| E-56 | HUD/status 合同 `ecc.hud-status.v1`：context / toolCalls / activeAgents / todos / checks / cost / risk / queueState / sessionControls / sync；缺失字段允许 `null`/`unknown`，消费方不得把缺失渲染成绿 | `docs/architecture/hud-status-session-control.md`、`examples/hud-status-contract.json` | doc-only + 样例 |
| E-57 | observability-readiness 门：只检查仓库文件是否暴露 10 个信号（loop-status、HUD 合同、session-inspect、harness-audit、hook JSONL、ecc2 风险账本、release onramp、progress sync、release safety、package gate） | `scripts/observability-readiness.js:143-342` | stable |
| E-58 | `ecc status --markdown --write status.md` 把 SQLite 状态导出成可移植 handoff | `scripts/status.js` | stable |
| E-59 | Control pane（loopback HTTP + Host/Origin 白名单、只读默认、动作 allowlist、看板 claim/move、TCAS 邻近可视化） | `scripts/control-pane.js`、`scripts/lib/control-pane/*`、`scripts/lib/loopback-guard.js` | beta |
| E-60 | Plan Canvas：浏览器审阅 plan 工件，锚定注释（CSS selector + 文本范围），Approve/Request changes 直接映射 `/plan` 的 CONFIRM 门；会话按 `sha256(realpath)[:12]` 键；deliver-and-drain 反馈；服务器不执行工件内容 | `docs/design/plan-canvas.md`、`scripts/lib/plan-canvas/*` | stable |
| E-61 | Agent proximity（TCAS 类比）：working set 行区间重叠 / 依赖图耦合 / 目录距离三通道 noisy-OR 合成风险，TA/RA 两阈值，确定性让路优先级，3D 可视化 | `docs/design/agent-proximity.md`、`scripts/lib/agent-proximity/*` | beta |
| E-62 | worktree lifecycle 服务（状态分类、冲突与清理计划） | `scripts/lib/worktree-lifecycle/{git,lifecycle}.js`、`scripts/worktree-lifecycle.js` | beta |
| E-63 | tmux + worktree 编排（`orchestrate-worktrees.js`、status/handoff/task 三个 markdown 协调文件） | `scripts/orchestrate-worktrees.js`、`scripts/lib/tmux-worktree-orchestrator.js` | beta |
| E-64 | `orch-*` 编排 skill 家族与 Claude Code 原生 workflow 脚本（review 维度并行 + 对每条 CRITICAL/HIGH 对抗复核） | `skills/orch-*`、`workflows/orch-review.workflow.js` | beta |
| E-65 | loop 设计 skill：四条件准入、机器可判定目标、servo/regulator 分型、plan/build/judge 三角色、judge 独立且 Build 不得改验收条件 | `skills/loop-design-check/SKILL.md` | doc-only |
| E-66 | eval-harness：capability/regression 两类 eval，code/model/human 三种 grader，pass@k 与 pass^k 指标 | `skills/eval-harness/SKILL.md` | doc-only |
| E-67 | skill-comply：自动生成三档提示强度（supportive/neutral/competing）的场景，用 `claude -p` stream-json 抓工具调用序列，LLM 分类 + 时序判定，报告合规率 | `skills/skill-comply/SKILL.md` | beta（Python 脚本） |
| E-68 | council + council-multi-model：四视角合成后可选一次外部 Codex 批判；Codex 只接受精确测试过的 CLI 0.146.0，禁 shell/文件/浏览器/MCP/技能，空临时目录，有"目录外哨兵文件不可读"的对抗集成测试 | `skills/council-multi-model/SKILL.md:78-125` | stable |
| E-69 | ecc2 Rust 控制面：SQLite session store、daemon 心跳/崩溃会话标记/定时任务/远程派发/自动合并与清理、工具调用风险评分（base tool + 文件敏感度 + 爆炸半径 + 不可逆 → Allow/Review/RequireConfirmation/Block）、harness-eval（配置候选按 canonical JSON SHA-256 寻址、触发器禁止改删审计行、晋升需最少样本/均值差/胜率） | `ecc2/src/{main,session/daemon,observability/mod,harness_eval}.rs`、`ecc2/README.md` | alpha（README 明说非 GA） |
| E-70 | 上下文预算审计 skill：agents 描述进每次 Task 上下文、每个 MCP tool schema 约 500 token、`words×1.3`/`chars/4` 估算、>10 MCP 或 >80 tool 报警 | `skills/context-budget/SKILL.md` | doc-only |
| E-71 | token 优化建议：`model=sonnet`、`MAX_THINKING_TOKENS=10000`、`CLAUDE_CODE_SUBAGENT_MODEL=haiku`、`CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`（社区报告行为不一致）、`ENABLE_TOOL_SEARCH=auto:5` | `docs/token-optimization.md`、`docs/hook-bug-workarounds.md:60-66` | doc-only |
| E-72 | 安全指南：以 CVE-2025-59536 / CVE-2026-21852 说明"项目配置、hooks、MCP 设置、环境变量都是执行面"；最小要求清单（分离身份、短期凭据、容器、默认拒出网、限制 secret 路径读、清洗输入、审批边界、日志、进程组 kill 与心跳、记忆窄而可丢弃、扫描 skill/hook/MCP） | `the-security-guide.md` | stable |
| E-73 | 供应链 IOC 扫描：恶意包版本表、payload 哈希、C2 域名、以及 agent 配置持久化指标（`.claude/settings.json`、`.vscode/tasks.json`、`.zed/tasks.json`、`gh-token-monitor` LaunchAgent/systemd） | `scripts/ci/scan-supply-chain-iocs.js:14-60,230-240,355-420`、`docs/security/supply-chain-incident-response.md` | stable |
| E-74 | 每 6 小时只读供应链 watch workflow + 事件响应 runbook | `.github/workflows/supply-chain-watch.yml`、`docs/security/supply-chain-incident-response.md` | stable |
| E-75 | GitHub Actions 安全校验：`pull_request_target`/`workflow_run` 不得 checkout 不受信 head、`refs/pull/*` ref 检测、写权限时 `persist-credentials` 检查、`npm ci --ignore-scripts`、`actions/cache` 与 `id-token: write` 组合 | `scripts/ci/validate-workflow-security.js:12-70` | stable |
| E-76 | 个人路径泄露校验（Unix/Windows 家目录名占位符（ECC 源码允许 `<name>` 等占位，禁止真实用户名），允许占位符） | `scripts/ci/validate-no-personal-paths.js` | stable |
| E-77 | Unicode 安全校验：Extended_Pictographic 与 Regional_Indicator 全禁（允许 ©®™，`:57-70`）；另有 `isDangerousInvisibleCodePoint` 禁零宽/双向/变体选择符/Tag 块（U+200B–200D、U+2060、U+FEFF、U+202A–202E、U+2066–2069、U+FE00–FE0F、U+E0100–E01EF、U+E0000–E007F，`:113-130`）；`--write` 把常见符号改写为 `WARNING:`/`PASS:`/`FAIL:`。注意 `schemas/memory.schema.json:35,108` 只禁 C0/C1 与双向控制字符，零宽集合只在此脚本 | `scripts/ci/check-unicode-safety.js` | stable |
| E-78 | 原子写（`wx` 打开 + fsync + rename，0600） | `scripts/lib/atomic-write.js` | stable |
| E-79 | loopback 服务 Host/Origin 白名单（防 DNS rebinding） | `scripts/lib/loopback-guard.js` | stable |
| E-80 | 只从官方源安装的警告、SECURITY.md 列出全部官方分发面与响应 SLA | `README.md:65-66`、`SECURITY.md` | stable |
| E-81 | AgentShield（独立仓）：扫描 hooks/MCP/权限/secret/agent 文件 | `skills/security-scan/SKILL.md`、`README.md:2005-2040` | 外部 |
| E-82 | `safety-guard` skill：careful / freeze / guard 三模式（破坏命令拦截、目录冻结） | `skills/safety-guard/SKILL.md` | doc-only |
| E-83 | AURA 信任检查 adapter 的诚实威胁模型（verdict 只是回望信号，不是动作安全） | `integrations/aura/THREAT_MODEL.md` | stable |
| E-84 | CI 矩阵：ubuntu/windows/macos × Node 18/20/22 × npm/pnpm/yarn/bun（Windows 排除 bun）；`--ignore-scripts` 安装；失败上传 tests/ | `.github/workflows/ci.yml:18-100` | stable |
| E-85 | 用精确打包的 `ecc-universal-*.tgz` 在三 OS 跑安装 → doctor → repair → uninstall 生命周期 | `.github/workflows/ci.yml:102-160`、`tests/ci/packed-artifact-lifecycle.js` | stable |
| E-86 | 组件校验器：agents/hooks/commands/skills/install-manifests/rules/workflow-security/catalog/command-registry/unicode/personal-paths | `scripts/ci/*.js`、`.github/workflows/ci.yml:162-215` | stable |
| E-87 | 自写 mini test runner（`tests/run-all.js` 逐文件 spawn，剥离 `GIT_DIR` 等继承变量防 hook 内跑测试劫持宿主仓） | `tests/run-all.js:74-84`、`tests/lib/helpers/mini-test-runner.js` | stable |
| E-88 | 覆盖率门 c8 80%（lines/functions/statements）/79%（branches） | `package.json` `coverage` | stable |
| E-89 | 发布纪律：tag 必须恰在 `origin/main`、npm 注册表错误 fail-closed、先发 staging dist-tag 校验字节后再升 `latest` | `CHANGELOG.md:20` | stable |
| E-90 | Python 侧 ruff + mypy + pytest（`src/llm` provider 抽象） | `.github/workflows/ci.yml` python-tests、`src/llm/core/interface.py` | stable |
| E-91 | 回归测试锁定历史坑：plugin.json 不得声明 `hooks` 字段（#29/#52/#103 反复回退） | `README.md:1990-2001` | stable |
| E-92 | Windows 特殊处理：App Execution Alias 的 python 桩检测、`USERPROFILE`、`.cmd` shim | `hooks/observe.sh:43-70`、`CHANGELOG.md:46` | stable |
| E-93 | 业务/内容/金融/家庭实验室/科研等非 coding skill 域（brand-voice、investor-outreach、ito-*、homelab-*、scientific-*） | `skills/` 目录 | 各异 |
| E-94 | ECC Tools GitHub App（Pro 计费）、Discord bot、Linear 同步、Itô compute RFQ bridge | `README.md`、`scripts/discord/`、`scripts/ito.js` | 外部/商业 |
| E-95 | Tkinter 桌面 dashboard 与 web dashboard | `ecc_dashboard.py`、`scripts/dashboard-web.js` | beta |
| E-96 | 12 种翻译的 docs 树 | `docs/{zh-CN,ja-JP,…}` | stable |
| E-97 | npm `welcome` 脚本输出赞助商链接 | `package.json` `scripts.welcome` | stable |
| E-98 | Codex 原生 hook 文件形态：`hooks/codex-hooks.json` 只有 `SessionStart`，命令依赖 Codex 注入的 `PLUGIN_ROOT` 环境变量再映射为 `CLAUDE_PLUGIN_ROOT` | `hooks/codex-hooks.json:1-20` | beta |
| E-99 | Codex 项目级配置旋钮：`approval_policy`、`sandbox_mode`、`web_search`、`notify`、`persistent_instructions`（追加到每个 prompt）、`model_instructions_file`（替换内置指令而非 AGENTS.md）、`[mcp_servers.*]`；多 agent 角色 TOML（`model`、`model_reasoning_effort`、`sandbox_mode`、`developer_instructions`） | `.codex/config.toml:18-36,97-102`、`.codex/agents/reviewer.toml:1-9` | stable（参考配置） |
| E-100 | `.agents/` 根：Antigravity 安装目标（`rootSegments: ['.agents']`）下放 `skills/` 与 `plugins/marketplace.json`；Codex 也从 `.agents/skills` 读取打包副本 | `scripts/lib/install-targets/antigravity-project.js:24`、`.agents/` | stable |
| E-101 | Claude Code 插件 manifest 校验器的未公开约束（`version` 必填等），基于真实安装失败整理 | `.claude-plugin/PLUGIN_SCHEMA_NOTES.md:1-30` | stable（经验文档） |
| E-102 | agent 定义 frontmatter 语法约束：`REQUIRED_FIELDS = ['model','tools']`，`VALID_MODELS = ['haiku','sonnet','opus']`，BOM 剥离 | `scripts/ci/validate-agents.js:10-14` | stable |
| E-103 | OpenCode 项目布局：`opencode.json` 的 `plugin` / `instructions` / `agent` / `command` 条目与 `.opencode/{commands,prompts,instructions,plugins,tools}` 目录；npm 插件只挂 hook/事件与自定义工具，不自动注册目录 | `.opencode/README.md:30-45`、`.opencode/opencode.json` | beta |
| E-104 | 15 个安装目标的配置根（用户目录或项目目录下）：`.claude`、`.codex`、`.cursor`、`.agents`、`.gemini`、`.hermes`、`.config/opencode`、`.openclaw`、`.codebuddy`、`.joycode`、`.kimi-code`、`.qwen`、`.zed`、`.adal` | `scripts/lib/install-targets/*.js` `rootSegments` | stable |
| E-105 | 项目级 Claude Code 配置位置被当作 hooks/MCP 面：`.claude/settings.json`、`.claude/settings.local.json`、`.mcp.json` | `scripts/harness-audit.js:824,848,867-870,937` | stable |
| E-106 | 拦截 git hook 绕过：`--no-verify` 与 `-c core.hooksPath=`，覆盖 commit/push/merge/cherry-pick/rebase/am 等子命令；退出码 2 阻断 | `scripts/hooks/block-no-verify.js:1-30` | stable |
| E-107 | heredoc 被动 sink 的 fail-closed 判别：只有形如 `cat <<EOF`（无 `; & \| ( ) \``）才视为已证明的被动 sink，其他形态保留原文进入破坏性检查 | `scripts/hooks/gateguard-heredoc.js:1-25` | stable |
| E-108 | Cursor hooks 事件语法：`sessionStart`、`sessionEnd`、`beforeShellExecution`、`afterShellExecution`、`beforeMCPExecution`、`afterMCPExecution`、`beforeReadFile`、`beforeTabFileRead`、`afterFileEdit`、`afterTabFileEdit`、`beforeSubmitPrompt`、`preCompact`、`stop`、`subagentStart`、`subagentStop`（`version: 1`） | `.cursor/hooks.json` | beta |
| E-109 | Codex native plugin 三件套：`.codex-plugin/plugin.json` 绑定 `skills: ./skills/`、`mcpServers: ./.mcp.json`（仅 `chrome-devtools`）、`hooks: ./hooks/codex-hooks.json`（仅 `SessionStart`）；README 要求新会话在 `/hooks` 显式审查并信任，定义 hash 变更需再审；`harness-capabilities.js` 把 codex 标 `channel/installMode = native-plugin`、`native-trust`，`guidedReady` 仅 claude/codex/kimi；legacy `scripts/sync-ecc-to-codex.sh` 与 `.codex/config.toml` 六 MCP（github/context7/exa/memory/playwright/sequential-thinking）是另一列 | `.codex-plugin/plugin.json`、`.codex-plugin/README.md:20,65-73`、`.mcp.json`、`.codex/config.toml:41-68`、`scripts/lib/harness-capabilities.js:36-38,54-64,76` | stable（未在真实 Codex 会话触发） |
| E-110 | fail-open 缺省：Claude plugin `userConfig.hooks_enabled.default = true`；`ECC_HOOKS_ENABLED` 缺省 true；`check-hook-enabled.js` 缺 `hookId` 时输出 `yes` 并 exit 0；`ecc-metrics-bridge.js` 读成本文件失败时 "failing open"；`doctor.js` 无 install-state 时 `results=[]` 且退出码 0 | `.claude-plugin/plugin.json:26-30`、`scripts/lib/hook-flags.js:6,66-67`、`scripts/hooks/check-hook-enabled.js:6-8`、`scripts/hooks/ecc-metrics-bridge.js:201`、`scripts/doctor.js:60,111` | stable |

## 附录 B. 118 条 legacy source ID

来源：`research/ecc/evidence-index.json` 的 `sources[]`。claim 为历史事实摘要。路径/行范围本轮机械存在检查通过，不等于每条 claim 本轮重新独立复核。

| ID | 项目 | 坐标 | 事实摘要 |
| --- | --- | --- | --- |
| `e-version` | ecc | `VERSION:1-1` | 本地 VERSION 为未发布 2.2.1 |
| `e-pkg-ver` | ecc | `package.json:1-4` | npm 包名 ecc-universal 版本 2.2.1 |
| `e-pkg-bin` | ecc | `package.json:33-38` | license MIT；homepage GitHub |
| `e-pkg-deps` | ecc | `package.json:2-4` | description 自称跨 harness OS |
| `e-pkg-runtime-deps` | ecc | `package.json:479-485` | runtime 依赖 toml/ajv/js-yaml/sql.js |
| `e-license` | ecc | `LICENSE:1-13` | MIT Copyright 2026 Affaan Mustafa |
| `e-readme-counts` | ecc | `README.md:165-174` | README 宣称 68 agents / 286 skills / 94 commands |
| `e-readme-official` | ecc | `README.md:66-68` | 官方安装通道 WARNING |
| `e-eccjs-commands` | ecc | `scripts/ecc.js:9-106` | CLI 子命令表含 setup/install/doctor/memory/control-pane/ito |
| `e-eccjs-dryrun` | ecc | `scripts/ecc.js:212-214` | --dry-run 只设置 ECC_DRY_RUN=1 |
| `e-eccjs-spawn` | ecc | `scripts/ecc.js:264-290` | 子命令 spawnSync 到独立脚本 |
| `e-caps-guided` | ecc | `scripts/lib/harness-capabilities.js:31-50` | Claude guidedReady true |
| `e-caps-codex` | ecc | `scripts/lib/harness-capabilities.js:54-68` | Codex channel=native-plugin；hooks.mode=native-trust |
| `e-caps-kimi` | ecc | `scripts/lib/harness-capabilities.js:70-85` | Kimi guided 但 hooks 未配置 |
| `e-caps-cursor` | ecc | `scripts/lib/harness-capabilities.js:87-103` | Cursor advanced + adapter hooks |
| `e-caps-list-end` | ecc | `scripts/lib/harness-capabilities.js:217-243` | Hermes/OpenClaw advanced；能力表在此结束 |
| `e-targets` | ecc | `scripts/lib/install-manifests.js:8-8` | SUPPORTED_INSTALL_TARGETS 15 项 |
| `e-profiles` | ecc | `manifests/install-profiles.json:1-12` | minimal profile 不含 hooks-runtime |
| `e-profiles-full` | ecc | `manifests/install-profiles.json:73-80` | full profile 描述为全部已分类 modules |
| `e-path-safety` | ecc | `scripts/lib/path-safety.js:6-14` | install-state 不可信；引用 GHSA-hfpv-w6mp-5g95 |
| `e-path-assert` | ecc | `scripts/lib/path-safety.js:81-104` | assertWithinTrustedRoot fail-closed |
| `e-atomic` | ecc | `scripts/lib/atomic-write.js:7-35` | 临时文件 wx+fsync+rename |
| `e-install-state-schema` | ecc | `scripts/lib/install-state.js:91-93` | schemaVersion 必须 ecc.install.v1 |
| `e-install-state-ops` | ecc | `scripts/lib/install-state.js:186-211` | operation 必须含 ownership 与可选 contentSha256 |
| `e-managed-ops` | ecc | `scripts/lib/install-lifecycle.js:121-123` | doctor/repair 只回放 ownership=managed |
| `e-hook-consent` | ecc | `scripts/lib/install/hook-consent.js:12-36` | hooks 六组能力披露 |
| `e-doctor-cli` | ecc | `scripts/doctor.js:8-15` | doctor 诊断 install-state 漂移 |
| `e-doctor-empty` | ecc | `scripts/doctor.js:89-111` | 无问题 exit 0；有 issue exit 1 |
| `e-uninstall` | ecc | `scripts/uninstall.js:13-22` | uninstall 只删 install-state 记录的 managed 文件 |
| `e-autoupdate` | ecc | `scripts/auto-update.js:12-18` | auto-update pull 最新并按原 request 重装 |
| `e-mem-trust` | ecc | `scripts/lib/memory-vault-format.js:5-18` | ecc.memory.v1；trust 仅 unreviewed |
| `e-mem-cli-safety` | ecc | `scripts/memory.js:71-77` | 工具记忆永远 unreviewed；create-only；拒凭据形态 |
| `e-mem-roots` | ecc | `scripts/lib/memory-vault.js:59-71` | project/team 在仓内 .ecc/memory；user 在 ~/.ecc/memory |
| `e-mem-gitignore` | ecc | `scripts/lib/memory-vault.js:37-37` | PROJECT_MEMORY_GITIGNORE fail-closed 模板 |
| `e-mem-schema-json` | ecc | `schemas/memory.schema.json:54-60` | JSON Schema trust 枚举仅 unreviewed |
| `e-mem-design` | ecc | `docs/design/ecc-memory-vault.md:15-27` | markdown 真相；不静默变规则；create-only |
| `e-hook-flags` | ecc | `scripts/lib/hook-flags.js:5-8` | ECC_HOOKS_ENABLED 缺省 true |
| `e-hook-empty-id` | ecc | `scripts/hooks/check-hook-enabled.js:7-10` | 缺 hookId 打印 yes 并 exit 0 |
| `e-plugin-default` | ecc | `.claude-plugin/plugin.json:25-37` | hooks_enabled default true；hook_profile standard |
| `e-hooks-events` | ecc | `hooks/hooks.json:1-12` | PreToolUse Bash dispatcher |
| `e-session-start-instinct` | ecc | `scripts/hooks/session-start.js:35-40` | instinct 缺省阈值 0.7、最多注入 6 |
| `e-instinct-boost` | ecc | `scripts/lib/instinct-relevance.js:22-28` | 项目/栈 boost 0.25/0.2 可压过更高全局 confidence |
| `e-statusline-ctx` | ecc | `scripts/hooks/ecc-statusline.js:104-117` | 转播 context_window.remaining_percentage |
| `e-monitor-ctx` | ecc | `scripts/hooks/ecc-context-monitor.js:18-30` | context 35/25 阈值；loop 需 5 次全同 |
| `e-metrics-failopen` | ecc | `scripts/hooks/ecc-metrics-bridge.js:199-205` | 读成本失败 fail-open |
| `e-precompact` | ecc | `scripts/hooks/pre-compact.js:1-12` | compact 前写 LLM 摘要；失败降级 |
| `e-session-schema` | ecc | `scripts/lib/session-adapters/canonical-session.js:7-10` | ecc.session.v1 |
| `e-session-registry` | ecc | `scripts/lib/session-adapters/registry.js:35-42` | 默认 claude-history/dmux/codex-worktree/opencode |
| `e-mcp-redact` | ecc | `scripts/lib/mcp-inventory/canonical-mcp.js:3-9` | secret 值不进 canonical；只留 env 键名 |
| `e-mcp-policy` | ecc | `docs/MCP-CONNECTOR-POLICY.md:1-18` | 默认只 chrome-devtools |
| `e-mcp-codex-toml` | ecc | `scripts/lib/mcp-inventory/readers/codex.js:7-25` | Codex MCP 用 @iarna/toml，缺依赖则降级解析器 |
| `e-worktree` | ecc | `scripts/lib/worktree-lifecycle/lifecycle.js:7-25` | worktree 状态机含 dirty 永不自动 GC |
| `e-worktree-gc` | ecc | `scripts/lib/worktree-lifecycle/lifecycle.js:149-150` | cleanup 只计划 merged 或 stale-clean |
| `e-loopback` | ecc | `scripts/lib/loopback-guard.js:3-10` | loopback Host 门防 DNS rebinding |
| `e-cp-server` | ecc | `scripts/lib/control-pane/server.js:36-40` | control-pane 默认 127.0.0.1:8765 |
| `e-cp-sqljs` | ecc | `scripts/lib/control-pane/state.js:7-13` | control pane 依赖 sql.js；默认 DB 在 ~/.claude |
| `e-cp-entry` | ecc | `scripts/control-pane.js:24-40` | 可 read-only；macOS 可 open 浏览器 |
| `e-ecc2-readme` | ecc | `ecc2/README.md:1-6` | ecc2 自称为 alpha 非 GA |
| `e-ecc2-cargo` | ecc | `ecc2/Cargo.toml:1-8` | Rust crate ecc-tui 0.1.0 MIT |
| `e-ecc2-eval` | ecc | `ecc2/README.md:73-87` | harness-eval 仅本地 recorded measurements |
| `e-cross-harness` | ecc | `docs/architecture/cross-harness.md:22-32` | 上游文档仍写 Codex hooks 为 instruction-backed；与当前 native plugin 实现漂移 |
| `e-compliance` | ecc | `docs/architecture/harness-adapter-compliance.md:36-40` | Claude Native；矩阵由脚本渲染 |
| `e-token-opt` | ecc | `docs/token-optimization.md:25-32` | 推荐默认 sonnet/haiku 降档 |
| `e-security-unofficial` | ecc | `SECURITY.md:67-72` | 点名非官方 npm 包 |
| `e-changelog-220` | ecc | `CHANGELOG.md:5-12` | 2.2.0 发布节；guided setup 与所有权 |
| `e-selective-design` | ecc | `docs/SELECTIVE-INSTALL-DESIGN.md:19-32` | 可组合安装而非 all-or-nothing |
| `e-session-contract` | ecc | `docs/SESSION-ADAPTER-CONTRACT.md:10-20` | session snapshot 为观测合同 |
| `e-llm-main` | ecc | `src/llm/__main__.py:1-6` | src/llm 是独立 Python CLI 入口 |
| `e-registry-adapters` | ecc | `scripts/lib/install-targets/registry.js:18-34` | 15 个 install target adapter 列表 |
| `s-plan2-chain` | saydo | `docs/plan/IMPLEMENTATION-PLAN-2.md:22-26` | 唯一串行链 PROC-01 到 owner-stop |
| `s-handoff-ptr` | saydo | `HANDOFF.md:49-58` | schedule-pointer next=PG-01B last_closed=PROC-01 |
| `s-trust` | saydo | `docs/09-data-contracts.md:423-431` | Trust 词表与 candidate→trusted 写路径 |
| `s-gate0` | saydo | `docs/05-roadmap.md:63-75` | Gate 0 六类缺口不关闭不得 dispatch |
| `s-memory-mod` | saydo | `docs/modules/b-memory.md:15-19` | 记忆账本 candidate 闸与 M0 边界 |
| `s-adr005` | saydo | `docs/adr/design/ADR-005-execution-single-route.md:7-12` | 生产执行路线仅 Tier1 |
| `s-cli-preview` | saydo | `packages/cli/README.md:18-24` | 公开包仅 daemon+console 不含 pipeline |
| `s-agents-hard` | saydo | `AGENTS.md:1-12` | canonical 与 PLAN-2 分界 |
| `s-dsh-no-replace` | saydo | `docs/plan/2026-08-13-deepseek-harness-borrowing-assessment.fable.md:12-14` | DSH 不替换 Hopper/daemon |
| `s-c-bridge` | saydo | `docs/modules/c-control-bridge.md:1-6` | 执行域 Hopper、对话域 daemon |
| `c-agents-scope` | contextview | `AGENTS.md:7-8` | 当前阶段无产品运行时 |
| `c-oracles` | contextview | `AGENTS.md:37-42` | 仅两 oracle；cutoff 2026-09-04；禁止 MVP 裁剪 |
| `c-readme` | contextview | `README.md:1-12` | Contexpect 规范已冻结尚未实施运行时 |
| `c-facets` | contextview | `docs/architecture/data-and-truth-model.md:7-18` | 六个 facet 互不蕴含 |
| `c-f01` | contextview | `docs/requirements/2026-09-04-contexpect-complete-product-requirements.md:418-428` | F-01 配置残留不是可运行安装 |
| `c-f08` | contextview | `docs/requirements/2026-09-04-contexpect-complete-product-requirements.md:491-498` | F-08 Doctor 确定性规则；LLM 不能单独红 CI |
| `c-f12` | contextview | `docs/requirements/2026-09-04-contexpect-complete-product-requirements.md:562-573` | F-12 importer 不得补造未暴露事件 |
| `c-wp01` | contextview | `docs/process/implementation-plan.md:43-59` | WP-01 本阶段只交付文档与合同 |
| `c-compat` | contextview | `acceptance/compatibility-matrix.yaml:16-27` | Codex macOS live_status installed；fabricated_native_evidence false |
| `c-license` | contextview | `LICENSE:1-3` | Apache-2.0 |
| `e-pkg-bin-map` | ecc | `package.json:439-446` | bin 入口 ecc/ecc-universal/ecc-control-pane/ecc-memory-mcp |
| `e-pkg-sqljs` | ecc | `package.json:480-484` | sql.js 为 runtime 依赖 |
| `e-modules-count` | ecc | `manifests/install-modules.json:1-8` | install-modules version 与首个 module 列表开头 |
| `s-agents-emoji` | saydo | `AGENTS.md:60-72` | 硬规则零 emoji、Gate0、S3、契约不分叉 |
| `c-f09-authority` | contextview | `docs/requirements/2026-09-04-contexpect-complete-product-requirements.md:500-512` | F-09 ProjectionAuthority 不含 ECC |
| `c-docs-index` | contextview | `docs/README.md:1-8` | 文档集状态：规范尚未实施运行时 |
| `e-codex-plugin-manifest` | ecc | `.codex-plugin/plugin.json:22-25` | Codex native plugin 绑定 skills/、.mcp.json、hooks/codex-hooks.json |
| `e-codex-hooks-sessionstart` | ecc | `hooks/codex-hooks.json:1-17` | Codex native hook 仅登记 SessionStart command；Claude profile 分离 |
| `e-codex-plugin-readme-trust` | ecc | `.codex-plugin/README.md:64-74` | plugin 安装不授权 hook；须 /hooks 显式审查并按定义 hash 信任 |
| `e-codex-plugin-readme-legacy` | ecc | `.codex-plugin/README.md:80-87` | legacy sync-ecc-to-codex.sh 单列，非 native plugin / marketplace |
| `e-mcp-json-native` | ecc | `.mcp.json:1-7` | Codex native 默认 MCP 仅 chrome-devtools |
| `e-claude-plugin-mcp-empty` | ecc | `.claude-plugin/plugin.json:39-39` | Claude plugin mcpServers 为空对象，不得推广为 Codex native |
| `e-codex-legacy-toml-mcp` | ecc | `.codex/config.toml:41-71` | legacy Codex 参考配置仍列六 MCP 服务器兼容层 |
| `e-cross-harness-native-caveat` | ecc | `docs/architecture/cross-harness.md:143-145` | 同文档仍写 Codex hook parity instruction-backed unless native surface exists |
| `e-compliance-codex` | ecc | `docs/architecture/harness-adapter-compliance.md:40-40` | compliance 矩阵仍标 Codex Instruction-backed，与 capabilities 实现漂移 |
| `c-field-map-relpath` | contextview | `scripts/contexpect_contract.py:1641-1642` | field-to-claim 路径合同固定为 {family_id}-{surface}.yaml |
| `c-field-map-foreign` | contextview | `scripts/check_acceptance.py:216-253` | 额外 field-to-claim 文件报 foreign/extra/count 三重失败 |
| `c-field-map-schema-path` | contextview | `scripts/contexpect_schema.py:484-503` | field map 路径必须等于 family_id-surface 合同路径 |
| `c-field-map-negtest` | contextview | `tests/acceptance/test_false_greens.py:735-763` | 负例锁定 extra foreign field-map 失败 |
| `c-corpus-license-gate` | contextview | `scripts/check_acceptance.py:740-748` | development static fixture 强制 license==Apache-2.0 |
| `c-corpus-required-fields` | contextview | `scripts/contexpect_contract.py:32-36` | CUTOFF 固定；LICENSE_ID=Apache-2.0 |
| `c-corpus-fixture-fields` | contextview | `scripts/contexpect_contract.py:449-460` | corpus fixture 必填 license/digest/live_tested，无再分发字段 |
| `c-prd-corpus-third-party` | contextview | `docs/requirements/2026-09-04-contexpect-complete-product-requirements.md:1007-1013` | 第三方配置须记录来源、许可、再分发、脱敏与 digest |
| `s-classify-import` | saydo | `packages/daemon/src/memory/classify.ts:23-74` | import 属第三方 kind，分类器返回 candidate；M0 抛错；requestedTrust 先于第三方检查 |
| `s-ledger-no-self-trust` | saydo | `packages/daemon/src/memory/ledger.ts:88-116` | Ledger.add 经 classify 决定 trust，不信调用方自报（除 user_stated/approved） |
| `s-compiler-third-party-exclude` | saydo | `packages/daemon/src/memory/compiler.ts:89-108` | third_party 默认全排除；M0 拒非 user_stated/approved 与 taint |
| `s-compiler-candidate-annotate` | saydo | `packages/daemon/src/memory/compiler.ts:181-197` | candidate 非 M0 只读标注 [候选未确认]；taint 一并标注 |
| `s-approve-candidate` | saydo | `packages/daemon/src/memory/growth.ts:78-97` | 人确认 approveCandidate：user_approved 新事件 supersedes 候选 |
| `s-pack-trust-order` | saydo | `docs/09-data-contracts.md:524-524` | 编译优先级 candidate 只读标注，third_party 默认排除 |

## 附录 C. 12 条历史测试（当前未复跑）

来源：同一 evidence-index 的 `tests[]`。保留真实 exit_code / summary / log SHA。包装进程 exit 0 不代表子测试全绿。ContextView 六门结果是当时快照仓/工作树的文档门，不是本轮复跑，也不得给未来代码验收背书。

| name | command（摘要） | exit | summary | log_file | log_sha256 |
| --- | --- | --- | --- | --- | --- |
| `ecc-help-catalog-doctor-memory-isolated` | `HOME=/tmp/ecc-research-20260905-home node scripts/ecc.js --help; node scripts/ecc.js catalog profiles; node scripts/doctor.js --json; node scripts/memory.js doctor --json; node ...` | 0 | 隔离 HOME 下 help/catalog/doctor 空收据/memory doctor 空仓/memory init 均 exit 0；未安装到用户配置。包装脚本后半因 zsh 未分词未跑单测。 | `ecc-offline-tests-20260905.log` | `982a273a816af49e0ef9e266b8622ed0f2dd543a4665b71f7b0901fd4af1432e` |
| `ecc-unit-subset-no-npm-install` | `HOME=/tmp/ecc-research-20260905-home node tests/lib/{path-safety,memory-vault,install-state,hook-consent,loopback-guard,harness-capabilities,session-adapters,mcp-inventory,workt...` | 0 | exit_code=0 是包装进程的实际退出码，不代表子测试通过。包装脚本未传播子测试失败；聚合状态为 failed，失败子文件有 mcp-inventory.test.js（exit 1，18 passed/2 failed，缺 toml）和 ecc.test.js（exit 1，16 passed/6 failed，缺 ajv/sql.js）。其余 14 个文件 Failed 0。个别子进程退出码见下面单独记录；未 npm install。 | `ecc-unit-tests-20260905.log` | `13df73276909a2d8fec4ad921db5292b48a4a8e4b61139e528de22963a151863` |
| `ecc-path-safety-unit` | `node tests/lib/path-safety.test.js` | 0 | Passed 12 Failed 0 | `ecc-unit-tests-20260905.log` | `13df73276909a2d8fec4ad921db5292b48a4a8e4b61139e528de22963a151863` |
| `ecc-memory-vault-unit` | `node tests/lib/memory-vault.test.js` | 0 | Passed 35 Failed 0；含 gitignore fail-closed | `ecc-unit-tests-20260905.log` | `13df73276909a2d8fec4ad921db5292b48a4a8e4b61139e528de22963a151863` |
| `ecc-mcp-inventory-unit` | `node tests/lib/mcp-inventory.test.js` | 1 | 18 passed 2 failed：Codex TOML 与 merge 计数；环境无 @iarna/toml | `ecc-unit-tests-20260905.log` | `13df73276909a2d8fec4ad921db5292b48a4a8e4b61139e528de22963a151863` |
| `ecc-router-unit` | `node tests/scripts/ecc.test.js` | 1 | 16 passed 6 failed：install/control-pane/session-inspect/work-items 缺 ajv/sql.js | `ecc-unit-tests-20260905.log` | `13df73276909a2d8fec4ad921db5292b48a4a8e4b61139e528de22963a151863` |
| `contextview-docs-structure` | `python3 scripts/check_docs.py` | 0 | PASS；root files 10；canonical docs 22 | `contextview-gates-20260905.log` | `5417b033c60d7320f6eb45536b2788a12d7fa6d43e56d6cb1a6441c30e0bdc56` |
| `contextview-acceptance-structure` | `python3 scripts/check_acceptance.py --structure` | 0 | PASS | `contextview-gates-20260905.log` | `5417b033c60d7320f6eb45536b2788a12d7fa6d43e56d6cb1a6441c30e0bdc56` |
| `contextview-traceability` | `python3 scripts/check_acceptance.py --traceability` | 0 | 249 statements = 249 rows PASS | `contextview-gates-20260905.log` | `5417b033c60d7320f6eb45536b2788a12d7fa6d43e56d6cb1a6441c30e0bdc56` |
| `contextview-corpus` | `python3 scripts/check_acceptance.py --corpus` | 0 | 19/19 static coordinates；2 declared oracles；589 doctor cases PASS | `contextview-gates-20260905.log` | `5417b033c60d7320f6eb45536b2788a12d7fa6d43e56d6cb1a6441c30e0bdc56` |
| `contextview-semantic-team` | `python3 scripts/check_semantic_team.py` | 0 | PASS；16 scenarios；5 malformed fixtures | `contextview-gates-20260905.log` | `5417b033c60d7320f6eb45536b2788a12d7fa6d43e56d6cb1a6441c30e0bdc56` |
| `contextview-validator-negative-tests` | `TMPDIR=/tmp python3 -m unittest discover -s tests/acceptance -p 'test_*.py'` | 0 | Ran 144 tests in 89.595s OK | `contextview-gates-20260905.log` | `5417b033c60d7320f6eb45536b2788a12d7fa6d43e56d6cb1a6441c30e0bdc56` |

标签：**历史会话实测，当前未复跑。** `ecc-unit-subset-no-npm-install` 的 exit_code=0 是包装进程退出码；聚合失败见 `ecc-mcp-inventory-unit` 与 `ecc-router-unit`。ContextView 六门是当时快照仓记录（负例 `Ran 144 tests`），另一会话工作树曾报 148，两者属于旧记录；本轮另行执行的 148 项测试及日志摘要见最终交付证据，不复用本表日志。

<!-- ecc-final:delivery-status -->
> 范围修订，独立评审结果见本仓交付记录。上一版历史证据：R3 完整语义 GREEN；R4 复核 GREEN；十二项文档门禁 exit 0，ContextView 148 tests OK——仅证明修订前文档，不预填本范围 GREEN/PASS。附录 A–C 的 E-01..E-110、118 条旧证据 ID 与 12 条历史测试原记录未改。
