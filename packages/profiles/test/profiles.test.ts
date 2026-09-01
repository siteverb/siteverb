import { describe, expect, it } from 'vitest';
import { parseProjectContract, parseRunReport } from '@siteverb/contracts';
import chrome151Evidence from '../evidence/chrome-151-native.json' with { type: 'json' };
import chrome152Evidence from '../evidence/chrome-152-native.json' with { type: 'json' };
import {
  assessCompatibility,
  chatGptSiteToolsProfile,
  chrome151Profile,
  chrome152Profile,
  edge150Profile,
  getClientProfile,
} from '../src/index.js';

function contract(registration: 'imperative' | 'declarative', frame = 'top-level') {
  return parseProjectContract({
    version: 1,
    project: 'profile-test',
    tools: [
      {
        id: 'catalog.search',
        name: 'search',
        description: 'Search.',
        registration,
        frame,
        annotations: { readOnlyHint: true },
        risk: 'read-only',
        examples: [{ name: 'Search', input: {} }],
      },
    ],
    journeys: [
      {
        id: 'catalog.search-products',
        name: 'Search products',
        start: '/',
        steps: [{ tool: 'catalog.search', input: {} }],
      },
    ],
  });
}

describe('client profiles', () => {
  it('accepts the real-browser Chrome imperative surface', () => {
    expect(assessCompatibility(contract('imperative'), chrome152Profile)).toEqual({
      profileId: 'chrome-152-native',
      status: 'compatible',
      findings: [],
    });
  });

  it('flags ChatGPT declarative and iframe incompatibilities with sources', () => {
    const assessment = assessCompatibility(
      contract('declarative', 'same-origin-iframe'),
      chatGptSiteToolsProfile,
    );
    expect(assessment.status).toBe('incompatible');
    expect(assessment.findings.map((finding) => finding.code)).toEqual([
      'declarative-tools-unsupported',
      'iframe-tools-unsupported',
    ]);
    expect(assessment.findings.every((finding) => finding.source.startsWith('https://'))).toBe(
      true,
    );
  });

  it('keeps unknown Edge iframe support distinct from incompatibility', () => {
    const assessment = assessCompatibility(
      contract('imperative', 'cross-origin-iframe'),
      edge150Profile,
    );
    expect(assessment.status).toBe('unknown');
    expect(assessment.findings[0]).toEqual(
      expect.objectContaining({ code: 'support-unknown', severity: 'warning' }),
    );
  });

  it('resolves only exact versioned profile IDs', () => {
    expect(getClientProfile('chrome-152-native')).toBe(chrome152Profile);
    expect(getClientProfile('chrome-151-native')).toBe(chrome151Profile);
    expect(getClientProfile('chrome')).toBeUndefined();
  });

  it.each([
    ['chrome-151-native', chrome151Profile, chrome151Evidence],
    ['chrome-152-native', chrome152Profile, chrome152Evidence],
  ] as const)('ships bounded real-browser evidence for %s', (_id, profile, input) => {
    const evidence = parseRunReport(input);

    expect(evidence.browser).toEqual(
      expect.objectContaining({ version: profile.version, evidence: 'real-browser' }),
    );
    expect(evidence.summary.failed).toBe(0);
    expect(evidence.journeys.every((journey) => journey.status === 'passed')).toBe(true);
    expect(JSON.stringify(evidence)).not.toMatch(/password|token|cookie|authorization/i);
  });
});
