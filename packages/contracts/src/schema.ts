import { z } from 'zod';

const stableId = z
  .string()
  .min(3)
  .max(128)
  .regex(
    /^[a-z][a-z0-9_-]*(?:\.[a-z][a-z0-9_-]*)+$/,
    'Expected a dot-namespaced stable ID such as "catalog.search-products".',
  );

const wireName = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_.-]+$/, 'Expected a valid WebMCP tool name.');

const jsonPrimitiveSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const MAX_COMPATIBILITY_FINDINGS = 2_500;
const MAX_DOM_EXPECTATIONS = 50;
const MAX_EXAMPLES = 50;
const MAX_JSON_ARRAY_ITEMS = 1_000;
const MAX_JOURNEYS = 200;
const MAX_PROFILES = 20;
const MAX_STEPS = 100;
const MAX_TOOLS = 1_000;
const CONTRACT_BASE_URL = 'https://siteverb.invalid';

const sameOriginPath = z
  .string()
  .min(1)
  .max(500)
  .refine((value) => {
    if (!value.startsWith('/') || /[\u0000-\u001f\u007f]/.test(value)) return false;
    try {
      return new URL(value, CONTRACT_BASE_URL).origin === CONTRACT_BASE_URL;
    } catch {
      return false;
    }
  }, 'Expected a same-origin path beginning with "/".');

export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    jsonPrimitiveSchema,
    z.array(jsonValueSchema).max(MAX_JSON_ARRAY_ITEMS),
    z.record(z.string(), jsonValueSchema),
  ]),
);

export const toolAnnotationsSchema = z
  .strictObject({
    readOnlyHint: z.boolean().optional(),
    untrustedContentHint: z.boolean().optional(),
  })
  .optional();

export const toolExampleSchema = z.strictObject({
  name: z.string().min(1).max(120),
  input: z.record(z.string(), jsonValueSchema),
});

export const toolContractSchema = z
  .strictObject({
    id: stableId,
    name: wireName,
    title: z.string().min(1).max(120).optional(),
    description: z.string().min(1).max(500),
    inputSchema: z.record(z.string(), z.unknown()).optional(),
    annotations: toolAnnotationsSchema,
    risk: z.enum(['read-only', 'reversible', 'consequential']),
    registration: z.enum(['imperative', 'declarative']).default('imperative'),
    frame: z.enum(['top-level', 'same-origin-iframe', 'cross-origin-iframe']).default('top-level'),
    routes: z.array(sameOriginPath).min(1).max(200).optional(),
    owners: z.array(z.string().min(1)).min(1).max(100).optional(),
    examples: z.array(toolExampleSchema).min(1).max(MAX_EXAMPLES),
  })
  .superRefine((tool, context) => {
    if (tool.risk === 'read-only' && tool.annotations?.readOnlyHint !== true) {
      context.addIssue({
        code: 'custom',
        message: 'Read-only tools must declare annotations.readOnlyHint as true.',
        path: ['annotations', 'readOnlyHint'],
      });
    }
    if (tool.risk !== 'read-only' && tool.annotations?.readOnlyHint === true) {
      context.addIssue({
        code: 'custom',
        message: 'State-changing tools cannot declare annotations.readOnlyHint as true.',
        path: ['annotations', 'readOnlyHint'],
      });
    }
  });

export const resultExpectationSchema = z
  .strictObject({
    equals: jsonValueSchema.optional(),
    contains: jsonValueSchema.optional(),
  })
  .refine((value) => value.equals !== undefined || value.contains !== undefined, {
    message: 'Result expectations require equals or contains.',
  });

export const urlExpectationSchema = z
  .strictObject({
    pathname: z.string().startsWith('/').optional(),
    searchParams: z.record(z.string(), z.string()).optional(),
  })
  .refine((value) => value.pathname !== undefined || value.searchParams !== undefined, {
    message: 'URL expectations require pathname or searchParams.',
  });

