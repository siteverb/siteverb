import { createFetchTelemetryTransport } from './transport.js';
import { randomId } from './id.js';
import type {
  SiteverbDiagnostic,
  SiteverbOptions,
  SiteverbTelemetryEvent,
  TelemetryBatch,
  TelemetryErrorClass,
  TelemetryEventName,
  TelemetryFlushReason,
  TelemetryStatus,
  TelemetryToolIdentity,
  TelemetryTransport,
} from './types.js';
import { SITEVERB_WEBMCP_VERSION } from './version.js';

interface EventFields {
  readonly durationMs?: number;
  readonly errorClass?: TelemetryErrorClass;
  readonly invocationId?: string;
  readonly sequenceIndex?: number;
  readonly tool?: TelemetryToolIdentity;
  readonly webmcpSupported?: boolean;
}

export interface TelemetryManager {
  readonly enabled: boolean;
  emit(event: TelemetryEventName, fields?: EventFields): void;
  flush(reason?: TelemetryFlushReason): Promise<void>;
  nextSequence(): number;
  status(): TelemetryStatus;
  dispose(): void;
}

function resolveSessionId(siteId: string): string {
  const key = `__siteverb_session:${siteId}`;
  try {
    const existing = globalThis.sessionStorage?.getItem(key);
    if (existing) return existing;
    const created = randomId();
    globalThis.sessionStorage?.setItem(key, created);
    return created;
  } catch {
    return randomId();
  }
}

function resolveRouteTemplate(route: SiteverbOptions['routeTemplate']): unknown {
  try {
    return typeof route === 'function' ? route() : route;
  } catch {
    return undefined;
  }
}

function boundedLabel(
  value: string | undefined,
  name: string,
  maxLength: number,
): string | undefined {
  if (value === undefined) return undefined;
  if (value.length === 0 || value.length > maxLength || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new TypeError(`${name} must contain 1-${maxLength} characters without controls.`);
  }
  return value;
}

function safeRouteTemplate(value: unknown): string | undefined {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 500 ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    /[?#\u0000-\u001f\u007f]/.test(value)
  ) {
    return undefined;
  }
  return value;
}

