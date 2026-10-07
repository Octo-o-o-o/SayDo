// 共用配对语料加载器与原生 fixture 生成器。
// 地址以片段存储，提交文件不含完整私网地址。
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const FIXTURE_REL = {
  android: "apps/android/app/src/test/java/com/octoooo/saydo/PairingUrlCorpus.kt",
  ios: "apps/ios/SayDoTests/PairingUrlCorpus.swift",
  harmony: "apps/harmonyos/entry/src/test/PairingUrlCorpus.ets"
};

export function repoRoot() {
  return dirname(dirname(fileURLToPath(import.meta.url)));
}

export function loadCorpus(repo = repoRoot()) {
  const corpus = JSON.parse(readFileSync(join(repo, "scripts/pairing-url-corpus.json"), "utf8"));
  if (!corpus.hosts || typeof corpus.hosts !== "object") {
    throw new Error("corpus missing hosts");
  }
  if (!Array.isArray(corpus.cases) || corpus.cases.length === 0) {
    throw new Error("corpus missing cases");
  }
  const ids = new Set();
  for (const item of corpus.cases) {
    if (!item.id || typeof item.id !== "string") throw new Error("case missing id");
    if (ids.has(item.id)) throw new Error(`duplicate id ${item.id}`);
    ids.add(item.id);
    if (typeof item.accept !== "boolean") throw new Error(`${item.id} missing accept`);
    if (!item.host || !corpus.hosts[item.host]) throw new Error(`${item.id} unknown host`);
    if (!item.prefix || !item.port || item.pathQuery === undefined) {
      throw new Error(`${item.id} missing prefix/port/pathQuery`);
    }
    if (item.accept && (item.token === undefined || !item.expectPort)) {
      throw new Error(`${item.id} accept case needs token and expectPort`);
    }
  }
  return corpus;
}

export function hostSep(kind) {
  return kind === "ipv6" ? ":" : ".";
}

export function assembleHost(host) {
  const sep = typeof host.sep === "string" ? host.sep : hostSep(host.kind);
  return host.parts.join(sep);
}

export function assembleInput(item, hosts) {
  const host = hosts[item.host];
  const joined = assembleHost(host);
  const authority = item.bracket ? `[${joined}]` : joined;
  return `${item.prefix}${authority}:${item.port}${item.pathQuery}${item.suffix ?? ""}`;
}

export function assembleName(item, hosts) {
  if (!item.expectPort) return undefined;
  return `${assembleHost(hosts[item.host])}:${Number(item.expectPort)}`;
}

