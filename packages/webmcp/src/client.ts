import type {
  AnySiteverbTool,
  BatchRegistrationHandle,
  CoverageSnapshot,
  DefinedSiteverbTool,
  NativeModelContext,
  NativeModelContextTool,
  RegisterToolOptions,
  RegisterToolsOptions,
  RegistrationHandle,
  RegistrationResult,
  RegistrationStatus,
  RuntimeSnapshot,
  SiteverbClient,
  SiteverbOptions,
  SiteverbToolDefinition,
  TelemetryToolIdentity,
} from './types.js';
import { schemaFingerprint } from './fingerprint.js';
import { randomId } from './id.js';
import {
  classifyTelemetryError,
  createTelemetryManager,
  type TelemetryManager,
} from './telemetry.js';
import { defineTool, isDefinedTool } from './validation.js';

interface MutableRegistration {
  handle: RegistrationHandle;
  status: RegistrationStatus;
}

function defaultModelContext(): NativeModelContext | undefined {
  if (typeof document === 'undefined') return undefined;
  return (document as Document & { modelContext?: NativeModelContext }).modelContext;
}

function resolveModelContext(options: SiteverbOptions): NativeModelContext | undefined {
  if (typeof options.modelContext === 'function') return options.modelContext();
  return options.modelContext ?? defaultModelContext();
}

function nativeTool<TInput extends object, TResult>(
  tool: DefinedSiteverbTool<TInput, TResult>,
  telemetry: TelemetryManager,
  identity: Promise<TelemetryToolIdentity>,
): NativeModelContextTool {
  return {
    name: tool.name,
    ...(tool.title === undefined ? {} : { title: tool.title }),
    description: tool.description,
    ...(tool.inputSchema === undefined ? {} : { inputSchema: tool.inputSchema }),
    ...(tool.annotations === undefined ? {} : { annotations: tool.annotations }),
    execute: async (input, executionOptions) => {
      const signal = executionOptions?.signal ?? new AbortController().signal;
      const invocationId = randomId();
      const sequenceIndex = telemetry.nextSequence();
      const telemetryIdentity = await identity;
      const startedAt = globalThis.performance?.now() ?? Date.now();
      telemetry.emit('tool_call_started', {
        invocationId,
        sequenceIndex,
        tool: telemetryIdentity,
      });

      try {
        if (signal.aborted) throw abortReason(signal.reason);
        const result = await tool.execute(input as TInput, {
          signal,
          invocationId,
        });
        telemetry.emit('tool_call_completed', {
          durationMs: Math.max(
            0,
            Math.round((globalThis.performance?.now() ?? Date.now()) - startedAt),
          ),
          invocationId,
          sequenceIndex,
          tool: telemetryIdentity,
        });
        return result;
      } catch (error) {
        const errorClass = classifyTelemetryError(error, signal);
        telemetry.emit(errorClass === 'abort' ? 'tool_call_cancelled' : 'tool_call_failed', {
          durationMs: Math.max(
            0,
            Math.round((globalThis.performance?.now() ?? Date.now()) - startedAt),
          ),
          errorClass,
          invocationId,
          sequenceIndex,
          tool: telemetryIdentity,
        });
        throw error;
      }
    },
  };
}

function abortReason(reason: unknown): unknown {
  if (reason !== undefined) return reason;
  return new DOMException('The Siteverb registration was removed.', 'AbortError');
}

