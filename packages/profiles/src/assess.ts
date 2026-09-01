import type { ProjectContract, ToolContract } from '@siteverb/contracts';
import type {
  ClientFeature,
  ClientProfile,
  CompatibilityAssessment,
  CompatibilityFinding,
  CompatibilityFindingCode,
  FeatureSupport,
} from './types.js';

function requiredFeatures(tool: ToolContract): ClientFeature[] {
  const features: ClientFeature[] = [
    tool.registration === 'imperative' ? 'imperative-tools' : 'declarative-tools',
  ];
  if (tool.frame === 'top-level') features.push('top-level-tools');
  if (tool.frame === 'same-origin-iframe') features.push('same-origin-iframe-tools');
  if (tool.frame === 'cross-origin-iframe') features.push('cross-origin-iframe-tools');
  return features;
}

function finding(
  tool: ToolContract,
  feature: ClientFeature,
  support: FeatureSupport,
): CompatibilityFinding {
  const unknown = support.status === 'unknown';
  let code: CompatibilityFindingCode = 'support-unknown';
  if (!unknown && feature === 'declarative-tools') code = 'declarative-tools-unsupported';
  else if (!unknown && feature === 'imperative-tools') code = 'imperative-tools-unsupported';
  else if (!unknown && feature.includes('iframe')) code = 'iframe-tools-unsupported';
  return {
    code,
    evidence: support.evidence,
    message: unknown
      ? `${feature} support is not verified for this profile.`
      : `${feature} is unsupported by this profile.`,
    severity: unknown ? 'warning' : 'error',
    source: support.source,
    toolId: tool.id,
  };
}

export function assessCompatibility(
  contract: ProjectContract,
  profile: ClientProfile,
): CompatibilityAssessment {
  const findings = contract.tools.flatMap((tool) =>
    requiredFeatures(tool)
      .map((feature) => [feature, profile.features[feature]] as const)
      .filter(([, support]) => support.status !== 'supported')
      .map(([feature, support]) => finding(tool, feature, support)),
  );
  return Object.freeze({
    profileId: profile.id,
    status: findings.some((entry) => entry.severity === 'error')
      ? 'incompatible'
      : findings.length > 0
        ? 'unknown'
        : 'compatible',
    findings: Object.freeze(findings),
  });
}
