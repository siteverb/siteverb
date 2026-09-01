# Contributing

Use Node.js `24.18.0` and npm `11.16.0` for the verified development environment.

```sh
nvm use
npm ci
npm run check
npm run test:integration:webmcp
npm run test:integration:runner
npm run test:integration:react
```

The integration test requires stable Google Chrome with native WebMCP support. Unit tests use the
explicit `@siteverb/webmcp/testing` memory adapter and are not browser evidence.

Keep the public runtime native-first and dependency-free. Polyfills, browser transports, model
backends, the hosted collector, and the GitHub App belong outside `@siteverb/webmcp`.

Every behavior change needs a focused test. Changes to browser compatibility must name the exact
browser build and evidence level used for validation.
