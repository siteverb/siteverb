import { describe, expect, it, vi } from 'vitest';
import { createSiteverb, defineTool, type SiteverbTelemetryEvent } from '../src/index.js';
import { createMemoryModelContext, createMemoryTelemetryTransport } from '../src/testing/index.js';

function eventNames(events: readonly SiteverbTelemetryEvent[]): string[] {
  return events.map((event) => event.event);
}

describe('metadata-only telemetry', () => {
  it('records registration and execution without raw inputs or results', async () => {
    const modelContext = createMemoryModelContext();
    const transport = createMemoryTelemetryTransport();
    const client = createSiteverb({
      environment: 'production',
      modelContext,
      release: 'release-1',
      routeTemplate: '/catalog/:slug',
      siteId: 'site_public_123',
      telemetry: { transport },
    });
    const registration = client.registerTool(
      defineTool({
        id: 'catalog.search-products',
        name: 'search_products',
        description: 'Search products.',
        inputSchema: {
          type: 'object',
          properties: { query: { type: 'string' } },
          required: ['query'],
        },
        annotations: { readOnlyHint: true },
        execute: ({ query }: { query: string }) => ({ secretResult: query.toUpperCase() }),
      }),
    );
    await registration.ready;
    await modelContext.executeTool('search_products', { query: 'private input' });
    await client.flush();

    const batch = transport.batches[0];
    expect(batch).toBeDefined();
    expect(eventNames(batch?.events ?? [])).toEqual([
      'surface_loaded',
      'tool_registered',
      'tool_call_started',
      'tool_call_completed',
    ]);
    expect(JSON.stringify(batch)).not.toContain('private input');
    expect(JSON.stringify(batch)).not.toContain('PRIVATE INPUT');
    expect(batch?.events[1]?.tool).toEqual(
      expect.objectContaining({
        stableKey: 'catalog.search-products',
        wireName: 'search_products',
        schemaHash: expect.stringMatching(/^(sha256|fnv1a64):/),
      }),
    );
    expect(batch?.events[2]?.invocationId).toBe(batch?.events[3]?.invocationId);
    expect(batch?.events[2]?.sequenceIndex).toBe(batch?.events[3]?.sequenceIndex);
  });

  it('classifies cancellation and rethrows the original error object', async () => {
    const modelContext = createMemoryModelContext();
    const transport = createMemoryTelemetryTransport();
    const client = createSiteverb({
      modelContext,
      siteId: 'site_public_123',
      telemetry: { transport },
    });
    const original = new DOMException('Sensitive cancellation detail', 'AbortError');
    const registration = client.registerTool({
      id: 'catalog.cancel-search',
      name: 'cancel_search',
      description: 'Cancel a search.',
      execute: () => {
        throw original;
      },
    });
    await registration.ready;

    await expect(modelContext.executeTool('cancel_search')).rejects.toBe(original);
    await client.flush();

    const serialized = JSON.stringify(transport.batches);
    expect(serialized).not.toContain('Sensitive cancellation detail');
    expect(transport.batches.flatMap((batch) => batch.events)).toContainEqual(
      expect.objectContaining({ event: 'tool_call_cancelled', errorClass: 'abort' }),
    );
  });

  it('does not commit registration telemetry after cancellation during identity hashing', async () => {
    let finishDigest: ((value: ArrayBuffer) => void) | undefined;
    const originalCrypto = globalThis.crypto;
    vi.stubGlobal('crypto', {
      getRandomValues: originalCrypto.getRandomValues.bind(originalCrypto),
      randomUUID: originalCrypto.randomUUID.bind(originalCrypto),
      subtle: {
        digest: vi.fn(
          () =>
            new Promise<ArrayBuffer>((resolve) => {
              finishDigest = resolve;
            }),
        ),
      },
    });
    try {
      const modelContext = createMemoryModelContext();
      const transport = createMemoryTelemetryTransport();
      const client = createSiteverb({
        modelContext,
        siteId: 'site_public_123',
        telemetry: { transport },
      });
      const registration = client.registerTool({
        id: 'catalog.slow-identity',
        name: 'slow_identity',
        description: 'Read while identity hashing is pending.',
        inputSchema: { type: 'object' },
        annotations: { readOnlyHint: true },
        execute: () => 'ok',
      });
      await vi.waitFor(() => expect(modelContext.registrations.size).toBe(1));
      expect(registration.status).toBe('pending');

      registration.unregister();
      finishDigest?.(new Uint8Array(32).buffer);
      await expect(registration.ready).rejects.toMatchObject({ name: 'AbortError' });
      await client.flush();

      expect(registration.status).toBe('unregistered');
      expect(modelContext.registrations.size).toBe(0);
      expect(eventNames(transport.batches.flatMap((batch) => batch.events))).toEqual([
        'surface_loaded',
        'tool_registration_cancelled',
      ]);
      client.dispose();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('retries the same bounded batch id after transport failure', async () => {
    const modelContext = createMemoryModelContext();
    const transport = createMemoryTelemetryTransport();
    const diagnostics = vi.fn();
    const client = createSiteverb({
      modelContext,
      onDiagnostic: diagnostics,
      siteId: 'site_public_123',
      telemetry: { transport },
    });
    transport.failWith(new Error('offline'));
    await expect(client.flush()).rejects.toThrow('offline');
    expect(client.telemetry.pendingEvents).toBe(1);
    expect(client.telemetry.consecutiveFailures).toBe(1);
    expect(diagnostics).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'telemetry-send-failed' }),
    );

    transport.recover();
    await client.flush();
    expect(transport.batches).toHaveLength(1);
    expect(client.telemetry.pendingEvents).toBe(0);
    expect(client.telemetry.consecutiveFailures).toBe(0);
  });

  it('pauses bounded automatic retries while retaining the failed batch', async () => {
    vi.useFakeTimers();
    try {
      const modelContext = createMemoryModelContext();
      const transport = createMemoryTelemetryTransport();
      const client = createSiteverb({
        modelContext,
        siteId: 'site_public_123',
        telemetry: {
          flushIntervalMs: 10,
          maxRetryAttempts: 2,
          retryMaxDelayMs: 20,
          transport,
        },
      });
      transport.failWith(new Error('offline'));

      await vi.advanceTimersByTimeAsync(10);
      await vi.advanceTimersByTimeAsync(20);

      expect(client.telemetry).toEqual({
        autoRetryPaused: true,
        consecutiveFailures: 2,
        droppedEvents: 0,
        enabled: true,
        pendingEvents: 1,
      });
      await vi.advanceTimersByTimeAsync(1_000);
      expect(client.telemetry.consecutiveFailures).toBe(2);

      transport.recover();
      await client.flush();
      expect(client.telemetry.autoRetryPaused).toBe(false);
      expect(transport.batches).toHaveLength(1);
      client.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it('flushes every queued batch and records disposal unregistration', async () => {
    const modelContext = createMemoryModelContext();
    const transport = createMemoryTelemetryTransport();
    const client = createSiteverb({
      modelContext,
      siteId: 'site_public_123',
      telemetry: { maxBatchSize: 2, transport },
    });
    const first = client.registerTool({
      id: 'catalog.first',
      name: 'first',
      description: 'First tool.',
      execute: () => 'first',
    });
    const second = client.registerTool({
      id: 'catalog.second',
      name: 'second',
      description: 'Second tool.',
      execute: () => 'second',
    });
    await Promise.all([first.ready, second.ready]);

    client.dispose();
    await client.flush();

    const events = transport.batches.flatMap((batch) => batch.events);
    expect(events.filter((event) => event.event === 'tool_unregistered')).toHaveLength(2);
    expect(client.telemetry.pendingEvents).toBe(0);
    expect(transport.batches.every((batch) => batch.events.length <= 2)).toBe(true);
  });

  it('requires an explicit public site id and transport destination', () => {
    const modelContext = createMemoryModelContext();
    expect(() => createSiteverb({ modelContext, telemetry: { endpoint: '/events' } })).toThrow(
      /siteId is required/,
    );
    expect(() =>
      createSiteverb({ modelContext, siteId: 'site_public_123', telemetry: {} }),
    ).toThrow(/transport or endpoint/);
  });

  it('omits unsafe route data and bounds telemetry labels', async () => {
    const transport = createMemoryTelemetryTransport();
    const diagnostics = vi.fn();
    const client = createSiteverb({
      environment: 'production',
      modelContext: createMemoryModelContext(),
      onDiagnostic: diagnostics,
      release: 'release-1',
      routeTemplate: '/users/customer@example.test?token=secret#private',
      siteId: 'site_public_123',
      telemetry: { transport },
    });
    await client.flush();

    expect(JSON.stringify(transport.batches)).not.toMatch(/customer|token|secret|private/);
    expect(diagnostics).toHaveBeenCalledOnce();
    expect(diagnostics).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'telemetry-route-template-invalid' }),
    );
    expect(() =>
      createSiteverb({
        environment: 'x'.repeat(65),
        modelContext: createMemoryModelContext(),
        siteId: 'site_public_123',
        telemetry: { transport },
      }),
    ).toThrow(/environment/);
    client.dispose();
  });
});
