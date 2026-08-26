#!/usr/bin/env node
// Pairing URL corpus gate: byte-check generated fixtures and run the reference parser
// on assembled inputs. Native tests must iterate the fixtures; this file does not grep comments.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  FIXTURE_REL,
  assembleInput,
  assembleName,
  generateAll,
  loadCorpus,
  privacyHits,
  repoRoot
} from "./pairing-url-fixtures.mjs";

const repo = repoRoot();
const corpus = loadCorpus(repo);
const generated = generateAll(corpus);
const write = process.argv.includes("--write");
let pass = 0;
let fail = 0;

function record(ok, label, detail = "") {
  if (ok) {
    process.stdout.write(`[ok] ${label}\n`);
    pass += 1;
  } else {
    process.stdout.write(`[fail] ${label}${detail ? `: ${detail}` : ""}\n`);
    fail += 1;
  }
}

function asciiTrim(value) {
  let start = 0;
  let end = value.length;
  while (start < end) {
    const code = value.charCodeAt(start);
    if (code === 0x20 || code === 0x09 || code === 0x0d || code === 0x0a) start += 1;
    else break;
  }
  while (end > start) {
    const code = value.charCodeAt(end - 1);
    if (code === 0x20 || code === 0x09 || code === 0x0d || code === 0x0a) end -= 1;
    else break;
  }
  return value.slice(start, end);
}

function isUnreserved(code) {
  return (
    (code >= 0x41 && code <= 0x5a) ||
    (code >= 0x61 && code <= 0x7a) ||
    (code >= 0x30 && code <= 0x39) ||
    code === 0x2d ||
    code === 0x2e ||
    code === 0x5f ||
    code === 0x7e
  );
}

function isHex(code) {
  return (
    (code >= 0x30 && code <= 0x39) ||
    (code >= 0x41 && code <= 0x46) ||
    (code >= 0x61 && code <= 0x66)
  );
}

function assertRawAtom(raw) {
  if (raw.length === 0) throw new Error("empty");
  let i = 0;
  while (i < raw.length) {
    const code = raw.charCodeAt(i);
    if (code === 0x25) {
      if (i + 2 >= raw.length) throw new Error("truncated");
      if (!isHex(raw.charCodeAt(i + 1)) || !isHex(raw.charCodeAt(i + 2))) throw new Error("bad hex");
      i += 3;
      continue;
    }
    if (!isUnreserved(code)) throw new Error("raw");
    i += 1;
  }
}

function percentDecode(raw) {
  const bytes = [];
  let i = 0;
  while (i < raw.length) {
    if (raw.charCodeAt(i) === 0x25) {
      bytes.push(parseInt(raw.slice(i + 1, i + 3), 16));
      i += 3;
      continue;
    }
    bytes.push(raw.charCodeAt(i));
    i += 1;
  }
  const buf = Buffer.from(bytes);
  return new TextDecoder("utf-8", { fatal: true }).decode(buf);
}

function isRfc1918(host) {
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  const oct = [];
  for (const part of parts) {
    if (!part || (part.length > 1 && part[0] === "0") || !/^[0-9]+$/.test(part)) return false;
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return false;
    oct.push(n);
  }
  if (oct[0] === 10) return true;
  if (oct[0] === 192 && oct[1] === 168) return true;
  if (oct[0] === 172 && oct[1] >= 16 && oct[1] <= 31) return true;
  return false;
}

function isHextet(part) {
  return part.length >= 1 && part.length <= 4 && /^[0-9A-Fa-f]+$/.test(part);
}

function isIpv6(host) {
  if (!host.includes(":") || host.includes(".")) return false;
  if (!/^[0-9A-Fa-f:]+$/.test(host)) return false;
  const first = host.indexOf("::");
  const last = host.lastIndexOf("::");
  if (first >= 0) {
    if (first !== last) return false;
    const left = host.slice(0, first);
    const right = host.slice(first + 2);
    const leftParts = left.length === 0 ? [] : left.split(":");
    const rightParts = right.length === 0 ? [] : right.split(":");
    return (
      leftParts.length + rightParts.length < 8 &&
      leftParts.every(isHextet) &&
      rightParts.every(isHextet)
    );
  }
  const parts = host.split(":");
  return parts.length === 8 && parts.every(isHextet);
}

function isUla(host) {
  if (!isIpv6(host)) return false;
  const first = host.split(":")[0];
  if (!first) return false;
  const n = parseInt(first, 16);
  return n >= 0xfc00 && n <= 0xfdff;
}

