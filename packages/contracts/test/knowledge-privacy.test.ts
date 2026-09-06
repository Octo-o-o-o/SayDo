import { describe, expect, it } from "vitest";
import {
  CREDENTIAL_EXEMPTION_SCOPE,
  CREDENTIAL_EXEMPTIONS,
  CREDENTIAL_GRAMMAR,
  CREDENTIAL_PLACEHOLDERS,
  FOUNDATION_OMIT_RAW_WORKSPACE,
  FOUNDATION_RAW_PERSIST_DOCS,
  FOUNDATION_RULES_SOURCE,
  GIT_PROTECTION_QUERIES,
  KNOWLEDGE_PRIVACY_LIMITS,
  KNOWLEDGE_PRIVACY_LIMIT_SOURCE,
  PRIVATE_WRITE_SET,
  RELATIVE_SOURCE_CONTROL_CHARS,
  RELATIVE_SOURCE_IDENTITY_MAX,
  RELATIVE_SOURCE_MAX,
  classifyRulesReadBound,
  credentialHitSchema,
  credentialKindSchema,
  type CredentialKind,
  decodeFoundationRulesRelativeSource,
  findCredentialLiteralSpans,
  foundationRulesRelativeSource,
  gitProtectionResultSchema,
  isFoundationRulesFileName,
  isRelativeSourceControlCodePoint,
  isSafeRelativeSource,
  knowledgePrivacyAuditMetaSchema,
  knowledgePrivacyErrorCodeSchema,
  knowledgePrivacyFailureClassSchema,
  knowledgePrivacySafeHitSchema,
  utf8ByteLength
} from "../src/types/knowledgePrivacy.js";

const DIGEST = "sha256:" + "a".repeat(64);
const BODY16 = "a".repeat(CREDENTIAL_GRAMMAR.bodyMin);
const BODY15 = "a".repeat(CREDENTIAL_GRAMMAR.bodyMin - 1);
const AWS16 = "A".repeat(CREDENTIAL_GRAMMAR.awsBodyLen);

describe("knowledgePrivacy schema", () => {
  it("接受声明 kind 与错误码,拒绝词表外与第二套码", () => {
    expect(credentialKindSchema.safeParse("github_ghp").success).toBe(true);
    expect(credentialKindSchema.safeParse("env_name").success).toBe(false);
    expect(knowledgePrivacyErrorCodeSchema.safeParse("memory_secret_literal").success).toBe(true);
    expect(knowledgePrivacyErrorCodeSchema.safeParse("foundation_partial").success).toBe(false);
    expect(knowledgePrivacyFailureClassSchema.safeParse("foundation_refresh_failed_kept_old").success).toBe(true);
    expect(knowledgePrivacyFailureClassSchema.safeParse("success_with_warning").success).toBe(false);
  });

  it("命中与审计元数据只允许 kind+digest,拒绝原文槽", () => {
    expect(credentialHitSchema.safeParse({ kind: "openai_sk", spanDigest: DIGEST }).success).toBe(true);
    expect(credentialHitSchema.safeParse({ kind: "openai_sk", spanDigest: DIGEST, literal: "x" }).success).toBe(false);
    expect(knowledgePrivacyAuditMetaSchema.safeParse({ kind: "aws_akia", spanDigest: DIGEST }).success).toBe(true);
    expect(knowledgePrivacyAuditMetaSchema.safeParse({ kind: "aws_akia", spanDigest: DIGEST, claim: "x" }).success).toBe(
      false
    );
  });

  it("安全相对来源接受仓内路径与文件名双点,拒绝绝对/盘符/UNC/穿越", () => {
    expect(
      knowledgePrivacySafeHitSchema.safeParse({
        relativeSource: ".cursor/rules/demo.md",
        line: 3,
        kind: "pem_private_key",
        prescription: "remove_source_literal"
      }).success
    ).toBe(true);
    expect(isSafeRelativeSource("rules/foo..bar.md")).toBe(true);
    expect(isSafeRelativeSource(".saydo/foundation/core.md")).toBe(true);
    expect(isSafeRelativeSource("/tmp/outside.md")).toBe(false);
    expect(isSafeRelativeSource("../secret.env")).toBe(false);
    expect(isSafeRelativeSource("foo/../../etc/passwd")).toBe(false);
    expect(isSafeRelativeSource("C:/windows/secret.env")).toBe(false);
    expect(isSafeRelativeSource(["C:", "/Use", "rs/alice/secret.env"].join(""))).toBe(false);
    expect(isSafeRelativeSource("C:secret.env")).toBe(false);
    expect(isSafeRelativeSource("//fileserver/share/secret.env")).toBe(false);
    expect(isSafeRelativeSource("rules\\win.env")).toBe(false);
    expect(
      knowledgePrivacySafeHitSchema.safeParse({
        relativeSource: "C:/windows/secret.env",
        kind: "openai_sk",
        prescription: "remove_source_literal"
      }).success
    ).toBe(false);
    expect(
      knowledgePrivacySafeHitSchema.safeParse({
        relativeSource: "rules/foo..bar.md",
        kind: "openai_sk",
        prescription: "remove_source_literal"
      }).success
    ).toBe(true);
    expect(gitProtectionResultSchema.safeParse({ status: "not_git" }).success).toBe(true);
    expect(gitProtectionResultSchema.safeParse({ status: "shared_ok" }).success).toBe(false);
  });

  it("声明支持的 rules 完整相对来源可进 safeHits,不因未登记 240 拒绝合法名", () => {
    expect(RELATIVE_SOURCE_IDENTITY_MAX).toBe(KNOWLEDGE_PRIVACY_LIMITS.relativeSourceIdentityMaxChars);
    expect(RELATIVE_SOURCE_MAX).toBe(KNOWLEDGE_PRIVACY_LIMITS.relativeSourceMaxChars);
    expect(RELATIVE_SOURCE_IDENTITY_MAX).toBe(
      FOUNDATION_RULES_SOURCE.relativeDir.length + 1 + KNOWLEDGE_PRIVACY_LIMITS.ruleDirentNameMaxBytes
    );
    expect(RELATIVE_SOURCE_MAX).toBe(
      FOUNDATION_RULES_SOURCE.relativeDir.length +
        1 +
        FOUNDATION_RULES_SOURCE.encodedSegment.length +
        1 +
        3 * KNOWLEDGE_PRIVACY_LIMITS.ruleDirentNameMaxBytes
    );
    expect(foundationRulesRelativeSource("demo.md")).toBe(".cursor/rules/demo.md");

    const name227 = `${"a".repeat(224)}.md`;
    expect(utf8ByteLength(name227)).toBe(227);
    const source241 = foundationRulesRelativeSource(name227);
    expect(source241.length).toBe(241);
    expect(classifyRulesReadBound([{ name: name227, isRulesFile: true, sizeBytes: 100 }]).reason).toBe("ok");
    expect(isSafeRelativeSource(source241)).toBe(true);
    expect(
      knowledgePrivacySafeHitSchema.safeParse({
        relativeSource: source241,
        line: 1,
        kind: "openai_sk",
        prescription: "remove_source_literal"
      }).success
    ).toBe(true);

    const name255 = `${"n".repeat(252)}.md`;
    expect(utf8ByteLength(name255)).toBe(255);
    const sourceIdentityMax = foundationRulesRelativeSource(name255);
    expect(sourceIdentityMax.length).toBe(RELATIVE_SOURCE_IDENTITY_MAX);
    expect(classifyRulesReadBound([{ name: name255, isRulesFile: true, sizeBytes: 100 }]).reason).toBe("ok");
    expect(isSafeRelativeSource(sourceIdentityMax)).toBe(true);
    expect(
      knowledgePrivacySafeHitSchema.safeParse({
        relativeSource: sourceIdentityMax,
        kind: "openai_sk",
        prescription: "remove_source_literal"
      }).success
    ).toBe(true);

    const overBound = "n".repeat(RELATIVE_SOURCE_MAX + 1);
    expect(overBound.length).toBe(RELATIVE_SOURCE_MAX + 1);
    expect(isSafeRelativeSource(overBound)).toBe(false);
    expect(
      knowledgePrivacySafeHitSchema.safeParse({
        relativeSource: overBound,
        kind: "openai_sk",
        prescription: "remove_source_literal"
      }).success
    ).toBe(false);
  });
});

