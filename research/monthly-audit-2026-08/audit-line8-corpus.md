# 600 条潜在客户提问语料库线 · commit↔文档双向对照审计报告

- 审计日期：2026-08-27
- 审计员：零上下文独立会话（未读实施会话任何上下文）
- 仓库：`~/WorkSpace/SayDo`，分支 `main`，HEAD `f723ab7`（本会话 `git log` 实测）
- 审计对象 commit：`cf50f52`（语料库全量入库）、`dfb6f9d`（抢救入库）、清单另含 `7f6562e`、`6a6568a`
- 纪律：只读。本会话未修改/新建任何仓库正式文件、未 `git add`/`commit`；跑过的全部为只读校验脚本（mutation runner 均验证为内存/临时目录操作，跑后 `git status --porcelain research/customer-question-corpus/` 为 0 行）。

## 总判定

- 语料库**实体本身自洽**：5 个自带校验器 + 独立 oracle + 3 个 mutation runner 本会话全部真实跑通、全绿；两份 readback 的判据数字（replay=27/P0=23 等）与实体逐项相符；A 级返工五项全部有实证。
- 但**入库动作本身出了事故**：dfb6f9d 把整套语料实体以「拍平路径」提交到 `research/*`，cf50f52 未察觉、错述其内容并在 canonical 路径再入一份——main 现在有两份 byte-identical 的完整语料副本（171×2），且 `research/README.md`（research 目录索引）被语料 README 覆盖丢失。
- 另一实质问题：主语料 **v8 终审三份评审全部 `[fail]`（合计 3 条 A 级发现）且无任何处置记录**即入库，实体经查仍保留全部被引反例。

**发现计数：A 级 5 条，B 级 2 条，C 级 4 条。**

---

## 第一部分 · 任务 A：文档→实体核对

### 1.1 校验器与门禁（本会话真实执行）

| 命令 | 退出码（紧跟命令取） | 输出摘录 |
|---|---:|---|
| `node research/customer-question-corpus/validate.mjs` | 0 | `[ok] 600 条语料结构、登记合同完整性与已知语义反例门通过`；stats 含 `records: 600, requiredClaims: 172, liveSourceContracts: 465, f1CapabilityContracts: 46` |
| `node …/dry-runs/validate-three-pass-dry-run.mjs` | 0 | `rows=600 P0=23 P1=46`；`evidence PROVEN=27 NO_EVIDENCE=45 NOT_IN_SIM=528`；`source_tree_sha256=0c2a1f65…`；`authority_sha256=2a83fe23…`；11 个 issue code（含 `DR-CTX-AUTHORITY-STALE`） |
| `node …/simulations/validate-simulations.mjs` | 0 | `sessions=72 domains=12 H/M/L=32/25/15 … A=0 warn=28`、`[ok] A-level checks passed` |
| `node …/dry-runs/independent-oracle.mjs` | 0 | `replay=27 P0=23 P1=46 PROVEN=27 NO_EVIDENCE=45 NOT_IN_SIM=528` |
| `node …/dry-runs/test-dry-run-mutations.mjs` | 0 | 36 行 `[ok] mutation … rejected`＋`[ok] mutation independent-oracle still green on official tree`＋`official tree unchanged sha256 0c2a1f65…`（注意：是 36 条被拒，不是 38，见发现 A-5） |
| `node …/simulations/test-simulation-mutations.mjs` | 0 | 全部 `rejected`；`official tree unchanged sha256 9c46c800…` |
| `node …/test-mutations.mjs`（主语料 mutation 门） | 0 | `[ok] 77 类 mutation 均被拒绝`；`正式 questions+contexts+contracts+04 SHA-256 保持 0c2a1f65…` |
| `rg --files -0 research/customer-question-corpus \| xargs -0 bash scripts/check-emoji.sh` | —（输出即证据） | `[ok] emoji gate: clean`（拍平副本六目录同样 clean） |

结论：**校验器全绿，实体自洽**（任务 A 的"绿=自洽"判据满足）。

