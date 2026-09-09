<!-- ecc-final:superseded -->
> 历史归档：本文件已由[最终统一稿](2026-09-05-ecc-borrowing-final.md)替代。下方正文、旧 SoT 声明和评审状态保留用于追溯，不再作为当前实施入口。

# ECC 借鉴融合终稿:SayDo

> **本文是 SoT**,supersedes 两份同日来源:
> - F:本会话评估 `2026-09-05-ecc-borrowing-assessment.fable.md`(v2,两轮零上下文复审 GREEN;其 A/B/C 全量登记表、承重盘点与评审记录继续有效,本文按 E 编号引用)
> - G:GPT 线方案 `2026-09-05-ecc-borrowing-plan.md`(R3 GREEN;配套调研 `research/ecc/2026-09-05-ecc-project-research.md`、评审核验 `research/codex-findings/2026-09-05-ecc-research-review.md`)
> 对方能力登记表:ContextView 仓 `docs/research/2026-09-05-ecc-everything-claude-code-research.md` §6(E-01–E-110)。
> 坐标:ECC git `e04ea0b9`(2026-09-03,tag v2.2.0 之后 147 commit);npm `ecc-universal@2.2.0`(registry 无 2.2.1);license MIT。本产品 `main` @ `bcf8ea8`;schedule-pointer `active=none, next=PG-01B, last_closed=PROC-01`(本会话 `scripts/schedule-pointer.mjs --check`)。
> 证据纪律:本文每条裁决只依据本会话实读的代码或命令输出。裁决词:确认 / 部分成立 / 证伪 / 未验证。零 emoji。

## TL;DR

**两条来源的核心判断一致且正确**:不借 ECC 任何运行时,不把 ECC 装进 SayDo 派出的 agent,不让 ECC 成为第二套 daemon、执行控制或排产源。F 线把这条判断落到代码:Tier1 用 `--setting-sources "" --strict-mcp-config --settings <本批 hooks>` 起 `claude -p`(`packages/daemon/src/tier1/backends/claude.ts:66-90`),ECC hooks 在这条路径上不会加载;G 线把它落到原则:ECC 是"模型可关掉的 hooks",SayDo 是"模型关不掉的 daemon"。

**两条来源的分歧在"借什么"**。F 线找到五个有 file:line 证据的真实缺口(记忆写路径不拒 secret 形态、`.saydo/` gitignore 文档有代码无、无工具循环信号、无笼子逃逸哨兵测试、CI 无 `pnpm audit`)与三条效果词表小项。G 线七条建议中三条前提不成立(S-02 安装时 hook 同意:SayDo 不往用户 harness 装 hook;S-05 MCP 脱敏清单:SayDo 无消费者且 `--strict-mcp-config` 关闭宿主 MCP;S-06 上下文余量字段:`claude -p` 路径无 statusline,`usage` 已解析),两条已被 PG-02 或现有能力覆盖(S-04、S-07),一条无需求但约束写得对(S-03 记忆导入),**一条是 F 线漏掉的真实角度(S-01:SayDo 自己的分发面缺安装收据与 doctor/uninstall,对应缺口 G-B12)**。

**第一刀(4 条不变,来自 F 线;全部需 owner 在链上给位置)**:

1. 记忆写路径拒 secret 形态(A;E-34):`MemoryLedger.add` 前复用 `voice/redactor.ts:22-34` 模式,命中拒写、审计只记 digest;回写 09 §13 `remember` 错误码 + §12-4 反例。
2. `<workspace>/.saydo/` create-only gitignore(A;E-34):保留 `docs/03-architecture.md:143` 的团队共享分支,开关放 daemon 受控 `project_settings`(`storage/ddl.ts:193,300-303`),须同时回写 02 §5.1、09 §9 与 `projectOverridesSchema`(`config/projectOverrides.ts:18-33` 是封闭 strictObject)。
3. 笼子逃逸哨兵 live 测试(B;E-68)。
4. CI 供应链两小项(B;E-73/E-75):`pnpm audit --prod --audit-level=high`;`--ignore-scripts` 与 `pnpm.allowBuilds`(`package.json:24-30`)关系为首个核实点;须 owner 选入 PG-02/PG-03 scope。

