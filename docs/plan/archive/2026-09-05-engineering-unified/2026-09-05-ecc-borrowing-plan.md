<!-- ecc-final:superseded -->
> 历史归档：本文件已由[最终统一稿](2026-09-05-ecc-borrowing-final.md)替代。下方正文、旧 SoT 声明和评审状态保留用于追溯，不再作为当前实施入口。

> **状态:已被 `2026-09-05-ecc-borrowing-consolidated.fable.md` supersede(2026-09-05)。** 本文保留为 GPT 线候选方案与评审历史;逐条仲裁见终稿 §2–§3。

<!-- ecc:review-status:begin -->
> 本轮文档已根据独立评审修订，R3 为 GREEN，9/9 最终文档门禁通过。以下保留冻结候选的写作与评审历史；当前结论见[评审与交付核验记录](../../research/codex-findings/2026-09-05-ecc-research-review.md)。候选建议仍须 owner 选定后导入现有排产，产品代码未实施。
<!-- ecc:review-status:end -->

# SayDo 对 ECC 的借鉴方案（候选建议）

> **性质：候选建议，不是排产，不是合同变更，不是 GREEN。** R1 独立评审 RED（4 个 P1）；本文件为实施线按源码回修稿，R2 已确认前 4 个 P1 闭合；本次为接收集合与最终 P2 校正稿，R3 待独立核验。
> 不得导入 `IMPLEMENTATION-PLAN-2.md` 的 active/next，不得改 `docs/09–11`，不得改产品代码。
> 对照调研：`research/ecc/2026-09-05-ecc-project-research.md`（ECC SHA `e04ea0b9cc8248686edf5ac751cadff550e162b8`，npm 发布坐标 `ecc-universal@2.2.0`）。
> 当前排产：`IMPLEMENTATION-PLAN-2.md` 唯一串行链 `PROC-01 → PG-01B → PG-02 → … → owner-stop`；`next=PG-01B`。本方案若被选中，只能作为 **未来批次候选** 经 D17/PLAN-2 导入后施工。
> 既有借鉴：Hopper 仍是执行底盘设计参照（现时态设计 ADR-005：生产路线 = Tier1，Hopper `designed/deferred`）；DeepSeek Harness 评估已否决替换 daemon。本方案不推翻这两份。

## 0. 一句话

**借 ECC 的“可检查安装面 + 常驻上下文与持久证据分离 + adapter 诚实表”，不借它的自动记忆、默认 hooks、降档模型和巨型 skill 市场；更不把 ECC 当成第二套 daemon 或执行控制。**

## 1. ECC CLI 面到 SayDo 面的对照（先于建议条目）

ECC `scripts/ecc.js` 主命令与 SayDo 现状。状态：已有 = 不重复建设；补强 = 本方案条目；C = 不采用。

| ECC 命令 | ECC 做什么 | SayDo 现状 | 裁决 |
| --- | --- | --- | --- |
| setup / install / plan / catalog | 按 profile 投影 skills/hooks 到宿主目录 | 无“往 Claude 全局装包”产品目标；有官网 install.sh 装 daemon+console | 借收据思想（S-01），不借投影器 |
| consult | 自然语言推荐组件 | 无 | C；Brain 不是安装向导 |
| doctor / repair / list-installed / uninstall | 对照 install-state | 分发面缺 doctor（G-B12） | A/S-01 |
| auto-update | pull 最新再按原 request 重装 | 锁版本 rc/runtime SHA | C；与发布铁律冲突 |
| memory | unreviewed markdown vault | 账本 + knowledge 投影 + candidate 闸 | B/S-03 只导入 |
| control-pane / sessions / work-items / status | sql.js 操作面，默认 Claude 家目录 | console + daemon SQLite | C 替换；B 仅 Host 门对照 |
| session-inspect | ecc.session.v1 | transcript JSONL + Hopper events | C 作为执行真相；B 只读对照 |
| loop-status | 扫 Claude transcript 看 stale tool | 无同等 | C 默认；不读私人 transcript |
| ito / nasiko | 赞助/实验桥 | 无 | C |
| security-ioc-scan | 扫依赖与 AI 工具持久化面 | 有隐私探针/公开树门 | C 直接跑 --home；思想可进安全专题 |
| platform-audit | 扫 GitHub 队列 | 无 | C |
| welcome / feedback | 社区与表单 | 无 | C |

