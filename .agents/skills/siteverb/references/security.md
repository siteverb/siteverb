# WebMCP producer security gate

Apply this before tool approval and repeat it during final audit. Any failed trust-boundary or
consequential-action item blocks the tool.

## Identity and authority

- The server authenticates and authorizes every operation; route/component visibility is not auth.
- The callback uses the same endpoint, validation, tenant scope, rate limit, and audit path as the UI.
- The tool never exposes login, logout, signup, password, MFA, token, key, cookie, signed URL,
  account recovery, billing credential, or role-escalation behavior.
- Role-specific tools unregister on logout/role/tenant changes and revalidate authority at execution.
- No callback imports server secrets or privileged server-only modules into the browser.

## Consequences and consent

- `readOnlyHint: true` appears only on genuinely non-persistent reads/view changes.
- State-changing forms never use `toolautosubmit`.
- Payment, irreversible deletion, public posting, external messaging, subscription/account changes,
  and legal acceptance stop at the app's existing visible confirmation UI.
- Initiation tools say `start` or `prepare` and do not perform hidden parts of the final mutation.
- Retried mutations are idempotent or protected by the application's existing idempotency mechanism.

## Input and output

- Inputs are the minimum the equivalent UI needs; no speculative personal or cross-site fields.
- Inputs are validated in callback/server code even when a JSON Schema declares constraints.
- External/user-generated outputs set `untrustedContentHint: true`.
- Names/descriptions/results contain no hidden instructions and stay within current client budgets.
- Results contain no credentials, private URLs, full documents/HTML, internal stack traces, or
  unrelated user data.
- Errors returned to shared evidence are categorized/redacted; detailed local errors are opt-in.

## Origin containment

- Verification runs in a secure context (HTTPS or actual loopback).
- `exposedTo` is absent unless each exact secure origin has explicit developer approval.
- Cross-origin frames require both `allow="tools"` and exact `exposedTo`; never use wildcard messaging.
- Pages that must never offer tools should send `Permissions-Policy: tools=()`.
- Third-party scripts, tag managers, and extension bridges cannot become authorization boundaries.

## Verification and telemetry

- Mutations run only against local/seeded preview data with cleanup and explicit runner flags.
- Untrusted fork pull requests receive no authenticated fixtures or repository secrets.
- Default reports/telemetry contain no prompts, inputs, outputs, DOM, credentials, user IDs, or raw
  error details.
- Public site IDs are treated as spoofable routing identifiers, never user/agent identity.
- Telemetry is disabled until explicitly configured and respects the product's consent/retention policy.

WebMCP and Siteverb cannot guarantee prompt-injection safety inside an agent, identify every caller,
or prove a description matches arbitrary callback behavior. State these residual risks plainly.
