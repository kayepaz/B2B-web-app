// One function per screen. Each returns { title, content }.

import { h, announce } from './dom.js';
import { formatPrice, formatDateTime, formatAddress, plural } from './format.js';
import { signIn } from './session.js';
import {
  addToCart, setQuantity, removeFromCart, clearCart, getItems, getQuantity, MAX_QUANTITY,
} from './cart.js';
import {
  submitOrderRequest, getOrderRequests, getOrderRequest, getPreviouslyOrdered, STATUS_LABELS,
} from './orders.js';
import { searchProducts } from './search.js';
import { upcBarcodeSvg } from './barcode.js';

function productHref(product) {
  return `#/p/${encodeURIComponent(product.id)}`;
}

function categoryTrail(data, product) {
  const category = data.categoriesById.get(product.categoryId);
  const sub = data.subcategories.get(product.subcategoryId);
  return [
    { label: 'Categories', href: '#/' },
    { label: category.name, href: `#/c/${encodeURIComponent(category.id)}` },
    {
      label: sub.name,
      href: `#/c/${encodeURIComponent(category.id)}/${encodeURIComponent(sub.id)}`,
    },
  ];
}

// "Add to cart" button. quantityFrom() supplies how many to add
// (it returns 0 if the entered quantity is invalid).
function addToCartButton(product, quantityFrom = () => 1) {
  if (product.status === 'Discontinued') {
    return h('p', { class: 'unavailable' }, 'No longer available');
  }
  const label = 'Add to cart';
  let resetTimer;
  const button = h('button', {
    type: 'button',
    class: 'primary-button',
    onclick: async () => {
      const quantity = quantityFrom();
      if (!quantity) return;
      await addToCart(product.id, quantity);
      announce(`Added ${quantity} × ${product.name} to the cart. `
        + `${getQuantity(product.id)} in cart.`);
      button.textContent = 'Added ✓';
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => { button.textContent = label; }, 1500);
    },
  }, label);
  return button;
}

// Reads a quantity input; shows a message and returns 0 if it's invalid.
function readQuantityFrom(input) {
  const value = Number(input.value);
  if (!Number.isInteger(value) || value < 1 || value > MAX_QUANTITY) {
    input.setCustomValidity(`Enter a whole number from 1 to ${MAX_QUANTITY.toLocaleString('en-CA')}.`);
    input.reportValidity();
    return 0;
  }
  input.setCustomValidity('');
  return value;
}

function quantityInput(attributes) {
  return h('input', {
    type: 'number',
    inputmode: 'numeric',
    min: 1,
    max: MAX_QUANTITY,
    step: 1,
    class: 'quantity-input',
    ...attributes,
  });
}

function breadcrumbs(items) {
  return h('nav', { class: 'breadcrumbs', 'aria-label': 'Breadcrumb' },
    h('ol', {},
      items.map((item, index) => h('li', {},
        index === items.length - 1
          ? h('span', { 'aria-current': 'page' }, item.label)
          : h('a', { href: item.href }, item.label)))));
}

// ---------------------------------------------------------------- Login

export function loginView(data) {
  const userButtons = data.customers.map((customer) => {
    const company = data.companies.get(customer.companyId);
    return h('li', {},
      h('button', {
        type: 'button',
        class: 'user-choice',
        onclick: () => {
          signIn(customer.id);
          location.hash = '#/';
        },
      },
      h('span', { class: 'user-name' }, `${customer.firstName} ${customer.lastName}`),
      h('span', { class: 'user-company' }, company?.name ?? '')));
  });

  return {
    title: 'Sign in',
    content: h('section', { class: 'login' },
      h('h1', {}, 'Sign in'),
      h('p', { class: 'notice' },
        'This will be an Entra SSO login in the future.'),
      h('p', {}, 'For now, choose a sample user:'),
      h('ul', { class: 'user-list' }, userButtons)),
  };
}

