import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { consoleArtifactReady, consoleDistDirectory } from "../src/runtimeAssets.js";

describe("distributed console artifact", () => {
  it("只有 index 与其全部 hash asset 同时存在才算 core ready", () => {
    const root = mkdtempSync(join(tmpdir(), "saydo-runtime-assets-"));
    const dist = join(root, "console");
    mkdirSync(join(dist, "assets"), { recursive: true });
    writeFileSync(join(dist, "index.html"), '<script src="/assets/app-123.js"></script>');
    expect(consoleDistDirectory(root)).toBe(dist);
    expect(consoleArtifactReady(root)).toBe(false);
    writeFileSync(join(dist, "assets", "app-123.js"), "export {};");
    expect(consoleArtifactReady(root)).toBe(true);
  });
});
