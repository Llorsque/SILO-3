import { el, clear } from "../../core/dom.js";
import { sectionCard } from "../../core/layout.js";
import { router } from "../../core/router.js";

export function mountSettings(root){
  clear(root);
  root.appendChild(sectionCard({
    title:"Instellingen",
    subtitle:"Placeholder (later: mapping, data controle, opslag).",
    children:[
      el("div", { class:"notice" }, "Nog geen instellingen ingevuld."),
      el("div", { style:"height:10px" }),
      el("button", { class:"btn", type:"button", onclick:()=>router.go("home") }, "Terug naar menu")
    ]
  }));
}
