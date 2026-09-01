# @siteverb/contracts

Portable, versioned JSON contracts shared by the Siteverb installer skill, deterministic runner,
GitHub Action, and future hosted control plane.

## Project contract

```ts
import { parseProjectContract } from '@siteverb/contracts';

const contract = parseProjectContract(JSON.parse(source));
```

The package also publishes `@siteverb/contracts/siteverb.webmcp.schema.json` for editors and
non-TypeScript consumers. A contract defines stable tool identities, wire names, risk, examples,
deterministic journeys, postconditions, cleanup, ownership, and evidence-labeled support profiles.

Unknown fields fail validation. Tool and journey references are checked after parsing. Read-only
annotations must agree with declared risk.

## Evidence report

`parseRunReport()` validates the bounded report emitted by `@siteverb/runner`. Reports contain
browser provenance, step status, duration, and bounded errors. Raw prompts, tool inputs, tool
results, DOM snapshots, cookies, and credentials are not part of the default report contract.
