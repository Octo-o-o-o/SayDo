# 89 · W5.4-b 前置 canonical 回写(w54b-canonical-preface)· Codex 对抗评审 prompt

## 角色与任务

你是零上下文对抗评审员。评审对象两层:
1. **排产序列判断**:调度会话裁定「W5.4-b 接线开批前必须先完成 W5.4 方案 §5 左栏 P-1…P-5 的 canonical 回写(方案 §6 W5.4-b 行明文前置)+ w54a readback 缺失属开批断言缺口须上浮 owner(PLAN-2 §7-2/§4)」。请证伪该判断。
2. **回写实施质量**:P-1…P-5 已按方案落盘(工作区未提交改动),请逐项核对回写内容与方案 §5 左栏的对应性、与 canonical 全文的自洽性、与实现现状的口径一致性。

只读评审;每条结论附你自己取证的文件路径+行号/摘录;分级 A(错误合同/会误导实施)/ B(次优/遗漏)/ C(可忽略)。零 emoji。

## 坐标

- 方案(评审基准):`docs/plan/2026-08-19-w54-claude-cli-tier1.fable.md` v3.1——§5 左栏 P-1…P-5 是本批唯一范围,右栏 R-1…R-8 属 W5.4-c 随批补录,**不评它们缺失**。
- 被评改动(均为工作区未提交;用 `git diff docs/ HANDOFF.md` 看增量):
  - P-1:`docs/07-tech-stack-decisions.md` 五处(D8 行 :118 附近、弃选表、开发档两处、Phase -1 spike 2)
  - P-2:`docs/adr/design/ADR-001-execution-layer.md` 路径一行 addendum 2026-08-21
  - P-3:`docs/adr/ADR-002-byoa-observed-model.md` 文末「状态更正」节 + `HANDOFF.md` §2-4 尾句
  - P-4/P-5:`docs/09-data-contracts.md` 七处——DevAgentBinding claude_code 分支 transport、§11 门段 claude_code 行改写(律③单列)、§11 新增「claude_code 后端配置承载与门合同」bullet(四键/identity/双脚本 drift guard/GateWireRequest 判别联合/native_session_confirmed/G4 例外两键)、cost_entries kind 词表加 `tier1.run`、subscription_retry_queue Tier1 词表注、tier1_runs DDL 加 `native_session_confirmed` 列、config 示例加 `[tier1]` 段、steerTask live 预留注
- 实现现状参照:`packages/daemon/src/tier1/`(W5.4-a 已收口纯函数层:`backends/claude.ts`、`fileToolToEffect`、`classifyClaudeRunOutcome` 等;evidence `e2e/evidence/w54a-claude-cli.md`)。
- 批次登记:`HANDOFF.md` §1 批次指针行(w54b-canonical-preface)。

## 重点证伪面

1. 回写是否忠实于方案 §5 左栏——有无擅自扩权/缩水/自造语义(对照方案 §2 D2-D14、§3.2-3.9 相应条款)。
2. 09 的新增内容与既有合同有无冲突:词表(§0 前缀/§9 kind/§11 规则)、DDL CHECK、`[models.dev]` 与 `[tier1]` 的键归属、G4 白名单语义、S2/S3 风险语义(文件门「圈外一律 deny 无 S2 通道」是否与既有 S 级定义冲突)。
3. 07 的 supersede 写法是否保住历史可追溯(原结论痕迹 + 日期 + 出处),有无把"无 canUseTool 回调仍为真"写歪。
4. ADR-002 状态更正是否越权:附则收窄条款(1-3)必须原样有效,更正仅限第 4 条现势;「owner 确认挂 W5.4-b 批验收」的表述是否妥当。
5. tier1_runs 加列位置与 additive 声明是否符合「改 DDL_V1 必配增量迁移」铁律的文档侧表达。
6. 漏项:方案 §5 左栏是否还有本批该回写而没写的内容(逐条对照 P-1…P-5 原文)。
7. 序列判断:有没有比「前置回写 → IMPL-PROMPT-15 → owner 停点 → W5.4-b 实施」更正确的标准路径;readback 缺口的处置(上浮而非本会话代跑)是否正确。

## 输出

1. 序列判断:成立/不成立 + 依据。
2. P-1…P-5 逐项:忠实/偏离(给出方案原文与回写文本的差异点)/遗漏,A/B/C 分级。
3. 总评:Go / 修改后 Go / No-Go(No-Go 仅当存在会误导 W5.4-b 实施的 A 级合同错误)。
