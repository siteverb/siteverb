# @siteverb/runner

Deterministic real-browser execution for `siteverb.webmcp.json` contracts.

```sh
npx @siteverb/runner \
  --contract siteverb.webmcp.json \
  --url http://127.0.0.1:3000 \
  --output .siteverb/report.json
```

The runner launches a named Chrome channel with WebMCP enabled, opens a fresh page for each journey,
refreshes the native tool inventory before every step, executes through Puppeteer's official
`page.webmcp` API, checks bounded result/URL/DOM postconditions, attempts cleanup, and writes a
versioned evidence report.

Targets must be absolute HTTP(S) URLs. Per-navigation, tool, and postcondition timeouts are bounded
to 1-600,000 milliseconds and validated with journey/profile filters before browser acquisition.

Journey steps fail fast. Cleanup is best-effort: every declared cleanup step is attempted even when
an earlier one fails, and any cleanup failure still fails the journey.

Add `--profile chatgpt-site-tools-2026-08-26` to include a dated documented compatibility
assessment. This never upgrades documented behavior to real-client evidence.

Mutating tools do not run unless `--allow-mutations` is present. A stable tool ID listed in a
journey's `requireHumanBefore` policy also requires `--approve <stable-id>`. Use these flags only
against an explicitly approved local, preview, or seeded test target.

The default report excludes prompts, inputs, tool outputs, DOM snapshots, cookies, and credentials.
It records browser provenance, step status, duration, and Siteverb-generated failure categories.
The persisted target is reduced to its origin; path, query, fragment, and URL credentials are omitted.
`--include-error-details` opts a local run into bounded page-provided error messages; do not use it
for shared CI artifacts unless those messages are independently redacted.
