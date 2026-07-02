import { useEffect, useState } from "react";
import Layout from "../components/Layout.jsx";
import { api } from "../lib/api.js";

function Stat({ label, icon, value, hint, badge }) {
  return (
    <div className="card stat">
      <div className="label">{icon && <span>{icon}</span>}{label}</div>
      <div className="value">{value ?? "—"}</div>
      {badge}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export default function Dashboard() {
  const [cfg, setCfg] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.getConfig()
      .then((r) => { setCfg(r.data || {}); setUpdatedAt(r.updatedAt); })
      .catch((e) => setErr(e.message));
  }, []);

  const w = (cfg && cfg.workshop) || {};
  const reg = (cfg && cfg.registration) || {};
  const registrationOpen = reg.open !== false; // default open unless explicitly closed

  return (
    <Layout title="Dashboard">
      {err && <div className="auth-err">{err}</div>}

      <div className="section-title">Workshop at a glance</div>
      <div className="grid cards">
        <Stat label="Workshop Date" icon="📅" value={w.date} hint={w.time} />
        <Stat label="Price" icon="💳" value={w.price} hint={w.originalPrice ? `was ${w.originalPrice}` : null} />
        <Stat label="Mode" icon="💻" value={w.venue} />
        <Stat label="Registration" icon="🎟" value={registrationOpen ? "Open" : "Closed"}
          badge={<span className={`badge ${registrationOpen ? "good" : "bad"}`} style={{ marginTop: 8 }}>
            {registrationOpen ? "Accepting sign-ups" : "Paused"}</span>} />
        <Stat label="Website" icon="🌐" value="Live"
          badge={<span className="badge good" style={{ marginTop: 8 }}>Serving from CMS</span>} />
        <Stat label="Content updated" icon="🕑"
          value={updatedAt ? new Date(updatedAt).toLocaleDateString() : "—"}
          hint={updatedAt ? new Date(updatedAt).toLocaleTimeString() : null} />
      </div>

      <div className="section-title">Registrations &amp; revenue</div>
      <div className="notice">
        Registration counts, revenue, and payment status currently live in your Google Sheet + Razorpay.
        The next phase moves registrations into the database so these cards show live totals
        (Total / Today / Revenue / Pending / Successful) with charts and CSV/Excel export.
      </div>
      <div className="grid cards" style={{ marginTop: 16, opacity: .55 }}>
        <Stat label="Total Registrations" icon="👥" value="—" hint="Phase 2" />
        <Stat label="Today" icon="📈" value="—" hint="Phase 2" />
        <Stat label="Total Revenue" icon="₹" value="—" hint="Phase 2" />
        <Stat label="Pending Payments" icon="⏳" value="—" hint="Phase 2" />
        <Stat label="Successful Payments" icon="✅" value="—" hint="Phase 2" />
      </div>
    </Layout>
  );
}
