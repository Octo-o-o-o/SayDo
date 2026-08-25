# AI 供给生态与零配置体验最终独立评审

你是零上下文、只读的生态/产品/开源贡献评审者。仓库是 `<repo>`。

唯一主输入：

- `docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`
- 期望 SHA-256：`4fbb74de830b6accb470d4abd87e4c9beec3482e822634e7ad7a981944d5cf71`

先用真实命令核对 SHA；不匹配立即报告。可只读检查仓库，并在必要时只使用官方/一手资料核对会改变结论的当前事实；不得编辑文件。

目标：判断完整实施后，普通用户和外部 connector 维护者是否真的能低负担、安全地接入主流中国大陆与全球 API、订阅/CLI/agent、第三方 gateway/bridge、本地与自托管模型，而不被品牌名、登录态、loopback、兼容营销或隐藏付费误导。

重点攻击：

1. OpenCode Zen/Go/Server、Kimi API/会员/Agent、智谱中国/Z.AI/Coding Plan 等产品边界；
2. OpenRouter BYOK、多上游/多计费 component、subscription overage、自动充值/余额 fallback；
3. Ollama/LM Studio/oMLX 等冷态、本地/cloud/LAN、下载和 preload 自举；
4. Custom Base URL 的 Chat/Responses/Messages 探测、真实费用和误判文案；
5. 自动发现是否会读 token/history、执行恶意程序、扫描 LAN、拖慢首屏或制造配置噪声；
6. “一键/两点击”的 SayDo 内步骤与厂商/企业外部任务是否诚实；主动配置和被动提示是否都有唯一处方；
7. L0/L1/L2、四轴、activation readiness 是否如实表达当前可用性；
8. 外部贡献者的 evidence、TCK、builder trust、治理、晋升、交接、撤销与可复现资料。

Finding 只收录完整照方案实施仍可复现的问题。每项注明 `A/B/C`、准确位置、用户/贡献者反例、现有条款为何挡不住、最小修订。A 为未经授权调用/付费/数据泄漏/错误产品权益/主路径不可用/正式徽章伪造；B 为重要覆盖或体验缺口；C 为证据卫生。不要把明确标 inventory 的未交付项误报为正式支持失败。

最后输出：

- `VERDICT: PASS|FAIL`
- 已核对的 SHA
- A/B/C findings
- 若 PASS，明确写“未发现可复现 A 级缺口”。

PASS 条件：零未处置 A 级。
