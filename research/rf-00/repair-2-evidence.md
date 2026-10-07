# RF-00 repair-2 证据说明(第二轮对抗审查回修与独立准备)

> 本文件是仓内证据索引。逐命令完整日志(argv/cwd/exit/字节/SHA-256)
> 在宿主任务目录 `repair-2-artifacts/logs/`;总报告 `repair-2-artifacts/REPORT.md`。
> 本文不代表合同审查意见，不代表独立 GREEN,不代表产品验收。

## 修复映射(review-2 P1)

| P1 | 修复落点 | 证据 |
|---|---|---|
| expired 墓碑可再占位(§17.1) | docs/09 §17.1:`expired`/`reconcile_required` 改为墓碑终态;K+status+operationId+updatedAt 最小保留集;过期重放固定应答语义;unknown 不误信;"重启后占位丢失"场景新增;`/v1/operations` 查询挂接结果权限 | docs/09-data-contracts.md §17.1 |
| request-manual-merge 误分类(§17.2) | `action_effect_class` 改为 `control.settle`;新增**逐项** action/命令处置表(13 行,覆盖全部 5 个 task_actions 与写侧 HTTP 动作,分类=真实效果而非定语);"新派发"语义口径单列 | docs/09 §17.2;research/rf-00/action-effect-audit.md;semantic-claims.json `item_dispositions`(25 条,全部 verified_semantics 且 evidence 可解析;孤儿键/缺字段会 fail) |
| RF-00 扫描漏 `up`(脚本) | 扫描器改为**三面对账**:options.ts 声明 ∩ parse 接受 ∩ cli.ts 执行(显式分支+默认 runOwned);空集/单面集必失败 | scripts/rf00-inventory-scan.mjs |
| 异步/其余写入口漏收 | 词表补 appendFile/writeSync/linkSync/mkdtempSync/cpSync/write-mode open/openSync;fs 别名校准;Android KeyStore generateKey/setEntry/deleteEntry;ArkTS HUKS *KeyItem;Python shutil/os;Swift 已有词表保留 | 同上线+下行;14 条非哨兵真实命中已人工核实 |
| 反例为空 | 新增 CLI 声明-接受-执行三面对账反例、非哨兵异步/原生写器反例;mutation 14 条 | `--mutation-test` |
| 语义对照缺失 | `item_dispositions` 25 条(cli_commands 5/task_actions 5/http_routes 10/ipc_frames 5),全部 verified_semantics;门校验:键必须指向现存机械项、disposition 非空、evidence 路径可解析;selected=0 的类不算已核验 | `--check` |

## 证据缺口补齐

| 缺口 | 落点 |
|---|---|
| durable 保留窗口未定 | §17.3:`durableEventRetention` 缺省 P30D、实现下界 P7D;`maxEventsPerStream` 缺省 10000;cursor 过期语义;业务墓碑不受事件窗口裁剪 |
| 过滤形状未定 | §17.3:EventFilter 精确字段形状+fail-closed 规则 |
| 安全参数未定 | §17.7:`BRIDGE_MAX_FRAME_BYTES`=65536、`BRIDGE_MAX_PENDING_REQUESTS`=64、`BRIDGE_REQUEST_TIMEOUT_MS`=30000、`BRIDGE_RATE_PER_CAPABILITY`=60(键/分钟);逐参数语义+越界行为 |
| 帧 schema 不完整 | §17.7:BridgeHello/BridgeRequest/BridgeResponse/BridgeEvent/BridgeBye 完整字段表+生命周期常量 |
| 兼容窗口未定 | §17.7:GEN 序列表、等价类(当前+紧前一代)、无交集 fail closed、静默降级禁止 |
| SDK 前代规则未定 | §17.8:`compat.v` 形状、supportsGen[]、服务端窗口、0.x 不承诺、incompatible_contract 语义 |

## 独立准备物(不跨合同/PG 门)

| RF | 物 | 性质 |
|---|---|---|
| RF-01 | `research/rf-00/module-cards.md`(7 模块卡) | 草稿 |
| RF-06 | `research/rf-00/rf06-fixture-demo-plan.md` | 纯 fixture 计划,定义"能演不能演" |
| RF-07 | `fixtures/provider-executor-conformance.json`(13 用例,kind 覆盖 normal/reject/recover/unknown) | fixture |
| RF-08 | `fixtures/media-corpus.json`(24 场景、12 类别:zh 停顿/混说/迟到 ASR/打断/崩溃/蓝牙/锁屏/噪声/ptt 竞态/误唤醒/TTS 脱敏/水印;P50/P90/undeterminable 口径) | fixture,测量协议在文件内 |
| RF-09 | `fixtures/bridge-frames.json`(14 golden 帧用例)+`device-capability-matrix.json`(ios/android/harmonyos 三端矩阵) | fixture / inventory_only |
| RF-10 | `fixtures/release-closure-sample.json`(SBOM/SLSA/just release 物样例) | fixture |
| RF-11 | 根 `CONTRIBUTING.md`/`GOVERNANCE.md`/`CODE_OF_CONDUCT.md` + `research/rf-00/governance/`(CODEOWNERS 草案、maintainer-handover) | 草案,无 DCO/CLA/远端 ruleset |
| 验收映射 | `research/rf-00/acceptance-matrix.md` | 逐项分母映射 |

## 离线校验

`node scripts/check-offline-fixtures.mjs` 校验 5 语料与矩阵文件衔接;
`--mutation-test` 7 条反例全按预期。**fixture 通过 ≠ 生产行为通过。**

## 门禁结果(本批实测)

| 命令 | 结果 |
|---|---|
| `node scripts/schedule-pointer.mjs --check` | pass(active=RF-00,未推进) |
| `node scripts/schedule-pointer.mjs --self-test` | pass(4 规则) |
| `node scripts/rf00-inventory-scan.mjs --check` | pass(cli_commands=5 含 up;stored compare ok) |
| `node scripts/rf00-inventory-scan.mjs --mutation-test` | pass(14/14) |
| `node scripts/check-offline-fixtures.mjs` | pass(5 corpora) |
| `node scripts/check-offline-fixtures.mjs --mutation-test` | pass(7/7) |
| `node scripts/check-doc-links.mjs` | pass(169 files,0 broken) |
| `bash scripts/check-emoji.sh` | pass |
| `node scripts/check-public-tree-privacy.mjs --fs` | pass(2333 scanned,0 hits) |
| `node scripts/check-public-tree-privacy.mjs --ref <HEAD>` | pass |
| `node scripts/check-active-claims.mjs` | pass(roots=34) |
| `git diff d023ffce… --check` | pass(0 whitespace errors) |

## 明确未做

- 未跑 `just ci`、Playwright、真实 provider/设备/音频(合同审查预算外+无设备凭据)。
- 未做第三轮合同审查;§17.1/17.2/17.3/17.7/17.8 修订未经独立 reviewer 复核。
- 未启动任何 PG 门;schedule 指针仍 active=RF-00。
- 未 push、未合并、未发布、未部署。
- 逐项语义核验剩余 `needs_review` 项已在 `item_dispositions` 中如实列出,不隐藏。
