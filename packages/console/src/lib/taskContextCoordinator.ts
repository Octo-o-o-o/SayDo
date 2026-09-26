// 跨 TaskModal 实例的 task-context 串行写与清理。
// 新弹窗 claim 后,旧 POST 不得落库;旧清理不得删新 nonce。
// B ready 必须排在 A 的全部写/cleanup 之后。

export type TaskContextOwner = {
  id: number;
  sessionId: string;
  targetKey: string;
};

let nextOwnerId = 0;
let currentOwner: TaskContextOwner | null = null;
let writeTail: Promise<void> = Promise.resolve();

export function claimTaskContextOwner(sessionId: string, targetKey: string): TaskContextOwner {
  nextOwnerId += 1;
  currentOwner = { id: nextOwnerId, sessionId, targetKey };
  return currentOwner;
}

export function releaseTaskContextOwner(owner: TaskContextOwner): void {
  if (currentOwner && currentOwner.id === owner.id) {
    currentOwner = null;
  }
}

export function isCurrentTaskContextOwner(owner: TaskContextOwner | null | undefined): boolean {
  return Boolean(
    owner &&
      currentOwner &&
      currentOwner.id === owner.id &&
      currentOwner.sessionId === owner.sessionId &&
      currentOwner.targetKey === owner.targetKey
  );
}

export function currentTaskContextOwner(): TaskContextOwner | null {
  return currentOwner;
}

export async function enqueueTaskContextWrite<T extends { nonce: string; sessionId: string }>(
  owner: TaskContextOwner,
  write: () => Promise<T>,
  onStale?: (value: T) => Promise<void>
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
      if (!isCurrentTaskContextOwner(owner)) {
        settle({ status: "skipped" });
        return;
      }
      try {
        const value = await write();
        if (!isCurrentTaskContextOwner(owner)) {
          if (onStale) await onStale(value);
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

export async function enqueueTaskContextCleanup(work: () => Promise<void>): Promise<void> {
  let done!: () => void;
  const finished = new Promise<void>((resolve) => {
    done = resolve;
  });
  writeTail = writeTail
    .catch(() => undefined)
    .then(async () => {
      try {
        await work();
      } finally {
        done();
      }
    });
  return finished;
}

export function resetTaskContextCoordinatorForTests(): void {
  nextOwnerId = 0;
  currentOwner = null;
  writeTail = Promise.resolve();
}
