// B4 产物库(计划 3.3;modules/b B4;09 §8):M2 全程写入——文件落 <workspace>/.saydo/artifacts/,
// digest 校验(读取重校,不符报损坏),version+supersedes 链。P0 写入+版本;控制面(时间线/diff)P1。

import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { newId, textDigest, type Artifact, type ArtifactType, type SourceRef } from "@saydo/contracts";
import type { Db } from "../storage/db.js";
import { getArtifact, insertArtifact, latestArtifactVersion } from "../storage/dao/artifacts.js";

export const ARTIFACT_CONTENT_MAX_BYTES = 1_048_576;

export class ArtifactCorruptError extends Error {
  constructor(id: string, version: number) {
    super(`artifact corrupt: ${id} v${version} digest mismatch (文件被外部改动或损坏)`);
  }
}

export class ArtifactMissingError extends Error {
  constructor(id: string, version: number) {
    super(`artifact file missing: ${id} v${version}`);
  }
}

export class ArtifactTooLargeError extends Error {
  readonly bytes: number;
  constructor(bytes: number) {
    super(`artifact content exceeds 1 MB (${bytes} bytes)`);
    this.bytes = bytes;
  }
}

function isEnoent(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === "ENOENT";
}

/** 按类型选扩展名(S1:demo ⇒ .html,其余维持 .md);只影响新写入,读路径走 DB 里存的 path */
export function extensionForType(type: ArtifactType): string {
  return type === "demo" ? ".html" : ".md";
}

export class ArtifactStore {
  private readonly db: Db;
  private readonly dir: string;
  private readonly now: () => Date;

  constructor(deps: { db: Db; saydoDir: string; now?: () => Date }) {
    this.db = deps.db;
    this.dir = join(deps.saydoDir, "artifacts");
    this.now = deps.now ?? (() => new Date());
  }

  /** 新产物(version=1)或新版本(供 supersede;版本号单调 = max+1) */
  write(input: {
    projectId: string;
    type: ArtifactType;
    content: string;
    tags?: string[];
    source: SourceRef["kind"];
    /** 传入已有 artifactId 即产新版本并自动挂 supersedes 链 */
    artifactId?: string;
  }): Artifact {
    mkdirSync(this.dir, { recursive: true });
    const id = input.artifactId ?? newId("art");
    const prevVersion = latestArtifactVersion(this.db, id);
    if (input.artifactId !== undefined && prevVersion === 0) {
      throw new Error(`artifact not found for new version: ${input.artifactId}`);
    }
    const version = prevVersion + 1;
    if (input.type === "demo") {
      const bytes = Buffer.byteLength(input.content, "utf8");
      if (bytes > ARTIFACT_CONTENT_MAX_BYTES) throw new ArtifactTooLargeError(bytes);
    }
    const path = join(this.dir, `${id}-v${version}${extensionForType(input.type)}`);
    writeFileSync(path, input.content);
    const artifact: Artifact = {
      id,
      projectId: input.projectId,
      version,
      type: input.type,
      path,
      digest: textDigest(input.content),
      ...(prevVersion > 0 ? { supersedes: { artifactId: id, version: prevVersion } } : {}),
      tags: input.tags ?? [],
      source: input.source,
      createdAt: this.now().toISOString()
    };
    insertArtifact(this.db, artifact);
    return artifact;
  }

  /** 读取(digest 重校;不符 ⇒ 报损坏,不静默返回坏数据)。maxBytes 在入内存前 stat 拦截。 */
  read(id: string, version: number, opts?: { maxBytes?: number }): { artifact: Artifact; content: string } {
    const artifact = getArtifact(this.db, id, version);
    if (!artifact) throw new Error(`artifact not found: ${id} v${version}`);
    try {
      const st = statSync(artifact.path);
      if (opts?.maxBytes !== undefined && st.size > opts.maxBytes) {
        throw new ArtifactTooLargeError(st.size);
      }
    } catch (err) {
      if (err instanceof ArtifactTooLargeError) throw err;
      if (isEnoent(err)) throw new ArtifactMissingError(id, version);
      throw err;
    }
    let content: string;
    try {
      content = readFileSync(artifact.path, "utf8");
    } catch (err) {
      if (isEnoent(err)) throw new ArtifactMissingError(id, version);
      throw err;
    }
    if (textDigest(content) !== artifact.digest) throw new ArtifactCorruptError(id, version);
    return { artifact, content };
  }
}
