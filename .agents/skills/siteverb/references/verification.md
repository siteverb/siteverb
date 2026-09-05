# Verification ladder

## Static

1. Run the repository's existing lint/typecheck/tests.
2. Confirm every approved stable ID appears once in source and once in the contract.
3. Search for new raw `document.modelContext.registerTool` calls outside approved compatibility code.
4. Confirm browser modules import no server secrets or server-only packages.
5. Run the production build.

## Browser

Start the application with its own documented command. Use a named Chrome build with WebMCP enabled.

For each route/auth state:

1. Load once and record new console/network failures.
2. List tools and confirm expected presence and forbidden absence.
3. Invoke every read-only example.
4. Verify returned value and visible application postcondition.
5. Change route/state and confirm dynamic tools disappear or appear correctly.

Mutations run only on local or seeded preview data with explicit approval. Verify the state change,
then execute and verify cleanup.

## Siteverb runner

```sh
npx --yes @siteverb/runner@0.1.1 \
  --contract siteverb.webmcp.json \
  --url http://127.0.0.1:3000 \
  --output .siteverb/report.json \
  --chrome-channel chrome
```

Add `--allow-mutations` only for an approved test target. Add
`--approve cart.prepare-checkout` only when that guarded step was explicitly approved.

The runner opens a fresh page per journey and refreshes the tool inventory before every step. This
is required for state-dependent tool surfaces.

## Evidence states

- `verified`: discovered and safely invoked as declared; all configured postconditions passed.
- `failed`: registration, execution, or postcondition failed; fix or remove before shipping.
- `could-not-verify`: no supported browser, local app, auth fixture, or safe mutation path; keep the
  limitation explicit.

Documented client profiles are not real-client execution. Never relabel a documented profile as a
browser or client pass.
