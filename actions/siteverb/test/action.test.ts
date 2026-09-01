import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const actionRoot = resolve(import.meta.dirname, '..');
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true })));
});

describe('Siteverb composite action', () => {
  it('pins third-party actions and preserves the runner conclusion', async () => {
    const source = await readFile(resolve(actionRoot, 'action.yml'), 'utf8');
    const action = parse(source);
    expect(action.runs.using).toBe('composite');
    expect(action.branding).toEqual({ icon: 'check-circle', color: 'green' });
    expect(source).toContain('actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444 # v5');
    expect(source).toContain(
      'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4',
    );
    expect(source).toContain('npm exec --yes --package');
    expect(source).toContain('@siteverb/audit@$SITEVERB_AUDIT_VERSION');
    expect(source).not.toContain('pull_request_target');
    expect(source).toContain('SITEVERB_AUDIT_EXIT_CODE');
    expect(source).toContain("inputs.audit == 'true'");
    expect(source).toContain("inputs.audit != 'true'");
  });

  it('renders a bounded GitHub summary and outputs', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'siteverb-action-'));
    temporaryDirectories.push(directory);
    const reportPath = join(directory, 'report.json');
    const summaryPath = join(directory, 'summary.md');
    const outputPath = join(directory, 'output.txt');
    const auditPath = join(directory, 'audit.json');
    await writeFile(
      reportPath,
      JSON.stringify({
        version: 1,
        project: 'example',
        browser: { name: 'Chrome', version: '151.0.0.0', evidence: 'real-browser' },
        summary: { passed: 1, failed: 0, skipped: 0 },
        journeys: [{ name: 'Search | catalog', status: 'passed', durationMs: 42 }],
      }),
    );
    await writeFile(
      auditPath,
      JSON.stringify({
        version: 1,
        summary: { errors: 0, warnings: 1, sourceTools: 2, contractTools: 2 },
      }),
    );

    const result = spawnSync(process.execPath, [resolve(actionRoot, 'report-summary.mjs')], {
      env: {
        ...process.env,
        SITEVERB_REPORT: reportPath,
        SITEVERB_AUDIT_REPORT: auditPath,
        GITHUB_STEP_SUMMARY: summaryPath,
        GITHUB_OUTPUT: outputPath,
      },
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    const summary = await readFile(summaryPath, 'utf8');
    expect(summary).toContain('| PASS | Search \\| catalog | 42 ms |');
    expect(summary).toContain('0 errors · 1 warnings · 2/2 source/contract tools');
    expect(await readFile(outputPath, 'utf8')).toBe('passed=1\nfailed=0\n');
  });

  it('renders untrusted report labels as bounded plain text', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'siteverb-action-'));
    temporaryDirectories.push(directory);
    const reportPath = join(directory, 'report.json');
    const summaryPath = join(directory, 'summary.md');
    await writeFile(
      reportPath,
      JSON.stringify({
        version: 1,
        project: 'example',
        browser: {
          name: '<img src="https://attacker.test/pixel">',
          version: '152',
          evidence: 'real-browser',
        },
        summary: { passed: 0, failed: 1, skipped: 0 },
        journeys: [
          {
            name: 'Failure | row\n![pixel](https://attacker.test/pixel)',
            status: 'failed',
            durationMs: 42,
          },
        ],
      }),
    );

    const result = spawnSync(process.execPath, [resolve(actionRoot, 'report-summary.mjs')], {
      env: {
        ...process.env,
        SITEVERB_REPORT: reportPath,
        SITEVERB_AUDIT_ENABLED: 'false',
        GITHUB_STEP_SUMMARY: summaryPath,
      },
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    const summary = await readFile(summaryPath, 'utf8');
    expect(summary).toContain('&lt;img src="https://attacker.test/pixel"&gt;');
    expect(summary).toContain('Failure \\| row &#33;&#91;pixel&#93;');
    expect(summary).not.toContain('<img');
    expect(summary).not.toContain('\n![');
  });

  it('writes a useful summary when the runner report is unavailable', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'siteverb-action-'));
    temporaryDirectories.push(directory);
    const summaryPath = join(directory, 'summary.md');
    const outputPath = join(directory, 'output.txt');
    const result = spawnSync(process.execPath, [resolve(actionRoot, 'report-summary.mjs')], {
      env: {
        ...process.env,
        SITEVERB_REPORT: join(directory, 'missing.json'),
        SITEVERB_AUDIT_ENABLED: 'false',
        GITHUB_STEP_SUMMARY: summaryPath,
        GITHUB_OUTPUT: outputPath,
      },
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(await readFile(summaryPath, 'utf8')).toContain('Runner report unavailable or invalid.');
    expect(await readFile(outputPath, 'utf8')).toBe('passed=0\nfailed=0\n');
  });

  it('treats malformed optional compatibility data as an invalid report', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'siteverb-action-'));
    temporaryDirectories.push(directory);
    const reportPath = join(directory, 'report.json');
    const summaryPath = join(directory, 'summary.md');
    await writeFile(
      reportPath,
      JSON.stringify({
        version: 1,
        project: 'example',
        browser: { name: 'Chrome', version: '152', evidence: 'real-browser' },
        summary: { passed: 0, failed: 0, skipped: 0 },
        journeys: [],
        compatibility: {},
      }),
    );
    const result = spawnSync(process.execPath, [resolve(actionRoot, 'report-summary.mjs')], {
      env: {
        ...process.env,
        SITEVERB_REPORT: reportPath,
        SITEVERB_AUDIT_ENABLED: 'false',
        GITHUB_STEP_SUMMARY: summaryPath,
      },
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(await readFile(summaryPath, 'utf8')).toContain('Runner report unavailable or invalid.');
  });

  it('rejects an oversized journey collection instead of rendering unbounded rows', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'siteverb-action-'));
    temporaryDirectories.push(directory);
    const reportPath = join(directory, 'report.json');
    const summaryPath = join(directory, 'summary.md');
    const journeys = Array.from({ length: 201 }, (_, index) => ({
      name: `Journey ${index}`,
      status: 'passed',
      durationMs: 1,
    }));
    await writeFile(
      reportPath,
      JSON.stringify({
        version: 1,
        project: 'example',
        browser: { name: 'Chrome', version: '152', evidence: 'real-browser' },
        summary: { passed: journeys.length, failed: 0, skipped: 0 },
        journeys,
      }),
    );
    const result = spawnSync(process.execPath, [resolve(actionRoot, 'report-summary.mjs')], {
      env: {
        ...process.env,
        SITEVERB_REPORT: reportPath,
        SITEVERB_AUDIT_ENABLED: 'false',
        GITHUB_STEP_SUMMARY: summaryPath,
      },
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(await readFile(summaryPath, 'utf8')).toContain('Runner report unavailable or invalid.');
  });
});
