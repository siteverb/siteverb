# Existing WebMCP migration

Migrate one ownership boundary at a time and verify no duplicate registration exists.

## Raw `document.modelContext.registerTool`

1. Move the definition into a side-effect-free module using `defineTool`.
2. Add a durable `id` independent of the wire `name`.
3. Preserve title, description, input schema, annotations, callback return, thrown errors, and
   callback cancellation behavior.
4. Register through one `createSiteverb()` client in the same lifecycle scope.
5. Remove the old native registration only after the replacement passes locally.

Do not monkey-patch `registerTool`; already-registered callbacks cannot be recovered reliably.

## `@nekuda/webmcp-sdk` or legacy AgentLane aliases

Map `stableKey` to Siteverb `id` verbatim. Preserve `name`, metadata, callback, registration scope,
and unregistration. Replace the SDK import and registrar only after all definitions have stable
identity. Do not create new IDs for unchanged capabilities.

If the project intentionally uses Nekuda's hosted services, ask whether migration or coexistence is
desired. Siteverb can test standards-compliant tools without replacing their runtime; full Siteverb
invocation telemetry requires Siteverb to own the callback wrapper.

## MCP-B and polyfills

Preserve explicit MCP-B/polyfill initialization. Siteverb registers against the resulting standard
`document.modelContext` surface and does not replace transports, iframe bridges, prompts, resources,
or backend MCP behavior. Migrate only strict-core tool registrations unless the developer explicitly
requests a broader architecture change.

## React `usewebmcp` and similar hooks

Preserve the hook's committed-state/ref semantics when converting. Create a Siteverb registrar tied
to the same component lifecycle. A callback that depends on current component state must read a
committed ref rather than a value captured at first registration.

If telemetry is not needed, coexistence may be safer than replacement. Record externally registered
tools as inventory-only and keep the evidence label honest.

## Declarative WebMCP forms

Do not rewrite a functioning declarative form solely for instrumentation. Keep it declarative and
test it in supported clients. Convert to an imperative Siteverb tool only when the app already has a
safe browser callback and the customer explicitly values callback-level telemetry or unsupported
client compatibility.

## Hosted manifest loaders

A third-party hosted manifest or loader cannot be safely transformed from source alone. Inventory
the observed tools, export the customer-owned requirements, and recreate only capabilities whose
real application wiring the developer approves. Never silently remove another vendor's loader.
