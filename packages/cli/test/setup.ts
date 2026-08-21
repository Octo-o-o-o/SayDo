import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll } from "vitest";
import { nativeSync, setRestrictOwnerOnlyForTests } from "@saydo/platform";

if (process.platform === "win32") {
  nativeSync();
  setRestrictOwnerOnlyForTests(() => undefined);
}

const tmpRoot = mkdtempSync(join(realpathSync(tmpdir()), "saydo-cli-vitest-"));
process.env["TMPDIR"] = tmpRoot;
process.env["TEMP"] = tmpRoot;
process.env["TMP"] = tmpRoot;

const cleanup = () => {
  rmSync(tmpRoot, { recursive: true, force: true });
  setRestrictOwnerOnlyForTests(null);
};
afterAll(cleanup);
process.on("exit", cleanup);
