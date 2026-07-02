/* ============================================================================
   CONFIG — loads site content and resolves {{token}} placeholders.

   Content now comes from the CMS: `loadConfig()` fetches GET /api/site-config
   (managed in the Admin Panel). The bundled config/workshop-config.js is kept
   ONLY as an offline fallback so the site never renders blank if the API is
   briefly unreachable. Every other module imports the live `C` from here.

   IMPORTANT: `C` is a *live* export — it is replaced in place once the API
   responds. Read it inside functions (at call time), not destructured at the
   top level, so consumers always see the fetched content. js/app.js awaits
   loadConfig() before rendering, so C is populated before any section renders.
   ========================================================================== */
import FALLBACK_CONFIG from "../config/workshop-config.js";

/* {{token}} interpolation — single source of truth.
   Resolves {{name}} {{date}} {{time}} {{venue}} {{price}} {{originalPrice}}
   {{bonusValue}} {{brand}} across every string. Single-brace {placeholders}
   (e.g. {fullName}) are left untouched — filled per-registrant at submit time. */
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
  return cfg;
}

/* Resolve the backend base URL from a config object (dev on localhost, prod
   elsewhere). Uses the fallback config so it works before the API responds. */
function resolveApiBase(cfg) {
  const api = (cfg && cfg.api) || {};
  const host = (typeof location !== "undefined" && location.hostname) || "";
  const isDev = host === "localhost" || host === "127.0.0.1" || host === "" || host === "0.0.0.0";
  const base = isDev ? (api.dev || "http://localhost:4000") : (api.prod || api.dev || "");
  return String(base).replace(/\/$/, "");
}

const clone = (o) => (typeof structuredClone === "function" ? structuredClone(o) : JSON.parse(JSON.stringify(o)));

/* C starts as the interpolated fallback so nothing is ever undefined during the
   initial fetch. loadConfig() replaces it with the CMS content on success. */
export let C = interpolate(clone(FALLBACK_CONFIG));
export const $ = (id) => document.getElementById(id);

/* Fetch live content from the CMS. On any failure, keeps the bundled fallback so
   the page still renders. Call (and await) this once before rendering. */
export async function loadConfig() {
  try {
    const base = resolveApiBase(FALLBACK_CONFIG);
    // ?preview=1 on the page → fetch the unpublished DRAFT (admin "Preview").
    const preview = (typeof location !== "undefined" && new URLSearchParams(location.search).get("preview") === "1");
    const url = base + "/api/site-config" + (preview ? "?preview=1" : "");
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const json = await res.json();
    const data = json && json.data ? json.data : json;
    if (data && typeof data === "object" && data.workshop) {
      C = interpolate(data);
      return C;
    }
    throw new Error("empty or malformed site-config");
  } catch (err) {
    console.warn("[config] CMS unavailable — using bundled fallback content:", err && err.message);
    return C; // already the interpolated fallback
  }
}
