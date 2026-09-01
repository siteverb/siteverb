export type JsonPrimitive = boolean | null | number | string;

export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type JsonSchema = Readonly<Record<string, unknown>>;

export interface WebMcpToolAnnotations {
  readonly readOnlyHint?: boolean;
  readonly untrustedContentHint?: boolean;
}

export interface NativeToolExecutionOptions {
  readonly signal: AbortSignal;
}

export interface NativeModelContextTool {
  readonly name: string;
  readonly title?: string;
  readonly description: string;
  readonly inputSchema?: object;
  readonly annotations?: WebMcpToolAnnotations;
  readonly execute: (
    input: Record<string, unknown>,
    options: NativeToolExecutionOptions,
  ) => unknown | PromiseLike<unknown>;
}

export interface NativeRegisteredTool {
  readonly name: string;
  readonly title?: string;
  readonly description: string;
  readonly inputSchema?: object;
  readonly annotations?: WebMcpToolAnnotations;
  readonly origin?: string;
  readonly window?: Window;
}

export interface NativeRegisterToolOptions {
  readonly exposedTo?: string[];
  readonly signal?: AbortSignal;
}

export interface NativeModelContext {
  registerTool(tool: NativeModelContextTool, options?: NativeRegisterToolOptions): Promise<void>;
  getTools?(): Promise<readonly NativeRegisteredTool[]>;
}

export interface SiteverbToolExecutionContext extends NativeToolExecutionOptions {
  readonly invocationId: string;
}

export interface SiteverbToolDefinition<
  TInput extends object = Record<string, unknown>,
  TResult = unknown,
> {
  readonly id: string;
  readonly name: string;
  readonly title?: string;
  readonly description: string;
  readonly inputSchema?: JsonSchema;
  readonly annotations?: WebMcpToolAnnotations;
  readonly execute: (
    input: TInput,
    context: SiteverbToolExecutionContext,
  ) => TResult | PromiseLike<TResult>;
}

declare const definedToolBrand: unique symbol;

export type DefinedSiteverbTool<
  TInput extends object = Record<string, unknown>,
  TResult = unknown,
> = Readonly<SiteverbToolDefinition<TInput, TResult>> & {
  readonly [definedToolBrand]: true;
};

export type AnySiteverbTool = SiteverbToolDefinition<any, any> | DefinedSiteverbTool<any, any>;

export type ToolDiagnosticCode =
  | 'description-budget'
  | 'invalid-annotations'
  | 'invalid-description'
  | 'invalid-execute'
  | 'invalid-input-schema'
  | 'invalid-stable-id'
  | 'invalid-title'
  | 'invalid-tool-name'
  | 'parameter-description-budget'
  | 'tool-name-budget';

export interface ToolDiagnostic {
  readonly code: ToolDiagnosticCode;
  readonly message: string;
  readonly path: string;
  readonly severity: 'error' | 'warning';
}

export interface RegisterToolOptions {
  readonly exposedTo?: readonly string[];
  readonly signal?: AbortSignal;
}

export type RegistrationStatus =
  'pending' | 'registered' | 'unsupported' | 'unregistered' | 'failed';

export interface RegistrationResult {
  readonly id: string;
  readonly name: string;
  readonly status: Extract<RegistrationStatus, 'registered' | 'unsupported'>;
}

export interface RegistrationHandle {
  readonly id: string;
  readonly name: string;
  readonly ready: Promise<RegistrationResult>;
  readonly signal: AbortSignal;
  readonly status: RegistrationStatus;
  unregister(reason?: unknown): void;
}

export interface RegisterToolsOptions extends RegisterToolOptions {
  readonly atomic?: boolean;
}

export interface BatchRegistrationHandle {
  readonly handles: readonly RegistrationHandle[];
  readonly ready: Promise<readonly RegistrationResult[]>;
  readonly signal: AbortSignal;
  unregister(reason?: unknown): void;
}

export interface SiteverbOptions {
  readonly environment?: string;
  readonly modelContext?: NativeModelContext | (() => NativeModelContext | undefined);
  readonly onDiagnostic?: (diagnostic: SiteverbDiagnostic) => void;
  readonly release?: string;
  readonly routeTemplate?: string | (() => string | undefined);
  readonly siteId?: string;
  readonly telemetry?: false | TelemetryOptions;
}

