// C4 RP 编译器 + 纯函数 renderer(方案 §3.1)。
// 只存 typed IR(factsJson);Markdown 读取时派生。模型摘要段 v0=确定性模板,origin 标注,不接真实 LLM。

import {
  jcsDigest,
  computeObligationsDigest,
  rpFactSchema,
  focusResumePacketSchema,
  type RpFact,
  type FocusResumePacket,
  type FocusObligation
} from "@saydo/contracts";
import type { Db } from "../storage/db.js";
import { withFocusWriteTx, FocusWriteError } from "./writeTx.js";
import { listOpenObligations, buildObligationsSnapshot } from "./obligations.js";
import { readFocus } from "./writeTx.js";

export const RP_COMPILER_VERSION = "rp-compiler/v0.1";
export const RP_RENDERER_VERSION = "rp-renderer/v0.1";

export interface CompileRpInput {
  focusId: string;
  /** 事件 seq 闭区间 [from, to];省略则 1..MAX */
  eventSeqRange?: [number, number];
  transcriptRefs?: Array<{
    sessionId: string;
    turnRange: [string, string];
    digest: string;
    /** 可选失败轨迹原文(仅入 history 蒸馏层) */
    failureTraces?: Array<{ category: string; lesson: string; turnRef?: string }>;
  }>;
  /** 显式冲突对:两观察并列(CL-C2/V5) */
  conflicts?: Array<{ factA: Omit<RpFact, "factId" | "conflict">; factB: Omit<RpFact, "factId" | "conflict">; note: string }>;
}

export interface CompileRpResult {
  packet: FocusResumePacket;
}

/**
 * 完整性断言:seq 无空洞 / obligationsDigest 与现势一致。
 * 失败轨迹只入 history 蒸馏;actionable 禁带原始错误输出。
 */
