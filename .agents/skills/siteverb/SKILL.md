---
name: siteverb
description: 'WebMCP agent skill that converts an existing website or web app into a reviewed, agent-ready surface. Use to inventory, add, migrate, verify, heal, or audit document.modelContext tools, siteverb.webmcp.json journeys, and Siteverb CI.'
argument-hint: '[inventory|implement|verify|status|full] [scope]'
user-invocable: true
---

# Siteverb

Create customer-owned WebMCP tools around an application's existing browser-reachable behavior,
then generate the portable contract, deterministic journey checks, and customer-run GitHub Action.

## Modes

| Argument             | Work performed                                   | Stop point                                     |
| -------------------- | ------------------------------------------------ | ---------------------------------------------- |
| `inventory` or `map` | Detect, choose coverage, and map candidate tools | Present reviewed plan; no product-code changes |
| `implement`          | Resume an approved plan and add tools/contracts  | Build passes                                   |
| `verify`             | Run static/native checks and bounded healing     | Evidence report complete                       |
| `status`             | Read migration state and current contract        | Report only; no writes                         |
| `full` or omitted    | Resume the complete workflow                     | Audit and report complete                      |

Other arguments narrow the product area or risk, such as `checkout read-only only`. Never widen a
previously approved scope from an ambiguous argument.

Invoke the complete conversion with `/siteverb full`. Use `inventory`, `implement`, `verify`, and
`status` as resumable stages for larger repositories.

## Outputs

An approved run creates customer-owned application wiring plus a repository-root
`siteverb.webmcp.json`. The JSON file is the portable tool/journey contract consumed by the static
audit, browser runner, GitHub Action, and future Siteverb cloud; it is not an executable loader.

The run may also create ignored `.siteverb/migration.json` progress and
`.github/workflows/siteverb.yml`. It never requires a Siteverb account or hosted connection.

## Non-negotiable rules

- Work locally. Do not send repository contents, routes, schemas, or source to Siteverb.
- Record the initial Git SHA and dirty paths. Never modify, format, or revert a file that was already dirty.
- Read first and present a concrete scope/state plan before changing files or dependencies.
- Do not change product code or dependencies before the concrete tool plan is approved.
- Wait for explicit approval of the tool plan in a human-facing run.
- Propose 3-10 journey-level tools. Do not wrap every endpoint or invent unsupported capabilities.
- Reuse existing application functions, client data layers, forms, and same-origin routes.
- Registration visibility is not authorization. Underlying server actions must enforce auth and input validation.
- Payments, deletion, cancellation, publishing, and other irreversible actions stop at a reversible handoff or require a separate explicit confirmation boundary.
- Use stable `domain.action` IDs once. Preserve them on every later run even when wire names change.
- Route imperative registrations through `@siteverb/webmcp`; do not monkey-patch the native API.
- Keep telemetry disabled unless the developer explicitly supplies a public site ID and collector.
- Never report a tool as verified unless it was discovered and safely invoked in a named browser build.
- Never invoke mutations against production or third-party services.
- State-changing declarative forms never use `toolautosubmit`.

## Resumable state

After a lightweight read-only inspection, ask the developer to approve the inventory scope,
coverage mode, and creation of local migration state. Once approved, create
`.siteverb/migration.json` from [migration-state.json](./assets/migration-state.json). Write it
atomically through a temporary file and rename. It records only paths, decisions, statuses, evidence,
and environment-variable names; never secret values.

`inventory` remains read-only unless the developer explicitly asks to persist it. Approval to write
migration state is not approval to edit product code, install packages, or implement proposed tools.

Load [state.md](./references/state.md). On every invocation:

1. If migration state exists, validate and resume its first incomplete phase.
2. Recheck the Git baseline and refuse to touch paths dirty before the run.
3. Invalidate affected inventory when routes, auth policy, or approved tool semantics changed.
4. Persist after each area, approved batch, verification result, and bounded healing attempt.

The committed `siteverb.webmcp.json` remains the portable product contract. Local migration state is
operational progress and belongs under the ignored `.siteverb/` directory unless the developer
explicitly chooses to commit it.

## Workflow

### 1. Inspect without writing

Run [inspect-project.mjs](./scripts/inspect-project.mjs) from the target repository when Node.js is
available. Then read the project's own README, agent instructions, manifests, router, primary
layouts, forms, client data layer, auth boundaries, and test commands.

If no migration state exists, keep this first pass small: establish the baseline, repository shape,
candidate areas, and blockers; then obtain scope/state approval before deep per-area inventory. If
state exists, validate it and resume the first incomplete phase.

Load [discovery.md](./references/discovery.md). Inventory:

- Framework, rendering mode, package manager, and browser entry points.
- Routes, forms, visible user actions, same-origin client calls, and state stores.
- Existing `document.modelContext`, `@siteverb/webmcp`, `@nekuda/webmcp-sdk`, MCP-B,
  `usewebmcp`, declarative WebMCP forms, or framework-native helpers.
- Existing stable IDs, tool names, schemas, annotations, and callback implementations.
- Whether each candidate action is browser-reachable and independently authorized.

Before deep inventory, establish:

