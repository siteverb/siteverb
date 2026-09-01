# Siteverb public repository audit

**Audit date:** 2026-09-01  
**Release candidate:** 0.1.0  
**Scope:** Public `siteverb` repository only

## Verdict

The public repository is complete for its phase-one purpose: a developer can install the Siteverb
Agent Skill into an existing website repository, run `/siteverb full`, review two explicit approval
boundaries, generate customer-owned WebMCP code plus `siteverb.webmcp.json`, prove the result in a
native browser, and install customer-run CI without a Siteverb account, GitHub App, or cloud service.

No known release-blocking implementation defect remains. The final source gate passes 110 tests
across 14 files, all workspace typechecks/builds, six public package checks, the fixed 0.1.0 release
train, zero npm vulnerabilities, three native Chrome integrations, and clean source audits for every
fixture.

This is not a certification that a website, agent, or WebMCP tool is secure. Registration remains
capability discovery; the application's server remains the authentication, authorization,
validation, tenancy, rate-limit, and business-invariant boundary.

## Phase-one user product

Two artifacts have different jobs:

| Artifact                           | Owner                         | Purpose                                                               |
| ---------------------------------- | ----------------------------- | --------------------------------------------------------------------- |
| `.agents/skills/siteverb/SKILL.md` | Siteverb public repository    | Installable workflow a compatible coding agent runs                   |
| `siteverb.webmcp.json`             | Converted customer repository | Durable tool, journey, risk, approval, cleanup, and evidence contract |

The expected user flow is:

1. Install with `npx skills add siteverb/siteverb --skill siteverb`.
2. Run `/siteverb full`, or use `inventory`, `implement`, `verify`, and `status` separately.
3. Approve inventory scope, `curated` versus route-parity coverage, and ignored migration state.
4. Review the concrete tool plan before any product-code or dependency change.
5. Let the skill reuse existing browser actions, forms, stores, client data, and server endpoints.
6. Receive customer-owned registration code and `siteverb.webmcp.json`.
7. Run existing tests/build, static ownership audit, and deterministic native-browser journeys.
8. Install `.github/workflows/siteverb.yml` for customer-run checks.

The JSON file is deliberately not an executable loader. Keeping it data-only makes the contract
portable across local agents, CI, the public runner, and the future hosted lifecycle without giving
a hosted service runtime ownership of the customer's page.

## Component audit

