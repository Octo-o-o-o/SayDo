// 桩 Context Pack(1.3b;B1 确定性编译在 2.2 落地)。P0 Phase 1 用最小桩支撑对话引擎接线。

import { computePackDigest, type ContextSnapshot } from "@saydo/contracts";

export function stubContextPack(i: { sessionId: string; projectId: string; topicTerms?: string[] }): ContextSnapshot {
  const body = {
    compilerVersion: "b1-stub-0",
    memoryGeneration: 0,
    topicTerms: (i.topicTerms ?? []).map((t) => t.toLowerCase()).sort(),
    budgets: { M0: 200, M1: 1200, M2: 800, M3: 800 },
    slices: [] as {
      tier: "M0" | "M1" | "M2" | "M3";
      refs: string[];
      tokens: number;
      segment: "stable" | "topical";
    }[],
    excluded: [] as { ref: string; reason: string }[]
  };
  return { ...body, packDigest: computePackDigest(body), sessionId: i.sessionId, projectId: i.projectId };
}
