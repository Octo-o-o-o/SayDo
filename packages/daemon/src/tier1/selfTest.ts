// W5.4-b C1:setup 自检 scope=tier1 骨架(方案 §3.9;09 §11 claude_code 承载段)。
// 按生效 adapter 分叉:claude_code 跑 版本比对 / auth status / hook 链物理自检 / identity 登记写入;
// cursor 投影 tier1StartupVerdict 结论;codex unsupported。
// 检查项全部经可注入 probe 接口(单测 fake 全覆盖,不真调 claude);live 走查归 W5.4-c。
// 一发一收 system/init 断言(apiKeySource=="none" 等)**不在 C1 骨架内**,随 live 自检归 W5.4-c。
//
// 两条分层纪律(评审 90 A-2 回修):
// 1. **identity 只由二进制类检查把门**(binary/version/auth)。hook 链是 daemon 自身运行态,
//    不是 claude 二进制的身份属性;若让它把门,干净的 claude-only 安装会死锁——
//    启动资格要 identity(validateConfig)→ gate 只在启动资格通过后才起(index.ts)→
//    自检要 gate 可达才写 identity,首份 identity 永远生不出来。
// 2. **hook 链按 OS 分叉**:POSIX = jq + curl + unix socket 可达;win32 = 环回端口 + HMAC
//    (gate-bind.json / gate-secret 就位),不查 jq/curl、不连 unix socket(ADR-003 §3)。
//    hook 链红不写 identity 之外的判定,但会让整体 status=fail 并给出处方。

import { execFile } from "node:child_process";
import { accessSync, constants, readFileSync, statSync } from "node:fs";
import { isAbsolute } from "node:path";
import { createConnection } from "node:net";
import { promisify } from "node:util";
import type { SaydoConfig } from "../config/types.js";
import { classifyAuthOutput } from "../config/cliCapability.js";
import { sha256File } from "../providers/binaryIdentity.js";
import { resolveTier1Adapter } from "./resolveAdapter.js";
import { tier1StartupVerdict } from "./validateConfig.js";
import { gatePaths } from "./gateScript.js";
import { writeClaudeIdentity, type ClaudeIdentityRecord } from "./claudeIdentity.js";

const execFileAsync = promisify(execFile);

export interface Tier1SelfTestProbes {
  /** claude --version(probe 只跑命令回原始输出;首 token 比对在自检逻辑里) */
  claudeVersion(bin: string, signal?: AbortSignal): Promise<{ ok: boolean; output?: string; error?: string }>;
  /** claude auth status(回原始输出;loggedIn 判定在自检逻辑里) */
  claudeAuthStatus(bin: string, signal?: AbortSignal): Promise<{ ok: boolean; output?: string; error?: string }>;
  /** hook 链物理依赖:jq / curl 可用(仅 POSIX) */
  commandAvailable(cmd: "jq" | "curl", signal?: AbortSignal): Promise<boolean>;
  /** gate socket 可达(daemon 审批服务在监听;仅 POSIX) */
  socketReachable(sockPath: string): Promise<boolean>;
  /**
   * win32 门资产**形状可用**:gate-bind.json 解析成 {host:"127.0.0.1", port:1..65535 且非 47100}
   * 且 gate-secret 非空,再实测该环回端口可连(评审 91 A-2:只查存在会把两个垃圾文件报成就绪)。
   *
   * **诚实边界(评审 92)**:这是纯 TCP connect,不发 HMAC 请求,因此只证明「某个进程在听该端口」,
   * **不证明** bind/secret 与当前 daemon 配对。完整证明需要发一次带签名的探测请求并校验响应,
   * 归 W5.4-c 的 live 自检;本批只做形状 + 可连。
   */
  gateAssetsPresent?(bindPath: string, secretPath: string): Promise<boolean>;
}

export type Tier1SelfTestCheckName =
  | "binary"
  | "version"
  | "auth"
  | "hook_jq"
  | "hook_curl"
  | "hook_socket"
  | "hook_bind"
  | "identity";

export interface Tier1SelfTestCheck {
  name: Tier1SelfTestCheckName;
  status: "ok" | "fail" | "skipped";
  error?: string;
  detail?: string;
}

