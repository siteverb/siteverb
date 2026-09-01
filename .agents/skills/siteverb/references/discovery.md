# Repository discovery

Use the cheapest evidence first and stop once the browser ownership path is clear.

## Stack evidence

Read manifests and lockfiles before application code:

| Evidence                         | Likely shape                                                 |
| -------------------------------- | ------------------------------------------------------------ |
| `next` dependency, `app/`        | Next.js App Router; registrations require a client component |
| `react` + `vite`                 | React SPA; mount one registrar near the application root     |
| `vue`                            | Vue app; use `onMounted`/`onUnmounted`                       |
| `svelte` or `@sveltejs/kit`      | Svelte lifecycle; browser-only registration                  |
| `@angular/core`                  | Angular service/component lifecycle; never execute in SSR    |
| HTML/templates without a bundler | Static/MPA; use a vendored pinned browser bundle             |

Honor the repository's package manager and commands. Do not replace its framework, router, state
library, test system, or package manager to add WebMCP.

## High-signal surfaces

Read, in order:

1. Root README and project instructions.
2. Shared layout/application entry.
3. Route definitions and navigation.
4. Forms and visible calls to action.
5. Client API/data modules and state stores.
6. Server routes called by the browser.
7. Auth middleware and role checks.
8. Existing browser/integration tests.

For every candidate action, identify the browser-reachable implementation and the server-side
authorization check. A hidden button, client-side role check, or unlinked server function is not an
authorization boundary.

## Existing WebMCP inventory

Search for:

```text
document.modelContext
navigator.modelContext
registerTool
defineTool
registerTools
toolname
tooldescription
@siteverb/webmcp
@nekuda/webmcp-sdk
@agentlane/webmcp
@mcp-b/
usewebmcp
useWebMCP
```

Record the current source module, lifecycle owner, route/state scope, name, stable key, schema,
annotations, callback, and cleanup. Preserve durable identity. Do not register a second copy of an
existing capability while migrating it.

## Candidate confidence

- `decided`: a high-value user journey and browser implementation are both directly evidenced.
- `needs input`: the journey is useful but semantics, risk, owner, or wiring remains ambiguous.
- `not safe to expose`: server authorization is absent, behavior is irreversible without a handoff,
  or only a server-secret implementation exists.

No category match is a valid outcome. Explain it rather than generating generic search/navigation
tools that do not serve the application.