// ---------------------------------------------------------------- Categories

function firstImageInCategory(data, category) {
  const firstSub = category.subcategories[0];
  return data.productsBySubcategory.get(firstSub?.id)?.[0]?.image;
}

export async function categoriesView(data, customer) {
  const reorderCount = (await getPreviouslyOrdered(customer.id))
    .filter((item) => data.productsById.has(item.productId)).length;
  const reorderCard = h('li', {},
    h('a', { class: 'card card-reorder', href: '#/reorder' },
      h('img', { src: 'images/reorder.svg', alt: '', width: 200, height: 200 }),
      h('span', { class: 'card-title' }, 'Re-Order'),
      h('span', { class: 'card-meta' }, reorderCount
        ? `${plural(reorderCount, 'product')} you've ordered before`
        : 'Products you order will appear here')));

  const cards = data.categories.map((category) => {
    const image = firstImageInCategory(data, category);
    return h('li', {},
      h('a', { class: 'card', href: `#/c/${encodeURIComponent(category.id)}` },
        image ? h('img', { src: image, alt: '', width: 200, height: 200, loading: 'lazy' }) : null,
        h('span', { class: 'card-title' }, category.name),
        h('span', { class: 'card-meta' },
          `${plural(category.subcategories.length, 'subcategory', 'subcategories')} · `
          + plural(data.productCountByCategory.get(category.id) ?? 0, 'product'))));
  });

  return {
    title: 'Product categories',
    content: h('section', {},
      h('h1', {}, 'Product categories'),
      h('ul', { class: 'card-grid' }, reorderCard, cards)),
  };
}

// ---------------------------------------------------------------- Subcategories

export function categoryView(data, category) {
  const cards = category.subcategories.map((sub) => {
    const products = data.productsBySubcategory.get(sub.id) ?? [];
    const image = products[0]?.image;
    return h('li', {},
      h('a', {
        class: 'card',
        href: `#/c/${encodeURIComponent(category.id)}/${encodeURIComponent(sub.id)}`,
      },
      image ? h('img', { src: image, alt: '', width: 200, height: 200, loading: 'lazy' }) : null,
      h('span', { class: 'card-title' }, sub.name),
      h('span', { class: 'card-meta' }, plural(products.length, 'product'))));
  });

  return {
    title: category.name,
    content: h('section', {},
      breadcrumbs([
        { label: 'Categories', href: '#/' },
        { label: category.name },
      ]),
      h('h1', {}, category.name),
      h('ul', { class: 'card-grid' }, cards)),
  };
}

// ---------------------------------------------------------------- Products

function statusBadge(status) {
  if (status === 'Active') return null;
  return h('span', { class: `badge badge-${status.toLowerCase()}` }, status);
}

// reorder (optional): { lastOrderedAt, lastQuantity, timesOrdered } adds the
// order history and a quantity box filled in with the last quantity.
function productCard(product, reorder = null) {
  let quantityFrom;
  let quantityRow = null;
  if (reorder && product.status !== 'Discontinued') {
    const input = quantityInput({
      value: Math.min(reorder.lastQuantity, MAX_QUANTITY),
      'aria-label': `Quantity of ${product.name}`,
    });
    input.addEventListener('input', () => input.setCustomValidity(''));
    quantityFrom = () => readQuantityFrom(input);
    quantityRow = h('div', { class: 'card-add-row' },
      input, addToCartButton(product, quantityFrom));
  }

  return h('li', { class: 'product' },
    h('a', { href: productHref(product), tabindex: -1, 'aria-hidden': 'true' },
      h('img', { src: product.image, alt: '', width: 200, height: 200, loading: 'lazy' })),
    h('div', { class: 'product-body' },
      h('h2', { class: 'product-name' },
        h('a', { href: productHref(product) }, product.name)),
      h('p', { class: 'product-meta' },
        h('span', {}, `Item ${product.itemNumber}`),
        h('span', {}, `UPC ${product.upc}`)),
      h('p', { class: 'product-description' }, product.description),
      reorder
        ? h('p', { class: 'reorder-history' },
          `Last ordered ${formatDateTime(reorder.lastOrderedAt)}: ${reorder.lastQuantity.toLocaleString('en-CA')}. `
          + `Ordered ${reorder.timesOrdered === 1 ? 'once' : `${reorder.timesOrdered} times`}.`)
        : null,
      h('p', { class: 'product-price-row' },
        h('span', { class: 'product-price' }, formatPrice(product.priceCents)),
        statusBadge(product.status)),
      quantityRow ?? addToCartButton(product)));
}

