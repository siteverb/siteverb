# Siteverb brand

## Position

**Name:** Siteverb  
**Product shorthand:** Create. Prove. Improve.  
**Category:** WebMCP release infrastructure  
**One-line description:** Create, test, and ship reliable WebMCP journeys with customer-owned tools,
contracts, and CI.

Use `Siteverb` in prose and `siteverb` for the GitHub organization, repositories, package scope,
commands, and resource prefixes. Do not describe Siteverb as the WebMCP standard, a browser, an AI
agent, or a security guarantee.

## Visual system

The mark combines a browser frame with a connected action path. It should remain legible as a small
organization avatar.

| Token    | Hex       | Use                               |
| -------- | --------- | --------------------------------- |
| Ink      | `#10161B` | Primary text and mark             |
| Paper    | `#F4F7F2` | Background                        |
| Signal   | `#22B573` | Passing/active state              |
| Action   | `#FF6854` | Invocation and emphasis           |
| Evidence | `#F5C84C` | Warnings and provisional evidence |
| Muted    | `#56616A` | Supporting text                   |

Assets:

- `brand/siteverb-mark.svg`: vector avatar source.
- `brand/siteverb-avatar.png`: 512 x 512 GitHub/npm avatar.
- `brand/siteverb-wordmark.svg`: horizontal wordmark.
- `brand/siteverb-social-preview.png`: 1280 x 640 GitHub social preview.

Regenerate PNG assets with `npm run brand:render`. Do not stretch, recolor into a one-hue palette,
add gradients, or place the mark over busy imagery.

## Voice

Be direct, technical, and evidence-specific. Prefer “Chrome 152 real-browser pass” over “works
everywhere.” Prefer “associated with” over causal attribution. Never imply that registration is an
authorization boundary or that callback completion proves conversion.

## GitHub organization

Create the organization under the personal account until a legal entity exists.

- **Organization URL:** `github.com/siteverb`
- **Display name:** `Siteverb`
- **Bio:** `Open-source release infrastructure for reliable WebMCP journeys.`
- **Website:** Leave empty until a Siteverb-controlled domain is secured and live.
- **Contact email:** Use a dedicated organization alias when available; keep it private initially.
- **Avatar:** Upload `brand/siteverb-avatar.png`.

Create the public repository as `siteverb/siteverb` with this description:

> Create, test, and ship reliable WebMCP journeys with customer-owned tools, contracts, and CI.

Repository topics:

```text
webmcp browser-agents ai-agents testing github-actions typescript puppeteer developer-tools
```

Upload `brand/siteverb-social-preview.png` under repository **Settings → General → Social preview**.
Do not initialize the remote with a README, license, or `.gitignore`; the local repository already
owns them.

## Repository settings

After the first push:

1. Set `main` as the default branch.
2. Require the `check` and `analyze (javascript-typescript)` status checks.
3. Require one approving review once a second maintainer exists; until then require conversation
   resolution and disallow force pushes/deletions.
4. Enable Dependabot alerts/updates, secret scanning, push protection, CodeQL default setup or the
   committed workflow, and private vulnerability reporting.
5. Disable wiki and Projects until there is an operating need; keep Issues and Discussions only if
   they will be actively triaged.
6. Use squash merge with conventional, user-readable titles; delete head branches after merge.

## npm scope and trusted publishing

Create the npm organization/scope `@siteverb`. The public fixed release train contains:

```text
@siteverb/contracts
@siteverb/webmcp
@siteverb/react
@siteverb/profiles
@siteverb/audit
@siteverb/runner
```

Creating the npm organization reserves the full `@siteverb/*` scope; empty placeholder packages are
neither needed nor appropriate. Bootstrap each real package with a `0.1.0-rc.0` release under the
`next` dist-tag, then configure npm Trusted Publishing with GitHub organization `siteverb`,
repository `siteverb`, workflow filename `release.yml` (filename only), GitHub environment `npm`, and
allowed action `npm publish`. Protect that environment and do not add a long-lived `NPM_TOKEN`.

The unscoped `siteverb` package is separate from the organization scope. Publish it only if Siteverb
ships a genuine umbrella CLI or package under that name. See [the npm publishing runbook](docs/publishing.md).

Create a GitHub Release tagged exactly `v0.1.0` only after all repository and native-browser checks
pass. The workflow verifies the fixed package train and publishes in dependency order with npm
provenance.

## Legal boundary

No trademark or domain clearance has been completed. Search relevant software classes and major
markets before paid launch. The Apache-2.0 code license does not grant rights to Siteverb trademarks
or brand assets beyond customary attribution and product identification.
