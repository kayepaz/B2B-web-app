// Loads the sample data files once and builds lookup tables for the views.

let loaded = null;

async function getJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Could not load ${path} (HTTP ${response.status}).`);
  }
  return response.json();
}

function byId(items) {
  return new Map(items.map((item) => [item.id, item]));
}

async function load() {
  const [categories, products, companies, customers] = await Promise.all([
    getJson('data/categories.json'),
    getJson('data/products.json'),
    getJson('data/companies.json'),
    getJson('data/customers.json'),
  ]);

  // Subcategory ID -> { ...subcategory, category }
  const subcategories = new Map();
  for (const category of categories) {
    for (const sub of category.subcategories) {
      subcategories.set(sub.id, { ...sub, category });
    }
  }

  // Group products by subcategory, and count them per category.
  const productsBySubcategory = new Map();
  const productCountByCategory = new Map();
  for (const product of products) {
    if (!productsBySubcategory.has(product.subcategoryId)) {
      productsBySubcategory.set(product.subcategoryId, []);
    }
    productsBySubcategory.get(product.subcategoryId).push(product);
    productCountByCategory.set(
      product.categoryId,
      (productCountByCategory.get(product.categoryId) ?? 0) + 1,
    );
  }
  for (const list of productsBySubcategory.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }

  return {
    categories,
    categoriesById: byId(categories),
    subcategories,
    productsBySubcategory,
    productCountByCategory,
    companies: byId(companies),
    customers,
    customersById: byId(customers),
  };
}

// Returns the same data on every call; the files are only downloaded once.
export function getData() {
  loaded ??= load().catch((error) => {
    loaded = null; // allow a retry after a failure
    throw error;
  });
  return loaded;
}
