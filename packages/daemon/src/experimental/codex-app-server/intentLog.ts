import { appendFileSync } from "node:fs";

export type IntentDelivery = "intent" | "unsent" | "written" | "acked" | "rejected" | "unknown";

export type SummaryValue = string | number | boolean | null;

export interface IntentRecord {
  at: string;
  runId: string;
  generation: number;
  taskId: string | null;
  requestId: string | null;
  method: string;
  threadId: string | null;
  turnId: string | null;
  summary: Record<string, SummaryValue>;
  delivery: IntentDelivery;
  reason: string | null;
}

export interface IntentRecorder {
  append(record: IntentRecord): void;
}

const FORBIDDEN_SUMMARY_KEYS = new Set([
  "text",
  "command",
  "questions",
  "secret",
  "token",
  "password",
  "params",
  "input",
  "prompt",
  "answers"
]);

export function assertSummary(summary: Record<string, SummaryValue>): void {
  for (const key of Object.keys(summary)) {
    if (FORBIDDEN_SUMMARY_KEYS.has(key)) {
      throw new Error("intent_summary_forbidden");
    }
  }
}

export class MemoryIntentRecorder implements IntentRecorder {
  readonly records: IntentRecord[] = [];
  fail = false;

  append(record: IntentRecord): void {
    assertSummary(record.summary);
    if (this.fail) throw new Error("intent_persist_failed");
    this.records.push(structuredClone(record));
  }
}

export function createFileIntentRecorder(filePath: string): IntentRecorder {
  return {
    append(record) {
      assertSummary(record.summary);
      const line = JSON.stringify(record);
      if (line.includes("\n")) throw new Error("intent_line_break");
      appendFileSync(filePath, `${line}\n`, { encoding: "utf8", flag: "a" });
    }
  };
}
