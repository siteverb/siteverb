# Public repository architecture

The public monorepo is one portable artifact chain, not a collection of independent products.

```mermaid
flowchart LR
  User[Website repository] --> Skill[Siteverb Agent Skill]
  Skill --> SDK[@siteverb/webmcp]
  Skill --> SiteContract[siteverb.webmcp.json]
  SiteContract --> Contract[@siteverb/contracts]
  SDK --> React[@siteverb/react]
  Contract --> Profiles[@siteverb/profiles]
  Contract --> Audit[@siteverb/audit]
  Contract --> Runner[@siteverb/runner]
  Profiles --> Runner
  Audit --> Action[Customer GitHub Action]
  Runner --> Action
```

The skill is the phase-one conversion product. A user installs it into an existing website and runs
`/siteverb full`; the skill modifies customer-owned code only after review and creates the portable
`siteverb.webmcp.json` contract. The contract is the durable handoff among local verification,
customer CI, and the future hosted lifecycle, so conversion does not depend on the GitHub App or
cloud control plane.

## Ownership

- `@siteverb/webmcp`: browser-only native registration and opt-in metadata telemetry. No Node or
  framework dependency.
- `@siteverb/contracts`: portable schemas; the only shared vocabulary for tools, journeys, and
  bounded reports.
- `@siteverb/react`: React/Next lifecycle only. It does not own WebMCP semantics.
- `@siteverb/profiles`: dated compatibility facts and evidence labels.
- `@siteverb/audit`: Node-only source ownership; Babel AST plus `parse5`.
- `@siteverb/runner`: Node-only deterministic browser execution through Puppeteer.
- `actions/siteverb`: transparent composition of exact audit/runner package versions.
- `.agents/skills/siteverb`: repository transformation workflow and progressive references.

Dependency arrows point inward to the owning abstraction. The browser SDK never imports contracts,
Zod, Puppeteer, Babel, React, or GitHub code. The Action does not contain a second runner. The skill
does not vendor a second SDK.

## Why source imports use `.js`

Files such as `src/run.ts` intentionally import `./puppeteer.js`. TypeScript with `NodeNext`
resolves that specifier to `puppeteer.ts` while developing, then emits the same `./puppeteer.js`
specifier into `dist/run.js`.

This is required by standard Node ESM: relative runtime imports need explicit file extensions.
Changing to extensionless imports via `moduleResolution: "bundler"` would typecheck, but unbundled
`@siteverb/contracts`, `@siteverb/audit`, and `@siteverb/runner` output would fail when Node executes
it. TypeScript does not automatically append `.js` to emitted imports.

The browser entry is different: esbuild bundles `@siteverb/webmcp/browser` into one file, so consumers
do not see internal specifiers. We keep unbundled package modules for transparent stack traces,
tree-shaking, declarations, and direct Node interoperability. A package-import alias would only hide
the extension behind another configuration layer without improving runtime correctness.

## Scaling rule

Add a package only when it owns a distinct runtime/dependency boundary. React merits one because SSR,
Strict Mode, and committed callback freshness are nontrivial. Vue, Svelte, Angular, vanilla, and
static sites use the framework-neutral SDK plus skill recipes until repeated code justifies an
adapter.

The hosted dashboard, collector, GitHub App service, billing, orchestration, and tenant analytics
belong together in the future private `siteverb-cloud` monorepo because they share organization,
release, journey, evidence, and entitlement state. Do not create a repository per service.
