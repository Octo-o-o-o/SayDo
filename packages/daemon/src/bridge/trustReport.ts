// trust-report 嵌入合同(11 §5.5;Codex 复审 A2/A4;P0.5-D 的 AI 侧前置):
// - RunSettled.summary_path 指向 .md ——校验在受信 vault 内(防越界)后受控映射到同 basename .html
//   (Hopper post-run 同时生成,2026-07-25 对锁定副本实证);文件缺失/扩展名异常按证据缺失处理;
// - 呈现层确定性字符转换:报告内 emoji 按映射表替换为文本标记 + DOM 字符门禁(残留一律替换,
//   转换后零 pictographic)——**原始文件原样留存、不改变证据 digest**,转换只发生在呈现层。

import { existsSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, join, resolve, sep } from "node:path";

export type TrustReportResolve = { ok: true; htmlPath: string } | { ok: false; reason: string };

/** 受控映射:summary_path(.md)-> 同 basename .html;越界/扩展名异常/缺失 => 证据缺失(fail-closed) */
export function resolveTrustReportHtml(vaultRoot: string, summaryPath: string): TrustReportResolve {
  if (!summaryPath.endsWith(".md")) return { ok: false, reason: `summary_path 扩展名异常(期望 .md): ${summaryPath}` };
  const abs = isAbsolute(summaryPath) ? summaryPath : join(vaultRoot, summaryPath);
  const base = resolve(vaultRoot);
  const resolved = resolve(abs);
  if (resolved !== base && !resolved.startsWith(base + sep)) {
    return { ok: false, reason: "summary_path 越界(不在受信 vault 内)" };
  }
  if (!existsSync(resolved)) return { ok: false, reason: "summary(.md)缺失(证据缺失,不 settle 不渲染)" };
  // realpath 防 symlink 逃逸(解析后仍须在 vault 内)
  const real = realpathSync(resolved);
  const realBase = realpathSync(base);
  if (real !== realBase && !real.startsWith(realBase + sep)) {
    return { ok: false, reason: "summary_path symlink 逃逸" };
  }
  const htmlPath = real.slice(0, -3) + ".html";
  if (!existsSync(htmlPath)) return { ok: false, reason: "同 basename .html 缺失(按证据缺失处理)" };
  return { ok: true, htmlPath };
}

/** 已知符号映射表(11 §5.5"按映射表替换为文本标记";11 §8 状态标记词表) */
const EMOJI_MAP: [RegExp, string][] = [
  [/\u2705|\u2714\uFE0F?|\u2713/gu, "[ok]"],
  [/\u274C|\u2717|\u2718/gu, "[fail]"],
  [/\u26A0\uFE0F?/gu, "[warn]"],
  [/\u23F3|\u231B/gu, "[wait]"],
  [/\u{1F7E2}/gu, "[ok]"],
  [/\u{1F534}/gu, "[fail]"],
  [/\u{1F7E1}/gu, "[warn]"]
];

/** 禁区(11 §12 收窄正则同源:真 emoji + 变体选择符 + 杂项符号/装饰区;放行文本箭头 U+2190-21FF)。
 *  变体选择符 FE0F 用交替式(组合字符进字符类会触 no-misleading-character-class)。 */
const BANNED_RE = /(?:[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]|\uFE0F)/gu;

export interface TransformResult {
  html: string;
  replacedKnown: number;
  replacedResidual: number;
}

/** 呈现层确定性转换:映射表先行,残留禁区字符一律替换 [sym](DOM 字符门禁——转换后零 pictographic) */
export function transformForPresentation(rawHtml: string): TransformResult {
  let html = rawHtml;
  let known = 0;
  for (const [re, marker] of EMOJI_MAP) {
    html = html.replace(re, () => {
      known += 1;
      return marker;
    });
  }
  let residual = 0;
  html = html.replace(BANNED_RE, () => {
    residual += 1;
    return "[sym]";
  });
  return { html, replacedKnown: known, replacedResidual: residual };
}

/** 一步到位:resolve + 读取 + 转换(daemon 呈现层入口;原始文件不动) */
export function loadTrustReportForPresentation(vaultRoot: string, summaryPath: string): { ok: true; html: string } | { ok: false; reason: string } {
  const r = resolveTrustReportHtml(vaultRoot, summaryPath);
  if (!r.ok) return r;
  const raw = readFileSync(r.htmlPath, "utf8");
  const t = transformForPresentation(raw);
  if (BANNED_RE.test(t.html)) return { ok: false, reason: "DOM 字符门禁:转换后仍有禁区字符(实现缺陷,拒渲染)" };
  return { ok: true, html: t.html };
}
