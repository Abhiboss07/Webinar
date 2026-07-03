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

  // ---- Settings ----
  settingsGet: () => request("/api/settings"),
  settingsUpdate: (section, values) => request("/api/settings", { method: "PATCH", body: { section, values } }),
  settingsTest: (target) => request("/api/settings/test", { method: "POST", body: { target } }),
  settingsTestEmail: (to) => request("/api/settings/test-email", { method: "POST", body: { to } }),
  settingsDiagnostics: () => request("/api/settings/diagnostics"),
  settingsHistory: () => request("/api/settings/history"),
  settingsImport: (data) => request("/api/settings/import", { method: "POST", body: { data } }),
  settingsRestore: () => request("/api/settings/restore-defaults", { method: "POST" }),
  settingsRevert: (index) => request("/api/settings/revert", { method: "POST", body: { index } }),

  // ---- Communication ----
  commDashboard: () => request("/api/comm/dashboard"),
  commTemplates: (channel = "") => request(`/api/comm/templates${channel ? `?channel=${channel}` : ""}`),
  commTemplateGet: (id) => request(`/api/comm/templates/${id}`),
  commTemplateCreate: (body) => request("/api/comm/templates", { method: "POST", body }),
  commTemplateUpdate: (id, body) => request(`/api/comm/templates/${id}`, { method: "PATCH", body }),
  commTemplateDuplicate: (id) => request(`/api/comm/templates/${id}/duplicate`, { method: "POST" }),
  commTemplateDelete: (id) => request(`/api/comm/templates/${id}`, { method: "DELETE" }),
  commPreview: (subject, body) => request("/api/comm/templates/preview", { method: "POST", body: { subject, body } }),
  commHistory: (params = {}) => { const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v != null)).toString(); return request(`/api/comm/history${qs ? "?" + qs : ""}`); },
  commQueueProcess: () => request("/api/comm/queue/process", { method: "POST" }),
  commQueueRetry: (ids) => request("/api/comm/queue/retry", { method: "POST", body: { ids } }),
  commQueueCancel: (ids) => request("/api/comm/queue/cancel", { method: "POST", body: { ids } }),
  commQueuePause: (paused) => request("/api/comm/queue/pause", { method: "POST", body: { paused } }),
  commSendTest: (body) => request("/api/comm/send-test", { method: "POST", body }),
  commSendBulk: (body) => request("/api/comm/send-bulk", { method: "POST", body }),
  commTriggers: () => request("/api/comm/triggers"),
  commSetTriggers: (triggers) => request("/api/comm/triggers", { method: "POST", body: { triggers } }),

  // ---- Event Operations (attendance + certificates) ----
  attDashboard: () => request("/api/attendance/dashboard"),
  attAnalytics: () => request("/api/attendance/analytics"),
  attList: (params = {}) => { const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v != null)).toString(); return request(`/api/attendance${qs ? "?" + qs : ""}`); },
  attQr: (id) => request(`/api/attendance/${id}/qr`),
  attCheckin: (body) => request("/api/attendance/checkin", { method: "POST", body }),
  attCheckout: (id) => request(`/api/attendance/${id}/checkout`, { method: "POST" }),
  certList: (params = {}) => { const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v != null)).toString(); return request(`/api/certificates${qs ? "?" + qs : ""}`); },
  certTemplate: () => request("/api/certificates/template"),
  certTemplateSave: (body) => request("/api/certificates/template", { method: "PATCH", body }),
  certGenerate: (registrationId, force) => request("/api/certificates/generate", { method: "POST", body: { registrationId, force } }),
  certBulk: (body) => request("/api/certificates/bulk-generate", { method: "POST", body }),
  certRevoke: (id, reason) => request(`/api/certificates/${id}/revoke`, { method: "POST", body: { reason } }),
  certReissue: (id) => request(`/api/certificates/${id}/reissue`, { method: "POST" }),
  certEmail: (id) => request(`/api/certificates/${id}/email`, { method: "POST" }),
  certVerify: (n, t) => request(`/api/certificates/verify?n=${encodeURIComponent(n)}&t=${encodeURIComponent(t || "")}`, { auth: false }),

  // ---- Analytics ----
  anExecutive: () => request("/api/analytics/executive"),
  anRevenue: (p = {}) => { const qs = new URLSearchParams(Object.entries(p).filter(([, v]) => v)).toString(); return request(`/api/analytics/revenue${qs ? "?" + qs : ""}`); },
  anRegistrations: (p = {}) => { const qs = new URLSearchParams(Object.entries(p).filter(([, v]) => v)).toString(); return request(`/api/analytics/registrations${qs ? "?" + qs : ""}`); },
  anAttendance: () => request("/api/analytics/attendance"),
  anCertificates: () => request("/api/analytics/certificates"),
  anCommunication: () => request("/api/analytics/communication"),
  anWorkshops: () => request("/api/analytics/workshops"),

  // ---- System Administration ----
  sysOverview: () => request("/api/system/overview"),
  sysHealth: () => request("/api/system/health"),
  sysStorage: () => request("/api/system/storage"),
  sysQueue: () => request("/api/system/queue"),
  sysLogs: (p = {}) => { const qs = new URLSearchParams(Object.entries(p).filter(([, v]) => v !== "" && v != null)).toString(); return request(`/api/system/logs${qs ? "?" + qs : ""}`); },
  sysEnvironment: () => request("/api/system/environment"),
  sysSecurity: () => request("/api/system/security"),
  sysNotifications: () => request("/api/system/notifications"),
  sysMaintenance: () => request("/api/system/maintenance"),
  sysSetMaintenance: (enabled, message) => request("/api/system/maintenance", { method: "POST", body: { enabled, message } }),
  sysBackups: () => request("/api/system/backups"),
  sysBackup: (includeData) => request("/api/system/backups", { method: "POST", body: { includeData } }),
  sysBackupVerify: (id) => request(`/api/system/backups/${id}/verify`, { method: "POST" }),
  sysRestore: (id) => request(`/api/system/backups/${id}/restore`, { method: "POST", body: { confirm: true } }),

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

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename || "download";
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

/* Authenticated file download (exports are behind auth → fetch a blob, then save). */
export async function download(path, filename) {
  const res = await fetch(BASE + path, { headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {} });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  saveBlob(await res.blob(), filename);
}

/* Authenticated POST download (e.g. a ZIP built from a body). */
export async function downloadPost(path, body, filename) {
  const res = await fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json", ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) }, body: JSON.stringify(body || {}) });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  saveBlob(await res.blob(), filename);
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
