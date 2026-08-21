#!/usr/bin/env node
// 写死色值门禁自测(docs/11 §2.7):注入固件必红、token 写法不误伤。
import { mkdtempSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "check-hardcoded-colors.mjs");
const DIR = mkdtempSync(join(tmpdir(), "saydo-color-gate-"));
let pass = 0;
let fail = 0;

function run(file) {
  return spawnSync(process.execPath, [SCRIPT, file], { encoding: "utf8" });
}

function expectHit(file, label) {
  if (run(file).status === 0) {
    process.stdout.write(`[fail] ${label}: expected gate to catch, but it passed\n`);
    fail += 1;
  } else {
    process.stdout.write(`[ok] ${label}: caught as expected\n`);
    pass += 1;
  }
}

function expectClean(file, label) {
  const r = run(file);
  if (r.status === 0) {
    process.stdout.write(`[ok] ${label}: passed as expected\n`);
    pass += 1;
  } else {
    process.stdout.write(`[fail] ${label}: false positive\n`);
    if (r.stdout) process.stdout.write(r.stdout);
    fail += 1;
  }
}

try {
  writeFileSync(join(DIR, "hex6.css"), "a { color: #b13a2b; }\n");
  writeFileSync(join(DIR, "hex3.css"), "a { color: #fff; }\n");
  writeFileSync(join(DIR, "rgba.css"), "a { background: rgba(0, 0, 0, 0.45); }\n");
  writeFileSync(join(DIR, "rgbspace.css"), "a { background: rgb(52 51 46 / 42%); }\n");
  writeFileSync(join(DIR, "hsl.css"), "a { color: hsl(12 60% 40%); }\n");
  writeFileSync(join(DIR, "oklch.css"), "a { color: oklch(0.5 0.1 30); }\n");
  writeFileSync(join(DIR, "named.css"), "a { color: red; }\n");
  writeFileSync(join(DIR, "named-border.css"), "a { border: 1px solid white; }\n");
  writeFileSync(join(DIR, "inline.tsx"), 'const s = { color: "#34332e" };\n');
  writeFileSync(join(DIR, "tailwind.tsx"), 'const c = <b className="bg-[#f0ede4]" />;\n');
  writeFileSync(join(DIR, "shadow.tsx"), 'const s = { boxShadow: "0 1px 2px rgba(0,0,0,.2)" };\n');
  writeFileSync(join(DIR, "token.css"), "a { color: var(--text-primary); }\n");
  writeFileSync(join(DIR, "colormix.css"), "a { border: 1px solid color-mix(in srgb, var(--ink) 34%, transparent); }\n");
  writeFileSync(join(DIR, "keyword.css"), "a { background: transparent; border-color: currentColor; }\n");
  writeFileSync(join(DIR, "geometry.css"), "a { border-radius: 50%; opacity: 0.45; }\n");
  writeFileSync(join(DIR, "ballkey.tsx"), 'type B = { color: "orange" | "blue" | "green" | "gray" };\n');
  writeFileSync(join(DIR, "ballmap.tsx"), 'const m = { orange: "var(--color-warning)" };\n');
  writeFileSync(join(DIR, "tokenname.css"), "a { color: var(--m-green); background: var(--paper-fg); }\n");
  writeFileSync(join(DIR, "hash.tsx"), 'const h = "#/m/chat";\nconst n = <b>#{seq}</b>;\n');

  expectHit(join(DIR, "hex6.css"), "hex #rrggbb");
  expectHit(join(DIR, "hex3.css"), "hex #rgb");
  expectHit(join(DIR, "rgba.css"), "rgba()");
  expectHit(join(DIR, "rgbspace.css"), "rgb() space syntax");
  expectHit(join(DIR, "hsl.css"), "hsl()");
  expectHit(join(DIR, "oklch.css"), "oklch()");
  expectHit(join(DIR, "named.css"), "CSS named color");
  expectHit(join(DIR, "named-border.css"), "CSS named color in border");
  expectHit(join(DIR, "inline.tsx"), "hex in inline style");
  expectHit(join(DIR, "tailwind.tsx"), "tailwind arbitrary value");
  expectHit(join(DIR, "shadow.tsx"), "rgba in boxShadow");
  expectClean(join(DIR, "token.css"), "var() token");
  expectClean(join(DIR, "colormix.css"), "color-mix over token");
  expectClean(join(DIR, "keyword.css"), "transparent / currentColor");
  expectClean(join(DIR, "geometry.css"), "radius / opacity numbers");
  expectClean(join(DIR, "ballkey.tsx"), "ball color enum keys in tsx");
  expectClean(join(DIR, "ballmap.tsx"), "ball color map to tokens");
  expectClean(join(DIR, "tokenname.css"), "token name containing color word");
  expectClean(join(DIR, "hash.tsx"), "hash route / jsx sequence");

  copyFileSync(join(DIR, "hex6.css"), join(DIR, "tokens.css"));
  expectClean(join(DIR, "tokens.css"), "tokens.css whitelist");

  const missing = spawnSync(process.execPath, [SCRIPT, join(DIR, "does-not-exist.css")], { encoding: "utf8" });
  if (missing.status === 2) {
    process.stdout.write("[ok] missing file: exits 2\n");
    pass += 1;
  } else {
    process.stdout.write("[fail] missing file: expected exit 2\n");
    fail += 1;
  }

  process.stdout.write("---\n");
  process.stdout.write(`[summary] pass=${pass} fail=${fail}\n`);
  process.exit(fail === 0 ? 0 : 1);
} finally {
  rmSync(DIR, { recursive: true, force: true });
}
