/** Windows CRT / CommandLineToArgvW 兼容的 argv 逆算法。禁止手写半套转义。 */

const NEED_QUOTE = /[\s\t"]/u;

/**
 * 单个 argv 分量。覆盖空参数、空格、quote、quote 前连续反斜杠、trailing backslash。
 * 与 UCRT / libuv quote_cmd_arg / Python list2cmdline 同构。
 */
export function quoteWin32Arg(value: string): string {
  if (value.includes("\0")) throw new Error("win32 argv contains NUL");
  if (value.length === 0) return '""';
  if (!NEED_QUOTE.test(value)) return value;
  let out = '"';
  let backslashes = 0;
  for (const ch of value) {
    if (ch === "\\") {
      backslashes += 1;
      continue;
    }
    if (ch === '"') {
      out += "\\".repeat(backslashes * 2);
      out += '\\"';
      backslashes = 0;
      continue;
    }
    out += "\\".repeat(backslashes);
    out += ch;
    backslashes = 0;
  }
  out += "\\".repeat(backslashes * 2);
  out += '"';
  return out;
}

export function quoteWin32CommandLine(file: string, args: readonly string[]): string {
  if (file.includes("\0") || args.some((arg) => arg.includes("\0"))) {
    throw new Error("win32 command line contains NUL");
  }
  return [quoteWin32Arg(file), ...args.map(quoteWin32Arg)].join(" ");
}

export const WIN32_ARGV_QUOTE_CASES: ReadonlyArray<{ args: string[]; line: string }> = [
  { args: [""], line: '""' },
  { args: ["abc"], line: "abc" },
  { args: ["a b"], line: '"a b"' },
  { args: ['a"b'], line: '"a\\"b"' },
  { args: ["foo\\bar"], line: "foo\\bar" },
  { args: ["foo\\"], line: "foo\\" },
  { args: ["foo bar\\"], line: '"foo bar\\\\"' },
  { args: ['foo\\"bar'], line: '"foo\\\\\\"bar"' },
  { args: ["a\\\\b"], line: "a\\\\b" },
  { args: ['quote before\\\\"x'], line: '"quote before\\\\\\\\\\"x"' },
  { args: ["\u4e2d\u6587 空格"], line: '"\u4e2d\u6587 \u7a7a\u683c"' }
];
