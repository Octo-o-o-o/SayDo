import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  MOBILE_ATTENTION_ENDPOINT,
  MOBILE_RECENT_MEMORY_ENDPOINT,
  MOBILE_RECENT_TRANSCRIPT_ENDPOINT,
  mobileMemoryPath
} from "./data";

describe("M-Today 与桌面 Today 同源", () => {
  it("两棵组件树都消费 /api/attention", () => {
    const desktopToday = readFileSync(new URL("../pages/Today.tsx", import.meta.url), "utf8");
    expect(MOBILE_ATTENTION_ENDPOINT).toBe("/api/attention");
    expect(desktopToday).toContain('apiGet<{ items: AttentionItem[] }>("/api/attention")');
  });
});

describe("M 记忆与历史回放端点", () => {
  it("菜单记忆库走全局 recent;项目路径与桌面 Memory 仍同源", () => {
    const desktopMemory = readFileSync(new URL("../pages/Memory.tsx", import.meta.url), "utf8");
    const api = readFileSync(new URL("../lib/api.ts", import.meta.url), "utf8");
    const chrome = readFileSync(new URL("./MobileChrome.tsx", import.meta.url), "utf8");
    expect(mobileMemoryPath("prj_x")).toBe("/api/projects/prj_x/memory");
    expect(api).toContain("`/api/projects/${id}/memory`");
    expect(desktopMemory).toContain("api.memory(projectId)");
    expect(MOBILE_RECENT_TRANSCRIPT_ENDPOINT).toBe("/api/sessions/recent-transcript");
    expect(MOBILE_RECENT_MEMORY_ENDPOINT).toBe("/api/memory/recent");
    expect(chrome).toContain("loadRecentMemories");
    expect(chrome).not.toContain("collectMemoryProjectIds");
  });
});
