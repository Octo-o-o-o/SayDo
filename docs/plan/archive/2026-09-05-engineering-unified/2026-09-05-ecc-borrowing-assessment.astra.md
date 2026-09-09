<!-- ecc-final:superseded -->
> 历史归档：本文件已由[最终统一稿](2026-09-05-ecc-borrowing-final.md)替代。下方正文、旧 SoT 声明和评审状态保留用于追溯，不再作为当前实施入口。

# SayDo 对 ECC 的借鉴方案（Astra）

> **性质**：候选建议。不是排产、不是合同变更、不是产品施工授权。
> **版本**：astra.2（2026-09-05）。比较底稿为 Fable 评估，吸收旧 Codex 方案的证据边界与可执行验收；新方案做取舍，不拼接两份清单。本轮修订：P1 补全 AS-05 有限 Git grammar；最终一次 P2 sweep（crosswalk 行号、比较措辞、AS-01 发布语义、安全回退、文档状态、MIT 生成入口）。该状态为送审时记录；最终核验见本文末节。
> **状态：独立方案复审 R3 GREEN；12 项冻结阶段文档门禁通过。** 建议尚未实施，排产与合同未改。
> **基线 SHA**：SayDo `bcf8ea855f25b177888d9159f75e49214f3dd892`；ECC `e04ea0b9cc8248686edf5ac751cadff550e162b8`（源码 `VERSION` = `2.2.1`，不等于已发布 npm）；ContextView foundation `492fd5fe7183fc5517fb6a1ca811d8d5233eb1f3`。研究日 2026-09-05。无须营销计数。
> **排产**：`IMPLEMENTATION-PLAN-2.md` 指针 `active=none, next=PG-01B`。本文件条目不自动进入任何批；导入须未来 owner 按 D17 改指针。当前不改 canonical、不改产品代码。
> **历史来源**（保留不改）：[Fable 评估](2026-09-05-ecc-borrowing-assessment.fable.md)、[旧 Codex 方案](2026-09-05-ecc-borrowing-plan.md)。对照旧调研时不把 ContextView 当时工作树 HEAD 当本 clone 基线。旧 Codex 方案已写明源码 `VERSION=2.2.1` 不等于已发布 npm，不得再指控它把 2.2.1 写成已发布。

## 0. 比较结论（先于建议）

**Fable 更适合做借鉴决策底稿**：它把 ECC 与 SayDo 的方向差写清楚——ECC 把纪律放进用户交互式 harness（hooks/skills/instincts），SayDo 把纪律放在 daemon 外部门（Gate 0、S0–S3、verify 冻结、ledger provenance）。Tier1 用 `--setting-sources ""` 与 `--strict-mcp-config` 起 `claude -p`（`packages/daemon/src/tier1/backends/claude.ts:66-90`），用户装的 ECC hooks 在这条路径上不会加载。这是护城河，不是缺口。

**旧 Codex 方案的证据边界与验收更强**：S-03 把 `import -> candidate+taint` 与 `third_party` 全排除写死；安装收据误删防护、反模式剧本、正反例可判定。旧稿已明确源码 `2.2.1` 未发布。

相对 Fable 的收紧/风险提醒（不是把推演说成对方已主张）：E-34 只写复用 `voice/redactor` 已有 PEM/token 模式，没有主张整张 TTS 规则表照搬——方向接受，但具体实现必须只复用凭据子集，避免误搬 TTS 规则；笼子「输出无哨兵」是测试观察项，不能推成已有读隔离；E-20 要把循环信号作 blocked 原因，本方案收紧为先诊断；E-75 只要求评估 `--ignore-scripts`，并未决定全加。

**本方案取舍**：第一刀只做持久化隐私与 Git 保护（AS-01、AS-02）。笼子、循环、效果词表、CI advisory 写成有限机制，不假装已有更强合同。撤回「可选关闭审批门」「全机 MCP 清点」「本轮 ECC 记忆导入器」「把 `--ignore-scripts` 直接加进现有 pnpm 安装」。不重复 Gate 0 / S3 / M0 / ledger / verify / BigInt / PG-02。

ECC 机制（本文件自洽，不依赖另一仓报告）：

| 机制 | ECC 坐标（SHA `e04ea0b9`） | 对本产品的真实含义 |
| --- | --- | --- |
| 记忆写前 secret 形态拒绝 | `scripts/lib/memory-vault.js:319-325` 调 `findPotentialSecrets`（`memory-vault-format.js:49-60,282-287`） | 方向对；模式是 ECC 自己的 key 前缀表，不能当 SayDo 安全证明 |
| project 作用域 create-only gitignore | `memory-vault.js:37,243-262`，内容必须恰为 `*\n!.gitignore\n` | 保护语义可借；字节全等 `*` 覆盖整个 `.saydo` 与 03:143 团队共享冲突 |
| hook 六类能力披露 | `scripts/lib/install/hook-consent.js:12-36` | 只借披露词表作探针文案；SayDo 审批门没有「缺省 declined」 |
| 5 次相同 tool+参数 | `scripts/hooks/ecc-context-monitor.js:18-28,97-115` | 可作诊断信号，不能直接改 blocked 合同 |
| `--no-verify` / `core.hooksPath` | `scripts/hooks/block-no-verify.js:1-30` | 须按 git 子命令 grammar 收紧，不能把 `git push -n` 当绕过 |
| heredoc 被动 sink | `scripts/hooks/gateguard-heredoc.js:1-25` | 只作正反例输入；`cat <<EOF \| sh` 不是天然 S3 |
| 笼子哨兵 | `skills/council-multi-model/SKILL.md:78-125` | 测试思想可借；须按本仓 provider 分档，不能证明读隔离 |
| 安装态账本 / doctor | `schemas/install-state.schema.json`、lifecycle doctor | G-B12 候选，不是本轮第一刀 |
| MCP 清点脱敏 | `scripts/lib/mcp-inventory/canonical-mcp.js` | 本期撤回；诊断需求出现再开 |