hooks 运行时（非 CLI）：ECC 默认 enabled。SayDo Tier1 hook 是 **审批门**，缺省必须 fail-closed，与 ECC observe/learning 钩子相反。

## 2. 对照坐标（已具备 / 补强 / 不采用）

SayDo 已具备且不得被 ECC 替换：

| 面 | 现状 | 证据 |
| --- | --- | --- |
| 对话域 durable 状态 | voiced daemon 唯一持有 | `docs/03`、`packages/daemon` |
| 记忆写路径 | `raw → candidate → trusted`；M0 只 `user_stated`/`user_approved` | `docs/09` Trust 词表；`docs/modules/b-memory.md` |
| 执行控制 | Gate 0 无 bypass；S3 语音不放行；verify 只认登记模板 | `docs/05` Gate 0；AGENTS.md 硬规则 |
| 执行路线 | 生产 = Tier1；Hopper 桥 dormant | 设计 ADR-005 |
| 审计 | 日志可轮转，审计不可变；敏感只记 digest | `docs/modules/e-crosscutting.md` E3 |
| 分发 | `install.sh` / `install.ps1` 钉 rc.12；包是 daemon+console Developer Preview | `packages/cli/README.md`；缺口 G-B12 |
| 排产 | 唯一 PLAN-2 指针 | `HANDOFF.md` schedule-pointer |

ECC 有而 SayDo 仅部分有、值得 **补强** 的：安装 ownership 收据、doctor/repair/uninstall dry-run、跨宿主能力诚实表、可检查的记忆文档格式（作为 **投影/导出**，不是账本）、MCP/配置脱敏 inventory（只读观测）、loopback Host 门的对照测试、worktree **分类观测**（不替代任务 worktree）。

ECC 有而 **不采用** 的：instinct 置信度注入、continuous-learning 自动 prune、默认 hooks 进全局配置、token-optimization 降档、ito/nasiko 赞助桥、286 skills 整包、ecc2 替换 console、把 `context_remaining_pct` 当 Context Pack 真相、无界 `orch-*`。

## 3. 建议条目

每条：来源 → 落点 → 最小改造 → 依赖 → 风险 → 正反例 → 指标 → 回退 → 顺序。裁决 A=值得立项候选，B=改造后可立项，C=不采用。

### S-01 安装所有权收据 + doctor / dry-run 卸载（A）

- **来源**：ECC `ecc.install.v1` operations.ownership、`doctor.js`、`uninstall.js --dry-run`、`path-safety.js`。调研 §7。
- **落点**：未来分发批（对口缺口 G-B12：service/doctor/upgrade/uninstall）。**不是 PG-01B。** 文档候选可先写在 `docs/plan/` 分发专题，合同若改 `docs/09` 安装/备份节须另走评审。
- **最小改造**：为 `~/.saydo/runtime` 与官网安装脚本记录 **managed 文件清单**（path + sha256 + source revision），`saydo doctor` 只对比该清单；卸载只删 managed；用户改过的文件标 drift 不覆盖。
- **依赖**：现有 `install.sh` SHA 校验；不引入 ECC 安装器闭包。
- **风险**：误把用户 config.toml / 知识库标成 managed。缓解：默认只管 runtime 树，不管 `~/.saydo/config.toml` 与 knowledge。
- **正例**：安装后 doctor 列出 managed=ok；改一个 bundled 文件 → drift；`--dry-run` 卸载打印清单且磁盘不变。
- **反例**：无收据时 doctor 宣称“健康总分 100”；doctor 扫描私人 sessions 正文。
- **指标**：doctor 对无 drift 安装 <2s；误删用户文件 = 0。
- **回退**：删除 doctor 子命令，保留现有安装脚本。
- **顺序**：PG 链之后的分发批；owner 选 G-B12 产品级 installer 时才做。

### S-02 安装前 hook/能力披露，默认关闭自动执行（A）

