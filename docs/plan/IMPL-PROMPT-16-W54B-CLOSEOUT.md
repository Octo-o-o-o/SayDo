# SayDo W5.4-b 复审收口批（w54b-closeout）· 实施 Prompt（第十六轮交接；2026-08-25）

> ## 启用前置：本 Prompt 当前**不可执行**（2026-08-25 复核）
>
> **终态注（2026-08-27 月度审计）：本文件已转为历史存档。**五条阻断已于 08-26 复核解除
> （`prompts/205-ai-supply-activation-refresh.md` 门 2，`61ce050`）；阶段 A 已于 08-26 执行
> （evidence `e2e/evidence/w54b-batch.md` §14），阶段 C 已于 08-27 执行、批已收口
> （`728eeb6`，HANDOFF §1.1 指针置空）。下方警告与阻断清单为 2026-08-25 时点原文保留。
>
> 生成后复核全局工作状态，发现五条阻断。**在下列每一条都解除前，不要按本 Prompt 开工。**
>
> 1. **有更高优先级的在途工作线**：`prompts/203-rc4-long-session-handoff-to-new-codex.md`
>    定义的 RC4 发布线正在进行，其 §7 明确「**当前继续点是 runtime 六条失败，不是 release/deploy**」，
>    并有一个被 Ctrl+C 中断（真实 exit 130、无 `end_turn`）的 Grok session
>    `01a0342a-fc21-7c20-ab31-2793254324f3` 等待 resume。
> 2. **w54b 的代码在 RC4 线上当前是红的**：该 prompt 记录的六条 daemon 失败中，
>    第 5、6 条正是 `tier1-executor.test.ts`（w54b 的产物）。
>    **不能收口一个测试红着的批次。**
> 3. **本 Prompt 及其依赖不在 `main` 上**：`docs/plan/IMPL-PROMPT-16-W54B-CLOSEOUT.md`、
>    `docs/plan/2026-08-24-ai-supply-owner-decisions.md`、
>    `docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`
>    三份均只存在于 `codex/week-audit-faststart-20260822`。
>    §3 阶段 C 第 5 步要引用决策单，在 `main` 上无法完成。
> 4. **主 worktree 被明令禁止用于 RC4 集成**：203 prompt §5 原文——
>    「该树不是当前 RC4 集成树，**禁止清理、提交到 RC4 或顺手整理**」。
> 5. **「全仓只有一个活动批次」的治理前提当前不成立**：`git worktree list` 有 20 个条目，
>    其中 10 余个是活跃的 rc4/runtime/privacy 分支。在此状态下关闭 `w54b-wiring` pointer
>    并为新专题排产，会与 RC4 线的坐标发生冲突。
>
> **正确的启用时机**：RC4 runtime 六条失败修绿 → RC4 收口并合入 main →
> 届时重新核对 w54b 是否仍需独立收口（很可能已被 RC4 的门禁与证据吸收，
> 若如此则本 Prompt 只保留阶段 A 的记述纠正与阶段 C 的排产部分）。

> **本批不是写新功能。** W5.4-b 的 C1/C2/C3 代码已全部实现并有门禁证据；本批做的是
> **现势对账、记述纠正、独立复审收口、关批与下一批排产坐标建立**。
> 若你读完 §0 发现仍有未实现的 C 项，那是坐标漂移，**停下上浮**，不要开始写功能。
>
> 前序交接 = `docs/plan/IMPL-PROMPT-15-W54B-WIRING.md`（2026-08-21，C1/C2/C3 任务正本）。
> 方案正本 = `docs/plan/2026-08-19-w54-claude-cli-tier1.fable.md` v3.1 §6「W5.4-b · 接线」。
> 细节冲突：方案 §3（机制）与 `docs/09-data-contracts.md` canonical 为准；方案与 09 冲突以 09 为准。

## 0. 坐标核验（先做，逐条实测；任一不符 = 停，上浮 owner）

**本节存在的原因**：2026-08-25 已实测发现 `HANDOFF.md` 的现势记述过时，若不核验就按它施工，
会重复实现已完成的 C3。逐条跑，把实测值抄进你的开工小结。