function parsesSafeHit(relativeSource: string): boolean {
  return knowledgePrivacySafeHitSchema.safeParse({
    relativeSource,
    kind: "openai_sk",
    prescription: "remove_source_literal"
  }).success;
}

function locatorContainsDeclaredControl(locator: string): boolean {
  for (let i = 0; i < locator.length; i += 1) {
    const cp = locator.charCodeAt(i);
    if (cp <= 0x1f || cp === 0x7f || (cp >= 0x80 && cp <= 0x9f)) return true;
  }
  return false;
}

describe("rules 安全表示关系覆盖声明 grammar", () => {
  it("普通名保持原文相对路径,与现有显示兼容", () => {
    expect(foundationRulesRelativeSource("demo.md")).toBe(".cursor/rules/demo.md");
    expect(foundationRulesRelativeSource("foo..bar.md")).toBe(".cursor/rules/foo..bar.md");
    expect(decodeFoundationRulesRelativeSource(".cursor/rules/demo.md")).toBe("demo.md");
    expect(decodeFoundationRulesRelativeSource(".cursor/rules/foo..bar.md")).toBe("foo..bar.md");
    expect(parsesSafeHit(".cursor/rules/demo.md")).toBe(true);
  });

  it("反斜杠与控制字符进入安全定位,不把文件改成另一个文件", () => {
    const slashName = ["a", "b.md"].join("\\");
    expect(isFoundationRulesFileName(slashName)).toBe(true);
    expect(classifyRulesReadBound([{ name: slashName, isRulesFile: true, sizeBytes: 100 }]).reason).toBe("ok");
    expect(isSafeRelativeSource(`.cursor/rules/${slashName}`)).toBe(false);
    const slashLoc = foundationRulesRelativeSource(slashName);
    expect(slashLoc.includes("\\")).toBe(false);
    expect(isSafeRelativeSource(slashLoc)).toBe(true);
    expect(parsesSafeHit(slashLoc)).toBe(true);
    expect(decodeFoundationRulesRelativeSource(slashLoc)).toBe(slashName);
    expect(slashLoc).not.toBe(foundationRulesRelativeSource("ab.md"));
    expect(slashLoc).not.toBe(foundationRulesRelativeSource("a%5Cb.md"));
    expect(decodeFoundationRulesRelativeSource(foundationRulesRelativeSource("a%5Cb.md"))).toBe("a%5Cb.md");

    const controlName = `a${String.fromCharCode(1)}b.md`;
    expect(isFoundationRulesFileName(controlName)).toBe(true);
    expect(classifyRulesReadBound([{ name: controlName, isRulesFile: true, sizeBytes: 40 }]).reason).toBe("ok");
    expect(isSafeRelativeSource(`.cursor/rules/${controlName}`)).toBe(false);
    const controlLoc = foundationRulesRelativeSource(controlName);
    expect(controlLoc.includes(String.fromCharCode(1))).toBe(false);
    expect(locatorContainsDeclaredControl(controlLoc)).toBe(false);
    expect(parsesSafeHit(controlLoc)).toBe(true);
    expect(decodeFoundationRulesRelativeSource(controlLoc)).toBe(controlName);
    expect(controlLoc).not.toBe(foundationRulesRelativeSource("ab.md"));
  });

  it("控制字符封闭集边界进入安全定位,普通名保持 identity", () => {
    expect(RELATIVE_SOURCE_CONTROL_CHARS).toEqual({
      c0Min: 0x00,
      c0Max: 0x1f,
      del: 0x7f,
      c1Min: 0x80,
      c1Max: 0x9f
    });
    expect(isRelativeSourceControlCodePoint(0x00)).toBe(true);
    expect(isRelativeSourceControlCodePoint(0x1f)).toBe(true);
    expect(isRelativeSourceControlCodePoint(0x20)).toBe(false);
    expect(isRelativeSourceControlCodePoint(0x7e)).toBe(false);
    expect(isRelativeSourceControlCodePoint(0x7f)).toBe(true);
    expect(isRelativeSourceControlCodePoint(0x80)).toBe(true);
    expect(isRelativeSourceControlCodePoint(0x9f)).toBe(true);
    expect(isRelativeSourceControlCodePoint(0xa0)).toBe(false);

    const nulName = `a${String.fromCharCode(0)}b.md`;
    expect(isFoundationRulesFileName(nulName)).toBe(false);

    const inSet = [0x01, 0x1f, 0x7f, 0x80, 0x9f] as const;
    for (const cp of inSet) {
      const ch = String.fromCharCode(cp);
      const name = `a${ch}b.md`;
      expect(isFoundationRulesFileName(name)).toBe(true);
      expect(classifyRulesReadBound([{ name, isRulesFile: true, sizeBytes: 40 }]).reason).toBe("ok");
      const identity = `.cursor/rules/${name}`;
      expect(isSafeRelativeSource(identity)).toBe(false);
      expect(parsesSafeHit(identity)).toBe(false);
      const loc = foundationRulesRelativeSource(name);
      expect(loc.includes(ch)).toBe(false);
      expect(locatorContainsDeclaredControl(loc)).toBe(false);
      expect(loc.startsWith(".cursor/rules/_enc/")).toBe(true);
      expect(isSafeRelativeSource(loc)).toBe(true);
      expect(parsesSafeHit(loc)).toBe(true);
      expect(decodeFoundationRulesRelativeSource(loc)).toBe(name);
      expect(loc).not.toBe(foundationRulesRelativeSource("ab.md"));
      expect(findCredentialLiteralSpans(loc)).toEqual([]);
    }

    const plainKeep = [
      { cp: 0x20, label: "space" },
      { cp: 0x7e, label: "tilde" },
      { cp: 0xa0, label: "nbsp" }
    ] as const;
    for (const { cp } of plainKeep) {
      const name = `a${String.fromCharCode(cp)}b.md`;
      expect(isFoundationRulesFileName(name)).toBe(true);
      const identity = `.cursor/rules/${name}`;
      expect(isSafeRelativeSource(identity)).toBe(true);
      expect(foundationRulesRelativeSource(name)).toBe(identity);
      expect(parsesSafeHit(identity)).toBe(true);
      expect(decodeFoundationRulesRelativeSource(identity)).toBe(name);
    }
  });

  it("最大字节边界的 identity 与编码形式都落在声明上界内", () => {
    const plainMax = `${"n".repeat(KNOWLEDGE_PRIVACY_LIMITS.ruleDirentNameMaxBytes - 3)}.md`;
    expect(utf8ByteLength(plainMax)).toBe(KNOWLEDGE_PRIVACY_LIMITS.ruleDirentNameMaxBytes);
    expect(classifyRulesReadBound([{ name: plainMax, isRulesFile: true, sizeBytes: 100 }]).reason).toBe("ok");
    const plainLoc = foundationRulesRelativeSource(plainMax);
    expect(plainLoc.length).toBe(RELATIVE_SOURCE_IDENTITY_MAX);
    expect(plainLoc.length).toBeLessThanOrEqual(RELATIVE_SOURCE_MAX);
    expect(parsesSafeHit(plainLoc)).toBe(true);
    expect(decodeFoundationRulesRelativeSource(plainLoc)).toBe(plainMax);

    const encodedMax = `${"\\".repeat(KNOWLEDGE_PRIVACY_LIMITS.ruleDirentNameMaxBytes - 3)}.md`;
    expect(utf8ByteLength(encodedMax)).toBe(KNOWLEDGE_PRIVACY_LIMITS.ruleDirentNameMaxBytes);
    expect(isFoundationRulesFileName(encodedMax)).toBe(true);
    expect(classifyRulesReadBound([{ name: encodedMax, isRulesFile: true, sizeBytes: 100 }]).reason).toBe("ok");
    const encodedLoc = foundationRulesRelativeSource(encodedMax);
    expect(encodedLoc.includes("\\")).toBe(false);
    expect(encodedLoc.length).toBe(RELATIVE_SOURCE_MAX);
    expect(parsesSafeHit(encodedLoc)).toBe(true);
    expect(decodeFoundationRulesRelativeSource(encodedLoc)).toBe(encodedMax);
    expect(isSafeRelativeSource(`${encodedLoc}x`)).toBe(false);

    const overName = `${"n".repeat(KNOWLEDGE_PRIVACY_LIMITS.ruleDirentNameMaxBytes - 2)}.md`;
    expect(utf8ByteLength(overName)).toBe(KNOWLEDGE_PRIVACY_LIMITS.ruleDirentNameMaxBytes + 1);
    expect(classifyRulesReadBound([{ name: overName, isRulesFile: true, sizeBytes: 100 }]).reason).toBe("over_dirent_name");
  });

  it("文件名中的凭据字面量不出现在安全定位里", () => {
    const token = CREDENTIAL_GRAMMAR.openaiSkPrefix + "A".repeat(CREDENTIAL_GRAMMAR.bodyMin);
    const name = `${token}.md`;
    expect(isFoundationRulesFileName(name)).toBe(true);
    expect(findCredentialLiteralSpans(name).map((span) => span.kind)).toEqual(["openai_sk"]);
    expect(classifyRulesReadBound([{ name, isRulesFile: true, sizeBytes: 80 }]).reason).toBe("ok");
    const loc = foundationRulesRelativeSource(name);
    expect(loc.includes(token)).toBe(false);
    expect(findCredentialLiteralSpans(loc)).toEqual([]);
    expect(parsesSafeHit(loc)).toBe(true);
    expect(decodeFoundationRulesRelativeSource(loc)).toBe(name);
    expect(isSafeRelativeSource(`.cursor/rules/${name}`)).toBe(true);
    expect(`.cursor/rules/${name}`.includes(token)).toBe(true);
  });
});