function parseReference(value) {
  const trimmed = asciiTrim(value);
  if (!/^http:\/\//i.test(trimmed) || /^https:\/\//i.test(trimmed)) throw new Error("scheme");
  if (trimmed.includes("@") || trimmed.includes("#")) throw new Error("user/frag");
  const rest = trimmed.slice(7);
  {
    let i = 0;
    let inBrackets = false;
    let saw = false;
    while (i < rest.length) {
      const code = rest.charCodeAt(i);
      if (!inBrackets && (code === 0x2f || code === 0x3f)) break;
      if (code < 0x21 || code > 0x7e) throw new Error("authority");
      saw = true;
      if (code === 0x5b) inBrackets = true;
      if (code === 0x5d) inBrackets = false;
      i += 1;
    }
    if (!saw) throw new Error("authority");
  }
  let cursor = 0;
  if (rest.startsWith("[")) {
    const close = rest.indexOf("]");
    if (close < 2) throw new Error("ipv6");
    cursor = close + 1;
  }
  while (cursor < rest.length && rest[cursor] !== "/" && rest[cursor] !== "?") cursor += 1;
  const authority = rest.slice(0, cursor);
  const remainder = rest.slice(cursor);
  const q = remainder.indexOf("?");
  const path = q >= 0 ? remainder.slice(0, q) : remainder;
  const query = q >= 0 ? remainder.slice(q + 1) : "";
  if (path !== "" && path !== "/") throw new Error("path");
  let host;
  let portRaw;
  if (authority.startsWith("[")) {
    const close = authority.indexOf("]");
    host = authority.slice(1, close);
    if (authority[close + 1] !== ":") throw new Error("port");
    portRaw = authority.slice(close + 2);
    if (!isUla(host)) throw new Error("host");
  } else {
    const colon = authority.indexOf(":");
    if (colon <= 0 || colon !== authority.lastIndexOf(":") || colon === authority.length - 1) {
      throw new Error("auth");
    }
    host = authority.slice(0, colon);
    portRaw = authority.slice(colon + 1);
    if (!isRfc1918(host)) throw new Error("host");
  }
  if (!/^[0-9]+$/.test(portRaw)) throw new Error("port");
  const port = Number(portRaw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("port");
  const pairs = query.split("&");
  if (pairs.length !== 1) throw new Error("query");
  const sep = pairs[0].indexOf("=");
  if (sep <= 0) throw new Error("query");
  const rawName = pairs[0].slice(0, sep);
  const rawValue = pairs[0].slice(sep + 1);
  assertRawAtom(rawName);
  assertRawAtom(rawValue);
  const name = percentDecode(rawName);
  const token = percentDecode(rawValue);
  if (name !== "token" || token.length === 0) throw new Error("token");
  return { token, name: `${host}:${port}` };
}

if (write) {
  for (const [key, rel] of Object.entries(FIXTURE_REL)) {
    writeFileSync(join(repo, rel), generated[key]);
  }
}

for (const [key, rel] of Object.entries(FIXTURE_REL)) {
  let disk = "";
  try {
    disk = readFileSync(join(repo, rel), "utf8");
  } catch (error) {
    record(false, `${key} fixture readable`, String(error.message || error));
    continue;
  }
  const expected = generated[key];
  record(disk === expected, `${key} fixture matches generator`, `rel=${rel}`);
  record(disk.includes("Generated from scripts/pairing-url-corpus.json"), `${key} fixture marks generated`);
  for (const item of corpus.cases) {
    record(disk.includes(`"${item.id}"`) || disk.includes(`'${item.id}'`), `${key} fixture has ${item.id}`);
  }
}

const privacyFiles = ["scripts/pairing-url-corpus.json", ...Object.values(FIXTURE_REL)];
for (const rel of privacyFiles) {
  const text = readFileSync(join(repo, rel), "utf8");
  const hits = privacyHits(text);
  record(hits.length === 0, `${rel} has no full private address`, hits.join(" | "));
}

const requiredIds = [
  "accept-ascii-trim",
  "accept-trim-cr",
  "accept-trim-lf",
  "accept-trim-crlf",
  "accept-trim-mixed",
  "accept-percent-bmp",
  "accept-percent-non-bmp",
  "reject-bom",
  "reject-nbsp",
  "reject-raw-at",
  "reject-raw-space",
  "reject-raw-tab",
  "reject-raw-nul",
  "reject-raw-brackets",
  "reject-raw-non-bmp",
  "reject-overlong",
  "reject-surrogate-utf8",
  "reject-truncated-utf8",
  "reject-truncated-percent",
  "reject-duplicate-token",
  "reject-userinfo",
  "reject-empty-fragment",
  "reject-fullwidth-digit-authority",
  "reject-fullwidth-dot-authority",
  "reject-ideographic-dot-authority",
  "reject-circled-digit-authority",
  "reject-zwsp-authority",
  "accept-ula",
  "accept-ula-compressed-short",
  "reject-ula-trailing-single-colon",
  "reject-ula-leading-single-colon",
  "reject-ula-triple-colon"
];
const have = new Set(corpus.cases.map((item) => item.id));
for (const id of requiredIds) {
  record(have.has(id), `corpus includes ${id}`);
}

for (const item of corpus.cases) {
  const input = assembleInput(item, corpus.hosts);
  let parsed = null;
  let threw = false;
  try {
    parsed = parseReference(input);
  } catch {
    threw = true;
  }
  if (item.accept) {
    record(!threw, `corpus ${item.id} reference accepts`);
    if (!threw) {
      record(parsed.token === item.token, `corpus ${item.id} token`);
      record(parsed.name === assembleName(item, corpus.hosts), `corpus ${item.id} name`);
    }
  } else {
    record(threw, `corpus ${item.id} reference rejects`);
  }
}

const androidTest = readFileSync(
  join(repo, "apps/android/app/src/test/java/com/octoooo/saydo/DesktopProfileTest.kt"),
  "utf8"
);
const iosTest = readFileSync(join(repo, "apps/ios/SayDoTests/DesktopProfileTests.swift"), "utf8");
const harmonyTest = readFileSync(
  join(repo, "apps/harmonyos/entry/src/test/PairingUrl.test.ets"),
  "utf8"
);
record(
  androidTest.includes("PairingUrlCorpus.cases") &&
    androidTest.includes("item.input()") &&
    androidTest.includes("fromPairingUrl(input)"),
  "android test iterates fixture and calls fromPairingUrl"
);
record(
  iosTest.includes("PairingUrlCorpus.cases") && iosTest.includes("pairingURLString: item.input"),
  "ios test iterates fixture and calls pairingURLString"
);
record(
  harmonyTest.includes("pairingCorpusCases()") && harmonyTest.includes("parsePairingUrl(input)"),
  "harmony test iterates fixture and calls parsePairingUrl"
);
record(
  androidTest.includes("rejectsMalformedCompressedIpv6") &&
    iosTest.includes("testRejectsMalformedCompressedIpv6") &&
    harmonyTest.includes("rejects_malformed_compressed_ipv6"),
  "three-end native tests cover compressed IPv6 empty-hextet regressions"
);

const unicodeRejectIds = [
  "reject-fullwidth-digit-authority",
  "reject-fullwidth-dot-authority",
  "reject-ideographic-dot-authority",
  "reject-circled-digit-authority",
  "reject-zwsp-authority"
];
const ipv6DirectedIds = [
  "accept-ula-compressed-short",
  "reject-ula-trailing-single-colon",
  "reject-ula-leading-single-colon",
  "reject-ula-triple-colon"
];
function fixtureMismatch(ids) {
  return Object.keys(FIXTURE_REL).reduce((count, key) => {
    const disk = readFileSync(join(repo, FIXTURE_REL[key]), "utf8");
    const present = ids.filter((id) => disk.includes(`"${id}"`) || disk.includes(`'${id}'`));
    return count + (ids.length - present.length);
  }, 0);
}
const unicodeMismatch = fixtureMismatch(unicodeRejectIds);
const ipv6Mismatch = fixtureMismatch(ipv6DirectedIds);
record(
  unicodeMismatch === 0,
  `222-case five-class unicode authority reject present on three ends (${unicodeRejectIds.length} classes, ${unicodeMismatch} mismatch)`
);
record(
  ipv6Mismatch === 0,
  `IPv6 directed compressed-empty-hextet cases present on three ends (${ipv6DirectedIds.length} cases, ${ipv6Mismatch} mismatch)`
);

if (fail > 0) {
  process.stdout.write(`[fail] pairing url corpus ${fail} failed, ${pass} passed\n`);
  process.exit(1);
}
process.stdout.write(`[ok] pairing url corpus ${pass} passed\n`);
