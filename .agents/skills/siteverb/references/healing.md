# Bounded failure healing

Classify before changing code:

| Class                | Typical evidence                                            | Repair boundary                                           |
| -------------------- | ----------------------------------------------------------- | --------------------------------------------------------- |
| Contract             | Source/contract name, schema, risk, or postcondition differ | Return semantic change to approval; never silently revise |
| Implementation       | Callback throws, stale state, missing visible effect        | Fix the smallest owning callback/data path                |
| Environment          | App, secure context, Chrome, backend, or CORS unavailable   | Fix/record environment; do not rewrite tools              |
| Authorization        | 401/403 or wrong role/tenant surface                        | Correct fixture or registration scope; never bypass auth  |
| Client compatibility | Feature unsupported by the named client profile             | Change support claim or implementation mode               |
| Flake                | Same contract alternates pass/fail                          | Isolate state/timing; repeat before accepting a fix       |
| Capacity             | Too many/overlapping tools degrade selection                | Reduce/route-scope tools and measure again                |

Use a signature containing class, tool stable ID, contract revision, browser/client version, and
normalized failure category. Allow at most three independent attempts per signature. Reset the count
only after an approved contract revision or materially changed environment.

For each attempt:

1. Reproduce with the narrowest deterministic check.
2. Change one owning slice.
3. Rerun the identical check.
4. If it passes, rerun every journey/tool sharing that source or registration scope.
5. Persist evidence and attempt count.

Never remove cleanup, weaken a postcondition, increase timeouts without evidence, swallow callback
errors, mark a failure as unsupported, or widen source changes just to turn the report green.
