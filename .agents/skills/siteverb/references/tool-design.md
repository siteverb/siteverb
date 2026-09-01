# Tool design

## Start from tasks

Choose tools that help a visitor complete a real journey. A good boundary reuses one meaningful
application action. Avoid one tool per endpoint, button, DOM selector, or database entity.

Prefer:

- Search or filter through the app's actual query path.
- Read current user-visible state.
- Prepare a reversible draft, cart, form, or checkout handoff.
- Apply an edit the user can review or undo.

Avoid:

- Generic `click`, `navigate`, `fetch`, or arbitrary-code tools.
- Server-only functions imported into browser bundles.
- Raw API proxies with no user-journey semantics.
- Large page/document dumps.
- Direct purchase, deletion, account closure, public posting, or subscription change.

## Risk

| Risk            | Meaning                                                  | Required shape                                                            |
| --------------- | -------------------------------------------------------- | ------------------------------------------------------------------------- |
| `read-only`     | Reads data or changes only a temporary view              | `readOnlyHint: true`                                                      |
| `reversible`    | Changes persisted state that the user can undo           | `readOnlyHint` absent/false; seeded cleanup for tests                     |
| `consequential` | Irreversible, costly, public, or externally communicated | Stop at a reversible handoff or require explicit approval before the tool |

Use `untrustedContentHint: true` whenever output includes user-generated, third-party, retrieved, or
otherwise untrusted text.

## Names and descriptions

- Stable ID: lowercase dot namespace, such as `cart.add-item`; author once and preserve forever.
- Wire name: action-oriented and valid under `[A-Za-z0-9_.-]{1,128}`.
- Aim for 30 characters or fewer for names.
- Aim for 500 characters or fewer for tool descriptions.
- Aim for 150 characters or fewer for parameter descriptions.
- Keep individual outputs near 1,500 characters unless evidence supports more.

Descriptions say what the capability does, when to use it, and material consequences. They do not
contain system instructions, hidden policy, marketing language, or unrelated workflow recipes.

## Results and errors

Return the smallest structured result needed for the next decision. Include stable domain IDs only
when they are already safe for the user to see. Do not include credentials, authorization headers,
internal stack traces, full HTML, or secrets.

Throw when execution fails or a required anchor is missing. A read with no matches should return an
explicit empty result, not throw. A state-changing callback must not return success before the
application confirms the state transition.
