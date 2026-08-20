import {
  checklistDigestOf,
  readinessDimsDigest,
  readinessEvidenceDigest,
  type ProjectType,
  type ReadinessEvidenceDetail
} from "@saydo/contracts";
import type { ReadinessGateResult } from "../evaluator/readinessGate.js";
import type { Db } from "../storage/db.js";
import { anchorRebuildState, isAnchorRebuilt, markAnchorRebuilt } from "./anchor.js";

export interface AnchorRebuildDeps {
  db: Db;
  assembleReadiness: (sessionId: string, projectId: string) => ReadinessGateResult;
  readinessEvidence: (sessionId: string, projectId: string) => ReadinessEvidenceDetail;
  rebuildPack: (input: {
    sessionId: string;
    projectId: string;
    projectRevision: number;
  }) => boolean;
  warn: (message: string, fields: Record<string, unknown>) => void;
}

/** 追平项目改锚后的 readiness/Pack durable revision；任一产物不匹配都不推进 CAS。 */
export function ensureProjectAnchorProducts(deps: AnchorRebuildDeps, sessionId: string): boolean {
  let state = anchorRebuildState(deps.db, sessionId);
  if (!state || state.projectRevision === 0) return true;
  const expected = {
    sessionId,
    projectId: state.projectId,
    projectRevision: state.projectRevision
  };
  if (state.readinessRevision < state.projectRevision) {
    try {
      const result = deps.assembleReadiness(sessionId, state.projectId);
      const project = deps.db.prepare("SELECT type FROM projects WHERE id=?").get(state.projectId) as
        | { type: ProjectType }
        | undefined;
      const evidence = deps.readinessEvidence(sessionId, state.projectId);
      const assessment = deps.db
        .prepare("SELECT session_id FROM readiness_assessments WHERE id=?")
        .get(result.ref.assessmentId) as { session_id: string } | undefined;
      if (
        !project ||
        assessment?.session_id !== sessionId ||
        result.ref.checklistDigest !== (checklistDigestOf(project.type) ?? "none") ||
        result.ref.evidenceDigest !== readinessEvidenceDigest(evidence.bindings) ||
        result.ref.dimsDigest !== readinessDimsDigest(result.dims)
      ) {
        throw new Error("readiness_rebuild_product_mismatch");
      }
      markAnchorRebuilt({ db: deps.db, ...expected, kind: "readiness" });
    } catch (err) {
      deps.warn("project anchor readiness rebuild failed", {
        code: err instanceof Error ? err.name : "unknown",
        projectRevision: state.projectRevision
      });
    }
  }
  state = anchorRebuildState(deps.db, sessionId);
  if (!state || state.projectId !== expected.projectId || state.projectRevision !== expected.projectRevision) {
    return false;
  }
  if (state.packRevision < state.projectRevision) {
    try {
      if (deps.rebuildPack(expected)) {
        markAnchorRebuilt({ db: deps.db, ...expected, kind: "pack" });
      }
    } catch (err) {
      deps.warn("project anchor context pack rebuild failed", {
        code: err instanceof Error ? err.name : "unknown",
        projectRevision: state.projectRevision
      });
    }
  }
  const current = anchorRebuildState(deps.db, sessionId);
  return !!current && current.projectId === expected.projectId && isAnchorRebuilt(current);
}