export interface Tier1SelfTestReport {
  adapter: string;
  status: "ok" | "fail" | "unsupported";
  checks: Tier1SelfTestCheck[];
  identityWritten: boolean;
  /**
   * 「本次自检写了 identity,而 daemon 的启动资格是启动时算的一次性结论」⇒ 需重启才会武装。
   *
   * **判据的诚实边界(评审 92)**:本批**拿不到 daemon 当前是否已武装**——`tier1StartupVerdict`
   * 只在 `index.ts` 启动路径算一次,没有可查询的运行时武装态。故只要本次自检写入了 identity 就恒报此项,
   * 宁可多提示一次也不漏提示(此前按「本次之前有无可用登记」推断,会在「首次自检后未重启、再跑一次自检」时
   * 错误地撤销处方——评审 92 已点名)。真正的解 = 暴露运行时武装态或支持热重算,归 W5.4-c。
   */
  restartRequiredToArm?: boolean;
  /** 与 restartRequiredToArm 配套的处方(人话,直接可播/可显示) */
  prescription?: string;
}

/** 生产 probe:真调本机命令(live 端点触发才执行;测试一律注入 fake) */
export function defaultTier1Probes(): Tier1SelfTestProbes {
  return {
    async claudeVersion(bin, signal) {
      try {
        const r = await execFileAsync(bin, ["--version"], {
          timeout: 10_000,
          encoding: "utf8",
          maxBuffer: 64 * 1024,
          ...(signal ? { signal } : {})
        });
        return { ok: true, output: r.stdout.trim() };
      } catch (err) {
        return { ok: false, error: String(err instanceof Error ? err.message : err).slice(0, 160) };
      }
    },
    async claudeAuthStatus(bin, signal) {
      try {
        const r = await execFileAsync(bin, ["auth", "status"], {
          timeout: 10_000,
          encoding: "utf8",
          maxBuffer: 64 * 1024,
          ...(signal ? { signal } : {})
        });
        return { ok: true, output: r.stdout.trim() };
      } catch (err) {
        return { ok: false, error: String(err instanceof Error ? err.message : err).slice(0, 160) };
      }
    },
    async commandAvailable(cmd, signal) {
      try {
        await execFileAsync("which", [cmd], { timeout: 3_000, encoding: "utf8", ...(signal ? { signal } : {}) });
        return true;
      } catch {
        return false;
      }
    },
    async gateAssetsPresent(bindPath, secretPath) {
      let port: number;
      try {
        if (!statSync(secretPath).isFile() || statSync(secretPath).size === 0) return false;
        const bind: unknown = JSON.parse(readFileSync(bindPath, "utf8"));
        if (typeof bind !== "object" || bind === null || Array.isArray(bind)) return false;
        const b = bind as { host?: unknown; port?: unknown };
        if (b.host !== "127.0.0.1") return false;
        // 评审 92:缺上界会让畸形 bind 里的超范围端口把 createConnection 抛成 reject,整个自检炸掉
        if (
          typeof b.port !== "number" ||
          !Number.isInteger(b.port) ||
          b.port <= 0 ||
          b.port > 65535 ||
          b.port === 47100
        ) {
          return false;
        }
        port = b.port;
      } catch {
        return false;
      }
      // 端口可达性:与 POSIX 的 socketReachable 同语义(证明 daemon 审批服务真的在听)
      return new Promise((resolve) => {
        const sock = createConnection({ host: "127.0.0.1", port });
        const done = (up: boolean): void => {
          sock.destroy();
          resolve(up);
        };
        sock.setTimeout(2_000, () => done(false));
        sock.once("connect", () => done(true));
        sock.once("error", () => done(false));
      });
    },
    socketReachable(sockPath) {
      return new Promise((resolve) => {
        const sock = createConnection(sockPath);
        const done = (up: boolean): void => {
          sock.destroy();
          resolve(up);
        };
        sock.setTimeout(2_000, () => done(false));
        sock.once("connect", () => done(true));
        sock.once("error", () => done(false));
      });
    }
  };
}

/** claude --version 输出首 token(实测形态 "2.1.220 (Claude Code)";合同:首 token 比对) */
export function claudeVersionFirstToken(output: string): string {
  return output.trim().split(/\s+/)[0] ?? "";
}

