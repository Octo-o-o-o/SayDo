# Codex 第 3 路对抗性复核结论

**总裁决：No-Go，当前方案不能按 §6 直接执行。**

合并方向本身可以成立，但现稿至少有两项 A 级阻断：

- **A-1：源树没有被冻结，且本轮观察到方案之后仍有新活文档/日志写入。** 复制式迁移可能形成不完整快照，归档库与 SayDo 同时继续变化，产生 canonical 分叉。
- **A-2：emoji 门禁在迁移前阶段会对未跟踪文件“假绿”，而方案又要求对证据/模板做全局机械替换。** 这同时存在 CI 迟发红和证据语义/摘要 digest 被改变的风险。

此外，引用表、顶层迁移清单、两提交回滚定义、评审日志审计均需修订后再执行。

等级含义：A = 会导致数据丢失、CI 红、canonical 分叉或不可审计；B = 执行前必须修；C = 建议或非阻断项。

---

## 1. §1 F1–F11 事实核验

### 1.1 F1：voice-coding 非 git、无 diff、无远端备份

**裁决：B，部分可证，部分表述过强。**

证据：

- `git -C ~/WorkSpace/voice-coding status` 返回：

  ```text
  fatal: not a git repository (or any of the parent directories): .git
  ```

- `SayDo` 当前确实是 git 仓，当前分支状态为：

  ```text
  branch.oid 2f657ede6f75b5e87ae162fe82aacfdc1957d31d
  branch.head main
  branch.upstream origin/main
  branch.ab +0 -0
  ```

- `git -C SayDo remote -v` 实读到 `https://github.com/Octo-o-o-o/SayDo.git`。

但“**无远端备份**”不能由本地没有 `.git` 推导出来；也没有在本轮验证其他备份介质或远端快照。

最小改法：

1. 将 F1 改成“本地未发现 git 元数据；远端备份未核实”。
2. 在迁移前由 owner 提供一个可核验的远端/压缩快照及 SHA-256。
3. 先生成源树文件清单和校验和，再允许源目录继续改名或加归档头。

---

### 1.2 F2：`config.test.ts` 跨仓读取模板，CI 可能失败

**裁决：A，风险事实成立；“Actions billing 未开”仅为未独立核实的环境状态。**

证据：

- `SayDo/packages/daemon/test/config.test.ts:11`

  ```ts
  const TEMPLATES = resolve(__dirname, "../../../../voice-coding/templates");
  ```

- `SayDo/packages/daemon/test/config.test.ts:240,249` 对两份 TOML 进行 `readFileSync`。
- `SayDo/templates` 当前不存在。
- `SayDo/.github/workflows/ci.yml:12-25` 只 checkout SayDo，随后运行 `pnpm install --frozen-lockfile`、`pnpm test` 和 emoji gate。
- `SayDo/HANDOFF.md:35` 写有 Actions billing 无法运行，但这是文档自报，未通过 GitHub API/Actions 实跑核验。

“checkout 后 `voice-coding` 不存在”是根据 workflow 只 checkout SayDo 和当前仓库内容作出的合理推断，不是远端 CI 实跑结果。

最小改法：

- 将模板明确复制到 `SayDo/templates/`。
- 将路径改为 `packages/daemon/test` 相对仓根的 `../../../templates`，或使用由仓根解析的 fixture helper。
- 同时修 `run.mjs`、smoke 结果文件中的默认路径。
- 在干净 clone 中至少运行一次模板测试；本次复核没有运行 `just ci` 或完整测试。

---

### 1.3 F3：SayDo 内 15 个文件引用 voice-coding

**裁决：B，数量对 tracked 范围成立，但清单不完整。**

实跑：

```text
git grep -n -I voice-coding
```

结果为 **25 行、15 个 tracked 文件**。

但方案 `REPO-MERGE-PROPOSAL.md:16` 的分类只列出了：

- AGENTS/README/HANDOFF：3
- evidence×4：4
- ADR×2：2
- test×1：1
- spike run.mjs、smoke run.sh：2

这只解释了 12 个文件，遗漏至少：

- `SayDo/e2e/spikes/fts-d9/RESULT.md`
- `SayDo/e2e/spikes/fts-d9/spike-output.json`
- `SayDo/e2e/smoke/cursor-cli-0.0/RESULT.md`

若把被 `.gitignore` 忽略但实际会被 agent 读取的文件也算入工作树，`rg --hidden --no-ignore` 结果为 **29 行、17 个文件**，额外包括：

- `SayDo/.saydo/knowledge/core.md`
- `SayDo/.saydo/knowledge/conventions.md`

最小改法：

- 在 §5 建立完整 manifest，明确区分 tracked、untracked、历史证据、可执行默认路径。
- `.saydo/knowledge` 不能因为不进 git 就从 canonical 断链审计中消失，应在迁移后重新生成。

---

### 1.4 F4：跨仓“先修文档再改代码”无法同 commit

**裁决：C（事实正确），但方案对合并后收益有条件。**

证据：