许可：MIT。借设计不 vendor `ecc-universal`，不把 ECC 装进 runtime 树或用户 Tier1 worktree。若不复制代码，只记录设计灵感。若实施复制 ECC 模式文本，必须在 `scripts/third-party-notices.mjs` 的来源登记入口保留版权声明与完整 MIT 文本后再生成 `packages/cli/THIRD_PARTY_NOTICES.md`；禁止手改该生成产物、禁止只记 SHA 代替许可全文。本次不修改该生成器。

## 1. 已具备与真实缺口

不得把 ECC hooks 目录当缺口清单。已具备：

1. 外部审批门：`tier1/gate.ts` fail-closed；Gate 0 无 bypass（`AGENTS.md` 硬规则 3）。
2. verify 白名单 + 内容冻结含 runner config 闭包（`tier1/verifyFreeze.ts:1-15,86-96`）。
3. 效果分级：`policy/engine.ts:39-50`；`cmdEffect.ts:1-14` 不可判上浮 S2；`fileToolEffect.ts:8-9` 敏感文件升 S2。缺的是 git 绕过旗标的子命令 grammar 与有限 heredoc 反例。
4. 记忆 provenance：append-only ledger、五级 trust、taint、forget 传播、compiler 规则（`memory/compiler.ts:1-8,23-29`）。`classifyTrust` 先信 `user_stated`/`user_approved`（`memory/classify.ts:63-77`）。
5. 工作区身份 BigInt `dev/ino`（`projects/workspace.ts:229-240`）。不跟随 reparse point。
6. TTS 脱敏（`voice/redactor.ts:22-47`）只覆盖口播出口，不是持久化闸。
7. 三熔断墙钟/回合/成本（`approvals/circuitBreakers.ts:1-12`），无工具循环信号。
8. run 级 usage/cost 已解析（`backends/claude.ts:204-225`），不是当前 context occupancy。
9. CI：workflow `uses:` 钉 40 位 SHA，checkout `persist-credentials: false`（`.github/workflows/ci.yml:16-18`）；`package.json:6,24-30` 锁 `pnpm@10.33.1`、Node `>=22`、`allowBuilds` 放行 `esbuild`/`koffi`、禁 `better-sqlite3`。无 `--ignore-scripts`，无 `pnpm audit` 证据绑定。
10. 能力 ledger 由 PG-02 规划，不另造。

真实缺口（本方案覆盖）：

- 任何新持久化工件在信任分级之前没有凭据字面量检测：`ledger.ts:91-114` 的 `add`（含 `supersedes`）直接 `classify -> insert`；`foundation.ts:243-268` 把 excerpts 写入 staging 再 publish；`foundation.ts:327-403` 把 AGENTS/CLAUDE/`.cursor/rules` 与 `package.json` scripts 原文写入 knowledge。
- `docs/03-architecture.md:143` 写知识库默认 gitignore，可显式团队共享；`packages/daemon/src` 无 gitignore 读写。
- 笼子测试把「输出无哨兵」误写成读隔离；`providers/byoa/cage.ts:1-5,47-98` 分档与 Cursor 无隔离 HOME 未被测试合同吸收。

## 2. 撤回项（相对 Fable / 旧 Codex）

| 原主张 | 处置 | 原因 |
| --- | --- | --- |
| 把 `voice/redactor.ts` 全表当记忆拒写 | 收紧 | Fable 未主张整表照搬；本轮风险提醒：只复用 PEM/token 凭据子集，避免误搬 TTS 规则（`env:NAME`、路径、digest、11–19 位数字、>=20 字符长串） |
| 熵估计自动拒写 | 撤回 | 不是安全边界；正则也不能证明「无 secret」 |
| 先写 staging 再告警 | 撤回 | 必须在进入新持久化工件之前拒绝/清洗 |
| 因资料含 secret 拒绝整个项目登记或改用户原文件 | 撤回 | 只拦本写入；用户原文件不动 |
| 自动删已有明文 / 改写 Git 历史 | 撤回 | 清理走既有 forget 受控流程 |
| 对整个 `.saydo` 要求字节全等 `*\n!.gitignore\n` | 撤回 | 与 03:143 共享条款冲突；已跟踪文件不受 gitignore 影响 |
| 一个 bool 绕过全部隐私 | 撤回 | 共享只开放审核过的知识投影 allowlist |
| 保护不足时 `git rm --cached` | 撤回 | 停新增敏感投影并给处方；不自动改索引 |
| 「输出无哨兵」= 读不到 | 撤回 | 只能证明未观测泄漏；超时/未发起访问 = unverified |
| 5 次相同 tool 直接 blocked | 收紧 | Fable E-20 提议作 blocked 原因；本方案先只读诊断，停跑须另修 circuit/blocked 合同 |
| `git push -n` 当 `--no-verify` 绕过 | 收紧 | 本轮按 git `-h` 拆子命令：push `-n`/`--dry-run` 是 dry-run；cherry-pick `-n` 是 `--no-commit`；不是同义绕过 |
| `cat <<EOF \| sh` 天然 S3 | 撤回 | 须落到 delete/send/受保护 merge 等既有效果 |
| CI 全加 `--ignore-scripts` | 收紧 | Fable 只写评估与 `allowBuilds` 关系，并未决定全加；默认不加，以免破坏 `esbuild`/`koffi` |
| `minimumReleaseAge` 本轮启用 | 延后 | 会延迟安全补丁 |
| 不断联网的无差别 audit hard gate | 撤回 | 网络错误不等于无漏洞 |
| S-02 hookConsent 默认 declined | 撤回 | 必要审批门没有可选关闭；只借披露文案 |
| S-05 全机 MCP 清点 | 本期撤回 | 按真实诊断需求再开 |
| S-03 ECC 记忆导入作本轮施工 | 延后 | 合同形状保留，见 §5 |
| S-01 安装 ownership/doctor 作第一刀 | 延后 | 仍是 G-B12 候选 |
| 读用户私人 transcript 做 occupancy | 撤回 | 不读私人日志 |
| `>=2` 项目或 remote URL hash 自动 promotion / 合并 trust | 撤回 | 只是提名/关联 hint，不替换 path+inode |
| 因仓无 hooks 断言 `GIT_DIR` 继承风险为零 | 不立项 | 无当前证据；引入 git hooks 时再记 |

