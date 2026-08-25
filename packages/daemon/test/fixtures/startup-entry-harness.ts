import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { formatSayDoJobName } from "@saydo/platform";
import { createLogger } from "../../src/obs/logger.js";
import { createFileAuditSink } from "../../src/obs/audit.js";
import { sendSupervisorFrameAndWait } from "../../src/supervisorIpc.js";
import {
  BOOT_ACTIVATION_FAILED,
  projectBootActivationFailure,
  projectDatabaseCloseFailure,
  settleTier1StartupFailure
} from "../../src/startupFailure.js";
import {
  closeGateServer,
  setGateServerTestHooks,
  startGateServer
} from "../../src/tier1/gateServer.js";

function sample(kind: string): unknown {
  if (kind === "error") return new Error("SECRET");
  if (kind === "aggregate") return new AggregateError([new Error("SECRET")], "SECRET");
  if (kind === "accessor") {
    const err = new Error("init");
    Object.defineProperty(err, "message", { get(): string { return "SECRET"; } });
    return err;
  }
  if (kind === "proxy") {
    return new Proxy(new Error("SECRET"), { get() { return "SECRET"; } });
  }
  if (kind === "revoked") {
    const revoked = Proxy.revocable(new Error("SECRET"), { get() { throw new TypeError("revoked"); } });
    revoked.revoke();
    return revoked.proxy;
  }
  if (kind === "function") return () => "SECRET";
  if (kind === "symbol") return Symbol("SECRET");
  if (kind === "bigint") return 1n;
  if (kind === "primitive") return "SECRET";
  return new Error("SECRET");
}

const home = process.env["SAYDO_HOME"];
if (!home) process.exit(2);
const scenario = process.env["SAYDO_ENTRY_SCENARIO"] ?? "gate-recover-fail";
const sampleKind = process.env["SAYDO_SAMPLE"] ?? "error";
const sockPath = join(home, "tier1-gate.sock");
mkdirSync(home, { recursive: true, mode: 0o700 });
mkdirSync(join(home, "tier1", "runs", "run_keep"), { recursive: true, mode: 0o700 });
writeFileSync(join(home, "tier1", "runs", "run_keep", "agent-owner.json"), JSON.stringify({
  version: 1,
  runId: "run_keep",
  pid: 4242,
  binary: "/bin/sleep",
  processStart: "owned-start",
  ownerInstanceId: "owner",
  ownerPid: 2,
  kind: "tier1:agent",
  generation: "01234567-89ab-cdef-0123-456789abcdef",
  commandToken: "saydo-child-01234567-89ab-cdef-0123-456789abcdef",
  jobName: formatSayDoJobName("Local", "owner", "run_keep", "01234567-89ab-cdef-0123-456789abcdef")
}));

const log = createLogger({ dir: join(home, "logs"), name: "startup-entry" });
const audit = createFileAuditSink(join(home, "audit", "daemon.jsonl"));
const rejections: unknown[] = [];
process.on("unhandledRejection", (reason) => {
  rejections.push(reason);
});

if (scenario === "activation") {
  try {
    throw sample(sampleKind);
  } catch (err) {
    const text = projectBootActivationFailure(err);
    try {
      log.error("boot activation failed", { error: text });
      audit.record({ actor: "daemon", action: "boot.activation_failed", meta: { error: text } });
    } catch {
      // catch 自身不得再抛
    }
    await sendSupervisorFrameAndWait({ v: 1, t: "fatal", code: "activation_failed", message: text });
  }
  if (rejections.length > 0) process.exit(9);
  if (JSON.stringify({ logs: true }).includes("SECRET")) process.exit(9);
  process.stdout.write(BOOT_ACTIVATION_FAILED);
  process.exit(1);
}

if (scenario === "db-close") {
  try {
    throw new Error("SECRET");
  } catch (err) {
    const text = projectDatabaseCloseFailure(err);
    try {
      log.error("daemon database close failed", { error: text });
    } catch {
      // ignore
    }
    await sendSupervisorFrameAndWait({ v: 1, t: "fatal", code: "shutdown_failed", message: text });
    process.exit(1);
  }
}

if (scenario.startsWith("gate")) {
  if (scenario === "gate-delay-recover") {
    setGateServerTestHooks({ listenDelayMs: 80 });
  }
  if (scenario === "gate-close-hang") {
    setGateServerTestHooks(null);
  }
  let server: Awaited<ReturnType<typeof startGateServer>> | null = null;
  try {
    server = await startGateServer(sockPath, async () => ({ permission: "deny" }));
    if (
      scenario === "gate-recover-fail" ||
      scenario === "gate-delay-recover" ||
      scenario === "gate-close-hang" ||
      scenario === "gate-close-reject" ||
      scenario === "executor-fail"
    ) {
      throw sample(sampleKind);
    }
    if (scenario === "gate-ok") {
      await closeGateServer(server);
      process.exit(0);
    }
  } catch (err) {
    const closeGate = scenario === "gate-close-hang"
      ? () => new Promise<void>(() => undefined)
      : scenario === "gate-close-reject"
        ? async () => {
          throw sample(sampleKind);
        }
        : async () => {
          await closeGateServer(server);
          server = null;
        };
    const cleanup = scenario === "executor-fail"
      ? Promise.reject(sample(sampleKind))
      : Promise.resolve();
    const outcome = await settleTier1StartupFailure(err, cleanup, {
      closeGate,
      logError: (msg, fields) => {
        log.error(msg, fields);
      },
      audit: (action, meta) => {
        audit.record({ actor: "daemon", action, meta });
      },
      sendFatal: async (code, message) => {
        await sendSupervisorFrameAndWait({ v: 1, t: "fatal", code, message });
      },
      exit: (code) => {
        if (rejections.length > 0) process.exit(9);
        process.exit(code);
      }
    }, Number(process.env["SAYDO_CLEANUP_MS"] ?? "120"));
    if (rejections.length > 0) process.exit(9);
    if (outcome === "executor-disabled") process.exit(3);
    process.exit(1);
  }
}

process.exit(2);
