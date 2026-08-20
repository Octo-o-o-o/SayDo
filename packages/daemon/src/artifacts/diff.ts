// W5a 3.6:产物版本文本 diff(modules/b B4 P1 控制面;相邻版本对比)。
// 标准 LCS 行 diff,零依赖确定性;产物是 md/json 文档(体量小),O(n*m) 够用——
// 超大文件截断保护(行数上限,超限如实降级为"整文件替换"视图,不假装精确)。

export interface DiffLine {
  kind: "same" | "add" | "del";
  text: string;
}

const MAX_LINES = 4000;

export function diffLines(oldText: string, newText: string): { lines: DiffLine[]; truncated: boolean } {
  const a = oldText.split("\n");
  const b = newText.split("\n");
  if (a.length > MAX_LINES || b.length > MAX_LINES) {
    return {
      lines: [...a.map((text) => ({ kind: "del" as const, text })), ...b.map((text) => ({ kind: "add" as const, text }))],
      truncated: true
    };
  }
  const n = a.length;
  const m = b.length;
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    const row = dp[i] as Uint32Array;
    const next = dp[i + 1] as Uint32Array;
    for (let j = m - 1; j >= 0; j--) {
      row[j] = a[i] === b[j] ? (next[j + 1] as number) + 1 : Math.max(next[j] as number, row[j + 1] as number);
    }
  }
  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      lines.push({ kind: "same", text: a[i] as string });
      i++;
      j++;
    } else if (((dp[i + 1] as Uint32Array)[j] as number) >= ((dp[i] as Uint32Array)[j + 1] as number)) {
      lines.push({ kind: "del", text: a[i] as string });
      i++;
    } else {
      lines.push({ kind: "add", text: b[j] as string });
      j++;
    }
  }
  while (i < n) lines.push({ kind: "del", text: a[i++] as string });
  while (j < m) lines.push({ kind: "add", text: b[j++] as string });
  return { lines, truncated: false };
}
