// L1 桌面通知(macOS 通知中心;osascript display notification)。
// 投递走注入 spawn(测试禁真弹通知);失败返回 false,由 sweep 降级 ntfy / 留 pending。
// 标题/正文经 redactText;capability token 不进通知。

import { redactText } from "../voice/redactor.js";

export interface DetachedChild {
  unref(): void;
  on?(event: "error" | "spawn", listener: (err?: Error) => void): unknown;
}

export type SpawnDetached = (
  command: string,
  args: readonly string[],
  options: { stdio: "ignore"; detached: true }
) => DetachedChild;

export const DESKTOP_TITLE_MAX = 120;
export const DESKTOP_BODY_MAX = 200;

export function escapeOsa(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function truncateForOsa(s: string, max: number): string {
  return s.replace(/[\r\n]+/g, " ").slice(0, max);
}

/** 先截断原文再转义。听 spawn/error:error⇒false,spawn⇒true;无事件接口视为同步成功。不 wait 退出码。 */
export function notifyMacDesktop(
  spawnDetached: SpawnDetached,
  input: { title: string; body: string }
): Promise<boolean> {
  const title = escapeOsa(truncateForOsa(redactText(input.title), DESKTOP_TITLE_MAX));
  const body = escapeOsa(truncateForOsa(redactText(input.body), DESKTOP_BODY_MAX));
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean): void => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    try {
      const child = spawnDetached(
        "osascript",
        ["-e", `display notification "${body}" with title "${title}"`],
        { stdio: "ignore", detached: true }
      );
      if (typeof child.on === "function") {
        child.on("error", () => finish(false));
        child.on("spawn", () => finish(true));
      } else {
        finish(true);
      }
      child.unref();
    } catch {
      finish(false);
    }
  });
}
