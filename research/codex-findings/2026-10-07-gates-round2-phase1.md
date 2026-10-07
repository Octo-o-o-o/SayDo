# 第二轮门禁精简第一阶段

本阶段基于 `35d0c6a122736b73cd7ae1d3004979fedbbf8425`，先做结构盘点与两名独立 reviewer 对抗审查，再实施纯精简。本报告不把全部测试库存检索冒充全产品逐行语义审计。

## 改动

- 整体退役固定移动发布版本、历史失败文案和 rc4-mobile prompt 专属原生扫描器；删除专属自测、入口与失去消费者的工作流路径。
- 精准删除安装、发布、配对、进程 wrapper 的源码拼写断言和重复案例库存；保留实际安装执行、配对解析、文件事务、身份/lease/恢复及安全拒绝测试。
- 删除约千行 legacy 判定快照，保留当前 legacy 单调性及明确的 S3/deny 期望；不再宣称冻结全部历史分类结果。
- 删除 emoji 死分支，颜色扫描统一 Node；canonical11 改为按需颜色检查，设计规则保留。
- 退役旧 runtime-preflight 并更新五份现役手册。目标 SHA、实际 loaded SHA、配置/健康新鲜度与真人语音 voice ready 仍需核验；doctor 不等价于旧预检或旧 digest。
- 发布周审保留：它仍参与发布身份、七文件事务和部署失败恢复。本轮不迁移其 schema/恢复合同，不使用空回调让它假绿。

代码改动 26 文件，新增55行、删除3395行，净删3340行。scripts 20,969→18,656行。没有增加测试框架或产品能力。

## 验证与边界

最终 `just ci` exit 0，111.378秒；Node 3954 passed / 21 skipped，Python 159 passed。`test:tools` exit 0，4.047秒；`test:release` exit 0，51.170秒；`just precommit` exit 0，2.014秒。未观察到本次整体耗时下降，不以删行数推断性能收益。

受影响 daemon 四文件 focused 验证190 passed / 1 skipped；emoji 13、颜色21、pairing85均通过。首次安装专项因删去源码锁后尾部残留一个依赖该锁的 mutation 失败；删除这项同类遗留后独立重跑通过，保留初次失败日志。

浏览器/产品实现及其配置未变化，浏览器沿用上一轮66pass证据，没有伪称本轮重新运行。原生端、真实设备/provider、PowerShell实机、SSH远端、部署与托管CI本阶段未运行。现有 shell harness 对错误包digest/最终钉住tgz目标也未等价覆盖全部已删源码锁；第一阶段先提交，随后另行评估真实补测价值。

方案与实施检查由两名非作者 reviewer 执行，冻结实施输入 git-diff-v1 `8b3fae94e64d922f4458086af590c2e579dec869fb65d48679a6c914a9dfe554`。本阶段只记录精简，不提前写入下一阶段补足结论。

## 原始证据

候选外任务目录为 `saydo-gates-round2-20261007`，日志不入Git。

| 文件 | bytes | SHA-256 |
|---|---:|---|
| `inventory.md` | 17610 | `7ebd51c8444d6d319c6fcd35f61bbb3d5fab02f07469f4c9a53a03b0de02c50b` |
| `phase1-review-a.md` | 7877 | `cfbbb96b558c7a6b8401a0ab37a337e118bf1d9dd07b8e816a21c5f9c6ecf57e` |
| `phase1-review-b.md` | 8029 | `b4644831588b72d2a6c6ecfcb3b45461039359a28d97dbff275301e89e2359d7` |
| `implementation-phase1.md` | 7226 | `5d4dd1501658783c6998611482a1b9cd2da9ef4bf033ada963d3bf4e27e3dc6a` |
| `phase1-test-install-scripts.log` | 806 | `bcd1b6769bbc05463ec7fb28fba2c06999e93fd040a74ada41a3a637a91b8901` |
| `phase1-test-install-scripts-rerun.log` | 132 | `fb0ae75bd113f45c85f029ebc302f83c67d859ae6a8c34e6b110241b04b7eedd` |
| `phase1-final-ci.log` | 100440 | `d88aaf896b5eb1a718e1f10281b55bc28412bf2e467538568e568e84216dc78a` |
| `phase1-final-tools.log` | 4827 | `35f6b1d818b71e8215e78bf39116eecba2b09986d8ca813d25b01641fc096d88` |
| `phase1-final-release.log` | 11863 | `4b410c78c27488a15c4c7fb4de0a96f11510932272b14ae090017634ee5abf74` |
| `phase1-final-precommit.log` | 251 | `db1c0b1da82d28a51901b1a02f2b94d1f7cc08055d9ec1bf6f774980daa7f387` |
| `phase1-implementation-review-a.md` | 3531 | `9b7f8f0173c981c4abe7b5aff3863a49ff56db81f2cfb0d229b802ae0cf8bbe6` |
| `phase1-implementation-review-b.md` | 2851 | `7e883098b2bf11a193800cca4594d345c4995e603f71415e8b376de9c22804d4` |

代码提交：`2f62851623a48420c1c2a4a07a28b385febffebc`。两位 reviewer 均无范围内阻塞，派发/收回指纹一致。此证据提交之后才开始第二阶段补足评估。
