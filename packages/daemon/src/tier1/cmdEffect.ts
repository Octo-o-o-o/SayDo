// 命令 → EffectDescriptor 保守映射(执行器批;04 §5.1 风险分级的 shell 命令投影)。
// E2 纪律"分级由效果计算,不按动作名硬编码"(03 §2)在 shell 门这里的现实形态:
// hooks 只给命令字符串,效果必须从命令语义**保守推导**——本表是"命令词面 → 效果类"的
// fail-closed 词表(不是绕开 E2 的第二引擎:输出仍是 EffectDescriptor,分级仍由 policy/engine
// computeRisk 单源计算)。原则:
// - 识别不出的命令一律按 install_dependency 档上浮(S2 确认一句话的代价 << 漏放行);
// - 词面含敏感路径(.env/credential/secret/token/key 文件)⇒ touchesSensitiveData 升级(04 §5.1);
// - force push / 绝对路径删除 / 管道执行远端脚本 ⇒ S3 类效果(语音永不放行,agent 换路);
// - 复合命令(&&/;/|/子 shell)按"最高风险段"归类:任一段不可判 ⇒ 整条按不可判处理。
//
// 2026-08-19 词表加固(回哺 dsh-approval-tiers 两轮评审)+ 评审 1/2 返工:
// git 全局旗标 floor S2 与 -c exec 键 S3、sed/awk 程序体、env -C、git 路径子命令、
// 包管理器全局旗标、远端内容执行、大小写取高、push --mirror、curl -T、
// pkg exec 递归、${HOME}、--exec-path 圈外、反斜杠与 g 前缀词头。
// 不搬 dsh 的 workdir 判定(SayDo cwd 由执行器给定)。

import type { EffectDescriptor } from "../policy/engine.js";

/** 只读词表(S0):worktree 读 + 常见只读查询;带重定向的不算(写文件)。env/find 已移出(评审 1 A1) */
const READ_ONLY_HEADS = new Set([
  "ls", "cat", "head", "tail", "pwd", "which", "whoami", "date", "printenv",
  "rg", "grep", "wc", "file", "stat", "du", "df", "tree", "diff", "readlink", "basename", "dirname"
]);

/**
 * worktree 内写类(S1):改文件/建目录/本地 git 操作(04 §5.1:改代码、跑登记好的验证、本地 commit 自动放行)。
 *
 * **任意代码执行入口(node/python/python3/tsx/just)已于 2026-08-15 移出本表**:它们可执行任意代码——
 * 发网络请求、读写 worktree 外路径,效果上限远高于 S1;按 S1 自动放行 = 让 S3 级效果无人过目
 * (`node -e "fetch(...)"` 与 `node build.js` 在词面上无法区分)。移出后落到函数末尾的保守上浮档
 * (`install_dependency` = S2,确认一次)。
 * `just` 同列:它执行 worktree 内 justfile,而 justfile 是 agent 可写的(S1),
 * 留在 S1 等于给上面几个解释器留一条绕行路(写 justfile 再 `just <task>`)。
 * **高频合法用途不受影响**:登记 verify 在 gate 层先于本分类匹配(executor.ts `matchesFrozenVerify`
 * ⇒ `run_registered_verify`),跑测试仍走独立通道,不经本表;且 `justfile:<task>` 本就是
 * verify 冻结的一等形态(verifyFreeze.ts 的 templateRef,含 justfile 体内 pnpm 脚本的递归闭包),
 * 故 `just ci` / `just test` 这类登记任务照常自动放行。
 * 解除条件:egress 隔离(受控执行环境,09 §11 P1)落地后重新评估。
 *
 * chown/chgrp/Unix install 不进本表:旧分类对它们是未知词头 S2,本批只收紧圈外写出到 S3,
 * 圈内保持 S2(不放宽到 S1)。
 */
const WORKTREE_WRITE_HEADS = new Set(["mkdir", "touch", "mv", "cp", "ln", "chmod", "sed", "awk", "tee", "echo", "printf"]);

/** git 只读子命令(branch/remote/config 已拆出,写形态不再当只读) */
const GIT_READ_SUB = new Set(["status", "diff", "log", "show", "rev-parse", "ls-files", "blame", "describe"]);
/** git 本地写子命令(S1;push 单独处理) */
const GIT_LOCAL_SUB = new Set(["add", "commit", "checkout", "switch", "restore", "stash", "merge", "rebase", "cherry-pick", "reset", "tag", "worktree", "init", "rm", "mv", "clean", "apply"]);

/** 包管理器三档(评审 1 A4 / 评审 2 A8):S1 只读查询 / S2 安装类与脚本执行类 / S3 发布登录;未知动词 S2 */
const PKG_MANAGERS = new Set(["pnpm", "npm", "yarn", "pip", "pip3", "uv", "cargo", "go", "brew", "gem", "poetry"]);
/** 包管理器只读查询(保持既有 S1 语义,不放宽到 S0) */
const PKG_QUERY_S1 = new Set(["ls", "list", "outdated", "why", "view", "info", "--version"]);
/**
 * package-script / 本地 bin 执行动词(SD-3,2026-09-08):`pnpm run x` / `pnpm test` / `pnpm exec <bin>` /
 * `cargo run` / `go build` 等都执行 package.json 脚本、构建脚本或本地 bin——与 node/just 一样是任意代码入口
 * (脚本正文与 runner 配置都是 agent 可写的),按能力分类,不按语言名/测试工具名豁免。
 * 未登记形态一律走 `install_dependency`(S2,确认一次);高频合法用途照旧走登记 verify:gate 层
 * `matchesFrozenVerify` 先于本表命中 ⇒ `run_registered_verify`,冻结 argv + 配置闭包,不经本表。
 * 已知限制(不在本条承诺内):verify 冻结闭包不含脚本的间接 import,verifier 抗篡改另行立项。
 */
const PKG_SCRIPT_EXEC = new Set([
  "run", "test", "build", "start", "dev", "lint", "typecheck", "check", "format", "fmt", "exec"
]);
const PKG_S2 = new Set([
  "install", "i", "add", "ci", "update", "upgrade", "sync", "dlx", "x",
  "create", "init", "get", "download", "link", "rebuild"
]);
const PKG_S3 = new Set([
  "publish", "login", "logout", "adduser", "token", "deprecate", "unpublish"
]);
const PKG_FETCH_HEADS = new Set(["npx", "bunx", "pipx"]);
const PKG_DIR_READ_VERBS = new Set(["ls", "list", "view", "info", "outdated", "why", "--version"]);
const G_COREUTILS = new Set(["gsed", "gawk", "gcp", "gmv", "grm", "gln", "gtee", "gchmod", "gfind"]);

/** 外发/远端类词头(S3 面:出圈且不可控;curl/wget 单独细分) */
const REMOTE_HEADS = new Set(["ssh", "scp", "rsync", "nc", "ncat", "telnet", "ftp", "sftp", "mail", "sendmail"]);

/** 部署/花钱类词头(S3) */
const DEPLOY_HEADS = new Set(["vercel", "netlify", "fly", "flyctl", "kubectl", "helm", "terraform", "pulumi", "aws", "gcloud", "az", "docker", "railway", "wrangler"]);