export function createSiteverb(options: SiteverbOptions = {}): SiteverbClient {
  const registrationsById = new Map<string, MutableRegistration>();
  const registrationsByName = new Map<string, MutableRegistration>();
  const telemetry = createTelemetryManager(options, Boolean(resolveModelContext(options)));

  const registerTool = <TInput extends object, TResult>(
    definition: SiteverbToolDefinition<TInput, TResult> | DefinedSiteverbTool<TInput, TResult>,
    registerOptions: RegisterToolOptions = {},
  ): RegistrationHandle => {
    const tool = isDefinedTool(definition) ? definition : defineTool(definition);
    if (registrationsById.has(tool.id)) {
      throw new TypeError(`A Siteverb tool with id "${tool.id}" is already registered.`);
    }
    if (registrationsByName.has(tool.name)) {
      throw new TypeError(`A WebMCP tool with name "${tool.name}" is already registered.`);
    }

    const controller = new AbortController();
    const identity = schemaFingerprint(tool.inputSchema).then((schemaHash) => ({
      schemaHash,
      stableKey: tool.id,
      wireName: tool.name,
    }));
    let resolvedIdentity: TelemetryToolIdentity | undefined;
    void identity.then((value) => {
      resolvedIdentity = value;
    });
    let externalAbort: (() => void) | undefined;
    let emittedRegistration = false;
    const mutable = {} as MutableRegistration;

    const unregister = (reason?: unknown): void => {
      if (mutable.status === 'unregistered') return;
      controller.abort(abortReason(reason));
      if (emittedRegistration) {
        if (resolvedIdentity) telemetry.emit('tool_unregistered', { tool: resolvedIdentity });
        else {
          void identity.then((toolIdentity) =>
            telemetry.emit('tool_unregistered', { tool: toolIdentity }),
          );
        }
        emittedRegistration = false;
      }
      mutable.status = 'unregistered';
      registrationsById.delete(tool.id);
      registrationsByName.delete(tool.name);
      if (externalAbort) registerOptions.signal?.removeEventListener('abort', externalAbort);
    };

    const handle = {
      id: tool.id,
      name: tool.name,
      get status() {
        return mutable.status;
      },
      signal: controller.signal,
      unregister,
    } as RegistrationHandle & { ready: Promise<RegistrationResult> };

    mutable.handle = handle;
    mutable.status = 'pending';
    registrationsById.set(tool.id, mutable);
    registrationsByName.set(tool.name, mutable);

    if (registerOptions.signal) {
      externalAbort = () => unregister(registerOptions.signal?.reason);
      if (registerOptions.signal.aborted) externalAbort();
      else registerOptions.signal.addEventListener('abort', externalAbort, { once: true });
    }

    const ready = (async (): Promise<RegistrationResult> => {
      if (controller.signal.aborted) throw controller.signal.reason;
      const context = resolveModelContext(options);
      if (controller.signal.aborted) throw controller.signal.reason;
      if (!context) {
        mutable.status = 'unsupported';
        return { id: tool.id, name: tool.name, status: 'unsupported' };
      }

      try {
        await context.registerTool(nativeTool(tool, telemetry, identity), {
          signal: controller.signal,
          ...(registerOptions.exposedTo === undefined
            ? {}
            : { exposedTo: [...registerOptions.exposedTo] }),
        });
        if (controller.signal.aborted) throw controller.signal.reason;
        resolvedIdentity = await identity;
        if (controller.signal.aborted) throw controller.signal.reason;
        mutable.status = 'registered';
        emittedRegistration = true;
        telemetry.emit('tool_registered', { tool: resolvedIdentity });
        return { id: tool.id, name: tool.name, status: 'registered' };
      } catch (error) {
        if (mutable.status !== 'unregistered') mutable.status = 'failed';
        registrationsById.delete(tool.id);
        registrationsByName.delete(tool.name);
        const errorClass = classifyTelemetryError(error, controller.signal);
        telemetry.emit(
          errorClass === 'abort' ? 'tool_registration_cancelled' : 'tool_registration_failed',
          {
            errorClass,
            tool: await identity,
          },
        );
        throw error;
      }
    })();

    handle.ready = ready;
    void ready.catch(() => undefined);
    return handle;
  };

  const registerTools = (
    definitions: readonly AnySiteverbTool[],
    registerOptions: RegisterToolsOptions = {},
  ): BatchRegistrationHandle => {
    const definitionsById = new Set<string>();
    const definitionsByName = new Set<string>();
    const tools = definitions.map((definition) =>
      isDefinedTool(definition) ? definition : defineTool(definition),
    );
    for (const tool of tools) {
      if (definitionsById.has(tool.id) || registrationsById.has(tool.id)) {
        throw new TypeError(`A Siteverb tool with id "${tool.id}" is already registered.`);
      }
      if (definitionsByName.has(tool.name) || registrationsByName.has(tool.name)) {
        throw new TypeError(`A WebMCP tool with name "${tool.name}" is already registered.`);
      }
      definitionsById.add(tool.id);
      definitionsByName.add(tool.name);
    }

    const controller = new AbortController();
    const handles: RegistrationHandle[] = [];
    const atomic = registerOptions.atomic ?? true;
    let externalAbort: (() => void) | undefined;
    const unregister = (reason?: unknown): void => {
      controller.abort(abortReason(reason));
      for (const handle of handles) handle.unregister(reason);
      if (externalAbort) registerOptions.signal?.removeEventListener('abort', externalAbort);
    };

    if (registerOptions.signal) {
      externalAbort = () => unregister(registerOptions.signal?.reason);
      if (registerOptions.signal.aborted) externalAbort();
      else registerOptions.signal.addEventListener('abort', externalAbort, { once: true });
    }

    try {
      for (const definition of tools) {
        handles.push(
          registerTool(definition, {
            signal: controller.signal,
            ...(registerOptions.exposedTo === undefined
              ? {}
              : { exposedTo: registerOptions.exposedTo }),
          }),
        );
      }
    } catch (error) {
      if (atomic) unregister(error);
      throw error;
    }

    const ready = Promise.all(handles.map((handle) => handle.ready)).catch((error: unknown) => {
      if (atomic) unregister(error);
      throw error;
    });
    void ready.catch(() => undefined);

    return Object.freeze({
      handles: Object.freeze(handles),
      ready,
      signal: controller.signal,
      unregister,
    });
  };

  const snapshot = (): RuntimeSnapshot => {
    const tools = Array.from(registrationsById.values(), ({ handle, status }) => ({
      id: handle.id,
      name: handle.name,
      status,
    })).sort((left, right) => left.id.localeCompare(right.id));

    return {
      ...(options.environment === undefined ? {} : { environment: options.environment }),
      ...(options.release === undefined ? {} : { release: options.release }),
      ...(options.siteId === undefined ? {} : { siteId: options.siteId }),
      supported: Boolean(resolveModelContext(options)),
      telemetry: telemetry.status(),
      tools,
    };
  };

  const coverage = async (): Promise<CoverageSnapshot> => {
    const context = resolveModelContext(options);
    const instrumented = Array.from(registrationsByName.keys()).sort();
    if (!context?.getTools) {
      return {
        completeness: null,
        discovered: [],
        instrumented,
        inventoryOnly: [],
        missing: [],
        status: 'unavailable',
      };
    }

    let discovered: string[];
    try {
      discovered = Array.from(new Set((await context.getTools()).map((tool) => tool.name))).sort();
    } catch (cause) {
      options.onDiagnostic?.({
        cause,
        code: 'coverage-unavailable',
        message: 'The native WebMCP inventory could not be read.',
        severity: 'warning',
      });
      return {
        completeness: null,
        discovered: [],
        instrumented,
        inventoryOnly: [],
        missing: [],
        status: 'unavailable',
      };
    }
    const discoveredSet = new Set(discovered);
    const instrumentedSet = new Set(instrumented);
    const inventoryOnly = discovered.filter((name) => !instrumentedSet.has(name));
    const missing = instrumented.filter((name) => !discoveredSet.has(name));

    return {
      completeness:
        discovered.length === 0
          ? instrumented.length === 0
            ? null
            : 0
          : (discovered.length - inventoryOnly.length) / discovered.length,
      discovered,
      instrumented,
      inventoryOnly,
      missing,
      status: 'available',
    };
  };

  const dispose = (reason?: unknown): void => {
    for (const registration of Array.from(registrationsById.values())) {
      registration.handle.unregister(reason);
    }
    telemetry.dispose();
  };

  return Object.freeze({
    get supported() {
      return Boolean(resolveModelContext(options));
    },
    get telemetry() {
      return telemetry.status();
    },
    registerTool,
    registerTools,
    coverage,
    dispose,
    flush: () => telemetry.flush('manual'),
    snapshot,
  });
}
