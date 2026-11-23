export interface StoredGlbRecord {
  bikeId: string;
  fileName: string;
  data: ArrayBuffer;
  updatedAt: number;
}

const DB_NAME = 'bike_red_pull_glb_store_v1';
const STORE_NAME = 'custom_models';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable in this browser.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'bikeId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open local 3D model storage.'));
  });
}

export async function saveCustomGlb(
  bikeId: string,
  fileName: string,
  data: ArrayBuffer
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const record: StoredGlbRecord = {
      bikeId,
      fileName,
      data,
      updatedAt: Date.now(),
    };
    store.put(record);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('Failed to save custom GLB file.'));
    };
  });
}

export async function loadCustomGlb(bikeId: string): Promise<StoredGlbRecord | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(bikeId);
      req.onsuccess = () => {
        db.close();
        resolve((req.result as StoredGlbRecord | undefined) ?? null);
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch {
    return null;
  }
}

export async function deleteCustomGlb(bikeId: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(bikeId);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch {
    // Ignore cleanup errors
  }
}

export async function listCustomGlbMap(): Promise<Record<string, string>> {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        db.close();
        const out: Record<string, string> = {};
        const items = (req.result as StoredGlbRecord[] | undefined) ?? [];
        for (const item of items) {
          out[item.bikeId] = item.fileName;
        }
        resolve(out);
      };
      req.onerror = () => {
        db.close();
        resolve({});
      };
    });
  } catch {
    return {};
  }
}
