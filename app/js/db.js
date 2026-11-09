// The app's IndexedDB database, shared by the cart and Order Requests.
//
// To change what's stored, bump DB_VERSION and add a step to upgrade().
// Browsers run each missing step once, in order, keeping existing data.

const DB_NAME = 'b2b-web-app';
const DB_VERSION = 2;

function upgrade(db, oldVersion) {
  if (oldVersion < 1) {
    db.createObjectStore('carts', { keyPath: 'customerId' });
  }
  if (oldVersion < 2) {
    const orders = db.createObjectStore('orderRequests', { keyPath: 'id' });
    orders.createIndex('customerId', 'customerId');
  }
}

let dbPromise = null;

// Resolves to the database, or to null if IndexedDB is unavailable
// (callers then keep their data in memory only).
export function openDb() {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => upgrade(request.result, event.oldVersion);
    request.onsuccess = () => {
      const db = request.result;
      // If a newer version of the app opens in another tab, step aside.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => console.warn('Close other tabs of this app to finish updating its storage.');
  }).catch((error) => {
    console.warn('Browser storage is unavailable; data will not be saved.', error);
    return null;
  });
  return dbPromise;
}

function asPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getRecord(storeName, key) {
  const db = await openDb();
  if (!db) return undefined;
  return asPromise(db.transaction(storeName).objectStore(storeName).get(key));
}

export async function getAllRecords(storeName, indexName, value) {
  const db = await openDb();
  if (!db) return [];
  const store = db.transaction(storeName).objectStore(storeName);
  return asPromise(indexName ? store.index(indexName).getAll(value) : store.getAll());
}

export async function putRecord(storeName, record) {
  const db = await openDb();
  if (!db) return false;
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).put(record);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  return true;
}
