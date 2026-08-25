# AI 供给普适接入 reference-grade 对抗终审 v13

只读评审目标 `docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`。这是全新 target-only 终审：禁止读取 `prompts/`、`research/codex-findings/`、`history/` 和旧评审，不修改任何文件，不复述作者自证。

先独立核对目标 SHA-256 `ae03c940ee211ee816c608cbddcd8536d7dc80a2847e057c2844a611226fe743`、`wc -l=28097`、bytes `1679137`。漂移即 A 级 `FAIL`。

以顶级开源 reference implementation 的标准做最强对抗审计：从当前代码事实、协议保真、auth/rights/funding/data/network、租约和 crash recovery、CLI/Agent 副作用、local/cloud 边界、registry/plugin/TUF 供应链、TypeScript 可构造性与编译复杂度、63 行 GA 真相、真实用户 journey、三平台性能稳定性、迁移回滚和可执行验收寻找反例。特别验证智谱、Kimi、OpenCode、OpenAI Chat/Responses、Anthropic Messages、通用 CLI、CC Switch、LiteLLM、Ollama、LM Studio、oMLX不是只列名称；验证未知订阅、unknown metering、隐藏 fallback、loopback 转云和未授权 credential 不会被自动推荐或首字节发送。检查“扩展只加最小变化单元”是否真实，是否存在合同规模本身导致实现不可维护的根因。

发现按 A/B/C 分级：A 是安全、费用、权益、数据、协议、不可构造或 release gate 可绕过；B 是主流路径/生态/UX/平台/性能/维护的重大缺口；C 是非阻断改进。每条给准确章节或类型锚点、最小反例、根因级修复和机器验收；合并同根因，不用字数换数量。

最终输出一份完整 Markdown 报告作为本次回答，不要尝试在沙箱内写报告。固定结构：冻结身份、结论、A 级、B 级、C 级、覆盖与反例矩阵、A/B/C 计数、`PASS` 或 `FAIL`。只有 A=0 且 B=0 才能 `PASS`，不得降级严重性。
