# 11-career-freelance 模拟 fixture

全部 payload 为合成快照。locator 只用于把会话对到本文件事件。

## SIM-CAR-01

### time-budget

- locator: `sim://SIM-CAR-01/time-budget`
- status: `ok`
- tool: tasks
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "hoursPerWeek": 6,
  "weeksRemaining": 8
}
```

## SIM-CAR-02

### invoice-crm

- locator: `sim://SIM-CAR-02/invoice-crm`
- status: `ok`
- tool: crm
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "lastReminderOn": "2026-08-12",
  "status": "awaiting-reply",
  "remindersSent": 1,
  "autoDunning": false,
  "serviceHold": false
}
```

## SIM-CAR-03

### rate-band

- locator: `sim://SIM-CAR-03/rate-band`
- status: `ok`
- tool: spreadsheet
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "asOf": "2026-08-20",
  "region": "CN-east-metro",
  "currency": "CNY",
  "rangeLow": 800,
  "rangeHigh": 1400,
  "unit": "per-day",
  "started": false
}
```

## SIM-CAR-04

### comp-band

- locator: `sim://SIM-CAR-04/comp-band`
- status: `ok`
- tool: browser
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "asOf": "2026-08-01",
  "role": "staff-backend-or-tech-lead",
  "region": "CN-first-tier",
  "currency": "CNY",
  "rangeLow": 650000,
  "rangeHigh": 900000,
  "period": "annual-total"
}
```

## SIM-CAR-05

### no_tool

- locator: `sim://SIM-CAR-05/no_tool`
- status: `no_tool`
- tool: -
- 说明: 本地模拟事件，不是真实 connector 地址。
- 理由: K0：在作者论点和用户项目边界内做提纲。

## SIM-CAR-06

### job-preview

- locator: `sim://SIM-CAR-06/job-preview`
- status: `ok`
- tool: browser
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "applyAllowed": false,
  "rewriteFacts": false
}
```
