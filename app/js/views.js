// One function per screen. Each returns { title, content }.

import { h } from './dom.js';
import { formatPrice, plural } from './format.js';
import { signIn } from './session.js';

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
    h('img', { src: product.image, alt: '', width: 200, height: 200, loading: 'lazy' }),
    h('div', { class: 'product-body' },
      h('h2', { class: 'product-name' }, product.name),
      h('p', { class: 'product-meta' },
        h('span', {}, `Item ${product.itemNumber}`),
        h('span', {}, `UPC ${product.upc}`)),
      h('p', { class: 'product-description' }, product.description),
      h('p', { class: 'product-price-row' },
        h('span', { class: 'product-price' }, formatPrice(product.priceCents)),
        statusBadge(product.status))));
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
