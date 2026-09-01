#!/usr/bin/env node

import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { parseProjectContract } from '@siteverb/contracts';
import type { ChromeReleaseChannel } from 'puppeteer-core';
import { runProject } from './run.js';

const HELP = `Usage: siteverb-run --contract <path> --url <url> [options]

Options:
  --output <path>          Report path (default: .siteverb/report.json)
  --journey <ids>         Comma-separated journey IDs
  --profile <ids>         Comma-separated versioned client profile IDs
  --chrome-channel <name> chrome, chrome-beta, chrome-canary, or chrome-dev
  --executable-path <path> Explicit Chrome executable
  --timeout <ms>           Navigation and tool timeout (default: 30000)
  --allow-mutations        Permit reversible/state-changing tools on this target
  --approve <tool-ids>     Comma-separated stable IDs approved for guarded steps
  --include-error-details  Include page-provided error messages in the local report
  --headed                 Show the browser window
  --help                   Show this message
`;

function commaList(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const entries = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return entries.length > 0 ? entries : undefined;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0)
    throw new TypeError('timeout must be positive.');
  return parsed;
}

const { values } = parseArgs({
  options: {
    contract: { type: 'string', short: 'c' },
    url: { type: 'string', short: 'u' },
    output: { type: 'string', short: 'o', default: '.siteverb/report.json' },
    journey: { type: 'string' },
    profile: { type: 'string' },
    'chrome-channel': { type: 'string', default: 'chrome' },
    'executable-path': { type: 'string' },
    timeout: { type: 'string', default: '30000' },
    'allow-mutations': { type: 'boolean', default: false },
    approve: { type: 'string' },
    'include-error-details': { type: 'boolean', default: false },
    headed: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
  strict: true,
  allowPositionals: false,
});

if (values.help) {
  process.stdout.write(HELP);
  process.exit(0);
}
if (!values.contract || !values.url) {
  process.stderr.write(`${HELP}\nBoth --contract and --url are required.\n`);
  process.exit(2);
}

try {
  const contractPath = resolve(values.contract);
  const outputPath = resolve(values.output);
  const contract = parseProjectContract(JSON.parse(await readFile(contractPath, 'utf8')));
  const journeyIds = commaList(values.journey);
  const profileIds = commaList(values.profile);
  const approvedTools = commaList(values.approve);
  const report = await runProject({
    contract,
    targetUrl: values.url,
    channel: values['chrome-channel'] as ChromeReleaseChannel,
    headless: !values.headed,
    timeoutMs: positiveInteger(values.timeout, 30_000),
    allowMutations: values['allow-mutations'],
    includeErrorDetails: values['include-error-details'],
    ...(values['executable-path'] === undefined
      ? {}
      : { executablePath: values['executable-path'] }),
    ...(journeyIds === undefined ? {} : { journeyIds }),
    ...(profileIds === undefined ? {} : { profileIds }),
    ...(approvedTools === undefined ? {} : { approvedTools }),
  });
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(
    `Siteverb: ${report.summary.passed} passed, ${report.summary.failed} failed, ${report.summary.skipped} skipped\nReport: ${outputPath}\n`,
  );
  process.exitCode = report.summary.failed > 0 ? 1 : 0;
} catch (error) {
  process.stderr.write(
    `Siteverb runner failed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 2;
}