function positiveInteger(value: number | undefined, fallback: number, name: string): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${name} must be a positive integer.`);
  }
  return value;
}

function report(options: SiteverbOptions, diagnostic: SiteverbDiagnostic): void {
  try {
    options.onDiagnostic?.(diagnostic);
  } catch {
    // Diagnostics must never alter application behavior.
  }
}

function disabledManager(): TelemetryManager {
  return Object.freeze({
    enabled: false,
    emit: () => undefined,
    flush: async () => undefined,
    nextSequence: () => 0,
    status: () => ({
      autoRetryPaused: false,
      consecutiveFailures: 0,
      droppedEvents: 0,
      enabled: false,
      pendingEvents: 0,
    }),
    dispose: () => undefined,
  });
}

export function createTelemetryManager(
  options: SiteverbOptions,
  webmcpSupported: boolean,
): TelemetryManager {
  if (!options.telemetry) return disabledManager();
  const siteId = boundedLabel(options.siteId, 'siteId', 128);
  if (!siteId) throw new TypeError('siteId is required when telemetry is enabled.');
  const environment = boundedLabel(options.environment, 'environment', 64);
  const release = boundedLabel(options.release, 'release', 200);

  const telemetry = options.telemetry;
  const transport: TelemetryTransport =
    telemetry.transport ??
    (telemetry.endpoint
      ? createFetchTelemetryTransport({ endpoint: telemetry.endpoint })
      : (() => {
          throw new TypeError('telemetry requires either a transport or endpoint.');
        })());
  const flushIntervalMs = positiveInteger(
    telemetry.flushIntervalMs,
    5_000,
    'telemetry.flushIntervalMs',
  );
  const maxBatchSize = positiveInteger(telemetry.maxBatchSize, 20, 'telemetry.maxBatchSize');
  const maxQueueSize = positiveInteger(telemetry.maxQueueSize, 1_000, 'telemetry.maxQueueSize');
  const maxRetryAttempts = positiveInteger(
    telemetry.maxRetryAttempts,
    5,
    'telemetry.maxRetryAttempts',
  );
  const retryMaxDelayMs = positiveInteger(
    telemetry.retryMaxDelayMs,
    60_000,
    'telemetry.retryMaxDelayMs',
  );
  if (maxBatchSize > maxQueueSize) {
    throw new TypeError('telemetry.maxBatchSize cannot exceed telemetry.maxQueueSize.');
  }

  const pageSessionId = resolveSessionId(siteId);
  let queue: SiteverbTelemetryEvent[] = [];
  let pendingBatch: TelemetryBatch | undefined;
  let inFlight: Promise<void> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  let autoRetryPaused = false;
  let consecutiveFailures = 0;
  let droppedEvents = 0;
  let eventIndex = 0;
  let sequenceIndex = 0;
  let invalidRouteTemplateReported = false;

  const schedule = (delayMs = flushIntervalMs): void => {
    if (disposed || autoRetryPaused || timer || (queue.length === 0 && !pendingBatch)) return;
    timer = setTimeout(() => {
      timer = undefined;
      void flush('interval').catch(() => undefined);
    }, delayMs);
  };

  const emit = (event: TelemetryEventName, fields: EventFields = {}): void => {
    if (disposed) return;
    if (queue.length + (pendingBatch?.events.length ?? 0) >= maxQueueSize) {
      droppedEvents += 1;
      report(options, {
        code: 'telemetry-dropped',
        message: 'A Siteverb telemetry event was dropped because the bounded queue is full.',
        severity: 'warning',
      });
      return;
    }

    const candidateRouteTemplate = resolveRouteTemplate(options.routeTemplate);
    const routeTemplate = safeRouteTemplate(candidateRouteTemplate);
    if (
      candidateRouteTemplate !== undefined &&
      routeTemplate === undefined &&
      !invalidRouteTemplateReported
    ) {
      invalidRouteTemplateReported = true;
      report(options, {
        code: 'telemetry-route-template-invalid',
        message:
          'Siteverb omitted an invalid route template; use a bounded pathname template without query or fragment data.',
        severity: 'warning',
      });
    }
    queue.push(
      Object.freeze({
        dataClass: 'production',
        event,
        eventId: randomId(),
        eventIndex: eventIndex++,
        occurredAt: new Date().toISOString(),
        pageSessionId,
        ...(environment === undefined ? {} : { environment }),
        ...(release === undefined ? {} : { release }),
        ...(routeTemplate === undefined ? {} : { routeTemplate }),
        ...fields,
      }),
    );

    if (queue.length >= maxBatchSize) void flush('size').catch(() => undefined);
    else schedule();
  };

  const flush = async (reason: TelemetryFlushReason = 'manual'): Promise<void> => {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
    if (inFlight) {
      await inFlight;
      if ((reason === 'manual' || reason === 'lifecycle') && queue.length > 0) {
        return flush(reason);
      }
      return;
    }
    if (!pendingBatch && queue.length === 0) return;
    if (reason === 'manual' || reason === 'lifecycle') autoRetryPaused = false;

    const batch =
      pendingBatch ??
      Object.freeze({
        batchId: randomId(),
        events: Object.freeze(queue.splice(0, maxBatchSize)),
        protocolVersion: 1 as const,
        sdkVersion: SITEVERB_WEBMCP_VERSION,
        sentAt: new Date().toISOString(),
        siteId,
      });
    pendingBatch = batch;
    const attempt = (async (): Promise<void> => {
      try {
        await transport.send(batch, reason);
        if (pendingBatch?.batchId === batch.batchId) pendingBatch = undefined;
        consecutiveFailures = 0;
        autoRetryPaused = false;
      } catch (cause) {
        consecutiveFailures += 1;
        autoRetryPaused = consecutiveFailures >= maxRetryAttempts;
        report(options, {
          cause,
          code: 'telemetry-send-failed',
          message: autoRetryPaused
            ? 'Siteverb paused automatic telemetry retries; call flush() to retry the retained batch.'
            : 'Siteverb could not deliver a telemetry batch; the same batch will be retried.',
          severity: 'warning',
        });
        if (!autoRetryPaused) {
          schedule(
            Math.min(flushIntervalMs * 2 ** Math.max(0, consecutiveFailures - 1), retryMaxDelayMs),
          );
        }
        throw cause;
      }
    })();
    let trackedAttempt: Promise<void>;
    trackedAttempt = attempt.finally(() => {
      if (inFlight === trackedAttempt) inFlight = undefined;
    });
    inFlight = trackedAttempt;
    await trackedAttempt;

    if ((reason === 'manual' || reason === 'lifecycle') && queue.length > 0) {
      return flush(reason);
    }
    schedule();
  };

  const lifecycleFlush = (): void => {
    void flush('lifecycle').catch(() => undefined);
  };
  const visibilityFlush = (): void => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') lifecycleFlush();
  };
  globalThis.addEventListener?.('pagehide', lifecycleFlush);
  globalThis.document?.addEventListener?.('visibilitychange', visibilityFlush);

  const manager: TelemetryManager = {
    enabled: true,
    emit,
    flush,
    nextSequence: () => sequenceIndex++,
    status: () => ({
      autoRetryPaused,
      consecutiveFailures,
      droppedEvents,
      enabled: true,
      pendingEvents: queue.length + (pendingBatch?.events.length ?? 0),
    }),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      if (timer) clearTimeout(timer);
      timer = undefined;
      globalThis.removeEventListener?.('pagehide', lifecycleFlush);
      globalThis.document?.removeEventListener?.('visibilitychange', visibilityFlush);
      lifecycleFlush();
    },
  };

  emit('surface_loaded', { webmcpSupported });
  return Object.freeze(manager);
}

export function classifyTelemetryError(error: unknown, signal: AbortSignal): TelemetryErrorClass {
  if (signal.aborted || (error instanceof DOMException && error.name === 'AbortError'))
    return 'abort';
  const name = error instanceof Error ? error.name.toLowerCase().replaceAll(/[-_]/g, '') : '';
  if (name === 'timeouterror') return 'timeout';
  if (name === 'networkerror') return 'network';
  if (name === 'notfounderror') return 'not-found';
  if (name === 'notallowederror' || name === 'securityerror') return 'permission';
  if (name === 'validationerror' || name === 'invalidstateerror') return 'validation';
  return 'unknown';
}
