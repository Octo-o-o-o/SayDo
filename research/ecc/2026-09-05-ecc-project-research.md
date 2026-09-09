<!-- ecc-final:superseded -->
> 历史归档：本文件已由[最终统一稿](2026-09-05-ecc-unified-research.md)替代。下方正文、旧 SoT 声明和评审状态保留用于追溯，不再作为当前实施入口。

<!-- ecc:review-status:begin -->
> 本轮文档已根据独立评审修订，R3 为 GREEN，9/9 最终文档门禁通过。以下保留冻结候选的写作与评审历史；当前结论见[评审与交付核验记录](../codex-findings/2026-09-05-ecc-research-review.md)。候选建议仍须 owner 选定后导入现有排产，产品代码未实施。
<!-- ecc:review-status:end -->

# ECC 项目调研报告（2026-09-05）

> 状态：研究候选，不是合同、不是排产、不是 GREEN。R1 独立评审结论 RED（4 个 P1）；本文件为实施线按源码回修稿，R2 已确认前 4 个 P1 闭合；本次为接收集合与最终 P2 校正稿，R3 待独立核验。
> 调研日：2026-09-05。网络快照与源码 SHA 必须一起读；二者不一致时以本报告分层口径为准。
> ECC 只读源码：`Reference/ECC` HEAD `e04ea0b9cc8248686edf5ac751cadff550e162b8`（2026-09-03 16:51 -0400，`origin/main` 同步）。
> 本仓写入树：SayDo feature branch `codex/ecc-research-20260905` HEAD 调研开始时为 `bcf8ea855f25b177888d9159f75e49214f3dd892`。
> 配套：`research/ecc/evidence-index.json`、SayDo 候选方案 `docs/plan/2026-09-05-ecc-borrowing-plan.md`、ContextView 候选方案 `research/ecc/2026-09-05-contextview-ecc-borrowing-plan.md`。

## 0. 结论与适用边界

ECC（Everything Claude Code / `ecc-universal`）是一套 **跨 harness 的可选择安装工作流包 + Node CLI + 可选 Rust 控制面脚手架**。它把 skills、agents、commands、rules、hooks、MCP 约定、install-state 和少量 session/MCP 观测合同放到一个 Git/npm 分发面里，让 Claude Code / Codex / Cursor / OpenCode 等宿主共用同一套“怎么干活”的资产。它 **不是** 语音前脑，**不是** 不可 bypass 的执行控制面，**不是** Context Receipt 产品。

对 SayDo：值得借的是 **可组合安装、所有权收据、doctor/repair/uninstall、可检查的 unreviewed 记忆格式、adapter 能力诚实表、MCP 配置脱敏 inventory、路径 containment、loopback Host 门**。不值得借的是 **自动演化 instinct / 启发式置信度注入、默认侵入全局 hooks、模型降档当优化、无界多 agent、把赞助计算桥当产品、用 context 百分比冒充真实 prompt occupancy、用 ECC 替换 voiced daemon / Tier1 / Gate 0**。

对 Contexpect / ContextView：ECC 应定位为 **可观测、可导入的第三方配置与夹具来源**。它证明“同一意图在不同宿主上的 native 投影不同”，也提供 hooks.json、install-state、memory vault、session adapter、MCP inventory 的真实语法。它 **不能** 充当 native oracle，**不能** 把 CLI 绿当成 Model-visible，**不能** 把 2026-09-05 的新信息提升为 2026-09-04 cutoff 的 required scope。Contexpect 的 18 个 adapter family 不因本报告变成 19 个。

适用边界：

1. 本报告覆盖 ECC 运行时入口到核心实现及相应测试的 **追踪阅读**，不是 3520 个 tracked 文件的逐行阅读。
2. 互联网数字（star、技能目录、changelog）与源码计数冲突时，分层记录，不以营销指标当价值证明。
3. 实测只在隔离 `HOME`/`TMPDIR` 下跑只读 CLI 与已读过的单测；未 `npm install`、未把 ECC 装进用户配置、未跑 `ecc2` cargo、未访问真实 MCP、未跑全套 `tests/run-all.js`。
4. 许可结论只覆盖 ECC 自己的 MIT 与本仓对照，不把依赖传递许可说成可随意拷贝。

## 1. 三个项目实际证据坐标

| 项目 | 当前名称 | 坐标 | 性质 |
| --- | --- | --- | --- |
| ECC 源码 | ECC / `ecc-universal` | git `e04ea0b9cc8248686edf5ac751cadff550e162b8`；`VERSION` 与 `package.json` = `2.2.1`；`LICENSE` MIT | 源码事实 |
| ECC npm | `ecc-universal` | registry `latest=2.2.0`（2026-08-27T17:34:09Z）；版本列表无 `2.2.1`；`next=2.0.0-rc.1` | 当前实测（registry GET 2026-09-05） |
| ECC GitHub Release | v2.2.0 | tag `5eddf1a3ffd311423be2d4ba7d26f7209c91b033`（2026-08-27）；HEAD 相对 tag **147** commit | 当前实测（`git log` / `git rev-list`） |
| ECC GitHub 元数据 | `affaan-m/ECC` | stars **248521**；forks **37460**；open issues **143**；homepage `https://ecc.tools`；created 2026-01-18；pushed 2026-09-04T19:02:58Z | 当前实测（`gh api` 2026-09-05） |
| SayDo | SayDo | 本工作区 HEAD 调研开始 `bcf8ea85`；排产指针 `active=none,next=PG-01B,last_closed=PROC-01`；唯一串行链 `PROC-01 → PG-01B → … → owner-stop` | 源码/合同事实 |
| ContextView | Contexpect / `ctxpect` | 快照仓 git HEAD `3ae72e47ae2b770dabd31b5948736fc38a5e45ef`（2026-09-04 14:13 +0800）+ 大量未提交文档；cutoff `2026-09-04T23:59:59+08:00`；无 Rust/Tauri 运行时 | 工作副本事实，不能把 HEAD 当当前全文 |

分层口径（全文沿用）：

- **官方宣称**：README、ecc.tools、Release 文案、changelog。
- **源码事实**：打开的文件与行号；tracked 计数。
- **当前实测**：本会话命令、退出码、摘要。
- **推断**：由源码推出但未跑通的行为。
- **未验证**：未读、未跑、API 404、缺依赖。

## 2. 目录

1. 三个项目坐标
2. 宣称 / 源码 / 实测冲突表
3. 定位、演进与生态
4. 目录、语言与架构
5. agent / skill / rule / command / manifest
6. 选择性安装、升级、回滚
7. hooks
8. context / compact
9. memory / instinct
10. session / MCP adapter
11. control pane / ecc2 Rust
12. orchestration / worktree
13. 安全与供应链
14. 测试与成熟度
15. 许可与维护成本
16. 负面案例
17. 覆盖统计与阅读深度矩阵
18. 实测记录
19. 外部来源表
20. 待 reviewer 关注
21. 独立 review 修订区

