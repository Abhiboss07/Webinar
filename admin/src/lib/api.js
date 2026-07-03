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
