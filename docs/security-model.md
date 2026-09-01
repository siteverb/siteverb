# WebMCP producer security model

**Reviewed:** 2026-09-01

WebMCP lets an agent invoke page-owned JavaScript inside the user's live authenticated browser
session. Siteverb improves explicitness, evidence, and release discipline; it does not make an agent
trustworthy, identify the caller, or replace application authorization.

## Trust boundaries

| Boundary                       | Trusted for                              | Never trust it for                                  |
| ------------------------------ | ---------------------------------------- | --------------------------------------------------- |
| Browser session                | Existing cookies/session state           | Proof the agent's action matches user intent        |
| Tool metadata                  | Developer-declared capability            | Proof callback behavior matches the description     |
| JSON Schema                    | Agent guidance and basic shape           | Server authorization or complete input validation   |
| `readOnlyHint`                 | Safety hint                              | Enforcement; a wrong hint can suppress confirmation |
| `untrustedContentHint`         | Signal that output needs isolation       | Prompt-injection prevention by itself               |
| Route/state registration       | Keeping the offered surface relevant     | Authorization; state can change before invocation   |
| `exposedTo`/Permissions Policy | Browser origin visibility                | User consent or agent identity                      |
| Siteverb public site ID        | Collector routing                        | User, session, or agent authentication              |
| CI report                      | Deterministic evidence under one fixture | Production causality or universal client support    |

## Threats and controls

### Authentication, authorization, and tenancy

- Every callback must use the same server endpoint, auth middleware, tenant scope, validation, rate
  limits, and audit trail as the visible UI.
- Recheck authority at execution time. Registration may be stale after logout, role change, tenant
  switch, or a revoked entitlement.
- Do not expose credentials, sessions, login/logout, account recovery, MFA, role changes, signed
  URLs, API keys, billing credentials, or server-secret operations.
- Browser-only guards, hidden buttons, and route middleware that never reaches the server are not
  adequate for persistent mutations.

### Intent and consequential actions

- Tool names distinguish immediate execution from initiation (`create_event` versus
  `start_event_creation`). Descriptions state material side effects.
- Payment, irreversible deletion, public publishing, external messaging, subscription/account
  changes, and legal acceptance stop at an existing visible confirmation UI or server-held
  prepare/confirm transaction.
- State-changing declarative forms do not use `toolautosubmit`.
- Mutations should be idempotent, conflict-aware, and reversible where the domain allows.
- Cancellation reaches underlying fetch/work. Cancellation does not prove the server rolled back an
  already-committed operation.

### Prompt injection and output trust

- Names, descriptions, parameter text, page content, and outputs all enter an agent's model context
  and can carry adversarial instructions.
- Mark user-generated, third-party, retrieved, or otherwise untrusted output with
  `untrustedContentHint: true`; keep output small and structured.
- Do not echo arbitrary HTML or long documents. Return IDs, counts, bounded summaries, and safe URLs
  only when needed.
- Agent vendors still need deterministic limits, origin restrictions, user confirmations,
  spotlighting/delimiting, classifiers, critics, and adversarial evals. A website cannot enforce
  those model-side controls.

### Privacy and over-parameterization

- Request only fields required by the equivalent visible action. Agents may fill declared fields
  from private cross-site context, so optional personalization fields can become silent profiling.
- Never add age, location, health, pregnancy, purchase history, identity, or other sensitive fields
  merely because an agent might know them.
- Separate tool execution from acquisition/referral attribution. WebMCP exposes no portable caller
  identity.

### Origin and frame containment

- WebMCP requires a secure context. Use HTTPS or an actual loopback origin for development.
- Keep default same-origin exposure. Every `exposedTo` origin must be exact, secure, reviewed, and
  necessary.
- Cross-origin frames require `allow="tools"` plus matching `exposedTo`. Treat `postMessage` and
  extension page-world channels as forgeable unless independently authenticated.
- Use `Permissions-Policy: tools=()` on pages that must never expose tools.
- A third-party script runs with page privilege. Prefer pinned npm/vendored code, CSP, dependency
  review, and a customer-owned kill switch over mutable CDN loaders.

