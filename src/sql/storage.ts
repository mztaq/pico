import type { SqlResponse } from './engine';

export interface SavedQuery { name:string; sql:string; }
export interface DatabaseSession { response?: SqlResponse; query: string; savedQueries?: SavedQuery[]; activeQuery?: string|null; }
export interface SqlLayout { sidebarWidth: number; editorRatio: number; }
export interface SqlSavedState { databases: Map<string, DatabaseSession>; selected: string | null; layout: SqlLayout; }
const DATABASE = 'pico-sql-playground';
const STORE = 'workspace';
const QUERY_PREFIX = 'pico:sql:query:';
const ACTIVE_QUERY_PREFIX = 'pico:sql:active-query:';
const DEFAULT_LAYOUT: SqlLayout = { sidebarWidth:260, editorRatio:55 };
export type StoredRecord =
  | { key: string; kind:'database'; name:string; response?:SqlResponse; query:string }
  | { key:string; kind:'savedQueries'; name:string; value:SavedQuery[] }
  | { key:string; kind:'query'; name:string; value:string }
  | { key:'selection'; kind:'selection'; name:string|null }
  | { key:'layout'; kind:'layout'; value:SqlLayout };
let connection: Promise<IDBDatabase> | undefined;
function openStorage(): Promise<IDBDatabase> {
  if (connection) return connection;
  connection = new Promise<IDBDatabase>((resolve,reject)=>{
    if (typeof indexedDB === 'undefined') { reject(new Error('Browser database storage is unavailable.')); return; }
    const request = indexedDB.open(DATABASE,1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE,{keyPath:'key'}); };
    request.onerror = () => reject(request.error ?? new Error('Unable to open local storage.'));
    request.onblocked = () => reject(new Error('Close other Pico tabs to enable local storage.'));
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); connection=undefined; };
      resolve(db);
    };
  }).catch(error=>{connection=undefined;throw error;});
  return connection;
}
function queryKey(name:string){return QUERY_PREFIX+encodeURIComponent(name);}
function getQuery(name:string,fallback:string) {
  try { return localStorage.getItem(queryKey(name)) ?? fallback; } catch { return fallback; }
}
function layoutValue(value:SqlLayout|undefined):SqlLayout {
  return {sidebarWidth:Number.isFinite(value?.sidebarWidth)?Math.max(190,Math.min(420,value!.sidebarWidth)):DEFAULT_LAYOUT.sidebarWidth,
    editorRatio:Number.isFinite(value?.editorRatio)?Math.max(25,Math.min(75,value!.editorRatio)):DEFAULT_LAYOUT.editorRatio};
}
export function restoreRecords(records: StoredRecord[]):SqlSavedState {
  const databases=new Map<string,DatabaseSession>();
  let selected:string|null=null,layout=DEFAULT_LAYOUT;
  const queries=new Map<string,string>();
  const savedQueries=new Map<string,SavedQuery[]>();
  for(const record of records){
    if(record.kind==='database' && typeof record.name==='string' && typeof record.query==='string') {
      if(record.response && !(record.response.database instanceof Uint8Array)) throw new Error('Invalid saved database. Local data has been left untouched.');
      databases.set(record.name,{response:record.response,query:record.query});
    } else if(record.kind==='savedQueries') savedQueries.set(record.name,record.value);
    else if(record.kind==='query') queries.set(record.name,record.value);
    else if(record.kind==='selection') selected=record.name;
    else if(record.kind==='layout') layout=layoutValue(record.value);
  }
  for (const [name,entry] of databases) {
    entry.query=getQuery(name,queries.get(name)??entry.query);
    entry.savedQueries=savedQueries.get(name)??[];
    try {
      const active=localStorage.getItem(ACTIVE_QUERY_PREFIX+encodeURIComponent(name));
      if(active&&entry.savedQueries.some(query=>query.name===active)){
        entry.activeQuery=active;
        entry.savedQueries=entry.savedQueries.map(query=>query.name===active?{...query,sql:entry.query}:query);
      }
    } catch { /* Named queries remain available in IndexedDB. */ }
  }
  return {databases,selected:selected && databases.has(selected)?selected:databases.keys().next().value??null,layout};
}
export async function loadSqlState():Promise<SqlSavedState> {
  const db=await openStorage();
  const records=await new Promise<StoredRecord[]>((resolve,reject)=>{
    const tx=db.transaction(STORE,'readonly');
    const request=tx.objectStore(STORE).getAll();
    tx.oncomplete=()=>resolve(request.result as StoredRecord[]);
    tx.onabort=()=>reject(tx.error??new Error('Unable to restore local databases.'));
    tx.onerror=()=>reject(tx.error??new Error('Unable to restore local databases.'));
  });
  return restoreRecords(records);
}
async function put(record:StoredRecord):Promise<void>{
  const db=await openStorage();
  await new Promise<void>((resolve,reject)=>{
    const tx=db.transaction(STORE,'readwrite');
    tx.oncomplete=()=>resolve();
    tx.onabort=()=>reject(tx.error??new Error('Local save was interrupted.'));
    tx.onerror=()=>reject(tx.error??new Error('Local save failed.'));
    tx.objectStore(STORE).put(record);
  });
}
export function saveDatabase(name:string,session:DatabaseSession):Promise<void>{
  // Snapshot metadata immediately. The SQLite byte array is immutable between successful operations.
  return put({key:'database:'+name,kind:'database',name,response:session.response,query:session.query});
}
export function saveNamedQueries(name:string,value:SavedQuery[]){return put({key:'savedQueries:'+name,kind:'savedQueries',name,value});}
export function saveSelection(name:string|null){return put({key:'selection',kind:'selection',name});}
export function saveLayout(value:SqlLayout){return put({key:'layout',kind:'layout',value:layoutValue(value)});}
/** Query drafts are small and synchronous so even immediate refresh preserves typing. */
export function saveQuery(name:string,query:string):Promise<void>{
  try { localStorage.setItem(queryKey(name),query); }
  catch { try { localStorage.removeItem(queryKey(name)); } catch { /* Browser storage denied. IndexedDB remains the fallback. */ } }
  return put({key:'query:'+name,kind:'query',name,value:query});
}

export function saveActiveQuery(name:string,query:string|null){try{const key=ACTIVE_QUERY_PREFIX+encodeURIComponent(name);if(query===null)localStorage.removeItem(key);else localStorage.setItem(key,query);}catch{/* IndexedDB still retains named queries. */}}
