// Shared tools for every page that lists products (subcategory, search
// results and Re-Order): sorting, an availability filter, a name filter
// with wildcards, and a tiles/list view switch.
//
// The view (tiles or list) is remembered across pages. Each kind of page
// remembers its own sort. Filters start fresh on each visit.

import { h } from './dom.js';
import { plural } from './format.js';
import { normalize } from './search.js';

const STATUSES = ['Active', 'Backordered', 'Discontinued'];
const VIEW_KEY = 'b2b.list.view';
const SORT_KEY = (page) => `b2b.list.sort.${page}`;
const ORIGINAL = 'original'; // the page's own order (e.g. best match)

function remembered(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function remember(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not essential.
  }
}

const collator = new Intl.Collator('en-CA', { sensitivity: 'base', numeric: true });
const byName = (a, b) => collator.compare(a.product.name, b.product.name);

const SORTS = {
  'name-asc': ['Name (A to Z)', byName],
  'name-desc': ['Name (Z to A)', (a, b) => byName(b, a)],
  'price-asc': ['Price (low to high)',
    (a, b) => a.product.priceCents - b.product.priceCents || byName(a, b)],
  'price-desc': ['Price (high to low)',
    (a, b) => b.product.priceCents - a.product.priceCents || byName(a, b)],
};

// Turns what's typed in the name filter into a test for product names.
//   Plain text matches anywhere in the name:   "drive"   finds "Apex Drive Sprocket"
//   * matches any text, ? any one character:  "apex*"   finds names starting with Apex
//                                               "*ss sprocket*" or "?pex*" work too
// Capitals and accents are ignored. Wildcard patterns match the whole name.
export function nameMatcher(text) {
  const pattern = normalize(text.trim());
  if (!pattern) return () => true;
  if (!/[*?]/.test(pattern)) return (name) => normalize(name).includes(pattern);
  const source = pattern
    .split('')
    .map((char) => {
      if (char === '*') return '.*';
      if (char === '?') return '.';
      return char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    })
    .join('');
  const regex = new RegExp(`^${source}$`, 's');
  return (name) => regex.test(normalize(name));
}