### Dynamic tools and races

- Validate current permissions and preconditions inside every callback even when a tool is
  state-gated.
- Avoid immediate unregister/re-register with the same wire name and changed schema while an old
  observation may still exist. Use stable identity and explicit state errors.
- Refresh discovery before each deterministic journey step. Do not assume a tool observed on the
  prior turn remains available.

### Testing, fixtures, and CI

- Public/fork pull requests never receive authenticated cookies, production secrets, or mutable
  production targets.
- Mutations require a seeded local/preview environment, explicit runner opt-in, approval for guarded
  stable IDs, and verified cleanup.
- The runner aborts timed-out tool calls and redacts page errors by default. Local detailed errors are
  opt-in and must not enter shared artifacts without independent redaction.
- Contract CSS selectors are trusted repository test configuration, not user input; invalid or slow
  selectors are bounded by per-step timeout and produce a redacted failure.
- Run source audit and real-browser checks. Static audit cannot prove runtime factory behavior;
  runtime `coverage()` and browser inventory close that gap.

### Telemetry and production data

- Telemetry is opt-in and metadata-only by default: stable ID, wire name, schema hash, release,
  route template, status, timing, and ephemeral first-party sequence identifiers.
- Do not collect prompts, arguments, results, DOM, cookies, credentials, user IDs, full URLs, or raw
  errors by default.
- Default delivery accepts only same-origin relative, HTTPS, or loopback HTTP endpoints, rejects URL
  credentials/query/fragment and cross-origin path normalization, and sends with `credentials: "omit"`.
- Treat browser batches and public site IDs as spoofable. Validate schemas twice, rate limit, dedupe
  by batch/event IDs, enforce origin policy, and separate production/synthetic/baseline ingestion.
- Respect consent signals, retention/deletion policy, regional requirements, and customer-controlled
  export/collector options before operating the hosted service.

### Supply chain and release

- Pin lockfiles and executable third-party Actions to immutable commits; review Dependabot updates.
- Publish npm packages only from protected tagged GitHub Actions through OIDC trusted publishing and
  provenance. Keep long-lived npm tokens out of repository secrets.
- Require CI, CodeQL, secret scanning/push protection, private vulnerability reporting, protected
  branches/tags, and review for release changes.
- Verify packed artifacts, declaration resolution, dependency count, and clean-consumer imports.

## Release checklist

Before enabling a tool:

- [ ] Existing browser-reachable behavior and server auth path identified.
- [ ] Stable ID, exact name, description, schema, risk, routes, owner, example, and postcondition approved.
- [ ] No overlapping tool creates ambiguous selection.
- [ ] Inputs are minimal and validated in code/server.
- [ ] Output is bounded; untrusted content is annotated.
- [ ] Consequential behavior stops at confirmation and appears in approval policy.
- [ ] Dynamic registration follows route/role/state and callbacks recheck state.
- [ ] Secure context and backend/CORS assumptions verified.
- [ ] `exposedTo`, frame policy, CSP, and Permissions Policy reviewed.
- [ ] Static source audit passes with no unexplained external runtime.
- [ ] Valid, invalid, cancellation, timeout, state-transition, and cleanup paths tested.
- [ ] Native browser journey and every claimed client profile carry exact evidence/version.
- [ ] Fork/secret policy prevents authenticated untrusted runs.
- [ ] Reports and telemetry contain no prohibited payload data.
- [ ] Disable/rollback path is documented and tested.

## Residual risk

Prompt injection remains unsolved, annotations can lie, browser/agent behavior is implementation
specific, authenticated agents can already exercise UI authority, and no current WebMCP field proves
caller identity or user intent. Siteverb can detect contract drift and measured regressions; it
cannot certify a tool or agent as safe.

## Primary sources

- https://developer.chrome.com/docs/ai/webmcp/secure-tools
- https://developer.chrome.com/docs/ai/webmcp/best-practices
- https://developer.chrome.com/docs/agents/security
- https://webmachinelearning.github.io/webmcp/#security-privacy
