#!/usr/bin/env node
// PG-01B:remote surface inventory 与四个 composition root 的 HTTP method+path / WS message / Unix listener exact-set 对账。
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(here, "..");
export const INVENTORY_REL = "scripts/remote-surface-inventory.json";

export const SOURCE_ROOTS = Object.freeze({
  main: "packages/daemon/src/index.ts",
  recovery: "packages/daemon/src/api/recoveryOnlyServer.ts",
  voice: "packages/daemon/src/voice/hub.ts",
  tier1: "packages/daemon/src/tier1/gateServer.ts"
});

export const GUARD_HTTP = "remoteHttpBusinessDecision";
export const GUARD_WS = "remoteVoiceWsDecision";
const VIAS = Object.freeze(["local", "mobile_lan", "tailnet", "not_applicable"]);
const ROOTS = Object.freeze(["main", "recovery", "voice", "tier1"]);
const PROTOCOLS = Object.freeze(["HTTP", "WS", "Unix"]);
const CLASSES = Object.freeze([
  "health",
  "readiness",
  "static_shell",
  "safe_redirect",
  "business",
  "local_only"
]);
const HTTP_METHODS = Object.freeze(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]);
const METHOD_NOT_APPLICABLE = "NOT_APPLICABLE";
const OUTCOMES = Object.freeze(["allow", "remote_business_403", "local_only"]);
const SKIP_PREFIXES = Object.freeze(["/api/", "/ws/", "/dev/", "/api/setup/"]);

function fail(message, code = 1) {
  process.stderr.write(`[fail] ${message}\n`);
  process.exit(code);
}

function readSource(root, base = REPO_ROOT) {
  const rel = SOURCE_ROOTS[root];
  const abs = join(base, rel);
  if (!existsSync(abs)) throw new Error(`missing source root:${rel}`);
  return { rel, text: readFileSync(abs, "utf8") };
}

function normalizeRegexPath(raw) {
  return raw
    .replace(/\\\//g, "/")
    .replace(/\(\[\^\/\]\+\)/g, ":id")
    .replace(/\[\^\/\]\+/g, ":id")
    .replace(/\(\[a-z-\]\+\)/g, ":action");
}

function matchingBrace(text, openIdx) {
  let depth = 0;
  let i = openIdx;
  let inStr = null;
  let escaped = false;
  let tplExpr = 0;
  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];
    if (inStr === "`") {
      if (escaped) {
        escaped = false;
        i += 1;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        i += 1;
        continue;
      }
      if (ch === "$" && next === "{") {
        tplExpr += 1;
        i += 2;
        continue;
      }
      if (ch === "`" && tplExpr === 0) {
        inStr = null;
        i += 1;
        continue;
      }
      if (ch === "}" && tplExpr > 0) {
        tplExpr -= 1;
        i += 1;
        continue;
      }
      i += 1;
      continue;
    }
    if (inStr) {
      if (escaped) {
        escaped = false;
        i += 1;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        i += 1;
        continue;
      }
      if (ch === inStr) inStr = null;
      i += 1;
      continue;
    }
    if (ch === "/" && next === "/") {
      const nl = text.indexOf("\n", i);
      i = nl === -1 ? text.length : nl + 1;
      continue;
    }
    if (ch === "/" && next === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end === -1 ? text.length : end + 2;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inStr = ch;
      i += 1;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
    i += 1;
  }
  return -1;
}

function functionSpan(text, name) {
  const re = new RegExp(`function ${name}\\s*\\(`);
  const m = re.exec(text);
  if (!m) return null;
  const brace = text.indexOf("{", m.index + m[0].length);
  if (brace === -1) return null;
  const end = matchingBrace(text, brace);
  if (end === -1) return null;
  return { start: brace, end };
}