## 3. 宣称、源码、实测必须分开的数字

访问日均为 2026-09-05。

| 指标 | 官方宣称 | 源码/本地计数 | 当前实测 | 处理 |
| --- | --- | --- | --- | --- |
| 版本 | README 写 ECC 2.2 guided setup | `VERSION`/`package.json`/`plugin.json` = **2.2.1**；CHANGELOG 最新发布节是 **2.2.0**，2.2.1 在 Unreleased | npm `latest=2.2.0`，无 2.2.1；git tag 止于 v2.2.0，其后 147 commit | 研究坐标钉 SHA `e04ea0b`，发布坐标钉 npm 2.2.0。不得把 2.2.1 说成已发布 |
| skills | README **286**；ecc.tools 首页 **261**；`/skills` 构建器 **91**；v2.0.0 Release **261** | `skills/*/SKILL.md` = **286**；`skills/` tracked md = 400（含非 SKILL 附属文件）；目录数 286 | 构建器 91 是 **profile 目录子集**，不是全仓 | 全仓事实用 286；官网 261 是过期营销；91 是选择性安装 UX 表面 |
| agents | README **68**；官网 **64**；构建器 **18** | `agents/*.md` = **68** | — | 全仓 68；官网 64 过期 |
| commands | README **94**；官网 **84**；构建器 **48** | `commands/*.md` = **94** | — | 全仓 94 |
| stars | 官网 **210K+**；README badge 走 `api.ecc.tools` | 仓内 `star-history-data.tsv` 止于 2026-02-07 **40000** | GitHub API **248521** | star 证明分发，不证明质量。tsv 是早期资产，不能当现数 |
| npm 用量 | README 有 npm downloads badge | — | `ecc-universal` last-month downloads **16104**（2026-07-31..08-29）；last-week **3819** | 下载量远小于 star。不能用 star 外推安装率 |
| 控制面 | ecc.tools changelog：ECC 2.0 control-plane “now shipped” | `ecc2/README.md` 自称为 **alpha**、非 GA；`ecc2/Cargo.toml` `ecc-tui` **0.1.0** | 本会话未 `cargo test` | 网站“shipped”是营销；源码自我定性是 alpha |
| 默认 MCP | 2.0/2.2 changelog：默认只留 `chrome-devtools` | **分层，不得混写**：Claude `.claude-plugin/plugin.json` `mcpServers: {}`；Codex native `.codex-plugin/plugin.json` 指向根 `.mcp.json`（仅 `chrome-devtools`）；legacy `.codex/config.toml` 仍列六服务器兼容层 | 未连真实 MCP | 政策文件与 Codex native 默认集一致；Claude 空表 ≠ Codex native；legacy 六服务器 ≠ 当前 native 默认；未验证运行时健康检查 |
| AgentShield | README “Included” | 官方 npm `ecc-agentshield` latest **1.4.0**，modified **2026-03-21** | 独立仓，本会话未读其源码 | 不要把 ECC 仓内文档当成 AgentShield 实现已审 |

## 4. 定位、演进与生态

### 4.1 它是什么

README 的自我定义：agent 已经会写代码；ECC 安装的是 plan → test → implement → review → verify → remember → improve 的工程系统。口号是 “Optimize the context window. Persist everything else.”

源码更窄、更诚实：主入口 `scripts/ecc.js` 是 **selective-install CLI 路由器**，把子命令 `spawnSync` 到 `setup.js` / `install-apply.js` / `doctor.js` / `memory.js` / `control-pane.js` 等。产品内核是：

1. 把仓库里的 markdown/json/hook 脚本按 profile/module **投影到宿主目录**；
2. 用 `ecc.install.v1` 记录所有权，使 doctor/repair/uninstall 可回放；
3. 用 hooks 在 Claude（及部分 Cursor/OpenCode）生命周期里跑本地脚本；
4. 用 memory vault 存跨宿主 markdown；
5. 用 session/MCP adapter 做 **只读归一化观测**；
6. 用 `ecc2/` 做 **另一套尚未 GA 的操作面**。

### 4.2 演进（源码 + Release，不是官网单独叙事）

| 时间 | 事件 | 证据层 |
| --- | --- | --- |
| 2026-01-18 | GitHub 仓创建 | API `created_at` |
| 2026-02 初 | star 从 0 冲到 tsv 记录的 40k（02-07） | 仓内 tsv；属早期资产 |
| 2026-03-05 | v1.8.0 harness performance | GitHub Release |
| 2026-03-21 | v1.9.0 selective install + Pro | Release |
| 2026-04-05 | v1.10.0；ECC 2.0 alpha 控制面进入仓 | Release + CHANGELOG |
| 2026-05-25 | v2.0.0-rc.1 | Release（prerelease） |
| 2026-06-10 | v2.0.0 “Agent Harness Operating System”；宣称 261 skills | Release 文案（过期计数） |
| 2026-07-27 | v2.1.0 Plan Canvas、Kimi、Itô | Release |
| 2026-08-27/28 | v2.2.0 guided setup、Antigravity 2.0、Nasiko bridge；npm 2.2.0 | tag + registry |
| 2026-09-03 | HEAD 2.2.1 未发布文本版本 | `VERSION`；无 tag / 无 npm |

### 4.3 生态位置

ECC 同时做三件事，必须拆开：

1. **OSS 包**（本仓 MIT）：skills/hooks/install CLI。
2. **GitHub App / Pro**（ecc.tools 定价）：私有仓分析、坐席计费。OSS README 写明 OSS 保持免费。
3. **赞助耦合**：CodeRabbit、Greptile、Atlas Cloud、Moonshot、Itô。CLI help 含 Itô RFQ 示例。`ecc ito` 是 **独立安装的赞助 CLI 桥**，不是 ECC 核心。

对 SayDo / Contexpect：只评估 (1)。(2)(3) 是商业层，不进入产品运行时。

官方安装通道（README WARNING）：GitHub `affaan-m/ECC`、npm `ecc-universal` / `ecc-agentshield`、GitHub App、plugin slug `ecc@ecc`、网站 ecc.tools。SECURITY.md 点名非官方包 `@chil_ntl/ecc-cli`、`ecc-100xprompt-plugin`。

## 5. 目录、语言与架构

### 5.1 tracked 库存（本会话 `git ls-files`）

tracked **3520** 文件。扩展：md 2520、js 538、json 116、py 63、yaml 48、png 34、rs 17、ts 19。顶层最大块：`docs/` 1516（其中 i18n `zh-CN/ja-JP/es/tr/ko-KR/pt-BR/zh-TW` 合计 **1391**）、`skills/` 464、`tests/` 279、`scripts/` 267、`rules/` 122、`commands/` 94、`agents/` 68、`ecc2/` 21、`src/` 20。

