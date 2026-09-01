# Siteverb GitHub Action

Run deterministic WebMCP journeys on the repository's own GitHub runner.

```yaml
- uses: siteverb/siteverb/actions/siteverb@v0.1.0
  with:
    url: http://127.0.0.1:3000
    contract: siteverb.webmcp.json
```

The target application must already be running. The Action installs exact `@siteverb/audit` and
`@siteverb/runner` versions, checks source-to-contract ownership, launches the installed Chrome
channel, writes one job summary, uploads both bounded reports, and preserves the first failing
conclusion.

The composite Action pins every executable third-party Action to an immutable commit SHA. When
static audit is disabled, it uploads only the journey report so a stale audit file cannot enter the
artifact.

For state-changing tests, use a seeded preview environment and opt in explicitly:

```yaml
with:
  allow-mutations: 'true'
  approved-tools: cart.prepare-checkout
```

Never enable mutations against a production URL. The Action does not upload repository code,
browser storage, tool inputs, tool outputs, DOM snapshots, or credentials to Siteverb.
