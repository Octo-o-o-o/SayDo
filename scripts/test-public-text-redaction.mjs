#!/usr/bin/env node
// 公开文本脱敏自测。敏感样本运行时片段拼接,本文件静态扫描不得自命中。
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  countPublicPrivacyHits,
  HOME_PLACEHOLDER,
  PRIVATE_IP_PLACEHOLDER,
  redactPublicText,
  safeExcerpt
} from "./public-text-redaction.mjs";

const here = dirname(fileURLToPath(import.meta.url));
let pass = 0;
let fail = 0;

function ipv4(...parts) {
  return parts.join(".");
}

function macHome(user, rest = "") {
  return ["", "Users", user].join("/") + rest;
}

function linuxHome(user, rest = "") {
  return ["", "home", user].join("/") + rest;
}

function winHome(user, rest = "", sep = "\\") {
  return ["C:", "Users", user].join(sep) + rest;
}

function expect(label, actual, predicate) {
  if (predicate(actual)) {
    process.stdout.write(`[ok] ${label}\n`);
    pass += 1;
  } else {
    process.stdout.write(`[fail] ${label}\n`);
    fail += 1;
  }
}

function expectClean(label, text) {
  const hits = countPublicPrivacyHits(text);
  expect(label, hits, (value) => Object.keys(value).length === 0);
}

function expectNotContains(label, haystack, needle) {
  expect(label, haystack, (value) => !String(value).includes(needle));
}

const mac = macHome("alice", "/WorkSpace/SayDo");
const macUpper = macHome("Alice", "/tmp");
const linux = linuxHome("bob", "/proj");
const winSlash = winHome("carol", "/docs", "/");
const winBack = winHome("dave", "\\docs", "\\");
const ip10 = ipv4(10, 1, 2, 3);
const ip192 = ipv4(192, 168, 31, 132);
const ip172a = ipv4(172, 16, 0, 1);
const ip172b = ipv4(172, 31, 255, 254);
const loopback = ipv4(127, 0, 0, 1);
const publicDns = ipv4(8, 8, 8, 8);
const cgnat = ipv4(100, 64, 0, 1);

expect("mac home redacts", redactPublicText(`cwd ${mac}`), (value) => value.includes(HOME_PLACEHOLDER) && !value.includes(mac));
expect("mac case variant redacts", redactPublicText(macUpper), (value) => value.includes(HOME_PLACEHOLDER) && !value.includes(macUpper));
expect("linux home redacts", redactPublicText(linux), (value) => value.includes(HOME_PLACEHOLDER) && !value.includes(linux));
expect("windows slash home redacts", redactPublicText(winSlash), (value) => value.includes(HOME_PLACEHOLDER) && !value.includes(winSlash));
expect("windows backslash home redacts", redactPublicText(winBack), (value) => value.includes(HOME_PLACEHOLDER) && !value.includes(winBack));

expect("rfc1918 10/8", redactPublicText(`lan ${ip10}`), (value) => value.includes(PRIVATE_IP_PLACEHOLDER) && !value.includes(ip10));
expect("rfc1918 192.168/16", redactPublicText(`http://${ip192}:47100/`), (value) => value.includes(PRIVATE_IP_PLACEHOLDER) && !value.includes(ip192));
expect("rfc1918 172.16", redactPublicText(ip172a), (value) => value === PRIVATE_IP_PLACEHOLDER);
expect("rfc1918 172.31", redactPublicText(ip172b), (value) => value === PRIVATE_IP_PLACEHOLDER);

expect(
  "punctuation boundary",
  redactPublicText(`see ${macHome("alice")}, ok`),
  (value) => value === `see ${HOME_PLACEHOLDER}, ok`
);
expect("mid-sentence home", redactPublicText(`在 ${linux} 跑`), (value) => value.includes(HOME_PLACEHOLDER) && !value.includes(linux));

expectClean("loopback kept", `listen ${loopback}`);
expectClean("public dns kept", `dns ${publicDns}`);
expectClean("cgnat kept", `tailscale ${cgnat}`);
expectClean("public domain kept", "https://github.com/Octo-o-o-o/SayDo");
expectClean("placeholder home kept", `repo at ${HOME_PLACEHOLDER}/WorkSpace/SayDo`);
expectClean("placeholder ip kept", `url http://${PRIVATE_IP_PLACEHOLDER}:47100/`);
expectClean("version not ip", "pnpm@10.33.1 and Windows 10.0.26200");

const idempotentInput = `path=${mac} ip=${ip192}`;
const once = redactPublicText(idempotentInput);
const twice = redactPublicText(once);
expect("redaction idempotent", twice, (value) => value === once);

const longHome = macHome("alice", "/" + "x".repeat(400));
const excerpt = safeExcerpt(longHome);
expect("excerpt length cap", excerpt, (value) => value.length <= 220);
expectNotContains("redact before truncate", excerpt, macHome("alice"));
expect("excerpt has placeholder", excerpt, (value) => value.includes(HOME_PLACEHOLDER));

const messy = `cwd:\n\t${mac}\n`;
const excerptOrder = safeExcerpt(messy);
expect("redact before whitespace", excerptOrder, (value) => value.includes(HOME_PLACEHOLDER) && !value.includes(mac));

const mdRaw = `[x](${mac}/packages/console/src/file.ts:1)`;
const mdRedacted = redactPublicText(mdRaw);
const mdDest = [...mdRedacted.matchAll(/!?\[[^\]\n]*\]\((<[^>]+>|[^)\s]+)(?:\s+["'][^"']*["'])?\)/g)].map((row) => row[1]);
const mdExpected = `[x](${HOME_PLACEHOLDER}/WorkSpace/SayDo/packages/console/src/file.ts:1)`;
expect("markdown destination stays one token", mdDest, (value) => value.length === 1 && value[0] === `${HOME_PLACEHOLDER}/WorkSpace/SayDo/packages/console/src/file.ts:1`);
expect("markdown destination is not angle-wrapped", mdRedacted, (value) => !value.includes("](<") && value === mdExpected);

expect("helper source has zero hits", countPublicPrivacyHits(readFileSync(join(here, "public-text-redaction.mjs"), "utf8")), (value) =>
  Object.keys(value).length === 0
);
expect("self-test source has zero hits", countPublicPrivacyHits(readFileSync(fileURLToPath(import.meta.url), "utf8")), (value) =>
  Object.keys(value).length === 0
);

const brokenDest = /\]\(<(?:home|account|private-ip)\b/;
const generatedSkip = new Set([
  "docs/review/2026-08-22-week-audit-ledger.md",
  "docs/review/2026-08-23-remediation-ledger.md",
  "research/week-audit/2026-08-22-ledger.json",
  "research/week-audit/2026-08-22-semantic-review.json",
  "research/week-audit/2026-08-22-bundle-integrity.json",
  "research/week-audit/2026-08-23-publication-manifest.json",
  "research/week-audit/2026-08-23-remediation-ledger.json"
]);
const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: join(here, ".."), encoding: "utf8" }).split("\0").filter(Boolean);
let broken = 0;
for (const rel of tracked) {
  if (generatedSkip.has(rel)) continue;
  if (!/\.(md|json|jsonl|mjs|ts|tsx|sh)$/.test(rel)) continue;
  let text;
  try {
    text = readFileSync(join(here, "..", rel), "utf8");
  } catch {
    continue;
  }
  if (brokenDest.test(text)) broken += 1;
}
expect("tracked files have no angle-wrapped privacy destinations", broken, (value) => value === 0);

process.stdout.write(`public-text-redaction self-test: pass=${pass} fail=${fail}\n`);
process.exit(fail === 0 ? 0 : 1);
