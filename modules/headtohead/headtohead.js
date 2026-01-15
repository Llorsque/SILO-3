
import { el, clear } from "../../core/dom.js";
import { loadResults } from "../../core/storage.js";
import { computeHeadToHead } from "./headtohead.logic.js";

export function mountHeadToHead(root) {
  clear(root);

  const results = loadResults() || [];
  let selectedRiders = [];
  let filters = {
    tournaments: [],
    distances: [],
    seasons: []
  };

  const output = el("pre", { style:"white-space:pre-wrap" });

  function render() {
    if (selectedRiders.length < 2) {
      output.textContent = "Selecteer minimaal 2 rijders.";
      return;
    }
    const res = computeHeadToHead(results, filters, selectedRiders);
    output.textContent = JSON.stringify(res, null, 2);
  }

  const input = el("input", { placeholder:"Typ rijders (komma gescheiden)" });
  input.addEventListener("input", () => {
    selectedRiders = input.value.split(",").map(s=>s.trim()).filter(Boolean);
    render();
  });

  root.appendChild(el("h2", {}, "Head to Head (hersteld)"));
  root.appendChild(input);
  root.appendChild(output);
}
