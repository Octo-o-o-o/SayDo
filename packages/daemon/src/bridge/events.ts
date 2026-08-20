// C3 事件消费(P0.5-B;09 §6.3/§12-6):.hopper/events.jsonl 按 byte cursor 断点续读。
// 容错:半行(未完行留待下次)/损坏行(跳过计数)/未知类型(透传不崩)。
// RunSettled 消费 + 廉价复核(按终态拆分,Codex A3 勘误):
//   final_status=review => 必须 evidence_digest 与 review show 一致 且 summary_path(.md)存在;
//   failed/blocked/recovery => 事件本身即 settle 证据,允许 summary 为空,复核降级为投影一致。

import { openSync, readSync, closeSync, fstatSync, existsSync } from "node:fs";
import { runSettledSchema, type RunSettled } from "@saydo/contracts";

export interface HopperEvent {
  type: string;
  task_id?: string;
  run_id?: string;
  event_id?: string;
  payload?: Record<string, unknown>;
  [k: string]: unknown;
}

export interface ReadResult {
  events: HopperEvent[];
  newOffset: number;
  corruptLines: number;
  /** 文件收缩(截断/替换)=identity 变,调用方走全量对账(raw JSONL 无 seq,裁决 §4) */
  fileShrunk: boolean;
}

/** 断点续读(byte offset;半行不消费——留在 offset 前) */
export function readEventsFrom(path: string, offset: number): ReadResult {
  if (!existsSync(path)) return { events: [], newOffset: offset, corruptLines: 0, fileShrunk: false };
  const fd = openSync(path, "r");
  try {
    const size = fstatSync(fd).size;
    if (size < offset) return { events: [], newOffset: 0, corruptLines: 0, fileShrunk: true };
    if (size === offset) return { events: [], newOffset: offset, corruptLines: 0, fileShrunk: false };
    const buf = Buffer.alloc(size - offset);
    readSync(fd, buf, 0, buf.length, offset);
    const text = buf.toString("utf8");
    const lastNl = text.lastIndexOf("\n");
    if (lastNl < 0) return { events: [], newOffset: offset, corruptLines: 0, fileShrunk: false }; // 全是半行
    const complete = text.slice(0, lastNl); // 半行(lastNl 之后)不消费
    const events: HopperEvent[] = [];
    let corrupt = 0;
    for (const line of complete.split("\n")) {
      const t = line.trim();
      if (t === "") continue;
      try {
        const obj = JSON.parse(t) as HopperEvent;
        if (typeof obj["type"] !== "string") {
          corrupt += 1; // 无 type 字段 = 损坏(未知 type 是另一回事:有 type 但不认识 => 透传)
          continue;
        }
        events.push(obj);
      } catch {
        corrupt += 1;
      }
    }
    return { events, newOffset: offset + Buffer.byteLength(complete, "utf8") + 1, corruptLines: corrupt, fileShrunk: false };
  } finally {
    closeSync(fd);
  }
}

// ---- RunSettled 消费 + 廉价复核 ----

export interface SettleCheckDeps {
  /** review show --json 的 evidenceDigest(调用方查;不透明字符串比对,不重算) */
  reviewEvidenceDigest?: string | null;
  /** summary_path 指向的 .md 是否存在 */
  summaryExists?: boolean;
  /** 投影当前状态(failed/blocked 复核降级用) */
  projectionStatus?: string;
}

export type SettleVerdict = { ok: true; finalStatus: RunSettled["final_status"] } | { ok: false; reason: string };

export function consumeRunSettled(ev: HopperEvent, deps: SettleCheckDeps): SettleVerdict {
  if (ev.type !== "RunSettled") return { ok: false, reason: `not RunSettled: ${ev.type}` };
  const parsed = runSettledSchema.safeParse(ev.payload ?? {});
  if (!parsed.success) return { ok: false, reason: "RunSettled payload 不合词表(fail-closed)" };
  const p = parsed.data;
  if (p.final_status === "review") {
    // 廉价复核:单写者自报不当真理
    if (!p.evidence_digest || deps.reviewEvidenceDigest !== p.evidence_digest) {
      return { ok: false, reason: "evidence_digest 与 review show 不一致(不当真理,拒 settle)" };
    }
    if (!p.summary_path || deps.summaryExists !== true) {
      return { ok: false, reason: "summary 缺失(review 终态必须有 walkthrough 载体)" };
    }
    return { ok: true, finalStatus: "review" };
  }
  // failed/blocked(含 recovery 兜底):事件本身即证据,复核降级为投影一致(允许 summary 空)
  if (deps.projectionStatus && deps.projectionStatus !== p.final_status) {
    return { ok: false, reason: `投影(${deps.projectionStatus})与 RunSettled(${p.final_status})不一致,先对账` };
  }
  return { ok: true, finalStatus: p.final_status };
}
