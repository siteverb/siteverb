# Siteverb repository instructions

- Keep this repository limited to portable, open-source WebMCP tooling. Hosted API, dashboard,
  ingestion, billing, and GitHub App orchestration belong in `siteverb-cloud`.
- Preserve the dependency direction: contracts -> profiles/audit/runner; webmcp -> react; the
  browser SDK never depends on Node-only packages.
- Use stable lowercase `domain.action` IDs independently from WebMCP wire names.
- Treat registration as discovery, never authorization. Mutations require explicit test-target opt-in
  and consequential steps require approval.
- Keep default telemetry and reports free of prompts, arguments, results, DOM, credentials, URLs,
  user identifiers, and error details that can contain customer data.
- Deterministic tests decide release status. Model-backed evals are separate evidence.
- Name exact browser/client versions and evidence levels for compatibility claims.
- Run `npm run check` after package changes and the relevant native integration command after WebMCP
  behavior changes.
