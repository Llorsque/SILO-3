import { el, clear } from "../../core/dom.js";
import { sectionCard } from "../../core/layout.js";
import { loadDataset } from "../../core/storage.js";

/**
 * Head-to-Head (SILO)
 * Stap 1: selectie rijders + basis metrics + pairwise "voor elkaar geëindigd" op dezelfde uitslag.
 * Dataset: Results sheet normalized in core/excel.js -> dataset.results
 */

function normalizeSpaces(s){ return String(s ?? "").replace(/\s+/g," ").trim(); }

function medalRank(pos, runKey){
  // Medailles alleen op podium (1/2/3) in Final A.
  const rk = String(runKey || "").toLowerCase();
  if(rk !== "finala") return null;
  if(pos === 1) return "goud";
  if(pos === 2) return "zilver";
  if(pos === 3) return "brons";
  return null;
}

function medalIcon(kind){
  if(kind === "goud") return "🥇";
  if(kind === "zilver") return "🥈";
  if(kind === "brons") return "🥉";
  return "•";
}

function typeableDropdown({placeholder, value, options, onChange}){
  const wrap = el("div", { class:"dropdown" });
  const input = el("input", { class:"input", placeholder, value: value || "" });
  const list = el("div", { class:"dropdown__list" });

  let open = false;
  function renderList(){
    clear(list);
    const q = (input.value || "").toLowerCase().trim();
    const filtered = options.filter(o => o.toLowerCase().includes(q)).slice(0, 80);
    if(!filtered.length){
      list.appendChild(el("div", { class:"dropdown__item dropdown__item--muted" }, "Geen resultaten"));
      return;
    }
    for(const o of filtered){
      const it = el("div", { class:"dropdown__item" }, o);
      it.addEventListener("mousedown", (e)=>{ e.preventDefault(); });
      it.addEventListener("click", ()=>{
        input.value = o;
        onChange(o);
        setOpen(false);
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

function chip(label, active, onClick){
  const b = el("button", { class: active ? "chip chip--active" : "chip", type:"button" }, label);
  b.addEventListener("click", onClick);
  return b;
}

function keySameResult(r){
  // “zelfde uitslag”: zelfde Wedstrijd + Datum + Afstand + Run (Final A/B/Overall etc.)
  // NB: r.dateISO is ISO yyyy-mm-dd (from parser)
  return `${r.wedstrijdRaw}||${r.dateISO||""}||${r.distance||""}||${r.runKey||""}`;
}

function computeMedals(rows, skater){
  const out = { goud:0, zilver:0, brons:0, podium:0 };
  for(const r of rows){
    if(r.skaterName !== skater) continue;
    const m = medalRank(r.pos, r.runKey);
    if(!m) continue;
    out[m] += 1;
    out.podium += 1;
  }
  return out;
}

function computePairwise(rows, a, b){
  // Count shared results where both appear; determine who finished ahead by smaller pos
  const groups = new Map(); // key -> Map(name -> pos)
  for(const r of rows){
    if(r.skaterName !== a && r.skaterName !== b) continue;
    if(r.pos == null) continue;
    const k = keySameResult(r);
    if(!groups.has(k)) groups.set(k, new Map());
    groups.get(k).set(r.skaterName, r.pos);
  }

  let shared = 0, aWins = 0, bWins = 0, ties = 0;
  for(const [k, mp] of groups.entries()){
    if(!mp.has(a) || !mp.has(b)) continue;
    shared += 1;
    const pa = mp.get(a);
    const pb = mp.get(b);
    if(pa === pb) ties += 1;
    else if(pa < pb) aWins += 1;
    else bWins += 1;
  }
  return { shared, aWins, bWins, ties };
}


function initials(name){
  const parts = normalizeSpaces(name).split(" ").filter(Boolean);
  const a = (parts[0]?.[0] || "").toUpperCase();
  const b = (parts[parts.length-1]?.[0] || "").toUpperCase();
  return (a + b) || "•";
}

function metricRow(label, left, right){
  return el("div", { class:"h2hBoardRow" }, [
    el("div", { class:"h2hBoardVal h2hBoardVal--left" }, left),
    el("div", { class:"h2hBoardLabel" }, label),
    el("div", { class:"h2hBoardVal h2hBoardVal--right" }, right),
  ]);
}

function renderBoard({ container, a, b, rows, showMedals, showPairwise }){
  clear(container);

  const head = el("div", { class:"h2hBoardHead" }, [
    el("div", { class:"h2hBoardSide" }, [
      el("div", { class:"h2hAvatar" }, initials(a)),
      el("div", {}, [
        el("div", { class:"h2hBoardName" }, a),
        el("div", { class:"h2hBoardSub" }, "Rijder A"),
      ])
    ]),
    el("div", { class:"h2hBoardVS" }, "VS"),
    el("div", { class:"h2hBoardSide h2hBoardSide--right" }, [
      el("div", {}, [
        el("div", { class:"h2hBoardName" }, b),
        el("div", { class:"h2hBoardSub" }, "Rijder B"),
      ]),
      el("div", { class:"h2hAvatar" }, initials(b)),
    ]),
  ]);

  const body = el("div", { class:"h2hBoardBody" }, []);

  if(showMedals){
    const ma = computeMedals(rows, a);
    const mb = computeMedals(rows, b);

    body.appendChild(el("div", { class:"h2hBoardSectionTitle" }, "Medailles (Final A)"));
    body.appendChild(metricRow("🥇 Goud", String(ma.goud), String(mb.goud)));
    body.appendChild(metricRow("🥈 Zilver", String(ma.zilver), String(mb.zilver)));
    body.appendChild(metricRow("🥉 Brons", String(ma.brons), String(mb.brons)));
  }

  if(showPairwise){
    const s = computePairwise(rows, a, b);
    body.appendChild(el("div", { class:"h2hBoardSectionTitle", style:"margin-top:14px" }, "Duel (zelfde uitslag)"));
    body.appendChild(metricRow("Samen in uitslag", String(s.shared), String(s.shared)));
    body.appendChild(metricRow("Winst (lager pos. = beter)", String(s.aWins), String(s.bWins)));
    body.appendChild(metricRow("Gelijk", String(s.ties), String(s.ties)));
  }

  const board = el("div", { class:"card h2hBoard" }, [ head, body ]);
  container.appendChild(board);
}

export async function mountHeadToHead(root){
  clear(root);

  const dataset = await loadDataset();
  if(!dataset || !Array.isArray(dataset.results) || !dataset.results.length){
    root.appendChild(sectionCard({
      title:"Head-to-Head",
      subtitle:"Upload eerst een Excel-bestand (Results/Skaters/etc.) om te kunnen vergelijken.",
      children:[
        el("div", { class:"notice" }, "Nog geen dataset geladen.")
      ]
    }));
    return;
  }

  const results = dataset.results;
  const skaters = dataset.skaters || [];

  // Canonical skater list: prefer skaters sheet (kolom D in excel -> parsed into name field)
  const skaterNames = Array.from(new Set(
    skaters.map(s => normalizeSpaces(s.Naam || s.name || s["Naam"] || s["name"] || s["Skater"] || s["SKATER"] || ""))
      .filter(Boolean)
  ));
  // fallback to results
  if(!skaterNames.length){
    skaterNames.push(...Array.from(new Set(results.map(r=>r.skaterName).filter(Boolean))));
  }
  skaterNames.sort((a,b)=>a.localeCompare(b));

  const tournamentOptions = Array.from(new Set(results.map(r=>normalizeSpaces(r.tournament || r.wedstrijdRaw)).filter(Boolean))).sort((a,b)=>a.localeCompare(b));
  const distanceOptions = Array.from(new Set(results.map(r=>normalizeSpaces(r.distance || r.afstandRaw)).filter(Boolean))).sort((a,b)=>a.localeCompare(b));

  const state = {
    n: 2,
    riders: Array(6).fill(""),
    tournaments: new Set(), // empty = all
    distances: new Set(),   // empty = all
    params: {
      medals: true,
      pairwise: true
    }
  };

  const page = sectionCard({
    title:"Head-to-Head",
    subtitle:"Vergelijk rijders in één oogopslag. Stap voor stap bouwen we dit verder uit.",
    children:[]
  });

  const top = el("div", { class:"h2hTop" });

  // N selector
  const nSelect = el("select", { class:"input", style:"min-width:200px" }, [
    el("option", { value:"2" }, "2 rijders"),
    el("option", { value:"3" }, "3 rijders"),
    el("option", { value:"4" }, "4 rijders"),
    el("option", { value:"5" }, "5 rijders"),
    el("option", { value:"6" }, "6 rijders"),
  ]);
  nSelect.value = String(state.n);
  nSelect.addEventListener("change", ()=>{
    state.n = Math.max(2, Math.min(6, Number(nSelect.value)||2));
    render();
  });

  top.appendChild(el("div", { class:"h2hField" }, [
    el("div", { class:"label" }, "Aantal rijders"),
    nSelect
  ]));

  // Tournament chips (multi)
  const tournamentWrap = el("div", { class:"h2hField" }, [
    el("div", { class:"label" }, "Toernooi"),
    el("div", { class:"chipRow" })
  ]);
  const tournamentRow = tournamentWrap.querySelector(".chipRow");

  // Distance chips (multi)
  const distanceWrap = el("div", { class:"h2hField" }, [
    el("div", { class:"label" }, "Afstand"),
    el("div", { class:"chipRow" })
  ]);
  const distanceRow = distanceWrap.querySelector(".chipRow");

  top.appendChild(tournamentWrap);
  top.appendChild(distanceWrap);

  // Rider dropdowns container
  const riderGrid = el("div", { class:"h2hRiderGrid" });

  const main = el("div", { class:"h2hMain" });
  const sidebar = el("div", { class:"h2hSidebar" });
  const content = el("div", { class:"h2hContent" });

  // Params selection (left)
  sidebar.appendChild(el("div", { class:"h2hSideTitle" }, "Parameters"));
  function paramRow(key, labelText){
    const row = el("label", { class:"h2hParam" }, []);
    const cb = el("input", { type:"checkbox" });
    cb.checked = !!state.params[key];
    cb.addEventListener("change", ()=>{ state.params[key] = cb.checked; render(); });
    row.appendChild(cb);
    row.appendChild(el("div", {}, labelText));
    return row;
  }
  sidebar.appendChild(paramRow("medals", "Medailles (Final A podium: 1/2/3)"));
  sidebar.appendChild(paramRow("pairwise", "Duel: vaker vóór elkaar (zelfde wedstrijd + datum + afstand + run)"));

  // Output containers
  const summary = el("div", { class:"h2hSummary" });
  const pairwiseWrap = el("div", { class:"h2hPairwise" });

  content.appendChild(summary);
  content.appendChild(pairwiseWrap);

  main.appendChild(sidebar);
  main.appendChild(content);

  page.appendChild(top);
  page.appendChild(el("div", { style:"height:10px" }));
  page.appendChild(riderGrid);
  page.appendChild(el("div", { style:"height:14px" }));
  page.appendChild(main);

  root.appendChild(page);

  function filteredRows(){
    return results.filter(r=>{
      if(state.tournaments.size && !state.tournaments.has(normalizeSpaces(r.tournament || r.wedstrijdRaw))) return false;
      if(state.distances.size && !state.distances.has(normalizeSpaces(r.distance || r.afstandRaw))) return false;
      return true;
    });
  }

  function render(){
    // tournament chips
    clear(tournamentRow);
    tournamentRow.appendChild(chip("All", state.tournaments.size===0, ()=>{ state.tournaments.clear(); render(); }));
    for(const t of tournamentOptions){
      tournamentRow.appendChild(chip(t, state.tournaments.has(t), ()=>{
        if(state.tournaments.size===0){
          // start specific
          state.tournaments.add(t);
        }else{
          if(state.tournaments.has(t)) state.tournaments.delete(t);
          else state.tournaments.add(t);
          if(state.tournaments.size===0){
            // stays All by meaning, ok
          }
        }
        render();
      }));
    }

    // distance chips
    clear(distanceRow);
    distanceRow.appendChild(chip("All", state.distances.size===0, ()=>{ state.distances.clear(); render(); }));
    for(const d of distanceOptions){
      distanceRow.appendChild(chip(d, state.distances.has(d), ()=>{
        if(state.distances.size===0){
          state.distances.add(d);
        }else{
          if(state.distances.has(d)) state.distances.delete(d);
          else state.distances.add(d);
        }
        render();
      }));
    }

    // rider dropdowns (n)
    clear(riderGrid);
    const n = state.n;
    const activeRiders = [];
    for(let i=0;i<n;i++){
      const idx = i;
      const label = `Rijder ${i+1}`;
      const current = state.riders[i] || "";
      const dd = typeableDropdown({
        placeholder: label,
        value: current,
        options: skaterNames,
        onChange: (v)=>{ state.riders[idx] = v; render(); }
      });
      const field = el("div", { class:"h2hRiderField" }, [
        el("div", { class:"label" }, label),
        dd.wrap
      ]);
      riderGrid.appendChild(field);
      if(current) activeRiders.push(current);
    }

    // empty out additional stored riders beyond n
    for(let i=n;i<state.riders.length;i++){
      state.riders[i] = "";
    }

    // Summary / Board
    clear(summary);
    clear(pairwiseWrap);

    if(activeRiders.length < 2){
      summary.appendChild(el("div", { class:"notice" }, "Selecteer minimaal 2 rijders om te vergelijken."));
      return;
    }

    const rows = filteredRows();

    if(activeRiders.length === 2){
      // Visual head-to-head board (zoals voorbeeldindelingen)
      renderBoard({
        container: summary,
        a: activeRiders[0],
        b: activeRiders[1],
        rows,
        showMedals: !!state.params.medals,
        showPairwise: !!state.params.pairwise
      });
      return;
    }

    // 3+ rijders: cards + pairwise matrix
    const grid = el("div", { class:"h2hSummaryGrid" });
    for(const rider of activeRiders){
      const card = el("div", { class:"card h2hRiderCard" }, [
        el("div", { class:"h2hRiderName" }, rider)
      ]);

      if(state.params.medals){
        const m = computeMedals(rows, rider);
        card.appendChild(el("div", { class:"h2hMetricTitle" }, "Medailles (Final A)"));
        card.appendChild(el("div", { class:"h2hMedalsRow" }, [
          el("div", { class:"h2hMedalPill" }, [el("span", {}, "🥇"), el("span", { class:"h2hNum" }, String(m.goud))]),
          el("div", { class:"h2hMedalPill" }, [el("span", {}, "🥈"), el("span", { class:"h2hNum" }, String(m.zilver))]),
          el("div", { class:"h2hMedalPill" }, [el("span", {}, "🥉"), el("span", { class:"h2hNum" }, String(m.brons))]),
        ]));
      }

      grid.appendChild(card);
    }
    summary.appendChild(grid);

    if(state.params.pairwise){
      pairwiseWrap.appendChild(el("div", { class:"h2hMetricTitle", style:"margin-bottom:10px" }, "Duel (zelfde uitslag)"));
      const table = el("div", { class:"card h2hPairTable" }, []);
      const header = el("div", { class:"h2hPairRow h2hPairRow--head" }, [
        el("div", {}, "Duel"),
        el("div", {}, "Shared"),
        el("div", {}, "Winst A"),
        el("div", {}, "Winst B"),
        el("div", {}, "Gelijk")
      ]);
      table.appendChild(header);

      for(let i=0;i<activeRiders.length;i++){
        for(let j=i+1;j<activeRiders.length;j++){
          const a = activeRiders[i];
          const b = activeRiders[j];
          const s = computePairwise(rows, a, b);

          table.appendChild(el("div", { class:"h2hPairRow" }, [
            el("div", { class:"h2hPairDuel" }, `${a} vs ${b}`),
            el("div", { class:"h2hPairNum" }, String(s.shared)),
            el("div", { class:"h2hPairNum" }, `Winst ${a}: ${s.aWins}`),
            el("div", { class:"h2hPairNum" }, `Winst ${b}: ${s.bWins}`),
            el("div", { class:"h2hPairNum" }, String(s.ties))
          ]));
        }
      }

      pairwiseWrap.appendChild(table);
    }

  render();
}
