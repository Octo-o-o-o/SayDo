import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type { Db } from "../storage/db.js";

export const FIRST_RUN_OPENING =
  "第一次来?随便说三件你这周要办的事,我来立账给你看——说完它们会变成右边的卡片,之后你随时可以问我『那三件事怎么样了』。";

export type FirstRunState = "presented" | "legacy_not_eligible" | "skipped_by_user";
type StoredFirstRunState = FirstRunState | "eligible" | "presenting";

interface FirstRunMarker {
  state: StoredFirstRunState;
  at: string;
  sessionId?: string;
  turnId?: string;
}

export interface FirstRunQueryResult {
  state: FirstRunState;
  delivered: boolean;
  message?: string;
  turnId?: string;
}

export function hasLegacyActivity(db: Db): boolean {
  const sessions = (db.prepare("SELECT COUNT(*) AS c FROM sessions").get() as { c: number }).c;
  const audits = (db.prepare("SELECT COUNT(*) AS c FROM audit_log").get() as { c: number }).c;
  return sessions > 0 || audits > 0;
}

export class FirstRunCoordinator {
  private readonly markerPath: string;

  constructor(
    private readonly db: Db,
    saydoHome: string,
    private readonly legacyAtBoot: boolean,
    private readonly now: () => Date = () => new Date()
  ) {
    this.markerPath = join(saydoHome, "first-run-onboarding.json");
  }

  /**
   * 必须在 daemon 自身写 bootstrap/start/setup audit 前调用。这样空 HOME 的资格能跨 setup
   * 重启保留；已有任意业务 session/audit 的旧 HOME 仍会永久落 legacy_not_eligible。
   */
  initializeEligibility(): void {
    if (this.readMarker()) return;
    const focusCount = (this.db.prepare("SELECT COUNT(*) AS c FROM focuses").get() as { c: number }).c;
    const sessionCount = (this.db.prepare("SELECT COUNT(*) AS c FROM sessions").get() as { c: number }).c;
    const state: StoredFirstRunState =
      this.legacyAtBoot || focusCount > 0 || sessionCount > 0 ? "legacy_not_eligible" : "eligible";
    this.writeMarker({ state, at: this.now().toISOString() });
  }

  noteUserMessage(sessionId: string): void {
    const existing = this.readMarker();
    if (existing?.state === "eligible") {
      this.replaceMarker({ state: "skipped_by_user", at: this.now().toISOString(), sessionId });
      return;
    }
    if (existing) return;
    this.writeMarker({ state: "skipped_by_user", at: this.now().toISOString(), sessionId });
  }

  query(
    sessionId: string,
    deliver: (input: {
      sessionId: string;
      turnId: string;
      text: string;
      alreadyRecorded: boolean;
    }) => unknown
  ): FirstRunQueryResult {
    const existing = this.readMarker();
    if (existing?.state === "presenting") {
      const presentingSessionId = existing.sessionId ?? sessionId;
      const turnId = existing.turnId ?? `onboarding-${this.now().getTime()}`;
      const acknowledged = deliver({
        sessionId: presentingSessionId,
        turnId,
        text: FIRST_RUN_OPENING,
        alreadyRecorded: this.deliveryRecorded(presentingSessionId, turnId)
      });
      if (acknowledged === false) {
        return { state: "presented", delivered: false, message: FIRST_RUN_OPENING, turnId };
      }
      this.replaceMarker({
        state: "presented",
        at: this.now().toISOString(),
        sessionId: presentingSessionId,
        turnId
      });
      return { state: "presented", delivered: true, message: FIRST_RUN_OPENING, turnId };
    }
    if (existing?.state === "presented") {
      if (existing.sessionId === sessionId && existing.turnId) {
        return {
          state: "presented",
          delivered: true,
          message: FIRST_RUN_OPENING,
          turnId: existing.turnId
        };
      }
      return { state: "presented", delivered: false };
    }
    if (existing?.state === "legacy_not_eligible" || existing?.state === "skipped_by_user") {
      return { state: existing.state, delivered: false };
    }

    const focusCount = (this.db.prepare("SELECT COUNT(*) AS c FROM focuses").get() as { c: number }).c;
    const sessionCount = (this.db.prepare("SELECT COUNT(*) AS c FROM sessions").get() as { c: number }).c;
    if ((existing?.state !== "eligible" && this.legacyAtBoot) || focusCount > 0 || sessionCount > 0) {
      const marker = { state: "legacy_not_eligible" as const, at: this.now().toISOString(), sessionId };
      this.writeMarker(marker);
      return { state: marker.state, delivered: false };
    }

    const turnId = `onboarding-${this.now().getTime()}`;
    const marker = { state: "presenting" as const, at: this.now().toISOString(), sessionId, turnId };
    if (existing?.state === "eligible") {
      this.replaceMarker(marker);
    } else if (!this.writeMarker(marker)) {
      return this.query(sessionId, deliver);
    }
    const acknowledged = deliver({
      sessionId,
      turnId,
      text: FIRST_RUN_OPENING,
      alreadyRecorded: this.deliveryRecorded(sessionId, turnId)
    });
    if (acknowledged === false) {
      return { state: "presented", delivered: false, message: FIRST_RUN_OPENING, turnId };
    }
    this.replaceMarker({ state: "presented", at: this.now().toISOString(), sessionId, turnId });
    return { state: "presented", delivered: true, message: FIRST_RUN_OPENING, turnId };
  }

