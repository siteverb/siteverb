# Framework wiring

All patterns use one standard `@siteverb/webmcp` client and side-effect-free tool modules. Keep
registration in browser lifecycle code; never execute it during server rendering.

## Vanilla, Vite, and browser modules

```ts
import { createSiteverb } from '@siteverb/webmcp';
import { tools } from './tools.js';

const webmcp = createSiteverb();
const registration = webmcp.registerTools(tools);
addEventListener('pagehide', () => webmcp.dispose(), { once: true });
await registration.ready;
```

For a multi-page app, include the entry in the shared layout and define only tools valid for that
document. For a static site without a package resolver, vendor the pinned single-file
`@siteverb/webmcp/browser` build into the site; never load a mutable `latest` CDN URL in production.

## React and Vite

Prefer `@siteverb/react` when adding a new React or Next.js integration. It preserves committed
callback freshness and handles Strict Mode cleanup:

```tsx
import { SiteverbProvider, useSiteverbTools } from '@siteverb/react';
import { tools } from './tools';

export function SiteverbRegistrar() {
  useSiteverbTools(tools);
  return null;
}

export function AgentSurface() {
  return (
    <SiteverbProvider>
      <SiteverbRegistrar />
    </SiteverbProvider>
  );
}
```

Mount it under the application root. Route-specific tools belong in route components or a registrar
whose lifecycle follows the router state. Tool callbacks should call stable stores/data modules,
not capture stale render values. If a callback must read component-local state, read through a ref
updated after each committed render.

## Next.js App Router

The registrar must begin with `'use client'`. Mount global tools from `app/layout.tsx`; mount
route-specific registrars from the corresponding page/layout. Do not import server actions directly
into a browser tool unless Next already exposes that action safely to the client and its server-side
authorization is verified. Prefer the existing client data layer or same-origin route.

## Vue

Create tools outside component setup when they call stable stores. Register in `onMounted` and call
`registration.unregister()` in `onUnmounted`. Use route meta or route component lifetime for scoped
tools. Do not access `window` or `document` during SSR setup.

## Svelte and SvelteKit

Register in `onMount`; return the unregister function. Keep tool modules browser-safe. In SvelteKit,
guard client-only imports and use the page/layout that owns the route state. Server `load` functions
and private environment variables cannot enter tool modules.

## Angular

Use an injectable browser service or component that owns an `AbortController`/registration handle.
Register after platform-browser initialization and unregister in `ngOnDestroy`. For route-specific
tools, provide the registrar at the route/component scope. Keep authorization in the called backend
route, not an Angular guard alone.

## Dynamic state

When the valid surface changes, remove the old batch before registering the new one:

```ts
currentRegistration?.unregister();
currentRegistration = webmcp.registerTools(toolsForState(nextState));
await currentRegistration.ready;
```

Every callback still validates current state because registration is discoverability, not
enforcement. State can change between discovery and invocation.
