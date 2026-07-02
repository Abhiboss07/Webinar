import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, getToken, setToken } from "./api.js";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore a session from a stored token on first load.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!getToken()) { setLoading(false); return; }
      try { const r = await api.me(); if (alive) setUser(r.user); }
      catch (_) { setToken(""); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  // Global 401 → drop session.
  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, []);

  const login = useCallback(async (email, password) => {
    const r = await api.login(email, password);
    setToken(r.token);
    setUser(r.user);
    return r.user;
  }, []);

  const logout = useCallback(() => { setToken(""); setUser(null); }, []);

  return <AuthCtx.Provider value={{ user, loading, login, logout }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
