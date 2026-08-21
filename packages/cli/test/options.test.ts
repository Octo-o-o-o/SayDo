import { describe, expect, it } from "vitest";
import { isAbsolute, resolve } from "node:path";
import { parseCliOptions, resolveSaydoHome } from "../src/options.js";

describe("CLI 参数", () => {
  it("SAYDO_HOME 优先级为 --home > env > 默认值", () => {
    expect(resolveSaydoHome("/tmp/explicit", "/tmp/env")).toBe(resolve("/tmp/explicit"));
    expect(resolveSaydoHome(undefined, "/tmp/env")).toBe(resolve("/tmp/env"));
    expect(resolveSaydoHome(undefined, undefined)).toMatch(/\.saydo$/);
    expect(resolveSaydoHome(undefined, "")).toMatch(/\.saydo$/);
    expect(() => resolveSaydoHome("relative", undefined)).toThrow(/绝对路径/);
  });

  it("C2: HOME 与 SAYDO_HOME 皆空时给出明确 OS home unavailable", () => {
    const prevHome = process.env.HOME;
    const prevSaydo = process.env.SAYDO_HOME;
    try {
      process.env.HOME = "";
      delete process.env.SAYDO_HOME;
      // 若 os.homedir/userInfo 仍可解析则回退；仅在都不可用时抛错。
      try {
        const home = resolveSaydoHome(undefined, "");
        expect(home.endsWith(".saydo")).toBe(true);
        expect(isAbsolute(home)).toBe(true);
      } catch (err) {
        expect(String(err)).toMatch(/OS home unavailable/);
      }
    } finally {
      if (prevHome === undefined) delete process.env.HOME;
      else process.env.HOME = prevHome;
      if (prevSaydo === undefined) delete process.env.SAYDO_HOME;
      else process.env.SAYDO_HOME = prevSaydo;
    }
  });

  it("显式端口覆盖环境变量", () => {
    expect(parseCliOptions(["up", "--home", "/tmp/saydo", "--port", "48123", "--no-open"], {
      SAYDO_DAEMON_PORT: "47100"
    })).toEqual({ command: "up", home: resolve("/tmp/saydo"), port: 48123, openBrowser: false });
    expect(parseCliOptions(["up", "--home", "/tmp/saydo"], { SAYDO_DAEMON_PORT: "48124" }).port).toBe(47100);
  });

  it("拒绝未知命令与非法端口", () => {
    expect(() => parseCliOptions(["start"])).toThrow(/用法/);
    expect(() => parseCliOptions(["up", "--port", "0"])).toThrow(/端口非法/);
    expect(() => parseCliOptions(["up", "--bogus"])).toThrow(/未知参数/);
    expect(() => parseCliOptions(["up", "stray"])).toThrow(/未知参数/);
    expect(() => parseCliOptions(["up", "--port", "47100", "--port", "48100"])).toThrow(/参数重复/);
    expect(() => parseCliOptions(["up", "--home", "/tmp/a", "--home", "/tmp/b"])).toThrow(/参数重复/);
  });
});
