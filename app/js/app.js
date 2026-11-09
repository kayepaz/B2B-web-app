// Entry point: routing, the header, and showing the right screen.
//
// Routes use the part of the URL after "#", so the app works on any static
// file server without special configuration:
//   #/login                     sample-user sign-in
//   #/                          all categories
//   #/reorder                   products the customer has ordered before
//   #/c/<categoryId>            subcategories in a category
//   #/c/<categoryId>/<subId>    products in a subcategory
//   #/p/<productId>             one product
//   #/cart                      the cart
//   #/checkout                  review and submit an Order Request
//   #/orders                    the customer's Order Requests
//   #/orders/<orderRequestId>   one Order Request
//   #/search/<words>            product search results
//   #/scan                      scan barcodes (camera, handheld or typed)
//   #/barcodes                  printable sample barcodes

import { h, showToast } from './dom.js';
import { getData } from './data.js';
import { currentCustomerId, signOut } from './session.js';
import { useCartFor, itemCount, onCartChange } from './cart.js';
import { onOrdersChange, sendQueued } from './orders.js';
import { startPwa } from './pwa.js';
import { listenForHandheldScanner, scanFeedback } from './scanner.js';
import { scanView } from './scanview.js';
import { plural } from './format.js';
import {
  loginView, categoriesView, reorderView, categoryView, subcategoryView, productView, cartView,
  checkoutView, ordersView, orderView, searchView, barcodeSheetView, notFoundView, errorView,
} from './views.js';

const APP_NAME = 'B2B Ordering Portal';
const main = document.getElementById('main');
const userArea = document.getElementById('user-area');
const searchArea = document.getElementById('search-area');

