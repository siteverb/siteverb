import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseRunReport } from '@siteverb/contracts';

const report = parseRunReport(JSON.parse(await readFile(process.argv[2], 'utf8')));
assert.deepEqual(report.summary, { passed: 1, failed: 0, skipped: 0 });
assert.equal(report.journeys[0]?.steps.length, 5);
assert.equal(report.journeys[0]?.cleanup.length, 1);
assert(report.journeys[0]?.steps.every((step) => step.status === 'passed'));
assert(report.journeys[0]?.cleanup.every((step) => step.status === 'passed'));
assert.equal(report.browser.evidence, 'real-browser');
assert.equal(report.browser.name, 'Chrome');
assert.match(report.browser.version, /^\d+(?:\.\d+){1,3}$/);
assert.deepEqual(
  Object.fromEntries(
    report.compatibility.map((assessment) => [assessment.profileId, assessment.status]),
  ),
  {
    'chrome-152-native': 'compatible',
    'chatgpt-site-tools-2026-08-26': 'compatible',
  },
);

const serialized = JSON.stringify(report);
assert(!serialized.includes('trail-shoe-11'));
assert(!serialized.includes('Trail shoe'));
process.stdout.write('Stateful Siteverb report passed.\n');
