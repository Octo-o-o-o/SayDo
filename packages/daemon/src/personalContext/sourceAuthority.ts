// §19.4：原生 Focus 权威和会话锚点复用现有源端写闸，不由 Anyvia JSON 授权。
import { personalContextLinkSchema } from "@saydo/contracts";
import type { Db } from "../storage/db.js";
import { assertFocusAuthSnapshotCas } from "../focus/binding.js";
import { withFocusWriteTx } from "../focus/writeTx.js";

/** 调用者必须处于实际效果的同库事务内；不允许预检成功后异步继续使用。 */
export function assertPersonalContextSourceCurrent(db: Db, input: unknown): void {
  if (!db.inTransaction) throw new Error("personal_context_source_requires_transaction");
  const link = personalContextLinkSchema.parse(input);
  withFocusWriteTx(db, { writerAuthority: "saydo", capturedEpoch: link.focusAuthorityEpoch }, ops => {
    ops.assertWriteAuthority(link.focusId);
    const focus = ops.getFocus(link.focusId);
    if (!["captured", "active", "dormant"].includes(focus.lifecycle)) throw new Error("personal_context_focus_not_active");
    assertFocusAuthSnapshotCas(db, {
      focusId: link.focusId, focusRevision: link.focusRevision,
      authorityEpoch: link.focusAuthorityEpoch, focusAnchorRevision: link.focusAnchorRevision,
      sessionId: link.sessionId,
    });
  });
}
