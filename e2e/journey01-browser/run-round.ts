// 同一轮正反例共用一个外部输出根。日志、exit、identity、截图都写在这轮目录里。
// 不读取、不覆盖其它轮的 /private/tmp 证据。根里已有 run.json 时拒绝再跑,避免 exit 混用。

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { judgeJourneyAssociation, type JourneyIdentityRecord, type JourneySeedRecord } from "./round-association.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const evidenceRoot = (process.argv[2] ?? process.env["SAYDO_JOURNEY_EVIDENCE_ROOT"] ?? "").trim();
if (!evidenceRoot) {
  process.stderr.write("用法: pnpm exec tsx e2e/journey01-browser/run-round.ts /private/tmp/saydo-repair12-grok-evidence\n");
  process.exit(2);
}

const runJsonPath = join(evidenceRoot, "run.json");
if (existsSync(runJsonPath)) {
  process.stderr.write(`已有 ${runJsonPath},本轮拒绝复用,请换一个新的输出根\n`);
  process.exit(2);
}

const runId = (process.env["SAYDO_JOURNEY_RUN_ID"] ?? "").trim() || `jr_${Date.now().toString(36)}`;
mkdirSync(evidenceRoot, { recursive: true });
writeFileSync(
  runJsonPath,
  `${JSON.stringify({ runId, evidenceRoot, startedAt: new Date().toISOString() }, null, 2)}\n`
);

interface CaseResult {
  name: "positive" | "negative";
  exitCode: number;
  logPath: string;
  logBytes: number;
  logSha256: string;
  logFocusIds: string[];
  seedFocusId: string | null;
  identityFocusId: string | null;
  identityRunId: string | null;
  taskId: string | null;
  sessionId: string | null;
  associated: boolean;
  reason: string;
}

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function readJson(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

function runCase(name: "positive" | "negative", config: string): Promise<CaseResult> {
  const dir = join(evidenceRoot, name);
  const logDir = join(dir, "logs");
  mkdirSync(logDir, { recursive: true });
  const logPath = join(logDir, "playwright.log");
  const exitPath = join(logDir, "playwright.exit");
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    const child = spawn("pnpm", ["exec", "playwright", "test", "--config", `e2e/journey01-browser/${config}`], {
      cwd: ROOT,
      env: {
        ...process.env,
        SAYDO_JOURNEY_EVIDENCE_ROOT: evidenceRoot,
        SAYDO_JOURNEY_RUN_ID: runId,
        ...(process.env["PLAYWRIGHT_BROWSERS_PATH"]
          ? { PLAYWRIGHT_BROWSERS_PATH: process.env["PLAYWRIGHT_BROWSERS_PATH"] }
          : {})
      }
    });
    child.stdout.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
      process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
      process.stderr.write(chunk);
    });
    child.on("close", (code) => {
      const buf = Buffer.concat(chunks);
      const exitCode = code ?? 1;
      writeFileSync(logPath, buf);
      writeFileSync(exitPath, `${exitCode}\n`);
      const seedRaw = readJson(join(dir, "seed-focus.json"));
      const identityRaw = readJson(join(dir, "journey01-browser-identity.json"));
      const seed: JourneySeedRecord | null = seedRaw
        ? {
            runId: typeof seedRaw["runId"] === "string" ? seedRaw["runId"] : undefined,
            focusId: typeof seedRaw["focusId"] === "string" ? seedRaw["focusId"] : undefined,
            sessionId: typeof seedRaw["sessionId"] === "string" ? seedRaw["sessionId"] : undefined
          }
        : null;
      const identity: JourneyIdentityRecord | null = identityRaw
        ? {
            journeyRunId: typeof identityRaw["journeyRunId"] === "string" ? identityRaw["journeyRunId"] : undefined,
            focusId: typeof identityRaw["focusId"] === "string" ? identityRaw["focusId"] : undefined,
            taskId: typeof identityRaw["taskId"] === "string" ? identityRaw["taskId"] : undefined,
            sessionId: typeof identityRaw["sessionId"] === "string" ? identityRaw["sessionId"] : undefined
          }
        : null;
      const judged = judgeJourneyAssociation({
        runId,
        exitCode,
        logText: buf.toString("utf8"),
        seed,
        identity
      });
      resolve({
        name,
        exitCode,
        logPath,
        logBytes: buf.length,
        logSha256: sha256(buf),
        logFocusIds: judged.logFocusIds,
        seedFocusId: seed?.focusId ?? null,
        identityFocusId: identity?.focusId ?? null,
        identityRunId: identity?.journeyRunId ?? null,
        taskId: identity?.taskId ?? null,
        sessionId: identity?.sessionId ?? null,
        associated: judged.associated,
        reason: judged.reason
      });
    });
  });
}

const positive = await runCase("positive", "playwright.config.ts");
const negative = await runCase("negative", "playwright.negative.config.ts");
const manifest = {
  runId,
  evidenceRoot,
  finishedAt: new Date().toISOString(),
  cases: { positive, negative },
  associated: positive.associated && negative.associated
};
writeFileSync(join(evidenceRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ runId, evidenceRoot, associated: manifest.associated })}\n`);
process.exit(manifest.associated ? 0 : 1);
