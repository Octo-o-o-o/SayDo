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

export function readQuiescedTranscripts(
  storage: Pick<Storage, "getItem">,
  sessionId: string
): QuiescedTranscript[] {
  try {
    const raw = storage.getItem(quiescedTranscriptKey(sessionId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is QuiescedTranscript => {
      return (
        item &&
        typeof item === "object" &&
        typeof item.sessionId === "string" &&
        typeof item.requestId === "string" &&
        typeof item.turnId === "string" &&
        typeof item.text === "string" &&
        item.text.trim() !== ""
      );
    });
  } catch {
    return [];
  }
}

export function upsertQuiescedTranscript(
  storage: Pick<Storage, "getItem" | "setItem">,
  item: QuiescedTranscript
): boolean {
  const list = readQuiescedTranscripts(storage, item.sessionId);
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
): void {
  const next = readQuiescedTranscripts(storage, sessionId).filter(
    (row) => !(row.requestId === requestId && row.turnId === turnId)
  );
  try {
    storage.setItem(quiescedTranscriptKey(sessionId), JSON.stringify(next));
  } catch {
    /* ignore */
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
