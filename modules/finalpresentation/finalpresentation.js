import { el, clear } from "../../core/dom.js";
import { sectionCard } from "../../core/layout.js";
import { loadDataset } from "../../core/storage.js";

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
}

export async function mountFinalPresentation(root){
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

  function makeSkaterCard(posIdx){
    const pos = posIdx + 1;
    const pick = getPick(posIdx);

    if(!pick){
      return el("div", { class:"card finalPres__card finalPres__card--empty" }, [
        el("div", { class:"finalPres__cardTop" }, [
          el("div", { class:"finalPres__pos" }, `Startpositie ${pos}`),
        ]),
        el("div", { class:"notice" }, "Nog geen rijder geselecteerd.")
      ]);
    }

    const wtName = wtMap.get(pick.nat) || "";
    const metaRow = el("div", { class:"finalPres__metaLine" }, [
      el("span", { class:"strong" }, pick.nat || "—"),
      el("span", { class:"muted" }, " · "),
      el("span", { class:"strong" }, (wtName || "—")),
      el("span", { class:"muted" }, " · "),
      el("span", { class:"strong" }, ((pick.age ?? "—") + " jaar"))
    ]);

    return el("div", { class:"card finalPres__card" }, [
      el("div", { class:"finalPres__cardTop" }, [
        el("div", { class:"finalPres__pos" }, `Startpositie ${pos}`),
        el("div", { class:"finalPres__name" }, pick.name || "—"),
      ]),
      metaRow,
      el("div", { style:"height:12px" }),
      el("div", { class:"finalPres__sectionTitle" }, "Belangrijkste resultaten"),
      el("div", { class:"notice" }, "Nog niet ingericht — bepalen we straks samen."),
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