function collectMethodScopes(text) {
  const scopes = [];
  const eq = /req\.method\s*===\s*"(GET|POST|DELETE|PUT|PATCH|HEAD)"/g;
  let m;
  while ((m = eq.exec(text))) {
    const method = m[1];
    const brace = text.indexOf("{", m.index + m[0].length);
    const semi = text.indexOf(";", m.index + m[0].length);
    if (brace !== -1 && (semi === -1 || brace < semi || (text.slice(m.index + m[0].length, brace).split("\n").length <= 7))) {
      const gap = text.slice(m.index + m[0].length, brace);
      if (gap.split("\n").length <= 7) {
        const end = matchingBrace(text, brace);
        if (end !== -1) scopes.push({ start: m.index, end, method, kind: "block" });
      }
    }
    const stmtEnd = text.indexOf("\n", m.index + m[0].length);
    scopes.push({
      start: m.index,
      end: stmtEnd === -1 ? m.index + m[0].length + 200 : stmtEnd,
      method,
      kind: "stmt"
    });
  }
  const ne = /req\.method\s*!==\s*"POST"/g;
  while ((m = ne.exec(text))) {
    const brace = text.indexOf("{", m.index + m[0].length);
    if (brace === -1) continue;
    if (text.slice(m.index + m[0].length, brace).split("\n").length > 7) continue;
    const end = matchingBrace(text, brace);
    if (end === -1) continue;
    const remStart = end + 1;
    let remEnd = text.length;
    for (const scope of scopes) {
      if (scope.kind === "block" && scope.start > remStart && scope.start < remEnd) remEnd = scope.start;
    }
    scopes.push({ start: remStart, end: remEnd, method: "POST", kind: "block" });
  }
  return scopes;
}

function methodAt(scopes, pos) {
  const blocks = scopes.filter((s) => s.kind === "block" && s.start <= pos && pos <= s.end);
  if (blocks.length > 0) {
    blocks.sort((a, b) => a.end - a.start - (b.end - b.start) || b.start - a.start);
    return blocks[0].method;
  }
  const stmts = scopes.filter((s) => s.kind === "stmt" && s.start <= pos && pos <= s.end);
  return stmts[0]?.method ?? null;
}

function inIfCondition(text, pos) {
  let i = pos;
  let depth = 0;
  while (i >= 0) {
    const ch = text[i];
    if (ch === ")") depth += 1;
    else if (ch === "(") {
      if (depth === 0) {
        const before = text.slice(Math.max(0, i - 16), i);
        if (/\bif\s*$/.test(before)) return true;
      } else depth -= 1;
    }
    i -= 1;
  }
  return false;
}

function extractJsAnchoredRegexBodies(text) {
  const bodies = [];
  let i = 0;
  while (i < text.length) {
    const start = text.indexOf("/^", i);
    if (start === -1) break;
    let j = start + 2;
    let inClass = false;
    let escaped = false;
    let found = false;
    while (j < text.length) {
      const ch = text[j];
      if (escaped) {
        escaped = false;
        j += 1;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        j += 1;
        continue;
      }
      if (ch === "[") inClass = true;
      else if (ch === "]" && inClass) inClass = false;
      else if (!inClass && ch === "$" && text[j + 1] === "/") {
        bodies.push({ start, body: text.slice(start + 2, j) });
        found = true;
        j += 2;
        break;
      } else if (!inClass && ch === "/") {
        break;
      }
      j += 1;
    }
    i = found ? j : start + 2;
  }
  return bodies;
}

