# 05-business-operations 模拟 fixture

全部 payload 为合成快照。locator 只用于把会话对到本文件事件。

## SIM-OPS-01

### close-board

- locator: `sim://SIM-OPS-01/close-board`
- status: `ok`
- tool: tasks
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "arrived": [
    "INV-338"
  ],
  "blocked": [
    "venue-deposit-owner"
  ],
  "closed": false
}
```

## SIM-OPS-02

### budget-rag

- locator: `sim://SIM-OPS-02/budget-rag`
- status: `ok`
- tool: spreadsheet
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "travelBudget": 90000,
  "travelActual78": 74000,
  "travelCommit9": 38000,
  "closed": false
}
```

### books-status

- locator: `sim://SIM-OPS-02/books-status`
- status: `ok`
- tool: finance
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "monthClose": "open",
  "asOf": "synthetic-q3"
}
```

## SIM-OPS-03

### inbox-today

- locator: `sim://SIM-OPS-03/inbox-today`
- status: `ok`
- tool: email
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "decide": [
    "vendor-dunning-A"
  ],
  "delegate": [
    "room-booking"
  ],
  "waiting": [
    "legal-redline"
  ],
  "fyi": [
    "allhands-note"
  ],
  "sentReplies": 0
}
```

## SIM-OPS-04

### dsr-memory

- locator: `sim://SIM-OPS-04/dsr-memory`
- status: `ok`
- tool: memory
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "requestId": "DSR-19",
  "stoppedAt": "identity-reauth",
  "deleteEnabled": false
}
```

## SIM-OPS-05

### trip-options

- locator: `sim://SIM-OPS-05/trip-options`
- status: `ok`
- tool: browser
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "bookable": false,
  "policy": "company-travel-cap-unconfirmed",
  "options": [
    {
      "id": "opt-air-a",
      "outbound": "Mon 07:40 Hub-N to SHA",
      "inbound": "Thu 20:10 SHA to Hub-N",
      "hotel": "H-Jingan 2 nights",
      "meetingWindow": "Tue afternoon after personnel confirm",
      "taxInclusive": 18600,
      "policyFit": "within-draft-cap"
    },
    {
      "id": "opt-rail-b",
      "outbound": "Mon 09:15 Hub-N to SHA",
      "inbound": "Thu 18:00 SHA to Hub-N",
      "hotel": "H-Xuhui 2 nights",
      "meetingWindow": "Tue afternoon after personnel confirm",
      "taxInclusive": 15200,
      "policyFit": "within-draft-cap"
    }
  ]
}
```

## SIM-OPS-06

### entity-overlap

- locator: `sim://SIM-OPS-06/entity-overlap`
- status: `partial`
- tool: crm
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "autoMerge": false,
  "legalOpinion": null,
  "candidates": [
    {
      "id": "DUP-11",
      "names": [
        "Acme Tools North",
        "AT-North"
      ],
      "evidenceFields": [
        "tax-id-last4",
        "billing-domain",
        "open-contract-count"
      ],
      "diff": "same tax-id-last4, different billing domain",
      "adjudication": "pending-human"
    },
    {
      "id": "DUP-12",
      "names": [
        "River Parts",
        "Riverparts Co"
      ],
      "evidenceFields": [
        "shipping-city",
        "vendor-code"
      ],
      "diff": "similar name, vendor-code missing on side B",
      "adjudication": "pending-human"
    }
  ]
}
```
