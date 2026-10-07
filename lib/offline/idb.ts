// lib/offline/idb.ts
// 极简 IndexedDB 键值封装（单库单 store），仅服务于离线查询缓存。
//
// 不引入 idb / idb-keyval：只需要 get / set / delete / clear 四个动作。
// 所有调用方都必须 try/catch：隐私模式、存储被禁用、iOS 的偶发 IDB 故障都会让 open 失败，
// 此时离线缓存直接失效（等同没有缓存），不能影响正常的在线使用。

const DB_NAME = 'resale-offline';
const STORE = 'query-cache';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable'));
  }
  if (dbPromise) return dbPromise;
  const opening = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB blocked'));
  }).catch(err => {
    // 失败不缓存，下次调用可重试
    dbPromise = null;
    throw err;
  });
  dbPromise = opening;
  return opening;
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

export function idbGet<T>(key: string): Promise<T | undefined> {
  return run<T | undefined>('readonly', s => s.get(key) as IDBRequest<T | undefined>);
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  await run('readwrite', s => s.put(value, key));
}

export async function idbDelete(key: string): Promise<void> {
  await run('readwrite', s => s.delete(key));
}

export async function idbClear(): Promise<void> {
  await run('readwrite', s => s.clear());
}