- `SayDo/AGENTS.md:3-6` 仍把 `~/WorkSpace/voice-coding/` 定义为 canonical，并要求先回写设计文档再改代码。
- `SayDo/AGENTS.md:30-31` 要求两提交法。

合并后只有在以下条件同时满足时，才真的能把文档和实现放进同一审查面：

- 源树先冻结；
- `AGENTS.md`、`README.md` 的语义合并完成；
- 当前活跃的 Prompt 4 批次不与迁移并行写入。

最小改法：迁移提交后立即更新 canonical 指针，但保留设计文档回写的一致性评审要求，不要把“同仓”误当成“天然一致”。

---

### 1.5 F5：两个 ADR-001

**裁决：B，命名事实成立，解决方式尚未闭合。**

证据：

- `voice-coding/docs/adr/ADR-001-execution-layer.md`
- `SayDo/docs/adr/ADR-001-pipecat-interrupt-go.md`
- 后者 `:3-4` 还写着设计层 ADR 预留 `ADR-102`，并引用外部 voice-coding。

方案提出 `docs/adr/design/ADR-001-execution-layer.md`，方向可行，但这会改变相对路径深度和现有 ADR 索引语义。

最小改法：

- 明确 `docs/adr/design/` 与根 `docs/adr/` 的双序列规则。
- 更新现有 ADR-001/README/AGENTS 中“设计 ADR 留 voice-coding”“预留 ADR-102”等旧表述。
- 将所有 inbound link 纳入机器校验，不只改 16 个字符串。

---

### 1.6 F6：体积 128M、research md 1.26M/99 文件

**裁决：B，部分过时。**

当前实测：

- `du -sh voice-coding`：**132M**
- 所有 regular files 字节和：**133,061,894 bytes**
- `research/*.md` 及其子目录：**99 文件、1,320,874 bytes、约 1.260 MiB**
- `research/codex-findings`：约 45M
- `research/spikes/cursor-sdk-tier1/node_modules`：约 40M
- `archive`：约 22M
- `assets`：约 11M
- 顶层 `logs`：当前约 **12M**，不是方案写的 7.7M

按 §4.1 的最宽解释（docs、demo、templates、history、prompts、7 个根级计划/规则文件，以及 research 中排除 `node_modules` 和 `*.log` 的全部文件），当前候选是：

- **112 文件**
- **2,104,960 bytes，约 2.007 MiB**

最小改法：

- 用冻结时刻的文件 manifest、字节数和 SHA-256 替代四舍五入的 `du` 数字。
- 明确是否纳入 research 中的 `business-flows.html`、`hooks.json`、`package.json`、`package-lock.json`、`.mjs` 等非 Markdown 文件。

---

### 1.7 F7：两份 demo 自包含、无本地相对资源

**裁决：B，表述“自包含”不成立。**

证据：

- `demo/saydo-console-demo.html` 主要使用内联 SVG/data URI，没有发现本地相对 `src/href`。
- `demo/saydo-console-demo-atelier.html:7-9` 明确加载：

  ```html
  https://fonts.googleapis.com
  https://fonts.gstatic.com
  https://fonts.googleapis.com/css2...
  ```

所以“无本地相对资源”基本成立，但“自包含”不成立；atelier 依赖网络字体。

最小改法：

- 要么移除/内置字体；
- 要么把 F7 改成“无本地相对资源，主 demo 自包含，atelier 依赖外部 webfont”；
- 增加离线 headless 检查，而不是只做 `rg src/href`。

---

### 1.8 F8：docs→research 34/9、assets 0、ADR-001 16/8

**裁决：B，计数正确，但由此推导的“天然不断”不正确。**

实跑结果：

- `rg -n 'research/' voice-coding/docs | wc -l`：34
- 命中文件数：9
- `rg -n 'assets/' voice-coding/docs | wc -l`：0
- `rg -n 'ADR-001' voice-coding/docs | wc -l`：16
- 命中文件数：8

但方案把 ADR 移到 `docs/adr/design/`，把计划移到 `docs/plan/`，这些都改变了相对路径深度，不能说“根级同构所以天然有效”。

最小改法：将 F8 的计数与“迁移后路径模拟”分开，增加链接 manifest 和 baseline broken-link allowlist。

---

### 1.9 F9：`.gitignore` 会自动排除 node_modules 和 `*.log`

**裁决：C/B，规则事实正确，但“自动出局即可”不完整。**

证据：

- `SayDo/.gitignore:2`：`node_modules/`
- `SayDo/.gitignore:12`：`*.log`
- `SayDo/.gitignore:19`：`.DS_Store`
- `SayDo/.gitignore:31-32`：`.saydo/`

这确实会排除大体积 node_modules 和日志，但：

- `archive/`、`assets/`、`.playwright-mcp` 并不会因此自动排除；
- `package-lock.json` 不会被 `.gitignore` 排除；
- `research/codex-findings/logs/` 会因 `*.log` 被排除，从而无法满足“日志存 logs/”的可审计要求；
- “rsync 后 gitignore 自动决定迁入集”不可替代显式 manifest。

