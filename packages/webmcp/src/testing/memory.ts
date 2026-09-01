import type {
  NativeModelContext,
  NativeModelContextTool,
  NativeRegisterToolOptions,
  NativeRegisteredTool,
  TelemetryBatch,
  TelemetryFlushReason,
  TelemetryTransport,
} from '../types.js';

export interface MemoryModelContext extends NativeModelContext {
  readonly registrations: ReadonlyMap<string, NativeModelContextTool>;
  addUninstrumentedTool(tool: NativeRegisteredTool): void;
  executeTool(
    name: string,
    input?: Record<string, unknown>,
    options?: { readonly signal?: AbortSignal },
  ): Promise<unknown>;
}

export function createMemoryModelContext(): MemoryModelContext {
  const registrations = new Map<string, NativeModelContextTool>();
  const uninstrumented = new Map<string, NativeRegisteredTool>();

  return {
    registrations,
    async registerTool(
      tool: NativeModelContextTool,
      options?: NativeRegisterToolOptions,
    ): Promise<void> {
      if (registrations.has(tool.name) || uninstrumented.has(tool.name)) {
        throw new DOMException(`Tool "${tool.name}" is already registered.`, 'InvalidStateError');
      }
      if (options?.signal?.aborted) throw options.signal.reason;
      registrations.set(tool.name, tool);
      options?.signal?.addEventListener('abort', () => registrations.delete(tool.name), {
        once: true,
      });
    },
    async getTools(): Promise<readonly NativeRegisteredTool[]> {
      return [
        ...Array.from(registrations.values(), (tool) => ({
          name: tool.name,
          title: tool.title ?? '',
          description: tool.description,
          ...(tool.inputSchema === undefined ? {} : { inputSchema: tool.inputSchema }),
          ...(tool.annotations === undefined ? {} : { annotations: tool.annotations }),
        })),
        ...uninstrumented.values(),
      ].sort((left, right) => left.name.localeCompare(right.name));
    },
    addUninstrumentedTool(tool: NativeRegisteredTool): void {
      uninstrumented.set(tool.name, tool);
    },
    async executeTool(
      name: string,
      input: Record<string, unknown> = {},
      options: { readonly signal?: AbortSignal } = {},
    ): Promise<unknown> {
      const tool = registrations.get(name);
      if (!tool) throw new DOMException(`Tool "${name}" was not found.`, 'NotFoundError');
      const controller = new AbortController();
      const onAbort = () => controller.abort(options.signal?.reason);
      if (options.signal?.aborted) onAbort();
      else options.signal?.addEventListener('abort', onAbort, { once: true });
      try {
        return await tool.execute(input, { signal: controller.signal });
      } finally {
        options.signal?.removeEventListener('abort', onAbort);
      }
    },
  };
}

export interface MemoryTelemetryTransport extends TelemetryTransport {
  readonly batches: readonly TelemetryBatch[];
  readonly reasons: readonly TelemetryFlushReason[];
  failWith(error: unknown): void;
  recover(): void;
}

export function createMemoryTelemetryTransport(): MemoryTelemetryTransport {
  const batches: TelemetryBatch[] = [];
  const reasons: TelemetryFlushReason[] = [];
  let failure: unknown;

  return {
    batches,
    reasons,
    send(batch, reason): void {
      if (failure !== undefined) throw failure;
      batches.push(batch);
      reasons.push(reason);
    },
    failWith(error): void {
      failure = error;
    },
    recover(): void {
      failure = undefined;
    },
  };
}
