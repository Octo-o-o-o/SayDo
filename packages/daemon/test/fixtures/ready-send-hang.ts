// @ts-nocheck
const orig = process.send;

if (typeof orig === "function") {
  process.send = function sendPatched(
    message: unknown,
    sendHandle?: unknown,
    options?: unknown,
    callback?: unknown
  ): boolean {
    const frame = message as { t?: string };
    if (frame && frame.t === "ready") {
      orig.call(process, message);
      return true;
    }
    return orig.call(process, message, sendHandle as never, options as never, callback as never);
  } as typeof process.send;
}
