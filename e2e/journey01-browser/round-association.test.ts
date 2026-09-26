import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { judgeJourneyAssociation } from "./round-association.ts";

const RUN = "jr_round12";
const FOCUS = "foc_01M34SYS5CHS7WJ8WEB7JYB1Q0";
const OTHER = "foc_01M34NZYAED6RBS9QYRNCBZNH0";

describe("journey evidence association", () => {
  it("同一次执行的日志 focus、seed、identity、run 和 task 才算闭合", () => {
    const judged = judgeJourneyAssociation({
      runId: RUN,
      exitCode: 0,
      logText: `seed\n${FOCUS}\n`,
      seed: { runId: RUN, focusId: FOCUS, sessionId: "ses_1" },
      identity: { journeyRunId: RUN, focusId: FOCUS, taskId: "tsk_1", sessionId: "ses_1" }
    });
    assert.equal(judged.associated, true);
  });

  it("日志 focus 与 identity 不是同一次时不闭合,exit 1 也不能当成这轮通过", () => {
    const mismatched = judgeJourneyAssociation({
      runId: RUN,
      exitCode: 0,
      logText: `${OTHER}\n`,
      seed: { runId: RUN, focusId: OTHER, sessionId: "ses_1" },
      identity: { journeyRunId: RUN, focusId: FOCUS, taskId: "tsk_1", sessionId: "ses_1" }
    });
    assert.equal(mismatched.associated, false);
    const failed = judgeJourneyAssociation({
      runId: RUN,
      exitCode: 1,
      logText: `${FOCUS}\n`,
      seed: { runId: RUN, focusId: FOCUS, sessionId: "ses_1" },
      identity: { journeyRunId: RUN, focusId: FOCUS, taskId: "tsk_1", sessionId: "ses_1" }
    });
    assert.equal(failed.associated, false);
  });
});
