import type {
  DomExpectation,
  JourneyContract,
  ProjectContract,
  RunReport,
} from '@siteverb/contracts';
import type { ChromeReleaseChannel } from 'puppeteer-core';

export interface BrowserTool {
  readonly name: string;
}

export interface BrowserToolResult {
  readonly error?: string;
  readonly output?: unknown;
  readonly status: 'completed' | 'error';
}

export interface BrowserPageAdapter {
  close(): Promise<void>;
  currentUrl(): string;
  executeTool(
    name: string,
    input: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<BrowserToolResult>;
  goto(url: string, timeoutMs: number): Promise<void>;
  inspectDom(expectation: DomExpectation): Promise<string | undefined>;
  listTools(): Promise<readonly BrowserTool[]>;
}

export interface BrowserAdapter {
  readonly channel: string;
  readonly name: string;
  readonly version: string;
  close(): Promise<void>;
  newPage(): Promise<BrowserPageAdapter>;
}

export interface LaunchBrowserOptions {
  readonly channel?: ChromeReleaseChannel;
  readonly executablePath?: string;
  readonly headless?: boolean;
  readonly includeErrorDetails?: boolean;
}

export interface RunProjectOptions extends LaunchBrowserOptions {
  readonly allowMutations?: boolean;
  readonly approvedTools?: readonly string[];
  readonly browser?: BrowserAdapter;
  readonly contract: ProjectContract;
  readonly journeyIds?: readonly string[];
  readonly profileIds?: readonly string[];
  readonly targetUrl: string;
  readonly timeoutMs?: number;
}

export interface RunJourneyContext {
  readonly allowMutations: boolean;
  readonly approvedTools: ReadonlySet<string>;
  readonly contract: ProjectContract;
  readonly journey: JourneyContract;
  readonly page: BrowserPageAdapter;
  readonly includeErrorDetails: boolean;
  readonly targetUrl: string;
  readonly timeoutMs: number;
}

export type { RunReport };
