import { setDaemonStartupHooks } from "../../src/daemonStartupHooks.js";

setDaemonStartupHooks({
  closeDurables() {
    throw new Error("SECRET=database-close");
  }
});
