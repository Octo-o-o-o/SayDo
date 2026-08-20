import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "..", "..");
const pkg = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));

// B1: 单一不可变 snapshot 同时派生协议、版本与 digest。
const snapshot = {
  runtimeContract: readFileSync(join(repoRoot, "packages", "contracts", "src", "runtime.ts"), "utf8"),
  packageJson: pkg,
  buildInputs: [
    "packages/cli",
    "packages/console",
    "packages/contracts",
    "packages/daemon",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "tsconfig.base.json",
    "eslint.config.mjs"
  ]
};

const defaultProtocolVersion = /RUNTIME_PROTOCOL_VERSION\s*=\s*"(\d+\.\d+\.\d+)"/.exec(snapshot.runtimeContract)?.[1];
if (!defaultProtocolVersion) throw new Error("cannot read RUNTIME_PROTOCOL_VERSION from contracts");

// C1: 声明的单文件 build input 必须存在，禁止空 pathspec 静默通过。
for (const input of snapshot.buildInputs) {
  const base = input.split("/").pop() ?? "";
  const isFileClaim = /\.[a-z0-9]+$/i.test(base);
  if (isFileClaim && !existsSync(join(repoRoot, input))) {
    throw new Error(`build input missing:${input}`);
  }
}

function listBuildFiles() {
  // B1: NUL framing，避免非 ASCII/换行路径被 C-quote 成假 <deleted>。
  const raw = execFileSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", ...snapshot.buildInputs],
    { cwd: repoRoot }
  );
  const files = [];
  let start = 0;
  for (let i = 0; i < raw.length; i += 1) {
    if (raw[i] === 0) {
      if (i > start) files.push(raw.subarray(start, i).toString("utf8"));
      start = i + 1;
    }
  }
  if (start < raw.length) files.push(raw.subarray(start).toString("utf8"));
  return files.sort();
}

function contentRevision(files) {
  const hash = createHash("sha256");
  const fileOnly = [];
  for (const path of files) {
    const absolute = join(repoRoot, path);
    if (!existsSync(absolute)) throw new Error(`build input listed but missing:${path}`);
    const st = statSync(absolute);
    if (st.isDirectory()) continue; // git ls-files 偶发目录项；digest 只吃文件。
    fileOnly.push(path);
    const content = readFileSync(absolute);
    const fileDigest = createHash("sha256").update(content).digest("hex");
    hash.update(JSON.stringify([path, fileDigest])).update("\n");
  }
  return { digest: hash.digest("hex"), files: fileOnly };
}

const listed = listBuildFiles();
const { digest: inputDigest, files: snapshotFiles } = contentRevision(listed);
const snapshotFileSet = new Set(snapshotFiles);
if (process.env.SAYDO_SOURCE_REVISION && process.env.SAYDO_SOURCE_REVISION !== inputDigest) {
  throw new Error("SAYDO_SOURCE_REVISION must equal the canonical build-input digest");
}
const sourceRevision = inputDigest;
if (!/^[0-9a-f]{7,64}$/.test(sourceRevision)) throw new Error(`invalid source revision:${sourceRevision}`);
const protocolVersion = process.env.SAYDO_PROTOCOL_VERSION ?? defaultProtocolVersion;
if (!/^\d+\.\d+\.\d+$/.test(protocolVersion)) throw new Error(`invalid protocol version:${protocolVersion}`);
const buildLabel = process.env.SAYDO_BUILD_ID ?? `${snapshot.packageJson.version}+${sourceRevision.slice(0, 12)}`;
if (!/^[A-Za-z0-9._+-]{1,80}$/.test(buildLabel)) throw new Error(`invalid build label:${buildLabel}`);
const buildId = `${buildLabel}.p${protocolVersion.replaceAll(".", "-")}.c${inputDigest.slice(0, 12)}`;
if (buildId.length > 128) throw new Error("build id exceeds runtime contract limit");
const dist = join(packageRoot, "dist");
rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, "runtime"), { recursive: true });

execFileSync("pnpm", ["--filter", "@saydo/console", "build"], { cwd: repoRoot, stdio: "inherit" });
cpSync(join(repoRoot, "packages", "console", "dist"), join(dist, "console"), { recursive: true });

const daemonBuild = await build({
  entryPoints: [join(repoRoot, "packages", "daemon", "src", "index.ts")],
  outfile: join(dist, "runtime", "daemon.mjs"),
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  external: ["better-sqlite3"],
  metafile: true,
  banner: {
    js: 'import { createRequire as __saydoCreateRequire } from "node:module";const require=__saydoCreateRequire(import.meta.url);'
  },
  sourcemap: false,
  define: {
    __SAYDO_SOURCE_REVISION__: JSON.stringify(sourceRevision),
    __SAYDO_BUILD_ID__: JSON.stringify(buildId),
    __SAYDO_PROTOCOL_VERSION__: JSON.stringify(protocolVersion)
  }
});

const cliBuild = await build({
  entryPoints: [join(packageRoot, "src", "cli.ts")],
  outfile: join(dist, "cli.mjs"),
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  metafile: true,
  banner: { js: "#!/usr/bin/env node" },
  define: {
    __SAYDO_PROTOCOL_VERSION__: JSON.stringify(protocolVersion)
  }
});

// B1: esbuild metafile 闭包——repo-local 实际输入必须在 digest 集合内。
function assertMetafileClosure(metafile, label) {
  const inputs = Object.keys(metafile.inputs ?? {});
  const missing = [];
  for (const input of inputs) {
    const absolute = resolve(input.startsWith(sep) || /^[A-Za-z]:[\\/]/.test(input) ? input : join(process.cwd(), input));
    if (!absolute.startsWith(repoRoot + sep) && absolute !== repoRoot) continue;
    if (absolute.includes(`${sep}node_modules${sep}`) || absolute.startsWith(dist + sep)) continue;
    const rel = relative(repoRoot, absolute);
    if (!snapshotFileSet.has(rel)) missing.push(rel);
  }
  if (missing.length > 0) {
    rmSync(dist, { recursive: true, force: true });
    throw new Error(`${label} metafile inputs outside digest set:${missing.slice(0, 8).join(",")}`);
  }
}
assertMetafileClosure(daemonBuild.metafile, "daemon");
assertMetafileClosure(cliBuild.metafile, "cli");

const finalListed = listBuildFiles();
const { digest: finalInputDigest } = contentRevision(finalListed);
if (finalInputDigest !== inputDigest) {
  rmSync(dist, { recursive: true, force: true });
  throw new Error(`build inputs changed during build:${inputDigest.slice(0, 12)}→${finalInputDigest.slice(0, 12)}`);
}
