// G3 verify 白名单执行器 + 内容冻结(计划 4.1;04 §5.3/05 §4-G3;Plan Delta P0 承载)。
// dispatch 时冻结每条 verify 的 {templateRef, argv, scriptDigest};执行前重读脚本重算 digest,
// 不符 ⇒ fail-closed。Plan Delta:agent 合法改了验证脚本 ⇒ 内容冻结拦下 ⇒ 转 blocked 回叫
// "要改验证命令,需要你重新拍板" → 新 revision 重签(不静默放行、不静默死,04 §5.4)。
//
// W5a 3.1-①(tier1-conformance §3 [warn] 清偿;05 §4 G3 域):框架 config 面纳入冻结快照。
// 取舍 = 方案 a"冻结快照"而非方案 b"保守拒"——config 变更走 Plan Delta 重拍板(可用性保留),
// 而非把引用 config 的 verify 模板整体拒掉(方案 b 会让 vitest/playwright 类模板不可登记)。
// 闭包范围(诚实边界,超出部分登记 P1 受控执行环境):
//   ① 命令文本里可识别 runner(vitest/playwright/jest/tsc/eslint/pytest/ruff/mocha)的已知
//      config 文件族(workspace 根;缺席记 null,冻结后新建同名文件同样漂移);
//   ② 命令文本里引用的脚本/配置路径 token(./run.sh 类;排除 package.json 本体、锁文件与
//      构建产物目录——前者有三键闭包、后两者随合法开发漂移);
//   ③ justfile 体内 `pnpm/npm/yarn run <s>`/`… test` 一层递归到 package.json 对应脚本三键闭包。
// 不覆盖(如实):node_modules 内代码、依赖树、monorepo 子包 config、tsconfig extends 链递归。

import { existsSync, readFileSync } from "node:fs";
import { join, normalize } from "node:path";
import { textDigest } from "@saydo/contracts";
import { isRegisteredVerify, type VerifyRegistry } from "../policy/engine.js";

export interface FrozenVerify {
  templateRef: string; // "package_script:test" / "justfile:ci"
  argv: string[]; // 冻结的执行 argv(daemon 构造,agent 不可拼)
  scriptDigest: string; // 冻结时脚本正文 digest
  /** config 冻结闭包(3.1-①):相对路径/伪键 -> 冻结时 digest(缺席 = null,新建即漂移) */
  configDigests: Record<string, string | null>;
}

