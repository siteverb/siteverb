import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { auditProject } from '../src/index.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true })));
});

async function fixture(
  source: string,
  options: {
    extension?: 'html' | 'svelte' | 'ts' | 'vue';
    registration?: 'imperative' | 'declarative';
    name?: string;
    risk?: 'read-only' | 'reversible' | 'consequential';
  } = {},
) {
  const root = await mkdtemp(join(tmpdir(), 'siteverb-audit-'));
  temporaryDirectories.push(root);
  await mkdir(join(root, 'src'));
  await writeFile(
    join(
      root,
      options.registration === 'declarative'
        ? 'index.html'
        : `src/tools.${options.extension ?? 'ts'}`,
    ),
    source,
  );
  await writeFile(
    join(root, 'siteverb.webmcp.json'),
    JSON.stringify({
      version: 1,
      project: 'audit-test',
      tools: [
        {
          id: 'catalog.search',
          name: options.name ?? 'search',
          description: 'Search.',
          registration: options.registration ?? 'imperative',
          annotations: options.risk && options.risk !== 'read-only' ? {} : { readOnlyHint: true },
          risk: options.risk ?? 'read-only',
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
    }),
  );
  return root;
}

describe('auditProject', () => {
  it('matches static Siteverb stable identity to the contract', async () => {
    const root = await fixture(`
      import { defineTool } from '@siteverb/webmcp';
      export const search = defineTool({
        id: 'catalog.search', name: 'search', description: 'Search.', execute: () => []
      });
    `);
    const report = await auditProject({ root, contractPath: 'siteverb.webmcp.json' });
    expect(report.summary).toEqual(
      expect.objectContaining({ errors: 0, sourceTools: 1, contractTools: 1 }),
    );
    expect(report.root).toBe('.');
    expect(JSON.stringify(report)).not.toContain(root);
  });

  it('blocks raw native registrations and source tools missing from the contract', async () => {
    const root = await fixture(`
      import { defineTool } from '@siteverb/webmcp';
      document.modelContext.registerTool({ name: 'raw', description: 'Raw', execute: () => [] });
      defineTool({ id: 'docs.extra', name: 'extra', description: 'Extra.', execute: () => [] });
    `);
    const report = await auditProject({ root, contractPath: 'siteverb.webmcp.json' });
    expect(report.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining([
        'raw-native-registration',
        'source-tool-missing-contract',
        'contract-tool-missing-source',
      ]),
    );
  });

  it('parses declarative HTML forms without regex extraction', async () => {
    const root = await fixture(
      '<!doctype html><form toolname="search" tooldescription="Search."></form>',
      { registration: 'declarative' },
    );
    const report = await auditProject({ root, contractPath: 'siteverb.webmcp.json' });
    expect(report.summary.errors).toBe(0);
    expect(report.tools[0]).toEqual(
      expect.objectContaining({ name: 'search', owner: 'declarative' }),
    );
  });

  it('allows one declarative contract tool to appear on multiple pages', async () => {
    const root = await fixture('<!doctype html><form toolname="search"></form>', {
      registration: 'declarative',
    });
    await writeFile(join(root, 'second.html'), '<!doctype html><form toolname="search"></form>');
    const report = await auditProject({ root, contractPath: 'siteverb.webmcp.json' });

    expect(report.summary.errors).toBe(0);
    expect(report.tools.filter((tool) => tool.name === 'search')).toHaveLength(2);
  });

  it('rejects duplicate declarative names within one page', async () => {
    const root = await fixture(
      '<!doctype html><form toolname="search"></form><form toolname="search"></form>',
      { registration: 'declarative' },
    );
    const report = await auditProject({ root, contractPath: 'siteverb.webmcp.json' });

    expect(report.findings).toContainEqual(
      expect.objectContaining({ code: 'duplicate-wire-name', severity: 'error' }),
    );
  });

  it('rejects contract paths outside the audited project root', async () => {
    const root = await fixture(`
      import { defineTool } from '@siteverb/webmcp';
      defineTool({ id: 'catalog.search', name: 'search', execute: () => [] });
    `);

    await expect(
      auditProject({ root, contractPath: '../outside-siteverb.webmcp.json' }),
    ).rejects.toThrow(/inside the audited project root/);
  });

  it('reports declarative source tools missing from the contract', async () => {
    const root = await fixture(
      '<!doctype html><form toolname="search"></form><form toolname="undeclared"></form>',
      { registration: 'declarative' },
    );
    const report = await auditProject({ root, contractPath: 'siteverb.webmcp.json' });

    expect(report.findings).toContainEqual(
      expect.objectContaining({
        code: 'source-tool-missing-contract',
        message: expect.stringContaining('undeclared'),
      }),
    );
  });

  it('labels known third-party runtimes and supports strict policy', async () => {
    const root = await fixture(`
      import { defineTool } from '@siteverb/webmcp';
      import { useWebMCP } from 'usewebmcp';
      defineTool({ id: 'catalog.search', name: 'search', description: 'Search.', execute: () => [] });
      void useWebMCP;
    `);
    const warning = await auditProject({ root, contractPath: 'siteverb.webmcp.json' });
    const strict = await auditProject({
      root,
      contractPath: 'siteverb.webmcp.json',
      strictExternal: true,
    });
    expect(warning.findings).toContainEqual(
      expect.objectContaining({ code: 'external-registration-runtime', severity: 'warning' }),
    );
    expect(strict.findings).toContainEqual(
      expect.objectContaining({ code: 'external-registration-runtime', severity: 'error' }),
    );
  });

  it('extracts inline tools from the React adapter', async () => {
    const root = await fixture(`
      import { useSiteverbTool as useTool } from '@siteverb/react';
      export function AgentSurface() {
        useTool({ id: 'catalog.search', name: 'search', description: 'Search.', execute: () => [] });
        return null;
      }
    `);
    const report = await auditProject({ root, contractPath: 'siteverb.webmcp.json' });
    expect(report.summary.errors).toBe(0);
    expect(report.tools).toContainEqual(
      expect.objectContaining({ id: 'catalog.search', name: 'search', owner: 'siteverb' }),
    );
  });

  it('extracts React batch tools and checks hook origin exposure', async () => {
    const root = await fixture(`
      import { useSiteverbTools } from '@siteverb/react';
      export function AgentSurface() {
        useSiteverbTools(
          [{ id: 'catalog.search', name: 'search', description: 'Search.', execute: () => [] }],
          { exposedTo: ['*'] }
        );
        return null;
      }
    `);
    const report = await auditProject({ root, contractPath: 'siteverb.webmcp.json' });
    expect(report.tools).toContainEqual(
      expect.objectContaining({ id: 'catalog.search', name: 'search', owner: 'siteverb' }),
    );
    expect(report.findings).toContainEqual(
      expect.objectContaining({ code: 'unsafe-origin-exposure', severity: 'error' }),
    );
  });

  it('extracts direct, batch, and static factory Siteverb registrations', async () => {
    const variants = [
      `
        import { createSiteverb } from '@siteverb/webmcp';
        const client = createSiteverb();
        client.registerTool({ id: 'catalog.search', name: 'search', execute: () => [] });
      `,
      `
        import { createSiteverb } from '@siteverb/webmcp';
        const client = createSiteverb();
        client.registerTools([{ id: 'catalog.search', name: 'search', execute: () => [] }]);
      `,
      `
        import { createSiteverb } from '@siteverb/webmcp';
        const client = createSiteverb();
        function makeSearchTool() {
          return { id: 'catalog.search', name: 'search', execute: () => [] };
        }
        client.registerTool(makeSearchTool());
      `,
    ];

    for (const source of variants) {
      const root = await fixture(source);
      const report = await auditProject({ root, contractPath: 'siteverb.webmcp.json' });
      expect(report.summary.errors).toBe(0);
      expect(report.tools).toContainEqual(
        expect.objectContaining({ id: 'catalog.search', name: 'search', owner: 'siteverb' }),
      );
    }
  });

  it.each(['vue', 'svelte'] as const)(
    'extracts Siteverb tools from %s scripts',
    async (extension) => {
      const root = await fixture(
        `<script lang="ts">
        import { defineTool } from '@siteverb/webmcp';
        const search = defineTool({ id: 'catalog.search', name: 'search', execute: () => [] });
      </script>
      <main>Catalog</main>`,
        { extension },
      );
      const report = await auditProject({ root, contractPath: 'siteverb.webmcp.json' });
      expect(report.summary.errors).toBe(0);
      expect(report.tools).toContainEqual(
        expect.objectContaining({ id: 'catalog.search', name: 'search', owner: 'siteverb' }),
      );
    },
  );

  it('blocks autosubmit on a state-changing declarative tool', async () => {
    const root = await fixture(
      '<!doctype html><form toolname="search" tooldescription="Search." toolautosubmit></form>',
      { registration: 'declarative', risk: 'reversible' },
    );
    const report = await auditProject({ root, contractPath: 'siteverb.webmcp.json' });
    expect(report.findings).toContainEqual(
      expect.objectContaining({ code: 'unsafe-declarative-autosubmit', severity: 'error' }),
    );
  });

  it('labels known external script runtimes', async () => {
    const root = await fixture(
      '<!doctype html><script src="https://cdn.jsdelivr.net/npm/@mcp-b/global/dist/index.js"></script><form toolname="search"></form>',
      { registration: 'declarative' },
    );
    const report = await auditProject({ root, contractPath: 'siteverb.webmcp.json' });
    expect(report.findings).toContainEqual(
      expect.objectContaining({ code: 'external-registration-runtime', severity: 'warning' }),
    );
  });

  it('rejects unsafe exposedTo origins and accepts exact secure origins', async () => {
    const unsafeRoot = await fixture(`
      import { createSiteverb } from '@siteverb/webmcp';
      const client = createSiteverb();
      client.registerTool(
        { id: 'catalog.search', name: 'search', execute: () => [] },
        { exposedTo: ['*', 'http://agent.example', 'https://agent.example/path'] }
      );
    `);
    const safeRoot = await fixture(`
      import { createSiteverb } from '@siteverb/webmcp';
      const client = createSiteverb();
      client.registerTool(
        { id: 'catalog.search', name: 'search', execute: () => [] },
        { exposedTo: ['https://agent.example', 'http://127.0.0.1:3000'] }
      );
    `);
    const unsafe = await auditProject({ root: unsafeRoot, contractPath: 'siteverb.webmcp.json' });
    const safe = await auditProject({ root: safeRoot, contractPath: 'siteverb.webmcp.json' });

    expect(
      unsafe.findings.filter((finding) => finding.code === 'unsafe-origin-exposure'),
    ).toHaveLength(3);
    expect(safe.findings).not.toContainEqual(
      expect.objectContaining({ code: 'unsafe-origin-exposure' }),
    );
  });

  it('flags dynamic exposedTo policy for manual review', async () => {
    const root = await fixture(`
      import { createSiteverb } from '@siteverb/webmcp';
      const client = createSiteverb();
      const origins = loadOrigins();
      client.registerTool(
        { id: 'catalog.search', name: 'search', execute: () => [] },
        { exposedTo: origins }
      );
    `);
    const report = await auditProject({ root, contractPath: 'siteverb.webmcp.json' });
    expect(report.findings).toContainEqual(
      expect.objectContaining({ code: 'dynamic-origin-exposure', severity: 'warning' }),
    );
  });
});
