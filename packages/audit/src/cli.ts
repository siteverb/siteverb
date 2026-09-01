#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { auditProject } from './audit.js';

const HELP = `Usage: siteverb-audit [options]

Options:
  --root <path>       Project root (default: current directory)
  --contract <path>   Contract relative to root (default: siteverb.webmcp.json)
  --output <path>     Optional JSON report path relative to root
  --strict-external   Treat known third-party registration runtimes as errors
  --help              Show this message
`;

const { values } = parseArgs({
  options: {
    root: { type: 'string', default: '.' },
    contract: { type: 'string', default: 'siteverb.webmcp.json' },
    output: { type: 'string' },
    'strict-external': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
  strict: true,
});

if (values.help) {
  process.stdout.write(HELP);
  process.exit(0);
}

try {
  const root = resolve(values.root);
  const report = await auditProject({
    root,
    contractPath: values.contract,
    strictExternal: values['strict-external'],
  });
  for (const finding of report.findings) {
    const location = finding.line ? `:${finding.line}:${finding.column ?? 1}` : '';
    process.stdout.write(
      `${finding.severity.toUpperCase()} ${finding.code} ${finding.file}${location} ${finding.message}\n`,
    );
  }
  process.stdout.write(
    `Siteverb audit: ${report.summary.errors} errors, ${report.summary.warnings} warnings, ${report.summary.sourceTools}/${report.summary.contractTools} source/contract tools\n`,
  );
  if (values.output) {
    const output = resolve(root, values.output);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  }
  process.exitCode = report.summary.errors > 0 ? 1 : 0;
} catch (error) {
  process.stderr.write(
    `Siteverb audit failed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 2;
}
