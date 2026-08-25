import { projectUntrustedFailureText } from "@saydo/platform";

export const SUPERVISOR_IPC_FAILED = "supervisor ipc failed";

const ipcErrors = new WeakSet<object>();

export class SupervisorIpcError extends Error {
  constructor() {
    super(SUPERVISOR_IPC_FAILED);
    this.name = "SupervisorIpcError";
    ipcErrors.add(this);
  }
}

export function isSupervisorIpcError(err: unknown): boolean {
  return typeof err === "object" && err !== null && ipcErrors.has(err);
}

export interface SupervisorSendHooks {
  send?: (frame: object, cb?: (err?: Error | null) => void) => boolean;
  log?: (msg: string, fields?: Record<string, unknown>) => void;
  supervised?: boolean;
}

/** ready 帧必须等到 IPC 完成才 settle；调用方不得 void 掉。 */
export async function publishSupervisorReady<T extends object>(
  frame: T,
  send: (frame: T) => Promise<void>
): Promise<void> {
  await send(frame);
}

export function sendSupervisorFrameAndWait(frame: object, hooks: SupervisorSendHooks = {}): Promise<void> {
  const supervised = hooks.supervised ?? process.env["SAYDO_SUPERVISED"] === "1";
  const send = hooks.send ?? (supervised && typeof process.send === "function" ? process.send.bind(process) : undefined);
  if (typeof send !== "function") {
    if (supervised) return Promise.reject(new SupervisorIpcError());
    return Promise.resolve();
  }
  return new Promise((resolveSend, rejectSend) => {
    let settled = false;
    const finish = (err?: unknown): void => {
      if (settled) return;
      settled = true;
      if (err) rejectSend(err instanceof SupervisorIpcError ? err : new SupervisorIpcError());
      else resolveSend();
    };
    try {
      send(frame, (err) => {
        try {
          if (err) {
            hooks.log?.("supervisor IPC send failed", {
              error: projectUntrustedFailureText(err, SUPERVISOR_IPC_FAILED)
            });
            finish(new SupervisorIpcError());
            return;
          }
        } catch {
          finish(new SupervisorIpcError());
          return;
        }
        finish();
      });
    } catch (err) {
      try {
        hooks.log?.("supervisor IPC send failed", {
          error: projectUntrustedFailureText(err, SUPERVISOR_IPC_FAILED)
        });
      } catch {
        // catch 自身不得再抛。
      }
      finish(new SupervisorIpcError());
    }
  });
}