const DESTRUCTIVE_HEADS = new Set([
  "dd", "mkfs", "shutdown", "reboot", "halt", "poweroff", "fdisk", "diskutil",
  "systemctl", "launchctl", "crontab", "passwd", "chpass", "visudo"
]);

const WRAPPER_HEADS = new Set([
  "env", "command", "exec", "nohup", "time", "nice", "ionice", "stdbuf", "timeout"
]);

const SHELL_HEADS = new Set(["sh", "bash", "zsh", "dash", "ksh", "fish"]);

const FIND_MUTATE = new Set(["-delete", "-exec", "-execdir", "-ok", "-okdir"]);

const AGENT_CLI_HEADS = new Set(["claude", "cursor-agent", "codex", "grok", "gemini", "qwen", "copilot"]);
const AGENT_BYPASS_TOKEN = /--dangerously-skip-permissions|bypassPermissions|--permission-mode|--yolo/;

const INTERPRETER_HEAD = /^(?:(?:ba|z|k|c|da|fi)?sh|python[0-9.]*|node|perl|ruby|php)$/;

const SENSITIVE_PATH_RE = /\.env\b|credential|secret|\.pem\b|\.key\b|id_rsa|id_ed25519|\.npmrc|\.netrc|keychain|token/i;

type PathClass = "inside" | "outside" | "unknown";

function unquote(arg: string): string {
  if (arg.length >= 2) {
    const a = arg[0];
    const b = arg[arg.length - 1];
    if ((a === '"' && b === '"') || (a === "'" && b === "'")) return arg.slice(1, -1);
  }
  return arg;
}

/** 引号感知切分,使 `sh -c 'rm -rf /'` 的脚本参数保持一段 */
function tokenize(s: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quote: '"' | "'" | null = null;
  for (const c of s) {
    if (quote) {
      cur += c;
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      cur += c;
      continue;
    }
    if (/\s/.test(c)) {
      if (cur) {
        out.push(cur);
        cur = "";
      }
      continue;
    }
    cur += c;
  }
  if (cur) out.push(cur);
  return out;
}

