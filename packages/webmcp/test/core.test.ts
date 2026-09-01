import { describe, expect, it, vi } from 'vitest';
import {
  createSiteverb,
  defineTool,
  inspectToolDefinition,
  type NativeModelContext,
  type NativeModelContextTool,
  type NativeRegisterToolOptions,
  type NativeRegisteredTool,
} from '../src/index.js';

class FakeModelContext implements NativeModelContext {
  readonly registrations = new Map<
    string,
    { options?: NativeRegisterToolOptions; tool: NativeModelContextTool }
  >();
  readonly extraTools: NativeRegisteredTool[] = [];
  failName?: string;

  async registerTool(
    tool: NativeModelContextTool,
    options?: NativeRegisterToolOptions,
  ): Promise<void> {
    if (tool.name === this.failName) throw new Error(`Registration failed: ${tool.name}`);
    if (this.registrations.has(tool.name)) throw new Error(`Duplicate tool: ${tool.name}`);
    this.registrations.set(tool.name, { tool, ...(options === undefined ? {} : { options }) });
    options?.signal?.addEventListener(
      'abort',
      () => {
        this.registrations.delete(tool.name);
      },
      { once: true },
    );
  }

  async getTools(): Promise<readonly NativeRegisteredTool[]> {
    return [
      ...Array.from(this.registrations.values(), ({ tool }) => ({
        name: tool.name,
        ...(tool.title === undefined ? {} : { title: tool.title }),
        description: tool.description,
        ...(tool.inputSchema === undefined ? {} : { inputSchema: tool.inputSchema }),
        ...(tool.annotations === undefined ? {} : { annotations: tool.annotations }),
      })),
      ...this.extraTools,
    ];
  }
}

function searchTool() {
  return defineTool({
    id: 'catalog.search-products',
    name: 'search_products',
    description: 'Search the product catalog.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Search query.' } },
      required: ['query'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    execute: async ({ query }: { query: string }, { signal }) => ({
      query,
      aborted: signal.aborted,
    }),
  });
}

describe('defineTool', () => {
  it('validates, clones, and freezes author-owned metadata', () => {
    const schema = { type: 'object', properties: { query: { type: 'string' } } };
    const tool = defineTool({
      id: 'catalog.search',
      name: 'search',
      description: 'Search the catalog.',
      inputSchema: schema,
      execute: () => 'ok',
    });

    schema.type = 'array';
    expect(tool.inputSchema).toEqual({
      type: 'object',
      properties: { query: { type: 'string' } },
    });
    expect(Object.isFrozen(tool)).toBe(true);
    expect(Object.isFrozen(tool.inputSchema)).toBe(true);
  });

  it('rejects invalid stable ids and wire names before registration', () => {
    expect(() =>
      defineTool({
        id: 'search',
        name: 'search products',
        description: 'Search.',
        execute: () => undefined,
      }),
    ).toThrow(/dot-namespaced stable key/);
  });

  it('reports client-budget guidance as warnings, not authoring failures', () => {
    const diagnostics = inspectToolDefinition({
      id: 'catalog.search',
      name: 'a'.repeat(31),
      description: 'Search.',
      execute: () => undefined,
    });
    expect(diagnostics).toContainEqual(
      expect.objectContaining({ code: 'tool-name-budget', severity: 'warning' }),
    );
  });
});

