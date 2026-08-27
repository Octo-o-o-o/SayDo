# 09-learning-development 模拟 fixture

全部 payload 为合成快照。locator 只用于把会话对到本文件事件。

## SIM-LRN-01

### no_tool

- locator: `sim://SIM-LRN-01/no_tool`
- status: `no_tool`
- tool: -
- 说明: 本地模拟事件，不是真实 connector 地址。
- 理由: K0：只对已注入大纲、错题和时间约束做规划。

## SIM-LRN-02

### calendar-slots

- locator: `sim://SIM-LRN-02/calendar-slots`
- status: `ok`
- tool: calendar
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "busyBlocks": [
    "weekday-daytime"
  ],
  "remindersCreated": false
}
```

## SIM-LRN-03

### paper-access

- locator: `sim://SIM-LRN-03/paper-access`
- status: `partial`
- tool: pdf
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "paywallBypass": false,
  "papers": [
    {
      "id": "P1",
      "title": "Acceptance Evidence versus Process Supervision",
      "date": "2026-06-12",
      "topicFit": "high",
      "fulltext": true,
      "locator": "sim://SIM-LRN-03/paper-p1"
    },
    {
      "id": "P2",
      "title": "Faster Token Sampling Benchmarks",
      "date": "2026-04-03",
      "topicFit": "low-speed-only",
      "fulltext": false,
      "locator": "sim://SIM-LRN-03/paper-p2"
    },
    {
      "id": "P3",
      "title": "Review Queues After Cheap Generation",
      "date": "2026-07-22",
      "topicFit": "high",
      "fulltext": true,
      "locator": "sim://SIM-LRN-03/paper-p3"
    }
  ]
}
```

## SIM-LRN-04

### guide-pack

- locator: `sim://SIM-LRN-04/guide-pack`
- status: `ok`
- tool: pdf
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "kind": "exam-guide-extract",
  "diagnosis": null,
  "medicationChange": false
}
```

## SIM-LRN-05

### daily-forms

- locator: `sim://SIM-LRN-05/daily-forms`
- status: `ok`
- tool: forms
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "goalChanged": false,
  "remindersOn": false
}
```

## SIM-LRN-06

### curriculum-sources

- locator: `sim://SIM-LRN-06/curriculum-sources`
- status: `ok`
- tool: browser
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "gpuRequired": false,
  "hoursAsGate": false
}
```