宿主投影目录也在 Git 里：`.kiro` 153、`.agents` 89、`.opencode` 81、`.cursor` 69、以及 `.claude` / `.codex` / `.gemini` / `.kimi` / `.qwen` / `.zed` 等。这是 **分发面**，不是运行时数据。

### 5.2 语言与运行时

| 层 | 语言 | 入口 | 成熟度（源码自我定性 + 实测） |
| --- | --- | --- | --- |
| 安装/CLI/hooks | JavaScript（Node，README 要求 >=18；CLI 实测 Node 22.23.1） | `scripts/ecc.js` bin `ecc`/`ecc-universal` | 主路径。help/catalog/doctor/memory 在无 `node_modules` 下可跑 |
| 控制面 JS | JS + `sql.js` + `@iarna/toml` + `ajv` | `scripts/control-pane.js` | 依赖未安装时 `ecc.test.js` 6 失败（见 §18） |
| 控制面 Rust | Rust 2021，`ecc-tui` 0.1.0 | `ecc2/src/main.rs` | alpha；本会话未编译 |
| LLM 小工具 | Python `src/llm/` | `src/llm/__main__.py` | 独立 selector，不是主产品 |
| 技能/代理/命令 | Markdown | `skills/*/SKILL.md` 等 | 内容资产；质量不均一 |
| 仪表 | `ecc_dashboard.py` | 根文件 | 未深读运行时 |

`package.json` runtime 依赖只有 `@iarna/toml`、`ajv`、`js-yaml`、`sql.js`。主安装器刻意 **手写 install-state 校验**，避免安装器闭包依赖非 builtin（`install-state.js` 注释）。

### 5.3 架构图（源码事实）

```text
operator
  -> ecc CLI (scripts/ecc.js) --dry-run 只设 ECC_DRY_RUN=1
       -> install/setup/plan/catalog  (manifests + install-targets/*)
       -> doctor/repair/uninstall     (install-lifecycle + path-safety)
       -> memory                      (memory-vault, ecc.memory.v1)
       -> sessions/session-inspect    (session-adapters, ecc.session.v1)
       -> control-pane                (loopback HTTP + sql.js; 默认同目录 ~/.claude)
       -> ito/nasiko                  (赞助/实验桥；非核心)
  harness (Claude/Cursor/...)
       -> 加载已安装 skills/rules/commands
       -> 若 hook consent=enabled，跑 hooks/hooks.json
  ecc2 (可选)
       -> TUI/daemon/harness-eval；与 JS CLI 版本号独立
```

跨宿主有两套不可混用的坐标：

1. **上游文档（已漂移）**：`docs/architecture/cross-harness.md` 仍写 hooks 在 Claude/OpenCode/Cursor 为 hook-backed、在 Codex 为 instruction-backed；同文件后文写“unless Codex adds a native hook surface”。`docs/architecture/harness-adapter-compliance.md` 矩阵把 Codex 标 Instruction-backed，风险注“Treat hooks as policy text unless a native Codex hook surface exists”。这是文档层，不是 2026-09-03 SHA 的安装实现。
2. **当前实现（源码事实）**：`harness-capabilities.js` 把 Codex 标 `channel/installMode=native-plugin`、`hooks.mode=native-trust`。`.codex-plugin/plugin.json` 绑定 `hooks: "./hooks/codex-hooks.json"`。该文件只登记 **一条** 同步 `SessionStart` command hook。README 要求新会话打开 `/hooks` **显式审查并信任** 后才启用；plugin 安装本身不授权命令。Claude 的 PreToolUse / PreCompact / PostToolUse / PostToolUseFailure / Stop / SessionEnd **未**进入 Codex native bundle，须逐事件判定（不在 native 登记 / 协议不支持 / 拦截类 handler 被排除），**禁止**把整个 `hooks-runtime` 写成 Codex 上的 instruction overlay 或整类 `omitted`。
3. **legacy 单列**：`bash scripts/sync-ecc-to-codex.sh` 是已弃用的 managed sync，把文件合并进 `~/.codex`，不创建 marketplace 注册，也不等于 native plugin。其 MCP 面是 `.codex/config.toml` 的六服务器兼容层，与 native `.mcp.json` 不是同一列。

Pi 在 compliance 矩阵出现，但 `harness-capabilities.js` 测试明确 **不把 Copilot/Kiro/Pi 登记为安装 harness**。宣称矩阵 ≠ 安装 registry ≠ native plugin 清单。

平台 / MCP 分层（安装声明最高只到 Installed / 部分 Discoverable；**不得**升 Model-visible / UseEvidence / Outcome-affecting）：

| 层 | 入口 | hooks | MCP | 信任门 |
| --- | --- | --- | --- | --- |
| Claude native plugin | `.claude-plugin/plugin.json` | `hooks.json` 七类事件；`userConfig.hooks_enabled` default true | `mcpServers: {}`（空对象） | 缺省开启 + `check-hook-enabled` 无 id 则 yes（fail-open） |
| Codex native plugin | `.codex-plugin/plugin.json` | 仅 `hooks/codex-hooks.json` 的 `SessionStart` 子集 | `mcpServers: "./.mcp.json"` → 仅 `chrome-devtools` | `/hooks` 显式信任；hash 变则再审；`/plugins` 与 `/hooks` 分控 |
| Codex legacy sync | `scripts/sync-ecc-to-codex.sh` | 全局 git pre-commit/pre-push，不是 Codex lifecycle hook | `.codex/config.toml` 六服务器：github / context7 / exa / memory / playwright / sequential-thinking | 非 marketplace；`ecc uninstall --legacy-codex-sync` |
| 政策 / opt-in | `docs/MCP-CONNECTOR-POLICY.md` | — | 默认只 chrome-devtools；六旧默认在 `mcp-configs/mcp-servers.json` opt-in | 政策 ≠ 运行时健康 |

## 6. agent / skill / rule / command / manifest

### 6.1 计数与包装

- **286** 个 `SKILL.md` 目录；frontmatter 常见 `origin: ECC`。
- **68** agents，**94** commands，**122** rules Markdown 文件（含 1 个 `rules/README.md`；规则正文为 121 份）。
- plugin 分层：Claude `.claude-plugin/plugin.json` 把 `./skills/` 与 `./commands/` 整目录交给 Claude plugin，`userConfig.hooks_enabled` **default true**，`mcpServers: {}`。Codex native `.codex-plugin/plugin.json` 绑定 `./skills/`、`./.mcp.json`、`./hooks/codex-hooks.json`（仅 SessionStart，须 `/hooks` 信任）。二者不是同一份 manifest。
- 选择性安装并不等于 286 个独立组件：`manifests/install-components.json` 只有 **83** 个组件（baseline 6 / language 14 / framework 9 / capability 17 / agent 12 / skill 15 / locale 10）。大量 skills 被打进更粗的 module。

### 6.2 清单

