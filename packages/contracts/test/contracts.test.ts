import { describe, expect, it } from 'vitest';
import {
  parseProjectContract,
  parseRunReport,
  projectContractJsonSchema,
  safeParseProjectContract,
  safeParseRunReport,
} from '../src/index.js';

const validContract = {
  version: 1,
  project: 'siteverb-example',
  tools: [
    {
      id: 'catalog.search-products',
      name: 'search_products',
      description: 'Search products.',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
      },
      annotations: { readOnlyHint: true },
      risk: 'read-only',
      examples: [{ name: 'Trail products', input: { query: 'trail' } }],
    },
  ],
  journeys: [
    {
      id: 'catalog.search-visible-products',
      name: 'Search visible products',
      start: '/',
      steps: [
        {
          tool: 'catalog.search-products',
          input: { query: 'trail' },
          expect: {
            result: { contains: { count: 1 } },
            dom: [{ selector: '#products', textContains: 'Trail shoe' }],
          },
        },
      ],
    },
  ],
} as const;

describe('project contract', () => {
  it('applies portable defaults and validates references', () => {
    const contract = parseProjectContract(validContract);
    expect(contract.support).toEqual([]);
    expect(contract.journeys[0]?.policy).toEqual({
      requireHumanBefore: [],
    });
  });

  it('rejects unknown tool references and duplicate identities', () => {
    const result = safeParseProjectContract({
      ...validContract,
      tools: [...validContract.tools, validContract.tools[0]],
      journeys: [
        {
          ...validContract.journeys[0],
          steps: [{ tool: 'missing.tool', input: {} }],
        },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Duplicate tool id'),
          expect.stringContaining('Duplicate tool name'),
          expect.stringContaining('Unknown tool id'),
        ]),
      );
    }
  });

  it('rejects misleading read-only annotations', () => {
    const result = safeParseProjectContract({
      ...validContract,
      tools: [
        {
          ...validContract.tools[0],
          risk: 'consequential',
          annotations: { readOnlyHint: true },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('requires explicit approval policy for consequential journey steps', () => {
    const result = safeParseProjectContract({
      ...validContract,
      tools: [
        {
          ...validContract.tools[0],
          risk: 'consequential',
          annotations: {},
        },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({ message: expect.stringContaining('human-approval policy') }),
      );
    }
  });

  it('requires explicit approval policy for consequential cleanup steps', () => {
    const result = safeParseProjectContract({
      ...validContract,
      tools: [
        ...validContract.tools,
        {
          id: 'catalog.delete-test-data',
          name: 'delete_test_data',
          description: 'Permanently delete seeded test data.',
          annotations: {},
          risk: 'consequential',
          examples: [{ name: 'Delete seeded test data', input: {} }],
        },
      ],
      journeys: [
        {
          ...validContract.journeys[0],
          cleanup: [{ tool: 'catalog.delete-test-data', input: {} }],
        },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('human-approval policy'),
          path: ['journeys', 0, 'cleanup', 0, 'tool'],
        }),
      );
    }
  });

  it('rejects contracts that exceed bounded journey collections', () => {
    const result = safeParseProjectContract({
      ...validContract,
      journeys: [
        {
          ...validContract.journeys[0],
          steps: Array.from({ length: 101 }, () => validContract.journeys[0].steps[0]),
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({ path: ['journeys', 0, 'steps'] }),
      );
    }
  });

  it.each(['//attacker.test/path', '/\\attacker.test/path'])(
    'rejects cross-origin journey and route values: %s',
    (unsafePath) => {
      const result = safeParseProjectContract({
        ...validContract,
        tools: [{ ...validContract.tools[0], routes: [unsafePath] }],
        journeys: [{ ...validContract.journeys[0], start: unsafePath }],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ path: ['tools', 0, 'routes', 0] }),
            expect.objectContaining({ path: ['journeys', 0, 'start'] }),
          ]),
        );
      }
    },
  );

  it('exports a draft 2020-12 JSON schema', () => {
    expect(projectContractJsonSchema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
  });
});

describe('run report', () => {
  it('parses bounded evidence without raw tool payloads', () => {
    const report = parseRunReport({
      version: 1,
      runId: 'run-1',
      startedAt: '2026-09-01T00:00:00.000Z',
      finishedAt: '2026-09-01T00:00:01.000Z',
      targetUrl: 'https://example.test',
      project: 'siteverb-example',
      contractHash: 'sha256:abc',
      runner: { name: '@siteverb/runner', version: '0.1.0' },
      browser: {
        name: 'Chrome',
        version: '151.0.7922.175',
        channel: 'chrome',
        evidence: 'real-browser',
      },
      summary: { passed: 1, failed: 0, skipped: 0 },
      journeys: [
        {
          id: 'catalog.search-visible-products',
          name: 'Search visible products',
          status: 'passed',
          durationMs: 100,
          steps: [
            {
              index: 1,
              toolId: 'catalog.search-products',
              toolName: 'search_products',
              status: 'passed',
              durationMs: 50,
            },
          ],
        },
      ],
    });
    expect(report.summary.passed).toBe(1);
  });

  it('rejects raw target URLs and inconsistent report totals', () => {
    const result = safeParseRunReport({
      version: 1,
      runId: 'run-1',
      startedAt: '2026-09-01T00:00:00.000Z',
      finishedAt: '2026-09-01T00:00:01.000Z',
      targetUrl: 'https://user:password@example.test/private?token=secret#fragment',
      project: 'siteverb-example',
      contractHash: 'sha256:abc',
      runner: { name: '@siteverb/runner', version: '0.1.0' },
      browser: {
        name: 'Chrome',
        version: '152.0.7977.65',
        channel: 'chrome',
        evidence: 'real-browser',
      },
      summary: { passed: 1, failed: 0, skipped: 0 },
      journeys: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ['targetUrl'] }),
          expect.objectContaining({ path: ['summary', 'passed'] }),
        ]),
      );
    }
  });
});
