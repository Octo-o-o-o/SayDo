import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { setDaemonStartupHooks } from "../../src/daemonStartupHooks.js";

const recoverHold = new Promise<void>(() => undefined);

setDaemonStartupHooks({
  recoverHold,
  onRecoverEntered() {
    const home = process.env["SAYDO_HOME"];
    if (home) writeFileSync(join(home, "recover-entered.marker"), "1", { mode: 0o600 });
    process.send?.({ v: 1, t: "recover-entered" });
  },
  beforeRecover() {
    // recover-attempt 必须在 recover() 内部 hold 被 shutdown 取消后仍为 0
  },
  onRecoverAttempt() {
    const home = process.env["SAYDO_HOME"];
    if (!home) return;
    writeFileSync(join(home, "recover-attempt.marker"), "1", { mode: 0o600 });
    process.send?.({ v: 1, t: "test-recover-attempt" });
  }
});
