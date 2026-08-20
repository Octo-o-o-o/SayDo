// RFC 8785 JCS(JSON Canonicalization Scheme)+ sha256 digest(docs/09 §0:
// digest = sha256(JCS canonical JSON),形态 "sha256:<hex>")。
// 实现要点:对象键按 UTF-16 code unit 排序(JS 默认 sort 语义)、undefined 键省略、
// 数字用 ECMAScript Number::toString(JSON.stringify 即是)、拒绝 NaN/Infinity。
// 用 @noble/hashes 保持 node/浏览器同构(console 也 import 本包)。

import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

export type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

export function jcsSerialize(value: unknown): string {
  if (value === null) return "null";
  const t = typeof value;
  if (t === "boolean") return String(value);
  if (t === "number") {
    const n = value as number;
    if (!Number.isFinite(n)) throw new Error("JCS: non-finite number not allowed");
    return JSON.stringify(n);
  }
  if (t === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map((v) => jcsSerialize(v === undefined ? null : v)).join(",") + "]";
  }
  if (t === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort();
    return "{" + keys.map((k) => JSON.stringify(k) + ":" + jcsSerialize(obj[k])).join(",") + "}";
  }
  throw new Error(`JCS: unsupported type ${t}`);
}

const utf8 = new TextEncoder();

/** H = sha256(JCS(value)),返回 "sha256:<hex>" */
export function jcsDigest(value: unknown): string {
  return "sha256:" + bytesToHex(sha256(utf8.encode(jcsSerialize(value))));
}

/** 文件类 digest(docs/09 §0.1 Artifact 行):对 bytes 直接哈希,约定 encoding=utf-8/newline=LF */
export function bytesDigest(bytes: Uint8Array): string {
  return "sha256:" + bytesToHex(sha256(bytes));
}

export function textDigest(text: string): string {
  return bytesDigest(utf8.encode(text));
}
