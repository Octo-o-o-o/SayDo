// Journey-01 同库浏览器闭环 harness 常量。
// 标注:scripted LLM + FileWriting 形态的本地 cursor-agent 替身,不是云模型或付费 CLI。

import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const ROOT = join(import.meta.dirname, "..", "..");
/** keep-npm 正例与 drop-npm 反例分端口,避免同机两次 harness 抢同一个 loopback。 */
export const JOURNEY_MODE = process.env["JOURNEY_MODE"] === "drop-npm" ? "drop-npm" : "keep-npm";
export const DAEMON_PORT = JOURNEY_MODE === "drop-npm" ? 47212 : 47210;
export const LLM_PORT = JOURNEY_MODE === "drop-npm" ? 47213 : 47211;
export const PINNED = "1.0.0-pinned";
export const CLAIM = "用户偏好:发布前不用再问我";

const TEST_STATE_PARENT =
  process.platform === "darwin" ? "/private/tmp" : process.platform === "linux" ? "/tmp" : tmpdir();

/** 同一轮正反例共用。未设置时不得写入旧轮目录。 */
export const JOURNEY_RUN_ID = (process.env["SAYDO_JOURNEY_RUN_ID"] ?? "").trim();
export const EVIDENCE_ROOT = (process.env["SAYDO_JOURNEY_EVIDENCE_ROOT"] ?? "").trim();
const runSuffix = JOURNEY_RUN_ID ? `-${JOURNEY_RUN_ID.replace(/[^0-9A-Za-z_-]/g, "")}` : "";

/** 与 SAYDO_HOME 分开的可写临时家目录。本沙箱写不了真实 home 与任务目录。 */
export const OWNER_HOME = join(TEST_STATE_PARENT, `saydo-journey01-owner-home-${DAEMON_PORT}${runSuffix}`);
export const HOME = join(TEST_STATE_PARENT, `saydo-journey01-browser-home-${DAEMON_PORT}${runSuffix}`);
export const WORKSPACE = join(OWNER_HOME, "workspace");
export const RUNTIME = join(HOME, "e2e-runtime.json");
export const LLM_LOG = join(HOME, "scripted-llm.jsonl");

/** Crockford 26 位,过 console VoiceContext 与 contracts idSchema */
export const SESSION_ID = "ses_01J01BR0WSER00000000000001";
export const PROJECT_ID = "prj_01J01BR0WSER00000000000001";

export const SCRIPT_LLM_KEY = "journey01-local-scripted-not-a-cloud-key";
export const DIALOG_MODEL = "gpt-4o-mini";
export const EVALUATOR_MODEL = "claude-sonnet-4";
export const AGENT_MODEL = "fable-5-max";

/** 本轮正反例截图、identity、daemon 日志都落在这个根下,不复用旧轮目录。 */
export const EVIDENCE = EVIDENCE_ROOT
  ? join(EVIDENCE_ROOT, JOURNEY_MODE === "drop-npm" ? "negative" : "positive")
  : join(TEST_STATE_PARENT, "saydo-journey01-evidence-unset", JOURNEY_MODE);
export const DAEMON_LOG = join(EVIDENCE, "logs", "daemon.log");

export function assertJourneyRoundEnv(): void {
  if (!EVIDENCE_ROOT || !JOURNEY_RUN_ID) {
    throw new Error(
      "同一轮浏览器证据需要同时设置 SAYDO_JOURNEY_EVIDENCE_ROOT 与 SAYDO_JOURNEY_RUN_ID"
    );
  }
}

export function assertSeedMatchesRuntime(runtime: {
  sessionId: string;
  projectId: string;
  focusId: string;
}): void {
  assertJourneyRoundEnv();
  const seed = JSON.parse(readFileSync(join(EVIDENCE, "seed-focus.json"), "utf8")) as {
    runId: string;
    sessionId: string;
    projectId: string;
    focusId: string;
  };
  if (
    seed.runId !== JOURNEY_RUN_ID ||
    seed.focusId !== runtime.focusId ||
    seed.sessionId !== runtime.sessionId ||
    seed.projectId !== runtime.projectId
  ) {
    throw new Error(
      `本轮 seed 与 runtime 不一致 run=${JOURNEY_RUN_ID} seedFocus=${seed.focusId} runtimeFocus=${runtime.focusId}`
    );
  }
}

export const DEMAND = "帮我把 README 的安装一节补个 pnpm 说明";
export const INTERVIEW =
  "受众是商业。目标是给 README 安装一节补 pnpm 说明。验收是安装一节出现 pnpm install 示例,并且现有 npm 说明保留。范围只改 README 安装小节。我已经看过仓库里现有的 npm 安装说明。";
export const PACKAGE_GO = "对上了,按刚才说的出包";
export const START = "开始吧";
export const MEMORY = "以后发布前不用再问我";
export const REUSE = "按记住的偏好继续,发布前不用再问";
