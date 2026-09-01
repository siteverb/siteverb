import type { z } from 'zod';
import {
  compatibilityAssessmentSchema,
  compatibilityFindingSchema,
  domExpectationSchema,
  journeyContractSchema,
  journeyReportSchema,
  journeyStepSchema,
  projectContractSchema,
  resultExpectationSchema,
  runReportSchema,
  stepExpectationSchema,
  stepReportSchema,
  toolContractSchema,
  urlExpectationSchema,
} from './schema.js';

export {
  compatibilityAssessmentSchema,
  compatibilityFindingSchema,
  domExpectationSchema,
  evidenceLevelSchema,
  journeyContractSchema,
  journeyReportSchema,
  journeyStepSchema,
  jsonValueSchema,
  projectContractJsonSchema,
  projectContractSchema,
  resultExpectationSchema,
  runReportJsonSchema,
  runReportSchema,
  stepExpectationSchema,
  stepReportSchema,
  supportProfileSchema,
  toolAnnotationsSchema,
  toolContractSchema,
  toolExampleSchema,
  urlExpectationSchema,
} from './schema.js';

export type ProjectContract = z.infer<typeof projectContractSchema>;
export type ToolContract = z.infer<typeof toolContractSchema>;
export type JourneyContract = z.infer<typeof journeyContractSchema>;
export type JourneyStep = z.infer<typeof journeyStepSchema>;
export type StepExpectation = z.infer<typeof stepExpectationSchema>;
export type ResultExpectation = z.infer<typeof resultExpectationSchema>;
export type UrlExpectation = z.infer<typeof urlExpectationSchema>;
export type DomExpectation = z.infer<typeof domExpectationSchema>;
export type StepReport = z.infer<typeof stepReportSchema>;
export type JourneyReport = z.infer<typeof journeyReportSchema>;
export type CompatibilityFinding = z.infer<typeof compatibilityFindingSchema>;
export type CompatibilityAssessment = z.infer<typeof compatibilityAssessmentSchema>;
export type RunReport = z.infer<typeof runReportSchema>;
export type { JsonValue } from './schema.js';

export function parseProjectContract(input: unknown): ProjectContract {
  return projectContractSchema.parse(input);
}

export function parseRunReport(input: unknown): RunReport {
  return runReportSchema.parse(input);
}

export function safeParseProjectContract(input: unknown) {
  return projectContractSchema.safeParse(input);
}

export function safeParseRunReport(input: unknown) {
  return runReportSchema.safeParse(input);
}
