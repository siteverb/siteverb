# Siteverb

**Create, prove, and improve WebMCP surfaces without giving up code ownership.**

Siteverb turns existing website behavior into customer-owned WebMCP tools, binds those tools to a
portable journey contract, and verifies the contract through static source coverage and real-browser
execution.

> Stable: six `@siteverb` npm packages are available as `0.1.0` through the `latest` dist-tag.
> They are published from the protected `v0.1.0` GitHub release through OIDC with signed SLSA
> provenance. The GitHub Action is available at `siteverb/siteverb/actions/siteverb@v0.1.0`.

## What is included

| Surface        | Package/path              | Responsibility                                                                           |
| -------------- | ------------------------- | ---------------------------------------------------------------------------------------- |
| Browser SDK    | `@siteverb/webmcp`        | Native registration, stable identity, lifecycle, coverage, and opt-in metadata telemetry |
| Contracts      | `@siteverb/contracts`     | Versioned `siteverb.webmcp.json` and bounded evidence schemas                            |
| React          | `@siteverb/react`         | Strict Mode-safe React and Next.js lifecycle bindings                                    |
| Profiles       | `@siteverb/profiles`      | Dated, feature-level client compatibility evidence                                       |
| Static audit   | `@siteverb/audit`         | AST-based source ownership and contract drift checks                                     |
| Browser runner | `@siteverb/runner`        | Deterministic journeys, postconditions, cleanup, and real-browser reports                |
| GitHub Action  | `actions/siteverb`        | Customer-run audit and browser checks with bounded artifacts                             |
| Agent Skill    | `.agents/skills/siteverb` | Local discovery, approval, migration, contract generation, and CI setup                  |
| Fixtures       | `examples/`               | Read-only and stateful native WebMCP acceptance sites                                    |

## Convert an existing site

The phase-one converter is a user-runnable Agent Skill. It works locally before any GitHub App or
Siteverb cloud account exists:

Install the Siteverb Agent Skill into a compatible coding agent:

```sh
npx skills add siteverb/siteverb --skill siteverb
```

Then ask the agent to make the current website WebMCP-ready. The skill:

1. Inspects routes, forms, client actions, auth boundaries, and existing WebMCP code locally.
2. Proposes 3-10 journey-level tools and waits for approval.
3. Reuses the application's real browser-reachable logic through `@siteverb/webmcp`.
4. Creates `siteverb.webmcp.json` with stable IDs, examples, risk, postconditions, and cleanup.
5. Verifies the tools in a named Chrome build and installs the customer-run Action.

Run `/siteverb full` for the complete flow, or use `/siteverb inventory`, `/siteverb implement`,
`/siteverb verify`, and `/siteverb status` as resumable stages. The durable output is the website's
`siteverb.webmcp.json`; `.agents/skills/siteverb/SKILL.md` is the workflow that creates and maintains
it. See [the conversion guide](docs/convert-a-site.md) for approvals, generated files, safety stops,
and the exact boundary before the GitHub App/cloud phase.

It understands raw `document.modelContext`, Nekuda/AgentLane SDKs, MCP-B, React WebMCP hooks,
declarative forms, vanilla/static sites, React/Next.js, Vue, Svelte, and Angular. It preserves another
runtime when coexistence is safer than migration and labels partial coverage honestly.

## Register tools

```ts
import { createSiteverb, defineTool } from '@siteverb/webmcp';

const searchProducts = defineTool({
  id: 'catalog.search-products',
  name: 'search_products',
  description: 'Search products available in the catalog.',
  inputSchema: {
    type: 'object',
    properties: { query: { type: 'string' } },
    required: ['query'],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true },
  execute: ({ query }: { query: string }, { signal }) => searchProductsInApp(query, signal),
});

const webmcp = createSiteverb();
const registration = webmcp.registerTool(searchProducts);
await registration.ready;
```

The stable `id` stays fixed across wire-name and schema evolution. It is not exposed to browser
agents. The package targets the current `document.modelContext` draft, adds no polyfill, and has no
runtime dependency.

## Define the task contract

`siteverb.webmcp.json` records tools and complete deterministic journeys:

```json
{
  "version": 1,
  "project": "acme-store",
  "tools": [
    {
      "id": "catalog.search-products",
      "name": "search_products",
      "description": "Search products available in the catalog.",
      "annotations": { "readOnlyHint": true },
      "risk": "read-only",
      "examples": [{ "name": "Search boots", "input": { "query": "boots" } }]
    }
  ],
  "journeys": [
    {
      "id": "catalog.search-visible-products",
      "name": "Search visible products",
      "start": "/shop",
      "steps": [
        {
          "tool": "catalog.search-products",
          "input": { "query": "boots" },
          "expect": {
            "dom": [{ "selector": "[data-test=results]", "textContains": "Boot" }]
          }
        }
      ]
    }
  ]
}
```

The JSON Schema is published at `@siteverb/contracts/siteverb.webmcp.schema.json`.

## Prove source and behavior

Run the static source-to-contract audit:

```sh
npx @siteverb/audit --contract siteverb.webmcp.json --output .siteverb/audit.json
```

Run deterministic journeys against a running local or preview site:

```sh
npx @siteverb/runner \
  --contract siteverb.webmcp.json \
  --url http://127.0.0.1:3000 \
  --output .siteverb/report.json \
  --profile chatgpt-site-tools-2026-08-26
```

The runner opens a fresh page per journey, refreshes dynamic tools before every step, executes via
Puppeteer's official `page.webmcp`, validates result/URL/DOM postconditions, and attempts cleanup.
Mutations and guarded tools require explicit CLI opt-ins.

## GitHub Action

Start the app in the workflow, then run:

```yaml
- uses: siteverb/siteverb/actions/siteverb@v0.1.0
  with:
    url: http://127.0.0.1:3000
    contract: siteverb.webmcp.json
    profile: chatgpt-site-tools-2026-08-26
```

The Action uses exact audit/runner versions on the customer's runner, writes one job summary,
uploads bounded reports, and restores the first failing conclusion. It never uploads repository
source or browser credentials to Siteverb.

## Evidence and privacy

Siteverb distinguishes `real-client`, `real-browser`, `official-sdk`, `documented-profile`, and
`spec-only` evidence. A documented profile never becomes a real-client pass.

Default production metadata and CI reports exclude prompts, tool arguments/results, DOM content,
raw URLs, credentials, user identifiers, and client identity. Callback completion is a tool
execution outcome, not proof of business conversion.

## Repository boundary

This public monorepo owns portable code that customers can run without Siteverb:

```text
packages/           SDK, contracts, React bindings, profiles, audit, runner
actions/siteverb/   customer-owned GitHub Action
.agents/skills/     coding-agent migration skill
examples/           native browser acceptance fixtures
```

The future private `siteverb-cloud` monorepo will contain the hosted dashboard/API, GitHub App
service, telemetry ingestion, analytics, orchestration, billing, and organization controls. Those
services share tenant and release state and should remain one cloud repository, not a repository per
service.

## Development

```sh
nvm use
npm ci
npm run check
npm run test:integration:webmcp
npm run test:integration:runner
npm run test:integration:react
```

The verified local environment is Node.js `24.18.0`, npm `11.16.0`, and native Chrome. See
[CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md),
[conversion workflow](docs/convert-a-site.md), [architecture](docs/architecture.md),
[component audit](docs/audit-report.md), [npm publishing](docs/publishing.md),
[ecosystem research](docs/ecosystem.md), and
[CHANGELOG.md](CHANGELOG.md).

Apache-2.0 licensed.
