/* IndexedDB storage layer — the single source of truth for ZLife data. */

const DB_NAME = 'zlife';
const DB_VERSION = 2;

export const STORES = {
  tasks: 'tasks',
  events: 'events',
  students: 'students',
  lessons: 'lessons',
  transactions: 'transactions',
  weights: 'weights',
  notes: 'notes',
};

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this browser.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORES.tasks)) {
        db.createObjectStore(STORES.tasks, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.events)) {
        db.createObjectStore(STORES.events, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.students)) {
        db.createObjectStore(STORES.students, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.lessons)) {
        db.createObjectStore(STORES.lessons, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.transactions)) {
        db.createObjectStore(STORES.transactions, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.weights)) {
        db.createObjectStore(STORES.weights, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.notes)) {
        db.createObjectStore(STORES.notes, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Could not open the local database.'));
    req.onblocked = () => reject(new Error('The local database is open in another tab. Close it and try again.'));
  });
  return dbPromise;
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Database operation failed.'));
  });
}

export async function dbGetAll(store) {
  const db = await openDB();
  const tx = db.transaction(store, 'readonly');
  return reqToPromise(tx.objectStore(store).getAll());
}

export async function dbPut(store, obj) {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  await reqToPromise(tx.objectStore(store).put(obj));
  await reqToPromise(tx.objectStore(store).get(obj.id));
  return obj.id;
}

export async function dbBulkPut(store, objs) {
  if (!objs.length) return;
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  const os = tx.objectStore(store);
  for (const o of objs) os.put(o);
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('Database write failed.'));
    tx.onabort = () => reject(tx.error || new Error('Database write was aborted.'));
  });
}

export async function dbDelete(store, id) {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  await reqToPromise(tx.objectStore(store).delete(id));
}

export async function dbClear(store) {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  await reqToPromise(tx.objectStore(store).clear());
}

/** Export the whole database as a plain object keyed by store name. */
export async function dbExport() {
  const out = {};
  for (const key of Object.values(STORES)) {
    out[key] = await dbGetAll(key);
  }
  return out;
}

/** Replace all data with the given object keyed by store name (destructive). */
export async function dbImportAll(data) {
  const db = await openDB();
  const tx = db.transaction(Object.values(STORES), 'readwrite');
  for (const key of Object.values(STORES)) {
    const os = tx.objectStore(key);
    os.clear();
    const list = Array.isArray(data[key]) ? data[key] : [];
    for (const o of list) os.put(o);
  }
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('Import failed.'));
    tx.onabort = () => reject(tx.error || new Error('Import was aborted.'));
  });
}

/** Merge: existing records win; any new record id is added. Returns counts. */
export async function dbImportMerge(data) {
  const db = await openDB();
  const tx = db.transaction(Object.values(STORES), 'readwrite');
  const stats = {};
  for (const key of Object.values(STORES)) {
    const os = tx.objectStore(key);
    const existing = await reqToPromise(os.getAll());
    const have = new Set(existing.map((o) => o.id));
    let added = 0;
    for (const o of Array.isArray(data[key]) ? data[key] : []) {
      if (o && o.id && !have.has(o.id)) {
        os.put(o);
        added++;
      }
    }
    stats[key] = added;
  }
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('Import failed.'));
    tx.onabort = () => reject(tx.error || new Error('Import was aborted.'));
  });
  return stats;
}

export async function dbClearAll() {
  const db = await openDB();
  const tx = db.transaction(Object.values(STORES), 'readwrite');
  for (const key of Object.values(STORES)) tx.objectStore(key).clear();
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('Could not clear data.'));
  });
}