/** daemon 正常 shutdown 与 unsupervised restart 共用的一次性单调总 deadline。 */

import { assertByoaShutdownAllowsStopped } from "./providers/byoa/provider.js";
import { ProcessGroupLifecycleError } from "./processGroupLifecycle.js";
import { assertRuntimeChildShutdownAllowsStopped } from "./runtimeChildRegistry.js";
import {
  setIndependentDeadlineTestHooks,
  type IndependentDeadlineHooks
} from "./independentDeadline.js";

export {
  DAEMON_SHUTDOWN_DEADLINE_MS,
  INDEPENDENT_DEADLINE_PREFIX,
  IndependentDeadlineError,
  TIER1_EMERGENCY_CLEANUP_DEADLINE_MS,
  isIndependentDeadlineError,
  performEmergencyCleanup,
  raceWithMonotonicDeadline
} from "./independentDeadline.js";

export function assertShutdownExactEmpty(
  home: string,
  tier1Contamination?: ProcessGroupLifecycleError | null
): void {
  if (tier1Contamination) throw tier1Contamination;
  assertByoaShutdownAllowsStopped();
  assertRuntimeChildShutdownAllowsStopped(home);
}

export type ShutdownDeadlineHooks = IndependentDeadlineHooks;

export function setShutdownDeadlineTestHooks(hooks: ShutdownDeadlineHooks | null): void {
  setIndependentDeadlineTestHooks(hooks);
}
