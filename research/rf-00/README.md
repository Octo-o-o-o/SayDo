# RF-00 现势和基线清单

机械发现、静态语义处置、真实运行验收分账。`inventory.json`/`inventory.md`
是 `scripts/rf00-inventory-scan.mjs` 的可复跑清单;`semantic-claims.json`
记录逐项处置,docs/09 §17 是唯一目标合同。旧评审和旧证据保留,本轮不追改。

## 全源反向发现

输入为 `git ls-files -z` 中全部 TS/TSX/Python/Swift/Kotlin/ArkTS 源,
不先按生产路径筛选。`scan.source_corpus` 落每文件 path+SHA-256;
`transport_registrations` 记录 server 工厂/import、具名别名调用、路由注册和
pathname/req.url 守卫、WS 接收/upgrade、原生 bridge、CLI/hook 的候选源行。
每一候选需独立的精确处置键、源行摘要、证据和映射;禁止按目录批量默认放行。

处置为 production/test/fixture/unreachable/delegated。测试和过收录行仍留在分母;
具名委托写明调用方/归口。HTTP 扫描源由这些处置的 http_surface 反向导出,
包括 POSIX UDS 与 Windows HMAC 的 POST /gate;同路径两个来源都保留。
Brain/WS/媒体/恢复/原生/CLI 的注册点与既有词表分账,不把客户端当新增服务端路由。
Android/HarmonyOS 现役 Web 容器不虚报成已实现目标通用 bridge。

有限静态词表不是任意语言数据流/动态加载可达性证明。任意动态计算的注册名、
外部生成代码仍需具名人工核验;新增或变动的源即使未匹配词表,也必须更新语义层 transport_corpus 的
文件摘要与注册点 exact-set;--write 只更新机械清单,不能消除此未处置失败。
这证明源已进入核验队列,不是动态可达性证明。新命中注册点即使重生成清单仍因缺精确处置失败。
本轮没有建设通用 AST 图,没有删源或修改生产行为。

`product_sources` 是较宽的产品源计数，另含 `apps/` 下三份 `.kts` 构建配置。
六语言 `source_corpus` 不含 `.kts`；三份配置参与有限文件写词表扫描，但该词表不识别
`ProcessBuilder`/`keytool`，Android 配置阶段生成 `debug.keystore` 的副作用并未由
六语言字节绑定或有限词表证明。`2ff490c2` 时宽计数为 846、绑定源为 843；
后续准确分母见当次生成物。不能把宽计数写成全部字节或全部副作用的语义证明，
RF-10 的真实 Android 构建验证仍属后续验收。

## 效果与准入

32 个 brain_tools、五个 task_actions 和五个 cli_commands 全部有 effectFacets。
以实际 decision/verdict/resolution 分支及同用例 HTTP 映射为依据;
control.settle 不收新派发预算/收据/Gate0 readiness,批准不等于派发。
分类、providerAdmission 与 dispatchAdmission 分列;模型准备保留 route/归属/预算/计费/审计,不要求任务派发收据。
逐项说明见 [效果审计](action-effect-audit.md)。目标 write.idempotent 分类
不是“现役已实现业务幂等”的声明;K/墓碑仍受 docs/09 §17.1 约束。

## 复跑与门禁

```bash
node scripts/rf00-inventory-scan.mjs --write
node scripts/rf00-inventory-scan.mjs --check
node scripts/rf00-inventory-scan.mjs --mutation-test
node scripts/rf00-inventory-scan.mjs --transport-effects-test
node scripts/check-offline-fixtures.mjs
node scripts/check-offline-fixtures.mjs --mutation-test
```

--check 要求所有非易变类逐项处置 exact-set,注册点摘要匹配,证据存在,
CLI 声明/受理/执行三方对账、已知决策分支 exact-set、全工具 canonical 三元分面一致,
非测试源 9 个模型请求点与 2 个 adapter 实现点 exact-set/映射,验收矩阵 A 节全类分母一致于各自来源,
以及 fresh 与落盘稳定字段全等。Git HEAD/分支/旧候选运行元数据只记出处;
tracked_files、source_corpus、注册点、原生写点都不豁免比较。稳定类分母取 fresh；`legacy_candidates` 的清单、具名处置与 A 行分母绑定同一落盘快照，新增或移除本机 worktree 只改变新鲜运行元数据，不改旧快照结论。落盘 legacy 缺失、处置孤儿或 A 行单面篡改仍拒绝；快照 selected 仅表示具名处置数。

反例包括真实临时 Git index 新增未列源的 HTTP/别名/封装/WS/原生注册,
以及分支分类/映射变异;临时目录终结清理。既有 CLI/异步 writer/原生存储/
落盘删除篡改反例保留。--registration-check 是该临时仓反例的窄入口,
不能代替 --check 或生产验收。

新增证据受跟踪之后必须重生成清单,在最终 HEAD 复跑。分母见 inventory.md;
selected 只表示已有处置,executed=0 保持真实,不把键齐备当全产品通过。

fixtures/ 是 RF-06~10 离线准备语料,fixture pass 仅证明语料形状;
真实服务/设备/制品与 PG 门见 [验收矩阵](acceptance-matrix.md)。
