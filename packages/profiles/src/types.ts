export type ClientFeature =
  | 'imperative-tools'
  | 'declarative-tools'
  | 'top-level-tools'
  | 'same-origin-iframe-tools'
  | 'cross-origin-iframe-tools'
  | 'dynamic-tools'
  | 'execution-cancellation';

export type EvidenceLevel =
  'real-client' | 'real-browser' | 'official-sdk' | 'documented-profile' | 'spec-only';

export interface FeatureSupport {
  readonly status: 'supported' | 'unsupported' | 'unknown';
  readonly evidence: EvidenceLevel;
  readonly source: string;
  readonly note?: string;
}

export interface ClientProfile {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly checkedAt: string;
  readonly features: Readonly<Record<ClientFeature, FeatureSupport>>;
}

export type CompatibilityFindingCode =
  | 'declarative-tools-unsupported'
  | 'imperative-tools-unsupported'
  | 'iframe-tools-unsupported'
  | 'support-unknown';

export interface CompatibilityFinding {
  readonly code: CompatibilityFindingCode;
  readonly evidence: EvidenceLevel;
  readonly message: string;
  readonly severity: 'error' | 'warning';
  readonly source: string;
  readonly toolId: string;
}

export interface CompatibilityAssessment {
  readonly profileId: string;
  readonly status: 'compatible' | 'incompatible' | 'unknown';
  readonly findings: readonly CompatibilityFinding[];
}
