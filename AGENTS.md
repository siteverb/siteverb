# Siteverb

This is the public, portable half of Siteverb. It contains the WebMCP SDK, contracts, compatibility
profiles, source audit, deterministic runner, React bindings, customer-owned Action, Agent Skill,
and acceptance fixtures.

## Boundaries

- Do not add the hosted dashboard, collector, GitHub App service, billing, tenant data, or secrets.
- Keep `@siteverb/webmcp` browser-native, dependency-free at runtime, and standards-first.
- Do not duplicate upstream polyfills, browser transports, or model eval engines.
- Reuse `webmcp-evals` for upstream comparison; Siteverb owns task postconditions, evidence, source
  coverage, and release contracts.

## Commands

```sh
nvm use
npm ci
npm run check
npm run test:integration:webmcp
npm run test:integration:runner
npm run test:integration:react
```

## Change discipline

Use the smallest owning package, add a focused regression test, preserve public APIs unless the
change is intentional, and keep browser/client evidence explicit. Never commit generated package
tarballs, `.siteverb` reports, credentials, or production payloads.
