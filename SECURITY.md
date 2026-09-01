# Security

Report suspected vulnerabilities privately through GitHub Security Advisories for the Siteverb
repository. Do not include credentials, production prompts, tool arguments, tool results, or user
data in a public issue.

`@siteverb/webmcp` treats WebMCP registration as capability discovery, not authorization. Sites must
enforce authentication, authorization, input validation, confirmation, and business invariants in
the underlying action independently of this SDK.

Production telemetry is metadata-only by contract. Shared reports that show prompts, arguments,
results, DOM content, credentials, raw URLs, user identifiers, or page-provided error details are
treated as security issues. Runner reports redact those details by default; the explicit
`--include-error-details` option is for controlled local debugging and shifts redaction and artifact
handling responsibility to the operator.

The complete producer threat model, release checklist, and residual-risk statement are in
[`docs/security-model.md`](docs/security-model.md).
