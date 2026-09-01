import { expectTypeOf, test } from 'vitest';
import { createSiteverb, type NativeModelContext } from '../src/index.js';

test('accepts the official WebMCP ModelContext type', () => {
  const asNativeContext = (context: WebMCP.ModelContext): NativeModelContext => context;

  const acceptOfficialContext = (context: WebMCP.ModelContext) =>
    createSiteverb({ modelContext: asNativeContext(context) });

  expectTypeOf(acceptOfficialContext).toBeFunction();
});
