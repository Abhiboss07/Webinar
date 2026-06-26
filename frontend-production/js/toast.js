/* ============================================================================
   TOAST — reusable, dismissible notifications. Never fail silently.
   showToast(message, type)  type: "error" | "success" | "info"
   Styles live in css/components.css (.toast-host / .toast).
   ========================================================================== */
let host = null;

function ensureHost() {
  if (host && document.body.contains(host)) return host;
  host = document.createElement("div");
  host.id = "toastHost";
  host.className = "toast-host";
  host.setAttribute("aria-live", "polite");
  document.body.appendChild(host);
  return host;
}

export function showToast(message, type = "info", timeout = 5500) {
  if (!message) return null;
  const el = document.createElement("div");
  el.className = "toast toast-" + type;
  el.setAttribute("role", type === "error" ? "alert" : "status");
  const msg = document.createElement("span");
  msg.className = "toast-msg";
  msg.textContent = message; // textContent → safe, no HTML injection
  const x = document.createElement("button");
  x.type = "button";
  x.className = "toast-x";
  x.setAttribute("aria-label", "Dismiss");
  x.innerHTML = "&times;";
  el.appendChild(msg);
  el.appendChild(x);

  const close = () => { el.classList.remove("in"); setTimeout(() => el.remove(), 300); };
  x.addEventListener("click", close);
  ensureHost().appendChild(el);
  requestAnimationFrame(() => el.classList.add("in"));
  if (timeout) setTimeout(close, timeout);
  return el;
}
