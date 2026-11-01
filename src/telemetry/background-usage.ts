import type { UsageBatch } from './usage-batches';

const DB = 'pico-usage-background-v1';
const STORE = 'batches';

export async function queueBackgroundUsage(batch: UsageBatch): Promise<void> {
  if (!('indexedDB' in globalThis)) return;
  await new Promise<void>((resolve, reject) => {
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => { if (!open.result.objectStoreNames.contains(STORE)) open.result.createObjectStore(STORE, { keyPath: 'batchId' }); };
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(batch);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  });
}

export async function acknowledgeBackgroundUsage(batchId: string): Promise<void> {
  if (!('indexedDB' in globalThis)) return;
  await new Promise<void>((resolve, reject) => {
    const open = indexedDB.open(DB, 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains(STORE)) { db.close(); resolve(); return; }
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(batchId);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  });
}

export async function requestBackgroundUsageSync(): Promise<void> {
  const registration = await navigator.serviceWorker?.ready;
  if (!registration) return;
  const sync = (registration as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } }).sync;
  if (sync) await sync.register('pico-usage-sync');
}