- A secure verification context: HTTPS or an actual loopback origin. Plain HTTP on a named host is a blocker.
- The observed start command and URL, never a guessed framework default.
- Backend origins and exact CORS assumptions needed for the chosen verification origin.
- Auth roles plus the procedure and environment-variable **names** used to obtain each test session.
- Coverage mode: `curated` high-value journeys or route-by-route `parity`. Never silently choose.

For a large app, map routes/features first, then inventory one area at a time. Persist each area's
completion before opening the next; do not load a whole monorepo into one agent context.

If the application cannot run locally or no browser-reachable journey exists, stop and explain the
specific blocker. Do not generate demonstration tools into production code.

### 2. Select useful journeys

Load [tool-design.md](./references/tool-design.md). Simulate concrete users completing concrete
tasks. Prefer a small coherent surface over endpoint coverage.

For each proposal identify:

- Stable ID and WebMCP wire name.
- User journey and routes where the tool should exist.
- Exact existing function, form, store, or same-origin route it will call.
- Input schema, visible effect, result shape, risk, auth boundary, and confirmation behavior.
- At least one deterministic example and postcondition.
- Exact source module and registrar/entry module to change.
- Status: `decided`, `needs input`, or `not safe to expose`.

### 3. Ask for approval

Load [security.md](./references/security.md) and apply every blocking check before presenting the
plan. A failing security boundary makes the candidate `not safe to expose`, not merely a warning.

Present one compact table. Ask only questions that block safe wiring. Do not edit files, install
packages, create a branch, or start a hosted connection before approval.

After approval, treat the stable IDs, behavior, source paths, and risk boundaries as the accepted
plan. If implementation evidence later contradicts the plan, pause and ask before widening it.

### 4. Implement customer-owned tools

Load [framework-wiring.md](./references/framework-wiring.md) and
[migration.md](./references/migration.md).

1. Install the exact current compatible `@siteverb/webmcp` release with the repository's package manager.
2. Create one browser-only Siteverb client at the application boundary.
3. Keep each tool definition side-effect free and register it only from the correct route/state lifecycle.
4. Preserve existing functions and server authorization; adapt rather than duplicate business logic.
5. Pass the callback cancellation signal into fetches and long-running browser work.
6. Throw on execution failure. Do not return a success-shaped object when an action failed.
7. Return concise structured results; avoid HTML, full documents, credentials, or large payloads.
8. Unregister route/state tools when they stop being relevant.

Do not add a polyfill unless the project explicitly needs non-native development or testing. When a
polyfill already exists, preserve its initialization and place Siteverb above the resulting standard
`document.modelContext` surface.

### 5. Generate the portable contract

Load [contract.md](./references/contract.md). Create or update `siteverb.webmcp.json` at the
repository root. Preserve existing stable IDs and journeys. Include:

- Every Siteverb-owned imperative tool and its real current metadata.
- Risk, routes, owners, deterministic examples, and input schema.
- At least one complete journey with ordered stable IDs and result/URL/DOM postconditions.
- Cleanup for mutation journeys.
- Human-approval policy for consequential steps.
- Only support profiles backed by dated evidence.

Do not put secrets, cookies, credentials, raw prompts, source paths, production payloads, or model
configuration in the contract.

### 6. Verify in ascending cost order

Load [verification.md](./references/verification.md).

1. Run the repository's existing typecheck and tests.
2. Run its production build.
3. Start the application using its documented local command.
4. Validate registration on every declared route/auth state and absence in disallowed states.
5. Invoke read-only tools and check both result and visible effect.
6. Invoke mutations only on local/seeded data after explicit approval; always run cleanup.
7. Run `@siteverb/runner` against `siteverb.webmcp.json` in a named Chrome build.

Every tool ends as `verified`, `failed`, or `could-not-verify`. Fix or remove failed tools. Keep
could-not-verify tools visibly flagged; never convert that state to success.

Load [healing.md](./references/healing.md) for failures. Classify the failure before editing, make
one smallest fix, and rerun the same check. Cap independent attempts at three per failure signature
and contract revision. Never widen the diff, weaken an assertion, or alter an approved contract just
to produce a pass.

### 7. Install customer-run CI

Adapt [siteverb-workflow.yml](./assets/siteverb-workflow.yml) to the repository's real install,
build, preview, and readiness commands. Add it under `.github/workflows/` only after the local runner
passes. Keep permissions at `contents: read` unless another explicit requirement exists.

The Action target must be local or an approved preview environment. Never place credentials in the
contract or workflow. Use GitHub secrets only for the application's existing test setup, and do not
expose them to untrusted fork pull requests.

### 8. Report the result

Summarize:

- Approved and implemented tools with stable IDs.
- Files changed and existing logic reused.
- Contract journeys and postconditions.
- Static, build, native-browser, and Action validation performed.
- Exact browser/version and evidence level.
- Failed or could-not-verify items and why.
- Telemetry state (`disabled` unless explicitly configured).
- Coverage mode, mapped/deferred routes, baseline dirty paths, and security exclusions.
- Security checklist result and any behavior that remains outside Siteverb's guarantees.

Do not connect a hosted product, create an account, publish packages, merge, or deploy without a
separate explicit request.
