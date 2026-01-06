import { saveDataset } from "./storage.js";

function findSheetName(wb, preferred){
  const names = wb.SheetNames || [];
  const low = preferred.toLowerCase();
  return names.find(n => String(n).trim().toLowerCase() === low) || null;
}

export async function importExcelFile(file){
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type:"array" });
  const sheetName = findSheetName(wb, "results");
  if(!sheetName) throw new Error("SILO verwacht een tabblad genaamd 'results'.");
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { defval:"" });
  const meta = {
    sheetName,
    rowCount: rows.length,
    columns: rows[0] ? Object.keys(rows[0]) : [],
    updatedAt: new Date().toISOString()
  };
  saveDataset(rows, meta);
  return { rows, meta };
}
