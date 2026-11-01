/** Pending bug-report draft stored locally. A fresh Turnstile token is required before sending. */
export interface PendingBugReport {
  kind: string;
  workspace: string;
  description: string;
  email: string;
  screenshots: File[];
  createdAt: number;
}
const DB = 'pico-offline-reports-v1';
const STORE = 'drafts';
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function transaction<T>(mode: IDBTransactionMode, task: (store: IDBObjectStore, done: (value: T) => void) => void): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    let result: T;
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error); };
    task(tx.objectStore(STORE), value => { result = value; });
  });
}
export function savePendingReport(report: PendingBugReport): Promise<void> {
  return transaction<void>('readwrite', (store, done) => { store.put(report, 'pending'); done(); });
}
export function readPendingReport(): Promise<PendingBugReport | null> {
  return transaction('readonly', (store, done) => {
    const request = store.get('pending');
    request.onsuccess = () => done(request.result ?? null);
  });
}
export function clearPendingReport(): Promise<void> {
  return transaction<void>('readwrite', (store, done) => { store.delete('pending'); done(); });
}
