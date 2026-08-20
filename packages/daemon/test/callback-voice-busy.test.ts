// A1 生产向:voiceBusy 只认 LiveDialog.hasUserTurnInFlight,开口一轮结束后仍可 L0。

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Logger } from "../src/obs/logger.js";
import type { AuditSink } from "../src/obs/audit.js";
import type { LlmProvider } from "../src/providers/types.js";
import { openFocusFixture, type FocusFixture } from "./helpers/focus-fixture.js";
import { LiveDialog } from "../src/live/dialog.js";
import { LiveVoiceSessions } from "../src/live/voiceSessions.js";
import { SessionManager } from "../src/session/manager.js";
import { ConfirmationLoop } from "../src/live/confirm.js";
import { CallbackEngine } from "../src/callback/engine.js";
import { arbitrate } from "../src/callback/arbitration.js";
import { renderNtfyMessage } from "../src/callback/ntfy.js";
import { runCallbackSweep } from "../src/callback/sweep.js";
import { getOutboxEntry } from "../src/storage/dao/outbox.js";

const nullLog = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
  child() {
    return this;
  }
} as unknown as Logger;

const nullAudit: AuditSink = { record: () => ({ id: "aud_x" }) };

function mockProvider(): LlmProvider {
  return {
    kind: "api",
    model: "mock",
    async chat() {
      return {
        ok: true,
        text: "好。",
        requestedModel: "mock",
        observedModel: "mock",
        observedModelSource: "stream",
        observedModelExempted: false,
        usage: { promptTokens: 1, completionTokens: 1 }
      };
    }
  };
}

describe("生产 voiceBusy:开口一轮后仍 L0", () => {
  let fx: FocusFixture;
  beforeEach(() => {
    fx = openFocusFixture();
  });
  afterEach(() => fx.close());

  it("onUserTurn 留下 currentUserTurn,但 inFlight 已结束 ⇒ sweep 仍 say", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-cb-busy-"));
    const sessions = new SessionManager({ db: fx.db, audit: nullAudit, storeTranscript: true });
    const live = new LiveVoiceSessions({
      db: fx.db,
      audit: nullAudit,
      sessions,
      saydoHome: home,
      idleSuspendSec: 600
    });
    const dialog = new LiveDialog({
      db: fx.db,
      audit: nullAudit,
      sessions: live,
      dialogProvider: mockProvider(),
      say: () => true,
      log: nullLog,
      confirm: new ConfirmationLoop({}, fx.db, nullAudit)
    });
    live.ensureSession(fx.sessionId);
    await dialog.onAsrFinal(fx.sessionId, "trn_01AAAAAAAAAAAAAAAAAAAAAAAA", "你好");
    expect(live.hasCurrentUserTurn(fx.sessionId)).toBe(true);
    expect(dialog.hasUserTurnInFlight(fx.sessionId)).toBe(false);

    const now = "2026-08-04T00:00:00.000Z";
    const taskId = "tsk_01AAAAAAAAAAAAAAAAAAAAAAAA";
    fx.db
      .prepare(
        `INSERT INTO tasks(id, project_id, title, spec_markdown, route, status, adapter, budget_json, created_at, updated_at)
         VALUES (?, ?, '导出功能', '# t', 'tier1', 'blocked', 'cursor', '{}', ?, ?)`
      )
      .run(taskId, fx.projectId, now, now);
    const engine = new CallbackEngine({ db: fx.db, audit: nullAudit, now: () => new Date(now) });
    const enq = engine.enqueue({
      taskId,
      trigger: "blocked",
      packageRevision: 1,
      occurrenceKey: "e1",
      minimalProof: { questionId: "q-e1", transcriptCursor: "c" },
      projectionCursor: "c",
      artifactChecks: []
    });
    expect(enq.enqueued).toBe(true);
    const sayCalls: string[] = [];
    await runCallbackSweep(
      {
        db: fx.db,
        engine,
        arbitrate,
        voice: {
          consolePeerForTask: () => fx.sessionId,
          ttsHealthy: () => true,
          voiceBusy: (sid) => dialog.hasUserTurnInFlight(sid),
          say: async (_sid, text) => {
            sayCalls.push(text);
            return true;
          },
          consoleSay: () => false
        },
        desktop: { notify: async () => false },
        ntfy: {
          enabled: false,
          post: async () => false,
          render: (d, entry) => renderNtfyMessage(d, entry, { consoleBase: "http://127.0.0.1:47100" })
        },
        dnd: { inWindow: () => false, windowEnd: () => null },
        log: { info: () => undefined, warn: () => undefined, error: () => undefined },
        audit: nullAudit,
        l1FailWarned: new Set()
      },
      new Date(now)
    );
    expect(sayCalls).toHaveLength(1);
    expect(getOutboxEntry(fx.db, enq.entryId)?.state).toBe("notified");
    expect(getOutboxEntry(fx.db, enq.entryId)?.escalationLevel).toBe(0);
  });
});