// entries: [{ product, ...anything renderCard needs }], in the page's own
//   order (used when originalLabel is given, e.g. "Best match").
// options:
//   page          - remembers this page's sort under this name
//   renderCard    - (entry) => <li> element
//   originalLabel - name for the page's own order, which becomes the default
//   limit         - most cards to show at once (search results)
//   emptyMessage  - shown when there are no entries at all
export function productListing(entries, {
  page,
  renderCard,
  originalLabel = null,
  limit = Infinity,
  emptyMessage = 'There are no products here.',
}) {
  const sortChoices = [
    ...(originalLabel ? [[ORIGINAL, originalLabel]] : []),
    ...Object.entries(SORTS).map(([value, [label]]) => [value, label]),
  ];
  const defaultSort = originalLabel ? ORIGINAL : 'name-asc';
  let sort = remembered(SORT_KEY(page), defaultSort);
  if (!sortChoices.some(([value]) => value === sort)) sort = defaultSort;
  let view = remembered(VIEW_KEY, 'tiles') === 'list' ? 'list' : 'tiles';
  let nameText = '';
  const shownStatuses = new Set(STATUSES);

  const status = h('p', { class: 'count', role: 'status' });
  const list = h('ul', { class: `product-list view-${view}` });

  if (entries.length === 0) {
    status.textContent = emptyMessage;
    return h('div', { class: 'listing' }, status);
  }

  // ---- Controls
  const nameInput = h('input', {
    type: 'search',
    id: `name-filter-${page}`,
    class: 'name-filter',
    autocomplete: 'off',
    placeholder: 'e.g. drive or apex*',
    'aria-describedby': `name-filter-help-${page}`,
  });
  let typingTimer;
  nameInput.addEventListener('input', () => {
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => { nameText = nameInput.value; update(); }, 150);
  });

  const sortSelect = h('select', {
    id: `sort-${page}`,
    onchange: () => {
      sort = sortSelect.value;
      remember(SORT_KEY(page), sort);
      update();
    },
  }, sortChoices.map(([value, label]) => h('option', { value, selected: value === sort }, label)));

  const viewButtons = ['tiles', 'list'].map((value) => h('button', {
    type: 'button',
    class: 'view-button',
    'aria-pressed': String(view === value),
    onclick: () => {
      view = value;
      remember(VIEW_KEY, view);
      for (const button of viewButtons) {
        button.setAttribute('aria-pressed', String(button.dataset.view === view));
      }
      update();
    },
    'data-view': value,
  }, value === 'tiles' ? 'Tiles' : 'List'));

  const statusBoxes = STATUSES.map((name) => {
    const count = h('span', { class: 'filter-count' });
    const box = h('input', {
      type: 'checkbox',
      value: name,
      checked: true,
      onchange: () => {
        if (box.checked) shownStatuses.add(name);
        else shownStatuses.delete(name);
        update();
      },
    });
    return { name, box, count, label: h('label', { class: 'filter-option' }, box, ` ${name} `, count) };
  });

  const clearButton = h('button', {
    type: 'button',
    class: 'text-button',
    hidden: true,
    onclick: () => {
      nameText = '';
      nameInput.value = '';
      for (const { name, box } of statusBoxes) {
        box.checked = true;
        shownStatuses.add(name);
      }
      update();
    },
  }, 'Clear filters');

  const toolbar = h('div', { class: 'listing-toolbar panel' },
    h('div', { class: 'toolbar-row' },
      h('div', { class: 'toolbar-field toolbar-name' },
        h('label', { for: nameInput.id, class: 'field-label' }, 'Filter by name'),
        nameInput,
        h('span', { id: `name-filter-help-${page}`, class: 'fine-print' },
          'Use * for any text and ? for any single character.')),
      h('div', { class: 'toolbar-field' },
        h('label', { for: sortSelect.id, class: 'field-label' }, 'Sort by'),
        sortSelect),
      h('div', { class: 'toolbar-field' },
        h('span', { class: 'field-label', id: `view-label-${page}` }, 'View'),
        h('div', { class: 'view-toggle', role: 'group', 'aria-labelledby': `view-label-${page}` },
          viewButtons))),
    h('div', { class: 'toolbar-row availability', role: 'group', 'aria-labelledby': `availability-${page}` },
      h('span', { class: 'field-label', id: `availability-${page}` }, 'Availability'),
      statusBoxes.map((item) => item.label),
      clearButton));

  // On phones the controls fold away behind a button to save space.
  const summaryNote = h('span', { class: 'options-note' });
  const options = h('details', { class: 'listing-options', open: !window.matchMedia('(max-width: 600px)').matches },
    h('summary', {}, 'Filter, sort and view', summaryNote),
    toolbar);

  // ---- Showing the list
  function update() {
    const matchesName = nameMatcher(nameText);
    const named = entries.filter((entry) => matchesName(entry.product.name));
    for (const { name, count } of statusBoxes) {
      count.textContent = `(${named.filter((entry) => entry.product.status === name).length})`;
    }
    const filtered = named.filter((entry) => shownStatuses.has(entry.product.status));
    const sorted = sort === ORIGINAL ? filtered : [...filtered].sort(SORTS[sort][1]);
    const shown = sorted.slice(0, limit);

    list.className = `product-list view-${view}`;
    list.replaceChildren(...shown.map(renderCard));

    const filtersOn = Boolean(nameText.trim()) || shownStatuses.size < STATUSES.length;
    clearButton.hidden = !filtersOn;
    const activeFilters = Number(Boolean(nameText.trim())) + Number(shownStatuses.size < STATUSES.length);
    summaryNote.textContent = activeFilters ? ` (${activeFilters} on)` : '';
    const total = plural(entries.length, 'product');
    if (filtered.length === 0) {
      status.textContent = `No products match your filters (out of ${total}).`;
    } else if (shown.length < filtered.length) {
      status.textContent = `Showing the first ${shown.length} of ${plural(filtered.length, 'product')}`
        + `${filtersOn ? ' that match your filters' : ''}. Narrow it down to see the rest.`;
    } else if (filtersOn) {
      status.textContent = `Showing ${filtered.length} of ${total}.`;
    } else {
      status.textContent = `${total}.`;
    }
  }

  update();
  return h('div', { class: 'listing' }, options, status, list);
}
