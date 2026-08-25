# AI 供给参考实现级方案最终对抗审查

仓库：`<repo>`

只读评审以下主输入：

- `docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`
- 期望 SHA-256：`4fbb74de830b6accb470d4abd87e4c9beec3482e822634e7ad7a981944d5cf71`

先真实核对 SHA；不匹配立即停止。不得修改任何文件，不得把方案中明确写为未来实施/门禁的事项误称为本轮已经完成。

任务：进行一次零上下文、对抗性、可复现的最终审查。假设团队会逐字完整实施方案，寻找仍可导致以下后果的合同缝隙：secret/数据/工具副作用越权，隐藏或重复计费，rights/产品边界外推，receipt/route/model/member 换挂，hard-stop 后在途继续，插件逃逸或资源 DoS，IR/stream 语义静默丢失，阶段反向依赖，热路径不稳定，TCK/供应链徽章伪造，跨平台门禁无法证明，或用户所谓零配置实际被隐藏步骤/错误提示破坏。

同时核对当前事实与方案目标没有混淆，特别是：当前 Kimi/OpenCode 只 inventory、智谱未一键接入、自定义 Base URL 只有 OpenAI Chat 子集；目标中的 OpenCode Zen/Go/Server 分离、智谱/Z.AI 普通 Chat 证据、OpenRouter BYOK、Ollama 冷态、三平台 sandbox 与 SDK/TCK release。

Finding 必须包含：`A/B/C`、准确位置、可复现反例、为什么现有条款挡不住、最小修订。A 为即使完全实施仍阻断安全/费用/数据/合同/DAG/GA；B 为重要完整性；C 为证据卫生。只写愿景、风格或“未来尚未实现”不算 finding。

最后输出：

- `VERDICT: PASS|FAIL`
- 已核对 SHA
- A/B/C 数量与逐项 finding
- 若 PASS，明确写“无未处置 A 级缺口”。

PASS 条件：零未处置 A 级。
