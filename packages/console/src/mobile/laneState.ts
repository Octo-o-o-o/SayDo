import type { FourStateCounts, MobileObligation } from "./types";

export type LaneState = keyof FourStateCounts;

export function obligationLaneState(obligation: MobileObligation): LaneState {
  if (obligation.status === "resolved" || obligation.status === "superseded") return "settled";
  if (obligation.status === "blocked" || obligation.owner === "human") return "needsYou";
  if (obligation.status === "in_progress") return "running";
  return "queued";
}

export function countLaneStates(obligations: readonly MobileObligation[]): FourStateCounts {
  const counts: FourStateCounts = { queued: 0, running: 0, needsYou: 0, settled: 0 };
  for (const obligation of obligations) counts[obligationLaneState(obligation)] += 1;
  return counts;
}
