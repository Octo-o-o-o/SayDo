# 03-writing-content 模拟 fixture

全部 payload 为合成快照。locator 只用于把会话对到本文件事件。

## SIM-WRT-01

### author-rag

- locator: `sim://SIM-WRT-01/author-rag`
- status: `conflict`
- tool: rag
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "confirmedClaims": 4,
  "style": "calm-specific",
  "externalAsLived": false
}
```

## SIM-WRT-02

### no_tool

- locator: `sim://SIM-WRT-02/no_tool`
- status: `no_tool`
- tool: -
- 说明: 本地模拟事件，不是真实 connector 地址。
- 理由: K0：只改用户提供的邮件文本，不调用外部工具。

## SIM-WRT-03

### no_tool

- locator: `sim://SIM-WRT-03/no_tool`
- status: `no_tool`
- tool: -
- 说明: 本地模拟事件，不是真实 connector 地址。
- 理由: K0：在已注入事故事实上起草，不调用外部工具。

## SIM-WRT-04

### review-pack

- locator: `sim://SIM-WRT-04/review-pack`
- status: `ok`
- tool: document
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "published": false,
  "sendQueue": false,
  "sourceSlots": [
    {
      "id": "pilot-80pct",
      "status": "pending-user"
    },
    {
      "id": "industry-40pct",
      "status": "pending-user"
    }
  ]
}
```

## SIM-WRT-05

### rfp-matrix

- locator: `sim://SIM-WRT-05/rfp-matrix`
- status: `ok`
- tool: rag
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "must": [
    "SSO",
    "SCIM",
    "audit export",
    "12k migration"
  ],
  "selfReported": [
    "AI draft replies"
  ],
  "proven": []
}
```

## SIM-WRT-06

### topic-preview

- locator: `sim://SIM-WRT-06/topic-preview`
- status: `ok`
- tool: browser
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "topics": [
    "acceptance-bottleneck",
    "review-queues",
    "eval-oracles"
  ],
  "publishAllowed": false
}
```