export interface Tier1SelfTestInput {
  saydoHome: string;
  cfg: SaydoConfig | null;
  probes: Tier1SelfTestProbes;
  now?: () => Date;
  signal?: AbortSignal;
}

function claudeBinaryCheck(bin: string | undefined): Tier1SelfTestCheck {
  if (!bin || bin.trim() === "") {
    return {
      name: "binary",
      status: "fail",
      error: '[tier1] 缺 claude_bin;配置 claude_bin="<claude 实体绝对路径>" 后重试'
    };
  }
  if (!isAbsolute(bin)) {
    return { name: "binary", status: "fail", error: `claude_bin 必须是绝对路径(pin 红线),得到 "${bin}"` };
  }
  try {
    if (!statSync(bin).isFile()) return { name: "binary", status: "fail", error: `claude_bin 不是常规文件:${bin}` };
  } catch {
    return { name: "binary", status: "fail", error: `claude_bin 文件不存在:${bin}` };
  }
  try {
    accessSync(bin, constants.X_OK);
  } catch {
    return { name: "binary", status: "fail", error: `claude_bin 不可执行:${bin}` };
  }
  return { name: "binary", status: "ok" };
}

async function claudeSelfTest(input: Tier1SelfTestInput): Promise<Tier1SelfTestReport> {
  const checks: Tier1SelfTestCheck[] = [];
  const tier1 = input.cfg?.tier1;
  const bin = tier1?.claude_bin;
  const pinned = tier1?.claude_pinned_version;

  const binaryCheck = claudeBinaryCheck(bin);
  checks.push(binaryCheck);

  let versionToken = "";
  if (binaryCheck.status !== "ok" || !bin) {
    checks.push({ name: "version", status: "skipped" }, { name: "auth", status: "skipped" });
  } else {
    const ver = await input.probes.claudeVersion(bin, input.signal);
    if (!ver.ok || !ver.output) {
      checks.push({ name: "version", status: "fail", error: ver.error ?? "claude --version 无输出" });
    } else {
      versionToken = claudeVersionFirstToken(ver.output);
      if (!pinned || pinned.trim() === "") {
        checks.push({
          name: "version",
          status: "fail",
          error: `[tier1] 缺 claude_pinned_version;实测版本 ${versionToken},确认后写入配置`,
          detail: ver.output
        });
      } else if (versionToken !== pinned.trim()) {
        checks.push({
          name: "version",
          status: "fail",
          error: `claude 版本漂移:pinned "${pinned.trim()}" 实测 "${versionToken}"——升级须重跑门禁仪式,不走自更新生效路径`,
          detail: ver.output
        });
      } else {
        checks.push({ name: "version", status: "ok", detail: ver.output });
      }
    }
    const auth = await input.probes.claudeAuthStatus(bin, input.signal);
    if (!auth.ok || !auth.output) {
      checks.push({ name: "auth", status: "fail", error: auth.error ?? "claude auth status 无输出" });
    } else if (classifyAuthOutput(auth.output) === "logged_in") {
      checks.push({ name: "auth", status: "ok" });
    } else {
      checks.push({
        name: "auth",
        status: "fail",
        error: "claude 未登录:请在终端跑 claude 并 /login(订阅只经 CLI 登录态,不配 ANTHROPIC_API_KEY)"
      });
    }
  }

  // ——以上为 identity 把门项(二进制身份属性);以下 hook 链只报状态,不把门(见文件头纪律 1)——
  const identityGateOk = checks.every((c) => c.status === "ok");

  const gp = gatePaths(input.saydoHome);
  if (process.platform === "win32") {
    checks.push(
      { name: "hook_jq", status: "skipped", detail: "win32 门走 Node JSON.parse,不依赖 jq" },
      { name: "hook_curl", status: "skipped", detail: "win32 门走 Node http,不依赖 curl" },
      { name: "hook_socket", status: "skipped", detail: "win32 运输 = 环回端口 + HMAC,不用 unix socket" }
    );
    const present = (await input.probes.gateAssetsPresent?.(gp.bindPath, gp.secretPath)) ?? false;
    checks.push(
      present
        ? { name: "hook_bind", status: "ok", detail: gp.bindPath }
        : {
            name: "hook_bind",
            status: "fail",
            error: `win32 门资产未就位:${gp.bindPath} / ${gp.secretPath}(daemon 审批服务未监听?)`
          }
    );
  } else {
    for (const cmd of ["jq", "curl"] as const) {
      const available = await input.probes.commandAvailable(cmd, input.signal);
      checks.push(
        available
          ? { name: cmd === "jq" ? "hook_jq" : "hook_curl", status: "ok" }
          : {
              name: cmd === "jq" ? "hook_jq" : "hook_curl",
              status: "fail",
              error: `hook 链依赖 ${cmd} 不可用(gate-claude.sh 物理前提)`
            }
      );
    }
    const sockUp = await input.probes.socketReachable(gp.sockPath);
    checks.push(
      sockUp
        ? { name: "hook_socket", status: "ok", detail: gp.sockPath }
        : { name: "hook_socket", status: "fail", error: `gate socket 不可达:${gp.sockPath}(daemon 审批服务未监听?)` }
    );
    checks.push({ name: "hook_bind", status: "skipped", detail: "POSIX 运输 = unix socket,无 bind 文件" });
  }

  let identityWritten = false;
  if (identityGateOk && bin && pinned) {
    try {
      const record: ClaudeIdentityRecord = {
        binaryPath: bin,
        binaryDigest: sha256File(bin),
        version: versionToken,
        testedAt: (input.now?.() ?? new Date()).toISOString(),
        receipt: {
          source: "setup_self_test_tier1",
          checks: Object.fromEntries(checks.map((c) => [c.name, c.status]))
        }
      };
      writeClaudeIdentity(input.saydoHome, record);
      identityWritten = true;
      checks.push({ name: "identity", status: "ok", detail: "claude-identity.json 已写入" });
    } catch (err) {
      checks.push({
        name: "identity",
        status: "fail",
        error: `identity 登记写入失败:${String(err instanceof Error ? err.message : err).slice(0, 160)}`
      });
    }
  } else {
    checks.push({
      name: "identity",
      status: "skipped",
      detail: "二进制类检查(binary/version/auth)未全过,不写登记(fail-closed);hook 链状态不参与本判定"
    });
  }

  // skipped 是「本平台/本分支不适用」,不算红;只有 fail 才让整体红
  const status = checks.some((c) => c.status === "fail") ? "fail" : "ok";
  // 评审 92:不能用「之前有没有登记」推断武装态——首次自检后未重启就再跑一次,
  // 会错误撤销处方。只要写了 identity 就恒报需重启(宁多勿漏),直到 W5.4-c 暴露真实武装态。
  return {
    adapter: "claude_code",
    status,
    checks,
    identityWritten,
    ...(identityWritten
      ? {
          restartRequiredToArm: true,
          prescription:
            "身份登记已写入,但执行器要在 daemon 下次启动时才会武装——跑 `just daemon restart` 后 queued 任务才会被认领"
        }
      : {})
  };
}

/** scope=tier1 自检入口(runSetupTest 消费;按生效 adapter 分叉) */
export async function runTier1SelfTest(input: Tier1SelfTestInput): Promise<Tier1SelfTestReport> {
  const adapter = resolveTier1Adapter(input.cfg);
  if (adapter === "claude_code") return claudeSelfTest(input);
  if (adapter === "cursor") {
    const verdict = tier1StartupVerdict({
      cursorAgentBin: input.cfg?.tier1?.cursor_agent_bin,
      pinnedVersion: input.cfg?.tier1?.cursor_agent_pinned_version,
      adapter
    });
    const check: Tier1SelfTestCheck = verdict.start
      ? { name: "binary", status: "ok", detail: `锁定副本 ${verdict.bin}(pinned ${verdict.pinned})` }
      : { name: "binary", status: "fail", error: verdict.reason };
    return {
      adapter,
      status: verdict.start ? "ok" : "fail",
      checks: [check],
      identityWritten: false
    };
  }
  return {
    adapter,
    status: "unsupported",
    checks: [
      {
        name: "binary",
        status: "fail",
        error: `models.dev.agent="${adapter}" 后端执行器未实现(仅 cursor/claude_code)`
      }
    ],
    identityWritten: false
  };
}
