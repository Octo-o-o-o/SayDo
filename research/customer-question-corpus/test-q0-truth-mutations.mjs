#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  EXPECTED_TOTAL,
  OBJECT_KEYS,
  REPO_ROOT,
  buildQ0Report,
  checkQ0Report,
  collectLiveSources
} from "./check-q0-truth-report.mjs";

function git(rev) {
  const result = spawnSync("git", ["rev-parse", "--verify", rev], {
    cwd: REPO_ROOT,
    encoding: "utf8"
  });
  if (result.status !== 0) throw new Error(`git rev-parse ${rev} failed`);
  return result.stdout.trim();
}

const sha = git("HEAD");
const tree = git("HEAD^{tree}");
const objects = collectLiveSources();
const baseline = buildQ0Report({ implementationSha: sha, implementationTree: tree, objects });

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

record(objects.length === EXPECTED_TOTAL, `collects ${EXPECTED_TOTAL} sources`, String(objects.length));
record(checkQ0Report(baseline).length === 0, "baseline report checks clean", checkQ0Report(baseline).join("; "));

const missingPath = join(mkdtempSync(join(tmpdir(), "pg01a-q0-miss-")), "missing.json");
const missingRun = spawnSync(process.execPath, [join(REPO_ROOT, "research/customer-question-corpus/check-q0-truth-report.mjs"), "--check", missingPath], {
  encoding: "utf8"
});
record(missingRun.status !== 0, "missing report is nonzero");
rmSync(dirname(missingPath), { recursive: true, force: true });

function mutate(label, edit) {
  const copy = structuredClone(baseline);
  edit(copy);
  const errors = checkQ0Report(copy);
  record(errors.length > 0, label, errors.slice(0, 3).join("; "));
}

mutate("duplicate source_id", (report) => {
  report.objects[1].source_id = report.objects[0].source_id;
});

mutate("missing object", (report) => {
  report.objects.pop();
  report.aggregate.unresolved_count = report.objects.length;
});

mutate("expected_total drift", (report) => {
  report.expected_total = 985;
});

mutate("false valid", (report) => {
  report.objects[0].status = "valid";
  report.objects[0].locator_check = "fail";
  report.objects[0].required_field_check = "fail";
  report.aggregate.valid_count = 1;
  report.aggregate.unresolved_count = EXPECTED_TOTAL - 1;
});

function errorsOf(edit) {
  const copy = structuredClone(baseline);
  edit(copy);
  return { report: copy, errors: checkQ0Report(copy) };
}

const baselineId = baseline.objects[0].source_id;
for (const key of OBJECT_KEYS) {
  const drifted = errorsOf((report) => {
    report.objects[0][key] = key === "status" ? "queued" : `fabricated_${key}`;
  });
  const driftOk =
    key === "source_id"
      ? drifted.errors.some((error) => error.startsWith("extra source_id:") || error.startsWith("missing source_id:"))
      : drifted.errors.some((error) => error === `field drift:${baselineId}:${key}`);
  record(driftOk, `field drift ${key} only`, drifted.errors.slice(0, 3).join("; "));

  const missing = errorsOf((report) => {
    delete report.objects[0][key];
  });
  const missingId = key === "source_id" ? "?" : baselineId;
  record(
    missing.errors.some((error) => error === `missing field:${missingId}:${key}`),
    `missing field ${key}`,
    missing.errors.slice(0, 3).join("; ")
  );

  const wrongType = errorsOf((report) => {
    report.objects[0][key] = 1;
  });
  const wrongTypeId = key === "source_id" ? "?" : baselineId;
  record(
    wrongType.errors.some((error) => error === `wrong type:${wrongTypeId}:${key}`),
    `wrong type ${key}`,
    wrongType.errors.slice(0, 3).join("; ")
  );
}

mutate("git identity mismatch", (report) => {
  report.implementation_tree = "0".repeat(40);
});

mutate("aggregate count drift", (report) => {
  report.aggregate.valid_count = 12;
});

mutate("disposition closed while unresolved", (report) => {
  report.dispositions[0].disposition = "closed";
});

mutate("disposition blocks_expansion while unresolved", (report) => {
  report.dispositions[1].disposition = "blocks_expansion";
});

const dir = mkdtempSync(join(tmpdir(), "pg01a-q0-write-"));
const output = join(dir, "report.json");
const writeRun = spawnSync(
  process.execPath,
  [
    join(REPO_ROOT, "research/customer-question-corpus/check-q0-truth-report.mjs"),
    "--write",
    "--output",
    output,
    "--implementation-sha",
    sha,
    "--implementation-tree",
    tree
  ],
  { encoding: "utf8" }
);
record(writeRun.status === 0, "temp --write succeeds", writeRun.stderr);
if (writeRun.status === 0) {
  const written = JSON.parse(readFileSync(output, "utf8"));
  record(checkQ0Report(written).length === 0, "temp --write report checks clean");
  const checkRun = spawnSync(
    process.execPath,
    [join(REPO_ROOT, "research/customer-question-corpus/check-q0-truth-report.mjs"), "--check", output],
    { encoding: "utf8" }
  );
  record(checkRun.status === 0, "temp --check succeeds", checkRun.stderr);
}
rmSync(dir, { recursive: true, force: true });

if (fail > 0) {
  process.stderr.write(`[fail] q0 mutations ${fail} failed / ${pass} passed\n`);
  process.exit(1);
}
process.stdout.write(`[ok] q0 mutations ${pass} passed\n`);
