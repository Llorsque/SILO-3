import { router } from "./router.js";
import { el, clear } from "./dom.js";

import { mountHome } from "../modules/home/home.js";
import { mountDashboard } from "../modules/dashboard/dashboard.js";
import { mountFilters } from "../modules/filters/filters.js";
import { mountHeadToHead } from "../modules/headtohead/headtohead.js";
import { mountChampions } from "../modules/champions/champions.js";
import { mountBiography } from "../modules/biography/biography.js";
import { mountSettings } from "../modules/settings/settings.js";

const root = document.getElementById("appRoot");

function safeMount(fn, route){
  return () => {
    try{ fn(root); }
    catch(err){
      console.error("[SILO] Module crash:", route, err);
      clear(root);
      root.appendChild(el("div", { class:"card" }, [
        el("div", { class:"card__title" }, "Module crash"),
        el("div", { class:"card__sub" }, `Route: ${route}`),
        el("div", { class:"hr" }),
        el("pre", { class:"notice", style:"white-space:pre-wrap" }, (err?.stack || String(err)))
      ]));
    }
  };
}

router.register("home", safeMount(mountHome, "home"));
router.register("dashboard", safeMount(mountDashboard, "dashboard"));
router.register("filters", safeMount(mountFilters, "filters"));
router.register("headtohead", safeMount(mountHeadToHead, "headtohead"));
router.register("champions", safeMount(mountChampions, "champions"));
router.register("biography", safeMount(mountBiography, "biography"));
router.register("settings", safeMount(mountSettings, "settings"));

document.getElementById("btnGoHome").addEventListener("click", () => router.go("home"));
document.getElementById("btnGoSettings").addEventListener("click", () => router.go("settings"));

router.start();
