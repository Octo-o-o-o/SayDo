import { randomUUID } from "node:crypto";
import { expect, test } from "vitest";
import { openFocusFixture } from "./helpers/focus-fixture.js";
import { createFocus, changeFocusLifecycle } from "../src/focus/registry.js";
import { startActivation, closeActivation } from "../src/focus/activation.js";
import { captureFocusAuthSnapshot } from "../src/focus/binding.js";
import { assertPersonalContextSourceCurrent } from "../src/personalContext/sourceAuthority.js";

test("UPGRADE.T08.061 原会话切走再切回，旧跨产品绑定不会随相同Focus复活", () => {
  const f = openFocusFixture();
  try {
    const { focusId } = createFocus(f.db, { title: "原生事项" });
    const initial = startActivation(f.db, { focusId, sessionId: f.sessionId, trigger: "user_explicit" });
    const snapshot = captureFocusAuthSnapshot(f.db, f.sessionId)!;
    const link = { spaceId: "unified", caseId: randomUUID(), caseRevision: 1, controlGeneration: 1, hardConstraintsRevision: 1, focusId, focusRevision: snapshot.focusRevision, focusAuthorityEpoch: snapshot.authorityEpoch, focusAnchorRevision: snapshot.focusAnchorRevision, sessionId: f.sessionId };
    expect(() => assertPersonalContextSourceCurrent(f.db, link)).toThrow("requires_transaction");
    const current = () => f.db.transaction(() => assertPersonalContextSourceCurrent(f.db, link)).immediate();
    expect(current).not.toThrow();
    closeActivation(f.db, { activationId: initial.activationId, sessionId: f.sessionId, focusId });
    startActivation(f.db, { focusId, sessionId: f.sessionId, trigger: "user_explicit" });
    expect(current).toThrow(/anchorRevision drift/u);
  } finally { f.close(); }
});

test("UPGRADE.T08.062 原生权威与生命周期拒绝不被正确revision冒充", () => {
  const f = openFocusFixture();
  try {
    const { focusId } = createFocus(f.db, { title: "原生事项" });
    startActivation(f.db, { focusId, sessionId: f.sessionId, trigger: "user_explicit" });
    const snapshot = captureFocusAuthSnapshot(f.db, f.sessionId)!;
    const link = { spaceId: "unified", caseId: randomUUID(), caseRevision: 1, controlGeneration: 1, hardConstraintsRevision: 1, focusId, focusRevision: snapshot.focusRevision, focusAuthorityEpoch: snapshot.authorityEpoch, focusAnchorRevision: snapshot.focusAnchorRevision, sessionId: f.sessionId };
    const current = (value = link) => f.db.transaction(() => assertPersonalContextSourceCurrent(f.db, value)).immediate();
    expect(() => current({ ...link, focusAuthorityEpoch: link.focusAuthorityEpoch + 1 })).toThrow(/capturedEpoch/u);
    // 仅测试故障注入：模拟已提交的外部权威迁移，不作为产品写路径。
    f.db.prepare("UPDATE focuses SET semantic_authority='external_bootstrap' WHERE id=?").run(focusId);
    expect(() => current()).toThrow(/semanticAuthority/u);
    f.db.prepare("UPDATE focuses SET semantic_authority='saydo' WHERE id=?").run(focusId);
    changeFocusLifecycle(f.db, focusId, { to: "abandoned", reason: "本人放弃", actorKind: "user" });
    expect(() => current()).toThrow("focus_not_active");
  } finally { f.close(); }
});
