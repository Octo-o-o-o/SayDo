// docs/09 AS-01-AS-02 隐私批共享形状:凭据 kind/命中 digest、三类失败、Git 保护结果、脱敏元数据。
// schema 只含 kind 枚举;匹配规则在 CREDENTIAL_GRAMMAR / findCredentialLiteralSpans。
// 不得在此另造 BootstrapResult DTO。daemon 写路径必须 import 本文件的扫描函数,不得重写 grammar。

import { z } from "zod";
import { textDigest } from "../jcs.js";
import { digestSchema } from "./common.js";

/** 声明凭据 grammar 的 kind;不含长度/字符集。长度与匹配只看 CREDENTIAL_GRAMMAR。 */
export const credentialKindSchema = z.enum([
  "pem_private_key",
  "openai_sk",
  "github_ghp",
  "github_pat",
  "slack_xox",
  "aws_akia",
  "aws_asia"
]);
export type CredentialKind = z.infer<typeof credentialKindSchema>;

/** 公开错误码。foundation 预算 partial 不得复用这些码。 */
export const knowledgePrivacyErrorCodeSchema = z.enum([
  "memory_secret_literal",
  "foundation_build_restricted",
  "git_protection_insufficient"
]);
export type KnowledgePrivacyErrorCode = z.infer<typeof knowledgePrivacyErrorCodeSchema>;

/** 三类用户可区分失败。 */
export const knowledgePrivacyFailureClassSchema = z.enum([
  "memory_item_not_saved",
  "foundation_refresh_failed_kept_old",
  "foundation_first_build_unavailable"
]);
export type KnowledgePrivacyFailureClass = z.infer<typeof knowledgePrivacyFailureClassSchema>;

export const gitProtectionStatusSchema = z.enum([
  "not_git",
  "protected",
  "insufficient",
  "outside_root",
  "query_failed",
  "write_failed"
]);
export type GitProtectionStatus = z.infer<typeof gitProtectionStatusSchema>;

export const knowledgePrivacyPrescriptionSchema = z.enum([
  "remove_source_literal",
  "fix_git_ignore_or_untrack"
]);
export type KnowledgePrivacyPrescription = z.infer<typeof knowledgePrivacyPrescriptionSchema>;

/** 命中只记 kind + span digest,禁止携带原文。 */
export const credentialHitSchema = z.strictObject({
  kind: credentialKindSchema,
  spanDigest: digestSchema
});
export type CredentialHit = z.infer<typeof credentialHitSchema>;

export const knowledgePrivacyAuditMetaSchema = z.strictObject({
  kind: credentialKindSchema,
  spanDigest: digestSchema
});
export type KnowledgePrivacyAuditMeta = z.infer<typeof knowledgePrivacyAuditMetaSchema>;

/**
 * 声明支持的 rules 来源。仅 workspace 直系 `.cursor/rules/*.md|*.mdc`,不递归、不扫全仓、不扫 KEY_FILES。
 * 现 foundation.ts 对该目录 `readdirSync` 后对每个文件 `readFileSync` 再 slice(0,2000);本批合同禁止该无界读。
 * encodedSegment 只出现在安全表示里,不是磁盘子目录,也不是把文件改名为另一个文件。
 */
export const FOUNDATION_RULES_SOURCE = Object.freeze({
  relativeDir: ".cursor/rules",
  encodedSegment: "_enc",
  suffixes: [".md", ".mdc"] as const,
  recursive: false
});

export const RULE_DIRENT_NAME_MAX_BYTES = 255;

const FOUNDATION_RULES_DIR_PREFIX = `${FOUNDATION_RULES_SOURCE.relativeDir}/`;
const FOUNDATION_RULES_ENCODED_PREFIX = `${FOUNDATION_RULES_DIR_PREFIX}${FOUNDATION_RULES_SOURCE.encodedSegment}/`;

/**
 * identity 形式上界:len(".cursor/rules/") + POSIX NAME_MAX。
 * 取消未登记的 240。普通 rules 名仍按此显示。
 */
export const RELATIVE_SOURCE_IDENTITY_MAX = FOUNDATION_RULES_DIR_PREFIX.length + RULE_DIRENT_NAME_MAX_BYTES;

