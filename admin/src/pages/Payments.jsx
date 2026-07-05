import { useEffect, useMemo, useState, useCallback } from "react";
import Layout from "../components/Layout.jsx";
import { Panel } from "../components/ui.jsx";
import { AreaLine, HBars } from "../components/charts.jsx";
import PaymentDrawer from "../components/PaymentDrawer.jsx";
import { useToast } from "../components/ui.jsx";
import { api, download } from "../lib/api.js";

const money = (n, c = "INR") => new Intl.NumberFormat("en-IN", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(n || 0);
const num = (n) => new Intl.NumberFormat().format(n || 0);
const STATUSES = ["Paid", "Pending", "Failed", "Refunded", "Cancelled"];

function Card({ label, value, accent }) {
  return <div className="card stat"><div className="label">{label}</div><div className="value" style={accent ? { color: accent } : null}>{value}</div></div>;
}

export default function Payments() {
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [an, setAn] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [flt, setFlt] = useState({ q: "", status: "", workshop: "", method: "", amountMin: "", amountMax: "", dateFrom: "", dateTo: "" });
  const [facets, setFacets] = useState({ workshops: [], methods: [] });
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { api.regFacets().then((f) => setFacets({ workshops: f.workshops || [], methods: f.methods || [] })).catch(() => {}); }, []);
  const loadStats = useCallback(() => { api.payStats().then((r) => setStats(r.cards)).catch(() => {}); api.payAnalytics(14).then(setAn).catch(() => {}); }, []);
  useEffect(() => { loadStats(); }, [loadStats]);

  const params = useMemo(() => ({ ...flt, page, limit: 25 }), [flt, page]);
  const load = useCallback(() => {
    setLoading(true);
    api.payList(params).then(setData).catch((e) => toast(e.message, "error")).finally(() => setLoading(false));
  }, [params, toast]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const setF = (k, v) => { setPage(1); setFlt((f) => ({ ...f, [k]: v })); };
  const exportFile = async (format) => {
    setExporting(true);
    try { const qs = new URLSearchParams(Object.entries({ ...flt, format }).filter(([, v]) => v)); await download(`/api/payments/export?${qs}`, `payments.${format === "xlsx" ? "xlsx" : "csv"}`); }
    catch (e) { toast(e.message, "error"); } finally { setExporting(false); }
  };
  const items = data?.items || [];

  return (
    <Layout title="Payments">
      <div className="grid cards" style={{ marginBottom: 18 }}>
        {!stats ? Array.from({ length: 8 }).map((_, i) => <div className="card stat" key={i}><div className="skel" style={{ height: 12, width: "55%" }} /><div className="skel" style={{ height: 24, width: "45%", marginTop: 12 }} /></div>) : <>
          <Card label="Total Revenue" value={money(stats.revenue)} />
          <Card label="Today's Revenue" value={money(stats.todayRevenue)} />
          <Card label="Successful" value={num(stats.successful)} accent="var(--good)" />
          <Card label="Pending" value={num(stats.pending)} accent="var(--warn)" />
          <Card label="Failed" value={num(stats.failed)} accent="var(--bad)" />
          <Card label="Refunded" value={num(stats.refunded)} />
          <Card label="Avg Ticket" value={money(stats.avgTicket)} />
          <Card label="Conversion" value={`${stats.conversion}%`} />
        </>}
      </div>

      <div className="charts-grid" style={{ marginBottom: 18 }}>
        <Panel title="Revenue over time" subtitle="Last 14 days (paid)">
          {!an ? <div className="skel" style={{ height: 200 }} /> : an.revenueByDay.some((d) => d.total) ? <AreaLine data={an.revenueByDay} /> : <div className="empty"><div className="em-ico">₹</div><div className="em-title">No revenue yet</div></div>}
        </Panel>
        <Panel title="Revenue by workshop" subtitle={an ? `Success ${an.successRate}% · Refund ${an.refundRate}%` : ""}>
          {!an ? <div className="skel" style={{ height: 200 }} /> : an.revenueByWorkshop.length ? <HBars data={an.revenueByWorkshop} /> : <div className="empty"><div className="em-title">No paid workshops yet</div></div>}
        </Panel>
      </div>

      <div className="crm-toolbar">
        <input className="input" style={{ maxWidth: 210 }} placeholder="Search payment/order/reg ID, name…" value={flt.q} onChange={(e) => setF("q", e.target.value)} />
        <select value={flt.status} onChange={(e) => setF("status", e.target.value)}><option value="">Any status</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        <select value={flt.workshop} onChange={(e) => setF("workshop", e.target.value)}><option value="">Any workshop</option>{facets.workshops.map((s) => <option key={s}>{s}</option>)}</select>
        <select value={flt.method} onChange={(e) => setF("method", e.target.value)}><option value="">Any method</option>{facets.methods.map((s) => <option key={s}>{s}</option>)}</select>
        <input className="input" type="number" style={{ maxWidth: 96 }} placeholder="Min ₹" value={flt.amountMin} onChange={(e) => setF("amountMin", e.target.value)} />
        <input className="input" type="number" style={{ maxWidth: 96 }} placeholder="Max ₹" value={flt.amountMax} onChange={(e) => setF("amountMax", e.target.value)} />
        <input className="input" type="date" style={{ maxWidth: 145 }} value={flt.dateFrom} onChange={(e) => setF("dateFrom", e.target.value)} />
        <input className="input" type="date" style={{ maxWidth: 145 }} value={flt.dateTo} onChange={(e) => setF("dateTo", e.target.value)} />
        <div className="spacer" />
        <button className="btn ghost" disabled={exporting} onClick={() => exportFile("csv")}>CSV</button>
        <button className="btn ghost" disabled={exporting} onClick={() => exportFile("xlsx")}>Excel</button>
      </div>

      <div className="crm-table-wrap">
        <table className="crm-table">
          <thead><tr>
            {["Payment ID", "Reg ID", "Participant", "Workshop", "Amount", "Method", "Status", "Created", "Refund"].map((h) => <th key={h}>{h}</th>)}
          </tr></thead>
          <tbody>
            {loading ? Array.from({ length: 8 }).map((_, i) => <tr key={i}>{Array.from({ length: 9 }).map((__, j) => <td key={j}><div className="skel" style={{ height: 12 }} /></td>)}</tr>) :
              items.length === 0 ? <tr><td colSpan={9}><div className="empty"><div className="em-ico">💳</div><div className="em-title">No payments match</div></div></td></tr> :
                items.map((p) => (
                  <tr key={p._id} style={{ cursor: "pointer" }} onClick={() => setOpenId(p._id)}>
                    <td className="mono" style={{ fontSize: 11 }}>{p.paymentId ? p.paymentId.slice(0, 16) : "—"}</td>
                    <td className="mono" style={{ fontSize: 11 }}>{p.regId?.slice(0, 12)}</td>
                    <td style={{ fontWeight: 600 }}>{p.fullName || "—"}</td>
                    <td className="muted" style={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.workshop}</td>
                    <td style={{ fontWeight: 600 }}>{money(p.amount, p.currency)}</td>
                    <td className="muted">{p.paymentMethod || "—"}</td>
                    <td><span className={`pill ${p.paymentStatus}`}>{p.paymentStatus}</span></td>
                    <td className="muted" style={{ whiteSpace: "nowrap" }}>{new Date(p.createdAt).toLocaleDateString()}</td>
                    <td className="muted">{p.refundAmount ? money(p.refundAmount, p.currency) : "—"}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {data && data.pages > 1 && (
        <div className="pager">
          <button className="btn ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
          <span className="muted">Page {page} of {data.pages} · {num(data.total)} total</span>
          <button className="btn ghost" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next →</button>
        </div>
      )}

      {openId && <PaymentDrawer id={openId} onClose={() => setOpenId(null)} onChanged={() => { load(); loadStats(); }} />}
    </Layout>
  );
}