describe("knowledgePrivacy frozen grammar and limits", () => {
  it("凭据 grammar 有字符集/边界/长度,kind schema 不含长度", () => {
    expect(credentialKindSchema.safeParse("openai_sk").success).toBe(true);
    expect(credentialKindSchema.safeParse("16").success).toBe(false);
    expect(CREDENTIAL_GRAMMAR.bodyMin).toBe(16);
    expect(CREDENTIAL_GRAMMAR.bodyMax).toBe(256);
    expect(CREDENTIAL_GRAMMAR.awsBodyLen).toBe(16);
    expect(CREDENTIAL_GRAMMAR.openaiSkPrefix).toBe(["sk", "-"].join(""));
    expect(CREDENTIAL_GRAMMAR.githubGhpPrefix).toBe(["ghp", "_"].join(""));
    expect(CREDENTIAL_GRAMMAR.openaiSkBodyClass).toBe("A-Za-z0-9-");
    expect(CREDENTIAL_GRAMMAR.githubGhpBodyClass).toBe("A-Za-z0-9");
    expect(CREDENTIAL_GRAMMAR.githubPatBodyClass).toBe("A-Za-z0-9_");
    expect(CREDENTIAL_GRAMMAR.slackXoxBodyClass).toBe("A-Za-z0-9-");
    expect(CREDENTIAL_GRAMMAR.pemInnerMax).toBe(524288);
    expect(CREDENTIAL_GRAMMAR.pemLabel.endsWith("-".repeat(5))).toBe(false);
    expect(CREDENTIAL_PLACEHOLDERS.skTest.length).toBeLessThan(3 + CREDENTIAL_GRAMMAR.bodyMin);
    expect(PRIVATE_WRITE_SET).toEqual([".saydo/foundation/", ".saydo/knowledge/"]);
    expect(FOUNDATION_OMIT_RAW_WORKSPACE).toBe(true);
    expect(FOUNDATION_RAW_PERSIST_DOCS).toEqual([
      "core.md",
      "inventory.md",
      "build-test-run.md",
      "conventions.md",
      "manifest-gen-N.json"
    ]);
  });

  it("成本上限区分现有实读与本批工程选择,删除无关来源", () => {
    expect(KNOWLEDGE_PRIVACY_LIMITS.fileSizeLimitBytes).toBe(512 * 1024);
    expect(KNOWLEDGE_PRIVACY_LIMITS.excerptLimitChars).toBe(6000);
    expect(KNOWLEDGE_PRIVACY_LIMITS.ruleFileExcerptChars).toBe(2000);
    expect(KNOWLEDGE_PRIVACY_LIMITS.ruleFileReadLimitBytes).toBe(64 * 1024);
    expect(KNOWLEDGE_PRIVACY_LIMITS.ruleFileMaxCount).toBe(16);
    expect(KNOWLEDGE_PRIVACY_LIMITS.ruleDirentMax).toBe(32);
    expect(KNOWLEDGE_PRIVACY_LIMITS.ruleDirentNameMaxBytes).toBe(255);
    expect(KNOWLEDGE_PRIVACY_LIMITS.ruleReaddirBufferMaxBytes).toBe(4096);
    expect(KNOWLEDGE_PRIVACY_LIMITS.ruleReadTotalBytes).toBe(128 * 1024);
    expect(KNOWLEDGE_PRIVACY_LIMITS.ruleFileReadLimitBytes).not.toBe(KNOWLEDGE_PRIVACY_LIMITS.fileSizeLimitBytes);
    expect(KNOWLEDGE_PRIVACY_LIMITS.ruleFileExcerptChars).not.toBe(KNOWLEDGE_PRIVACY_LIMITS.ruleFileReadLimitBytes);
    expect(KNOWLEDGE_PRIVACY_LIMITS.keyFileNameCount).toBe(11);
    expect(KNOWLEDGE_PRIVACY_LIMITS.gitExistingBootstrapPeakSubsequentDirty).toBe(8);
    expect(KNOWLEDGE_PRIVACY_LIMITS.gitExistingBootstrapPeakFirst).toBe(11);
    expect(KNOWLEDGE_PRIVACY_LIMITS.gitProtectionQueryMaxPerBoundary).toBe(5);
    expect(KNOWLEDGE_PRIVACY_LIMITS.gitSubprocessMaxPerBoundary).toBe(16);
    expect(KNOWLEDGE_PRIVACY_LIMITS.gitTimeoutMs).toBe(10_000);
    expect(KNOWLEDGE_PRIVACY_LIMITS.gitMaxBufferBytes).toBe(1024 * 1024);
    expect(KNOWLEDGE_PRIVACY_LIMITS.maxReportedHits).toBe(8);
    expect(KNOWLEDGE_PRIVACY_LIMITS.relativeSourceIdentityMaxChars).toBe(269);
    expect(KNOWLEDGE_PRIVACY_LIMITS.relativeSourceMaxChars).toBe(784);
    expect(KNOWLEDGE_PRIVACY_LIMIT_SOURCE.relativeSourceIdentityMaxChars.includes("unregistered 240")).toBe(true);
    expect(KNOWLEDGE_PRIVACY_LIMIT_SOURCE.relativeSourceMaxChars.includes("3*ruleDirentNameMaxBytes")).toBe(true);
    expect(GIT_PROTECTION_QUERIES).toHaveLength(5);
    expect(KNOWLEDGE_PRIVACY_LIMIT_SOURCE.gitTimeoutMs.includes("ntfy")).toBe(false);
    expect(KNOWLEDGE_PRIVACY_LIMIT_SOURCE.gitTimeoutMs.includes("回调 HTTP")).toBe(true);
    expect(KNOWLEDGE_PRIVACY_LIMIT_SOURCE.maxReportedHits.includes("interview_question_budget")).toBe(false);
    expect(KNOWLEDGE_PRIVACY_LIMIT_SOURCE.maxReportedHits.includes("访谈")).toBe(true);
    expect(KNOWLEDGE_PRIVACY_LIMIT_SOURCE.gitSubprocessMaxPerBoundary.includes("11")).toBe(true);
    expect(KNOWLEDGE_PRIVACY_LIMIT_SOURCE.ruleFileExcerptChars.includes("NOT the disk-read bound")).toBe(true);
    expect(KNOWLEDGE_PRIVACY_LIMIT_SOURCE.ruleFileReadLimitBytes.includes("not FILE_SIZE_LIMIT")).toBe(true);
    expect(KNOWLEDGE_PRIVACY_LIMIT_SOURCE.fileSizeLimitBytes.includes("KEY_FILES only")).toBe(true);
    expect(FOUNDATION_RULES_SOURCE).toEqual({
      relativeDir: ".cursor/rules",
      encodedSegment: "_enc",
      suffixes: [".md", ".mdc"],
      recursive: false
    });
    expect(isFoundationRulesFileName("demo.md")).toBe(true);
    expect(isFoundationRulesFileName("demo.mdc")).toBe(true);
    expect(isFoundationRulesFileName("demo.txt")).toBe(false);
    expect(isFoundationRulesFileName("a\\b.md")).toBe(true);
    expect(isFoundationRulesFileName("foo/bar.md")).toBe(false);
    expect(isFoundationRulesFileName("a\0.md")).toBe(false);
  });
});