最小改法：用 `git check-ignore -v` 逐项核验，并在迁移清单中明确“复制到工作树但不进 git”和“根本不复制”的区别。

---

### 1.10 F10：220 处禁用字符，直接机械替换

**裁决：A/B。计数已过时；语义方案存在 A 级证据完整性风险。**

按当前 CI 实际正则：

```regex
[\p{Emoji_Presentation}\x{FE0F}\x{1F000}-\x{1FAFF}\x{2600}-\x{27BF}]
```

对当前候选 112 文件实跑：

```text
总计 244
docs 47
demo 17
templates 12
history 38
research 106
plans 22
prompts 2
```

所以 `REPO-MERGE-PROPOSAL.md:23` 的 220 不是当前门禁口径下的数字。差异还涉及新增 Prompt 4、`U+2B50`/其他 pictographic 字符以及 FE0F 的 code-point 计数方式，不能只靠手写 breakdown。

语义风险有真实证据：

- `IMPL-PROMPT-4-EXECUTOR.md:50`：`[ok]/[warn]/[fail]` 是“可复跑证据/差距/原因”三态图例。
- `docs/08-module-design.md:195-204`：`[ok]` 表示“已回改”，`[todo]` 表示待办。
- `docs/03-architecture.md:109-112`：`[ok]/[fail]` 是能力支持/不支持。
- `research/2026-07-25-saydo-wiring-impl-readback.fable.md:19-31`：表格中 `[ok]` 是证据状态。
- `templates/saydo.config.example.toml:11,21,31,134`：`U+2605` 是硬约束、恒 API、异族约束或“不要取消注释”，不是“推荐”。
- `history/scenarios/README.md:15`：`U+2605` 是设计哲学条目标记。
- `docs/11-ui-spec.md:184` 明确规定 Hopper 原始报告原样留存，展示层才做确定性转换，原始 digest 不变。

因此 `[ok]→[ok]`、`[fail]→[fail]`、`U+2605→推荐` 的全局替换不能声称“语义零改动”。尤其是 `U+2605` 替换会直接改变模板约束语义；对原始证据做替换会改变字节和 digest。

门禁本身还有一个 A 级缺陷：

- `SayDo/scripts/check-emoji.sh:5-6` 的默认模式是检查 git tracked 文件；
- `:17` 使用 `git ls-files`；
- §6 在 `rsync` 后、`git add`/提交前运行门禁，新迁入文件是 untracked 时不会被扫描。

实测：

```text
cd ~/WorkSpace/SayDo
bash scripts/check-emoji.sh
[ok] emoji gate: clean
```

但这是因为当前 SayDo tracked 状态干净，不代表待迁入文件干净。

显式检查迁入 TOML：

```text
bash SayDo/scripts/check-emoji.sh voice-coding/templates/saydo.config.example.toml
rc=1
```

命中 `U+2605` 的 11、21、31、134 行。

从 workspace 父目录误调用默认模式还会出现：

```text
fatal: not a git repository ...
[ok] emoji gate: clean
rc=0
```

说明脚本没有锚定仓根，错误 cwd 会产生假绿。

BIN_RE：

- `SayDo/scripts/check-emoji.sh:12` 只排除 `mp3,wav,png,jpg,jpeg,gif,webp,pdf,ico,woff2,lock`。
- 当前候选实际扩展名为 `.example/.html/.json/.md/.mjs/.sh/.toml`；`.toml`、`.html` 会被扫，已由上面的 TOML 失败实测证明。
- 当前源树没有 `.svg` 文件，但 `.svg` 不在 BIN_RE 中；未来加入 SVG 时会被当文本扫描。
- `.wasm/.avif/.mp4/.webm/.zip/.ttf/.otf/.eot` 等也未覆盖。

最小改法：

1. 冻结后从 manifest 生成字符计数，不再手写 220。
2. 先决定“原始证据保留”与“零 emoji 门禁”哪个是 canonical 约束：
   - 原始证据留存，展示层生成无 emoji derivative；
   - 或建立 owner 批准的 raw-evidence manifest/豁免；
   - 或明确承认 digest 需要重新生成。
3. 门禁改为检查“候选 manifest + staged + worktree”，或先完整 stage 再跑。
4. 以 MIME/文件清单而不是不完整扩展名黑名单决定二进制处理。
5. 对表格、TOML、HTML、JSON 分格式处理，禁止全局替换。

---

### 1.11 F11：SayDo 有未提交改动、journal R38

**裁决：B，当前已过时。**

截至本次最终核验 `2026-07-25 22:27:31 +0800`：

- SayDo 工作树干净；
- HEAD 为 `2f657ede...`；
- `history/PROCESS-JOURNAL.md:612-617` 已有 **R39**；
- `IMPL-PROMPT-4-EXECUTOR.md` 当前存在，mtime 为 21:44:26；
- `README.md` mtime 为 21:44:28；
- `research/codex-findings` 最新仍为 16。

因此方案 `:24` 的“当前 dirty/R38”是方案成稿时快照，不是当前事实。

