import { afterEach, describe, expect, it, vi } from 'vitest';
import { schemaFingerprint } from '../src/fingerprint.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('schemaFingerprint', () => {
  it('is stable across object key order', async () => {
    const first = await schemaFingerprint({
      type: 'object',
      properties: { query: { type: 'string' }, limit: { type: 'number' } },
    });
    const second = await schemaFingerprint({
      properties: { limit: { type: 'number' }, query: { type: 'string' } },
      type: 'object',
    });

    expect(first).toBe(second);
  });

  it('falls back deterministically when SubtleCrypto rejects', async () => {
    vi.stubGlobal('crypto', {
      getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto),
      randomUUID: globalThis.crypto.randomUUID.bind(globalThis.crypto),
      subtle: { digest: vi.fn().mockRejectedValue(new Error('unavailable')) },
    });

    const first = await schemaFingerprint({ type: 'object' });
    const second = await schemaFingerprint({ type: 'object' });
    expect(first).toBe(second);
    expect(first).toMatch(/^fnv1a64:[a-f0-9]{16}$/);
  });
});