function parseRoute() {
  const path = location.hash.replace(/^#/, '') || '/';
  return path.split('/').filter(Boolean).map((part) => {
    try {
      return decodeURIComponent(part);
    } catch {
      return part; // a malformed link, e.g. a stray "%"
    }
  });
}

function cartLink() {
  const count = itemCount();
  return h('a', {
    class: 'cart-link',
    href: '#/cart',
    'aria-label': `Cart, ${plural(count, 'item')}`,
  },
  'Cart',
  h('span', { class: 'cart-count', 'aria-hidden': 'true' }, count.toLocaleString('en-CA')));
}

function searchForm() {
  const parts = parseRoute();
  const input = h('input', {
    type: 'search',
    id: 'search-input',
    name: 'q',
    placeholder: 'Search name, item number or UPC',
    'aria-label': 'Search products',
    autocomplete: 'off',
    value: parts[0] === 'search' ? (parts[1] ?? '') : '',
  });
  return h('form', {
    role: 'search',
    class: 'search-form',
    onsubmit: (event) => {
      event.preventDefault(); // handled here; nothing is sent anywhere
      const query = input.value.trim();
      if (query) location.hash = `#/search/${encodeURIComponent(query)}`;
    },
  }, input, h('button', { type: 'submit', class: 'search-button' }, 'Search'));
}

function renderHeader(data, customer) {
  if (!customer) {
    userArea.replaceChildren();
    searchArea.replaceChildren();
    return;
  }
  // Keep the search box (and what's being typed) unless the route changed it.
  const existing = searchArea.querySelector('#search-input');
  const parts = parseRoute();
  const routeQuery = parts[0] === 'search' ? (parts[1] ?? '') : '';
  if (!existing || (parts[0] === 'search' && existing.value !== routeQuery)) {
    searchArea.replaceChildren(searchForm());
  } else if (parts[0] !== 'search' && document.activeElement !== existing) {
    existing.value = '';
  }
  const company = data.companies.get(customer.companyId);
  userArea.replaceChildren(
    h('a', { class: 'header-link', href: '#/scan' }, 'Scan'),
    h('a', { class: 'header-link', href: '#/orders' },
      h('span', { class: 'long-label' }, 'Order Requests'),
      h('span', { class: 'short-label' }, 'Orders')),
    cartLink(),
    h('span', { class: 'signed-in-as' },
      h('span', { class: 'user-name' }, `${customer.firstName} ${customer.lastName}`),
      h('span', { class: 'user-company' }, company?.name ?? '')),
    h('button', {
      type: 'button',
      class: 'link-button',
      onclick: () => {
        signOut();
        location.hash = '#/login';
      },
    }, 'Sign out'));
}

// Returns a view, a promise of one, or null after a redirect.
function chooseView(data, parts, customer) {
  if (parts[0] === 'login') {
    if (customer) {
      location.replace('#/');
      return null;
    }
    return loginView(data);
  }

  if (!customer) {
    location.replace('#/login');
    return null;
  }

  if (parts.length === 0) return categoriesView(data, customer);
  if (parts[0] === 'reorder' && parts.length === 1) return reorderView(data, customer);

  if (parts[0] === 'c' && parts.length <= 3) {
    const category = data.categoriesById.get(parts[1]);
    if (!category) return notFoundView();
    if (parts.length === 2) return categoryView(data, category);
    const sub = data.subcategories.get(parts[2]);
    if (!sub || sub.category.id !== category.id) return notFoundView();
    return subcategoryView(data, category, sub);
  }

  if (parts[0] === 'p' && parts.length === 2) {
    const product = data.productsById.get(parts[1]);
    return product ? productView(data, product) : notFoundView();
  }

  if (parts[0] === 'scan' && parts.length === 1) return scanView(data);
  if (parts[0] === 'barcodes' && parts.length === 1) return barcodeSheetView(data);
  if (parts[0] === 'search' && parts.length <= 2) return searchView(data, parts[1] ?? '');
  if (parts[0] === 'cart' && parts.length === 1) return cartView(data);
  if (parts[0] === 'checkout' && parts.length === 1) return checkoutView(data, customer);
  if (parts[0] === 'orders' && parts.length === 1) return ordersView(data, customer);
  if (parts[0] === 'orders' && parts.length === 2) return orderView(data, customer, parts[1]);

  return notFoundView();
}

let firstRender = true;
let latestRender = 0;
let cleanUpCurrentView = null; // e.g. turns the camera off when leaving Scan

// moveFocus: after navigating, move focus to the new page's heading.
// It is false when the same page is redrawn (e.g. the cart changed).
async function render({ moveFocus = true } = {}) {
  const thisRender = ++latestRender;
  let view;
  try {
    const data = await getData();
    const customer = data.customersById.get(currentCustomerId()) ?? null;
    await useCartFor(customer?.id ?? null);
    renderHeader(data, customer);
    view = await chooseView(data, parseRoute(), customer);
    if (!view) return; // redirected; the hashchange will render again
  } catch (error) {
    console.error(error);
    view = errorView('The product data could not be loaded. '
      + 'If you are running the app locally, run "python3 tools/generate_data.py" first.');
  }

  // A newer render started while this one was loading; let it win.
  if (thisRender !== latestRender) return;

  // When redrawing in place, remember which control has focus (by its
  // data-key) so keyboard users don't lose their place. This is read just
  // before redrawing, after the browser has finished moving focus.
  const focusKey = moveFocus ? null : document.activeElement?.dataset?.key;

  document.title = `${view.title} – ${APP_NAME}`;
  if (cleanUpCurrentView) {
    try {
      cleanUpCurrentView();
    } catch (error) {
      console.warn(error);
    }
  }
  cleanUpCurrentView = view.cleanup ?? null;
  main.replaceChildren(view.content);

  if (focusKey) {
    const same = main.querySelector(`[data-key="${CSS.escape(focusKey)}"]`);
    if (same) same.focus();
    else focusHeading(); // e.g. the focused row was removed
  } else if (moveFocus) {
    window.scrollTo(0, 0);
    // Skipped on first load, where the browser's default is better.
    if (!firstRender) focusHeading();
  }
  firstRender = false;
}

function focusHeading() {
  const heading = main.querySelector('h1');
  if (heading) {
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  }
}

// Keep the header's cart count current, and redraw the cart page itself
// when its contents change.
onCartChange(async () => {
  const data = await getData();
  const customer = data.customersById.get(currentCustomerId()) ?? null;
  renderHeader(data, customer);
  if (parseRoute()[0] === 'cart') {
    // Wait one tick: a quantity change fires while focus is still moving
    // (e.g. on Tab), and the redraw needs to know where focus ended up.
    setTimeout(() => render({ moveFocus: false }), 0);
  }
});

// Redraw Order Request pages when a status changes (e.g. it was sent).
onOrdersChange(() => {
  if (parseRoute()[0] === 'orders') setTimeout(() => render({ moveFocus: false }), 0);
});

// A handheld scanner scan on any page (the Scan page handles its own).
listenForHandheldScanner(async (code) => {
  const data = await getData();
  if (!data.customersById.get(currentCustomerId())) {
    showToast('Sign in to look up scanned products.', 'error');
    return;
  }
  const product = data.productsByUpc.get(code);
  if (!product) {
    scanFeedback(false);
    showToast(`Barcode ${code} isn't in the catalogue.`, 'error');
    return;
  }
  scanFeedback(true);
  showToast(`Scanned: ${product.name}`, 'success');
  location.hash = `#/p/${encodeURIComponent(product.id)}`;
});

window.addEventListener('hashchange', () => render());
render();
sendQueued(); // send anything saved while offline last time
startPwa();
