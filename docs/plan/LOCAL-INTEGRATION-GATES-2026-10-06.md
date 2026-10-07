# 本地整合门禁映射（2026-10-06）

形状权威为 [09 §18.12](../09-data-contracts.md)。合同候选已通过 review47/48 独立一致性审查；旧43项均保留，旧失败不改写。本地整合通过不关闭PG-02，不授予发布/平台支持。

| 原ID | 原检查入口 | 本地整合义务 | PG-02剩余义务 |
|---|---|---|---|
| 0 | `pnpm --filter @saydo/contracts exec vitest run test/schemas.test.ts` | 原门按当前候选实际执行并通过 | 原阶段要求保留 |
| 1 | `pnpm --filter @saydo/contracts exec vitest run test/truth-plane.test.ts` | 原门按当前候选实际执行并通过 | 原阶段要求保留 |
| 2 | `pnpm typecheck` | 原门按当前候选实际执行并通过 | 原阶段要求保留 |
| 3 | `pnpm lint` | 原门按当前候选实际执行并通过 | 原阶段要求保留 |
| 4 | `node scripts/check-capability-ledger.mjs` | 原门按当前候选实际执行并通过 | 原阶段要求保留 |
| 5 | `node scripts/test-capability-ledger.mjs` | 原门按当前候选实际执行并通过 | 原阶段要求保留 |
| 6 | `node scripts/test-action-reachability.mjs` | 新增完整工具支持域回归，保留全部已成立反例；功能与性能结果分开 | 旧聚合自测、未支持服务正例及旧30秒性能仍各自报告 |
| 7 | `node scripts/check-action-reachability.mjs` | 新增全动作报告完整性门；所有动作扫描到终态，全部诊断保留，不推广证明结论 | 原命令保持失败语义；所有未闭合诊断继续阻断对应证明/PG-02 |
| 8 | `node scripts/check-support-matrix.mjs` | 原门按当前候选实际执行并通过 | 原阶段要求保留 |
| 9 | `node scripts/test-support-matrix.mjs` | 原门按当前候选实际执行并通过 | 原阶段要求保留 |
| 10 | `node research/customer-question-corpus/validate.mjs` | 原门按当前候选实际执行并通过 | 原阶段要求保留 |
| 11 | `node research/customer-question-corpus/test-mutations.mjs` | 原门按当前候选实际执行并通过 | 原阶段要求保留 |
| 12 | `node research/customer-question-corpus/simulations/validate-simulations.mjs` | 原门按当前候选实际执行并通过 | 原阶段要求保留 |
| 13 | `node research/customer-question-corpus/simulations/test-simulation-mutations.mjs` | 原门按当前候选实际执行并通过 | 原阶段要求保留 |
| 14 | `node research/customer-question-corpus/dry-runs/validate-three-pass-dry-run.mjs` | 原门按当前候选实际执行并通过 | 原阶段要求保留 |
| 15 | `node research/customer-question-corpus/dry-runs/test-dry-run-mutations.mjs` | 原门按当前候选实际执行并通过 | 原阶段要求保留 |
| 16 | `node scripts/test-public-text-redaction.mjs` | 原门按当前候选实际执行并通过 | 原阶段要求保留 |
| 17 | `node scripts/check-active-claims.mjs` | 原门按当前候选实际执行并通过 | 原阶段要求保留 |
| 18 | `node scripts/test-active-claims.mjs` | 原门按当前候选实际执行并通过 | 原阶段要求保留 |
| 19 | `node research/customer-question-corpus/check-q0-truth-report.mjs --check research/customer-question-corpus/review/23-pg01a-q0-truth-report.json` | 原门按当前候选实际执行并通过 | 原阶段要求保留 |
| 20 | `node research/customer-question-corpus/test-q0-truth-mutations.mjs` | 原门按当前候选实际执行并通过 | 原阶段要求保留 |
| 21 | `pnpm --filter @saydo/console exec vitest run src/hooks/redesign/mappers.test.ts src/components/redesign/DecisionPackageCard.test.tsx src/lib/apiError.test.ts` | 原门按当前候选实际执行并通过 | 原阶段要求保留 |
| 22 | `pnpm --filter @saydo/daemon exec vitest run test/console-actions.test.ts test/console-api.test.ts test/p05c-direct-mode.test.ts test/mobile-lan-process.test.ts test/pairing-info.test.ts test/t2-thin.test.ts test/logger.test.ts` | 原门按当前候选实际执行并通过 | 原阶段要求保留 |
| 23 | `node scripts/test-pairing-url-corpus.mjs` | 原门按当前候选实际执行并通过 | 原阶段要求保留 |
| 24 | `node scripts/check-remote-surface-inventory.mjs` | 原门按当前候选实际执行并通过 | 原阶段要求保留 |
| 25 | `node scripts/test-remote-surface-inventory.mjs` | 原门按当前候选实际执行并通过 | 原阶段要求保留 |
| 26 | `node scripts/rf00-inventory-scan.mjs --check` | 原门按当前候选实际执行并通过 | 原阶段要求保留 |
| 27 | `node scripts/rf00-inventory-scan.mjs --mutation-test` | 原门按当前候选实际执行并通过 | 原阶段要求保留 |
| 28 | `node scripts/schedule-pointer.mjs --check` | 原门按当前候选实际执行并通过 | 原阶段要求保留 |
| 29 | `node scripts/check-doc-links.mjs` | 原门按当前候选实际执行并通过 | 原阶段要求保留 |
| 30 | `bash scripts/check-emoji.sh` | 原门按当前候选实际执行并通过 | 原阶段要求保留 |
| 31 | `node scripts/check-public-tree-privacy.mjs --fs` | 原门按当前候选实际执行并通过 | 原阶段要求保留 |
| 32 | `node scripts/check-public-tree-privacy.mjs --ref <当前候选>` | 原门按当前候选实际执行并通过 | 原阶段要求保留 |
| 33 | `git diff d023ffcebfad38563bc988977192e77654d7e2a1 --check` | 原门按当前候选实际执行并通过 | 原阶段要求保留 |
| 34 | `node scripts/schedule-pointer.mjs --self-test` | 原门按当前候选实际执行并通过 | 原阶段要求保留 |
| 35 | `just ci` | 原门按当前候选实际执行并通过 | 原阶段要求保留 |
| 36 | `pnpm exec playwright test` | 原门按当前候选实际执行并通过 | 原阶段要求保留 |
| 37 | `node scripts/test-truth-plane-effects.mjs` | 原门按当前候选实际执行并通过 | 原阶段要求保留 |
| 38 | `node scripts/test-truth-plane-services.mjs` | 新增事务语义及具名支持域正反例；复现R45-P2-01的全部场景必须通过 | 旧全服务来源证明正例仍执行并报告；未证明链不因本地整合升级 |
| 39 | `node scripts/test-truth-plane-c14.mjs` | 原门按当前候选实际执行并通过 | 原阶段要求保留 |
| 40 | `pnpm --filter @saydo/cli verify:distribution` | 原门按当前候选实际执行并通过 | 原阶段要求保留 |
| 41 | `pnpm --filter @saydo/cli exec vitest run test/run-owned-reap.test.ts` | 原门按当前候选实际执行并通过 | 原阶段要求保留 |
| 42 | `node scripts/check-gate-list-parity.mjs` | 原门按当前候选实际执行并通过 | 原阶段要求保留 |