1. **分支基线**。本批必须基于 `main`：
   ```bash
   git checkout main && git log --oneline -1
   ```
   预期 HEAD ≈ `8602c73 chore(evidence): 回写 rc3 独立复审结论`（或更新）。
   **不要基于 `codex/week-audit-faststart-20260822`** —— 该分支只含 AI 供给专题文档，
   且落后 main 17 个提交，而 main 改过 `packages/daemon/src/tier1/executor.ts`（319 行）、
   `packages/daemon/src/tier1/restartPolicy.ts`、`packages/daemon/src/tier1/backends/cursor.ts`。

2. **C1/C2 入库确认**：
   ```bash
   git log --oneline -1 4c4bf96 && git merge-base --is-ancestor 4c4bf96 HEAD && echo "C1/C2 已在基线"
   ```
   预期 `4c4bf96 feat(w54b): C1 配置自检 + C2 executor 接 claude backend 生产接线`。

3. **C3 实为已完成（关键核验，防重复施工）**：
   ```bash
   grep -n 'observed_model' packages/console/src/pages/TaskDetail.tsx
   grep -c 'Tier1SelfTestReport' packages/console/src/pages/GlobalSettings.tsx
   ```
   预期：`packages/console/src/pages/TaskDetail.tsx` 约 225 行渲染 `adapter`、
   约 241 行渲染 `observed_model ?? "未观测"`；`packages/console/src/pages/GlobalSettings.tsx` 含 `Tier1SelfTestReport`（≥3 处）、`tier1Check`、`tier1StatusText`、`pinnedVersion`。
   **若这些不存在**，说明基线选错或代码被回退 —— 停，上浮。

4. **门禁基线**（记录实测数字，作为本批 diff 基准）：
   ```bash
   just ci
   ```
   2026-08-23 记录值：exit 0；contracts 111、platform 12、console 278、
   CLI 20 passed/1 skipped、daemon 1871 passed/5 skipped、pipeline 34 passed。
   **退出码显式核查，禁止管道取尾**（`just ci; echo "exit=$?"`，或落文件后判）。
   数字有出入不算红（main 有后续提交），但必须记录实测值。

5. **Playwright 基线**：
   ```bash
   pnpm exec playwright test
   ```
   2026-08-23 记录值：exit 0，36 passed。

6. **现势记述冲突已确认存在**（这是本批第一项要修的东西，核验它仍然成立）：
   ```bash
   grep -n 'C3(console' HANDOFF.md | head -2
   grep -n 'C3 console 与话术' e2e/evidence/w54b-batch.md | head -2
   ```
   预期：`HANDOFF.md` §1 指针行仍写「C3(...)未做」「本批未收口」；
   而 `e2e/evidence/w54b-batch.md` §10（2026-08-23 收口候选补证）已把四条 C3 验收锚标 `[ok]`。
   `docs/plan/IMPLEMENTATION-PLAN-2.md` 第 62 行的记述是**准确**的一份，可作为回写参照。

## 1. 必读文档（按此顺序）

1. `HANDOFF.md` §0（两条硬教训）+ §1（当前批次指针与三层时钟快照）+ §4（铁律速查）。
   —— 读 §1 时注意：它的 C3 记述已过时，本批要修的正是它。
2. `e2e/evidence/w54b-batch.md` **全文**，重点 §10（收口候选补证）、§11（首轮复审红灯）、
   §12（冻结复审回修与最终本地门禁）。这是本批现势的最权威一手记录。
3. `docs/plan/IMPLEMENTATION-PLAN-2.md` 第 10 行（当前覆盖行）、第 55 行（W5 批状态）、
   第 62 行（5.4 行）—— 回写目标。
4. `docs/plan/IMPL-PROMPT-15-W54B-WIRING.md` §2（红线）、§3（C1/C2/C3 验收锚正本）、
   §3.5（owner 决策附注位，四条要逐条确认处置）、§5（诚实汇报纪律）。
5. `docs/review/2026-08-23-week-audit-faststart-release.md` §7（已验证结果与诚实边界）
   —— 明确哪些是「尚不能写成已通过」的项，回写时不得越界。

## 2. 红线（违反任一即停，上浮）

1. **不写新功能**。本批只做对账、记述纠正、复审收口、排产。若认为某处实现有缺陷，
   记录为 finding 上浮，**不要顺手改**——改了就变成新的未评审代码。