/** 词法圈内/圈外/不可判。盘符在 POSIX 上视为圈外。家目录前缀在剥尾括号之前判定,避免 `${HOME}` 的 `}` 被吃掉 */
function pathClass(arg: string): PathClass {
  const strippedLead = unquote(arg.trim()).replace(/^["'`]+/, "");
  if (strippedLead.startsWith("~") || strippedLead.startsWith("$HOME") || strippedLead.startsWith("${HOME}")) return "outside";
  const raw = strippedLead.replace(/["'`})]+$/, "");
  if (!raw) return "inside";
  if (/^[A-Za-z]:[\\/]/.test(raw)) return "outside";
  if (raw.startsWith("/") || raw.includes("..")) return "outside";
  if (/\$|`/.test(raw)) return "unknown";
  return "inside";
}

function floorKind(d: EffectDescriptor, min: EffectDescriptor["kind"], target?: string): EffectDescriptor {
  if (RISK_ORDER.indexOf(d.kind) >= RISK_ORDER.indexOf(min)) return d;
  const t = target ?? d.target;
  if (t === undefined) {
    const { target: _drop, ...rest } = d;
    return { ...rest, kind: min };
  }
  return { ...d, kind: min, target: t };
}

function floorS2(d: EffectDescriptor, target?: string): EffectDescriptor {
  return floorKind(d, "install_dependency", target);
}

function basenameHead(token: string): string {
  return unquote(token).replace(/^.*\//, "");
}

function nonFlagArgs(parts: string[]): string[] {
  return parts.slice(1).filter((p) => p !== "--" && !p.startsWith("-"));
}

function anyOutside(targets: string[]): PathClass {
  let unknown = false;
  for (const t of targets) {
    const c = pathClass(t);
    if (c === "outside") return "outside";
    if (c === "unknown") unknown = true;
  }
  return unknown ? "unknown" : "inside";
}

function writeOutsideOf(targets: string[]): EffectDescriptor | undefined {
  const cls = anyOutside(targets);
  if (cls === "outside") return { kind: "delete_data", target: "write-outside-worktree" };
  if (cls === "unknown") return { kind: "install_dependency", target: "path-unknown" };
  return undefined;
}

/** 不落盘的重定向 sink(owner 2026-08-19 批准 O-1)。只用于重定向目标,不改 pathClass(argv 的 `cp x /dev/null` 仍圈外)。 */
const DEV_SINK_RE = /^\/dev\/(null|stdout|stderr|tty|fd\/[0-9]+)$/;

function isDevSink(arg: string): boolean {
  const raw = unquote(arg.trim()).replace(/^["'`]+/, "").replace(/["'`})]+$/, "");
  return DEV_SINK_RE.test(raw);
}

function normalizeRedirects(s: string): string {
  return s.replace(/>\|/g, ">").replace(/&>>/g, ">>").replace(/&>/g, ">");
}

function stripDevSinkRedirects(s: string): string {
  return normalizeRedirects(s).replace(/(?:\d+)?>{1,2}\s*([^\s;]+)/g, (full, target: string) => {
    if (target.startsWith("&")) return full;
    return isDevSink(target) ? " " : full;
  });
}

function classifyRedirects(s: string): EffectDescriptor | undefined {
  // 先剥 noclobber `>|` 与 `&>` / `&>>`,让目标对 `>` 可见(评审 2 A11)
  const targets: string[] = [];
  const re = /(?:^|[^>|])>{1,2}\s*([^\s;]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(normalizeRedirects(s)))) {
    if (m[1] && !m[1].startsWith("&") && !isDevSink(m[1])) targets.push(m[1]);
  }
  return writeOutsideOf(targets);
}

function peelLeadingFlags(parts: string[], i: number, takesArg: Set<string>): number {
  while (i < parts.length) {
    const p = parts[i]!;
    if (p === "--") return i + 1;
    if (!p.startsWith("-") || p === "-") break;
    const key = p.includes("=") ? p.slice(0, p.indexOf("=")) : p;
    if (takesArg.has(key) && !p.includes("=")) i += 2;
    else i += 1;
  }
  return i;
}

function peelWrapper(head: string, parts: string[]): string[] {
  if (head === "env") {
    let i = 1;
    while (i < parts.length) {
      const p = parts[i]!;
      if (p === "--") return parts.slice(i + 1);
      if (p === "-i" || p === "-" || p === "--ignore-environment") {
        i += 1;
        continue;
      }
      if (p === "-u" || p === "--unset" || p === "-C" || p === "--chdir") {
        i += 2;
        continue;
      }
      if (p.startsWith("-u") && p.length > 2) {
        i += 1;
        continue;
      }
      if (p.startsWith("--unset=") || p.startsWith("--chdir=")) {
        i += 1;
        continue;
      }
      if (!p.startsWith("-") && p.includes("=")) {
        i += 1;
        continue;
      }
      break;
    }
    return parts.slice(i);
  }
  if (head === "timeout") {
    const afterFlags = peelLeadingFlags(parts, 1, new Set(["-k", "--kill-after", "-s", "--signal"]));
    const afterDuration = afterFlags < parts.length && !parts[afterFlags]!.startsWith("-") ? afterFlags + 1 : afterFlags;
    return parts.slice(afterDuration);
  }
  if (head === "xargs") {
    return parts.slice(peelLeadingFlags(parts, 1, new Set(["-n", "-P", "-I", "-i", "-d", "-L", "-s", "-E", "-a", "--max-args", "--max-procs"])));
  }
  const argFlags: Record<string, Set<string>> = {
    command: new Set(),
    exec: new Set(["-a"]),
    nohup: new Set(),
    time: new Set(),
    nice: new Set(["-n", "--adjustment"]),
    ionice: new Set(["-c", "-n", "-p"]),
    stdbuf: new Set(["-i", "-o", "-e"])
  };
  return parts.slice(peelLeadingFlags(parts, 1, argFlags[head] ?? new Set()));
}

function skipSudoFlags(parts: string[]): string[] {
  let i = 1;
  while (i < parts.length) {
    const p = parts[i]!;
    if (p === "--") return parts.slice(i + 1);
    if (p === "-u" || p === "--user" || p === "-g" || p === "--group") {
      i += 2;
      continue;
    }
    if (p.startsWith("--user=") || p.startsWith("--group=")) {
      i += 1;
      continue;
    }
    if (p.startsWith("-u") && p.length > 2) {
      i += 1;
      continue;
    }
    if (p === "-E" || p === "-H" || p === "-i" || p === "-n" || p === "-S") {
      i += 1;
      continue;
    }
    break;
  }
  return parts.slice(i);
}

function isGitExecConfig(spec: string): boolean {
  const peeled = unquote(spec.trim());
  const eq = peeled.indexOf("=");
  const key = unquote(eq >= 0 ? peeled.slice(0, eq) : peeled).toLowerCase();
  const val = unquote(eq >= 0 ? peeled.slice(eq + 1) : "");
  if (val.includes("!")) return true;
  const exact = new Set([
    "core.pager", "core.fsmonitor", "core.hookspath", "core.sshcommand", "core.editor",
    "core.askpass", "sequence.editor", "credential.helper", "diff.external", "http.proxy"
  ]);
  if (exact.has(key)) return true;
  if (key.startsWith("difftool.") || key.startsWith("mergetool.") || key.startsWith("alias.") || key.startsWith("protocol.")) return true;
  if (/^merge\..+\.driver$/.test(key)) return true;
  if (/^filter\..+\.(clean|smudge|process)$/.test(key)) return true;
  if (/^url\..+\.insteadof$/.test(key)) return true;
  if (/^remote\..+\.vcs$/.test(key)) return true;
  return false;
}

function parseGit(parts: string[]): { sub: string; rest: string[]; cOutside: boolean; sawGlobal: boolean; cExec: boolean; execPathOutside: boolean } {
  let i = 1;
  let cOutside = false;
  let sawGlobal = false;
  let cExec = false;
  let execPathOutside = false;
  while (i < parts.length) {
    const p = parts[i]!;
    if (!p.startsWith("-")) break;
    sawGlobal = true;
    if (p === "-C") {
      const dest = parts[i + 1] ?? "";
      if (pathClass(dest) !== "inside") cOutside = true;
      i += 2;
      continue;
    }
    if (p === "--git-dir" || p === "--work-tree") {
      const dest = parts[i + 1] ?? "";
      if (pathClass(dest) !== "inside") cOutside = true;
      i += 2;
      continue;
    }
    if (p === "-c") {
      const spec = parts[i + 1] ?? "";
      if (isGitExecConfig(spec)) cExec = true;
      i += 2;
      continue;
    }
    if (p.startsWith("-c") && p.includes("=")) {
      if (isGitExecConfig(p.slice(2))) cExec = true;
      i += 1;
      continue;
    }
    if (p.startsWith("--git-dir=") || p.startsWith("--work-tree=")) {
      const dest = p.slice(p.indexOf("=") + 1);
      if (pathClass(dest) !== "inside") cOutside = true;
      i += 1;
      continue;
    }
    if (p === "--exec-path") {
      if (parts[i + 1] && !parts[i + 1]!.startsWith("-")) {
        if (pathClass(parts[i + 1]!) === "outside") execPathOutside = true;
        i += 2;
      } else i += 1;
      continue;
    }
    if (p.startsWith("--exec-path=")) {
      if (pathClass(p.slice("--exec-path=".length)) === "outside") execPathOutside = true;
      i += 1;
      continue;
    }
    if (p === "--namespace" || p === "--config-env") {
      if (parts[i + 1] && !parts[i + 1]!.startsWith("-")) i += 2;
      else i += 1;
      continue;
    }
    if (p.startsWith("--namespace=") || p.startsWith("--config-env=")) {
      i += 1;
      continue;
    }
    i += 1;
  }
  return { sub: parts[i] ?? "", rest: parts.slice(i + 1), cOutside, sawGlobal, cExec, execPathOutside };
}

function normalizeRef(ref: string): string {
  return ref.replace(/^\+/, "").replace(/^refs\/heads\//, "");
}

function stripPushValueFlags(rest: string[]): string[] {
  const valued = new Set(["-o", "--push-option", "--receive-pack", "--exec", "--repo"]);
  const out: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    const p = rest[i]!;
    const key = p.includes("=") ? p.slice(0, p.indexOf("=")) : p;
    if (valued.has(key) && !p.includes("=")) {
      i += 1;
      continue;
    }
    if (valued.has(key)) continue;
    out.push(p);
  }
  return out;
}

function classifyGitPush(rest: string[]): EffectDescriptor {
  const stripped = stripPushValueFlags(rest);
  if (stripped.includes("--mirror") || stripped.includes("--prune")) {
    return { kind: "delete_data", target: "push-mirror-or-prune" };
  }
  const deleteRemote = stripped.includes("--delete") || stripped.includes("-d");
  let force = stripped.includes("--force") || stripped.includes("-f")
    || stripped.some((p) => p === "--force-with-lease" || p.startsWith("--force-with-lease="));
  const pushArgs = stripped.filter((p) => !p.startsWith("-"));
  const refspec = pushArgs[1];
  if (refspec?.startsWith("+")) force = true;
  if (refspec?.startsWith(":")) {
    const name = normalizeRef(refspec.slice(1)) || "unknown";
    return { kind: "delete_data", target: `delete-remote-branch:${name}` };
  }
  if (deleteRemote) {
    const name = normalizeRef(pushArgs[1] ?? pushArgs[0] ?? "unknown");
    return { kind: "delete_data", target: `delete-remote-branch:${name}` };
  }
  const remoteSide = refspec?.includes(":") ? refspec.split(":")[1] : refspec;
  const branch = remoteSide ? normalizeRef(remoteSide) : undefined;
  if (force) return { kind: "delete_data", target: `force-push:${branch ?? "unknown"}` };
  return { kind: "push_branch", ...(branch ? { target: branch } : {}) };
}

/**
 * GAP-02 2.2(AS-05 剩余 grammar):绕过 hooks 的 git 形态。`commit`/`merge` 的 `--no-verify` 与 `commit` 的 `-n`
 * (含短选项簇 `-an`/`-nm msg`)⇒ 本地 hooks 绕过;`push --no-verify` ⇒ pre-push 绕过。
 * 不得误伤:`merge -n` = --no-stat、`cherry-pick -n` = --no-commit、`push -n` = --dry-run、`am` 无 -n;
 * 取值参数(`-m msg`/`-F file`/`--author=`…)后的 token 是值不是旗标;`--` 之后是 pathspec。
 */
function gitHooksBypass(sub: string, rest: string[]): "push" | "local" | undefined {
  if (sub !== "commit" && sub !== "merge" && sub !== "push") return undefined;
  const valued = sub === "commit"
    ? new Set(["-m", "--message", "-F", "--file", "-C", "--reuse-message", "-c", "--reedit-message", "--author", "--date",
      "-t", "--template", "--fixup", "--squash", "--cleanup", "--trailer", "--pathspec-from-file", "-S", "--gpg-sign"])
    : sub === "merge"
      ? new Set(["-m", "-F", "--file", "-s", "--strategy", "-X", "--strategy-option", "-S", "--gpg-sign", "--into-name"])
      : new Set(["-o", "--push-option", "--receive-pack", "--exec", "--repo"]);
  let bypass = false;
  for (let i = 0; i < rest.length; i++) {
    const p = rest[i]!;
    if (p === "--") break;
    if (!p.startsWith("-")) continue;
    if (p === "--no-verify") {
      bypass = true;
      continue;
    }
    if (p.startsWith("--")) {
      const key = p.includes("=") ? p.slice(0, p.indexOf("=")) : p;
      if (valued.has(key) && !p.includes("=")) i += 1;
      continue;
    }
    // 短选项簇:只有 commit 的 `n` 是 --no-verify;遇到取值短选项后簇内剩余字符是值,簇尾则吃下一个 token
    const cluster = p.slice(1);
    for (let j = 0; j < cluster.length; j++) {
      const ch = cluster[j]!;
      if (valued.has(`-${ch}`)) {
        if (j === cluster.length - 1) i += 1;
        break;
      }
      if (sub === "commit" && ch === "n") bypass = true;
    }
  }
  if (!bypass) return undefined;
  return sub === "push" ? "push" : "local";
}

function gitConfigFileOutside(rest: string[]): boolean {
  for (let i = 0; i < rest.length; i++) {
    const p = rest[i]!;
    if (p === "--file" || p === "-f" || p === "--blob") {
      return pathClass(rest[i + 1] ?? "") !== "inside";
    }
    if (p.startsWith("--file=") || p.startsWith("--blob=")) {
      return pathClass(p.slice(p.indexOf("=") + 1)) !== "inside";
    }
  }
  return false;
}

function classifyGitConfig(rest: string[]): EffectDescriptor {
  if (rest.includes("--global") || rest.includes("--system") || gitConfigFileOutside(rest)) {
    return { kind: "delete_data", target: "git-config-global" };
  }
  const query = new Set(["--get", "--get-all", "--get-regexp", "--list", "-l", "--name-only"]);
  if (rest.some((p) => query.has(p))) return { kind: "read" };
  const positional = rest.filter((p) => !p.startsWith("-"));
  if (positional.length >= 2) return { kind: "write_worktree" };
  return { kind: "read" };
}

function classifyGitBranch(rest: string[]): EffectDescriptor {
  const writeFlags = new Set(["-d", "-D", "-m", "-M", "-c", "-C", "--delete", "--move", "--copy"]);
  if (rest.some((p) => writeFlags.has(p))) return { kind: "write_worktree" };
  if (rest.some((p) => !p.startsWith("-"))) return { kind: "write_worktree" };
  return { kind: "read" };
}

function classifyGitRemote(rest: string[]): EffectDescriptor {
  const verb = rest.find((p) => !p.startsWith("-")) ?? "";
  if (verb === "add" || verb === "set-url" || verb === "remove" || verb === "rm" || verb === "rename") {
    return { kind: "install_dependency", target: `git-remote-${verb}` };
  }
  return { kind: "read" };
}

function applyCOutside(d: EffectDescriptor, cOutside: boolean): EffectDescriptor {
  if (!cOutside) return d;
  if (d.kind === "read") return floorS2(d, "git-C-outside");
  if (d.kind === "write_worktree") return { ...d, kind: "delete_data", target: "write-outside-worktree" };
  return d;
}

function applyOutsideCwd(d: EffectDescriptor, cls: PathClass | undefined): EffectDescriptor {
  if (cls === "outside") {
    if (d.kind === "read") return floorS2(d, "cwd-outside");
    if (d.kind === "write_worktree") return { ...d, kind: "delete_data", target: "write-outside-worktree" };
    return d;
  }
  if (cls === "unknown") return floorS2(d, "cwd-unknown");
  return d;
}

function applyPkgDirOutside(d: EffectDescriptor, verb: string, cls: PathClass | undefined): EffectDescriptor {
  if (cls === "outside") {
    if (PKG_DIR_READ_VERBS.has(verb)) return floorS2(d, "pkg-dir-outside");
    return { kind: "delete_data", target: "write-outside-worktree" };
  }
  if (cls === "unknown") return floorS2(d, "pkg-dir-unknown");
  return d;
}

/**
 * `<pm> exec <bin …>`:内层命令先按全表分类(rm -rf / 等 S3 面不降级),再取"至少 S2"地板。
 * SD-3:原按 bin 名(vitest/vite/eslint…)放回 S1 的工具名特权已删——这些 bin 都加载 agent 可写的
 * 配置文件/插件(`vitest --config ./x.ts` 在配置加载期就执行任意代码),词面上无法与安全用法区分。
 */
function classifyExecInner(innerCmd: string): EffectDescriptor {
  const inner = commandToEffect(innerCmd);
  if (RISK_ORDER.indexOf(inner.kind) >= RISK_ORDER.indexOf("install_dependency")) return inner;
  return floorS2(inner, "pkg-exec-bin");
}

function pkgCallScript(rest: string[]): string | undefined {
  for (let i = 0; i < rest.length; i++) {
    const p = rest[i]!;
    if (p === "-c" || p === "--call") return unquote(rest[i + 1] ?? "");
    if (p.startsWith("--call=")) return unquote(p.slice("--call=".length));
  }
  return undefined;
}

function peelExecRemainder(rest: string[]): string[] {
  let i = 1;
  const valued = new Set(["--package", "-p", "--prefix"]);
  while (i < rest.length) {
    const p = rest[i]!;
    if (p === "--") return rest.slice(i + 1);
    if (p === "-c" || p === "--call" || p.startsWith("--call=")) break;
    if (p.startsWith("-") && p !== "-") {
      const key = p.includes("=") ? p.slice(0, p.indexOf("=")) : p;
      if (valued.has(key) && !p.includes("=")) {
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }
    break;
  }
  return rest.slice(i);
}

function classifyPkgExecCall(rest: string[]): EffectDescriptor {
  const script = pkgCallScript(rest);
  if (script !== undefined) return floorS2(commandToEffect(script), "pkg-exec-call");
  const remainder = peelExecRemainder(rest);
  if (remainder.length === 0) return { kind: "install_dependency", target: "pkg-exec" };
  return classifyExecInner(remainder.join(" "));
}

function envChdirClass(parts: string[]): PathClass | undefined {
  for (let i = 1; i < parts.length; i++) {
    const p = parts[i]!;
    if (p === "-C" || p === "--chdir") return pathClass(parts[i + 1] ?? "");
    if (p.startsWith("--chdir=")) return pathClass(p.slice("--chdir=".length));
  }
  return undefined;
}

function positionals(args: string[]): string[] {
  return args.filter((p) => p !== "--" && !p.startsWith("-"));
}

function gitPathTargets(sub: string, rest: string[]): string[] {
  if (sub === "init") return positionals(rest);
  if (sub === "worktree") {
    const verb = rest.find((p) => !p.startsWith("-")) ?? "";
    if (verb === "add" || verb === "remove" || verb === "move" || verb === "repair") {
      const idx = rest.findIndex((p) => p === verb);
      return rest.slice(idx + 1).filter((p) => p !== "--" && !p.startsWith("-"));
    }
    return [];
  }
  if (sub === "clone") {
    const pos = positionals(rest);
    return pos[1] ? [pos[1]] : [];
  }
  if (sub === "archive") {
    const out: string[] = [];
    for (let i = 0; i < rest.length; i++) {
      const p = rest[i]!;
      if (p === "-o" || p === "--output") out.push(rest[i + 1] ?? "");
      else if (p.startsWith("--output=")) out.push(p.slice("--output=".length));
    }
    return out;
  }
  if (sub === "bundle") {
    const idx = rest.findIndex((p) => p === "create");
    if (idx < 0) return [];
    const file = rest.slice(idx + 1).find((p) => p !== "--" && !p.startsWith("-"));
    return file ? [file] : [];
  }
  if (sub === "format-patch") {
    const out: string[] = [];
    for (let i = 0; i < rest.length; i++) {
      const p = rest[i]!;
      if (p === "-o" || p === "--output-directory") out.push(rest[i + 1] ?? "");
      else if (p.startsWith("--output-directory=")) out.push(p.slice(p.indexOf("=") + 1));
    }
    return out;
  }
  if (sub === "submodule") {
    const verb = rest.find((p) => !p.startsWith("-")) ?? "";
    if (verb !== "add") return [];
    const pos = rest.filter((p) => p !== "--" && !p.startsWith("-"));
    return pos[2] ? [pos[2]] : [];
  }
  return [];
}

function classifyGitPathSub(sub: string, rest: string[]): EffectDescriptor | undefined {
  const targets = gitPathTargets(sub, rest);
  if (targets.length === 0) return undefined;
  const cls = anyOutside(targets);
  if (cls === "outside") return { kind: "delete_data", target: "write-outside-worktree" };
  if (cls === "unknown") return { kind: "install_dependency", target: "path-unknown" };
  return undefined;
}

const SED_S_E_RE = /s(.)(?:(?!\1).)*\1(?:(?!\1).)*\1[gIpmM0-9]*e/;
const SED_E_CMD_RE = /(^|[;{\s]|[0-9])e(\s|$)/;

function isSedInplace(p: string): boolean {
  return p === "--in-place" || p.startsWith("--in-place=") || p === "-i" || (p.startsWith("-i") && !p.startsWith("--"));
}

function classifySed(parts: string[]): EffectDescriptor {
  const inplace = parts.some(isSedInplace);
  let hasDashF = false;
  let script = "";
  let i = 1;
  while (i < parts.length) {
    const p = parts[i]!;
    if (p === "--") {
      i += 1;
      break;
    }
    if (p === "-e" || p === "--expression") {
      script += unquote(parts[i + 1] ?? "");
      i += 2;
      continue;
    }
    if (p.startsWith("--expression=")) {
      script += unquote(p.slice("--expression=".length));
      i += 1;
      continue;
    }
    if (p === "-f" || p === "--file") {
      hasDashF = true;
      i += 2;
      continue;
    }
    if (p.startsWith("--file=")) {
      hasDashF = true;
      i += 1;
      continue;
    }
    if (p.startsWith("-") && p !== "-") {
      i += 1;
      continue;
    }
    break;
  }
  if (!script && i < parts.length) script = unquote(parts[i] ?? "");
  let d: EffectDescriptor = { kind: "write_worktree" };
  if (hasDashF || SED_S_E_RE.test(script) || SED_E_CMD_RE.test(script)) {
    d = floorS2(d, "sed-exec");
  }
  const w = /[wW]\s+(\S+)/.exec(script);
  if (w) {
    const hit = writeOutsideOf([w[1]!]);
    if (hit) d = hit.kind === "delete_data" ? hit : floorS2(d, "sed-exec");
    else d = floorS2(d, "sed-exec");
  }
  if (inplace) {
    const hit = writeOutsideOf(nonFlagArgs(parts));
    if (hit?.kind === "delete_data") return hit;
    if (hit) d = floorS2(d, hit.target);
  }
  return d;
}

function classifyAwk(parts: string[]): EffectDescriptor {
  let hasDashF = false;
  let program = "";
  let i = 1;
  while (i < parts.length) {
    const p = parts[i]!;
    if (p === "--") {
      i += 1;
      break;
    }
    if (p === "-f" || p === "--file") {
      hasDashF = true;
      i += 2;
      continue;
    }
    if (p.startsWith("-f") && p.length > 2 && !p.startsWith("--")) {
      hasDashF = true;
      i += 1;
      continue;
    }
    if (p === "-e" || p === "--source") {
      program += unquote(parts[i + 1] ?? "");
      i += 2;
      continue;
    }
    if (p === "-F" || p === "-v" || p === "-W") {
      i += 2;
      continue;
    }
    if ((p.startsWith("-v") || p.startsWith("-F") || p.startsWith("-W")) && p.length > 2) {
      i += 1;
      continue;
    }
    if (p.startsWith("-") && p !== "-") {
      i += 1;
      continue;
    }
    break;
  }
  if (!program && i < parts.length) program = unquote(parts[i] ?? "");
  if (hasDashF) return floorS2({ kind: "write_worktree" }, "awk-exec");
  if (/system\(|getline|[|]/.test(program) || />>?/.test(program)) {
    const writes = [...program.matchAll(/>>?\s*([^\s;]+)/g)].map((m) => m[1]!);
    const hit = writeOutsideOf(writes);
    if (hit?.kind === "delete_data") return hit;
    return { kind: "install_dependency", target: "awk-exec" };
  }
  return { kind: "write_worktree" };
}

function hasRemoteSubst(s: string): boolean {
  return /(?:\$\(|<\()\s*(?:curl|wget|nc|ncat|fetch)\b/i.test(s)
    || /(?:\$\(|<\()[^)\n]*\bhttps?:/i.test(s);
}

function isRemoteContentOuter(head: string): boolean {
  return SHELL_HEADS.has(head) || INTERPRETER_HEAD.test(head) || head === "eval" || head === "source" || head === ".";
}

function isGoRemoteRunTarget(target: string): boolean {
  if (!target) return false;
  if (target === "." || target.startsWith("./") || target.startsWith("../")) return false;
  if (target.endsWith(".go")) return false;
  return target.includes("/") || target.includes(".");
}

function peelPkgGlobals(head: string, parts: string[]): { rest: string[]; dirClass?: PathClass } {
  const valued = new Set<string>();
  const bools = new Set<string>();
  if (head === "pnpm") {
    for (const k of ["--filter", "-F", "--prefix", "-C", "--dir", "--registry", "--reporter", "--loglevel"]) valued.add(k);
    for (const k of ["-r", "--recursive", "-w", "--workspace-root", "--silent", "--stream", "--parallel", "--if-present", "--no-frozen-lockfile", "--workspaces"]) bools.add(k);
  } else if (head === "npm") {
    for (const k of ["--workspace", "-w", "--prefix", "-C", "--dir", "--registry", "--loglevel", "--reporter"]) valued.add(k);
    for (const k of ["--workspaces", "-ws", "--silent"]) bools.add(k);
  } else if (head === "yarn") {
    for (const k of ["--cwd", "-C", "--dir", "--prefix", "--registry"]) valued.add(k);
    for (const k of ["-s", "--silent", "-W"]) bools.add(k);
  } else {
    return { rest: parts.slice(1) };
  }
  let i = 1;
  let dirClass: PathClass | undefined;
  const dirKeys = new Set(["-C", "--dir", "--prefix", "--cwd"]);
  while (i < parts.length) {
    const p = parts[i]!;
    if (p === "--") {
      i += 1;
      break;
    }
    if (!p.startsWith("-") || p === "-") break;
    const key = p.includes("=") ? p.slice(0, p.indexOf("=")) : p;
    if (dirKeys.has(key)) {
      const dest = p.includes("=") ? p.slice(p.indexOf("=") + 1) : (parts[i + 1] ?? "");
      const cls = pathClass(dest);
      if (cls === "outside") dirClass = "outside";
      else if (cls === "unknown" && dirClass !== "outside") dirClass = "unknown";
    }
    if (valued.has(key) && !p.includes("=")) {
      i += 2;
      continue;
    }
    i += 1;
  }
  let rest = parts.slice(i);
  if (head === "yarn" && rest[0] === "workspace" && rest.length >= 3) rest = rest.slice(2);
  return dirClass === undefined ? { rest } : { rest, dirClass };
}

function classifyPkg(head: string, parts: string[]): EffectDescriptor {
  if (head === "uv" || head === "go" || head === "pip" || head === "pip3" || head === "cargo" || head === "brew" || head === "gem" || head === "poetry") {
    const verb = parts[1] ?? "";
    if (head === "uv" && verb === "run") return { kind: "install_dependency", target: "uv-run" };
    if (head === "go" && verb === "run") {
      const target = parts.slice(2).find((p) => !p.startsWith("-")) ?? "";
      if (isGoRemoteRunTarget(target)) return { kind: "install_dependency", target: target.slice(0, 60) };
      // SD-3:本地 go run 与 node 同档——执行的是 worktree 内任意代码,不因语言名豁免
      return { kind: "install_dependency", target: "go-run" };
    }
    if (PKG_S3.has(verb)) return { kind: "send_external", target: "pkg-publish" };
    if (PKG_S2.has(verb)) {
      const pkgs = parts.slice(2).filter((p) => !p.startsWith("-"));
      return { kind: "install_dependency", target: pkgs.join(",") || "(lockfile)" };
    }
    if (PKG_SCRIPT_EXEC.has(verb)) return { kind: "install_dependency", target: `pkg-script:${verb}` };
    if (PKG_QUERY_S1.has(verb)) return { kind: "write_worktree" };
    return { kind: "install_dependency", target: `${head} ${verb}`.trim().slice(0, 60) };
  }
  const { rest, dirClass } = peelPkgGlobals(head, parts);
  const verb = rest[0] ?? "";
  let d: EffectDescriptor;
  if (verb === "exec") {
    d = classifyPkgExecCall(rest);
  } else if (PKG_S3.has(verb)) {
    d = { kind: "send_external", target: "pkg-publish" };
  } else if (PKG_S2.has(verb)) {
    const pkgs = rest.slice(1).filter((p) => !p.startsWith("-"));
    d = { kind: "install_dependency", target: pkgs.join(",") || "(lockfile)" };
  } else if (PKG_SCRIPT_EXEC.has(verb)) {
    d = { kind: "install_dependency", target: `pkg-script:${verb}` };
  } else if (PKG_QUERY_S1.has(verb)) {
    d = { kind: "write_worktree" };
  } else {
    d = { kind: "install_dependency", target: `${head} ${verb}`.trim().slice(0, 60) };
  }
  return applyPkgDirOutside(d, verb, dirClass);
}

function copyMoveDest(parts: string[]): string | undefined {
  for (let i = 1; i < parts.length; i++) {
    const p = parts[i]!;
    if (p === "-t" || p === "--target-directory") return parts[i + 1];
    if (p.startsWith("--target-directory=")) return p.slice("--target-directory=".length);
  }
  const args = nonFlagArgs(parts);
  return args.length ? args[args.length - 1] : undefined;
}

function httpOutputTarget(parts: string[]): string | undefined {
  for (let i = 1; i < parts.length; i++) {
    const p = parts[i]!;
    if (p === "-o" || p === "-O" || p === "--output" || p === "--output-document") return parts[i + 1];
    if (p.startsWith("--output=") || p.startsWith("--output-document=")) return p.slice(p.indexOf("=") + 1);
  }
  return undefined;
}

function findDashCArg(parts: string[]): string | undefined {
  for (let i = 1; i < parts.length; i++) {
    if (/^-[a-zA-Z]*c[a-zA-Z]*$/.test(parts[i]!)) return parts[i + 1];
  }
  return undefined;
}

function isInlineCodeFlag(p: string): boolean {
  return p === "-c" || p === "-e" || p === "--eval" || /^-[a-zA-Z]*c[a-zA-Z]*$/.test(p);
}

function rhsIsInterpreter(rhs: string): boolean {
  let tokens = tokenize(rhs.trim());
  for (let n = 0; n < 8 && tokens.length > 0; n++) {
    const headRaw = basenameHead(tokens[0] ?? "").replace(/^\\+/, "");
    const head = headRaw.toLowerCase();
    if (head === "sudo" || head === "doas") {
      const next = skipSudoFlags(tokens);
      if (next.length === tokens.length) break;
      tokens = next;
      continue;
    }
    if (WRAPPER_HEADS.has(head) || head === "xargs") {
      const next = peelWrapper(head, tokens);
      if (next.length === tokens.length) break;
      tokens = next;
      continue;
    }
    if (!INTERPRETER_HEAD.test(head)) return false;
    // 壳族:即使带脚本文件也算喂 shell(B-4)
    if (SHELL_HEADS.has(head) || /(?:ba|z|k|c|da|fi)?sh$/.test(head)) return true;
    const rest = tokens.slice(1);
    if (rest.some(isInlineCodeFlag)) return true;
    const files = rest.filter((p) => p !== "--" && !p.startsWith("-") && p !== "-");
    if (files.length > 0) return false;
    return true;
  }
  return false;
}

function isPipeToShell(command: string): boolean {
  const chunks = command.split(/(?<!\|)\|(?!\|)/);
  if (chunks.length < 2) return false;
  return chunks.slice(1).some((rhs) => rhsIsInterpreter(rhs));
}

function maxDescriptor(a: EffectDescriptor, b: EffectDescriptor): EffectDescriptor {
  const top = RISK_ORDER.indexOf(a.kind) >= RISK_ORDER.indexOf(b.kind) ? a : b;
  const touches = Boolean(a.touchesSensitiveData || b.touchesSensitiveData);
  return touches && !top.touchesSensitiveData ? { ...top, touchesSensitiveData: true } : top;
}

function classifySegmentGivenHead(s: string, parts: string[], head: string, touches: boolean): EffectDescriptor {
  const base = (d: EffectDescriptor): EffectDescriptor =>
    (touches && !d.touchesSensitiveData ? { ...d, touchesSensitiveData: true } : d);

  const redirected = classifyRedirects(s);
  if (redirected) return base(redirected);

  if (head === "") return base({ kind: "install_dependency", target: s.slice(0, 60) });

  if (head === "env") {
    const chdir = envChdirClass(parts);
    const rest = peelWrapper(head, parts);
    if (rest.length === 0) return base(applyOutsideCwd({ kind: "install_dependency", target: s.slice(0, 60) }, chdir));
    return base(applyOutsideCwd(classifySegment(rest.join(" ")), chdir));
  }

  if (WRAPPER_HEADS.has(head) || head === "xargs") {
    const rest = peelWrapper(head, parts);
    if (rest.length === 0) return base({ kind: "install_dependency", target: s.slice(0, 60) });
    const inner = classifySegment(rest.join(" "));
    return base(head === "xargs" ? floorS2(inner) : inner);
  }

  if (DESTRUCTIVE_HEADS.has(head) || [...DESTRUCTIVE_HEADS].some((d) => head.startsWith(d + "."))) {
    return base({ kind: "delete_data", target: s.slice(0, 60) });
  }

  if (head === "sudo" || head === "doas") {
    const rest = skipSudoFlags(parts);
    if (rest.length === 0) return base({ kind: "install_dependency", target: s.slice(0, 60) });
    const inner = classifySegment(rest.join(" "));
    const innerT = touches && !inner.touchesSensitiveData ? { ...inner, touchesSensitiveData: true } : inner;
    return RISK_ORDER.indexOf(innerT.kind) < RISK_ORDER.indexOf("install_dependency")
      ? base({ kind: "install_dependency", target: s.slice(0, 60) })
      : innerT;
  }

  if (AGENT_CLI_HEADS.has(head)) {
    return base({ kind: "send_external", target: "spawn-unsupervised-agent" });
  }
  if (parts.some((p) => AGENT_BYPASS_TOKEN.test(p))) {
    return base({ kind: "send_external", target: "spawn-unsupervised-agent" });
  }

  if (head === "cd" || head === "pushd") {
    const dest = parts.slice(1).find((p) => p === "-" || !p.startsWith("-") || p === "--");
    const destArg = dest === "--" ? undefined : dest;
    if (destArg === undefined || destArg === "") return base({ kind: "delete_data", target: "cd-outside" });
    const raw = unquote(destArg);
    if (raw === "-") return base({ kind: "install_dependency", target: "cd-unknown" });
    if (raw === "~" || raw === "$HOME" || raw === "${HOME}") {
      return base({ kind: "delete_data", target: "cd-outside" });
    }
    const cls = pathClass(raw);
    if (cls === "outside") return base({ kind: "delete_data", target: "cd-outside" });
    if (cls === "unknown") return base({ kind: "install_dependency", target: "cd-unknown" });
    return base({ kind: "write_worktree", target: "cd-inside" });
  }

  if (isRemoteContentOuter(head) && hasRemoteSubst(s)) {
    return base({ kind: "send_external", target: "pipe-to-shell" });
  }

  if (head === "source" || head === ".") {
    const target = nonFlagArgs(parts)[0];
    if (target && pathClass(target) === "outside") return base({ kind: "send_external", target: "source-outside" });
    return base(floorS2({ kind: "write_worktree" }, "source"));
  }

  if (SHELL_HEADS.has(head)) {
    const inner = findDashCArg(parts);
    if (inner !== undefined) {
      return base(floorS2(commandToEffect(unquote(inner))));
    }
    return base({ kind: "install_dependency", target: s.slice(0, 60) });
  }

  if (head === "eval") {
    if (/\$\(|`/.test(s)) return base({ kind: "send_external", target: "eval-subshell" });
    const rest = parts.slice(1).map(unquote).join(" ");
    if (!rest) return base({ kind: "install_dependency", target: "eval" });
    return base(floorS2(commandToEffect(rest)));
  }

  if (head === "find") {
    if (parts.some((p) => FIND_MUTATE.has(p))) return base({ kind: "delete_data", target: s.slice(0, 60) });
    return base({ kind: "read" });
  }

  if (head === "git") {
    const { sub, rest, cOutside, sawGlobal, cExec, execPathOutside } = parseGit(parts);
    const pathHit = classifyGitPathSub(sub, rest);
    let d: EffectDescriptor;
    if (pathHit) d = pathHit;
    else if (sub === "push") d = classifyGitPush(rest);
    else if (sub === "config") d = classifyGitConfig(rest);
    else if (sub === "branch") d = classifyGitBranch(rest);
    else if (sub === "remote") d = classifyGitRemote(rest);
    else if (GIT_READ_SUB.has(sub)) d = { kind: "read" };
    else if (GIT_LOCAL_SUB.has(sub)) d = { kind: "write_worktree" };
    else d = { kind: "install_dependency", target: s.slice(0, 60) };
    d = applyCOutside(d, cOutside);
    if (cExec || execPathOutside) d = floorKind(d, "delete_data", "git-c-exec");
    if (sawGlobal) d = floorS2(d, "git-global");
    // GAP-02 2.2:绕过 hooks 只取较高者;push --no-verify 与 -c core.hooksPath 同档 S3,本地 commit/merge 绕过 floor S2
    const hooksBypass = gitHooksBypass(sub, rest);
    if (hooksBypass === "push") d = floorKind(d, "delete_data", "git-hooks-bypass");
    else if (hooksBypass === "local") d = floorS2(d, "git-hooks-bypass");
    return base(d);
  }

  if (head === "npx" || head === "bunx") {
    const script = pkgCallScript(parts.slice(1));
    if (script !== undefined) return base(floorS2(commandToEffect(script), "npx-call"));
    return base({ kind: "install_dependency", target: head });
  }
  if (PKG_FETCH_HEADS.has(head)) return base({ kind: "install_dependency", target: head });
  if (PKG_MANAGERS.has(head)) return base(classifyPkg(head, parts));

  if (head === "curl" || head === "wget") {
    const out = httpOutputTarget(parts);
    if (out) {
      const dest = writeOutsideOf([out]);
      if (dest) return base(dest);
    }
    const hasWriteMethod = /-X\s*(POST|PUT|DELETE|PATCH)|--data|--form|-d\b|-F\b|-T\b|--upload-file/i.test(s);
    if (isPipeToShell(s)) return base({ kind: "send_external", target: "pipe-to-shell" });
    if (hasWriteMethod) return base({ kind: "send_external", target: "http-write" });
    return base({ kind: "install_dependency", target: "http-fetch" });
  }

  if (REMOTE_HEADS.has(head)) return base({ kind: "send_external", target: head });
  if (DEPLOY_HEADS.has(head)) return base({ kind: "deploy", target: head });

  if (head === "rm") {
    const targets = nonFlagArgs(parts);
    const cls = anyOutside(targets);
    if (cls === "outside") return base({ kind: "delete_data", target: targets.join(" ").slice(0, 60) });
    if (cls === "unknown") return base({ kind: "install_dependency", target: "path-unknown" });
    return base({ kind: "write_worktree" });
  }

  if (head === "tee") {
    const hit = writeOutsideOf(nonFlagArgs(parts));
    if (hit) return base(hit);
    return base({ kind: "write_worktree" });
  }

  if (head === "cp" || head === "mv") {
    const dest = copyMoveDest(parts);
    const hit = dest ? writeOutsideOf([dest]) : undefined;
    if (hit) return base(hit);
    return base({ kind: "write_worktree" });
  }

  // Unix install:圈外写出 S3;圈内保持未知词头 S2(旧档 S2,不放宽到 S1)
  if (head === "install") {
    const dest = copyMoveDest(parts);
    const hit = dest ? writeOutsideOf([dest]) : undefined;
    if (hit) return base(hit);
    return base({ kind: "install_dependency", target: s.slice(0, 60) });
  }

  if (head === "ln") {
    const args = nonFlagArgs(parts);
    const dest = args[args.length - 1];
    const src = args.length >= 2 ? args[0] : undefined;
    if (src && pathClass(src) === "outside") return base({ kind: "delete_data", target: "write-outside-worktree" });
    const hit = dest ? writeOutsideOf([dest]) : undefined;
    if (hit) return base(hit);
    return base({ kind: "write_worktree" });
  }

  if (head === "chmod" || head === "touch" || head === "mkdir") {
    const hit = writeOutsideOf(nonFlagArgs(parts));
    if (hit) return base(hit);
    return base({ kind: "write_worktree" });
  }

  // chown/chgrp:圈外 S3;圈内保持 S2(旧档未知词头 S2,不放宽)
  if (head === "chown" || head === "chgrp") {
    const hit = writeOutsideOf(nonFlagArgs(parts));
    if (hit) return base(hit);
    return base({ kind: "install_dependency", target: s.slice(0, 60) });
  }

  if (head === "sed") {
    const d = classifySed(parts);
    if (anyOutside(nonFlagArgs(parts)) === "outside") return base(floorS2(d, "outside-read"));
    return base(d);
  }
  if (head === "awk") return base(classifyAwk(parts));

  if (READ_ONLY_HEADS.has(head)) {
    if (/[^|>]>{1,2}/.test(stripDevSinkRedirects(s))) return base({ kind: "write_worktree" });
    if (anyOutside(nonFlagArgs(parts)) === "outside") return base(floorS2({ kind: "read" }, "outside-read"));
    return base({ kind: "read" });
  }
  if (WORKTREE_WRITE_HEADS.has(head)) return base({ kind: "write_worktree" });

  return base({ kind: "install_dependency", target: s.slice(0, 60) });
}

/** 单段命令归类(无连接符);exported 供测试逐类断言 */
export function classifySegment(segment: string): EffectDescriptor {
  const s = segment.trim();
  const touches = SENSITIVE_PATH_RE.test(s);
  const parts = tokenize(s);
  const head = basenameHead(parts[0] ?? "");
  let top = classifySegmentGivenHead(s, parts, head, touches);
  if (/[A-Z]/.test(head)) {
    top = maxDescriptor(top, classifySegmentGivenHead(s, parts, head.toLowerCase(), touches));
  }
  const noSlash = head.replace(/^\\+/, "");
  if (noSlash !== head) {
    top = maxDescriptor(top, classifySegmentGivenHead(s, parts, noSlash, touches));
    if (/[A-Z]/.test(noSlash)) {
      top = maxDescriptor(top, classifySegmentGivenHead(s, parts, noSlash.toLowerCase(), touches));
    }
  }
  const lower = noSlash.toLowerCase();
  if (G_COREUTILS.has(lower)) {
    const stripped = noSlash.slice(1);
    top = maxDescriptor(top, classifySegmentGivenHead(s, parts, stripped, touches));
    if (/[A-Z]/.test(stripped)) {
      top = maxDescriptor(top, classifySegmentGivenHead(s, parts, stripped.toLowerCase(), touches));
    }
  }
  return top;
}

const RISK_ORDER: EffectDescriptor["kind"][] = [
  "read", "write_worktree", "run_registered_verify",
  "install_dependency", "push_branch",
  "merge_to_protected", "deploy", "spend_money", "delete_data", "send_external"
];

/**
 * 整条命令归类:先折叠续行与 `>|`,再按 && ; | 与换行拆段,取最高风险段
 * (段序按 RISK_ORDER;touchesSensitiveData 任一段命中即整条携带)。
 */
export function commandToEffect(command: string): EffectDescriptor {
  const folded = command.replace(/\\\r?\n/g, " ").replace(/>\|/g, ">");
  // 管道喂解释器:整条 S3。引号内 `| sh` 仍命中(更安全一侧,评审 1 B2)。
  if (isPipeToShell(folded) || /\|[\s"'`]*(sudo\s+(-\S+\s+)*)?(\S*\/)?((ba|z|k|c|da|fi)?sh)\b/.test(folded)) {
    const touches = SENSITIVE_PATH_RE.test(folded);
    return { kind: "send_external", target: "pipe-to-shell", ...(touches ? { touchesSensitiveData: true } : {}) };
  }
  const hasSubshell = /\$\(|`/.test(folded);
  const segments = folded
    .split(/&&|\|\||;|\||\n/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
  if (hasSubshell) {
    const inner = commandToEffectInner(segments);
    return inner.kind === "read" || inner.kind === "write_worktree"
      ? { kind: "install_dependency", target: folded.slice(0, 60), ...(inner.touchesSensitiveData ? { touchesSensitiveData: true } : {}) }
      : inner;
  }
  return commandToEffectInner(segments);
}

function commandToEffectInner(segments: string[]): EffectDescriptor {
  if (segments.length === 0) return { kind: "install_dependency", target: "(empty)" };
  let top: EffectDescriptor | null = null;
  let touches = false;
  for (const seg of segments) {
    const d = classifySegment(seg);
    if (d.touchesSensitiveData) touches = true;
    if (!top || RISK_ORDER.indexOf(d.kind) > RISK_ORDER.indexOf(top.kind)) top = d;
  }
  const out = top as EffectDescriptor;
  return touches ? { ...out, touchesSensitiveData: true } : out;
}

/** 冻结 verify argv 命中判定(执行器把已冻结的 verify 命令识别为 run_registered_verify,S1) */
export function matchesFrozenVerify(command: string, frozenArgvs: readonly string[][]): boolean {
  const norm = command.trim().replace(/\s+/g, " ");
  return frozenArgvs.some((argv) => argv.join(" ") === norm);
}
