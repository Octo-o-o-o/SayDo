import type { PendingAnchorPayload } from "./pendingAnchor";

/** 锚定成功后保存当前稿,不得用启动 payload 覆盖等待期间的新输入。 */
export function buildAnchorSuccessPayload(
  launch: PendingAnchorPayload,
  live: PendingAnchorPayload | null,
  liveDraft: string,
  extras: { requestId: string; daemonEpoch: string }
): PendingAnchorPayload {
  const base = live ?? launch;
  return {
    ...base,
    requestId: extras.requestId,
    daemonEpoch: extras.daemonEpoch,
    draft: liveDraft
  };
}
