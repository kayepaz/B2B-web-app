// Entry point: routing, the header, and showing the right screen.
//
// Routes use the part of the URL after "#", so the app works on any static
// file server without special configuration:
//   #/login                     sample-user sign-in
//   #/                          all categories
//   #/c/<categoryId>            subcategories in a category
//   #/c/<categoryId>/<subId>    products in a subcategory
//   #/p/<productId>             one product
//   #/cart                      the cart

import { h } from './dom.js';
import { getData } from './data.js';
import { currentCustomerId, signOut } from './session.js';
import { useCartFor, itemCount, onCartChange } from './cart.js';
import { plural } from './format.js';
import {
  loginView, categoriesView, categoryView, subcategoryView, productView, cartView,
  notFoundView, errorView,
} from './views.js';

const APP_NAME = 'B2B Ordering Portal';
const main = document.getElementById('main');
const userArea = document.getElementById('user-area');

function parseRoute() {
  const path = location.hash.replace(/^#/, '') || '/';
  return path.split('/').filter(Boolean).map(decodeURIComponent);
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

function renderHeader(data, customer) {
  if (!customer) {
    userArea.replaceChildren();
    return;
  }
  const company = data.companies.get(customer.companyId);
  userArea.replaceChildren(
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

  if (parts.length === 0) return categoriesView(data);

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

  if (parts[0] === 'cart' && parts.length === 1) return cartView(data);

  return notFoundView();
}

let firstRender = true;

// moveFocus: after navigating, move focus to the new page's heading.
// It is false when the same page is redrawn (e.g. the cart changed).
async function render({ moveFocus = true } = {}) {
  let view;
  try {
    const data = await getData();
    const customer = data.customersById.get(currentCustomerId()) ?? null;
    await useCartFor(customer?.id ?? null);
    renderHeader(data, customer);
    view = chooseView(data, parseRoute(), customer);
    if (!view) return; // redirected; the hashchange will render again
  } catch (error) {
    console.error(error);
    view = errorView('The product data could not be loaded. '
      + 'If you are running the app locally, run "python3 tools/generate_data.py" first.');
  }

  // When redrawing in place, remember which control has focus (by its
  // data-key) so keyboard users don't lose their place. This is read just
  // before redrawing, after the browser has finished moving focus.
  const focusKey = moveFocus ? null : document.activeElement?.dataset?.key;

  document.title = `${view.title} – ${APP_NAME}`;
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

window.addEventListener('hashchange', () => render());
render();
