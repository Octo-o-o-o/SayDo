import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { formatSayDoJobName } from "@saydo/platform";
import { createLogger } from "../../src/obs/logger.js";
import { createFileAuditSink } from "../../src/obs/audit.js";
import { sendSupervisorFrameAndWait } from "../../src/supervisorIpc.js";
import { settleTier1StartupFailure } from "../../src/startupFailure.js";

function sample(kind: string): unknown {
  if (kind === "error") return new Error("SECRET");
  if (kind === "aggregate") return new AggregateError([new Error("SECRET")], "SECRET");
  if (kind === "accessor") {
    const err = new Error("init");
    Object.defineProperty(err, "message", {
      get(): string {
        return "SECRET";
      }
    });
    return err;
  }
  if (kind === "proxy") {
    return new Proxy(new Error("SECRET"), {
      get() {
        return "SECRET";
      }
    });
  }
  if (kind === "revoked") {
    const revoked = Proxy.revocable(new Error("SECRET"), {
      get() {
        throw new TypeError("revoked");
      }
    });
    revoked.revoke();
    return revoked.proxy;
  }
  if (kind === "function") return () => "SECRET";
  if (kind === "symbol") return Symbol("SECRET");
  if (kind === "bigint") return 1n;
  if (kind === "primitive") return "SECRET";
  return new Error("SECRET");
}

function cleanupWork(kind: string): Promise<unknown> {
  if (kind === "ok") return Promise.resolve();
  if (kind === "reject") return Promise.reject(new Error("SECRET"));
  if (kind === "completion") return Promise.all([Promise.reject(new Error("SECRET")), Promise.resolve()]);
  if (kind === "wait") return Promise.all([Promise.resolve(), Promise.reject(new Error("SECRET"))]);
  if (kind === "aggregate") return Promise.reject(new AggregateError([new Error("SECRET")], "SECRET"));
  if (kind === "hang") return new Promise(() => undefined);
  if (kind === "late") {
    return new Promise((_resolve, reject) => {
      setTimeout(() => reject(new Error("SECRET")), 200);
    });
  }
  return Promise.resolve();
}

const home = process.env["SAYDO_HOME"];
if (!home) {
  process.exit(2);
}
const sampleKind = process.env["SAYDO_SAMPLE"] ?? "error";
const cleanupKind = process.env["SAYDO_CLEANUP"] ?? "ok";
const deadlineMs = Number(process.env["SAYDO_CLEANUP_MS"] ?? "80");

mkdirSync(join(home, "tier1", "runs", "run_keep"), { recursive: true, mode: 0o700 });
const ownerPath = join(home, "tier1", "runs", "run_keep", "agent-owner.json");
writeFileSync(ownerPath, JSON.stringify({
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

const log = createLogger({ dir: join(home, "logs"), name: "startup-fatal" });
const audit = createFileAuditSink(join(home, "audit", "daemon.jsonl"));
const rejections: unknown[] = [];
process.on("unhandledRejection", (reason) => {
  rejections.push(reason);
});

const outcome = await settleTier1StartupFailure(
  sample(sampleKind),
  cleanupWork(cleanupKind),
  {
    closeGate: async () => undefined,
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
  },
  cleanupKind === "ok" ? 1_000 : deadlineMs
);

if (rejections.length > 0) process.exit(9);
if (outcome === "executor-disabled") process.exit(3);
process.exit(1);
