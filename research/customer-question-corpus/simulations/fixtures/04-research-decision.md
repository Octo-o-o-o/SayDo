# 04-research-decision 模拟 fixture

全部 payload 为合成快照。locator 只用于把会话对到本文件事件。

## SIM-RES-01

### sea-rag

- locator: `sim://SIM-RES-01/sea-rag`
- status: `ok`
- tool: rag
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "markets": [
    "SG",
    "MY",
    "TH"
  ],
  "interviewees": 6,
  "decideCountry": false
}
```

### market-refresh

- locator: `sim://SIM-RES-01/market-refresh`
- status: `ok`
- tool: browser
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "asOfFrozen": "2026-08-20",
  "asOfLive": "2026-08-24",
  "liveOk": true
}
```

## SIM-RES-02

### no_tool

- locator: `sim://SIM-RES-02/no_tool`
- status: `no_tool`
- tool: -
- 说明: 本地模拟事件，不是真实 connector 地址。
- 理由: K0：只对已注入模考摘要做推理。

## SIM-RES-03

### mail-file-sync

- locator: `sim://SIM-RES-03/mail-file-sync`
- status: `conflict`
- tool: email
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "fileDate": "2026-07-18",
  "mailNoteDate": "2026-08-01",
  "internalFwd": "2026-08-03",
  "legalConclusion": null
}
```

## SIM-RES-04

### option-memory

- locator: `sim://SIM-RES-04/option-memory`
- status: `ok`
- tool: memory
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "oldSuggestion": "SG first",
  "withdrawn": false,
  "pendingCounterEvidence": true
}
```

## SIM-RES-05

### repro-env

- locator: `sim://SIM-RES-05/repro-env`
- status: `partial`
- tool: test
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "libx": "unknown-until-user-log",
  "seed": "unknown-until-user-log",
  "missing": [
    "dataset-shard-B"
  ],
  "passed": false
}
```

## SIM-RES-06

### scan-preview

- locator: `sim://SIM-RES-06/scan-preview`
- status: `ok`
- tool: browser
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "items": 3,
  "writeRoadmap": false
}
```
