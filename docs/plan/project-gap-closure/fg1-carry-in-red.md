# FG-1 新周期 carry-in RED

本文件是新 cycle 的机械 carry-in manifest，只把已核验的两次完整门禁同点失败绑定到起始 candidate，供 V2.4 `cycle_state.py` 核销首次 repair 收据。它不是新增 reviewer，也不覆盖旧 cycle 的 ordinal 4 语义 GREEN。

- first full gate：exit 1，日志 SHA-256 `e9b01f9c7bb98f1fd63b9e07b0500e9c36e06cd96153db85cfb2733824cec819`
- second full gate：exit 1，日志 SHA-256 `6ba20eba2b52e996b3e0db93f46bd92770af0d763515f146c4cff5db99b7a0a1`
- 两次失败均为 `packages/daemon/test/tier1-executor.test.ts:6404` expected true / received false。

```review-manifest
{
  "verdict": "RED",
  "review_ordinal": 1,
  "candidate_head": "2b5517d322f062297d25806b02c4106e2ecc60e8",
  "diff_fingerprint": "8455d6c5d42142b36cd7104e3b74989c64a2db6d2871af771610e598aa9fda49",
  "review_scope": "step",
  "blockers": [
    {
      "id": "FG-1",
      "severity": "P1",
      "summary": "完整 suite 中 ownershipEstablished 后的 owner 文件断言在同点重复失败",
      "evidence": "packages/daemon/test/tier1-executor.test.ts:6404",
      "in_scope": true,
      "needs_owner_decision": false,
      "acceptance_item": "FG1-1"
    }
  ],
  "p2_ledger_delta": [],
  "focused_gates": [
    {
      "name": "first-full-gate",
      "exit_code": 1,
      "summary": "2176 passed, 1 failed, 6 skipped; FG-1 at line 6404"
    },
    {
      "name": "second-full-gate",
      "exit_code": 1,
      "summary": "2176 passed, 1 failed, 6 skipped; same FG-1 at line 6404"
    }
  ],
  "stop_reason": null
}
```
