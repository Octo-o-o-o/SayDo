// 机械维验证器(09 §4.1;daemon 侧):integrity(字节一致)/ freshness(现读比对)/ quoteMatch(归一化子串)。
// 语义维(semanticSupport)由深评层给出;critical-support 资格 = contracts 纯函数派生(criticalSupportHolds)。

import { existsSync, readFileSync } from "node:fs";
import {
  textDigest,
  type ClaimSourceVerification,
  type SourceSnapshot,
  type VerifiedExcerpt
} from "@saydo/contracts";

/** 归一化(空白折叠;04 §2.2-5 quote 比对口径) */
function norm(s: string): string {
  return s.replace(/\s+/g, "");
}

export interface VerifyInput {
  claimDigest: string;
  snapshot: SourceSnapshot;
  quote?: string;
  /** 上游提供的既有 excerpt(EvidenceBinding.excerpt):按 range 从 bodyPath 重取比 excerptDigest(评审 B-2) */
  excerpt?: VerifiedExcerpt;
}

/** 机械三维验证(不含语义维;semanticSupport 由深评层填) */
export function verifyBinding(input: VerifyInput): ClaimSourceVerification {
  const { snapshot } = input;

  // integrity:快照正文重校 contentDigest(含 excerpt range 重取,见下)
  let body: string | undefined;
  let integrity: ClaimSourceVerification["integrity"];
  if (!existsSync(snapshot.bodyPath)) {
    integrity = "snapshot_missing";
  } else {
    body = readFileSync(snapshot.bodyPath, "utf8");
    integrity = textDigest(body) === snapshot.contentDigest ? "intact" : "digest_mismatch";
  }

  // freshness:liveLocator 现读 digest 与快照比对;不可达/被删 ⇒ stale + reason
  let freshness: ClaimSourceVerification["freshness"] = "fresh";
  let reason: string | undefined;
  try {
    const live = readLive(snapshot);
    if (textDigest(live) !== snapshot.contentDigest) {
      freshness = "stale";
      reason = "source changed since capture";
    }
  } catch (err) {
    freshness = "stale";
    reason = `live source unreachable: ${String(err).slice(0, 80)}`;
  }

  // 上游 excerpt 校验(B-2):按 range 从快照正文重取,digest 不符 ⇒ integrity 失败(真校验,非同源自比)
  if (input.excerpt !== undefined && body !== undefined) {
    if (input.excerpt.snapshotId !== snapshot.id) {
      integrity = "digest_mismatch";
    } else {
      const buf = Buffer.from(body, "utf8");
      const retaken = buf.subarray(input.excerpt.range.startByte, input.excerpt.range.endByte).toString("utf8");
      if (textDigest(retaken) !== input.excerpt.excerptDigest) integrity = "digest_mismatch";
    }
  }

  // quoteMatch + excerpt 切取(daemon 从快照正文定位 quote;上游 excerpt 的 text 可充当 quote 载体)
  const effectiveQuote = input.quote ?? input.excerpt?.text;
  let quoteMatch: ClaimSourceVerification["quoteMatch"] = "evidence_missing";
  let excerpt: VerifiedExcerpt | undefined = input.excerpt;
  if (effectiveQuote !== undefined && effectiveQuote.trim() !== "" && body !== undefined) {
    if (norm(body).includes(norm(effectiveQuote))) {
      quoteMatch = "match";
      excerpt = input.excerpt ?? cutExcerpt(snapshot.id, body, effectiveQuote);
    } else {
      quoteMatch = "mismatch";
    }
  }

  return {
    claimDigest: input.claimDigest,
    snapshotId: snapshot.id,
    ...(excerpt ? { excerpt } : {}),
    integrity,
    freshness,
    quoteMatch,
    ...(reason ? { reason } : {})
  };
}

function readLive(snapshot: SourceSnapshot): string {
  if (snapshot.source.kind === "user_utterance") {
    // 转写 append-only:按 turnId 重扫 jsonl,JSON.parse 后比 turn.text(评审 B-3:
    // 原文与 JSON 转义行做 includes 会对含引号/换行的文本永久假 stale)
    const body = readFileSync(snapshot.bodyPath, "utf8");
    for (const line of readFileSync(snapshot.liveLocator, "utf8").split("\n")) {
      if (line.trim() === "") continue;
      try {
        const turn = JSON.parse(line) as { turnId?: string; text?: string };
        if (turn.turnId === snapshot.source.ref) return turn.text === body ? body : "__transcript_text_changed__";
      } catch {
        continue;
      }
    }
    return "__transcript_line_missing__";
  }
  // repo_file / user_edit:liveLocator 已是纯文件路径(评审 B-8:不再 split("@"),防文件名含 @ 误裁)
  return readFileSync(snapshot.liveLocator, "utf8");
}

/** 从快照正文切取 quote 所在最小行窗(供 evaluator 语义判断的上下文) */
function cutExcerpt(snapshotId: string, body: string, quote: string): VerifiedExcerpt | undefined {
  const nq = norm(quote);
  const lines = body.split("\n");
  // 找包含归一化 quote 的最小连续行窗(从每行起点扫)
  for (let i = 0; i < lines.length; i++) {
    let acc = "";
    for (let j = i; j < lines.length && j < i + 20; j++) {
      acc += (j > i ? "\n" : "") + lines[j];
      if (norm(acc).includes(nq)) {
        const buf = Buffer.from(body, "utf8");
        const before = lines.slice(0, i).join("\n");
        const startByte = i === 0 ? 0 : Buffer.byteLength(before, "utf8") + 1;
        const endByte = startByte + Buffer.byteLength(acc, "utf8");
        const text = buf.subarray(startByte, endByte).toString("utf8");
        return { snapshotId, range: { startByte, endByte }, text, excerptDigest: textDigest(text) };
      }
    }
  }
  return undefined;
}
