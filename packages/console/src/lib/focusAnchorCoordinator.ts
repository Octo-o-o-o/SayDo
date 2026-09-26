// 跨 Chat 实例的 focus-anchor 所有权与串行写。
// 新续接 claim 后,旧请求不得再 POST,也不得写共享 pendingAnchor。
// 已在途的旧 POST 结束后,当前 owner 再写,保证服务端最后一笔是新 focus。

export type FocusAnchorOwner = {
  id: number;
  sessionId: string;
  focusId: string;
};

let nextOwnerId = 0;
let currentOwner: FocusAnchorOwner | null = null;
let writeTail: Promise<void> = Promise.resolve();

export function claimFocusAnchorOwner(sessionId: string, focusId: string): FocusAnchorOwner {
  nextOwnerId += 1;
  currentOwner = { id: nextOwnerId, sessionId, focusId };
  return currentOwner;
}

export function releaseFocusAnchorOwner(owner: FocusAnchorOwner): void {
  if (currentOwner && currentOwner.id === owner.id) {
    currentOwner = null;
  }
}

export function isCurrentFocusAnchorOwner(owner: FocusAnchorOwner | null | undefined): boolean {
  return Boolean(
    owner &&
      currentOwner &&
      currentOwner.id === owner.id &&
      currentOwner.sessionId === owner.sessionId &&
      currentOwner.focusId === owner.focusId
  );
}

export function currentFocusAnchorOwner(): FocusAnchorOwner | null {
  return currentOwner;
}

export async function enqueueFocusAnchorWrite<T>(
  owner: FocusAnchorOwner,
  write: () => Promise<T>
): Promise<{ status: "ok"; value: T } | { status: "skipped" }> {
  let settle!: (result: { status: "ok"; value: T } | { status: "skipped" }) => void;
  let fail!: (err: unknown) => void;
  const result = new Promise<{ status: "ok"; value: T } | { status: "skipped" }>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });
  writeTail = writeTail
    .catch(() => undefined)
    .then(async () => {
      if (!isCurrentFocusAnchorOwner(owner)) {
        settle({ status: "skipped" });
        return;
      }
      try {
        const value = await write();
        if (!isCurrentFocusAnchorOwner(owner)) {
          settle({ status: "skipped" });
          return;
        }
        settle({ status: "ok", value });
      } catch (err) {
        fail(err);
      }
    });
  return result;
}

export function resetFocusAnchorCoordinatorForTests(): void {
  nextOwnerId = 0;
  currentOwner = null;
  writeTail = Promise.resolve();
}