`manifests/install-profiles.json` profiles：`minimal`（无 hooks-runtime）、`opencode`、`core`、`developer`、`security`、`research`、`full`（文档写 26 modules）。`install-modules.json` 实际 **36** 个 module id，含 `ito-compute`、`nasiko-control-plane`、`prediction-market-skills`、各语言 docs。`full` 不是“磁盘上每一个文件”，而是“当前已分类 module”。

`scripts/lib/install-manifests.js` 支持的 install target：**15** 个：`claude`、`claude-project`、`cursor`、`antigravity`、`codex`、`gemini`、`opencode`、`codebuddy`、`joycode`、`qwen`、`zed`、`hermes`、`openclaw`、`kimi`、`adal`。

`harness-capabilities.js`：**14** harness 记录覆盖这 15 个 target；**guidedReady 仅 claude / codex / kimi**。其余 `availability: advanced`。测试断言 “only Claude, Codex, and Kimi are guided-ready”。官网 “works across Claude Code, Codex, Cursor, and OpenCode” 把 advanced 目标说成同一深度，这是宣称层。

### 6.3 对借鉴的含义

可组合性是真的，但 **用户以为的 skill 粒度 ≠ 安装 module 粒度**。把 ECC 当“286 个可独立开关的能力”会高估。Contexpect 若导入，必须按 module/component/SKILL.md 三层 identity 建模，不能假设 1:1。

未逐篇审 286 个 skill。抽样与目录名可见：既有 `agent-harness-construction`、`continuous-learning` 这类元工作流，也有行业/媒体/赞助（ito、nasiko、prediction-market）。**大而全本身是维护成本，不是能力证明。**

## 7. 选择性安装、升级、回滚

这是 ECC 最接近“工程产品”的子系统。

### 7.1 所有权收据

`ecc.install.v1`（`scripts/lib/install-state.js` + `schemas/install-state.schema.json`）记录：`schemaVersion`、`installedAt`、`target.{id,kind,root,installStatePath}`、`request.{profile,modules,include,exclude,hookConsent}`、`resolution.{selectedModules,skippedModules}`、`source.{repoVersion,repoCommit,manifestVersion}`、`operations[]`。每条 operation 必须有 `kind`、`moduleId`、`sourceRelativePath`、`destinationPath`、`strategy`、`ownership`、`scaffoldOnly`，可选 `contentSha256`。

`install-lifecycle.js` 的 doctor/repair/uninstall **只回放 `ownership === 'managed'`**。CHANGELOG 2.2.0 写明：选择性重装必须合并先前 ownership ledger，避免后加 module 把先装文件变成孤儿。

### 7.2 路径边界（fail-closed）

`path-safety.js` 注释引用 `GHSA-hfpv-w6mp-5g95`：install-state 是项目内、可被恶意 clone 投毒的文件；repair/uninstall 不得信任 state 里的目标路径，必须把目的地限制在 adapter 解析出的 trusted root。`assertWithinTrustedRoot` 用 nearest-existing realpath 防中间目录 symlink 逃逸。

本会话 `gh api /advisories/GHSA-hfpv-w6mp-5g95` 返回 **404**。结论只能是：代码按该编号做了 containment；**公开 advisory 正文未验证**。不得把 404 说成“无漏洞”，也不得把注释编号说成已披露 CVE。

`atomic-write.js`：同目录临时文件 `O_EXCL` + `fsync` + `rename`。memory vault 另有 create-only + `O_NOFOLLOW` + inode 身份校验（Windows libuv 体积序号坑见 CHANGELOG 2.2.0）。

### 7.3 doctor / repair / uninstall / auto-update

`doctor.js` 调 `buildDoctorReport`，无 install-state 时 **exit 0** 并提示问题表单。隔离实测：空项目 `results=[]`、`checkedCount=0`、`packageVersion=2.2.1`、exit 0。这证明 doctor 是 **对照收据的漂移检测**，不是“本机健康总分”。没有收据 ≠ 安装损坏。

`uninstall.js` / `auto-update.js` 支持 `--dry-run`。auto-update 文案是 pull 最新 repo 再按原 request 重装——对 SayDo 这种锁版本执行后端 **不能照搬自动 pull**。

`hook-consent.js`：hooks-runtime 是单独 module；consent 为 `enabled|declined`；披露六组能力（自动改源码、改写命令/进程、把 transcript 送给外部 LLM、探 MCP、自动拦 Edit/Write/Bash、持久化会话/成本）。这是可借鉴的 **安装前能力披露**，不是运行时 Gate 0。

### 7.4 实测边界

隔离 CLI：`ecc --help` exit 0；`ecc catalog profiles` 列出 7 个 profile（full = 26 modules）；`doctor --json` 空收据 exit 0；`memory init --scope project` 只写隔离 cwd 下 `.ecc/memory/project/**`，user root 落在隔离 HOME。未执行 `ecc install` / `setup` / `repair`。

## 8. hooks

### 8.1 装载面（按宿主分层，禁止整类省略）

Claude native：`hooks/hooks.json` 事件 PreToolUse、PreCompact、SessionStart、PostToolUse、PostToolUseFailure、Stop、SessionEnd。登记 id 约 23 条（PreToolUse 8、Stop 7 等）。命令体是一段重复的 `node -e` 引导，解析 `CLAUDE_PLUGIN_ROOT` 或 `~/.claude/plugins/...` 后加载 `plugin-hook-bootstrap.js`。

Claude 默认：`.claude-plugin/plugin.json` `hooks_enabled.default=true`；`hook-flags.js` `ECC_HOOKS_ENABLED` 缺省 **true**；`check-hook-enabled.js` 在缺少 `hookId` 时打印 `yes` 并 exit 0。这是 **缺省开启 + 参数缺失 fail-open**。对 SayDo 审批链不可接受。

Codex native（与 Claude 不是同一 profile）：`.codex-plugin/plugin.json` `hooks` 字段指向 `./hooks/codex-hooks.json`。该文件 description 写明 “verified SessionStart bootstrap. Claude hook profiles remain separate.” 实际只登记：

| Claude 事件 | Codex native `codex-hooks.json` | 本事件判定（不得整类 omitted） |
| --- | --- | --- |
| SessionStart | 已登记；`type=command`；`matcher=.*`；id `session:start`；命令引导 `PLUGIN_ROOT` → `session-start-bootstrap.js` | **显式信任的 native 子集**。plugin 安装 ≠ `/hooks` 信任；定义 hash 变则再审。未在真实 Codex 会话触发（未验证） |
| PreToolUse | 未登记 | 不在 native bundle。README：拦截工具、异步、或不符合 Codex hook 协议的 handler 被排除。不是 instruction overlay 整类 |
| PreCompact | 未登记 | 不在 native bundle（unsupported event 口径） |
| PostToolUse | 未登记 | 不在 native bundle |
| PostToolUseFailure | 未登记 | 不在 native bundle |
| Stop | 未登记 | 不在 native bundle |
| SessionEnd | 未登记 | 不在 native bundle |