- **来源**：ECC `hook-consent.js` 六组披露；反面教材：plugin.json `hooks_enabled` default true。
- **落点**：Tier1 `claude_code`/`cursor` hook 安装说明与 console 设置页；`docs/10` 仅当话术需要时另批回写。
- **最小改造**：把“将安装哪些 hook、会改命令/探 MCP/写观测文件吗”做成安装确认项；**缺省 declined**。已有 Cursor/Claude PreToolUse 审批门保持 fail-closed。
- **依赖**：现有 gate 脚本；不把 ECC `hooks/hooks.json` 拷进 `~/.claude`。
- **风险**：用户把 ECC 标准/strict profile 叠到 SayDo worktree，造成双重 hook。缓解：文档写“不要对同一 harness 叠 ECC full + SayDo Tier1”。
- **正例**：未确认 hooks 时工作区无 ECC PreToolUse。
- **反例**：静默把 `observe-runner` 装进用户全局 Claude。
- **指标**：新安装 hookConsent 显式落盘；默认 ≠ enabled。
- **回退**：只保留人工复制 hook 文档。
- **顺序**：可与 S-01 同批，或更小的文档+设置项。

### S-03 记忆：借可检查 markdown 投影，不借自动升格（B）

- **来源**：ECC `ecc.memory.v1` 仅 `trust=unreviewed`、create-only、secret 拒绝、project gitignore fail-closed。调研 §10。正式写路径以本仓为准，不发明第二套 Trust。
- **落点**：可选导出/导入适配器，经 `MemoryLedger.add`；**真相源仍是 `memory_events`**。禁止 DAO / `insertMemoryEvent` 旁路。
- **最小改造（写死，与 `third_party` 不可互换）**：`ecc.memory.v1` → 只导入。调用必须 `source.kind="import"`，**不传** `requestedTrust`（`classifyTrust` 先看自报的 `user_stated`/`user_approved`，适配器一旦自报就会绕过第三方降级）。分类器对 `import` 确定性返回 `trust=candidate`（`classify.ts`：`THIRD_PARTY_KINDS` 含 import；M0 则抛 `m0_rejects_untrusted`）。Ledger 合并适配器 taint（建议 `ecc_memory_unreviewed`）。**不**把结果写成 `third_party`：compiler 对 `third_party` 是默认 **全排除**（`compiler.ts` 直接 `excluded`），对 `candidate` 是非 M0 **只读标注包含**（`renderPackText` 前缀 `[候选未确认]`）。要默认全隔离必须先改 09 合同与分类器，不能走 DAO 把 import 标成 `third_party`。导入事件 **不**带 `readinessKey`，不进入 `confirmReadiness` 覆盖集（covered 的 candidate 绑定 ≠ 本导入）。人确认走现有 `approveCandidate`：`user_approved` 新事件 `supersedes` 候选。导出时把 trusted M1 写成 unreviewed 文档并剥离 secret。
- **依赖**：现有 `classifyTrust` / Ledger / compiler / `approveCandidate`。不得把 ECC MCP `ecc-memory-mcp` 接到 Brain 工具环。
- **风险**：team scope 被 git commit 后被当成治理规则；调用方自报 trust。缓解：适配器零 `requestedTrust`、必带 taint、只走 `ledger.add`。
- **正例**：
  1. 导入一篇 ECC handoff，`source.kind=import`、无 `requestedTrust`、带 taint → 账本 `trust=candidate` + taint；tier 为 M1/M2/M3。
  2. 非 M0 编译：该条进入 pack，渲染含 `[候选未确认]` 与 `[taint:...]`。
  3. 同一条不出现在 M0 切片；`excluded` 可含 `m0_gate_trust` / `m0_gate_taint` 若有人误放 M0 输入（适配器本身应拒绝 M0）。
  4. 导入后 `readinessKey` 为空；`assessReadiness` covered 不因该条变成 candidate/confirmed。
  5. owner 走 `approveCandidate` → 新事件 `trust=user_approved` 且 `supersedes` 原 id；拒绝走 `forget_soft`。
- **反例**：
  1. SessionStart 按 0.7 confidence 自动 remember。
  2. 适配器或测试传 `requestedTrust=user_approved` / `third_party`。
  3. 直接 DAO 插入 `trust=third_party` 或 trusted。
  4. 给导入事件绑 `readinessKey` 或走 `confirmReadiness` 当升格。
  5. 把“0 条 M0”当成已证明全隔离（那是 M0 门，不是 `third_party` 排除）。
- **指标**：导入夹具 0 条 M0、0 条 `third_party`、100% `candidate`+taint、0 条 readinessKey；secret 形态拒写；`approveCandidate` 前后 pack 标注变化可测。
- **回退**：删除适配器，账本不变。
- **顺序**：不早于记忆域空闲窗口；与 AI 供给第三方 pack **无关且更后**（AI 供给决策 7 已推迟第三方 connector）。