describe("classifyRulesReadBound 三类边界", () => {
  const L = KNOWLEDGE_PRIVACY_LIMITS;
  const md = (name: string, sizeBytes: number) => ({
    name,
    isRulesFile: true as const,
    sizeBytes
  });
  const other = (name: string) => ({ name, isRulesFile: false as const });

  it("正常小输入通过,2000 字切片不是读取上限", () => {
    expect(classifyRulesReadBound([md("a.md", 100)])).toEqual({
      reason: "ok",
      direntCount: 1,
      readdirBufferBytes: utf8ByteLength("a.md"),
      acceptedFileCount: 1,
      readTotalBytes: 100
    });
    expect(classifyRulesReadBound([])).toMatchObject({ reason: "ok", direntCount: 0, acceptedFileCount: 0 });
    expect(L.ruleFileExcerptChars).toBe(2000);
    expect(L.ruleFileReadLimitBytes).toBeGreaterThan(L.ruleFileExcerptChars);
  });

  it("临界大小与数量通过,超单文件/数量/总量在首次读前失败", () => {
    const criticalFiles = Array.from({ length: L.ruleFileMaxCount }, (_, i) =>
      md(`f${String(i).padStart(2, "0")}.md`, L.ruleReadTotalBytes / L.ruleFileMaxCount)
    );
    expect(L.ruleReadTotalBytes / L.ruleFileMaxCount).toBe(8192);
    const critical = classifyRulesReadBound(criticalFiles);
    expect(critical.reason).toBe("ok");
    expect(critical.acceptedFileCount).toBe(16);
    expect(critical.readTotalBytes).toBe(L.ruleReadTotalBytes);

    const atFileBytes = classifyRulesReadBound([md("one.md", L.ruleFileReadLimitBytes)]);
    expect(atFileBytes.reason).toBe("ok");
    expect(atFileBytes.readTotalBytes).toBe(L.ruleFileReadLimitBytes);

    expect(classifyRulesReadBound([md("big.md", L.ruleFileReadLimitBytes + 1)]).reason).toBe("over_file_bytes");
    expect(classifyRulesReadBound([{ name: "missing.md", isRulesFile: true }]).reason).toBe("over_file_bytes");

    const seventeen = Array.from({ length: L.ruleFileMaxCount + 1 }, (_, i) =>
      md(`g${String(i).padStart(2, "0")}.md`, 1)
    );
    const overCount = classifyRulesReadBound(seventeen);
    expect(overCount.reason).toBe("over_file_count");
    expect(overCount.acceptedFileCount).toBe(L.ruleFileMaxCount);

    const overTotal = classifyRulesReadBound([
      md("a.md", L.ruleFileReadLimitBytes),
      md("b.md", L.ruleFileReadLimitBytes),
      md("c.md", 1)
    ]);
    expect(overTotal.reason).toBe("over_read_total");
    expect(overTotal.acceptedFileCount).toBe(2);
    expect(overTotal.readTotalBytes).toBe(L.ruleReadTotalBytes);
  });

  it("目录枚举/名称/缓冲超界立即失败,不得先装入整目录", () => {
    const atDirents = Array.from({ length: L.ruleDirentMax }, (_, i) => other(`n${String(i).padStart(2, "0")}.txt`));
    expect(classifyRulesReadBound(atDirents).reason).toBe("ok");
    expect(classifyRulesReadBound(atDirents).direntCount).toBe(32);

    const overDirents = atDirents.concat(other("zz.txt"));
    const overCount = classifyRulesReadBound(overDirents);
    expect(overCount.reason).toBe("over_dirent_count");
    expect(overCount.direntCount).toBe(L.ruleDirentMax);

    const maxName = "n".repeat(L.ruleDirentNameMaxBytes);
    expect(utf8ByteLength(maxName)).toBe(255);
    expect(classifyRulesReadBound([other(maxName)]).reason).toBe("ok");
    expect(classifyRulesReadBound([other("n".repeat(L.ruleDirentNameMaxBytes + 1))]).reason).toBe("over_dirent_name");

    const name255 = "n".repeat(255);
    const sixteenMaxNames = Array.from({ length: 16 }, (_, i) => other(`${name255.slice(0, 253)}${String(i).padStart(2, "0")}`));
    expect(sixteenMaxNames.every((d) => utf8ByteLength(d.name) === 255)).toBe(true);
    const bufferAt = classifyRulesReadBound(sixteenMaxNames.concat(other("x".repeat(16))));
    expect(bufferAt.readdirBufferBytes).toBe(L.ruleReaddirBufferMaxBytes);
    expect(bufferAt.reason).toBe("ok");

    const bufferOver = classifyRulesReadBound(sixteenMaxNames.concat(other("x".repeat(17))));
    expect(bufferOver.reason).toBe("over_readdir_buffer");
    expect(bufferOver.readdirBufferBytes).toBe(16 * 255);
    expect(bufferOver.direntCount).toBe(16);

    const hugeNameOn33rd = atDirents.concat(other("n".repeat(256)));
    expect(classifyRulesReadBound(hugeNameOn33rd).reason).toBe("over_dirent_name");
  });
});