最小改法：把 F11 改成带时间戳和 SHA 的前置检查，不要把旧状态写成永久事实；同时先暂停/协调当前 Prompt 4 活动，避免迁移和执行器批次并行。

---

## 2. §3 备选方案是否公允

**裁决：B，方案 A 的方向论证不完整，B 被低估，D 类方案未比较。**

方案 A/B/C 见 `REPO-MERGE-PROPOSAL.md:33-39`。问题在于比较维度只有“解决 F1-F5”和一次迁移成本，没有比较：

- canonical 所有权；
- 是否需要改动 244 个字符；
- 证据 digest 是否保留；
- 迁移期间的并发写入；
- 回滚是否能恢复两提交及归档声明；
- 日志是否可审计；
- clone 体积与远端权限；
- 未来文档/实现是否仍允许双写。

### B 方案被低估

B 方案至少可以拆成：

1. 将 3 个模板复制到 `SayDo/templates/`；
2. 修 `config.test.ts`、`run.mjs` 和相关结果/说明；
3. 给 voice-coding 初始化 git，并配置单独远端；
4. 暂时保留设计库 canonical。

这会先解决当前最明确的 CI 断链，改动面远小于 112 文件、244 个门禁字符和大量链接。它确实不能解决跨仓回写成本，但那是治理成本，不等于 B 方案“只解 F1 局部与 F2”就足以被否决。

### 未比较的 D 方案

至少应加入：

- **D1：docs 单独建仓**
  建立 `saydo-design` git 仓，SayDo 通过 pinned commit、release tar 或生成同步目录消费。保留设计/实现边界，同时获得版本化和远端备份。

- **D2：git subtree 或 submodule**
  subtree 适合把设计历史导入单仓；submodule 保留独立 canonical，但需要 checkout/CI 的递归策略。当前 voice-coding 不是 git，前提是先初始化并建立历史基线。

- **D3：双仓 + 同步门禁**
  继续保持两个仓，但由 CI 校验 SayDo 镜像与 voice-coding 指定 commit/manifest 的 SHA、路径和链接，任何漂移都失败。这是低风险的过渡方案。

- **D4：文档仓与大档案分离**
  canonical docs/research md 进入版本仓；archive/assets/logs 用 release artifact、对象存储或 LFS，不把历史运行日志塞进主 git。

最小改法：增加一张按“备份、原子性、CI、自包含、审计、体积、回滚、维护成本”评分的 A/B/C/D 矩阵，再由 owner 拍板。

---

## 3. §4.1/§4.2 顶层迁移清单完整性

当前 voice-coding 顶层实际有 20 项：

```text
.DS_Store
.playwright-mcp
AGENTS.md
IMPL-PROMPT-2-CLOSEOUT.md
IMPL-PROMPT-3-WIRING.md
IMPL-PROMPT-4-EXECUTOR.md
IMPL-PROMPT.md
IMPLEMENTATION-PLAN.md
README.md
REPO-MERGE-PROPOSAL.md
archive
assets
demo
docs
history
logs
prompts
research
saydo-review-readback.cursor.md
saydo-value-gaps-review.cursor.md
templates
```

| 顶层条目 | 方案归属 | 裁决 |
|---|---|---|
| `.DS_Store` | §6.2 rsync 排除，但 §4.2 未列 | C。明确“排除且不进入快照”，不要依赖隐含规则 |
| `.playwright-mcp` | §4.2 留下 | C。需说明它是否包含会话状态/敏感数据 |
| `AGENTS.md` | 并入 SayDo | **B/A 条件性**。与 SayDo `AGENTS.md` 同名，不能 rsync 覆盖 |
| `IMPL-PROMPT.md` | `IMPL-PROMPT*.md` | B。需改根路径引用 |
| `IMPL-PROMPT-2-CLOSEOUT.md` | wildcard | B。当前存在 |
| `IMPL-PROMPT-3-WIRING.md` | wildcard | B。当前存在 |
| `IMPL-PROMPT-4-EXECUTOR.md` | 方案写“3 份”时尚未列出 | **A/B**。这是当前活跃交接，不能按旧快照遗漏 |
| `IMPLEMENTATION-PLAN.md` | 移入 `docs/plan/` | B。大量根路径引用需要更新 |
| `README.md` | 并入 SayDo | **B/A 条件性**。与 SayDo README 同名且内容/状态不同 |
| `REPO-MERGE-PROPOSAL.md` | 未明确 | B。应复制到 `docs/plan/` 作为决策记录，或明确 source-only 并保存哈希 |
| `archive` | 留在 voice-coding | C。体积约 22M |
| `assets` | 留下 | C。应明确是否需要不可变快照 |
| `demo` | 移入 | B。atelier 有外部字体 |
| `docs` | 移入并与 SayDo docs 合并 | B。ADR 子目录会改相对深度 |
| `history` | 移入 | B。日志/原始证据的 emoji 与 digest 规则未解决 |
| `logs` | 留下，且 `*.log` ignored | B。与评审制度“日志存 logs/”不兼容 |
| `prompts` | 移入 | B。当前 prompt 17/4 中有旧根路径 |
| `research` | 只写 md+spike scripts | **B**。当前还有 html、json、mjs、sh、package.json、package-lock.json，范围不明确 |
| `saydo-review-readback.cursor.md` | §4.2 留下 | C/B。需明确 Cursor 文档是否仍可被未来 agent 读取 |
| `saydo-value-gaps-review.cursor.md` | §4.2 留下 | C/B。同上 |
| `templates` | 移入 | A（F2 相关）。必须与测试路径一起原子迁移 |