legacy sync 单列：`scripts/sync-ecc-to-codex.sh` 安装的是全局 git pre-commit/pre-push，**不是** Codex `SessionStart` lifecycle hook，也 **不是** Claude `hooks.json` 的投影。Contexpect loss 分类必须把 native plugin 与 legacy sync 分成两列。

安装 / 可发现 ≠ 模型可见：Codex plugin `list` 或 `/hooks` 已信任，最多支持 Installed（定义在场）与 Discoverable（宿主会扫描该定义）的候选。**不得**据此写 Model-visible、UseEvidence 或 Outcome-affecting。冻结 native oracle 仍只有 Codex `debug prompt-input` 与 Grok `inspect --json`。

### 8.2 行为分类（源码，非宣传）

| 类 | 例子 | 风险 |
| --- | --- | --- |
| 质量/提醒 | doc-file-warning、suggest-compact、format-typecheck | 噪声；exit 0 警告 |
| 拦截 | config-protection、gateguard-fact-force、block-no-verify、mcp-health-check | 可能改变 agent 行为；mcp-health 会探进程 |
| 观测/学习 | observe-runner、evaluate-session、skill-run-tracker、continuous-learning | 把工具调用写入学习层 |
| 上下文 | session-start 注入摘要与 instinct；pre-compact 写 LLM 摘要 | 常驻上下文膨胀 |
| 成本 | cost-tracker、ecc-metrics-bridge、ecc-context-monitor | 见 §9 |
| 赞助/实验 | plan-canvas、ito 不在 hooks.json 主链 | 另入口 |

`ecc-metrics-bridge.js` 读成本文件失败时日志写 `failing open`，成本归零。观测路径 **fail-open**。

未在真实 Claude 会话里触发 hooks。hooks 单测只覆盖 `ecc-context-monitor`（22 passed）。其余 `tests/hooks/*.test.js` 未跑。

## 9. context / compact

`ecc-statusline.js` 从宿主 stdin JSON 读 `data.context_window.remaining_percentage`，写回 bridge 的 `context_remaining_pct`。`ecc-context-monitor.js` 用该字段做 35%/25% 警告。单测证明：20% → CRITICAL，30% → WARNING，50% → 无警告；循环检测要求最近 5 次 **完全相同** tool+hash。

这是 **宿主提供的 remaining_percentage 的转播 + 启发式告警**，不是 prompt 重建，不是 occupancy 账本。字段缺失则跳过。文档 `docs/token-optimization.md` 另推荐把默认模型改为 sonnet、思考 token 降到 10000、子代理用 haiku——这是 **降档省钱指南**，与 SayDo 禁止静默降档直接冲突。

`pre-compact.js` 在 compact 前写 session 摘要；匹配当前 worktree，避免写到别人的 `*-session.tmp`。摘要失败则降级为普通日志。未验证 LLM 摘要质量。

## 10. memory / instinct

### 10.1 Memory Vault（可检查、刻意不升级信任）

合同：`ecc.memory.v1`。`MEMORY_TRUST_STATES = ['unreviewed']`（`memory-vault-format.js`、`schemas/memory.schema.json`）。kinds：context/decision/fact/handoff/lesson/note/preference/runbook。scopes：project/team/user。默认 recall 只有 project+team；user 必须显式 `--scope user`。

`docs/design/ecc-memory-vault.md`：markdown 是真相；SQLite/embedding 只是索引；工具创建的记忆永远是 unreviewed context，不能静默变成 rules/skills/policy；写 create-only；已知凭据形态拒绝；project vault fail-closed `.gitignore`（`*\n!.gitignore\n`）。测试 `memory-vault.test.js` 35 passed，含 gitignore 被改成空规则时 fail-closed。

隔离实测：`memory doctor --json` → `ok:true, memoryCount:0`；`memory init --scope project` 创建 8 个 kind 目录，路径在隔离 cwd，未碰真实家目录。

与 SayDo 对照（推断，方案文展开）：ECC 的硬约束是 **永不自动升格**；SayDo 的硬约束是 **candidate→trusted，且 M0 只收 user_stated/user_approved**。两者都反“模型写完就算长期记忆”，但 ECC 停在 unreviewed 文件，SayDo 有账本、generation、forget_hard、readiness 绑定。不能把 ECC vault 当 M0。

### 10.2 Instinct / continuous learning（不应照搬）

`session-start.js` 在 SessionStart 把 instinct 注入上下文。缺省 `DEFAULT_INSTINCT_CONFIDENCE_THRESHOLD = 0.7`，`DEFAULT_MAX_INJECTED_INSTINCTS = 6`。`instinct-relevance.js` 用项目/栈关键词给 confidence 加 0.25/0.2 boost，使“项目内 0.7”压过“全局 0.9”。测试 18 passed。官网 changelog 还宣称 session-history 变成 confidence-scored instincts、idle 衰减自动 prune、team skill registry 在 session start 自动对齐。

这是 **启发式置信度 + 自动注入常驻上下文**。对 SayDo：违反 M0 第三方/candidate 纪律。对 Contexpect：最多作为 F-14 历史分析的 **候选**，provenance 只能是 heuristic，不得写成 observed。

## 11. session / MCP adapter

### 11.1 `ecc.session.v1`

`scripts/lib/session-adapters/canonical-session.js` 定义 snapshot：`schemaVersion`、`adapterId`、`session.{id,kind,state,repoRoot,sourceTarget}`、`workers[]`、`aggregates`。registry 默认四适配器：claude-history、dmux-tmux、codex-worktree、opencode。测试 14 passed。

能力是 **把已有宿主产物归一化成观测快照**，不是启动/审批/settle 任务。worker health 对 running 态用 5 分钟 stale 阈值——启发式。

`session-inspect` / `work-items` / control-pane 在未安装 `sql.js` 时无法加载（见 §18）。适配器纯函数测试不依赖 sql.js。

### 11.2 `ecc.mcp.v1` 与三套 MCP 声明

`canonical-mcp.js`：只保留 env **键名**、按模式 redact args/URL、用 transport+command+args+url 做 signature 去重。

MCP 声明必须按装载面分开，不能再用“plugin.json 为空”概括：

| 装载面 | 文件 | 服务器 |
| --- | --- | --- |
| Claude native plugin | `.claude-plugin/plugin.json` | `mcpServers: {}` |
| Codex native plugin | 根 `.mcp.json`（manifest `mcpServers: "./.mcp.json"`） | 仅 `chrome-devtools`（`npx chrome-devtools-mcp@latest`） |
| Codex legacy 参考/兼容 | `.codex/config.toml` | 六段：`github` / `context7` / `exa` / `memory` / `playwright` / `sequential-thinking` |
| 政策 | `docs/MCP-CONNECTOR-POLICY.md` | 默认只 chrome-devtools；上述六者 2026-06 审计后改为 `mcp-configs/mcp-servers.json` opt-in |
| Codex plugin README | `.codex-plugin/README.md` | 明确 native manifest **不**覆盖 `~/.codex/config.toml` |