describe("findCredentialLiteralSpans 声明 grammar", () => {
  const pemFence = "-".repeat(5);
  const pemBlock = (inner: string, type = "") =>
    CREDENTIAL_GRAMMAR.pemBegin +
    type +
    CREDENTIAL_GRAMMAR.pemLabel +
    pemFence +
    inner +
    CREDENTIAL_GRAMMAR.pemEnd +
    type +
    CREDENTIAL_GRAMMAR.pemLabel +
    pemFence;

  it("正例:声明前缀+字符集+最短长度命中对应 kind", () => {
    expect(findCredentialLiteralSpans(CREDENTIAL_GRAMMAR.openaiSkPrefix + BODY16).map((s) => s.kind)).toEqual([
      "openai_sk"
    ]);
    expect(findCredentialLiteralSpans(CREDENTIAL_GRAMMAR.githubGhpPrefix + BODY16).map((s) => s.kind)).toEqual([
      "github_ghp"
    ]);
    expect(findCredentialLiteralSpans(CREDENTIAL_GRAMMAR.githubPatPrefix + "b".repeat(16)).map((s) => s.kind)).toEqual([
      "github_pat"
    ]);
    expect(findCredentialLiteralSpans("xoxb-" + BODY16).map((s) => s.kind)).toEqual(["slack_xox"]);
    expect(findCredentialLiteralSpans(CREDENTIAL_GRAMMAR.awsAkiaPrefix + AWS16).map((s) => s.kind)).toEqual(["aws_akia"]);
    expect(findCredentialLiteralSpans(CREDENTIAL_GRAMMAR.awsAsiaPrefix + AWS16).map((s) => s.kind)).toEqual(["aws_asia"]);
    expect(findCredentialLiteralSpans(pemBlock("\nn\n")).map((s) => s.kind)).toEqual(["pem_private_key"]);
  });

  it("PEM 内文 0/524283/524284/524288 命中,524289 不命中,BEGIN 行尾五个连字符不计内文", () => {
    const g = CREDENTIAL_GRAMMAR;
    expect(g.pemInnerMax).toBe(524288);
    const kinds = (text: string) => findCredentialLiteralSpans(text).map((span) => span.kind);
    const markerOverhead = (type: string) =>
      g.pemBegin.length +
      type.length +
      g.pemLabel.length +
      pemFence.length +
      g.pemEnd.length +
      type.length +
      g.pemLabel.length +
      pemFence.length;
    for (const type of ["", "RSA "]) {
      for (const n of [0, 524283, 524284, 524288]) {
        const text = pemBlock("A".repeat(n), type);
        expect(text.length - markerOverhead(type)).toBe(n);
        expect(kinds(text), `type=${JSON.stringify(type)} inner=${n}`).toEqual(["pem_private_key"]);
      }
      expect(kinds(pemBlock("A".repeat(524289), type)), `type=${JSON.stringify(type)} inner=524289`).toEqual([]);
    }
  });

  it("反例:短 body、占位、引用豁免、路径、边界内侧不命中", () => {
    expect(findCredentialLiteralSpans(CREDENTIAL_GRAMMAR.openaiSkPrefix + BODY15)).toEqual([]);
    expect(findCredentialLiteralSpans(CREDENTIAL_PLACEHOLDERS.skTest)).toEqual([]);
    expect(findCredentialLiteralSpans(CREDENTIAL_PLACEHOLDERS.ghpFixture)).toEqual([]);
    expect(findCredentialLiteralSpans("env:OPENAI_API_KEY")).toEqual([]);
    expect(findCredentialLiteralSpans("sha256:" + "a".repeat(64))).toEqual([]);
    expect(findCredentialLiteralSpans("${OPENAI_API_KEY}")).toEqual([]);
    expect(findCredentialLiteralSpans("$OPENAI_API_KEY")).toEqual([]);
    expect(findCredentialLiteralSpans("rules/foo..bar.md")).toEqual([]);
    expect(findCredentialLiteralSpans("x" + CREDENTIAL_GRAMMAR.openaiSkPrefix + BODY16)).toEqual([]);
    const saydo = "mem_01ABCDEFGHJKMNPQRSTVWXYZAB";
    expect(new RegExp("^" + CREDENTIAL_EXEMPTIONS.saydoIdReSource + "$").test(saydo)).toBe(true);
    expect(findCredentialLiteralSpans(saydo)).toEqual([]);
  });

  it("同形假 token 仍命中,不承诺与真凭据区分", () => {
    const fake = CREDENTIAL_GRAMMAR.openaiSkPrefix + "Z".repeat(16);
    expect(findCredentialLiteralSpans(fake)).toHaveLength(1);
  });

  it("占位符仅整串豁免:合法长 literal 含子串仍命中,真实占位与引用可过", () => {
    const skOverlap = CREDENTIAL_PLACEHOLDERS.skTest + "A".repeat(13);
    expect(skOverlap.length - CREDENTIAL_GRAMMAR.openaiSkPrefix.length).toBe(17);
    expect(findCredentialLiteralSpans(skOverlap).map((s) => s.kind)).toEqual(["openai_sk"]);
    expect(findCredentialLiteralSpans(CREDENTIAL_GRAMMAR.openaiSkPrefix + "B".repeat(16)).map((s) => s.kind)).toEqual([
      "openai_sk"
    ]);
    expect(findCredentialLiteralSpans(CREDENTIAL_PLACEHOLDERS.skTest)).toEqual([]);
    expect(findCredentialLiteralSpans(CREDENTIAL_PLACEHOLDERS.ghpFixture)).toEqual([]);
    expect(findCredentialLiteralSpans("env:OPENAI_API_KEY")).toEqual([]);
    expect(findCredentialLiteralSpans("sha256:" + "a".repeat(64))).toEqual([]);
    expect(findCredentialLiteralSpans("${OPENAI_API_KEY}")).toEqual([]);
    expect(findCredentialLiteralSpans("$OPENAI_API_KEY")).toEqual([]);
  });

  it("合法 mem_ id 只覆盖 openai_sk 末尾时仍命中", () => {
    const saydo = "mem_01ABCDEFGHJKMNPQRSTVWXYZAB";
    const sk = CREDENTIAL_GRAMMAR.openaiSkPrefix + "A".repeat(CREDENTIAL_GRAMMAR.bodyMin);
    expect(findCredentialLiteralSpans(sk).map((s) => s.kind)).toEqual(["openai_sk"]);
    expect(findCredentialLiteralSpans(saydo)).toEqual([]);
    const mixed = `${sk}-${saydo}`;
    expect(findCredentialLiteralSpans(mixed).map((s) => s.kind)).toEqual(["openai_sk"]);
  });

  it("已声明 kind × 已声明豁免只检查完整覆盖/无相交/仅局部相交,其余标不适用", () => {
    expect(CREDENTIAL_EXEMPTION_SCOPE).toBe("covers_whole_span");

    type ExemptionKey = keyof typeof CREDENTIAL_EXEMPTIONS;
    type Range = { start: number; end: number };
    type Cell = {
      none: string;
      cover?: { text: string; bare: string };
      partial?: string;
      naCover?: string;
      naPartial?: string;
    };

    const saydoId = "mem_01ABCDEFGHJKMNPQRSTVWXYZAB";
    const envName = "env:OPENAI_API_KEY";
    const digestRef = "sha256:" + "a".repeat(64);
    const dollarBrace = "${OPENAI_API_KEY}";
    const dollarName = "$OPENAI_API_KEY";
    const crockford26 = "01ABCDEFGHJKMNPQRSTVWXYZAB";
    const ghp16 = CREDENTIAL_GRAMMAR.githubGhpPrefix + BODY16;
    const pat16 = CREDENTIAL_GRAMMAR.githubPatPrefix + "b".repeat(CREDENTIAL_GRAMMAR.bodyMin);
    const sk16 = CREDENTIAL_GRAMMAR.openaiSkPrefix + BODY16;
    const slack16 = "xoxb-" + BODY16;
    const akia16 = CREDENTIAL_GRAMMAR.awsAkiaPrefix + AWS16;
    const asia16 = CREDENTIAL_GRAMMAR.awsAsiaPrefix + AWS16;
    const pemInner = (inner: string) => pemBlock(`\n${inner}\n`);
    const barePem = pemInner("n");

    const exemptionSamples = {
      envNameReSource: envName,
      digestReSource: digestRef,
      saydoIdReSource: saydoId,
      dollarBraceReSource: dollarBrace,
      dollarNameReSource: dollarName
    } as const satisfies Record<ExemptionKey, string>;

    const adjacent = (token: string, exemption: string) => `${token}\n${exemption}`;

    const pemNaCover = "PEM BEGIN/END 块无法被任一豁免整段覆盖";
    const hyphenTokenNaBrace = "含连字符的 token 与 ${} 名字符集不相交";
    const ghpWrapNaPartial = "${}/$NAME 若与 ghp_ token 相交则包围整段";
    const patIdNa = "github_pat 全为词字符,SayDo id 的词边界无法落在 token 内,且 github 前缀长于 [a-z]{2,4}_";
    const patWrapNaPartial = "${}/$NAME 若与 github_pat token 相交则包围整段";
    const awsEnvNaPartial = "env: 后大写名若与 AKIA/ASIA 相交则覆盖整段;AWS 无小写/冒号";
    const awsDigestNa = "sha256: 小写与冒号不在 AWS 字符集;AKIA/ASIA 含非 hex 字母";
    const awsIdNa = "SayDo id 小写前缀与 AKIA/ASIA 不相交,且 I 不在 Crockford";
    const awsWrapNaPartial = "${}/$NAME 若与 AKIA/ASIA 相交则包围整段";
    const skIdNaCover = "sk- 含连字符,SayDo id 无法覆盖整段 openai_sk";
    const slackIdNaCover = "xox[baprs]- 含连字符,SayDo id 无法覆盖整段 slack_xox";
    const envNaCoverHyphen = "env: 大写名无法覆盖含小写前缀或连字符的 token";
    const digestNaCover = "sha256: 无法覆盖声明 token 前缀";
    const dollarNameNaCoverHyphen = "$NAME 不含连字符,无法覆盖 sk-/xox- token";

    const catalog: Record<CredentialKind, Record<ExemptionKey, Cell>> = {
      pem_private_key: {
        envNameReSource: { none: adjacent(barePem, envName), partial: pemInner(envName), naCover: pemNaCover },
        digestReSource: { none: adjacent(barePem, digestRef), partial: pemInner(digestRef), naCover: pemNaCover },
        saydoIdReSource: { none: adjacent(barePem, saydoId), partial: pemInner(saydoId), naCover: pemNaCover },
        dollarBraceReSource: { none: adjacent(barePem, dollarBrace), partial: pemInner(dollarBrace), naCover: pemNaCover },
        dollarNameReSource: { none: adjacent(barePem, dollarName), partial: pemInner(dollarName), naCover: pemNaCover }
      },
      openai_sk: {
        envNameReSource: {
          none: adjacent(sk16, envName),
          partial: sk16 + envName,
          naCover: envNaCoverHyphen
        },
        digestReSource: {
          none: adjacent(sk16, digestRef),
          partial: sk16 + digestRef,
          naCover: digestNaCover
        },
        saydoIdReSource: {
          none: adjacent(sk16, saydoId),
          partial: `${sk16}-${saydoId}`,
          naCover: skIdNaCover
        },
        dollarBraceReSource: {
          none: adjacent(sk16, dollarBrace),
          naCover: hyphenTokenNaBrace,
          naPartial: hyphenTokenNaBrace
        },
        dollarNameReSource: {
          none: adjacent(sk16, dollarName),
          partial: `$${sk16}`,
          naCover: dollarNameNaCoverHyphen
        }
      },
      github_ghp: {
        envNameReSource: {
          none: adjacent(ghp16, envName),
          partial: ghp16 + envName,
          naCover: envNaCoverHyphen
        },
        digestReSource: {
          none: adjacent(ghp16, digestRef),
          partial: ghp16 + digestRef,
          naCover: digestNaCover
        },
        saydoIdReSource: {
          none: adjacent(ghp16, saydoId),
          cover: { text: CREDENTIAL_GRAMMAR.githubGhpPrefix + crockford26, bare: ghp16 },
          naPartial: "ghp 正文全为词字符;恰好 26 位 Crockford 是完整覆盖,无法只局部相交"
        },
        dollarBraceReSource: {
          none: adjacent(ghp16, dollarBrace),
          cover: { text: `\${${ghp16}}`, bare: ghp16 },
          naPartial: ghpWrapNaPartial
        },
        dollarNameReSource: {
          none: adjacent(ghp16, dollarName),
          cover: { text: `$${ghp16}`, bare: ghp16 },
          naPartial: ghpWrapNaPartial
        }
      },
      github_pat: {
        envNameReSource: {
          none: adjacent(pat16, envName),
          partial: pat16 + envName,
          naCover: envNaCoverHyphen
        },
        digestReSource: {
          none: adjacent(pat16, digestRef),
          partial: pat16 + digestRef,
          naCover: digestNaCover
        },
        saydoIdReSource: {
          none: adjacent(pat16, saydoId),
          naCover: patIdNa,
          naPartial: patIdNa
        },
        dollarBraceReSource: {
          none: adjacent(pat16, dollarBrace),
          cover: { text: `\${${pat16}}`, bare: pat16 },
          naPartial: patWrapNaPartial
        },
        dollarNameReSource: {
          none: adjacent(pat16, dollarName),
          cover: { text: `$${pat16}`, bare: pat16 },
          naPartial: patWrapNaPartial
        }
      },
      slack_xox: {
        envNameReSource: {
          none: adjacent(slack16, envName),
          partial: slack16 + envName,
          naCover: envNaCoverHyphen
        },
        digestReSource: {
          none: adjacent(slack16, digestRef),
          partial: slack16 + digestRef,
          naCover: digestNaCover
        },
        saydoIdReSource: {
          none: adjacent(slack16, saydoId),
          partial: `${slack16}-${saydoId}`,
          naCover: slackIdNaCover
        },
        dollarBraceReSource: {
          none: adjacent(slack16, dollarBrace),
          naCover: hyphenTokenNaBrace,
          naPartial: hyphenTokenNaBrace
        },
        dollarNameReSource: {
          none: adjacent(slack16, dollarName),
          partial: `$${slack16}`,
          naCover: dollarNameNaCoverHyphen
        }
      },
      aws_akia: {
        envNameReSource: {
          none: adjacent(akia16, envName),
          cover: { text: `env:${akia16}`, bare: akia16 },
          naPartial: awsEnvNaPartial
        },
        digestReSource: { none: adjacent(akia16, digestRef), naCover: awsDigestNa, naPartial: awsDigestNa },
        saydoIdReSource: { none: adjacent(akia16, saydoId), naCover: awsIdNa, naPartial: awsIdNa },
        dollarBraceReSource: {
          none: adjacent(akia16, dollarBrace),
          cover: { text: `\${${akia16}}`, bare: akia16 },
          naPartial: awsWrapNaPartial
        },
        dollarNameReSource: {
          none: adjacent(akia16, dollarName),
          cover: { text: `$${akia16}`, bare: akia16 },
          naPartial: awsWrapNaPartial
        }
      },
      aws_asia: {
        envNameReSource: {
          none: adjacent(asia16, envName),
          cover: { text: `env:${asia16}`, bare: asia16 },
          naPartial: awsEnvNaPartial
        },
        digestReSource: { none: adjacent(asia16, digestRef), naCover: awsDigestNa, naPartial: awsDigestNa },
        saydoIdReSource: { none: adjacent(asia16, saydoId), naCover: awsIdNa, naPartial: awsIdNa },
        dollarBraceReSource: {
          none: adjacent(asia16, dollarBrace),
          cover: { text: `\${${asia16}}`, bare: asia16 },
          naPartial: awsWrapNaPartial
        },
        dollarNameReSource: {
          none: adjacent(asia16, dollarName),
          cover: { text: `$${asia16}`, bare: asia16 },
          naPartial: awsWrapNaPartial
        }
      }
    };

    function collectExemptionRanges(text: string): Range[] {
      const out: Range[] = [];
      for (const source of Object.values(CREDENTIAL_EXEMPTIONS)) {
        for (const match of text.matchAll(new RegExp(source, "g"))) {
          const start = match.index ?? 0;
          out.push({ start, end: start + match[0].length });
        }
      }
      return out;
    }

    function overlaps(start: number, end: number, ranges: readonly Range[]): boolean {
      return ranges.some((range) => start < range.end && end > range.start);
    }

    function covers(start: number, end: number, ranges: readonly Range[]): boolean {
      return ranges.some((range) => range.start <= start && range.end >= end);
    }

    const kinds = [...credentialKindSchema.options];
    expect(Object.keys(catalog).sort()).toEqual([...kinds].sort());
    expect(Object.keys(exemptionSamples).sort()).toEqual(Object.keys(CREDENTIAL_EXEMPTIONS).sort());

    for (const sample of Object.values(exemptionSamples)) {
      expect(findCredentialLiteralSpans(sample)).toEqual([]);
    }

    for (const kind of kinds) {
      expect(Object.keys(catalog[kind]).sort()).toEqual(Object.keys(CREDENTIAL_EXEMPTIONS).sort());
      for (const exemption of Object.keys(CREDENTIAL_EXEMPTIONS) as ExemptionKey[]) {
        const cell = catalog[kind][exemption];
        expect(cell.none.length).toBeGreaterThan(0);
        expect(Boolean(cell.cover) || Boolean(cell.naCover)).toBe(true);
        expect(Boolean(cell.partial) || Boolean(cell.naPartial)).toBe(true);
        if (cell.cover) expect(cell.naCover).toBeUndefined();
        if (cell.partial) expect(cell.naPartial).toBeUndefined();
        if (cell.naCover) expect(cell.naCover.length).toBeGreaterThan(0);
        if (cell.naPartial) expect(cell.naPartial.length).toBeGreaterThan(0);

        const noneHits = findCredentialLiteralSpans(cell.none);
        expect(noneHits.map((span) => span.kind)).toContain(kind);
        const noneSpan = noneHits.find((span) => span.kind === kind);
        expect(noneSpan).toBeDefined();
        if (noneSpan) {
          expect(overlaps(noneSpan.start, noneSpan.end, collectExemptionRanges(cell.none))).toBe(false);
        }

        if (cell.cover) {
          expect(findCredentialLiteralSpans(cell.cover.bare).map((span) => span.kind)).toContain(kind);
          expect(findCredentialLiteralSpans(cell.cover.text).map((span) => span.kind)).not.toContain(kind);
        }

        if (cell.partial) {
          const partialHits = findCredentialLiteralSpans(cell.partial);
          expect(partialHits.map((span) => span.kind)).toContain(kind);
          const partialSpan = partialHits.find((span) => span.kind === kind);
          expect(partialSpan).toBeDefined();
          if (partialSpan) {
            const ranges = collectExemptionRanges(cell.partial);
            expect(overlaps(partialSpan.start, partialSpan.end, ranges)).toBe(true);
            expect(covers(partialSpan.start, partialSpan.end, ranges)).toBe(false);
          }
        }
      }
    }
  });
});