| Component                               | What it does                                                                                                                                                      | Why it exists                                                                                                                    | Audited boundary and status                                                                                                                                                                        |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root npm workspace                      | Orders builds, tests, package checks, integrations, and release validation                                                                                        | One command must exercise the whole portable artifact chain in dependency order                                                  | `npm run check` covers all six public packages and three examples                                                                                                                                  |
| `@siteverb/contracts`                   | Parses versioned project contracts and bounded run reports; emits Draft 2020-12 JSON Schemas                                                                      | Audit, runner, Action, skill, profiles, and future cloud need one portable vocabulary                                            | Strict objects, cross-references, unique identities, risk/approval checks, same-origin paths, collection limits, origin-only report targets, and summary integrity pass 11 tests                   |
| `@siteverb/webmcp`                      | Registers native `document.modelContext` tools with stable Siteverb identity, lifecycle handles, coverage, cancellation, testing adapters, and optional telemetry | The site must own callback execution while Siteverb adds durable lineage and production diagnostics                              | Zero runtime dependencies; no polyfill; identity/cancellation races, atomic batches, listener cleanup, endpoint constraints, bounded metadata, retries, and credential-free delivery pass 37 tests |
| `@siteverb/react`                       | Binds the framework-neutral SDK to React and Next.js lifecycle                                                                                                    | Strict Mode, SSR, callback freshness, external aborts, and route/component cleanup are easy to implement incorrectly in each app | Children remain visible in SSR/first paint; one committed owned client; external/owned transitions and cleanup pass 6 tests                                                                        |
| `@siteverb/profiles`                    | Stores dated, feature-level client compatibility with evidence provenance                                                                                         | Browser/client support must be an exact fact, not a generic `supported` claim                                                    | Chrome 151/152 real-browser snapshots ship in `evidence/`; Edge 150 and ChatGPT are documented profiles; assessments pass 6 tests                                                                  |
| `@siteverb/audit`                       | Parses source and markup to compare registrations with the portable contract                                                                                      | Browser success alone cannot show who owns callback code or whether contract/source drift exists                                 | Babel AST plus `parse5`; supports direct, inline, batch, static factory, React, HTML, Vue, Svelte, and known external runtimes; origin/autosubmit lint and portable reports pass 17 tests          |
| `@siteverb/runner`                      | Executes complete contracted journeys in native Chrome through Puppeteer's `page.webmcp`                                                                          | Release evidence needs deterministic outcomes and visible postconditions, not only tool discovery or model judgment              | Preflight, dynamic refresh, mutation/approval gates, aborting timeouts, redaction, origin-only reports, fail-fast steps, best-effort cleanup, profiles, and closure pass 16 tests                  |
| `actions/siteverb`                      | Composes exact audit/runner packages on the customer's GitHub runner                                                                                              | Teams need a transparent release gate before the future GitHub App exists                                                        | Failure-tolerant bounded summary, Markdown neutralization, correct artifacts, first-failure conclusion, least privilege, and immutable third-party Action SHAs pass 6 tests                        |
| Siteverb Agent Skill                    | Discovers, proposes, migrates, verifies, heals, and reports an existing site's WebMCP surface                                                                     | This is the user-runnable phase-one converter                                                                                    | Five modes, two approvals, atomic resumable state, dirty baseline, role fixtures, secure-context/CORS gates, curated/parity coverage, bounded healing, and CI output pass 6 tests                  |
| Vanilla fixture                         | Proves a minimal native read-only registration and visible search result                                                                                          | Establishes compatibility with browser modules and upstream `webmcp-evals` smoke                                                 | One tool and one journey pass native Chrome                                                                                                                                                        |
| Stateful fixture                        | Proves dynamic multi-step state, reversible mutations, consequential approval, and cleanup                                                                        | Exercises the highest-risk public runner and contract behavior                                                                   | Six tools; five journey steps and one cleanup step pass Chrome 152.0.7977.65                                                                                                                       |
| React fixture                           | Proves native registration through the React adapter under Strict Mode                                                                                            | Unit lifecycle correctness still needs real-browser acceptance                                                                   | Static audit is 1/1 with zero findings; one native journey passes Chrome 152.0.7977.65                                                                                                             |
| Security and ecosystem docs             | State producer threats, release checklist, residual risks, and external project boundaries                                                                        | Siteverb must not market generation or registration as a security guarantee or rebuild adjacent infrastructure                   | Current Chrome guidance and ecosystem projects are separated into explicit controls and interoperability decisions                                                                                 |
| CI, CodeQL, Dependabot, release scripts | Validate changes and publish the fixed package train through OIDC provenance                                                                                      | Portable packages need reproducible release and supply-chain controls                                                            | Third-party Actions use immutable SHAs; release requires exact `v0.1.0`, GitHub tag context, OIDC, and provenance; no long-lived npm token                                                         |
| Brand and governance files              | Define naming, visuals, contribution, security reporting, ownership, issue, and pull-request paths                                                                | A public repository needs an operating surface, not only package code                                                            | Apache-2.0 code license, private vulnerability path, CODEOWNERS, templates, and inspected raster/vector assets are present                                                                         |

## Architecture decisions

### One portable chain

The dependency direction is intentional:

```text
Agent Skill -> customer code + siteverb.webmcp.json
siteverb.webmcp.json -> contracts -> profiles/audit/runner -> Action
webmcp -> react
```

The browser SDK does not import Zod, Puppeteer, Babel, React, GitHub code, or Node-only modules. The
Action does not implement a second audit or runner. The skill does not vendor a second SDK. These
boundaries keep browser payload, package ownership, and future replacement costs small.

### Why TypeScript source imports `.js`

Relative imports such as `./puppeteer.js` are correct in the TypeScript source. With `NodeNext`,
TypeScript resolves that runtime specifier to the neighboring `.ts` source and preserves it as
`.js` in emitted ESM. Standard Node ESM requires explicit relative extensions; changing these to
extensionless imports would typecheck only under bundler-specific resolution and break direct Node
execution of unbundled packages.

The browser export is separately bundled by esbuild, so browser consumers do not see internal
relative specifiers. See `docs/architecture.md` for the complete rationale.

### Interoperability, not duplication