政策与 Codex native `.mcp.json` 同源；Claude 空表是另一套 Claude plugin 字段；legacy TOML 六服务器是兼容层，不是 native 默认。memory MCP 是 opt-in，不进 native `.mcp.json`。

`mcp-inventory.test.js` **18 passed / 2 failed**：Codex TOML reader 与 merge 计数失败。`readers/codex.js` 优先 `require('@iarna/toml')`，失败则最小解析器。本环境未 `npm install`，失败 **不能** 解释为生产 reader 坏了，只能记“缺依赖时 Codex TOML 路径未在本机验证”。Claude/OpenCode JSON 路径测试通过。

未连接真实 MCP 服务器。`mcp-health-check` hook 未跑。未验证 Codex native plugin 在真实会话里是否加载 `.mcp.json`。

## 12. control pane / ecc2 Rust

### 12.1 JS control pane

`control-pane.js` 默认 `--host 127.0.0.1 --port 8765`，可 `--read-only`。`loopback-guard.js` 限制 Host 为 127.0.0.1/localhost/::1，防 DNS rebinding。测试 15 passed。

`control-pane/state.js` `require('sql.js')`，默认 DB：`~/.claude/ecc2.db` 与 `~/.claude/ecc/state.db`。即：JS 操作面把状态放进 **Claude 家目录约定**，即使只做只读观测。对 SayDo daemon（`~/.saydo`）是另一套根；对 Contexpect 是“配置残留 ≠ 可运行”的反面教材——有 `~/.claude/ecc` 不表示 ECC 控制面在跑。

macOS 上 `--open` 会 `spawn('open', url)`。未在本会话起服务。

### 12.2 ecc2

`ecc2/README.md`：TUI dashboard、SQLite session store、start/stop/resume、daemon、observability/risk 原语、worktree scaffolding。明确 **不是 finished ECC 2.0 product**。`harness-eval` 只做本地 recorded-measurements，不联网、不改运行中 session。`Cargo.toml` 依赖 rusqlite/git2/ratatui/ureq；ureq 存在意味着二进制 **可以** 出网，但 README 为 harness-eval 划了本地边界。

`main.rs` CLI：HarnessEval、Dashboard、Start、Delegate、sessions、stop、resume、daemon。本会话 **未** `cargo test` / `cargo run`。Rust 控制面成熟度 = 未验证。

网站 changelog 把 2.0 control-plane 写成 shipped，与仓内 README 冲突。以源码自我定性为准。

## 13. orchestration / worktree

`worktree-lifecycle.js` 从 git 事实分类：main/detached/dirty/conflict/merge-ready/merged/stale/idle。cleanup 只计划删除 **已完全 merge** 或 **stale 且干净且无未合并提交** 的树。测试 11 passed，含真实 git runner。这是 **只读分类 + 安全 GC 计划**，不是 SayDo/Hopper 的任务 worktree 供给。

`tmux-worktree-orchestrator.js`、`commands/orch-*.md`、`workflows/orch-review.workflow.js` 是多 agent 编排表面。未跑编排。对 SayDo：执行编排已有 Tier1/Hopper 合同；再引入 ECC orch 会造成第二套拓扑。对 Contexpect：最多当 session/worktree 观测夹具。

Plan Canvas（`scripts/plan-canvas.js`）是 loopback 浏览器批计划。未起服务。

## 14. 安全与供应链

已证实的工程点：

1. install-state 不信任目的地路径（path-safety）。
2. memory create-only、symlink 拒绝、secret 形态拒绝、project gitignore fail-closed。
3. MCP inventory 不把 secret 值拷进 canonical 记录。
4. loopback Host/Origin 门。
5. hook consent 分组披露。
6. `scripts/ci/scan-supply-chain-iocs.js` 与 `security-ioc-scan` 子命令存在；`ecc.test.js` 对该 help/委托 **passed**（不依赖 sql.js）。
7. SECURITY.md 列官方分发面、支持 2.x 与 1.10.x。
8. CHANGELOG 2.2.0：发布门测 packed artifact、staging dist-tag、registry 字节核对后再 latest。

未证实 / 负向：

1. GHSA 编号公开 API 404。
2. hooks 缺省开启；`check-hook-enabled` 无 id 则 yes。
3. metrics/cost 读失败 fail-open。
4. instinct 以 confidence 注入。
5. JS control pane 默认写 `~/.claude`。
6. `ecc ito find` 可发真实 RFQ（help 文本）；赞助桥是独立危险面。
7. 未审查 286 skill 是否含外泄/自动提交。
8. 未跑 ioc-scan 对真实 HOME（禁令：不扫私人目录）。

Aura 集成（`integrations/aura/`）文档写 gate 默认 fail-closed，可显式 fail-open。未跑。

## 15. 测试与成熟度

仓内 `tests/` tracked 279；`tests/run-all.js` 发现 `tests/**/*.test.js` 并逐文件 `node`。本会话 **没有** 跑全套。

已跑（隔离 HOME，**未 npm install**）：

- 纯函数/CLI 子集：path-safety 12、memory-vault 35、install-state 5、hook-consent 8、loopback-guard 15、harness-capabilities 9、session-adapters 14、worktree-lifecycle 11、instinct-relevance 18、ecc-context-monitor 22、doctor 3、memory CLI 15、catalog 4、skill-evolution 17，均为 Failed 0。
- mcp-inventory 18/2：缺 `@iarna/toml` 时 Codex TOML 路径红。
- ecc.js 路由器 16/6：缺 `ajv`/`sql.js` 时 install/control-pane/session-inspect/work-items 红。

成熟度判断：

- **可独立运行、测试较密**：install-state、path-safety、memory vault、hook consent、loopback、worktree 分类、capability catalog。
- **需要 npm 依赖才构成产品**：guided install（ajv）、control pane/state store（sql.js）、Codex MCP TOML（toml）。
- **文档大于运行时**：ecc2 GA 叙事、官网 skill 数、控制面 shipped。
- **内容资产巨大、验收不齐**：286 skills 没有在本会话按 skill 回归。`skill-evolution` 有健康率统计测试（17 passed），那是 **仓库内 tracker**，不是每个 skill 的产品验收。

Python `tests/test_*.py`（llm provider）未跑。Rust 未跑。Docker plugin-setup 未跑。

## 16. 许可与维护成本

ECC `LICENSE`：MIT，Copyright (c) 2026 Affaan Mustafa。GitHub API `spdx_id=MIT`。npm 2.2.0 license MIT。

处理建议（工程来源，不是法律意见）：

