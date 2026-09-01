import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { format, resolveConfig } from 'prettier';
import { parse } from 'yaml';
import { projectContractJsonSchema, runReportJsonSchema } from '@siteverb/contracts';

const releaseVersion = JSON.parse(readFileSync(resolve('packages/contracts/package.json'), 'utf8'))
  .version as string;
const releaseDistTag = releaseVersion.includes('-') ? 'next' : 'latest';

describe('release train', () => {
  it('keeps public packages on one compatible version', () => {
    const result = spawnSync(process.execPath, ['scripts/release-packages.mjs'], {
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`Release train ${releaseVersion}`);
    expect(result.stdout).toContain(`(${releaseDistTag})`);
  });

  it('rejects a release tag that differs from package versions', () => {
    const result = spawnSync(
      process.execPath,
      ['scripts/release-packages.mjs', '--check-tag', 'v9.9.9'],
      { encoding: 'utf8' },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(`Release tag must be v${releaseVersion}`);
  });

  it('uses OIDC permissions and no long-lived npm token', async () => {
    const source = await readFile(resolve('.github/workflows/release.yml'), 'utf8');
    const workflow = parse(source);
    expect(workflow.permissions).toEqual({ contents: 'read', 'id-token': 'write' });
    expect(source).not.toContain('NPM_TOKEN');
    expect(source).not.toContain('cache: npm');
    expect(source).toContain('node scripts/release-packages.mjs --check-tag "$GITHUB_REF_NAME"');
    expect(source).toContain('node scripts/release-packages.mjs --publish');
  });

  it('pins every executable third-party Action to an immutable commit', async () => {
    const paths = [
      '.github/workflows/ci.yml',
      '.github/workflows/codeql.yml',
      '.github/workflows/release.yml',
      '.agents/skills/siteverb/assets/siteverb-workflow.yml',
      'actions/siteverb/action.yml',
      'actions/siteverb/example-workflow.yml',
    ];
    for (const path of paths) {
      const source = await readFile(resolve(path), 'utf8');
      const references = Array.from(source.matchAll(/\buses:\s*([^\s#]+)/g), (match) => match[1]);
      expect(references.length, path).toBeGreaterThan(0);
      for (const reference of references) {
        if (reference === 'siteverb/siteverb/actions/siteverb@v0.1.0') continue;
        expect(reference, `${path}: ${reference}`).toMatch(
          /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)?@[a-f0-9]{40}$/,
        );
      }
    }
  });

  it('keeps generated contract schemas synchronized and format-stable', async () => {
    const schemas = [
      ['packages/contracts/schema/siteverb.webmcp.schema.json', projectContractJsonSchema],
      ['packages/contracts/schema/report.schema.json', runReportJsonSchema],
    ] as const;

    for (const [path, expected] of schemas) {
      const absolutePath = resolve(path);
      const source = await readFile(absolutePath, 'utf8');
      expect(JSON.parse(source)).toEqual(expected);
      const options = (await resolveConfig(absolutePath)) ?? {};
      expect(await format(JSON.stringify(expected), { ...options, filepath: absolutePath })).toBe(
        source,
      );
    }
  });
  it('uses canonical executable bin mappings for the public CLIs', async () => {
    const manifests = [
      ['packages/audit/package.json', { 'siteverb-audit': 'dist/cli.js' }],
      ['packages/runner/package.json', { 'siteverb-run': 'dist/cli.js' }],
    ] as const;

    for (const [path, expected] of manifests) {
      const manifest = JSON.parse(await readFile(resolve(path), 'utf8'));
      expect(manifest.bin).toEqual(expected);
    }
  });

  it('builds dependency types first and cleans every public package output', async () => {
    const rootManifest = JSON.parse(await readFile(resolve('package.json'), 'utf8'));
    expect(rootManifest.scripts.typecheck).toContain(
      'npm run build --workspace @siteverb/contracts',
    );
    expect(rootManifest.scripts.typecheck).toContain('npm run build --workspace @siteverb/webmcp');
    expect(rootManifest.scripts.typecheck).toContain(
      'npm run build --workspace @siteverb/profiles',
    );

    for (const name of ['contracts', 'webmcp', 'react', 'profiles', 'audit', 'runner']) {
      const manifest = JSON.parse(await readFile(resolve(`packages/${name}/package.json`), 'utf8'));
      expect(manifest.scripts.build).toMatch(
        /^node \.\.\/\.\.\/scripts\/clean-package-dist\.mjs && /,
      );
    }
  });

  it('routes prereleases to next and only resumes packages from the same commit', async () => {
    const source = await readFile(resolve('scripts/release-packages.mjs'), 'utf8');
    expect(source).toContain("version.includes('-') ? 'next' : 'latest'");
    expect(source).toContain('existing.gitHead !== process.env.GITHUB_SHA');
    expect(source).toContain("'--tag',");
    expect(source).toContain('distTag,');
  });
});
