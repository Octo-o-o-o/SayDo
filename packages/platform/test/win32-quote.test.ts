import { describe, expect, it } from "vitest";
import { quoteWin32Arg, quoteWin32CommandLine } from "../src/win32Quote.js";
import { hostKind } from "../src/host.js";
import { nativeSync, parseCommandLineWin32 } from "../src/win32.js";

describe("Windows CRT argv 逆算法", () => {
  it("固定向量：空参数、空格、quote、连续反斜杠、trailing backslash", () => {
    expect(quoteWin32Arg("")).toBe('""');
    expect(quoteWin32Arg("abc")).toBe("abc");
    expect(quoteWin32Arg("a b")).toBe('"a b"');
    expect(quoteWin32Arg('a"b')).toBe('"a\\"b"');
    expect(quoteWin32Arg("foo\\bar")).toBe("foo\\bar");
    expect(quoteWin32Arg("foo\\")).toBe("foo\\");
    expect(quoteWin32Arg("foo bar\\")).toBe('"foo bar\\\\"');
    expect(quoteWin32Arg("中文 空格")).toBe('"中文 空格"');
    expect(quoteWin32Arg('foo\\"bar')).toBe('"foo\\\\\\"bar"');
    expect(quoteWin32CommandLine("a b", ["c"]).startsWith('"a b"')).toBe(true);
  });

  it("嵌入 NUL 一律拒绝，避免 CreateProcessW 截断", () => {
    expect(() => quoteWin32Arg("a\0b")).toThrow(/NUL/u);
    expect(() => quoteWin32CommandLine("app", ["ok", "bad\0"])).toThrow(/NUL/u);
    expect(() => quoteWin32CommandLine("app\0", ["ok"])).toThrow(/NUL/u);
  });

  it.skipIf(process.platform !== "win32")("Windows 真机：嵌入 NUL 不得进入 CreateProcessW", async () => {
    const { createSuspendedOwnedWindowsProcess } = await import("../src/process.js");
    expect(() => createSuspendedOwnedWindowsProcess({
      file: process.execPath,
      args: ["-e", "ok\0"]
    })).toThrow(/NUL/u);
  });

  it.skipIf(process.platform !== "win32")("Windows 真机：CommandLineToArgvW 往返", () => {
    nativeSync();
    const cases = [
      [""],
      ["abc"],
      ["a b"],
      ['a"b'],
      ["foo\\bar"],
      ["foo bar\\"],
      ["中文 空格"],
      ["a\\\\b", 'x"y']
    ];
    for (const args of cases) {
      // CommandLineToArgvW 的 argv[0] 不走 CRT 反斜杠规则；生产 lpCommandLine 以 image 为 argv[0]。
      const line = quoteWin32CommandLine("dummy.exe", args);
      expect(parseCommandLineWin32(line).slice(1)).toEqual(args);
    }
    expect(hostKind()).toBe("win32");
  });
});
