// The shopping cart for the signed-in customer.
//
// Each customer has their own cart, saved in the browser's IndexedDB so it
// survives reloads and works offline. A cart only stores product IDs and
// quantities; prices always come from the current product data.
//
// If IndexedDB is unavailable the cart still works, but only until the page
// is reloaded.

import { getRecord, putRecord } from './db.js';

const STORE = 'carts';

export const MAX_QUANTITY = 9999;

let customerId = null;
let items = []; // [{ productId, quantity }]
const listeners = new Set();

async function save() {
  if (!customerId) return;
  const record = { customerId, items, updatedAt: new Date().toISOString() };
  try {
    await putRecord(STORE, record);
  } catch (error) {
    console.warn('Could not save the cart.', error);
  }
}

function changed() {
  for (const listener of listeners) listener();
  return save();
}

function clampQuantity(quantity) {
  const whole = Math.floor(Number(quantity));
  if (!Number.isFinite(whole) || whole < 1) return 0;
  return Math.min(whole, MAX_QUANTITY);
}

// Load the cart for a customer. Call when the signed-in customer changes.
export async function useCartFor(id) {
  if (id === customerId) return;
  customerId = id;
  items = [];
  if (id) {
    try {
      const record = await getRecord(STORE, id);
      if (customerId === id) items = record?.items ?? [];
    } catch (error) {
      console.warn('Could not load the cart.', error);
    }
  }
  for (const listener of listeners) listener();
}

export function getItems() {
  return items.map((item) => ({ ...item }));
}

export function getQuantity(productId) {
  return items.find((item) => item.productId === productId)?.quantity ?? 0;
}

export function itemCount() {
  return items.reduce((total, item) => total + item.quantity, 0);
}

export function addToCart(productId, quantity = 1) {
  const amount = clampQuantity(quantity);
  if (!amount) return Promise.resolve();
  const existing = items.find((item) => item.productId === productId);
  if (existing) {
    existing.quantity = Math.min(existing.quantity + amount, MAX_QUANTITY);
  } else {
    items.push({ productId, quantity: amount });
  }
  return changed();
}

// Setting a quantity of 0 removes the item.
export function setQuantity(productId, quantity) {
  const amount = clampQuantity(quantity);
  items = amount
    ? items.map((item) => (item.productId === productId ? { ...item, quantity: amount } : item))
    : items.filter((item) => item.productId !== productId);
  return changed();
}

export function removeFromCart(productId) {
  return setQuantity(productId, 0);
}

export function clearCart() {
  items = [];
  return changed();
}

// Call fn whenever the cart changes. Returns a function that stops listening.
export function onCartChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
