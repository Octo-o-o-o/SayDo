# 01-software-it 模拟 fixture

全部 payload 为合成快照。locator 只用于把会话对到本文件事件。

## SIM-ENG-01

### fix-status

- locator: `sim://SIM-ENG-01/fix-status`
- status: `ok`
- tool: tasks
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "org": "Northstar-Id",
  "taskId": "T-4821",
  "title": "email refresh stale value",
  "state": "running",
  "verified": [
    "unit tests green on branch fix/email-refresh"
  ],
  "waiting": [
    "staging repro of refresh-after-save"
  ],
  "mergeAuthorized": false
}
```

## SIM-ENG-02

### launch-scope

- locator: `sim://SIM-ENG-02/launch-scope`
- status: `ok`
- tool: test
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "product": "Atlas Approval Center 2.0",
  "inScope": [
    "conditional approval",
    "delegation",
    "audit export",
    "read-only API"
  ],
  "outOfScope": [
    "mobile offline approval",
    "cross-tenant templates"
  ],
  "unknown": [
    "old API sunset",
    "rollback window",
    "tenant-50 production-like data"
  ],
  "source": "CTX-03 launch-brief and milestones"
}
```

## SIM-ENG-03

### incident-rag

- locator: `sim://SIM-ENG-03/incident-rag`
- status: `conflict`
- tool: monitoring
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "timelineFirstSignal": "09:42 success 99.8% to 83.1%",
  "logClock": "UTC",
  "runbookStep": "clear all sessions",
  "executedClearSessions": false,
  "authority": "incident-timeline > log-excerpts > runbook"
}
```

### live-log-head

- locator: `sim://SIM-ENG-03/live-log-head`
- status: `partial`
- tool: monitoring
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "asOf": "2026-08-12T10:37:00+08:00",
  "sample": "refresh token cache miss then timeout",
  "completeness": "head-only synthetic snapshot"
}
```

## SIM-ENG-04

### idp-catalog

- locator: `sim://SIM-ENG-04/idp-catalog`
- status: `ok`
- tool: repo
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "workspace": "ws-atlas-login",
  "modules": [
    "password-login",
    "session",
    "recovery-email"
  ],
  "ssoPresent": false,
  "notes": "synthetic module list"
}
```

## SIM-ENG-05

### lint-job-trace

- locator: `sim://SIM-ENG-05/lint-job-trace`
- status: `ok`
- tool: ci
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "job": "pr-lint",
  "durationMs": 420000,
  "steps": [
    {
      "name": "install",
      "ms": 180000,
      "cacheable": true
    },
    {
      "name": "lint",
      "ms": 150000,
      "cacheable": true
    },
    {
      "name": "dep-scan",
      "ms": 90000,
      "gate": true
    }
  ]
}
```

## SIM-ENG-06

### roadmap-preview

- locator: `sim://SIM-ENG-06/roadmap-preview`
- status: `ok`
- tool: repo
- 说明: 本地模拟事件，不是真实 connector 地址。
- payload:

```json
{
  "previewOnly": true,
  "openMilestones": 11,
  "productionDeployAllowed": false,
  "note": "synthetic workspace preview"
}
```
