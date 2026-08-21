/** POSIX kill -9 在 Windows 上是 TerminateProcess,不保证 signal=SIGKILL / status=137。 */

export function wasHardKilled(err: unknown): boolean {
  const e = err as { signal?: string | null; status?: number | null; killed?: boolean };
  if (e.signal === "SIGKILL" || e.status === 137) return true;
  if (process.platform !== "win32") return false;
  return e.killed === true || e.signal === "SIGTERM" || (typeof e.status === "number" && e.status !== 0);
}
