# @siteverb/audit

Static source-to-contract coverage for Siteverb WebMCP projects.

```sh
npx @siteverb/audit --root . --contract siteverb.webmcp.json --output .siteverb/audit.json
```

The audit uses Babel's TypeScript parser for JavaScript/TypeScript/JSX/TSX and executable scripts in
HTML, Vue, and Svelte files. `parse5` extracts declarative forms without regular expressions. It
understands definitions, inline client registrations, static batches, and local static factories.

It blocks raw `document.modelContext.registerTool` calls, state-changing declarative autosubmit,
unsafe cross-origin exposure, duplicate stable IDs or wire names, contract/source drift, and missing
contract entries. Dynamic `exposedTo` policy and known third-party registration runtimes require
review; third-party runtimes become errors under `--strict-external`.

Static coverage does not prove runtime behavior. Pair this audit with `@siteverb/runner` in the
customer-owned GitHub Action.
