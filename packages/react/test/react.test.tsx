// @vitest-environment jsdom

import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createSiteverb } from '@siteverb/webmcp';
import { createMemoryModelContext, createMemoryTelemetryTransport } from '@siteverb/webmcp/testing';
import { SiteverbProvider, useSiteverbTool } from '../src/index.js';

afterEach(cleanup);

function Tool({ value }: { value: string }) {
  const state = useSiteverbTool({
    id: 'catalog.current-value',
    name: 'current_value',
    description: 'Read the current committed React value.',
    annotations: { readOnlyHint: true },
    execute: () => ({ value }),
  });
  return <span data-testid="status">{state.status}</span>;
}

function AbortableTool({ signal }: { signal: AbortSignal }) {
  const state = useSiteverbTool(
    {
      id: 'catalog.abortable-value',
      name: 'abortable_value',
      description: 'Read a value until the registration is cancelled.',
      annotations: { readOnlyHint: true },
      execute: () => ({ value: 'available' }),
    },
    { signal },
  );
  return <span data-testid="abort-status">{state.status}</span>;
}

describe('@siteverb/react', () => {
  it('registers once, reads the latest committed callback, and unregisters on unmount', async () => {
    const modelContext = createMemoryModelContext();
    const client = createSiteverb({ modelContext });
    const view = render(
      <StrictMode>
        <SiteverbProvider client={client}>
          <Tool value="first" />
        </SiteverbProvider>
      </StrictMode>,
    );

    await waitFor(() => expect(modelContext.registrations.size).toBe(1));
    await expect(modelContext.executeTool('current_value')).resolves.toEqual({ value: 'first' });

    view.rerender(
      <StrictMode>
        <SiteverbProvider client={client}>
          <Tool value="second" />
        </SiteverbProvider>
      </StrictMode>,
    );
    await expect(modelContext.executeTool('current_value')).resolves.toEqual({ value: 'second' });
    expect(modelContext.registrations.size).toBe(1);

    view.unmount();
    expect(modelContext.registrations.size).toBe(0);
  });

  it('fails clearly outside the provider', () => {
    expect(() => render(<Tool value="missing" />)).toThrow(/inside SiteverbProvider/);
  });

  it('creates one owned telemetry client after the Strict Mode probe', async () => {
    const modelContext = createMemoryModelContext();
    const transport = createMemoryTelemetryTransport();
    const view = render(
      <StrictMode>
        <SiteverbProvider
          options={{
            modelContext,
            siteId: 'site_public_react',
            telemetry: { maxBatchSize: 1, transport },
          }}
        >
          <Tool value="owned" />
        </SiteverbProvider>
      </StrictMode>,
    );

    await waitFor(() => expect(modelContext.registrations.size).toBe(1));
    await waitFor(() =>
      expect(
        transport.batches
          .flatMap((batch) => batch.events)
          .filter((event) => event.event === 'surface_loaded'),
      ).toHaveLength(1),
    );

    view.unmount();
    expect(modelContext.registrations.size).toBe(0);
  });

  it('renders owned-provider children during server rendering', () => {
    const html = renderToString(
      <SiteverbProvider>
        <Tool value="server-visible" />
      </SiteverbProvider>,
    );

    expect(html).toContain('pending');
  });

  it('reports external registration cancellation as unregistered', async () => {
    const modelContext = createMemoryModelContext();
    const client = createSiteverb({ modelContext });
    const controller = new AbortController();
    const view = render(
      <SiteverbProvider client={client}>
        <AbortableTool signal={controller.signal} />
      </SiteverbProvider>,
    );
    await waitFor(() => expect(view.getByTestId('abort-status').textContent).toBe('registered'));

    controller.abort();
    await waitFor(() => expect(view.getByTestId('abort-status').textContent).toBe('unregistered'));
    expect(modelContext.registrations.size).toBe(0);

    client.dispose();
  });

  it('creates a fresh owned client after switching through an external client', async () => {
    const ownedMemory = createMemoryModelContext();
    const externalMemory = createMemoryModelContext();
    let ownedRegistrationCalls = 0;
    const ownedContext = {
      ...ownedMemory,
      async registerTool(...args: Parameters<typeof ownedMemory.registerTool>) {
        ownedRegistrationCalls += 1;
        return ownedMemory.registerTool(...args);
      },
    };
    const externalClient = createSiteverb({ modelContext: externalMemory });
    const view = render(
      <SiteverbProvider options={{ modelContext: ownedContext }}>
        <Tool value="owned-first" />
      </SiteverbProvider>,
    );
    await waitFor(() => expect(ownedMemory.registrations.size).toBe(1));

    view.rerender(
      <SiteverbProvider client={externalClient}>
        <Tool value="external" />
      </SiteverbProvider>,
    );
    await waitFor(() => {
      expect(ownedMemory.registrations.size).toBe(0);
      expect(externalMemory.registrations.size).toBe(1);
    });

    view.rerender(
      <SiteverbProvider options={{ modelContext: ownedContext }}>
        <Tool value="owned-second" />
      </SiteverbProvider>,
    );
    await waitFor(() => {
      expect(externalMemory.registrations.size).toBe(0);
      expect(ownedMemory.registrations.size).toBe(1);
    });
    expect(ownedRegistrationCalls).toBe(2);

    view.unmount();
    externalClient.dispose();
  });
});
