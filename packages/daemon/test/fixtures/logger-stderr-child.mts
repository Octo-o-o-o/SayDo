import { createLogger } from "../../src/obs/logger.js";

const dir = process.argv[2];
if (!dir) throw new Error("missing logger dir");

const log = createLogger({
  dir,
  name: "probe",
  flushOnExit: false,
  appendImpl: async () => {}
});

process.on("uncaughtExceptionMonitor", (error: NodeJS.ErrnoException) => {
  process.stdout.write(`${JSON.stringify({ observedError: error.code ?? error.message })}\n`);
});

process.stdout.write("READY\n");

setTimeout(() => {
  log.info("after reader closed");
  setTimeout(() => {
    process.stdout.write("SURVIVED\n");
    process.exit(0);
  }, 80);
}, 80);
