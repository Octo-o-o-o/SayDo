import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const home = process.env.SAYDO_LOCK_HOME;
const role = process.env.SAYDO_LOCK_ROLE ?? "reap";
const marker = process.env.SAYDO_LOCK_MARKER;
if (!home || !marker) process.exit(2);

const reaperUrl = pathToFileURL(resolve(process.env.SAYDO_REAPER_MODULE)).href;
const lockUrl = pathToFileURL(resolve(process.env.SAYDO_LOCK_MODULE)).href;

try {
  if (role === "hold") {
    const { withHomeOwnerBoundary } = await import(lockUrl);
    await withHomeOwnerBoundary(home, async () => {
      // pending Promise 本身不保持事件循环存活，持锁生命周期必须由测试明确拥有。
      const keepAlive = setInterval(() => undefined, 1_000);
      try {
        writeFileSync(marker, "holding");
        await new Promise(() => undefined);
      } finally {
        clearInterval(keepAlive);
      }
    });
    process.exit(0);
  }
  if (role === "cli-reap") {
    const { reapOwnedAgentGroups } = await import(reaperUrl);
    writeFileSync(`${marker}.started`, "cli-reap");
    const n = await reapOwnedAgentGroups(home);
    writeFileSync(marker, `reaped:${String(n)}`);
    process.exit(0);
  }
  writeFileSync(`${marker}.error`, "unknown-role");
  process.exit(3);
} catch (err) {
  writeFileSync(`${marker}.error`, err instanceof Error ? err.message : "unknown");
  process.exit(1);
}
