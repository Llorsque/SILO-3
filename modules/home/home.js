import { el, clear } from "../../core/dom.js";
import { sectionCard } from "../../core/layout.js";
import { router } from "../../core/router.js";
import { importExcelFile } from "../../core/excel.js";
import { loadMeta, clearDataset } from "../../core/storage.js";

function menuBtn(title, desc, route){
  const b = el("div", { class:"menuBtn", role:"button", tabindex:"0" }, [
    el("div", { class:"menuBtn__title" }, title),
    el("div", { class:"menuBtn__desc" }, desc),
  ]);
  const go = () => router.go(route);
  b.addEventListener("click", go);
  b.addEventListener("keydown", (e)=>{ if(e.key === "Enter" || e.key === " ") go(); });
  return b;
}

function showPopup(title, message){
  const overlay = el("div", { class:"overlay" }, [
    el("div", { class:"card dialog" }, [
      el("div", { class:"card__title" }, title),
      el("div", { class:"card__sub" }, message),
      el("div", { class:"hr" }),
      el("div", { class:"row", style:"justify-content:flex-end" }, [
        el("button", { class:"btn", type:"button" }, "OK")
      ])
    ])
  ]);
  const btn = overlay.querySelector("button");
  btn.addEventListener("click", ()=> overlay.remove());
  overlay.addEventListener("click", (e)=>{ if(e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

export function mountHome(root){
  clear(root);

  // Hidden file input; we only expose the Upload button.
  const fileInput = el("input", { type:"file", accept:".xlsx,.xls", style:"display:none" });

  const status = el("div", { style:"color:var(--muted); font-size:12px" }, "");

  function refreshStatus(){
    const meta = loadMeta();
    status.textContent = meta?.fileName ? meta.fileName : "Geen dataset gekoppeld.";
  }

  const btnUpload = el("button", { class:"btn", type:"button" }, "Upload Excel");
  btnUpload.addEventListener("click", ()=> fileInput.click());

  fileInput.addEventListener("change", async ()=>{
    const f = fileInput.files?.[0];
    if(!f) return;

    btnUpload.disabled = true;
    btnUpload.textContent = "Uploaden…";

    try{
      const res = await importExcelFile(f);
      refreshStatus();
      showPopup("Dataset gekoppeld", res?.meta?.fileName ? `✅ ${res.meta.fileName}` : "✅ Upload succesvol");
    }catch(err){
      console.error(err);
      showPopup("Import mislukt", err?.message || String(err));
    }finally{
      btnUpload.disabled = false;
      btnUpload.textContent = "Upload Excel";
      fileInput.value = "";
    }
  });

  const btnClear = el("button", { class:"btn btn--ghost", type:"button" }, "Ontkoppel / verwijderen");
  btnClear.addEventListener("click", async ()=>{
    await clearDataset();
    refreshStatus();
  });

  refreshStatus();

  const controls = el("div", { class:"card", style:"margin-bottom:14px" }, [
    el("div", { class:"card__title" }, "Dataset"),
    el("div", { class:"hr" }),
    fileInput,
    el("div", { class:"row" }, [btnUpload, btnClear]),
    el("div", { style:"height:8px" }),
    status
  ]);

  const grid = el("div", { class:"menuGrid" }, [
    menuBtn("Dashboard", "Rijder selecteren en kerncijfers in tiles.", "dashboard"),
    menuBtn("Filters & parameters", "Combineer filters om specifieke data te vinden.", "filters"),
    menuBtn("Head-to-Head", "Vergelijk rijders en duels in één oogopslag.", "headtohead"),
    menuBtn("Kampioenen", "Top 3 per toernooi, seizoen, afstand en sekse.", "champions"),
    menuBtn("Biografie", "Profiel en volledige resultaten per rijder.", "biography"),
    menuBtn("A Final presentation", "Startposities kiezen en presenteren (2 tegelijk).", "finalpresentation"),
  ]);

  root.appendChild(controls);
  root.appendChild(sectionCard({
    title:"Modules",
    subtitle:"Klik om naar een module te gaan.",
    children:[grid]
  }));
}
