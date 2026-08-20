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
- `demo/saydo-console-demo.html` 与 `docs/08-module-design.md` §6 信息架构保持同步;
  Demo 中超出 P0 的元素必须标注分期，Demo 不得夹带文档没有的功能。
- 修改 Demo/SVG 等可渲染资产后，用本机 headless Chrome 截图验证。

## 评审制度

每轮重要沟通产出(新设计文档、结构性修改、关键决策、Demo 变更)完成后，收口前必须完成:

1. 两个互补角度的 subagent 独立评审;
2. 一次 `codex exec -m gpt-5.6-sol -c model_reasoning_effort=max` 对抗性评审，报告落
   `research/codex-findings/NN-*.md`，prompt 落 `prompts/`，本地日志落 `logs/`;
3. triage 评审发现(A 级必修，B/C 择要吸收)，回修后把“输入/行动/产出/结论”写入
   `history/PROCESS-JOURNAL.md`，轮次编号顺延。

实施期使用轻量版:

- 纯代码:每个 Phase 末 1 个 code-review subagent，A 级(安全/契约/数据丢失)必修;
- 回写 canonical:1 个一致性 subagent + 攒批 1 次 Codex;
- spike ADR:Codex 一次或 owner 直批;
- journal/证据:免评审;
- 战略/范围:上浮 owner。

评审产物落盘后、收口前必须过 `scripts/check-emoji.sh`。`*.log` 不入 Git;
Codex 报告或 journal 记录日志文件名、字节数与 SHA-256，历史日志位置见迁移说明。

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

- 每个 Phase:lint + typecheck + 单测 + 契约测试绿，`just ci` 双矩阵(node + python)全绿。
- owner 明确授权提交时使用两提交法:先 `feat(phase-N): ...` 代码提交，再
  `chore(evidence): phase-N` 证据提交;证据记录代码提交 SHA，不自指。
- 批量编辑后逐项程序化核验改动落盘;长文件用 `wc -l` 与关键内容检索复核。

## 常用命令

- `just dev` — 起 daemon + pipeline + console
- `just ci` — 本地 CI 等效(node/python 双矩阵 + emoji 门禁与自测)
- `just backup` — SQLite/JSONL/knowledge 快照备份

## 语言与身份

- 全部沟通、注释、文档使用简体中文;标识符与日志键用英文。
- owner 是唯一决策人，战略与商业取舍永远上浮，不代拍板。

<!-- saydo:knowledge:begin -->
SayDo 知识底座:.saydo/knowledge/current/core.md(generation 5;由 SayDo 奠基器维护,本块勿手改)
稳定结论投影:.saydo/knowledge/m1-notes.md(账本重投影,人批准的 M1 结论)
<!-- saydo:knowledge:end -->
