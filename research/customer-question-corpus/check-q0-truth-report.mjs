#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SCHEMA_VERSION = "1";
export const EXPECTED_TOTAL = 986;
export const DISPOSITION_IDS = Object.freeze(["A-RAG-01", "A-RAG-02", "B-VAL-01"]);
export const OWNER_DOWNGRADED = "owner_downgraded_with_public_limit";
export const OBJECT_KEYS = Object.freeze([
  "source_id",
  "status",
  "reason",
  "source_kind",
  "entity",
  "reader",
  "locator_check",
  "required_field_check"
]);
const TOP_KEYS = Object.freeze([
  "schema_version",
  "implementation_sha",
  "implementation_tree",
  "expected_total",
  "objects",
  "aggregate",
  "dispositions"
]);

const corpusDir = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(corpusDir, "../..");

function gitRevParse(rev) {
  const result = spawnSync("git", ["rev-parse", "--verify", rev], {
    cwd: REPO_ROOT,
    encoding: "utf8"
  });
  if (result.status !== 0) return null;
  return result.stdout.trim();
}

function isFullOid(value) {
  return typeof value === "string" && /^[0-9a-f]{40}$/u.test(value);
}

function utf8Compare(a, b) {
  return Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

function jsonPointerEscape(token) {
  return String(token).replaceAll("~", "~0").replaceAll("/", "~1");
}

function sourceId(relPath, tokens) {
  return `${relPath}#/${tokens.map(jsonPointerEscape).join("/")}`;
}

function readerOf(source) {
  const tools = Array.isArray(source.reader_tools) ? source.reader_tools.map(String) : [];
  return [...tools].sort(utf8Compare).join(",");
}

function locatorCheckOf(source) {
  const locator = String(source.locator ?? "");
  if (locator.includes("USER-PROVIDED") || /generic|fallback|任意来源/iu.test(locator)) return "fail";
  if (locator.length < 8) return "fail";
  return "unresolved";
}

function requiredFieldCheckOf(source) {
  const fields = Array.isArray(source.required_fields) ? source.required_fields : [];
  if (fields.length < 4) return "fail";
  return "unresolved";
}

export function collectLiveSources(root = REPO_ROOT) {
  const dir = join(root, "research/customer-question-corpus/contracts/live");
  const objects = [];
  const files = readdirSync(dir).filter((name) => name.endsWith(".json")).sort(utf8Compare);
  for (const name of files) {
    const abs = join(dir, name);
    const rel = relative(root, abs).split("\\").join("/");
    const data = JSON.parse(readFileSync(abs, "utf8"));
    const contracts = Array.isArray(data.contracts) ? data.contracts : [];
    for (let i = 0; i < contracts.length; i += 1) {
      const contract = contracts[i];
      const sources = Array.isArray(contract.sources) ? contract.sources : [];
      for (let j = 0; j < sources.length; j += 1) {
        const source = sources[j];
        if (typeof source?.source_kind !== "string") continue;
        const loc = locatorCheckOf(source);
        const fields = requiredFieldCheckOf(source);
        objects.push({
          source_id: sourceId(rel, ["contracts", String(i), "sources", String(j)]),
          status: "unresolved",
          reason: "unresolved_requirement_downgrade",
          source_kind: source.source_kind,
          entity: `${contract.id}:${source.source_kind}`,
          reader: readerOf(source),
          locator_check: loc,
          required_field_check: fields
        });
      }
    }
  }
  objects.sort((a, b) => utf8Compare(a.source_id, b.source_id));
  return objects;
}

function defaultDispositions() {
  return DISPOSITION_IDS.map((id) => ({
    id,
    disposition: OWNER_DOWNGRADED,
    reason: "pg01a-safety-downgrade"
  }));
}

export function buildQ0Report({ implementationSha, implementationTree, objects = collectLiveSources() }) {
  const validCount = objects.filter((row) => row.status === "valid").length;
  const unresolvedCount = objects.filter((row) => row.status === "unresolved").length;
  return {
    schema_version: SCHEMA_VERSION,
    implementation_sha: implementationSha,
    implementation_tree: implementationTree,
    expected_total: EXPECTED_TOTAL,
    objects,
    aggregate: { valid_count: validCount, unresolved_count: unresolvedCount },
    dispositions: defaultDispositions()
  };
}

function verifyGitIdentity(sha, tree) {
  const errors = [];
  if (!isFullOid(sha)) errors.push("implementation_sha is not a 40-hex OID");
  if (!isFullOid(tree)) errors.push("implementation_tree is not a 40-hex OID");
  if (errors.length > 0) return errors;
  const resolvedTree = gitRevParse(`${sha}^{tree}`);
  if (!resolvedTree) errors.push(`implementation_sha is not a git object:${sha}`);
  else if (resolvedTree !== tree) errors.push("implementation_tree does not match sha^{tree}");
  return errors;
}

function keysOf(value) {
  return Object.keys(value).sort();
}

export function checkQ0Report(report, { expectedObjects = collectLiveSources() } = {}) {
  const errors = [];
  if (!report || typeof report !== "object" || Array.isArray(report)) {
    return ["report is not an object"];
  }
  if (keysOf(report).join(",") !== [...TOP_KEYS].sort().join(",")) {
    errors.push(`top-level field drift:${keysOf(report).join(",")}`);
  }
  if (report.schema_version !== SCHEMA_VERSION) errors.push(`schema_version=${report.schema_version}`);
  errors.push(...verifyGitIdentity(report.implementation_sha, report.implementation_tree));
  if (report.expected_total !== EXPECTED_TOTAL) errors.push(`expected_total=${report.expected_total}`);
  if (!Array.isArray(report.objects)) {
    errors.push("objects is not an array");
    return errors;
  }
  if (report.objects.length !== EXPECTED_TOTAL) errors.push(`objects.length=${report.objects.length}`);
  const seen = new Set();
  for (const row of report.objects) {
    if (!row || typeof row !== "object") {
      errors.push("object row is not an object");
      continue;
    }
    const id = typeof row.source_id === "string" ? row.source_id : "?";
    if (keysOf(row).join(",") !== [...OBJECT_KEYS].sort().join(",")) {
      errors.push(`object field set drift:${id}:${keysOf(row).join(",")}`);
    }
    for (const key of OBJECT_KEYS) {
      if (!Object.hasOwn(row, key)) errors.push(`missing field:${id}:${key}`);
      else if (typeof row[key] !== "string") errors.push(`wrong type:${id}:${key}`);
    }
    if (seen.has(row.source_id)) errors.push(`duplicate source_id:${row.source_id}`);
    seen.add(row.source_id);
    if (row.status !== "valid" && row.status !== "unresolved") errors.push(`illegal status:${row.source_id}`);
    if (row.status === "valid" && (row.locator_check !== "pass" || row.required_field_check !== "pass")) {
      errors.push(`false valid:${row.source_id}`);
    }
  }
  const expectedIds = expectedObjects.map((row) => row.source_id);
  const actualIds = report.objects.map((row) => row.source_id);
  if (actualIds.every((id) => typeof id === "string")) {
    if ([...actualIds].sort(utf8Compare).join("\n") !== [...actualIds].join("\n")) {
      errors.push("objects are not sorted by source_id UTF-8");
    }
  }
  const expectedSet = new Set(expectedIds);
  const actualSet = new Set(actualIds);
  for (const id of expectedIds) {
    if (!actualSet.has(id)) errors.push(`missing source_id:${id}`);
  }
  for (const id of actualIds) {
    if (!expectedSet.has(id)) errors.push(`extra source_id:${id}`);
  }
  const expectedById = new Map(expectedObjects.map((row) => [row.source_id, row]));
  for (const row of report.objects) {
    const expected = expectedById.get(row.source_id);
    if (!expected) continue;
    for (const key of OBJECT_KEYS) {
      if (typeof row[key] === "string" && row[key] !== expected[key]) {
        errors.push(`field drift:${row.source_id}:${key}`);
      }
    }
  }
  const validCount = report.objects.filter((row) => row.status === "valid").length;
  const unresolvedCount = report.objects.filter((row) => row.status === "unresolved").length;
  if (!report.aggregate || typeof report.aggregate !== "object") errors.push("aggregate missing");
  else {
    if (report.aggregate.valid_count !== validCount) errors.push("valid_count drift");
    if (report.aggregate.unresolved_count !== unresolvedCount) errors.push("unresolved_count drift");
    if (validCount + unresolvedCount !== EXPECTED_TOTAL) errors.push("aggregate does not sum to 986");
  }
  if (!Array.isArray(report.dispositions) || report.dispositions.length !== 3) {
    errors.push("dispositions must cover exactly three findings");
  } else {
    const ids = report.dispositions.map((row) => row.id).sort().join(",");
    if (ids !== [...DISPOSITION_IDS].sort().join(",")) errors.push(`disposition id drift:${ids}`);
    if (unresolvedCount > 0) {
      for (const row of report.dispositions) {
        if (row.disposition !== OWNER_DOWNGRADED) {
          errors.push(`disposition ${row.id}=${row.disposition} but unresolved_count>0`);
        }
      }
    }
  }
  return errors;
}

function parseArgs(argv) {
  const args = { mode: null, output: null, checkPath: null, sha: null, tree: null };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--write") args.mode = "write";
    else if (token === "--check") {
      args.mode = "check";
      args.checkPath = argv[i + 1];
      i += 1;
    } else if (token === "--output") {
      args.output = argv[i + 1];
      i += 1;
    } else if (token === "--implementation-sha") {
      args.sha = argv[i + 1];
      i += 1;
    } else if (token === "--implementation-tree") {
      args.tree = argv[i + 1];
      i += 1;
    } else {
      throw new Error(`unknown argv:${token}`);
    }
  }
  return args;
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.mode === "write") {
      if (!args.output || !args.sha || !args.tree) {
        throw new Error("--write requires --output --implementation-sha --implementation-tree");
      }
      const identityErrors = verifyGitIdentity(args.sha, args.tree);
      if (identityErrors.length > 0) throw new Error(identityErrors.join("; "));
      const report = buildQ0Report({ implementationSha: args.sha, implementationTree: args.tree });
      const errors = checkQ0Report(report);
      if (errors.length > 0) throw new Error(errors.join("; "));
      writeFileSync(args.output, `${JSON.stringify(report, null, 2)}\n`);
      process.stdout.write(`[ok] wrote ${args.output} objects=${report.objects.length}\n`);
    } else if (args.mode === "check") {
      if (!args.checkPath) throw new Error("--check requires a report path");
      const report = JSON.parse(readFileSync(args.checkPath, "utf8"));
      const errors = checkQ0Report(report);
      if (errors.length > 0) {
        process.stderr.write(`[fail] q0 report ${errors.length}\n`);
        for (const error of errors.slice(0, 40)) process.stderr.write(`- ${error}\n`);
        process.exit(1);
      }
      process.stdout.write(`[ok] q0 report objects=${report.objects.length}\n`);
    } else {
      throw new Error("usage: --write --output PATH --implementation-sha SHA --implementation-tree TREE | --check PATH");
    }
  } catch (error) {
    process.stderr.write(`[fail] ${error.message}\n`);
    process.exit(1);
  }
}
