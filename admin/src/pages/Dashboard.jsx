import { useEffect, useState } from "react";
import Layout from "../components/Layout.jsx";
import { Panel } from "../components/ui.jsx";
import { AreaLine, Donut, HBars } from "../components/charts.jsx";
import { api } from "../lib/api.js";

const money = (n, cur = "INR") =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n || 0);
const num = (n) => new Intl.NumberFormat().format(n || 0);

function Stat({ label, icon, value, hint, accent }) {
  return (
    <div className="card stat">
      <div className="label">{icon && <span>{icon}</span>}{label}</div>
      <div className="value" style={accent ? { color: accent } : null}>{value}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

function SkelCards() {
  return (
    <div className="grid cards">
      {Array.from({ length: 6 }).map((_, i) => (
        <div className="card stat" key={i}>
          <div className="skel" style={{ height: 12, width: "55%" }} />
          <div className="skel" style={{ height: 26, width: "40%", marginTop: 12 }} />
        </div>
      ))}
    </div>
  );
}

function Empty({ title, hint }) {
  return (
    <div className="empty">
      <div className="em-ico">📭</div>
      <div className="em-title">{title}</div>
      {hint && <div style={{ fontSize: 13, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [days, setDays] = useState(14);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.dashboard(days)
      .then((r) => { if (alive) { setData(r); setErr(""); } })
      .catch((e) => { if (alive) setErr(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [days]);

  const c = data?.cards;
  const w = data?.workshop;
  const hasRegs = (c?.total || 0) > 0;

  return (
    <Layout title="Dashboard">
      {err && <div className="auth-err">{err}</div>}

      <div className="hstack" style={{ marginBottom: 14 }}>
        <div className="section-title" style={{ margin: 0 }}>Overview</div>
        <div className="spacer" />
        <div className="hstack" style={{ gap: 6, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 4 }}>
          {[7, 14, 30, 90].map((d) => (
            <button key={d} className={`btn ${days === d ? "primary" : "ghost"}`} style={{ padding: "6px 11px" }} onClick={() => setDays(d)}>{d}d</button>
          ))}
        </div>
      </div>

      {loading || !c ? <SkelCards /> : (
        <div className="grid cards">
          <Stat label="Total Registrations" icon="👥" value={num(c.total)} hint={`${num(c.today)} today`} />
          <Stat label="Successful Payments" icon="✅" value={num(c.paid)} accent="var(--good)" />
          <Stat label="Pending Payments" icon="⏳" value={num(c.pending)} accent="var(--warn)" />
          <Stat label="Revenue" icon="₹" value={money(c.revenue, c.currency)} hint="from paid registrations" />
          <Stat label="Today" icon="📈" value={num(c.today)} hint="new sign-ups" />
          <Stat label="Upcoming Workshop" icon="📅" value={w?.date || "—"} hint={w?.name || ""} />
        </div>
      )}

      <div className="section-title">Analytics</div>
      <div className="charts-grid">
        <Panel title="Registrations over time" subtitle={`Last ${days} days`}>
          {loading ? <div className="skel" style={{ height: 200 }} /> :
            hasRegs ? <AreaLine data={data.charts.registrationsOverTime} /> :
              <Empty title="No registrations yet" hint="Sign-ups will chart here as they arrive." />}
        </Panel>
        <Panel title="Payment status" subtitle="All registrations">
          {loading ? <div className="skel" style={{ height: 200 }} /> :
            hasRegs ? <Donut data={data.charts.paymentStatus} /> :
              <Empty title="Nothing to show" />}
        </Panel>
      </div>

      <div className="charts-grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 16 }}>
        <Panel title="Registration source" subtitle="Where sign-ups come from">
          {loading ? <div className="skel" style={{ height: 140 }} /> :
            hasRegs ? <HBars data={data.charts.sourceBreakdown} /> :
              <Empty title="No source data yet" />}
        </Panel>
        <Panel title="Recent activity" subtitle="Latest sign-ups">
          {loading ? <div className="skel" style={{ height: 140 }} /> :
            data.recentActivity.length ? (
              <div style={{ overflowX: "auto" }}>
                <table className="tbl">
                  <thead><tr><th>Name</th><th>Profession</th><th>City</th><th>Status</th></tr></thead>
                  <tbody>
                    {data.recentActivity.map((r, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{r.name}</td>
                        <td className="muted">{r.profession || "—"}</td>
                        <td className="muted">{r.city || "—"}</td>
                        <td><span className={`pill ${r.status}`}>{r.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <Empty title="No activity yet" />}
        </Panel>
      </div>
    </Layout>
  );
}
