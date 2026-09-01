import type {
  DomExpectation,
  ResultExpectation,
  StepExpectation,
  UrlExpectation,
} from '@siteverb/contracts';
import type { BrowserPageAdapter } from './types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deepEqual(actual: unknown, expected: unknown): boolean {
  if (Object.is(actual, expected)) return true;
  if (Array.isArray(actual) && Array.isArray(expected)) {
    return (
      actual.length === expected.length &&
      actual.every((entry, index) => deepEqual(entry, expected[index]))
    );
  }
  if (isRecord(actual) && isRecord(expected)) {
    const actualKeys = Object.keys(actual).sort();
    const expectedKeys = Object.keys(expected).sort();
    return (
      deepEqual(actualKeys, expectedKeys) &&
      expectedKeys.every((key) => deepEqual(actual[key], expected[key]))
    );
  }
  return false;
}

function deepContains(actual: unknown, expected: unknown): boolean {
  if (isRecord(expected)) {
    if (!isRecord(actual)) return false;
    return Object.entries(expected).every(([key, value]) => deepContains(actual[key], value));
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length < expected.length) return false;
    return expected.every((entry, index) => deepContains(actual[index], entry));
  }
  return Object.is(actual, expected);
}

function normalizeOutput(output: unknown): unknown {
  if (typeof output !== 'string') return output;
  try {
    return JSON.parse(output) as unknown;
  } catch {
    return output;
  }
}

function assertResult(output: unknown, expectation: ResultExpectation): string | undefined {
  const normalized = normalizeOutput(output);
  if (expectation.equals !== undefined && !deepEqual(normalized, expectation.equals)) {
    return 'Tool result did not exactly match the configured expectation.';
  }
  if (expectation.contains !== undefined && !deepContains(normalized, expectation.contains)) {
    return 'Tool result did not contain the configured expectation.';
  }
  return undefined;
}

function assertUrl(actual: string, expectation: UrlExpectation): string | undefined {
  const url = new URL(actual);
  if (expectation.pathname !== undefined && url.pathname !== expectation.pathname) {
    return `Browser pathname did not match the configured value "${expectation.pathname}".`;
  }
  for (const [name, value] of Object.entries(expectation.searchParams ?? {})) {
    if (url.searchParams.get(name) !== value) {
      return `Browser URL parameter "${name}" did not match the configured value.`;
    }
  }
  return undefined;
}

async function assertDom(
  page: BrowserPageAdapter,
  expectations: readonly DomExpectation[],
): Promise<string | undefined> {
  for (const expectation of expectations) {
    const failure = await page.inspectDom(expectation);
    if (failure) return failure;
  }
  return undefined;
}

export async function assertStepExpectation(
  page: BrowserPageAdapter,
  output: unknown,
  expectation: StepExpectation | undefined,
): Promise<string | undefined> {
  if (!expectation) return undefined;
  if (expectation.result) {
    const failure = assertResult(output, expectation.result);
    if (failure) return failure;
  }
  if (expectation.url) {
    const failure = assertUrl(page.currentUrl(), expectation.url);
    if (failure) return failure;
  }
  if (expectation.dom) {
    const failure = await assertDom(page, expectation.dom);
    if (failure) return failure;
  }
  return undefined;
}