  /** 崩溃落在 delivery 与 presented marker 之间时,从转写或不可变审计确认已投递,避免重复落轮。 */
  private deliveryRecorded(sessionId: string, turnId: string): boolean {
    const row = this.db.prepare("SELECT transcript_path FROM sessions WHERE id=?").get(sessionId) as
      | { transcript_path: string }
      | undefined;
    if (row && existsSync(row.transcript_path)) {
      try {
        for (const line of readFileSync(row.transcript_path, "utf8").split("\n")) {
          if (!line.trim()) continue;
          const turn = JSON.parse(line) as { turnId?: unknown; sentences?: { sentenceId?: unknown }[] };
          if (
            turn.turnId === turnId ||
            turn.sentences?.some((sentence) => sentence.sentenceId === turnId)
          ) {
            return true;
          }
        }
      } catch {
        // 转写损坏不据此判已投；继续看不可变审计收据。
      }
    }
    const auditRow = this.db
      .prepare(
        `SELECT 1 FROM audit_log
          WHERE action='onboarding.first_run_presented'
            AND json_extract(meta_json, '$.sessionId')=?
            AND json_extract(meta_json, '$.turnId')=?
          LIMIT 1`
      )
      .get(sessionId, turnId);
    return auditRow !== undefined;
  }

  private readMarker(): FirstRunMarker | null {
    if (!existsSync(this.markerPath)) return null;
    try {
      const raw = JSON.parse(readFileSync(this.markerPath, "utf8")) as Partial<FirstRunMarker>;
      if (
        raw.state === "eligible" ||
        raw.state === "presenting" ||
        raw.state === "presented" ||
        raw.state === "legacy_not_eligible" ||
        raw.state === "skipped_by_user"
      ) {
        return {
          state: raw.state,
          at: typeof raw.at === "string" ? raw.at : "",
          ...(raw.sessionId ? { sessionId: raw.sessionId } : {}),
          ...(raw.turnId ? { turnId: raw.turnId } : {})
        };
      }
    } catch {
      // 损坏的 once marker 也必须保守视为已消费,避免重复首跑话术。
    }
    return { state: "legacy_not_eligible", at: "" };
  }

  private writeMarker(marker: FirstRunMarker): boolean {
    try {
      writeFileSync(this.markerPath, `${JSON.stringify(marker)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
      return true;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "EEXIST") return false;
      throw err;
    }
  }

  private replaceMarker(marker: FirstRunMarker): void {
    const temporary = `${this.markerPath}.${process.pid}-${randomUUID()}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(marker)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
    renameSync(temporary, this.markerPath);
  }
}