2. **不得自评自过**。批末 code-review 必须由**独立零上下文会话**执行（CLAUDE.md 实施/评估双线分离）。
   你不能自己 review 自己，也不能派继承你上下文的子会话来 review。
3. **不得把「已实现」写成「已收口」**。`e2e/evidence/w54b-batch.md` §10 原文即
   「只形成关批候选；双向审计与独立复审绿前不宣称 W5.4-b 已收口」——沿用该口径。
4. **不得把 W5.4-c 的内容写成已完成**。真 Claude PreToolUse/PostToolUse hook 全链、
   live conformance、四场真人验收，均归 W5.4-c，本批不承接、不宣称。
5. **不动 active pointer 直到 §3 阶段 C 的前置全绿**。关 pointer 是不可逆的治理动作。
6. **禁止 `git add -A`**。用明确 pathspec，只暂存本批直接相关文件。
7. 不部署常驻、不碰 BYOA 四槽、不动 Hopper 路径、不改 live `~/.saydo/config.toml`。

## 3. 分阶段任务

### 阶段 A · 现势对账与记述纠正（本会话可独立完成）

**做什么**：把三处现势记述统一到实测事实。

**改哪些文件**：
- `HANDOFF.md` §1 批次指针行：把「C3(...)未做」「本批未收口」更正为
  「C1/C2/C3 代码均已实现（证据 `e2e/evidence/w54b-batch.md` §10/§12），
  批次状态 = **收口候选**，待独立复审绿灯后关批」。**保留** 2026-08-22 快照作为历史事实，
  按该文件既有的「supersede 但不改写历史快照」写法处理。
- `e2e/evidence/w54b-batch.md`：在 §12 之后追加一节，记录本批的对账结论与门禁实测值
  （§0 第 4、5 项的数字），并显式声明「§1/§2/§6 的『C3 未做』是 2026-08-22 阶段快照，
  已由 §10 supersede」。

**验收标准**：
- [ ] `HANDOFF.md` §1 不再出现「C3 未做」的现时态断言；历史快照段落原文保留。
- [ ] 新追加节含 §0 第 4、5 项的**实测**数字（不是抄 2026-08-23 的旧值）。
- [ ] `grep -n 'C3(console' HANDOFF.md` 的命中要么消失，要么位于明确标注为历史快照的段落内。

**门禁**：
```bash
bash scripts/check-emoji.sh HANDOFF.md e2e/evidence/w54b-batch.md
node scripts/check-doc-links.mjs
git diff --check
```

### 阶段 B · 请求独立复审（本会话不执行 review，只准备与上浮）

**做什么**：为独立评审会话准备输入，然后**停下等 owner 派发**。

**产出**：一份 review 请求说明（写进你的阶段小结，不必单独建文件），含：
- 复审范围 = `4c4bf96..HEAD` 中属于 W5.4-b 的改动；
- 必须回答的问题：C1/C2/C3 是否逐条满足 `IMPL-PROMPT-15` §3 的验收锚；
  `IMPL-PROMPT-15` §2 的七条红线有无违反；`e2e/evidence/w54b-batch.md` §9 自述的
  五条自犯错误是否都已真实修复（不是只写在台账里）；
- 复审必须是**零上下文独立会话**，按 CLAUDE.md 职能分工，对抗 review 链头 =
  Codex `gpt-5.6-sol` + effort `max`。

**验收标准**：
- [ ] 阶段小结里给出上述 review 请求说明。
- [ ] **停在这里**，等 owner 确认复审已派发并取得结论。不得自行宣布复审通过。

### 阶段 C · 关批与下一批排产（**仅在阶段 B 复审绿灯后执行**）

**前置断言**（任一不成立即停）：
- 独立复审结论为 A 级 0（或 A 级已全部回修并经复审确认）；
- `just ci` exit 0；`pnpm exec playwright test` exit 0；
- `IMPL-PROMPT-15` §3.5 的四条 owner 决策附注位均有处置记录。

