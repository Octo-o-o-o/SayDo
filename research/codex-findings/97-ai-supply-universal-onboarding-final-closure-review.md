FAIL

1. **A-1：08/D8/09/C2/C5 一致性门仍非机械门。**  
   位置：[Phase 0 验收](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1232)要求显式检查五处，但[实际门禁](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1241)只验证 C 文件存在、方案不含旧路径及通用链接；链接器还会[屏蔽行内代码](scripts/check-doc-links.mjs:30)。  
   反例：只修改 D8 的 Execution Agent 归属，保留 09 与 C2/C5 的旧所有权和 Gate 合同，现有四条命令仍可全部通过。  
   最小修复：增加并调用专用一致性脚本，显式读取 08、07/D8、09、C2/C5，比对机器可判定的归属、dispatch Gate、逐工具 Gate、proof/state-owner 标识；加入任一文件单独漂移必红的自测。

2. **A-14/A-16：异币种 RouteSet 的聚合费用上限无法计算和执行。**  
   位置：[CandidateBilling](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:780)允许每个成员各自携带 currency，但 [ConformanceAuthorization](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:804)和 [RuntimeSpendAuthorization](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:805)顶层只有一个币种和一个金额标量，却直接求成员金额之和。  
   反例：序列 `[A,B]` 中 A 上限为 `1 CNY`、B 为 `1 USD`；两份成员 receipt 均合法，但 `sum=2` 无合法单位，选择任一顶层币种都无法证明覆盖另一笔费用。  
   最小修复：要么强制同一授权内所有付费成员币种完全相同，否则首字节前拒绝；要么改为逐币种上限向量，或引用带来源、汇率、有效期和保守舍入规则的不可变 FX receipt。补异币种及 `A timeout → B success` 门禁。