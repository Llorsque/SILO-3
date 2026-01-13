import { el, clear } from "../../core/dom.js";
import { sectionCard } from "../../core/layout.js";
import { loadDataset } from "../../core/storage.js";

function injectFinalPresStyles(){
  const id = "silo-finalpres-styles";
  if(document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
  .finalPres__nav{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:12px;
    margin-bottom:10px;
  }
  .finalPres__navLabel{
    flex:1;
    text-align:center;
    opacity:.85;
    letter-spacing:.04em;
  }
  .finalPres__nav button{
    width:44px;
    height:36px;
    display:flex;
    align-items:center;
    justify-content:center;
    padding:0;
  }
  .finalPres__pos{
    display:flex;
    align-items:center;
    justify-content:center;
    text-align:center;
    font-weight:700;
    line-height:1;
  }
  .finalPres__metaBlock{
    margin-top:6px;
    display:flex;
    flex-direction:column;
    gap:4px;
    font-size:0.95rem;
    opacity:0.9;
  }
  .finalPres__metaItem{
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
  }
  `;
  document.head.appendChild(style);
}



function normalizeSpaces(s){
  return String(s ?? "").replace(/\s+/g, " ").trim();
}

function nameKey(name){
  return normalizeSpaces(name).toLowerCase();
}

function parseDob(raw){
  // raw can be Date, number (Excel serial), or string
  if(!raw) return null;
  if(raw instanceof Date && !isNaN(raw.getTime())) return raw;
  if(typeof raw === "number" && isFinite(raw)){
    const ms = Math.round((raw - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  const s = String(raw).trim();
  if(!s) return null;
  // dd-mm-yyyy
  const m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if(m){
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function calcAge(dob){
  const d = parseDob(dob);
  if(!d) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if(m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

function typeableDropdown({ placeholder, value, options, onChange }){
  const wrap = el("div", { class:"dropdown" });
  const input = el("input", { class:"input", placeholder, value: value || "" });
  const list = el("div", { class:"dropdown__list" });
  let open = false;

  function setOpen(v){
    open = v;
    if(open) list.classList.add("dropdown__list--open");
    else list.classList.remove("dropdown__list--open");
  }

  function render(){
    clear(list);
    const q = (input.value || "").toLowerCase().trim();
    const filtered = options
      .filter(o => String(o).toLowerCase().includes(q))
      .slice(0, 200);

    if(!filtered.length){
      list.appendChild(el("div", { class:"dropdown__item dropdown__item--muted" }, "Geen resultaten"));
      return;
    }

    for(const opt of filtered){
      const item = el("button", { type:"button", class:"dropdown__item" }, String(opt));
      item.addEventListener("click", ()=>{
        input.value = String(opt);
        onChange(String(opt));
        setOpen(false);
      });
      list.appendChild(item);
    }
  }

  input.addEventListener("focus", ()=>{ setOpen(true); render(); });
  input.addEventListener("input", ()=>{ setOpen(true); render(); });
  input.addEventListener("keydown", (e)=>{ if(e.key === "Escape") setOpen(false); });

  document.addEventListener("click", (e)=>{ if(!wrap.contains(e.target)) setOpen(false); });

  wrap.appendChild(input);
  wrap.appendChild(list);
  return wrap;
}

function getSkaterDisplay(row){
  const name = row?.SKATERS || row?.Skaters || row?.skaters || "";
  const nat = row?.NAT || row?.Nat || row?.["Nat."] || "";
  const team = row?.TEAM || row?.Team || "";
  const dob = row?.DOB || row?.Dob || "";
  const age = calcAge(dob);
  const opm = row?.OPMERKING || row?.Opmerking || "";
  return {
    name: normalizeSpaces(name),
    nat: normalizeSpaces(nat),
    team: normalizeSpaces(team),
    dob,
    age,
    remark: normalizeSpaces(opm)
  };
}

function buildWtNameMap(wtRows){
  const map = new Map();
  for(const r of (wtRows || [])){
    const nat = normalizeSpaces(r?.NAT || r?.Nat || "");
    const wt = normalizeSpaces(r?.["WT NAME"] || r?.WT_NAME || r?.WTNAME || r?.["WTNAME"] || "");
    if(nat && wt && !map.has(nat)) map.set(nat, wt);
  }
  return map;
}function medalEmoji(pos){
  if(pos === 1) return "🥇";
  if(pos === 2) return "🥈";
  if(pos === 3) return "🥉";
  return "";
}

function tournamentPriority(name){
  const low = String(name||"").toLowerCase();
  if(low.includes("olymp")) return 0;
  if(low.includes("wereld")) return 1;
  if(low.includes("europe")) return 2;
  // Eindklassement/Overall World Cup / World Tour
  if(low.includes("world cup") || low.includes("world tour")) return 3;
  if(low.includes("neder")) return 4;
  return 99;
}

function isEligibleRun(row){
  const tLow = String(row?.tournament||"").toLowerCase();
  const rk = String(row?.runKey || "").toLowerCase();
  if(tLow.includes("world cup") || tLow.includes("world tour")){
    return rk === "eindklassement";
  }
  return rk === "final a" || rk === "final";
}

function getTopResults(ds, skaterName){
  const results = Array.isArray(ds?.results) ? ds.results : [];
  // Eligible top results: pos 1..5, and run is Final/Final A, except WC/WT where we only use Eindklassement/Overall.
  const rows = results.filter(r =>
    r?.skaterName === skaterName &&
    r?.pos != null &&
    r.pos >= 1 &&
    r.pos <= 5 &&
    isEligibleRun(r)
  );

  // Sort: pos first (1 best), then tournament priority (OS > WK > EK > Overall WC/WT > NK), then season desc.
  const ranked = rows
    .map(r => ({ ...r, _prio: tournamentPriority(r.tournament), _season: Number(r.season) || 0 }))
    .sort((a,b) =>
      ((a.pos||99) - (b.pos||99)) ||
      (a._prio - b._prio) ||
      (b._season - a._season)
    );

  // Merge duplicates that only differ by date (or other minor fields) by grouping on pos+tournament+distance.
  const groups = [];
  const seen = new Map();

  for(const r of ranked){
    const t = normalizeSpaces(r.tournament || "");
    const d = normalizeSpaces(r.distanceRaw || r.distance || "");
    const key = `${r.pos}|${t}|${d}`;
    if(!seen.has(key)){
      const g = {
        pos: r.pos,
        tournament: t,
        distanceRaw: d,
        years: new Set(),
      };
      seen.set(key, g);
      groups.push(g);
      if(groups.length >= 5) break;
    }
    const g = seen.get(key);
    if(r.season != null) g.years.add(String(r.season));
  }

  // Finalize years as sorted list (desc)
  return groups.map(g => ({
    pos: g.pos,
    tournament: g.tournament,
    distanceRaw: g.distanceRaw,
    years: Array.from(g.years).sort((a,b)=> (Number(b)||0) - (Number(a)||0)),
  }));
}

function countTitles(ds, skaterName){
  const results = Array.isArray(ds?.results) ? ds.results : [];
  // IMPORTANT: Titles must be computed from the SAME eligible subset as the
  // displayed top-results logic, otherwise you can get "WK X" without any
  // corresponding rows in the list.
  //
  // Rule: only OS/WK/EK/NK, only Pos=1, only Final/Final A (case-insensitive).
  // World Cup/World Tour must NEVER be counted as WK.
  const rows = results.filter(r =>
    r?.skaterName === skaterName &&
    r?.pos === 1 &&
    isEligibleRun(r)
  );

  const counts = { OS:0, WK:0, EK:0, NK:0 };
  const seen = new Set();

  function category(tournament){
    const tLow = String(tournament ?? "").toLowerCase();

    // Explicitly exclude WC/WT from title categories.
    if(tLow.includes("world cup") || tLow.includes("world tour")) return null;

    // Be strict to prevent false positives like "world cup" being counted as WK.
    if(tLow.includes("olymp")) return "OS";
    if(tLow.includes("wereldkampioenschap") || tLow.includes("world championship")) return "WK";
    if(tLow.includes("europees kampioenschap") || tLow.includes("european championship") || tLow.includes("europ")) return "EK";
    if(tLow.includes("nederlands kampioenschap") || tLow.includes("dutch championship") || tLow.includes("neder")) return "NK";
    return null;
  }

  for(const r of rows){
    const cat = category(r.tournament);
    if(!cat) continue;

    const dist = normalizeSpaces(r.distanceRaw || r.distance || "");
    const season = String(r.season ?? "");
    if(!dist || !season) continue;
    const key = `${cat}|${season}|${dist}`;
    if(seen.has(key)) continue;
    seen.add(key);
    counts[cat] += 1;
  }
  return counts;
}

export async function mountFinalPresentation(root){
  injectFinalPresStyles();
  clear(root);

  const ds = await loadDataset();

  const state = {
    picks: Array.from({length:8}, ()=>""), // canonical skater names
    windowIndex: 0
  };

  const skaterRows = ds?.skaters || [];
  const wtMap = buildWtNameMap(ds?.wtNames || []);

  // Build lookup by name (canonical)
  const byName = new Map();
  const skaterNames = [];
  for(const r of skaterRows){
    const disp = getSkaterDisplay(r);
    if(!disp.name) continue;
    const key = nameKey(disp.name);
    if(!byName.has(key)) byName.set(key, { ...disp });
    skaterNames.push(disp.name);
  }
  skaterNames.sort((a,b)=>a.localeCompare(b, "nl", { sensitivity:"base" }));

  function getPick(posIdx){
    const name = state.picks[posIdx] || "";
    if(!name) return null;
    return byName.get(nameKey(name)) || { name, nat:"", team:"", age:null };
  }

  function shift(delta){
    const next = state.windowIndex + delta;
    const maxIndex = 6; // show 2 cards (index and index+1)
    state.windowIndex = Math.max(0, Math.min(maxIndex, next));
    render();
  }

function renderTopResults(pick){
  const lines = ds ? getTopResults(ds, pick.name) : [];
  if(!ds){
    return el("div", { class:"notice" }, "Upload eerst een dataset om resultaten te tonen.");
  }

  const wrap = el("div");

  // Titles summary (only position 1, OS/WK/EK/NK)
  const titles = countTitles(ds, pick.name);
  const titlesBox = el("div", { style:"margin-top:2px" }, [
    el("div", { class:"finalPres__sectionTitle", style:"margin-bottom:8px" }, "Titels (positie 1)"),
    el("div", { style:"display:flex; gap:10px; flex-wrap:wrap" }, [
      el("div", { style:"display:flex; gap:6px; align-items:baseline; padding:6px 10px; border:1px solid rgba(255,255,255,.08); border-radius:999px" }, [el("span", { class:"muted" }, "OS"), el("span", { class:"strong" }, `${titles.OS}`)]),
      el("div", { style:"display:flex; gap:6px; align-items:baseline; padding:6px 10px; border:1px solid rgba(255,255,255,.08); border-radius:999px" }, [el("span", { class:"muted" }, "WK"), el("span", { class:"strong" }, `${titles.WK}`)]),
      el("div", { style:"display:flex; gap:6px; align-items:baseline; padding:6px 10px; border:1px solid rgba(255,255,255,.08); border-radius:999px" }, [el("span", { class:"muted" }, "EK"), el("span", { class:"strong" }, `${titles.EK}`)]),
      el("div", { style:"display:flex; gap:6px; align-items:baseline; padding:6px 10px; border:1px solid rgba(255,255,255,.08); border-radius:999px" }, [el("span", { class:"muted" }, "NK"), el("span", { class:"strong" }, `${titles.NK}`)]),
    ])
  ]);
  wrap.appendChild(titlesBox);

  if(!lines.length){
    wrap.appendChild(el("div", { class:"notice", style:"margin-top:10px" }, "Geen top-5 resultaten gevonden binnen de prioriteitstoernooien (Final/Final A of Eindklassement)."));
    return wrap;
  }

  const list = el("div", { class:"finalPres__resultsList", style:"margin-top:10px" });
  for(const r of lines){
    const medal = medalEmoji(r.pos);
    const yearsText = Array.isArray(r.years) && r.years.length ? r.years.join(", ") : (r.season || "—");
    const text = `${r.pos} - ${r.tournament || "—"} - ${(r.distanceRaw || "—")} - ${yearsText}`;
    list.appendChild(el("div", { class:"finalPres__resultRow" }, [
      el("span", { class:"finalPres__resultMedal" }, medal ? medal : ""),
      el("span", { class:"finalPres__resultText" }, text)
    ]));
  }
  wrap.appendChild(list);
  return wrap;
}

  function makeSkaterCard(posIdx){
    const pos = posIdx + 1;
    const pick = getPick(posIdx);

    if(!pick){
      return el("div", { class:"card finalPres__card finalPres__card--empty" }, [
        el("div", { class:"finalPres__cardTop" }, [
          el("div", { class:"finalPres__pos" }, `${pos}`),
        ]),
        el("div", { class:"notice" }, "Nog geen rijder geselecteerd.")
      ]);
    }

    const wtName = wtMap.get(pick.nat) || pick.team || "";
    const metaBlock = el("div", { class:"finalPres__metaBlock" }, [
      el("div", { class:"finalPres__metaItem" }, (pick.nat || "—")),
      el("div", { class:"finalPres__metaItem" }, (wtName || "—")),
      el("div", { class:"finalPres__metaItem" }, ((pick.age ?? "—") + " jaar")),
    ]);

    return el("div", { class:"card finalPres__card" }, [
      el("div", { class:"finalPres__cardTop" }, [
        el("div", { class:"finalPres__pos" }, `${pos}`),
        el("div", { class:"finalPres__name" }, pick.name || "—"),
      ]),
      metaBlock,
      el("div", { style:"height:12px" }),
      el("div", { class:"finalPres__sectionTitle" }, "Belangrijkste resultaten"),
      renderTopResults(pick),
    ]);
  }

  function render(){
    clear(root);

    const content = [];

    // Startposities (2 rijen van 4)
    const picksGrid = el("div", { class:"finalPres__picksGrid" });
    for(let i=0;i<8;i++){
      const label = el("div", { class:"filterLabel" }, `Startpositie ${i+1}`);
      const dd = typeableDropdown({
        placeholder: "Selecteer rijder…",
        value: state.picks[i] || "",
        options: skaterNames,
        onChange: (v)=>{ state.picks[i] = v; render(); }
      });
      picksGrid.appendChild(el("div", { class:"finalPres__pickCell" }, [label, dd]));
    }

    const picksCard = el("div", { class:"finalPres__picksCard" }, [
      el("div", { class:"muted", style:"margin-bottom:10px" }, "Selecteer rijders per startpositie (max 8)."),
      picksGrid
    ]);
    content.push(picksCard);

    // Viewer (2 kaarten + navigatie)
    const navPrev = el("button", {
      class: state.windowIndex === 0 ? "btn btn--ghost btn--disabled" : "btn btn--ghost",
      type:"button",
      onclick: ()=>shift(-1)
    }, "◀");
    navPrev.disabled = state.windowIndex === 0;

    const navNext = el("button", {
      class: state.windowIndex === 6 ? "btn btn--ghost btn--disabled" : "btn btn--ghost",
      type:"button",
      onclick: ()=>shift(1)
    }, "▶");
    navNext.disabled = state.windowIndex === 6;

    const nav = el("div", { class:"finalPres__nav" }, [
      navPrev,
      el("div", { class:"finalPres__navLabel" }, `Startpositie ${state.windowIndex+1} & ${state.windowIndex+2}`),
      navNext,
    ]);

    const viewerGrid = el("div", { class:"finalPres__viewer" }, [
      makeSkaterCard(state.windowIndex),
      makeSkaterCard(state.windowIndex+1)
    ]);

    const viewerWrap = el("div", { class:"finalPres__viewerWrap" }, [nav, viewerGrid]);
    content.push(viewerWrap);


    // Dataset missing notice
    if(!ds){
      content.unshift(el("div", { class:"notice" }, "Nog geen dataset geladen. Upload eerst een Excel in het hoofdmenu."));
    }

    root.appendChild(sectionCard({
      title:"A Final presentation",
      subtitle:"Selecteer rijders op startpositie en blader door de kaarten (max 2 tegelijk zichtbaar).",
      children: content
    }));
  }

  render();
}