Siteverb does not own polyfills, iframe/tab/extension transports, generic DOM auto-clicking, MCP
relays, browser inspectors, or model-eval engines. MCP-B, Google WebMCP tools, Nekuda, Latch,
`usewebmcp`, and similar projects remain integration or migration targets. Siteverb owns reviewed
conversion plus the contract-to-release-to-production evidence history.

## Security hardening completed

| Area                   | Resolved control                                                                                                                                                                                               |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authorization          | Skill and docs state that registration, routes, UI visibility, schemas, annotations, and `exposedTo` are not server authorization                                                                              |
| Consequential actions  | Contracts require explicit approval for consequential main and cleanup steps; the runner requires both mutation and per-tool approval flags                                                                    |
| Declarative actions    | Static audit rejects state-changing `toolautosubmit`                                                                                                                                                           |
| Origin exposure        | Audit rejects wildcard, insecure, path-bearing, or malformed literal `exposedTo` values and warns on dynamic policy                                                                                            |
| Journey navigation     | Contract starts and declared routes must resolve to same-origin paths; protocol-relative and backslash-normalized cross-origin values fail                                                                     |
| Tool cancellation      | Already-cancelled calls never enter application code; pre-cancelled batches make no native calls; runner timeouts pass an abort signal into native execution                                                   |
| Registration races     | Identity hashing completes before a registration commits; cancellation cannot emit an out-of-order registered/unregistered pair                                                                                |
| React lifecycle        | Owned clients are render-pure, survive Strict Mode probes, preserve SSR UI, and never reuse a disposed client across ownership transitions                                                                     |
| Error privacy          | Page/browser errors are categorized and redacted by default; detailed local errors require explicit opt-in                                                                                                     |
| URL privacy            | Reports persist only the target origin and never include observed paths or configured/observed URL parameter values on mismatch                                                                                |
| Cleanup                | Every cleanup step uses the same mutation/approval gates and is attempted even when an earlier cleanup fails                                                                                                   |
| Report integrity       | Contracts bound collections, require origin-only targets, and verify summary counts against journey statuses                                                                                                   |
| Audit privacy          | Static reports contain relative paths and `root: "."`; contracts outside the audited root are rejected                                                                                                         |
| Action rendering       | Untrusted labels are length-bounded and neutralized before GitHub Markdown output; missing/malformed reports do not mask the original conclusion                                                               |
| Action artifacts       | Audit-disabled runs cannot upload a stale audit file                                                                                                                                                           |
| Telemetry payload      | Disabled by default; no prompts, arguments, results, DOM, full URLs, credentials, user IDs, raw errors, or client identity                                                                                     |
| Telemetry route labels | Full URLs, query/fragment data, controls, and overlong route templates are omitted with one diagnostic                                                                                                         |
| Telemetry transport    | Same-origin relative, HTTPS, or loopback endpoints only; URL credentials/query/fragment and backslash-normalized cross-origin paths rejected; all default sends use keepalive fetch with `credentials: "omit"` |
| Telemetry reliability  | Queue/batches are bounded, failed batch identity is stable, retry backoff is bounded, and automatic retries pause                                                                                              |
| Supply chain           | Lockfile present, public package contents checked, Actions pinned to commits, OIDC/provenance release, no repository npm token                                                                                 |

## Conversion-skill completeness

The skill is designed for existing repositories, including large or authenticated applications:

- `inventory`: read-only scope and candidate mapping.
- `implement`: resumes only an explicitly approved tool plan.
- `verify`: runs ascending-cost checks and bounded repair.
- `status`: reports persisted progress without writes.
- `full`: executes the complete resumable workflow.

`.siteverb/migration.json` records decisions and evidence, not source or secrets. It is written only
after scope/state approval, is atomic, and is ignored by default. Product edits require a separate
tool-plan approval. The baseline records Git SHA and pre-existing dirty paths; a repository with no
first commit uses `sha: null` and treats every existing path as dirty.

Each candidate tool records the real browser implementation, server authority, stable ID, wire name,
schema, effect, result, risk, owner, routes, examples, postconditions, and status. Unsafe candidates
are excluded instead of converted. Role fixtures store procedures and environment-variable names,
never credential values.

Verification classifies every tool as `verified`, `failed`, or `could-not-verify`. Healing is capped
at three attempts per normalized failure signature and contract revision. It cannot weaken an
assertion, remove cleanup, bypass auth, silently alter an approved contract, or increase timeouts
without evidence.

## Measured evidence

### Unit and static checks