**做什么**：
1. 回填 `HANDOFF.md` §2-6 与 §1 指针行（批次状态改为已收口，记录收口 SHA）。
2. 回填 `docs/plan/IMPLEMENTATION-PLAN-2.md` 第 55 行与第 62 行（5.4-b 标已收口，
   W5 剩余更新为「5.4-c 真 Claude hook 冒烟、live conformance 与 canonical 收口」）。
3. `history/PROCESS-JOURNAL.md` 追加一行索引；`history/DEV-VERSION-LEDGER.md` §2 时代 VII 追加一行。
4. **关闭 active pointer**（`HANDOFF.md` §1 批次指针置空）。
5. **为 AI 供给专题建立排产坐标**（owner 决策 1 的直接要求）：
   在 PLAN-2 中为 `docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`
   插入具名子批与依赖，并记录基线 HEAD 与该方案文件的 SHA-256。
   该专题的四项已签决策见 `docs/plan/2026-08-24-ai-supply-owner-decisions.md`，
   其中**决策 7 已把首发范围收缩为「只开放内置受信 connector」**，排产时按收缩后的范围切批。

**验收标准**：
- [ ] `HANDOFF.md` §1 批次指针为空，且收口 SHA 来自真实 `git log` 输出。
- [ ] PLAN-2 第 55/62 行状态与实况一致，AI 供给专题有具名坐标与基线 digest。
- [ ] `node scripts/check-doc-links.mjs` broken=0；emoji gate clean。

## 4. 节奏与检查点

- **自治推进阶段 A**，完成后贴阶段小结（改动文件清单 + 门禁退出码），继续准备阶段 B。
- **阶段 B 末必须停**：等 owner 派发独立复审并回传结论。无回复 = 暂停本批，不要自行推进到阶段 C。
- **阶段 C 每一步都是治理动作**，逐步汇报；关 pointer 前再确认一次前置断言。
- 撞 canonical 缺口（发现 09 形状不够用）= 停该项、上浮，禁止实现侧自定语义。
- 发现 C1/C2/C3 有实现缺陷 = 记录 finding 上浮，**不在本批修**（本批是收口批，不是修复批）。

## 5. 诚实汇报要求

- 三级词表：**已实现且测试绿 / 已实现未验 / 未做**。对账用 `[ok]` 完成 / `[warn]` 部分 / `[fail]` 未做 / `[divergent]` 偏离。
- 每个「完成」必须给证据：commit hash 来自**本会话真实 `git log` 输出**，
  测试结论附命令 + 原始输出摘录（退出码显式核查，不用 `cmd | tail` 取码）。
- **没做的明说「没做」**。不得把「已写进文档」当成「已验证」。
- 若你发现本 prompt 的某条断言与实测不符（例如 §0 的预期值），
  **如实报告不符，不要默默适配**——那正是坐标漂移，是本批要防的头号风险。
- 收尾留证：本批产物与门禁输出记入 `e2e/evidence/w54b-batch.md`，供后续 `/impl-review` 对账。

## 6. 工作方式约定

- **分支**：从 `main` 起 `w54b-closeout`；不要在 `codex/week-audit-faststart-20260822` 上做。
- **提交**：只有 owner 明确要求时才 commit。提交信息用简体中文，说明「做了什么 + 为什么」。
  用明确 pathspec，提交前 `git status` / `git diff --cached` 核对暂存集。
- **两提交法**（若 owner 授权）：`docs(w54b)` 记述纠正 → `chore(evidence)` 证据回填；
  evidence 记代码 SHA，不自指。
- **遇阻**：按 §4 的检查点停下上浮，不要用「应该差不多」继续。
- 本批**不需要** worktree 或独立 clone（改动以文档为主，无并发施工冲突）。

---

## 附：本批与 AI 供给专题的关系

owner 已于 2026-08-25 签署 §14 十项决策中的四项，其中**决策 1 裁决「先收口 `w54b-wiring` C3，
再排 AI 供给专题」**。本批的阶段 C 第 5 步即为该决策的落地动作。

AI 供给专题的当前状态：设计已拆成三份可验证产物（主方案 2,484 行 / 合同草案 45,696 行 TypeScript /
评审循环归档），但 **v20 的 11 条 A 级 finding 一条未修**，不可据此施工。
其正式实施需另出 IMPL-PROMPT，前置 = 本批关批 + PLAN-2 具名坐标 + 剩余六项决策处置。
