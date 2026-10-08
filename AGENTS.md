# AGENTS.md — SayDo 单仓协作约定

> SayDo 的设计、实现、证据与过程档案统一维护在本仓。历史双目录迁移说明见
> `docs/plan/MIGRATION.md`;旧路径 `voice-coding` 是指向 SayDo 的兼容链接，冻结冷档为
> `voice-coding.archive-20260729`，两者都不是第二个开发入口或真相源。
> 权威分界:计划管顺序与范围;canonical 管合同形状——形状冲突一律以 `docs/09-data-contracts.md` 为准。

## Canonical 与文档纪律

- `docs/01–11 + docs/modules/ + docs/adr/` 是唯一 canonical:
  `docs/adr/design/` 为设计决策序列，`docs/adr/` 根目录为工程决策序列，编号可重复但引用必须带“设计”或“工程”限定。
- `docs/09-data-contracts.md`、`docs/10-voice-ux-spec.md`、`docs/11-ui-spec.md` 是实施照抄源;
  `docs/plan/IMPLEMENTATION-PLAN-2.md` 是当前唯一排产源，但 `docs/plan/` 不属于合同 canonical。
- `research/` 是证据源，`history/` 是过程档案，`prompts/` 保存评审输入;
  迁移前冷档及未入 Git 的日志位置见 `docs/plan/MIGRATION.md`。
- 发现设计文档有错或缺口，先改 canonical 并完成相应一致性评审，再改代码;同一工作单元内让文档与实现保持可共同审查。
- 术语与状态口径以 `docs/06-references.md` 术语表为准(M0–M3 记忆 / S0–S3 风险 /
  `ready_for_review` 不等于完成 / 直达验收与逐步确认)，禁止再造同义词。
- 控制台结构正本 demo = `demo/saydo-console-redesign-proposal.html`,与
  `docs/08-module-design.md` §6 信息架构保持同步;Demo 中超出 P0 的元素必须标注分期,
  Demo 不得夹带文档没有的功能。`demo/saydo-console-demo.html` 与
  `demo/saydo-console-demo-atelier.html` 为留档旧稿,不作新页面基准。
- `demo/saydo-investor-demo-white-edition.html` 是对外投资人原型(全 mock,自成合同,
  不承担 §6 同步义务,不作实施照抄源);White Edition 视觉方向合同见
  `docs/11-ui-spec.md` §0.2。
- 修改 Demo/SVG 等可渲染资产后，用本机 headless Chrome 截图验证。

## 评审制度

普通任务当前会话直接处理，不强制初始化外部流程账本。用户要求监督交付或独立验收时采用相应流程；作者不自验，reviewer 只读冻结候选，数量与范围遵守用户明确要求。重大 canonical 语义变化先做一致性核对，再修改生产实现。

候选用真实 commit 或可复核的固定 diff 标识；评审前后检查输入未变，不依赖某个外部脚本版本作为所有任务前置。设计评审保留互补视角，轮次和预算以当前授权及已启动任务冻结合同为准，不重置旧额度。

保护已有工作；存在重叠改动时使用独立 worktree/clone。本轮继续既定独立树、双 reviewer 与阶段提交合同。战略与范围取舍由 owner 决定；已授权可逆工作连续推进。

报告与验证范围见 `.octoworkflow/project-profile.md`。保留重要决定、失败、未验项与真实证据；不要求每次小修复制流程账本。历史 profile 原文归档，旧任务冻结合同与累计资源不因新默认重置。

评审产物落盘后、收口前运行 `scripts/check-emoji.sh`。`*.log` 不入 Git；报告或 journal 记录所引用日志的文件名、字节数与 SHA-256。

## 仓库结构

- `packages/contracts` — docs/09 的 zod schema + JCS digest + 状态机 + renderSpoken + 契约测试
- `packages/daemon` — voiced daemon(TS/Node 22)，对话域 durable 状态唯一持有者
- `packages/console` — Web 控制台(Vite + React + Tailwind v4 + shadcn/ui + Lucide)
- `pipeline` — 语音管线(Python/Pipecat)，无状态可重启，经 WS 与 daemon 通信
- `e2e` — 端到端与证据:`e2e/evidence/phase-N.md`、`e2e/smoke/`
- `docs` — canonical、工程/设计 ADR 与实施计划
- `research` / `history` / `prompts` — 证据、过程档案与评审输入
- `demo` / `assets` / `templates` — 演示、品牌资产与可复制配置模板
- `scripts` — 门禁与工具脚本

## 硬规则(违者算 bug)

1. **零 emoji**(`docs/11-ui-spec.md` §12):全仓禁 emoji 与 pictographic 符号(勾/叉/警告符同禁);
   文本标记用 `[ok]/[warn]/[fail]`;文本箭头 `→`/`↔` 合法。
