import { useEffect, useMemo, useState, useCallback } from "react";
import Layout from "../components/Layout.jsx";
import RegistrationDrawer from "../components/RegistrationDrawer.jsx";
import { useToast } from "../components/ui.jsx";
import { api, download } from "../lib/api.js";

const num = (n) => new Intl.NumberFormat().format(n || 0);
const money = (n, c = "INR") => new Intl.NumberFormat("en-IN", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(n || 0);
const BULK_STATUSES = ["Paid", "Pending", "Cancelled", "Refunded", "Failed"];
const COLS = [
  ["regId", "Reg ID"], ["fullName", "Name"], ["mobile", "Mobile"], ["email", "Email"],
  ["profession", "Profession"], ["experience", "Experience"], ["workshop", "Workshop"],
  ["paymentStatus", "Status"], ["createdAt", "Registered"],
];
const SORTABLE = new Set(["fullName", "paymentStatus", "createdAt"]);

function Card({ label, value, accent }) {
  return <div className="card stat"><div className="label">{label}</div><div className="value" style={accent ? { color: accent } : null}>{value}</div></div>;
}

export default function Registrations() {
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [facets, setFacets] = useState({ statuses: [], workshops: [], professions: [], experiences: [] });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [flt, setFlt] = useState({ q: "", status: "", workshop: "", profession: "", experience: "", dateFrom: "", dateTo: "" });
  const [sort, setSort] = useState({ field: "createdAt", dir: "desc" });
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState(() => new Set());
  const [openId, setOpenId] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { api.regFacets().then(setFacets).catch(() => {}); }, []);
  const loadStats = useCallback(() => api.regStats().then((r) => setStats(r.cards)).catch(() => {}), []);
  useEffect(() => { loadStats(); }, [loadStats]);

  const params = useMemo(() => ({ ...flt, sort: sort.field, dir: sort.dir, page, limit: 25 }), [flt, sort, page]);

  const load = useCallback(() => {
    setLoading(true);
    api.regList(params).then((r) => { setData(r); setSel(new Set()); }).catch((e) => toast(e.message, "error")).finally(() => setLoading(false));
  }, [params, toast]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const setF = (k, v) => { setPage(1); setFlt((f) => ({ ...f, [k]: v })); };
  const clearFilters = () => { setPage(1); setFlt({ q: "", status: "", workshop: "", profession: "", experience: "", dateFrom: "", dateTo: "" }); };
  const toggleSort = (field) => { if (!SORTABLE.has(field)) return; setSort((s) => ({ field, dir: s.field === field && s.dir === "desc" ? "asc" : "desc" })); };

  const items = data?.items || [];
  const allChecked = items.length > 0 && items.every((r) => sel.has(r._id));
  const toggleAll = () => setSel(allChecked ? new Set() : new Set(items.map((r) => r._id)));
  const toggleOne = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const exportFile = async (format, selectedOnly) => {
    setExporting(true);
    try {
      const qs = new URLSearchParams(Object.entries({ ...flt, format }).filter(([, v]) => v));
      if (selectedOnly) qs.set("ids", [...sel].join(","));
      await download(`/api/registrations/export?${qs.toString()}`, `registrations.${format === "xlsx" ? "xlsx" : "csv"}`);
    } catch (e) { toast(e.message, "error"); } finally { setExporting(false); }
  };

  const bulkStatus = async (status) => {
    if (!status) return;
    try { const r = await api.regBulk([...sel], "status", { paymentStatus: status }); toast(`Updated ${r.updated} registration(s)`, "success"); load(); loadStats(); }
    catch (e) { toast(e.message, "error"); }
  };
  const bulkDelete = async () => {
    if (!window.confirm(`Delete ${sel.size} registration(s)? This cannot be undone.`)) return;
    try { const r = await api.regBulk([...sel], "delete"); toast(`Deleted ${r.deleted}`, "info"); load(); loadStats(); }
    catch (e) { toast(e.message, "error"); }
  };

  const sortIcon = (f) => (sort.field !== f ? "" : sort.dir === "desc" ? " ↓" : " ↑");

  return (
    <Layout title="Registrations">
      <div className="grid cards" style={{ marginBottom: 18 }}>
        {!stats ? Array.from({ length: 6 }).map((_, i) => <div className="card stat" key={i}><div className="skel" style={{ height: 12, width: "55%" }} /><div className="skel" style={{ height: 24, width: "40%", marginTop: 12 }} /></div>) : <>
          <Card label="Total" value={num(stats.total)} />
          <Card label="Today" value={num(stats.today)} />
          <Card label="Paid" value={num(stats.paid)} accent="var(--good)" />
          <Card label="Pending" value={num(stats.pending)} accent="var(--warn)" />
          <Card label="Revenue" value={money(stats.revenue)} />
          <Card label="Conversion" value={`${stats.conversion}%`} />
        </>}
      </div>

      <div className="crm-toolbar">
        <input className="input" style={{ maxWidth: 220 }} placeholder="Search name, email, phone…" value={flt.q} onChange={(e) => setF("q", e.target.value)} />
        <select value={flt.status} onChange={(e) => setF("status", e.target.value)}><option value="">Any status</option>{facets.statuses.map((s) => <option key={s}>{s}</option>)}</select>
        <select value={flt.workshop} onChange={(e) => setF("workshop", e.target.value)}><option value="">Any workshop</option>{facets.workshops.map((s) => <option key={s}>{s}</option>)}</select>
        <select value={flt.profession} onChange={(e) => setF("profession", e.target.value)}><option value="">Any profession</option>{facets.professions.map((s) => <option key={s}>{s}</option>)}</select>
        <select value={flt.experience} onChange={(e) => setF("experience", e.target.value)}><option value="">Any experience</option>{facets.experiences.map((s) => <option key={s}>{s}</option>)}</select>
        <input className="input" type="date" style={{ maxWidth: 150 }} value={flt.dateFrom} onChange={(e) => setF("dateFrom", e.target.value)} title="From" />
        <input className="input" type="date" style={{ maxWidth: 150 }} value={flt.dateTo} onChange={(e) => setF("dateTo", e.target.value)} title="To" />
        <button className="btn ghost" onClick={clearFilters}>Clear</button>
        <div className="spacer" />
        <button className="btn ghost" disabled={exporting} onClick={() => exportFile("csv", false)}>Export CSV</button>
        <button className="btn ghost" disabled={exporting} onClick={() => exportFile("xlsx", false)}>Export Excel</button>
      </div>

      {sel.size > 0 && (
        <div className="bulk-bar">
          <b>{sel.size} selected</b>
          <select defaultValue="" onChange={(e) => { bulkStatus(e.target.value); e.target.value = ""; }}>
            <option value="">Set status…</option>{BULK_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <button className="btn ghost" onClick={() => exportFile("csv", true)}>Export selected</button>
          <div className="spacer" />
          <button className="btn ghost" style={{ color: "var(--bad)" }} onClick={bulkDelete}>Delete selected</button>
        </div>
      )}

      <div className="crm-table-wrap">
        <table className="crm-table">
          <thead>
            <tr>
              <th style={{ width: 34 }}><input type="checkbox" checked={allChecked} onChange={toggleAll} /></th>
              {COLS.map(([k, label]) => (
                <th key={k} onClick={() => toggleSort(k)} className={SORTABLE.has(k) ? "sortable" : ""}>{label}{sortIcon(k)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? Array.from({ length: 8 }).map((_, i) => (
              <tr key={i}>{Array.from({ length: COLS.length + 1 }).map((__, j) => <td key={j}><div className="skel" style={{ height: 12 }} /></td>)}</tr>
            )) : items.length === 0 ? (
              <tr><td colSpan={COLS.length + 1}><div className="empty"><div className="em-ico">📭</div><div className="em-title">No registrations match</div></div></td></tr>
            ) : items.map((r) => (
              <tr key={r._id} className={sel.has(r._id) ? "row-sel" : ""}>
                <td onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={sel.has(r._id)} onChange={() => toggleOne(r._id)} /></td>
                <td className="mono" style={{ fontSize: 11.5, cursor: "pointer" }} onClick={() => setOpenId(r._id)}>{r.regId?.slice(0, 14)}</td>
                <td style={{ fontWeight: 600, cursor: "pointer" }} onClick={() => setOpenId(r._id)}>{r.fullName || "—"}</td>
                <td>{r.mobile}</td>
                <td className="muted">{r.email}</td>
                <td>{r.profession}</td>
                <td className="muted">{r.experience}</td>
                <td className="muted" style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.workshop}</td>
                <td><span className={`pill ${r.paymentStatus}`}>{r.paymentStatus}</span></td>
                <td className="muted" style={{ whiteSpace: "nowrap" }}>{new Date(r.createdAt).toLocaleDateString()}</td>
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

      {openId && <RegistrationDrawer id={openId} onClose={() => setOpenId(null)} onChanged={() => { load(); loadStats(); }} />}
    </Layout>
  );
}
