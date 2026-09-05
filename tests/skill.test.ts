import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const skillRoot = resolve('.agents/skills/siteverb');

describe('Siteverb Agent Skill', () => {
  it('has valid discoverable frontmatter', async () => {
    const source = await readFile(resolve(skillRoot, 'SKILL.md'), 'utf8');
    const match = /^---\n([\s\S]*?)\n---\n/.exec(source);
    expect(match).not.toBeNull();
    const frontmatter = parse(match?.[1] ?? '');
    expect(frontmatter.name).toBe('siteverb');
    expect(frontmatter.description).toMatch(/WebMCP/);
    expect(frontmatter.description).toMatch(/agent-ready/);
    expect(frontmatter['user-invocable']).toBe(true);
  });

  it('keeps every referenced resource in the packaged skill', async () => {
    const source = await readFile(resolve(skillRoot, 'SKILL.md'), 'utf8');
    const references = Array.from(source.matchAll(/\]\(\.\/([^\s)]+)\)/g), (match) => match[1]);
    expect(references.length).toBeGreaterThan(5);
    await Promise.all(references.map((path) => access(resolve(skillRoot, path))));
  });

  it('contains the approval, safety, stable identity, and evidence boundaries', async () => {
    const source = await readFile(resolve(skillRoot, 'SKILL.md'), 'utf8');
    expect(source).toContain('before changing files or dependencies');
    expect(source).toContain('Wait for explicit approval');
    expect(source).toContain('stable `domain.action` IDs');
    expect(source).toContain('Registration visibility is not authorization');
    expect(source).toContain('verified`, `failed`, or `could-not-verify');
    expect(source).toContain('Never invoke mutations against production');
    expect(source).toMatch(/Approval to write\s+migration state is not approval/);
    expect(source).toContain('/siteverb full');
    expect(source).toContain('siteverb.webmcp.json');
    expect(source).toContain('never requires a Siteverb account');
  });

  it('ships resumable state and customer-run workflow templates', async () => {
    const state = JSON.parse(
      await readFile(resolve(skillRoot, 'assets/migration-state.json'), 'utf8'),
    );
    const workflow = parse(
      await readFile(resolve(skillRoot, 'assets/siteverb-workflow.yml'), 'utf8'),
    );
    const ignore = await readFile(resolve('.gitignore'), 'utf8');

    expect(state).toEqual(
      expect.objectContaining({
        version: 1,
        phase: 'inventory',
        coverage: 'curated',
        baseline: { sha: null, dirtyPaths: [] },
      }),
    );
    expect(workflow.permissions).toEqual({ contents: 'read' });
    expect(JSON.stringify(workflow)).toContain('siteverb/siteverb/actions/siteverb@v0.1.1');
    expect(ignore).toMatch(/^\.siteverb\/$/m);
  });

  it('documents the standalone conversion boundary before cloud', async () => {
    const guide = await readFile(resolve('docs/convert-a-site.md'), 'utf8');
    expect(guide).toContain('npx skills add siteverb/siteverb --skill siteverb');
    expect(guide).toContain('/siteverb full');
    expect(guide).toContain('siteverb.webmcp.json');
    expect(guide).toContain('It never contains source code, credentials');
    expect(guide).toContain('neither is required to make a website WebMCP-ready');
  });

  it('runs the deterministic inspector without writing project files', async () => {
    const module = resolve(skillRoot, 'scripts/inspect-project.mjs');
    const { spawnSync } = await import('node:child_process');
    const result = spawnSync(process.execPath, [module, process.cwd()], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.webmcpMatches).toEqual(expect.arrayContaining([expect.any(Object)]));
    expect(output.scannedFiles).toBeGreaterThan(0);
    expect(output.packageManager).toBe('npm');
    expect(output.lockfiles).toContainEqual({ file: 'package-lock.json', manager: 'npm' });
    expect(output.git).toEqual(
      expect.objectContaining({
        dirtyPaths: expect.any(Array),
        truncated: expect.any(Boolean),
      }),
    );
    expect(output.git.sha === null || /^[a-f0-9]{40,64}$/.test(output.git.sha)).toBe(true);
  });
});
