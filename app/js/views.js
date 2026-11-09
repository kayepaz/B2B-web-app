// One function per screen. Each returns { title, content }.

import { h, announce } from './dom.js';
import { formatPrice, plural } from './format.js';
import { signIn } from './session.js';
import {
  addToCart, setQuantity, removeFromCart, getItems, getQuantity, MAX_QUANTITY,
} from './cart.js';

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

export function categoriesView(data) {
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
      h('ul', { class: 'card-grid' }, cards)),
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

function productCard(product) {
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
      h('p', { class: 'product-price-row' },
        h('span', { class: 'product-price' }, formatPrice(product.priceCents)),
        statusBadge(product.status)),
      addToCartButton(product)));
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
      h('ul', { class: 'product-list' }, products.map(productCard))),
  };
}

// ---------------------------------------------------------------- Product detail

export function productView(data, product) {
  const input = quantityInput({ id: 'quantity', value: 1 });
  const readQuantity = () => {
    const value = Math.floor(Number(input.value));
    if (!Number.isFinite(value) || value < 1 || value > MAX_QUANTITY) {
      input.setCustomValidity(`Enter a whole number from 1 to ${MAX_QUANTITY.toLocaleString('en-CA')}.`);
      input.reportValidity();
      return 0;
    }
    input.setCustomValidity('');
    return value;
  };
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
    h('td', { class: 'cart-product' },
      h('a', { href: productHref(product) }, product.name),
      h('span', { class: 'product-meta' }, `Item ${product.itemNumber}`),
      statusBadge(product.status)),
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
  const lines = getItems()
    .map((item) => ({ product: data.productsById.get(item.productId), quantity: item.quantity }))
    .filter((line) => line.product); // skip products no longer in the catalogue

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
        h('button', { type: 'button', class: 'primary-button', disabled: true },
          'Submit Order Request (coming soon)'))),
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
