// Formatting helpers.

const currency = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });

// Prices are stored as whole cents to avoid rounding errors.
export function formatPrice(cents) {
  return currency.format(cents / 100);
}

export function plural(count, singular, pluralForm = `${singular}s`) {
  return `${count.toLocaleString('en-CA')} ${count === 1 ? singular : pluralForm}`;
}
