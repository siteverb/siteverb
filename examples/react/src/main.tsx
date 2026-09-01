import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SiteverbProvider, useSiteverbTool } from '@siteverb/react';

const catalog = ['Trail shoe', 'Rain jacket', 'Travel pack'];

function Catalog() {
  const [results, setResults] = useState(catalog);
  const registration = useSiteverbTool({
    id: 'catalog.search-react-products',
    name: 'search_react_products',
    description: 'Filter the React product list by a case-insensitive query.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Words in the product name.' } },
      required: ['query'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    execute: async ({ query }: { query: string }) => {
      const matches = catalog.filter((product) =>
        product.toLowerCase().includes(query.toLowerCase()),
      );
      setResults(matches);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      return { count: matches.length, products: matches };
    },
  });

  return (
    <main>
      <h1>React catalog</h1>
      <p id="registration">{registration.status}</p>
      <ul id="react-products">
        {results.map((product) => (
          <li key={product}>{product}</li>
        ))}
      </ul>
    </main>
  );
}

createRoot(document.querySelector('#root')!).render(
  <StrictMode>
    <SiteverbProvider>
      <Catalog />
    </SiteverbProvider>
  </StrictMode>,
);
