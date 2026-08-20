import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import {
  RUNTIME_PROTOCOL_VERSION,
  runtimeIdentitySchema,
  type RuntimeIdentity
} from "@saydo/contracts";

declare const __SAYDO_SOURCE_REVISION__: string | undefined;
declare const __SAYDO_BUILD_ID__: string | undefined;
declare const __SAYDO_PROTOCOL_VERSION__: string | undefined;

function developmentSourceRevision(): string {
  const revision = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: resolve(import.meta.dirname, "..", "..", ".."),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
  if (!/^[0-9a-f]{40}$/.test(revision)) throw new Error(`无法证明 daemon source revision:${revision}`);
  return revision;
}

const sourceRevision =
  typeof __SAYDO_SOURCE_REVISION__ === "string"
    ? __SAYDO_SOURCE_REVISION__
    : developmentSourceRevision();
const buildId =
  typeof __SAYDO_BUILD_ID__ === "string"
    ? __SAYDO_BUILD_ID__
    : `dev-${sourceRevision.slice(0, 12)}`;
const protocolVersion =
  typeof __SAYDO_PROTOCOL_VERSION__ === "string"
    ? __SAYDO_PROTOCOL_VERSION__
    : RUNTIME_PROTOCOL_VERSION;

export const RUNTIME_IDENTITY: RuntimeIdentity = runtimeIdentitySchema.parse({
  sourceRevision,
  buildId,
  protocolVersion
});
