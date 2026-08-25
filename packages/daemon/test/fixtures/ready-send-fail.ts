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
    const cb = typeof sendHandle === "function"
      ? sendHandle
      : typeof options === "function"
        ? options
        : typeof callback === "function"
          ? callback
          : undefined;
    if (frame && frame.t === "ready") {
      queueMicrotask(() => {
        if (typeof cb === "function") cb(new Error("ready ipc failed"));
      });
      return false;
    }
    return orig.call(process, message, sendHandle as never, options as never, callback as never);
  } as typeof process.send;
}
