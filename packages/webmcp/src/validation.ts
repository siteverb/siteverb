import type {
  DefinedSiteverbTool,
  JsonSchema,
  SiteverbToolDefinition,
  ToolDiagnostic,
  WebMcpToolAnnotations,
} from './types.js';

const DEFINED_TOOL = Symbol('siteverb.defined-tool');
const STABLE_ID_PATTERN = /^[a-z][a-z0-9_-]*(?:\.[a-z][a-z0-9_-]*)+$/;
const TOOL_NAME_PATTERN = /^[A-Za-z0-9_.-]{1,128}$/;

type BrandedTool = SiteverbToolDefinition & { readonly [DEFINED_TOOL]: true };

function diagnostic(
  code: ToolDiagnostic['code'],
  message: string,
  path: string,
  severity: ToolDiagnostic['severity'],
): ToolDiagnostic {
  return { code, message, path, severity };
}

function inspectParameterDescriptions(
  value: unknown,
  path: string,
  diagnostics: ToolDiagnostic[],
): void {
  if (value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      inspectParameterDescriptions(entry, `${path}[${index}]`, diagnostics),
    );
    return;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.description === 'string' && record.description.length > 150) {
    diagnostics.push(
      diagnostic(
        'parameter-description-budget',
        'Parameter descriptions should stay within 150 characters for current agent clients.',
        `${path}.description`,
        'warning',
      ),
    );
  }

  for (const [key, entry] of Object.entries(record)) {
    inspectParameterDescriptions(entry, `${path}.${key}`, diagnostics);
  }
}

function inspectAnnotations(
  annotations: WebMcpToolAnnotations | undefined,
  diagnostics: ToolDiagnostic[],
): void {
  if (annotations === undefined) return;
  if (
    (annotations.readOnlyHint !== undefined && typeof annotations.readOnlyHint !== 'boolean') ||
    (annotations.untrustedContentHint !== undefined &&
      typeof annotations.untrustedContentHint !== 'boolean')
  ) {
    diagnostics.push(
      diagnostic(
        'invalid-annotations',
        'WebMCP annotation hints must be booleans.',
        'annotations',
        'error',
      ),
    );
  }
}

function cloneSchema(schema: JsonSchema | undefined): JsonSchema | undefined {
  if (schema === undefined) return undefined;
  const serialized = JSON.stringify(schema);
  if (serialized === undefined) {
    throw new TypeError('inputSchema must be JSON serializable.');
  }
  return JSON.parse(serialized) as JsonSchema;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
}

export function inspectToolDefinition(
  definition: SiteverbToolDefinition,
): readonly ToolDiagnostic[] {
  const diagnostics: ToolDiagnostic[] = [];

  if (
    typeof definition.id !== 'string' ||
    definition.id.length > 128 ||
    !STABLE_ID_PATTERN.test(definition.id)
  ) {
    diagnostics.push(
      diagnostic(
        'invalid-stable-id',
        'id must be a dot-namespaced stable key such as "catalog.search-products".',
        'id',
        'error',
      ),
    );
  }

  if (typeof definition.name !== 'string' || !TOOL_NAME_PATTERN.test(definition.name)) {
    diagnostics.push(
      diagnostic(
        'invalid-tool-name',
        'name must contain 1-128 ASCII letters, digits, underscores, hyphens, or periods.',
        'name',
        'error',
      ),
    );
  } else if (definition.name.length > 30) {
    diagnostics.push(
      diagnostic(
        'tool-name-budget',
        'Tool names should stay within 30 characters for current agent clients.',
        'name',
        'warning',
      ),
    );
  }

  if (typeof definition.description !== 'string' || definition.description.trim() === '') {
    diagnostics.push(
      diagnostic(
        'invalid-description',
        'description must be a non-empty string.',
        'description',
        'error',
      ),
    );
  } else if (definition.description.length > 500) {
    diagnostics.push(
      diagnostic(
        'description-budget',
        'Tool descriptions should stay within 500 characters for current agent clients.',
        'description',
        'warning',
      ),
    );
  }

  if (definition.title !== undefined && typeof definition.title !== 'string') {
    diagnostics.push(
      diagnostic('invalid-title', 'title must be a string when provided.', 'title', 'error'),
    );
  }

  if (typeof definition.execute !== 'function') {
    diagnostics.push(
      diagnostic('invalid-execute', 'execute must be a function.', 'execute', 'error'),
    );
  }

  if (
    definition.inputSchema !== undefined &&
    (definition.inputSchema === null ||
      typeof definition.inputSchema !== 'object' ||
      Array.isArray(definition.inputSchema))
  ) {
    diagnostics.push(
      diagnostic(
        'invalid-input-schema',
        'inputSchema must be a JSON Schema object when provided.',
        'inputSchema',
        'error',
      ),
    );
  } else if (definition.inputSchema !== undefined) {
    try {
      const serialized = JSON.stringify(definition.inputSchema);
      if (serialized === undefined) throw new TypeError('Schema serialized to undefined.');
      inspectParameterDescriptions(definition.inputSchema, 'inputSchema', diagnostics);
    } catch {
      diagnostics.push(
        diagnostic(
          'invalid-input-schema',
          'inputSchema must be JSON serializable.',
          'inputSchema',
          'error',
        ),
      );
    }
  }

  inspectAnnotations(definition.annotations, diagnostics);
  return Object.freeze(diagnostics);
}

export function defineTool<TInput extends object, TResult>(
  definition: SiteverbToolDefinition<TInput, TResult>,
): DefinedSiteverbTool<TInput, TResult> {
  const diagnostics = inspectToolDefinition(definition as SiteverbToolDefinition);
  const errors = diagnostics.filter((entry) => entry.severity === 'error');
  if (errors.length > 0) {
    throw new TypeError(errors.map((entry) => `${entry.path}: ${entry.message}`).join('\n'));
  }

  const tool = {
    ...definition,
    ...(definition.inputSchema === undefined
      ? {}
      : { inputSchema: deepFreeze(cloneSchema(definition.inputSchema)) }),
    ...(definition.annotations === undefined
      ? {}
      : { annotations: Object.freeze({ ...definition.annotations }) }),
  } as SiteverbToolDefinition<TInput, TResult> & { [DEFINED_TOOL]?: true };

  Object.defineProperty(tool, DEFINED_TOOL, {
    enumerable: false,
    value: true,
  });

  return Object.freeze(tool) as DefinedSiteverbTool<TInput, TResult>;
}

export function isDefinedTool(value: unknown): value is DefinedSiteverbTool {
  return Boolean(
    value && typeof value === 'object' && (value as Partial<BrandedTool>)[DEFINED_TOOL] === true,
  );
}