### S-04 adapter / 能力诚实表（A）

- **来源**：ECC `harness-capabilities.js`：guided vs advanced；hooks `eccConfigured` 布尔 + note。测试“不把未登记 Copilot/Kiro/Pi 写成安装 harness”。
- **落点**：PG-02 计划中的 capability/support ledger（`check-capability-ledger.mjs` 等，**尚未作为本方案施工**）。若 PG-02 已覆盖“未登记不可宣称”，本条标 **已具备可增强**，只补 ECC 对照行。
- **最小改造**：给每个 BYOA/Tier1 adapter 增加 `hooks.mode`、`egress`、`guidedReady` 同类字段；UI/话术禁止把 advanced 说成与 cursor 同深。
- **依赖**：设计 ADR-005 生产后端仍是 cursor/claude_code。
- **风险**：把 ECC 15 个 install target 抄进 SayDo 矩阵。缓解：SayDo 矩阵只含合同已有 adapter。
- **正例**：kimi 若未接线，support=unsupported，不出现安装向导。
- **反例**：README 写“支持 14 个 harness”但代码只有两个后端。
- **指标**：公开 claim 与 ledger 行一致（接 PG-01A/PG-02 门）。
- **回退**：删除对照行。
- **顺序**：跟随 PG-02，不另开排产链。

### S-05 配置/MCP 脱敏 inventory，只读（B）

- **来源**：ECC `ecc.mcp.v1` redact args/URL、只留 env 键名。
- **落点**：daemon 诊断或 doctor 的 **只读** 报告；不启动 MCP。
- **最小改造**：若扫描 `.mcp.json` / 宿主 config，输出 signature + hasSecrets + 键名。Brain 工具面继续 `--strict-mcp-config` 关闭宿主 MCP。
- **依赖**：DSH 评估 C-21（不开放 MCP 宿主）仍有效。
- **风险**：inventory 变成“帮用户一键打开 MCP”。缓解：无 apply 按钮。
- **正例**：含 `sk-` 的 arg 在报告里是 `***`。
- **反例**：把 MCP server 加进 Context Pack 工具表。
- **指标**：夹具含假 secret 时报告无原文。
- **回退**：删除扫描。
- **顺序**：S-01 doctor 之后可选。

### S-06 上下文预算观测诚实性（B）

- **来源**：ECC 转播 `context_window.remaining_percentage`；反面：token-optimization 降档；metrics fail-open。
- **落点**：console 成本/会话页；口播只说已知字段。
- **最小改造**：若宿主暴露 remaining%，标 `host-reported`；否则 `unknown`。不估算 4 字符/token 当账。不因此改 dialog 模型。
- **依赖**：现有 `cost_entries` 三态。
- **风险**：把 host-reported 写成 packDigest 输入。缓解：不进 Context Pack 签名域。
- **正例**：无字段时口播“还没有上下文余量数字”。
- **反例**：用 25% 告警自动 `/compact` 或换 haiku。
- **指标**：零自动降档；未知不显示为 0%。
- **回退**：不展示该字段。
- **顺序**：低优先级；可进 P2 ledger 而非本阶段。

### S-07 worktree 生命周期观测（C 对执行，B 对排障）

- **来源**：ECC `ecc.worktree-lifecycle.v1` 分类与安全 GC 计划。
- **落点**：排障脚本可选；**不**替代 Tier1 worktree 供给。
- **最小改造**：只读 `git worktree list` 分类。禁止自动删 dirty/unmerged。
- **依赖**：Hopper/Tier1 已有隔离 worktree。
- **风险**：GC 删掉进行中任务树。
- **正例**：报告 `dirty` 树不可 GC。
- **反例**：daemon 启动自动 prune。
- **指标**：GC 计划与“仅 merged”规则单测。
- **回退**：不用。
- **顺序**：非关键；默认 C，仅 owner 要排障面板时 B。

## 4. 明确不采用（C）及理由

