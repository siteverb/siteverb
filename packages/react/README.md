# @siteverb/react

React and Next.js lifecycle bindings for `@siteverb/webmcp`.

```tsx
'use client';

import { SiteverbProvider, useSiteverbTool } from '@siteverb/react';

function SearchTool() {
  const registration = useSiteverbTool({
    id: 'catalog.search-products',
    name: 'search_products',
    description: 'Search products.',
    annotations: { readOnlyHint: true },
    execute: ({ query }: { query: string }) => searchProducts(query),
  });
  return null;
}

export function AgentSurface() {
  return (
    <SiteverbProvider>
      <SearchTool />
    </SiteverbProvider>
  );
}
```

The provider creates one Siteverb client or accepts an existing client. Hooks register after commit,
unregister on cleanup, tolerate React Strict Mode, and route execution to the latest committed
callback without metadata re-registration on every render.

An owned provider renders its children during SSR and the first client paint through an inert,
unsupported registration surface, then rebinds hooks to the committed browser client after mount.
It never delays the wrapped application UI to initialize WebMCP.

Provider `options` initialize one owned client after mount and are intentionally not reactive. Pass
an explicitly managed `client` when configuration must change during the application lifecycle.

In Next.js App Router, place the provider/registrar in a `'use client'` module and mount it from the
layout or route that owns the tools. Registration remains discoverability; called server routes must
enforce authorization independently.
