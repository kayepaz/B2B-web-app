// Entry point: routing, the header, and showing the right screen.
//
// Routes use the part of the URL after "#", so the app works on any static
// file server without special configuration:
//   #/login                     sample-user sign-in
//   #/                          all categories
//   #/c/<categoryId>            subcategories in a category
//   #/c/<categoryId>/<subId>    products in a subcategory

import { h } from './dom.js';
import { getData } from './data.js';
import { currentCustomerId, signOut } from './session.js';
import {
  loginView, categoriesView, categoryView, subcategoryView, notFoundView, errorView,
} from './views.js';

const APP_NAME = 'B2B Ordering Portal';
const main = document.getElementById('main');
const userArea = document.getElementById('user-area');

function parseRoute() {
  const path = location.hash.replace(/^#/, '') || '/';
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  return parts;
}

function renderHeader(data, customer) {
  if (!customer) {
    userArea.replaceChildren();
    return;
  }
  const company = data.companies.get(customer.companyId);
  userArea.replaceChildren(
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

  return notFoundView();
}

let firstRender = true;

async function render() {
  let view;
  try {
    const data = await getData();
    const customer = data.customersById.get(currentCustomerId()) ?? null;
    renderHeader(data, customer);
    view = chooseView(data, parseRoute(), customer);
    if (!view) return; // redirected; the hashchange will render again
  } catch (error) {
    console.error(error);
    view = errorView('The product data could not be loaded. '
      + 'If you are running the app locally, run "python3 tools/generate_data.py" first.');
  }

  document.title = `${view.title} – ${APP_NAME}`;
  main.replaceChildren(view.content);
  window.scrollTo(0, 0);

  // Move keyboard and screen-reader focus to the new page's heading,
  // except on first load, where the browser's default is better.
  if (!firstRender) {
    const heading = main.querySelector('h1');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus();
    }
  }
  firstRender = false;
}

window.addEventListener('hashchange', render);
render();
