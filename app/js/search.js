// Product search by name, item number, UPC or category.
//
// Every word typed must appear somewhere in the product's searchable text.
// Exact item number or UPC matches come first, then names starting with
// the search, then everything else alphabetically.

const MAX_RESULTS = 100;

// Lower-case and remove accents, so "Gizmo" matches "gizmo" and "café" matches "cafe".
export function normalize(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

let index = null; // [{ product, text, name, itemNumber, upc }]

function buildIndex(data) {
  return [...data.productsById.values()].map((product) => {
    const sub = data.subcategories.get(product.subcategoryId);
    const itemNumber = normalize(product.itemNumber);
    return {
      product,
      name: normalize(product.name),
      itemNumber,
      itemNumberCompact: itemNumber.replace(/-/g, ''),
      upc: product.upc,
      text: normalize([
        product.name,
        product.itemNumber,
        product.itemNumber.replace(/-/g, ''), // "WID00001" also works
        product.upc,
        sub?.name ?? '',
        sub?.category.name ?? '',
      ].join(' ')),
    };
  });
}

function rank(entry, query) {
  const compact = query.replace(/[\s-]/g, '');
  if (entry.itemNumberCompact === compact || entry.upc === compact) return 0;
  if (entry.name.startsWith(query)) return 1;
  return 2;
}

// Returns every matching product, best matches first. Pages show at most
// MAX_RESULTS of them at once.
export function searchProducts(data, rawQuery) {
  const query = normalize(rawQuery.trim());
  if (!query) return [];
  index ??= buildIndex(data);

  const words = query.split(/\s+/);
  const matches = index.filter((entry) => words.every((word) => entry.text.includes(word)));

  matches.sort((a, b) => rank(a, query) - rank(b, query)
    || a.product.name.localeCompare(b.product.name));

  return matches.map((entry) => entry.product);
}

export { MAX_RESULTS };