- 借鉴 **设计与小段模式**（install-state 形状、path containment、memory frontmatter、redact 规则）时：保留来源声明；不要整仓搬 286 skills。
- 若复制具体文件：保留 MIT 版权与 NOTICE 等价物；检查该文件是否夹带第三方片段（仓内 `THIRD_PARTY` 未作为本报告深读对象）。
- 依赖 `sql.js`/`ajv`/`toml` 各有自己的许可，**不能** 从 ECC MIT 推导这些依赖可随意再分发。
- 赞助商标、ecc.tools 文案、GitHub App 不是 MIT 可再品牌化的对象。
- SayDo 与 Contexpect 均为 Apache-2.0 根许可。引入 MIT 片段通常可，但 **不要** 把 ECC 的 skills 大包进 Apache 产品当“自有能力”。

维护成本：3520 tracked 文件、1391 i18n 文档、15 个 install target、hooks 与宿主 API 绑定。跟随 ECC HEAD 等于跟随 **周更的巨型内容仓**。正确姿势是 **钉 SHA 当夹具**，不是做 submodule 同步一切。

## 17. 负面案例（明确不要当成已实现/已验证）

1. README 286 skills ≠ 官网 261 ≠ 构建器 91。把任一数字当“已验证能力数”。
2. 248k star ≠ 16104/月 npm 下载 ≠ 生产安装质量。
3. `ecc doctor` 无收据 exit 0 ≠ 系统健康。
4. `context_remaining_pct` ≠ 真实 prompt 重建。
5. `trust: unreviewed` 文件被 commit 到 team scope ≠ 已治理规则。
6. ecc2 能 `cargo run`（未测）≠ ECC 2.0 GA。
7. compliance 矩阵里的 Pi/Copilot ≠ install-targets registry。
8. changelog “control-plane shipped” ≠ `ecc2/README.md` alpha。
9. `hooks_enabled` default true ≠ 用户已理解六组副作用。
10. 本会话单测绿 ≠ 全仓 `npm test` 绿；缺依赖的红 ≠ 上游回归。
11. GHSA 注释编号 ≠ 已验证公开 advisory。
12. 把 ECC 安装进 `~/.claude` 再扫私人 sessions（本次明确没做）。

## 18. 覆盖统计与阅读深度矩阵

| 区域 | tracked 规模 | 本会话深度 | 说明 |
| --- | --- | --- | --- |
| `scripts/ecc.js` 及 CLI 子命令入口 | 主脚本 + 约 40 个 bin 级 js | 入口全文 + doctor/memory/control-pane/uninstall/auto-update 开头 | 路由器与 help 实测 |
| `scripts/lib/install*` `path-safety` `atomic-write` | 核心 | 关键路径精读 + 单测 | 最重要可借鉴面 |
| `scripts/lib/memory-vault*` | 核心 | 精读 + 35 测 + CLI 实测 | |
| `scripts/lib/session-adapters` `mcp-inventory` `worktree-lifecycle` `loopback-guard` `hook-consent` `harness-capabilities` | 核心 | 精读 + 单测 | mcp 缺依赖 2 红 |
| `hooks/hooks.json` + 若干 hook 脚本 | 5 tracked hooks 配置 + `scripts/hooks/` 大量 js | json 结构全量；monitor/metrics/statusline/session-start/pre-compact/check-hook-enabled 精读 | 未触发真实 Claude hook |
| Codex native plugin / MCP / legacy | `.codex-plugin/plugin.json`、`hooks/codex-hooks.json`、`.codex-plugin/README.md`、`.mcp.json`、`.codex/config.toml`、`harness-capabilities.js` Codex 段 | **精读**；与 `cross-harness.md` / compliance 矩阵对照后判定文档漂移 | 未在真实 Codex `/hooks` 触发；未跑 `check-plugin-cache.js` |
| `manifests/` `schemas/` | 3+11 | profiles/components/modules 计数；memory/install-state schema 精读 | |
| `ecc2/src` | 17 rs | README + main.rs 开头 + store.rs 开头 + Cargo.toml | 未编译 |
| `src/llm` | 18 py | 目录 + `__main__.py` | 未测 |
| `skills/` | 286 SKILL.md | **计数 + 名称抽样**，非逐篇 | 禁止宣称遍读 |
| `agents/` `commands/` `rules/` | 68+94+122 md（rules 含 README） | 计数；未逐篇 | |
| `docs/` 英文架构/安全/安装 | 部分 | cross-harness、compliance、memory vault、MCP policy、SELECTIVE-INSTALL-DESIGN、CHANGELOG、SECURITY、token-optimization | |
| `docs/` i18n | 1391 | **仅计数** | 当作翻译副本 |
| `tests/` | 279 | 16 个已读相关文件实跑；其余未跑 | |
| 二进制/图片/锁 | png/jpeg/svg/mp4/lock | 机器计数；star-history tsv 尾部 | |
| ECC 仓内 `research/ecc2-codebase-analysis.md` | 1 | **未当权威** | 独立阅读源码 |

## 19. 实测记录

环境约束：隔离 `HOME=/tmp/ecc-research-20260905-home`；不安装 ECC 到用户配置；不 `npm install`（本机 npm cache 亦 EPERM）；父目录 `../logs` 对当前沙盒 **不可写**（`com.apple.provenance`，`cp` Operation not permitted）。日志实际落在 `/tmp/ecc-research-20260905-logs/`。报告只记文件名/字节/SHA-256。

| 名称 | 命令摘要 | exit | 摘要 | 日志 |
| --- | --- | --- | --- | --- |
| ecc-help-catalog-doctor-memory | 隔离 HOME 下 `node scripts/ecc.js --help`；`catalog profiles`；`doctor --json`；`memory doctor --json`；`memory init --scope project --json` | 子命令均为 0；包装脚本因 zsh 未分词把全部单测路径当成一个模块，单测段失败 | help 列出全部主命令；7 个 profile；doctor 空收据；memory doctor 空仓 ok；init 只写隔离 `.ecc/memory/project` | `ecc-offline-tests-20260905.log` 9703 B SHA-256 `982a273a816af49e0ef9e266b8622ed0f2dd543a4665b71f7b0901fd4af1432e` |
| ecc-unit-subset | bash 数组逐个 `node tests/...` 共 16 文件 | 包装 0；其中 mcp-inventory=1、ecc.test.js=1，其余 0 | 见 §15；ecc.test 缺 ajv/sql.js；mcp 缺 toml | `ecc-unit-tests-20260905.log` 31550 B SHA-256 `13df73276909a2d8fec4ad921db5292b48a4a8e4b61139e528de22963a151863` |
| contextview-six-gates | 快照仓六条 required gate | 全部 0 | docs 10 根文件/22 canonical；traceability 249=249；corpus 19/19 静态坐标、2 oracle、589 doctor cases；semantic-team 16+5；unittest 144 tests OK（89.6s） | `contextview-gates-20260905.log` 3098 B SHA-256 `5417b033c60d7320f6eb45536b2788a12d7fa6d43e56d6cb1a6441c30e0bdc56` |

未跑：`tests/run-all.js`、`npm test`、`cargo test`、`install.sh`、真实 Claude/Cursor、`ecc control-pane` 监听、`security-ioc-scan --home`、Python llm 测试。