### 同名和路径冲突

用文件系统相对路径比较（排除 `.git`/`node_modules`）得到的精确冲突是：

```text
.DS_Store
AGENTS.md
README.md
```

只与 SayDo tracked 文件比较时是：

```text
AGENTS.md
README.md
```

目录重叠：

- `docs/`
- `docs/adr/`

SayDo 当前已有：

```text
docs/adr/ADR-001-pipecat-interrupt-go.md
docs/adr/ADR-002-byoa-observed-model.md
docs/adr/ADR-101-asr-volc.md
```

incoming 的 `ADR-001-execution-layer.md` 文件名本身不冲突，但编号和索引语义冲突。

另外，SayDo 的被忽略 `.saydo/knowledge` 仍保存旧 canonical：

- `.saydo/knowledge/core.md:18-31`
- `.saydo/knowledge/conventions.md:7-20`

其中仍指向 `~/WorkSpace/voice-coding/`，并写“设计层 ADR 留 voice-coding”。这不是 git 文件冲突，却是 agent 上下文冲突，必须在迁移后重建。

---

## 4. §5 引用表与断链面

### 4.1 SayDo → voice-coding

方案表 `REPO-MERGE-PROPOSAL.md:74-81` 没有完整覆盖。

实测：

```text
git grep -n -I voice-coding
```

- 25 行
- 15 个 tracked 文件

`rg --hidden --no-ignore` 排除 `.git`/`node_modules`：

- 29 行
- 17 个文件

除方案已列的 12 个文件外，至少遗漏：

- `e2e/spikes/fts-d9/RESULT.md`
- `e2e/spikes/fts-d9/spike-output.json`
- `e2e/smoke/cursor-cli-0.0/RESULT.md`

关键运行时/默认路径：

- `packages/daemon/test/config.test.ts:11,240,249`
- `e2e/spikes/fts-d9/run.mjs:16`
- `e2e/spikes/fts-d9/RESULT.md:3,7`
- `e2e/spikes/fts-d9/spike-output.json:3`
- `e2e/smoke/cursor-cli-0.0/run.sh:6`
- `e2e/smoke/cursor-cli-0.0/RESULT.md:4`
- `AGENTS.md:3-6,16`
- `HANDOFF.md:7-8,25`
- `README.md:12`

“历史证据不改内文”不能覆盖 `run.mjs` 的可执行默认值，也不能让 `spike-output.json` 继续指向不存在的旧目录。应明确将每个引用分类为：

- 必须修的可执行路径；
- 历史事实，只改注记；
- 生成输出，保留原始但新增迁移后重跑结果；
- 绝对路径，需改成 repo-relative 或脱敏占位符。

### 4.2 voice-coding → SayDo

§5 没有反向引用行。

当前活跃文件中可直接看到：

- `IMPL-PROMPT-4-EXECUTOR.md:7,22-27`
- `IMPL-PROMPT-3-WIRING.md:7,21-26`
- `IMPLEMENTATION-PLAN.md:20,24`
- `research/codex-findings/16-wiring-batch-writeback.md` 多处同时引用两仓绝对路径
- `prompts/17-repo-merge-proposal.md:26`

这类引用在迁移后不会全部变成断链，但会继续制造“双根目录”认知。方案必须增加 reverse mapping 行，并规定：

- active prompt 改成仓内相对路径；
- 历史报告保留原始引用时，增加迁移映射；
- 绝对本机路径是否允许进入 SayDo git，需要单独做隐私审计。

当前按上述候选文件扫描，有 **29 个文件含 `/Users/...` 绝对工作区路径**；远端仓可见性本轮未核实。

### 4.3 迁移后会断的内部相对链接

#### 根 README 的计划链接

`voice-coding/README.md:10,32` 仍链接：

```text
IMPLEMENTATION-PLAN.md
IMPL-PROMPT.md
IMPL-PROMPT-2-CLOSEOUT.md
IMPL-PROMPT-3-WIRING.md
IMPL-PROMPT-4-EXECUTOR.md
```

若目标是 `SayDo/docs/plan/`，这些链接都会失效，除非改成 `docs/plan/...`。

#### docs 内对根计划的链接

- `docs/08-module-design.md:7` 使用 `../IMPLEMENTATION-PLAN.md`
- `docs/10-voice-ux-spec.md:5` 也以根计划为分期裁决

迁移后应改成 `plan/IMPLEMENTATION-PLAN.md` 或统一 repo-root 链接。

#### ADR 深度改变

