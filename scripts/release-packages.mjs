#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const packageNames = [
  '@siteverb/contracts',
  '@siteverb/webmcp',
  '@siteverb/react',
  '@siteverb/profiles',
  '@siteverb/audit',
  '@siteverb/runner',
];
const packages = await Promise.all(
  packageNames.map(async (name) => {
    const directory = `packages/${name.slice('@siteverb/'.length)}`;
    return {
      name,
      manifest: JSON.parse(await readFile(`${directory}/package.json`, 'utf8')),
    };
  }),
);
const versions = new Set(packages.map(({ manifest }) => manifest.version));
if (versions.size !== 1) throw new Error('All public packages must use one fixed release version.');
const [version] = versions;
const distTag = version.includes('-') ? 'next' : 'latest';

for (const { name, manifest } of packages) {
  for (const dependencyType of ['dependencies', 'peerDependencies']) {
    for (const [dependency, range] of Object.entries(manifest[dependencyType] ?? {})) {
      if (packageNames.includes(dependency) && range !== `^${version}`) {
        throw new Error(
          `${name} must depend on ${dependency} with ^${version}, observed ${range}.`,
        );
      }
    }
  }
}

const tagIndex = process.argv.indexOf('--check-tag');
const suppliedTag = tagIndex >= 0 ? process.argv[tagIndex + 1] : process.env.GITHUB_REF_NAME;
if (tagIndex >= 0 || process.argv.includes('--publish')) {
  if (suppliedTag !== `v${version}`) {
    throw new Error(`Release tag must be v${version}; observed ${suppliedTag ?? 'none'}.`);
  }
}

if (process.argv.includes('--publish')) {
  if (process.env.GITHUB_ACTIONS !== 'true' || process.env.GITHUB_REF_TYPE !== 'tag') {
    throw new Error('Publishing is restricted to a tagged GitHub Actions release.');
  }
  for (const { name } of packages) {
    const existingResult = spawnSync(
      'npm',
      [
        'view',
        `${name}@${version}`,
        'version',
        'gitHead',
        '--json',
        '--registry',
        'https://registry.npmjs.org/',
      ],
      { encoding: 'utf8' },
    );
    if (existingResult.status === 0) {
      const existing = JSON.parse(existingResult.stdout);
      if (existing.version !== version || existing.gitHead !== process.env.GITHUB_SHA) {
        throw new Error(`${name}@${version} already exists from a different commit.`);
      }
      process.stdout.write(`Skipping ${name}@${version}; it is already published.\n`);
      continue;
    }
    const result = spawnSync(
      'npm',
      [
        'publish',
        '--workspace',
        name,
        '--access',
        'public',
        '--tag',
        distTag,
        '--provenance',
        '--registry',
        'https://registry.npmjs.org/',
      ],
      { stdio: 'inherit' },
    );
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
} else {
  process.stdout.write(`Release train ${version} (${distTag}): ${packageNames.join(', ')}\n`);
}
