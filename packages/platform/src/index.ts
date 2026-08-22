export { hostKind, homeDir, pathDelimiter, type HostKind } from "./host.js";
export {
  assertOwnedByCurrentUser,
  assertRealDirectory,
  fsIdentity,
  isReparsePoint,
  fsyncFile,
  restrictOwnerOnly,
  setRestrictOwnerOnlyForTests,
  type FsIdentity,
  type RestrictOwnerOnly
} from "./fs.js";
export {
  assignPidToJob,
  closeNamedJob,
  createNamedJob,
  killOwnedTree,
  processAlive,
  processBirth,
  type KillClaim,
  type NamedJob
} from "./process.js";
export { acquireExclusiveLink } from "./lock.js";
export {
  GATE_HMAC_HEADER,
  gateBindPath,
  gateDir,
  gateSecretPath,
  hmacHeaderOk,
  hmacHex,
  listenGateHttp,
  newGateSecret,
  posixGateSockPath,
  writeGateBindAndSecret,
  type GateBind,
  type GateHttpHandler,
  type GateHttpListen
} from "./gate.js";
export { openExternal } from "./open.js";
export { bindNative, nativeReady, nativeSync } from "./win32.js";
