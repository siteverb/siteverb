import type { TelemetryBatch, TelemetryFlushReason, TelemetryTransport } from './types.js';

export interface FetchTelemetryTransportOptions {
  readonly endpoint: string;
  readonly fetch?: typeof globalThis.fetch;
}

function validateEndpoint(value: string): string {
  if (
    value.length === 0 ||
    value.length > 2_000 ||
    value !== value.trim() ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new TypeError('Telemetry endpoint must be a bounded URL without controls.');
  }
  if (value.startsWith('/') && !value.startsWith('//')) {
    const base = 'https://siteverb.invalid';
    const resolved = new URL(value, base);
    if (resolved.origin !== base || value.includes('?') || value.includes('#')) {
      throw new TypeError('Telemetry endpoint must not contain query or fragment data.');
    }
    return value;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError('Telemetry endpoint must be a relative, HTTPS, or loopback HTTP URL.');
  }
  const loopback =
    url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
  if (
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new TypeError(
      'Telemetry endpoint must use HTTPS or loopback HTTP without credentials, query, or fragment data.',
    );
  }
  return url.href;
}

export function createFetchTelemetryTransport(
  options: FetchTelemetryTransportOptions,
): TelemetryTransport {
  if (typeof options.endpoint !== 'string')
    throw new TypeError('A telemetry endpoint is required.');
  const endpoint = validateEndpoint(options.endpoint);

  const fetcher = options.fetch ?? globalThis.fetch?.bind(globalThis);
  return Object.freeze({
    async send(batch: TelemetryBatch, _reason: TelemetryFlushReason): Promise<void> {
      const body = JSON.stringify(batch);
      if (!fetcher) throw new Error('fetch is unavailable for the telemetry transport.');

      const response = await fetcher(endpoint, {
        body,
        credentials: 'omit',
        headers: { 'content-type': 'application/json' },
        keepalive: true,
        method: 'POST',
      });
      if (!response.ok) throw new Error(`Telemetry endpoint returned HTTP ${response.status}.`);
    },
  });
}
