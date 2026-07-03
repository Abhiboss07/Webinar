import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import { api } from "../lib/api.js";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      await login(email.trim(), password, remember);
      nav("/");
    } catch (e2) {
      setErr(e2.message || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    if (!email.trim()) { setErr("Enter your email first, then click Forgot password."); return; }
    setErr(""); setNote("");
    try {
      const r = await api.forgotPassword(email.trim());
      setNote(r.devToken ? `Reset token (dev): ${r.devToken}` : r.message || "If that email exists, a reset link was sent.");
    } catch (e2) { setErr(e2.message); }
  };

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit}>
        <div className="brand" style={{ padding: 0, marginBottom: 18 }}>
          <div className="brand-mark">Y</div>
          <div><div className="brand-name">Youngness CMS</div><div className="brand-sub">Admin panel</div></div>
        </div>
        <h2>Welcome back</h2>
        <p className="sub">Sign in to manage your workshop website.</p>
        {err && <div className="auth-err">{err}</div>}
        {note && <div className="notice" style={{ marginBottom: 14, wordBreak: "break-all" }}>{note}</div>}
        <div className="field">
          <label>Email</label>
          <input className="input" type="email" autoComplete="username" value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="admin@youngness.com" required />
        </div>
        <div className="field" style={{ marginTop: 14 }}>
          <label>Password</label>
          <input className="input" type="password" autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
        </div>
        <div className="hstack" style={{ marginTop: 12, fontSize: 13 }}>
          <label className="flag"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember me</label>
          <div className="spacer" />
          <button type="button" className="btn ghost" style={{ padding: "3px 8px", fontSize: 13 }} onClick={forgot}>Forgot password?</button>
        </div>
        <button className="btn primary" style={{ width: "100%", justifyContent: "center", marginTop: 18 }} disabled={busy}>
          {busy ? <span className="spin" /> : "Sign in"}
        </button>
      </form>
    </div>
  );
}