/**
 * safeHits relativeSource 上界 = 完整规则输入域安全表示的最长串。
 * identity 最长 RELATIVE_SOURCE_IDENTITY_MAX;
 * 非 identity 为 UTF-8 字节的百分号编码,最长 len(".cursor/rules/_enc/") + 3*NAME_MAX。
 */
export const RELATIVE_SOURCE_MAX = FOUNDATION_RULES_ENCODED_PREFIX.length + 3 * RULE_DIRENT_NAME_MAX_BYTES;

/**
 * 定位串控制字符 = Unicode Cc 封闭集:C0 U+0000..U+001F ∪ DEL U+007F ∪ C1 U+0080..U+009F。
 * 不含空格 U+0020、波浪号 U+007E、NBSP U+00A0,也不是 Cf/Zl/Zp 或开放 Unicode 类别扫描。
 */
export const RELATIVE_SOURCE_CONTROL_CHARS = Object.freeze({
  c0Min: 0x00,
  c0Max: 0x1f,
  del: 0x7f,
  c1Min: 0x80,
  c1Max: 0x9f
});

export function isRelativeSourceControlCodePoint(codePoint: number): boolean {
  const set = RELATIVE_SOURCE_CONTROL_CHARS;
  return (
    (codePoint >= set.c0Min && codePoint <= set.c0Max) ||
    codePoint === set.del ||
    (codePoint >= set.c1Min && codePoint <= set.c1Max)
  );
}

/**
 * 安全相对来源:POSIX `/` 分段相对路径,给 UI/审计元数据。
 * 拒:POSIX 绝对、Windows 盘符/盘符相对、UNC(`//` 或反斜杠)、`.`/`..`/空段、反斜杠、控制字符、超过 RELATIVE_SOURCE_MAX。
 * 控制字符见 RELATIVE_SOURCE_CONTROL_CHARS,不得只拒绝码点 < 32。
 * 不拒:文件名中的普通双点(`foo..bar.md`);`.cursor/rules/` + 255B 普通名的 identity 形式。
 * 本谓词校验定位串字母表,不负责把 POSIX 合法 rules 名映射成定位串;映射见 foundationRulesRelativeSource。
 * 本谓词是字符串合同,不是 Windows 真机实测。
 */
export function isSafeRelativeSource(value: string): boolean {
  if (value.length < 1 || value.length > RELATIVE_SOURCE_MAX) return false;
  if (value.includes("\\")) return false;
  for (let i = 0; i < value.length; i += 1) {
    if (isRelativeSourceControlCodePoint(value.charCodeAt(i))) return false;
  }
  if (value.startsWith("/")) return false;
  if (/^[A-Za-z]:/.test(value)) return false;
  const parts = value.split("/");
  for (const part of parts) {
    if (part === "" || part === "." || part === "..") return false;
  }
  return true;
}

const relativeSourceSchema = z.string().min(1).max(RELATIVE_SOURCE_MAX).refine(isSafeRelativeSource, {
  message: "relativeSource 必须是仓内 POSIX 相对路径,不得为绝对/盘符/UNC/穿越段"
});

/** 给现有 UI 的脱敏定位;不得含命中原文或完整本机路径。 */
export const knowledgePrivacySafeHitSchema = z.strictObject({
  relativeSource: relativeSourceSchema,
  line: z.number().int().positive().optional(),
  kind: credentialKindSchema,
  prescription: knowledgePrivacyPrescriptionSchema
});
export type KnowledgePrivacySafeHit = z.infer<typeof knowledgePrivacySafeHitSchema>;

export const gitProtectionResultSchema = z.strictObject({
  status: gitProtectionStatusSchema,
  relativeTarget: relativeSourceSchema.optional()
});
export type GitProtectionResult = z.infer<typeof gitProtectionResultSchema>;

/** 声明私有 write set(相对 workspace)。 */
export const PRIVATE_WRITE_SET = Object.freeze([".saydo/foundation/", ".saydo/knowledge/"] as const);

/**
 * 首次 raw staging 前必须扫描的落盘文档(组装后的 UTF-8,不是源文件全集)。
 * manifest 落 `.saydo/foundation/manifest-gen-N.json`;其余落 staging 后进入 knowledge/gen-N/。
 */
export const FOUNDATION_RAW_PERSIST_DOCS = Object.freeze([
  "core.md",
  "inventory.md",
  "build-test-run.md",
  "conventions.md",
  "manifest-gen-N.json"
] as const);