export function extractHttpSurfaces(text) {
  const scopes = collectMethodScopes(text);
  const rca = functionSpan(text, "routeConsoleApi");
  const surfaces = new Map();
  const errors = [];
  const pendingUnscoped = [];

  const add = (method, path, pos, why) => {
    if (!method) {
      pendingUnscoped.push({ path, pos, why });
      return;
    }
    if (!HTTP_METHODS.includes(method)) {
      errors.push(`illegal HTTP method extracted:${method} ${path}`);
      return;
    }
    surfaces.set(`${method} ${path}`, { method, path });
  };

  const lit = /(?:pathname|u\.pathname|\bp)\s*===\s*"(\/[^"]*)"/g;
  let m;
  while ((m = lit.exec(text))) {
    const path = m[1];
    const pos = m.index;
    if (rca && pos >= rca.start && pos <= rca.end) {
      add("GET", path, pos, "routeConsoleApi");
      continue;
    }
    const scoped = methodAt(scopes, pos);
    if (scoped) {
      add(scoped, path, pos, "method-scope");
      continue;
    }
    if (path === "/health" || path === "/readyz") {
      add("GET", path, pos, "health-readiness");
      continue;
    }
    if (inIfCondition(text, pos)) {
      add("GET", path, pos, "unscoped-if-handler");
      continue;
    }
    pendingUnscoped.push({ path, pos, why: "literal-not-if" });
  }

  for (const item of extractJsAnchoredRegexBodies(text)) {
    const path = normalizeRegexPath(item.body);
    if (!path.startsWith("/")) continue;
    const pos = item.start;
    if (rca && pos >= rca.start && pos <= rca.end) {
      add("GET", path, pos, "routeConsoleApi-re");
      continue;
    }
    const scoped = methodAt(scopes, pos);
    if (scoped) {
      add(scoped, path, pos, "method-scope-re");
      continue;
    }
    if (path.includes("approve-merge")) {
      add("POST", path, pos, "s3-approve-merge");
      continue;
    }
    pendingUnscoped.push({ path, pos, why: "regex-unscoped" });
  }

  const pref = /pathname\.startsWith\("(\/[^"]*)"\)/g;
  while ((m = pref.exec(text))) {
    const raw = m[1];
    const pos = m.index;
    if (SKIP_PREFIXES.includes(raw)) continue;
    const path = raw.endsWith("/") ? `${raw}*` : `${raw}*`;
    if (raw === "/api/s3/") {
      add("POST", "/api/s3*", pos, "s3-prefix");
      continue;
    }
    const scoped = methodAt(scopes, pos);
    if (scoped) add(scoped, path, pos, "prefix");
    else pendingUnscoped.push({ path, pos, why: "prefix-unscoped" });
  }

  if (text.includes("serveConsoleStatic(")) add("GET", "/*", text.indexOf("serveConsoleStatic("), "static-shell");
  if (/writeHead\(\s*308/.test(text)) add("GET", "308:localhost", 0, "safe-redirect");

  for (const item of pendingUnscoped) {
    const already = [...surfaces.values()].some((s) => s.path === item.path);
    if (already) continue;
    if (item.why === "literal-not-if") continue;
    errors.push(`unscoped HTTP handler without method:${item.path}`);
  }

  return {
    surfaces: [...surfaces.values()].sort((a, b) => a.method.localeCompare(b.method) || a.path.localeCompare(b.path)),
    errors
  };
}

export function extractHttpPaths(text) {
  return [...new Set(extractHttpSurfaces(text).surfaces.map((s) => s.path))].sort();
}

export function extractWsMessages(text) {
  const messages = new Set();
  const cases = /case\s+"([a-z][a-z0-9_.]+)"/g;
  let m;
  while ((m = cases.exec(text))) messages.add(m[1]);
  const quoted = /"([a-z][a-z0-9]*\.[a-z0-9_.]+)"/g;
  while ((m = quoted.exec(text))) messages.add(m[1]);
  if (text.includes('path: "/ws/voice"') || text.includes("path: '/ws/voice'")) {
    messages.add("/ws/voice");
  }
  return [...messages].sort();
}

