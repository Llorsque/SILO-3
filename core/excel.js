import { saveDataset } from "./storage.js";

const ALLOWED_SHEETS = ["Results","Skaters","Relay","Teams","WT Names"];
const BLOCKED_SHEETS = ["Rijder draaitabel","Toernooi draaitabel","Relay draaitabel","relay draaitabl","toernooi draaitabel","rijder draaitabel"];

function normSheetName(s){ return String(s || "").trim().toLowerCase(); }

function findSheetName(wb, preferred){
  const names = wb.SheetNames || [];
  const target = normSheetName(preferred);
  return names.find(n => normSheetName(n) === target) || null;
}

function normalizeSpaces(s){
  return String(s ?? "").replace(/\s+/g, " ").trim();
}

function nameKey(name){
  return normalizeSpaces(name).toLowerCase();
}

function parseExcelDate(v){
  // v can be Date, number(serial), or string dd-mm-yyyy
  if(!v) return null;
  if(v instanceof Date && !isNaN(v.getTime())) return v.toISOString();
  if(typeof v === "number" && isFinite(v)){
    // Excel 1900 date system
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if(m){
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function formatDistance(raw){
  const s = normalizeSpaces(raw).toLowerCase();
  if(!s) return "";
  if(s.includes("overall") || s.includes("eindklassement")) return "Eindklassement";
  if(s.includes("500")) return "500m";
  if(s.includes("1000")) return "1000m";
  if(s.includes("1500")) return "1500m";
  if(s.includes("3000")) return "3000m";
  return normalizeSpaces(raw);
}

function formatSex(raw){
  const s = normalizeSpaces(raw).toLowerCase();
  if(s.startsWith("m")) return "man";
  if(s.startsWith("v")) return "vrouw";
  return s || "";
}

function runKey(raw){
  const s = normalizeSpaces(raw).toLowerCase();
  if(s.includes("final a")) return "final a";
  if(s === "final") return "final";
  if(s.includes("final")) return "final";
  if(s.includes("eind") || s.includes("overall")) return "eindklassement";
  return s;
}

function tournamentName(raw){
  const s = normalizeSpaces(raw);
  const low = s.toLowerCase();
  if(low.includes("olymp")) return "Olympische Spelen";
  if(low.includes("wereld")) return "Wereldkampioenschap";
  if(low.includes("europe")) return "Europees kampioenschap";
  if(low.includes("neder")) return "Nederlands kampioenschap";
  if(low.includes("four")) return "Four Continents";
  if(low.includes("world cup") || low.includes("world tour")) return "World Cup / World Tour";
  return s; // fallback
}

function tournamentShort(name){
  const low = String(name||"").toLowerCase();
  if(low.includes("olymp")) return "OS";
  if(low.includes("wereld")) return "WK";
  if(low.includes("europe")) return "EK";
  if(low.includes("neder")) return "NK";
  if(low.includes("four")) return "4C";
  if(low.includes("world cup") || low.includes("world tour")) return "WC";
  return name ? name.slice(0,3).toUpperCase() : "";
}

function normalizeSeason(v){
  if(v == null) return null;
  if(typeof v === "number" && isFinite(v)) return Math.trunc(v);
  const s = String(v).trim();
  // if "1991/1992" -> take last year
  const years = s.match(/(19\d{2}|20\d{2})/g);
  if(years && years.length) return Number(years[years.length-1]);
  const n = Number(s);
  return isFinite(n) ? Math.trunc(n) : null;
}

function buildNameMapFromSkaters(skatersRows){
  // Skaters sheet has headers: ORIGINAL, (blank), (blank), SKATERS, NAT, ...
  const map = {};
  for(const r of skatersRows){
    const original = r.ORIGINAL ?? r["ORIGINAL"] ?? r[0];
    const skaters = r.SKATERS ?? r["SKATERS"] ?? r[3];
    if(!skaters) continue;
    const canon = normalizeSpaces(skaters);
    if(original) map[nameKey(original)] = canon;
    map[nameKey(canon)] = canon;
  }
  return map;
}

function sheetToRows(wb, sheetName){
  const ws = wb.Sheets[sheetName];
  // Use objects for most sheets
  return XLSX.utils.sheet_to_json(ws, { defval:"" });
}

export async function importExcelFile(file){
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type:"array" });

  // Find whitelisted sheets (case-insensitive)
  const found = {};
  const missing = [];
  for(const s of ALLOWED_SHEETS){
    const real = findSheetName(wb, s);
    if(real) found[s] = real; else missing.push(s);
  }

  if(!found["Results"]){
    throw new Error("SILO verwacht een tabblad genaamd 'Results' (exact of hoofdletter-ongevoelig).");
  }
  if(!found["Skaters"]){
    throw new Error("SILO verwacht een tabblad genaamd 'Skaters'.");
  }

  // Identify blocked sheets present (we ignore them always)
  const presentBlocked = (wb.SheetNames || []).filter(n => BLOCKED_SHEETS.includes(n) || BLOCKED_SHEETS.includes(normSheetName(n)));

  const resultsRowsRaw = sheetToRows(wb, found["Results"]);
  const skatersRowsRaw = sheetToRows(wb, found["Skaters"]);
  const relayRowsRaw = found["Relay"] ? sheetToRows(wb, found["Relay"]) : [];
  const teamsRowsRaw = found["Teams"] ? sheetToRows(wb, found["Teams"]) : [];
  const wtNamesRowsRaw = found["WT Names"] ? sheetToRows(wb, found["WT Names"]) : [];

  const map = buildNameMapFromSkaters(skatersRowsRaw);

  const results = resultsRowsRaw.map((r, idx) => {
    const run = r.Run ?? r.Race ?? r["Run of Race"] ?? "";
    const pos = r["Pos."] ?? r.Ranking ?? r["Pos. of Ranking"] ?? "";
    const naam = r.Naam ?? r["Naam"] ?? r["Name"] ?? "";
    const nat = r["Nat."] ?? r.Nat ?? "";
    const opm = r.Opmerking ?? r["Opmerking"] ?? "";
    const wedstrijd = r.Wedstrijd ?? r["Wedstrijd"] ?? "";
    const locatie = r.Locatie ?? r["Locatie"] ?? "";
    const afstand = r.Afstand ?? r["Afstand"] ?? "";
    const datum = r.Datum ?? r["Datum"] ?? "";
    const seizoen = r.Seizoen ?? r["Seizoen"] ?? "";
    const sekse = r.Sekse ?? r["Sekse"] ?? "";
    const winnaar = r.winnaar ?? r.Winnaar ?? r["winnaar"] ?? r["Winnaar"] ?? "";

    const canon = map[nameKey(naam)] || normalizeSpaces(naam);

    const tName = tournamentName(wedstrijd);
    const dist = formatDistance(afstand);

    return {
      _idx: idx,
      runRaw: normalizeSpaces(run),
      runKey: runKey(run),
      posRaw: pos,
      pos: Number(pos) || null,
      nameRaw: normalizeSpaces(naam),
      skaterName: canon,
      nat: normalizeSpaces(nat),
      opmerking: normalizeSpaces(opm),
      wedstrijdRaw: normalizeSpaces(wedstrijd),
      tournament: tName,
      tournamentShort: tournamentShort(tName),
      locatie: normalizeSpaces(locatie),
      afstandRaw: normalizeSpaces(afstand),
      distance: dist,
      dateISO: parseExcelDate(datum),
      seizoenRaw: seizoen,
      season: normalizeSeason(seizoen),
      sekseRaw: normalizeSpaces(sekse),
      sex: formatSex(sekse),
      winnaarRaw: normalizeSpaces(winnaar)
    };
  });

  const meta = {
    allowedSheets: Object.values(found),
    ignoredSheets: presentBlocked,
    rowCounts: {
      results: resultsRowsRaw.length,
      skaters: skatersRowsRaw.length,
      relay: relayRowsRaw.length,
      teams: teamsRowsRaw.length,
      wtNames: wtNamesRowsRaw.length
    }
  };

  await saveDataset({
    results,
    skaters: skatersRowsRaw,
    relay: relayRowsRaw,
    teams: teamsRowsRaw,
    wtNames: wtNamesRowsRaw,
    nameMap: map
  }, meta);

  return { meta };
}
