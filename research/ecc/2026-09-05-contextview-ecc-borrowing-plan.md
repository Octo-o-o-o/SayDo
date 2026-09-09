<!-- ecc:review-status:begin -->
> 本轮文档已根据独立评审修订，R3 为 GREEN，9/9 最终文档门禁通过。以下保留冻结候选的写作与评审历史；当前结论见[评审与交付核验记录](../codex-findings/2026-09-05-ecc-research-review.md)。候选建议仍须 owner 选定后导入现有排产，产品代码未实施。
<!-- ecc:review-status:end -->

# Contexpect 对 ECC 的借鉴方案（候选；归档于 SayDo research）

> **性质：候选建议，不是 Contexpect 合同变更，不是 WP 开工授权，不是 GREEN。** R1 独立评审 RED（4 个 P1）；本文件为实施线按源码回修稿，R2 已确认前 4 个 P1 闭合；本次为接收集合与最终 P2 校正稿，R3 待独立核验。
> 本文件是调研档案。接收位置应为 Contexpect 仓的 `docs/research/2026-09-05-ecc-borrowing-plan.md`。
> **正文里的 Contexpect 链接按最终路径 `docs/research/` 书写。** ECC 链接使用固定 SHA permalink。
> ECC 源码坐标：[`e04ea0b9cc8248686edf5ac751cadff550e162b8`](https://github.com/affaan-m/ECC/tree/e04ea0b9cc8248686edf5ac751cadff550e162b8)。npm 发布坐标仍是 `ecc-universal@2.2.0`（registry 无 2.2.1）。
> Acceptance cutoff：[`2026-09-04T23:59:59+08:00`](../requirements/2026-09-04-contexpect-complete-product-requirements.md)。本调研日 2026-09-05 的新观察 **不得** 变成 required scope。ECC HEAD 时间戳早于 cutoff，允许作为 **冻结夹具候选**，不允许成为第 19 个 required adapter family。

配套调研（SayDo 档案）：同目录 `2026-09-05-ecc-project-research.md`。Contexpect 现状：规范 + 验收合同 + 合成夹具，[尚未实施产品运行时](../../README.md)。

## 0. 一句话

**把 ECC 当成“第三方 harness 叠加配置与夹具发生器”，用来喂 F-02 inventory / F-08 Doctor / F-11 catalog / F-12 importer 的静态与启发式层；不要跑 `ecc` CLI 当 native oracle，不要把 install-state 或 doctor 绿当成 Model-visible。**

调研日相对 cutoff：日历日已进入 2026-09-05，但 ECC HEAD（2026-09-03 16:51 -0400）换算后仍早于 cutoff。因此 **允许** 把该 SHA 当 optional fixture pin，**不允许** 把 09-05 官网 261 skills / 210K stars 写进 required 矩阵。npm `2.2.0`（2026-08-27）是更稳的发布 pin；源码 2.2.1 未发布。

## 1. 产品边界（必须先钉死）

Contexpect 是 expected / observed / reconciled，见 [真值模型](../architecture/data-and-truth-model.md)。六个 facet 互不蕴含。ECC 几乎只提供 **Installed / 部分 Discoverable** 的声明，外加少量启发式观测。

| ECC 产物 | 最高合法 provenance | 最高合法 facet | 非法升级 |
| --- | --- | --- | --- |
| `skills/*/SKILL.md` 文件 | harness-source / official-spec（若对照宿主文档） | Installed；Discoverable 仅当 resolver 规则来自官方/源码 | Model-visible |
| `ecc.install.v1` | harness-source | Installed（managed 文件） | executable-present |
| `hooks/hooks.json` | harness-source | Installed；Eligible 未知 | UseEvidence |
| `ecc memory` 文档 | harness-source | Installed memory 资产 | 长期规则 / Outcome-affecting |
| `ecc.session.v1` 快照 | heuristic 或 harness-source | UseEvidence 仅当字段来自宿主文件 | native-runtime |
| `ecc doctor` | heuristic | Doctor finding 候选 | CI pass / verified |
| `ecc` CLI 自身 | 第三方工具 | 不得进入 [compatibility-matrix](../../acceptance/compatibility-matrix.yaml) 的 18 family | live oracle |

冻结的两个 native oracle 仍只有 Codex `debug prompt-input` 与 Grok `inspect --json`（[AGENTS.md](../../AGENTS.md)）。ECC 不在此列。

ECC 也不是 18 个 adapter family 之一。它叠加在 Claude Code / Codex / Cursor / OpenCode / Kimi 等 **已声明 family** 的配置目录上。正确建模是 `overlay_source=ecc` + `target_family=claude-code|...`，不是 `family_id=ecc`。

## 2. 对照 F-01–F-18

每条：ECC 能提供什么、落到哪、验收正反例。WP 指 [implementation-plan](../process/implementation-plan.md)。

### CV-01 F-01 探测：配置残留 ≠ 可运行（A）

- **ECC 事实**：doctor 无 install-state 时 `results=[]` 仍 exit 0；control pane 默认 DB 路径在 Claude 家目录约定下。有 `.ecc` / `.claude/ecc` 只是 residue。
- **落点**：WP-02 collector。`executable-present` 看 `claude`/`codex` 等宿主，不看 `npx ecc-universal`。ECC overlay 记 `config-residue-present`。
- **合同先行**：在 compatibility / inventory schema 增加可选 `overlay_packages[]`（id/version/git_sha/license），不新增 family。
- **正例**：仅有 `.ecc/memory` 且无 `claude` → family `not-installed`，overlay `residue`。
- **反例**：因 `ecc doctor` ok 把 Claude 标 installed。
- **cutoff**：钉 ECC SHA；升级须修订夹具，不改 18 family 表。

### CV-02 F-02 Inventory：三层 identity（A）

- **ECC 事实**：286 `SKILL.md` ≠ 83 install-components ≠ 36 modules ≠ 官网 91。见调研 §3/§6。
- **落点**：WP-01/WP-02 inventory item。`asset_kind` 区分 skill-file / install-component / install-module / hook-entry / memory-document。
- **被动扫描**：只读 markdown/json；不执行 hook、不启动 MCP、不 `ecc install`。
- **正例**：同一 `tdd-workflow` 可同时是 SKILL.md 与 component alias；digest 按文件。
- **反例**：把 286 写成“已验证 native skills”。
- **夹具**：第一阶段只用自有 Apache-2.0 合成最小配置演示三层 identity（见 §4/§8），`live_tested: false`。不从 ECC 摘录实质正文或脚本。

### CV-03 F-03 Resolver：投影损失必须可见（A）

- **ECC 事实（实现，优先于漂移文档）**：当前 Codex 装载面是 native plugin，不是 instruction-backed。`.codex-plugin/plugin.json` 绑定 [`hooks/codex-hooks.json`](https://github.com/affaan-m/ECC/blob/e04ea0b9cc8248686edf5ac751cadff550e162b8/hooks/codex-hooks.json)；该文件只登记同步 `SessionStart` command hook。[`harness-capabilities.js`](https://github.com/affaan-m/ECC/blob/e04ea0b9cc8248686edf5ac751cadff550e162b8/scripts/lib/harness-capabilities.js) 标 `native-plugin` / `native-trust`。[README](https://github.com/affaan-m/ECC/blob/e04ea0b9cc8248686edf5ac751cadff550e162b8/.codex-plugin/README.md) 要求 `/hooks` 显式信任，plugin 安装不授权命令。上游 [cross-harness](https://github.com/affaan-m/ECC/blob/e04ea0b9cc8248686edf5ac751cadff550e162b8/docs/architecture/cross-harness.md) 与 compliance 矩阵仍写 Codex instruction-backed，这是 **文档漂移**，不得当 resolver 真值。install-targets 仍把同一 module 写进 `.claude` / `.cursor` / `.kimi-code` 等 **不同 native 路径**。legacy `sync-ecc-to-codex.sh` 单列，不是 native plugin。
- **落点**：WP-02 resolver + [F-09](../requirements/2026-09-04-contexpect-complete-product-requirements.md) loss 类别。Codex 上的 `hooks-runtime` **禁止**整类标 `omitted` 或 instruction overlay。
- **正例（逐事件）**：
  - `SessionStart`：Codex native 已登记 → 损失不得写 `omitted`；最高 Installed / 或 Discoverable（需 `/hooks` 已信任的证据）。**不得** `verified`，**不得** Model-visible / UseEvidence / Outcome-affecting。
  - `PreToolUse` / `PreCompact` / `PostToolUse` / `PostToolUseFailure` / `Stop` / `SessionEnd`：各标 `not-in-native-bundle`（或协议不支持 / 拦截类被排除），一事一判。
  - legacy sync 的 git hook 与 `config.toml` MCP 不进 native plugin 列。
- **反例**：把 `hooks-runtime` 对 Codex 写成整类 `omitted` 或 instruction overlay；因 plugin `list` 绿把 SessionStart 标 Model-visible。

### CV-04 F-04/F-08 Doctor 规则语料（A）

- **来源**：[F-08](../requirements/2026-09-04-contexpect-complete-product-requirements.md) 要检测 secret、symlink、过大常驻、错误 frontmatter。ECC doctor 检测 managed drift；memory doctor 检测 duplicate id / broken links / 坏 gitignore。
- **落点**：WP-02 `ctxpect-doctor` **确定性规则** 的夹具，不是调用 `ecc doctor`。
- **做法**：把 ECC 测试里的负例（gitignore 被掏空、路径逃逸、secret 形态）改写成 Contexpect corpus issue 类；LLM 不得单独使 CI 失败。
- **正例**：symlink 逃出 project vault → finding + evidence path。
- **反例**：shell 出 `ecc doctor` 作为 CI evaluator。

### CV-05 F-05 Receipt：ECC 输出只当附件（A）

- ECC JSON（doctor/memory/session snapshot）可当 evidence blob，Receipt header 仍是 Contexpect schema。
- provenance 不得写 native-runtime。
- 删除附件留 tombstone。不得把 ECC 报告签名冒充 Context Receipt 签名。

### CV-06 F-06/F-07 Inspector 与 Diff（B）

- 用 ECC overlay 作为 Compare 列：“Claude + ECC 2.2.0 pin” vs “Claude 无 overlay”。
- 单元格显示 overlay presence / module set / hookConsent，而不是一个 Active。
- 无 native oracle 时 Model-visible = indeterminate。

### CV-07 F-09 Projection：ECC 不是 ProjectionAuthority（C 作为 authority，A 作为损失样本）

- [F-09](../requirements/2026-09-04-contexpect-complete-product-requirements.md) authority 枚举不含 ECC。`ecc install` 不得成为 `contexpect-native` 或 APM。
- 价值：提供 “同一 module 在 15 个 target 的 destination 不同” 的 golden loss report 样本。
- **反例**：Contexpect apply 去调 `ecc install --profile full`。

### CV-08 F-10 Sync（C）

- 不把 `.ecc/memory` 或 `~/.claude/ecc2.db` 纳入默认 sync allowlist。
- team memory 即使在 git 里仍是 unreviewed context，不能当 TeamContextStandard。

### CV-09 F-11 Catalog / 供应链（A）

- ECC 官方面：GitHub `affaan-m/ECC`、npm `ecc-universal`、slug `ecc@ecc`。SECURITY 警告非官方包。
- 落点：WP-08 assets。展示 license MIT、commit pin、has hooks、默认 MCP 政策。
- 无许可证/来源不明默认不复制。Contexpect 不自建 ECC marketplace。
- **正例**：夹具含假冒包名 → 阻止复制。
- **反例**：跟随 ECC `main` 自动更新 required corpus。

### CV-10 F-12 Importers（B，严格限制）

- session-adapters 把 Claude history / Codex worktree / OpenCode / dmux 归一成 `ecc.session.v1`。这是 **第三方归一化**，覆盖未知。
- 落点：WP-05 importer 走 overlay-to-claim 提案（research/spec 域，不新增 `acceptance/field-to-claim` 文件）：ECC `workers[].health` → heuristic；不得标 native-runtime。
- Codex prompt-input 仍是唯一 Codex native oracle。ECC session snapshot **不能** 填补 wire payload。
- **反例**：timeline 为未暴露的 compaction 补造 event。

### CV-11 F-13/F-14 Advisor 与历史（C 自动，B 候选）

- ECC instinct/confidence 与 changelog 中的 auto-prune 是反面教材。
- Advisor 可引用“ECC 会在 SessionStart 注入最多 6 条 instinct”作为 **配置行为解释**，输出 `AdvisorSuggestion`，不写 Claim。
- 历史分析：“在已导入的 N 个 session 中未观察到该 skill” ，不推广。

### CV-12 F-15 Effect Lab（C）

- 不要用 ECC orch 或 `ecc2 harness-eval` 当 ExperimentContract runner。后者是 operator 断言分数，不是统计实验。

### CV-13 F-16/F-17/F-18 CI 与 Policy（B）

- CI：ECC overlay 缺失或未知版本 → exit 3 / indeterminate，不得因 `ecc doctor` 0 而 exit 0。
- Policy：ECC hook 是否安装是 context policy（egress/secret），package 安装仍归 APM。双 authority 禁止。
- 本地 API：可借鉴 ECC loopback Host 门作为 **实现时** 对照，不把 `ecc control-pane` 嵌进桌面。

16 类 capability taxonomy（真值模型）与 ECC 资产的诚实对应：instructions/rules → ECC `rules/` 与宿主 AGENTS；skills → `SKILL.md`；plugins → plugin.json 不是通用 marketplace；MCP → 默认只 chrome-devtools 政策 + opt-in 列表；hooks → hooks.json；memory → vault；custom commands → `commands/`；agent/subagent → `agents/` markdown，**不是** 运行中 child session。动态类（tool result、当前 occupancy）ECC 不能填 present。

## 3. 六个 facet 映射（禁止单调绿条）

| Facet | ECC 能证明什么 | 不能证明什么 |
| --- | --- | --- |
| Installed | managed 文件存在且 hash 匹配 install-state | 宿主可运行 |
| Discoverable | 文件在宿主会扫描的目录（需 family resolver，不靠 ECC 自称） | 模型已加载 |
| Eligible | 至多 skill description/glob（仍常 unknown） | 本次任务必选 |
| Model-visible | 无，除非冻结 oracle 看到该正文 | doctor 绿 |
| UseEvidence | 仅当宿主日志字段存在；ECC 自写 tracker 默认 internal-attribution | 调用了 skill |
| Outcome-affecting | 无 | skill-evolution 成功率 |

ECC install target 与 18 family 的对照（overlay，不是新 family）：

| ECC target | 可能叠加的 family | 备注 |
| --- | --- | --- |
| claude / claude-project | Claude Code | guided；Claude `hooks.json` 七类事件；plugin `mcpServers: {}` |
| codex | Codex | **两列**：native plugin = `/hooks` 显式信任的 `SessionStart` 子集 + `.mcp.json` 仅 chrome-devtools；legacy sync = `config.toml` 六 MCP + git hooks，非 marketplace。其余 Claude 事件逐项 `not-in-native-bundle`，禁止整类 omitted / instruction-backed |
| cursor | Cursor | adapter-backed；勿覆盖用户规则 |
| opencode | OpenCode | home 路径迁移过 |
| kimi | Kimi Code | guided 但 hooks 未配置 |
| gemini | Gemini CLI | instruction-backed |
| qwen | Qwen Code | advanced |
| antigravity / zed / hermes / openclaw / adal / codebuddy / joycode | 不在 18 family 或仅部分对应 | **不得**因 ECC 支持而加入 required family；unknown-honesty 或 N/A |

Copilot / Kiro / Pi 出现在 ECC 文档矩阵但不在 install-targets：Contexpect 已有 Copilot CLI、Kiro family，**不要**用 ECC 文档去改它们的 live 状态。

## 4. 建议的合同先行工件（不写运行时）

在 WP-01 文档阶段即可准备、**不创建空 crate**。本轮 **取消** 把任何文件放进 `acceptance/field-to-claim/` 的路径承诺。当前 acceptance 只允许 `field_map_relpath(family_id, surface)` = `acceptance/field-to-claim/{family_id}-{surface}.yaml` 的精确集合；额外文件会同时报 foreign map、extra map 和数量不等（`check_acceptance.py`、负例 `test_field_map_extra_foreign_file_fails`）。`ecc-overlay.yaml` 必然触发该门。**不**增加 `family_id=ecc`，**不**改 18 family / surface 精确集合，**不**改 cutoff，**不**把 ECC 升 required。

选择的设计候选（R1 写死，不是两条并行）：

1. **版本化 overlay-to-claim**：独立工件族，不占用严格 field-to-claim 目录。先放 Contexpect `docs/research/` 或 `docs/spec/` 提案域（建议名 `overlay-to-claim-ecc.md` + 版本字段 `schema_version` / `overlay_id=ecc` / `target_family` / `target_surface` / `cutoff`），声明 ECC 字段到既有 family/surface claim 的 heuristic 映射。**在 canonical、schema、generator、negative tests 先行变更之前，不得进入 `acceptance/` 正式工件。**
2. **第一阶段 corpus**：只生成自有 Apache-2.0 合成夹具，见 §8。目录名示例仍可落在 `acceptance/corpus/development/static/` 的后续 WP，但内容必须是原创最小配置 / 占位命令，不是从 ECC SHA 摘录的实质文本或脚本。`live_tested: false`，digest 进 manifest，灵感来源记 SHA/permalink，许可标 Apache-2.0。
3. compatibility-matrix **不** 新增 `family_id=ecc`。
4. 在 [source-backed coordinates](../research/2026-09-04-source-backed-coordinates.md) 的后续修订（须显式改 cutoff 合同才升 required）前，ECC 相关夹具标 `optional-fixture`。

禁止项：`acceptance/field-to-claim/ecc-overlay.yaml`；把 overlay-to-claim 先写进 acceptance 再补 schema；偷偷改 cutoff 或 required scope。

官网 `/skills` 的 91/18/48 是 **选择性安装构建器的当前目录**，与全仓 286/68/94 不同。合成 corpus 若演示“用户勾选的包”，必须用自有 id，不能把全仓 SKILL.md 计数写成 Installed。对照 permalink 见 §8。

## 5. 不采用

| ID | 不采用 | 理由 |
| --- | --- | --- |
| CV-C1 | `ecc` CLI 当 native oracle | 违反 AGENTS 第 2 条 |
| CV-C2 | 第 19 个 required family | 裁剪 F-01–F-18 的变体 |
| CV-C3 | 把 2026-09-05 官网数字写进 cutoff 矩阵 | 过期营销；且调研日在 cutoff 日历日之后需谨慎 |
| CV-C4 | 执行 ECC hooks / MCP / install | 被动扫描禁执行 |
| CV-C5 | LLM 把 instinct 写成 observed | provenance 禁 LLM |
| CV-C6 | 用 ECC 填假 live coverage | compatibility-matrix `fabricated_native_evidence: false` |
| CV-C7 | 放宽读取执行边界去“验证”ECC | 威胁模型 |

## 6. 阶段与投入

```text
WP-01  文档：overlay-to-claim 提案（research/spec 域）+ 可选自有合成 corpus（S）
WP-02  collector/doctor 规则吃合成夹具（M，不调 ECC CLI）
WP-05  可选 session 映射走 overlay-to-claim 提案，不新增 field-to-claim 文件（S，heuristic）
WP-08  catalog 展示 pin/license（S）
其余 WP  不依赖 ECC
```

当前 foundation 已通过六条离线 gate（本调研实测 144 unittest OK）。**本方案不授权 WP-02 编码。**

验收正例（未来 WP，非本档案）：corpus 含 ECC overlay 且 `live_tested: false`；family_id 集合仍等于 cutoff 的 18；任意 ECC 字段的 Model-visible present 必须另有冻结 oracle；CI 在未知 ECC 版本上 exit 3。

验收反例：`family_id=ecc` 进入 compatibility-matrix；Doctor 调用 `ecc doctor`；Receipt provenance=native-runtime 来自 session-inspect；cutoff 被改写为 2026-09-05 以收入官网 261。

测量：optional 合成 corpus 条目全部带 digest 且 `license=Apache-2.0`；`acceptance/field-to-claim/` 文件集合仍等于既有 family/surface 精确集；overlay-to-claim 提案无 LLM 行；六 facet 列在 UI 规格里保持独立；traceability 新增语句必须进入 `acceptance/traceability.csv` 再过 `--traceability`。未授权编码前，本档案的成功标准只是：reviewer 能按 SHA 打开 ECC 文件并核对上表 provenance，且看不到 `ecc-overlay.yaml` 路径承诺。

当前 foundation 实测（2026-09-05，快照仓，非产品运行时）：`check_docs.py` PASS（10 根文件 / 22 canonical）；`--structure` PASS；`--traceability` 249=249；`--corpus` 19/19 静态坐标、2 个声明 oracle、589 doctor cases；`check_semantic_team.py` 16+5；`unittest` 144 OK。这些门证明合同完整，**不证明** ECC overlay 已接入。

## 7. 与 SayDo 的边界

SayDo 借安装收据与记忆导入闸门；Contexpect 借声明面夹具与诚实探测。共同禁止：自动信任记忆、ECC 替换控制面、把安装当看见。SayDo 方案见其仓 `docs/plan/2026-09-05-ecc-borrowing-plan.md`，不在本文件排产。

## 8. 夹具制作规程（合同先行，仍不执行 ECC）

路线写死为两包，§4 与本节必须同一口径。当前 development static validator 强制 `license == Apache-2.0`；corpus 字段尚无 `allowed_redistribution`。PRD §13.6 要求第三方配置记录来源、许可、可再分发方式、脱敏和 digest。ECC `LICENSE` 是 MIT，复制实质部分必须保留版权与许可文本。**不得**用 Apache-2.0 头覆盖上游 MIT 身份。

### 8.1 第一阶段（当前建议的唯一必需包）

只制作 **自有 Apache-2.0 合成夹具**：

1. 原创最小配置与占位命令。事件名、字段名可以 *inspired by* ECC SHA `e04ea0b9cc8248686edf5ac751cadff550e162b8`，但 **不复制** `hooks.json` / hook 脚本 / manifests / schema / memory 正文等上游实质文本。
2. 每个文件：`license=Apache-2.0`、`live_tested=false`、`digest_sha256`、`sensitivity` 取现有词表；灵感来源用 permalink + SHA 记在 recipe/metadata，不把 ECC 原文当夹具正文。
3. 生成 digest 纳入后续 `acceptance/artifact-digest-manifest.json` 修订；若发生在 cutoff 后，只能标 optional，不进 required 集。
4. 禁止把 `scripts/hooks/*.js` 可执行正文当 corpus 去跑。
5. 禁止在夹具中写真实家目录。波浪号路径仅出现在合成占位字符串。

Doctor 负例同样用合成数据覆盖：symlink 逃逸、gitignore 被换成空、install-state 指向根外路径、memory duplicate id、MCP arg 带假 token。由 Contexpect 自己的规则引擎重放，不调用 ECC。

### 8.2 真实 MIT 样本（另一条件包，不进当前必需集）

若未来要收录 ECC 冻结树的真实片段：

1. **先**扩展 corpus canonical、schema、validator、NOTICE/SBOM 与负例，使第三方 MIT fixture 能携带原版权、许可、再分发与脱敏记录（对齐 PRD §13.6）。
2. 每个真实样本保留 `Copyright (c) 2026 Affaan Mustafa` 与 MIT 许可文本；元数据 `license=MIT`，**禁止**再加 Apache-2.0 头。
3. 该包保持 `optional-fixture` / `live_tested=false`，直到 cutoff 合同显式改写。未完成 1 之前不得制作。

GitHub permalink 仍只作灵感与对照，不作第一阶段复制源：

- [scripts/lib/path-safety.js](https://github.com/affaan-m/ECC/blob/e04ea0b9cc8248686edf5ac751cadff550e162b8/scripts/lib/path-safety.js)
- [hooks/codex-hooks.json](https://github.com/affaan-m/ECC/blob/e04ea0b9cc8248686edf5ac751cadff550e162b8/hooks/codex-hooks.json)
- [.codex-plugin/plugin.json](https://github.com/affaan-m/ECC/blob/e04ea0b9cc8248686edf5ac751cadff550e162b8/.codex-plugin/plugin.json)
- [hooks/hooks.json](https://github.com/affaan-m/ECC/blob/e04ea0b9cc8248686edf5ac751cadff550e162b8/hooks/hooks.json)

## 9. WP 覆盖矩阵（防止缩成 MVP）

| WP | ECC 相关动作 | 不做 |
| --- | --- | --- |
| WP-01 | overlay-to-claim 提案（research/spec）；optional 自有合成 corpus | 不改 18 family；不新增 field-to-claim 文件 |
| WP-02 | 静态扫描合成形状夹具；Doctor 规则 | 不 exec ecc；不把 Codex hooks 整类 omitted |
| WP-03 | Receipt 附件类型 | 不把 ECC JSON 当 header |
| WP-04 | Inspector 显示 overlay 泳道 | 不画单一 Active |
| WP-05 | 可选 overlay-to-claim heuristic（提案域） | 不新增 oracle；不写 `ecc-overlay.yaml` |
| WP-06 | 用 ECC 多 target 路径做 loss 样本 | ECC 不是 authority |
| WP-07 | 默认不同步 vault/db | |
| WP-08 | catalog pin MIT/SHA | 不装 npm 包 |
| WP-09 | Advisor 只解释配置 | 不写 Claim |
| WP-10 | 不用 ecc2 eval | |
| WP-11 | CI exit 3 on unknown overlay version | doctor 0 ≠ pass |
| WP-12 | 若演示 overlay，用 fixture 截图 | 设计图 4/9/5 仍是 Doctor fixture |

本档案不修改 `acceptance/` 八份工件。任何 corpus 增加都是后续 WP-01 修订，须独立评审与 digest 重建。

SayDo 工作区对本文件只是运输层。Contexpect 主树合并时，相对链接已按 `docs/research/` 书写，不必改路径。ECC permalink 已含 SHA，不依赖本临时 clone。

日志：ContextView 六门实测见调研报告 §19，文件 `contextview-gates-20260905.log`。父目录 `../logs` 本会话不可写，SHA 仍可核。

未跑 Contexpect 产品运行时：本仓没有 `crates/` 实现，六门不是 live coverage。

## 10. 独立 review 修订区

禁止自宣 GREEN。R2 已确认技术/合同问题闭合，剩余最终目录的配套报告打包缺口；本稿补齐接收集合，R3 待独立核验。

| 轮次 | 角色 | 结论 | 修订要点 |
| --- | --- | --- | --- |
| R0 | 实施（档案） | 未评审 | — |
| R1 | 独立 reviewer | **RED**（无 P0，4 个 P1） | P1-01 Codex native SessionStart 被写成 instruction-backed；P1-02 `ecc-overlay.yaml` 必触发 foreign-map；P1-03 Apache 头与 MIT 元数据冲突；P1-04 在 SayDo 方案。3 条 P2 已在父 ledger，本轮不修 |
| R1 回修 | 实施 | 未自判 GREEN | CV-03/target 按 native plugin + 逐事件 + legacy 单列重写；取消 field-to-claim 路径，改 overlay-to-claim 提案域；corpus 第一阶段仅自有 Apache-2.0 合成夹具，MIT 真实样本为条件包 |

本轮未重跑 ContextView 六门（沿用既有日志：structure/traceability/corpus/semantic-team/unittest 144 OK，89.6s）。未把 ECC 升 required，未改 cutoff。

## 最终接收集合与一次 P2 收尾

R2 明确前 4 个 P1 均已闭合，仅指出 Contexpect 同目录报告缺失。接收集合现包含 `docs/research/2026-09-05-ecc-borrowing-plan.md`、`docs/research/2026-09-05-ecc-project-research.md` 和 `docs/research/ecc-evidence-index.json`，并已追加到 Contexpect `docs/README.md`。SayDo 保留原调研档案及其专用方案。

本轮唯一最终 P2 sweep 依据 R1/R2 的同一台账作三项机械校正：规则总数明确包含 README；测试记录区分包装进程 exit 0 与子测试聚合失败；安装收据示例复用现有 `RuntimeIdentity.sourceRevision` 裸 hex 编码。历史评审段保留当时口径，当前引用以修订正文和证据索引为准。R3 的独立结论与最终门禁另记交付核验记录，本段不自判 GREEN。
