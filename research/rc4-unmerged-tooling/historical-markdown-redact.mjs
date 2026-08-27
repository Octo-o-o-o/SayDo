#!/usr/bin/env node
// 对历史 markdown 做最小可重放变换:只改隐私敏感 destination。
// 仓内绝对 home / 已登记仓库前缀 → 存在的相对路径;仓外 home → 明确 external。
// 无隐私的 relative destination 原样保留,即使当前 broken。

import { existsSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { redactPublicText } from "./public-text-redaction.mjs";

const REPO_PREFIXES = Object.freeze([
  "~/WorkSpace/SayDo/",
  "~/WorkSpace/SayDo",
  "~/WorkSpace/voice-coding/",
  "~/WorkSpace/voice-coding"
]);
const MD_DEST = /(!?\[[^\]]*\]\()(<[^>]+>|[^)\s]+)(\))/g;

export const HISTORICAL_DESTINATION_MAP = Object.freeze({
  "research/codex-findings/04-interaction-product.md": Object.freeze({
    "../voice-coding-framework.Cursor2.md": "../../history/voice-coding-framework.Cursor2.md",
    "../scenarios/": "../../history/scenarios/"
  })
});

export function extractMarkdownDestinations(text) {
  return [...String(text).matchAll(new RegExp(MD_DEST.source, "g"))].map((row) => row[2]);
}

function stripAngles(dest) {
  const value = String(dest);
  if (value.startsWith("<") && value.endsWith(">")) return { inner: value.slice(1, -1), angled: true };
  return { inner: value, angled: false };
}

function wrapDest(inner, angled) {
  return angled ? `<${inner}>` : inner;
}

function isSchemeOrAnchor(inner) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(inner);
}

export function decodeFileLocalPath(inner) {
  const raw = String(inner);
  if (!/^file:/i.test(raw)) return raw;
  let body = raw.replace(/^file:/i, "");
  if (body.startsWith("//localhost/")) body = body.slice("//localhost".length);
  else if (/^\/\/[A-Za-z]:/.test(body)) body = body.slice(2);
  else if (body.startsWith("//")) body = body.slice(2);
  try {
    body = decodeURIComponent(body);
  } catch {
    /* keep encoded body */
  }
  if (/^\/[A-Za-z]:[\\/]/.test(body)) body = body.slice(1);
  return body;
}

export function isHomeShapedDestination(dest) {
  const inner = decodeFileLocalPath(stripAngles(dest).inner);
  if (inner === "~" || inner.startsWith("~/") || inner.startsWith("~\\")) return true;
  if (inner.startsWith("file://~")) return true;
  if (inner.startsWith("/Users/") || inner.startsWith("/home/")) return true;
  if (/^[A-Za-z]:[\\/][Uu][Ss][Ee][Rr][Ss](?:[\\/]|$)/.test(inner)) return true;
  return false;
}

function asExplicitExternal(dest) {
  const { inner, angled } = stripAngles(dest);
  if (isSchemeOrAnchor(inner)) return dest;
  return wrapDest(`file://${inner}`, angled);
}

function destinationExistsInRepo(relPath, repoRoot) {
  return existsSync(resolve(repoRoot, relPath.split("#")[0].split("?")[0]));
}

function mappedDestination(fromRel, dest, repoRoot) {
  const mapped = HISTORICAL_DESTINATION_MAP[fromRel]?.[dest];
  if (mapped == null) return null;
  const file = mapped.split("#")[0].split("?")[0];
  const absolute = resolve(repoRoot, dirname(fromRel), file);
  if (!existsSync(absolute)) {
    throw new Error("historical destination map target missing");
  }
  return mapped;
}

export function rewritePrivacyDestination(dest, fromRel, repoRoot) {
  const { inner, angled } = stripAngles(dest);
  const decoded = decodeFileLocalPath(inner);
  if (isSchemeOrAnchor(inner) && !isHomeShapedDestination(dest) && !inner.startsWith("file://~")) return dest;
  const redacted = redactPublicText(decoded);
  let rest = redacted;
  let matchedRepo = false;
  for (const prefix of REPO_PREFIXES) {
    if (rest === prefix.replace(/\/$/, "")) {
      rest = "";
      matchedRepo = true;
      break;
    }
    if (rest.startsWith(prefix)) {
      rest = rest.slice(prefix.length);
      matchedRepo = true;
      break;
    }
  }
  const match = rest.match(/^([^:#]+)(:\d+(?:-\d+)?)?(#.*)?$/);
  if (matchedRepo && match && match[1] && destinationExistsInRepo(match[1], repoRoot)) {
    let rel = relative(dirname(fromRel), match[1]).split("\\").join("/");
    if (!rel.startsWith(".") && !rel.startsWith("/")) rel = `./${rel}`;
    return wrapDest(`${rel}${match[2] ?? ""}${match[3] ?? ""}`, angled);
  }
  const candidate = redacted === inner ? dest : wrapDest(redacted, angled);
  if (isHomeShapedDestination(dest) || isHomeShapedDestination(candidate)) {
    return asExplicitExternal(candidate);
  }
  return dest;
}

function maskMarkdownCode(markdown) {
  return String(markdown)
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/`[^`\n]*`/g, (code) => " ".repeat(code.length));
}

export function transformHistoricalMarkdown(text, fromRel, repoRoot) {
  const source = String(text);
  const masked = maskMarkdownCode(source);
  const copy = new RegExp(MD_DEST.source, "g");
  let out = "";
  let last = 0;
  let match;
  while ((match = copy.exec(masked))) {
    const dest = source.slice(match.index + match[1].length, match.index + match[1].length + match[2].length);
    const left = source.slice(match.index, match.index + match[1].length);
    const right = source.slice(match.index + match[1].length + match[2].length, match.index + match[0].length);
    out += source.slice(last, match.index);
    const mapped = mappedDestination(fromRel, dest, repoRoot);
    if (mapped != null) out += `${left}${mapped}${right}`;
    else if (!isHomeShapedDestination(dest)) out += source.slice(match.index, match.index + match[0].length);
    else out += `${left}${rewritePrivacyDestination(dest, fromRel, repoRoot)}${right}`;
    last = match.index + match[0].length;
  }
  return out + source.slice(last);
}

export function nonSensitiveDestinations(text) {
  return extractMarkdownDestinations(text).filter((dest) => !isHomeShapedDestination(dest));
}

export function bodyWithoutDestinations(text) {
  return String(text).replace(new RegExp(MD_DEST.source, "g"), (full, left, dest, right) => `${left}\u0000${right}`);
}

export function applyControlledRevision(text, revision) {
  if (!revision || typeof revision !== "object") throw new Error("controlled revision 非法");
  const from = revision.from;
  const to = revision.to;
  if (typeof from !== "string" || typeof to !== "string" || from.length === 0) {
    throw new Error("controlled revision 替换非法");
  }
  const parts = String(text).split(from);
  if (parts.length !== 2) throw new Error("controlled revision from-span count");
  return parts.join(to);
}

export const HISTORICAL_MARKDOWN_PREFIXES = Object.freeze(["prompts/", "research/codex-findings/"]);

export function isHistoricalMarkdownPath(path) {
  const value = String(path ?? "");
  return HISTORICAL_MARKDOWN_PREFIXES.some((prefix) => value.startsWith(prefix)) && value.endsWith(".md");
}