export const domExpectationSchema = z.strictObject({
  selector: z.string().min(1).max(500),
  state: z.enum(['attached', 'detached', 'visible', 'hidden']).default('visible'),
  textContains: z.string().max(2_000).optional(),
  attribute: z
    .strictObject({
      name: z.string().min(1).max(120),
      equals: z.string().max(2_000),
    })
    .optional(),
});

export const stepExpectationSchema = z.strictObject({
  result: resultExpectationSchema.optional(),
  url: urlExpectationSchema.optional(),
  dom: z.array(domExpectationSchema).min(1).max(MAX_DOM_EXPECTATIONS).optional(),
});

export const journeyStepSchema = z.strictObject({
  tool: stableId,
  input: z.record(z.string(), jsonValueSchema).default({}),
  expect: stepExpectationSchema.optional(),
});

export const journeyContractSchema = z.strictObject({
  id: stableId,
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(500).optional(),
  start: sameOriginPath,
  auth: z.string().min(1).max(120).optional(),
  owners: z.array(z.string().min(1)).min(1).max(100).optional(),
  steps: z.array(journeyStepSchema).min(1).max(MAX_STEPS),
  cleanup: z.array(journeyStepSchema).min(1).max(MAX_STEPS).optional(),
  policy: z
    .strictObject({
      requireHumanBefore: z.array(stableId).max(MAX_TOOLS).default([]),
    })
    .default({ requireHumanBefore: [] }),
});

export const supportProfileSchema = z.strictObject({
  id: z.string().min(1).max(120),
  version: z.string().min(1).max(120),
  evidence: z.enum(['real-client', 'real-browser', 'official-sdk', 'documented-profile']),
});

