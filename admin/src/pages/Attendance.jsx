import { useEffect, useState, useCallback } from "react";
import Layout from "../components/Layout.jsx";
import { useToast } from "../components/ui.jsx";
import { api } from "../lib/api.js";

const num = (n) => new Intl.NumberFormat().format(n || 0);
const when = (d) => (d ? new Date(d).toLocaleString() : "—");
function Card({ label, value, accent }) { return <div className="card stat"><div className="label">{label}</div><div className="value" style={accent ? { color: accent } : null}>{value}</div></div>; }

function QrModal({ id, onClose }) {
  const [d, setD] = useState(null);
  useEffect(() => { api.attQr(id).then(setD).catch(() => {}); }, [id]);
  return <div className="modal-backdrop" onClick={onClose}><div className="modal" onClick={(e) => e.stopPropagation()}>
    <div className="modal-head"><h3>Check-in QR</h3><button className="btn ghost icon" onClick={onClose}>✕</button></div>
    {d ? <div style={{ textAlign: "center" }}><img src={d.dataUrl} alt="QR" style={{ width: 260 }} /><div className="muted" style={{ fontSize: 12 }}>Scan at the venue to check in</div></div> : <div className="notice">Loading…</div>}
  </div></div>;
}

export default function Attendance() {
  const toast = useToast();
  const [dash, setDash] = useState(null);
  const [data, setData] = useState(null);
  const [flt, setFlt] = useState({ q: "", attendance: "" });
  const [scan, setScan] = useState("");
  const [qrId, setQrId] = useState(null);
  const [last, setLast] = useState(null);

  const loadDash = useCallback(() => api.attDashboard().then(setDash).catch(() => {}), []);
  const load = useCallback(() => api.attList({ ...flt, limit: 25 }).then(setData).catch((e) => toast(e.message, "error")), [flt, toast]);
  useEffect(() => { loadDash(); }, [loadDash]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const checkin = async (body, label) => {
    try {
      const r = await api.attCheckin(body);
      if (r.duplicate) toast(`${r.registration.fullName}: already checked in`, "info");
      else toast(`✓ Checked in: ${r.registration.fullName}`, "success");
      setLast(r.registration); setScan(""); load(); loadDash();
    } catch (e) { toast(e.message, "error"); }
  };

  return (
    <Layout title="Attendance">
      {dash && <div className="grid cards" style={{ marginBottom: 18 }}>
        <Card label="Total" value={num(dash.cards.total)} />
        <Card label="Checked in" value={num(dash.cards.checkedIn)} accent="var(--good)" />
        <Card label="Absent (paid)" value={num(dash.cards.absent)} accent="var(--warn)" />
        <Card label="Certificates" value={num(dash.cards.certificatesIssued)} />
        <Card label="Completion" value={`${dash.cards.completionRate}%`} />
      </div>}

      <div className="panel"><div className="panel-head"><h3>Check in</h3><p>Scan a QR (hardware scanner types the token) or enter a Registration ID</p></div>
        <div className="panel-body">
          <div className="hstack" style={{ gap: 8 }}>
            <input className="input" autoFocus placeholder="Scan QR token or type Reg ID…" value={scan}
              onChange={(e) => setScan(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && scan.trim()) checkin(scan.startsWith("enc:") ? { token: scan.trim() } : { regId: scan.trim() }); }} />
            <button className="btn primary" onClick={() => scan.trim() && checkin(scan.startsWith("enc:") ? { token: scan.trim() } : { regId: scan.trim() })}>Check in</button>
          </div>
          {last && <div className="notice" style={{ marginTop: 10 }}>Last: <b>{last.fullName}</b> · {last.workshop} · checked in {when(last.checkedInAt)}</div>}
        </div>
      </div>

      <div className="crm-toolbar" style={{ marginTop: 16 }}>
        <input className="input" style={{ maxWidth: 220 }} placeholder="Search name, email, phone, reg ID…" value={flt.q} onChange={(e) => setFlt((f) => ({ ...f, q: e.target.value }))} />
        <select value={flt.attendance} onChange={(e) => setFlt((f) => ({ ...f, attendance: e.target.value }))}><option value="">All</option><option value="in">Checked in</option><option value="out">Not checked in</option></select>
      </div>
      <div className="crm-table-wrap"><table className="crm-table"><thead><tr><th>Name</th><th>Workshop</th><th>Payment</th><th>Attendance</th><th></th></tr></thead>
        <tbody>{!data ? <tr><td colSpan={5}><div className="skel" style={{ height: 14 }} /></td></tr> :
          data.items.length === 0 ? <tr><td colSpan={5}><div className="empty"><div className="em-title">No registrations</div></div></td></tr> :
            data.items.map((r) => (
              <tr key={r._id}>
                <td style={{ fontWeight: 600 }}>{r.fullName}</td><td className="muted">{r.workshop}</td>
                <td><span className={`pill ${r.paymentStatus}`}>{r.paymentStatus}</span></td>
                <td>{r.checkedInAt ? <span className="badge good">In · {when(r.checkedInAt)}</span> : <span className="badge">Pending</span>}</td>
                <td>
                  {!r.checkedInAt && <button className="btn ghost" style={{ padding: "4px 9px" }} onClick={() => checkin({ id: r._id })}>Check in</button>}
                  {r.checkedInAt && !r.checkedOutAt && <button className="btn ghost" style={{ padding: "4px 9px" }} onClick={() => api.attCheckout(r._id).then(load)}>Check out</button>}
                  <button className="btn ghost" style={{ padding: "4px 9px" }} onClick={() => setQrId(r._id)}>QR</button>
                </td>
              </tr>
            ))}</tbody></table></div>
      {data && data.pages > 1 && <div className="muted" style={{ marginTop: 10 }}>{num(data.total)} total</div>}
      {qrId && <QrModal id={qrId} onClose={() => setQrId(null)} />}
    </Layout>
  );
}
