// Thin API client for the CMS backend. Attaches the JWT and centralises errors.
const BASE = (import.meta.env.VITE_API_BASE || "http://localhost:4000").replace(/\/$/, "");
const TOKEN_KEY = "youngness_admin_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY) || "";
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth && getToken()) headers.Authorization = `Bearer ${getToken()}`;

  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch (_) {
    throw new Error("Cannot reach the server. Check your connection and the API URL.");
  }

  let json = null;
  try { json = await res.json(); } catch (_) { /* non-JSON */ }

  if (res.status === 401 && auth) {
    setToken("");
    // Let the app redirect to login on the next render.
    if (!path.includes("/auth/login")) window.dispatchEvent(new Event("auth:expired"));
  }
  if (!res.ok) throw new Error((json && json.message) || `Request failed (${res.status})`);
  return json || {};
}

export const api = {
  login: (email, password) => request("/api/auth/login", { method: "POST", body: { email, password }, auth: false }),
  me: () => request("/api/auth/me"),
  getConfig: () => request("/api/site-config", { auth: false }),
  saveConfig: (data) => request("/api/site-config", { method: "PUT", body: { data } }),
};

export { BASE };