/** 实施必须从上述落盘文档消除原始绝对 workspace;不得把路径笼统当成凭据 kind。 */
export const FOUNDATION_OMIT_RAW_WORKSPACE = true;

const PK_LABEL = "PRIV" + "ATE KEY";

/**
 * 有限凭据 grammar。credentialKindSchema 不携带这些约束。
 * 前缀用拼接,避免源码出现完整凭据形态。不是无限语言 linter。
 */
export const CREDENTIAL_GRAMMAR = Object.freeze({
  bodyMin: 16,
  bodyMax: 256,
  awsBodyLen: 16,
  startBoundaryClass: "A-Za-z0-9_",
  openaiSkPrefix: "sk" + "-",
  openaiSkBodyClass: "A-Za-z0-9-",
  githubGhpPrefix: "ghp" + "_",
  githubGhpBodyClass: "A-Za-z0-9",
  githubPatPrefix: "github" + "_pat_",
  githubPatBodyClass: "A-Za-z0-9_",
  slackXoxPrefixReSource: "xox[baprs]-",
  slackXoxBodyClass: "A-Za-z0-9-",
  awsAkiaPrefix: "A" + "KIA",
  awsAsiaPrefix: "A" + "SIA",
  awsBodyClass: "0-9A-Z",
  pemBegin: "-----BEGIN ",
  pemLabel: PK_LABEL,
  pemEnd: "-----END ",
  pemLabelClass: "A-Z ",
  pemLabelMax: 40,
  pemInnerMax: 524288
});

/**
 * 明确占位夹具。仅当凭据命中跨度与该占位符整串起止相同才豁免。
 * 合法长 literal 仅含子串不得整段豁免。短于 bodyMin 的项即使不豁免也不构成命中。
 */
export const CREDENTIAL_PLACEHOLDERS = Object.freeze({
  skTest: "sk" + "-" + "test",
  ghpFixture: "ghp" + "_" + "fixture_not_a_real_secret"
});

/**
 * 有限引用豁免。独立出现时不作为凭据证据。
 * 一律完整覆盖语义,见 CREDENTIAL_EXEMPTION_SCOPE:仅当某豁免覆盖整段凭据跨度才跳过该命中。
 * 合法 ID 只覆盖 token 末尾、PEM 正文局部引用不得豁免。不按 PEM/token 分叉,不使用 any_overlap。
 */
export const CREDENTIAL_EXEMPTIONS = Object.freeze({
  envNameReSource: "env:[A-Z][A-Z0-9_]{0,63}",
  digestReSource: "sha256:[0-9a-fA-F]{64}",
  saydoIdReSource: "\\b[a-z]{2,4}_[0-9A-HJKMNP-TV-Z]{26}\\b",
  dollarBraceReSource: "\\$\\{[A-Za-z_][A-Za-z0-9_]{0,63}\\}",
  dollarNameReSource: "(?<![A-Za-z0-9_])\\$[A-Za-z_][A-Za-z0-9_]{0,63}\\b"
});

/** 所有凭据 kind 的豁免作用域:仅完整覆盖跨度才跳过。 */
export const CREDENTIAL_EXEMPTION_SCOPE = "covers_whole_span" as const;

/**
 * 成本上限。provenance 见 KNOWLEDGE_PRIVACY_LIMIT_SOURCE:
 * existing_read = 当前代码实读;engineering = 本批新设计约束;unmeasured = 现路径未设该上限。
 */
export const KNOWLEDGE_PRIVACY_LIMITS = Object.freeze({
  fileSizeLimitBytes: 512 * 1024,
  excerptLimitChars: 6_000,
  ruleFileExcerptChars: 2_000,
  ruleFileReadLimitBytes: 64 * 1024,
  ruleFileMaxCount: 16,
  ruleDirentMax: 32,
  ruleDirentNameMaxBytes: RULE_DIRENT_NAME_MAX_BYTES,
  ruleReaddirBufferMaxBytes: 4_096,
  ruleReadTotalBytes: 128 * 1024,
  keyFileNameCount: 11,
  maxScanCharsPerFoundationBuild: 512 * 1024,
  maxMemoryClaimChars: 512 * 1024,
  gitExistingBootstrapPeakSubsequentDirty: 8,
  gitExistingBootstrapPeakFirst: 11,
  gitExistingDuplicateRevParse: 2,
  gitProtectionQueryMaxPerBoundary: 5,
  gitSubprocessMaxPerBoundary: 16,
  gitTimeoutMs: 10_000,
  gitMaxBufferBytes: 1024 * 1024,
  maxReportedHits: 8,
  maxDedupeKeysPerFlow: 8,
  relativeSourceIdentityMaxChars: RELATIVE_SOURCE_IDENTITY_MAX,
  relativeSourceMaxChars: RELATIVE_SOURCE_MAX
});

