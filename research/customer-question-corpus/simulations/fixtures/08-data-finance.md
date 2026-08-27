# 08-data-finance 模拟 fixture

全部 payload 为合成快照。locator 只用于把会话对到本文件事件。

## SIM-DAT-01

### no_tool

- locator: `sim://SIM-DAT-01/no_tool`
- status: `no_tool`
- tool: -
- 说明: 本地模拟事件，不是真实 connector 地址。
- 理由: K0：只推理已注入的指标异常摘要。

## SIM-DAT-02

### variance-confirm

- locator: `sim://SIM-DAT-02/variance-confirm`
- status: `ok`
- tool: finance
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "confirmed": [
    "six-idle-seats"
  ],
  "pending": [
    "venue-deposit",
    "outsourcing-delay"
  ]
}
```

## SIM-DAT-03

### weekly-metrics

- locator: `sim://SIM-DAT-03/weekly-metrics`
- status: `stale`
- tool: bi
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "delayHours": 26,
  "sendAllowed": false
}
```

## SIM-DAT-04

### metric-contract

- locator: `sim://SIM-DAT-04/metric-contract`
- status: `ok`
- tool: rag
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "dayBoundary": "seven complete UTC days",
  "excludeInternal": true,
  "excludeBackfill": true,
  "dedupe": "not-event-id-only"
}
```

### cohort-run

- locator: `sim://SIM-DAT-04/cohort-run`
- status: `partial`
- tool: database
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "stagingOnly": true,
  "missingPartitions": [
    "mobile-2026-08-21"
  ]
}
```

## SIM-DAT-05

### quality-gate

- locator: `sim://SIM-DAT-05/quality-gate`
- status: `ok`
- tool: monitoring
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "checks": {
    "uniqueness": "fail",
    "completeness": "pass",
    "freshness": "warn-delay",
    "balance": "pass"
  },
  "quarantine": [
    {
      "id": "evt-dup-mobile-2026-08-21",
      "reason": "duplicate project_created ids"
    }
  ],
  "notifyRole": "data-oncall",
  "writeExecuted": false
}
```

## SIM-DAT-06

### ops-board-preview

- locator: `sim://SIM-DAT-06/ops-board-preview`
- status: `ok`
- tool: bi
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "autoExecute": false,
  "transfers": 0
}
```
