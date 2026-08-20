// W5a 3.6:产物库控制面(modules/b B4 P1)——diff(LCS 行级)+ 子集导出(JSON bundle)+
// digest 重校链(损坏如实报错)+ 跨项目导出拒。

import { mkdtempSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "../src/storage/db.js";
import { insertProject } from "../src/storage/dao/projects.js";
import { managedProjectPath } from "../src/projects/workspace.js";
import { ArtifactStore, ArtifactTooLargeError, ARTIFACT_CONTENT_MAX_BYTES } from "../src/artifacts/store.js";
import { diffLines } from "../src/artifacts/diff.js";
import { getArtifactDiff, exportArtifacts, getArtifactContent, ArtifactAccessError } from "../src/api/console.js";

const NOW = "2026-07-27T12:00:00.000Z";
const PRJ = "prj_01ARTCTA0000000000000000AA";
const PRJ2 = "prj_01ARTCTB0000000000000000AA";

let db: Db;
let store: ArtifactStore;

beforeEach(() => {
  const home = mkdtempSync(join(tmpdir(), "saydo-artctl-"));
  db = openDb(join(home, "saydo.db"));
  store = new ArtifactStore({ db, saydoDir: home, now: () => new Date(NOW) });
  for (const id of [PRJ, PRJ2]) {
    insertProject(db, {
      id,
      title: id === PRJ ? "主项目" : "别的项目",
      type: "coding",
      status: "active",
      workspace: { kind: "local_folder", path: managedProjectPath(id), managed: true },
      executionModeDefault: "step_confirm",
      createdAt: NOW,
      updatedAt: NOW
    });
  }
});

describe("diffLines(LCS 行级;零依赖确定性)", () => {
  it("增/删/同行分类正确;同文本全 same;超限降级 truncated", () => {
    const d = diffLines("a\nb\nc", "a\nx\nc\nd");
    expect(d.truncated).toBe(false);
    expect(d.lines).toEqual([
      { kind: "same", text: "a" },
      { kind: "del", text: "b" },
      { kind: "add", text: "x" },
      { kind: "same", text: "c" },
      { kind: "add", text: "d" }
    ]);
    expect(diffLines("x", "x").lines).toEqual([{ kind: "same", text: "x" }]);
    const big = Array.from({ length: 4001 }, (_, i) => `l${i}`).join("\n");
    expect(diffLines(big, "x").truncated).toBe(true);
  });
});

describe("版本 diff + supersedes 链(store 写入产链,digest 重校)", () => {
  it("相邻版本 diff 输出 add/del;损坏文件如实报错不静默", () => {
    const v1 = store.write({ projectId: PRJ, type: "plan", content: "# 方案\n- 用 CSV", source: "agent_output" });
    const v2 = store.write({ projectId: PRJ, type: "plan", content: "# 方案\n- 用 CSV\n- 带 BOM", source: "agent_output", artifactId: v1.id });
    expect(v2.version).toBe(2);
    expect(v2.supersedes).toEqual({ artifactId: v1.id, version: 1 });

    const d = getArtifactDiff(db, store, v1.id, 1, 2);
    expect((d["lines"] as { kind: string; text: string }[]).some((l) => l.kind === "add" && l.text.includes("BOM"))).toBe(true);
    expect((d["from"] as { digest: string }).digest).toBe(v1.digest);

    writeFileSync(v2.path, "tampered"); // 外部改动 ⇒ digest 重校炸(ArtifactCorruptError)
    expect(() => getArtifactDiff(db, store, v1.id, 1, 2)).toThrow(/corrupt/);
  });
});

describe("子集导出(JSON bundle;项目归属断言)", () => {
  it("选中版本入 bundle(内容 + digest 可独立核验);跨项目拒;空清单拒", () => {
    const a = store.write({ projectId: PRJ, type: "plan", content: "A1", source: "agent_output" });
    const b = store.write({ projectId: PRJ, type: "report", content: "B1", source: "agent_output" });
    const other = store.write({ projectId: PRJ2, type: "plan", content: "X", source: "agent_output" });

    const bundle = exportArtifacts(db, store, PRJ, [
      { id: a.id, version: 1 },
      { id: b.id, version: 1 }
    ], NOW);
    expect(bundle["count"]).toBe(2);
    const items = bundle["artifacts"] as { id: string; content: string; digest: string }[];
    expect(items.map((x) => x.content)).toEqual(["A1", "B1"]);
    expect(items[0]?.digest).toBe(a.digest);

    expect(() => exportArtifacts(db, store, PRJ, [{ id: other.id, version: 1 }], NOW)).toThrow(/不属于项目/);
    expect(() => exportArtifacts(db, store, PRJ, [], NOW)).toThrow(/为空/);
    expect(() => exportArtifacts(db, store, PRJ, [{ id: "art_ghost", version: 1 }], NOW)).toThrow(/not found/);
  });
});

describe("只读产物内容 GET 语义(S1 Demo 小样)", () => {
  it("200 含 content", () => {
    const a = store.write({ projectId: PRJ, type: "demo", content: "<!doctype html><p>小样</p>", source: "agent_output" });
    const out = getArtifactContent(db, store, a.id, 1, PRJ);
    expect(out.content).toBe("<!doctype html><p>小样</p>");
    expect(out.artifact.id).toBe(a.id);
    expect(out.artifact.type).toBe("demo");
    expect(out.artifact.path.endsWith(".html")).toBe(true);
    expect(out.artifact.path).not.toContain("/");
  });

  it("跨项目 403", () => {
    const other = store.write({ projectId: PRJ2, type: "demo", content: "<p>别的项目</p>", source: "agent_output" });
    try {
      getArtifactContent(db, store, other.id, 1, PRJ);
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ArtifactAccessError);
      expect((err as ArtifactAccessError).status).toBe(403);
      expect((err as ArtifactAccessError).code).toBe("artifact_project_mismatch");
    }
    expect(() => getArtifactContent(db, store, "art_ghost", 1, PRJ)).toThrow(ArtifactAccessError);
    try {
      getArtifactContent(db, store, "art_ghost", 1, PRJ);
    } catch (err) {
      expect((err as ArtifactAccessError).status).toBe(404);
    }
  });

  it("digest 损坏 409", () => {
    const a = store.write({ projectId: PRJ, type: "demo", content: "<p>ok</p>", source: "agent_output" });
    writeFileSync(a.path, "tampered");
    try {
      getArtifactContent(db, store, a.id, 1, PRJ);
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ArtifactAccessError);
      expect((err as ArtifactAccessError).status).toBe(409);
      expect((err as ArtifactAccessError).code).toBe("artifact_corrupt");
    }
  });

  it("读前超 1 MB 直接 413;写 demo 同样封顶", () => {
    const huge = "x".repeat(ARTIFACT_CONTENT_MAX_BYTES + 1);
    expect(() =>
      store.write({ projectId: PRJ, type: "demo", content: huge, source: "agent_output" })
    ).toThrow(ArtifactTooLargeError);
    const plan = store.write({ projectId: PRJ, type: "plan", content: huge, source: "agent_output" });
    try {
      getArtifactContent(db, store, plan.id, 1, PRJ);
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ArtifactAccessError);
      expect((err as ArtifactAccessError).status).toBe(413);
      expect((err as ArtifactAccessError).code).toBe("artifact_too_large");
    }
  });

  it("文件缺失 ENOENT ⇒ 404,消息不含绝对路径", () => {
    const a = store.write({ projectId: PRJ, type: "demo", content: "<p>ok</p>", source: "agent_output" });
    unlinkSync(a.path);
    try {
      getArtifactContent(db, store, a.id, 1, PRJ);
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ArtifactAccessError);
      expect((err as ArtifactAccessError).status).toBe(404);
      expect((err as ArtifactAccessError).message).not.toMatch(/\/Users\//);
      expect((err as ArtifactAccessError).message).not.toContain(a.path);
    }
  });
});
