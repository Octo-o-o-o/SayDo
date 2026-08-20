/** 进程组未明确 ESRCH 时污染 daemon lifecycle，禁止降格为普通业务失败。 */

export class ProcessGroupLifecycleError extends Error {
  readonly code = "process_group_not_reaped" as const;

  constructor(message: string) {
    super(message);
    this.name = "ProcessGroupLifecycleError";
  }
}

export function isProcessGroupLifecycleError(err: unknown): boolean {
  if (err instanceof ProcessGroupLifecycleError) return true;
  if (!(err instanceof Error)) return false;
  return /process group .+ (did not exit|state unknown)/u.test(err.message) ||
    err.message.includes("process_group_not_reaped") ||
    err.message.includes("owned process group still alive");
}

export function asProcessGroupLifecycleError(err: unknown): ProcessGroupLifecycleError {
  if (err instanceof ProcessGroupLifecycleError) return err;
  return new ProcessGroupLifecycleError(String(err instanceof Error ? err.message : err).slice(0, 300));
}
