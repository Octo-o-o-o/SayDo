# 12-household-family-community 模拟 fixture

全部 payload 为合成快照。locator 只用于把会话对到本文件事件。

## SIM-FAM-01

### care-pack

- locator: `sim://SIM-FAM-01/care-pack`
- status: `conflict`
- tool: rag
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "medLists": 2,
  "changeMeds": false
}
```

## SIM-FAM-02

### school-mail

- locator: `sim://SIM-FAM-02/school-mail`
- status: `ok`
- tool: email
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "receipts": [
    {
      "id": "R-photo",
      "due": "2026-09-05"
    }
  ],
  "events": [
    {
      "id": "E-sports-day",
      "due": "2026-09-12"
    }
  ],
  "materials": [
    {
      "id": "M-lab-fee-form",
      "due": "2026-09-08"
    }
  ],
  "feeAmount": 320,
  "paid": false
}
```

## SIM-FAM-03

### roster-live

- locator: `sim://SIM-FAM-03/roster-live`
- status: `ok`
- tool: calendar
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "confirmedOnly": true,
  "v07": "afternoon-only",
  "v12": "morning-only",
  "confirmed": [
    {
      "skill": "electrical",
      "slot": "morning",
      "count": 1
    },
    {
      "skill": "electrical",
      "slot": "afternoon",
      "count": 2
    },
    {
      "skill": "check-in",
      "slot": "morning",
      "count": 3
    },
    {
      "skill": "check-in",
      "slot": "afternoon",
      "count": 1
    }
  ],
  "thresholds": [
    {
      "skill": "electrical",
      "slot": "morning",
      "min": 2
    },
    {
      "skill": "electrical",
      "slot": "afternoon",
      "min": 2
    },
    {
      "skill": "check-in",
      "slot": "morning",
      "min": 2
    },
    {
      "skill": "check-in",
      "slot": "afternoon",
      "min": 2
    }
  ],
  "gaps": [
    {
      "skill": "electrical",
      "slot": "morning",
      "need": 1
    },
    {
      "skill": "check-in",
      "slot": "afternoon",
      "need": 1
    }
  ]
}
```

## SIM-FAM-04

### event-state

- locator: `sim://SIM-FAM-04/event-state`
- status: `ok`
- tool: forms
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "weldingAllowed": false,
  "openGate": false
}
```

## SIM-FAM-05

### care-year

- locator: `sim://SIM-FAM-05/care-year`
- status: `ok`
- tool: calendar
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "diagnosis": null,
  "medDecision": false,
  "shareAllRelatives": false
}
```

## SIM-FAM-06

### family-admin-preview

- locator: `sim://SIM-FAM-06/family-admin-preview`
- status: `ok`
- tool: document
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "autoDecide": false,
  "medChange": false,
  "payments": 0
}
```
