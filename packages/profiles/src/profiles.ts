import type { ClientFeature, ClientProfile, EvidenceLevel, FeatureSupport } from './types.js';

const CHROME_DOCS = 'https://developer.chrome.com/docs/ai/webmcp/imperative-api';
const OPENAI_DOCS = 'https://learn.chatgpt.com/docs/webmcp';
const IMPLEMENTATION_STATUS =
  'https://github.com/webmachinelearning/webmcp/blob/main/implementation-status.md';

function support(
  status: FeatureSupport['status'],
  evidence: EvidenceLevel,
  source: string,
  note?: string,
): FeatureSupport {
  return Object.freeze({ status, evidence, source, ...(note === undefined ? {} : { note }) });
}

function profile(
  value: Omit<ClientProfile, 'features'> & {
    features: Record<ClientFeature, FeatureSupport>;
  },
): ClientProfile {
  return Object.freeze({ ...value, features: Object.freeze(value.features) });
}

export const chrome151Profile = profile({
  id: 'chrome-151-native',
  name: 'Chrome native WebMCP',
  version: '151.0.7922.175',
  checkedAt: '2026-09-01',
  features: {
    'imperative-tools': support(
      'supported',
      'real-browser',
      CHROME_DOCS,
      'Verified by Siteverb native discovery and execution fixture.',
    ),
    'declarative-tools': support('supported', 'documented-profile', CHROME_DOCS),
    'top-level-tools': support('supported', 'real-browser', CHROME_DOCS),
    'same-origin-iframe-tools': support('supported', 'documented-profile', CHROME_DOCS),
    'cross-origin-iframe-tools': support('supported', 'documented-profile', CHROME_DOCS),
    'dynamic-tools': support('supported', 'documented-profile', CHROME_DOCS),
    'execution-cancellation': support('supported', 'documented-profile', CHROME_DOCS),
  },
});

export const chrome152Profile = profile({
  id: 'chrome-152-native',
  name: 'Chrome native WebMCP',
  version: '152.0.7977.65',
  checkedAt: '2026-09-01',
  features: {
    'imperative-tools': support(
      'supported',
      'real-browser',
      CHROME_DOCS,
      'Verified by Siteverb native discovery and execution fixture.',
    ),
    'declarative-tools': support('supported', 'documented-profile', CHROME_DOCS),
    'top-level-tools': support('supported', 'real-browser', CHROME_DOCS),
    'same-origin-iframe-tools': support('supported', 'documented-profile', CHROME_DOCS),
    'cross-origin-iframe-tools': support('supported', 'documented-profile', CHROME_DOCS),
    'dynamic-tools': support('supported', 'documented-profile', CHROME_DOCS),
    'execution-cancellation': support('supported', 'documented-profile', CHROME_DOCS),
  },
});

export const edge150Profile = profile({
  id: 'edge-150-origin-trial',
  name: 'Microsoft Edge WebMCP origin trial',
  version: '150',
  checkedAt: '2026-08-31',
  features: {
    'imperative-tools': support('supported', 'documented-profile', IMPLEMENTATION_STATUS),
    'declarative-tools': support('supported', 'documented-profile', IMPLEMENTATION_STATUS),
    'top-level-tools': support('supported', 'documented-profile', IMPLEMENTATION_STATUS),
    'same-origin-iframe-tools': support('unknown', 'documented-profile', IMPLEMENTATION_STATUS),
    'cross-origin-iframe-tools': support('unknown', 'documented-profile', IMPLEMENTATION_STATUS),
    'dynamic-tools': support('supported', 'documented-profile', IMPLEMENTATION_STATUS),
    'execution-cancellation': support('unknown', 'documented-profile', IMPLEMENTATION_STATUS),
  },
});

export const chatGptSiteToolsProfile = profile({
  id: 'chatgpt-site-tools-2026-08-26',
  name: 'ChatGPT Site Tools',
  version: '2026-08-26',
  checkedAt: '2026-08-31',
  features: {
    'imperative-tools': support('supported', 'documented-profile', OPENAI_DOCS),
    'declarative-tools': support('unsupported', 'documented-profile', OPENAI_DOCS),
    'top-level-tools': support('supported', 'documented-profile', OPENAI_DOCS),
    'same-origin-iframe-tools': support('unsupported', 'documented-profile', OPENAI_DOCS),
    'cross-origin-iframe-tools': support('unsupported', 'documented-profile', OPENAI_DOCS),
    'dynamic-tools': support('unknown', 'documented-profile', OPENAI_DOCS),
    'execution-cancellation': support('unknown', 'documented-profile', OPENAI_DOCS),
  },
});

export const clientProfiles = Object.freeze([
  chrome152Profile,
  chrome151Profile,
  edge150Profile,
  chatGptSiteToolsProfile,
]);

export function getClientProfile(id: string): ClientProfile | undefined {
  return clientProfiles.find((candidate) => candidate.id === id);
}
