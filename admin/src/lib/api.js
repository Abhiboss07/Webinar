// Thin API client for the CMS backend. Attaches the JWT, transparently refreshes
// the access token on 401 (once), and centralises errors.
const BASE = (import.meta.env.VITE_API_BASE || "http://localhost:4000").replace(/\/$/, "");
const TOKEN_KEY = "youngness_admin_token";
const REFRESH_KEY = "youngness_admin_refresh";

export const getToken = () => localStorage.getItem(TOKEN_KEY) || "";
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));
export const getRefresh = () => localStorage.getItem(REFRESH_KEY) || "";
export const setRefresh = (t) => (t ? localStorage.setItem(REFRESH_KEY, t) : localStorage.removeItem(REFRESH_KEY));

let refreshing = null; // single-flight refresh promise
async function tryRefresh() {
  if (!getRefresh()) return false;
  if (!refreshing) {
    refreshing = fetch(BASE + "/api/auth/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken: getRefresh() }) })
      .then((r) => (r.ok ? r.json() : null)).then((j) => { if (j && j.token) { setToken(j.token); return true; } return false; })
      .catch(() => false).finally(() => { refreshing = null; });
  }
  return refreshing;
}

async function raw(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth && getToken()) headers.Authorization = `Bearer ${getToken()}`;
  return fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
}

async function request(path, opts = {}) {
  const auth = opts.auth !== false;
  let res;
  try { res = await raw(path, opts); }
  catch (_) { throw new Error("Cannot reach the server. Check your connection and the API URL."); }

  // Transparent refresh on 401 (not for the auth endpoints themselves).
  if (res.status === 401 && auth && !/\/auth\/(login|refresh)/.test(path)) {
    const ok = await tryRefresh();
    if (ok) { try { res = await raw(path, opts); } catch (_) { /* fallthrough */ } }
    if (res.status === 401) { setToken(""); setRefresh(""); window.dispatchEvent(new Event("auth:expired")); }
  }

  let json = null;
  try { json = await res.json(); } catch (_) { /* non-JSON */ }
  if (!res.ok) throw new Error((json && json.message) || `Request failed (${res.status})`);
  return json || {};
}