// ---------------------------------------------------------------- Re-Order

export async function reorderView(data, customer) {
  const items = (await getPreviouslyOrdered(customer.id))
    .map((item) => ({ ...item, product: data.productsById.get(item.productId) }))
    .filter((item) => item.product); // skip products no longer in the catalogue

  const crumbs = breadcrumbs([{ label: 'Categories', href: '#/' }, { label: 'Re-Order' }]);
  if (items.length === 0) {
    return {
      title: 'Re-Order',
      content: h('section', {},
        crumbs,
        h('h1', {}, 'Re-Order'),
        h('p', {}, "You haven't ordered anything yet. Products from your Order Requests will appear here, "
          + 'so you can order them again quickly.'),
        h('p', {}, h('a', { href: '#/' }, 'Browse products'))),
    };
  }

  return {
    title: 'Re-Order',
    content: h('section', {},
      crumbs,
      h('h1', {}, 'Re-Order'),
      h('p', { class: 'count' },
        `${plural(items.length, 'product')} you've ordered before, most recent first. `
        + 'Quantities are filled in from your last order.'),
      h('ul', { class: 'product-list' }, items.map((item) => productCard(item.product, item)))),
  };
}

export function subcategoryView(data, category, sub) {
  const products = data.productsBySubcategory.get(sub.id) ?? [];

  return {
    title: `${sub.name} – ${category.name}`,
    content: h('section', {},
      breadcrumbs([
        { label: 'Categories', href: '#/' },
        { label: category.name, href: `#/c/${encodeURIComponent(category.id)}` },
        { label: sub.name },
      ]),
      h('h1', {}, sub.name),
      h('p', { class: 'count' }, plural(products.length, 'product')),
      h('ul', { class: 'product-list' }, products.map((product) => productCard(product)))),
  };
}

// ---------------------------------------------------------------- Search

export function searchView(data, query) {
  const trimmed = query.trim();
  if (!trimmed) {
    return {
      title: 'Search',
      content: h('section', {},
        h('h1', {}, 'Search'),
        h('p', {}, 'Type a product name, item number or UPC in the search box.')),
    };
  }

  const { total, results } = searchProducts(data, trimmed);
  let summary;
  if (total === 0) summary = 'No products found. Try fewer or different words.';
  else if (total > results.length) {
    summary = `Showing the first ${results.length} of ${plural(total, 'product')}. `
      + 'Add more words to narrow the search.';
  } else summary = `${plural(total, 'product')} found.`;

  return {
    title: `Search: ${trimmed}`,
    content: h('section', {},
      h('h1', {}, `Search results for “${trimmed}”`),
      h('p', { class: 'count', role: 'status' }, summary),
      results.length ? h('ul', { class: 'product-list' }, results.map((product) => productCard(product))) : null),
  };
}

// ---------------------------------------------------------------- Product detail

