// Formatting helpers.

const currency = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });

// Prices are stored as whole cents to avoid rounding errors.
export function formatPrice(cents) {
  return currency.format(cents / 100);
}

const dateTime = new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium', timeStyle: 'short' });

export function formatDateTime(isoString) {
  return dateTime.format(new Date(isoString));
}

export function formatAddress(address) {
  return [
    address.line1,
    address.line2,
    `${address.city}, ${address.region} ${address.postalCode}`,
    address.country,
  ].filter(Boolean);
}

export function plural(count, singular, pluralForm = `${singular}s`) {
  return `${count.toLocaleString('en-CA')} ${count === 1 ? singular : pluralForm}`;
}