### 1.2 08-27 A 级返工报告（`docs/review/2026-08-27-customer-question-dry-run-a-repair-report.md`）逐项核对

| 报告主张 | 实测 | 判定 |
|---|---|---|
| replay 27 / P0 23 / P1 46 / P2 338 / P3 166 | result 汇总表逐行 grep：`replay 27 / P0 23 / P1 46 / P2 338 / P3 166`（23+46+338+166+27=600）；validator 与独立 oracle 同值 | 一致 |
| PROVEN=27 / NO_EVIDENCE=45 / NOT_IN_SIM=528 | validator 与 oracle 输出同值（27+45=72，+528=600） | 一致 |
| 12 个已知反例全为 `NO_EVIDENCE` | 从 result 第 12 列逐条 grep：PRJ-001、MKT-024、DAT-014、LRN-030、FAM-017、OPS-015、SAL-002、DAT-028、LRN-009、LRN-028、LIF-006、FAM-004 均 `NO_EVIDENCE` | 一致 |
| 「P0 新增 7 条恰是 7 个 S3_AUTH_MISSING 无证据 simulation 题」 | 上述后 7 个 ID（OPS-015…FAM-004）priority 实测均为 P0，前 5 个为 P1 | 一致 |
| CTX 172 条全部赋 `DR-CTX-AUTHORITY-STALE` | result 中带该 code 的题目行实测 172 行（另 1 处为 code 汇总行）；与主 validator `requiredClaims: 172` 一致 | 一致 |
| §4 生成物 SHA-256 表（10 个文件） | `shasum -a 256` 逐一比对：01/02/03 md 与 7 个 .mjs **全部逐字节相符**（result `68225899…`、solution `56337afc…`、model `91029355…`、render `2f33abda…`、evidence `8a503cbb…`、oracle `a63bc17b…`、mutations `c89d7ad6…`、validate `771d5e53…`、rebuild `faa1b720…`、note `8644beb0…`） | 一致 |
| `authority_sha256=2a83fe23…`、主语料源树 `0c2a1f65…` | validator 本会话输出同值 | 一致 |
| §2 oracle 反同源改造：`EVIDENCE_MAP` 仅在交叉核验处引用；import 仅 node:* + `buildSpecs`；判定函数本地重写于 329-374 行 | `grep -n EVIDENCE_MAP independent-oracle.mjs` 命中 595、597 两行（均为交叉核验处）；`grep ^import` 仅 node:fs/path/url/crypto + `../simulations/simulation-spec.mjs` 的 buildSpecs；`selectPerturbation/judgeDr1/judgeDr2/judgeDr3/assignIssueCodes` 实测定义于 329/340/350/357/374 行 | 一致 |
| 冻结事实：600、F 46/483/60/11、DR1 七态（GO 28/WAIT_USER 101/WAIT_CONNECTOR 264/WAIT_USER_AND_CONNECTOR 82/CONDITIONAL_ROUTE 54/PLAN_ONLY 60/RESCOPE 11）、LIVE 465、F1 46、sim 72、CTX 172 | result 汇总表逐行 grep 与 validator stats 全部同值 | 一致 |
| 「38 条 mutation 全部被拒」 | **实测 36 条** `rejected`（另两行 `[ok] mutation` 前缀分别是正控行与自测总结行）；报告同段自己的分项枚举合计亦为 36 | **不符 → 发现 A-5** |

**「A 级返工已完成」声明判定：成立**（A1-A5 五项均有落盘实证与可判定门禁，唯一数字瑕疵是 38≠36）。报告自我定位「不是验收通过、待 prompts/190 零上下文评审」与实际状态一致（见 C-2）。

### 1.3 08-26 readback（`docs/review/2026-08-26-customer-question-dry-run-impl-readback.fable.md`）核对