| Check              | Result                                                             |
| ------------------ | ------------------------------------------------------------------ |
| Unit tests         | 110 passed across 14 files; 0 failed; 0 skipped                    |
| SDK                | 37 tests                                                           |
| Contracts          | 11 tests                                                           |
| Profiles           | 6 tests                                                            |
| React              | 6 tests                                                            |
| Audit              | 17 tests                                                           |
| Runner             | 16 tests                                                           |
| Action             | 6 tests                                                            |
| Root release/skill | 11 tests                                                           |
| TypeScript         | All workspaces pass strict typecheck                               |
| Formatting         | Repository-wide Prettier check passes                              |
| Builds             | Six packages and three examples pass                               |
| Package checks     | Six `publint` and ESM-only `attw` checks pass                      |
| Release train      | Six public packages fixed at 0.1.0 with compatible internal ranges |
| Dependency audit   | 0 vulnerabilities                                                  |

The `attw` output intentionally warns that CommonJS `require` cannot consume ESM-only entries without
dynamic `import()`. The package contract is explicitly ESM-only; ESM, bundler, declarations, JSON
exports, and packed artifacts pass.

### Native browser and source evidence

| Surface                    | Evidence                                                                                                               |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Chrome 151                 | Committed bounded report for 151.0.7922.175; read-only native journey passed                                           |
| Chrome 152                 | Committed bounded report for 152.0.7977.65; five stateful steps and cleanup passed                                     |
| Chrome 152 profile         | Exact profile assessed compatible with no findings                                                                     |
| ChatGPT Site Tools profile | Dated documented profile assessed compatible for the stateful imperative top-level contract; not real-client execution |
| Vanilla source             | 1/1 source/contract tools, 0 errors, 0 warnings                                                                        |
| Stateful source            | 6/6 source/contract tools, 0 errors, 0 warnings                                                                        |
| React source               | 1/1 source/contract tools, 0 errors, 0 warnings                                                                        |
| React browser              | One native journey passed Chrome 152.0.7977.65                                                                         |

Profile snapshots ship from `@siteverb/profiles/evidence/chrome-151-native.json` and
`@siteverb/profiles/evidence/chrome-152-native.json`. Stable-channel CI intentionally fails its exact
152 assertion when Chrome advances, forcing a new immutable profile/evidence snapshot rather than
silently changing the meaning of `chrome-152-native`.

## Residual risks

These are platform or product boundaries, not hidden implementation claims:

- WebMCP is a developing Community Group surface and client behavior can change.
- Prompt injection remains unsolved; `untrustedContentHint` is a signal, not prevention.
- Tool metadata, schemas, and annotations can misdescribe arbitrary callback behavior.
- No portable WebMCP field proves agent identity or user intent.
- Cancellation cannot roll back a server mutation that already committed.
- Cleanup is best-effort evidence, not a database transaction or universal undo.
- Static analysis cannot resolve every dynamic factory, alias, generated source, or runtime loader;
  warnings plus runtime inventory expose those limits.
- Model-backed evals are probabilistic and remain separate from deterministic release status.
- Local/CI fixtures do not prove production conversion causality, every auth role, or every agent
  client.
- The future collector must independently authenticate organization configuration, validate events,
  rate limit, deduplicate, retain/delete lawfully, and treat public site IDs as spoofable.

## Human-controlled release prerequisites

Source code cannot prove remote account settings. Before publishing 0.1.0, the maintainer must:

1. Create or configure `siteverb/siteverb` without overwriting local history.
2. Protect `main` and release tags; require CI and CodeQL; disallow force pushes/deletions.
3. Enable Dependabot alerts/updates, secret scanning, push protection, and private vulnerability reporting.
4. Create the npm `@siteverb` scope and configure Trusted Publishing for the exact repository,
   `.github/workflows/release.yml`, and protected `npm` environment.
5. Confirm package names are available and handle npm's first-publication requirement directly.
6. Perform trademark/domain clearance before paid launch.
7. Create `v0.1.0` only after the remote checks pass.

## Scope explicitly not started

The public repository does not contain the hosted dashboard, collector, GitHub App service, tenant
storage, billing, cloud orchestration, or production analytics. Those belong together in the future
private `siteverb-cloud` monorepo after this standalone conversion and release workflow is accepted.

No commit, push, npm publication, GitHub organization mutation, or deployment is part of this audit.
