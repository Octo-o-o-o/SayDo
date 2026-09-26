// 同库浏览器闭环装配:真实 daemon 进程 + 同源 console dist + 同一临时 SQLite。
// scripted LLM 与 fake cursor-agent 明确标注为本地 fixture,不冒称云服务。
// 不调用 /dev/seed-fixture,不复制业务 HTTP/WS 到测试服务器。

import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  AGENT_MODEL,
  DAEMON_LOG,
  JOURNEY_MODE,
  DAEMON_PORT,
  DIALOG_MODEL,
  EVALUATOR_MODEL,
  EVIDENCE,
  HOME,
  JOURNEY_RUN_ID,
  LLM_LOG,
  LLM_PORT,
  OWNER_HOME,
  PINNED,
  ROOT,
  RUNTIME,
  SCRIPT_LLM_KEY,
  WORKSPACE,
  assertJourneyRoundEnv
} from "./constants.js";

function waitOk(url: string, what: string, logPath?: string): Promise<void> {
  return (async () => {
    let lastError = "";
    for (let i = 0; i < 90; i++) {
      try {
        const r = await fetch(url);
        if (r.ok) return;
        lastError = `HTTP ${r.status}`;
      } catch (err) {
        lastError = String((err as { message?: unknown })?.message ?? err);
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    let tail = "";
    if (logPath && existsSync(logPath)) {
      try {
        tail = `\n--- ${logPath} (tail) ---\n${readFileSync(logPath, "utf8").slice(-6000)}`;
      } catch {
        tail = `\n(日志不可读:${logPath})`;
      }
    }
    throw new Error(`${what} did not become ready: ${url} lastError=${lastError}${tail}`);
  })();
}

function killTree(child: ChildProcess): void {
  try {
    if (!child.pid) {
      child.kill();
      return;
    }
    if (process.platform === "win32") child.kill("SIGKILL");
    else process.kill(-child.pid);
  } catch {
    child.kill();
  }
}

function writeConfig(agentBin: string): void {
  const toml = `# journey01-browser 本地 fixture。scripted provider + FileWriting cursor-agent 替身,不是云服务。
[models]
profile = "default"
dialog = { provider = "api", via = "local_scripted", model = "${DIALOG_MODEL}" }
thinking = { provider = "api", via = "local_scripted", model = "${DIALOG_MODEL}" }
cheap = { provider = "api", via = "local_scripted", model = "${DIALOG_MODEL}" }
evaluator = { provider = "api", via = "local_scripted", model = "${EVALUATOR_MODEL}" }

[models.dev]
agent = "cursor"
transport = "cli"
model = "${AGENT_MODEL}"

[providers.api.local_scripted]
base_url = "http://127.0.0.1:${LLM_PORT}/v1"
api_key = "env:SCRIPT_LLM_KEY"

[gate0]
enabled = true
bypass = false

[tier1]
cursor_agent_bin = "${agentBin.replace(/\\/g, "/")}"
cursor_agent_pinned_version = "${PINNED}"

[budget]
monthly = 200
currency = "CNY"
[dnd]
window = "23:00-08:00"

[privacy]
store_audio = false
store_transcript = true
audio_retention_days = 0
`;
  writeFileSync(join(HOME, "config.toml"), toml, { mode: 0o600 });
  writeFileSync(join(HOME, ".env"), `SCRIPT_LLM_KEY=${SCRIPT_LLM_KEY}\n`, { mode: 0o600 });
}

function makeGitRepo(): void {
  rmSync(WORKSPACE, { recursive: true, force: true });
  mkdirSync(WORKSPACE, { recursive: true });
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: WORKSPACE });
  execFileSync("git", ["config", "user.email", "t@t.local"], { cwd: WORKSPACE });
  execFileSync("git", ["config", "user.name", "t"], { cwd: WORKSPACE });
  // 只登记 check-readme。无操作 `node -e process.exit(0)` 不检查 npm;
  // 缺 packageManager 时 corepack 会去下载最新 pnpm,失败则 exit 1、stdout 为空,这条检查不会执行。
  const repoPkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { packageManager?: unknown };
  const packageManager = repoPkg.packageManager;
  if (typeof packageManager !== "string" || !/^pnpm@\d+\.\d+\.\d+$/.test(packageManager)) {
    throw new Error(`journey fixture requires repo packageManager pnpm@x.y.z, got ${String(packageManager)}`);
  }
  writeFileSync(
    join(WORKSPACE, "package.json"),
    JSON.stringify({
      name: "journey01",
      version: "1.0.0",
      packageManager,
      scripts: {
        "check-readme": "node ./check-readme-install.mjs"
      }
    })
  );
  copyFileSync(join(import.meta.dirname, "check-readme-install.mjs"), join(WORKSPACE, "check-readme-install.mjs"));
  mkdirSync(join(WORKSPACE, ".saydo"));
  writeFileSync(
    join(WORKSPACE, ".saydo", "project.toml"),
    '[[verify.entries]]\nname = "check-readme"\nsource = "package_script"\nref = "check-readme"\n'
  );
  writeFileSync(join(WORKSPACE, "README.md"), "# 安装\n\nnpm install\n");
  execFileSync("git", ["add", "-A"], { cwd: WORKSPACE });
  execFileSync("git", ["commit", "-qm", "init"], { cwd: WORKSPACE });
}