export function productView(data, product) {
  const input = quantityInput({ id: 'quantity', value: 1 });
  const readQuantity = () => readQuantityFrom(input);
  input.addEventListener('input', () => input.setCustomValidity(''));

  const statusNote = {
    Backordered: 'Backordered: you can still order this item; it will ship when back in stock.',
    Discontinued: 'Discontinued: this item can no longer be ordered.',
  }[product.status];

  return {
    title: product.name,
    content: h('section', { class: 'product-detail' },
      breadcrumbs([...categoryTrail(data, product), { label: product.name }]),
      h('div', { class: 'product-detail-layout' },
        h('img', { src: product.image, alt: '', width: 400, height: 400 }),
        h('div', {},
          h('h1', {}, product.name),
          h('dl', { class: 'product-facts' },
            h('dt', {}, 'Item number'), h('dd', {}, product.itemNumber),
            h('dt', {}, 'UPC'), h('dd', {}, product.upc),
            h('dt', {}, 'Status'), h('dd', {}, product.status)),
          h('div', { class: 'product-barcode' }, upcBarcodeSvg(product.upc)),
          h('p', { class: 'product-price large' }, formatPrice(product.priceCents)),
          statusNote ? h('p', { class: `status-note status-${product.status.toLowerCase()}` }, statusNote) : null,
          h('p', {}, product.description),
          product.status === 'Discontinued'
            ? null
            : h('div', { class: 'add-row' },
              h('label', { for: 'quantity' }, 'Quantity'),
              input,
              addToCartButton(product, readQuantity))))),
  };
}

// ---------------------------------------------------------------- Cart

function cartRow(product, quantity) {
  const input = quantityInput({
    value: quantity,
    'aria-label': `Quantity for ${product.name}`,
    'data-key': `quantity-${product.id}`,
  });
  input.addEventListener('change', () => {
    const value = Math.floor(Number(input.value));
    if (input.value.trim() === '' || !Number.isFinite(value) || value < 0) {
      input.value = quantity; // undo an invalid entry
      return;
    }
    setQuantity(product.id, value); // 0 removes the item
  });

  return h('tr', {},
    h('td', { class: 'cart-image' },
      h('img', { src: product.image, alt: '', width: 64, height: 64 })),
    h('td', {},
      h('div', { class: 'cart-product' },
        h('a', { href: productHref(product) }, product.name),
        h('span', { class: 'product-meta' }, `Item ${product.itemNumber}`),
        statusBadge(product.status))),
    h('td', { class: 'num', 'data-label': 'Price' }, formatPrice(product.priceCents)),
    h('td', { class: 'num', 'data-label': 'Quantity' }, input),
    h('td', { class: 'num', 'data-label': 'Total' },
      formatPrice(product.priceCents * quantity)),
    h('td', {},
      h('button', {
        type: 'button',
        class: 'text-button',
        'aria-label': `Remove ${product.name}`,
        'data-key': `remove-${product.id}`,
        onclick: () => {
          removeFromCart(product.id);
          announce(`Removed ${product.name} from the cart.`);
        },
      }, 'Remove')));
}

export function cartView(data) {
  const lines = cartLines(data);

  if (lines.length === 0) {
    return {
      title: 'Cart',
      content: h('section', {},
        h('h1', {}, 'Cart'),
        h('p', {}, 'Your cart is empty.'),
        h('p', {}, h('a', { href: '#/' }, 'Browse products'))),
    };
  }

  const orderable = lines.filter((line) => line.product.status !== 'Discontinued');
  const subtotal = orderable.reduce(
    (total, line) => total + line.product.priceCents * line.quantity, 0);
  const units = lines.reduce((total, line) => total + line.quantity, 0);
  const hasDiscontinued = orderable.length < lines.length;

  return {
    title: 'Cart',
    content: h('section', { class: 'cart' },
      h('h1', {}, 'Cart'),
      h('p', { class: 'count' },
        `${plural(lines.length, 'product')}, ${plural(units, 'unit')}`),
      hasDiscontinued
        ? h('p', { class: 'status-note status-discontinued' },
          'Some items are discontinued and will not be included in your Order Request. '
          + 'Please remove them.')
        : null,
      h('table', { class: 'cart-table' },
        h('thead', {},
          h('tr', {},
            h('th', {}, h('span', { class: 'visually-hidden' }, 'Image')),
            h('th', {}, 'Product'),
            h('th', { class: 'num' }, 'Price'),
            h('th', { class: 'num' }, 'Quantity'),
            h('th', { class: 'num' }, 'Total'),
            h('th', {}, h('span', { class: 'visually-hidden' }, 'Actions')))),
        h('tbody', {}, lines.map((line) => cartRow(line.product, line.quantity)))),
      h('div', { class: 'cart-summary' },
        h('p', { class: 'subtotal' },
          h('span', {}, 'Subtotal'),
          h('span', { class: 'product-price large' }, formatPrice(subtotal))),
        h('p', { class: 'fine-print' },
          'Order Requests do not include taxes, delivery fees or other charges.'),
        orderable.length
          ? h('a', { class: 'primary-button', href: '#/checkout' }, 'Review and submit')
          : h('button', { type: 'button', class: 'primary-button', disabled: true },
            'Review and submit'))),
  };
}

