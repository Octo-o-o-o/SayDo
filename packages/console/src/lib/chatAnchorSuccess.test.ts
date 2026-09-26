import { describe, expect, it } from "vitest";
import { buildAnchorSuccessPayload } from "./chatAnchorSuccess";
import type { PendingAnchorPayload } from "./pendingAnchor";

const FOC = "foc_01CHATANCHOR0000000000001";
const REQ = "evt_01CHATANCHORREQ0000000001";
const EPOCH = "evt_01CHATANCHOREPOCH00000001";

function launch(draft: string): PendingAnchorPayload {
  return { focusId: FOC, title: "周报", draft };
}

describe("buildAnchorSuccessPayload", () => {
  it("等待期间把稿从 A 改成 B 后,成功回调仍保存 B,不用启动 payload 覆盖", () => {
    const started = launch("草稿A");
    const live = { ...started, draft: "草稿B" };
    const saved = buildAnchorSuccessPayload(started, live, "草稿B", {
      requestId: REQ,
      daemonEpoch: EPOCH
    });
    expect(saved.draft).toBe("草稿B");
    expect(saved.focusId).toBe(FOC);
    expect(saved.requestId).toBe(REQ);
    expect(saved.daemonEpoch).toBe(EPOCH);
    expect(saved).not.toEqual(expect.objectContaining({ draft: "草稿A" }));
  });

  it("等待期 live 丢失时仍以当前输入稿为准,不回落启动稿", () => {
    const saved = buildAnchorSuccessPayload(launch("草稿A"), null, "草稿B", {
      requestId: REQ,
      daemonEpoch: EPOCH
    });
    expect(saved.draft).toBe("草稿B");
  });
});
