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
// 2026-09-25 review-1 B1:git parse-options 接受无歧义长参数前缀缩写
// (`--unset-a` 实执 --unset-all);解析层先把唯一前缀规范化为完整名,
// 歧义/未识别长参数对写/执行配置判定 fail-closed(不得落到 read/S0/S1)。
// git 子命令前的全局旗标(-C/-c/--git-dir/…)由 git.c 精确匹配、不缩写,无需规范化。
// 2026-09-25 repair-5(rereview-3 B1):tokenize 后逐词做 POSIX 词归一化
// (normalizeShellWord)——`core.hooksPath""`、`g""it` 等拼接/包围形态与正常
// 拼写等价,不再与词面识别分流;含展开($、`)、未闭合引号或敏感位置
// 未加引号通配符的词按不可静态确定 fail-closed。
// 2026-09-25 repair-6(rereview-4 R4-B1):续行折叠按 POSIX 删除(`\<换行>` 引号外
// 与双引号内整体删除、前后直接拼接,repair-5 误用空格替换把 core.hooksPath 拆成两词);
// 命令头/git 全局旗标/子命令/长短旗标/config 键节作用域参数/-c key= 部分等键位,
// 归一化词面必须只含安全字符集 [A-Za-z0-9._/:=@%+,-],否则按不可确定 fail-closed
// (命令头落最严档;git 键位按执行配置)。值位(config 值、-m 消息、--opt=v 的 v)不受约束。
// 2026-09-25 repair-7(rereview-5 R5-B1):续行拼接整体移除——折叠无法区分
// `\\<换行>`(被转义的字面反斜杠 + 真实命令分隔,`echo x \\<LF>git config …`
// 实执第二行)与 `\<换行>`(续行)。owner 选定最保守规则:单引号字符串之外
// 出现 `\n`/`\r` 即不再做续行解析,整条地板判 install_dependency(至少需确认,
// 不落 read/S0/S1)并与分段判定取严;命令中任意位置出现归一化 `git` 词
// 按 git 执行配置最严档(git-c-exec,S3)。单行命令判定不变。
// 2026-09-25 repair-9(rereview-7 B1):repair-7 的单引号状态机被双引号内的
// 字面单引号骗过(`echo "'" && rm -rf \<换行>/x` 判"无单引号外换行",
// 跳过地板与 main 式折叠下限,相对 main 放宽到 S2)。改为:main 式折叠
// 下限对所有命令无条件计算(单行两路同值);多行地板不再做引号判断——
// 命令任意位置出现 `\n`/`\r` 即触发(单引号内换行同从严,有意锁定)。
// 2026-09-26 repair-10(rereview-8 B1):下限复用候选自己的分类路径仍会在
// 动态命令头等路径上替换 HEAD 判定(`"/bin/${PWD:+.}/rm" -rf /x` HEAD 判
// delete_data、候选判 install_dependency)。改为:HEAD(90e0777)分类器
// 原样拷贝成 cmdEffectLegacy.ts,commandToEffect 最终返回前无条件与
// legacyCommandToEffect(command) 取 maxDescriptor——按构造不比 main 松。

import type { EffectDescriptor } from "../policy/engine.js";
import { legacyCommandToEffect } from "./cmdEffectLegacy.js";

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

/**
 * 引号感知切分,使 `sh -c 'rm -rf /'` 的脚本参数保持一段。
 * 引号外 `\` 与下一字符同属一词(转义空格不断词);双引号内 `\"`/`\$` 等
 * 两字符也留在词里(不提前闭合引号),真正的转义/去引号语义由 normalizeShellWord 做。
 */
function tokenize(s: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (quote === "'") {
      cur += c;
      if (c === "'") quote = null;
      continue;
    }
    if (quote === '"') {
      cur += c;
      if (c === '"') quote = null;
      else if (c === "\\" && i + 1 < s.length) cur += s[++i]!;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      cur += c;
      continue;
    }
    if (c === "\\") {
      cur += c;
      if (i + 1 < s.length) cur += s[++i]!;
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

/**
 * POSIX 词归一化(repair-5,rereview-3 B1:shell-word-normalization 按类别收口)。
 * shell 在执行前对每个词做引号去除:单引号内全字面;双引号内仅 `\$` `` \` `` `\"` `\\`
 * `\<换行>` 为转义;引号外 `\` 转义下一字符;相邻加引号/未加引号片段拼接成一词。
 * 分类器识别命令头、git 全局旗标/子命令/长参数、配置键与段名一律用归一化词,
 * 否则 `core.hooksPath""`、`g""it` 等拼接形态与正常拼写分流(rereview-3 生产反例)。
 * 返回:
 * - word:归一化词面(展开符与通配符按字面保留);
 * - dynamic:含不可静态确定成分——引号外或双引号内的 `$`/`` ` ``(参数/命令展开)、
 *   未闭合引号、词尾悬空反斜杠;
 * - glob:引号外出现 `*` `?` `[`(只在命令头、git 子命令、git 配置键/段名/作用域
 *   参数等指定位置按不可确定处理;引号内的同字符是字面量,不计;普通路径参数
 *   的词面保留,路径分类语义不变)。
 */
interface ShellWord {
  word: string;
  dynamic: boolean;
  glob: boolean;
}

function normalizeShellWord(raw: string): ShellWord {
  let word = "";
  let dynamic = false;
  let glob = false;
  let quote: "'" | '"' | null = null;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i]!;
    if (quote === "'") {
      if (c === "'") quote = null;
      else word += c;
      continue;
    }
    if (quote === '"') {
      if (c === '"') {
        quote = null;
        continue;
      }
      if (c === "\\") {
        const nx = raw[i + 1];
        if (nx === "$" || nx === "`" || nx === '"' || nx === "\\" || nx === "\n") {
          if (nx !== "\n") word += nx;
          i += 1;
          continue;
        }
        word += c;
        continue;
      }
      if (c === "$" || c === "`") dynamic = true;
      word += c;
      continue;
    }
    if (c === "'") {
      quote = "'";
      continue;
    }
    if (c === '"') {
      quote = '"';
      continue;
    }
    if (c === "\\") {
      const nx = raw[i + 1];
      if (nx === undefined) {
        dynamic = true;
        word += c;
        continue;
      }
      word += nx;
      i += 1;
      continue;
    }
    if (c === "$" || c === "`") {
      dynamic = true;
      word += c;
      continue;
    }
    if (c === "*" || c === "?" || c === "[") {
      glob = true;
      word += c;
      continue;
    }
    word += c;
  }
  if (quote !== null) dynamic = true;
  return { word, dynamic, glob };
}

/**
 * 原始命令串任意位置是否出现归一化后为 `git` 的词(含被引号/反斜杠拆开后
 * 归一化得到的形态:`g""it`、`\git`、`gi\<换行>t`、`/usr/bin/git` 同判;
 * 大小写不敏感;只按整词/basename 判,`digit`、`git-foo` 不算)。
 */
function containsGitWord(command: string): boolean {
  for (const part of tokenize(command)) {
    const flat = normalizeShellWord(part).word.replace(/[\r\n]/g, "").toLowerCase();
    if (flat === "git" || flat.endsWith("/git")) return true;
  }
  return false;
}

/**
 * 键位安全字符集(repair-6):归一化词面只剩 `[A-Za-z0-9._/:=@%+,-]` 时,shell 对该词
 * 不再做任何展开/变换(词内无 $/反引号/~/{}/通配/空白/引号残余),分类所见的词面
 * 与实参可证同;否则该位置按不可确定 fail-closed。dynamic/glob 的词面必含白名单外
 * 字符,本判定自然覆盖之。
 */
const SAFE_KEY_WORD_RE = /^[A-Za-z0-9._/:=@%+,-]+$/;

/** 命令头/子命令/配置键/节名等键位词面可静态确定(归一化后仅剩安全字符集) */
function keyWordDetermined(n: ShellWord | undefined): boolean {
  return !!n && !n.dynamic && !n.glob && SAFE_KEY_WORD_RE.test(n.word);
}

/** 旗标位词面:`--opt=v` 只看 `=` 前的旗标名(`=` 后是值位,不归键位白名单) */
function flagWordDetermined(n: ShellWord | undefined): boolean {
  if (!n || n.dynamic || n.glob) return false;
  const w = n.word;
  const key = w.startsWith("--") && w.includes("=") ? w.slice(0, w.indexOf("=")) : w;
  return SAFE_KEY_WORD_RE.test(key);
}

/** 包装一个已归一化/确定词面为 ShellWord(拼装探测键等内部用途) */
function detWord(word: string): ShellWord {
  return { word, dynamic: false, glob: false };
}

/** 不可确定词面(缺参/无法归一化时按未确定处理,fail-closed) */
const UNDETERMINED_WORD: ShellWord = { word: "", dynamic: true, glob: false };

