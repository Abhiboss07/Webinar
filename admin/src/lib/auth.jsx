import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, getToken, setToken, setRefresh } from "./api.js";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [perms, setPerms] = useState({ permissions: {}, isSuperAdmin: false });
  const [loading, setLoading] = useState(true);

  const applyMe = (r) => { setUser(r.user); setPerms({ permissions: r.permissions || {}, isSuperAdmin: !!r.isSuperAdmin, roleName: r.roleName }); };

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!getToken()) { setLoading(false); return; }
      try { const r = await api.me(); if (alive) applyMe(r); }
      catch (_) { setToken(""); setRefresh(""); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const onExpired = () => { setUser(null); setPerms({ permissions: {}, isSuperAdmin: false }); };
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, []);

  const login = useCallback(async (email, password, rememberMe) => {
    const r = await api.login(email, password, rememberMe);
    setToken(r.token); setRefresh(r.refreshToken || "");
    setUser(r.user); setPerms({ permissions: r.permissions || {}, isSuperAdmin: !!r.isSuperAdmin, roleName: r.roleName });
    return r.user;
  }, []);

  const logout = useCallback(async () => {
    try { await api.logout(); } catch (_) { /* best-effort */ }
    setToken(""); setRefresh(""); setUser(null); setPerms({ permissions: {}, isSuperAdmin: false });
  }, []);

  // Effective permission check for UI gating (backend still enforces).
  const can = useCallback((resource, action) => {
    if (perms.isSuperAdmin) return true;
    const p = perms.permissions || {};
    return !!(p[resource] && p[resource][action]);
  }, [perms]);

  return <AuthCtx.Provider value={{ user, loading, login, logout, can, isSuperAdmin: perms.isSuperAdmin, roleName: perms.roleName }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
