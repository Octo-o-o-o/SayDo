# PG-01A FG-1 fresh readback 1

> task: `project-gap-closure`
> stage: `PG-01A/FG-1`
> cycle: `owner-night-fg1-recovery-20260901`
> review ordinal: `1`
> reviewer: fresh zero-context Codex `gpt-5.6-sol/max`, read-only
> raw report: `logs/pg01a-night-20260901.V1D8er/fg1-review-1.md`
> raw report SHA-256: `d6a156fe6aaa351b8942981bddb0d6e99104475acb63e21a524efdf122171e42`
> raw reviewer log SHA-256: `117be3290e42c457b3c85a59a6f426ddb018f1cf1449968046c28b59d2edeb35`

本文件只把独立 reviewer 的事实、结论和 manifest 固化到仓内 review 目录；未改写其评级，也不把之后的完整门禁或页面 QA 倒灌成 reviewer 当时已经执行的证据。

## 结论

`verdict=GREEN`，`review_scope=step`。当前 candidate 未发现 P0/P1、验收失败或 production lifecycle 缺陷。

本轮只证明 FG1-1 至 FG1-3 及当前独立 readback；完整 `just ci` 和页面视觉 QA 在 review 当时尚未运行，必须由 supervisor 在 manifest validator 放行后按顺序执行。

## 固定身份

- HEAD：`2b5517d322f062297d25806b02c4106e2ecc60e8`
- commit：`fix(pg-01a): 收紧公开承诺并校验语料真相`
- `git-diff-v1`：`d324b59bce25b1c3eedb0110c77e520f160f57bc44c2ad3e6b51552ac26444e8`
- V2.4 handoff：`status=valid`
- cycle preflight：exit 0，`status=preflight_ok`
- reviewer 未读取 Grok transcript、旧 ordinal 4 结论或 repair log。

## Happens-before 与根因

实际 lifecycle 顺序为：

`write temp → fsync file → rename → fsync directory → callback → resolve claim → recover 返回 → proc.wait → durable settle → active 删除 → owner CAS 清理`

production 在 owner rename 与目录 fsync 后才调用 `ownershipEstablished`，随后 resolve claim；`recover()` 等待的是 claim barrier，不等待进程结算与 owner 清理。真实 spawner 若 terminal result 已先到达，可在 callback 后立即继续结束流程。因此，旧测试在 `await recovering` 后断言 owner 文件仍存在，是把 claim barrier 错当成 settle/clear barrier。

当前测试保留 callback 内 `existsSync(ownerPath) === true` 的 publication 不变量；在 `await recovering` 后改为通过同一个 `vi.waitFor` 观察 `activeRunCount() === 0` 且 owner 文件已清理。没有 skip、only、timeout 扩大、固定 sleep 或 production 代码变化。

## 范围对账

- scope snapshot：total 2032、may-change 3、protected 2029。
- protected SHA-256：`7661120cfe7abc30e6d705d1a3a7b0f73d7caca3c7f24fbf6dbf0f538d91ff7e`，修前修后相同。
- 本轮新增产品 delta 仅 `packages/daemon/test/tier1-executor.test.ts`，6 行新增、2 行删除。
- 两个 production may-change 文件与 HEAD 完全一致；既有 15 个 PG-01A dirty path 逐字节未变。

## Focused 证据

原始 focused log：47132 bytes，SHA-256 `38b6a444f8c42895f0e073c331f3d6e663d1993782e2eec9cd498044853d484f`；runner summary SHA-256 `4c403a7a1b24b072515c2ef08132b1892ab86ec93a299e631c30035c74956928`。before/after fingerprint 均为当前 candidate。

- targeted：1 passed、154 skipped，exit 0。
- tier1 executor 文件：155 passed，exit 0。
- daemon suite：131 test files passed、2 skipped；2177 tests passed、6 skipped，exit 0。
- daemon typecheck：exit 0。
- daemon ESLint：exit 0，0 errors；测试文件因无 matching config 产生 1 条 ignored-file warning。
- `git diff --check`：exit 0。

reviewer 自身在只读沙箱重跑 targeted 时，Vitest 因无法写 `node_modules/.vite-temp` 而在收集前 EPERM；该结果没有冒充产品失败或独立测试通过。reviewer 另行运行的 typecheck、ESLint 和 diff check 均 exit 0。

## P2 ledger delta

P0：无。P1：无。

P2 新增 `P2-001`：`eslint.config.mjs:7` 的配置只覆盖 `packages/*/src/**`，所以 focused ESLint 虽传入本次测试文件，仍将它忽略。当前 delta 已由 TypeScript typecheck 和 Vitest 覆盖，不构成本次验收失败；未来 test-only delta 的 lint 覆盖缺口登记为 `open`，本步骤不施工。

## 程序性消费

supervisor 完成 review receipt/state 后，以冻结 V2.4 policy、当前 cycle-state 与精确 task/stage/cycle 坐标重新验证下方 manifest，实际返回：

`{"next_action":"full_gate","policy_mode":"policy","policy_revision":"2.4","policy_source":"policy:policy.frozen.json","rule_ids":[],"status":"valid"}`

```review-manifest
{
  "verdict": "GREEN",
  "review_ordinal": 1,
  "candidate_head": "2b5517d322f062297d25806b02c4106e2ecc60e8",
  "diff_fingerprint": "d324b59bce25b1c3eedb0110c77e520f160f57bc44c2ad3e6b51552ac26444e8",
  "review_scope": "step",
  "blockers": [],
  "p2_ledger_delta": [
    {
      "id": "P2-001",
      "first_seen_candidate": "2b5517d322f062297d25806b02c4106e2ecc60e8/d324b59bce25b1c3eedb0110c77e520f160f57bc44c2ad3e6b51552ac26444e8",
      "location": "eslint.config.mjs:7; logs/pg01a-night-20260901.V1D8er/fg1-focused-1.log:445-452",
      "evidence": "focused ESLint argv includes the changed test file, but ESLint reports that file ignored because no matching configuration was supplied",
      "impact": "the current delta is typechecked and exercised by Vitest, but the lint component does not cover test-only changes",
      "status": "open",
      "last_validated_candidate": "2b5517d322f062297d25806b02c4106e2ecc60e8/d324b59bce25b1c3eedb0110c77e520f160f57bc44c2ad3e6b51552ac26444e8",
      "resolution": "step scope only records this coverage gap; no product or ledger change"
    }
  ],
  "focused_gates": [
    {
      "name": "fg1-targeted",
      "exit_code": 0,
      "summary": "1 passed, 154 skipped"
    },
    {
      "name": "tier1-executor-file",
      "exit_code": 0,
      "summary": "155 passed"
    },
    {
      "name": "daemon-suite",
      "exit_code": 0,
      "summary": "131 test files passed, 2 skipped; 2177 tests passed, 6 skipped"
    },
    {
      "name": "daemon-typecheck",
      "exit_code": 0,
      "summary": "package typecheck passed"
    },
    {
      "name": "daemon-eslint",
      "exit_code": 0,
      "summary": "0 errors; test file reported one ignored-file warning"
    },
    {
      "name": "diff-check",
      "exit_code": 0,
      "summary": "no whitespace errors"
    }
  ],
  "stop_reason": null
}
```
