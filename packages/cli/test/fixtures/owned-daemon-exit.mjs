import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function posixBirth(pid) {
  // 与 @saydo/platform processBirth 的 Linux 身份格式一致；测试回读平台值核对。
  if (process.platform === "linux") {
    const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
    const close = stat.lastIndexOf(")");
    if (close < 0) throw new Error("invalid proc stat");
    const starttime = stat.slice(close + 2).split(" ")[19];
    if (!starttime) throw new Error("missing proc starttime");
    return `ticks:${starttime}:${pid}`;
  }
  const ps = existsSync("/bin/ps") ? "/bin/ps" : existsSync("/usr/bin/ps") ? "/usr/bin/ps" : "ps";
  return execFileSync(ps, ["-o", "lstart=", "-p", String(pid)], {
    encoding: "utf8",
    timeout: 2_000
  }).trim();
}

function jobName(instanceId, runId, generation) {
  const digest = createHash("sha256")
    .update(`saydo-job-v1\0${instanceId}\0${runId}\0${generation}`, "utf8")
    .digest("hex");
  return `Local\\SayDoJob-v1-${digest}`;
}

function spawnAgent(token, detached = true) {
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)", token], {
    detached,
    stdio: "ignore"
  });
  child.unref();
  if (!child.pid) throw new Error("agent pid missing");
  let birth = "";
  for (let i = 0; i < 25 && !birth; i += 1) {
    try {
      birth = posixBirth(child.pid);
    } catch {
      birth = "";
    }
  }
  if (!birth) throw new Error("agent birth missing");
  return { pid: child.pid, processStart: birth };
}

function writeOwner(targetHome, rec) {
  const dir = join(targetHome, "tier1", "runs", rec.runId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "agent-owner.json"), JSON.stringify({
    version: 1,
    kind: "tier1:agent",
    binary: process.execPath,
    worktree: join(targetHome, "worktree"),
    ...rec
  }));
  writeFileSync(join(targetHome, "SAYDO_TEST_AGENT_PID"), String(rec.pid));
}

const home = process.env.SAYDO_HOME;
const instanceId = process.env.SAYDO_RUNTIME_INSTANCE_ID;
const port = Number(process.env.SAYDO_DAEMON_PORT);
const scenario = process.env.SAYDO_TEST_SCENARIO ?? "reap";
const runId = process.env.SAYDO_TEST_RUN_ID ?? "run_owned_reap";
const generation = process.env.SAYDO_TEST_AGENT_GEN;
if (!home || !instanceId || !generation) process.exit(2);

const birth = posixBirth(process.pid);
if (!birth) process.exit(3);
writeFileSync(join(home, ".daemon-supervisor.lock"), JSON.stringify({
  version: 1,
  pid: process.pid,
  processStart: birth,
  instanceId
}));

if (scenario === "reap" || scenario === "wrong-birth" || scenario === "wrong-pgid" || scenario === "successor") {
  const token = `saydo-child-${generation}`;
  const agent = spawnAgent(token, scenario !== "wrong-pgid");
  writeOwner(home, {
    runId,
    generation,
    commandToken: token,
    jobName: jobName(instanceId, runId, generation),
    pid: agent.pid,
    processStart: scenario === "wrong-birth" ? "reused-pid-wrong-birth" : agent.processStart,
    ownerPid: process.pid,
    ownerInstanceId: instanceId
  });
}

if (scenario === "foreign") {
  const token = `saydo-child-${generation}`;
  const agent = spawnAgent(token);
  writeOwner(home, {
    runId,
    generation,
    commandToken: token,
    jobName: jobName(instanceId, runId, generation),
    pid: agent.pid,
    processStart: agent.processStart,
    ownerPid: process.pid,
    ownerInstanceId: instanceId
  });
  const foreign = process.env.SAYDO_TEST_FOREIGN_HOME;
  const foreignGen = process.env.SAYDO_TEST_FOREIGN_GEN;
  if (!foreign || !foreignGen) process.exit(4);
  const foreignToken = `saydo-child-${foreignGen}`;
  const foreignAgent = spawnAgent(foreignToken);
  writeOwner(foreign, {
    runId: "run_foreign",
    generation: foreignGen,
    commandToken: foreignToken,
    jobName: jobName("foreign-instance", "run_foreign", foreignGen),
    pid: foreignAgent.pid,
    processStart: foreignAgent.processStart,
    ownerPid: 424242,
    ownerInstanceId: "foreign-instance"
  });
}

const ready = {
  v: 1,
  t: "ready",
  identity: {
    sourceRevision: "a".repeat(40),
    buildId: "owned-reap-fixture",
    protocolVersion: "1.0.0"
  },
  port,
  stateRootDigest: "0".repeat(64),
  readiness: {
    version: 1,
    coreReady: true,
    voiceReady: false,
    voice: { enabled: false, reason: "pipeline_absent" }
  }
};

if (typeof process.send !== "function") process.exit(5);
process.send(ready, (err) => {
  if (err) process.exit(6);
  writeFileSync(join(home, "SAYDO_TEST_READY"), "1");
  if (scenario === "successor") {
    const release = process.env.SAYDO_TEST_RELEASE;
    const tick = () => {
      if (release && existsSync(release)) process.exit(7);
      setTimeout(tick, 20);
    };
    tick();
    return;
  }
  setTimeout(() => process.exit(7), 50);
});
