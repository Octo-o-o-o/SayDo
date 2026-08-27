# RC4 runtime fresh reimplementation: first host readback return

You are resuming implementation session `01a03397-9ddf-7870-93b9-6c68101a1201` in the same worktree. This is the first readback red after the fresh reimplementation required by prompt 196. Fix the implementation in this same session. Do not create a new session, commit, push, tag, publish, deploy, or touch another worktree.

## Scope and evidence

The checkpoint remains `2637d30d361ed3835711418697d427fe2ec9e987`. Preserve the current uncommitted implementation unless a focused correction is required.

Independent host commands, run outside your workspace sandbox, produced these exact results:

- `pnpm --filter @saydo/platform test`: exit 0; 47 passed, 5 platform-conditional skipped.
- `pnpm --filter @saydo/cli test`: exit 0; 45 passed, 1 platform-conditional skipped.
- daemon focused files:
  - `test/lifecycle-disposition.test.ts`: exit 0; 16/16 passed.
  - `test/runtime-child-registry.test.ts`: exit 0; 72 passed, 1 Windows-conditional skipped.
  - `test/tier1-executor.test.ts`: exit 0; 150/150 passed in 80.71s.
  - `test/tier1-gate-socket.test.ts`: exit 0; 29/29 passed.
  - `test/shutdown-deadline.test.ts`: exit 0; 9/9 passed.
  - `test/recovery-only-process.test.ts`: exit 0; 10/10 passed.
  - `test/byoa.test.ts`: exit 0; 77/77 passed.
  - `test/restart-policy.test.ts`: exit 0; 15/15 passed.
- `pnpm typecheck`: exit 0.
- `pnpm lint`: exit 0.
- `bash scripts/check-emoji.sh`: exit 0, `[ok] emoji gate: clean`.
- `git diff --check`: exit 0.

Exactly one host gate is red and it reproduces deterministically both in the full file and alone:

```text
pnpm --filter @saydo/daemon exec vitest run test/startup-failure.test.ts
Test Files  1 failed (1)
Tests  1 failed | 17 passed (18)
FAIL ... > 真实 daemon 入口：bind/recover hold 期间 shutdown 不 recover、受 deadline 收口
Error: recover-entered frame timeout
test/startup-failure.test.ts:747:51
exit 1
```

Focused rerun of only that case also exits 1 after 15.8s with the same `recover-entered frame timeout`.

The test starts a supervised production daemon with `test/fixtures/recover-hold.ts`, waits for exactly one `recover-entered` IPC frame, then sends `prepareShutdown`. The fixture installs `recoverHold` and `onRecoverEntered`. `Tier1Executor.recover()` currently calls `onRecoverEntered` before awaiting the hold. Nevertheless the real entry never delivers the frame on the host. Determine the actual production composition/order failure; do not assume the test is wrong.

## Required correction

1. Make the production entry deterministically enter `Tier1Executor.recover()` and expose the explicit `onRecoverEntered` observation before waiting on `recoverHold`, while retaining all shutdown races and ready barriers from prompt 196.
2. A shutdown arriving during the hold must abort the hold and settle within the existing deadline, must not reach `onRecoverAttempt`, must not spawn/recover work, must preserve durable owners, must emit no fatal frame, and must emit exactly one stopped frame with `reason=supervisor_stop`.
3. Preserve the terminal priority `fatal > signal > restart`, immediate lifecycle ownership, awaited ready IPC, and `AbortSignal` propagation.
4. Do not loosen the 15-second timeout, skip/delete/rewrite the failing assertion, add ambient test flags, add sleeps, or hide the failure.
5. Do not regress hostile-value projection, Windows native spawn, generation/CAS, advisory locking, or exact cleanup semantics.

Add or strengthen a narrow deterministic unit/composition test if needed, but keep the real daemon test intact.

## Verification discipline

Your workspace sandbox blocks `/bin/ps`, so a real-process command may remain red there for that external reason. Do not repeatedly run the whole Tier-1 file. First inspect and correct the production call graph. Then run direct commands without pipelines or `tail` when asserting exit status:

1. the narrowest non-`ps` unit/composition test proving the corrected order;
2. `pnpm --filter @saydo/daemon exec vitest run test/lifecycle-disposition.test.ts test/shutdown-deadline.test.ts`;
3. `pnpm typecheck`;
4. `pnpm lint`;
5. `bash scripts/check-emoji.sh`;
6. `git diff --check`.

If you run the real daemon case and it fails only because the sandbox denies `ps`, report that exact limitation; the host reviewer will rerun it. Do not claim the host red is fixed without either a logically sufficient correction plus a narrow green test or a real host-equivalent pass.

Finish with: root cause, exact files/lines changed, direct command results and exit codes, remaining host-only validation, `git status --short`, and residual process check. Leave the worktree uncommitted.