## 3. 聚焦建议

推荐默认已选定。真正改 PLAN-2 / 09 词表须未来 owner checkpoint，不能用「owner 决定」代替机制。投入 S/M/L 假设：S = 单模块 + 合同回写 + 聚焦测试，约 1–2 工作日；M = 跨 canonical 多文件 + Git 真实查询，约 3–5 日；不含 live 凭据网络费用。AS-01 跨 ledger / foundation / 所属 canonical，投入 M，不声称只是单模块 1 日小改。

### AS-01 持久化入口的窄「凭据字面量」检测（推荐第一刀，M）

**机制**：抽纯函数 `findCredentialLiterals(text) -> {kind, spanDigest}[]`，与 TTS 展示策略分离。方向接受 Fable「复用 `voice/redactor` 已有 PEM/token 模式」，具体实现只复用凭据子集：PEM 私钥块、明确 token literal（`sk-`/`ghp_`/`github_pat_`/`xox[baprs]-`/`AKIA`/`ASIA` + 声明长度）。**不**纳入 TTS 表其余项：`env:NAME`、`sha256:` digest、ULID/Crockford 业务 id、路径、客户数字、>=20 字符泛长串、熵估计。保护层在 `classifyTrust` 与任何 `requestedTrust` 豁免之前。ledger 命中独立拒该事件：`MemoryLedger.add` / `remember` 不 insert，账本无原文。

**foundation 推荐默认（本期唯一合同）**：本次构建任一声明敏感面命中凭据字面量，则在**首次 raw 写入 staging 之前**终止「本次新 generation 发布」。旧已验证 generation 及 `current.json` pointer 不变；不得把旧 manifest 改成 `partial`；不得同时承诺发布新 generation。只返回本次构建受限/未发布的结构化结果（建议码如 `foundation_build_restricted`，名称在回写 09 时定）。项目登记与其它对话不因此停；用户原文件不改。若以后支持片段剔除后 partial 发布，需要另一合同定义，不写入本期。预算超限的既有 `partial` 续跑合同不套用到凭据命中。

**写路径（声明 write set）**：

1. `MemoryLedger.add`（`ledger.ts:89-116`）——含 supersedes。
2. `liveTools` `remember`（`brain/liveTools.ts:1273-1318`）——用户信任不能绕过。
3. foundation 构建（`foundation.ts:200-268,327-403`）：在读 KEY_FILES 原文进 excerpts 之后、`mkdirSync(staging)` / `writeKnowledgeDocs` 之前扫描。`:327-403` 会把多条文件写入 staging，不是单一敏感面：`core.md` 含 AGENTS/CLAUDE 摘录；`conventions.md` 含 AGENTS/CLAUDE 与现场读取的 `.cursor/rules`（`:392-397`，不经 excerpts map）；`build-test-run.md` 含 `package.json` scripts（`:368-377`）与 justfile 任务。当前规则读取与 package scripts 进入 staging 的路径必须在首次 raw 写入前覆盖；命中则整次新 generation 不发布。
4. 其它新持久化工件若本批触及（知识投影正文），同一函数，禁止第二套规则。

**正例**：claim 含 PEM 或 `ghp_` literal -> `add` 抛 `memory_secret_literal`，账本无原文，audit 只记 digest+kind；foundation 任一声明敏感面命中 -> 本次不创建 staging、不 publish、不改 `current.json`、旧 generation 保持原 status；返回受限/未发布结构化结果；`env:OPENAI_API_KEY`、`sha256:` 64 hex、SayDo id、测试夹具 `sk-test-placeholder` 可过。

**反例**：`requestedTrust=user_stated` 绕过；先写入 staging 再告警；把旧 manifest 改成 `partial` 同时发布新 generation；错误信息回显原文；因一个 excerpt 含 token 拒绝整个项目登记；改用户 AGENTS.md 原文件。

**失效**：新供应商 token 形态不在声明 grammar 内 = 已知漏检，不是「已证明无 secret」。

**回退**：方案尚未上线时可撤回本提案，不落地检测。上线后遇误伤：优先停受影响的新写入，保留旧有效数据与保护策略，按有证据的修订/回退合同恢复。不回放被拒 secret，不自动删库/改 Git 历史。不得「删除检测函数即可」而使已经选择的保护要求静默失效。

**canonical**（跨 ledger / foundation / 所属合同）：
- ledger/`remember`：09 §13 增建议码 `memory_secret_literal`；§12-4 正反例。不改 trust 枚举。foundation 错误不得只塞进 remember 工具码结束。
- foundation 返回/失败语义回写所属 canonical：`docs/modules/b-memory.md` B3（generation 未切换前旧底座继续可用；凭据命中 ≠ 预算超限的 partial 续跑）；`docs/09-data-contracts.md` §11 foundation 布局/params 与 §12 奠基失败反例（本次未发布、旧 generation/pointer 不变）；`docs/04-key-mechanisms.md` §1.2（刷新失败保留旧 generation）。