export const projectContractSchema = z
  .strictObject({
    $schema: z.string().min(1).max(500).optional(),
    version: z.literal(1),
    project: z.string().min(1).max(120),
    support: z.array(supportProfileSchema).max(MAX_PROFILES).default([]),
    tools: z.array(toolContractSchema).min(1).max(MAX_TOOLS),
    journeys: z.array(journeyContractSchema).min(1).max(MAX_JOURNEYS),
  })
  .superRefine((contract, context) => {
    const toolIds = new Set<string>();
    const toolNames = new Set<string>();
    const toolRisks = new Map<string, 'read-only' | 'reversible' | 'consequential'>();
    for (const [index, tool] of contract.tools.entries()) {
      if (toolIds.has(tool.id)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate tool id "${tool.id}".`,
          path: ['tools', index, 'id'],
        });
      }
      if (toolNames.has(tool.name)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate tool name "${tool.name}".`,
          path: ['tools', index, 'name'],
        });
      }
      toolIds.add(tool.id);
      toolNames.add(tool.name);
      toolRisks.set(tool.id, tool.risk);
    }

    const journeyIds = new Set<string>();
    for (const [journeyIndex, journey] of contract.journeys.entries()) {
      if (journeyIds.has(journey.id)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate journey id "${journey.id}".`,
          path: ['journeys', journeyIndex, 'id'],
        });
      }
      journeyIds.add(journey.id);

      for (const [collectionName, steps] of [
        ['steps', journey.steps],
        ['cleanup', journey.cleanup ?? []],
      ] as const) {
        for (const [stepIndex, step] of steps.entries()) {
          if (!toolIds.has(step.tool)) {
            context.addIssue({
              code: 'custom',
              message: `Unknown tool id "${step.tool}".`,
              path: ['journeys', journeyIndex, collectionName, stepIndex, 'tool'],
            });
          }
        }
      }

      for (const requiredTool of journey.policy.requireHumanBefore) {
        if (!toolIds.has(requiredTool)) {
          context.addIssue({
            code: 'custom',
            message: `Unknown approval tool id "${requiredTool}".`,
            path: ['journeys', journeyIndex, 'policy', 'requireHumanBefore'],
          });
        }
      }
      for (const [collectionName, steps] of [
        ['steps', journey.steps],
        ['cleanup', journey.cleanup ?? []],
      ] as const) {
        for (const [stepIndex, step] of steps.entries()) {
          if (
            toolRisks.get(step.tool) === 'consequential' &&
            !journey.policy.requireHumanBefore.includes(step.tool)
          ) {
            context.addIssue({
              code: 'custom',
              message: `Consequential tool "${step.tool}" requires an explicit human-approval policy.`,
              path: ['journeys', journeyIndex, collectionName, stepIndex, 'tool'],
            });
          }
        }
      }
    }
  });

export const evidenceLevelSchema = z.enum([
  'real-client',
  'real-browser',
  'official-sdk',
  'documented-profile',
  'spec-only',
]);

export const stepReportSchema = z.strictObject({
  index: z.number().int().positive(),
  toolId: stableId,
  toolName: wireName,
  status: z.enum(['passed', 'failed', 'skipped']),
  durationMs: z.number().int().nonnegative(),
  error: z.string().max(4_000).optional(),
});

export const journeyReportSchema = z.strictObject({
  id: stableId,
  name: z.string().min(1).max(120),
  status: z.enum(['passed', 'failed', 'skipped']),
  durationMs: z.number().int().nonnegative(),
  steps: z.array(stepReportSchema).max(MAX_STEPS),
  cleanup: z.array(stepReportSchema).max(MAX_STEPS).default([]),
  error: z.string().max(4_000).optional(),
});

export const compatibilityFindingSchema = z.strictObject({
  code: z.string().min(1).max(120),
  evidence: evidenceLevelSchema,
  message: z.string().min(1).max(2_000),
  severity: z.enum(['error', 'warning']),
  source: z.string().url().max(500),
  toolId: stableId,
});

export const compatibilityAssessmentSchema = z.strictObject({
  profileId: z.string().min(1).max(120),
  status: z.enum(['compatible', 'incompatible', 'unknown']),
  findings: z.array(compatibilityFindingSchema).max(MAX_COMPATIBILITY_FINDINGS),
});

export const runReportSchema = z
  .strictObject({
    version: z.literal(1),
    runId: z.string().min(1).max(200),
    startedAt: z.string().datetime({ offset: true }),
    finishedAt: z.string().datetime({ offset: true }),
    targetUrl: z
      .string()
      .url()
      .max(500)
      .refine((value) => {
        const url = new URL(value);
        return (
          url.username === '' &&
          url.password === '' &&
          url.pathname === '/' &&
          url.search === '' &&
          url.hash === ''
        );
      }, 'Report targetUrl must contain only an origin.'),
    project: z.string().min(1).max(120),
    contractHash: z.string().min(1).max(200),
    runner: z.strictObject({
      name: z.string().min(1).max(120),
      version: z.string().min(1).max(120),
    }),
    browser: z.strictObject({
      name: z.string().min(1).max(120),
      version: z.string().min(1).max(120),
      channel: z.string().min(1).max(120),
      evidence: evidenceLevelSchema,
    }),
    summary: z.strictObject({
      passed: z.number().int().nonnegative(),
      failed: z.number().int().nonnegative(),
      skipped: z.number().int().nonnegative(),
    }),
    compatibility: z.array(compatibilityAssessmentSchema).max(MAX_PROFILES).default([]),
    journeys: z.array(journeyReportSchema).max(MAX_JOURNEYS),
  })
  .superRefine((report, context) => {
    for (const status of ['passed', 'failed', 'skipped'] as const) {
      const observed = report.journeys.filter((journey) => journey.status === status).length;
      if (report.summary[status] !== observed) {
        context.addIssue({
          code: 'custom',
          message: `Summary ${status} count does not match journey statuses.`,
          path: ['summary', status],
        });
      }
    }
  });

export const projectContractJsonSchema = z.toJSONSchema(projectContractSchema, {
  target: 'draft-2020-12',
  reused: 'ref',
});

export const runReportJsonSchema = z.toJSONSchema(runReportSchema, {
  target: 'draft-2020-12',
  reused: 'ref',
});
