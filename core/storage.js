const KEY_ROWS = "silo.dataset.rows.v1";
const KEY_META = "silo.dataset.meta.v1";

export function loadDataset(){
  try{ return JSON.parse(localStorage.getItem(KEY_ROWS) || "null"); }catch(e){ return null; }
}
export function loadMeta(){
  try{ return JSON.parse(localStorage.getItem(KEY_META) || "null"); }catch(e){ return null; }
}
export function saveDataset(rows, meta={}){
  localStorage.setItem(KEY_ROWS, JSON.stringify(rows || []));
  localStorage.setItem(KEY_META, JSON.stringify(meta || {}));
}
export function clearDataset(){
  localStorage.removeItem(KEY_ROWS);
  localStorage.removeItem(KEY_META);
}
