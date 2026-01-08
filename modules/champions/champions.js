import { el, clear } from "../../core/dom.js";
import { sectionCard } from "../../core/layout.js";
import { router } from "../../core/router.js";
import { loadDataset, loadMeta } from "../../core/storage.js";

function chip(label, active, onClick){
  const b = el("button", { type:"button", class: active ? "chip chip--on" : "chip" }, label);
  b.addEventListener("click", onClick);
  return b;
}

function medalIcon(pos){
  if(pos === 1) return "🥇";
  if(pos === 2) return "🥈";
  if(pos === 3) return "🥉";
  return "";
}

function sortBtn(label, key){
  const active = state.sortKey === key;
  const icon = !active ? "⇅" : (state.sortDir === 1 ? "▲" : "▼");
  const btn = el("button", { type:"button", class:"btn btn--ghost sortBtn", title:`Sorteer ${label}` }, icon);
  btn.addEventListener("click", ()=>{
    if(state.sortKey === key){
      state.sortDir = state.sortDir === 1 ? -1 : 1;
    }else{
      state.sortKey = key;
      state.sortDir = 1;
    }
    render();
  });
  return btn;
}

function thSortable(label, key){
  return el("th", null, el("div", { class:"thWrap" }, [ label, sortBtn(label, key) ]));
}


function fmtDate(iso){
  if(!iso) return "";
  const d = new Date(iso);
  if(isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2,"0");
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const yy = d.getFullYear();
  return `${dd}-${mm}-${yy}`;
}

function buildEventKey(r){
  // For comparing same result/event: tournament+season+location+date+distance+sex
  return [r.tournament, r.season, r.locatie, r.dateISO ? r.dateISO.slice(0,10) : "", r.distance, r.sex].join("|");
}

function normalizeSetToggle(set, value){
  if(set.has(value)) set.delete(value);
  else set.add(value);
}

function typeableDropdown({placeholder, value, options, onChange}

function multiSelectDropdown({ placeholder, options, selected, onToggle, onClear }){
  const wrap = el("div", { class:"dropdown" });
  const input = el("input", { class:"input", placeholder, value:"", readonly:true });
  const list = el("div", { class:"dropdown__list" });

  function label(){
    if(!selected || selected.size === 0) return placeholder;
    const arr = Array.from(selected);
    if(arr.length <= 2) return arr.join(", ");
    return `${arr[0]}, ${arr[1]} +${arr.length-2}`;
  }

  let open = false;
  function setOpen(v){
    open = v;
    list.classList.toggle("dropdown__list--open", open);
    input.classList.toggle("dropdown__open", open);
  }

  function renderList(){
    clear(list);

    const allItem = el("div", { class:"dropdown__item" }, [
      el("input", { type:"checkbox", checked: selected.size === 0, style:"pointer-events:none" }),
      el("span", { style:"margin-left:10px; font-weight:900" }, "All")
    ]);
    allItem.addEventListener("click", ()=>{ onClear?.(); input.value = label(); renderList(); });
    list.appendChild(allItem);

    for(const opt of options){
      const checked = selected.has(opt);
      const item = el("div", { class:"dropdown__item" }, [
        el("input", { type:"checkbox", checked, style:"pointer-events:none" }),
        el("span", { style:"margin-left:10px" }, String(opt))
      ]);
      item.addEventListener("click", ()=>{
        onToggle(opt);
        input.value = label();
        renderList();
      });
      list.appendChild(item);
    }
  }

  input.value = label();
  input.addEventListener("click", (e)=>{ e.stopPropagation(); setOpen(!open); if(!open) return; renderList(); });
  document.addEventListener("click", ()=> setOpen(false));

  wrap.appendChild(input);
  wrap.appendChild(list);

  return { wrap };
}
){
  const wrap = el("div", { class:"dropdown" });
  const input = el("input", { class:"input", placeholder, value: value || "" });
  const list = el("div", { class:"dropdown__list" });

  let open = false;
  function renderList(){
    clear(list);
    const q = (input.value || "").toLowerCase().trim();
    const filtered = options.filter(o => o.toLowerCase().includes(q)).slice(0, 60);
    if(!filtered.length){
      list.appendChild(el("div", { class:"dropdown__item dropdown__item--muted" }, "Geen resultaten"));
      return;
    }
    for(const o of filtered){
      const it = el("div", { class:"dropdown__item" }, o);
      it.addEventListener("click", () => {
        onChange(o);
        open = false;
        list.classList.remove("dropdown__list--open");
      });
      list.appendChild(it);
    }
  }

  function setOpen(v){
    open = v;
    if(open){
      renderList();
      list.classList.add("dropdown__list--open");
    }else{
      list.classList.remove("dropdown__list--open");
    }
  }

  input.addEventListener("focus", ()=> setOpen(true));
  input.addEventListener("input", ()=> { if(!open) setOpen(true); renderList(); });
  input.addEventListener("keydown", (e)=>{
    if(e.key === "Escape") setOpen(false);
  });

  document.addEventListener("click", (e)=>{
    if(!wrap.contains(e.target)) setOpen(false);
  });

  wrap.appendChild(input);
  wrap.appendChild(list);
  return { wrap, input };
}

