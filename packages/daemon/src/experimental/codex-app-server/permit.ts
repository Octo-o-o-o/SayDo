import { EFFECT_BOUNDARY } from "./provenance.js";

const PERMIT_BRAND = Symbol("codex-as-spike-experiment-permit");

export interface ExperimentPermit {
  readonly brand: typeof PERMIT_BRAND;
  readonly model: string;
  readonly effectBoundary: typeof EFFECT_BOUNDARY;
  readonly maxTurns: number;
  readonly wallMs: number;
  readonly deadlineMs: number;
}

export interface ExperimentRequest {
  enabled: boolean;
  model: string;
  effectBoundary: string;
  maxTurns: number;
  wallMs: number;
}

export function issueExperimentPermit(
  input: ExperimentRequest,
  now: number
): { ok: true; permit: ExperimentPermit } | { ok: false; reason: string } {
  if (input.enabled !== true) return { ok: false, reason: "experiment_disabled" };
  if (input.effectBoundary !== EFFECT_BOUNDARY) return { ok: false, reason: "effect_boundary" };
  const model = input.model;
  if (typeof model !== "string" || model.length === 0 || model.length > 200 || model.trim() !== model || model.includes("\n")) {
    return { ok: false, reason: "model_required" };
  }
  if (!Number.isInteger(input.maxTurns) || input.maxTurns < 1 || input.maxTurns > 3) {
    return { ok: false, reason: "max_turns" };
  }
  if (!Number.isInteger(input.wallMs) || input.wallMs < 1000 || input.wallMs > 120_000) {
    return { ok: false, reason: "wall_ms" };
  }
  return {
    ok: true,
    permit: {
      brand: PERMIT_BRAND,
      model,
      effectBoundary: EFFECT_BOUNDARY,
      maxTurns: input.maxTurns,
      wallMs: input.wallMs,
      deadlineMs: now + input.wallMs
    }
  };
}

export function isExperimentPermit(value: unknown): value is ExperimentPermit {
  if (value === null || typeof value !== "object") return false;
  return (value as { brand?: unknown }).brand === PERMIT_BRAND;
}
