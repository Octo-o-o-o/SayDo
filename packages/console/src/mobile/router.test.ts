import { describe, expect, it } from "vitest";
import { desktopRouteForMobileHash, parseMobileHash } from "./router";
import { isForcedMobileShell, isMobileViewport } from "./useMobileViewport";

describe("M1 移动 hash 路由", () => {
  it("窄屏路由表六个入口均可解析", () => {
    expect(parseMobileHash("#/m")).toEqual({ page: "today" });
    expect(parseMobileHash("#/m/things")).toEqual({ page: "things" });
    expect(parseMobileHash("#/m/focus/foc_1")).toEqual({ page: "focus", focusId: "foc_1" });
    expect(parseMobileHash("#/m/lane/foc_1/lan_1")).toEqual({ page: "lane", focusId: "foc_1", laneId: "lan_1" });
    expect(parseMobileHash("#/m/card/confirmation/apr_1")).toEqual({ page: "card", kind: "confirmation", id: "apr_1" });
    expect(parseMobileHash("#/m/chat")).toEqual({ page: "chat" });
  });

  it("窄屏接手桌面 hash 时映射到对应移动页", () => {
    expect(parseMobileHash("#/today")).toEqual({ page: "today" });
    expect(parseMobileHash("#/focuses")).toEqual({ page: "things" });
    expect(parseMobileHash("#/focus/foc_1")).toEqual({ page: "focus", focusId: "foc_1" });
    expect(parseMobileHash("#/chat-new")).toEqual({ page: "chat" });
  });

  it("宽屏移动路由按对应桌面页降级", () => {
    expect(desktopRouteForMobileHash("#/m")).toBe("/today");
    expect(desktopRouteForMobileHash("#/m/things")).toBe("/focuses");
    expect(desktopRouteForMobileHash("#/m/focus/foc_1")).toBe("/focus/foc_1");
    expect(desktopRouteForMobileHash("#/m/lane/foc_1/lan_1")).toBe("/focus/foc_1");
    expect(desktopRouteForMobileHash("#/m/card/task/tsk_1")).toBe("/today");
    expect(desktopRouteForMobileHash("#/m/chat")).toBe("/chat-new");
    expect(desktopRouteForMobileHash("#/today")).toBeNull();
  });

  it("视口边界严格为小于 768px", () => {
    expect(isMobileViewport(767)).toBe(true);
    expect(isMobileViewport(768)).toBe(false);
  });

  it("原生壳注入的强制标志只认字面 true(iPad 宽视口保移动壳)", () => {
    expect(isForcedMobileShell({ __saydoForceMobileShell: true })).toBe(true);
    expect(isForcedMobileShell({ __saydoForceMobileShell: "true" })).toBe(false);
    expect(isForcedMobileShell({ __saydoForceMobileShell: undefined })).toBe(false);
    expect(isForcedMobileShell({})).toBe(false);
  });
});
