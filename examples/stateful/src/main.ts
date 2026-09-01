import {
  createSiteverb,
  defineTool,
  type AnySiteverbTool,
  type BatchRegistrationHandle,
} from '@siteverb/webmcp';

const catalog = [
  { sku: 'trail-shoe-11', name: 'Trail shoe', size: 11, price: 140 },
  { sku: 'rain-jacket-m', name: 'Rain jacket', size: 'M', price: 110 },
] as const;
let cart: (typeof catalog)[number][] = [];
let phase: 'catalog' | 'results' | 'cart' | 'checkout' = 'catalog';

const phaseElement = document.querySelector<HTMLElement>('#phase');
const resultsElement = document.querySelector<HTMLUListElement>('#results');
const cartElement = document.querySelector<HTMLUListElement>('#cart');
const checkoutElement = document.querySelector<HTMLElement>('#checkout');
const checkoutSummary = document.querySelector<HTMLElement>('#checkout-summary');

function rows(items: readonly (typeof catalog)[number][]) {
  return items.map((item) => {
    const row = document.createElement('li');
    row.dataset.sku = item.sku;
    row.textContent = `${item.name} · size ${item.size} · $${item.price}`;
    return row;
  });
}

function render(): void {
  phaseElement && (phaseElement.textContent = phase);
  cartElement?.replaceChildren(...rows(cart));
  if (checkoutElement) checkoutElement.hidden = phase !== 'checkout';
  if (checkoutSummary) {
    checkoutSummary.textContent =
      phase === 'checkout' ? `${cart.length} item ready for human confirmation` : '';
  }
}

const searchProducts = defineTool({
  id: 'catalog.search-products',
  name: 'search_products',
  description: 'Search the visible catalog by product name, size, and maximum price.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Words in the product name.' },
      size: { type: 'number', description: 'Required product size.' },
      maxPrice: { type: 'number', description: 'Maximum price in US dollars.' },
    },
    required: ['query'],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true },
  execute: ({ query, size, maxPrice }: { query: string; size?: number; maxPrice?: number }) => {
    const matches = catalog.filter(
      (item) =>
        item.name.toLowerCase().includes(query.toLowerCase()) &&
        (size === undefined || item.size === size) &&
        (maxPrice === undefined || item.price <= maxPrice),
    );
    resultsElement?.replaceChildren(...rows(matches));
    schedulePhase('results');
    return { count: matches.length, products: matches };
  },
});

const addToCart = defineTool({
  id: 'cart.add-item',
  name: 'add_to_cart',
  description: 'Add one in-stock catalog product to the current cart.',
  inputSchema: {
    type: 'object',
    properties: { sku: { type: 'string', description: 'Exact catalog SKU.' } },
    required: ['sku'],
    additionalProperties: false,
  },
  execute: ({ sku }: { sku: string }) => {
    const product = catalog.find((item) => item.sku === sku);
    if (!product) throw new Error('Product is not available.');
    cart = [...cart, product];
    render();
    schedulePhase('cart');
    return { cartCount: cart.length, sku };
  },
});

const getCart = defineTool({
  id: 'cart.get-current',
  name: 'get_cart',
  description: 'Read the current cart contents and total price.',
  annotations: { readOnlyHint: true },
  execute: () => ({
    count: cart.length,
    items: cart.map(({ sku, name, size, price }) => ({ sku, name, size, price })),
    total: cart.reduce((sum, item) => sum + item.price, 0),
  }),
});

const prepareCheckout = defineTool({
  id: 'cart.prepare-checkout',
  name: 'prepare_checkout',
  description: 'Prepare a visible checkout review without purchasing or charging the user.',
  execute: () => {
    if (cart.length === 0) throw new Error('The cart is empty.');
    phase = 'checkout';
    render();
    schedulePhase('checkout');
    return { prepared: true, requiresHumanConfirmation: true };
  },
});

const getCheckoutSummary = defineTool({
  id: 'cart.get-checkout-summary',
  name: 'get_checkout_summary',
  description: 'Read the prepared checkout summary before the human confirmation step.',
  annotations: { readOnlyHint: true },
  execute: () => ({
    prepared: phase === 'checkout',
    itemCount: cart.length,
    total: cart.reduce((sum, item) => sum + item.price, 0),
  }),
});

const removeFromCart = defineTool({
  id: 'cart.remove-item',
  name: 'remove_from_cart',
  description: 'Remove every instance of a product SKU from the current cart.',
  inputSchema: {
    type: 'object',
    properties: { sku: { type: 'string', description: 'Exact cart SKU.' } },
    required: ['sku'],
    additionalProperties: false,
  },
  execute: ({ sku }: { sku: string }) => {
    cart = cart.filter((item) => item.sku !== sku);
    phase = 'catalog';
    render();
    schedulePhase('catalog');
    return { removed: true, cartCount: cart.length };
  },
});

const webmcp = createSiteverb();
let registration: BatchRegistrationHandle | undefined;

function toolsForPhase(next: typeof phase): readonly AnySiteverbTool[] {
  if (next === 'catalog') return [searchProducts];
  if (next === 'results') return [addToCart];
  if (next === 'cart') return [getCart, prepareCheckout, removeFromCart];
  return [getCart, getCheckoutSummary, removeFromCart];
}

function registerPhase(next: typeof phase): void {
  phase = next;
  registration?.unregister();
  registration = webmcp.registerTools(toolsForPhase(next));
  void registration.ready;
  render();
}

function schedulePhase(next: typeof phase): void {
  setTimeout(() => registerPhase(next), 0);
}

registerPhase('catalog');
addEventListener('pagehide', () => webmcp.dispose(), { once: true });
