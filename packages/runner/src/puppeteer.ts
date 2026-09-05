import puppeteer, {
  type Browser,
  type ChromeReleaseChannel,
  type Page,
  type WebMCPTool,
} from 'puppeteer-core';
import type { DomExpectation } from '@siteverb/contracts';
import type {
  BrowserAdapter,
  BrowserPageAdapter,
  BrowserToolResult,
  LaunchBrowserOptions,
} from './types.js';

function browserName(version: string): string {
  return version.split('/')[0] || 'Chrome';
}

function browserVersion(version: string): string {
  return version.split('/')[1] || version;
}

function executionError(result: Awaited<ReturnType<WebMCPTool['execute']>>): string {
  if (result.errorText?.trim()) return result.errorText.trim();
  if (result.exception?.description?.trim()) return result.exception.description.trim();
  return 'The browser reported a WebMCP execution error without details.';
}

class PuppeteerPageAdapter implements BrowserPageAdapter {
  readonly #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async close(): Promise<void> {
    await this.#page.close();
  }

  currentUrl(): string {
    return this.#page.url();
  }

  async executeTool(
    name: string,
    input: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<BrowserToolResult> {
    const tool = this.#page.webmcp.tools().find((candidate) => candidate.name === name);
    if (!tool) return { status: 'error', error: `WebMCP tool "${name}" is unavailable.` };
    const result = await tool.execute(input, signal ? { signal } : undefined);
    if (result.status === 'Completed') return { status: 'completed', output: result.output };
    return { status: 'error', error: executionError(result) };
  }

  async goto(url: string, timeoutMs: number): Promise<void> {
    await this.#page.goto(url, { timeout: timeoutMs, waitUntil: 'networkidle2' });
  }

  async inspectDom(expectation: DomExpectation): Promise<string | undefined> {
    const element = await this.#page.$(expectation.selector);
    if (expectation.state === 'detached') {
      return element ? `Expected "${expectation.selector}" to be detached.` : undefined;
    }
    if (!element) return `Expected "${expectation.selector}" to be attached.`;

    if (expectation.state === 'visible' && !(await element.isVisible())) {
      return `Expected "${expectation.selector}" to be visible.`;
    }
    if (expectation.state === 'hidden' && !(await element.isHidden())) {
      return `Expected "${expectation.selector}" to be hidden.`;
    }

    if (expectation.textContains !== undefined) {
      const text = await element.evaluate((node) => node.textContent ?? '');
      if (!text.includes(expectation.textContains)) {
        return `Expected "${expectation.selector}" text to contain the configured value.`;
      }
    }
    if (expectation.attribute) {
      const actual = await element.evaluate(
        (node, name) => node.getAttribute(name),
        expectation.attribute.name,
      );
      if (actual !== expectation.attribute.equals) {
        return `Expected "${expectation.selector}" attribute "${expectation.attribute.name}" to equal the configured value.`;
      }
    }
    return undefined;
  }

  async listTools() {
    return this.#page.webmcp.tools().map((tool) => ({ name: tool.name }));
  }
}

class PuppeteerBrowserAdapter implements BrowserAdapter {
  readonly #browser: Browser;
  readonly channel: string;
  readonly name: string;
  readonly version: string;

  private constructor(browser: Browser, channel: string, version: string) {
    this.#browser = browser;
    this.channel = channel;
    this.name = browserName(version);
    this.version = browserVersion(version);
  }

  static async launch(options: LaunchBrowserOptions = {}): Promise<PuppeteerBrowserAdapter> {
    const channel: ChromeReleaseChannel = options.channel ?? 'chrome';
    const browser = await puppeteer.launch({
      browser: 'chrome',
      channel,
      headless: options.headless ?? true,
      ...(options.executablePath === undefined ? {} : { executablePath: options.executablePath }),
      args: [
        '--enable-experimental-web-platform-features',
        '--enable-features=WebMCPTesting,DevToolsWebMCPSupport',
      ],
    });
    return new PuppeteerBrowserAdapter(browser, channel, await browser.version());
  }

  async close(): Promise<void> {
    await this.#browser.close();
  }

  async newPage(): Promise<BrowserPageAdapter> {
    return new PuppeteerPageAdapter(await this.#browser.newPage());
  }
}

export async function launchBrowser(options: LaunchBrowserOptions = {}): Promise<BrowserAdapter> {
  return PuppeteerBrowserAdapter.launch(options);
}
