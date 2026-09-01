import { describe, expect, it, vi } from 'vitest';
import {
  createFetchTelemetryTransport,
  type TelemetryBatch,
  type TelemetryFlushReason,
} from '../src/index.js';

const batch: TelemetryBatch = {
  batchId: 'batch-1',
  events: [],
  protocolVersion: 1,
  sdkVersion: '0.1.0',
  sentAt: '2026-08-31T00:00:00.000Z',
  siteId: 'site_public_123',
};

describe('createFetchTelemetryTransport', () => {
  it('sends JSON without browser credentials', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 202 }));
    const transport = createFetchTelemetryTransport({
      endpoint: 'https://events.example.test/v1/webmcp',
      fetch: fetcher,
    });

    await transport.send(batch, 'manual');

    expect(fetcher).toHaveBeenCalledWith('https://events.example.test/v1/webmcp', {
      body: JSON.stringify(batch),
      credentials: 'omit',
      headers: { 'content-type': 'application/json' },
      keepalive: true,
      method: 'POST',
    });
  });

  it.each<TelemetryFlushReason>(['interval', 'lifecycle', 'manual', 'size'])(
    'uses credential-free keepalive fetch for %s delivery',
    async (reason) => {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
      const transport = createFetchTelemetryTransport({
        endpoint: 'https://events.example.test/v1/webmcp',
        fetch: fetcher,
      });

      await transport.send(batch, reason);

      expect(fetcher).toHaveBeenCalledWith(
        'https://events.example.test/v1/webmcp',
        expect.objectContaining({ credentials: 'omit', keepalive: true }),
      );
    },
  );

  it('rejects invalid endpoints and non-success responses', async () => {
    for (const endpoint of [
      ' ',
      '//events.example.test/collect',
      '/\\events.example.test/collect',
      'http://events.example.test/collect',
      'https://user:password@events.example.test/collect',
      'https://events.example.test/collect?token=secret',
      'https://events.example.test/collect#fragment',
    ]) {
      expect(() => createFetchTelemetryTransport({ endpoint })).toThrow(/Telemetry endpoint/);
    }
    expect(() => createFetchTelemetryTransport({ endpoint: '/events' })).not.toThrow();
    expect(() =>
      createFetchTelemetryTransport({ endpoint: 'http://127.0.0.1:8787/events' }),
    ).not.toThrow();
    const transport = createFetchTelemetryTransport({
      endpoint: 'https://events.example.test/v1/webmcp',
      fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 })),
    });

    await expect(transport.send(batch, 'manual')).rejects.toThrow('HTTP 503');
  });
});
