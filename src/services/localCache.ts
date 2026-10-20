/**
 * Local Cache Service using IndexedDB with fallback
 * 
 * Mengatasi batasan kuota 5MB dari localStorage browser sehingga
 * ribuan data master produk, supplier, dan retur dapat disimpan
 * dan dibuka seketika (instant) tanpa terkena QuotaExceededError.
 */

const DB_NAME = 'ReturkuAppCacheDB';
const DB_VERSION = 1;
const STORE_NAME = 'app_cache';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function getIDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e: any) => {
          const db = e.target.result as IDBDatabase;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
          console.warn('IndexedDB failed to open, falling back to localStorage');
          resolve(null);
        };
      } catch (err) {
        console.warn('IndexedDB initialization error:', err);
        resolve(null);
      }
    });
  }

  return dbPromise;
}

export async function getCachedData<T>(key: string): Promise<T | null> {
  // 1. Coba baca dari IndexedDB
  try {
    const db = await getIDB();
    if (db) {
      return new Promise<T | null>((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const req = store.get(key);
          req.onsuccess = () => {
            if (req.result !== undefined && req.result !== null) {
              resolve(req.result as T);
            } else {
              // Jika kosong di IDB, coba cek localStorage sebagai fallback
              resolve(getFromLocalStorage<T>(key));
            }
          };
          req.onerror = () => resolve(getFromLocalStorage<T>(key));
        } catch {
          resolve(getFromLocalStorage<T>(key));
        }
      });
    }
  } catch {
    // Abaikan error IDB
  }

  return getFromLocalStorage<T>(key);
}

export async function setCachedData<T>(key: string, data: T): Promise<void> {
  // 1. Simpan ke IndexedDB (kapasitas besar > 100MB, tidak ada limit 5MB)
  try {
    const db = await getIDB();
    if (db) {
      await new Promise<void>((resolve, reject) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.put(data, key);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        } catch (err) {
          reject(err);
        }
      });
    }
  } catch (err) {
    console.warn(`IndexedDB save error for ${key}:`, err);
  }

  // 2. Coba simpan ke localStorage juga jika muat (untuk kompatibilitas)
  try {
    const serialized = JSON.stringify(data);
    if (serialized.length < 2_500_000) { // Hanya jika di bawah 2.5MB
      localStorage.setItem(key, serialized);
    }
  } catch {
    // Jangan lempar error jika kuota localStorage penuh, karena data sudah aman di IndexedDB
  }
}

export async function removeCachedData(key: string): Promise<void> {
  try {
    const db = await getIDB();
    if (db) {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
    }
  } catch {}

  try {
    localStorage.removeItem(key);
  } catch {}
}

function getFromLocalStorage<T>(key: string): T | null {
  try {
    const val = localStorage.getItem(key);
    if (val !== null) {
      return JSON.parse(val) as T;
    }
  } catch {}
  return null;
}
