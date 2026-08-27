# 02-product-project 模拟 fixture

全部 payload 为合成快照。locator 只用于把会话对到本文件事件。

## SIM-PRJ-01

### launch-memory

- locator: `sim://SIM-PRJ-01/launch-memory`
- status: `ok`
- tool: memory
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "confirmed": [
    "GA target 2026-10-15",
    "in-scope conditional approval"
  ],
  "conflicts": [
    "sales demo env vs batched migration"
  ]
}
```

### yesterday-decisions

- locator: `sim://SIM-PRJ-01/yesterday-decisions`
- status: `partial`
- tool: tasks
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "newItems": [
    "pilot-2 owner still missing"
  ],
  "asOf": "synthetic-next-day-board"
}
```

## SIM-PRJ-02

### blocked-dep

- locator: `sim://SIM-PRJ-02/blocked-dep`
- status: `ok`
- tool: tasks
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "item": "DEP-17 fixture drawing",
  "ownerTeam": "quality",
  "blockedDays": 2,
  "dueUnspecified": true
}
```

## SIM-PRJ-03

### export-brief

- locator: `sim://SIM-PRJ-03/export-brief`
- status: `conflict`
- tool: document
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "approved": "admin monthly CSV with six fields",
  "feedbackAsk": "all fields",
  "authority": "product-brief > feedback-notes"
}
```

## SIM-PRJ-04

### no_tool

- locator: `sim://SIM-PRJ-04/no_tool`
- status: `no_tool`
- tool: -
- 说明: 本地模拟事件，不是真实 connector 地址。
- 理由: K0：只需对话推理，题目自包含，无外部对象要读。

## SIM-PRJ-05

### funnel-rag

- locator: `sim://SIM-PRJ-05/funnel-rag`
- status: `ok`
- tool: rag
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "register": 8420,
  "inviteOrImportRate": 0.464,
  "firstShareable": 1080,
  "causal": false,
  "mixWarning": "mobile mixed with channel"
}
```

## SIM-PRJ-06

### staff-calendar-preview

- locator: `sim://SIM-PRJ-06/staff-calendar-preview`
- status: `ok`
- tool: calendar
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "previewOnly": true,
  "conflicts": 3,
  "writeAllowed": false
}
```
