import { setDaemonStartupHooks } from "../../src/daemonStartupHooks.js";

const listenHold = new Promise<void>(() => undefined);

setDaemonStartupHooks({
  listenHold,
  onListening() {
    process.send?.({ v: 1, t: "listen-entered" });
  },
  afterNoteShutdown(api) {
    const stolen = api.claimRestart();
    process.send?.({ v: 1, t: "restart-steal", stolen });
  }
});