| ID | 对象 | 理由 |
| --- | --- | --- |
| S-C1 | 替换 voiced daemon / console | 所有权矩阵禁止第二套对话真相源 |
| S-C2 | 用 ECC orch/ecc2 替换 Tier1 | ADR-005；Gate 0/S3 不在 ECC 里 |
| S-C3 | instinct 置信度注入、自动 prune | 违反 candidate→trusted 与 M0 |
| S-C4 | 默认 hooks 进 `~/.claude` | 侵入全局；fail-open 与审批门冲突 |
| S-C5 | 286 skills / 68 agents 整包 | 与 Brain 固定人格/状态词冲突；维护爆炸 |
| S-C6 | 模型降档当优化 | 角色/档位纪律；成本页已有三态 |
| S-C7 | `ecc ito` / Nasiko / 赞助默认 MCP | 供应商耦合；可发真实 RFQ |
| S-C8 | `ecc-memory-mcp` 作为 Brain 工具 | 可写记忆面绕过四闸 |
| S-C9 | 跟随 ECC HEAD 做 submodule | 147 commit/未发布 2.2.1；应钉 SHA 夹具 |
| S-C10 | 第二套排产源 | PLAN-2 唯一 |

## 5. 红线检查清单（施工若发生）

1. Gate 0 未关不得 dispatch；代码无 bypass。
2. S3 不经语音放行。
3. M0 拒第三方与 candidate；ECC 导入固定 `source.kind=import` → `trust=candidate` + taint，不自报 trust、不 DAO 旁路。`third_party` 默认全排除是另一语义，本条不使用。
4. 审计不可变；ECC doctor 报告可轮转。
5. 独立评审：实施与评估零上下文；本文件不得自审。
6. 不改 PLAN-2 指针除非 owner 按 D17 导入。

## 6. 投入量级与依赖图

```text
S-C*（不采用） ────────────────────────── 无工
S-04 诚实表 ──跟随── PG-02 ledger
S-01 收据+doctor ──依赖── G-B12 owner 选择产品 installer
S-02 hook 披露 ──可并行 S-01，默认关闭
S-05 脱敏 inventory ──依赖 S-01 诊断面
S-03 记忆导入 ──依赖记忆空闲窗口；在 AI 供给第三方 pack 之后
S-06 余量字段 ──P2
S-07 worktree 观测 ──默认不做
```

量级（粗）：S-01 M（分发批）；S-02 S；S-04 S（若 PG-02 已有 ledger 则只补行）；S-03 M；S-05 S；其余不做。 **总投入不进入当前 PG-01B。**

建议工时只作量级，不是承诺：S-01 约数日（含夹具与误删防护）；S-02 约一日；S-04 若 ledger 已存在则数小时；S-03 需记忆闸回归，约数日；S-05 约一日。合计若全选仍应低于一个标准 PG 批，且必须排在 PG-01B 之后由 owner 插入，不得插队。

许可：从 ECC 复制任何文件须保留 MIT 版权行并在 NOTICE 记 SHA。默认只写自己的类型，不 vendor `scripts/ecc.js`。

## 7. 验收（若未来导入 PLAN-2）

正例：候选批次文档声明 SHA `e04ea0b`；无 ECC 文件进入 `~/.claude`；doctor 只读 managed；记忆导入 0 M0、全部 `candidate`+taint、无 readinessKey；人确认后才出现 `user_approved` supersede。

反例：出现 `ecc2` 替换 daemon；出现 confidence 自动 remember；出现第二套 schedule-pointer。

测量：focused gate 沿用该未来批的 FG；本文件自身 focused = emoji + diff-check + 证据行号。

## 8. 与 ContextView 的边界

SayDo 不负责 Contexpect 的 F-01–F-18。共同建议只有：**钉 SHA 当夹具、能力宣称分 guided/advanced、配置脱敏、不把安装当 observed**。详见 `research/ecc/2026-09-05-contextview-ecc-borrowing-plan.md`。

## 9. 与现有缺口/专题的关系（避免重复建设）

| 已有条目 | 关系 |
| --- | --- |
| G-B12 一键包不含 doctor/upgrade/uninstall | S-01 是其工程形状候选，不提前关闭缺口 |
| PG-01B runtime-entry-stoploss | 本方案不改 net/WS；不把 ECC control-pane 绑进 47100 |
| PG-02 capability ledger | S-04 只能跟随，不能另造 ledger |
| AI 供给普适接入 | 决策 7 推迟第三方 pack；S-03 记忆导入不是 connector SDK |
| DeepSeek Harness 评估 | 不替换 daemon 的结论继续有效 |
| Tailcat 评估 | 无关组网 |
| 流程收敛 PROC-01 | 已收口；本文件不得改 schedule-pointer |

