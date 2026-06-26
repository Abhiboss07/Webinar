/* ============================================================================
   POPUP — social-proof toast, REAL registrations only.
   Pulls recent entries (first name + city, privacy-filtered server-side) from
   the same Google Sheet, via JSONP. If disabled, the endpoint isn't set, or
   there are zero real registrations, the popup stays hidden — never fake data.
   ========================================================================== */
import { C } from "./config.js";
import { fetchRecent } from "./api.js";

export function initPopup() {
  const popup = document.getElementById("popup");
  const cfg = C.popup || {};
  if (!popup || cfg.enabled === false) return;
  const endpoint = (C.integrations || {}).sheetsEndpoint;
  if (!endpoint || endpoint.startsWith("PASTE_")) return; // no real source → stay hidden

  fetchRecent(endpoint, (list) => {
    const entries = (list || []).filter((x) => x && x.name);
    if (!entries.length) return; // no real registrations yet → stay hidden
    const nameEl = document.getElementById("popupName");
    const avatarEl = document.getElementById("popupAvatar");
    let i = 0;
    const nextDelay = () => 8000 + Math.random() * 7000; // random 8–15s
    function show() {
      const e = entries[i % entries.length]; i++;
      const where = e.city ? ` from ${e.city}` : "";
      nameEl.textContent = `${e.name}${where}`;
      avatarEl.textContent = (e.name[0] || "•").toUpperCase();
      popup.style.transform = "translateX(0)"; popup.style.opacity = "1";
      setTimeout(() => { popup.style.transform = "translateX(-130%)"; popup.style.opacity = "0"; }, 4500);
      setTimeout(show, nextDelay());
    }
    setTimeout(show, 6000);
  });
}