源文件 `voice-coding/docs/adr/ADR-001-execution-layer.md`：

- `:5`：`../../history/...`、`../../research/...`
- `:28`：`../09-data-contracts.md`
- `:84`：`../../research/...`

移动到 `SayDo/docs/adr/design/` 后，至少应改成：

- `../../../history/...`
- `../../09-data-contracts.md`
- `../../../research/...`

方案 `:43` 所说“保持相对深度天然不断”在 ADR 和 `docs/plan` 两处不成立。

#### 已存在的 baseline 链接问题

以下不是迁移新造成的，但必须在 link gate 中作为 baseline 明确列出，否则会混淆责任：

- `voice-coding/docs/06-references.md:103-109` 对 `history/` 的描述与所在目录基准容易误读；
- `voice-coding/research/codex-findings/04-interaction-product.md:4` 的 `../voice-coding-framework.Cursor2.md`、`../scenarios/` 当前就不是从该目录可直接解析的路径。

最小改法：生成一份逐链接清单，字段至少包括“源文件、原链接、迁移后解析路径、分类、处理动作、baseline/induced”。

---

## 5. §6 实施顺序、两提交法与评审制度

### 5.1 顺序存在依赖倒置

当前顺序 `REPO-MERGE-PROPOSAL.md:85-93` 是：

1. 先收口 dirty；
2. 建分支；
3. rsync；
4. 清 emoji；
5. 改引用/合并规则；
6. 跑门禁；
7. 两提交；
8. 修改源库归档头。

缺少一个更早的“冻结与清单”阶段。正确依赖应是：

1. 停止/协调 Prompt 4 等活跃写入，冻结两棵树；
2. 记录 SayDo HEAD、voice 文件 manifest、字节数和 SHA-256；
3. 确定每个顶层条目的归属和冲突策略；
4. rsync dry-run + checksum，禁止 delete；
5. 先完成 AGENTS/README/ADR namespace 的语义合并；
6. 更新运行时路径和内部链接；
7. 将迁移清单全部 stage 或纳入显式 manifest；
8. 从 SayDo 仓根运行门禁，并在 clean clone 复核；
9. 提交 migration commit，再提交 evidence commit；
10. 最后才写归档声明，并把确切 migration SHA 写入。

当前方案还把 `docs/plan/MIGRATION.md` 放在实施步骤里，但没有列入 §4.1 的迁移清单；应补入清单。

### 5.2 两提交法的可执行性

当前 SayDo 在最终核验时是 clean，因此 F11 不再阻塞；但源目录仍有活跃 Prompt 4，且本轮观察到：

- 方案 mtime：21:32:24
- Prompt 4 mtime：21:44:26
- README mtime：21:44:28
- `logs/17-repo-merge-proposal.log` 当前 mtime：22:26:12，大小约 3.88MB

这说明方案不是一个静态、原子快照。不能在此状态下直接 rsync。

此外，“迁移不与业务改动混批”与“修 config.test.ts/run.mjs”需要定义边界。它们虽然不是业务功能，但确实是代码/测试文件变更。最小改法是：

- 独立 `repo-merge` 分支；
- 明确 migration-only code changes 清单；
- 若 Prompt 4 开工，迁移必须等待其 commit，或由 owner 明确锁定基线；
- evidence commit 只记录已存在的 migration commit SHA，不自指。

### 5.3 评审制度路径重定义有审计漏洞

`voice-coding/AGENTS.md:5-9` 要求：

- 2 个 subagent；
- 1 个 Codex；
- 报告存 `research/codex-findings/NN-*.md`；
- prompt 存 `prompts/`；
- 日志存 `logs/`；
- journal 记录输入/行动/产出/结论。

方案 `:70` 把这些路径搬进 SayDo，但又承认 `logs/*.log` 因 `.gitignore` 不进 git。

结果是：报告和 prompt 可审计，日志却不能审计；“日志存 logs/”只能证明某个本地工作树曾经有文件，不能证明提交时的内容、完整性或对应关系。

最小改法，二选一：

1. 将制度改成“日志为本地运行产物，提交其 SHA-256、命令摘要和时间窗到 tracked audit manifest”；或
2. 建立专门的、脱敏且可追踪的日志归档目录，并由 `.gitignore`/CI 明确管理。

同时增加 CI 检查：每个 `codex-findings/NN-*.md` 是否有对应 prompt、journal 条目和 log manifest。

---

## 6. 回滚与风险

### 6.1 回滚定义不完整

方案 `REPO-MERGE-PROPOSAL.md:95-97` 写“git revert 合并 commit”，但 §6 又设计了两个提交：

1. migration/feature commit；
2. evidence commit。

只 revert 一个提交，可能留下：

- 迁移文件但没有证据；
- evidence 引用不存在的 SHA；
- AGENTS/README 已切换而文件被部分撤回；
- voice-coding 的归档声明仍指向已回滚的 commit。

**裁决：B，若复制/覆盖策略未定义则接近 A。**

最小改法：

