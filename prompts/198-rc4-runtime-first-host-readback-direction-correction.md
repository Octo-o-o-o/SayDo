# RC4 runtime first host readback: direction correction

Resume the same implementation session `01a03397-9ddf-7870-93b9-6c68101a1201`. The previous resumed turn was deliberately interrupted before it edited this issue because its proposed fix would have changed a fail-closed product contract.

Evidence correction: the exact current checkpoint from a fresh host `git rev-parse HEAD` is `2637d30ba5ffeedb6067555e9d816dd02d526e43`. Prompt 197 contained an invalid expanded hash whose short prefix happened to match. Use the real hash above; do not repeat the invalid one.

## Owner/reviewer direction

Your latest diagnosis is correct:

- `seedLockedCursorAgent(home)` overwrites `config.toml` with only `[tier1]`.
- That config is intentionally invalid for the normal runtime model/provider contract.
- Production therefore correctly enters `RECOVERY_ONLY` and skips `Tier1Executor.recover()`.
- The old test was a false positive because `recover-hold.ts` emitted `test-recover-hold` directly from preload; that did not prove production entered `recover()`.
- The new internal `recover-entered` observation correctly exposed the invalid fixture precondition.

Do **not** change `bootstrapConfigIfMissing`, active-config validation, `RECOVERY_ONLY`, or any production rule to auto-merge/default an existing incomplete configuration. Existing invalid/incomplete active config must remain fail-closed and recovery-only. Do not make executor recovery run in recovery-only mode.

## Required focused fix

Fix the test composition/fixture precondition so `seedLockedCursorAgent(home)` writes a complete valid normal-mode config **plus** the pinned Tier-1 binary configuration. Use the repository's existing valid model/provider/privacy shape (for example the established `validConfig()` shape in `recovery-only-process.test.ts`) rather than weakening validation. `OPENROUTER_API_KEY` is already supplied by the real-process test.

Keep the real daemon test's behavioral assertions intact:

- it must wait for the frame emitted from inside production `Tier1Executor.recover()`;
- shutdown during the internal hold must abort without `onRecoverAttempt`, spawn, recovery, owner mutation, or fatal;
- exactly one stopped frame with `reason=supervisor_stop` must remain required;
- do not reintroduce the old external `release-recover-hold` message or preload-only proof;
- do not loosen timeout, skip/delete the case, add sleeps, or add ambient production test flags.

If the production hook wiring is already correct once the fixture enables normal mode, leave production configuration/lifecycle code unchanged. Add a narrow assertion/test that the seeded config validates as normal mode if an existing public validator makes that practical without coupling to implementation internals.

Run direct, non-pipelined commands for exit status:

1. the narrowest configuration validation test you add or reuse;
2. the focused real daemon test (it may still hit the known `/bin/ps` sandbox restriction; report exact output honestly);
3. `pnpm --filter @saydo/daemon exec vitest run test/lifecycle-disposition.test.ts test/shutdown-deadline.test.ts`;
4. `pnpm typecheck`;
5. `pnpm lint`;
6. `bash scripts/check-emoji.sh`;
7. `git diff --check`.

No commit, push, tag, publish, deploy, or other-worktree edits. Finish with root cause, exact diff, direct results/exit codes, remaining host rerun, status, and residual process check.
