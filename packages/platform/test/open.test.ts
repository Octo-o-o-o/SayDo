import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openExternal } from "../src/open.js";

const roots: string[] = [];
afterEach(() => {
  delete process.env["SAYDO_OPEN_MARKER"];
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.length = 0;
});

describe("openExternal", () => {
  it("SAYDO_OPEN_MARKER 时写入 URL 且不抛", async () => {
    const root = mkdtempSync(join(tmpdir(), "saydo-open-"));
    roots.push(root);
    const marker = join(root, "open.marker");
    process.env["SAYDO_OPEN_MARKER"] = marker;
    await openExternal("http://localhost:47100/?token=abc");
    expect(readFileSync(marker, "utf8")).toBe("http://localhost:47100/?token=abc");
  });
});
