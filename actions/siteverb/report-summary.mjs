import { appendFile, readFile } from 'node:fs/promises';

const reportPath = process.env.SITEVERB_REPORT;
if (!reportPath) throw new Error('SITEVERB_REPORT is required.');

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isCount(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function plainCell(value, maxLength = 200) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('!', '&#33;')
    .replaceAll('[', '&#91;')
    .replaceAll(']', '&#93;')
    .replaceAll('|', '\\|')
    .replaceAll(/[\u0000-\u001f\u007f]+/g, ' ')
    .slice(0, maxLength);
}

async function readJson(path) {
  try {
    const source = await readFile(path, 'utf8');
    if (Buffer.byteLength(source) > 10_000_000) return undefined;
    return JSON.parse(source);
  } catch {
    return undefined;
  }
}

function isValidReport(report) {
  if (
    !isRecord(report) ||
    report.version !== 1 ||
    typeof report.project !== 'string' ||
    !isRecord(report.browser) ||
    typeof report.browser.name !== 'string' ||
    typeof report.browser.version !== 'string' ||
    typeof report.browser.evidence !== 'string' ||
    !isRecord(report.summary) ||
    !isCount(report.summary.passed) ||
    !isCount(report.summary.failed) ||
    !isCount(report.summary.skipped) ||
    !Array.isArray(report.journeys) ||
    report.journeys.length > 200
  ) {
    return false;
  }
  if (
    !report.journeys.every(
      (journey) =>
        isRecord(journey) &&
        typeof journey.name === 'string' &&
        ['passed', 'failed', 'skipped'].includes(journey.status) &&
        isCount(journey.durationMs),
    )
  ) {
    return false;
  }
  const counts = Object.fromEntries(
    ['passed', 'failed', 'skipped'].map((status) => [
      status,
      report.journeys.filter((journey) => journey.status === status).length,
    ]),
  );
  if (
    counts.passed !== report.summary.passed ||
    counts.failed !== report.summary.failed ||
    counts.skipped !== report.summary.skipped
  ) {
    return false;
  }
  if (
    report.compatibility !== undefined &&
    (!Array.isArray(report.compatibility) || report.compatibility.length > 20)
  ) {
    return false;
  }
  return (report.compatibility ?? []).every(
    (assessment) =>
      isRecord(assessment) &&
      typeof assessment.profileId === 'string' &&
      ['compatible', 'incompatible', 'unknown'].includes(assessment.status) &&
      Array.isArray(assessment.findings) &&
      assessment.findings.length <= 2_500,
  );
}

let auditSection = '';
if (process.env.SITEVERB_AUDIT_ENABLED !== 'false' && process.env.SITEVERB_AUDIT_REPORT) {
  const audit = await readJson(process.env.SITEVERB_AUDIT_REPORT);
  if (
    isRecord(audit) &&
    audit.version === 1 &&
    isRecord(audit.summary) &&
    isCount(audit.summary.errors) &&
    isCount(audit.summary.warnings) &&
    isCount(audit.summary.sourceTools) &&
    isCount(audit.summary.contractTools)
  ) {
    auditSection = `### Static coverage

**${audit.summary.errors} errors · ${audit.summary.warnings} warnings · ${audit.summary.sourceTools}/${audit.summary.contractTools} source/contract tools**
`;
  } else {
    auditSection = '### Static coverage\n\nAudit report unavailable.\n';
  }
}

const report = await readJson(reportPath);
let passed = 0;
let failed = 0;
let summary;
if (isValidReport(report)) {
  passed = report.summary.passed;
  failed = report.summary.failed;
  const rows = report.journeys
    .map(
      (journey) =>
        `| ${journey.status === 'passed' ? 'PASS' : journey.status === 'failed' ? 'FAIL' : 'SKIP'} | ${plainCell(journey.name)} | ${journey.durationMs} ms |`,
    )
    .join('\n');
  const compatibilityRows = (report.compatibility ?? [])
    .map(
      (assessment) =>
        `| ${plainCell(assessment.profileId, 120)} | ${assessment.status.toUpperCase()} | ${assessment.findings.length} |`,
    )
    .join('\n');
  summary = `## Siteverb WebMCP journeys

**${report.summary.passed} passed · ${report.summary.failed} failed · ${report.summary.skipped} skipped**

Browser: ${plainCell(report.browser.name, 80)} ${plainCell(report.browser.version, 80)} (${plainCell(report.browser.evidence, 80)})

| Result | Journey | Duration |
|---|---|---:|
${rows || '| SKIP | No journeys selected | 0 ms |'}

${compatibilityRows ? `### Compatibility assessments\n\n| Profile | Status | Findings |\n|---|---|---:|\n${compatibilityRows}\n` : ''}
${auditSection}
`;
} else {
  summary = `## Siteverb WebMCP journeys

**Runner report unavailable or invalid.**

${auditSection}`;
}

if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
} else {
  process.stdout.write(summary);
}
if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `passed=${passed}\nfailed=${failed}\n`);
}
