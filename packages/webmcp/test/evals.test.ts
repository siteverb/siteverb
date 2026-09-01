import { describe, expect, it } from 'vitest';
import { defineTool, toWebMcpEvalsSchema } from '../src/index.js';

describe('Google webmcp-evals interoperability', () => {
  it('exports the static schema format accepted by webmcp-evals local mode', () => {
    const schema = toWebMcpEvalsSchema([
      defineTool({
        id: 'catalog.search-products',
        name: 'search_products',
        description: 'Search products.',
        inputSchema: {
          type: 'object',
          properties: { query: { type: 'string' } },
          required: ['query'],
        },
        annotations: { readOnlyHint: true },
        execute: () => [],
      }),
    ]);

    expect(schema).toEqual({
      tools: [
        {
          annotations: { readOnlyHint: true },
          description: 'Search products.',
          inputSchema: {
            type: 'object',
            properties: { query: { type: 'string' } },
            required: ['query'],
          },
          name: 'search_products',
          outputSchema: null,
        },
      ],
    });
    expect(JSON.stringify(schema)).not.toContain('catalog.search-products');
    expect(Object.isFrozen(schema.tools)).toBe(true);
  });

  it('rejects duplicate wire names before producing an invalid eval schema', () => {
    expect(() =>
      toWebMcpEvalsSchema([
        {
          id: 'catalog.search-products',
          name: 'search',
          description: 'Search products.',
          execute: () => [],
        },
        {
          id: 'docs.search-articles',
          name: 'search',
          description: 'Search articles.',
          execute: () => [],
        },
      ]),
    ).toThrow(/duplicate WebMCP tool name/);
  });
});
