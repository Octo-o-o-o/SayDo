import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync } from "node:fs";
import { textDigest } from "@saydo/contracts";

const MAX_ARTICLE_BYTES = 64 * 1024 * 1024;

export interface VerifiedWritingBytes {
  bytes: Buffer;
  text: string;
  digest: string;
}

function decodeCanonicalUtf8(bytes: Buffer, label: string): VerifiedWritingBytes {
  const text = bytes.toString("utf8");
  if (!Buffer.from(text, "utf8").equals(bytes)) {
    throw new Error(`${label} 不是规范 UTF-8 文本`);
  }
  return { bytes, text, digest: textDigest(text) };
}

/** lstat 不跟随 symlink；writing 成稿和 artifact 存储都只接受常规文件。 */
export function readRegularWritingFile(path: string, label: string): VerifiedWritingBytes {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`${label} 不是常规文件`);
  if (stat.size > MAX_ARTICLE_BYTES) throw new Error(`${label} 超过 64 MiB 上限`);
  return decodeCanonicalUtf8(readFileSync(path), label);
}

/**
 * 从不可变 prospective tree 读取成稿：先验证 exact path 的 mode/type，再按 blob oid 取原始字节。
 * `git cat-file` 对 symlink 也会返回 blob，故不能只检查对象存在或只比较解码后的字符串。
 */
export function readWritingTreeBlob(cwd: string, treeSha: string, articlePath: string): VerifiedWritingBytes {
  const listing = execFileSync("git", ["ls-tree", "-z", treeSha, "--", articlePath], {
    cwd,
    encoding: null,
    maxBuffer: 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"]
  });
  const nul = listing.indexOf(0);
  if (nul < 0 || nul !== listing.length - 1 || listing.indexOf(0, nul + 1) !== -1) {
    throw new Error("批准树中成稿路径缺失或不唯一");
  }
  const tab = listing.indexOf(0x09);
  if (tab < 0 || tab >= nul) throw new Error("批准树中成稿 entry 形状无效");
  const meta = listing.subarray(0, tab).toString("ascii");
  const match = /^(100644|100755) blob ([0-9a-f]{40,64})$/u.exec(meta);
  if (!match) throw new Error("批准树中成稿必须是常规 blob，拒绝 symlink/submodule");
  const pathBytes = listing.subarray(tab + 1, nul);
  if (!pathBytes.equals(Buffer.from(articlePath, "utf8"))) throw new Error("批准树返回的成稿路径不匹配");
  const bytes = execFileSync("git", ["cat-file", "blob", match[2] as string], {
    cwd,
    encoding: null,
    maxBuffer: MAX_ARTICLE_BYTES + 1,
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (bytes.length > MAX_ARTICLE_BYTES) throw new Error("批准树中成稿超过 64 MiB 上限");
  return decodeCanonicalUtf8(bytes, "批准树成稿");
}