**依赖 / 触发**：daemon 隐私批；scope 不含 `net/**`。未来插入点：PG-01B 之后由 owner 改 schedule-pointer。推荐默认排在 PG-01B 后、PG-02 前，与 AS-02 同批。

### AS-02 `.saydo` Git 保护语义（推荐第一刀，M）

**机制**：不保护「整个目录字节全等 `*`」。声明私有生成物默认忽略，并验证**实际保护语义**：

| 路径 | 默认 | 共享 |
| --- | --- | --- |
| `<workspace>/.saydo/foundation/`（含 `staging-gen-*`） | 忽略 | 永不共享 |
| knowledge 投影 | 忽略 | 仅 `project_settings` 里审核过的 allowlist |
| 转写 / token | 不在工作区写；`~/.saydo/sessions` 本就不进仓 | 永不随共享放开 |

新托管 ignore **create-only**：无文件则写最小规则；已有合法等价规则（覆盖声明 write set）接受、不覆盖用户文件。已跟踪文件不受 gitignore 影响（[gitignore 规范](https://git-scm.com/docs/gitignore)）。受保护目标已跟踪或 `git check-ignore` 对声明 write set 未命中 -> **停止该次敏感投影**，处方说明可由用户 `git rm --cached`，daemon 不执行；不阻塞其它项目工作。

开关只进 `project_settings`（`storage/ddl.ts:193-194,298-305`；`config/projectOverrides.ts:18-33` 目前 strictObject 仅 `models`/`budget`）。推荐默认字段：`knowledgeShare: { enabled: false, allowlist: string[] }`，无总开关。canonical 须同批：02 §5.1 覆盖面表、03:143、09 §9/§11、10 话术、11 项目设置行。

**正例**：非 git 仓 -> 跳过 Git 查询，仍写本地文件并记录 `not_git`；worktree 的 `.git` 文件 -> 用 `git -C <workspace>` 查询，不把 `.git` 当目录读；已有 ignore 等价覆盖 foundation -> 不覆盖文件；共享 enable + allowlist 仅 `knowledge/index.md` -> 只该文件可不被本次写入视为敏感。

**反例**：只读目录创建 ignore 失败 -> 停敏感投影，不清空用户 ignore；symlink 指向根外 -> 拒写；已跟踪的 `foundation/core.md` -> 不新增该投影，给出处方；allowlist 含 `foundation/**` -> schema 拒。

**证据**：对声明 write set 跑 `git check-ignore -v` 与 `git ls-files`，不是无限语法 linter。linter 不是安全边界。

**回退**：方案尚未上线时可撤回「自动创建 ignore」提案。上线后：可停止后续 ignore 自动创建；已建保护保留；不覆盖用户文件；不重新写未保护私有目标。不回放历史提交，不自动 `git rm --cached` / 改 Git 历史。

**投入 M**。与 AS-01 同批最省 canonical 往返。

### AS-03 笼子 conformance（按 provider 分档，S；撰写阶段未执行 live）

纠正 Fable。`cage.ts:1-5`：`claude`/`grok` = tool-deny；`codex` = write-sandbox 限写不限读；`cursor` = ask+tripwire。`:90-98` Cursor 因鉴权不进隔离 HOME。

测试列分列，不得合成一个「逃逸/未逃逸」：

| 列 | 含义 | 失败条件 |
| --- | --- | --- |
| tool_denied / write_denied / tripwire_fired | 与现有 enforcement 合同一致 | 合同要求的事件未出现 |
| leak_observed | 输出或工具结果含哨兵 | 观测到泄漏（检测型笼子可发生，结果标 `enforcement: partial`） |
| unverified | 超时、未发起访问、无凭据未启动 | 不得记 PASS |

阳性控制：故意允许的读（`readonlyFoundation` 下 claude 的 Read）必须读到哨兵，否则测试本身无效。模型自述不算证据。工具启动前的自动读取必须写入报告，不能排除。读成功 **不是** 现有 read-only 合同违约（codex `-s read-only` 本就不限读）。强读隔离若业务需要，是独立架构变更，不能靠新测试假装已经有。live 有凭据/网络/费用：未来明确授权与标签。撰写阶段未执行 live；未跑产品 runtime/live。

**回退**：删除测试文件。不改 cage argv。

**触发**：BYOA/conformance 测试窗口；`SAYDO_SLOW_E2E` 门控。

### AS-04 工具循环：重复指纹 + 进展信号（先诊断，S）

事件消费侧对 `tool+参数` 做 digest。连续 N 次（推荐默认 N=5，与 ECC 观察值对齐但不是合同常数）且 **无进展** 才记诊断：`tool_repeat_no_progress` 审计。进展 = 结果 digest 变、写入路径集变、错误码变、cwd 变。合法轮询/退避重试/重复读而内容变 = 不误伤。

本轮 **不** 把该信号接入 `blocked`。若未来要停止：只改既有 `circuitBreakers` + `tier1Presentation.ts:12-19` + `docs/10-voice-ux-spec.md:119` 一条 canonical 路径；定义触发、取消恢复；不新增并行状态机。

**正例**：5 次相同 `cat README` 且正文未变 -> 诊断；5 次 `sleep` 轮询且文件从无到有 -> 不诊断。
**反例**：直接 `tool_loop_detected` blocked 而不改 10:119。
**回退**：停止记诊断事件。

### AS-05 效果词表：有限正反例，不重写 shell parser（S）

1. verifyFreeze 闭包内 config 被 file 工具写入 -> PreToolUse 升 S2 候选（一句确认），**仍不可解冻 verify**；漂移继续走 Plan Delta。
2. git 有限 grammar（正式路径 `cmdEffect.ts:989-1000` 当前把 `GIT_LOCAL_SUB` 的普通 commit 判 `write_worktree`/S1，见 `test/tier1-cmd-effect.test.ts:18-20`；ECC `block-no-verify.js:255-256,425-428` 已把 commit 短选项簇里的 `n` 当绕过）。只对**确实支持 `--no-verify`** 的子命令列该旗标：
   - `commit`：`--no-verify` 与短选项 `-n`；组合短选项含 `n`（如 `-an`）同等，升至少 S2。簇从左扫描；遇取值短选项（如 `-m`）则其余字符是值，不是旗标（`-mn` 的 `n` 是 message 文本）。
   - `merge` / `rebase` / `push`：仅长选项 `--no-verify` 升至少 S2。
   - `am`：`--no-verify` 与 `-n`（`git am -h`：`-n, --no-verify`）升至少 S2。
   - **不是**同义绕过：`push -n` / `push --dry-run` 是 dry-run；`cherry-pick -n` 是 `--no-commit`（cherry-pick 无 `--no-verify`）；`rebase -n` 是 `--no-stat`。
   - 提交 message 引号内出现 `-n`（如 `git commit -m "fix -n"`）不误判。
   - `git config core.hooksPath ...` 升 S2；`git -c core.hooksPath=...` 与全局 `-c` 其它键区分，不因 token 包含 `hooksPath` 就定罪。
   - 效果计算必须 `max(existingRisk, proposedFloor)`（实现沿用现有 `floorKind`：只上浮不降级）。不得把现有根外 `core.hooksPath` / 受保护操作的 S3 降成 S2。现测已锁：`git -c core.hooksPath=/tmp/hooks commit -m x` → `delete_data`/S3（`tier1-cmd-effect.test.ts:316`）；`git --git-dir=/etc/.git commit -am x` → S3（`:278`）；保护分支 `git push origin main` → S3。verify 仍冻结。
3. 引号/heredoc：先补 §12 反例。`cat <<EOF > worktree-file` 圈内写 S1（若现有分类器已如此则只加回归）。`bash <<EOF` / `python <<EOF` 不可判 -> 既有未知 S2。`cat <<EOF | sh` **不是** 天然 S3；只有效果落到 `delete_data` / `send_external` / `merge_to_protected` 才 S3。

不重写 parser。已覆盖只加回归。

**正例**：`git commit -n` / `git commit -an` / `git commit --no-verify` / `git am -n` / `git merge --no-verify` / `git rebase --no-verify` / 非保护分支 `git push --no-verify` → 至少 S2。
**反例**：`git push -n`、`git push --dry-run` 不因 `-n` 升绕过档；`git cherry-pick -n` 不因 `-n` 当绕过；`git rebase -n` 是 `--no-stat`；`git commit -m "fix -n"` 不误判；`git -c core.hooksPath=/tmp/hooks commit -n` 保持 S3，不得降到 S2。

**canonical**：04 §5.1 例子表加行；§12 反例 +N（含 commit `-n`/`-an`、message 引号、push/cherry-pick `-n` 负例、hooksPath S3 不降级）。verify 冻结不改。
**回退**：方案尚未上线时可撤回新词条。上线后遇误伤：停受影响的新上浮扩张，保留旧上浮与保护策略，按有证据的修订恢复。不得删除检测词条而使 hook 绕过保护静默失效。verify 冻结不回退。

### AS-06 CI advisory 扫描（绑定证据，不 hard-gate 网络，S）

保留现有 SHA pin、`persist-credentials: false`、`allowBuilds`。本轮只提议：在锁定 pnpm 10.33.1 与 Node 22 的发布包平台上，对 **runtime prod** 依赖跑 `pnpm audit --prod`，证据绑定 `pnpm-lock.yaml` digest + advisory 数据库时间 + 退出原因。网络错误/数据库过期 = `indeterminate`，**不得** 当「无漏洞」绿。build-time `esbuild`/`koffi` 与 runtime prod 分列。例外必须显式且过期，不自动 fix、不改 lockfile。`minimumReleaseAge` 推迟（官方设置入口：[pnpm settings](https://pnpm.io/settings)，2026-09-05 父进程打开，仅作未来核验）。

跟随 PG-02 registry / PG-03 control graph，不另造门禁源。
**回退**：删除 audit 步骤，保留现 CI。

### AS-07 探针/新增数据外发的披露文案（文档项，S，非控制项）

借 ECC 六类词表的骨架，写入 `docs/11-ui-spec.md` §5.8a 与 `docs/10` 话术：本机将执行/外发什么（探针、BYOA、Tier1）。**不**建第二套 consent 存储；审批门保持 fail-closed。触发：§5.8a 或 SetupWizard 探针流程下一次修订。

### 失败、迁移、canonical 回写（施工若发生）

推荐默认：AS-01 与 AS-02 同一 daemon 隐私小批。合同形状不改 trust / Gate 0 / S3；只扩展错误码与 `project_settings` 可覆盖面。

| 文件 | 合法变更 |
| --- | --- |
| `docs/09-data-contracts.md` §13 / §12-4 | `memory_secret_literal`；审计只记 kind+digest。foundation 错误不塞进 remember 工具码 |
| `docs/09` foundation 段（§11 布局/params、§12 奠基失败） | 凭据命中 = 本次未发布；旧 generation/pointer 不变；与预算超限 partial 分流 |
| `docs/modules/b-memory.md` B3 | 同上；generation 未切换前旧底座可用 |
| `docs/04-key-mechanisms.md` §1.2 | 刷新失败保留旧 generation |
| `docs/03-architecture.md:143` | 默认忽略私有生成物；共享经 `project_settings.knowledgeShare` |
| `docs/02-product-definition.md` §5.1 | 覆盖面表增加 knowledgeShare，不含 foundation/转写/token |
| `docs/09` §9 `project_settings` 注（约 `:917-921`） | 与 `projectOverridesSchema` 同步 |
| `docs/09` §11 文件布局 | 标明哪些路径默认忽略 |
| `docs/10-voice-ux-spec.md` | 处方话术 +1；blocked 原因本轮不改 |
| `docs/11-ui-spec.md` | 项目设置行；AS-07 才动 §5.8a |
| `packages/contracts` + `projectOverrides.ts` | strictObject 增字段，无总 bypass bool |

失败语义（推荐默认，不是「owner 再选」）：

- 凭据命中（ledger）：该片段不落盘；ledger 不 insert；项目登记与用户原文件继续。
- 凭据命中（foundation）：本次新 generation 不发布；staging 不写；旧 generation 与 pointer 不变；不把旧 manifest 改成 `partial`。
- ignore 创建失败 / 已跟踪 / 保护不足：只停**这一次**敏感投影，返回处方码 `git_protection_insufficient`；其它对话/派发不阻塞。
- 非 git、`.git` 文件 worktree、只读目录、根外 symlink：各一条正反例，查询用 `git -C <workspace> check-ignore -v -- <declared-paths>` 与 `git ls-files -- <declared-paths>`。
- 迁移：已有明文 secret 不自动 forget、不 `git filter-repo`；用户走既有 forget 两阶段（`docs/10` #38）。
- 回退安全：见 AS-01/AS-02/AS-05 各自回退。不回放被拒 secret；不自动删库/改 Git 历史；不得「删检测与 ignore 写入即可」使已选保护静默失效。不把失败写成「已证明无 secret」。

未来排产入口：owner 按 D17 把该小批插入 `PG-01B` 之后并改 `schedule-pointer`。未导入前本文件不是 next。

## 4. 未来阶段与真实 owner checkpoint

| 项 | 推荐默认 | 须 owner 才能做的 |
| --- | --- | --- |
| AS-01/AS-02 | 组成 daemon 隐私小批，插在 PG-01B 之后 | 改 schedule-pointer / exact-set |
| AS-03–AS-05 | 同批或紧随测试/词表窗口 | 若改 blocked/S 词表须合同评审 |
| AS-06 | 选入 PG-02/PG-03 | 是否把 advisory 升 hard gate |
| S-01 doctor | 保持 G-B12 候选 | 产品级 installer 范围 |
| S-03 ECC 导入 | 见下固定合同，等记忆空闲窗口 | 是否开批 |
| S-05 MCP 清点 | 维持不借直到有诊断 ticket | 扫描范围 |
| P1 consolidation / remote hash | 提名器前提，不自动升格、不合并 trust | T3 跨机器身份 |
| 强读隔离 | 不靠测试假装已有 | 架构变更 |

**S-03 若未来实施（现在不动代码）**：只经 `MemoryLedger.add`；`source.kind=import`；不传 `requestedTrust`；分类器产出 `trust=candidate` + taint（建议 `ecc_memory_unreviewed`）；**不是** `third_party`（compiler 对 `third_party` 默认全排除，对 `candidate` 非 M0 只读标注包含，`compiler.ts:3-4`）；不绑 `readinessKey`；人确认只走 `approveCandidate`。正反例沿用旧 Codex S-03，不把 candidate 写成 third_party。

## 5. 跨项目边界

可共用：脱敏原创场景、ECC SHA 来源快照、事实阅读方法（打开 `file:line`，不信自述）。

不可共用：权威 ledger、运行时 adapter、审批决定、自动 trusted 记忆。Contexpect 观察 SayDo 投影也是外部来源。SayDo **不得**根据 Contexpect GREEN 放行 dispatch。无共享运行时，无硬依赖。未来只用已有格式人工导出/导入。

ContextView 并行 WP-02（Cargo + `ctxpect-core`/`ctxpect-schema`）与本方案无关，不在本仓施工。

## 6. Crosswalk

处置：保留 / 收紧 / 延后 / 撤回。行号指向 [Fable](2026-09-05-ecc-borrowing-assessment.fable.md)。机械计数见文末。

### 6.1 Fable 裁决行（65）

| 原行 | 能力面 | 原裁决 | 新处置 | 新条目 / 原因 |
| --- | --- | --- | --- | --- |
| 45 | E-17 GateGuard 门 | C | 保留 | 维持不借；质量 deny 污染 canary |
| 46 | E-17b 任务卡提示 | B | 延后 | 非控制项；触发 `taskCard.ts` 修订 |
| 47 | E-18 config 写入升 S2 | B | 收紧 | AS-05：只升 S2，不解冻 verify |
| 48 | E-106 `--no-verify` | B | 收紧 | AS-05：commit `-n`/`-an` 升 S2；push `-n` 与 cherry-pick `-n` 不是绕过；S3 不降级；verify 冻结 |
| 49 | E-107 heredoc | B | 收紧 | AS-05：有限反例，非天然 S3 |
| 50 | E-20 工具循环 | B | 收紧 | AS-04：先诊断，不直接 blocked |
| 51 | E-19 usage occupancy | C | 保留 | 已有 run 级 usage；不是 occupancy |
| 52 | E-22 statusline cost | C | 保留 | 09 订阅行 amount NULL 更严 |
| 53 | E-29 披露词表 | B | 收紧 | AS-07 文案；撤回 consent 存储 |
| 54 | E-68 哨兵测试 | B | 收紧 | AS-03 分档 conformance |
| 55 | E-13 Prompt Defense | C | 保留 | 已有 UNTRUSTED 栅栏 |
| 56 | E-82 safety-guard | C | 保留 | 运行时强制已覆盖 |
| 57 | E-72 进程组 kill | C | 保留 | 已有身份 CAS 回收 |
| 63 | E-34 secret 拒写 | A | 收紧 | AS-01 窄凭据字面量 |
| 64 | E-26 事件侧检测 | B | 收紧 | 并入 AS-01；只审计 digest |
| 65 | E-34 gitignore | A | 收紧 | AS-02 实际保护语义 |
| 66 | E-34 BigInt | C | 保留 | `workspace.ts:229` 已有 |
| 67 | E-34 不跟 symlink | C | 保留 | 已有 |
| 68 | E-33 ecc.memory.v1 | C | 保留 | ledger 更强；导入见延后 S-03 |
| 69 | E-37 instincts 晋升 | B | 收紧 | >=2 项目只是提名；hash 只是 hint |
| 70 | E-25 SessionStart 注入 | C | 保留 | Context Pack 已更强 |
| 71 | E-24 haiku 摘要 | C | 保留 | 已有 summarizer 纪律 |
| 72 | E-36 handoff | C | 保留 | 任务卡 + native_session_id |
| 73 | E-39 session.tmp | C | 保留 | 私有格式不借 |
| 74 | E-41 Codex rollout | B | 延后 | 触发：codex Tier1 后端开批 |
| 80 | E-06 矩阵渲染 | C | 保留 | PG-02 ledger；渲染作实施备注 |
| 81 | E-07 平台状态词 | C | 保留 | D-14 / PG-02，不另造 |
| 82 | E-67 competing golden | B | 延后 | 触发：docs/10 §6 扩容 |
| 83 | E-66 pass@k | C | 保留 | 确定性测试不需要 |
| 84 | E-55 总分 | C | 保留 | 与 11 §0 冲突 |
| 85 | E-56 缺失不绿 | C | 保留 | 已有 |
| 86 | E-60 Plan Canvas | C | 保留 | 决策包已覆盖 |
| 87 | E-61 TCAS | B deferred | 延后 | 触发：W6；现无消费点 |
| 88 | E-62/E-63 worktree 编排 | C | 保留 | 已有任务 worktree |
| 89 | E-65 loop 红线 | C | 保留 | verify 冻结即实例 |
| 90 | E-64 orch-review | C | 保留 | 单 reviewer 制度 |
| 91 | E-58 status 导出 | C | 保留 | HANDOFF + pointer |
| 97 | E-75 Actions 加固 | B | 收紧 | 钉 SHA 已有；AS-06 不加 ignore-scripts |
| 98 | E-73/E-74 audit/IOC | B | 收紧 | AS-06 advisory 绑定；不借 IOC 清单 |
| 99 | E-84 多 PM 矩阵 | C | 保留 | 只 pnpm+Node22 |
| 100 | E-85 打包生命周期 | C | 保留 | 已有更严 |
| 101 | E-89 发布 tag | C | 保留 | 已有 |
| 102 | E-76 个人路径 | C | 保留 | 公开树隐私门 |
| 103 | E-77 Unicode/emoji | C | 保留 | check-emoji |
| 104 | E-78/E-79 原子写/loopback | C | 保留 | 已有更强 |
| 105 | E-87 GIT_DIR 剥离 | C | 收紧 | 不宣称风险为零；不立项 |
| 106 | E-08 目录计数 | C | 保留 | claims/gate parity |
| 107 | E-92 Windows python 桩 | C | 延后 | 语音管线上 Windows 时 |
| 108 | E-91 历史坑回归 | C | 保留 | DDL fixture |
| 109 | E-09/E-10/E-11 流程台账 | C | 保留 | PLAN-2 / journal |
| 110 | E-12/E-48 迁移/双路径 | C | 保留 | MIGRATION.md |
| 116 | E-01 三份指南 | C | 保留 | 不借教程文体 |
| 117 | E-02–E-05 能力面/MCP/skill | C | 保留 | 不做 MCP 宿主、不生产 skill |
| 118 | E-14–E-16/E-28/E-30/E-31/E-32/E-98/E-108 hooks 装入宿主 | C | 保留 | 不装进用户 Claude/Cursor/Codex |
| 119 | E-21/E-23/E-27 statusline/session-end/MCP probe | C | 保留 | 不观察用户私人会话、不主动探 MCP |
| 120 | E-35 memory MCP | C | 保留 | 不做 MCP 宿主 |
| 121 | E-38 homunculus 路径 | C | 保留 | 数据在 SayDo 自己的目录 |
| 122 | E-40/E-42/E-43 ECC 内部 store | C | 保留 | 不借 |
| 123 | E-44–E-54/E-99–E-105 安装目标/账本/清点 | C | 收紧 | 安装账本延后 G-B12；MCP 清点本期撤回 |
| 124 | E-57/E-59 控制面看板 | C | 保留 | 不替换 console |
| 125 | E-69 ecc2 | C | 保留 | 审计触发器已有 |
| 126 | E-70/E-71 预算系数/降档 | C | 保留 | 系数不进真值；不降档 |
| 127 | E-80/E-81/E-83 官方源/AgentShield/AURA | C | 保留 | 不扫用户 Claude 配置 |
| 128 | E-86/E-88/E-90 组件校验/c8/Python | C | 保留 | 栈不同 |
| 129 | E-93–E-97 业务/商业/dashboard | C | 保留 | 越界 |

### 6.2 旧 Codex 条目（S-01–S-07 与 S-C1–C10）

| ID | 原裁决 | 新处置 | 说明 |
| --- | --- | --- | --- |
| S-01 | A 安装收据+doctor | 延后 | G-B12 候选；非第一刀 |
| S-02 | A hookConsent 默认 declined | 撤回 | 审批门不可选关闭；披露改 AS-07 |
| S-03 | B ECC 记忆导入 | 延后 | 合同形状保留 §4；本轮不施工 |
| S-04 | A adapter 诚实表 | 保留跟随 | 只跟随 PG-02，不另造 ledger |
| S-05 | B MCP 脱敏 inventory | 本期撤回 | 有诊断 ticket 再开 |
| S-06 | B remaining% 诚实性 | 收紧 | 区分 run cost 与 occupancy；不读私人日志；低优先 |
| S-07 | C 执行 / B 排障 | 保留 | 默认不做；不替代任务 worktree |
| S-C1 | 替换 daemon | 保留不借 | |
| S-C2 | ecc2/orch 替换 Tier1 | 保留不借 | ADR-005 |
| S-C3 | instinct 自动注入 | 保留不借 | 违反 candidate->trusted 与 M0 |
| S-C4 | 默认 hooks 进全局 | 保留不借 | |
| S-C5 | 286 skills 整包 | 保留不借 | |
| S-C6 | 模型降档 | 保留不借 | |
| S-C7 | ito/Nasiko | 保留不借 | |
| S-C8 | ecc-memory-mcp | 保留不借 | |
| S-C9 | 跟随 ECC HEAD submodule | 保留不借 | 钉 SHA 夹具即可 |
| S-C10 | 第二套排产 | 保留不借 | |

### 6.3 原 Fable Deferred（触发或维持不借）

| ID | 项 | 新处置 |
| --- | --- | --- |
| P2-01 | TCAS 同仓并行 | 维持延后；触发 W6 |
| P2-02 | remote URL 跨机器 id | 收紧：只作关联 hint；触发 T3 再评，不替换 inode |
| P2-03 | E-70 系数 | 维持不进真值；随 D-19 |
| P2-04 | Windows python 桩 | 维持延后 |
| P2-05 | 披露词表 | 收紧为 AS-07 |
| P2-06 | competing golden | 维持延后 |
| P2-07 | 任务卡 importer 提示 | 维持延后；非控制项 |
| P2-08 | >=2 项目晋升规则 | 收紧：提名信号，不自动 promotion |
| P2-09 | Codex rollout | 维持延后 |

本表是长期候选与触发条件，不是 review defect ledger。

## 7. 来源坐标

本仓实读（HEAD `bcf8ea85`）：`packages/daemon/src/memory/{ledger,classify,foundation,compiler}.ts`、`voice/redactor.ts`、`providers/byoa/cage.ts`、`tier1/{backends/claude.ts,cmdEffect.ts,verifyFreeze.ts,fileToolEffect.ts}`、`approvals/circuitBreakers.ts`、`config/projectOverrides.ts`、`storage/ddl.ts`、`brain/liveTools.ts`、`projects/workspace.ts`、`packages/contracts/src/tier1Presentation.ts`、`docs/03-architecture.md:143`、`docs/04-key-mechanisms.md` §1.4/§5.1、`docs/09-data-contracts.md` §9/§11/§13、`docs/10-voice-ux-spec.md:119`、`docs/11-ui-spec.md` §5.8a、`docs/02-product-definition.md` §5.1、`package.json:6,24-30`、`.github/workflows/ci.yml:16-28`、`docs/plan/IMPLEMENTATION-PLAN-2.md` schedule-pointer。

ECC permalink 示例：[`memory-vault.js`](https://github.com/affaan-m/ECC/blob/e04ea0b9cc8248686edf5ac751cadff550e162b8/scripts/lib/memory-vault.js)、[`hook-consent.js`](https://github.com/affaan-m/ECC/blob/e04ea0b9cc8248686edf5ac751cadff550e162b8/scripts/lib/install/hook-consent.js)、[`block-no-verify.js`](https://github.com/affaan-m/ECC/blob/e04ea0b9cc8248686edf5ac751cadff550e162b8/scripts/hooks/block-no-verify.js)。

撰写阶段未执行产品 runtime/live 测试、笼子或 `pnpm audit`。文档/合同门禁结果以文末监督核验记录为准。

## 8. 检查与评审区

- 覆盖：Fable 65 行 + Codex 17 条 + Deferred 9 条，见 §6。
- 无产品改动；无 PLAN-2 指针改动。
- 实施线不自行判 GREEN，独立结论由监督线登记。本轮为 astra.2（P1 Git grammar + 最终一次 P2 sweep），该状态为送审时记录；最终核验见本文末节。

## 监督线最终核验（2026-09-05）

独立复审 R3 **GREEN**，A1–A6 全部 [ok]，无 P0/P1，无新增 P2/P3。此前 Git grammar 与交付引用问题均有实际复核闭环；唯一一次最终 P2 sweep 已落实。本节是送审阶段之后登记的最终状态，不将方案建议写成已实施。

冻结阶段文档门禁 **12/12 通过**，ContextView 负例测试原文 `Ran 148 tests in 84.338s / OK`，流程终结校验 `status=finalized`。检查的是上述基线加新文档；未运行产品 runtime/live，也未验收原工作区并行 WP-02。

Fable 全量对照表行号以本次冻结原稿为准。原工作区并行插入 supersede banner 后原条目偏移 `+2`；并行生成的 Fable consolidated 稿保留，本文件是针对用户提供原始评估的独立 Astra 提案，不替其宣布唯一排产来源。

完整评审、修订与原始门禁摘要见[复审核验记录](../../research/codex-findings/2026-09-05-ecc-astra-review.md)。无 commit/push/install；未来实施仍须进入各项目原有合同与排产。