export function compileResumePacket(db: Db, input: CompileRpInput): CompileRpResult {
  return withFocusWriteTx(db, {}, (ops) => {
    const focus = ops.getFocus(input.focusId);
    const maxSeq = maxEventSeq(db, input.focusId);
    const range: [number, number] = input.eventSeqRange ?? [maxSeq === 0 ? 0 : 1, maxSeq];
    assertSeqContiguous(db, input.focusId, range);

    const openObs = listOpenObligations(db, input.focusId);
    const obligationsDigest = computeObligationsDigest(
      openObs.map((o) => ({
        id: o.id,
        status: o.status,
        verification: o.verification,
        owner: o.owner,
        kind: o.kind,
        dedupeKey: o.dedupeKey,
        ...(o.resolution ? { resolution: o.resolution } : {})
      }))
    );

    const snapshot = buildObligationsSnapshot(openObs, { openOnly: true });
    const obligationsSnapshotJson = JSON.stringify(snapshot);

    const facts: RpFact[] = [];
    let factN = 0;
    const nextId = (prefix: string) => `${prefix}-${++factN}`;

    // history:确定性方向摘要(模板,origin=deterministic)
    facts.push(
      rpFactSchema.parse({
        factId: nextId("hist"),
        layer: "history",
        text: `方向基线 r${focus.current_revision}:权威=${focus.semantic_authority},epoch=${focus.authority_epoch}`,
        sourceRefs: [{ kind: "focus_event", ref: `focus:${input.focusId}:rev:${focus.current_revision}` }],
        origin: "deterministic"
      })
    );

    // 失败轨迹蒸馏 → 仅 history
    for (const tr of input.transcriptRefs ?? []) {
      for (const ft of tr.failureTraces ?? []) {
        facts.push(
          rpFactSchema.parse({
            factId: nextId("fail"),
            layer: "history",
            text: `蒸馏教训[${ft.category}]:${ft.lesson}`,
            sourceRefs: [
              {
                kind: "transcript_turn",
                ref: ft.turnRef ?? `${tr.sessionId}:${tr.turnRange[0]}`
              }
            ],
            origin: "deterministic"
          })
        );
      }
    }

    // actionable:每条未结义务
    const nowIso = ops.nowIso;
    for (const o of openObs) {
      facts.push(
        rpFactSchema.parse({
          factId: nextId("act"),
          layer: "actionable",
          text: `${o.kind}/${o.owner}:${o.title}${o.nextStep ? ` → ${o.nextStep}` : ""}`,
          asOf: o.updatedAt,
          sourceRefs: [{ kind: "obligation", ref: o.id }],
          origin: "deterministic"
        })
      );
    }

    // needs_confirmation:provisional/unverified
    for (const o of openObs.filter((x) => x.verification === "provisional" || x.verification === "unverified")) {
      facts.push(
        rpFactSchema.parse({
          factId: nextId("nc"),
          layer: "needs_confirmation",
          text: `待确认(${o.verification}):${o.title}`,
          asOf: nowIso,
          sourceRefs: [{ kind: "obligation", ref: o.id }],
          origin: "deterministic"
        })
      );
    }

    // 冲突并列(V5 CL-C2)
    for (const c of input.conflicts ?? []) {
      const idA = nextId("cf");
      const idB = nextId("cf");
      facts.push(
        rpFactSchema.parse({
          ...c.factA,
          factId: idA,
          conflict: { withFactId: idB, note: c.note }
        })
      );
      facts.push(
        rpFactSchema.parse({
          ...c.factB,
          factId: idB,
          conflict: { withFactId: idA, note: c.note }
        })
      );
    }

    // 模型摘要段 v0=确定性模板,标 origin=model_summary,必须带 sourceRefs
    const summarySources: Array<{ kind: "obligation" | "focus_event"; ref: string }> = openObs
      .slice(0, 3)
      .map((o) => ({ kind: "obligation" as const, ref: o.id }));
    if (summarySources.length === 0) {
      summarySources.push({ kind: "focus_event", ref: `focus:${input.focusId}:rev:${focus.current_revision}` });
    }
    facts.push(
      rpFactSchema.parse({
        factId: nextId("sum"),
        layer: "history",
        text: `摘要(模板):当前未结义务 ${openObs.length} 项;基线 revision=${focus.current_revision},watermark=${range[1]}`,
        sourceRefs: summarySources,
        origin: "model_summary"
      })
    );

    // actionable 不得含原始失败输出(蒸馏已在 history)
    for (const f of facts) {
      if (f.layer === "actionable" && /原始错误|stack trace|Traceback/i.test(f.text)) {
        throw new FocusWriteError("rp_actionable_failure_leak", "actionable layer must not carry raw failure output");
      }
    }

    const factsJson = JSON.stringify(facts);
    const compiledFrom = {
      eventSeqRange: range,
      transcriptRefs: (input.transcriptRefs ?? []).map((t) => ({
        sessionId: t.sessionId,
        turnRange: t.turnRange,
        digest: t.digest
      }))
    };
    const baseline = {
      revision: Math.max(1, focus.current_revision),
      eventHighWatermark: range[1],
      obligationsDigest
    };
    const inputDigest = jcsDigest({
      focusId: input.focusId,
      baseline,
      compiledFrom,
      factsJson,
      obligationsSnapshotJson,
      compilerVersion: RP_COMPILER_VERSION
    });
    const digest = jcsDigest({
      factsJson,
      obligationsSnapshotJson,
      baseline,
      compiledFrom,
      compilerVersion: RP_COMPILER_VERSION,
      rendererVersion: RP_RENDERER_VERSION,
      inputDigest
    });

    // revision 用 focus.current_revision(packet 按 revision 冻结;同 revision 重编译拒)
    const packetRevision = Math.max(1, focus.current_revision);
    const existing = db
      .prepare("SELECT focus_id FROM focus_resume_packets WHERE focus_id = ? AND revision = ?")
      .get(input.focusId, packetRevision) as { focus_id: string } | undefined;
    if (existing) {
      throw new FocusWriteError("rp_revision_exists", `packet already frozen for revision ${packetRevision}`);
    }

    const createdAt = ops.nowIso;
    db.prepare(
      `INSERT INTO focus_resume_packets(
        focus_id, revision, baseline_revision, baseline_event_high_watermark, baseline_obligations_digest,
        compiled_from_json, compiler_version, renderer_version, input_digest, facts_json,
        obligations_snapshot_json, digest, created_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(
      input.focusId,
      packetRevision,
      baseline.revision,
      baseline.eventHighWatermark,
      baseline.obligationsDigest,
      JSON.stringify(compiledFrom),
      RP_COMPILER_VERSION,
      RP_RENDERER_VERSION,
      inputDigest,
      factsJson,
      obligationsSnapshotJson,
      digest,
      createdAt
    );

    ops.appendEvent(input.focusId, {
      type: "packet_frozen",
      payload: { revision: packetRevision, digest },
      actorKind: "daemon"
    });

    const packet = focusResumePacketSchema.parse({
      focusId: input.focusId,
      revision: packetRevision,
      baseline,
      compiledFrom,
      compilerVersion: RP_COMPILER_VERSION,
      rendererVersion: RP_RENDERER_VERSION,
      inputDigest,
      factsJson,
      obligationsSnapshotJson,
      digest,
      createdAt
    });
    return { packet };
  });
}

function maxEventSeq(db: Db, focusId: string): number {
  const r = db.prepare("SELECT MAX(seq) AS m FROM focus_events WHERE focus_id = ?").get(focusId) as {
    m: number | null;
  };
  return r.m ?? 0;
}

function assertSeqContiguous(db: Db, focusId: string, range: [number, number]): void {
  const [from, to] = range;
  if (from === 0 && to === 0) return;
  if (from < 1 || to < from) {
    throw new FocusWriteError("rp_seq_range", `invalid eventSeqRange [${from},${to}]`);
  }
  const rows = db
    .prepare("SELECT seq FROM focus_events WHERE focus_id = ? AND seq >= ? AND seq <= ? ORDER BY seq")
    .all(focusId, from, to) as { seq: number }[];
  if (rows.length !== to - from + 1) {
    throw new FocusWriteError(
      "rp_seq_gap",
      `event seq gap or missing in [${from},${to}]: got ${rows.length} rows, expected ${to - from + 1}`
    );
  }
  for (let i = 0; i < rows.length; i++) {
    if (rows[i]!.seq !== from + i) {
      throw new FocusWriteError("rp_seq_gap", `event seq hole at expected ${from + i}, got ${rows[i]!.seq}`);
    }
  }
}

/**
 * 纯函数 renderer:同输入逐字节相同(V5 幂等)。
 * 三层结构 + 条件性停点话术。
 */
export function renderResumePacketMarkdown(
  factsJson: string,
  obligationsSnapshotJson: string,
  rendererVersion: string = RP_RENDERER_VERSION
): string {
  const facts = (JSON.parse(factsJson) as unknown[]).map((f) => rpFactSchema.parse(f));
  const snapshot = JSON.parse(obligationsSnapshotJson) as Array<{
    id: string;
    title: string;
    owner: string;
    status: string;
    nextStep?: string;
  }>;

  const history = facts.filter((f) => f.layer === "history");
  const actionable = facts.filter((f) => f.layer === "actionable");
  const needs = facts.filter((f) => f.layer === "needs_confirmation");

  const lines: string[] = [];
  lines.push(`# Focus Resume Packet`);
  lines.push(`renderer: ${rendererVersion}`);
  lines.push("");
  lines.push("## History");
  for (const f of history) {
    const origin = f.origin === "model_summary" ? " [model_summary]" : "";
    lines.push(`- ${f.text}${origin}`);
  }
  lines.push("");
  lines.push("## Actionable");
  for (const f of actionable) {
    const conf = f.conflict ? ` (conflict with ${f.conflict.withFactId}: ${f.conflict.note})` : "";
    lines.push(`- [${f.asOf ?? ""}] ${f.text}${conf}`);
  }
  lines.push("");
  lines.push("## Needs Confirmation");
  for (const f of needs) {
    lines.push(`- ${f.text}`);
  }
  lines.push("");
  lines.push("## Obligations Snapshot");
  for (const o of snapshot) {
    lines.push(`- ${o.id} ${o.owner}/${o.status}: ${o.title}${o.nextStep ? ` | next=${o.nextStep}` : ""}`);
  }

  // 条件性停点
  const canAct = actionable.filter((f) => !f.conflict).map((f) => f.factId);
  const wait = needs.map((f) => f.factId);
  const conflictIds = actionable.filter((f) => f.conflict).map((f) => f.factId);
  lines.push("");
  lines.push("## Conditional Stop");
  if (canAct.length > 0 && wait.length === 0 && conflictIds.length === 0) {
    lines.push(`${canAct.join("、")} 可依据当前材料行动。`);
  } else if (canAct.length > 0 && (wait.length > 0 || conflictIds.length > 0)) {
    const waitPart = wait.length > 0 ? `${wait.join("、")} 待回读确认` : "";
    const confPart = conflictIds.length > 0 ? `${conflictIds.join("、")} 冲突并列未择` : "";
    const rest = [waitPart, confPart].filter(Boolean).join(";");
    lines.push(`${canAct.join("、")} 可依据当前材料行动,${rest}。`);
  } else if (wait.length > 0 || conflictIds.length > 0) {
    lines.push(`当前无稳妥可行动项;${[...wait, ...conflictIds].join("、")} 需确认后再推进。`);
  } else {
    lines.push("当前无未结行动项。");
  }

  return lines.join("\n");
}

export function getResumePacket(db: Db, focusId: string, revision: number): FocusResumePacket | null {
  const row = db
    .prepare("SELECT * FROM focus_resume_packets WHERE focus_id = ? AND revision = ?")
    .get(focusId, revision) as
    | {
        focus_id: string;
        revision: number;
        baseline_revision: number;
        baseline_event_high_watermark: number;
        baseline_obligations_digest: string;
        compiled_from_json: string;
        compiler_version: string;
        renderer_version: string;
        input_digest: string;
        facts_json: string;
        obligations_snapshot_json: string;
        digest: string;
        created_at: string;
      }
    | undefined;
  if (!row) return null;
  const compiledFrom = JSON.parse(row.compiled_from_json) as FocusResumePacket["compiledFrom"];
  return focusResumePacketSchema.parse({
    focusId: row.focus_id,
    revision: row.revision,
    baseline: {
      revision: row.baseline_revision,
      eventHighWatermark: row.baseline_event_high_watermark,
      obligationsDigest: row.baseline_obligations_digest
    },
    compiledFrom,
    compilerVersion: row.compiler_version,
    rendererVersion: row.renderer_version,
    inputDigest: row.input_digest,
    factsJson: row.facts_json,
    obligationsSnapshotJson: row.obligations_snapshot_json,
    digest: row.digest,
    createdAt: row.created_at
  });
}

/** 读取时派生 Markdown(不落库) */
export function renderStoredPacket(db: Db, focusId: string, revision: number): string | null {
  const p = getResumePacket(db, focusId, revision);
  if (!p) return null;
  return renderResumePacketMarkdown(p.factsJson, p.obligationsSnapshotJson, p.rendererVersion);
}

// silence unused in case tree-shaking; re-export helper
export function currentFocusRevision(db: Db, focusId: string): number {
  return readFocus(db, focusId)?.currentRevision ?? 0;
}

export type { FocusObligation };
