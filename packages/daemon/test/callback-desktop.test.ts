// 桌面通知:先截断再转义;spawn error ⇒ false。禁真 osascript。

import { describe, expect, it } from "vitest";
import {
  DESKTOP_BODY_MAX,
  DESKTOP_TITLE_MAX,
  escapeOsa,
  notifyMacDesktop,
  truncateForOsa,
  type DetachedChild
} from "../src/callback/desktop.js";

describe("escapeOsa / 截断", () => {
  it("转义引号与反斜杠", () => {
    expect(escapeOsa('say "hi"')).toBe('say \\"hi\\"');
    expect(escapeOsa("a\\b")).toBe("a\\\\b");
  });

  it("先截断原文再转义,不切断转义序列", () => {
    const raw = `${"x".repeat(DESKTOP_TITLE_MAX - 1)}"`;
    const cut = truncateForOsa(raw, DESKTOP_TITLE_MAX);
    expect(cut.length).toBe(DESKTOP_TITLE_MAX);
    expect(escapeOsa(cut).endsWith('\\"')).toBe(true);
    const body = `${"y".repeat(DESKTOP_BODY_MAX + 20)}\\"`;
    expect(truncateForOsa(body, DESKTOP_BODY_MAX).length).toBe(DESKTOP_BODY_MAX);
  });
});

describe("notifyMacDesktop 注入 spawn", () => {
  it("spawn error 事件 ⇒ false", async () => {
    const ok = await notifyMacDesktop(
      () => {
        const child: DetachedChild = {
          unref: () => undefined,
          on: (event, listener) => {
            if (event === "error") queueMicrotask(() => listener(new Error("ENOENT")));
            return child;
          }
        };
        return child;
      },
      { title: "SayDo · t", body: "等你验收" }
    );
    expect(ok).toBe(false);
  });

  it("spawn 事件 ⇒ true;不真弹通知", async () => {
    let spawned = false;
    const ok = await notifyMacDesktop(
      (command, args) => {
        spawned = true;
        expect(command).toBe("osascript");
        expect(args[0]).toBe("-e");
        const child: DetachedChild = {
          unref: () => undefined,
          on: (event, listener) => {
            if (event === "spawn") queueMicrotask(() => listener());
            return child;
          }
        };
        return child;
      },
      { title: 'SayDo · "p"', body: "卡住了" }
    );
    expect(spawned).toBe(true);
    expect(ok).toBe(true);
  });

  it("无事件接口的注入桩视为同步成功", async () => {
    const ok = await notifyMacDesktop(() => ({ unref: () => undefined }), {
      title: "SayDo · t",
      body: "等你验收"
    });
    expect(ok).toBe(true);
  });
});
