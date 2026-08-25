# AI 供给生态与体验终审

> 日期：2026-08-23
> 审查对象：`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`
> 审查内容 SHA-256：`4fbb74de830b6accb470d4abd87e4c9beec3482e822634e7ad7a981944d5cf71`
> 结论：FAIL

已核对 SHA-256，与期望值一致。全程只读，未编辑文件。

## A findings

### A-1 自动 loopback 发现与资源预算互斥，首次 L0 本地接入主路径不可用

- 准确位置：
  - §4.13 ResourceBudgetProfile：自动 `static` round 要求“零网络”；8 个 loopback metadata 请求只能在用户选中候选后的 `explicit_active` round 使用。
  - §6.1 自动发现：自动阶段明确包含“受限 loopback metadata”。
  - §6.3 loopback detector：自动探测明确要做 TCP/HTTP metadata。
  - L0 范围、Phase 4 与零字段指标又要求 Ollama、LM Studio、oMLX 自动发现且无需 URL/key。
- 可复现反例：全新 SayDo 安装，Ollama 仅以 Docker或独立服务运行在 `127.0.0.1:11434`，本机 PATH、已知配置位置及缓存中均无 Ollama artifact。发现它至少需要一次 loopback TCP/HTTP 请求；Ollama 官方也将模型枚举暴露为 `/v1/models`，LM Studio 的模型与服务信息同样通过 localhost API 暴露。
- 现有条款为何挡不住：不发网络请求就没有候选可供用户选择；没有候选又不能进入仅允许用户所选候选使用的 `explicit_active`。若 detector 在 `static` 中访问 loopback，则违反签名预算和 TCK；若遵守零网络，则 L0 首次自动接入失败。完整实施也无法同时满足两组合同。
- 最小修订：增加独立、签名的 `passive_loopback_metadata` round，允许仅访问 registry 固定的 `127.0.0.0/8`、`::1`、端口和只读 metadata path，禁止 DNS、Internet/LAN、redirect、auth、生成请求与子进程，并固化请求数、响应字节和时限。同步修改 §4.13、§6.1、`DiscoveryBudgetReceipt`、detector TCK 与 Phase 4 验收。

参考：[Ollama 官方 API](https://docs.ollama.com/api/openai-compatibility)、[LM Studio 官方文档](https://lmstudio.ai/docs/developer)。

## B findings

### B-1 智谱 BigModel 中国普通 API 被错误限制为 Chat，漏掉已有官方 Messages 主路径

- 准确位置：大陆产品表、Phase 3 验收、证据基线与评审回修摘要。
- 可复现反例：普通 BigModel payg 用户已有 Anthropic SDK/Messages 工作流，希望保留原生 content blocks、tool use 和 streaming。方案即使完整实施也只开放 Chat，迫使用户降格适配或误走自定义高级流程。
- 当前官方事实：智谱普通开放平台已经提供 Claude API 兼容入口 `https://open.bigmodel.cn/api/anthropic`，使用普通开放平台 API key，并明确示例调用 `POST /api/anthropic/v1/messages`；这不是 Coding Plan 专用 `/api/coding/...` 路径。
- 现有条款为何挡不住：Phase 3 将 BigModel 与 Z.AI 一并硬编码为“首发只开放 Chat”，evidence-lock 因缺少这份当前官方资料也不会产生 Messages profile；通用 TCK 只会验证已经登记的 profile，不能补回未登记入口。
- 最小修订：将 BigModel 普通 API 拆成同一普通 payg 产品下的独立 `openai_chat` 与 `anthropic_messages` `ProtocolRoute`/`RequestProfile`，补入官方 URL、`accessedAt`、digest 与 Messages TCK；继续保持 BigModel Coding Plan 和 Z.AI 产品、凭据、endpoint、rights 完全分离。

参考：[智谱官方 Claude API 兼容文档](https://docs.bigmodel.cn/cn/guide/develop/claude/introduction)。

## C findings

未发现独立的 C 级缺口。§15 对 BigModel 的失实证据基线已并入 B-1，不重复计数。

除上述两项外，未发现 OpenCode Zen/Go/Server、Kimi、OpenRouter BYOK、多计费 component、custom endpoint、点击口径、四轴 readiness或外部贡献治理在“完整照方案实施”前提下仍可复现的额外 A/B/C 问题。
