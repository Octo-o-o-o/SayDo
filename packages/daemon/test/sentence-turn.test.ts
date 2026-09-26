import { describe, expect, it } from "vitest";
import { newId } from "@saydo/contracts";
import { LatencyCollector } from "../src/obs/latency.js";
import { PLAYOUT_SEEN_MAX, notePlayout, turnIdOfSentence } from "../src/obs/sentenceTurn.js";

const STRING_TURN = "ses_01ABCDEFGHJKMNPQRSTVWXYZAB";
const CONTROL_TURN = "ctl-confirmation_settled-01ABCDEF-k3j2h1a";
const SYSTEM_SENTENCE_IDS = [
  "s-cb-1690000000000",
  "s-cb-txt-1690000000000",
  "s-suspend-1690000000000",
  "s-focus-close-1690000000000"
];
const REJECTED_SENTENCE_IDS = [
  ...SYSTEM_SENTENCE_IDS,
  "s-alpha-beta-2",
  "s-ses_NOTULID-1",
  "s-prj_01ABCDEFGHJKMNPQRSTVWXYZAB-0",
  "s-evt_01ABCDEFGHJKMNPQRSTVWXYZAB-0",
  "s-ctl-bogus-01ABCDEF-k3j2h1a-0",
  "s-0-1",
  "s-evt_42-hold"
];

describe("sentence turn attribution", () => {
  it("accepts evt digits, ses ULID, and proven control turns only", () => {
    expect(STRING_TURN).toHaveLength(30);
    expect(turnIdOfSentence("s-evt_42-0")).toBe("evt_42");
    expect(turnIdOfSentence("s-evt_7-12")).toBe("evt_7");
    expect(turnIdOfSentence(`s-${STRING_TURN}-3`)).toBe(STRING_TURN);
    expect(turnIdOfSentence(`s-${CONTROL_TURN}-0`)).toBe(CONTROL_TURN);
    expect(turnIdOfSentence("s-ctl-downgrade_applied-x-k3-1")).toBe("ctl-downgrade_applied-x-k3");
    expect(turnIdOfSentence("s-ctl-expectation_adjusted-ABCDEFGH-m1-2")).toBe("ctl-expectation_adjusted-ABCDEFGH-m1");
    for (const sentenceId of REJECTED_SENTENCE_IDS) {
      expect(turnIdOfSentence(sentenceId)).toBeNull();
    }
    const generated = newId("ses");
    expect(turnIdOfSentence(`s-${generated}-0`)).toBe(generated);
    const receipt = newId("apr");
    const control = `ctl-confirmation_settled-${receipt.slice(-8)}-${Date.now().toString(36)}`;
    expect(turnIdOfSentence(`s-${control}-0`)).toBe(control);
    const missingReceipt = `ctl-expectation_adjusted-x-${Date.now().toString(36)}`;
    expect(turnIdOfSentence(`s-${missingReceipt}-1`)).toBe(missingReceipt);
    expect(turnIdOfSentence("s-ctl-downgrade_applied-x-123456-0")).toBe("ctl-downgrade_applied-x-123456");
  });

  it("system sentences do not create pending or occupy playout, and A/B stay ordered by sentence id", () => {
    const collector = new LatencyCollector();
    const seen = new Set<string>();
    const claimed: string[] = [];
    const record = (turnId: string, atMs: number) => {
      claimed.push(turnId);
      return collector.record(turnId, "playout_start", atMs);
    };
    for (const sentenceId of SYSTEM_SENTENCE_IDS) {
      notePlayout(seen, sentenceId, 1, record);
    }
    expect(claimed).toEqual([]);
    expect(seen.size).toBe(0);
    expect(collector.pendingSize()).toBe(0);
    expect(collector.countsSnapshot().started).toBe(0);

    notePlayout(seen, `s-${STRING_TURN}-0`, 20, record);
    notePlayout(seen, "s-evt_42-1", 30, record);
    expect(claimed).toEqual([STRING_TURN, "evt_42"]);
    expect(collector.pendingSize()).toBe(2);
    expect(seen.has(STRING_TURN)).toBe(true);
    expect(seen.has("evt_42")).toBe(true);

    notePlayout(seen, `s-${STRING_TURN}-1`, 40, record);
    notePlayout(seen, "s-cb-1690000000001", 50, record);
    expect(claimed).toEqual([STRING_TURN, "evt_42"]);
    expect(collector.pendingSize()).toBe(2);
    expect(collector.countsSnapshot().started).toBe(2);
    expect(seen.has("cb")).toBe(false);
    expect(seen.size).toBe(2);
  });

  it("playout dedup clears after the existing bound and still records that sentence", () => {
    const seen = new Set<string>();
    let calls = 0;
    for (let index = 1; index <= PLAYOUT_SEEN_MAX + 1; index += 1) {
      notePlayout(seen, `s-evt_${index}-0`, index, () => {
        calls += 1;
        return null;
      });
    }
    expect(calls).toBe(PLAYOUT_SEEN_MAX + 1);
    expect(seen.size).toBe(0);
  });
});
