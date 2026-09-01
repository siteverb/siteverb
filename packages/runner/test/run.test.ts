import { describe, expect, it } from 'vitest';
import { parseProjectContract, type DomExpectation } from '@siteverb/contracts';
import { runProject } from '../src/index.js';
import type { BrowserAdapter, BrowserPageAdapter, BrowserToolResult } from '../src/types.js';

class FakePage implements BrowserPageAdapter {
  readonly calls: string[] = [];
  readonly inspections: DomExpectation[] = [];
  readonly toolsByRead: string[][];
  readonly results: Record<string, BrowserToolResult>;
  closed = false;
  current = 'https://example.test/';
  reads = 0;

  constructor(toolsByRead: string[][], results: Record<string, BrowserToolResult>) {
    this.toolsByRead = toolsByRead;
    this.results = results;
  }

  async close() {
    this.closed = true;
  }

  currentUrl() {
    return this.current;
  }

  async executeTool(name: string) {
    this.calls.push(name);
    return this.results[name] ?? { status: 'completed' as const };
  }

  async goto(url: string) {
    this.current = url;
  }

  async inspectDom(expectation: DomExpectation) {
    this.inspections.push(expectation);
    return undefined;
  }

  async listTools() {
    const tools = this.toolsByRead[Math.min(this.reads, this.toolsByRead.length - 1)] ?? [];
    this.reads += 1;
    return tools.map((name) => ({ name }));
  }
}

class FakeBrowser implements BrowserAdapter {
  readonly channel = 'chrome';
  readonly name = 'Chrome';
  readonly version = '151.0.0.0';
  readonly pages: FakePage[] = [];
  readonly createPage: () => FakePage;
  closed = false;

  constructor(createPage: () => FakePage) {
    this.createPage = createPage;
  }

  async close() {
    this.closed = true;
  }

  async newPage() {
    const page = this.createPage();
    this.pages.push(page);
    return page;
  }
}

function contract(options: { mutation?: boolean; cleanup?: boolean } = {}) {
  const mutation = options.mutation ?? false;
  return parseProjectContract({
    version: 1,
    project: 'runner-test',
    tools: [
      {
        id: 'catalog.first',
        name: 'first',
        description: 'First tool.',
        annotations: mutation ? {} : { readOnlyHint: true },
        risk: mutation ? 'reversible' : 'read-only',
        examples: [{ name: 'First', input: {} }],
      },
      {
        id: 'catalog.second',
        name: 'second',
        description: 'Second tool.',
        annotations: { readOnlyHint: true },
        risk: 'read-only',
        examples: [{ name: 'Second', input: {} }],
      },
    ],
    journeys: [
      {
        id: 'catalog.run-both',
        name: 'Run both',
        start: '/start',
        steps: [
          { tool: 'catalog.first', input: {}, expect: { result: { contains: { ok: true } } } },
          { tool: 'catalog.second', input: {}, expect: { dom: [{ selector: '#done' }] } },
        ],
        ...(options.cleanup ? { cleanup: [{ tool: 'catalog.second', input: {} }] } : {}),
      },
    ],
  });
}