- 明确逆序回滚两个 commit；
- 在临时 clean clone 中演练；
- source 侧归档声明必须有单独的恢复步骤；
- 迁移前保存不可变 manifest，而不是把“当前非 git 目录”当作天然快照。

### 6.2 “一字不删”与实际修改矛盾

§4.2 说 voice-coding 原件一字不删，但 §4.2 又明确修改：

- `README.md`
- `AGENTS.md`

此外，源目录本身不是 git，迁移完成后仍可被未来会话继续修改。仅加一段归档声明不能强制只读。

**裁决：A/B。** 这是 canonical 分叉风险。

最小改法：

- 先生成只读压缩快照并校验；
- 将源目录权限/owner 流程设为只读，或移动到明确的 archive 路径；
- 归档声明中写入目标仓 commit、manifest SHA 和冻结时间；
- 设置定期 drift check，检测 archive 与 SayDo canonical 是否有新增差异。

### 6.3 pnpm workspace / tsconfig

**裁决：C，当前直接风险低，但需记录边界。**

证据：

- `SayDo/pnpm-workspace.yaml:1-3` 只包含 `packages/*` 和 `e2e`；
- `tsconfig.base.json` 没有递归 include；
- `packages/daemon/tsconfig.json:8` 只 include `src,test`；
- `packages/console/tsconfig.json:20` 只 include `src`；
- `package.json:10-13` 的 typecheck/lint/test 只针对 workspace/package 脚本。

所以新增顶层 `docs/research/templates/history/prompts` 不会自动成为 pnpm package 或 TypeScript 输入。需要注意的是 research spike 中已有 `package.json`/`package-lock.json`，它们不会被当前 workspace glob 纳入，但必须在迁移清单中明确为“资料”而不是 package。

### 6.4 git 体积和 GitHub 文件大小

当前 SayDo：

- `.git`：约 9.2M；
- pack：约 5.3M；
- tracked files：329；
- 当前候选迁移集：约 2.0 MiB；
- voice-coding 当前最大 regular file 是约 8.1M 的日志；
- 本次扫描没有发现超过 50M 的单文件。

因此按候选集迁入，单文件大小不是立即阻断；但若误把 `logs/`、`node_modules/` 或 archive 二进制纳入，仓库增长和后续历史膨胀会明显。`.gitattributes`/LFS 未发现，且本轮没有远端 push 验证。

最小改法：在 preflight 中加入最大文件、总新增字节和扩展名清单门禁；超过阈值必须走 release artifact/LFS/独立仓。

### 6.5 Cursor / agent workspace 规则

源树中实际存在：

- `docs/hopper-side-feedback-for-saydo.cursor.md`
- 根级 `saydo-review-readback.cursor.md`
- 根级 `saydo-value-gaps-review.cursor.md`
- archive 下的历史 `.cursor.md`
- `.playwright-mcp`

没有发现 `.cursor/` 目录，但 SayDo 的 `.saydo/knowledge/conventions.md` 已缓存对旧规则和旧 canonical 的摘录。

**裁决：B。** 方案只列出根级两个 Cursor review 文件留档，却没有说明 `docs/hopper-side-feedback-for-saydo.cursor.md`、`.saydo/knowledge` 和未来 agent 的读取优先级。

最小改法：明确哪些 `.cursor.md` 是 active、哪些是 archive；迁移后重建 `.saydo/knowledge`，并在 AGENTS 中声明唯一 canonical 根。

### 6.6 本地绝对路径与远端可见性

候选文件中有 **29 个文件**包含 `~/WorkSpace/...` 绝对路径。`IMPLEMENTATION-PLAN.md:20` 称 SayDo 为 GitHub 私有仓，但本轮没有验证远端可见性或权限。

**裁决：B/C（条件性隐私风险）。**

最小改法：迁移前将本机路径替换为 repo-relative 或 `<workspace>` 占位符；若确需保留证据路径，放入本地不提交的 manifest。

---

## 7. 建议的最小修订门槛

在 owner 重新拍板前，方案至少应补齐：

1. 一份带时间戳、SHA-256、文件数和字节数的源快照 manifest。
2. 顶层 20 项逐项归属表，特别补 `REPO-MERGE-PROPOSAL.md`、Prompt 4、`.DS_Store`、research 非 Markdown 文件。
3. 完整 collision manifest，明确禁止 rsync 覆盖 `AGENTS.md`/`README.md`。
4. 双向引用表和迁移后 link manifest。
5. emoji raw-evidence policy、按当前 CI 正则重新统计的 244 基线，以及 staged/untracked gate 方案。
6. 迁移 commit/evidence commit 的精确定义和双提交逆序回滚演练。
7. 评审报告、prompt、log、journal 的可审计关联机制。
8. 源 archive 的冻结/只读策略和 drift check。
9. 对绝对本机路径、远端可见性和最大文件的 preflight。
10. 重新评估 B、D1、D2、D3，而不是只在 A/B/C 中选择。

---

# 事实前提核验表

## 本次实读的主要文件