export const KNOWLEDGE_PRIVACY_LIMIT_SOURCE = Object.freeze({
  fileSizeLimitBytes: "existing_read:foundation.ts FILE_SIZE_LIMIT; KEY_FILES only, oversized skip; not rules",
  excerptLimitChars: "existing_read:foundation.ts EXCERPT_LIMIT",
  ruleFileExcerptChars:
    "existing_read:foundation.ts conventions rules slice(0,2000); persist/scan slice AFTER a successful bounded read; NOT the disk-read bound",
  ruleFileReadLimitBytes:
    "engineering: per-file actual read cap for .cursor/rules; current path is unmeasured readFileSync of the whole file. not FILE_SIZE_LIMIT",
  ruleFileMaxCount: "engineering: accepted .md/.mdc files; current loop has no cap (unmeasured)",
  ruleDirentMax: "engineering: directory entries enumerated including non-md; current readdirSync is unbounded (unmeasured)",
  ruleDirentNameMaxBytes: "existing_read:POSIX NAME_MAX=255; string/byte contract, not a Windows MAX_PATH measurement",
  ruleReaddirBufferMaxBytes:
    "engineering: accumulated UTF-8 name bytes during opendir iteration; Node readdirSync has no maxBuffer (unmeasured)",
  ruleReadTotalBytes: "engineering: sum of stated sizes of accepted rules files actually read; not assembled-scan maxScanChars",
  keyFileNameCount: "existing_read:foundation.ts KEY_FILES.length",
  gitExistingBootstrapPeakSubsequentDirty:
    "existing_read:bootstrap 成功后续 dirty=workspace 5(ls-files + HEAD×2 + tree×2)+ knowledge add/status/commit 3",
  gitExistingBootstrapPeakFirst:
    "existing_read:首次 knowledge git=上述 workspace 5 + init/config/config/add/status/commit 6",
  gitExistingDuplicateRevParse: "existing_read:gitHead/gitTree 各调用两次",
  gitProtectionQueryMaxPerBoundary: "engineering:本批新增保护查询封闭集,不是旧 8 次的再贴标签",
  gitSubprocessMaxPerBoundary: "engineering:边界总数=现有峰值 11 + 新增保护 5,不得把 8+5 仍写成 8",
  gitTimeoutMs: "engineering:现 foundation.git() 无 timeout(unmeasured);本批新加 10000ms。不是回调 HTTP 超时",
  gitMaxBufferBytes: "existing_read:Node 22 execFileSync 缺省 maxBuffer=1MiB;本批显式传入并改为 overflow→query_failed",
  maxScanCharsPerFoundationBuild: "engineering:与 FILE_SIZE_LIMIT 同数字,不是同一变量",
  maxMemoryClaimChars: "engineering",
  maxReportedHits: "engineering:UI safeHits 条数。不是访谈问题预算",
  maxDedupeKeysPerFlow: "engineering:单流程去重键。不是访谈预算",
  relativeSourceIdentityMaxChars:
    "engineering: identity display of a plain rules name = len('.cursor/rules/') + ruleDirentNameMaxBytes; cancels unregistered 240",
  relativeSourceMaxChars:
    "engineering: safeHits relativeSource bound = len('.cursor/rules/_enc/') + 3*ruleDirentNameMaxBytes; covers percent-UTF-8 of the full rules name domain; identity form is shorter; declared rules sources must parse"
});

/** 本批新增保护查询;一律 `git -C <workspace>`。check-ignore exit 1=未忽略,不是 query_failed。 */
export const GIT_PROTECTION_QUERIES = Object.freeze([
  ["rev-parse", "--is-inside-work-tree"],
  ["check-ignore", "-v", "--", ".saydo/foundation/"],
  ["check-ignore", "-v", "--", ".saydo/knowledge/"],
  ["ls-files", "-z", "--", ".saydo/foundation/"],
  ["ls-files", "-z", "--", ".saydo/knowledge/"]
] as const);