const ipv6LoopbackHost = ["", "", "1"].join(":");
const PRIVACY_PATTERNS = [
  [/\b10(?:\.\d{1,3}){3}\b/, "10/8"],
  [/\b127(?:\.\d{1,3}){3}\b/, "loopback"],
  [new RegExp(`(?:^|[^0-9A-Fa-f:])${ipv6LoopbackHost}(?![0-9A-Fa-f])`), "loopback"],
  [new RegExp(`\\[${ipv6LoopbackHost}\\]`), "loopback"],
  [/\b192\.168\.\d{1,3}\.\d{1,3}\b/, "192.168/16"],
  [/\b172\.(?:1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}\b/, "172.16/12"],
  [/\b[fF][cCdD][0-9A-Fa-f]{2}:[0-9A-Fa-f:]+/, "ULA"],
  [/\[[fF][cCdD][0-9A-Fa-f]{2}:[0-9A-Fa-f:]*\]/, "ULA"],
  [/\/Users\/(?!<|&lt;)/, "macos-home"],
  [/\/home\/(?!<|&lt;)[A-Za-z]/, "linux-home"],
  [/[A-Za-z]:[\\/]Users[\\/](?!<|&lt;)/i, "windows-home"],
  [/file:\/\//i, "file-url"],
  [/\b[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\b/, "uuid-like-id"],
  [/\/private\/var/, "device-path"]
];

export function privacyHits(text) {
  const hits = [];
  for (const [re, label] of PRIVACY_PATTERNS) {
    re.lastIndex = 0;
    if (re.test(text) && !hits.includes(label)) hits.push(label);
  }
  return hits;
}

function escapeKotlin(value) {
  let out = "";
  for (const ch of value) {
    const cp = ch.codePointAt(0);
    if (ch === "\\") out += "\\\\";
    else if (ch === '"') out += '\\"';
    else if (ch === "$") out += "\\$";
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (cp === 0) out += "\\u0000";
    else if (cp < 32 || cp === 0xfeff || cp === 0xa0 || cp > 126) {
      if (cp > 0xffff) {
        const minus = cp - 0x10000;
        out += `\\u${(0xd800 + (minus >> 10)).toString(16).toUpperCase().padStart(4, "0")}`;
        out += `\\u${(0xdc00 + (minus & 0x3ff)).toString(16).toUpperCase().padStart(4, "0")}`;
      } else {
        out += `\\u${cp.toString(16).toUpperCase().padStart(4, "0")}`;
      }
    } else out += ch;
  }
  return out;
}

function escapeSwift(value) {
  let out = "";
  for (const ch of value) {
    const cp = ch.codePointAt(0);
    if (ch === "\\") out += "\\\\";
    else if (ch === '"') out += '\\"';
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (cp < 32 || cp === 0xfeff || cp === 0xa0 || cp > 126) {
      out += `\\u{${cp.toString(16).toUpperCase()}}`;
    } else out += ch;
  }
  return out;
}

function escapeEts(value) {
  let out = "";
  for (const ch of value) {
    const cp = ch.codePointAt(0);
    if (ch === "\\") out += "\\\\";
    else if (ch === "'") out += "\\'";
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (cp === 0) out += "\\0";
    else if (cp > 0xffff) {
      const minus = cp - 0x10000;
      out += `' + String.fromCharCode(${0xd800 + (minus >> 10)}) + String.fromCharCode(${0xdc00 + (minus & 0x3ff)}) + '`;
    } else if (cp < 32 || cp === 0xfeff || cp === 0xa0 || cp > 126) {
      out += `\\u${cp.toString(16).toUpperCase().padStart(4, "0")}`;
    } else out += ch;
  }
  return out;
}

function kotlinParts(parts) {
  return `listOf(${parts.map((part) => `"${escapeKotlin(part)}"`).join(", ")})`;
}

function swiftParts(parts) {
  return `[${parts.map((part) => `"${escapeSwift(part)}"`).join(", ")}]`;
}

function etsParts(parts) {
  return `[${parts.map((part) => `'${escapeEts(part)}'`).join(", ")}]`;
}

function resolved(item, hosts) {
  const host = hosts[item.host];
  return {
    ...item,
    suffix: item.suffix ?? "",
    bracket: Boolean(item.bracket),
    parts: host.parts,
    sep: typeof host.sep === "string" ? host.sep : hostSep(host.kind),
    token: item.token ?? "",
    expectPort: item.expectPort ?? ""
  };
}

export function generateKotlin(corpus) {
  const rows = corpus.cases.map((item) => {
    const r = resolved(item, corpus.hosts);
    const token = r.token ? `"${escapeKotlin(r.token)}"` : "null";
    const expect = r.expectPort ? `"${escapeKotlin(r.expectPort)}"` : "null";
    return `        PairingCorpusCase(
            "${escapeKotlin(r.id)}",
            ${r.accept},
            "${escapeKotlin(r.prefix)}",
            ${kotlinParts(r.parts)},
            "${escapeKotlin(r.sep)}",
            ${r.bracket},
            "${escapeKotlin(r.port)}",
            "${escapeKotlin(r.pathQuery)}",
            "${escapeKotlin(r.suffix)}",
            ${token},
            ${expect},
        )`;
  });
  return `package com.octoooo.saydo

// Generated from scripts/pairing-url-corpus.json. Do not edit.

internal data class PairingCorpusCase(
    val id: String,
    val accept: Boolean,
    val prefix: String,
    val hostParts: List<String>,
    val hostSep: String,
    val bracketHost: Boolean,
    val port: String,
    val pathQuery: String,
    val suffix: String,
    val token: String?,
    val expectPort: String?,
) {
    fun input(): String {
        val host = hostParts.joinToString(hostSep)
        val authority = if (bracketHost) "[\$host]" else host
        return prefix + authority + ":" + port + pathQuery + suffix
    }

    fun expectedName(): String? {
        val portOut = expectPort ?: return null
        return hostParts.joinToString(hostSep) + ":" + portOut.toInt().toString()
    }
}

internal object PairingUrlCorpus {
    val cases: List<PairingCorpusCase> = listOf(
${rows.join(",\n")}
    )
}
`;
}

export function generateSwift(corpus) {
  const rows = corpus.cases.map((item) => {
    const r = resolved(item, corpus.hosts);
    const token = r.token ? `"${escapeSwift(r.token)}"` : "nil";
    const expect = r.expectPort ? `"${escapeSwift(r.expectPort)}"` : "nil";
    return `        PairingCorpusCase(
            id: "${escapeSwift(r.id)}",
            accept: ${r.accept},
            prefix: "${escapeSwift(r.prefix)}",
            hostParts: ${swiftParts(r.parts)},
            hostSep: "${escapeSwift(r.sep)}",
            bracketHost: ${r.bracket},
            port: "${escapeSwift(r.port)}",
            pathQuery: "${escapeSwift(r.pathQuery)}",
            suffix: "${escapeSwift(r.suffix)}",
            token: ${token},
            expectPort: ${expect}
        )`;
  });
  return `import Foundation

// Generated from scripts/pairing-url-corpus.json. Do not edit.

struct PairingCorpusCase {
    let id: String
    let accept: Bool
    let prefix: String
    let hostParts: [String]
    let hostSep: String
    let bracketHost: Bool
    let port: String
    let pathQuery: String
    let suffix: String
    let token: String?
    let expectPort: String?

    var input: String {
        let host = hostParts.joined(separator: hostSep)
        let authority = bracketHost ? "[\\(host)]" : host
        return prefix + authority + ":" + port + pathQuery + suffix
    }

    var expectedName: String? {
        guard let expectPort, let parsed = Int(expectPort) else { return nil }
        return hostParts.joined(separator: hostSep) + ":" + String(parsed)
    }
}

enum PairingUrlCorpus {
    static let cases: [PairingCorpusCase] = [
${rows.join(",\n")}
    ]
}
`;
}

export function generateEts(corpus) {
  const rows = corpus.cases.map((item, index) => {
    const r = resolved(item, corpus.hosts);
    return `  const c${index} = new PairingCorpusCase()
  c${index}.id = '${escapeEts(r.id)}'
  c${index}.accept = ${r.accept}
  c${index}.prefix = '${escapeEts(r.prefix)}'
  c${index}.hostParts = ${etsParts(r.parts)}
  c${index}.hostSep = '${escapeEts(r.sep)}'
  c${index}.bracketHost = ${r.bracket}
  c${index}.port = '${escapeEts(r.port)}'
  c${index}.pathQuery = '${escapeEts(r.pathQuery)}'
  c${index}.suffix = '${escapeEts(r.suffix)}'
  c${index}.token = '${escapeEts(r.token)}'
  c${index}.expectPort = '${escapeEts(r.expectPort)}'
  cases.push(c${index})`;
  });
  return `// Generated from scripts/pairing-url-corpus.json. Do not edit.

export class PairingCorpusCase {
  id: string = ''
  accept: boolean = false
  prefix: string = ''
  hostParts: Array<string> = []
  hostSep: string = ''
  bracketHost: boolean = false
  port: string = ''
  pathQuery: string = ''
  suffix: string = ''
  token: string = ''
  expectPort: string = ''
}

function joinParts(parts: Array<string>, sep: string): string {
  let out = ''
  for (let i = 0; i < parts.length; i++) {
    if (i > 0) {
      out += sep
    }
    out += parts[i]
  }
  return out
}

export function pairingCorpusInput(item: PairingCorpusCase): string {
  const host = joinParts(item.hostParts, item.hostSep)
  const authority = item.bracketHost ? ('[' + host + ']') : host
  return item.prefix + authority + ':' + item.port + item.pathQuery + item.suffix
}

export function pairingCorpusExpectedName(item: PairingCorpusCase): string {
  if (item.expectPort.length === 0) {
    return ''
  }
  return joinParts(item.hostParts, item.hostSep) + ':' + String(Number(item.expectPort))
}

export function pairingCorpusCases(): Array<PairingCorpusCase> {
  const cases: Array<PairingCorpusCase> = []
${rows.join("\n")}
  return cases
}
`;
}

export function generateAll(corpus) {
  return {
    android: generateKotlin(corpus),
    ios: generateSwift(corpus),
    harmony: generateEts(corpus)
  };
}
