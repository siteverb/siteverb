'use client';

import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createSiteverb, type SiteverbClient, type SiteverbOptions } from '@siteverb/webmcp';

const SiteverbContext = createContext<SiteverbClient | undefined>(undefined);

export interface SiteverbProviderProps {
  readonly children?: ReactNode;
  readonly client?: SiteverbClient;
  readonly options?: SiteverbOptions;
}

function OwnedSiteverbProvider({ children, options }: SiteverbProviderProps) {
  const initialOptions = useRef(options);
  const fallbackClient = useRef<SiteverbClient | undefined>(undefined);
  if (!fallbackClient.current) {
    fallbackClient.current = createSiteverb({ modelContext: () => undefined });
  }
  const [ownedClient, setOwnedClient] = useState<SiteverbClient | undefined>(undefined);

  useEffect(() => {
    let active = true;
    let created: SiteverbClient | undefined;
    queueMicrotask(() => {
      if (!active) return;
      created = createSiteverb(initialOptions.current);
      setOwnedClient(created);
    });
    return () => {
      active = false;
      created?.dispose();
    };
  }, []);

  return createElement(
    SiteverbContext.Provider,
    { value: ownedClient ?? fallbackClient.current },
    children,
  );
}

export function SiteverbProvider({ children, client, options }: SiteverbProviderProps) {
  if (client && options) throw new TypeError('Pass either client or options to SiteverbProvider.');
  if (client) return createElement(SiteverbContext.Provider, { value: client }, children);
  return createElement(OwnedSiteverbProvider, options === undefined ? {} : { options }, children);
}

export function useSiteverbClient(): SiteverbClient {
  const client = useContext(SiteverbContext);
  if (!client) throw new Error('useSiteverbClient must be used inside SiteverbProvider.');
  return client;
}
