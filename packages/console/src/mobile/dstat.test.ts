import { describe, expect, it } from "vitest";
import { DAEMON_CONNECT_TIMEOUT_MS, reduceDaemonStatus } from "./dstat";

describe("dstat 状态机", () => {
  it("connecting -> online -> offline -> connecting -> online", () => {
    let state = reduceDaemonStatus("connecting", "open");
    expect(state).toBe("online");
    state = reduceDaemonStatus(state, "close");
    expect(state).toBe("offline");
    state = reduceDaemonStatus(state, "browser_online");
    expect(state).toBe("connecting");
    state = reduceDaemonStatus(state, "open");
    expect(state).toBe("online");
  });

  it("浏览器离线立即进 offline，连接中事件不降级已在线状态", () => {
    expect(reduceDaemonStatus("connecting", "browser_offline")).toBe("offline");
    expect(reduceDaemonStatus("online", "connect_start")).toBe("online");
  });

  it("首次连接超时从 connecting 进 offline，浏览器恢复后重进 connecting", () => {
    expect(DAEMON_CONNECT_TIMEOUT_MS).toBe(3_000);
    expect(reduceDaemonStatus("connecting", "connect_timeout")).toBe("offline");
    expect(reduceDaemonStatus("offline", "browser_online")).toBe("connecting");
  });
});
