import { writeFileSync } from "node:fs";
import { runControlledExperiment } from "./experiment.js";
import { runHandshake } from "./handshake.js";
import { EFFECT_BOUNDARY } from "./provenance.js";

function fail(message: string, code: number): never {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function flags(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key?.startsWith("--")) fail(`unknown argument ${key ?? ""}`, 2);
    const name = key.slice(2);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) fail(`missing value for ${key}`, 2);
    out[name] = value;
    index += 1;
  }
  return out;
}

function required(args: Record<string, string>, name: string): string {
  const value = args[name];
  if (value === undefined || value === "") fail(`missing --${name}`, 2);
  return value;
}

function writeReport(report: unknown, path: string | undefined): void {
  const text = `${JSON.stringify(report)}\n`;
  process.stdout.write(text);
  if (path) writeFileSync(path, text, "utf8");
}

async function handshake(argv: string[]): Promise<void> {
  const args = flags(argv);
  const intentLog = required(args, "intent-log");
  const timeout = args["timeout-ms"] === undefined ? 15_000 : Number(args["timeout-ms"]);
  if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 120_000) fail("invalid --timeout-ms", 2);
  const report = await runHandshake({ intentLogPath: intentLog, timeoutMs: timeout, termMs: 2_000 });
  writeReport(report, args["report"]);
  process.exit(report.ok ? 0 : report.cliVersionOk ? 4 : 3);
}

async function experiment(argv: string[]): Promise<void> {
  const args = flags(argv);
  const enabled = args["enabled"] === "true";
  const maxTurns = Number(args["max-turns"] ?? "");
  const wallMs = Number(args["wall-ms"] ?? "");
  const report = await runControlledExperiment({
    enabled,
    model: args["model"] ?? "",
    effectBoundary: args["effect-boundary"] ?? "",
    maxTurns: Number.isInteger(maxTurns) ? maxTurns : 0,
    wallMs: Number.isInteger(wallMs) ? wallMs : 0,
    taskId: args["task-id"] ?? "",
    text: args["text"] ?? "",
    intentLogPath: args["intent-log"] ?? ""
  });
  writeReport(report, args["report"]);
  process.exit(report.ok ? 0 : 2);
}

const [command, ...rest] = process.argv.slice(2);
if (command === "handshake") {
  await handshake(rest);
} else if (command === "experiment") {
  await experiment(rest);
} else {
  fail(
    `usage: cli.ts handshake --intent-log <path> [--timeout-ms N] [--report <path>]\nusage: cli.ts experiment --enabled true --model <name> --effect-boundary ${EFFECT_BOUNDARY} --max-turns N --wall-ms N --task-id <id> --text <text> --intent-log <path>`,
    2
  );
}
