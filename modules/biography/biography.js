import { el, clear } from "../../core/dom.js";
import { sectionCard } from "../../core/layout.js";
import { router } from "../../core/router.js";
import { loadDataset, loadMeta } from "../../core/storage.js";

function normalizeSpaces(s){ return String(s ?? "").replace(/\s+/g, " ").trim(); }

function fmtDate(iso){
  if(!iso) return "";
  const d = new Date(iso);
  if(isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2,"0");
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const yy = d.getFullYear();
  return `${dd}-${mm}-${yy}`;
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
  input.addEventListener("keydown", (e)=>{ if(e.key === "Escape") setOpen(false); });

  document.addEventListener("click", (e)=>{ if(!wrap.contains(e.target)) setOpen(false); });

  wrap.appendChild(input);
  wrap.appendChild(list);
  return { wrap, input };
}

export async function mountBiography(root){
  clear(root);

  const meta = loadMeta?.() || null;
  const dataset = await loadDataset?.();

  if(!dataset?.results?.length || !dataset?.skaters?.length){
    root.appendChild(sectionCard({
      title:"Biografie",
      subtitle:"Upload eerst een Excel met tabbladen 'Results' en 'Skaters'.",
      children:[
        el("div", { class:"notice" }, "Geen dataset gekoppeld (of leeg). Ga terug naar Menu en upload je Excel."),
        el("div", { style:"height:10px" }),
        el("button", { class:"btn", type:"button", onclick:()=>router.go("home") }, "Terug naar menu")
      ]
    }));
    return;
  }

  const resultsAll = dataset.results;

  // Build rider list from Skaters tab (canonical names)
  const skaterNames = Array.from(new Set(
    dataset.skaters
      .map(r => r.SKATERS ?? r["SKATERS"] ?? "")
      .map(normalizeSpaces)
      .filter(Boolean)
  )).sort((a,b)=>a.localeCompare(b));

  const state = { rider: "" };

  const header = el("div", { class:"row", style:"align-items:flex-end; gap:12px" }, [
    el("div", null, [
      el("div", { class:"card__title", style:"font-size:18px" }, "Biografie"),
      el("div", { class:"card__sub" }, "Selecteer een rijder voor profiel + alle resultaten.")
    ]),
    el("div", { class:"spacer" }),
    el("button", { class:"btn", type:"button" }, "Reset")
  ]);
  header.querySelector("button").addEventListener("click", ()=>{ state.rider=""; render(); });

  const filterCard = el("div", { class:"filtersCard" });
  const profileWrap = el("div", { class:"bioProfileWrap" });
  const resultsWrap = el("div", { class:"tableWrap" });

  function findWTNameByNat(nat){
    const code = normalizeSpaces(nat).toUpperCase();
    if(!code) return null;
    const row = (dataset.wtNames || []).find(r => String(r.NAT ?? r["NAT"] ?? "").toUpperCase() === code);
    if(!row) return null;
    return {
      country: normalizeSpaces(row.COUNTRY ?? row["COUNTRY"] ?? ""),
      wtName: normalizeSpaces(row["WT NAME"] ?? row["WT NAME "] ?? row.WT_NAME ?? row["WT_NAME"] ?? row["WT NAME"] ?? "")
    };
  }

  function findSkaterRowByName(name){
    const target = normalizeSpaces(name);
    return dataset.skaters.find(r => normalizeSpaces(r.SKATERS ?? r["SKATERS"] ?? "") === target) || null;
  }

  function render(){
    clear(filterCard);
    clear(profileWrap);
    clear(resultsWrap);

    // Filter UI
    const dd = typeableDropdown({
      placeholder: "Typ om een rijder te zoeken...",
      value: state.rider || "",
      options: ["", ...skaterNames],
      onChange: (val)=>{ state.rider = val === "" ? "" : val; render(); }
    });

    const filterRow = el("div", { class:"filtersRow" }, [
      el("div", { class:"filterGroup", style:"min-width:360px; flex:1" }, [
        el("div", { class:"filterLabel" }, "Rijder"),
        dd.wrap
      ])
    ]);

    filterCard.appendChild(filterRow);

    if(!state.rider){
      profileWrap.appendChild(el("div", { class:"notice" }, "Kies een rijder om het profiel en de resultaten te zien."));
      return;
    }

    // Profile data
    const sk = findSkaterRowByName(state.rider);
    const nat = normalizeSpaces(sk?.NAT ?? sk?.["NAT"] ?? "");
    const wt = findWTNameByNat(nat);
    const teamName = wt?.wtName || ""; // per jouw afspraak: uit WT Names kolom C
    const notable = normalizeSpaces(sk?.OPMERKING ?? sk?.["OPMERKING"] ?? "");

    const profile = el("div", { class:"bioProfileCard" }, [
      el("div", { class:"bioProfileTop" }, [
        el("div", { class:"bioPhoto" }, "Foto"),
        el("div", { class:"bioMeta" }, [
          el("div", { class:"bioName" }, state.rider),
          el("div", { class:"bioGrid" }, [
            el("div", { class:"bioField" }, [
              el("div", { class:"bioLabel" }, "Geboortedatum"),
              el("div", { class:"bioValue bioValue--muted" }, "— (nog niet beschikbaar)")
            ]),
            el("div", { class:"bioField" }, [
              el("div", { class:"bioLabel" }, "Nationaliteit"),
              el("div", { class:"bioValue" }, wt?.country ? `${nat} • ${wt.country}` : (nat || "—"))
            ]),
            el("div", { class:"bioField" }, [
              el("div", { class:"bioLabel" }, "Team naam"),
              el("div", { class:"bioValue" }, teamName || "—")
            ]),
          ]),
        ])
      ]),
      el("div", { class:"hr" }),
      el("div", { class:"bioNotable" }, [
        el("div", { class:"bioLabel" }, "Benoemenswaardigheden"),
        notable ? el("div", { class:"bioValue" }, notable) : el("div", { class:"bioValue bioValue--muted" }, "—")
      ])
    ]);

    profileWrap.appendChild(profile);

    // Results for rider
    const rows = resultsAll
      .filter(r => r.skaterName === state.rider)
      .sort((a,b)=>{
        const da = a.dateISO ? new Date(a.dateISO).getTime() : 0;
        const db = b.dateISO ? new Date(b.dateISO).getTime() : 0;
        return db - da;
      });

    if(!rows.length){
      resultsWrap.appendChild(el("div", { class:"notice" }, "Geen resultaten gevonden voor deze rijder."));
      return;
    }

    const table = el("table", { class:"dataTable" });
    table.appendChild(el("thead", null, el("tr", null, [
      el("th", null, "Toernooi"),
      el("th", null, "Jaar"),
      el("th", null, "Afstand"),
      el("th", null, "Run"),
      el("th", null, "Pos."),
      el("th", null, "Locatie"),
      el("th", null, "Datum"),
    ])));

    const tbody = el("tbody");
    for(const r of rows){
      tbody.appendChild(el("tr", null, [
        el("td", null, r.tournamentShort || tournamentShort(r.tournament)),
        el("td", null, String(r.season || "")),
        el("td", null, r.distance || ""),
        el("td", null, r.runRaw || ""),
        el("td", null, String(r.pos || "")),
        el("td", null, r.locatie || ""),
        el("td", null, fmtDate(r.dateISO)),
      ]));
    }
    table.appendChild(tbody);
    resultsWrap.appendChild(el("div", { class:"bioResultsHeader" }, [
      el("div", { class:"bioResultsTitle" }, `Alle resultaten (${rows.length})`)
    ]));
    resultsWrap.appendChild(table);
  }

  const card = sectionCard({
    title: "Biografie",
    subtitle: meta?.rowCounts?.results ? `Dataset: ${meta.rowCounts.results.toLocaleString("nl-NL")} results-rijen` : "",
    children: [
      header,
      el("div", { style:"height:10px" }),
      filterCard,
      el("div", { style:"height:12px" }),
      profileWrap,
      el("div", { style:"height:12px" }),
      resultsWrap
    ]
  });

  root.appendChild(card);
  render();
}
