import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const home = process.env.SAYDO_LOCK_HOME;
const role = process.env.SAYDO_LOCK_ROLE ?? "hold";
const marker = process.env.SAYDO_LOCK_MARKER;
if (!home || !marker) process.exit(2);

const registryUrl = pathToFileURL(resolve(process.env.SAYDO_REGISTRY_MODULE)).href;
const restartUrl = pathToFileURL(resolve(process.env.SAYDO_RESTART_MODULE)).href;
const lockUrl = pathToFileURL(resolve(process.env.SAYDO_LOCK_MODULE)).href;
const identityUrl = pathToFileURL(resolve(process.env.SAYDO_IDENTITY_MODULE)).href;

try {
  if (role === "hold") {
    const { withHomeOwnerBoundary } = await import(lockUrl);
    await withHomeOwnerBoundary(home, async () => {
      writeFileSync(marker, "holding");
      await new Promise(() => undefined);
    });
    process.exit(0);
  }
  if (role === "runtime-reap") {
    const { recoverPriorGenerationRuntimeOwners, configureRuntimeChildRegistry } = await import(registryUrl);
    configureRuntimeChildRegistry(home, "current-owner");
    const n = await recoverPriorGenerationRuntimeOwners(home, {
      ownerPid: process.pid,
      ownerInstanceId: "current-owner"
    });
    writeFileSync(marker, `reaped:${String(n)}`);
    process.exit(0);
  }
  if (role === "agent-write") {
    const { publishAgentOwnerUnderHomeLock } = await import(pathToFileURL(resolve(process.env.SAYDO_EXECUTOR_MODULE)).href);
    const { formatSayDoJobName } = await import(identityUrl);
    const gen = "01234567-89ab-cdef-0123-456789abcdef";
    const runId = "run_write";
    const path = join(home, "tier1", "runs", runId, "agent-owner.json");
    mkdirSync(join(home, "tier1", "runs", runId), { recursive: true });
    if (process.env.SAYDO_LOCK_ATTEMPT) writeFileSync(process.env.SAYDO_LOCK_ATTEMPT, "attempting");
    await publishAgentOwnerUnderHomeLock(home, path, {
      version: 1,
      pid: 4242,
      kind: "tier1:agent",
      binary: process.execPath,
      processStart: "birth",
      ownerPid: 2,
      ownerInstanceId: "owner",
      runId,
      commandToken: `saydo-child-${gen}`,
      generation: gen,
      jobName: formatSayDoJobName("Local", "owner", runId, gen),
      worktree: join(home, "wt")
    });
    writeFileSync(marker, "wrote");
    process.exit(0);
  }
  if (role === "agent-reap") {
    const { reapOwnedTier1Agent } = await import(restartUrl);
    const row = JSON.parse(readFileSync(process.env.SAYDO_REAP_ROW, "utf8"));
    const audit = { record() { return { id: "aud_1" }; } };
    const outcome = await reapOwnedTier1Agent(home, row, audit);
    writeFileSync(marker, `outcome:${String(outcome)}`);
    process.exit(0);
  }
  writeFileSync(`${marker}.error`, "unknown-role");
  process.exit(3);
} catch (err) {
  writeFileSync(`${marker}.error`, err instanceof Error ? err.message : "unknown");
  process.exit(1);
}
