# RF-00 repair-1 证据(合同回修,第二轮合同评审前)

- I 提交:`0cac47c`(fix(rf-00): repair-1 合同回修——§17 目标合同重写 +
  清单落盘比对与原生写面 + 交接文档脱敏)
- 本 E 提交只登记 I SHA 与门结果;完整 REPORT(B1–B8 逐项对账、日志字节与
  SHA-256、NOT_RUN)在仓外
  `~/.codex/tasks/saydo-modular-foundation-20260929/repair-1-artifacts/REPORT.md`。
- 首轮评审报告:`~/.codex/tasks/saydo-modular-foundation-20260929/review-1.md`。

## 门(全部实跑,日志在 repair-1-artifacts/logs/)

| 门 | 结果 |
|---|---|
| `node scripts/schedule-pointer.mjs --check` | exit 0(active=RF-00 next=PG-02 last_closed=SC-RELAND-01 revision=19) |
| `node scripts/schedule-pointer.mjs --self-test` | exit 0 |
| `node scripts/rf00-inventory-scan.mjs --check` | exit 0(15 类 + 落盘全等比对;file_writers=211 含 TokenStore.kt) |
| `node scripts/rf00-inventory-scan.mjs --mutation-test` | exit 0(9 用例:基线绿、丢哨兵/非哨兵原生存储文件、删非哨兵项、改来源、篡改 md、截断 json、删 md 均非零;volatile 漂移仍绿) |
| `node scripts/check-doc-links.mjs` | exit 0 |
| `bash scripts/check-emoji.sh` | exit 0 |
| `node scripts/check-public-tree-privacy.mjs --fs` | exit 0(scanned=2316 hits=0;三份交接文档已脱敏为 `~` 投影) |
| `node scripts/check-public-tree-privacy.mjs --ref <I SHA>` | exit 0(固定 0cac47c 全树;`--ref` 只接受 40 位 SHA) |
| `node scripts/check-active-claims.mjs` | exit 0 |
| `git diff d023ffce --check` | exit 0(基线到 HEAD 全量,非空 diff) |

## NOT_RUN

`just ci`、`pnpm exec playwright test`、真机/provider/外部发布/部署——本轮为
合同+工具回修,留待后续阶段。

## 边界声明

本轮只改 canonical 合同、清单工具与交接文档投影;未改 daemon 业务行为;
09 §17 仍为 designed 目标合同;本提交不自称独立 GREEN,等第二轮 fresh
合同评审;旧 RED、PG 预算与完整 RF 链保留。