describe('runProject', () => {
  it('refreshes dynamic tools before every step and emits bounded evidence', async () => {
    const browser = new FakeBrowser(
      () =>
        new FakePage([['first'], ['second']], {
          first: { status: 'completed', output: { ok: true, private: 'not reported' } },
          second: { status: 'completed', output: 'done' },
        }),
    );
    const report = await runProject({
      browser,
      contract: contract(),
      targetUrl: 'https://example.test',
      timeoutMs: 100,
    });

    expect(report.summary).toEqual({ passed: 1, failed: 0, skipped: 0 });
    expect(browser.pages[0]?.calls).toEqual(['first', 'second']);
    expect(browser.pages[0]?.reads).toBe(2);
    expect(browser.pages[0]?.inspections).toEqual([expect.objectContaining({ selector: '#done' })]);
    expect(JSON.stringify(report)).not.toContain('not reported');
    expect(browser.pages[0]?.closed).toBe(true);
    expect(browser.closed).toBe(true);
  });

  it('denies mutation without an explicit runner option', async () => {
    const browser = new FakeBrowser(() => new FakePage([['first']], {}));
    const report = await runProject({
      browser,
      contract: contract({ mutation: true }),
      targetUrl: 'https://example.test',
      timeoutMs: 10,
    });

    expect(report.summary.failed).toBe(1);
    expect(report.journeys[0]?.steps[0]?.error).toMatch(/Mutation denied/);
    expect(browser.pages[0]?.calls).toEqual([]);
  });

  it('attempts cleanup after a failed journey step', async () => {
    const browser = new FakeBrowser(
      () =>
        new FakePage([['first'], ['second']], {
          first: { status: 'error', error: 'failed' },
          second: { status: 'completed' },
        }),
    );
    const report = await runProject({
      browser,
      contract: contract({ cleanup: true }),
      targetUrl: 'https://example.test',
      timeoutMs: 10,
    });

    expect(report.summary.failed).toBe(1);
    expect(browser.pages[0]?.calls).toEqual(['first', 'second']);
    expect(report.journeys[0]?.cleanup[0]?.status).toBe('passed');
  });

  it('attempts every cleanup step when an earlier cleanup fails', async () => {
    const cleanupContract = parseProjectContract({
      version: 1,
      project: 'cleanup-test',
      tools: ['run', 'first_cleanup', 'second_cleanup'].map((name) => ({
        id: `catalog.${name.replaceAll('_', '-')}`,
        name,
        description: `${name}.`,
        annotations: { readOnlyHint: true },
        risk: 'read-only',
        examples: [{ name, input: {} }],
      })),
      journeys: [
        {
          id: 'catalog.cleanup-all',
          name: 'Cleanup all',
          start: '/',
          steps: [{ tool: 'catalog.run', input: {} }],
          cleanup: [
            { tool: 'catalog.first-cleanup', input: {} },
            { tool: 'catalog.second-cleanup', input: {} },
          ],
        },
      ],
    });
    const browser = new FakeBrowser(
      () =>
        new FakePage([['run'], ['first_cleanup'], ['second_cleanup']], {
          run: { status: 'completed' },
          first_cleanup: { status: 'error', error: 'failed cleanup' },
          second_cleanup: { status: 'completed' },
        }),
    );
    const report = await runProject({
      browser,
      contract: cleanupContract,
      targetUrl: 'https://example.test',
      timeoutMs: 20,
    });

    expect(browser.pages[0]?.calls).toEqual(['run', 'first_cleanup', 'second_cleanup']);
    expect(report.journeys[0]?.cleanup.map((step) => step.status)).toEqual(['failed', 'passed']);
  });

  it('applies mutation gates to cleanup steps', async () => {
    const guarded = parseProjectContract({
      version: 1,
      project: 'cleanup-gate',
      tools: [
        {
          id: 'catalog.read',
          name: 'read',
          description: 'Read.',
          annotations: { readOnlyHint: true },
          risk: 'read-only',
          examples: [{ name: 'Read', input: {} }],
        },
        {
          id: 'catalog.cleanup',
          name: 'cleanup',
          description: 'Clean up.',
          risk: 'reversible',
          examples: [{ name: 'Cleanup', input: {} }],
        },
      ],
      journeys: [
        {
          id: 'catalog.cleanup-journey',
          name: 'Cleanup journey',
          start: '/',
          steps: [{ tool: 'catalog.read', input: {} }],
          cleanup: [{ tool: 'catalog.cleanup', input: {} }],
        },
      ],
    });
    const browser = new FakeBrowser(
      () =>
        new FakePage([['read'], ['cleanup']], {
          read: { status: 'completed' },
          cleanup: { status: 'completed' },
        }),
    );
    const report = await runProject({
      browser,
      contract: guarded,
      targetUrl: 'https://example.test',
      timeoutMs: 20,
    });

    expect(report.journeys[0]?.cleanup[0]?.error).toMatch(/Mutation denied/);
    expect(browser.pages[0]?.calls).toEqual(['read']);
  });

  it('redacts page errors by default and reveals them only with explicit local opt-in', async () => {
    const secret = 'customer@example.test secret-order-123';
    const makeBrowser = () =>
      new FakeBrowser(
        () =>
          new FakePage([['first']], {
            first: { status: 'error', error: secret },
          }),
      );
    const redacted = await runProject({
      browser: makeBrowser(),
      contract: contract(),
      targetUrl: 'https://example.test',
      timeoutMs: 20,
    });
    const detailed = await runProject({
      browser: makeBrowser(),
      contract: contract(),
      targetUrl: 'https://example.test',
      timeoutMs: 20,
      includeErrorDetails: true,
    });

    expect(JSON.stringify(redacted)).not.toContain(secret);
    expect(JSON.stringify(detailed)).toContain(secret);
  });

  it('persists only the target origin in reports', async () => {
    const browser = new FakeBrowser(
      () =>
        new FakePage([['first'], ['second']], {
          first: { status: 'completed', output: { ok: true } },
          second: { status: 'completed' },
        }),
    );
    const report = await runProject({
      browser,
      contract: contract(),
      targetUrl: 'https://user:password@example.test/base?token=secret#private',
      timeoutMs: 20,
    });

    expect(report.targetUrl).toBe('https://example.test/');
    expect(JSON.stringify(report)).not.toMatch(/user|password|token|secret|private/);
  });

  it('does not report an observed pathname when a URL postcondition fails', async () => {
    class RedirectPage extends FakePage {
      override async executeTool(name: string): Promise<BrowserToolResult> {
        this.calls.push(name);
        this.current = 'https://example.test/orders/customer-secret-123';
        return { status: 'completed' };
      }
    }
    const urlContract = parseProjectContract({
      version: 1,
      project: 'url-privacy-test',
      tools: [
        {
          id: 'catalog.navigate',
          name: 'navigate',
          description: 'Navigate.',
          annotations: { readOnlyHint: true },
          risk: 'read-only',
          examples: [{ name: 'Navigate', input: {} }],
        },
      ],
      journeys: [
        {
          id: 'catalog.navigate-public',
          name: 'Navigate public',
          start: '/',
          steps: [
            {
              tool: 'catalog.navigate',
              input: {},
              expect: { url: { pathname: '/expected' } },
            },
          ],
        },
      ],
    });
    const report = await runProject({
      browser: new FakeBrowser(() => new RedirectPage([['navigate']], {})),
      contract: urlContract,
      targetUrl: 'https://example.test',
      timeoutMs: 20,
    });

    expect(report.journeys[0]?.steps[0]?.error).toContain('/expected');
    expect(JSON.stringify(report)).not.toContain('customer-secret-123');
  });

  it('does not report configured or observed URL parameter values on mismatch', async () => {
    class QueryPage extends FakePage {
      override async executeTool(name: string): Promise<BrowserToolResult> {
        this.calls.push(name);
        this.current = 'https://example.test/expected?token=observed-secret';
        return { status: 'completed' };
      }
    }
    const queryContract = parseProjectContract({
      version: 1,
      project: 'query-privacy-test',
      tools: [
        {
          id: 'catalog.navigate',
          name: 'navigate',
          description: 'Navigate.',
          annotations: { readOnlyHint: true },
          risk: 'read-only',
          examples: [{ name: 'Navigate', input: {} }],
        },
      ],
      journeys: [
        {
          id: 'catalog.navigate-query',
          name: 'Navigate query',
          start: '/',
          steps: [
            {
              tool: 'catalog.navigate',
              input: {},
              expect: {
                url: { pathname: '/expected', searchParams: { token: 'configured-secret' } },
              },
            },
          ],
        },
      ],
    });
    const report = await runProject({
      browser: new FakeBrowser(() => new QueryPage([['navigate']], {})),
      contract: queryContract,
      targetUrl: 'https://example.test',
      timeoutMs: 20,
    });

    expect(report.journeys[0]?.steps[0]?.error).toContain('URL parameter "token"');
    expect(JSON.stringify(report)).not.toMatch(/configured-secret|observed-secret/);
  });

  it('aborts a tool call at the configured timeout', async () => {
    class TimeoutPage extends FakePage {
      override async executeTool(
        name: string,
        _input?: Record<string, unknown>,
        signal?: AbortSignal,
      ): Promise<BrowserToolResult> {
        this.calls.push(name);
        return new Promise((_, reject) => {
          signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
        });
      }
    }
    const browser = new FakeBrowser(() => new TimeoutPage([['first']], {}));
    const report = await runProject({
      browser,
      contract: contract(),
      targetUrl: 'https://example.test',
      timeoutMs: 5,
    });

    expect(report.journeys[0]?.steps[0]?.error).toBe('Tool "first" timed out after 5 ms.');
  });

  it('rejects unknown journey filters before opening a page', async () => {
    const browser = new FakeBrowser(() => new FakePage([[]], {}));
    await expect(
      runProject({
        browser,
        contract: contract(),
        journeyIds: ['missing.journey'],
        targetUrl: 'https://example.test',
      }),
    ).rejects.toThrow(/Unknown journey ids/);
    expect(browser.pages).toEqual([]);
    expect(browser.closed).toBe(false);
  });

  it('rejects unknown profiles before opening or executing in a browser', async () => {
    const browser = new FakeBrowser(() => new FakePage([['first']], {}));
    await expect(
      runProject({
        browser,
        contract: contract({ mutation: true }),
        profileIds: ['missing-profile'],
        targetUrl: 'https://example.test',
        allowMutations: true,
      }),
    ).rejects.toThrow(/Unknown client profile id/);
    expect(browser.pages).toEqual([]);
    expect(browser.closed).toBe(false);
  });

  it.each([
    { targetUrl: 'file:///tmp/siteverb.html', timeoutMs: 20, message: /HTTP or HTTPS/ },
    { targetUrl: 'not a URL with customer-secret', timeoutMs: 20, message: /HTTP or HTTPS/ },
    { targetUrl: 'https://example.test', timeoutMs: 0, message: /1 to 600000/ },
  ])('rejects invalid preflight options without opening a browser', async (invalid) => {
    const browser = new FakeBrowser(() => new FakePage([['first']], {}));
    await expect(
      runProject({
        browser,
        contract: contract(),
        targetUrl: invalid.targetUrl,
        timeoutMs: invalid.timeoutMs,
      }),
    ).rejects.toThrow(invalid.message);
    expect(browser.pages).toEqual([]);
    expect(browser.closed).toBe(false);
  });

  it('adds documented client compatibility without changing browser evidence', async () => {
    const browser = new FakeBrowser(
      () =>
        new FakePage([['first'], ['second']], {
          first: { status: 'completed', output: { ok: true } },
          second: { status: 'completed' },
        }),
    );
    const report = await runProject({
      browser,
      contract: contract(),
      profileIds: ['chatgpt-site-tools-2026-08-26'],
      targetUrl: 'https://example.test',
      timeoutMs: 100,
    });

    expect(report.browser.evidence).toBe('real-browser');
    expect(report.compatibility).toEqual([
      { profileId: 'chatgpt-site-tools-2026-08-26', status: 'compatible', findings: [] },
    ]);
  });
});
