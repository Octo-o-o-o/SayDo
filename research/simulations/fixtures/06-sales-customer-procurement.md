# 06-sales-customer-procurement 模拟 fixture

全部 payload 为合成快照。locator 只用于把会话对到本文件事件。

## SIM-SAL-01

### no_tool

- locator: `sim://SIM-SAL-01/no_tool`
- status: `no_tool`
- tool: -
- 说明: 本地模拟事件，不是真实 connector 地址。
- 理由: K0：只基于已注入发现会材料重排演示。

## SIM-SAL-02

### workshop-tasks

- locator: `sim://SIM-SAL-02/workshop-tasks`
- status: `stale`
- tool: tasks
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "oldDate": "2026-09-04",
  "oldScope": "mobile-pilot",
  "mailSent": false
}
```

## SIM-SAL-03

### crm-next-step

- locator: `sim://SIM-SAL-03/crm-next-step`
- status: `ok`
- tool: crm
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "stage": "tech-eval",
  "sendAllowed": false,
  "budgetConfirmed": false
}
```

## SIM-SAL-04

### renewal-quote

- locator: `sim://SIM-SAL-04/renewal-quote`
- status: `ok`
- tool: spreadsheet
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "newAnnual": 268000,
  "usage": {
    "seatsActive": 42,
    "seatsContracted": 50,
    "period": "2026-Q2"
  },
  "serviceIssues": [
    "priority tickets exceeded 8h response three times",
    "sandbox refresh failed twice in July"
  ],
  "alternativeCost": {
    "low": 240000,
    "high": 310000,
    "currency": "CNY"
  },
  "prepaidDiscountWithdrawn": true,
  "sentToVendor": false
}
```

## SIM-SAL-05

### clause-rag

- locator: `sim://SIM-SAL-05/clause-rag`
- status: `ok`
- tool: rag
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "sections": [
    "concessions",
    "redlines",
    "missing-info",
    "legal-clause-placeholder"
  ],
  "templateFields": [
    "liability-cap",
    "publicity",
    "payment-terms"
  ],
  "legalConclusion": false
}
```

## SIM-SAL-06

### lead-preview

- locator: `sim://SIM-SAL-06/lead-preview`
- status: `empty`
- tool: crm
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "emailsCollected": 0,
  "sendAllowed": false
}
```
