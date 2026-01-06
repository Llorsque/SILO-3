const DB_NAME = "silo_db_v1";
const STORE = "kv";

const KEY_META = "silo.dataset.meta.v2"; // keep meta small in localStorage

function openDb(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if(!db.objectStoreNames.contains(STORE)){
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, value){
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGet(key){
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbClear(){
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).clear();
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Dataset payload stored in IndexedDB:
 * {
 *   results: NormalizedResultRow[],
 *   skaters: SkaterRow[],
 *   relay: RelayRow[],
 *   teams: TeamRow[],
 *   wtNames: WTNameRow[],
 *   nameMap: { [normalizedKey]: canonicalName }
 * }
 */

export async function loadDataset(){
  try{
    return await idbGet("dataset") || null;
  }catch(e){
    console.warn("[SILO] loadDataset failed", e);
    return null;
  }
}

export function loadMeta(){
  try{
    const raw = localStorage.getItem(KEY_META);
    return raw ? JSON.parse(raw) : null;
  }catch(e){ return null; }
}

export async function saveDataset(payload, meta={}){
  // Meta stays small and safe for localStorage
  const safeMeta = {
    ...meta,
    updatedAt: new Date().toISOString()
  };
  try{
    localStorage.setItem(KEY_META, JSON.stringify(safeMeta));
  }catch(e){
    console.warn("[SILO] localStorage meta write failed", e);
  }
  await idbSet("dataset", payload || null);
  return true;
}

export async function clearDataset(){
  localStorage.removeItem(KEY_META);
  await idbClear();
}
