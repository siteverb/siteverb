'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type {
  AnySiteverbTool,
  RegisterToolOptions,
  RegisterToolsOptions,
  RegistrationStatus,
  SiteverbToolDefinition,
} from '@siteverb/webmcp';
import { useSiteverbClient } from './context.js';

const useCommittedLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export interface UseSiteverbRegistrationOptions extends RegisterToolOptions {
  readonly enabled?: boolean;
  readonly onError?: (error: unknown) => void;
}

export interface UseSiteverbBatchOptions extends RegisterToolsOptions {
  readonly enabled?: boolean;
  readonly onError?: (error: unknown) => void;
}

export interface SiteverbRegistrationState {
  readonly error: unknown;
  readonly status: RegistrationStatus;
}

function metadataKey(tools: readonly AnySiteverbTool[]): string {
  return JSON.stringify(
    tools.map(({ id, name, title, description, inputSchema, annotations }) => ({
      id,
      name,
      title,
      description,
      inputSchema,
      annotations,
    })),
  );
}

export function useSiteverbTool<TInput extends object, TResult>(
  definition: SiteverbToolDefinition<TInput, TResult>,
  options: UseSiteverbRegistrationOptions = {},
): SiteverbRegistrationState {
  const client = useSiteverbClient();
  const definitionRef = useRef(definition);
  const onErrorRef = useRef(options.onError);
  const [state, setState] = useState<SiteverbRegistrationState>({
    error: undefined,
    status: options.enabled === false ? 'unregistered' : 'pending',
  });
  const key = metadataKey([definition]);
  const exposedToKey = JSON.stringify(options.exposedTo ?? []);

  useCommittedLayoutEffect(() => {
    definitionRef.current = definition;
    onErrorRef.current = options.onError;
  });

  useEffect(() => {
    if (options.enabled === false) {
      setState({ error: undefined, status: 'unregistered' });
      return;
    }
    let active = true;
    setState({ error: undefined, status: 'pending' });
    const wrappedDefinition: SiteverbToolDefinition<TInput, TResult> = {
      ...definition,
      execute: (input: TInput, context) => definitionRef.current.execute(input, context),
    };
    const registration = client.registerTool(wrappedDefinition, {
      ...(options.signal === undefined ? {} : { signal: options.signal }),
      ...(options.exposedTo === undefined ? {} : { exposedTo: options.exposedTo }),
    });
    const onExternalAbort = () => {
      if (active) setState({ error: undefined, status: 'unregistered' });
    };
    options.signal?.addEventListener('abort', onExternalAbort, { once: true });
    void registration.ready
      .then((result) => {
        if (active) setState({ error: undefined, status: result.status });
      })
      .catch((error: unknown) => {
        if (options.signal?.aborted) {
          if (active) setState({ error: undefined, status: 'unregistered' });
          return;
        }
        onErrorRef.current?.(error);
        if (active) setState({ error, status: 'failed' });
      });
    return () => {
      active = false;
      options.signal?.removeEventListener('abort', onExternalAbort);
      registration.unregister();
    };
  }, [client, key, exposedToKey, options.enabled, options.signal]);

  return state;
}

export function useSiteverbTools(
  definitions: readonly AnySiteverbTool[],
  options: UseSiteverbBatchOptions = {},
): SiteverbRegistrationState {
  const client = useSiteverbClient();
  const definitionsRef = useRef(definitions);
  const onErrorRef = useRef(options.onError);
  const [state, setState] = useState<SiteverbRegistrationState>({
    error: undefined,
    status: options.enabled === false ? 'unregistered' : 'pending',
  });
  const key = metadataKey(definitions);
  const exposedToKey = JSON.stringify(options.exposedTo ?? []);

  useCommittedLayoutEffect(() => {
    definitionsRef.current = definitions;
    onErrorRef.current = options.onError;
  });

  useEffect(() => {
    if (options.enabled === false) {
      setState({ error: undefined, status: 'unregistered' });
      return;
    }
    let active = true;
    setState({ error: undefined, status: 'pending' });
    const wrappers = definitions.map((definition) => ({
      ...definition,
      execute: (input: object, context: Parameters<AnySiteverbTool['execute']>[1]) => {
        const latest = definitionsRef.current.find((tool) => tool.id === definition.id);
        if (!latest) throw new Error(`Siteverb tool "${definition.id}" is no longer available.`);
        return latest.execute(input, context);
      },
    })) as readonly AnySiteverbTool[];
    const registration = client.registerTools(wrappers, {
      ...(options.signal === undefined ? {} : { signal: options.signal }),
      ...(options.exposedTo === undefined ? {} : { exposedTo: options.exposedTo }),
      ...(options.atomic === undefined ? {} : { atomic: options.atomic }),
    });
    const onExternalAbort = () => {
      if (active) setState({ error: undefined, status: 'unregistered' });
    };
    options.signal?.addEventListener('abort', onExternalAbort, { once: true });
    void registration.ready
      .then((results) => {
        if (!active) return;
        const unsupported = results.some((result) => result.status === 'unsupported');
        setState({ error: undefined, status: unsupported ? 'unsupported' : 'registered' });
      })
      .catch((error: unknown) => {
        if (options.signal?.aborted) {
          if (active) setState({ error: undefined, status: 'unregistered' });
          return;
        }
        onErrorRef.current?.(error);
        if (active) setState({ error, status: 'failed' });
      });
    return () => {
      active = false;
      options.signal?.removeEventListener('abort', onExternalAbort);
      registration.unregister();
    };
  }, [client, key, exposedToKey, options.atomic, options.enabled, options.signal]);

  return state;
}