describe('createSiteverb', () => {
  it('registers a native tool without leaking Siteverb identity into browser metadata', async () => {
    const context = new FakeModelContext();
    const client = createSiteverb({ modelContext: context, release: 'abc123' });
    const registration = client.registerTool(searchTool());

    await expect(registration.ready).resolves.toEqual({
      id: 'catalog.search-products',
      name: 'search_products',
      status: 'registered',
    });
    const native = context.registrations.get('search_products')?.tool;
    expect(native).toBeDefined();
    expect(native).not.toHaveProperty('id');
    expect(client.snapshot()).toEqual(
      expect.objectContaining({
        release: 'abc123',
        supported: true,
        tools: [{ id: 'catalog.search-products', name: 'search_products', status: 'registered' }],
      }),
    );
  });

  it('preserves callback results and forwards invocation cancellation', async () => {
    const context = new FakeModelContext();
    const execute = vi.fn(
      async (input: { query: string }, { signal }: { signal: AbortSignal }) => ({
        input,
        signal,
      }),
    );
    const client = createSiteverb({ modelContext: context });
    const registration = client.registerTool({
      ...searchTool(),
      execute,
    });
    await registration.ready;

    const invocation = new AbortController();
    const result = await context.registrations
      .get('search_products')
      ?.tool.execute({ query: 'boots' }, { signal: invocation.signal });

    expect(result).toEqual({ input: { query: 'boots' }, signal: invocation.signal });
    expect(execute).toHaveBeenCalledWith(
      { query: 'boots' },
      expect.objectContaining({ signal: invocation.signal, invocationId: expect.any(String) }),
    );
  });

  it('does not enter application code for an already-cancelled invocation', async () => {
    const context = new FakeModelContext();
    const execute = vi.fn(() => 'should not run');
    const client = createSiteverb({ modelContext: context });
    const registration = client.registerTool({ ...searchTool(), execute });
    await registration.ready;
    const controller = new AbortController();
    controller.abort(new DOMException('Cancelled before dispatch.', 'AbortError'));

    await expect(
      context.registrations
        .get('search_products')
        ?.tool.execute({ query: 'boots' }, { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(execute).not.toHaveBeenCalled();
  });

  it('supplies a fallback signal when Chrome omits callback options', async () => {
    const context = new FakeModelContext();
    const client = createSiteverb({ modelContext: context });
    const registration = client.registerTool(searchTool());
    await registration.ready;

    const native = context.registrations.get('search_products')?.tool;
    const result = await native?.execute(
      { query: 'boots' },
      undefined as unknown as { signal: AbortSignal },
    );

    expect(result).toEqual({ query: 'boots', aborted: false });
  });

  it('returns an honest unsupported result without throwing during SSR', async () => {
    const client = createSiteverb({ modelContext: () => undefined });
    const registration = client.registerTool(searchTool());

    await expect(registration.ready).resolves.toEqual({
      id: 'catalog.search-products',
      name: 'search_products',
      status: 'unsupported',
    });
    expect(registration.status).toBe('unsupported');
    expect(client.supported).toBe(false);
  });

  it('unregisters idempotently through AbortSignal', async () => {
    const context = new FakeModelContext();
    const client = createSiteverb({ modelContext: context });
    const registration = client.registerTool(searchTool());
    await registration.ready;

    registration.unregister();
    registration.unregister();

    expect(registration.status).toBe('unregistered');
    expect(registration.signal.aborted).toBe(true);
    expect(context.registrations.size).toBe(0);
  });

  it('rolls back an atomic batch when one native registration fails', async () => {
    const context = new FakeModelContext();
    context.failName = 'checkout';
    const client = createSiteverb({ modelContext: context });
    const batch = client.registerTools([
      searchTool(),
      {
        id: 'cart.checkout',
        name: 'checkout',
        description: 'Prepare checkout.',
        execute: () => undefined,
      },
    ]);

    await expect(batch.ready).rejects.toThrow('Registration failed: checkout');
    expect(batch.signal.aborted).toBe(true);
    expect(context.registrations.size).toBe(0);
  });

  it('prevalidates an atomic batch before touching the native context', () => {
    const context = new FakeModelContext();
    const client = createSiteverb({ modelContext: context });

    expect(() =>
      client.registerTools([
        searchTool(),
        {
          id: 'invalid',
          name: 'invalid tool name',
          description: 'Invalid.',
          execute: () => undefined,
        },
      ]),
    ).toThrow(/dot-namespaced stable key/);
    expect(context.registrations.size).toBe(0);
    expect(client.snapshot().tools).toEqual([]);
  });

  it('detaches a batch listener from its caller-owned signal on unregister', async () => {
    const context = new FakeModelContext();
    const client = createSiteverb({ modelContext: context });
    const controller = new AbortController();
    const removeListener = vi.spyOn(controller.signal, 'removeEventListener');
    const batch = client.registerTools([searchTool()], { signal: controller.signal });
    await batch.ready;

    batch.unregister();

    expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(context.registrations.size).toBe(0);
  });

  it('does not touch native registration for a pre-cancelled batch signal', async () => {
    const context = new FakeModelContext();
    const registerTool = vi.spyOn(context, 'registerTool');
    const client = createSiteverb({ modelContext: context });
    const controller = new AbortController();
    controller.abort(new DOMException('Cancelled before registration.', 'AbortError'));

    const batch = client.registerTools([searchTool()], { signal: controller.signal });

    await expect(batch.ready).rejects.toMatchObject({ name: 'AbortError' });
    expect(registerTool).not.toHaveBeenCalled();
    expect(context.registrations.size).toBe(0);
  });

  it('rejects duplicate names while the first registration is pending', () => {
    const context = new FakeModelContext();
    const client = createSiteverb({ modelContext: context });
    client.registerTool(searchTool());

    expect(() =>
      client.registerTool({
        id: 'docs.search-products',
        name: 'search_products',
        description: 'Search product documentation.',
        execute: () => [],
      }),
    ).toThrow(/name "search_products" is already registered/);
  });

  it('cancels a pending standard registration without leaving native state', async () => {
    let finishRegistration: (() => void) | undefined;
    const context = new FakeModelContext();
    context.registerTool = async (tool, options) => {
      await new Promise<void>((resolve) => {
        finishRegistration = resolve;
      });
      if (options?.signal?.aborted) throw options.signal.reason;
      context.registrations.set(tool.name, { tool, ...(options === undefined ? {} : { options }) });
    };
    const client = createSiteverb({ modelContext: context });
    const registration = client.registerTool(searchTool());

    registration.unregister();
    finishRegistration?.();

    await expect(registration.ready).rejects.toMatchObject({ name: 'AbortError' });
    expect(context.registrations.size).toBe(0);
    expect(client.snapshot().tools).toEqual([]);
  });

  it('reports native tools that bypass the Siteverb facade', async () => {
    const context = new FakeModelContext();
    context.extraTools.push({ name: 'raw_tool', description: 'Registered elsewhere.' });
    const client = createSiteverb({ modelContext: context });
    const registration = client.registerTool(searchTool());
    await registration.ready;

    await expect(client.coverage()).resolves.toEqual({
      completeness: 0.5,
      discovered: ['raw_tool', 'search_products'],
      instrumented: ['search_products'],
      inventoryOnly: ['raw_tool'],
      missing: [],
      status: 'available',
    });
  });

  it('uses null completeness when neither surface contains tools', async () => {
    const client = createSiteverb({ modelContext: new FakeModelContext() });
    await expect(client.coverage()).resolves.toEqual({
      completeness: null,
      discovered: [],
      instrumented: [],
      inventoryOnly: [],
      missing: [],
      status: 'available',
    });
  });

  it('disposes repeatedly in unsupported server environments', () => {
    const client = createSiteverb({ modelContext: () => undefined });
    expect(() => client.dispose()).not.toThrow();
    expect(() => client.dispose()).not.toThrow();
  });
});