// The cart's lines with their products, skipping unknown products.
function cartLines(data) {
  return getItems()
    .map((item) => ({ product: data.productsById.get(item.productId), quantity: item.quantity }))
    .filter((line) => line.product);
}

// ---------------------------------------------------------------- Checkout

function addressBlock(address) {
  return h('address', {}, formatAddress(address).map((line) => h('span', {}, line)));
}

export function checkoutView(data, customer) {
  const lines = cartLines(data).filter((line) => line.product.status !== 'Discontinued');
  const company = data.companies.get(customer.companyId);

  if (lines.length === 0) {
    return {
      title: 'Review Order Request',
      content: h('section', {},
        h('h1', {}, 'Review Order Request'),
        h('p', {}, 'There is nothing to order. Your cart is empty or only has discontinued items.'),
        h('p', {}, h('a', { href: '#/cart' }, 'Back to cart'))),
    };
  }

  const total = lines.reduce((sum, line) => sum + line.product.priceCents * line.quantity, 0);

  // Ship-to location: one of the company's locations.
  const locations = company?.locations ?? [];
  const select = h('select', { id: 'ship-to' },
    locations.map((location) => h('option', { value: location.id }, location.name)));
  const shipToAddress = h('div', { class: 'ship-to-address' });
  const showAddress = () => {
    const shipTo = locations.find((loc) => loc.id === select.value);
    shipToAddress.replaceChildren(shipTo
      ? h('div', {}, addressBlock(shipTo.address), h('span', { class: 'fine-print' }, shipTo.phone))
      : '');
  };
  select.addEventListener('change', showAddress);
  showAddress();

  const error = h('p', { class: 'status-note status-discontinued', role: 'alert', hidden: true });
  const submit = h('button', {
    type: 'button',
    class: 'primary-button',
    onclick: async () => {
      submit.disabled = true;
      submit.textContent = 'Submitting…';
      error.hidden = true;
      try {
        const order = await submitOrderRequest({ customer, locationId: select.value, lines });
        await clearCart();
        announce(`Order Request ${order.id} submitted.`);
        location.hash = `#/orders/${encodeURIComponent(order.id)}`;
      } catch (problem) {
        console.error(problem);
        error.textContent = 'The Order Request could not be saved. Please try again.';
        error.hidden = false;
        submit.disabled = false;
        submit.textContent = 'Submit Order Request';
      }
    },
  }, 'Submit Order Request');

  return {
    title: 'Review Order Request',
    content: h('section', { class: 'checkout' },
      breadcrumbs([{ label: 'Cart', href: '#/cart' }, { label: 'Review Order Request' }]),
      h('h1', {}, 'Review Order Request'),
      h('div', { class: 'panel' },
        h('label', { for: 'ship-to', class: 'field-label' }, 'Ship to'),
        select,
        shipToAddress),
      orderLinesTable(lines.map(({ product, quantity }) => ({
        name: product.name,
        itemNumber: product.itemNumber,
        href: productHref(product),
        quantity,
        unitPriceCents: product.priceCents,
      }))),
      h('div', { class: 'cart-summary' },
        h('p', { class: 'subtotal' },
          h('span', {}, 'Total'),
          h('span', { class: 'product-price large' }, formatPrice(total))),
        h('p', { class: 'fine-print' },
          'No taxes, delivery fees or other charges are added. '
          + `You'll get an email at ${customer.email} when your Order Request is processed.`),
        error,
        submit)),
  };
}