export default async function globalSetup(): Promise<() => void> {
  assertJourneyRoundEnv();
  mkdirSync(join(EVIDENCE, "logs"), { recursive: true });
  rmSync(HOME, { recursive: true, force: true });
  mkdirSync(HOME, { recursive: true, mode: 0o700 });
  mkdirSync(OWNER_HOME, { recursive: true, mode: 0o700 });
  mkdirSync(join(HOME, "sessions"), { recursive: true, mode: 0o700 });
  mkdirSync(join(HOME, "logs"), { recursive: true, mode: 0o700 });

  const agentDir = join(HOME, "versions", PINNED);
  mkdirSync(agentDir, { recursive: true });
  const agentBin = join(agentDir, "cursor-agent");
  const agentSrc = JOURNEY_MODE === "drop-npm" ? "fake-cursor-agent-drop-npm.mjs" : "fake-cursor-agent.mjs";
  copyFileSync(join(import.meta.dirname, agentSrc), agentBin);
  chmodSync(agentBin, 0o755);

  writeConfig(agentBin);
  makeGitRepo();

  execFileSync("pnpm", ["--filter", "@saydo/console", "build"], { cwd: ROOT, stdio: "inherit" });

  process.env["SAYDO_HOME"] = HOME;
  process.env["HOME"] = OWNER_HOME;
  const tsx = join(ROOT, "packages/daemon/node_modules/.bin/tsx");
  execFileSync(tsx, [join(import.meta.dirname, "seed-rig.ts")], {
    cwd: ROOT,
    env: { ...process.env, HOME: OWNER_HOME, SAYDO_HOME: HOME, JOURNEY_WORKSPACE: WORKSPACE },
    stdio: "inherit"
  });
  const seed = JSON.parse(readFileSync(join(HOME, "seed-ids.json"), "utf8")) as {
    sessionId: string;
    projectId: string;
    focusId: string;
  };
  writeFileSync(
    join(EVIDENCE, "seed-focus.json"),
    `${JSON.stringify(
      { runId: JOURNEY_RUN_ID, sessionId: seed.sessionId, projectId: seed.projectId, focusId: seed.focusId },
      null,
      2
    )}\n`
  );

  let llm: ChildProcess | null = null;
  let daemon: ChildProcess | null = null;
  try {
    const llmLogFd = openSync(join(HOME, "scripted-llm.stdio.log"), "a");
    llm = spawn(tsx, [join(import.meta.dirname, "scripted-llm.ts")], {
      cwd: ROOT,
      env: { ...process.env, HOME: OWNER_HOME, SCRIPT_LLM_PORT: String(LLM_PORT), SCRIPT_LLM_LOG: LLM_LOG },
      stdio: ["ignore", llmLogFd, llmLogFd],
      detached: true
    });
    await waitOk(`http://127.0.0.1:${LLM_PORT}/health`, "scripted-llm");

    const daemonLogFd = openSync(DAEMON_LOG, "w");
    daemon = spawn("pnpm", ["--filter", "@saydo/daemon", "start"], {
      cwd: ROOT,
      env: {
        ...process.env,
        HOME: OWNER_HOME,
        SAYDO_HOME: HOME,
        SAYDO_DAEMON_PORT: String(DAEMON_PORT),
        SCRIPT_LLM_KEY,
        VOLC_APP_ID: "e2e-local-fixture",
        VOLC_ACCESS_TOKEN: "e2e-local-fixture"
      },
      stdio: ["ignore", daemonLogFd, daemonLogFd],
      detached: true
    });
    await waitOk(`http://127.0.0.1:${DAEMON_PORT}/health`, "daemon", DAEMON_LOG);
    const token = readFileSync(join(HOME, ".cap-token"), "utf8").trim();
    writeFileSync(
      RUNTIME,
      JSON.stringify(
        {
          token,
          sessionId: seed.sessionId,
          projectId: seed.projectId,
          focusId: seed.focusId,
          home: HOME,
          workspace: WORKSPACE,
          port: DAEMON_PORT,
          llmPort: LLM_PORT,
          fixture: {
            model: "scripted-openai-compat",
            executor: JOURNEY_MODE === "drop-npm" ? "fake-cursor-agent-drop-npm FileWriting" : "fake-cursor-agent FileWriting",
            note: "确定性本地适配,不是云模型或付费 CLI 验收"
          }
        },
        null,
        2
      )
    );
  } catch (err) {
    if (daemon) killTree(daemon);
    if (llm) killTree(llm);
    throw err;
  }
  return () => {
    if (daemon) killTree(daemon);
    if (llm) killTree(llm);
  };
}