export interface RegisteredToolSnapshot {
  readonly id: string;
  readonly name: string;
  readonly status: RegistrationStatus;
}

export interface RuntimeSnapshot {
  readonly environment?: string;
  readonly release?: string;
  readonly siteId?: string;
  readonly supported: boolean;
  readonly telemetry: TelemetryStatus;
  readonly tools: readonly RegisteredToolSnapshot[];
}

export interface CoverageSnapshot {
  readonly completeness: number | null;
  readonly discovered: readonly string[];
  readonly instrumented: readonly string[];
  readonly inventoryOnly: readonly string[];
  readonly missing: readonly string[];
  readonly status: 'available' | 'unavailable';
}

export interface SiteverbClient {
  readonly supported: boolean;
  readonly telemetry: TelemetryStatus;
  registerTool<TInput extends object, TResult>(
    tool: SiteverbToolDefinition<TInput, TResult> | DefinedSiteverbTool<TInput, TResult>,
    options?: RegisterToolOptions,
  ): RegistrationHandle;
  registerTools(
    tools: readonly AnySiteverbTool[],
    options?: RegisterToolsOptions,
  ): BatchRegistrationHandle;
  coverage(): Promise<CoverageSnapshot>;
  dispose(reason?: unknown): void;
  flush(): Promise<void>;
  snapshot(): RuntimeSnapshot;
}

export type SiteverbDiagnosticCode =
  | 'coverage-unavailable'
  | 'telemetry-dropped'
  | 'telemetry-route-template-invalid'
  | 'telemetry-send-failed';

export interface SiteverbDiagnostic {
  readonly cause?: unknown;
  readonly code: SiteverbDiagnosticCode;
  readonly message: string;
  readonly severity: 'warning';
}

export type TelemetryEventName =
  | 'surface_loaded'
  | 'tool_registered'
  | 'tool_unregistered'
  | 'tool_registration_cancelled'
  | 'tool_registration_failed'
  | 'tool_call_started'
  | 'tool_call_completed'
  | 'tool_call_failed'
  | 'tool_call_cancelled';

export type TelemetryErrorClass =
  'abort' | 'network' | 'not-found' | 'permission' | 'timeout' | 'validation' | 'unknown';

export interface TelemetryToolIdentity {
  readonly schemaHash: string;
  readonly stableKey: string;
  readonly wireName: string;
}

export interface SiteverbTelemetryEvent {
  readonly dataClass: 'production';
  readonly durationMs?: number;
  readonly environment?: string;
  readonly errorClass?: TelemetryErrorClass;
  readonly event: TelemetryEventName;
  readonly eventId: string;
  readonly eventIndex: number;
  readonly invocationId?: string;
  readonly occurredAt: string;
  readonly pageSessionId: string;
  readonly release?: string;
  readonly routeTemplate?: string;
  readonly sequenceIndex?: number;
  readonly tool?: TelemetryToolIdentity;
  readonly webmcpSupported?: boolean;
}

export interface TelemetryBatch {
  readonly batchId: string;
  readonly events: readonly SiteverbTelemetryEvent[];
  readonly protocolVersion: 1;
  readonly sdkVersion: string;
  readonly sentAt: string;
  readonly siteId: string;
}

export type TelemetryFlushReason = 'interval' | 'lifecycle' | 'manual' | 'size';

export interface TelemetryTransport {
  send(batch: TelemetryBatch, reason: TelemetryFlushReason): Promise<void> | void;
}

export interface TelemetryOptions {
  readonly endpoint?: string;
  readonly flushIntervalMs?: number;
  readonly maxBatchSize?: number;
  readonly maxQueueSize?: number;
  readonly maxRetryAttempts?: number;
  readonly retryMaxDelayMs?: number;
  readonly transport?: TelemetryTransport;
}

export interface TelemetryStatus {
  readonly autoRetryPaused: boolean;
  readonly consecutiveFailures: number;
  readonly droppedEvents: number;
  readonly enabled: boolean;
  readonly pendingEvents: number;
}
