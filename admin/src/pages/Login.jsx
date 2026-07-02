import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      await login(email.trim(), password);
      nav("/");
    } catch (e2) {
      setErr(e2.message || "Login failed");
    } finally {
      setBusy(false);
    }
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
        <button className="btn primary" style={{ width: "100%", justifyContent: "center", marginTop: 20 }} disabled={busy}>
          {busy ? <span className="spin" /> : "Sign in"}
        </button>
      </form>
    </div>
  );
}