export const RULES_READ_BOUND_REASONS = Object.freeze([
  "ok",
  "over_dirent_count",
  "over_dirent_name",
  "over_readdir_buffer",
  "over_file_count",
  "over_file_bytes",
  "over_read_total"
] as const);
export type RulesReadBoundReason = (typeof RULES_READ_BOUND_REASONS)[number];

export interface RulesDirentBoundInput {
  name: string;
  /** UTF-8 字节数。缺省按 name 计算。 */
  nameBytes?: number;
  /** 直系常规文件且后缀为 .md/.mdc。目录/symlink/其它后缀为 false,只计入枚举。 */
  isRulesFile: boolean;
  /** isRulesFile 时必填:stat size(先于任何文件内容读取)。 */
  sizeBytes?: number;
}

export interface RulesReadBoundResult {
  reason: RulesReadBoundReason;
  direntCount: number;
  readdirBufferBytes: number;
  acceptedFileCount: number;
  readTotalBytes: number;
}

export function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

export function isFoundationRulesFileName(name: string): boolean {
  if (name.length < 1) return false;
  if (name.includes("/") || name.includes("\0")) return false;
  return FOUNDATION_RULES_SOURCE.suffixes.some((suffix) => name.endsWith(suffix));
}

/**
 * 唯一 rules 读取上限入口。daemon 必须 import,不得另写循环上限。
 * `direntsInEnumOrder` = opendir 逐条顺序(尚未 sort);超界在该条发生时立即失败,不得先装入整个目录再检查。
 * 枚举通过后,对 isRulesFile 按 name 排序再逐个核 size;超单文件/数量/总量时不得读该文件内容。
 * 缺目录由调用方跳过,不走本函数。超界码 = foundation_build_restricted,首次 staging 前失败,旧 generation 不动。
 * 2000 字 excerpt 只在本函数 reason=ok 之后切片落盘,不能代替本读取上限。
 */
export function classifyRulesReadBound(
  direntsInEnumOrder: readonly RulesDirentBoundInput[]
): RulesReadBoundResult {
  const limits = KNOWLEDGE_PRIVACY_LIMITS;
  let direntCount = 0;
  let readdirBufferBytes = 0;
  const enumerated: RulesDirentBoundInput[] = [];

  for (const dirent of direntsInEnumOrder) {
    const nameBytes = dirent.nameBytes ?? utf8ByteLength(dirent.name);
    if (nameBytes > limits.ruleDirentNameMaxBytes) {
      return {
        reason: "over_dirent_name",
        direntCount,
        readdirBufferBytes,
        acceptedFileCount: 0,
        readTotalBytes: 0
      };
    }
    if (direntCount + 1 > limits.ruleDirentMax) {
      return {
        reason: "over_dirent_count",
        direntCount,
        readdirBufferBytes,
        acceptedFileCount: 0,
        readTotalBytes: 0
      };
    }
    if (readdirBufferBytes + nameBytes > limits.ruleReaddirBufferMaxBytes) {
      return {
        reason: "over_readdir_buffer",
        direntCount,
        readdirBufferBytes,
        acceptedFileCount: 0,
        readTotalBytes: 0
      };
    }
    direntCount += 1;
    readdirBufferBytes += nameBytes;
    enumerated.push(dirent);
  }

  const files = enumerated
    .filter((dirent) => dirent.isRulesFile)
    .slice()
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  let acceptedFileCount = 0;
  let readTotalBytes = 0;
  for (const file of files) {
    const size = file.sizeBytes;
    if (acceptedFileCount + 1 > limits.ruleFileMaxCount) {
      return {
        reason: "over_file_count",
        direntCount,
        readdirBufferBytes,
        acceptedFileCount,
        readTotalBytes
      };
    }
    if (size === undefined || size < 0 || size > limits.ruleFileReadLimitBytes) {
      return {
        reason: "over_file_bytes",
        direntCount,
        readdirBufferBytes,
        acceptedFileCount,
        readTotalBytes
      };
    }
    if (readTotalBytes + size > limits.ruleReadTotalBytes) {
      return {
        reason: "over_read_total",
        direntCount,
        readdirBufferBytes,
        acceptedFileCount,
        readTotalBytes
      };
    }
    acceptedFileCount += 1;
    readTotalBytes += size;
  }

  return {
    reason: "ok",
    direntCount,
    readdirBufferBytes,
    acceptedFileCount,
    readTotalBytes
  };
}

