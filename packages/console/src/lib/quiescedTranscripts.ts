// 09 §10.1.8:旧稿 sessionStorage 队列.写入成功后才 ACK;采用/丢弃只消费本地稿.

export type QuiescedTranscript = {
  sessionId: string;
  requestId: string;
  turnId: string;
  text: string;
  captureMode: "ptt" | "hands_free";
  captureId?: string;
  captureIntent?: "send" | "edit";
  sourceFocusId?: string;
};

export function quiescedTranscriptKey(sessionId: string): string {
  return `saydo.chat.quiescedTranscripts.${sessionId}`;
}

function readQueue(
  storage: Pick<Storage, "getItem">,
  sessionId: string
): { ok: true; rows: QuiescedTranscript[] } | { ok: false } {
  try {
    const raw = storage.getItem(quiescedTranscriptKey(sessionId));
    if (raw === null) return { ok: true, rows: [] };
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { ok: false };
    const valid = parsed.every((item) => item && typeof item === "object" &&
      item.sessionId === sessionId && typeof item.requestId === "string" &&
      typeof item.turnId === "string" && typeof item.text === "string" && item.text.trim() !== "");
    return valid ? { ok: true, rows: parsed as QuiescedTranscript[] } : { ok: false };
  } catch {
    return { ok: false };
  }
}

export function readQuiescedTranscripts(
  storage: Pick<Storage, "getItem">,
  sessionId: string
): QuiescedTranscript[] {
  const read = readQueue(storage, sessionId);
  return read.ok ? read.rows : [];
}

export function upsertQuiescedTranscript(
  storage: Pick<Storage, "getItem" | "setItem">,
  item: QuiescedTranscript
): boolean {
  const read = readQueue(storage, item.sessionId);
  if (!read.ok) return false;
  const list = read.rows;
  if (list.some((row) => row.requestId === item.requestId && row.turnId === item.turnId)) {
    return true;
  }
  try {
    storage.setItem(quiescedTranscriptKey(item.sessionId), JSON.stringify([...list, item]));
    return true;
  } catch {
    return false;
  }
}

export function planAdoptQuiescedDraft(
  current: string,
  incoming: string
): { action: "fill"; next: string } | { action: "confirm"; append: string; replace: string } {
  if (current.trim() === "") return { action: "fill", next: incoming };
  return {
    action: "confirm",
    append: `${current.trimEnd()}\n${incoming}`,
    replace: incoming
  };
}

export function removeQuiescedTranscript(
  storage: Pick<Storage, "getItem" | "setItem">,
  sessionId: string,
  requestId: string,
  turnId: string
): boolean {
  const read = readQueue(storage, sessionId);
  if (!read.ok) return false;
  const next = read.rows.filter(
    (row) => !(row.requestId === requestId && row.turnId === turnId)
  );
  try {
    storage.setItem(quiescedTranscriptKey(sessionId), JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

export const PENDING_TURN_TEXT_PREFIX = "saydo.chat.pendingTurnText.";

export type PendingTurnText = {
  turnId: string;
  text: string;
  daemonEpoch: string;
  receiptAction: "submit" | "replay" | "retry";
};

export function pendingTurnTextKey(sessionId: string): string {
  return `${PENDING_TURN_TEXT_PREFIX}${sessionId}`;
}

export function readPendingTurnText(
  storage: Pick<Storage, "getItem">,
  sessionId: string
): PendingTurnText | null {
  try {
    const raw = storage.getItem(pendingTurnTextKey(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingTurnText>;
    if (!parsed.turnId || !parsed.text || !parsed.daemonEpoch || !parsed.receiptAction) return null;
    return parsed as PendingTurnText;
  } catch {
    return null;
  }
}

export function writePendingTurnText(
  storage: Pick<Storage, "setItem">,
  sessionId: string,
  payload: PendingTurnText
): boolean {
  try {
    storage.setItem(pendingTurnTextKey(sessionId), JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function clearPendingTurnText(storage: Pick<Storage, "removeItem">, sessionId: string): void {
  try {
    storage.removeItem(pendingTurnTextKey(sessionId));
  } catch {
    /* ignore */
  }
}

export function clearPendingTurnTextIfMatch(
  storage: Pick<Storage, "getItem" | "removeItem">,
  sessionId: string,
  turnId: string
): boolean {
  const pending = readPendingTurnText(storage, sessionId);
  if (!pending || pending.turnId !== turnId) return false;
  clearPendingTurnText(storage, sessionId);
  return true;
}
