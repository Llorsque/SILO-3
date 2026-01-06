import { el } from "./dom.js";
export function sectionCard({title, subtitle, children=[]}){
  return el("div", { class:"card" }, [
    el("div", { class:"card__title" }, title),
    subtitle ? el("div", { class:"card__sub" }, subtitle) : null,
    el("div", { class:"hr" }),
    ...children
  ]);
}