- 该文档判定 `[fail]`、A=5，其引用的三份评审证据实测存在且分级相符：`dry-runs/review/01`（`[fail]` A=2 B=1 C=0）、`dry-runs/review/02`（`[fail]`，实测 §2 有 A-01/A-02 两条、§3 有 B-01/02/03 三条）、`research/codex-findings/186`（`# [fail]`，`A=3，B=1，C=0`）。
- 文中门禁数字 `rows=600 P0=16 P1=41` 为返工前历史值，已被 A 级返工按预告重算为 23/46——两份文档相互衔接自洽。
- 其修复清单 1-7 与 A-repair 报告逐项对应（含第 7 条「生成 readback prompt 后停止」→ `prompts/190-…-a-repair-readback.md` 实测存在）。

---

## 第二部分 · 任务 B：实体内部一致性

### 2.1 规模数字（README/00-04 声称 vs 实测）

| 声称 | 实测命令要点 | 实测值 | 判定 |
|---|---|---|---|
| 恰好 600 条、12 组问题 | questions/ 12 个 md；唯一 ID 计数 | 12 文件；600 个唯一 ID；ENG 120/PRJ 70/WRT 70/RES 60/OPS 55/SAL 45/MKT 45/DAT 35/LRN 30/LIF 30/CAR 20/FAM 20（合计 600），与 01-设计与分布 §4 配额表及 validate.mjs `expected` 常量一致 | 一致 |
| 16 组 CTX | contexts/ 目录 | CTX-01…CTX-16 共 16 目录 | 一致 |
| 465 条 LIVE 合同 | contracts/live/*.json 逐文件解析累计 | 12 个 json 合计 465 条 | 一致 |
| 986 个对象来源 | 逐合同累计 sources | 986 | 一致 |
| 46 条 F1 合同（另 2 条降级记录） | f1-capability-contracts.json | active_contracts 46、reviewed_demotions 2 | 一致 |
| 172 条逐题 required claims | 16 个 manifest 表格行计数 | 172 行、无跨包重复 ID | 一致 |
| 50 个冻结来源文件 | contexts 下非 manifest md 计数 | 51 个文件中 1 个为 contexts/README.md（非来源），来源文件恰 50 | 一致 |
| 72 个 simulation | sessions/fixtures 会话块计数 | sessions `# SIM-` 72 个、fixtures `## SIM-` 72 个、每域 6 个 ×12 | 一致 |

### 2.2 simulations/00-simulation-plan 声称范围 vs 实际

validator 本会话输出逐项对照计划下限：H/M/L=32/25/15（=计划）；每域 6 会话（12×6 实测）；生命周期九类 first_clarify 25≥18、user_supplement 24≥14、rag_conflict 17≥12、live_degrade 40≥16、write_confirm 19≥12、mid_change 8≥8、tool_fail 11≥10、pause_resume 10≥8、overreach 10≥6；输入模式 CTX 35≥18、USER 28≥18、LIVE 51≥24、`-` 2、S3/F4 17≥12、LIF/FAM 12≥8；标签档位 C/D/H/R/K/S/F 全档出现。计划 §7 三条门禁命令全部本会话重跑为绿。**计划与实际覆盖一致。** simulations/review 03/04/05（返工 readback 与生成树门 readback）实测均 `[pass]`（A=0），与实体现状相符。

### 2.3 review/ 的 v8 终审结论 vs 当前实体（重点问题）

三份 v8 终审（该线主语料的**最后一轮**评审记录）实测结论：

- `review/21-final-coverage-naturalness-v8.md`：`[fail]`，A=0、B=4 组（27 个 ID），「通过条件：A=0 且 B=0」；
- `review/22-final-capability-context-v8.md`：`[fail]`，**A=1**、B=6、C=1（A-01：986 个 locator 全为模板拼接，752 含 `USER-PROVIDED`、234 仅指向抽象 `authorized-project-root`，「不能同时被称为具体 locator 与闭合来源」）；
- `research/codex-findings/178-…-v8.md`：`[fail]`，**A=2**（A-RAG-01 字段异物、A-RAG-02 占位 locator 计作闭合注册表）、B=1。

当前实体逐条复核被引反例，**全部仍在**：

- `grep -c USER-PROVIDED contracts/live/*.json` 合计 **752**；`authorized-project-root` 合计 **234**（与 v8 所见完全相同，752+234=986）；
- LIF-007 六个来源（calendar/table/finance/web/map/pdf）`required_fields` 实测均含 `speaker_id,utterance,timestamp`，finance 还含 `route`（A-RAG-01 原例）；
- WRT-002 email thread 实测含 `item_id,assignee,dependency`；RES-003 实测仍是单个 `connector+browser://USER-PROVIDED/RES-003/market_evidence_web` 占位来源、字段含 `amount,currency,financial_status,assignee`（A-RAG-02 原例）。

**结论是否过期**：不过期——v8 批评所指的注册表内容自 v8 起未变（validate.mjs 以 `finalV8LiveRegistryDigest=67afc585…`/`finalV8CapabilityRegistryDigest` 钉死注册表摘要且当前全绿；04 文档自述摘要同值）。v8 之后 questions/、04 的 mtime 更新（08-26 10:40）与 README（09:37）可由 simulation 阶段 rebuild 重跑解释：99 个终审 ID 有逐 ID SHA 钉死、配额结构门全绿、且 08-26 dry-run 基线起主语料源树 SHA `0c2a1f65…` 持续至今（本会话 validator 与主语料 mutation 门两路同值复算）。08-26 08:48（v8 落盘）至 10:40 窗口内 questions 正文是否有未被 99-ID 摘要与配额门覆盖的逐字改动，**无法完全排除**（无 git 历史），标注为未核实推断；注册表与 04 则有摘要级证据未变。

**问题在于**：三份 `[fail]`（含 3 条 A 级）之后，该线直接转入 simulation 施工（prompts/179+），语料树、`docs/`、`HANDOFF.md`、journal 中**均无任何 v8 处置/裁决/降级记录**（本会话 grep 无命中）；README 至今仍以「登记**具体 locator**」「986 个**现势对象来源**」的口径描述注册表——正是 v8 两份评审点名不能成立的表述。详见发现 **A-4**。

另：README 称 review/ 含「回修记录」，但目录内 20 个文件全部是评审输出、无回修记录文档，编号 03/06 缺口无说明（见 B-2）。

---

## 第三部分 · 任务 C：两个入库提交 message 抽验

### 3.1 门禁声称重跑（全部命中）

| 提交 | message 声称 | 本会话实测 | 判定 |
|---|---|---|---|
| cf50f52 / dfb6f9d | `check-doc-links files=114 broken=0` | `node scripts/check-doc-links.mjs` 退出 0，`[ok] active document links: files=114 broken=0`（精确同值） | 一致 |
| cf50f52 / dfb6f9d | `public-tree-privacy hits=0` | `node scripts/check-public-tree-privacy.mjs --fs` 退出 0，`hits=0`（scanned=2038） | 一致 |
| cf50f52 / dfb6f9d | emoji clean | 语料树与拍平副本均 `[ok] emoji gate: clean` | 一致 |
| cf50f52 | 「dry-runs/review/02 一处本机 home 路径换为 ~」 | 该文件两份副本 `/Users/` 均 0 命中，现存 `~/WorkSpace/SayDo` 形式（:184） | 一致 |
| cf50f52 | `.gitignore` 忽略 `.playwright-mcp/` | diff 实见 `.gitignore +1` | 一致 |

### 3.2 message 事实陈述核验（发现问题）

- cf50f52 称「dfb6f9d 抢救入库时**只收了该线的说明与评审文档(28 个文件)**，语料库实体…**一直只存在于主工作区**」——实测 `git show --name-only dfb6f9d` 共 **251 个路径**，其中包含**完整语料实体 171 个文件**（questions/contexts/contracts/simulations/dry-runs/review/00-04/validate.mjs/rebuild.mjs/test-mutations.mjs），只是被提交到了**拍平路径** `research/*` 而非 `research/customer-question-corpus/*`（canonical 路径下确为 0 个）。「含 dfb6f9d 之后…新产出的 sessions/fixtures/评审与 oracle 工具」亦不成立——这些文件全部已在 dfb6f9d 中。→ **A-1**
- 两个提交叠加后，main 同时存在两份 byte-identical 的完整语料（171×2）。→ **A-2**
- dfb6f9d 将语料 README 覆盖到 `research/README.md`（原 15 行 research 目录索引表被顶掉），且 message 以错误理由背书（「research/README.md 是主树更新(60 行 vs main 15 行,600 条线扩充了目录说明),该版保留」——60 行版实为语料自身 README，与 research 目录索引无关）。→ **A-3**
- cf50f52 实际新增文件数：`git -c core.quotepath=off show --name-only` 计 **171 个** `research/customer-question-corpus/` 路径（与任务描述相符；初次统计 167 是本会话 grep 未匹配含中文引号路径的假象，已用 quotepath=off 复核更正）。

### 3.3 清单其余两笔

- `7f6562e` fix(voice)：`packages/daemon/src/voice/hub.ts` + 测试（capture ingress 评审 B-5 修复线）；`6a6568a` fix(focus)：focus 生命周期合同（W2/W3 线）。两者均为 daemon 生产代码，**与语料库线无关**（语料线全部文档也未引用它们）。→ C-1，未对其 message 门禁声称展开验证（超出本线范围）。

---

## 发现清单

### A 级（错误/不一致）

**A-1 · cf50f52 commit message 对 dfb6f9d 内容的三处事实错述**
- 主张：见 §3.2。「只收 28 个文件说明与评审文档」「实体一直只存在于主工作区」「（这些产物是）dfb6f9d 之后新产出」三处均与 dfb6f9d 实际内容矛盾。
- 证据：`git -c core.quotepath=off show --name-only dfb6f9d`＝251 路径、0 个 canonical 语料路径、171 个拍平语料文件（questions 12/contexts 67/contracts 13/simulations 37/dry-runs 13/review 20/顶层 9，均实测计数）；oracle/sessions/fixtures 等均在其中。
- 处置建议：commit message 无法修改；在 journal 或该线交接文档补一条勘误记录，指明 dfb6f9d 的真实内容与拍平事故，避免后续会话按 message 叙事重建错误时间线。

**A-2 · main 现存整套语料库的完整重复副本（171×2）**
- 主张：`research/questions|contexts|contracts|simulations|dry-runs|review|00-04|validate.mjs|rebuild.mjs|test-mutations.mjs`（拍平副本，来自 dfb6f9d 的 rsync 拍平）与 `research/customer-question-corpus/` 逐字节相同并同时存在于 HEAD 与工作树。
- 证据：`git diff HEAD:research/<dir> HEAD:research/customer-question-corpus/<dir>` 六个目录全部空输出；顶层 8 个文件逐一 `git diff --shortstat` 均 IDENTICAL；两侧 `git ls-tree -r` 均 171 个文件；工作树 `ls -d` 实见拍平目录。
- 影响：仓库体积与后续维护双份漂移风险；privacy/emoji/doc-links 门当前对两份都绿（已实测），且 docs//HANDOFF/prompts 无任何引用指向拍平路径（grep 无命中），删除不会破坏链接。
- 处置建议：owner 授权后单独一个清理 commit：`git rm -r` 拍平副本 171 个文件，并恢复 A-3 的 README（同一批处理）；清理后重跑 check-doc-links / privacy / emoji 三门。

**A-3 · `research/README.md`（research 目录索引）被语料 README 覆盖，原索引内容从 HEAD 消失**
- 主张：原 15 行索引（「research/ — 调研与评审原始报告」＋文档→被引用处对照表）被 60 行语料 README 顶替；dfb6f9d message 还以错误判断背书保留（称其为「600 条线扩充了目录说明」）。
- 证据：`git show dfb6f9d~1:research/README.md`＝15 行索引表（本会话读取原文）；`git diff HEAD:research/README.md HEAD:research/customer-question-corpus/README.md` 空输出（两者相同，即现值为语料 README）。
- 处置建议：恢复 `research/README.md` 为 dfb6f9d~1 版本并补一行指向 `customer-question-corpus/`；语料 README 留在 canonical 位置即可。

**A-4 · 主语料 v8 终审三份 `[fail]`（合计 3 条 A 级发现）零处置即入库；实体仍保留全部被引反例；README 口径与终审结论冲突**
- 主张：见 §2.3。v8 是该线主语料的最后一轮评审，三份结论均 `[fail]`（review/22 A=1；codex-findings/178 A=2；review/21 A=0/B=4 且「A=0 且 B=0 才通过」）；此后无修复轮、无 owner 裁决/接受/降级记录，线直接转入 simulation/dry-run（两者均禁改主语料）。752 `USER-PROVIDED`/234 `authorized-project-root` 与 LIF-007/WRT-002/RES-003 等被引反例本会话逐条复核仍在；README 仍称「登记具体 locator」「986 个现势对象来源」。
- 证据：三份评审结论原文（本会话读取）；`grep -c` 计数 752/234；LIF-007/WRT-002/RES-003 字段实测输出（§2.3）；`grep -rln "v8"` 语料树仅 validate/rebuild/两份评审自身命中，docs//HANDOFF 处置搜索无命中。
- 说明：入库提交与两份 dry-run readback **均未声称** v8 已通过，故不构成"文档说谎"；定 A 的依据是**实体自述（README）与其自身终审记录的现存不一致**＋红灯无处置即入 main。dry-run 线的「A 级返工完成」只覆盖 dry-run readback 的 A1-A5，与 v8 的 A 级是两回事，不可混同。
- 处置建议：owner 三选一并留痕：(a) 按 v8 修复顺序开主语料修复线；(b) 正式接受现状但改写 README/04 口径（locator 改称「待解析前置条件」，即 v8 给出的另一条出路）；(c) 明确降级该语料的对外承诺等级。任一选择都应补一份 disposition 文档。

**A-5 · 「38 条 mutation 全部被拒」计数错误（实为 36）**
- 主张：A-repair 报告 §A4 与 §4 门禁表、journal R112 三处写「38 条 mutation 全部被拒/全拒」；实测 runner 输出 `rejected` 行 36 条，另两行 `[ok] mutation` 前缀分别是「independent-oracle still green on official tree」（正控，非 mutation）与「self-test passed」（总结行）；报告同段落自己的分项枚举（12+5+5+…+3）合计亦为 36。
- 证据：本会话 `node test-dry-run-mutations.mjs` 完整输出（`grep -c "rejected A="`＝36）；源码 `expectRejected` 调用与循环枚举核对＝36 个用例。
- 影响：有限——门禁实质为绿、全部真实存在的 mutation 均被拒、无虚绿；纯文档计数错，推测为 `grep -c "^\[ok\] mutation"` 连正控与总结行一起数了。
- 处置建议：将报告两处与 R112 的 38 更正为 36（或改写为「36 条 mutation 全部被拒＋正控通过」）。

### B 级（疏漏/不足）

**B-1 · journal R112 的「R110 readback」交叉引用在 main 编号体系下指向错误条目**
- 主张：main 的 R110 是「W5.4-b 四轮独立复审收口…」（本会话读取原文），并非 600 条线的 dry-run readback；R112 所指实为 `docs/review/2026-08-26-customer-question-dry-run-impl-readback.fable.md`。成因推测（未核实）：主工作区 journal 与 main 编号错位（R94-R97 重编号），抢救时只提取 R111/R112 追加、未修内文引用。且 08-26 dry-run 实施＋readback 会话在 main journal 无独立条目。
- 证据：journal 2790 行起 R110 原文主题为 W5.4-b；`grep "dry run"` 全文仅 R112 段命中该线。
- 处置建议：R112 该句改为直接引用 readback 文档路径。

**B-2 · 语料 README 称 review/ 含「回修记录」，实际目录内无一份回修记录，且编号 03/06 缺口无说明**
- 证据：`ls review/`＝20 个文件（01,02,04,05,07,08,09-22），全部为评审输出；README.md:19「review/：独立评审结果、覆盖复核与回修记录」。
- 处置建议：README 该行删去「回修记录」或补注回修实际落点（prompts/codex-findings 与构建器历史）；可在 review/ 加一行 README 说明 03/06 编号从未使用（若属实）。

### C 级（观察）

**C-1 · 审计 commit 清单混入两笔与本线无关的提交**：`7f6562e`（voice hub，capture-ingress 线）、`6a6568a`（focus 生命周期，08-06）。属清单归类噪音，非该线文档问题。

**C-2 · dry-run A 级返工的强制停点（prompts/190 零上下文独立评审）尚未执行**：`research/codex-findings/` 无 187-190 对应产物；A-repair 报告 §8 与 auto-memory 均如实披露「卡在停点」。本审计复跑了 validator/oracle/mutation（全绿），可作旁证但不替代 190 号全量语义评审。非隐瞒，属待办。

**C-3 · dfb6f9d message「59 个未跟踪文件/49 个不在 main」与实际 251 个入库路径的对应关系未说明**：推测为目录级 `git status` 计数（目录折叠为单条）展开后的差异，未核实；R113 表格又写「60 个文件」。不影响实质，但三个数字互不对齐。

**C-4 · simulation validator 28 条 payload warn**（`仍可更丰富`）：非 A 级、validator 判 A=0，与 A-repair 报告「4 条 payload warn，非 A」的表述差异是统计口径（报告只列了 CAR/FAM 4 条示例 vs 全量 28 条 warn 行；validator 汇总行明确 `warn=28`，报告 §4 引用的正是该门输出）。如实记录，不定级。

---

## 附 · 未核实事项汇总（诚实边界）

1. 08-26 08:48–10:40 窗口内 questions/ 正文是否有未被 99-ID 摘要与配额门覆盖的逐字改动（无 git 历史可比，仅有间接证据链）。
2. B-1 的成因（journal 编号错位）为推测。
3. C-3 的 59/49/60 计数成因为推测。
4. dfb6f9d 声称的「505 处路径脱敏」总数未逐处复验（以 privacy 门 hits=0 的现状复跑为准）。
5. `7f6562e`/`6a6568a` 两笔非本线提交的 message 门禁声称未验证。

## 附 · 本会话关键命令台账（均真实执行）

- `git branch --show-current`＝main；`git log --oneline -3`（HEAD f723ab7）
- 5 个校验器/oracle + 3 个 mutation runner：退出码均以 `; echo "X_EXIT=$?"` 紧跟命令取得，全部为 0（输出落盘于会话 scratchpad v1–v7 *.out）
- `shasum -a 256` 10 个 dry-runs 文件；`git show --name-only`（quotepath=off 复核）dfb6f9d/cf50f52；`git diff HEAD:research/<x> HEAD:research/customer-question-corpus/<x>` 全对；`git show dfb6f9d~1:research/README.md`
- `node scripts/check-doc-links.mjs`（exit 0, files=114 broken=0）；`node scripts/check-public-tree-privacy.mjs --fs`（exit 0, hits=0）；check-emoji.sh 两棵树 clean
- 计数类：questions 唯一 ID 600、live 合同 465、objects 986、F1 46+2、claims 172、来源文件 50、sessions/fixtures 72/72、每域 6
- 跑完全部脚本后 `git status --porcelain research/customer-question-corpus/`＝0 行（正式树未被触碰）

环境备注：本会话进行期间（08-27 19:15）工作树出现 `docs/release/` 三个文件的并发修改（rc.12 文案勘误，落款「2026-08-27 月度审计」），mtime 与 diff 实测非本会话任何命令所致，来自同仓并发会话；与本线审计范围无关，仅备案。