本地新增的必需项：

- 双向(commit,path)集合、NUL路径、多父贡献和首父传播的完整性及缺失/多余反例。
- 全HEAD/ref对象分类、全部来源语义处置、dirty字节保全和不可清理原因。
- 当前动作报告的分母、逐动作终态、全部诊断与源绑定；缺动作、篡改诊断、将UNKNOWN转none、陈旧来源必须拒绝。
- 新增工具支持域正例必须同时断言effects和failures，负例同时核拒绝原因及未隐藏的实际效果。
- 固定候选的非作者独立验收。

原6/7/38在新候选上仍实际运行，分别记录其退出码和失败原因；不将原FAIL改成新PASS。新门承接有限本地整合义务，不声明与全产品静态证明等价。原43项中的其余40项保持必需；新增测试命令在实现后填入候选外冻结运行清单，不能把本表中的描述当作已存在可执行命令。

## 本地实施入口与旧义务对应

- `node scripts/test-local-integration-tools.mjs`：原6的全部八个helper及动作fixture仍实际执行；services中的全服务正例断言仍执行并输出完整 `productProofResult`，仅其PG-02闭合结论单列。其它断言失败仍失败；外层300秒有界runner收完整日志。该入口另执行直接读取回归及真实内存SQLite创建/调用控制。原6/38默认入口和断言不变，仍返回各自旧合同结果。
- `node scripts/test-action-report.mjs`：分母、诊断篡改、UNKNOWN/NONE、资源耗尽、源码漂移、独立时钟与干净候选反例；不替代完整扫描。
- `node scripts/report-action-reachability.mjs <候选外输出JSON>`：全部动作原效果、conditions/via、原诊断、逐动作结论及全局诊断；固定干净HEAD并核验实际读取收据。直接读取仍512来源、1MiB/文件、8MiB合计；只复用同次已读取且版本未变的不可变字符串，不重复造buffer。报告通过仍固定 `productAcceptance=false`。
- `python3 scripts/test-local-audit.py`：实际临时Git仓验证中文/换行路径、merge贡献、首父传播、tag/tree与双向缺漏；`scripts/audit-local-week.py`按显式时间窗口和完整ref快照生成独立双向索引。索引通过不替代逐项语义处置，处置与完整来源表另绑定本轮候选。

上述入口的真实执行数、argv、环境、退出码、日志bytes/SHA-256与报告hash在候选外运行清单；这里不预先记PASS。原6的30秒性能条件没有移入本地功能通过结论，PG-02静态闭合、原生资源和平台验收继续未验或失败。