// Read-only table of order lines (used by checkout and Order Request pages).
function orderLinesTable(lines) {
  return h('table', { class: 'cart-table order-table' },
    h('thead', {},
      h('tr', {},
        h('th', {}, 'Product'),
        h('th', { class: 'num' }, 'Price'),
        h('th', { class: 'num' }, 'Quantity'),
        h('th', { class: 'num' }, 'Total'))),
    h('tbody', {}, lines.map((line) => h('tr', {},
      h('td', {},
        h('div', { class: 'cart-product' },
          line.href ? h('a', { href: line.href }, line.name) : h('span', {}, line.name),
          h('span', { class: 'product-meta' }, `Item ${line.itemNumber}`))),
      h('td', { class: 'num', 'data-label': 'Price' }, formatPrice(line.unitPriceCents)),
      h('td', { class: 'num', 'data-label': 'Quantity' }, line.quantity.toLocaleString('en-CA')),
      h('td', { class: 'num', 'data-label': 'Total' },
        formatPrice(line.unitPriceCents * line.quantity))))));
}

// ---------------------------------------------------------------- Order Requests

function statusPill(order) {
  return h('span', { class: `badge badge-order-${order.status}` },
    STATUS_LABELS[order.status] ?? order.status);
}

function orderHref(order) {
  return `#/orders/${encodeURIComponent(order.id)}`;
}

export async function ordersView(data, customer) {
  const orders = await getOrderRequests(customer.id);

  if (orders.length === 0) {
    return {
      title: 'Order Requests',
      content: h('section', {},
        h('h1', {}, 'Order Requests'),
        h('p', {}, "You haven't submitted any Order Requests yet."),
        h('p', {}, h('a', { href: '#/' }, 'Browse products'))),
    };
  }

  return {
    title: 'Order Requests',
    content: h('section', {},
      h('h1', {}, 'Order Requests'),
      h('table', { class: 'cart-table orders-list' },
        h('thead', {},
          h('tr', {},
            h('th', {}, 'Order Request'),
            h('th', {}, 'Submitted'),
            h('th', { class: 'num' }, 'Lines'),
            h('th', { class: 'num' }, 'Total'),
            h('th', {}, 'Status'))),
        h('tbody', {}, orders.map((order) => h('tr', {},
          h('td', {}, h('a', { href: orderHref(order) }, order.id)),
          h('td', { 'data-label': 'Submitted' }, formatDateTime(order.createdAt)),
          h('td', { class: 'num', 'data-label': 'Lines' }, order.lines.length),
          h('td', { class: 'num', 'data-label': 'Total' }, formatPrice(order.totalCents)),
          h('td', {}, statusPill(order))))))),
  };
}

