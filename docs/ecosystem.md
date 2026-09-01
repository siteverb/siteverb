# WebMCP conversion ecosystem

**Research cutoff:** 2026-09-01

The creation layer is active and increasingly commoditized. Siteverb should interoperate with these
projects and own the contract-to-release-to-production lifecycle rather than pretending generation
is scarce.

| Project                             | What it does                                                                                                          | Strong pattern to reuse                                                                                                                           | Boundary or gap                                                                                                            |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Google WebMCP Studio                | Browses public sites with Gemini/Antigravity, proposes imperative/declarative code, writes IDE files and eval prompts | Live-site discovery, category/persona scoping, generated evals                                                                                    | Authenticated sites unsupported; generated output still needs source/auth review and durable release evidence              |
| Google `webmcp-evals`               | Static/model evals plus deterministic native-browser smoke                                                            | Separate deterministic smoke from probabilistic selection; refresh dynamic tools per step                                                         | Experimental runner, not a project contract, source audit, release gate, or privacy-bounded production layer               |
| WebMCP Model Context Tool Inspector | DevTools/extension inspection and manual calls                                                                        | Fast human review of live metadata and execution                                                                                                  | Manual point-in-time debugging, not retained CI/history                                                                    |
| webmcpify                           | Resumable agent skill from detect/inventory through approval, integration, verification, healing, and audit           | Secure-context/CORS gate, curated/parity coverage, per-area state, dirty-file protection, role fixtures, bounded healing, deep security checklist | Vendors its own runtime and centers one conversion; no neutral release/production lifecycle                                |
| Nekuda WebMCP Kit                   | Local coding-agent plugin with visual proposal/approval and SDK-backed implementation                                 | Journey-first plan, explicit approval, exact source paths, browser verification                                                                   | Tied to Nekuda SDK/control plane; direct commercial competitor for creation/management                                     |
| Latch                               | One script heuristically finds search, cart, forms, and navigation from the DOM                                       | Zero-friction inspection, graceful no-op, native event/form reuse                                                                                 | Generic heuristics can misclassify signup, buy-now, or ambiguous forms and cannot prove server authorization/source intent |
| MCP-B                               | Strict polyfill, types, React hooks, iframe/tab/extension transports, local MCP relay                                 | Conformance suites, origin validation, transport layering, runtime cleanup                                                                        | Owns compatibility/transport, not Siteverb's release and outcome evidence; do not rebuild it                               |
| `usewebmcp`                         | Lightweight React hook for strict native tools                                                                        | Committed callback refs, Strict Mode lifecycle, schema inference                                                                                  | Tool registration only; no stable lineage, contract, audit, runner, or production diagnosis                                |
| Sodium                              | Hosted repository analysis, managed loader/manifest, updates, and basic analytics                                     | Simple onboarding, signed versions, drift drafts                                                                                                  | Hosted mutable page runtime and bounded handlers; generation/analytics claims need independent evidence                    |
| Nekuda WindTunnel                   | Reproducible interface benchmark across WebMCP and browser automation                                                 | Outcome scoring, repeated attempts, public transcripts/data                                                                                       | Participant-authored benchmark; not customer release infrastructure                                                        |

## Siteverb decision

Siteverb's free skill may learn from the strongest conversion disciplines, but its durable object is
`siteverb.webmcp.json`: stable tool identity, risk, ownership, complete tasks, deterministic
postconditions, cleanup, and evidence. The public Action proves source ownership plus real-browser
behavior; the future cloud connects that same contract to releases and production outcomes.

Do not build another polyfill, transport, browser extension, generic DOM auto-clicker, MCP relay,
directory, or model-eval engine. Import or adapt their public interfaces where the license and
stability permit; keep evidence provenance explicit.

## Sources

- https://github.com/GoogleChromeLabs/webmcp-tools
- https://github.com/TueJon/webmcpify
- https://github.com/nekuda-ai/webmcp-kit
- https://github.com/r0bertini/latch
- https://github.com/WebMCP-org/npm-packages
- https://github.com/nekuda-ai/WindTunnel
- https://sodium.result.dev/
