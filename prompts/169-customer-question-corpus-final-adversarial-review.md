# SayDo 600 条潜在客户生产力提问语料 · 最终候选对抗性评审

你是与素材设计、生成、修订完全零上下文隔离的独立评审者。工作区为 SayDo 仓库；只读审查，不修改任何文件，不信任目录内自报的计数或结论。

## 审查对象

- `research/customer-question-corpus/README.md`
- `research/customer-question-corpus/00-能力边界.md`
- `research/customer-question-corpus/01-设计与分布.md`
- `research/customer-question-corpus/02-覆盖索引.md`
- `research/customer-question-corpus/questions/*.md`
- `research/customer-question-corpus/contexts/**`
- `research/customer-question-corpus/rebuild.mjs`
- `research/customer-question-corpus/validate.mjs`

不要读取 `research/customer-question-corpus/review/`、`research/codex-findings/`、`prompts/` 中其他文件或实施过程记录。必要时独立回读项目能力真相源：`README.md`、`HANDOFF.md`、`docs/02-product-definition.md`、`docs/03-architecture.md`、`docs/04-key-mechanisms.md`、`docs/05-roadmap.md`、`docs/09-data-contracts.md`、`docs/10-voice-ux-spec.md`、`docs/plan/IMPLEMENTATION-PLAN-2.md`。

## 用户目标

用户要基于当前项目能力，设计潜在客户在 600 个不同生产力场合（包含生活生产力、排除娱乐）中的自然提问与真实目的；尽量按问题可能性分布；覆盖不同复杂度、首个结果时延、现实周期、交互轮次、工具深度和风险；需要上下文/RAG 的场景尽量提供配套材料；仔细 review 覆盖人物、组织、生命周期、工具与能力边界。

本目录明确定位为场景层语料，不宣称已附完整 transcript、授权状态与评测 oracle。请按用户实际要求审查，不要把“没有完整自动 benchmark”本身当成缺陷；但若目录仍暗示可直接自动计分，需指出。

## 必做审查

1. 独立运行 `node research/customer-question-corpus/validate.mjs`，检查真实退出码和输出；
2. 不抽样：程序化解析全部 600 行，核对固定文件、ID、九字段、领域与 H/M/L 配额；
3. 对 600 个问题做全量两两近重复分析，并人工回读最高候选；
4. 检查 H/M/L 是否真与 C/D/H/R/K/S/F 解耦，同时仍大致符合目标人群中的发生频率，而非只做数学打散；
5. 核对 D 是首个可审阅结果时延、H 是现实跨度，逐条攻击明显误标；
6. 核对 K 只列当前请求必需工具，尤其避免由词面规则误加 repo、finance、database、e-sign、automation、rag；
7. 核对 S 按题面真实 effect，安全草稿/整理不应自动 S3；受治理的真实外部 effect 与越权请求都应可区分；
8. 核对 `F/B` 正交：F1 当前核心、F2 条件、F3 路线图、F4 越权；医疗/法律/财务安全辅助不应因领域自动 F4；
9. 遍历所有 `CTX` 引用边。每个问题只能引用 manifest `supported_questions` 白名单中的 fixture，题目所需 claim 要由包内来源直接支撑；额外 repo/附件/现势输入必须诚实标 `USER` 或 `LIVE`；
10. 核对 16 个 manifest 的 `as_of`、`valid_until`、claim scope、来源闭合、冲突规则、支持与不支持范围，尤其市场、医疗、销售、预算与采购；
11. 攻击 validator 假绿：非法额外行、重复工具凑 K、manifest 漏来源、前缀/章节错位、上下文白名单不对称、概率确定映射；
12. 检查自然口语、客户真实目的、角色/组织规模、一线与个体、状态/改需求/重试/恢复/重新授权、生活简单任务、非娱乐边界；
13. 检查 SayDo hard rule：风险按 effect、S3 语音不能放行、同意不等于授权、状态话术与候选记忆边界。题面是用户话语，不把用户说“完成”误判为系统状态词违规。

## 输出格式

将最终报告直接写入命令指定的输出文件。先给总判定：`通过`、`有条件通过` 或 `不通过`。随后按严重度列：

- A：让数量、核心覆盖、能力真相、安全或 RAG 可用性结论失真的阻断问题；
- B：显著削弱代表性、自然度、频率、分档或工具可信度的问题；
- C：可选改进。

每条发现必须包含具体文件和 ID/行号、真实证据、影响和最小修复建议。最后给覆盖盲区矩阵、门禁评价和“必须修后才可收口”清单。若某级无问题，明确写“无”，不要为了凑数虚构。