export const api = {
  login: (email, password, rememberMe) => request("/api/auth/login", { method: "POST", body: { email, password, rememberMe }, auth: false }),
  logout: () => request("/api/auth/logout", { method: "POST", body: { refreshToken: getRefresh() }, auth: false }),
  me: () => request("/api/auth/me"),
  changePassword: (currentPassword, newPassword) => request("/api/auth/change-password", { method: "POST", body: { currentPassword, newPassword } }),
  forgotPassword: (email) => request("/api/auth/forgot-password", { method: "POST", body: { email }, auth: false }),
  resetPassword: (token, newPassword) => request("/api/auth/reset-password", { method: "POST", body: { token, newPassword }, auth: false }),

  // ---- Users / Roles / Audit (RBAC) ----
  users: () => request("/api/users"),
  userGet: (id) => request(`/api/users/${id}`),
  userInvite: (body) => request("/api/users", { method: "POST", body }),
  userUpdate: (id, body) => request(`/api/users/${id}`, { method: "PATCH", body }),
  userReset: (id) => request(`/api/users/${id}/reset-password`, { method: "POST" }),
  userDelete: (id) => request(`/api/users/${id}`, { method: "DELETE" }),
  userRevokeSession: (id, sid) => request(`/api/users/${id}/sessions/${sid}`, { method: "DELETE" }),
  roles: () => request("/api/roles"),
  roleCreate: (body) => request("/api/roles", { method: "POST", body }),
  roleUpdate: (id, body) => request(`/api/roles/${id}`, { method: "PATCH", body }),
  roleDelete: (id) => request(`/api/roles/${id}`, { method: "DELETE" }),
  audit: (params = {}) => { const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v != null)).toString(); return request(`/api/audit${qs ? "?" + qs : ""}`); },
  getConfig: () => request("/api/site-config", { auth: false }),
  // Draft workflow.
  getDraft: () => request("/api/site-config/draft"),
  saveDraft: (data) => request("/api/site-config", { method: "PUT", body: { data } }),
  publish: () => request("/api/site-config/publish", { method: "POST" }),
  discardDraft: () => request("/api/site-config/discard", { method: "POST" }),
  history: () => request("/api/site-config/history"),
  revert: (version) => request("/api/site-config/revert", { method: "POST", body: { version } }),
  dashboard: (days = 14) => request(`/api/stats/dashboard?days=${days}`),

  // ---- Media library ----
  mediaList: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v != null)).toString();
    return request(`/api/media${qs ? "?" + qs : ""}`);
  },
  mediaGet: (id) => request(`/api/media/${id}`),
  mediaPatch: (id, body) => request(`/api/media/${id}`, { method: "PATCH", body }),
  mediaDelete: (id, force = false) => request(`/api/media/${id}${force ? "?force=1" : ""}`, { method: "DELETE" }),

  // ---- Workshops ----
  workshops: (status = "") => request(`/api/workshops${status ? `?status=${status}` : ""}`),
  workshop: (id) => request(`/api/workshops/${id}`),
  workshopCreate: (body) => request("/api/workshops", { method: "POST", body }),
  workshopUpdate: (id, body) => request(`/api/workshops/${id}`, { method: "PUT", body }),
  workshopDelete: (id) => request(`/api/workshops/${id}`, { method: "DELETE" }),
  workshopDuplicate: (id) => request(`/api/workshops/${id}/duplicate`, { method: "POST" }),
  workshopActivate: (id) => request(`/api/workshops/${id}/activate`, { method: "POST" }),
  workshopStatus: (id, status, scheduledFor) => request(`/api/workshops/${id}/status`, { method: "POST", body: { status, scheduledFor } }),

  // ---- Registrations (CRM) ----
  regList: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v != null)).toString();
    return request(`/api/registrations${qs ? "?" + qs : ""}`);
  },
  regStats: () => request("/api/registrations/stats"),
  regFacets: () => request("/api/registrations/facets"),
  regGet: (id) => request(`/api/registrations/${id}`),
  regPatch: (id, body) => request(`/api/registrations/${id}`, { method: "PATCH", body }),
  regNote: (id, text) => request(`/api/registrations/${id}/notes`, { method: "POST", body: { text } }),
  regDelete: (id) => request(`/api/registrations/${id}`, { method: "DELETE" }),
  regBulk: (ids, action, patch) => request("/api/registrations/bulk", { method: "POST", body: { ids, action, patch } }),

  // ---- Payments ----
  payList: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v != null)).toString();
    return request(`/api/payments${qs ? "?" + qs : ""}`);
  },
  payStats: () => request("/api/payments/stats"),
  payAnalytics: (days = 14) => request(`/api/payments/analytics?days=${days}`),
  payGet: (id) => request(`/api/payments/${id}`),
  payVerify: (id) => request(`/api/payments/${id}/verify`, { method: "POST" }),
  payMark: (id, status) => request(`/api/payments/${id}/status`, { method: "POST", body: { status } }),
  payRefund: (id, body) => request(`/api/payments/${id}/refund`, { method: "POST", body }),
};

/* Authenticated file download (exports are behind auth → fetch a blob, then save). */
export async function download(path, filename) {
  const res = await fetch(BASE + path, { headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {} });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename || "download";
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

/* Multipart upload with progress (fetch can't report upload progress → XHR). */
function xhrUpload(path, file, fields, onProgress) {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append("file", file, file.name || "upload");
    for (const [k, v] of Object.entries(fields || {})) fd.append(k, v);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", BASE + path);
    if (getToken()) xhr.setRequestHeader("Authorization", `Bearer ${getToken()}`);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      let j = null; try { j = JSON.parse(xhr.responseText); } catch (_) { /* */ }
      if (xhr.status === 401) { setToken(""); window.dispatchEvent(new Event("auth:expired")); }
      if (xhr.status >= 200 && xhr.status < 300) resolve(j || {});
      else reject(new Error((j && j.message) || `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(fd);
  });
}

export const uploadMedia = (file, fields, onProgress) => xhrUpload("/api/media", file, fields, onProgress);
export const replaceMedia = (id, file, onProgress) => xhrUpload(`/api/media/${id}/replace`, file, {}, onProgress);

export { BASE };