**新增一条 deferred_with_trigger(来自 G 线)**:S-01 安装收据 + doctor/uninstall dry-run,触发条件是 owner 立 G-B12 产品级分发批。

**裁决计数**:来源 claim 裁决 确认×24 / 部分成立×3 / 证伪×3 / 未验证×1(确认清单见附录,其余见 §2–§4);借鉴裁决沿用 F 线 A×2 / B×14 / C×49,本文新增 G 线条目裁决 7 行(B×1 deferred / C×6)。

## 1. 确认的结论(合并后的借鉴清单)

来源列:F = 本会话评估;G = GPT 线;F+G = 两者一致。

### 1.1 daemon 侧改造项(需 owner 给链上位置)

| 项 | 来源 | 本产品证据 | 裁决 |
| --- | --- | --- | --- |
| 记忆写路径拒 secret 形态 | F(G 只在 S-03 导入适配器指标里提到) | `memory/classify.ts:10-27` 只有指令词与第三方来源判定;`voice/redactor.ts:22-34` 已有 PEM / 云 key / token 模式 | A(E-34) |
| `.saydo/` create-only gitignore + 团队共享开关 | F | `docs/03-architecture.md:143` 有,`packages/daemon/src` grep `gitignore` 零命中;`memory/foundation.ts:180-182` 直接落盘 | A(E-34) |
| 笼子逃逸哨兵测试 | F+G(G S-C4/E-68 同源) | `providers/byoa/cage.ts:48-58,66-76`;`test/byoa-fake-cli.e2e.test.ts:714-737` 只断言空隔离 cwd | B(E-68) |
| 工具循环信号 | F | `approvals/circuitBreakers.ts:1-12` 三熔断;tier1/approvals 无重复检测 | B(E-20);blocked 原因回写 docs/10 §2.4 :119 + `contracts/src/tier1Presentation.ts:12-19` |
| 效果词表三小项(config 写入提前升 S2、`--no-verify`/`core.hooksPath=`、heredoc 反例) | F | `tier1/cmdEffect.ts:418-419` 只识别 force 族;`fileToolEffect.ts:8-9`;`verifyFreeze.ts:86-96` | B(E-18/E-106/E-107);回写 04 §5.1 |

### 1.2 仓库工程与分发面

