import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const home = process.env.SAYDO_LOCK_HOME;
const role = process.env.SAYDO_LOCK_ROLE ?? "hold";
const marker = process.env.SAYDO_LOCK_MARKER;
if (!home || !marker) process.exit(2);

const modUrl = pathToFileURL(resolve(process.env.SAYDO_LOCK_MODULE)).href;
const { withHomeOwnerBoundary, withHomeOwnerBoundarySync } = await import(modUrl);

try {
  if (role === "crash-hold") {
    await withHomeOwnerBoundary(home, async () => {
      writeFileSync(marker, "holding");
      await new Promise(() => undefined);
    });
    process.exit(0);
  }
  if (role === "sync-crash-hold") {
    withHomeOwnerBoundarySync(home, () => {
      writeFileSync(marker, "holding");
      const buf = new Int32Array(new SharedArrayBuffer(4));
      for (;;) Atomics.wait(buf, 0, 0, 60_000);
    });
    process.exit(0);
  }
  if (role === "wait") {
    await withHomeOwnerBoundary(home, () => {
      writeFileSync(marker, "acquired");
    }, { deadlineMs: 8_000 });
    process.exit(0);
  }
  if (role === "sync-wait") {
    withHomeOwnerBoundarySync(home, () => {
      writeFileSync(marker, "acquired");
    }, { deadlineMs: 8_000 });
    process.exit(0);
  }
  if (role === "exclusive-hold" || role === "exclusive-wait") {
    const processUrl = pathToFileURL(resolve(process.env.SAYDO_PROCESS_MODULE)).href;
    const { tryLockFileExclusive } = await import(processUrl);
    const lockPath = process.env.SAYDO_LOCK_FILE;
    if (!lockPath) process.exit(2);
    if (role === "exclusive-hold") {
      const held = tryLockFileExclusive(lockPath);
      if (held === "busy") throw new Error("exclusive hold busy");
      writeFileSync(marker, "holding");
      const buf = new Int32Array(new SharedArrayBuffer(4));
      for (;;) Atomics.wait(buf, 0, 0, 60_000);
    }
    const waited = tryLockFileExclusive(lockPath);
    if (waited === "busy") {
      writeFileSync(marker, "busy");
      process.exit(0);
    }
    waited.release();
    writeFileSync(marker, "acquired");
    process.exit(0);
  }
  writeFileSync(`${marker}.error`, "unknown-role");
  process.exit(3);
} catch (err) {
  writeFileSync(`${marker}.error`, err instanceof Error ? err.message : "unknown");
  process.exit(1);
}