export async function mountChampions(root){
  clear(root);

  const meta = loadMeta();
  const dataset = await loadDataset();

  if(!dataset?.results?.length){
    root.appendChild(sectionCard({
      title:"Kampioenen",
      subtitle:"Upload eerst een Excel met tabblad 'Results' en 'Skaters'.",
      children:[
        el("div", { class:"notice" }, "Geen dataset gekoppeld (of leeg). Ga terug naar Menu en upload je Excel."),
        el("div", { style:"height:10px" }),
        el("button", { class:"btn", type:"button", onclick:()=>router.go("home") }, "Terug naar menu")
      ]
    }));
    return;
  }

  const resultsAll = dataset.results;

  // Allowed tournaments for this module (plus WC which we restrict to Eindklassement)
  const tournamentOptions = [
    "Europees kampioenschap",
    "Wereldkampioenschap",
    "Nederlands kampioenschap",
    "Olympische Spelen",
    "Four Continents",
    "World Cup / World Tour"
  ];

  const state = {
    tournaments: new Set(),  // multi
    years: new Set(),        // multi (Seizoen)
    distances: new Set(),    // multi
    sexes: new Set(),        // multi (man/vrouw)
    medals: new Set(),       // multi (1/2/3)
    nats: new Set(),         // multi
    rider: "" ,               // single
    sortKey: "",
    sortDir: 1
  };

  // Build base years list from dataset seasons
  function allYearsForSelection(rows){
    const years = new Set();
    for(const r of rows){
      if(r?.season) years.add(r.season);
    }
    return Array.from(years).sort((a,b)=>a-b);
  }

  // Build distances list (we show only the main ones + Eindklassement)
  function allDistancesForSelection(rows){
    const dist = new Set();
    for(const r of rows){
      if(r?.distance) dist.add(r.distance);
    }
    const preferred = ["500m","1000m","1500m","3000m","Eindklassement"];
    const out = preferred.filter(d => dist.has(d));
    for(const d of Array.from(dist).sort()){
      if(!out.includes(d)) out.push(d);
    }
    return out;
  }

  function filterRows(){
    return resultsAll.filter(r => {
      // tournament whitelist for module
      if(!tournamentOptions.includes(r.tournament)) return false;

      // WC restriction: only Eindklassement
      if(r.tournament === "World Cup / World Tour" && r.distance !== "Eindklassement") return false;

      if(state.tournaments.size && !state.tournaments.has(r.tournament)) return false;
      if(state.years.size && !state.years.has(r.season)) return false;
      if(state.distances.size && !state.distances.has(r.distance)) return false;
      if(state.sexes.size && !state.sexes.has(r.sex)) return false;
      if(state.medals.size && !state.medals.has(r.pos)) return false;
      if(state.rider && r.skaterName !== state.rider) return false;
      if(state.nats.size && !state.nats.has(String(r.nat||""))) return false;

      // champions: top 3 only
      if(!(r.pos === 1 || r.pos === 2 || r.pos === 3)) return false;

      // For non-eindklassement: require Final A/Final (best-effort)
      if(r.distance !== "Eindklassement"){
        if(!(r.runKey === "final a" || r.runKey === "final")) return false;
      }else{
        // For eindklassement: accept run labeled eindklassement or anything with overall/eind
        if(r.runKey !== "eindklassement"){
          // sometimes still "Final" in data; we keep it flexible for overall
          // but only allow if the run mentions eind/overall in raw string
          const low = String(r.runRaw||"").toLowerCase();
          if(!(low.includes("eind") || low.includes("overall"))) return false;
        }
      }

      return true;
    });
  }

  function dedupeTop3(rows){
    // Dedupe per category+pos. Keep earliest date.
    const sorted = [...rows].sort((a,b)=>{
      const da = a.dateISO ? new Date(a.dateISO).getTime() : 0;
      const db = b.dateISO ? new Date(b.dateISO).getTime() : 0;
      return da - db;
    });
    const seen = new Map();
    for(const r of sorted){
      const key = [r.tournament, r.season, r.distance, r.sex, r.pos].join("|");
      if(!seen.has(key)) seen.set(key, r);
    }
    return Array.from(seen.values());
  }

  
function sortDisplay(rows){
    const dir = state.sortDir || 1;
    const key = state.sortKey || "";
    const distVal = (d)=>{
      const s = String(d||"").toLowerCase();
      const m = s.match(/(\d+)/);
      if(m) return Number(m[1]);
      if(s.includes("eind")) return 999999;
      return 999998;
    };
    const medalVal = (p)=> (p===1?1:(p===2?2:(p===3?3:99)));

    const base = [...rows];

    // default order (stable)
    if(!key){
      const orderT = (t)=> {
        const i = tournamentOptions.indexOf(t);
        return i === -1 ? 99 : i;
      };
      return base.sort((a,b)=>{
        const ta = orderT(a.tournament), tb = orderT(b.tournament);
        if(ta!==tb) return ta-tb;
        if((a.season||0)!==(b.season||0)) return (a.season||0)-(b.season||0);
        if(String(a.distance).localeCompare(String(b.distance))) return String(a.distance).localeCompare(String(b.distance));
        if(String(a.sex).localeCompare(String(b.sex))) return String(a.sex).localeCompare(String(b.sex));
        return (a.pos||99)-(b.pos||99);
      });
    }

    return base.sort((a,b)=>{
      let av = "", bv = "";
      if(key === "year"){ av = a.season||0; bv = b.season||0; }
      else if(key === "distance"){ av = distVal(a.distance); bv = distVal(b.distance); }
      else if(key === "medal"){ av = medalVal(a.pos); bv = medalVal(b.pos); }
      else if(key === "tournament"){ av = String(a.tournament||""); bv = String(b.tournament||""); }
      else if(key === "nat"){ av = String(a.nat||""); bv = String(b.nat||""); }
      else { av = ""; bv = ""; }
      if(typeof av === "number" && typeof bv === "number") return (av-bv)*dir;
      return String(av).localeCompare(String(bv), "nl")*dir;
    });
  }


  // UI parts
  const header = el("div", { class:"row", style:"align-items:flex-end; gap:12px" }, [
    el("div", null, [
      el("div", { class:"card__title", style:"font-size:18px" }, "Kampioenen"),
      el("div", { class:"card__sub" }, "Top 3 per selectie (wedstrijd • seizoen • afstand • sekse).")
    ]),
    el("div", { class:"spacer" }),
    el("button", { class:"btn", type:"button" }, "Reset")
  ]);

  const resetBtn = header.querySelector("button");
  resetBtn.addEventListener("click", ()=>{
    state.tournaments.clear();
    state.years.clear();
    state.distances.clear();
    state.sexes.clear();
    state.medals.clear();
    state.rider = "";
    state.nats.clear();
    state.sortKey = "";
    state.sortDir = 1;
    render();
  });

  const summary = el("div", { class:"summaryTitle" }, "");

  const filtersWrap = el("div", { class:"filtersCard" });

  const medalSummaryWrap = el("div", { class:"medalSummaryGrid" });
  const tableWrap = el("div", { class:"tableWrap" });

  function render(){
    clear(filtersWrap);
    clear(medalSummaryWrap);
    clear(tableWrap);

    // Build rows based on current tournament selection for dynamic years/distances/rider lists
    const baseRows = resultsAll.filter(r => {
      if(!tournamentOptions.includes(r.tournament)) return false;
      if(r.tournament === "World Cup / World Tour" && r.distance !== "Eindklassement") return false;
      if(state.tournaments.size && !state.tournaments.has(r.tournament)) return false;
      if(state.sexes.size && !state.sexes.has(r.sex)) return false;
      if(state.distances.size && !state.distances.has(r.distance)) return false;
      if(state.years.size && !state.years.has(r.season)) return false;
      return true;
    });

    const years = allYearsForSelection(baseRows);
    const distances = allDistancesForSelection(baseRows);

    const riders = Array.from(new Set(baseRows.map(r => r.skaterName).filter(Boolean))).sort((a,b)=>a.localeCompare(b));
    const nats = Array.from(new Set(baseRows.map(r => r.nat).filter(Boolean))).sort((a,b)=>String(a).localeCompare(String(b)));

    // Filters layout
    const row1 = el("div", { class:"filtersRow" }, [
      el("div", { class:"filterGroup" }, [
        el("div", { class:"filterLabel" }, "Wedstrijd"),
        el("div", { class:"chipRow" }, tournamentOptions.map(t =>
          chip(t, state.tournaments.has(t), ()=>{ normalizeSetToggle(state.tournaments, t); render(); })
        ))
      ]),
      el("div", { class:"divider" }),
      el("div", { class:"filterGroup", style:"min-width:220px" }, [
        el("div", { class:"filterLabel" }, "Seizoen"),
        (() => {
          const selected = new Set(Array.from(state.years).map(v=>String(v)));
          const dd = multiSelectDropdown({
            placeholder: "Alle seizoenen",
            options: years.map(String),
            selected,
            onToggle: (val) => {
              const v = String(val);
              // store as number where possible
              const n = Number(v);
              const store = Number.isFinite(n) ? n : v;
              normalizeSetToggle(state.years, store);
              render();
            },
            onClear: ()=>{ state.years.clear(); render(); }
          });
          return dd.wrap;
        })()
      ])
    ]);

    const row2 = el("div", { class:"filtersRow" }, [
      el("div", { class:"filterGroup" }, [
        el("div", { class:"filterLabel" }, "Afstand"),
        el("div", { class:"chipRow" }, [
          chip("All", state.distances.size === 0, ()=>{ state.distances.clear(); render(); }),
          ...distances.map(d => chip(d, state.distances.has(d), ()=>{ normalizeSetToggle(state.distances, d); render(); }))
        ])
      ]),
      el("div", { class:"divider" }),
      el("div", { class:"filterGroup" }, [
        el("div", { class:"filterLabel" }, "Sekse"),
        el("div", { class:"chipRow" }, [
          chip("Man", state.sexes.has("man"), ()=>{ normalizeSetToggle(state.sexes, "man"); render(); }),
          chip("Vrouw", state.sexes.has("vrouw"), ()=>{ normalizeSetToggle(state.sexes, "vrouw"); render(); }),
        ])
      ]),
      el("div", { class:"divider" }),
      el("div", { class:"filterGroup" }, [
        el("div", { class:"filterLabel" }, "Medailles"),
        el("div", { class:"chipRow" }, [
          chip("All", state.medals.size === 0, ()=>{ state.medals.clear(); render(); }),
          chip("🥇 Goud", state.medals.has(1), ()=>{ normalizeSetToggle(state.medals, 1); render(); }),
          chip("🥈 Zilver", state.medals.has(2), ()=>{ normalizeSetToggle(state.medals, 2); render(); }),
          chip("🥉 Brons", state.medals.has(3), ()=>{ normalizeSetToggle(state.medals, 3); render(); }),
        ])
      ]),
      
      el("div", { class:"divider" }),
      el("div", { class:"filterGroup", style:"min-width:200px" }, [
        el("div", { class:"filterLabel" }, "Nationaliteit"),
        (() => {
          const selected = new Set(Array.from(state.nats).map(String));
          const dd = multiSelectDropdown({
            placeholder: "Alle landen",
            options: nats.map(String),
            selected,
            onToggle: (val) => {
              const v = String(val);
              normalizeSetToggle(state.nats, v);
              render();
            },
            onClear: ()=>{ state.nats.clear(); render(); }
          });
          return dd.wrap;
        })()
      ]),
      el("div", { class:"filterGroup", style:"min-width:260px; flex:1" }, [
        el("div", { class:"filterLabel" }, "Rijder"),
        (() => {
          const dd = typeableDropdown({
            placeholder: "Typ om te zoeken...",
            value: state.rider || "",
            options: ["", ...riders],
            onChange: (val)=>{ state.rider = val === "" ? "" : val; render(); }
          });
          // add a clear button visually via placeholder behavior
          dd.input.addEventListener("blur", ()=>{
            // if typed value doesn't match, keep typed but no filter until picked
          });
          return dd.wrap;
        })()
      ])
    ]);

    filtersWrap.appendChild(row1);
    filtersWrap.appendChild(el("div", { style:"height:10px" }));
    filtersWrap.appendChild(row2);

    // Result computation
    const filtered = filterRows();
    const deduped = dedupeTop3(filtered);
    const rows = sortDisplay(deduped);

    // Summary title based on current selection
    const tSel = state.tournaments.size ? Array.from(state.tournaments) : ["Alle wedstrijden"];
    const ySel = state.years.size ? Array.from(state.years).sort((a,b)=>a-b).join(", ") : "alle seizoenen";
    const dSel = state.distances.size ? Array.from(state.distances).join(", ") : "alle afstanden";
    const sSel = state.sexes.size ? Array.from(state.sexes).join(" & ") : "alle";
    const mSel = state.medals.size ? Array.from(state.medals).sort((a,b)=>a-b).map(p=>p===1?"goud":p===2?"zilver":"brons").join(", ") : "alle medailles";
    const rSel = state.rider ? `• ${state.rider}` : "";
    summary.textContent = `${tSel.join(" / ")} • ${ySel} • ${dSel} • ${sSel} • ${mSel}${rSel}`;


    // Medal summary cards (only when a specific rider is selected)
    if(state.rider){
      const tournamentsToShow = state.tournaments.size ? Array.from(state.tournaments) : [];
      if(!tournamentsToShow.length){
        medalSummaryWrap.appendChild(el("div", { class:"notice" }, "Selecteer ook een wedstrijd om het medaille-overzicht te zien."));
      }else{
        // Count medals for this rider within current selection, per tournament
        // Use deduped rows (unique medal per category+pos)
        const byT = new Map();
        for(const r of rows){
          if(!tournamentsToShow.includes(r.tournament)) continue;
          const cur = byT.get(r.tournament) || { gold:0, silver:0, bronze:0, total:0 };
          if(r.pos === 1) cur.gold += 1;
          if(r.pos === 2) cur.silver += 1;
          if(r.pos === 3) cur.bronze += 1;
          cur.total += 1;
          byT.set(r.tournament, cur);
        }
        for(const t of tournamentsToShow){
          const c = byT.get(t) || { gold:0, silver:0, bronze:0, total:0 };
          medalSummaryWrap.appendChild(el("div", { class:"medalCard" }, [
            el("div", { class:"medalCard__title" }, t),
            el("div", { class:"medalCard__row" }, [
              el("div", { class:"medalCard__item" }, ["🥇", el("span", { class:"medalCard__num" }, String(c.gold))]),
              el("div", { class:"medalCard__item" }, ["🥈", el("span", { class:"medalCard__num" }, String(c.silver))]),
              el("div", { class:"medalCard__item" }, ["🥉", el("span", { class:"medalCard__num" }, String(c.bronze))]),
            ]),
            el("div", { class:"medalCard__sub" }, `${c.total} medailles`)
          ]));
        }
      }
    }

    // Table
    if(!rows.length){
      tableWrap.appendChild(el("div", { class:"notice" }, "Geen resultaten met deze selectie."));
      return;
    }

    const table = el("table", { class:"dataTable" });
    const thead = el("thead", null, el("tr", null, [
      thSortable("Toernooi","tournament"),
      thSortable("Jaar","year"),
      thSortable("Afstand","distance"),
      el("th", null, "Pos."),
      thSortable("Medaille","medal"),
      el("th", null, "Rijder"),
      thSortable("Nat","nat"),
      el("th", null, "Locatie"),
      el("th", null, "Datum"),
    ]));
    table.appendChild(thead);

    const tbody = el("tbody");
    for(const r of rows){
      tbody.appendChild(el("tr", null, [
        el("td", null, r.tournamentShort || r.tournament),
        el("td", null, String(r.season || "")),
        el("td", null, r.distance || ""),
        el("td", null, String(r.pos || "")),
        el("td", null, el("span", { class:"medal" }, medalIcon(r.pos))),
        el("td", null, r.skaterName || r.nameRaw || ""),
        el("td", null, r.nat || ""),
        el("td", null, r.locatie || ""),
        el("td", null, fmtDate(r.dateISO)),
      ]));
    }
    table.appendChild(tbody);
    tableWrap.appendChild(table);
  }

  const card = sectionCard({
    title: "Kampioenen",
    subtitle: meta?.rowCounts?.results ? `Dataset: ${meta.rowCounts.results.toLocaleString("nl-NL")} results-rijen` : "Selecteer filters om de top 3 te zien.",
    children: [
      el("div", { class:"row" }, [header]),
      el("div", { style:"height:10px" }),
      filtersWrap,
      el("div", { style:"height:12px" }),
      medalSummaryWrap,
      el("div", { style:"height:12px" }),
      summary,
      el("div", { style:"height:10px" }),
      tableWrap
    ]
  });

  clear(root);
  root.appendChild(card);
  render();
}
