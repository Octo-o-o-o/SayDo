import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CREDENTIAL_GRAMMAR } from "@saydo/contracts";
import { openDb, type Db } from "../src/storage/db.js";
import { MemoryLedger } from "../src/memory/ledger.js";
import { HotwordStore } from "../src/memory/hotwords.js";
import { ToolRegistry } from "../src/brain/registry.js";
import { registerLiveTools, type LiveToolsDeps } from "../src/brain/liveTools.js";
import type { AuditSink } from "../src/obs/audit.js";

function skToken(): string {
  return [CREDENTIAL_GRAMMAR.openaiSkPrefix, "A".repeat(CREDENTIAL_GRAMMAR.bodyMin)].join("");
}

function setup(): {
  registry: ToolRegistry;
  ledger: MemoryLedger;
  db: Db;
  audits: { action: string; meta?: Record<string, unknown> }[];
} {
  const home = mkdtempSync(join(tmpdir(), "saydo-live-priv-"));
  const db = openDb(join(home, "saydo.db"));
  const audits: { action: string; meta?: Record<string, unknown> }[] = [];
  const audit: AuditSink = {
    record: (event) => {
      audits.push({ action: event.action, ...(event.meta ? { meta: event.meta } : {}) });
      return { id: "aud_x" };
    }
  };
  const ledger = new MemoryLedger({ db, audit });
  const hotwords = new HotwordStore(ledger);
  const deps = {
    db,
    audit,
    ledger,
    hotwords,
    brainTools: {} as LiveToolsDeps["brainTools"],
    factory: {} as LiveToolsDeps["factory"],
    sessions: {
      ensureSession: () => ({ session: {} }),
      findUserTurn: () => null
    } as unknown as LiveToolsDeps["sessions"],
    confirm: {} as LiveToolsDeps["confirm"],
    say: () => true,
    drafter: null,
    gate0: () => ({ enabled: true, bypass: false }),
    devAdapter: () => "cursor",
    taskMaxDefault: () => 20,
    enabledProjectTypes: () => ["coding"]
  } as LiveToolsDeps;
  const registry = new ToolRegistry();
  registerLiveTools(registry, deps);
  return { registry, ledger, db, audits };
}

const ctx = { sessionId: "ses_01LIVEPRIV0000000000000001", turnId: "trn_01LIVEPRIV0000000000000001" };

describe("live remember/addHotword 凭据闸", () => {
  it("remember 命中 => memory_secret_literal,账本无该 claim,随后正常 remember 仍成功", async () => {
    const { registry, ledger, db, audits } = setup();
    const token = skToken();
    const claim = `偏好 ${token}`;
    const rejected = await registry.dispatch(
      "remember",
      JSON.stringify({ tier: "M1", claim, trust: "user_stated" }),
      ctx
    );
    expect(rejected).toMatchObject({
      ok: false,
      code: "memory_secret_literal",
      retryable: false,
      failureClass: "memory_item_not_saved"
    });
    const rec = rejected as { message: string };
    expect(rec.message).not.toContain(token);
    expect(rec.message).not.toContain(claim);
    const rows = db.prepare("SELECT claim FROM memory_events WHERE claim = ?").all(claim);
    expect(rows).toHaveLength(0);
    expect(ledger.project().some((m) => m.claim === claim)).toBe(false);
    expect(JSON.stringify(audits)).not.toContain(token);

    const ok = await registry.dispatch(
      "remember",
      JSON.stringify({ tier: "M1", claim: "偏好 ISO 日期", trust: "user_stated" }),
      ctx
    );
    expect(ok).toEqual(expect.objectContaining({ memId: expect.stringMatching(/^mem_/) }));
    expect(ledger.project().some((m) => m.claim === "偏好 ISO 日期")).toBe(true);
  });

  it("addHotword 命中不得返回 ok true", async () => {
    const { registry, ledger, db } = setup();
    const token = skToken();
    const rejected = await registry.dispatch(
      "addHotword",
      JSON.stringify({ term: "误听", canonical: token }),
      ctx
    );
    expect(rejected).toMatchObject({
      ok: false,
      code: "memory_secret_literal",
      failureClass: "memory_item_not_saved"
    });
    expect(JSON.stringify(rejected)).not.toContain(token);
    expect(db.prepare("SELECT COUNT(*) AS n FROM memory_events").get() as { n: number }).toEqual({ n: 0 });
    expect(ledger.project()).toHaveLength(0);
  });

  it("凭据闸先于 invalid_trust 与 readiness:同时带凭据与无效就绪参数仍返回 memory_secret_literal", async () => {
    const { registry, db } = setup();
    const token = skToken();
    const claim = `偏好 ${token}`;
    const withInvalidKey = await registry.dispatch(
      "remember",
      JSON.stringify({ tier: "M1", claim, trust: "user_stated", readinessKey: "not_a_readiness_key" }),
      ctx
    );
    expect(withInvalidKey).toMatchObject({
      ok: false,
      code: "memory_secret_literal",
      failureClass: "memory_item_not_saved"
    });
    expect(withInvalidKey).not.toMatchObject({ code: "readiness_key_invalid" });
    expect(withInvalidKey).not.toMatchObject({ code: "readiness_key_no_project" });

    const withApproved = await registry.dispatch(
      "remember",
      JSON.stringify({ tier: "M1", claim, trust: "user_approved", readinessKey: "goal" }),
      ctx
    );
    expect(withApproved).toMatchObject({
      ok: false,
      code: "memory_secret_literal",
      failureClass: "memory_item_not_saved"
    });
    expect(withApproved).not.toMatchObject({ code: "readiness_key_trust" });
    expect(withApproved).not.toMatchObject({ code: "invalid_trust" });

    const withBadTrust = await registry.dispatch(
      "remember",
      JSON.stringify({ tier: "M1", claim, trust: "auto_low_impact" }),
      ctx
    );
    expect(withBadTrust).toMatchObject({ code: "memory_secret_literal", failureClass: "memory_item_not_saved" });
    expect(withBadTrust).not.toMatchObject({ code: "invalid_trust" });

    expect(JSON.stringify(withInvalidKey)).not.toContain(token);
    expect(db.prepare("SELECT COUNT(*) AS n FROM memory_events").get() as { n: number }).toEqual({ n: 0 });
  });

  it("addHotword term 含凭据且含 -> 时返回 memory_secret_literal,不是分隔符错误", async () => {
    const { registry, db } = setup();
    const token = skToken();
    const rejected = await registry.dispatch(
      "addHotword",
      JSON.stringify({ term: `${token}->误听`, canonical: "正确词" }),
      ctx
    );
    expect(rejected).toMatchObject({
      ok: false,
      code: "memory_secret_literal",
      retryable: false,
      failureClass: "memory_item_not_saved"
    });
    expect(JSON.stringify(rejected)).not.toContain(token);
    expect(JSON.stringify(rejected)).not.toMatch(/hotword must not contain/);
    expect(db.prepare("SELECT COUNT(*) AS n FROM memory_events").get() as { n: number }).toEqual({ n: 0 });
  });
});
