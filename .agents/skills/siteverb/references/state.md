# Resumable migration state

Use `.siteverb/migration.json` after the developer explicitly approves the inventory scope,
`curated` or `parity` coverage, and the local state write. This approval does not authorize product
edits. Do not create state during `status`, or during `inventory` unless persistence was requested.

Confirm `.siteverb/` is ignored before writing. If it is not, ask before adding that exact ignore
entry; otherwise keep the session read-only. Never accidentally stage migration state, reports, or
authenticated fixture material.

## Phases

```text
inventory -> approval -> implementation -> verification -> healing -> audit -> complete
```

Transition only when:

- `inventory -> approval`: every mapped area is inventoried and exclusions have reasons.
- `approval -> implementation`: every proposal is approved or rejected; rejected is terminal.
- `implementation -> verification`: every approved batch builds and appears in the contract.
- `verification -> healing`: all integrated tools were visited and at least one failed.
- `verification -> audit`: every integrated tool passed or has a could-not-verify blocker.
- `healing -> audit`: no failed tool remains and all affected journeys were rerun.
- `audit -> complete`: source audit, native journey report, security checklist, and final summary exist.

## Minimum state

- Baseline Git SHA and pre-existing dirty paths.
- Coverage mode and scoped routes/areas.
- Observed start command, verification origin, secure-context result, backend/CORS assumptions.
- Auth fixture IDs, acquisition procedure, and environment-variable names only.
- Per-area status and exclusions.
- Per-tool stable ID, source path, risk, approval, contract revision, status, and failure signature.
- Blockers and chronological decision log.

Tool statuses are `proposed`, `approved`, `rejected`, `implemented`, `verified`, `failed`, or
`could-not-verify`. Do not infer completion from file existence.

## Atomic persistence

Write the complete next state to `.siteverb/migration.json.tmp`, fsync/close where the environment
allows, then rename it over `.siteverb/migration.json`. Never partially append JSON. If a stale
temporary file exists, validate both files and keep the newest complete state; do not guess.

## Invalidation

Reopen an area/tool when its route, auth boundary, implementation source, approved description,
schema, risk, or postcondition changed. Increment `contractRevision`, clear verification evidence,
and show the developer what was invalidated. A model/context reset is not permission to reuse stale
approval.

## Dirty worktree protection

Files dirty at baseline are read-only for the skill. If an approved tool requires one, ask the
developer to commit/stash it or explicitly authorize that exact path. Never use reset, checkout,
clean, or broad formatting to manufacture a clean baseline.

If the repository has no commit yet, record `baseline.sha` as `null`, mark every existing path as
dirty, and explain that only path-based protection is available until the first commit.
