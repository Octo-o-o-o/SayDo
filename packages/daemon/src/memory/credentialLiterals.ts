// AS-01 记忆写路径凭据闸:contracts 扫描的 daemon 包装,禁止第二套 grammar。
// 错误 message 固定人话,hits 只含 kind+spanDigest,绝不回显命中原文或整段 claim。

import {
  credentialHitSchema,
  findCredentialLiterals,
  KNOWLEDGE_PRIVACY_LIMITS,
  type CredentialHit,
  type KnowledgePrivacyFailureClass
} from "@saydo/contracts";

export const MEMORY_SECRET_LITERAL_CODE = "memory_secret_literal" as const;

/** 10 TTS / 09 写路径失败人话:单条未保存。 */
export const MEMORY_SECRET_LITERAL_MESSAGE = "这条我没记下,里面有一处凭据,改掉源文再让我记";

const MEMORY_ITEM_NOT_SAVED: KnowledgePrivacyFailureClass = "memory_item_not_saved";

export class MemorySecretLiteralError extends Error {
  readonly code = MEMORY_SECRET_LITERAL_CODE;
  readonly hits: CredentialHit[];

  constructor(hits: CredentialHit[]) {
    super(MEMORY_SECRET_LITERAL_MESSAGE);
    this.name = "MemorySecretLiteralError";
    this.hits = hits.map((hit) => credentialHitSchema.parse({ kind: hit.kind, spanDigest: hit.spanDigest }));
  }
}

export function isMemorySecretLiteralError(err: unknown): err is MemorySecretLiteralError {
  if (err instanceof MemorySecretLiteralError) return true;
  if (!(err instanceof Error)) return false;
  return (err as { code?: unknown }).code === MEMORY_SECRET_LITERAL_CODE;
}

/** 正式记忆拒写体:{ok:false,code,message,retryable:false} 之上附带 contracts 失败 class。 */
export function memorySecretLiteralReject(err: MemorySecretLiteralError): {
  ok: false;
  code: typeof MEMORY_SECRET_LITERAL_CODE;
  message: string;
  retryable: false;
  failureClass: KnowledgePrivacyFailureClass;
} {
  return {
    ok: false,
    code: MEMORY_SECRET_LITERAL_CODE,
    message: err.message,
    retryable: false,
    failureClass: MEMORY_ITEM_NOT_SAVED
  };
}

/**
 * 对将落盘字符串数组断言:超长或命中凭据 grammar 一律同一 code fail-closed。
 * 不截断后写入;不扫描超长串(避免在拒写路径上做无界正则)。
 */
export function assertPersistableStrings(texts: readonly string[]): void {
  const hits: CredentialHit[] = [];
  for (const text of texts) {
    if (text.length > KNOWLEDGE_PRIVACY_LIMITS.maxMemoryClaimChars) {
      throw new MemorySecretLiteralError([]);
    }
    hits.push(...findCredentialLiterals(text));
  }
  if (hits.length > 0) throw new MemorySecretLiteralError(hits);
}
