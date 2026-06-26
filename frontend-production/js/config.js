/* ============================================================================
   CONFIG — loads the single config file and resolves {{token}} placeholders.
   Every other module imports `C` (the resolved config) from here.
   ========================================================================== */
import WORKSHOP_CONFIG from "../config/workshop-config.js";

/* {{token}} interpolation — single source of truth.
   Resolves {{name}} {{date}} {{time}} {{venue}} {{price}} {{originalPrice}}
   {{bonusValue}} {{brand}} across every string, so a value set once in
   `workshop` (or brand) updates everywhere it appears.
   Note: single-brace {placeholders} (e.g. {fullName}) are left untouched —
   those are filled per-registrant at submit time. */
function interpolate(cfg) {
  const w = cfg.workshop || {};
  const tokens = {
    name: w.name, date: w.date, time: w.time, venue: w.venue,
    price: w.price, originalPrice: w.originalPrice, bonusValue: w.bonusValue,
    brand: (cfg.brand || {}).name,
  };
  const rx = /\{\{(\w+)\}\}/g;
  const walk = (o) => {
    if (typeof o === "string") return o.replace(rx, (m, k) => (tokens[k] != null ? tokens[k] : m));
    if (Array.isArray(o)) return o.map(walk);
    if (o && typeof o === "object") { for (const k in o) o[k] = walk(o[k]); return o; }
    return o;
  };
  walk(cfg);
}

interpolate(WORKSHOP_CONFIG);

export const C = WORKSHOP_CONFIG;
export const $ = (id) => document.getElementById(id);
