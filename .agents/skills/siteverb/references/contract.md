# Portable contract

The repository-root `siteverb.webmcp.json` is the shared source for local verification, CI, and
future production diagnosis. Validate it against
`@siteverb/contracts/siteverb.webmcp.schema.json`.

## Required structure

```json
{
  "version": 1,
  "project": "acme-store",
  "support": [],
  "tools": [
    {
      "id": "catalog.search-products",
      "name": "search_products",
      "description": "Search products available in the catalog.",
      "inputSchema": { "type": "object", "properties": {} },
      "annotations": { "readOnlyHint": true },
      "risk": "read-only",
      "routes": ["/shop"],
      "owners": ["@acme/catalog"],
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
            "result": { "contains": { "count": 1 } },
            "dom": [{ "selector": "[data-test=results]", "textContains": "Boot" }]
          }
        }
      ]
    }
  ]
}
```

## Rules

- Tool and journey IDs are durable lowercase dot namespaces.
- Journey steps reference stable IDs, not wire names.
- `equals` compares an entire JSON result; `contains` checks a recursive subset.
- DOM assertions use stable test/product selectors, never generated class names.
- URL paths are same-origin and begin with `/`.
- Mutation journeys define cleanup using seeded/dev-safe actions.
- Consequential steps appear in `policy.requireHumanBefore` or stop before the consequence.
- `support` includes only an exact version/evidence statement the project actually tested or cited.
- Do not store secrets, authentication state, raw production examples, or model prompts.

The generated runner report intentionally excludes authored inputs and observed outputs by default.
Postconditions prove behavior without turning the evidence artifact into a data leak.
