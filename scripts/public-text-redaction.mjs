#!/usr/bin/env node
// 公开文本脱敏:三平台用户 home 与 RFC1918 地址。必须在空白归一、截断、excerpt/hash 落盘之前执行。
// 规则由片段拼接,源文件静态扫描不得自命中完整 home / 私网地址。

const OCTET = "(?:25[0-5]|2[0-4]\\d|1\\d{2}|[1-9]?\\d)";
const USER = "[A-Za-z_][A-Za-z0-9._-]*";
const USERS_SEG = "Use" + "rs";
const HOME_SEG = "ho" + "me";
const TEN = "1" + "0";
const C192 = "19" + "2";
const C168 = "16" + "8";
const C172 = "17" + "2";

function compile(source, flags) {
  return new RegExp(source, flags);
}

const macHomeBody = `/${USERS_SEG}/(?!Shared\\b)(${USER})`;
const linuxHomeBody = `/${HOME_SEG}/(${USER})`;
const winHomeBody = `[A-Za-z]:[\\\\/]${USERS_SEG}[\\\\/](?!Public\\b)(?!Default\\b)(${USER})`;

export const HOME_MACOS_RE = compile(`(?<=^|[^A-Za-z0-9])${macHomeBody}`, "gi");
export const HOME_LINUX_RE = compile(`(?<=^|[^A-Za-z0-9])${linuxHomeBody}`, "gi");
export const HOME_WINDOWS_RE = compile(`(?<=^|[^A-Za-z0-9])${winHomeBody}`, "gi");
export const RFC1918_RE = compile(
  `\\b(?:${TEN}(?:\\.${OCTET}){3}|${C192}\\.${C168}(?:\\.${OCTET}){2}|${C172}\\.(?:1[6-9]|2\\d|3[0-1])(?:\\.${OCTET}){2})\\b`,
  "g"
);

export const HOME_PLACEHOLDER = "~";
export const PRIVATE_IP_PLACEHOLDER = "<private-ip>";

export const PUBLIC_PRIVACY_RULES = [
  { category: "home-macos", re: HOME_MACOS_RE },
  { category: "home-linux", re: HOME_LINUX_RE },
  { category: "home-windows", re: HOME_WINDOWS_RE },
  { category: "rfc1918", re: RFC1918_RE }
];

export function countPatternHits(text, re) {
  const copy = compile(re.source, re.flags);
  return [...String(text).matchAll(copy)].length;
}

export function countPublicPrivacyHits(text) {
  const counts = {};
  for (const rule of PUBLIC_PRIVACY_RULES) {
    const n = countPatternHits(text, rule.re);
    if (n > 0) counts[rule.category] = n;
  }
  return counts;
}

export function redactPublicText(value) {
  let text = String(value).replaceAll("\0", "");
  text = text.replace(compile(HOME_MACOS_RE.source, HOME_MACOS_RE.flags), HOME_PLACEHOLDER);
  text = text.replace(compile(HOME_LINUX_RE.source, HOME_LINUX_RE.flags), HOME_PLACEHOLDER);
  text = text.replace(compile(HOME_WINDOWS_RE.source, HOME_WINDOWS_RE.flags), HOME_PLACEHOLDER);
  text = text.replace(compile(RFC1918_RE.source, RFC1918_RE.flags), PRIVATE_IP_PLACEHOLDER);
  return text;
}

export function stripForbiddenChars(value) {
  return [...String(value)]
    .map((character) => {
      const codePoint = character.codePointAt(0);
      const forbidden =
        codePoint === 0xfe0f ||
        (codePoint >= 0x2600 && codePoint <= 0x27bf) ||
        (codePoint >= 0x1f000 && codePoint <= 0x1faff) ||
        /\p{Emoji_Presentation}/u.test(character);
      return forbidden ? `[U+${codePoint.toString(16).toUpperCase()}]` : character;
    })
    .join("");
}

export function safeExcerpt(value, maxLen = 220) {
  const redacted = redactPublicText(value);
  const normalized = stripForbiddenChars(redacted).replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLen) return normalized;
  const keep = Math.max(0, maxLen - 3);
  return `${normalized.slice(0, keep)}...`;
}
