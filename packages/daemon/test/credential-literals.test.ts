import { describe, expect, it } from "vitest";
import { CREDENTIAL_GRAMMAR, CREDENTIAL_PLACEHOLDERS, KNOWLEDGE_PRIVACY_LIMITS } from "@saydo/contracts";
import {
  assertPersistableStrings,
  MEMORY_SECRET_LITERAL_CODE,
  MEMORY_SECRET_LITERAL_MESSAGE,
  MemorySecretLiteralError
} from "../src/memory/credentialLiterals.js";

function pemBlock(): string {
  return ["-----BEGIN ", "PRIVATE KEY-----", "\nMIIB\n", "-----END ", "PRIVATE KEY-----"].join("");
}

function ghpToken(): string {
  return [CREDENTIAL_GRAMMAR.githubGhpPrefix, "A".repeat(CREDENTIAL_GRAMMAR.bodyMin)].join("");
}

function skToken(): string {
  return [CREDENTIAL_GRAMMAR.openaiSkPrefix, "A".repeat(CREDENTIAL_GRAMMAR.bodyMin)].join("");
}

describe("daemon 凭据包装层", () => {
  it("PEM / ghp_ / sk- 构造串命中,message 与 hits 不含原文", () => {
    for (const sample of [pemBlock(), ghpToken(), skToken()]) {
      expect(() => assertPersistableStrings([`note ${sample}`])).toThrow(MemorySecretLiteralError);
      try {
        assertPersistableStrings([`note ${sample}`]);
      } catch (err) {
        expect(err).toBeInstanceOf(MemorySecretLiteralError);
        const e = err as MemorySecretLiteralError;
        expect(e.code).toBe(MEMORY_SECRET_LITERAL_CODE);
        expect(e.message).toBe(MEMORY_SECRET_LITERAL_MESSAGE);
        expect(e.message).not.toContain(sample);
        expect(JSON.stringify(e.hits)).not.toContain(sample);
        expect(e.hits.length).toBeGreaterThan(0);
        for (const hit of e.hits) {
          expect(hit.spanDigest.startsWith("sha256:")).toBe(true);
          expect(hit.kind.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("独立 env / digest / SayDo id / 整串占位符可过", () => {
    const digest = "sha256:" + "a".repeat(64);
    const saydoId = "mem_" + "0".repeat(26);
    expect(() => assertPersistableStrings(["env:OPENAI_API_KEY"])).not.toThrow();
    expect(() => assertPersistableStrings([digest])).not.toThrow();
    expect(() => assertPersistableStrings([saydoId])).not.toThrow();
    expect(() => assertPersistableStrings([CREDENTIAL_PLACEHOLDERS.skTest])).not.toThrow();
  });

  it("单条超过 maxMemoryClaimChars fail-closed,不截断后写入", () => {
    const over = "x".repeat(KNOWLEDGE_PRIVACY_LIMITS.maxMemoryClaimChars + 1);
    expect(() => assertPersistableStrings([over])).toThrow(MemorySecretLiteralError);
    try {
      assertPersistableStrings([over]);
    } catch (err) {
      const e = err as MemorySecretLiteralError;
      expect(e.code).toBe(MEMORY_SECRET_LITERAL_CODE);
      expect(e.message).not.toContain(over.slice(0, 32));
    }
  });
});