export interface CredentialLiteralSpan {
  kind: CredentialKind;
  start: number;
  end: number;
}

function collectRanges(text: string, reSource: string): Array<{ start: number; end: number }> {
  const re = new RegExp(reSource, "g");
  const out: Array<{ start: number; end: number }> = [];
  for (const match of text.matchAll(re)) {
    const start = match.index ?? 0;
    out.push({ start, end: start + match[0].length });
  }
  return out;
}

function overlaps(
  start: number,
  end: number,
  ranges: readonly { start: number; end: number }[]
): boolean {
  return ranges.some((range) => start < range.end && end > range.start);
}

function coversWholeSpan(
  start: number,
  end: number,
  ranges: readonly { start: number; end: number }[]
): boolean {
  return ranges.some((range) => range.start <= start && range.end >= end);
}

function isExactSpan(
  start: number,
  end: number,
  ranges: readonly { start: number; end: number }[]
): boolean {
  return ranges.some((range) => range.start === start && range.end === end);
}

function tokenRule(prefixSource: string, bodyClass: string, min: number, max: number, endClass: string): RegExp {
  const start = CREDENTIAL_GRAMMAR.startBoundaryClass;
  return new RegExp(
    `(?<![${start}])${prefixSource}[${bodyClass}]{${min},${max}}(?![${endClass}])`,
    "g"
  );
}

/**
 * 唯一扫描入口。先收集有限引用豁免,再按 PEM → 各 token 规则匹配,命中互不重叠(起点升序,长者优先)。
 * 豁免一律完整覆盖语义:仅当某豁免覆盖整段凭据跨度才跳过;PEM 内文局部引用与只覆盖 token 末尾的 ID 均保留命中。
 * 占位符仅整串等起止豁免。同形假 token 仍命中。路径不是凭据 kind。
 */
export function findCredentialLiteralSpans(text: string): CredentialLiteralSpan[] {
  const g = CREDENTIAL_GRAMMAR;
  const exempt: Array<{ start: number; end: number }> = [
    ...collectRanges(text, CREDENTIAL_EXEMPTIONS.envNameReSource),
    ...collectRanges(text, CREDENTIAL_EXEMPTIONS.digestReSource),
    ...collectRanges(text, CREDENTIAL_EXEMPTIONS.saydoIdReSource),
    ...collectRanges(text, CREDENTIAL_EXEMPTIONS.dollarBraceReSource),
    ...collectRanges(text, CREDENTIAL_EXEMPTIONS.dollarNameReSource)
  ];
  const placeholders: Array<{ start: number; end: number }> = [];
  for (const placeholder of Object.values(CREDENTIAL_PLACEHOLDERS)) {
    let from = 0;
    while (from <= text.length - placeholder.length) {
      const at = text.indexOf(placeholder, from);
      if (at < 0) break;
      placeholders.push({ start: at, end: at + placeholder.length });
      from = at + placeholder.length;
    }
  }

  // BEGIN/END 行尾五个连字符是标记,不计入 pemInnerMax。
  const pemRe = new RegExp(
    `${g.pemBegin}[${g.pemLabelClass}]{0,${g.pemLabelMax}}${g.pemLabel}-----[\\s\\S]{0,${g.pemInnerMax}}?${g.pemEnd}[${g.pemLabelClass}]{0,${g.pemLabelMax}}${g.pemLabel}-----`,
    "g"
  );
  const rules: Array<{ kind: CredentialKind; re: RegExp }> = [
    { kind: "pem_private_key", re: pemRe },
    {
      kind: "github_pat",
      re: tokenRule(g.githubPatPrefix, g.githubPatBodyClass, g.bodyMin, g.bodyMax, g.githubPatBodyClass)
    },
    {
      kind: "openai_sk",
      re: tokenRule(g.openaiSkPrefix, g.openaiSkBodyClass, g.bodyMin, g.bodyMax, g.openaiSkBodyClass)
    },
    {
      kind: "github_ghp",
      re: tokenRule(g.githubGhpPrefix, g.githubGhpBodyClass, g.bodyMin, g.bodyMax, g.githubGhpBodyClass)
    },
    {
      kind: "slack_xox",
      re: tokenRule(g.slackXoxPrefixReSource, g.slackXoxBodyClass, g.bodyMin, g.bodyMax, g.slackXoxBodyClass)
    },
    {
      kind: "aws_akia",
      re: tokenRule(g.awsAkiaPrefix, g.awsBodyClass, g.awsBodyLen, g.awsBodyLen, g.startBoundaryClass)
    },
    {
      kind: "aws_asia",
      re: tokenRule(g.awsAsiaPrefix, g.awsBodyClass, g.awsBodyLen, g.awsBodyLen, g.startBoundaryClass)
    }
  ];

  const candidates: CredentialLiteralSpan[] = [];
  for (const rule of rules) {
    for (const match of text.matchAll(rule.re)) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      if (coversWholeSpan(start, end, exempt)) continue;
      if (isExactSpan(start, end, placeholders)) continue;
      candidates.push({ kind: rule.kind, start, end });
    }
  }
  candidates.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
  const accepted: CredentialLiteralSpan[] = [];
  for (const span of candidates) {
    if (overlaps(span.start, span.end, accepted)) continue;
    accepted.push(span);
  }
  return accepted;
}

