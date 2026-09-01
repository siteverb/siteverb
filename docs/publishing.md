# Publishing Siteverb to npm

**Reviewed:** 2026-09-01

Siteverb publishes six real public packages under one npm organization scope. Do not publish empty
placeholder packages merely to reserve names.

## Reserve the namespace first

Sign in to npm with an account protected by two-factor authentication, then create the npm
organization `siteverb` on the free **Unlimited public packages** plan. The organization name is the
npm scope, so owning it reserves the entire `@siteverb/*` namespace from outsiders, including names
that have not been published yet.

This protects:

```text
@siteverb/contracts
@siteverb/webmcp
@siteverb/react
@siteverb/profiles
@siteverb/audit
@siteverb/runner
```

The unscoped package name `siteverb` is separate. Creating the organization does not reserve it.
Only publish that name after it contains a genuine umbrella CLI or other useful package; do not use
an empty squatting package.

## Prepare GitHub

1. Create the GitHub organization `siteverb` and public repository `siteverb/siteverb`.
2. Push the reviewed public repository without replacing its local history.
3. Create a protected GitHub environment named `npm`, preferably with a required reviewer.
4. Protect `main` and release tags and require CI and CodeQL.
5. Keep `.github/workflows/release.yml` on the default branch.

The public repository requirement matters because npm provenance is not generated from private
GitHub repositories.

## Bootstrap the first package records

npm configures trusted publishers from an existing package's settings, and staged publishing cannot
create a brand-new package. The safest bootstrap is therefore a real release candidate under the
`next` dist-tag, followed by an OIDC-published stable release.

Every workspace command must run from the Siteverb repository root. Verify that before doing
anything authenticated:

```sh
cd /path/to/siteverb
pwd
npm pkg get name
```

The last command must print `"siteverb"`. An `ENOWORKSPACES` or `ENOENT` error means the shell is in
the wrong directory; stop rather than retrying publication.

1. Prepare all six package manifests and internal `@siteverb/*` dependency ranges as
   `0.1.0-rc.0`.
2. Run the complete source, package, dependency, audit, and native-browser gates.
3. Review every tarball with `npm pack --dry-run --json --workspace <package>`.
4. Sign in locally and verify organization access:

```sh
npm login
npm whoami
npm org ls siteverb
```

Enter credentials and 2FA directly in the terminal. Never send them through chat.

5. Publish the real RC packages in dependency order, **one command at a time**:

```sh
npm publish --workspace @siteverb/contracts --access public --tag next --provenance=false
npm publish --workspace @siteverb/webmcp --access public --tag next --provenance=false
npm publish --workspace @siteverb/react --access public --tag next --provenance=false
npm publish --workspace @siteverb/profiles --access public --tag next --provenance=false
npm publish --workspace @siteverb/audit --access public --tag next --provenance=false
npm publish --workspace @siteverb/runner --access public --tag next --provenance=false
```

After each command succeeds, verify that exact version before moving to the next package:

```sh
npm view @siteverb/contracts@0.1.0-rc.0 name version dist-tags --json
```

Replace the package name for each subsequent check. Do not paste all six publish commands as one
batch; a partial release needs inspection before any retry.

The explicit `--access public` is required because scoped packages otherwise default to private.
The bootstrap disables provenance because it is an interactive local publish; the stable release
will carry GitHub/npm trusted-publishing provenance.

Do not run these commands while the manifests still say `0.1.0`. The RC must be a separate real
version so the stable `0.1.0` remains available to the OIDC workflow.

For the first version of a new package, npmjs.com creates `latest` even when the publish command
uses `--tag next`. The registry requires `latest` to remain resolvable and rejects attempts to
remove it with `400 Bad Request`. Do not retry that deletion or treat it as an OTP failure.

Until the stable release, both `next` and `latest` therefore point to `0.1.0-rc.0`. This temporarily
makes an unqualified install resolve the RC, but there is no valid empty-`latest` state to restore.
The published RC.0 packages and `v0.1.0-rc.0` tag are immutable; never move the tag or rebuild that
version.

## Configure trusted publishing

Open each package on npm, then **Settings → Trusted publishing → GitHub Actions**. Configure exactly:

| Field                       | Value         |
| --------------------------- | ------------- |
| GitHub organization or user | `siteverb`    |
| Repository                  | `siteverb`    |
| Workflow filename           | `release.yml` |
| Environment                 | `npm`         |
| Allowed action              | `npm publish` |

Enter only `release.yml`, not `.github/workflows/release.yml`. npm validates these case-sensitive
values only when a publish is attempted. Each package needs its own configuration and can have only
one trusted publisher.

## Prove OIDC with a release canary

Do not make stable `0.1.0` the first trusted-publishing attempt. Prepare `0.1.0-rc.1` from the
reviewed stable commit, update internal ranges and runtime version constants, and publish a GitHub
prerelease tagged exactly `v0.1.0-rc.1`. The release script sends prereleases to `next`, stable
versions to `latest`, and skips an exact package version only when its npm `gitHead` matches the
running GitHub commit. A partially completed six-package workflow can therefore be rerun safely.

Verify all six RC.1 package pages show GitHub provenance, `next` points to `0.1.0-rc.1`, and
`latest` remains at `0.1.0-rc.0`. This proves every trusted-publisher entry and the protected `npm`
environment before consuming the stable version.

## Publish stable 0.1.0

1. Restore the fixed release train to `0.1.0` and internal ranges to `^0.1.0`.
2. Run `npm run check`, `npm audit --audit-level=moderate`, and all three integration commands.
3. Commit and push the stable release state.
4. Create and publish a GitHub Release tagged exactly `v0.1.0`.
5. The protected workflow validates everything again and publishes all six packages in dependency
   order through npm OIDC with provenance.

After it succeeds, verify each package page, `latest` dist-tag, repository link, public visibility,
and provenance statement. Then, for every package, set **Publishing access** to **Require two-factor
authentication and disallow tokens**. Revoke any temporary publish token if one was ever created;
the documented bootstrap requires none.

## Important failure rules

- Never publish from an uncommitted or unreviewed tree.
- Never place an npm password, OTP, recovery code, or write token in chat, a file, or a command that
  will remain in shell history.
- Never reuse `0.1.0` after any package with that version has reached npm; npm versions are immutable.
- Never retry removing `latest` from a first-published package; npmjs.com requires that tag and
  returns `400 Bad Request` by design.
- Stop after any partial failure and inspect registry state before retrying. Do not blindly rerun the
  entire list because already-published versions will fail.
- Do not create the GitHub `v0.1.0` release until all six trusted-publisher entries are configured.

## Current source automation

`.github/workflows/release.yml` grants only `contents: read` and `id-token: write`, runs on a
GitHub-hosted runner, disables package-manager caching, validates the exact release tag, and invokes
`scripts/release-packages.mjs`. The script refuses local publication, selects `next` or `latest`
from the package version, and publishes the six-package train only from a tagged GitHub Actions
release.