| 项 | 来源 | 本产品证据 | 裁决 |
| --- | --- | --- | --- |
| CI `pnpm audit` 与 Actions 加固 | F | `ci.yml:28,73,109` 无 audit 步骤;全部 `uses:` 钉 SHA、`persist-credentials: false` | B(E-73/E-75) |
| **安装所有权收据 + doctor / uninstall dry-run** | **G(S-01)** | `packages/cli/README.md:15-24` 只 `npm install --global <tgz>` + `saydo up`;`packages/cli/src` 无 doctor;`supervisor.ts:30,73` 只建 `~/.saydo/runtime`;缺口 G-B12(`docs/plan/2026-08-28-project-gap-closure-program.md:136,951`)owner 已定"当前为 Developer Preview,真实需求达线再做";`RuntimeIdentity.sourceRevision` 已是裸 hex(`packages/contracts/src/runtime.ts:6`) | **B,deferred_with_trigger**:触发 = owner 立 G-B12 分发批;形状按 G §10 草案(`saydo.install.v1`,`managed[]` path+sha256+origin,`sourceRevision` 复用现有裸 hex,`hookConsent` 仅 not-applicable);doctor 只对照收据、不出总分、不扫 sessions 正文;不 vendor ECC 安装器 |
| hook/探针能力披露词表 | F+G(G S-02 的可用部分) | `SetupWizard.tsx` 四步进度;无分类披露 | B(E-29):SetupWizard 文案骨架;**不是**安装同意流程(见 §2 #2) |
| competing prompt 作 golden 第三档 | F | docs/10 §6 两档 | B(E-67) |

## 2. 硬矛盾仲裁记录

| # | 矛盾 | 终审 | 仲裁理由(代码) |
| --- | --- | --- | --- |
| 1 | **分发面**:G S-01 判 A(安装收据+doctor);F 把 E-44–E-54 整体判 C("SayDo 不安装到 harness") | G 的角度成立,F 判错了对象:ECC 账本对 SayDo 的意义不是"装进 harness",而是 SayDo **自己的** `saydo up` 分发面没有收据与 doctor;但 owner 已在 G-B12 决定推迟,故 B deferred | `packages/cli/src/supervisor.ts:30,73`;PG 总案 `:136,951` |
| 2 | **hook 同意**:G S-02 要"安装确认项,缺省 declined";F E-29 只借披露词表 | 采 F:SayDo 不往用户 Claude/Cursor 全局装任何 hook,claude 走每 run `--settings`,cursor 的 hooks.json 由 `tier1/adapter.ts:125` 在每次 run 写入任务作用域;没有"安装时"这一步,同意流程无处落地。披露词表进 SetupWizard 的探针/BYOA 文案 | `backends/claude.ts:78-79`;`tier1/adapter.ts:56-62,125` |
| 3 | **记忆**:G S-03 建 `ecc.memory.v1` 导入适配器(B);F E-33 判 C | 采 F 的 C,但保留 G 写对的约束作未来任何 importer 的合同:`source.kind=import` → `classifyTrust` 确定性 `candidate` + taint(`classify.ts:23`);Ledger 不信调用方自报 trust(`ledger.ts:88-95`);`third_party` 在 compiler 全排除而 `candidate` 非 M0 只读标注(`compiler.ts:91-93`;09 §5 规则①);不绑 `readinessKey`;升格只走 `approveCandidate`。当前没有任何 SayDo 文档提出"导入 ECC 记忆"的需求,建导入器是无消费者的功能 | 同左 |
| 4 | **MCP 清单**:G S-05 要 doctor 只读扫描 `.mcp.json` 输出脱敏 signature | C:SayDo 不做 MCP 宿主(DSH 评估 D-21),Tier1 `--strict-mcp-config` 关闭宿主 MCP,没有消费者;`voice/redactor.ts` 已有脱敏模式,若将来 doctor 要列宿主配置,复用即可 | `backends/claude.ts:77` |
| 5 | **上下文余量**:G S-06 要展示 host-reported remaining% | C:`claude -p` 路径没有 statusline stdin;Tier1 已解析 result `usage`/`total_cost_usd`(`backends/claude.ts:211-220`,`claudeOutcome.ts:121-144`),成本三态已有;G 自己也标 P2 | 同左 |
| 6 | **能力诚实表**:G S-04 判 A 跟随 PG-02;F E-07 判 C 指向 D-14/PG-02 | 同一结论的两种写法;终稿记 C(已规划),不另开条目 | PG 总案 §20 PG-02 |
| 7 | **worktree 观测**:G S-07 默认 C,owner 要排障面板时 B;F E-62/E-63 判 C | C;与 F 的 P2-01(TCAS,W6 时再评)合并 | 04 §6 |

## 3. 证伪 / 降级清单

| 来源 | 原 claim | 裁决 | 实际情况 |
| --- | --- | --- | --- |
| G S-02 | "Tier1 `claude_code`/`cursor` hook 安装说明与 console 设置页……把将安装哪些 hook 做成安装确认项,缺省 declined" | 证伪(前提) | SayDo 不安装 hook 到用户 harness;每 run 生成(§2 #2) |
| G S-05 | daemon 诊断只读扫描宿主 MCP 配置 | 证伪(无消费者) | §2 #4 |
| G S-06 | 展示宿主 remaining% | 证伪(无该输入) | §2 #5 |
| G 方案 §2 表 | "分发:`install.sh` / `install.ps1` 钉 rc.12" | 部分成立 | 仓内无 `scripts/install*`;pin 在 `packages/cli/README.md:10,16` 的 tgz URL(`v0.1.0-rc.12`) |
| G 调研 §13 | `scripts/lib/worktree-lifecycle.js` | 部分成立 | ECC 实际为 `scripts/worktree-lifecycle.js` + `scripts/lib/worktree-lifecycle/` |
| F E-44–E-54 | 整体 C,"SayDo 不安装到 harness" | 部分成立 | 对 harness 安装成立;对 SayDo 自身分发面漏判(§2 #1) |
| F 复审 1 所列 | `docs/03:368`、`.saydo/sessions` 位置、pnpm 配置、`THIRD_PARTY_NOTICES` 路径等 | 已在 F v2 修正 | 见 F 评审记录 |

## 4. 未验证项

| 项 | 卡在哪 |
| --- | --- |
| G 调研的 ECC 单测结果(mcp-inventory 18/2、ecc.test 16/6 因缺 `@iarna/toml`/`ajv`/`sql.js`) | 本会话未跑 ECC 测试;G 已如实标注缺依赖;对 SayDo 裁决无影响 |

## 5. 红线(合并)

1. **Tier1 剥离用户配置**是护城河:`--setting-sources ""`、`--strict-mcp-config`、`claudeEnvOverrides` 禁自更新;不把 ECC hooks/skills/rules 引入 SayDo 派出的 agent。
2. **Gate 0 无 bypass、S3 语音绝不放行**;ECC `permission-mode`/`--dangerously-skip-permissions` 旋钮与 skill 级 safety-guard 不能替代审批 socket。
3. **记忆写路径 candidate → trusted、M0 拒第三方**:任何 importer 都走 `ledger.add`,不传 `requestedTrust`,不 DAO 旁路,不绑 readiness(G S-03 约束)。
4. **审计不可变、敏感只记 digest**:secret 拒写只审计 digest 与模式名。
5. **零 emoji、状态词纪律**:搬任何 ECC 文案前过 `check-emoji.sh`。
6. **不做 MCP 宿主、不做控制面/看板/多 agent 编排**。
7. **排产单源与 exact-set**:本文不是排产源;daemon 侧项只有"owner 插入 daemon 小批"或"owner 选入 PG 批 scope roots"两条路;否则 deferred_with_trigger。
8. **project.toml 是不可信输入**:共享/放松开关只放 daemon 受控 `project_settings`。
9. **License**:MIT;复制 ECC 文本进 SayDo 源码须在 `packages/cli/THIRD_PARTY_NOTICES.md`(`scripts/third-party-notices.mjs` 生成)登记;不引入 `ecc-universal`;不跟随 ECC HEAD 做 submodule(G S-C9)。
10. **锁版本执行后端不照搬 auto-update**(G §1 表 auto-update → C):SayDo 二进制身份 pin(`tier1/claudeIdentity.ts`)与发布铁律优先。

## 6. 承重现状(防重复误判)

沿用 F 线十二条(外部审批门四律与 canary、verify 冻结与 config 闭包、效果分级、凭据剥离白名单、二进制身份 pin、三熔断与启动对账、记忆 provenance、工作区 BigInt 身份、成本三态与用量解析、仓库卫生门、发布纪律、PG-02 能力 ledger)。G 线 §2 表的"已具备"七行(对话域真相源、记忆写路径、执行控制、执行路线、审计、分发、排产)与之一致;G 新增一条本文采纳:`RuntimeIdentity.sourceRevision` 已是 7–64 位裸 hex(`contracts/src/runtime.ts:6`),任何收据草案不得另造带前缀的同名字段。

一句话:**ECC 把"不让 agent 乱来"做成模型可关掉的 hooks;SayDo 把它做成模型关不掉的 daemon。**

## 7. 第一刀(落点 / canonical 回写 / owner 决策)

| 序 | 项 | 落点 | canonical 回写 | owner 决策 |
| --- | --- | --- | --- | --- |
| 1 | E-34/E-26 记忆写路径与 Tier1 事件消费拒 secret 形态(A) | `memory/ledger.ts` `add` 前 + `brain/liveTools.ts` `remember` + Tier1 事件消费;复用 `voice/redactor.ts` | 09 §13 `remember` 错误码;§12-4 反例 +2 | 是:链上位置 |
| 2 | E-34 `.saydo/` gitignore(A) | `memory/foundation.ts` 与 `projects/workspace.ts` 登记时 create-only 写;开关入 `project_settings` | 03:143;02 §5.1 覆盖面表;09 §9 `project_settings` 注(:917-919)与 `projectOverridesSchema`;09 §11;10 话术 +1 | 是:三选一(内容不符拒写 / 只提示 / 受控开关放行)+ 链上位置 |
| 3 | E-68 笼子逃逸哨兵 live 测试(B) | `packages/daemon/test/byoa-*.e2e.test.ts` + tier1 conformance;`SAYDO_SLOW_E2E` 门控 | cursor 结果标 `enforcement: partial`(D-14) | 是:链上位置 |
| 4 | E-73/E-75 CI 供应链(B) | `justfile` ci-node、`.github/workflows/{ci,release}.yml` | PG-02 gate registry 条目;PG-03 control graph | 是:是否选入 PG-02/PG-03 scope;`minimumReleaseAge` 是否启用 |
| 5 | E-20 工具循环信号(B) | Tier1 事件消费 + blocked 原因单源 | docs/10 §2.4 :119 新增 `tool_loop_detected`;`tier1Presentation.ts:12-19`(其注释"§3.4"为陈旧编号,同批纠正) | 是:链上位置 |
| 6 | E-18/E-106/E-107 效果词表三小项(B) | `fileToolEffect.ts`、`cmdEffect.ts` git 分支、§12 反例 | 04 §5.1 例子表与升级规则 | 是:链上位置 |
| 7 | **G S-01 安装收据 + doctor/uninstall dry-run(B,deferred)** | `packages/cli`(`saydo doctor`、`saydo uninstall --dry-run`)+ 分发脚本写 `managed[]` | 09 新增可选诊断类型(G §10 草案形状);`packages/cli/README.md` | 是:触发 = 立 G-B12 分发批;不早于 PG 链 |
| 8 | E-29 披露词表、E-67 competing golden、E-17b 任务卡提示、E-37 两条机械规则、E-41 codex 参考 | 各自 P1 / 对应批 | docs/11 §5.8a、docs/10 §6 | 否(deferred_with_trigger,见 F 评估 P2-05–P2-09) |

与进行中工作的冲突:PG-01B scope roots 为 `packages/daemon/src/net/**`、`index.ts`(PG 总案 §20),不含 `memory/**`、`tier1/**`、`providers/byoa/**`、`packages/cli/**`。第 1/2/3/5/6 项建议合成一个只改 daemon 的小批,位置由 owner 定;第 4 项由 owner 选入 PG-02/PG-03;第 7 项随 G-B12;第 8 项 deferred。

## 8. 不借清单

沿用 F 线 C 项汇总与 G 线 S-C1–S-C10(替换 daemon/console、ECC orch/ecc2 替换 Tier1、instinct 注入与 auto-prune、默认 hooks 进 `~/.claude`、286 skills 整包、模型降档当优化、`ecc ito`/Nasiko 赞助桥、`ecc-memory-mcp` 作 Brain 工具、跟随 HEAD 做 submodule、第二套排产源)。两者无冲突。G 线的反模式剧本(§11 六条:`instinctConfidence` 进 daemon、deploy 顺手拷 hooks.json、console 用 star 数营销、ecc2 SQLite 替代 `audit_log`、doctor 无收据报 ok、把方案当 PLAN-2 next)采纳为未来 reviewer 夹具。

## 9. Deferred P2 ledger

沿用 F 线 P2-01–P2-09。新增:

- P2-10:G S-01 安装收据形状(`saydo.install.v1`)与 `saydo doctor` 只读语义;触发 = G-B12 分发批立项。
- P2-11:G S-03 记忆 importer 合同约束(import → candidate + taint,无 requestedTrust,无 readinessKey,`approveCandidate` 升格);触发 = 任何第三方记忆导入需求出现。
- P2-12:G S-06 host-reported 上下文余量字段;触发 = Tier1 接入带 statusline 的交互式后端。

## 10. 来源质量评估

| 来源 | 命中 | 虚报/降级 | 评价 |
| --- | --- | --- | --- |
| F(本会话评估 v2) | 65 行登记表全部有 file:line;复审 2 抽核 42 条 39 OK | 复审 1 曾错 8 处坐标/计数(已修);本轮再降 1 处(E-44–E-54 漏判 SayDo 自身分发面) | 缺口发现与排产/合同回写纪律更强 |
| G(GPT 线方案 + 调研 + 核验) | SayDo 写路径与 Context Pack 语义描述准确(`classify.ts:23`、`ledger.ts:88`、`compiler.ts:91`、09 规则①);G-B12 角度正确;ECC 分层与 fail-open 事实全部核实 | 7 条建议中 3 条前提不成立(S-02/S-05/S-06),2 条与既有规划重复(S-04/S-07),1 条无消费者(S-03) | 对 SayDo 架构的理解停留在文档层,未核对 Tier1 hook 的实际生成方式;分发面角度是唯一独有贡献 |

## 11. 门禁与状态

- 本文与 supersede 标记、索引改动完成后重跑:`bash scripts/check-emoji.sh`、`node scripts/check-doc-links.mjs`、`node scripts/check-public-tree-privacy.mjs --fs`、`node scripts/schedule-pointer.mjs --check`(结果见聊天回复中的本会话输出)。
- 未 commit / push;未改产品代码、canonical 或 schedule-pointer;本文不是排产授权。

## 附录:确认的来源 claim 清单(24 条,均为本会话实读)

| # | claim(来源) | 证据 |
| --- | --- | --- |
| 1 | `source.kind=import` 属 `THIRD_PARTY_KINDS`,分类器确定性降为 candidate(G) | `packages/daemon/src/memory/classify.ts:23` |
| 2 | Ledger 不信调用方自报 trust(除 user_stated/approved)(G) | `memory/ledger.ts:88-95` |
| 3 | compiler 对 `third_party` 全排除(G) | `memory/compiler.ts:91-93` |
| 4 | 09 编译规则①:`candidate(只读标注) > third_party(默认排除)`(G) | `docs/09-data-contracts.md:524` |
| 5 | 缺口 G-B12:一键包不含 doctor/upgrade/uninstall,owner 已定 Developer Preview(G) | PG 总案 `:136,951` |
| 6 | 分发 pin `v0.1.0-rc.12` tgz(G,路径修正) | `packages/cli/README.md:10,16` |
| 7 | `RuntimeIdentity.sourceRevision` 为 7–64 位裸 hex(G) | `packages/contracts/src/runtime.ts:6`;09 `:1572-1575` |
| 8 | `packages/cli/src` 无 doctor 子命令(G) | 目录实读 |
| 9 | `saydo up` 只建 `~/.saydo/runtime`(G) | `packages/cli/src/supervisor.ts:30,73` |
| 10 | schedule-pointer `active=none next=PG-01B last_closed=PROC-01`(F+G) | `scripts/schedule-pointer.mjs --check` |
| 11 | SayDo HEAD `bcf8ea8`(F+G) | `git log` |
| 12 | Tier1 `--setting-sources ""`、`--strict-mcp-config`、每 run `--settings`(F+G) | `tier1/backends/claude.ts:75-79` |
| 13 | cursor hooks.json 由 adapter 每 run 写入,只挂 `beforeShellExecution`(F) | `tier1/adapter.ts:56-62,125` |
| 14 | ECC Claude plugin `hooks_enabled.default = true`(G) | ECC `.claude-plugin/plugin.json:26-30` |
| 15 | ECC `check-hook-enabled` 无 id 即 `yes`(G) | ECC `scripts/hooks/check-hook-enabled.js:6-8` |
| 16 | ECC metrics bridge failing open(G) | ECC `scripts/hooks/ecc-metrics-bridge.js:201` |
| 17 | ECC memory vault secret 拒写 + project gitignore fail-closed(F+G) | ECC `scripts/lib/memory-vault.js:37,243-262,319-325` |
| 18 | ECC hook-consent 六组披露(F+G) | ECC `scripts/lib/install/hook-consent.js:12-36` |
| 19 | ECC path-safety 引用 GHSA 且公开 advisory 404(F+G) | ECC `scripts/lib/path-safety.js:7-14`;`gh api` 404 |
| 20 | ECC auto-update = pull 最新 + 原 request 重装(G) | ECC `scripts/auto-update.js:16-17,87-99` |
| 21 | ECC `ecc ito find` 提交真实 RFQ(G) | ECC `scripts/ito.js:34,50` |
| 22 | ECC token-optimization 推荐 sonnet / 10000 / haiku(G) | ECC `docs/token-optimization.md:17-20,29,31` |
| 23 | ECC control pane 默认 DB 在 `~/.claude`(G) | ECC `scripts/lib/control-pane/state.js:13,20` |
| 24 | npm 2.2.0 为发布坐标,HEAD 在 v2.2.0 后 147 commit(G) | registry;`git rev-list` |
