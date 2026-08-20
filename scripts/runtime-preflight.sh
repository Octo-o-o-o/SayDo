#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 || ! "$1" =~ ^[0-9a-f]{40}$ ]]; then
  echo "用法:scripts/runtime-preflight.sh <40位-runtime-SHA>" >&2
  exit 2
fi

expected_sha="$1"
saydo_home_path="$(
  node -e 'process.stdout.write(require("node:path").resolve(process.argv[1]))' "${SAYDO_HOME:-$HOME/.saydo}"
)"
state_root_digest="$(printf '%s' "$saydo_home_path" | shasum -a 256 | awk '{print $1}')"
runtime_path="$saydo_home_path/runtime"
daemon_label="gui/$(id -u)/com.saydo.daemon"
pipeline_label="gui/$(id -u)/com.saydo.pipeline"
daemon_plist="$HOME/Library/LaunchAgents/com.saydo.daemon.plist"
pipeline_plist="$HOME/Library/LaunchAgents/com.saydo.pipeline.plist"
config_path="$saydo_home_path/config.toml"
env_path="$saydo_home_path/.env"
database_path="$saydo_home_path/saydo.db"

test -d "$runtime_path/.git"
test -f "$config_path"
test -f "$env_path"
test -f "$database_path"
test -f "$daemon_plist"
test -f "$pipeline_plist"
actual_sha="$(git -C "$runtime_path" rev-parse HEAD)"
test "$actual_sha" = "$expected_sha"
test -z "$(git -C "$runtime_path" status --porcelain=v1)"

daemon_state="$(launchctl print "$daemon_label")"
pipeline_state="$(launchctl print "$pipeline_label")"
grep -Fq $'\tstate = running' <<<"$daemon_state"
grep -Fq "working directory = $runtime_path/packages/daemon" <<<"$daemon_state"
grep -Fq "$runtime_path/packages/daemon/src/index.ts" <<<"$daemon_state"
grep -Fq $'\tstate = running' <<<"$pipeline_state"
grep -Fq "working directory = $runtime_path/pipeline" <<<"$pipeline_state"
test "$(/usr/libexec/PlistBuddy -c 'Print :WorkingDirectory' "$pipeline_plist")" = "$runtime_path/pipeline"
test "$(/usr/libexec/PlistBuddy -c 'Print :ProgramArguments:1' "$pipeline_plist")" = "run"
test "$(/usr/libexec/PlistBuddy -c 'Print :ProgramArguments:2' "$pipeline_plist")" = "python"
test "$(/usr/libexec/PlistBuddy -c 'Print :ProgramArguments:3' "$pipeline_plist")" = "-m"
test "$(/usr/libexec/PlistBuddy -c 'Print :ProgramArguments:4' "$pipeline_plist")" = "saydo_pipeline"
test "$(/usr/libexec/PlistBuddy -c 'Print :EnvironmentVariables:SAYDO_HOME' "$daemon_plist")" = "$saydo_home_path"
test "$(/usr/libexec/PlistBuddy -c 'Print :EnvironmentVariables:SAYDO_HOME' "$pipeline_plist")" = "$saydo_home_path"

health_json="$(curl -fsS --max-time 3 http://127.0.0.1:47100/health)"
ready_json="$(curl -fsS --max-time 3 http://127.0.0.1:47100/readyz)"
node -e '
try {
  const health = JSON.parse(process.argv[1]);
    const ready = JSON.parse(process.argv[2]);
    const expected = process.argv[3];
    const expectedStateRoot = process.argv[4];
    if (
      health.ok !== true ||
      health.service !== "saydo-daemon" ||
      health.runtimeSha !== expected ||
      health.stateRootDigest !== expectedStateRoot ||
      ready.ok !== true ||
      ready.service !== "saydo-runtime" ||
      ready.daemonRuntimeSha !== expected ||
      ready.pipelineRuntimeSha !== expected ||
      ready.daemonStateRootDigest !== expectedStateRoot ||
      ready.pipelineStateRootDigest !== expectedStateRoot ||
    ready.pipelineConnected !== true ||
    ready.asr !== "ok" ||
    ready.tts !== "ok" ||
    typeof ready.pipelineHealthAgeMs !== "number" ||
    ready.pipelineHealthAgeMs < 0 ||
    ready.pipelineHealthAgeMs > 45000
  ) throw new Error("runtime identity mismatch or pipeline health stale");
} catch (error) {
  process.stderr.write(`[fail] runtime health/readyz 校验失败:${error.message}\n`);
  process.exit(1);
}
' "$health_json" "$ready_json" "$expected_sha" "$state_root_digest"

release_config_digest="$(
  {
    shasum -a 256 "$config_path" "$env_path" "$daemon_plist" "$pipeline_plist"
    sqlite3 -readonly "$database_path" \
      "SELECT project_id || char(9) || overrides_json FROM project_settings ORDER BY project_id;"
    sqlite3 -readonly -json "$database_path" \
      "SELECT id, workspace_json FROM projects ORDER BY id;" |
      node -e '
        const { createHash } = require("node:crypto");
        const { existsSync, readFileSync } = require("node:fs");
        const { join } = require("node:path");
        const rows = JSON.parse(readFileSync(0, "utf8") || "[]");
        for (const row of rows) {
          const workspace = JSON.parse(row.workspace_json);
          if (workspace.kind !== "local_folder" || typeof workspace.path !== "string") continue;
          const path = join(workspace.path, ".saydo", "project.toml");
          if (!existsSync(path)) continue;
          const digest = createHash("sha256").update(readFileSync(path)).digest("hex");
          process.stdout.write(`${row.id}\t${workspace.path}\t${digest}\n`);
        }
      '
  } | shasum -a 256 | awk '{print $1}'
)"
printf '[ok] runtime=%s release-config=%s daemon=running pipeline=running loaded-sha=exact readyz=ok clean=true\n' \
  "$actual_sha" "$release_config_digest"
