import { useEffect, useState, useCallback } from "react";
import Layout from "../components/Layout.jsx";
import { useToast } from "../components/ui.jsx";
import { api } from "../lib/api.js";

const when = (d) => new Date(d).toLocaleString();

export default function Audit() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [flt, setFlt] = useState({ action: "", user: "", dateFrom: "", dateTo: "" });
  const [page, setPage] = useState(1);
  const [actions, setActions] = useState([]);

  const load = useCallback(() => {
    api.audit({ ...flt, page, limit: 50 }).then((r) => { setData(r); if (r.actions) setActions(r.actions); }).catch((e) => toast(e.message, "error"));
  }, [flt, page, toast]);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);
  const setF = (k, v) => { setPage(1); setFlt((f) => ({ ...f, [k]: v })); };

  return (
    <Layout title="Audit Log">
      <div className="crm-toolbar">
        <input className="input" style={{ maxWidth: 200 }} placeholder="Filter by user email…" value={flt.user} onChange={(e) => setF("user", e.target.value)} />
        <select value={flt.action} onChange={(e) => setF("action", e.target.value)}><option value="">Any action</option>{actions.map((a) => <option key={a}>{a}</option>)}</select>
        <input className="input" type="date" style={{ maxWidth: 150 }} value={flt.dateFrom} onChange={(e) => setF("dateFrom", e.target.value)} />
        <input className="input" type="date" style={{ maxWidth: 150 }} value={flt.dateTo} onChange={(e) => setF("dateTo", e.target.value)} />
      </div>
      <div className="crm-table-wrap">
        <table className="crm-table"><thead><tr><th>Time</th><th>User</th><th>Action</th><th>Resource</th><th>IP</th><th>Details</th></tr></thead>
          <tbody>
            {!data ? Array.from({ length: 8 }).map((_, i) => <tr key={i}>{Array.from({ length: 6 }).map((__, j) => <td key={j}><div className="skel" style={{ height: 12 }} /></td>)}</tr>) :
              data.items.length === 0 ? <tr><td colSpan={6}><div className="empty"><div className="em-ico">📜</div><div className="em-title">No audit entries</div></div></td></tr> :
                data.items.map((a) => (
                  <tr key={a._id}>
                    <td className="muted" style={{ whiteSpace: "nowrap" }}>{when(a.at)}</td>
                    <td>{a.userEmail || "—"}</td>
                    <td><span className="mono" style={{ fontSize: 12 }}>{a.action}</span></td>
                    <td className="muted">{a.resource || "—"}</td>
                    <td className="muted mono" style={{ fontSize: 11.5 }}>{a.ip || "—"}</td>
                    <td className="muted" style={{ fontSize: 12, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.newValue ? JSON.stringify(a.newValue) : ""}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      {data && data.pages > 1 && (
        <div className="pager">
          <button className="btn ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
          <span className="muted">Page {page} of {data.pages} · {data.total} entries</span>
          <button className="btn ghost" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next →</button>
        </div>
      )}
    </Layout>
  );
}
