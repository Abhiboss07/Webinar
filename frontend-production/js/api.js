/* ============================================================================
   API — the only place the frontend talks to the backend.
   Base URL auto-switches: localhost → C.api.dev, everything else → C.api.prod.
   No backend URL is hardcoded anywhere else.
   ========================================================================== */
import { C } from "./config.js";

// Resolve the backend base URL for the current environment.
export function apiBase() {
  const api = C.api || {};
  const host = (typeof location !== "undefined" && location.hostname) || "";
  const isDev = host === "localhost" || host === "127.0.0.1" || host === "" || host === "0.0.0.0";
  const base = isDev ? (api.dev || "http://localhost:4000") : (api.prod || api.dev || "");
  return String(base).replace(/\/$/, "");
}

// Thrown for fetch/network failures so callers can show a "network" message.
export class NetworkError extends Error {}

async function postJSON(path, body) {
  let res;
  try {
    res = await fetch(apiBase() + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
  } catch (_) {
    throw new NetworkError("Network error — please check your connection and try again.");
  }
  let json = null;
  try { json = await res.json(); } catch (_) { /* non-JSON */ }
  if (!res.ok) throw new Error((json && json.message) || `Request failed (${res.status})`);
  return json || {};
}

/* Step 1 — save the lead as Pending (before payment). */
export async function register(data) {
  const r = await postJSON("/register", data);
  if (r.status !== "success") throw new Error(r.message || "Could not save your registration.");
  return r;
}

/* Step 2 — create a Razorpay order (amount is decided server-side). */
export function createOrder(regId) {
  return postJSON("/create-order", { regId });
}

/* Step 3 — verify the Razorpay signature server-side → mark Paid. */
export function verifyPayment(payload) {
  return postJSON("/verify-payment", payload);
}

/* Social-proof popup — read-only JSONP GET to the Apps Script (no CORS setup).
   Falls back to [] (→ popup stays hidden) on any error/timeout. */
export function fetchRecent(endpoint, cb) {
  const cbName = "__wbpop_" + Date.now();
  const url = endpoint + (endpoint.indexOf("?") === -1 ? "?" : "&") + "recent=1&limit=12&callback=" + cbName;
  const s = document.createElement("script");
  let done = false;
  const cleanup = () => { try { delete window[cbName]; } catch (_) { window[cbName] = undefined; } if (s.parentNode) s.parentNode.removeChild(s); };
  window[cbName] = (data) => { done = true; cleanup(); cb(data); };
  s.onerror = () => { if (!done) { done = true; cleanup(); cb([]); } };
  s.src = url;
  document.head.appendChild(s);
  setTimeout(() => { if (!done) { done = true; cleanup(); cb([]); } }, 8000);
}
