# @siteverb/profiles

Versioned WebMCP client capability profiles with evidence attached to each feature.

```ts
import { assessCompatibility, chatGptSiteToolsProfile } from '@siteverb/profiles';

const assessment = assessCompatibility(contract, chatGptSiteToolsProfile);
```

Profiles never pretend documented behavior is real-client execution. Each capability records its
status, evidence level, source, and check date. A contract assessment can be `compatible`,
`incompatible`, or `unknown`.

The profiles cover locally verified Chrome 151 and Chrome 152 imperative surfaces, the documented
Edge 150 origin trial, and the dated ChatGPT Site Tools subset. Add a new exact profile when browser
evidence changes; do not silently mutate an old profile's meaning.

Bounded native reports for the real-browser profiles ship at
`@siteverb/profiles/evidence/chrome-151-native.json` and
`@siteverb/profiles/evidence/chrome-152-native.json`. They contain fixture status and browser
provenance, not tool inputs, outputs, DOM, credentials, or raw target URLs.
