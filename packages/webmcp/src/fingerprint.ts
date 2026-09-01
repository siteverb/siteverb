import type { JsonSchema, JsonValue } from './types.js';

function canonicalize(value: JsonValue): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key] as JsonValue)}`)
    .join(',')}}`;
}

function fallbackHash(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, '0')}`;
}

export async function schemaFingerprint(schema: JsonSchema | undefined): Promise<string> {
  const canonical = canonicalize((schema ?? {}) as JsonValue);
  const fallback = fallbackHash(canonical);
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return fallback;

  try {
    const digest = await subtle.digest('SHA-256', new TextEncoder().encode(canonical));
    return `sha256:${Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('')}`;
  } catch {
    return fallback;
  }
}
