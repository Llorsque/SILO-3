import { el, clear } from "../../core/dom.js";
import { sectionCard } from "../../core/layout.js";
import { router } from "../../core/router.js";

export function mountFinalPresentation(root){
  clear(root);
  root.appendChild(sectionCard({
    title:"A Final presentation",
    subtitle:"Module is nog leeg. We bouwen dit later stap voor stap in dev.",
    children:[
      el("div", { class:"notice" }, "Placeholder — nog geen inhoud."),
      el("div", { style:"height:10px" }),
      el("button", { class:"btn", type:"button", onclick:()=>router.go("home") }, "Terug naar menu")
    ]
  }));
}
