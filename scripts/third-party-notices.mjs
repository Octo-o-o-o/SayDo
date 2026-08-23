#!/usr/bin/env node

import { createRequire } from "node:module";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const mode = process.argv[2];
if (!['--write', '--check'].includes(mode)) {
  console.error('用法:node scripts/third-party-notices.mjs <--write|--check>');
  process.exit(2);
}

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(repo, 'packages', 'cli', 'THIRD_PARTY_NOTICES.md');
const workspaceRoots = ['cli', 'console', 'contracts', 'daemon', 'platform'].map((name) =>
  join(repo, 'packages', name)
);

function packageJson(root) {
  return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
}

function findPackageRoot(name, fromRoot) {
  const require = createRequire(join(fromRoot, 'package.json'));
  try {
    return dirname(require.resolve(`${name}/package.json`));
  } catch {
    let current = dirname(require.resolve(name));
    while (current !== dirname(current)) {
      const manifest = join(current, 'package.json');
      if (existsSync(manifest)) {
        try {
          if (JSON.parse(readFileSync(manifest, 'utf8')).name === name) return current;
        } catch {
          // 继续向上找同名 package 根。
        }
      }
      current = dirname(current);
    }
    throw new Error(`无法定位第三方包:${name} (from ${packageJson(fromRoot).name})`);
  }
}

const queue = [];
for (const root of workspaceRoots) {
  const manifest = packageJson(root);
  for (const name of Object.keys(manifest.dependencies ?? {})) {
    if (!name.startsWith('@saydo/')) queue.push({ name, fromRoot: root, optional: false });
  }
}

const packages = new Map();
const missingOptional = [];
while (queue.length > 0) {
  const item = queue.shift();
  let root;
  try {
    root = findPackageRoot(item.name, item.fromRoot);
  } catch (err) {
    if (item.optional) {
      missingOptional.push(item);
      continue;
    }
    throw err;
  }
  const manifest = packageJson(root);
  const key = `${manifest.name}@${manifest.version}`;
  if (packages.has(key)) continue;
  const licenseFiles = readdirSync(root)
    .filter((name) => /^(LICENSE|LICENCE|COPYING|NOTICE)(?:[._-].*)?$/iu.test(name))
    .sort((a, b) => a.localeCompare(b, 'en'));
  packages.set(key, {
    key,
    root,
    license: typeof manifest.license === 'string' ? manifest.license : '未声明',
    repository:
      typeof manifest.repository === 'string'
        ? manifest.repository
        : typeof manifest.repository?.url === 'string'
          ? manifest.repository.url.replace(/^git\+/, '').replace(/\.git$/, '')
          : '',
    licenseFiles
  });
  for (const name of Object.keys(manifest.dependencies ?? {})) {
    if (!name.startsWith('@saydo/')) queue.push({ name, fromRoot: root, optional: false });
  }
  for (const name of Object.keys(manifest.optionalDependencies ?? {})) {
    if (!name.startsWith('@saydo/')) {
      queue.push({ name, fromRoot: root, optional: true, version: manifest.optionalDependencies[name] });
    }
  }
}

// Koffi 按安装机只落一个原生平台包；发布物支持多平台，许可证清单必须覆盖其全部可选平台包。
// 所有平台包统一继承父 koffi 包的许可证材料，不能让当前机器恰好安装的那个平台包改变受控输出。
const koffi = packages.get('koffi@3.1.6');
if (koffi) {
  const koffiManifest = packageJson(koffi.root);
  for (const [name, version] of Object.entries(koffiManifest.optionalDependencies ?? {})) {
    if (!name.startsWith('@koromix/koffi-') || typeof version !== 'string') continue;
    const key = `${name}@${version}`;
    packages.set(key, { ...koffi, key });
  }
  const platformEntries = [...packages.values()].filter((item) => item.key.startsWith('@koromix/koffi-'));
  if (
    platformEntries.length === 0 ||
    platformEntries.some(
      (item) =>
        item.root !== koffi.root ||
        item.license !== koffi.license ||
        item.repository !== koffi.repository ||
        item.licenseFiles.join('\0') !== koffi.licenseFiles.join('\0')
    )
  ) {
    throw new Error('Koffi 平台包许可证归并不确定');
  }
}

const sorted = [...packages.values()].sort((a, b) => a.key.localeCompare(b.key, 'en'));
const lines = [
  '# Third-Party Notices',
  '',
  'This file is generated from the production dependency closure by',
  '`node scripts/third-party-notices.mjs --write`. Each component remains under its own license.',
  '',
  '| Package | Declared license | Repository |',
  '|---|---|---|'
];
for (const item of sorted) {
  lines.push(`| \`${item.key}\` | \`${item.license}\` | ${item.repository || '-'} |`);
}
for (const item of sorted) {
  lines.push('', `## ${item.key}`, '');
  if (item.licenseFiles.length === 0) {
    lines.push(`Package manifest declares \`${item.license}\`; no standalone license text was present in the installed package.`);
    continue;
  }
  for (const filename of item.licenseFiles) {
    lines.push(`### ${filename}`, '');
    const text = readFileSync(join(item.root, filename), 'utf8').replace(/\s+$/u, '');
    for (const line of text.split(/\r?\n/u)) {
      lines.push(line.length === 0 ? '' : `    ${line}`);
    }
  }
}
const expected = `${lines.join('\n')}\n`;

if (mode === '--write') {
  writeFileSync(output, expected);
  console.log(`[ok] third-party notices written: packages=${sorted.length}`);
  process.exit(0);
}

let actual = '';
try {
  actual = readFileSync(output, 'utf8');
} catch {
  console.error('[fail] 缺 packages/cli/THIRD_PARTY_NOTICES.md');
  process.exit(1);
}
if (actual !== expected) {
  console.error('[fail] THIRD_PARTY_NOTICES.md 与当前生产依赖闭包不一致');
  process.exit(1);
}
console.log(`[ok] third-party notices verified: packages=${sorted.length}`);
