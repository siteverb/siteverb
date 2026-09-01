# @siteverb/webmcp

Native-first WebMCP registration with durable tool identity, lifecycle control, coverage checks,
and opt-in metadata-only telemetry.

## Install

```sh
npm install @siteverb/webmcp
```

The package has no runtime dependencies and does not install a polyfill. Use native
`document.modelContext` where available. If a project needs broader browser compatibility, install
an explicit WebMCP polyfill such as `@mcp-b/webmcp-polyfill` before creating the Siteverb client.
The published package is ESM-only and targets modern browser build systems and Node.js 22 or newer.

## Define and register tools

```ts
import { createSiteverb, defineTool } from '@siteverb/webmcp';

const searchProducts = defineTool({
  id: 'catalog.search-products',
  name: 'search_products',
  description: 'Search products currently available in the catalog.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Words to search for.' },
    },
    required: ['query'],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true },
  execute: async ({ query }: { query: string }, { signal }) => {
    const response = await fetch(`/api/products?q=${encodeURIComponent(query)}`, { signal });
    if (!response.ok) throw new Error('Product search failed.');
    return response.json();
  },
});

const webmcp = createSiteverb();
const registration = webmcp.registerTool(searchProducts);
await registration.ready;

// AbortSignal is the current WebMCP unregistration mechanism.
registration.unregister();
```

`id` is Siteverb's durable `domain.action` identity. It is never exposed in browser tool metadata.
`name` is the WebMCP wire name and may evolve while the stable ID retains release and production
lineage.

## Dynamic tools

Register tools in state-specific batches and replace the handle when application state changes.
This mirrors the dynamic tool-set pattern in Google's WebMCP demos.

```ts
let current = webmcp.registerTools(introTools);
await current.ready;

current.unregister();
current = webmcp.registerTools(checkoutTools);
await current.ready;
```

Batch registration is atomic by default: if one registration fails, registrations started by that
batch are removed. Set `atomic: false` only when partial registration is intentional.

## Production telemetry

Telemetry is disabled unless both a public site ID and an endpoint or custom transport are supplied.

```ts
const webmcp = createSiteverb({
  siteId: 'site_public_123',
  release: import.meta.env.PUBLIC_RELEASE_SHA,
  environment: 'production',
  routeTemplate: '/products/:slug',
  telemetry: {
    endpoint: 'https://events.example.com/v1/webmcp',
  },
});
```

The event contract contains registrations, invocation lifecycle, duration, stable tool identity,
wire name, schema hash, release, environment, and an ephemeral first-party page-session ID. It does
not contain prompts, arguments, results, DOM content, URLs, credentials, user IDs, error messages,
or client identity. Failed batches retain the same batch ID for idempotent retry. Automatic retries
use bounded exponential backoff and pause after five failures by default; the retained batch can be
retried explicitly with `flush()`. SHA-256 schema hashes use an algorithm-labeled FNV-1a fallback
only where SubtleCrypto is unavailable.

The default transport uses credential-free keepalive fetch for every flush, including page
lifecycle delivery. Route templates must be pathname templates such as `/products/:slug`; full URLs,
query strings, fragments, control characters, and values over 500 characters are omitted with a
diagnostic rather than transmitted.

Collector endpoints must be a same-origin relative path, HTTPS URL, or loopback HTTP URL. URL
credentials, query strings, and fragments are rejected. Use an explicit custom transport when a
first-party collector requires a different authenticated delivery mechanism.

Use a custom transport for first-party collection, OpenTelemetry adaptation, tests, or a private
collector:

```ts
const webmcp = createSiteverb({
  siteId: 'site_public_123',
  telemetry: {
    transport: {
      async send(batch, reason) {
        await myCollector.write(batch, reason);
      },
    },
  },
});
```

## Coverage

`coverage()` compares native `getTools()` inventory with tools registered through Siteverb. A tool
that bypasses the facade is reported as `inventoryOnly`; the SDK never claims invocation telemetry
for it.

```ts
const coverage = await webmcp.coverage();
console.log(coverage.completeness, coverage.inventoryOnly);
```

## Google webmcp-evals

Siteverb exports the static schema consumed by GoogleChromeLabs `webmcp-evals local` mode:

```ts
import { toWebMcpEvalsSchema } from '@siteverb/webmcp/evals';

const schema = toWebMcpEvalsSchema([searchProducts]);
```

Write the returned JSON to a generated artifact, then run Google's CLI. `@siteverb/runner` separately
executes portable deterministic journeys through Puppeteer's native `page.webmcp` surface. Google's
model-backed evals remain a distinct evidence class; model variance does not silently become a
Siteverb release failure.

## Testing

```ts
import { createMemoryModelContext, createMemoryTelemetryTransport } from '@siteverb/webmcp/testing';
```

The memory context implements registration, unregistration, discovery, cancellation, and direct
execution. It is for unit tests only; browser evidence must still run against a named browser build.

## Current boundary

- The package targets the current `document.modelContext` Community Group draft and compiles
  against the official `webmcp-types` package.
- Registration visibility is not authorization. Every underlying action must enforce authentication,
  authorization, validation, and confirmation independently.
- Unsupported environments return `status: 'unsupported'`; they are not reported as verified.
- No caller identity is inferred. WebMCP does not expose a portable agent identity field.
- Website-facing skills, ARD, A2A, and backend MCP are not runtime dependencies.