## 10. 建议的最小合同草案（仍非 09 变更）

若 owner 将来导入，建议 09 只增加 **可选** 诊断类型，不改任务状态机：

```text
InstallReceipt = {
  schemaVersion: "saydo.install.v1",
  sourceRevision: RuntimeIdentity["sourceRevision"],
  managed: [{ relPath, sha256, origin: "runtime-bundle" }],
  hookConsent: "enabled" | "declined" | "not-applicable"
}
DoctorIssue = { code, severity: "error"|"warning", pathDigest, message }
```

禁止把 ECC `ecc.install.v1` 原样下沉为生产合同（字段含 cursor 路径与 ECC moduleId）。允许 **思想同源、类型重写**。

记忆导入只使用已有 `SourceRef.kind="import"`。适配器经 `ledger.add`，不传 `requestedTrust`，taint 含 `ecc_memory_unreviewed`。分类器产出 `trust=candidate`（不是 `third_party`）。不新增 Trust 枚举值。升格只走现有 `approveCandidate` / 人确认环，不绑 readiness。

`RuntimeIdentity` 复用 `@saydo/contracts` 已有类型；`sourceRevision` 保持现有 7–64 位小写裸 hex 编码，不能填写带 `sha256:` 前缀的 `Digest`。本例仍为待 canonical 定义的提案，不构成新生产 schema。

## 11. 反模式剧本（给未来 reviewer 当夹具）

1. 实施者为“对齐 ECC”在 `packages/daemon` 增加 `instinctConfidence` 并在 SessionStart 等价处注入 M0。
2. `just daemon deploy` 顺手把 ECC `hooks/hooks.json` 拷到用户 Claude 全局。
3. console 用 ECC star 数或 286 skills 做营销模块。
4. 用 `ecc2` 的 SQLite 替代 `audit_log`。
5. doctor 在无收据时返回 ok 并在话术说“环境完成”。
6. 把本文件当作 PLAN-2 next。

以上任一条即本方案失败。

测量（未来批，非本文件门禁）：doctor 误删=0；hookConsent 默认 declined；ECC 导入记忆 M0=0 且 trust 全为 candidate+taint、无 third_party、无 readinessKey；公开 claim 与 adapter ledger 一致；`git grep` 产品树无 `instinctConfidence`；无第二套 schedule-pointer。

## 12. 独立 review 修订区

禁止自宣 GREEN。R2 已确认技术/合同问题闭合，剩余最终目录的配套报告打包缺口；本稿补齐接收集合，R3 待独立核验。

| 轮次 | 角色 | 结论 | 修订要点 |
| --- | --- | --- | --- |
| R0 | 实施 | 未评审 | — |
| R1 | 独立 reviewer | **RED**（无 P0，4 个 P1） | P1-04：S-03 把 `candidate` 与 `third_party` 写成可互换，验收只查零 M0。另 3 个 P1 在调研/Contexpect 方案。3 条 P2 已在父 ledger，本轮不修（含本节 `sourceRevision: Digest` 编码） |
| R1 回修 | 实施 | 未自判 GREEN | S-03 固定 `import` → `candidate`+taint；补非 M0 只读包含、M0 排除、readiness 不绑定、`approveCandidate` 正反例；明确 `third_party` 全排除是不同语义 |

## 最终接收集合与一次 P2 收尾

R2 明确前 4 个 P1 均已闭合，仅指出 Contexpect 同目录报告缺失。接收集合现包含 `docs/research/2026-09-05-ecc-borrowing-plan.md`、`docs/research/2026-09-05-ecc-project-research.md` 和 `docs/research/ecc-evidence-index.json`，并已追加到 Contexpect `docs/README.md`。SayDo 保留原调研档案及其专用方案。

本轮唯一最终 P2 sweep 依据 R1/R2 的同一台账作三项机械校正：规则总数明确包含 README；测试记录区分包装进程 exit 0 与子测试聚合失败；安装收据示例复用现有 `RuntimeIdentity.sourceRevision` 裸 hex 编码。历史评审段保留当时口径，当前引用以修订正文和证据索引为准。R3 的独立结论与最终门禁另记交付核验记录，本段不自判 GREEN。
