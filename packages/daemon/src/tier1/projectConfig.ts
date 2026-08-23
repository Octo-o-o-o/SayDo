// 项目层配置·执行器专属消费(执行器批;09 §11 <workspace>/.saydo/project.toml)。
// 只消费执行器需要的 [verify]/[setup] 两域——**生产全量加载已落 config/project.ts**(W1.3 清账:
// 白名单拒收留痕 + [git].protected 并集,接执行器认领/恢复链;budget/dnd/params 覆盖合并就绪)。
// 独立 schema,不复用全局 configSchema(config/types.ts 防踩注记:prefault 会注入 privacy 键,
// mergeConfig 白名单会恒误报)。project.toml 是"仓库随附的不可信输入":
// - [verify]:只登记模板引用(package_script/justfile),执行时经白名单 + 内容冻结,不直接跑;
// - [setup]:仓库自带任意命令 = 认领时 RCE 面——只接受包管理器 install 白名单形态,
//   且强制 --ignore-scripts(G4:lifecycle/postinstall 属供应链执行面);其余形态拒(处方化,owner 手动跑)。

import { readFileSync } from "node:fs";
import { isAbsolute, join, win32 } from "node:path";
import { parse as parseToml } from "smol-toml";
import { z } from "zod";
import type { VerifyRegistry } from "../policy/engine.js";

const projectTomlSchema = z.looseObject({
  verify: z
    .looseObject({
      entries: z
        .array(
          z.looseObject({
            name: z.string().min(1),
            source: z.enum(["package_script", "justfile"]),
            ref: z.string().min(1)
          })
        )
        .optional()
    })
    .optional(),
  setup: z.looseObject({ command: z.string().optional() }).optional(),
  // writing 窄版(09 §6.1a,W4):成稿文件相对路径(worktree 内);缺省 article.md
  writing: z.looseObject({ article_path: z.string().optional() }).optional()
});

export interface ProjectExecConfig {
  /** verify 白名单(freezeVerify 的 registry 输入;空 = 该仓未登记验证命令) */
  registry: VerifyRegistry;
  /** 登记的 verify 模板引用(templateRef 形态 "<source>:<ref>",按登记序) */
  verifyRefs: string[];
  /** setup argv(白名单形态 + 强制 --ignore-scripts);null = 未登记或形态被拒(拒因入 rejectedSetupReason) */
  setupArgv: string[] | null;
  rejectedSetupReason?: string;
  /** writing 窄版成稿文件相对路径(09 §6.1a;缺省 article.md) */
  writingArticlePath: string;
}

/** writing 成稿路径是 git tree path：两种平台分隔符都按目录边界解释，任何绝对/穿越/空段均拒。 */
export function normalizeWritingArticlePath(raw: string): string {
  if (raw === "" || raw.includes("\0") || isAbsolute(raw) || win32.isAbsolute(raw) || /^[A-Za-z]:/u.test(raw)) {
    throw new Error(`writing.article_path 必须是 worktree 内相对路径:${raw.slice(0, 80)}`);
  }
  const segments = raw.split(/[\\/]/u);
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error(`writing.article_path 含空段或路径穿越:${raw.slice(0, 80)}`);
  }
  return segments.join("/");
}

/** setup 白名单:仅包管理器 install 形态;强制 --ignore-scripts(已含则不重复) */
export function sanitizeSetupCommand(command: string): { argv: string[] } | { rejected: string } {
  const parts = command.trim().split(/\s+/);
  const [pm, verb] = parts;
  const okPm = pm === "pnpm" || pm === "npm" || pm === "yarn";
  const okVerb = verb === "install" || verb === "i" || verb === "ci";
  if (!okPm || !okVerb) {
    return { rejected: `setup 命令不在白名单(仅 pnpm/npm/yarn install 形态):${command.slice(0, 80)}` };
  }
  // 只允许安全旗标(离线偏好/锁定文件);其余旗标剥除,防 --unsafe-perm 类夹带
  const SAFE_FLAGS = new Set(["--prefer-offline", "--frozen-lockfile", "--no-fund", "--no-audit", "--offline"]);
  const flags = parts.slice(2).filter((f) => SAFE_FLAGS.has(f));
  return { argv: [pm as string, verb as string, ...flags, "--ignore-scripts"] };
}

/** 读 <repo>/.saydo/project.toml 的执行器子集;文件缺失 = 全空(合法);存在但坏 = 抛(fail-closed,认领方转 blocked) */
export function readProjectExecConfig(repoPath: string): ProjectExecConfig {
  let text: string;
  try {
    text = readFileSync(join(repoPath, ".saydo", "project.toml"), "utf8");
  } catch {
    return { registry: { packageScripts: [], justfileTasks: [] }, verifyRefs: [], setupArgv: null, writingArticlePath: "article.md" };
  }
  const parsed = projectTomlSchema.parse(parseToml(text));
  const entries = parsed.verify?.entries ?? [];
  const packageScripts = entries.filter((e) => e.source === "package_script").map((e) => e.ref);
  const justfileTasks = entries.filter((e) => e.source === "justfile").map((e) => e.ref);
  const verifyRefs = entries.map((e) => `${e.source}:${e.ref}`);
  const articlePathRaw = (parsed.writing as { article_path?: string } | undefined)?.article_path ?? "article.md";
  const writingArticlePath = normalizeWritingArticlePath(articlePathRaw);
  const out: ProjectExecConfig = {
    registry: { packageScripts, justfileTasks },
    verifyRefs,
    setupArgv: null,
    writingArticlePath
  };
  if (parsed.setup?.command) {
    const s = sanitizeSetupCommand(parsed.setup.command);
    if ("argv" in s) out.setupArgv = s.argv;
    else out.rejectedSetupReason = s.rejected;
  }
  return out;
}