/** 从工作区读取 verify 脚本正文(package.json scripts[name] / justfile 任务体) */
export function readVerifyScript(workspace: string, templateRef: string): string {
  const [kind, name] = templateRef.split(":");
  if (kind === "package_script") {
    const pkg = JSON.parse(readFileSync(join(workspace, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    const body = pkg.scripts?.[name ?? ""];
    if (body === undefined) throw new Error(`package script not found: ${name}`);
    return body;
  }
  if (kind === "justfile") {
    const just = readFileSync(join(workspace, "justfile"), "utf8");
    return extractJustTask(just, name ?? "");
  }
  throw new Error(`unknown verify template kind: ${kind}`);
}

/** 抽取 justfile 单任务体(从 "<name>:" 行到下一个顶层配方或文件尾) */
function extractJustTask(just: string, name: string): string {
  const lines = just.split("\n");
  const start = lines.findIndex((l) => new RegExp(`^${name}\\s*:(?!=)`).test(l));
  if (start < 0) throw new Error(`justfile task not found: ${name}`);
  const body: string[] = [lines[start] as string];
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i] as string;
    if (/^[A-Za-z][\w-]*\s*:(?!=)/.test(l)) break; // 下一个顶层配方
    body.push(l);
  }
  return body.join("\n");
}

/**
 * 冻结/重校用的正文闭包(code-review A1 回修):package_script 冻结 **pre/main/post 三键**——
 * 只冻结目标键时,agent 用内置 edit 工具(不过 beforeShellExecution 钩子)注入 `pretest` 键,
 * 目标键 digest 不变、precheck 放行,而 `pnpm/npm run test` 可能跑 pretest = 免门 RCE 通道。
 * 缺失键计入(null),注入即从 null 变有值 ⇒ digest 变 ⇒ content_drift 转 blocked。
 * 框架 config 面已随 W5a 3.1-① 纳入冻结(snapshotConfigClosure/recheckConfigClosure,
 * 范围与诚实边界见文件头注);残余 = TOCTOU 精确时序竞态 + node_modules/依赖树,
 * 完整解仍是 P1 受控执行环境(冻结正文经只读临时文件/stdin 直喂解释器)。
 */
export function readFrozenVerifyBody(workspace: string, templateRef: string): string {
  const [kind, name] = templateRef.split(":");
  if (kind === "package_script") {
    const pkg = JSON.parse(readFileSync(join(workspace, "package.json"), "utf8")) as { scripts?: Record<string, string> };
    const s = pkg.scripts ?? {};
    const n = name ?? "";
    if (s[n] === undefined) throw new Error(`package script not found: ${n}`);
    return JSON.stringify({ pre: s[`pre${n}`] ?? null, main: s[n], post: s[`post${n}`] ?? null });
  }
  return readVerifyScript(workspace, templateRef); // justfile 任务体
}

// ---------- config 冻结闭包(3.1-①) ----------

/** runner token -> 该 runner 在 workspace 根的已知 config 文件族(缺席也入闭包,记 null) */
const RUNNER_CONFIG_FILES: Record<string, string[]> = {
  vitest: [
    ...expandExts("vitest.config", ["ts", "mts", "cts", "js", "mjs", "cjs"]),
    ...expandExts("vitest.workspace", ["ts", "mts", "cts", "js", "mjs", "cjs", "json"]),
    ...expandExts("vite.config", ["ts", "mts", "cts", "js", "mjs", "cjs"]) // vitest 无自身 config 时回落 vite.config
  ],
  vite: expandExts("vite.config", ["ts", "mts", "cts", "js", "mjs", "cjs"]),
  playwright: expandExts("playwright.config", ["ts", "mts", "cts", "js", "mjs", "cjs"]),
  jest: expandExts("jest.config", ["ts", "mts", "cts", "js", "mjs", "cjs", "json"]),
  mocha: [".mocharc.js", ".mocharc.cjs", ".mocharc.json", ".mocharc.yml", ".mocharc.yaml"],
  tsc: ["tsconfig.json"],
  eslint: [
    ...expandExts("eslint.config", ["ts", "mts", "cts", "js", "mjs", "cjs"]),
    ".eslintrc",
    ".eslintrc.json",
    ".eslintrc.js",
    ".eslintrc.cjs",
    ".eslintrc.yml",
    ".eslintrc.yaml"
  ],
  pytest: ["pytest.ini", "pyproject.toml", "setup.cfg", "conftest.py"],
  ruff: ["ruff.toml", ".ruff.toml", "pyproject.toml"]
};

function expandExts(stem: string, exts: string[]): string[] {
  return exts.map((e) => `${stem}.${e}`);
}

/** 路径 token 形态:相对路径 + 可执行/配置扩展名;排除锁文件、package.json 本体与构建产物目录 */
const PATH_TOKEN_RE = /^(?:\.\/)?[\w@](?:[\w@./-]*)\.(sh|bash|zsh|mjs|cjs|js|ts|mts|cts|py|json|ya?ml|toml|ini|cfg)$/;
const PATH_TOKEN_EXCLUDE_RE = /(^|\/)(package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|Cargo\.lock)$|(^|\/)(node_modules|dist|build|out|coverage|\.next)\//;
/** justfile 一层递归:pnpm/npm/yarn 调 package.json 脚本 */
const PKG_SCRIPT_CALL_RE = /\b(?:pnpm|npm|yarn)\s+(?:run\s+([\w:.-]+)|(test|lint|typecheck)\b)/g;

/** package.json 脚本三键闭包(pre/main/post;与 readFrozenVerifyBody 同构),脚本缺席返回 null */
function pkgScriptClosure(workspace: string, scriptName: string): string | null {
  const pkgPath = join(workspace, "package.json");
  if (!existsSync(pkgPath)) return null;
  let scripts: Record<string, string>;
  try {
    scripts = (JSON.parse(readFileSync(pkgPath, "utf8")) as { scripts?: Record<string, string> }).scripts ?? {};
  } catch {
    return null;
  }
  if (scripts[scriptName] === undefined) return null;
  return JSON.stringify({ pre: scripts[`pre${scriptName}`] ?? null, main: scripts[scriptName], post: scripts[`post${scriptName}`] ?? null });
}

/**
 * 从命令文本枚举 config 闭包键集(确定性:同文本同键集)。
 * 键三类:① runner config 文件(workspace 根相对路径);② 路径 token(相对路径);
 * ③ `package.json#scripts.<name>` 伪键(justfile 一层递归)。
 */
export function enumerateConfigClosureKeys(commandText: string): { files: string[]; pkgScripts: string[] } {
  const files = new Set<string>();
  const pkgScripts = new Set<string>();
  const tokens = commandText.split(/[\s;&|()<>"'`]+/).filter(Boolean);
  for (const tok of tokens) {
    const base = tok.split("/").pop() ?? tok;
    const fam = RUNNER_CONFIG_FILES[base];
    if (fam) for (const f of fam) files.add(f);
    if (PATH_TOKEN_RE.test(tok) && !PATH_TOKEN_EXCLUDE_RE.test(tok) && !tok.includes("..")) {
      files.add(normalize(tok));
    }
  }
  for (const m of commandText.matchAll(PKG_SCRIPT_CALL_RE)) {
    const name = m[1] ?? m[2];
    if (name) pkgScripts.add(name);
  }
  return { files: [...files].sort(), pkgScripts: [...pkgScripts].sort() };
}

/** 命令文本抽取:package_script 用原始脚本串(冻结体是 JSON 三键,runner 探测要吃原文);justfile 用任务体 */
function commandTextFor(workspace: string, templateRef: string): string {
  const [kind, name] = templateRef.split(":");
  if (kind === "package_script") {
    const pkg = JSON.parse(readFileSync(join(workspace, "package.json"), "utf8")) as { scripts?: Record<string, string> };
    const s = pkg.scripts ?? {};
    const n = name ?? "";
    return [s[`pre${n}`], s[n], s[`post${n}`]].filter((x): x is string => typeof x === "string").join("\n");
  }
  return readVerifyScript(workspace, templateRef);
}

/** config 闭包快照:对键集逐一取 digest(文件缺席/脚本缺席 = null,冻结后出现即漂移) */
export function snapshotConfigClosure(workspace: string, templateRef: string): Record<string, string | null> {
  const { files, pkgScripts } = enumerateConfigClosureKeys(commandTextFor(workspace, templateRef));
  const out: Record<string, string | null> = {};
  for (const rel of files) {
    const p = join(workspace, rel);
    out[rel] = existsSync(p) ? textDigest(readFileSync(p, "utf8")) : null;
  }
  for (const name of pkgScripts) {
    const closure = pkgScriptClosure(workspace, name);
    out[`package.json#scripts.${name}`] = closure === null ? null : textDigest(closure);
  }
  return out;
}

/** dispatch 冻结:登记项校验(白名单)+ 冻结 argv/digest + config 闭包;非登记项拒冻(不允许自由命令进 verify) */
export function freezeVerify(workspace: string, templateRef: string, registry: VerifyRegistry): FrozenVerify {
  if (!isRegisteredVerify(templateRef, registry)) {
    throw new Error(`verify not in whitelist (Brain cannot compose commands): ${templateRef}`);
  }
  const [kind, name] = templateRef.split(":");
  const argv = kind === "package_script" ? ["pnpm", "run", name as string] : ["just", name as string];
  return {
    templateRef,
    argv,
    scriptDigest: textDigest(readFrozenVerifyBody(workspace, templateRef)),
    configDigests: snapshotConfigClosure(workspace, templateRef)
  };
}

export type VerifyPrecheck =
  | { ok: true; argv: string[] }
  | { ok: false; kind: "content_drift"; templateRef: string; message: string }
  | { ok: false; kind: "read_error"; templateRef: string; message: string };

/** config 闭包重校:返回首个漂移键(改/删/新建均算),无漂移返回 null */
export function recheckConfigClosure(workspace: string, frozen: FrozenVerify): string | null {
  for (const [key, frozenDigest] of Object.entries(frozen.configDigests ?? {})) {
    let current: string | null;
    if (key.startsWith("package.json#scripts.")) {
      const closure = pkgScriptClosure(workspace, key.slice("package.json#scripts.".length));
      current = closure === null ? null : textDigest(closure);
    } else {
      const p = join(workspace, key);
      try {
        current = existsSync(p) ? textDigest(readFileSync(p, "utf8")) : null;
      } catch {
        return key; // 读失败按漂移处置(fail-closed)
      }
    }
    if (current !== frozenDigest) return key;
  }
  return null;
}

/**
 * 执行前重校(fail-closed):重读脚本、重算 digest,与冻结值比对;config 闭包同校(3.1-①)。
 * 不符 ⇒ content_drift(Plan Delta:调用方转 blocked 回叫,不静默执行漂移后的脚本)。
 * 诚实注记(Phase4 评审 B5):precheck 通过后由 pnpm/just **再次读盘**执行,两读之间存在
 * TOCTOU 窗口(agent 可在窗口内改回恶意内容)——本实现拦"合法 Plan Delta 漂移"与随意改动,
 * 不拦精确时序竞态;P1 收口方案 = 用已校验冻结正文经只读临时文件/stdin 直喂解释器执行。
 */
export function precheckVerify(workspace: string, frozen: FrozenVerify): VerifyPrecheck {
  let current: string;
  try {
    current = readFrozenVerifyBody(workspace, frozen.templateRef); // 与 freeze 同闭包(含 pre/post 键,A1)
  } catch (err) {
    return { ok: false, kind: "read_error", templateRef: frozen.templateRef, message: String(err).slice(0, 120) };
  }
  if (textDigest(current) !== frozen.scriptDigest) {
    return {
      ok: false,
      kind: "content_drift",
      templateRef: frozen.templateRef,
      message: "验证脚本在 dispatch 后被改动;需要你重新拍板才能用新的验证命令"
    };
  }
  const driftedConfig = recheckConfigClosure(workspace, frozen);
  if (driftedConfig !== null) {
    return {
      ok: false,
      kind: "content_drift",
      templateRef: frozen.templateRef,
      message: `验证配置文件在 dispatch 后被改动(${driftedConfig});需要你重新拍板才能用新的验证配置`
    };
  }
  return { ok: true, argv: frozen.argv };
}

/** Plan Delta 回叫话术载荷(04 §5.4;转 blocked 时用) */
export function planDeltaCallback(drift: Extract<VerifyPrecheck, { kind: "content_drift" }>): {
  reason: string;
  needsReapproval: true;
} {
  return { reason: `要改验证命令(${drift.templateRef}),需要你重新拍板`, needsReapproval: true };
}
