# AI 供给参考架构最终独立评审

你是零上下文、只读的架构评审者。仓库是 `<repo>`。

唯一主输入：

- `docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`
- 期望 SHA-256：`4fbb74de830b6accb470d4abd87e4c9beec3482e822634e7ad7a981944d5cf71`

先用真实命令核对 SHA；不匹配立即报告，停止评审。可只读检查仓内 canonical、代码、workflow 和已有测试，但不得编辑任何文件。

目标不是润色，而是判断：如果工程团队逐字完整实施这份方案，是否仍存在可复现的安全、正确性、阶段依赖、性能、扩展性或发布证明缺口，导致它不能成为参考实现级开源架构。

重点攻击：

1. contract DAG、receipt 防换挂、hard-stop/in-flight、费用与 tool side effect 恢复；
2. plugin/Execution Driver 的真实 OS sandbox、confused deputy、secret/transport 边界和资源 DoS；
3. IR request/response 保真、未知事件、stream/backpressure/cancel；
4. control/data snapshot 签名域、原子发布、热路径和故障隔离；
5. SDK/TCK 单向依赖、determinism、trusted builder/verifier、tarball 与 SemVer；
6. Phase 0–8 是否存在反向依赖、虚假门禁或生产 cutover 过早；
7. macOS/Linux/Windows、CI/nightly/release/24h soak 是否机械可验。

Finding 只收录能给出“实施者完全照文档做仍会失败”的具体反例。每项注明 `A/B/C`、准确位置、复现路径、现有条款为何挡不住、最小修订。A 级为安全/数据/费用/合同/DAG/正式发布阻断；B 为重要完整性；C 为证据卫生。不要把 owner 明确前置决策或未来测试尚未实现误报成方案 bug。

最后输出：

- `VERDICT: PASS|FAIL`
- 已核对的 SHA
- A/B/C findings
- 若 PASS，明确写“未发现可复现 A 级缺口”，但仍可列 B/C。

PASS 条件：零未处置 A 级。不要因为文档很长或愿景很好降低标准。