2. **状态词纪律**(`docs/10-voice-ux-spec.md` §1):执行状态永不说“完成/做完”;
   settle 后说“执行和检查都跑完了，等你验收”;合并后才说“交付了”。
3. **Gate 0 无 bypass**:`Gate 0 未关 => 拒 dispatch` 从 Phase 0 就存在;
   代码中不存在 bypass 分支，状态=显式配置+审计事件。
4. **S3 语音绝不放行**;verify 只认登记模板;TTS 脱敏(token/secret/完整路径不进语音);
   记忆写路径 candidate→trusted，M0 拒第三方。
5. **契约不分叉**:09 已有的类型不得在别处重定义，一律 import `@saydo/contracts`。
6. **审计与日志分流**(`docs/modules/e-crosscutting.md` E3):日志可轮转，审计不可变;
   敏感 payload 只记 digest，不记原文。

## 质量门

- 按实际影响选门：产品/共享依赖运行对应语言 lint、typecheck、单测与契约测试；`just ci` 是 Node/Python 本地基线，不宣称托管 CI 等效。
- 工具变更运行 `pnpm test:tools`，发布安装变更运行 `pnpm test:release`，UI 行为/接线变化运行真实浏览器；原生平台与分发专项单独验证。仅文档变更不默认重跑全部产品/浏览器。输入未变的既有证据可明确沿用，不冒充重跑。
- 前两轮已退役静态 truth-plane、RF 库存、迁移冻结、排产指针及固定宣传句门；历史失败不升级。本轮已退役发布事务历史周审生产者，待独立验收，保留的发布来源、事务与恢复合同见 `docs/09-data-contracts.md` §18。
- 适用 required gate 未验或未通过不得称完整交付；本地与实际远端 CI 分别报告。
- 授权提交后默认附验证摘要；证据需引用代码 SHA 或用户指定时采用代码/证据两提交，不自指。本轮仍按既定两提交法及先精简、再补足的阶段边界。
- 批量编辑后程序化核对落盘，长文件用 `wc -l` 和关键内容检索复核。

## 常用命令

- `just dev` — 起 daemon + pipeline + console
- `just ci` — 本地 Node/Python 基线(node/python 双矩阵 + emoji 与工作区隐私扫描;不是托管 CI 等效)
- `just backup` — SQLite/JSONL/knowledge 快照备份

## Cursor Cloud

- 开发入口仍是 `just dev` 与 `just ci`。环境启动脚本在 tmux 会话 `saydo-dev` 中运行 `node scripts/dev.mjs`(与 `just dev` 相同的三进程入口)。
- daemon 监听 `127.0.0.1:47100`(`GET /health`);控制台 Vite 监听 `127.0.0.1:47120`,并把 `/api`、`/health`、`/ws` 代理到 daemon。
- 控制台请求要带 capability token。打开 `http://127.0.0.1:47120/?token=` 再接 `~/.saydo/.cap-token` 的内容。该文件是本机密钥,不要写入日志、文档或提交。
- 语音管线在 `pipeline/`,用 `uv sync --frozen`(需要 Python `>=3.11`)。未安装 `uv` 时 `just dev` 跳过 pipeline,文本路径与控制台仍可启动。
- 对话模型要 owner 自备已登录的 AI CLI,或 OpenAI 兼容 API key。`/health`、控制台壳、空间与 Focus 写入不依赖该密钥。
- Node `>=22`。pnpm 版本以根 `package.json` 的 `packageManager` 为准。
- 仓库在 Cloud Agent 里位于 `/workspace`,不在登录用户的家目录下。daemon 只接受 owner home 之内的项目路径。环境里的 `just` 包装与启动脚本把 `HOME` 设为 `/workspace`(状态在 `/workspace/.saydo`,已 gitignore),并把 PATH 前的 Node 指到带 npm 的 nvm Node 22。Git 全局配置、pnpm store 与 uv cache 仍留在 `/home/ubuntu`。绕过 `just` 直接跑 `pnpm test` 时也要先 `export HOME=/workspace`,否则会报「路径必须位于 owner home 的子目录」。
- `packages/cli` 的 `run-owned-reap` 夹具用 `ps lstart` 写锁,Linux 上 supervisor 用 `/proc` starttime 比对。这 3 个用例在当前 main 上会红,不是缺依赖。

## 语言与身份

- 全部沟通、注释、文档使用简体中文;标识符与日志键用英文。
- owner 是唯一决策人，战略与商业取舍永远上浮，不代拍板。

<!-- saydo:knowledge:begin -->
SayDo 知识底座:.saydo/knowledge/current/core.md(generation 5;由 SayDo 奠基器维护,本块勿手改)
稳定结论投影:.saydo/knowledge/m1-notes.md(账本重投影,人批准的 M1 结论)
<!-- saydo:knowledge:end -->