局限：单测进程出现 Node 22.23.1 与 26.5.0 两种栈（ecc.test 失败栈为 v26.5.0）。未声称矩阵等价。ContextView unittest 日志中夹杂 mutation 夹具打印的 `18/19`、`251/250` 行，属于负例脚本输出，**主结果仍是 Ran 144 tests OK**。

## 20. 外部来源表

| 来源 | 访问 | 用途 | 注意 |
| --- | --- | --- | --- |
| https://github.com/affaan-m/ECC | 2026-09-05 `gh api` | 描述、star、license、push 时间 | web_fetch 被 SSRF 拦截，改用 gh |
| https://github.com/affaan-m/ECC/releases | 2026-09-05 `gh api` | v2.2.0 … v1.7.0 | 无 v2.2.1 tag |
| https://registry.npmjs.org/ecc-universal | 2026-09-05 curl | latest 2.2.0，无 2.2.1 | 本机 `npm view` 因 cache EPERM 失败，以 registry GET 为准 |
| https://api.npmjs.org/downloads/point/last-month/ecc-universal | 2026-09-05 | 16104 | 不是 GitHub star |
| https://registry.npmjs.org/ecc-agentshield | 2026-09-05 | 1.4.0，2026-03-21 | 与 ECC 2.2 不同步 |
| https://ecc.tools/ | 2026-09-05 curl 200，404173 B | 261 skills / 64 agents / 84 commands / 210K+ | 与源码不一致 |
| https://ecc.tools/skills | 2026-09-05 | 91/18/48/157 | 选择性安装构建器，不是全仓 |
| https://ecc.tools/changelog | 2026-09-05 | 2.0 shipped 叙事、instinct 自动 prune | 营销日历 |
| https://ecc.tools/platforms `/pricing` `/app` | 搜索摘要 + 部分页面 | 商业层 | 未当实现证据 |
| GitHub Release v2.0.0 文案 | 搜索/API | 261 skills 历史宣称 | 过期 |
| `gh api /advisories/GHSA-hfpv-w6mp-5g95` | 2026-09-05 | 404 | 未验证公开 advisory |

Claude Code / Codex 官方 hook/skill 文档未整本复述；ECC 对宿主行为的适配以 ECC 源码为准。

## 21. 待 reviewer 关注

1. 版本钉：是否接受“源码 2.2.1-unreleased + npm 2.2.0 + SHA e04ea0b”三坐标并存。
2. 官网数字过期是否需要在方案里写成硬门（禁止再引用 261/210K 当现状）。
3. 缺 npm 依赖的测试红，应标“环境局限”还是“ECC 对未 install 的 fail 面”。
4. GHSA 404 的披露口径。
5. ContextView cutoff：HEAD 2.2.1 时间戳仍早于 cutoff，但 **不是** 18 family 之一；方案是否足够防止“加第 19 个 required family”。
6. 日志未能写入约定的 `../logs`（沙盒拒绝）。SHA 是否仍可接受。
7. 未编译 ecc2、未跑全量 JS 测试：成熟度章节是否过度推断。
8. R1 已按源码把 Codex native `SessionStart` 与 Claude 七事件、legacy sync 分列；R2 请核验是否仍把 `cross-harness.md` 旧句当成实现。本轮 **未**重跑 ECC 全套测试与 ContextView 89 秒门禁。

## 22. 独立 review 修订区

本文件由实施线撰写。禁止在本区或文首自宣 GREEN。R2 已确认技术/合同问题闭合，剩余最终目录的配套报告打包缺口；本稿补齐接收集合，R3 待独立核验。

| 轮次 | 角色 | 结论 | 修订要点 |
| --- | --- | --- | --- |
| R0 | 实施（本文件） | 未评审 | — |
| R1 | 独立 reviewer | **RED**（无 P0，4 个 P1） | 见下；3 条 P2 已记入父 supervisor 唯一 ledger，本轮只记录不修 |
| R1 回修 | 实施 | 未自判 GREEN | 按下表回修 P1；R2 待复核 |

R1 P1 回修（对照冻结 ECC SHA 与本仓源码，不宣称验收通过）：

1. **P1-01 / A1**：Codex hooks 不再写成 instruction-backed。按 Claude plugin、Codex native plugin、Codex legacy sync 三列重写平台/MCP 表与 §8 逐事件表。Codex native 当前仅为 `/hooks` 显式信任的 `SessionStart` 子集；其余 Claude 事件逐项判定。指出 `cross-harness.md` / compliance 矩阵相对 `plugin.json` + `codex-hooks.json` + `harness-capabilities.js` 的文档漂移。安装声明不升 Model-visible / UseEvidence / Outcome-affecting。
2. **P1-02 / A4**：取消 `acceptance/field-to-claim/ecc-overlay.yaml`。改在 Contexpect 方案中选择版本化 overlay-to-claim 设计候选，先放 research/spec 提案域。
3. **P1-03 / A5**：corpus 第一阶段只做自有 Apache-2.0 合成夹具；真实 MIT 样本是另一条件包。两处规程统一。不得用 Apache 头覆盖 MIT 身份。
4. **P1-04 / A3**：SayDo S-03 固定 `source.kind=import` → `trust=candidate` + taint；禁止调用方自报 trust / DAO 旁路。

R1 P2（父 ledger 已收，本轮不改正文口径）：证据字段 `exit_code` 与包装脚本聚合状态歧义；rules 计数 121/122；`InstallReceipt.sourceRevision` 与现有 Digest 编码。

保留原实测披露：mcp-inventory 18/2 红、ecc.test 16/6 红、未 npm install、未跑全套、未触发真实 hooks、ContextView 六门 144 OK 为本轮之前日志、本轮未重跑 89 秒门禁。

---

证据索引：`research/ecc/evidence-index.json`。
SayDo 候选方案：`docs/plan/2026-09-05-ecc-borrowing-plan.md`。
ContextView 候选方案档案：`research/ecc/2026-09-05-contextview-ecc-borrowing-plan.md`。

## 最终接收集合与一次 P2 收尾

R2 明确前 4 个 P1 均已闭合，仅指出 Contexpect 同目录报告缺失。接收集合现包含 `docs/research/2026-09-05-ecc-borrowing-plan.md`、`docs/research/2026-09-05-ecc-project-research.md` 和 `docs/research/ecc-evidence-index.json`，并已追加到 Contexpect `docs/README.md`。SayDo 保留原调研档案及其专用方案。

本轮唯一最终 P2 sweep 依据 R1/R2 的同一台账作三项机械校正：规则总数明确包含 README；测试记录区分包装进程 exit 0 与子测试聚合失败；安装收据示例复用现有 `RuntimeIdentity.sourceRevision` 裸 hex 编码。历史评审段保留当时口径，当前引用以修订正文和证据索引为准。R3 的独立结论与最终门禁另记交付核验记录，本段不自判 GREEN。