- `voice-coding/REPO-MERGE-PROPOSAL.md:1-113`
- `voice-coding/AGENTS.md:1-24`
- `voice-coding/README.md:1-43`
- `voice-coding/IMPL-PROMPT-4-EXECUTOR.md:1-52`
- `voice-coding/history/PROCESS-JOURNAL.md:598-617`
- `voice-coding/IMPLEMENTATION-PLAN.md:1-30,133-138,187`
- `voice-coding/docs/03-architecture.md`
- `voice-coding/docs/06-references.md:103-109`
- `voice-coding/docs/08-module-design.md:7,195-209`
- `voice-coding/docs/09-data-contracts.md`
- `voice-coding/docs/10-voice-ux-spec.md`
- `voice-coding/docs/11-ui-spec.md:184`
- `voice-coding/docs/adr/ADR-001-execution-layer.md:5,28,84`
- `voice-coding/templates/saydo.config.example.toml:11,21,31,134`
- `voice-coding/history/scenarios/README.md:15`
- `voice-coding/research/codex-findings/04-interaction-product.md:4`
- `SayDo/AGENTS.md:3-45`
- `SayDo/HANDOFF.md:7-8,25,35`
- `SayDo/README.md:10-32`
- `SayDo/.github/workflows/ci.yml:12-25`
- `SayDo/.gitignore:2,12,19,21-32`
- `SayDo/scripts/check-emoji.sh:1-25`
- `SayDo/scripts/test-emoji-gate.sh:1-40`
- `SayDo/packages/daemon/test/config.test.ts:11,238-255`
- `SayDo/e2e/spikes/fts-d9/run.mjs:5-17`
- `SayDo/e2e/smoke/cursor-cli-0.0/run.sh:1-13`
- `SayDo/pnpm-workspace.yaml`
- `SayDo/tsconfig.base.json`
- `SayDo/packages/*/tsconfig.json`
- `SayDo/package.json`
- `SayDo/justfile`
- `SayDo/docs/adr/ADR-001-pipecat-interrupt-go.md:1-4`
- `SayDo/.saydo/knowledge/core.md:18-31`
- `SayDo/.saydo/knowledge/conventions.md:7-20`

## 实跑的只读命令/结果摘要

- `git -C SayDo status --porcelain=v2 --branch`
  当前 `main` clean，HEAD `2f657ede...`，与 `origin/main` 同步。
- `git -C SayDo log -1`、`git remote -v`
  实读当前 commit、远端 URL。
- `git -C voice-coding status`
  返回非 git 仓错误。
- `find` 顶层、隐藏文件、Cursor-like 文件、symlink。
- `du -sh`、`du -sk`、`stat`、regular-file 字节求和。
  当前 voice-coding `du` 为 132M，regular-file 字节和 133,061,894。
- `git count-objects -v`、`.git`/`node_modules` 体积。
- `git grep -n -I voice-coding`
  25 行、15 个 tracked 文件。
- `rg --hidden --no-ignore` 双向引用扫描。
  SayDo 工作树 29 行、17 个文件；额外命中 `.saydo/knowledge`。
- `rg` 计数 F8：research 34/9、assets 0、ADR-001 16/8。
- 文件系统相对路径 collision 扫描：`.DS_Store`、`AGENTS.md`、`README.md`。
- 候选集文件计数/字节求和：112 文件、2,104,960 bytes。
- 按 CI 正则的候选 emoji 统计：244，分类为 docs 47、demo 17、templates 12、history 38、research 106、plans 22、prompts 2。
- `bash SayDo/scripts/check-emoji.sh voice-coding/templates/saydo.config.example.toml`
  返回 `rc=1`，命中模板第 11、21、31、134 行的 `U+2605`。
- `cd SayDo && bash scripts/check-emoji.sh`
  当前 tracked SayDo 返回 `[ok] emoji gate: clean`。
- 从 workspace 父目录运行默认 gate
  出现 `fatal: not a git repository` 后仍返回 `[ok] ... rc=0`，验证了 cwd 假绿问题。
- 最大文件扫描、候选扩展名扫描、demo 外部资源扫描。

## 未做、因此不作断言的事项

- 未运行 `just ci`、`pnpm test`、Playwright 或 Python pytest。
- 未运行 GitHub Actions，也未 push、revert 或创建分支。
- 未验证 GitHub Actions billing、远端仓可见性、远端备份是否存在。
- 未使用网络工具。
- 未修改任何文件；本复核没有执行写入、提交或删除。

## 来自推断而非直接实跑的结论

- “GitHub checkout 后 voice-coding 路径不存在”是依据 workflow 只 checkout SayDo 和仓内文件结构作出的推断，未在 Actions 中实跑。
- “未来会形成 canonical fork”是依据当前源目录非 git、Prompt 4/日志仍在更新、以及 §4.2 保留原件作出的风险判断。
- “绝对路径可能泄露隐私”取决于远端可见性；本地文件中确实存在这些路径，但远端权限未核实。

**本复核结论仅适用于上述时间点的工作树快照；源目录在本轮期间仍发生了时间戳/内容更新，不能把方案中的旧 F11/F10 数字直接视为当前状态。**
