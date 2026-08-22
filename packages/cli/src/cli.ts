import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CLI_PROTOCOL_VERSION } from "./buildIdentity.js";
import { consoleUrl, openExternal } from "./open.js";
import { parseCliOptions } from "./options.js";
import { probeDaemon } from "./probe.js";
import { distributionPaths, holdAttached, runOwned } from "./supervisor.js";

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const probe = await probeDaemon(options.home, options.port, CLI_PROTOCOL_VERSION);
  if (options.command === "status") {
    process.stdout.write(`${JSON.stringify(probe)}\n`);
    process.exitCode = probe.kind === "attached" ? 0 : probe.kind === "available" ? 1 : 2;
    return;
  }
  if (options.command === "open") {
    if (probe.kind !== "attached") throw new Error(probe.kind === "conflict" ? `port_conflict:${probe.reason}` : "daemon_not_running");
    const token = readFileSync(join(options.home, ".cap-token"), "utf8").trim();
    await openExternal(consoleUrl(options.port, token));
    return;
  }
  if (probe.kind === "conflict") throw new Error(`port_conflict:${probe.reason}`);
  if (probe.kind === "attached") {
    if (options.openBrowser) {
      const token = readFileSync(join(options.home, ".cap-token"), "utf8").trim();
      await openExternal(consoleUrl(options.port, token));
    }
    await holdAttached(probe, options.home);
    return;
  }
  await runOwned({ ...options, paths: distributionPaths() });
}

void main().catch((err) => {
  process.stderr.write(`[fail] ${String(err instanceof Error ? err.message : err)}\n`);
  process.exitCode = 1;
});