/** 命令头词面:归一化 + basename;不可确定(展开/通配/未闭合/白名单外字符)⇒ ""(落最严识别不出档) */
function headWord(n: ShellWord | undefined): string {
  if (!keyWordDetermined(n)) return "";
  return n!.word.replace(/^.*\//, "");
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

function nonFlagArgs(norms: ShellWord[]): string[] {
  return norms.slice(1).filter((n) => n.word !== "--" && !n.word.startsWith("-")).map((n) => n.word);
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

/** 旗标/选项识别一律用归一化词面(归一化后仍是 `-` 开头的词才算 flag) */
function peelLeadingFlags(parts: string[], norms: ShellWord[], i: number, takesArg: Set<string>): number {
  while (i < parts.length) {
    const p = norms[i]!.word;
    if (p === "--") return i + 1;
    if (!p.startsWith("-") || p === "-") break;
    const key = p.includes("=") ? p.slice(0, p.indexOf("=")) : p;
    if (takesArg.has(key) && !p.includes("=")) i += 2;
    else i += 1;
  }
  return i;
}

function peelWrapper(head: string, parts: string[], norms: ShellWord[]): string[] {
  if (head === "env") {
    let i = 1;
    while (i < parts.length) {
      const p = norms[i]!.word;
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
    const afterFlags = peelLeadingFlags(parts, norms, 1, new Set(["-k", "--kill-after", "-s", "--signal"]));
    const afterDuration = afterFlags < parts.length && !norms[afterFlags]!.word.startsWith("-") ? afterFlags + 1 : afterFlags;
    return parts.slice(afterDuration);
  }
  if (head === "xargs") {
    return parts.slice(peelLeadingFlags(parts, norms, 1, new Set(["-n", "-P", "-I", "-i", "-d", "-L", "-s", "-E", "-a", "--max-args", "--max-procs"])));
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
  return parts.slice(peelLeadingFlags(parts, norms, 1, argFlags[head] ?? new Set()));
}

function skipSudoFlags(parts: string[], norms: ShellWord[]): string[] {
  let i = 1;
  while (i < parts.length) {
    const p = norms[i]!.word;
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

/**
 * git 执行配置键判定(B2 修复,rereview-1 git-exec-config-keyset;
 * repair-4 二次修复,rereview-2:sendemail.smtpServer 漏判——
 * git-send-email 源 file_name_is_absolute($smtp_server) 时直接 exec
 * 该程序,identity 三段变体 sendemail.<identity>.* 同节)。
 * 词表依据本机 `git help config`(git 2.55)全键审计:凡值会被当作命令、
 * 程序、helper、driver、hook、可执行路径、include 路径、URL/连接目标、
 * 凭据/信任面或安全检查弱化的键一律命中。键名大小写不敏感;
 * 子节(<driver>/<name>/<url>/<identity>)部分任意。三层判定:
 *   ① 精确键(末段不命中兜底后缀者,如 attr.tree / core.worktree);
 *   ② 整节前缀(节内键名由用户命名或节本身即执行/传输/凭据面:
 *      alias./protocol./url./pager./include./includeif./difftool./
 *      mergetool./browser./man./sendemail./imap./credential./
 *      remote./uploadpack./receive./trace2./guitool./hook./filter./
 *      gitcvs./extensions./mailmap./gpg./ssh./fsmonitor./sideband./
 *      fsck./uploadarchive./lfs.customtransfer.);
 *      http 节已在 R3-P2-01 移出整节,改按 GIT_HTTP_EXEC_LEAVES 末段判定。
 *   ③ 末段后缀兜底——命令/程序/路径/文件/URL/目标/凭据/检查类词尾
 *      结尾的一律按执行配置处理,未列出的同类键 fail-closed。
 * 值含 `!` 仍是执行(submodule.<name>.update 等 `!cmd` 形态)。
 */
const GIT_EXEC_CONFIG_EXACT = new Set([
  "attr.tree", // 以任意 tree-ish 为属性源(可经 filter 属性联动到驱动命令)
  "core.fsmonitor", // fsmonitor hook 命令(值是可执行程序或 hook 名)
  "core.sshvariant", // ssh.variant 的历史别名
  "core.worktree", // 重定向整个工作树写出位置(等价 --work-tree)
  "diff.external", // 外部 diff 驱动命令
  "format.headers", // 向生成的补丁邮件注入任意头部(收件人/引用面重定向)
  "format.to", // 生成补丁的默认 To: 收件人(外发目标重定向)
  "format.signature", // 注入到每份生成补丁的签名文本(内容通道)
  "gc.repackfilterto", // repack filter 写出目标路径
  // core.* 检查弱化面:checkout 路径保护(protectHFS/NTFS 可放行 .git 类路径)、
  // stat 完整性信任(checkstat/trustctime/ignorestat)
  "core.protecthfs", "core.protectntfs", "core.checkstat", "core.trustctime",
  "core.ignorestat",
  "clean.requireforce", // 置 false 后 git clean 不再要求 -f(破坏性免确认开关)
  "imap.tunnel", // imap 隧道命令
  "init.templatedir", // 模板目录可携带 hooks,init/clone 时装入
  "instaweb.browser", // instaweb 浏览器程序
  "instaweb.httpd", // instaweb httpd 程序
  "interactive.difffilter", // add -i 的 diff 过滤命令
  "lfs.standalonetransferagent", // git-lfs 独立传输代理程序名
  "ssh.variant", // ssh 变体/命令选择
  "web.browser", // web 浏览器命令
  "help.browser" // help -w 浏览器工具选择
]);

const GIT_EXEC_CONFIG_PREFIX = [
  "alias.", // alias.<name> 值即命令(可为 ! 前缀 shell)
  "protocol.", // protocol.<name>.allow 放行 ext:: 等外部 helper 协议
  "difftool.", "mergetool.", // <tool>.cmd/path 外部工具程序
  "url.", // url.<base>.insteadOf/pushInsteadOf 改写远端 URL
  "pager.", // pager.<cmd> 按子命令指定 pager 程序
  "include.", "includeif.", // include.path / includeIf.<cond>.path 引入外部配置文件
  "browser.", "man.", // browser.<tool>.cmd/path、man.viewer/man.<tool>.cmd
  // 邮件外发链:smtpServer 绝对路径即 sendmail 类程序;sendmailCmd/toCmd/
  // ccCmd/headerCmd 是命令;smtpServerOption/envelopeSender/smtpUser 等直接进
  // 执行命令行或决定外发目标;sendemail.<identity>.* 同节(fail-closed 整节)
  "sendemail.",
  // imap.tunnel 隧道命令;host/user/pass/folder 决定凭据送达目标
  "imap.",
  // helper 命令与 credential.<url>.* OAuth 端点/凭据上下文
  "credential.",
  // url/pushurl(可为 ext:: 命令)、fetch/push refspec、proxy、
  // uploadpack/receivepack 程序、vcs helper、serverOption、mirror
  "remote.",
  // packObjectsHook 命令与 allow*SHA1InWant 对象访问放宽
  "uploadpack.",
  // procReceiveRefs 触发 proc-receive hook;fsck.* 弱化;deny* 保护开关
  "receive.",
  // *Target 文件/af_unix 套接字输出汇;envVars/configParams 采集选择
  "trace2.",
  // 用户命名命令节:guitool.<n>.cmd、hook.<n>.command、filter.<d>.clean/smudge/process
  "guitool.", "hook.", "filter.",
  // gitcvs.dbDriver Perl DBI 模块名、dbName sqlite 路径、logFile、凭据
  "gitcvs.",
  // worktreeConfig 引入额外配置源;refStorage/submodulePathConfig 等存储面
  "extensions.",
  // 内容源节:mailmap.file/mailmap.blob
  "mailmap.",
  // 信任与程序节:gpg.<f>.program、gpg.ssh.*(program/defaultKeyCommand/
  // allowedSignersFile/revocationFile/minTrustLevel);ssh.variant 程序选择
  "gpg.", "ssh.",
  // fsmonitor.socketDir 守护套接字;allowRemote 放宽
  "fsmonitor.",
  // 协议能力放宽(sideband.<url>.allow/allowAll)
  "sideband.",
  // 对象安全检查节:skipList 路径 + 各 msg-id 严重度置 ignore 即关闭检查
  "fsck.",
  // 服务端放宽:uploadarchive.allowUnreachable 放行不可达对象归档
  "uploadarchive.",
  // git-lfs 自定义传输代理 path/args/direction(git help config 未列,lfs 文档键)
  "lfs.customtransfer."
];

// 兜底:末段后缀命中即执行配置(要求 2 的 fail-closed 规则)
// 词族:命令/程序类(command|cmd|program|helper|driver|hook|editor|pager|
// askpass|sshcommand|textconv|clean|smudge|process|uploadpack|receivepack|
// agent|tunnel|viewer|browser|httpd|script|shell|executable|handler|plugin|
// extension|daemon|service|exec|alias|include|filter|variant)+路径/文件类
// (path|files?|dir|directory|template|blob|socket|cert|folder|list|location|
// tree)+目标/URL 类(url|uris?|server|host|endpoint|target|extraheader|proxy|
// mirror|port|resolve|sender|cc|bcc|from)+参数/凭据/弱化类(args|options?|
// token|config|username|pass(?:word)?|secret|authmethod|verify|allow|check|
// hash|objects|env|envvars?|log|prune|prunetags|exitcode)
// 注:不用 `to` 后缀——`gc.auto`/`maintenance.*.auto` 等以 auto 结尾的普通键
// 会被误伤;format.to / gc.repackFilterTo 已入精确键。
const GIT_EXEC_CONFIG_SUFFIX =
  /(?:command|cmd|program|helper|driver|hook|hookspath|editor|pager|askpass|sshcommand|textconv|clean|smudge|process|path|uploadpack|receivepack|proxy|url|uris?|files?|dir|directory|template|blob|agent|tunnel|viewer|browser|httpd|server|host|endpoint|target|extraheader|folder|alias|script|shell|executable|include|filter|variant|mirror|list|location|verify|authmethod|port|allow|prune|prunetags|cc|bcc|from|tree|cert|hash|objects|token|config|args|options?|check|exec|log|socket|handler|plugin|extension|daemon|service|resolve|env|envvars?|username|pass(?:word)?|secret|sender|exitcode)$/;

/**
 * http 节末段白名单(R3-P2-01,repair-5):`http.` 整节升级把 http.postBuffer 等
 * 普通传输键误伤为 S3。收窄为改变外发目标/凭据/信任链的键:http.<url>. 子节
 * 按 URL 覆盖同名键,故只比末段。proxy/extraHeader/cookieFile/curloptResolve/
 * sslCAPath/sslCert 同时被兜底后缀命中,这里列出全集以保证语义自明;
 * delegation 控制 GSSAPI/Kerberos 凭据委派，写入/删除及 -c 与 URL 子节同属 S3。
 * 其余 http 键(postBuffer、lowSpeedLimit、maxRequests、version 等)
 * 恢复普通写(兜底后缀命中的 sslVerify、userAgent 等仍执行配置,fail-closed 不放松)。
 */
const GIT_HTTP_EXEC_LEAVES = new Set([
  "proxy", "sslcainfo", "sslcapath", "sslcert", "sslkey",
  "sslcertpasswordprotected", "cookiefile", "curloptresolve", "extraheader", "delegation"
]);

function isGitExecConfig(spec: ShellWord): boolean {
  // 配置键/参数词面不可静态确定(展开/通配/未闭合引号)⇒ 按执行配置处理(fail-closed)
  if (spec.dynamic || spec.glob) return true;
  const peeled = spec.word.trim();
  const eq = peeled.indexOf("=");
  const key = (eq >= 0 ? peeled.slice(0, eq) : peeled).toLowerCase();
  // repair-6:配置键部分归一化词面含白名单外字符(展开残余/拼接/非 ASCII)⇒ 不可确定
  if (!SAFE_KEY_WORD_RE.test(key)) return true;
  const val = eq >= 0 ? peeled.slice(eq + 1) : "";
  if (val.includes("!")) return true;
  if (GIT_EXEC_CONFIG_EXACT.has(key)) return true;
  if (GIT_EXEC_CONFIG_PREFIX.some((prefix) => key.startsWith(prefix))) return true;
  const lastSeg = key.slice(key.lastIndexOf(".") + 1);
  if (key.startsWith("http.") && GIT_HTTP_EXEC_LEAVES.has(lastSeg)) return true;
  if (/^remote\..+\.vcs$/.test(key)) return true; // ext:: 外部 helper 协议
  return GIT_EXEC_CONFIG_SUFFIX.test(lastSeg);
}

/**
 * git 全局旗标解析:旗标/值识别一律用归一化词面(`-c`、`-C`、`--config-env` 等)。
 * 旗标位置词面不可静态确定(展开/通配/未闭合引号)时 fail-closed 按 cExec——
 * 该位置可能是 `-c <spec>`/`-C <dir>`/作用域参数之一。子命令词面不可确定 ⇒ sub=""
 * (落识别不出档 install_dependency,不落到 read/S1)。
 */
function parseGit(parts: string[], norms: ShellWord[]): {
  sub: string; restNorms: ShellWord[];
  cOutside: boolean; sawGlobal: boolean; cExec: boolean; execPathOutside: boolean;
} {
  let i = 1;
  let cOutside = false;
  let sawGlobal = false;
  let cExec = false;
  let execPathOutside = false;
  while (i < parts.length) {
    const n = norms[i]!;
    const p = n.word;
    if (!p.startsWith("-")) break;
    sawGlobal = true;
    // 全局旗标位词面不可确定(展开/通配/未闭合/白名单外字符)⇒ 保守按执行配置处理
    if (!flagWordDetermined(n)) {
      cExec = true;
      i += 1;
      continue;
    }
    if (p === "-C" || p === "--git-dir" || p === "--work-tree") {
      const dest = norms[i + 1]?.word ?? "";
      if (pathClass(dest) !== "inside") cOutside = true;
      i += 2;
      continue;
    }
    if (p === "-c") {
      if (isGitExecConfig(norms[i + 1] ?? UNDETERMINED_WORD)) cExec = true;
      i += 2;
      continue;
    }
    if (p.startsWith("-c") && p.includes("=")) {
      if (isGitExecConfig(detWord(p.slice(2)))) cExec = true;
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
      if (norms[i + 1] && !norms[i + 1]!.word.startsWith("-")) {
        if (pathClass(norms[i + 1]!.word) === "outside") execPathOutside = true;
        i += 2;
      } else i += 1;
      continue;
    }
    if (p.startsWith("--exec-path=")) {
      if (pathClass(p.slice("--exec-path=".length)) === "outside") execPathOutside = true;
      i += 1;
      continue;
    }
    // --config-env=<key>=<envvar>:键是配置键位置,按执行配置词面判定
    if (p === "--config-env") {
      if (norms[i + 1] && !norms[i + 1]!.word.startsWith("-")) {
        if (isGitExecConfig(norms[i + 1]!)) cExec = true;
        i += 2;
      } else i += 1;
      continue;
    }
    if (p.startsWith("--config-env=")) {
      if (isGitExecConfig(detWord(p.slice("--config-env=".length)))) cExec = true;
      i += 1;
      continue;
    }
    if (p === "--namespace") {
      if (norms[i + 1] && !norms[i + 1]!.word.startsWith("-")) i += 2;
      else i += 1;
      continue;
    }
    if (p.startsWith("--namespace=")) {
      i += 1;
      continue;
    }
    i += 1;
  }
  const subN = norms[i];
  // git 子命令位词面不可确定 ⇒ repair-6 起按执行配置处理(不再只是落最严档)
  const subOk = keyWordDetermined(subN);
  if (subN !== undefined && !subOk) cExec = true;
  const sub = subOk ? subN!.word : "";
  return { sub, restNorms: norms.slice(i + 1), cOutside, sawGlobal, cExec, execPathOutside };
}

function normalizeRef(ref: string): string {
  return ref.replace(/^\+/, "").replace(/^refs\/heads\//, "");
}

/**
 * git parse-options 长参数规范化(review-1 B1):`--opt=value` 按键参与;
 * 精确命中优先,否则取唯一前缀 ⇒ 完整名;0 命中(未识别)或多命中(歧义)⇒ undefined。
 * 词表须含 git 自动接受的 `--no-` 取反形态,缩写与歧义判定才与 git 一致
 * (如 `--no-f` 同时前缀 --no-file/--no-fixed-value ⇒ 歧义)。
 */
function resolveGitLongOption(flag: string, known: readonly string[]): string | undefined {
  if (!flag.startsWith("--") || flag === "--") return undefined;
  const key = flag.includes("=") ? flag.slice(0, flag.indexOf("=")) : flag;
  if (known.includes(key)) return key;
  const hits = known.filter((opt) => opt.startsWith(key));
  return hits.length === 1 ? hits[0] : undefined;
}

/**
 * `git push` 长参数表(git 2.55 `git push -h`):`--[no-]` 标注项全部生成取反形态;
 * `--ipv4/--ipv6/--verify` 不可取反;`--no-verify` 本身是取反入口(GAP-02 2.2 另有判定)。
 */
const GIT_PUSH_LONG_BASE = [
  "--verbose",
  "--quiet",
  "--repo",
  "--all",
  "--branches",
  "--mirror",
  "--delete",
  "--tags",
  "--dry-run",
  "--porcelain",
  "--force",
  "--force-with-lease",
  "--force-if-includes",
  "--recurse-submodules",
  "--thin",
  "--receive-pack",
  "--exec",
  "--set-upstream",
  "--progress",
  "--prune",
  "--follow-tags",
  "--signed",
  "--atomic",
  "--push-option"
] as const;

const GIT_PUSH_LONG_OPTS: readonly string[] = [
  ...GIT_PUSH_LONG_BASE,
  ...GIT_PUSH_LONG_BASE.map((o) => `--no-${o.slice(2)}`),
  "--ipv4",
  "--ipv6",
  "--verify",
  "--no-verify"
];

const GIT_PUSH_VALUED_LONG = new Set(["--push-option", "--receive-pack", "--exec", "--repo", "--recurse-submodules"]);

function uniqueGitPushLongOption(flag: string): string | undefined {
  return resolveGitLongOption(flag, GIT_PUSH_LONG_OPTS);
}

function applyGitPushLongRisk(
  opt: string,
  risk: { force: boolean; deleteRemote: boolean; all: boolean; mirror: boolean; prune: boolean }
): void {
  if (opt === "--force" || opt === "--force-with-lease") risk.force = true;
  else if (opt === "--delete") risk.deleteRemote = true;
  else if (opt === "--all" || opt === "--branches") risk.all = true;
  else if (opt === "--mirror") risk.mirror = true;
  else if (opt === "--prune") risk.prune = true;
}

function parseGitPush(rest: ShellWord[]): {
  dests: { word: string; undet: boolean }[];
  force: boolean;
  deleteRemote: boolean;
  all: boolean;
  mirror: boolean;
  prune: boolean;
} {
  const risk = { force: false, deleteRemote: false, all: false, mirror: false, prune: false };
  const positionals: { word: string; undet: boolean }[] = [];
  for (let i = 0; i < rest.length; i++) {
    const n = rest[i]!;
    const p = n.word;
    if (p === "--") {
      positionals.push(...rest.slice(i + 1).map((w) => ({ word: w.word, undet: w.dynamic || w.glob })));
      break;
    }
    if (!p.startsWith("-") || p === "-") {
      positionals.push({ word: p, undet: n.dynamic || n.glob });
      continue;
    }
    const key = p.includes("=") ? p.slice(0, p.indexOf("=")) : p;
    if (p.startsWith("--")) {
      const resolved = uniqueGitPushLongOption(p);
      if (resolved === "--repo" || key === "--repo") {
        if (!p.includes("=")) i += 1;
        continue;
      }
      if (resolved) {
        applyGitPushLongRisk(resolved, risk);
        if (GIT_PUSH_VALUED_LONG.has(resolved) && !p.includes("=")) i += 1;
        continue;
      }
      if (GIT_PUSH_VALUED_LONG.has(key) && !p.includes("=")) i += 1;
      continue;
    }
    if (p === "-o" || key === "-o") {
      if (p === "-o") i += 1;
      continue;
    }
    for (const ch of p.slice(1)) {
      if (ch === "o") break;
      if (ch === "f") risk.force = true;
      if (ch === "d") risk.deleteRemote = true;
    }
  }
  return { dests: positionals.slice(1), ...risk };
}

function isUnresolvedPushDest(dest: string): boolean {
  const d = dest.trim();
  if (d === "") return true;
  if (d === "@" || d.toUpperCase() === "HEAD" || /^HEAD[@^~:{]/i.test(d)) return true;
  return /[*?[\]\\]/.test(d);
}

function destFromRefspec(spec: string): { dest: string; force: boolean; del: boolean } {
  let s = spec;
  const force = s.startsWith("+");
  if (force) s = s.slice(1);
  if (s.startsWith(":")) return { dest: normalizeRef(s.slice(1)), force, del: true };
  const colon = s.indexOf(":");
  const remoteSide = colon >= 0 ? s.slice(colon + 1) : s;
  return { dest: normalizeRef(remoteSide), force, del: remoteSide === "" };
}

function classifyGitPush(rest: ShellWord[]): EffectDescriptor {
  const parsed = parseGitPush(rest);
  if (parsed.mirror || parsed.prune) {
    return { kind: "delete_data", target: "push-mirror-or-prune" };
  }
  if (parsed.all) {
    return { kind: "delete_data", target: "push-all" };
  }
  if (parsed.dests.length === 0) {
    if (parsed.force || parsed.deleteRemote) {
      return {
        kind: "delete_data",
        target: parsed.deleteRemote ? "delete-remote-branch:unknown" : "force-push:unknown"
      };
    }
    return { kind: "delete_data", target: "push-unresolved-dest" };
  }
  const named: string[] = [];
  const forcedNames: string[] = [];
  const deletedNames: string[] = [];
  let anyForce = parsed.force;
  let anyDelete = parsed.deleteRemote;
  let anyUnresolved = false;
  for (const spec of parsed.dests) {
    const one = destFromRefspec(spec.word);
    anyForce = anyForce || one.force;
    anyDelete = anyDelete || one.del;
    if (one.del) {
      deletedNames.push(one.dest || "unknown");
      continue;
    }
    // refspec 词面不可确定(展开/通配)⇒ 落点不可判,按 unresolved fail-closed
    if (spec.undet || isUnresolvedPushDest(one.dest)) {
      anyUnresolved = true;
      continue;
    }
    if (one.dest !== "") {
      named.push(one.dest);
      if (one.force) forcedNames.push(one.dest);
    }
  }
  if (anyForce || anyDelete || anyUnresolved) {
    const hint = (anyDelete ? deletedNames[0] : anyForce ? forcedNames[0] : named[0]) ?? "unknown";
    const target = anyDelete
      ? `delete-remote-branch:${hint}`
      : anyForce
        ? `force-push:${hint}`
        : "push-unresolved-dest";
    return { kind: "delete_data", target };
  }
  if (named.length === 0) return { kind: "delete_data", target: "push-unresolved-dest" };
  const primary = named[0]!;
  return named.length > 1
    ? { kind: "push_branch", target: primary, targets: named }
    : { kind: "push_branch", target: primary };
}

/**
 * Git 对 `--no-verify` / `--no-verbose` 的唯一前缀。`--no-veri`/`--no-verif` 真实可跳 hook;
 * `--no-ver` 歧义(exit 129)不当成功绕过。
 */
function isNoVerifyLongOption(flag: string): boolean {
  if (!flag.startsWith("--")) return false;
  const key = flag.includes("=") ? flag.slice(0, flag.indexOf("=")) : flag;
  const hits = ["--no-verify", "--no-verbose"].filter((opt) => opt.startsWith(key));
  return hits.length === 1 && hits[0] === "--no-verify";
}

/**
 * GAP-02 2.2(AS-05 剩余 grammar):绕过 hooks 的 git 形态。`commit`/`merge` 的 `--no-verify` 与 `commit` 的 `-n`
 * (含短选项簇 `-an`/`-nm msg`)⇒ 本地 hooks 绕过;`push --no-verify` ⇒ pre-push 绕过。
 * `-S`/`--gpg-sign` 的 keyid 可选且只认粘连/`=` 形态,不把后继 `--flag` 当值。
 * 不得误伤:`merge -n` = --no-stat、`cherry-pick -n` = --no-commit、`push -n` = --dry-run、`am` 无 -n;
 * 取值参数(`-m msg`/`-F file`/`--author=`…)后的 token 是值不是旗标;`--` 之后是 pathspec。
 */
function gitHooksBypass(sub: string, rest: ShellWord[]): "push" | "local" | undefined {
  if (sub !== "commit" && sub !== "merge" && sub !== "push") return undefined;
  const valued = sub === "commit"
    ? new Set(["-m", "--message", "-F", "--file", "-C", "--reuse-message", "-c", "--reedit-message", "--author", "--date",
      "-t", "--template", "--fixup", "--squash", "--cleanup", "--trailer", "--pathspec-from-file"])
    : sub === "merge"
      ? new Set(["-m", "-F", "--file", "-s", "--strategy", "-X", "--strategy-option", "--into-name"])
      : new Set(["-o", "--push-option", "--receive-pack", "--exec", "--repo"]);
  // keyid 可选:只认 `-Skey` / `--gpg-sign=key`,不吃后继 flag
  const optionalAttached = new Set(["-S", "--gpg-sign"]);
  let bypass = false;
  for (let i = 0; i < rest.length; i++) {
    const n = rest[i]!;
    const p = n.word;
    if (p === "--") break;
    // 参数词面不可确定(展开)⇒ 可能是 --no-verify,fail-closed 记绕过;
    // 通配不影响旗标语义(* 不会展开成 --no-verify),不计
    if (n.dynamic) {
      bypass = true;
      continue;
    }
    if (!p.startsWith("-")) continue;
    if (isNoVerifyLongOption(p)) {
      bypass = true;
      continue;
    }
    if (p.startsWith("--")) {
      const key = p.includes("=") ? p.slice(0, p.indexOf("=")) : p;
      if (optionalAttached.has(key)) continue;
      if (valued.has(key) && !p.includes("=")) i += 1;
      continue;
    }
    // 短选项簇:只有 commit 的 `n` 是 --no-verify;遇到取值短选项后簇内剩余字符是值,簇尾则吃下一个 token
    const cluster = p.slice(1);
    for (let j = 0; j < cluster.length; j++) {
      const ch = cluster[j]!;
      if (optionalAttached.has(`-${ch}`)) break;
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

/**
 * `git config` 长参数全表(本机 git 2.55 `git config -h` 实际列出,并并入子命令
 * get/set/unset/list 模式的修饰项 --all/--regexp/--value/--url——该四项只在子命令模式
 * 合法,取并集对分类是安全方向:legacy 下 git 会 exit 129,词面多认一个无害旗标)。
 * `-h` 标 `--[no-]` 的项生成取反形态:取反即撤销该旗标,取值参数取反=置 NULL 不再消费参数。
 * 动作参数(--get/--list/--unset/…/OPT_CMDMODE)与类型快捷名(--bool 等)不可取反。
 */
const GIT_CONFIG_LONG_BASE = [
  // 作用域/文件
  "--global", "--system", "--local", "--worktree", "--file", "--blob",
  // 动作(不可取反)
  "--get", "--get-all", "--get-regexp", "--get-urlmatch", "--get-color", "--get-colorbool",
  "--replace-all", "--add", "--unset", "--unset-all", "--rename-section", "--remove-section",
  "--list", "--edit",
  // 类型/显示/匹配
  "--bool", "--int", "--bool-or-int", "--bool-or-str", "--path", "--expiry-date",
  "--type", "--null", "--name-only", "--show-origin", "--show-scope", "--show-names",
  "--default", "--comment", "--fixed-value", "--includes",
  // 子命令模式修饰项
  "--all", "--regexp", "--value", "--url"
] as const;

const GIT_CONFIG_LONG_NEGABLE = new Set([
  "--global", "--system", "--local", "--worktree", "--file", "--blob",
  "--null", "--name-only", "--show-origin", "--show-scope", "--show-names",
  "--type", "--default", "--comment", "--fixed-value", "--includes",
  "--all", "--regexp", "--value", "--url"
]);

const GIT_CONFIG_LONG_OPTS: readonly string[] = [
  ...GIT_CONFIG_LONG_BASE,
  ...GIT_CONFIG_LONG_BASE.filter((o) => GIT_CONFIG_LONG_NEGABLE.has(o)).map((o) => `--no-${o.slice(2)}`)
];

/** 长参数中取值的项(`--opt=v` 或 `--opt v`;取反形态不取值) */
const GIT_CONFIG_LONG_VALUED = new Set(["--file", "--blob", "--type", "--default", "--comment", "--value", "--url"]);

const GIT_CONFIG_QUERY_FLAGS = new Set([
  "--get", "--get-all", "--get-regexp", "--list", "-l", "--name-only",
  "--get-urlmatch", "--get-color", "--get-colorbool"
]);
const GIT_CONFIG_WRITE_FLAGS = new Set([
  "--add", "--replace-all", "--unset", "--unset-all", "--remove-section", "--rename-section"
]);
const GIT_CONFIG_QUERY_VERBS = new Set(["get", "list"]);
const GIT_CONFIG_WRITE_VERBS = new Set(["set", "unset", "rename-section", "remove-section"]);

/**
 * config 参数剥离:全部旗标/位置参数用归一化词面判定——`--unset"-all"`、
 * `"--global"`、`co""re` 等拼接/包围形态与正常拼写等价(rereview-3 B1);
 * 长参数经 resolveGitLongOption 规范化为完整名后再判定;
 * --file/--blob/-f 的值收进 fileTargets 供圈外判定;歧义/未识别长参数置 unknownLong
 * (调用方 fail-closed)。短旗标按 git parse-options 展开簇:-z/-l/-e 无参,
 * -f/-t 取值(粘连或吃下一 token);簇内未知字符整簇按未知旗标记。
 * 任一词含展开/未闭合引号(dynamic),或配置键/旗标/作用域位置出现未加引号
 * 通配符(glob)⇒ undetermined,调用方按执行配置 fail-closed。
 */
function peelGitConfig(rest: ShellWord[]): {
  flags: string[];
  positionals: string[];
  positionalNorms: ShellWord[];
  fileTargets: string[];
  unknownLong: boolean;
  undetermined: boolean;
} {
  const flags: string[] = [];
  const positionals: string[] = [];
  const positionalNorms: ShellWord[] = [];
  const fileTargets: string[] = [];
  let unknownLong = false;
  let undetermined = rest.some((n) => n.dynamic || n.glob);
  for (let i = 0; i < rest.length; i++) {
    const n = rest[i]!;
    const p = n.word;
    if (p === "--") {
      for (const w of rest.slice(i + 1)) {
        positionals.push(w.word);
        positionalNorms.push(w);
      }
      break;
    }
    if (!p.startsWith("-") || p === "-") {
      positionals.push(p);
      positionalNorms.push(n);
      continue;
    }
    // repair-6:旗标位归一化词面(`--opt=v` 只看 `=` 前名部)含白名单外字符 ⇒ 不可确定;
    // 旗标值(--file 的路径等)是值位,不归此处判定
    if (!flagWordDetermined(n)) undetermined = true;
    if (p.startsWith("--")) {
      const resolved = resolveGitLongOption(p, GIT_CONFIG_LONG_OPTS);
      if (resolved === undefined) {
        unknownLong = true;
        continue;
      }
      flags.push(resolved);
      if (resolved.startsWith("--no-")) continue;
      if (GIT_CONFIG_LONG_VALUED.has(resolved)) {
        const hasEq = p.includes("=");
        const val = hasEq ? p.slice(p.indexOf("=") + 1) : (rest[i + 1]?.word ?? "");
        if (!hasEq) i += 1;
        if (resolved === "--file" || resolved === "--blob") fileTargets.push(val);
      }
      continue;
    }
    let j = 1;
    let bad = false;
    while (j < p.length) {
      const ch = p[j]!;
      if (ch === "z" || ch === "l" || ch === "e") {
        flags.push(`-${ch}`);
        j += 1;
        continue;
      }
      if (ch === "f" || ch === "t") {
        if (j + 1 < p.length) {
          if (ch === "f") fileTargets.push(p.slice(j + 1));
        } else {
          if (ch === "f") fileTargets.push(rest[i + 1]?.word ?? "");
          i += 1;
        }
        break;
      }
      bad = true;
      break;
    }
    if (bad) flags.push(p);
  }
  return { flags, positionals, positionalNorms, fileTargets, unknownLong, undetermined };
}

/**
 * 段操作(--rename-section/--remove-section 及动词/缩写形态)的节判定。
 * 节内可承载执行配置的节头一律命中——包括 rename **目标**节
 * (rename foo → include/includeIf.<cond>/diff.<driver> 等可注入执行配置);
 * 其余节按同名键探测兜底。
 */
const GIT_EXEC_SECTION_HEADS = new Set([
  "include", "includeif",
  "core", "alias", "sequence", "credential", "http", "filter", "difftool",
  "mergetool", "protocol", "merge", "url", "remote", "diff", "gpg", "pager",
  "ssh", "uploadpack", "gc", "imap", "interactive", "init", "web", "browser",
  "man", "help", "instaweb", "sendemail", "trailer", "guitool", "hook",
  "submodule", "lfs",
  // repair-4:全键审计后,凡节内存在执行类键的节头一并纳入(rename 注入面);
  // tar 不在 git help config 键表但 tar.<format>.command 是真实执行键
  "trace2", "extensions", "gitcvs", "receive", "fsck", "mailmap", "fsmonitor",
  "sideband", "format", "tar", "blame", "commit", "gui", "attr", "safe",
  "bundle", "promisor", "fetch", "transfer", "index", "push", "branch",
  "advice", "gitweb", "clone", "color", "column", "feature", "rebase",
  "reftable", "repack", "status", "uploadarchive", "uploadpackfilter", "clean"
]);

/** section 参数为归一化词面(peelGitConfig 上游已处理 dynamic/glob 的 fail-closed) */
function isGitExecSection(section: string): boolean {
  const s = section.toLowerCase();
  const head = s.split(".", 1)[0] ?? s;
  if (GIT_EXEC_SECTION_HEADS.has(head)) return true;
  return isGitExecConfig(detWord(`${s}.x`));
}

function classifyGitConfigWrite(name: string | undefined, value: string | undefined, sectionOp: boolean): EffectDescriptor {
  if (sectionOp) {
    if (name !== undefined && isGitExecSection(name)) {
      return { kind: "delete_data", target: "git-c-exec" };
    }
    if (value !== undefined && isGitExecSection(value)) {
      return { kind: "delete_data", target: "git-c-exec" };
    }
  }
  if (name !== undefined) {
    if (isGitExecConfig(detWord(name)) || (value !== undefined && isGitExecConfig(detWord(`${name}=${value}`)))) {
      return { kind: "delete_data", target: "git-c-exec" };
    }
  }
  return { kind: "write_worktree" };
}

function classifyGitConfig(rest: ShellWord[]): EffectDescriptor {
  const { flags, positionals, positionalNorms, fileTargets, unknownLong, undetermined } = peelGitConfig(rest);
  const fileCls = anyOutside(fileTargets);
  if (flags.includes("--global") || flags.includes("--system") || fileCls === "outside") {
    return { kind: "delete_data", target: "git-config-global" };
  }
  const verb = positionals[0] ?? "";
  const query = flags.some((f) => GIT_CONFIG_QUERY_FLAGS.has(f)) || GIT_CONFIG_QUERY_VERBS.has(verb);
  const edit = flags.includes("--edit") || flags.includes("-e") || verb === "edit";
  const writeFlag = flags.some((f) => GIT_CONFIG_WRITE_FLAGS.has(f));
  const writeVerb = GIT_CONFIG_WRITE_VERBS.has(verb);
  const body = writeVerb ? positionals.slice(1) : positionals;
  const sectionOp = flags.includes("--rename-section") || flags.includes("--remove-section")
    || verb === "rename-section" || verb === "remove-section";
  // repair-6 键位白名单:配置键/节名位置(动词子命令的首位置词之后的实参位)
  // 归一化词面含白名单外字符 ⇒ 不可确定;`--get-regexp` 的模式参数是值位不判
  const bodyNorms = writeVerb || GIT_CONFIG_QUERY_VERBS.has(verb) || verb === "edit"
    ? positionalNorms.slice(1)
    : positionalNorms;
  const kwUndet = (n: ShellWord | undefined) => n !== undefined && !keyWordDetermined(n);
  const keyUndetermined =
    (!flags.includes("--get-regexp") && kwUndet(bodyNorms[0])) ||
    (sectionOp && kwUndet(bodyNorms[1]));
  let d: EffectDescriptor;
  if (query && !writeFlag && !writeVerb && !edit) {
    d = { kind: "read" };
  } else if (edit) {
    d = { kind: "delete_data", target: "git-c-exec" };
  } else if (writeFlag || writeVerb || body.length >= 2) {
    d = classifyGitConfigWrite(body[0], body[1], sectionOp);
  } else {
    d = { kind: "read" };
  }
  // B1 fail-closed:file/blob 目标不可判、歧义/未识别长参数 ⇒ 不得落到 read/S0/S1
  if (fileCls === "unknown") d = floorS2(d, "git-config-file-unknown");
  if (unknownLong) d = floorS2(d, "git-config-option-unknown");
  // rereview-3 B1:配置键/旗标/位置参数词面不可确定(展开、未闭合引号、
  // 敏感位置通配)⇒ 无法证明所写键不是执行配置,一律按执行配置处理
  if (undetermined || keyUndetermined) d = { kind: "delete_data", target: "git-c-exec" };
  return d;
}

/** branch 写形态长参数(唯一前缀按 git 规则解析;未识别/歧义落回位置参数判定) */
const GIT_BRANCH_WRITE_LONG = ["--delete", "--move", "--copy"] as const;

function classifyGitBranch(rest: ShellWord[]): EffectDescriptor {
  const writeFlags = new Set(["-d", "-D", "-m", "-M", "-c", "-C", "--delete", "--move", "--copy"]);
  if (rest.some((n) => writeFlags.has(n.word) || resolveGitLongOption(n.word, GIT_BRANCH_WRITE_LONG) !== undefined)) {
    return { kind: "write_worktree" };
  }
  if (rest.some((n) => !n.word.startsWith("-"))) return { kind: "write_worktree" };
  return { kind: "read" };
}

function classifyGitRemote(rest: ShellWord[]): EffectDescriptor {
  const verb = rest.find((n) => !n.word.startsWith("-"))?.word ?? "";
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

function pkgCallScript(norms: ShellWord[]): string | undefined {
  for (let i = 0; i < norms.length; i++) {
    const p = norms[i]!.word;
    if (p === "-c" || p === "--call") return norms[i + 1]?.word ?? "";
    if (p.startsWith("--call=")) return p.slice("--call=".length);
  }
  return undefined;
}

function peelExecRemainder(rest: string[], norms: ShellWord[]): string[] {
  let i = 1;
  const valued = new Set(["--package", "-p", "--prefix"]);
  while (i < rest.length) {
    const p = norms[i]!.word;
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

function classifyPkgExecCall(rest: string[], restNorms: ShellWord[]): EffectDescriptor {
  const script = pkgCallScript(restNorms);
  if (script !== undefined) return floorS2(commandToEffect(script), "pkg-exec-call");
  const remainder = peelExecRemainder(rest, restNorms);
  if (remainder.length === 0) return { kind: "install_dependency", target: "pkg-exec" };
  return classifyExecInner(remainder.join(" "));
}

function envChdirClass(norms: ShellWord[]): PathClass | undefined {
  for (let i = 1; i < norms.length; i++) {
    const p = norms[i]!.word;
    if (p === "-C" || p === "--chdir") return pathClass(norms[i + 1]?.word ?? "");
    if (p.startsWith("--chdir=")) return pathClass(p.slice("--chdir=".length));
  }
  return undefined;
}

/** 位置参数词面(归一化后) */
function positionals(norms: ShellWord[]): string[] {
  return norms.filter((n) => n.word !== "--" && !n.word.startsWith("-")).map((n) => n.word);
}

/** `git archive` 长参数(git 2.55 `archive -h`;`--mtime` 与短名外均标 `--[no-]`,生成取反形态) */
const GIT_ARCHIVE_LONG_OPTS: readonly string[] = [
  "--format", "--prefix", "--add-file", "--add-virtual-file", "--output",
  "--worktree-attributes", "--verbose", "--mtime", "--list", "--remote", "--exec",
  "--no-format", "--no-prefix", "--no-add-file", "--no-add-virtual-file", "--no-output",
  "--no-worktree-attributes", "--no-verbose", "--no-list", "--no-remote", "--no-exec"
];

/**
 * `git format-patch` 只需识别决定副作用的 --output-directory(git 内无其他 --o* 长参数,
 * 故唯一前缀解析与 git 一致;其余长参数不影响路径判定,不收入表)。
 */
const GIT_FORMAT_PATCH_LONG_OPTS: readonly string[] = ["--output-directory", "--no-output-directory"];

function gitPathTargets(sub: string, rest: ShellWord[]): string[] {
  if (sub === "init") return positionals(rest);
  if (sub === "worktree") {
    const verb = rest.find((n) => !n.word.startsWith("-"))?.word ?? "";
    if (verb === "add" || verb === "remove" || verb === "move" || verb === "repair") {
      const idx = rest.findIndex((n) => n.word === verb);
      return rest.slice(idx + 1).filter((n) => n.word !== "--" && !n.word.startsWith("-")).map((n) => n.word);
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
      const p = rest[i]!.word;
      if (p === "-o") out.push(rest[i + 1]?.word ?? "");
      else if (p.startsWith("--") && resolveGitLongOption(p, GIT_ARCHIVE_LONG_OPTS) === "--output") {
        out.push(p.includes("=") ? p.slice(p.indexOf("=") + 1) : (rest[i + 1]?.word ?? ""));
      }
    }
    return out;
  }
  if (sub === "bundle") {
    const idx = rest.findIndex((n) => n.word === "create");
    if (idx < 0) return [];
    const file = rest.slice(idx + 1).find((n) => n.word !== "--" && !n.word.startsWith("-"));
    return file ? [file.word] : [];
  }
  if (sub === "format-patch") {
    const out: string[] = [];
    for (let i = 0; i < rest.length; i++) {
      const p = rest[i]!.word;
      if (p === "-o") out.push(rest[i + 1]?.word ?? "");
      else if (p.startsWith("--") && resolveGitLongOption(p, GIT_FORMAT_PATCH_LONG_OPTS) === "--output-directory") {
        out.push(p.includes("=") ? p.slice(p.indexOf("=") + 1) : (rest[i + 1]?.word ?? ""));
      }
    }
    return out;
  }
  if (sub === "submodule") {
    const verb = rest.find((n) => !n.word.startsWith("-"))?.word ?? "";
    if (verb !== "add") return [];
    const pos = rest.filter((n) => n.word !== "--" && !n.word.startsWith("-")).map((n) => n.word);
    return pos[2] ? [pos[2]] : [];
  }
  return [];
}

function classifyGitPathSub(sub: string, rest: ShellWord[]): EffectDescriptor | undefined {
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

function classifySed(norms: ShellWord[]): EffectDescriptor {
  const inplace = norms.some((n) => isSedInplace(n.word));
  let hasDashF = false;
  let script = "";
  let i = 1;
  while (i < norms.length) {
    const p = norms[i]!.word;
    if (p === "--") {
      i += 1;
      break;
    }
    if (p === "-e" || p === "--expression") {
      script += norms[i + 1]?.word ?? "";
      i += 2;
      continue;
    }
    if (p.startsWith("--expression=")) {
      script += p.slice("--expression=".length);
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
  if (!script && i < norms.length) script = norms[i]!.word;
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
    const hit = writeOutsideOf(nonFlagArgs(norms));
    if (hit?.kind === "delete_data") return hit;
    if (hit) d = floorS2(d, hit.target);
  }
  return d;
}

function classifyAwk(norms: ShellWord[]): EffectDescriptor {
  let hasDashF = false;
  let program = "";
  let i = 1;
  while (i < norms.length) {
    const p = norms[i]!.word;
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
      program += norms[i + 1]?.word ?? "";
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
  if (!program && i < norms.length) program = norms[i]!.word;
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

function peelPkgGlobals(head: string, parts: string[], norms: ShellWord[]): { rest: string[]; restNorms: ShellWord[]; dirClass?: PathClass } {
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
    return { rest: parts.slice(1), restNorms: norms.slice(1) };
  }
  let i = 1;
  let dirClass: PathClass | undefined;
  const dirKeys = new Set(["-C", "--dir", "--prefix", "--cwd"]);
  while (i < parts.length) {
    const p = norms[i]!.word;
    if (p === "--") {
      i += 1;
      break;
    }
    if (!p.startsWith("-") || p === "-") break;
    const key = p.includes("=") ? p.slice(0, p.indexOf("=")) : p;
    if (dirKeys.has(key)) {
      const dest = p.includes("=") ? p.slice(p.indexOf("=") + 1) : (norms[i + 1]?.word ?? "");
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
  let restNorms = norms.slice(i);
  if (head === "yarn" && restNorms[0]?.word === "workspace" && rest.length >= 3) {
    rest = rest.slice(2);
    restNorms = restNorms.slice(2);
  }
  return dirClass === undefined ? { rest, restNorms } : { rest, restNorms, dirClass };
}

function classifyPkg(head: string, parts: string[], norms: ShellWord[]): EffectDescriptor {
  if (head === "uv" || head === "go" || head === "pip" || head === "pip3" || head === "cargo" || head === "brew" || head === "gem" || head === "poetry") {
    const verb = norms[1]?.word ?? "";
    if (head === "uv" && verb === "run") return { kind: "install_dependency", target: "uv-run" };
    if (head === "go" && verb === "run") {
      const target = norms.slice(2).find((n) => !n.word.startsWith("-"))?.word ?? "";
      if (isGoRemoteRunTarget(target)) return { kind: "install_dependency", target: target.slice(0, 60) };
      // SD-3:本地 go run 与 node 同档——执行的是 worktree 内任意代码,不因语言名豁免
      return { kind: "install_dependency", target: "go-run" };
    }
    if (PKG_S3.has(verb)) return { kind: "send_external", target: "pkg-publish" };
    if (PKG_S2.has(verb)) {
      const pkgs = norms.slice(2).filter((n) => !n.word.startsWith("-")).map((n) => n.word);
      return { kind: "install_dependency", target: pkgs.join(",") || "(lockfile)" };
    }
    if (PKG_SCRIPT_EXEC.has(verb)) return { kind: "install_dependency", target: `pkg-script:${verb}` };
    if (PKG_QUERY_S1.has(verb)) return { kind: "write_worktree" };
    return { kind: "install_dependency", target: `${head} ${verb}`.trim().slice(0, 60) };
  }
  const { rest, restNorms, dirClass } = peelPkgGlobals(head, parts, norms);
  const verb = restNorms[0]?.word ?? "";
  let d: EffectDescriptor;
  if (verb === "exec") {
    d = classifyPkgExecCall(rest, restNorms);
  } else if (PKG_S3.has(verb)) {
    d = { kind: "send_external", target: "pkg-publish" };
  } else if (PKG_S2.has(verb)) {
    const pkgs = restNorms.slice(1).filter((n) => !n.word.startsWith("-")).map((n) => n.word);
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

function copyMoveDest(norms: ShellWord[]): string | undefined {
  for (let i = 1; i < norms.length; i++) {
    const p = norms[i]!.word;
    if (p === "-t" || p === "--target-directory") return norms[i + 1]?.word;
    if (p.startsWith("--target-directory=")) return p.slice("--target-directory=".length);
  }
  const args = nonFlagArgs(norms);
  return args.length ? args[args.length - 1] : undefined;
}

function httpOutputTarget(norms: ShellWord[]): string | undefined {
  for (let i = 1; i < norms.length; i++) {
    const p = norms[i]!.word;
    if (p === "-o" || p === "-O" || p === "--output" || p === "--output-document") return norms[i + 1]?.word;
    if (p.startsWith("--output=") || p.startsWith("--output-document=")) return p.slice(p.indexOf("=") + 1);
  }
  return undefined;
}

/** `-c`/`-lc` 类内联脚本旗标的下标(匹配归一化词面);脚本体用归一化词(真实执行文本) */
function findDashCArg(norms: ShellWord[]): number | undefined {
  for (let i = 1; i < norms.length; i++) {
    if (/^-[a-zA-Z]*c[a-zA-Z]*$/.test(norms[i]!.word)) return i;
  }
  return undefined;
}

function isInlineCodeFlag(p: string): boolean {
  return p === "-c" || p === "-e" || p === "--eval" || /^-[a-zA-Z]*c[a-zA-Z]*$/.test(p);
}

function rhsIsInterpreter(rhs: string): boolean {
  let tokens = tokenize(rhs.trim());
  let norms = tokens.map(normalizeShellWord);
  for (let n = 0; n < 8 && tokens.length > 0; n++) {
    const head = headWord(norms[0]).replace(/^\\+/, "").toLowerCase();
    if (head === "sudo" || head === "doas") {
      const next = skipSudoFlags(tokens, norms);
      if (next.length === tokens.length) break;
      norms = norms.slice(norms.length - next.length);
      tokens = next;
      continue;
    }
    if (WRAPPER_HEADS.has(head) || head === "xargs") {
      const next = peelWrapper(head, tokens, norms);
      if (next.length === tokens.length) break;
      norms = norms.slice(norms.length - next.length);
      tokens = next;
      continue;
    }
    if (!INTERPRETER_HEAD.test(head)) return false;
    // 壳族:即使带脚本文件也算喂 shell(B-4)
    if (SHELL_HEADS.has(head) || /(?:ba|z|k|c|da|fi)?sh$/.test(head)) return true;
    const rest = norms.slice(1);
    if (rest.some((nw) => isInlineCodeFlag(nw.word))) return true;
    const files = rest.filter((nw) => nw.word !== "--" && !nw.word.startsWith("-") && nw.word !== "-");
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

function mergePushDests(a: EffectDescriptor, b: EffectDescriptor): string[] {
  const names: string[] = [];
  for (const d of [a, b]) {
    if (d.kind !== "push_branch") continue;
    if (d.target) names.push(d.target);
    if (d.targets) names.push(...d.targets);
  }
  return [...new Set(names.filter((n) => n !== ""))];
}

function maxDescriptor(a: EffectDescriptor, b: EffectDescriptor): EffectDescriptor {
  const top = RISK_ORDER.indexOf(a.kind) >= RISK_ORDER.indexOf(b.kind) ? a : b;
  const dests = mergePushDests(a, b);
  const touches = Boolean(a.touchesSensitiveData || b.touchesSensitiveData);
  let out = top;
  if (top.kind === "push_branch" && dests.length > 0) {
    const primary = dests[0]!;
    const merged: EffectDescriptor = dests.length > 1
      ? { kind: "push_branch", target: primary, targets: dests }
      : { kind: "push_branch", target: primary };
    if (top.touchesSensitiveData) merged.touchesSensitiveData = true;
    if (top.triggersDeployPreview) merged.triggersDeployPreview = true;
    if (top.hasPostinstall) merged.hasPostinstall = true;
    if (top.reason !== undefined) merged.reason = top.reason;
    out = merged;
  }
  return touches && !out.touchesSensitiveData ? { ...out, touchesSensitiveData: true } : out;
}

function classifySegmentGivenHead(s: string, parts: string[], norms: ShellWord[], head: string, touches: boolean): EffectDescriptor {
  const base = (d: EffectDescriptor): EffectDescriptor =>
    (touches && !d.touchesSensitiveData ? { ...d, touchesSensitiveData: true } : d);

  const redirected = classifyRedirects(s);
  if (redirected) return base(redirected);

  if (head === "") return base({ kind: "install_dependency", target: s.slice(0, 60) });

  if (head === "env") {
    const chdir = envChdirClass(norms);
    const rest = peelWrapper(head, parts, norms);
    if (rest.length === 0) return base(applyOutsideCwd({ kind: "install_dependency", target: s.slice(0, 60) }, chdir));
    return base(applyOutsideCwd(classifySegment(rest.join(" ")), chdir));
  }

  if (WRAPPER_HEADS.has(head) || head === "xargs") {
    const rest = peelWrapper(head, parts, norms);
    if (rest.length === 0) return base({ kind: "install_dependency", target: s.slice(0, 60) });
    const inner = classifySegment(rest.join(" "));
    return base(head === "xargs" ? floorS2(inner) : inner);
  }

  if (DESTRUCTIVE_HEADS.has(head) || [...DESTRUCTIVE_HEADS].some((d) => head.startsWith(d + "."))) {
    return base({ kind: "delete_data", target: s.slice(0, 60) });
  }

  if (head === "sudo" || head === "doas") {
    const rest = skipSudoFlags(parts, norms);
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
    const destN = norms.slice(1).find((n) => n.word === "-" || !n.word.startsWith("-") || n.word === "--");
    const raw = destN === undefined || destN.word === "--" ? undefined : destN.word;
    if (raw === undefined || raw === "") return base({ kind: "delete_data", target: "cd-outside" });
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
    const target = nonFlagArgs(norms)[0];
    if (target && pathClass(target) === "outside") return base({ kind: "send_external", target: "source-outside" });
    return base(floorS2({ kind: "write_worktree" }, "source"));
  }

  if (SHELL_HEADS.has(head)) {
    const idx = findDashCArg(norms);
    if (idx !== undefined) {
      // 脚本体取归一化词面:shell 真正执行的就是引号去除后的文本
      return base(floorS2(commandToEffect(norms[idx + 1]?.word ?? "")));
    }
    return base({ kind: "install_dependency", target: s.slice(0, 60) });
  }

  if (head === "eval") {
    if (/\$\(|`/.test(s)) return base({ kind: "send_external", target: "eval-subshell" });
    const rest = norms.slice(1).map((n) => n.word).join(" ");
    if (!rest) return base({ kind: "install_dependency", target: "eval" });
    return base(floorS2(commandToEffect(rest)));
  }

  if (head === "find") {
    if (norms.some((n) => FIND_MUTATE.has(n.word))) return base({ kind: "delete_data", target: s.slice(0, 60) });
    return base({ kind: "read" });
  }

  if (head === "git") {
    const { sub, restNorms, cOutside, sawGlobal, cExec, execPathOutside } = parseGit(parts, norms);
    // repair-6:子命令参数里旗标位(`--` 分隔之前、归一化后以 `-` 起头的词)词面
    // 含白名单外字符 ⇒ 不可确定,按执行配置处理;位置参数(refspec/路径/值位)不在此判
    let restFlagUndetermined = false;
    for (const n of restNorms) {
      if (n.word === "--") break;
      if (n.word.startsWith("-") && n.word !== "-" && !flagWordDetermined(n)) {
        restFlagUndetermined = true;
        break;
      }
    }
    const pathHit = classifyGitPathSub(sub, restNorms);
    let d: EffectDescriptor;
    if (pathHit) d = pathHit;
    else if (sub === "push") d = classifyGitPush(restNorms);
    else if (sub === "config") d = classifyGitConfig(restNorms);
    else if (sub === "branch") d = classifyGitBranch(restNorms);
    else if (sub === "remote") d = classifyGitRemote(restNorms);
    else if (GIT_READ_SUB.has(sub)) d = { kind: "read" };
    else if (GIT_LOCAL_SUB.has(sub)) d = { kind: "write_worktree" };
    else d = { kind: "install_dependency", target: s.slice(0, 60) };
    d = applyCOutside(d, cOutside);
    if (cExec || execPathOutside || restFlagUndetermined) d = floorKind(d, "delete_data", "git-c-exec");
    if (sawGlobal) d = floorS2(d, "git-global");
    // GAP-02 2.2:绕过 hooks 只取较高者;push --no-verify 与 -c core.hooksPath 同档 S3,本地 commit/merge 绕过 floor S2
    const hooksBypass = gitHooksBypass(sub, restNorms);
    if (hooksBypass === "push") d = floorKind(d, "delete_data", "git-hooks-bypass");
    else if (hooksBypass === "local") d = floorS2(d, "git-hooks-bypass");
    return base(d);
  }

  if (head === "npx" || head === "bunx") {
    const script = pkgCallScript(norms.slice(1));
    if (script !== undefined) return base(floorS2(commandToEffect(script), "npx-call"));
    return base({ kind: "install_dependency", target: head });
  }
  if (PKG_FETCH_HEADS.has(head)) return base({ kind: "install_dependency", target: head });
  if (PKG_MANAGERS.has(head)) return base(classifyPkg(head, parts, norms));

  if (head === "curl" || head === "wget") {
    const out = httpOutputTarget(norms);
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
    const targets = nonFlagArgs(norms);
    const cls = anyOutside(targets);
    if (cls === "outside") return base({ kind: "delete_data", target: targets.join(" ").slice(0, 60) });
    if (cls === "unknown") return base({ kind: "install_dependency", target: "path-unknown" });
    return base({ kind: "write_worktree" });
  }

  if (head === "tee") {
    const hit = writeOutsideOf(nonFlagArgs(norms));
    if (hit) return base(hit);
    return base({ kind: "write_worktree" });
  }

  if (head === "cp" || head === "mv") {
    const dest = copyMoveDest(norms);
    const hit = dest ? writeOutsideOf([dest]) : undefined;
    if (hit) return base(hit);
    return base({ kind: "write_worktree" });
  }

  // Unix install:圈外写出 S3;圈内保持未知词头 S2(旧档 S2,不放宽到 S1)
  if (head === "install") {
    const dest = copyMoveDest(norms);
    const hit = dest ? writeOutsideOf([dest]) : undefined;
    if (hit) return base(hit);
    return base({ kind: "install_dependency", target: s.slice(0, 60) });
  }

  if (head === "ln") {
    const args = nonFlagArgs(norms);
    const dest = args[args.length - 1];
    const src = args.length >= 2 ? args[0] : undefined;
    if (src && pathClass(src) === "outside") return base({ kind: "delete_data", target: "write-outside-worktree" });
    const hit = dest ? writeOutsideOf([dest]) : undefined;
    if (hit) return base(hit);
    return base({ kind: "write_worktree" });
  }

  if (head === "chmod" || head === "touch" || head === "mkdir") {
    const hit = writeOutsideOf(nonFlagArgs(norms));
    if (hit) return base(hit);
    return base({ kind: "write_worktree" });
  }

  // chown/chgrp:圈外 S3;圈内保持 S2(旧档未知词头 S2,不放宽)
  if (head === "chown" || head === "chgrp") {
    const hit = writeOutsideOf(nonFlagArgs(norms));
    if (hit) return base(hit);
    return base({ kind: "install_dependency", target: s.slice(0, 60) });
  }

  if (head === "sed") {
    const d = classifySed(norms);
    if (anyOutside(nonFlagArgs(norms)) === "outside") return base(floorS2(d, "outside-read"));
    return base(d);
  }
  if (head === "awk") return base(classifyAwk(norms));

  if (READ_ONLY_HEADS.has(head)) {
    if (/[^|>]>{1,2}/.test(stripDevSinkRedirects(s))) return base({ kind: "write_worktree" });
    if (anyOutside(nonFlagArgs(norms)) === "outside") return base(floorS2({ kind: "read" }, "outside-read"));
    return base({ kind: "read" });
  }
  if (WORKTREE_WRITE_HEADS.has(head)) return base({ kind: "write_worktree" });

  return base({ kind: "install_dependency", target: s.slice(0, 60) });
}

/**
 * 单段命令归类(无连接符);exported 供测试逐类断言。
 * repair-5:tokenize 后先逐词做 POSIX 词归一化(normalizeShellWord)——分类一律看
 * 归一化词面;命令头词面不可确定(展开/通配/未闭合引号)⇒ head="" 落识别不出
 * 的最严档(install_dependency,不落 read/S0/S1)。
 */
export function classifySegment(segment: string): EffectDescriptor {
  const s = segment.trim();
  const touches = SENSITIVE_PATH_RE.test(s);
  const parts = tokenize(s);
  const norms = parts.map(normalizeShellWord);
  const head = headWord(norms[0]);
  let top = classifySegmentGivenHead(s, parts, norms, head, touches);
  if (/[A-Z]/.test(head)) {
    top = maxDescriptor(top, classifySegmentGivenHead(s, parts, norms, head.toLowerCase(), touches));
  }
  const noSlash = head.replace(/^\\+/, "");
  if (noSlash !== head) {
    top = maxDescriptor(top, classifySegmentGivenHead(s, parts, norms, noSlash, touches));
    if (/[A-Z]/.test(noSlash)) {
      top = maxDescriptor(top, classifySegmentGivenHead(s, parts, norms, noSlash.toLowerCase(), touches));
    }
  }
  const lower = noSlash.toLowerCase();
  if (G_COREUTILS.has(lower)) {
    const stripped = noSlash.slice(1);
    top = maxDescriptor(top, classifySegmentGivenHead(s, parts, norms, stripped, touches));
    if (/[A-Z]/.test(stripped)) {
      top = maxDescriptor(top, classifySegmentGivenHead(s, parts, norms, stripped.toLowerCase(), touches));
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
 * 整条命令归类:先按 `>|` 归一,再按 && ; | 与换行拆段,取最高风险段
 * (段序按 RISK_ORDER;touchesSensitiveData 任一段命中即整条携带)。
 * repair-7(rereview-5 R5-B1):多行命令(含 `\<换行>`)不做续行解析,地板判
 * install_dependency(S2 至少需确认,不落 S0/S1),与分段判定取严者;命令中
 * 任意位置出现归一化 `git` 词 ⇒ git 执行配置最严档(delete_data/git-c-exec,S3)。
 * repair-8(rereview-6 B1):命中多行地板时再算一次 main 式判定——对
 * `command.replace(/\\\r?\n/g," ")` 的折叠串走同一单行分类路径得 legacy。
 * repair-9(rereview-7 B1):main 式下限改为对所有命令无条件计算(单行两路
 * 同值,判定不变);多行地板改为无引号判断——命令任意位置出现 `\n`/`\r` 即
 * 触发,不再用单引号状态机判定"换行是否在引号外"(该状态机会被双引号内的
 * 字面单引号骗过:rereview-7 反例 `echo "'" && rm -rf \<换行>/x` 曾跳过地板
 * 与下限落到 S2)。单引号内的字面换行同样触发地板,属有意从严。
 * repair-10(rereview-8 B1,根因 legacy-classifier-floor):repair-8/9 的
 * "main 式下限"走的是候选自己的 classifyCommandText——候选规则在部分路径上
 * 替换了 HEAD 判定(如动态命令头 `"/bin/${PWD:+.}/rm"`),下限并不真的等于
 * main。改为:最终返回前对所有命令无条件与 `legacyCommandToEffect(command)`
 * (HEAD 90e0777 原样拷贝,见 cmdEffectLegacy.ts 头注)取 maxDescriptor,
 * touchesSensitiveData 任一为真即携带——任意命令判定不低于 HEAD。
 */
export function commandToEffect(command: string): EffectDescriptor {
  let out = maxDescriptor(
    classifyCommandText(command),
    classifyCommandText(command.replace(/\\\r?\n/g, " "))
  );
  if (/[\r\n]/.test(command)) {
    const floor: EffectDescriptor = containsGitWord(command)
      ? { kind: "delete_data", target: "git-c-exec" }
      : { kind: "install_dependency", target: "multi-line-command" };
    out = maxDescriptor(floor, out);
  }
  return maxDescriptor(out, legacyCommandToEffect(command));
}

/**
 * 单条命令的分类主路径(无多行地板):`>|` 归一 ⇒ 管道喂解释器整条 S3 ⇒
 * 子 shell 上浮 ⇒ 按 && ; | 与换行拆段取严。供 commandToEffect 与 main 式
 * 折叠下限共用;输入仍可能含 `\n` 作段分隔(与 main 行为一致)。
 */
function classifyCommandText(command: string): EffectDescriptor {
  const s = command.replace(/>\|/g, ">");
  // 管道喂解释器:整条 S3。引号内 `| sh` 仍命中(更安全一侧,评审 1 B2)。
  if (isPipeToShell(s) || /\|[\s"'`]*(sudo\s+(-\S+\s+)*)?(\S*\/)?((ba|z|k|c|da|fi)?sh)\b/.test(s)) {
    const touches = SENSITIVE_PATH_RE.test(s);
    return { kind: "send_external", target: "pipe-to-shell", ...(touches ? { touchesSensitiveData: true } : {}) };
  }
  const hasSubshell = /\$\(|`/.test(s);
  const segments = s
    .split(/&&|\|\||;|\||\n/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
  if (hasSubshell) {
    const inner = commandToEffectInner(segments);
    return inner.kind === "read" || inner.kind === "write_worktree"
      ? { kind: "install_dependency", target: s.slice(0, 60), ...(inner.touchesSensitiveData ? { touchesSensitiveData: true } : {}) }
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
    top = top ? maxDescriptor(top, d) : d;
  }
  const out = top as EffectDescriptor;
  return touches ? { ...out, touchesSensitiveData: true } : out;
}

/** 冻结 verify argv 命中判定(执行器把已冻结的 verify 命令识别为 run_registered_verify,S1) */
export function matchesFrozenVerify(command: string, frozenArgvs: readonly string[][]): boolean {
  // repair-7:含 `\n`/`\r` 的命令一律不命中——`\s+` 折叠会把第二行藏进
  // "与冻结 argv 相同"的假象,多行命令必须落到 commandToEffect 的从严地板。
  if (/[\r\n]/.test(command)) return false;
  const norm = command.trim().replace(/\s+/g, " ");
  return frozenArgvs.some((argv) => argv.join(" ") === norm);
}
