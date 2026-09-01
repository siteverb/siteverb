# Convert a site with the Siteverb skill

Siteverb's first product surface is a local coding-agent workflow. It does not require the future
GitHub App, Siteverb account, collector, or cloud dashboard.

There are two different artifacts:

- `.agents/skills/siteverb/SKILL.md` is the installable workflow a compatible coding agent runs.
- `siteverb.webmcp.json` is the durable, generated contract in the converted website. It is data,
  not an executable script; the audit, runner, Action, and future cloud all consume it.

## Install

From the website repository, install the public skill:

```sh
npx skills add siteverb/siteverb --skill siteverb
```

The installer copies the Siteverb skill and its scripts, references, templates, and security gates
into the coding agent's supported skill location. Review that diff like any other development tool.

## Run

The complete workflow is:

```text
/siteverb full
```

For a large or sensitive repository, use the resumable stages:

```text
/siteverb inventory
/siteverb implement
/siteverb verify
/siteverb status
```

`inventory` first proposes the repository scope, `curated` versus route-parity coverage, and whether
to create ignored local state. It does not change product code. After that approval, the agent maps
real browser actions and presents a concrete tool plan with stable IDs, exact source anchors, input
schemas, effects, risk, authorization boundaries, examples, and postconditions. Product code and
dependencies remain unchanged until that second plan is explicitly approved.

## Generated result

An approved conversion can create or update:

```text
src/...                         customer-owned tool definitions and lifecycle wiring
siteverb.webmcp.json            portable tools, journeys, risk, approval, and cleanup contract
.siteverb/migration.json        ignored resumable progress; no credentials or secret values
.github/workflows/siteverb.yml  customer-run static and native-browser release check
```

Framework paths vary. The skill reuses the application's existing functions, forms, stores, client
data layer, server authorization, package manager, and test commands rather than generating a
parallel application layer.

The generated contract contains:

- Stable `domain.action` IDs independent of browser wire names.
- Tool metadata, minimal input schemas, risk, routes, owners, and deterministic examples.
- Complete browser journeys with result, URL, or DOM postconditions.
- Cleanup for state-changing fixtures and explicit approval policy for consequential tools.
- Only exact, dated browser/client support evidence.

It never contains source code, credentials, cookies, auth fixtures, raw prompts, production
payloads, tool results, or model configuration.

## Safety stops

The workflow stops rather than inventing a tool when:

- No browser-reachable implementation exists.
- The server does not independently authenticate, authorize, and validate the operation.
- A payment, deletion, publication, message, subscription, account, or legal action cannot stop at
  an existing visible confirmation boundary.
- The local verification origin is insecure, backend CORS is incompatible, or an auth role fixture
  is unavailable.
- Required source files were already dirty and the developer has not authorized those exact paths.
- A mutation target is production or third-party data.

## Proof and CI

Verification proceeds from existing tests and production build to source audit and a named native
Chrome run. Every tool ends as `verified`, `failed`, or `could-not-verify`; the skill never relabels
missing evidence as success. Failed checks permit at most three bounded repair attempts per failure
signature and contract revision.

The installed Action runs on the customer's GitHub runner with `contents: read`. It uses exact
Siteverb package versions, immutable third-party Action SHAs, redacted bounded reports, explicit
mutation/approval flags, and no connection to Siteverb cloud.

## Phase boundary

This completes **Create** and local **Prove** for the public repository. The future GitHub App may
automate pull-request orchestration and the future cloud may retain release-to-production history,
but neither is required to make a website WebMCP-ready or keep its contract passing in CI.
