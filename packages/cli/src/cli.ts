import { readFileSync } from "node:fs";
import { join } from "node:path";
import { brandTrustedFailure, projectUntrustedFailureText } from "@saydo/platform";
import { CLI_PROTOCOL_VERSION } from "./buildIdentity.js";
import { collectDoctor, readInstalledIdentity, renderDoctorText } from "./doctor.js";
import { consoleUrl, openExternal } from "./open.js";
import { parseCliOptions } from "./options.js";
import { probeDaemon } from "./probe.js";
import { distributionPaths, holdAttached, runOwned } from "./supervisor.js";

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  if (options.command === "doctor") {
    // 只读诊断:不走 ownership 探针(不读 token),不发 provider 请求。
    const report = await collectDoctor({
      home: options.home,
      port: options.port,
      protocolVersion: CLI_PROTOCOL_VERSION,
      installed: readInstalledIdentity(import.meta.dirname, CLI_PROTOCOL_VERSION)
    });
    process.stdout.write(options.json ? `${JSON.stringify(report)}\n` : renderDoctorText(report));
    process.exitCode = report.exitCode;
    return;
  }
  const probe = await probeDaemon(options.home, options.port, CLI_PROTOCOL_VERSION);
  if (options.command === "status") {
    process.stdout.write(`${JSON.stringify(probe)}\n`);
    process.exitCode = probe.kind === "attached" ? 0 : probe.kind === "available" ? 1 : 2;
    return;
  }
  if (options.command === "open") {
    if (probe.kind !== "attached") {
      throw probe.kind === "conflict"
        ? brandTrustedFailure(`port_conflict:${probe.reason}`)
        : brandTrustedFailure("daemon_not_running");
    }
    const token = readFileSync(join(options.home, ".cap-token"), "utf8").trim();
    await openExternal(consoleUrl(options.port, token));
    return;
  }
  if (probe.kind === "conflict") throw brandTrustedFailure(`port_conflict:${probe.reason}`);
  if (probe.kind === "attached") {
    if (options.openBrowser) {
      const token = readFileSync(join(options.home, ".cap-token"), "utf8").trim();
      await openExternal(consoleUrl(options.port, token));
    }
    await holdAttached(probe, options.home);
    return;
  }
  await runOwned({ ...options, paths: distributionPaths() });
}

void main().catch((err) => {
  try {
    process.stderr.write(`[fail] ${projectUntrustedFailureText(err, "cli failed")}\n`);
  } catch {
    process.stderr.write("[fail] cli failed\n");
  }
  process.exitCode = 1;
});