export async function orderView(data, customer, id) {
  const order = await getOrderRequest(customer.id, id);
  if (!order) return notFoundView();

  const company = data.companies.get(order.companyId);
  const shipTo = company?.locations.find((loc) => loc.id === order.locationId);

  const statusText = order.status === 'sent'
    ? `Sent for processing (confirmation ${order.confirmationNumber}). `
      + `You'll get an email at ${customer.email} when it has been processed.`
    : 'Saved and waiting to send. It will be sent automatically when you are back online.';

  return {
    title: `Order Request ${order.id}`,
    content: h('section', { class: 'order-detail' },
      breadcrumbs([{ label: 'Order Requests', href: '#/orders' }, { label: order.id }]),
      h('h1', {}, `Order Request ${order.id}`),
      h('p', { class: `status-note status-order-${order.status}`, role: 'status' }, statusText),
      h('div', { class: 'panel order-facts' },
        h('dl', { class: 'product-facts' },
          h('dt', {}, 'Submitted'), h('dd', {}, formatDateTime(order.createdAt)),
          h('dt', {}, 'Status'), h('dd', {}, statusPill(order)),
          h('dt', {}, 'Company'), h('dd', {}, company?.name ?? ''),
          h('dt', {}, 'Ship to'),
          h('dd', {}, shipTo
            ? [h('strong', {}, shipTo.name), addressBlock(shipTo.address)]
            : 'Unknown location'))),
      orderLinesTable(order.lines.map((line) => ({
        ...line,
        href: data.productsById.has(line.productId)
          ? productHref(data.productsById.get(line.productId))
          : null,
      }))),
      h('div', { class: 'cart-summary' },
        h('p', { class: 'subtotal' },
          h('span', {}, 'Total'),
          h('span', { class: 'product-price large' }, formatPrice(order.totalCents))),
        h('p', { class: 'fine-print' },
          'Prices are as they were when the Order Request was submitted. '
          + 'No taxes, delivery fees or other charges are included.'))),
  };
}

// ---------------------------------------------------------------- Sample barcode sheet

// A valid UPC that isn't in the catalogue, to try the "not found" message.
const UNKNOWN_UPC = '012345678905';

function sampleProducts(data) {
  // The first product (by name) in each subcategory...
  const picks = data.categories.flatMap((category) => category.subcategories
    .map((sub) => data.productsBySubcategory.get(sub.id)?.[0])
    .filter(Boolean));
  // ...plus a backordered and a discontinued one, if not already included.
  for (const status of ['Backordered', 'Discontinued']) {
    if (!picks.some((product) => product.status === status)) {
      const extra = [...data.productsById.values()].find((product) => product.status === status);
      if (extra) picks.push(extra);
    }
  }
  return picks;
}

export function barcodeSheetView(data) {
  const cell = (title, meta, upc) => h('li', { class: 'barcode-cell' },
    h('span', { class: 'barcode-title' }, title),
    h('span', { class: 'product-meta' }, meta),
    upcBarcodeSvg(upc));

  const cells = sampleProducts(data).map((product) => cell(
    product.name,
    `${product.itemNumber}${product.status === 'Active' ? '' : ` · ${product.status}`}`,
    product.upc));
  cells.push(cell('Not in the catalogue', 'For testing the "not found" message', UNKNOWN_UPC));

  return {
    title: 'Sample barcodes',
    content: h('section', { class: 'barcode-sheet' },
      breadcrumbs([{ label: 'Scan', href: '#/scan' }, { label: 'Sample barcodes' }]),
      h('h1', {}, 'Sample barcodes'),
      h('p', { class: 'no-print' },
        'The products in this demo are made up, so here are barcodes to practise on: one product from '
        + 'each subcategory, plus a backordered one, a discontinued one and a barcode that isn’t in the '
        + 'catalogue. Print this page, or scan it from another device’s screen.'),
      h('p', { class: 'no-print' },
        h('button', { type: 'button', class: 'primary-button', onclick: () => window.print() }, 'Print')),
      h('ul', { class: 'barcode-grid' }, cells)),
  };
}

// ---------------------------------------------------------------- Errors

export function notFoundView() {
  return {
    title: 'Page not found',
    content: h('section', {},
      h('h1', {}, 'Page not found'),
      h('p', {}, h('a', { href: '#/' }, 'Back to categories'))),
  };
}

export function errorView(message) {
  return {
    title: 'Something went wrong',
    content: h('section', {},
      h('h1', {}, 'Something went wrong'),
      h('p', {}, message),
      h('p', {}, h('button', { type: 'button', onclick: () => location.reload() }, 'Try again'))),
  };
}
