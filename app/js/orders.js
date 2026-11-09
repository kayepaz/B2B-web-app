// Order Requests: created from the cart, saved in the browser, then sent to
// the order-processing system (see api.js).
//
// An Order Request records, for each line, the product, the quantity and the
// unit price at the moment it was submitted. No taxes or fees are added.
//
// Status:
//   'queued' - saved, waiting to be sent (e.g. while offline)
//   'sent'   - accepted by the processing system; the customer will get
//              an email when it has been processed

import { getRecord, getAllRecords, putRecord } from './db.js';
import { sendOrderRequest, randomCode } from './api.js';

const STORE = 'orderRequests';

// Fallback when browser storage is unavailable.
const memory = new Map();
const listeners = new Set();
const sending = new Set(); // IDs currently being sent

export const STATUS_LABELS = {
  queued: 'Waiting to send',
  sent: 'Sent for processing',
};

function notify() {
  for (const listener of listeners) listener();
}

async function save(order) {
  memory.set(order.id, order);
  try {
    await putRecord(STORE, order);
  } catch (error) {
    console.warn('Could not save the Order Request.', error);
  }
  notify();
}

function newId(now) {
  const date = now.toISOString().slice(0, 10).replaceAll('-', '');
  return `OR-${date}-${randomCode(5)}`;
}

// lines: [{ product, quantity }] — discontinued products must already be
// removed by the caller.
export async function submitOrderRequest({ customer, locationId, lines }) {
  if (lines.length === 0) throw new Error('An Order Request needs at least one line.');

  const now = new Date();
  const order = {
    id: newId(now),
    customerId: customer.id,
    companyId: customer.companyId,
    locationId,
    createdAt: now.toISOString(),
    status: 'queued',
    lines: lines.map(({ product, quantity }) => ({
      productId: product.id,
      itemNumber: product.itemNumber,
      name: product.name,
      quantity,
      unitPriceCents: product.priceCents,
    })),
  };
  order.totalCents = order.lines.reduce(
    (total, line) => total + line.unitPriceCents * line.quantity, 0);

  await save(order);
  trySend(order); // runs in the background
  return order;
}

async function trySend(order) {
  if (order.status !== 'queued' || sending.has(order.id)) return;
  sending.add(order.id);
  try {
    const result = await sendOrderRequest(order);
    await save({
      ...order,
      status: 'sent',
      sentAt: result.receivedAt,
      confirmationNumber: result.confirmationNumber,
    });
  } catch (error) {
    // Stays queued; sendQueued() retries when the connection returns.
    if (error.message !== 'Offline') console.warn('Could not send the Order Request.', error);
  } finally {
    sending.delete(order.id);
  }
}

// Send everything still waiting. Called at start-up and when back online.
export async function sendQueued() {
  let all;
  try {
    all = await getAllRecords(STORE);
  } catch {
    all = [];
  }
  // Copies made in this session are the newest, so they win.
  const latest = new Map(all.map((order) => [order.id, order]));
  for (const order of memory.values()) latest.set(order.id, order);
  for (const order of latest.values()) {
    if (order.status === 'queued') trySend(order);
  }
}

export async function getOrderRequests(customerId) {
  let stored = [];
  try {
    stored = await getAllRecords(STORE, 'customerId', customerId);
  } catch (error) {
    console.warn('Could not load Order Requests.', error);
  }
  const byId = new Map(stored.map((order) => [order.id, order]));
  for (const order of memory.values()) {
    if (order.customerId === customerId) byId.set(order.id, order);
  }
  return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// Every product this customer has ordered before, most recently ordered
// first: [{ productId, lastOrderedAt, lastQuantity, timesOrdered }].
export async function getPreviouslyOrdered(customerId) {
  const orders = await getOrderRequests(customerId); // newest first
  const items = new Map();
  for (const order of orders) {
    for (const line of order.lines) {
      const existing = items.get(line.productId);
      if (existing) {
        existing.timesOrdered += 1;
      } else {
        items.set(line.productId, {
          productId: line.productId,
          lastOrderedAt: order.createdAt,
          lastQuantity: line.quantity,
          timesOrdered: 1,
        });
      }
    }
  }
  return [...items.values()];
}

// Returns the Order Request only if it belongs to this customer.
export async function getOrderRequest(customerId, id) {
  let order = memory.get(id);
  if (!order) {
    try {
      order = await getRecord(STORE, id);
    } catch (error) {
      console.warn('Could not load the Order Request.', error);
    }
  }
  return order?.customerId === customerId ? order : null;
}

export function onOrdersChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

window.addEventListener('online', sendQueued);
