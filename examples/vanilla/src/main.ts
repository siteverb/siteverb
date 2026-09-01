import { createSiteverb, defineTool } from '@siteverb/webmcp';

const products = ['Trail shoe', 'Rain jacket', 'Travel pack'];
const status = document.querySelector<HTMLElement>('#status');
const list = document.querySelector<HTMLUListElement>('#products');

function render(items: readonly string[]): void {
  if (!list) return;
  list.replaceChildren(
    ...items.map((item) => {
      const row = document.createElement('li');
      row.textContent = item;
      return row;
    }),
  );
}

render(products);

const searchProducts = defineTool({
  id: 'catalog.search-products',
  name: 'search_products',
  title: 'Search products',
  description: 'Filter the visible product catalog by a case-insensitive search query.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Words in the product name.' },
    },
    required: ['query'],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true },
  execute: ({ query }: { query: string }) => {
    const matches = products.filter((product) =>
      product.toLowerCase().includes(query.toLowerCase()),
    );
    render(matches);
    return { count: matches.length, products: matches };
  },
});

const webmcp = createSiteverb();
const registration = webmcp.registerTool(searchProducts);
const result = await registration.ready;

if (status) {
  status.textContent =
    result.status === 'registered'
      ? 'search_products is available to WebMCP agents.'
      : 'WebMCP is unavailable in this browser; the page still works normally.';
}

addEventListener('pagehide', () => webmcp.dispose(), { once: true });
