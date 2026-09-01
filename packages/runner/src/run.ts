import { createHash, randomUUID } from 'node:crypto';
import type {
  JourneyContract,
  JourneyStep,
  ProjectContract,
  RunReport,
  StepReport,
} from '@siteverb/contracts';
import { parseRunReport } from '@siteverb/contracts';
import { assessCompatibility, getClientProfile } from '@siteverb/profiles';
import { assertStepExpectation } from './assertions.js';
import { launchBrowser } from './puppeteer.js';
import type { BrowserPageAdapter, RunJourneyContext, RunProjectOptions } from './types.js';
import { RUNNER_VERSION } from './version.js';

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 600_000;

class RunnerTimeoutError extends Error {
  override readonly name = 'RunnerTimeoutError';
}

function reportError(error: unknown, includeDetails: boolean, fallback: string): string {
  if (error instanceof RunnerTimeoutError) return error.message;
  if (!includeDetails) return fallback;
  const message =
    error instanceof Error
      ? error.message || error.name
      : typeof error === 'string'
        ? error
        : fallback;
  return message.replaceAll(/[\u0000-\u001f\u007f]+/g, ' ').slice(0, 4_000) || fallback;
}

async function withTimeout<T>(
  label: string,
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timeoutError = new RunnerTimeoutError(`${label} timed out after ${timeoutMs} ms.`);
  const timer = setTimeout(() => controller.abort(timeoutError), timeoutMs);
  try {
    return await Promise.race([
      operation(controller.signal),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener('abort', () => reject(controller.signal.reason), {
          once: true,
        });
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(',')}}`;
}

function contractHash(contract: ProjectContract): string {
  return `sha256:${createHash('sha256').update(stableJson(contract)).digest('hex')}`;
}

function reportTargetUrl(targetUrl: string): string {
  const url = new URL(targetUrl);
  return `${url.origin}/`;
}

function validateRunOptions(options: RunProjectOptions): void {
  let target: URL;
  try {
    target = new URL(options.targetUrl);
  } catch {
    throw new TypeError('targetUrl must be an absolute HTTP or HTTPS URL.');
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    throw new TypeError('targetUrl must be an absolute HTTP or HTTPS URL.');
  }
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > MAX_TIMEOUT_MS) {
    throw new TypeError(`timeoutMs must be an integer from 1 to ${MAX_TIMEOUT_MS}.`);
  }
  if ((options.profileIds?.length ?? 0) > 20) {
    throw new TypeError('At most 20 client profiles may be assessed in one run.');
  }
  if (options.profileIds && new Set(options.profileIds).size !== options.profileIds.length) {
    throw new TypeError('Client profile IDs must be unique.');
  }
}

async function waitForTool(
  page: BrowserPageAdapter,
  name: string,
  timeoutMs: number,
): Promise<boolean> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < Math.min(timeoutMs, 5_000)) {
    if ((await page.listTools()).some((tool) => tool.name === name)) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}

async function runStep(
  context: RunJourneyContext,
  step: JourneyStep,
  index: number,
): Promise<StepReport> {
  const startedAt = Date.now();
  const tool = context.contract.tools.find((candidate) => candidate.id === step.tool);
  if (!tool) {
    return {
      index,
      toolId: step.tool,
      toolName: 'unknown',
      status: 'failed',
      durationMs: Date.now() - startedAt,
      error: `Contract tool "${step.tool}" is unavailable.`,
    };
  }
  if (tool.risk !== 'read-only' && !context.allowMutations) {
    return {
      index,
      toolId: tool.id,
      toolName: tool.name,
      status: 'failed',
      durationMs: Date.now() - startedAt,
      error: `Mutation denied for "${tool.id}". Enable mutations only for an approved test target.`,
    };
  }
  if (
    context.journey.policy.requireHumanBefore.includes(tool.id) &&
    !context.approvedTools.has(tool.id)
  ) {
    return {
      index,
      toolId: tool.id,
      toolName: tool.name,
      status: 'failed',
      durationMs: Date.now() - startedAt,
      error: `Explicit approval is required before invoking "${tool.id}".`,
    };
  }
  if (!(await waitForTool(context.page, tool.name, context.timeoutMs))) {
    return {
      index,
      toolId: tool.id,
      toolName: tool.name,
      status: 'failed',
      durationMs: Date.now() - startedAt,
      error: `WebMCP tool "${tool.name}" is not registered in the current page state.`,
    };
  }

  try {
    const result = await withTimeout(`Tool "${tool.name}"`, context.timeoutMs, (signal) =>
      context.page.executeTool(tool.name, step.input, signal),
    );
    if (result.status === 'error') {
      return {
        index,
        toolId: tool.id,
        toolName: tool.name,
        status: 'failed',
        durationMs: Date.now() - startedAt,
        error: reportError(
          result.error,
          context.includeErrorDetails,
          'The browser reported a WebMCP execution failure.',
        ),
      };
    }
    const assertionFailure = await withTimeout(
      `Postconditions for "${tool.name}"`,
      context.timeoutMs,
      () => assertStepExpectation(context.page, result.output, step.expect),
    );
    return {
      index,
      toolId: tool.id,
      toolName: tool.name,
      status: assertionFailure ? 'failed' : 'passed',
      durationMs: Date.now() - startedAt,
      ...(assertionFailure ? { error: assertionFailure } : {}),
    };
  } catch (error) {
    return {
      index,
      toolId: tool.id,
      toolName: tool.name,
      status: 'failed',
      durationMs: Date.now() - startedAt,
      error: reportError(error, context.includeErrorDetails, 'WebMCP tool execution failed.'),
    };
  }
}

async function runSteps(
  context: RunJourneyContext,
  steps: readonly JourneyStep[],
  stopOnFailure = true,
): Promise<StepReport[]> {
  const reports: StepReport[] = [];
  for (const [offset, step] of steps.entries()) {
    const report = await runStep(context, step, offset + 1);
    reports.push(report);
    if (stopOnFailure && report.status === 'failed') break;
  }
  return reports;
}

async function runJourney(
  contract: ProjectContract,
  journey: JourneyContract,
  page: BrowserPageAdapter,
  options: RunProjectOptions,
) {
  const startedAt = Date.now();
  const context: RunJourneyContext = {
    allowMutations: options.allowMutations ?? false,
    approvedTools: new Set(options.approvedTools ?? []),
    contract,
    journey,
    page,
    includeErrorDetails: options.includeErrorDetails ?? false,
    targetUrl: options.targetUrl,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  };
  const steps: StepReport[] = [];
  const cleanup: StepReport[] = [];
  let setupError: string | undefined;

  try {
    await page.goto(new URL(journey.start, options.targetUrl).href, context.timeoutMs);
    steps.push(...(await runSteps(context, journey.steps)));
  } catch (error) {
    setupError = reportError(error, context.includeErrorDetails, 'Journey setup failed.');
  } finally {
    if (journey.cleanup) cleanup.push(...(await runSteps(context, journey.cleanup, false)));
  }

  const failed = Boolean(
    setupError ||
    steps.some((step) => step.status === 'failed') ||
    cleanup.some((step) => step.status === 'failed'),
  );
  return {
    id: journey.id,
    name: journey.name,
    status: failed ? ('failed' as const) : ('passed' as const),
    durationMs: Date.now() - startedAt,
    steps,
    cleanup,
    ...(setupError ? { error: setupError } : {}),
  };
}

function selectJourneys(contract: ProjectContract, ids: readonly string[] | undefined) {
  if (!ids?.length) return contract.journeys;
  const requested = new Set(ids);
  const unknown = ids.filter((id) => !contract.journeys.some((journey) => journey.id === id));
  if (unknown.length > 0) throw new TypeError(`Unknown journey ids: ${unknown.join(', ')}`);
  return contract.journeys.filter((journey) => requested.has(journey.id));
}

function assessProfiles(contract: ProjectContract, ids: readonly string[] | undefined) {
  if (!ids?.length) return [];
  return ids.map((id) => {
    const profile = getClientProfile(id);
    if (!profile) throw new TypeError(`Unknown client profile id: ${id}`);
    return assessCompatibility(contract, profile);
  });
}

export async function runProject(options: RunProjectOptions): Promise<RunReport> {
  const startedAt = new Date();
  validateRunOptions(options);
  const selectedJourneys = selectJourneys(options.contract, options.journeyIds);
  const compatibility = assessProfiles(options.contract, options.profileIds);
  const browser =
    options.browser ??
    (await launchBrowser({
      ...(options.channel === undefined ? {} : { channel: options.channel }),
      ...(options.executablePath === undefined ? {} : { executablePath: options.executablePath }),
      ...(options.headless === undefined ? {} : { headless: options.headless }),
    }));
  const journeys = [];

  try {
    for (const journey of selectedJourneys) {
      const page = await browser.newPage();
      try {
        journeys.push(await runJourney(options.contract, journey, page, options));
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  const report = {
    version: 1 as const,
    runId: randomUUID(),
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    targetUrl: reportTargetUrl(options.targetUrl),
    project: options.contract.project,
    contractHash: contractHash(options.contract),
    runner: { name: '@siteverb/runner', version: RUNNER_VERSION },
    browser: {
      name: browser.name,
      version: browser.version,
      channel: browser.channel,
      evidence: 'real-browser' as const,
    },
    summary: {
      passed: journeys.filter((journey) => journey.status === 'passed').length,
      failed: journeys.filter((journey) => journey.status === 'failed').length,
      skipped: 0,
    },
    compatibility,
    journeys,
  };
  return parseRunReport(report);
}
