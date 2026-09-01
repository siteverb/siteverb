#!/usr/bin/env node

import { access, readFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { relative, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? process.cwd());
const ignored = new Set([
  '.git',
  '.next',
  '.output',
  '.siteverb',
  '.svelte-kit',
  'coverage',
  'dist',
  'node_modules',
]);
const signals = [
  'document.modelContext',
  'navigator.modelContext',
  'registerTool',
  'defineTool',
  'registerTools',
  'toolname',
  '@siteverb/webmcp',
  '@nekuda/webmcp',
  '@agentlane/webmcp',
  '@mcp-b/',
  'usewebmcp',
  'useWebMCP',
  'useSiteverbTool',
  'useSiteverbTools',
  'latch',
  'sodium',
];

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return undefined;
  }
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function gitOutput(args) {
  const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : undefined;
}

async function walk(directory, files, limit = 2_000) {
  if (files.length >= limit) return;
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (files.length >= limit) return;
    if (entry.isSymbolicLink() || ignored.has(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await walk(path, files, limit);
    else if (/\.(?:html?|jsx?|tsx?|vue|svelte|json)$/i.test(entry.name)) files.push(path);
  }
}

const packageJson = await readJson(resolve(root, 'package.json'));
const dependencies = {
  ...(packageJson?.dependencies ?? {}),
  ...(packageJson?.devDependencies ?? {}),
};
const frameworks = ['next', 'react', 'vue', 'svelte', '@sveltejs/kit', '@angular/core'].filter(
  (name) => dependencies[name],
);
const lockfileCandidates = [
  ['package-lock.json', 'npm'],
  ['npm-shrinkwrap.json', 'npm'],
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['bun.lock', 'bun'],
  ['bun.lockb', 'bun'],
];
const lockfiles = [];
for (const [file, manager] of lockfileCandidates) {
  if (await exists(resolve(root, file))) lockfiles.push({ file, manager });
}
const declaredPackageManager = packageJson?.packageManager?.split('@')[0];
const inferredManagers = [...new Set(lockfiles.map(({ manager }) => manager))];
const packageManager =
  declaredPackageManager ?? (inferredManagers.length === 1 ? inferredManagers[0] : undefined);
const gitRoot = gitOutput(['rev-parse', '--show-toplevel']);
const gitSha = gitOutput(['rev-parse', 'HEAD']);
const dirtyLines = (gitOutput(['status', '--short', '--untracked-files=all']) ?? '')
  .split('\n')
  .filter(Boolean);
const dirtyLimit = 2_000;
const files = [];
await walk(root, files);
const matches = [];
for (const path of files) {
  let source;
  try {
    source = await readFile(path, 'utf8');
  } catch {
    continue;
  }
  const found = signals.filter((signal) => source.includes(signal));
  if (found.length > 0) matches.push({ file: relative(root, path), signals: found });
}

process.stdout.write(
  `${JSON.stringify(
    {
      root,
      packageManager: packageManager ?? 'detect from lockfile',
      packageManagerConflict: !declaredPackageManager && inferredManagers.length > 1,
      lockfiles,
      frameworks,
      scripts: packageJson?.scripts ?? {},
      git: {
        root: gitRoot ?? null,
        sha: gitSha ?? null,
        dirtyPaths: dirtyLines.slice(0, dirtyLimit).map((line) => line.slice(3)),
        truncated: dirtyLines.length > dirtyLimit,
      },
      webmcpMatches: matches,
      scannedFiles: files.length,
      truncated: files.length >= 2_000,
    },
    null,
    2,
  )}\n`,
);