export function findCredentialLiterals(text: string): CredentialHit[] {
  return findCredentialLiteralSpans(text).map((span) => ({
    kind: span.kind,
    spanDigest: textDigest(text.slice(span.start, span.end))
  }));
}

const PERCENT_HEX = /^[0-9A-F]{2}$/;

function percentEncodeUtf8Bytes(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let out = "";
  for (const byte of bytes) {
    out += `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
  }
  return out;
}

function percentDecodeUtf8Bytes(encoded: string): string | undefined {
  if (encoded.length === 0 || encoded.length % 3 !== 0) return undefined;
  const bytes = new Uint8Array(encoded.length / 3);
  for (let i = 0; i < encoded.length; i += 3) {
    if (encoded.charCodeAt(i) !== 37) return undefined;
    const hex = encoded.slice(i + 1, i + 3);
    if (!PERCENT_HEX.test(hex)) return undefined;
    bytes[i / 3] = Number.parseInt(hex, 16);
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
}

function rulesIdentitySource(name: string): string {
  return `${FOUNDATION_RULES_DIR_PREFIX}${name}`;
}

/**
 * 普通定位名:直系 rules 文件名、无声明凭据跨度、identity 串已通过 isSafeRelativeSource。
 * 这类名字在 UI/审计里保持原文相对路径,兼容现有 `.cursor/rules/demo.md`。
 */
function isPlainRulesLocatorName(name: string): boolean {
  if (!isFoundationRulesFileName(name)) return false;
  if (findCredentialLiteralSpans(name).length > 0) return false;
  return isSafeRelativeSource(rulesIdentitySource(name));
}

/**
 * 声明支持的 rules 完整相对来源。daemon/UI 必须用此得到 safeHits 定位,不得另写前缀,不得把 dirent 原文拼进 schema。
 * 关系:plain 名 → identity;其余名 → `.cursor/rules/_enc/` + 全字节百分号编码。
 * 全生产消费者共享;逆映射见 decodeFoundationRulesRelativeSource。
 */
export function foundationRulesRelativeSource(name: string): string {
  if (isPlainRulesLocatorName(name)) return rulesIdentitySource(name);
  return `${FOUNDATION_RULES_ENCODED_PREFIX}${percentEncodeUtf8Bytes(name)}`;
}

/**
 * 安全表示的逆映射。只接受 foundationRulesRelativeSource 会产出的那一种形式;
 * identity 与编码形式对同一文件互斥,因此不会把文件名规范化成另一个文件。
 */
export function decodeFoundationRulesRelativeSource(source: string): string | undefined {
  if (source.startsWith(FOUNDATION_RULES_ENCODED_PREFIX)) {
    const encoded = source.slice(FOUNDATION_RULES_ENCODED_PREFIX.length);
    if (encoded.includes("/")) return undefined;
    const name = percentDecodeUtf8Bytes(encoded);
    if (name === undefined || isPlainRulesLocatorName(name)) return undefined;
    if (!isFoundationRulesFileName(name)) return undefined;
    return name;
  }
  if (!source.startsWith(FOUNDATION_RULES_DIR_PREFIX)) return undefined;
  const name = source.slice(FOUNDATION_RULES_DIR_PREFIX.length);
  if (name.includes("/")) return undefined;
  if (!isPlainRulesLocatorName(name)) return undefined;
  return name;
}