export function extractUnixEvidence(text) {
  const paths = new Set();
  if (text.includes('"/gate"') || text.includes("'/gate'")) paths.add("/gate");
  const postOnlyGate =
    /req\.method\s*!==\s*"POST"/.test(text) &&
    (text.includes('"/gate"') || text.includes("'/gate'"));
  return {
    paths: [...paths].sort(),
    unixListenSockPath: /server\.listen\(\s*sockPath\s*\)/.test(text),
    postOnlyGate,
    win32LoopbackCall: /process\.platform\s*===\s*"win32"/.test(text) && text.includes("listenGateHttp"),
    numericTcpListen: /server\.listen\(\s*\d+/.test(text),
    method: "POST"
  };
}

export function extractFromTree(base = REPO_ROOT) {
  const main = readSource("main", base);
  const recovery = readSource("recovery", base);
  const voice = readSource("voice", base);
  const tier1 = readSource("tier1", base);
  const mainHttp = extractHttpSurfaces(main.text);
  const recoveryHttp = extractHttpSurfaces(recovery.text);
  const unix = extractUnixEvidence(tier1.text);
  return {
    http: {
      main: mainHttp.surfaces,
      recovery: recoveryHttp.surfaces,
      voice: [],
      tier1: unix.paths.map((path) => ({ method: unix.method, path }))
    },
    extractErrors: [...mainHttp.errors, ...recoveryHttp.errors],
    ws: {
      main: [],
      recovery: [],
      voice: extractWsMessages(voice.text),
      tier1: []
    },
    unix,
    guards: {
      mainHttp: main.text.includes(GUARD_HTTP),
      recoveryHttp: recovery.text.includes(GUARD_HTTP),
      voiceWs: voice.text.includes(GUARD_WS),
      mainWs: main.text.includes(GUARD_WS)
    },
    texts: {
      main: main.text,
      recovery: recovery.text,
      voice: voice.text,
      tier1: tier1.text
    }
  };
}

function viaList(entry) {
  return Array.isArray(entry.via) ? entry.via : [entry.via];
}

function surfaceKey(entry) {
  const loc = entry.protocol === "WS" ? entry.message : entry.path;
  return `${entry.composition_root}|${entry.protocol}|${entry.method}|${loc}|${entry.via}`;
}

function httpKey(method, path) {
  return `${method} ${path}`;
}

export function loadInventory(base = REPO_ROOT) {
  const abs = join(base, INVENTORY_REL);
  if (!existsSync(abs)) throw new Error(`missing inventory:${INVENTORY_REL}`);
  const raw = JSON.parse(readFileSync(abs, "utf8"));
  if (raw.schema_version !== 1) throw new Error("inventory schema_version must be 1");
  if (!Array.isArray(raw.entries) || raw.entries.length === 0) {
    throw new Error("inventory entries must be a non-empty array");
  }
  return raw;
}

function expectedRemoteClass(entry) {
  const loc = entry.protocol === "WS" ? entry.message : entry.path;
  if (entry.protocol === "Unix") return "local_only";
  if (entry.protocol === "WS") return "business";
  if (loc === "/health") return "health";
  if (loc === "/readyz") return "readiness";
  if (loc === "/*") return "static_shell";
  if (loc === "308:localhost") return "safe_redirect";
  if (typeof loc === "string" && (loc.startsWith("/api") || loc.startsWith("/dev"))) return "business";
  if (typeof loc === "string" && loc.startsWith("/ws")) return "business";
  return entry.class;
}

function expectedOutcome(entry, via) {
  if (via === "not_applicable") return "local_only";
  if (via === "local") return "allow";
  const cls = expectedRemoteClass(entry);
  if (cls === "health" || cls === "readiness" || cls === "static_shell") return "allow";
  if (cls === "safe_redirect") return "allow";
  return "remote_business_403";
}

function remoteAllowed(entry) {
  if (entry.via === "local" || entry.via === "not_applicable") return true;
  const cls = expectedRemoteClass(entry);
  return cls === "health" || cls === "readiness" || cls === "static_shell";
}

function validateEntryShape(entry, errors) {
  const loc = entry.protocol === "WS" ? entry.message : entry.path;
  if (entry.method == null || entry.method === "") {
    errors.push(`missing method:${entry.composition_root} ${entry.protocol} ${loc}`);
    return;
  }
  if (entry.method === "ANY" || entry.method === "MSG") {
    errors.push(`forbidden fuzzy method ${entry.method}:${entry.composition_root} ${entry.protocol} ${loc}`);
  }
  if (entry.via == null || (Array.isArray(entry.via) && entry.via.length === 0)) {
    errors.push(`missing via:${entry.composition_root} ${entry.protocol} ${loc}`);
  }
  if (entry.outcome == null || typeof entry.outcome !== "object" || Array.isArray(entry.outcome)) {
    errors.push(`missing outcome object:${entry.composition_root} ${entry.protocol} ${loc}`);
    return;
  }
  if (entry.protocol === "HTTP") {
    if (!HTTP_METHODS.includes(entry.method)) {
      errors.push(`HTTP method must be exact:${entry.composition_root} ${entry.method} ${loc}`);
    }
    if (typeof entry.path !== "string") errors.push(`HTTP missing path:${entry.composition_root} ${entry.method}`);
  } else if (entry.protocol === "WS") {
    if (entry.method !== METHOD_NOT_APPLICABLE) {
      errors.push(`WS method must be ${METHOD_NOT_APPLICABLE}:${loc} got ${entry.method}`);
    }
    if (typeof entry.message !== "string") errors.push(`WS missing message:${entry.composition_root}`);
  } else if (entry.protocol === "Unix") {
    if (entry.method !== "POST") {
      errors.push(`Unix method must be POST /gate, got ${entry.method} ${loc}`);
    }
  }
}

function expandEntries(entries) {
  const expanded = [];
  for (const entry of entries) {
    if (!ROOTS.includes(entry.composition_root)) {
      throw new Error(`unknown composition_root:${entry.composition_root}`);
    }
    if (!PROTOCOLS.includes(entry.protocol)) {
      throw new Error(`unknown protocol:${entry.protocol}`);
    }
    if (!CLASSES.includes(entry.class)) {
      throw new Error(`unknown class:${entry.class}`);
    }
    const vias = viaList(entry);
    if (vias.length === 0) throw new Error("via empty");
    for (const via of vias) {
      if (!VIAS.includes(via)) throw new Error(`unknown via:${via}`);
      if (via === "recovery") throw new Error("recovery is a composition root, not via");
      expanded.push({
        composition_root: entry.composition_root,
        protocol: entry.protocol,
        method: entry.method,
        path: entry.path ?? null,
        message: entry.message ?? null,
        via,
        class: entry.class,
        outcome: entry.outcome
      });
    }
  }
  return expanded;
}

export function checkRemoteSurfaceInventory(base = REPO_ROOT) {
  const errors = [];
  let inventory;
  try {
    inventory = loadInventory(base);
  } catch (err) {
    return [`${err instanceof Error ? err.message : String(err)}`];
  }
  let extracted;
  try {
    extracted = extractFromTree(base);
  } catch (err) {
    return [`${err instanceof Error ? err.message : String(err)}`];
  }
  for (const err of extracted.extractErrors) errors.push(err);

  for (const entry of inventory.entries) validateEntryShape(entry, errors);

  let expanded;
  try {
    expanded = expandEntries(inventory.entries);
  } catch (err) {
    return [...errors, `${err instanceof Error ? err.message : String(err)}`];
  }

  const keys = expanded.map(surfaceKey);
  if (new Set(keys).size !== keys.length) errors.push("inventory expanded keys are not unique");

  const invHttp = { main: new Set(), recovery: new Set(), voice: new Set(), tier1: new Set() };
  const invWs = new Set();
  const invUnix = new Set();
  for (const entry of inventory.entries) {
    const loc = entry.protocol === "WS" ? entry.message : entry.path;
    const vias = viaList(entry);
    if (entry.protocol === "HTTP") invHttp[entry.composition_root].add(httpKey(entry.method, loc));
    if (entry.protocol === "WS") invWs.add(loc);
    if (entry.protocol === "Unix") invUnix.add(httpKey(entry.method, loc));
    const cls = expectedRemoteClass(entry);
    if (entry.class !== cls) {
      errors.push(`class mismatch ${entry.composition_root} ${entry.protocol} ${loc}: inventory=${entry.class} expected=${cls}`);
    }
    if (entry.composition_root === "tier1" || entry.protocol === "Unix") {
      if (!(vias.length === 1 && vias[0] === "not_applicable")) {
        errors.push(`tier1/unix via must be not_applicable:${loc}`);
      }
    } else if (cls === "safe_redirect") {
      if (!(vias.length === 1 && vias[0] === "local")) {
        errors.push(`safe_redirect via must be local-only:${loc}`);
      }
    }
    const outcome = entry.outcome;
    if (outcome && typeof outcome === "object" && !Array.isArray(outcome)) {
      const outcomeKeys = Object.keys(outcome).sort();
      const viaKeys = [...vias].sort();
      if (outcomeKeys.join("|") !== viaKeys.join("|")) {
        errors.push(`outcome keys must exact-set match via:${entry.composition_root} ${entry.protocol} ${loc}`);
      }
      for (const via of vias) {
        const expected = expectedOutcome(entry, via);
        if (!OUTCOMES.includes(outcome[via])) {
          errors.push(`unknown outcome ${outcome[via]}:${entry.composition_root} ${loc} via=${via}`);
        } else if (outcome[via] !== expected) {
          errors.push(
            `outcome mismatch ${entry.composition_root} ${entry.protocol} ${entry.method} ${loc} via=${via}: inventory=${outcome[via]} expected=${expected}`
          );
        }
      }
    }
    for (const via of vias) {
      const row = {
        composition_root: entry.composition_root,
        protocol: entry.protocol,
        method: entry.method,
        path: entry.path ?? null,
        message: entry.message ?? null,
        via,
        class: entry.class
      };
      const allow = remoteAllowed(row);
      if (!allow && (via === "mobile_lan" || via === "tailnet") && (cls === "health" || cls === "readiness" || cls === "static_shell")) {
        errors.push(`health/static must allow remote:${loc} via=${via}`);
      }
      if (allow === false && cls === "business" && via === "local") {
        errors.push(`local must remain functional:${loc}`);
      }
    }
  }

  for (const root of ["main", "recovery"]) {
    const src = new Set(extracted.http[root].map((s) => httpKey(s.method, s.path)));
    const inv = invHttp[root];
    for (const k of src) {
      if (!inv.has(k)) errors.push(`unregistered ${root} HTTP method+path:${k}`);
    }
    for (const k of inv) {
      if (!src.has(k)) errors.push(`inventory HTTP method+path missing in ${root} source:${k}`);
    }
  }

  const srcWs = new Set(extracted.ws.voice);
  for (const msg of srcWs) {
    if (!invWs.has(msg)) errors.push(`unregistered voice WS message:${msg}`);
  }
  for (const msg of invWs) {
    if (!srcWs.has(msg)) errors.push(`inventory WS message missing in voice source:${msg}`);
  }

  if (!extracted.unix.unixListenSockPath) errors.push("tier1 missing unix listen(sockPath) bind evidence");
  if (!extracted.unix.postOnlyGate) errors.push("tier1 missing POST /gate method lock evidence");
  if (!extracted.unix.win32LoopbackCall) errors.push("tier1 missing win32 listenGateHttp local loopback bind call");
  if (extracted.unix.numericTcpListen) errors.push("tier1 unix root must not bind a numeric TCP port");
  if (!extracted.unix.paths.includes("/gate")) errors.push("tier1 missing POST /gate");
  const srcUnix = new Set(extracted.http.tier1.map((s) => httpKey(s.method, s.path)));
  for (const k of srcUnix) {
    if (!invUnix.has(k)) errors.push(`unregistered tier1 unix method+path:${k}`);
  }
  for (const k of invUnix) {
    if (!srcUnix.has(k)) errors.push(`inventory unix method+path missing in tier1 source:${k}`);
  }

  if (!extracted.guards.mainHttp) errors.push(`main missing ${GUARD_HTTP}`);
  if (!extracted.guards.recoveryHttp) errors.push(`recovery missing ${GUARD_HTTP}`);
  if (!extracted.guards.voiceWs) errors.push(`voice missing ${GUARD_WS}`);

  const apiIdx = extracted.texts.main.lastIndexOf('startsWith("/api/")');
  const guardIdx = extracted.texts.main.lastIndexOf(GUARD_HTTP);
  if (apiIdx === -1 || guardIdx === -1 || guardIdx < apiIdx) {
    errors.push("main /api/ block bypasses remote HTTP guard");
  }
  const recApi = extracted.texts.recovery.lastIndexOf('startsWith("/api/")');
  const recGuard = extracted.texts.recovery.lastIndexOf(GUARD_HTTP);
  if (recApi === -1 || recGuard === -1 || recGuard < recApi) {
    errors.push("recovery /api/ block bypasses remote HTTP guard");
  }
  const voiceOnConn = extracted.texts.voice.lastIndexOf("private onConnection");
  const voiceGuard = extracted.texts.voice.lastIndexOf(GUARD_WS);
  if (voiceOnConn === -1 || voiceGuard === -1 || voiceGuard < voiceOnConn) {
    errors.push("voice onConnection bypasses remote WS guard");
  }

  return errors;
}

function dump() {
  const extracted = extractFromTree();
  process.stdout.write(
    `${JSON.stringify(
      {
        http: extracted.http,
        extractErrors: extracted.extractErrors,
        ws: extracted.ws,
        unix: {
          paths: extracted.unix.paths,
          method: extracted.unix.method,
          unixListenSockPath: extracted.unix.unixListenSockPath,
          postOnlyGate: extracted.unix.postOnlyGate,
          win32LoopbackCall: extracted.unix.win32LoopbackCall
        },
        guards: extracted.guards
      },
      null,
      2
    )}\n`
  );
}

function main(argv = process.argv.slice(2)) {
  if (argv.includes("--dump")) {
    dump();
    return;
  }
  const errors = checkRemoteSurfaceInventory();
  if (errors.length > 0) {
    for (const error of errors) process.stderr.write(`[fail] ${error}\n`);
    process.exit(1);
  }
  process.stdout.write("[ok] remote-surface-inventory exact-set matches four composition roots\n");
}

const invoked = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invoked) main();
